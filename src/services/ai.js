// src/services/ai.js
// Erzeugt das Payload für einen OpenAI-Aufruf, um einen Next-Pick-Vorschlag zu erhalten.
// Nutzt Structured Outputs, damit die Antwort exakt einem JSON-Schema entspricht.

import { normalizePlayerName } from '../utils/formatting'

/**
 * @typedef {Object} BoardPlayer
 * @property {number|string} id
 * @property {string} rk            // Ranking (string in CSV, wird zu Zahl geparst)
 * @property {string} tier
 * @property {string} name
 * @property {string} team
 * @property {string} pos           // QB | RB | WR | TE | K | DEF | ...
 * @property {string} bye
 * @property {string} sos           // z.B. "3/5"
 * @property {string} ecrVsAdp
 * @property {string} nname         // normalisierter Name (siehe parse CSV)
 * @property {'me'|'other'|null} status
 * @property {number|null} pick_no
 * @property {string|null} picked_by
 */

/**
 * @typedef {Object} SleeperPick
 * @property {number} pick_no
 * @property {string} picked_by
 * @property {{first_name:string,last_name:string,position:string,team:string}} metadata
 */

/**
 * @typedef {Object} LeagueLike
 * @property {string} [name]
 * @property {string|number} [season]
 * @property {Array<string>} [roster_positions] // z.B. ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF","BN",...]
 * @property {Object<string,number>} [scoring_settings] // Sleeper-Scoring, z.B. { rec: 1, pass_yd: 0.04, ... }
 * @property {Object} [settings] // ggf. rounds, teams, draft_order etc.
 */

/**
 * @typedef {Object} BuildOptions
 * @property {number} [topNOverall=60]     // wie viele best-available insgesamt
 * @property {number} [topPerPos=20]       // wie viele best-available je Position
 * @property {string} [model="gpt-4o-mini"]
 * @property {number} [temperature=0.2]
 * @property {number} [max_output_tokens=600]
 */

/**
 * Fasst den App-Zustand kompakt für das LLM zusammen
 */
