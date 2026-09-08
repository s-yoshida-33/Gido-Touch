// src/hooks/useDataSync.ts
// Data sync via S3 (operationMode: 'local') or an on-prem server (operationMode: 'on-pre') –
// checks latest.json for data ZIP updates per subtype.
// Downloads and extracts to data/{mallId}/files/{subtype}/ or data/{mallId}/json/
// via sync_data_from_s3. Processes subtypes sequentially (network-friendly for poor connections).
// After extraction, writes .{subtype}-meta.json locally for version tracking.
// on-preモードのみ、1時間毎に再チェックする(S3/localモードの既存挙動は変更しない)。

import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
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

// 同期で新しいデータが降ってきた際にTauriイベントとして発火する名前。
// useHalongShops側がこれを購読して再読込する（バックグラウンド同期後、
// 画面操作なしでは店舗一覧が更新されない不具合への対応）。
export const SHOP_DATA_UPDATED_EVENT = 'shop-data-updated';

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

/**
 * 1回分の同期処理の実体。useDataSync（PatchScreen向け、起動時の一回きりの
 * 同期でスプラッシュ画面の完了判定に使う）と、startOnPreSyncPolling
 * （App.tsx側、アプリの生存期間ずっと動く定期再チェック用）の両方から
 * 呼ばれる共通ロジック。
 *
 * on-preの定期再チェックをuseDataSync内のuseEffectに実装していた際、
 * useDataSyncがPatchScreen（起動時のみ表示され同期完了と共にアンマウントされる
 * スプラッシュ画面）からしか呼ばれておらず、画面遷移と同時にuseEffectの
 * クリーンアップで定期実行タイマーごと破棄されてしまい、ポーリングが
 * 一切機能しないという不具合があった（実機検証で発覚）。そのため定期実行の
 * 仕組みはアプリ全体が生きているApp.tsx側に移し、同期ロジック自体を
 * ここに切り出して共有する。
 */
async function runDataSync(
  onStatus?: (status: DataSyncStatus) => void,
): Promise<void> {
  const setDataSyncStatus = onStatus ?? (() => {});
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

    if (anyDownloaded) {
      // useHalongShopsは起動時に一度しか店舗データを読まないため、バックグラウンド
      // 同期で新しいデータが降ってきたことを画面側に知らせて再読込させる。
      emit(SHOP_DATA_UPDATED_EVENT).catch(() => {
        // イベント発火に失敗しても致命的ではない(次回同期時に再度発火される)
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError('DATA_SYNC', 'Data sync error', { error: errorMessage });
    setDataSyncStatus({ status: 'error', progress: 0, message: 'ショップデータの取得に失敗しました' });
  }
}

/** PatchScreen（起動時スプラッシュ画面）向け。起動時に一度だけ同期する。 */
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
    runDataSync(setDataSyncStatus);
  }, []);

  return { dataSyncStatus };
};

/**
 * App.tsx（アプリの生存期間ずっとマウントされている場所）から呼び出す、
 * on-preモード向けの定期再チェック。TICK_MSごとに「設定された間隔
 * (globalSettings.onPrePollIntervalMinutes)が経過したか」を判定する方式に
 * している。setIntervalの遅延を起動時の値で固定してしまうと、アプリを
 * 再起動しない限り設定画面での間隔変更が反映されないため、毎回
 * globalSettingsを読み直すことで再起動無しで変更を反映できるようにした。
 *
 * 戻り値はクリーンアップ関数（呼び出し側のuseEffectで返す）。
 */
export function startOnPreSyncPolling(): () => void {
  let lastRunAt = Date.now();
  let running = false;

  const runAndMark = async () => {
    if (running) return;
    running = true;
    try {
      await runDataSync();
    } finally {
      lastRunAt = Date.now();
      running = false;
    }
  };

  const TICK_MS = 60 * 1000;
  const tickId = setInterval(async () => {
    try {
      const globalSettings = await loadGlobalSettings();
      if ((globalSettings.operationMode ?? 'api') !== 'on-pre') return;

      const configuredMinutes = globalSettings.onPrePollIntervalMinutes;
      const minutes = Number.isFinite(configuredMinutes) && (configuredMinutes as number) > 0
        ? (configuredMinutes as number)
        : DEFAULT_ON_PRE_POLL_INTERVAL_MINUTES;

      if (Date.now() - lastRunAt >= minutes * 60 * 1000) {
        await runAndMark();
      }
    } catch {
      // 定期実行の判定に失敗しても次のtickで再試行されるため致命的ではない
    }
  }, TICK_MS);

  return () => clearInterval(tickId);
}
