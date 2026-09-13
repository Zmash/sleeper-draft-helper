// Live-Matchup: Sieg-Wahrscheinlichkeit aus aktuellem Punktestand + Wochen-
// projektion der Starter (Sleeper-Wochenprojektionen, siehe useWeeklyRankingsStore).
// Nutzt dieselbe kalibrierte ELO-Formel wie die Saison-Simulation (seasonSim.js) --
// kein Nachbau von Sleepers eigenem (proprietaerem) Modell, nur eine plausible
// Annaeherung fuer die Dashboard-Anzeige.
import { winProbability } from './seasonSim'

// Endstand kann nicht unter das bereits Erzielte fallen -- nur die Projektion
// fuer die restliche Woche zaehlt noch on top.
function projectedFinal(actual, projected) {
  return Math.max(actual || 0, projected ?? actual ?? 0)
}

/**
 * @returns {{myFinal:number, oppFinal:number, myWinPct:number}|null}
 *   null, wenn fuer eine der beiden Seiten keine Projektion vorliegt.
 */
export function computeMatchupProbability({ myPoints, myProjected, opponentPoints, opponentProjected }) {
  if (myProjected == null || opponentProjected == null) return null
  const myFinal = projectedFinal(myPoints, myProjected)
  const oppFinal = projectedFinal(opponentPoints, opponentProjected)
  const myWinPct = Math.round(winProbability(myFinal - oppFinal) * 100)
  return { myFinal, oppFinal, myWinPct: Math.min(99, Math.max(1, myWinPct)) }
}
