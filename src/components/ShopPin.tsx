// src/components/ShopPin.tsx
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { ShopPosition } from "../types/shop";
import type { AnimationConfig } from "../types/locationIcon";
import speechBubbleIcon from "../assets/shop-location.svg";

interface ShopPinProps {
  position: ShopPosition;
  shopName: string;
  isSelected?: boolean;
  shopLogo?: string;
  shopId?: string;
  transformScale?: number;
  style?: React.CSSProperties;
}

function buildShadowStyle(shadow?: ShopPosition['shadow']): React.CSSProperties {
  if (!shadow || !shadow.enabled) {
    return {};
  }
  return {
    filter: `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0, 0, 0, ${shadow.opacity}))`,
  };
}

function buildAnimationProps(fixedAmplitude: number, animation?: AnimationConfig) {
  if (!animation || !animation.enabled || animation.type === "none") {
    return {
      initial: { scale: 1 },
      animate: { scale: 1 },
    };
  }

  const duration = animation.duration;

  // 'ease' property needs 'as const' to satisfy Framer Motion types
  switch (animation.type) {
    case "floating":
      return {
        initial: { y: 0 },
        animate: {
          y: [0, -fixedAmplitude, 0],
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
    case "pulse":
      return {
        initial: { scale: 1 },
        animate: {
          scale: [1, 1.1, 1],
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
    case "bounce":
      return {
        initial: { y: 0 },
        animate: {
          y: [0, -fixedAmplitude, 0],
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeOut" as const,
        },
      };
    case "blink":
      return {
        initial: { scale: 1 },
        animate: { scale: 1 },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
    default:
      return {
        initial: { scale: 1 },
        animate: { scale: 1 },
      };
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
  style
}) => {
  if (position.enabled === false) {
    return null;
  }

  const size = position.size ?? 80;
  const rotation = position.rotation ?? 0;
  const shadow = position.shadow;
  const animation = position.animation;
  const fixedAmplitude = animation?.amplitude ? animation.amplitude : 0;
  
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoLoading, setLogoLoading] = useState(true);
  
  useEffect(() => {
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

      const electronAPI = window.electronAPI;
      if (electronAPI && electronAPI.getShopImage) {
        try {
          const normalizedPath = imagePath.replace(/\\/g, "/");
          const dataUrl = await electronAPI.getShopImage(normalizedPath);
          if (dataUrl) {
            setLogoUrl(dataUrl);
            setLogoLoading(false);
            return;
          }
        } catch (error) {
          console.error("Failed to load logo via IPC:", error);
        }
      }

      const fileUrl = toFileUrl(imagePath);
      setLogoUrl(fileUrl);
      setLogoLoading(false);
    };

    loadLogo();
  }, [shopLogo, shopId]);

  const inverseScale = 1 / Math.max(transformScale, 0.1);

  // Wrapper style: positions the pin on the map
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: `${position.x}%`,
    top: `${position.y}%`,
    // Do NOT set width/height to 0 here; let it size to content
    // transform centers the element on the coordinate
    transform: `translate(-50%, -50%) scale(${inverseScale})`,
    transformOrigin: "center center",
    zIndex: isSelected ? 1000 : 100,
    pointerEvents: "none", 
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    ...buildShadowStyle(shadow),
    ...style,
  };

  if (isSelected) {
    wrapperStyle.filter = wrapperStyle.filter
      ? `${wrapperStyle.filter}, drop-shadow(0 0 8px rgba(0, 122, 255, 0.8))`
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
          <style>{`
            @keyframes ripple-animation-${shopId} {
              0% { transform: translate(-50%, -50%) scale(${rippleCenterSize}); opacity: 1; }
              90% { opacity: 0.1; }
              100% { transform: translate(-50%, -50%) scale(${rippleSize * 1.2}); opacity: 0; }
            }
            .ripple-${shopId} {
              position: absolute;
              top: 43%;
              left: 50%;
              transform: translate(-50%, -50%);
              border-radius: 50%;
              background-color: ${rippleColor};
              pointer-events: none;
              z-index: 0;
            }
          `}</style>
          <div
            className={`ripple-${shopId}`}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              animation: `ripple-animation-${shopId} ${animation.duration}s ease-out infinite`,
            }}
          />
          <div
            className={`ripple-${shopId}`}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              animation: `ripple-animation-${shopId} ${animation.duration}s ease-out ${animation.duration / 2}s infinite`,
            }}
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
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
    </div>
  );

  if (animation?.enabled && animation.type !== "none") {
    const animationProps = buildAnimationProps(fixedAmplitude, animation);
    // Explicitly cast style to avoid type conflict with animation props if necessary, 
    // though the buildAnimationProps fix should resolve the main error.
    return (
      <motion.div
        style={wrapperStyle as any} 
        initial={animationProps.initial}
        animate={animationProps.animate}
        transition={animationProps.transition}
      >
        {renderContent()}
      </motion.div>
    );
  }

  return (
    <div style={wrapperStyle}>
      {renderContent()}
    </div>
  );
};