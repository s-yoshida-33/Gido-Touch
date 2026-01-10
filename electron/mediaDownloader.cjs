// electron/mediaDownloader.cjs
const fs = require('fs');
const path = require('path');
const https = require('https');
const AdmZip = require('adm-zip');
const { app } = require('electron');
const logger = require('./logger.cjs');

/**
 * Download a file from a URL to a destination path
 */
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, destPath, onProgress)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        fs.unlink(destPath, () => {}); // Delete partial file
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const total = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      let lastUpdate = 0;

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);

        // Update progress roughly every 100ms
        const now = Date.now();
        if (now - lastUpdate > 100) {
          if (onProgress) {
            onProgress({
              percent: total ? (downloaded / total) * 100 : 0,
              transferred: downloaded,
              total: total || 0
            });
          }
          lastUpdate = now;
        }
      });

      response.on('end', () => {
        file.end();
        // Send final progress
        if (onProgress) {
            onProgress({
              percent: 100,
              transferred: downloaded,
              total: total || downloaded
            });
        }
        resolve();
      });

      response.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Ensure media files exist for the specified mall ID.
 * Checks version matching to decide whether to update.
 * 
 * @param {string} mallId - The mall ID (e.g., 'suzaka', 'sendaikamisugi')
 * @param {BrowserWindow} patchWindow - Window to send progress events to
 * @returns {Promise<void>}
 */
async function ensureMediaFiles(mallId, patchWindow) {
  const userDataPath = app.getPath('userData');
  const mediaRootDir = path.join(userDataPath, 'media');
  const mallMediaDir = path.join(mediaRootDir, mallId);
  const versionFilePath = path.join(mallMediaDir, '.version');
  
  // Create media directory if it doesn't exist
  if (!fs.existsSync(mediaRootDir)) {
    fs.mkdirSync(mediaRootDir, { recursive: true });
  }

  const appVersion = app.getVersion();
  let currentMediaVersion = null;

  // Check existing version
  if (fs.existsSync(mallMediaDir) && fs.existsSync(versionFilePath)) {
    try {
      currentMediaVersion = fs.readFileSync(versionFilePath, 'utf-8').trim();
    } catch (e) {
      logger.warn(`Failed to read media version file: ${e.message}`);
    }
  }

  const hasMediaFiles = fs.existsSync(mallMediaDir) && fs.readdirSync(mallMediaDir).length > 0;

  // If version matches and files exist, skip update
  if (hasMediaFiles && currentMediaVersion === appVersion) {
    logger.info(`Media files for ${mallId} are up to date (v${appVersion})`);
    return;
  }

  logger.info(`Media check: current=${currentMediaVersion}, app=${appVersion}. Starting download check...`);

  // Construct GitHub Release URL
  const repoOwner = "s-yoshida-33";
  const repoName = "Gido-Touch";
  const downloadUrl = `https://github.com/${repoOwner}/${repoName}/releases/download/v${appVersion}/media-${mallId}.zip`;
  const zipPath = path.join(mediaRootDir, `media-${mallId}.zip`);

  try {
    // Notify UI: Starting download
    if (patchWindow && !patchWindow.isDestroyed()) {
      patchWindow.webContents.send('update-status', {
        state: 'media_downloading',
        message: `メディアデータの更新を確認中... (${mallId})`,
      });
    }

    // Download
    await downloadFile(downloadUrl, zipPath, (progress) => {
      if (patchWindow && !patchWindow.isDestroyed()) {
        patchWindow.webContents.send('update-progress', {
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
            speed: 0
        });
      }
    });

    logger.info(`Downloaded media zip to ${zipPath}`);

    // Extract
    if (patchWindow && !patchWindow.isDestroyed()) {
        patchWindow.webContents.send('update-status', {
          state: 'media_downloading',
          message: 'メディアデータを展開中...',
        });
    }

    const zip = new AdmZip(zipPath);
    
    // Clear existing directory before extracting new files
    // But be careful: if extraction fails, we might lose data.
    // For now, we extract over existing.
    if (!fs.existsSync(mallMediaDir)) {
        fs.mkdirSync(mallMediaDir, { recursive: true });
    }
    
    zip.extractAllTo(mallMediaDir, true);
    
    // Write version file
    fs.writeFileSync(versionFilePath, appVersion, 'utf-8');
    
    logger.info(`Extracted media to ${mallMediaDir} and updated version to ${appVersion}`);

    // Cleanup zip
    fs.unlinkSync(zipPath);

  } catch (error) {
    // Handle 404 (File not found on GitHub)
    if (error.message.includes('404')) {
        logger.warn('Media asset not found on GitHub.', { url: downloadUrl });

        if (hasMediaFiles) {
            // Case: Update available for app, but no new media zip provided.
            // We assume media hasn't changed and keep using the old one.
            // Update the version file so we don't check again for this app version.
            try {
                if (!fs.existsSync(mallMediaDir)) {
                    fs.mkdirSync(mallMediaDir, { recursive: true });
                }
                fs.writeFileSync(versionFilePath, appVersion, 'utf-8');
                logger.info('Existing media preserved. Updated version marker to skip future checks.');
            } catch (e) {
                logger.error('Failed to update version marker', { error: e.message });
            }
            
            if (patchWindow && !patchWindow.isDestroyed()) {
                patchWindow.webContents.send('update-status', {
                  state: 'media_downloading',
                  message: 'メディアは最新です。',
                });
            }
            return;
        } else {
            // Case: No local media AND download failed. This is critical.
             if (patchWindow && !patchWindow.isDestroyed()) {
                patchWindow.webContents.send('update-status', {
                  state: 'error',
                  message: 'メディアデータの取得に失敗しました。',
                });
            }
            // Wait a bit to let user see error
            await new Promise(r => setTimeout(r, 3000));
            // We don't re-throw, allowing app to start (possibly with missing images)
        }
    } else {
        logger.error(`Failed to download/extract media: ${error.message}`);
        throw error;
    }
  }
}

module.exports = {
  ensureMediaFiles
};
