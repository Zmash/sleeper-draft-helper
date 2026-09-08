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
import { effScoringTypeToFpParam } from '../services/draftFormat'
import { freeAgents, pickupRanking, streamingBoard, bestLineup, compareToActualStarters, matchKey } from '../services/analysis/waiverStats'
import PickupSuggestions from '../components/waiver/PickupSuggestions'
import StreamingBoard from '../components/waiver/StreamingBoard'
import RecommendedLineupCard from '../components/waiver/RecommendedLineupCard'
import '../styles/analysis.css'

// Welche Streaming-Position ist in dieser Liga ueberhaupt startbar?
// DEF nur bei eigenem DEF-Slot; QB bei QB- oder SUPER_FLEX-Slot; TE bei TE-
// oder einem FLEX-Slot, der TEs aufnehmen kann (FLEX/SUPER_FLEX/REC_FLEX bzw.
// die Draft-Aliase WR/TE, RB/TE, RB/WR/TE). WRRB_FLEX (RB/WR ohne TE) zaehlt
// bewusst nicht. Fallback ist effRoster (Mocks ohne Liga), damit dort nichts
// verschwindet.
export function availableStreamPositionsFor(rosterPositions = []) {
  const set = new Set((rosterPositions || []).map((s) => String(s).toUpperCase()))
  const out = []
  if (set.has('DEF')) out.push('DEF')
  if (set.has('QB') || [...set].some((s) => s.includes('SUPER')) || set.has('SFLEX')) out.push('QB')
  const teSlots = new Set(['TE', 'FLEX', 'SUPER_FLEX', 'SFLEX', 'REC_FLEX', 'RB/WR/TE', 'WR/TE', 'RB/TE'])
  if ([...set].some((s) => teSlots.has(s) || s.includes('SUPER'))) out.push('TE')
  return out
}

