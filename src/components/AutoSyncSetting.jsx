import { useUIStore } from '../stores/useUIStore'
import { PAGE_SYNC, autoSecondsFor, staleSecondsFor } from '../services/pageSync'

const minutes = (s) => (s % 60 === 0 ? `${s / 60} min` : `${s} s`)

// Hauptschalter fuer das automatische Nachladen. Die Takte selbst sind je
// Seite fest (services/pageSync.js) — hier steht nur, ob sie ueberhaupt
// laufen, plus eine Uebersicht, damit der Schalter nicht abstrakt bleibt.
export default function AutoSyncSetting() {
  const autoSyncEnabled = useUIStore((s) => s.autoSyncEnabled)
  const setAutoSyncEnabled = useUIStore((s) => s.setAutoSyncEnabled)

  const rows = PAGE_SYNC
    .filter((e) => e.label)
    .map((e) => {
      const normal = autoSecondsFor(e, { draftSeconds: 30 })
      const live = autoSecondsFor(e, { live: true, draftSeconds: 30 })
      return {
        prefix: e.prefix,
        label: e.label.replace(' aktualisieren', ''),
        takt: e.draftInterval
          ? 'Draft-Intervall'
          : normal == null ? '—' : live !== normal ? `${minutes(normal)} · live ${minutes(live)}` : minutes(normal),
        stale: staleSecondsFor(e, { draftSeconds: 30 }),
      }
    })

  return (
    <div className="card">
      <h3>Automatisch aktualisieren</h3>
      <label className="row items-center" style={{ gap: 8 }}>
        <input
          type="checkbox"
          checked={autoSyncEnabled}
          onChange={(e) => setAutoSyncEnabled(e.target.checked)}
        />
        <span>Seiten im Hintergrund aktualisieren</span>
      </label>
      <div className="muted text-xs mb-1">
        Aus heißt: nur noch über den Aktualisieren-Knopf. Der Punkt am Knopf wird
        trotzdem rot, sobald der Stand veraltet ist — gerade dann willst du es sehen.
      </div>
      <table className="an-table">
        <thead>
          <tr><th>Seite</th><th>Takt</th><th>Veraltet nach</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.prefix}>
              <td>{r.label}</td>
              <td className="muted">{autoSyncEnabled ? r.takt : 'aus'}</td>
              <td className="muted">{r.stale == null ? '—' : minutes(r.stale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
