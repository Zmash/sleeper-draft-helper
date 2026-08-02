// Sammelt und schreibt das Sync-Bündel. Kennt weder Krypto noch Netz.

export const SYNC_KEY = 'sdh.sync.v1'

// Alles mit Präfix "sdh" plus diese Ausnahmen. Eine gepflegte Whitelist
// wurde verworfen: genau daran krankt der Datei-Export, dessen
// VERSIONED_PREFIXES die Bindestrich-Stores (sdh-board-v1) nie erfasst hat.
const EXTRA_KEYS = ['draft-helper-theme']

// Reine Re-Fetch-Caches oeffentlicher APIs (24h-TTL, auf jedem Geraet aus
// derselben Quelle neu ladbar). sdh.playersMeta.v2 allein ist >2 MB — zusammen
// mit dem Board hat das JEDEN Push am 3-MB-Limit des Servers scheitern lassen,
// lautlos als 413 (syncOnce() faengt das nur als 'error' ab). Mitsynced wird
// dadurch auch nichts gewonnen: die Caches sind auf beiden Geraeten ohnehin
// identisch bzw. laufen unabhaengig ab.
const EXCLUDE_KEYS = ['sdh.playersMeta.v2', 'sdh-fc-dynasty-v1']

function isBundled(k) {
  return k !== SYNC_KEY && !EXCLUDE_KEYS.includes(k) && (k.startsWith('sdh') || EXTRA_KEYS.includes(k))
}

export function collectBundle() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && isBundled(k)) keys.push(k)
  }
  // Sortiert einfuegen: syncClient erkennt Aenderungen ueber den
  // serialisierten String — ohne feste Reihenfolge sieht jede Umsortierung
  // von localStorage wie eine Aenderung aus.
  keys.sort()
  const out = {}
  for (const k of keys) {
    const v = localStorage.getItem(k)
    if (v !== null) out[k] = v
  }
  return out
}

export function applyBundle(bundle) {
  const applied = []
  for (const [k, v] of Object.entries(bundle || {})) {
    if (k === SYNC_KEY || typeof v !== 'string') continue
    localStorage.setItem(k, v)
    applied.push(k)
  }
  return applied
}
