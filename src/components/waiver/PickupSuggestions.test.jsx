import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PickupSuggestions from './PickupSuggestions'

const players = [
  { player_id: '1', name: 'Pickup QB', pos: 'QB', team: 'BAL', value: 12, pts: 21.4, trending: false, injury_status: null },
  { player_id: '2', name: 'No Projection', pos: 'QB', team: 'NYJ', value: 40, pts: null, trending: false, injury_status: null },
]

describe('PickupSuggestions Pkt-Spalte', () => {
  it('zeigt Pkt-Spalte mit Werten, wenn ptsLoaded true ist', () => {
    const { container } = render(
      <PickupSuggestions players={players} mode="redraft" ptsLoaded />
    )
    expect(screen.getByText('Pkt')).toBeInTheDocument()
    expect(screen.getByText('21.4')).toBeInTheDocument()
    expect(container.querySelector('.an-card--pickups').className).toContain('an-card--pickups--pts')
  })

  it('zeigt keine Pkt-Spalte ohne ptsLoaded (Standard)', () => {
    render(<PickupSuggestions players={players} mode="redraft" />)
    expect(screen.queryByText('Pkt')).not.toBeInTheDocument()
  })
})
