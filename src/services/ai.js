// src/services/ai.js
// Builds Claude API payload for the next-pick advice endpoint.
// Output format: { system, messages, tools, tool_choice, max_tokens, temperature }

import { normalizePlayerName, normalizePos } from '../utils/formatting'

// ---------- Pure helpers ----------

const numericRank = (r) => {
  const n = Number(String(r).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : 1e9
}

function groupBy(arr, keyFn) {
  const out = {}
  for (const x of arr) {
    const k = keyFn(x)
    if (!out[k]) out[k] = []
    out[k].push(x)
  }
  return out
}

function countBy(arr, keyFn) {
  const out = {}
  for (const x of arr) {
    const k = keyFn(x)
    out[k] = (out[k] || 0) + 1
  }
  return out
}

function summarizeRosterRequirements(positions) {
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
    special: { IR: counts.IR || 0, TAXI: counts.TAXI || 0 },
  }
}

function inferMySlot({ draft, livePicks, me }) {
  try {
    const teams = draft?.settings?.teams ?? draft?.teams
    if (!teams || !Number.isFinite(teams)) return null
    const mine = (livePicks || [])
      .filter(p => p.picked_by === me)
      .sort((a, b) => (a.pick_no || 0) - (b.pick_no || 0))
    if (!mine.length) return null
    const pick1 = mine[0].pick_no
    if (!Number.isFinite(pick1)) return null
    return ((pick1 - 1) % teams) + 1
  } catch { return null }
}

function minifyBoardPlayer(p) {
  const base = {
    rk: numericRank(p.rk),
    tier: p.tier || '',
    name: p.name || '',
    nname: p.nname || normalizePlayerName(p.name || ''),
    pos: normalizePos(p.pos || ''),
    team: p.team || '',
    bye: p.bye || '',
    sos: p.sos || '',
    ecrVsAdp: p.ecrVsAdp || '',
  }
  if (p.dynasty_value != null) base.dynasty_value = p.dynasty_value
  if (p.age != null) base.age = p.age
  if (p.years_exp != null) base.years_exp = p.years_exp
  return base
}

/**
 * For each RB on the user's roster, find available backups on the same NFL team.
 * Helps the AI recommend handcuffs at the right moment.
 */
function findHandcuffs({ myRoster, available }) {
  const myRBs = myRoster.filter(r => r.pos === 'RB' && r.team)
  return myRBs.flatMap(starter => {
    const backups = available
      .filter(p => normalizePos(p.pos) === 'RB' && p.team === starter.team)
      .slice(0, 2)
      .map(b => ({
        nname: b.nname,
        name: b.name || b.nname,
        rk: numericRank(b.rk),
        tier: b.tier || '',
      }))
    return backups.length > 0
      ? [{ starter_nname: starter.nname, starter_team: starter.team, backups }]
      : []
  })
}

function deriveFavAvoid({ boardPlayers = [], playerPreferences = {} }) {
  const idByNname = new Map()
  for (const p of boardPlayers || []) {
    const n = normalizePlayerName(p?.nname || p?.name || '')
    if (n) idByNname.set(n, p.player_id || p.id || null)
  }

  const favorites = []
  const avoids = []
  for (const [pid, pref] of Object.entries(playerPreferences || {})) {
    if (!pref) continue
    const asNname = normalizePlayerName(pid)
    if (idByNname.has(asNname)) {
      if (pref === 'FAVORITE') favorites.push(asNname)
      else if (pref === 'AVOID') avoids.push(asNname)
      continue
    }
    const p = (boardPlayers || []).find(bp => String(bp.player_id || bp.id) === String(pid))
    if (p) {
      const n = normalizePlayerName(p.nname || p.name || '')
      if (n) {
        if (pref === 'FAVORITE') favorites.push(n)
        else if (pref === 'AVOID') avoids.push(n)
      }
    }
  }
  return {
    favorites: Array.from(new Set(favorites)),
    avoids: Array.from(new Set(avoids)),
  }
}

// ---------- Context builder ----------

