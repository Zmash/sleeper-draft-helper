// Wann aktualisiert sich eine Seite von selbst, und ab wann gilt ihr Stand als
// veraltet? Bisher stand das verstreut: ein Intervall in RedzonePage, eins in
// NflPage, eins fuer die Draft-Picks in App.jsx, und der Wochenrueckblick gar
// nicht. Diese Tabelle ist die eine Quelle dafuer.
//
// Rein: keine Stores, kein Fetch. Was tatsaechlich nachgeladen wird, entscheidet
// `handleMobileSync` in App.jsx — hier steht nur das Timing.

// Ein verpasster Tick ist normal (Tab im Hintergrund, kurzer Netzhaenger).
// Drei verpasste Ticks sind es nicht — ab da faerbt sich der Punkt rot.
export const STALE_FACTOR = 3

// Untergrenze fuer "veraltet": bei sehr kurzen Intervallen (Redzone, 30 s)
// waere 3x zu nervoes, sobald das Netz einmal huestet.
const MIN_STALE_SECONDS = 90

/**
 * @typedef {object} PageSync
 * @property {string} prefix          Pfad-Praefix
 * @property {string|null} label      Beschriftung des Aktualisieren-Knopfs
 * @property {number|null} [autoSeconds]      Takt ohne laufende Spiele
 * @property {number} [liveAutoSeconds]       Takt, solange NFL-Spiele laufen
 * @property {number} [staleSeconds]          Override statt STALE_FACTOR
 * @property {boolean} [draftInterval] true = nutzt das im Board eingestellte
 *   Draft-Intervall und dessen eigenen Auto-Schalter
 */

/** @type {PageSync[]} Reihenfolge = Suchreihenfolge (laengster Treffer gewinnt). */
export const PAGE_SYNC = [
  { prefix: '/dashboard', label: 'Ligen aktualisieren', autoSeconds: 300, liveAutoSeconds: 120 },
  { prefix: '/board', label: 'Picks aktualisieren', draftInterval: true },
  { prefix: '/analyse', label: 'Picks aktualisieren', draftInterval: true },
  { prefix: '/lineup', label: 'Picks aktualisieren', draftInterval: true },
  { prefix: '/trade', label: 'Daten aktualisieren', draftInterval: true },
  { prefix: '/scores', label: 'Spielstände aktualisieren', autoSeconds: 300, liveAutoSeconds: 30 },
  { prefix: '/redzone', label: 'Live-Daten aktualisieren', autoSeconds: 30, liveAutoSeconds: 30 },
  { prefix: '/weekly', label: 'Woche aktualisieren', autoSeconds: 600, liveAutoSeconds: 120 },
  // Formularseiten haben nichts, was von selbst veralten koennte.
  { prefix: '/setup', label: null, autoSeconds: null },
  { prefix: '/profiles', label: null, autoSeconds: null },
]

const FALLBACK = { prefix: '', label: 'Daten aktualisieren', draftInterval: true }

/** Konfiguration zum Pfad; nie null. */
export function pageSyncFor(pathname) {
  const p = String(pathname || '')
  let best = null
  for (const entry of PAGE_SYNC) {
    if (p.startsWith(entry.prefix) && (!best || entry.prefix.length > best.prefix.length)) best = entry
  }
  return best || FALLBACK
}

/**
 * Takt in Sekunden, oder null wenn die Seite nicht von selbst aktualisiert.
 * @param {PageSync} entry
 * @param {{live?: boolean, draftSeconds?: number}} ctx
 */
export function autoSecondsFor(entry, { live = false, draftSeconds } = {}) {
  if (!entry) return null
  if (entry.draftInterval) {
    const n = Number(draftSeconds)
    // Untergrenze wie im alten Poller in App.jsx: 4 s.
    return Number.isFinite(n) && n > 0 ? Math.max(4, n) : null
  }
  const seconds = live && entry.liveAutoSeconds != null ? entry.liveAutoSeconds : entry.autoSeconds
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/**
 * Ab wann der Stand als veraltet gilt, oder null wenn die Seite nie veraltet.
 */
export function staleSecondsFor(entry, ctx = {}) {
  if (!entry) return null
  if (Number.isFinite(entry.staleSeconds)) return entry.staleSeconds
  const auto = autoSecondsFor(entry, ctx)
  return auto == null ? null : Math.max(MIN_STALE_SECONDS, auto * STALE_FACTOR)
}

/** Zeitstempel vereinheitlichen -- useLiveStore haelt ein Date, die anderen ms. */
export function toMs(value) {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : Number(value)
  return Number.isFinite(ms) ? ms : null
}

/**
 * Zustand des Punkts am Sync-Knopf.
 * - 'stale' (rot): der Stand ist aelter als erlaubt — unabhaengig davon, ob
 *   Auto-Sync laeuft. Gerade wenn er aus ist, will man es sehen.
 * - 'auto' (gruen): Auto-Sync laeuft und der Stand ist frisch.
 * - 'none': nichts anzuzeigen (kein Auto-Sync, oder noch nie geladen).
 * @returns {'stale'|'auto'|'none'}
 */
export function syncStatus({ lastAt, staleSeconds, autoOn = false, now = Date.now() } = {}) {
  const at = toMs(lastAt)
  if (at != null && Number.isFinite(staleSeconds) && staleSeconds > 0 && now - at > staleSeconds * 1000) {
    return 'stale'
  }
  return autoOn ? 'auto' : 'none'
}
