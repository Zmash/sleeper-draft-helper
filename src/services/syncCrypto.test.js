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
