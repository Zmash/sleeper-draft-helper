// Wochenprojektionen aus zwei unabhaengigen Quellen (Sleeper + FantasyPros),
// geteilt von Dashboard-Matchups und Redzone. Gemittelt wird spaeter pro
// Spieler in matchupProjection.blendedPlayerProjection. Beide Stores cachen 6h.
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'

// Positionen identisch zur Sleeper-Wochenprojektion (rankings.js
// SLEEPER_WEEK_POSITIONS); FP-Scoring-Slug je App-Scoringtyp.
export const FP_WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']
export const FP_SCORING_FOR_TYPE = { ppr: 'ppr', half_ppr: 'half', standard: 'std' }

export function detectScoringType(league) {
  const rec = Number(league?.scoring_settings?.rec ?? 1)
  return rec >= 0.95 ? 'ppr' : rec >= 0.45 ? 'half_ppr' : 'standard'
}

export async function loadWeekProjections({ season, week, scoringTypes }) {
  const store = useWeeklyRankingsStore.getState()
  await Promise.all([
    store.loadSleeperWeekIfStale({ season, week }).catch(() => {}),
    ...[...scoringTypes].flatMap((type) =>
      FP_WEEK_POSITIONS.map((pos) =>
        store.loadFpWeekPtsIfStale({ pos, scoring: FP_SCORING_FOR_TYPE[type] || 'ppr' }).catch(() => {})
      )
    ),
  ])
}

// matchKey-Namespaces ueberschneiden sich nicht zwischen Positionen
// (siehe waiverStats.matchKey) -> einfaches Mergen ist verlustfrei.
export function fpPtsMapFor(scoringType) {
  const store = useWeeklyRankingsStore.getState()
  const scoring = FP_SCORING_FOR_TYPE[scoringType] || 'ppr'
  const merged = new Map()
  for (const pos of FP_WEEK_POSITIONS) {
    for (const [k, v] of store.getFpWeekPtsMap({ pos, scoring })) merged.set(k, v)
  }
  return merged
}
