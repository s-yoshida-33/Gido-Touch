// src/screens/ShopListScreen.tsx
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import VerticalVideoSlot from "../components/VerticalVideoSlot";
import IndependentVideoPlayer from "../components/IndependentVideoPlayer";
import button1F from "../assets/button-1F.svg";
import button2F from "../assets/button-2F.svg";
import button3F from "../assets/button-3F.svg";
import button1FHighlight from "../assets/button-1F-highlight.svg";
import button2FHighlight from "../assets/button-2F-highlight.svg";
import button3FHighlight from "../assets/button-3F-highlight.svg";
import buttonPrevHighlight from "../assets/button-prev-highlight.svg";
import buttonNextHighlight from "../assets/button-next-highlight.svg";
import iconCurrentFloor from "../assets/icon-current-floor.svg";
import selectLanguageSelectedEn from "../assets/select-language-selected-en.svg";
import selectLanguageSelectedJp from "../assets/select-language-selected-jp.svg";
import openTime from "../assets/open-time.svg";
import prev from "../assets/button-prev.svg";
import next from "../assets/button-next.svg";
import { fetchShops } from "../repositories/shopRepository";
import { sseClient } from "../api/sseClient";
import type { Shop } from "../types/shop";
import ShopDetailScreen from "./ShopDetailScreen";
import { LanguageSelectModal } from "../components/LanguageSelectModal";
import type { LocationIconSettingsPerFloor } from "../types/locationIcon";

/**
 * Build image path using shop_id if photo is relative or filename only
 * Expected full path format: C:\Users\...\AppData\Roaming\TTI\BridgeWebPopper\files\shop\{shop_id}\photo2.png
 */
function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) {
    // If no photo but shop_id is available, try to build path from shop_id
    if (shopId) {
      // This is a fallback - API should provide photo, but if not, we can try to construct it
      // However, we don't know the base path, so return empty
      return "";
    }
    return "";
  }
  
  // If already a full path (contains drive letter like C:\), return as is
  if (photo.match(/^[A-Za-z]:[\\/]/)) {
    return photo;
  }
  
  // If already a URL (file://, http://, https://, or data:), return as is
  if (photo.startsWith("file://") || 
      photo.startsWith("http://") || 
      photo.startsWith("https://") ||
      photo.startsWith("data:")) {
    return photo;
  }
  
  // If starts with absolute path markers (/, \), might be absolute path
  // But without drive letter, it's likely a Unix-style path or network path
  if (photo.startsWith("/") || photo.startsWith("\\")) {
    // Check if it looks like a Windows network path (\\server\share)
    if (photo.startsWith("\\\\")) {
      return photo;
    }
    // For Unix-style absolute paths, return as is
    if (photo.startsWith("/")) {
      return photo;
    }
  }
  
  // If shop_id is available and photo is relative or filename only, build path
  if (shopId) {
    // Check if photo already contains shop_id in path (e.g., "shop/31/photo2.png" or "files/shop/31/photo2.png")
    if (photo.includes(`shop/${shopId}/`) || photo.includes(`shop\\${shopId}\\`) ||
        photo.includes(`files/shop/${shopId}/`) || photo.includes(`files\\shop\\${shopId}\\`)) {
      return photo;
    }
    
    // Normalize path separators
    const normalizedPhoto = photo.replace(/\\/g, "/");
    // Remove leading slash if present
    const cleanPhoto = normalizedPhoto.startsWith("/") ? normalizedPhoto.slice(1) : normalizedPhoto;
    
    // If it's just a filename (no path separators), build full path
    if (!cleanPhoto.includes("/")) {
      return `files/shop/${shopId}/${cleanPhoto}`;
    }
    
    // If it's a relative path, prepend shop_id folder
    // But check if it already starts with files/shop
    if (cleanPhoto.startsWith("files/shop/")) {
      return cleanPhoto;
    }
    return `files/shop/${shopId}/${cleanPhoto}`;
  }
  
  return photo;
}

/**
 * Shop image component that loads images via Electron IPC or falls back to file:// URL
 */
