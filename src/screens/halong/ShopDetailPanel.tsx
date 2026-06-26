import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import type { HalongShop } from '../../hooks/useHalongShops';
import { getDisplayName, getFloorDisplay, getOpenTimeDisplay, getGenreDisplay } from '../../hooks/useHalongShops';

interface ShopDetailPanelProps {
  shop: HalongShop;
  lang: 'en' | 'ja' | 'vn';
  onClose: () => void;
}

const LABEL: Record<string, Record<string, string>> = {
  location: { vn: 'Vị trí', en: 'Location', ja: '場所' },
  hours:    { vn: 'Giờ hoạt động', en: 'Hours of Operation', ja: '営業時間' },
  hotline:  { vn: 'Đường dây nóng', en: 'Hotline', ja: '電話番号' },
};

const AUTO_SLIDE_MS = 10000;

export const ShopDetailPanel: React.FC<ShopDetailPanelProps> = ({ shop, lang, onClose }) => {
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [closePressed, setClosePressed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number | null>(null);

  // 写真を非同期ロード
  useEffect(() => {
    setPhotos([null, null, null]);
    setPhotoIndex(0);
    Promise.all([1, 2, 3].map(n =>
      invoke<string | null>('get_local_shop_photo', { mallId: 'halong', shopId: shop.shopId, photoNum: n })
        .catch(() => null)
    )).then(results => setPhotos(results));
  }, [shop.shopId]);

  const availablePhotos = photos.filter(Boolean) as string[];
  // 写真がなければロゴ表示
  const carouselSources: (string | null)[] = availablePhotos.length > 0 ? availablePhotos : [shop.logoDataUrl];
  const totalSlides = carouselSources.length;

  const goTo = useCallback((next: number, dir: 1 | -1) => {
    setSlideDir(dir);
    setPhotoIndex(next);
  }, []);

  const goNext = useCallback(() => {
    if (totalSlides <= 1) return;
    goTo((photoIndex + 1) % totalSlides, 1);
  }, [photoIndex, totalSlides, goTo]);

  const goPrev = useCallback(() => {
    if (totalSlides <= 1) return;
    goTo((photoIndex - 1 + totalSlides) % totalSlides, -1);
  }, [photoIndex, totalSlides, goTo]);

  // 自動スライド
  useEffect(() => {
    if (totalSlides <= 1) return;
    timerRef.current = setTimeout(goNext, AUTO_SLIDE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [photoIndex, totalSlides, goNext]);

  // タッチスワイプ
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 30) return;
    if (dx < 0) goNext(); else goPrev();
  };

  const floorText = getFloorDisplay(shop, lang);
  const openTime  = getOpenTimeDisplay(shop, lang);
  const genreText = getGenreDisplay(shop.genre, lang);

  const slideVariants = {
    enter:  (dir: number) => ({ x: dir > 0 ?  590 : -590, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir: number) => ({ x: dir > 0 ? -590 :  590, opacity: 0 }),
  };

  return (
    <div style={{ position: 'absolute', inset: 0, backgroundColor: '#ffffff' }}>

      {/* ── 写真カルーセル ── */}
      <div
        style={{
          position: 'absolute', left: '30px', top: '30px',
          width: '590px', height: '590px', borderRadius: '20px',
          backgroundColor: '#f5f5f5', overflow: 'hidden',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={slideDir}>
          <motion.div
            key={photoIndex}
            custom={slideDir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'tween', duration: 0.35, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {carouselSources[photoIndex] ? (
              <img
                src={carouselSources[photoIndex]!}
                draggable={false}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#eeeeee' }} />
            )}
          </motion.div>
        </AnimatePresence>

        {/* ドットインジケーター */}
        {totalSlides > 1 && (
          <div style={{
            position: 'absolute', bottom: '12px', left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: '8px', pointerEvents: 'none',
          }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <div key={i} style={{
                width: '8px', height: '8px', borderRadius: '50%',
                backgroundColor: i === photoIndex ? '#ffffff' : 'rgba(255,255,255,0.5)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                transition: 'background-color 0.3s',
              }} />
            ))}
          </div>
        )}
      </div>

      {/* ── ロゴ ── */}
      <div style={{
        position: 'absolute', left: '30px', top: '650px',
        width: '120px', height: '120px', borderRadius: '16px',
        backgroundColor: '#ffffff', overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {shop.logoDataUrl && (
          <img src={shop.logoDataUrl} draggable={false}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
        )}
      </div>

      {/* ── 店舗名 ── */}
      <div style={{
        position: 'absolute', left: '180px', top: '668px',
        fontSize: '36px', fontWeight: 'bold', color: '#000000',
        width: '440px', lineHeight: 1.2,
        overflow: 'hidden', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {getDisplayName(shop, lang)}
      </div>

      {/* ── ジャンル ── */}
      <div style={{
        position: 'absolute', left: '180px', top: '723px',
        fontSize: '24px', fontWeight: 'normal', color: '#555555',
      }}>
        {genreText}
      </div>

      {/* ── 区切り線 ── */}
      <svg style={{ position: 'absolute', left: '30px', top: '800px' }}
        width="590" height="1" viewBox="0 0 590 1" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="0.5" x2="590" y2="0.5" stroke="#DDDDDD" strokeWidth="1" strokeLinecap="round" />
      </svg>

      {/* ── 場所 ── */}
      <div style={{
        position: 'absolute', left: '64px', top: '830px',
        fontSize: '24px', fontWeight: 'normal', color: '#888888',
      }}>
        {LABEL.location[lang]}
      </div>
      <div style={{
        position: 'absolute', left: '64px', top: '871px',
        fontSize: '24px', fontWeight: 'bold', color: '#000000',
      }}>
        {floorText}{shop.section ? `　${shop.section}` : ''}
      </div>

      {/* ── 営業時間 ── */}
      <div style={{
        position: 'absolute', left: '64px', top: '930px',
        fontSize: '24px', fontWeight: 'normal', color: '#888888',
      }}>
        {LABEL.hours[lang]}
      </div>
      {openTime && (
        <div style={{
          position: 'absolute', left: '64px', top: '971px',
          fontSize: '24px', fontWeight: 'bold', color: '#000000',
          width: '522px',
        }}>
          {openTime}
        </div>
      )}

      {/* ── 電話番号 ── */}
      {shop.tel && (
        <>
          <div style={{
            position: 'absolute', left: '64px', top: '1059px',
            fontSize: '24px', fontWeight: 'normal', color: '#888888',
          }}>
            {LABEL.hotline[lang]}
          </div>
          <div style={{
            position: 'absolute', left: '64px', top: '1100px',
            fontSize: '24px', fontWeight: 'bold', color: '#000000',
          }}>
            {shop.tel}
          </div>
        </>
      )}

      {/* ── クローズボタン ── */}
      <div
        style={{
          position: 'absolute', left: '30px', top: '1258px',
          width: '590px', height: '50px', borderRadius: '25px',
          backgroundColor: closePressed ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          transition: 'background-color 0.1s',
        }}
        onClick={onClose}
        onMouseDown={() => setClosePressed(true)}
        onMouseUp={() => setClosePressed(false)}
        onMouseLeave={() => setClosePressed(false)}
        onTouchStart={() => setClosePressed(true)}
        onTouchEnd={() => { setClosePressed(false); onClose(); }}
        onTouchCancel={() => setClosePressed(false)}
      >
        <svg width="32" height="32" viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M88.4327 90L50 51.5673L51.5673 50L90 88.4327L88.4327 90ZM51.5673 90L50 88.4327L88.4327 50L90 51.5673L51.5673 90Z" fill="white"/>
        </svg>
      </div>
    </div>
  );
};
