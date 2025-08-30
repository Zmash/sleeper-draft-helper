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

// ---- Review: Tool-Schema & Parser ----
const REVIEW_TOOL = {
  type: 'function',
  function: {
    name: 'return_draft_review',
    description: 'Final draft review with rankings, one-liners, global summary, deep dive, steals/reaches, week-1 start/sit.',
    parameters: {
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
              score: { type: 'number' }
            },
            required: ['teamId','displayName','rank','score']
          }
        },
        teamOneLiners: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              teamId: { type: 'string' },
              displayName: { type: 'string' },
              comment: { type: 'string' }
            },
            required: ['teamId','displayName','comment']
          }
        },
        overallSummary: { type: 'string' },
        myTeamDeepDive: {
          type: 'object',
          properties: {
            grade: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses:{ type: 'array', items: { type: 'string' } },
            risks:      { type: 'array', items: { type: 'string' } },
            recommendedMoves: { type: 'array', items: { type: 'string' } },
            longText:   { type: 'string' }
          },
          required: ['grade','strengths','weaknesses','risks','recommendedMoves','longText']
        },
        steals: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pick_no: { type: 'integer' },
              player:  { type: 'string' },
              teamId:  { type: 'string' },
              displayName: { type: 'string' },
              rationale: { type: 'string' }
            },
            required: ['pick_no','player','teamId','displayName','rationale']
          }
        },
        reaches: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pick_no: { type: 'integer' },
              player:  { type: 'string' },
              teamId:  { type: 'string' },
              displayName: { type: 'string' },
              rationale: { type: 'string' }
            },
            required: ['pick_no','player','teamId','displayName','rationale']
          }
        },
        myWeek1StartSit: {
          type: 'object',
          properties: {
            starters: { type: 'array', items: { type: 'string' } },
            sits:     { type: 'array', items: { type: 'string' } },
            notes:    { type: 'string' }
          },
          required: ['starters','sits','notes']
        },
        meta: {
          type: 'object',
          properties: { model: { type: 'string' } }
        }
      },
      required: ['overallRankings','teamOneLiners','overallSummary','myTeamDeepDive','steals','reaches','myWeek1StartSit']
    }
  }
}

function parseReviewFromChoice(choice) {
  const msg = choice?.message
  const tc = msg?.tool_calls || null
  const content = msg?.content || ''
  if (Array.isArray(tc) && tc.length > 0) {
    const call = tc.find(c => c?.function?.name === 'return_draft_review') || tc[0]
    if (call?.function?.arguments) {
      try {
        const parsed = JSON.parse(call.function.arguments)
        return { parsed, raw: '', tool_calls: tc }
      } catch { /* fallthrough */ }
    }
  }
  try {
    const parsed = JSON.parse(content)
    return { parsed, raw: content, tool_calls: tc }
  } catch {
    return { parsed: null, raw: content, tool_calls: tc }
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

    // Debug-Info (optional)
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
    })
  } catch (err) {
    res.status(err?.status || 500).json({ ok: false, message: err?.message || 'AI request failed' })
  }
})

/**
 * ---- API: Final Draft Review ----
 * Identisch zu dev: wir injizieren Tool-Schema + tool_choice.
 */
app.post('/api/ai-draft-review', async (req, res) => {
  try {
    const userKey = req.header('x-openai-key')
    if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-OpenAI-Key header' })

    const payload = req.body
    if (!payload || !payload.model || !payload.messages) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: expected { model, messages, ... }' })
    }

    // Debug-Zusammenfassung
    let debugReq = null
    if (DEBUG) {
      const payloadSize = Buffer.byteLength(JSON.stringify(payload), 'utf8')
      const userMsg = payload.messages.find(m => m.role === 'user')?.content || ''
      let ctx = null
      try {
        const m = userMsg.match(/<CONTEXT_JSON>\s*([\s\S]*?)\s*<\/CONTEXT_JSON>/)
        if (m) ctx = JSON.parse(m[1])
      } catch {}
      debugReq = {
        meta: {
          model: payload.model,
          temperature: payload.temperature,
          payload_size_bytes: payloadSize,
        },
        counts: ctx ? {
          picks: Array.isArray(ctx?.picks) ? ctx.picks.length : 0,
          rosters: ctx?.rosters ? Object.keys(ctx.rosters).length : 0,
          roster_positions: Array.isArray(ctx?.league?.roster_positions) ? ctx.league.roster_positions.length : 0,
        } : null
      }
    }

    // Tools injizieren
    const finalPayload = {
      ...payload,
      tools: Array.isArray(payload.tools) ? [...payload.tools, REVIEW_TOOL] : [REVIEW_TOOL],
      tool_choice: { type: 'function', function: { name: 'return_draft_review' } },
    }

    const client = new OpenAI({ apiKey: userKey })
    for (const k of ['instructions','strategies','format','input','input_text','metadata','response','reasoning','max_output_tokens']) {
      if (k in finalPayload) delete finalPayload[k]
    }
    const completion = await client.chat.completions.create(finalPayload)

    const choice = completion.choices?.[0] || null
    const { parsed, raw, tool_calls } = parseReviewFromChoice(choice)

    if (!parsed) {
      return res.status(502).json({ ok: false, error: 'Model did not return structured review JSON' })
    }

    parsed.meta = parsed.meta || {}
    parsed.meta.model = parsed.meta.model || completion.model

    res.json({
      ok: true,
      parsed,
      raw,
      tool_calls,
      ...(DEBUG ? { debug: { request: debugReq, openai: {
        id: completion.id, model: completion.model, usage: completion.usage,
        tool_calls_count: Array.isArray(choice?.message?.tool_calls) ? choice.message.tool_calls.length : 0,
        content_len: (choice?.message?.content || '').length,
      } } } : {})
    })
  } catch (err) {
    res.status(err?.status || 500).json({ ok: false, message: err?.message || 'AI request failed' })
  }
})

/**
 * ---- Static Frontend ausliefern ----
 */
const distDir = path.resolve(__dirname, '../dist')
app.use(express.static(distDir))

// SPA-Fallback (alles außer /api -> index.html)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Prod server running on http://localhost:${PORT}`)
  if (DEBUG) console.log('SDH_DEBUG=1 -> responses include debug metadata')
})
