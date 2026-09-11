import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SeasonTab from './SeasonTab'

const doneSim = {
  state: 'done',
  progress: null,
  unavailableReason: null,
  onStart: vi.fn(),
  onCancel: vi.fn(),
  odds: [
    { rosterId: '1', name: 'Team A', isMine: true, winsAvg: 9.5, playoffPct: 82.4, byePct: 20, titlePct: 15.2, reducedAccuracy: false },
    { rosterId: '2', name: 'Team B', isMine: false, winsAvg: 4.1, playoffPct: 5, byePct: 0, titlePct: 0.5, reducedAccuracy: true },
  ],
}

describe('SeasonTab', () => {
  it('zeigt Odds-Tabelle mit eigenem Team hervorgehoben', () => {
    render(<SeasonTab sim={doneSim} />)
    expect(screen.getByText('Team A')).toBeTruthy()
    expect(screen.getByText('82,4 %')).toBeTruthy()
    expect(screen.getByText('Team A').closest('tr')).toHaveClass('is-mine')
  })
  it('zeigt reducedAccuracy-Badge statt falscher Praezision', () => {
    render(<SeasonTab sim={doneSim} />)
    expect(screen.getByText(/reduzierte Genauigkeit/i)).toBeTruthy()
  })
  it('idle zeigt Start-Button, loading/progress zeigt Abbrechen', () => {
    const idle = { ...doneSim, state: 'idle', odds: null }
    const { rerender } = render(<SeasonTab sim={idle} />)
    const btn = screen.getByRole('button', { name: /Simulation starten/i })
    fireEvent.click(btn)
    expect(idle.onStart).toHaveBeenCalledTimes(1)
    rerender(<SeasonTab sim={{ ...idle, state: 'simulating', progress: { done: 5000, total: 10000 } }} />)
    expect(screen.getByRole('button', { name: /Abbrechen/i })).toBeTruthy()
  })
  it('unavailable erklaert warum, ohne Fake-Zahlen', () => {
    render(<SeasonTab sim={{ ...doneSim, state: 'unavailable', odds: null, unavailableReason: 'Kein Rest-Spielplan verfügbar (Saison ggf. beendet).' }} />)
    expect(screen.getByText(/Kein Rest-Spielplan/i)).toBeTruthy()
    expect(screen.queryByText('Team A')).toBeNull()
  })
})
