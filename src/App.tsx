// src/App.tsx
import React, { useEffect, useState, useRef } from "react";
import ShopListScreen from "./screens/ShopListScreen";
import VersionInfoScreen from "./screens/VersionInfoScreen";
import UnifiedSettingsScreen from "./screens/UnifiedSettingsScreen";
import {
  DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR,
} from "./config";
import type { LocationIconSettingsPerFloor } from "./types/locationIcon";
import type { ImageSettings } from "./types/imageSettings";
import { DEFAULT_IMAGE_SETTINGS } from "./types/imageSettings";
import type { ShopPositionSettings } from "./types/shopPosition";
import type { Shop } from "./types/shop";
import { fetchShops, loadShopsFromCache, saveShopsToCache } from "./repositories/shopRepository";
import { logInfo, logError } from "./logs/logging";
import { shopSseService } from "./services/SSEService";
import type { SseConnectionStatus } from "./services/SSEService";
import { convertSseShopDataToShop } from "./utils/shopConverter";
import type { LocalMediaTextSettings, SubFloorSettings } from "./types/global";
import type { GenreSettings } from "./types/genreSettings";
import {
  loadGlobalSettings,
  loadMallSettings,
  saveGlobalSettings,
  saveMallSettings as saveMallSettingsToFile,
  ensureMallSettingsFile,
  migrateFromLegacyIfNeeded,
  saveImageFile,
} from "./utils/settings";
import type { MallSettingsFile } from "./utils/settings";
import { DEFAULT_CATEGORY_MAPPINGS, DEFAULT_IGNORED_GENRE_KEYWORDS } from "./utils/genreUtils";
import { getVersion } from "@tauri-apps/api/app";

type FloorId = "1F" | "2F" | "3F" | "4F";

type ColumnPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
  perColumnPadding?: ColumnPadding[];
};

type FloorLayout = Record<string, FloorLayoutPerFloor>;

const DEFAULT_FLOOR_LAYOUT: FloorLayout = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

/**
 * Check if an image path is a user-saved custom path (absolute file path or data URL).
 * Vite-bundled asset URLs are NOT considered custom.
 */
const isCustomImagePath = (path: string): boolean => {
  if (!path) return false;
  if (path.startsWith("data:")) return true;
  if (/^[A-Za-z]:[/\\]/.test(path)) return true;
  if (path.startsWith("\\\\")) return true;
  if (path.startsWith("/") && !path.startsWith("/assets/")) return true;
  return false;
};

