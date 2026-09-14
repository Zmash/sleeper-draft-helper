import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fillByeFallback, loadPlayersMetaCached } from './playersMeta'

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

describe('loadPlayersMetaCached — Game-Day-Cache', () => {
  const CACHE_KEY = 'sdh.playersMeta.v5'
  const PLAYER = { player_id: '1', full_name: 'Q Back', team: 'KC', status: 'Inactive' }

  const seedCache = (fetchedAt) => localStorage.setItem(CACHE_KEY, JSON.stringify({
    season: 2026,
    fetched_at: fetchedAt,
    data: { 1: { player_id: '1', full_name: 'Q Back', team: 'KC', status: 'Active' } },
  }))

  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true, status: 200, json: () => Promise.resolve({ 1: PLAYER }),
    })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('nutzt den Cache innerhalb der TTL, solange er nach dem Kickoff geholt wurde', async () => {
    const now = Date.now()
    seedCache(now - 60_000)
    const data = await loadPlayersMetaCached({ season: 2026, staleBefore: now - 120_000 })
    expect(data['1'].status).toBe('Active')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('laedt neu, wenn der Cache aelter ist als der letzte Kickoff (Inactives fehlen)', async () => {
    const now = Date.now()
    seedCache(now - 4 * 60 * 60 * 1000) // gestern Abend geholt, TTL laeuft noch
    const data = await loadPlayersMetaCached({ season: 2026, staleBefore: now - 60 * 60 * 1000 })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(data['1'].status).toBe('Inactive')
  })

  it('ohne staleBefore bleibt es beim alten TTL-Verhalten', async () => {
    seedCache(Date.now() - 4 * 60 * 60 * 1000)
    const data = await loadPlayersMetaCached({ season: 2026 })
    expect(fetch).not.toHaveBeenCalled()
    expect(data['1'].status).toBe('Active')
  })
})
