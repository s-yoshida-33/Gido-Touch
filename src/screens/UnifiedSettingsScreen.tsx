// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import GidoApp from "./GidoApp";
import type { LocationIconSettings } from "../types/locationIcon";
import type { FloorId, FloorLayout } from "../types/floorLayout";
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

type TabType = "location" | "image" | "shopPosition";

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

// ShopPositionPreview コンポーネントの修正版
// UnifiedSettingsScreen.tsx の該当部分を以下に置き換えてください

const ShopPositionPreview: React.FC<{
  floor: FloorId;
  shopPositions: ShopPositionSettings;
  shops: Shop[];
  selectedShopId: string | null;
  transformState?: {
    scale: number;
    positionX: number;
    positionY: number;
  };
}> = ({ floor, shopPositions, shops, selectedShopId, transformState }) => {
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
        
        // TransformWrapperのスケールを考慮しない、元の画像サイズ
        // object-fit: containなので、アスペクト比を保って収まるサイズ
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        
        // 画像の実際のレンダリングサイズを計算
        // TransformWrapperのスケールを除外した元のサイズ
        const scale = transformState?.scale || 1;
        const displayWidth = imgRect.width / scale;
        const displayHeight = imgRect.height / scale;
        
        // 画像の表示位置（コンテナからの相対位置）
        // TransformWrapperによる移動も考慮
        const offsetX = (imgRect.left - containerRect.left) / scale;
        const offsetY = (imgRect.top - containerRect.top) / scale;

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
      setTimeout(updateImageInfo, 100);
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

    // TransformWrapperの状態変更時にも再計算（ズームやパンによる画像位置の変化を検知）
    if (transformState) {
      updateImageInfo();
    }

    return () => {
      if (imageRef.current) {
        imageRef.current.removeEventListener("load", handleImageLoad);
      }
      window.removeEventListener("resize", updateImageInfo);
      resizeObserver.disconnect();
    };
  }, [mapImage, transformState]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "visible",
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
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
        }}
      />
      {/* ショップ位置ピン - マップ画像の表示サイズを基準に絶対ピクセル座標で配置 */}
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

          // マップ画像の表示サイズを基準に絶対ピクセル座標を計算
          const xPercent = normalizedPosition.x / 100;
          const yPercent = normalizedPosition.y / 100;
          
          // ピンの位置を計算（TransformWrapperのスケールを考慮）
          const scale = transformState?.scale || 1;
          
          // 画像内での位置（スケール前の座標）
          const xInImage = xPercent * imageInfo.displayWidth;
          const yInImage = yPercent * imageInfo.displayHeight;
          
          // コンテナ内での絶対座標（スケールとオフセットを適用）
          const pixelX = (imageInfo.offsetX + xInImage) * scale;
          const pixelY = (imageInfo.offsetY + yInImage) * scale;

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
              transformScale={scale} // スケール値を渡す
            />
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
  const [activeTab, setActiveTab] = useState<TabType>("location");
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
    state: {
      scale: number;
      positionX: number;
      positionY: number;
    };
  } | null>(null);
  
  // Container ref for calculating center position
  const previewContainerRef = useRef<HTMLDivElement>(null);
  
  // Current scale state to control panning (詳細モーダルと同じ仕様)
  const [currentScale, setCurrentScale] = useState(1);
  
  // Transform state for ShopPositionPreview (ズームやパンの状態をピン位置計算に反映)
  const [transformState, setTransformState] = useState<{
    scale: number;
    positionX: number;
    positionY: number;
  } | undefined>(undefined);
  
  // 中央位置を計算する関数
  // マップ画像を左上に配置した状態で、マップ画像の中央がビューポートの中央に来るように位置を計算
  const calculateCenterPosition = useCallback(() => {
    if (!previewContainerRef.current) return { x: 0, y: 0, scale: 1.0 };
    
    const containerRect = previewContainerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // ショップ位置タブのコンテンツサイズ（1700×1580）
    const contentWidth = 1700;
    const contentHeight = 1580;
    
    // 初期スケールを100%（1.0）に設定
    const newScale = 1.0;
    
    // ビューポートの中央位置
    const viewportCenterX = containerWidth / 2;
    const viewportCenterY = containerHeight / 2;
    
    // マップ画像の中央がビューポート中央に来るように移動させるための位置 (x, y)
    // 必要な移動量 = ビューポート中央 - (マップ中央 * スケール)
    const centerX = viewportCenterX - (contentWidth / 2) * newScale;
    const centerY = viewportCenterY - (contentHeight / 2) * newScale;
    
    return { x: centerX, y: centerY, scale: newScale };
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
        setActiveTab("location");
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
      // Reset to initial scale (1.0) and center position
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
            overflow: "visible",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "visible",
            }}
          >
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={4}
              limitToBounds={currentScale > 1}
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
                setCurrentScale(ref.state.scale);
                setTransformState({
                  scale: ref.state.scale,
                  positionX: ref.state.positionX,
                  positionY: ref.state.positionY,
                });
              }}
              onTransformed={(ref) => {
                setCurrentScale(ref.state.scale);
                setTransformState({
                  scale: ref.state.scale,
                  positionX: ref.state.positionX,
                  positionY: ref.state.positionY,
                });
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
                      width: "100%",
                      height: "100%",
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
                  transformState={transformState}
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