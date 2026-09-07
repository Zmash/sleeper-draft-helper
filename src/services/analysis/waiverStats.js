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
