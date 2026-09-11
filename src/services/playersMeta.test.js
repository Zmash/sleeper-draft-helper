import { describe, it, expect } from 'vitest'
import { fillByeFallback } from './playersMeta'

describe('fillByeFallback', () => {
  it('ergaenzt fehlende bye_week aus der Saisontabelle', () => {
    const data = {
      1: { player_id: '1', full_name: 'Q Back', team: 'KC', bye_week: null },
      2: { player_id: '2', full_name: 'D Line', team: 'PIT', bye_week: null },
    }
    fillByeFallback(data, 2026)
    expect(data[1].bye_week).toBe(5)
    expect(data[2].bye_week).toBe(9)
  })
  it('vorhandene Sleeper-Werte gewinnen immer', () => {
    const data = { 1: { player_id: '1', full_name: 'Q Back', team: 'KC', bye_week: 4 } }
    fillByeFallback(data, 2026)
    expect(data[1].bye_week).toBe(4)
  })
  it('ohne Tabelleneintrag passiert nichts (kein Fake)', () => {
    const data = {
      1: { player_id: '1', full_name: 'Q Back', team: 'KC', bye_week: null },
      2: { player_id: '2', full_name: 'X Man', team: null, bye_week: null },
    }
    fillByeFallback(data, 1999)
    expect(data[1].bye_week).toBeNull()
    fillByeFallback(data, 2026)
    expect(data[1].bye_week).toBe(5)
    expect(data[2].bye_week).toBeNull()
  })
})
