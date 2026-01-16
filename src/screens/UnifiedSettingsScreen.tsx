// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import GidoApp from "./GidoApp";
import type { LocationIconSettingsPerFloor } from "../types/locationIcon";
import { getLocationIconSettingsForFloor, DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR } from "../config";
import type { FloorId, FloorLayout } from "../types/floorLayout";
import { ImageSettingsTab } from "../components/ImageSettingsTab";
import { ShopPositionSettingsTab } from "../components/ShopPositionSettingsTab";
import { CurrentFloorSettingsTab } from "../components/CurrentFloorSettingsTab";
import { LocalMediaSettingsTab } from "../components/LocalMediaSettingsTab";
import { GenreSettingsTab } from "../components/GenreSettingsTab";
import iconSvg from "../assets/icon.svg";
import type { ImageSettings } from "../types/imageSettings";
import type { ShopPositionSettings } from "../types/shopPosition";
import type { Shop } from "../types/shop";
import type { LocalMediaTextSettings } from "../types/global";
import type { GenreSettings } from "../types/genreSettings";
import { useAudioSettings } from "../hooks/useAudioSettings";
import type { MallId } from "../hooks/useMallAssets";
import { DEFAULT_IGNORED_GENRE_KEYWORDS } from "../utils/genreUtils";

type TabType = "image" | "shopPosition" | "floorSettings" | "localMedia" | "genre";

