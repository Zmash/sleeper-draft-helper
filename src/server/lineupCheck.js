import fs from 'fs'
import os from 'os'
import path from 'path'
import { buildAllTeamsRows } from '../services/analysis/allTeamsLineup.js'
import { bestLineup, matchKey, freeAgents, pickupRanking } from '../services/analysis/waiverStats.js'
import { normalizePlayerName } from '../utils/formatting.js'
import { fantasyProsPositionUrl, extractEcrData, normalizeFantasyProsPlayer } from './rankings.js'

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'
const FP_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }

const REASON_TEXT = { bye: 'Bye', out: 'Out', suboptimal: 'Bank?', 'better-on-bench': 'Starten?', questionable: 'Fraglich' }

export function composeMessage({ warnings = [], pickups = [], type = 'morning' } = {}) {
  const relevant = warnings.filter((w) => w.severity === 'red' || w.severity === 'yellow')
  if (!relevant.length && !pickups.length) return null
  const order = { red: 0, yellow: 1 }
  const top = [...relevant].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9))[0]
  let title = 'Lineup prüfen'
  let body = ''
  if (top) {
    title = `${top.severity === 'red' ? 'Problem' : 'Hinweis'} · ${top.leagueName}`
    body = `${top.playerName} (${top.pos}) – ${REASON_TEXT[top.reason] || top.reason}`
  }
  if (type === 'morning' && pickups.length) {
    const p = pickups[0]
    const waiver = `Waiver: ${p.name} (${p.pos}${p.team ? `, ${p.team}` : ''})`
    body = body ? `${body} · ${waiver}` : waiver
    if (!top) title = `Waiver · ${p.leagueName || ''}`.trim()
  }
  if (!body) return null
  return { title, body, url: '/lineup', tag: `sdh-${type}` }
}

