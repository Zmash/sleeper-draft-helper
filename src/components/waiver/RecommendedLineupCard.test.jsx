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

  it('zeigt die Pkt-Spalte mit einer Nachkommastelle, wenn ptsLoaded true ist', () => {
    const withPts = {
      slots: [{ slot: 'QB', slotIndex: 0, player: { name: 'Jayden Daniels', team: 'WAS' }, rank: 3, pts: 21.4, alt: 5 }],
      bench: [],
    }
    const { container } = render(
      <RecommendedLineupCard lineup={withPts} comparison={null} altLabel="ROS" altKind="rank" ptsLoaded />
    )
    expect(screen.getByText('Pkt')).toBeInTheDocument()
    expect(screen.getByText('21.4')).toBeInTheDocument()
    expect(container.querySelector('.an-card--lineup').className).toContain('an-card--lineup--pts')
  })

  it('zeigt keine Pkt-Spalte ohne ptsLoaded (Standard)', () => {
    render(<RecommendedLineupCard lineup={lineup} comparison={null} altLabel="ROS" altKind="rank" />)
    expect(screen.queryByText('Pkt')).not.toBeInTheDocument()
  })
})


describe('RecommendedLineupCard: AutoSubs', () => {
  const starter = { sleeper_id: '1', name: 'Puka Nacua', team: 'LAR', pos: 'WR', injury_status: 'Questionable' }
  const sub = { sleeper_id: '2', name: 'Jaylen Waddle', team: 'MIA', pos: 'WR' }
  const withSub = {
    slots: [{ slot: 'WR', slotIndex: 0, player: starter, rank: 8 }],
    bench: [{ ...sub, rank: 30 }],
  }
  const autoSub = (over = {}) => ({
    rules: { maxSubs: 3, requireLaterKickoff: true },
    picks: [{ slot: 'WR', slotIndex: 0, starter, sub, risk: 0.25, expected: 3.1 }],
    uncovered: [],
    assigned: null,
    kickoffFor: () => null,
    ...over,
  })

  it('zeigt ohne AutoSub-Liga keinen Abschnitt', () => {
    render(<RecommendedLineupCard lineup={withSub} comparison={null} />)
    expect(screen.queryByTestId('autosub-section')).toBeNull()
  })

  it('zeigt Paar, Limit, Regel und markiert Starter und Sub', () => {
    const { container } = render(<RecommendedLineupCard lineup={withSub} comparison={null} autoSub={autoSub()} />)
    const section = screen.getByTestId('autosub-section')
    expect(section.textContent).toContain('1 von max. 3')
    expect(section.textContent).toContain('gleich spät oder später')
    expect(section.textContent).toContain('Jaylen Waddle')
    expect(section.textContent).toContain('+3.1')
    expect(container.querySelector('.an-as-tag').textContent).toBe('AS')
    expect(container.querySelector('.an-as-tag--sub').textContent).toBe('Sub')
    // Ohne lesbare Zuordnung kein "gesetzt"/"nicht gesetzt".
    expect(section.textContent).not.toContain('gesetzt')
  })

  it('gleicht mit hinterlegten Subs ab', () => {
    render(<RecommendedLineupCard lineup={withSub} comparison={null} autoSub={autoSub({ assigned: new Map([['1', '2']]) })} />)
    expect(screen.getByText('gesetzt')).toBeInTheDocument()
  })

  it('sagt es, wenn kein Sub noetig ist', () => {
    render(<RecommendedLineupCard lineup={withSub} comparison={null} autoSub={autoSub({ picks: [] })} />)
    expect(screen.getByText(/braucht es keinen AutoSub/)).toBeInTheDocument()
  })
})

describe('RecommendedLineupCard – Flex-Begruendung', () => {
  it('nennt bei einem Flex-Tausch den FLEX-Rang beider Spieler und markiert Verletzte', () => {
    const flexLineup = {
      slots: [{ slot: 'FLEX', slotIndex: 0, player: { sleeper_id: '5001', name: 'Dalton Schultz', team: 'HOU', pos: 'TE' }, rank: 8 }],
      bench: [{ sleeper_id: '7021', name: 'Rico Dowdle', team: 'PIT', pos: 'RB', rank: 73, injury_status: 'Questionable' }],
    }
    const comparison = { isOptimal: false, diffs: [{ slot: 'FLEX', in: '5001', name: 'Dalton Schultz' }, { slot: null, out: '7021' }] }
    const flexRankById = new Map([['ID:5001', 53], ['ID:7021', 209]])
    const { container } = render(
      <RecommendedLineupCard lineup={flexLineup} comparison={comparison} rosterNameById={{ 7021: 'Rico Dowdle' }} flexRankById={flexRankById} />
    )
    const diff = container.querySelector('.an-lineup-diff').textContent
    expect(diff).toContain('FLEX-Rang 53')
    expect(diff).toContain('FLEX-Rang 209')
    expect(container.querySelector('.an-inj--inline').textContent).toBe('Q')
  })
})
