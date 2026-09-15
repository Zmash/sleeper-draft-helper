// Live-Matchup: Sieg-Wahrscheinlichkeit aus aktuellem Punktestand + Wochen-
// projektion der Starter (Sleeper-Wochenprojektionen, siehe useWeeklyRankingsStore).
// Kein Nachbau von Sleepers eigenem (proprietaerem) Modell, nur eine plausible
// Annaeherung fuer die Dashboard-Anzeige.
//
// Zwei Modi:
//  - MIT Restprojektion (myRemaining/opponentRemaining, siehe
//    matchupProjection.liveStarterTotals): Normalverteilung, deren Streuung mit
//    den noch offenen Projektionspunkten schrumpft. Ist nichts mehr offen, ist
//    die Partie entschieden -> 100/0 statt einer Fantasie-Restchance.
//  - OHNE Restprojektion (keine Spielstatus-Daten): wie bisher die kalibrierte
//    ELO-Formel der Saison-Simulation (seasonSim.js), gedeckelt auf 1..99.
import { winProbability } from './seasonSim'

// Streuung eines komplett offenen Lineups: ~2.65 * sqrt(110 Projektionspunkte)
// ~ 28 Punkte -- die uebliche Wochen-Standardabweichung eines Fantasy-Teams.
// Damit liegt das Modell bei voller Woche praktisch auf der ELO-Kalibrierung
// (12 Punkte Vorsprung -> ~63 % statt ~65 %), kollabiert aber korrekt gegen
// 100/0, je weniger noch aussteht.
export const LIVE_SIGMA_PER_SQRT_POINT = 2.65
// Unter einem halben offenen Projektionspunkt ist nichts mehr zu holen.
const DECIDED_REMAINING = 0.5

// Endstand kann nicht unter das bereits Erzielte fallen -- nur die Projektion
// fuer die restliche Woche zaehlt noch on top.
function projectedFinal(actual, projected) {
  return Math.max(actual || 0, projected ?? actual ?? 0)
}

const clampPct = (p) => Math.min(99, Math.max(1, p))

// Abramowitz & Stegun 7.1.26 (erf-Approximation), Fehler < 1.5e-7 -- genau
// genug fuer eine Prozentanzeige und ohne Abhaengigkeit.
export function normalCdf(z) {
  if (!Number.isFinite(z)) return 0.5
  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return 0.5 * (1 + sign * y)
}

/** Siegwahrscheinlichkeit bei `delta` Punkten Vorsprung und `remaining` noch offenen Projektionspunkten (beide Seiten zusammen). */
export function liveWinProbability(delta, remaining) {
  const d = Number(delta)
  if (!Number.isFinite(d)) return 0.5
  const sigma = LIVE_SIGMA_PER_SQRT_POINT * Math.sqrt(Math.max(0, Number(remaining) || 0))
  if (!(sigma > 0.01)) return d > 0 ? 1 : d < 0 ? 0 : 0.5
  return normalCdf(d / sigma)
}

/**
 * @param {object} args
 * @param {number} args.myPoints            bereits erzielte Punkte (Sleeper `matchup.points`)
 * @param {number|null} args.myProjected    projizierter Endstand (Stand + Rest)
 * @param {number|null} [args.myRemaining]  noch offene Projektionspunkte; null = keine Spielstatus-Daten
 * @returns {{myFinal:number, oppFinal:number, myWinPct:number, remaining:number|null}|null}
 *   null, wenn fuer eine der beiden Seiten keine Projektion vorliegt.
 */
export function computeMatchupProbability({
  myPoints, myProjected, opponentPoints, opponentProjected,
  myRemaining = null, opponentRemaining = null,
}) {
  if (myProjected == null || opponentProjected == null) return null
  const myFinal = projectedFinal(myPoints, myProjected)
  const oppFinal = projectedFinal(opponentPoints, opponentProjected)
  const delta = myFinal - oppFinal

  // Achtung: Number(null) === 0 -- null/undefined muessen explizit raus, sonst
  // gilt "keine Spielstatus-Daten" faelschlich als "nichts mehr offen".
  const isPoints = (v) => v != null && Number.isFinite(Number(v))
  const hasRemaining = isPoints(myRemaining) && isPoints(opponentRemaining)
  if (!hasRemaining) {
    return { myFinal, oppFinal, myWinPct: clampPct(Math.round(winProbability(delta) * 100)), remaining: null }
  }

  const remaining = Math.max(0, Number(myRemaining)) + Math.max(0, Number(opponentRemaining))
  // Entschieden: vorher deckelten wir hier auf 99/1 und suggerierten eine
  // Chance, die es nicht mehr gibt.
  if (remaining <= DECIDED_REMAINING) {
    return { myFinal, oppFinal, myWinPct: delta > 0 ? 100 : delta < 0 ? 0 : 50, remaining }
  }
  return { myFinal, oppFinal, myWinPct: clampPct(Math.round(liveWinProbability(delta, remaining) * 100)), remaining }
}
