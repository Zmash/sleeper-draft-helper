import Icon from './Icon'

// Gleiche Stufen wie das Auto-Sync-Sheet der Mobile-Bar (BoardMobileBar).
const INTERVALS = [10, 30, 60, 120]

// Sync-Cluster im Board-Kopf: EIN Button mit Auto-Punkt statt
// Checkbox + Intervall-Feld + Sync-Button. Das Intervall ist ein stilles
// Select daneben, der Zeitstempel bleibt Text.
export default function BoardToolbar({
  autoRefreshEnabled,
  onToggleAutoRefresh,
  refreshIntervalSeconds,
  onChangeInterval,
  onSync,
  lastSyncAt,
}) {
  const current = Number(refreshIntervalSeconds)
  const value = autoRefreshEnabled ? String(current) : 'off'

  // Gleiches Muster wie BoardMobileBar.applySyncPreset: synthetische
  // {target:{...}}-Objekte auf die bestehenden Handler abbilden.
  function handleIntervalChange(e) {
    const v = e.target.value
    if (v === 'off') {
      onToggleAutoRefresh?.({ target: { checked: false } })
      return
    }
    onChangeInterval?.({ target: { value: Number(v) } })
    if (!autoRefreshEnabled) onToggleAutoRefresh?.({ target: { checked: true } })
  }

  return (
    <div className="sync-cluster">
      <button className="btn-compact sync-btn" onClick={onSync} title="Picks jetzt synchronisieren">
        <Icon name="refresh" size={14} /> Sync
        {autoRefreshEnabled && <span className="sync-auto-dot" title="Auto-Refresh aktiv" />}
      </button>
      <select
        className="sync-interval"
        value={value}
        onChange={handleIntervalChange}
        aria-label="Auto-Refresh-Intervall"
      >
        <option value="off">auto aus</option>
        {!INTERVALS.includes(current) && current > 0 && (
          <option value={current}>auto {current} s</option>
        )}
        {INTERVALS.map((s) => (
          <option key={s} value={s}>auto {s} s</option>
        ))}
      </select>
      {lastSyncAt && (
        <span className="sync-last">
          zuletzt{' '}
          <span className="sync-last-time">
            {lastSyncAt.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })}
          </span>
        </span>
      )}
    </div>
  )
}
