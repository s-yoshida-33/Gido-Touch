// src/components/IndependentVideoPlayer.tsx
import React from 'react';
import { useIndependentVideo } from '../hooks/useIndependentVideo';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { logInfo, logError, logWarn } from '../logs/logging';
import type { LocalMediaTextSettings } from '../types/global';
import type { Shop } from '../types/shop';
import { getDefaultMediaSettings } from '../utils/localMediaUtils';

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

/**
 * Extract filename from path/URL
 */
function extractFilename(path: string): string {
  try {
    if (path.startsWith('file://')) {
      const url = new URL(path);
      return decodeURIComponent(url.pathname.split('/').pop() || '');
    }
    return path.split(/[/\\]/).pop() || path;
  } catch {
    return path;
  }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

interface IndependentVideoPlayerProps {
  forceReload?: number;
  videoHeight?: string | number;
  language?: "ja" | "en";
  shops?: Shop[];
}

const IndependentVideoPlayer: React.FC<IndependentVideoPlayerProps> = ({ 
  forceReload = 0,
  videoHeight = '100%',
  language = "ja",
  shops = [],
}) => {
  const { videoSettings, isLoading } = useIndependentVideo();
  const { settings: audioSettings } = useAudioSettings();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Media files list and current index
  const [mediaFiles, setMediaFiles] = React.useState<string[]>([]);
  const [playlist, setPlaylist] = React.useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isLoadingMedia, setIsLoadingMedia] = React.useState(true);
  const [textSettings, setTextSettings] = React.useState<LocalMediaTextSettings>({});
  
  // Local reload trigger for when mall ID changes
  const [localReload, setLocalReload] = React.useState(0);

  // Listen for Mall ID updates
  React.useEffect(() => {
    const unsubscribe = window.electronAPI?.onMallIdUpdated?.(() => {
      logInfo('video', 'Mall ID updated, reloading media files');
      setLocalReload(prev => prev + 1);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

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
          forceReload,
          localReload
        });

        setMediaFiles(files);
        // Shuffle initially
        setPlaylist(shuffleArray(files));
        
        // Reset index
        setCurrentIndex(0);
        
        setIsLoadingMedia(false);
        
        // Force reload video element if it exists
        if (videoRef.current) {
          videoRef.current.load();
        }
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
  }, [forceReload, localReload]);

  // Load text settings
  React.useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    // Initial load
    if (api.getLocalMediaTextSettings) {
      api.getLocalMediaTextSettings().then(settings => {
        setTextSettings(settings);
      }).catch(err => console.error("Failed to load text settings", err));
    }

    // Subscribe to updates
    const unsubscribe = api.onLocalMediaTextSettingsUpdated ? 
      api.onLocalMediaTextSettingsUpdated((settings) => {
        setTextSettings(settings);
      }) : undefined;

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle media playback - loop through playlist (shuffled)
  React.useEffect(() => {
    if (playlist.length === 0 || isLoadingMedia) return;

    const currentFile = playlist[currentIndex];
    if (!currentFile) return;

    const isVideo = isVideoFile(currentFile);
    const isImage = isImageFile(currentFile);

    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      video.src = currentFile;
      // Use audio settings for mute state (default: unmute/false)
      video.muted = audioSettings.localMediaMuted;
      // If only one file, use native loop. Otherwise handle looping manually
      video.loop = playlist.length === 1;
      video.autoplay = true;
      
      // When video ends, move to next file (only if multiple files)
      const handleEnded = () => {
        if (playlist.length > 1) {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= playlist.length) {
            // Reached end of playlist, reshuffle and restart
            logInfo('video', 'Playlist cycle completed, reshuffling');
            setPlaylist(shuffleArray(mediaFiles));
            setCurrentIndex(0);
          } else {
            setCurrentIndex(nextIndex);
          }
        }
      };
      
      if (playlist.length > 1) {
        video.addEventListener('ended', handleEnded);
      }
      
      logInfo('video', 'Playing video from local directory', {
        index: currentIndex,
        total: playlist.length,
        file: currentFile,
      });

      return () => {
        if (playlist.length > 1) {
          video.removeEventListener('ended', handleEnded);
        }
      };
    } else if (isImage && imgRef.current) {
      const img = imgRef.current;
      img.src = currentFile;
      
      // For images, show for 15 seconds then move to next (or loop if only one)
      const timer = setTimeout(() => {
        if (playlist.length > 1) {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= playlist.length) {
            // Reached end of playlist, reshuffle and restart
            logInfo('video', 'Playlist cycle completed, reshuffling');
            setPlaylist(shuffleArray(mediaFiles));
            setCurrentIndex(0);
          } else {
            setCurrentIndex(nextIndex);
          }
        }
      }, 15000);
      
      logInfo('video', 'Showing image from local directory', {
        index: currentIndex,
        total: playlist.length,
        file: currentFile,
      });

      return () => {
        clearTimeout(timer);
      };
    }
  }, [playlist, currentIndex, isLoadingMedia, mediaFiles, audioSettings.localMediaMuted]);

  // Handle video settings changes (legacy support)
  React.useEffect(() => {
    // If videoSettings is enabled and has a source, use it instead of local files
    if (videoSettings?.enabled && videoSettings.source && playlist.length === 0) {
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
  }, [videoSettings, playlist.length]);

  // Handle audio settings updates dynamically
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = audioSettings.localMediaMuted;
    }
  }, [audioSettings.localMediaMuted]);

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
  if (playlist.length > 0) {
    const currentFile = playlist[currentIndex];
    const isVideo = currentFile && isVideoFile(currentFile);
    const isImage = currentFile && isImageFile(currentFile);
    const filename = extractFilename(currentFile);
    let currentText = textSettings[filename];
    
    // If setting is not present, generate default from shops data
    if (!currentText && shops.length > 0) {
      currentText = getDefaultMediaSettings(filename, shops);
    }

    // Determine text to display based on language
    const line1 = (language === 'en' && currentText?.line1En) ? currentText.line1En : currentText?.line1;
    const line2 = (language === 'en' && currentText?.line2En) ? currentText.line2En : currentText?.line2;

    return (
      <div style={{ width: '100%', height: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: videoHeight,
            position: 'relative',
            backgroundColor: '#000000',
            overflow: 'hidden',
            borderRadius: '30px',
            minHeight: 0, // Flexbox nesting fix
          }}
        >
          {isVideo && (
            <video
              ref={videoRef}
              autoPlay
              muted={audioSettings.localMediaMuted}
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
                const nextIndex = currentIndex + 1;
                if (nextIndex >= playlist.length) {
                  setPlaylist(shuffleArray(mediaFiles));
                  setCurrentIndex(0);
                } else {
                  setCurrentIndex(nextIndex);
                }
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
                const nextIndex = currentIndex + 1;
                if (nextIndex >= playlist.length) {
                  setPlaylist(shuffleArray(mediaFiles));
                  setCurrentIndex(0);
                } else {
                  setCurrentIndex(nextIndex);
                }
              }}
            />
          )}
        </div>
        {/* Text Area */}
        {(line1 || line2) && (
          <div style={{ marginTop: 12, marginLeft: 8 }}>
            {line1 && (
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', marginBottom: 4 }}>
                {line1}
              </div>
            )}
            {line2 && (
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff' }}>
                {line2}
              </div>
            )}
          </div>
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
      muted
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