const ShopImage: React.FC<{ photo: string | undefined; shopId: string | undefined }> = ({ photo, shopId }) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!photo) {
      setIsLoading(false);
      return;
    }

    const loadImage = async () => {
      const imagePath = buildImagePath(photo, shopId);
      if (!imagePath) {
        setIsLoading(false);
        return;
      }

      // Check if we're in Electron environment
      const electronAPI = window.electronAPI;
      if (electronAPI && electronAPI.getShopImage) {
        try {
          // Use Electron IPC to load image as data URL
          const dataUrl = await electronAPI.getShopImage(imagePath);
          if (dataUrl) {
            setImageUrl(dataUrl);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Failed to load image via IPC:", error);
        }
      }

      // Fallback to file:// URL (works in Electron, not in browser)
      const fileUrl = toFileUrl(imagePath);
      setImageUrl(fileUrl);
      setIsLoading(false);
    };

    loadImage();
  }, [photo, shopId]);

  if (!photo || (!imageUrl && !isLoading)) {
    return (
      <span style={{ color: "#000000", fontSize: "24px", fontWeight: 700 }}>
        Image
      </span>
    );
  }

  if (isLoading) {
    return null;
  }

  return (
    <img
      src={imageUrl}
      alt=""
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
        userSelect: "none",
        pointerEvents: "auto",
        display: isLoading ? "none" : "block",
      }}
      onError={(e) => {
        // Fallback to placeholder if image fails to load
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
        if (target.parentElement) {
          target.parentElement.style.backgroundColor = "#FFFFFF";
          target.parentElement.style.color = "#000000";
          target.parentElement.style.fontSize = "24px";
          target.parentElement.style.fontWeight = "700";
          target.parentElement.textContent = "Image";
        }
      }}
    />
  );
};

/**
 * Shop name display component that scales text to fit width
 */
const ShopNameDisplay: React.FC<{ name: string }> = ({ name }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      
      if (textWidth > containerWidth) {
        const scale = containerWidth / textWidth;
        textRef.current.style.transform = `scaleX(${Math.max(scale, 0.5)})`;
      } else {
        textRef.current.style.transform = "scaleX(1)";
      }
    }
  }, [name]);

  return (
    <div
      ref={containerRef}
      style={{
        fontSize: "24px",
        fontWeight: 700,
        lineHeight: "1.4",
        width: "100%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        transformOrigin: "left center",
      }}
    >
      <div
        ref={textRef}
        style={{
          display: "inline-block",
          transform: "scaleX(1)",
          whiteSpace: "nowrap",
          transformOrigin: "left center",
        }}
      >
        {name}
      </div>
    </div>
  );
};

/**
 * Convert a local file path to a file:// URL for Electron
 */
