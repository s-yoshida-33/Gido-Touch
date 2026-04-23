import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useTouchSound(enabled: boolean, soundFile: string = 'touch-sound-1.wav') {
  const ctxRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  // Reload AudioBuffer whenever the selected sound file changes
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
        // File missing or decode failed — touch sound disabled silently
        bufferRef.current = null;
      }
    };

    load();
    return () => { cancelled = true; };
  }, [soundFile]);

  useEffect(() => {
    if (!enabled) return;

    const play = () => {
      const ctx = ctxRef.current;
      const buffer = bufferRef.current;
      if (!ctx || !buffer) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start();
    };

    document.addEventListener('touchstart', play, { passive: true });
    return () => {
      document.removeEventListener('touchstart', play);
    };
  }, [enabled]);
}
