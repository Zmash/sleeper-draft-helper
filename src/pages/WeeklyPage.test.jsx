import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const session = {
  sleeperUserId: 'me', seasonYear: '2026', cardNicknames: {},
  availableLeagues: [
    { league_id: 'L1', name: 'Büro-Liga', scoring_settings: { rec: 1 }, roster_positions: ['QB', 'RB', 'WR', 'FLEX', 'BN'] },
    { league_id: 'L2', name: 'Dynasty Bros', scoring_settings: { rec: 0.5 }, roster_positions: ['QB', 'RB', 'WR', 'FLEX', 'BN'] },
  ],
}
const game = (abbr, over = {}) => ({
  id: `g-${abbr}`, state: 'post', period: 4, clock: '0:00',
  home: { abbr, score: 24 }, away: { abbr: 'OPP', score: 17 }, ...over,
})
const L1_DATA = {
  rosters: [{ roster_id: 1, owner_id: 'me' }, { roster_id: 2, owner_id: 'u2' }],
  users: [{ user_id: 'me', display_name: 'Ich' }, { user_id: 'u2', display_name: 'Kevin' }],
  matchups: [
    {
      // Reihenfolge = Startslots ['QB','RB','WR','FLEX']; die '0' ist der leer
      // gelassene FLEX. Positionen passen zu ihren Slots, sonst prueft der Test
      // eine Aufstellung, die Sleeper so nie zulassen wuerde.
      roster_id: 1, matchup_id: 1, points: 61.9,
      starters: ['P1', 'P4', 'P2', '0'],
      players: ['P1', 'P4', 'P2', 'P3'],
      players_points: { P1: 28.4, P2: 0, P4: 12.1, P3: 21.4 },
    },
    { roster_id: 2, matchup_id: 1, points: 48.3, starters: ['P5'], players: ['P5'], players_points: { P5: 30 } },
  ],
  error: null,
}
const PROJ = { P1: 18, P2: 11, P3: 9, P4: 12, P5: 14 }

let wk
vi.mock('../stores/useSessionStore', () => ({ useSessionStore: () => session }))
vi.mock('../stores/useWeeklyStore', () => ({ useWeeklyStore: () => wk }))
vi.mock('../stores/useWeeklyRankingsStore', () => {
  const state = { getSleeperWeekMap: () => new Map(), fpWeekPtsByScoring: new Map(), sleeperWeekByKey: new Map() }
  const hook = (sel) => (sel ? sel(state) : state)
  hook.getState = () => state
  return { useWeeklyRankingsStore: hook }
})
vi.mock('../services/weekProjections', () => ({
  detectScoringType: () => 'ppr', loadWeekProjections: vi.fn(() => Promise.resolve()), fpPtsMapFor: () => new Map(),
}))
// Nur die Projektionsquelle ersetzen -- isRuledOut wird vom weeklyModel
// gebraucht und soll echt bleiben.
vi.mock('../services/analysis/matchupProjection', async (importOriginal) => ({
  ...(await importOriginal()),
  blendedPlayerProjection: ({ playerId }) => PROJ[playerId] ?? null,
}))
vi.mock('../services/redzone/espnLive', () => ({ fetchScoreboard: vi.fn(), lastKickoffAt: () => null }))

import WeeklyPage from './WeeklyPage'

beforeEach(() => {
  wk = {
    deselectedLeagueIds: [], week: 3, currentWeek: 3,
    gamesByWeek: { 3: [game('CIN'), game('GB'), game('ATL')] },
    leagueDataByWeek: { 3: { L1: L1_DATA } },
    playersMeta: {
      P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB', fantasy_positions: ['QB'] },
      P2: { player_id: 'P2', full_name: 'Jayden Reed', team: 'GB', position: 'WR', fantasy_positions: ['WR'], injury_status: 'Out' },
      P3: { player_id: 'P3', full_name: 'Bank Held', team: 'ATL', position: 'RB', fantasy_positions: ['RB'] },
      P4: { player_id: 'P4', full_name: 'Rico Dowdle', team: 'ATL', position: 'RB', fantasy_positions: ['RB'] },
      P5: { player_id: 'P5', full_name: 'Gegner Star', team: 'CIN', position: 'WR', fantasy_positions: ['WR'] },
    },
    lastUpdated: Date.now(), loading: false, error: null,
    load: vi.fn(() => Promise.resolve()), setWeek: vi.fn(), toggleLeague: vi.fn(), soloLeague: vi.fn(),
  }
})

