import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  fetchNflState: vi.fn(), fetchMatchups: vi.fn(), fetchLeagueRosters: vi.fn(), fetchLeagueUsers: vi.fn(),
}))
vi.mock('../services/playersMeta', () => ({ loadPlayersMetaCached: vi.fn() }))
// lastKickoffAt bleibt echt: der Store entscheidet damit, ob playersMeta
// (Game-Day-Inactives) neu geholt werden muss.
vi.mock('../services/redzone/espnLive', async (importOriginal) => ({
  ...(await importOriginal()), fetchScoreboard: vi.fn(), fetchScoringPlays: vi.fn(),
}))

import { fetchNflState, fetchMatchups, fetchLeagueRosters, fetchLeagueUsers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchScoreboard, fetchScoringPlays } from '../services/redzone/espnLive'
import { useRedzoneStore } from './useRedzoneStore'

const INITIAL = useRedzoneStore.getState()
const LEAGUES = [{ league_id: 'L1', name: 'Büro-Liga' }, { league_id: 'L2', name: 'Dynasty Bros' }]
const META = { P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB' } }
const board = (cinScore) => [
  { id: 'g1', state: 'in', home: { id: '4', abbr: 'CIN', score: cinScore }, away: { id: '27', abbr: 'TB', score: 3 }, possessionAbbr: 'CIN', isRedZone: false },
  { id: 'g2', state: 'pre', home: { id: '9', abbr: 'GB', score: 0 }, away: { id: '16', abbr: 'MIN', score: 0 }, possessionAbbr: null, isRedZone: false },
  { id: 'g3', state: 'in', home: { id: '12', abbr: 'KC', score: 7 }, away: { id: '7', abbr: 'DEN', score: 0 }, possessionAbbr: null, isRedZone: false },
]
const args = { leagues: LEAGUES, season: '2026', myUserId: 'me' }

beforeEach(() => {
  vi.clearAllMocks()
  useRedzoneStore.setState({ ...INITIAL, deselectedLeagueIds: [] }, true)
  fetchNflState.mockResolvedValue({ week: 1 })
  loadPlayersMetaCached.mockResolvedValue(META)
  fetchLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: 'me' }])
  fetchLeagueUsers.mockResolvedValue([])
  fetchMatchups.mockResolvedValue([{ roster_id: 1, matchup_id: 1, points: 10, starters: ['P1'], players_points: { P1: 10 } }])
  fetchScoreboard.mockResolvedValue(board(14))
  fetchScoringPlays.mockResolvedValue([{ id: 'a', text: 'Joe Burrow 1 Yd Rush', teamAbbr: 'CIN', period: 1, clockValue: 100 }])
})

describe('useRedzoneStore.poll', () => {
  it('laedt nur aktive Ligen und fuellt Spiele + Ligadaten', async () => {
    useRedzoneStore.getState().toggleLeague(['L1', 'L2'], 'L2')
    await useRedzoneStore.getState().poll(args)
    expect(fetchMatchups).toHaveBeenCalledTimes(1)
    expect(fetchMatchups).toHaveBeenCalledWith('L1', 1)
    const s = useRedzoneStore.getState()
    expect(s.games).toHaveLength(3)
    expect(s.leagueData.L1.error).toBeNull()
    expect(s.lastUpdated).toEqual(expect.any(Number))
  })

  it('holt Rosters/Users nur beim ersten Poll', async () => {
    await useRedzoneStore.getState().poll(args)
    await useRedzoneStore.getState().poll(args)
    expect(fetchLeagueRosters).toHaveBeenCalledTimes(2) // je Liga einmal
    expect(fetchMatchups).toHaveBeenCalledTimes(4)
  })

  it('laedt Scoring-Plays nur fuer relevante Spiele und nur bei geaendertem Stand', async () => {
    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(1)
    expect(fetchScoringPlays).toHaveBeenCalledWith('g1')
    expect(useRedzoneStore.getState().newPlayIds).toEqual([]) // erster Abruf markiert nichts

    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(1)

    fetchScoreboard.mockResolvedValue(board(21))
    fetchScoringPlays.mockResolvedValue([
      { id: 'a', text: 'Joe Burrow 1 Yd Rush', teamAbbr: 'CIN', period: 1, clockValue: 100 },
      { id: 'b', text: 'Joe Burrow 5 Yd Rush', teamAbbr: 'CIN', period: 2, clockValue: 300 },
    ])
    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(2)
    expect(useRedzoneStore.getState().newPlayIds).toEqual(['b'])
  })

  it('versucht einen fehlgeschlagenen Summary-Abruf beim naechsten Poll erneut', async () => {
    fetchScoringPlays.mockRejectedValueOnce(new Error('HTTP 500'))
    await useRedzoneStore.getState().poll(args)
    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(2)
  })

  it('behaelt bei ESPN-Ausfall die letzten Spiele und meldet den Fehler', async () => {
    await useRedzoneStore.getState().poll(args)
    fetchScoreboard.mockRejectedValue(new Error('HTTP 502'))
    await useRedzoneStore.getState().poll(args)
    const s = useRedzoneStore.getState()
    expect(s.games).toHaveLength(3)
    expect(s.espnError).toBe('ESPN-Daten gerade nicht verfügbar')
  })

  it('markiert eine Liga mit Fehler, ohne die anderen zu stoeren', async () => {
    fetchMatchups.mockImplementation((id) => (id === 'L2' ? Promise.reject(new Error('HTTP 500')) : Promise.resolve([])))
    await useRedzoneStore.getState().poll(args)
    const s = useRedzoneStore.getState()
    expect(s.leagueData.L2.error).toBe('HTTP 500')
    expect(s.leagueData.L1.error).toBeNull()
  })
})

describe('Filter-Persistenz', () => {
  it('speichert nur die abgewaehlten Liga-IDs', () => {
    useRedzoneStore.getState().soloLeague(['L1', 'L2'], 'L1')
    const persisted = useRedzoneStore.persist.getOptions().partialize(useRedzoneStore.getState())
    expect(persisted).toEqual({ deselectedLeagueIds: ['L2'] })
  })
})
