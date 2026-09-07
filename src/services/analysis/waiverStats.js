import { normalizePlayerName } from '../../utils/formatting'

const WAIVER_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'DEF'])

// Sleeper stellt Team-Defenses als "Spieler" mit Team-Kuerzel als ID dar,
// FantasyPros identifiziert dieselbe Defense ueber player_team_id -- deshalb
// braucht DEF einen eigenen Match-Key (Team), waehrend alles andere ueber den
// normalisierten Namen gematcht wird (gleiche Konvention wie rosterStats.js).
export function matchKey(pos, { nname, name, team } = {}) {
  if (pos === 'DEF') return `TEAM:${String(team || '').toUpperCase()}`
  return `NAME:${nname || normalizePlayerName(name || '')}`
}

export function freeAgents({ playersMeta = {}, leagueRosters = [] }) {
  const rostered = new Set()
  for (const r of leagueRosters || []) {
    for (const p of r.players || []) rostered.add(String(p.sleeper_id))
  }
  const out = []
  for (const [id, meta] of Object.entries(playersMeta || {})) {
    if (rostered.has(String(id))) continue
    if (meta?.status && meta.status !== 'Active') continue
    const pos = (meta?.fantasy_positions?.[0] || meta?.position || '').toUpperCase()
    if (!WAIVER_POSITIONS.has(pos)) continue
    const name = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
    out.push({
      player_id: id,
      name,
      nname: normalizePlayerName(name),
      pos,
      team: meta.team || '',
      bye: meta.bye_week != null ? String(meta.bye_week) : '',
      injury_status: meta.injury_status || null,
    })
  }
  return out
}

// mode 'dynasty': dynastyValues (KTC, {nname, value}) -> hoechster Wert zuerst.
// mode 'redraft': rosRankByKey (Map von matchKey -> ECR-Zahl) -> niedrigster (bester) Rang zuerst.
// Spieler ohne Treffer in der jeweiligen Quelle landen ans Ende, fallen aber nicht raus
// (sie bleiben in der Liste sichtbar, nur unsortiert am Ende -- lieber zeigen als verstecken).
export function pickupRanking({
  freeAgents: agents = [], mode = 'redraft', dynastyValues = [], rosRankByKey = new Map(), trendingAddIds = new Set(),
} = {}) {
  const dynastyByName = new Map((dynastyValues || []).map((d) => [d.nname, d.value]))
  const withValue = agents.map((a) => {
    const key = matchKey(a.pos, a)
    const value = mode === 'dynasty' ? dynastyByName.get(a.nname) ?? null : rosRankByKey.get(key) ?? null
    return { ...a, value, trending: trendingAddIds.has(a.player_id) }
  })
  const hasValue = withValue.filter((a) => a.value != null)
  const noValue = withValue.filter((a) => a.value == null)
  hasValue.sort((x, y) => (mode === 'dynasty' ? y.value - x.value : x.value - y.value))
  return [...hasValue, ...noValue]
}

function sortByRank(agents, rankByKey) {
  return agents
    .map((a) => ({ ...a, rank: rankByKey.get(matchKey(a.pos, a)) ?? null }))
    .filter((a) => a.rank != null)
    .sort((x, y) => x.rank - y.rank)
}

export function streamingBoard({ freeAgents: agents = [], weeklyRankByKey = new Map(), rosRankByKey = new Map(), positions = [] } = {}) {
  const out = {}
  for (const pos of positions) {
    const posAgents = agents.filter((a) => a.pos === pos)
    out[pos] = {
      week: sortByRank(posAgents, weeklyRankByKey),
      ros: sortByRank(posAgents, rosRankByKey),
    }
  }
  return out
}

const FLEX_ELIGIBLE = { FLEX: ['RB', 'WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'] }

// Greedy statt echtem bipartiten Matching: pro fixem Positions-Slot den
// bestplatzierten passenden Spieler zuerst, danach FLEX-Slots aus dem Rest.
// Das ist Standard fuer Fantasy-Lineup-Tools und in der Praxis fast immer
// optimal (Abweichungen nur in seltenen Randfaellen mit mehreren FLEX-Typen
// gleichzeitig) -- ponytail: greedy statt Optimalloesung, bei Bedarf durch
// echtes Matching ersetzen, falls FLEX/SUPER_FLEX gemeinsam vorkommen und
// Fehlzuteilungen auffallen.
export function bestLineup({ myRosterPlayers = [], rosterPositions = [], weeklyRankByKey = new Map(), currentWeekBye = null } = {}) {
  const eligible = myRosterPlayers.filter((p) => {
    if (currentWeekBye != null && String(p.bye) === String(currentWeekBye)) return false
    if (p.injury_status === 'Out' || p.injury_status === 'IR') return false
    return true
  })
  const rankOf = (p) => weeklyRankByKey.get(`ID:${p.sleeper_id}`) ?? Infinity
  const used = new Set()
  const slots = []

  const fixedSlots = rosterPositions.filter((s) => s !== 'BN' && !FLEX_ELIGIBLE[s])
  const flexSlots = rosterPositions.filter((s) => FLEX_ELIGIBLE[s])

  const slotCounters = {}
  function nextSlotIndex(slot) {
    slotCounters[slot] = (slotCounters[slot] || 0) + 1
    return slotCounters[slot] - 1
  }

  for (const slot of fixedSlots) {
    const candidates = eligible
      .filter((p) => p.pos === slot && !used.has(p.sleeper_id))
      .sort((a, b) => rankOf(a) - rankOf(b))
    const player = candidates[0] || null
    if (player) used.add(player.sleeper_id)
    slots.push({ slot, slotIndex: nextSlotIndex(slot), player, rank: player ? rankOf(player) : null })
  }
  for (const slot of flexSlots) {
    const allowedPos = FLEX_ELIGIBLE[slot]
    const candidates = eligible
      .filter((p) => allowedPos.includes(p.pos) && !used.has(p.sleeper_id))
      .sort((a, b) => rankOf(a) - rankOf(b))
    const player = candidates[0] || null
    if (player) used.add(player.sleeper_id)
    slots.push({ slot, slotIndex: nextSlotIndex(slot), player, rank: player ? rankOf(player) : null })
  }

  const bench = myRosterPlayers.filter((p) => !used.has(p.sleeper_id))
  return { slots, bench }
}

export function compareToActualStarters({ recommendedSlots = [], actualStarterIds = [] } = {}) {
  const actual = new Set((actualStarterIds || []).map(String))
  const recommended = new Set(recommendedSlots.filter((s) => s.player).map((s) => String(s.player.sleeper_id)))
  const diffs = []
  for (const s of recommendedSlots) {
    if (!s.player) continue
    const id = String(s.player.sleeper_id)
    if (!actual.has(id)) diffs.push({ slot: s.slot, in: id, name: s.player.name })
  }
  const isOptimal = diffs.length === 0 && actual.size === recommended.size
  return { isOptimal, diffs }
}
