// src/screens/halong/ShopListScreen.tsx
// Screen size: 3840×2160 (16:9 landscape)

export default function HalongShopListScreen() {
  return (
    <div
      style={{
        width: "3840px",
        height: "2160px",
        backgroundColor: "#ffffff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {/* 左エリア: 50px余白 + メインコンテナ3040×2060 + 右余白50px = 3140px */}
      <div
        style={{
          width: "3140px",
          height: "2160px",
          padding: "50px",
          boxSizing: "border-box",
        }}
      >
        {/* メインコンテナ */}
        <div
          style={{
            width: "3040px",
            height: "2060px",
            borderRadius: "40px",
            boxShadow: "inset 10px 10px 30px rgba(0, 0, 0, 0.4)",
            overflow: "hidden",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "row",
          }}
        >
          {/* オペレーションコンテナ */}
          <div
            style={{
              width: "655px",
              height: "2060px",
              backgroundColor: "#DDDDDD",
              flexShrink: 0,
            }}
          />

          {/* マップコンテナ */}
          <div
            style={{
              flex: 1,
              height: "2060px",
              backgroundColor: "#F2F2F2",
            }}
          />
        </div>
      </div>

      {/* インフォコンテナ */}
      <div
        style={{
          width: "700px",
          height: "2160px",
          backgroundColor: "#555555",
          flexShrink: 0,
        }}
      />
    </div>
  );
}
