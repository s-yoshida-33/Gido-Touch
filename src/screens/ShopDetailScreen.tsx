// src/screens/ShopDetailScreen.tsx
import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import buttonClose from "../assets/button-close.svg";
import buttonCloseHighlight from "../assets/button-close-highlight.svg";
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
import waonPointIcon from "../assets/waonpoint.svg";
import type { Shop } from "../types/shop";
import { ShopPin } from "../components/ShopPin";
import { LocationIconsOverlay } from "../components/LocationIconsOverlay";
import type { LocationIconSettingsPerFloor } from "../types/locationIcon";
import { getLocationIconSettingsForFloor } from "../config";
import type { FloorId } from "../types/floorLayout";

// Constants for consistent scaling (must match GidoApp)
const REFERENCE_MAP_WIDTH = 1920;
const DEFAULT_PIN_SIZE = 80;

function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) return "";
  if (photo.match(/^[A-Za-z]:[\\/]/)) return photo.replace(/\\/g, "/");
  if (photo.startsWith("file://") || photo.startsWith("http://") || photo.startsWith("https://") || photo.startsWith("data:")) return photo;
  if (photo.startsWith("/") || photo.startsWith("\\")) {
    if (photo.startsWith("\\\\")) return photo;
    if (photo.startsWith("/")) return photo;
  }
  if (shopId) {
    if (photo.includes(`shop/${shopId}/`) || photo.includes(`shop\\${shopId}\\`)) return photo;
    const normalized = photo.replace(/\\/g, "/");
    const clean = normalized.startsWith("/") ? normalized.slice(1) : normalized;
    if (!clean.includes("/")) return `files/shop/${shopId}/${clean}`;
    if (clean.startsWith("files/shop/")) return clean;
    return `files/shop/${shopId}/${clean}`;
  }
  return photo;
}

function toFileUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("file://") || filePath.startsWith("http://") || filePath.startsWith("https://") || filePath.startsWith("data:")) return filePath;
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.match(/^[A-Za-z]:\//)) return `file:///${normalized}`;
  if (normalized.startsWith("/")) return `file://${normalized}`;
  return `file:///${normalized}`;
}

// Helper function to calculate actual image dimensions (Same as GidoApp)
function calculateImageRect(
  containerWidth: number,
  containerHeight: number,
  imageNaturalWidth: number,
  imageNaturalHeight: number
) {
  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imageNaturalWidth / imageNaturalHeight;

  let displayWidth, displayHeight, offsetX, offsetY;

  if (containerAspect > imageAspect) {
    // Container is wider than image -> Image fits by height
    displayHeight = containerHeight;
    displayWidth = displayHeight * imageAspect;
    offsetY = 0;
    offsetX = (containerWidth - displayWidth) / 2;
  } else {
    // Container is taller than image -> Image fits by width
    displayWidth = containerWidth;
    displayHeight = displayWidth / imageAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayHeight) / 2;
  }

  // Use Math.round to prevent sub-pixel rendering issues
  return { 
    displayWidth: Math.round(displayWidth), 
    displayHeight: Math.round(displayHeight), 
    offsetX: Math.round(offsetX), 
    offsetY: Math.round(offsetY) 
  };
}

const ShopLogoImage: React.FC<{ photo: string | undefined; shopId: string | undefined }> = ({ photo, shopId }) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!photo) { setIsLoading(false); setHasError(true); return; }
    const loadImage = async () => {
      const imagePath = buildImagePath(photo, shopId);
      if (!imagePath) { setIsLoading(false); setHasError(true); return; }
      const electronAPI = window.electronAPI;
      if (electronAPI && electronAPI.getShopImage) {
        try {
          const normalizedPath = imagePath.replace(/\\/g, "/");
          const dataUrl = await electronAPI.getShopImage(normalizedPath);
          if (dataUrl) { setImageUrl(dataUrl); setIsLoading(false); setHasError(false); return; }
        } catch (error) { console.error(error); setHasError(true); }
      }
      const fileUrl = toFileUrl(imagePath);
      setImageUrl(fileUrl);
      setIsLoading(false);
    };
    loadImage();
  }, [photo, shopId]);

  if (hasError || (!imageUrl && !isLoading) || imageUrl === "") return null;
  if (isLoading || !imageUrl) return null;

  return (
    <img src={imageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none", pointerEvents: "auto", display: "block" }} onError={(e) => { setHasError(true); (e.target as HTMLImageElement).style.display = "none"; }} />
  );
};

