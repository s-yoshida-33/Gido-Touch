// build/zip-media.cjs
// メディアZIP生成スクリプト（Tauri版）
// Usage: node build/zip-media.cjs [mallId]
// media/{mallId}/ 内のファイルを release/media-{mallId}.zip に圧縮

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const MEDIA_ROOT = path.join(ROOT_DIR, 'media');
const RELEASE_DIR = path.join(ROOT_DIR, 'release');

/**
 * Recursively add files from a directory to a zip using PowerShell Compress-Archive
 * or tar (cross-platform fallback).
 */
function createZip(sourceDir, zipPath) {
  // Remove existing zip if present
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Use PowerShell Compress-Archive on Windows
    const psCmd = `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${zipPath}" -Force`;
    execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'inherit' });
  } else {
    // Use zip command on Linux/Mac
    execSync(`cd "${sourceDir}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
  }
}

function createMediaZips() {
  if (!fs.existsSync(MEDIA_ROOT)) {
    console.error(`Media root directory not found: ${MEDIA_ROOT}`);
    process.exit(1);
  }

  // Ensure release directory exists
  if (!fs.existsSync(RELEASE_DIR)) {
    fs.mkdirSync(RELEASE_DIR, { recursive: true });
  }

  // Check for command line arguments for specific mall ID
  const targetMallId = process.argv[2];

  const entries = fs.readdirSync(MEDIA_ROOT, { withFileTypes: true });

  // Filter for directories that are not hidden (don't start with .)
  let mallDirs = entries.filter(entry =>
    entry.isDirectory() && !entry.name.startsWith('.')
  );

  // If a specific mall ID is provided, filter for it
  if (targetMallId) {
    const found = mallDirs.find(d => d.name === targetMallId);
    if (!found) {
      console.error(`Error: Mall directory '${targetMallId}' not found in media folder.`);
      console.error(`Available: ${mallDirs.map(d => d.name).join(', ')}`);
      process.exit(1);
    }
    mallDirs = [found];
    console.log(`Targeting single mall: ${targetMallId}`);
  }

  if (mallDirs.length === 0) {
    console.log('No mall directories found in media folder.');
    return;
  }

  console.log(`\nProcessing ${mallDirs.length} mall director${mallDirs.length > 1 ? 'ies' : 'y'}...`);
  console.log(`Output: ${RELEASE_DIR}\n`);

  for (const mallDir of mallDirs) {
    const mallId = mallDir.name;
    const sourceDir = path.join(MEDIA_ROOT, mallId);
    const zipFileName = `media-${mallId}.zip`;
    const zipFilePath = path.join(RELEASE_DIR, zipFileName);

    // Count files
    const fileCount = countFiles(sourceDir);

    try {
      console.log(`Creating ${zipFileName} (${fileCount} files)...`);

      createZip(sourceDir, zipFilePath);

      const stats = fs.statSync(zipFilePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

      console.log(`  -> ${zipFileName} (${sizeMB} MB)`);
    } catch (error) {
      console.error(`  Failed: ${error.message}`);
    }
  }

  console.log('\nDone.');
}

function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += countFiles(path.join(dir, entry.name));
    } else if (!entry.name.startsWith('.')) {
      count++;
    }
  }
  return count;
}

createMediaZips();
