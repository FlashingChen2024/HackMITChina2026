import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 开发环境优先代理到云端 API，避免浏览器 CORS 导致的 Failed to fetch
        target: process.env.VITE_PROXY_TARGET || 'https://api.mit.chenyuxia.com',
        changeOrigin: true,
        secure: true
      },
      '/health': {
        target: process.env.VITE_PROXY_TARGET || 'https://api.mit.chenyuxia.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
