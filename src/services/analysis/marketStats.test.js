import { describe, it, expect } from 'vitest'
import { marketDisagreement, expertDisagreement } from './marketStats'

const p = (nname, name, stdev, adp, low, high) =>
  ({ nname, name, pos: 'RB', stdev, adp, low, high })

describe('marketDisagreement', () => {
  it('sortiert absteigend nach Streuung relativ zur ADP (stdev/adp), nicht absolut', () => {
    const board = [p('a a', 'A A', 2, 10, 8, 12), p('b b', 'B B', 9, 20, 5, 40)]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    // cv(A) = 2/10 = .2, cv(B) = 9/20 = .45 -- B gewinnt, wie zuvor bei roher
    // Streuung. Der naechste Test zeigt den Fall, wo sich das unterscheidet.
    expect(r.players.map((x) => x.name)).toEqual(['B B', 'A A'])
  })

  it('relative Streuung kann die Reihenfolge gegenueber roher Streuung umdrehen', () => {
    // Frueher Pick mit kleiner absoluter, aber grosser relativer Streuung
    // (Committee-Backfield o.ae.) soll vor einem Spaetrunden-Spieler stehen,
    // dessen absolute Streuung nur deshalb groesser ist, weil dort JEDER
    // Mock-Draft staerker schwankt -- nicht, weil der Markt uneiniger waere.
    const board = [
      p('early e', 'Early E', 4, 5, 2, 9),      // stdev 4, adp 5   -> cv 0.8
      p('late l', 'Late L', 10, 150, 120, 190), // stdev 10, adp 150 -> cv 0.067
    ]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((x) => x.name)).toEqual(['Early E', 'Late L'])
  })

  it('deckelt die Liste pro Position, damit eine einzelne Position sie nicht fuellt', () => {
    const te = (i) => ({ nname: `te${i} x`, name: `TE${i} X`, pos: 'TE', stdev: 20 - i, adp: 100, low: 80, high: 120 })
    const board = [
      ...Array.from({ length: 5 }, (_, i) => te(i)),
      { nname: 'rb rb', name: 'RB RB', pos: 'RB', stdev: 1, adp: 100, low: 90, high: 110 },
    ]
    const r = marketDisagreement({ boardPlayers: board, picks: [], limit: 10, maxPerPos: 2 })
    const teCount = r.players.filter((x) => x.pos === 'TE').length
    expect(teCount).toBe(2)
    expect(r.players.some((x) => x.pos === 'RB')).toBe(true)
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

  it('limit begrenzt die Liste (verschiedene Positionen, Deckel greift nicht)', () => {
    const positions = ['QB', 'RB', 'WR', 'TE']
    const board = Array.from({ length: 20 }, (_, i) =>
      ({ nname: `x${i} y`, name: `X${i} Y`, pos: positions[i % positions.length], stdev: i, adp: 10, low: 5, high: 15 }))
    expect(marketDisagreement({ boardPlayers: board, picks: [], limit: 3 }).players).toHaveLength(3)
  })

  it('leeres Board -> gueltige Struktur, basis 0', () => {
    const r = marketDisagreement({ boardPlayers: [], picks: [] })
    expect(r.players).toEqual([])
    expect(r.basis).toBe(0)
  })
})

describe('marketDisagreement — FFC-Konvention von low/high', () => {
  // FFC nennt "high" die hoechste Draftposition: das ist der FRUEHESTE Pick und
  // damit die KLEINERE Zahl. Echte Antwort fuer Jahmyr Gibbs: high 1, low 3.
  // Ohne Umsortierung waere pct(high) - pct(low) negativ und der Balken weg.
  it('sortiert low/high nach Pick-Nummern, egal wie herum sie ankommen', () => {
    const board = [
      { nname: 'a a', name: 'A A', pos: 'RB', stdev: 5, adp: 2, high: 1, low: 9 },
    ]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players[0].low).toBe(1)   // fruehester Pick
    expect(r.players[0].high).toBe(9)  // spaetester Pick
    expect(r.players[0].high).toBeGreaterThan(r.players[0].low)
  })

  it('nutzt market_adp als Bezugswert, faellt aber auf adp zurueck', () => {
    const mitFfc = [{ nname: 'a a', name: 'A A', pos: 'RB', stdev: 5, adp: 40, market_adp: 22, high: 10, low: 30 }]
    expect(marketDisagreement({ boardPlayers: mitFfc, picks: [] }).players[0].avg).toBe(22)

    const ohneFfc = [{ nname: 'b b', name: 'B B', pos: 'RB', stdev: 5, adp: 40, high: 10, low: 30 }]
    expect(marketDisagreement({ boardPlayers: ohneFfc, picks: [] }).players[0].avg).toBe(40)
  })
})

describe('marketDisagreement — Kicker und Defenses', () => {
  // Sie haben naturgemaess die groesste Streuung, weil jede Liga sie irgendwann
  // nimmt und der Zeitpunkt beliebig ist. Ohne Filter fuellen sie die Liste,
  // ohne dass dahinter eine strittige Einschaetzung steckt.
  it('schliesst K und DEF aus, auch bei hoechster Streuung', () => {
    const board = [
      { nname: 'k k', name: 'K K', pos: 'K', stdev: 99, adp: 150, high: 100, low: 200 },
      { nname: 'd d', name: 'D D', pos: 'DEF', stdev: 98, adp: 150, high: 100, low: 200 },
      { nname: 'x x', name: 'X X', pos: 'DST', stdev: 97, adp: 150, high: 100, low: 200 },
      { nname: 'w w', name: 'W W', pos: 'WR', stdev: 5, adp: 40, high: 30, low: 50 },
    ]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((p) => p.name)).toEqual(['W W'])
    expect(r.basis).toBe(1)
  })
})

describe('expertDisagreement', () => {
  const fp = (nname, name, ecr, rankStd, rankMin, rankMax, pos = 'WR') =>
    ({ nname, name, pos, ecr, rank_std: rankStd, rank_min: rankMin, rank_max: rankMax })

  it('liest aus rank_std/rank_min/rank_max/ecr statt aus den FFC-Feldern', () => {
    const board = [
      fp('a a', 'A A', 5, 1, 1, 6),     // cv = 1/5 = .2
      fp('b b', 'B B', 80, 30, 50, 130), // cv = 30/80 = .375
    ]
    const r = expertDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((x) => x.name)).toEqual(['B B', 'A A'])
    expect(r.players[0].low).toBe(50)
    expect(r.players[0].high).toBe(130)
  })

  it('bleibt leer, wenn das Board keine FantasyPros-Panel-Felder hat (z. B. FantasyCalc-Import)', () => {
    const board = [p('a a', 'A A', 5, 10, 8, 12)] // FFC-Form, kein rank_std/rank_min/rank_max
    const r = expertDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players).toEqual([])
    expect(r.basis).toBe(0)
  })

  it('schliesst K und DEF aus wie marketDisagreement', () => {
    const board = [
      fp('k k', 'K K', 150, 40, 100, 220, 'K'),
      fp('w w', 'W W', 40, 5, 30, 50, 'WR'),
    ]
    const r = expertDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((x) => x.name)).toEqual(['W W'])
  })
})
