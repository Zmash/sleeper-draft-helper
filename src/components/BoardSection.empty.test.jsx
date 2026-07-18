import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Direkt-Import vom leeren Board: landet man nach einem Mock-Link ohne Rankings
// auf dem Board, soll man von dort importieren koennen — ohne Umweg ueber Setup.

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

const handleAutoImport = vi.fn(async () => ({ ok: true, stats: {}, marketMissing: false }))
const handleKtcRookieImport = vi.fn(async () => true)
const handleCsvLoad = vi.fn(async () => true)
const setCsvRawText = vi.fn()
const setBoardSource = vi.fn()

vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: () => ({
    marketMeta: null,
    boardSource: null,
    refreshMarketData: vi.fn(),
    handleAutoImport,
    handleKtcRookieImport,
    handleCsvLoad,
    setCsvRawText,
    setBoardSource,
  }),
}))

vi.mock('./BoardTable', () => ({ default: () => <div data-testid="board-table" /> }))
vi.mock('./AdviceDialog', () => ({ default: () => null }))
vi.mock('./ApiKeyDialog', () => ({ default: () => null }))

import BoardSection from './BoardSection'

function Harness({ draftMode = 'redraft' }) {
  return (
    <MemoryRouter>
      <BoardSection
        boardPlayers={[]}
        filteredPlayers={[]}
        livePicks={[]}
        pickedCount={0}
        totalCount={0}
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

describe('BoardSection — Direkt-Import vom leeren Board', () => {
  beforeEach(() => {
    localStorage.clear()
    handleAutoImport.mockClear()
    handleKtcRookieImport.mockClear()
    handleCsvLoad.mockClear()
  })
  afterEach(() => vi.restoreAllMocks())

  it('bietet auf dem leeren Board Auto-Import und CSV-Import an', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /Auto-Import/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /CSV-Datei/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Zum Setup/i })).toBeTruthy()
  })

  it('ruft im Redraft-Modus handleAutoImport mit dem abgeleiteten Format auf', async () => {
    render(<Harness draftMode="redraft" />)
    fireEvent.click(screen.getByRole('button', { name: /Auto-Import/i }))
    await waitFor(() => expect(handleAutoImport).toHaveBeenCalledTimes(1))
    const arg = handleAutoImport.mock.calls[0][0]
    expect(arg).toMatchObject({ draftMode: 'redraft' })
    expect(typeof arg.numTeams).toBe('number')
    expect(arg).toHaveProperty('isSuperflex')
    expect(arg).toHaveProperty('effScoringType')
    expect(handleKtcRookieImport).not.toHaveBeenCalled()
  })

  it('nutzt im Rookie-Modus den KTC-Import statt FantasyCalc', async () => {
    render(<Harness draftMode="rookie" />)
    fireEvent.click(screen.getByRole('button', { name: /Rookies auto-importieren/i }))
    await waitFor(() => expect(handleKtcRookieImport).toHaveBeenCalledTimes(1))
    expect(handleAutoImport).not.toHaveBeenCalled()
  })

  it('zeigt eine Fehlermeldung, wenn der Auto-Import scheitert', async () => {
    handleAutoImport.mockResolvedValueOnce({ ok: false, error: 'Rangliste nicht erreichbar' })
    render(<Harness draftMode="redraft" />)
    fireEvent.click(screen.getByRole('button', { name: /Auto-Import/i }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Rangliste nicht erreichbar/))
  })
})
