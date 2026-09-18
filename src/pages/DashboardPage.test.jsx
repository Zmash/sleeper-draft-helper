import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useGamesLiveStore } from '../stores/useGamesLiveStore'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

const sessionState = {
  sleeperUserId: '344032843661434880',
  seasonYear: '2026',
  availableLeagues: [],
  availableDrafts: [],
  attachDraftByIdOrUrl: vi.fn(),
  setSelectedDraftId: vi.fn(),
  setSelectedLeagueId: vi.fn(),
  refreshLeagues: vi.fn(),
}
const dashboardState = {
  nflState: null,
  cards: [],
  loading: false,
  lastRefreshed: null,
  loadDashboard: vi.fn(),
}

vi.mock('../stores/useSessionStore', () => ({ useSessionStore: () => sessionState }))
vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: Object.assign(() => ({ draftMode: 'redraft' }), {
    getState: () => ({ setBoardPlayers: vi.fn() }),
  }),
}))
vi.mock('../stores/useDashboardStore', () => ({ useDashboardStore: () => dashboardState }))

import DashboardPage from './DashboardPage'

const setup = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>)

beforeEach(() => { vi.clearAllMocks() })

describe('DashboardPage — Empty-State ohne Ligen', () => {
  it('zeigt den Mock-Einstieg auch dann, wenn keine Ligen geladen sind', () => {
    // Regression: der Empty-State kehrte frueh zurueck, bevor die MockDraftCard
    // gerendert wurde. Wer keine Liga hat, kam an den Mock — die Vordertuer des
    // Mock-lastigen Workflows — ueberhaupt nicht heran.
    setup()
    expect(screen.getByText(/Keine Ligen geladen/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Starten/i })).toBeTruthy()
  })

  it('bietet weiterhin den Weg ins Setup an', () => {
    setup()
    expect(screen.getByRole('button', { name: /Setup öffnen/i })).toBeTruthy()
  })
})

describe('Redzone-Banner', () => {
  afterEach(() => {
    useGamesLiveStore.setState({ liveCount: 0 })
    sessionState.availableLeagues = []
  })

  it('erscheint nur, solange NFL-Spiele laufen', () => {
    sessionState.availableLeagues = [{ league_id: 'L1', name: 'Büro-Liga' }]
    const { unmount } = setup()
    expect(screen.queryByText(/Redzone öffnen/)).not.toBeInTheDocument()
    unmount()

    useGamesLiveStore.setState({ liveCount: 3 })
    setup()
    expect(screen.getByRole('button', { name: /3 Spiele laufen/ })).toBeInTheDocument()
  })
})
