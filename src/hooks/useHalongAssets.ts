// src/hooks/useHalongAssets.ts
// ローカル端末アセット優先、失敗時はバンドルアセットにフォールバック

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadGlobalSettings } from '../utils/settings';

// ── バンドルアセット（フォールバック用） ──────────────────────────

import bundledOpenTime from '../assets/malls/halong/open-times/en.svg';

import bundledGenreAll          from '../assets/malls/halong/buttons/genres/en/all.svg';
import bundledGenreAllHighlight from '../assets/malls/halong/buttons/genres/en/all-hilight.svg';
import bundledGenreFashion          from '../assets/malls/halong/buttons/genres/en/fashion.svg';
import bundledGenreFashionHighlight from '../assets/malls/halong/buttons/genres/en/fashion-hilight.svg';
import bundledGenreGoods            from '../assets/malls/halong/buttons/genres/en/goods.svg';
import bundledGenreGoodsHighlight   from '../assets/malls/halong/buttons/genres/en/goods-hilight.svg';
import bundledGenreGourmet          from '../assets/malls/halong/buttons/genres/en/gourmet.svg';
import bundledGenreGourmetHighlight from '../assets/malls/halong/buttons/genres/en/gourmet-hilight.svg';
import bundledGenreService          from '../assets/malls/halong/buttons/genres/en/service.svg';
import bundledGenreServiceHighlight from '../assets/malls/halong/buttons/genres/en/service-hilight.svg';
import bundledGenreNext from '../assets/malls/halong/buttons/genres/next.svg';
import bundledGenrePrev from '../assets/malls/halong/buttons/genres/prev.svg';

import bundledHint from '../assets/malls/halong/hint/en.svg';

import bundledFloorLabelB1 from '../assets/malls/halong/floor-labels/en/B1.svg';
import bundledFloorLabel1F from '../assets/malls/halong/floor-labels/en/1F.svg';
import bundledFloorLabel2F from '../assets/malls/halong/floor-labels/en/2F.svg';
import bundledFloorLabel3F from '../assets/malls/halong/floor-labels/en/3F.svg';
import bundledFloorLabel4F from '../assets/malls/halong/floor-labels/en/4F.svg';

// フロアボタン (en)
import bundledFloorBtnEnB1          from '../assets/malls/halong/buttons/floors/en/B1-01.svg';
import bundledFloorBtnEnB1Highlight  from '../assets/malls/halong/buttons/floors/en/B1-01-highlight.svg';
import bundledFloorBtnEn1F          from '../assets/malls/halong/buttons/floors/en/1F-01.svg';
import bundledFloorBtnEn1FHighlight  from '../assets/malls/halong/buttons/floors/en/1F-01-highlight.svg';
import bundledFloorBtnEn2F          from '../assets/malls/halong/buttons/floors/en/2F-01.svg';
import bundledFloorBtnEn2FHighlight  from '../assets/malls/halong/buttons/floors/en/2F-01-highlight.svg';
import bundledFloorBtnEn3F          from '../assets/malls/halong/buttons/floors/en/3F-01.svg';
import bundledFloorBtnEn3FHighlight  from '../assets/malls/halong/buttons/floors/en/3F-01-highlight.svg';
import bundledFloorBtnEn4F          from '../assets/malls/halong/buttons/floors/en/4F-01.svg';
import bundledFloorBtnEn4FHighlight  from '../assets/malls/halong/buttons/floors/en/4F-01-highlight.svg';

// フロアボタン (ja)
import bundledFloorBtnJaB1          from '../assets/malls/halong/buttons/floors/ja/B1-01.svg';
import bundledFloorBtnJaB1Highlight  from '../assets/malls/halong/buttons/floors/ja/B1-01-highlight.svg';
import bundledFloorBtnJa1F          from '../assets/malls/halong/buttons/floors/ja/1F-01.svg';
import bundledFloorBtnJa1FHighlight  from '../assets/malls/halong/buttons/floors/ja/1F-01-highlight.svg';
import bundledFloorBtnJa2F          from '../assets/malls/halong/buttons/floors/ja/2F-01.svg';
import bundledFloorBtnJa2FHighlight  from '../assets/malls/halong/buttons/floors/ja/2F-01-highlight.svg';
import bundledFloorBtnJa3F          from '../assets/malls/halong/buttons/floors/ja/3F-01.svg';
import bundledFloorBtnJa3FHighlight  from '../assets/malls/halong/buttons/floors/ja/3F-01-highlight.svg';
import bundledFloorBtnJa4F          from '../assets/malls/halong/buttons/floors/ja/4F-01.svg';
import bundledFloorBtnJa4FHighlight  from '../assets/malls/halong/buttons/floors/ja/4F-01-highlight.svg';

