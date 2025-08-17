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

export function currentPickNumber(picks = []) {
  let max = 0
  for (const p of picks || []) {
    const n = Number(p?.pick_no || p?.pick)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max
}

export function picksUntilMyNext({ picks = [], meUserId = '', teamsCount = 12, draftSlot = null }) {
  const cur = currentPickNumber(picks)
  if (!Number.isFinite(cur) || !Number.isFinite(teamsCount) || teamsCount <= 0) return null

  let mySlot = Number(draftSlot)
  if (!Number.isFinite(mySlot)) {
    // fall back: infer from earliest pick by me
    const mine = (picks || []).filter(p => String(p?.picked_by) === String(meUserId))
    if (!mine.length) return null
    const earliest = mine.reduce((a,b) => (a.pick_no < b.pick_no ? a : b))
    const pickNo = Number(earliest?.pick_no)
    if (!Number.isFinite(pickNo)) return null
    const round = Math.ceil(pickNo / teamsCount)
    const inRound = ((pickNo - 1) % teamsCount) + 1
    mySlot = (round % 2 === 1) ? inRound : (teamsCount - inRound + 1)
  }

  const round = Math.ceil(cur / teamsCount)
  const inRound = ((cur - 1) % teamsCount) + 1
  const goingDown = (round % 2 === 0)
  const myInRound = goingDown ? (teamsCount - mySlot + 1) : mySlot

  const leftThisRound = myInRound - inRound - 1
  if (leftThisRound >= 0) return leftThisRound

  // next round distance
  const toEnd = teamsCount - inRound
  const nextInRound = (!goingDown) ? (teamsCount - mySlot + 1) : mySlot
  return toEnd + (nextInRound - 1)   // <- eigenes Pick nicht mitzählen
}

// --- ADD: export countStarters (used by tips logic) ---
export function countStarters(rosterPositions = []) {
  // Counts required starters per position based on roster slots.
  // Supports FLEX and SUPER_FLEX as capacity that can be filled by other positions.
  const req = { QB: 0, RB: 0, WR: 0, TE: 0, FLEX: 0, SUPER_FLEX: 0 }

  for (const slot of rosterPositions || []) {
    const s = String(slot || '').toUpperCase()

    // Direct position slots
    if (req[s] != null) req[s] += 1

    // Common flexible slots
    if (s === 'RB/WR/TE' || s === 'FLEX') req.FLEX += 1
    if (s === 'SUPER_FLEX' || s === 'SFLEX') req.SUPER_FLEX += 1
  }

  // Sane default: at least 1 QB starter in typical leagues
  if (!req.QB) req.QB = 1

  return req
}

