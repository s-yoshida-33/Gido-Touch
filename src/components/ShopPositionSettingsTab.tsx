// src/components/ShopPositionSettingsTab.tsx
import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { FloorId } from "../types/floorLayout";
import type { ShopPositionSettings, ShopPosition } from "../types/shopPosition";
import type { Shop } from "../types/shop";
import type { ShadowConfig, AnimationConfig, AnimationType, LocationIconSettingsPerFloor, IconPositionConfig } from "../types/locationIcon";
import { getLocationIconSettingsForFloor } from "../config";
import { ShopPin } from "./ShopPin";
import food1FMap from "../assets/food-1F-map.svg";
import food2FMap from "../assets/food-2F-map.svg";
import food3FMap from "../assets/food-3F-map.svg";
import food4FMap from "../assets/food-4F-map.svg";

function normalizeFloor(value: string): string {
  const normalized = value.toUpperCase().trim();
  if (normalized.match(/^[0-9]+F$/)) {
    return normalized;
  }
  return "1F";
}

const clampPercent = (value: number) => {
  const clamped = Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));
  // 0.1単位に丸める
  return Math.round(clamped * 10) / 10;
};

const clampRotation = (value: number) => {
  const v = Number.isNaN(value) ? 0 : value;
  if (v < 0) return 0;
  if (v > 360) return 360;
  return v;
};

const clampPercentForLocation = (value: number) =>
  Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));

// IconConfigSection: 現在地アイコン等の設定用コンポーネント
const IconConfigSection: React.FC<{
  label: string;
  config: IconPositionConfig;
  onChange: (next: IconPositionConfig) => void;
  showAnimation?: boolean;
}> = ({ label, config, onChange, showAnimation = false }) => {
  const update = (partial: Partial<IconPositionConfig>) => {
    onChange({ ...config, ...partial });
  };

  return (
    <fieldset
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
      }}
    >
      <legend style={{ fontWeight: 600, color: "rgba(255,255,255,0.9)", padding: "0 8px", fontSize: 14 }}>{label}</legend>

      <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
          style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
        />
        <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>表示</span>
      </label>

      {/* Position */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>X位置 (%)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                update({ xPercent: clampPercentForLocation(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={config.xPercent}
              onChange={(e) =>
                update({ xPercent: clampPercentForLocation(Number(e.target.value)) })
              }
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>Y位置 (%)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                update({ yPercent: clampPercentForLocation(Number(e.target.value)) })
              }
              style={{
                flex: 1,
                accentColor: "#007aff",
              }}
            />
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={config.yPercent}
              onChange={(e) =>
                update({ yPercent: clampPercentForLocation(Number(e.target.value)) })
              }
              style={{
                width: 70,
                backgroundColor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 6,
                padding: "6px 8px",
                color: "#ffffff",
                fontSize: 13,
              }}
            />
          </div>
        </div>
      </div>
      
      {/* 簡易的なサイズ・回転設定（必要に応じて追加） */}
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
         <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>サイズ (px)</div>
            <input
              type="number"
              value={config.size}
              onChange={(e) => update({ size: Number(e.target.value) })}
              style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
            />
         </div>
         <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>回転 (°)</div>
            <input
              type="number"
              value={config.rotation}
              onChange={(e) => update({ rotation: clampRotation(Number(e.target.value)) })}
              style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
            />
         </div>
      </div>

      {/* Animation settings (only if requested) */}
      {showAnimation && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={config.animation?.enabled ?? false}
              onChange={(e) =>
                update({
                  animation: {
                    ...(config.animation ?? { enabled: false, type: "floating", duration: 2.2, amplitude: 18 }),
                    enabled: e.target.checked,
                  },
                })
              }
              style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
            />
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 500 }}>アニメーション</span>
          </label>
        </div>
      )}
    </fieldset>
  );
};

