import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const backend = 'http://localhost:3000'

export default defineConfig({
  root: 'client',
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
    },
  },
  server: {
    host: true,
    // Tunnels (npm run tunnel) hand out a fresh random hostname each run;
    // allow the ngrok/cloudflared domains so Vite doesn't block them.
    allowedHosts: ['.ngrok-free.app', '.trycloudflare.com'],
    fs: { allow: ['..'] },
    proxy: {
      '/socket.io': { target: backend, ws: true },
      '/api': backend,
      '/uploads': backend,
      '/avatars': backend,
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
})
