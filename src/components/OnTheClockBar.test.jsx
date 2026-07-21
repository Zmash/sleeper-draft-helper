import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import OnTheClockBar from './OnTheClockBar'

// Bug-Szenario: 12 Teams, Slot 1, Pick 12 ist on the clock (11 Picks gelaufen).
// Snake: mein naechster Pick ist 24, also 12 fremde Picks vor mir — die alte
// lineare Formel zeigte "in 1".
const draft = { league_id: 'L1', settings: { rounds: 15, teams: 12 } }

function picksUpTo(n) {
  return Array.from({ length: n }, (_, i) => ({ pick_no: i + 1, picked_by: `other-${i + 1}` }))
}

describe('OnTheClockBar — Bis zu dir (Snake)', () => {
  it('Slot 1, Pick 12 on the clock -> in 12 (nicht in 1)', () => {
    render(<OnTheClockBar draft={draft} picks={picksUpTo(11)} teamsCount={12} draftSlot={1} />)
    expect(screen.getByText('in 12')).toBeInTheDocument()
  })

  it('eigener Pick on the clock -> Jetzt', () => {
    // 23 Picks gelaufen, Pick 24 = Slot 1 in Runde 2 (Snake-Umkehr).
    render(<OnTheClockBar draft={draft} picks={picksUpTo(23)} teamsCount={12} draftSlot={1} />)
    expect(screen.getByText('Jetzt')).toBeInTheDocument()
  })

  it('Draftstart ohne Picks, Slot 7 -> in 6', () => {
    render(<OnTheClockBar draft={draft} picks={[]} teamsCount={12} draftSlot={7} />)
    expect(screen.getByText('in 6')).toBeInTheDocument()
  })
})
