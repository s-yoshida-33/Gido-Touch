// src/screens/ShopDetailScreen.tsx
import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import buttonClose from "../assets/button-close.svg";
import food1FMap from "../assets/food-1F-map.svg";
import food2FMap from "../assets/food-2F-map.svg";
import food3FMap from "../assets/food-3F-map.svg";
import food4FMap from "../assets/food-4F-map.svg";
import floorLabel1F from "../assets/floor-label-1F.svg";
import floorLabel2F from "../assets/floor-label-2F.svg";
import floorLabel3F from "../assets/floor-label-3F.svg";
import floorLabel4F from "../assets/floor-label-4F.svg";
import zoomIn from "../assets/zoom-in.svg";
import zoomOut from "../assets/zoom-out.svg";
import zoomInHighlight from "../assets/zoom-in-highlight.svg";
import zoomOutHighlight from "../assets/zoom-out-highlight.svg";
import reset from "../assets/reset.svg";
import resetHighlight from "../assets/reset-highlight.svg";
import iconLocation from "../assets/icon-location.svg";
import iconTime from "../assets/icon-time.svg";
import iconTel from "../assets/icon-tel.svg";
import type { Shop } from "../types/shop";

/**
 * Build image path using shop_id if photo is relative or filename only
 * Expected full path format: C:\Users\...\AppData\Roaming\TTI\BridgeWebPopper\files\shop\{shop_id}\photo2.png
 */
function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) {
    if (shopId) {
      return "";
    }
    return "";
  }
  
  // If already a full path (contains drive letter like C:\), normalize and return
  if (photo.match(/^[A-Za-z]:[\\/]/)) {
    // Normalize mixed slashes to forward slashes for consistency
    // Keep the drive letter format (C:/ instead of C:\) for better compatibility
    return photo.replace(/\\/g, "/");
  }
  
  // If already a URL (file://, http://, https://, or data:), return as is
  if (photo.startsWith("file://") || 
      photo.startsWith("http://") || 
      photo.startsWith("https://") ||
      photo.startsWith("data:")) {
    return photo;
  }
  
  // If starts with absolute path markers (/, \), might be absolute path
  if (photo.startsWith("/") || photo.startsWith("\\")) {
    if (photo.startsWith("\\\\")) {
      return photo;
    }
    if (photo.startsWith("/")) {
      return photo;
    }
  }
  
  // If shop_id is available and photo is relative or filename only, build path
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
    
    if (cleanPhoto.startsWith("files/shop/")) {
      return cleanPhoto;
    }
    return `files/shop/${shopId}/${cleanPhoto}`;
  }
  
  return photo;
}

/**
 * Convert a local file path to a file:// URL for Electron
 */
function toFileUrl(filePath: string): string {
  if (!filePath) return "";
  
  if (filePath.startsWith("file://") || 
      filePath.startsWith("http://") || 
      filePath.startsWith("https://") ||
      filePath.startsWith("data:")) {
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

/**
 * Shop logo component that loads logo images via Electron IPC or falls back to file:// URL
 */
const ShopLogoImage: React.FC<{ photo: string | undefined; shopId: string | undefined }> = ({ photo, shopId }) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!photo) {
      setIsLoading(false);
      setHasError(true);
      return;
    }

    const loadImage = async () => {
      console.log("ShopLogoImage - Original photo:", photo, "shopId:", shopId);
      const imagePath = buildImagePath(photo, shopId);
      console.log("ShopLogoImage - Built image path:", imagePath);
      if (!imagePath) {
        setIsLoading(false);
        setHasError(true);
        return;
      }

      const electronAPI = window.electronAPI;
      if (electronAPI && electronAPI.getShopImage) {
        try {
          // For Windows paths, convert to forward slashes for IPC
          const normalizedPath = imagePath.replace(/\\/g, "/");
          console.log("ShopLogoImage - Normalized path for IPC:", normalizedPath);
          const dataUrl = await electronAPI.getShopImage(normalizedPath);
          if (dataUrl) {
            console.log("ShopLogoImage - Successfully loaded via IPC");
            setImageUrl(dataUrl);
            setIsLoading(false);
            setHasError(false);
            return;
          } else {
            console.log("ShopLogoImage - IPC returned null/undefined");
          }
        } catch (error) {
          console.error("Failed to load logo via IPC:", error, "Path:", imagePath);
          setHasError(true);
        }
      }

      const fileUrl = toFileUrl(imagePath);
      console.log("ShopLogoImage - File URL:", fileUrl);
      setImageUrl(fileUrl);
      setIsLoading(false);
    };

    loadImage();
  }, [photo, shopId]);

  if (hasError || (!imageUrl && !isLoading) || imageUrl === "") {
    return null; // Don't show anything if logo fails to load or URL is empty
  }

  if (isLoading || !imageUrl) {
    return null; // Don't render img element while loading or if URL is empty
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
        console.error("Failed to load logo image:", imageUrl);
        setHasError(true);
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
      }}
    />
  );
};

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

      const electronAPI = window.electronAPI;
      if (electronAPI && electronAPI.getShopImage) {
        try {
          // For Windows paths, convert to forward slashes for IPC
          const normalizedPath = imagePath.replace(/\\/g, "/");
          const dataUrl = await electronAPI.getShopImage(normalizedPath);
          if (dataUrl) {
            setImageUrl(dataUrl);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Failed to load image via IPC:", error, "Path:", imagePath);
        }
      }

      const fileUrl = toFileUrl(imagePath);
      setImageUrl(fileUrl);
      setIsLoading(false);
    };

    loadImage();
  }, [photo, shopId]);

  if (!photo || (!imageUrl && !isLoading)) {
    return (
      <span style={{ color: "#FFFFFF", fontSize: "24px", fontWeight: 700 }}>
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
        const target = e.target as HTMLImageElement;
        target.style.display = "none";
        if (target.parentElement) {
          target.parentElement.style.backgroundColor = "#333333";
          target.parentElement.style.color = "#FFFFFF";
          target.parentElement.style.fontSize = "24px";
          target.parentElement.style.fontWeight = "700";
          target.parentElement.textContent = "Image";
        }
      }}
    />
  );
};

