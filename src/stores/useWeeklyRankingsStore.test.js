import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useWeeklyRankingsStore } from './useWeeklyRankingsStore'

const MOCK_RANKINGS = {
  ok: true,
  players: [{ name: 'Travis Kelce', team: 'KC', pos: 'TE', ecr: 1 }],
}

function mockFetch(response) {
  return vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(response) }))
}

beforeEach(() => {
  useWeeklyRankingsStore.setState({ byKey: new Map(), loadedAt: new Map(), loading: new Set() })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('useWeeklyRankingsStore', () => {
  it('laedt und cached Rankings je pos+scope', async () => {
    const fetchSpy = mockFetch(MOCK_RANKINGS)
    vi.stubGlobal('fetch', fetchSpy)
    await useWeeklyRankingsStore.getState().loadIfStale({ pos: 'TE', scope: 'week' })
    expect(fetchSpy).toHaveBeenCalledWith('/api/rankings/fantasypros-position?pos=TE&scope=week&scoring=ppr')
    const map = useWeeklyRankingsStore.getState().getRankMap({ pos: 'TE', scope: 'week' })
    expect(map.get('NAME:travis kelce')).toBe(1)
  })

  it('scraped nicht erneut, solange der Cache frisch ist', async () => {
    const fetchSpy = mockFetch(MOCK_RANKINGS)
    vi.stubGlobal('fetch', fetchSpy)
    await useWeeklyRankingsStore.getState().loadIfStale({ pos: 'TE', scope: 'week' })
    await useWeeklyRankingsStore.getState().loadIfStale({ pos: 'TE', scope: 'week' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('Fehler beim Fetch: still bleiben, kein Crash', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))
    await expect(
      useWeeklyRankingsStore.getState().loadIfStale({ pos: 'TE', scope: 'week' })
    ).resolves.toBeUndefined()
    const map = useWeeklyRankingsStore.getState().getRankMap({ pos: 'TE', scope: 'week' })
    expect(map.size).toBe(0)
  })
})
