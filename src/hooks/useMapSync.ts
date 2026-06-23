// src/hooks/useMapSync.ts
// Map sync via S3 – checks S3 latest.json for maps ZIP updates per hostname.
// Downloads and extracts to media/maps/{mallId}/{hostname}/ via sync_maps_from_s3.
// Skipped entirely when hostname is not configured.
import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { logInfo, logWarn, logError } from '../logs/logging';
import { loadGlobalSettings } from '../utils/settings';

interface MediaProgressPayload {
  phase: string;
  percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  message: string;
}

export interface MapSyncStatus {
  status: 'idle' | 'checking' | 'downloading' | 'done' | 'error';
  progress: number;
  message: string;
}

interface MapMeta {
  lastZipName: string | null;
  lastUpdatedAt: string | null;
}

const S3_MEDIAS_BASE = 'https://dl.tti.ninja/gido-touch/medias';

async function fetchMapVersionFromS3(mallId: string, hostname: string): Promise<{ zip: string | null; updated_at: string | null }> {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const url = `${S3_MEDIAS_BASE}/${mallId}/maps/${hostname}/latest.json?t=${Date.now()}`;
    const response = await tauriFetch(url, {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
    });
    if (!response.ok) throw new Error(`Failed to fetch latest.json: ${response.status}`);
    const data = await response.json() as { zip: string; updated_at: string };
    logInfo('MAP_SYNC', `Map version fetched: ${data.zip}, updated_at: ${data.updated_at}`);
    return { zip: data.zip, updated_at: data.updated_at };
  } catch (error) {
    logError('MAP_SYNC', 'Failed to fetch map version from S3', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { zip: null, updated_at: null };
  }
}

const mapMetaPath = (mallId: string, hostname: string) =>
  `medias/${mallId}/maps/${hostname}/.map-meta.json`;

async function readMapMeta(mallId: string, hostname: string): Promise<MapMeta | null> {
  try {
    const path = mapMetaPath(mallId, hostname);
    const metaExists = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (!metaExists) return null;
    const content = await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
    return JSON.parse(content) as MapMeta;
  } catch {
    return null;
  }
}

async function writeMapMeta(mallId: string, hostname: string, meta: MapMeta): Promise<void> {
  try {
    await mkdir(`medias/${mallId}/maps/${hostname}`, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(mapMetaPath(mallId, hostname), JSON.stringify(meta), { baseDir: BaseDirectory.AppLocalData });
  } catch {
    // non-critical
  }
}

export const useMapSync = () => {
  const [mapStatus, setMapStatus] = useState<MapSyncStatus>({
    status: 'idle',
    progress: 0,
    message: '',
  });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      try {
        const globalSettings = await loadGlobalSettings();
        const mallId = globalSettings.mallId;
        const hostname = globalSettings.hostname ?? '';

        if (!mallId) {
          logWarn('MAP_SYNC', 'No mallId configured, skipping map check');
          setMapStatus({ status: 'done', progress: 100, message: 'モールIDが未設定です' });
          return;
        }

        if (!hostname || hostname === 'unknown') {
          logWarn('MAP_SYNC', 'No hostname configured, skipping map check');
          setMapStatus({ status: 'done', progress: 100, message: 'ホスト名が未設定のためマップ更新をスキップします' });
          return;
        }

        logInfo('MAP_SYNC', 'Checking map status via S3', { mallId, hostname });
        setMapStatus({ status: 'checking', progress: 0, message: 'マップデータの更新を確認中...' });

        const localMeta = await readMapMeta(mallId, hostname);
        const localZipName = localMeta?.lastZipName ?? null;

        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<{ zip: string | null; updated_at: string | null }>((resolve) => {
          timeoutId = setTimeout(() => resolve({ zip: null, updated_at: null }), 5000);
        });

        const remoteVersion = await Promise.race([
          fetchMapVersionFromS3(mallId, hostname).finally(() => clearTimeout(timeoutId!)),
          timeoutPromise,
        ]);

        if (!remoteVersion.zip && !remoteVersion.updated_at) {
          logInfo('MAP_SYNC', 'Could not fetch remote version, assuming up to date');
          setMapStatus({ status: 'done', progress: 100, message: 'マップは最新です' });
          return;
        }

        const zipNameChanged = remoteVersion.zip != null && (
          localZipName == null || remoteVersion.zip !== localZipName
        );

        if (!zipNameChanged) {
          logInfo('MAP_SYNC', 'Maps are up to date', { mallId, hostname });
          setMapStatus({ status: 'done', progress: 100, message: 'マップは最新です' });
          return;
        }

        logInfo('MAP_SYNC', `Map ZIP changed: ${localZipName} → ${remoteVersion.zip}`, { mallId, hostname });

        const zipUrl = `${S3_MEDIAS_BASE}/${mallId}/maps/${hostname}/${remoteVersion.zip}`;
        setMapStatus({ status: 'downloading', progress: 0, message: `マップをダウンロード中... (${hostname})` });

        let unlisten: UnlistenFn | null = null;
        try {
          unlisten = await listen<MediaProgressPayload>('media-download-progress', (event) => {
            const { phase, percent, message } = event.payload;
            const mappedProgress = phase === 'download' ? percent * 0.85 : 85 + (percent * 0.15);
            setMapStatus({
              status: 'downloading',
              progress: Math.min(99, Math.round(mappedProgress)),
              message,
            });
          });

          await invoke('sync_maps_from_s3', { mallId, hostname, zipUrl });

          await writeMapMeta(mallId, hostname, {
            lastZipName: remoteVersion.zip,
            lastUpdatedAt: remoteVersion.updated_at ?? new Date().toISOString(),
          });

          logInfo('MAP_SYNC', 'Map update completed', { mallId, hostname, zipName: remoteVersion.zip });
          setMapStatus({ status: 'done', progress: 100, message: 'マップデータの更新が完了しました' });
        } finally {
          if (unlisten) unlisten();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('MAP_SYNC', 'Map sync error', { error: errorMessage });
        setMapStatus({ status: 'error', progress: 0, message: 'マップデータの取得に失敗しました' });
      }
    };

    run();
  }, []);

  return { mapStatus };
};
