// src/components/ShopPin.tsx
import React, { useState, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import type { ShopPosition } from "../types/shop";
import type { AnimationConfig } from "../types/locationIcon";
import speechBubbleIcon from "../assets/location/shop.svg";
import { getShopImageDataUrl } from "../utils/imageUtils";
import "../styles/location-icons.css";

const dropInVariants: Variants = {
  hidden: {
    y: -100,
    opacity: 0
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20
    }
  }
};

interface ShopPinProps {
  position: ShopPosition;
  shopName: string;
  isSelected?: boolean;
  shopLogo?: string;
  shopId?: string;
  transformScale?: number;
  style?: React.CSSProperties;
  // Props for absolute pixel positioning
  usePixelPosition?: boolean;
  pixelX?: number;
  pixelY?: number;
  delay?: number;
}

function buildShadowStyle(shadow?: ShopPosition['shadow']): React.CSSProperties {
  if (!shadow || !shadow.enabled) {
    return {};
  }
  return {
    filter: `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0, 0, 0, ${shadow.opacity}))`,
  };
}

function getAnimationClass(animation?: AnimationConfig): string {
  if (!animation || !animation.enabled || animation.type === "none") return "";
  switch (animation.type) {
    case "floating":   return "anim-floating";
    case "pulse":      return "anim-pulse";
    case "bounce":     return "anim-bounce";
    case "blink":      return ""; // handled by ripple overlay
    case "spin-float": return "anim-spin-float";
    case "spin-loop":  return "anim-spin-loop";
    default:           return "";
  }
}

function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) return "";

  if (photo.match(/^[A-Za-z]:[\\/]/)) {
    return photo.replace(/\\/g, "/");
  }

  if (photo.startsWith("file://") ||
      photo.startsWith("http://") ||
      photo.startsWith("https://") ||
      photo.startsWith("data:")) {
    return photo;
  }

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

    if (cleanPhoto.startsWith("files/shop/")) {
      return cleanPhoto;
    }
    return `files/shop/${shopId}/${cleanPhoto}`;
  }

  return photo;
}

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

