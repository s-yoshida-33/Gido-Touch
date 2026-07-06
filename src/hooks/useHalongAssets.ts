// src/hooks/useHalongAssets.ts
// ローカル端末アセット優先、失敗時はバンドルアセットにフォールバック

import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadGlobalSettings } from '../utils/settings';

// ── バンドルアセット（フォールバック用） ──────────────────────────

// open-times
import bundledOpenTimeEn from '../assets/malls/halong/open-times/en.svg';
import bundledOpenTimeJa from '../assets/malls/halong/open-times/ja.svg';
import bundledOpenTimeVn from '../assets/malls/halong/open-times/vn.svg';

// genres (en)
import bundledGenreEnAll          from '../assets/malls/halong/buttons/genres/en/all.svg';
import bundledGenreEnAllHighlight from '../assets/malls/halong/buttons/genres/en/all-hilight.svg';
import bundledGenreEnFashion          from '../assets/malls/halong/buttons/genres/en/fashion.svg';
import bundledGenreEnFashionHighlight from '../assets/malls/halong/buttons/genres/en/fashion-hilight.svg';
import bundledGenreEnGoods            from '../assets/malls/halong/buttons/genres/en/goods.svg';
import bundledGenreEnGoodsHighlight   from '../assets/malls/halong/buttons/genres/en/goods-hilight.svg';
import bundledGenreEnGourmet          from '../assets/malls/halong/buttons/genres/en/gourmet.svg';
import bundledGenreEnGourmetHighlight from '../assets/malls/halong/buttons/genres/en/gourmet-hilight.svg';
import bundledGenreEnService          from '../assets/malls/halong/buttons/genres/en/service.svg';
import bundledGenreEnServiceHighlight from '../assets/malls/halong/buttons/genres/en/service-hilight.svg';

// genres (ja)
import bundledGenreJaAll          from '../assets/malls/halong/buttons/genres/ja/all.svg';
import bundledGenreJaAllHighlight from '../assets/malls/halong/buttons/genres/ja/all-hilight.svg';
import bundledGenreJaFashion          from '../assets/malls/halong/buttons/genres/ja/fashion.svg';
import bundledGenreJaFashionHighlight from '../assets/malls/halong/buttons/genres/ja/fashion-hilight.svg';
import bundledGenreJaGoods            from '../assets/malls/halong/buttons/genres/ja/goods.svg';
import bundledGenreJaGoodsHighlight   from '../assets/malls/halong/buttons/genres/ja/goods-hilight.svg';
import bundledGenreJaGourmet          from '../assets/malls/halong/buttons/genres/ja/gourmet.svg';
import bundledGenreJaGourmetHighlight from '../assets/malls/halong/buttons/genres/ja/gourmet-hilight.svg';
import bundledGenreJaService          from '../assets/malls/halong/buttons/genres/ja/service.svg';
import bundledGenreJaServiceHighlight from '../assets/malls/halong/buttons/genres/ja/service-hilight.svg';

// genres (vn)
import bundledGenreVnAll          from '../assets/malls/halong/buttons/genres/vn/all.svg';
import bundledGenreVnAllHighlight from '../assets/malls/halong/buttons/genres/vn/all-hilight.svg';
import bundledGenreVnFashion          from '../assets/malls/halong/buttons/genres/vn/fashion.svg';
import bundledGenreVnFashionHighlight from '../assets/malls/halong/buttons/genres/vn/fashion-hilight.svg';
import bundledGenreVnGoods            from '../assets/malls/halong/buttons/genres/vn/goods.svg';
import bundledGenreVnGoodsHighlight   from '../assets/malls/halong/buttons/genres/vn/goods-hilight.svg';
import bundledGenreVnGourmet          from '../assets/malls/halong/buttons/genres/vn/gourmet.svg';
import bundledGenreVnGourmetHighlight from '../assets/malls/halong/buttons/genres/vn/gourmet-hilight.svg';
import bundledGenreVnService          from '../assets/malls/halong/buttons/genres/vn/service.svg';
import bundledGenreVnServiceHighlight from '../assets/malls/halong/buttons/genres/vn/service-hilight.svg';

// genres (lang-independent)
import bundledGenreNext from '../assets/malls/halong/buttons/genres/next.svg';
import bundledGenrePrev from '../assets/malls/halong/buttons/genres/prev.svg';

