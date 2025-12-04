// src/components/ShopPin.tsx
import React, { useState, useRef, useEffect } from "react";
import type { ShopPosition } from "../types/shop";
import speechBubbleIcon from "../assets/speech-bubble.svg";

interface ShopPinProps {
  position: ShopPosition;
  shopName: string;
  isSelected?: boolean;
  onDrag?: (x: number, y: number) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const ShopPin: React.FC<ShopPinProps> = ({ 
  position, 
  shopName, 
  isSelected = false,
  onDrag,
  containerRef,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging || !onDrag || !containerRef?.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      e.preventDefault();
      e.stopPropagation();

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      // 相対座標を0.0〜1.0の範囲にクランプ
      const clampedX = Math.max(0, Math.min(1, x));
      const clampedY = Math.max(0, Math.min(1, y));
      
      console.log("ShopPin - handleMouseMove:", { 
        clientX: e.clientX, 
        clientY: e.clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        rectWidth: rect.width,
        rectHeight: rect.height,
        x, 
        y, 
        clampedX, 
        clampedY 
      });

      onDrag(clampedX, clampedY); // 0.0～1.0の形式で渡す（後で100倍される）
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      console.log("ShopPin - handleMouseUp");
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: false, capture: true });
    document.addEventListener("mouseup", handleMouseUp, { passive: false, capture: true });

    return () => {
      document.removeEventListener("mousemove", handleMouseMove, { capture: true });
      document.removeEventListener("mouseup", handleMouseUp, { capture: true });
    };
  }, [isDragging, onDrag, containerRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onDrag || !isSelected) {
      console.log("ShopPin - handleMouseDown: conditions not met", { onDrag: !!onDrag, isSelected });
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    console.log("ShopPin - handleMouseDown: starting drag");
    setIsDragging(true);
  };

  return (
    <div
      ref={pinRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "absolute",
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: "translate(-50%, -100%)", // ピンの先端が位置を指すように
        pointerEvents: isSelected ? "auto" : "none",
        zIndex: isSelected ? 101 : 100,
        filter: isSelected ? "drop-shadow(0 0 8px rgba(0, 122, 255, 0.8))" : undefined,
        cursor: isSelected ? "grab" : "default",
      }}
    >
      <img
        src={speechBubbleIcon}
        alt={shopName}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        style={{
          width: "60px",
          height: "auto",
          display: "block",
          cursor: isDragging ? "grabbing" : isSelected ? "grab" : "default",
        }}
      />
    </div>
  );
};