// checkUserLeagues: je Liga Kader + Starter laden, bestLineup-Empfehlung
// rechnen, alles ueber buildAllTeamsRows zu Warnungen abflachen, je Liga
// Top-3 aus pickupRanking. Alles Netz nur ueber deps (injizierbar), damit
// Tests ohne Netz laufen; Defaults: echte Sleeper-Calls per globalem fetch.
async function sleeperJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Sleeper ${res.status}: ${url}`)
  return res.json()
}

// Spieler-Meta aus datei-cached /players/nfl (24h TTL, Slim-Felder wie
// src/services/playersMeta.js:12-26). Datei liegt neben PUSH_FILE.
export const META_FILE = process.env.SDH_PLAYERS_META_FILE || path.join(os.tmpdir(), 'sdh-players-meta.json')
const META_TTL_MS = 24 * 60 * 60 * 1000
const SLIM_KEYS = [
  'player_id', 'full_name', 'first_name', 'last_name', 'team', 'position',
  'fantasy_positions', 'bye_week', 'injury_status', 'age', 'status',
  'depth_chart_position', 'depth_chart_order',
]

function slimPlayer(p) {
  const out = {}
  for (const k of SLIM_KEYS) out[k] = p?.[k] ?? null
  return out
}

async function loadMetaDefault(file = META_FILE) {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const cached = JSON.parse(raw)
    if (cached && (Date.now() - cached.fetched_at) < META_TTL_MS && cached.data) return cached.data
  } catch { /* ignore -> frisch laden */ }
  const json = await sleeperJson(`${SLEEPER_API_BASE}/players/nfl`)
  const data = {}
  for (const key of Object.keys(json || {})) {
    const slim = slimPlayer(json[key] || {})
    if (slim.player_id) data[slim.player_id] = slim
  }
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ fetched_at: Date.now(), data }))
  } catch { /* ignore quota */ }
  return data
}

async function fetchCurrentWeek() {
  try {
    const st = await sleeperJson(`${SLEEPER_API_BASE}/state/nfl`)
    return st?.week != null ? String(st.week) : null
  } catch {
    return null
  }
}

// Wochen-/ROS-Rang je FantasyPros-Positionsseite (Muster aus
// /api/rankings/fantasypros-position). try/catch-Degradation: leere Map.
async function fpRankMap(pos, scope) {
  try {
    const res = await fetch(fantasyProsPositionUrl(pos, scope), { headers: FP_HEADERS })
    if (!res.ok) return new Map()
    const html = await res.text()
    const data = extractEcrData(html)
    const raw = Array.isArray(data?.players) ? data.players : []
    const map = new Map()
    for (const rp of raw) {
      const p = normalizeFantasyProsPlayer(rp)
      if (p.ecr == null) continue
      const fpPos = p.pos === 'DST' ? 'DEF' : p.pos
      map.set(matchKey(fpPos, { nname: p.nname, name: p.name, team: p.team }), p.ecr)
    }
    return map
  } catch {
    return new Map()
  }
}

const WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']
const FLEX_POSITIONS = ['RB', 'WR', 'TE']
const SFLEX_POSITIONS = ['QB', 'RB', 'WR', 'TE']

function defaultDeps() {
  // Rang-Maps einmal je Lauf laden (ein Request je pos:scope), nicht je Liga.
  const rankCache = new Map()
  const rankMapCached = (pos, scope) => {
    const k = `${pos}:${scope}`
    if (!rankCache.has(k)) rankCache.set(k, fpRankMap(pos, scope))
    return rankCache.get(k)
  }
  return {
    resolveUserId: async (username) => {
      const u = await sleeperJson(`${SLEEPER_API_BASE}/user/${encodeURIComponent(username)}`)
      return u?.user_id ?? null
    },
    fetchLeagues: async (userId, season) =>
      sleeperJson(`${SLEEPER_API_BASE}/user/${userId}/leagues/nfl/${season}`),
    fetchRosters: async (leagueId) =>
      sleeperJson(`${SLEEPER_API_BASE}/league/${leagueId}/rosters`),
    fetchMeta: () => loadMetaDefault(),
    week: null,
    weekRanks: async ({ roster = [] } = {}) => {
      const [posMaps, flexMap, sflexMap] = await Promise.all([
        Promise.all(WEEK_POSITIONS.map((p) => rankMapCached(p, 'week'))),
        rankMapCached('FLEX', 'week'),
        rankMapCached('SUPER_FLEX', 'week'),
      ])
      const byPos = Object.fromEntries(WEEK_POSITIONS.map((p, i) => [p, posMaps[i]]))
      const weeklyById = new Map()
      for (const p of roster) {
        const v = byPos[p.pos]?.get(matchKey(p.pos, p))
        if (v != null) weeklyById.set(`ID:${p.sleeper_id}`, v)
      }
      const flexById = new Map()
      for (const p of roster.filter((r) => FLEX_POSITIONS.includes(r.pos))) {
        const v = flexMap.get(matchKey(p.pos, p))
        if (v != null) flexById.set(`ID:${p.sleeper_id}`, v)
      }
      const sflexById = new Map()
      for (const p of roster.filter((r) => SFLEX_POSITIONS.includes(r.pos))) {
        const v = sflexMap.get(matchKey(p.pos, p))
        if (v != null) sflexById.set(`ID:${p.sleeper_id}`, v)
      }
      return { weeklyById, flexById, sflexById }
    },
    rosPicks: async ({ league = {}, rosters = [], meta = {} } = {}) => {
      // freeAgents erwartet angereicherte Rosters ({sleeper_id}); Sleeper
      // liefert String-IDs (Muster aus useDynastyStore.js:69).
      const enriched = (rosters || []).map((r) => ({
        ...r,
        players: (r.players || []).map((id) =>
          typeof id === 'string' || typeof id === 'number' ? { sleeper_id: String(id) } : id),
      }))
      const agents = freeAgents({ playersMeta: meta, leagueRosters: enriched })
      const rosByKey = new Map()
      const maps = await Promise.all(WEEK_POSITIONS.map((p) => rankMapCached(p, 'ros')))
      for (const m of maps) for (const [k, v] of m) if (!rosByKey.has(k)) rosByKey.set(k, v)
      const leagueName = league.name || league.league_id || ''
      return pickupRanking({ freeAgents: agents, mode: 'redraft', rosRankByKey: rosByKey })
        .slice(0, 3)
        .map((p) => ({ ...p, leagueName }))
    },
  }
}

export async function checkUserLeagues({ username, season, deps } = {}) {
  const d = deps || defaultDeps()
  const userId = await d.resolveUserId(username)
  if (!userId) return { warnings: [], pickups: [] }
  const leagues = (await d.fetchLeagues(userId, season)) || []
  if (!leagues.length) return { warnings: [], pickups: [] }
  const meta = (await d.fetchMeta()) || {}
  const week = d.week != null ? String(d.week) : await fetchCurrentWeek()
  const teams = []
  const pickups = []
  for (const league of leagues) {
    const leagueId = league.league_id
    const leagueName = league.name || leagueId
    let rosters = []
    try {
      rosters = (await d.fetchRosters(leagueId)) || []
    } catch {
      continue
    }
    const mine = (rosters || []).find((r) => String(r.owner_id) === String(userId))
    if (!mine) continue
    const starterSet = new Set((mine.starters || []).map(String))
    // Kader-Spielerform wie LineupPage.jsx:168-183.
    const roster = (mine.players || []).map((id) => {
      const m = meta[String(id)] || {}
      const name = m.full_name || `${m.first_name || ''} ${m.last_name || ''}`.trim() || `#${id}`
      return {
        sleeper_id: String(id),
        name,
        nname: normalizePlayerName(name),
        pos: (m.fantasy_positions?.[0] || m.position || '').toUpperCase(),
        team: m.team || '',
        bye: m.bye_week != null ? String(m.bye_week) : '',
        injury_status: m.injury_status || null,
      }
    })
    let ranks
    try {
      ranks = await d.weekRanks({ roster, league, week })
    } catch {
      ranks = { weeklyById: new Map(), flexById: new Map(), sflexById: new Map() }
    }
    const positions = league.roster_positions?.length ? league.roster_positions : null
    // Ruling: ohne Positionen ist keine Empfehlung berechenbar -> actual gilt
    // als empfohlen (kein suboptimal-/better-on-bench-Gelb aus Nichts).
    // Bye/Out-Rot greift weiterhin (haengt nicht an der Empfehlung).
    let recommended = [...starterSet]
    if (positions) {
      try {
        const res = bestLineup({
          myRosterPlayers: roster,
          rosterPositions: positions,
          weeklyRankByKey: ranks?.weeklyById || new Map(),
          flexRankByKey: ranks?.flexById || new Map(),
          superflexRankByKey: ranks?.sflexById || new Map(),
          currentWeekBye: week,
        })
        recommended = (res.slots || []).filter((s) => s.player).map((s) => String(s.player.sleeper_id))
      } catch {
        recommended = [...starterSet]
      }
    }
    teams.push({
      leagueId,
      leagueName,
      week,
      roster,
      actualStarterIds: [...starterSet],
      recommendedStarterIds: recommended,
    })
    try {
      const picks = (await d.rosPicks({ league, rosters, meta, week })) || []
      for (const p of picks.slice(0, 3)) pickups.push(p)
    } catch { /* Degradation: Liga ohne Pickups */ }
  }
  const rows = buildAllTeamsRows({ teams })
  const warnings = rows
    .filter((r) => r.severity === 'red' || r.severity === 'yellow')
    .map((r) => ({
      leagueName: r.leagueName,
      playerName: r.player?.name || '',
      pos: r.player?.pos || '',
      team: r.player?.team || '',
      severity: r.severity,
      reason: r.reasons?.[0] || '',
    }))
  return { warnings, pickups }
}