// location icons (bundled fallback)
import bundledSpeechBubbleSvg from '../assets/location/user.svg';
import bundledLocationSvg from '../assets/location/location.svg';

// hint
import bundledHintEn from '../assets/malls/halong/hint/en.svg';
import bundledHintJa from '../assets/malls/halong/hint/ja.svg';
import bundledHintVn from '../assets/malls/halong/hint/vn.svg';

// floor-labels (en)
import bundledFloorLabelEn1F from '../assets/malls/halong/floor-labels/en/1F.svg';
import bundledFloorLabelEn2F from '../assets/malls/halong/floor-labels/en/2F.svg';
import bundledFloorLabelEn3F from '../assets/malls/halong/floor-labels/en/3F.svg';
import bundledFloorLabelEn4F from '../assets/malls/halong/floor-labels/en/4F.svg';

// floor-labels (ja)
import bundledFloorLabelJa1F from '../assets/malls/halong/floor-labels/ja/1F.svg';
import bundledFloorLabelJa2F from '../assets/malls/halong/floor-labels/ja/2F.svg';
import bundledFloorLabelJa3F from '../assets/malls/halong/floor-labels/ja/3F.svg';
import bundledFloorLabelJa4F from '../assets/malls/halong/floor-labels/ja/4F.svg';

// floor-labels (vn)
import bundledFloorLabelVn1F from '../assets/malls/halong/floor-labels/vn/1F.svg';
import bundledFloorLabelVn2F from '../assets/malls/halong/floor-labels/vn/2F.svg';
import bundledFloorLabelVn3F from '../assets/malls/halong/floor-labels/vn/3F.svg';
import bundledFloorLabelVn4F from '../assets/malls/halong/floor-labels/vn/4F.svg';

// フロアボタン (en)
import bundledFloorBtnEn1F          from '../assets/malls/halong/buttons/floors/en/1F-01.svg';
import bundledFloorBtnEn1FHighlight  from '../assets/malls/halong/buttons/floors/en/1F-01-highlight.svg';
import bundledFloorBtnEn2F          from '../assets/malls/halong/buttons/floors/en/2F-01.svg';
import bundledFloorBtnEn2FHighlight  from '../assets/malls/halong/buttons/floors/en/2F-01-highlight.svg';
import bundledFloorBtnEn3F          from '../assets/malls/halong/buttons/floors/en/3F-01.svg';
import bundledFloorBtnEn3FHighlight  from '../assets/malls/halong/buttons/floors/en/3F-01-highlight.svg';
import bundledFloorBtnEn4F          from '../assets/malls/halong/buttons/floors/en/4F-01.svg';
import bundledFloorBtnEn4FHighlight  from '../assets/malls/halong/buttons/floors/en/4F-01-highlight.svg';

// フロアボタン (ja)
import bundledFloorBtnJa1F          from '../assets/malls/halong/buttons/floors/ja/1F-01.svg';
import bundledFloorBtnJa1FHighlight  from '../assets/malls/halong/buttons/floors/ja/1F-01-highlight.svg';
import bundledFloorBtnJa2F          from '../assets/malls/halong/buttons/floors/ja/2F-01.svg';
import bundledFloorBtnJa2FHighlight  from '../assets/malls/halong/buttons/floors/ja/2F-01-highlight.svg';
import bundledFloorBtnJa3F          from '../assets/malls/halong/buttons/floors/ja/3F-01.svg';
import bundledFloorBtnJa3FHighlight  from '../assets/malls/halong/buttons/floors/ja/3F-01-highlight.svg';
import bundledFloorBtnJa4F          from '../assets/malls/halong/buttons/floors/ja/4F-01.svg';
import bundledFloorBtnJa4FHighlight  from '../assets/malls/halong/buttons/floors/ja/4F-01-highlight.svg';

