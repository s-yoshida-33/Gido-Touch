// src/hooks/useHalongAssets.ts
// ローカル端末アセット優先、失敗時はバンドルアセットにフォールバック

import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadGlobalSettings } from '../utils/settings';
import type { HalongLang } from './useHalongShops';
import { HALONG_PICTO_KEYS, type HalongPictoKey } from '../config/halongPictos';

// location icons（halong用アセットが無い場合の最終フォールバック）
import bundledSpeechBubbleSvg from '../assets/location/user.svg';
import bundledLocationSvg from '../assets/location/location.svg';

// ── バンドルアセット（フォールバック用） ──────────────────────────
// src/assets/malls/halong 配下のSVGを、ローカルアセット（list_mall_assets）と同じ
// 相対パス（例: "buttons/genres/cn/all.svg"）をキーにしたURLマップとして取り込む

const BUNDLED_PREFIX = '../assets/malls/halong/';

const BUNDLED: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>('../assets/malls/halong/**/*.svg', { eager: true, import: 'default' }),
  ).map(([path, url]) => [path.slice(BUNDLED_PREFIX.length), url]),
);

// ── 型定義 ───────────────────────────────────────────────────────

export interface HalongAssets {
  openTime: string;
  genres: {
    all:             string;
    allHighlight:    string;
    fashion:         string;
    fashionHighlight: string;
    goods:           string;
    goodsHighlight:  string;
    food:         string;
    foodHighlight: string;
    next:            string;
    prev:            string;
  };
  hint: string;
  floorLabels: { '1F': string; '2F': string; '3F': string; '4F': string };
  floorButtons: {
    '1F': { default: string; highlight: string };
    '2F': { default: string; highlight: string };
    '3F': { default: string; highlight: string };
    '4F': { default: string; highlight: string };
  };
  langButtons: {
    en: string;
    ja: string;
    vn: string;
    cn: string;
    tw: string;
    kr: string;
    select: {
      bg: string;
      en: string; enHighlight: string;
      ja: string; jaHighlight: string;
      vn: string; vnHighlight: string;
      cn: string; cnHighlight: string;
      tw: string; twHighlight: string;
      kr: string; krHighlight: string;
    };
  };
  pictos: Record<HalongPictoKey, { default: string; highlight: string }>;
  pictoMapIcons: Record<HalongPictoKey, string>;
  speechBubbleIconSrc: string;
  locationIconSrc: string;
  close: string;
  closeHighlight: string;
  currentFloorIcon: string;
}

// ── アセットビルダー ──────────────────────────────────────────────

/**
 * 1言語分のアセットを解決する。各キーはローカル → バンドルの順に探し、
 * 複数キーを渡した場合は先頭から最初に見つかったものを使う。どこにも無ければ空文字（=未配置）。
 */