const ShopImage: React.FC<{ photo: string | undefined; shopId: string | undefined }> = ({ photo, shopId }) => {
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!photo) { setIsLoading(false); return; }
    const loadImage = async () => {
      const imagePath = buildImagePath(photo, shopId);
      if (!imagePath) { setIsLoading(false); return; }
      const electronAPI = window.electronAPI;
      if (electronAPI && electronAPI.getShopImage) {
        try {
          const normalizedPath = imagePath.replace(/\\/g, "/");
          const dataUrl = await electronAPI.getShopImage(normalizedPath);
          if (dataUrl) { setImageUrl(dataUrl); setIsLoading(false); return; }
        } catch (error) { console.error(error); }
      }
      const fileUrl = toFileUrl(imagePath);
      setImageUrl(fileUrl);
      setIsLoading(false);
    };
    loadImage();
  }, [photo, shopId]);

  if (!photo || (!imageUrl && !isLoading)) return <span style={{ color: "#FFFFFF", fontSize: "24px", fontWeight: 700 }}>Image</span>;

  return (
    <img src={imageUrl} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "contain", userSelect: "none", pointerEvents: "auto", display: isLoading ? "none" : "block" }} onError={(e) => { const target = e.target as HTMLImageElement; target.style.display = "none"; if (target.parentElement) { target.parentElement.style.backgroundColor = "#333333"; target.parentElement.style.color = "#FFFFFF"; target.parentElement.style.fontSize = "24px"; target.parentElement.style.fontWeight = "700"; target.parentElement.textContent = "Image"; } }} />
  );
};

function normalizeFloor(value: string): string {
  if (!value) return "";
  const m = value.match(/(\d+)/);
  return m ? `${m[1]}F` : value;
}

