export default function BoardToolbar({
    currentPickNumber,
    autoRefreshEnabled,
    onToggleAutoRefresh,
    refreshIntervalSeconds,
    onChangeInterval,
    onSync,
    lastSyncAt,
  }) {
    return (
      <div className="toolbar">
        <span className="chip chip--small">Aktuelle Picks: {currentPickNumber}</span>
  
        <label className="toolbar-item">
          <input
            type="checkbox"
            checked={autoRefreshEnabled}
            onChange={onToggleAutoRefresh}
          />
          <span>Auto-Refresh</span>
        </label>
  
        <div className="toolbar-item">
          <span>Intervall (s)</span>
          <input
            className="w-16"
            value={refreshIntervalSeconds}
            onChange={onChangeInterval}
          />
        </div>
  
        <button className="btn ghost" onClick={onSync}>
          Sync
        </button>
  
        {lastSyncAt && (
          <span className="muted text-xs">
            zuletzt{' '}
            {lastSyncAt.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false,
            })}
          </span>
        )}
      </div>
    )
  }
  