import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({ fetchNflSchedule: vi.fn() }))

import { fetchNflSchedule } from '../services/api'
import { useGamesLiveStore } from './useGamesLiveStore'

beforeEach(() => {
  vi.clearAllMocks()
  useGamesLiveStore.setState({ liveCount: 0 })
})

describe('useGamesLiveStore', () => {
  it('zaehlt Spiele mit Status in_game', async () => {
    fetchNflSchedule.mockResolvedValue([
      { status: 'in_game' }, { status: 'pre_game' }, { status: 'in_game' }, { status: 'complete' },
    ])
    await useGamesLiveStore.getState().refresh('2026')
    expect(fetchNflSchedule).toHaveBeenCalledWith('2026')
    expect(useGamesLiveStore.getState().liveCount).toBe(2)
  })
  it('behaelt bei Netzfehler den letzten Stand', async () => {
    useGamesLiveStore.setState({ liveCount: 3 })
    fetchNflSchedule.mockRejectedValue(new Error('HTTP 503'))
    await useGamesLiveStore.getState().refresh('2026')
    expect(useGamesLiveStore.getState().liveCount).toBe(3)
  })
  it('fragt ohne Saison nichts ab', async () => {
    await useGamesLiveStore.getState().refresh('')
    expect(fetchNflSchedule).not.toHaveBeenCalled()
  })
})
