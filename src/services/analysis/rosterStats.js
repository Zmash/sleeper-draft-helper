// Kader-Statistiken: eigener Kader gegen das Liga-Feld.
//
// Zwei Betriebsarten. Fuehrt das Board dynasty_value, wird der Wert summiert.
// Sonst wird rein ueber Raenge verglichen -- bewusst OHNE eine Wertkurve ueber
// die Raenge zu legen, denn die waere eine Annahme, keine Quelle.
import { normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { starterSlots } from './draftStats'

const SPLIT_POS = ['QB', 'RB', 'WR', 'TE']

export function median(numbers = []) {
  const list = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!list.length) return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

export function rosterValueSplit({
  leagueRosters = [], boardPlayers = [], rosterPositions = [], myRosterId = null,
}) {
  const byId = new Map()
  const byName = new Map()
  for (const bp of boardPlayers || []) {
    if (bp?.sleeper_id) byId.set(String(bp.sleeper_id), bp)
    if (bp?.nname) byName.set(bp.nname, bp)
  }
  // toFiniteOrNull, nicht Number(): sonst zaehlt dynasty_value: null als 0
  // und der Wertmodus wuerde auf einem Board ohne Werte anspringen.
  const hasValue = (boardPlayers || []).some((bp) => toFiniteOrNull(bp?.dynasty_value) !== null)
  const mode = hasValue ? 'value' : 'rank'

  let total = 0
  let matched = 0
  const perTeam = []

  for (const roster of leagueRosters || []) {
    const players = []
    for (const p of roster?.players || []) {
      total += 1
      // Erst ueber sleeper_id, hilfsweise ueber den normalisierten Namen: die
      // Board-sleeper_id ist bei den ersten ~250 Eintraegen kaputt (Zeilennummer
      // statt echter ID), der Name ist dort die einzige verlaessliche Bruecke.
      const bp = byId.get(String(p?.sleeper_id)) ?? (p?.nname ? byName.get(p.nname) : null)
      if (bp) { matched += 1; players.push(bp) }
    }
    perTeam.push({ rosterId: roster?.roster_id ?? null, players })
  }

  const positions = []
  for (const pos of SPLIT_POS) {
    const raw = starterSlots(pos, rosterPositions)
    if (raw === 0) continue
    const slots = Math.max(1, Math.round(raw))

    // Wertmodus: Summe der besten `slots` Spieler. Rangmodus: der Rang des
    // besten Spielers -- summierte Raenge waeren bedeutungslos.
    const scoreOf = (team) => {
      const atPos = team.players
        .filter((bp) => normalizePos(bp.pos) === pos
          && (mode === 'value' || toFiniteOrNull(bp.ecr) !== null))
        .sort((a, b) => mode === 'value'
          ? (toFiniteOrNull(b.dynasty_value) ?? 0) - (toFiniteOrNull(a.dynasty_value) ?? 0)
          : toFiniteOrNull(a.ecr) - toFiniteOrNull(b.ecr))
        .slice(0, slots)
      if (!atPos.length) return null
      return mode === 'value'
        ? atPos.reduce((s, bp) => s + (toFiniteOrNull(bp.dynasty_value) ?? 0), 0)
        : toFiniteOrNull(atPos[0].ecr)
    }

    const scores = perTeam.map(scoreOf).filter((v) => Number.isFinite(v))
    if (!scores.length) continue

    const me = perTeam.find((t) => String(t.rosterId) === String(myRosterId))
    const mineRaw = me ? scoreOf(me) : null
    const mine = Number.isFinite(mineRaw) ? mineRaw : null
    const med = median(scores)
    // Bei Raengen ist klein gut, deshalb dreht sich das Vorzeichen -- positiv
    // heisst in beiden Modi "besser als das Feld".
    const diff = (mine !== null && Number.isFinite(med))
      ? (mode === 'value' ? mine - med : med - mine)
      : null
    // Rang statt nur Abweichung vom Median: "+40 ueber Median" sagt nicht,
    // ob das Platz 2 oder Platz 6 von 12 ist. Im Wertmodus ist mehr besser
    // (hoehere Werte verdraengen mich nach hinten), im Rangmodus ist
    // weniger (kleinerer ECR) besser -- gleiche Umkehrung wie bei diff.
    const rank = mine !== null
      ? (mode === 'value'
          ? scores.filter((s) => s > mine).length + 1
          : scores.filter((s) => s < mine).length + 1)
      : null

    positions.push({ pos, mine, median: med, diff, rank, teamCount: scores.length })
  }

  return {
    mode,
    positions,
    coverage: total ? matched / total : 0,
    teamCount: perTeam.length,
    // Getrennt von coverage: 0/0 (Draft laeuft noch, Sleeper liefert leere Kader)
    // sieht sonst wie "0 % Deckung" aus -- das waere die falsche Diagnose.
    totalPlayers: total,
  }
}

/**
 * Gesamt-Power-Ranking: Summe der Starter-Werte (beste `slots` Spieler je
 * Position, wie in rosterValueSplit) ueber alle Positionen -- ein einziger
 * Liga-Rang statt vier Einzelvergleiche.
 *
 * Nur im Wertmodus sinnvoll: ohne Dynasty-Werte muesste man Raenge ueber
 * Positionen hinweg summieren, was eine Wertkurve annehmen wuerde, die es
 * nicht gibt (derselbe Grundsatz wie in rosterValueSplit).
 */
export function teamPowerRanking({
  leagueRosters = [], boardPlayers = [], rosterPositions = [], myRosterId = null,
  rosterToUserMap = {}, ownerLabels = null,
}) {
  const byId = new Map()
  const byName = new Map()
  for (const bp of boardPlayers || []) {
    if (bp?.sleeper_id) byId.set(String(bp.sleeper_id), bp)
    if (bp?.nname) byName.set(bp.nname, bp)
  }
  const hasValue = (boardPlayers || []).some((bp) => toFiniteOrNull(bp?.dynasty_value) !== null)
  if (!hasValue) return { available: false, teams: [], myRank: null }

  const slotsByPos = {}
  for (const pos of SPLIT_POS) {
    const raw = starterSlots(pos, rosterPositions)
    if (raw > 0) slotsByPos[pos] = Math.max(1, Math.round(raw))
  }

  const teams = (leagueRosters || []).map((roster) => {
    const players = []
    for (const p of roster?.players || []) {
      const bp = byId.get(String(p?.sleeper_id)) ?? (p?.nname ? byName.get(p.nname) : null)
      if (bp) players.push(bp)
    }
    let total = 0
    for (const [pos, slots] of Object.entries(slotsByPos)) {
      total += players
        .filter((bp) => normalizePos(bp.pos) === pos)
        .sort((a, b) => (toFiniteOrNull(b.dynasty_value) ?? 0) - (toFiniteOrNull(a.dynasty_value) ?? 0))
        .slice(0, slots)
        .reduce((s, bp) => s + (toFiniteOrNull(bp.dynasty_value) ?? 0), 0)
    }
    const rosterId = roster?.roster_id ?? null
    const ownerId = rosterToUserMap?.[String(rosterId)]
    const label = ownerId
      ? (ownerLabels?.get?.(`user:${ownerId}`) || ownerId)
      : `Team ${rosterId ?? '?'}`
    return { rosterId, label, total }
  })

  teams.sort((a, b) => b.total - a.total)
  const myIndex = myRosterId != null ? teams.findIndex((t) => String(t.rosterId) === String(myRosterId)) : -1

  return {
    available: true,
    teams,
    myRank: myIndex >= 0 ? myIndex + 1 : null,
    myTotal: myIndex >= 0 ? teams[myIndex].total : null,
  }
}

/**
 * Alters-Profil je Position: mein Team-Durchschnittsalter gegen den
 * Liga-Median. Bewusst ohne Wertung (juenger ist kein "besser", nur ein
 * Rebuild- vs. Win-Now-Signal) -- keine good/bad-Faerbung wie beim Wert.
 */
export function ageProfile({ leagueRosters = [], rosterPositions = [], myRosterId = null }) {
  const perTeam = (leagueRosters || []).map((r) => ({
    rosterId: r?.roster_id ?? null,
    players: r?.players || [],
  }))

  const positions = []
  for (const pos of SPLIT_POS) {
    if (starterSlots(pos, rosterPositions) === 0) continue

    const avgAgeOf = (team) => {
      const ages = team.players
        .filter((p) => normalizePos(p.pos) === pos && Number.isFinite(p.age))
        .map((p) => p.age)
      return ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null
    }

    const teamAges = perTeam.map(avgAgeOf)
    const validAges = teamAges.filter((a) => Number.isFinite(a))
    if (!validAges.length) continue

    const myIndex = myRosterId != null ? perTeam.findIndex((t) => String(t.rosterId) === String(myRosterId)) : -1
    const mine = myIndex >= 0 ? teamAges[myIndex] : null
    const leagueMedian = median(validAges)
    const diff = (Number.isFinite(mine) && Number.isFinite(leagueMedian)) ? mine - leagueMedian : null

    positions.push({ pos, mine: Number.isFinite(mine) ? mine : null, leagueMedian, diff })
  }

  return { positions, teamCount: perTeam.length }
}

const ROSTER_SLOTS = ['starter', 'bench', 'taxi', 'ir']

/**
 * Wie viel Dynasty-Wert im eigenen Kader in Startern vs. Bank/Taxi/IR
 * steckt -- zeigt versteckte Tiefe (wertvolle Bank) oder eine duenne
 * Startelf ohne Rueckhalt.
 */
export function starterVsBenchValue({ dynastyRoster = [], boardPlayers = [] }) {
  const byId = new Map()
  const byName = new Map()
  for (const bp of boardPlayers || []) {
    if (bp?.sleeper_id) byId.set(String(bp.sleeper_id), bp)
    if (bp?.nname) byName.set(bp.nname, bp)
  }
  const hasValue = (boardPlayers || []).some((bp) => toFiniteOrNull(bp?.dynasty_value) !== null)
  if (!hasValue) return { available: false }

  const value = { starter: 0, bench: 0, taxi: 0, ir: 0 }
  const count = { starter: 0, bench: 0, taxi: 0, ir: 0 }
  let matched = 0

  for (const p of dynastyRoster || []) {
    const bp = byId.get(String(p?.sleeper_id)) ?? (p?.nname ? byName.get(p.nname) : null)
    if (!bp) continue
    const val = toFiniteOrNull(bp.dynasty_value)
    if (val === null) continue
    matched += 1
    const slot = ROSTER_SLOTS.includes(p.slot) ? p.slot : 'bench'
    value[slot] += val
    count[slot] += 1
  }

  const total = value.starter + value.bench + value.taxi + value.ir

  return {
    available: true,
    matched,
    total,
    value,
    count,
    starterShare: total > 0 ? value.starter / total : null,
  }
}
