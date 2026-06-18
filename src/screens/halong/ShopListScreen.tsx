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
        boxSizing: "border-box",
        padding: "50px",
        display: "flex",
        justifyContent: "flex-start",
        alignItems: "flex-start",
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
        }}
      />
    </div>
  );
}
