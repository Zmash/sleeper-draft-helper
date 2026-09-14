// Reine Redzone-Logik: aus Rohdaten (ESPN-Spiele, Sleeper-Matchups/Rosters/
// Users, playersMeta) die Bausteine der Seite bauen. Kein Fetch, kein Store.
import { computeMatchupProbability } from '../analysis/matchupProbability'
import { liveStarterTotals } from '../analysis/matchupProjection'

// ── Liga-Filter ─────────────────────────────────────────────────────────────
// Gespeichert werden ABGEWAEHLTE IDs, damit neue Ligen automatisch aktiv sind.

export function selectedLeagueIds(allIds, deselectedIds = []) {
  const off = new Set(deselectedIds)
  const on = allIds.filter((id) => !off.has(id))
  return on.length ? on : allIds
}

export function toggleLeague(allIds, deselectedIds = [], id) {
  const known = deselectedIds.filter((x) => allIds.includes(x))
  const on = selectedLeagueIds(allIds, known)
  if (!on.includes(id)) return known.filter((x) => x !== id)
  if (on.length === 1) return known // letzte aktive Liga bleibt an
  return [...known, id]
}

export function soloLeague(allIds, deselectedIds = [], id) {
  const on = selectedLeagueIds(allIds, deselectedIds)
  if (on.length === 1 && on[0] === id) return []
  return allIds.filter((x) => x !== id)
}

// ── Spiele ──────────────────────────────────────────────────────────────────

export function gamesByTeam(games = []) {
  const out = {}
  for (const g of games) {
    out[g.home.abbr] = g
    out[g.away.abbr] = g
  }
  return out
}

// ESPN leert situation.possession in Timeouts, isRedZone bleibt aber true ->
// ohne Uebernahme wuerde der Alarm bei jeder Auszeit flackern.
export function carryPossession(prevGames = [], games = []) {
  const prev = new Map(prevGames.map((g) => [g.id, g]))
  return games.map((g) =>
    g.possessionAbbr || g.state !== 'in' ? g : { ...g, possessionAbbr: prev.get(g.id)?.possessionAbbr ?? null }
  )
}

// DEF-Eintraege in Sleeper: player_id ist das Team-Kuerzel.
export function playerTeam(meta, playerId) {
  return String(meta?.team || (meta?.position === 'DEF' ? playerId : '') || '').toUpperCase()
}

export function playerGameState(meta, byTeam) {
  const team = playerTeam(meta, meta?.player_id)
  return (team && byTeam[team]?.state) || 'none'
}

// ── Matchups & Spieler ──────────────────────────────────────────────────────

const STATE_ORDER = { in: 0, pre: 1, post: 2, none: 3 }
const starterIds = (m) => (m?.starters || []).filter((id) => id && id !== '0')

// Mein Matchup-Eintrag + Gegner einer Liga; null, wenn ich dort kein Team habe.
function leagueView({ matchups = [], rosters = [], users = [] }, myUserId) {
  const myRoster = rosters.find((r) => String(r.owner_id) === String(myUserId))
  const mine = myRoster && matchups.find((m) => m.roster_id === myRoster.roster_id)
  if (!mine) return null
  const opp = matchups.find(
    (m) => m.matchup_id != null && m.matchup_id === mine.matchup_id && m.roster_id !== mine.roster_id
  ) || null
  const oppRoster = opp && rosters.find((r) => r.roster_id === opp.roster_id)
  const oppUser = oppRoster && users.find((u) => String(u.user_id) === String(oppRoster.owner_id))
  const opponentName = oppUser?.display_name || oppUser?.username || (opp ? `Team ${opp.roster_id}` : null)
  return { mine, opp, opponentName }
}

export function buildMatchupTiles({ leagueData = [], myUserId, byTeam, playersMeta, projectPlayer }) {
  const tiles = []
  const errors = []
  for (const d of leagueData) {
    if (d.error) {
      errors.push({ leagueId: d.league.league_id, leagueName: d.league.name, error: d.error })
      continue
    }
    const v = leagueView(d, myUserId)
    if (!v) continue
    const open = (m) => starterIds(m).filter((id) => ['pre', 'in'].includes(playerGameState(playersMeta[id], byTeam))).length
    // Nur der NOCH OFFENE Teil der Wochenprojektion zaehlt auf den Stand drauf --
    // abgepfiffene Spiele duerfen keine Restchance mehr erzeugen.
    const totals = (m) => liveStarterTotals({
      starterIds: starterIds(m),
      projectionFor: (id) => projectPlayer(d.league, id),
      pointsFor: (id) => m.players_points?.[id],
      gameFor: (id) => byTeam[playerTeam(playersMeta[id], id)] || null,
    })
    const myPoints = v.mine.points || 0
    const opponentPoints = v.opp?.points || 0
    const myTotals = totals(v.mine)
    const oppTotals = v.opp ? totals(v.opp) : null
    const prob = v.opp
      ? computeMatchupProbability({
        myPoints,
        myProjected: myTotals ? myPoints + myTotals.rest : null,
        opponentPoints,
        opponentProjected: oppTotals ? opponentPoints + oppTotals.rest : null,
        myRemaining: myTotals?.hasGameStates ? myTotals.rest : null,
        opponentRemaining: oppTotals?.hasGameStates ? oppTotals.rest : null,
      })
      : null
    const total = myPoints + opponentPoints
    tiles.push({
      leagueId: d.league.league_id,
      leagueName: d.league.name,
      leagueAvatar: d.league.avatar ?? null,
      myPoints,
      opponentPoints,
      opponentName: v.opponentName,
      myWinPct: prob ? prob.myWinPct : total > 0 ? Math.round((myPoints / total) * 100) : 50,
      hasProjection: !!prob,
      myOpen: open(v.mine),
      oppOpen: v.opp ? open(v.opp) : 0,
    })
  }
  tiles.sort((a, b) => Math.abs(a.myWinPct - 50) - Math.abs(b.myWinPct - 50))
  return [...tiles, ...errors]
}

