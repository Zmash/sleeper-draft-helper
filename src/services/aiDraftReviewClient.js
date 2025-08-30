// src/services/aiDraftReviewClient.js
import { getOpenAIKey } from './key'

/**
 * Minimal sparsam: nur das Nötigste für die AI.
 * Erwartete Inputs kommen aus deinem State (siehe Integration unten).
 */
export function buildDraftReviewContext({
  league,
  picks,
  teamByRosterId,
  ownerLabels,
  myOwnerId,
  myRosterId,
  board, // optional: { players:[], metadata:{} }
}) {
  const rosters = {}
  for (const [rid, r] of Object.entries(teamByRosterId || {})) {
    const ownerId = String(r.owner_id)
    const display = ownerLabels?.get?.(ownerId) || ownerLabels?.[ownerId] || ownerId
    rosters[rid] = {
      owner_id: ownerId,
      display_name: display,
      players: (r.players || []).map(p => ({
        id: p.id, name: p.name, pos: p.pos, team: p.team, bye: p.bye,
        tier: p.tier ?? null, rk: p.rk ?? null
      }))
    }
  }

  const safeLeague = league ? {
    league_id: league.league_id,
    name: league.name,
    total_rosters: league.total_rosters,
    roster_positions: league.roster_positions,
    scoring_settings: league.scoring_settings,
    draft_order: league.draft_order,
  } : null

  const safePicks = (picks || []).map(p => ({
    pick_no: p.pick_no,
    round: p.round,
    picked_by: p.picked_by,
    metadata: {
      first_name: p?.metadata?.first_name || '',
      last_name:  p?.metadata?.last_name  || '',
      position:   p?.metadata?.position   || '',
      team:       p?.metadata?.team       || ''
    }
  }))

  const ctx = {
    league: safeLeague,
    picks: safePicks,
    rosters,
    my: { owner_id: String(myOwnerId), roster_id: String(myRosterId) },
    board: board ? {
      meta: board.metadata || {},
      players: (board.players || []).slice(0, 500).map(p => ({
        id: p.id, name: p.name, pos: p.pos, team: p.team, bye: p.bye, tier: p.tier ?? null, rk: p.rk ?? null
      }))
    } : null
  }

  return ctx
}

/**
 * Baut das Chat-Payload. Der Server injiziert Tool-Schema + tool_choice.
 */
export function buildDraftReviewPayload(context, {
  model = 'gpt-4o-mini',
  temperature = 0.3
} = {}) {
  const system = [
    'You are a meticulous NFL fantasy draft analyst.',
    'Be concise, precise, and actionable.',
    'Rank strictly (1 = best), scores 0–100 monotonic with ranks.',
    'Ground statements in the provided context; avoid fabrications.',
    'League is Half-PPR unless scoring settings say otherwise.'
  ].join(' ')

  const user = `Using the following structured CONTEXT_JSON, produce:
- overallRankings (strict 1..N, with score 0–100),
- teamOneLiners (1 line per team),
- overallSummary (concise),
- myTeamDeepDive (grade, strengths, weaknesses, risks, recommendedMoves, longText),
- steals (top value vs board/consensus, with rationale),
- reaches (worst value vs board/consensus, with rationale),
- myWeek1StartSit (for the user team only: starters, sits, notes).

<CONTEXT_JSON>
${JSON.stringify(context)}
</CONTEXT_JSON>`

  return {
    model,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    // keine Tools hier – Server hängt REVIEW_TOOL + tool_choice dran
  }
}

/**
 * Ruft /api/ai-draft-review mit X-OpenAI-Key auf.
 */
export async function callAiDraftReview(payload) {
  const key = getOpenAIKey()
  if (!key) throw new Error('No OpenAI key present')

  const res = await fetch('/api/ai-draft-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-openai-key': key,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || json?.message || `HTTP ${res.status}`)
  }
  return json.parsed // strukturiertes JSON vom Function-Tool
}
