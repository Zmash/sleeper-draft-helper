import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CostHint } from './CostHint'

describe('CostHint', () => {
  it('zeigt standardmaessig nur das Info-Symbol, keine Kosten-Zahlen', () => {
    render(<CostHint text="≈ 9,2k Tokens · ~0,03 $" />)
    expect(screen.queryByText(/9,2k/)).toBeNull()
    expect(screen.getByRole('button', { name: /Kosten anzeigen/i })).toBeTruthy()
  })

  it('zeigt die Zahlen nach Klick auf den Toggle', async () => {
    render(<CostHint text="≈ 9,2k Tokens · ~0,03 $" />)
    await userEvent.click(screen.getByRole('button', { name: /Kosten anzeigen/i }))
    expect(screen.getByText(/9,2k/)).toBeTruthy()
  })

  it('blendet die Zahlen nach dem zweiten Klick wieder aus', async () => {
    render(<CostHint text="≈ 9,2k Tokens · ~0,03 $" />)
    const toggle = screen.getByRole('button', { name: /Kosten anzeigen/i })
    await userEvent.click(toggle)
    expect(screen.getByText(/9,2k/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /Kosten ausblenden/i }))
    expect(screen.queryByText(/9,2k/)).toBeNull()
  })

  it('rendert nichts, wenn text leer/falsy ist', () => {
    const { container } = render(<CostHint text="" />)
    expect(container.querySelector('button')).toBeNull()
    expect(container.firstChild).toBeNull()
  })

  it('stellt den prefix dem Text voran, wenn geoeffnet', async () => {
    render(<CostHint text="9,2k in" prefix="Verbraucht: " />)
    await userEvent.click(screen.getByRole('button', { name: /Kosten anzeigen/i }))
    expect(screen.getByText(/Verbraucht: 9,2k in/)).toBeTruthy()
  })
})
