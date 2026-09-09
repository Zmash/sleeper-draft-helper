import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StreamingBoard from './StreamingBoard'

const board = {
  DEF: {
    week: [
      { player_id: '1', name: 'Seahawks', nname: 'seahawks', pos: 'DEF', team: 'SEA', rank: 3, pts: 7.5 },
      { player_id: '2', name: 'Jets', nname: 'jets', pos: 'DEF', team: 'NYJ', rank: 1, pts: null },
    ],
    ros: [
      { player_id: '1', name: 'Seahawks', nname: 'seahawks', pos: 'DEF', team: 'SEA', rank: 1 },
      { player_id: '2', name: 'Jets', nname: 'jets', pos: 'DEF', team: 'NYJ', rank: 5 },
    ],
  },
}

describe('StreamingBoard Pkt-Spalte', () => {
  it('zeigt Pkt-Spalte mit Werten, wenn ptsLoaded true ist', () => {
    const { container } = render(
      <StreamingBoard board={board} positions={['DEF']} availablePositions={['DEF']} onTogglePosition={vi.fn()} ptsLoaded />
    )
    expect(screen.getByText('Pkt')).toBeInTheDocument()
    expect(screen.getByText('7.5')).toBeInTheDocument()
    expect(container.querySelector('.an-card--stream').className).toContain('an-card--stream--pts')
  })

  it('zeigt keine Pkt-Spalte ohne ptsLoaded (Standard)', () => {
    render(
      <StreamingBoard board={board} positions={['DEF']} availablePositions={['DEF']} onTogglePosition={vi.fn()} />
    )
    expect(screen.queryByText('Pkt')).not.toBeInTheDocument()
  })
})
