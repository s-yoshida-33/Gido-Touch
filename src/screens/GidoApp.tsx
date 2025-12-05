// src/screens/GidoApp.tsx
import React, { useEffect, useState, useRef } from "react";

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

import type { LocationIconSettings } from "../types/locationIcon";
import { LocationIconsOverlay } from "../components/LocationIconsOverlay";
import type { ImageSettings } from "../types/imageSettings";
import type { FloorId } from "../types/floorLayout";
import type { ShopPositionSettings } from "../types/shopPosition";
import { ShopPin } from "../components/ShopPin";

import { logInfo, logError } from "../logs/logging";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

// Map floor id to image asset (詳細モーダルと同じマップ画像を使用)
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
  locationIconSettings: LocationIconSettings;
  // Preview mode props (for UnifiedSettingsScreen)
  previewFloor?: string;
  previewFloorLayout?: FloorLayout;
  imageSettings?: ImageSettings;
  // Shop position preview props (for UnifiedSettingsScreen)
  shopPositions?: ShopPositionSettings;
  shops?: Shop[];
  selectedShopId?: string | null;
  // Show only map (for shop position settings)
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

  // Current floor for this screen (default from APP_CONFIG for non-Electron)
  // Use previewFloor if available, otherwise load from Electron or use default
  const [floor, setFloor] = useState<string>(
    previewFloor ?? APP_CONFIG.floor
  );

  // Runtime floor layout (columns / rows per column)
  // Use previewFloorLayout if available, otherwise load from Electron or use default
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(
    previewFloorLayout ?? DEFAULT_FLOOR_LAYOUT
  );

  // Floor synchronization with Electron main process (only if not in preview mode)
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
  }, [previewFloor]); // Re-run if previewFloor changes

  // Floor layout synchronization with Electron (only if not in preview mode)
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
  }, [previewFloorLayout]); // Re-run if previewFloorLayout changes

  // Update local state when preview props change
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

  // Select floor map by floor id, use custom image if available, fallback to default
  const floorId = floor as FloorId;
  const customFloorMap = floorId ? imageSettings?.floorMaps?.[floorId] : undefined;
  const floorMap = customFloorMap || FLOOR_MAPS[floor] || food1FMap;

  // Video area width (16:9 aspect ratio)
  const videoWidthVh = TOP_HEIGHT_VH * (9 / 16);

  // Shop list area width
  const listWidthVh = 100 - videoWidthVh;

  // Shop data loading
  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const loadShops = async () => {
      try {
        const data = await fetchShops();
        if (cancelled) return;

        const cleaned = data.map((s) => ({
          ...s,
          // Remove furigana / kana in brackets from name
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

    // Initial sync on startup
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

  // If showOnlyMap is true, render only the map
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
          locationIconSettings={locationIconSettings}
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
      {/* Top: map + video area */}
      <div
        style={{
          display: "flex",
          height: `${TOP_HEIGHT_VH}vh`,
        }}
      >
        {/* Floor map */}
        <ShopPinsOverlay
          floor={floor}
          floorMap={floorMap}
          locationIconSettings={locationIconSettings}
          shopPositions={shopPositions}
          shops={previewShops}
          selectedShopId={selectedShopId}
        />

        {/* Video area */}
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

      {/* Bottom: shop list + open-time image */}
      <div
        style={{
          height: `${LIST_HEIGHT_VH}vh`,
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Bottom: shop list */}
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

        {/* Bottom: Open-time image */}
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

/**
 * Shop pins overlay component that displays shop position pins on the map
 * Uses the same logic as ShopDetailScreen's MapWithPinsComponent
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
  const [imageInfo, setImageInfo] = useState<{ 
    naturalWidth: number; 
    naturalHeight: number; 
    displayWidth: number; 
    displayHeight: number; 
    offsetX: number; 
    offsetY: number;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // Normalize floor string
  const normalizeFloor = (value: string): string => {
    const normalized = value.toUpperCase().trim();
    if (normalized.match(/^[0-9]+F$/)) {
      return normalized;
    }
    return "1F";
  };

  const normalizedFloor = normalizeFloor(floor);

  // 画像の読み込みとリサイズ時に実際の表示サイズを計算
  useEffect(() => {
    const updateImageInfo = () => {
      // requestAnimationFrameで次のフレームで実行して、レイアウトが確定してから計算
      requestAnimationFrame(() => {
        if (!containerRef.current || !imageRef.current) return;

        const container = containerRef.current;
        const img = imageRef.current;

        // 画像の自然なサイズ
        const naturalWidth = img.naturalWidth || 0;
        const naturalHeight = img.naturalHeight || 0;

        if (naturalWidth === 0 || naturalHeight === 0) return;

        // コンテナと画像の実際の表示サイズ（getBoundingClientRectで正確なサイズを取得）
        const containerRect = container.getBoundingClientRect();
        const imgRect = img.getBoundingClientRect();
        const displayWidth = imgRect.width;
        const displayHeight = imgRect.height;
        
        // コンテナの実際のサイズ
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // 画像の表示位置（コンテナからの相対位置）
        const offsetX = imgRect.left - containerRect.left;
        const offsetY = imgRect.top - containerRect.top;

        if (displayWidth > 0 && displayHeight > 0) {
          setImageInfo({ 
            naturalWidth, 
            naturalHeight, 
            displayWidth, 
            displayHeight, 
            offsetX, 
            offsetY,
            containerWidth,
            containerHeight
          });
        }
      });
    };

    // 画像の読み込み完了時に計算
    const handleImageLoad = () => {
      // 画像読み込み後、少し遅延させてから計算（レイアウト確定を待つ）
      setTimeout(updateImageInfo, 0);
    };

    if (imageRef.current) {
      if (imageRef.current.complete) {
        handleImageLoad();
      } else {
        imageRef.current.addEventListener("load", handleImageLoad);
      }
    }

    // リサイズ時にも再計算
    window.addEventListener("resize", updateImageInfo);
    const resizeObserver = new ResizeObserver(() => {
      updateImageInfo();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    if (imageRef.current) {
      resizeObserver.observe(imageRef.current);
    }

    return () => {
      if (imageRef.current) {
        imageRef.current.removeEventListener("load", handleImageLoad);
      }
      window.removeEventListener("resize", updateImageInfo);
      resizeObserver.disconnect();
    };
  }, [floorMap]);

  // Get shop positions for current floor
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
        overflow: "visible",
      }}
    >
      <img
        ref={imageRef}
        src={floorMap}
        alt={`Floor map ${floor}`}
        draggable={false}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        }}
        onLoad={() => {
          logInfo("map", "Floor map image loaded", {
            floor,
            src: floorMap,
          });
        }}
        onError={(event) => {
          logError("map", "Failed to load floor map image", {
            floor,
            src: floorMap,
          });
          (event.target as HTMLImageElement).style.visibility = "hidden";
        }}
      />

      {/* Location icons overlay */}
      <LocationIconsOverlay settings={locationIconSettings} />

      {/* Shop position pins - only show if shopPositions is provided */}
      {shopPositions && imageInfo && Object.entries(positions)
        .filter(([shopId]) => {
          // 選択中のショップのピンのみを表示
          if (selectedShopId) {
            return shopId === selectedShopId;
          }
          return false;
        })
        .map(([shopId, position]) => {
          if (!position || !position.floor || position.floor !== normalizedFloor) return null;
          const shop = safeShops.find((s) => (s.shopId || s.number) === shopId);
          if (!shop || !shop.name) return null;
          
          // 後方互換性: 0～1の値の場合は100倍に変換
          const normalizedPosition = {
            ...position,
            x: position.x <= 1 ? position.x * 100 : position.x,
            y: position.y <= 1 ? position.y * 100 : position.y,
          };

          // マップ画像の表示サイズを基準に絶対ピクセル座標を計算
          const xPercent = normalizedPosition.x / 100;
          const yPercent = normalizedPosition.y / 100;
          
          // 1. ピンの相対位置 (0-100%) を、現在のマップ画像の表示サイズ (displayWidth/Height) に変換
          const xInDisplayImage = xPercent * imageInfo.displayWidth;
          const yInDisplayImage = yPercent * imageInfo.displayHeight;
          
          // 2. コンテナ内の絶対ピクセル座標を計算（オフセットを加算）
          const pixelX = imageInfo.offsetX + xInDisplayImage;
          const pixelY = imageInfo.offsetY + yInDisplayImage;

          return (
            <ShopPin
              key={shopId}
              position={normalizedPosition}
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
