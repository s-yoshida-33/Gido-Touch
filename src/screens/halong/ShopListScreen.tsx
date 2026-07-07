// src/screens/halong/ShopListScreen.tsx
// Screen size: 3840×2160 (16:9 landscape)

import { useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { useHalongAssets } from '../../hooks/useHalongAssets';
import { useHalongMaps } from '../../hooks/useHalongMaps';
import { useHalongShops, getDisplayName, getFloorDisplay } from '../../hooks/useHalongShops';
import { loadMallSettings } from '../../utils/settings';
import { LocationIconsOverlay } from '../../components/LocationIconsOverlay';
import { getLocationIconSettingsForFloor } from '../../config';
import type { LocationIconSettingsPerFloor } from '../../types/locationIcon';
import type { FloorId } from '../../types/floorLayout';
import { ShopPin } from '../../components/ShopPin';
import { PictoPin } from '../../components/PictoPin';
import halongShopPinSvg from '../../assets/malls/halong/icons/locations/shop.svg';
import type { ShopPositionSettings } from '../../types/shopPosition';
import type { PictoSettings } from '../../types/picto';
import type { HalongBannerSettings } from '../../types/bannerSettings';
import { mergeBannerEntries } from '../../types/bannerSettings';
import { useHalongBanners } from '../../hooks/useHalongBanners';
import type { HalongShop } from '../../hooks/useHalongShops';
import { ShopDetailPanel } from './ShopDetailPanel';

const HALONG_REFERENCE_MAP_WIDTH = 1920;

const IDLE_TIMEOUT_MS = 30000;
const FLOOR_ANIM_DURATION = 0.35;

const GENRES = ['all', 'fashion', 'goods', 'gourmet', 'service'] as const;
type Genre = typeof GENRES[number];

const listVariants: Variants = {
  enter: (direction: number) => {
    if (direction === 0) return { opacity: 0 };
    return { x: direction > 0 ? 300 : -300, opacity: 0 };
  },
  center: { zIndex: 1, x: 0, opacity: 1 },
  exit: (direction: number) => {
    if (direction === 0) return { opacity: 0 };
    return { zIndex: 0, x: direction > 0 ? -300 : 300, opacity: 0 };
  },
};

const PICTO_KEY_TO_TAG: Record<string, string> = {
  info:     'info',
  restroom: 'restroom',
  smoking:  'smoking_room',
  lockers:  'free_coin_lockers',
  atm:      'atm',
  elevator: 'elevator',
};

const PICTO_TAG_TO_ASSETS_KEY: Record<string, keyof ReturnType<typeof import('../../hooks/useHalongAssets').useHalongAssets>['pictoMapIcons']> = {
  info:             'info',
  restroom:         'restroom',
  smoking_room:     'smoking',
  free_coin_lockers: 'lockers',
  atm:              'atm',
  elevator:         'elevator',
};

interface HalongShopListScreenProps {
  locationIconSettings?: LocationIconSettingsPerFloor;
  shopPositions?: ShopPositionSettings;
  pictoSettings?: PictoSettings;
  bannerSettings?: HalongBannerSettings;
}

export default function HalongShopListScreen({ locationIconSettings: locationIconSettingsProp, shopPositions: shopPositionsProp, pictoSettings: pictoSettingsProp, bannerSettings: bannerSettingsProp }: HalongShopListScreenProps = {}) {
  const [selectedLang, setSelectedLang] = useState<'en' | 'ja' | 'vn'>('vn');
  const [langPopupOpen, setLangPopupOpen] = useState(false);
  const assets = useHalongAssets(selectedLang);
  const maps = useHalongMaps();
  const allShops = useHalongShops();
  const [currentFloor, setCurrentFloor] = useState<string>('1F');
  const [selectedPicto, setSelectedPicto] = useState<string | null>(null);
  const [pressedGenreNav, setPressedGenreNav] = useState<'prev' | 'next' | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [showFloorLabel, setShowFloorLabel] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<Genre>('all');
  const [genreDirection, setGenreDirection] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [locationIconSettings, setLocationIconSettings] = useState<LocationIconSettingsPerFloor | null>(null);
  const [currentFloorSetting, setCurrentFloorSetting] = useState<string>('1F');
  const [mapImageMetrics, setMapImageMetrics] = useState<{ displayWidth: number; displayHeight: number; offsetX: number; offsetY: number } | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [visibleShopId, setVisibleShopId] = useState<string | null>(null);
  const [selectedShopLogoUrl, setSelectedShopLogoUrl] = useState<string | null>(null);
  const [selectedShopDetail, setSelectedShopDetail] = useState<HalongShop | null>(null);
  const [shopPositions, setShopPositions] = useState<ShopPositionSettings | null>(null);
  const [pictoSettings, setPictoSettings] = useState<PictoSettings | null>(pictoSettingsProp ?? null);
  const [visiblePictoTag, setVisiblePictoTag] = useState<string | null>(null);
  const { banners: availableBanners } = useHalongBanners();

  const displayBanners = useMemo(() => {
    if (!availableBanners.length) return [];
    const mergedEntries = mergeBannerEntries(bannerSettingsProp?.entries ?? [], availableBanners);
    return mergedEntries
      .filter((e) => e.enabled)
      .slice(0, 10)
      .map((e) => availableBanners.find((b) => b.filename === e.filename))
      .filter((f): f is NonNullable<typeof f> => !!f);
  }, [bannerSettingsProp?.entries, availableBanners]);

  const [carouselSlide, setCarouselSlide] = useState(0);
  const carouselTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCarouselSlide(0);
  }, [displayBanners]);

  useEffect(() => {
    if (carouselTimerRef.current) clearInterval(carouselTimerRef.current);
    carouselTimerRef.current = null;
    if ((bannerSettingsProp?.displayMode ?? 'equal') !== 'carousel' || displayBanners.length <= 1) return;
    const ms = (bannerSettingsProp?.carouselDurationSec ?? 5) * 1000;
    carouselTimerRef.current = setInterval(
      () => setCarouselSlide((p) => (p + 1) % displayBanners.length),
      ms,
    );
    return () => { if (carouselTimerRef.current) clearInterval(carouselTimerRef.current); };
  }, [bannerSettingsProp?.displayMode, bannerSettingsProp?.carouselDurationSec, displayBanners.length]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const firstFloorImgRef = useRef<HTMLImageElement>(null);
  const transformComponentRef = useRef<ReactZoomPanPinchContentRef>(null);
  const genreScrollRef = useRef<HTMLDivElement>(null);
  const focusDelayRef = useRef(0);
  const ignoreFloorChangeRef = useRef(false);
  const pinVisibilityTimerRef = useRef<number | null>(null);
  const pictoVisibilityTimerRef = useRef<number | null>(null);
  const mapImageMetricsRef = useRef<{ displayWidth: number; displayHeight: number; offsetX: number; offsetY: number } | null>(null);
  const shopListScrollRef = useRef<HTMLDivElement>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());
  const defaultFloorRef = useRef<string>('1F');
  const floorLayerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isInitialFloorRenderRef = useRef(true);
  const prevFloorRef = useRef<string | null>(null);
  const prevMapStateRef = useRef<{ floor: string; positionX: number; positionY: number; scale: number } | null>(null);

  const ALL_FLOORS = useMemo(() => ['1F', '2F', '3F', '4F'] as const, []);
  const FLOOR_ORDER = ['1F', '2F', '3F', '4F'];

  // Canvas measureText でフロア・区画番号ラベルの最大幅を計算（言語切替時に再計算）
  const { floorLabelWidth, sectionLabelWidth } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || allShops.length === 0) return { floorLabelWidth: 56, sectionLabelWidth: 84 };
    ctx.font = 'bold 20px "Segoe UI", "Noto Sans", sans-serif';
    const PADDING = 32;
    const MIN_WIDTH = 48;
    let maxFloor = 0;
    let maxSection = 0;
    for (const shop of allShops) {
      maxFloor = Math.max(maxFloor, ctx.measureText(getFloorDisplay(shop, selectedLang)).width);
      if (shop.section) maxSection = Math.max(maxSection, ctx.measureText(shop.section).width);
    }
    return {
      floorLabelWidth: Math.max(MIN_WIDTH, Math.ceil(maxFloor + PADDING)),
      sectionLabelWidth: Math.max(MIN_WIDTH, Math.ceil(maxSection + PADDING)),
    };
  }, [allShops, selectedLang]);

  const filteredShops = useMemo(() => {
    let result = allShops;

    if (selectedGenre !== 'all') {
      result = result.filter(s => s.genre === selectedGenre);
    }

    result = result.filter(s => s.section && s.section.trim() !== '');

    return [...result].sort((a, b) => {
      const aOnFloor = a.floorKey === currentFloor;
      const bOnFloor = b.floorKey === currentFloor;
      if (aOnFloor && !bOnFloor) return -1;
      if (!aOnFloor && bOnFloor) return 1;

      const fA = FLOOR_ORDER.indexOf(a.floorKey);
      const fB = FLOOR_ORDER.indexOf(b.floorKey);
      if (fA !== fB) return fA - fB;

      return (a.section || '').localeCompare(b.section || '', 'ja', { numeric: true });
    });
  }, [allShops, currentFloor, selectedGenre]);

  // Sync locationIconSettings from prop when provided (after settings save)
  useEffect(() => {
    if (locationIconSettingsProp) {
      setLocationIconSettings(locationIconSettingsProp);
    }
  }, [locationIconSettingsProp]);

  // Sync shopPositions from prop when provided (after settings save)
  useEffect(() => {
    if (shopPositionsProp) {
      setShopPositions(shopPositionsProp);
    }
  }, [shopPositionsProp]);

  // Sync pictoSettings from prop when provided (after settings save)
  useEffect(() => {
    if (pictoSettingsProp !== undefined) {
      setPictoSettings(pictoSettingsProp ?? null);
    }
  }, [pictoSettingsProp]);

  // 設定からデフォルトフロアと現在地アイコン設定を読み込む（初回のみ）
  useEffect(() => {
    async function loadFloorSetting() {
      try {
        const mallSettings = await loadMallSettings('halong');
        if (mallSettings.currentFloorSetting) {
          setCurrentFloor(mallSettings.currentFloorSetting);
          setCurrentFloorSetting(mallSettings.currentFloorSetting);
          defaultFloorRef.current = mallSettings.currentFloorSetting;
        }
        if (mallSettings.locationIcons && !locationIconSettingsProp) {
          setLocationIconSettings(mallSettings.locationIcons);
        }
        if (mallSettings.shopPositions && !shopPositionsProp) {
          setShopPositions(mallSettings.shopPositions);
        }
        if (mallSettings.pictoSettings && !pictoSettingsProp) {
          setPictoSettings(mallSettings.pictoSettings);
        }
      } catch {
        // 設定未保存またはTauri未使用 → デフォルト1Fのまま
      }
    }
    loadFloorSetting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // objectFit: cover のマップ画像メトリクスを計算（アイコンの正確な位置スケーリング用）
  const updateMapMetrics = useCallback(() => {
    const container = mapContainerRef.current;
    const img = firstFloorImgRef.current;
    if (!container || !img || !img.complete || img.naturalWidth === 0) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imageAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;
    if (containerAspect > imageAspect) {
      displayWidth = containerWidth;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
    } else {
      displayHeight = containerHeight;
      displayWidth = displayHeight * imageAspect;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    }

    const metrics = {
      displayWidth: Math.round(displayWidth),
      displayHeight: Math.round(displayHeight),
      offsetX: Math.round(offsetX),
      offsetY: Math.round(offsetY),
    };
    mapImageMetricsRef.current = metrics;
    setMapImageMetrics(metrics);
  }, []);

  useEffect(() => {
    const img = firstFloorImgRef.current;
    if (img) {
      if (img.complete) updateMapMetrics();
      else img.addEventListener('load', updateMapMetrics);
    }
    const resizeObserver = new ResizeObserver(updateMapMetrics);
    if (mapContainerRef.current) resizeObserver.observe(mapContainerRef.current);
    return () => {
      img?.removeEventListener('load', updateMapMetrics);
      resizeObserver.disconnect();
    };
  }, [updateMapMetrics]);

  // スクロールバー非表示のCSS注入
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .halong-shop-list-scroll::-webkit-scrollbar { display: none; }
      .halong-genre-scroll::-webkit-scrollbar { display: none; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // ジャンルスクロール可否の更新
  function updateGenreScrollability() {
    const el = genreScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }

  useEffect(() => {
    updateGenreScrollability();
    const el = genreScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateGenreScrollability);
    return () => el.removeEventListener('scroll', updateGenreScrollability);
  }, []);

  function scrollGenre(direction: 'prev' | 'next') {
    if (!genreScrollRef.current) return;
    const amount = 3 * (120 + 15);
    const target = genreScrollRef.current.scrollLeft + (direction === 'next' ? amount : -amount);
    genreScrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
  }

  // マップフロア切り替えアニメーション（Mini準拠）
  useLayoutEffect(() => {
    const newFloor = currentFloor;
    const isInitial = isInitialFloorRenderRef.current;
    const duration = FLOOR_ANIM_DURATION;

    const getFloorNum = (f: string) => parseInt(f.replace('F', '') || '1');
    const prevFloor = prevFloorRef.current;
    const current = getFloorNum(prevFloor || '1F');
    const next = getFloorNum(newFloor);

    let direction = 0;
    if (next !== current) {
      if (next === 1) direction = -1;
      else if (next === 4) direction = 1;
      else direction = next > current ? 1 : -1;
    }

    prevFloorRef.current = currentFloor;

    if (!isInitial && direction !== 0 && transformComponentRef.current) {
      transformComponentRef.current.resetTransform(0);
    }

    const animating = !isInitial && direction !== 0;

    ALL_FLOORS.forEach(floor => {
      const el = floorLayerRefs.current[floor];
      if (!el) return;

      if (animating) el.style.willChange = 'transform, opacity';

      if (floor === newFloor) {
        if (isInitial || direction === 0) {
          el.style.transition = 'none';
          el.style.transform = 'translateY(0)';
          el.style.opacity = '1';
          el.style.visibility = 'visible';
          el.style.zIndex = '1';
        } else {
          const entryY = direction > 0 ? -200 : 200;
          el.style.transition = 'none';
          el.style.transform = `translateY(${entryY}px)`;
          el.style.opacity = '0';
          el.style.visibility = 'visible';
          el.style.zIndex = '1';
          el.getBoundingClientRect();
          el.style.transition = `transform ${duration}s ease-in-out, opacity ${duration}s ease-in-out`;
          el.style.transform = 'translateY(0)';
          el.style.opacity = '1';
        }
      } else {
        if (isInitial) {
          el.style.transition = 'none';
          el.style.transform = 'translateY(0)';
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          el.style.zIndex = '0';
        } else {
          const exitY = direction > 0 ? 200 : -200;
          el.style.transition = `transform ${duration}s ease-in-out, opacity ${duration}s ease-in-out`;
          el.style.transform = `translateY(${exitY}px)`;
          el.style.opacity = '0';
          el.style.zIndex = '0';
        }
      }
    });

    isInitialFloorRenderRef.current = false;

    const cleanupTimeout = setTimeout(() => {
      ALL_FLOORS.forEach(floor => {
        const el = floorLayerRefs.current[floor];
        if (!el) return;
        el.style.willChange = 'auto';
        if (floor !== currentFloor) el.style.visibility = 'hidden';
      });
    }, duration * 1000 + 50);

    return () => clearTimeout(cleanupTimeout);
  }, [currentFloor, ALL_FLOORS]);

  // フロアラベル・ヒントをズーム時に非表示（showHint/showFloorLabel はズーム判定に使用）
  useEffect(() => {
    setShowHint(true);
    setShowFloorLabel(true);
  }, [currentFloor]);

  // フロア切り替え時にピンをクリア（ショップタップによる切り替えは ignoreFloorChangeRef でスキップ）
  useEffect(() => {
    if (ignoreFloorChangeRef.current) {
      ignoreFloorChangeRef.current = false;
      return;
    }
    if (pinVisibilityTimerRef.current !== null) {
      clearTimeout(pinVisibilityTimerRef.current);
      pinVisibilityTimerRef.current = null;
    }
    setSelectedShopId(null);
    setVisibleShopId(null);
    setSelectedShopLogoUrl(null);
  }, [currentFloor]);

  // アイドルタイムアウト: 30秒操作なしでデフォルト状態にリセット
  useEffect(() => {
    lastActivityTimeRef.current = Date.now();

    let throttleTimeout: number | null = null;
    const handleActivity = () => {
      if (isRefreshing) return;
      if (throttleTimeout === null) {
        lastActivityTimeRef.current = Date.now();
        throttleTimeout = window.setTimeout(() => { throttleTimeout = null; }, 1000);
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown', 'wheel'];
    events.forEach(ev => window.addEventListener(ev, handleActivity, { passive: true }));
    const genreEl = genreScrollRef.current;
    if (genreEl) genreEl.addEventListener('scroll', handleActivity, { passive: true });

    const checkInterval = setInterval(() => {
      if (isRefreshing) {
        lastActivityTimeRef.current = Date.now();
        return;
      }

      if (Date.now() - lastActivityTimeRef.current < IDLE_TIMEOUT_MS) return;

      const isGenreScrolled = genreScrollRef.current ? genreScrollRef.current.scrollLeft > 5 : false;
      const isShopListScrolled = shopListScrollRef.current ? shopListScrollRef.current.scrollTop > 5 : false;

      const isDefaultState =
        selectedLang === 'vn' &&
        !langPopupOpen &&
        selectedGenre === 'all' &&
        selectedPicto === null &&
        selectedShopId === null &&
        selectedShopDetail === null &&
        currentFloor === defaultFloorRef.current &&
        showHint && showFloorLabel &&
        !isGenreScrolled &&
        !isShopListScrolled;

      if (isDefaultState) {
        lastActivityTimeRef.current = Date.now();
        return;
      }

      setIsRefreshing(true);

      setTimeout(() => {
        if (pinVisibilityTimerRef.current !== null) {
          clearTimeout(pinVisibilityTimerRef.current);
          pinVisibilityTimerRef.current = null;
        }
        if (pictoVisibilityTimerRef.current !== null) {
          clearTimeout(pictoVisibilityTimerRef.current);
          pictoVisibilityTimerRef.current = null;
        }
        setSelectedLang('vn');
        setLangPopupOpen(false);
        setSelectedGenre('all');
        setSelectedPicto(null);
        setVisiblePictoTag(null);
        setSelectedShopId(null);
        setVisibleShopId(null);
        setSelectedShopLogoUrl(null);
        setSelectedShopDetail(null);
        setCurrentFloor(defaultFloorRef.current);

        if (transformComponentRef.current) {
          transformComponentRef.current.setTransform(0, 0, 1, 0);
        }
        setShowHint(true);
        setShowFloorLabel(true);

        if (genreScrollRef.current) {
          genreScrollRef.current.scrollTo({ left: 0, behavior: 'auto' });
        }
        if (shopListScrollRef.current) {
          shopListScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
        }

        setTimeout(() => {
          setIsRefreshing(false);
          lastActivityTimeRef.current = Date.now();
        }, 500);
      }, 500);
    }, 1000);

    return () => {
      clearInterval(checkInterval);
      events.forEach(ev => window.removeEventListener(ev, handleActivity));
      if (genreEl) genreEl.removeEventListener('scroll', handleActivity);
      if (throttleTimeout !== null) window.clearTimeout(throttleTimeout);
    };
  }, [isRefreshing, selectedLang, langPopupOpen, selectedGenre, selectedPicto, selectedShopId, selectedShopDetail, currentFloor, showHint, showFloorLabel]);

  function handleFloorSelect(floor: string) {
    setGenreDirection(0);
    setCurrentFloor(floor);
  }

  function handleGenreSelect(genre: Genre) {
    if (genre === selectedGenre) return;
    const currentIndex = GENRES.indexOf(selectedGenre);
    const newIndex = GENRES.indexOf(genre);
    setGenreDirection(newIndex > currentIndex ? 1 : -1);
    setSelectedGenre(genre);
  }

  function handlePictoSelect(pictoKey: string) {
    const newKey = selectedPicto === pictoKey ? null : pictoKey;

    if (pictoVisibilityTimerRef.current !== null) {
      clearTimeout(pictoVisibilityTimerRef.current);
      pictoVisibilityTimerRef.current = null;
    }

    setSelectedPicto(newKey);

    if (!newKey) {
      setVisiblePictoTag(null);
      return;
    }

    const tag = PICTO_KEY_TO_TAG[pictoKey];
    const instances = pictoSettings ? Object.values(pictoSettings.instances).filter(i => i.tag === tag) : [];

    if (instances.length === 0) {
      setVisiblePictoTag(tag);
      return;
    }

    const hasOnCurrentFloor = instances.some(i => i.floor === currentFloor);

    if (!hasOnCurrentFloor) {
      const getFloorNum = (f: string) => parseInt(f.replace('F', '') || '0');
      const currentNum = getFloorNum(currentFloor);
      const sorted = [...new Set(instances.map(i => i.floor))].sort((a, b) => {
        const da = Math.abs(getFloorNum(a) - currentNum);
        const db = Math.abs(getFloorNum(b) - currentNum);
        return da !== db ? da - db : getFloorNum(b) - getFloorNum(a);
      });
      const targetFloor = sorted[0];
      if (targetFloor) {
        const floorAnimMs = (FLOOR_ANIM_DURATION + 0.05) * 1000;
        ignoreFloorChangeRef.current = true;
        setCurrentFloor(targetFloor);
        pictoVisibilityTimerRef.current = window.setTimeout(() => {
          pictoVisibilityTimerRef.current = null;
          setVisiblePictoTag(tag);
        }, floorAnimMs);
      }
    } else {
      setVisiblePictoTag(tag);
    }
  }

  function handleShopTap(shopId: string, floorKey: string, logoDataUrl: string | null) {
    // タップ前のマップ状態を保存（詳細パネルを閉じる際に復元）
    const ts = transformComponentRef.current?.instance?.transformState;
    prevMapStateRef.current = {
      floor: currentFloor,
      positionX: ts?.positionX ?? 0,
      positionY: ts?.positionY ?? 0,
      scale: ts?.scale ?? 1,
    };

    // Cancel any pending pin visibility timer
    if (pinVisibilityTimerRef.current !== null) {
      clearTimeout(pinVisibilityTimerRef.current);
      pinVisibilityTimerRef.current = null;
    }
    // Clear picto selection
    if (pictoVisibilityTimerRef.current !== null) {
      clearTimeout(pictoVisibilityTimerRef.current);
      pictoVisibilityTimerRef.current = null;
    }
    setSelectedPicto(null);
    setVisiblePictoTag(null);

    setSelectedShopLogoUrl(logoDataUrl);
    setSelectedShopId(shopId);
    setVisibleShopId(null); // hide any existing pin immediately

    const needsFloorSwitch = floorKey !== currentFloor;
    if (needsFloorSwitch) {
      // Strict sequence: floor animates in → pin appears → focus
      const floorAnimMs = (FLOOR_ANIM_DURATION + 0.05) * 1000; // 400ms
      const pinSpringMs = 400; // approx spring settle
      ignoreFloorChangeRef.current = true;
      focusDelayRef.current = (floorAnimMs + pinSpringMs) / 1000;
      setCurrentFloor(floorKey);
      // Mount the pin only after floor animation completes
      pinVisibilityTimerRef.current = window.setTimeout(() => {
        pinVisibilityTimerRef.current = null;
        setVisibleShopId(shopId);
      }, floorAnimMs);
    } else {
      focusDelayRef.current = 0;
      setVisibleShopId(shopId); // same floor: show immediately
    }
  }

  // 詳細パネルを閉じてマップをタップ前の状態に戻す（フロアは現在のまま維持）
  function handleCloseDetail() {
    setSelectedShopDetail(null);
    setSelectedShopId(null);
    setVisibleShopId(null);
    setSelectedShopLogoUrl(null);

    const prev = prevMapStateRef.current;
    prevMapStateRef.current = null;
    if (!prev) return;

    if (prev.floor === currentFloor) {
      // フロアが変わっていない → タップ前の zoom/pan に戻す
      transformComponentRef.current?.setTransform(prev.positionX, prev.positionY, prev.scale, 500, 'easeOut');
    } else {
      // フロアが変わっている → 現在のフロアのままデフォルト位置にリセット
      transformComponentRef.current?.setTransform(0, 0, 1, 500, 'easeOut');
    }
  }

  // Map focus: fires when selectedShopId/currentFloor changes
  useEffect(() => {
    if (!selectedShopId || !shopPositions || !transformComponentRef.current) return;

    const position = shopPositions.positions[selectedShopId];
    if (!position) return;

    if (position.floor !== currentFloor) return;

    const metrics = mapImageMetricsRef.current;
    const container = mapContainerRef.current;
    if (!metrics || !container) return;

    const x = position.x <= 1 ? position.x * 100 : position.x;
    const y = position.y <= 1 ? position.y * 100 : position.y;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;

    const targetX = metrics.offsetX + (x / 100) * metrics.displayWidth;
    const targetY = metrics.offsetY + (y / 100) * metrics.displayHeight;

    const scale = 1.6;
    let newX = containerW / 2 - targetX * scale;
    let newY = containerH / 2 - targetY * scale;

    const minX = containerW * (1 - scale);
    const minY = containerH * (1 - scale);
    newX = Math.min(0, Math.max(minX, newX));
    newY = Math.min(0, Math.max(minY, newY));

    const delayMs = focusDelayRef.current * 1000;
    const timer = setTimeout(() => {
      transformComponentRef.current?.setTransform(newX, newY, scale, 1000, "easeOut");
    }, delayMs);

    return () => clearTimeout(timer);
  }, [selectedShopId, currentFloor, shopPositions]);

  return (
    <div
      style={{
        width: "3840px",
        height: "2160px",
        backgroundColor: "#ffffff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
        position: "relative",
      }}
    >
      {/* アイドルリフレッシュ フェードオーバーレイ */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "#ffffff",
          opacity: isRefreshing ? 1 : 0,
          transition: "opacity 0.5s ease-in-out",
          pointerEvents: isRefreshing ? "all" : "none",
          zIndex: 9999,
        }}
      />

      {/* 左エリア: 50px余白 + メインコンテナ3040×2060 + 右余白50px = 3140px */}
      <div
        style={{
          width: "3140px",
          height: "2160px",
          padding: "50px",
          boxSizing: "border-box",
        }}
      >
        {/* メインコンテナ */}
        <div
          style={{
            position: "relative",
            width: "3040px",
            height: "2060px",
            borderRadius: "40px",
            overflow: "hidden",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "row",
          }}
        >
          {/* マップコンテナ */}
          <div
            ref={mapContainerRef}
            style={{
              flex: 1,
              height: "2060px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* ズームパン対応マップ（全フロアを事前レンダリング、フロア切り替えアニメーション） */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
              <TransformWrapper
                ref={transformComponentRef}
                initialScale={1}
                minScale={1}
                maxScale={4}
                centerOnInit={true}
                limitToBounds={true}
                doubleClick={{ disabled: true }}
                panning={{ disabled: false, velocityDisabled: true }}
                wheel={{ step: 0.1 }}
                alignmentAnimation={{ animationTime: 0, sizeX: 0, sizeY: 0 }}
                velocityAnimation={{ disabled: true }}
                zoomAnimation={{ disabled: true }}
                onPanningStart={(ref) => {
                  if (ref.state.scale > 1.01) {
                    setShowHint(false);
                    setShowFloorLabel(false);
                  }
                }}
                onTransformed={(_, state) => {
                  const isDefault = Math.abs(state.scale - 1) < 0.01 && Math.abs(state.positionX) < 1 && Math.abs(state.positionY) < 1;
                  setShowHint(isDefault);
                  setShowFloorLabel(isDefault);
                }}
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{ width: "100%", height: "100%" }}
                >
                  <div style={{ position: "relative", width: "100%", height: "100%" }}>
                    {ALL_FLOORS.map(floor => (
                      <div
                        key={floor}
                        ref={el => { floorLayerRefs.current[floor] = el; }}
                        style={{ position: "absolute", inset: 0 }}
                      >
                        <img
                          ref={floor === '1F' ? firstFloorImgRef : undefined}
                          onLoad={floor === '1F' ? updateMapMetrics : undefined}
                          src={maps[floor]}
                          alt={`${floor} map`}
                          draggable={false}
                          style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
                        />

                        {/* 現在地アイコン: 設定フロアのレイヤー内に配置してフロアアニメーションと同期 */}
                        {locationIconSettings && floor === currentFloorSetting && (
                          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                            <LocationIconsOverlay
                              settings={getLocationIconSettingsForFloor(locationIconSettings, floor as FloorId)}
                              imageMetrics={mapImageMetrics}
                              speechBubbleSrc={assets.speechBubbleIconSrc}
                              locationSrc={assets.locationIconSrc}
                              language={selectedLang}
                            />
                          </div>
                        )}

                        {/* ショップピン: タイマー管理で floor 完了後にマウント */}
                        <AnimatePresence>
                          {visibleShopId && shopPositions && mapImageMetrics &&
                            shopPositions.positions[visibleShopId]?.floor === floor && (() => {
                              const position = shopPositions.positions[visibleShopId];
                              const x = position.x <= 1 ? position.x * 100 : position.x;
                              const y = position.y <= 1 ? position.y * 100 : position.y;
                              const scaleRatio = mapImageMetrics.displayWidth / HALONG_REFERENCE_MAP_WIDTH;
                              const pinSize = (position.size ?? 80) * scaleRatio;
                              const pixelX = Math.round(mapImageMetrics.offsetX + (x / 100) * mapImageMetrics.displayWidth);
                              const pixelY = Math.round(mapImageMetrics.offsetY + (y / 100) * mapImageMetrics.displayHeight);
                              return (
                                <ShopPin
                                  key={visibleShopId}
                                  position={{ ...position, x, y, size: pinSize }}
                                  usePixelPosition={true}
                                  pixelX={pixelX}
                                  pixelY={pixelY}
                                  shopName={visibleShopId}
                                  isSelected={true}
                                  shopLogo={selectedShopLogoUrl ?? undefined}
                                  pinSrc={halongShopPinSvg}
                                  logoTopPercent={24.5}
                                  delay={0}
                                />
                              );
                            })()
                          }
                        </AnimatePresence>

                        {/* ピクトピン: selectedPicto に対応するタグのインスタンスを表示 */}
                        <AnimatePresence>
                          {visiblePictoTag && pictoSettings && mapImageMetrics && (() => {
                            const scaleRatio = mapImageMetrics.displayWidth / HALONG_REFERENCE_MAP_WIDTH;
                            const assetsKey = PICTO_TAG_TO_ASSETS_KEY[visiblePictoTag];
                            const iconUrl = assetsKey ? assets.pictoMapIcons[assetsKey] : '';
                            const instances = Object.values(pictoSettings.instances)
                              .filter(inst => inst.tag === visiblePictoTag && inst.floor === floor);
                            return instances.map(inst => {
                              const x = inst.x <= 1 ? inst.x * 100 : inst.x;
                              const y = inst.y <= 1 ? inst.y * 100 : inst.y;
                              const scaledInst = { ...inst, x, y, size: (inst.size ?? 80) * scaleRatio };
                              const pixelX = Math.round(mapImageMetrics.offsetX + (x / 100) * mapImageMetrics.displayWidth);
                              const pixelY = Math.round(mapImageMetrics.offsetY + (y / 100) * mapImageMetrics.displayHeight);
                              return (
                                <PictoPin
                                  key={inst.id}
                                  instance={scaledInst}
                                  iconUrl={iconUrl}
                                  isSelected={true}
                                  usePixelPosition={true}
                                  pixelX={pixelX}
                                  pixelY={pixelY}
                                  delay={0}
                                />
                              );
                            });
                          })()}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </TransformComponent>
              </TransformWrapper>
            </div>

            {/* フロアラベル (x:50, y:50) */}
            <img
              src={assets.floorLabels[currentFloor as '1F' | '2F' | '3F' | '4F']}
              alt={currentFloor}
              draggable={false}
              style={{
                position: "absolute",
                left: "50px",
                top: "50px",
                width: "250px",
                height: "166px",
                display: "block",
                opacity: showFloorLabel ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            {/* ヒント (x:50, y:bottom 50) */}
            <img
              src={assets.hint}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "50px",
                bottom: "50px",
                width: "654px",
                height: "96px",
                display: "block",
                opacity: showHint ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
          </div>

          {/* オペレーションコンテナ */}
          <div
            style={{
              width: "655px",
              height: "2060px",
              backgroundColor: "#DDDDDD",
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              padding: "50px",
              boxSizing: "border-box",
            }}
          >
            {/* バナーエリア（flex:1 で残余スペースを占有） */}
            {(() => {
              const mode = bannerSettingsProp?.displayMode ?? 'equal';
              const bannerHeight = bannerSettingsProp?.bannerHeight ?? 200;

              if (mode === 'carousel') {
                return (
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
                    <div style={{ width: "555px", height: "312px", overflow: "hidden", borderRadius: "26px", flexShrink: 0 }}>
                      <div style={{
                        display: "flex",
                        width: `${555 * displayBanners.length}px`,
                        height: "100%",
                        transform: `translateX(${-carouselSlide * 555}px)`,
                        transition: "transform 0.6s ease-in-out",
                      }}>
                        {displayBanners.map((file, idx) => (
                          <img
                            key={idx}
                            src={file.url}
                            alt={`banner${idx + 1}`}
                            draggable={false}
                            style={{ width: "555px", height: "312px", objectFit: "cover", display: "block", flexShrink: 0 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              if (mode === 'custom') {
                const topMargin = bannerSettingsProp?.topMargin ?? 0;
                const bannerGap = bannerSettingsProp?.bannerGap ?? 20;
                return (
                  <div style={{ flex: 1, overflow: "hidden", flexShrink: 0 }}>
                    <div style={{ paddingTop: `${topMargin}px`, display: "flex", flexDirection: "column", gap: `${bannerGap}px` }}>
                      {displayBanners.map((file, idx) => (
                        <div key={idx} style={{ width: "555px", height: `${bannerHeight}px`, borderRadius: "26px", overflow: "hidden", flexShrink: 0 }}>
                          <img src={file.url} alt={`banner${idx + 1}`} draggable={false}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // equal: flex spacers distribute space evenly
              return (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
                  {displayBanners.length === 0 ? null : (
                    <>
                      {displayBanners.map((file, idx) => (
                        <div key={idx} style={{ display: "contents" }}>
                          <div style={{ flex: 1 }} />
                          <div style={{ width: "555px", height: `${bannerHeight}px`, borderRadius: "26px", overflow: "hidden", flexShrink: 0 }}>
                            <img src={file.url} alt={`banner${idx + 1}`} draggable={false}
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          </div>
                        </div>
                      ))}
                      <div style={{ flex: 1 }} />
                    </>
                  )}
                </div>
              );
            })()}

            {/* バナーとピクトの間隔 */}
            <div style={{ height: "30px", flexShrink: 0 }} />

            {/* ピクトボタン行（左上） */}
            <div style={{ display: "flex", flexDirection: "row", gap: "30px", alignSelf: "flex-start", flexShrink: 0 }}>
              {/* info */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('info')}
              >
                <img src={assets.pictos.info.default} alt="info" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.info.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'info' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* restroom */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('restroom')}
              >
                <img src={assets.pictos.restroom.default} alt="restroom" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.restroom.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'restroom' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* smoking */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('smoking')}
              >
                <img src={assets.pictos.smoking.default} alt="smoking" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.smoking.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'smoking' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>

            {/* ピクトボタン行2（コインロッカー・ATM・エレベーター） */}
            <div style={{ display: "flex", flexDirection: "row", gap: "30px", alignSelf: "flex-start", flexShrink: 0, marginTop: "30px" }}>
              {/* lockers */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('lockers')}
              >
                <img src={assets.pictos.lockers.default} alt="lockers" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.lockers.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'lockers' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* atm */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('atm')}
              >
                <img src={assets.pictos.atm.default} alt="atm" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.atm.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'atm' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* elevator */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('elevator')}
              >
                <img src={assets.pictos.elevator.default} alt="elevator" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.elevator.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'elevator' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>

            {/* フロアボタン（下・中央）上から 4F→3F→2F→1F */}
            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "30px", flexShrink: 0, marginTop: "50px" }}
            >
              {((['4F', '3F', '2F', '1F'] as const)).map(floor => (
                <div
                  key={floor}
                  style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: currentFloor === floor ? "none" : "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))", transition: "filter 0.3s ease-in-out" }}
                  onClick={() => handleFloorSelect(floor)}
                >
                  <img src={assets.floorButtons[floor].default} alt={floor} draggable={false}
                    style={{ width: "555px", height: "174px", display: "block" }} />
                  <img src={assets.floorButtons[floor].highlight} alt="" draggable={false}
                    style={{ position: "absolute", top: 0, left: 0, width: "555px", height: "174px", display: "block",
                      opacity: currentFloor === floor ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
                  {currentFloorSetting === floor && assets.currentFloorIcon && (
                    <img src={assets.currentFloorIcon} alt="Current Floor" draggable={false}
                      style={{ position: "absolute", top: "-45px", left: "0px", zIndex: 5, pointerEvents: "none", width: "320px", height: "auto" }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* インナーシャドウオーバーレイ */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "40px",
              boxShadow: "inset 10px 10px 30px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* インフォコンテナ */}
      <div
        style={{
          width: "700px",
          height: "2160px",
          backgroundColor: "#555555",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "25px",
        }}
      >
        {/* 営業時間 */}
        <img
          src={assets.openTime}
          alt=""
          style={{
            width: "650px",
            height: "453px",
            flexShrink: 0,
            display: "block",
          }}
        />

        {/* ショップリストコンテナ */}
        <div
          style={{
            width: "650px",
            height: "1338px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
            marginTop: "25px",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* ショップリスト */}
          <AnimatePresence initial={false} custom={genreDirection}>
            {!selectedShopDetail && (
              <motion.div
                key={`list-${selectedGenre}-${currentFloor}`}
                ref={shopListScrollRef}
                custom={genreDirection}
                variants={listVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="halong-shop-list-scroll"
                transition={{
                  x: { type: "tween", duration: genreDirection === 0 ? FLOOR_ANIM_DURATION : 0.5, ease: "easeInOut" },
                  opacity: { duration: genreDirection === 0 ? FLOOR_ANIM_DURATION : 0.5 },
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  padding: "25px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "25px",
                  boxSizing: "border-box",
                }}
              >
                {filteredShops.map(shop => (
                  <div
                    key={shop.id}
                    onClick={() => { handleShopTap(String(shop.id), shop.floorKey, shop.logoDataUrl); setSelectedShopDetail(shop); }}
                    style={{
                      width: "600px",
                      height: "120px",
                      borderRadius: "10px",
                      backgroundColor: "#ffffff",
                      flexShrink: 0,
                      filter: "drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.4))",
                      position: "relative",
                      cursor: "pointer",
                      touchAction: "pan-y",
                    }}
                  >
                    {/* ロゴエリア 120×120 */}
                    <div style={{ position: "absolute", left: 0, top: 0, width: "120px", height: "120px", overflow: "hidden", borderRadius: "10px 0 0 10px" }}>
                      {shop.logoDataUrl && (
                        <img src={shop.logoDataUrl} alt={shop.name} draggable={false}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                      )}
                    </div>

                    {/* フロアラベル 黒（幅は言語ごとの最大テキスト幅に動的変更） */}
                    <div style={{ position: "absolute", left: "120px", top: 0, width: `${floorLabelWidth}px`, height: "30px", backgroundColor: "#000000",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff", fontFamily: '"Segoe UI", "Noto Sans", sans-serif' }}>{getFloorDisplay(shop, selectedLang)}</span>
                    </div>

                    {/* 区画番号ラベル グレー（幅は言語ごとの最大テキスト幅に動的変更） */}
                    {shop.section && (
                      <div style={{ position: "absolute", left: `${120 + floorLabelWidth}px`, top: 0, width: `${sectionLabelWidth}px`, height: "30px", backgroundColor: "#888888",
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff", fontFamily: '"Segoe UI", "Noto Sans", sans-serif' }}>{shop.section}</span>
                      </div>
                    )}

                    {/* ショップ名 */}
                    <div
                      style={{
                        position: "absolute",
                        left: "140px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: "24px",
                        fontWeight: "bold",
                        color: "#000000",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "440px",
                      }}
                    >
                      {getDisplayName(shop, selectedLang)}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ショップ詳細パネル（フェードイン） */}
          <AnimatePresence>
            {selectedShopDetail && (
              <motion.div
                key="shop-detail"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                style={{ position: "absolute", inset: 0 }}
              >
                <ShopDetailPanel
                  shop={selectedShopDetail}
                  lang={selectedLang}
                  onClose={handleCloseDetail}
                  assets={assets}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* インナーシャドウオーバーレイ */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "20px",
              boxShadow: "inset 4px 4px 12px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
              zIndex: 2,
            }}
          />
        </div>

        {/* ジャンルコンテナ */}
        <div
          style={{
            width: "650px",
            height: "150px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
            marginTop: "25px",
            flexShrink: 0,
            position: "relative",
          }}
        >
          {/* ジャンルスクロールエリア（タッチスクロール対応、スクロールバー非表示） */}
          <div
            ref={genreScrollRef}
            className="halong-genre-scroll"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              overflowX: "auto",
              display: "flex",
              alignItems: "center",
              cursor: "grab",
              userSelect: "none",
              scrollbarWidth: "none",
            }}
          >
            <div style={{ display: "flex", gap: "15px", padding: "0 15px", flexShrink: 0 }}>
              {GENRES.map(genre => (
                <div
                  key={genre}
                  style={{ position: "relative", cursor: "pointer", touchAction: "pan-x", flexShrink: 0 }}
                  onClick={() => handleGenreSelect(genre)}
                >
                  <img
                    src={assets.genres[genre]}
                    alt={genre}
                    draggable={false}
                    style={{ width: "120px", height: "120px", display: "block" }}
                  />
                  <img
                    src={assets.genres[`${genre}Highlight` as keyof typeof assets.genres]}
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "120px",
                      height: "120px",
                      display: "block",
                      opacity: selectedGenre === genre ? 1 : 0,
                      transition: "opacity 0.3s ease-in-out",
                      pointerEvents: "none",
                      filter: "drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.4))",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* prevボタン */}
          {canScrollLeft && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "33px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                touchAction: "none",
                zIndex: 10,
                opacity: pressedGenreNav === 'prev' ? 0.6 : 1,
                transition: "opacity 0.1s ease-in-out",
              }}
              onClick={() => scrollGenre('prev')}
              onMouseDown={() => setPressedGenreNav('prev')}
              onMouseUp={() => setPressedGenreNav(null)}
              onMouseLeave={() => setPressedGenreNav(null)}
              onTouchStart={() => setPressedGenreNav('prev')}
              onTouchEnd={() => setPressedGenreNav(null)}
            >
              <img src={assets.genres.prev} alt="prev" draggable={false}
                style={{ width: "33px", height: "74px", display: "block" }} />
            </div>
          )}

          {/* nextボタン */}
          {canScrollRight && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: "33px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                touchAction: "none",
                zIndex: 10,
                opacity: pressedGenreNav === 'next' ? 0.6 : 1,
                transition: "opacity 0.1s ease-in-out",
              }}
              onClick={() => scrollGenre('next')}
              onMouseDown={() => setPressedGenreNav('next')}
              onMouseUp={() => setPressedGenreNav(null)}
              onMouseLeave={() => setPressedGenreNav(null)}
              onTouchStart={() => setPressedGenreNav('next')}
              onTouchEnd={() => setPressedGenreNav(null)}
            >
              <img src={assets.genres.next} alt="next" draggable={false}
                style={{ width: "33px", height: "74px", display: "block" }} />
            </div>
          )}

          {/* インナーシャドウオーバーレイ */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "20px",
              boxShadow: "inset 4px 4px 12px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
              zIndex: 20,
            }}
          />
        </div>

        {/* 言語選択ボタン＋ポップアップ */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            marginTop: "25px",
            marginBottom: "25px",
            width: "658px",
          }}
        >
          {/* ポップアップ（言語選択） */}
          {langPopupOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "absolute",
                bottom: "calc(100% + 10px)",
                left: "29px",
                width: "600px",
                zIndex: 100,
                transformOrigin: "bottom center",
              }}
            >
              {/* 背景 */}
              <img src={assets.langButtons.select.bg} alt="" draggable={false}
                style={{ width: "600px", height: "321px", display: "block", filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }} />
              {/* ボタン群（bg上に絶対配置） */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingTop: "20px",
                  paddingLeft: "20px",
                  paddingRight: "20px",
                  gap: "20px",
                  boxSizing: "border-box",
                }}
              >
                {((['vn', 'en', 'ja'] as const)).map(lang => (
                  <div
                    key={lang}
                    style={{ position: "relative", cursor: "pointer", touchAction: "none", width: "560px", flexShrink: 0, filter: selectedLang === lang ? "none" : "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))", transition: "filter 0.3s ease-in-out" }}
                    onClick={() => { setSelectedLang(lang); setLangPopupOpen(false); }}
                  >
                    <img src={assets.langButtons.select[lang]} alt={lang} draggable={false}
                      style={{ width: "560px", height: "66px", display: "block" }} />
                    <img src={assets.langButtons.select[`${lang}Highlight` as 'enHighlight' | 'jaHighlight' | 'vnHighlight']} alt="" draggable={false}
                      style={{
                        position: "absolute", top: 0, left: 0, width: "560px", height: "66px", display: "block",
                        opacity: selectedLang === lang ? 1 : 0,
                        transition: "opacity 0.3s ease-in-out",
                        pointerEvents: "none",
                      }} />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 現在の言語ボタン */}
          <img
            src={assets.langButtons[selectedLang]}
            alt={selectedLang}
            draggable={false}
            style={{
              width: "658px",
              height: "94px",
              display: "block",
              cursor: "pointer",
              touchAction: "none",
              filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))",
            }}
            onClick={() => setLangPopupOpen(prev => !prev)}
          />
        </div>
      </div>
    </div>
  );
}
