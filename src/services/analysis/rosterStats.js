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

    positions.push({ pos, mine, median: med, diff })
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
