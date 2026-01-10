// electron/main.cjs
// Electron main process entry point (with startup patch window)

const { app, BrowserWindow, Menu, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { pathToFileURL } = require('url');
const AdmZip = require('adm-zip');
const {
  initAutoUpdater,
  checkForUpdates,
  oneClickUpdate,
  getLatestVersionInfo,
} = require('./updateChecker.cjs');
const logger = require('./logger.cjs');
const { ensureMediaFiles } = require('./mediaDownloader.cjs');

const isDev = !app.isPackaged;

let patchWindow = null;
let mainWindow = null;
let isSettingsOpen = false;

// DEBUG: Track internal state of loadSettings
let lastLoadSettingsDebug = {
  timestamp: null,
  rawPreview: null,
  parsedValue: null,
  parsedType: null,
  checkResult: null,
  finalValue: null,
  error: null
};

// Default location icon settings (single floor)
const DEFAULT_LOCATION_ICON_SETTINGS_SINGLE = {
  speechBubble: {
    enabled: true,
    xPercent: 50,
    yPercent: 40,
    size: 96,
    rotation: 0,
    shadow: {
      enabled: true,
      offsetX: 4,
      offsetY: 4,
      blur: 4,
      opacity: 0.5,
    },
    animation: {
      enabled: true,
      type: "floating",
      duration: 2.2,
      amplitude: 18,
    },
  },
  location: {
    enabled: true,
    xPercent: 50,
    yPercent: 50,
    size: 72,
    rotation: 0,
    shadow: {
      enabled: true,
      offsetX: 4,
      offsetY: 4,
      blur: 4,
      opacity: 0.5,
    },
  },
};

// Default location icon settings per floor
const DEFAULT_LOCATION_ICON_SETTINGS = {
  "1F": JSON.parse(JSON.stringify(DEFAULT_LOCATION_ICON_SETTINGS_SINGLE)),
  "2F": JSON.parse(JSON.stringify(DEFAULT_LOCATION_ICON_SETTINGS_SINGLE)),
  "3F": JSON.parse(JSON.stringify(DEFAULT_LOCATION_ICON_SETTINGS_SINGLE)),
  "4F": JSON.parse(JSON.stringify(DEFAULT_LOCATION_ICON_SETTINGS_SINGLE)),
};

// Default ShopList layout (columns and rows per column for each floor)
const DEFAULT_FLOOR_LAYOUT = {
  '1F': { columns: 3, rowsPerCol: 20 },
  '2F': { columns: 2, rowsPerCol: 19 },
  '3F': { columns: 3, rowsPerCol: 20 },
  '4F': { columns: 2, rowsPerCol: 18 },
};

// Prevent multiple instances from starting with a single-instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  // Using 'return' in top-level code isn't valid in CommonJS without a wrapper, 
  // but Electron handles process exit. 
  // However, to prevent further execution in this file:
  process.exit(0);
}

// On the second launch, it only brings existing windows to the front
app.on('second-instance', () => {
  const win = mainWindow || patchWindow || BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

// Determine base renderer URL (Vite dev server or built production files)
const rendererBaseUrl = isDev
  ? 'http://localhost:5173/'
  : `file://${path.join(__dirname, '../dist/index.html')}`;

/**
 * Settings utilities (for persistent configuration: floor + location icons)
 */
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

// Deep merge function to ensure all nested properties are preserved
const deepMerge = (target, source) => {
  if (!source) return target;
  
  const result = { ...target };
  
  Object.keys(source).forEach(key => {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else if (source[key] !== undefined) {
      result[key] = source[key];
    }
  });
  
  return result;
};

// モールごとのデフォルト設定ファイルを読み込む
// settings.jsonにmallIdが保存されている場合は、そのモールに対応するデフォルト設定ファイルを読み込む
// そうでなければ、標準のdefault-settings.jsonを読み込む
function loadDefaultSettings(mallId) {
  let defaultSettingsPath;
  
  if (mallId) {
    // try mall specific default first
    const mallSpecificPath = path.join(__dirname, `default-${mallId}-data.json`);
    if (fs.existsSync(mallSpecificPath)) {
        defaultSettingsPath = mallSpecificPath;
        logger.info(`Loading mall specific default settings: ${mallId}`);
    }
  }

  // Fallback to standard default-settings.json if mall specific not found or not specified
  if (!defaultSettingsPath) {
      defaultSettingsPath = path.join(__dirname, 'default-settings.json');
  }

  try {
    if (fs.existsSync(defaultSettingsPath)) {
       const raw = fs.readFileSync(defaultSettingsPath, 'utf-8');
       // Remove BOM if present
       if (raw.charCodeAt(0) === 0xFEFF) {
         return JSON.parse(raw.slice(1));
       }
       const parsed = JSON.parse(raw);
       logger.info(`Loaded default settings from ${path.basename(defaultSettingsPath)}`);
       return parsed;
    }
  } catch (error) {
     logger.warn('Failed to load default settings', { error: error?.message });
  }
  return {};
}

// 優先度高: ビルド時に注入される環境変数 MALL_ID があればそれをデフォルトとする
// そうでなければ、userSettings.mallId か、デフォルトの 'suzaka' を使用する
const BUILD_MALL_ID = process.env.MALL_ID;

function loadSettings() {
  // Base default structure
  let base = {
    floor: '1F',
    currentFloorSetting: '1F',
    displayFloors: ['1F', '2F', '3F', '4F'], // Default display floors
    mallId: BUILD_MALL_ID || 'suzaka', // Default mall ID (Build env var takes precedence for initial default)
    locationIcons: DEFAULT_LOCATION_ICON_SETTINGS,
    floorLayout: DEFAULT_FLOOR_LAYOUT,
    imageSettings: {
      floorMaps: {
        '1F': '',
        '2F': '',
        '3F': '',
        '4F': '',
      },
      openTimeImage: '',
    },
    videoSettings: {
      enabled: false,
      source: '', // File path or URL
      loop: true,
      autoplay: true,
    },
    audioSettings: {
      cmsMuted: true,
      localMediaMuted: false,
    },
    portRanges: {
      bridge: {
        min: 8090,
        max: 8099,
      },
      cms: {
        min: 8080,
        max: 8089,
      },
    },
    shopPositions: { positions: {} }, // Will be merged with default-shop-positions later
    localMediaTextSettings: {},
  };

  // 1. Load user settings to check if a mallId is already set
  let userSettings = {};
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      let raw = fs.readFileSync(settingsPath, 'utf-8');
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1);
      }
      userSettings = JSON.parse(raw);
    }
  } catch (error) {
    logger.error('Failed to pre-load settings for mallId check', { error: error?.message });
  }

  // 2. Load defaults based on mallId
  // Priority: 
  // 1. userSettings.mallId (if exists)
  // 2. BUILD_MALL_ID (if provided during build)
  // 3. base.mallId (fallback to 'suzaka')
  const currentMallId = userSettings.mallId || BUILD_MALL_ID || base.mallId;
  const loadedDefaults = loadDefaultSettings(currentMallId);

  // Update base with loaded defaults
  if (Object.keys(loadedDefaults).length > 0) {
    base = deepMerge(base, loadedDefaults);
  }

  // Also ensure base.mallId reflects the correct initial ID if it wasn't in userSettings
  if (!userSettings.mallId && BUILD_MALL_ID) {
    base.mallId = BUILD_MALL_ID;
  }

  // 3. Merge user settings over base (base now includes mall-specific defaults)
  const merged = deepMerge(base, userSettings);

  // Special handling for legacy locationIcons format
  if (merged.locationIcons) {
      const parsedLoc = merged.locationIcons;
      const mergedIcons = { ...base.locationIcons }; // Start with defaults
      
      const hasNewFormat = ['1F', '2F', '3F', '4F'].some(f => parsedLoc[f]);
      
      if (hasNewFormat) {
        ['1F', '2F', '3F', '4F'].forEach(floor => {
          if (parsedLoc[floor]) {
            mergedIcons[floor] = deepMerge(base.locationIcons[floor] || DEFAULT_LOCATION_ICON_SETTINGS_SINGLE, parsedLoc[floor]);
          }
        });
      } else if (parsedLoc.speechBubble) {
        // Old format migration
        const migratedSingle = deepMerge(DEFAULT_LOCATION_ICON_SETTINGS_SINGLE, parsedLoc);
        ['1F', '2F', '3F', '4F'].forEach(floor => {
          mergedIcons[floor] = migratedSingle;
        });
      }
      merged.locationIcons = mergedIcons;
  }

  return merged;
}

