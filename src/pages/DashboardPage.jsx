import { useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import LeagueCard, { LeagueCardSkeleton } from '../components/LeagueCard'

const SEASON_TYPE_LABEL = {
  pre: 'Pre-Season',
  regular: 'Regular Season',
  post: 'Playoffs',
  off: 'Off-Season',
}

function formatLastRefreshed(date) {
  if (!date) return null
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { sleeperUserId, seasonYear, availableLeagues, availableDrafts } = useSessionStore()
  const { draftMode } = useBoardStore()
  const { nflState, cards, loading, lastRefreshed, loadDashboard } = useDashboardStore()

  const load = useCallback(() => {
    loadDashboard({ leagues: availableLeagues, availableDrafts, sleeperUserId, seasonYear })
  }, [availableLeagues, availableDrafts, sleeperUserId, seasonYear]) // eslint-disable-line

  // Load on mount and whenever leagues change
  useEffect(() => {
    load()
  }, [availableLeagues?.length, sleeperUserId]) // eslint-disable-line

  // Auto-refresh every 5 minutes when page is visible
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) load()
    }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  const hasContent = cards.length > 0 || loading
  const noAccount = !sleeperUserId && !availableLeagues?.length

  function goToAdd() {
    navigate('/setup', { state: { mode: 'add' } })
  }

  // ── Empty state: no Sleeper account configured ────────────────────────────
  if (noAccount && !loading) {
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon">🏈</div>
        <h2>Welcome to Sleeper Draft Helper</h2>
        <p className="muted">Connect your Sleeper account to see all your leagues and drafts in one place.</p>
        <button className="btn btn-primary" onClick={goToAdd}>
          Get Started
        </button>
      </section>
    )
  }

  // ── No leagues loaded yet (account exists but leagues not fetched) ─────────
  if (!loading && !cards.length && sleeperUserId && !availableLeagues?.length) {
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon">📋</div>
        <h2>No leagues loaded</h2>
        <p className="muted">Load your leagues in Setup to see your dashboard.</p>
        <button className="btn btn-primary" onClick={goToAdd}>
          Open Setup
        </button>
      </section>
    )
  }

  const seasonWeek = nflState?.week
  const seasonType = nflState?.season_type
  const seasonYear2 = nflState?.season

  const liveDraftCount = cards.filter((c) => c.draftStatus === 'drafting').length

  return (
    <section className="dashboard">

      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <div className="dashboard-header">
        <div className="dashboard-meta">
          {seasonYear2 && <span className="dashboard-season">Season {seasonYear2}</span>}
          {seasonWeek && (
            <span className="dashboard-week">
              Week {seasonWeek}
              {seasonType && <span className="badge badge--neutral badge--xs">{SEASON_TYPE_LABEL[seasonType] || seasonType}</span>}
            </span>
          )}
          {liveDraftCount > 0 && (
            <span className="badge badge--live">
              {liveDraftCount} Draft{liveDraftCount > 1 ? 's' : ''} Live
            </span>
          )}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={load}
          disabled={loading}
          title="Refresh all leagues"
        >
          {loading ? '…' : '↺'} Refresh
        </button>
      </div>

      {lastRefreshed && (
        <p className="dashboard-refresh-hint muted">Updated {formatLastRefreshed(lastRefreshed)}</p>
      )}

      {/* ── Cards grid ─────────────────────────────────────────────────── */}
      <div className="dashboard-grid">
        {loading && !cards.length
          ? Array.from({ length: Math.max(availableLeagues?.length || 2, 2) }).map((_, i) => (
              <LeagueCardSkeleton key={i} />
            ))
          : cards.map((card) => (
              <LeagueCard key={card.leagueId || card.draftId} card={card} />
            ))}
        <button className="league-card league-card--add" onClick={goToAdd}>
          <span className="lc-add-icon">+</span>
          <span className="lc-add-label">Add Draft / League</span>
        </button>
      </div>
    </section>
  )
}