export function buildPlayers({ leagueData = [], myUserId, byTeam, playersMeta, projectPlayer }) {
  const mine = new Map()
  const opponents = new Map()
  const add = (map, id, d, matchup) => {
    const meta = playersMeta[id]
    if (!meta) return
    const team = playerTeam(meta, id)
    const e = map.get(id) || {
      playerId: id,
      name: meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || id,
      pos: String(meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
      team,
      state: (team && byTeam[team]?.state) || 'none',
      game: (team && byTeam[team]) || null,
      points: null,
      projected: null,
      leagues: [],
    }
    // ponytail: Punkte/Projektion unterscheiden sich je Liga-Scoring; gezeigt wird der
    // hoechste Wert. Pro-Liga-Aufschluesselung erst, wenn es jemand vermisst.
    const pts = matchup.players_points?.[id]
    if (pts != null) e.points = Math.max(e.points ?? -Infinity, pts)
    const proj = projectPlayer(d.league, id)
    if (proj != null) e.projected = Math.max(e.projected ?? -Infinity, proj)
    e.leagues.push({ leagueId: d.league.league_id, leagueName: d.league.name })
    map.set(id, e)
  }
  for (const d of leagueData) {
    if (d.error) continue
    const v = leagueView(d, myUserId)
    if (!v) continue
    for (const id of starterIds(v.mine)) add(mine, id, d, v.mine)
    if (v.opp) for (const id of starterIds(v.opp)) add(opponents, id, d, v.opp)
  }
  const sort = (list) => list.sort((a, b) =>
    STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.points ?? 0) - (a.points ?? 0))
  return { mine: sort([...mine.values()]), opponents: sort([...opponents.values()]) }
}

export function relevantTeams({ leagueData = [], myUserId, playersMeta }) {
  const teams = new Set()
  for (const d of leagueData) {
    if (d.error) continue
    const v = leagueView(d, myUserId)
    if (!v) continue
    for (const id of [...starterIds(v.mine), ...starterIds(v.opp)]) {
      const team = playerTeam(playersMeta[id], id)
      if (team) teams.add(team)
    }
  }
  return teams
}

export function countsByGame(games = [], { mine = [], opponents = [] }) {
  const out = {}
  for (const g of games) {
    const inGame = (p) => p.team === g.home.abbr || p.team === g.away.abbr
    out[g.id] = { mine: mine.filter(inGame).length, opp: opponents.filter(inGame).length }
  }
  return out
}

// ── Redzone-Alarm & Scoring ─────────────────────────────────────────────────

export function buildRedzoneAlerts({ games = [], mine = [], opponents = [] }) {
  return games
    .filter((g) => g.state === 'in' && g.isRedZone && g.possessionAbbr)
    .map((g) => ({
      game: g,
      mine: mine.filter((p) => p.team === g.possessionAbbr),
      opponents: opponents.filter((p) => p.team === g.possessionAbbr),
    }))
    .filter((a) => a.mine.length || a.opponents.length)
}

// Defensiv-/Special-Teams-Scores, die in Sleeper der DEF gutgeschrieben werden.
const DEF_SCORE = /(interception return|fumble return|blocked|safety|punt return|kickoff return)/i

// ESPN-Scoring-Plays tragen keine Spieler-IDs -> Namensabgleich, streng aufs
// punktende Team begrenzt. Lieber ein Play auslassen als falsch zuordnen.
export function matchScoringPlay(play, candidates = []) {
  const text = String(play.text || '').toLowerCase()
  return candidates.filter((p) => {
    if (p.team !== play.teamAbbr) return false
    if (p.pos === 'DEF') return DEF_SCORE.test(play.text)
    return !!p.name && text.includes(p.name.toLowerCase())
  })
}

export function buildTicker({ scoringPlaysByEvent = {}, mine = [], opponents = [], newPlayIds = [] }) {
  const fresh = new Set(newPlayIds)
  const items = []
  for (const plays of Object.values(scoringPlaysByEvent)) {
    for (const play of plays) {
      const m = matchScoringPlay(play, mine)
      const o = matchScoringPlay(play, opponents)
      if (m.length || o.length) items.push({ play, mine: m, opponents: o, isNew: fresh.has(play.id) })
    }
  }
  // ponytail: Reihenfolge ueber Viertel + Restzeit, nicht Echtzeit -- parallel
  // laufende Spiele sind so nur ungefaehr chronologisch. Reicht fuer einen Ticker.
  return items.sort((a, b) =>
    (b.play.period ?? 0) - (a.play.period ?? 0) || (a.play.clockValue ?? 0) - (b.play.clockValue ?? 0))
}
