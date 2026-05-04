// One-time migration from draft-helper-state-v3 (old monolithic key) to per-store keys.
// Called in main.jsx before React renders. Safe to call multiple times (idempotent).
export function migrateOldStorage() {
  const SESSION_KEY = 'sdh-session-v1'
  if (localStorage.getItem(SESSION_KEY)) return // already migrated

  let old = {}
  try { old = JSON.parse(localStorage.getItem('draft-helper-state-v3') || '{}') } catch {}
  if (!Object.keys(old).length) return

  const write = (key, state) =>
    localStorage.setItem(key, JSON.stringify({ state, version: 0 }))

  write('sdh-session-v1', {
    sleeperUsername: old.username || '',
    sleeperUserId: old.userId || '',
    seasonYear: String(old.year || new Date().getFullYear()),
    selectedLeagueId: old.leagueId || '',
    selectedDraftId: old.draftId || '',
    manualDraftInput: old.manualDraftInput || '',
  })

  write('sdh-board-v1', {
    csvRawText: old.csvRawText || '',
    boardPlayers: Array.isArray(old.boardPlayers) ? old.boardPlayers : [],
    searchQuery: old.searchQuery || '',
    positionFilter: old.positionFilter || 'ALL',
    teamFilter: old.teamFilter || 'ALL',
    draftMode: old.draftMode || 'redraft',
  })

  write('sdh-live-v1', {
    autoRefreshEnabled: typeof old.autoRefreshEnabled === 'boolean' ? old.autoRefreshEnabled : true,
    refreshIntervalSeconds: Number.isFinite(old.refreshIntervalSeconds) ? old.refreshIntervalSeconds : 10,
  })

  const oldTheme = localStorage.getItem('draft-helper-theme') || 'dark'
  write('sdh-ui-v1', { themeMode: oldTheme })

  console.log('[SDH] Migrated from draft-helper-state-v3')
}
