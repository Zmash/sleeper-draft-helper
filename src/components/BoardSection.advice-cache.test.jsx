import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// AI-Advice cacht die Antwort: schliesst man den Dialog und klickt direkt wieder
// auf AI-Advice, ohne dass sich am Board etwas geaendert hat, wird die
// vorhandene Antwort erneut gezeigt statt eines neuen (kostenpflichtigen) Calls.
// Ein neuer Call laeuft nur bei geaendertem Board oder per "Neu berechnen".

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: () => ({ marketMeta: null, boardSource: 'csv', refreshMarketData: vi.fn() }),
}))

vi.mock('./BoardTable', () => ({ default: () => <div data-testid="board-table" /> }))
vi.mock('./ApiKeyDialog', () => ({ default: () => null }))
vi.mock('./AdviceDialog', () => ({
  default: (props) =>
    props.open ? (
      <div data-testid="advice-dialog" data-has-advice={String(!!props.advice)} data-loading={String(!!props.loading)}>
        {props.onRecompute && <button onClick={props.onRecompute}>Neu berechnen</button>}
        <button onClick={props.onClose}>close-advice</button>
      </div>
    ) : null,
}))

import BoardSection from './BoardSection'

function sseResultResponse() {
  const body =
    'event: result\ndata: ' +
    JSON.stringify({
      ok: true,
      parsed: {
        primary: { player_nname: 'justin jefferson', why: 'Bester verfuegbarer Spieler' },
        alternatives: [], survival: [], plan_next_picks: [],
      },
      usage: { input_tokens: 100, output_tokens: 50 },
      model: 'claude-sonnet-5',
    }) + '\n\n'
  const bytes = new TextEncoder().encode(body)
  let sent = false
  return {
    ok: true,
    body: { getReader: () => ({ async read() { if (sent) return { done: true }; sent = true; return { done: false, value: bytes } } }) },
  }
}

const P = (over = {}) => ({ rk: 1, name: 'Justin Jefferson', nname: 'justin jefferson', pos: 'WR', team: 'MIN', adp: 16.4, bye: 6, ...over })

function Harness({ boardPlayers, currentPickNumber = 1 }) {
  return (
    <MemoryRouter>
      <BoardSection
        boardPlayers={boardPlayers}
        filteredPlayers={boardPlayers}
        livePicks={[]}
        pickedCount={0}
        totalCount={boardPlayers.length}
        currentPickNumber={currentPickNumber}
        meUserId="u1"
        league={{ league_id: 'l1' }}
        draft={{ draft_id: 'd1', status: 'pre_draft' }}
        draftMode="redraft"
        draftSlot={1}
        tips={null}
      />
    </MemoryRouter>
  )
}

function adviceCalls() {
  return global.fetch.mock.calls.filter((c) => String(c[0]).includes('/api/ai-advice')).length
}

describe('BoardSection — AI-Advice-Cache', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sdh_api_key', 'test-key')
    global.fetch = vi.fn(async () => sseResultResponse())
  })
  afterEach(() => vi.restoreAllMocks())

  it('zeigt bei unveraendertem Board die vorhandene Antwort ohne neuen Call', async () => {
    const board = [P()]
    render(<Harness boardPlayers={board} />)

    fireEvent.click(screen.getByRole('button', { name: /AI-Advice/i }))
    await waitFor(() => expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('true'))
    expect(adviceCalls()).toBe(1)

    // Dialog schliessen und direkt wieder oeffnen — Board unveraendert.
    fireEvent.click(screen.getByRole('button', { name: 'close-advice' }))
    fireEvent.click(screen.getByRole('button', { name: /AI-Advice/i }))

    await waitFor(() => expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('true'))
    expect(adviceCalls()).toBe(1) // KEIN zweiter Call
  })

  it('macht einen neuen Call, wenn sich das Board geaendert hat (Pick)', async () => {
    const board = [P()]
    const { rerender } = render(<Harness boardPlayers={board} />)

    fireEvent.click(screen.getByRole('button', { name: /AI-Advice/i }))
    await waitFor(() => expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('true'))
    expect(adviceCalls()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: 'close-advice' }))
    // Ein Spieler wurde gedraftet → Board-Signatur aendert sich.
    rerender(<Harness boardPlayers={[P({ status: 'drafted', pick_no: 1 })]} currentPickNumber={2} />)
    fireEvent.click(screen.getByRole('button', { name: /AI-Advice/i }))

    await waitFor(() => expect(adviceCalls()).toBe(2))
  })

  it('erzwingt per "Neu berechnen" einen neuen Call trotz Cache', async () => {
    const board = [P()]
    render(<Harness boardPlayers={board} />)

    fireEvent.click(screen.getByRole('button', { name: /AI-Advice/i }))
    await waitFor(() => expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('true'))
    expect(adviceCalls()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Neu berechnen/i }))
    await waitFor(() => expect(adviceCalls()).toBe(2))
  })
})
