// Start (Prod):  PORT=8080 node src/server/prod.js
// Model override: SDH_MODEL=claude-haiku-4-5-20251001 node src/server/prod.js

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()

const PORT = Number(process.env.PORT) || 8080
const MODEL = process.env.SDH_MODEL || 'claude-sonnet-4-6'

app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))

// ---------- SSE Helpers ----------
function setSSEHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()
}

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// ---------- Review Tool Schema (Anthropic format) ----------
const REVIEW_TOOL = {
  name: 'return_draft_review',
  description: 'Final draft review with rankings, one-liners, global summary, deep dive, steals/reaches, week-1 start/sit.',
  input_schema: {
    type: 'object',
    properties: {
      overallRankings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            displayName: { type: 'string' },
            rank: { type: 'integer' },
            score: { type: 'number' },
          },
          required: ['teamId', 'displayName', 'rank', 'score'],
        },
      },
      teamOneLiners: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            displayName: { type: 'string' },
            comment: { type: 'string' },
          },
          required: ['teamId', 'displayName', 'comment'],
        },
      },
      overallSummary: { type: 'string' },
      myTeamDeepDive: {
        type: 'object',
        properties: {
          grade: { type: 'string' },
          strengths: { type: 'array', items: { type: 'string' } },
          weaknesses: { type: 'array', items: { type: 'string' } },
          risks: { type: 'array', items: { type: 'string' } },
          recommendedMoves: { type: 'array', items: { type: 'string' } },
          longText: { type: 'string' },
        },
        required: ['grade', 'strengths', 'weaknesses', 'risks', 'recommendedMoves', 'longText'],
      },
      steals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pick_no: { type: 'integer' },
            player: { type: 'string' },
            teamId: { type: 'string' },
            displayName: { type: 'string' },
            rationale: { type: 'string' },
          },
          required: ['pick_no', 'player', 'teamId', 'displayName', 'rationale'],
        },
      },
      reaches: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            pick_no: { type: 'integer' },
            player: { type: 'string' },
            teamId: { type: 'string' },
            displayName: { type: 'string' },
            rationale: { type: 'string' },
          },
          required: ['pick_no', 'player', 'teamId', 'displayName', 'rationale'],
        },
      },
      myWeek1StartSit: {
        type: 'object',
        properties: {
          starters: { type: 'array', items: { type: 'string' } },
          sits: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['starters', 'sits', 'notes'],
      },
    },
    required: ['overallRankings', 'teamOneLiners', 'overallSummary', 'myTeamDeepDive', 'steals', 'reaches', 'myWeek1StartSit'],
  },
}

// ---------- Health ----------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'production', node: process.version, model: MODEL })
})

// ---------- Key-Validierung ----------
app.post('/api/validate-key', async (req, res) => {
  try {
    const userKey = req.header('x-anthropic-key')
    if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-Anthropic-Key header' })

    const client = new Anthropic({ apiKey: userKey })
    const r = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    })
    res.json({ ok: true, model: r.model, usage: r.usage })
  } catch (err) {
    res.status(err?.status || 500).json({ ok: false, message: err?.message || 'Key validation failed' })
  }
})

// ---------- AI Advice (SSE streaming) ----------
app.post('/api/ai-advice', async (req, res) => {
  const userKey = req.header('x-anthropic-key')
  if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-Anthropic-Key header' })

  const payload = req.body
  if (!payload?.messages) {
    return res.status(400).json({ ok: false, error: 'Invalid payload: expected { messages, ... }' })
  }

  setSSEHeaders(res)

  try {
    const client = new Anthropic({ apiKey: userKey })
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: payload.max_tokens || 1024,
      temperature: payload.temperature ?? 0.2,
      ...(payload.system ? { system: payload.system } : {}),
      messages: payload.messages,
      tools: Array.isArray(payload.tools) ? payload.tools : [],
      tool_choice: payload.tool_choice || { type: 'auto' },
    })

    stream.on('text', (text) => sendSSE(res, 'text', { text }))

    const finalMessage = await stream.finalMessage()
    const toolBlock = (finalMessage.content || []).find(
      b => b.type === 'tool_use' && b.name === 'return_draft_advice'
    )
    const parsed = toolBlock?.input || null

    sendSSE(res, 'result', {
      ok: true,
      parsed,
      model: finalMessage.model,
      usage: finalMessage.usage,
    })
  } catch (err) {
    sendSSE(res, 'error', { ok: false, message: err?.message || 'AI request failed' })
  } finally {
    res.end()
  }
})

// ---------- Final Draft Review (SSE streaming) ----------
app.post('/api/ai-draft-review', async (req, res) => {
  const userKey = req.header('x-anthropic-key')
  if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-Anthropic-Key header' })

  const payload = req.body
  if (!payload?.messages) {
    return res.status(400).json({ ok: false, error: 'Invalid payload: expected { messages, ... }' })
  }

  setSSEHeaders(res)

  try {
    const client = new Anthropic({ apiKey: userKey })
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: payload.max_tokens || 4096,
      temperature: payload.temperature ?? 0.3,
      ...(payload.system ? { system: payload.system } : {}),
      messages: payload.messages,
      tools: [REVIEW_TOOL],
      tool_choice: { type: 'tool', name: 'return_draft_review' },
    })

    const finalMessage = await stream.finalMessage()
    const toolBlock = (finalMessage.content || []).find(
      b => b.type === 'tool_use' && b.name === 'return_draft_review'
    )
    const parsed = toolBlock?.input || null

    if (!parsed) {
      sendSSE(res, 'error', { ok: false, message: 'Model did not return structured review JSON' })
    } else {
      parsed.meta = parsed.meta || {}
      parsed.meta.model = parsed.meta.model || finalMessage.model
      sendSSE(res, 'result', { ok: true, parsed })
    }
  } catch (err) {
    sendSSE(res, 'error', { ok: false, message: err?.message || 'Review request failed' })
  } finally {
    res.end()
  }
})

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
