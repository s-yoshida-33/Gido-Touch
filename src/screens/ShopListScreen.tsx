// src/screens/ShopListScreen.tsx
import React, { useEffect, useRef } from "react";
import VerticalVideoSlot from "../components/VerticalVideoSlot";
import IndependentVideoPlayer from "../components/IndependentVideoPlayer";
import button1F from "../assets/button-1F.svg";
import button2F from "../assets/button-2F.svg";
import button3F from "../assets/button-3F.svg";
import button1FHighlight from "../assets/button-1F-highlight.svg";
import button2FHighlight from "../assets/button-2F-highlight.svg";
import button3FHighlight from "../assets/button-3F-highlight.svg";
import selectLanguage from "../assets/select-language.svg";
import openTime from "../assets/open-time.svg";

/**
 * Shop list screen
 * Screen size: 3840×2160
 * Background: Black
 * Shop list area: 2640×2160 (left side)
 * Shop list area background: #FDE7C6
 * Action space: 1140×2160 (right side)
 * Action space background: Black
 */
const ShopListScreen: React.FC = () => {
  // Scroll container ref
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag scroll state
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartXRef = useRef(0);

  // Temporary card data (50 items)
  const cardCount = 50;
  const cards = Array.from({ length: cardCount }, (_, i) => ({
    id: i + 1,
    name: `店舗 ${i + 1}`,
  }));

  // Layout: 6 rows per column
  const rowsPerColumn = 6;
  const totalColumns = Math.ceil(cards.length / rowsPerColumn);

  // Card size calculation
  // Content area: width: 2580px (2640 - 30*2), height: 2040px (2100 - 30*2)
  const cardHeight = (2040 - 20 * (rowsPerColumn - 1)) / rowsPerColumn; // Row gap: 20px
  const cardWidth = 376; // Card width
  const columnGap = 20; // Column gap
  const imageHeight = 250; // Image height

  // Group cards by column
  const columns: typeof cards[] = [];
  for (let i = 0; i < totalColumns; i++) {
    const startIndex = i * rowsPerColumn;
    const endIndex = Math.min(startIndex + rowsPerColumn, cards.length);
    columns.push(cards.slice(startIndex, endIndex));
  }

  // Mouse drag scroll
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

  // Add style to hide scrollbar
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
      {/* Shop list area (left side) */}
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
        {/* Scrollable container */}
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
          {/* Card grid container */}
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
                      borderRadius: "0 30px 30px 30px", // Top-right, bottom-left, bottom-right: 30px
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    {/* Floor display (top-left) */}
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
                    {/* Image area */}
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
                    {/* Content area */}
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

      {/* Action space (right side) */}
      <div
        style={{
          width: "1140px",
          height: "2160px",
          backgroundColor: "#000000",
          flexShrink: 0,
          boxSizing: "border-box",
          marginLeft: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Independent video area (top) */}
        <div
          style={{
            width: "1080px",
            height: "608px",
            marginTop: "30px",
            marginLeft: "30px",
            marginRight: "30px",
            marginBottom: "0px",
            boxSizing: "border-box",
            overflow: "hidden",
            alignSelf: "flex-start",
          }}
        >
          <IndependentVideoPlayer />
        </div>

        {/* Bottom area container (floor buttons + CMS) */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Floor selection button area and business hours / language selection area (above CMS area) */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              marginLeft: "30px",
              marginBottom: "30px",
            }}
          >
          {/* Floor selection button area (left side) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "20px",
            }}
          >
            {/* 3F button and FOOD FOREST */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "30px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "0";
                }}
              >
                <img
                  src={button3F}
                  alt="3F"
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={button3FHighlight}
                  alt="3F Highlight"
                  className="highlight"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
              </div>
              {/* TODO: Add FOOD FOREST button */}
            </div>
            {/* 2F button and RESTAURANT */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "30px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "0";
                }}
              >
                <img
                  src={button2F}
                  alt="2F"
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={button2FHighlight}
                  alt="2F Highlight"
                  className="highlight"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
              </div>
              {/* TODO: Add RESTAURANT button */}
            </div>
            {/* 1F button and SUZAKA 蔵 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "30px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  display: "inline-block",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  const highlight = e.currentTarget.querySelector(".highlight") as HTMLElement;
                  if (highlight) highlight.style.opacity = "0";
                }}
              >
                <img
                  src={button1F}
                  alt="1F"
                  style={{
                    display: "block",
                  }}
                />
                <img
                  src={button1FHighlight}
                  alt="1F Highlight"
                  className="highlight"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "block",
                    opacity: 0,
                    transition: "opacity 0.3s ease-in-out",
                    pointerEvents: "none",
                  }}
                />
              </div>
              {/* TODO: Add SUZAKA 蔵 button */}
            </div>
          </div>

          {/* Business hours / language selection area (right side of 1F button) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              alignItems: "flex-start",
              marginLeft: "30px",
            }}
          >
            <img
              src={openTime}
              alt="Open Time"
              style={{
                display: "block",
              }}
            />
            <img
              src={selectLanguage}
              alt="Select Language"
              style={{
                display: "block",
              }}
            />
          </div>
          </div>

          {/* CMS area (bottom) */}
          <div
            style={{
              width: "1080px",
              height: "844px",
              margin: "30px",
              marginTop: "0px",
              marginBottom: "30px",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
              }}
            >
              <VerticalVideoSlot />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopListScreen;






