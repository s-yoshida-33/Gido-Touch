import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

const INTERACTIVE_SELECTOR =
  'button, a, input, select, textarea, label, ' +
  '[role="button"], [role="link"], [role="menuitem"], [role="option"], [role="tab"], ' +
  '[tabindex]:not([tabindex="-1"])';

const TAP_DISTANCE_THRESHOLD = 10; // px
const TAP_DURATION_MAX = 500;       // ms

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

    // isInteractive is evaluated at touchstart while the element is still in the DOM.
    // Evaluating at touchend is too late: modals that close on touchend remove their
    // elements before the document-level listener fires, causing getComputedStyle to
    // return default values on the detached node.
    let isInteractive = false;
    let startX = 0;
    let startY = 0;
    let startTime = 0;

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
      if (e.touches.length !== 1) {
        isInteractive = false;
        return;
      }
      isInteractive = isTouchOnInteractiveElement(e.target);
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isInteractive || e.changedTouches.length === 0) return;

      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - startTime;

      if (distance <= TAP_DISTANCE_THRESHOLD && duration <= TAP_DURATION_MAX) {
        playSound();
      }

      isInteractive = false;
    };

    const onTouchCancel = () => {
      isInteractive = false;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [enabled]);
}
