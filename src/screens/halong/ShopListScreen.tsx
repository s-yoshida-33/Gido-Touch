// src/screens/halong/ShopListScreen.tsx
// Screen size: 3840×2160 (16:9 landscape)

import { useHalongAssets } from '../../hooks/useHalongAssets';

export default function HalongShopListScreen() {
  const assets = useHalongAssets();
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
            position: "relative",
            width: "3040px",
            height: "2060px",
            borderRadius: "40px",
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
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              padding: "50px",
              boxSizing: "border-box",
              gap: "50px",
            }}
          >
            {/* 3F（上） */}
            <img
              src={assets.floorButtons['3F'].default}
              alt="3F"
              style={{ width: "555px", height: "174px", flexShrink: 0, display: "block", order: 1 }}
            />
            {/* 2F */}
            <img
              src={assets.floorButtons['2F'].default}
              alt="2F"
              style={{ width: "555px", height: "174px", flexShrink: 0, display: "block", order: 2 }}
            />
            {/* 1F（下） */}
            <img
              src={assets.floorButtons['1F'].default}
              alt="1F"
              style={{ width: "555px", height: "174px", flexShrink: 0, display: "block", order: 3 }}
            />
          </div>

          {/* マップコンテナ */}
          <div
            style={{
              flex: 1,
              height: "2060px",
              backgroundColor: "#F2F2F2",
            }}
          />

          {/* インナーシャドウオーバーレイ */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "40px",
              boxShadow: "inset 10px 10px 30px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: "25px",
        }}
      >
        {/* ジャンルコンテナ */}
        <div
          style={{
            width: "650px",
            height: "150px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
            boxShadow: "inset 4px 4px 12px rgba(0, 0, 0, 0.4)",
            flexShrink: 0,
          }}
        />

        {/* ショップリストコンテナ */}
        <div
          style={{
            width: "650px",
            height: "1365px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
            boxShadow: "inset 4px 4px 12px rgba(0, 0, 0, 0.4)",
            marginTop: "25px",
            flexShrink: 0,
          }}
        />

        {/* 営業時間 */}
        <img
          src={assets.openTime}
          alt=""
          style={{
            width: "650px",
            height: "453px",
            marginTop: "25px",
            flexShrink: 0,
            display: "block",
          }}
        />

        {/* 言語選択ボタン */}
        <img
          src={assets.langButtons.en}
          alt=""
          style={{
            width: "658px",
            height: "75px",
            marginTop: "25px",
            flexShrink: 0,
            display: "block",
          }}
        />
      </div>
    </div>
  );
}
