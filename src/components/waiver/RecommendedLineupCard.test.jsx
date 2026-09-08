import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import RecommendedLineupCard from './RecommendedLineupCard'

// Regressionstest fuer den Session-Bug: die Karte nutzte posColor/
// fantasyProsPlayerUrl ohne Import -> ReferenceError bei jedem Render.
// Wir rendern sie darum direkt mit einem Slot-Set, das alle Sonderfaelle
// abdeckt: FLEX-Slots (Kuerzel), leerer Slot (kein FantasyPros-Link),
// Rank Infinity (Fallback auf –) und normale Slots.
const lineup = {
  slots: [
    { slot: 'QB', slotIndex: 0, player: { name: 'Jayden Daniels', team: 'WAS' }, rank: 3, alt: 6800 },
    { slot: 'SUPER_FLEX', slotIndex: 0, player: { name: 'Bijan Robinson', team: 'ATL' }, rank: Infinity, alt: 7200 },
    { slot: 'WR', slotIndex: 0, player: null, rank: Infinity, alt: null },
  ],
  bench: [],
}

describe('RecommendedLineupCard', () => {
  it('rendert Slots mit Kuerzel, Namen, Team, Wert und Zweitwert', () => {
    render(<RecommendedLineupCard lineup={lineup} comparison={null} altLabel="KTC" altKind="value" />)
    expect(screen.getByText('Jayden Daniels')).toBeInTheDocument()
    expect(screen.getByText('WAS')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6800')).toBeInTheDocument()
  })

  it('kuerzt SUPER_FLEX zu SF (Sleeper-UI-Kuerzel)', () => {
    render(<RecommendedLineupCard lineup={lineup} comparison={null} altLabel="KTC" altKind="value" />)
    expect(screen.getByText('SF')).toBeInTheDocument()
    expect(screen.queryByText('SUPER_FLEX')).not.toBeInTheDocument()
  })

  it('zeigt – statt Infinity und verlinkt leere Slots nicht auf FantasyPros', () => {
    const { container } = render(<RecommendedLineupCard lineup={lineup} comparison={null} altLabel="KTC" altKind="value" />)
    expect(container.textContent).not.toContain('Infinity')
    expect(screen.getAllByText('–').length).toBeGreaterThanOrEqual(2)
    const emptyRow = container.querySelectorAll('.an-lineup-row')[2]
    expect(emptyRow.querySelector('a')).toBeNull()
  })

  it('sortiert QB vor SUPER_FLEX und loest raus-Diffs zum Namen auf', () => {
    const comparison = {
      isOptimal: false,
      diffs: [
        { slot: 'WR', in: 42, name: 'Puka Nacua' },
        { slot: 'WR', out: 99 },
      ],
    }
    const { container } = render(
      <RecommendedLineupCard lineup={lineup} comparison={comparison} rosterNameById={{ 99: 'Old Player' }} altLabel="KTC" altKind="value" />
    )
    const labels = Array.from(container.querySelectorAll('.an-pos')).map((el) => el.textContent)
    expect(labels.indexOf('QB')).toBeLessThan(labels.indexOf('SF'))
    expect(screen.getByText(/Puka Nacua/)).toBeInTheDocument()
    expect(screen.getByText(/Old Player/)).toBeInTheDocument()
  })

  it('renders CTA button when leagueId provided', () => {
    render(<RecommendedLineupCard lineup={lineup} leagueId="12345" altLabel="KTC" altKind="value" />)
    expect(screen.getByText('Lineup in Sleeper setzen')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Lineup in Sleeper setzen/ })).toHaveAttribute('href', 'https://sleeper.com/leagues/12345/team')
  })

  it('does not render CTA button when no leagueId', () => {
    render(<RecommendedLineupCard lineup={lineup} altLabel="KTC" altKind="value" />)
    expect(screen.queryByText('Lineup in Sleeper setzen')).not.toBeInTheDocument()
  })

  it('blendet die Zweitspalte aus, wenn altLoaded false ist (KTC-Daten fehlen)', () => {
    const { container } = render(
      <RecommendedLineupCard lineup={lineup} comparison={null} altLabel="KTC" altKind="value" altLoaded={false} />
    )
    expect(screen.queryByText('KTC')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.an-lineup-row')[0].querySelectorAll('.an-num').length).toBe(1)
    expect(container.querySelector('.an-card--lineup').className).toContain('an-card--lineup--noalt')
  })
})

