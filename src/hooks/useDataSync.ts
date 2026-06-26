// src/hooks/useDataSync.ts
// Data sync via S3 – checks S3 latest.json for data ZIP updates per subtype.
// Downloads and extracts to data/{mallId}/files/{subtype}/ or data/{mallId}/json/
// via sync_data_from_s3. Processes subtypes sequentially (network-friendly for poor connections).
// After extraction, writes .{subtype}-meta.json locally for version tracking.

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

export interface DataSyncStatus {
  status: 'idle' | 'checking' | 'downloading' | 'done' | 'error';
  progress: number;
  message: string;
}

interface DataMeta {
  lastZipName: string | null;
  lastUpdatedAt: string | null;
}

const S3_DATA_BASE = 'https://dl.tti.ninja/gido-touch/data';

const DATA_SUBTYPES = ['shops', 'news', 'events', 'json'] as const;
type DataSubtype = typeof DATA_SUBTYPES[number];

// news/events は未実装のため一時的に除外（再開する場合は DATA_SUBTYPES に戻す）
const ACTIVE_SUBTYPES: DataSubtype[] = ['shops', 'json'];

const META_NAMES: Record<DataSubtype, string> = {
  shops:  '.shop-meta.json',
  news:   '.news-meta.json',
  events: '.events-meta.json',
  json:   '.json-meta.json',
};

function s3LatestJsonUrl(mallId: string, subtype: DataSubtype): string {
  const base = subtype === 'json'
    ? `${S3_DATA_BASE}/${mallId}/json`
    : `${S3_DATA_BASE}/${mallId}/files/${subtype}`;
  return `${base}/latest.json?t=${Date.now()}`;
}

function s3ZipUrl(mallId: string, subtype: DataSubtype, zipName: string): string {
  return subtype === 'json'
    ? `${S3_DATA_BASE}/${mallId}/json/${zipName}`
    : `${S3_DATA_BASE}/${mallId}/files/${subtype}/${zipName}`;
}

function localMetaPath(mallId: string, subtype: DataSubtype): string {
  return subtype === 'json'
    ? `data/${mallId}/json/${META_NAMES[subtype]}`
    : `data/${mallId}/files/${subtype}/${META_NAMES[subtype]}`;
}

function localMetaDir(mallId: string, subtype: DataSubtype): string {
  return subtype === 'json'
    ? `data/${mallId}/json`
    : `data/${mallId}/files/${subtype}`;
}

async function fetchVersionFromS3(
  mallId: string,
  subtype: DataSubtype,
): Promise<{ zip: string | null; updated_at: string | null }> {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const response = await tauriFetch(s3LatestJsonUrl(mallId, subtype), {
      headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
    });
    if (!response.ok) {
      if (response.status === 404) return { zip: null, updated_at: null };
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json() as { zip: string; updated_at: string };
    logInfo('DATA_SYNC', `Version fetched for ${subtype}: ${data.zip}`);
    return { zip: data.zip, updated_at: data.updated_at };
  } catch (error) {
    logError('DATA_SYNC', `Failed to fetch version for ${subtype}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { zip: null, updated_at: null };
  }
}

async function readLocalMeta(mallId: string, subtype: DataSubtype): Promise<DataMeta | null> {
  try {
    const path = localMetaPath(mallId, subtype);
    if (!(await exists(path, { baseDir: BaseDirectory.AppLocalData }))) return null;
    const content = await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
    return JSON.parse(content) as DataMeta;
  } catch {
    return null;
  }
}

async function writeLocalMeta(mallId: string, subtype: DataSubtype, meta: DataMeta): Promise<void> {
  try {
    await mkdir(localMetaDir(mallId, subtype), { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(
      localMetaPath(mallId, subtype),
      JSON.stringify(meta),
      { baseDir: BaseDirectory.AppLocalData },
    );
  } catch {
    // non-critical
  }
}

export const useDataSync = () => {
  const [dataSyncStatus, setDataSyncStatus] = useState<DataSyncStatus>({
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
          logWarn('DATA_SYNC', 'No mallId configured, skipping data check');
          setDataSyncStatus({ status: 'done', progress: 100, message: 'モールIDが未設定です' });
          return;
        }

        logInfo('DATA_SYNC', 'Checking data status via S3', { mallId });
        setDataSyncStatus({ status: 'checking', progress: 0, message: 'ショップデータの更新を確認中...' });

        let anyDownloaded = false;

        for (let i = 0; i < ACTIVE_SUBTYPES.length; i++) {
          const subtype = ACTIVE_SUBTYPES[i];

          const localMeta = await readLocalMeta(mallId, subtype);
          const localZipName = localMeta?.lastZipName ?? null;

          let timeoutId: ReturnType<typeof setTimeout>;
          const timeoutPromise = new Promise<{ zip: string | null; updated_at: string | null }>((resolve) => {
            timeoutId = setTimeout(() => resolve({ zip: null, updated_at: null }), 5000);
          });

          const remoteVersion = await Promise.race([
            fetchVersionFromS3(mallId, subtype).finally(() => clearTimeout(timeoutId!)),
            timeoutPromise,
          ]);

          if (!remoteVersion.zip) {
            logInfo('DATA_SYNC', `No remote version for ${subtype}, skipping`);
            continue;
          }

          if (remoteVersion.zip === localZipName) {
            logInfo('DATA_SYNC', `${subtype} is up to date`, { mallId });
            continue;
          }

          logInfo('DATA_SYNC', `${subtype} ZIP changed: ${localZipName} → ${remoteVersion.zip}`, { mallId });

          const zipUrl = s3ZipUrl(mallId, subtype, remoteVersion.zip);
          setDataSyncStatus({
            status: 'downloading',
            progress: 0,
            message: `データをダウンロード中... (${subtype})`,
          });

          let unlisten: UnlistenFn | null = null;
          try {
            const subtypeIndex = i;
            const subtypeCount = ACTIVE_SUBTYPES.length;

            unlisten = await listen<MediaProgressPayload>('media-download-progress', (event) => {
              const { phase, percent, message } = event.payload;
              const baseProgress = (subtypeIndex / subtypeCount) * 100;
              const stepSize = 100 / subtypeCount;
              const stepProgress = phase === 'download' ? percent * 0.85 : 85 + percent * 0.15;
              const totalProgress = baseProgress + (stepProgress / 100) * stepSize;
              setDataSyncStatus({
                status: 'downloading',
                progress: Math.min(99, Math.round(totalProgress)),
                message,
              });
            });

            await invoke('sync_data_from_s3', { mallId, subtype, zipUrl });

            await writeLocalMeta(mallId, subtype, {
              lastZipName: remoteVersion.zip,
              lastUpdatedAt: remoteVersion.updated_at ?? new Date().toISOString(),
            });

            logInfo('DATA_SYNC', `${subtype} update completed`, { mallId, zipName: remoteVersion.zip });
            anyDownloaded = true;
          } finally {
            if (unlisten) unlisten();
          }
        }

        const msg = anyDownloaded ? 'ショップデータの更新が完了しました' : 'ショップデータは最新です';
        setDataSyncStatus({ status: 'done', progress: 100, message: msg });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('DATA_SYNC', 'Data sync error', { error: errorMessage });
        setDataSyncStatus({ status: 'error', progress: 0, message: 'ショップデータの取得に失敗しました' });
      }
    };

    run();
  }, []);

  return { dataSyncStatus };
};
