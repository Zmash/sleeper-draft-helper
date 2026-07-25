import { describe, it, expect, beforeEach } from 'vitest'
import {
  STRATEGIES_KEY, loadStrategies, saveStrategies, migrateLegacyStrategy, newStrategyItem,
} from './strategyStore'

beforeEach(() => { localStorage.clear() })

describe('loadStrategies', () => {
  it('liefert einen leeren Store, wenn nichts gespeichert ist', () => {
    expect(loadStrategies()).toEqual({ version: 1, principles: '', items: [] })
  })

  it('liefert einen leeren Store bei kaputtem JSON', () => {
    localStorage.setItem(STRATEGIES_KEY, '{nicht json')
    expect(loadStrategies()).toEqual({ version: 1, principles: '', items: [] })
  })

  it('ergaenzt fehlende Felder', () => {
    localStorage.setItem(STRATEGIES_KEY, JSON.stringify({ version: 1 }))
    expect(loadStrategies()).toEqual({ version: 1, principles: '', items: [] })
  })
})

describe('saveStrategies', () => {
  it('schreibt und liest zurueck', () => {
    saveStrategies({ version: 1, principles: 'P', items: [] })
    expect(loadStrategies().principles).toBe('P')
  })
})

describe('migrateLegacyStrategy', () => {
  it('uebernimmt sdh.strategy.v1 als Wildcard-Item', () => {
    localStorage.setItem('sdh.strategy.v1', 'Alter Text')
    migrateLegacyStrategy()
    const store = loadStrategies()
    expect(store.items).toHaveLength(1)
    expect(store.items[0].fingerprint).toBeNull()
    expect(store.items[0].summary).toBe('Alter Text')
    expect(store.items[0].source).toBe('manual')
  })

  it('laesst den alten Key stehen (Rollback bleibt moeglich)', () => {
    localStorage.setItem('sdh.strategy.v1', 'Alter Text')
    migrateLegacyStrategy()
    expect(localStorage.getItem('sdh.strategy.v1')).toBe('Alter Text')
  })

  it('ist idempotent', () => {
    localStorage.setItem('sdh.strategy.v1', 'Alter Text')
    migrateLegacyStrategy()
    migrateLegacyStrategy()
    expect(loadStrategies().items).toHaveLength(1)
  })

  it('tut nichts ohne alten Key', () => {
    migrateLegacyStrategy()
    expect(localStorage.getItem(STRATEGIES_KEY)).toBeNull()
  })

  it('tut nichts bei leerem alten Key', () => {
    localStorage.setItem('sdh.strategy.v1', '   ')
    migrateLegacyStrategy()
    expect(localStorage.getItem(STRATEGIES_KEY)).toBeNull()
  })
})

describe('newStrategyItem', () => {
  it('vergibt id und createdAt', () => {
    const it1 = newStrategyItem({ label: 'A', summary: 'S' })
    expect(it1.id).toBeTruthy()
    expect(it1.createdAt).toBeTruthy()
    expect(it1.rules).toEqual([])
  })
})
