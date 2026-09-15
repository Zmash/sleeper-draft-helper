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

// Eigener Spieler weit hinter den Top-10 (Rang 42): er muss trotzdem sichtbar
// sein, sonst laesst sich der Waiver-Vergleich nicht ziehen.
const boardWithOwn = {
  DEF: {
    week: [
      ...Array.from({ length: 10 }, (_, i) => ({
        player_id: `fa${i}`, name: `FA ${i}`, nname: `fa${i}`, pos: 'DEF', team: 'DAL', rank: i + 1, pts: null, own: false,
      })),
      { player_id: '99', name: 'Meine Defense', nname: 'meinedefense', pos: 'DEF', team: 'KC', rank: 42, pts: null, own: true },
    ],
    ros: [],
  },
}

describe('StreamingBoard eigener Spieler', () => {
  it('hebt die eigene Zeile farblich hervor und markiert sie im Namen', () => {
    const own = {
      DEF: {
        // Reihenfolge = fertig sortierte Liste aus streamingBoard()
        week: [
          { player_id: '99', name: 'Meine Defense', nname: 'meinedefense', pos: 'DEF', team: 'KC', rank: 2, own: true },
          { player_id: '1', name: 'Seahawks', nname: 'seahawks', pos: 'DEF', team: 'SEA', rank: 3, own: false },
        ],
        ros: [],
      },
    }
    const { container } = render(
      <StreamingBoard board={own} positions={['DEF']} availablePositions={['DEF']} onTogglePosition={vi.fn()} />
    )
    const rows = container.querySelectorAll('.an-listrow:not(.an-listrow-head)')
    expect(rows).toHaveLength(2)
    expect(rows[0].className).toContain('is-own')
    expect(rows[0].textContent).toContain('Meine Defense')
    expect(rows[1].className).not.toContain('is-own')
    expect(screen.getByText('(eigen)')).toBeInTheDocument()
  })

  it('zeigt den eigenen Spieler auch ausserhalb der Top-10, mit Trenner', () => {
    const { container } = render(
      <StreamingBoard board={boardWithOwn} positions={['DEF']} availablePositions={['DEF']} onTogglePosition={vi.fn()} />
    )
    const rows = container.querySelectorAll('.an-listrow:not(.an-listrow-head)')
    expect(rows).toHaveLength(11)
    expect(rows[10].className).toContain('is-own')
    expect(screen.getByText('Meine Defense')).toBeInTheDocument()
    expect(container.querySelector('.an-stream-gap')).toBeTruthy()
  })

  it('zeigt keinen Trenner, wenn der eigene Spieler in den Top-10 steht', () => {
    const board10 = { DEF: { week: boardWithOwn.DEF.week.slice(0, 9).concat({ ...boardWithOwn.DEF.week[10], rank: 10 }), ros: [] } }
    const { container } = render(
      <StreamingBoard board={board10} positions={['DEF']} availablePositions={['DEF']} onTogglePosition={vi.fn()} />
    )
    expect(container.querySelectorAll('.an-listrow:not(.an-listrow-head)')).toHaveLength(10)
    expect(container.querySelector('.an-stream-gap')).toBeNull()
  })
})

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
