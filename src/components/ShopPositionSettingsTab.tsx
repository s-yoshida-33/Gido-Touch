// src/components/ShopPositionSettingsTab.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import type { FloorId } from "../types/floorLayout";
import type { ShopPositionSettings, ShopPosition } from "../types/shopPosition";
import type { Shop } from "../types/shop";
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

function getMapImage(floor: FloorId): string {
  const normalized = normalizeFloor(floor);
  switch (normalized) {
    case "1F":
      return food1FMap;
    case "2F":
      return food2FMap;
    case "3F":
      return food3FMap;
    case "4F":
      return food4FMap;
    default:
      return food1FMap;
  }
}

const clampPercent = (value: number) => {
  const clamped = Math.min(100, Math.max(0, Number.isNaN(value) ? 0 : value));
  // 0.1単位に丸める
  return Math.round(clamped * 10) / 10;
};

export interface ShopPositionSettingsTabProps {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  shopPositions: ShopPositionSettings;
  onChangeShopPositions: React.Dispatch<React.SetStateAction<ShopPositionSettings>>;
  shops: Shop[];
  onMapClick?: (x: number, y: number) => void;
  onSelectedShopIdChange?: (shopId: string | null) => void;
  onMapClickHandlerChange?: (handler: (x: number, y: number) => void) => void;
}

export const ShopPositionSettingsTab: React.FC<ShopPositionSettingsTabProps> = ({
  floor,
  onChangeFloor,
  shopPositions,
  onChangeShopPositions,
  shops,
  onMapClick,
  onSelectedShopIdChange,
  onMapClickHandlerChange,
}) => {
  const floors: FloorId[] = ["1F", "2F", "3F", "4F"];
  const [selectedFloor, setSelectedFloor] = useState<FloorId>(floor);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    // デバッグ用ログ
    console.log("ShopPositionSettingsTab - floorShops:", {
      selectedFloor,
      normalizedSelectedFloor,
      totalShops: shops.length,
      filteredCount: filtered.length,
      shops: shops.map((s) => ({
        name: s.name,
        shopId: s.shopId,
        number: s.number,
        floors: s.floors,
      })),
      filtered: filtered.map((s) => ({
        name: s.name,
        shopId: s.shopId,
        number: s.number,
        floors: s.floors,
      })),
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

  // マップ上をクリック/ドラッグで位置設定
  const handleMapClick = useCallback((x: number, y: number) => {
    if (!selectedShopId) {
      console.log("ShopPositionSettingsTab - handleMapClick: selectedShopId is null");
      return;
    }

    // 相対座標を0～100に変換（0.1単位）
    const clampedX = clampPercent(x * 100);
    const clampedY = clampPercent(y * 100);

    console.log("ShopPositionSettingsTab - handleMapClick:", {
      selectedShopId,
      x: clampedX,
      y: clampedY,
      floor: selectedFloor,
    });

    updateShopPosition(selectedShopId, {
      x: clampedX,
      y: clampedY,
      floor: selectedFloor,
    });
  }, [selectedShopId, selectedFloor, updateShopPosition]);

  // 親コンポーネントにselectedShopIdとhandleMapClickを通知
  useEffect(() => {
    if (onSelectedShopIdChange) {
      onSelectedShopIdChange(selectedShopId);
    }
  }, [selectedShopId, onSelectedShopIdChange]);

  useEffect(() => {
    if (onMapClickHandlerChange) {
      onMapClickHandlerChange(handleMapClick);
    }
  }, [handleMapClick, onMapClickHandlerChange]);

  const selectedShop = selectedShopId
    ? shops.find((s) => (s.shopId || s.number) === selectedShopId)
    : null;

  // 選択中のショップの位置情報を取得（未設定の場合は中央をデフォルトとして使用）
  const selectedShopPosition = selectedShopId
    ? shopPositions.positions[selectedShopId] || {
        x: 50.0,
        y: 50.0,
        floor: selectedFloor,
      }
    : null;

  const mapImage = getMapImage(selectedFloor);

  // デバッグ用ログ
  useEffect(() => {
    console.log("ShopPositionSettingsTab - shops:", {
      shopsCount: shops.length,
      shops: shops.map((s) => ({
        name: s.name,
        shopId: s.shopId,
        number: s.number,
        floors: s.floors,
      })),
    });
  }, [shops]);

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
        ショップ位置設定
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
              
              // ショップを選択したときに、位置が未設定の場合は中央（50.0, 50.0）をデフォルトとして設定
              if (newShopId && !shopPositions.positions[newShopId]) {
                updateShopPosition(newShopId, {
                  x: 50.0,
                  y: 50.0,
                  floor: selectedFloor,
                });
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

        {/* Position Inputs */}
        {selectedShopId && (
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
              位置調整
            </legend>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    marginBottom: 6,
                    color: "rgba(255,255,255,0.7)",
                    fontWeight: 500,
                  }}
                >
                  X位置 (0.0〜100.0)
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedShopPosition?.x ?? 50.0}
                    onChange={(e) =>
                      updateShopPosition(selectedShopId, {
                        x: clampPercent(Number(e.target.value)),
                        y: selectedShopPosition?.y ?? 50.0,
                        floor: selectedShopPosition?.floor ?? selectedFloor,
                      })
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
                    value={selectedShopPosition?.x ?? 50.0}
                    onChange={(e) =>
                      updateShopPosition(selectedShopId, {
                        x: clampPercent(Number(e.target.value)),
                        y: selectedShopPosition?.y ?? 50.0,
                        floor: selectedShopPosition?.floor ?? selectedFloor,
                      })
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
                <div
                  style={{
                    fontSize: 12,
                    marginBottom: 6,
                    color: "rgba(255,255,255,0.7)",
                    fontWeight: 500,
                  }}
                >
                  Y位置 (0.0〜100.0)
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={selectedShopPosition?.y ?? 50.0}
                    onChange={(e) =>
                      updateShopPosition(selectedShopId, {
                        x: selectedShopPosition?.x ?? 50.0,
                        y: clampPercent(Number(e.target.value)),
                        floor: selectedShopPosition?.floor ?? selectedFloor,
                      })
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
                    value={selectedShopPosition?.y ?? 50.0}
                    onChange={(e) =>
                      updateShopPosition(selectedShopId, {
                        x: selectedShopPosition?.x ?? 50.0,
                        y: clampPercent(Number(e.target.value)),
                        floor: selectedShopPosition?.floor ?? selectedFloor,
                      })
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
          </fieldset>
        )}

        {/* Instructions */}
        <div
          style={{
            padding: 12,
            backgroundColor: "rgba(0, 122, 255, 0.1)",
            border: "1px solid rgba(0, 122, 255, 0.3)",
            borderRadius: 8,
            fontSize: 12,
            color: "rgba(255, 255, 255, 0.8)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            使い方:
          </div>
          <div>
            1. フロアとショップを選択
            <br />
            2. プレビューエリアのマップ上をクリックして位置を設定
            <br />
            3. スライダーまたは数値入力で微調整
          </div>
        </div>
      </div>
    </div>
  );
};

