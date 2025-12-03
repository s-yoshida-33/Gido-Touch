// src/components/IndependentVideoPlayer.tsx
import React from 'react';
import { useIndependentVideo } from '../hooks/useIndependentVideo';
import { logInfo, logError } from '../logs/logging';

const IndependentVideoPlayer: React.FC = () => {
  const { videoSettings, isLoading } = useIndependentVideo();
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Handle video settings changes
  React.useEffect(() => {
    if (!videoSettings || !videoRef.current) return;

    if (!videoSettings.enabled || !videoSettings.source) {
      // Video is disabled or no source - pause and clear
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      return;
    }

    // Update video source
    const video = videoRef.current;
    if (video.src !== videoSettings.source) {
      video.src = videoSettings.source;
      logInfo('video', 'Independent video source updated', {
        source: videoSettings.source,
      });
    }

    // Set loop and autoplay
    video.loop = videoSettings.loop;
    video.autoplay = videoSettings.autoplay;
  }, [videoSettings]);

  // Loading state
  if (isLoading) {
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
        Loading…
      </div>
    );
  }

  // No settings or disabled
  if (!videoSettings || !videoSettings.enabled || !videoSettings.source) {
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
          backgroundColor: '#000000',
        }}
      >
        {!videoSettings?.enabled ? 'Video disabled' : 'No video source'}
      </div>
    );
  }

  // Render video player
  return (
    <video
      ref={videoRef}
      autoPlay={videoSettings.autoplay}
      loop={videoSettings.loop}
      playsInline
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        objectFit: 'cover',
        backgroundColor: '#000000',
      }}
      onLoadedData={() => {
        logInfo('video', 'Independent video loaded', {
          source: videoSettings.source,
        });
      }}
      onPlay={() => {
        logInfo('video', 'Independent video playback started', {
          source: videoSettings.source,
        });
      }}
      onEnded={() => {
        if (videoSettings.loop) {
          logInfo('video', 'Independent video ended (will loop)', {
            source: videoSettings.source,
          });
        } else {
          logInfo('video', 'Independent video ended', {
            source: videoSettings.source,
          });
        }
      }}
      onError={(e) => {
        logError('video', 'Independent video element error', {
          source: videoSettings.source,
          error: e.currentTarget.error?.message,
        });
        // Try to reload on error
        if (videoRef.current) {
          setTimeout(() => {
            if (videoRef.current && videoSettings.source) {
              videoRef.current.load();
            }
          }, 1000);
        }
      }}
    />
  );
};

export default IndependentVideoPlayer;

