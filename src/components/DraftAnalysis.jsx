// src/components/DraftAnalysis.jsx
import React from 'react'
import { buildDraftReviewContext, buildDraftReviewPayload, callAiDraftReview } from '../services/aiDraftReviewClient'
import { getOpenAIKey } from '../services/key'
import { formatEstimate, formatUsage } from '../services/aiCost'

export default function DraftAnalysis({
  scores = [],
  ownerLabels,
  league = null,
  picks = [],
  teamByRosterId = {},
  myOwnerId = null,
  myRosterId = null,
  board = null,
  draftMode = 'redraft',
  format = null,
  reviewResult = null,
  onReviewResult = () => {},
}) {
  const [ai, setAi] = React.useState({ loading: false, error: '' })
  const canAI = !!getOpenAIKey() &&
                !!league &&
                Array.isArray(picks) && picks.length > 0 &&
                teamByRosterId && Object.keys(teamByRosterId || {}).length > 0

  const data = reviewResult?.parsed || null
  const usage = reviewResult?.usage || null
  const usageModel = reviewResult?.model || null

  // Fallback: wenn myOwnerId/myRosterId fehlen bzw. nicht (mehr) im Kader-Mapping
  // stecken, nimm das erste vorhandene Team -- und mach das im UI transparent,
  // statt still ein falsches Team zu analysieren.
  const rosterKeys = Object.keys(teamByRosterId || {})
  const usedFallback = !myRosterId || !rosterKeys.includes(myRosterId)
  const fallbackRosterId = usedFallback ? rosterKeys[0] : myRosterId
  const fallbackOwnerId = fallbackRosterId
    ? String(teamByRosterId[fallbackRosterId]?.owner_id || '')
    : (myOwnerId || '')

  const runAI = React.useCallback(async () => {
    if (!canAI) return
    setAi({ loading: true, error: '' })
    try {
      const ctx = buildDraftReviewContext({
        league,
        picks,
        teamByRosterId,
        ownerLabels,
        myOwnerId: myOwnerId || fallbackOwnerId,
        myRosterId: myRosterId || fallbackRosterId,
        board,
        draftMode,
      })
      const payload = buildDraftReviewPayload(ctx, { temperature: 0.3, format })
      const result = await callAiDraftReview(payload)
      setAi({ loading: false, error: '' })
      onReviewResult(result)
    } catch (e) {
      setAi({ loading: false, error: String(e?.message || e) })
    }
  }, [canAI, league, picks, teamByRosterId, ownerLabels, myOwnerId, myRosterId, board, draftMode, format, fallbackOwnerId, fallbackRosterId, onReviewResult])

  const estimate = React.useMemo(() => {
    if (!canAI) return ''
    try {
      const ctx = buildDraftReviewContext({ league, picks, teamByRosterId, ownerLabels, myOwnerId, myRosterId, board, draftMode })
      return formatEstimate(buildDraftReviewPayload(ctx, { format }), 'claude-sonnet-5')
    } catch { return '' }
  }, [canAI, picks?.length, draftMode])

  return (
    <section className="card">
      <h2>Team Rankings</h2>

      {/* Deine bestehende numerische Tabelle */}
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Total</th>
              <th>Value</th>
              <th>Positional</th>
              <th>Balance</th>
              <th>Diversity</th>
              <th>Bye</th>
            </tr>
          </thead>
          <tbody>
            {(scores || []).map((r, idx) => {
              const teamKey = r.key ?? r.owner_id ?? String(idx + 1)   // robust fallback
              const label =
                (ownerLabels?.get?.(teamKey)) ||
                (ownerLabels && ownerLabels[teamKey]) ||
                teamKey

              return (
                <tr key={teamKey}>
                  <td>{idx + 1}</td>
                  <td>{label}</td>
                  <td>{r.total}</td>
                  <td>{r.value}</td>
                  <td>{r.positional}</td>
                  <td>{r.balance}</td>
                  <td>{r.diversity}</td>
                  <td>{r.bye}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ---- AI Review Header / Actions ---- */}
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Draft Review</h3>
        {!canAI && <span className="muted text-sm">(Add an Anthropic key to enable the AI review)</span>}
      </div>

      {!data && !ai.loading && (
        <div className="review-start">
          <button className="btn btn-primary" onClick={runAI} disabled={!canAI}>
            Review starten
          </button>
          <span className="muted text-xs">{estimate}</span>
        </div>
      )}
      {data && (
        <button className="btn btn-ghost btn-sm" onClick={runAI} disabled={ai.loading}>
          Neu berechnen
        </button>
      )}

      {ai.error && (
        <div className="alert error mt-2">
          <div className="font-semibold">AI error</div>
          <div className="text-sm">{ai.error}</div>
        </div>
      )}

      {canAI && ai.loading && !data && (
        <div className="muted mt-2">Crunching numbers, looking at rosters and picks…</div>
      )}

      {canAI && data && (
        <div className="mt-4 grid gap-4">

          {/* Overall Summary */}
          <div className="card p-3">
            <div className="text-sm uppercase muted mb-1">Overall</div>
            <p className="whitespace-pre-wrap">{data.overallSummary}</p>
          </div>

          {/* AI Rankings + One-liners */}
          <div className="card p-3">
            <div className="text-sm uppercase muted mb-2">AI Rankings + One-liners</div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>Score</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.overallRankings || []).slice().sort((a,b)=>a.rank-b.rank).map((row, i) => {
                    const comment = (data.teamOneLiners || []).find(t => t.teamId === row.teamId)
                    return (
                      <tr key={row.teamId || i}>
                        <td>{row.rank}</td>
                        <td>{row.displayName || row.teamId}</td>
                        <td>{Math.round(Number(row.score) || 0)}</td>
                        <td>{comment?.comment || ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Steals & Reaches */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="card p-3">
              <div className="text-sm uppercase muted mb-2">Top Steals</div>
              <ul className="list-disc pl-5">
                {(data.steals || []).map((s, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">Pick #{s.pick_no} – {s.player}</span>
                    {' '}(<span className="muted">{s.displayName}</span>): {s.rationale}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-3">
              <div className="text-sm uppercase muted mb-2">Top Reaches</div>
              <ul className="list-disc pl-5">
                {(data.reaches || []).map((r, idx) => (
                  <li key={idx}>
                    <span className="font-semibold">Pick #{r.pick_no} – {r.player}</span>
                    {' '}(<span className="muted">{r.displayName}</span>): {r.rationale}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* My Team Deep Dive */}
          <div className="card p-3">
            <div className="text-sm uppercase muted mb-2">My Team Deep Dive</div>
            {usedFallback && (
              <p className="muted text-xs">Hinweis: Dein Team konnte nicht sicher erkannt werden — der Deep-Dive beschreibt das erste Team der Liste.</p>
            )}
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="font-semibold mb-1">Grade</div>
                <div className="text-xl">{data.myTeamDeepDive?.grade || '-'}</div>
              </div>
              <div>
                <div className="font-semibold mb-1">Recommended Moves</div>
                <ul className="list-disc pl-5">
                  {(data.myTeamDeepDive?.recommendedMoves || []).map((m, idx) => <li key={idx}>{m}</li>)}
                </ul>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <div>
                <div className="font-semibold mb-1">Strengths</div>
                <ul className="list-disc pl-5">
                  {(data.myTeamDeepDive?.strengths || []).map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">Weaknesses</div>
                <ul className="list-disc pl-5">
                  {(data.myTeamDeepDive?.weaknesses || []).map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">Risks</div>
                <ul className="list-disc pl-5">
                  {(data.myTeamDeepDive?.risks || []).map((r, idx) => <li key={idx}>{r}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-3 whitespace-pre-wrap">{data.myTeamDeepDive?.longText || ''}</div>
            <div className="muted text-xs mt-2">Model: {data.meta?.model || 'n/a'}</div>
          </div>

          {/* Learnings fuer den naechsten Mock */}
          {data?.lessonsForNextMock?.length > 0 && (
            <section className="review-lessons">
              <h3>Learnings für den nächsten Mock</h3>
              <ul>
                {data.lessonsForNextMock.map((l, i) => (
                  <li key={i}>
                    <strong>{l.lesson}</strong>
                    <div className="muted text-xs">{l.evidence}</div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {usage && <div className="advice-usage muted text-xs">Verbraucht: {formatUsage(usage, usageModel)}</div>}

        </div>
      )}
    </section>
  )
}
