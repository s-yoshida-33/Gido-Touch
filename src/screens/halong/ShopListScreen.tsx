// src/screens/halong/ShopListScreen.tsx
// Screen size: 3840×2160 (16:9 landscape)

import { useState, useRef, useEffect, useMemo } from 'react';
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { useHalongAssets } from '../../hooks/useHalongAssets';
import { useHalongMaps } from '../../hooks/useHalongMaps';
import { useHalongShops } from '../../hooks/useHalongShops';
import { loadMallSettings } from '../../utils/settings';


export default function HalongShopListScreen() {
  const [selectedLang, setSelectedLang] = useState<'en' | 'ja' | 'vn'>('en');
  const [langPopupOpen, setLangPopupOpen] = useState(false);
  const assets = useHalongAssets(selectedLang);
  const maps = useHalongMaps();
  const allShops = useHalongShops();
  const [currentFloor, setCurrentFloor] = useState<string>('1F');
  const [selectedPicto, setSelectedPicto] = useState<string | null>(null);
  const [pressedGenreNav, setPressedGenreNav] = useState<'prev' | 'next' | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [showFloorLabel, setShowFloorLabel] = useState(true);
  const transformComponentRef = useRef<ReactZoomPanPinchContentRef>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const genreScrollRef = useRef<HTMLDivElement>(null);

  const FLOOR_ORDER = ['1F', '2F', '3F', '4F'];

  const filteredShops = useMemo(() => {
    let result = allShops;

    // ジャンルフィルタリング（ショップ数が変化するのはここのみ）
    if (selectedGenre !== 'all') {
      result = result.filter(s => s.genre === selectedGenre);
    }

    // 区画番号が空のショップを除外
    result = result.filter(s => s.section && s.section.trim() !== '');

    // ソート: 選択フロア優先 → フロア昇順 → 区画番号昇順
    return [...result].sort((a, b) => {
      const aOnFloor = a.floor === currentFloor;
      const bOnFloor = b.floor === currentFloor;
      if (aOnFloor && !bOnFloor) return -1;
      if (!aOnFloor && bOnFloor) return 1;

      const fA = FLOOR_ORDER.indexOf(a.floor);
      const fB = FLOOR_ORDER.indexOf(b.floor);
      if (fA !== fB) return fA - fB;

      return (a.section || '').localeCompare(b.section || '', 'ja', { numeric: true });
    });
  }, [allShops, currentFloor, selectedGenre]);

  useEffect(() => {
    async function loadFloorSetting() {
      try {
        const mallSettings = await loadMallSettings('halong');
        if (mallSettings.currentFloorSetting) {
          setCurrentFloor(mallSettings.currentFloorSetting);
        }
      } catch {
        // 設定未保存またはTauri未使用 → デフォルト1Fのまま
      }
    }
    loadFloorSetting();
  }, []);

  function updateGenreScrollability() {
    const el = genreScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }

  useEffect(() => {
    updateGenreScrollability();
    const el = genreScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateGenreScrollability);
    return () => el.removeEventListener('scroll', updateGenreScrollability);
  }, []);

  function scrollGenre(direction: 'prev' | 'next') {
    if (!genreScrollRef.current) return;
    const amount = 3 * (120 + 15);
    const target = genreScrollRef.current.scrollLeft + (direction === 'next' ? amount : -amount);
    genreScrollRef.current.scrollTo({ left: target, behavior: 'smooth' });
  }

  useEffect(() => {
    if (transformComponentRef.current) {
      transformComponentRef.current.resetTransform(0);
    }
    setShowHint(true);
    setShowFloorLabel(true);
  }, [currentFloor]);

  function handleFloorSelect(floor: string) {
    setCurrentFloor(floor);
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
            <div style={{ display: "flex", flexDirection: "row", gap: "30px", alignSelf: "flex-start", flexShrink: 0 }}>
              {/* info */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('info')}
              >
                <img src={assets.pictos.info.default} alt="info" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.info.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'info' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* restroom */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('restroom')}
              >
                <img src={assets.pictos.restroom.default} alt="restroom" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.restroom.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'restroom' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* smoking */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('smoking')}
              >
                <img src={assets.pictos.smoking.default} alt="smoking" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.smoking.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'smoking' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>

            {/* ピクトボタン行2（コインロッカー・ATM・エレベーター） */}
            <div style={{ display: "flex", flexDirection: "row", gap: "30px", alignSelf: "flex-start", flexShrink: 0, marginTop: "30px" }}>
              {/* lockers */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('lockers')}
              >
                <img src={assets.pictos.lockers.default} alt="lockers" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.lockers.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'lockers' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* atm */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('atm')}
              >
                <img src={assets.pictos.atm.default} alt="atm" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.atm.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'atm' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
              {/* elevator */}
              <div
                style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }}
                onClick={() => handlePictoSelect('elevator')}
              >
                <img src={assets.pictos.elevator.default} alt="elevator" draggable={false}
                  style={{ width: "165px", height: "165px", display: "block" }} />
                <img src={assets.pictos.elevator.highlight} alt="" draggable={false}
                  style={{ position: "absolute", top: 0, left: 0, width: "165px", height: "165px", display: "block",
                    opacity: selectedPicto === 'elevator' ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
              </div>
            </div>

            {/* スペーサー */}
            <div style={{ flex: 1 }} />

            {/* フロアボタン（下・中央）上から 4F→3F→2F→1F */}
            <div
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "50px", flexShrink: 0 }}
            >
              {((['4F', '3F', '2F', '1F'] as const)).map(floor => (
                <div
                  key={floor}
                  style={{ position: "relative", display: "inline-block", cursor: "pointer", touchAction: "none", flexShrink: 0, filter: currentFloor === floor ? "none" : "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))", transition: "filter 0.3s ease-in-out" }}
                  onClick={() => handleFloorSelect(floor)}
                >
                  <img src={assets.floorButtons[floor].default} alt={floor} draggable={false}
                    style={{ width: "555px", height: "174px", display: "block" }} />
                  <img src={assets.floorButtons[floor].highlight} alt="" draggable={false}
                    style={{ position: "absolute", top: 0, left: 0, width: "555px", height: "174px", display: "block",
                      opacity: currentFloor === floor ? 1 : 0, transition: "opacity 0.3s ease-in-out", pointerEvents: "none" }} />
                </div>
              ))}
            </div>
          </div>

          {/* マップコンテナ */}
          <div
            style={{
              flex: 1,
              height: "2060px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* ズームパン対応マップ */}
            <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
              <TransformWrapper
                ref={transformComponentRef}
                initialScale={1}
                minScale={1}
                maxScale={4}
                centerOnInit={true}
                limitToBounds={true}
                doubleClick={{ disabled: true }}
                panning={{ disabled: false, velocityDisabled: true }}
                wheel={{ step: 0.1 }}
                alignmentAnimation={{ animationTime: 0, sizeX: 0, sizeY: 0 }}
                velocityAnimation={{ disabled: true }}
                zoomAnimation={{ disabled: true }}
                onPanningStart={(ref) => {
                  if (ref.state.scale > 1.01) {
                    setShowHint(false);
                    setShowFloorLabel(false);
                  }
                }}
                onTransformed={(_, state) => {
                  const isDefault = Math.abs(state.scale - 1) < 0.01 && Math.abs(state.positionX) < 1 && Math.abs(state.positionY) < 1;
                  setShowHint(isDefault);
                  setShowFloorLabel(isDefault);
                }}
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: "100%" }}
                  contentStyle={{ width: "100%", height: "100%" }}
                >
                  <img
                    src={maps[currentFloor as '1F' | '2F' | '3F' | '4F'] ?? maps['1F']}
                    alt={`${currentFloor} map`}
                    draggable={false}
                    style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>

            {/* フロアラベル (x:50, y:50) */}
            <img
              src={assets.floorLabels[currentFloor as '1F' | '2F' | '3F' | '4F']}
              alt={currentFloor}
              draggable={false}
              style={{
                position: "absolute",
                left: "50px",
                top: "50px",
                width: "250px",
                height: "166px",
                display: "block",
                opacity: showFloorLabel ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            {/* ヒント (x:400, y:85) */}
            <img
              src={assets.hint}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "400px",
                top: "85px",
                width: "654px",
                height: "96px",
                display: "block",
                opacity: showHint ? 1 : 0,
                transition: "opacity 0.3s ease-in-out",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

          </div>

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
            flexShrink: 0,
            position: "relative",
          }}
        >
          {/* ジャンルスクロールエリア（フル幅、prevとnextの下レイヤー） */}
          <div
            ref={genreScrollRef}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              overflowX: "hidden",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: "15px", padding: "0 15px", flexShrink: 0 }}>
              {([ 'all', 'fashion', 'goods', 'gourmet', 'service' ] as const).map(genre => (
                <div
                  key={genre}
                  style={{ position: "relative", cursor: "pointer", touchAction: "none", flexShrink: 0 }}
                  onClick={() => setSelectedGenre(genre)}
                >
                  <img
                    src={assets.genres[genre]}
                    alt={genre}
                    draggable={false}
                    style={{ width: "120px", height: "120px", display: "block" }}
                  />
                  <img
                    src={assets.genres[`${genre}Highlight` as keyof typeof assets.genres]}
                    alt=""
                    draggable={false}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "120px",
                      height: "120px",
                      display: "block",
                      opacity: selectedGenre === genre ? 1 : 0,
                      transition: "opacity 0.3s ease-in-out",
                      pointerEvents: "none",
                      filter: "drop-shadow(0px 0px 6px rgba(0, 0, 0, 0.4))",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* prevボタン（スクロール可能な場合のみ表示、アイコンに重なる） */}
          {canScrollLeft && (
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "33px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                touchAction: "none",
                zIndex: 10,
                opacity: pressedGenreNav === 'prev' ? 0.6 : 1,
                transition: "opacity 0.1s ease-in-out",
              }}
              onClick={() => scrollGenre('prev')}
              onMouseDown={() => setPressedGenreNav('prev')}
              onMouseUp={() => setPressedGenreNav(null)}
              onMouseLeave={() => setPressedGenreNav(null)}
              onTouchStart={() => setPressedGenreNav('prev')}
              onTouchEnd={() => setPressedGenreNav(null)}
            >
              <img src={assets.genres.prev} alt="prev" draggable={false}
                style={{ width: "33px", height: "74px", display: "block" }} />
            </div>
          )}

          {/* nextボタン（スクロール可能な場合のみ表示、アイコンに重なる） */}
          {canScrollRight && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: "33px",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                touchAction: "none",
                zIndex: 10,
                opacity: pressedGenreNav === 'next' ? 0.6 : 1,
                transition: "opacity 0.1s ease-in-out",
              }}
              onClick={() => scrollGenre('next')}
              onMouseDown={() => setPressedGenreNav('next')}
              onMouseUp={() => setPressedGenreNav(null)}
              onMouseLeave={() => setPressedGenreNav(null)}
              onTouchStart={() => setPressedGenreNav('next')}
              onTouchEnd={() => setPressedGenreNav(null)}
            >
              <img src={assets.genres.next} alt="next" draggable={false}
                style={{ width: "33px", height: "74px", display: "block" }} />
            </div>
          )}

          {/* インナーシャドウオーバーレイ */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "20px",
              boxShadow: "inset 4px 4px 12px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
              zIndex: 20,
            }}
          />
        </div>

        {/* ショップリストコンテナ */}
        <div
          style={{
            width: "650px",
            height: "1338px",
            borderRadius: "20px",
            backgroundColor: "#ffffff",
            marginTop: "25px",
            flexShrink: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* ショップカードリスト */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              overflowY: "auto",
              padding: "25px",
              display: "flex",
              flexDirection: "column",
              gap: "25px",
              boxSizing: "border-box",
            }}
          >
            {filteredShops.map(shop => (
              <div
                key={shop.id}
                style={{
                  width: "600px",
                  height: "120px",
                  borderRadius: "10px",
                  backgroundColor: "#ffffff",
                  flexShrink: 0,
                  filter: "drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.4))",
                  position: "relative",
                }}
              >
                {/* ロゴエリア 120×120 */}
                <div style={{ position: "absolute", left: 0, top: 0, width: "120px", height: "120px", overflow: "hidden", borderRadius: "10px 0 0 10px" }}>
                  {shop.logoDataUrl && (
                    <img src={shop.logoDataUrl} alt={shop.name} draggable={false}
                      style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  )}
                </div>

                {/* フロアラベル 56×30 黒 */}
                <div style={{ position: "absolute", left: "120px", top: 0, width: "56px", height: "30px", backgroundColor: "#000000",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>{shop.floor}</span>
                </div>

                {/* 区画番号ラベル 84×30 グレー（number が空の場合は非表示） */}
                {shop.section && (
                  <div style={{ position: "absolute", left: "176px", top: 0, width: "84px", height: "30px", backgroundColor: "#888888",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>{shop.section}</span>
                  </div>
                )}

                {/* ショップ名（ロゴから20px右、縦中央） */}
                <div
                  style={{
                    position: "absolute",
                    left: "140px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#000000",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "440px",
                  }}
                >
                  {shop.name}
                </div>
              </div>
            ))}
          </div>
          {/* インナーシャドウオーバーレイ */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "20px",
              boxShadow: "inset 4px 4px 12px rgba(0, 0, 0, 0.4)",
              pointerEvents: "none",
            }}
          />
        </div>

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

        {/* 言語選択ボタン＋ポップアップ */}
        <div
          style={{
            position: "relative",
            flexShrink: 0,
            marginTop: "25px",
            marginBottom: "25px",
            width: "658px",
          }}
        >
          {/* ポップアップ（言語選択） */}
          {langPopupOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 10px)",
                left: "29px",
                width: "600px",
                zIndex: 100,
              }}
            >
              {/* 背景 */}
              <img src={assets.langButtons.select.bg} alt="" draggable={false}
                style={{ width: "600px", height: "321px", display: "block", filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))" }} />
              {/* ボタン群（bg上に絶対配置） */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingTop: "20px",
                  paddingBottom: "63px",
                  gap: "20px",
                  boxSizing: "border-box",
                }}
              >
                {((['vn', 'en', 'ja'] as const)).map(lang => (
                  <div
                    key={lang}
                    style={{ position: "relative", cursor: "pointer", touchAction: "none", width: "560px", flexShrink: 0, filter: selectedLang === lang ? "none" : "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))", transition: "filter 0.3s ease-in-out" }}
                    onClick={() => { setSelectedLang(lang); setLangPopupOpen(false); }}
                  >
                    <img src={assets.langButtons.select[lang]} alt={lang} draggable={false}
                      style={{ width: "560px", height: "66px", display: "block" }} />
                    <img src={assets.langButtons.select[`${lang}Highlight` as 'enHighlight' | 'jaHighlight' | 'vnHighlight']} alt="" draggable={false}
                      style={{
                        position: "absolute", top: 0, left: 0, width: "560px", height: "66px", display: "block",
                        opacity: selectedLang === lang ? 1 : 0,
                        transition: "opacity 0.3s ease-in-out",
                        pointerEvents: "none",
                      }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 現在の言語ボタン */}
          <img
            src={assets.langButtons[selectedLang]}
            alt={selectedLang}
            draggable={false}
            style={{
              width: "658px",
              height: "94px",
              display: "block",
              cursor: "pointer",
              touchAction: "none",
              filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))",
            }}
            onClick={() => setLangPopupOpen(prev => !prev)}
          />
        </div>
      </div>
    </div>
  );
}
