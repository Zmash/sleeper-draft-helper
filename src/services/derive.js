export function getTeamsCount({ draft = null, picks = [], league = null }) {
  // 1) Draft ist König
  const fromDraft =
    (draft?.settings && Number(draft.settings.teams)) ||
    (Number(draft?.teams)) ||
    null
  if (Number.isFinite(fromDraft) && fromDraft > 0) return fromDraft

  // 2) Aus Picks ableiten (Mock-sicher)
  if (Array.isArray(picks) && picks.length) {
    // a) Distinct draft_slot
    const slots = new Set()
    for (const p of picks) {
      const ds = Number(p?.draft_slot)
      if (Number.isFinite(ds)) slots.add(ds)
    }
    if (slots.size > 0) return slots.size

    // b) Fallback: Anzahl Picks in der ersten vorkommenden Runde
    const rounds = picks.map(p => Number(p?.round)).filter(Number.isFinite)
    if (rounds.length) {
      const minRound = Math.min(...rounds)
      const inFirst = picks.filter(p => Number(p?.round) === minRound).length
      if (inFirst > 0) return inFirst
    }
  }

  // 3) League zuletzt
  const fromLeague = Number(league?.total_rosters || league?.league_size || null)
  if (Number.isFinite(fromLeague) && fromLeague > 0) return fromLeague

  // 4) Unbekannt
  return null
}

export function formatRoundPick(pickNo, teamsCount) {
  const pick = Number(pickNo)
  const teams = Number(teamsCount)
  if (!Number.isFinite(pick) || !Number.isFinite(teams) || teams <= 0) return null
  const round = Math.ceil(pick / teams)
  const inRound = ((pick - 1) % teams) + 1
  return `${round}.${inRound}`
}
