// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import GidoApp from "./GidoApp";
import type { LocationIconSettings } from "../types/locationIcon";
import type { FloorId, FloorLayout } from "../types/floorLayout";
import { FloorSettingsTab } from "../components/FloorSettingsTab";
import { LocationSettingsTab } from "../components/LocationSettingsTab";
import { ImageSettingsTab } from "../components/ImageSettingsTab";
import { ShopPositionSettingsTab } from "../components/ShopPositionSettingsTab";
import { ShopPin } from "../components/ShopPin";
import iconSvg from "../assets/icon.svg";
import type { ImageSettings } from "../types/imageSettings";
import type { ShopPositionSettings } from "../types/shopPosition";
import type { Shop } from "../types/shop";
import food1FMap from "../assets/food-1F-map.svg";
import food2FMap from "../assets/food-2F-map.svg";
import food3FMap from "../assets/food-3F-map.svg";
import food4FMap from "../assets/food-4F-map.svg";

type TabType = "floor" | "location" | "image" | "shopPosition";

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

const ShopPositionPreview: React.FC<{
  floor: FloorId;
  shopPositions: ShopPositionSettings;
  shops: Shop[];
  selectedShopId: string | null;
}> = ({ floor, shopPositions, shops, selectedShopId }) => {
  // 安全に値を取得
  const safeShopPositions = shopPositions || { positions: {} };
  const safeShops = shops || [];
  const mapImage = getMapImage(floor);
  const normalizedFloor = normalizeFloor(floor);

  // 安全にpositionsを取得
  const positions = safeShopPositions.positions || {};

  // マップ画像の自然なサイズと実際の表示サイズを取得するためのref
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const [imageInfo, setImageInfo] = React.useState<{ 
    naturalWidth: number; 
    naturalHeight: number; 
    displayWidth: number; 
    displayHeight: number; 
    offsetX: number; 
    offsetY: number;
    containerWidth: number;
    containerHeight: number;
  } | null>(null);

  // 画像の読み込みとリサイズ時に実際の表示サイズを計算
  React.useEffect(() => {
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
        
        // コンテナの実際のサイズ（TransformComponentのスケールやパンの影響を受けたサイズ）
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
  }, [mapImage]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      <img
        ref={imageRef}
        src={mapImage}
        alt={`${normalizedFloor} map`}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
      {/* ショップ位置ピン */}
      {imageInfo && Object.entries(positions)
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

          // コンテナの実際のサイズを使用（TransformComponentのスケールやパンの影響を受けたサイズ）
          const containerWidth = imageInfo.containerWidth;
          const containerHeight = imageInfo.containerHeight;
          
          // マップ画像の自然なサイズに対する相対座標（0-100%）を、実際の表示サイズに変換
          // 位置はマップ画像の自然なサイズに対する相対座標として保存されている
          const xPercent = normalizedPosition.x / 100;
          const yPercent = normalizedPosition.y / 100;
          
          // マップ画像の自然なサイズ内での位置
          // X/Y=100のときは、マップ画像の右下角（naturalWidth, naturalHeight）を指す
          const xInNaturalImage = xPercent * imageInfo.naturalWidth;
          const yInNaturalImage = yPercent * imageInfo.naturalHeight;
          
          // 実際の表示サイズにスケール
          const scaleX = imageInfo.displayWidth / imageInfo.naturalWidth;
          const scaleY = imageInfo.displayHeight / imageInfo.naturalHeight;
          const xInDisplayImage = xInNaturalImage * scaleX;
          const yInDisplayImage = yInNaturalImage * scaleY;
          
          // コンテナ内での位置（オフセットを加算）
          // X/Y=100のときは、マップ画像の表示領域の右下角に来る
          const xInContainer = imageInfo.offsetX + xInDisplayImage;
          const yInContainer = imageInfo.offsetY + yInDisplayImage;
          
          // パーセンテージに変換
          // コンテナの実際のサイズに対する相対位置として計算
          const xPercentInContainer = (xInContainer / containerWidth) * 100;
          const yPercentInContainer = (yInContainer / containerHeight) * 100;

          return (
            <div key={shopId} style={{ pointerEvents: "none" }}>
              <ShopPin
                position={{
                  ...normalizedPosition,
                  x: xPercentInContainer,
                  y: yPercentInContainer,
                }}
                shopName={shop.name}
                isSelected={selectedShopId === shopId}
                shopLogo={shop.shopLogo}
                shopId={shop.shopId || shop.number}
              />
            </div>
          );
        })}
    </div>
  );
};