function makeContext({ boardPlayers, livePicks, me, league, draft, currentPickNumber, options, draftMode, dynastyRoster, myDraftPicks }) {
  const { topNOverall = 40, topPerPos = 10 } = options

  const pickedByName = new Set(
    (livePicks || []).map(p =>
      normalizePlayerName(`${p?.metadata?.first_name || ''} ${p?.metadata?.last_name || ''}`)
    )
  )

  const available = (boardPlayers || [])
    .filter(p => {
      if (p?.status === 'me' || p?.status === 'other') return false
      if (pickedByName.has(p.nname)) return false
      return true
    })
    .sort((a, b) => numericRank(a.rk) - numericRank(b.rk))

  const topOverall = available.slice(0, topNOverall).map(minifyBoardPlayer)
  const byPos = groupBy(available, p => normalizePos(p.pos || 'OTHER'))
  const topByPosition = Object.fromEntries(
    Object.entries(byPos).map(([pos, arr]) => [pos, arr.slice(0, topPerPos).map(minifyBoardPlayer)])
  )

  const myPicks = (livePicks || []).filter(p => p.picked_by === me)
  const myRoster = myPicks.map(p => ({
    nname: normalizePlayerName(`${p?.metadata?.first_name || ''} ${p?.metadata?.last_name || ''}`),
    name: `${p?.metadata?.first_name || ''} ${p?.metadata?.last_name || ''}`.trim(),
    pos: p?.metadata?.position || '',
    team: p?.metadata?.team || '',
    pick_no: p?.pick_no || null,
  }))
  const myCounts = countBy(myRoster, r => r.pos || 'OTHER')

  const rosterReq = summarizeRosterRequirements(league?.roster_positions || [])

  const recPoints =
    league?.scoring_settings && typeof league.scoring_settings.rec === 'number'
      ? league.scoring_settings.rec
      : 0
  const pprType =
    recPoints >= 0.95 ? 'PPR' : recPoints >= 0.45 ? 'Half PPR' : 'Standard/Non-PPR'

  const draftContext = {
    current_pick_number: currentPickNumber,
    rounds: draft?.settings?.rounds ?? draft?.rounds ?? null,
    teams: league?.total_rosters ?? null,
    slot: inferMySlot({ draft, livePicks, me }),
    is_snake: true,
  }

  const isRookie = draftMode === 'rookie'
  const handcuffOpps = isRookie ? [] : findHandcuffs({ myRoster, available })

  // Dynasty-Kader: Positionszählung für AI-Kontext
  const existingRosterCounts = isRookie && Array.isArray(dynastyRoster) && dynastyRoster.length
    ? countBy(dynastyRoster, p => normalizePos(p.pos || 'OTHER'))
    : null

  // Meine Picks in diesem Draft (Rookie)
  const myPicksInDraft = isRookie && Array.isArray(myDraftPicks) && myDraftPicks.length
    ? myDraftPicks.map(p => ({ round: p.round, type: p.type }))
    : null

  return {
    draft_mode: draftMode || 'redraft',
    league: {
      name: league?.name ?? null,
      season: league?.season ?? null,
      roster_positions: league?.roster_positions ?? [],
      roster_requirements: rosterReq,
      ppr_type: pprType,
      scoring_settings: league?.scoring_settings ?? {},
      playoff_start_week: league?.playoff_start_week ?? undefined,
      total_rosters: league?.total_rosters ?? draft?.settings?.teams ?? draft?.teams ?? null,
    },
    draft: {
      ...draftContext,
      ...(myPicksInDraft ? { my_picks: myPicksInDraft } : {}),
    },
    me: { user_id: me },
    my_team: {
      picks: myRoster,
      position_counts: myCounts,
      ...(existingRosterCounts ? { existing_dynasty_roster_counts: existingRosterCounts } : {}),
    },
    board: { overall_top: topOverall, by_position: topByPosition },
    constraints: {
      candidate_pool_hint: {
        overall_size: topOverall.length,
        by_position_keys: Object.keys(topByPosition),
      },
      avoid_nnames: Array.from(pickedByName),
    },
    ...(handcuffOpps.length > 0 ? { handcuff_opportunities: handcuffOpps } : {}),
    timestamp_iso: new Date().toISOString(),
  }
}

// ---------- System prompt ----------

