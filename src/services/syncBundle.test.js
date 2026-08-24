import { describe, it, expect, beforeEach } from 'vitest'
import { SYNC_KEY, collectBundle, applyBundle, mergeBundles } from './syncBundle.js'

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

  // sdh.playersMeta.v2 ist ein >2 MB Re-Fetch-Cache der oeffentlichen Sleeper-
  // API. Mitgebuendelt hat er zusammen mit dem Board bisher jeden Push am
  // 3-MB-Limit des Servers scheitern lassen (413, lautlos als 'error').
  it('laesst Re-Fetch-Caches liegen', () => {
    localStorage.setItem('sdh.playersMeta.v2', 'riesig')
    localStorage.setItem('sdh-fc-dynasty-v1', 'auch-riesig')
    const out = collectBundle()
    expect(out['sdh.playersMeta.v2']).toBeUndefined()
    expect(out['sdh-fc-dynasty-v1']).toBeUndefined()
  })

  // Aendert sich bei praktisch jeder Board-Interaktion (Timestamp pro
  // angezeigtem Tipp) -- ohne Ausschluss haelt das jedes Geraet permanent
  // "aenderungsbereit" und laesst es bei jedem Tick seinen eigenen, moeglich-
  // erweise veralteten Stand pushen und damit frischere Aenderungen des
  // anderen Geraets ueberschreiben.
  it('laesst den Tipp-Cooldown liegen', () => {
    localStorage.setItem('sdh.tip.cooldown.v2', '{"x":123}')
    expect(collectBundle()['sdh.tip.cooldown.v2']).toBeUndefined()
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

describe('mergeBundles', () => {
  // Der eigentliche Fehler hinter "Sync geht nur von PC zu Handy": beide Geraete
  // aendern verschiedene Keys, der PC pusht zuerst, das Handy zieht — und ohne
  // Mischen ist die Handy-Aenderung weg.
  it('behaelt beide Seiten, wenn verschiedene Keys geaendert wurden', () => {
    const base   = { 'sdh.prefs': 'alt', 'sdh-board-v1': 'alt' }
    const local  = { 'sdh.prefs': 'handy', 'sdh-board-v1': 'alt' }
    const remote = { 'sdh.prefs': 'alt', 'sdh-board-v1': 'pc' }
    expect(mergeBundles(base, local, remote)).toEqual({
      'sdh.prefs': 'handy',
      'sdh-board-v1': 'pc',
    })
  })

  it('nimmt den Fremdstand, wo wir selbst nichts geaendert haben', () => {
    expect(mergeBundles({ k: 'alt' }, { k: 'alt' }, { k: 'neu' })).toEqual({ k: 'neu' })
  })

  it('behaelt unseren Stand, wo der andere nichts geaendert hat', () => {
    expect(mergeBundles({ k: 'alt' }, { k: 'neu' }, { k: 'alt' })).toEqual({ k: 'neu' })
  })

  // Am selben Key laesst sich nicht mehr entscheiden — dann gilt weiter die
  // zugesagte Regel "der zuletzt hochgeladene Stand gewinnt".
  it('gibt bei echtem Konflikt am selben Key dem Server den Vorrang', () => {
    expect(mergeBundles({ k: 'alt' }, { k: 'handy' }, { k: 'pc' })).toEqual({ k: 'pc' })
  })

  // Sonst faellt der Key aus dem Buendel, der naechste Takt sieht ihn als eigene
  // Neuerung und schiebt ihn wieder hoch: Ping-Pong ohne Ende.
  it('verliert keinen Key, den nur eine Seite kennt', () => {
    expect(mergeBundles({}, { nurLokal: 'a' }, { nurFremd: 'b' })).toEqual({
      nurLokal: 'a',
      nurFremd: 'b',
    })
  })

  it('sortiert die Keys, damit der Vergleichsstring stabil bleibt', () => {
    const out = mergeBundles({}, { b: '2', a: '1' }, { c: '3' })
    expect(Object.keys(out)).toEqual(['a', 'b', 'c'])
  })
})
