import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRecord(wins, losses) {
  if (wins == null && losses == null) return null
  return `${wins ?? 0}–${losses ?? 0}`
}

function formatPoints(pts) {
  if (pts == null || pts === 0) return '0.0'
  return Number(pts).toFixed(1)
}

const FORMAT_LABELS = { dynasty: 'Dynasty', keeper: 'Keeper', redraft: 'Redraft' }
const SCORING_LABELS = { ppr: 'PPR', half_ppr: '0.5 PPR', standard: 'Std' }

const INJURY_COLOR = { Out: 'badge--danger', Doubtful: 'badge--warn', IR: 'badge--danger', Sus: 'badge--danger', PUP: 'badge--warn', 'NFI-R': 'badge--warn', DNR: 'badge--warn' }

// ── Draft status badge ────────────────────────────────────────────────────────

function DraftBadge({ status }) {
  if (!status) return null
  if (status === 'drafting') return <span className="badge badge--live">🔴 LIVE</span>
  if (status === 'pre_draft') return <span className="badge badge--info">Scheduled</span>
  if (status === 'complete') return <span className="badge badge--muted">Complete</span>
  if (status === 'paused') return <span className="badge badge--warn">Paused</span>
  return null
}

// ── Matchup bar ───────────────────────────────────────────────────────────────

function MatchupRow({ matchup }) {
  if (!matchup) return null
  const total = (matchup.myPoints || 0) + (matchup.opponentPoints || 0)
  const myPct = total > 0 ? Math.round((matchup.myPoints / total) * 100) : 50

  return (
    <div className="lc-matchup">
      <div className="lc-matchup-label">
        <span className="lc-matchup-mine">{formatPoints(matchup.myPoints)}</span>
        <span className="lc-matchup-vs">vs {matchup.opponentName}</span>
        <span className="lc-matchup-opp">{formatPoints(matchup.opponentPoints)}</span>
      </div>
      <div className="lc-matchup-bar">
        <div
          className={`lc-matchup-fill ${matchup.myPoints >= matchup.opponentPoints ? 'lc-matchup-fill--winning' : 'lc-matchup-fill--losing'}`}
          style={{ width: `${myPct}%` }}
        />
      </div>
    </div>
  )
}

// ── Injuries row ──────────────────────────────────────────────────────────────

