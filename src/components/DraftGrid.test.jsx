import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DraftGrid from './DraftGrid'
import { useLiveStore } from '../stores/useLiveStore'

// 4 Teams, 2 Runden -- Runde 2 spiegelt (Snake). draft_order: user -> Slot.
const draft = {
  draft_id: 'D1',
  settings: { teams: 4, rounds: 2 },
  draft_order: { u1: 1, u2: 2, u3: 3, u4: 4 },
}
const ownerLabels = new Map([
  ['user:u1', 'Alice'],
  ['user:u2', 'Bob'],
])

function pick(round, slot, name) {
  const [first, last] = name.split(' ')
  return { round, draft_slot: slot, metadata: { first_name: first, last_name: last, position: 'WR', team: 'CIN' } }
}

function renderGrid(props = {}) {
  return render(<DraftGrid draft={draft} teamsCount={4} ownerLabels={ownerLabels} draftSlot={1} {...props} />)
}

describe('DraftGrid', () => {
  beforeEach(() => {
    useLiveStore.setState({ livePicks: [] })
  })

  it('ohne Draft: Hinweis statt Grid', () => {
    renderGrid({ draft: null })
    expect(screen.getByText('Kein Draft ausgewählt.')).toBeInTheDocument()
  })

  it('zeigt Team-Labels aus draft_order/ownerLabels als Spaltenkoepfe', () => {
    renderGrid()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    // u3/u4 haben keinen ownerLabels-Eintrag -> Fallback
    expect(screen.getByText('Team 3')).toBeInTheDocument()
    expect(screen.getByText('Team 4')).toBeInTheDocument()
  })

  it('gepickter Spieler erscheint in seiner Runde/Slot-Zelle', () => {
    useLiveStore.setState({ livePicks: [pick(1, 1, 'Ja Chase')] })
    renderGrid()
    expect(screen.getByText('Ja Chase')).toBeInTheDocument()
  })

  it('naechster freier Pick wird als On the Clock markiert', () => {
    // 3 Picks in Runde 1 (Slot 1-3) -> Pick 4 (Slot 4) ist dran
    useLiveStore.setState({
      livePicks: [pick(1, 1, 'A A'), pick(1, 2, 'B B'), pick(1, 3, 'C C')],
    })
    renderGrid()
    expect(screen.getByText('On the Clock')).toBeInTheDocument()
  })

  it('Runde 2 spiegelt die Pick-Nummer (Snake): Slot 1 zeigt 2.04', () => {
    renderGrid()
    expect(screen.getByText('2.04')).toBeInTheDocument()
    expect(screen.getByText('2.01')).toBeInTheDocument()
  })
})
