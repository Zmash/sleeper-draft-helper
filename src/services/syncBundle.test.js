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