function makeContext({
  boardPlayers = /** @type {BoardPlayer[]} */([]),
  livePicks = /** @type {SleeperPick[]} */([]),
  me = '',
  league = /** @type {LeagueLike} */({}),
  draft = /** @type {any} */(null),
  currentPickNumber = null,
  options = /** @type {BuildOptions} */({})
}) {
  const {
    topNOverall = 60,
    topPerPos = 20,
  } = options

  // 1) Bereits gepickte Spieler (per Sleeper live picks) -> normalisierte Namen
  const pickedByName = new Set(
    (livePicks || []).map(p => normalizePlayerName(`${p?.metadata?.first_name || ''} ${p?.metadata?.last_name || ''}`))
  )

  // 2) Board: verfügbar = nicht gepickt (entweder via status oder via live picks Vergleich)
  const numericRank = (r) => {
    const n = Number(String(r).replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : 1e9
  }

  const available = (boardPlayers || []).filter(p => {
    if (p?.status === 'me' || p?.status === 'other') return false
    if (pickedByName.has(p.nname)) return false
    return true
  }).sort((a,b) => numericRank(a.rk) - numericRank(b.rk))

  // 3) Top-N Gesamt + je Position
  const topOverall = available.slice(0, topNOverall).map(minifyBoardPlayer)
  const byPos = groupBy(available, p => p.pos || 'OTHER')
  const topByPosition = Object.fromEntries(
    Object.entries(byPos).map(([pos, arr]) => [pos, arr.slice(0, topPerPos).map(minifyBoardPlayer)])
  )

  // 4) Mein Roster + Pos-Counts
  const myPicks = (livePicks || []).filter(p => p.picked_by === me)
  const myRoster = myPicks.map(p => ({
    nname: normalizePlayerName(`${p?.metadata?.first_name || ''} ${p?.metadata?.last_name || ''}`),
    name: `${p?.metadata?.first_name || ''} ${p?.metadata?.last_name || ''}`.trim(),
    pos: p?.metadata?.position || '',
    team: p?.metadata?.team || '',
    pick_no: p?.pick_no || null,
  }))
  const myCounts = countBy(myRoster, r => r.pos || 'OTHER')

  // 5) Roster-Anforderungen aus League-Setup (Counts je Slot)
  const rosterReq = summarizeRosterRequirements(league?.roster_positions || [])

  // 6) Scoring-Zusammenfassung (v.a. PPR)
  const recPoints = (league?.scoring_settings && typeof league.scoring_settings.rec === 'number')
    ? league.scoring_settings.rec : 0
  const pprType = recPoints >= 0.95 ? 'PPR'
               : recPoints >= 0.45 ? 'Half PPR'
               : 'Standard/Non-PPR'

  // 7) Draft-Kontext (so weit vorhanden)
  const draftContext = {
    current_pick_number: currentPickNumber,
    rounds: draft?.settings?.rounds ?? draft?.rounds ?? null,
    teams: draft?.settings?.teams ?? draft?.teams ?? null,
    slot: inferMySlot({ draft, livePicks, me }), // best effort
    is_snake: inferSnake(draft),
  }

  // 8) Sicherheits-/Integritäts-Infos
  const constraints = {
    // LLM darf nur aus diesen Kandidaten wählen:
    candidate_pool_hint: {
      overall_size: topOverall.length,
      by_position_keys: Object.keys(topByPosition),
    },
    // Strict rule: niemals bereits gepickte vorschlagen
    avoid_nnames: Array.from(pickedByName),
  }

  return {
    league: {
      name: league?.name ?? null,
      season: league?.season ?? null,
      roster_positions: league?.roster_positions ?? [],
      roster_requirements: rosterReq,
      ppr_type: pprType,
      scoring_settings: league?.scoring_settings ?? {},
    },
    draft: draftContext,
    me: { user_id: me },
    my_team: {
      picks: myRoster,
      position_counts: myCounts,
    },
    board: {
      overall_top: topOverall,
      by_position: topByPosition,
    },
    constraints,
    timestamp_iso: new Date().toISOString(),
  }
}

function minifyBoardPlayer(p) {
  return {
    rk: Number(String(p.rk).replace(/[^\d.-]/g, '')),
    tier: p.tier || '',
    name: p.name || '',
    nname: p.nname || normalizePlayerName(p.name || ''),
    pos: p.pos || '',
    team: p.team || '',
    bye: p.bye || '',
    sos: p.sos || '',
    ecrVsAdp: p.ecrVsAdp || '',
  }
}

function groupBy(arr, keyFn) {
  /** @type {Record<string, any[]>} */
  const out = {}
  for (const x of arr) {
    const k = keyFn(x)
    if (!out[k]) out[k] = []
    out[k].push(x)
  }
  return out
}

function countBy(arr, keyFn) {
  /** @type {Record<string, number>} */
  const out = {}
  for (const x of arr) {
    const k = keyFn(x)
    out[k] = (out[k] || 0) + 1
  }
  return out
}

function summarizeRosterRequirements(positions) {
  // Sleeper typisch: ["QB","RB","RB","WR","WR","TE","FLEX","K","DEF","BN","BN","IR","TAXI",...]
  const counts = countBy(positions || [], x => x)
  return {
    required: {
      QB: counts.QB || 0,
      RB: counts.RB || 0,
      WR: counts.WR || 0,
      TE: counts.TE || 0,
      K: counts.K || 0,
      DEF: counts.DEF || counts.DST || 0,
      FLEX: counts.FLEX || 0,
      SUPER_FLEX: counts.SUPER_FLEX || 0,
      WR_RB: counts.WR_RB || 0,
      WR_TE: counts.WR_TE || 0,
      RB_WR_TE: counts.RB_WR_TE || 0,
      IDP: (counts.DL || 0) + (counts.LB || 0) + (counts.DB || 0),
    },
    bench: counts.BN || 0,
    special: {
      IR: counts.IR || 0,
      TAXI: counts.TAXI || 0,
    },
  }
}

function inferSnake(draft) {
  // Sleeper Draft settings -> meist snake. Wenn du später die echte Info hast, hier ersetzen.
  // fallback: assume snake
  return true
}

function inferMySlot({ draft, livePicks, me }) {
  // Best effort: früheste eigene Pick-Nummer -> Slot % Teams
  try {
    const teams = draft?.settings?.teams ?? draft?.teams
    if (!teams || !Number.isFinite(teams)) return null
    const mine = (livePicks || []).filter(p => p.picked_by === me).sort((a,b) => (a.pick_no||0)-(b.pick_no||0))
    if (!mine.length) return null
    const pick1 = mine[0].pick_no
    if (!Number.isFinite(pick1)) return null
    const slot = ((pick1 - 1) % teams) + 1
    return slot
  } catch {
    return null
  }
}

/**
 * System Prompt: stabile, klare Regeln für das LLM
 */
function buildSystemPrompt() {
  return [
    'You are a veteran Fantasy Football draft advisor specialized in Sleeper drafts.',
    'Task: Recommend the next best pick for the USER given the league settings, roster needs, and the provided ranking board.',
    'Hard constraints:',
    '- Never recommend a player who is already picked.',
    '- Recommend only players that appear in board.overall_top or board.by_position.',
    '- Respect the league scoring (PPR vs Half PPR vs Standard) and roster requirements.',
    '- Consider positional scarcity, team roster balance, bye weeks only as soft tie-breakers.',
    '- Consider snake draft turn distance (risk of players not returning to next pick) if data is available.',
    'When you are ready, CALL the tool function `return_draft_advice` with your final recommendation object.',
  ].join('\n')
}

/**
 * JSON-Schema für eine robuste, kleinteilige Antwort.
 * -> Passt gut zum UI (Primary + Alternativen + kompakte Begründungen).
 */
function draftAdviceParametersSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: {
          type: 'object',
          additionalProperties: false,
          properties: {
            player_nname: { type: 'string', description: 'Normalized name to match board.nname' },
            player_display: { type: 'string', description: 'Human readable "First Last"' },
            pos: { type: 'string', enum: ['QB','RB','WR','TE','K','DEF','OTHER'] },
            tier: { type: 'string' },
            rk: { type: 'integer' },
            fit_score: { type: 'number', minimum: 0, maximum: 100 },
            why: { type: 'string', description: 'Short reasoning focusing on fit, scarcity, risk' },
          },
          required: ['player_nname','pos','why'],
        },
        alternatives: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              player_nname: { type: 'string' },
              player_display: { type: 'string' },
              pos: { type: 'string', enum: ['QB','RB','WR','TE','K','DEF','OTHER'] },
              tier: { type: 'string' },
              rk: { type: 'integer' },
              why: { type: 'string' },
            },
            required: ['player_nname','pos','why'],
          }
        },
        strategy_notes: { type: 'string', description: '1-3 short bullets about overall strategy from now on' },
        risk_level: { type: 'string', enum: ['low','medium','high'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['primary','alternatives'],
  }
}

