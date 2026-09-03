import { useEffect, useState } from 'react'
import { useLiveStore } from '../stores/useLiveStore'
import { cx, normalizePos } from '../utils/formatting'
import { SLEEPER_API_BASE, fetchJson } from '../services/api'
import Icon from './Icon'

// Snake-Position innerhalb der Runde: ungerade Runde direkt, gerade Runde
// gespiegelt -- gleiches Muster wie BoardPage.pickPos / OnTheClockBar.
function posInRound(round, slot, teams) {
  return round % 2 === 1 ? slot : teams - slot + 1
}

// Reine Grid-Darstellung des Drafts (Teams als Spalten, Runden als Zeilen,
// wie das echte Sleeper-Board) -- kein eigenes Chrome/Header. Wird von
// BoardSection als zweite Ansicht neben BoardTable gerendert, damit Toolbar,
// Bottom-Bar und alle Dialoge (AI/Filter/Key) fuer beide Ansichten identisch
// bleiben und nur der Inhalt wechselt.
export default function DraftGrid({ draft, teamsCount, ownerLabels, draftSlot }) {
  const { livePicks } = useLiveStore()

  // Eigene Liga-User-Abfrage statt der global ausgewaehlten Liga: ein per Link
  // angehaengter Draft (Kumpel teilt seinen Live-Draft) gehoert i.d.R. NICHT
  // zur eigenen selectedLeague -- ownerLabels/leagueUsers aus App.jsx waeren
  // dann leer oder fuer die falsche Liga. draft.league_id ist die einzige
  // verlaessliche Quelle fuer "wer draftet hier wirklich".
  const [draftLeagueUsers, setDraftLeagueUsers] = useState([])
  useEffect(() => {
    const leagueId = draft?.league_id
    if (!leagueId) { setDraftLeagueUsers([]); return }
    let cancelled = false
    fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`)
      .then((users) => { if (!cancelled) setDraftLeagueUsers(Array.isArray(users) ? users : []) })
      .catch(() => { if (!cancelled) setDraftLeagueUsers([]) })
    return () => { cancelled = true }
  }, [draft?.league_id])

  if (!draft) {
    return <p className="muted center mt-3">Kein Draft ausgewählt.</p>
  }

  const teams = Number(teamsCount) || Number(draft.settings?.teams) || 12
  const rounds =
    Number(draft.settings?.rounds) ||
    Math.max(1, Math.ceil((livePicks?.length || 0) / teams))

  const picksByCell = new Map()
  for (const p of livePicks || []) {
    if (p?.round != null && p?.draft_slot != null) picksByCell.set(`${p.round}-${p.draft_slot}`, p)
  }
  const currentPickNo = (livePicks?.length || 0) + 1

  function labelForSlot(slot) {
    const order = draft?.draft_order || {}
    const uid = Object.keys(order).find((u) => Number(order[u]) === slot)
    const user = uid && draftLeagueUsers.find((u2) => u2.user_id === uid)
    if (user) return user.metadata?.team_name || user.display_name || user.username
    const bySlot = ownerLabels?.get(`slot:${slot}`)
    if (bySlot) return bySlot
    const byUser = uid && ownerLabels?.get(`user:${uid}`)
    return byUser || `Team ${slot}`
  }

  const slots = Array.from({ length: teams }, (_, i) => i + 1)
  const roundsArr = Array.from({ length: rounds }, (_, i) => i + 1)

  return (
    <div className="draft-grid-scroll">
      <div
        className="draft-grid"
        style={{ gridTemplateColumns: `var(--dg-round-w, 34px) repeat(${teams}, minmax(var(--dg-col-w, 120px), 1fr))` }}
      >
        <div className="draft-grid-head draft-grid-corner" aria-hidden />
        {slots.map((slot) => (
          <div key={`h-${slot}`} className={cx('draft-grid-head', slot === draftSlot && 'draft-grid-head--me')}>
            {labelForSlot(slot)}
          </div>
        ))}
        {roundsArr.flatMap((round) => [
          <div key={`r-${round}`} className="draft-grid-round">R{round}</div>,
          ...slots.map((slot) => {
            const pick = picksByCell.get(`${round}-${slot}`)
            const pos = posInRound(round, slot, teams)
            const pickNo = (round - 1) * teams + pos
            const isOnClock = !pick && pickNo === currentPickNo
            const pickPos = pick ? normalizePos(pick.metadata?.position).toLowerCase() : undefined
            return (
              <div
                key={`${round}-${slot}`}
                data-pos={pickPos}
                className={cx(
                  'draft-grid-cell',
                  pick && 'draft-grid-cell--picked',
                  isOnClock && 'draft-grid-cell--clock'
                )}
              >
                {pick ? (
                  <>
                    <div className="dgc-top">
                      <span className="dgc-meta">
                        {pick.metadata?.position}
                        {pick.metadata?.team ? ` · ${pick.metadata.team}` : ''}
                        {pick.metadata?.bye_week ? ` (${pick.metadata.bye_week})` : ''}
                      </span>
                      <span className="dgc-pickno">{round}.{String(pos).padStart(2, '0')}</span>
                    </div>
                    <span className="dgc-name">
                      {pick.metadata?.first_name} {pick.metadata?.last_name}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="dgc-pickno">{round}.{String(pos).padStart(2, '0')}</span>
                    {isOnClock && (
                      <span className="dgc-clock">
                        <Icon name="zap" size={12} /> On the Clock
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          }),
        ])}
      </div>
    </div>
  )
}