// フロアボタン (vn)
import bundledFloorBtnVn1F          from '../assets/malls/halong/buttons/floors/vn/1F-01.svg';
import bundledFloorBtnVn1FHighlight  from '../assets/malls/halong/buttons/floors/vn/1F-01-highlight.svg';
import bundledFloorBtnVn2F          from '../assets/malls/halong/buttons/floors/vn/2F-01.svg';
import bundledFloorBtnVn2FHighlight  from '../assets/malls/halong/buttons/floors/vn/2F-01-highlight.svg';
import bundledFloorBtnVn3F          from '../assets/malls/halong/buttons/floors/vn/3F-01.svg';
import bundledFloorBtnVn3FHighlight  from '../assets/malls/halong/buttons/floors/vn/3F-01-highlight.svg';
import bundledFloorBtnVn4F          from '../assets/malls/halong/buttons/floors/vn/4F-01.svg';
import bundledFloorBtnVn4FHighlight  from '../assets/malls/halong/buttons/floors/vn/4F-01-highlight.svg';

// pictos (en)
import bundledPictoEnAtm              from '../assets/malls/halong/buttons/pictos/en/atm.svg';
import bundledPictoEnAtmHighlight     from '../assets/malls/halong/buttons/pictos/en/atm-highlight.svg';
import bundledPictoEnElevator         from '../assets/malls/halong/buttons/pictos/en/elevator.svg';
import bundledPictoEnElevatorHighlight from '../assets/malls/halong/buttons/pictos/en/elevator-highlight.svg';
import bundledPictoEnLockers          from '../assets/malls/halong/buttons/pictos/en/free-coin-lockers.svg';
import bundledPictoEnLockersHighlight from '../assets/malls/halong/buttons/pictos/en/free-coin-lockers-highlight.svg';
import bundledPictoEnInfo             from '../assets/malls/halong/buttons/pictos/en/info.svg';
import bundledPictoEnInfoHighlight    from '../assets/malls/halong/buttons/pictos/en/info-highlight.svg';
import bundledPictoEnRestroom         from '../assets/malls/halong/buttons/pictos/en/restroom.svg';
import bundledPictoEnRestroomHighlight from '../assets/malls/halong/buttons/pictos/en/restroom-highlight.svg';
import bundledPictoEnSmoking          from '../assets/malls/halong/buttons/pictos/en/smoking-room.svg';
import bundledPictoEnSmokingHighlight from '../assets/malls/halong/buttons/pictos/en/smoking-room-highlight.svg';

// pictos (ja)
import bundledPictoJaAtm              from '../assets/malls/halong/buttons/pictos/ja/atm.svg';
import bundledPictoJaAtmHighlight     from '../assets/malls/halong/buttons/pictos/ja/atm-highlight.svg';
import bundledPictoJaElevator         from '../assets/malls/halong/buttons/pictos/ja/elevator.svg';
import bundledPictoJaElevatorHighlight from '../assets/malls/halong/buttons/pictos/ja/elevator-highlight.svg';
import bundledPictoJaLockers          from '../assets/malls/halong/buttons/pictos/ja/free-coin-lockers.svg';
import bundledPictoJaLockersHighlight from '../assets/malls/halong/buttons/pictos/ja/free-coin-lockers-highlight.svg';
import bundledPictoJaInfo             from '../assets/malls/halong/buttons/pictos/ja/info.svg';
import bundledPictoJaInfoHighlight    from '../assets/malls/halong/buttons/pictos/ja/info-highlight.svg';
import bundledPictoJaRestroom         from '../assets/malls/halong/buttons/pictos/ja/restroom.svg';
import bundledPictoJaRestroomHighlight from '../assets/malls/halong/buttons/pictos/ja/restroom-highlight.svg';
import bundledPictoJaSmoking          from '../assets/malls/halong/buttons/pictos/ja/smoking-room.svg';
import bundledPictoJaSmokingHighlight from '../assets/malls/halong/buttons/pictos/ja/smoking-room-highlight.svg';

// pictos (vn)
import bundledPictoVnAtm              from '../assets/malls/halong/buttons/pictos/vn/atm.svg';
import bundledPictoVnAtmHighlight     from '../assets/malls/halong/buttons/pictos/vn/atm-highlight.svg';
import bundledPictoVnElevator         from '../assets/malls/halong/buttons/pictos/vn/elevator.svg';
import bundledPictoVnElevatorHighlight from '../assets/malls/halong/buttons/pictos/vn/elevator-highlight.svg';
import bundledPictoVnLockers          from '../assets/malls/halong/buttons/pictos/vn/free-coin-lockers.svg';
import bundledPictoVnLockersHighlight from '../assets/malls/halong/buttons/pictos/vn/free-coin-lockers-highlight.svg';
import bundledPictoVnInfo             from '../assets/malls/halong/buttons/pictos/vn/info.svg';
import bundledPictoVnInfoHighlight    from '../assets/malls/halong/buttons/pictos/vn/info-highlight.svg';
import bundledPictoVnRestroom         from '../assets/malls/halong/buttons/pictos/vn/restroom.svg';
import bundledPictoVnRestroomHighlight from '../assets/malls/halong/buttons/pictos/vn/restroom-highlight.svg';
import bundledPictoVnSmoking          from '../assets/malls/halong/buttons/pictos/vn/smoking-room.svg';
import bundledPictoVnSmokingHighlight from '../assets/malls/halong/buttons/pictos/vn/smoking-room-highlight.svg';

