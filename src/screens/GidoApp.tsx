// src/screens/GidoApp.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";

import ShopList from "../components/ShopList";
import type { Shop } from "../types/shop";

import food1FMap from "../assets/food-1F-map.svg";
import food2FMap from "../assets/food-2F-map.svg";
import food3FMap from "../assets/food-3F-map.svg";
import food4FMap from "../assets/food-4F-map.svg";
import openTimeImage from "../assets/open-time.svg";

import { APP_CONFIG, POLLING_INTERVALS } from "../config";
import { fetchShops } from "../repositories/shopRepository";
import VerticalVideoSlot from "../components/VerticalVideoSlot";

import type { LocationIconSettings, LocationIconSettingsPerFloor } from "../types/locationIcon";
import { LocationIconsOverlay } from "../components/LocationIconsOverlay";
import { getLocationIconSettingsForFloor } from "../config";
import type { ImageSettings } from "../types/imageSettings";
import type { FloorId } from "../types/floorLayout";
import type { ShopPositionSettings } from "../types/shopPosition";
import { ShopPin } from "../components/ShopPin";

import { logInfo, logError } from "../logs/logging";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

// Constants for consistent scaling across the app.
// We use 1920px as the standard reference width (Full HD).
const REFERENCE_MAP_WIDTH = 1920;
const DEFAULT_PIN_SIZE = 80;

// Map floor id to image asset
const FLOOR_MAPS: Record<string, string> = {
  "1F": food1FMap,
  "2F": food2FMap,
  "3F": food3FMap,
  "4F": food4FMap,
};

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

interface GidoAppProps {
  locationIconSettings: LocationIconSettings | LocationIconSettingsPerFloor;
  previewFloor?: string;
  previewFloorLayout?: FloorLayout;
  imageSettings?: ImageSettings;
  shopPositions?: ShopPositionSettings;
  shops?: Shop[];
  selectedShopId?: string | null;
  showOnlyMap?: boolean;
}

