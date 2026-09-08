// src/hooks/useDataSync.ts
// Data sync via S3 (operationMode: 'local') or an on-prem server (operationMode: 'on-pre') –
// checks latest.json for data ZIP updates per subtype.
// Downloads and extracts to data/{mallId}/files/{subtype}/ or data/{mallId}/json/
// via sync_data_from_s3. Processes subtypes sequentially (network-friendly for poor connections).
// After extraction, writes .{subtype}-meta.json locally for version tracking.
// on-preモードのみ、1時間毎に再チェックする(S3/localモードの既存挙動は変更しない)。

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

// on-preモードの定期再チェック間隔のデフォルト値(分)。local/apiモードには影響しない。
// 実際の間隔はglobalSettings.onPrePollIntervalMinutesで上書き可能。
const DEFAULT_ON_PRE_POLL_INTERVAL_MINUTES = 60;

const DATA_SUBTYPES = ['shops', 'news', 'events', 'json'] as const;
type DataSubtype = typeof DATA_SUBTYPES[number];

// news/events が未実装のモール（実装後はここから削除する）
const MALLS_WITHOUT_NEWS_EVENTS = ['halong'];

function getActiveSubtypes(mallId: string): DataSubtype[] {
  if (MALLS_WITHOUT_NEWS_EVENTS.includes(mallId)) return ['shops', 'json'];
  return [...DATA_SUBTYPES];
}

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

// オンプレサーバー(TTI-DCS/sdc)の配信契約: {apiBaseUrl}/json/latest.json、
// {apiBaseUrl}/files/{subtype}/latest.json。apiBaseUrl自体が
// ".../gido-touch/data/halong" までモール固有のパスを含む前提のため、
// S3向けと異なりmallIdセグメントは付与しない。
function onPreBase(apiBaseUrl: string, subtype: DataSubtype): string {
  const trimmed = apiBaseUrl.replace(/\/$/, '');
  return subtype === 'json' ? `${trimmed}/json` : `${trimmed}/files/${subtype}`;
}

function onPreLatestJsonUrl(apiBaseUrl: string, subtype: DataSubtype): string {
  return `${onPreBase(apiBaseUrl, subtype)}/latest.json?t=${Date.now()}`;
}

function onPreZipUrl(apiBaseUrl: string, subtype: DataSubtype, zipName: string): string {
  return `${onPreBase(apiBaseUrl, subtype)}/${zipName}`;
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

async function fetchLatestVersion(
  mallId: string,
  subtype: DataSubtype,
  operationMode: 'local' | 'on-pre',
  apiBaseUrl: string | undefined,
): Promise<{ zip: string | null; updated_at: string | null }> {
  if (operationMode === 'on-pre' && !apiBaseUrl) {
    logWarn('DATA_SYNC', `on-preモードですがapiBaseUrl未設定のため${subtype}をスキップします`);
    return { zip: null, updated_at: null };
  }

  const url = operationMode === 'on-pre' && apiBaseUrl
    ? onPreLatestJsonUrl(apiBaseUrl, subtype)
    : s3LatestJsonUrl(mallId, subtype);

  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    const response = await tauriFetch(url, {
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

        const operationMode = globalSettings.operationMode ?? 'api';
        if (operationMode !== 'local' && operationMode !== 'on-pre') {
          logInfo('DATA_SYNC', `operationMode is "${operationMode}", skipping data check`, { mallId });
          setDataSyncStatus({ status: 'done', progress: 100, message: 'データ同期はスキップされました' });
          return;
        }

        logInfo('DATA_SYNC', 'Checking data status', { mallId, operationMode });
        setDataSyncStatus({ status: 'checking', progress: 0, message: 'ショップデータの更新を確認中...' });

        let anyDownloaded = false;
        const activeSubtypes = getActiveSubtypes(mallId);

        for (let i = 0; i < activeSubtypes.length; i++) {
          const subtype = activeSubtypes[i];

          const localMeta = await readLocalMeta(mallId, subtype);
          const localZipName = localMeta?.lastZipName ?? null;

          let timeoutId: ReturnType<typeof setTimeout>;
          const timeoutPromise = new Promise<{ zip: string | null; updated_at: string | null }>((resolve) => {
            timeoutId = setTimeout(() => resolve({ zip: null, updated_at: null }), 5000);
          });

          const remoteVersion = await Promise.race([
            fetchLatestVersion(mallId, subtype, operationMode, globalSettings.apiBaseUrl).finally(() => clearTimeout(timeoutId!)),
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

          const zipUrl = operationMode === 'on-pre' && globalSettings.apiBaseUrl
            ? onPreZipUrl(globalSettings.apiBaseUrl, subtype, remoteVersion.zip)
            : s3ZipUrl(mallId, subtype, remoteVersion.zip);
          setDataSyncStatus({
            status: 'downloading',
            progress: 0,
            message: `データをダウンロード中... (${subtype})`,
          });

          let unlisten: UnlistenFn | null = null;
          try {
            const subtypeIndex = i;
            const subtypeCount = activeSubtypes.length;

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

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      await run();
      // on-preモードのみ、設定された間隔で再チェックする(local/apiモードは起動時の1回のみ、既存挙動のまま)。
      try {
        const globalSettings = await loadGlobalSettings();
        if ((globalSettings.operationMode ?? 'api') === 'on-pre') {
          const configuredMinutes = globalSettings.onPrePollIntervalMinutes;
          const minutes = Number.isFinite(configuredMinutes) && (configuredMinutes as number) > 0
            ? (configuredMinutes as number)
            : DEFAULT_ON_PRE_POLL_INTERVAL_MINUTES;
          intervalId = setInterval(run, minutes * 60 * 1000);
        }
      } catch {
        // 定期実行の設定に失敗しても、直前のrun()自体は完了しているため致命的ではない
      }
    };

    init();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return { dataSyncStatus };
};
