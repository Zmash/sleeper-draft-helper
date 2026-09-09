// src/components/waiver/StreamingBoard.jsx
import { cx, posColor, posBadgeLabel, fantasyProsPlayerUrl, injuryLabel, formatProjectedPts } from '../../utils/formatting'

const ALL_POSITIONS = ['DEF', 'QB', 'TE']

export default function StreamingBoard({ board = {}, positions = [], availablePositions = null, onTogglePosition, ptsLoaded = false }) {
  // availablePositions kommt aus der Liga (WaiverPage); ohne Prop fallen wir
  // auf alle Positionen zurueck, damit aeltere Aufrufe nichts verlieren.
  const visible = Array.isArray(availablePositions) ? availablePositions : ALL_POSITIONS
  return (
    <div className={`an-card an-card--stream${ptsLoaded ? ' an-card--stream--pts' : ''}`}>
      <h3 className="an-card-title">Streaming-Ranking</h3>
      <div className="an-stream-seg" role="group" aria-label="Positionen für Streaming">
        {visible.map((pos) => (
          <button
            key={pos}
            type="button"
            className={cx('an-stream-seg-btn', positions.includes(pos) && 'is-on')}
            aria-pressed={positions.includes(pos)}
            onClick={() => onTogglePosition(pos)}
          >
            {pos}
          </button>
        ))}
      </div>
      {positions.map((pos) => {
        if (!visible.includes(pos)) return null
        const week = board[pos]?.week || []
        const rosByPlayer = new Map((board[pos]?.ros || []).map((p) => [p.player_id, p.rank]))
        return (
          <div key={pos} className="an-batch">
            <div className="an-listrow an-listrow-head">
              <span />
              <span />
              <span />
              <span className="an-num">Woche</span>
              {ptsLoaded && <span className="an-num">Pkt</span>}
              <span className="an-num an-num-dim">ROS</span>
            </div>
            {week.slice(0, 10).map((p) => (
              <div className="an-listrow" key={p.player_id}>
                <span className="an-pos" style={{ background: posColor(p.pos) }}>{posBadgeLabel(p)}</span>
                <a className="an-listname" href={fantasyProsPlayerUrl(p.name, p)} target="_blank" rel="noreferrer">{p.name}</a>
                <span className={cx('an-inj', p.injury_status && p.injury_status !== 'Questionable' && 'is-out')}>
                  {p.injury_status ? injuryLabel(p.injury_status) : ''}
                </span>
                <span className="an-num">{p.rank ?? '–'}</span>
                {ptsLoaded && <span className="an-num">{formatProjectedPts(p.pts)}</span>}
                <span className="an-num an-num-dim">{rosByPlayer.get(p.player_id) ?? '–'}</span>
              </div>
            ))}
            {!week.length && <p className="an-card-empty">Keine Daten</p>}
          </div>
        )
      })}
      {!visible.length && <p className="an-card-empty">Keine Streaming-Position in dieser Liga</p>}
      {!positions.length && !!visible.length && <p className="an-card-empty">Keine Position ausgewählt</p>}
    </div>
  )
}
