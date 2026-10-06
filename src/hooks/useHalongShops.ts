// src/hooks/useHalongShops.ts
// operationMode: 'api'    → BG SSE からのリアルタイムデータ（未実装・将来対応）
// operationMode: 'on-pre' → オンプレサーバーからデータ取得（将来実装）
// operationMode: 'local'  → %LOCALAPPDATA%\com.gido-touch\data\json\shoplist.json を参照

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { loadGlobalSettings } from '../utils/settings';
import { SHOP_DATA_UPDATED_EVENT } from './useDataSync';

// ── 型定義 ──────────────────────────────────────────────────────────────────

export interface HalongShop {
  id: number;
  shopId: string;    // 元の shopId 文字列（ファイルパス構築用）
  name: string;      // shopName（現地語ベース）
  nameJa: string;    // shopNameJapan（空なら name にフォールバック）
  nameEn: string;    // shopNameEnglish（空なら name にフォールバック）
  nameVn: string;    // shopNameVietnam（空なら name にフォールバック）
  floor: string;     // floor（現地語ベース、表示用）
  floorKey: string;  // フロア識別キー（常に "1F"/"2F"/"3F"/"4F" 形式、比較・ソート用）
  floorJa: string;   // floorJapan（空なら floor にフォールバック）
  floorEn: string;   // floorEnglish（空なら floor にフォールバック）
  floorVn: string;   // floorVietnam（空なら floor にフォールバック）
  section: string;
  genre: string;
  logoDataUrl: string | null;
  openingHours: string;    // 営業時間（現地語ベース）
  openingHoursJa: string;  // 営業時間（日本語）
  openingHoursEn: string;  // 営業時間（英語）
  openingHoursVn: string;  // 営業時間（ベトナム語）
  tel: string;             // 電話番号
}

/** 言語に応じた表示名を返す（対応フィールドが空なら name にフォールバック） */
export function getDisplayName(shop: HalongShop, lang: 'en' | 'ja' | 'vn'): string {
  if (lang === 'ja') return shop.nameJa || shop.name;
  if (lang === 'en') return shop.nameEn || shop.name;
  return shop.nameVn || shop.name;
}

/** 言語に応じたフロア表示テキストを返す（対応フィールドが空なら floor にフォールバック） */
export function getFloorDisplay(shop: HalongShop, lang: 'en' | 'ja' | 'vn'): string {
  if (lang === 'ja') return shop.floorJa || shop.floor;
  if (lang === 'en') return shop.floorEn || shop.floor;
  return shop.floorVn || shop.floor;
}

/** 言語に応じた営業時間テキストを返す（対応フィールドが空なら openingHours にフォールバック） */
export function getOpeningHoursDisplay(shop: HalongShop, lang: 'en' | 'ja' | 'vn'): string {
  if (lang === 'ja') return shop.openingHoursJa || shop.openingHours;
  if (lang === 'en') return shop.openingHoursEn || shop.openingHours;
  return shop.openingHoursVn || shop.openingHours;
}

/** ジャンルキーから言語別表示名を返す */
export function getGenreDisplay(genre: string, lang: 'en' | 'ja' | 'vn'): string {
  const map: Record<string, Record<string, string>> = {
    food:    { vn: 'Ẩm thực',                 en: 'Gourmet',               ja: 'グルメ' },
    fashion: { vn: 'Thời trang & Phụ kiện',   en: 'Fashion & Accessories', ja: 'ファッション＆アクセサリー' },
    goods:   { vn: 'Hàng hóa & Giải trí',     en: 'Goods & Amusement',     ja: '雑貨＆アミューズメント' },
  };
  return map[genre]?.[lang] ?? genre;
}

/** BG shoplist.json の1エントリ（Ha Long フォーマット） */
interface BgShopEntry {
  shopId: string;
  shopName: string;
  shopNameJapan?: string;
  shopNameEnglish?: string;
  shopNameVietnam?: string;
  floor: string;
  floorKey?: string;
  floorJapan?: string;
  floorEnglish?: string;
  floorVietnam?: string;
  number: string;
  genre: string;
  genreEnglish?: string;
  openingHours?: string;
  openingHoursJapan?: string;
  openingHoursEnglish?: string;
  openingHoursVietnam?: string;
  tel?: string;
  closeFlg?: string;
  webStatus?: string;
}

// ── ジャンルマッピング ────────────────────────────────────────────────────
// CMSの11ジャンルを3つのジャンルボタン（food / fashion / goods）にまとめる
//   グルメ: 食品 / レストラン / カフェ / フードコート
//   ファッション＆アクセサリー: ファッション / アクセサリー
//   雑貨＆アミューズメント: 雑貨 / ホビー / サービス / 大型専門店 / アミューズメント / 映画館

