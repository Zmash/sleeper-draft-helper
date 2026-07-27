# Geräte-Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PC und Handy halten ihren localStorage ohne manuelles Zutun gleich, über einen Server, der den Inhalt nicht entschlüsseln kann.

**Architecture:** Der Browser verschlüsselt sein localStorage-Bündel per WebCrypto (AES-GCM) und legt es unter einer aus dem Geheimnis abgeleiteten Raum-ID auf dem eigenen Server ab. Das Geheimnis wandert per QR-Code (Link mit Schlüssel im URL-Fragment) auf das zweite Gerät und erreicht den Server nie. Der Server stempelt jeden Schreibvorgang; die Geräte vergleichen nur Stempel-Gleichheit, nie Uhrzeiten.

**Tech Stack:** WebCrypto (kein Paket), Express 5, Vitest, `qrcode-generator` (neu, dependency-frei).

**Spec:** `docs/superpowers/specs/2026-07-27-geraete-sync-design.md`

## Global Constraints

- **UI-Texte, Kommentare und Fehlermeldungen auf Deutsch** (du-Form), wie im ganzen Projekt.
- **Kein `crypto.subtle` in jsdom.** Nachgemessen: `typeof globalThis.crypto.subtle === 'undefined'`, `getRandomValues` existiert. Tests, die `subtle` brauchen, tragen in Zeile 1 `// @vitest-environment node`.
- **Server-Routen ausschließlich in `src/server/apiRoutes.js`.** `index.js` und `prod.js` sind dünne Entrypoints und werden nicht angefasst.
- **Der Sync darf nie blockieren oder werfen.** Jeder Netzfehler wird verschluckt und beim nächsten Takt erneut versucht. Ein Draft läuft unter Zeitdruck.
- **`sdh.sync.v1` gehört nie ins Bündel.** Sonst kopiert ein Gerät seine Kopplung in fremde Bündel.
- Ableitungs-Labels wörtlich: `sdh-sync-room` und `sdh-sync-enc`.
- Raum-ID-Format wörtlich: `^[a-f0-9]{32}$`.
- Tests laufen mit `npm test` (Vitest, einmalig). Es gibt keinen Linter.

## Dateien

| Datei | Verantwortung |
|-------|---------------|
| `src/services/syncCrypto.js` (neu) | Geheimnis erzeugen, Raum-ID und AES-Schlüssel ableiten, ver-/entschlüsseln. Kennt kein localStorage, kein Netz. |
| `src/services/syncBundle.js` (neu) | Bündel aus localStorage sammeln und anwenden. Kennt keine Krypto, kein Netz. |
| `src/server/apiRoutes.js` (ändern) | Zwei Routen plus reine Dateihelfer. |
| `src/services/syncClient.js` (neu) | Kopplungszustand, Hash-Auswertung, HTTP, Abgleichschleife. Einzige Stelle mit Nebenwirkungen. |
| `src/components/SyncSection.jsx` (neu) | Setup-UI: koppeln, QR zeigen, Status, trennen. |
| `src/components/SetupForm.jsx` (ändern) | Hängt `SyncSection` neben `StrategySection` ein. |
| `src/main.jsx` (ändern) | Wertet `#sync=` vor dem Render aus. |
| `src/App.jsx` (ändern) | Startet die Abgleichschleife. |
| `src/styles/style.css` (ändern) | `.sync-section` und Kindklassen. |

---

### Task 1: syncCrypto — Ableitung und Verschlüsselung

**Files:**
- Create: `src/services/syncCrypto.js`
- Test: `src/services/syncCrypto.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `generateSecret(): string` — 43 Zeichen base64url (32 Byte)
  - `deriveRoomId(secret: string): Promise<string>` — 32 Zeichen hex
  - `deriveKey(secret: string): Promise<CryptoKey>`
  - `encryptBundle(secret: string, obj: object): Promise<{iv: string, ciphertext: string}>` — beide base64url
  - `decryptBundle(secret: string, rec: {iv: string, ciphertext: string}): Promise<object>` — wirft bei falschem Schlüssel

- [ ] **Step 1: Write the failing test**

Erste Zeile ist Pflicht — ohne sie ist `crypto.subtle` undefined.

`src/services/syncCrypto.test.js`:

```js
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  generateSecret, deriveRoomId, encryptBundle, decryptBundle,
} from './syncCrypto.js'