function InjuriesRow({ injuries }) {
  if (!injuries?.length) return null
  return (
    <div className="lc-injuries">
      <span className="lc-injuries-icon">⚠️</span>
      <div className="lc-injuries-list">
        {injuries.map((inj, i) => (
          <span key={i} className="lc-injury-item">
            <span className={`badge ${INJURY_COLOR[inj.status] || 'badge--warn'} badge--xs`}>
              {inj.status}
            </span>
            {inj.name} ({inj.pos})
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

export function LeagueCardSkeleton() {
  return (
    <div className="league-card league-card--skeleton">
      <div className="lc-header">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--badge" />
      </div>
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line skeleton--short" />
    </div>
  )
}

// ── League card ───────────────────────────────────────────────────────────────

function LeagueCardInner({ card }) {
  const navigate = useNavigate()
  const { setSelectedLeagueId, setSelectedDraftId } = useSessionStore()

  const isLive = card.draftStatus === 'drafting'
  const hasDraft = card.draftStatus && card.draftStatus !== 'complete'

  function openDraftBoard() {
    if (card.leagueId) setSelectedLeagueId(card.leagueId)
    if (card.draftId) setSelectedDraftId(card.draftId)
    navigate('/board')
  }

  function openRoster() {
    if (card.leagueId) setSelectedLeagueId(card.leagueId)
    navigate('/roster')
  }

  function openEdit() {
    if (card.leagueId) setSelectedLeagueId(card.leagueId)
    if (card.draftId) setSelectedDraftId(card.draftId)
    navigate('/setup', { state: { mode: 'edit' } })
  }

  const record = formatRecord(card.wins, card.losses)

  return (
    <div className={`league-card ${isLive ? 'league-card--live' : ''} ${card.error ? 'league-card--error' : ''}`}>
      <div className="lc-header">
        <div className="lc-title-row">
          <span className="lc-name">{card.leagueName}</span>
          {record && <span className="lc-record">{record}</span>}
        </div>
        <div className="lc-badges">
          <span className="badge badge--neutral">{FORMAT_LABELS[card.format] || card.format}</span>
          <span className="badge badge--neutral">{SCORING_LABELS[card.scoringType] || card.scoringType}</span>
          {card.totalRosters && <span className="badge badge--neutral">{card.totalRosters} teams</span>}
        </div>
      </div>

      {card.error ? (
        <p className="lc-error">{card.error}</p>
      ) : (
        <>
          {(card.draftStatus) && (
            <div className="lc-section">
              <DraftBadge status={card.draftStatus} />
            </div>
          )}

          {card.matchup && (
            <div className="lc-section">
              <MatchupRow matchup={card.matchup} />
            </div>
          )}

          {card.injuries?.length > 0 && (
            <div className="lc-section">
              <InjuriesRow injuries={card.injuries} />
            </div>
          )}
        </>
      )}

      <div className="lc-actions">
        {card.draftId && (
          <button
            className={`btn ${isLive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={openDraftBoard}
          >
            {isLive ? '🔴 Open Draft' : hasDraft ? 'Draft Board' : 'Past Draft'}
          </button>
        )}
        {card.leagueId && (
          <button className="btn btn-secondary btn-sm" onClick={openRoster}>
            Roster
          </button>
        )}
        {card.leagueId && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSelectedLeagueId(card.leagueId)
              navigate('/trade', { state: { leagueId: card.leagueId, leagueName: card.leagueName } })
            }}
          >
            Trade
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={openEdit} title="Edit setup">
          Edit
        </button>
      </div>
    </div>
  )
}

// ── Standalone / mock draft card ──────────────────────────────────────────────

function DraftCardInner({ card }) {
  const navigate = useNavigate()
  const { setSelectedDraftId } = useSessionStore()

  const isLive = card.draftStatus === 'drafting'

  function openDraftBoard() {
    if (card.draftId) setSelectedDraftId(card.draftId)
    navigate('/board')
  }

  function openEdit() {
    if (card.draftId) setSelectedDraftId(card.draftId)
    navigate('/setup', { state: { mode: 'edit' } })
  }

  const scoringLabel = SCORING_LABELS[card.scoringType] || card.scoringType || 'PPR'

  return (
    <div className={`league-card league-card--draft ${isLive ? 'league-card--live' : ''}`}>
      <div className="lc-header">
        <div className="lc-title-row">
          <span className="lc-name">{card.draftName}</span>
        </div>
        <div className="lc-badges">
          <span className="badge badge--neutral">Mock</span>
          <span className="badge badge--neutral">{card.draftType}</span>
          {card.draftTeams && <span className="badge badge--neutral">{card.draftTeams} teams</span>}
          {card.draftRounds && <span className="badge badge--neutral">{card.draftRounds} rds</span>}
          <span className="badge badge--neutral">{scoringLabel}</span>
        </div>
      </div>

      {card.error ? (
        <p className="lc-error">{card.error}</p>
      ) : (
        card.draftStatus && (
          <div className="lc-section">
            <DraftBadge status={card.draftStatus} />
          </div>
        )
      )}

      <div className="lc-actions">
        <button
          className={`btn ${isLive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={openDraftBoard}
        >
          {isLive ? '🔴 Open Draft' : 'Open Board'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={openEdit} title="Edit setup">
          Edit
        </button>
      </div>
    </div>
  )
}

// ── Public export: picks the right variant ────────────────────────────────────

export default function LeagueCard({ card }) {
  if (card.loading) return <LeagueCardSkeleton />
  if (card.type === 'draft') return <DraftCardInner card={card} />
  return <LeagueCardInner card={card} />
}
