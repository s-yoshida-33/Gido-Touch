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
import type { CmsSettings } from '../../types/cmsSettings';
import VerticalVideoSlot from '../../components/VerticalVideoSlot';
import type { HalongShop, HalongLang } from '../../hooks/useHalongShops';
import { ShopDetailPanel } from './ShopDetailPanel';
import { ScalableText } from '../../components/ScalableText';
import { TOUCH_SOUND_EVENT } from '../../hooks/useTouchSound';
import { HALONG_PICTO_KEYS, pictoTagFromKey, pictoKeyFromTag, type HalongPictoKey } from '../../config/halongPictos';

const HALONG_REFERENCE_MAP_WIDTH = 1920;

// ── レイアウト寸法（画面 3840×2160） ─────────────────────────────
// 左: 余白50 + マップエリア(2164) + 余白50 = 2264
//   縦: 余白50 + マップエリア(2164×1530) + 100 + ピクト列(234×165×8) + 100 + フロアボタン列(396×165×5) + 余白50 = 2160
// 右: グレー背景(1576) = 余白25 + [ショップリスト 650×1935 / ジャンル 650×150] + 余白25
//                        + [CMS 851×1513 / 営業時間 851×453 / 言語 851×94] + 余白25
const MAIN_WIDTH = 2164;
const MAP_HEIGHT = 1530;
const BUTTON_ROW_GAP = 100; // マップエリア→ピクト列、ピクト列→フロアボタン列の間隔
const PICTO_BUTTON_SIZE = { width: 234, height: 165 };
const FLOOR_BUTTON_SIZE = { width: 396, height: 165 };
const SIDE_GAP = 25;
const SHOP_COLUMN_WIDTH = 650;
const INFO_COLUMN_WIDTH = 851;

// フロアボタンの並び（左→右）
const FLOOR_BUTTONS = ['B', '1F', '2F', '3F', '4F'] as const;
type FloorButtonKey = typeof FLOOR_BUTTONS[number];
const FLOOR_BUTTON_FALLBACK_LABEL: Record<FloorButtonKey, string> = { B: 'B', '1F': '1st', '2F': '2nd', '3F': '3rd', '4F': '4th' };

/** アセット未配置時の仮表示（レイアウト確認用の枠＋ラベル） */
function AssetPlaceholder({ label, width, height, fontSize = 28 }: { label: string; width: number | string; height: number | string; fontSize?: number }) {
  return (
    <div style={{
      width, height, boxSizing: "border-box", border: "3px dashed #999999", borderRadius: "12px",
      display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
      color: "#777777", fontSize: `${fontSize}px`, fontWeight: "bold", backgroundColor: "#f4f4f4", padding: "8px",
    }}>
      {label}
    </div>
  );
}

// ベトナム語の声調記号（ặ, ở 等）を正しく表示するため Be Vietnam Pro を使用（src/styles/fonts.css で定義）
const HALONG_FONT_FAMILY = '"Be Vietnam Pro", sans-serif';

// 中国語・韓国語表示時は、Be Vietnam Pro に無い漢字・ハングルだけを専用フォントで表示する
// （英数字は全言語共通で Be Vietnam Pro）
// 中国語は簡体・繁体で太さ・字面をそろえるため、同じデザインの Noto Sans SC / TC を同梱して使用
// （src/styles/fonts.css で定義。読込失敗時は Windows 標準の中国語フォントにフォールバック）
const HALONG_FONT_FAMILY_BY_LANG: Record<HalongLang, string> = {
  vn: HALONG_FONT_FAMILY,
  en: HALONG_FONT_FAMILY,
  ja: HALONG_FONT_FAMILY,
  cn: '"Be Vietnam Pro", "Noto Sans SC", "Microsoft YaHei", sans-serif',     // 簡体
  tw: '"Be Vietnam Pro", "Noto Sans TC", "Microsoft JhengHei", sans-serif',  // 繁体
  kr: '"Be Vietnam Pro", "Malgun Gothic", sans-serif',                       // 韓国語: 맑은 고딕
};

