// Reine Wochenrueckblick-Logik: aus Sleeper-Matchups/Rosters/Users, ESPN-
// Spielen und playersMeta die Bausteine der Seite bauen. Kein Fetch, kein
// Store. Gegenstueck zu redzoneModel.js -- die Redzone beantwortet "was
// passiert gerade", diese Datei "was ist in dieser Woche passiert".
import { playerTeam } from '../redzone/redzoneModel'

// ── Slots ───────────────────────────────────────────────────────────────────
// Bewusste Kopie der FLEX-Tabelle aus waiverStats.js (dort nicht exportiert):
// der Rueckblick bewertet nach ERZIELTEN Punkten, waiverStats nach Rang --
// eine gemeinsame Funktion haette zwei unvereinbare Vergleichsmasse.
export const FLEX_ELIGIBLE = {
  FLEX: ['RB', 'WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
}

const NON_START_SLOTS = new Set(['BN', 'IR', 'TAXI'])

export const startSlots = (rosterPositions = []) =>
  rosterPositions.map((s) => String(s).toUpperCase()).filter((s) => !NON_START_SLOTS.has(s))

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const sum = (list, pick) => list.reduce((a, x) => a + num(pick(x)), 0)

/**
 * Beste Aufstellung im Nachhinein -- nach tatsaechlich erzielten Punkten.
 * Greedy: erst die festen Positionsslots, dann die FLEX-Slots von der
 * engsten zur weitesten Eignung. Bei den in Sleeper ueblichen, ineinander
 * geschachtelten FLEX-Mengen (REC_FLEX c FLEX c SUPER_FLEX) ist das exakt
 * optimal; exotische, sich nur teilweise ueberschneidende Slot-Mengen
 * koennten theoretisch einen Punkt danebenliegen.
 */
export function optimalLineupByPoints({ players = [], rosterPositions = [] } = {}) {
  const slots = startSlots(rosterPositions)
  const used = new Set()
  const out = []
  const best = (allowed) =>
    players
      .filter((p) => !used.has(p.playerId) && allowed.includes(p.pos))
      .sort((a, b) => num(b.points) - num(a.points))[0] || null

  const fixed = slots.filter((s) => !FLEX_ELIGIBLE[s])
  const flex = slots
    .filter((s) => FLEX_ELIGIBLE[s])
    .sort((a, b) => FLEX_ELIGIBLE[a].length - FLEX_ELIGIBLE[b].length)

  for (const slot of [...fixed, ...flex]) {
    const player = best(FLEX_ELIGIBLE[slot] || [slot])
    if (player) used.add(player.playerId)
    out.push({ slot, player })
  }
  return { slots: out, points: sum(out.filter((s) => s.player), (s) => s.player.points) }
}

/**
 * Welche Wechsel haetten die Woche verbessert? Aus der Optimal-Aufstellung:
 * Bankspieler, die hineingehoert haetten, gegen die schwaechsten Starter, die
 * herausgefallen waeren -- der Reihe nach gepaart. Die Summe der `gain`-Werte
 * ist genau die verschenkte Punktzahl.
 *
 * `out: null` heisst: da war gar kein Starter, der Slot blieb leer (Sleeper
 * traegt dafuer eine '0' ein). Das ist der teuerste Fall und soll sichtbar
 * bleiben, nicht herausgefiltert werden.
 */
export function benchMisses({ starters = [], bench = [], optimal = [] } = {}) {
  const optimalIds = new Set(optimal.filter((s) => s.player).map((s) => s.player.playerId))
  const gems = bench.filter((p) => optimalIds.has(p.playerId)).sort((a, b) => num(b.points) - num(a.points))
  const duds = starters.filter((p) => !optimalIds.has(p.playerId)).sort((a, b) => num(a.points) - num(b.points))
  return gems
    .map((gem, i) => ({ in: gem, out: duds[i] || null, gain: num(gem.points) - num(duds[i]?.points) }))
    .filter((m) => m.gain > 0)
    .sort((a, b) => b.gain - a.gain)
}

// ── Spieler ─────────────────────────────────────────────────────────────────

export function playerEntry({ playerId, playersMeta = {}, points, projected, byTeam = {} }) {
  const meta = playersMeta[playerId] || null
  const team = playerTeam(meta, playerId)
  const game = (team && byTeam[team]) || null
  const state = game?.state || 'none'
  const pts = points == null ? null : Number(points)
  return {
    playerId: String(playerId),
    name: meta?.full_name || `${meta?.first_name || ''} ${meta?.last_name || ''}`.trim() || String(playerId),
    pos: String(meta?.fantasy_positions?.[0] || meta?.position || '').toUpperCase(),
    team,
    game,
    state,
    points: pts,
    projected: projected == null ? null : Number(projected),
    // Differenz zur Projektion. Nur bei abgepfiffenem Spiel aussagekraeftig --
    // `final` sagt dem Aufrufer, ob er sie zeigen darf.
    delta: pts == null || projected == null ? null : pts - Number(projected),
    final: state === 'post',
    injuryStatus: meta?.injury_status || null,
  }
}

// ── Liga-Woche ──────────────────────────────────────────────────────────────

const starterIds = (m) => (m?.starters || []).filter((id) => id && id !== '0')

function teamNameFor(rosters = [], users = [], rosterId) {
  const roster = rosters.find((r) => r.roster_id === rosterId)
  const user = roster && users.find((u) => String(u.user_id) === String(roster.owner_id))
  return user?.metadata?.team_name || user?.display_name || user?.username || `Team ${rosterId}`
}

/**
 * Eine Liga in einer Woche. null, wenn ich in dieser Liga kein Team habe.
 */
export function buildLeagueWeek({
  league, matchups = [], rosters = [], users = [], myUserId,
  playersMeta = {}, byTeam = {}, projectPlayer = () => null,
} = {}) {
  const myRoster = rosters.find((r) => String(r.owner_id) === String(myUserId))
  const mine = myRoster && matchups.find((m) => m.roster_id === myRoster.roster_id)
  if (!mine) return null
  const opp = matchups.find(
    (m) => m.matchup_id != null && m.matchup_id === mine.matchup_id && m.roster_id !== mine.roster_id
  ) || null

  const entry = (id, matchup) => playerEntry({
    playerId: id,
    playersMeta,
    points: matchup?.players_points?.[id],
    projected: projectPlayer(league, id),
    byTeam,
  })

  const myStarterIds = starterIds(mine)
  const myStarterSet = new Set(myStarterIds)
  const starters = myStarterIds.map((id) => entry(id, mine))
  const bench = (mine.players || [])
    .filter((id) => id && !myStarterSet.has(id))
    .map((id) => entry(id, mine))
  const oppStarters = opp ? starterIds(opp).map((id) => entry(id, opp)) : []

  const myPoints = num(mine.points)
  const opponentPoints = opp ? num(opp.points) : null
  // "Laeuft noch": irgendein Starter hat ein Spiel, das nicht abgepfiffen ist.
  // Ohne ESPN-Daten (state 'none' ueberall) gilt die Woche als abgeschlossen --
  // dann entscheidet schlicht der Punktestand.
  const open = [...starters, ...oppStarters].filter((p) => p.state === 'in' || p.state === 'pre')
  const result = !opp ? 'none'
    : open.length ? 'live'
      : myPoints > opponentPoints ? 'win'
        : myPoints < opponentPoints ? 'loss' : 'tie'

  // Wochen-Rangliste der Liga: jedes Team, das in dieser Woche gepunktet hat.
  const scores = matchups
    .map((m) => ({
      rosterId: m.roster_id,
      teamName: teamNameFor(rosters, users, m.roster_id),
      points: num(m.points),
      isMine: m.roster_id === mine.roster_id,
    }))
    .sort((a, b) => b.points - a.points)
  const rank = scores.findIndex((s) => s.isMine) + 1 || null

  const optimalPlayers = [...starters, ...bench]
  const { slots: optimal, points: optimalPoints } = optimalLineupByPoints({
    players: optimalPlayers,
    rosterPositions: league?.roster_positions || [],
  })
  const starterPoints = sum(starters, (p) => p.points)

  return {
    leagueId: league?.league_id,
    leagueName: league?.name || league?.league_id,
    leagueAvatar: league?.avatar ?? null,
    error: null,
    myPoints,
    opponentPoints,
    opponentName: opp ? teamNameFor(rosters, users, opp.roster_id) : null,
    result,
    margin: opp ? myPoints - opponentPoints : null,
    openStarters: open.length,
    starters,
    bench,
    oppStarters,
    scores,
    rank,
    teams: scores.length,
    leagueAvg: scores.length ? sum(scores, (s) => s.points) / scores.length : null,
    leagueHigh: scores.length ? scores[0].points : null,
    leagueLow: scores.length ? scores[scores.length - 1].points : null,
    optimal,
    optimalPoints,
    // Sleepers `points` ist autoritativ (alle Scoring-Settings) -- die Summe der
    // Einzelwerte kann minimal abweichen. Fuer die Effizienz zaehlt deshalb die
    // Summe, aus der auch das Optimum gebaut ist: sonst kaeme > 100 % heraus.
    efficiency: optimalPoints > 0 ? starterPoints / optimalPoints : null,
    pointsLeftOnBench: Math.max(0, optimalPoints - starterPoints),
    misses: benchMisses({ starters, bench, optimal }),
  }
}

export function buildWeek({ leagueData = [], myUserId, playersMeta = {}, byTeam = {}, projectPlayer } = {}) {
  const leagues = []
  const errors = []
  for (const d of leagueData) {
    if (d.error) {
      errors.push({ leagueId: d.league?.league_id, leagueName: d.league?.name, error: d.error })
      continue
    }
    const built = buildLeagueWeek({ ...d, myUserId, playersMeta, byTeam, projectPlayer })
    if (built) leagues.push(built)
  }
  leagues.sort((a, b) => String(a.leagueName || '').localeCompare(String(b.leagueName || '')))
  return { leagues, errors }
}

// ── Wochenbilanz ────────────────────────────────────────────────────────────

export function weekRecord(leagues = []) {
  const record = { wins: 0, losses: 0, ties: 0, live: 0 }
  for (const l of leagues) {
    if (l.result === 'win') record.wins += 1
    else if (l.result === 'loss') record.losses += 1
    else if (l.result === 'tie') record.ties += 1
    else if (l.result === 'live') record.live += 1
  }
  const finished = leagues.flatMap((l) => l.starters).filter((p) => p.final && p.projected != null)
  return {
    ...record,
    leagues: leagues.length,
    totalPoints: sum(leagues, (l) => l.myPoints),
    pointsLeftOnBench: sum(leagues, (l) => l.pointsLeftOnBench),
    // Trefferquote: Anteil der abgeschlossenen Starter ueber ihrer Projektion.
    hitRate: finished.length ? finished.filter((p) => p.delta > 0).length / finished.length : null,
    ratedStarters: finished.length,
  }
}

// Ein Spieler kann in mehreren Ligen stehen -- fuer Ausreisser, Verletzungen
// und Positionsbilanz zaehlt er einmal, mit der Liste seiner Ligen.
function mergeByPlayer(leagues, pickList) {
  const map = new Map()
  for (const l of leagues) {
    for (const p of pickList(l)) {
      const e = map.get(p.playerId) || { ...p, leagues: [] }
      // Punkte/Projektion sind je Liga-Scoring verschieden -- gezeigt wird der
      // hoechste Wert (gleiche Konvention wie in der Redzone).
      if (p.points != null) e.points = Math.max(e.points ?? -Infinity, p.points)
      if (p.projected != null) e.projected = Math.max(e.projected ?? -Infinity, p.projected)
      e.delta = e.points == null || e.projected == null ? null : e.points - e.projected
      e.leagues.push({ leagueId: l.leagueId, leagueName: l.leagueName })
      map.set(p.playerId, e)
    }
  }
  return [...map.values()]
}

/**
 * Ausreisser: Starter, die ihre Wochenprojektion deutlich ueber- oder
 * unterschritten haben. Nur abgepfiffene Spiele -- mitten im Spiel ist jede
 * Differenz nur "noch nicht fertig".
 */
export function buildOutliers(leagues = [], { minDelta = 5, limit = 6, side = 'mine' } = {}) {
  const pick = side === 'opponents' ? (l) => l.oppStarters : (l) => l.starters
  const all = mergeByPlayer(leagues, pick)
  const rated = all.filter((p) => p.final && p.delta != null)
  const over = rated.filter((p) => p.delta >= minDelta).sort((a, b) => b.delta - a.delta).slice(0, limit)
  const under = rated.filter((p) => p.delta <= -minDelta).sort((a, b) => a.delta - b.delta).slice(0, limit)
  const pending = all.filter((p) => p.state === 'in' || p.state === 'pre').length
  return { over, under, pending, rated: rated.length }
}

// ── Verletzungen & Ausfaelle ────────────────────────────────────────────────

// Sleeper-Status, die einen Ausfall bedeuten (vgl. waiverStats
// UNAVAILABLE_INJURY_STATUSES, hier plus 'Doubtful'/'NFI-R': fuer den
// Rueckblick zaehlt "hat gefehlt bzw. faellt aus", nicht die Startbarkeit).
export const OUT_STATUSES = new Set(['Out', 'IR', 'PUP', 'Sus', 'NA', 'DNR', 'Doubtful', 'NFI-R'])
export const WATCH_STATUSES = new Set(['Questionable', 'Q'])

const SEVERITY_ORDER = { out: 0, dnp: 1, watch: 2, bench: 3 }

/**
 * Was ist am Spieltag kaputtgegangen? Drei Faelle, absteigend dringend:
 *  - `out`   Starter, der jetzt als Out/IR/... gelistet ist
 *  - `dnp`   Starter mit 0 Punkten in einem abgepfiffenen Spiel (nicht
 *            angetreten oder frueh raus -- Sleeper meldet das nicht separat)
 *  - `watch` Starter, der fraglich ins Wochenende ging
 *  - `bench` verletzter Spieler, der nicht in der Aufstellung stand
 */
export function buildInjuryReport(leagues = []) {
  const byId = new Map()
  const note = (p, started, league) => {
    const e = byId.get(p.playerId) || { ...p, startedIn: [], benchedIn: [] }
    if (p.points != null) e.points = Math.max(e.points ?? -Infinity, p.points)
    if (p.projected != null) e.projected = Math.max(e.projected ?? -Infinity, p.projected)
    ;(started ? e.startedIn : e.benchedIn).push(league)
    byId.set(p.playerId, e)
  }
  for (const l of leagues) {
    const league = { leagueId: l.leagueId, leagueName: l.leagueName }
    for (const p of l.starters) {
      // DEF/K punkten regelmaessig sehr niedrig, aber echte Nullnummern sind
      // auch dort ein Signal -- gefiltert wird nur ueber "Spiel ist vorbei".
      const dnp = p.final && (p.points ?? 0) <= 0
      if (OUT_STATUSES.has(p.injuryStatus) || WATCH_STATUSES.has(p.injuryStatus) || dnp) note(p, true, league)
    }
    for (const p of l.bench) {
      if (OUT_STATUSES.has(p.injuryStatus)) note(p, false, league)
    }
  }
  return [...byId.values()]
    .map((p) => {
      const started = p.startedIn.length > 0
      const severity = started && OUT_STATUSES.has(p.injuryStatus) ? 'out'
        : started && p.final && (p.points ?? 0) <= 0 ? 'dnp'
          : started ? 'watch' : 'bench'
      return { ...p, severity }
    })
    .sort((a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      || (b.projected ?? 0) - (a.projected ?? 0)
      || String(a.name).localeCompare(String(b.name)))
}

// ── Positionsbilanz ─────────────────────────────────────────────────────────

const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

/** Punkte gegen Projektion je Position, ueber alle gewaehlten Ligen. */
export function positionBreakdown(leagues = []) {
  const byPos = new Map()
  for (const p of mergeByPlayer(leagues, (l) => l.starters)) {
    if (!p.final || p.projected == null) continue
    const e = byPos.get(p.pos) || { pos: p.pos, points: 0, projected: 0, count: 0 }
    e.points += num(p.points)
    e.projected += num(p.projected)
    e.count += 1
    byPos.set(p.pos, e)
  }
  return [...byPos.values()]
    .map((e) => ({ ...e, delta: e.points - e.projected }))
    .sort((a, b) => {
      const ia = POS_ORDER.indexOf(a.pos); const ib = POS_ORDER.indexOf(b.pos)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
}

// ── Wochenauswahl ───────────────────────────────────────────────────────────

/** Waehlbare Wochen: 1 bis zur laufenden. Absteigend, aktuelle zuerst. */
export function weekOptions(currentWeek) {
  const max = Math.min(18, Math.max(1, Number(currentWeek) || 1))
  return Array.from({ length: max }, (_, i) => max - i)
}
