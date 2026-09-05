// Gerechnete Draft-Statistiken. Reine Funktionen, kein React, kein Netz.
//
// Grundgroesse ueberall: delta = ecr - pick_no.
// Positiv heisst: der Spieler ging spaeter als sein Rang, also unter Wert geholt.
import { normalizePlayerName, normalizePos } from '../../utils/formatting'
import { teamKeyFromPick } from '../derive'

/** Board -> Map normalisierter Name -> { ecr, name }. Nur mit numerischem ecr. */
function ecrByName(boardPlayers = []) {
  const m = new Map()
  for (const bp of boardPlayers || []) {
    if (!bp?.nname || bp?.ecr == null) continue
    const ecr = Number(bp.ecr)
    if (!Number.isFinite(ecr)) continue
    m.set(bp.nname, { ecr, name: bp.name || bp.nname })
  }
  return m
}

/** Normalisierter Name eines Picks, passend zum nname der Board-Spieler. */
export function pickName(pick) {
  const full = `${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`.trim()
  return full ? normalizePlayerName(full) : ''
}

export function teamDraftRanking({
  picks = [], boardPlayers = [], teamsCount = 0, ownerLabels = null, myTeamKey = null,
}) {
  const byName = ecrByName(boardPlayers)
  const teams = new Map()
  const scored = []
  let matched = 0
  let unmatched = 0

  for (const p of picks || []) {
    const key = teamKeyFromPick(p, teamsCount)
    if (!teams.has(key)) {
      teams.set(key, {
        key,
        label: ownerLabels?.get?.(key) || key,
        delta: 0, picks: 0, best: null, worst: null,
      })
    }
    const t = teams.get(key)
    t.picks += 1

    const hit = byName.get(pickName(p))
    const pickNo = Number(p?.pick_no)
    // Kein Treffer heisst "unbekannt", nicht "Wert 0" -- sonst wuerde ein Team
    // belohnt, dessen Picks schlicht nicht im Ranking stehen.
    if (!hit || !Number.isFinite(pickNo)) { unmatched += 1; continue }

    matched += 1
    const delta = hit.ecr - pickNo
    t.delta += delta
    const entry = { name: hit.name, pick_no: pickNo, delta, teamLabel: t.label }
    scored.push(entry)
    if (!t.best || delta > t.best.delta) t.best = entry
    if (!t.worst || delta < t.worst.delta) t.worst = entry
  }

  const list = [...teams.values()].sort((a, b) => b.delta - a.delta)
  const myIndex = myTeamKey ? list.findIndex((t) => t.key === myTeamKey) : -1

  return {
    teams: list,
    steals: scored.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
    reaches: scored.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    matched,
    unmatched,
    myRank: myIndex >= 0 ? myIndex + 1 : null,
    myDelta: myIndex >= 0 ? list[myIndex].delta : null,
  }
}
