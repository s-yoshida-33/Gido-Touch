// electron/zip-media.cjs
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const MEDIA_ROOT = path.join(__dirname, '../media');

/**
 * Creates a zip file for each mall directory in the media folder.
 * The zip file will be named media-{mallId}.zip and placed in the media folder.
 */
function createMediaZips() {
  if (!fs.existsSync(MEDIA_ROOT)) {
    console.error(`Media root directory not found: ${MEDIA_ROOT}`);
    process.exit(1);
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
      process.exit(1);
    }
    mallDirs = [found];
    console.log(`Targeting single mall: ${targetMallId}`);
  }

  if (mallDirs.length === 0) {
    console.log('No mall directories found in media folder.');
    return;
  }

  console.log(`Processing ${mallDirs.length} mall directories. Starting compression...`);

  for (const mallDir of mallDirs) {
    const mallId = mallDir.name;
    const sourceDir = path.join(MEDIA_ROOT, mallId);
    const zipFileName = `media-${mallId}.zip`;
    const zipFilePath = path.join(MEDIA_ROOT, zipFileName);

    try {
      console.log(`Creating ${zipFileName}...`);
      
      const zip = new AdmZip();
      
      // Add local folder contents to the zip root
      zip.addLocalFolder(sourceDir);
      
      // Write zip file
      zip.writeZip(zipFilePath);
      
      console.log(`✅ Successfully created: ${zipFileName}`);
    } catch (error) {
      console.error(`❌ Failed to create zip for ${mallId}:`, error.message);
    }
  }
  
  console.log('\nAll operations completed.');
}

createMediaZips();
