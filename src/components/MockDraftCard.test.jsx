import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => navigate,
}))

const attach = vi.fn()
const setSelectedDraftId = vi.fn()
const setSelectedLeagueId = vi.fn()
const setDraftViewAs = vi.fn()
const setBoardPlayers = vi.fn()

// Eigener Mock (ich bin Teilnehmer laut draft_order) -- Tests ueberschreiben
// availableDrafts/sleeperUserId einzeln fuer den "Freund-Team waehlen"-Fall.
const sessionState = {
  sleeperUserId: 'me',
  attachDraftByIdOrUrl: attach,
  setSelectedDraftId,
  setSelectedLeagueId,
  setDraftViewAs,
  availableDrafts: [{ draft_id: '12345', draft_order: { me: 1 } }],
}
function useSessionStoreMock() { return sessionState }
useSessionStoreMock.getState = () => sessionState

vi.mock('../stores/useSessionStore', () => ({
  useSessionStore: useSessionStoreMock,
}))
vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: { getState: () => ({ setBoardPlayers }) },
}))
vi.mock('../stores/useLiveStore', () => ({
  useLiveStore: { getState: () => ({ livePicks: [] }) },
}))
vi.mock('../utils/teamLabels', () => ({
  isDraftParticipant: (draft, picks, userId) =>
    !!(draft?.draft_order && Object.prototype.hasOwnProperty.call(draft.draft_order, userId)),
  resolveDraftParticipants: vi.fn(async () => [
    { slot: 1, userId: 'friend-1', label: 'Team Friend' },
    { slot: 2, userId: 'friend-2', label: 'Team Rival' },
  ]),
}))

import MockDraftCard from './MockDraftCard'

const setup = () => render(<MemoryRouter><MockDraftCard /></MemoryRouter>)

beforeEach(() => { vi.clearAllMocks() })

describe('MockDraftCard', () => {
  it('haengt den Draft an, waehlt ihn aus und springt aufs Board', async () => {
    attach.mockResolvedValue('12345')
    setup()
    await userEvent.type(screen.getByRole('textbox'), 'https://sleeper.com/draft/nfl/12345')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/board'))
    expect(attach).toHaveBeenCalled()
    expect(setSelectedDraftId).toHaveBeenCalledWith('12345')
  })

  it('haengt einen per Link angefuegten Mock an keine Liga (Regression B6: Redraft-Mock lief mit Rookie-Logik der stehengebliebenen Dynasty-Liga)', async () => {
    attach.mockResolvedValue('12345')
    setup()
    await userEvent.type(screen.getByRole('textbox'), 'https://sleeper.com/draft/nfl/12345')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/board'))
    expect(setSelectedLeagueId).toHaveBeenCalledWith(null)
  })

  it('fasst das Board nicht an — die gepflegte Rangliste ueberlebt den Mock', async () => {
    attach.mockResolvedValue('12345')
    setup()
    await userEvent.type(screen.getByRole('textbox'), '12345')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(setBoardPlayers).not.toHaveBeenCalled()
  })

  it('ungueltiger Link: Fehler inline mit Loesungsweg, kein alert', async () => {
    attach.mockResolvedValue(null)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    setup()
    await userEvent.type(screen.getByRole('textbox'), 'kaputt')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    expect(await screen.findByText(/Sleeper-Draft/i)).toBeTruthy()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('leere Eingabe tut nichts', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    expect(attach).not.toHaveBeenCalled()
  })

  it('Freundes-Draft (ich bin kein Teilnehmer): zeigt Team-Picker statt sofort zu navigieren, pinnt gewaehltes Team', async () => {
    attach.mockResolvedValue('99999')
    sessionState.availableDrafts = [{ draft_id: '99999', draft_order: { someoneElse: 1 } }]
    setup()
    await userEvent.type(screen.getByRole('textbox'), 'https://sleeper.com/draft/nfl/99999')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    expect(navigate).not.toHaveBeenCalled()
    await screen.findByText(/Welches Team ist deins/i)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'friend-2')
    await userEvent.click(screen.getByRole('button', { name: /Anpinnen/i }))

    expect(setDraftViewAs).toHaveBeenCalledWith('99999', { userId: 'friend-2', label: 'Team Rival' })
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/board'))
  })
})
