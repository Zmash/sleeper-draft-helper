import { useEffect, useState } from 'react'
import { useLiveStore } from '../stores/useLiveStore'
import { cx, normalizePos } from '../utils/formatting'
import { SLEEPER_API_BASE, fetchJson, fetchLeagueRosters } from '../services/api'
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
export default function DraftGrid({ draft, teamsCount, ownerLabels, draftSlot, onPlayerClick }) {
  const { livePicks } = useLiveStore()

  // Eigene Liga-User-/Roster-Abfrage statt der global ausgewaehlten Liga: ein
  // per Link angehaengter Draft (Kumpel teilt seinen Live-Draft) gehoert
  // i.d.R. NICHT zur eigenen selectedLeague -- ownerLabels/leagueUsers aus
  // App.jsx waeren dann leer oder fuer die falsche Liga. draft.league_id ist
  // die einzige verlaessliche Quelle fuer "wer draftet hier wirklich".
  const [draftLeagueUsers, setDraftLeagueUsers] = useState([])
  const [draftLeagueRosters, setDraftLeagueRosters] = useState([])
  useEffect(() => {
    const leagueId = draft?.league_id
    // Sichtbares Debug-Signal fuer Team-Namen-Probleme (statt stummem
    // "Team N"): einmal pro Draft-Wechsel in der Konsole (F12 -> Console),
    // was tatsaechlich zur Verfuegung stand.
    console.debug('[DraftGrid] Team-Namen-Aufloesung', {
      draft_id: draft?.draft_id,
      league_id: leagueId,
      hat_draft_order: !!(draft?.draft_order && Object.keys(draft.draft_order).length),
      hat_slot_to_roster_id: !!(draft?.slot_to_roster_id && Object.keys(draft.slot_to_roster_id).length),
    })
    if (!leagueId) { setDraftLeagueUsers([]); setDraftLeagueRosters([]); return }
    let cancelled = false
    // allSettled statt all: draft.slot_to_roster_id fehlt in der Liga-Draft-
    // Liste (nur /draft/{id} direkt hat es), Pfad 2 unten braucht also
    // draftLeagueUsers zuverlaessig -- ein einzelner fehlgeschlagener
    // Rosters-Call darf die (evtl. erfolgreichen) User-Daten nicht mit
    // wegwerfen, sonst faellt alles auf "Team N" zurueck.
    Promise.allSettled([
      fetchJson(`${SLEEPER_API_BASE}/league/${leagueId}/users`),
      fetchLeagueRosters(leagueId),
    ]).then(([usersRes, rostersRes]) => {
      if (cancelled) return
      if (usersRes.status === 'fulfilled' && Array.isArray(usersRes.value)) {
        setDraftLeagueUsers(usersRes.value)
      } else {
        setDraftLeagueUsers([])
        if (usersRes.status === 'rejected') console.warn('[DraftGrid] Liga-User-Fetch fehlgeschlagen:', usersRes.reason)
      }
      if (rostersRes.status === 'fulfilled' && Array.isArray(rostersRes.value)) {
        setDraftLeagueRosters(rostersRes.value)
      } else {
        setDraftLeagueRosters([])
        if (rostersRes.status === 'rejected') console.warn('[DraftGrid] Liga-Rosters-Fetch fehlgeschlagen:', rostersRes.reason)
      }
      console.debug('[DraftGrid] Team-Namen-Aufloesung Ergebnis', {
        users_geladen: usersRes.status === 'fulfilled' ? usersRes.value?.length : `fehlgeschlagen: ${usersRes.reason}`,
        rosters_geladen: rostersRes.status === 'fulfilled' ? rostersRes.value?.length : `fehlgeschlagen: ${rostersRes.reason}`,
      })
    })
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

  function userLabel(user) {
    return user ? user.metadata?.team_name || user.display_name || user.username : null
  }

  function labelForSlot(slot) {
    // 1) slot_to_roster_id -> Roster -> owner_id -> User. Zuverlaessigste
    //    Quelle bei echten Liga-Drafts -- draft_order ist dort oft leer,
    //    bis der Commissioner die Reihenfolge manuell setzt.
    const rosterId = draft?.slot_to_roster_id?.[slot]
    if (rosterId != null) {
      const roster = draftLeagueRosters.find((r) => Number(r.roster_id) === Number(rosterId))
      const label = roster && userLabel(draftLeagueUsers.find((u) => u.user_id === roster.owner_id))
      if (label) return label
    }
    // 2) draft_order (user_id -> Slot) -- greift bei Mocks/manchen Drafts.
    const order = draft?.draft_order || {}
    const uid = Object.keys(order).find((u) => Number(order[u]) === slot)
    const byOrder = uid && userLabel(draftLeagueUsers.find((u2) => u2.user_id === uid))
    if (byOrder) return byOrder
    // 3) Aus bereits gefallenen Picks abgeleitet (App.jsx ownerLabels).
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
                  pick && onPlayerClick && 'draft-grid-cell--clickable',
                  isOnClock && 'draft-grid-cell--clock'
                )}
                onClick={pick && onPlayerClick ? () => onPlayerClick(pick) : undefined}
                role={pick && onPlayerClick ? 'button' : undefined}
                tabIndex={pick && onPlayerClick ? 0 : undefined}
                onKeyDown={
                  pick && onPlayerClick
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlayerClick(pick) } }
                    : undefined
                }
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
                    <span className="dgc-name-line">{pick.metadata?.first_name}</span>
                    <span className="dgc-name-line dgc-name-line--last">{pick.metadata?.last_name}</span>
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