function buildSystemPrompt(draftMode) {
  const shared = [
    'Hard constraints:',
    '- Never recommend a player listed in constraints.avoid_nnames (already picked).',
    '- Only recommend players from board.overall_top or board.by_position.',
    '- Respect context.user_bias: prefer favorites, strongly avoid "avoid" players unless the value gap is extreme.',
    '- If context.custom_strategy is provided, treat it as high-level user guidance and follow it unless it conflicts with hard constraints.',
    'Return your answer by calling tool `return_draft_advice`.',
  ]

  if (draftMode === 'rookie') {
    return [
      'You are a veteran Dynasty Fantasy Football advisor specialized in annual Rookie Drafts on Sleeper.',
      'Task: Recommend the next best rookie pick for the USER given their existing dynasty roster and the current rookie board.',
      ...shared,
      'Rookie Draft specifics:',
      '- All available players are NFL rookies. Prioritize long-term dynasty value over immediate starter impact.',
      '- Key evaluation factors: NFL landing spot (depth chart opportunity), college production, age/athleticism, positional value (WR > RB long-term).',
      '- Picks often land on the Taxi Squad — immediate starter value is NOT required.',
      '- context.my_team.existing_dynasty_roster_counts shows positions already on the dynasty roster. Fill positional weaknesses.',
      '- context.draft.my_picks lists which rounds the user has picks in (some may be traded). Adjust urgency accordingly.',
      '- Bye weeks are irrelevant for dynasty. Do NOT mention bye weeks.',
      '- No handcuff logic applies — skip handcuff reasoning entirely.',
      '- Scarcity: the eligible player pool is small (20–60 players total). Be precise about tier drops.',
    ].join('\n')
  }

  return [
    'You are a veteran Fantasy Football draft advisor specialized in Sleeper drafts.',
    'Task: Recommend the next best pick for the USER given league settings, roster needs, and the provided ranking board.',
    ...shared,
    '- Respect league scoring and roster requirements from context.league.',
    '- Consider positional scarcity, roster balance, and tier pressure; use bye weeks only as tie-breakers.',
    '- In 1-QB leagues, de-emphasize QB before Round 7 unless elite value; in Superflex, prioritize securing QBs.',
    '- Use context.strategies as soft tie-breakers (e.g., Zero RB, Hero RB, Elite TE).',
    '- Handcuffs: if context.handcuff_opportunities lists an available RB backup, consider recommending it in rounds 8+ when roster depth allows.',
  ].join('\n')
}

// ---------- Tool definition (Anthropic format) ----------

function buildAdviceTool() {
  return {
    name: 'return_draft_advice',
    description: 'Return the next-pick recommendation and alternatives for the user based on the provided context.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: {
          type: 'object',
          additionalProperties: false,
          properties: {
            player_nname: { type: 'string', description: 'Normalized name matching board.nname' },
            player_display: { type: 'string', description: 'Human-readable "First Last"' },
            pos: { type: 'string', enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'OTHER'] },
            tier: { type: 'string' },
            rk: { type: 'integer' },
            fit_score: { type: 'number', minimum: 0, maximum: 100 },
            why: { type: 'string', description: 'Short reasoning: fit, scarcity, risk' },
          },
          required: ['player_nname', 'pos', 'why'],
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
              pos: { type: 'string', enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'OTHER'] },
              tier: { type: 'string' },
              rk: { type: 'integer' },
              why: { type: 'string' },
            },
            required: ['player_nname', 'pos', 'why'],
          },
        },
        strategy_notes: {
          type: 'string',
          description: '1-3 short bullets about overall strategy going forward',
        },
        risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['primary', 'alternatives'],
    },
  }
}

// ---------- Public API ----------

/**
 * Builds the Claude-native request payload for /api/ai-advice.
 * Returns { system, messages, tools, tool_choice, max_tokens, temperature }
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
    scoringType,
    scoringSettings,
    rosterPositions,
    strategies = ['balanced'],
    isSuperflex,
    customStrategyText,
    playerPreferences = {},
  } = params || {}

  const { draftMode, dynastyRoster, myDraftPicks } = params || {}
  const context = makeContext({ boardPlayers, livePicks, me, league, draft, currentPickNumber, options, draftMode, dynastyRoster, myDraftPicks })

  context.format = {
    scoring_type:
      scoringType ||
      (typeof league?.scoring_settings?.rec === 'number'
        ? league.scoring_settings.rec >= 0.95
          ? 'ppr'
          : league.scoring_settings.rec >= 0.45
          ? 'half_ppr'
          : 'standard'
        : 'ppr'),
    superflex: !!isSuperflex,
    roster_positions:
      Array.isArray(rosterPositions) && rosterPositions.length
        ? rosterPositions
        : league?.roster_positions || [],
    scoring_settings: scoringSettings || league?.scoring_settings || {},
  }

  context.strategies = Array.isArray(strategies) ? strategies : ['balanced']

  if (customStrategyText && typeof customStrategyText === 'string') {
    context.custom_strategy = String(customStrategyText).slice(0, 4000)
  }

  const { favorites, avoids } = deriveFavAvoid({ boardPlayers, playerPreferences })
  context.user_bias = {
    favorites_nnames: favorites,
    avoids_nnames: avoids,
    weights: {
      fav_bonus: Number.isFinite(options.favBonus) ? options.favBonus : 5,
      avoid_penalty: Number.isFinite(options.avoidPenalty) ? options.avoidPenalty : 8,
    },
  }

  return {
    system: buildSystemPrompt(draftMode),
    messages: [
      {
        role: 'user',
        content: `Use the following structured context to recommend the next pick:\n<CONTEXT_JSON>\n${JSON.stringify(context)}\n</CONTEXT_JSON>`,
      },
    ],
    tools: [buildAdviceTool()],
    tool_choice: { type: 'tool', name: 'return_draft_advice' },
    max_tokens: 1024,
    temperature: options.temperature ?? 0.2,
  }
}
