// Alle /api-Routen von Dev- UND Prod-Server. Eine Aenderung hier gilt fuer beide —
// die alte Regel "index.js und prod.js synchron halten" ist damit Geschichte.
import Anthropic from '@anthropic-ai/sdk'
import { load as cheerioLoad } from 'cheerio'
import {
  FFC_FORMATS, normalizeFfcPlayer, isDynastyFromQuery,
  FP_SCORING_URLS, FP_POSITIONS, extractEcrData, normalizeFantasyProsPlayer,
  SLEEPER_ADP_FIELD, normalizeSleeperAdpPlayer,
} from './rankings.js'

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
  description: 'Final draft review with rankings, one-liners, global summary, deep dive for the user, steals/reaches and learnings for the next mock draft.',
  input_schema: {
    type: 'object',
    properties: {
      overallRankings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: "Die owner_id des Rosters aus dem Kontext." },
            displayName: { type: 'string', description: "Der menschenlesbare display_name des Rosters (nie die rohe owner_id)." },
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
            teamId: { type: 'string', description: "Die owner_id des Rosters aus dem Kontext." },
            displayName: { type: 'string', description: "Der menschenlesbare display_name des Rosters (nie die rohe owner_id)." },
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
            teamId: { type: 'string', description: "Die owner_id des Rosters aus dem Kontext." },
            displayName: { type: 'string', description: "Der menschenlesbare display_name des Rosters (nie die rohe owner_id)." },
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
            teamId: { type: 'string', description: "Die owner_id des Rosters aus dem Kontext." },
            displayName: { type: 'string', description: "Der menschenlesbare display_name des Rosters (nie die rohe owner_id)." },
            rationale: { type: 'string' },
          },
          required: ['pick_no', 'player', 'teamId', 'displayName', 'rationale'],
        },
      },
      lessonsForNextMock: {
        type: 'array', minItems: 2, maxItems: 4,
        description: 'Konkrete, belegbare Learnings fuer den naechsten Mock-Draft des Nutzers.',
        items: {
          type: 'object',
          properties: {
            lesson:   { type: 'string', description: 'Das Learning, Deutsch (du-Form), handlungsleitend formuliert' },
            evidence: { type: 'string', description: 'Beleg mit konkreten Picks/Raengen aus dem Kontext (z. B. "Picks 28 und 52 je >6 Plaetze ueber ADP")' },
          },
          required: ['lesson', 'evidence'],
        },
      },
    },
    required: ['overallRankings', 'teamOneLiners', 'overallSummary', 'myTeamDeepDive', 'steals', 'reaches', 'lessonsForNextMock'],
  },
}

// ---------- Draft-Strategie: Quellen, Schema, Prompt ----------
// Whitelist getrennt nach Draft-Modus: DLF ist fuer Redraft wertlos, FantasyPros
// und 4for4 sind fuer Dynasty duenn. reddit.com fehlt bewusst — der Anthropic-
// Crawler ist dort gesperrt (HTTP 400), Subreddits sind nicht erreichbar.
export const STRATEGY_SOURCES = {
  redraft: ['fantasypros.com', '4for4.com', 'footballguys.com', 'rotoballer.com'],
  rookie:  ['dynastyleaguefootball.com', 'footballguys.com', 'fantasypros.com', 'keeptradecut.com'],
}

// strict: true ist hier nicht optional. Ohne das Flag validiert die API die
// Tool-Eingabe nicht, und das Modell hat im Live-Test Regeln, Quellen und
// contested als ein einziges Pseudo-XML in das Feld "rules" gepackt statt in
// drei Arrays -- newStrategyItem() hat den Nicht-Array dann korrekt zu []
// verworfen, und die Strategie kam ohne Regeln und ohne Quellen an.
// Voraussetzung fuer strict: additionalProperties: false und alle Felder in
// required. minItems/maxItems werden unter strict nicht unterstuetzt -- die
// Vier-bis-sechs-Vorgabe steht deshalb in description und Prompt.
export const STRATEGY_TOOL = {
  name: 'return_draft_strategy',
  description: 'Kompakte, recherchierte Draft-Strategie fuer ein konkretes Liga-Format und eine konkrete Saison.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Ein Satz Leitlinie, Deutsch (du-Form).' },
      rules: {
        type: 'array',
        description: 'Vier bis sechs konkrete Regeln mit Rundenbezug, Deutsch (du-Form). Je ein Array-Eintrag pro Regel.',
        items: { type: 'string' },
      },
      sources: {
        type: 'array',
        description: 'Belegende Quellen aus der Websuche. Nur tatsaechlich gelesene URLs, je ein Array-Eintrag.',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, url: { type: 'string' } },
          required: ['title', 'url'],
          additionalProperties: false,
        },
      },
      contested: {
        type: 'array',
        description: 'Punkte, in denen sich die Quellen widersprechen. Leeres Array, wenn es keine gibt.',
        items: { type: 'string' },
      },
    },
    required: ['summary', 'rules', 'sources', 'contested'],
    additionalProperties: false,
  },
}