// グリッド表示のカード幅と、フロアラベルの幅（カード中央に配置）・ラベル内の左右の余白
const GRID_CARD_WIDTH = 290;
const GRID_FLOOR_LABEL_WIDTH = 270;
const GRID_LABEL_PADDING_X = 1;

// リスト表示のフロアラベル内の左右の余白（幅は言語ごとの最長テキスト＋左右の余白）
const LIST_LABEL_PADDING_X = 16;

// フォント読込の判定用サンプル（漢字・ハングルを含めて、言語ごとのフォールバック先も読み込ませる）
const FONT_LOAD_SAMPLE = '1F 1楼 1樓 1층';

// 言語選択ポップアップの並び順（上から）
const LANGS = ['vn', 'en', 'ja', 'cn', 'tw', 'kr'] as const satisfies readonly HalongLang[];

// HTMLのlang属性。Be Vietnam Pro に無い漢字・ハングルを、言語に合ったシステムフォント
// （簡体/繁体/日本語/韓国語の字形）でフォールバック表示させるために指定する
const HTML_LANG: Record<HalongLang, string> = {
  vn: 'vi', en: 'en', ja: 'ja', cn: 'zh-Hans', tw: 'zh-Hant', kr: 'ko',
};

// フロアの階数（B=0, 1F=1 …）。フロア切替アニメーションの方向・最寄りフロアの判定に使う
function getFloorNum(floor: string): number {
  if (floor === 'B') return 0;
  const n = parseInt(floor.replace('F', ''), 10);
  return Number.isNaN(n) ? 1 : n;
}

const IDLE_TIMEOUT_MS = 180000; // 3分

// マップタップでのショップ選択: ヒット半径（地図に対する％）と、タップとみなす最大移動量(px)
const MAP_TAP_HIT_RADIUS = 5.0;
const MAP_TAP_MOVE_THRESHOLD = 10;
const FLOOR_ANIM_DURATION = 0.35;

const GENRES = ['all', 'food', 'fashion', 'goods'] as const;
type Genre = typeof GENRES[number];

// フロアラベルの色（ジャンル別、リスト・グリッド共通）
const FLOOR_LABEL_COLOR: Record<string, string> = {
  food:    '#EA9500',
  fashion: '#138EE3',
  goods:   '#A6C000',
};
function getFloorLabelColor(genre: string): string {
  return FLOOR_LABEL_COLOR[genre] ?? '#888888';
}

// ショップリストの切替アニメーション（フロア切替・ジャンル切替共通のクロスフェード）
const listVariants: Variants = {
  enter: { opacity: 0 },
  center: { zIndex: 1, opacity: 1 },
  exit: { opacity: 0 },
};

interface HalongShopListScreenProps {
  locationIconSettings?: LocationIconSettingsPerFloor;
  shopPositions?: ShopPositionSettings;
  pictoSettings?: PictoSettings;
  cmsSettings?: CmsSettings;
  shopListLayout?: 'list' | 'grid';
  hiddenShopIds?: string[];
}

