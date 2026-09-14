import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  fetchNflState: vi.fn(), fetchMatchups: vi.fn(), fetchLeagueRosters: vi.fn(), fetchLeagueUsers: vi.fn(),
}))
vi.mock('../services/playersMeta', () => ({ loadPlayersMetaCached: vi.fn() }))
vi.mock('../services/redzone/espnLive', () => ({ fetchScoreboard: vi.fn(), lastKickoffAt: vi.fn(() => null) }))

import { fetchNflState, fetchMatchups, fetchLeagueRosters, fetchLeagueUsers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchScoreboard, lastKickoffAt } from '../services/redzone/espnLive'
import { useWeeklyStore } from './useWeeklyStore'

const INITIAL = useWeeklyStore.getState()
const LEAGUES = [{ league_id: 'L1', name: 'Büro-Liga' }, { league_id: 'L2', name: 'Dynasty Bros' }]
const META = { P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB' } }
const GAMES = [{ id: 'g1', state: 'post', home: { abbr: 'CIN', score: 24 }, away: { abbr: 'TB', score: 17 } }]
const args = { leagues: LEAGUES, season: '2026', myUserId: 'me' }

beforeEach(() => {
  vi.clearAllMocks()
  useWeeklyStore.setState({ ...INITIAL, deselectedLeagueIds: [] }, true)
  fetchNflState.mockResolvedValue({ week: 3 })
  loadPlayersMetaCached.mockResolvedValue(META)
  fetchLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: 'me' }])
  fetchLeagueUsers.mockResolvedValue([{ user_id: 'me', display_name: 'Ich' }])
  fetchMatchups.mockResolvedValue([{ roster_id: 1, matchup_id: 1, points: 10, starters: ['P1'], players: ['P1'], players_points: { P1: 10 } }])
  fetchScoreboard.mockResolvedValue(GAMES)
  lastKickoffAt.mockReturnValue(null)
  loadPlayersMetaCached.mockResolvedValue(META)
})

