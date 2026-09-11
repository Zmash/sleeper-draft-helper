// Rest-Spielplan aus Sleeper-Matchups: /matchups/{woche} liefert pro Roster
// { matchup_id, roster_id } -- gleiche matchup_id = Gegner dieser Woche.
// Nur Wochen >= fromWeek, nur vollstaendige Paare (unvollstaendige = Bye-Week
// der Liga oder fehlgeschlagener Request, beides wird uebersprungen).
export function buildRemainingSchedule({ matchupsByWeek, fromWeek }) {
  const from = Number(fromWeek) || 1
  const out = []
  for (const [week, matchups] of matchupsByWeek || []) {
    const w = Number(week)
    if (!Number.isFinite(w) || w < from) continue
    const byMatchup = new Map()
    for (const m of matchups || []) {
      if (m?.matchup_id == null || m?.roster_id == null) continue
      const key = String(m.matchup_id)
      if (!byMatchup.has(key)) byMatchup.set(key, [])
      byMatchup.get(key).push(String(m.roster_id))
    }
    for (const ids of byMatchup.values()) {
      if (ids.length === 2) out.push({ week: w, a: ids[0], b: ids[1] })
    }
  }
  out.sort((x, y) => x.week - y.week)
  return out
}

// Playoff-Format: echte Sleeper-Felder zuerst (settings.playoff_teams,
// settings.playoff_week_start — verifiziert 2026-09-11 am FFL-Bochum-Objekt),
// dann ai.js-Konvention (league.playoff_start_week), dann Defaults 15/6.
// Die falsche Reihenfolge fiel nie auf, weil der Fallback hier zufaellig
// stimmte — in Ligen mit anderem Format waere sie falsch gewesen.
export function playoffCutoff({ league }) {
  const start = Number(league?.settings?.playoff_week_start ?? league?.playoff_start_week)
  const teams = Number(league?.settings?.playoff_teams ?? league?.settings?.playoff_teams_count)
  return {
    playoffWeekStart: Number.isFinite(start) && start > 0 ? start : 15,
    playoffTeams: Number.isFinite(teams) && teams > 0 ? teams : 6,
  }
}
