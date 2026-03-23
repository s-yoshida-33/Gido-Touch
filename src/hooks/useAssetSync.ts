// src/hooks/useAssetSync.ts
// Asset sync via S3 – checks S3 latest.json for assets ZIP updates.
// Downloads and extracts to media/assets/{mallId}/ via sync_assets_from_s3.
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

export interface AssetSyncStatus {
  status: 'idle' | 'checking' | 'downloading' | 'done' | 'error';
  progress: number;
  message: string;
}

interface AssetMeta {
  lastZipName: string | null;
  lastUpdatedAt: string | null;
}

const S3_ASSETS_BASE = 'https://dl.tti.ninja/gido-touch/medias/assets';

async function fetchAssetVersionFromS3(mallId: string): Promise<{ zip: string | null; updated_at: string | null }> {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const url = `${S3_ASSETS_BASE}/${mallId}/latest.json?t=${Date.now()}`;
    const response = await tauriFetch(url, {
      headers: { 'Cache-Control': 'no-cache, no-store', 'Pragma': 'no-cache' },
    });
    if (!response.ok) throw new Error(`Failed to fetch latest.json: ${response.status}`);
    const data = await response.json() as { zip: string; updated_at: string };
    logInfo('ASSET_SYNC', `Asset version fetched: ${data.zip}, updated_at: ${data.updated_at}`);
    return { zip: data.zip, updated_at: data.updated_at };
  } catch (error) {
    logError('ASSET_SYNC', 'Failed to fetch asset version from S3', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { zip: null, updated_at: null };
  }
}

const assetMetaPath = (mallId: string) => `media/assets/${mallId}/.asset-meta.json`;

async function readAssetMeta(mallId: string): Promise<AssetMeta | null> {
  try {
    const path = assetMetaPath(mallId);
    const metaExists = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (!metaExists) return null;
    const content = await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
    return JSON.parse(content) as AssetMeta;
  } catch {
    return null;
  }
}

async function writeAssetMeta(mallId: string, meta: AssetMeta): Promise<void> {
  try {
    await mkdir(`media/assets/${mallId}`, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(assetMetaPath(mallId), JSON.stringify(meta), { baseDir: BaseDirectory.AppLocalData });
  } catch {
    // non-critical
  }
}

export const useAssetSync = () => {
  const [assetStatus, setAssetStatus] = useState<AssetSyncStatus>({
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

        if (!mallId) {
          logWarn('ASSET_SYNC', 'No mallId configured, skipping asset check');
          setAssetStatus({ status: 'done', progress: 100, message: 'モールIDが未設定です' });
          return;
        }

        logInfo('ASSET_SYNC', 'Checking asset status via S3', { mallId });
        setAssetStatus({ status: 'checking', progress: 0, message: 'アセットデータの更新を確認中...' });

        const localMeta = await readAssetMeta(mallId);
        const localZipName = localMeta?.lastZipName ?? null;

        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<{ zip: string | null; updated_at: string | null }>((resolve) => {
          timeoutId = setTimeout(() => resolve({ zip: null, updated_at: null }), 5000);
        });

        const remoteVersion = await Promise.race([
          fetchAssetVersionFromS3(mallId).finally(() => clearTimeout(timeoutId!)),
          timeoutPromise,
        ]);

        if (!remoteVersion.zip && !remoteVersion.updated_at) {
          logInfo('ASSET_SYNC', 'Could not fetch remote version, assuming up to date');
          setAssetStatus({ status: 'done', progress: 100, message: 'アセットは最新です' });
          return;
        }

        const zipNameChanged = remoteVersion.zip != null && (
          localZipName == null || remoteVersion.zip !== localZipName
        );

        if (!zipNameChanged) {
          logInfo('ASSET_SYNC', 'Assets are up to date', { mallId });
          setAssetStatus({ status: 'done', progress: 100, message: 'アセットは最新です' });
          return;
        }

        logInfo('ASSET_SYNC', `Asset ZIP changed: ${localZipName} → ${remoteVersion.zip}`, { mallId });

        const zipUrl = `${S3_ASSETS_BASE}/${mallId}/${remoteVersion.zip}`;
        setAssetStatus({ status: 'downloading', progress: 0, message: `アセットをダウンロード中... (${mallId})` });

        let unlisten: UnlistenFn | null = null;
        try {
          unlisten = await listen<MediaProgressPayload>('media-download-progress', (event) => {
            const { phase, percent, message } = event.payload;
            const mappedProgress = phase === 'download' ? percent * 0.85 : 85 + (percent * 0.15);
            setAssetStatus({
              status: 'downloading',
              progress: Math.min(99, Math.round(mappedProgress)),
              message,
            });
          });

          await invoke('sync_assets_from_s3', { mallId, zipUrl });

          await writeAssetMeta(mallId, {
            lastZipName: remoteVersion.zip,
            lastUpdatedAt: remoteVersion.updated_at ?? new Date().toISOString(),
          });

          logInfo('ASSET_SYNC', 'Asset update completed', { mallId, zipName: remoteVersion.zip });
          setAssetStatus({ status: 'done', progress: 100, message: 'アセットデータの更新が完了しました' });
        } finally {
          if (unlisten) unlisten();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('ASSET_SYNC', 'Asset sync error', { error: errorMessage });
        setAssetStatus({ status: 'error', progress: 0, message: 'アセットデータの取得に失敗しました' });
      }
    };

    run();
  }, []);

  return { assetStatus };
};