// フロアボタン (vn)
import bundledFloorBtnVnB1          from '../assets/malls/halong/buttons/floors/vn/B1-01.svg';
import bundledFloorBtnVnB1Highlight  from '../assets/malls/halong/buttons/floors/vn/B1-01-highlight.svg';
import bundledFloorBtnVn1F          from '../assets/malls/halong/buttons/floors/vn/1F-01.svg';
import bundledFloorBtnVn1FHighlight  from '../assets/malls/halong/buttons/floors/vn/1F-01-highlight.svg';
import bundledFloorBtnVn2F          from '../assets/malls/halong/buttons/floors/vn/2F-01.svg';
import bundledFloorBtnVn2FHighlight  from '../assets/malls/halong/buttons/floors/vn/2F-01-highlight.svg';
import bundledFloorBtnVn3F          from '../assets/malls/halong/buttons/floors/vn/3F-01.svg';
import bundledFloorBtnVn3FHighlight  from '../assets/malls/halong/buttons/floors/vn/3F-01-highlight.svg';
import bundledFloorBtnVn4F          from '../assets/malls/halong/buttons/floors/vn/4F-01.svg';
import bundledFloorBtnVn4FHighlight  from '../assets/malls/halong/buttons/floors/vn/4F-01-highlight.svg';

import bundledLangEn from '../assets/malls/halong/buttons/languages/en.svg';
import bundledLangJa from '../assets/malls/halong/buttons/languages/ja.svg';
import bundledLangVn from '../assets/malls/halong/buttons/languages/vn.svg';

import bundledLangSelectBg          from '../assets/malls/halong/buttons/languages/select/bg.svg';
import bundledLangSelectEn          from '../assets/malls/halong/buttons/languages/select/en.svg';
import bundledLangSelectEnHighlight from '../assets/malls/halong/buttons/languages/select/en-highlight.svg';
import bundledLangSelectJa          from '../assets/malls/halong/buttons/languages/select/ja.svg';
import bundledLangSelectJaHighlight from '../assets/malls/halong/buttons/languages/select/ja-highlight.svg';
import bundledLangSelectVn          from '../assets/malls/halong/buttons/languages/select/vn.svg';
import bundledLangSelectVnHighlight from '../assets/malls/halong/buttons/languages/select/vn-highlight.svg';

import bundledPictoAtm              from '../assets/malls/halong/buttons/pictos/en/atm.svg';
import bundledPictoAtmHighlight     from '../assets/malls/halong/buttons/pictos/en/atm-highlight.svg';
import bundledPictoElevator         from '../assets/malls/halong/buttons/pictos/en/elevator.svg';
import bundledPictoElevatorHighlight from '../assets/malls/halong/buttons/pictos/en/elevator-highlight.svg';
import bundledPictoLockers          from '../assets/malls/halong/buttons/pictos/en/free-coin-lockers.svg';
import bundledPictoLockersHighlight from '../assets/malls/halong/buttons/pictos/en/free-coin-lockers-highlight.svg';
import bundledPictoInfo             from '../assets/malls/halong/buttons/pictos/en/info.svg';
import bundledPictoInfoHighlight    from '../assets/malls/halong/buttons/pictos/en/info-highlight.svg';
import bundledPictoRestroom         from '../assets/malls/halong/buttons/pictos/en/restroom.svg';
import bundledPictoRestroomHighlight from '../assets/malls/halong/buttons/pictos/en/restroom-highlight.svg';
import bundledPictoSmoking          from '../assets/malls/halong/buttons/pictos/en/smoking-room.svg';
import bundledPictoSmokingHighlight from '../assets/malls/halong/buttons/pictos/en/smoking-room-highlight.svg';

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
    gourmet:         string;
    gourmetHighlight: string;
    service:         string;
    serviceHighlight: string;
    next:            string;
    prev:            string;
  };
  hint: string;
  floorLabels: { 'B1': string; '1F': string; '2F': string; '3F': string; '4F': string };
  floorButtons: {
    'B1': { default: string; highlight: string };
    '1F': { default: string; highlight: string };
    '2F': { default: string; highlight: string };
    '3F': { default: string; highlight: string };
    '4F': { default: string; highlight: string };
  };
  langButtons: {
    en: string;
    ja: string;
    vn: string;
    select: {
      bg: string;
      en: string; enHighlight: string;
      ja: string; jaHighlight: string;
      vn: string; vnHighlight: string;
    };
  };
  pictos: {
    atm:            { default: string; highlight: string };
    elevator:       { default: string; highlight: string };
    lockers:        { default: string; highlight: string };
    info:           { default: string; highlight: string };
    restroom:       { default: string; highlight: string };
    smoking:        { default: string; highlight: string };
  };
}

