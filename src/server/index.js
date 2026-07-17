// Dev-Start: node src/server/index.js  (oder via "npm run dev:api")
// Alle Routen liegen in apiRoutes.js und gelten identisch fuer den Prod-Server.
import express from 'express'
import cors from 'cors'
import { registerApiRoutes, DEFAULT_MODEL } from './apiRoutes.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: ALLOW_ORIGIN }))

const MODEL = process.env.SDH_MODEL || DEFAULT_MODEL
registerApiRoutes(app, { model: MODEL })

const PORT = Number(process.env.PORT) || 5175
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI server listening on http://localhost:${PORT} (model: ${MODEL})`)
})
