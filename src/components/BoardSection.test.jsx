import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Regression: Advice-State (advice/adviceWarnings/adviceUsage/adviceModel)
// ueberlebte bisher einen Draft-Wechsel. aiHighlights markierte danach weiter
// die Spieler des ALTEN Drafts auf dem frisch geleerten Board, bis der Nutzer
// neu abfragt. App.jsx resettet reviewResult/livePicks/Board-Status bei
// Draft-Wechsel bereits (prevDraftIdRef-Muster in App.jsx) -- BoardSection
// braucht denselben Reset fuer Advice.

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: () => ({ marketMeta: null, boardSource: 'csv', refreshMarketData: vi.fn() }),
}))

// BoardTable und AdviceDialog sind komplex und fuer diesen Test irrelevant --
// per Mock auf ihre Props reduzieren, damit der Test nur den Advice-Reset prueft.
vi.mock('./BoardTable', () => ({
  default: (props) => (
    <div
      data-testid="board-table"
      data-primary={props.primaryNname || ''}
      data-highlighted={JSON.stringify(props.highlightedNnames || [])}
    />
  ),
}))

vi.mock('./AdviceDialog', () => ({
  default: (props) => (
    <div
      data-testid="advice-dialog"
      data-has-advice={String(!!props.advice)}
      data-model={props.model || ''}
      data-usage={String(!!props.usage)}
    />
  ),
}))

vi.mock('./ApiKeyDialog', () => ({ default: () => null }))

import BoardSection from './BoardSection'

const boardPlayers = [
  { rk: 1, name: 'Justin Jefferson', nname: 'justin jefferson', pos: 'WR', team: 'MIN', adp: 16.4, bye: 6 },
]

function sseResultResponse() {
  const body =
    'event: result\ndata: ' +
    JSON.stringify({
      ok: true,
      parsed: {
        primary: { player_nname: 'justin jefferson', why: 'Bester verfuegbarer Spieler' },
        alternatives: [],
        survival: [],
        plan_next_picks: [],
      },
      usage: { input_tokens: 100, output_tokens: 50 },
      model: 'claude-sonnet-5',
    }) +
    '\n\n'
  const bytes = new TextEncoder().encode(body)
  let sent = false
  return {
    ok: true,
    body: {
      getReader: () => ({
        async read() {
          if (sent) return { done: true, value: undefined }
          sent = true
          return { done: false, value: bytes }
        },
      }),
    },
  }
}

function Harness({ draft }) {
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
        draft={draft}
        draftMode="redraft"
        draftSlot={1}
        tips={null}
      />
    </MemoryRouter>
  )
}

describe('BoardSection — Advice-Reset bei Draft-Wechsel', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('sdh_api_key', 'test-key')
    global.fetch = vi.fn(async () => sseResultResponse())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('setzt Advice zurueck, wenn draft_id wechselt, statt Spieler des alten Drafts weiter zu markieren', async () => {
    const draftA = { draft_id: 'd1', status: 'pre_draft' }
    const draftB = { draft_id: 'd2', status: 'pre_draft' }

    const { rerender } = render(<Harness draft={draftA} />)

    fireEvent.click(screen.getByRole('button', { name: /AI-Advice/i }))

    await waitFor(() => {
      expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('true')
    })
    expect(screen.getByTestId('board-table').dataset.primary).toBe('justin jefferson')

    // Draft-Wechsel: gleiche Komponente, neue draft_id (wie in BoardPage/App.jsx,
    // die Route bleibt /board, BoardSection wird nicht neu gemountet).
    rerender(<Harness draft={draftB} />)

    await waitFor(() => {
      expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('false')
    })
    expect(screen.getByTestId('advice-dialog').dataset.model).toBe('')
    expect(screen.getByTestId('advice-dialog').dataset.usage).toBe('false')
    expect(screen.getByTestId('board-table').dataset.primary).toBe('')
  })

  it('feuert NICHT bei einem Re-Render mit derselben draft_id (kein Advice-Verlust waehrend eines laufenden Calls)', async () => {
    const draftA = { draft_id: 'd1', status: 'pre_draft' }

    const { rerender } = render(<Harness draft={draftA} />)
    fireEvent.click(screen.getByRole('button', { name: /AI-Advice/i }))

    await waitFor(() => {
      expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('true')
    })

    // Neues Objekt, aber dieselbe draft_id -- z.B. nach einem Pick-Poll-Refresh.
    rerender(<Harness draft={{ ...draftA }} />)

    expect(screen.getByTestId('advice-dialog').dataset.hasAdvice).toBe('true')
    expect(screen.getByTestId('board-table').dataset.primary).toBe('justin jefferson')
  })
})