/**
 * Baut das vollständige Payload für openai.chat.completions.create(...)
 *
 * @param {Object} params
 * @param {BoardPlayer[]} params.boardPlayers
 * @param {SleeperPick[]} params.livePicks
 * @param {string} params.me
 * @param {LeagueLike} params.league
 * @param {any} [params.draft]
 * @param {number|null} [params.currentPickNumber]
 * @param {BuildOptions} [params.options]
 * @returns {Object} payload
 */
export function buildAIAdviceRequest(params) {
  const {
    boardPlayers = [],
    livePicks = [],
    me = '',
    league = {},
    draft = null,
    currentPickNumber = null,
    options = {},
  } = params || {}

  const context = makeContext({ boardPlayers, livePicks, me, league, draft, currentPickNumber, options })
  const system = buildSystemPrompt()
  const parametersSchema = draftAdviceParametersSchema()

  const model = options.model || 'gpt-4o-mini'
  const temperature = options.temperature ?? 0.2
  const max_output_tokens = options.max_output_tokens ?? 600

  // Für Chat Completions:
  // client.chat.completions.create({ model, messages, response_format, temperature, max_tokens })
  return {
    model,
    temperature,
    max_tokens: max_output_tokens,
    tools: [
      {
        type: 'function',
        function: {
          name: 'return_draft_advice',
          description: 'Return the next-pick recommendation and alternatives for the user based on the provided context.',
          parameters: parametersSchema
        }
      }
    ],
    tool_choice: { type: 'function', function: { name: 'return_draft_advice' } },
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        // Daten als JSON im Text – universell kompatibel mit Chat Completions.
        // (Falls du später die Responses API nutzt, kannst du input_json separat schicken.)
        content:
`Use the following structured context to recommend the next pick:
<CONTEXT_JSON>
${JSON.stringify(context)}
</CONTEXT_JSON>`
      }
    ],
  }
}
