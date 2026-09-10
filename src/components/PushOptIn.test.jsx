import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../services/pushClient', () => ({
  getPushState: vi.fn(async () => 'unsubscribed'),
  subscribePush: vi.fn(async () => true),
  unsubscribePush: vi.fn(async () => true),
}))
vi.mock('../stores/useSessionStore', () => ({ useSessionStore: () => ({ sleeperUsername: 'Zmash' }) }))

import PushOptIn from './PushOptIn'
import { subscribePush } from '../services/pushClient'

beforeEach(() => { vi.clearAllMocks() })

describe('PushOptIn', () => {
  it('zeigt Anmelde-Button wenn nicht angemeldet', async () => {
    const { container } = render(<PushOptIn />)
    await waitFor(() => expect(container.querySelector('button').textContent).toMatch(/Benachrichtigungen/i))
  })

  it('meldet mit Sleeper-Username an', async () => {
    const { container } = render(<PushOptIn />)
    await waitFor(() => expect(container.querySelector('button')).toBeTruthy())
    fireEvent.click(container.querySelector('button'))
    await waitFor(() => expect(subscribePush).toHaveBeenCalledWith('Zmash'))
  })
})
