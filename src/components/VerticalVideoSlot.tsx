// src/components/VerticalVideoSlot.tsx
import React from 'react';
import { useCurrentAsset } from '../hooks/useCurrentAsset';
import { logInfo, logWarn, logError } from '../logs/logging';

const VerticalVideoSlot: React.FC = () => {
  const { asset, isLoading } = useCurrentAsset();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const prevAssetIdRef = React.useRef<string | null>(null);
  const [objectFit, setObjectFit] = React.useState<'cover' | 'contain'>('cover');

  // CMSエリアのアスペクト比: 1080px × 844px
  const containerAspectRatio = 1080 / 844;

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

  // No asset case
  if (!asset) {
    if (!isLoading) {
      logWarn('video', 'No video asset available for VerticalVideoSlot');
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
      loop={true}
      playsInline
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        objectFit: objectFit,
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
        });
      }}
      onPlay={() => {
        logInfo('video', 'Video playback started', {
          assetId: asset.id,
        });
      }}
      onEnded={() => {
        logInfo('video', 'Video playback ended (will loop)', {
          assetId: asset.id,
        });
      }}
      onError={() => {
        logError('video', 'Video element error (VerticalVideoSlot)', {
          assetId: asset.id,
          src: asset.src,
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