interface UnifiedSettingsScreenProps {
  floor: FloorId;
  onSaveFloor: (floor: FloorId) => Promise<void> | void;
  floorLayout: FloorLayout;
  locationIconSettings: LocationIconSettingsPerFloor;
  onSaveLocationIconSettings: (settings: LocationIconSettingsPerFloor) => Promise<void> | void;
  imageSettings: ImageSettings;
  onSaveImageSettings: (settings: ImageSettings) => Promise<void> | void;
  shopPositions: ShopPositionSettings;
  onSaveShopPositions: (settings: ShopPositionSettings) => Promise<void> | void;
  shops: Shop[];
  currentFloorSetting: string;
  onSaveCurrentFloorSetting: (floor: string) => void;
  localMediaTextSettings: LocalMediaTextSettings;
  onSaveLocalMediaTextSettings: (settings: LocalMediaTextSettings) => Promise<void> | void;
  genreSettings: GenreSettings;
  onSaveGenreSettings: (settings: GenreSettings) => Promise<void> | void;
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
  currentFloorSetting: initialCurrentFloorSetting,
  onSaveCurrentFloorSetting,
  localMediaTextSettings: initialLocalMediaTextSettings,
  onSaveLocalMediaTextSettings,
  genreSettings: initialGenreSettings,
  onSaveGenreSettings,
}) => {
  const [visible, setVisible] = useState(false);
  
  // Notify main process about visibility to pause focus watchdog
  useEffect(() => {
    if (window.electronAPI?.setSettingsVisibility) {
      window.electronAPI.setSettingsVisibility(visible);
    }
  }, [visible]);

  const [activeTab, setActiveTab] = useState<TabType>("image");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local state for editing (preserved when switching tabs)
  const [floor, setFloor] = useState<FloorId>(initialFloor);
  const [locationIconSettings, setLocationIconSettings] =
    useState<LocationIconSettingsPerFloor>(initialLocationIconSettings || DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(initialImageSettings);
  const [shopPositions, setShopPositions] = useState<ShopPositionSettings>(initialShopPositions);
  const [currentFloorSetting, setCurrentFloorSetting] = useState<string>(initialCurrentFloorSetting);
  const [displayFloors, setDisplayFloors] = useState<string[]>(['1F', '2F', '3F', '4F']); // Default all
  const [localMediaTextSettings, setLocalMediaTextSettings] = useState<LocalMediaTextSettings>(initialLocalMediaTextSettings || {});
  const [genreSettings, setGenreSettings] = useState<GenreSettings>(initialGenreSettings || { ignoredKeywords: DEFAULT_IGNORED_GENRE_KEYWORDS, maxItems: 3 });
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // Mall settings
  const [mallId, setMallId] = useState<MallId>('suzaka');
  // Load mall setting from electron
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getMallId().then((id) => setMallId(id as MallId));
    }
  }, [visible]);

  // Audio settings
  const { settings: audioSettings, saveSettings: saveAudioSettings, isLoading: isAudioSettingsLoading } = useAudioSettings();
  const [currentAudioSettings, setCurrentAudioSettings] = useState(audioSettings);

  // Sync with loaded audio settings
  useEffect(() => {
    if (!isAudioSettingsLoading) {
      setCurrentAudioSettings(audioSettings);
    }
  }, [audioSettings, isAudioSettingsLoading]);

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
  
  // 中央位置を計算する関数（すべてのタブで同じロジックを使用）
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
    return calculateOtherTabCenterPosition();
  }, [calculateOtherTabCenterPosition]);


  // Load initial values when screen opens
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenSettings) {
      unsubscribe = window.electronAPI.onOpenSettings(() => {
        setVisible(true);
        setActiveTab("image");
        setFloor(initialFloor);
        setLocationIconSettings(initialLocationIconSettings);
        setImageSettings(initialImageSettings);
        setShopPositions(initialShopPositions);
        setCurrentFloorSetting(initialCurrentFloorSetting);
        setLocalMediaTextSettings(initialLocalMediaTextSettings || {});
        setGenreSettings(initialGenreSettings || { ignoredKeywords: DEFAULT_IGNORED_GENRE_KEYWORDS, maxItems: 3 });
        
        // Load display floors
        if (window.electronAPI?.getDisplayFloors) {
            window.electronAPI.getDisplayFloors().then(setDisplayFloors);
        }

        // Note: Audio settings are handled by the hook
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
  }, [initialFloor, initialLocationIconSettings, initialImageSettings, initialShopPositions, initialCurrentFloorSetting, initialLocalMediaTextSettings, calculateOtherTabCenterPosition]);

  // Sync with external changes when screen is closed
  useEffect(() => {
    if (!visible) {
      setFloor(initialFloor);
      setLocationIconSettings(initialLocationIconSettings);
      setImageSettings(initialImageSettings);
      setShopPositions(initialShopPositions);
      setCurrentFloorSetting(initialCurrentFloorSetting);
      setLocalMediaTextSettings(initialLocalMediaTextSettings || {});
      setGenreSettings(initialGenreSettings || { ignoredKeywords: DEFAULT_IGNORED_GENRE_KEYWORDS, maxItems: 3 });
      setCurrentAudioSettings(audioSettings);
    }
  }, [visible, initialFloor, initialLocationIconSettings, initialImageSettings, initialShopPositions, initialCurrentFloorSetting, initialLocalMediaTextSettings, initialGenreSettings, audioSettings]);

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
    setCurrentFloorSetting(initialCurrentFloorSetting);
      setLocalMediaTextSettings(initialLocalMediaTextSettings || {});
      setGenreSettings(initialGenreSettings || { ignoredKeywords: DEFAULT_IGNORED_GENRE_KEYWORDS, maxItems: 3 });
      setCurrentAudioSettings(audioSettings);
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) {
      return;
    }

    try {
      setSaving(true);
      
      // Save Mall ID first
      if (window.electronAPI) {
        await window.electronAPI.saveMallId(mallId);
      }

      await Promise.all([
        onSaveFloor(floor),
        onSaveLocationIconSettings(locationIconSettings),
        onSaveImageSettings(imageSettings),
        onSaveShopPositions(shopPositions),
        onSaveLocalMediaTextSettings(localMediaTextSettings),
        onSaveGenreSettings(genreSettings),
        saveAudioSettings(currentAudioSettings),
      ]);
      // currentFloorSettingの保存は同期的に行われる（App.tsx内でstate更新）が、
      // Electronへの保存も確実に行われるように呼び出す。
      // onSaveCurrentFloorSetting自体はvoidを返すが、内部でIPCを呼ぶ。
      onSaveCurrentFloorSetting(currentFloorSetting);
      
      if (window.electronAPI?.saveDisplayFloors) {
        await window.electronAPI.saveDisplayFloors(displayFloors);
      }
      
      handleClose();
    } catch (e) {
      console.error("Failed to save settings", e);
      setErrors({ save: "設定の保存に失敗しました" });
    } finally {
      setSaving(false);
    }
  };

  const handleExportDefaults = async () => {
    if (!window.electronAPI?.exportCurrentSettingsAsDefault) return;
    
    try {
        const result = await window.electronAPI.exportCurrentSettingsAsDefault();
        if (result.success) {
            alert(`設定をデフォルトファイルとして書き出しました。\n${result.path}`);
        } else {
            alert(`書き出しに失敗しました: ${result.error}`);
        }
    } catch (e: any) {
        alert(`エラーが発生しました: ${e.message}`);
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
          
          {/* Mall Selection */}
          <div style={{ marginLeft: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#aaa', fontSize: 14 }}>モール設定:</span>
            <select
              value={mallId}
              onChange={(e) => setMallId(e.target.value as MallId)}
              style={{
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 14
              }}
            >
              <option value="suzaka">須坂 (ID: suzaka)</option>
              <option value="sendaikamisugi">仙台上杉 (ID: sendaikamisugi)</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {errors.save && (
          <span style={{ color: "#ff4444", fontSize: 14 }}>
            {errors.save}
          </span>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12 }}>
          {/* Dev Mode Export Button */}
          {import.meta.env.MODE === 'development' && window.electronAPI?.exportCurrentSettingsAsDefault && (
             <button
                onClick={handleExportDefaults}
                style={{
                    padding: "8px 16px",
                    backgroundColor: "#e67e22",
                    border: "none",
                    borderRadius: 6,
                    color: "#ffffff",
                    fontSize: 12,
                    cursor: "pointer",
                    marginRight: 12
                }}
             >
                現在の設定をデフォルトとして保存 (Dev)
             </button>
          )}

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
              { id: "image" as TabType, label: "画像" },
              { id: "shopPosition" as TabType, label: "座標設定" },
              { id: "floorSettings" as TabType, label: "フロア設定" },
              { id: "localMedia" as TabType, label: "ローカルメディア設定" },
              { id: "genre" as TabType, label: "ジャンルメモ設定" },
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
              }}
              onTransformed={(ref) => {
                setCurrentScale(ref.state.scale);
              }}
            >
            <TransformComponent
              wrapperStyle={{
                width: "100%",
                height: "100%",
              }}
              contentStyle={{
                width: `${window.screen.width >= 3840 ? 3840 : 1920}px`,
                height: `${window.screen.height >= 2160 ? 2160 : 1080}px`,
              }}
            >
              {activeTab === "shopPosition" && (
                <GidoApp
                  locationIconSettings={getLocationIconSettingsForFloor(locationIconSettings, floor)}
                  previewFloor={floor}
                  previewFloorLayout={floorLayout}
                  imageSettings={imageSettings}
                  shopPositions={activeTab === "shopPosition" ? shopPositions : undefined}
                  shops={activeTab === "shopPosition" ? shops : undefined}
                  selectedShopId={activeTab === "shopPosition" ? selectedShopId : undefined}
                  showOnlyMap={true}
                  currentFloorSetting={currentFloorSetting}
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
              locationIconSettings={locationIconSettings}
              onChangeLocationIconSettings={setLocationIconSettings}
            />
          )}
          {activeTab === "floorSettings" && (
            <CurrentFloorSettingsTab
              currentFloorSetting={currentFloorSetting}
              onChangeCurrentFloorSetting={setCurrentFloorSetting}
              displayFloors={displayFloors}
              onChangeDisplayFloors={setDisplayFloors}
            />
          )}
          {activeTab === "localMedia" && (
            <LocalMediaSettingsTab
              settings={localMediaTextSettings}
              onChangeSettings={setLocalMediaTextSettings}
              audioSettings={currentAudioSettings}
              onChangeAudioSettings={setCurrentAudioSettings}
              shops={shops}
            />
          )}
          {activeTab === "genre" && (
            <GenreSettingsTab
              settings={genreSettings}
              onChangeSettings={setGenreSettings}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedSettingsScreen;
