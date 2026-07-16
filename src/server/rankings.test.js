import { describe, it, expect } from 'vitest'
import { FFC_FORMATS, normalizeFfcPos, normalizeFfcPlayer, isDynastyFromQuery } from './rankings'
import { normalizePlayerName } from '../utils/formatting'

describe('normalizeFfcPos', () => {
  it('FFC nennt Kicker PK — wir nennen ihn K', () => {
    expect(normalizeFfcPos('PK')).toBe('K')
  })
  it('DEF bleibt DEF', () => {
    expect(normalizeFfcPos('DEF')).toBe('DEF')
  })
  it('normale Positionen bleiben unveraendert und werden gross geschrieben', () => {
    expect(normalizeFfcPos('rb')).toBe('RB')
  })
})

describe('FFC_FORMATS', () => {
  it('ist eine Whitelist — kein Pfad-Durchreichen aus der Query', () => {
    expect(FFC_FORMATS).toContain('ppr')
    expect(FFC_FORMATS).toContain('2qb')
    expect(FFC_FORMATS).not.toContain('../../etc/passwd')
  })
})

describe('normalizeFfcPlayer', () => {
  const raw = {
    player_id: 5670, name: 'Bijan Robinson', position: 'RB', team: 'ATL',
    adp: 1.7, adp_formatted: '1.02', times_drafted: 241, high: 1, low: 4, stdev: 0.7, bye: 11,
  }
  it('bildet auf die Board-Form ab', () => {
    const p = normalizeFfcPlayer(raw)
    expect(p.name).toBe('Bijan Robinson')
    expect(p.pos).toBe('RB')
    expect(p.adp).toBe(1.7)
    expect(p.bye).toBe(11)
    expect(p.stdev).toBe(0.7)
  })
  it('setzt nname fuer den Merge — identisch zur Client-Normalisierung', () => {
    // Leerzeichen bleiben erhalten! normalizePlayerName strippt nur [^a-z\s]
    // und die Suffixe jr/sr/ii/iii/iv. Ein zusammengezogenes "bijanrobinson"
    // wuerde gegen das Board nie matchen.
    expect(normalizeFfcPlayer(raw).nname).toBe('bijan robinson')
  })
  it('strippt Suffixe wie die Client-Funktion', () => {
    expect(normalizeFfcPlayer({ ...raw, name: 'Marvin Harrison Jr.' }).nname).toBe('marvin harrison')
  })
  it('normalisiert PK zu K', () => {
    expect(normalizeFfcPlayer({ ...raw, position: 'PK' }).pos).toBe('K')
  })
})

describe('isDynastyFromQuery', () => {
  it('default ist true — der Rookie-Pfad bleibt unberuehrt (Regression)', () => {
    expect(isDynastyFromQuery(undefined)).toBe(true)
    expect(isDynastyFromQuery('')).toBe(true)
  })
  it('nur der explizite String "false" schaltet ab', () => {
    expect(isDynastyFromQuery('false')).toBe(false)
    expect(isDynastyFromQuery('true')).toBe(true)
    expect(isDynastyFromQuery('irgendwas')).toBe(true)
  })
})
