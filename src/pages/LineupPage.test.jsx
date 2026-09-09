import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('../services/api', () => ({
  fetchNflState: () => Promise.resolve({ week: 1 }),
  fetchMatchups: () => Promise.resolve([]),
}))
vi.mock('../services/playersMeta', () => ({
  loadPlayersMetaCached: () => Promise.resolve({}),
}))
vi.mock('../hooks/useTrendingPlayers', () => ({
  useTrendingPlayers: () => ({ adds: [] }),
}))

const dynastyRoster = [
  { sleeper_id: '1', name: 'Qb One', nname: 'qbone', pos: 'QB', team: 'BAL', bye: '', injury_status: null },
  { sleeper_id: '2', name: 'Rb One', nname: 'rbone', pos: 'RB', team: 'DET', bye: '', injury_status: null },
]
const rankMaps = {
  'QB:week': new Map([['NAME:qbone', 5]]),
  'RB:week': new Map([['NAME:rbone', 12]]),
}
const sleeperWeekById = new Map([
  ['1', { pts_ppr: 20.5, pts_half_ppr: 19.5, pts_std: 18.5 }],
  ['2', { pts_ppr: 12.3, pts_half_ppr: 11.0, pts_std: 10.0 }],
])

vi.mock('../stores/useSessionStore', () => ({ useSessionStore: () => ({ sleeperUserId: 'u1' }) }))
vi.mock('../stores/useDynastyStore', () => ({
  useDynastyStore: () => ({ leagueRosters: [], mySleeperRosterId: 1, dynastyRoster }),
}))
vi.mock('../stores/useDynastyValuesStore', () => ({
  useDynastyValuesStore: () => ({
    dynastyValues: [{ nname: 'qbone', value: 8000 }, { nname: 'rbone', value: 5000 }],
    loadDynastyValuesIfStale: vi.fn(),
  }),
}))
const loadIfStale = vi.fn()
const loadSleeperWeekIfStale = vi.fn()
vi.mock('../stores/useWeeklyRankingsStore', () => ({
  useWeeklyRankingsStore: () => ({
    byKey: new Map(),
    sleeperWeekById,
    loadIfStale,
    loadSleeperWeekIfStale,
    getRankMap: ({ pos, scope }) => rankMaps[`${pos}:${scope}`] || new Map(),
  }),
}))
vi.mock('../stores/useUIStore', () => ({
  useUIStore: () => ({ streamPositions: [], toggleStreamPosition: vi.fn() }),
}))

import LineupPage from './LineupPage'

const props = {
  selectedLeague: { league_id: 'l1', roster_positions: ['QB', 'RB', 'BN', 'BN'] },
  effRoster: ['QB', 'RB', 'BN', 'BN'],
  draftMode: 'rookie',
  effScoringType: 'ppr',
  seasonYear: '2026',
}

beforeEach(() => { vi.clearAllMocks() })

describe('LineupPage im Dynasty-Modus', () => {
  it('zeigt die Pkt-Spalte neben KTC in der Lineup-Karte', async () => {
    // KTC-Spalte beweist: Karte ist mit Dynasty-Werten gerendert. Die
    // Pkt-Spalte (Modifier-Klasse) fehlt im Dynasty-Modus noch -- Bug.
    const { container } = render(<LineupPage {...props} />)
    await waitFor(() => expect(container.querySelector('.an-card--lineup')).toBeTruthy())
    expect(container.querySelector('.an-card--lineup').textContent).toContain('KTC')
    await waitFor(() => expect(container.querySelector('.an-card--lineup--pts')).toBeTruthy())
  })

  it('laedt die Sleeper-Wochenprojektion auch im Dynasty-Modus', async () => {
    render(<LineupPage {...props} />)
    await waitFor(() => expect(loadSleeperWeekIfStale).toHaveBeenCalledWith({ season: '2026', week: 1 }))
  })
})
