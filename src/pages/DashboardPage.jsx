import { useEffect, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useDashboardStore } from '../stores/useDashboardStore'
import { fetchJson, SLEEPER_API_BASE } from '../services/api'
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

// ── Sleeper Connect / Status widget ──────────────────────────────────────────

function SleeperConnectWidget({ compact = false }) {
  const {
    sleeperUsername, sleeperUserId,
    setSleeperUsername, setSleeperUserId,
    setAvailableLeagues, setAvailableDrafts, setSelectedLeagueId, setSelectedDraftId,
    loadLeagues,
  } = useSessionStore()

  const [input, setInput] = useState(sleeperUsername || '')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  async function handleConnect() {
    const trimmed = input.trim()
    if (!trimmed) return
    setConnecting(true)
    setError(null)
    try {
      const data = await fetchJson(`${SLEEPER_API_BASE}/user/${encodeURIComponent(trimmed)}`)
      if (!data?.user_id) throw new Error('Benutzer nicht gefunden')
      setSleeperUsername(trimmed)
      setSleeperUserId(data.user_id)
      await loadLeagues()
    } catch (e) {
      setError(e.message || 'Verbindung fehlgeschlagen')
    } finally {
      setConnecting(false)
    }
  }

  function handleDisconnect() {
    setSleeperUserId('')
    setSleeperUsername('')
    setAvailableLeagues([])
    setAvailableDrafts([])
    setSelectedLeagueId('')
    setSelectedDraftId('')
  }

  if (sleeperUserId) {
    if (compact) {
      return (
        <span className="sleeper-connected-badge">
          <span className="sleeper-connected-dot" />
          @{sleeperUsername || sleeperUserId}
          <button className="sleeper-disconnect-btn" onClick={handleDisconnect} title="Trennen">✕</button>
        </span>
      )
    }
    return null
  }

  if (compact) {
    return (
      <div className="sleeper-connect-compact">
        <input
          className="control control--sm"
          placeholder="Sleeper-Username"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
        />
        <button className="btn btn-primary btn-sm" onClick={handleConnect} disabled={connecting}>
          {connecting ? '…' : 'Verbinden'}
        </button>
        {error && <span className="sleeper-connect-error muted">{error}</span>}
      </div>
    )
  }

  return (
    <div className="sleeper-connect-widget">
      <p className="sleeper-connect-desc muted">Verbinde deinen Sleeper-Account um Ligen & Drafts zu sehen.</p>
      <div className="sleeper-connect-row">
        <input
          className="control"
          placeholder="Dein Sleeper-Username"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleConnect()}
          autoFocus
        />
        <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
          {connecting ? 'Verbinde…' : 'Verbinden'}
        </button>
      </div>
      {error && <div className="sleeper-connect-error">{error}</div>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { sleeperUserId, seasonYear, availableLeagues, availableDrafts } = useSessionStore()
  const { draftMode } = useBoardStore()
  const { nflState, cards, loading, lastRefreshed, loadDashboard } = useDashboardStore()

  const load = useCallback(() => {
    loadDashboard({ leagues: availableLeagues, availableDrafts, sleeperUserId, seasonYear })
  }, [availableLeagues, availableDrafts, sleeperUserId, seasonYear]) // eslint-disable-line

  useEffect(() => { load() }, [availableLeagues?.length, sleeperUserId]) // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => { if (!document.hidden) load() }, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  function goToAdd() { navigate('/setup', { state: { mode: 'add' } }) }

  // ── No account: show inline connect widget ────────────────────────────────
  if (!sleeperUserId && !loading) {
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon">🏈</div>
        <h2>Willkommen beim Sleeper Draft Helper</h2>
        <SleeperConnectWidget />
      </section>
    )
  }

  if (!loading && !cards.length && sleeperUserId && !availableLeagues?.length) {
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon">📋</div>
        <h2>Keine Ligen geladen</h2>
        <p className="muted">Lade deine Ligen im Setup.</p>
        <button className="btn btn-primary" onClick={goToAdd}>Setup öffnen</button>
      </section>
    )
  }

  const seasonWeek = nflState?.week
  const seasonType = nflState?.season_type
  const seasonYear2 = nflState?.season
  const liveDraftCount = cards.filter((c) => c.draftStatus === 'drafting').length

  return (
    <section className="dashboard">

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
          <SleeperConnectWidget compact />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading} title="Refresh">
          {loading ? '…' : '↺'} Refresh
        </button>
      </div>

      {lastRefreshed && (
        <p className="dashboard-refresh-hint muted">Updated {formatLastRefreshed(lastRefreshed)}</p>
      )}

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
          <span className="lc-add-label">Draft / Liga hinzufügen</span>
        </button>
      </div>
    </section>
  )
}
