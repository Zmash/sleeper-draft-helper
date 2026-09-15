import { useEffect, useState } from 'react'
import { syncStatus } from '../services/pageSync'

// Der Punkt am Sync-Knopf faerbt sich rot, wenn der Stand veraltet — dafuer
// muss er ohne neuen Datenstand von selbst weiterticken. Der Takt sitzt
// bewusst hier und nicht in App.jsx: dort wuerde jede Sekunde der ganze
// Orchestrator samt seiner useMemos neu rechnen.
const TICK_MS = 10 * 1000

/**
 * @param {{lastAt: number|Date|null, staleSeconds: number|null, autoOn: boolean}} args
 * @returns {'stale'|'auto'|'none'}
 */
export function useSyncDot({ lastAt, staleSeconds, autoOn }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])
  return syncStatus({ lastAt, staleSeconds, autoOn, now })
}