function saveSettings(partial) {
  const current = loadSettings();
  const next = {
    ...current,
    ...partial,
  };

  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(next, null, 2), 'utf-8');
    logger.info('Settings saved', {
      floor: next.floor,
      currentFloorSetting: next.currentFloorSetting,
      mallId: next.mallId,
      hasLocationIcons: !!next.locationIcons,
      locationIconFloors: next.locationIcons ? Object.keys(next.locationIcons) : [],
    });
  } catch (error) {
    logger.error('Failed to save settings', {
      error: error?.message,
    });
  }

  return next;
}

/**
 * Broadcast current floor setting changes to renderer processes
 */
function broadcastCurrentFloorSetting(setting) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('current-floor-setting-updated', setting);
  }
}

/**
 * Broadcast display floors changes to renderer processes
 */
function broadcastDisplayFloors(floors) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('display-floors-updated', floors);
  }
}

/**
 * Broadcast mall ID changes to renderer processes
 */
function broadcastMallId(mallId) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mall-id-updated', mallId);
  }
}

/**
 * Broadcast floor changes to renderer processes
 */
function broadcastFloor(floor) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:floor-changed', floor);
  }
}

/**
 * Broadcast floor layout changes to renderer processes
 */
function broadcastFloorLayout(floorLayout) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:floor-layout-changed', floorLayout);
  }
}

/**
 * Update floor layout (per floor) and notify renderer
 * partialLayout: { columns?: number; rowsPerCol?: number }
 */
function updateFloorLayout(floor, partialLayout) {
  const current = loadSettings();
  const prevLayout = current.floorLayout || DEFAULT_FLOOR_LAYOUT;
  const prevForFloor = prevLayout[floor] || DEFAULT_FLOOR_LAYOUT[floor] || {};

  const nextFloorLayout = {
    ...prevLayout,
    [floor]: {
      ...prevForFloor,
      ...partialLayout,
    },
  };

  const next = saveSettings({ floorLayout: nextFloorLayout });

  logger.info('Floor layout updated', {
    floor,
    columns: next.floorLayout[floor].columns,
    rowsPerCol: next.floorLayout[floor].rowsPerCol,
  });

  broadcastFloorLayout(next.floorLayout);
}

/**
 * Broadcast location icon settings changes to renderer processes
 */
function broadcastLocationIconSettings(locationIcons) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('location-icon-settings-updated', locationIcons);
  }
}

/**
 * Broadcast shop positions changes to renderer processes
 */
function broadcastShopPositions(shopPositions) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shop-positions-updated', shopPositions);
  }
}

/**
 * Broadcast local media text settings changes to renderer processes
 */
function broadcastLocalMediaTextSettings(settings) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('local-media-text-settings-updated', settings);
  }
}

/**
 * Broadcast audio settings changes to renderer processes
 */
function broadcastAudioSettings(settings) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('audio-settings-updated', settings);
  }
}

/**
 * Update floor setting and notify renderer
 */
function updateFloorSetting(floor) {
  const next = saveSettings({ floor });
  logger.info('Floor updated', { floor: next.floor });
  broadcastFloor(next.floor);
}

/**
 * Check if a port is available by attempting to connect to it.
 */
function isPortAvailable(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000; // 1 second timeout

    socket.setTimeout(timeout);
    
    socket.once('connect', () => {
      socket.destroy();
      resolve(true); // Port is open (service is running)
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false); // Port is not responding
    });

    socket.once('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        resolve(false); // Port is not open
      } else {
        resolve(false); // Other error, assume not available
      }
    });

    socket.connect(port, host);
  });
}

/**
 * Find an available port within the specified range by checking HTTP connectivity.
 * Returns the first port that responds to HTTP requests successfully.
 */
async function findAvailablePortInRange(minPort, maxPort, path = '/', host = 'localhost') {
  logger.debug('Starting port detection', { minPort, maxPort, path, host });
  
  for (let port = minPort; port <= maxPort; port++) {
    try {
      const url = `http://${host}:${port}${path}`;
      logger.debug('Trying port', { port, url });
      
      // Try a quick HTTP request to see if the service is available
      const available = await new Promise((resolve) => {
        const req = http.get(url, { timeout: 2000 }, (res) => {
          // Check if status code is in success range (200-299)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            req.destroy();
            logger.debug('Port responded successfully', { port, statusCode: res.statusCode });
            resolve(true); // Service is responding with success
          } else {
            req.destroy();
            logger.debug('Port responded with non-success status', { port, statusCode: res.statusCode });
            resolve(false); // Service is responding but with error status
          }
        });

        req.on('error', (err) => {
          logger.debug('Port connection error', { port, error: err.code });
          resolve(false); // Service is not responding
        });

        req.on('timeout', () => {
          req.destroy();
          logger.debug('Port connection timeout', { port });
          resolve(false);
        });

        req.setTimeout(2000);
      });

      if (available) {
        logger.info('Found available port in range', { port, minPort, maxPort, path, host });
        return port;
      }
    } catch (error) {
      logger.debug('Exception while checking port', { port, error: error?.message });
      // Continue to next port
    }
  }

  logger.warn('No available port found in range', { minPort, maxPort, path, host });
  return null;
}

