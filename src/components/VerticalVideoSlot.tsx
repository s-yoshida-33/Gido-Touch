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

// Expected dimensions of link content pages (portrait 9:16)
const LINK_CONTENT_W = 1080;
const LINK_CONTENT_H = 1920;

// Returns true for external URLs (http or https) while excluding localhost
// and loopback addresses used to serve local video files.
const isExternalLinkUrl = (src: string | undefined): boolean =>
  !!src &&
  /^https?:\/\//i.test(src) &&
  !/^https?:\/\/localhost(:\d+)?/i.test(src) &&
  !/^https?:\/\/127\./i.test(src);

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ forceReload = 0 }) => {
  const { asset, nextAsset, isLoading, isScheduleRecalculating } = useCurrentAsset();
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

  // Container size for iframe scaling (ResizeObserver on the outer wrapper)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const outerContainerRef = React.useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
    if (el) {
      const observer = new ResizeObserver(entries => {
        const { width, height } = entries[0].contentRect;
        setContainerSize({ width, height });
      });
      observer.observe(el);
      resizeObserverRef.current = observer;
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    }
  }, []);

  // Iframe state: src while preloading or active, flag for when it is the visible content
  const [iframeSrc, setIframeSrc] = React.useState<string | null>(null);
  const [iframeActive, setIframeActive] = React.useState(false);

  // Begin preloading as soon as the next asset is known to be an external URL.
  // Guard with iframeActive so this effect never fires while a link is displayed —
  // otherwise it would overwrite the active iframeSrc with a local video URL.
  React.useEffect(() => {
    if (iframeActive) return;
    const src = nextAsset?.src;
    if (isExternalLinkUrl(src)) {
      setIframeSrc(prev => (prev === src ? prev : src as string));
    }
  }, [nextAsset?.src, iframeActive]);

  // Activate/deactivate the iframe synchronously — before the browser paints.
  // Deps include both asset.id AND asset.mediaType so the effect fires even
  // when the same schedule slot transitions between mediaTypes (e.g. video→link
  // with an identical asset id).
  React.useLayoutEffect(() => {
    if (!asset) { setIframeActive(false); return; }
    if (asset.mediaType === 'link') {
      setIframeSrc(prev => (prev === asset.src ? prev : asset.src));
      setIframeActive(true);
    } else {
      setIframeActive(false);
    }
  }, [asset?.id, asset?.mediaType]);

  // Release the iframe element when it is no longer active and the next asset
  // is not an external URL (no reason to keep it in the DOM consuming memory)
  React.useEffect(() => {
    if (!iframeActive) {
      if (!isExternalLinkUrl(nextAsset?.src)) {
        setIframeSrc(null);
      }
    }
  }, [iframeActive, nextAsset?.src]);

  // Cleanup video resources and timers on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      if (retryTimerRef.current !== undefined) { window.clearTimeout(retryTimerRef.current); retryTimerRef.current = undefined; }
      if (freezeTimerRef.current !== undefined) { window.clearInterval(freezeTimerRef.current); freezeTimerRef.current = undefined; }
      if (healthCheckTimerRef.current !== undefined) { window.clearInterval(healthCheckTimerRef.current); healthCheckTimerRef.current = undefined; }
      if (resizeObserverRef.current) { resizeObserverRef.current.disconnect(); resizeObserverRef.current = null; }
    };
  }, []);

  // Reset error and retry count when asset changes
  React.useEffect(() => {
    setErrorMsg(null);
    retryCountRef.current = 0;
    recreateCountRef.current = 0;
    lastTimeUpdateRef.current = Date.now();
    if (retryTimerRef.current !== undefined) { window.clearTimeout(retryTimerRef.current); retryTimerRef.current = undefined; }
  }, [asset?.id, asset?.src]);

  // Recovery logic
  const attemptRecovery = React.useCallback(() => {
    if (retryCountRef.current < MAX_RETRY_COUNT) {
      retryCountRef.current += 1;
      const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCountRef.current - 1);
      logWarn('VIDEO', `Attempting video recovery (${retryCountRef.current}/${MAX_RETRY_COUNT}), delay=${delay}ms`, { assetId: asset?.id });
      setErrorMsg(`Retrying (${retryCountRef.current}/${MAX_RETRY_COUNT})...`);
      retryTimerRef.current = window.setTimeout(() => {
        if (videoRef.current) { videoRef.current.load(); videoRef.current.play().catch(() => {}); lastTimeUpdateRef.current = Date.now(); }
      }, delay);
    } else if (recreateCountRef.current < MAX_RECREATE_COUNT) {
      recreateCountRef.current += 1;
      retryCountRef.current = 0;
      logWarn('VIDEO', `Recreating video element (${recreateCountRef.current}/${MAX_RECREATE_COUNT})`, { assetId: asset?.id });
      setErrorMsg(`Recreating player (${recreateCountRef.current}/${MAX_RECREATE_COUNT})...`);
      lastTimeUpdateRef.current = Date.now();
      setVideoKey(prev => prev + 1);
    } else {
      logError('VIDEO', 'All video recovery attempts exhausted', { assetId: asset?.id, retryCount: retryCountRef.current, recreateCount: recreateCountRef.current });
      setErrorMsg('Video Error: All recovery attempts exhausted');
    }
  }, [asset?.id]);

  // Pause video on last frame during CMS schedule recalculation
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !asset) return;
    const isImage = asset.mediaType === 'image' || (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
    const isLink = asset.mediaType === 'link';
    if (isImage || isLink) return;

    if (isScheduleRecalculating) {
      if (!video.paused) {
        video.pause();
        logDebug('CMS_DELIVERY', 'Paused video for schedule recalculation (holding last frame)', { assetId: asset.id, currentTime: video.currentTime });
      }
    } else {
      lastTimeUpdateRef.current = Date.now();
      if (video.paused && video.readyState >= 2) {
        video.play().then(() => {
          logDebug('CMS_DELIVERY', 'Resumed video after schedule recalculation', { assetId: asset.id, currentTime: video.currentTime });
        }).catch(err => {
          logError('CMS_DELIVERY', 'Failed to resume video after schedule recalculation', { assetId: asset.id, error: err?.message });
        });
      }
    }
  }, [isScheduleRecalculating, asset?.id]);

  // Freeze detection & health check
  React.useEffect(() => {
    if (!asset) return;
    const isImage = asset.mediaType === 'image' || (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));
    const isLink = asset.mediaType === 'link';
    if (isImage || isLink) return;

    freezeTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.paused || video.ended) return;
      const elapsed = Date.now() - lastTimeUpdateRef.current;
      if (elapsed > FREEZE_TIMEOUT_MS) {
        logWarn('VIDEO', 'Video freeze detected - no timeupdate for 30s, attempting recovery', {
          assetId: asset.id, elapsed, readyState: video.readyState, networkState: video.networkState, currentTime: video.currentTime,
        });
        attemptRecovery();
      }
    }, 10000);

    healthCheckTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      logDebug('VIDEO', 'Video health check', {
        assetId: asset.id, paused: video.paused, readyState: video.readyState,
        networkState: video.networkState, currentTime: video.currentTime,
        duration: video.duration, error: video.error?.message || null,
      });
      if (!video.paused && video.readyState < 2 && !video.error) {
        const elapsed = Date.now() - lastTimeUpdateRef.current;
        if (elapsed > FREEZE_TIMEOUT_MS) {
          logWarn('VIDEO', 'Video stuck in low readyState, attempting recovery', { assetId: asset.id, readyState: video.readyState, elapsed });
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
        videoRef.current.play().catch(e => logError('VIDEO', 'Failed to play video after force reload', { error: e.message }));
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

  // Reset media element and ensure playback when asset changes
  React.useEffect(() => {
    if (!asset) return;
    const isAssetChanged = asset.id !== prevAssetIdRef.current;
    if (!asset.src) {
      if (isAssetChanged) { logWarn('CMS_DELIVERY', 'Asset has empty src, skipping media load', { assetId: asset.id }); prevAssetIdRef.current = asset.id; }
      return;
    }
    const isLink = asset.mediaType === 'link';
    if (isLink) {
      if (isAssetChanged) prevAssetIdRef.current = asset.id;
      return;
    }

    const video = videoRef.current;
    if (isAssetChanged) {
      logDebug('CMS_DELIVERY', 'CMS asset transition', { from: prevAssetIdRef.current, to: asset.id, mediaType: asset.mediaType });
      setObjectFit('cover');
      if (video) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.src = asset.src;
        video.load();
      }
      if (imgRef.current) imgRef.current.src = asset.src;
      prevAssetIdRef.current = asset.id;
    }

    if (!video) return;
    const attemptPlay = async () => {
      if (video.paused && video.readyState >= 2) {
        try {
          await video.play();
          logDebug('VIDEO', 'Video play() called successfully', { assetId: asset.id, readyState: video.readyState, currentTime: video.currentTime });
        } catch (err: any) {
          logError('VIDEO', 'Video play() failed', { assetId: asset.id, error: err?.message, readyState: video.readyState });
        }
      }
    };
    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      const onCanPlay = () => { attemptPlay(); video.removeEventListener('canplay', onCanPlay); };
      video.addEventListener('canplay', onCanPlay);
      return () => { video.removeEventListener('canplay', onCanPlay); };
    }
  }, [asset]);

  // CMS preload disabled: on systems without hardware video acceleration,
  // Chromium allocates a full software decode pipeline for any video element
  // with buffered data, causing PIPELINE_ERROR_DECODE when multiple pipelines
  // compete for CPU. CMS assets are local files that load quickly on demand.

  // Handle audio settings updates dynamically
  React.useEffect(() => {
    if (videoRef.current) videoRef.current.muted = audioSettings.cmsMuted;
  }, [audioSettings.cmsMuted]);

  // Log when no asset
  React.useEffect(() => {
    if (!asset && !isLoading) {
      logWarn('CMS_DELIVERY', 'No video asset available for VerticalVideoSlot', { isLoading, currentAssetId: null });
    }
  }, [asset, isLoading]);

  // Compute CSS transform to scale link content (1080x1920) into the container
  let iframeTransform: string | undefined;
  if (containerSize.width > 0 && containerSize.height > 0) {
    const scale = Math.min(containerSize.width / LINK_CONTENT_W, containerSize.height / LINK_CONTENT_H);
    const tx = (containerSize.width - LINK_CONTENT_W * scale) / 2;
    const ty = (containerSize.height - LINK_CONTENT_H * scale) / 2;
    iframeTransform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  const isImage = asset && (
    asset.mediaType === 'image' || (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src))
  );
  const isLink = asset?.mediaType === 'link';

  // Effective iframe src: if active but preloading missed, fall back to asset src directly
  const effectiveIframeSrc = iframeActive ? (iframeSrc || asset?.src || null) : iframeSrc;

  const renderOverlay = () => {
    if (!errorMsg) return null;
    return (
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        backgroundColor: 'rgba(0,0,0,0.7)', color: '#ff5555', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
        padding: 20, boxSizing: 'border-box', zIndex: 100, pointerEvents: 'none',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Playback Error</div>
        <div style={{ fontSize: 12, wordBreak: 'break-all' }}>{errorMsg}</div>
        <div style={{ fontSize: 10, marginTop: 8, color: '#aaa' }}>{asset?.src}</div>
      </div>
    );
  };

  return (
    <div
      ref={outerContainerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}
    >
      {/* Link content iframe.
          While the current video/image plays, the iframe loads silently at z-index 0.
          useLayoutEffect flips iframeActive before the browser paints, instantly
          promoting it to z-index 2 — no black frame is ever visible. */}
      {effectiveIframeSrc && (
        <iframe
          key={`iframe-${effectiveIframeSrc}`}
          src={effectiveIframeSrc}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: `${LINK_CONTENT_W}px`, height: `${LINK_CONTENT_H}px`,
            border: 'none', transformOrigin: 'top left',
            transform: iframeTransform,
            zIndex: iframeActive ? 2 : 0,
            pointerEvents: iframeActive ? 'auto' : 'none',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms"
          onLoad={() => logDebug('CMS_DELIVERY', iframeActive ? 'Link content active' : 'Link content preloaded', { src: effectiveIframeSrc })}
          onError={() => logError('CMS_DELIVERY', 'Link content load failed', { src: effectiveIframeSrc })}
        />
      )}

      {/* Non-link content at z-index 1 — covers the preloading iframe.
          Never renders video/image for link-type assets to prevent a broken
          media element from briefly showing during state transitions. */}
      {!iframeActive && !isLink && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: '#000' }}>
          {!asset ? (
            <div style={{
              width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14,
              padding: 8, textAlign: 'center',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{isLoading ? 'Loading...' : 'Not connected.'}</div>
              {!isLoading && <div style={{ fontSize: 10, color: '#aaa' }}>Waiting for asset data from SSE...</div>}
            </div>
          ) : isImage ? (
            <>
              {renderOverlay()}
              <img
                ref={imgRef}
                key={`${asset.id}-${asset.src}`}
                src={asset.src}
                alt={asset.name || 'Media'}
                style={{ width: '100%', height: '100%', display: 'block', objectFit: objectFit }}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  const fit = calculateObjectFit(img.naturalWidth, img.naturalHeight);
                  setObjectFit(fit);
                  logDebug('VIDEO', 'Image loaded in VerticalVideoSlot', { assetId: asset.id, src: asset.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, objectFit: fit });
                }}
                onError={() => {
                  logError('VIDEO', 'Image element error (VerticalVideoSlot)', { assetId: asset.id, src: asset.src });
                  setErrorMsg(`Failed to load image: ${asset.src}`);
                }}
              />
            </>
          ) : (
            <>
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
                style={{ width: '100%', height: '100%', display: 'block', objectFit: objectFit }}
                onTimeUpdate={() => { lastTimeUpdateRef.current = Date.now(); }}
                onLoadedMetadata={(e) => {
                  const video = e.currentTarget;
                  logDebug('VIDEO', 'Video metadata loaded', { assetId: asset.id, videoWidth: video.videoWidth, videoHeight: video.videoHeight, duration: video.duration });
                }}
                onLoadedData={(e) => {
                  const video = e.currentTarget;
                  const fit = calculateObjectFit(video.videoWidth, video.videoHeight);
                  setObjectFit(fit);
                  retryCountRef.current = 0;
                  lastTimeUpdateRef.current = Date.now();
                  setErrorMsg(null);
                  logDebug('VIDEO', 'Video loaded in VerticalVideoSlot', { assetId: asset.id, src: asset.src, videoWidth: video.videoWidth, videoHeight: video.videoHeight, objectFit: fit, paused: video.paused, readyState: video.readyState });
                  if (video.paused && video.readyState >= 2) {
                    video.play().then(() => {
                      logDebug('VIDEO', 'Video play() succeeded in onLoadedData', { assetId: asset.id, currentTime: video.currentTime });
                    }).catch(err => {
                      logError('VIDEO', 'Failed to play video in onLoadedData', { assetId: asset.id, src: asset.src, error: err?.message, paused: video.paused, readyState: video.readyState });
                    });
                  }
                }}
                onCanPlay={(e) => {
                  const video = e.currentTarget;
                  logDebug('VIDEO', 'Video can play', { assetId: asset.id, readyState: video.readyState, paused: video.paused });
                  if (video.paused) {
                    video.play().then(() => {
                      logDebug('VIDEO', 'Video play() succeeded in onCanPlay', { assetId: asset.id, currentTime: video.currentTime });
                    }).catch(err => {
                      logError('VIDEO', 'Failed to play video in onCanPlay', { assetId: asset.id, error: err?.message });
                    });
                  }
                }}
                onPlay={() => {
                  lastTimeUpdateRef.current = Date.now();
                  logDebug('VIDEO', 'Video playback started', { assetId: asset.id, currentTime: videoRef.current?.currentTime, duration: videoRef.current?.duration });
                }}
                onStalled={() => logWarn('VIDEO', 'Video stalled (network throttle or buffer underrun)', { assetId: asset.id, src: asset.src, readyState: videoRef.current?.readyState, networkState: videoRef.current?.networkState })}
                onEnded={() => logDebug('VIDEO', 'Video playback ended (will loop)', { assetId: asset.id })}
                onError={(e) => {
                  const video = e.currentTarget;
                  const msg = video.error?.message || 'Unknown video error';
                  logError('VIDEO', 'Video element error (VerticalVideoSlot)', { assetId: asset.id, src: asset.src, error: msg, errorCode: video.error?.code, networkState: video.networkState, readyState: video.readyState });
                  setErrorMsg(`Video Error: ${msg} (Code: ${video.error?.code})`);
                  attemptRecovery();
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default VerticalVideoSlot;