const GidoApp: React.FC<GidoAppProps> = ({
  locationIconSettings,
  previewFloor,
  previewFloorLayout,
  imageSettings,
  shopPositions,
  shops: previewShops,
  selectedShopId,
  showOnlyMap = false,
}) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [floor, setFloor] = useState<string>(
    previewFloor ?? APP_CONFIG.floor
  );

  const [floorLayout, setFloorLayout] = useState<FloorLayout>(
    previewFloorLayout ?? DEFAULT_FLOOR_LAYOUT
  );

  useEffect(() => {
    if (previewFloor || !window.electronAPI?.getFloor) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const current = await window.electronAPI!.getFloor();
        if (!cancelled && current) {
          setFloor(current);
        }
      } catch (e) {
        console.error("Failed to get floor from Electron", e);
      }
    };

    init();

    window.electronAPI.onFloorChanged((nextFloor) => {
      if (!cancelled) {
        setFloor(nextFloor);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [previewFloor]);

  useEffect(() => {
    const api = window.electronAPI;
    if (previewFloorLayout || !api) return;

    let cancelled = false;

    const init = async () => {
      try {
        const layout = await api.getFloorLayout();
        if (!cancelled && layout) {
          setFloorLayout(layout);
        }
      } catch (e) {
        console.error("Failed to get floor layout from Electron", e);
      }
    };

    init();

    const unsubscribe = api.onFloorLayoutChanged((layout) => {
      if (!cancelled) {
        setFloorLayout(layout);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe && unsubscribe();
    };
  }, [previewFloorLayout]);

  useEffect(() => {
    if (previewFloor !== undefined) {
      setFloor(previewFloor);
    }
  }, [previewFloor]);

  useEffect(() => {
    if (previewFloorLayout !== undefined) {
      setFloorLayout(previewFloorLayout);
    }
  }, [previewFloorLayout]);

  const floorId = floor as FloorId;
  const customFloorMap = floorId ? imageSettings?.floorMaps?.[floorId] : undefined;
  const floorMap = customFloorMap || FLOOR_MAPS[floor] || food1FMap;

  const videoWidthVh = TOP_HEIGHT_VH * (9 / 16);
  const listWidthVh = 100 - videoWidthVh;

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const loadShops = async () => {
      try {
        const data = await fetchShops();
        if (cancelled) return;

        const cleaned = data.map((s) => ({
          ...s,
          name: s.name.replace(/【.*?】/g, "").trim(),
        }));

        setShops(cleaned);
        setError(null);

        logInfo("shopList", "Shop data synced", {
          count: cleaned.length,
        });
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;

        const message = e?.message ?? "failed to load";
        setError(message);

        logError("shopList", "Failed to load shop list", {
          error: message,
        });
      } finally {
        if (cancelled) return;
        timerId = window.setTimeout(loadShops, POLLING_INTERVALS.SHOP_LIST_MS);
      }
    };

    loadShops();

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const currentLayout =
    floorLayout[floor] ??
    DEFAULT_FLOOR_LAYOUT[floor] ??
    DEFAULT_FLOOR_LAYOUT["1F"];

  if (showOnlyMap) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          overflow: "visible",
          fontFamily: "'Rounded Mplus 1c', sans-serif",
          fontWeight: 700,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ShopPinsOverlay
          floor={floor}
          floorMap={floorMap}
          locationIconSettings={
            '1F' in locationIconSettings || '2F' in locationIconSettings
              ? getLocationIconSettingsForFloor(locationIconSettings as LocationIconSettingsPerFloor, floor as FloorId)
              : locationIconSettings as LocationIconSettings
          }
          shopPositions={shopPositions}
          shops={previewShops}
          selectedShopId={selectedShopId}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "visible",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        fontWeight: 700,
      }}
    >
      <div
        style={{
          display: "flex",
          height: `${TOP_HEIGHT_VH}vh`,
        }}
      >
        <ShopPinsOverlay
          floor={floor}
          floorMap={floorMap}
          locationIconSettings={
            '1F' in locationIconSettings || '2F' in locationIconSettings
              ? getLocationIconSettingsForFloor(locationIconSettings as LocationIconSettingsPerFloor, floor as FloorId)
              : locationIconSettings as LocationIconSettings
          }
          shopPositions={shopPositions}
          shops={previewShops}
          selectedShopId={selectedShopId}
        />

        <div
          style={{
            width: `${videoWidthVh}vh`,
            background: "#000",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "100%",
              aspectRatio: "9 / 16",
              overflow: "hidden",
              background: "#000",
            }}
          >
            <VerticalVideoSlot />
          </div>
        </div>
      </div>

      <div
        style={{
          height: `${LIST_HEIGHT_VH}vh`,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <div
          style={{
            flex: 2,
            width: `${listWidthVh}vh`,
            height: `${LIST_HEIGHT_VH}vh`,
          }}
        >
          {error ? (
            <div style={{ padding: "16px 32px", color: "red" }}>
              Error: {error}
            </div>
          ) : (
            <ShopList
              shops={shops}
              floor={floor}
              columnCount={currentLayout.columns}
              rowsPerColumn={currentLayout.rowsPerCol}
              perColumnRows={currentLayout.perColumnRows}
              perColumnPadding={currentLayout.perColumnPadding}
            />
          )}
        </div>

        <div
          style={{
            width: `${videoWidthVh}vh`,
            height: `${LIST_HEIGHT_VH}vh`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#fff",
            margin: "0 auto",
          }}
        >
          <img
            src={imageSettings?.openTimeImage || openTimeImage}
            alt="Open Time"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              padding: "1.4em",
            }}
            onLoad={() => {
              logInfo("openTime", "Open-time image loaded", {
                src: imageSettings?.openTimeImage || openTimeImage,
              });
            }}
            onError={(event) => {
              logError("openTime", "Failed to load open-time image", {
                src: imageSettings?.openTimeImage || openTimeImage,
              });
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>
      </div>

    </div>
  );
};

// Helper function to calculate actual image dimensions and offsets within a container
// considering 'object-fit: contain' behavior.
function calculateImageRect(
  containerWidth: number,
  containerHeight: number,
  imageNaturalWidth: number,
  imageNaturalHeight: number
) {
  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imageNaturalWidth / imageNaturalHeight;

  let displayWidth, displayHeight, offsetX, offsetY;

  if (containerAspect > imageAspect) {
    // Container is wider than image -> Image fits by height
    displayHeight = containerHeight;
    displayWidth = displayHeight * imageAspect;
    offsetY = 0;
    offsetX = (containerWidth - displayWidth) / 2;
  } else {
    // Container is taller than image -> Image fits by width
    displayWidth = containerWidth;
    displayHeight = displayWidth / imageAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayHeight) / 2;
  }

  // Use Math.round to prevent sub-pixel rendering issues which might cause slight visual offsets
  return { 
    displayWidth: Math.round(displayWidth), 
    displayHeight: Math.round(displayHeight), 
    offsetX: Math.round(offsetX), 
    offsetY: Math.round(offsetY) 
  };
}

/**
 * ShopPinsOverlay Component
 * Displays the floor map and overlays shop pins.
 * Uses exact math to determine image boundaries for consistent pin positioning.
 */
const ShopPinsOverlay: React.FC<{
  floor: string;
  floorMap: string;
  locationIconSettings: LocationIconSettings;
  shopPositions?: ShopPositionSettings;
  shops?: Shop[];
  selectedShopId?: string | null;
}> = ({ floor, floorMap, locationIconSettings, shopPositions, shops, selectedShopId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageMetrics, setImageMetrics] = useState<{ 
    displayWidth: number; 
    displayHeight: number; 
    offsetX: number; 
    offsetY: number;
  } | null>(null);

  const normalizeFloor = (value: string): string => {
    const normalized = value.toUpperCase().trim();
    if (normalized.match(/^[0-9]+F$/)) {
      return normalized;
    }
    return "1F";
  };

  const normalizedFloor = normalizeFloor(floor);

  // Update image metrics on resize or load
  const updateMetrics = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    const img = imageRef.current;
    
    if (!img.complete || img.naturalWidth === 0) return;

    const metrics = calculateImageRect(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
      img.naturalWidth,
      img.naturalHeight
    );
    setImageMetrics(metrics);
  }, []);

  useEffect(() => {
    const img = imageRef.current;
    if (img) {
      if (img.complete) updateMetrics();
      else img.addEventListener('load', updateMetrics);
    }
    
    const resizeObserver = new ResizeObserver(updateMetrics);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      img?.removeEventListener('load', updateMetrics);
      resizeObserver.disconnect();
    };
  }, [floorMap, updateMetrics]);

  const safeShopPositions = shopPositions || { positions: {} };
  const safeShops = shops || [];
  const positions = safeShopPositions.positions || {};

  return (
    <div
      ref={containerRef}
      style={{
        flex: 2,
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden", // Ensure no overflow
      }}
    >
      <img
        ref={imageRef}
        src={floorMap}
        alt={`Floor map ${floor}`}
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block"
        }}
        onLoad={() => {
          logInfo("map", "Floor map image loaded", { floor, src: floorMap });
          updateMetrics();
        }}
        onError={(event) => {
          logError("map", "Failed to load floor map image", { floor, src: floorMap });
          (event.target as HTMLImageElement).style.visibility = "hidden";
        }}
      />

      <LocationIconsOverlay settings={locationIconSettings} />

      {shopPositions && imageMetrics && Object.entries(positions)
        .filter(([shopId]) => {
          if (selectedShopId) return shopId === selectedShopId;
          return false;
        })
        .map(([shopId, position]) => {
          if (!position || !position.floor || position.floor !== normalizedFloor) return null;
          const shop = safeShops.find((s) => (s.shopId || s.number) === shopId);
          if (!shop || !shop.name) return null;
          
          const normalizedPosition = {
            ...position,
            x: position.x <= 1 ? position.x * 100 : position.x,
            y: position.y <= 1 ? position.y * 100 : position.y,
          };

          // --- Consistent Scaling Logic ---
          // Scale pin size based on the map width ratio (Current / 1920)
          const scaleRatio = imageMetrics.displayWidth / REFERENCE_MAP_WIDTH;
          const basePinSize = normalizedPosition.size ?? DEFAULT_PIN_SIZE;
          const scaledPinSize = basePinSize * scaleRatio;
          
          // Apply scaled size to the render position
          const renderPosition = {
            ...normalizedPosition,
            size: scaledPinSize
          };

          // Calculate Pixel Coordinates directly mapped to image dimensions.
          // Removed the containment logic that shifted pins inward.
          // Now: 0% = Image Left Edge, 100% = Image Right Edge.
          const xPercent = renderPosition.x / 100;
          const yPercent = renderPosition.y / 100;

          const pixelX = Math.round(imageMetrics.offsetX + (xPercent * imageMetrics.displayWidth));
          const pixelY = Math.round(imageMetrics.offsetY + (yPercent * imageMetrics.displayHeight));

          return (
            <ShopPin
              key={shopId}
              position={renderPosition}
              usePixelPosition={true}
              pixelX={pixelX}
              pixelY={pixelY}
              shopName={shop.name}
              isSelected={selectedShopId === shopId}
              shopLogo={shop.shopLogo}
              shopId={shop.shopId || shop.number}
            />
          );
        })}
    </div>
  );
};

export default GidoApp;