// クローズボタン（詳細パネル用）
import bundledClose          from '../assets/malls/halong/buttons/close.svg';
import bundledCloseHighlight from '../assets/malls/halong/buttons/close-highlight.svg';

// 言語選択ボタン
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
    select: {
      bg: string;
      en: string; enHighlight: string;
      ja: string; jaHighlight: string;
      vn: string; vnHighlight: string;
    };
  };
  pictos: {
    atm:      { default: string; highlight: string };
    elevator: { default: string; highlight: string };
    lockers:  { default: string; highlight: string };
    info:     { default: string; highlight: string };
    restroom: { default: string; highlight: string };
    smoking:  { default: string; highlight: string };
  };
  pictoMapIcons: {
    atm:      string;
    elevator: string;
    lockers:  string;
    info:     string;
    restroom: string;
    smoking:  string;
  };
  speechBubbleIconSrc: string;
  locationIconSrc: string;
  close: string;
  closeHighlight: string;
  currentFloorIcon: string;
}

// ── 言語別バンドルアセットテーブル ───────────────────────────────

const BUNDLED_OPEN_TIMES: Record<'en' | 'ja' | 'vn', string> = {
  en: bundledOpenTimeEn,
  ja: bundledOpenTimeJa,
  vn: bundledOpenTimeVn,
};

const BUNDLED_HINTS: Record<'en' | 'ja' | 'vn', string> = {
  en: bundledHintEn,
  ja: bundledHintJa,
  vn: bundledHintVn,
};

const BUNDLED_GENRES: Record<'en' | 'ja' | 'vn', Omit<HalongAssets['genres'], 'next' | 'prev'>> = {
  en: {
    all:             bundledGenreEnAll,
    allHighlight:    bundledGenreEnAllHighlight,
    fashion:         bundledGenreEnFashion,
    fashionHighlight: bundledGenreEnFashionHighlight,
    goods:           bundledGenreEnGoods,
    goodsHighlight:  bundledGenreEnGoodsHighlight,
    gourmet:         bundledGenreEnGourmet,
    gourmetHighlight: bundledGenreEnGourmetHighlight,
    service:         bundledGenreEnService,
    serviceHighlight: bundledGenreEnServiceHighlight,
  },
  ja: {
    all:             bundledGenreJaAll,
    allHighlight:    bundledGenreJaAllHighlight,
    fashion:         bundledGenreJaFashion,
    fashionHighlight: bundledGenreJaFashionHighlight,
    goods:           bundledGenreJaGoods,
    goodsHighlight:  bundledGenreJaGoodsHighlight,
    gourmet:         bundledGenreJaGourmet,
    gourmetHighlight: bundledGenreJaGourmetHighlight,
    service:         bundledGenreJaService,
    serviceHighlight: bundledGenreJaServiceHighlight,
  },
  vn: {
    all:             bundledGenreVnAll,
    allHighlight:    bundledGenreVnAllHighlight,
    fashion:         bundledGenreVnFashion,
    fashionHighlight: bundledGenreVnFashionHighlight,
    goods:           bundledGenreVnGoods,
    goodsHighlight:  bundledGenreVnGoodsHighlight,
    gourmet:         bundledGenreVnGourmet,
    gourmetHighlight: bundledGenreVnGourmetHighlight,
    service:         bundledGenreVnService,
    serviceHighlight: bundledGenreVnServiceHighlight,
  },
};

