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

/**
 * Build image path using shop_id if photo is relative or filename only
 * Copied from ShopListScreen.tsx for consistency
 */
function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) return "";
  
  if (photo.match(/^[A-Za-z]:[\\/]/)) return photo;
  if (photo.startsWith("file://") || photo.startsWith("http://") || photo.startsWith("https://") || photo.startsWith("data:")) return photo;
  
  if (photo.startsWith("/") || photo.startsWith("\\")) {
    if (photo.startsWith("\\\\")) return photo;
    if (photo.startsWith("/")) return photo;
  }
  
  if (shopId) {
    if (photo.includes(`shop/${shopId}/`) || photo.includes(`shop\\${shopId}\\`) ||
        photo.includes(`files/shop/${shopId}/`) || photo.includes(`files\\shop\\${shopId}\\`)) {
      return photo;
    }
    
    const normalizedPhoto = photo.replace(/\\/g, "/");
    const cleanPhoto = normalizedPhoto.startsWith("/") ? normalizedPhoto.slice(1) : normalizedPhoto;
    
    if (!cleanPhoto.includes("/")) {
      return `files/shop/${shopId}/${cleanPhoto}`;
    }
    
    if (shopId) {
        return `files/shop/${shopId}/${cleanPhoto}`;
    }
    return photo;
  }
  return photo;
}

/**
 * Convert a local file path to a file:// URL for Electron
 */
function toFileUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("file://") || filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:")) {
    return filePath;
  }
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.match(/^[A-Za-z]:\//)) {
    return `file:///${normalized}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  return `file:///${normalized}`;
}

interface IndependentVideoPlayerProps {
  forceReload?: number;
  videoHeight?: string | number;
  language?: "ja" | "en";
  shops?: Shop[];
  overrideShopId?: string | null;
}