// ── 言語別フロアボタン ────────────────────────────────────────────

const BUNDLED_FLOOR_BUTTONS: Record<'en' | 'ja' | 'vn', HalongAssets['floorButtons']> = {
  en: {
    'B1': { default: bundledFloorBtnEnB1,  highlight: bundledFloorBtnEnB1Highlight },
    '1F': { default: bundledFloorBtnEn1F,  highlight: bundledFloorBtnEn1FHighlight },
    '2F': { default: bundledFloorBtnEn2F,  highlight: bundledFloorBtnEn2FHighlight },
    '3F': { default: bundledFloorBtnEn3F,  highlight: bundledFloorBtnEn3FHighlight },
    '4F': { default: bundledFloorBtnEn4F,  highlight: bundledFloorBtnEn4FHighlight },
  },
  ja: {
    'B1': { default: bundledFloorBtnJaB1,  highlight: bundledFloorBtnJaB1Highlight },
    '1F': { default: bundledFloorBtnJa1F,  highlight: bundledFloorBtnJa1FHighlight },
    '2F': { default: bundledFloorBtnJa2F,  highlight: bundledFloorBtnJa2FHighlight },
    '3F': { default: bundledFloorBtnJa3F,  highlight: bundledFloorBtnJa3FHighlight },
    '4F': { default: bundledFloorBtnJa4F,  highlight: bundledFloorBtnJa4FHighlight },
  },
  vn: {
    'B1': { default: bundledFloorBtnVnB1,  highlight: bundledFloorBtnVnB1Highlight },
    '1F': { default: bundledFloorBtnVn1F,  highlight: bundledFloorBtnVn1FHighlight },
    '2F': { default: bundledFloorBtnVn2F,  highlight: bundledFloorBtnVn2FHighlight },
    '3F': { default: bundledFloorBtnVn3F,  highlight: bundledFloorBtnVn3FHighlight },
    '4F': { default: bundledFloorBtnVn4F,  highlight: bundledFloorBtnVn4FHighlight },
  },
};

// ── バンドルアセット定数 ──────────────────────────────────────────

const BUNDLED_BASE: Omit<HalongAssets, 'floorButtons'> = {
  openTime: bundledOpenTime,
  genres: {
    all:             bundledGenreAll,
    allHighlight:    bundledGenreAllHighlight,
    fashion:         bundledGenreFashion,
    fashionHighlight: bundledGenreFashionHighlight,
    goods:           bundledGenreGoods,
    goodsHighlight:  bundledGenreGoodsHighlight,
    gourmet:         bundledGenreGourmet,
    gourmetHighlight: bundledGenreGourmetHighlight,
    service:         bundledGenreService,
    serviceHighlight: bundledGenreServiceHighlight,
    next:            bundledGenreNext,
    prev:            bundledGenrePrev,
  },
  hint: bundledHint,
  floorLabels: { 'B1': bundledFloorLabelB1, '1F': bundledFloorLabel1F, '2F': bundledFloorLabel2F, '3F': bundledFloorLabel3F, '4F': bundledFloorLabel4F },
  langButtons: {
    en: bundledLangEn,
    ja: bundledLangJa,
    vn: bundledLangVn,
    select: {
      bg:          bundledLangSelectBg,
      en:          bundledLangSelectEn,
      enHighlight: bundledLangSelectEnHighlight,
      ja:          bundledLangSelectJa,
      jaHighlight: bundledLangSelectJaHighlight,
      vn:          bundledLangSelectVn,
      vnHighlight: bundledLangSelectVnHighlight,
    },
  },
  pictos: {
    atm:      { default: bundledPictoAtm,      highlight: bundledPictoAtmHighlight },
    elevator: { default: bundledPictoElevator, highlight: bundledPictoElevatorHighlight },
    lockers:  { default: bundledPictoLockers,  highlight: bundledPictoLockersHighlight },
    info:     { default: bundledPictoInfo,     highlight: bundledPictoInfoHighlight },
    restroom: { default: bundledPictoRestroom, highlight: bundledPictoRestroomHighlight },
    smoking:  { default: bundledPictoSmoking,  highlight: bundledPictoSmokingHighlight },
  },
};

