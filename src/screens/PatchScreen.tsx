// src/screens/PatchScreen.tsx
// Startup screen: app update check → media download → main app launch
import { useEffect, useState, useCallback } from 'react';
import appIcon from '../../build/icon.ico';
import { useAutoUpdate } from '../hooks/useAutoUpdate';
import { useMediaDownload } from '../hooks/useMediaDownload';
import { getVersion } from '@tauri-apps/api/app';

interface PatchScreenProps {
  onComplete: () => void;
}

export function PatchScreen({ onComplete }: PatchScreenProps) {
  const { updateStatus, installUpdate } = useAutoUpdate();
  const { mediaStatus } = useMediaDownload();
  const [appVersion, setAppVersion] = useState<string>('');

  // Waiting state (after all checks done, countdown before proceeding)
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitProgress, setWaitProgress] = useState(0);
  const [countdown, setCountdown] = useState(90);

  // Load app version from Tauri
  useEffect(() => {
    getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion(''));
  }, []);

  // When update is ready, auto-relaunch after 5 seconds
  useEffect(() => {
    if (updateStatus.status === 'ready') {
      const timer = setTimeout(() => {
        installUpdate();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [updateStatus.status, installUpdate]);

  // Determine when to start waiting:
  // App update finished (uptodate or error) AND media download finished (done or error)
  useEffect(() => {
    const appDone = updateStatus.status === 'uptodate' || updateStatus.status === 'error';
    const mediaDone = mediaStatus.status === 'done' || mediaStatus.status === 'error';

    if (appDone && mediaDone) {
      setIsWaiting(true);
    }
  }, [updateStatus.status, mediaStatus.status]);

  // Transition to main app via React state
  const finishWait = useCallback(() => {
    onComplete();
  }, [onComplete]);

  // 90-second countdown timer
  useEffect(() => {
    if (!isWaiting) return;

    const startTime = Date.now();
    const duration = 90 * 1000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / duration) * 100);
      setWaitProgress(progress);

      const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setCountdown(remaining);

      if (elapsed >= duration) {
        clearInterval(timer);
        finishWait();
      }
    }, 100);

    return () => clearInterval(timer);
  }, [isWaiting, finishWait]);

  // Current phase for display
  type Phase = 'app_update' | 'media_download' | 'waiting';
  const currentPhase: Phase = (() => {
    if (isWaiting) return 'waiting';
    const appDone = updateStatus.status === 'uptodate' || updateStatus.status === 'error';
    if (!appDone) return 'app_update';
    return 'media_download';
  })();

  // Title label
  const titleLabel = (() => {
    if (updateStatus.status === 'ready') {
      return 'アップデートが完了しました';
    }
    if (isWaiting) {
      const hasError = updateStatus.status === 'error' || mediaStatus.status === 'error';
      return hasError ? 'エラーが発生しました' : '最新バージョンです';
    }
    switch (currentPhase) {
      case 'app_update':
        switch (updateStatus.status) {
          case 'idle':
          case 'checking':
            return 'アップデートを確認中…';
          case 'available':
          case 'downloading':
            return 'アップデートをダウンロードしています';
          case 'error':
            return 'アップデートエラー';
          default:
            return 'アップデート状態';
        }
      case 'media_download':
        switch (mediaStatus.status) {
          case 'idle':
          case 'checking':
            return 'メディアデータを確認中…';
          case 'downloading':
            return 'メディアデータをダウンロード中…';
          case 'error':
            return 'メディアダウンロードエラー';
          default:
            return 'メディアデータの確認';
        }
      default:
        return 'アップデート状態';
    }
  })();

  // Status message
  const statusMessage = (() => {
    if (updateStatus.status === 'ready') {
      return updateStatus.message;
    }
    if (isWaiting) {
      const messages: string[] = [];
      if (updateStatus.message) messages.push(updateStatus.message);
      if (mediaStatus.message) messages.push(mediaStatus.message);
      return messages.join('\n') || '起動しています…';
    }
    if (currentPhase === 'app_update') {
      return updateStatus.message || '起動しています…';
    }
    return mediaStatus.message || 'メディアデータを確認中…';
  })();

  // Display progress
  const displayPercent = (() => {
    if (isWaiting) return waitProgress;
    if (updateStatus.status === 'ready') return 100;
    if (currentPhase === 'app_update') return updateStatus.progress;
    return mediaStatus.progress;
  })();

  // Display state label
  const displayState = (() => {
    if (isWaiting) return 'WAITING';
    if (currentPhase === 'app_update') return updateStatus.status.toUpperCase();
    return mediaStatus.status.toUpperCase();
  })();

  return (
    <div
      style={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        fontFamily: "system-ui, sans-serif",
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000000',
        color: '#fff',
      }}
    >
      {/* Center Card */}
      <div
        style={{
          width: 860,
          minHeight: 600,
          maxHeight: 660,
          padding: 32,
          borderRadius: 8,
          backgroundColor: '#0a0a0a',
          border: '2px solid #1a1a1a',
          boxShadow: '0 0 0 1px #2a2a2a, 0 8px 32px rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* ICON */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 4,
                border: '2px solid #2a2a2a',
                backgroundColor: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <img
                src={appIcon}
                alt="App Icon"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>

            <div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>Gido Touch</div>
              <div style={{ fontSize: 12, color: '#888888' }}>
                Preparing latest map &amp; shop data…
              </div>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#666666' }}>
            {appVersion ? `v${appVersion}` : ''}
          </div>
        </div>

        {/* Status Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{titleLabel}</div>

          <p
            style={{
              fontSize: 13,
              color: '#cccccc',
              lineHeight: 1.6,
              whiteSpace: 'pre-line',
            }}
          >
            {isWaiting
              ? `${statusMessage}\nあと ${countdown} 秒で起動します。`
              : statusMessage}
          </p>
        </div>

        {/* Progress Panel */}
        <div
          style={{
            padding: 16,
            borderRadius: 4,
            border: '2px solid #1a1a1a',
            backgroundColor: '#0f0f0f',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: '#888888', marginBottom: 6 }}>
            {isWaiting ? 'Startup Wait' : currentPhase === 'app_update' ? 'App Update' : 'Media Download'}
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: 20,
              borderRadius: 2,
              border: '2px solid #1a1a1a',
              overflow: 'hidden',
              backgroundColor: '#050505',
              position: 'relative',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${displayPercent}%`,
                backgroundColor: isWaiting ? '#ff0000' : '#ff0000',
                borderRight: displayPercent < 100
                  ? (isWaiting ? '2px solid #cc0000' : '2px solid #cc0000')
                  : 'none',
                transition: 'width 0.2s linear',
                boxShadow: displayPercent > 0
                  ? (isWaiting ? 'inset 0 0 8px rgba(255,0,0,0.3)' : 'inset 0 0 8px rgba(255,0,0,0.3)')
                  : 'none',
              }}
            />
          </div>

          <div style={{ fontSize: 12, textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>
            {isWaiting
              ? `${countdown}s`
              : (displayPercent > 0 ? `${displayPercent.toFixed(1)}%` : '待機中…')}
          </div>

          {/* State Info */}
          {!isWaiting && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                rowGap: 8,
                columnGap: 16,
                fontSize: 11,
                paddingTop: 8,
                borderTop: '1px solid #1a1a1a',
              }}
            >
              <div style={{ color: '#888888' }}>Phase</div>
              <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600, textTransform: 'uppercase' }}>
                {currentPhase === 'app_update' ? 'APP UPDATE' : 'MEDIA'}
              </div>

              <div style={{ color: '#888888' }}>State</div>
              <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600, textTransform: 'uppercase' }}>{displayState}</div>
            </div>
          )}
        </div>

        {/* Footer with Skip Button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: '#666666',
            marginTop: 'auto',
            paddingTop: 16,
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>Do not turn off your device while updating.</div>
            <div>&copy; 2026 Toei Techno International Inc.</div>
          </div>

          {/* Skip Button (only visible when waiting) */}
          {isWaiting && (
            <button
              onClick={finishWait}
              style={{
                backgroundColor: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 4,
                padding: '6px 16px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#444';
                e.currentTarget.style.borderColor = '#666';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
                e.currentTarget.style.borderColor = '#555';
              }}
            >
              スキップして起動
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
