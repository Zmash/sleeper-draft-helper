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
  draftMode,
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
      players: (board.players || []).slice(0, 300).map(p => ({
        name: p.name, pos: p.pos, team: p.team, rk: p.rk ?? null, tier: p.tier ?? null,
      })),
    } : null,
    draft_mode: draftMode || 'redraft',
  }
}

/**
 * Builds the Claude-native payload for /api/ai-draft-review.
 * Server injects REVIEW_TOOL + tool_choice automatically.
 */
export function buildDraftReviewPayload(context, { temperature = 0.3, format = null } = {}) {
  const fmtLine = format
    ? `Liga-Format: ${format.scoringType}, ${format.teams} Teams, Superflex: ${format.isSuperflex ? 'ja' : 'nein'}.`
    : 'Liga-Format: siehe scoring_settings im Kontext.'
  const system = [
    'Du bist ein akribischer Fantasy-Football-Draft-Analyst.',
    'Alle Freitexte auf Deutsch (du-Form). Sei praezise und handlungsorientiert.',
    'Ranke strikt (1 = am besten), Scores 0-100 monoton zu den Raengen.',
    'Stuetze jede Aussage auf den mitgelieferten Kontext; erfinde nichts.',
    // Team-Benennung: Jedes Roster hat eine owner_id UND einen display_name.
    // Teams intern per owner_id fuehren, aber im Text immer per display_name benennen.
    'Jedes Roster im Kontext hat eine owner_id und einen menschenlesbaren display_name.',
    'Identifiziere Teams intern ueber die owner_id, benenne sie aber IMMER mit ihrem display_name',
    '(in teamId steckt die owner_id, in displayName der display_name; im Freitext gilt der display_name).',
    'Zeige die rohe owner_id nie im Text (overallSummary, teamOneLiners, myTeamDeepDive, steals, reaches).',
    fmtLine,
    context?.draft_mode === 'rookie'
      ? 'Rookie-Draft: bewerte Value gegen den Board-Rang, nicht gegen ADP.'
      : '',
  ].filter(Boolean).join(' ')

  const user = `Erzeuge aus dem folgenden CONTEXT_JSON:
- overallRankings (strikt 1..N, score 0-100),
- teamOneLiners (eine Zeile je Team),
- overallSummary (knapp),
- myTeamDeepDive (grade, strengths, weaknesses, risks, recommendedMoves, longText),
- steals (bester Value, mit Begruendung),
- reaches (schlechtester Value, mit Begruendung),
- lessonsForNextMock (2-4 konkrete Learnings fuer den naechsten Mock; evidence MUSS sich auf konkrete Picks/Raenge aus dem Kontext beziehen).

<CONTEXT_JSON>
${JSON.stringify(context)}
</CONTEXT_JSON>`

  return { system, messages: [{ role: 'user', content: user }], temperature, max_tokens: 4096 }
}

// ---------- SSE stream reader (shared) ----------

async function readSSEResult(response) {
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let lastUsage = null
  let lastModel = null
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
        else {
          result = data.parsed
          lastUsage = data.usage || null
          lastModel = data.model || null
        }
      } else if (eventType === 'error') {
        lastError = data.message || 'AI error'
      }
    }
  }

  if (lastError) throw new Error(lastError)
  if (!result) throw new Error('No result received from AI')
  return { parsed: result, usage: lastUsage, model: lastModel }
}

/**
 * Calls /api/ai-draft-review and returns { parsed, usage, model }.
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
