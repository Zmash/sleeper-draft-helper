// src/pages/WaiverPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { useDynastyValuesStore } from '../stores/useDynastyValuesStore'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { useUIStore } from '../stores/useUIStore'
import { useTrendingPlayers } from '../hooks/useTrendingPlayers'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchNflState, fetchMatchups } from '../services/api'
import { freeAgents, pickupRanking, streamingBoard, bestLineup, compareToActualStarters, matchKey } from '../services/analysis/waiverStats'
import PickupSuggestions from '../components/waiver/PickupSuggestions'
import StreamingBoard from '../components/waiver/StreamingBoard'
import RecommendedLineupCard from '../components/waiver/RecommendedLineupCard'
import '../styles/analysis.css'

export default function WaiverPage({ selectedLeague, effRoster, draftMode, effScoringType }) {
  const { sleeperUserId } = useSessionStore()
  const { leagueRosters, mySleeperRosterId, dynastyRoster } = useDynastyStore()
  const { dynastyValues, loadDynastyValuesIfStale } = useDynastyValuesStore()
  const { byKey, loadIfStale, getRankMap } = useWeeklyRankingsStore()
  const { streamPositions, toggleStreamPosition } = useUIStore()
  const { adds } = useTrendingPlayers()

  const [playersMeta, setPlayersMeta] = useState({})
  const [week, setWeek] = useState(null)
  const [actualStarterIds, setActualStarterIds] = useState([])
  const isDynasty = draftMode === 'rookie'
  const scoring = effScoringType === 'ppr' || effScoringType === 'half' || effScoringType === 'std' ? effScoringType : 'ppr'

  useEffect(() => { loadPlayersMetaCached().then(setPlayersMeta) }, [])

  useEffect(() => {
    fetchNflState().then((s) => setWeek(Number(s?.week) || null)).catch(() => setWeek(null))
  }, [])

  useEffect(() => {
    if (isDynasty) loadDynastyValuesIfStale({ superflex: false })
  }, [isDynasty, loadDynastyValuesIfStale])

  // Eigene Kader-Positionen bestimmen die Weekly-Rankings, die fuer die
  // Lineup-Empfehlung gebraucht werden -- nicht nur die 3 Streaming-Positionen.
  const rosterPositionsPresent = useMemo(
    () => Array.from(new Set(dynastyRoster.map((p) => p.pos).filter((p) => ['QB', 'RB', 'WR', 'TE', 'DEF'].includes(p)))),
    [dynastyRoster]
  )

  useEffect(() => {
    for (const pos of rosterPositionsPresent) loadIfStale({ pos, scope: 'week', scoring })
  }, [rosterPositionsPresent, scoring, loadIfStale])

  useEffect(() => {
    for (const pos of streamPositions) {
      loadIfStale({ pos, scope: 'week', scoring })
      loadIfStale({ pos, scope: 'ros', scoring })
    }
  }, [streamPositions, scoring, loadIfStale])

  // Pickup-Ranking im Redraft-Modus sortiert ueber ALLE Free-Agent-Positionen
  // nach ROS-Rang -- dafuer muessen alle 5 Positionen geladen sein, nicht nur
  // Streaming-Positionen und eigener Kader.
  useEffect(() => {
    if (isDynasty) return
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF']) loadIfStale({ pos, scope: 'ros', scoring })
  }, [isDynasty, scoring, loadIfStale])

  useEffect(() => {
    if (!selectedLeague?.league_id || !week) return
    fetchMatchups(selectedLeague.league_id, week)
      .then((matchups) => {
        const mine = (matchups || []).find((m) => m.roster_id === mySleeperRosterId)
        setActualStarterIds(mine?.starters || [])
      })
      .catch(() => setActualStarterIds([]))
  }, [selectedLeague?.league_id, week, mySleeperRosterId])

  const agents = useMemo(() => freeAgents({ playersMeta, leagueRosters }), [playersMeta, leagueRosters])

  const rosRankByKey = useMemo(() => {
    const merged = new Map()
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF']) {
      for (const [k, v] of getRankMap({ pos, scope: 'ros' })) merged.set(k, v)
    }
    return merged
  }, [byKey, getRankMap])

  const trendingAddIds = useMemo(() => new Set(adds.map((a) => a.player_id)), [adds])

  const pickups = useMemo(
    () => pickupRanking({
      freeAgents: agents, mode: isDynasty ? 'dynasty' : 'redraft', dynastyValues, rosRankByKey, trendingAddIds,
    }),
    [agents, isDynasty, dynastyValues, rosRankByKey, trendingAddIds]
  )

  const board = useMemo(() => {
    const weeklyMerged = new Map()
    const rosMerged = new Map()
    for (const pos of streamPositions) {
      for (const [k, v] of getRankMap({ pos, scope: 'week' })) weeklyMerged.set(k, v)
      for (const [k, v] of getRankMap({ pos, scope: 'ros' })) rosMerged.set(k, v)
    }
    return streamingBoard({ freeAgents: agents, weeklyRankByKey: weeklyMerged, rosRankByKey: rosMerged, positions: streamPositions })
  }, [agents, streamPositions, byKey, getRankMap])

  const weeklyRankByIdKey = useMemo(() => {
    const map = new Map()
    for (const pos of rosterPositionsPresent) {
      const rankMap = getRankMap({ pos, scope: 'week' })
      for (const p of dynastyRoster.filter((r) => r.pos === pos)) {
        const key = matchKey(pos, p)
        if (rankMap.has(key)) map.set(`ID:${p.sleeper_id}`, rankMap.get(key))
      }
    }
    return map
  }, [rosterPositionsPresent, dynastyRoster, byKey, getRankMap])

  const lineup = useMemo(() => {
    if (!dynastyRoster.length || !effRoster?.length) return null
    return bestLineup({ myRosterPlayers: dynastyRoster, rosterPositions: effRoster, weeklyRankByKey: weeklyRankByIdKey })
  }, [dynastyRoster, effRoster, weeklyRankByIdKey])

  const comparison = useMemo(() => {
    if (!lineup || !actualStarterIds.length) return null
    return compareToActualStarters({ recommendedSlots: lineup.slots, actualStarterIds })
  }, [lineup, actualStarterIds])

  return (
    <section className="an-page">
      <h2>Waiver-Wire</h2>
      <PickupSuggestions players={pickups} mode={isDynasty ? 'dynasty' : 'redraft'} />
      <StreamingBoard board={board} positions={streamPositions} onTogglePosition={toggleStreamPosition} />
      {mySleeperRosterId != null && <RecommendedLineupCard lineup={lineup} comparison={comparison} />}
    </section>
  )
}
