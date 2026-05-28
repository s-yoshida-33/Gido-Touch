// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { useAudioSettingsContext } from '../contexts/AudioSettingsContext';
import { logWarn, logError, logDebug } from '../logs/logging';

interface VerticalVideoSlotProps {
  forceReload?: number;
}

const MAX_RETRY_COUNT = 5;
const INITIAL_RETRY_DELAY_MS = 1000;
const FREEZE_TIMEOUT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 60000;
const MAX_RECREATE_COUNT = 3;
const LINK_CONTENT_W = 1080;
const LINK_CONTENT_H = 1920;

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ forceReload = 0 }) => {
  const { asset, isLoading, isScheduleRecalculating } = useCurrentAsset();
  const { audioSettings } = useAudioSettingsContext();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);
  const retryCountRef = React.useRef<number>(0);
  const retryTimerRef = React.useRef<number | undefined>(undefined);
  const [objectFit, setObjectFit] = React.useState<'cover' | 'contain'>('cover');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const lastTimeUpdateRef = React.useRef<number>(Date.now());
  const freezeTimerRef = React.useRef<number | undefined>(undefined);
  const healthCheckTimerRef = React.useRef<number | undefined>(undefined);

  const [videoKey, setVideoKey] = React.useState<number>(0);
  const recreateCountRef = React.useRef<number>(0);

  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const [iframeLoaded, setIframeLoaded] = React.useState(false);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);

  // Overlay refs/state
  const captureCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const latestVideoFrameRef = React.useRef<string | null>(null);
  const prevAssetRef = React.useRef<typeof asset>(null);
  const [overlaySnapshot, setOverlaySnapshot] = React.useState<string | null>(null);

  // Callback ref for ResizeObserver on link container
  const linkContainerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (el) {
      const observer = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        setContainerSize({ width, height });
      });
      observer.observe(el);
      resizeObserverRef.current = observer;
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    } else {
      setContainerSize({ width: 0, height: 0 });
    }
  }, []);

  // Reset iframeLoaded on asset change
  React.useEffect(() => { setIframeLoaded(false); }, [asset?.id]);

  // Periodic video frame capture (1s interval, reused canvas)
  // IMPORTANT: cleanup does NOT null latestVideoFrameRef —
  // useLayoutEffect overlay activation reads it before useEffect cleanup runs
  React.useEffect(() => {
    if (!asset) return;
    const isVideo = asset.mediaType !== 'image' && asset.mediaType !== 'link' &&
      !/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src || '');
    if (!isVideo) return;

    const canvas = document.createElement('canvas');
    captureCanvasRef.current = canvas;

    const capture = () => {
      const v = videoRef.current;
      if (!v || v.readyState < 2 || v.videoWidth === 0) return;
      if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
      }
      try {
        canvas.getContext('2d')?.drawImage(v, 0, 0);
        latestVideoFrameRef.current = canvas.toDataURL('image/jpeg', 0.85);
      } catch { }
    };

    capture();
    const id = window.setInterval(capture, 1000);

    return () => {
      window.clearInterval(id);
      canvas.width = 0;
      canvas.height = 0;
      captureCanvasRef.current = null;
      // DO NOT null latestVideoFrameRef here
    };
  }, [asset?.id]);

  // useLayoutEffect: runs synchronously before browser paint — overlay present from first render
  React.useLayoutEffect(() => {
    if (!asset) { prevAssetRef.current = null; latestVideoFrameRef.current = null; return; }
    if (asset.mediaType === 'link') {
      const prev = prevAssetRef.current;
      if (prev && prev.id !== asset.id && prev.src) {
        const isPrevImage = prev.mediaType === 'image' ||
          /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(prev.src);
        setOverlaySnapshot(isPrevImage ? prev.src : latestVideoFrameRef.current);
      }
      latestVideoFrameRef.current = null;
    } else {
      setOverlaySnapshot(null);
      latestVideoFrameRef.current = null;
    }
    prevAssetRef.current = asset;
  }, [asset?.id]);

  // Clear overlay when iframe loads
  React.useEffect(() => {
    if (iframeLoaded) setOverlaySnapshot(null);
  }, [iframeLoaded]);

  // Cleanup video resources and timers on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (retryTimerRef.current !== undefined) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = undefined;
      }
      if (freezeTimerRef.current !== undefined) {
        window.clearInterval(freezeTimerRef.current);
        freezeTimerRef.current = undefined;
      }
      if (healthCheckTimerRef.current !== undefined) {
        window.clearInterval(healthCheckTimerRef.current);
        healthCheckTimerRef.current = undefined;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (captureCanvasRef.current) {
        captureCanvasRef.current.width = 0;
        captureCanvasRef.current.height = 0;
        captureCanvasRef.current = null;
      }
      latestVideoFrameRef.current = null;
    };
  }, []);

  // Reset error and retry count when asset changes
  React.useEffect(() => {
    setErrorMsg(null);
    retryCountRef.current = 0;
    recreateCountRef.current = 0;
    lastTimeUpdateRef.current = Date.now();
    if (retryTimerRef.current !== undefined) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = undefined;
    }
  }, [asset?.id, asset?.src]);

  // Recovery logic
  const attemptRecovery = React.useCallback(() => {
    if (retryCountRef.current < MAX_RETRY_COUNT) {
      retryCountRef.current += 1;
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1);
      logWarn('VIDEO', `Attempting video recovery (${retryCountRef.current}/${MAX_RETRY_COUNT}), delay=${delay}ms`, {
        assetId: asset?.id,
      });
      setErrorMsg(`Retrying (${retryCountRef.current}/${MAX_RETRY_COUNT})...`);
      retryTimerRef.current = window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(() => {});
          lastTimeUpdateRef.current = Date.now();
        }
      }, delay);
    } else if (recreateCountRef.current < MAX_RECREATE_COUNT) {
      recreateCountRef.current += 1;
      retryCountRef.current = 0;
      logWarn('VIDEO', `Recreating video element (${recreateCountRef.current}/${MAX_RECREATE_COUNT})`, {
        assetId: asset?.id,
      });
      setErrorMsg(`Recreating player (${recreateCountRef.current}/${MAX_RECREATE_COUNT})...`);
      lastTimeUpdateRef.current = Date.now();
      setVideoKey(prev => prev + 1);
    } else {
      logError('VIDEO', 'All video recovery attempts exhausted', {
        assetId: asset?.id,
        retryCount: retryCountRef.current,
        recreateCount: recreateCountRef.current,
      });
      setErrorMsg('Video Error: All recovery attempts exhausted');
    }
  }, [asset?.id]);

  // Pause video on last frame during CMS schedule recalculation.
  // When a valid event arrives within the grace period, resume playback.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !asset) return;

    const isImage = asset.mediaType === 'image' ||
      (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
    const isLink = asset.mediaType === 'link';
    if (isImage || isLink) return;

    if (isScheduleRecalculating) {
      if (!video.paused) {
        video.pause();
        logDebug('CMS_DELIVERY', 'Paused video for schedule recalculation (holding last frame)', {
          assetId: asset.id,
          currentTime: video.currentTime,
        });
      }
    } else {
      lastTimeUpdateRef.current = Date.now();
      if (video.paused && video.readyState >= 2) {
        video.play().then(() => {
          logDebug('CMS_DELIVERY', 'Resumed video after schedule recalculation', {
            assetId: asset.id,
            currentTime: video.currentTime,
          });
        }).catch((err) => {
          logError('CMS_DELIVERY', 'Failed to resume video after schedule recalculation', {
            assetId: asset.id,
            error: err?.message,
          });
        });
      }
    }
  }, [isScheduleRecalculating, asset?.id]);

  // Freeze detection & health check
  React.useEffect(() => {
    if (!asset) return;

    const isImage = asset.mediaType === 'image' ||
      (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
    const isLink = asset.mediaType === 'link';
    if (isImage || isLink) return;

    freezeTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      const elapsed = Date.now() - lastTimeUpdateRef.current;
      if (elapsed > FREEZE_TIMEOUT_MS) {
        logWarn('VIDEO', 'Video freeze detected - no timeupdate for 30s, attempting recovery', {
          assetId: asset.id,
          elapsed,
          readyState: video.readyState,
          networkState: video.networkState,
          currentTime: video.currentTime,
        });
        attemptRecovery();
      }
    }, 10000);

    healthCheckTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      logDebug('VIDEO', 'Video health check', {
        assetId: asset.id,
        paused: video.paused,
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime: video.currentTime,
        duration: video.duration,
        error: video.error?.message || null,
      });
      if (!video.paused && video.readyState < 2 && !video.error) {
        const elapsed = Date.now() - lastTimeUpdateRef.current;
        if (elapsed > FREEZE_TIMEOUT_MS) {
          logWarn('VIDEO', 'Video stuck in low readyState, attempting recovery', {
            assetId: asset.id,
            readyState: video.readyState,
            elapsed,
          });
          attemptRecovery();
        }
      }
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      if (freezeTimerRef.current !== undefined) window.clearInterval(freezeTimerRef.current);
      if (healthCheckTimerRef.current !== undefined) window.clearInterval(healthCheckTimerRef.current);
    };
  }, [asset?.id, asset?.src, attemptRecovery]);

  // Handle force reload
  React.useEffect(() => {
    if (forceReload > 0) {
      setErrorMsg(null);
      retryCountRef.current = 0;
      recreateCountRef.current = 0;
      lastTimeUpdateRef.current = Date.now();
      logDebug('VIDEO', 'Force reload triggered in VerticalVideoSlot', { forceReload });
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch(e => {
          logError('VIDEO', 'Failed to play video after force reload', { error: e.message });
        });
      }
      if (imgRef.current && asset) {
        logDebug('VIDEO', 'Refreshing image with cache', { src: asset.src });
        imgRef.current.src = asset.src;
      }
    }
  }, [forceReload, asset]);

  // CMS area aspect ratio: 1080px x 607.5px (16:9)
  const containerAspectRatio = 1080 / 607.5;

  const calculateObjectFit = (mediaWidth: number, mediaHeight: number) => {
    const mediaAspectRatio = mediaWidth / mediaHeight;
    return mediaAspectRatio > containerAspectRatio ? 'contain' : 'cover';
  };

  // Reset media element and ensure playback when asset changes.
  // Consolidated into a single effect to prevent the race condition where
  // a separate playback effect reads stale readyState immediately after
  // the reset effect calls load() (which resets readyState to 0).
  React.useEffect(() => {
    if (!asset) return;

    const isAssetChanged = asset.id !== prevAssetIdRef.current;

    // Guard: skip if src is empty (failed URL conversion) to prevent black screen
    if (!asset.src) {
      if (isAssetChanged) {
        logWarn('CMS_DELIVERY', 'Asset has empty src, skipping media load', { assetId: asset.id });
        prevAssetIdRef.current = asset.id;
      }
      return;
    }

    // Skip video operations for link type
    const isLink = asset.mediaType === 'link';
    if (isLink) {
      if (isAssetChanged) {
        prevAssetIdRef.current = asset.id;
      }
      return;
    }

    const video = videoRef.current;

    if (isAssetChanged) {
      logDebug('CMS_DELIVERY', 'CMS asset transition', {
        from: prevAssetIdRef.current,
        to: asset.id,
        mediaType: asset.mediaType,
      });

      setObjectFit('cover');

      // Release decoded video frames before loading new asset to prevent memory leak.
      // Without this, Chromium accumulates decoded frame buffers across asset changes.
      // After clearing, re-set the new src because useEffect runs after React's DOM update,
      // so removeAttribute('src') would otherwise erase the new src that React already applied.
      if (video) {
        // Explicitly pause the looping video first to prevent it from
        // restarting playback between src removal and new src assignment.
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.src = asset.src;
        video.load();
      }
      if (imgRef.current) {
        imgRef.current.src = asset.src;
      }

      prevAssetIdRef.current = asset.id;
    }

    if (!video) return;

    const attemptPlay = async () => {
      if (video.paused && video.readyState >= 2) {
        try {
          await video.play();
          logDebug('VIDEO', 'Video play() called successfully', {
            assetId: asset.id,
            readyState: video.readyState,
            currentTime: video.currentTime,
          });
        } catch (err: any) {
          logError('VIDEO', 'Video play() failed', {
            assetId: asset.id,
            error: err?.message,
            readyState: video.readyState,
          });
        }
      }
    };

    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      const onCanPlay = () => {
        attemptPlay();
        video.removeEventListener('canplay', onCanPlay);
      };
      video.addEventListener('canplay', onCanPlay);
      return () => {
        video.removeEventListener('canplay', onCanPlay);
      };
    }
  }, [asset]);

  // CMS preload disabled: on systems without hardware video acceleration,
  // Chromium allocates a full software decode pipeline for any video element
  // with buffered data, causing PIPELINE_ERROR_DECODE when multiple pipelines
  // compete for CPU. CMS assets are local files that load quickly on demand.

  // Handle audio settings updates dynamically
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = audioSettings.cmsMuted;
    }
  }, [audioSettings.cmsMuted]);

  // No asset case
  if (!asset) {
    if (!isLoading) {
      logWarn('CMS_DELIVERY', 'No video asset available for VerticalVideoSlot', {
        isLoading,
        currentAssetId: null,
      });
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 14,
          backgroundColor: '#333',
          padding: 8,
          textAlign: 'center',
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
          {isLoading ? 'Loading...' : 'Not connected.'}
        </div>
        {!isLoading && (
          <div style={{ fontSize: 10, color: '#aaa' }}>
            Waiting for asset data from SSE...
          </div>
        )}
      </div>
    );
  }

  const isImage = asset.mediaType === 'image' ||
    (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
  const isLink = asset.mediaType === 'link';

  const mediaKey = `${asset.id}-${asset.src}`;

  const renderOverlay = () => {
    if (!errorMsg) return null;
    return (
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#ff5555',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: 20,
        boxSizing: 'border-box',
        zIndex: 100,
        pointerEvents: 'none',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Playback Error</div>
        <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{errorMsg}</div>
        <div style={{ fontSize: 10, marginTop: 8, color: '#aaa' }}>{asset.src}</div>
      </div>
    );
  };

  // Link (iframe) render branch
  if (isLink) {
    let iframeTransform: string | undefined;
    if (containerSize.width > 0 && containerSize.height > 0) {
      const scale = Math.min(
        containerSize.width / LINK_CONTENT_W,
        containerSize.height / LINK_CONTENT_H
      );
      const tx = (containerSize.width - LINK_CONTENT_W * scale) / 2;
      const ty = (containerSize.height - LINK_CONTENT_H * scale) / 2;
      iframeTransform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    }
    return (
      <div ref={linkContainerRef} style={{
        position: 'relative', width: '100%', height: '100%',
        overflow: 'hidden', background: '#000',
      }}>
        <iframe
          key={`iframe-${asset.id}`}
          src={asset.src}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: `${LINK_CONTENT_W}px`, height: `${LINK_CONTENT_H}px`,
            border: 'none', transformOrigin: 'top left',
            transform: iframeTransform, zIndex: 1,
          }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => {
            setIframeLoaded(true);
            logDebug('CMS_DELIVERY', 'Link content loaded', { assetId: asset.id, src: asset.src });
          }}
          onError={() => {
            logError('CMS_DELIVERY', 'Link content load failed', { assetId: asset.id, src: asset.src });
          }}
        />
        {overlaySnapshot && (
          <img
            src={overlaySnapshot}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', zIndex: 2, pointerEvents: 'none',
            }}
          />
        )}
      </div>
    );
  }

  if (isImage) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {renderOverlay()}
        <img
          ref={imgRef}
          key={mediaKey}
          src={asset.src}
          alt={asset.name || 'Media'}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: objectFit,
          }}
          onLoad={(e) => {
            const img = e.currentTarget;
            const fit = calculateObjectFit(img.naturalWidth, img.naturalHeight);
            setObjectFit(fit);
            logDebug('VIDEO', 'Image loaded in VerticalVideoSlot', {
              assetId: asset.id,
              src: asset.src,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              objectFit: fit,
            });
          }}
          onError={() => {
            const msg = `Failed to load image: ${asset.src}`;
            logError('VIDEO', 'Image element error (VerticalVideoSlot)', {
              assetId: asset.id,
              src: asset.src,
            });
            setErrorMsg(msg);
          }}
        />
      </div>
    );
  }

  // Render as video (default)
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {renderOverlay()}
      <video
        ref={videoRef}
        key={`video-slot-${videoKey}`}
        src={asset.src}
        autoPlay
        muted={audioSettings.cmsMuted}
        loop={true}
        playsInline
        preload="metadata"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: objectFit,
        }}
        onTimeUpdate={() => {
          lastTimeUpdateRef.current = Date.now();
        }}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          logDebug('VIDEO', 'Video metadata loaded', {
            assetId: asset.id,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration,
          });
        }}
        onLoadedData={(e) => {
          const video = e.currentTarget;
          const fit = calculateObjectFit(video.videoWidth, video.videoHeight);
          setObjectFit(fit);
          retryCountRef.current = 0;
          lastTimeUpdateRef.current = Date.now();
          setErrorMsg(null);
          // Capture first frame immediately for transition overlay
          const canvas = captureCanvasRef.current;
          if (canvas && video.videoWidth > 0) {
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
            }
            try {
              canvas.getContext('2d')?.drawImage(video, 0, 0);
              latestVideoFrameRef.current = canvas.toDataURL('image/jpeg', 0.85);
            } catch { }
          }
          logDebug('VIDEO', 'Video loaded in VerticalVideoSlot', {
            assetId: asset.id,
            src: asset.src,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            objectFit: fit,
            paused: video.paused,
            readyState: video.readyState,
          });
          if (video.paused && video.readyState >= 2) {
            video.play().then(() => {
              logDebug('VIDEO', 'Video play() succeeded in onLoadedData', {
                assetId: asset.id,
                currentTime: video.currentTime,
              });
            }).catch((err) => {
              logError('VIDEO', 'Failed to play video in onLoadedData', {
                assetId: asset.id,
                src: asset.src,
                error: err?.message,
                paused: video.paused,
                readyState: video.readyState,
              });
            });
          }
        }}
        onCanPlay={(e) => {
          const video = e.currentTarget;
          logDebug('VIDEO', 'Video can play', {
            assetId: asset.id,
            readyState: video.readyState,
            paused: video.paused,
          });
          if (video.paused) {
            video.play().then(() => {
              logDebug('VIDEO', 'Video play() succeeded in onCanPlay', {
                assetId: asset.id,
                currentTime: video.currentTime,
              });
            }).catch((err) => {
              logError('VIDEO', 'Failed to play video in onCanPlay', {
                assetId: asset.id,
                error: err?.message,
              });
            });
          }
        }}
        onPlay={() => {
          lastTimeUpdateRef.current = Date.now();
          logDebug('VIDEO', 'Video playback started', {
            assetId: asset.id,
            currentTime: videoRef.current?.currentTime,
            duration: videoRef.current?.duration,
          });
        }}
        onStalled={() => {
          logWarn('VIDEO', 'Video stalled (network throttle or buffer underrun)', {
            assetId: asset.id,
            src: asset.src,
            readyState: videoRef.current?.readyState,
            networkState: videoRef.current?.networkState,
          });
        }}
        onEnded={() => {
          logDebug('VIDEO', 'Video playback ended (will loop)', {
            assetId: asset.id,
          });
        }}
        onError={(e) => {
          const video = e.currentTarget;
          const msg = video.error?.message || 'Unknown video error';
          logError('VIDEO', 'Video element error (VerticalVideoSlot)', {
            assetId: asset.id,
            src: asset.src,
            error: msg,
            errorCode: video.error?.code,
            networkState: video.networkState,
            readyState: video.readyState,
          });
          setErrorMsg(`Video Error: ${msg} (Code: ${video.error?.code})`);
          attemptRecovery();
        }}
      />
    </div>
  );
};

export default VerticalVideoSlot;
