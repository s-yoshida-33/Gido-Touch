// src/hooks/useHalongMaps.ts

import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { loadGlobalSettings } from '../utils/settings';

import bundledMap1F from '../maps/malls/halong/1F-map.svg';
import bundledMap2F from '../maps/malls/halong/2F-map.svg';
import bundledMap3F from '../maps/malls/halong/3F-map.svg';
import bundledMap4F from '../maps/malls/halong/4F-map.svg';

export interface HalongMaps {
  '1F': string;
  '2F': string;
  '3F': string;
  '4F': string;
}

const BUNDLED: HalongMaps = {
  '1F': bundledMap1F,
  '2F': bundledMap2F,
  '3F': bundledMap3F,
  '4F': bundledMap4F,
};

export function useHalongMaps(): HalongMaps {
  const [maps, setMaps] = useState<HalongMaps>(BUNDLED);

  useEffect(() => {
    async function load() {
      try {
        const global = await loadGlobalSettings();
        const hostname = global.hostname ?? '';
        const local = await invoke<Record<string, string> | null>('list_mall_maps', {
          mallId: 'halong',
          hostname,
        });
        if (!local) return;

        const r = (key: string, fallback: string) => local[key] || fallback;

        setMaps({
          '1F': r('1F-map.svg', BUNDLED['1F']),
          '2F': r('2F-map.svg', BUNDLED['2F']),
          '3F': r('3F-map.svg', BUNDLED['3F']),
          '4F': r('4F-map.svg', BUNDLED['4F']),
        });
      } catch {
        // Tauri 未使用（ブラウザ開発環境）またはロード失敗 → バンドルアセットを使用
      }
    }

    load();
  }, []);

  return maps;
}
