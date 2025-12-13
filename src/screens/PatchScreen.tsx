import { useEffect, useState } from 'react';
import appIcon from '../../build/icon.ico';
import type { StatusState } from '../types/global';

export function PatchScreen() {
  const [statusState, setStatusState] = useState<StatusState>('checking');
  const [statusMessage, setStatusMessage] = useState<string>('起動しています…');
  const [percent, setPercent] = useState<number | null>(null);
  const [transferred, setTransferred] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [appVersion, setAppVersion] = useState<string>('');
  
  // Wait state
  const [waitProgress, setWaitProgress] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(90);

  useEffect(() => {
    // Mock data for browser preview
    const isBrowser = !window.electronAPI;
    
    if (isBrowser) {
      // ... (keep existing browser mock if needed, or update it)
      return;
    }

    if (!window.updater) return;

    window.updater.onStatus((data) => {
      setStatusState(data.state);

      if (data.state === 'none' || data.state === 'error') {
        setIsWaiting(true);
        setStatusMessage(data.state === 'error' 
          ? 'アップデート確認中にエラーが発生しました。\nそのまま起動します。' 
          : '最新バージョンです。\n起動準備中...');
        // Clear download stats
        setPercent(null);
        setTransferred(null);
        setTotal(null);
        setSpeed(null);
      } else {
        setStatusMessage(data.message);
      }
    });

    window.updater.onProgress((data) => {
      setPercent(data.percent);
      setTransferred(data.transferred);
      setTotal(data.total);
      setSpeed(data.speed);
    });
  }, []);

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
  }, [isWaiting]);

  const finishWait = () => {
    if (window.updater?.startupWaitCompleted) {
      window.updater.startupWaitCompleted();
    }
  };

  const handleSkip = () => {
    finishWait();
  };

  useEffect(() => {
    // Mock data for browser preview
    const isBrowser = !window.electronAPI;
    
    if (isBrowser) {
      // Already set in the previous useEffect
      return;
    }

    if (!window.appInfo) return;
    window.appInfo
      .getVersion()
      .then((v) => {
        setAppVersion(v);
      })
      .catch(() => {
        setAppVersion('');
      });
  }, []);

  const titleLabel = (() => {
    switch (statusState) {
      case 'checking':
        return 'アップデートを確認中…';
      case 'available':
        return 'アップデートをダウンロードしています';
      case 'downloaded':
        return 'アップデートが完了しました';
      case 'none':
        return '最新バージョンです';
      case 'error':
        return 'アップデートエラー';
      default:
        return 'アップデート状態';
    }
  })();

  const formatMB = (bytes: number | null) => {
    if (bytes == null || bytes <= 0) return '-';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatSpeed = (bytesPerSec: number | null) => {
    if (bytesPerSec == null || bytesPerSec <= 0) return '-';
    return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
  };

  const currentPercent = isWaiting ? waitProgress : percent;

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        fontFamily: "system-ui, sans-serif",
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        color: '#fff',
      }}
    >
      {/* Center Card */}
      <div
        style={{
          minWidth: 800,
          maxWidth: 860,
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
            {statusMessage}
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
          <div style={{ fontSize: 12, color: '#888888', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span>{isWaiting ? 'Startup progress' : 'Download status'}</span>
            {isWaiting && <span>あと {countdown} 秒</span>}
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
                width: `${currentPercent ?? 0}%`,
                backgroundColor: '#00ff88',
                borderRight: currentPercent && currentPercent < 100 ? '2px solid #00cc66' : 'none',
                transition: 'width 0.2s linear',
                boxShadow: currentPercent && currentPercent > 0 ? 'inset 0 0 8px rgba(0,255,136,0.3)' : 'none',
              }}
            />
            {currentPercent && currentPercent > 0 && currentPercent < 100 && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: '2px',
                  backgroundColor: '#00ff88',
                  boxShadow: '0 0 4px #00ff88',
                }}
              />
            )}
          </div>

          <div style={{ fontSize: 12, textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>
            {currentPercent != null ? `${currentPercent.toFixed(1)}%` : '待機中…'}
          </div>

          {/* Numeric Info (Only show when downloading) */}
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
              <div style={{ color: '#888888' }}>Transferred</div>
              <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>{formatMB(transferred)}</div>

              <div style={{ color: '#888888' }}>Total</div>
              <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600 }}>{formatMB(total)}</div>

              <div style={{ color: '#888888' }}>Speed</div>
              <div style={{ textAlign: 'right', color: '#00ff88', fontWeight: 600 }}>{formatSpeed(speed)}</div>

              <div style={{ color: '#888888' }}>State</div>
              <div style={{ textAlign: 'right', color: '#ffffff', fontWeight: 600, textTransform: 'uppercase' }}>{statusState}</div>
            </div>
          )}
          
          {/* Skip Button (Only show when waiting) */}
          {isWaiting && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid #1a1a1a' }}>
              <button
                onClick={handleSkip}
                style={{
                  backgroundColor: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 4,
                  padding: '6px 16px',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                スキップする
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#666666',
            marginTop: 'auto',
            paddingTop: 16,
            borderTop: '1px solid #1a1a1a',
          }}
        >
          <div>Do not turn off your device while updating.</div>
          <div>© 2025 Toei Techno International Inc.</div>
        </div>
      </div>
    </div>
  );
}
