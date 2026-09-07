// src/components/waiver/StreamingBoard.jsx
const ALL_POSITIONS = ['DEF', 'QB', 'TE']

function RankList({ title, players = [] }) {
  return (
    <div className="an-streaming-col">
      <strong>{title}</strong>
      <ol>
        {players.slice(0, 10).map((p) => (
          <li key={p.player_id}>{p.name} <span className="an-muted">({p.team})</span></li>
        ))}
        {!players.length && <li className="an-empty">Keine Daten</li>}
      </ol>
    </div>
  )
}

export default function StreamingBoard({ board = {}, positions = [], onTogglePosition }) {
  return (
    <div className="an-card">
      <h3>Streaming-Ranking</h3>
      <div className="an-streaming-checkboxes">
        {ALL_POSITIONS.map((pos) => (
          <label key={pos}>
            <input
              type="checkbox"
              checked={positions.includes(pos)}
              onChange={() => onTogglePosition(pos)}
            />
            {pos}
          </label>
        ))}
      </div>
      {positions.map((pos) => (
        <div key={pos} className="an-streaming-row">
          <h4>{pos}</h4>
          <div className="an-streaming-cols">
            <RankList title="Diese Woche" players={board[pos]?.week} />
            <RankList title="ROS" players={board[pos]?.ros} />
          </div>
        </div>
      ))}
    </div>
  )
}