/**
 * Get the base URL for BridgeWebPopper, using port range detection if configured.
 */
async function getBridgeBaseUrl() {
  const settings = loadSettings();
  const portRange = settings.portRanges?.bridge;

  if (portRange && portRange.min && portRange.max) {
    const port = await findAvailablePortInRange(portRange.min, portRange.max, '/api/shops', 'localhost');
    if (port) {
      return `http://localhost:${port}`;
    }
  }

  // Fallback to default
  return 'http://localhost:8090';
}

/**
 * Get the base URL for CMS (WSP), using port range detection if configured.
 */
async function getCmsBaseUrl() {
  const settings = loadSettings();
  const portRange = settings.portRanges?.cms;

  logger.debug('Getting CMS base URL', { portRange });

  if (portRange && portRange.min && portRange.max) {
    const port = await findAvailablePortInRange(portRange.min, portRange.max, '/current-timeline', 'localhost');
    if (port) {
      const baseUrl = `http://localhost:${port}`;
      logger.info('CMS base URL determined', { baseUrl, port, portRange });
      return baseUrl;
    } else {
      logger.warn('CMS port detection failed, using fallback', { portRange });
    }
  } else {
    logger.debug('CMS port range not configured, using fallback');
  }

  // Fallback to default (8080)
  const fallbackUrl = 'http://localhost:8080';
  logger.info('Using CMS fallback URL', { fallbackUrl });
  return fallbackUrl;
}

/**
 * Get the base URL for right-top video CMS, using port range detection if configured.
 * NOTE: Right-top video CMS is currently disabled - this function returns null.
 */
async function getRightTopVideoCmsBaseUrl() {
  logger.debug('Right-top video CMS is disabled - returning null');
  return null;
}

// Cache for base URLs to avoid repeated port detection
let cachedBridgeBaseUrl = null;
let cachedCmsBaseUrl = null;
let cachedRightTopVideoCmsBaseUrl = null;
let lastPortCheckTime = 0;
const PORT_CHECK_INTERVAL = 30000; // Check every 30 seconds

/**
 * Get cached or fresh Bridge base URL.
 */
async function getCachedBridgeBaseUrl() {
  const now = Date.now();
  if (!cachedBridgeBaseUrl || (now - lastPortCheckTime) > PORT_CHECK_INTERVAL) {
    cachedBridgeBaseUrl = await getBridgeBaseUrl();
    lastPortCheckTime = now;
  }
  return cachedBridgeBaseUrl;
}

/**
 * Get cached or fresh CMS base URL.
 */
async function getCachedCmsBaseUrl() {
  const now = Date.now();
  if (!cachedCmsBaseUrl || (now - lastPortCheckTime) > PORT_CHECK_INTERVAL) {
    cachedCmsBaseUrl = await getCmsBaseUrl();
    lastPortCheckTime = now;
  }
  return cachedCmsBaseUrl;
}

/**
 * Get cached or fresh right-top video CMS base URL.
 */
async function getCachedRightTopVideoCmsBaseUrl() {
  const now = Date.now();
  if (!cachedRightTopVideoCmsBaseUrl || (now - lastPortCheckTime) > PORT_CHECK_INTERVAL) {
    cachedRightTopVideoCmsBaseUrl = await getRightTopVideoCmsBaseUrl();
    lastPortCheckTime = now;
  }
  return cachedRightTopVideoCmsBaseUrl;
}

/**
 * Simple HTTP GET helper that retrieves JSON from a given URL.
 */
function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const timeout = 5000; // 5 seconds timeout
    const startTime = Date.now();

    const req = http.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        const error = new Error(`HTTP ${res.statusCode}`);
        logger.warn('HTTP request failed', {
          url,
          statusCode: res.statusCode,
          durationMs: Date.now() - startTime,
        });
        reject(error);
        res.resume();
        return;
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const duration = Date.now() - startTime;
          logger.debug('HTTP request succeeded', {
            url,
            durationMs: duration,
            dataSize: data.length,
          });
          resolve(json);
        } catch (err) {
          logger.error('Failed to parse JSON response', {
            url,
            error: err?.message,
            durationMs: Date.now() - startTime,
          });
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      logger.error('HTTP request error', {
        url,
        error: err?.message,
        durationMs: Date.now() - startTime,
      });
      reject(err);
    });

    // Set timeout
    req.setTimeout(timeout, () => {
      req.destroy();
      const error = new Error(`Request timeout after ${timeout}ms`);
      logger.error('HTTP request timeout', {
        url,
        timeout,
        durationMs: Date.now() - startTime,
      });
      reject(error);
    });

    req.end();
  });
}

/**
 * Convert a Windows file path to a file:// URL string.
 */
function toFileUrl(winPath) {
  try {
    return pathToFileURL(winPath).toString();
  } catch (error) {
    logger.warn('Failed to convert path to file URL, using fallback', {
      error: error?.message,
      winPath,
    });
    const normalized = winPath.replace(/\\/g, '/');
    return `file:///${normalized}`;
  }
}

/**
 * Create the small startup patch window.
 * This window appears first and shows update progress.
 */