function toFileUrl(filePath: string): string {
  if (!filePath) return "";
  
  // If already a URL (file://, http://, https://, or data:), return as is
  if (filePath.startsWith("file://") || 
      filePath.startsWith("http://") || 
      filePath.startsWith("https://") ||
      filePath.startsWith("data:")) {
    return filePath;
  }
  
  // Convert Windows backslashes to forward slashes
  const normalized = filePath.replace(/\\/g, "/");
  
  // Add file:// protocol
  // For Windows absolute paths (C:/...), use file:///C:/...
  if (normalized.match(/^[A-Za-z]:\//)) {
    return `file:///${normalized}`;
  }
  
  // For paths starting with /, use file://
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  
  // For relative paths, use file:///
  return `file:///${normalized}`;
}

/**
 * Normalize floor value to standard format (e.g., "1" -> "1F", "1F" -> "1F")
 */
function normalizeFloor(value: string): string {
  if (!value) return "";
  const m = value.match(/(\d+)/);
  return m ? `${m[1]}F` : value;
}

interface ShopListScreenProps {
  currentFloorSetting: string;
  locationIconSettings: LocationIconSettingsPerFloor;
}

/**
 * Shop list screen
 * Screen size: 3840×2160
 * Background: Black
 * Shop list area: 2640×2160 (left side)
 * Shop list area background: #FDE7C6
 * Action space: 1140×2160 (right side)
 * Action space background: Black
 */
const ShopListScreen: React.FC<ShopListScreenProps> = ({ currentFloorSetting, locationIconSettings }) => {
  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag scroll state
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  // Shop data state
  const [shops, setShops] = useState<Shop[]>([]);
  const shopsRef = useRef<Shop[]>([]); // Keep track of shops for error handling

  useEffect(() => {
    shopsRef.current = shops;
  }, [shops]);

  const [error, setError] = useState<string | null>(null);
  
  // Floor filter state
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  
  // Selected shop for detail modal
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  // Scroll position state for navigation buttons
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [canScroll, setCanScroll] = useState(false);

  // Force reload trigger state
  const [refreshTrigger, _setRefreshTrigger] = useState(0);

  // Idle timeout state (30 seconds for testing)
  const IDLE_TIMEOUT_MS = 30 * 1000; // 30 seconds
  const lastActivityTimeRef = useRef<number>(Date.now());

  // Language select modal state
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const languageButtonRef = useRef<HTMLDivElement>(null);
  
  // Ref to track active touch on floor buttons to prevent multi-touch highlighting
  const activeTouchRef = useRef<string | null>(null);

  // Fade overlay state for idle timeout
  const [isFadeActive, setIsFadeActive] = useState(false);
  const isResettingRef = useRef(false);

  // Helper to handle floor selection
  const handleFloorSelect = (floor: string) => {
    // Close modal if open
    if (selectedShop) {
      setSelectedShop(null);
    }
    // If same floor is selected, deselect (show all shops)
    // Otherwise, select the clicked floor
    if (selectedFloor === floor) {
      setSelectedFloor(null);
    } else {
      setSelectedFloor(floor);
    }
  };
  
  // Get selected language from localStorage (default to Japanese)
  const getSelectedLanguage = (): "ja" | "en" => {
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("gido-selected-language");
      if (saved === "en" || saved === "ja") {
        return saved;
      }
    }
    // Default to Japanese and save to localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("gido-selected-language", "ja");
    }
    return "ja"; // Default to Japanese
  };
  
  const [selectedLanguage, setSelectedLanguageState] = useState<"ja" | "en">(() => getSelectedLanguage());
  
  // Wrapper to save to localStorage when language changes
  const setSelectedLanguage = (lang: "ja" | "en") => {
    setSelectedLanguageState(lang);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem("gido-selected-language", lang);
    }
  };

  // State refs for idle check (to access current state in interval)
  const selectedShopRef = useRef(selectedShop);
  const selectedFloorRef = useRef(selectedFloor);
  const selectedLanguageRef = useRef(selectedLanguage);
  const isLanguageModalOpenRef = useRef(isLanguageModalOpen);

  useEffect(() => {
    selectedShopRef.current = selectedShop;
    selectedFloorRef.current = selectedFloor;
    selectedLanguageRef.current = selectedLanguage;
    isLanguageModalOpenRef.current = isLanguageModalOpen;
  }, [selectedShop, selectedFloor, selectedLanguage, isLanguageModalOpen]);

  // Initialize language to Japanese on mount (force reset to Japanese)
  useEffect(() => {
    // Always set to Japanese on mount to ensure default is Japanese
    if (typeof window !== "undefined" && window.localStorage) {
      const saved = localStorage.getItem("gido-selected-language");
      // If language is not Japanese, reset to Japanese
      if (saved !== "ja") {
        setSelectedLanguage("ja");
      } else if (selectedLanguage !== "ja") {
        // Sync state if localStorage is Japanese but state is not
        setSelectedLanguageState("ja");
      }
    }
  }, []); // Run only on mount

  // Fetch shops from API
  useEffect(() => {
    let cancelled = false;

    const loadShops = async (forceReload: boolean = false) => {
      try {
        const data = await fetchShops({ forceReload });
        if (cancelled) return;

        // Check for empty data (likely due to API update in progress)
        if (data.length === 0 && shopsRef.current.length > 0) {
          throw new Error("API returned 0 shops");
        }

        // Filter shops: only "飲食店・食品" or "グルメ" genre
        const filtered = data.filter((shop) => shop.genre === "飲食店・食品" || shop.genre === "グルメ");

        // Exclude "イオン堺北花田店"
        const excluded = filtered.filter((shop) => !(shop.name || "").includes("イオン堺北花田店"));

        // Clean shop names (remove furigana in brackets)
        const cleaned = excluded.map((s) => ({
          ...s,
          name: (s.name || "").replace(/【.*?】/g, "").trim(),
        }));

        // Load shop positions and merge with shop data
        const api = window.electronAPI;
        if (api && api.getShopPositions) {
          try {
            const shopPositions = await api.getShopPositions();
            const shopsWithPositions = cleaned.map((shop) => {
              if (shop.shopId && shopPositions.positions[shop.shopId]) {
                return {
                  ...shop,
                  position: shopPositions.positions[shop.shopId],
                };
              }
              return shop;
            });
            setShops(shopsWithPositions);
          } catch (e) {
            console.error("Failed to load shop positions:", e);
            setShops(cleaned);
          }
        } else {
          setShops(cleaned);
        }

        setError(null);
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;

        // If we already have shops, don't show error screen, just keep retrying
        if (shopsRef.current.length === 0) {
          const message = e?.message ?? "failed to load";
          setError(message);
        } else {
          console.warn("[ShopListScreen] API Error but keeping existing data:", e);
        }
      }
    };

    loadShops(false);

    // Subscribe to SSE events for real-time updates
    const unsubscribeUpdate = sseClient.on('update', () => {
      console.log('[ShopListScreen] SSE update received, reloading shops...');
      loadShops(true);
    });

    const unsubscribeConnected = sseClient.on('connected', () => {
      console.log('[ShopListScreen] SSE connected, reloading shops...');
      loadShops(true);
    });

    return () => {
      cancelled = true;
      unsubscribeUpdate();
      unsubscribeConnected();
    };
  }, []);

  // ショップ位置情報の更新を監視
  useEffect(() => {
    const api = window.electronAPI;
    if (!api || !api.onShopPositionsUpdated) return;

    const unsubscribe = api.onShopPositionsUpdated(async (updatedPositions) => {
      // 位置情報が更新されたら、ショップデータを再読み込み
      try {
        const shopPositions = updatedPositions;
        setShops((prevShops) => {
          return prevShops.map((shop) => {
            const shopId = shop.shopId || shop.number;
            if (shopId && shopPositions.positions[shopId]) {
              return {
                ...shop,
                position: shopPositions.positions[shopId],
              };
            }
            return shop;
          });
        });
      } catch (e) {
        console.error("Failed to update shop positions:", e);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Idle timeout: Refresh to default shop list after 30 seconds of inactivity
  // Always active - any touch/activity resets the timer
  useEffect(() => {
    // Always reset activity time on mount
    lastActivityTimeRef.current = Date.now();

    // Throttle activity handler to avoid too frequent updates
    let throttleTimeout: number | null = null;
    const handleActivity = () => {
      if (throttleTimeout === null) {
        lastActivityTimeRef.current = Date.now();
        throttleTimeout = window.setTimeout(() => {
          throttleTimeout = null;
        }, 1000); // Throttle to once per second
      }
    };

    // Listen to various user activities (including scroll)
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'keydown', 'wheel'];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Also listen to scroll events on the scroll container
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleActivity, { passive: true });
    }

    // Check idle timeout every second
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTimeRef.current;

      if (timeSinceLastActivity >= IDLE_TIMEOUT_MS) {
        // Check if already in default state to avoid unnecessary refresh/fade
        const isDefaultState =
          selectedShopRef.current === null &&
          selectedFloorRef.current === null &&
          selectedLanguageRef.current === "ja" &&
          isLanguageModalOpenRef.current === false &&
          (scrollContainerRef.current ? scrollContainerRef.current.scrollLeft < 5 : true);

        if (isDefaultState) {
          // Already in default state, just reset timer to avoid loop
          lastActivityTimeRef.current = Date.now();
          return;
        }

        if (!isResettingRef.current) {
          // Start fade out
          isResettingRef.current = true;
          console.log('[ShopListScreen] Idle timeout: Starting fade out');
          setIsFadeActive(true);

          // Wait for fade out (1 second), then reset state
          setTimeout(() => {
            // 30 seconds of inactivity - refresh to default state
            setSelectedShop(null);
            setSelectedFloor(null); // Reset to no selection
            setSelectedLanguage("ja"); // Reset to default Japanese (also saves to localStorage)
            setIsLanguageModalOpen(false);
            
            // Note: Do NOT trigger refreshTrigger here, as it forces CMS content to reset/reload.
            // We only want to reset the UI selection state, not the background content loop.
            console.log('[ShopListScreen] Idle timeout: Resetting UI state');
            
            // Reset scroll position to top instantly (since screen is black)
            if (scrollContainerRef.current) {
              // smoothScrollTo(0, 800); 
              // Instead of smooth scroll, just jump to top since we are hidden by fade
              scrollContainerRef.current.scrollLeft = 0;
            }
            
            // Reset activity time after refresh
            lastActivityTimeRef.current = Date.now();

            // Start fade in
            requestAnimationFrame(() => {
              setIsFadeActive(false);
              
              // Allow interaction again after fade in completes
              setTimeout(() => {
                isResettingRef.current = false;
              }, 1000);
            });
          }, 1000);
        }
      }
    }, 1000); // Check every second

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleActivity);
      }
      if (throttleTimeout !== null) {
        clearTimeout(throttleTimeout);
      }
      clearInterval(checkInterval);
    };
  }, []); // Always active, no dependencies

  // Filter shops by selected floor
  const filteredShops = React.useMemo(() => {
    if (!selectedFloor) {
      return shops;
    }
    
    const normalizedSelectedFloor = normalizeFloor(selectedFloor);
    
    return shops.filter((shop) => {
      if (!shop.floors || shop.floors.length === 0) {
        return false;
      }
      
      // Check if any of the shop's floors match the selected floor
      return shop.floors.some((floor) => {
        const normalizedShopFloor = normalizeFloor(String(floor));
        return normalizedShopFloor === normalizedSelectedFloor;
      });
    });
  }, [shops, selectedFloor]);

  // Layout: 6 rows per column
  // Card count is dynamically calculated based on the number of shops from API
  const rowsPerColumn = 6;
  const totalColumns = filteredShops.length > 0 ? Math.ceil(filteredShops.length / rowsPerColumn) : 0;

  // Card size calculation
  // Content area: width: 2580px (2640 - 30*2), height: 2040px (2100 - 30*2)
  // Card grid container height: 2032px (2040 - 4*2) with padding 12px top/bottom to accommodate animation and drop shadow
  // Actual content area: 2008px (2032 - 12 - 12)
  const cardHeight = (2008 - 20 * (rowsPerColumn - 1)) / rowsPerColumn; // Row gap: 20px
  const cardWidth = 376; // Card width
  const columnGap = 20; // Column gap
  const imageHeight = 251; // Image height

  // Group shops by column
  const columns: Shop[][] = [];
  for (let i = 0; i < totalColumns; i++) {
    const startIndex = i * rowsPerColumn;
    const endIndex = Math.min(startIndex + rowsPerColumn, filteredShops.length);
    columns.push(filteredShops.slice(startIndex, endIndex));
  }

  // Mouse drag scroll
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    scrollStartXRef.current = container.scrollLeft;
    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const deltaX = dragStartXRef.current - e.clientX;
    container.scrollLeft = scrollStartXRef.current + deltaX;
  };

  const handleMouseUp = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = false;
    container.style.cursor = "grab";
    container.style.userSelect = "";
  };

  const handleMouseLeave = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = false;
    container.style.cursor = "grab";
    container.style.userSelect = "";
  };

  // Calculate scroll percentage
  const calculateScrollPercentage = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return { percentage: 0, canScroll: false };
    
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const maxScroll = scrollWidth - clientWidth;
    
    if (maxScroll <= 0) return { percentage: 0, canScroll: false };
    return { percentage: (scrollLeft / maxScroll) * 100, canScroll: true };
  }, []);

  // Handle scroll event
  const handleScroll = useCallback(() => {
    const result = calculateScrollPercentage();
    setScrollPercentage(result.percentage);
    setCanScroll(result.canScroll);
  }, [calculateScrollPercentage]);

  // Update scroll percentage on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [handleScroll]);

  // Recalculate scroll state when content changes
  useLayoutEffect(() => {
    // Immediately check scroll state (synchronous check)
    handleScroll();
    
    // Also check after a short delay to ensure layout is complete
    const timer = setTimeout(() => {
      handleScroll();
    }, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [filteredShops, selectedFloor, handleScroll]);

  // Also recalculate when shops data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      handleScroll();
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [shops.length, handleScroll]);

  // Smooth scroll animation helper
  const smoothScrollTo = (targetScrollLeft: number, duration: number = 800) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const startScrollLeft = container.scrollLeft;
    const distance = targetScrollLeft - startScrollLeft;
    const startTime = performance.now();

    // Easing function: easeInOutCubic
    const easeInOutCubic = (t: number): number => {
      return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      
      container.scrollLeft = startScrollLeft + distance * easedProgress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  // Scroll to start
  const scrollToStart = () => {
    const container = scrollContainerRef.current;
    if (container) {
      smoothScrollTo(0, 800);
    }
  };

  // Scroll to end
  const scrollToEnd = () => {
    const container = scrollContainerRef.current;
    if (container) {
      const maxScroll = container.scrollWidth - container.clientWidth;
      smoothScrollTo(maxScroll, 800);
    }
  };

  // Add style to hide scrollbar
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .shop-list-scroll-container::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div
      style={{
        width: "3840px",
        height: "2160px",
        backgroundColor: "#3C2C23",
        display: "flex",
        flexDirection: "row",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Shop list area (left side) */}
      <div
        style={{
          width: "2640px",
          height: "2100px",
          backgroundColor: "#FDE7C6",
          borderRadius: "50px",
          paddingTop: "30px",
          paddingBottom: "30px",
          paddingLeft: "0px",
          paddingRight: "0px",
          margin: "30px",
          flexShrink: 0,
          boxSizing: "border-box",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Scrollable container */}
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {/* Prev button (left side) */}
          {canScroll && scrollPercentage > 50 && (
            <div
              onClick={scrollToStart}
              style={{
                position: "absolute",
                left: "0",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
                width: "150px",
                height: "224px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onTouchStart={(e) => {
                const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                if (highlight) highlight.style.opacity = "1";
              }}
              onTouchEnd={(e) => {
                const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                if (highlight) highlight.style.opacity = "0";
              }}
              onTouchCancel={(e) => {
                const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                if (highlight) highlight.style.opacity = "0";
              }}
            >
              <img
                src={prev}
                alt="最初に移動"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "contain",
                }}
              />
              <img
                src={buttonPrevHighlight}
                alt="Highlight"
                className="highlight"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "contain",
                  opacity: 0,
                  transition: "opacity 0.3s ease-in-out",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
          {/* Next button (right side) */}
          {canScroll && scrollPercentage <= 50 && (
            <div
              onClick={scrollToEnd}
              style={{
                position: "absolute",
                right: "0",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 10,
                width: "150px",
                height: "224px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onTouchStart={(e) => {
                const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                if (highlight) highlight.style.opacity = "1";
              }}
              onTouchEnd={(e) => {
                const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                if (highlight) highlight.style.opacity = "0";
              }}
              onTouchCancel={(e) => {
                const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                if (highlight) highlight.style.opacity = "0";
              }}
            >
              <img
                src={next}
                alt="最後に移動"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "contain",
                }}
              />
              <img
                src={buttonNextHighlight}
                alt="Highlight"
                className="highlight"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "block",
                  objectFit: "contain",
                  opacity: 0,
                  transition: "opacity 0.3s ease-in-out",
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
          <div
            ref={scrollContainerRef}
            style={{
              width: "100%",
              height: "100%",
              overflowX: "auto",
              overflowY: "hidden",
              scrollbarWidth: "none", // Firefox
              msOverflowStyle: "none", // IE/Edge
              cursor: "grab",
            }}
            className="shop-list-scroll-container"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
          {/* Card grid container */}
          <AnimatePresence 
            mode="wait"
            onExitComplete={() => {
              // Recalculate scroll state after animation completes
              setTimeout(() => {
                handleScroll();
              }, 50);
            }}
          >
            <motion.div
              key={selectedFloor || "all"}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              onAnimationComplete={() => {
                // Recalculate scroll state after animation completes
                setTimeout(() => {
                  handleScroll();
                }, 50);
              }}
              style={{
                display: "flex",
                flexDirection: "row",
                height: "2032px",
                width: `${30 + totalColumns * cardWidth + (totalColumns - 1) * columnGap + 30}px`,
                gap: `${columnGap}px`,
                paddingTop: "20px",
                paddingBottom: "12px",
                boxSizing: "border-box",
              }}
            >
              {error ? (
                <div 
                  style={{ 
                    padding: "30px", 
                    color: "red", 
                    fontSize: "24px",
                  }}
                >
                  Error: {error}
                </div>
              ) : filteredShops.length === 0 ? (
                <div 
                  style={{ 
                    padding: "30px", 
                    color: "#FFFFFF", 
                    fontSize: "24px",
                  }}
                >
                  店舗データがありません
                </div>
              ) : (
                columns.map((columnShops, columnIndex) => (
                <div
                  key={columnIndex}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "20px",
                    width: `${cardWidth}px`,
                    marginLeft: columnIndex === 0 ? "30px" : "0px",
                    marginRight: columnIndex === totalColumns - 1 ? "30px" : "0px",
                  }}
                >
                  {columnShops.map((shop) => {
                    // Get first floor for display
                    const floor = shop.floors && shop.floors.length > 0 ? shop.floors[0] : "";
                    
                    // Logic for genre memo display
                    let genreMemo = "";
                    if (selectedLanguage === "en" && shop.genreMemoEn) {
                      genreMemo = shop.genreMemoEn;
                    } else if (shop.genreMemo) {
                        genreMemo = shop.genreMemo
                          .split(/[|]+/)
                          .map(s => s.trim())
                          .filter(s => s.length > 0)
                          .slice(0, 2)
                          .join(" / ");
                    }

                    // Format first line: "フロア [区画番号] ジャンルメモ"
                    const firstLine = `${floor} [${shop.number}] ${genreMemo}`;

                    // Logic for shop name display
                    const shopName = (selectedLanguage === "en" && shop.nameEn) ? shop.nameEn : shop.name;

                    return (
                      <motion.div
                        key={shop.shopId || shop.number}
                        onClick={() => setSelectedShop(shop)}
                        whileHover={{
                          scale: 1.05,
                          y: -4,
                          boxShadow: "0 6px 12px rgba(0, 0, 0, 0.3)",
                        }}
                        whileTap={{
                          scale: 1.02,
                          y: -2,
                          boxShadow: "0 4px 8px rgba(0, 0, 0, 0.25)",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        style={{
                          width: `${cardWidth}px`,
                          height: `${cardHeight}px`,
                          backgroundColor: "#FFFFFF",
                          borderRadius: "0 30px 30px 30px", // Top-right, bottom-left, bottom-right: 30px
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                          flexShrink: 0,
                          position: "relative",
                          cursor: "pointer",
                        }}
                      >
                        {/* Floor display (top-left) */}
                        {floor && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: "50px",
                              height: "50px",
                              backgroundColor: "#E63B93",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 10,
                              fontSize: "24px",
                              fontWeight: 700,
                              color: "#FFFFFF",
                            }}
                          >
                            {floor}
                          </div>
                        )}
                        {/* Image area */}
                        <div
                          style={{
                            width: "100%",
                            height: `${imageHeight}px`,
                            backgroundColor: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            borderRadius: "0 30px 0 0",
                            boxSizing: "border-box",
                          }}
                        >
                          <ShopImage photo={shop.photo2 || shop.photo1} shopId={shop.shopId} />
                        </div>
                        {/* Content area */}
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            padding: "12px",
                            backgroundColor: "#000000",
                            color: "#FFFFFF",
                            justifyContent: "center",
                          }}
                        >
                          {/* First line: Floor, number, genre memo (16px) */}
                          <div
                            style={{
                              fontSize: "16px",
                              fontWeight: 400,
                              marginBottom: "8px",
                              lineHeight: "1.4",
                            }}
                          >
                            {firstLine}
                          </div>
                          {/* Second line: Shop name (24px) */}
                          <ShopNameDisplay name={shopName} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))
            )}
            </motion.div>
          </AnimatePresence>
          </div>
        </div>

        {/* Shop detail modal */}
        <AnimatePresence>
          {selectedShop && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 1000,
              }}
            >
              <ShopDetailScreen 
                shop={selectedShop} 
                onClose={() => setSelectedShop(null)} 
                language={selectedLanguage}
                currentFloorSetting={currentFloorSetting}
                locationIconSettings={locationIconSettings}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action space (right side) */}
      <div
        style={{
          width: "1140px",
          height: "2160px",
          backgroundColor: "#000000",
          flexShrink: 0,
          boxSizing: "border-box",
          marginLeft: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Independent video area (top) */}
        <div
          style={{
            width: "1080px",
            marginTop: "30px",
            marginLeft: "30px",
            marginRight: "30px",
            marginBottom: "0px",
            boxSizing: "border-box",
            alignSelf: "flex-start",
          }}
        >
          <IndependentVideoPlayer forceReload={refreshTrigger} videoHeight="608px" language={selectedLanguage} />
        </div>

        {/* Spacer between top video and middle buttons */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* Floor selection button area and business hours / language selection area */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            marginLeft: "30px",
            marginRight: "30px",
            flexShrink: 0,
          }}
        >
          {/* Floor selection button area (left side) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "50px",
              height: "100%",
            }}
          >
            {/* 3F button and FOOD FOREST */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "30px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  cursor: "pointer",
                  touchAction: "none", // Prevent default touch actions like scrolling/zooming on the button
                }}
                onClick={() => {
                  // Only allow mouse clicks if no touch interaction is active
                  if (!activeTouchRef.current) {
                    handleFloorSelect("3F");
                  }
                }}
                onTouchStart={(_e) => {
                  // If another button is already being touched, ignore this touch
                  if (activeTouchRef.current && activeTouchRef.current !== "3F") return;
                  activeTouchRef.current = "3F";
                }}
                onTouchEnd={(e) => {
                  // Only process if this was the active touch
                  if (activeTouchRef.current === "3F") {
                    e.preventDefault(); // Prevent ghost click
                    handleFloorSelect("3F");
                    activeTouchRef.current = null;
                  }
                }}
                onTouchCancel={(_e) => {
                  if (activeTouchRef.current === "3F") {
                    activeTouchRef.current = null;
                  }
                }}
              >
                <img
                  src={button3F}
                  alt="3F"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={button3FHighlight}
                  alt="3F Highlight"
                  className="highlight"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: selectedFloor === "3F" ? 1 : 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
                
                {/* Current Location Icon */}
                {currentFloorSetting === "3F" && (
                  <img 
                    src={iconCurrentFloor}
                    alt="Current Floor"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      position: "absolute",
                      top: "5%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 5,
                      pointerEvents: "none",
                      width: "50%", // Adjust size relative to button
                      height: "auto",
                    }}
                  />
                )}
              </div>
              {/* TODO: Add FOOD FOREST button */}
            </div>
            {/* 2F button and RESTAURANT */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "30px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  cursor: "pointer",
                  touchAction: "none",
                }}
                onClick={() => {
                  if (!activeTouchRef.current) {
                    handleFloorSelect("2F");
                  }
                }}
                onTouchStart={(_e) => {
                  if (activeTouchRef.current && activeTouchRef.current !== "2F") return;
                  activeTouchRef.current = "2F";
                }}
                onTouchEnd={(e) => {
                  if (activeTouchRef.current === "2F") {
                    e.preventDefault();
                    handleFloorSelect("2F");
                    activeTouchRef.current = null;
                  }
                }}
                onTouchCancel={(_e) => {
                  if (activeTouchRef.current === "2F") {
                    activeTouchRef.current = null;
                  }
                }}
              >
                <img
                  src={button2F}
                  alt="2F"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={button2FHighlight}
                  alt="2F Highlight"
                  className="highlight"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: selectedFloor === "2F" ? 1 : 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
                
                {/* Current Location Icon */}
                {currentFloorSetting === "2F" && (
                  <img 
                    src={iconCurrentFloor}
                    alt="Current Floor"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      position: "absolute",
                      top: "5%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 5,
                      pointerEvents: "none",
                      width: "50%", // Adjust size relative to button
                      height: "auto",
                    }}
                  />
                )}
              </div>
              {/* TODO: Add RESTAURANT button */}
            </div>
            {/* 1F button and SUZAKA 蔵 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "30px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  cursor: "pointer",
                  touchAction: "none",
                }}
                onClick={() => {
                  if (!activeTouchRef.current) {
                    handleFloorSelect("1F");
                  }
                }}
                onTouchStart={(_e) => {
                  if (activeTouchRef.current && activeTouchRef.current !== "1F") return;
                  activeTouchRef.current = "1F";
                }}
                onTouchEnd={(e) => {
                  if (activeTouchRef.current === "1F") {
                    e.preventDefault();
                    handleFloorSelect("1F");
                    activeTouchRef.current = null;
                  }
                }}
                onTouchCancel={(_e) => {
                  if (activeTouchRef.current === "1F") {
                    activeTouchRef.current = null;
                  }
                }}
              >
                <img
                  src={button1F}
                  alt="1F"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={button1FHighlight}
                  alt="1F Highlight"
                  className="highlight"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: selectedFloor === "1F" ? 1 : 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />

                {/* Current Location Icon */}
                {currentFloorSetting === "1F" && (
                  <img 
                    src={iconCurrentFloor}
                    alt="Current Floor"
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    style={{
                      position: "absolute",
                      top: "5%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      zIndex: 5,
                      pointerEvents: "none",
                      width: "50%", // Adjust size relative to button
                      height: "auto",
                    }}
                  />
                )}
              </div>
              {/* TODO: Add SUZAKA 蔵 button */}
            </div>
          </div>

          {/* Business hours / language selection area (right side of 1F button) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              alignItems: "flex-start",
              marginLeft: "30px",
              height: "100%",
            }}
          >
            <img
              src={openTime}
              alt="Open Time"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{
                display: "block",
              }}
            />
            <div style={{ flex: 1 }} />
            <div
              ref={languageButtonRef}
              onClick={() => setIsLanguageModalOpen(true)}
              style={{
                position: "relative",
                cursor: "pointer",
                display: "block",
              }}
            >
              {/* Japanese selected image */}
              <img
                src={selectLanguageSelectedJp}
                alt="Select Language"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  opacity: selectedLanguage === "ja" ? 1 : 0,
                  transition: "opacity 0.3s ease-in-out",
                  pointerEvents: "none",
                }}
              />
              {/* English selected image */}
              <img
                src={selectLanguageSelectedEn}
                alt="Select Language"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  opacity: selectedLanguage === "en" ? 1 : 0,
                  transition: "opacity 0.3s ease-in-out",
                  pointerEvents: "none",
                }}
              />
              {/* Placeholder to maintain size */}
              <img
                src={selectLanguageSelectedEn}
                alt=""
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  display: "block",
                  visibility: "hidden",
                  width: "100%",
                  height: "auto",
                }}
              />
            </div>
          </div>
          </div>

        {/* Spacer between middle buttons and bottom CMS */}
        <div style={{ flex: 1, minHeight: 0 }} />

        {/* CMS area (bottom) */}
        <div
          style={{
            width: "1080px",
            height: "607.5px", // 16:9 aspect ratio (1080 × 9/16 = 607.5)
            marginLeft: "30px",
            marginRight: "30px",
            marginTop: "0px",
            marginBottom: "30px",
            boxSizing: "border-box",
            overflow: "hidden",
            borderRadius: "30px",
            alignSelf: "flex-start",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
            }}
          >
            <VerticalVideoSlot forceReload={refreshTrigger} />
          </div>
        </div>
      </div>

      {/* Language Select Modal */}
      <LanguageSelectModal
        isOpen={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        buttonRef={languageButtonRef}
        onLanguageChange={(lang) => setSelectedLanguage(lang)}
      />

      {/* Fade overlay for idle timeout refresh */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "#FFFFFF",
          opacity: isFadeActive ? 1 : 0,
          pointerEvents: isFadeActive ? "auto" : "none",
          transition: "opacity 1s ease-in-out",
          zIndex: 9999,
        }}
      />
    </div>
  );
};

export default ShopListScreen;






