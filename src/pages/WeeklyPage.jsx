import { useCallback, useEffect, useMemo } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useWeeklyStore } from '../stores/useWeeklyStore'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { detectScoringType, loadWeekProjections, fpPtsMapFor } from '../services/weekProjections'
import { pointsFieldFor } from '../services/analysis/seasonSim'
import { blendedPlayerProjection } from '../services/analysis/matchupProjection'
import { gamesByTeam, selectedLeagueIds } from '../services/redzone/redzoneModel'
import {
  buildWeek, weekRecord, buildOutliers, buildInjuryReport, positionBreakdown, weekOptions,
} from '../services/weekly/weeklyModel'
import { LeagueChips, Stamp } from '../components/redzone/RedzoneParts'
import {
  WeekPicker, RecordStrip, LeagueResults, OutlierBoard, InjuryList, BenchReport, PositionBars,
} from '../components/weekly/WeeklyParts'
import Icon from '../components/Icon'
// LeagueChips und Stamp kommen aus RedzoneParts und tragen rz-Klassen -- ohne
// diesen Import stehen sie unstyled da, sobald /weekly der erste Aufruf ist
// (im Dev-Server wird CSS je Modul injiziert, nicht gebuendelt).
import '../styles/redzone.css'
import '../styles/weekly.css'

