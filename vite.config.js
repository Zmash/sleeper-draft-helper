import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Default bleibt 5173; PORT erlaubt parallele Dev-Server (z. B. Worktrees).
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5175', changeOrigin: true }
    }
  }
})
