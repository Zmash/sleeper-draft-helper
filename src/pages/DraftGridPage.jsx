import { Link } from 'react-router-dom'
import { useLiveStore } from '../stores/useLiveStore'
import { cx } from '../utils/formatting'
import Icon from '../components/Icon'

// Snake-Position innerhalb der Runde: ungerade Runde direkt, gerade Runde
// gespiegelt -- gleiches Muster wie BoardPage.pickPos / OnTheClockBar.
function posInRound(round, slot, teams) {
  return round % 2 === 1 ? slot : teams - slot + 1
}

export default function DraftGridPage({ selectedDraft, teamsCount, ownerLabels, draftSlot }) {
  const { livePicks } = useLiveStore()

  if (!selectedDraft) {
    return (
      <section className="card dashboard-empty">
        <h2>Kein Draft ausgewählt</h2>
        <p className="muted">Wähle zuerst eine Liga oder einen Mock-Draft.</p>
        <Link className="btn btn-secondary" to="/board">Zurück zum Board</Link>
      </section>
    )
  }

  const teams = Number(teamsCount) || Number(selectedDraft.settings?.teams) || 12
  const rounds =
    Number(selectedDraft.settings?.rounds) ||
    Math.max(1, Math.ceil((livePicks?.length || 0) / teams))

  const picksByCell = new Map()
  for (const p of livePicks || []) {
    if (p?.round != null && p?.draft_slot != null) picksByCell.set(`${p.round}-${p.draft_slot}`, p)
  }
  const currentPickNo = (livePicks?.length || 0) + 1

  function labelForSlot(slot) {
    const bySlot = ownerLabels?.get(`slot:${slot}`)
    if (bySlot) return bySlot
    const order = selectedDraft?.draft_order || {}
    const uid = Object.keys(order).find((u) => Number(order[u]) === slot)
    const byUser = uid && ownerLabels?.get(`user:${uid}`)
    return byUser || `Team ${slot}`
  }

  const slots = Array.from({ length: teams }, (_, i) => i + 1)
  const roundsArr = Array.from({ length: rounds }, (_, i) => i + 1)

  return (
    <section className="card draft-grid-page">
      <div className="row between items-center wrap" style={{ gap: 8, marginBottom: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Draft-Board</h2>
        <Link className="btn btn-ghost btn-sm" to="/board">Zur Liste</Link>
      </div>
      <div className="draft-grid-scroll">
        <div className="draft-grid" style={{ gridTemplateColumns: `repeat(${teams}, minmax(120px, 1fr))` }}>
          {slots.map((slot) => (
            <div key={`h-${slot}`} className={cx('draft-grid-head', slot === draftSlot && 'draft-grid-head--me')}>
              {labelForSlot(slot)}
            </div>
          ))}
          {roundsArr.map((round) =>
            slots.map((slot) => {
              const pick = picksByCell.get(`${round}-${slot}`)
              const pos = posInRound(round, slot, teams)
              const pickNo = (round - 1) * teams + pos
              const isOnClock = !pick && pickNo === currentPickNo
              return (
                <div
                  key={`${round}-${slot}`}
                  className={cx(
                    'draft-grid-cell',
                    pick && 'draft-grid-cell--picked',
                    isOnClock && 'draft-grid-cell--clock'
                  )}
                >
                  <span className="dgc-pickno">{round}.{String(pos).padStart(2, '0')}</span>
                  {pick ? (
                    <>
                      <span className="dgc-name">
                        {pick.metadata?.first_name} {pick.metadata?.last_name}
                      </span>
                      <span className="dgc-meta">
                        {pick.metadata?.position}
                        {pick.metadata?.team ? ` · ${pick.metadata.team}` : ''}
                      </span>
                    </>
                  ) : isOnClock ? (
                    <span className="dgc-clock">
                      <Icon name="zap" size={12} /> On the Clock
                    </span>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
