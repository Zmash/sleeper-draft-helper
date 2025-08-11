export default function RosterList({ picks, me }) {
    const mine = (picks || []).filter((p) => p.picked_by === me)
  
    const positionOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']
    mine.sort((a, b) => {
      const ai = positionOrder.indexOf(a?.metadata?.position || '')
      const bi = positionOrder.indexOf(b?.metadata?.position || '')
      if (ai !== bi) return ai - bi
      return (a.pick_no || 0) - (b.pick_no || 0)
    })
  
    if (!mine.length) {
      return <div className="muted">Noch keine eigenen Picks.</div>
    }
  
    return (
      <div className="grid2">
        {mine.map((m) => (
          <div key={m.pick_no} className="card" style={{ padding: '12px' }}>
            <div className="row between">
              <strong>
                {m.metadata?.first_name} {m.metadata?.last_name}
              </strong>
              <span className="chip">#{m.pick_no}</span>
            </div>
  
            <div className="muted text-xs" style={{ marginTop: '4px' }}>
              {m.metadata?.position} • {m.metadata?.team}
            </div>
          </div>
        ))}
      </div>
    )
  }
  