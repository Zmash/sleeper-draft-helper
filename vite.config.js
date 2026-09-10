import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: 'auto',
      manifest: {
        name: 'Sleeper Draft Helper',
        short_name: 'SDH',
        start_url: '/',
        display: 'standalone',
        background_color: '#071026',
        theme_color: '#071026',
        icons: [
          { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    // Default bleibt 5173; PORT erlaubt parallele Dev-Server (z. B. Worktrees).
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5175', changeOrigin: true }
    }
  }
})
