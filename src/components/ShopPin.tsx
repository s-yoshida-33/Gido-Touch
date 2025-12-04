// src/components/ShopPin.tsx
import React from "react";
import { motion } from "framer-motion";
import type { ShopPosition } from "../types/shop";
import type { AnimationConfig } from "../types/locationIcon";
import speechBubbleIcon from "../assets/speech-bubble.svg";

interface ShopPinProps {
  position: ShopPosition;
  shopName: string;
  isSelected?: boolean;
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

export const ShopPin: React.FC<ShopPinProps> = ({ 
  position, 
  shopName, 
  isSelected = false,
}) => {
  // 表示が無効の場合は何も表示しない
  if (position.enabled === false) {
    return null;
  }

  const size = position.size ?? 60;
  const rotation = position.rotation ?? 0;
  const shadow = position.shadow;
  const animation = position.animation;

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
        <img
          src={speechBubbleIcon}
          alt={shopName}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={imageStyle}
        />
      </motion.div>
    );
  }

  // アニメーションが無効な場合は通常のdivを使用
  return (
    <div style={baseWrapperStyle}>
      <img
        src={speechBubbleIcon}
        alt={shopName}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={imageStyle}
      />
    </div>
  );
};

