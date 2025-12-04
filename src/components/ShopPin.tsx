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
}

function buildShadowStyle(shadow?: ShopPosition['shadow']): React.CSSProperties {
  if (!shadow || !shadow.enabled) {
    return {};
  }
  return {
    filter: `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0, 0, 0, ${shadow.opacity}))`,
  };
}

function buildAnimationProps(animation?: AnimationConfig) {
  if (!animation || !animation.enabled || animation.type === "none") {
    return {
      initial: { x: 0, y: 0, scale: 1 },
      animate: { x: 0, y: 0, scale: 1 },
    };
  }

  const duration = animation.duration;
  const amplitude = animation.amplitude;

  switch (animation.type) {
    case "floating":
      return {
        initial: { x: 0, y: 0 },
        animate: {
          y: [0, -amplitude, 0],
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
        initial: { x: 0, y: 0 },
        animate: {
          y: [0, -amplitude, 0],
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeOut" as const,
        },
      };
    default:
      return {
        initial: { x: 0, y: 0, scale: 1 },
        animate: { x: 0, y: 0, scale: 1 },
      };
  }
}

// ロゴ画像を読み込むヘルパー関数
function buildImagePath(photo: string | undefined, shopId: string | undefined): string {
  if (!photo) {
    return "";
  }
  
  // If already a full path (contains drive letter like C:\), normalize and return
  if (photo.match(/^[A-Za-z]:[\\/]/)) {
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
}) => {
  // 表示が無効の場合は何も表示しない
  if (position.enabled === false) {
    return null;
  }

  const size = position.size ?? 60;
  const rotation = position.rotation ?? 0;
  const shadow = position.shadow;
  const animation = position.animation;
  
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
    ? `${animation.enabled}-${animation.type}-${animation.duration}-${animation.amplitude}`
    : "no-animation";

  // アニメーションが有効な場合と無効な場合で同じ位置になるように、
  // motion.divと通常のdivで同じスタイルを使用
  const baseWrapperStyle: React.CSSProperties = {
    position: "absolute",
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: "translate(-50%, -100%)", // ピンの先端が位置を指すように
    transformOrigin: "center bottom", // ピンの先端を基準に回転
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
    transformOrigin: "center bottom", // ピンの先端を基準に回転
  };
  
  // ロゴのサイズ（アイコンサイズの約80%）
  const logoSize = size * 0.8;
  const logoStyle: React.CSSProperties = {
    position: "absolute",
    top: "calc(50% - 6px)",
    left: "50%",
    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    width: `${logoSize}px`,
    height: `${logoSize}px`,
    objectFit: "contain",
    pointerEvents: "none",
    zIndex: 1,
  };

  // アニメーションが有効な場合はmotion.divを使用
  // framer-motionのtransformとCSSのtransformが競合しないように、
  // styleプロパティでtransformを設定し、animateプロパティでは相対的な移動のみを指定
  if (animation?.enabled && animation.type !== "none") {
    const animationProps = buildAnimationProps(animation);
    // motion.divのstyleでtransformを設定し、animateでは相対的な移動のみ
    return (
      <motion.div
        key={animationKey}
        style={baseWrapperStyle}
        initial={animationProps.initial}
        animate={animationProps.animate}
        transition={animationProps.transition}
      >
        <div style={{ position: "relative", display: "inline-block" }}>
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
                // ロゴ読み込みエラー時は非表示
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
          )}
        </div>
      </motion.div>
    );
  }

  // アニメーションが無効な場合は通常のdivを使用
  return (
    <div style={baseWrapperStyle}>
      <div style={{ position: "relative", display: "inline-block" }}>
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
              // ロゴ読み込みエラー時は非表示
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        )}
      </div>
    </div>
  );
};

