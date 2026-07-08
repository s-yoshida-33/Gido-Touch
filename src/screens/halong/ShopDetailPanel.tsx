import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import type { HalongShop } from '../../hooks/useHalongShops';
import { getDisplayName, getFloorDisplay, getOpeningHoursDisplay, getGenreDisplay } from '../../hooks/useHalongShops';
import type { useHalongAssets } from '../../hooks/useHalongAssets';

interface ShopDetailPanelProps {
  shop: HalongShop;
  lang: 'en' | 'ja' | 'vn';
  onClose: () => void;
  assets: ReturnType<typeof useHalongAssets>;
}

const LABEL: Record<string, Record<string, string>> = {
  location: { vn: 'Vị trí',         en: 'Location',      ja: '場所' },
  hours:    { vn: 'Giờ mở cửa',     en: 'Opening Hours', ja: '営業時間' },
  phone:    { vn: 'Số điện thoại',  en: 'Tel',           ja: '電話番号' },
};

const ICON_LOCATION = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyLjI0NzggMEM3LjY5MDY2IDAuMDAxNDUzMTIgNC4wMDE0NSAzLjY5Mjg2IDQgOC4yNDc4QzQuMDAyOTUgOC45MTc5NyA0LjE0MjA4IDkuNTkwMzQgNC4zNTQ1MiAxMC4zMDA4QzQuNzI4MDYgMTEuNTQwMSA1LjM0MzMgMTIuODk0MyA2LjA1NTE5IDE0LjI2MzlDOC4xOTA5NSAxOC4zNTg5IDExLjIyNjggMjIuNTc5MSAxMS4yNDM3IDIyLjYwMjZMMTIuMjQ3OCAyNEwxMy4yNTA1IDIyLjYwMjVDMTMuMjYyMiAyMi41ODc4IDE1LjAzMDMgMjAuMTI1NSAxNi44MTM3IDE3LjE1MjVDMTcuNzA1MSAxNS42NjM1IDE4LjYwMTYgMTQuMDQ3MSAxOS4yOTAxIDEyLjUxODVDMTkuNjM0MyAxMS43NTM5IDE5LjkyNjUgMTEuMDEwNSAyMC4xNDExIDEwLjMwMDdDMjAuMzUzNSA5LjU5MDMgMjAuNDkxMiA4LjkxNzkyIDIwLjQ5NDEgOC4yNDc3NUMyMC40OTI2IDMuNjkyODYgMTYuODAzNCAwLjAwMTQ1MzEyIDEyLjI0NzggMFpNMTguNDY2NCA5LjY2NDE0QzE4LjEzMTkgMTAuNzc5OCAxNy41MDQgMTIuMTkwNCAxNi43NDc2IDEzLjYzODFDMTUuNjE0NyAxNS44MTQzIDE0LjIwMTUgMTguMDg3NiAxMy4wNzYgMTkuODA1NkMxMi43NzQ0IDIwLjI2NTQgMTIuNDk3NSAyMC42ODE1IDEyLjI0NzkgMjEuMDQ5OEMxMS40NjI2IDE5Ljg4OTYgMTAuMzcwOSAxOC4yMjM2IDkuMzAyOTkgMTYuNDIyNEM4LjM2ODU5IDE0Ljg0NTMgNy40NTM5NiAxMy4xNjYgNi43ODk4OCAxMS42NjMxQzYuNDU3ODEgMTAuOTE0OSA2LjE4OTE4IDEwLjIxMDQgNi4wMTA0MSA5LjYwMTQ5QzUuODI5OTYgOC45OTUwNCA1Ljc0Njc0IDguNDc5MjUgNS43NDkyMiA4LjE1Mzc3QzUuNzUwMDYgNi4zNTUwNSA2LjQ3NDMyIDQuNzQwMDYgNy42NTE3NyAzLjU1NzY1QzguODMyNTUgMi4zODAyIDEwLjQ0NzUgMS42NTU4OSAxMi4yNDc5IDEuNjU0MjZDMTQuMDQ2NiAxLjY1NTg5IDE1LjY2MjQgMi4zODAyIDE2Ljg0MjQgMy41NTc2NUMxOC4wMjE1IDQuNzQwMDYgMTguNzQ0OSA2LjM1NTA1IDE4Ljc0NTggOC4xNTM3N0MxOC43NDgyIDguNDkwOCAxOC42NTkyIDkuMDI5NjkgMTguNDY2NCA5LjY2NDE0WiIgZmlsbD0iI0IzMEY4RSIvPgo8cGF0aCBkPSJNMTIuMjQ3OSA1LjEzNTVDMTAuNTgxOCA1LjEzNTUgOS4yMzA0NyA2LjQ4NzY2IDkuMjMwNDcgOC4xNTM3QzkuMjMwNDcgOS44MjA1OCAxMC41ODE4IDExLjE3MTEgMTIuMjQ3OSAxMS4xNzExQzEzLjkxMzEgMTEuMTcxMSAxNS4yNjUzIDkuODIwNjMgMTUuMjY1MyA4LjE1MzdDMTUuMjY1MiA2LjQ4NzYxIDEzLjkxMzEgNS4xMzU1IDEyLjI0NzkgNS4xMzU1WiIgZmlsbD0iI0IzMEY4RSIvPgo8L3N2Zz4=';

