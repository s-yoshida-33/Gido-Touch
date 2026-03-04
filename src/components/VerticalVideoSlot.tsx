// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { logInfo, logWarn, logError } from '../logs/logging';

interface VerticalVideoSlotProps {
  forceReload?: number;
}

const MAX_RETRY_COUNT = 3;

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ forceReload = 0 }) => {
  const { asset, isLoading } = useCurrentAsset();
  const { settings: audioSettings } = useAudioSettings();
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);
  const retryCountRef = React.useRef<number>(0);
  const [objectFit, setObjectFit] = React.useState<'cover' | 'contain'>('cover');

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Reset error and retry count when asset changes
  React.useEffect(() => {
    setErrorMsg(null);
    retryCountRef.current = 0;
  }, [asset?.id, asset?.src]);

  // Handle force reload
  React.useEffect(() => {
    if (forceReload > 0) {
      setErrorMsg(null);
      logInfo('VIDEO', 'Force reload triggered in VerticalVideoSlot', { forceReload });
      if (videoRef.current) {
        videoRef.current.load();
        // Try to play after reload
        videoRef.current.play().catch(e => {
            logError('VIDEO', 'Failed to play video after force reload', { error: e.message });
        });
      }
      if (imgRef.current && asset) {
        // Force image reload using cache (reset to original asset source)
        logInfo('VIDEO', 'Refreshing image with cache', { src: asset.src });
        imgRef.current.src = asset.src;
      }
    }
  }, [forceReload, asset]);

  // CMSエリアのアスペクト比: 1080px × 607.5px (16:9)
  const containerAspectRatio = 1080 / 607.5;

  // アスペクト比に基づいてobject-fitを決定
  const calculateObjectFit = (mediaWidth: number, mediaHeight: number) => {
    const mediaAspectRatio = mediaWidth / mediaHeight;
    // 横長のコンテンツ（メディアのアスペクト比 > コンテナのアスペクト比）: contain（横幅マックス、上下余白）
    // 縦長のコンテンツ（メディアのアスペクト比 <= コンテナのアスペクト比）: cover（エリアいっぱい）
    return mediaAspectRatio > containerAspectRatio ? 'contain' : 'cover';
  };

  // Reset media element when asset changes
  React.useEffect(() => {
    if (asset && asset.id !== prevAssetIdRef.current) {
      // Asset changed - reset media elements and object-fit
      setObjectFit('cover'); // デフォルトにリセット
      if (videoRef.current) {
        videoRef.current.load(); // Force reload
      }
      if (imgRef.current) {
        imgRef.current.src = asset.src; // Force reload
      }
      prevAssetIdRef.current = asset.id;
    }
  }, [asset?.id, asset?.src]);

  // Ensure video playback when asset is available
  React.useEffect(() => {
    if (!asset || !videoRef.current) return;

    const video = videoRef.current;
    
    // Function to attempt playback
    const attemptPlay = async () => {
      if (video.paused && video.readyState >= 2) { // HAVE_CURRENT_DATA
        try {
          await video.play();
          logInfo('VIDEO', 'Video play() called successfully', {
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

    // Try to play when video is ready
    if (video.readyState >= 2) {
      attemptPlay();
    } else {
      // Wait for video to be ready
      const onCanPlay = () => {
        attemptPlay();
        video.removeEventListener('canplay', onCanPlay);
      };
      video.addEventListener('canplay', onCanPlay);
      
      return () => {
        video.removeEventListener('canplay', onCanPlay);
      };
    }
  }, [asset?.id, asset?.src]);

  // Handle audio settings updates dynamically
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = audioSettings.cmsMuted;
    }
  }, [audioSettings.cmsMuted]);

  // No asset case
  if (!asset) {
    if (!isLoading) {
      logWarn('VIDEO', 'No video asset available for VerticalVideoSlot', {
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
          {isLoading ? 'Loading...' : 'No connected.'}
        </div>
        {!isLoading && (
            <div style={{ fontSize: 10, color: '#aaa' }}>
                Waiting for asset data from SSE...
            </div>
        )}
      </div>
    );
  }

  // Determine if asset is an image
  // Check mediaType first (lowercase from CMS), then fall back to file extension
  const isImage = asset.mediaType === 'image' || 
    (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));

  // Use both id and src in key to ensure remount when either changes
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
    // Render as image
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
              logInfo('VIDEO', 'Image loaded in VerticalVideoSlot', {
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
          key={mediaKey}
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
          onLoadedMetadata={(e) => {
            const video = e.currentTarget;
            logInfo('VIDEO', 'Video metadata loaded', {
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
            logInfo('VIDEO', 'Video loaded in VerticalVideoSlot', {
              assetId: asset.id,
              src: asset.src,
              videoWidth: video.videoWidth,
              videoHeight: video.videoHeight,
              objectFit: fit,
              paused: video.paused,
              readyState: video.readyState,
            });
            // Ensure playback starts after loading
            if (video.paused && video.readyState >= 2) {
              video.play().then(() => {
                logInfo('VIDEO', 'Video play() succeeded in onLoadedData', {
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
            logInfo('VIDEO', 'Video can play', {
              assetId: asset.id,
              readyState: video.readyState,
              paused: video.paused,
            });
            // Ensure playback starts when video can play
            if (video.paused) {
              video.play().then(() => {
                logInfo('VIDEO', 'Video play() succeeded in onCanPlay', {
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
            logInfo('VIDEO', 'Video playback started', {
              assetId: asset.id,
              currentTime: videoRef.current?.currentTime,
              duration: videoRef.current?.duration,
            });
          }}
          onEnded={() => {
            logInfo('VIDEO', 'Video playback ended (will loop)', {
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
            
            // Try to reload on error (with retry limit to prevent infinite loop)
            if (videoRef.current && retryCountRef.current < MAX_RETRY_COUNT) {
              retryCountRef.current += 1;
              logWarn('VIDEO', `Retrying video load (${retryCountRef.current}/${MAX_RETRY_COUNT})`, {
                assetId: asset.id,
              });
              setTimeout(() => {
                if (videoRef.current && asset.src) {
                  videoRef.current.load();
                }
              }, 1000);
            } else if (retryCountRef.current >= MAX_RETRY_COUNT) {
              logError('VIDEO', 'Max retry count reached, stopping reload attempts', {
                assetId: asset.id,
                src: asset.src,
                retryCount: retryCountRef.current,
              });
            }
          }}
        />
    </div>
  );
};

export default VerticalVideoSlot;
