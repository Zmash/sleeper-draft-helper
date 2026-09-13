// Blend mehrerer Wochenprojektions-Quellen (Sleeper + FantasyPros) fuer den
// Dashboard-Matchup-Balken: eine einzelne Quelle geht bei Ausreissern schnell
// daneben, das arithmetische Mittel mehrerer unabhaengiger Quellen ist
// stabiler. Fehlt eine Quelle fuer einen Spieler, zaehlt die andere allein --
// fehlen beide, faellt der Spieler ganz aus der Summe (wie bisher bei
// Sleeper-only).
import { matchKey } from './waiverStats'

// sleeperWeekById: Map<sleeper_id, {pts_ppr, pts_half_ppr, pts_std}> (siehe
// useWeeklyRankingsStore.sleeperWeekById). fpPtsByKey: Map<matchKey, fantasy_pts>
// fuer EIN Scoring-Format, ueber alle benoetigten Positionen gemergt (siehe
// useWeeklyRankingsStore.getFpWeekPtsMap).
export function blendedPlayerProjection({ playerId, playersMeta, sleeperWeekById, scoringField, fpPtsByKey }) {
  const sleeperPts = sleeperWeekById?.get(String(playerId))?.[scoringField]
  const meta = playersMeta?.[playerId]
  let fpPts = null
  if (meta) {
    const pos = (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase()
    const name = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
    fpPts = fpPtsByKey?.get(matchKey(pos, { name, team: meta.team || '' })) ?? null
  }
  const values = [sleeperPts, fpPts].filter((v) => v != null)
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

// Summe der geblendeten Projektion ueber die Starter-IDs eines Matchup-
// Eintrags. null, wenn fuer KEINEN Starter irgendeine Quelle Daten hat.
export function projectedTotalForStarters({ starterIds, playersMeta, sleeperWeekById, scoringField, fpPtsByKey }) {
  if (!starterIds?.length) return null
  let sum = 0
  let any = false
  for (const id of starterIds) {
    if (!id || id === '0') continue
    const v = blendedPlayerProjection({ playerId: id, playersMeta, sleeperWeekById, scoringField, fpPtsByKey })
    if (v != null) { sum += v; any = true }
  }
  return any ? sum : null
}