interface UnifiedSettingsScreenProps {
  floor: FloorId;
  onSaveFloor: (floor: FloorId) => Promise<void> | void;
  floorLayout: FloorLayout;
  locationIconSettings: LocationIconSettings;
  onSaveLocationIconSettings: (settings: LocationIconSettings) => Promise<void> | void;
  imageSettings: ImageSettings;
  onSaveImageSettings: (settings: ImageSettings) => Promise<void> | void;
  shopPositions: ShopPositionSettings;
  onSaveShopPositions: (settings: ShopPositionSettings) => Promise<void> | void;
  shops: Shop[];
}

const UnifiedSettingsScreen: React.FC<UnifiedSettingsScreenProps> = ({
  floor: initialFloor,
  onSaveFloor,
  floorLayout,
  locationIconSettings: initialLocationIconSettings,
  onSaveLocationIconSettings,
  imageSettings: initialImageSettings,
  onSaveImageSettings,
  shopPositions: initialShopPositions,
  onSaveShopPositions,
  shops,
}) => {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("floor");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local state for editing (preserved when switching tabs)
  const [floor, setFloor] = useState<FloorId>(initialFloor);
  const [locationIconSettings, setLocationIconSettings] =
    useState<LocationIconSettings>(initialLocationIconSettings);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(initialImageSettings);
  const [shopPositions, setShopPositions] = useState<ShopPositionSettings>(initialShopPositions);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // Transform wrapper ref for programmatic control
  const transformRef = useRef<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetTransform: () => void;
    setTransform: (x: number, y: number, scale: number) => void;
    centerView: (scale?: number) => void;
  } | null>(null);
  
  // Container ref for calculating center position
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // 中央位置を計算する関数
  // 1700×1580のコンテンツ自体を中央に配置する
  const calculateCenterPosition = useCallback(() => {
    if (!previewContainerRef.current) return { x: 0, y: 0, scale: 0.6 };
    
    const containerRect = previewContainerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // ショップ位置タブのコンテンツサイズ（1700×1580）
    const contentWidth = 1700;
    const contentHeight = 1580;
    const scale = 0.6;
    
    // スケール後のコンテンツサイズ
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;
    
    // 1700×1580のコンテンツの中央をビューポートの中央に配置するための左上角の位置
    const centerX = (containerWidth - scaledWidth) / 2;
    const centerY = (containerHeight - scaledHeight) / 2;
    
    return { x: centerX, y: centerY, scale };
  }, []);

  // 他のタブ（3840×2160）の中央位置を計算する関数
  const calculateOtherTabCenterPosition = useCallback(() => {
    if (!previewContainerRef.current) return { x: 0, y: 0, scale: 0.6 };
    
    const containerRect = previewContainerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const contentWidth = window.screen.width >= 3840 ? 3840 : 1920;
    const contentHeight = window.screen.height >= 2160 ? 2160 : 1080;
    const scale = 0.6;
    const scaledWidth = contentWidth * scale;
    const scaledHeight = contentHeight * scale;
    
    const centerX = (containerWidth - scaledWidth) / 2;
    const centerY = (containerHeight - scaledHeight) / 2;
    
    return { x: centerX, y: centerY, scale };
  }, []);

  // アクティブなタブに応じて中央位置を計算する関数
  const calculateCenterPositionForActiveTab = useCallback(() => {
    if (activeTab === "shopPosition") {
      return calculateCenterPosition();
    } else {
      return calculateOtherTabCenterPosition();
    }
  }, [activeTab, calculateCenterPosition, calculateOtherTabCenterPosition]);

  // ショップ位置タブが選択されたときに中央に配置（アニメーションなし）
  useLayoutEffect(() => {
    if (activeTab === "shopPosition" && transformRef.current && previewContainerRef.current) {
      // レイアウト確定後に中央に配置
      const timer = setTimeout(() => {
        if (transformRef.current && previewContainerRef.current) {
          const { x, y, scale } = calculateCenterPosition();
          // アニメーションなしで直接位置を設定
          transformRef.current.setTransform(x, y, scale);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, calculateCenterPosition]);
  
  // TransformWrapperが初期化されたときに中央に配置
  useEffect(() => {
    if (activeTab === "shopPosition" && transformRef.current && previewContainerRef.current) {
      // 少し遅延させてから中央に配置（TransformWrapperの初期化を待つ）
      const timer = setTimeout(() => {
        if (transformRef.current && previewContainerRef.current) {
          const { x, y, scale } = calculateCenterPosition();
          // アニメーションなしで直接位置を設定
          transformRef.current.setTransform(x, y, scale);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab, calculateCenterPosition]);

  // Load initial values when screen opens
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenSettings) {
      unsubscribe = window.electronAPI.onOpenSettings(() => {
        setVisible(true);
        setActiveTab("floor");
        setFloor(initialFloor);
        setLocationIconSettings(initialLocationIconSettings);
        setImageSettings(initialImageSettings);
        setShopPositions(initialShopPositions);
        setErrors({});
        // Reset transform when opening settings
        // 設定画面を開くときは"floor"タブが選択されるので、3840×2160のコンテンツを中央に配置
        if (transformRef.current && previewContainerRef.current) {
          requestAnimationFrame(() => {
            if (transformRef.current && previewContainerRef.current) {
              const { x, y, scale } = calculateOtherTabCenterPosition();
              transformRef.current.setTransform(x, y, scale);
            }
          });
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialFloor, initialLocationIconSettings, initialImageSettings, initialShopPositions, calculateOtherTabCenterPosition]);

  // Sync with external changes when screen is closed
  useEffect(() => {
    if (!visible) {
      setFloor(initialFloor);
      setLocationIconSettings(initialLocationIconSettings);
      setImageSettings(initialImageSettings);
      setShopPositions(initialShopPositions);
    }
  }, [visible, initialFloor, initialLocationIconSettings, initialImageSettings, initialShopPositions]);

  const handleClose = () => {
    setVisible(false);
    setErrors({});
  };

  const handleCancel = () => {
    // Revert to initial values
    setFloor(initialFloor);
    setLocationIconSettings(initialLocationIconSettings);
    setImageSettings(initialImageSettings);
    setShopPositions(initialShopPositions);
    setErrors({});
    // Reset transform - 現在のactiveTabに応じて適切な中央位置を計算
    if (transformRef.current && previewContainerRef.current) {
      requestAnimationFrame(() => {
        if (transformRef.current && previewContainerRef.current) {
          const { x, y, scale } = calculateCenterPositionForActiveTab();
          transformRef.current.setTransform(x, y, scale);
        }
      });
    }
    handleClose();
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === "location") {
      // Validate location icon settings
      if (locationIconSettings.speechBubble.size <= 0 || locationIconSettings.speechBubble.size > 512) {
        newErrors["location.speechBubble.size"] = "サイズは1〜512の範囲で入力してください";
      }
      if (locationIconSettings.location.size <= 0 || locationIconSettings.location.size > 512) {
        newErrors["location.location.size"] = "サイズは1〜512の範囲で入力してください";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    try {
      setSaving(true);
      await Promise.all([
        onSaveFloor(floor),
        onSaveLocationIconSettings(locationIconSettings),
        onSaveImageSettings(imageSettings),
        onSaveShopPositions(shopPositions),
      ]);
      handleClose();
    } catch (e) {
      console.error("Failed to save settings", e);
      setErrors({ save: "設定の保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };


  // Zoom buttons using library methods
  const handleZoomIn = () => {
    if (transformRef.current) {
      transformRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (transformRef.current) {
      transformRef.current.zoomOut();
    }
  };

  const handleReset = () => {
    if (transformRef.current && previewContainerRef.current) {
      // Reset to initial scale (0.6) and center position
      const { x, y, scale } = calculateCenterPositionForActiveTab();
      transformRef.current.setTransform(x, y, scale);
    }
  };


  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#1C1C1C",
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
      }}
    >
      {/* Header (4%) */}
      <div
        style={{
          height: "4%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          gap: 12,
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Logo and App Name */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img
            src={iconSvg}
            alt="Gido Touch"
            style={{
              width: 24,
              height: 24,
            }}
          />
          <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 600 }}>
            Gido Touch
          </span>
        </div>

        {/* Error Message */}
        {errors.save && (
          <span style={{ color: "#ff4444", fontSize: 14 }}>
            {errors.save}
          </span>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          <button
          onClick={handleCancel}
          disabled={saving}
          style={{
            padding: "8px 24px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
        >
          キャンセル
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "8px 24px",
            backgroundColor: "#007aff",
            border: "none",
            borderRadius: 6,
            color: "#ffffff",
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "保存中..." : "保存"}
        </button>
        </div>
      </div>

      {/* Main Area (96%) */}
      <div
        style={{
          height: "96%",
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Left Sidebar (13%) */}
        <div
          style={{
            width: "13%",
            backgroundColor: "#2C2C2C",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Tabs */}
          <div style={{ flex: 1, padding: "16px 0" }}>
            {[
              { id: "floor" as TabType, label: "フロア" },
              { id: "location" as TabType, label: "現在地" },
              { id: "image" as TabType, label: "画像" },
              { id: "shopPosition" as TabType, label: "ショップ位置" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: "100%",
                  padding: "16px 24px",
                  backgroundColor:
                    activeTab === tab.id ? "#007aff" : "transparent",
                  border: "none",
                  color: "#ffffff",
                  fontSize: 15,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Center Preview (72%) */}
        <div
          ref={previewContainerRef}
          style={{
            width: "72%",
            backgroundColor: "#1C1C1C",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <TransformWrapper
              initialScale={0.6}
              minScale={0.6}
              maxScale={1.5}
              limitToBounds={false}
              centerOnInit={false}
              wheel={{
                step: 0.05,
              }}
              doubleClick={{
                disabled: true,
              }}
              panning={{
                disabled: false,
              }}
              onInit={(ref) => {
                transformRef.current = ref;
              }}
            >
            <TransformComponent
              wrapperStyle={{
                width: "100%",
                height: "100%",
              }}
              contentStyle={
                activeTab === "shopPosition"
                  ? {
                      width: "1700px",
                      height: "1580px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }
                  : {
                      width: `${window.screen.width >= 3840 ? 3840 : 1920}px`,
                      height: `${window.screen.height >= 2160 ? 2160 : 1080}px`,
                    }
              }
            >
              {activeTab === "shopPosition" ? (
                <ShopPositionPreview
                  floor={floor}
                  shopPositions={shopPositions}
                  shops={shops}
                  selectedShopId={selectedShopId}
                />
              ) : (
                <GidoApp
                  locationIconSettings={locationIconSettings}
                  previewFloor={floor}
                  previewFloorLayout={floorLayout}
                  imageSettings={imageSettings}
                />
              )}
            </TransformComponent>
          </TransformWrapper>
          </div>

          {/* Zoom Controls */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 24,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <button
              onClick={handleZoomIn}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              +
            </button>
            <button
              onClick={handleZoomOut}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              −
            </button>
            <button
              onClick={handleReset}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
                fontSize: 18,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ↻
            </button>
          </div>
        </div>

        {/* Right Edit Panel (15%) */}
        <div
          style={{
            width: "15%",
            backgroundColor: "#2C2C2C",
            borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {activeTab === "floor" && (
            <FloorSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
            />
          )}
          {activeTab === "location" && (
            <LocationSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              locationIconSettings={locationIconSettings}
              onChangeLocationIconSettings={setLocationIconSettings}
            />
          )}
          {activeTab === "image" && (
            <ImageSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              imageSettings={imageSettings}
              onChangeImageSettings={setImageSettings}
            />
          )}
          {activeTab === "shopPosition" && (
            <ShopPositionSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              shopPositions={shopPositions}
              onChangeShopPositions={setShopPositions}
              shops={shops}
              onSelectedShopIdChange={setSelectedShopId}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedSettingsScreen;