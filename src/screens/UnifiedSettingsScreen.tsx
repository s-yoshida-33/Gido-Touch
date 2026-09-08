// src/screens/UnifiedSettingsScreen.tsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { TransformComponent } from "react-zoom-pan-pinch";
import { PinchSafeTransformWrapper } from "../components/PinchSafeTransformWrapper";
import GidoApp from "./GidoApp";
import type { LocationIconSettingsPerFloor } from "../types/locationIcon";
import { getLocationIconSettingsForFloor, DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR } from "../config";
import type { FloorId, FloorLayout } from "../types/floorLayout";
import { ImageSettingsTab } from "../components/ImageSettingsTab";
import { ShopPositionSettingsTab } from "../components/ShopPositionSettingsTab";
import { CurrentFloorSettingsTab } from "../components/CurrentFloorSettingsTab";
import { LocalMediaSettingsTab } from "../components/LocalMediaSettingsTab";
import { GenreSettingsTab } from "../components/GenreSettingsTab";
import { BlackScreenSettingsTab } from "../components/BlackScreenSettingsTab";
import iconSvg from "../assets/icon.svg";
import type { ImageSettings } from "../types/imageSettings";
import type { ShopPositionSettings } from "../types/shopPosition";
import type { Shop } from "../types/shop";
import type { LocalMediaTextSettings } from "../types/global";
import type { GenreSettings } from "../types/genreSettings";
import type { BlackScreenSettings } from '../types/blackScreenSettings';
import { DEFAULT_BLACK_SCREEN_SETTINGS } from '../types/blackScreenSettings';
import { useAudioSettingsContext } from "../contexts/AudioSettingsContext";
import { useCmsSettings } from "../hooks/useCmsSettings";
import type { MallId } from "../hooks/useMallAssets";
import { useMall } from '../contexts/MallContext';
import { DEFAULT_IGNORED_GENRE_KEYWORDS, DEFAULT_CATEGORY_MAPPINGS } from "../utils/genreUtils";
import type { SubFloorSettings } from "../types/global";
import { loadGlobalSettings, saveGlobalSettings, cleanupOldHostnameMaps, loadMallSettings, saveMallSettings as saveMallSettingsToFile } from '../utils/settings';
import type { MallSettingsFile, GlobalSettings } from '../utils/settings';
import { invoke } from '@tauri-apps/api/core';
import { PictoSettingsTab } from '../components/PictoSettingsTab';
import type { PictoSettings } from '../types/picto';
import { DEFAULT_PICTO_SETTINGS } from '../types/picto';
import type { HalongBannerSettings } from '../types/bannerSettings';
import { DEFAULT_HALONG_BANNER_SETTINGS } from '../types/bannerSettings';
import { useHalongBanners } from '../hooks/useHalongBanners';
import { useHalongMaps } from '../hooks/useHalongMaps';
import { useHalongAssets } from '../hooks/useHalongAssets';
import { PictoPin } from '../components/PictoPin';
import { AnimatePresence } from 'framer-motion';

type TabType = "image" | "shopPosition" | "floorSettings" | "localMedia" | "genre" | "blackScreen" | "picto" | "dataSync";

interface UnifiedSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
  onSave: (settings: MallSettingsFile, mallId: MallId) => void;
  floor: FloorId;
  floorLayout: FloorLayout;
  locationIconSettings: LocationIconSettingsPerFloor;
  imageSettings: ImageSettings;
  shopPositions: ShopPositionSettings;
  shops: Shop[];
  currentFloorSetting: string;
  localMediaTextSettings: LocalMediaTextSettings;
  genreSettings: GenreSettings;
  subFloorSettings: SubFloorSettings;
}

const UnifiedSettingsScreen: React.FC<UnifiedSettingsScreenProps> = ({
  visible,
  onClose,
  onSave,
  floor: initialFloor,
  floorLayout: initialFloorLayout,
  locationIconSettings: initialLocationIconSettings,
  imageSettings: initialImageSettings,
  shopPositions: initialShopPositions,
  shops,
  currentFloorSetting: initialCurrentFloorSetting,
  localMediaTextSettings: initialLocalMediaTextSettings,
  genreSettings: initialGenreSettings,
  subFloorSettings: initialSubFloorSettings,
}) => {
  // Notify parent about visibility (no longer needed with Tauri - no separate window)
  // Settings visibility is managed by React state in parent

  const [activeTab, setActiveTab] = useState<TabType>("image");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Local state for editing (preserved when switching tabs)
  const [floor, setFloor] = useState<FloorId>(initialFloor);
  const [floorLayout, setFloorLayout] = useState<FloorLayout>(initialFloorLayout);
  const [locationIconSettings, setLocationIconSettings] =
    useState<LocationIconSettingsPerFloor>(initialLocationIconSettings || DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR);
  const [imageSettings, setImageSettings] = useState<ImageSettings>(initialImageSettings);
  const [shopPositions, setShopPositions] = useState<ShopPositionSettings>(initialShopPositions);
  const [currentFloorSetting, setCurrentFloorSetting] = useState<string>(initialCurrentFloorSetting);
  const [displayFloors, setDisplayFloors] = useState<string[]>(['1F', '2F', '3F', '4F']); // Default all
  const [localMediaTextSettings, setLocalMediaTextSettings] = useState<LocalMediaTextSettings>(initialLocalMediaTextSettings || {});
  const [genreSettings, setGenreSettings] = useState<GenreSettings>(initialGenreSettings || { ignoredKeywords: DEFAULT_IGNORED_GENRE_KEYWORDS, maxItems: 3, categoryMapping: DEFAULT_CATEGORY_MAPPINGS });
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [subFloorSettings, setSubFloorSettings] = useState<SubFloorSettings>(initialSubFloorSettings || { "1F-1": [], "1F-2": [] });
  const [pictoSettings, setPictoSettings] = useState<PictoSettings>(DEFAULT_PICTO_SETTINGS);
  const [selectedPictoId, setSelectedPictoId] = useState<string | null>(null);
  const [bannerSettings, setBannerSettings] = useState<HalongBannerSettings>(DEFAULT_HALONG_BANNER_SETTINGS);
  const [shopListLayout, setShopListLayout] = useState<'list' | 'grid'>('list');
  const { banners: availableBanners, reload: reloadBanners } = useHalongBanners();

  // Black screen settings
  const [blackScreenSettings, setBlackScreenSettings] = useState<BlackScreenSettings>(DEFAULT_BLACK_SCREEN_SETTINGS);

  // Operation mode (global settings)
  const [operationMode, setOperationMode] = useState<import('../utils/settings').OperationMode>('api');
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [onPrePollIntervalMinutes, setOnPrePollIntervalMinutes] = useState<number>(60);

  // Mall settings
  // Mall settings
  const { mallId: contextMallId, setMallId: setContextMallId, refreshAssets } = useMall();
  const [mallId, setMallIdLocal] = useState<MallId>(contextMallId);
  const [initialMallId, setInitialMallId] = useState<MallId>(contextMallId);

  // Local shop list for Halon local mode (overrides BG-sourced shops in coordinate settings)
  const [localHalongShops, setLocalHalongShops] = useState<Shop[] | null>(null);

  // Whether local per-language speech bubble assets (user-ja.svg etc.) exist for halong
  const [halongHasLocalSpeechBubbles, setHalongHasLocalSpeechBubbles] = useState(false);

  // Preview language override (only used when halong has local speech bubble assets)
  const [previewLanguage, setPreviewLanguage] = useState<'ja' | 'en' | 'vn'>('ja');

  useEffect(() => {
    if (mallId !== 'halong' || (operationMode !== 'local' && operationMode !== 'on-pre')) {
      setLocalHalongShops(null);
      return;
    }
    invoke<unknown>('load_local_shoplist', { mallId: 'halong' })
      .then((raw) => {
        if (!Array.isArray(raw)) { setLocalHalongShops([]); return; }
        const converted: Shop[] = (raw as Array<Record<string, string>>)
          .filter(e => e.closeFlg !== '1' && e.webStatus !== '0')
          .map(e => ({
            shopId: String(e.shopId),
            name: (e.shopNameJapan ?? '').trim() || e.shopName,
            genre: e.genre ?? '',
            genreMemo: '',
            number: e.number ?? '',
            floors: [(e.floorJapan ?? '').trim() || e.floor],
          }));
        setLocalHalongShops(converted);
      })
      .catch(() => setLocalHalongShops([]));
  }, [mallId, operationMode]);

  const shopsForSettings = useMemo(
    () => mallId === 'halong' && (operationMode === 'local' || operationMode === 'on-pre') && localHalongShops != null
      ? localHalongShops
      : shops,
    [mallId, operationMode, localHalongShops, shops],
  );

  // Halong map and asset hooks (used for picto tab preview)
  const halongMaps = useHalongMaps();
  const halongAssets = useHalongAssets();

  const pictoIconOptions = useMemo(() => [
    { fileName: 'atm.svg',              url: halongAssets.pictoMapIcons.atm },
    { fileName: 'elevator.svg',          url: halongAssets.pictoMapIcons.elevator },
    { fileName: 'free-coin-lockers.svg', url: halongAssets.pictoMapIcons.lockers },
    { fileName: 'info.svg',             url: halongAssets.pictoMapIcons.info },
    { fileName: 'restroom.svg',          url: halongAssets.pictoMapIcons.restroom },
    { fileName: 'smoking-room.svg',      url: halongAssets.pictoMapIcons.smoking },
  ], [halongAssets]);

  const PICTO_TAG_TO_ASSETS_KEY: Record<string, keyof typeof halongAssets.pictoMapIcons> = {
    info: 'info', restroom: 'restroom', smoking_room: 'smoking',
    free_coin_lockers: 'lockers', atm: 'atm', elevator: 'elevator',
  };

  // 座標未設定ショップ数（全ショップ対象）
  const unsetShopCount = useMemo(() => {
    return shopsForSettings.filter(shop => {
      const id = shop.shopId || shop.number;
      return id && !shopPositions.positions[id];
    }).length;
  }, [shopsForSettings, shopPositions]);

  // Hostname for S3 maps path
  const [hostname, setHostname] = useState<string>('');
  const [initialHostname, setInitialHostname] = useState<string>('');

  // Tracks whether maps were fetched from S3 in this settings session.
  // On save, floorMaps are cleared so Path B (disk) becomes the sole map source.
  const [mapsFetchedFromS3, setMapsFetchedFromS3] = useState(false);

  // Audio settings via shared context (enables instant propagation to video components)
  const { audioSettings, setAudioSettings: setContextAudioSettings, isLoading: isAudioSettingsLoading } = useAudioSettingsContext();
  const [currentAudioSettings, setCurrentAudioSettings] = useState(audioSettings);

  // CMS settings
  const { settings: cmsSettings, isLoading: isCmsSettingsLoading } = useCmsSettings();
  const [currentCmsSettings, setCurrentCmsSettings] = useState(cmsSettings);

  // Sync with loaded audio settings (only on first load)
  const audioInitialized = useRef(false);
  useEffect(() => {
    if (!isAudioSettingsLoading && !audioInitialized.current) {
      audioInitialized.current = true;
      setCurrentAudioSettings(audioSettings);
    }
  }, [audioSettings, isAudioSettingsLoading]);

  // Sync with loaded CMS settings (only on first load)
  const cmsInitialized = useRef(false);
  useEffect(() => {
    if (!isCmsSettingsLoading && !cmsInitialized.current) {
      cmsInitialized.current = true;
      setCurrentCmsSettings(cmsSettings);
    }
  }, [cmsSettings, isCmsSettingsLoading]);

  // Per-mall editing cache: stores unsaved settings for each mall during a settings session
  type MallEditingSnapshot = {
    floorLayout: FloorLayout;
    locationIconSettings: LocationIconSettingsPerFloor;
    imageSettings: ImageSettings;
    shopPositions: ShopPositionSettings;
    currentFloorSetting: string;
    displayFloors: string[];
    localMediaTextSettings: LocalMediaTextSettings;
    genreSettings: GenreSettings;
    subFloorSettings: SubFloorSettings;
    currentAudioSettings: any;
    currentCmsSettings: any;
    blackScreenSettings: BlackScreenSettings;
    pictoSettings: PictoSettings;
    bannerSettings: HalongBannerSettings;
    shopListLayout: 'list' | 'grid';
  };
  const mallEditingCache = useRef<Map<MallId, MallEditingSnapshot>>(new Map());

  // Capture current editing state into a snapshot
  const captureCurrentSnapshot = useCallback((): MallEditingSnapshot => ({
    floorLayout,
    locationIconSettings,
    imageSettings,
    shopPositions,
    currentFloorSetting,
    displayFloors,
    localMediaTextSettings,
    genreSettings,
    subFloorSettings,
    currentAudioSettings,
    currentCmsSettings,
    blackScreenSettings,
    pictoSettings,
    bannerSettings,
    shopListLayout,
  }), [floorLayout, locationIconSettings, imageSettings, shopPositions, currentFloorSetting, displayFloors, localMediaTextSettings, genreSettings, subFloorSettings, currentAudioSettings, currentCmsSettings, blackScreenSettings, pictoSettings, bannerSettings, shopListLayout]);

  // Apply a snapshot to all editing state
  const applySnapshot = useCallback((snap: MallEditingSnapshot) => {
    setFloorLayout(snap.floorLayout);
    setLocationIconSettings(snap.locationIconSettings);
    setImageSettings(snap.imageSettings);
    setShopPositions(snap.shopPositions);
    setCurrentFloorSetting(snap.currentFloorSetting);
    setDisplayFloors(snap.displayFloors);
    setLocalMediaTextSettings(snap.localMediaTextSettings);
    setGenreSettings(snap.genreSettings);
    setSubFloorSettings(snap.subFloorSettings);
    setCurrentAudioSettings(snap.currentAudioSettings);
    setCurrentCmsSettings(snap.currentCmsSettings);
    setBlackScreenSettings(snap.blackScreenSettings);
    setPictoSettings(snap.pictoSettings);
    setShopListLayout(snap.shopListLayout ?? 'list');
    setBannerSettings(snap.bannerSettings);
  }, []);

  // Apply MallSettingsFile loaded from disk to all editing state
  const applyMallSettingsFile = useCallback((mallSettings: MallSettingsFile) => {
    setFloorLayout(mallSettings.floorLayout || initialFloorLayout);
    setLocationIconSettings(mallSettings.locationIcons || initialLocationIconSettings || DEFAULT_LOCATION_ICON_SETTINGS_PER_FLOOR);
    setImageSettings(mallSettings.imageSettings || initialImageSettings);
    setShopPositions(mallSettings.shopPositions || { positions: {} });
    setCurrentFloorSetting(mallSettings.currentFloorSetting || '1F');
    setDisplayFloors(mallSettings.displayFloors || ['1F', '2F', '3F', '4F']);
    setLocalMediaTextSettings(mallSettings.localMediaTextSettings || {});
    setSubFloorSettings(mallSettings.subFloorSettings || { "1F-1": [], "1F-2": [] });
    setCurrentAudioSettings(mallSettings.audioSettings);
    setCurrentCmsSettings(mallSettings.cmsSettings);
    setBlackScreenSettings(mallSettings.blackScreenSettings || DEFAULT_BLACK_SCREEN_SETTINGS);
    setPictoSettings(mallSettings.pictoSettings ?? DEFAULT_PICTO_SETTINGS);
    setShopListLayout(mallSettings.shopListLayout ?? 'list');
    setBannerSettings(mallSettings.bannerSettings ?? DEFAULT_HALONG_BANNER_SETTINGS);

    // Genre settings with fallback
    const gs = mallSettings.genreSettings;
    const hasValidMapping = gs?.categoryMapping && Object.keys(gs.categoryMapping).length > 0;
    setGenreSettings(hasValidMapping ? gs : {
      ignoredKeywords: gs?.ignoredKeywords || DEFAULT_IGNORED_GENRE_KEYWORDS,
      maxItems: gs?.maxItems || 3,
      categoryMapping: DEFAULT_CATEGORY_MAPPINGS,
    });
  }, [initialFloorLayout, initialLocationIconSettings, initialImageSettings]);

  // Sync mall setting when settings screen opens (only on open transition)
  const prevVisibleForMallSync = useRef(false);
  useEffect(() => {
    if (visible && !prevVisibleForMallSync.current) {
      // Screen just opened: sync with context and clear cache
      setMallIdLocal(contextMallId);
      setInitialMallId(contextMallId);
      mallEditingCache.current.clear();
    }
    prevVisibleForMallSync.current = visible;
  }, [visible, contextMallId]);

  // Handle mall switch in dropdown: cache current edits, load target mall
  const handleMallSwitch = useCallback(async (targetMallId: MallId) => {
    if (targetMallId === mallId) return;

    // 1. Cache current editing state for the current mall
    mallEditingCache.current.set(mallId, captureCurrentSnapshot());

    // 2. Update mall ID (local + context for preview)
    setMallIdLocal(targetMallId);
    setContextMallId(targetMallId);

    // 3. Restore from cache if previously edited, otherwise load from file
    const cached = mallEditingCache.current.get(targetMallId);
    if (cached) {
      applySnapshot(cached);
    } else {
      try {
        const mallSettings = await loadMallSettings(targetMallId);
        applyMallSettingsFile(mallSettings);
      } catch (e) {
        console.error('Failed to load mall settings for switch:', e);
      }
    }

    // 4. Re-detect local speech bubble assets for halong
    if (targetMallId === 'halong') {
      try {
        const local = await invoke<Record<string, string> | null>('list_mall_assets', {
          mallId: 'halong',
          hostname,
        });
        setHalongHasLocalSpeechBubbles(
          local != null && (
            !!local['icons/locations/user-ja.svg'] ||
            !!local['icons/locations/user-en.svg'] ||
            !!local['icons/locations/user-vn.svg']
          )
        );
      } catch {
        setHalongHasLocalSpeechBubbles(false);
      }
    } else {
      setHalongHasLocalSpeechBubbles(false);
    }
  }, [mallId, hostname, captureCurrentSnapshot, applySnapshot, applyMallSettingsFile, setContextMallId]);

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


  // Load initial values when screen opens (only on open, not on mall switch)
  const prevVisibleRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      prevVisibleRef.current = false;
      // Reset hook initialization flags so they reload next time
      audioInitialized.current = false;
      cmsInitialized.current = false;
      return;
    }
    // Only run on transition from closed → open
    if (prevVisibleRef.current) return;
    prevVisibleRef.current = true;

    const loadLatestSettings = async () => {
      // Load all settings from the current mall's settings file
      try {
        const mallSettings = await loadMallSettings(mallId);
        applyMallSettingsFile(mallSettings);
      } catch (e) {
        console.error("Failed to fetch mall settings:", e);
        // Fallback to props
        setFloorLayout(initialFloorLayout);
        setLocationIconSettings(initialLocationIconSettings);
        setImageSettings(initialImageSettings);
        setShopPositions(initialShopPositions);
        setCurrentFloorSetting(initialCurrentFloorSetting);
        setLocalMediaTextSettings(initialLocalMediaTextSettings || {});
        setSubFloorSettings(initialSubFloorSettings || { "1F-1": [], "1F-2": [] });
      }

      // Load hostname from global settings
      try {
        const globalSettings = await loadGlobalSettings();
        const savedHostname = globalSettings.hostname ?? '';
        setHostname(savedHostname);
        setInitialHostname(savedHostname);
        setOperationMode(globalSettings.operationMode ?? 'api');
        setApiBaseUrl(globalSettings.apiBaseUrl ?? '');
        setOnPrePollIntervalMinutes(globalSettings.onPrePollIntervalMinutes ?? 60);

        // Detect if halong has local per-language speech bubble assets
        if (mallId === 'halong') {
          try {
            const local = await invoke<Record<string, string> | null>('list_mall_assets', {
              mallId: 'halong',
              hostname: savedHostname,
            });
            setHalongHasLocalSpeechBubbles(
              local != null && (
                !!local['icons/locations/user-ja.svg'] ||
                !!local['icons/locations/user-en.svg'] ||
                !!local['icons/locations/user-vn.svg']
              )
            );
          } catch {
            setHalongHasLocalSpeechBubbles(false);
          }
        } else {
          setHalongHasLocalSpeechBubbles(false);
        }
      } catch {}

      setFloor(initialFloor);
      setActiveTab("image");
      setErrors({});
      mallEditingCache.current.clear();

      // Reset transform when opening settings
      if (transformRef.current && previewContainerRef.current) {
        requestAnimationFrame(() => {
          if (transformRef.current && previewContainerRef.current) {
            const { x, y, scale } = calculateOtherTabCenterPosition();
            transformRef.current.setTransform(x, y, scale);
          }
        });
      }
    };

    loadLatestSettings();
  }, [
    visible,
    mallId,
    initialFloor,
    initialFloorLayout,
    initialLocationIconSettings,
    initialImageSettings,
    initialShopPositions,
    initialCurrentFloorSetting,
    initialLocalMediaTextSettings, 
    initialGenreSettings,
    initialSubFloorSettings,
    calculateOtherTabCenterPosition,
    applyMallSettingsFile,
  ]);

  // Genre settings are already loaded in the visibility effect above.
  // No separate Electron IPC fetch needed.

  const handleClose = () => {
    onClose();
    setErrors({});
  };

  const handleCancel = () => {
    // Discard all unsaved edits
    mallEditingCache.current.clear();
    setMapsFetchedFromS3(false);

    // Revert mall to original if changed
    if (mallId !== initialMallId) {
      setMallIdLocal(initialMallId);
      setContextMallId(initialMallId);
    }

    // Revert to initial values (from props = saved state of initial mall)
    setFloor(initialFloor);
    setFloorLayout(initialFloorLayout);
    setLocationIconSettings(initialLocationIconSettings);
    setImageSettings(initialImageSettings);
    setShopPositions(initialShopPositions);
    setCurrentFloorSetting(initialCurrentFloorSetting);
    setLocalMediaTextSettings(initialLocalMediaTextSettings || {});
    setGenreSettings(initialGenreSettings && initialGenreSettings.categoryMapping 
      ? initialGenreSettings 
      : { 
          ignoredKeywords: initialGenreSettings?.ignoredKeywords || DEFAULT_IGNORED_GENRE_KEYWORDS, 
          maxItems: initialGenreSettings?.maxItems || 3, 
          categoryMapping: initialGenreSettings?.categoryMapping || DEFAULT_CATEGORY_MAPPINGS 
        });
    setCurrentAudioSettings(audioSettings);
    setCurrentCmsSettings(cmsSettings);
    setSubFloorSettings(initialSubFloorSettings || { "1F-1": [], "1F-2": [] });
    setBlackScreenSettings(DEFAULT_BLACK_SCREEN_SETTINGS);
    setOperationMode('api');
    setApiBaseUrl('');
    setOnPrePollIntervalMinutes(60);
    setPictoSettings(DEFAULT_PICTO_SETTINGS);
    setBannerSettings(DEFAULT_HALONG_BANNER_SETTINGS);
    setErrors({});

    // Reset transform
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

  const handleSave = async () => {
    try {
      // Build MallSettingsFile from current editing state
      const buildMallSettings = (snap: MallEditingSnapshot): MallSettingsFile => ({
        locationIcons: snap.locationIconSettings,
        shopPositions: snap.shopPositions,
        imageSettings: snap.imageSettings,
        genreSettings: snap.genreSettings,
        cmsSettings: snap.currentCmsSettings,
        videoSettings: { enabled: false, source: '', loop: false, autoplay: false },
        audioSettings: snap.currentAudioSettings,
        displayFloors: snap.displayFloors,
        currentFloorSetting: snap.currentFloorSetting,
        localMediaTextSettings: snap.localMediaTextSettings,
        subFloorSettings: snap.subFloorSettings,
        floorLayout: snap.floorLayout,
        blackScreenSettings: snap.blackScreenSettings,
        pictoSettings: snap.pictoSettings,
        bannerSettings: snap.bannerSettings,
        shopListLayout: snap.shopListLayout ?? 'list',
      });

      // Save cached malls first (other malls that were edited during this session)
      for (const [cachedMallId, cachedSnapshot] of mallEditingCache.current.entries()) {
        if (cachedMallId !== mallId) {
          const cachedMallSettings = buildMallSettings(cachedSnapshot);
          await saveMallSettingsToFile(cachedMallId, cachedMallSettings);
        }
      }

      // Save the currently active mall's settings.
      // If maps were fetched from S3 this session, clear floorMaps before saving
      // so Path B (disk files via list_mall_assets) becomes the sole map source.
      const currentSnapshot = captureCurrentSnapshot();
      const currentMallSettings = buildMallSettings(currentSnapshot);
      const mapsWereFetchedFromS3 = mapsFetchedFromS3;
      if (mapsWereFetchedFromS3) {
        const emptyFloorMaps = Object.fromEntries(
          Object.keys(currentMallSettings.imageSettings.floorMaps).map((k) => [k, '']),
        ) as Record<string, string>;
        currentMallSettings.imageSettings = {
          ...currentMallSettings.imageSettings,
          floorMaps: emptyFloorMaps,
        };
        setMapsFetchedFromS3(false);
      }
      await saveMallSettingsToFile(mallId, currentMallSettings);


      // Save mallId and hostname to global settings so they persist across restarts
      const global = await loadGlobalSettings();
      await saveGlobalSettings({ ...global, mallId, hostname, operationMode, apiBaseUrl, onPrePollIntervalMinutes } as GlobalSettings);

      // Remove stale map directories for previous hostname
      if (mallId && hostname && hostname !== initialHostname) {
        await cleanupOldHostnameMaps(mallId, hostname).catch((e) =>
          console.warn('cleanup_old_hostname_maps failed:', e)
        );
      }

      // Clear the editing cache
      mallEditingCache.current.clear();

      // Immediately propagate audio settings to all consumers via context
      setContextAudioSettings(currentMallSettings.audioSettings);

      onSave(currentMallSettings, mallId);

      // S3からマップをダウンロードして保存した場合、MallContextのアセットを再読み込みする。
      // これにより、ショップ詳細画面のマップも即座に最新データに更新される。
      if (mapsWereFetchedFromS3) {
        refreshAssets();
      }

      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrors({ save: '設定の保存に失敗しました。' });
    }
  };

  const handleExportDefaults = async () => {
    // Export function removed in Tauri migration
    // Settings are saved to mall-specific JSON files directly
    alert('この機能はTauri版では利用できません。\n設定はmallId-settings.jsonに直接保存されます。');
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
              onChange={(e) => handleMallSwitch(e.target.value as MallId)}
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
              <option value="halong">ハロン (ID: halong)</option>
            </select>
          </div>

          <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#aaa', fontSize: 14 }}>ホスト名:</span>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="例: KIOSK-01"
              style={{
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 14,
                width: 140,
              }}
            />
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
          {import.meta.env.MODE === 'development' && (
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
            style={{
              padding: "8px 24px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "8px 24px",
              backgroundColor: "#007aff",
              border: "none",
              borderRadius: 6,
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            保存
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
            {([
              { id: "image" as TabType, label: "画像", badge: 0 },
              { id: "shopPosition" as TabType, label: "座標設定", badge: unsetShopCount },
              { id: "floorSettings" as TabType, label: "フロア設定", badge: 0 },
              { id: "localMedia" as TabType, label: "ローカルメディア設定", badge: 0 },
              { id: "genre" as TabType, label: "ジャンルメモ設定", badge: 0 },
              { id: "blackScreen" as TabType, label: "ブラックスクリーン", badge: 0 },
              ...(mallId === 'halong' ? [{ id: "picto" as TabType, label: "ピクトグラム設定", badge: 0 }] : []),
              ...(mallId === 'halong' ? [{ id: "dataSync" as TabType, label: "データ同期設定", badge: 0 }] : []),
            ]).map((tab) => (
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span style={{
                    backgroundColor: "#ff3b30",
                    color: "#ffffff",
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    padding: "0 5px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
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
            <PinchSafeTransformWrapper
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
                  shops={activeTab === "shopPosition" ? shopsForSettings : undefined}
                  selectedShopId={activeTab === "shopPosition" ? selectedShopId : undefined}
                  showOnlyMap={true}
                  currentFloorSetting={currentFloorSetting}
                  previewLanguage={mallId === 'halong' && halongHasLocalSpeechBubbles ? previewLanguage : undefined}
                />
              )}
              {activeTab === "picto" && mallId === 'halong' && (() => {
                const contentW = window.screen.width >= 3840 ? 3840 : 1920;
                const contentH = window.screen.height >= 2160 ? 2160 : 1080;
                // Replicate halong screen layout so map dimensions match the actual app
                // Halong screen: 3840×2160, left area 3140px (padding 50px), map container = 2385×2060,
                // op panel 655px, info panel 700px.
                const sc = contentW / 3840;
                const padding = Math.round(50 * sc);
                const opW = Math.round(655 * sc);
                const infoW = Math.round(700 * sc);
                const mapSrc = halongMaps[floor as keyof typeof halongMaps] ?? halongMaps['1F'];
                // Map container will be exactly 2385*sc × 2060*sc — same aspect ratio as the SVG (2385:2060),
                // so objectFit:cover produces zero offset, and percentage positioning is pixel-accurate.
                const mapDisplayW = Math.round(2385 * sc);
                const HALONG_REF_W = 1920;
                const scaleRatio = mapDisplayW / HALONG_REF_W;
                return (
                  <div style={{ display: 'flex', flexDirection: 'row', width: contentW, height: contentH, backgroundColor: '#ffffff', overflow: 'hidden' }}>
                    {/* Left area (3140*sc wide, inner padding 50*sc) */}
                    <div style={{ width: Math.round(3140 * sc), height: contentH, padding, boxSizing: 'border-box' }}>
                      {/* Main container: flex row, border-radius matches halong */}
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row', borderRadius: Math.round(40 * sc), overflow: 'hidden' }}>
                        {/* Map container — flex:1 gives exactly 2385*sc wide */}
                        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                          <img src={mapSrc} alt={floor} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <AnimatePresence>
                            {Object.values(pictoSettings.instances)
                              .filter(inst => inst.floor === floor)
                              .map(inst => {
                                const x = inst.x <= 1 ? inst.x * 100 : inst.x;
                                const y = inst.y <= 1 ? inst.y * 100 : inst.y;
                                const assetsKey = PICTO_TAG_TO_ASSETS_KEY[inst.tag];
                                const iconUrl = assetsKey ? halongAssets.pictoMapIcons[assetsKey] : '';
                                return (
                                  <PictoPin
                                    key={inst.id}
                                    instance={{ ...inst, x, y, size: (inst.size ?? 80) * scaleRatio }}
                                    iconUrl={iconUrl}
                                    isSelected={inst.id === selectedPictoId}
                                    delay={0}
                                  />
                                );
                              })
                            }
                          </AnimatePresence>
                        </div>
                        {/* Dummy operation panel */}
                        <div style={{ width: opW, height: '100%', backgroundColor: '#DDDDDD', flexShrink: 0 }} />
                      </div>
                    </div>
                    {/* Info panel */}
                    <div style={{ width: infoW, height: contentH, backgroundColor: '#555555', flexShrink: 0 }} />
                  </div>
                );
              })()}
            </TransformComponent>
          </PinchSafeTransformWrapper>
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

          {/* Language preview toggle — halong with local speech bubble assets only */}
          {mallId === 'halong' && halongHasLocalSpeechBubbles && activeTab === 'shopPosition' && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                display: "flex",
                gap: 4,
                backgroundColor: "rgba(0,0,0,0.6)",
                borderRadius: 8,
                padding: "4px",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: "26px", paddingLeft: 6, paddingRight: 4, userSelect: "none" }}>プレビュー</span>
              {(['ja', 'en', 'vn'] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setPreviewLanguage(lang)}
                  style={{
                    width: 36,
                    height: 26,
                    borderRadius: 5,
                    border: "none",
                    backgroundColor: previewLanguage === lang ? "#007aff" : "transparent",
                    color: previewLanguage === lang ? "#ffffff" : "rgba(255,255,255,0.6)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
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
              onMapsFetchedFromS3={() => setMapsFetchedFromS3(true)}
              hostname={hostname}
              mallId={mallId}
              bannerSettings={bannerSettings}
              availableBanners={availableBanners}
              onChangeBannerSettings={setBannerSettings}
              onReloadBanners={reloadBanners}
            />
          )}
          {activeTab === "shopPosition" && (
            <ShopPositionSettingsTab
              floor={floor}
              onChangeFloor={setFloor}
              shopPositions={shopPositions}
              onChangeShopPositions={setShopPositions}
              shops={shopsForSettings}
              onSelectedShopIdChange={setSelectedShopId}
              locationIconSettings={locationIconSettings}
              onChangeLocationIconSettings={setLocationIconSettings}
              hasLangSpecificSpeechBubble={mallId === 'halong'}
              hasLocalSpeechBubbleAssets={halongHasLocalSpeechBubbles}
            />
          )}
          {activeTab === "floorSettings" && (
            <CurrentFloorSettingsTab
              currentFloorSetting={currentFloorSetting}
              onChangeCurrentFloorSetting={setCurrentFloorSetting}
              displayFloors={displayFloors}
              onChangeDisplayFloors={setDisplayFloors}
              floorLayout={floorLayout}
              onChangeFloorLayout={setFloorLayout}
              shops={shops}
              subFloorSettings={subFloorSettings}
              onChangeSubFloorSettings={setSubFloorSettings}
              mallId={mallId}
            />
          )}
          {activeTab === "localMedia" && (
            <LocalMediaSettingsTab
              settings={localMediaTextSettings}
              onChangeSettings={setLocalMediaTextSettings}
              audioSettings={currentAudioSettings}
              onChangeAudioSettings={setCurrentAudioSettings}
              cmsSettings={currentCmsSettings}
              onChangeCmsSettings={setCurrentCmsSettings}
              shops={shops}
            />
          )}
          {activeTab === "genre" && (
            <GenreSettingsTab
              settings={genreSettings}
              onChangeSettings={setGenreSettings}
              shops={shops}
            />
          )}
          {activeTab === "blackScreen" && (
            <BlackScreenSettingsTab
              settings={blackScreenSettings}
              onChangeSettings={setBlackScreenSettings}
            />
          )}
          {activeTab === "picto" && mallId === 'halong' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* ショップリストレイアウト */}
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#aaa", marginBottom: "8px" }}>ショップリストレイアウト</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(['list', 'grid'] as const).map(layout => (
                    <button
                      key={layout}
                      onClick={() => setShopListLayout(layout)}
                      style={{
                        padding: "8px 20px", borderRadius: "6px", border: "none", cursor: "pointer",
                        fontWeight: 600, fontSize: "14px",
                        backgroundColor: shopListLayout === layout ? "#007aff" : "#444",
                        color: "#fff",
                      }}
                    >
                      {layout === 'list' ? 'リスト' : 'グリッド'}
                    </button>
                  ))}
                </div>
              </div>
              <PictoSettingsTab
                floor={floor as import('../types/floorLayout').FloorId}
                onChangeFloor={(f) => setFloor(f as import('../types/floorLayout').FloorId)}
                pictoSettings={pictoSettings}
                onSavePictoSettings={setPictoSettings}
                selectedInstanceId={selectedPictoId}
                onSelectedInstanceIdChange={setSelectedPictoId}
                iconOptions={pictoIconOptions}
              />
            </div>
          )}
          {activeTab === "dataSync" && mallId === 'halong' && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: 480 }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#aaa", marginBottom: "8px" }}>データ取得方法</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  {([
                    { id: 'api' as const, label: 'API (BG SSE)' },
                    { id: 'local' as const, label: 'ローカルファイル' },
                    { id: 'on-pre' as const, label: 'オンプレサーバー' },
                  ]).map(mode => (
                    <button
                      key={mode.id}
                      onClick={() => setOperationMode(mode.id)}
                      style={{
                        padding: "8px 20px", borderRadius: "6px", border: "none", cursor: "pointer",
                        fontWeight: 600, fontSize: "14px",
                        backgroundColor: operationMode === mode.id ? "#007aff" : "#444",
                        color: "#fff",
                      }}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
              {operationMode === 'on-pre' && (
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#aaa", marginBottom: "8px" }}>オンプレサーバーURL</div>
                  <input
                    type="text"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="例: http://192.168.1.10:8091/gido-touch/data/halong"
                    style={{
                      width: "100%",
                      backgroundColor: '#333',
                      color: '#fff',
                      border: '1px solid #555',
                      borderRadius: 4,
                      padding: '8px 10px',
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "6px" }}>
                    店舗情報CMS（sdc）のデータ配信URLをモール固有パス（.../gido-touch/data/halong）まで含めて入力してください。
                  </div>
                </div>
              )}
              {operationMode === 'on-pre' && (
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#aaa", marginBottom: "8px" }}>ポーリング間隔（分）</div>
                  <input
                    type="number"
                    min={5}
                    step={1}
                    value={onPrePollIntervalMinutes}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setOnPrePollIntervalMinutes(Number.isFinite(n) && n > 0 ? n : 60);
                    }}
                    style={{
                      width: 120,
                      backgroundColor: '#333',
                      color: '#fff',
                      border: '1px solid #555',
                      borderRadius: 4,
                      padding: '8px 10px',
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ fontSize: "12px", color: "#888", marginTop: "6px" }}>
                    オンプレサーバーへの再チェック間隔。デフォルトは60分です。
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedSettingsScreen;
