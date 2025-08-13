// src/components/BoardTable.jsx
import { cx } from '../utils/formatting'

export default function BoardTable({
  progressPercent,
  pickedCount,
  totalCount,
  filteredPlayers,
  highlightedNnames = [],
  primaryNname = null,
  adviceReasons = {},
}) {
  const toKey = (s) => String(s || '').trim().toLowerCase()
  const highlightSet = new Set((highlightedNnames || []).map(toKey))
  const primaryKey = toKey(primaryNname)

  return (
    <>
      {/* Progress */}
      <div className="progress mt-2">
        <div style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="muted text-xs mt-1">
        {pickedCount} von {totalCount} Spielern markiert
      </div>

      {/* Table */}
      <div className="table-wrap mt-3">
        <table className="nowrap board-table">
          <thead>
            <tr>
              <th className="col-rk">#</th>
              <th className="col-name">Name</th>
              <th className="col-team">Team</th>
              <th className="col-pos">Pos</th>
              <th className="col-bye">Bye</th>
              <th className="col-sos">SOS</th>
              <th className="col-ecr">ECR±ADP</th>
              <th className="col-pick">Pick</th>
            </tr>
          </thead>

          <tbody>
            {filteredPlayers.map((p) => {
              const keyN = toKey(p.nname || p.name)
              const isHighlighted = highlightSet.has(keyN)
              const isPrimary = primaryKey && keyN === primaryKey
              const reason = adviceReasons[keyN] || ''

              return (
                <tr
                  key={`${p.id ?? p.nname ?? p.name}`}
                  id={`row-${p.nname}`}
                  className={cx(
                    p.status === 'me' && 'row-me',
                    p.status === 'other' && 'row-other',
                    isHighlighted && 'row-ai',
                    isPrimary && 'row-ai-primary'
                  )}
                  title={reason || undefined}
                  data-nname={p.nname || ''}
                  data-ai={isHighlighted ? (isPrimary ? 'primary' : 'alt') : 'none'}
                >
                  <td className="col-rk">{p.rk}</td>

                  <td className="col-name">
                    <strong>{p.name}</strong>
                    {isHighlighted && (
                      <span
                        className={cx('ai-badge', isPrimary ? 'ai-badge-primary' : 'ai-badge-alt')}
                        title={isPrimary ? 'Primäre AI-Empfehlung' : 'AI-Alternative'}
                      >
                        {isPrimary ? 'AI' : 'alt'}
                      </span>
                    )}

                    {/* Mobile-Subline: kompakte Zusatzinfos */}
                    <div className="row-subline mobile-only">
                    {p.team} · {p.pos}
                    {p.bye ? ` · Bye ${p.bye}` : ''}
                    {p.sos ? ` · SOS ${p.sos}` : ''}
                    {p.ecrVsAdp ? ` · Δ ${p.ecrVsAdp}` : ''}
                  </div>
                  </td>

                  <td className="col-team">{p.team}</td>
                  <td className="col-pos">{p.pos}</td>
                  <td className="col-bye">{p.bye}</td>
                  <td className="col-sos">{p.sos}</td>
                  <td className="col-ecr">{p.ecrVsAdp}</td>
                  <td className="col-pick">{p.pick_no || ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