function createPatchWindow() {
  if (patchWindow && !patchWindow.isDestroyed()) {
    logger.debug('Patch window already exists, focusing');
    patchWindow.focus();
    return;
  }

  logger.info('Creating patch window');

  patchWindow = new BrowserWindow({
    resizable: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Use #patch hash so renderer can show PatchScreen instead of app UI
  patchWindow.loadURL(`${rendererBaseUrl}#patch`);

  patchWindow.once('ready-to-show', () => {
    if (patchWindow) {
      logger.info('Patch window ready to show');
      patchWindow.show();
    }
  });

  patchWindow.on('closed', () => {
    logger.info('Patch window closed');
    patchWindow = null;
  });
}

/**
 * Create the main application window (fullscreen UI).
 */
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    logger.debug('Main window already exists, focusing');
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true, // Enable dev tools even in production for debugging
      webSecurity: false, // Allow loading local file:// resources for shop images
    },
  });

  // Set always on top with higher level priority (screen-saver is higher than normal)
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Force always-on-top re-application when focus is lost (e.g. TeamViewer tab interaction)
  mainWindow.on('blur', () => {
    // Delay slightly to allow OS window switching to complete
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // If settings are open, don't force top as it might interfere with dropdowns
        if (isSettingsOpen) {
          return;
        }
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
        // Optional: mainWindow.focus(); // Use with caution as it might block other interactions
      }
    }, 100);
  });

  // Watchdog to ensure window stays on top periodically
  // This handles cases where other apps might periodically steal focus or Z-order
  const focusWatchdog = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // If settings are open, don't force top/focus as it might interfere with dropdowns/inputs
      if (isSettingsOpen) {
        return;
      }

      // Ensure it's not minimized
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      // Re-apply always-on-top
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
      // Bring to front visually
      mainWindow.moveTop();
    } else {
      clearInterval(focusWatchdog);
    }
  }, 2000); // Check every 2 seconds

  // Enable F12 shortcut to toggle dev tools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
    // Enable Ctrl+R to reload window in development mode
    if (isDev && input.key === 'r' && input.control && !input.shift && !input.alt && !input.meta) {
      event.preventDefault();
      logger.info('Reloading window via Ctrl+R');
      mainWindow.reload();
    }
  });

  mainWindow.loadURL(rendererBaseUrl);

  // Send current floor setting after renderer has finished loading
  const settings = loadSettings();
  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Main window finished loading, broadcasting settings', {
      floor: settings.floor,
    });
    broadcastFloor(settings.floor);
    broadcastCurrentFloorSetting(settings.currentFloorSetting);
    broadcastDisplayFloors(settings.displayFloors);
    broadcastMallId(settings.mallId);
    broadcastLocationIconSettings(settings.locationIcons);
    broadcastFloorLayout(settings.floorLayout);
    broadcastLocalMediaTextSettings(settings.localMediaTextSettings);
    broadcastAudioSettings(settings.audioSettings);
  });

  mainWindow.on('closed', () => {
    logger.info('Main window closed');
    mainWindow = null;
  });
}

/**
 * Build application menu including floor setting and manual update entries.
 */
