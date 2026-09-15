// Reine Aufbereitung des ESPN-Scoreboards fuer die NFL-Seite: sortieren,
// nach deutschem Kalendertag gruppieren, Status in deutschen Text uebersetzen.
// Kein Storage, kein Fetch -- alles testbar ohne Netz.
import { berlinParts, berlinLongDay, berlinTime, berlinShortDay, toDate } from '../../utils/berlinTime'
import { broadcastFor } from '../../data/nflBroadcast'
import { byeWeekForTeam, NFL_BYES } from '../../data/nflByes'

const STATE_ORDER = { in: 0, pre: 1, post: 2 }

export const isLive = (g) => g?.state === 'in'
export const isFinal = (g) => g?.state === 'post'

/** Laufende Spiele zuerst, danach nach Anpfiff. */
export function sortGames(games = []) {
  return [...games].sort((a, b) => {
    const s = (STATE_ORDER[a.state] ?? 3) - (STATE_ORDER[b.state] ?? 3)
    if (s !== 0) return s
    return String(a.date || '').localeCompare(String(b.date || ''))
  })
}

/**
 * Statuszeile eines Spiels.
 * @returns {{text:string, tone:'live'|'final'|'pre'}}
 */
export function statusLabel(game) {
  if (isLive(game)) {
    const clock = String(game.clock || '').trim()
    // Halbzeit/Viertelpausen haben keine laufende Uhr -- dann lieber ESPNs
    // Kurztext ("Halftime") als ein leeres "Q2".
    if (!clock && game.detail) return { text: game.detail, tone: 'live' }
    const q = game.period > 4 ? 'OT' : `Q${game.period ?? '?'}`
    return { text: `${q} ${clock}`.trim(), tone: 'live' }
  }
  if (isFinal(game)) {
    return { text: game.period > 4 ? 'Endstand (OT)' : 'Endstand', tone: 'final' }
  }
  return { text: kickoffLabel(game), tone: 'pre' }
}

/** "So 19:00" -- deutscher Wochentag und deutsche Uhrzeit. */
export function kickoffLabel(game) {
  const d = toDate(game?.date)
  if (!d) return 'Termin offen'
  return `${berlinShortDay(d)} ${berlinTime(d)}`
}

/** Abkuerzung des fuehrenden Teams, oder null bei Gleichstand/vor dem Spiel. */
export function leaderAbbr(game) {
  if (!game || game.state === 'pre') return null
  const h = Number(game.home?.score) || 0
  const a = Number(game.away?.score) || 0
  if (h === a) return null
  return h > a ? game.home?.abbr : game.away?.abbr
}

/**
 * Spiele nach deutschem Kalendertag gruppieren -- der Grund, warum die Seite
 * ueberhaupt existiert: ein Sonntagabend-Spiel in den USA ist hier Montag.
 * @returns {Array<{key:string, label:string, games:Array}>}
 */
export function groupByGermanDay(games = []) {
  const byKey = new Map()
  for (const g of games) {
    const p = berlinParts(g?.date)
    const key = p?.dayKey || 'offen'
    if (!byKey.has(key)) {
      byKey.set(key, { key, label: p ? berlinLongDay(g.date) : 'Termin offen', games: [] })
    }
    byKey.get(key).games.push(g)
  }
  for (const group of byKey.values()) {
    group.games.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key))
}

/** Spiele je Sendefenster anreichern (Slot + deutsche Sender). */
export function withBroadcast(games = [], { week, season } = {}) {
  return games.map((g) => ({ ...g, broadcast: broadcastFor(g, { week, season }) }))
}

/**
 * Kurzbilanz fuer die Kopfzeile.
 * @returns {{total:number, live:number, final:number, upcoming:number, next:object|null}}
 */
export function summarize(games = []) {
  const live = games.filter(isLive).length
  const final = games.filter(isFinal).length
  const pending = games.filter((g) => g.state === 'pre' && g.date)
  const next = [...pending].sort((a, b) => String(a.date).localeCompare(String(b.date)))[0] || null
  return { total: games.length, live, final, upcoming: games.length - live - final, next }
}

/** Teams mit Bye in dieser Woche -- aus der gepflegten Tabelle, ohne Netz. */
export function byeTeams(week, season) {
  const table = NFL_BYES[Number(season)]
  if (!table || !Number(week)) return []
  return Object.keys(table)
    .filter((team) => byeWeekForTeam(team, season) === Number(week))
    .sort()
}
