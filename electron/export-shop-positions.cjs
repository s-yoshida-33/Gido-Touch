// electron/export-shop-positions.cjs
// Devモードで設定した店舗位置を default-shop-positions.json にエクスポートするスクリプト

const fs = require('fs');
const path = require('path');
const os = require('os');

function getSettingsPath() {
  // ElectronのuserDataパスを取得（app.getPathを使わずに直接計算）
  const platform = process.platform;
  let userDataPath;
  
  if (platform === 'win32') {
    userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'gido-touch');
  } else if (platform === 'darwin') {
    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', 'gido-touch');
  } else {
    userDataPath = path.join(os.homedir(), '.config', 'gido-touch');
  }
  
  return path.join(userDataPath, 'settings.json');
}

function exportShopPositions() {
  try {
    // 設定ファイルのパスを取得
    const settingsPath = getSettingsPath();
    const defaultShopPositionsPath = path.join(__dirname, 'default-shop-positions.json');
    
    if (!fs.existsSync(settingsPath)) {
      console.log('設定ファイルが見つかりません:', settingsPath);
      console.log('設定ファイルの場所を確認してください。');
      return;
    }
    
    // 設定ファイルを読み込む
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    
    // shopPositionsを抽出
    const shopPositions = parsed.shopPositions || { positions: {} };
    
    // default-shop-positions.jsonに書き込む
    fs.writeFileSync(
      defaultShopPositionsPath,
      JSON.stringify(shopPositions, null, 2),
      'utf-8'
    );
    
    console.log('店舗位置設定をエクスポートしました:', defaultShopPositionsPath);
    console.log('設定された店舗数:', Object.keys(shopPositions.positions || {}).length);
  } catch (error) {
    console.error('エクスポートに失敗しました:', error);
    process.exit(1);
  }
}

exportShopPositions();

