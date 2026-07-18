// Start (Prod):  PORT=8080 node src/server/prod.js
// Model override: SDH_MODEL=… node src/server/prod.js
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerApiRoutes, DEFAULT_MODEL } from './apiRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()

const PORT = Number(process.env.PORT) || 8080
const MODEL = process.env.SDH_MODEL || DEFAULT_MODEL

app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))

registerApiRoutes(app, { model: MODEL })

// ---------- Static Frontend ----------
const distDir = path.resolve(__dirname, '../dist')
app.use(express.static(distDir))

// SPA-Fallback (alles außer /api -> index.html)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Prod server running on http://localhost:${PORT} (model: ${MODEL})`)
})
