// Ableitung und Verschlüsselung für den Geräte-Sync.
//
// Bewusst SHA-256 mit Label statt HKDF/PBKDF2: Der Input ist bereits 32 Byte
// Vollentropie aus dem CSPRNG, kein vom Menschen gewähltes Passwort.
// Key-Stretching schützt gegen Raten und hat hier nichts zu tun — gebraucht
// wird nur Domänentrennung, und dafür genügt ein Hash mit anderem Label.
//
// crypto.subtle gibt es nur im Secure Context (HTTPS, localhost, Capacitor)
// und NICHT in jsdom. Tests dieser Datei laufen unter environment: node.

const ROOM_LABEL = 'sdh-sync-room'
const ENC_LABEL = 'sdh-sync-enc'

function toB64url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s) {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function derive(secret, label) {
  const s = fromB64url(secret)
  const l = new TextEncoder().encode(label)
  const buf = new Uint8Array(s.length + l.length)
  buf.set(s)
  buf.set(l, s.length)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
}

export function generateSecret() {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return toB64url(b)
}

export async function deriveRoomId(secret) {
  const h = await derive(secret, ROOM_LABEL)
  return [...h].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

export async function deriveKey(secret) {
  const raw = await derive(secret, ENC_LABEL)
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptBundle(secret, obj) {
  const key = await deriveKey(secret)
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  const data = new TextEncoder().encode(JSON.stringify(obj))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data))
  return { iv: toB64url(iv), ciphertext: toB64url(ct) }
}

export async function decryptBundle(secret, rec) {
  const key = await deriveKey(secret)
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64url(rec.iv) },
    key,
    fromB64url(rec.ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(pt))
}
