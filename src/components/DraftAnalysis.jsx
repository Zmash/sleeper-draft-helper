// src/components/DraftAnalysis.jsx
import React from 'react'
import { buildDraftReviewContext, buildDraftReviewPayload, callAiDraftReview } from '../services/aiDraftReviewClient'
import { getOpenAIKey } from '../services/key'

export default function DraftAnalysis({
  scores = [],
  ownerLabels,
  league = null,
  picks = [],
  teamByRosterId = {},
  myOwnerId = null,
  myRosterId = null,
  board = null,
}) {
  const [ai, setAi] = React.useState({ loading: false, data: null, error: '', ran: false })
  const canAI = !!getOpenAIKey() && 
                !!league && 
                Array.isArray(picks) && picks.length > 0 &&
                teamByRosterId && Object.keys(teamByRosterId || {}).length > 0
  console.debug("[DraftAnalysis] getOpenAIKey:", getOpenAIKey())
  console.debug("[DraftAnalysis] league:", league)
  console.debug("[DraftAnalysis] picks.length:", Array.isArray(picks) ? picks.length : "not an array")
  console.debug("[DraftAnalysis] teamByRosterId keys:", teamByRosterId ? Object.keys(teamByRosterId) : "null/undefined")
  console.debug("[DraftAnalysis] canAI:", canAI)


  const runAI = React.useCallback(async () => {
    if (!canAI) return
    setAi({ loading: true, data: null, error: '', ran: true })
    try {
      // Fallback: wenn myOwnerId/myRosterId fehlen, nimm das erste vorhandene Team
      const rosterKeys = Object.keys(teamByRosterId || {})
      const fallbackRosterId = (myRosterId && rosterKeys.includes(myRosterId)) ? myRosterId : rosterKeys[0]
      const fallbackOwnerId = fallbackRosterId
        ? String(teamByRosterId[fallbackRosterId]?.owner_id || '')
        : (myOwnerId || '')

      const ctx = buildDraftReviewContext({
        league,
        picks,
        teamByRosterId,
        ownerLabels,
        myOwnerId: myOwnerId || fallbackOwnerId,
        myRosterId: myRosterId || fallbackRosterId,
        board
      })
      const payload = buildDraftReviewPayload(ctx, { model: 'gpt-4o-mini', temperature: 0.3 })
      const parsed = await callAiDraftReview(payload)
      setAi({ loading: false, data: parsed, error: '', ran: true })
    } catch (e) {
      setAi({ loading: false, data: null, error: String(e?.message || e), ran: true })
    }
  }, [canAI, league, picks, teamByRosterId, ownerLabels, myOwnerId, myRosterId, board])

  React.useEffect(() => {
    if (canAI && !ai.ran && !ai.loading) runAI()
  }, [canAI, ai.ran, ai.loading, runAI])

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
        <div className="flex items-center gap-2">
          {!canAI && <span className="muted text-sm">(Add an OpenAI key to enable the AI review)</span>}
          <button className="btn" disabled={!canAI || ai.loading} onClick={runAI}>
            {ai.loading ? 'Analyzing…' : (ai.ran ? 'Re-run' : 'Run')}
          </button>
        </div>
      </div>

      {ai.error && (
        <div className="alert error mt-2">
          <div className="font-semibold">AI error</div>
          <div className="text-sm">{ai.error}</div>
        </div>
      )}

      {canAI && ai.loading && !ai.data && (
        <div className="muted mt-2">Crunching numbers, looking at rosters and picks…</div>
      )}

      {canAI && ai.data && (
        <div className="mt-4 grid gap-4">

          {/* Overall Summary */}
          <div className="card p-3">
            <div className="text-sm uppercase muted mb-1">Overall</div>
            <p className="whitespace-pre-wrap">{ai.data.overallSummary}</p>
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
                  {(ai.data.overallRankings || []).slice().sort((a,b)=>a.rank-b.rank).map((row, i) => {
                    const comment = (ai.data.teamOneLiners || []).find(t => t.teamId === row.teamId)
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
                {(ai.data.steals || []).map((s, idx) => (
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
                {(ai.data.reaches || []).map((r, idx) => (
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
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="font-semibold mb-1">Grade</div>
                <div className="text-xl">{ai.data.myTeamDeepDive?.grade || '-'}</div>
              </div>
              <div>
                <div className="font-semibold mb-1">Recommended Moves</div>
                <ul className="list-disc pl-5">
                  {(ai.data.myTeamDeepDive?.recommendedMoves || []).map((m, idx) => <li key={idx}>{m}</li>)}
                </ul>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 mt-3">
              <div>
                <div className="font-semibold mb-1">Strengths</div>
                <ul className="list-disc pl-5">
                  {(ai.data.myTeamDeepDive?.strengths || []).map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">Weaknesses</div>
                <ul className="list-disc pl-5">
                  {(ai.data.myTeamDeepDive?.weaknesses || []).map((w, idx) => <li key={idx}>{w}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">Risks</div>
                <ul className="list-disc pl-5">
                  {(ai.data.myTeamDeepDive?.risks || []).map((r, idx) => <li key={idx}>{r}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-3 whitespace-pre-wrap">{ai.data.myTeamDeepDive?.longText || ''}</div>
            <div className="muted text-xs mt-2">Model: {ai.data.meta?.model || 'n/a'}</div>
          </div>

          {/* Week 1 Start/Sit (My Team) */}
          <div className="card p-3">
            <div className="text-sm uppercase muted mb-2">Week 1 Start/Sit (My Team)</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="font-semibold mb-1">Starters</div>
                <ul className="list-disc pl-5">
                  {(ai.data.myWeek1StartSit?.starters || []).map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
              <div>
                <div className="font-semibold mb-1">Sits</div>
                <ul className="list-disc pl-5">
                  {(ai.data.myWeek1StartSit?.sits || []).map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
            </div>
            <div className="mt-2 whitespace-pre-wrap">{ai.data.myWeek1StartSit?.notes || ''}</div>
          </div>

        </div>
      )}
    </section>
  )
}
