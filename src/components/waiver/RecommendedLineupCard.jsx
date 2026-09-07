import Icon from '../Icon'

export default function RecommendedLineupCard({ lineup, comparison }) {
  if (!lineup) return null
  return (
    <div className="an-card">
      <h3>Empfohlene Aufstellung diese Woche</h3>
      {comparison?.isOptimal && (
        <p className="an-badge-ok"><Icon name="check" size={14} /> Bereits optimal gesetzt</p>
      )}
      {comparison && !comparison.isOptimal && (
        <div className="an-lineup-diff">
          <strong>Abweichend von deiner aktuellen Aufstellung:</strong>
          <ul>
            {comparison.diffs.map((d) => (
              <li key={d.slot + d.in}>{d.slot}: {d.name} sollte rein</li>
            ))}
          </ul>
        </div>
      )}
      <table className="an-table">
        <thead><tr><th>Slot</th><th>Spieler</th></tr></thead>
        <tbody>
          {lineup.slots.map((s) => (
            <tr key={s.slot + s.slotIndex}>
              <td>{s.slot}</td>
              <td>{s.player ? s.player.name : <span className="an-empty">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
