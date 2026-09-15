// NFL-Tabelle von ESPN. Gleiche Lage wie espnLive.js: inoffizielle API,
// CORS-frei, also direkt aus dem Browser — defensiv lesen.
//
// Die Antwort ist ein Baum aus Gruppen (`children`), der je nach Parameter
// mal nach Conference, mal nach Division verschachtelt ist. Wir verlassen
// uns bewusst NICHT auf diese Struktur: `collectEntries` sammelt jeden
// Eintrag, egal wie tief er haengt, und gruppiert wird anschliessend ueber
// unsere eigene Tabelle (data/nflDivisions.js).
import { fetchJson } from '../api'
import { normAbbr } from '../redzone/espnLive'

const STANDINGS_URL = 'https://site.api.espn.com/apis/v2/sports/football/nfl/standings'

// ESPN benennt dieselbe Kennzahl je nach Endpoint unterschiedlich -- darum
// je Feld mehrere Kandidaten, der erste Treffer gewinnt.
const STAT_KEYS = {
  wins: ['wins'],
  losses: ['losses'],
  ties: ['ties'],
  winPercent: ['winPercent', 'winpercent'],
  pointsFor: ['pointsFor', 'avgPointsFor'],
  pointsAgainst: ['pointsAgainst', 'avgPointsAgainst'],
  differential: ['differential', 'pointDifferential'],
  streak: ['streak'],
  divisionRecord: ['vsDiv', 'divisionRecord'],
  playoffSeed: ['playoffSeed'],
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)

function statsOf(entry) {
  const list = Array.isArray(entry?.stats) ? entry.stats : []
  const byName = new Map()
  for (const s of list) {
    for (const key of [s?.name, s?.abbreviation, s?.shortDisplayName]) {
      if (key && !byName.has(String(key))) byName.set(String(key), s)
    }
  }
  const pick = (field) => {
    for (const k of STAT_KEYS[field]) if (byName.has(k)) return byName.get(k)
    return null
  }
  const read = (field) => {
    const s = pick(field)
    return s ? { value: num(s.value), text: s.displayValue != null ? String(s.displayValue) : null } : { value: null, text: null }
  }
  return { read }
}

/** Jeden Standings-Eintrag einsammeln, egal wie tief er im Baum haengt. */
export function collectEntries(node, out = []) {
  if (!node || typeof node !== 'object') return out
  const entries = node?.standings?.entries ?? node?.entries
  if (Array.isArray(entries)) out.push(...entries.filter((e) => e?.team))
  for (const child of Array.isArray(node.children) ? node.children : []) collectEntries(child, out)
  return out
}

export function normalizeStandings(json) {
  const seen = new Set()
  const rows = []
  for (const entry of collectEntries(json)) {
    const abbr = normAbbr(entry.team?.abbreviation)
    // Derselbe Eintrag taucht in verschachtelten Antworten mehrfach auf
    // (Conference UND Division) -- der erste Treffer zaehlt.
    if (!abbr || seen.has(abbr)) continue
    seen.add(abbr)
    const { read } = statsOf(entry)
    const wins = read('wins').value ?? 0
    const losses = read('losses').value ?? 0
    const ties = read('ties').value ?? 0
    const pf = read('pointsFor').value
    const pa = read('pointsAgainst').value
    const diff = read('differential').value
    rows.push({
      abbr,
      name: entry.team?.shortDisplayName || entry.team?.name || entry.team?.displayName || abbr,
      logo: entry.team?.logos?.[0]?.href || entry.team?.logo || null,
      wins,
      losses,
      ties,
      played: wins + losses + ties,
      // Bei 0 Spielen ist die Quote 0, nicht NaN -- sonst sortiert die
      // Vorsaison-Tabelle zufaellig.
      winPercent: read('winPercent').value ?? (wins + losses + ties ? (wins + ties / 2) / (wins + losses + ties) : 0),
      pointsFor: pf,
      pointsAgainst: pa,
      // Differenz notfalls selbst rechnen: manche Antworten liefern sie nicht.
      differential: diff ?? (pf != null && pa != null ? pf - pa : null),
      streak: read('streak').text,
      divisionRecord: read('divisionRecord').text,
      playoffSeed: read('playoffSeed').value,
    })
  }
  return rows
}

export async function fetchStandings({ season } = {}) {
  const q = season ? `?season=${encodeURIComponent(season)}` : ''
  return normalizeStandings(await fetchJson(`${STANDINGS_URL}${q}`))
}
