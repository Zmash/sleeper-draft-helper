// server/index.js
// Dev-Start: node server/index.js  (oder via "npm run dev" mit concurrently)
//
// Endpoints:
//   GET  /api/health
//   POST /api/validate-key
//   POST /api/ai-advice   -> sendet zusätzlich "debug" zurück (Request-Zusammenfassung + OpenAI-Infos)

import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: ALLOW_ORIGIN }))

// ---------- kleine Utils ----------
function serializeError(err) {
  const status = err?.status || err?.response?.status || 500
  const body = {
    ok: false,
    status,
    name: err?.name || 'Error',
    message: err?.message || 'Unknown error',
  }
  if (process.env.NODE_ENV !== 'production') {
    if (err?.error) body.error = err.error
    if (err?.response?.data) body.responseData = err.response.data
    if (err?.stack) body.stack = err.stack
  }
  return { status, body }
}

function extractContextFromPayload(payload) {
  try {
    const userMsg = payload?.messages?.find(m => m.role === 'user')?.content || ''
    const m = userMsg.match(/<CONTEXT_JSON>\s*([\s\S]*?)\s*<\/CONTEXT_JSON>/)
    if (!m) return { ctx: null, reason: 'no-tag' }
    const ctx = JSON.parse(m[1])
    return { ctx, reason: 'ok' }
  } catch (e) {
    return { ctx: null, reason: 'parse-error', error: e?.message }
  }
}

function summarizeContext(ctx) {
  if (!ctx) return { counts: null, sample: null }
  const counts = {
    overall_top: Array.isArray(ctx?.board?.overall_top) ? ctx.board.overall_top.length : 0,
    by_pos_keys: ctx?.board?.by_position ? Object.keys(ctx.board.by_position).length : 0,
    my_picks: Array.isArray(ctx?.my_team?.picks) ? ctx.my_team.picks.length : 0,
    roster_pos_len: Array.isArray(ctx?.league?.roster_positions) ? ctx.league.roster_positions.length : 0,
  }
  const sample = {
    overall_top_first5: (ctx?.board?.overall_top || []).slice(0, 5).map(p => ({
      nname: p?.nname, pos: p?.pos, rk: p?.rk, tier: p?.tier
    })),
    by_pos_keys: ctx?.board?.by_position ? Object.keys(ctx.board.by_position) : [],
    my_picks_first3: (ctx?.my_team?.picks || []).slice(0, 3).map(p => ({
      name: p?.name, pos: p?.pos, pick_no: p?.pick_no
    })),
    roster_positions_first15: (ctx?.league?.roster_positions || []).slice(0, 15),
  }
  return { counts, sample }
}

function pickAdviceFromChoice(choice) {
  const msg = choice?.message
  // 1) Function calling
  if (Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0) {
    for (const call of msg.tool_calls) {
      if (call?.function?.name === 'return_draft_advice') {
        try {
          return {
            parsed: JSON.parse(call.function.arguments || '{}'),
            raw: '',
            tool_calls: msg.tool_calls,
          }
        } catch (_) {
          // continue
        }
      }
    }
  }
  // 2) Fallback: JSON im content
  const content = msg?.content || ''
  try {
    return { parsed: JSON.parse(content), raw: content, tool_calls: msg?.tool_calls || null }
  } catch {
    return { parsed: null, raw: content, tool_calls: msg?.tool_calls || null }
  }
}

// ---------- Health ----------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    node: process.version,
    allowOrigin: ALLOW_ORIGIN,
  })
})

// ---------- Key-Validierung ----------
app.post('/api/validate-key', async (req, res) => {
  try {
    const userKey = req.header('x-openai-key')
    if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-OpenAI-Key header' })

    const client = new OpenAI({ apiKey: userKey })
    const r = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1,
      temperature: 0,
      messages: [{ role: 'user', content: 'ping' }],
    })

    res.json({ ok: true, model: r.model, usage: r.usage })
  } catch (err) {
    const { status, body } = serializeError(err)
    console.error('[validate-key] error:', err)
    res.status(status).json(body)
  }
})

// ---------- Haupt-Endpoint: AI Advice ----------
app.post('/api/ai-advice', async (req, res) => {
  try {
    const userKey = req.header('x-openai-key')
    if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-OpenAI-Key header' })

    const payload = req.body
    if (!payload || !payload.model || !payload.messages) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: expected { model, messages, ... }' })
    }

    const client = new OpenAI({ apiKey: userKey })
    const completion = await client.chat.completions.create(payload)

    const choice = completion.choices?.[0] || null
    const message = choice?.message || null
    const tool_calls = message?.tool_calls || null
    const content = message?.content || '' // leer, wenn function calling benutzt wurde

    // → Hier die eigentliche Magie: Function-Args auslesen
    let parsed = null
    if (Array.isArray(tool_calls) && tool_calls.length > 0) {
      const call = tool_calls.find(c => c?.function?.name === 'return_draft_advice') || tool_calls[0]
      if (call?.function?.arguments) {
        try { parsed = JSON.parse(call.function.arguments) } catch { parsed = null }
      }
    }
    if (!parsed && content) {
      try { parsed = JSON.parse(content) } catch { /* ignore */ }
    }

    // Optional: knapper Echo-Debug zurückgeben
    const openaiMeta = {
      id: completion.id,
      model: completion.model,
      usage: completion.usage,
      tool_calls_count: Array.isArray(tool_calls) ? tool_calls.length : 0,
      content_len: content.length,
    }

    res.json({
      ok: true,
      id: completion.id,
      model: completion.model,
      usage: completion.usage,
      raw: content,
      parsed,
      tool_calls,          // <-- wichtig!
      debug: { openai: openaiMeta }
    })
  } catch (err) {
    res.status(err?.status || 500).json({ ok: false, message: err?.message || 'AI request failed' })
  }
})



const PORT = Number(process.env.PORT) || 5174
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI server listening on http://localhost:${PORT}`)
})
