import { describe, it, expect } from 'vitest'
import { mergeRankingsWithMarket, overlayMarketData } from './marketMerge'

const fc = [
  { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', overallRank: 1, tier: 1, sleeperId: '9509', value: 10491 },
  { name: 'Ja\'Marr Chase',  pos: 'WR', team: 'CIN', overallRank: 2, tier: 1, sleeperId: '7564', value: 9800 },
]
const ffc = [
  { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', adp: 1.7, bye: 11, stdev: 0.7, high: 1, low: 4 },
  { name: 'Harrison Butker', pos: 'K', team: 'KC', adp: 150.2, bye: 6, stdev: 12.1, high: 120, low: 180 },
  { name: 'Ravens D/ST', pos: 'DEF', team: 'BAL', adp: 140.5, bye: 7, stdev: 10.0, high: 110, low: 170 },
]

describe('mergeRankingsWithMarket', () => {
  it('Rang und Tier kommen von FantasyCalc, ADP und Bye von FFC', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    const bijan = players.find(p => p.name === 'Bijan Robinson')
    expect(bijan.rk).toBe('1')
    expect(bijan.tier).toBe(1)
    expect(bijan.adp).toBe(1.7)
    expect(bijan.bye).toBe(11)
    expect(bijan.stdev).toBe(0.7)
  })

  it('Union: FFC-only Spieler (K/DEF) werden hinten angehaengt', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    expect(players).toHaveLength(4)
    const k = players.find(p => p.pos === 'K')
    expect(k).toBeTruthy()
    expect(Number(k.rk)).toBeGreaterThan(2)
  })

  it('angehaengte FFC-only Spieler sind nach ADP sortiert', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    const tail = players.slice(2)
    expect(tail.map(p => p.name)).toEqual(['Ravens D/ST', 'Harrison Butker'])
  })

  it('rk ist lueckenlos 1..n', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    expect(players.map(p => Number(p.rk))).toEqual([1, 2, 3, 4])
  })

  it('kein Match ist kein Fehler: adp bleibt null', () => {
    const { players } = mergeRankingsWithMarket(fc, [])
    const chase = players.find(p => p.name === 'Ja\'Marr Chase')
    expect(chase.adp).toBeNull()
    expect(chase.rk).toBe('2')
  })

  it('stats zaehlen korrekt', () => {
    const { stats } = mergeRankingsWithMarket(fc, ffc)
    expect(stats.total).toBe(4)
    expect(stats.withAdp).toBe(3)
    expect(stats.withoutAdp).toBe(1)
    expect(stats.unmatchedNames).toEqual(['Ja\'Marr Chase'])
  })

  it('leere Eingaben beidseitig', () => {
    expect(mergeRankingsWithMarket([], []).players).toEqual([])
    expect(mergeRankingsWithMarket(null, null).players).toEqual([])
    expect(mergeRankingsWithMarket([], ffc).players).toHaveLength(3)
  })

  it('jeder Spieler bekommt ein nname fuer den Pick-Abgleich', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    expect(players.every(p => typeof p.nname === 'string' && p.nname.length > 0)).toBe(true)
  })
})

describe('overlayMarketData', () => {
  const board = [
    { name: 'Bijan Robinson', nname: 'bijan robinson', rk: '5', pos: 'RB', adp: null, status: 'me', pick_no: 3 },
    { name: 'Ja\'Marr Chase', nname: 'jamarr chase', rk: '1', pos: 'WR', adp: null, status: null, pick_no: null },
  ]

  it('fasst rk und Reihenfolge nicht an', () => {
    const { players } = overlayMarketData(board, ffc)
    expect(players.map(p => p.rk)).toEqual(['5', '1'])
    expect(players.map(p => p.name)).toEqual(['Bijan Robinson', 'Ja\'Marr Chase'])
  })

  it('legt nur Marktfelder drueber', () => {
    const { players } = overlayMarketData(board, ffc)
    expect(players[0].adp).toBe(1.7)
    expect(players[0].bye).toBe(11)
    expect(players[0].status).toBe('me')
    expect(players[0].pick_no).toBe(3)
  })

  it('haengt keine neuen Spieler an', () => {
    const { players } = overlayMarketData(board, ffc)
    expect(players).toHaveLength(2)
  })
})
