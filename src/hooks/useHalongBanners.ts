import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { convertFileSrc } from '@tauri-apps/api/core';

export interface HalongBannerFile {
  filename: string;
  url: string;
}

export function useHalongBanners(): {
  banners: HalongBannerFile[];
  reload: () => void;
} {
  const [banners, setBanners] = useState<HalongBannerFile[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await invoke<{ filename: string; absPath: string }[]>('list_halong_banners');
      setBanners(list.map((f) => ({ filename: f.filename, url: convertFileSrc(f.absPath) })));
    } catch {
      setBanners([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { banners, reload: load };
}
