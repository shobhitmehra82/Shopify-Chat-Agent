import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The chat widget dev server proxies /api to the Node agent server (src/server).
// Nothing is wired up yet — the proxy target is here so step 2 needs no config change.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