export default function WaiverPage({ selectedLeague, effRoster, draftMode, effScoringType, seasonYear }) {
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
  const scoring = effScoringTypeToFpParam(effScoringType)

  // Die Lineup-Empfehlung lebt an der LIGA, nicht am gewaehlten Draft: ist ein
  // fremder (stale) Draft aktiv, dessen Format von der Liga abweicht, wuerde
  // bestLineup die falschen Slots fuellen (z.B. 7 Startplaetze inkl. DEF statt
  // der echten 10 mit SUPER_FLEX) und die halbe Bank als "nicht benutzt"
  // abwerfen. Fuer echte Ligen ist roster_positions verbindlich -- effRoster
  // bleibt nur der Fallback fuer Mocks/Formate ohne Liga-Settings.
  const lineupRosterPositions = useMemo(
    () => selectedLeague?.roster_positions || selectedLeague?.settings?.roster_positions || [],
    [selectedLeague]
  )

  // Streaming-Positionen ohne Liga-Slot ausblenden (z.B. kein DEF-Slot ->
  // kein DEF-Streaming). lineupRosterPositions ist die Liga-Wahrheit,
  // effRoster der Fallback fuer Mocks.
  const availableStreamPositions = useMemo(
    () => availableStreamPositionsFor(
      lineupRosterPositions.length ? lineupRosterPositions : effRoster
    ),
    [lineupRosterPositions, effRoster]
  )
  const effectiveStreamPositions = useMemo(
    () => streamPositions.filter((p) => availableStreamPositions.includes(p)),
    [streamPositions, availableStreamPositions]
  )

  useEffect(() => { loadPlayersMetaCached({ season: seasonYear }).then(setPlayersMeta) }, [seasonYear])

  useEffect(() => {
    fetchNflState().then((s) => setWeek(Number(s?.week) || null)).catch(() => setWeek(null))
  }, [])

  useEffect(() => {
    // Superflex-KTC-Werte unterscheiden sich deutlich von 1QB-Werten (QBs
    // steigen massiv) -- darum das Flag aus den effektiven Roster-Slots statt
    // pauschal false.
    if (isDynasty) loadDynastyValuesIfStale({ superflex: effRoster?.includes('SUPER_FLEX') ?? false })
  }, [isDynasty, effRoster, loadDynastyValuesIfStale])

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
    for (const pos of effectiveStreamPositions) {
      loadIfStale({ pos, scope: 'week', scoring })
      loadIfStale({ pos, scope: 'ros', scoring })
    }
  }, [effectiveStreamPositions, scoring, loadIfStale])

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

  const agents = useMemo(() => {
    if (!leagueRosters?.length) return []
    return freeAgents({ playersMeta, leagueRosters })
  }, [playersMeta, leagueRosters])

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
    for (const pos of effectiveStreamPositions) {
      for (const [k, v] of getRankMap({ pos, scope: 'week' })) weeklyMerged.set(k, v)
      for (const [k, v] of getRankMap({ pos, scope: 'ros' })) rosMerged.set(k, v)
    }
    return streamingBoard({ freeAgents: agents, weeklyRankByKey: weeklyMerged, rosRankByKey: rosMerged, positions: effectiveStreamPositions })
  }, [agents, effectiveStreamPositions, byKey, getRankMap])

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

  // KTC-Dynasty-Werte nach normalisiertem Namen -- Zweitspalte der Lineup-Karte
  // im Dynasty-Modus (Wochenform vs. Anlagewert nebeneinander vergleichbar).
  const ktcValueByNname = useMemo(
    () => new Map(dynastyValues.map((d) => [d.nname, d.value])),
    [dynastyValues]
  )

  // Zweite Wert-Spalte der Aufstellungs-Karte: Dynasty -> KTC-Anlagewert,
  // Redraft -> FantasyPros-ROS-Rang. Die Optimierung selbst bleibt auf dem
  // FantasyPros-Wochenranking (die Frage "wen starte ich DIESE Woche" beantwortet
  // der Wochenrang, nicht der Saisonwert) -- die Zweitquelle macht nur sichtbar,
  // wo Wochenform und Dauerwert auseinanderlaufen.
  const lineup = useMemo(() => {
    if (!dynastyRoster.length || !effRoster?.length) return null
    const result = bestLineup({
      myRosterPlayers: dynastyRoster, rosterPositions: lineupRosterPositions.length ? lineupRosterPositions : effRoster, weeklyRankByKey: weeklyRankByIdKey,
      currentWeekBye: week != null ? String(week) : null,
    })
    const altOf = isDynasty
      ? (p) => ktcValueByNname.get(p.nname) ?? null
      : (p) => rosRankByKey.get(matchKey(p.pos, p)) ?? null
    const rankOf = (p) => weeklyRankByIdKey.get(`ID:${p.sleeper_id}`) ?? null
    return {
      ...result,
      slots: result.slots.map((s) => ({ ...s, alt: s.player ? altOf(s.player) : null })),
      bench: (result.bench || []).map((p) => ({ ...p, rank: rankOf(p), alt: altOf(p) })),
    }
  }, [dynastyRoster, effRoster, lineupRosterPositions, weeklyRankByIdKey, week, isDynasty, rosRankByKey, ktcValueByNname])

  const comparison = useMemo(() => {
    if (!lineup || !actualStarterIds.length) return null
    return compareToActualStarters({ recommendedSlots: lineup.slots, actualStarterIds })
  }, [lineup, actualStarterIds])

  // Zweitspalte nur zeigen, wenn im Lineup auch echte Werte landen: eine zwar
  // geladene, aber mit den Kader-Namen nicht matchende KTC-Liste wuerde sonst
  // eine Spalte voller – erzeugen (Befund: "KTC nur fuer dynasty").
  const hasAltValues = useMemo(() => {
    if (!lineup) return false
    const all = (lineup.slots || []).map((s) => s.alt).concat((lineup.bench || []).map((p) => p.alt))
    return all.some((v) => v != null)
  }, [lineup])

  // "raus"-Diffs tragen nur eine Sleeper-ID; hier wird sie zum Namen aufgeloest.
  const rosterNameById = useMemo(() => {
    const m = {}
    for (const p of dynastyRoster) m[String(p.sleeper_id)] = p.name
    return m
  }, [dynastyRoster])

  return (
    <section className="an-page">
      <header className="an-head">
        <h2 className="an-head-title">Waiver-Wire</h2>
        <span className="an-head-meta">{isDynasty ? 'Dynasty' : 'Redraft'}{week ? ` · Woche ${week}` : ''}</span>
      </header>
      <div className="an-grid an-grid--waiver">
        {mySleeperRosterId != null && (
          <RecommendedLineupCard
            lineup={lineup}
            comparison={comparison}
            leagueId={selectedLeague?.league_id}
            rosterNameById={rosterNameById}
            altLabel={isDynasty ? 'KTC' : 'ROS'}
            altKind={isDynasty ? 'value' : 'rank'}
            altLoaded={hasAltValues}
            sourceNote={isDynasty
              ? `Woche: FantasyPros-Wochenranking${hasAltValues ? ' · KTC: KeepTradeCut-Dynastywert (Anlagewert)' : ''}`
              : `Woche/ROS: FantasyPros-Rankings (${scoring.toUpperCase()})`}
          />
        )}
        <PickupSuggestions players={pickups} mode={isDynasty ? 'dynasty' : 'redraft'} />
        <StreamingBoard board={board} positions={effectiveStreamPositions} availablePositions={availableStreamPositions} onTogglePosition={toggleStreamPosition} />
      </div>
    </section>
  )
}
