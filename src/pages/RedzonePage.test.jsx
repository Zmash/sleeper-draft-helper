import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const session = {
  sleeperUserId: 'me', seasonYear: '2026', cardNicknames: {},
  availableLeagues: [
    { league_id: 'L1', name: 'Büro-Liga', scoring_settings: { rec: 1 } },
    { league_id: 'L2', name: 'Dynasty Bros', scoring_settings: { rec: 0.5 } },
  ],
}
const game = (over = {}) => ({
  id: 'g1', state: 'in', period: 2, clock: '6:09', date: '2026-09-13T17:00Z',
  home: { id: '4', abbr: 'CIN', score: 14 }, away: { id: '27', abbr: 'TB', score: 3 },
  possessionAbbr: 'CIN', isRedZone: true, downDistance: '1st & Goal at TB 5', lastPlay: null, ...over,
})
let rz
const L1_DATA = {
  rosters: [{ roster_id: 1, owner_id: 'me' }, { roster_id: 2, owner_id: 'u2' }],
  users: [{ user_id: 'u2', display_name: 'Kevin' }],
  matchups: [
    { roster_id: 1, matchup_id: 1, points: 48.3, starters: ['P1'], players_points: { P1: 14.6 } },
    { roster_id: 2, matchup_id: 1, points: 61.9, starters: ['P3'], players_points: { P3: 9.2 } },
  ],
  error: null,
}

vi.mock('../stores/useSessionStore', () => ({ useSessionStore: () => session }))
vi.mock('../stores/useRedzoneStore', () => ({ useRedzoneStore: () => rz }))
vi.mock('../services/weekProjections', () => ({
  detectScoringType: () => 'ppr', loadWeekProjections: vi.fn(() => Promise.resolve()), fpPtsMapFor: () => new Map(),
}))

import RedzonePage from './RedzonePage'

beforeEach(() => {
  rz = {
    deselectedLeagueIds: [], week: 1, games: [game()], leagueData: { L1: L1_DATA },
    scoringPlaysByEvent: {}, newPlayIds: [], lastUpdated: Date.now(), espnError: null, loading: false,
    playersMeta: {
      P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB' },
      P3: { player_id: 'P3', full_name: 'Mike Gesicki', team: 'CIN', position: 'TE' },
    },
    poll: vi.fn(), toggleLeague: vi.fn(), soloLeague: vi.fn(),
  }
})

describe('RedzonePage', () => {
  it('pollt beim Oeffnen mit Ligen, Saison und User', () => {
    render(<RedzonePage />)
    expect(rz.poll).toHaveBeenCalledWith({ leagues: session.availableLeagues, season: '2026', myUserId: 'me' })
  })

  it('zeigt Chips, Matchup, Redzone-Alarm und Gegner live', () => {
    render(<RedzonePage />)
    expect(screen.getByRole('button', { name: /Dynasty Bros/ })).toBeInTheDocument()
    expect(screen.getByText('48.3')).toBeInTheDocument()
    expect(screen.getByText('1st & Goal at TB 5')).toBeInTheDocument()
    expect(screen.getAllByText('Mike Gesicki').length).toBeGreaterThan(0)
  })

  it('reicht Chip-Klicks mit allen Liga-IDs an den Store weiter', () => {
    render(<RedzonePage />)
    fireEvent.click(screen.getByRole('button', { name: /Dynasty Bros/ }))
    expect(rz.toggleLeague).toHaveBeenCalledWith(['L1', 'L2'], 'L2')
  })

  it('zeigt den naechsten Kickoff, wenn kein Spiel laeuft', () => {
    rz.games = [game({ state: 'pre', isRedZone: false })]
    render(<RedzonePage />)
    expect(screen.getByText(/Gerade läuft kein Spiel\. Nächster Kickoff/)).toBeInTheDocument()
  })

  it('zeigt den ESPN-Fehler statt zu schweigen', () => {
    rz.espnError = 'ESPN-Daten gerade nicht verfügbar'
    render(<RedzonePage />)
    expect(screen.getByText('ESPN-Daten gerade nicht verfügbar')).toBeInTheDocument()
  })
})
