// src/services/analysis.js

function estimateRounds(livePicks = [], teamsCount = 0) {
  if (!Number.isFinite(teamsCount) || teamsCount <= 0) return 0
  let maxPickNo = 0
  for (const p of (livePicks || [])) {
    const n = Number(p?.pick_no)
    if (Number.isFinite(n) && n > maxPickNo) maxPickNo = n
  }
  if (!maxPickNo) return 0
  return Math.ceil(maxPickNo / teamsCount)
}

/**
 * Prüft, ob der Draft vollständig ist.
 * Falls rounds fehlt, wird es aus den Picks geschätzt.
 */
export function isDraftComplete(livePicks = [], teamsCount = 0, rounds = 0) {
  const t = Number(teamsCount)
  let r = Number(rounds)
  if (!Number.isFinite(r) || r <= 0) {
    r = estimateRounds(livePicks, t)
  }
  if (!Number.isFinite(t) || !Number.isFinite(r) || t <= 0 || r <= 0) return false
  const expected = t * r

  const uniquePickNos = new Set()
  for (const p of (livePicks || [])) {
    const n = Number(p?.pick_no)
    if (Number.isFinite(n) && n > 0) uniquePickNos.add(n)
  }
  return uniquePickNos.size >= expected
}