// Error boundary for React render failures
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logError("RENDERER_ERROR", "React ErrorBoundary caught an error", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: "white", background: "#333", height: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h1 style={{ fontSize: "2em", marginBottom: "1em" }}>System Error</h1>
          <p>予期せぬエラーが発生しました。自動的に復旧しない場合は再起動してください。</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [locationSettings, setLocationSettings] = useState<LocationIconSettingsPerFloor>(
    DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR
  );

  const [localGenreSettings, setLocalGenreSettings] = useState<GenreSettings>({
    ignoredKeywords: DEFAULT_IGNORED_GENRE_KEYWORDS,
    maxItems: 3,
    categoryMapping: DEFAULT_CATEGORY_MAPPINGS,
  });

  // DEBUG STATE
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const addDebug = (msg: string) => setDebugLog(prev => [...prev.slice(-19), msg]);

  // Debug Window Drag & Resize State
  const [debugPos, setDebugPos] = useState({ x: 20, y: 20 });
  const [debugSize, setDebugSize] = useState({ w: 600, h: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");

  // Mall ID state
  const [mallId, setMallId] = useState<string>("suzaka");

  // API Status State
  const [sseStatus, setSseStatus] = useState<SseConnectionStatus>('disconnected');

  // Floor and floor layout state
  const [floor, setFloor] = useState<FloorId>("1F");
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(DEFAULT_FLOOR_LAYOUT);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [shopPositions, setShopPositions] = useState<ShopPositionSettings>({ positions: {} });
  const [shops, setShops] = useState<Shop[]>([]);
  const [localMediaTextSettings, setLocalMediaTextSettings] = useState<LocalMediaTextSettings>({});
  const [subFloorSettings, setSubFloorSettings] = useState<SubFloorSettings>({ "1F-1": [], "1F-2": [] });

  // Current floor setting
  const [currentFloorSetting, setCurrentFloorSetting] = useState<string>("1F");
  const [displayFloors, setDisplayFloors] = useState<string[]>(['1F', '2F', '3F', '4F']);

  // CMS settings state
  const [cmsEnabled, setCmsEnabled] = useState<boolean>(true);

  // SSE Status Subscription
  useEffect(() => {
    try {
      setSseStatus(shopSseService.status);
    } catch (e) {
      console.error("Failed to get sseService status", e);
    }

    const unsubscribeStatus = shopSseService.on('status_change', (data: { status: SseConnectionStatus }) => {
      setSseStatus(data.status);
      addDebug(`SSE Status: ${data.status}`);
    });

    return () => {
      unsubscribeStatus();
    };
  }, []);

  // Drag, Resize, Shortcut Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setDebugPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
      } else if (isResizing) {
        setDebugSize({ w: Math.max(300, e.clientX - debugPos.x), h: Math.max(200, e.clientY - debugPos.y) });
      }
    };
    const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        setIsDebugVisible(prev => !prev);
      }
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDragging, isResizing, dragOffset, debugPos]);

  const handleDebugMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - debugPos.x, y: e.clientY - debugPos.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  // Helper to process/filter shops
  const processShops = (rawShops: Shop[]): Shop[] => {
    const filtered = rawShops.filter((shop) => shop.genre === "飲食店・食品" || shop.genre === "グルメ");
    const excluded = filtered.filter((shop) => {
      const name = shop.name || "";
      return !name.includes("イオン堺北花田店") && name !== "イオンスタイル仙台上杉";
    });
    return excluded.map((s) => ({
      ...s,
      name: (s.name || "").replace(/【.*?】/g, "").trim(),
    }));
  };

  // Load Data Strategy (Cache-First + Background Update)
  const loadData = async (useCache: boolean = true) => {
    if (useCache) {
      const cached = loadShopsFromCache();
      if (cached && cached.length > 0) {
        const processed = processShops(cached);
        setShops(processed);
        addDebug(`App: Loaded ${processed.length} shops from cache`);
      }
    }

    try {
      const data = await fetchShops({ forceReload: true });
      if (data.length === 0) {
        const cached = loadShopsFromCache();
        if (cached && cached.length > 0) {
          console.warn("API returned empty shops, but cache exists. Keeping cache.");
          addDebug("App: API shops empty, keeping cache");
          return;
        }
      }
      const processed = processShops(data);
      setShops(processed);
      saveShopsToCache(processed);
      addDebug(`App: Shops synced from API (${processed.length} items)`);
    } catch (e: any) {
      console.error("Failed to load shops:", e);
      logError("SYS_INIT", "Failed to load shops", { error: e instanceof Error ? e.message : String(e) });
      addDebug(`App: Failed to load shops: ${e.message}`);
      const cached = loadShopsFromCache();
      if (cached && cached.length > 0 && shops.length === 0) {
        const processed = processShops(cached);
        setShops(processed);
        addDebug(`App: Loaded ${processed.length} shops from cache (fallback after error)`);
      }
    }
  };

  // Initial load and SSE subscription
  useEffect(() => {
    loadData(true);

    // Subscribe to SSE shops update
    const unsubscribeShops = shopSseService.on('shops', (payload: any) => {
      addDebug("App: Received SSE 'shops' event");
      let shopList: any[] = [];

      if (payload && !Array.isArray(payload) && 'data' in payload && Array.isArray(payload.data)) {
        shopList = payload.data;
      } else if (Array.isArray(payload)) {
        shopList = payload;
      } else if (payload && typeof payload === 'object' && 'items' in payload && Array.isArray(payload.items)) {
        shopList = payload.items;
      }

      if (shopList.length > 0) {
        try {
          const newShops: Shop[] = shopList.map((item: any) => convertSseShopDataToShop(item));
          const processed = processShops(newShops);
          setShops(processed);
          saveShopsToCache(processed);
          addDebug(`App: Shops updated via SSE (${processed.length} items)`);
        } catch (e: any) {
          console.error("Failed to process shops event", e);
          logError("SYS_INIT", "Failed to process shops event", { error: e instanceof Error ? e.message : String(e) });
        }
      }
    });

    const unsubscribeUpdate = shopSseService.on('update', () => {
      addDebug("App: Received 'update' event, reloading...");
      loadData(false);
    });

    return () => {
      unsubscribeShops();
      unsubscribeUpdate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load initial settings from Tauri (per-mall file architecture)
  const initCalled = useRef(false);

  useEffect(() => {
    if (initCalled.current) return;
    initCalled.current = true;

    const init = async () => {
      addDebug("App: Initializing...");

      // 1. App Version
      try {
        const v = await getVersion();
        setAppVersion(v);
        addDebug(`App Version: ${v}`);

        logInfo("SYS_INIT", "Application GidoTouch Started", {
          appVersion: v,
          mallId: mallId || "unknown",
          windowSize: `${window.innerWidth}x${window.innerHeight}`,
          userAgent: navigator.userAgent,
          isDev: import.meta.env.DEV,
        });
      } catch (e) {
        addDebug(`Failed to load App Version: ${e}`);
        logError("SYS_INIT", "Failed to load App Version", { error: e });
      }

      // 2. Migrate legacy settings if needed
      try {
        const migrated = await migrateFromLegacyIfNeeded();
        if (migrated) {
          addDebug("Migrated legacy settings to per-mall format");
        }
      } catch (e) {
        addDebug(`Migration check failed: ${e}`);
      }

      // 3. Load global settings (mallId, floor, setupCompleted)
      try {
        const global = await loadGlobalSettings();
        const currentMallId = global.mallId ?? "suzaka";
        setMallId(currentMallId);
        setFloor(global.floor as FloorId);
        addDebug(`Global: mallId=${currentMallId}, floor=${global.floor}`);

        // 4. Ensure per-mall settings file, then load
        await ensureMallSettingsFile(currentMallId);
        const mallData = await loadMallSettings(currentMallId);

        setLocationSettings(mallData.locationIcons);
        setImageSettings(mallData.imageSettings);
        setShopPositions(mallData.shopPositions);
        setLocalGenreSettings(mallData.genreSettings);
        setCmsEnabled(mallData.cmsSettings?.enabled ?? true);
        setCurrentFloorSetting(mallData.currentFloorSetting || "1F");
        setDisplayFloors(mallData.displayFloors || ['1F', '2F', '3F', '4F']);
        setLocalMediaTextSettings(mallData.localMediaTextSettings || {});
        setSubFloorSettings(mallData.subFloorSettings || { "1F-1": [], "1F-2": [] });
        setFloorLayout(mallData.floorLayout || DEFAULT_FLOOR_LAYOUT);

        addDebug(`Mall settings loaded for ${currentMallId}`);
        logInfo("app", "Settings loaded", {
          mallId: currentMallId,
          shopPositions: Object.keys(mallData.shopPositions.positions).length,
        });
        logInfo("SYSTEM", "Application initialized successfully");
      } catch (e) {
        addDebug(`Failed to load settings: ${e}`);
        logError("app", "Failed to load settings from Tauri", { error: e });
      }
    };

    init();
  }, []);

  // Global error handlers
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      logError("SYSTEM", "Uncaught global error", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError("SYSTEM", "Unhandled promise rejection", {
        reason: event.reason instanceof Error
          ? { message: event.reason.message, stack: event.reason.stack }
          : String(event.reason),
      });
    };

    window.addEventListener("error", handleGlobalError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleGlobalError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  // Unified save handler: writes global + per-mall settings
  const handleSaveAllSettings = async (
    global: { mallId: string; floor: string },
    mallData: MallSettingsFile,
  ) => {
    try {
      const processedImageSettings = { ...mallData.imageSettings };
      const floorKeys: FloorId[] = ["1F", "2F", "3F", "4F"];

      for (const floorKey of floorKeys) {
        const mapValue = processedImageSettings.floorMaps[floorKey];
        if (mapValue && mapValue.startsWith("data:")) {
          const response = await fetch(mapValue);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const ext = blob.type.includes("png") ? "png" : blob.type.includes("svg") ? "svg" : "jpg";
          const filename = `floormap-${floorKey}.${ext}`;
          const savedPath = await saveImageFile(filename, uint8Array);
          processedImageSettings.floorMaps[floorKey] = savedPath;
        } else if (!isCustomImagePath(mapValue)) {
          processedImageSettings.floorMaps[floorKey] = "";
        }
      }

      if (processedImageSettings.openTimeImage && processedImageSettings.openTimeImage.startsWith("data:")) {
        const response = await fetch(processedImageSettings.openTimeImage);
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const ext = blob.type.includes("png") ? "png" : blob.type.includes("svg") ? "svg" : "jpg";
        const filename = `open-time.${ext}`;
        const savedPath = await saveImageFile(filename, uint8Array);
        processedImageSettings.openTimeImage = savedPath;
      } else if (!isCustomImagePath(processedImageSettings.openTimeImage)) {
        processedImageSettings.openTimeImage = "";
      }

      const processedMallData: MallSettingsFile = {
        ...mallData,
        imageSettings: processedImageSettings,
      };

      await saveGlobalSettings({
        mallId: global.mallId as any,
        floor: global.floor,
      });

      await saveMallSettingsToFile(global.mallId, processedMallData);

      // Update App state
      setMallId(global.mallId);
      setFloor(global.floor as FloorId);
      setLocationSettings(processedMallData.locationIcons);
      setImageSettings(processedMallData.imageSettings);
      setShopPositions(processedMallData.shopPositions);
      setLocalGenreSettings(processedMallData.genreSettings);
      setCmsEnabled(processedMallData.cmsSettings?.enabled ?? true);
      setCurrentFloorSetting(processedMallData.currentFloorSetting || "1F");
      setDisplayFloors(processedMallData.displayFloors || ['1F', '2F', '3F', '4F']);
      setLocalMediaTextSettings(processedMallData.localMediaTextSettings || {});
      setSubFloorSettings(processedMallData.subFloorSettings || { "1F-1": [], "1F-2": [] });
      setFloorLayout(processedMallData.floorLayout || DEFAULT_FLOOR_LAYOUT);

      logInfo("app", "All settings saved", { mallId: global.mallId });
    } catch (e) {
      logError("app", "Failed to save settings", { error: e });
      throw e;
    }
  };

  return (
    <ErrorBoundary>
      {isDebugVisible && (
      <div style={{
        position: 'fixed',
        top: debugPos.y,
        left: debugPos.x,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.9)',
        color: 'lime',
        border: '1px solid lime',
        borderRadius: '4px',
        width: `${debugSize.w}px`,
        height: `${debugSize.h}px`,
        maxHeight: '90vh',
        maxWidth: '90vw',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
      }}>
        {/* Header for dragging */}
        <div
          onMouseDown={handleDebugMouseDown}
          style={{
            padding: '10px',
            background: 'rgba(0,255,0,0.2)',
            cursor: isDragging ? 'grabbing' : 'grab',
            fontWeight: 'bold',
            borderBottom: '1px solid lime',
            userSelect: 'none',
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Debug Log (Mall: {mallId} | Floor: {currentFloorSetting})</span>
          <span style={{ fontSize: '10px', opacity: 0.8 }}>Ctrl+Shift+D to toggle</span>
        </div>

        {/* System Info Section */}
        <div style={{
          padding: '8px 10px',
          borderBottom: '1px solid rgba(0,255,0,0.2)',
          fontSize: '11px',
          background: 'rgba(255,255,255,0.05)',
          flexShrink: 0
        }}>
          <div>Version: {appVersion || 'Unknown'} | Window: {window.innerWidth}x{window.innerHeight}</div>
          <div>Location Icon ({currentFloorSetting}): {
            (() => {
              const current = locationSettings[currentFloorSetting];
              if (!current) return 'None';
              return `SB:${current.speechBubble?.enabled ? 'ON' : 'OFF'}(${current.speechBubble?.animation?.type || 'none'}), Loc:${current.location?.enabled ? 'ON' : 'OFF'}`;
            })()
          }</div>
        </div>

        {/* Scrollable Content Container */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* API Status Section */}
          <details style={{
            padding: '8px 10px',
            borderBottom: '1px solid rgba(0,255,0,0.2)',
            fontSize: '11px',
            background: 'rgba(255,255,255,0.05)',
            cursor: 'pointer'
          }}>
            <summary style={{fontWeight: 'bold', color: 'cyan'}}>API Status</summary>
            <div style={{marginTop: '4px', paddingLeft: '10px'}}>
              <div>SSE Status: <span style={{color: sseStatus === 'connected' ? 'lime' : 'red'}}>{sseStatus}</span></div>
              <div>Bridge: http://localhost:8090</div>
              <div>CMS: http://localhost:48080 (enabled: {cmsEnabled ? 'YES' : 'NO'})</div>
            </div>
          </details>

          {/* Settings Details Section */}
          <details style={{
            padding: '8px 10px',
            borderBottom: '1px solid rgba(0,255,0,0.2)',
            fontSize: '11px',
            background: 'rgba(255,255,255,0.05)',
            cursor: 'pointer'
          }}>
            <summary style={{fontWeight: 'bold', color: 'orange'}}>Full Settings</summary>
            <div style={{marginTop: '4px', paddingLeft: '10px', whiteSpace: 'pre-wrap'}}>
              <details>
                <summary>Location Settings ({currentFloorSetting})</summary>
                <pre>{JSON.stringify(locationSettings[currentFloorSetting], null, 2)}</pre>
              </details>
              <details>
                <summary>Floor Layout ({floor})</summary>
                <pre>{JSON.stringify(floorLayout[floor], null, 2)}</pre>
              </details>
              <details>
                <summary>Image Settings</summary>
                <pre>{JSON.stringify(imageSettings, null, 2)}</pre>
              </details>
              <details>
                <summary>Shop Positions ({floor})</summary>
                <pre>{JSON.stringify({
                  count: Object.keys(shopPositions.positions || {}).filter(k => shopPositions.positions[k]?.floor === floor).length,
                  positions: Object.fromEntries(Object.entries(shopPositions.positions || {}).filter(([,v]) => v.floor === floor))
                }, null, 2)}</pre>
              </details>
            </div>
          </details>

          {/* Log Content area */}
          <div style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
            {debugLog.map((log, i) => <div key={i} style={{marginBottom: '4px', borderBottom: '1px solid rgba(0,255,0,0.1)'}}>{log}</div>)}
          </div>
        </div>

        {/* Resizer Handle */}
        <div
          onMouseDown={handleResizeMouseDown}
          style={{
            width: '100%', height: '10px', background: 'rgba(0,255,0,0.1)',
            cursor: 'se-resize', borderTop: '1px solid rgba(0,255,0,0.3)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0
          }}
        >
          <div style={{width: '20px', height: '2px', background: 'lime', borderRadius: '1px'}}></div>
        </div>
      </div>
      )}
      <ShopListScreen
        currentFloorSetting={currentFloorSetting}
        locationIconSettings={locationSettings}
        shops={shops}
        shopPositions={shopPositions}
        displayFloors={displayFloors}
        floorLayout={floorLayout}
        subFloorSettings={subFloorSettings}
      />
      <UnifiedSettingsScreen
        floor={floor}
        floorLayout={floorLayout}
        locationIconSettings={locationSettings}
        imageSettings={imageSettings}
        shopPositions={shopPositions}
        shops={shops}
        currentFloorSetting={currentFloorSetting}
        localMediaTextSettings={localMediaTextSettings}
        genreSettings={localGenreSettings}
        subFloorSettings={subFloorSettings}
      />
      <VersionInfoScreen onClose={() => {}} />
    </ErrorBoundary>
  );
};

export default App;