// Der Query-Plan ist fest: die Fragen sind jedes Jahr dieselben, nur das Format
// wechselt. Vier gezielte Suchen schlagen fuenfzehn tastende — deshalb steht der
// Plan hier und nicht im Ermessen des Modells.
export function buildStrategyPrompt({ format = {}, season, draftMode, draftSlot, principles } = {}) {
  const qb = format.superflex ? 'Superflex' : '1QB'
  const modus = draftMode === 'rookie' ? 'Dynasty/Rookie-Draft' : 'Redraft'
  const starters = (format.rosterPositions || []).filter(s => String(s).toUpperCase() !== 'BN').join(', ')

  const queries = [
    `Draft-Strategie fuer ${format.teams} Teams, ${format.scoringType}, ${qb}, Saison ${season}`,
    `Positions-Tiefe und Knappheit in ${season}`,
    ...(draftSlot ? [`Vorgehen an Draft-Slot ${draftSlot}`] : []),
    `Tragfaehigkeit der gaengigen Strategien (Zero RB, Hero RB, Robust RB) in ${season}`,
  ]

  return [
    `Du erstellst eine Draft-Strategie fuer eine Fantasy-Football-Liga (${modus}).`,
    '',
    'Format:',
    `- Teams: ${format.teams}`,
    `- Scoring: ${format.scoringType}`,
    `- ${qb}`,
    `- Starter-Slots: ${starters}`,
    `- Saison: ${season}`,
    ...(draftSlot ? [`- Draft-Slot: ${draftSlot}`] : []),
    '',
    'Schritt 1 — recherchiere mit web_search genau diese Punkte, in dieser Reihenfolge:',
    ...queries.map((q, i) => `${i + 1}. ${q}`),
    '',
    'Schritt 2 — erst wenn diese Suchen gelaufen sind, rufe return_draft_strategy auf.',
    '',
    'Regeln fuer das Ergebnis:',
    // Der Prompt selbst ist ASCII (Quelltext-Konvention). Ohne diesen Hinweis
    // ahmt das Modell den Stil nach und liefert "duenn" statt "dünn".
    '- Alle Freitexte auf Deutsch, du-Form, mit korrekten Umlauten (ä, ö, ü, ß).',
    '- rules enthaelt vier bis sechs Regeln, jede mit Rundenbezug. Eine leere Liste ist ein Fehler.',
    '- sources enthaelt die tatsaechlich gelesenen URLs. Eine leere Liste ist ein Fehler.',
    '- Widersprechen sich Quellen, gehoert der Konflikt nach contested. Loese ihn nicht zugunsten einer Seite auf.',
    '- Halte dich kurz: eine Leitlinie, vier bis sechs Regeln.',
    ...(String(principles || '').trim() ? [
      '',
      'Die folgenden Grundsaetze des Nutzers sind gesetzt. Beruecksichtige sie, aber schreibe sie nicht um',
      'und wiederhole sie nicht in den Regeln:',
      String(principles).trim(),
    ] : []),
  ].join('\n')
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

  // ---------- Rankings: Sleeper ADP (RotoWire, Hauptquelle) ----------
  // Format-spezifische ADP aus Sleepers Projections. Quelle ist RotoWire, nicht
  // echte Sleeper-Draft-Crowd — die Herkunfts-Zeile weist das als "Sleeper
  // (RotoWire)" aus. Serverseitig auf adp != null gefiltert: von ~3100 Spielern
  // tragen die meisten den 999-Sentinel; ungefiltert wuerde der Union-Tail im
  // Merge das Board mit tausenden rang- und ADP-losen Spielern fluten.
  app.get('/api/rankings/sleeper-adp', async (req, res) => {
    const format = FFC_FORMATS.includes(String(req.query.format)) ? String(req.query.format) : 'ppr'
    const adpField = SLEEPER_ADP_FIELD[format] || 'adp_ppr'
    const year = parseInt(req.query.year) || new Date().getFullYear()
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((p) => `position%5B%5D=${p}`).join('&')
    const url = `https://api.sleeper.com/projections/nfl/${year}?season_type=regular&${positions}&order_by=${adpField}`
    try {
      const upstream = await fetch(url)
      if (!upstream.ok) return res.status(502).json({ ok: false, error: `Sleeper antwortete mit ${upstream.status}` })
      const json = await upstream.json()
      if (!Array.isArray(json)) {
        return res.status(502).json({ ok: false, error: 'Sleeper lieferte keine verwertbaren Daten' })
      }
      const players = json
        .map((p) => normalizeSleeperAdpPlayer(p, adpField))
        .filter((p) => p.adp != null)
        .sort((a, b) => a.adp - b.adp)
      res.json({
        ok: true,
        meta: {
          source: 'sleeper',
          provider: 'rotowire',
          format,
          total_drafts: null,
          end_date: null,
          fetched_at: new Date().toISOString(),
        },
        players,
      })
    } catch (e) {
      res.status(502).json({ ok: false, error: e?.message || 'Sleeper nicht erreichbar' })
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

  // ---------- Rankings: FantasyPros Consensus (Redraft, gescraped) ----------
  // scoring: ppr | half | std -> passende Cheatsheet-Seite. Wir ziehen den
  // eingebetteten ecrData-Blob (volle Rangliste) statt der auf 10 Spieler/Position
  // limitierten oeffentlichen API. Antwortform wie die KTC-Routen.
  app.get('/api/rankings/fantasypros', async (req, res) => {
    const scoring = ['ppr', 'half', 'std'].includes(String(req.query.scoring)) ? String(req.query.scoring) : 'ppr'
    const url = FP_SCORING_URLS[scoring]
    const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    try {
      const upstream = await fetch(url, { headers: HEADERS })
      if (!upstream.ok) return res.status(502).json({ ok: false, error: `FantasyPros returned ${upstream.status}` })
      const html = await upstream.text()
      const data = extractEcrData(html)
      const rawPlayers = Array.isArray(data?.players) ? data.players : []
      const players = rawPlayers
        .filter((p) => FP_POSITIONS.includes(String(p?.player_position_id || '').toUpperCase()))
        .map((p, idx) => ({ id: idx + 1, ...normalizeFantasyProsPlayer(p) }))
      if (!players.length) {
        return res.status(502).json({ ok: false, error: 'Keine Spieler gefunden – FantasyPros-Struktur möglicherweise geändert' })
      }
      res.json({
        ok: true,
        meta: {
          source: 'fantasypros',
          scoring,
          type: data?.type ?? null,
          total_experts: data?.total_experts ?? null,
          last_updated: data?.last_updated ?? null,
          fetched_at: new Date().toISOString(),
        },
        players,
      })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'FantasyPros-Scraping fehlgeschlagen' })
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
        // Kein temperature: claude-sonnet-5 lehnt den Parameter ab (deprecated).
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
        // Kein temperature: claude-sonnet-5 lehnt den Parameter ab (deprecated).
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
        // Kein temperature: claude-sonnet-5 lehnt den Parameter ab (deprecated).
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

  // ---------- Draft-Strategie erzeugen (SSE streaming, mit Websuche) ----------
  app.post('/api/ai-draft-strategy', async (req, res) => {
    const userKey = req.header('x-anthropic-key')
    if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-Anthropic-Key header' })

    const { format, season, draftMode, draftSlot = null, principles = '' } = req.body || {}
    if (!format || !season) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: expected { format, season, draftMode }' })
    }

    setSSEHeaders(res)

    try {
      const mode = draftMode === 'rookie' ? 'rookie' : 'redraft'
      const prompt = buildStrategyPrompt({ format, season, draftMode: mode, draftSlot, principles })

      const p = applyPromptCaching({
        // Ein Satz wie "antworte ausschliesslich ueber das Tool" laesst das Modell
        // das Tool SOFORT rufen -- ohne vorher zu suchen. Ergebnis: leere rules
        // und sources (im Live-Test belegt). Die Reihenfolge muss explizit sein.
        system: [
          'Du bist ein erfahrener Fantasy-Football-Analyst.',
          'Arbeite immer in dieser Reihenfolge: erst mit web_search recherchieren, dann das Ergebnis',
          'ueber das Tool return_draft_strategy zurueckgeben. Rufe return_draft_strategy niemals,',
          'bevor du gesucht hast — ohne Quellen ist die Strategie wertlos.',
        ].join(' '),
        tools: [
          {
            type: 'web_search_20260318',
            name: 'web_search',
            max_uses: 6,
            allowed_domains: STRATEGY_SOURCES[mode],
            // Rohtreffer nicht in die Antwort spiegeln — wir brauchen nur das Schema.
            response_inclusion: 'excluded',
          },
          STRATEGY_TOOL,
        ],
      })

      const client = new Anthropic({ apiKey: userKey })
      let messages = [{ role: 'user', content: prompt }]
      let finalMessage = null

      // Server-Tools koennen die Antwort mit stop_reason "pause_turn" unterbrechen.
      // Fortsetzen heisst: die Assistant-Nachricht unveraendert zurueckschicken.
      for (let attempt = 0; attempt < 4; attempt++) {
        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          system: p.system,
          messages,
          tools: p.tools,
        })
        finalMessage = await stream.finalMessage()
        if (finalMessage.stop_reason !== 'pause_turn') break
        messages = [...messages, { role: 'assistant', content: finalMessage.content }]
      }

      if (finalMessage?.stop_reason === 'pause_turn') {
        sendSSE(res, 'error', { ok: false, message: 'Recherche wurde zu oft unterbrochen — bitte erneut versuchen' })
        return
      }

      const toolBlock = (finalMessage?.content || []).find(
        b => b.type === 'tool_use' && b.name === 'return_draft_strategy'
      )
      const parsed = toolBlock?.input || null

      if (!parsed) {
        sendSSE(res, 'error', { ok: false, message: 'Modell lieferte keine strukturierte Strategie' })
      } else {
        sendSSE(res, 'result', {
          ok: true, parsed, model: finalMessage.model, usage: finalMessage.usage,
        })
      }
    } catch (err) {
      sendSSE(res, 'error', { ok: false, message: err?.message || 'Strategie-Recherche fehlgeschlagen' })
    } finally {
      res.end()
    }
  })
}
