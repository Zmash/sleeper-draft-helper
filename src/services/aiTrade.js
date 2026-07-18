import { deriveFormat } from './draftFormat'

const SCORING_LABEL = { ppr: 'PPR', half_ppr: '0.5 PPR', standard: 'Standard' }

// settings.type ist eine Zahl (0=redraft, 1=keeper, 2=dynasty) — nie gegen
// String-Literale vergleichen (siehe CLAUDE.md).
function deriveLeagueContext(league) {
  const leagueType = Number(league?.settings?.type)
  const format = leagueType === 2 ? 'dynasty' : 'redraft'
  const keeper = leagueType === 1
  const scoringType = deriveFormat({ league }).scoringType
  const scoring = SCORING_LABEL[scoringType] || scoringType
  const isSuperflex = (league?.roster_positions || []).some(r => String(r).toUpperCase().includes('SUPER'))
  return { format, keeper, scoring, isSuperflex }
}

export const TRADE_TOOL = {
  name: 'return_trade_analysis',
  description: 'Structured dynasty trade analysis with verdict, reasoning and recommendation.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['you_win', 'fair', 'you_lose'],
        description: 'Overall trade verdict from your perspective',
      },
      summary: {
        type: 'string',
        description: '2-3 sentence plain-text summary of the trade',
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Reasons this trade benefits you (1-3 points)',
      },
      concerns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Risks or downsides if you accept (0-3 points)',
      },
      best_case: {
        type: 'string',
        description: 'Best-case scenario if you accept this trade',
      },
      worst_case: {
        type: 'string',
        description: 'Worst-case scenario if you accept this trade',
      },
      recommendation: {
        type: 'string',
        enum: ['accept', 'decline', 'counter'],
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in recommendation (0–1)',
      },
    },
    required: ['verdict', 'summary', 'strengths', 'concerns', 'recommendation', 'confidence'],
  },
}

function formatItem(item) {
  if (item.type === 'pick') {
    return { type: 'pick', label: item.label, dynasty_value: item.dynasty_value, adjusted_value: item.adjusted_value }
  }
  return {
    type: 'player', name: item.name, pos: item.pos, age: item.age || null,
    dynasty_value: item.dynasty_value, adjusted_value: item.adjusted_value,
  }
}

function formatRosterSummary(players) {
  if (!players?.length) return []
  return players
    .filter(p => p.dynasty_value > 0)
    .sort((a, b) => (b.dynasty_value || 0) - (a.dynasty_value || 0))
    .slice(0, 12)
    .map(p => `${p.pos} ${p.name}${p.age ? ` (${p.age}y)` : ''}: ${p.dynasty_value}`)
}

function formatPickSummary(picks) {
  return (picks || []).map(p => `${p.label}: ${p.dynasty_value}`)
}

// ── Trade Suggestions ─────────────────────────────────────────────────────────

export const TRADE_SUGGESTIONS_TOOL = {
  name: 'return_trade_suggestions',
  description: 'Return 2–4 specific, fair dynasty trade proposals for the user.',
  input_schema: {
    type: 'object',
    properties: {
      team_summary: {
        type: 'string',
        description: 'Brief analysis of the user\'s roster strengths, weaknesses, and primary trade needs (2–3 sentences).',
      },
      suggestions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            opponent:       { type: 'string', description: 'Display name of the trade partner' },
            you_give:       { type: 'array', items: { type: 'string' }, description: 'Exact player/pick names you send' },
            you_get:        { type: 'array', items: { type: 'string' }, description: 'Exact player/pick names you receive' },
            value_you_give: { type: 'number', description: 'Combined dynasty value of what you give' },
            value_you_get:  { type: 'number', description: 'Combined dynasty value of what you receive' },
            rationale:      { type: 'string', description: 'Why both teams benefit — 2–3 sentences' },
          },
          required: ['opponent', 'you_give', 'you_get', 'rationale'],
        },
      },
    },
    required: ['team_summary', 'suggestions'],
  },
}

