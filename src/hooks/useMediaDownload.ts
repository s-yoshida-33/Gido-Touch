// src/hooks/useMediaDownload.ts
// Media sync via S3 – checks S3 latest.json for video ZIP updates.
// Uses .media-meta.json (lastZipName) for version comparison,
// enabling re-download even when the ZIP URL path hasn't changed.
import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { logInfo, logWarn, logError } from '../logs/logging';
import { loadGlobalSettings } from '../utils/settings';

interface MediaProgressPayload {
  phase: string;   // 'download' | 'extract'
  percent: number;
  downloaded_bytes: number;
  total_bytes: number;
  message: string;
}

export interface MediaDownloadStatus {
  status: 'idle' | 'checking' | 'downloading' | 'done' | 'error';
  progress: number;
  message: string;
}

interface VideoMeta {
  lastZipName: string | null;
  lastMediaUpdatedAt: string | null;
}

const S3_BASE = 'https://dl.tti.ninja/gido-touch/medias/videos';

async function fetchVideoVersionFromS3(mallId: string): Promise<{ zip: string | null; updated_at: string | null }> {
  try {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    // Cache-busting: timestamp query param + no-cache headers
    const url = `${S3_BASE}/${mallId}/latest.json?t=${Date.now()}`;

    const response = await tauriFetch(url, {
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch latest.json: ${response.status}`);
    }

    const data = await response.json() as { zip: string; updated_at: string };
    logInfo('MEDIA_DOWNLOAD', `Video version fetched: ${data.zip}, updated_at: ${data.updated_at}`);
    return { zip: data.zip, updated_at: data.updated_at };
  } catch (error) {
    logError('MEDIA_DOWNLOAD', 'Failed to fetch video version from S3', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { zip: null, updated_at: null };
  }
}

const metaPath = (mallId: string) => `media/videos/${mallId}/.media-meta.json`;

async function readVideoMeta(mallId: string): Promise<VideoMeta | null> {
  try {
    const path = metaPath(mallId);
    const metaExists = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (!metaExists) return null;
    const content = await readTextFile(path, { baseDir: BaseDirectory.AppLocalData });
    return JSON.parse(content) as VideoMeta;
  } catch {
    return null;
  }
}

async function writeVideoMeta(mallId: string, meta: VideoMeta): Promise<void> {
  try {
    await mkdir(`media/videos/${mallId}`, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeTextFile(
      metaPath(mallId),
      JSON.stringify(meta),
      { baseDir: BaseDirectory.AppLocalData },
    );
  } catch {
    // non-critical
  }
}

export const useMediaDownload = () => {
  const [mediaStatus, setMediaStatus] = useState<MediaDownloadStatus>({
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
          logWarn('MEDIA_DOWNLOAD', 'No mallId configured, skipping media check');
          setMediaStatus({ status: 'done', progress: 100, message: 'モールIDが未設定です' });
          return;
        }

        logInfo('MEDIA_DOWNLOAD', 'Checking video media status via S3', { mallId });
        setMediaStatus({ status: 'checking', progress: 0, message: 'メディアデータの更新を確認中...' });

        // Step 1: Read local metadata
        const localMeta = await readVideoMeta(mallId);
        const localZipName = localMeta?.lastZipName ?? null;

        // Step 2: Fetch remote version from S3 (5s timeout)
        let timeoutId: ReturnType<typeof setTimeout>;
        const timeoutPromise = new Promise<{ zip: string | null; updated_at: string | null }>((resolve) => {
          timeoutId = setTimeout(() => {
            logInfo('MEDIA_DOWNLOAD', 'S3 latest.json request timed out, proceeding without update check');
            resolve({ zip: null, updated_at: null });
          }, 5000);
        });

        const remoteVersion = await Promise.race([
          fetchVideoVersionFromS3(mallId).finally(() => clearTimeout(timeoutId!)),
          timeoutPromise,
        ]);

        if (!remoteVersion.zip && !remoteVersion.updated_at) {
          // S3 unreachable – keep existing files
          logInfo('MEDIA_DOWNLOAD', 'Could not fetch remote version, assuming up to date');
          setMediaStatus({ status: 'done', progress: 100, message: 'メディアは最新です' });
          return;
        }

        // Step 3: Compare ZIP filename (primary cache-busting strategy)
        // localZipName == null means first boot → always download
        const zipNameChanged = remoteVersion.zip != null && (
          localZipName == null || remoteVersion.zip !== localZipName
        );

        if (!zipNameChanged) {
          logInfo('MEDIA_DOWNLOAD', 'Video media is up to date, skipping download', { mallId });
          setMediaStatus({ status: 'done', progress: 100, message: 'メディアは最新です' });
          return;
        }

        logInfo('MEDIA_DOWNLOAD', `ZIP file changed: ${localZipName} → ${remoteVersion.zip}`, { mallId });

        const zipUrl = `${S3_BASE}/${mallId}/${remoteVersion.zip}`;
        logInfo('MEDIA_DOWNLOAD', 'Starting video download from S3', { mallId, zipUrl });
        setMediaStatus({ status: 'downloading', progress: 0, message: `メディアデータをダウンロード中... (${mallId})` });

        // Step 4: Download and extract via Rust with progress events
        let unlisten: UnlistenFn | null = null;
        try {
          unlisten = await listen<MediaProgressPayload>('media-download-progress', (event) => {
            const { phase, percent, message } = event.payload;
            // Map: download phase → 0–85%, extract phase → 85–100%
            const mappedProgress = phase === 'download'
              ? percent * 0.85
              : 85 + (percent * 0.15);
            setMediaStatus({
              status: 'downloading',
              progress: Math.min(99, Math.round(mappedProgress)),
              message,
            });
          });

          await invoke('sync_video_from_s3', { mallId, zipUrl });

          // Step 5: Save updated metadata
          await writeVideoMeta(mallId, {
            lastZipName: remoteVersion.zip,
            lastMediaUpdatedAt: remoteVersion.updated_at ?? new Date().toISOString(),
          });

          logInfo('MEDIA_DOWNLOAD', 'Video media update completed', {
            mallId,
            zipName: remoteVersion.zip,
          });
          setMediaStatus({ status: 'done', progress: 100, message: 'メディアデータの更新が完了しました' });
        } finally {
          if (unlisten) unlisten();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError('MEDIA_DOWNLOAD', 'Media download error', { error: errorMessage });
        setMediaStatus({ status: 'error', progress: 0, message: 'メディアデータの取得に失敗しました' });
      }
    };

    run();
  }, []);

  return { mediaStatus };
};
