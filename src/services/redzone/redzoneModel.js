// Reine Redzone-Logik: aus Rohdaten (ESPN-Spiele, Sleeper-Matchups/Rosters/
// Users, playersMeta) die Bausteine der Seite bauen. Kein Fetch, kein Store.

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
