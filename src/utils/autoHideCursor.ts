// src/utils/autoHideCursor.ts
// マウスカーソルの自動非表示
// 遠隔操作などでマウスを動かすとカーソルが表示されたまま残るため、
// マウス移動中のみ表示し、一定時間動きがなければ非表示にする。
// タッチ操作ではすぐに非表示にする。クリック等のマウス操作自体はそのまま有効。

import { invoke } from '@tauri-apps/api/core';

const CURSOR_HIDE_DELAY_MS = 3000;
// refresh_cursor が発生させる疑似マウス移動を、ユーザー操作として扱わない期間
const REFRESH_SUPPRESS_MS = 500;
const HIDDEN_CLASS = 'cursor-auto-hidden';

let initialized = false;

export function setupAutoHideCursor(): void {
  if (initialized) return;
  initialized = true;

  const style = document.createElement('style');
  style.textContent = `html.${HIDDEN_CLASS}, html.${HIDDEN_CLASS} * { cursor: none !important; }`;
  document.head.appendChild(style);

  const root = document.documentElement;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressUntil = 0;

  const hide = () => {
    clearTimeout(hideTimer);
    root.classList.add(HIDDEN_CLASS);
  };

  // WebView はマウスが動くまでカーソル形状を更新しないため、
  // 放置で非表示にする際は Rust 側でカーソルを1px動かして反映させる
  const hideAndRefresh = () => {
    hide();
    suppressUntil = Date.now() + REFRESH_SUPPRESS_MS;
    invoke('refresh_cursor').catch(() => {});
  };

  const showTemporarily = () => {
    root.classList.remove(HIDDEN_CLASS);
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideAndRefresh, CURSOR_HIDE_DELAY_MS);
  };

  const onPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') hide();
    else if (e.type === 'pointerdown' || Date.now() >= suppressUntil) showTemporarily();
  };

  window.addEventListener('pointermove', onPointer, { capture: true, passive: true });
  window.addEventListener('pointerdown', onPointer, { capture: true, passive: true });

  hideAndRefresh();
}
