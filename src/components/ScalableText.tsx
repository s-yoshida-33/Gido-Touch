import React, { useRef, useCallback, useLayoutEffect, useEffect } from "react";

/**
 * 1行で表示し、枠からはみ出す場合のみ横方向に縮小（scaleX）して収めるテキスト
 * （通常モール向け src/screens/ShopListScreen.tsx の ScalableText と同じ方式）
 *
 * 枠の幅は style の width で指定する。フォント読込後・枠のサイズ変更時にも再計測する。
 */
export const ScalableText: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  const adjustScale = useCallback(() => {
    if (containerRef.current && textRef.current) {
      const containerWidth = containerRef.current.clientWidth;
      const textWidth = textRef.current.scrollWidth;

      if (textWidth > containerWidth && containerWidth > 0) {
        const scale = containerWidth / textWidth;
        textRef.current.style.transform = `scaleX(${scale})`;
      } else {
        textRef.current.style.transform = "scaleX(1)";
      }
    }
  }, []);

  useLayoutEffect(() => {
    adjustScale();

    // Webフォント（Be Vietnam Pro）の読込後に再計測
    document.fonts.ready.then(adjustScale);

    // レイアウト確定後のずれに備えて少し遅らせて再計測
    const timer = setTimeout(adjustScale, 100);
    return () => clearTimeout(timer);
  }, [text, adjustScale]);

  // 枠のサイズ変更を監視
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      adjustScale();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [adjustScale]);

  return (
    <div
      ref={containerRef}
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        ref={textRef}
        style={{
          display: "inline-block",
          transform: "scaleX(1)",
          whiteSpace: "nowrap",
          transformOrigin: "left center",
        }}
      >
        {text}
      </div>
    </div>
  );
};