function createAppMenu() {
  const settings = loadSettings();

  logger.info('Creating application menu', {
    initialFloor: settings.floor,
  });

  const layout = settings.floorLayout || DEFAULT_FLOOR_LAYOUT;

  const template = [
    {
      label: 'ファイル',
      submenu: [
        {
          role: 'quit',
          label: '終了',
        },
      ],
    },
    {
      label: '設定',
      submenu: [
        {
          label: '設定画面を開く',
          click: () => {
            logger.info('Unified settings screen menu clicked');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-settings');
            }
          },
        },
        { type: 'separator' },
        {
          label: '開発者ツール',
          accelerator: 'F12',
          click: () => {
            logger.info('Developer tools toggled');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.toggleDevTools();
            }
          },
        },
        ...(isDev ? [
          {
            label: '再読み込み',
            accelerator: 'Ctrl+R',
            click: () => {
              logger.info('Reloading window via menu');
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.reload();
              }
            },
          },
        ] : []),
      ],
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'バージョン情報',
          click: () => {
            logger.info('Version info requested');
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('open-version-info');
            }
          },
        },
        { type: 'separator' },
        {
          label: '更新を確認（手動）',
          click: () => {
            logger.info('Manual update check requested');
            checkForUpdates(true); // manual check
          },
        },
        {
          label: '今すぐ更新（ワンクリック）',
          click: () => {
            logger.info('One-click update requested');
            oneClickUpdate(); // one-click automatic update
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * IPC handlers for settings and app info.
 */
ipcMain.handle('debug:get-settings-status', () => {
  const settingsPath = getSettingsPath();
  const exists = fs.existsSync(settingsPath);
  let content = null;
  let parsed = null;
  let error = null;

  if (exists) {
    try {
      let raw = fs.readFileSync(settingsPath, 'utf-8');
      // Remove BOM if present
      if (raw.charCodeAt(0) === 0xFEFF) {
        raw = raw.slice(1);
      }
      content = raw.substring(0, 200) + (raw.length > 200 ? '...' : '');
      parsed = JSON.parse(raw);
    } catch (e) {
      error = e.message;
    }
  }

  const loadedSettings = loadSettings();

  return {
    path: settingsPath,
    exists,
    contentPreview: content,
    jsonParseResult: parsed ? {
      currentFloorSetting: parsed.currentFloorSetting,
      typeOfFloor: typeof parsed.currentFloorSetting
    } : null,
    loadSettingsResult: {
      currentFloorSetting: loadedSettings.currentFloorSetting,
      typeOfFloor: typeof loadedSettings.currentFloorSetting
    },
    internalDebug: lastLoadSettingsDebug,
    error
  };
});

ipcMain.handle('settings:get-floor', () => {
  const settings = loadSettings();
  logger.debug('IPC settings:get-floor', { floor: settings.floor });
  return settings.floor;
});

ipcMain.handle('settings:get-floor-layout', () => {
  const settings = loadSettings();
  logger.debug('IPC settings:get-floor-layout');
  return settings.floorLayout || DEFAULT_FLOOR_LAYOUT;
});

ipcMain.handle('settings:save-floor-layout', (_event, floorLayout) => {
  logger.info('IPC settings:save-floor-layout');
  const settings = saveSettings({ floorLayout });
  broadcastFloorLayout(settings.floorLayout);
  return settings.floorLayout;
});

ipcMain.handle('get-app-version', () => {
  const version = app.getVersion();
  logger.debug('IPC get-app-version', { version });
  return version;
});

ipcMain.handle('get-latest-version-info', async () => {
  logger.debug('IPC get-latest-version-info');
  const info = await getLatestVersionInfo();
  return info;
});

ipcMain.handle('get-bridge-base-url', async () => {
  logger.debug('IPC get-bridge-base-url');
  const url = await getCachedBridgeBaseUrl();
  return url;
});

/**
 * IPC handlers for location icon settings.
 */
ipcMain.handle('get-location-icon-settings', () => {
  const settings = loadSettings();
  logger.debug('IPC get-location-icon-settings');
  return settings.locationIcons;
});

ipcMain.handle('save-location-icon-settings', (_event, locationIcons) => {
  logger.info('IPC save-location-icon-settings', {
    hasSpeechBubble: !!locationIcons?.speechBubble,
    hasLocation: !!locationIcons?.location,
  });
  const settings = saveSettings({ locationIcons });
  broadcastLocationIconSettings(settings.locationIcons);
  return settings.locationIcons;
});

ipcMain.handle('get-current-floor-setting', () => {
  const settings = loadSettings();
  logger.debug('IPC get-current-floor-setting', { setting: settings.currentFloorSetting });
  return settings.currentFloorSetting || '1F';
});

ipcMain.handle('save-current-floor-setting', (_event, currentFloorSetting) => {
  logger.info('IPC save-current-floor-setting', { currentFloorSetting });
  const settings = saveSettings({ currentFloorSetting });
  broadcastCurrentFloorSetting(settings.currentFloorSetting);
  return settings.currentFloorSetting;
});

ipcMain.handle('get-display-floors', () => {
  const settings = loadSettings();
  logger.debug('IPC get-display-floors', { floors: settings.displayFloors });
  return settings.displayFloors || ['1F', '2F', '3F', '4F'];
});

ipcMain.handle('save-display-floors', (_event, displayFloors) => {
  logger.info('IPC save-display-floors', { displayFloors });
  const settings = saveSettings({ displayFloors });
  broadcastDisplayFloors(settings.displayFloors);
  return settings.displayFloors;
});

// Mall ID IPC handlers
ipcMain.handle('get-mall-id', () => {
  const settings = loadSettings();
  logger.debug('IPC get-mall-id', { mallId: settings.mallId });
  return settings.mallId || BUILD_MALL_ID || 'suzaka';
});

ipcMain.handle('save-mall-id', (_event, mallId) => {
  logger.info('IPC save-mall-id', { mallId });
  const settings = saveSettings({ mallId });
  broadcastMallId(settings.mallId);
  return settings.mallId;
});

/**
 * Get images directory path (userData/images)
 */
function getImagesDirectory() {
  const imagesDir = path.join(app.getPath('userData'), 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  return imagesDir;
}

/**
 * Save SVG file from data URL to disk
 */
function saveSvgFile(dataUrl, filename) {
  try {
    // Extract base64 data from data URL
    const base64Data = dataUrl.replace(/^data:image\/svg\+xml;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = path.join(getImagesDirectory(), filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    logger.error('Failed to save SVG file', {
      error: error?.message,
      filename,
    });
    throw error;
  }
}

/**
 * Read SVG file and return as data URL
 */
function readSvgFileAsDataUrl(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    return `data:image/svg+xml;base64,${base64}`;
  } catch (error) {
    logger.error('Failed to read SVG file', {
      error: error?.message,
      filePath,
    });
    return null;
  }
}

/**
 * Read image file and return as data URL
 * Supports PNG, JPEG, GIF, WebP, SVG
 */
function readImageFileAsDataUrl(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString('base64');
    
    // Determine MIME type from file extension
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/png'; // default
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        mimeType = 'image/jpeg';
        break;
      case '.png':
        mimeType = 'image/png';
        break;
      case '.gif':
        mimeType = 'image/gif';
        break;
      case '.webp':
        mimeType = 'image/webp';
        break;
      case '.svg':
        mimeType = 'image/svg+xml';
        break;
    }
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    logger.error('Failed to read image file', {
      error: error?.message,
      filePath,
    });
    return null;
  }
}

/**
 * IPC handlers for image settings.
 */
ipcMain.handle('get-image-settings', () => {
  const settings = loadSettings();
  logger.debug('IPC get-image-settings');
  
  // Convert file paths to data URLs if they exist
  const imageSettings = settings.imageSettings || {
    floorMaps: { '1F': '', '2F': '', '3F': '', '4F': '' },
    openTimeImage: '',
  };
  
  const result = {
    floorMaps: {},
    openTimeImage: '',
  };
  
  // Convert floor map paths to data URLs
  for (const floor of ['1F', '2F', '3F', '4F']) {
    const filePath = imageSettings.floorMaps?.[floor];
    if (filePath && filePath.startsWith('file://')) {
      const localPath = filePath.replace('file://', '');
      const dataUrl = readSvgFileAsDataUrl(localPath);
      result.floorMaps[floor] = dataUrl || '';
    } else if (filePath && filePath.startsWith('data:')) {
      // Already a data URL
      result.floorMaps[floor] = filePath;
    } else {
      result.floorMaps[floor] = '';
    }
  }
  
  // Convert open time image path to data URL
  const openTimePath = imageSettings.openTimeImage;
  if (openTimePath && openTimePath.startsWith('file://')) {
    const localPath = openTimePath.replace('file://', '');
    const dataUrl = readSvgFileAsDataUrl(localPath);
    result.openTimeImage = dataUrl || '';
  } else if (openTimePath && openTimePath.startsWith('data:')) {
    result.openTimeImage = openTimePath;
  } else {
    result.openTimeImage = '';
  }
  
  return result;
});

ipcMain.handle('save-image-settings', async (_event, imageSettings) => {
  logger.info('IPC save-image-settings');
  
  try {
    const savedSettings = {
      floorMaps: {},
      openTimeImage: '',
    };
    
    // Save floor maps
    for (const floor of ['1F', '2F', '3F', '4F']) {
      const dataUrl = imageSettings.floorMaps?.[floor] || '';
      if (dataUrl && dataUrl.startsWith('data:')) {
        const filename = `floor-${floor}-map.svg`;
        const filePath = saveSvgFile(dataUrl, filename);
        savedSettings.floorMaps[floor] = `file://${filePath}`;
      } else if (dataUrl) {
        // Already a file path, keep it
        savedSettings.floorMaps[floor] = dataUrl;
      } else {
        savedSettings.floorMaps[floor] = '';
      }
    }
    
    // Save open time image
    const openTimeDataUrl = imageSettings.openTimeImage || '';
    if (openTimeDataUrl && openTimeDataUrl.startsWith('data:')) {
      const filename = 'open-time.svg';
      const filePath = saveSvgFile(openTimeDataUrl, filename);
      savedSettings.openTimeImage = `file://${filePath}`;
    } else if (openTimeDataUrl) {
      savedSettings.openTimeImage = openTimeDataUrl;
    } else {
      savedSettings.openTimeImage = '';
    }
    
    const settings = saveSettings({ imageSettings: savedSettings });
    // Broadcast to main window if it exists
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('image-settings-updated', settings.imageSettings);
    }
    
    return settings.imageSettings;
  } catch (error) {
    logger.error('Failed to save image settings', {
      error: error?.message,
    });
    throw error;
  }
});

ipcMain.handle('get-shop-positions', () => {
  logger.info('IPC get-shop-positions');
  const settings = loadSettings();
  return settings.shopPositions || { positions: {} };
});

ipcMain.handle('save-shop-positions', (_event, shopPositions) => {
  logger.info('IPC save-shop-positions');
  
  const settings = saveSettings({ shopPositions });
  
  // Broadcast to main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('shop-positions-updated', settings.shopPositions);
  }
  
  return settings.shopPositions;
});