const ICON_HOURS = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDBDNS4zODMxMiAwIDAgNS4zODMzMSAwIDEyQzAgMTguNjE3MSA1LjM4MzEyIDI0IDEyIDI0QzE4LjYxNjkgMjQgMjQgMTguNjE3MSAyNCAxMkMyNCA1LjM4MzMxIDE4LjYxNjkgMCAxMiAwWk0xMiAyMi4xMjc0QzYuNDE1ODMgMjIuMTI3NCAxLjg3MjU2IDE3LjU4NDYgMS44NzI1NiAxMkMxLjg3MjU2IDYuNDE1ODMgNi40MTU4MyAxLjg3MjU2IDEyIDEuODcyNTZDMTcuNTg0MiAxLjg3MjU2IDIyLjEyNzQgNi40MTU4MyAyMi4xMjc0IDEyQzIyLjEyNzQgMTcuNTg0NiAxNy41ODQyIDIyLjEyNzQgMTIgMjIuMTI3NFoiIGZpbGw9IiNCMzBGOEUiLz4KPHBhdGggZD0iTTEyLjEyNjMgNC43MTgyNkMxMS40NjEyIDQuNzE4MjYgMTAuOTIyIDUuMjU3MzggMTAuOTIyIDUuOTIyNjJWMTEuMzc1TDcuMDc3MjIgMTUuMjE5N0M2LjYwNjc1IDE1LjY4OTggNi42MDY3NSAxNi40NTI1IDcuMDc3MjIgMTYuOTIzQzcuNTQ3NTQgMTcuMzkzMiA4LjMxMDA4IDE3LjM5MzIgOC43ODA1MSAxNi45MjNMMTMuMzMwOCAxMi4zNzI4VjExLjEzODhWNS45MjI2MkMxMy4zMzA4IDUuMjU3MzggMTIuNzkxNiA0LjcxODI2IDEyLjEyNjMgNC43MTgyNloiIGZpbGw9IiNCMzBGOEUiLz4KPC9zdmc+';

