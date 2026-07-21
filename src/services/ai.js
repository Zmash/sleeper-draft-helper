// src/services/ai.js
// Builds Claude API payload for the next-pick advice endpoint.
// Output format: { system, messages, tools, tool_choice, max_tokens, temperature }

import { normalizePlayerName, normalizePos } from '../utils/formatting'
import { detectRuns, opponentsUntilMyNext, snakeSlotForPick } from './draftFlow'

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
    // Snake-bewusst: liegt der erste eigene Pick in einer geraden Runde,
    // waere die lineare Position in der Runde der gespiegelte (falsche) Slot.
    return snakeSlotForPick(pick1, teams)
  } catch { return null }
}

function minifyBoardPlayer(p, isRookie = false) {
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
  // adp kommt aus dem Markt-Merge (FFC) und ist im Redraft das zentrale Signal.
  // ecrVsAdp traegt es nur beim CSV-Import — ohne adp beriet die AI auf einem
  // Markt-Board voellig ohne Marktbezug. null heisst "kein Marktwert", nicht 0.
  if (p.adp != null) base.adp = p.adp
  if (p.high != null) base.high = p.high
  if (p.low != null) base.low = p.low
  if (p.stdev != null) base.stdev = p.stdev
  // Das Feld heisst historisch dynasty_value, traegt im Redraft aber den
  // FantasyCalc-Redraft-Wert (isDynasty=false). Unter dem alten Namen schrieb
  // die AI woertlich "elite dynasty value" ueber einen Redraft-Mock.
  if (p.dynasty_value != null) {
    if (isRookie) base.dynasty_value = p.dynasty_value
    else base.market_value = p.dynasty_value
  }
  if (p.age != null) base.age = p.age
  if (p.years_exp != null) base.years_exp = p.years_exp
  return base
}

const PPR_TYPE_LABEL = { ppr: 'PPR', half_ppr: 'Half PPR', standard: 'Standard/Non-PPR' }

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