ipcMain.handle('get-local-media-text-settings', () => {
  logger.info('IPC get-local-media-text-settings');
  const settings = loadSettings();
  return settings.localMediaTextSettings || {};
});

ipcMain.handle('save-local-media-text-settings', (_event, localMediaTextSettings) => {
  logger.info('IPC save-local-media-text-settings');
  const settings = saveSettings({ localMediaTextSettings });
  broadcastLocalMediaTextSettings(settings.localMediaTextSettings);
  return settings.localMediaTextSettings;
});

ipcMain.handle('get-audio-settings', () => {
  logger.info('IPC get-audio-settings');
  const settings = loadSettings();
  return settings.audioSettings || { cmsMuted: true, localMediaMuted: false };
});

ipcMain.handle('save-audio-settings', (_event, audioSettings) => {
  logger.info('IPC save-audio-settings');
  const settings = saveSettings({ audioSettings });
  broadcastAudioSettings(settings.audioSettings);
  return settings.audioSettings;
});

// IPC Handler for exporting current settings as default
ipcMain.handle('export-current-settings-as-default', async () => {
  if (!isDev) {
    logger.warn('Export settings allowed only in dev mode');
    return { success: false, error: 'Not in dev mode' };
  }

  try {
    const currentSettings = loadSettings();
    const mallId = currentSettings.mallId || 'suzaka';
    const targetFilename = `default-${mallId}-data.json`;
    const targetPath = path.join(__dirname, targetFilename);

    // Filter out internal state or runtime-only props if needed
    // For now, we save everything as default for that mall
    
    fs.writeFileSync(targetPath, JSON.stringify(currentSettings, null, 2), 'utf-8');
    
    logger.info(`Exported current settings to ${targetFilename}`, { mallId });
    
    return { success: true, path: targetPath };
  } catch (e) {
    logger.error('Failed to export settings', { error: e.message });
    return { success: false, error: e.message };
  }
});

/**
 * IPC handler for reading shop image files as data URLs
 */
ipcMain.handle('get-shop-image', async (_event, filePath) => {
  try {
    // Remove file:// prefix if present
    let localPath = filePath;
    if (filePath.startsWith('file://')) {
      localPath = filePath.replace('file://', '');
      // Handle Windows paths: file:///C:/... -> C:/...
      if (localPath.startsWith('/') && localPath.match(/^\/[A-Za-z]:/)) {
        localPath = localPath.substring(1);
      }
    }
    
    // Normalize path separators for Windows
    localPath = localPath.replace(/\//g, path.sep);
    
    const dataUrl = readImageFileAsDataUrl(localPath);
    return dataUrl;
  } catch (error) {
    logger.error('Failed to get shop image', {
      error: error?.message,
      filePath,
    });
    return null;
  }
});

/**
 * IPC handlers for independent video settings.
 */
ipcMain.handle('get-video-settings', () => {
  const settings = loadSettings();
  logger.debug('IPC get-video-settings');
  
  const videoSettings = settings.videoSettings || {
    enabled: false,
    source: '',
    loop: true,
    autoplay: true,
  };
  
  // Convert file path to file:// URL if it's a local path
  let source = videoSettings.source || '';
  if (source && !source.startsWith('file://') && !source.startsWith('http://') && !source.startsWith('https://')) {
    // It's a local file path, convert to file:// URL
    if (path.isAbsolute(source)) {
      source = toFileUrl(source);
    }
  }
  
  return {
    ...videoSettings,
    source,
  };
});

ipcMain.handle('save-video-settings', (_event, videoSettings) => {
  logger.info('IPC save-video-settings');
  
  const settings = saveSettings({ videoSettings });
  
  // Broadcast to main window if it exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('video-settings-updated', settings.videoSettings);
  }
  
  return settings.videoSettings;
});

/**
 * IPC handler for WSP current asset.
 * Uses /current-timeline, extracts the first media asset,
 * and returns a simplified object for the renderer.
 */
ipcMain.handle('wsp:get-current-asset', async () => {
  try {
    const baseUrl = await getCachedCmsBaseUrl();
    const url = `${baseUrl}/current-timeline`;
    logger.debug('wsp:get-current-asset: requesting', { url, baseUrl });
    const json = await httpGetJson(url);

    if (!json || !json.current_timeline) {
      logger.warn('wsp:get-current-asset: current_timeline is missing', {
        hasJson: !!json,
        jsonKeys: json ? Object.keys(json) : [],
      });
      return null;
    }

    const tl = json.current_timeline;
    // Check both current_timeline.media_assets and current_timeline.data.media_assets
    let assets = [];
    if (tl.media_assets && Array.isArray(tl.media_assets)) {
      assets = tl.media_assets;
    } else if (tl.data && tl.data.media_assets && Array.isArray(tl.data.media_assets)) {
      assets = tl.data.media_assets;
    }
    
    logger.debug('wsp:get-current-timeline response structure', {
      hasCurrentTimeline: !!tl,
      timelineKeys: tl ? Object.keys(tl) : [],
      hasData: !!(tl && tl.data),
      dataKeys: tl && tl.data ? Object.keys(tl.data) : [],
      mediaAssetsCount: assets.length,
      mediaAssetsLocation: tl.media_assets ? 'timeline.media_assets' : (tl.data && tl.data.media_assets ? 'timeline.data.media_assets' : 'not found'),
    });
    
    if (assets.length === 0) {
      logger.warn('wsp:get-current-asset: media_assets is empty', {
        assetsLength: assets.length,
        timelineStructure: {
          hasMediaAssets: 'media_assets' in tl,
          hasData: !!(tl && tl.data),
          hasDataMediaAssets: !!(tl && tl.data && 'media_assets' in tl.data),
          timelineKeys: Object.keys(tl),
          dataKeys: tl && tl.data ? Object.keys(tl.data) : [],
        },
      });
      return null;
    }

    const asset = assets[0];

    // Determine media type from asset properties or URL extension
    const mediaType = asset.mediaType || asset.type || '';
    // Use url if available, otherwise use localPath
    const assetUrl = asset.url || asset.localPath || '';
    const urlLower = assetUrl.toLowerCase();
    
    // Infer media type from URL extension if not provided
    let inferredMediaType = mediaType;
    if (!inferredMediaType) {
      if (urlLower.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/)) {
        inferredMediaType = 'video';
      } else if (urlLower.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
        inferredMediaType = 'image';
      }
    }

    // Use url if available, otherwise use localPath
    const assetPath = asset.url || asset.localPath || '';
    
    logger.info('wsp:get-current-asset: returning first asset', {
      assetId: asset.id,
      url: assetPath,
      mediaType: inferredMediaType,
    });

    return {
      id: asset.id,
      src: toFileUrl(assetPath),
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
      name:
        (Array.isArray(tl.media_names) && tl.media_names.length > 0)
          ? tl.media_names[0]
          : (tl.data && Array.isArray(tl.data.media_names) && tl.data.media_names.length > 0)
          ? tl.data.media_names[0]
          : '',
      startTime: tl.start_time || (tl.data && tl.data.start_time) || '',
      endTime: tl.end_time || (tl.data && tl.data.end_time) || '',
      mediaType: inferredMediaType,
      type: asset.type,
    };
  } catch (error) {
    logger.error('wsp:get-current-asset failed', {
      error: error?.message,
      stack: error?.stack,
      baseUrl: await getCachedCmsBaseUrl().catch(() => 'unknown'),
    });
    return null;
  }
});

