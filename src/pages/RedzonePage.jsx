import { useCallback, useEffect, useMemo } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useRedzoneStore } from '../stores/useRedzoneStore'
import { useGamesLiveStore } from '../stores/useGamesLiveStore'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { detectScoringType, loadWeekProjections, fpPtsMapFor } from '../services/weekProjections'
import { pointsFieldFor } from '../services/analysis/seasonSim'
import { blendedPlayerProjection } from '../services/analysis/matchupProjection'
import {
  selectedLeagueIds, gamesByTeam, buildMatchupTiles, buildPlayers, buildRedzoneAlerts, buildTicker, countsByGame,
} from '../services/redzone/redzoneModel'
import {
  LeagueChips, GameStrip, MatchupRow, MyPlayers, OpponentsLive, RedzoneAlerts, ScoringTicker, Stamp,
} from '../components/redzone/RedzoneParts'
import Icon from '../components/Icon'
import '../styles/redzone.css'

export default function RedzonePage() {
  const { sleeperUserId, seasonYear, availableLeagues, cardNicknames } = useSessionStore()
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const rz = useRedzoneStore()
  const sleeperWeekById = useWeeklyRankingsStore((s) => s.sleeperWeekById)
  const fpWeekPtsByScoring = useWeeklyRankingsStore((s) => s.fpWeekPtsByScoring)

  const leagues = useMemo(() => availableLeagues || [], [availableLeagues])
  const allIds = useMemo(() => leagues.map((l) => l.league_id), [leagues])
  const activeIds = selectedLeagueIds(allIds, rz.deselectedLeagueIds)
  const filterKey = activeIds.join(',')
  const labelOf = (l) => cardNicknames?.[l.league_id] || l.name

  const pollNow = useCallback(
    () => rz.poll({ leagues, season: seasonYear, myUserId: sleeperUserId }),
    [rz.poll, leagues, seasonYear, sleeperUserId] // eslint-disable-line
  )

  // Laden beim Oeffnen und bei jedem Filterwechsel (filterKey in den Deps).
  // Den wiederkehrenden Takt stellt die zentrale Auto-Sync-Schleife in App.jsx
  // (services/pageSync.js) — ein eigenes Intervall hier wuerde doppelt holen.
  useEffect(() => {
    if (!leagues.length || !sleeperUserId) return
    pollNow()
  }, [pollNow, filterKey]) // eslint-disable-line

  // Projektionen je Woche und benoetigtem Scoring (Stores cachen 6h).
  const scoringKey = [...new Set(leagues.map(detectScoringType))].sort().join(',')
  useEffect(() => {
    if (!rz.week || !scoringKey) return
    loadWeekProjections({ season: seasonYear, week: rz.week, scoringTypes: scoringKey.split(',') })
  }, [rz.week, scoringKey, seasonYear])

  const fpMaps = useMemo(
    () => Object.fromEntries(scoringKey.split(',').filter(Boolean).map((t) => [t, fpPtsMapFor(t)])),
    [scoringKey, fpWeekPtsByScoring] // eslint-disable-line
  )
  const projectPlayer = useCallback((league, playerId) => {
    const type = detectScoringType(league)
    return blendedPlayerProjection({
      playerId, playersMeta: rz.playersMeta, sleeperWeekById, scoringField: pointsFieldFor(type), fpPtsByKey: fpMaps[type],
    })
  }, [rz.playersMeta, sleeperWeekById, fpMaps])

  const view = useMemo(() => {
    const leagueData = leagues
      .filter((l) => activeIds.includes(l.league_id) && rz.leagueData[l.league_id])
      .map((l) => ({ ...rz.leagueData[l.league_id], league: { ...l, name: labelOf(l) } }))
    const args = { leagueData, myUserId: sleeperUserId, byTeam: gamesByTeam(rz.games), playersMeta: rz.playersMeta, projectPlayer }
    const { mine, opponents } = buildPlayers(args)
    return {
      tiles: buildMatchupTiles(args),
      mine,
      opponentsLive: opponents.filter((p) => p.state === 'in'),
      alerts: buildRedzoneAlerts({ games: rz.games, mine, opponents }),
      ticker: buildTicker({ scoringPlaysByEvent: rz.scoringPlaysByEvent, mine, opponents, newPlayIds: rz.newPlayIds }),
      counts: countsByGame(rz.games, { mine, opponents }),
    }
  }, [leagues, filterKey, rz.leagueData, rz.games, rz.playersMeta, rz.scoringPlaysByEvent, rz.newPlayIds, sleeperUserId, projectPlayer, cardNicknames]) // eslint-disable-line

  if (!sleeperUserId || !leagues.length) {
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon"><Icon name="radio" size={40} /></div>
        <h2>Redzone</h2>
        <p className="muted">Lade zuerst deine Ligen im Setup.</p>
      </section>
    )
  }

  const liveGames = rz.games.filter((g) => g.state === 'in').length
  const next = rz.games.filter((g) => g.state === 'pre' && g.date).sort((a, b) => a.date.localeCompare(b.date))[0]
  const notice = rz.espnError
    || (rz.lastUpdated && !liveGames
      ? `Gerade läuft kein Spiel.${next ? ` Nächster Kickoff: ${new Date(next.date).toLocaleString('de-DE', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}`
      : null)

  return (
    <section className="rz-page">
      <header className="rz-head">
        <span className="rz-title">Redzone</span>
        {rz.week && <span className="rz-muted">Week {rz.week}</span>}
        {(liveGames || liveCount) > 0 && <span className="rz-live">{liveGames || liveCount} LIVE</span>}
        <Stamp at={rz.lastUpdated} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={pollNow} disabled={rz.loading}>
          <Icon name="refresh" size={14} /> Aktualisieren
        </button>
      </header>

      {notice && <div className="rz-notice"><div className="rz-notice-box">{notice}</div></div>}

      <GameStrip games={rz.games} counts={view.counts} />
      <LeagueChips
        leagues={leagues.map((l) => ({ id: l.league_id, label: labelOf(l), avatar: l.avatar ?? null }))}
        activeIds={activeIds}
        onToggle={(id) => rz.toggleLeague(allIds, id)}
        onSolo={(id) => rz.soloLeague(allIds, id)}
      />
      <MatchupRow tiles={view.tiles} />

      <div className="rz-section rz-players"><div className="rz-h">Meine Spieler</div><MyPlayers players={view.mine} /></div>
      <div className="rz-section rz-alerts"><div className="rz-h">Redzone</div><RedzoneAlerts alerts={view.alerts} /></div>
      <div className="rz-section rz-opps"><div className="rz-h">Gegner live</div><OpponentsLive players={view.opponentsLive} /></div>
      <div className="rz-section rz-ticker"><div className="rz-h">Scoring</div><ScoringTicker items={view.ticker} /></div>
    </section>
  )
}
