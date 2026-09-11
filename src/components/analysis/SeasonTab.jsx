// Saison-Tab: presentational. Alle Daten kommen als sim-Prop herein
// (useSeasonSim aus Task 5); diese Datei kennt weder Worker noch Stores.
const fmtPct = (v) => `${Number(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
const fmtWins = (v) => Number(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })

export function SimControls({ sim }) {
  if (sim.state === 'idle') {
    return (
      <div className="an-sim-controls">
        <p className="an-muted">10.000 Simulationen aus Rest-Spielplan und projizierten Punkten — lokal auf deinem Gerät, ohne KI.</p>
        <button type="button" className="an-btn" onClick={sim.onStart}>Simulation starten</button>
      </div>
    )
  }
  if (sim.state === 'loading' || sim.state === 'simulating') {
    const { done = 0, total = 10000 } = sim.progress || {}
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="an-sim-controls">
        <div className="an-progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
          <div className="an-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="an-muted">{sim.state === 'loading' ? 'Lade Daten …' : `${done.toLocaleString('de-DE')} / ${total.toLocaleString('de-DE')} Sims (${pct} %)`}</p>
        <button type="button" className="an-btn an-btn-ghost" onClick={sim.onCancel}>Abbrechen</button>
      </div>
    )
  }
  return (
    <div className="an-sim-controls">
      <button type="button" className="an-btn an-btn-ghost" onClick={sim.onStart}>Neu simulieren</button>
    </div>
  )
}

export function OddsTable({ odds }) {
  return (
    <table className="an-odds-table">
      <thead>
        <tr>
          <th scope="col">Team</th>
          <th scope="col" title="Projizierte Siege im Mittel">W-L (Ø)</th>
          <th scope="col" title="Anteil der Sims mit Playoff-Qualifikation">Playoffs</th>
          <th scope="col" title="Anteil der Sims mit Freilos in Runde 1">Bye</th>
          <th scope="col" title="Anteil der Sims mit Meisterschaft">Titel</th>
        </tr>
      </thead>
      <tbody>
        {(odds || []).map((o) => (
          <tr key={o.rosterId} className={o.isMine ? 'is-mine' : undefined}>
            <th scope="row">
              {o.name}
              {o.reducedAccuracy && <span className="an-badge" title="Weniger als 3 projizierte Starter mit echter Projektion"> reduzierte Genauigkeit</span>}
            </th>
            <td>{fmtWins(o.winsAvg)}</td>
            <td>{fmtPct(o.playoffPct)}</td>
            <td>{fmtPct(o.byePct)}</td>
            <td>{fmtPct(o.titlePct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SeasonTab({ sim }) {
  if (sim.state === 'unavailable') {
    return (
      <div className="an-season">
        <p className="an-muted">{sim.unavailableReason || 'Simulation nicht verfügbar.'}</p>
      </div>
    )
  }
  return (
    <div className="an-season">
      <SimControls sim={sim} />
      {sim.state === 'done' && sim.odds && <OddsTable odds={sim.odds} />}
    </div>
  )
}
