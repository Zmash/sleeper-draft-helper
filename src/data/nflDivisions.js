// NFL-Divisionen als gepflegte Tabelle, wie nflByes.js. Die Einteilung ist
// seit 2002 unveraendert (32 Teams, 8 Divisionen) — sie aus einer API zu
// holen waere ein Netzaufruf fuer eine Konstante.
//
// Sie ist hier bewusst die einzige Quelle der Gruppierung: ESPNs
// Standings-Antwort ist je nach Parameter mal nach Conference, mal nach
// Division verschachtelt. Indem wir nur Kuerzel + Bilanz aus der Antwort
// lesen und selbst gruppieren, ist die Seite gegen jede dieser Formen robust.
// Kuerzel in Sleeper-Schreibweise (WAS, LV, LAC, LAR, JAX) wie in nflByes.js.
export const NFL_DIVISIONS = [
  { id: 'afc-east', conference: 'AFC', division: 'East', teams: ['BUF', 'MIA', 'NE', 'NYJ'] },
  { id: 'afc-north', conference: 'AFC', division: 'North', teams: ['BAL', 'CIN', 'CLE', 'PIT'] },
  { id: 'afc-south', conference: 'AFC', division: 'South', teams: ['HOU', 'IND', 'JAX', 'TEN'] },
  { id: 'afc-west', conference: 'AFC', division: 'West', teams: ['DEN', 'KC', 'LV', 'LAC'] },
  { id: 'nfc-east', conference: 'NFC', division: 'East', teams: ['DAL', 'NYG', 'PHI', 'WAS'] },
  { id: 'nfc-north', conference: 'NFC', division: 'North', teams: ['CHI', 'DET', 'GB', 'MIN'] },
  { id: 'nfc-south', conference: 'NFC', division: 'South', teams: ['ATL', 'CAR', 'NO', 'TB'] },
  { id: 'nfc-west', conference: 'NFC', division: 'West', teams: ['ARI', 'LAR', 'SF', 'SEA'] },
]

export const CONFERENCES = ['AFC', 'NFC']

const BY_TEAM = new Map(
  NFL_DIVISIONS.flatMap((d) => d.teams.map((t) => [t, d]))
)

/** Division eines Team-Kuerzels, oder null bei unbekanntem Kuerzel. */
export function divisionForTeam(abbr) {
  return BY_TEAM.get(String(abbr || '').toUpperCase()) || null
}
