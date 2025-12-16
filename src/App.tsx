// src/App.tsx
import React, { useEffect, useState } from "react";
import ShopListScreen from "./screens/ShopListScreen";
import VersionInfoScreen from "./screens/VersionInfoScreen";
import UnifiedSettingsScreen from "./screens/UnifiedSettingsScreen";
import {
  DEFAULT_LOCATION_ICON_SETTINGS,
  DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR,
} from "./config";
import type { LocationIconSettings, LocationIconSettingsPerFloor } from "./types/locationIcon";
import type { ImageSettings } from "./types/imageSettings";
import { DEFAULT_IMAGE_SETTINGS } from "./types/imageSettings";
import type { ShopPositionSettings } from "./types/shopPosition";
import type { Shop } from "./types/shop";
import { fetchShops } from "./repositories/shopRepository";
import { sseClient } from "./api/sseClient";
import type { SseConnectionStatus } from "./api/sseClient";
import type { LocalMediaTextSettings } from "./types/global";

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

const App: React.FC = () => {
  const [locationSettings, setLocationSettings] = useState<LocationIconSettingsPerFloor>(
    DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR
  );

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
  
  // API Status State
  const [sseStatus, setSseStatus] = useState<SseConnectionStatus>('disconnected');
  const [bridgeBaseUrl, setBridgeBaseUrl] = useState<string>("Loading...");
  const [cmsBaseUrl, setCmsBaseUrl] = useState<string>("Loading...");
  const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [cmsStatus, setCmsStatus] = useState<'checking' | 'connected' | 'error'>('checking');

  useEffect(() => {
    // Sync initial status
    try {
        setSseStatus(sseClient.status);
    } catch (e) {
        console.error("Failed to get sseClient status", e);
    }

    // Subscribe to SSE status changes
    const unsubscribeStatus = sseClient.on('status_change', (data: { status: SseConnectionStatus }) => {
      setSseStatus(data.status);
      addDebug(`SSE Status: ${data.status}`);
    });
    
    return () => {
      unsubscribeStatus();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setDebugPos({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      } else if (isResizing) {
        setDebugSize({
          w: Math.max(300, e.clientX - debugPos.x),
          h: Math.max(200, e.clientY - debugPos.y)
        });
      }
    };
    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle debug log with Ctrl + Shift + D
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
    setDragOffset({
      x: e.clientX - debugPos.x,
      y: e.clientY - debugPos.y
    });
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
  };

  // Floor and floor layout state for unified settings
  const [floor, setFloor] = useState<FloorId>("1F");
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(DEFAULT_FLOOR_LAYOUT);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [shopPositions, setShopPositions] = useState<ShopPositionSettings>({ positions: {} });
  const [shops, setShops] = useState<Shop[]>([]);
  const [localMediaTextSettings, setLocalMediaTextSettings] = useState<LocalMediaTextSettings>({});
  
  // Current floor setting (lifted from ShopPositionSettingsTab)
  const [currentFloorSetting, setCurrentFloorSetting] = useState<string>("1F");

  // Load initial settings from Electron and subscribe to updates
  useEffect(() => {
    let unsubscribeUpdated: (() => void) | undefined;
    let unsubscribeFloorLayout: (() => void) | undefined;
    let unsubscribeCurrentFloorSetting: (() => void) | undefined;

    // Start SSE connection
    sseClient.connect();

    const init = async () => {
      addDebug("App: Initializing...");
      const api = window.electronAPI;
      if (!api) {
        addDebug("App: No Electron API found");
        return;
      }

      // Load API Base URLs for Debug
      try {
        if (api.getBridgeBaseUrl) {
            const url = await api.getBridgeBaseUrl();
            setBridgeBaseUrl(url);
            setBridgeStatus('connected');
        }
        if (window.wspApi && window.wspApi.getBaseUrl) {
            const url = await window.wspApi.getBaseUrl();
            setCmsBaseUrl(url);
            setCmsStatus('connected');
        }
      } catch (e: any) {
        addDebug(`App: Failed to load API URLs: ${e.message}`);
        setBridgeStatus('error');
        setCmsStatus('error');
      }

      // Load location icon settings
      try {
        if (api.getLocationIconSettings) {
          const saved = await api.getLocationIconSettings();
          if (saved) {
            // Check if saved is per-floor format or old single format
            if ('speechBubble' in saved && 'location' in saved && !('1F' in saved)) {
              // Old format: single LocationIconSettings - convert to per-floor format
              const mergedSettings: LocationIconSettings = {
                speechBubble: {
                  ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
                  ...saved.speechBubble,
                  enabled: saved.speechBubble?.enabled ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.enabled,
                  shadow: saved.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
                  animation: saved.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
                },
                location: {
                  ...DEFAULT_LOCATION_ICON_SETTINGS.location,
                  ...saved.location,
                  enabled: saved.location?.enabled ?? DEFAULT_LOCATION_ICON_SETTINGS.location.enabled,
                  shadow: saved.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
                  animation: saved.location?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.location.animation,
                },
              };
              // Convert to per-floor format
              const perFloorSettings: LocationIconSettingsPerFloor = {
                "1F": mergedSettings,
                "2F": mergedSettings,
                "3F": mergedSettings,
                "4F": mergedSettings,
              };
              setLocationSettings(perFloorSettings);
            } else {
              // New format: LocationIconSettingsPerFloor
              const perFloorSettings: LocationIconSettingsPerFloor = { ...DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR };
              Object.entries(saved as unknown as LocationIconSettingsPerFloor).forEach(([floorId, settings]) => {
                perFloorSettings[floorId] = {
                  speechBubble: {
                    ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
                    ...settings.speechBubble,
                    enabled: settings.speechBubble?.enabled ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.enabled,
                    shadow: settings.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
                    animation: settings.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
                  },
                  location: {
                    ...DEFAULT_LOCATION_ICON_SETTINGS.location,
                    ...settings.location,
                    enabled: DEFAULT_LOCATION_ICON_SETTINGS.location.enabled, // Always use default enabled value
                    shadow: settings.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
                    animation: settings.location?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.location.animation,
                  },
                };
              });
              setLocationSettings(perFloorSettings);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load location settings", e);
      }

      // Load floor
      try {
        if (api.getFloor) {
          const currentFloor = await api.getFloor();
          if (currentFloor) {
            setFloor(currentFloor as FloorId);
          }
        }
      } catch (e) {
        console.error("Failed to load floor", e);
      }

      // Load floor layout
      try {
        if (api.getFloorLayout) {
          const layout = await api.getFloorLayout();
          if (layout) {
            setFloorLayout(layout);
          }
        }
      } catch (e) {
        console.error("Failed to load floor layout", e);
      }

      // Load image settings
      try {
        if (api.getImageSettings) {
          const saved = await api.getImageSettings();
          if (saved) {
            setImageSettings(saved);
          }
        }
      } catch (e) {
        console.error("Failed to load image settings", e);
      }

      // Load shop positions
      try {
        if (api.getShopPositions) {
          const saved = await api.getShopPositions();
          if (saved) {
            setShopPositions(saved);
          }
        }
      } catch (e) {
        console.error("Failed to load shop positions", e);
      }

      // Load local media text settings
      try {
        if (api.getLocalMediaTextSettings) {
          const saved = await api.getLocalMediaTextSettings();
          if (saved) {
            setLocalMediaTextSettings(saved);
          }
        }
      } catch (e) {
        console.error("Failed to load local media text settings", e);
      }

      // Load current floor setting from Electron
      try {
        // App Version
        // The appInfo is directly on window, not under electronAPI
        if (window.appInfo?.getVersion) {
            const v = await window.appInfo.getVersion();
            setAppVersion(v);
        }

        if (api.getCurrentFloorSetting) {
          const saved = await api.getCurrentFloorSetting();
          addDebug(`Floor loaded from IPC: ${JSON.stringify(saved)}`);
          if (saved) {
            setCurrentFloorSetting(saved);
          }
        }
        
        // Detailed Debug
        if (api.getDebugSettingsStatus) {
           const status = await api.getDebugSettingsStatus();
           addDebug(`DEBUG STATUS:\nPath: ${status.path}\nExists: ${status.exists}\nINTERNAL: ${JSON.stringify(status.internalDebug)}\nLoaded: ${JSON.stringify(status.loadSettingsResult)}`);
        }
      } catch (e: any) {
        console.error("Failed to load current floor setting", e);
        addDebug(`Floor load error: ${e.message}`);
      }

      // Load shops
      try {
        const shopData = await fetchShops({ forceReload: true }); // Initial full load
        
        // Filter shops: only "飲食店・食品" or "グルメ" genre
        const filtered = shopData.filter((shop) => shop.genre === "飲食店・食品" || shop.genre === "グルメ");
        
        // Exclude "イオン堺北花田店"
        const excluded = filtered.filter((shop) => !(shop.name || "").includes("イオン堺北花田店"));
        
        // Clean shop names
        const cleaned = excluded.map((s) => ({
          ...s,
          name: (s.name || "").replace(/【.*?】/g, "").trim(),
        }));
        
        setShops(cleaned);
      } catch (e) {
        console.error("Failed to load shops:", e);
      }
    };

    init();

    const api = window.electronAPI;
    if (api) {
      if (api.onLocationIconSettingsUpdated) {
        unsubscribeUpdated = api.onLocationIconSettingsUpdated((updated) => {
          // Check if updated is per-floor format or old single format
          if ('speechBubble' in updated && 'location' in updated && !('1F' in updated)) {
            // Old format: single LocationIconSettings - convert to per-floor format
            const mergedSettings: LocationIconSettings = {
              speechBubble: {
                ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
                ...updated.speechBubble,
                enabled: updated.speechBubble?.enabled ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.enabled,
                shadow: updated.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
                animation: updated.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
              },
              location: {
                ...DEFAULT_LOCATION_ICON_SETTINGS.location,
                ...updated.location,
                enabled: updated.location?.enabled ?? DEFAULT_LOCATION_ICON_SETTINGS.location.enabled,
                shadow: updated.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
                animation: updated.location?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.location.animation,
              },
            };
            // Convert to per-floor format
            const perFloorSettings: LocationIconSettingsPerFloor = {
              "1F": mergedSettings,
              "2F": mergedSettings,
              "3F": mergedSettings,
              "4F": mergedSettings,
            };
            setLocationSettings(perFloorSettings);
          } else {
            // New format: LocationIconSettingsPerFloor
            const perFloorSettings: LocationIconSettingsPerFloor = { ...DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR };
            Object.entries(updated as unknown as LocationIconSettingsPerFloor).forEach(([floorId, settings]) => {
              perFloorSettings[floorId] = {
                speechBubble: {
                  ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
                  ...settings.speechBubble,
                  enabled: settings.speechBubble?.enabled ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.enabled,
                  shadow: settings.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
                  animation: settings.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
                },
                location: {
                  ...DEFAULT_LOCATION_ICON_SETTINGS.location,
                  ...settings.location,
                  enabled: DEFAULT_LOCATION_ICON_SETTINGS.location.enabled, // Always use default enabled value
                  shadow: settings.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
                  animation: settings.location?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.location.animation,
                },
              };
            });
            setLocationSettings(perFloorSettings);
          }
        });
      }

      if (api.onFloorChanged) {
        api.onFloorChanged((nextFloor) => {
          setFloor(nextFloor as FloorId);
        });
      }

      if (api.onFloorLayoutChanged) {
        unsubscribeFloorLayout = api.onFloorLayoutChanged((layout) => {
          setFloorLayout(layout);
        });
      }

      if (api.onImageSettingsUpdated) {
        api.onImageSettingsUpdated((updated) => {
          setImageSettings(updated);
        });
      }

      if (api.onShopPositionsUpdated) {
        api.onShopPositionsUpdated((updated) => {
          setShopPositions(updated);
        });
      }

      if (api.onLocalMediaTextSettingsUpdated) {
        api.onLocalMediaTextSettingsUpdated((updated) => {
          setLocalMediaTextSettings(updated);
        });
      }

      if (api.onCurrentFloorSettingUpdated) {
        unsubscribeCurrentFloorSetting = api.onCurrentFloorSettingUpdated((setting) => {
          setCurrentFloorSetting(setting);
        });
      }
    }

    return () => {
      if (unsubscribeUpdated) unsubscribeUpdated();
      if (unsubscribeFloorLayout) unsubscribeFloorLayout();
      if (unsubscribeCurrentFloorSetting) unsubscribeCurrentFloorSetting();
    };
  }, []);

  const handleSaveLocationSettings = async (settings: LocationIconSettingsPerFloor) => {
    // Persist to Electron settings.json
    if (window.electronAPI?.saveLocationIconSettings) {
      const saved =
        (await window.electronAPI.saveLocationIconSettings(settings as unknown as LocationIconSettings)) ??
        settings;
      setLocationSettings(saved as unknown as LocationIconSettingsPerFloor);
    } else {
      // Fallback: no Electron available (dev in browser)
      setLocationSettings(settings);
    }
  };


  const handleSaveFloor = async (nextFloor: FloorId) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      api.setFloor(nextFloor);
    } catch (e) {
      console.error("Failed to save floor", e);
    }
  };


  const handleSaveImageSettings = async (settings: ImageSettings) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveImageSettings(settings);
      if (saved) {
        setImageSettings(saved);
      }
    } catch (e) {
      console.error("Failed to save image settings", e);
    }
  };

  const handleSaveShopPositions = async (settings: ShopPositionSettings) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveShopPositions(settings);
      if (saved) {
        setShopPositions(saved);
      }
    } catch (e) {
      console.error("Failed to save shop positions", e);
    }
  };

  const handleSaveLocalMediaTextSettings = async (settings: LocalMediaTextSettings) => {
    const api = window.electronAPI;
    if (!api) return;

    try {
      const saved = await api.saveLocalMediaTextSettings(settings);
      if (saved) {
        setLocalMediaTextSettings(saved);
      }
    } catch (e) {
      console.error("Failed to save local media text settings", e);
    }
  };

  const handleSaveCurrentFloorSetting = (newFloor: string) => {
    setCurrentFloorSetting(newFloor);
    const api = window.electronAPI;
    if (api && api.saveCurrentFloorSetting) {
      api.saveCurrentFloorSetting(newFloor);
    }
  };

  return (
    <>
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
          <span>Debug Log (CurrentFloor: {currentFloorSetting})</span>
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
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
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
              <div>Bridge (8090): <span style={{color: bridgeStatus === 'connected' ? 'lime' : bridgeStatus === 'error' ? 'red' : 'yellow'}}>{bridgeStatus}</span> ({bridgeBaseUrl})</div>
              <div>CMS (8080): <span style={{color: cmsStatus === 'connected' ? 'lime' : cmsStatus === 'error' ? 'red' : 'yellow'}}>{cmsStatus}</span> ({cmsBaseUrl})</div>
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
          <div style={{
            padding: '10px',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}>
            {debugLog.map((log, i) => <div key={i} style={{marginBottom: '4px', borderBottom: '1px solid rgba(0,255,0,0.1)'}}>{log}</div>)}
          </div>
        </div>

        {/* Resizer Handle */}
        <div 
          onMouseDown={handleResizeMouseDown}
          style={{
            width: '100%',
            height: '10px',
            background: 'rgba(0,255,0,0.1)',
            cursor: 'se-resize',
            borderTop: '1px solid rgba(0,255,0,0.3)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <div style={{width: '20px', height: '2px', background: 'lime', borderRadius: '1px'}}></div>
        </div>
      </div>
      )}
      <ShopListScreen 
        currentFloorSetting={currentFloorSetting}
        locationIconSettings={locationSettings}
      />
      <UnifiedSettingsScreen
        floor={floor}
        onSaveFloor={handleSaveFloor}
        floorLayout={floorLayout}
        locationIconSettings={locationSettings}
        onSaveLocationIconSettings={handleSaveLocationSettings}
        imageSettings={imageSettings}
        onSaveImageSettings={handleSaveImageSettings}
        shopPositions={shopPositions}
        onSaveShopPositions={handleSaveShopPositions}
        shops={shops}
        currentFloorSetting={currentFloorSetting}
        onSaveCurrentFloorSetting={handleSaveCurrentFloorSetting}
        localMediaTextSettings={localMediaTextSettings}
        onSaveLocalMediaTextSettings={handleSaveLocalMediaTextSettings}
      />
      <VersionInfoScreen onClose={() => {}} />
    </>
  );
};

export default App;
