// src/components/IndependentVideoPlayer.tsx
import React from 'react';
import { useIndependentVideo } from '../hooks/useIndependentVideo';
import { logInfo, logError, logWarn } from '../logs/logging';

/**
 * Check if a URL is a video file
 */
function isVideoFile(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
  const urlLower = url.toLowerCase();
  return videoExtensions.some(ext => urlLower.includes(ext));
}

/**
 * Check if a URL is an image file
 */
function isImageFile(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.svg', '.webp', '.gif', '.bmp'];
  const urlLower = url.toLowerCase();
  return imageExtensions.some(ext => urlLower.includes(ext));
}

const IndependentVideoPlayer: React.FC = () => {
  const { videoSettings, isLoading } = useIndependentVideo();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Media files list and current index
  const [mediaFiles, setMediaFiles] = React.useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isLoadingMedia, setIsLoadingMedia] = React.useState(true);

  // Load media files from local directory
  React.useEffect(() => {
    let isMounted = true;

    const loadMediaFiles = async () => {
      try {
        if (!window.electronAPI?.getLocalMediaFiles) {
          logWarn('video', 'electronAPI.getLocalMediaFiles is not available');
          if (isMounted) {
            setIsLoadingMedia(false);
          }
          return;
        }

        const files = await window.electronAPI.getLocalMediaFiles();
        
        if (!isMounted) return;

        if (files.length === 0) {
          logWarn('video', 'No media files found in local directory');
          setIsLoadingMedia(false);
          return;
        }

        logInfo('video', 'Loaded media files from local directory', {
          count: files.length,
        });

        setMediaFiles(files);
        setCurrentIndex(0);
        setIsLoadingMedia(false);
      } catch (error: any) {
        logError('video', 'Failed to load media files from local directory', {
          error: error?.message,
        });
        if (isMounted) {
          setIsLoadingMedia(false);
        }
      }
    };

    loadMediaFiles();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle media playback - loop through files
  React.useEffect(() => {
    if (mediaFiles.length === 0 || isLoadingMedia) return;

    const currentFile = mediaFiles[currentIndex];
    if (!currentFile) return;

    const isVideo = isVideoFile(currentFile);
    const isImage = isImageFile(currentFile);

    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      video.src = currentFile;
      video.loop = false; // We handle looping manually
      video.autoplay = true;
      
      // When video ends, move to next file
      const handleEnded = () => {
        setCurrentIndex((prev) => (prev + 1) % mediaFiles.length);
      };
      
      video.addEventListener('ended', handleEnded);
      
      logInfo('video', 'Playing video from local directory', {
        index: currentIndex,
        total: mediaFiles.length,
        file: currentFile,
      });

      return () => {
        video.removeEventListener('ended', handleEnded);
      };
    } else if (isImage && imgRef.current) {
      const img = imgRef.current;
      img.src = currentFile;
      
      // For images, show for 5 seconds then move to next
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % mediaFiles.length);
      }, 5000);
      
      logInfo('video', 'Showing image from local directory', {
        index: currentIndex,
        total: mediaFiles.length,
        file: currentFile,
      });

      return () => {
        clearTimeout(timer);
      };
    }
  }, [mediaFiles, currentIndex, isLoadingMedia]);

  // Handle video settings changes (legacy support)
  React.useEffect(() => {
    // If videoSettings is enabled and has a source, use it instead of local files
    if (videoSettings?.enabled && videoSettings.source && mediaFiles.length === 0) {
      if (!videoRef.current) return;

      const video = videoRef.current;
      if (video.src !== videoSettings.source) {
        video.src = videoSettings.source;
        logInfo('video', 'Independent video source updated', {
          source: videoSettings.source,
        });
      }

      video.loop = videoSettings.loop;
      video.autoplay = videoSettings.autoplay;
    }
  }, [videoSettings, mediaFiles.length]);

  // Loading state
  if (isLoading || isLoadingMedia) {
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
        Loading…
      </div>
    );
  }

  // Use local media files if available
  if (mediaFiles.length > 0) {
    const currentFile = mediaFiles[currentIndex];
    const isVideo = currentFile && isVideoFile(currentFile);
    const isImage = currentFile && isImageFile(currentFile);

    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          backgroundColor: '#000000',
          overflow: 'hidden',
        }}
      >
        {isVideo && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
              backgroundColor: '#000000',
            }}
            onError={(e) => {
              logError('video', 'Video playback error', {
                file: currentFile,
                error: e.currentTarget.error?.message,
              });
              // Move to next file on error
              setCurrentIndex((prev) => (prev + 1) % mediaFiles.length);
            }}
          />
        )}
        {isImage && (
          <img
            ref={imgRef}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'cover',
              backgroundColor: '#000000',
            }}
            onError={(_e) => {
              logError('video', 'Image load error', {
                file: currentFile,
              });
              // Move to next file on error
              setCurrentIndex((prev) => (prev + 1) % mediaFiles.length);
            }}
          />
        )}
      </div>
    );
  }

  // Fallback to videoSettings if no local files (legacy support)
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
        {!videoSettings?.enabled ? 'Video disabled' : 'No media files found'}
      </div>
    );
  }

  // Render video player (legacy mode)
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

