import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Draft-Typ-Guard: ist ein Board fuer den falschen Draft-Typ geladen (z. B.
// Redraft-Board waehrend eines Rookie-Drafts), warnt ein Banner statt still das
// unpassende Board weiterzunutzen. Nichts wird automatisch geloescht.

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  boardMode: null,
  handleAutoImport: vi.fn(async () => ({ ok: true })),
  handleKtcRookieImport: vi.fn(async () => true),
  handleCsvLoad: vi.fn(async () => true),
  setCsvRawText: vi.fn(),
  setBoardSource: vi.fn(),
}))

vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: () => ({
    marketMeta: null,
    boardSource: 'market',
    refreshMarketData: vi.fn(),
    boardMode: mocks.boardMode,
    handleAutoImport: mocks.handleAutoImport,
    handleKtcRookieImport: mocks.handleKtcRookieImport,
    handleCsvLoad: mocks.handleCsvLoad,
    setCsvRawText: mocks.setCsvRawText,
    setBoardSource: mocks.setBoardSource,
  }),
}))

vi.mock('./BoardTable', () => ({ default: () => <div data-testid="board-table" /> }))
vi.mock('./AdviceDialog', () => ({ default: () => null }))
vi.mock('./ApiKeyDialog', () => ({ default: () => null }))

import BoardSection from './BoardSection'

const boardPlayers = [
  { rk: 1, name: 'Justin Jefferson', nname: 'justin jefferson', pos: 'WR', team: 'MIN', adp: 16.4, bye: 6 },
]

function Harness({ draftMode = 'redraft' }) {
  return (
    <MemoryRouter>
      <BoardSection
        boardPlayers={boardPlayers}
        filteredPlayers={boardPlayers}
        livePicks={[]}
        pickedCount={0}
        totalCount={1}
        meUserId="u1"
        league={{ league_id: 'l1' }}
        draft={{ draft_id: 'd1', status: 'pre_draft' }}
        draftMode={draftMode}
        draftSlot={1}
        tips={null}
      />
    </MemoryRouter>
  )
}

describe('BoardSection — Draft-Typ-Guard-Banner', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sdh_api_key', 'test-key')
    mocks.boardMode = null
    mocks.handleAutoImport.mockClear()
    mocks.handleKtcRookieImport.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('warnt, wenn ein Redraft-Board in einem Rookie-Draft geladen ist', () => {
    mocks.boardMode = 'redraft'
    render(<Harness draftMode="rookie" />)
    expect(screen.getByRole('alert').textContent).toMatch(/Redraft/)
    expect(screen.getByRole('button', { name: /Rookie-Rankings importieren/i })).toBeTruthy()
  })

  it('zeigt KEIN Banner, wenn Board-Typ und Draft-Typ passen', () => {
    mocks.boardMode = 'rookie'
    render(<Harness draftMode="rookie" />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('zeigt KEIN Banner fuer alte Boards ohne Typmarkierung (boardMode null)', () => {
    mocks.boardMode = null
    render(<Harness draftMode="rookie" />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('importiert per Klick die passenden Rankings mit force (Rookie → KTC)', async () => {
    mocks.boardMode = 'redraft'
    render(<Harness draftMode="rookie" />)
    fireEvent.click(screen.getByRole('button', { name: /Rookie-Rankings importieren/i }))
    await waitFor(() => expect(mocks.handleKtcRookieImport).toHaveBeenCalledTimes(1))
    expect(mocks.handleKtcRookieImport).toHaveBeenCalledWith(true)
    expect(mocks.handleAutoImport).not.toHaveBeenCalled()
  })

  it('importiert per Klick die passenden Rankings mit force (Redraft → FantasyCalc)', async () => {
    mocks.boardMode = 'rookie'
    render(<Harness draftMode="redraft" />)
    fireEvent.click(screen.getByRole('button', { name: /Redraft-Rankings importieren/i }))
    await waitFor(() => expect(mocks.handleAutoImport).toHaveBeenCalledTimes(1))
    expect(mocks.handleAutoImport.mock.calls[0][0]).toMatchObject({ draftMode: 'redraft', force: true })
    expect(mocks.handleKtcRookieImport).not.toHaveBeenCalled()
  })

  it('„Trotzdem behalten" blendet das Banner aus', () => {
    mocks.boardMode = 'redraft'
    render(<Harness draftMode="rookie" />)
    fireEvent.click(screen.getByRole('button', { name: /Trotzdem behalten/i }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
