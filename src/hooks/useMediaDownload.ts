// src/hooks/useMediaDownload.ts
// Media download via Rust commands – checks GitHub Releases for media ZIP updates.
// Uses .media-meta.json (updated_at timestamp) for version comparison,
// enabling re-download even when app version hasn't changed.
import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { logInfo, logWarn, logError } from '../logs/logging';
import { loadGlobalSettings } from '../utils/settings';

export interface MediaDownloadStatus {
  status: 'idle' | 'checking' | 'downloading' | 'done' | 'error';
  progress: number;
  message: string;
}

interface MediaDownloadResult {
  success: boolean;
  message: string;
  skipped: boolean;
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
        // Get mall ID from global settings
        const globalSettings = await loadGlobalSettings();
        const mallId = globalSettings.mallId;
        const appVersion = await getVersion();

        if (!mallId) {
          logWarn('MEDIA_DOWNLOAD', 'No mallId configured, skipping media check');
          setMediaStatus({ status: 'done', progress: 100, message: 'モールIDが未設定です' });
          return;
        }

        logInfo('MEDIA_DOWNLOAD', 'Checking media status', { mallId, appVersion });
        setMediaStatus({ status: 'checking', progress: 0, message: 'メディアデータの更新を確認中...' });

        // Step 1: Check if media needs to be downloaded
        const checkResult = await invoke<MediaDownloadResult>('check_media_status', {
          mallId,
          appVersion,
        });

        logInfo('MEDIA_DOWNLOAD', 'Media check result', {
          mallId,
          success: checkResult.success,
          skipped: checkResult.skipped,
          message: checkResult.message,
        });

        if (checkResult.skipped) {
          setMediaStatus({ status: 'done', progress: 100, message: 'メディアは最新です' });
          return;
        }

        if (!checkResult.success) {
          logError('MEDIA_DOWNLOAD', 'Media check failed', { message: checkResult.message });
          setMediaStatus({ status: 'error', progress: 0, message: checkResult.message });
          return;
        }

        // Step 2: Download media
        logInfo('MEDIA_DOWNLOAD', 'Starting media download', { mallId, appVersion });
        setMediaStatus({ status: 'downloading', progress: 10, message: `メディアデータをダウンロード中... (${mallId})` });

        const downloadResult = await invoke<MediaDownloadResult>('download_media', {
          mallId,
          appVersion,
        });

        if (downloadResult.success) {
          logInfo('MEDIA_DOWNLOAD', 'Media download completed', {
            mallId,
            message: downloadResult.message,
            skipped: downloadResult.skipped,
          });
          setMediaStatus({
            status: 'done',
            progress: 100,
            message: downloadResult.skipped ? 'メディアは最新です' : 'メディアデータの更新が完了しました',
          });
        } else {
          logError('MEDIA_DOWNLOAD', 'Media download failed', { message: downloadResult.message });
          setMediaStatus({ status: 'error', progress: 0, message: `メディアダウンロード失敗: ${downloadResult.message}` });
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
