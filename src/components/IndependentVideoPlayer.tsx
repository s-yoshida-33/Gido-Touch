// src/components/IndependentVideoPlayer.tsx
import React from 'react';
import { useIndependentVideo } from '../hooks/useIndependentVideo';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { logInfo, logError, logWarn } from '../logs/logging';
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
  
  // Double buffering refs
  const videoRefA = React.useRef<HTMLVideoElement>(null);
  const videoRefB = React.useRef<HTMLVideoElement>(null);
  const [activePlayerId, setActivePlayerId] = React.useState<'A' | 'B'>('A');

  const imgRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Media files list and current index
  const [mediaFiles, setMediaFiles] = React.useState<string[]>([]);
  const [playlist, setPlaylist] = React.useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isLoadingMedia, setIsLoadingMedia] = React.useState(true);
  
  // Override image state
  const [overrideImage, setOverrideImage] = React.useState<string | null>(null);
  const [isOverrideImageLoading, setIsOverrideImageLoading] = React.useState(false);
  
  // Current set src path
  const currentSrcRef = React.useRef<string | null>(null);
  
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
  const lastGoodStateTimeRef = React.useRef<number>(Date.now());

  // Helper to get active/inactive video refs
  const getActiveVideo = () => activePlayerId === 'A' ? videoRefA.current : videoRefB.current;
  const getInactiveVideo = () => activePlayerId === 'A' ? videoRefB.current : videoRefA.current;

  // Helper to format buffered ranges
  const getBufferedRanges = (video: HTMLVideoElement) => {
      try {
          const ranges = [];
          for (let i = 0; i < video.buffered.length; i++) {
              ranges.push(`[${video.buffered.start(i).toFixed(2)}-${video.buffered.end(i).toFixed(2)}]`);
          }
          return ranges.join(', ');
      } catch {
          return 'unknown';
      }
  };

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
      // Filename format: "{shopId}.mp4" (Exact match of shopId)
      // Use loose equality for ID matching to handle string/number mismatch
      const shopFiles = mediaFiles.filter(file => {
        const filename = extractFilename(file);
        const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
        // Use filename directly as ID (no longer splitting by hyphen)
        const idPart = nameWithoutExt;
        return String(idPart) === String(overrideShopId);
      });

      if (shopFiles.length > 0) {
        logInfo('video', `Overriding playlist for shop: ${overrideShopId}`, { count: shopFiles.length });
        
        // Save current state before overriding, if not already saved
        // IMPORTANT: Only save if we are transitioning from a non-override state
        if (savedStateRef.current === null) {
            const activeVideo = getActiveVideo();
            savedStateRef.current = {
            playlist: playlist,
            index: currentIndex,
            currentTime: activeVideo ? activeVideo.currentTime : 0
          };
        }
        
        setPlaylist(shopFiles);
        setCurrentIndex(0);
        setOverrideImage(null); // Clear override image
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
                const activeVideo = getActiveVideo();
                savedStateRef.current = {
                  playlist: playlist,
                  index: currentIndex,
                  currentTime: activeVideo ? activeVideo.currentTime : 0
                };
             }
             setPlaylist([]); // Clear playlist to stop playing previous
          } else {
            // No photo available
            logInfo('video', `No shop photo found for shop: ${overrideShopId}`);
            setOverrideImage(null);
          }
        }
      }
    } else {
      // When override is cleared, restore previous state if available
      setOverrideImage(null);
      
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

  // Double buffering and playback management
  React.useEffect(() => {
    // If we have an override image, do not play video/playlist
    if (overrideImage) {
        // Pause both videos
        const vA = videoRefA.current;
        const vB = videoRefB.current;
        if (vA) vA.pause();
        if (vB) vB.pause();
        return;
    }

    if (playlist.length === 0 || isLoadingMedia) return;

    const currentFile = playlist[currentIndex];
    if (!currentFile) return;

    const isVideo = isVideoFile(currentFile);
    const isImage = isImageFile(currentFile);

    // VIDEO HANDLING WITH DOUBLE BUFFERING
    if (isVideo) {
      const activeVideo = getActiveVideo();
      const inactiveVideo = getInactiveVideo();
      
      // Calculate next file for preloading
      let nextFile = "";
      if (playlist.length > 0) {
          const nextIndex = (currentIndex + 1) % playlist.length;
          nextFile = playlist[nextIndex];
      }

      // Logic to move to next item
      const handleNext = () => {
        // Reset watchdog refs
        lastTimeRef.current = 0;
        freezeCounterRef.current = 0;
        lastHeartbeatTimeRef.current = Date.now();
        lastGoodStateTimeRef.current = Date.now();

        if (playlist.length > 1) {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= playlist.length) {
            // Reached end of playlist
            logInfo('video', 'Playlist cycle completed');
            
            if (overrideShopId) {
               // In override mode, just loop back
               setCurrentIndex(0);
            } else {
               // Normal mode: reshuffle and restart
               setPlaylist(shuffleArray(mediaFiles));
               setCurrentIndex(0);
            }
          } else {
            setCurrentIndex(nextIndex);
          }
          
          // Switch active player for the NEXT render cycle
          // Using callback to ensure we toggle from current state
          setActivePlayerId(prev => prev === 'A' ? 'B' : 'A');
        } else if (playlist.length === 1) {
            // Single file loop - just replay current
            if (activeVideo) {
                activeVideo.currentTime = 0;
                activeVideo.play().catch(e => logError('video', 'Replay failed', { error: e.message }));
            }
        }
      };

      // Playback Logic
      if (activeVideo) {
          // If source changed or not set
          const fileUrl = toFileUrl(currentFile);
          
          // Check if src needs update. 
          // Note: src might be fully qualified or relative, so simple check might fail. 
          // But if we use toFileUrl consistently it should be fine.
          // We check if the current src ends with the filename to be safe against base URL diffs
          const filename = extractFilename(currentFile);
          const srcDecoded = decodeURIComponent(activeVideo.src);
          
          // If the video source doesn't contain the expected filename, or is empty
          if (!activeVideo.src || !srcDecoded.includes(filename)) {
              activeVideo.src = fileUrl;
              activeVideo.load();
              
              // Handle seek if pending
              if (pendingSeekTimeRef.current !== null) {
                activeVideo.currentTime = pendingSeekTimeRef.current;
                pendingSeekTimeRef.current = null;
              }
          }

          // Ensure audio settings
          activeVideo.muted = audioSettings.localMediaMuted;
          // Single video loop handling
          activeVideo.loop = playlist.length === 1; 
          
          const playPromise = activeVideo.play();
          if (playPromise !== undefined) {
              playPromise.catch(e => {
                  // Ignore abort errors caused by swapping
                  if (e.name !== 'AbortError') {
                      logError('video', 'Auto-play failed', { error: e.message, file: currentFile });
                  }
              });
          }

          // Preload Next Video on the Inactive Player
          if (inactiveVideo && nextFile && playlist.length > 1 && isVideoFile(nextFile)) {
              const nextFileUrl = toFileUrl(nextFile);
              const nextFilename = extractFilename(nextFile);
              const nextSrcDecoded = decodeURIComponent(inactiveVideo.src);

              if (!inactiveVideo.src || !nextSrcDecoded.includes(nextFilename)) {
                  inactiveVideo.src = nextFileUrl;
                  inactiveVideo.load(); // Load metadata/data in background
                  inactiveVideo.muted = audioSettings.localMediaMuted; // Prepare mute state
              }
          }
      }

      // Event Listeners
      const onEnded = () => handleNext();
      const onStalled = () => logWarn('video', 'Playback stalled', { file: currentFile });
      
      // Error handling for active video
      const onError = (e: Event) => {
          const target = e.currentTarget as HTMLVideoElement;
          logError('video', 'Video playback error', {
              file: extractFilename(currentFile), // Use extractFilename for better readability
              error: target.error?.message,
              code: target.error?.code,
              readyState: target.readyState,
              networkState: target.networkState,
              currentTime: target.currentTime.toFixed(2),
              duration: target.duration?.toFixed(2),
              buffered: getBufferedRanges(target)
          });
          // Force skip to next
          handleNext();
      };

      if (activeVideo) {
          activeVideo.addEventListener('ended', onEnded);
          activeVideo.addEventListener('stalled', onStalled);
          activeVideo.addEventListener('error', onError);
      }

      // Watchdog implementation (targeting activeVideo)
      const watchdogInterval = setInterval(() => {
        if (!activeVideo) return;
        
        const now = Date.now();
        const currentTime = activeVideo.currentTime;
        const duration = activeVideo.duration;
        const isReady = activeVideo.readyState >= 3;

        // Heartbeat
        if (now - lastHeartbeatTimeRef.current > 60000) {
            if (!activeVideo.paused && !activeVideo.ended && isReady) {
                logInfo('video', 'Playback status: Normal', { 
                    file: extractFilename(currentFile), 
                    currentTime: currentTime.toFixed(1)
                });
            }
            lastHeartbeatTimeRef.current = now;
        }

        // Freeze detection
        if (!activeVideo.paused && !activeVideo.ended) {
            if (isReady) {
                lastGoodStateTimeRef.current = now;
                if (Math.abs(currentTime - lastTimeRef.current) < 0.05) {
                    freezeCounterRef.current++;
                    if (freezeCounterRef.current === 5) {
                        logWarn('video', 'Playback freeze detected', { 
                            file: extractFilename(currentFile),
                            currentTime: currentTime.toFixed(2),
                            readyState: activeVideo.readyState,
                            networkState: activeVideo.networkState,
                            buffered: getBufferedRanges(activeVideo)
                        });
                    }
                    else if (freezeCounterRef.current > 5 && freezeCounterRef.current % 30 === 0) {
                        logWarn('video', 'Playback still frozen', { 
                            file: extractFilename(currentFile),
                            secondsFrozen: freezeCounterRef.current,
                            readyState: activeVideo.readyState,
                            networkState: activeVideo.networkState,
                            buffered: getBufferedRanges(activeVideo)
                        });
                        handleNext(); // Force skip
                    }
                } else {
                    if (freezeCounterRef.current >= 5) {
                        logInfo('video', 'Playback recovered from freeze');
                    }
                    freezeCounterRef.current = 0;
                }
                lastTimeRef.current = currentTime;
            } else {
                // Not ready
                const stuckDuration = now - lastGoodStateTimeRef.current;
                if (stuckDuration > 10000) {
                    logWarn('video', 'Playback stuck in non-ready state', { 
                        file: extractFilename(currentFile),
                        stuckDuration,
                        readyState: activeVideo.readyState,
                        networkState: activeVideo.networkState,
                        buffered: getBufferedRanges(activeVideo)
                    });
                    handleNext();
                    lastGoodStateTimeRef.current = now;
                }
            }
        }

        // Duration check (fallback for missing ended event)
        if (duration && !activeVideo.paused && activeVideo.currentTime >= duration) {
            logWarn('video', 'Duration exceeded without ended event', { file: currentFile });
            handleNext();
        }
      }, 1000);

      return () => {
        clearInterval(watchdogInterval);
        if (activeVideo) {
            activeVideo.removeEventListener('ended', onEnded);
            activeVideo.removeEventListener('stalled', onStalled);
            activeVideo.removeEventListener('error', onError);
        }
      };
    } else if (isImage && imgRef.current) {
      const img = imgRef.current;
      
      // Pause videos if image is showing
      const vA = videoRefA.current;
      const vB = videoRefB.current;
      if (vA && !vA.paused) vA.pause();
      if (vB && !vB.paused) vB.pause();
      
      // Update image src
      if (currentSrcRef.current !== currentFile) {
        img.src = currentFile;
        currentSrcRef.current = currentFile;
      }
      
      // Timer for image display
      const timer = setTimeout(() => {
        if (playlist.length > 1) {
          const nextIndex = currentIndex + 1;
          if (nextIndex >= playlist.length) {
            logInfo('video', 'Playlist cycle completed');
            if (overrideShopId) {
               setCurrentIndex(0);
            } else {
               setPlaylist(shuffleArray(mediaFiles));
               setCurrentIndex(0);
            }
          } else {
            setCurrentIndex(nextIndex);
          }
        }
      }, 15000); // 15 seconds for images
      
      logInfo('video', 'Showing image from local directory', {
        file: currentFile,
      });

      return () => {
        clearTimeout(timer);
      };
    }
  }, [playlist, currentIndex, isLoadingMedia, mediaFiles, audioSettings.localMediaMuted, overrideShopId, overrideImage, activePlayerId]);

  // Handle video settings changes (legacy support)
  React.useEffect(() => {
    // If videoSettings is enabled and has a source, use it instead of local files
    // But ONLY if we are NOT overriding with a shop image and playlist is empty
    if (!overrideImage && videoSettings?.enabled && videoSettings.source && playlist.length === 0) {
      // Use Video A for legacy playback
      if (!videoRefA.current) return;

      const video = videoRefA.current;
      if (video.src !== videoSettings.source) {
        video.src = videoSettings.source;
        logInfo('video', 'Independent video source updated', {
          source: videoSettings.source,
        });
      }

      video.loop = videoSettings.loop;
      video.autoplay = videoSettings.autoplay;
      video.muted = true; // Force mute for legacy/bg mode? or use audioSettings?
    }
  }, [videoSettings, playlist.length, overrideImage]);

  // Memoize text settings calculation
  const currentFile = (playlist.length > 0 && !isLoadingMedia) ? playlist[currentIndex] : null;
  const filename = currentFile ? extractFilename(currentFile) : "";
  
  const { line1: memoLine1, line2: memoLine2 } = React.useMemo(() => {
      if (!filename) return { line1: undefined, line2: undefined };
      const currentText = shops.length > 0 ? getDefaultMediaSettings(filename, shops) : null;
      if (!currentText) return { line1: undefined, line2: undefined };
      const l1 = (language === 'en' && currentText.line1En) ? currentText.line1En : currentText.line1;
      const l2 = (language === 'en' && currentText.line2En) ? currentText.line2En : currentText.line2;
      return { line1: l1, line2: l2 };
  }, [filename, shops, language]);

  // Loading state
  if (isLoading || isLoadingMedia || isOverrideImageLoading) {
    return renderContainer(
      <div style={{ color: '#888', fontSize: 12 }}>Loading…</div>
    );
  }
  
  // Case: Override Image Display
  if (overrideImage) {
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
          '#ffffff', 
          { line1, line2 }
      );
  }

  // Use local media files if available
  if (playlist.length > 0) {
    const isImage = currentFile && isImageFile(currentFile);
    const line1 = memoLine1;
    const line2 = memoLine2;

    const content = (
      <>
        {/* Video Player A */}
        <video
            ref={videoRefA}
            muted={audioSettings.localMediaMuted}
            playsInline
            style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                objectFit: 'cover',
                backgroundColor: '#000000',
                opacity: activePlayerId === 'A' && !isImage ? 1 : 0,
                zIndex: activePlayerId === 'A' ? 2 : 1,
                transition: 'opacity 0.2s ease-in-out', // Smooth transition
                pointerEvents: 'none', // Prevent interaction
            }}
        />
        {/* Video Player B */}
        <video
            ref={videoRefB}
            muted={audioSettings.localMediaMuted}
            playsInline
            style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                objectFit: 'cover',
                backgroundColor: '#000000',
                opacity: activePlayerId === 'B' && !isImage ? 1 : 0,
                zIndex: activePlayerId === 'B' ? 2 : 1,
                transition: 'opacity 0.2s ease-in-out',
                pointerEvents: 'none',
            }}
        />
        {/* Image Player Overlay */}
        {isImage && (
            <img
              ref={imgRef}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 10, // Above videos
                objectFit: 'cover',
                backgroundColor: '#000000',
                display: 'block'
              }}
              onError={(_e) => {
                logError('video', 'Image load error', { file: currentFile });
                // Skip to next
                const nextIndex = currentIndex + 1;
                if (nextIndex >= playlist.length) {
                   if (overrideShopId) setCurrentIndex(0);
                   else { setPlaylist(shuffleArray(mediaFiles)); setCurrentIndex(0); }
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
      <div style={{ color: '#888', fontSize: 12 }}>
        {!videoSettings?.enabled ? 'Video disabled' : 'No media files found'}
      </div>
    );
  }

  // Render video player (legacy mode - uses VideoRefA)
  return renderContainer(
    <video
      ref={videoRefA}
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
      onError={(e) => {
        logError('video', 'Independent video element error', {
          source: videoSettings.source,
          error: e.currentTarget.error?.message,
        });
      }}
    />
  );
};

export default IndependentVideoPlayer;