export const ShopPin: React.FC<ShopPinProps> = ({
  position,
  shopName,
  isSelected = false,
  shopLogo,
  shopId,
  transformScale = 1,
  style,
  usePixelPosition = false,
  pixelX,
  pixelY,
  delay = 0
}) => {
  const size = position.size ?? 80;
  const rotation = position.rotation ?? 0;
  const shadow = position.shadow;
  const animation = position.animation;
  const fixedAmplitude = animation?.amplitude ? animation.amplitude : 0;

  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoLoading, setLogoLoading] = useState(true);

  useEffect(() => {
    if (position.enabled === false) return;

    const logoPath = shopLogo || (shopId ? `files/shop/${shopId}/shop_logo.png` : undefined);

    if (!logoPath) {
      setLogoLoading(false);
      return;
    }

    const loadLogo = async () => {
      const imagePath = buildImagePath(logoPath, shopId);
      if (!imagePath) {
        setLogoLoading(false);
        return;
      }

      try {
        const normalizedPath = imagePath.replace(/\\/g, "/");
        const dataUrl = await getShopImageDataUrl(normalizedPath);
        if (dataUrl) {
          setLogoUrl(dataUrl);
          setLogoLoading(false);
          return;
        }
      } catch (error) {
        console.error("Failed to load logo via IPC:", error);
      }

      const fileUrl = toFileUrl(imagePath);
      setLogoUrl(fileUrl);
      setLogoLoading(false);
    };

    loadLogo();
  }, [shopLogo, shopId, position.enabled]);

  // Delay animation start by one frame to allow layout to settle and prevent initial freeze
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsReady(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  // Early return after all hooks
  if (position.enabled === false) {
    return null;
  }

  const inverseScale = 1 / Math.max(transformScale, 0.1);

  // Determine coordinates: prioritize pixel props if enabled
  const left = usePixelPosition && pixelX !== undefined ? `${pixelX}px` : `${position.x}%`;
  const top  = usePixelPosition && pixelY !== undefined ? `${pixelY}px` : `${position.y}%`;

  // Outer style: positions the drop-in animation wrapper on the map
  const outerStyle: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    zIndex: isSelected ? 1000 : 100,
    pointerEvents: "none",
    width: 0,
    height: 0,
    overflow: "visible",
  };

  // Centering style: handles translate + scale + visual effects (shadow, selected glow)
  // Kept separate from animation class to avoid transform conflicts
  const centeringStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    transform: `translate(-50%, -50%) scale(${inverseScale})`,
    transformOrigin: "center center",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    ...buildShadowStyle(shadow),
    ...style,
  };

  if (isSelected) {
    centeringStyle.filter = centeringStyle.filter
      ? `${centeringStyle.filter}, drop-shadow(0 0 8px rgba(0, 122, 255, 0.8))`
      : "drop-shadow(0 0 8px rgba(0, 122, 255, 0.8))";
  }

  const pinImageStyle: React.CSSProperties = {
    width: `${size}px`,
    height: "auto",
    display: "block",
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "center bottom",
    zIndex: 1,
  };

  const fixedLogoSize = size * 0.75;
  const logoStyle: React.CSSProperties = {
    position: "absolute",
    top: `calc(50% - ${fixedLogoSize / 2 - size * 0.3}px)`,
    left: "50%",
    width: `${fixedLogoSize}px`,
    height: `${fixedLogoSize}px`,
    objectFit: "contain",
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    zIndex: 2,
  };

  const rippleColor = animation?.rippleColor || "#FFFFFF";
  const rippleSize = animation?.rippleSize || 1.5;
  const rippleCenterSize = animation?.rippleCenterSize ?? 0.95;
  const isBlinkAnimation = animation?.enabled && animation.type === "blink";

  const renderContent = () => (
    <div style={{ position: "relative", width: `${size}px`, height: `${size}px`, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {isBlinkAnimation && (
        <>
          <div
            className="ripple-effect"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              top: "43%",
              backgroundColor: rippleColor,
              "--ripple-center-size": rippleCenterSize,
              "--ripple-size": rippleSize,
              "--ripple-duration": `${animation.duration}s`,
            } as React.CSSProperties}
          />
          <div
            className="ripple-effect ripple-effect-delay"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              top: "43%",
              backgroundColor: rippleColor,
              "--ripple-center-size": rippleCenterSize,
              "--ripple-size": rippleSize,
              "--ripple-duration": `${animation.duration}s`,
            } as React.CSSProperties}
          />
        </>
      )}

      <img
        src={speechBubbleIcon}
        alt={shopName}
        draggable={false}
        style={pinImageStyle}
        onError={(e) => console.error("Pin icon failed to load", e)}
      />

      {logoUrl && !logoLoading && (
        <img
          src={logoUrl}
          alt={`${shopName} logo`}
          draggable={false}
          style={logoStyle}
          decoding="async"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </div>
  );

  // Build CSS animation class and variables (applied only after layout settles)
  const animClass = isReady ? getAnimationClass(animation) : "";
  const animContainerStyle: React.CSSProperties = (animClass && animation)
    ? {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        "--anim-duration": `${animation.duration}s`,
        "--anim-amplitude": `-${fixedAmplitude}px`,
        ...(animation.type === "spin-float" && {
          "--anim-iteration": animation.spinRepeat === false ? "1" : "infinite",
        }),
      } as React.CSSProperties
    : {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      };

  return (
    <motion.div
      style={outerStyle as any}
      variants={dropInVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay, type: "spring", stiffness: 300, damping: 20 }}
    >
      <div style={centeringStyle}>
        <div className={animClass} style={animContainerStyle}>
          {renderContent()}
        </div>
      </div>
    </motion.div>
  );
};
