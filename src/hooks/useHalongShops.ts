// src/hooks/useHalongShops.ts
// shopDataMode: 'api'   → BG SSE からのリアルタイムデータ（未実装・将来対応）
// shopDataMode: 'local' → %LOCALAPPDATA%\com.gido-touch\data\json\shoplist.json を参照

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadMallSettings } from '../utils/settings';

// ── 型定義 ──────────────────────────────────────────────────────────────────

export interface HalongShop {
  id: number;
  name: string;
  floor: string;
  section: string;
  genre: string;
  logoDataUrl: string | null;
}

/** BG shops.json の1エントリ（必要フィールドのみ） */
interface BgShopEntry {
  shopId: string;
  shopName: string;
  shopNameEnglish?: string;
  floor: string;
  number: string;
  genre: string;
  shopLogoThumb640x640LocalPath?: string;
  closeFlg?: string;
  webStatus?: string;
}

// ── ジャンルマッピング（BG日本語 → 内部キー） ─────────────────────────────

const GENRE_MAP: Record<string, string> = {
  'グルメ':     'gourmet',
  'ファッション': 'fashion',
  'グッズ':     'goods',
  'サービス':   'service',
  'gourmet':   'gourmet',
  'fashion':   'fashion',
  'goods':     'goods',
  'service':   'service',
};

function mapGenre(raw: string): string {
  return GENRE_MAP[raw.trim()] ?? 'goods';
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
      if (s.shopLogoThumb640x640LocalPath) {
        try {
          logoDataUrl = await invoke<string | null>('get_shop_image', {
            filePath: s.shopLogoThumb640x640LocalPath,
          });
        } catch {
          // ロゴ取得失敗 → 空欄表示
        }
      }
      return {
        id: parseInt(s.shopId, 10),
        name: s.shopNameEnglish?.trim() || s.shopName,
        floor: s.floor,
        section: s.number,
        genre: mapGenre(s.genre),
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
          // ローカルモード: %LOCALAPPDATA%\com.gido-touch\data\json\shoplist.json
          const raw = await invoke<unknown>('load_local_shoplist');
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
