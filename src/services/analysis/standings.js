// Tabellenplatz aus den Liga-Rosters. Sleeper liefert keinen Rang mit -- die
// Sortierung ist dieselbe wie in Sleepers eigener Tabelle: Siege zuerst, bei
// Gleichstand die erzielten Punkte (fpts + fpts_decimal/100, so legt Sleeper
// die Nachkommastellen ab).

function pointsFor(roster) {
  const s = roster?.settings || {}
  return (s.fpts || 0) + (s.fpts_decimal || 0) / 100
}

/** @returns {number|null} 1-basierter Platz, null wenn nicht ermittelbar. */
export function standingsRankFor(rosters, myRosterId) {
  if (!rosters?.length || myRosterId == null) return null
  const sorted = [...rosters].sort(
    (a, b) =>
      (b.settings?.wins || 0) - (a.settings?.wins || 0) ||
      pointsFor(b) - pointsFor(a)
  )
  const idx = sorted.findIndex((r) => r.roster_id === myRosterId)
  return idx === -1 ? null : idx + 1
}