function buildFor(local: Record<string, string> | null, lang: HalongLang): HalongAssets {
  const r = (...keys: string[]) => {
    for (const key of keys) {
      const url = local?.[key] || BUNDLED[key];
      if (url) return url;
    }
    return '';
  };
  return {
    openTime: r(`open-times/${lang}.svg`),
    genres: {
      all:             r(`buttons/genres/${lang}/all.svg`),
      allHighlight:    r(`buttons/genres/${lang}/all-hilight.svg`),
      fashion:         r(`buttons/genres/${lang}/fashion.svg`),
      fashionHighlight: r(`buttons/genres/${lang}/fashion-hilight.svg`),
      goods:           r(`buttons/genres/${lang}/goods.svg`),
      goodsHighlight:  r(`buttons/genres/${lang}/goods-hilight.svg`),
      food:         r(`buttons/genres/${lang}/food.svg`),
      foodHighlight: r(`buttons/genres/${lang}/food-hilight.svg`),
      next:            r('buttons/genres/next.svg'),
      prev:            r('buttons/genres/prev.svg'),
    },
    hint: r(`hint/${lang}.svg`),
    floorLabels: {
      '1F': r(`floor-labels/${lang}/1F.svg`),
      '2F': r(`floor-labels/${lang}/2F.svg`),
      '3F': r(`floor-labels/${lang}/3F.svg`),
      '4F': r(`floor-labels/${lang}/4F.svg`),
    },
    floorButtons: {
      '1F': { default: r(`buttons/floors/${lang}/1F-01.svg`), highlight: r(`buttons/floors/${lang}/1F-01-highlight.svg`) },
      '2F': { default: r(`buttons/floors/${lang}/2F-01.svg`), highlight: r(`buttons/floors/${lang}/2F-01-highlight.svg`) },
      '3F': { default: r(`buttons/floors/${lang}/3F-01.svg`), highlight: r(`buttons/floors/${lang}/3F-01-highlight.svg`) },
      '4F': { default: r(`buttons/floors/${lang}/4F-01.svg`), highlight: r(`buttons/floors/${lang}/4F-01-highlight.svg`) },
    },
    langButtons: {
      en: r('buttons/languages/en.svg'),
      ja: r('buttons/languages/ja.svg'),
      vn: r('buttons/languages/vn.svg'),
      cn: r('buttons/languages/cn.svg'),
      tw: r('buttons/languages/tw.svg'),
      kr: r('buttons/languages/kr.svg'),
      select: {
        bg:          r('buttons/languages/select/bg.svg'),
        en:          r('buttons/languages/select/en.svg'),
        enHighlight: r('buttons/languages/select/en-highlight.svg'),
        ja:          r('buttons/languages/select/ja.svg'),
        jaHighlight: r('buttons/languages/select/ja-highlight.svg'),
        vn:          r('buttons/languages/select/vn.svg'),
        vnHighlight: r('buttons/languages/select/vn-highlight.svg'),
        cn:          r('buttons/languages/select/cn.svg'),
        cnHighlight: r('buttons/languages/select/cn-highlight.svg'),
        tw:          r('buttons/languages/select/tw.svg'),
        twHighlight: r('buttons/languages/select/tw-highlight.svg'),
        kr:          r('buttons/languages/select/kr.svg'),
        krHighlight: r('buttons/languages/select/kr-highlight.svg'),
      },
    },
    pictos: Object.fromEntries(HALONG_PICTO_KEYS.map(key => [key, {
      default:   r(`buttons/pictos/${lang}/${key}.svg`),
      highlight: r(`buttons/pictos/${lang}/${key}-highlight.svg`),
    }])) as HalongAssets['pictos'],
    // マップ上のピクトピン。専用アイコンが無ければ日本語のピクトボタンで代用（従来どおり）
    pictoMapIcons: Object.fromEntries(HALONG_PICTO_KEYS.map(key => [key,
      r(`icons/pictos/${key}.svg`, `buttons/pictos/ja/${key}.svg`),
    ])) as HalongAssets['pictoMapIcons'],
    speechBubbleIconSrc: r(`icons/locations/user-${lang}.svg`),
    locationIconSrc:     r('icons/locations/location.svg'),
    close:               r(`buttons/closes/${lang}.svg`),
    closeHighlight:      r(`buttons/closes/${lang}-highlight.svg`),
    currentFloorIcon:    r(`icons/floors/current-${lang}.svg`),
  };
}

/** top の空文字（=未配置）の項目だけ base の値で埋める */
function fillMissing<T>(top: T, base: T): T {
  if (typeof top === 'string') return ((top as string) || base) as T;
  return Object.fromEntries(
    Object.entries(top as Record<string, unknown>).map(([k, v]) => [k, fillMissing(v, (base as Record<string, unknown>)[k])]),
  ) as T;
}

/**
 * 言語の選択履歴（新しい順）から表示アセットを導出する。
 * 選択中の言語で未配置のアセットは、履歴を遡って直前に表示していた言語のもので埋める
 * （履歴のどの言語にも無ければ en → 共通アイコンの順でフォールバック）。
 */
function buildAssets(local: Record<string, string> | null, history: HalongLang[]): HalongAssets {
  const chain = history.includes('en') ? history : [...history, 'en' as const];
  let result = buildFor(local, chain[chain.length - 1]);
  for (let i = chain.length - 2; i >= 0; i--) {
    result = fillMissing(buildFor(local, chain[i]), result);
  }
  return {
    ...result,
    speechBubbleIconSrc: result.speechBubbleIconSrc || bundledSpeechBubbleSvg,
    locationIconSrc: result.locationIconSrc || bundledLocationSvg,
  };
}

// ── Hook ─────────────────────────────────────────────────────────

export function useHalongAssets(lang: HalongLang = 'en'): HalongAssets {
  // ローカルアセットURLマップをマウント時に1回だけ取得してキャッシュ
  const [localMap, setLocalMap] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const global = await loadGlobalSettings();
        const hostname = global.hostname ?? '';
        const local = await invoke<Record<string, string> | null>('list_mall_assets', {
          mallId: 'halong',
          hostname,
        });
        if (local) setLocalMap(local);
      } catch {
        // Tauri 未使用（ブラウザ開発環境）またはロード失敗 → バンドルアセットを使用
      }
    }
    load();
  }, []); // マウント時のみ実行

  // 言語の選択履歴（新しい順・重複なし）。言語切替時にレンダー中に更新する
  const [langHistory, setLangHistory] = useState<HalongLang[]>([lang]);
  if (langHistory[0] !== lang) {
    setLangHistory([lang, ...langHistory.filter(l => l !== lang)]);
  }

  // localMap と言語履歴から同期的にアセットを導出（言語切り替えでフラッシュなし）
  return useMemo(
    () => buildAssets(localMap, langHistory[0] === lang ? langHistory : [lang, ...langHistory.filter(l => l !== lang)]),
    [localMap, lang, langHistory],
  );
}
