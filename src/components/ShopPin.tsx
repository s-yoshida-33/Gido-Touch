// src/components/ShopPin.tsx
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { ShopPosition } from "../types/shop";
import type { AnimationConfig } from "../types/locationIcon";
import speechBubbleIcon from "../assets/speech-bubble.svg";

interface ShopPinProps {
  position: ShopPosition;
  shopName: string;
  isSelected?: boolean;
  shopLogo?: string;
  shopId?: string;
  // ピクセル座標での配置を使用するかどうか
  usePixelPosition?: boolean;
  // ピクセル座標（usePixelPositionがtrueの場合）
  pixelX?: number;
  pixelY?: number;
  // TransformWrapperのスケールを打ち消すためのスケール値
  transformScale?: number;
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
      initial: { scale: 1, backgroundColor: "rgba(255, 255, 255, 0)" },
      animate: { scale: 1, backgroundColor: "rgba(255, 255, 255, 0)" },
    };
  }

  const duration = animation.duration;

  switch (animation.type) {
    case "floating":
      return {
        initial: { y: 0, backgroundColor: "rgba(255, 255, 255, 0)" },
        animate: {
          y: [0, -fixedAmplitude, 0],
          backgroundColor: "rgba(255, 255, 255, 0)",
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
    case "pulse":
      return {
        initial: { scale: 1, backgroundColor: "rgba(255, 255, 255, 0)" },
        animate: {
          scale: [1, 1.1, 1],
          backgroundColor: "rgba(255, 255, 255, 0)",
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
    case "bounce":
      return {
        initial: { y: 0, backgroundColor: "rgba(255, 255, 255, 0)" },
        animate: {
          y: [0, -fixedAmplitude, 0],
          backgroundColor: "rgba(255, 255, 255, 0)",
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
        initial: { scale: 1, backgroundColor: "rgba(255, 255, 255, 0)" },
        animate: { scale: 1, backgroundColor: "rgba(255, 255, 255, 0)" },
      };
  }
}

// ロゴ画像を読み込むヘルパー関数
function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) {
    return "";
  }
  
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
    if (photo.startsWith("\\\\")) {
      return photo;
    }
    if (photo.startsWith("/")) {
      return photo;
    }
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
  usePixelPosition = false,
  pixelX,
  pixelY,
  transformScale = 1,
}) => {
  // 表示が無効の場合は何も表示しない
  if (position.enabled === false) {
    return null;
  }

  const size = position.size ?? 80;
  const rotation = position.rotation ?? 0;
  const shadow = position.shadow;
  const animation = position.animation;
  const fixedAmplitude = animation?.amplitude ? animation.amplitude : 0;
  
  // ロゴ画像の読み込み
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

  // アニメーション設定に基づくキー（再マウント用）
  const animationKey = animation
    ? `${animation.enabled}-${animation.type}-${animation.duration}-${animation.amplitude}-${animation.rippleColor || ""}-${animation.rippleSize || ""}`
    : "no-animation";

  // TransformComponentの内側に配置されているため、スケールは自動的に適用される
  // ただし、ピンのサイズは固定したいので、逆スケールを適用
  const inverseScale = 1 / transformScale;

  // 基本のラッパースタイル
  const baseWrapperStyle: React.CSSProperties = {
    position: "absolute",
    ...(usePixelPosition && pixelX !== undefined && pixelY !== undefined
      ? {
          // ピクセル座標を直接使用
          left: `${pixelX}px`,
          top: `${pixelY}px`,
        }
      : {
          left: `${position.x}%`,
          top: `${position.y}%`,
        }),
    // ピンのサイズを固定するため、TransformWrapperのスケールを打ち消す
    // translate(-50%, -50%)でピンの中心を座標に合わせる
    transform: `translate(-50%, -50%) scale(${inverseScale})`,
    transformOrigin: "center center",
    pointerEvents: "none",
    zIndex: isSelected ? 101 : 100,
    ...buildShadowStyle(shadow),
  };

  // 選択中の場合は追加のシャドウを適用
  if (isSelected) {
    baseWrapperStyle.filter = baseWrapperStyle.filter
      ? `${baseWrapperStyle.filter}, drop-shadow(0 0 8px rgba(0, 122, 255, 0.8))`
      : "drop-shadow(0 0 8px rgba(0, 122, 255, 0.8))";
  }

  const imageStyle: React.CSSProperties = {
    width: `${size}px`,
    height: "auto",
    display: "block",
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "center bottom",
  };
  
  // ロゴのサイズ（アイコンサイズの約80%）
  const fixedLogoSize = size * 0.8;
  const logoStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(50% - 6px)",
    left: "50%",
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    width: `${fixedLogoSize}px`,
    height: `${fixedLogoSize}px`,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 1,
  };

  // 波紋アニメーション用の色とサイズ
  const rippleColor = animation?.rippleColor || "#FFFFFF";
  const rippleSize = animation?.rippleSize || 1.5;
  const rippleCenterSize = animation?.rippleCenterSize ?? 0.95;
  const isBlinkAnimation = animation?.enabled && animation.type === "blink";

  // コンテンツの共通部分を関数化
  const renderContent = () => (
    <>
      {/* 波紋アニメーション（blinkタイプの場合） */}
      {isBlinkAnimation && (
        <>
          <style>{`
            @keyframes ripple-animation-${shopId} {
              0% {
                transform: translate(-50%, -50%) scale(${rippleCenterSize});
                opacity: 1;
              }
              90% {
                opacity: 0.1;
              }
              100% {
                transform: translate(-50%, -50%) scale(${rippleSize * 1.2});
                opacity: 0;
              }
            }
            .ripple-${shopId}-1 {
              animation: ripple-animation-${shopId} ${animation.duration}s ease-out infinite;
            }
            .ripple-${shopId}-2 {
              animation: ripple-animation-${shopId} ${animation.duration}s ease-out ${animation.duration / 2}s infinite;
            }
          `}</style>
          <div
            className={`ripple-${shopId}-1`}
            style={{
              position: "absolute",
              top: "calc(50% - 6px)",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${rippleCenterSize})`,
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: "50%",
              backgroundColor: rippleColor,
              pointerEvents: "none",
              zIndex: -1,
              opacity: 0,
            }}
          />
          <div
            className={`ripple-${shopId}-2`}
            style={{
              position: "absolute",
              top: "calc(50% - 6px)",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${rippleCenterSize})`,
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: "50%",
              backgroundColor: rippleColor,
              pointerEvents: "none",
              zIndex: -1,
              opacity: 0,
            }}
          />
        </>
      )}
      <img
        src={speechBubbleIcon}
        alt={shopName}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={imageStyle}
      />
      {logoUrl && !logoLoading && (
        <img
          src={logoUrl}
          alt={`${shopName} logo`}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={logoStyle}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
          }}
        />
      )}
    </>
  );

  // アニメーションが有効な場合はmotion.divを使用
  if (animation?.enabled && animation.type !== "none") {
    const animationProps = buildAnimationProps(fixedAmplitude, animation);
    
    return (
      <div style={baseWrapperStyle}>
        <motion.div
          key={animationKey}
          style={{ 
            position: "relative", 
            display: "inline-block",
          }}
          initial={animationProps.initial}
          animate={animationProps.animate}
          transition={animationProps.transition}
        >
          {renderContent()}
        </motion.div>
      </div>
    );
  }

  // アニメーションが無効な場合は通常のdivを使用
  return (
    <div style={baseWrapperStyle}>
      <div style={{ position: "relative", display: "inline-block" }}>
        {renderContent()}
      </div>
    </div>
  );
};