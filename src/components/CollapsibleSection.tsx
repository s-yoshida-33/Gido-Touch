// src/components/CollapsibleSection.tsx
import React, { useState, useEffect, useRef } from "react";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isActive?: boolean;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
  isActive = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [hasFocus, setHasFocus] = useState(false);

  // 子要素内の入力フィールドにフォーカスがあるかチェック
  useEffect(() => {
    const handleFocusIn = () => setHasFocus(true);
    const handleFocusOut = () => {
      // フォーカスが外れたとき、少し遅延させてチェック（別の入力フィールドに移動した可能性があるため）
      setTimeout(() => {
        if (contentRef.current && !contentRef.current.contains(document.activeElement)) {
          setHasFocus(false);
        }
      }, 0);
    };

    const content = contentRef.current;
    if (content) {
      content.addEventListener("focusin", handleFocusIn);
      content.addEventListener("focusout", handleFocusOut);
      return () => {
        content.removeEventListener("focusin", handleFocusIn);
        content.removeEventListener("focusout", handleFocusOut);
      };
    }
  }, [isOpen]);

  const isHighlighted = isActive || hasFocus;

  return (
    <div
      style={{
        border: `1px solid ${isHighlighted ? "rgba(74, 158, 255, 0.5)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 8,
        marginBottom: 16,
        backgroundColor: isHighlighted ? "rgba(74, 158, 255, 0.08)" : "rgba(255,255,255,0.02)",
        overflow: "hidden",
        transition: "all 0.2s ease",
        boxShadow: isHighlighted ? "0 0 0 1px rgba(74, 158, 255, 0.2)" : "none",
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          padding: "12px 16px",
          backgroundColor: isHighlighted ? "rgba(74, 158, 255, 0.1)" : "transparent",
          border: "none",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 600,
          textAlign: "left",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!isHighlighted) {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isHighlighted) {
            e.currentTarget.style.backgroundColor = "transparent";
          } else {
            e.currentTarget.style.backgroundColor = "rgba(74, 158, 255, 0.1)";
          }
        }}
      >
        <span>{title}</span>
        <span
          style={{
            fontSize: 18,
            transition: "transform 0.2s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div
          ref={contentRef}
          style={{
            padding: "0 16px 16px 16px",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};

