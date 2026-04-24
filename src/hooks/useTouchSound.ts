import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, label, ' +
  '[role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], ' +
  '[tabindex]:not([tabindex="-1"])';

const MOVE_THRESHOLD = 10; // px — movement beyond this cancels the pending sound
const PLAY_DELAY_MS = 60;  // ms — wait to detect scroll before playing

function isTouchOnInteractiveElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;

  if (target.closest(INTERACTIVE_SELECTOR)) return true;

  let el: Element | null = target;
  while (el && el.tagName !== 'BODY') {
    if (window.getComputedStyle(el).cursor === 'pointer') return true;
    el = el.parentElement;
  }

  return false;
}

export function useTouchSound(
  enabled: boolean,
  soundFile: string = 'touch-sound-1.wav',
  volume: number = 100,
) {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        if (!ctxRef.current || ctxRef.current.state === 'closed') {
          ctxRef.current = new AudioContext();
        }
        const ctx = ctxRef.current;

        const bytes = await invoke<number[]>('read_sound_file', { filename: soundFile });
        const arrayBuffer = new Uint8Array(bytes).buffer;
        const decoded = await ctx.decodeAudioData(arrayBuffer);

        if (!cancelled) {
          bufferRef.current = decoded;
        }
      } catch {
        bufferRef.current = null;
      }
    };

    load();
    return () => { cancelled = true; };
  }, [soundFile]);

  useEffect(() => {
    if (!enabled) return;

    let startX = 0;
    let startY = 0;
    let isSingleTouch = false;
    let pendingPlay: ReturnType<typeof setTimeout> | null = null;

    const clearPending = () => {
      if (pendingPlay !== null) {
        clearTimeout(pendingPlay);
        pendingPlay = null;
      }
    };

    const playSound = () => {
      const ctx = ctxRef.current;
      const buffer = bufferRef.current;
      if (!ctx || !buffer) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const gainNode = ctx.createGain();
      gainNode.gain.value = Math.max(0, Math.min(1, volumeRef.current / 100));

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(gainNode);
      gainNode.connect(ctx.destination);
      src.start();
    };

    const onTouchStart = (e: TouchEvent) => {
      clearPending();

      // Multi-touch (pinch/zoom) — never play
      if (e.touches.length !== 1) {
        isSingleTouch = false;
        return;
      }

      if (!isTouchOnInteractiveElement(e.target)) return;

      isSingleTouch = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;

      pendingPlay = setTimeout(() => {
        pendingPlay = null;
        playSound();
      }, PLAY_DELAY_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isSingleTouch || pendingPlay === null) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
        clearPending();
      }
    };

    const onTouchCancel = () => {
      clearPending();
      isSingleTouch = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      clearPending();
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled]);
}
