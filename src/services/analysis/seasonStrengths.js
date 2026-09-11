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
export function selectAndScore({ rosterPlayers, rosterPositions, rankMaps, byeWeek, pointsById, field, dynastyValuesByName }) {  const res = bestLineup({
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

// ADP-Linse: Draftwert statt Wochenpunkten. Rohwert = Summe (ADP_REF - adp)
// ueber die ADP-besten ADP_STARTERS Kader-Spieler (slot-agnostisch — es zaehlt
// der Marktwert des Kaders wie im Dynasty-Daddy-ADP-Modell, nicht die naechste
// Aufstellung). ADP_REF liegt jenseits des Draftboards (12 Teams x ~20 Picks).
// missingCount = ungematchte Slots fuer das Genauigkeits-Badge.
export const ADP_REF = 250
export const ADP_STARTERS = 9

export function adpTeamValue({ rosterPlayers, adpByName }) {
  const vals = []
  for (const p of rosterPlayers || []) {
    const adp = Number(adpByName?.get(p.nname))
    if (Number.isFinite(adp)) vals.push(adp)
  }
  vals.sort((a, b) => a - b)
  const top = vals.slice(0, ADP_STARTERS)
  return {
    value: top.reduce((s, a) => s + (ADP_REF - a), 0),
    missingCount: Math.max(0, ADP_STARTERS - top.length),
    matched: top.length,
  }
}

// Legt eine Linse auf Mittelwert+Streuung der Referenz (Projektions-Linse):
// gleiche ELO-Skala und gleiche Entscheidenheit, nur die Team-Reihenfolge
// kommt aus der Linse. entries: Array<[id, raw>]. Leere/konstante Eingabe
// faellt auf den Referenz-Mittelwert (Muenze statt Fake-Spreizung).
export function normalizeToScale(entries, { mean, sd }) {
  const vals = (entries || []).map(([, v]) => Number(v)).filter(Number.isFinite)
  const out = new Map()
  if (!vals.length) {
    for (const [id] of entries || []) out.set(String(id), mean)
    return out
  }
  const m = vals.reduce((a, b) => a + b, 0) / vals.length
  const variance = vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length
  const s = Math.sqrt(variance)
  for (const [id, v] of entries || []) {
    const num = Number(v)
    out.set(String(id), !Number.isFinite(num) || s === 0 ? mean : mean + ((num - m) / s) * sd)
  }
  return out
}
