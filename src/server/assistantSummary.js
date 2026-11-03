import crypto from 'node:crypto'
import { checkUserLeagues as checkUserLeaguesReal } from './lineupCheck.js'

// Kurzueberblick ueber die eigenen Ligen fuer Aurora (Sprachassistent).
// Basis ist checkUserLeagues (Warnungen + Pickups), ergaenzt um Tabellenplatz,
// Bilanz und den Gegner der laufenden Woche. Alles Netz ueber deps, damit
// Tests ohne Netz laufen.
const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'

async function sleeperJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sleeper ${res.status}: ${url}`)
  return res.json()
}

const LEAGUE_TYPES = { 0: 'Redraft', 1: 'Keeper', 2: 'Dynasty' }

const points = (s = {}) => Number(s.fpts || 0) + Number(s.fpts_decimal || 0) / 100

// Platz nach Siegen, bei Gleichstand nach Punkten.
// ponytail: ohne Sleepers Tiebreaker/Divisionen, reicht fuer "auf Platz X".
export function standingOf(rosters = [], rosterId) {
  const sorted = [...rosters].sort((a, b) =>
    (Number(b.settings?.wins) || 0) - (Number(a.settings?.wins) || 0)
    || points(b.settings) - points(a.settings))
  const idx = sorted.findIndex((r) => r.roster_id === rosterId)
  return idx < 0 ? null : idx + 1
}

function teamName(users = [], ownerId) {
  const u = users.find((x) => String(x.user_id) === String(ownerId))
  return u?.metadata?.team_name || u?.display_name || null
}

function defaultDeps() {
  return {
    fetchState: () => sleeperJson(`${SLEEPER_API_BASE}/state/nfl`),
    resolveUserId: async (username) =>
      (await sleeperJson(`${SLEEPER_API_BASE}/user/${encodeURIComponent(username)}`))?.user_id ?? null,
    fetchLeagues: (userId, season) => sleeperJson(`${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${season}`),
    fetchRosters: (leagueId) => sleeperJson(`${SLEEPER_API_BASE}/league/${leagueId}/rosters`),
    fetchUsers: (leagueId) => sleeperJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`),
    fetchMatchups: (leagueId, week) => sleeperJson(`${SLEEPER_API_BASE}/league/${leagueId}/matchups/${week}`),
    checkUserLeagues: checkUserLeaguesReal,
  }
}

export async function buildAssistantSummary({ username, deps } = {}) {
  const d = { ...defaultDeps(), ...deps }
  const state = await d.fetchState()
  const season = String(state?.league_season || state?.season || new Date().getFullYear())
  const week = Number(state?.week) || null
  const userId = await d.resolveUserId(username)
  if (!userId) return { season, week, leagues: [] }
  const [leagues, check] = await Promise.all([
    d.fetchLeagues(userId, season).then((l) => l || []),
    d.checkUserLeagues({ username, season }).catch(() => ({ warnings: [], pickups: [] })),
  ])
  const out = []
  for (const league of leagues) {
    const name = league.name || league.league_id
    const [rosters, users, matchups] = await Promise.all([
      d.fetchRosters(league.league_id).catch(() => []),
      d.fetchUsers(league.league_id).catch(() => []),
      week ? d.fetchMatchups(league.league_id, week).catch(() => []) : [],
    ])
    const mine = (rosters || []).find((r) => String(r.owner_id) === String(userId))
    if (!mine) continue
    const s = mine.settings || {}
    const ties = Number(s.ties) || 0
    const myMatch = (matchups || []).find((m) => m.roster_id === mine.roster_id)
    const opp = myMatch?.matchup_id != null
      ? matchups.find((m) => m.matchup_id === myMatch.matchup_id && m.roster_id !== mine.roster_id)
      : null
    const oppRoster = opp ? rosters.find((r) => r.roster_id === opp.roster_id) : null
    out.push({
      name: String(name).trim(),
      league_id: league.league_id,
      typ: LEAGUE_TYPES[Number(league.settings?.type)] || 'Redraft',
      platz: standingOf(rosters, mine.roster_id),
      teams: rosters.length,
      bilanz: `${Number(s.wins) || 0}-${Number(s.losses) || 0}${ties ? `-${ties}` : ''}`,
      punkte: Math.round(points(s) * 100) / 100,
      gegner: opp
        ? {
          name: teamName(users, oppRoster?.owner_id) || 'unbekannt',
          punkte: Number(opp.points) || 0,
          eigene_punkte: Number(myMatch.points) || 0,
        }
        : null,
      warnungen: check.warnings
        .filter((w) => w.leagueName === name)
        .map((w) => ({ spieler: w.playerName, pos: w.pos, team: w.team, stufe: w.severity, grund: w.reason })),
      pickups: check.pickups
        .filter((p) => p.leagueName === name)
        .map((p) => ({ spieler: p.name, pos: p.pos, team: p.team || '' })),
    })
  }
  return { season, week, leagues: out }
}

// Bearer-Token zeitkonstant vergleichen. Beide Seiten vorher hashen, damit
// timingSafeEqual gleich lange Puffer bekommt und die Laenge nicht verraet.
export function tokenMatches(header, expected) {
  if (!expected) return false
  const m = /^Bearer (.+)$/.exec(String(header || ''))
  if (!m) return false
  const a = crypto.createHash('sha256').update(m[1]).digest()
  const b = crypto.createHash('sha256').update(String(expected)).digest()
  return crypto.timingSafeEqual(a, b)
}
