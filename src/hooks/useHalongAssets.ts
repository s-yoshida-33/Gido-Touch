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

import bundledFloorBtnB1          from '../assets/malls/halong/buttons/floors/en/B1-01.svg';
import bundledFloorBtnB1Highlight  from '../assets/malls/halong/buttons/floors/en/B1-01-highlight.svg';
import bundledFloorBtn1F          from '../assets/malls/halong/buttons/floors/en/1F-01.svg';
import bundledFloorBtn1FHighlight  from '../assets/malls/halong/buttons/floors/en/1F-01-highlight.svg';
import bundledFloorBtn2F          from '../assets/malls/halong/buttons/floors/en/2F-01.svg';
import bundledFloorBtn2FHighlight  from '../assets/malls/halong/buttons/floors/en/2F-01-highlight.svg';
import bundledFloorBtn3F          from '../assets/malls/halong/buttons/floors/en/3F-01.svg';
import bundledFloorBtn3FHighlight  from '../assets/malls/halong/buttons/floors/en/3F-01-highlight.svg';
import bundledFloorBtn4F          from '../assets/malls/halong/buttons/floors/en/4F-01.svg';
import bundledFloorBtn4FHighlight  from '../assets/malls/halong/buttons/floors/en/4F-01-highlight.svg';

import bundledLangEn from '../assets/malls/halong/buttons/languages/en.svg';

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
  langButtons: { en: string };
  pictos: {
    atm:            { default: string; highlight: string };
    elevator:       { default: string; highlight: string };
    lockers:        { default: string; highlight: string };
    info:           { default: string; highlight: string };
    restroom:       { default: string; highlight: string };
    smoking:        { default: string; highlight: string };
  };
}

// ── バンドルアセット定数 ──────────────────────────────────────────

const BUNDLED: HalongAssets = {
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
  floorButtons: {
    'B1': { default: bundledFloorBtnB1,  highlight: bundledFloorBtnB1Highlight },
    '1F': { default: bundledFloorBtn1F,  highlight: bundledFloorBtn1FHighlight },
    '2F': { default: bundledFloorBtn2F,  highlight: bundledFloorBtn2FHighlight },
    '3F': { default: bundledFloorBtn3F,  highlight: bundledFloorBtn3FHighlight },
    '4F': { default: bundledFloorBtn4F,  highlight: bundledFloorBtn4FHighlight },
  },
  langButtons: { en: bundledLangEn },
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

// ── Hook ─────────────────────────────────────────────────────────

export function useHalongAssets(): HalongAssets {
  const [assets, setAssets] = useState<HalongAssets>(BUNDLED);

  useEffect(() => {
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

        setAssets({
          openTime: r('open-times/en.svg', BUNDLED.openTime),
          genres: {
            all:             r('buttons/genres/en/all.svg',            BUNDLED.genres.all),
            allHighlight:    r('buttons/genres/en/all-hilight.svg',    BUNDLED.genres.allHighlight),
            fashion:         r('buttons/genres/en/fashion.svg',        BUNDLED.genres.fashion),
            fashionHighlight: r('buttons/genres/en/fashion-hilight.svg', BUNDLED.genres.fashionHighlight),
            goods:           r('buttons/genres/en/goods.svg',          BUNDLED.genres.goods),
            goodsHighlight:  r('buttons/genres/en/goods-hilight.svg',  BUNDLED.genres.goodsHighlight),
            gourmet:         r('buttons/genres/en/gourmet.svg',        BUNDLED.genres.gourmet),
            gourmetHighlight: r('buttons/genres/en/gourmet-hilight.svg', BUNDLED.genres.gourmetHighlight),
            service:         r('buttons/genres/en/service.svg',        BUNDLED.genres.service),
            serviceHighlight: r('buttons/genres/en/service-hilight.svg', BUNDLED.genres.serviceHighlight),
            next:            r('buttons/genres/next.svg',              BUNDLED.genres.next),
            prev:            r('buttons/genres/prev.svg',              BUNDLED.genres.prev),
          },
          hint: r('hint/en.svg', BUNDLED.hint),
          floorLabels: {
            'B1': r('floor-labels/en/B1.svg', BUNDLED.floorLabels['B1']),
            '1F': r('floor-labels/en/1F.svg', BUNDLED.floorLabels['1F']),
            '2F': r('floor-labels/en/2F.svg', BUNDLED.floorLabels['2F']),
            '3F': r('floor-labels/en/3F.svg', BUNDLED.floorLabels['3F']),
            '4F': r('floor-labels/en/4F.svg', BUNDLED.floorLabels['4F']),
          },
          floorButtons: {
            'B1': {
              default:   r('buttons/floors/en/B1-01.svg',           BUNDLED.floorButtons['B1'].default),
              highlight: r('buttons/floors/en/B1-01-highlight.svg', BUNDLED.floorButtons['B1'].highlight),
            },
            '1F': {
              default:   r('buttons/floors/en/1F-01.svg',           BUNDLED.floorButtons['1F'].default),
              highlight: r('buttons/floors/en/1F-01-highlight.svg', BUNDLED.floorButtons['1F'].highlight),
            },
            '2F': {
              default:   r('buttons/floors/en/2F-01.svg',           BUNDLED.floorButtons['2F'].default),
              highlight: r('buttons/floors/en/2F-01-highlight.svg', BUNDLED.floorButtons['2F'].highlight),
            },
            '3F': {
              default:   r('buttons/floors/en/3F-01.svg',           BUNDLED.floorButtons['3F'].default),
              highlight: r('buttons/floors/en/3F-01-highlight.svg', BUNDLED.floorButtons['3F'].highlight),
            },
            '4F': {
              default:   r('buttons/floors/en/4F-01.svg',           BUNDLED.floorButtons['4F'].default),
              highlight: r('buttons/floors/en/4F-01-highlight.svg', BUNDLED.floorButtons['4F'].highlight),
            },
          },
          langButtons: {
            en: r('buttons/languages/en.svg', BUNDLED.langButtons.en),
          },
          pictos: {
            atm:      { default: r('buttons/pictos/en/atm.svg',                 BUNDLED.pictos.atm.default),      highlight: r('buttons/pictos/en/atm-highlight.svg',                 BUNDLED.pictos.atm.highlight) },
            elevator: { default: r('buttons/pictos/en/elevator.svg',            BUNDLED.pictos.elevator.default), highlight: r('buttons/pictos/en/elevator-highlight.svg',            BUNDLED.pictos.elevator.highlight) },
            lockers:  { default: r('buttons/pictos/en/free-coin-lockers.svg',   BUNDLED.pictos.lockers.default),  highlight: r('buttons/pictos/en/free-coin-lockers-highlight.svg',   BUNDLED.pictos.lockers.highlight) },
            info:     { default: r('buttons/pictos/en/info.svg',                BUNDLED.pictos.info.default),     highlight: r('buttons/pictos/en/info-highlight.svg',                BUNDLED.pictos.info.highlight) },
            restroom: { default: r('buttons/pictos/en/restroom.svg',            BUNDLED.pictos.restroom.default), highlight: r('buttons/pictos/en/restroom-highlight.svg',            BUNDLED.pictos.restroom.highlight) },
            smoking:  { default: r('buttons/pictos/en/smoking-room.svg',        BUNDLED.pictos.smoking.default),  highlight: r('buttons/pictos/en/smoking-room-highlight.svg',        BUNDLED.pictos.smoking.highlight) },
          },
        });
      } catch {
        // Tauri 未使用（ブラウザ開発環境）またはロード失敗 → バンドルアセットを使用
      }
    }

    load();
  }, []);

  return assets;
}
