// src/components/IndependentVideoPlayer.tsx
import React from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useIndependentVideo } from '../hooks/useIndependentVideo';
import { useAudioSettingsContext } from '../contexts/AudioSettingsContext';
import { useMall } from '../contexts/MallContext';
import { logInfo, logError, logWarn, logDebug } from '../logs/logging';
import type { Shop } from '../types/shop';
import { getDefaultMediaSettings } from '../utils/localMediaUtils';
import { getShopImageDataUrl } from '../utils/imageUtils';

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
 * Filter media files to only include those whose shopId matches an active shop.
 * Prevents playback of videos from shops that have left (退店).
 * Files whose filename (without extension) does not match any shop's shopId are excluded.
 */
function filterByActiveShops(files: string[], shops: Shop[]): string[] {
  if (shops.length === 0) return files; // If shops not yet loaded, don't filter
  const filtered = files.filter(file => {
    const filename = extractFilename(file);
    const shopId = filename.replace(/\.[^/.]+$/, "");
    const matched = shops.some(s => String(s.shopId) === String(shopId));
    if (!matched) {
      logWarn('VIDEO', `Skipped local media: shopId not found`, {
        shopId,
        filename,
        file,
      });
    }
    return matched;
  });
  if (filtered.length < files.length) {
    const skippedCount = files.length - filtered.length;
    logInfo('MEDIA_FILTER', `Filtered out ${skippedCount} media file(s) with no matching shop`, {
      total: files.length,
      active: filtered.length,
      skipped: skippedCount,
    });
  }
  return filtered;
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
 * Convert a local file path to an asset protocol URL for Tauri WebView.
 * Uses Tauri's convertFileSrc to generate an asset:// URL.
 */
function toAssetUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:") || filePath.startsWith("asset:")) {
    return filePath;
  }
  // Strip file:// prefix if present
  let cleaned = filePath;
  if (cleaned.startsWith("file:///")) {
    cleaned = cleaned.slice(8);
  } else if (cleaned.startsWith("file://")) {
    cleaned = cleaned.slice(7);
  }
  return convertFileSrc(cleaned);
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
  const { audioSettings } = useAudioSettingsContext();
  const { mallId } = useMall();
  
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
  const [localReload] = React.useState(0);
  
  // Save previous state for override
  const savedStateRef = React.useRef<{ playlist: string[], index: number, currentTime: number } | null>(null);
  
  // Seek wait time
  const pendingSeekTimeRef = React.useRef<number | null>(null);
  
  // Video error retry
  const MAX_RETRY_COUNT = 3;
  const retryCountRef = React.useRef<number>(0);

  // Watchdog refs
  const lastTimeRef = React.useRef<number>(0);
  const freezeCounterRef = React.useRef<number>(0);
  const lastHeartbeatTimeRef = React.useRef<number>(Date.now());
  const lastGoodStateTimeRef = React.useRef<number>(Date.now());

  // Cleanup video elements on unmount to prevent memory leaks from long-running playback
  React.useEffect(() => {
    return () => {
      [videoRefA.current, videoRefB.current].forEach(video => {
        if (video) {
          video.pause();
          video.removeAttribute('src');
          video.load(); // Forces release of media resources
        }
      });
    };
  }, []);

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

  // Mall ID changes are now handled via props/context, no IPC subscription needed
  // The component will re-render when mallId changes in context

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
        logDebug('MEDIA_SWAP', `Overriding playlist for shop: ${overrideShopId}`, { count: shopFiles.length });
        
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
        logWarn('MEDIA_SWAP', `No local media found for shop override: ${overrideShopId}. Trying shop details image.`);
        
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
                   try {
                      const dataUrl = await getShopImageDataUrl(imagePath);
                      if (dataUrl) {
                         setOverrideImage(dataUrl);
                      } else {
                         setOverrideImage(toAssetUrl(imagePath));
                      }
                   } catch (e) {
                      console.error("Failed to load shop image", e);
                      setOverrideImage(toAssetUrl(imagePath));
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
            logWarn('MEDIA_SWAP', `No shop photo found for shop: ${overrideShopId}`);
            setOverrideImage(null);
          }
        }
      }
    } else {
      // When override is cleared, restore previous state if available
      setOverrideImage(null);
      
      if (savedStateRef.current) {
         logDebug('MEDIA_SWAP', 'Restoring playlist from override');
         
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
                 logDebug('MEDIA_SWAP', 'Restored empty playlist but have media files, starting loop');
                 setPlaylist(shuffleArray(filterByActiveShops(mediaFiles, shops)));
                 setCurrentIndex(0);
             }
         }
      } else {
        // If no saved state (meaning we didn't override or just started), 
        // ensure we have a playlist but don't reset if already playing
        if (playlist.length === 0 && mediaFiles.length > 0) {
            // Check legacy video settings
            if (!videoSettings?.enabled || !videoSettings.source) {
               setPlaylist(shuffleArray(filterByActiveShops(mediaFiles, shops)));
               setCurrentIndex(0);
            }
        }
      }
    }
  }, [overrideShopId, mediaFiles]); // 'shops' intentionally omitted to avoid loop

  // Load media files from local directory
  React.useEffect(() => {
    let isMounted = true;

    const loadMediaFiles = async () => {
      try {
        const files = await invoke<string[]>('list_media_files', { mallId });
        
        if (!isMounted) return;

        if (files.length === 0) {
          logWarn('SYS_INIT', 'No media files found in local directory', { mallId });
          setIsLoadingMedia(false);
          return;
        }

        logInfo('SYS_INIT', 'Loaded media files from local directory', {
          count: files.length,
          mallId,
          forceReload,
          localReload
        });

        setMediaFiles(files);
        // Only shuffle and set playlist if NOT in override mode
        if (!overrideShopId) {
            setPlaylist(shuffleArray(filterByActiveShops(files, shops)));
            setCurrentIndex(0);
        }
        
        setIsLoadingMedia(false);
        
      } catch (error: any) {
        logError('SYS_INIT', 'Failed to load media files from local directory', {
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
  }, [forceReload, localReload, mallId]);

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
          const prevPlayer = activePlayerId;
          const nextPlayer = activePlayerId === 'A' ? 'B' : 'A';
          const nextFileObj = playlist[nextIndex >= playlist.length ? 0 : nextIndex];

          // Check if matched with shop data
          const nextFilename = extractFilename(nextFileObj);
          const nextShopId = nextFilename.replace(/\.[^/.]+$/, "");
          const isMatched = shops.some(s => String(s.shopId) === nextShopId || String(s.number) === nextShopId);
          
          // Get next player ready state
          const nextVideoElement = nextPlayer === 'A' ? videoRefA.current : videoRefB.current;
          const nextReadyState = nextVideoElement ? nextVideoElement.readyState : 'null';

          // Reset retry count on successful track change
          retryCountRef.current = 0;

          // Log detailed swap info
          logDebug('MEDIA_SWAP', 'Local media player swapped', {
            activePlayer: nextPlayer,
            fromPlayer: prevPlayer,
            file: nextFilename,
            shopId: nextShopId,
            isMatched,
            readyState: nextReadyState,
            playlistLength: playlist.length
          });

          if (nextIndex >= playlist.length) {
            // Reached end of playlist
            logDebug('MEDIA_SWAP', 'Playlist cycle completed');
            
            if (overrideShopId) {
               // In override mode, just loop back
               setCurrentIndex(0);
            } else {
               // Normal mode: reshuffle and restart
               setPlaylist(shuffleArray(filterByActiveShops(mediaFiles, shops)));
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
                activeVideo.play().catch(e => logError('VIDEO', 'Replay failed', { error: e.message }));
            }
        }
      };

      // Playback Logic
      if (activeVideo) {
          // If source changed or not set
          const fileUrl = toAssetUrl(currentFile);
          
          // Check if src needs update. 
          // Note: src might be fully qualified or relative, so simple check might fail. 
          // But if we use toAssetUrl consistently it should be fine.
          // We check if the current src ends with the filename to be safe against base URL diffs
          const filename = extractFilename(currentFile);
          const srcDecoded = decodeURIComponent(activeVideo.src);
          
          // If the video source doesn't contain the expected filename, or is empty
          if (!activeVideo.src || !srcDecoded.includes(filename)) {
              retryCountRef.current = 0; // Reset retry count on track change
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
                      logError('VIDEO', 'Auto-play failed', { error: e.message, file: currentFile });
                  }
              });
          }

          // Preload Next Video on the Inactive Player
          if (inactiveVideo && nextFile && playlist.length > 1 && isVideoFile(nextFile)) {
              const nextFileUrl = toAssetUrl(nextFile);
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
      const onStalled = () => logWarn('VIDEO', 'Playback stalled', { file: currentFile });
      
      // Error handling for active video with retry
      const onError = (e: Event) => {
          const target = e.currentTarget as HTMLVideoElement;
          const fileName = extractFilename(currentFile);
          logError('VIDEO', 'Video playback error', {
              file: fileName,
              error: target.error?.message,
              code: target.error?.code,
              readyState: target.readyState,
              networkState: target.networkState,
              currentTime: target.currentTime.toFixed(2),
              duration: target.duration?.toFixed(2),
              buffered: getBufferedRanges(target),
              retryCount: retryCountRef.current,
          });

          // Retry before skipping (HW decode errors are often transient)
          if (retryCountRef.current < MAX_RETRY_COUNT) {
              retryCountRef.current += 1;
              logWarn('VIDEO', `Retrying video load (${retryCountRef.current}/${MAX_RETRY_COUNT})`, {
                  file: fileName,
              });
              setTimeout(() => {
                  if (target && target.src) {
                      target.load();
                      target.play().catch(() => {});
                  }
              }, 1000);
          } else {
              logError('VIDEO', 'Max retry count reached, skipping to next', {
                  file: fileName,
                  retryCount: retryCountRef.current,
              });
              retryCountRef.current = 0;
              handleNext();
          }
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
                logInfo('WATCHDOG', 'Playback status: Normal', { 
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
                        logWarn('WATCHDOG', 'Playback freeze detected', { 
                            file: extractFilename(currentFile),
                            playerId: activePlayerId,
                            frozenAt: currentTime.toFixed(2),
                            readyState: activeVideo.readyState,
                            networkState: activeVideo.networkState,
                            buffered: getBufferedRanges(activeVideo)
                        });
                    }
                    else if (freezeCounterRef.current > 30 && freezeCounterRef.current % 30 === 1) {
                        logError('WATCHDOG', 'Force skipping due to extended freeze', { 
                            file: extractFilename(currentFile),
                            secondsFrozen: freezeCounterRef.current,
                            readyState: activeVideo.readyState,
                            networkState: activeVideo.networkState,
                            buffered: getBufferedRanges(activeVideo),
                            action: 'FORCED_NEXT_ITEM'
                        });
                        handleNext(); // Force skip
                    }
                } else {
                    if (freezeCounterRef.current >= 5) {
                        logInfo('WATCHDOG', 'Playback recovered from freeze', {
                            durationFrozen: freezeCounterRef.current
                        });
                    }
                    freezeCounterRef.current = 0;
                }
                lastTimeRef.current = currentTime;
            } else {
                // Not ready
                const stuckDuration = now - lastGoodStateTimeRef.current;
                if (stuckDuration > 10000 && stuckDuration % 10000 < 1000) {
                    logWarn('WATCHDOG', 'Playback stuck in non-ready state', { 
                        file: extractFilename(currentFile),
                        stuckDuration,
                        readyState: activeVideo.readyState,
                        networkState: activeVideo.networkState,
                        buffered: getBufferedRanges(activeVideo)
                    });

                    if (stuckDuration > 30000) {
                         logError('WATCHDOG', 'Force skipping due to stuck readyState', {
                             stuckDuration
                         });
                         handleNext();
                         lastGoodStateTimeRef.current = now;
                    }
                }
            }
        }

        // Duration check (fallback for missing ended event)
        if (duration && !activeVideo.paused && activeVideo.currentTime >= duration) {
            logWarn('WATCHDOG', 'Duration exceeded without ended event', { file: currentFile });
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
            logDebug('MEDIA_SWAP', 'Playlist cycle completed');
            if (overrideShopId) {
               setCurrentIndex(0);
            } else {
               setPlaylist(shuffleArray(filterByActiveShops(mediaFiles, shops)));
               setCurrentIndex(0);
            }
          } else {
            setCurrentIndex(nextIndex);
          }
        }
      }, 15000); // 15 seconds for images
      
      logDebug('MEDIA_SWAP', 'Showing image from local directory', {
        file: currentFile,
      });

      return () => {
        clearTimeout(timer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        logInfo('SYS_INIT', 'Independent video source updated', {
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
                  logError('SHOP_MAP', 'Failed to load override shop image');
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
              onError={() => {
                logError('VIDEO', 'Image load error', { file: currentFile });
                // Skip to next
                const nextIndex = currentIndex + 1;
                if (nextIndex >= playlist.length) {
                   if (overrideShopId) setCurrentIndex(0);
                   else { setPlaylist(shuffleArray(filterByActiveShops(mediaFiles, shops))); setCurrentIndex(0); }
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
        logError('VIDEO', 'Independent video element error', {
          source: videoSettings.source,
          error: e.currentTarget.error?.message,
        });
      }}
    />
  );
};

export default IndependentVideoPlayer;