function makeContext({ boardPlayers, livePicks, me, league, draft, currentPickNumber, options, draftMode, dynastyRoster, myDraftPicks, scoringType, draftSlot, tips }) {
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

  const isRookie = draftMode === 'rookie'

  // Nicht .map(minifyBoardPlayer): map reicht den Index als zweites Argument
  // durch, wodurch jeder Spieler ab Index 1 als Rookie gaelte.
  const topOverall = available.slice(0, topNOverall).map(p => minifyBoardPlayer(p, isRookie))
  const byPos = groupBy(available, p => normalizePos(p.pos || 'OTHER'))
  const topByPosition = Object.fromEntries(
    Object.entries(byPos).map(([pos, arr]) => [pos, arr.slice(0, topPerPos).map(p => minifyBoardPlayer(p, isRookie))])
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

  // Das aufgeloeste Draft-Format hat Vorrang vor der Liga: beim Standalone-Mock
  // gibt es gar keine scoring_settings, und ein Setup-Override soll die Liga
  // schlagen. Sonst meldete league.ppr_type "Standard/Non-PPR", waehrend
  // format.scoring_type im selben Payload 'ppr' sagte.
  const recPoints =
    league?.scoring_settings && typeof league.scoring_settings.rec === 'number'
      ? league.scoring_settings.rec
      : 0
  const pprType =
    PPR_TYPE_LABEL[scoringType] ||
    (recPoints >= 0.95 ? 'PPR' : recPoints >= 0.45 ? 'Half PPR' : 'Standard/Non-PPR')

  // currentPickNumber ist der hoechste BEREITS gemachte Pick. Unter dem Namen
  // current_pick_number beriet die AI konsequent fuer genau diesen — also einen
  // Pick zu frueh. Der Name sagt jetzt, was gemeint ist. null bleibt null:
  // lieber keine Angabe als eine erfundene (Number(null) + 1 === 1).
  const upcomingPick = Number.isFinite(currentPickNumber) && currentPickNumber != null
    ? currentPickNumber + 1
    : null

  const teamsForMath = league?.total_rosters ?? draft?.settings?.teams ?? draft?.teams ?? null
  const draftType = String(draft?.type || 'snake').toLowerCase()
  const isSnake = draftType === 'snake'
  // draftSlot (aus App.jsx) schlaegt die Pick-Ableitung — die kennt den Slot
  // erst nach dem ersten eigenen Pick.
  const mySlot = draftSlot != null ? Number(draftSlot) : inferMySlot({ draft, livePicks, me })

  const opponents = isSnake
    ? opponentsUntilMyNext({
        picks: livePicks, teamsCount: teamsForMath, mySlot,
        upcomingPick, rosterPositions: league?.roster_positions || [],
      })
    : null

  const draftContext = {
    upcoming_pick_number: upcomingPick,
    completed_picks: Number.isFinite(currentPickNumber) ? currentPickNumber : null,
    my_slot: mySlot,
    my_next_pick_number: opponents?.my_next_pick ?? null,
    picks_until_my_next: opponents && upcomingPick != null ? opponents.my_next_pick - upcomingPick : null,
    draft_type: draftType,
    is_snake: isSnake,
    rounds: draft?.settings?.rounds ?? draft?.rounds ?? null,
    teams: teamsForMath,
  }

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
    draft_flow: detectRuns(livePicks),
    ...(opponents ? { opponents_before_my_next: opponents } : {}),
    me: { user_id: me },
    my_team: {
      picks: myRoster,
      position_counts: myCounts,
      bye_weeks: (() => {
        const byes = {}
        for (const p of boardPlayers || []) {
          if (p?.status !== 'me' || p?.bye == null) continue
          const b = Number(p.bye)
          if (Number.isFinite(b)) byes[b] = (byes[b] || 0) + 1
        }
        return byes
      })(),
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
    ...(Array.isArray(tips) && tips.length
      ? { tips_signals: tips.slice(0, 7).map(t => ({ type: t.type, text: t.text })) }
      : {}),
    timestamp_iso: new Date().toISOString(),
  }
}

// ---------- System prompt ----------

function buildSystemPrompt(draftMode) {
  const shared = [
    'Harte Regeln:',
    '- Alle Freitext-Felder (why, tradeoff_vs_primary, reason, note, strategy_notes) auf Deutsch, du-Form.',
    '- Empfiehl niemals Spieler aus constraints.avoid_nnames (bereits gepickt).',
    '- Nur Spieler aus board.overall_top oder board.by_position nennen — auch in plan_next_picks.',
    '- survival: Begruendung ausschliesslich aus high/low/adp des Spielers und opponents_before_my_next. Keine erfundenen Faktoren.',
    '- plan_next_picks: nutze draft.my_next_pick_number und die folgenden eigenen Picks; beruecksichtige opponents_before_my_next (wer schnappt was weg?) und my_team.bye_weeks.',
    '- Wenn draft_flow.run gesetzt ist, erklaere in run_alert, was der Run fuer diesen Pick bedeutet — sonst run_alert weglassen.',
    '- tips_signals sind Heuristik-Hinweise der App: bestaetige oder widersprich ihnen explizit, statt sie zu ignorieren.',
    '- Respektiere context.user_bias (Favoriten bevorzugen, Avoids nur bei extremem Value).',
    '- Wenn context.custom_strategy existiert, folge ihr, solange sie den harten Regeln nicht widerspricht.',
    'Antworte durch Aufruf des Tools `return_draft_advice`.',
  ]

  if (draftMode === 'rookie') {
    return [
      'Du bist ein erfahrener Dynasty-Fantasy-Football-Berater, spezialisiert auf Rookie-Drafts bei Sleeper.',
      'Aufgabe: Empfiehl den naechsten Rookie-Pick unter Beruecksichtigung des bestehenden Dynasty-Kaders.',
      ...shared,
      'Rookie-Spezifika:',
      '- Alle verfuegbaren Spieler sind NFL-Rookies. Langfristiger Dynasty-Wert schlaegt Sofort-Impact.',
      '- Bewertungsfaktoren: Landing Spot (Depth Chart), College-Produktion, Alter/Athletik, Positionswert (WR > RB langfristig).',
      '- Picks landen oft auf dem Taxi Squad — Sofort-Starter-Wert ist NICHT noetig.',
      '- my_team.existing_dynasty_roster_counts zeigt den Bestand: fuelle Positions-Schwaechen.',
      '- draft.my_picks zeigt, in welchen Runden du Picks hast — passe die Dringlichkeit an.',
      '- Bye-Weeks sind irrelevant, erwaehne sie nicht. Kein Handcuff-Denken.',
      '- Der Pool ist klein (20-60 Spieler): sei praezise bei Tier-Abbruechen.',
    ].join('\n')
  }

  return [
    'Du bist ein erfahrener Fantasy-Football-Draft-Berater, spezialisiert auf Sleeper-Drafts.',
    'Aufgabe: Empfiehl den naechsten Pick fuer den Nutzer — mit echtem Vergleich der Alternativen, nicht nur einer Nennung.',
    ...shared,
    '- Respektiere Scoring und Kaderanforderungen aus context.league und context.format.',
    '- Positionsknappheit, Kader-Balance und Tier-Druck zaehlen; Byes nur als Tie-Breaker.',
    '- In 1-QB-Ligen QB vor Runde 7 abwerten (ausser Elite-Value); in Superflex QBs priorisieren.',
    '- context.strategies sind weiche Tie-Breaker (Zero RB, Hero RB, Elite TE).',
    '- Handcuffs aus handcuff_opportunities ab Runde 8 erwaegen, wenn die Kadertiefe es erlaubt.',
  ].join('\n')
}

// ---------- Tool definition (Anthropic format) ----------

function buildAdviceTool() {
  const playerCore = {
    player_nname: { type: 'string', description: 'Normalisierter Name, exakt wie board.nname' },
    player_display: { type: 'string' },
    pos: { type: 'string', enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'OTHER'] },
    rk: { type: 'integer' },
  }
  return {
    name: 'return_draft_advice',
    description: 'Naechster-Pick-Empfehlung mit Vergleich, Survival-Einschaetzung und Plan fuer die kommenden eigenen Picks.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: {
          type: 'object', additionalProperties: false,
          properties: {
            ...playerCore,
            fit_score: { type: 'number', minimum: 0, maximum: 100 },
            why: { type: 'string', description: 'Begruendung auf Deutsch (du-Form): Fit, Knappheit, Risiko' },
          },
          required: ['player_nname', 'pos', 'why'],
        },
        alternatives: {
          type: 'array', minItems: 2, maxItems: 4,
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              ...playerCore,
              why: { type: 'string', description: 'Deutsch (du-Form)' },
              tradeoff_vs_primary: { type: 'string', description: 'Was gebe ich auf, wenn ich stattdessen primary nehme? Deutsch (du-Form)' },
            },
            required: ['player_nname', 'pos', 'why', 'tradeoff_vs_primary'],
          },
        },
        survival: {
          type: 'array',
          description: 'Je ein Eintrag fuer primary und jede Alternative: ueberlebt der Spieler bis my_next_pick_number?',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              player_nname: { type: 'string' },
              verdict: { type: 'string', enum: ['duerfte_da_sein', 'muenzwurf', 'duerfte_weg_sein'] },
              reason: { type: 'string', description: 'Nur aus high/low/adp und den Gegner-Luecken begruenden. Deutsch (du-Form)' },
            },
            required: ['player_nname', 'verdict', 'reason'],
          },
        },
        plan_next_picks: {
          type: 'array', maxItems: 3,
          description: 'Plan fuer die naechsten eigenen Picks (Pick-Nummern aus dem Kontext).',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              pick_number: { type: 'integer' },
              target_positions: { type: 'array', items: { type: 'string' } },
              candidate_nnames: { type: 'array', items: { type: 'string' } },
              note: { type: 'string', description: 'Deutsch (du-Form)' },
            },
            required: ['pick_number', 'target_positions', 'note'],
          },
        },
        run_alert: {
          type: 'object', additionalProperties: false,
          description: 'Nur setzen, wenn draft_flow.run gesetzt ist.',
          properties: {
            pos: { type: 'string' },
            note: { type: 'string', description: 'Deutsch (du-Form)' },
          },
          required: ['pos', 'note'],
        },
        strategy_notes: { type: 'string', description: '1-3 kurze Punkte, Deutsch (du-Form)' },
        risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['primary', 'alternatives', 'survival', 'plan_next_picks'],
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
    draftSlot = null,
    tips,
  } = params || {}

  const { draftMode, dynastyRoster, myDraftPicks } = params || {}
  const context = makeContext({ boardPlayers, livePicks, me, league, draft, currentPickNumber, options, draftMode, dynastyRoster, myDraftPicks, scoringType, draftSlot, tips })

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
      fav_bonus: Number.isFinite(options.favBonus) ? options.favBonus
        : Number.isFinite(params?.favBonus) ? params.favBonus : 5,
      avoid_penalty: Number.isFinite(options.avoidPenalty) ? options.avoidPenalty
        : Number.isFinite(params?.avoidPenalty) ? params.avoidPenalty : 8,
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
    max_tokens: 2000,
    temperature: options.temperature ?? 0.2,
  }
}
