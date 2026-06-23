// src/hooks/useMapForceFetch.ts
// Force-fetch maps from S3, bypassing version comparison.
// Used by the "最新のマップ画像を取得" button in ImageSettingsTab.
// On download complete: updates disk files + .map-meta.json immediately.
// Returns dataURLs for preview; the caller decides whether to persist to settings.
import { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { logInfo, logError } from '../logs/logging';
import { loadGlobalSettings } from '../utils/settings';
import { BaseDirectory, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
import type { FloorId } from '../types/floorLayout';

interface MediaProgressPayload {
  phase: string;
  percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  message: string;
}

export interface MapForceFetchStatus {
  status: 'idle' | 'fetching' | 'done' | 'error';
  progress: number;
  message: string;
}

const S3_MEDIAS_BASE = 'https://dl.tti.ninja/gido-touch/medias';

const FLOOR_IDS: FloorId[] = ['1F', '2F', '3F', '4F'];

async function fetchLatestMapZipUrl(mallId: string, hostname: string): Promise<string | null> {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const url = `${S3_MEDIAS_BASE}/${mallId}/maps/${hostname}/latest.json?t=${Date.now()}`;
    const response = await tauriFetch(url, {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { zip: string; updated_at: string };
    return `${S3_MEDIAS_BASE}/${mallId}/maps/${hostname}/${data.zip}`;
  } catch (error) {
    logError('MAP_FORCE_FETCH', 'Failed to fetch latest.json', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function writeMapMeta(mallId: string, hostname: string, zipName: string): Promise<void> {
  try {
    const dir = `medias/${mallId}/maps/${hostname}`;
    await mkdir(dir, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(
      `${dir}/.map-meta.json`,
      JSON.stringify({ lastZipName: zipName, lastUpdatedAt: new Date().toISOString() }),
      { baseDir: BaseDirectory.AppLocalData },
    );
  } catch {
    // non-critical
  }
}

function parseFloorMapsFromAssets(
  assetMap: Record<string, string>,
): Partial<Record<FloorId, string>> {
  const result: Partial<Record<FloorId, string>> = {};
  for (const floorId of FLOOR_IDS) {
    const key = `maps/${floorId}-map.svg`;
    if (assetMap[key]) {
      result[floorId] = assetMap[key];
    }
  }
  return result;
}

export function useMapForceFetch() {
  const [status, setStatus] = useState<MapForceFetchStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const isFetching = useRef(false);

  const fetchMaps = async (hostnameOverride?: string): Promise<Partial<Record<FloorId, string>> | null> => {
    if (isFetching.current) return null;
    isFetching.current = true;

    try {
      const globalSettings = await loadGlobalSettings();
      const { mallId } = globalSettings;
      const hostname = hostnameOverride ?? globalSettings.hostname ?? '';

      if (!mallId) {
        setStatus({ status: 'error', progress: 0, message: 'モールIDが未設定です' });
        return null;
      }
      if (!hostname || hostname === 'unknown') {
        setStatus({ status: 'error', progress: 0, message: 'ホスト名が未設定のため取得できません' });
        return null;
      }

      setStatus({ status: 'fetching', progress: 0, message: 'S3からマップ情報を取得中...' });

      let timeoutId: ReturnType<typeof setTimeout>;
      const zipUrlPromise = fetchLatestMapZipUrl(mallId, hostname);
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), 5000);
      });

      const zipUrl = await Promise.race([
        zipUrlPromise.finally(() => clearTimeout(timeoutId!)),
        timeoutPromise,
      ]);

      if (!zipUrl) {
        setStatus({ status: 'error', progress: 0, message: 'S3上にマップデータが見つかりませんでした' });
        return null;
      }

      // Extract zip filename for meta update
      const zipName = zipUrl.split('/').pop() ?? '';

      setStatus({ status: 'fetching', progress: 0, message: 'マップデータをダウンロード中...' });

      let unlisten: UnlistenFn | null = null;
      try {
        unlisten = await listen<MediaProgressPayload>('media-download-progress', (event) => {
          const { phase, percent, message } = event.payload;
          const mapped = phase === 'download' ? percent * 0.85 : 85 + percent * 0.15;
          setStatus({
            status: 'fetching',
            progress: Math.min(99, Math.round(mapped)),
            message,
          });
        });

        await invoke('sync_maps_from_s3', { mallId, hostname, zipUrl });
      } finally {
        if (unlisten) unlisten();
      }

      // Update meta immediately (DL complete)
      await writeMapMeta(mallId, hostname, zipName);
      logInfo('MAP_FORCE_FETCH', 'Map files updated from S3', { mallId, hostname, zipName });

      // Load the extracted SVGs as dataURLs for preview
      setStatus({ status: 'fetching', progress: 99, message: '画像を読み込み中...' });
      const assetMap = await invoke<Record<string, string>>('list_mall_assets', { mallId, hostname });
      const floorMaps = parseFloorMapsFromAssets(assetMap);

      if (Object.keys(floorMaps).length === 0) {
        setStatus({ status: 'error', progress: 0, message: 'マップ画像の読み込みに失敗しました' });
        return null;
      }

      setStatus({ status: 'done', progress: 100, message: 'マップ画像を取得しました' });
      return floorMaps;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logError('MAP_FORCE_FETCH', 'Force fetch failed', { error: msg });
      setStatus({ status: 'error', progress: 0, message: 'マップデータの取得に失敗しました' });
      return null;
    } finally {
      isFetching.current = false;
    }
  };

  const reset = () => {
    setStatus({ status: 'idle', progress: 0, message: '' });
  };

  return { status, fetchMaps, reset };
}
