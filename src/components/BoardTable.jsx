import { cx } from '../utils/formatting'

export default function BoardTable({
  progressPercent,
  pickedCount,
  totalCount,
  filteredPlayers,
}) {
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
        <table className="nowrap">
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
            {filteredPlayers.map((p) => (
              <tr
                key={`${p.id}-${p.name}`}
                className={cx(p.status === 'me' && 'row-me', p.status === 'other' && 'row-other')}
                style={{ lineHeight: 1.8 }}
              >
                <td className="col-rk"   style={{ padding: '0.9rem 0.8rem' }}>{p.rk}</td>
                <td className="col-name" style={{ padding: '0.9rem 0.8rem' }}>
                  <span className={cx('pill', p.status === 'me' && 'pill-me', p.status === 'other' && 'pill-other')}>
                    {p.name}
                  </span>
                </td>
                <td className="col-team" style={{ padding: '0.9rem 0.8rem' }}>{p.team}</td>
                <td className="col-pos"  style={{ padding: '0.9rem 0.8rem' }}>{p.pos}</td>
                <td className="col-bye"  style={{ padding: '0.9rem 0.8rem' }}>{p.bye}</td>
                <td className="col-sos"  style={{ padding: '0.9rem 0.8rem' }}>{p.sos}</td>
                <td className="col-ecr"  style={{ padding: '0.9rem 0.8rem' }}>{p.ecrVsAdp}</td>
                <td className="col-pick" style={{ padding: '0.9rem 0.8rem' }}>{p.pick_no || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
