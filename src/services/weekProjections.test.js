import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = {
  loadSleeperWeekIfStale: vi.fn(() => Promise.resolve()),
  loadFpWeekPtsIfStale: vi.fn(() => Promise.resolve()),
  getFpWeekPtsMap: vi.fn(({ pos, scoring }) => new Map([[`${pos}-key`, scoring === 'half' ? 5 : 1]])),
}
vi.mock('../stores/useWeeklyRankingsStore', () => ({ useWeeklyRankingsStore: { getState: () => store } }))

import { detectScoringType, loadWeekProjections, fpPtsMapFor } from './weekProjections'

beforeEach(() => vi.clearAllMocks())

describe('weekProjections', () => {
  it('erkennt das Scoring an scoring_settings.rec', () => {
    expect(detectScoringType({ scoring_settings: { rec: 1 } })).toBe('ppr')
    expect(detectScoringType({ scoring_settings: { rec: 0.5 } })).toBe('half_ppr')
    expect(detectScoringType({ scoring_settings: { rec: 0 } })).toBe('standard')
    expect(detectScoringType({})).toBe('ppr')
  })
  it('laedt Sleeper einmal und FantasyPros je Position und Scoring', async () => {
    await loadWeekProjections({ season: '2026', week: 1, scoringTypes: new Set(['ppr', 'half_ppr']) })
    expect(store.loadSleeperWeekIfStale).toHaveBeenCalledWith({ season: '2026', week: 1 })
    expect(store.loadFpWeekPtsIfStale).toHaveBeenCalledTimes(10)
    expect(store.loadFpWeekPtsIfStale).toHaveBeenCalledWith({ pos: 'DEF', scoring: 'half' })
  })
  it('schluckt Ladefehler einzelner Quellen', async () => {
    store.loadSleeperWeekIfStale.mockRejectedValueOnce(new Error('offline'))
    await expect(loadWeekProjections({ season: '2026', week: 1, scoringTypes: ['ppr'] })).resolves.toBeUndefined()
  })
  it('merged die FP-Punkte aller Positionen fuer ein Scoring', () => {
    const map = fpPtsMapFor('half_ppr')
    expect(map.size).toBe(5)
    expect(map.get('QB-key')).toBe(5)
  })
})
