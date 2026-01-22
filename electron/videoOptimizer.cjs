const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static');
const logger = require('./logger.cjs');

// Electron本番環境(asar)でのパス問題を回避するための設定
// ffmpeg-staticのバイナリパスを正しく設定
let binaryPath = ffmpegPath;
if (binaryPath.includes('app.asar')) {
  binaryPath = binaryPath.replace('app.asar', 'app.asar.unpacked');
}
ffmpeg.setFfmpegPath(binaryPath);

// ffprobe-staticのバイナリパス設定
let probePath = ffprobePath.path;
if (probePath.includes('app.asar')) {
  probePath = probePath.replace('app.asar', 'app.asar.unpacked');
}
ffmpeg.setFfprobePath(probePath);

const OPTIMIZED_SIGNATURE = 'gido-optimized-baseline';
const TIMEOUT_MS = 300000; // 5分

/**
 * ファイルがロックされていないかチェックする（書き込み可能か確認）
 * @param {string} filePath チェック対象のファイルパス
 * @returns {boolean} ロックされている場合はtrue
 */
function isFileLocked(filePath) {
  try {
    // 読み書きモード('r+')でオープンを試みる
    // WSPなどが排他的に開いている場合はここでエラーになる
    const fd = fs.openSync(filePath, 'r+');
    fs.closeSync(fd);
    return false; // ロックされていない
  } catch (error) {
    if (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES') {
      return true; // ロックされている
    }
    // その他のエラー（ファイルがない等）も処理できないのでロック扱いとする
    return true; 
  }
}

/**
 * 動画が既に最適化済みかチェックする
 * @param {string} filePath
 * @returns {Promise<boolean>}
 */
function isAlreadyOptimized(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        // 読み込めない、または動画でない場合は未最適化として扱う（エラーログは出さない）
        return resolve(false);
      }
      const tags = metadata.format.tags || {};
      // コメントタグに署名があるか確認
      if (tags.comment === OPTIMIZED_SIGNATURE) {
        return resolve(true);
      }
      resolve(false);
    });
  });
}

/**
 * 動画ファイルをCPU負荷の低い形式に最適化する
 * @param {string} inputPath 入力ファイルパス
 * @param {string} outputPath 出力ファイルパス
 * @returns {Promise<void>}
 */
function optimizeVideo(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    logger.info(`Starting video optimization: ${path.basename(inputPath)}`);
    
    const command = ffmpeg(inputPath)
      .outputOptions([
        '-vf scale=1080:-2,fps=30', // 横幅1080pxにリサイズ(縦は比率維持)、30fps化
        '-c:v libx264',             // H.264
        '-profile:v baseline',      // Baselineプロファイル (最重要: 負荷軽減)
        '-level 3.1',               // 互換性確保
        '-b:v 2000k',               // ビットレート制限
        '-maxrate 2500k',
        '-bufsize 5000k',
        '-c:a aac',                 // 音声
        '-b:a 128k',
        '-movflags +faststart',     // Web再生最適化
        '-metadata', `comment=${OPTIMIZED_SIGNATURE}` // 最適化済みフラグ
      ]);

    // タイムアウト設定
    const timeout = setTimeout(() => {
        logger.error(`Optimization timed out for ${path.basename(inputPath)}`);
        command.kill('SIGKILL');
        reject(new Error('Optimization timed out'));
    }, TIMEOUT_MS);

    command
      .save(outputPath)
      .on('end', () => {
        clearTimeout(timeout);
        logger.info(`Optimization completed: ${path.basename(inputPath)}`);
        resolve();
      })
      .on('error', (err) => {
        clearTimeout(timeout);
        // killした場合はエラーになるのでここでキャッチ
        if (err.message.includes('SIGKILL')) {
            // timeout処理側でrejectしているのでここは無視でも良いが念のため
        } else {
            logger.error(`Optimization failed: ${path.basename(inputPath)}`, { error: err.message });
            reject(err);
        }
      });
  });
}

/**
 * ディレクトリ内の全動画ファイルを再帰的に検索して最適化する
 * @param {string} dirPath 対象ディレクトリ
 * @param {Function} onProgress 進捗コールバック (current, total, filename)
 */
async function optimizeAllVideosInDirectory(dirPath, onProgress) {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
  const filesToProcess = [];

  // 1. ファイル一覧の収集（再帰的）
  function scan(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (videoExtensions.includes(path.extname(fullPath).toLowerCase())) {
        filesToProcess.push(fullPath);
      }
    }
  }
  
  scan(dirPath);

  logger.info(`Found ${filesToProcess.length} videos to optimize in ${dirPath}`);

  // 2. 順次処理
  for (let i = 0; i < filesToProcess.length; i++) {
    const inputPath = filesToProcess[i];
    const tempPath = inputPath + '.temp.mp4';
    const filename = path.basename(inputPath);

    if (onProgress) {
      onProgress(i + 1, filesToProcess.length, filename);
    }

    // ロックチェック: WSP等が使用中の場合はスキップする
    if (isFileLocked(inputPath)) {
      logger.warn(`Skipping optimization for locked file: ${filename}`);
      continue;
    }

    // 既に最適化済みならスキップ
    const optimized = await isAlreadyOptimized(inputPath);
    if (optimized) {
       logger.info(`Skipping already optimized file: ${filename}`);
       continue;
    }

    try {
      // 最適化を実行して一時ファイルに出力
      await optimizeVideo(inputPath, tempPath);
      
      // 元ファイルを削除して、最適化済みファイルをリネーム
      // リネーム直前にも念のためロックチェック（競合回避は完全ではないがリスク低減）
      if (isFileLocked(inputPath)) {
         logger.warn(`File became locked during optimization, cancelling overwrite: ${filename}`);
         if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
         continue;
      }

      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }
      fs.renameSync(tempPath, inputPath);
    } catch (error) {
      logger.error(`Skipping optimization for ${filename} due to error`, { error: error.message });
      // 失敗時は一時ファイルを削除し、元ファイルを維持
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }
}

module.exports = {
  optimizeAllVideosInDirectory
};
