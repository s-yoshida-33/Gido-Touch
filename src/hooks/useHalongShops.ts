// src/hooks/useHalongShops.ts
// shopDataMode: 'api'   → BG SSE からのリアルタイムデータ（未実装・将来対応）
// shopDataMode: 'local' → %LOCALAPPDATA%\com.gido-touch\data\json\shoplist.json を参照

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadMallSettings } from '../utils/settings';

// ── 型定義 ──────────────────────────────────────────────────────────────────

export interface HalongShop {
  id: number;
  name: string;      // shopName（現地語ベース）
  nameJa: string;    // shopNameJapan（空なら name にフォールバック）
  nameEn: string;    // shopNameEnglish（空なら name にフォールバック）
  nameVn: string;    // shopNameVietnam（空なら name にフォールバック）
  floor: string;
  section: string;
  genre: string;
  logoDataUrl: string | null;
}

/** 言語に応じた表示名を返す（対応フィールドが空なら name にフォールバック） */
export function getDisplayName(shop: HalongShop, lang: 'en' | 'ja' | 'vn'): string {
  if (lang === 'ja') return shop.nameJa || shop.name;
  if (lang === 'en') return shop.nameEn || shop.name;
  return shop.nameVn || shop.name;
}

/** BG shoplist.json の1エントリ（Ha Long フォーマット） */
interface BgShopEntry {
  shopId: string;
  shopName: string;
  shopNameJapan?: string;
  shopNameEnglish?: string;
  shopNameVietnam?: string;
  floor: string;
  number: string;
  genre: string;
  genreEnglish?: string;
  closeFlg?: string;
  webStatus?: string;
}

// ── ジャンルマッピング ────────────────────────────────────────────────────
// Ha Long: 飲食 / ファッション＆スポーツ / 日用品＆テクノロジー /
//          アクセサリー＆シューズ / エンターテインメント＆サービス

const GENRE_MAP: Record<string, string> = {
  // Ha Long 日本語
  '飲食':                       'gourmet',
  'ファッション＆スポーツ':       'fashion',
  '日用品＆テクノロジー':         'goods',
  'アクセサリー＆シューズ':       'goods',
  'エンターテインメント＆サービス': 'service',
  // Ha Long 英語（genreEnglish）
  'Foods & Beverage':           'gourmet',
  'Fashion & Sports':           'fashion',
  'Commodities & Technology':   'goods',
  'Accessories & Shoes':        'goods',
  'Entertainment & Services':   'service',
  // 旧フォーマット（他モール互換）
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
      return {
        id: parseInt(s.shopId, 10),
        name: s.shopName,
        nameJa: s.shopNameJapan?.trim() ?? '',
        nameEn: s.shopNameEnglish?.trim() ?? '',
        nameVn: s.shopNameVietnam?.trim() ?? '',
        floor: s.floor,
        section: s.number ?? '',
        genre: mapGenre(s.genre, s.genreEnglish),
        logoDataUrl,
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
