// Sammelt und schreibt das Sync-Bündel. Kennt weder Krypto noch Netz.

export const SYNC_KEY = 'sdh.sync.v1'

// Alles mit Präfix "sdh" plus diese Ausnahmen. Eine gepflegte Whitelist
// wurde verworfen: genau daran krankt der Datei-Export, dessen
// VERSIONED_PREFIXES die Bindestrich-Stores (sdh-board-v1) nie erfasst hat.
const EXTRA_KEYS = ['draft-helper-theme']

function isBundled(k) {
  return k !== SYNC_KEY && (k.startsWith('sdh') || EXTRA_KEYS.includes(k))
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
