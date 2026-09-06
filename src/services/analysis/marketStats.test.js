import { describe, it, expect } from 'vitest'
import { marketDisagreement } from './marketStats'

const p = (nname, name, stdev, adp, low, high) =>
  ({ nname, name, pos: 'RB', stdev, adp, low, high })

describe('marketDisagreement', () => {
  it('sortiert absteigend nach stdev', () => {
    const board = [p('a a', 'A A', 2, 10, 8, 12), p('b b', 'B B', 9, 20, 5, 40)]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((x) => x.name)).toEqual(['B B', 'A A'])
  })

  it('Spieler ohne stdev oder ohne high/low fallen heraus', () => {
    const board = [
      p('a a', 'A A', 5, 10, 8, 12),
      p('b b', 'B B', null, 20, 5, 40),
      { nname: 'c c', name: 'C C', pos: 'RB', stdev: 3, adp: 15 },  // kein low/high
    ]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((x) => x.name)).toEqual(['A A'])
    expect(r.basis).toBe(1)
  })

  it('gepickte Spieler fallen heraus', () => {
    const board = [p('a a', 'A A', 5, 10, 8, 12), p('b b', 'B B', 9, 20, 5, 40)]
    const picks = [{ pick_no: 1, metadata: { first_name: 'B', last_name: 'B' } }]
    const r = marketDisagreement({ boardPlayers: board, picks })
    expect(r.players.map((x) => x.name)).toEqual(['A A'])
  })

  it('Skala umspannt alle low/high-Werte', () => {
    const board = [p('a a', 'A A', 5, 10, 8, 12), p('b b', 'B B', 9, 20, 5, 40)]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.scaleMin).toBe(5)
    expect(r.scaleMax).toBe(40)
  })

  it('low === high ergibt eine Skala mit Breite, keine Division durch null', () => {
    const board = [p('a a', 'A A', 5, 10, 10, 10)]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.scaleMax).toBeGreaterThan(r.scaleMin)
  })

  it('limit begrenzt die Liste', () => {
    const board = Array.from({ length: 20 }, (_, i) =>
      p(`x${i} y`, `X${i} Y`, i, 10, 5, 15))
    expect(marketDisagreement({ boardPlayers: board, picks: [], limit: 3 }).players).toHaveLength(3)
  })

  it('leeres Board -> gueltige Struktur, basis 0', () => {
    const r = marketDisagreement({ boardPlayers: [], picks: [] })
    expect(r.players).toEqual([])
    expect(r.basis).toBe(0)
  })
})
