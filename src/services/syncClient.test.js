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
