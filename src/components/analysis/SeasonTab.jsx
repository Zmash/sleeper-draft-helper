// Saison-Tab: presentational. Alle Daten kommen als sim-Prop herein
// (useSeasonSim aus Task 5); diese Datei kennt weder Worker noch Stores.
import { DEFAULT_SIMS } from '../../services/analysis/seasonSim'
const fmtPct = (v) => `${Number(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
// Record-Format wie Dynasty-Daddy („8–6"): Siege gerundet, Rest = Niederlagen.
// Ohne Spiele-Angabe (altes Fixture-Format) Fallback auf Dezimalzahl.
const fmtRecord = (o) => {
  const games = Number(o?.games)
  if (!Number.isFinite(games) || games <= 0) return Number(o?.winsAvg || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  const w = Math.round(Number(o?.winsAvg) || 0)
  return `${w}–${Math.max(0, games - w)}`
}
const fmtRating = (v) => (v == null || !Number.isFinite(Number(v)) ? '–' : String(Math.round(Number(v))))
// Heatmap wie Dynasty-Daddy, aber Theme-sensibel: color-mix mit der
// Theme-Akzentfarbe (Volt-Gelb, Ferrari-Rot, …) statt hardcoded Blau —
// Muster aus newshell.css. Aufloesung passiert im Browser pro Theme.
const heat = (pct) => {
  const p = Math.max(0, Math.min(100, Number(pct) || 0))
  const mix = Math.round((p / 100) * 55)
  return { backgroundColor: `color-mix(in srgb, var(--accent-fill, var(--accent, #4ea1ff)) ${mix}%, transparent)` }
}

export function SimControls({ sim }) {
  const model = sim.model === 'adp' ? 'adp' : 'projections'
  const idleText = model === 'adp'
    ? `${DEFAULT_SIMS.toLocaleString('de-DE')} Simulationen aus ADP-Marktwerten (Sleeper-ADP) — gleiche Skala wie Projektionen, nur die Team-Reihenfolge kommt aus ADP. Lokal auf deinem Gerät, ohne KI.`
    : `${DEFAULT_SIMS.toLocaleString('de-DE')} Simulationen aus Rest-Spielplan und projizierten Punkten — lokal auf deinem Gerät, ohne KI.`
  const toggle = (
    <div className="an-model-toggle" role="group" aria-label="Stärke-Modell">
      <button
        type="button"
        className={model === 'projections' ? 'an-chip is-on' : 'an-chip'}
        aria-pressed={model === 'projections'}
        onClick={() => sim.onModelChange?.('projections')}
      >Projektionen</button>
      <button
        type="button"
        className={model === 'adp' ? 'an-chip is-on' : 'an-chip'}
        aria-pressed={model === 'adp'}
        onClick={() => sim.onModelChange?.('adp')}
      >ADP</button>
    </div>
  )
  if (sim.state === 'idle') {
    return (
      <div className="an-sim-controls">
        {toggle}
        <p className="an-muted">{idleText}</p>
        <button type="button" className="an-btn" onClick={sim.onStart}>Simulation starten</button>
      </div>
    )
  }
  if (sim.state === 'loading' || sim.state === 'simulating') {
    const { done = 0, total = 10000 } = sim.progress || {}
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="an-sim-controls">
        {toggle}
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
      {toggle}
      <button type="button" className="an-btn an-btn-ghost" onClick={sim.onStart}>Neu simulieren</button>
    </div>
  )
}

export function OddsTable({ odds, model }) {
  const ratingTitle = model === 'adp'
    ? 'Normierte ADP-Stärke (gleiche Skala wie Projektionen)'
    : 'Mittlere projizierte Starter-Punkte je Restwoche'
  return (
    <div className="an-table-scroll">
    <table className="an-odds-table">
      <thead>
        <tr>
          <th scope="col" title={ratingTitle}>Rating</th>
          <th scope="col">Team</th>
          <th scope="col" title="Projizierter Endstand (gerundet)">Record</th>
          <th scope="col" title="Anteil der Sims mit Playoff-Qualifikation">Playoffs</th>
          <th scope="col" title="Anteil der Sims mit Freilos in Runde 1">Bye</th>
          <th scope="col" title="Anteil der Sims mit Meisterschaft">Titel</th>
        </tr>
      </thead>
      <tbody>
        {(odds || []).map((o) => (
          <tr key={o.rosterId} className={o.isMine ? 'is-mine' : undefined}>
            <td>{fmtRating(o.rating)}</td>
            <th scope="row">
              {o.name}
              {o.reducedAccuracy && <span className="an-badge" title="Weniger als 3 projizierte Starter mit echter Projektion"> reduzierte Genauigkeit</span>}
            </th>
            <td>{fmtRecord(o)}</td>
            <td style={heat(o.playoffPct)}>{fmtPct(o.playoffPct)}</td>
            <td style={heat(o.byePct)}>{fmtPct(o.byePct)}</td>
            <td style={heat(o.titlePct)}>{fmtPct(o.titlePct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
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
      {sim.state === 'done' && sim.odds && <OddsTable odds={sim.odds} model={sim.model} />}
    </div>
  )
}