/**
 * IPC handler for right-top video CMS current asset.
 * NOTE: Right-top video CMS is currently disabled - this handler returns null.
 * Uses /current-timeline from right-top video CMS (port 8100-8109),
 * extracts the first media asset, and returns a simplified object for the renderer.
 */
ipcMain.handle('wsp:get-right-top-video-asset', async () => {
  logger.debug('wsp:get-right-top-video-asset: right-top video CMS is disabled');
  return null;
});

/**
 * Get media directory path.
 * In production: uses resources/media (read-only, bundled with app)
 * In development: tries project root/media first, falls back to userData/media
 */
function getMediaDirectory() {
  // Always use userData media directory for consistent external media management
  const userDataMediaDir = path.join(app.getPath('userData'), 'media');
  if (!fs.existsSync(userDataMediaDir)) {
      fs.mkdirSync(userDataMediaDir, { recursive: true });
  }

  // However, for development convenience, if userData is empty but project root has it, we could use that.
  // But to keep it simple and consistent with the new "download" architecture, we default to userData.
  // If we really need dev fallback:
  if (!app.isPackaged) {
    const projectMediaDir = path.join(__dirname, '../media');
    if (fs.existsSync(projectMediaDir)) {
        logger.debug('Using project root media directory for development', {
            path: projectMediaDir,
        });
        return projectMediaDir;
    }
  }

  return userDataMediaDir;
}

/**
 * Check if a file is a supported media type
 */
function isMediaFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mediaExtensions = ['.mp4', '.jpg', '.jpeg', '.png', '.svg', '.webp'];
  return mediaExtensions.includes(ext);
}

/**
 * Extract zip file and return list of media files
 */
function extractZipFile(zipPath, extractDir) {
  try {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    const mediaFiles = [];

    // Extract all entries
    zip.extractAllTo(extractDir, true);

    // Find media files in extracted directory
    function findMediaFiles(dir) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          findMediaFiles(fullPath);
        } else if (isMediaFile(fullPath)) {
          mediaFiles.push(fullPath);
        }
      }
    }

    findMediaFiles(extractDir);
    return mediaFiles;
  } catch (error) {
    logger.error('Failed to extract zip file', {
      zipPath,
      error: error?.message,
    });
    return [];
  }
}

/**
 * Scan directory for media files and zip files
 */
function scanMediaDirectory(mediaDir) {
  const mediaFiles = [];
  
  if (!fs.existsSync(mediaDir)) {
    logger.debug('Media directory does not exist', { mediaDir });
    return mediaFiles;
  }

  try {
    const files = fs.readdirSync(mediaDir);
    
    for (const file of files) {
      const fullPath = path.join(mediaDir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip assets directory to avoid showing UI assets as media content
        if (file === 'assets') {
          continue;
        }
        // Recursively scan subdirectories
        const subFiles = scanMediaDirectory(fullPath);
        mediaFiles.push(...subFiles);
      } else if (isMediaFile(fullPath)) {
        // Direct media file
        mediaFiles.push(fullPath);
      } else if (path.extname(file).toLowerCase() === '.zip') {
        // Zip file - extract and find media files
        const extractDir = path.join(mediaDir, path.basename(file, '.zip'));
        // Create extract directory if it doesn't exist
        if (!fs.existsSync(extractDir)) {
          fs.mkdirSync(extractDir, { recursive: true });
        }
        const extractedFiles = extractZipFile(fullPath, extractDir);
        mediaFiles.push(...extractedFiles);
      }
    }
    
    // Sort files by name for consistent ordering
    mediaFiles.sort();
    
    return mediaFiles;
  } catch (error) {
    logger.error('Failed to scan media directory', {
      mediaDir,
      error: error?.message,
    });
    return [];
  }
}

/**
 * IPC handler: get media files from local directory
 * Returns array of file:// URLs for media files found in the media directory
 */
ipcMain.handle('get-local-media-files', async () => {
  try {
    const settings = loadSettings();
    const mallId = settings.mallId || 'suzaka';
    const mediaDir = getMediaDirectory();
    
    // Attempt to use mall-specific directory
    const mallMediaDir = path.join(mediaDir, mallId);
    let targetDir = mediaDir;
    
    // In production, we expect the mall specific directory to exist.
    // In dev, we try mall specific first, then fallback to root if missing (for legacy/convenience).
    if (fs.existsSync(mallMediaDir)) {
      targetDir = mallMediaDir;
      logger.debug('Using mall specific media directory', { mallId, targetDir });
    } else {
      logger.warn('Mall specific media directory not found, falling back to root media directory', { 
        mallId, 
        mallMediaDir,
        fallback: mediaDir
      });
      // Fallback to root mediaDir
    }

    logger.debug('Scanning media directory', { targetDir });
    
    const mediaFiles = scanMediaDirectory(targetDir);
    
    // Convert to file:// URLs
    const mediaUrls = mediaFiles.map(filePath => toFileUrl(filePath));
    
    logger.info('Found media files', {
      count: mediaUrls.length,
      targetDir,
      mallId,
    });
    
    return mediaUrls;
  } catch (error) {
    logger.error('Failed to get local media files', {
      error: error?.message,
    });
    return [];
  }
});

/**
 * Scan directory for asset files and return a map of relative paths to file URLs
 */
function scanAssetDirectory(assetsDir) {
  const assets = {};
  
  if (!fs.existsSync(assetsDir)) {
    logger.debug('Assets directory does not exist', { assetsDir });
    return assets;
  }

  try {
    function scan(dir, relativePath = '') {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        const currentRelativePath = relativePath ? path.join(relativePath, file) : file;
        
        if (stat.isDirectory()) {
          scan(fullPath, currentRelativePath);
        } else if (isMediaFile(fullPath)) {
          // Store with forward slashes for consistency
          const key = currentRelativePath.replace(/\\/g, '/');
          assets[key] = toFileUrl(fullPath);
        }
      }
    }
    
    scan(assetsDir);
    return assets;
  } catch (error) {
    logger.error('Failed to scan asset directory', {
      assetsDir,
      error: error?.message,
    });
    return {};
  }
}