// ローカルアセットマップからURLを取得、なければバンドルにフォールバック
function resolve(local: Record<string, string>, key: string, fallback: string): string {
  return local[key] || fallback;
}

function getBundled(lang: 'en' | 'ja' | 'vn'): HalongAssets {
  return { ...BUNDLED_BASE, floorButtons: BUNDLED_FLOOR_BUTTONS[lang] };
}

// ── Hook ─────────────────────────────────────────────────────────

export function useHalongAssets(lang: 'en' | 'ja' | 'vn' = 'en'): HalongAssets {
  const [assets, setAssets] = useState<HalongAssets>(() => getBundled(lang));

  useEffect(() => {
    // 言語変更時はバンドルアセットに即時切り替え
    setAssets(getBundled(lang));

    async function load() {
      try {
        const global = await loadGlobalSettings();
        const hostname = global.hostname ?? '';
        const local = await invoke<Record<string, string> | null>('list_mall_assets', {
          mallId: 'halong',
          hostname,
        });
        if (!local) return;

        const r = (key: string, fallback: string) => resolve(local, key, fallback);
        const fb = BUNDLED_FLOOR_BUTTONS[lang];

        setAssets({
          openTime: r('open-times/en.svg', BUNDLED_BASE.openTime),
          genres: {
            all:             r('buttons/genres/en/all.svg',            BUNDLED_BASE.genres.all),
            allHighlight:    r('buttons/genres/en/all-hilight.svg',    BUNDLED_BASE.genres.allHighlight),
            fashion:         r('buttons/genres/en/fashion.svg',        BUNDLED_BASE.genres.fashion),
            fashionHighlight: r('buttons/genres/en/fashion-hilight.svg', BUNDLED_BASE.genres.fashionHighlight),
            goods:           r('buttons/genres/en/goods.svg',          BUNDLED_BASE.genres.goods),
            goodsHighlight:  r('buttons/genres/en/goods-hilight.svg',  BUNDLED_BASE.genres.goodsHighlight),
            gourmet:         r('buttons/genres/en/gourmet.svg',        BUNDLED_BASE.genres.gourmet),
            gourmetHighlight: r('buttons/genres/en/gourmet-hilight.svg', BUNDLED_BASE.genres.gourmetHighlight),
            service:         r('buttons/genres/en/service.svg',        BUNDLED_BASE.genres.service),
            serviceHighlight: r('buttons/genres/en/service-hilight.svg', BUNDLED_BASE.genres.serviceHighlight),
            next:            r('buttons/genres/next.svg',              BUNDLED_BASE.genres.next),
            prev:            r('buttons/genres/prev.svg',              BUNDLED_BASE.genres.prev),
          },
          hint: r('hint/en.svg', BUNDLED_BASE.hint),
          floorLabels: {
            'B1': r('floor-labels/en/B1.svg', BUNDLED_BASE.floorLabels['B1']),
            '1F': r('floor-labels/en/1F.svg', BUNDLED_BASE.floorLabels['1F']),
            '2F': r('floor-labels/en/2F.svg', BUNDLED_BASE.floorLabels['2F']),
            '3F': r('floor-labels/en/3F.svg', BUNDLED_BASE.floorLabels['3F']),
            '4F': r('floor-labels/en/4F.svg', BUNDLED_BASE.floorLabels['4F']),
          },
          floorButtons: {
            'B1': {
              default:   r(`buttons/floors/${lang}/B1-01.svg`,           fb['B1'].default),
              highlight: r(`buttons/floors/${lang}/B1-01-highlight.svg`, fb['B1'].highlight),
            },
            '1F': {
              default:   r(`buttons/floors/${lang}/1F-01.svg`,           fb['1F'].default),
              highlight: r(`buttons/floors/${lang}/1F-01-highlight.svg`, fb['1F'].highlight),
            },
            '2F': {
              default:   r(`buttons/floors/${lang}/2F-01.svg`,           fb['2F'].default),
              highlight: r(`buttons/floors/${lang}/2F-01-highlight.svg`, fb['2F'].highlight),
            },
            '3F': {
              default:   r(`buttons/floors/${lang}/3F-01.svg`,           fb['3F'].default),
              highlight: r(`buttons/floors/${lang}/3F-01-highlight.svg`, fb['3F'].highlight),
            },
            '4F': {
              default:   r(`buttons/floors/${lang}/4F-01.svg`,           fb['4F'].default),
              highlight: r(`buttons/floors/${lang}/4F-01-highlight.svg`, fb['4F'].highlight),
            },
          },
          langButtons: {
            en: r('buttons/languages/en.svg', BUNDLED_BASE.langButtons.en),
            ja: r('buttons/languages/ja.svg', BUNDLED_BASE.langButtons.ja),
            vn: r('buttons/languages/vn.svg', BUNDLED_BASE.langButtons.vn),
            select: {
              bg:          r('buttons/languages/select/bg.svg',           BUNDLED_BASE.langButtons.select.bg),
              en:          r('buttons/languages/select/en.svg',           BUNDLED_BASE.langButtons.select.en),
              enHighlight: r('buttons/languages/select/en-highlight.svg', BUNDLED_BASE.langButtons.select.enHighlight),
              ja:          r('buttons/languages/select/ja.svg',           BUNDLED_BASE.langButtons.select.ja),
              jaHighlight: r('buttons/languages/select/ja-highlight.svg', BUNDLED_BASE.langButtons.select.jaHighlight),
              vn:          r('buttons/languages/select/vn.svg',           BUNDLED_BASE.langButtons.select.vn),
              vnHighlight: r('buttons/languages/select/vn-highlight.svg', BUNDLED_BASE.langButtons.select.vnHighlight),
            },
          },
          pictos: {
            atm:      { default: r('buttons/pictos/en/atm.svg',                 BUNDLED_BASE.pictos.atm.default),      highlight: r('buttons/pictos/en/atm-highlight.svg',                 BUNDLED_BASE.pictos.atm.highlight) },
            elevator: { default: r('buttons/pictos/en/elevator.svg',            BUNDLED_BASE.pictos.elevator.default), highlight: r('buttons/pictos/en/elevator-highlight.svg',            BUNDLED_BASE.pictos.elevator.highlight) },
            lockers:  { default: r('buttons/pictos/en/free-coin-lockers.svg',   BUNDLED_BASE.pictos.lockers.default),  highlight: r('buttons/pictos/en/free-coin-lockers-highlight.svg',   BUNDLED_BASE.pictos.lockers.highlight) },
            info:     { default: r('buttons/pictos/en/info.svg',                BUNDLED_BASE.pictos.info.default),     highlight: r('buttons/pictos/en/info-highlight.svg',                BUNDLED_BASE.pictos.info.highlight) },
            restroom: { default: r('buttons/pictos/en/restroom.svg',            BUNDLED_BASE.pictos.restroom.default), highlight: r('buttons/pictos/en/restroom-highlight.svg',            BUNDLED_BASE.pictos.restroom.highlight) },
            smoking:  { default: r('buttons/pictos/en/smoking-room.svg',        BUNDLED_BASE.pictos.smoking.default),  highlight: r('buttons/pictos/en/smoking-room-highlight.svg',        BUNDLED_BASE.pictos.smoking.highlight) },
          },
        });
      } catch {
        // Tauri 未使用（ブラウザ開発環境）またはロード失敗 → バンドルアセットを使用
      }
    }

    load();
  }, [lang]);

  return assets;
}