export default function HalongShopListScreen({ locationIconSettings: locationIconSettingsProp, shopPositions: shopPositionsProp, pictoSettings: pictoSettingsProp, cmsSettings, shopListLayout = 'grid', hiddenShopIds }: HalongShopListScreenProps = {}) {
  const [selectedLang, setSelectedLang] = useState<HalongLang>('vn');
  // 現在地アイコンの言語別設定（speechBubbleJa/En/Vn）は vn/en/ja のみのため、
  // cn/tw/kr 選択中は直前の vn/en/ja の設定を使う（アセットも直前の言語にフォールバックするため）
  const [lastBaseLang, setLastBaseLang] = useState<'vn' | 'en' | 'ja'>('vn');
  if ((selectedLang === 'vn' || selectedLang === 'en' || selectedLang === 'ja') && selectedLang !== lastBaseLang) {
    setLastBaseLang(selectedLang);
  }
  const [langPopupOpen, setLangPopupOpen] = useState(false);
  const assets = useHalongAssets(selectedLang);
  const fontFamily = HALONG_FONT_FAMILY_BY_LANG[selectedLang];
  const maps = useHalongMaps();
  const loadedShops = useHalongShops();
  // 設定で非表示指定されたショップIDを除外
  const allShops = useMemo(() => {
    if (!hiddenShopIds || hiddenShopIds.length === 0) return loadedShops;
    return loadedShops.filter(s => !hiddenShopIds.includes(s.shopId));
  }, [loadedShops, hiddenShopIds]);
  const [currentFloor, setCurrentFloor] = useState<string>('1F');
  const [selectedPicto, setSelectedPicto] = useState<string | null>(null);
  const [pressedGenreNav, setPressedGenreNav] = useState<'prev' | 'next' | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [showFloorLabel, setShowFloorLabel] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<Genre>('all');
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

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapTapStartRef = useRef<{ x: number; y: number } | null>(null);
  const firstFloorImgRef = useRef<HTMLImageElement>(null);
  const transformComponentRef = useRef<ReactZoomPanPinchContentRef>(null);

  // マップを初期表示（等倍・中央）に戻す
  // resetTransform(0) / setTransform(..., 0) は実行中のアニメーション（ショップへのフォーカス等）を
  // 止めないため、ピンが降りる途中で切り替えると戻した後もズームが続いて拡大されたまま残る。
  // アニメーション経由（1ms 以上）で設定し、実行中のアニメーションを確実に打ち切る
  function resetMapTransform(animationMs = 1) {
    transformComponentRef.current?.setTransform(0, 0, 1, animationMs, 'easeOut');
  }
  // ショップ選択解除時のズームアウト（詳細パネルを閉じたときと同じ動き）
  const MAP_RESET_ANIM_MS = 500;
  // ズームアウト中にフロア切り替えの即時リセットで上書きしないための終了予定時刻
  const smoothMapResetUntilRef = useRef(0);
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

  const ALL_FLOORS = FLOOR_BUTTONS;

  // Webフォントは使用時に遅延ロードされるため、言語（フォント指定）ごとに読込完了後にラベル幅を再計測する
  const [labelFontLoadCount, setLabelFontLoadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    document.fonts.load(`bold 20px ${fontFamily}`, FONT_LOAD_SAMPLE)
      .catch(() => undefined)
      .then(() => { if (!cancelled) setLabelFontLoadCount(c => c + 1); });
    return () => { cancelled = true; };
  }, [fontFamily]);

  // Canvas measureText でリスト表示のフロアラベルの幅（言語ごとの最長テキスト＋左右の余白）を計算（言語切替時に再計算）
  const floorLabelWidth = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || allShops.length === 0) return 56;
    ctx.font = `bold 20px ${fontFamily}`;
    const MIN_WIDTH = 48;
    let maxFloor = 0;
    for (const shop of allShops) {
      maxFloor = Math.max(maxFloor, ctx.measureText(getFloorDisplay(shop, selectedLang)).width);
    }
    return Math.max(MIN_WIDTH, Math.ceil(maxFloor + LIST_LABEL_PADDING_X * 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFontLoadCount はフォント読込後の再計測トリガー
  }, [allShops, selectedLang, fontFamily, labelFontLoadCount]);

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

      const fA = (FLOOR_BUTTONS as readonly string[]).indexOf(a.floorKey);
      const fB = (FLOOR_BUTTONS as readonly string[]).indexOf(b.floorKey);
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

  // objectFit: contain のマップ画像メトリクスを計算（アイコンの正確な位置スケーリング用）
  // マップエリア(2164×1530)と比率の異なる地図(旧2385×1795等)でも切れずに全体を表示する
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
      displayHeight = containerHeight;
      displayWidth = displayHeight * imageAspect;
      offsetX = (containerWidth - displayWidth) / 2;
      offsetY = 0;
    } else {
      displayWidth = containerWidth;
      displayHeight = displayWidth / imageAspect;
      offsetX = 0;
      offsetY = (containerHeight - displayHeight) / 2;
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

  // 固定時間のイージングスクロール。ジャンルアイコンは5件のみで実スクロール可能距離が
  // 短く（コンテナ幅650pxに対しコンテンツ幅690px程度）、ネイティブのscrollTo({behavior:'smooth'})
  // だと距離が短すぎて瞬時に切り替わったように見えてしまう不具合があったため、
  // 距離によらず一定時間(800ms)かけてアニメーションする（通常のShopListScreen.tsxの
  // smoothScrollTo/scrollToStart/scrollToEndと同じ方式）。
  function smoothScrollGenreTo(target: number, duration = 800) {
    const el = genreScrollRef.current;
    if (!el) return;
    const start = el.scrollLeft;
    const distance = target - start;
    const startTime = performance.now();

    const easeInOutCubic = (t: number): number =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const t = Math.min(elapsed / duration, 1);
      el.scrollLeft = start + distance * easeInOutCubic(t);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  function scrollGenre(direction: 'prev' | 'next') {
    const el = genreScrollRef.current;
    if (!el) return;
    // ページ送りではなく、先頭(0)・終端(scrollWidth - clientWidth)へ直接スクロールする。
    const target = direction === 'next' ? el.scrollWidth - el.clientWidth : 0;
    smoothScrollGenreTo(target);
  }

  // マップフロア切り替えアニメーション（Mini準拠）
  useLayoutEffect(() => {
    const newFloor = currentFloor;
    const isInitial = isInitialFloorRenderRef.current;
    const duration = FLOOR_ANIM_DURATION;

    const prevFloor = prevFloorRef.current;
    const current = getFloorNum(prevFloor || '1F');
    const next = getFloorNum(newFloor);

    let direction = 0;
    if (next !== current) {
      if (current === 0 || next === 0) direction = next > current ? 1 : -1;
      else if (next === 1) direction = -1;
      else if (next === 4) direction = 1;
      else direction = next > current ? 1 : -1;
    }

    prevFloorRef.current = currentFloor;

    if (!isInitial && direction !== 0) {
      const smoothResetRunning =
        Date.now() < smoothMapResetUntilRef.current &&
        transformComponentRef.current?.instance.animation != null;
      if (!smoothResetRunning) resetMapTransform();
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

  // ショップ選択中にフロア・ジャンル・ピクトを切り替えた際、選択を解除してマップを初期表示に戻す
  function clearShopDetailForNavigation() {
    resetMapTransform(MAP_RESET_ANIM_MS);
    smoothMapResetUntilRef.current = Date.now() + MAP_RESET_ANIM_MS;
    setSelectedShopDetail(null);
    setSelectedShopId(null);
    setVisibleShopId(null);
    setSelectedShopLogoUrl(null);
    prevMapStateRef.current = null;
  }

  function handleFloorSelect(floor: string) {
    if (selectedShopDetail !== null) clearShopDetailForNavigation();
    setCurrentFloor(floor);
  }

  function handleGenreSelect(genre: Genre) {
    if (genre === selectedGenre) return;
    if (selectedShopDetail !== null) clearShopDetailForNavigation();
    setSelectedGenre(genre);
  }

  function handlePictoSelect(pictoKey: HalongPictoKey) {
    if (selectedShopDetail !== null) clearShopDetailForNavigation();
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

    const tag = pictoTagFromKey(pictoKey);
    const instances = pictoSettings ? Object.values(pictoSettings.instances).filter(i => i.tag === tag) : [];

    if (instances.length === 0) {
      setVisiblePictoTag(tag);
      return;
    }

    const hasOnCurrentFloor = instances.some(i => i.floor === currentFloor);

    if (!hasOnCurrentFloor) {
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

  // ショップリストのタップと同じ選択処理（ピン表示・フォーカス・詳細パネル）
  function selectShop(shop: HalongShop) {
    handleShopTap(String(shop.id), shop.floorKey, shop.logoDataUrl);
    setSelectedShopDetail(shop);
  }

  // マップタップでのショップ選択（Gido-Touch-Mini と同方式）:
  // タップ位置から半径 MAP_TAP_HIT_RADIUS(%) 以内で、ショップ位置設定の座標が最も近い現在フロアのショップを選択する
  function handleMapPointerDown(e: React.PointerEvent) {
    mapTapStartRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    // パン操作（10px超の移動）はタップとして扱わない
    const start = mapTapStartRef.current;
    mapTapStartRef.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MAP_TAP_MOVE_THRESHOLD) return;

    const metrics = mapImageMetricsRef.current;
    const container = mapContainerRef.current;
    if (!shopPositions || !metrics || !container) return;

    // タップ位置を地図画像上の％座標に変換（ズーム・パン中も getBoundingClientRect が変形後の矩形を返す）
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * container.clientWidth;
    const py = ((e.clientY - rect.top) / rect.height) * container.clientHeight;
    const xPercent = ((px - metrics.offsetX) / metrics.displayWidth) * 100;
    const yPercent = ((py - metrics.offsetY) / metrics.displayHeight) * 100;

    let nearest: HalongShop | null = null;
    let minDistance = MAP_TAP_HIT_RADIUS;
    for (const shop of allShops) {
      // ショップリストに表示されないショップ（区画未設定）は対象外
      if (!shop.section || shop.section.trim() === '') continue;
      const pos = shopPositions.positions[String(shop.id)];
      if (!pos || pos.floor !== currentFloor) continue;
      const x = pos.x <= 1 ? pos.x * 100 : pos.x;
      const y = pos.y <= 1 ? pos.y * 100 : pos.y;
      const distance = Math.hypot(x - xPercent, y - yPercent);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = shop;
      }
    }

    if (nearest) {
      // マップは cursor:pointer ではないためグローバルのタップ音が鳴らない。ヒット時のみ明示的に鳴らす
      window.dispatchEvent(new Event(TOUCH_SOUND_EVENT));
      selectShop(nearest);
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
        fontFamily,
      }}
      lang={HTML_LANG[selectedLang]}
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

      {/* 左エリア: 余白50px + マップエリア → 100px → ピクト列 → 100px → フロアボタン列 + 余白50px */}
      <div
        style={{
          width: `${MAIN_WIDTH + 100}px`,
          height: "2160px",
          padding: "50px",
          boxSizing: "border-box",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* マップエリア（2164×1530） */}
        <div
          style={{
            position: "relative",
            width: `${MAIN_WIDTH}px`,
            height: `${MAP_HEIGHT}px`,
            flexShrink: 0,
            borderRadius: "40px",
            overflow: "hidden",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
          }}
        >
          {/* マップコンテナ（2164×1530） */}
          <div
            ref={mapContainerRef}
            style={{
              width: `${MAIN_WIDTH}px`,
              height: `${MAP_HEIGHT}px`,
              flexShrink: 0,
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
                  <div
                    style={{ position: "relative", width: "100%", height: "100%" }}
                    onPointerDown={handleMapPointerDown}
                    onClick={handleMapClick}
                  >
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
                          style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }}
                        />

                        {/* 現在地アイコン: 設定フロアのレイヤー内に配置してフロアアニメーションと同期 */}
                        {locationIconSettings && floor === currentFloorSetting && (
                          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                            <LocationIconsOverlay
                              settings={getLocationIconSettingsForFloor(locationIconSettings, floor as FloorId)}
                              imageMetrics={mapImageMetrics}
                              speechBubbleSrc={assets.speechBubbleIconSrc}
                              locationSrc={assets.locationIconSrc}
                              language={lastBaseLang}
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
                            const assetsKey = pictoKeyFromTag(visiblePictoTag);
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

            {/* ヒント（高さ70・横幅は言語ごとの文字数に応じて画像の比率どおり、マップエリアの左から90px・下から50px） */}
            <img
              src={assets.hint}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "90px",
                bottom: "50px",
                width: "auto",
                height: "70px",
                display: "block",
                opacity: showHint ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />
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

          {/* ピクトボタン（マップエリアの100px下、横1列8個を両端揃え、並びは src/config/halongPictos.ts の定義順） */}
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: `${MAIN_WIDTH}px`, marginTop: `${BUTTON_ROW_GAP}px`, flexShrink: 0 }}>
            {HALONG_PICTO_KEYS.map(key => (
              <div
                key={key}
                style={{ position: "relative", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: selectedPicto === key ? "none" : "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))", transition: "filter 0.3s ease-in-out" }}
                onClick={() => handlePictoSelect(key)}
              >
                {assets.pictos[key].default ? (
                  <img src={assets.pictos[key].default} alt={key} draggable={false}
                    style={{ width: `${PICTO_BUTTON_SIZE.width}px`, height: `${PICTO_BUTTON_SIZE.height}px`, display: "block" }} />
                ) : (
                  <AssetPlaceholder label={key} width={PICTO_BUTTON_SIZE.width} height={PICTO_BUTTON_SIZE.height} fontSize={22} />
                )}
                {assets.pictos[key].highlight && (
                  <img src={assets.pictos[key].highlight} alt="" draggable={false}
                    style={{ position: "absolute", top: 0, left: 0, width: `${PICTO_BUTTON_SIZE.width}px`, height: `${PICTO_BUTTON_SIZE.height}px`, display: "block",
                      opacity: selectedPicto === key ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
                )}
              </div>
            ))}
          </div>

          {/* フロアボタン（ピクト列の100px下、横1列を両端揃え、左から B→1F→2F→3F→4F） */}
          <div style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", width: `${MAIN_WIDTH}px`, marginTop: `${BUTTON_ROW_GAP}px`, flexShrink: 0 }}>
            {FLOOR_BUTTONS.map(floor => {
              const isCurrent = currentFloor === floor;
              const button = assets.floorButtons[floor];
              return (
                <div
                  key={floor}
                  style={{ position: "relative", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: isCurrent ? "none" : "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))", transition: "filter 0.3s ease-in-out" }}
                  onClick={() => handleFloorSelect(floor)}
                >
                  {button.default ? (
                    <img src={button.default} alt={floor} draggable={false}
                      style={{ width: `${FLOOR_BUTTON_SIZE.width}px`, height: `${FLOOR_BUTTON_SIZE.height}px`, display: "block" }} />
                  ) : (
                    <AssetPlaceholder label={FLOOR_BUTTON_FALLBACK_LABEL[floor]} width={FLOOR_BUTTON_SIZE.width} height={FLOOR_BUTTON_SIZE.height} fontSize={64} />
                  )}
                  {button.highlight && (
                    <img src={button.highlight} alt="" draggable={false}
                      style={{ position: "absolute", top: 0, left: 0, width: `${FLOOR_BUTTON_SIZE.width}px`, height: `${FLOOR_BUTTON_SIZE.height}px`, display: "block",
                        opacity: isCurrent ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
                  )}
                  {currentFloorSetting === floor && assets.currentFloorIcon && (
                    <img src={assets.currentFloorIcon} alt="Current Floor" draggable={false}
                      style={{ position: "absolute", top: "-55px", left: "50%", transform: "translateX(-50%)", zIndex: 5, pointerEvents: "none", width: "320px", height: "auto" }} />
                  )}
                </div>
              );
            })}
          </div>
      </div>

      {/* インフォコンテナ（グレー背景 1576×2160）: 左列=ショップリスト＋ジャンル、右列=CMS＋営業時間＋言語 */}
      <div
        style={{
          flex: 1,
          height: "2160px",
          backgroundColor: "#555555",
          display: "flex",
          flexDirection: "row",
          gap: `${SIDE_GAP}px`,
          padding: `${SIDE_GAP}px`,
          boxSizing: "border-box",
        }}
      >
       {/* 左列（650）: ショップリスト 650×1935 + ジャンル 650×150 */}
       <div style={{ width: `${SHOP_COLUMN_WIDTH}px`, flexShrink: 0, display: "flex", flexDirection: "column", gap: `${SIDE_GAP}px` }}>
        {/* ショップリストコンテナ */}
        <div
          style={{
            width: `${SHOP_COLUMN_WIDTH}px`,
            height: "1935px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* ショップリスト */}
          <AnimatePresence initial={false}>
            <motion.div
                key={`list-${selectedGenre}-${currentFloor}`}
                ref={(node) => {
                  if (node) shopListScrollRef.current = node;
                  // アンマウント時はnullにしない: AnimatePresenceの新要素が先にrefを
                  // 取得済みのため、ここでnullにすると現在表示中のリストの参照を失う
                }}
                variants={listVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="halong-shop-list-scroll"
                transition={{ opacity: { duration: FLOOR_ANIM_DURATION } }}
                style={{
                  position: "absolute",
                  inset: 0,
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  padding: "25px",
                  display: "flex",
                  flexDirection: shopListLayout === 'grid' ? "row" : "column",
                  flexWrap: shopListLayout === 'grid' ? "wrap" : "nowrap",
                  gap: shopListLayout === 'grid' ? "20px" : "25px",
                  boxSizing: "border-box",
                  alignContent: "flex-start",
                }}
              >
                {filteredShops.map(shop => shopListLayout === 'grid' ? (
                  /* グリッドアイテム */
                  <div
                    key={shop.id}
                    onClick={() => selectShop(shop)}
                    style={{
                      width: "290px",
                      height: "405px",
                      borderRadius: "10px",
                      backgroundColor: "#ffffff",
                      flexShrink: 0,
                      filter: "drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.4))",
                      position: "relative",
                      cursor: "pointer",
                      touchAction: "pan-y",
                      overflow: "hidden",
                    }}
                  >
                    {/* ロゴ 290×290 */}
                    <div style={{ position: "absolute", left: 0, top: 0, width: "290px", height: "290px", overflow: "hidden", borderRadius: "10px 10px 0 0" }}>
                      {shop.logoDataUrl && (
                        <img src={shop.logoDataUrl} alt={shop.name} draggable={false}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                      )}
                    </div>

                    {/* フロアラベル（カード中央に固定幅、色はジャンル別。収まらない場合は横方向に縮小） */}
                    <div style={{ position: "absolute", left: `${(GRID_CARD_WIDTH - GRID_FLOOR_LABEL_WIDTH) / 2}px`, top: "310px", width: `${GRID_FLOOR_LABEL_WIDTH}px`, height: "30px", backgroundColor: getFloorLabelColor(shop.genre),
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ScalableText text={getFloorDisplay(shop, selectedLang)} align="center"
                        style={{ width: `${GRID_FLOOR_LABEL_WIDTH - GRID_LABEL_PADDING_X * 2}px`, fontSize: "20px", fontWeight: "bold", color: "#ffffff", fontFamily }} />
                    </div>

                    {/* ショップ名（1行。はみ出す場合は省略記号） */}
                    <div style={{
                      position: "absolute", left: "10px", top: "356px",
                      fontSize: "24px", fontWeight: "bold", color: "#000000",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      maxWidth: "270px",
                    }}>
                      {getDisplayName(shop, selectedLang)}
                    </div>
                  </div>
                ) : (
                  /* リストアイテム */
                  <div
                    key={shop.id}
                    onClick={() => selectShop(shop)}
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

                    {/* フロアラベル（幅は言語ごとの最大テキスト幅に動的変更、色はジャンル別、左寄せ） */}
                    <div style={{ position: "absolute", left: "120px", top: 0, width: `${floorLabelWidth}px`, height: "30px", backgroundColor: getFloorLabelColor(shop.genre),
                      display: "flex", alignItems: "center", justifyContent: "flex-start", paddingLeft: `${LIST_LABEL_PADDING_X}px`, boxSizing: "border-box" }}>
                      <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff", fontFamily, whiteSpace: "nowrap" }}>{getFloorDisplay(shop, selectedLang)}</span>
                    </div>

                    {/* ショップ名（1行。はみ出す場合は省略記号） */}
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
                style={{ position: "absolute", inset: 0, zIndex: 2 }}
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
            width: `${SHOP_COLUMN_WIDTH}px`,
            height: "150px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
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
            {/* 4ボタンはコンテナ幅に収まるため均等配置（はみ出さない限りprev/nextは表示されない） */}
            <div style={{ display: "flex", justifyContent: "space-evenly", width: "100%", flexShrink: 0 }}>
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
       </div>

       {/* 右列（851）: CMS 851×1513 + 営業時間 851×453 + 言語 851×94 */}
       <div style={{ width: `${INFO_COLUMN_WIDTH}px`, flexShrink: 0, display: "flex", flexDirection: "column", gap: `${SIDE_GAP}px` }}>
        {/* CMS配信枠（縦9:16、851×1513） */}
        <div style={{ width: `${INFO_COLUMN_WIDTH}px`, height: "1513px", borderRadius: "20px", overflow: "hidden", position: "relative", flexShrink: 0 }}>
          {cmsSettings?.enabled && (
            <div style={{ position: "absolute", inset: 0 }}>
              <VerticalVideoSlot />
            </div>
          )}
        </div>

        {/* 営業時間（851×453） */}
        {assets.openTime ? (
          <img
            src={assets.openTime}
            alt=""
            style={{
              width: `${INFO_COLUMN_WIDTH}px`,
              height: "453px",
              flexShrink: 0,
              display: "block",
            }}
          />
        ) : (
          <AssetPlaceholder label="Open Time" width={INFO_COLUMN_WIDTH} height={453} />
        )}

        {/* 言語選択ボタン＋ポップアップ */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            width: `${INFO_COLUMN_WIDTH}px`,
          }}
        >
          {/* ポップアップ（言語選択、ボタン中央の上に表示） */}
          {langPopupOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{
                position: "absolute",
                bottom: "calc(100% + 10px)",
                left: `${(INFO_COLUMN_WIDTH - 600) / 2}px`,
                width: "600px",
                zIndex: 100,
                transformOrigin: "bottom center",
              }}
            >
              {/* 背景 */}
              <img src={assets.langButtons.select.bg} alt="" draggable={false}
                style={{ width: "600px", height: "579px", display: "block", filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }} />
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
                {LANGS.map(lang => (
                  <div
                    key={lang}
                    style={{ position: "relative", cursor: "pointer", touchAction: "none", width: "560px", flexShrink: 0, filter: selectedLang === lang ? "none" : "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))", transition: "filter 0.3s ease-in-out" }}
                    onClick={() => { setSelectedLang(lang); setLangPopupOpen(false); }}
                  >
                    <img src={assets.langButtons.select[lang]} alt={lang} draggable={false}
                      style={{ width: "560px", height: "66px", display: "block" }} />
                    <img src={assets.langButtons.select[`${lang}Highlight`]} alt="" draggable={false}
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
              width: `${INFO_COLUMN_WIDTH}px`,
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
    </div>
  );
}
