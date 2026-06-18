// src/screens/halong/ShopListScreen.tsx
// Screen size: 3840×2160 (16:9 landscape)

import { useState } from 'react';
import { useHalongAssets } from '../../hooks/useHalongAssets';

interface Props {
  defaultFloor?: '1F' | '2F' | '3F' | null;
}

export default function HalongShopListScreen({ defaultFloor = null }: Props) {
  const assets = useHalongAssets();
  const [currentFloor, setCurrentFloor] = useState<string | null>(defaultFloor);
  const [selectedPicto, setSelectedPicto] = useState<string | null>(null);

  function handleFloorSelect(floor: string) {
    setCurrentFloor(prev => (prev === floor ? null : floor));
  }

  function handlePictoSelect(picto: string) {
    setSelectedPicto(prev => (prev === picto ? null : picto));
  }
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
              padding: "50px",
              boxSizing: "border-box",
            }}
          >
            {/* ピクトボタン行（左上） */}
            <div style={{ display: "flex", flexDirection: "row", gap: "18px", alignSelf: "flex-start", flexShrink: 0 }}>
              {/* info */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handlePictoSelect('info')}
              >
                <img src={assets.pictos.info.default} alt="info" draggable={false}
                  style={{ width: "173px", height: "173px", display: "block" }} />
                <img src={assets.pictos.info.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "173px", height: "173px", display: "block",
                    opacity: selectedPicto === 'info' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* restroom */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handlePictoSelect('restroom')}
              >
                <img src={assets.pictos.restroom.default} alt="restroom" draggable={false}
                  style={{ width: "173px", height: "173px", display: "block" }} />
                <img src={assets.pictos.restroom.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "173px", height: "173px", display: "block",
                    opacity: selectedPicto === 'restroom' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* smoking */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handlePictoSelect('smoking')}
              >
                <img src={assets.pictos.smoking.default} alt="smoking" draggable={false}
                  style={{ width: "173px", height: "173px", display: "block" }} />
                <img src={assets.pictos.smoking.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "173px", height: "173px", display: "block",
                    opacity: selectedPicto === 'smoking' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>

            {/* ピクトボタン行2（コインロッカー・ATM・エレベーター） */}
            <div style={{ display: "flex", flexDirection: "row", gap: "18px", alignSelf: "flex-start", flexShrink: 0, marginTop: "18px" }}>
              {/* lockers */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handlePictoSelect('lockers')}
              >
                <img src={assets.pictos.lockers.default} alt="lockers" draggable={false}
                  style={{ width: "173px", height: "173px", display: "block" }} />
                <img src={assets.pictos.lockers.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "173px", height: "173px", display: "block",
                    opacity: selectedPicto === 'lockers' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* atm */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handlePictoSelect('atm')}
              >
                <img src={assets.pictos.atm.default} alt="atm" draggable={false}
                  style={{ width: "173px", height: "173px", display: "block" }} />
                <img src={assets.pictos.atm.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "173px", height: "173px", display: "block",
                    opacity: selectedPicto === 'atm' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* elevator */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handlePictoSelect('elevator')}
              >
                <img src={assets.pictos.elevator.default} alt="elevator" draggable={false}
                  style={{ width: "173px", height: "173px", display: "block" }} />
                <img src={assets.pictos.elevator.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "173px", height: "173px", display: "block",
                    opacity: selectedPicto === 'elevator' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>

            {/* スペーサー */}
            <div style={{ flex: 1 }} />

            {/* フロアボタン（下・中央） */}
            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "50px", flexShrink: 0 }}
            >
              {/* 3F（上） */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handleFloorSelect('3F')}
              >
                <img src={assets.floorButtons['3F'].default} alt="3F" draggable={false}
                  style={{ width: "555px", height: "174px", display: "block" }} />
                <img src={assets.floorButtons['3F'].highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "555px", height: "174px", display: "block",
                    opacity: currentFloor === '3F' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* 2F */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handleFloorSelect('2F')}
              >
                <img src={assets.floorButtons['2F'].default} alt="2F" draggable={false}
                  style={{ width: "555px", height: "174px", display: "block" }} />
                <img src={assets.floorButtons['2F'].highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "555px", height: "174px", display: "block",
                    opacity: currentFloor === '2F' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* 1F（下） */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                onClick={() => handleFloorSelect('1F')}
              >
                <img src={assets.floorButtons['1F'].default} alt="1F" draggable={false}
                  style={{ width: "555px", height: "174px", display: "block" }} />
                <img src={assets.floorButtons['1F'].highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "555px", height: "174px", display: "block",
                    opacity: currentFloor === '1F' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>
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