describe('useWeeklyStore.load', () => {
  it('faellt ohne gesetzte Woche auf die laufende zurueck und legt Daten unter ihr ab', async () => {
    await useWeeklyStore.getState().load(args)
    const s = useWeeklyStore.getState()
    expect(s.currentWeek).toBe(3)
    expect(s.week).toBe(3)
    expect(fetchMatchups).toHaveBeenCalledWith('L1', 3)
    expect(s.gamesByWeek[3]).toEqual(GAMES)
    expect(Object.keys(s.leagueDataByWeek[3])).toEqual(['L1', 'L2'])
    expect(s.playersMeta).toEqual(META)
    expect(s.lastUpdated).toBeGreaterThan(0)
  })

  it('laedt nur aktive Ligen', async () => {
    useWeeklyStore.getState().toggleLeague(['L1', 'L2'], 'L2')
    await useWeeklyStore.getState().load(args)
    expect(fetchMatchups).toHaveBeenCalledTimes(1)
    expect(fetchMatchups).toHaveBeenCalledWith('L1', 3)
  })

  it('holt eine abgeschlossene Woche nur einmal, die laufende jedes Mal', async () => {
    useWeeklyStore.getState().setWeek(2)
    await useWeeklyStore.getState().load(args)
    expect(fetchMatchups).toHaveBeenCalledTimes(2)
    await useWeeklyStore.getState().load(args)
    expect(fetchMatchups).toHaveBeenCalledTimes(2) // aus dem Wochencache

    useWeeklyStore.getState().setWeek(3)
    await useWeeklyStore.getState().load(args)
    await useWeeklyStore.getState().load(args)
    expect(fetchMatchups).toHaveBeenCalledTimes(6) // laufende Woche immer frisch
  })

  it('force umgeht den Wochencache', async () => {
    useWeeklyStore.getState().setWeek(1)
    await useWeeklyStore.getState().load(args)
    await useWeeklyStore.getState().load({ ...args, force: true })
    expect(fetchMatchups).toHaveBeenCalledTimes(4)
  })

  it('holt Rosters und Users nur einmal je Liga', async () => {
    await useWeeklyStore.getState().load(args)
    useWeeklyStore.getState().setWeek(2)
    await useWeeklyStore.getState().load(args)
    expect(fetchLeagueRosters).toHaveBeenCalledTimes(2)
    expect(fetchLeagueUsers).toHaveBeenCalledTimes(2)
    expect(fetchMatchups).toHaveBeenCalledTimes(4)
  })

  it('haelt bei ESPN-Ausfall den letzten Spielstand der Woche und meldet es', async () => {
    await useWeeklyStore.getState().load(args)
    fetchScoreboard.mockRejectedValueOnce(new Error('offline'))
    await useWeeklyStore.getState().load({ ...args, force: true })
    const s = useWeeklyStore.getState()
    expect(s.gamesByWeek[3]).toEqual(GAMES)
    expect(s.error).toMatch(/ESPN/)
  })

  it('merkt sich Ligafehler, ohne die anderen Ligen zu verlieren', async () => {
    fetchMatchups.mockImplementation((id) => (id === 'L2' ? Promise.reject(new Error('HTTP 500')) : Promise.resolve([])))
    await useWeeklyStore.getState().load(args)
    const data = useWeeklyStore.getState().leagueDataByWeek[3]
    expect(data.L1.error).toBeNull()
    expect(data.L2.error).toBe('HTTP 500')
  })

  it('holt playersMeta einmal pro Sitzung und nach dem naechsten Kickoff erneut', async () => {
    await useWeeklyStore.getState().load(args)
    expect(loadPlayersMetaCached).toHaveBeenCalledTimes(1)

    // Gleicher Slate: der Cache im Store reicht.
    await useWeeklyStore.getState().load({ ...args, force: true })
    expect(loadPlayersMetaCached).toHaveBeenCalledTimes(1)

    // Neuer Kickoff nach dem letzten Abruf -> einmal nachladen, damit die
    // Game-Day-Inactives im Verletzungsblock stehen.
    lastKickoffAt.mockReturnValue(Date.now() + 60_000)
    await useWeeklyStore.getState().load({ ...args, force: true })
    expect(loadPlayersMetaCached).toHaveBeenCalledTimes(2)
    expect(loadPlayersMetaCached).toHaveBeenLastCalledWith(
      expect.objectContaining({ season: 2026, staleBefore: expect.any(Number) })
    )
  })

  it('tut nichts ohne Ligen', async () => {
    await useWeeklyStore.getState().load({ ...args, leagues: [] })
    expect(fetchNflState).not.toHaveBeenCalled()
  })
})

describe('useWeeklyStore Filter', () => {
  it('speichert abgewaehlte Ligen und laesst die letzte aktive stehen', () => {
    const all = ['L1', 'L2']
    useWeeklyStore.getState().toggleLeague(all, 'L2')
    expect(useWeeklyStore.getState().deselectedLeagueIds).toEqual(['L2'])
    useWeeklyStore.getState().toggleLeague(all, 'L1')
    expect(useWeeklyStore.getState().deselectedLeagueIds).toEqual(['L2'])
    // Solo auf die einzige noch aktive Liga schaltet wieder alle an.
    useWeeklyStore.getState().soloLeague(all, 'L1')
    expect(useWeeklyStore.getState().deselectedLeagueIds).toEqual([])
    useWeeklyStore.getState().soloLeague(all, 'L2')
    expect(useWeeklyStore.getState().deselectedLeagueIds).toEqual(['L1'])
  })

  it('showAllLeagues schaltet alle Ligen wieder an', () => {
    useWeeklyStore.getState().toggleLeague(['L1', 'L2'], 'L2')
    expect(useWeeklyStore.getState().deselectedLeagueIds).toEqual(['L2'])
    useWeeklyStore.getState().showAllLeagues()
    expect(useWeeklyStore.getState().deselectedLeagueIds).toEqual([])
  })
})