const BUNDLED_FLOOR_LABELS: Record<'en' | 'ja' | 'vn', HalongAssets['floorLabels']> = {
  en: { '1F': bundledFloorLabelEn1F, '2F': bundledFloorLabelEn2F, '3F': bundledFloorLabelEn3F, '4F': bundledFloorLabelEn4F },
  ja: { '1F': bundledFloorLabelJa1F, '2F': bundledFloorLabelJa2F, '3F': bundledFloorLabelJa3F, '4F': bundledFloorLabelJa4F },
  vn: { '1F': bundledFloorLabelVn1F, '2F': bundledFloorLabelVn2F, '3F': bundledFloorLabelVn3F, '4F': bundledFloorLabelVn4F },
};

const BUNDLED_FLOOR_BUTTONS: Record<'en' | 'ja' | 'vn', HalongAssets['floorButtons']> = {
  en: {
    '1F': { default: bundledFloorBtnEn1F,  highlight: bundledFloorBtnEn1FHighlight },
    '2F': { default: bundledFloorBtnEn2F,  highlight: bundledFloorBtnEn2FHighlight },
    '3F': { default: bundledFloorBtnEn3F,  highlight: bundledFloorBtnEn3FHighlight },
    '4F': { default: bundledFloorBtnEn4F,  highlight: bundledFloorBtnEn4FHighlight },
  },
  ja: {
    '1F': { default: bundledFloorBtnJa1F,  highlight: bundledFloorBtnJa1FHighlight },
    '2F': { default: bundledFloorBtnJa2F,  highlight: bundledFloorBtnJa2FHighlight },
    '3F': { default: bundledFloorBtnJa3F,  highlight: bundledFloorBtnJa3FHighlight },
    '4F': { default: bundledFloorBtnJa4F,  highlight: bundledFloorBtnJa4FHighlight },
  },
  vn: {
    '1F': { default: bundledFloorBtnVn1F,  highlight: bundledFloorBtnVn1FHighlight },
    '2F': { default: bundledFloorBtnVn2F,  highlight: bundledFloorBtnVn2FHighlight },
    '3F': { default: bundledFloorBtnVn3F,  highlight: bundledFloorBtnVn3FHighlight },
    '4F': { default: bundledFloorBtnVn4F,  highlight: bundledFloorBtnVn4FHighlight },
  },
};

const BUNDLED_PICTOS: Record<'en' | 'ja' | 'vn', HalongAssets['pictos']> = {
  en: {
    atm:      { default: bundledPictoEnAtm,      highlight: bundledPictoEnAtmHighlight },
    elevator: { default: bundledPictoEnElevator, highlight: bundledPictoEnElevatorHighlight },
    lockers:  { default: bundledPictoEnLockers,  highlight: bundledPictoEnLockersHighlight },
    info:     { default: bundledPictoEnInfo,     highlight: bundledPictoEnInfoHighlight },
    restroom: { default: bundledPictoEnRestroom, highlight: bundledPictoEnRestroomHighlight },
    smoking:  { default: bundledPictoEnSmoking,  highlight: bundledPictoEnSmokingHighlight },
  },
  ja: {
    atm:      { default: bundledPictoJaAtm,      highlight: bundledPictoJaAtmHighlight },
    elevator: { default: bundledPictoJaElevator, highlight: bundledPictoJaElevatorHighlight },
    lockers:  { default: bundledPictoJaLockers,  highlight: bundledPictoJaLockersHighlight },
    info:     { default: bundledPictoJaInfo,     highlight: bundledPictoJaInfoHighlight },
    restroom: { default: bundledPictoJaRestroom, highlight: bundledPictoJaRestroomHighlight },
    smoking:  { default: bundledPictoJaSmoking,  highlight: bundledPictoJaSmokingHighlight },
  },
  vn: {
    atm:      { default: bundledPictoVnAtm,      highlight: bundledPictoVnAtmHighlight },
    elevator: { default: bundledPictoVnElevator, highlight: bundledPictoVnElevatorHighlight },
    lockers:  { default: bundledPictoVnLockers,  highlight: bundledPictoVnLockersHighlight },
    info:     { default: bundledPictoVnInfo,     highlight: bundledPictoVnInfoHighlight },
    restroom: { default: bundledPictoVnRestroom, highlight: bundledPictoVnRestroomHighlight },
    smoking:  { default: bundledPictoVnSmoking,  highlight: bundledPictoVnSmokingHighlight },
  },
};

const BUNDLED_LANG_BUTTONS: HalongAssets['langButtons'] = {
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
};

