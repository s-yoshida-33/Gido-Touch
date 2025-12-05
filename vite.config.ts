import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: './', 
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api":  { target: "http://localhost:8080", changeOrigin: true },
      "/file": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React関連を別チャンクに
          'react-vendor': ['react', 'react-dom'],
          // アニメーションライブラリを別チャンクに
          'framer-motion': ['framer-motion'],
          // ズーム・パンライブラリを別チャンクに
          'zoom-pan-pinch': ['react-zoom-pan-pinch'],
        },
      },
    },
    // チャンクサイズの警告制限を調整（オプション）
    chunkSizeWarningLimit: 1000,
  },
});
