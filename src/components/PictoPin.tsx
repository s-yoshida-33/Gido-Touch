import React, { useState } from "react";
import { motion, type Variants } from "framer-motion";
import type { PictoInstance } from "../types/picto";
import "../styles/location-icons.css";

const dropInVariants: Variants = {
  hidden: { y: -100, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
};

interface PictoPinProps {
  instance: PictoInstance;
  iconUrl: string;
  isSelected?: boolean;
  usePixelPosition?: boolean;
  pixelX?: number;
  pixelY?: number;
  delay?: number;
}

function buildShadowStyle(shadow: PictoInstance["shadow"]): React.CSSProperties {
  if (!shadow || !shadow.enabled) return {};
  return {
    filter: `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0,0,0,${shadow.opacity}))`,
  };
}

function getAnimationClass(type: string): string {
  switch (type) {
    case "floating": return "anim-floating";
    case "pulse":    return "anim-pulse";
    case "bounce":   return "anim-bounce";
    case "blink":    return "";
    default:         return "";
  }
}

export const PictoPin: React.FC<PictoPinProps> = ({
  instance,
  iconUrl,
  isSelected = false,
  usePixelPosition = false,
  pixelX,
  pixelY,
  delay = 0,
}) => {
  const size = instance.size || 80;
  const rotation = instance.rotation || 0;
  const animation = instance.animation;
  const fixedAmplitude = animation?.amplitude ?? 0;
  const shadow = instance.shadow;

  const left = usePixelPosition && pixelX !== undefined ? `${pixelX}px` : `${instance.x}%`;
  const top  = usePixelPosition && pixelY !== undefined ? `${pixelY}px` : `${instance.y}%`;

  const outerStyle: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    zIndex: isSelected ? 1000 : 90,
    pointerEvents: "none",
    width: 0,
    height: 0,
    overflow: "visible",
  };

  const centeringStyle: React.CSSProperties = {
    transform: "translate(-50%, -50%)",
    transformOrigin: "center center",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    ...buildShadowStyle(shadow),
  };

  const imageStyle: React.CSSProperties = {
    width: `${size}px`,
    height: "auto",
    display: "block",
    transform: `rotate(${rotation}deg)`,
  };

  const rippleColor = animation?.rippleColor || "#FFFFFF";
  const rippleSize = animation?.rippleSize || 1.6;
  const rippleCenterSize = animation?.rippleCenterSize ?? 0.8;
  const isBlinkAnimation = isSelected && animation?.enabled && animation.type === "blink";

  const [isReady, setIsReady] = useState(false);
  React.useEffect(() => {
    const timer = requestAnimationFrame(() => setIsReady(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const renderContent = () => (
    <div style={{ position: "relative", width: `${size}px`, height: `${size}px`, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {isBlinkAnimation && (
        <>
          <div
            className="ripple-effect"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: rippleColor,
              "--ripple-center-size": rippleCenterSize,
              "--ripple-size": rippleSize,
              "--ripple-duration": `${animation!.duration}s`,
            } as React.CSSProperties}
          />
          <div
            className="ripple-effect ripple-effect-delay"
            style={{
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: rippleColor,
              "--ripple-center-size": rippleCenterSize,
              "--ripple-size": rippleSize,
              "--ripple-duration": `${animation!.duration}s`,
            } as React.CSSProperties}
          />
        </>
      )}
      {iconUrl && (
        <img
          src={iconUrl}
          alt={instance.tag}
          draggable={false}
          style={imageStyle}
          decoding="async"
        />
      )}
    </div>
  );

  const innerContainerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const renderInnerContent = () => {
    if (!isReady) return null;
    if (isSelected && animation?.enabled && animation.type !== "none") {
      const animClass = getAnimationClass(animation.type);
      const style = {
        ...innerContainerStyle,
        "--anim-duration": `${animation.duration}s`,
        "--anim-amplitude": `-${fixedAmplitude}px`,
      } as React.CSSProperties;
      return <div className={animClass} style={style}>{renderContent()}</div>;
    }
    return <div style={innerContainerStyle}>{renderContent()}</div>;
  };

  return (
    <motion.div
      style={outerStyle as any}
      variants={dropInVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ delay, type: "spring", stiffness: 300, damping: 20 }}
    >
      <div style={centeringStyle}>
        {renderInnerContent()}
      </div>
    </motion.div>
  );
};
