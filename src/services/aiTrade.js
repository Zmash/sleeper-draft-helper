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

export function buildTradeAnalysisRequest({
  tradeGive, tradeGet, evalResult, dynastyRoster, league,
  managerGiveRoster, managerGetRoster,
}) {
  const { totalGive, totalGet, ratio, verdict, profile, avgAge } = evalResult

  const scoringRec = Number(league?.scoring_settings?.rec ?? 1)
  const scoringType = scoringRec >= 0.95 ? 'PPR' : scoringRec >= 0.45 ? '0.5 PPR' : 'Standard'
  const isSuperflex = (league?.roster_positions || []).some(r => String(r).toUpperCase().includes('SUPER'))

  // Fallback starters from dynastyRoster when no manager roster available
  const fallbackStarters = (dynastyRoster || [])
    .filter(p => p.slot === 'starter')
    .map(p => `${p.pos} ${p.name}${p.age ? ` (${p.age}y)` : ''}`)
    .join(', ') || '—'

  const context = {
    league: {
      format: 'dynasty',
      scoring: scoringType,
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

  const system = `You are an experienced Dynasty Fantasy Football analyst. Analyze the trade from the user's perspective ("you give" / "you receive").

Rules:
- Use ONLY the provided dynasty_values.
- Do NOT overvalue future picks.
- Consider the roster strengths and needs of both teams.
- Factor in the team profile (Contender vs. Rebuild).
- Always respond in English.`

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
