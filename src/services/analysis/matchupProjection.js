// Blend mehrerer Wochenprojektions-Quellen (Sleeper + FantasyPros) fuer den
// Dashboard-Matchup-Balken: eine einzelne Quelle geht bei Ausreissern schnell
// daneben, das arithmetische Mittel mehrerer unabhaengiger Quellen ist
// stabiler. Fehlt eine Quelle fuer einen Spieler, zaehlt die andere allein --
// fehlen beide, faellt der Spieler ganz aus der Summe (wie bisher bei
// Sleeper-only).
import { matchKey } from './waiverStats'

// sleeperWeekById: Map<sleeper_id, {pts_ppr, pts_half_ppr, pts_std}> (siehe
// useWeeklyRankingsStore.sleeperWeekById). fpPtsByKey: Map<matchKey, fantasy_pts>
// fuer EIN Scoring-Format, ueber alle benoetigten Positionen gemergt (siehe
// useWeeklyRankingsStore.getFpWeekPtsMap).
export function blendedPlayerProjection({ playerId, playersMeta, sleeperWeekById, scoringField, fpPtsByKey }) {
  const sleeperPts = sleeperWeekById?.get(String(playerId))?.[scoringField]
  const meta = playersMeta?.[playerId]
  let fpPts = null
  if (meta) {
    const pos = (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase()
    const name = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
    fpPts = fpPtsByKey?.get(matchKey(pos, { name, team: meta.team || '' })) ?? null
  }
  const values = [sleeperPts, fpPts].filter((v) => v != null)
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

// ── Live-Anteil einer Wochenprojektion ──────────────────────────────────────
// Bisher zaehlte die volle Wochenprojektion jedes Starters -- egal, ob sein
// Spiel laengst abgepfiffen war. Dadurch stand auf der Kachel ein "Proj 112"
// neben 72.8 erzielten Punkten und dem Gegner wurde noch eine dicke Chance
// zugeschrieben, obwohl nichts mehr offen war (Nutzer-Befund Week 1 2026,
// Sleeper zeigte dort 100:0). Sleeper rechnet die Projektion mit dem
// Spielverlauf herunter -- genau das macht remainingGameFraction.

const QUARTER_SECONDS = 900
const REGULATION_SECONDS = 4 * QUARTER_SECONDS

/**
 * Welcher Anteil der Wochenprojektion eines Spielers steht noch aus?
 * @param {{state?:string, period?:number, clockSeconds?:number}|null} game
 *   Normalisiertes ESPN-Spiel (siehe redzone/espnLive.normalizeScoreboard).
 * @returns {number|null} 1 = noch gar nicht gespielt, 0 = fertig (Final),
 *   dazwischen anteilig nach Viertel + Uhr. null = kein Spiel bekannt
 *   (Bye, ESPN nicht erreichbar, Kuerzel unbekannt) -> Aufrufer faellt auf
 *   "Projektion gilt noch in voller Hoehe" zurueck.
 */
export function remainingGameFraction(game) {
  const state = game?.state
  if (!state || state === 'none') return null
  if (state === 'pre') return 1
  // 'post' (Final) und alles Unbekannte danach: nichts mehr offen.
  if (state !== 'in') return 0
  const period = Number(game.period)
  // Laeuft, aber ESPN nennt kein Viertel -> haelftig ansetzen statt raten.
  if (!Number.isFinite(period) || period < 1) return 0.5
  const clock = Number(game.clockSeconds)
  const left = Number.isFinite(clock)
    ? Math.min(QUARTER_SECONDS, Math.max(0, clock))
    : QUARTER_SECONDS / 2
  const elapsed = (period - 1) * QUARTER_SECONDS + (QUARTER_SECONDS - left)
  // Overtime (period > 4) laeuft ueber REGULATION_SECONDS hinaus -> 0.
  return Math.min(1, Math.max(0, 1 - elapsed / REGULATION_SECONDS))
}

// Spieler, die heute sicher nicht (mehr) auflaufen -- ihre Projektion ist tot,
// egal was die Spieluhr sagt. Das war bisher der groesste Einzelfehler: ein
// inaktiver Starter lief mit seinen vollen ~14 Projektionspunkten mit.
//
// Sleeper fuehrt zwei Felder (beide in playersMeta.SLIM_KEYS):
//   injury_status -- wochenweise ('Out', 'IR', 'PUP', 'Sus', 'Questionable'...)
//   status        -- Kaderstatus ('Active', 'Inactive', 'Injured Reserve'...)
// Wir schreiben NUR die eindeutigen Faelle auf 0. 'Questionable' und
// 'Doubtful' bleiben bewusst drin: die loesen sich ~90 Minuten vor Kickoff
// von selbst auf, wenn die Inactives kommen -- raten muessen wir da nicht.
const RULED_OUT = new Set([
  'OUT', 'IR', 'INJUREDRESERVE', 'PUP', 'PHYSICALLYUNABLETOPERFORM',
  'NFI', 'NFIR', 'NONFOOTBALLINJURY', 'SUS', 'SUSPENDED', 'DNR', 'INACTIVE',
])

const normStatus = (v) => String(v || '').toUpperCase().replace(/[^A-Z]/g, '')

/** Steht dieser Spieler laut Sleeper-Status heute definitiv nicht auf dem Feld? */
export function isRuledOut(meta) {
  if (!meta) return false
  return RULED_OUT.has(normStatus(meta.injury_status)) || RULED_OUT.has(normStatus(meta.status))
}

/**
 * Wie viele Projektionspunkte einer Starter-Aufstellung noch ausstehen.
 * Bewusst NUR der Rest: der bereits erzielte Stand kommt aus Sleepers
 * `matchup.points` (autoritativ inkl. aller Scoring-Settings), damit sich
 * Kachel-Score und Projektion nicht widersprechen koennen.
 *
 * @param {object} args
 * @param {string[]} args.starterIds
 * @param {(id:string)=>number|null} args.projectionFor  Wochenprojektion (z.B. blendedPlayerProjection)
 * @param {(id:string)=>number|null|undefined} [args.pointsFor]  bereits erzielte Punkte des Spielers
 * @param {(id:string)=>object|null} [args.gameFor]  NFL-Spiel des Spielers
 * @param {(id:string)=>boolean} [args.outFor]  Spieler faellt heute aus (siehe isRuledOut)
 * @returns {{rest:number, open:number, hasGameStates:boolean}|null}
 *   null, wenn fuer KEINEN Starter irgendeine Projektionsquelle Daten hat.
 */
export function liveStarterTotals({ starterIds, projectionFor, pointsFor = () => 0, gameFor = () => null, outFor = () => false }) {
  if (!starterIds?.length) return null
  let rest = 0
  let open = 0
  let hasProjection = false
  let hasGameStates = false
  for (const id of starterIds) {
    if (!id || id === '0') continue
    const proj = projectionFor(id)
    if (proj != null) hasProjection = true
    const frac = remainingGameFraction(gameFor(id))
    if (frac != null) hasGameStates = true
    const scored = Number(pointsFor(id)) || 0
    // Ohne Spielstatus bleibt die alte Annahme: der Spieler kann seine
    // Projektion noch erreichen, mehr als die Differenz steht aber nicht offen.
    // Wer heute ausfaellt, hat gar nichts mehr offen -- bereits erzielte
    // Punkte (z.B. erst spaeter rausgenommen) bleiben natuerlich stehen.
    const openPts = outFor(id)
      ? 0
      : frac == null ? Math.max(0, (proj ?? 0) - scored) : (proj ?? 0) * frac
    rest += openPts
    if (openPts > 0) open += 1
  }
  if (!hasProjection) return null
  return { rest, open, hasGameStates }
}
