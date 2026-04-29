// src/services/aiDraftReviewClient.js
import { getOpenAIKey } from './key'

/**
 * Builds the context object sent to the AI for draft review.
 */
export function buildDraftReviewContext({
  league,
  picks,
  teamByRosterId,
  ownerLabels,
  myOwnerId,
  myRosterId,
  board,
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
        tier: p.tier ?? null, rk: p.rk ?? null,
      })),
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
      last_name: p?.metadata?.last_name || '',
      position: p?.metadata?.position || '',
      team: p?.metadata?.team || '',
    },
  }))

  return {
    league: safeLeague,
    picks: safePicks,
    rosters,
    my: { owner_id: String(myOwnerId), roster_id: String(myRosterId) },
    board: board ? {
      meta: board.metadata || {},
      players: (board.players || []).slice(0, 500).map(p => ({
        id: p.id, name: p.name, pos: p.pos, team: p.team, bye: p.bye,
        tier: p.tier ?? null, rk: p.rk ?? null,
      })),
    } : null,
  }
}

/**
 * Builds the Claude-native payload for /api/ai-draft-review.
 * Server injects REVIEW_TOOL + tool_choice automatically.
 */
export function buildDraftReviewPayload(context, { temperature = 0.3 } = {}) {
  const system = [
    'You are a meticulous NFL fantasy draft analyst.',
    'Be concise, precise, and actionable.',
    'Rank strictly (1 = best), scores 0–100 monotonic with ranks.',
    'Ground statements in the provided context; avoid fabrications.',
    'League is Half-PPR unless scoring settings say otherwise.',
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
    system,
    messages: [{ role: 'user', content: user }],
    temperature,
    max_tokens: 4096,
  }
}

// ---------- SSE stream reader (shared) ----------

async function readSSEResult(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let lastError = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.trim()) continue
      const lines = part.split('\n')
      const eventLine = lines.find(l => l.startsWith('event: '))
      const dataLine = lines.find(l => l.startsWith('data: '))
      if (!dataLine) continue

      const eventType = eventLine?.slice(7).trim() || 'message'
      let data
      try { data = JSON.parse(dataLine.slice(6)) } catch { continue }

      if (eventType === 'result') {
        if (!data.ok) lastError = data.error || data.message || 'Review failed'
        else result = data.parsed
      } else if (eventType === 'error') {
        lastError = data.message || 'AI error'
      }
    }
  }

  if (lastError) throw new Error(lastError)
  if (!result) throw new Error('No result received from AI')
  return result
}

/**
 * Calls /api/ai-draft-review and returns the parsed review object.
 */
export async function callAiDraftReview(payload) {
  const key = getOpenAIKey()
  if (!key) throw new Error('No Anthropic API key present')

  const res = await fetch('/api/ai-draft-review', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-anthropic-key': key,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`)
  }

  return readSSEResult(res)
}
