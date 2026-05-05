// Start (Prod):  PORT=8080 node src/server/prod.js
// Model override: SDH_MODEL=claude-haiku-4-5-20251001 node src/server/prod.js

import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import Anthropic from '@anthropic-ai/sdk'
import { load as cheerioLoad } from 'cheerio'

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

// ---------- Rankings: FantasyCalc ----------
app.get('/api/rankings/fantasycalc', async (req, res) => {
  const numQbs = parseInt(req.query.numQbs) === 2 ? 2 : 1
  const numTeams = parseInt(req.query.numTeams) || 12
  const ppr = req.query.ppr !== undefined ? Number(req.query.ppr) : 1
  const url = `https://api.fantasycalc.com/values/current?isDynasty=true&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}&includeAdp=false`
  try {
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(502).json({ ok: false, error: `FantasyCalc returned ${upstream.status}` })
    const json = await upstream.json()
    const players = json.map((fc, idx) => ({
      id: idx + 1,
      rk: String(fc.overallRank ?? idx + 1),
      ecr: fc.overallRank ?? idx + 1,
      tier: '',
      name: fc.player?.name ?? '',
      team: fc.player?.maybeTeam ?? fc.player?.team ?? '',
      pos: fc.player?.position ?? '',
      posRank: (fc.player?.position ?? '') + (fc.positionRank ?? ''),
      bye: '',
      sos: '',
      ecrVsAdp: '',
      adp: null,
      dynasty_value: fc.value ?? null,
      redraft_value: fc.redraftValue ?? null,
      age: fc.player?.age ?? null,
      years_exp: null,
    }))
    res.json({ ok: true, players })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Failed to fetch FantasyCalc rankings' })
  }
})

// ---------- Rankings: KTC Dynasty (all players) ----------
app.get('/api/rankings/ktc-dynasty', async (req, res) => {
  const superflex = req.query.superflex === 'true' || req.query.superflex === '1'
  const KTC_URL = superflex
    ? 'https://keeptradecut.com/dynasty-rankings?format=1'
    : 'https://keeptradecut.com/dynasty-rankings'
  const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  try {
    const upstream = await fetch(KTC_URL, { headers: HEADERS })
    if (!upstream.ok) return res.status(502).json({ ok: false, error: `KTC returned ${upstream.status}` })
    const html = await upstream.text()
    const $ = cheerioLoad(html)
    const players = []
    $('.single-ranking').each((idx, el) => {
      const rank = parseInt($('.rank-number p', el).text().trim()) || (idx + 1)
      const nameEl = $('.player-name a', el)
      const name = nameEl.text().trim()
      if (!name) return
      const team = $('.player-name .player-team', el).text().trim() || ''
      const posRankRaw = $('.position-team .position', el).first().text().trim()
      const pos = posRankRaw.replace(/\d+/g, '') || ''
      const ageRaw = $('.position-team .position.hidden-xs', el).text().replace('y.o.', '').trim()
      const age = parseFloat(ageRaw) || null
      const tierRaw = $('.player-info .position', el).text().trim()
      const tier = tierRaw || ''
      const valueRaw = $('.value p', el).text().trim()
      const value = parseInt(valueRaw) || null
      players.push({
        id: idx + 1,
        rk: String(rank),
        ecr: rank,
        tier,
        name,
        team,
        pos,
        posRank: posRankRaw,
        bye: '',
        sos: '',
        ecrVsAdp: '',
        adp: null,
        dynasty_value: value,
        redraft_value: null,
        age,
        years_exp: null,
      })
    })
    if (!players.length) return res.status(502).json({ ok: false, error: 'Keine Spieler gefunden – KTC-Struktur möglicherweise geändert' })
    res.json({ ok: true, players })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'KTC-Scraping fehlgeschlagen' })
  }
})

// ---------- Rankings: KTC Rookies ----------
app.get('/api/rankings/ktc-rookies', async (_req, res) => {
  const KTC_URL = 'https://keeptradecut.com/dynasty-rankings/rookie-rankings'
  const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  try {
    const upstream = await fetch(KTC_URL, { headers: HEADERS })
    if (!upstream.ok) return res.status(502).json({ ok: false, error: `KTC returned ${upstream.status}` })
    const html = await upstream.text()
    const $ = cheerioLoad(html)
    const players = []
    $('.single-ranking').each((idx, el) => {
      const rank = parseInt($('.rank-number p', el).text().trim()) || (idx + 1)
      const nameEl = $('.player-name a', el)
      const name = nameEl.text().trim()
      if (!name) return
      const team = $('.player-name .player-team', el).text().trim() || ''
      const posRankRaw = $('.position-team .position', el).first().text().trim()
      const pos = posRankRaw.replace(/\d+/g, '') || ''
      const ageRaw = $('.position-team .position.hidden-xs', el).text().replace('y.o.', '').trim()
      const age = parseFloat(ageRaw) || null
      const tierRaw = $('.player-info .position', el).text().trim()
      const tier = tierRaw || ''
      const valueRaw = $('.value p', el).text().trim()
      const value = parseInt(valueRaw) || null
      players.push({
        id: idx + 1,
        rk: String(rank),
        ecr: rank,
        tier,
        name,
        team,
        pos,
        posRank: posRankRaw,
        bye: '',
        sos: '',
        ecrVsAdp: '',
        adp: null,
        dynasty_value: value,
        redraft_value: null,
        age,
        years_exp: null,
      })
    })
    if (!players.length) return res.status(502).json({ ok: false, error: 'Keine Spieler gefunden – KTC-Struktur möglicherweise geändert' })
    res.json({ ok: true, players })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'KTC-Scraping fehlgeschlagen' })
  }
})

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
// ---------- Trade Analysis (SSE streaming) ----------
app.post('/api/ai-trade', async (req, res) => {
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
      max_tokens: payload.max_tokens || 1400,
      temperature: payload.temperature ?? 0.25,
      ...(payload.system ? { system: payload.system } : {}),
      messages: payload.messages,
      tools: Array.isArray(payload.tools) ? payload.tools : [],
      tool_choice: payload.tool_choice || { type: 'auto' },
    })

    stream.on('text', (text) => sendSSE(res, 'text', { text }))

    const finalMessage = await stream.finalMessage()
    const expectedTool = payload.tool_choice?.name || 'return_trade_analysis'
    const toolBlock = (finalMessage.content || []).find(
      b => b.type === 'tool_use' && b.name === expectedTool
    )
    const parsed = toolBlock?.input || null

    sendSSE(res, 'result', { ok: true, parsed, model: finalMessage.model, usage: finalMessage.usage })
  } catch (err) {
    sendSSE(res, 'error', { ok: false, message: err?.message || 'Trade analysis failed' })
  } finally {
    res.end()
  }
})

app.use(express.static(distDir))

// SPA-Fallback (alles außer /api -> index.html)
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Prod server running on http://localhost:${PORT} (model: ${MODEL})`)
})