// ── ヘルパー ──────────────────────────────────────────────────────

function resolve(local: Record<string, string>, key: string, fallback: string): string {
  return local[key] || fallback;
}

function getBundled(lang: 'en' | 'ja' | 'vn'): HalongAssets {
  return {
    openTime: BUNDLED_OPEN_TIMES[lang],
    genres: { ...BUNDLED_GENRES[lang], next: bundledGenreNext, prev: bundledGenrePrev },
    hint: BUNDLED_HINTS[lang],
    floorLabels: BUNDLED_FLOOR_LABELS[lang],
    floorButtons: BUNDLED_FLOOR_BUTTONS[lang],
    langButtons: BUNDLED_LANG_BUTTONS,
    pictos: BUNDLED_PICTOS[lang],
    pictoMapIcons: {
      atm:      bundledPictoJaAtm,
      elevator: bundledPictoJaElevator,
      lockers:  bundledPictoJaLockers,
      info:     bundledPictoJaInfo,
      restroom: bundledPictoJaRestroom,
      smoking:  bundledPictoJaSmoking,
    },
    speechBubbleIconSrc: bundledSpeechBubbleSvg,
    locationIconSrc: bundledLocationSvg,
    close: bundledClose,
    closeHighlight: bundledCloseHighlight,
    currentFloorIcon: '',
  };
}

// ── ローカルアセットビルダー ──────────────────────────────────────

