import { useState } from 'react'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import { useSessionStore } from '../stores/useSessionStore'
import { groupDrafts, draftLabel, draftSubtitle } from '../services/draftGroups'

// Schnellwechsel zwischen Drafts fuer die mobile Ansicht — dasselbe, was am
// Desktop im Breadcrumb haengt, hier als Bottom-Sheet. Waehrend eines
// Draft-Abends wechselt man staendig zwischen Liga-Draft und Mocks; dafuer
// soll man nicht ueber das Setup gehen muessen.
export default function MobileDraftSwitch() {
  const {
    availableDrafts, availableLeagues, selectedDraftId, cardNicknames,
    setSelectedDraftId, setSelectedLeagueId,
  } = useSessionStore()
  const [open, setOpen] = useState(false)

  const groups = groupDrafts(availableDrafts)
  if (!groups.length) return null

  const current = (availableDrafts || []).find((d) => String(d.draft_id) === String(selectedDraftId))

  function pick(d) {
    // Der Draft bestimmt die Liga mit: ein Mock hat league_id null, sonst
    // bliebe die zuletzt gewaehlte Liga faelschlich stehen.
    setSelectedLeagueId(d.league_id ? String(d.league_id) : null)
    setSelectedDraftId(String(d.draft_id))
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm mob-draft-switch"
        onClick={() => setOpen(true)}
        title="Draft wechseln"
        aria-label="Draft wechseln"
      >
        <Icon name="shuffle" size={16} />
        <span className="mob-draft-switch-label">
          {current ? draftLabel(current, availableLeagues, cardNicknames) : 'Draft'}
        </span>
      </button>

      <div className={cx('board-sheet-scrim', open && 'is-open')} onClick={() => setOpen(false)} />
      <div className={cx('board-sheet mob-more-sheet', open && 'is-open')} role="dialog" aria-label="Draft wechseln">
        <div className="board-sheet-head">
          <strong>Draft wechseln</strong>
          <button type="button" className="board-sheet-close" onClick={() => setOpen(false)} aria-label="Schließen">
            <Icon name="x" size={18} />
          </button>
        </div>

        {groups.map((g) => (
          <div key={g.title}>
            <div className="mob-more-group">{g.title}</div>
            {g.items.map((d) => {
              const active = String(d.draft_id) === String(selectedDraftId)
              return (
                <button
                  key={d.draft_id}
                  type="button"
                  className={cx('mob-more-row', active && 'is-active')}
                  onClick={() => pick(d)}
                >
                  <span className="mob-draft-text">
                    <span className="mob-draft-name">{draftLabel(d, availableLeagues, cardNicknames)}</span>
                    <span className="mob-draft-sub">{draftSubtitle(d, availableLeagues, cardNicknames)}</span>
                  </span>
                  {d.status === 'drafting' && <span className="mob-draft-live">Live</span>}
                  {active && <Icon name="check" size={15} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}
