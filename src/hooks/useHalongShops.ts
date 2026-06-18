// src/hooks/useHalongShops.ts
// Shop data loaded from medias/shops/halong.json, logos resolved via get_shop_image.

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface HalongShop {
  id: number;
  name: string;
  floor: string;
  section: string;
  genre: string;
  logoDataUrl: string | null;
}

interface RawShop {
  id: number;
  name: string;
  floor: string;
  section: string;
  genre: string;
  logoPath?: string;
}

export function useHalongShops(): HalongShop[] {
  const [shops, setShops] = useState<HalongShop[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const raw = await invoke<{ shops: RawShop[] } | null>('load_shop_data', { mallId: 'halong' });
        if (!raw || !raw.shops) return;

        const resolved = await Promise.all(
          raw.shops.map(async (s): Promise<HalongShop> => {
            let logoDataUrl: string | null = null;
            if (s.logoPath) {
              try {
                logoDataUrl = await invoke<string | null>('get_shop_image', { filePath: s.logoPath });
              } catch {
                // logo unavailable — show empty area
              }
            }
            return { id: s.id, name: s.name, floor: s.floor, section: s.section, genre: s.genre, logoDataUrl };
          })
        );

        setShops(resolved);
      } catch {
        // Tauri unavailable (browser dev) or file missing — leave shops empty
      }
    }

    load();
  }, []);

  return shops;
}
