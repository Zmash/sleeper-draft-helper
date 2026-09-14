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
  useWeeklyRankingsStore.setState({
    byKey: new Map(), sleeperWeekKey: null, sleeperWeekById: new Map(), sleeperWeekByKey: new Map(),
    loadedAt: new Map(), loading: new Set(),
    fpWeekPtsByScoring: new Map(), fpWeekPtsLoadedAt: new Map(), fpWeekPtsLoading: new Set(),
  })
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

  it('haelt jede Woche einzeln vor und schaltet beim Zurueckblaettern korrekt um', async () => {
    const byWeek = {
      1: { ok: true, players: [{ sleeper_id: 'X', pts_ppr: 10 }] },
      2: { ok: true, players: [{ sleeper_id: 'X', pts_ppr: 20 }] },
    }
    const fetchSpy = vi.fn((url) => {
      const week = new URL(url, 'http://x').searchParams.get('week')
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(byWeek[week]) })
    })
    vi.stubGlobal('fetch', fetchSpy)
    const store = () => useWeeklyRankingsStore.getState()
    await store().loadSleeperWeekIfStale({ season: 2026, week: 1 })
    await store().loadSleeperWeekIfStale({ season: 2026, week: 2 })
    expect(store().sleeperWeekById.get('X').pts_ppr).toBe(20)

    // Zurueck auf Woche 1: der Frische-Check greift, sleeperWeekById muss
    // trotzdem wieder auf Woche 1 zeigen statt auf Woche 2 stehenzubleiben.
    await store().loadSleeperWeekIfStale({ season: 2026, week: 1 })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(store().sleeperWeekKey).toBe('sleeper-week:2026/1')
    expect(store().sleeperWeekById.get('X').pts_ppr).toBe(10)
    expect(store().getSleeperWeekMap({ season: 2026, week: 2 }).get('X').pts_ppr).toBe(20)
    expect(store().getSleeperWeekMap({ season: 2026, week: 7 }).size).toBe(0)
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

describe('useWeeklyRankingsStore.loadFpWeekPtsIfStale', () => {
  it('laedt FantasyPros-Wochenpunkte je Position+Scoring, gecached unabhaengig vom ECR-Cache', async () => {
    const fetchSpy = mockFetch(MOCK_RANKINGS)
    vi.stubGlobal('fetch', fetchSpy)
    await useWeeklyRankingsStore.getState().loadFpWeekPtsIfStale({ pos: 'TE', scoring: 'ppr' })
    expect(fetchSpy).toHaveBeenCalledWith('/api/rankings/fantasypros-position?pos=TE&scope=week&scoring=ppr')
    const map = useWeeklyRankingsStore.getState().getFpWeekPtsMap({ pos: 'TE', scoring: 'ppr' })
    expect(map.get('NAME:travis kelce')).toBe('14.2')
  })

  it('haelt unterschiedliche Scoring-Varianten derselben Position getrennt (Dashboard zeigt mehrere Ligaformate gleichzeitig)', async () => {
    const fetchSpy = vi.fn((url) => {
      const scoring = new URL(url, 'http://x').searchParams.get('scoring')
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({ ok: true, players: [{ name: 'Travis Kelce', team: 'KC', fantasy_pts: scoring === 'ppr' ? 14.2 : 9.7 }] }),
      })
    })
    vi.stubGlobal('fetch', fetchSpy)
    await useWeeklyRankingsStore.getState().loadFpWeekPtsIfStale({ pos: 'TE', scoring: 'ppr' })
    await useWeeklyRankingsStore.getState().loadFpWeekPtsIfStale({ pos: 'TE', scoring: 'std' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(useWeeklyRankingsStore.getState().getFpWeekPtsMap({ pos: 'TE', scoring: 'ppr' }).get('NAME:travis kelce')).toBe(14.2)
    expect(useWeeklyRankingsStore.getState().getFpWeekPtsMap({ pos: 'TE', scoring: 'std' }).get('NAME:travis kelce')).toBe(9.7)
  })

  it('laedt nicht erneut, solange derselbe pos+scoring-Cache frisch ist', async () => {
    const fetchSpy = mockFetch(MOCK_RANKINGS)
    vi.stubGlobal('fetch', fetchSpy)
    await useWeeklyRankingsStore.getState().loadFpWeekPtsIfStale({ pos: 'TE', scoring: 'ppr' })
    await useWeeklyRankingsStore.getState().loadFpWeekPtsIfStale({ pos: 'TE', scoring: 'ppr' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
