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
import selectLanguage from "../assets/select-language.svg";
import openTime from "../assets/open-time.svg";
import prev from "../assets/button-prev.svg";
import next from "../assets/button-next.svg";
import { fetchShops } from "../repositories/shopRepository";
import type { Shop } from "../types/shop";
import ShopDetailScreen from "./ShopDetailScreen";

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

/**
 * Shop list screen
 * Screen size: 3840×2160
 * Background: Black
 * Shop list area: 2640×2160 (left side)
 * Shop list area background: #FDE7C6
 * Action space: 1140×2160 (right side)
 * Action space background: Black
 */
const ShopListScreen: React.FC = () => {
  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag scroll state
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  // Shop data state
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Floor filter state
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  
  // Selected shop for detail modal
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);

  // Scroll position state for navigation buttons
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [canScroll, setCanScroll] = useState(false);

  // Fetch shops from API
  useEffect(() => {
    let cancelled = false;

    const loadShops = async () => {
      try {
        const data = await fetchShops();
        if (cancelled) return;

        // Filter shops: only "飲食店・食品" genre
        const filtered = data.filter((shop) => shop.genre === "飲食店・食品");

        // Exclude "イオン堺北花田店"
        const excluded = filtered.filter((shop) => !shop.name.includes("イオン堺北花田店"));

        // Clean shop names (remove furigana in brackets)
        const cleaned = excluded.map((s) => ({
          ...s,
          name: s.name.replace(/【.*?】/g, "").trim(),
        }));

        setShops(cleaned);
        setError(null);
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;

        const message = e?.message ?? "failed to load";
        setError(message);
      }
    };

    loadShops();

    return () => {
      cancelled = true;
    };
  }, []);

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
    // Use setTimeout to ensure layout is complete after animation
    const timer1 = setTimeout(() => {
      handleScroll();
    }, 100);
    
    // Also check after a longer delay to catch animation completion
    const timer2 = setTimeout(() => {
      handleScroll();
    }, 400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
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

  // Scroll to start
  const scrollToStart = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ left: 0, behavior: "smooth" });
    }
  };

  // Scroll to end
  const scrollToEnd = () => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
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
            <button
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
            </button>
          )}
          {/* Next button (right side) */}
          {canScroll && scrollPercentage <= 50 && (
            <button
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
            </button>
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
                <div style={{ padding: "30px", color: "red", fontSize: "24px" }}>
                  Error: {error}
                </div>
              ) : filteredShops.length === 0 ? (
                <div style={{ padding: "30px", color: "#FFFFFF", fontSize: "24px" }}>
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
                    // Get first genre memo only (if multiple, take the first one)
                    const genreMemo = shop.genreMemo 
                      ? shop.genreMemo.split(/[,、，\s]+/)[0].trim() 
                      : "";
                    // Format first line: "フロア [区画番号] ジャンルメモ"
                    const firstLine = `${floor} [${shop.number}] ${genreMemo}`;

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
                          <ShopNameDisplay name={shop.name} />
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
        {selectedShop && (
          <ShopDetailScreen shop={selectedShop} onClose={() => setSelectedShop(null)} />
        )}
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
            height: "608px",
            marginTop: "30px",
            marginLeft: "30px",
            marginRight: "30px",
            marginBottom: "0px",
            boxSizing: "border-box",
            overflow: "hidden",
            alignSelf: "flex-start",
          }}
        >
          <IndependentVideoPlayer />
        </div>

        {/* Bottom area container (floor buttons + CMS) */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Floor selection button area and business hours / language selection area (above CMS area) */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              marginLeft: "30px",
              marginBottom: "30px",
            }}
          >
          {/* Floor selection button area (left side) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "20px",
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
                }}
                onClick={() => {
                  // If same floor is selected, deselect (show all shops)
                  // Otherwise, select the clicked floor
                  if (selectedFloor === "3F") {
                    setSelectedFloor(null);
                  } else {
                    setSelectedFloor("3F");
                  }
                }}
                onMouseEnter={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "3F" && highlight) {
                    highlight.style.opacity = "0";
                  }
                }}
                onTouchStart={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onTouchEnd={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "3F" && highlight) {
                    highlight.style.opacity = "0";
                  }
                }}
                onTouchCancel={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "3F" && highlight) {
                    highlight.style.opacity = "0";
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
                }}
                onClick={() => {
                  // If same floor is selected, deselect (show all shops)
                  // Otherwise, select the clicked floor
                  if (selectedFloor === "2F") {
                    setSelectedFloor(null);
                  } else {
                    setSelectedFloor("2F");
                  }
                }}
                onMouseEnter={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "2F" && highlight) {
                    highlight.style.opacity = "0";
                  }
                }}
                onTouchStart={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onTouchEnd={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "2F" && highlight) {
                    highlight.style.opacity = "0";
                  }
                }}
                onTouchCancel={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "2F" && highlight) {
                    highlight.style.opacity = "0";
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
                }}
                onClick={() => {
                  // If same floor is selected, deselect (show all shops)
                  // Otherwise, select the clicked floor
                  if (selectedFloor === "1F") {
                    setSelectedFloor(null);
                  } else {
                    setSelectedFloor("1F");
                  }
                }}
                onMouseEnter={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "1F" && highlight) {
                    highlight.style.opacity = "0";
                  }
                }}
                onTouchStart={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onTouchEnd={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "1F" && highlight) {
                    highlight.style.opacity = "0";
                  }
                }}
                onTouchCancel={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  // Keep highlight visible if this floor is selected
                  if (selectedFloor !== "1F" && highlight) {
                    highlight.style.opacity = "0";
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
            <img
              src={selectLanguage}
              alt="Select Language"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{
                display: "block",
              }}
            />
          </div>
          </div>

          {/* CMS area (bottom) */}
          <div
            style={{
              width: "1080px",
              height: "844px",
              margin: "30px",
              marginTop: "0px",
              marginBottom: "30px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              <VerticalVideoSlot useRightTopVideoCms={true} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopListScreen;






