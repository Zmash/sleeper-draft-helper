// Team-Staerke = Summe der Wochenprojektionen der optimalen Starter.
// Auswahl via bestLineup (Rang-Maps, selbe Engine wie LineupPage), Groesse via
// Sleeper-Wochenprojektion (Punkte). Trennung ist Absicht: Raenge ordnen,
// Punkte zaehlen.
import { bestLineup, matchKey } from './waiverStats'

const WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']

// Baut ID:-Rank-Maps nach dem Muster von LineupPage.jsx:191-205: FantasyPros-
// Maps sind per matchKey (NAME:/TEAM:) geschluesselt, bestLineup braucht
// ID:${sleeper_id}. getRankMap ist useWeeklyRankingsStore.getRankMap.
export function buildIdRankMaps({ rosterPlayers, getRankMap }) {
  const wk = new Map()
  const fx = new Map()
  const sfx = new Map()
  for (const pos of WEEK_POSITIONS) {
    const rm = getRankMap({ pos, scope: 'week' })
    for (const p of rosterPlayers || []) {
      if ((p.pos || '').toUpperCase() !== pos) continue
      const v = rm.get(matchKey(pos, p))
      if (v != null) wk.set(`ID:${p.sleeper_id}`, v)
    }
  }
  const flexMap = getRankMap({ pos: 'FLEX', scope: 'week' })
  const sflexMap = getRankMap({ pos: 'SUPER_FLEX', scope: 'week' })
  for (const p of rosterPlayers || []) {
    const fv = flexMap.get(matchKey(p.pos, p))
    if (fv != null) fx.set(`ID:${p.sleeper_id}`, fv)
    const sv = sflexMap.get(matchKey(p.pos, p))
    if (sv != null) sfx.set(`ID:${p.sleeper_id}`, sv)
  }
  return { wk, fx, sfx }
}

// Wählt Starter via bestLineup (byeWeek = simulierte Woche als String, null =
// keine Bye-Beruecksichtigung) und summiert deren Projektionspunkte.
// Fehlende Projektion: Positions-Minimum der projizierten Starter im selben
// Aufruf (Replacement-Level, VORP-lite); gibt es keines, 0. missingCount
// zaehlt die Ersetzungen fuer das Genauigkeits-Badge.
// dynastyValuesByName (Map nname -> dynasty_value, nur Rookie-Modus, sonst
// null): summiert das Dynasty-Total der Starter fuer den Tiebreak in
// simulateSeason (R1) -- diese Funktion wendet den Tiebreak NICHT selbst an.
export function selectAndScore({ rosterPlayers, rosterPositions, rankMaps, byeWeek, pointsById, field, dynastyValuesByName }) {
  const res = bestLineup({
    myRosterPlayers: rosterPlayers || [],
    rosterPositions: rosterPositions || [],
    weeklyRankByKey: rankMaps?.wk || new Map(),
    flexRankByKey: rankMaps?.fx || new Map(),
    superflexRankByKey: rankMaps?.sfx || new Map(),
    currentWeekBye: byeWeek,
  })
  const starters = (res.slots || []).filter((s) => s.player)
  const knownByPos = new Map()
  for (const s of starters) {
    const pts = pointsById?.get(String(s.player.sleeper_id))?.[field]
    if (Number.isFinite(Number(pts))) {
      const pos = (s.player.pos || '').toUpperCase()
      if (!knownByPos.has(pos) || Number(pts) < knownByPos.get(pos)) knownByPos.set(pos, Number(pts))
    }
  }
  let points = 0
  let missingCount = 0
  let dynastyTotal = 0
  const starterIds = []
  for (const s of starters) {
    starterIds.push(String(s.player.sleeper_id))
    const raw = pointsById?.get(String(s.player.sleeper_id))?.[field]
    if (Number.isFinite(Number(raw))) {
      points += Number(raw)
    } else {
      missingCount += 1
      points += knownByPos.get((s.player.pos || '').toUpperCase()) ?? 0
    }
    if (dynastyValuesByName) {
      const dv = Number(dynastyValuesByName.get(s.player.nname))
      if (Number.isFinite(dv)) dynastyTotal += dv
    }
  }
  return { points, missingCount, starterIds, dynastyTotal }
}
