export default function PickupSuggestions({ players = [], mode = 'redraft' }) {
  const valueLabel = mode === 'dynasty' ? 'Dynasty-Wert' : 'ROS-Rang'

  return (
    <div className="an-card">
      <h3>Pickup-Empfehlungen</h3>
      {!players.length && <p className="an-empty">Keine Free-Agent-Daten verfügbar.</p>}
      {!!players.length && (
        <table className="an-table">
          <thead>
            <tr><th>Spieler</th><th>Pos</th><th>Team</th><th>{valueLabel}</th></tr>
          </thead>
          <tbody>
            {players.slice(0, 25).map((p) => (
              <tr key={p.player_id}>
                <td>{p.name}{p.trending && <span title="Wird liga-uebergreifend gerade oft geholt"> 🔥</span>}</td>
                <td>{p.pos}</td>
                <td>{p.team}</td>
                <td>{p.value ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