const ICON_PHONE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIyLjg1OCAxOC42NTI1QzIyLjc1NDcgMTguMzcxOCAyMi41ODEgMTguMDkzOSAyMi4zMzQ4IDE3Ljg2MDlDMjIuMDcyMSAxNy42MTMxIDIxLjcyMyAxNy4zNDgxIDIxLjMxNyAxNy4wNjI0QzIwLjcxMDYgMTYuNjM2OSAxOS45ODY4IDE2LjE4MDcgMTkuMzM5MSAxNS44MDMyQzE5LjAxNTMgMTUuNjE0NSAxOC43MTA4IDE1LjQ0NTggMTguNDQ2NyAxNS4zMTAxQzE4LjE3ODQgMTUuMTczNCAxNy45NjY2IDE1LjA3MTkgMTcuNzU4NiAxNS4wMDM0QzE3LjU4NSAxNC45NDY3IDE3LjQwNjMgMTQuOTIxNSAxNy4yMzI3IDE0LjkyMTVDMTYuNzA5MSAxNC45MjUyIDE2LjI0MzQgMTUuMTMzMSAxNS44NTM0IDE1LjQzMkMxNS40NjUzIDE1LjczNTEgMTUuMTQzNyAxNi4xNDI4IDE0Ljk1NzcgMTYuNjMzNkMxNC45MzQzIDE2LjY5NjMgMTQuOTExNyAxNi43NDQ3IDE0Ljg5MTEgMTYuNzg0OUMxNC4zMjg4IDE2LjQyNDMgMTIuOTQ0OSAxNS40MDE5IDEwLjkwODggMTIuOTk3N0M5LjUxMDE1IDExLjM0NTkgOC43MDM1OCAxMC4xMDQxIDguMjUxMTIgOS4yOTA1NUM4LjA0NTM2IDguOTE5NDQgNy45MTUzNCA4LjY0MTk5IDcuODMzMTQgOC40NTA1QzcuODc2ODEgOC40MzY4MSA3LjkyODcyIDguNDIzMDggNy45OTUzMyA4LjQxMDc1QzguNTYwNzEgOC4zMDE1MyA5LjA1NTQzIDguMDE5NDggOS40MzU3NyA3LjY0MTAxQzkuNjI1NDcgNy40NTA0MiA5Ljc4NzEgNy4yMzMzIDkuOTA2MDkgNi45ODg4NEMxMC4wMjQxIDYuNzQ0NzYgMTAuMTAwOCA2LjQ3MDA4IDEwLjEwMDggNi4xNzY2NEMxMC4xMDA4IDYuMDk4MDcgMTAuMDk1MyA2LjAxOTQyIDEwLjA4MzkgNS45Mzk5MkMxMC4wNjIzIDUuNzk0NTYgMTAuMDI2IDUuNjUxNSA5Ljk3ODI2IDUuNDgxOUM5LjgxMTAzIDQuODk3MzIgOS40ODcyMSA0LjAyNjIgOS4xMjQ4MiAzLjE2NjQ2QzguOTQzODggMi43MzcyNyA4Ljc1MzcxIDIuMzE0NSA4LjU2ODU4IDEuOTM3NDRDOC4zODI1NSAxLjU1OTQ0IDguMjA2MTggMS4yMzEyNyA4LjAzMDI4IDAuOTY4OTU1QzcuNzc3NjkgMC41OTIzNjEgNy40MjQ0NCAwLjMzNTQ4NSA3LjA2OTg2IDAuMTkxOTUzQzYuNzEzODcgMC4wNDY2NDA3IDYuMzU3MDMgMC4wMDA0MjE4NzYgNi4wMzM2NCAwQzUuNzMyMyAwIDUuNDU3MTkgMC4wNDAyMTg4IDUuMjIxNTIgMC4wOTY4OTA4QzUuMTAzNDcgMC4xMjUyMDMgNC45OTU1IDAuMTU4MTEgNC44OTYzMyAwLjE5NDcxOUM0Ljc5NjE5IDAuMjMyMTcyIDQuNzA3MDYgMC4yNzA1NjMgNC42MTA2OCAwLjMyNzY1N0w0LjYxMjA0IDAuMzI2NzY2QzQuNjEyMDQgMC4zMjY3NjYgNC42MTA2OCAwLjMyNzY1NyA0LjYxMDIxIDAuMzI4MTI2TDQuNTg1ODUgMC4yODc5MDdMNC41OTIzMSAwLjMzODE1N0M0LjU1NjQ2IDAuMzU4NzM1IDQuNDc4NCAwLjQwMjYxIDQuMzgyODcgMC40NTk3NTFDMy45NTk4NCAwLjcxMjk3IDMuMTMyMTIgMS4yNTMyMSAyLjM5MTI3IDIuMTQ1OEMxLjY1MTMxIDMuMDM0NzkgMC45OTc2OTggNC4zMDgxNSAxLjAwMDAxIDUuOTM2NjRDMS4wMDAwMSA2LjI4Mzk4IDEuMDI5NCA2LjY0Njg5IDEuMDkyMzQgNy4wMjRDMS43ODA0MyAxMS4xMzkzIDMuNzI2NTcgMTQuNTM5NCA1Ljk0NTUxIDE3LjE1OTdDOC4xNjQ0NCAxOS43Nzk1IDExLjIwMTkgMjIuMjY1OSAxNS4xNjE3IDIzLjYzOEMxNS44OTA3IDIzLjg5MDMgMTYuNTg3OSAyNCAxNy4yMzcgMjRDMTguNzk3NyAyMy45OTk1IDIwLjA0NTcgMjMuMzczNCAyMC45MTA2IDIyLjczNzFDMjEuMzQ1MSAyMi40MTgxIDIxLjY4ODYgMjIuMDk0MSAyMS45Mzk5IDIxLjgzMTdDMjIuMDY1MyAyMS43MDA1IDIyLjE2NzcgMjEuNTg0OSAyMi4yNDUzIDIxLjQ5NDRDMjIuMzIxNiAyMS40MDU3IDIyLjM3OTkgMjEuMzM0IDIyLjM5MDUgMjEuMzIyMUMyMi40ODE5IDIxLjIxNDcgMjIuNTQ1MyAyMS4xMTE5IDIyLjYxMjQgMjAuOTg4OUMyMi44MDM1IDIwLjYyNTYgMjIuOTk1NCAyMC4xMDIyIDIzIDE5LjQ3ODNDMjIuOTk5OSAxOS4yMTU2IDIyLjk2MTggMTguOTMzNiAyMi44NTggMTguNjUyNVpNMi40MTA5MSA1LjkzNjY4QzIuNDExMzggNS4yMTkxMiAyLjU2OTg1IDQuNjEyNiAyLjgxMzc3IDQuMDg1NTlDMy4xNzgwMSAzLjI5NzE5IDMuNzQ2MTcgMi42ODkyNyA0LjI1NzQyIDIuMjY1MTRDNC41MTIzNiAyLjA1MzA4IDQuNzUxMiAxLjg4ODA4IDQuOTM5MDYgMS43NjgzMkM1LjAzMjc2IDEuNzA4NDEgNS4xMTQwNiAxLjY2MDQ2IDUuMTc4ODQgMS42MjI1M0M1LjI0NDAzIDEuNTg0NTcgNS4yODgxMyAxLjU2MDMzIDUuMzMzNjMgMS41MzMzOEM1LjM0MzI0IDEuNTI2NTMgNS40NTAyNyAxLjQ4MzYgNS41NzkzNCAxLjQ1NTE5QzUuNzExMTkgMS40MjU1MiA1Ljg3Mzc2IDEuNDAzNTggNi4wMzM2NCAxLjQwNDA1QzYuMjE3ODMgMS40MDMxMSA2LjM5NTEgMS40MzI4MyA2LjUzMTQ3IDEuNDg5OTJDNi42Njk3OCAxLjU0ODQyIDYuNzY4NTIgMS42MjA2NiA2Ljg1ODU0IDEuNzUxODZDNi45ODc2MSAxLjk0MTU3IDcuMTc4MjEgMi4yOTQ0IDcuMzczODkgMi43MDQ4M0M3LjY2OTcyIDMuMzIzNjggNy45ODg5MiA0LjA4NTEyIDguMjM5MjUgNC43NDg3OEM4LjM2NDE4IDUuMDgwMTQgOC40NzI2MiA1LjM4Nzc4IDguNTUxNjIgNS42MzczNEM4LjYzMTA0IDUuODgzMjUgOC42ODExNiA2LjA4NjU5IDguNjg3NTcgNi4xNDA1NEw4LjY4OTg4IDYuMTc2NjRDOC42OTAzNSA2LjIyMzIzIDguNjc3MDYgNi4yOTI3NSA4LjYzNTcgNi4zNzgyQzguNTc1MDggNi41MDU3IDguNDQ4NzMgNi42NjAyIDguMjgzNDQgNi43ODI2NEM4LjExODUxIDYuOTA2MDYgNy45MTkxNiA2Ljk5NjU4IDcuNzMxNzYgNy4wMzEzMUM3LjQ4MDk3IDcuMDc4ODQgNy4yNjYwMiA3LjE0ODc4IDcuMDc5OTkgNy4yNDI5QzYuODAxNjMgNy4zODEzNyA2LjU5MDMxIDcuNTg3MTEgNi40NzMyIDcuNzk5MTdDNi4zNTM3OCA4LjAxMTIzIDYuMzI5NDggOC4yMDc4MyA2LjMyOTkgOC4zMjM4OUw2LjMzMzU4IDguNDAzMzlMNi4zNTU2MiA4LjUyMDM5QzYuMzg3MzIgOC42MzYwMyA2LjkyNzkzIDEwLjQ3NjEgOS44Mjk5MiAxMy45MDI3QzEyLjczMTkgMTcuMzI5MyAxNC40NjI2IDE4LjE3MTEgMTQuNTcyIDE4LjIyMThMMTQuNjkxNCAxOC4yNjUzQzE0LjczOTEgMTguMjc3NyAxNC44MjA1IDE4LjI5NDEgMTQuOTMwNyAxOC4yOTQxQzE1LjEyMzUgMTguMjk3OCAxNS40MTUyIDE4LjIzMDEgMTUuNjY3OSAxOC4wMjlDMTUuOTIyOCAxNy44Mjk4IDE2LjEyNzIgMTcuNTMwOCAxNi4yNzkzIDE3LjEyNTlDMTYuMzU5NiAxNi45MDc4IDE2LjUyNzggMTYuNjg4IDE2LjcyMDcgMTYuNTRDMTYuOTEyNyAxNi4zODgyIDE3LjEyMDcgMTYuMzIyNCAxNy4yMzI4IDE2LjMyNjFMMTcuMzIyNCAxNi4zMzg0QzE3LjM1NTkgMTYuMzQ5IDE3LjQ1ODQgMTYuMzkwMSAxNy41ODUxIDE2LjQ1MTNDMTguMDM5OCAxNi42NjcgMTguODM1IDE3LjEyMTggMTkuNTg0NSAxNy41OTg1QzE5Ljk2MDcgMTcuODM3MSAyMC4zMjgyIDE4LjA4MjUgMjAuNjQxNCAxOC4zMDc0QzIwLjk1NDIgMTguNTMwOSAyMS4yMTYxIDE4LjczODkgMjEuMzYxNiAxOC44Nzc0QzIxLjQ0NzUgMTguOTU5NiAyMS40OTcxIDE5LjA0MSAyMS41MzM4IDE5LjEzODRDMjEuNTcwMiAxOS4yMzUyIDIxLjU4OSAxOS4zNDk5IDIxLjU4OSAxOS40Nzg0QzIxLjU4OTkgMTkuNjc5NSAyMS41Mzg5IDE5LjkwOTQgMjEuNDcwNSAyMC4wOTVDMjEuNDM2OSAyMC4xODczIDIxLjM5OTMgMjAuMjY4NiAyMS4zNjgxIDIwLjMyNzFMMjEuMzI4NSAyMC4zOTQ4TDIxLjMyMDMgMjAuNDA2N0MyMS4yNzg1IDIwLjQ1NTYgMjEuMjM4NSAyMC41MDU1IDIxLjE3MTkgMjAuNTgzMUMyMC45NDY0IDIwLjg0NzMgMjAuNDcxIDIxLjM2MSAxOS43OTU4IDIxLjc5ODlDMTkuMTE5NiAyMi4yMzgxIDE4LjI2MjYgMjIuNTk1NiAxNy4yMzY5IDIyLjU5NkMxNi43NDU5IDIyLjU5NTYgMTYuMjEyMiAyMi41MTQ3IDE1LjYyNTYgMjIuMzExN0MxMS45NTg5IDIxLjA0MiA5LjEyMDcyIDE4LjcyOTcgNy4wMjQ4NyAxNi4yNTQ4QzQuOTI4OTggMTMuNzc5NCAzLjEyMDYzIDEwLjYwNDcgMi40ODQwMiA2Ljc5Mzc1QzIuNDMzNDggNi40OTA2MSAyLjQxMDkxIDYuMjA1ODkgMi40MTA5MSA1LjkzNjY4WiIgZmlsbD0iI0IzMEY4RSIvPgo8L3N2Zz4=';

