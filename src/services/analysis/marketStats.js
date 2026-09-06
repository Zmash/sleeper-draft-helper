// Markt-Statistiken aus den Feldern, die marketMerge.js mitbringt:
// stdev (Streuung der ADP), low/high (Extremwerte), adp (Mittel).
import { normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { pickName } from './draftStats'

/**
 * Die Spieler, ueber die sich der Markt am wenigsten einig ist -- samt ihrem
 * realistischen Zugriffs-Fenster.
 */
export function marketDisagreement({ boardPlayers = [], picks = [], limit = 10 }) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))

  const num = toFiniteOrNull

  const usable = (boardPlayers || [])
    .filter((bp) => num(bp?.stdev) !== null
      && num(bp?.low) !== null
      && num(bp?.high) !== null
      && bp?.nname && !taken.has(bp.nname))
    .map((bp) => ({
      name: bp.name || bp.nname,
      pos: normalizePos(bp.pos),
      adp: num(bp.adp),
      low: num(bp.low),
      high: num(bp.high),
      stdev: num(bp.stdev),
    }))
    .sort((a, b) => b.stdev - a.stdev)

  const players = usable.slice(0, limit)
  const scaleMin = players.length ? Math.min(...players.map((x) => x.low)) : 0
  // Mindestbreite 1, damit die Balkenberechnung nie durch null teilt.
  const scaleMax = players.length
    ? Math.max(Math.max(...players.map((x) => x.high)), scaleMin + 1)
    : 1

  return { players, basis: usable.length, scaleMin, scaleMax }
}
