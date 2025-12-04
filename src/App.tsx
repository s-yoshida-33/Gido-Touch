// src/App.tsx
import React, { useEffect, useState } from "react";
import ShopListScreen from "./screens/ShopListScreen";
import VersionInfoScreen from "./screens/VersionInfoScreen";
import UnifiedSettingsScreen from "./screens/UnifiedSettingsScreen";
import {
  DEFAULT_LOCATION_ICON_SETTINGS,
} from "./config";
import type { LocationIconSettings } from "./types/locationIcon";
import type { ImageSettings } from "./types/imageSettings";
import { DEFAULT_IMAGE_SETTINGS } from "./types/imageSettings";
import type { ShopPositionSettings } from "./types/shopPosition";
import type { Shop } from "./types/shop";
import { fetchShops } from "./repositories/shopRepository";

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
  const [locationSettings, setLocationSettings] = useState<LocationIconSettings>(
    DEFAULT_LOCATION_ICON_SETTINGS
  );

  // Floor and floor layout state for unified settings
  const [floor, setFloor] = useState<FloorId>("1F");
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(DEFAULT_FLOOR_LAYOUT);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(DEFAULT_IMAGE_SETTINGS);
  const [shopPositions, setShopPositions] = useState<ShopPositionSettings>({ positions: {} });
  const [shops, setShops] = useState<Shop[]>([]);

  // Load initial settings from Electron and subscribe to updates
  useEffect(() => {
    let unsubscribeUpdated: (() => void) | undefined;
    let unsubscribeFloorLayout: (() => void) | undefined;

    const init = async () => {
      const api = window.electronAPI;
      if (!api) return;

      // Load location icon settings
      if (api.getLocationIconSettings) {
        const saved = await api.getLocationIconSettings();
        if (saved) {
          // Ensure shadow and animation config exists for backward compatibility
          const mergedSettings: LocationIconSettings = {
            speechBubble: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
              ...saved.speechBubble,
              shadow: saved.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
              animation: saved.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
            },
            location: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.location,
              ...saved.location,
              shadow: saved.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
            },
          };
          setLocationSettings(mergedSettings);
        }
      }

      // Load floor
      if (api.getFloor) {
        const currentFloor = await api.getFloor();
        if (currentFloor) {
          setFloor(currentFloor as FloorId);
        }
      }

      // Load floor layout
      if (api.getFloorLayout) {
        const layout = await api.getFloorLayout();
        if (layout) {
          setFloorLayout(layout);
        }
      }

      // Load image settings
      if (api.getImageSettings) {
        const saved = await api.getImageSettings();
        if (saved) {
          setImageSettings(saved);
        }
      }

      // Load shop positions
      if (api.getShopPositions) {
        const saved = await api.getShopPositions();
        if (saved) {
          setShopPositions(saved);
        }
      }

      // Load shops
      try {
        const shopData = await fetchShops();
        const filtered = shopData.filter((shop) => shop.genre === "飲食店・食品");
        const excluded = filtered.filter((shop) => !shop.name.includes("イオン堺北花田店"));
        const cleaned = excluded.map((s) => ({
          ...s,
          name: s.name.replace(/【.*?】/g, "").trim(),
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
          // Ensure shadow and animation config exists for backward compatibility
          const mergedSettings: LocationIconSettings = {
            speechBubble: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
              ...updated.speechBubble,
              shadow: updated.speechBubble?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
              animation: updated.speechBubble?.animation ?? DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
            },
            location: {
              ...DEFAULT_LOCATION_ICON_SETTINGS.location,
              ...updated.location,
              shadow: updated.location?.shadow ?? DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
            },
          };
          setLocationSettings(mergedSettings);
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
    }

    return () => {
      if (unsubscribeUpdated) unsubscribeUpdated();
      if (unsubscribeFloorLayout) unsubscribeFloorLayout();
    };
  }, []);

  const handleSaveLocationSettings = async (settings: LocationIconSettings) => {
    // Persist to Electron settings.json
    if (window.electronAPI?.saveLocationIconSettings) {
      const saved =
        (await window.electronAPI.saveLocationIconSettings(settings)) ??
        settings;
      setLocationSettings(saved);
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

  return (
    <>
      <ShopListScreen />
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
      />
      <VersionInfoScreen onClose={() => {}} />
    </>
  );
};

export default App;