export default function WeeklyPage() {
  const { sleeperUserId, seasonYear, availableLeagues, cardNicknames } = useSessionStore()
  const wk = useWeeklyStore()
  const fpWeekPtsByScoring = useWeeklyRankingsStore((s) => s.fpWeekPtsByScoring)
  const sleeperWeekByKey = useWeeklyRankingsStore((s) => s.sleeperWeekByKey)

  const leagues = useMemo(() => availableLeagues || [], [availableLeagues])
  const allIds = useMemo(() => leagues.map((l) => l.league_id), [leagues])
  const activeIds = selectedLeagueIds(allIds, wk.deselectedLeagueIds)
  const filterKey = activeIds.join(',')
  const labelOf = (l) => cardNicknames?.[l.league_id] || l.name

  const load = useCallback(
    (force = false) => wk.load({ leagues, season: seasonYear, myUserId: sleeperUserId, force }),
    [wk.load, leagues, seasonYear, sleeperUserId] // eslint-disable-line
  )

  // Wochenwechsel und Filterwechsel laden beide neu (beide in den Deps).
  useEffect(() => {
    if (!leagues.length || !sleeperUserId) return
    load()
  }, [load, filterKey, wk.week]) // eslint-disable-line

  // Projektionen fuer die GEZEIGTE Woche. FantasyPros liefert nur die laufende
  // Woche (scope=week, kein Wochenparameter) -- fuer zurueckliegende Wochen
  // zaehlt deshalb allein die Sleeper-Projektion, die es je Woche gibt. Sonst
  // haetten alte Wochen Ausreisser gegen die Projektion von heute.
  const isCurrentWeek = wk.week != null && wk.week === wk.currentWeek
  const scoringKey = [...new Set(leagues.filter((l) => activeIds.includes(l.league_id)).map(detectScoringType))].sort().join(',')
  useEffect(() => {
    if (!wk.week || !scoringKey) return
    loadWeekProjections({
      season: seasonYear,
      week: wk.week,
      scoringTypes: isCurrentWeek ? scoringKey.split(',') : [],
    })
  }, [wk.week, scoringKey, seasonYear, isCurrentWeek])

  const fpMaps = useMemo(
    () => (isCurrentWeek
      ? Object.fromEntries(scoringKey.split(',').filter(Boolean).map((t) => [t, fpPtsMapFor(t)]))
      : {}),
    [scoringKey, fpWeekPtsByScoring, isCurrentWeek] // eslint-disable-line
  )
  // Bewusst ueber getSleeperWeekMap und nicht ueber sleeperWeekById: letzteres
  // zeigt auf die zuletzt irgendwo geladene Woche, hier zaehlt genau die
  // angezeigte.
  const sleeperWeekById = useMemo(
    () => useWeeklyRankingsStore.getState().getSleeperWeekMap({ season: seasonYear, week: wk.week }),
    [seasonYear, wk.week, sleeperWeekByKey]
  )
  const projectPlayer = useCallback((league, playerId) => {
    const type = detectScoringType(league)
    return blendedPlayerProjection({
      playerId, playersMeta: wk.playersMeta, sleeperWeekById, scoringField: pointsFieldFor(type), fpPtsByKey: fpMaps[type],
    })
  }, [wk.playersMeta, sleeperWeekById, fpMaps])

  const view = useMemo(() => {
    const byWeek = wk.leagueDataByWeek[wk.week] || {}
    const leagueData = leagues
      .filter((l) => activeIds.includes(l.league_id) && byWeek[l.league_id])
      .map((l) => ({ ...byWeek[l.league_id], league: { ...l, name: labelOf(l) } }))
    const { leagues: built, errors } = buildWeek({
      leagueData,
      myUserId: sleeperUserId,
      playersMeta: wk.playersMeta,
      byTeam: gamesByTeam(wk.gamesByWeek[wk.week] || []),
      projectPlayer,
    })
    return {
      leagues: built,
      errors,
      record: weekRecord(built),
      outliers: buildOutliers(built),
      oppOutliers: buildOutliers(built, { side: 'opponents', limit: 5 }),
      injuries: buildInjuryReport(built),
      positions: positionBreakdown(built),
    }
  }, [leagues, filterKey, wk.leagueDataByWeek, wk.gamesByWeek, wk.week, wk.playersMeta, sleeperUserId, projectPlayer, cardNicknames]) // eslint-disable-line

  if (!sleeperUserId || !leagues.length) {
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon"><Icon name="clipboard-check" size={40} /></div>
        <h2>Wochenrückblick</h2>
        <p className="muted">Lade zuerst deine Ligen im Setup.</p>
      </section>
    )
  }

  const weeks = weekOptions(wk.currentWeek)
  const hasData = view.leagues.length > 0 || view.errors.length > 0

  return (
    <section className="wk-page">
      <header className="wk-head">
        <span className="wk-title">Wochenrückblick</span>
        <WeekPicker week={wk.week} weeks={weeks} onPick={wk.setWeek} disabled={wk.loading} />
        {isCurrentWeek && <span className="wk-pill">laufende Woche</span>}
        <Stamp at={wk.lastUpdated} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={wk.loading}>
          <Icon name="refresh" size={14} /> Aktualisieren
        </button>
      </header>

      {wk.error && <div className="wk-notice">{wk.error}</div>}
      {!isCurrentWeek && (
        <div className="wk-notice wk-notice--soft">
          Abgeschlossene Woche: Projektionen stammen aus Sleepers Wochenprojektion für Week {wk.week}.
        </div>
      )}

      {!hasData && !wk.loading && (
        <div className="wk-empty">Für Week {wk.week} liegen in den gewählten Ligen keine Daten vor.</div>
      )}

      <div className="wk-section wk-record-area">
        <div className="wk-h">Woche in Zahlen</div>
        <RecordStrip record={view.record} />
      </div>

      <div className="wk-section wk-chips-area">
        <LeagueChips
          leagues={leagues.map((l) => ({ id: l.league_id, label: labelOf(l), avatar: l.avatar ?? null }))}
          activeIds={activeIds}
          onToggle={(id) => wk.toggleLeague(allIds, id)}
          onSolo={(id) => wk.soloLeague(allIds, id)}
        />
      </div>

      <div className="wk-section wk-results-area">
        <div className="wk-h">Ergebnisse</div>
        <LeagueResults leagues={view.leagues} errors={view.errors} />
      </div>

      <div className="wk-section wk-outliers-area">
        <div className="wk-h">Ausreißer bei deinen Startern</div>
        <OutlierBoard
          outliers={view.outliers}
          labels={{ over: 'Weit über Projektion', under: 'Weit unter Projektion' }}
          emptyHint="Keine nennenswerten Abweichungen."
        />
      </div>

      <div className="wk-section wk-inj-area">
        <div className="wk-h">Verletzungen &amp; Ausfälle</div>
        <InjuryList entries={view.injuries} />
      </div>

      <div className="wk-section wk-bench-area">
        <div className="wk-h">Aufstellung im Rückblick</div>
        <BenchReport leagues={view.leagues} />
      </div>

      <div className="wk-section wk-pos-area">
        <div className="wk-h">Positionsbilanz</div>
        <PositionBars rows={view.positions} />
      </div>

      <div className="wk-section wk-opp-area">
        <div className="wk-h">Bei den Gegnern</div>
        <OutlierBoard
          outliers={view.oppOutliers}
          labels={{ over: 'Hat dich gekostet', under: 'Hat dir geholfen' }}
          emptyHint="Keine nennenswerten Abweichungen."
        />
      </div>
    </section>
  )
}