// デフォルトのShopPositionを作成
const createDefaultShopPosition = (floor: FloorId): ShopPosition => ({
  x: 50.0,
  y: 50.0,
  floor,
  enabled: true,
  size: 60,
  rotation: 0,
  shadow: {
    enabled: false,
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    opacity: 0,
  },
  animation: {
    enabled: false,
    type: "floating",
    duration: 2.2,
    amplitude: 18,
  },
});

export interface ShopPositionSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  shopPositions: ShopPositionSettings;
  onChangeShopPositions: React.Dispatch<React.SetStateAction<ShopPositionSettings>>;
  shops: Shop[];
  onSelectedShopIdChange?: (shopId: string | null) => void;
  // Location icon settings (for current location icon configuration) - per floor
  locationIconSettings?: LocationIconSettingsPerFloor;
  onChangeLocationIconSettings?: React.Dispatch<React.SetStateAction<LocationIconSettingsPerFloor>>;
}

export const ShopPositionSettingsTab: React.FC<ShopPositionSettingsTabProps> = ({
  floor,
  onChangeFloor,
  shopPositions,
  onChangeShopPositions,
  shops,
  onSelectedShopIdChange,
  locationIconSettings,
  onChangeLocationIconSettings,
}) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];
  const [selectedFloor, setSelectedFloor] = useState<FloorId>(floor);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // ズーム状態の管理
  const [currentScale, setCurrentScale] = useState(1);
  const transformRef = useRef<any>(null);
  
  // 画像サイズ計測用のRefとState
  const mapImageRef = useRef<HTMLImageElement>(null);
  const [mapDimensions, setMapDimensions] = useState<{ width: number; height: number } | null>(null);

  // Update preview floor when selected floor changes
  useEffect(() => {
    onChangeFloor(selectedFloor);
  }, [selectedFloor, onChangeFloor]);

  // 現在の階のショップのみフィルタ（階の正規化を考慮）
  const normalizedSelectedFloor = normalizeFloor(selectedFloor);
  const floorShops = useMemo(() => {
    const filtered = shops.filter((shop) => {
      if (!shop.floors || shop.floors.length === 0) return false;
      return shop.floors.some((floor) => {
        const normalizedShopFloor = normalizeFloor(String(floor));
        return normalizedShopFloor === normalizedSelectedFloor;
      });
    });
    return filtered;
  }, [shops, normalizedSelectedFloor]);

  const updateShopPosition = useCallback(
    (shopId: string, position: ShopPosition) => {
      onChangeShopPositions((prev) => ({
        positions: {
          ...prev.positions,
          [shopId]: position,
        },
      }));
    },
    [onChangeShopPositions]
  );

  // 親コンポーネントにselectedShopIdを通知
  useEffect(() => {
    if (onSelectedShopIdChange) {
      onSelectedShopIdChange(selectedShopId);
    }
  }, [selectedShopId, onSelectedShopIdChange]);

  // 選択中のショップの位置情報を取得（未設定の場合はデフォルト値を使用）
  const selectedShopPosition = selectedShopId
    ? (() => {
        const existing = shopPositions.positions[selectedShopId];
        if (!existing) {
          return createDefaultShopPosition(selectedFloor);
        }
        // 既存の位置をマージ（デフォルト値で不足しているフィールドを補完）
        return {
          ...createDefaultShopPosition(selectedFloor),
          ...existing,
          shadow: existing.shadow || createDefaultShopPosition(selectedFloor).shadow!,
          animation: existing.animation || createDefaultShopPosition(selectedFloor).animation!,
        };
      })()
    : null;

  const updatePositionField = useCallback(
    (field: keyof ShopPosition, value: any) => {
      if (!selectedShopId || !selectedShopPosition) return;
      updateShopPosition(selectedShopId, {
        ...selectedShopPosition,
        [field]: value,
      });
    },
    [selectedShopId, selectedShopPosition, updateShopPosition]
  );

  const updateShadowField = useCallback(
    (field: keyof ShadowConfig, value: any) => {
      if (!selectedShopId || !selectedShopPosition) return;
      updateShopPosition(selectedShopId, {
        ...selectedShopPosition,
        shadow: {
          ...(selectedShopPosition.shadow || createDefaultShopPosition(selectedFloor).shadow!),
          [field]: value,
        },
      });
    },
    [selectedShopId, selectedShopPosition, selectedFloor, updateShopPosition]
  );

  const updateAnimationField = useCallback(
    (field: keyof AnimationConfig, value: any) => {
      if (!selectedShopId || !selectedShopPosition) return;
      updateShopPosition(selectedShopId, {
        ...selectedShopPosition,
        animation: {
          ...(selectedShopPosition.animation || createDefaultShopPosition(selectedFloor).animation!),
          [field]: value,
        },
      });
    },
    [selectedShopId, selectedShopPosition, selectedFloor, updateShopPosition]
  );

  const getMapImage = (f: string) => {
    switch (normalizeFloor(f)) {
      case "1F": return food1FMap;
      case "2F": return food2FMap;
      case "3F": return food3FMap;
      case "4F": return food4FMap;
      default: return food1FMap;
    }
  };

  const mapImage = getMapImage(selectedFloor);

  const handleImageLoad = () => {
    if (mapImageRef.current) {
      setMapDimensions({
        width: mapImageRef.current.naturalWidth,
        height: mapImageRef.current.naturalHeight,
      });
    }
  };

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedShopId || !selectedShopPosition || !mapDimensions) return;

    // クリックされた要素（画像コンテナ）の矩形情報を取得
    const rect = e.currentTarget.getBoundingClientRect();
    
    // 画像内の相対座標(px)を計算 (ズームされていても rect は現在の表示サイズを返す)
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // パーセンテージに変換
    const xPercent = clampPercent((clickX / rect.width) * 100);
    const yPercent = clampPercent((clickY / rect.height) * 100);

    // 位置更新
    updateShopPosition(selectedShopId, {
      ...selectedShopPosition,
      x: xPercent,
      y: yPercent,
    });
  }, [selectedShopId, selectedShopPosition, mapDimensions, updateShopPosition]);

  return (
    <div>
      <h3
        style={{
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        座標設定
      </h3>

      {shops.length === 0 && (
        <div
          style={{
            padding: 16,
            backgroundColor: "rgba(255, 0, 0, 0.1)",
            border: "1px solid rgba(255, 0, 0, 0.3)",
            borderRadius: 8,
            marginBottom: 20,
            color: "rgba(255, 255, 255, 0.9)",
            fontSize: 14,
          }}
        >
          ショップデータが読み込まれていません。アプリを再読み込みしてください。
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Floor Selection */}
        <div>
          <label
            style={{
              display: "block",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 13,
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            フロア選択
          </label>
          <select
            value={selectedFloor}
            onChange={(e) => {
              setSelectedFloor(e.target.value as FloorId);
              setSelectedShopId(null); // 階を変更したらショップ選択をリセット
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
            }}
          >
            {floors.map((f) => (
              <option
                key={f}
                value={f}
                style={{
                  backgroundColor: "#2C2C2C",
                  color: "#ffffff",
                }}
              >
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Shop Selection */}
        <div>
          <label
            style={{
              display: "block",
              color: "rgba(255, 255, 255, 0.8)",
              fontSize: 13,
              marginBottom: 8,
              fontWeight: 500,
            }}
          >
            ショップ選択
          </label>
          <select
            value={selectedShopId || ""}
            onChange={(e) => {
              const newShopId = e.target.value || null;
              setSelectedShopId(newShopId);
              
              // ショップを選択したときに、位置が未設定の場合はデフォルト値を設定
              if (newShopId && !shopPositions.positions[newShopId]) {
                updateShopPosition(newShopId, createDefaultShopPosition(selectedFloor));
              }
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
            }}
          >
            <option
              value=""
              style={{
                backgroundColor: "#2C2C2C",
                color: "#ffffff",
              }}
            >
              ショップを選択
            </option>
            {floorShops.length === 0 ? (
              <option
                value=""
                disabled
                style={{
                  backgroundColor: "#2C2C2C",
                  color: "rgba(255, 255, 255, 0.5)",
                }}
              >
                この階にショップがありません
              </option>
            ) : (
              floorShops.map((shop) => (
                <option
                  key={shop.shopId || shop.number}
                  value={shop.shopId || shop.number}
                  style={{
                    backgroundColor: "#2C2C2C",
                    color: "#ffffff",
                  }}
                >
                  {shop.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Central Map Preview - Interaction enabled */}
        <div 
          style={{ 
            width: "100%", 
            height: "600px", // Sufficient height
            backgroundColor: "#333", 
            borderRadius: 12,
            overflow: "hidden",
            marginTop: 20,
            position: "relative",
            border: "1px solid rgba(255,255,255,0.1)"
          }}
        >
          <TransformWrapper
            initialScale={1}
            minScale={1}
            maxScale={4}
            centerOnInit={true}
            wheel={{ step: 0.1 }}
            onTransformed={(ref) => setCurrentScale(ref.state.scale)}
            onInit={(ref) => {
               transformRef.current = ref;
               setCurrentScale(ref.state.scale);
            }}
          >
            <TransformComponent
              wrapperStyle={{ width: "100%", height: "100%" }}
              contentStyle={{ 
                width: "100%", 
                height: "100%", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center" 
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: mapDimensions ? undefined : "100%",
                  aspectRatio: mapDimensions ? `${mapDimensions.width} / ${mapDimensions.height}` : undefined,
                  height: mapDimensions ? "100%" : undefined,
                  maxWidth: "100%",
                  maxHeight: "100%",
                  boxShadow: "0 0 20px rgba(0,0,0,0.5)",
                  cursor: selectedShopId ? "crosshair" : "grab"
                }}
                onClick={selectedShopId ? handleMapClick : undefined}
              >
                <img
                  ref={mapImageRef}
                  src={mapImage}
                  onLoad={handleImageLoad}
                  alt="Map"
                  draggable={false}
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    userSelect: "none",
                    pointerEvents: "none"
                  }}
                />
                
                {selectedShopId && selectedShopPosition && (
                  <ShopPin
                    position={selectedShopPosition}
                    shopName={shops.find(s => s.shopId === selectedShopId)?.name || ""}
                    isSelected={true}
                    shopId={selectedShopId}
                    transformScale={currentScale}
                  />
                )}
                
                {shops.filter(s => s.shopId !== selectedShopId && normalizeFloor(s.floors?.[0] || "") === normalizeFloor(selectedFloor)).map(shop => {
                   const pos = shopPositions.positions[shop.shopId || shop.number];
                   if (!pos) return null;
                   return (
                     <div key={shop.shopId} style={{ opacity: 0.5 }}>
                       <ShopPin
                         position={pos}
                         shopName={shop.name}
                         transformScale={currentScale}
                         shopId={shop.shopId}
                       />
                     </div>
                   );
                })}
              </div>
            </TransformComponent>
          </TransformWrapper>
          <div style={{ position: "absolute", bottom: 10, left: 10, padding: "4px 8px", backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 4, fontSize: 12, color: "#fff", pointerEvents: "none" }}>
            マップをクリックして位置を設定（ホイールでズーム）
          </div>
        </div>

        {/* Position Settings - shown when shop is selected */}
        {selectedShopId && selectedShopPosition && (
          <fieldset
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              padding: 16,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.03)",
            }}
          >
            <legend
              style={{
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
                padding: "0 8px",
                fontSize: 14,
              }}
            >
              位置・表示設定
            </legend>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Enabled */}
              <label style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={selectedShopPosition.enabled ?? true}
                  onChange={(e) => updatePositionField("enabled", e.target.checked)}
                  style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
                />
                <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14 }}>表示</span>
              </label>

              {/* Position */}
              <div>
                <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                  X位置 (0.0〜100.0)
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedShopPosition.x ?? 50.0}
                    onChange={(e) =>
                      updatePositionField("x", clampPercent(Number(e.target.value)))
                    }
                    style={{ flex: 1, accentColor: "#007aff" }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedShopPosition.x ?? 50.0}
                    onChange={(e) =>
                      updatePositionField("x", clampPercent(Number(e.target.value)))
                    }
                    style={{
                      width: 70,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
                  Y位置 (0.0〜100.0)
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedShopPosition.y ?? 50.0}
                    onChange={(e) =>
                      updatePositionField("y", clampPercent(Number(e.target.value)))
                    }
                    style={{ flex: 1, accentColor: "#007aff" }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedShopPosition.y ?? 50.0}
                    onChange={(e) =>
                      updatePositionField("y", clampPercent(Number(e.target.value)))
                    }
                    style={{
                      width: 70,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </div>
              </div>

              {/* Size & rotation */}
              <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 150 }}>
                  <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>サイズ (px)</div>
                  <input
                    type="number"
                    min={1}
                    max={512}
                    step={0.1}
                    value={selectedShopPosition.size ?? 60}
                    onChange={(e) =>
                      updatePositionField("size", Math.max(1, Math.min(512, Number(e.target.value) || 60)))
                    }
                    style={{
                      width: 100,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>回転 (°)</div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={selectedShopPosition.rotation ?? 0}
                      onChange={(e) =>
                        updatePositionField("rotation", clampRotation(Number(e.target.value)))
                      }
                      style={{ flex: 1, accentColor: "#007aff" }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={360}
                      value={selectedShopPosition.rotation ?? 0}
                      onChange={(e) =>
                        updatePositionField("rotation", clampRotation(Number(e.target.value)))
                      }
                      style={{
                        width: 70,
                        backgroundColor: "rgba(255,255,255,0.05)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 6,
                        padding: "6px 8px",
                        color: "#ffffff",
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Shadow settings */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={selectedShopPosition.shadow?.enabled ?? false}
                    onChange={(e) => updateShadowField("enabled", e.target.checked)}
                    style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
                  />
                  <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 500 }}>シャドウ</span>
                </label>

                {selectedShopPosition.shadow?.enabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>オフセットX</div>
                        <input
                          type="number"
                          value={selectedShopPosition.shadow?.offsetX ?? 0}
                          onChange={(e) => updateShadowField("offsetX", Number(e.target.value) || 0)}
                          style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>オフセットY</div>
                        <input
                          type="number"
                          value={selectedShopPosition.shadow?.offsetY ?? 0}
                          onChange={(e) => updateShadowField("offsetY", Number(e.target.value) || 0)}
                          style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>ぼかし</div>
                        <input
                          type="number"
                          min={0}
                          value={selectedShopPosition.shadow?.blur ?? 0}
                          onChange={(e) => updateShadowField("blur", Math.max(0, Number(e.target.value) || 0))}
                          style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>不透明度</div>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.1}
                          value={selectedShopPosition.shadow?.opacity ?? 0}
                          onChange={(e) => updateShadowField("opacity", Math.max(0, Math.min(1, Number(e.target.value) || 0)))}
                          style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Animation settings */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <label style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={selectedShopPosition.animation?.enabled ?? false}
                    onChange={(e) => updateAnimationField("enabled", e.target.checked)}
                    style={{ marginRight: 10, width: 18, height: 18, accentColor: "#007aff" }}
                  />
                  <span style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: 500 }}>アニメーション</span>
                </label>

                {selectedShopPosition.animation?.enabled && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>タイプ</div>
                      <select
                        value={selectedShopPosition.animation?.type ?? "floating"}
                        onChange={(e) => updateAnimationField("type", e.target.value as AnimationType)}
                        style={{
                          width: "100%",
                          backgroundColor: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6,
                          padding: "6px 8px",
                          color: "#ffffff",
                          fontSize: 13,
                        }}
                      >
                        <option value="floating" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>フローティング</option>
                        <option value="pulse" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>パルス</option>
                        <option value="bounce" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>バウンス</option>
                        <option value="blink" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>点滅・波紋</option>
                        <option value="none" style={{ backgroundColor: "#2C2C2C", color: "#ffffff" }}>なし</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                       <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>期間 (秒)</div>
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={selectedShopPosition.animation?.duration ?? 2.2}
                            onChange={(e) => updateAnimationField("duration", Math.max(0.1, Number(e.target.value) || 2.2))}
                            style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                          />
                       </div>
                       <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>振幅</div>
                          <input
                            type="number"
                            value={selectedShopPosition.animation?.amplitude ?? 18}
                            onChange={(e) => updateAnimationField("amplitude", Number(e.target.value) || 0)}
                            style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                          />
                       </div>
                    </div>

                    {/* 波紋アニメーション（blink）用の設定 */}
                    {selectedShopPosition.animation?.type === "blink" && (
                      <>
                        <div>
                          <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>波紋の色 (RGB/HEX)</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                            <span style={{ backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRight: "none", borderTopLeftRadius: 6, borderBottomLeftRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13, userSelect: "none" }}>#</span>
                            <input
                              type="text"
                              value={(selectedShopPosition.animation?.rippleColor || "#FFFFFF").replace(/^#/, "")}
                              onChange={(e) => {
                                const colorValue = e.target.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
                                updateAnimationField("rippleColor", `#${colorValue}`);
                              }}
                              placeholder="FFFFFF"
                              maxLength={6}
                              style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "none", borderTopRightRadius: 6, borderBottomRightRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>波紋サイズ (倍率)</div>
                            <input
                              type="number"
                              min={1}
                              step={0.1}
                              value={selectedShopPosition.animation?.rippleSize ?? 1.5}
                              onChange={(e) => updateAnimationField("rippleSize", Math.max(1, Number(e.target.value) || 1.5))}
                              style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, marginBottom: 6, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>中心サイズ (倍率)</div>
                            <input
                              type="number"
                              min={0.1}
                              max={2}
                              step={0.05}
                              value={selectedShopPosition.animation?.rippleCenterSize ?? 0.95}
                              onChange={(e) => updateAnimationField("rippleCenterSize", Math.max(0.1, Number(e.target.value) || 0.95))}
                              style={{ width: "100%", backgroundColor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#ffffff", fontSize: 13 }}
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </fieldset>
        )}

        {/* Location Icon Settings - per floor */}
        {locationIconSettings && onChangeLocationIconSettings && (() => {
          const currentFloorSettings = getLocationIconSettingsForFloor(locationIconSettings, selectedFloor);
          return (
            <div style={{ marginTop: 24 }}>
              <h4 style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 8 }}>
                現在地アイコン設定 ({selectedFloor})
              </h4>
              <IconConfigSection
                label="現在地 (Speech Bubble)"
                config={currentFloorSettings.speechBubble}
                onChange={(next) => {
                  onChangeLocationIconSettings((prev) => ({
                    ...prev,
                    [selectedFloor]: {
                      ...currentFloorSettings,
                      speechBubble: next,
                    },
                  }));
                }}
                showAnimation={true}
              />
              <IconConfigSection
                label="現在地 (Location Pin)"
                config={currentFloorSettings.location}
                onChange={(next) => {
                  onChangeLocationIconSettings((prev) => ({
                    ...prev,
                    [selectedFloor]: {
                      ...currentFloorSettings,
                      location: next,
                    },
                  }));
                }}
                showAnimation={true}
              />
            </div>
          );
        })()}
      </div>
    </div>
  );
};