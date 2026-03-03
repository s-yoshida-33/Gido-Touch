// src/screens/ShopListScreen.tsx
import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import IndependentVideoPlayer from "../components/IndependentVideoPlayer";
import VerticalVideoSlot from "../components/VerticalVideoSlot";

import { useMall } from "../contexts/MallContext";
import { useCmsSettings } from "../hooks/useCmsSettings";

// JA assets
import categoryBackgroundJa from "../assets/category/ja/background.svg";
import categoryTakeoutJa from "../assets/category/ja/takeout.svg";
import categoryTakeoutHighlightJa from "../assets/category/ja/takeout-highlight.svg";
import categoryAlcoholJa from "../assets/category/ja/alcohol.svg";
import categoryAlcoholHighlightJa from "../assets/category/ja/alcohol-highlight.svg";
import categoryKidsJa from "../assets/category/ja/kids.svg";
import categoryKidsHighlightJa from "../assets/category/ja/kids-highlight.svg";
import categorySweetsJa from "../assets/category/ja/sweets.svg";
import categorySweetsHighlightJa from "../assets/category/ja/sweets-highlight.svg";

// EN assets
import categoryBackgroundEn from "../assets/category/en/background.svg";
import categoryTakeoutEn from "../assets/category/en/takeout.svg";
import categoryTakeoutHighlightEn from "../assets/category/en/takeout-highlight.svg";
import categoryAlcoholEn from "../assets/category/en/alcohol.svg";
import categoryAlcoholHighlightEn from "../assets/category/en/alcohol-highlight.svg";
import categoryKidsEn from "../assets/category/en/kids.svg";
import categoryKidsHighlightEn from "../assets/category/en/kids-highlight.svg";
import categorySweetsEn from "../assets/category/en/sweets.svg";
import categorySweetsHighlightEn from "../assets/category/en/sweets-highlight.svg";

// Empty icon
import emptyIcon from "../assets/icon/enmpty.svg";

import type { Shop } from "../types/shop";
import ShopDetailScreen from "./ShopDetailScreen";
import { LanguageSelectModal } from "../components/LanguageSelectModal";
import type { LocationIconSettingsPerFloor } from "../types/locationIcon";
import type { ShopPositionSettings } from "../types/shopPosition";
import type { FloorLayout } from "../types/floorLayout";
import { filterGenreMemos, DEFAULT_CATEGORY_MAPPINGS } from "../utils/genreUtils";
import { getShopImageDataUrl } from "../utils/imageUtils";
import type { SubFloorSettings } from "../types/global";

// Simple in-memory cache for image URLs to prevent flickering
const imageCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

/**
 * Build image path using shop_id if photo is relative or filename only
 * Expected full path format: C:\Users\...\AppData\Roaming\TTI\BridgeWebPopper\files\shop\{shop_id}\photo2.png
 */
function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) {
    // If no photo but shop_id is available, try to build path from shop_id
    // Note: We don't have the base path here, so we return empty if photo is missing.
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
    
    // Default legacy behavior: prepend files/shop/{shopId}/
    if (shopId) {
        return `files/shop/${shopId}/${cleanPhoto}`;
    }
    
    // Fallback
    return photo;
  }
  
  return photo;
}

/**
 * Shop image component that loads images via Electron IPC or falls back to file:// URL
 */
const ShopImage: React.FC<{ photo: string | undefined; shopId: string | undefined }> = React.memo(({ photo, shopId }) => {
  // Generate cache key
  const cacheKey = `${shopId}:${photo}`;
  
  // Initialize with cached value if available
  const [imageUrl, setImageUrl] = useState<string>(() => imageCache.get(cacheKey) || "");
  const [isLoading, setIsLoading] = useState(() => !imageCache.has(cacheKey));

  useEffect(() => {
    if (!photo) {
      setIsLoading(false);
      return;
    }

    // If already cached, ensure state matches (handle fast updates)
    if (imageCache.has(cacheKey)) {
      const cachedUrl = imageCache.get(cacheKey)!;
      if (imageUrl !== cachedUrl) {
        setImageUrl(cachedUrl);
        setIsLoading(false);
      }
      return;
    }

    const loadImage = async () => {
      // If photo path is relative or just a filename, build the full path first
      const imagePath = buildImagePath(photo, shopId);
      
      if (!imagePath) {
        setIsLoading(false);
        return;
      }

      // Deduplicate requests
      if (pendingRequests.has(cacheKey)) {
        try {
          const url = await pendingRequests.get(cacheKey);
          if (url) {
            setImageUrl(url);
            setIsLoading(false);
          }
          return;
        } catch (e) {
          // If pending request failed, try again below
        }
      }

      // Use Tauri IPC to load shop image
      let loadPromise: Promise<string | null>;

      loadPromise = getShopImageDataUrl(imagePath).catch((error: unknown) => {
        console.error("Failed to load image via IPC:", error);
        return toFileUrl(imagePath);
      });

      pendingRequests.set(cacheKey, loadPromise);

      try {
        const dataUrl = await loadPromise;
        if (dataUrl) {
          imageCache.set(cacheKey, dataUrl);
          setImageUrl(dataUrl);
        }
      } finally {
        pendingRequests.delete(cacheKey);
        setIsLoading(false);
      }
    };

    loadImage();
  }, [photo, shopId, cacheKey]); // Depend on photo and shopId. If they change, reload.

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
        display: "block",
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
});