describe('WeeklyPage', () => {
  it('laedt beim Oeffnen mit Ligen, Saison und User', () => {
    render(<WeeklyPage />)
    expect(wk.load).toHaveBeenCalledWith({ leagues: session.availableLeagues, season: '2026', myUserId: 'me', force: false })
  })

  it('zeigt Ergebnis, Wochenbilanz und Liga-Chips', () => {
    render(<WeeklyPage />)
    expect(screen.getByRole('button', { name: /Dynasty Bros/ })).toBeInTheDocument()
    expect(screen.getByText('Sieg')).toBeInTheDocument()
    // Einmal in der Ergebniskachel, einmal in "Woche in Zahlen".
    expect(screen.getAllByText('61.9')).toHaveLength(2)
    expect(screen.getByText('gegen Kevin')).toBeInTheDocument()
    expect(screen.getByText('1–0')).toBeInTheDocument()
  })

  it('listet Ausreisser, Verletzungen und den Bankverlust', () => {
    render(<WeeklyPage />)
    // P1 28.4 statt 18 -> Ueberperformer; P2 0 statt 11 -> Unterperformer und Ausfall.
    // Je einmal bei den Ausreissern und in der Positionsbilanz.
    expect(screen.getAllByText('+10.4')).toHaveLength(2)
    expect(screen.getAllByText('−11.0')).toHaveLength(2)
    expect(screen.getByText('Out')).toBeInTheDocument()
    expect(screen.getByText('Aufgestellt und ausgefallen')).toBeInTheDocument()
    // Bank Held (RB, 21.4) haette den RB-Slot von Rico Dowdle (RB, 12.1)
    // uebernommen -- gepaart wird ueber den Slot, nie ueber den Punkte-Rang.
    expect(screen.getByText('Bank Held 21.4')).toBeInTheDocument()
    expect(screen.getByText('Rico Dowdle 12.1')).toBeInTheDocument()
    // Der Slot steht als eigene Marke an der Zeile.
    expect(document.querySelector('.wk-bench-slot')).toHaveTextContent('RB')
  })

  it('erzwingt beim Aktualisieren ein Neuladen', () => {
    render(<WeeklyPage />)
    fireEvent.click(screen.getByRole('button', { name: /Aktualisieren/ }))
    expect(wk.load).toHaveBeenLastCalledWith({ leagues: session.availableLeagues, season: '2026', myUserId: 'me', force: true })
  })

  it('wechselt die Woche ueber den Waehler', () => {
    render(<WeeklyPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Woche zurück' }))
    expect(wk.setWeek).toHaveBeenCalledWith(2)
  })

  it('weist bei abgeschlossenen Wochen auf die Projektionsquelle hin', () => {
    wk.week = 2
    wk.leagueDataByWeek = { 2: { L1: L1_DATA } }
    wk.gamesByWeek = { 2: [game('CIN'), game('GB'), game('ATL')] }
    render(<WeeklyPage />)
    expect(screen.getByText(/Sleepers Wochenprojektion für Week 2/)).toBeInTheDocument()
    expect(screen.queryByText('laufende Woche')).not.toBeInTheDocument()
  })

  it('verlangt zuerst ein Setup ohne Ligen', () => {
    const saved = session.availableLeagues
    session.availableLeagues = []
    render(<WeeklyPage />)
    expect(screen.getByText(/Lade zuerst deine Ligen/)).toBeInTheDocument()
    session.availableLeagues = saved
  })
})