const IndependentVideoPlayer: React.FC<IndependentVideoPlayerProps> = ({ 
  forceReload = 0,
  videoHeight = '100%',
  language = "ja",
  shops = [],
  overrideShopId = null,
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
  
  // Override image state
  const [overrideImage, setOverrideImage] = React.useState<string | null>(null);
  const [isOverrideImageLoading, setIsOverrideImageLoading] = React.useState(false);
  
  // Local reload trigger for when mall ID changes
  const [localReload, setLocalReload] = React.useState(0);
  
  // Save previous state for override
  const savedStateRef = React.useRef<{ playlist: string[], index: number, currentTime: number } | null>(null);
  
  // Seek wait time
  const pendingSeekTimeRef = React.useRef<number | null>(null);
  
  // Watchdog refs
  const lastTimeRef = React.useRef<number>(0);
  const freezeCounterRef = React.useRef<number>(0);
  const lastHeartbeatTimeRef = React.useRef<number>(Date.now());

  // Current set src path
  const currentSrcRef = React.useRef<string | null>(null);

  // Helper to render consistent container
  const renderContainer = (
    content: React.ReactNode, 
    bgColor: string = '#000000', 
    textInfo?: { line1?: string, line2?: string }
  ) => (
    <div style={{ width: '100%', height: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: videoHeight,
          position: 'relative',
          backgroundColor: bgColor,
          overflow: 'hidden',
          borderRadius: '30px',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {content}
      </div>
      {/* Text Area - Always render fixed height container to prevent layout shift */}
      <div style={{ 
          marginTop: 12, 
          marginLeft: 8,
          height: '72px', // Fixed height for 2 lines of text (approx) to prevent jumping
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          flexShrink: 0
        }}>
        {(textInfo?.line1 || textInfo?.line2) ? (
          <>
            {textInfo.line1 && (
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#ffffff', marginBottom: 4, lineHeight: '1.2' }}>
                {textInfo.line1}
              </div>
            )}
            {textInfo.line2 && (
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffffff', lineHeight: '1.2' }}>
                {textInfo.line2}
              </div>
            )}
          </>
        ) : (
             // Invisible placeholder to maintain height
             <div style={{ visibility: 'hidden' }}>
               <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: 4, lineHeight: '1.2' }}>&nbsp;</div>
               <div style={{ fontSize: '24px', fontWeight: 'bold', lineHeight: '1.2' }}>&nbsp;</div>
             </div>
        )}
      </div>
    </div>
  );

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

  // Update playlist when overrideShopId changes
  React.useEffect(() => {
    // Note: This effect runs when overrideShopId changes OR when mediaFiles changes.
    // This allows us to re-check for media files if they load after the shop is selected.

    if (overrideShopId) {
      // 1. Try to find local media files for the specific shop
      // Filename format: "{shopId}.mp4" or "{shopId}-1.jpg" etc.
      // Use loose equality for ID matching to handle string/number mismatch
      const shopFiles = mediaFiles.filter(file => {
        const filename = extractFilename(file);
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        const idPart = nameWithoutExt.split('-')[0];
        return String(idPart) === String(overrideShopId);
      });

      if (shopFiles.length > 0) {
        logInfo('video', `Overriding playlist for shop: ${overrideShopId}`, { count: shopFiles.length });
        
        // Save current state before overriding, if not already saved
        // IMPORTANT: Only save if we are transitioning from a non-override state
        if (savedStateRef.current === null) {
          savedStateRef.current = {
            playlist: playlist,
            index: currentIndex,
            currentTime: videoRef.current ? videoRef.current.currentTime : 0
          };
        }
        
        setPlaylist(shopFiles);
        setCurrentIndex(0);
        setOverrideImage(null); // Clear override image
        currentSrcRef.current = null; // Force reset src ref
      } else {
        logInfo('video', `No local media found for shop override: ${overrideShopId}. Trying shop details image.`);
        
        // 2. If no local media, try to load shop image
        // Find shop using loose equality
        const shop = shops.find(s => String(s.shopId || s.number) === String(overrideShopId));
        
        if (shop) {
          // Use photo2 (Brand Image) or photo1
          const photoToUse = shop.photo2 || shop.photo1; 
          
          if (photoToUse) {
             const loadShopImage = async () => {
                setIsOverrideImageLoading(true);
                const imagePath = buildImagePath(photoToUse, overrideShopId);
                
                if (imagePath) {
                   const electronAPI = window.electronAPI;
                   if (electronAPI && electronAPI.getShopImage) {
                      try {
                         const dataUrl = await electronAPI.getShopImage(imagePath);
                         if (dataUrl) {
                            setOverrideImage(dataUrl);
                         } else {
                            setOverrideImage(toFileUrl(imagePath));
                         }
                      } catch (e) {
                         console.error("Failed to load shop image", e);
                         setOverrideImage(toFileUrl(imagePath));
                      }
                   } else {
                      setOverrideImage(toFileUrl(imagePath));
                   }
                }
                setIsOverrideImageLoading(false);
             };
             loadShopImage();
             
             // Save state if needed
             if (savedStateRef.current === null) {
                savedStateRef.current = {
                  playlist: playlist,
                  index: currentIndex,
                  currentTime: videoRef.current ? videoRef.current.currentTime : 0
                };
             }
             setPlaylist([]); // Clear playlist to stop playing previous
             currentSrcRef.current = null; // Force reset src ref to ensure restoration later works
          } else {
            // No photo available
            logInfo('video', `No shop photo found for shop: ${overrideShopId}`);
            setOverrideImage(null);
            currentSrcRef.current = null; 
          }
        }
      }
    } else {
      // When override is cleared, restore previous state if available
      setOverrideImage(null);
      currentSrcRef.current = null; // Force reset src ref to ensure restoration works
      
      if (savedStateRef.current) {
         logInfo('video', 'Restoring playlist from override');
         
         const restoredPlaylist = savedStateRef.current.playlist;
         setPlaylist(restoredPlaylist);
         setCurrentIndex(savedStateRef.current.index);
         // Set pending seek time
         pendingSeekTimeRef.current = savedStateRef.current.currentTime;
         
         savedStateRef.current = null;
         
         // Fix: If we restored an empty playlist (maybe because mediaFiles weren't loaded when we started override),
         // but now we have mediaFiles, we should restart the loop!
         if (restoredPlaylist.length === 0 && mediaFiles.length > 0) {
             // However, only do this if we aren't supposed to be playing videoSettings (legacy)
             // If videoSettings is enabled, empty playlist allows fallback to it.
             // If videoSettings is NOT enabled, we should play mediaFiles.
             if (!videoSettings?.enabled || !videoSettings.source) {
                 logInfo('video', 'Restored empty playlist but have media files, starting loop');
                 setPlaylist(shuffleArray(mediaFiles));
                 setCurrentIndex(0);
             }
         }
      } else {
        // If no saved state (meaning we didn't override or just started), 
        // ensure we have a playlist but don't reset if already playing
        if (playlist.length === 0 && mediaFiles.length > 0) {
            // Check legacy video settings
            if (!videoSettings?.enabled || !videoSettings.source) {
               setPlaylist(shuffleArray(mediaFiles));
               setCurrentIndex(0);
            }
        }
      }
    }
  }, [overrideShopId, mediaFiles]); // Removed 'shops' from deps to avoid loop

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
        // Only shuffle and set playlist if NOT in override mode
        if (!overrideShopId) {
            setPlaylist(shuffleArray(files));
            setCurrentIndex(0);
        }
        
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
    // If we have an override image, do not play video/playlist
    if (overrideImage) return;

    if (playlist.length === 0 || isLoadingMedia) return;

    const currentFile = playlist[currentIndex];
    if (!currentFile) return;

    const isVideo = isVideoFile(currentFile);
    const isImage = isImageFile(currentFile);

    if (isVideo && videoRef.current) {
      const video = videoRef.current;
      
      // Helper for moving to next video
      const handleNext = () => {
        // Reset watchdog refs
        lastTimeRef.current = 0;
        freezeCounterRef.current = 0;
        lastHeartbeatTimeRef.current = Date.now();

        if (playlist.length > 1) {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= playlist.length) {
            // Reached end of playlist
            logInfo('video', 'Playlist cycle completed');
            
            if (overrideShopId) {
               // In override mode, just loop back to start without reshuffling all files
               setCurrentIndex(0);
            } else {
               // Normal mode: reshuffle and restart
               setPlaylist(shuffleArray(mediaFiles));
               setCurrentIndex(0);
            }
          } else {
            setCurrentIndex(nextIndex);
          }
        } else if (playlist.length === 1) {
            // Force replay for single file
            video.currentTime = 0;
            video.play().catch(e => {
                logError('video', 'Single file replay failed', { error: e.message });
            });
        }
      };

      // Only update src if it changed
      // Also update if currentSrcRef is null (force update after restore)
      if (currentSrcRef.current !== currentFile) {
        video.src = currentFile;
        currentSrcRef.current = currentFile;
        
        // Explicitly load to ensure readiness
        video.load();
        
        // Use audio settings for mute state (default: unmute/false)
        video.muted = audioSettings.localMediaMuted;
        // If only one file, use native loop. Otherwise handle looping manually
        video.loop = playlist.length === 1;
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                logError('video', 'Auto-play failed', { error: e.message, file: currentFile });
                // If auto-play fails, we might want to skip to next or retry
                // But typically user interaction is needed for some play failures.
                // In kiosk mode, we just log.
            });
        }

        // Reset watchdog refs on new src
        lastTimeRef.current = 0;
        freezeCounterRef.current = 0;
        lastHeartbeatTimeRef.current = Date.now();
      }
      
      const handleEnded = () => {
        handleNext();
      };
      
      // Freeze detection (Watchdog)
      // If video is not paused but time isn't advancing, or duration passed without ended event
      const watchdogInterval = setInterval(() => {
        if (!video) return;
        
        const now = Date.now();
        const currentTime = video.currentTime;
        const duration = video.duration;

        // Heartbeat: Log "playing" status every 60 seconds if playing normally
        if (now - lastHeartbeatTimeRef.current > 60000) {
            if (!video.paused && !video.ended && video.readyState >= 3) {
                logInfo('video', 'Playback status: Normal', { 
                    file: extractFilename(currentFile), 
                    currentTime: currentTime.toFixed(1),
                    duration: duration ? duration.toFixed(1) : 'unknown'
                });
            }
            lastHeartbeatTimeRef.current = now;
        }

        // Freeze detection logic
        if (!video.paused && !video.ended && video.readyState >= 3) {
            // Check if time advanced
            if (Math.abs(currentTime - lastTimeRef.current) < 0.05) { // 0.05s tolerance
                freezeCounterRef.current++;
                
                // If frozen for 5 checks (5 seconds)
                if (freezeCounterRef.current === 5) {
                    logWarn('video', 'Playback freeze detected', {
                        file: extractFilename(currentFile),
                        currentTime: currentTime.toFixed(2),
                        lastTime: lastTimeRef.current.toFixed(2)
                    });
                }
                // If still frozen, log periodically (every 30s)
                else if (freezeCounterRef.current > 5 && freezeCounterRef.current % 30 === 0) {
                    logWarn('video', 'Playback still frozen', { 
                        file: extractFilename(currentFile),
                        secondsFrozen: freezeCounterRef.current 
                    });
                }
            } else {
                // Time advanced, reset counter
                if (freezeCounterRef.current >= 5) {
                    logInfo('video', 'Playback recovered from freeze');
                }
                freezeCounterRef.current = 0;
            }
            lastTimeRef.current = currentTime;
        }

        // If we are close to the end (within 0.5s) and not paused, but ended event didn't fire
        if (video.duration && !video.paused) {
            const timeLeft = video.duration - video.currentTime;
            if (timeLeft < 0.5 && timeLeft >= 0) {
                 // Check if we are stuck here?
                 // Or just force next if we are extremely close to end.
                 // Let's rely on time update check below.
            }
            
            // Check if duration exceeded (some players glitch and go past duration)
            if (video.currentTime >= video.duration) {
                logWarn('video', 'Duration exceeded without ended event, forcing next', { file: currentFile });
                handleNext();
            }
        }
      }, 1000);
      
      // Stalled event: media data is not available
      const handleStalled = () => {
         logWarn('video', 'Playback stalled event received', { file: extractFilename(currentFile) });
      };

      if (playlist.length > 1) {
        video.addEventListener('ended', handleEnded);
      }
      video.addEventListener('stalled', handleStalled);
      
      logInfo('video', 'Playing video from local directory', {
        index: currentIndex,
        total: playlist.length,
        file: currentFile,
      });

      return () => {
        clearInterval(watchdogInterval);
        if (playlist.length > 1) {
          video.removeEventListener('ended', handleEnded);
        }
        video.removeEventListener('stalled', handleStalled);
      };
    } else if (isImage && imgRef.current) {
      const img = imgRef.current;
      
      // Only update src if it changed
      if (currentSrcRef.current !== currentFile) {
        img.src = currentFile;
        currentSrcRef.current = currentFile;
      }
      
      // For images, show for 15 seconds then move to next (or loop if only one)
      const timer = setTimeout(() => {
        if (playlist.length > 1) {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= playlist.length) {
            // Reached end of playlist
            logInfo('video', 'Playlist cycle completed');
            
            if (overrideShopId) {
               // In override mode, just loop back to start without reshuffling all files
               setCurrentIndex(0);
            } else {
               // Normal mode: reshuffle and restart
               setPlaylist(shuffleArray(mediaFiles));
               setCurrentIndex(0);
            }
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
  }, [playlist, currentIndex, isLoadingMedia, mediaFiles, audioSettings.localMediaMuted, overrideShopId, overrideImage]);

  // Handle video settings changes (legacy support)
  React.useEffect(() => {
    // If videoSettings is enabled and has a source, use it instead of local files
    // But ONLY if we are NOT overriding with a shop image
    if (!overrideImage && videoSettings?.enabled && videoSettings.source && playlist.length === 0) {
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
  }, [videoSettings, playlist.length, overrideImage]);

  // Handle audio settings updates dynamically
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = audioSettings.localMediaMuted;
    }
  }, [audioSettings.localMediaMuted]);

  // Loading state
  if (isLoading || isLoadingMedia || isOverrideImageLoading) {
    return renderContainer(
      <div
        style={{
          color: '#888',
          fontSize: 12,
        }}
      >
        Loading…
      </div>
    );
  }
  
  // Case: Override Image Display
  if (overrideImage) {
      // Calculate text settings for ticker using default logic
      const currentText = overrideShopId ? getDefaultMediaSettings(`${overrideShopId}.dummy`, shops) : null;
      const line1 = (language === 'en' && currentText?.line1En) ? currentText.line1En : currentText?.line1;
      const line2 = (language === 'en' && currentText?.line2En) ? currentText.line2En : currentText?.line2;

      return renderContainer(
          <img 
              src={overrideImage}
              alt="Shop Detail"
              draggable={false}
              style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain', 
                  display: 'block'
              }}
              onError={(e) => {
                  logError('video', 'Failed to load override shop image');
                  e.currentTarget.style.display = 'none';
              }}
          />,
          '#ffffff', // White background
          { line1, line2 }
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

    const content = (
      <>
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
                const nextIndex = currentIndex + 1;
                if (nextIndex >= playlist.length) {
                  if (overrideShopId) {
                     setCurrentIndex(0);
                  } else {
                     setPlaylist(shuffleArray(mediaFiles));
                     setCurrentIndex(0);
                  }
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
                logError('video', 'Image load error', { file: currentFile });
                const nextIndex = currentIndex + 1;
                if (nextIndex >= playlist.length) {
                  if (overrideShopId) {
                     setCurrentIndex(0);
                  } else {
                     setPlaylist(shuffleArray(mediaFiles));
                     setCurrentIndex(0);
                  }
                } else {
                  setCurrentIndex(nextIndex);
                }
              }}
            />
        )}
      </>
    );

    return renderContainer(content, '#000000', { line1, line2 });
  }

  // Fallback to videoSettings if no local files (legacy support)
  if (!videoSettings || !videoSettings.enabled || !videoSettings.source) {
    return renderContainer(
      <div
        style={{
          color: '#888',
          fontSize: 12,
        }}
      >
        {!videoSettings?.enabled ? 'Video disabled' : 'No media files found'}
      </div>
    );
  }

  // Render video player (legacy mode)
  return renderContainer(
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
      onLoadedMetadata={() => {
        if (pendingSeekTimeRef.current !== null && videoRef.current) {
          logInfo('video', 'Restoring playback position', { time: pendingSeekTimeRef.current });
          videoRef.current.currentTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
        }
      }}
      onError={(e) => {
        logError('video', 'Independent video element error', {
          source: videoSettings.source,
          error: e.currentTarget.error?.message,
        });
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
