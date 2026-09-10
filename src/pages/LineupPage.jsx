// src/pages/LineupPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { useDynastyValuesStore } from '../stores/useDynastyValuesStore'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { useUIStore } from '../stores/useUIStore'
import { useTrendingPlayers } from '../hooks/useTrendingPlayers'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchNflState, fetchMatchups, fetchLeagueRosters } from '../services/api'
import { effScoringTypeToFpParam } from '../services/draftFormat'
import { freeAgents, pickupRanking, streamingBoard, bestLineup, compareToActualStarters, matchKey } from '../services/analysis/waiverStats'
import { buildAllTeamsRows } from '../services/analysis/allTeamsLineup'
import { normalizePlayerName } from '../utils/formatting'
import PickupSuggestions from '../components/waiver/PickupSuggestions'
import StreamingBoard from '../components/waiver/StreamingBoard'
import RecommendedLineupCard from '../components/waiver/RecommendedLineupCard'
import AllTeamsOverview from '../components/waiver/AllTeamsOverview'
import PlayerDetailSheet from '../components/PlayerDetailSheet'
import PushOptIn from '../components/PushOptIn'
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

export default function LineupPage({ selectedLeague, effRoster, draftMode, effScoringType, seasonYear }) {
  const { sleeperUserId, availableLeagues } = useSessionStore()
  const { leagueRosters, mySleeperRosterId, dynastyRoster } = useDynastyStore()
  const [allTab, setAllTab] = useState(false)
  const [allTeams, setAllTeams] = useState([])
  const [allLoading, setAllLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState(null)
  const { dynastyValues, loadDynastyValuesIfStale } = useDynastyValuesStore()
  const { byKey, sleeperWeekById, loadIfStale, loadSleeperWeekIfStale, getRankMap } = useWeeklyRankingsStore()
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

  // Flex-Slots werden nach positionsuebergreifendem Consensus besetzt (kein
  // Positions-Rang-Vergleich, siehe bestLineup): FLEX-ECR fuer FLEX/REC_FLEX/
  // WRRB_FLEX, Superflex-ECR fuer SUPER_FLEX. Nur laden, wenn die Liga den
  // Slot-Typ ueberhaupt hat -- sonst kein zusaetzlicher Request.
  const flexSlotKinds = useMemo(() => {
    const set = new Set((lineupRosterPositions.length ? lineupRosterPositions : effRoster || []).map((s) => String(s).toUpperCase()))
    return {
      flex: ['FLEX', 'REC_FLEX', 'WRRB_FLEX'].some((s) => set.has(s)),
      superflex: set.has('SUPER_FLEX'),
    }
  }, [lineupRosterPositions, effRoster])

  useEffect(() => {
    if (flexSlotKinds.flex) loadIfStale({ pos: 'FLEX', scope: 'week', scoring })
    if (flexSlotKinds.superflex) loadIfStale({ pos: 'SUPER_FLEX', scope: 'week', scoring })
  }, [flexSlotKinds, scoring, loadIfStale])

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

  // Pkt-Werte aus der Sleeper-Wochenprojektion (ein Request, native
  // Sleeper-IDs) -- in beiden Modi: im Dynasty-Modus stehen sie als
  // Wochenform neben dem KTC-Anlagewert.
  useEffect(() => {
    if (week != null) loadSleeperWeekIfStale({ season: seasonYear, week })
  }, [week, seasonYear, loadSleeperWeekIfStale])

  useEffect(() => {
    if (!selectedLeague?.league_id || !week) return
    fetchMatchups(selectedLeague.league_id, week)
      .then((matchups) => {
        const mine = (matchups || []).find((m) => m.roster_id === mySleeperRosterId)
        setActualStarterIds(mine?.starters || [])
      })
      .catch(() => setActualStarterIds([]))
  }, [selectedLeague?.league_id, week, mySleeperRosterId])

  // "Alle Teams": Kader aller Ligen laden (einmal pro Tab-Wechsel), daraus je
  // Liga Starter + Empfehlung bestimmen. Starters kommen aus dem
  // Roster-Objekt (starters-Array) -- kein Matchups-Request je Liga nötig.
  useEffect(() => {
    if (!allTab || !sleeperUserId) return
    let cancelled = false
    setAllLoading(true)
    const leagues = availableLeagues || []
    Promise.all(leagues.map(async (lg) => {
      try {
        const rosters = await fetchLeagueRosters(lg.league_id)
        const mine = (rosters || []).find((r) => String(r.owner_id) === String(sleeperUserId))
        if (!mine) return null
        const starterSet = new Set((mine.starters || []).map(String))
        const roster = (mine.players || []).map((id) => {
          const meta = playersMeta[id] || {}
          const name = meta.full_name
            || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
            || `#${id}`
          return {
            sleeper_id: String(id),
            name,
            nname: normalizePlayerName(name),
            pos: (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
            team: meta.team || '',
            bye: meta.bye_week != null ? String(meta.bye_week) : '',
            injury_status: meta.injury_status || null,
            slot: starterSet.has(String(id)) ? 'starter' : 'bench',
          }
        })
        const positions = lg.roster_positions || []
        // Empfehlung je Liga mit derselben Engine wie die Einzelansicht:
        // ID-gemappte Wochenränge aus den bereits geladenen FantasyPros-Maps.
        const wk = new Map()
        const fx = new Map()
        const sfx = new Map()
        for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF']) {
          const rm = getRankMap({ pos, scope: 'week' })
          for (const p of roster.filter((r) => r.pos === pos)) {
            const v = rm.get(matchKey(pos, p))
            if (v != null) wk.set(`ID:${p.sleeper_id}`, v)
          }
        }
        const flexMap = getRankMap({ pos: 'FLEX', scope: 'week' })
        const sflexMap = getRankMap({ pos: 'SUPER_FLEX', scope: 'week' })
        for (const p of roster) {
          const fv = flexMap.get(matchKey(p.pos, p))
          if (fv != null) fx.set(`ID:${p.sleeper_id}`, fv)
          const sv = sflexMap.get(matchKey(p.pos, p))
          if (sv != null) sfx.set(`ID:${p.sleeper_id}`, sv)
        }
        let recommended = []
        try {
          const res = bestLineup({
            myRosterPlayers: roster,
            rosterPositions: positions.length ? positions : effRoster,
            weeklyRankByKey: wk, flexRankByKey: fx, superflexRankByKey: sfx,
            currentWeekBye: week != null ? String(week) : null,
          })
          recommended = (res.slots || []).filter((s) => s.player).map((s) => String(s.player.sleeper_id))
        } catch { recommended = [] }
        return {
          leagueId: lg.league_id,
          leagueName: lg.name || lg.league_id,
          week: week != null ? String(week) : null,
          roster,
          actualStarterIds: [...starterSet],
          recommendedStarterIds: recommended,
        }
      } catch { return null }
    })).then((teams) => {
      if (!cancelled) {
        setAllTeams(teams.filter(Boolean))
        setAllLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [allTab, sleeperUserId, availableLeagues, playersMeta, week, effRoster, byKey, getRankMap])

  const allRows = useMemo(() => buildAllTeamsRows({ teams: allTeams }), [allTeams])

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

  // Projizierte Wochenpunkte je Sleeper-ID im Liga-Scoringformat (Pkt-Spalten
  // in Aufstellung, Pickup-Liste und Streaming-Board). Quelle ist die
  // Sleeper-Wochenprojektion -- native IDs, kein Name-Matching.
  const sleeperPtsByPlayerId = useMemo(() => {
    const field = effScoringType === 'half_ppr' ? 'pts_half_ppr' : effScoringType === 'standard' ? 'pts_std' : 'pts_ppr'
    const map = new Map()
    for (const [id, e] of sleeperWeekById) {
      const v = e?.[field]
      if (v != null) map.set(String(id), v)
    }
    return map
  }, [sleeperWeekById, effScoringType])

  const pickups = useMemo(
    () => pickupRanking({
      freeAgents: agents, mode: isDynasty ? 'dynasty' : 'redraft', dynastyValues, rosRankByKey, trendingAddIds,
    }).map((p) => ({ ...p, pts: sleeperPtsByPlayerId.get(String(p.player_id)) ?? null })),
    [agents, isDynasty, dynastyValues, rosRankByKey, trendingAddIds, sleeperPtsByPlayerId]
  )

  // Pkt-Spalten in beiden Modi (Dynasty: Wochenform neben KTC), aber nur bei
  // echten Daten -- gleiche Guards wie in der Lineup-Karte.
  const pickupPtsLoaded = useMemo(
    () => pickups.some((p) => p.pts != null),
    [pickups]
  )

  const board = useMemo(() => {
    const weeklyMerged = new Map()
    const rosMerged = new Map()
    for (const pos of effectiveStreamPositions) {
      for (const [k, v] of getRankMap({ pos, scope: 'week' })) weeklyMerged.set(k, v)
      for (const [k, v] of getRankMap({ pos, scope: 'ros' })) rosMerged.set(k, v)
    }
    return streamingBoard({ freeAgents: agents, weeklyRankByKey: weeklyMerged, rosRankByKey: rosMerged, ptsByPlayerId: sleeperPtsByPlayerId, positions: effectiveStreamPositions })
  }, [agents, effectiveStreamPositions, byKey, getRankMap, sleeperPtsByPlayerId])

  const streamPtsLoaded = useMemo(
    () => Object.values(board).some((b) => (b.week || []).some((p) => p.pts != null)),
    [board]
  )

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

  // ID-gemappte Flex-Raenge je Kader-Spieler (NAME-Match wie oben; DEF kommt
  // in keinem Flex-Ranking vor und bleibt aussen vor).
  const flexRankByIdKey = useMemo(() => {
    if (!flexSlotKinds.flex) return new Map()
    const rankMap = getRankMap({ pos: 'FLEX', scope: 'week' })
    const map = new Map()
    for (const p of dynastyRoster.filter((r) => ['RB', 'WR', 'TE'].includes(r.pos))) {
      const v = rankMap.get(matchKey(p.pos, p))
      if (v != null) map.set(`ID:${p.sleeper_id}`, v)
    }
    return map
  }, [flexSlotKinds, dynastyRoster, byKey, getRankMap])

  const superflexRankByIdKey = useMemo(() => {
    if (!flexSlotKinds.superflex) return new Map()
    const rankMap = getRankMap({ pos: 'SUPER_FLEX', scope: 'week' })
    const map = new Map()
    for (const p of dynastyRoster.filter((r) => ['QB', 'RB', 'WR', 'TE'].includes(r.pos))) {
      const v = rankMap.get(matchKey(p.pos, p))
      if (v != null) map.set(`ID:${p.sleeper_id}`, v)
    }
    return map
  }, [flexSlotKinds, dynastyRoster, byKey, getRankMap])

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
      flexRankByKey: flexRankByIdKey, superflexRankByKey: superflexRankByIdKey,
      currentWeekBye: week != null ? String(week) : null,
    })
    const altOf = isDynasty
      ? (p) => ktcValueByNname.get(p.nname) ?? null
      : (p) => rosRankByKey.get(matchKey(p.pos, p)) ?? null
    const rankOf = (p) => weeklyRankByIdKey.get(`ID:${p.sleeper_id}`) ?? null
    const ptsOf = (p) => sleeperPtsByPlayerId.get(String(p.sleeper_id)) ?? null
    return {
      ...result,
      slots: result.slots.map((s) => ({ ...s, alt: s.player ? altOf(s.player) : null, pts: s.player ? ptsOf(s.player) : null })),
      bench: (result.bench || []).map((p) => ({ ...p, rank: rankOf(p), alt: altOf(p), pts: ptsOf(p) })),
    }
  }, [dynastyRoster, effRoster, lineupRosterPositions, weeklyRankByIdKey, flexRankByIdKey, superflexRankByIdKey, sleeperPtsByPlayerId, week, isDynasty, rosRankByKey, ktcValueByNname])

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

  // Pkt-Spalte nur zeigen, wenn mindestens ein Lineup-Spieler eine echte
  // Projektion hat (gleiche Logik wie hasAltValues).
  const hasPtsValues = useMemo(() => {
    if (!lineup) return false
    const all = (lineup.slots || []).map((s) => s.pts).concat((lineup.bench || []).map((p) => p.pts))
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
        <h2 className="an-head-title">Lineup</h2>
        <span className="an-head-meta">{isDynasty ? 'Dynasty' : 'Redraft'}{week ? ` · Woche ${week}` : ''}</span>
        <PushOptIn />
      </header>
      <div className="an-tabs" role="tablist" aria-label="Lineup-Ansicht">
        <button type="button" role="tab" aria-selected={!allTab} className={`an-tab${!allTab ? ' is-on' : ''}`} onClick={() => setAllTab(false)}>
          Einzelnes Team
        </button>
        <button type="button" role="tab" aria-selected={allTab} className={`an-tab${allTab ? ' is-on' : ''}`} onClick={() => setAllTab(true)}>
          Alle Teams
        </button>
      </div>
      {allTab ? (
        <div className="an-grid an-grid--waiver">
          <AllTeamsOverview rows={allRows} loading={allLoading} onSelectPlayer={setSelectedRow} />
          {selectedRow && (
            <div className="an-card">
              <div className="an-lineup-head">
                <h3 className="an-card-title">{selectedRow.player.name}</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedRow(null)}>Schließen</button>
              </div>
              <p className="muted">
                {selectedRow.leagueName} · {selectedRow.isStarter ? 'aufgestellt' : 'Bank'}
                {selectedRow.player.team ? ` · ${selectedRow.player.team}` : ''}
                {selectedRow.player.bye ? ` · Bye ${selectedRow.player.bye}` : ''}
                {selectedRow.player.injury_status ? ` · ${selectedRow.player.injury_status}` : ''}
              </p>
              <a
                className="an-cta"
                href={`https://sleeper.com/leagues/${selectedRow.leagueId}/team`}
                target="_blank"
                rel="noreferrer"
              >
                In Sleeper öffnen
              </a>
            </div>
          )}
          {selectedRow && (
            <PlayerDetailSheet player={selectedRow.player} onClose={() => setSelectedRow(null)} />
          )}
        </div>
      ) : (
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
            ptsLoaded={hasPtsValues}
            sourceNote={isDynasty
              ? `Woche: FantasyPros-Wochenranking (Rang: kleiner = besser)${hasAltValues ? ' · KTC: KeepTradeCut-Dynastiewert, Anlagewert (größer = besser)' : ''}${hasPtsValues ? ' · Pkt: Sleeper-Wochenprojektion' : ''}`
              : `Woche/ROS: FantasyPros (${scoring.toUpperCase()})${hasPtsValues ? ' · Pkt: Sleeper-Wochenprojektion' : ''} · Ränge: kleiner = besser`}
          />
        )}
        <PickupSuggestions
          players={pickups}
          mode={isDynasty ? 'dynasty' : 'redraft'}
          ptsLoaded={pickupPtsLoaded}
          sourceNote={isDynasty
            ? `KTC: KeepTradeCut-Dynastiewert (größer = besser)${pickupPtsLoaded ? ' · Pkt: Sleeper-Wochenprojektion' : ''}`
            : `ROS: FantasyPros-Rest-der-Saison-Rang (kleiner = besser)${pickupPtsLoaded ? ' · Pkt: Sleeper-Wochenprojektion' : ''}`}
        />
        <StreamingBoard
          board={board}
          positions={effectiveStreamPositions}
          availablePositions={availableStreamPositions}
          onTogglePosition={toggleStreamPosition}
          ptsLoaded={streamPtsLoaded}
          sourceNote={`Woche/ROS: FantasyPros (${scoring.toUpperCase()})${streamPtsLoaded ? ' · Pkt: Sleeper-Wochenprojektion' : ''} · Ränge: kleiner = besser`}
        />
      </div>
      )}
    </section>
  )
}
