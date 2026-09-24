import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Backend port for the dev proxy; override with BACKEND_PORT when :3000 is taken.
const backend = `http://localhost:${process.env.BACKEND_PORT ?? 3000}`

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
  // MapLibre's worker is an ES module (it imports a shared chunk).
  worker: { format: 'es' },
  build: { outDir: 'dist', emptyOutDir: true },
})
