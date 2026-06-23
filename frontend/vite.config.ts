import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy /api to the local backend so the frontend can use relative URLs
// (the same relative URLs that nginx serves in production). VITE_BACKEND_ORIGIN
// lets you point the dev proxy elsewhere if needed.
const backendOrigin = process.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendOrigin,
        changeOrigin: true,
      },
    },
  },
});
