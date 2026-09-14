// ESPN-Live-Daten fuer die Redzone. site.api.espn.com sendet
// access-control-allow-origin: * (verifiziert 2026-09-13) -> direkt aus dem
// Browser/Capacitor, kein Server-Proxy. Inoffizielle API: defensiv lesen.
import { fetchJson } from '../api'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

// Einzige bekannte Kuerzel-Abweichung ESPN vs. Sleeper (vgl. server/rankings.js).
const TEAM_ALIAS = { WSH: 'WAS' }

export function normAbbr(abbr) {
  const u = String(abbr || '').toUpperCase()
  return TEAM_ALIAS[u] || u
}

export function normalizeScoreboard(json) {
  const events = Array.isArray(json?.events) ? json.events : []
  return events.map((ev) => {
    const comp = ev?.competitions?.[0] || {}
    const side = (homeAway) => {
      const c = (comp.competitors || []).find((t) => t.homeAway === homeAway) || {}
      return { id: String(c.team?.id ?? ''), abbr: normAbbr(c.team?.abbreviation), score: Number(c.score) || 0 }
    }
    const home = side('home')
    const away = side('away')
    const sit = comp.situation || {}
    // possession ist eine Team-ID, kein Kuerzel.
    const possId = sit.possession != null ? String(sit.possession) : null
    const possessionAbbr = possId && possId === home.id ? home.abbr : possId && possId === away.id ? away.abbr : null
    const status = comp.status || ev?.status || {}
    return {
      id: String(ev?.id ?? ''),
      date: ev?.date || null,
      state: status.type?.state || 'pre',
      detail: status.type?.shortDetail || '',
      period: status.period ?? null,
      clock: status.displayClock || '',
      // Restsekunden im laufenden Viertel (ESPN liefert status.clock numerisch) --
      // Grundlage der Rest-Projektion, siehe matchupProjection.remainingGameFraction.
      clockSeconds: Number.isFinite(Number(status.clock)) ? Number(status.clock) : null,
      home,
      away,
      possessionAbbr,
      isRedZone: !!sit.isRedZone,
      downDistance: sit.downDistanceText || null,
      lastPlay: sit.lastPlay?.text?.trim() || null,
    }
  })
}

export function normalizeScoringPlays(json) {
  const plays = Array.isArray(json?.scoringPlays) ? json.scoringPlays : []
  return plays.map((p) => ({
    id: String(p.id),
    text: String(p.text || '').trim(),
    teamAbbr: normAbbr(p.team?.abbreviation),
    type: p.type?.abbreviation || '',
    period: p.period?.number ?? null,
    clockValue: p.clock?.value ?? null,
    clock: p.clock?.displayValue || '',
  }))
}

export async function fetchScoreboard({ season, week }) {
  return normalizeScoreboard(await fetchJson(`${ESPN_BASE}/scoreboard?seasontype=2&week=${week}&dates=${season}`))
}

export async function fetchScoringPlays(eventId) {
  return normalizeScoringPlays(await fetchJson(`${ESPN_BASE}/summary?event=${encodeURIComponent(eventId)}`))
}
