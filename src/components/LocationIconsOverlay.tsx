// src/components/LocationIconsOverlay.tsx
import React from "react";
import { motion } from "framer-motion";
import type { LocationIconSettings, IconPositionConfig, AnimationConfig } from "../types/locationIcon";

import SpeechBubbleSvg from "../assets/user-locaition.svg";
import LocationSvg from "../assets/Location.svg";

const REFERENCE_MAP_WIDTH = 1920;

interface ImageMetrics {
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
}

interface Props {
  settings: LocationIconSettings;
  imageMetrics?: ImageMetrics | null;
}

function buildShadowStyle(config: { enabled: boolean; offsetX: number; offsetY: number; blur: number; opacity: number }): React.CSSProperties {
  if (!config.enabled) return {};
  return {
    filter: `drop-shadow(${config.offsetX}px ${config.offsetY}px ${config.blur}px rgba(0, 0, 0, ${config.opacity}))`,
  };
}

function buildAnimationProps(animation?: AnimationConfig, scaleRatio: number = 1): {
  initial: any;
  animate: any;
  transition?: any;
} {
  if (!animation || !animation.enabled || animation.type === "none") {
    return {
      initial: { x: 0, y: 0, scale: 1 },
      animate: { x: 0, y: 0, scale: 1 },
    };
  }

  const { type, duration, amplitude } = animation;
  // Apply scale to amplitude
  const scaledAmplitude = amplitude * scaleRatio;

  switch (type) {
    case "floating":
      return {
        initial: { y: 0 },
        animate: {
          y: [-scaledAmplitude, scaledAmplitude, -scaledAmplitude],
        },
        transition: {
          duration: duration,
          repeat: Infinity,
          ease: "easeInOut",
        },
      };
    case "pulse":
      return {
        initial: { scale: 1 },
        animate: { scale: [1, 1.1, 1] },
        transition: {
          duration: duration,
          repeat: Infinity,
          ease: "easeInOut",
        },
      };
    case "bounce":
      return {
        initial: { y: 0 },
        animate: { y: [0, -scaledAmplitude, 0] },
        transition: {
          duration: duration,
          repeat: Infinity,
          ease: "easeOut", // バウンドっぽく
        },
      };
    case "blink":
      // Blink animation handles ripple separately, icon itself doesn't move much
      return {
        initial: { opacity: 1 },
        animate: { opacity: 1 }, // No opacity change on icon itself
      };
    default:
      return {
        initial: { x: 0, y: 0, scale: 1 },
        animate: { x: 0, y: 0, scale: 1 },
      };
  }
}

export const LocationIconsOverlay: React.FC<Props> = ({ settings, imageMetrics }) => {
  const { speechBubble, location } = settings;

  // Helper to calculate scale ratio
  const scaleRatio = imageMetrics ? imageMetrics.displayWidth / REFERENCE_MAP_WIDTH : 1;

  // Create keys based on animation settings to force re-mount when settings change
  const speechBubbleAnimationKey = speechBubble.animation
    ? `${speechBubble.animation.enabled}-${speechBubble.animation.type}-${speechBubble.animation.duration}-${speechBubble.animation.amplitude}-${speechBubble.animation.rippleColor || ""}-${speechBubble.animation.rippleSize || ""}-${scaleRatio}`
    : `no-animation-${scaleRatio}`;

  const locationAnimationKey = location.animation
    ? `${location.animation.enabled}-${location.animation.type}-${location.animation.duration}-${location.animation.amplitude}-${location.animation.rippleColor || ""}-${location.animation.rippleSize || ""}-${scaleRatio}`
    : `no-animation-${scaleRatio}`;

  // Helper to calculate position style
  const getPositionStyle = (config: IconPositionConfig): React.CSSProperties => {
    if (imageMetrics) {
      // Use exact pixel coordinates based on image metrics
      const xPercent = config.xPercent / 100;
      const yPercent = config.yPercent / 100;
      const pixelX = imageMetrics.offsetX + (xPercent * imageMetrics.displayWidth);
      const pixelY = imageMetrics.offsetY + (yPercent * imageMetrics.displayHeight);

      return {
        position: "absolute",
        left: `${pixelX}px`,
        top: `${pixelY}px`,
        transform: "translate(-50%, -50%)",
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: config === speechBubble ? 5 : 6, // Set z-index here
      };
    } else {
      // Fallback to percentage based (may be inaccurate if image has letterboxing)
      return {
        position: "absolute",
        left: `${config.xPercent}%`,
        top: `${config.yPercent}%`,
        transform: "translate(-50%, -50%)",
        transformOrigin: "center center",
        pointerEvents: "none",
        zIndex: config === speechBubble ? 5 : 6,
      };
    }
  };

  // Helper to calculate size style
  const getSizeStyle = (config: IconPositionConfig): React.CSSProperties => {
    const size = config.size * scaleRatio;

    return {
      width: `${size}px`,
      height: "auto",
      transform: `rotate(${config.rotation}deg)`,
      display: "block",
    };
  };

  const speechBubbleWrapperStyle = {
    ...getPositionStyle(speechBubble),
    ...buildShadowStyle(speechBubble.shadow),
  };

  const locationWrapperStyle = {
    ...getPositionStyle(location),
    ...buildShadowStyle(location.shadow),
  };

  // 波紋アニメーション用のスタイルとコンテンツを生成
  const renderRippleAnimation = (
    config: IconPositionConfig,
    uniqueId: string
  ) => {
    const animation = config.animation;
    if (!animation || !animation.enabled || animation.type !== "blink") {
      return null;
    }

    const rippleColor = animation.rippleColor || "#FFFFFF";
    const rippleSize = animation.rippleSize || 1.5;
    const rippleCenterSize = animation.rippleCenterSize ?? 0.95;
    
    // Use scaled size for ripples too
    const size = config.size * scaleRatio;

    return (
      <>
        <style>{`
          @keyframes ripple-animation-${uniqueId} {
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
          .ripple-${uniqueId}-1 {
            animation: ripple-animation-${uniqueId} ${animation.duration}s ease-out infinite;
          }
          .ripple-${uniqueId}-2 {
            animation: ripple-animation-${uniqueId} ${animation.duration}s ease-out ${animation.duration / 2}s infinite;
          }
        `}</style>
        <div
          className={`ripple-${uniqueId}-1`}
          style={{
            position: "absolute",
            top: "50%",
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
          className={`ripple-${uniqueId}-2`}
          style={{
            position: "absolute",
            top: "50%",
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
    );
  };

  return (
    <>
      {speechBubble.enabled && (
        <motion.div
          key={speechBubbleAnimationKey}
          style={speechBubbleWrapperStyle}
        >
          <motion.div
            style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
            {...buildAnimationProps(speechBubble.animation, scaleRatio)}
          >
            {renderRippleAnimation(speechBubble, "speech-bubble")}
            <img
              src={SpeechBubbleSvg}
              alt="Current location speech bubble"
              style={getSizeStyle(speechBubble)}
            />
          </motion.div>
        </motion.div>
      )}

      {location.enabled && (
        <motion.div
          key={locationAnimationKey}
          style={locationWrapperStyle}
        >
          <motion.div
            style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
            {...buildAnimationProps(location.animation, scaleRatio)}
          >
            {renderRippleAnimation(location, "location")}
            <img
              src={LocationSvg}
              alt="Current location pin"
              style={getSizeStyle(location)}
            />
          </motion.div>
        </motion.div>
      )}
    </>
  );
};
