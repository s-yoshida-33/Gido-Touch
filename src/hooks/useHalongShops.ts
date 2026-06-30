// src/hooks/useHalongShops.ts
// shopDataMode: 'api'   → BG SSE からのリアルタイムデータ（未実装・将来対応）
// shopDataMode: 'local' → %LOCALAPPDATA%\com.gido-touch\data\json\shoplist.json を参照

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadMallSettings } from '../utils/settings';

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
    gourmet: { vn: 'Ẩm Thực',   en: 'Gourmet',  ja: 'グルメ' },
    fashion: { vn: 'Thời Trang', en: 'Fashion',  ja: 'ファッション' },
    goods:   { vn: 'Tạp Hóa',   en: 'Goods',    ja: 'グッズ' },
    service: { vn: 'Dịch Vụ',   en: 'Service',  ja: 'サービス' },
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
// Ha Long: 飲食 / ファッション＆スポーツ / 日用品＆テクノロジー /
//          アクセサリー＆シューズ / エンターテインメント＆サービス

const GENRE_MAP: Record<string, string> = {
  // Ha Long ベトナム語（genre フィールド）
  'Ẩm Thực':   'gourmet',
  'Tạp Hóa':   'goods',
  'Thời Trang': 'fashion',
  'Dịch Vụ':   'service',
  // Ha Long 英語・単語形式（genreEnglish フィールド）
  'Gourmet': 'gourmet',
  'Goods':   'goods',
  'Fashion': 'fashion',
  'Service': 'service',
  // Ha Long 英語・複合形式（旧フォーマット互換）
  'Foods & Beverage':         'gourmet',
  'Fashion & Sports':         'fashion',
  'Commodities & Technology': 'goods',
  'Accessories & Shoes':      'goods',
  'Entertainment & Services': 'service',
  // 日本語（旧フォーマット互換）
  '飲食':                       'gourmet',
  'ファッション＆スポーツ':       'fashion',
  '日用品＆テクノロジー':         'goods',
  'アクセサリー＆シューズ':       'goods',
  'エンターテインメント＆サービス': 'service',
  'グルメ':     'gourmet',
  'ファッション': 'fashion',
  'グッズ':     'goods',
  'サービス':   'service',
  // 英語キー直接渡し
  'gourmet': 'gourmet',
  'fashion': 'fashion',
  'goods':   'goods',
  'service': 'service',
};

function mapGenre(genre: string, genreEnglish?: string): string {
  if (genreEnglish) {
    const mapped = GENRE_MAP[genreEnglish.trim()];
    if (mapped) return mapped;
  }
  return GENRE_MAP[genre.trim()] ?? 'goods';
}

// ── BGフォーマットのパース ────────────────────────────────────────────────

async function parseBgShops(raw: unknown): Promise<HalongShop[]> {
  if (!Array.isArray(raw)) return [];

  const entries = (raw as BgShopEntry[]).filter(
    s => s.closeFlg !== '1' && s.webStatus !== '0'
  );

  return Promise.all(
    entries.map(async (s): Promise<HalongShop> => {
      let logoDataUrl: string | null = null;
      try {
        // %LOCALAPPDATA%\com.gido-touch\data\halong\files\shops\{shopId}\thumbW640_logo.webp
        logoDataUrl = await invoke<string | null>('get_local_shop_logo', { mallId: 'halong', shopId: s.shopId });
      } catch {
        // ロゴ取得失敗 → 空欄表示
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
        floorKey: floorJa || s.floor,
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
      try {
        const mallSettings = await loadMallSettings('halong');

        if (mallSettings.shopDataMode === 'local') {
          // ローカルモード: %LOCALAPPDATA%\com.gido-touch\data\halong\json\shoplist.json
          const raw = await invoke<unknown>('load_local_shoplist', { mallId: 'halong' });
          if (raw == null) return;
          setShops(await parseBgShops(raw));
        } else {
          // APIモード: BG SSE によるリアルタイムデータ（将来実装）
          // TODO: BG SSE 連携実装後にここで受け取ったデータを parseBgShops に渡す
        }
      } catch {
        // Tauri 未使用（ブラウザ開発環境）またはロード失敗 → 空リスト維持
      }
    }

    load();
  }, []);

  return shops;
}
