// server/prod.js
// Start (Prod):  PORT=8080 node server/prod.js
// Optional Debug: SDH_DEBUG=1 PORT=8080 node server/prod.js

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import OpenAI from 'openai'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()

// ---- Config / Flags ----
const PORT = Number(process.env.PORT) || 8080
const DEBUG = process.env.SDH_DEBUG === '1' // gibt extra Debug-Infos in der Response aus

app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))

// ---- API: Health ----
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'production', node: process.version })
})

// ---- API: Key-Validierung ----
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
    res.status(err?.status || 500).json({ ok: false, message: err?.message || 'AI request failed' })
  }
})

// ---- Helper: parse advice from choice ----
function parseAdviceFromChoice(choice) {
  const msg = choice?.message
  const toolCalls = msg?.tool_calls || null
  const content = msg?.content || ''

  // 1) Function Calling bevorzugen
  if (Array.isArray(toolCalls) && toolCalls.length > 0) {
    const call = toolCalls.find(c => c?.function?.name === 'return_draft_advice') || toolCalls[0]
    if (call?.function?.arguments) {
      try {
        const parsed = JSON.parse(call.function.arguments)
        return { parsed, raw: '', tool_calls: toolCalls }
      } catch { /* fallthrough */ }
    }
  }

  // 2) Fallback: JSON im message.content
  try {
    const parsed = JSON.parse(content)
    return { parsed, raw: content, tool_calls: toolCalls }
  } catch {
    return { parsed: null, raw: content, tool_calls: toolCalls }
  }
}

// ---- API: AI Advice ----
app.post('/api/ai-advice', async (req, res) => {
  try {
    const userKey = req.header('x-openai-key')
    if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-OpenAI-Key header' })

    const payload = req.body
    if (!payload || !payload.model || !payload.messages) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: expected { model, messages, ... }' })
    }

    // (Optional) kleine Request-Zusammenfassung für Debug
    let debugReq = null
    if (DEBUG) {
      const payloadSize = Buffer.byteLength(JSON.stringify(payload), 'utf8')
      const userMsg = payload.messages.find(m => m.role === 'user')?.content || ''
      let ctx = null
      try {
        const m = userMsg.match(/<CONTEXT_JSON>\s*([\s\S]*?)\s*<\/CONTEXT_JSON>/)
        if (m) ctx = JSON.parse(m[1])
      } catch {}
      const counts = ctx ? {
        overall_top: Array.isArray(ctx?.board?.overall_top) ? ctx.board.overall_top.length : 0,
        by_pos_keys: ctx?.board?.by_position ? Object.keys(ctx.board.by_position).length : 0,
        my_picks: Array.isArray(ctx?.my_team?.picks) ? ctx.my_team.picks.length : 0,
        roster_pos_len: Array.isArray(ctx?.league?.roster_positions) ? ctx.league.roster_positions.length : 0,
      } : null
      debugReq = {
        meta: {
          model: payload.model,
          temperature: payload.temperature,
          max_tokens: payload.max_tokens,
          messages: Array.isArray(payload.messages) ? payload.messages.length : 0,
          has_tools: Array.isArray(payload.tools) && payload.tools.length > 0,
          tool_choice: payload?.tool_choice?.type || payload?.tool_choice || null,
          payload_size_bytes: payloadSize,
        },
        counts,
      }
    }

    const client = new OpenAI({ apiKey: userKey })
    // sanitize unexpected top-level keys (Chat Completions doesn’t accept these)
    for (const k of ['instructions','strategies','format','input','input_text','metadata','response','reasoning','max_output_tokens']) {
      if (k in payload) delete payload[k]
    }
    const completion = await client.chat.completions.create(payload)

    const choice = completion.choices?.[0] || null
    const { parsed, raw, tool_calls } = parseAdviceFromChoice(choice)

    const openaiMeta = {
      id: completion.id,
      model: completion.model,
      usage: completion.usage,
      tool_calls_count: Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls.length : 0,
      content_len: (choice?.message?.content || '').length,
    }

    res.json({
      ok: true,
      parsed,
      raw,
      tool_calls,
      ...(DEBUG ? { debug: { request: debugReq, openai: openaiMeta } } : {}),
      // (ohne DEBUG keine großen Debugfelder in der Response)
    })
  } catch (err) {
    res.status(err?.status || 500).json({ ok: false, message: err?.message || 'AI request failed' })
  }
})

/**
 * ---- Static Frontend ausliefern ----
 * In Prod kommen Frontend und API vom gleichen Origin, daher kein CORS nötig.
 */
const distDir = path.resolve(__dirname, '../dist')
app.use(express.static(distDir))

// SPA-Fallback (alles außer /api -> index.html)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Prod server running on http://localhost:${PORT}`)
  if (DEBUG) console.log('SDH_DEBUG=1 -> responses include debug metadata')
})
