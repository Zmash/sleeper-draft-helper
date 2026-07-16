import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportResultBanner from './ImportResultBanner'

const stats = { total: 207, withAdp: 195, withoutAdp: 12, unmatchedNames: ['A B', 'C D'] }

describe('ImportResultBanner', () => {
  it('nennt Gesamtzahl, ADP-Treffer und Fehlschlaege', () => {
    render(<ImportResultBanner stats={stats} method="FantasyCalc + FFC" />)
    expect(screen.getByText(/207 Spieler/)).toBeTruthy()
    expect(screen.getByText(/195 mit ADP/)).toBeTruthy()
    expect(screen.getByText(/12 ohne Marktdaten/)).toBeTruthy()
  })

  it('zeigt die nicht gematchten Namen auf Klick — nicht stillschweigen', async () => {
    render(<ImportResultBanner stats={stats} method="x" />)
    await userEvent.click(screen.getByRole('button', { name: /anzeigen/i }))
    expect(screen.getByText(/A B/)).toBeTruthy()
    expect(screen.getByText(/C D/)).toBeTruthy()
  })

  it('Undo nur wenn moeglich', () => {
    const { rerender } = render(<ImportResultBanner stats={stats} method="x" onUndo={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Rückgängig/ })).toBeTruthy()
    rerender(<ImportResultBanner stats={stats} method="x" />)
    expect(screen.queryByRole('button', { name: /Rückgängig/ })).toBeNull()
  })

  it('Undo ruft den Handler', async () => {
    const onUndo = vi.fn()
    render(<ImportResultBanner stats={stats} method="x" onUndo={onUndo} />)
    await userEvent.click(screen.getByRole('button', { name: /Rückgängig/ }))
    expect(onUndo).toHaveBeenCalled()
  })

  it('fehlender Markt wird benannt', () => {
    render(<ImportResultBanner stats={{ ...stats, withAdp: 0, withoutAdp: 207 }} method="FantasyCalc" marketMissing />)
    expect(screen.getByText(/Marktdaten nicht erreichbar/)).toBeTruthy()
  })

  it('ohne Fehlschlaege kein anzeigen-Button', () => {
    render(<ImportResultBanner stats={{ total: 5, withAdp: 5, withoutAdp: 0, unmatchedNames: [] }} method="x" />)
    expect(screen.queryByRole('button', { name: /anzeigen/i })).toBeNull()
  })
})
