import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTrendingPlayers } from './useTrendingPlayers'
import { fetchTrendingPlayers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'

vi.mock('../services/api', () => ({ fetchTrendingPlayers: vi.fn() }))
vi.mock('../services/playersMeta', () => ({ loadPlayersMetaCached: vi.fn() }))

const meta = {
  '100': { player_id: '100', full_name: 'Puka Nacua', team: 'LAR', fantasy_positions: ['WR'], injury_status: null },
  '200': { player_id: '200', full_name: 'Zay Flowers', team: 'BAL', fantasy_positions: ['WR'], injury_status: 'Questionable' },
}

describe('useTrendingPlayers', () => {
  it('merged Adds/Drops mit Name/Team/Position/Verletzung aus dem Spieler-Cache', async () => {
    fetchTrendingPlayers.mockImplementation((type) =>
      Promise.resolve(type === 'add' ? [{ player_id: '100', count: 4200 }] : [{ player_id: '200', count: 900 }]))
    loadPlayersMetaCached.mockResolvedValue(meta)

    const { result } = renderHook(() => useTrendingPlayers())

    await waitFor(() => expect(result.current.state).toBe('ok'))
    expect(result.current.adds).toEqual([
      { player_id: '100', count: 4200, name: 'Puka Nacua', team: 'LAR', pos: 'WR', injury_status: null },
    ])
    expect(result.current.drops).toEqual([
      { player_id: '200', count: 900, name: 'Zay Flowers', team: 'BAL', pos: 'WR', injury_status: 'Questionable' },
    ])
  })

  it('ueberspringt Eintraege ohne Treffer im Spieler-Cache statt leer zu rendern', async () => {
    fetchTrendingPlayers.mockImplementation((type) =>
      Promise.resolve(type === 'add' ? [{ player_id: 'unknown', count: 10 }] : []))
    loadPlayersMetaCached.mockResolvedValue(meta)

    const { result } = renderHook(() => useTrendingPlayers())

    await waitFor(() => expect(result.current.state).toBe('ok'))
    expect(result.current.adds).toEqual([])
  })

  it('setzt state auf error, wenn der Fetch fehlschlaegt', async () => {
    fetchTrendingPlayers.mockRejectedValue(new Error('HTTP 500'))
    loadPlayersMetaCached.mockResolvedValue({})

    const { result } = renderHook(() => useTrendingPlayers())

    await waitFor(() => expect(result.current.state).toBe('error'))
    expect(result.current.adds).toEqual([])
    expect(result.current.drops).toEqual([])
  })
})