export function buildTradeSuggestionsRequest({ myRoster, enrichedRosters, myRosterId, league, profile }) {
  const { format, keeper, scoring, isSuperflex } = deriveLeagueContext(league)

  function compactRoster(data, maxPlayers) {
    const players = (data.players || [])
      .filter(p => p.dynasty_value > 0)
      .sort((a, b) => b.dynasty_value - a.dynasty_value)
      .slice(0, maxPlayers)
      .map(p => `${p.pos} ${p.name}${p.age ? ` (${p.age}y)` : ''}: ${p.dynasty_value}`)
    const picks = (data.picks || [])
      .slice(0, 6)
      .map(p => `${p.label}: ${p.dynasty_value}`)
    return { players, picks }
  }

  // Position depth map for my team
  const posDepth = {}
  for (const p of myRoster.players || []) {
    if (p.pos) posDepth[p.pos] = (posDepth[p.pos] || 0) + 1
  }

  const myData = compactRoster(myRoster, 15)

  const opponents = Object.entries(enrichedRosters || {})
    .filter(([rid]) => rid !== myRosterId)
    .map(([, data]) => ({ name: data.displayName, ...compactRoster(data, 8) }))

  const context = {
    league: { format, ...(keeper ? { keeper: true } : {}), scoring, superflex: isSuperflex, teams: league?.total_rosters || null },
    my_team: {
      name: myRoster.displayName,
      profile,
      position_depth: posDepth,
      top_players: myData.players,
      available_picks: myData.picks,
    },
    other_teams: opponents,
    value_scale: 'dynasty_value on 0–10000 scale (FantasyCalc).',
    instruction: 'Propose 2–4 FAIR trades (value within ±10%). Use ONLY names from the provided roster data. Each trade must address a real positional need for both sides.',
  }

  const system = `Du bist ein erfahrener Fantasy-Football-Analyst (${format === 'dynasty' ? 'Dynasty' : 'Redraft'}). Identifiziere kluge, fuer beide Seiten vorteilhafte Trade-Moeglichkeiten.

Regeln:
- Schlage nur Trades vor, von denen beide Teams wirklich profitieren.
- Halte den Wert ausgeglichen — innerhalb von ±10 % des Gesamtwerts.
- Nutze AUSSCHLIESSLICH Spieler- und Pick-Namen aus den mitgelieferten Daten.
- Beruecksichtige positionellen Ueberschuss/Bedarf auf beiden Seiten.
- Beziehe das Team-Profil ein (Contender vs. Rebuild).
- Alle Freitexte auf Deutsch (du-Form).`

  return {
    system,
    messages: [{ role: 'user', content: `Suggest fair trades for my team:\n\n${JSON.stringify(context, null, 2)}` }],
    tools: [TRADE_SUGGESTIONS_TOOL],
    tool_choice: { type: 'tool', name: 'return_trade_suggestions' },
    max_tokens: 2500,
    temperature: 0.35,
  }
}

export function buildTradeAnalysisRequest({
  tradeGive, tradeGet, evalResult, dynastyRoster, league,
  managerGiveRoster, managerGetRoster,
}) {
  const { totalGive, totalGet, ratio, verdict, profile, avgAge } = evalResult

  const { format, keeper, scoring, isSuperflex } = deriveLeagueContext(league)

  // Fallback starters from dynastyRoster when no manager roster available
  const fallbackStarters = (dynastyRoster || [])
    .filter(p => p.slot === 'starter')
    .map(p => `${p.pos} ${p.name}${p.age ? ` (${p.age}y)` : ''}`)
    .join(', ') || '—'

  const context = {
    league: {
      format,
      ...(keeper ? { keeper: true } : {}),
      scoring,
      superflex: isSuperflex,
      teams: league?.total_rosters || null,
    },
    your_team: {
      name: managerGiveRoster?.displayName || 'Your Team',
      profile,
      avg_starter_age: avgAge ? Number(avgAge.toFixed(1)) : null,
      profile_note:
        profile === 'contender'
          ? 'Contender — Winning now matters more than future assets.'
          : profile === 'rebuild'
          ? 'Rebuild — Youth and picks matter more than immediate wins.'
          : 'Balanced team.',
      top_players: managerGiveRoster
        ? formatRosterSummary(managerGiveRoster.players)
        : [fallbackStarters],
      available_picks: managerGiveRoster ? formatPickSummary(managerGiveRoster.picks) : [],
    },
    opponent_team: managerGetRoster ? {
      name: managerGetRoster.displayName,
      top_players: formatRosterSummary(managerGetRoster.players),
      available_picks: formatPickSummary(managerGetRoster.picks),
    } : null,
    trade: {
      you_give: tradeGive.map(formatItem),
      you_get: tradeGet.map(formatItem),
      total_value_you_give: totalGive,
      total_value_you_get: totalGet,
      algorithmic_verdict: verdict,
      value_ratio: ratio !== null ? Number(ratio.toFixed(2)) : null,
    },
    value_scale_note: 'dynasty_value on 0–10000 scale (FantasyCalc). adjusted_value includes team profile modifier.',
    instruction: 'Do NOT overvalue future picks. Use ONLY the provided values. Consider the roster context of both teams.',
  }

  const system = `Du bist ein erfahrener Fantasy-Football-Analyst (${format === 'dynasty' ? 'Dynasty' : 'Redraft'}). Analysiere den Trade aus Sicht des Nutzers ("you give" / "you receive").

Regeln:
- Nutze AUSSCHLIESSLICH die mitgelieferten Werte (dynasty_value/adjusted_value).
- Ueberbewerte zukuenftige Picks nicht.
- Beruecksichtige Kaderstaerken und Beduerfnisse beider Teams.
- Beziehe das Team-Profil ein (Contender vs. Rebuild).
- Alle Freitexte auf Deutsch (du-Form).`

  return {
    system,
    messages: [{
      role: 'user',
      content: `Analyze this dynasty trade:\n\n${JSON.stringify(context, null, 2)}`,
    }],
    tools: [TRADE_TOOL],
    tool_choice: { type: 'tool', name: 'return_trade_analysis' },
    max_tokens: 1600,
    temperature: 0.25,
  }
}