function buildFromLocal(local: Record<string, string>, lang: 'en' | 'ja' | 'vn'): HalongAssets {
  const r = (key: string, fallback: string) => resolve(local, key, fallback);
  const fb = getBundled(lang);
  return {
    openTime: r(`open-times/${lang}.svg`, fb.openTime),
    genres: {
      all:             r(`buttons/genres/${lang}/all.svg`,             fb.genres.all),
      allHighlight:    r(`buttons/genres/${lang}/all-hilight.svg`,     fb.genres.allHighlight),
      fashion:         r(`buttons/genres/${lang}/fashion.svg`,         fb.genres.fashion),
      fashionHighlight: r(`buttons/genres/${lang}/fashion-hilight.svg`, fb.genres.fashionHighlight),
      goods:           r(`buttons/genres/${lang}/goods.svg`,           fb.genres.goods),
      goodsHighlight:  r(`buttons/genres/${lang}/goods-hilight.svg`,   fb.genres.goodsHighlight),
      gourmet:         r(`buttons/genres/${lang}/gourmet.svg`,         fb.genres.gourmet),
      gourmetHighlight: r(`buttons/genres/${lang}/gourmet-hilight.svg`, fb.genres.gourmetHighlight),
      service:         r(`buttons/genres/${lang}/service.svg`,         fb.genres.service),
      serviceHighlight: r(`buttons/genres/${lang}/service-hilight.svg`, fb.genres.serviceHighlight),
      next:            r('buttons/genres/next.svg',                    fb.genres.next),
      prev:            r('buttons/genres/prev.svg',                    fb.genres.prev),
    },
    hint: r(`hint/${lang}.svg`, fb.hint),
    floorLabels: {
      '1F': r(`floor-labels/${lang}/1F.svg`, fb.floorLabels['1F']),
      '2F': r(`floor-labels/${lang}/2F.svg`, fb.floorLabels['2F']),
      '3F': r(`floor-labels/${lang}/3F.svg`, fb.floorLabels['3F']),
      '4F': r(`floor-labels/${lang}/4F.svg`, fb.floorLabels['4F']),
    },
    floorButtons: {
      '1F': { default: r(`buttons/floors/${lang}/1F-01.svg`, fb.floorButtons['1F'].default), highlight: r(`buttons/floors/${lang}/1F-01-highlight.svg`, fb.floorButtons['1F'].highlight) },
      '2F': { default: r(`buttons/floors/${lang}/2F-01.svg`, fb.floorButtons['2F'].default), highlight: r(`buttons/floors/${lang}/2F-01-highlight.svg`, fb.floorButtons['2F'].highlight) },
      '3F': { default: r(`buttons/floors/${lang}/3F-01.svg`, fb.floorButtons['3F'].default), highlight: r(`buttons/floors/${lang}/3F-01-highlight.svg`, fb.floorButtons['3F'].highlight) },
      '4F': { default: r(`buttons/floors/${lang}/4F-01.svg`, fb.floorButtons['4F'].default), highlight: r(`buttons/floors/${lang}/4F-01-highlight.svg`, fb.floorButtons['4F'].highlight) },
    },
    langButtons: {
      en: r('buttons/languages/en.svg', fb.langButtons.en),
      ja: r('buttons/languages/ja.svg', fb.langButtons.ja),
      vn: r('buttons/languages/vn.svg', fb.langButtons.vn),
      select: {
        bg:          r('buttons/languages/select/bg.svg',           fb.langButtons.select.bg),
        en:          r('buttons/languages/select/en.svg',           fb.langButtons.select.en),
        enHighlight: r('buttons/languages/select/en-highlight.svg', fb.langButtons.select.enHighlight),
        ja:          r('buttons/languages/select/ja.svg',           fb.langButtons.select.ja),
        jaHighlight: r('buttons/languages/select/ja-highlight.svg', fb.langButtons.select.jaHighlight),
        vn:          r('buttons/languages/select/vn.svg',           fb.langButtons.select.vn),
        vnHighlight: r('buttons/languages/select/vn-highlight.svg', fb.langButtons.select.vnHighlight),
      },
    },
    pictos: {
      atm:      { default: r(`buttons/pictos/${lang}/atm.svg`,               fb.pictos.atm.default),      highlight: r(`buttons/pictos/${lang}/atm-highlight.svg`,               fb.pictos.atm.highlight) },
      elevator: { default: r(`buttons/pictos/${lang}/elevator.svg`,          fb.pictos.elevator.default), highlight: r(`buttons/pictos/${lang}/elevator-highlight.svg`,          fb.pictos.elevator.highlight) },
      lockers:  { default: r(`buttons/pictos/${lang}/free-coin-lockers.svg`, fb.pictos.lockers.default),  highlight: r(`buttons/pictos/${lang}/free-coin-lockers-highlight.svg`, fb.pictos.lockers.highlight) },
      info:     { default: r(`buttons/pictos/${lang}/info.svg`,              fb.pictos.info.default),     highlight: r(`buttons/pictos/${lang}/info-highlight.svg`,              fb.pictos.info.highlight) },
      restroom: { default: r(`buttons/pictos/${lang}/restroom.svg`,          fb.pictos.restroom.default), highlight: r(`buttons/pictos/${lang}/restroom-highlight.svg`,          fb.pictos.restroom.highlight) },
      smoking:  { default: r(`buttons/pictos/${lang}/smoking-room.svg`,      fb.pictos.smoking.default),  highlight: r(`buttons/pictos/${lang}/smoking-room-highlight.svg`,      fb.pictos.smoking.highlight) },
    },
    pictoMapIcons: {
      atm:      r('icons/pictos/atm.svg',               fb.pictoMapIcons.atm),
      elevator: r('icons/pictos/elevator.svg',          fb.pictoMapIcons.elevator),
      lockers:  r('icons/pictos/free-coin-lockers.svg', fb.pictoMapIcons.lockers),
      info:     r('icons/pictos/info.svg',              fb.pictoMapIcons.info),
      restroom: r('icons/pictos/restroom.svg',          fb.pictoMapIcons.restroom),
      smoking:  r('icons/pictos/smoking-room.svg',      fb.pictoMapIcons.smoking),
    },
    speechBubbleIconSrc: r(`icons/locations/user-${lang}.svg`, fb.speechBubbleIconSrc),
    locationIconSrc:     r('icons/locations/location.svg',     fb.locationIconSrc),
    close:               r(`buttons/closes/${lang}.svg`,           fb.close),
    closeHighlight:      r(`buttons/closes/${lang}-highlight.svg`, fb.closeHighlight),
    currentFloorIcon:    r(`icons/floors/current-${lang === 'ja' ? 'jp' : lang}.svg`, ''),
  };
}

// ── Hook ─────────────────────────────────────────────────────────

export function useHalongAssets(lang: 'en' | 'ja' | 'vn' = 'en'): HalongAssets {
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

  // localMap と lang から同期的にアセットを導出（言語切り替えでフラッシュなし）
  return useMemo(
    () => localMap ? buildFromLocal(localMap, lang) : getBundled(lang),
    [localMap, lang],
  );
}
