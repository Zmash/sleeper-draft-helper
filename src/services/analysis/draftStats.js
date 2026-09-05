// Gerechnete Draft-Statistiken. Reine Funktionen, kein React, kein Netz.
//
// Grundgroesse ueberall: delta = ecr - pick_no.
// Positiv heisst: der Spieler ging spaeter als sein Rang, also unter Wert geholt.
import { normalizePlayerName, normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { teamKeyFromPick } from '../derive'

/** Board -> Map normalisierter Name -> { ecr, name }. Nur mit numerischem ecr. */
function ecrByName(boardPlayers = []) {
  const m = new Map()
  for (const bp of boardPlayers || []) {
    if (!bp?.nname) continue
    const ecr = toFiniteOrNull(bp?.ecr)
    if (ecr === null) continue
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
    const pickNo = toFiniteOrNull(p?.pick_no)
    // Kein Treffer heisst "unbekannt", nicht "Wert 0" -- sonst wuerde ein Team
    // belohnt, dessen Picks schlicht nicht im Ranking stehen.
    if (!hit || pickNo === null) { unmatched += 1; continue }

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

const SCARCITY_POS = ['QB', 'RB', 'WR', 'TE']

// Welche Flex-Slots welche Positionen aufnehmen. Der Anteil ist 1 geteilt durch
// die Zahl der aufnehmbaren Positionen -- ein FLEX ist zu einem Drittel ein
// RB-Slot, weil sich RB, WR und TE darum bewerben.
const FLEX_SLOTS = {
  FLEX: ['RB', 'WR', 'TE'],
  WRT: ['RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
}

/**
 * Starter-Slots einer Position, Flex anteilig.
 * @returns {number} kann gebrochen sein -- erst nach x teamsCount runden.
 */
export function starterSlots(pos, rosterPositions = []) {
  const want = String(pos || '').toUpperCase()
  let n = 0
  for (const raw of rosterPositions || []) {
    const slot = String(raw || '').toUpperCase()
    if (slot === want) { n += 1; continue }
    const takers = FLEX_SLOTS[slot]
    if (takers && takers.includes(want)) n += 1 / takers.length
  }
  return n
}

export function positionalScarcity({
  boardPlayers = [], picks = [], rosterPositions = [], teamsCount = 12,
}) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))
  const teams = Number(teamsCount) || 0
  const out = []

  for (const pos of SCARCITY_POS) {
    const need = Math.round(teams * starterSlots(pos, rosterPositions))
    if (need <= 0) continue

    // toFiniteOrNull statt Number(): Number(null) waere 0 und damit ein
    // gueltiger Rang 0 -- der beste Spieler ueberhaupt.
    const pool = (boardPlayers || [])
      .filter((bp) => {
        if (toFiniteOrNull(bp?.ecr) === null) return false
        if (normalizePos(bp?.pos) !== pos) return false
        if (!bp?.nname) return false
        if (taken.has(bp.nname)) return false
        return true
      })
      .sort((a, b) => toFiniteOrNull(a.ecr) - toFiniteOrNull(b.ecr))

    const exhausted = pool.length < need
    const best = pool[0] || null
    const replacement = exhausted ? null : pool[need - 1]

    out.push({
      pos,
      need,
      available: pool.length,
      startable: Math.min(pool.length, need),
      exhausted,
      bestName: best?.name || null,
      bestEcr: best ? toFiniteOrNull(best.ecr) : null,
      replacementEcr: replacement ? toFiniteOrNull(replacement.ecr) : null,
      vor: (best && replacement)
        ? toFiniteOrNull(replacement.ecr) - toFiniteOrNull(best.ecr)
        : null,
    })
  }
  return out
}