const AUTO_SLIDE_MS = 10000;
// 24px bold のライン高さ（<br> 1行あたりの追加オフセット）
const LINE_HEIGHT_PX = 34;

function countLines(text: string): number {
  return text ? text.split(/<br\s*\/?>/i).length : 0;
}

function renderMultiLine(text: string) {
  const parts = text.split(/<br\s*\/?>/i);
  return parts.map((part, i) => (
    <span key={i} style={{ display: 'block' }}>{part}</span>
  ));
}

export const ShopDetailPanel: React.FC<ShopDetailPanelProps> = ({ shop, lang, onClose, assets }) => {
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

    if (import.meta.env.DEV) {
      Promise.all([1, 2, 3].map(async n => {
        const url = `/data/halong/files/shops/${shop.shopId}/thumbW640_photo${n}.webp`;
        try {
          const res = await fetch(url, { method: 'HEAD' });
          return res.ok ? url : null;
        } catch {
          return null;
        }
      })).then(results => setPhotos(results));
      return;
    }

    Promise.all([1, 2, 3].map(n =>
      invoke<string | null>('get_local_shop_photo', { mallId: 'halong', shopId: shop.shopId, photoNum: n })
        .catch(() => null)
    )).then(results => setPhotos(results));
  }, [shop.shopId]);

  const availablePhotos = photos.filter(Boolean) as string[];
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

  useEffect(() => {
    if (totalSlides <= 1) return;
    timerRef.current = setTimeout(goNext, AUTO_SLIDE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [photoIndex, totalSlides, goNext]);

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

  const floorText  = getFloorDisplay(shop, lang);
  const openTime   = getOpeningHoursDisplay(shop, lang);
  const genreText  = getGenreDisplay(shop.genre, lang);

  // 場所ボディ末尾(Y905) → 営業時間タイトル(Y930) のギャップ = 25px を統一基準に使用
  const SECTION_GAP   = 25;
  const openTimeLines = countLines(openTime);
  // 営業時間セクション末尾 Y（本文あり: ボディ開始 + 行数分, 本文なし: タイトル分のみ）
  const hoursSectionBottomY = openTime
    ? 971 + openTimeLines * LINE_HEIGHT_PX
    : 930 + LINE_HEIGHT_PX;
  // 電話番号タイトルの Y 座標（ギャップを統一）
  const phoneTitleY = hoursSectionBottomY + SECTION_GAP;

  const slideVariants = {
    enter:  (dir: number) => ({ x: dir > 0 ?  590 : -590, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir: number) => ({ x: dir > 0 ? -590 :  590, opacity: 0 }),
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute', width: '24px', height: '24px',
    objectFit: 'contain', display: 'block', pointerEvents: 'none',
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

      {/* ── 場所アイコン ── */}
      <img src={ICON_LOCATION} draggable={false} style={{ ...iconStyle, left: '30px', top: '835px' }} />

      {/* ── 場所タイトル ── */}
      <div style={{
        position: 'absolute', left: '64px', top: '830px',
        fontSize: '24px', fontWeight: 'normal', color: '#888888',
      }}>
        {LABEL.location[lang]}
      </div>

      {/* ── 場所本文 ── */}
      <div style={{
        position: 'absolute', left: '64px', top: '871px',
        fontSize: '24px', fontWeight: 'bold', color: '#000000',
      }}>
        {floorText}
      </div>

      {/* ── 営業時間アイコン ── */}
      <img src={ICON_HOURS} draggable={false} style={{ ...iconStyle, left: '30px', top: '935px' }} />

      {/* ── 営業時間タイトル ── */}
      <div style={{
        position: 'absolute', left: '64px', top: '930px',
        fontSize: '24px', fontWeight: 'normal', color: '#888888',
      }}>
        {LABEL.hours[lang]}
      </div>

      {/* ── 営業時間本文（<br> 対応・複数行） ── */}
      {openTime && (
        <div style={{
          position: 'absolute', left: '64px', top: '971px',
          fontSize: '24px', fontWeight: 'bold', color: '#000000',
          width: '522px', lineHeight: `${LINE_HEIGHT_PX}px`,
        }}>
          {renderMultiLine(openTime)}
        </div>
      )}

      {/* ── 電話番号（営業時間末尾から SECTION_GAP 分下） ── */}
      {shop.tel && (
        <>
          <img src={ICON_PHONE} draggable={false}
            style={{ ...iconStyle, left: '30px', top: `${phoneTitleY + 5}px` }} />
          <div style={{
            position: 'absolute', left: '64px', top: `${phoneTitleY}px`,
            fontSize: '24px', fontWeight: 'normal', color: '#888888',
          }}>
            {LABEL.phone[lang]}
          </div>
          <div style={{
            position: 'absolute', left: '64px', top: `${phoneTitleY + 41}px`,
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
          width: '590px', height: '50px',
          cursor: 'pointer',
        }}
        onClick={onClose}
        onMouseDown={() => setClosePressed(true)}
        onMouseUp={() => setClosePressed(false)}
        onMouseLeave={() => setClosePressed(false)}
        onTouchStart={() => setClosePressed(true)}
        onTouchEnd={(e) => { e.preventDefault(); setClosePressed(false); onClose(); }}
        onTouchCancel={() => setClosePressed(false)}
      >
        <img
          src={closePressed ? assets.closeHighlight : assets.close}
          draggable={false}
          style={{ width: '590px', height: '50px', objectFit: 'contain', display: 'block', pointerEvents: 'none', filter: closePressed ? 'none' : 'drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.4))' }}
        />
      </div>
    </div>
  );
};
