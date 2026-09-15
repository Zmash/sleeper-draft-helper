import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useNflStore } from '../stores/useNflStore'
import { groupByGermanDay, withBroadcast, summarize, byeTeams, isLive, sortGames } from '../services/nfl/nflModel'
import { WeekPicker, SummaryBar, FilterBar, DaySection } from '../components/nfl/NflParts'
import { Stamp } from '../components/redzone/RedzoneParts'
import Icon from '../components/Icon'
import '../styles/nfl.css'

// Waehrend Spiele laufen lohnt sich ein kurzer Takt, sonst nicht: ein
// Spielplan aendert sich zwischen den Spieltagen praktisch nie.
const POLL_LIVE_MS = 30 * 1000
const POLL_IDLE_MS = 5 * 60 * 1000

export default function NflPage() {
  const seasonYear = useSessionStore((s) => s.seasonYear)
  const nfl = useNflStore()
  const [filter, setFilter] = useState('all')

  const { week, currentWeek, season, gamesByWeek } = nfl
  const games = useMemo(() => gamesByWeek[week] || [], [gamesByWeek, week])

  const load = useCallback(
    (force = false) => nfl.load({ season: seasonYear, force }),
    [nfl.load, seasonYear] // eslint-disable-line
  )

  // Wochenwechsel laedt sofort nach (week in den Deps). Der Intervall-Takt
  // richtet sich danach, ob gerade gespielt wird.
  const anyLive = games.some(isLive)
  useEffect(() => {
    const tick = () => { if (!document.hidden) load() }
    tick()
    const id = setInterval(tick, anyLive ? POLL_LIVE_MS : POLL_IDLE_MS)
    return () => clearInterval(id)
  }, [load, week, anyLive])

  const enriched = useMemo(
    () => withBroadcast(sortGames(games), { week, season }),
    [games, week, season]
  )
  const summary = useMemo(() => summarize(enriched), [enriched])
  const byes = useMemo(() => byeTeams(week, season || seasonYear), [week, season, seasonYear])

  const counts = useMemo(() => ({
    all: enriched.length,
    live: enriched.filter(isLive).length,
    free: enriched.filter((g) => g.broadcast?.outlets.some((o) => o.kind === 'free')).length,
  }), [enriched])

  const visible = useMemo(() => {
    if (filter === 'live') return enriched.filter(isLive)
    if (filter === 'free') return enriched.filter((g) => g.broadcast?.outlets.some((o) => o.kind === 'free'))
    return enriched
  }, [enriched, filter])

  // Gruppiert wird nach deutschem Kalendertag -- genau der Punkt der Seite:
  // das US-Sonntagabendspiel steht hier unter Montag.
  const groups = useMemo(() => groupByGermanDay(visible), [visible])

  return (
    <section className="nfl-page">
      <header className="nfl-head">
        <span className="nfl-title">NFL</span>
        {week && <span className="nfl-muted">Week {week}{season ? ` · ${season}` : ''}</span>}
        {summary.live > 0 && <span className="nfl-live">{summary.live} LIVE</span>}
        <Stamp at={nfl.lastUpdated} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={nfl.loading}>
          <Icon name="refresh" size={14} /> Aktualisieren
        </button>
      </header>

      <WeekPicker week={week} currentWeek={currentWeek} onPick={nfl.setWeek} />

      {nfl.error && <div className="nfl-notice">{nfl.error}</div>}

      <SummaryBar summary={summary} byes={byes} />
      <FilterBar value={filter} onChange={setFilter} counts={counts} />

      {groups.length === 0 ? (
        <div className="nfl-empty">
          {nfl.loading && !games.length
            ? 'Spielplan wird geladen …'
            : filter === 'all'
              ? 'Für diese Woche liegen keine Spiele vor.'
              : 'Kein Spiel passt zu diesem Filter.'}
        </div>
      ) : (
        groups.map((g) => <DaySection key={g.key} group={g} />)
      )}

      <p className="nfl-legend">
        Alle Zeiten in deutscher Ortszeit. Die Sonntagsfenster sind als
        {' '}<b>Auswahl</b> gekennzeichnet: RTL, RTL+ und Sky zeigen daraus je ein Spiel,
        welches steht erst kurzfristig fest. Der NFL Game Pass zeigt jedes Spiel.
      </p>
    </section>
  )
}
