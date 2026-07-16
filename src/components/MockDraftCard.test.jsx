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
const setBoardPlayers = vi.fn()

vi.mock('../stores/useSessionStore', () => ({
  useSessionStore: () => ({ attachDraftByIdOrUrl: attach, setSelectedDraftId }),
}))
vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: { getState: () => ({ setBoardPlayers }) },
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
})
