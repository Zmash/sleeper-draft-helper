// Alle /api-Routen von Dev- UND Prod-Server. Eine Aenderung hier gilt fuer beide —
// die alte Regel "index.js und prod.js synchron halten" ist damit Geschichte.
import Anthropic from '@anthropic-ai/sdk'
import { load as cheerioLoad } from 'cheerio'
import { FFC_FORMATS, normalizeFfcPlayer, isDynastyFromQuery } from './rankings.js'

export const DEFAULT_MODEL = 'claude-sonnet-5'

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
export const REVIEW_TOOL = {
  name: 'return_draft_review',
  description: 'Final draft review with rankings, one-liners, global summary, deep dive for the user, steals/reaches and week-1 start/sit for the user team.',
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
        description: 'Top steals of the draft (best value vs consensus/board).',
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
        description: 'Top reaches of the draft (worst value vs consensus/board).',
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
        description: 'Week-1 Start/Sit preview for the user team only.',
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

// Statische Payload-Teile (System-Prompt, Tool-Schemas) fuer Anthropic-Prompt-Caching
// markieren. Greift erst ab ~1024 Token Praefix — darunter passiert schlicht nichts,
// das ist KEIN Fehlerfall. Cache-TTL ~5 min, passt zum Advice-Rhythmus im Draft.
export function applyPromptCaching(payload = {}) {
  const out = { ...payload }
  if (typeof out.system === 'string' && out.system) {
    out.system = [{ type: 'text', text: out.system, cache_control: { type: 'ephemeral' } }]
  }
  if (Array.isArray(out.tools) && out.tools.length) {
    out.tools = out.tools.map((t, i, arr) =>
      i === arr.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t
    )
  }
  return out
}

export function registerApiRoutes(app, { model = DEFAULT_MODEL } = {}) {
  const MODEL = model

  // ---------- Rankings: Fantasy Football Calculator (ADP) ----------
  app.get('/api/rankings/ffc-adp', async (req, res) => {
    const format = FFC_FORMATS.includes(String(req.query.format)) ? String(req.query.format) : 'ppr'
    const teams = parseInt(req.query.teams) || 12
    const year = parseInt(req.query.year) || new Date().getFullYear()
    const url = `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}`
    try {
      const upstream = await fetch(url)
      if (!upstream.ok) return res.status(502).json({ ok: false, error: `FFC antwortete mit ${upstream.status}` })
      const json = await upstream.json()
      if (json?.status !== 'Success' || !Array.isArray(json?.players)) {
        return res.status(502).json({ ok: false, error: 'FFC lieferte keine verwertbaren Daten' })
      }
      res.json({
        ok: true,
        meta: {
          source: 'ffc',
          format,
          total_drafts: json?.meta?.total_drafts ?? null,
          start_date: json?.meta?.start_date ?? null,
          end_date: json?.meta?.end_date ?? null,
          fetched_at: new Date().toISOString(),
        },
        players: json.players.map(normalizeFfcPlayer),
      })
    } catch (e) {
      res.status(502).json({ ok: false, error: e?.message || 'FFC nicht erreichbar' })
    }
  })

  // ---------- Rankings: FantasyCalc ----------
  app.get('/api/rankings/fantasycalc', async (req, res) => {
    const numQbs = parseInt(req.query.numQbs) === 2 ? 2 : 1
    const numTeams = parseInt(req.query.numTeams) || 12
    const ppr = req.query.ppr !== undefined ? Number(req.query.ppr) : 1
    const isDynasty = isDynastyFromQuery(req.query.isDynasty)
    const url = `https://api.fantasycalc.com/values/current?isDynasty=${isDynasty}&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}&includeAdp=false`
    try {
      const upstream = await fetch(url)
      if (!upstream.ok) return res.status(502).json({ ok: false, error: `FantasyCalc returned ${upstream.status}` })
      const json = await upstream.json()
      const players = json.map((fc, idx) => ({
        id: idx + 1,
        rk: String(fc.overallRank ?? idx + 1),
        ecr: fc.overallRank ?? idx + 1,
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
        sleeperId: fc?.player?.sleeperId ?? null,
        tier: fc?.maybeTier ?? null,
      }))
      res.json({
        ok: true,
        meta: { source: 'fantasycalc', isDynasty, numQbs, numTeams, ppr, fetched_at: new Date().toISOString() },
        players,
      })
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
        const posRankRaw = $('.position-team .position', el).first().text().trim() // e.g. "RB3"
        const pos = posRankRaw.replace(/\d+/g, '') || ''
        const ageRaw = $('.position-team .position.hidden-xs', el).text().replace('y.o.', '').trim()
        const age = parseFloat(ageRaw) || null
        const tierRaw = $('.player-info .position', el).text().trim() // e.g. "Tier 1"
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
    res.json({
      ok: true,
      env: process.env.NODE_ENV || 'development',
      node: process.version,
      model: MODEL,
    })
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
      const p = applyPromptCaching(payload)
      const client = new Anthropic({ apiKey: userKey })
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: p.max_tokens || 1024,
        temperature: p.temperature ?? 0.2,
        ...(p.system ? { system: p.system } : {}),
        messages: p.messages,
        tools: Array.isArray(p.tools) ? p.tools : [],
        tool_choice: p.tool_choice || { type: 'auto' },
      })

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
      const p = applyPromptCaching({ ...payload, tools: [REVIEW_TOOL] })
      const client = new Anthropic({ apiKey: userKey })
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: p.max_tokens || 4096,
        temperature: p.temperature ?? 0.3,
        ...(p.system ? { system: p.system } : {}),
        messages: p.messages,
        tools: p.tools,
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
        sendSSE(res, 'result', { ok: true, parsed, model: finalMessage.model, usage: finalMessage.usage })
      }
    } catch (err) {
      sendSSE(res, 'error', { ok: false, message: err?.message || 'Review request failed' })
    } finally {
      res.end()
    }
  })

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
      const p = applyPromptCaching(payload)
      const client = new Anthropic({ apiKey: userKey })
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: p.max_tokens || 1400,
        temperature: p.temperature ?? 0.25,
        ...(p.system ? { system: p.system } : {}),
        messages: p.messages,
        tools: Array.isArray(p.tools) ? p.tools : [],
        tool_choice: p.tool_choice || { type: 'auto' },
      })

      const finalMessage = await stream.finalMessage()
      const expectedTool = p.tool_choice?.name || 'return_trade_analysis'
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
}
