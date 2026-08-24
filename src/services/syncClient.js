// Kopplung, HTTP und Abgleichschleife. Einzige Stelle des Sync mit
// Nebenwirkungen — syncCrypto und syncBundle bleiben rein.

import { SYNC_KEY, collectBundle, applyBundle, mergeBundles } from './syncBundle'
import { deriveRoomId, encryptBundle, decryptBundle } from './syncCrypto'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useUIStore } from '../stores/useUIStore'

// Alle persistierten Stores neu aus localStorage lesen statt reload(): applyBundle()
// schreibt nur localStorage, Zustand-Persist merkt das im selben Tab nicht von allein
// (das 'storage'-Event feuert nur in ANDEREN Tabs). rehydrate() ist genau dafuer da.
function rehydratePersistedStores() {
  return Promise.all(
    [useSessionStore, useBoardStore, useLiveStore, useUIStore].map((s) => s.persist.rehydrate())
  )
}

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

// Zwischen dem Lesen von st und dem Zurueckschreiben liegt ein await — in der
// Zeit kann der Nutzer getrennt oder neu gekoppelt haben. Ohne diese Pruefung
// schriebe ein noch laufender Abgleich das alte Geheimnis zurueck: die Anzeige
// stuende auf "nicht gekoppelt", das Geraet lieferte aber weiter in denselben
// Raum. Beim Neukoppeln ueberschriebe es das frische Geheimnis.
function saveIfStillPaired(st, patch) {
  if (loadSyncState()?.secret !== st.secret) return false
  saveSyncState({ ...st, ...patch })
  return true
}

async function syncOnceInner() {
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
    // cache: 'no-store' zusaetzlich zum Server-Header: sonst kann der eigene
    // Browser-Cache (oder ein Reverse-Proxy) eine alte Antwort auf dieselbe
    // URL ausliefern, ohne dass ueberhaupt ein Netzwerk-Request passiert.
    const r = await fetch(`/api/sync/${room}`, { headers, cache: 'no-store' })
    if (r.status === 200) remote = await r.json()
    else if (r.status !== 304 && r.status !== 404) return 'error'
  } catch {
    // Netz weg — beim naechsten Takt erneut. Der Sync darf einen laufenden
    // Draft nie blockieren.
    return 'error'
  }

  let pulled = false
  // Der Stand, auf den sich beide Geraete zuletzt geeinigt hatten. Dient als
  // Basis des Dreiwege-Abgleichs und zugleich als Vergleichswert dafuer, ob wir
  // etwas Eigenes zu senden haben.
  let agreed = st.lastSentBundle

  if (remote && remote.stamp !== st.lastSeenStamp) {
    let bundle
    try {
      bundle = await decryptBundle(st.secret, remote)
    } catch {
      return 'badkey'
    }
    // Ohne Basis (frisch gekoppelt, lastSentBundle ist bewusst null) gibt es
    // nichts zu mischen: das hinzukommende Geraet uebernimmt den vorhandenen
    // Stand vollstaendig. Genau so ist die Kopplung gemeint.
    let base = null
    try { base = agreed ? JSON.parse(agreed) : null } catch { base = null }
    applyBundle(base ? mergeBundles(base, collectBundle(), bundle) : bundle)

    // Basis ist ab hier der SERVER-Stand, nicht der gemischte. Nur so erkennt
    // der Push-Zweig unten, dass unser Ergebnis davon abweicht, und schickt es
    // hoch — sonst behielten wir das Mischergebnis fuer uns und das andere
    // Geraet saehe unsere Aenderung nie wieder.
    agreed = JSON.stringify(bundle)
    saveIfStillPaired(st, { lastSeenStamp: remote.stamp, lastSentBundle: agreed })
    pulled = true
  }

  const serialized = JSON.stringify(collectBundle())
  if (serialized === agreed) return pulled ? 'pulled' : 'idle'

  try {
    const body = await encryptBundle(st.secret, JSON.parse(serialized))
    const r = await fetch(`/api/sync/${room}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) return pulled ? 'pulled' : 'error'
    const { stamp } = await r.json()
    saveIfStillPaired(st, { lastSeenStamp: stamp, lastSentBundle: serialized })
    // 'pulled' hat Vorrang vor 'pushed': nur daran erkennt tick(), dass die
    // Oberflaeche neu einlesen muss.
    return pulled ? 'pulled' : 'pushed'
  } catch {
    return pulled ? 'pulled' : 'error'
  }
}

// Deckt syncOnceInner komplett ab statt jeden localStorage-Schreibzugriff
// einzeln zu sichern: setItem kann bei ueberschrittenem Speicherkontingent
// werfen, und dort ist applyBundle() (bis zu 150 KB) der groesste Schreiber
// von allen. Ein rejected Promise wuerde tick() erreichen und dort sowohl
// den SYNC_EVENT als auch das Rehydrieren nach 'pulled' verschlucken — das
// darf dem laufenden Draft nie passieren.
export async function syncOnce() {
  try {
    return await syncOnceInner()
  } catch {
    return 'error'
  }
}

export function startSync({ intervalMs = 30000 } = {}) {
  let stopped = false
  // Verhindert, dass Intervall und visibilitychange gleichzeitig laufen —
  // sonst geht ein doppelter POST raus, der den Server-Stempel zweimal
  // vorruecken laesst und dem anderen Geraet einen Pull ohne echte Aenderung vorgaukelt.
  let running = false

  async function tick() {
    if (stopped || running) return
    running = true
    try {
      const r = await syncOnce()
      // Erneut pruefen: waehrend des await kann gestoppt worden sein. React
      // ruft Effekte im StrictMode doppelt auf, also gibt es abgebrochene
      // Schleifen wirklich — ein Rehydrieren aus einer toten Schleife mitten
      // im Draft soll trotzdem nicht mehr passieren als noetig.
      if (stopped) return
      // Ohne diesen Ruf bleibt 'badkey' unsichtbar: der Sync taete stumm
      // nichts und der Nutzer haette keinen Anhaltspunkt.
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: r }))
      // Statt reload(): Stores neu einlesen und die bestehenden Setup-Listener
      // (App.jsx, BoardSection.jsx) ueber 'sdh:setup-changed' anstossen — dieselbe
      // Kette, die SetupForm auch bei einer lokalen Aenderung durchlaeuft.
      if (r === 'pulled') {
        await rehydratePersistedStores()
        window.dispatchEvent(new CustomEvent('sdh:setup-changed'))
      }
    } finally {
      running = false
    }
  }

  tick()
  const id = setInterval(tick, intervalMs)

  // Bei JEDEM Sichtbarkeitswechsel abgleichen, nicht nur beim Verstecken:
  // tick()/syncOnce() entscheidet selbst push vs. pull anhand der Stempel.
  // Wird das Geraet weggelegt, hat sich meist der eigene Stand geaendert ->
  // push. Wird es wieder hervorgeholt, ist eher der andere Stand neuer ->
  // pull. Ohne den Pull-Fall haette man bis zu intervalMs (Default 30s)
  // gewartet, bis eine frisch gesetzte Markierung vom anderen Geraet sichtbar
  // wird — genau der Moment, in dem man nach dem Geraetewechsel hinschaut.
  const onVisibilityChange = () => tick()
  document.addEventListener('visibilitychange', onVisibilityChange)

  return () => {
    stopped = true
    clearInterval(id)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