describe('generateSecret', () => {
  it('liefert 43 Zeichen base64url', () => {
    const s = generateSecret()
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('liefert bei jedem Aufruf etwas anderes', () => {
    expect(generateSecret()).not.toBe(generateSecret())
  })
})

describe('deriveRoomId', () => {
  it('erfuellt das Format, das der Server verlangt', async () => {
    const id = await deriveRoomId(generateSecret())
    expect(id).toMatch(/^[a-f0-9]{32}$/)
  })

  it('ist fuer dasselbe Geheimnis stabil', async () => {
    const s = generateSecret()
    expect(await deriveRoomId(s)).toBe(await deriveRoomId(s))
  })

  it('unterscheidet verschiedene Geheimnisse', async () => {
    expect(await deriveRoomId(generateSecret()))
      .not.toBe(await deriveRoomId(generateSecret()))
  })
})

describe('encryptBundle / decryptBundle', () => {
  it('kommt unveraendert zurueck', async () => {
    const s = generateSecret()
    const data = { 'sdh.setup.v2': '{"a":1}', 'sdh-board-v1': 'xyz' }
    const rec = await encryptBundle(s, data)
    expect(rec.ciphertext).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(await decryptBundle(s, rec)).toEqual(data)
  })

  it('nutzt fuer jeden Vorgang ein neues IV', async () => {
    const s = generateSecret()
    const a = await encryptBundle(s, { x: '1' })
    const b = await encryptBundle(s, { x: '1' })
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  // Das ist die eigentliche Zusage an den Nutzer: wer den Schluessel nicht
  // hat, bekommt die Daten nicht — auch der Betreiber nicht.
  it('wirft bei falschem Schluessel', async () => {
    const rec = await encryptBundle(generateSecret(), { x: '1' })
    await expect(decryptBundle(generateSecret(), rec)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/syncCrypto.test.js
```

Expected: FAIL — `Failed to load url ./syncCrypto.js`

- [ ] **Step 3: Write the implementation**

`src/services/syncCrypto.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/syncCrypto.test.js
```

Expected: PASS, 8 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/syncCrypto.js src/services/syncCrypto.test.js
git commit -m "feat(sync): Ableitung und AES-GCM fuer den Geraete-Sync"
```

---

### Task 2: syncBundle — sammeln und anwenden

**Files:**
- Create: `src/services/syncBundle.js`
- Test: `src/services/syncBundle.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `SYNC_KEY: string` — der Wert `'sdh.sync.v1'`
  - `collectBundle(): Record<string, string>` — Keys **sortiert** eingefügt
  - `applyBundle(bundle: Record<string, string>): string[]` — Liste der geschriebenen Keys

Die Sortierung ist kein Schönheitsdetail: `syncClient` erkennt Änderungen, indem es `JSON.stringify(collectBundle())` mit dem zuletzt gesendeten String vergleicht. Käme die Reihenfolge aus localStorage, sähe jede Umsortierung wie eine Änderung aus und das Gerät würde ohne Grund hochladen.

- [ ] **Step 1: Write the failing test**

`src/services/syncBundle.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { SYNC_KEY, collectBundle, applyBundle } from './syncBundle.js'

beforeEach(() => localStorage.clear())

describe('collectBundle', () => {
  // Genau hier krankt der Datei-Export: seine Whitelist kennt nur die
  // Punkt-Keys, weshalb die Zustand-Stores mit Bindestrich seit jeher
  // fehlen. Die Praefixregel kann keinen kuenftigen Store vergessen.
  it('nimmt Punkt- UND Bindestrich-Keys mit', () => {
    localStorage.setItem('sdh.setup.v2', 'a')
    localStorage.setItem('sdh-board-v1', 'b')
    localStorage.setItem('sdh_api_key', 'c')
    const out = collectBundle()
    expect(out['sdh.setup.v2']).toBe('a')
    expect(out['sdh-board-v1']).toBe('b')
    expect(out['sdh_api_key']).toBe('c')
  })

  it('nimmt das Theme mit', () => {
    localStorage.setItem('draft-helper-theme', 'noir')
    expect(collectBundle()['draft-helper-theme']).toBe('noir')
  })

  it('laesst Fremdes liegen', () => {
    localStorage.setItem('irgendwas', 'x')
    expect(collectBundle().irgendwas).toBeUndefined()
  })

  // Sonst kopiert ein Geraet seine eigene Kopplung in fremde Buendel.
  it('nimmt den Sync-Key selbst nie mit', () => {
    localStorage.setItem(SYNC_KEY, '{"secret":"geheim"}')
    expect(collectBundle()[SYNC_KEY]).toBeUndefined()
  })

  it('serialisiert unabhaengig von der Einfuegereihenfolge gleich', () => {
    localStorage.setItem('sdh.b', '2')
    localStorage.setItem('sdh.a', '1')
    const first = JSON.stringify(collectBundle())
    localStorage.clear()
    localStorage.setItem('sdh.a', '1')
    localStorage.setItem('sdh.b', '2')
    expect(JSON.stringify(collectBundle())).toBe(first)
  })
})

describe('applyBundle', () => {
  it('schreibt genau die enthaltenen Keys', () => {
    const applied = applyBundle({ 'sdh.setup.v2': 'neu', 'sdh-board-v1': 'auch' })
    expect(localStorage.getItem('sdh.setup.v2')).toBe('neu')
    expect(applied.sort()).toEqual(['sdh-board-v1', 'sdh.setup.v2'])
  })

  // Ein fremdes Buendel darf die eigene Kopplung nicht kapern.
  it('ignoriert den Sync-Key im Buendel', () => {
    localStorage.setItem(SYNC_KEY, 'meins')
    applyBundle({ [SYNC_KEY]: 'fremd' })
    expect(localStorage.getItem(SYNC_KEY)).toBe('meins')
  })

  it('ignoriert Nicht-Strings statt zu werfen', () => {
    expect(() => applyBundle({ 'sdh.x': { nested: true } })).not.toThrow()
    expect(localStorage.getItem('sdh.x')).toBeNull()
  })

  it('vertraegt null', () => {
    expect(applyBundle(null)).toEqual([])
  })

  // Bewusst: lokale Keys, die im Buendel fehlen, bleiben stehen. Loeschen
  // waere die strengere Lesart von "das ganze Buendel gewinnt", macht aber
  // aus jedem Bug im Sammeln stillen Datenverlust.
  it('loescht lokale Keys nicht, die im Buendel fehlen', () => {
    localStorage.setItem('sdh.alt', 'bleibt')
    applyBundle({ 'sdh.neu': 'x' })
    expect(localStorage.getItem('sdh.alt')).toBe('bleibt')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/syncBundle.test.js
```

Expected: FAIL — `Failed to load url ./syncBundle.js`

- [ ] **Step 3: Write the implementation**

`src/services/syncBundle.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/syncBundle.test.js
```

Expected: PASS, 10 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/syncBundle.js src/services/syncBundle.test.js
git commit -m "feat(sync): Buendel aus localStorage sammeln und anwenden"
```

---

### Task 3: Server — Briefkasten mit zwei Routen

**Files:**
- Modify: `src/server/apiRoutes.js`
- Test: `src/server/apiRoutes.test.js`

**Interfaces:**
- Consumes: nichts aus Task 1/2 (der Server sieht nur Chiffrat)
- Produces:
  - `SYNC_DIR: string` — `path.join(os.tmpdir(), 'sdh-sync')`
  - `MAX_ROOMS: number` — `500`
  - `isValidRoom(room: string): boolean`
  - `readRoom(room: string, dir?: string): {stamp, iv, ciphertext} | null`
  - `writeRoom(room: string, rec: {iv, ciphertext}, dir?: string): string` — der neue Stempel
  - Routen `GET /api/sync/:room` und `POST /api/sync/:room`

Der `dir`-Parameter existiert allein, damit die Tests in ein Wegwerf-Verzeichnis schreiben statt in den echten tmpdir.

- [ ] **Step 1: Write the failing test**

Ans Ende von `src/server/apiRoutes.test.js` anhängen und den Import in Zeile 2/3 erweitern:

```js
import { SYNC_DIR, MAX_ROOMS, isValidRoom, readRoom, writeRoom } from './apiRoutes.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

describe('Sync-Briefkasten', () => {
  const room = 'a'.repeat(32)
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdh-sync-test-'))
  })
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  // Ohne diese Pruefung ist der Dateipfad fuer Traversal offen — der
  // Endpunkt ist unauthentifiziert, das ist eine Vertrauensgrenze.
  it('akzeptiert nur 32 Hex-Zeichen als Raum', () => {
    expect(isValidRoom(room)).toBe(true)
    expect(isValidRoom('../../etc/passwd')).toBe(false)
    expect(isValidRoom('A'.repeat(32))).toBe(false)
    expect(isValidRoom('a'.repeat(31))).toBe(false)
    expect(isValidRoom('')).toBe(false)
  })

  it('liefert null fuer einen unbekannten Raum', () => {
    expect(readRoom(room, dir)).toBeNull()
  })

  it('gibt zurueck, was geschrieben wurde', () => {
    const stamp = writeRoom(room, { iv: 'AAAA', ciphertext: 'BBBB' }, dir)
    expect(typeof stamp).toBe('string')
    expect(readRoom(room, dir)).toEqual({ stamp, iv: 'AAAA', ciphertext: 'BBBB' })
  })

  // Zwei Schreibvorgaenge in derselben Millisekunde duerfen nicht denselben
  // Stempel bekommen — sonst haelt das andere Geraet die neue Fassung fuer
  // die bereits gesehene und holt sie nie.
  it('vergibt bei jedem Schreiben einen neuen Stempel', () => {
    const a = writeRoom(room, { iv: 'A', ciphertext: 'A' }, dir)
    const b = writeRoom(room, { iv: 'B', ciphertext: 'B' }, dir)
    expect(a).not.toBe(b)
  })

  it('weigert sich, einen ungueltigen Raum zu schreiben', () => {
    expect(() => writeRoom('../boese', { iv: 'A', ciphertext: 'A' }, dir)).toThrow()
  })

  it('deckelt die Anzahl Raeume', () => {
    expect(MAX_ROOMS).toBe(500)
    expect(SYNC_DIR).toContain('sdh-sync')
  })

  it('registriert beide Sync-Routen', () => {
    const registered = []
    registerApiRoutes(
      { get: (p) => registered.push(`GET ${p}`), post: (p) => registered.push(`POST ${p}`) },
      { model: DEFAULT_MODEL },
    )
    expect(registered).toContain('GET /api/sync/:room')
    expect(registered).toContain('POST /api/sync/:room')
  })
})
```

`beforeEach` und `afterEach` müssen im Import aus `vitest` in Zeile 1 ergänzt werden:

```js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/server/apiRoutes.test.js
```

Expected: FAIL — `isValidRoom is not a function`

- [ ] **Step 3: Write the implementation**

In `src/server/apiRoutes.js` oben zu den Imports hinzufügen:

```js
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
```

(Falls einer davon schon importiert ist, den vorhandenen Import stehen lassen.)

Dann diesen Block einfügen — vor `registerApiRoutes`:

```js
// ---------- Geräte-Sync: verschlüsselter Briefkasten ----------
// Der Server sieht Raum-ID und Chiffrat, nie den Schlüssel. Er kann den
// Inhalt nicht deuten — das ist die Zusage an die Nutzer, nicht bloß eine
// Zugriffsregel.
//
// tmpdir, weil der Deploy Releases per Symlink umschaltet und alte löscht
// (keep last 5). Alles unterhalb des Release-Verzeichnisses wäre nach zwei
// Deploys weg. Der Verlust bei einem Reboot ist unkritisch: die Wahrheit
// steht im localStorage der Geräte, das nächste Gerät lädt wieder hoch.
export const SYNC_DIR = path.join(os.tmpdir(), 'sdh-sync')
export const MAX_ROOMS = 500

export function isValidRoom(room) {
  return /^[a-f0-9]{32}$/.test(String(room || ''))
}

function roomFile(room, dir) {
  if (!isValidRoom(room)) throw new Error('Ungueltige Raum-ID')
  return path.join(dir, `${room}.json`)
}

export function readRoom(room, dir = SYNC_DIR) {
  try {
    return JSON.parse(fs.readFileSync(roomFile(room, dir), 'utf8'))
  } catch {
    return null
  }
}

// ponytail: raeumt beim Schreiben auf, statt einen Cron/TTL zu bauen.
// Deckelt den Plattenverbrauch hart; wenn das je zu langsam wird, kommt
// die Aufraeumung in einen Timer.
function prune(dir) {
  let files
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  } catch {
    return
  }
  if (files.length <= MAX_ROOMS) return
  const byAge = files
    .map((f) => {
      const p = path.join(dir, f)
      try { return { p, t: fs.statSync(p).mtimeMs } } catch { return { p, t: 0 } }
    })
    .sort((a, b) => a.t - b.t)
  for (const { p } of byAge.slice(0, files.length - MAX_ROOMS)) {
    try { fs.unlinkSync(p) } catch { /* schon weg */ }
  }
}

export function writeRoom(room, rec, dir = SYNC_DIR) {
  const file = roomFile(room, dir)
  fs.mkdirSync(dir, { recursive: true })
  // Date.now() allein reicht nicht: zwei Schreibvorgaenge in derselben
  // Millisekunde bekaemen denselben Stempel, und das andere Geraet haelt
  // die neue Fassung fuer die bereits gesehene.
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  fs.writeFileSync(file, JSON.stringify({ stamp, iv: rec.iv, ciphertext: rec.ciphertext }))
  prune(dir)
  return stamp
}
```

In `registerApiRoutes` die beiden Routen ergänzen:

```js
  app.get('/api/sync/:room', (req, res) => {
    const { room } = req.params
    if (!isValidRoom(room)) return res.status(400).json({ error: 'Ungueltige Raum-ID' })
    const rec = readRoom(room)
    if (!rec) return res.status(404).json({ error: 'Kein Stand hinterlegt' })
    // ETag ist der Stempel. Der Regelfall — nichts hat sich geaendert —
    // kostet damit ein 304 ohne Body statt des vollen Buendels; bei einem
    // 30-Sekunden-Takt auf Mobilfunk ist das der Unterschied zwischen
    // ein paar hundert Byte und rund 18 MB pro Stunde.
    const tag = `"${rec.stamp}"`
    res.set('ETag', tag)
    if (req.headers['if-none-match'] === tag) return res.status(304).end()
    res.json(rec)
  })

  app.post('/api/sync/:room', (req, res) => {
    const { room } = req.params
    if (!isValidRoom(room)) return res.status(400).json({ error: 'Ungueltige Raum-ID' })
    const { iv, ciphertext } = req.body || {}
    if (typeof iv !== 'string' || typeof ciphertext !== 'string') {
      return res.status(400).json({ error: 'iv und ciphertext muessen Strings sein' })
    }
    try {
      res.json({ stamp: writeRoom(room, { iv, ciphertext }) })
    } catch (e) {
      res.status(500).json({ error: String(e?.message || e) })
    }
  })
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/server/apiRoutes.test.js
```

Expected: PASS. Der bestehende Routen-Test in Zeile 14 muss weiter grün sein.

- [ ] **Step 5: Commit**

```bash
git add src/server/apiRoutes.js src/server/apiRoutes.test.js
git commit -m "feat(sync): Briefkasten-Routen mit Server-Stempel und ETag"
```

---

### Task 4: syncClient — Kopplung und Abgleich

**Files:**
- Create: `src/services/syncClient.js`
- Test: `src/services/syncClient.test.js`

**Interfaces:**
- Consumes: `SYNC_KEY`, `collectBundle`, `applyBundle` aus Task 2; `generateSecret`, `deriveRoomId`, `encryptBundle`, `decryptBundle` aus Task 1
- Produces:
  - `loadSyncState(): {secret, lastSeenStamp, lastSentBundle} | null`
  - `saveSyncState(s: object): void`
  - `couple(secret: string): void`
  - `decouple(): void`
  - `isCoupled(): boolean`
  - `readSecretFromHash(hash: string): string | null` — rein, ohne `location`
  - `consumeHashSecret(): boolean` — liest `location.hash`, koppelt, räumt auf
  - `buildPairingUrl(secret: string, origin: string): string`
  - `syncOnce(): Promise<'idle'|'pulled'|'pushed'|'error'|'badkey'>`
  - `startSync(opts?: {intervalMs?: number}): () => void`
  - `SYNC_EVENT: string` — der Wert `'sdh:sync-status'`; `startSync` feuert damit ein `CustomEvent` auf `window`, `detail` ist das Ergebnis von `syncOnce`. Ohne das bliebe `'badkey'` unsichtbar und der Nutzer sähe einen Sync, der stumm nichts tut. Das Muster gibt es im Projekt schon (`sdh:setup-changed` in `SetupForm`).

Getestet wird nur, was ohne `crypto.subtle` geht — also Zustand, Hash und URL. `syncOnce` und `startSync` brauchen subtle und werden im echten Browser verifiziert (Task 6).

- [ ] **Step 1: Write the failing test**

`src/services/syncClient.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadSyncState, saveSyncState, couple, decouple, isCoupled,
  readSecretFromHash, buildPairingUrl,
} from './syncClient.js'
import { SYNC_KEY } from './syncBundle.js'

const SECRET = 'A'.repeat(43)

beforeEach(() => localStorage.clear())

describe('Kopplungszustand', () => {
  it('ist anfangs nicht gekoppelt', () => {
    expect(isCoupled()).toBe(false)
    expect(loadSyncState()).toBeNull()
  })

  it('koppelt und legt die Stempel leer an', () => {
    couple(SECRET)
    expect(isCoupled()).toBe(true)
    expect(loadSyncState()).toEqual({ secret: SECRET, lastSeenStamp: null, lastSentBundle: null })
  })

  // Sonst haelt das neu gekoppelte Geraet den fremden Stand faelschlich
  // fuer bereits gesehen und holt ihn nie.
  it('setzt die Stempel beim erneuten Koppeln zurueck', () => {
    saveSyncState({ secret: 'alt', lastSeenStamp: 'x1', lastSentBundle: '{}' })
    couple(SECRET)
    expect(loadSyncState().lastSeenStamp).toBeNull()
    expect(loadSyncState().lastSentBundle).toBeNull()
  })

  it('trennt vollstaendig', () => {
    couple(SECRET)
    decouple()
    expect(isCoupled()).toBe(false)
    expect(localStorage.getItem(SYNC_KEY)).toBeNull()
  })

  it('vertraegt kaputten JSON im Speicher', () => {
    localStorage.setItem(SYNC_KEY, 'kein json')
    expect(loadSyncState()).toBeNull()
    expect(isCoupled()).toBe(false)
  })
})

describe('readSecretFromHash', () => {
  it('liest den Schluessel', () => {
    expect(readSecretFromHash(`#sync=${SECRET}`)).toBe(SECRET)
  })

  it('kommt ohne fuehrendes # aus', () => {
    expect(readSecretFromHash(`sync=${SECRET}`)).toBe(SECRET)
  })

  it('ignoriert fremde Fragmente', () => {
    expect(readSecretFromHash('#board')).toBeNull()
    expect(readSecretFromHash('')).toBeNull()
    expect(readSecretFromHash(null)).toBeNull()
  })

  // Was nicht wie ein Schluessel aussieht, wird nicht als einer behandelt.
  it('lehnt falsche Laenge und fremde Zeichen ab', () => {
    expect(readSecretFromHash('#sync=zukurz')).toBeNull()
    expect(readSecretFromHash(`#sync=${'A'.repeat(44)}`)).toBeNull()
    expect(readSecretFromHash(`#sync=${'!'.repeat(43)}`)).toBeNull()
  })
})

describe('buildPairingUrl', () => {
  it('legt den Schluessel ins Fragment, nie in den Pfad', () => {
    const url = buildPairingUrl(SECRET, 'https://app.example')
    expect(url).toBe(`https://app.example/setup#sync=${SECRET}`)
    // Alles hinter # schickt kein Browser an den Server — das ist der
    // Grund, warum der QR-Code ueberhaupt einen Link tragen darf.
    expect(url.split('#')[0]).not.toContain(SECRET)
  })

  it('haengt keinen zweiten Schraegstrich an', () => {
    expect(buildPairingUrl(SECRET, 'https://app.example/')).toBe(
      `https://app.example/setup#sync=${SECRET}`,
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/services/syncClient.test.js
```

Expected: FAIL — `Failed to load url ./syncClient.js`

- [ ] **Step 3: Write the implementation**

`src/services/syncClient.js`:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/syncClient.test.js
```

Expected: PASS, 13 Tests.

`SYNC_EVENT` bleibt hier ungetestet — `startSync` braucht `crypto.subtle`, das jsdom nicht hat. Der Beleg ist der Browser-Durchgang in Task 6.

- [ ] **Step 5: Commit**

```bash
git add src/services/syncClient.js src/services/syncClient.test.js
git commit -m "feat(sync): Kopplungszustand, Hash-Auswertung und Abgleichschleife"
```

---

### Task 5: SyncSection — Setup-UI mit QR-Code

**Files:**
- Create: `src/components/SyncSection.jsx`
- Create: `src/components/SyncSection.test.jsx`
- Modify: `src/styles/style.css`
- Modify: `package.json` (neue Abhängigkeit)

**Interfaces:**
- Consumes: `isCoupled`, `couple`, `decouple`, `loadSyncState`, `buildPairingUrl` aus Task 4; `generateSecret` aus Task 1
- Produces: `<SyncSection />` — keine Props

`generateSecret` braucht nur `getRandomValues`, das jsdom hat. `deriveRoomId` (braucht `subtle`) wird beim Rendern **nicht** aufgerufen — sonst wären die Komponententests nicht lauffähig.

- [ ] **Step 1: Abhängigkeit installieren**

```bash
npm install qrcode-generator
```

`qrcode-generator` ist dependency-frei und erzeugt einen SVG-String ohne Canvas — läuft dadurch auch unter jsdom im Test. Einen QR-Encoder selbst zu schreiben hieße Reed-Solomon-Kodierung nachzubauen; das ist die eine Stelle in diesem Plan, an der ein Paket billiger ist als eigener Code.

- [ ] **Step 2: Write the failing test**

`src/components/SyncSection.test.jsx`:

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SyncSection from './SyncSection'
import { SYNC_KEY } from '../services/syncBundle'
import { loadSyncState, SYNC_EVENT } from '../services/syncClient'

beforeEach(() => localStorage.clear())

describe('SyncSection', () => {
  it('bietet ungekoppelt das Koppeln an', () => {
    render(<SyncSection />)
    expect(screen.getByRole('button', { name: /koppeln/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /trennen/i })).not.toBeInTheDocument()
  })

  it('erzeugt beim Koppeln ein Geheimnis und zeigt den QR-Code', () => {
    render(<SyncSection />)
    fireEvent.click(screen.getByRole('button', { name: /koppeln/i }))
    expect(loadSyncState()?.secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(document.querySelector('.sync-qr svg')).toBeTruthy()
  })

  // Der Schluessel muss auch ohne Kamera uebertragbar sein — viele PCs
  // haben keine, und dann ist der QR-Code nutzlos.
  it('zeigt den Kopplungslink zusaetzlich als Text', () => {
    render(<SyncSection />)
    fireEvent.click(screen.getByRole('button', { name: /koppeln/i }))
    const secret = loadSyncState().secret
    expect(screen.getByDisplayValue(new RegExp(secret.slice(0, 12)))).toBeInTheDocument()
  })

  it('zeigt gekoppelt den Trennen-Knopf', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    expect(screen.getByRole('button', { name: /trennen/i })).toBeInTheDocument()
  })

  it('raeumt beim Trennen den Speicher', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    fireEvent.click(screen.getByRole('button', { name: /trennen/i }))
    expect(localStorage.getItem(SYNC_KEY)).toBeNull()
    expect(screen.getByRole('button', { name: /koppeln/i })).toBeInTheDocument()
  })

  // Beim Koppeln gewinnt der zuletzt gespeicherte Stand — das muss dort
  // stehen, wo geklickt wird, nicht nur in der Spec.
  it('warnt, dass ein Stand verloren gehen kann', () => {
    render(<SyncSection />)
    expect(screen.getByText(/zuletzt gespeicherte Stand/i)).toBeInTheDocument()
  })

  // Ohne diese Anzeige sucht der Nutzer bei einer falschen Kopplung lange:
  // der Sync taete stumm nichts.
  it('meldet eine unpassende Kopplung', async () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: 'badkey' }))
    expect(await screen.findByText(/Kopplung passt nicht/i)).toBeInTheDocument()
  })

  it('meldet nichts, wenn der Abgleich laeuft', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ secret: 'A'.repeat(43), lastSeenStamp: null, lastSentBundle: null }))
    render(<SyncSection />)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: 'pushed' }))
    expect(screen.queryByText(/Kopplung passt nicht/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/components/SyncSection.test.jsx
```

Expected: FAIL — `Failed to load url ./SyncSection`

- [ ] **Step 4: Write the implementation**

`src/components/SyncSection.jsx`:

```jsx
import React, { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { generateSecret } from '../services/syncCrypto'
import {
  couple, decouple, isCoupled, loadSyncState, buildPairingUrl, SYNC_EVENT,
} from '../services/syncClient'
import Icon from './Icon'

function qrSvg(text) {
  const qr = qrcode(0, 'M') // 0 = Version automatisch, M = mittlere Fehlerkorrektur
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })
}

export default function SyncSection() {
  const [coupled, setCoupled] = useState(() => isCoupled())
  const [showQr, setShowQr] = useState(false)
  const [badKey, setBadKey] = useState(false)

  useEffect(() => {
    const onStatus = (e) => setBadKey(e.detail === 'badkey')
    window.addEventListener(SYNC_EVENT, onStatus)
    return () => window.removeEventListener(SYNC_EVENT, onStatus)
  }, [])

  const url = useMemo(() => {
    const s = loadSyncState()
    if (!s?.secret || typeof location === 'undefined') return null
    return buildPairingUrl(s.secret, location.origin)
  }, [coupled, showQr])

  // WebCrypto gibt es nur im Secure Context. Ohne diesen Hinweis sieht der
  // Nutzer auf http:// nur einen Sync, der stumm nichts tut.
  const secure = typeof globalThis.crypto?.subtle !== 'undefined'

  function onCouple() {
    couple(generateSecret())
    setCoupled(true)
    setShowQr(true)
  }

  function onDecouple() {
    decouple()
    setCoupled(false)
    setShowQr(false)
    setBadKey(false)
  }

  return (
    <div className="sync-section">
      <div className="sync-head">
        <h3 className="sync-title">Geräte-Sync</h3>
        <span className={`sync-badge ${coupled ? 'is-on' : ''}`}>
          {coupled ? 'gekoppelt' : 'nicht gekoppelt'}
        </span>
      </div>

      <p className="muted text-xs">
        Deine Daten werden im Browser verschlüsselt, bevor sie hochgeladen werden.
        Der Schlüssel bleibt auf deinen Geräten — der Server kann den Inhalt nicht lesen.
        Beim Abgleich gewinnt immer der zuletzt gespeicherte Stand.
      </p>

      {!secure && (
        <p className="sync-warn text-xs">
          Ohne HTTPS steht die Verschlüsselung nicht zur Verfügung. Der Sync bleibt hier aus.
        </p>
      )}

      {badKey && (
        <p className="sync-warn text-xs">
          Die Kopplung passt nicht zu dem, was hinterlegt ist — der Stand wurde nicht
          übernommen. Koppel die Geräte neu.
        </p>
      )}

      {!coupled && (
        <button className="btn btn-primary" onClick={onCouple}>
          <Icon name="key" size={15} /> Geräte koppeln
        </button>
      )}

      {coupled && (
        <div className="sync-actions">
          <button className="btn btn-secondary" onClick={() => setShowQr((v) => !v)}>
            <Icon name="plus" size={15} /> {showQr ? 'QR ausblenden' : 'Weiteres Gerät koppeln'}
          </button>
          <button className="btn btn-ghost" onClick={onDecouple}>Trennen</button>
        </div>
      )}

      {coupled && showQr && url && (
        <div className="sync-pairing">
          {/* Der QR traegt einen Link, keinen Rohschluessel: dann genuegt die
              normale Kamera-App und die Seite braucht keinen eigenen Scanner. */}
          <div className="sync-qr" dangerouslySetInnerHTML={{ __html: qrSvg(url) }} />
          <label className="sync-url-label text-xs">
            Ohne Kamera: diesen Link auf dem anderen Gerät öffnen
            <input className="control" readOnly value={url} onFocus={(e) => e.target.select()} />
          </label>
        </div>
      )}
    </div>
  )
}
```

`key` und `plus` sind in der `MAP` von `src/components/Icon.jsx` vorhanden. `link` und `qr-code` gibt es dort **nicht** — `Icon` fällt bei unbekannten Namen still auf `Star` zurück, der Fehler wäre also nicht sichtbar, nur falsch.

- [ ] **Step 5: CSS ergänzen**

Ans Ende von `src/styles/style.css`:

Nur Tokens, die es in `src/styles/tokens.css` wirklich gibt. Abstände stehen als px da: das Projekt kennt genau ein Space-Token (`--sp-1`), eine `--space-*`-Skala existiert nicht.

```css
/* ---------- Geräte-Sync (Setup) ---------- */
.sync-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-block-start: 16px;
}

.sync-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sync-title { margin: 0; }

.sync-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  color: var(--text-muted);
}

.sync-badge.is-on {
  border-color: var(--good);
  color: var(--good);
}

.sync-warn { color: var(--bad); }

.sync-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.sync-pairing {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px;
}

.sync-qr {
  width: 180px;
  /* QR braucht hellen Grund — in den dunklen Themes waere er sonst
     unscannbar. Bewusst fest, nicht themenabhaengig. */
  background: #fff;
  padding: 8px;
  border-radius: var(--r-ctl);
}

.sync-qr svg { width: 100%; height: auto; display: block; }

.sync-url-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1 1 240px;
  min-width: 0;
}
```

Achtung bei `.control`: Die Klasse erzwingt `--control-h` und `padding-block: 0`. Für das einzeilige Eingabefeld hier ist das richtig — nur mehrzeilige Felder brauchen eine Ausnahme (siehe `.strategy-section textarea.control`).

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run src/components/SyncSection.test.jsx
```

Expected: PASS, 8 Tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/SyncSection.jsx src/components/SyncSection.test.jsx src/styles/style.css package.json package-lock.json
git commit -m "feat(sync): Setup-UI mit QR-Kopplung"
```

---

### Task 6: Verdrahtung und Verifikation im Browser

**Files:**
- Modify: `src/main.jsx`
- Modify: `src/App.jsx`
- Modify: `src/components/SetupForm.jsx:425`

**Interfaces:**
- Consumes: `consumeHashSecret`, `startSync` aus Task 4; `SyncSection` aus Task 5
- Produces: nichts

- [ ] **Step 1: Hash vor dem Render auswerten**

In `src/main.jsx` den Import ergänzen und den Aufruf direkt nach `migrateOldStorage()` setzen:

```js
import { consumeHashSecret } from './services/syncClient.js'

migrateOldStorage()
// Vor dem Render: der Kopplungslink soll nicht erst nach dem Mount greifen,
// und der Schluessel darf nicht in der Adresszeile stehen bleiben.
consumeHashSecret()
```

- [ ] **Step 2: Abgleichschleife starten**

In `src/App.jsx` importieren:

```js
import { startSync } from './services/syncClient'
```

und einen Effekt ohne Abhängigkeiten ergänzen — `startSync` gibt seine eigene Aufräumfunktion zurück:

```js
  useEffect(() => startSync(), [])
```

- [ ] **Step 3: SyncSection ins Setup hängen**

In `src/components/SetupForm.jsx` importieren:

```js
import SyncSection from './SyncSection'
```

und direkt nach dem schließenden `/>` von `<StrategySection … />` (endet bei Zeile 434) einfügen:

```jsx
            <SyncSection />
```

- [ ] **Step 4: Gesamte Suite laufen lassen**

```bash
npm test
```

Expected: alles grün, keine bestehende Datei gebrochen.

- [ ] **Step 5: Im Browser verifizieren**

Dev-Server über `preview_start` mit `.claude/launch.json` starten (`npm run dev:all` — der API-Teil wird für `/api/sync` gebraucht), dann:

1. `/setup` öffnen, „Geräte koppeln" klicken. Erwartet: QR erscheint, `localStorage['sdh.sync.v1']` enthält ein 43-Zeichen-Geheimnis.
2. Konsole prüfen: keine Fehler.
3. Netzwerk prüfen: innerhalb von 30 Sekunden ein `POST /api/sync/<32 hex>` mit Status 200, Antwort `{stamp}`.
4. Den angezeigten Link in einem privaten Fenster öffnen. Erwartet: die Seite lädt, die Adresszeile enthält **kein** `#sync=` mehr, `sdh.sync.v1` ist gesetzt, und nach dem nächsten Takt sind Setup und Rankings des ersten Fensters da.
5. Netzwerk erneut prüfen: ein wiederholtes `GET /api/sync/<room>` liefert **304**, nicht 200.
6. Im zweiten Fenster `sdh.sync.v1` auf ein anderes Geheimnis setzen und neu laden. Erwartet: der Hinweis „Kopplung passt nicht" erscheint im Setup, und **kein** localStorage-Key wird überschrieben.

Punkt 5 ist der Beleg dafür, dass der Takt nicht bei jedem Durchlauf das volle Bündel zieht. Punkt 6 belegt den einzigen Pfad, den kein Vitest-Test abdecken kann — `startSync` und `decryptBundle` brauchen `crypto.subtle`, das es in jsdom nicht gibt.

- [ ] **Step 6: Commit**

```bash
git add src/main.jsx src/App.jsx src/components/SetupForm.jsx
git commit -m "feat(sync): Kopplungslink, Abgleichschleife und Setup-Einbau verdrahten"
```

---

## Nach dem Plan

`graphify update .` laufen lassen — der Graph kennt die fünf neuen Dateien sonst nicht.

**Kein Deploy-Eingriff nötig.** `.github/workflows/deploy.yml` lädt bereits `./src/server/` und `./src/utils/` hoch; alle neuen Client-Dateien landen im Vite-Bundle unter `./dist/`. `qrcode-generator` steht in `dependencies` und wird durch `npm ci --omit=dev` auf dem Server mitinstalliert — gebraucht wird es dort zwar nicht, aber das schadet nicht.