const MapWithPinsComponent: React.FC<{
  mapImage: string;
  normalizedFloor: string;
  shopPosition?: Shop["position"];
  shopName: string;
  shopLogo?: string;
  shopId?: string;
  currentScale: number;
  currentFloorSetting: string;
  locationIconSettings: LocationIconSettingsPerFloor;
}> = ({ mapImage, normalizedFloor, shopPosition, shopName, shopLogo, shopId, currentScale, currentFloorSetting, locationIconSettings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageMetrics, setImageMetrics] = useState<{ 
    displayWidth: number; 
    displayHeight: number; 
    offsetX: number; 
    offsetY: number;
  } | null>(null);

  // Update metrics based on actual container and image size
  const updateMetrics = useCallback(() => {
    if (!containerRef.current || !imageRef.current) return;
    const img = imageRef.current;
    
    if (!img.complete || img.naturalWidth === 0) return;

    const metrics = calculateImageRect(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
      img.naturalWidth,
      img.naturalHeight
    );
    setImageMetrics(metrics);
  }, []);

  useEffect(() => {
    const img = imageRef.current;
    if (img) {
      if (img.complete) updateMetrics();
      else img.addEventListener('load', updateMetrics);
    }
    
    const resizeObserver = new ResizeObserver(updateMetrics);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    return () => {
      img?.removeEventListener('load', updateMetrics);
      resizeObserver.disconnect();
    };
  }, [mapImage, updateMetrics]);

  const shouldShowPin = shopPosition && shopPosition.floor === normalizedFloor && imageMetrics;
  const showLocationIcons = normalizedFloor === currentFloorSetting;
  const currentFloorIconSettings = getLocationIconSettingsForFloor(locationIconSettings, normalizedFloor as FloorId);

  // Calculate Render Props
  let renderPosition = shopPosition;
  let pixelX = 0;
  let pixelY = 0;

  if (shouldShowPin && imageMetrics && shopPosition) {
    // 1. Normalize position to 0-100 scale
    const normalizedX = shopPosition.x <= 1 ? shopPosition.x * 100 : shopPosition.x;
    const normalizedY = shopPosition.y <= 1 ? shopPosition.y * 100 : shopPosition.y;

    // 2. Scale pin size consistent with GidoApp
    const scaleRatio = imageMetrics.displayWidth / REFERENCE_MAP_WIDTH;
    const basePinSize = shopPosition.size ?? DEFAULT_PIN_SIZE;
    const scaledPinSize = basePinSize * scaleRatio;

    renderPosition = {
      ...shopPosition,
      x: normalizedX,
      y: normalizedY,
      size: scaledPinSize
    };

    // 3. Calculate exact pixel coordinates (0% = Image Left, 100% = Image Right)
    const xPercent = normalizedX / 100;
    const yPercent = normalizedY / 100;

    pixelX = Math.round(imageMetrics.offsetX + (xPercent * imageMetrics.displayWidth));
    pixelY = Math.round(imageMetrics.offsetY + (yPercent * imageMetrics.displayHeight));
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden"
      }}
    >
      <img
        ref={imageRef}
        src={mapImage}
        alt={`${normalizedFloor} map`}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }}
      />
      
      {showLocationIcons && <LocationIconsOverlay settings={currentFloorIconSettings} imageMetrics={imageMetrics} />}

      {shouldShowPin && renderPosition && (
        <ShopPin
          position={renderPosition}
          shopName={shopName}
          shopLogo={shopLogo}
          shopId={shopId}
          transformScale={currentScale}
          usePixelPosition={true}
          pixelX={pixelX}
          pixelY={pixelY}
        />
      )}
    </div>
  );
};

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
    <div ref={containerRef} style={{ fontSize: fontSize, fontFamily: "'Rounded Mplus 1c', sans-serif", fontWeight: 700, lineHeight: "1.4", width: width, whiteSpace: "nowrap", overflow: "hidden", transformOrigin: "left center", flexShrink: 0 }}>
      <div ref={textRef} style={{ display: "inline-block", transform: "scaleX(1)", whiteSpace: "nowrap", transformOrigin: "left center" }}>{name}</div>
    </div>
  );
};

interface ShopDetailScreenProps {
  shop: Shop;
  onClose: () => void;
  language?: "ja" | "en";
  currentFloorSetting: string;
  locationIconSettings: LocationIconSettingsPerFloor;
}

