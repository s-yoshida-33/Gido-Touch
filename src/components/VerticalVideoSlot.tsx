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
const FREEZE_TIMEOUT_MS = 30000; // Consider as frozen if no timeupdate for 30 seconds
const HEALTH_CHECK_INTERVAL_MS = 60000; // Health check interval of 60 seconds
const MAX_RECREATE_COUNT = 3; // Maximum limit for recreating the video element

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ forceReload = 0 }) => {
  const { asset, nextAsset, isLoading, isScheduleRecalculating } = useCurrentAsset();
  const { audioSettings } = useAudioSettingsContext();

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const preloadVideoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);
  const retryCountRef = React.useRef<number>(0);
  const retryTimerRef = React.useRef<number | undefined>(undefined);
  const [objectFit, setObjectFit] = React.useState<'cover' | 'contain'>('cover');

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Freeze detection
  const lastTimeUpdateRef = React.useRef<number>(Date.now());
  const freezeTimerRef = React.useRef<number | undefined>(undefined);
  const healthCheckTimerRef = React.useRef<number | undefined>(undefined);

  // Video element recreation
  const [videoKey, setVideoKey] = React.useState<number>(0);
  const recreateCountRef = React.useRef<number>(0);

  // Cleanup video resources and timers on unmount to prevent memory leaks.
  // When CMS asset becomes null, React unmounts the video element but Chromium
  // may retain decoded frame buffers unless explicitly released.
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
      // Release preload video buffer to prevent orphaned decoded frames
      if (preloadVideoRef.current) {
        preloadVideoRef.current.pause();
        preloadVideoRef.current.removeAttribute('src');
        preloadVideoRef.current.load();
      }
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
      // All retries exhausted - recreate the video element
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
    if (isImage) return;

    if (isScheduleRecalculating) {
      if (!video.paused) {
        video.pause();
        logDebug('CMS_DELIVERY', 'Paused video for schedule recalculation (holding last frame)', {
          assetId: asset.id,
          currentTime: video.currentTime,
        });
      }
    } else {
      // Reset freeze detection baseline so the paused duration doesn't trigger false recovery
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
    if (isImage) return;

    // Periodic freeze check
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

    // Periodic health check
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

      // Detect stuck states: video should be playing but isn't
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

  // Determine object-fit based on aspect ratio
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

      // Release preload buffer if the preloaded asset matches the new current asset,
      // since the main player now owns this content.
      const preloadVideo = preloadVideoRef.current;
      if (preloadVideo && preloadVideo.src) {
        const preloadSrc = decodeURIComponent(preloadVideo.src);
        if (preloadSrc.includes(asset.id) || preloadVideo.src === asset.src) {
          preloadVideo.removeAttribute('src');
          preloadVideo.load();
        }
      }

      prevAssetIdRef.current = asset.id;
    }

    // Ensure video playback after src is set (within the same effect)
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

  // Preload next asset for seamless transition
  React.useEffect(() => {
    const preloadVideo = preloadVideoRef.current;
    if (!preloadVideo || !nextAsset?.src) return;

    const isNextVideo = !nextAsset.src.match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
    if (!isNextVideo) return;

    const currentPreloadSrc = decodeURIComponent(preloadVideo.src || '');
    if (currentPreloadSrc.includes(nextAsset.id) || preloadVideo.src === nextAsset.src) return;

    // Release previous preload buffer, then set new source
    if (preloadVideo.src) {
      preloadVideo.removeAttribute('src');
      preloadVideo.load();
    }
    preloadVideo.src = nextAsset.src;
    preloadVideo.load();
    logDebug('CMS_DELIVERY', 'Preloading next CMS asset', { nextAssetId: nextAsset.id });
  }, [nextAsset?.id, nextAsset?.src]);

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

  const mediaKey = `${asset.id}-${asset.src}`;

  // Debug/Error Overlay
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
            retryCountRef.current = 0; // Reset retry count on successful load
            lastTimeUpdateRef.current = Date.now();
            setErrorMsg(null);
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
        {/* Hidden preload element for next CMS asset */}
        <video
          ref={preloadVideoRef}
          muted
          preload="metadata"
          playsInline
          style={{ display: 'none' }}
        />
    </div>
  );
};

export default VerticalVideoSlot;