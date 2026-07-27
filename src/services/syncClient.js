// Kopplung, HTTP und Abgleichschleife. Einzige Stelle des Sync mit
// Nebenwirkungen — syncCrypto und syncBundle bleiben rein.

import { SYNC_KEY, collectBundle, applyBundle } from './syncBundle'
import { deriveRoomId, encryptBundle, decryptBundle } from './syncCrypto'

const SECRET_RX = /^[A-Za-z0-9_-]{43}$/

export const SYNC_EVENT = 'sdh:sync-status'

export function loadSyncState() {
  try {
    const raw = localStorage.getItem(SYNC_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    return s && typeof s.secret === 'string' ? s : null
  } catch {
    return null
  }
}

export function saveSyncState(s) {
  localStorage.setItem(SYNC_KEY, JSON.stringify(s))
}

export function isCoupled() {
  return !!loadSyncState()?.secret
}

export function couple(secret) {
  // Stempel bewusst auf null: sonst haelt das Geraet den fremden Stand
  // fuer bereits gesehen und holt ihn nie.
  saveSyncState({ secret, lastSeenStamp: null, lastSentBundle: null })
}

export function decouple() {
  localStorage.removeItem(SYNC_KEY)
}

export function readSecretFromHash(hash) {
  const m = String(hash || '').replace(/^#/, '').match(/(?:^|&)sync=([^&]+)/)
  if (!m) return null
  return SECRET_RX.test(m[1]) ? m[1] : null
}

export function consumeHashSecret() {
  if (typeof location === 'undefined') return false
  const secret = readSecretFromHash(location.hash)
  // Der Hash wird auch dann weggeraeumt, wenn er Unsinn enthielt — er soll
  // nicht in der Adresszeile stehen bleiben.
  if (location.hash) {
    history.replaceState(null, '', location.pathname + location.search)
  }
  if (!secret) return false
  couple(secret)
  return true
}

export function buildPairingUrl(secret, origin) {
  return `${String(origin).replace(/\/+$/, '')}/setup#sync=${secret}`
}

export async function syncOnce() {
  const st = loadSyncState()
  if (!st?.secret) return 'idle'
  if (!globalThis.crypto?.subtle) return 'error'

  let room
  try {
    room = await deriveRoomId(st.secret)
  } catch {
    return 'error'
  }

  let remote = null
  try {
    const headers = st.lastSeenStamp ? { 'If-None-Match': `"${st.lastSeenStamp}"` } : {}
    const r = await fetch(`/api/sync/${room}`, { headers })
    if (r.status === 200) remote = await r.json()
    else if (r.status !== 304 && r.status !== 404) return 'error'
  } catch {
    // Netz weg — beim naechsten Takt erneut. Der Sync darf einen laufenden
    // Draft nie blockieren.
    return 'error'
  }

  if (remote && remote.stamp !== st.lastSeenStamp) {
    let bundle
    try {
      bundle = await decryptBundle(st.secret, remote)
    } catch {
      return 'badkey'
    }
    applyBundle(bundle)
    // Nach dem Anwenden neu sammeln statt das Buendel zu serialisieren:
    // lokale Keys, die nicht im Buendel standen, bleiben ja stehen — sonst
    // sieht der naechste Takt sofort eine "Aenderung" und laedt hoch.
    saveSyncState({
      ...st,
      lastSeenStamp: remote.stamp,
      lastSentBundle: JSON.stringify(collectBundle()),
    })
    return 'pulled'
  }

  const serialized = JSON.stringify(collectBundle())
  if (serialized === st.lastSentBundle) return 'idle'

  try {
    const body = await encryptBundle(st.secret, JSON.parse(serialized))
    const r = await fetch(`/api/sync/${room}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) return 'error'
    const { stamp } = await r.json()
    saveSyncState({ ...st, lastSeenStamp: stamp, lastSentBundle: serialized })
    return 'pushed'
  } catch {
    return 'error'
  }
}

export function startSync({ intervalMs = 30000 } = {}) {
  let stopped = false

  async function tick() {
    if (stopped) return
    const r = await syncOnce()
    // Ohne diesen Ruf bleibt 'badkey' unsichtbar: der Sync taete stumm
    // nichts und der Nutzer haette keinen Anhaltspunkt.
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: r }))
    // Der Reload beendet sich selbst: nach dem Anwenden ist lastSeenStamp
    // gleich remote.stamp, die Pull-Bedingung also falsch.
    if (r === 'pulled') location.reload()
  }

  tick()
  const id = setInterval(tick, intervalMs)

  // Genau der Moment, in dem der PC weggelegt und zum Handy gegriffen wird.
  const onHide = () => {
    if (document.visibilityState === 'hidden') syncOnce()
  }
  document.addEventListener('visibilitychange', onHide)

  return () => {
    stopped = true
    clearInterval(id)
    document.removeEventListener('visibilitychange', onHide)
  }
}
