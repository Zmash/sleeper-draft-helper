import Icon from './Icon'

function fmtPick(round, slot) {
  return slot ? `${round}.${String(slot).padStart(2, '0')}` : '—'
}

export default function OnTheClockBar({ draft, picks, teamsCount, draftSlot }) {
  if (!draft) return null

  const rounds = Number(draft.settings?.rounds) || null
  const made = picks?.length || 0
  const overall = made + 1
  const teams = Number(teamsCount) || null
  const round = teams ? Math.floor(made / teams) + 1 : null
  const slotInRound = teams ? (made % teams) + 1 : null
  const isMock = !draft.league_id
  const yourNextIn = teams && draftSlot ? (draftSlot - slotInRound + teams) % teams : null

  return (
    <section className="clockbar" aria-label="Draft-Status">
      <div className="oc-tag">
        <span className="oc-lab">On the clock</span>
        <span className="oc-pick">{fmtPick(round, slotInRound)}</span>
      </div>
      <div className="oc-mid">
        {round && (
          <div className="oc-stat">
            <span className="k">Runde</span>
            <span className="v">{round}{rounds ? ` / ${rounds}` : ''}</span>
          </div>
        )}
        <div className="oc-stat">
          <span className="k">Pick</span>
          <span className="v">{overall}</span>
        </div>
        {yourNextIn != null && (
          <div className="oc-stat">
            <span className="k">Bis zu dir</span>
            <span className="v acc">{yourNextIn === 0 ? 'Jetzt' : `in ${yourNextIn}`}</span>
          </div>
        )}
        {isMock && (
          <span className="oc-mock">
            <Icon name="radio" size={14} /> Mock
          </span>
        )}
      </div>
    </section>
  )
}
