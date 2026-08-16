import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy the API and WebSocket to the backend so the client can use
// same-origin relative URLs (which also works behind the Stage 9 load balancer).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:4000', changeOrigin: true },
      '/health': { target: 'http://localhost:4000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:4000', ws: true },
    },
  },
});
