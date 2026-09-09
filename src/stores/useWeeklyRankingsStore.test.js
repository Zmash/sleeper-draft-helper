import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useWeeklyRankingsStore } from './useWeeklyRankingsStore'

const MOCK_RANKINGS = {
  ok: true,
  players: [{ name: 'Travis Kelce', team: 'KC', pos: 'TE', ecr: 1, fantasy_pts: '14.2' }],
}

function mockFetch(response) {
  return vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(response) }))
}

beforeEach(() => {
  useWeeklyRankingsStore.setState({ byKey: new Map(), sleeperWeekKey: null, sleeperWeekById: new Map(), loadedAt: new Map(), loading: new Set() })
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

  it('laedt Sleeper-Wochenprojektionen je Sleeper-ID', async () => {
    const fetchSpy = mockFetch({
      ok: true,
      players: [
        { sleeper_id: '4881', pos: 'QB', team: 'BAL', pts_ppr: 19.5, pts_half_ppr: 19.0, pts_std: 18.5 },
        { sleeper_id: 'SEA', pos: 'DEF', team: 'SEA', pts_ppr: 7.8, pts_half_ppr: 7.8, pts_std: 7.8 },
      ],
    })
    vi.stubGlobal('fetch', fetchSpy)
    await useWeeklyRankingsStore.getState().loadSleeperWeekIfStale({ season: 2026, week: 1 })
    expect(fetchSpy).toHaveBeenCalledWith('/api/rankings/sleeper-projections-week?season=2026&week=1')
    const { sleeperWeekKey, sleeperWeekById } = useWeeklyRankingsStore.getState()
    expect(sleeperWeekKey).toBe('sleeper-week:2026/1')
    expect(sleeperWeekById.get('4881')).toEqual({ pts_ppr: 19.5, pts_half_ppr: 19.0, pts_std: 18.5 })
    expect(sleeperWeekById.get('SEA').pts_std).toBe(7.8)
  })

  it('laedt Sleeper-Woche nicht erneut, solange der Cache frisch ist', async () => {
    const fetchSpy = mockFetch({ ok: true, players: [] })
    vi.stubGlobal('fetch', fetchSpy)
    await useWeeklyRankingsStore.getState().loadSleeperWeekIfStale({ season: 2026, week: 1 })
    await useWeeklyRankingsStore.getState().loadSleeperWeekIfStale({ season: 2026, week: 1 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
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