const ShopDetailScreen: React.FC<ShopDetailScreenProps> = ({ shop, onClose, language = "ja", currentFloorSetting, locationIconSettings }) => {
  const transformRef = useRef<any>(null);
  const [currentScale, setCurrentScale] = useState(1);
  const [zoomInHovered, setZoomInHovered] = useState(false);
  const [zoomOutHovered, setZoomOutHovered] = useState(false);
  const [zoomInClicked, setZoomInClicked] = useState(false);
  const [zoomOutClicked, setZoomOutClicked] = useState(false);
  const [resetHovered, setResetHovered] = useState(false);
  const [resetClicked, setResetClicked] = useState(false);
  const displayAreaRef = useRef<HTMLDivElement>(null);

  const floor = shop.floors && shop.floors.length > 0 ? shop.floors[0] : "";
  const normalizedFloor = normalizeFloor(String(floor));

  // Language display logic
  const displayShopName = (language === "en" && shop.nameEn) ? shop.nameEn : shop.name;
  
  const displayGenreMemo = React.useMemo(() => {
    if (language === "en" && shop.genreMemoEn) {
      return shop.genreMemoEn;
    }
    if (shop.genreMemo) {
      return shop.genreMemo.split(/[|]+/).map(s => s.trim()).filter(s => s.length > 0).slice(0, 2).join(" / ");
    }
    return "";
  }, [shop, language]);

  const isWaonPointShop = React.useMemo(() => {
    return shop.genreMemo && shop.genreMemo.includes("WAONPOINT加盟店");
  }, [shop.genreMemo]);

  const getMapImage = () => {
    switch (normalizedFloor) {
      case "1F": return food1FMap;
      case "2F": return food2FMap;
      case "3F": return food3FMap;
      case "4F": return food4FMap;
      default: return food1FMap;
    }
  };
  const getFloorLabel = () => {
    switch (normalizedFloor) {
      case "1F": return floorLabel1F;
      case "2F": return floorLabel2F;
      case "3F": return floorLabel3F;
      case "4F": return floorLabel4F;
      default: return floorLabel1F;
    }
  };

  const mapImage = getMapImage();
  const floorLabel = getFloorLabel();

  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0, 0, 0, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ width: "2500px", height: "1680px", backgroundColor: "#FFFFFF", borderRadius: "50px", position: "relative", display: "flex", flexDirection: "row", overflow: "hidden" }}>
        <div style={{ flex: 1, width: "1800px", height: "100%", backgroundColor: "#D9D9D9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div ref={displayAreaRef} style={{ width: "1700px", height: "1580px", backgroundColor: "#FFFFFF", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", top: "30px", left: "30px", zIndex: 10, pointerEvents: "none" }}>
              <img src={floorLabel} alt={`${normalizedFloor} label`} draggable={false} onDragStart={(e) => e.preventDefault()} style={{ display: "block" }} />
            </div>
            <TransformWrapper
              initialScale={1}
              minScale={1}
              maxScale={4}
              limitToBounds={true}
              disablePadding={true}
              centerOnInit={true}
              wheel={{ step: 0.05 }}
              doubleClick={{ disabled: true }}
              panning={{ disabled: currentScale <= 1.01 }}
              alignmentAnimation={{ disabled: true }}
              velocityAnimation={{ disabled: true }}
              onInit={(ref) => { transformRef.current = ref; setCurrentScale(ref.state.scale); }}
              onTransformed={(ref) => { setCurrentScale(ref.state.scale); }}
            >
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MapWithPinsComponent
                  mapImage={mapImage}
                  normalizedFloor={normalizedFloor}
                  shopPosition={shop.position}
                  shopName={displayShopName}
                  shopLogo={shop.shopLogo}
                  shopId={shop.shopId || shop.number}
                  currentScale={currentScale}
                  currentFloorSetting={currentFloorSetting}
                  locationIconSettings={locationIconSettings}
                />
              </TransformComponent>
            </TransformWrapper>
            <div style={{ position: "absolute", bottom: "30px", left: "30px", zIndex: 10, display: "flex", flexDirection: "column", gap: "0px", borderRadius: "50px", overflow: "hidden", boxShadow: "0 0px 12px rgba(0, 0, 0, 0.3)" }}>
              {/* Zoom In Button */}
              <div
                style={{ position: "relative", cursor: "pointer" }}
                onMouseEnter={() => setZoomInHovered(true)}
                onMouseLeave={() => { setZoomInHovered(false); setZoomInClicked(false); }}
                onMouseDown={() => setZoomInClicked(true)}
                onMouseUp={() => setZoomInClicked(false)}
                onTouchStart={() => setZoomInClicked(true)}
                onTouchEnd={() => setZoomInClicked(false)}
                onTouchCancel={() => setZoomInClicked(false)}
                onClick={() => {
                  setZoomInHovered(false);
                  setZoomInClicked(false);
                  if (transformRef.current) transformRef.current.zoomIn();
                }}
              >
                <img src={zoomIn} alt="Zoom in" draggable={false} style={{ display: "block" }} />
                <img src={zoomInHighlight} alt="Highlight" draggable={false} style={{ position: "absolute", top: 0, left: 0, display: "block", opacity: zoomInHovered || zoomInClicked ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* Zoom Out Button */}
              <div
                style={{ position: "relative", cursor: "pointer" }}
                onMouseEnter={() => setZoomOutHovered(true)}
                onMouseLeave={() => { setZoomOutHovered(false); setZoomOutClicked(false); }}
                onMouseDown={() => setZoomOutClicked(true)}
                onMouseUp={() => setZoomOutClicked(false)}
                onTouchStart={() => setZoomOutClicked(true)}
                onTouchEnd={() => setZoomOutClicked(false)}
                onTouchCancel={() => setZoomOutClicked(false)}
                onClick={() => {
                  setZoomOutHovered(false);
                  setZoomOutClicked(false);
                  if (transformRef.current) transformRef.current.zoomOut();
                }}
              >
                <img src={zoomOut} alt="Zoom out" draggable={false} style={{ display: "block" }} />
                <img src={zoomOutHighlight} alt="Highlight" draggable={false} style={{ position: "absolute", top: 0, left: 0, display: "block", opacity: zoomOutHovered || zoomOutClicked ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>
            <div style={{ position: "absolute", bottom: "30px", right: "30px", zIndex: 10 }}>
              <div
                style={{ position: "relative", cursor: "pointer", boxShadow: "0 0px 12px rgba(0, 0, 0, 0.3)", borderRadius: "50px", overflow: "hidden" }}
                onMouseEnter={() => setResetHovered(true)}
                onMouseLeave={() => { setResetHovered(false); setResetClicked(false); }}
                onMouseDown={() => setResetClicked(true)}
                onMouseUp={() => setResetClicked(false)}
                onTouchStart={() => setResetClicked(true)}
                onTouchEnd={() => setResetClicked(false)}
                onTouchCancel={() => setResetClicked(false)}
                onClick={() => {
                  setResetHovered(false);
                  setResetClicked(false);
                  if (transformRef.current) transformRef.current.resetTransform();
                }}
              >
                <img src={reset} alt="Reset" draggable={false} style={{ display: "block" }} />
                <img src={resetHighlight} alt="Highlight" draggable={false} style={{ position: "absolute", top: 0, left: 0, display: "block", opacity: resetHovered || resetClicked ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ width: "700px", height: "100%", flexShrink: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ width: "100%", height: "394px", backgroundColor: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>
            <ShopImage photo={shop.photo2 || shop.photo1} shopId={shop.shopId} />
          </div>
          
          <div style={{ marginTop: "50px", marginLeft: "30px", marginRight: "30px", marginBottom: "30px", display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
            {(shop.shopLogo || shop.shopId) && (
              <div style={{ width: "200px", height: "200px", borderRadius: "20px", border: "2px solid #D9D9D9", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "#FFFFFF", boxSizing: "border-box", padding: "10px", flexShrink: 0 }}>
                <ShopLogoImage photo={shop.shopLogo || (shop.shopId ? `files/shop/${shop.shopId}/shop_logo.png` : undefined)} shopId={shop.shopId} />
              </div>
            )}
            <ShopNameDisplay name={displayShopName} width="410px" fontSize="32px" />
          </div>

          <div style={{ 
            flexGrow: 0,
            flexShrink: 1,
            flexBasis: "auto",
            overflowY: "auto", 
            minHeight: 0,
            width: "640px", 
            marginLeft: "30px", 
            marginRight: "10px", // Scrollbar space
            paddingRight: "20px", // Content spacing from scrollbar
            marginBottom: "30px",
          }}>
            <style>
              {`
                div::-webkit-scrollbar {
                  width: 8px;
                }
                div::-webkit-scrollbar-track {
                  background: #f1f1f1;
                  border-radius: 4px;
                }
                div::-webkit-scrollbar-thumb {
                  background: #c1c1c1;
                  border-radius: 4px;
                }
                div::-webkit-scrollbar-thumb:hover {
                  background: #a8a8a8;
                }
                /* Disable link styles in description and all possible children */
                .shop-description a,
                .shop-description u,
                .shop-description span {
                  text-decoration: none !important;
                  color: inherit !important;
                  pointer-events: none !important;
                  border-bottom: none !important;
                }
                /* Catch-all for any underlined element */
                .shop-description * {
                  text-decoration: none !important;
                }
              `}
            </style>
            
            {shop.description && (
              <div 
                className="shop-description"
                style={{ fontSize: "24px", fontFamily: "'Rounded Mplus 1c', sans-serif", fontWeight: 400, color: "#000000", lineHeight: "1.6", wordWrap: "break-word", pointerEvents: "none" }}
                dangerouslySetInnerHTML={{ __html: shop.description }}
              />
            )}
            
            {/* Scrollable content continues here if description is long */}
          </div>

          {/* Category Area - WAON POINT */}
          {isWaonPointShop && (
            <div style={{ flexShrink: 0, width: "100%" }}>
              <div style={{ width: "640px", height: "1px", backgroundColor: "#D9D9D9", marginLeft: "30px", marginRight: "30px", marginBottom: "30px" }} />
              <div style={{ marginLeft: "30px", marginRight: "30px", marginBottom: "30px" }}>
                <img src={waonPointIcon} alt="WAON POINT" draggable={false} onDragStart={(e) => e.preventDefault()} style={{ width: "70px", height: "70px", display: "block" }} />
              </div>
            </div>
          )}

          {/* Fixed Footer Info */}
          <div style={{ flexShrink: 0, width: "100%" }}>
            <div style={{ width: "640px", height: "1px", backgroundColor: "#D9D9D9", marginLeft: "30px", marginRight: "30px", marginBottom: "30px" }} />
            
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "30px", marginRight: "30px", marginBottom: "30px", fontSize: "24px", fontFamily: "'Rounded Mplus 1c', sans-serif", fontWeight: 400, color: "#000000" }}>
              <img src={iconLocation} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} style={{ width: "24px", height: "24px", flexShrink: 0 }} />
              {shop.floors && shop.floors.length > 0 && <span>{normalizeFloor(shop.floors[0])}</span>}
              {shop.number && <span>[{shop.number}]</span>}
              {displayGenreMemo && (<><span>/</span><span>{displayGenreMemo}</span></>)}
            </div>
            
            {shop.openTime && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "30px", marginRight: "30px", marginBottom: "30px", fontSize: "24px", fontFamily: "'Rounded Mplus 1c', sans-serif", fontWeight: 400, color: "#000000" }}>
                  <img src={iconTime} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} style={{ width: "24px", height: "24px", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.4" }} dangerouslySetInnerHTML={{ __html: shop.openTime }} />
              </div>
            )}
            
            {shop.tel && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "30px", marginRight: "30px", marginBottom: "30px", fontSize: "24px", fontFamily: "'Rounded Mplus 1c', sans-serif", fontWeight: 400, color: "#000000" }}>
                <img src={iconTel} alt="" draggable={false} onDragStart={(e) => e.preventDefault()} style={{ width: "24px", height: "24px", flexShrink: 0 }} />
                <span>{shop.tel}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{ position: "absolute", top: "calc(50% - 840px)", right: "calc(50% - 1250px)", transform: "translateY(-100%)", marginTop: "-30px", width: "140px", height: "140px", border: "none", background: "transparent", cursor: "pointer", padding: 0, zIndex: 1001 }}
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
        <img src={buttonClose} alt="Close" draggable={false} onDragStart={(e) => e.preventDefault()} style={{ width: "100%", height: "100%", display: "block", position: "relative", zIndex: 1 }} />
        <img 
          src={buttonCloseHighlight} 
          alt="Close Highlight" 
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
            opacity: 0, 
            transition: "opacity 0.3s ease-in-out", 
            pointerEvents: "none",
            zIndex: 2
          }} 
        />
      </div>
    </div>
  );
};

export default ShopDetailScreen;