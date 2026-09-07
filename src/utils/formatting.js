export const cx = (...classes) => classes.filter(Boolean).join(' ')

export const normalizePlayerName = (name) =>
  (name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(jr|sr|iii|ii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const normalizePos = (p = '') =>
  String(p || '')
    .toUpperCase()
    .replace(/\d+/g, '')
    .replace('D/ST', 'DEF')
    .replace('DST', 'DEF')
    .trim()

/**
 * Zahl oder null. Bewusst NICHT Number() allein: Number(null) und Number('')
 * sind 0 und damit endlich -- ein fehlender Wert wuerde als gueltige Null
 * durchgehen und z.B. als bester Rang gelten.
 */
export const toFiniteOrNull = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Slug fuer FantasyPros-URLs (/nfl/players/<slug>.php, /nfl/news/<slug>.php).
 *
 * Gepruefte Eigenheit: "Jr."/"Sr." gehoeren in den Slug, roemische Ziffern
 * nicht. marvin-harrison-jr ist der Sohn, marvin-harrison der Vater — das
 * Suffix wegzuwerfen liefert also den falschen Spieler. Umgekehrt gibt es
 * kenneth-walker-iii nicht, nur kenneth-walker.
 *
 * Der Roman-Ziffern-Regex braucht \b vorn UND die Lookahead-Grenze hinten:
 * ohne beide traf "(ii|iii|iv|v)" jedes einzelne "v" im Namen, nicht nur
 * einen eigenstaendigen Suffix -- "Devaughn Vele" wurde zu "deaughn-ele",
 * "Las Vegas Raiders" zu "las-egas-raiders" (live im Trend-Tab aufgefallen).
 */
export const fantasyProsSlug = (name) =>
  String(name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[''']/g, '')
    .toLowerCase()
    .replace(/\b(ii|iii|iv|v)\.?(?=\s|$)/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** FantasyPros-Spielerprofil-URL aus dem Namen. */
export const fantasyProsPlayerUrl = (name) =>
  `https://www.fantasypros.com/nfl/players/${fantasyProsSlug(name)}.php`

/** Positionsfarbe als CSS-var mit Rueckfall, fuer inline styles. */
// normalizePos zuerst: ein roher Wert wie "D/ST" ergaebe var(--pos-d/st, #666),
// und der Schraegstrich macht den ganzen Ausdruck ungueltig — dann greift nicht
// einmal der Rueckfallwert und die Kachel bliebe farblos.
export const posColor = (pos) => `var(--pos-${normalizePos(pos).toLowerCase()}, #666)`

/** Zahl mit sichtbarem Vorzeichen, gerundet. 0 bleibt "0". */
export const signed = (n) => {
  const v = Math.round(Number(n) || 0)
  return v > 0 ? `+${v}` : String(v)
}

const DEPTH_CHART_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE'])

/**
 * Text fuer den vorhandenen Pos-Badge, mit Depth-Chart-Tiefe ("RB2") bei den
 * vier wichtigsten Positionen, sonst die reine Position ("K", "DEF", ...).
 * Bewusst KEIN eigenes Tag daneben -- das doppelt die Position visuell und
 * verschiebt jede Zeile. Bewusst ueber die eigene Fantasy-Position statt
 * Sleepers depth_chart_position gebildet: Sleeper splittet WR seitenweise
 * (LWR/RWR), der Order-Zaehler startet je Seite neu bei 1 -- zwei "WR1" im
 * selben Team sind darum normal (beide Starter), keine Dopplung.
 */
export const posBadgeLabel = (player) => {
  const pos = normalizePos(player?.pos || player?.position)
  if (!pos) return ''
  const order = toFiniteOrNull(player?.depth_chart_order)
  return DEPTH_CHART_POSITIONS.has(pos) && order ? `${pos}${order}` : pos
}

/**
 * Reihenfolge, in der echte (draftbare) Positionen als Filter-Chip auftauchen
 * koennen. FLEX/SUPER_FLEX/IDP_FLEX/BN/WR-RB-TE-Slots sind keine eigenen
 * Positionen -- sie erweitern die Liste nicht.
 */
export const BASE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB']

/**
 * Positions-Filter-Chips aus den Roster-Slots einer Liga/eines Drafts:
 * genau die Positionen, die dort tatsaechlich draftbar sind -- nicht mehr,
 * nicht weniger. Ohne erkennbare Slots (z.B. vor dem ersten Format-Resolve)
 * greift ein Rueckfall auf die klassischen Kernpositionen.
 */
export function positionFiltersFromRoster(rosterPositions) {
  const present = new Set((rosterPositions || []).map((p) => String(p).toUpperCase()))
  const found = BASE_POSITIONS.filter((p) => present.has(p))
  return ['ALL', ...(found.length ? found : BASE_POSITIONS.slice(0, 6))]
}
