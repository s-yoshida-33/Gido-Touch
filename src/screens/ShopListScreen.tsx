// src/screens/ShopListScreen.tsx
import React, { useEffect, useRef, useState } from "react";

/**
 * 店舗一覧画面
 * 画面サイズ: 3840×2160
 * 背景: 黒
 * 店舗一覧部分: 2640×2160（左側）
 * 店舗一覧部分の背景: #FDE7C6
 * Actionスペース: 1140×2160（右側）
 * Actionスペースの背景: 白
 */
const ShopListScreen: React.FC = () => {
  // スクロールコンテナのref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledToRight, setIsScrolledToRight] = useState(false);
  const [isScrolledToLeft, setIsScrolledToLeft] = useState(true);
  
  // ドラッグスクロール用の状態
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  // 仮のカードデータ（50個）
  const cardCount = 50;
  const cards = Array.from({ length: cardCount }, (_, i) => ({
    id: i + 1,
    name: `店舗 ${i + 1}`,
  }));

  // 縦6行で配置
  const rowsPerColumn = 6;
  const totalColumns = Math.ceil(cards.length / rowsPerColumn);

  // カードのサイズ計算
  // コンテンツ領域: width: 2580px (2640 - 30*2), height: 2040px (2100 - 30*2)
  const cardHeight = (2040 - 20 * (rowsPerColumn - 1)) / rowsPerColumn; // 行間20px
  const cardWidth = 376; // カード幅
  const columnGap = 20; // 列間の余白
  const imageHeight = 250; // 画像の高さ

  // カードを列ごとにグループ化
  const columns: typeof cards[] = [];
  for (let i = 0; i < totalColumns; i++) {
    const startIndex = i * rowsPerColumn;
    const endIndex = Math.min(startIndex + rowsPerColumn, cards.length);
    columns.push(cards.slice(startIndex, endIndex));
  }

  // スクロール位置を監視
  useEffect(() => {
    const handleScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const { scrollLeft, scrollWidth, clientWidth } = container;
      // 右端に到達したかどうか（1pxの誤差を許容）
      const isAtRight = scrollLeft + clientWidth >= scrollWidth - 1;
      // 左端に到達したかどうか（1pxの誤差を許容）
      // スクロール中（scrollLeft > 1）の場合は false になる
      const isAtLeft = Math.abs(scrollLeft) < 1;
      
      setIsScrolledToRight(isAtRight);
      setIsScrolledToLeft(isAtLeft);
    };

    const container = scrollContainerRef.current;
    if (container) {
      // 初期状態をチェック
      handleScroll();
      container.addEventListener("scroll", handleScroll);
      // リサイズ時もチェック
      window.addEventListener("resize", handleScroll);
      return () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
      };
    }
  }, []);

  // マウスドラッグでスクロール
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    scrollStartXRef.current = container.scrollLeft;
    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const deltaX = dragStartXRef.current - e.clientX;
    container.scrollLeft = scrollStartXRef.current + deltaX;
  };

  const handleMouseUp = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = false;
    container.style.cursor = "grab";
    container.style.userSelect = "";
  };

  const handleMouseLeave = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    isDraggingRef.current = false;
    container.style.cursor = "grab";
    container.style.userSelect = "";
  };

  // スクロールバーを非表示にするスタイルを追加
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .shop-list-scroll-container::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <div
      style={{
        width: "3840px",
        height: "2160px",
        backgroundColor: "#3C2C23",
        display: "flex",
        flexDirection: "row",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* 店舗一覧部分（左側） */}
      <div
        style={{
          width: "2640px",
          height: "2100px",
          backgroundColor: "#FDE7C6",
          borderRadius: "50px",
          paddingTop: "30px",
          paddingBottom: "30px",
          paddingLeft: "0px",
          paddingRight: "0px",
          margin: "30px",
          flexShrink: 0,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* スクロール可能なコンテナ */}
        <div
          ref={scrollContainerRef}
          style={{
            width: "100%",
            height: "100%",
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none", // Firefox
            msOverflowStyle: "none", // IE/Edge
            cursor: "grab",
          }}
          className="shop-list-scroll-container"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* カードグリッドコンテナ */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              height: "2040px",
              width: `${30 + totalColumns * cardWidth + (totalColumns - 1) * columnGap + 30}px`,
              gap: `${columnGap}px`,
            }}
          >
            {columns.map((columnCards, columnIndex) => (
              <div
                key={columnIndex}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  width: `${cardWidth}px`,
                  marginLeft: columnIndex === 0 ? "30px" : "0px",
                  marginRight: columnIndex === totalColumns - 1 ? "30px" : "0px",
                }}
              >
                {columnCards.map((card) => (
                  <div
                    key={card.id}
                    style={{
                      width: `${cardWidth}px`,
                      height: `${cardHeight}px`,
                      backgroundColor: "#000000",
                      borderRadius: "0 30px 30px 30px", // 右上、左下、右下を30px
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    {/* フロア表示（左上） */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "50px",
                        height: "50px",
                        backgroundColor: "#E63B93",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 10,
                        fontSize: "24px",
                        fontWeight: 700,
                        color: "#FFFFFF",
                      }}
                    >
                      1F
                    </div>
                    {/* 画像エリア */}
                    <div
                      style={{
                        width: "100%",
                        height: `${imageHeight}px`,
                        backgroundColor: "#333333",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        fontSize: "24px",
                        fontWeight: 700,
                      }}
                    >
                      Image
                    </div>
                    {/* コンテンツエリア */}
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                      }}
                    >
                      <span style={{ fontSize: "24px", fontWeight: 700 }}>
                        {card.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actionスペース（右側） */}
      <div
        style={{
          width: "1140px",
          height: "2160px",
          backgroundColor: "#FFFFFF",
          flexShrink: 0,
          boxSizing: "border-box",
          marginLeft: "auto",
        }}
      >
        {/* ここにActionスペースのコンテンツが入ります */}
      </div>
    </div>
  );
};

export default ShopListScreen;