/**
 * Scalable Text Component
 */
const ScalableText: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const adjustScale = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;
      
      if (textWidth > containerWidth && containerWidth > 0) {
        const scale = containerWidth / textWidth;
        textRef.current.style.transform = `scaleX(${scale})`;
      } else {
        textRef.current.style.transform = "scaleX(1)";
      }
    }
  }, []);

  useLayoutEffect(() => {
    // Initial adjustment
    adjustScale();
    
    // Adjust again after fonts are loaded
    document.fonts.ready.then(adjustScale);
    
    // Force a re-calculation after a short delay to handle any layout shifts
    const timer = setTimeout(adjustScale, 100);
    return () => clearTimeout(timer);
  }, [text, adjustScale]);

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      adjustScale();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [adjustScale]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        whiteSpace: "nowrap",
        overflow: "hidden",
        transformOrigin: "left center",
        ...style
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
        {text}
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
  shops: Shop[];
  shopPositions?: ShopPositionSettings;
  displayFloors?: string[];
  floorLayout?: FloorLayout;
  subFloorSettings?: SubFloorSettings;
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
const ShopListScreen: React.FC<ShopListScreenProps> = ({ 
  currentFloorSetting, 
  locationIconSettings, 
  shops, 
  shopPositions, 
  displayFloors = ['1F', '2F', '3F', '4F'], 
  floorLayout,
  subFloorSettings = { "1F-1": [], "1F-2": [] }
 }) => {
  const { assets, isLoading: isAssetsLoading, language: selectedLanguage, setLanguage: setSelectedLanguage, genreSettings, mallId } = useMall();
  const { settings: cmsSettings } = useCmsSettings();

  const isSendai = mallId === 'sendaikamisugi';

  // Define category assets based on language
  const categoryAssets = {
    ja: {
      background: categoryBackgroundJa,
      takeout: categoryTakeoutJa,
      takeoutHighlight: categoryTakeoutHighlightJa,
      alcohol: categoryAlcoholJa,
      alcoholHighlight: categoryAlcoholHighlightJa,
      kids: categoryKidsJa,
      kidsHighlight: categoryKidsHighlightJa,
      sweets: categorySweetsJa,
      sweetsHighlight: categorySweetsHighlightJa,
    },
    en: {
      background: categoryBackgroundEn,
      takeout: categoryTakeoutEn,
      takeoutHighlight: categoryTakeoutHighlightEn,
      alcohol: categoryAlcoholEn,
      alcoholHighlight: categoryAlcoholHighlightEn,
      kids: categoryKidsEn,
      kidsHighlight: categoryKidsHighlightEn,
      sweets: categorySweetsEn,
      sweetsHighlight: categorySweetsHighlightEn,
    }
  };

  const currentCategoryAssets = selectedLanguage === 'en' ? categoryAssets.en : categoryAssets.ja;
  
  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag scroll state
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  // Floor filter state
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Selected shop for detail modal
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  // Scroll position state for navigation buttons
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  // Force reload trigger state
  const [refreshTrigger, _setRefreshTrigger] = useState(0);

  // Idle timeout state (30 seconds for testing)
  const IDLE_TIMEOUT_MS = 30 * 1000; // 30 seconds
  const lastActivityTimeRef = useRef<number>(Date.now());

  // Language select modal state
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const languageButtonRef = useRef<HTMLDivElement>(null);
  
  // Ref to track active touch on floor buttons to prevent flickering
  const activeTouchRef = useRef<string | null>(null);
  // Ref to track touch start position for detecting scroll gestures
  const touchStartPosRef = useRef<{x: number, y: number} | null>(null);

  // Fade overlay state for idle timeout
  const [isFadeActive, setIsFadeActive] = useState(false);
  const isResettingRef = useRef(false);

  // State to track which card is currently being pressed (for animation)
  const [pressedCardId, setPressedCardId] = useState<string | null>(null);

  // Check scroll state
  const checkScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    // Round values to avoid sub-pixel precision issues
    const currentScroll = Math.ceil(scrollLeft);
    const maxScroll = Math.ceil(scrollWidth - clientWidth);
    
    if (maxScroll <= 0) {
      setCanScrollPrev(false);
      setCanScrollNext(false);
      return;
    }

    // Show Prev if scrolled more than threshold (approx 1 column width: 376px + 20px gap)
    // User requested to show buttons when around the 2nd column
    const threshold = 200;

    setCanScrollPrev(currentScroll > threshold);
    // Show Next if not at the end (within threshold)
    setCanScrollNext(currentScroll < maxScroll - threshold);
  }, []);

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

  // Helper to handle category selection
  const handleCategorySelect = (category: string) => {
    // Close modal if open
    if (selectedShop) {
      setSelectedShop(null);
    }
    
    if (selectedCategory === category) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category);
    }
  };

  // State refs for idle check (to access current state in interval)
  const selectedShopRef = useRef(selectedShop);
  const selectedFloorRef = useRef(selectedFloor);
  const selectedCategoryRef = useRef(selectedCategory);
  const selectedLanguageRef = useRef(selectedLanguage);
  const isLanguageModalOpenRef = useRef(isLanguageModalOpen);

  useEffect(() => {
    selectedShopRef.current = selectedShop;
    selectedFloorRef.current = selectedFloor;
    selectedCategoryRef.current = selectedCategory;
    selectedLanguageRef.current = selectedLanguage;
    isLanguageModalOpenRef.current = isLanguageModalOpen;
  }, [selectedShop, selectedFloor, selectedCategory, selectedLanguage, isLanguageModalOpen]);

  // Initialize language to Japanese on mount (force reset to Japanese)
  useEffect(() => {
    // Always set to Japanese on mount to ensure default is Japanese
    setSelectedLanguage("ja");
  }, []); // Run only on mount

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
          selectedCategoryRef.current === null &&
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
            setSelectedCategory(null); // Reset category
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

  // Filter shops by selected floor and display floors
  const filteredShops = React.useMemo(() => {
    // 1. Filter by Display Floors (universe of valid shops)
    // Only show shops that exist on at least one of the displayed floors
    const displayFilteredShops = shops.filter(shop => {
        if (!shop.floors || shop.floors.length === 0) return false;
        // Normalize shop floors and check against displayFloors
        return shop.floors.some(f => displayFloors.includes(normalizeFloor(String(f))));
    });

    let result = displayFilteredShops;

    if (selectedFloor) {
      // 1F-1, 1F-2 logic
      if (selectedFloor === "1F-1" || selectedFloor === "1F-2") {
         const allowedIds = subFloorSettings[selectedFloor] || [];
         result = result.filter(s => {
             // IDが含まれているかチェック
             return allowedIds.includes(s.shopId || s.number || "");
         });
      } else {
         // Standard logic for 4F, 2F
         const normalizedSelectedFloor = normalizeFloor(selectedFloor);
         result = result.filter((shop) => {
            return shop.floors.some((floor) => {
              const normalizedShopFloor = normalizeFloor(String(floor));
              return normalizedShopFloor === normalizedSelectedFloor;
            });
         });
      }
    }

    if (selectedCategory) {
      result = result.filter((shop) => {
        const genreMemo = (shop.genreMemo || "").toLowerCase();
        
        // 設定からキーワードを取得、なければデフォルト値を使用
        const mapping = genreSettings?.categoryMapping || DEFAULT_CATEGORY_MAPPINGS;
        const keywords = mapping[selectedCategory] || [];

        // テイクアウトとアルコールの特別処理（フラグチェック）は維持しつつ、キーワード検索を追加
        if (selectedCategory === 'takeout' && (shop.takeOut && shop.takeOut !== "0")) {
            return true;
        }
        if (selectedCategory === 'alcohol' && (shop.alcohol && shop.alcohol !== "0")) {
            return true;
        }

        // キーワードの部分一致検索
        // 設定されたキーワードのいずれかがジャンルメモに含まれていればヒット
        return keywords.some(keyword => genreMemo.includes(keyword.toLowerCase()));
      });
    }
    
    // Logic for sorting if "prioritizeCurrentFloor" is enabled in "ALL" mode
    const allConfig = floorLayout?.["ALL"] || floorLayout?.["default"];
    if (!selectedFloor && allConfig?.prioritizeCurrentFloor && currentFloorSetting) {
        const normalizedCurrentFloor = normalizeFloor(currentFloorSetting);
        
        // Sort: Current floor shops first, then others. Maintain relative order.
        return [...result].sort((a, b) => {
            const aIsCurrent = a.floors?.some(f => normalizeFloor(String(f)) === normalizedCurrentFloor);
            const bIsCurrent = b.floors?.some(f => normalizeFloor(String(f)) === normalizedCurrentFloor);
            
            if (aIsCurrent && !bIsCurrent) return -1;
            if (!aIsCurrent && bIsCurrent) return 1;
            return 0;
        });
    }
    
    return result;
  }, [shops, selectedFloor, selectedCategory, displayFloors, floorLayout, currentFloorSetting, subFloorSettings]);

  // Layout calculation
  const currentLayoutKey = selectedFloor ? normalizeFloor(selectedFloor) : "ALL";
  let layoutConfig = floorLayout?.[currentLayoutKey];

  // Fallback for "ALL" mode if not configured
  if (!selectedFloor && !layoutConfig) {
      // Try "default" or just use undefined to trigger defaults below
      layoutConfig = floorLayout?.["default"];
  }
  
  // Base rows (fallback to 6 if not configured or not filtered by floor)
  let rowsPerColumn = layoutConfig?.rowsPerCol ?? 6;

  if (layoutConfig?.maxRows && layoutConfig.maxRows > 0) {
    rowsPerColumn = Math.max(layoutConfig.maxRows, 1);
  }

  // Card size calculation with aspect ratio maintenance
  const containerHeight = 2008;
  const gap = 20;
  
  const cardHeight = (containerHeight - gap * (rowsPerColumn - 1)) / rowsPerColumn;
  
  // Default reference for aspect ratio (6 rows)
  const defaultRows = 6;
  const defaultHeight = (containerHeight - gap * (defaultRows - 1)) / defaultRows;
  const defaultWidth = 345;
  const aspectRatio = defaultWidth / defaultHeight;
  
  // Calculate proportional width
  let cardWidth = cardHeight * aspectRatio;
  
  // Scale image height proportionally
  const defaultImageHeight = 251;
  const imageHeight = cardHeight * (defaultImageHeight / defaultHeight);

  // Scale factor based on height relative to default height
  const scaleFactor = cardHeight / defaultHeight;
  
  // Scaled dimensions for internal elements
  const floorBadgeSize = 50 * scaleFactor;
  const floorBadgeFontSize = 24 * scaleFactor;
  const contentPadding = 12 * scaleFactor;
  const firstLineFontSize = 16 * scaleFactor;
  const firstLineMarginBottom = 8 * scaleFactor;
  const shopNameFontSize = 24 * scaleFactor;
  const borderRadius = 30 * scaleFactor; // Corner radius also needs scaling to look right

  const columnGap = 20; // Column gap
  const totalColumns = filteredShops.length > 0 ? Math.ceil(filteredShops.length / rowsPerColumn) : 0;

  // Logic to fill the screen width if there is extra space
  // Only apply when a specific floor is selected (not in "ALL" mode) AND autoWidth is enabled
  const autoWidth = layoutConfig?.autoWidth ?? true;
  if (totalColumns > 0 && selectedFloor && autoWidth) {
      const totalGapWidth = Math.max(0, totalColumns - 1) * columnGap;
      const totalSidePadding = 60; // 30px left + 30px right
      const currentTotalWidth = totalColumns * cardWidth + totalGapWidth + totalSidePadding;
      const maxContainerWidth = 2640;

      // If current content fits within the container width with extra space
      if (currentTotalWidth < maxContainerWidth) {
          // Calculate new card width to fill the remaining space
          // Available width for cards = maxContainerWidth - gaps - padding
          const availableWidthForCards = maxContainerWidth - totalGapWidth - totalSidePadding;
          const newCardWidth = availableWidthForCards / totalColumns;

          // Only apply if it makes the cards wider
          if (newCardWidth > cardWidth) {
              cardWidth = newCardWidth;
          }
      }
  }

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

  // Handle scroll event
  const handleScroll = useCallback(() => {
    checkScrollState();
  }, [checkScrollState]);

  // Setup ResizeObserver to detect container size changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Create ResizeObserver to monitor the scroll container and its content
    const resizeObserver = new ResizeObserver(() => {
      checkScrollState();
    });

    resizeObserver.observe(container);
    // Also observe the first child (content wrapper) if it exists
    if (container.firstElementChild) {
      resizeObserver.observe(container.firstElementChild);
    }

    container.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", checkScrollState);

    // Initial check
    checkScrollState();

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", checkScrollState);
    };
  }, [handleScroll, checkScrollState, filteredShops, selectedFloor, selectedCategory]); // Re-run when content changes

  // Additional check when content likely changes (animations, etc)
  useLayoutEffect(() => {
    checkScrollState();
    const timer = setTimeout(checkScrollState, 100);
    const timer2 = setTimeout(checkScrollState, 500); // Check again after animation
    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [filteredShops, selectedFloor, selectedCategory, checkScrollState]);

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

  // Loading state check
  if (isAssetsLoading || !assets) {
    return null; // Or loading spinner
  }

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
              // Reset scroll position instantly when content changes (after exit animation)
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft = 0;
                checkScrollState(); // Update buttons visibility
              }

              // Recalculate scroll state after animation completes
              setTimeout(() => {
                handleScroll();
              }, 50);
            }}
          >
            <motion.div
              key={`${selectedFloor || "all"}-${selectedCategory || "all"}`}
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
                width: filteredShops.length === 0 ? "2640px" : `${30 + totalColumns * cardWidth + (totalColumns - 1) * columnGap + 30}px`,
                gap: `${columnGap}px`,
                paddingTop: "20px",
                paddingBottom: "12px",
                boxSizing: "border-box",
              }}
            >
              {filteredShops.length === 0 ? (
                <div 
                  style={{ 
                    width: "100%",
                    height: "100%",
                    margin: "0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img 
                    src={emptyIcon} 
                    alt="empty" 
                    style={{
                      width: "1200px",
                      height: "auto",
                      opacity: 0.6,
                    }}
                  />
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
                        const memos = shop.genreMemo
                          .split(/[|]+/)
                          .map(s => s.trim())
                          .filter(s => s.length > 0);

                        genreMemo = filterGenreMemos(memos, genreSettings?.ignoredKeywords, genreSettings?.maxItems).join(" / ");
                    }

                    // Format first line: "フロア [区画番号] ジャンルメモ"
                    const showNumber = /\d/.test(shop.number || "");
                    const parts = [floor];
                    if (showNumber) parts.push(`[${shop.number}]`);
                    if (genreMemo) parts.push(genreMemo);
                    const firstLine = parts.join(" ");

                    // Logic for shop name display
                    const shopName = (selectedLanguage === "en" && shop.nameEn) ? shop.nameEn : shop.name;
                    
                    const cardId = shop.shopId || shop.number || "";
                    const isPressed = pressedCardId === cardId;

                    return (
                      <motion.div
                        key={cardId}
                        onClick={() => {
                          // Only allow mouse clicks if no touch interaction is active
                          if (!activeTouchRef.current) {
                            setSelectedShop(shop);
                          }
                        }}
                        onTouchStart={(e) => {
                           // If another element is already being touched, ignore this touch
                           if (activeTouchRef.current) return;
                           
                           activeTouchRef.current = cardId;
                           setPressedCardId(cardId);
                           
                           if (e.touches.length > 0) {
                             touchStartPosRef.current = {
                               x: e.touches[0].clientX,
                               y: e.touches[0].clientY
                             };
                           }
                        }}
                        onTouchEnd={(e) => {
                          // Only process if this was the active touch
                          if (activeTouchRef.current === cardId) {
                          // Check for scroll/drag (ignore if moved significantly)
                          let isTap = true;
                          if (touchStartPosRef.current && e.changedTouches.length > 0) {
                            const diffX = Math.abs(e.changedTouches[0].clientX - touchStartPosRef.current.x);
                            const diffY = Math.abs(e.changedTouches[0].clientY - touchStartPosRef.current.y);
                            // Relax threshold to 30px to tolerate jitter on some touch screens
                            if (diffX > 30 || diffY > 30) {
                              isTap = false;
                            }
                          }
                            
                            if (isTap) {
                              e.preventDefault(); // Prevent ghost click
                              setSelectedShop(shop);
                            }
                            
                            activeTouchRef.current = null;
                            touchStartPosRef.current = null;
                            setPressedCardId(null);
                          }
                        }}
                        onTouchCancel={() => {
                          if (activeTouchRef.current === cardId) {
                            activeTouchRef.current = null;
                            touchStartPosRef.current = null;
                            setPressedCardId(null);
                          }
                        }}
                        animate={{
                          scale: isPressed ? 1.02 : 1,
                          y: isPressed ? -2 : 0,
                          boxShadow: isPressed 
                            ? "0 4px 8px rgba(0, 0, 0, 0.25)" 
                            : "0 0 0 rgba(0,0,0,0)" // No shadow by default, or restore original if needed
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
                          borderRadius: `0 ${borderRadius}px ${borderRadius}px ${borderRadius}px`,
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                          flexShrink: 0,
                          position: "relative",
                          cursor: "pointer",
                          touchAction: "pan-x", // Allow horizontal scroll but prevent other gestures
                        }}
                      >
                        {/* Floor display (top-left) */}
                        {floor && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              width: `${floorBadgeSize}px`,
                              height: `${floorBadgeSize}px`,
                              backgroundColor: "#E63B93",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 10,
                              fontSize: `${floorBadgeFontSize}px`,
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
                            borderRadius: `0 ${borderRadius}px 0 0`,
                            boxSizing: "border-box",
                          }}
                        >
                          <ShopImage 
                            // Prioritize shopLogo over photo1 for the list view if needed
                            // But original code was: photo={shop.photo2 || shop.photo1}
                            // User says logo is shopLogo (logo.png) and brand image is photo2 (brand_image.jpg)
                            // If photo2 is brand image, and it's not showing, maybe we should check what's actually in photo2
                            // Update: Use photo2 if available, otherwise shopLogo (as fallback for brand image)
                            photo={shop.photo2 || shop.shopLogo} 
                            shopId={shop.shopId} 
                          />
                        </div>
                        {/* Content area */}
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            padding: `${contentPadding}px`,
                            backgroundColor: "#000000",
                            color: "#FFFFFF",
                            justifyContent: "center",
                            minWidth: 0,
                          }}
                        >
                          {/* First line: Floor, number, genre memo (16px) */}
                          <ScalableText
                            text={firstLine}
                            style={{
                              fontSize: `${firstLineFontSize}px`,
                              fontWeight: 400,
                              marginBottom: `${firstLineMarginBottom}px`,
                              lineHeight: "1.4",
                            }}
                          />
                          {/* Second line: Shop name (24px) */}
                          <ScalableText
                            text={shopName}
                            style={{
                              fontSize: `${shopNameFontSize}px`,
                              fontWeight: 700,
                              lineHeight: "1.4",
                            }}
                          />
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
          
          {/* Prev button (left side) */}
          {canScrollPrev && (
            <div
              onClick={scrollToStart}
              style={{
                position: "absolute",
                left: "0",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 20,
                width: "150px",
                height: "224px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(2px)",
                borderRadius: "16px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
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
                src={assets.common.buttonPrev}
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
                src={assets.common.buttonPrevHighlight}
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
          {canScrollNext && (
            <div
              onClick={scrollToEnd}
              style={{
                position: "absolute",
                right: "0",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 20,
                width: "150px",
                height: "224px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(2px)",
                borderRadius: "16px",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
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
                src={assets.common.buttonNext}
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
                src={assets.common.buttonNextHighlight}
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
                shop={{
                  ...selectedShop,
                  position: shopPositions?.positions?.[selectedShop.shopId || selectedShop.number] || selectedShop.position
                }}
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
          <IndependentVideoPlayer 
            forceReload={refreshTrigger} 
            videoHeight="608px" 
            language={selectedLanguage} 
            shops={shops} 
            overrideShopId={selectedShop ? (selectedShop.shopId || selectedShop.number) : null}
          />
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
              gap: isSendai ? "30px" : "50px",
              height: "100%",
            }}
          >
            {/* ----------------------------------------------------------- */}
            {/* 仙台上杉 (Sendai) 用レイアウト: 4F -> 2F -> 1F-2 -> 1F-1 */}
            {/* ----------------------------------------------------------- */}
            {isSendai ? (
              <>
                {/* 1. 4F button */}
                {displayFloors.includes("4F") && assets.buttons["4F"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("4F")}
                    >
                      <img src={assets.buttons["4F"].default} alt="4F" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["4F"].highlight} alt="4F Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "4F" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                      {currentFloorSetting === "4F" && (
                        <img src={assets.common.iconCurrentFloor} alt="Current Floor" draggable={false}
                          style={{
                            position: "absolute", top: "-10%", left: "50%", transform: "translate(-50%, -50%)",
                            zIndex: 5, pointerEvents: "none", width: "50%", height: "auto",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* 2. 2F button (Moved up) */}
                {displayFloors.includes("2F") && assets.buttons["2F"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("2F")}
                    >
                      <img src={assets.buttons["2F"].default} alt="2F" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["2F"].highlight} alt="2F Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "2F" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                      {currentFloorSetting === "2F" && (
                        <img src={assets.common.iconCurrentFloor} alt="Current Floor" draggable={false}
                          style={{
                            position: "absolute", top: "-10%", left: "50%", transform: "translate(-50%, -50%)",
                            zIndex: 5, pointerEvents: "none", width: "50%", height: "auto",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* 3. 1F-2 button (Display if 1F is enabled) */}
                {displayFloors.includes("1F") && assets.buttons["1F-2"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("1F-2")}
                    >
                      <img src={assets.buttons["1F-2"].default} alt="1F-2" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["1F-2"].highlight} alt="1F-2 Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "1F-2" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 4. 1F-1 button (Display if 1F is enabled) */}
                {displayFloors.includes("1F") && assets.buttons["1F-1"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("1F-1")}
                    >
                      <img src={assets.buttons["1F-1"].default} alt="1F-1" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["1F-1"].highlight} alt="1F-1 Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "1F-1" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              // -----------------------------------------------------------
              // 通常 (Others) レイアウト: 4F -> 3F -> 2F -> 1F
              // -----------------------------------------------------------
              <>
                {/* 4F button */}
                {displayFloors.includes("4F") && assets.buttons["4F"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("4F")}
                    >
                      <img src={assets.buttons["4F"].default} alt="4F" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["4F"].highlight} alt="4F Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "4F" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                      {currentFloorSetting === "4F" && (
                        <img src={assets.common.iconCurrentFloor} alt="Current Floor" draggable={false}
                          style={{
                            position: "absolute", top: "5%", left: "50%", transform: "translate(-50%, -50%)",
                            zIndex: 5, pointerEvents: "none", width: "50%", height: "auto",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* 3F button */}
                {displayFloors.includes("3F") && assets.buttons["3F"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("3F")}
                    >
                      <img src={assets.buttons["3F"].default} alt="3F" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["3F"].highlight} alt="3F Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "3F" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                      {currentFloorSetting === "3F" && (
                        <img src={assets.common.iconCurrentFloor} alt="Current Floor" draggable={false}
                          style={{
                            position: "absolute", top: "5%", left: "50%", transform: "translate(-50%, -50%)",
                            zIndex: 5, pointerEvents: "none", width: "50%", height: "auto",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* 2F button */}
                {displayFloors.includes("2F") && assets.buttons["2F"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("2F")}
                    >
                      <img src={assets.buttons["2F"].default} alt="2F" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["2F"].highlight} alt="2F Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "2F" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                      {currentFloorSetting === "2F" && (
                        <img src={assets.common.iconCurrentFloor} alt="Current Floor" draggable={false}
                          style={{
                            position: "absolute", top: "5%", left: "50%", transform: "translate(-50%, -50%)",
                            zIndex: 5, pointerEvents: "none", width: "50%", height: "auto",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* 1F button */}
                {displayFloors.includes("1F") && assets.buttons["1F"] && (
                  <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
                    <div
                      style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none" }}
                      onClick={() => handleFloorSelect("1F")}
                    >
                      <img src={assets.buttons["1F"].default} alt="1F" draggable={false} style={{ display: "block" }} />
                      <img src={assets.buttons["1F"].highlight} alt="1F Highlight" className="highlight" draggable={false}
                        style={{
                          position: "absolute", top: 0, left: 0, display: "block",
                          opacity: selectedFloor === "1F" ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none",
                        }}
                      />
                      {currentFloorSetting === "1F" && (
                        <img src={assets.common.iconCurrentFloor} alt="Current Floor" draggable={false}
                          style={{
                            position: "absolute", top: "5%", left: "50%", transform: "translate(-50%, -50%)",
                            zIndex: 5, pointerEvents: "none", width: "50%", height: "auto",
                          }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
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
              src={assets.openTime}
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
                src={assets.common.selectLanguageSelectedJp}
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
                src={assets.common.selectLanguageSelectedEn}
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
                src={assets.common.selectLanguageSelectedEn}
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
            position: "relative", // Needed for absolute positioning of children
          }}
        >
          {/* CMS Video Layer */}
          {cmsSettings.enabled && (
            <div 
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 0,
              }}
            >
              <VerticalVideoSlot forceReload={refreshTrigger} />
            </div>
          )}

          {(cmsSettings.categorySearchEnabled ?? true) && (
            <>
              {/* Background Image - Only show if CMS disabled, or if we want to overlay? 
                  If CMS is enabled, let's assume video is background. 
                  But if buttons need background to be visible, we might need a semi-transparent one.
                  For now, let's hide background if CMS is enabled to let video show through.
              */}
              {!cmsSettings.enabled && (
                <img
                  src={currentCategoryAssets.background}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    position: "absolute",
                    top: 0,
                    left: 0,
                    zIndex: 1,
                  }}
                />
              )}
              
              {/* Category Buttons Overlay */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "0px", // Remove padding to use full space
                  boxSizing: "border-box",
                }}
              >
              {/* Top Row: Sweets, Alcohol */}
              <div style={{ height: "242.5px", width: "100%", display: "flex", flexDirection: "row", marginBottom: "30px" }}>
                {/* Takeout Button (Top-Left) */}
                <div 
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-start", position: "relative", height: "242.5px" }}
                  onClick={() => handleCategorySelect('sweets')}
                >
                   <img 
                      src={currentCategoryAssets.sweets} 
                      alt="Sweets" 
                      style={{ width: "525px", height: "242.5px", objectFit: "contain" }}
                      draggable={false}
                   />
                   <img
                      src={currentCategoryAssets.sweetsHighlight}
                      alt="Takeout Highlight"
                      style={{ 
                          position: "absolute",
                          top: 0, left: 0,
                          width: "525px", height: "242.5px", objectFit: "contain",
                          opacity: selectedCategory === 'sweets' ? 1 : 0,
                          transition: "opacity 0.2s",
                          pointerEvents: "none" 
                      }}
                      draggable={false}
                   />
                </div>

                {/* Alcohol Button (Top-Right) */}
                <div 
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", position: "relative", height: "242.5px" }}
                  onClick={() => handleCategorySelect('alcohol')}
                >
                   <img 
                      src={currentCategoryAssets.alcohol} 
                      alt="Alcohol" 
                      style={{ width: "525px", height: "242.5px", objectFit: "contain" }}
                      draggable={false}
                   />
                   <img
                      src={currentCategoryAssets.alcoholHighlight}
                      alt="Alcohol Highlight"
                      style={{ 
                          position: "absolute",
                          top: 0, 
                          right: 0, // Position on the right side
                          width: "525px", height: "242.5px", objectFit: "contain",
                          opacity: selectedCategory === 'alcohol' ? 1 : 0,
                          transition: "opacity 0.2s",
                          pointerEvents: "none" 
                      }}
                      draggable={false}
                   />
                </div>
              </div>

              {/* Bottom Row: Kids, Takeout */}
              <div style={{ height: "242.5px", width: "100%", display: "flex", flexDirection: "row" }}>
                {/* Kids Button (Bottom-Left) */}
                <div 
                  style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "flex-start", position: "relative", height: "242.5px" }}
                  onClick={() => handleCategorySelect('kids')}
                >
                   <img 
                      src={currentCategoryAssets.kids} 
                      alt="Kids" 
                      style={{ width: "525px", height: "242.5px", objectFit: "contain" }}
                      draggable={false}
                   />
                   <img
                      src={currentCategoryAssets.kidsHighlight}
                      alt="Kids Highlight"
                      style={{ 
                          position: "absolute",
                          bottom: 0, left: 0,
                          width: "525px", height: "242.5px", objectFit: "contain",
                          opacity: selectedCategory === 'kids' ? 1 : 0,
                          transition: "opacity 0.2s",
                          pointerEvents: "none" 
                      }}
                      draggable={false}
                   />
                </div>

                {/* Takeout Button (Bottom-Right) */}
                <div 
                  style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", position: "relative", height: "242.5px" }}
                  onClick={() => handleCategorySelect('takeout')}
                >
                   <img 
                      src={currentCategoryAssets.takeout} 
                      alt="Takeout" 
                      style={{ width: "525px", height: "100%", objectFit: "contain" }}
                      draggable={false}
                   />
                   <img
                      src={currentCategoryAssets.takeoutHighlight}
                      alt="Takeout Highlight"
                      style={{ 
                          position: "absolute",
                          bottom: 0, 
                          right: 0, // Position on the right side
                          width: "525px", height: "100%", objectFit: "contain",
                          opacity: selectedCategory === 'takeout' ? 1 : 0,
                          transition: "opacity 0.2s",
                          pointerEvents: "none" 
                      }}
                      draggable={false}
                   />
                </div>
              </div>
              </div>
            </>
          )}
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