/**
 * IPC handler: get mall assets from local directory
 * Returns map of relative paths (e.g. "button/1F.svg") to file URLs
 */
ipcMain.handle('get-mall-assets', async (_event, mallId) => {
  try {
    const mediaDir = getMediaDirectory();
    // Assets are located in {mediaDir}/{mallId}/assets
    const mallAssetsDir = path.join(mediaDir, mallId, 'assets');
    
    logger.debug('Scanning mall assets directory', { mallAssetsDir });
    
    const assets = scanAssetDirectory(mallAssetsDir);
    
    logger.info('Found mall assets', {
      count: Object.keys(assets).length,
      mallAssetsDir,
      mallId,
    });
    
    return assets;
  } catch (error) {
    logger.error('Failed to get mall assets', {
      error: error?.message,
      mallId
    });
    return {};
  }
});

/**
 * IPC handler: return raw /current-timeline JSON.
 */
ipcMain.handle('wsp:get-current-timeline', async () => {
  try {
    const baseUrl = await getCachedCmsBaseUrl();
    const url = `${baseUrl}/current-timeline`;
    logger.debug('wsp:get-current-timeline: requesting', { url, baseUrl });
    const json = await httpGetJson(url);
    logger.debug('wsp:get-current-timeline: success', { 
      hasData: !!json,
      hasCurrentTimeline: !!(json && json.current_timeline),
    });
    return json || null;
  } catch (error) {
    const baseUrl = await getCachedCmsBaseUrl().catch(() => 'unknown');
    logger.error('wsp:get-current-timeline failed', {
      error: error?.message,
      stack: error?.stack,
      baseUrl,
      attemptedUrl: `${baseUrl}/current-timeline`,
    });
    return null;
  }
});

/**
 * IPC handler: return CMS base URL.
 */
ipcMain.handle('wsp:get-cms-base-url', async () => {
  return await getCachedCmsBaseUrl();
});

/**
 * IPC handler: return raw /timeline or /timeline?hour=... JSON.
 */
ipcMain.handle('wsp:get-timeline', async (_event, options) => {
  try {
    const hour =
      options && typeof options.hour === 'number' && !Number.isNaN(options.hour)
        ? options.hour
        : undefined;

    const cmsBaseUrl = await getCachedCmsBaseUrl();
    const baseUrl = `${cmsBaseUrl}/timeline`;
    const url = hour != null ? `${baseUrl}?hour=${hour}` : baseUrl;

    const json = await httpGetJson(url);
    logger.debug('wsp:get-timeline: success', { hour });
    return json || null;
  } catch (error) {
    logger.error('wsp:get-timeline failed', {
      error: error?.message,
    });
    return null;
  }
});

/**
 * IPC handler to receive logs from renderer process.
 * The preload exposes window.logger which sends log-message IPC.
 */
ipcMain.on('log-message', (_event, payload) => {
  try {
    logger.logFromRenderer(payload || {});
  } catch (error) {
    logger.error('Failed to handle log-message IPC', {
      error: error?.message,
    });
  }
});

// Floor change from renderer
ipcMain.on('menu:set-floor', (_event, floorId) => {
  updateFloorSetting(floorId);
});

// Settings visibility from renderer
ipcMain.on('settings:set-visibility', (_event, visible) => {
  isSettingsOpen = visible;
  logger.debug('Settings visibility changed', { visible });
});

// Startup wait completed
ipcMain.on('startup-wait-completed', () => {
  logger.info('Startup wait completed, switching to main window');
  if (patchWindow && !patchWindow.isDestroyed()) {
    patchWindow.close();
  }
  createMainWindow();
});

// Renderer ready for updates
ipcMain.on('check-for-updates-ready', async () => {
  logger.info('Renderer is ready for updates');

  // 1. Check/Download media files first
  try {
      const settings = loadSettings();
      const mallId = settings.mallId || BUILD_MALL_ID || 'suzaka';
      
      // In dev mode, we might skip download if local media exists
      // But for testing the flow, we let it run or rely on ensureMediaFiles internal check
      await ensureMediaFiles(mallId, patchWindow);
  } catch (err) {
      logger.error('Failed during media check', { error: err.message });
      // Proceed to updates even if media failed? 
      // Ideally yes, maybe it's a code fix for the download issue.
  }

  // 2. Then check for app updates
  // Only check for updates if not in dev mode (or force check)
  if (!isDev) {
    checkForUpdates(false);
  } else {
    // In dev mode, if we simulate the wait screen, we should tell it to finish
    // But currently dev mode skips patch window entirely in main()
  }
});

// Manual update check
ipcMain.on('menu:check-updates', () => {
  checkForUpdates(true);
});

// One-click update
ipcMain.on('menu:one-click-update', () => {
  oneClickUpdate();
});

// Quit app
ipcMain.on('menu:quit', () => {
  app.quit();
});

/**
 * Global error handlers for main process.
 */
process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught exception in main process', {
    error: error?.message,
    stack: error?.stack,
  });
});

process.on('unhandledRejection', (reason) => {
  logger.fatal('Unhandled promise rejection in main process', {
    reason: String(reason),
  });
});

/**
 * App ready event.
 */
app.whenReady().then(() => {
  logger.configureLogger();
  logger.info('Application starting', {
    env: process.env.NODE_ENV || 'production',
    isDev,
  });

  createAppMenu();

  // Initialize autoUpdater with patch + main window references
  initAutoUpdater({
    getPatchWindow: () => patchWindow,
    createMainWindow,
  });

  // Startup update check (silent, handled inside updateChecker)
  // Skip update check in development mode
  if (!isDev) {
    createPatchWindow();
    // checkForUpdates(false); // Removed auto-check, waiting for renderer signal
  } else {
    logger.info('Skipping update check in development mode');
    // In dev mode, open main window immediately without patch window
    createMainWindow();
  }

  app.on('activate', () => {
    if (process.platform !== 'darwin') return;

    // macOS: recreate main window if no windows are open
    if (BrowserWindow.getAllWindows().length === 0) {
      logger.info('App activated on macOS with no windows, creating main window');
      createMainWindow();
    }
  });
});

/**
 * Quit when all windows are closed.
 * Except macOS where apps usually stay active.
 */
app.on('window-all-closed', () => {
  logger.info('All windows closed', { platform: process.platform });
  if (process.platform !== 'darwin') app.quit();
});
