// Reine Aufbereitung der NFL-Tabelle: nach eigener Divisionstabelle gruppieren
// und innerhalb der Division sortieren. Kein Fetch, kein Storage.
import { NFL_DIVISIONS, CONFERENCES } from '../../data/nflDivisions'

/**
 * Sortierung innerhalb einer Division: Siegquote, dann Punktdifferenz, dann
 * Kuerzel. Der dritte Schluessel ist kein sportliches Kriterium, sondern
 * sorgt nur dafuer, dass die Reihenfolge bei Gleichstand stabil bleibt
 * statt bei jedem Rendern zu springen. Die echten NFL-Tiebreaker (Direkt-
 * vergleich, Division-Bilanz, ...) bildet das bewusst nicht nach — dafuer
 * fehlen die Daten, und eine erfundene Reihenfolge waere schlechter als
 * eine offensichtlich grobe.
 */
export function compareRows(a, b) {
  if (b.winPercent !== a.winPercent) return b.winPercent - a.winPercent
  const da = a.differential ?? 0
  const db = b.differential ?? 0
  if (db !== da) return db - da
  return a.abbr.localeCompare(b.abbr)
}

/** "2-1" bzw. "2-1-1", Unentschieden nur wenn es welche gibt. */
export function recordLabel(row) {
  if (!row) return ''
  return row.ties > 0 ? `${row.wins}-${row.losses}-${row.ties}` : `${row.wins}-${row.losses}`
}

/**
 * Tabellenzeilen auf die 8 Divisionen verteilen.
 * @param {Array} rows  aus normalizeStandings
 * @returns {Array<{id,conference,division,title,teams:Array}>}
 */
export function groupByDivision(rows = []) {
  const byAbbr = new Map(rows.map((r) => [r.abbr, r]))
  return NFL_DIVISIONS.map((d) => ({
    id: d.id,
    conference: d.conference,
    division: d.division,
    title: `${d.conference} ${d.division}`,
    // Teams ohne Datensatz werden als leere Zeile gefuehrt statt verschluckt:
    // eine Division mit drei Zeilen waere verwirrender als eine mit einem
    // sichtbaren Loch.
    teams: d.teams
      .map((abbr) => byAbbr.get(abbr) || { abbr, name: abbr, logo: null, wins: 0, losses: 0, ties: 0,
        played: 0, winPercent: 0, pointsFor: null, pointsAgainst: null, differential: null,
        streak: null, divisionRecord: null, playoffSeed: null, missing: true })
      .sort(compareRows),
  }))
}

/** Divisionen je Conference, fuer die zweispaltige Darstellung. */
export function byConference(groups = []) {
  return CONFERENCES.map((c) => ({ conference: c, groups: groups.filter((g) => g.conference === c) }))
}

/** Hat die Antwort ueberhaupt verwertbare Daten? */
export function hasPlayedGames(rows = []) {
  return rows.some((r) => r.played > 0)
}
