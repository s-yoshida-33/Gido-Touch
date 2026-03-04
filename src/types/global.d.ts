// src/types/global.d.ts
// Tauri version - Electron APIs removed. All IPC via @tauri-apps/api/core invoke().
export {};

export type LocalMediaTextSettings = Record<string, {  
  line1: string; 
  line2: string;
  line1En?: string;
  line2En?: string;
}>;

export type SubFloorSettings = Record<string, string[]>;

declare global {
  interface Window {
    __BWP_BASE_URL__?: string;
  }
}
