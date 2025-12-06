// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { useRightTopVideoAsset } from '../hooks/useRightTopVideoAsset';
import { logInfo, logWarn, logError } from '../logs/logging';

interface VerticalVideoSlotProps {
  useRightTopVideoCms?: boolean;
}

const VerticalVideoSlot: React.FC<VerticalVideoSlotProps> = ({ useRightTopVideoCms = false }) => {
  const { asset: currentAsset, isLoading: isLoadingCurrent } = useCurrentAsset();
  const { asset: rightTopAsset, isLoading: isLoadingRightTop } = useRightTopVideoAsset();
  
  // Use right-top video CMS if specified, otherwise use default CMS
  const asset = useRightTopVideoCms ? rightTopAsset : currentAsset;
  const isLoading = useRightTopVideoCms ? isLoadingRightTop : isLoadingCurrent;
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);
  const [objectFit, setObjectFit] = React.useState<'cover' | 'contain'>('cover');

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
          logInfo('video', 'Video play() called successfully', {
            assetId: asset.id,
            readyState: video.readyState,
            currentTime: video.currentTime,
          });
        } catch (err: any) {
          logError('video', 'Video play() failed', {
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

  // No asset case
  if (!asset) {
    if (!isLoading) {
      logWarn('video', 'No video asset available for VerticalVideoSlot', {
        useRightTopVideoCms,
        isLoadingCurrent,
        isLoadingRightTop,
        currentAssetId: currentAsset?.id || null,
        rightTopAssetId: rightTopAsset?.id || null,
      });
    }

    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: 12,
        }}
      >
        {isLoading ? 'Loading…' : 'No conected.'}
      </div>
    );
  }

  // Determine if asset is an image
  // Check mediaType first, then fall back to file extension
  const isImage = asset.mediaType === 'image' || 
    (asset.src && /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(asset.src));

  // Use both id and src in key to ensure remount when either changes
  const mediaKey = `${asset.id}-${asset.src}`;

  if (isImage) {
    // Render as image
    return (
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
          logInfo('image', 'Image loaded in VerticalVideoSlot', {
            assetId: asset.id,
            src: asset.src,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            objectFit: fit,
          });
        }}
        onError={() => {
          logError('image', 'Image element error (VerticalVideoSlot)', {
            assetId: asset.id,
            src: asset.src,
          });
        }}
      />
    );
  }

  // Render as video (default)
  return (
    <video
      ref={videoRef}
      key={mediaKey}
      src={asset.src}
      autoPlay
      muted
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
        logInfo('video', 'Video metadata loaded', {
          assetId: asset.id,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          duration: video.duration,
          useRightTopVideoCms,
        });
      }}
      onLoadedData={(e) => {
        const video = e.currentTarget;
        const fit = calculateObjectFit(video.videoWidth, video.videoHeight);
        setObjectFit(fit);
        logInfo('video', 'Video loaded in VerticalVideoSlot', {
          assetId: asset.id,
          src: asset.src,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          objectFit: fit,
          useRightTopVideoCms,
          paused: video.paused,
          readyState: video.readyState,
        });
        // Ensure playback starts after loading
        if (video.paused && video.readyState >= 2) {
          video.play().then(() => {
            logInfo('video', 'Video play() succeeded in onLoadedData', {
              assetId: asset.id,
              currentTime: video.currentTime,
            });
          }).catch((err) => {
            logError('video', 'Failed to play video in onLoadedData', {
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
        logInfo('video', 'Video can play', {
          assetId: asset.id,
          readyState: video.readyState,
          paused: video.paused,
          useRightTopVideoCms,
        });
        // Ensure playback starts when video can play
        if (video.paused) {
          video.play().then(() => {
            logInfo('video', 'Video play() succeeded in onCanPlay', {
              assetId: asset.id,
              currentTime: video.currentTime,
            });
          }).catch((err) => {
            logError('video', 'Failed to play video in onCanPlay', {
              assetId: asset.id,
              error: err?.message,
            });
          });
        }
      }}
      onPlay={() => {
        logInfo('video', 'Video playback started', {
          assetId: asset.id,
          useRightTopVideoCms,
          currentTime: videoRef.current?.currentTime,
          duration: videoRef.current?.duration,
        });
      }}
      onEnded={() => {
        logInfo('video', 'Video playback ended (will loop)', {
          assetId: asset.id,
        });
      }}
      onError={(e) => {
        const video = e.currentTarget;
        logError('video', 'Video element error (VerticalVideoSlot)', {
          assetId: asset.id,
          src: asset.src,
          error: video.error?.message,
          errorCode: video.error?.code,
          useRightTopVideoCms,
          networkState: video.networkState,
          readyState: video.readyState,
        });
        // Try to reload on error
        if (videoRef.current) {
          setTimeout(() => {
            if (videoRef.current && asset.src) {
              videoRef.current.load();
            }
          }, 1000);
        }
      }}
    />
  );
};

export default VerticalVideoSlot;