const GENRE_MAP: Record<string, string> = {
  // 英語（genreEnglish フィールド）
  'Food':                'food',
  'Restaurants / Cafés': 'food',
  'Food Court':          'food',
  'Fashion':             'fashion',
  'Accessories':         'fashion',
  'Goods':               'goods',
  'Hobby':               'goods',
  'Services':            'goods',
  'Large Store':         'goods',
  'Entertainment':       'goods',
  'Cinema':              'goods',
  // ベトナム語（genre フィールド、genreEnglish 未設定時のフォールバック）
  'Thực phẩm':           'food',
  'Nhà hàng / Cà phê':   'food',
  'Khu ẩm thực':         'food',
  'Thời trang':          'fashion',
  'Phụ kiện':            'fashion',
  'Hàng hóa':            'goods',
  'Sở thích':            'goods',
  'Dịch vụ':             'goods',
  'Cửa hàng quy mô lớn': 'goods',
  'Vui chơi giải trí':   'goods',
  'Rạp chiếu phim':      'goods',
  // 英語キー直接渡し
  'food':    'food',
  'fashion': 'fashion',
  'goods':   'goods',
};

function mapGenre(genre: string, genreEnglish?: string): string {
  if (genreEnglish) {
    const mapped = GENRE_MAP[genreEnglish.trim()];
    if (mapped) return mapped;
  }
  return GENRE_MAP[genre.trim()] ?? 'goods';
}

// ── BGフォーマットのパース ────────────────────────────────────────────────

async function parseBgShops(raw: unknown, devMode = false): Promise<HalongShop[]> {
  if (!Array.isArray(raw)) return [];

  const entries = (raw as BgShopEntry[]).filter(
    s => s.closeFlg !== '1' && s.webStatus !== '0'
  );

  return Promise.all(
    entries.map(async (s): Promise<HalongShop> => {
      let logoDataUrl: string | null = null;
      if (devMode) {
        // devモード: Vite dev server の public ディレクトリから参照
        logoDataUrl = `/data/halong/files/shops/${s.shopId}/thumbW640_logo.webp`;
      } else {
        try {
          // %LOCALAPPDATA%\com.gido-touch\data\halong\files\shops\{shopId}\thumbW640_logo.webp
          logoDataUrl = await invoke<string | null>('get_local_shop_logo', { mallId: 'halong', shopId: s.shopId });
        } catch {
          // ロゴ取得失敗 → 空欄表示
        }
      }
      const floorJa = s.floorJapan?.trim() ?? '';
      return {
        id: parseInt(s.shopId, 10),
        shopId: s.shopId,
        name: s.shopName,
        nameJa: s.shopNameJapan?.trim() ?? '',
        nameEn: s.shopNameEnglish?.trim() ?? '',
        nameVn: s.shopNameVietnam?.trim() ?? '',
        floor: s.floor,
        // floorKey(CMSの選択式・必須フィールド)を優先。マップ画像・フロアボタンとの
        // 照合キーとして使うため、自由入力欄由来の値より安定している。
        // 移行前(floorKey未設定)の既存データ向けにのみ旧ロジックへフォールバックする。
        floorKey: s.floorKey?.trim() || floorJa || s.floor,
        floorJa,
        floorEn: s.floorEnglish?.trim() ?? '',
        floorVn: s.floorVietnam?.trim() ?? '',
        section: s.number ?? '',
        genre: mapGenre(s.genre, s.genreEnglish),
        logoDataUrl,
        openingHours: s.openingHours?.trim() ?? '',
        openingHoursJa: s.openingHoursJapan?.trim() ?? '',
        openingHoursEn: s.openingHoursEnglish?.trim() ?? '',
        openingHoursVn: s.openingHoursVietnam?.trim() ?? '',
        tel: s.tel?.trim() ?? '',
      };
    })
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useHalongShops(): HalongShop[] {
  const [shops, setShops] = useState<HalongShop[]>([]);

  useEffect(() => {
    async function load() {
      // devモード: Tauri 未使用のため public ディレクトリのファイルを参照
      if (import.meta.env.DEV) {
        try {
          const res = await fetch('/data/halong/json/shoplist.json');
          if (res.ok) {
            const raw = await res.json();
            setShops(await parseBgShops(raw, true));
            return;
          }
        } catch {
          // フォールバック: 空リスト維持
        }
        return;
      }

      try {
        const globalSettings = await loadGlobalSettings();
        const operationMode = globalSettings.operationMode ?? 'api';

        if (operationMode === 'local' || operationMode === 'on-pre') {
          // ローカル/オンプレモード: %LOCALAPPDATA%\com.gido-touch\data\halong\json\shoplist.json
          const raw = await invoke<unknown>('load_local_shoplist', { mallId: 'halong' });
          if (raw == null) return;
          setShops(await parseBgShops(raw));
        } else {
          // APIモード: BG SSE によるリアルタイムデータ（将来実装）
          // TODO: BG SSE 連携実装後にここで受け取ったデータを parseBgShops に渡す
        }
      } catch {
        // ロード失敗 → 空リスト維持
      }
    }

    load();

    // バックグラウンド同期(useDataSync)が新しい店舗データを取得した際に発火される
    // イベントを購読し、画面操作を挟まずに再読込する（起動時の1回読みだけだと、
    // ポーリングで裏側のファイルが更新されても画面に反映されない不具合があった）。
    let unlisten: (() => void) | undefined;
    if (!import.meta.env.DEV) {
      listen(SHOP_DATA_UPDATED_EVENT, () => {
        load();
      }).then((fn) => {
        unlisten = fn;
      });
    }

    return () => {
      unlisten?.();
    };
  }, []);

  return shops;
}