/**
 * Normalize floor value to standard format (e.g., "1" -> "1F", "1F" -> "1F")
 */
function normalizeFloor(value: string): string {
  if (!value) return "";
  const m = value.match(/(\d+)/);
  return m ? `${m[1]}F` : value;
}

/**
 * Shop name display component that scales text to fit width (same as ShopListScreen)
 */
const ShopNameDisplay: React.FC<{ name: string; width: string; fontSize: string }> = ({ name, width, fontSize }) => {
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
        fontSize: fontSize,
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        fontWeight: 700,
        lineHeight: "1.4",
        width: width,
        whiteSpace: "nowrap",
        overflow: "hidden",
        transformOrigin: "left center",
        flexShrink: 0,
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


interface ShopDetailScreenProps {
  shop: Shop;
  onClose: () => void;
}

/**
 * Shop detail modal screen
 * Modal size: 2500×1680px
 * Background overlay: #000000 70%
 * Modal corner radius: 50px
 * Close button: 140×140px, positioned outside modal at top-right, 30px above modal
 */
const ShopDetailScreen: React.FC<ShopDetailScreenProps> = ({ shop, onClose }) => {
  // Transform wrapper ref for programmatic control
  const transformRef = useRef<{
    zoomIn: (step?: number) => void;
    zoomOut: (step?: number) => void;
    resetTransform: () => void;
    setTransform: (x: number, y: number, scale: number) => void;
    centerView: (scale?: number) => void;
    state: {
      scale: number;
      positionX: number;
      positionY: number;
    };
  } | null>(null);

  // Zoom button hover states
  const [zoomInHovered, setZoomInHovered] = useState(false);
  const [zoomOutHovered, setZoomOutHovered] = useState(false);
  const [zoomInClicked, setZoomInClicked] = useState(false);
  const [zoomOutClicked, setZoomOutClicked] = useState(false);
  
  // Reset button hover states
  const [resetHovered, setResetHovered] = useState(false);
  const [resetClicked, setResetClicked] = useState(false);

  // Display area ref for calculating viewport center
  const displayAreaRef = useRef<HTMLDivElement>(null);

  // Current scale state to control panning
  const [currentScale, setCurrentScale] = useState(1);

  // Get first floor for map display
  const floor = shop.floors && shop.floors.length > 0 ? shop.floors[0] : "";
  const normalizedFloor = normalizeFloor(String(floor));

  // Select map based on floor
  const getMapImage = () => {
    switch (normalizedFloor) {
      case "1F":
        return food1FMap;
      case "2F":
        return food2FMap;
      case "3F":
        return food3FMap;
      case "4F":
        return food4FMap;
      default:
        return food1FMap; // Default to 1F if floor is not recognized
    }
  };

  // Select floor label based on floor
  const getFloorLabel = () => {
    switch (normalizedFloor) {
      case "1F":
        return floorLabel1F;
      case "2F":
        return floorLabel2F;
      case "3F":
        return floorLabel3F;
      case "4F":
        return floorLabel4F;
      default:
        return floorLabel1F; // Default to 1F if floor is not recognized
    }
  };

  const mapImage = getMapImage();
  const floorLabel = getFloorLabel();

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      {/* Modal */}
      <div
        style={{
          width: "2500px",
          height: "1680px",
          backgroundColor: "#FFFFFF",
          borderRadius: "50px",
          position: "relative",
          display: "flex",
          flexDirection: "row",
          overflow: "hidden",
        }}
      >
        {/* Left area */}
        <div
          style={{
            flex: 1,
            width: "1800px",
            height: "100%",
            backgroundColor: "#D9D9D9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Display area */}
          <div
            ref={displayAreaRef}
            style={{
              width: "1700px",
              height: "1580px",
              backgroundColor: "#FFFFFF",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* Floor label - positioned at top-left */}
            <div
              style={{
                position: "absolute",
                top: "30px",
                left: "30px",
                zIndex: 10,
                pointerEvents: "none",
              }}
            >
              <img
                src={floorLabel}
                alt={`${normalizedFloor} label`}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  display: "block",
                }}
              />
            </div>
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={4}
              limitToBounds={currentScale > 1}
              centerOnInit={true}
              wheel={{
                step: 0.05,
              }}
              doubleClick={{
                disabled: true,
              }}
              panning={{
                disabled: currentScale === 1,
              }}
              onInit={(ref) => {
                transformRef.current = ref;
                setCurrentScale(ref.state.scale);
              }}
              onTransformed={(ref) => {
                setCurrentScale(ref.state.scale);
              }}
            >
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                }}
                contentStyle={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={mapImage}
                  alt={`${normalizedFloor} map`}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
            {/* Zoom controls - positioned at bottom-left */}
            <div
              style={{
                position: "absolute",
                bottom: "30px",
                left: "30px",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                gap: "0px",
                borderRadius: "50px",
                overflow: "hidden",
                boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
              }}
            >
              {/* Zoom in button */}
              <div
                style={{
                  position: "relative",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setZoomInHovered(true)}
                onMouseLeave={() => {
                  setZoomInHovered(false);
                  setZoomInClicked(false);
                }}
                onMouseDown={() => setZoomInClicked(true)}
                onMouseUp={() => setZoomInClicked(false)}
                onTouchStart={() => {
                  setZoomInHovered(true);
                  setZoomInClicked(true);
                }}
                onTouchEnd={() => {
                  // Use setTimeout to ensure highlight is visible briefly, then remove
                  setTimeout(() => {
                    setZoomInHovered(false);
                    setZoomInClicked(false);
                  }, 100);
                }}
                onTouchCancel={() => {
                  setZoomInHovered(false);
                  setZoomInClicked(false);
                }}
                onClick={() => {
                  // Reset highlight immediately on click
                  setZoomInHovered(false);
                  setZoomInClicked(false);
                  
                  if (transformRef.current && displayAreaRef.current) {
                    const currentScale = transformRef.current.state.scale;
                    const newScale = Math.min(currentScale * 1.5, 4); // 50% increase, max 400%
                    
                    // Calculate viewport center
                    const viewportWidth = displayAreaRef.current.clientWidth;
                    const viewportHeight = displayAreaRef.current.clientHeight;
                    const viewportCenterX = viewportWidth / 2;
                    const viewportCenterY = viewportHeight / 2;
                    
                    // Calculate content point at viewport center
                    const currentX = transformRef.current.state.positionX;
                    const currentY = transformRef.current.state.positionY;
                    const contentPointX = (viewportCenterX - currentX) / currentScale;
                    const contentPointY = (viewportCenterY - currentY) / currentScale;
                    
                    // Calculate new position to keep the same content point at viewport center
                    const newX = viewportCenterX - (contentPointX * newScale);
                    const newY = viewportCenterY - (contentPointY * newScale);
                    
                    transformRef.current.setTransform(newX, newY, newScale);
                  }
                }}
              >
                <img
                  src={zoomIn}
                  alt="Zoom in"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={zoomInHighlight}
                  alt="Zoom in highlight"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: zoomInHovered || zoomInClicked ? 1 : 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
              </div>
              {/* Zoom out button */}
              <div
                style={{
                  position: "relative",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setZoomOutHovered(true)}
                onMouseLeave={() => {
                  setZoomOutHovered(false);
                  setZoomOutClicked(false);
                }}
                onMouseDown={() => setZoomOutClicked(true)}
                onMouseUp={() => setZoomOutClicked(false)}
                onTouchStart={() => {
                  setZoomOutHovered(true);
                  setZoomOutClicked(true);
                }}
                onTouchEnd={() => {
                  // Use setTimeout to ensure highlight is visible briefly, then remove
                  setTimeout(() => {
                    setZoomOutHovered(false);
                    setZoomOutClicked(false);
                  }, 100);
                }}
                onTouchCancel={() => {
                  setZoomOutHovered(false);
                  setZoomOutClicked(false);
                }}
                onClick={() => {
                  // Reset highlight immediately on click
                  setZoomOutHovered(false);
                  setZoomOutClicked(false);
                  
                  if (transformRef.current && displayAreaRef.current) {
                    const currentScale = transformRef.current.state.scale;
                    const newScale = Math.max(currentScale / 1.5, 1); // 50% decrease, min 100%
                    
                    // Calculate viewport center
                    const viewportWidth = displayAreaRef.current.clientWidth;
                    const viewportHeight = displayAreaRef.current.clientHeight;
                    const viewportCenterX = viewportWidth / 2;
                    const viewportCenterY = viewportHeight / 2;
                    
                    // Calculate content point at viewport center
                    const currentX = transformRef.current.state.positionX;
                    const currentY = transformRef.current.state.positionY;
                    const contentPointX = (viewportCenterX - currentX) / currentScale;
                    const contentPointY = (viewportCenterY - currentY) / currentScale;
                    
                    // Calculate new position to keep the same content point at viewport center
                    const newX = viewportCenterX - (contentPointX * newScale);
                    const newY = viewportCenterY - (contentPointY * newScale);
                    
                    transformRef.current.setTransform(newX, newY, newScale);
                  }
                }}
              >
                <img
                  src={zoomOut}
                  alt="Zoom out"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={zoomOutHighlight}
                  alt="Zoom out highlight"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: zoomOutHovered || zoomOutClicked ? 1 : 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
            {/* Reset button - positioned at bottom-right */}
            <div
              style={{
                position: "absolute",
                bottom: "30px",
                right: "30px",
                zIndex: 10,
              }}
            >
              <div
                style={{
                  position: "relative",
                  cursor: "pointer",
                  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.3)",
                  borderRadius: "50px",
                  overflow: "hidden",
                }}
                onMouseEnter={() => setResetHovered(true)}
                onMouseLeave={() => {
                  setResetHovered(false);
                  setResetClicked(false);
                }}
                onMouseDown={() => setResetClicked(true)}
                onMouseUp={() => setResetClicked(false)}
                onTouchStart={() => {
                  setResetHovered(true);
                  setResetClicked(true);
                }}
                onTouchEnd={() => {
                  // Use setTimeout to ensure highlight is visible briefly, then remove
                  setTimeout(() => {
                    setResetHovered(false);
                    setResetClicked(false);
                  }, 100);
                }}
                onTouchCancel={() => {
                  setResetHovered(false);
                  setResetClicked(false);
                }}
                onClick={() => {
                  // Reset highlight immediately on click
                  setResetHovered(false);
                  setResetClicked(false);
                  
                  if (transformRef.current) {
                    transformRef.current.resetTransform();
                  }
                }}
              >
                <img
                  src={reset}
                  alt="Reset"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={resetHighlight}
                  alt="Reset highlight"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: resetHovered || resetClicked ? 1 : 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Right detail area */}
        <div
          style={{
            width: "700px",
            height: "100%",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Shop image display area */}
          <div
            style={{
              width: "100%",
              height: "394px",
              backgroundColor: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <ShopImage photo={shop.photo2 || shop.photo1} shopId={shop.shopId} />
          </div>
          {/* Shop logo and name */}
          <div
            style={{
              marginTop: "50px",
              marginLeft: "30px",
              marginRight: "30px",
              marginBottom: "30px",
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            {/* Shop logo */}
            {(() => {
              // Try to get logo from shop.shopLogo, or construct default path if shopId exists
              const logoPath = shop.shopLogo || (shop.shopId ? `files/shop/${shop.shopId}/shop_logo.png` : undefined);
              console.log("Shop logo check:", {
                shopLogo: shop.shopLogo,
                shopId: shop.shopId,
                constructedLogoPath: logoPath,
              });
              return logoPath;
            })() && (
              <div
                style={{
                  width: "200px",
                  height: "200px",
                  borderRadius: "20px",
                  border: "1px solid #D9D9D9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  backgroundColor: "#FFFFFF",
                  boxSizing: "border-box",
                  padding: "10px",
                  flexShrink: 0,
                }}
              >
                <ShopLogoImage 
                  photo={shop.shopLogo || (shop.shopId ? `files/shop/${shop.shopId}/shop_logo.png` : undefined)} 
                  shopId={shop.shopId} 
                />
              </div>
            )}
            {/* Shop name */}
            <ShopNameDisplay name={shop.name} width="410px" fontSize="32px" />
          </div>
          {/* Shop description */}
          {shop.description && (
            <div
              style={{
                fontSize: "24px",
                fontFamily: "'Rounded Mplus 1c', sans-serif",
                fontWeight: 400,
                width: "640px",
                marginLeft: "30px",
                marginRight: "30px",
                marginBottom: "30px",
                color: "#000000",
                lineHeight: "1.6",
                wordWrap: "break-word",
                whiteSpace: "pre-wrap",
              }}
            >
              {shop.description}
            </div>
          )}
          {/* Divider line */}
          <div
            style={{
              width: "640px",
              height: "1px",
              backgroundColor: "#D9D9D9",
              marginLeft: "30px",
              marginRight: "30px",
              marginBottom: "30px",
            }}
          />
          {/* Floor information */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginLeft: "30px",
              marginRight: "30px",
              marginBottom: "30px",
              fontSize: "24px",
              fontFamily: "'Rounded Mplus 1c', sans-serif",
              fontWeight: 400,
              color: "#000000",
            }}
          >
            {/* Location icon */}
            <img
              src={iconLocation}
              alt=""
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              style={{
                width: "24px",
                height: "24px",
                flexShrink: 0,
              }}
            />
            {/* Floor */}
            {shop.floors && shop.floors.length > 0 && (
              <span>{normalizeFloor(shop.floors[0])}</span>
            )}
            {/* Number */}
            {shop.number && (
              <span>[{shop.number}]</span>
            )}
            {/* Genre memo */}
            {shop.genreMemo && (
              <>
                <span>/</span>
                <span>{shop.genreMemo}</span>
              </>
            )}
          </div>
          {/* Opening hours */}
          {shop.openTime && (() => {
            // Split at 】 if found
            const closingBracketIndex = shop.openTime.indexOf("】");
            const hasBracket = closingBracketIndex !== -1;
            let firstLine = shop.openTime;
            let secondLine = "";
            
            if (hasBracket) {
              firstLine = shop.openTime.substring(0, closingBracketIndex + 1);
              secondLine = shop.openTime.substring(closingBracketIndex + 1);
            }
            
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginLeft: "30px",
                  marginRight: "30px",
                  marginBottom: "30px",
                  fontSize: "24px",
                  fontFamily: "'Rounded Mplus 1c', sans-serif",
                  fontWeight: 400,
                  color: "#000000",
                }}
              >
                {/* Time icon */}
                <img
                  src={iconTime}
                  alt=""
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  style={{
                    width: "24px",
                    height: "24px",
                    flexShrink: 0,
                  }}
                />
                {/* Opening hours text */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    lineHeight: "1.4",
                  }}
                >
                  <span>{firstLine}</span>
                  {secondLine && <span>{secondLine}</span>}
                </div>
              </div>
            );
          })()}
          {/* Phone number */}
          {shop.tel && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginLeft: "30px",
                marginRight: "30px",
                marginBottom: "30px",
                fontSize: "24px",
                fontFamily: "'Rounded Mplus 1c', sans-serif",
                fontWeight: 400,
                color: "#000000",
              }}
            >
              {/* Tel icon */}
              <img
                src={iconTel}
                alt=""
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                style={{
                  width: "24px",
                  height: "24px",
                  flexShrink: 0,
                }}
              />
              {/* Phone number text */}
              <span>{shop.tel}</span>
            </div>
          )}
        </div>
      </div>
      {/* Close button - positioned outside modal, at top-right corner, aligned to modal's right edge */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: "absolute",
          top: "calc(50% - 840px)",
          right: "calc(50% - 1250px)",
          transform: "translateY(-100%)",
          marginTop: "-30px",
          width: "140px",
          height: "140px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          padding: 0,
          zIndex: 1001,
        }}
      >
        <img
          src={buttonClose}
          alt="Close"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
          }}
        />
      </button>
    </div>
  );
};

export default ShopDetailScreen;

