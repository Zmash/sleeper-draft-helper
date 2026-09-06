import { describe, it, expect } from 'vitest'
import { median, rosterValueSplit } from './rosterStats'

describe('median', () => {
  it('ungerade Anzahl -> mittlerer Wert', () => {
    expect(median([3, 1, 2])).toBe(2)
  })
  it('gerade Anzahl -> Mittel der beiden mittleren', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('leere Liste -> null statt NaN', () => {
    expect(median([])).toBeNull()
  })
})

const board = [
  { sleeper_id: '1', nname: 'a a', pos: 'RB', ecr: 5, dynasty_value: 100 },
  { sleeper_id: '2', nname: 'b b', pos: 'RB', ecr: 50, dynasty_value: 40 },
  { sleeper_id: '3', nname: 'c c', pos: 'RB', ecr: 80, dynasty_value: 10 },
]
const rosters = [
  { roster_id: 1, players: ['1'] },   // starker RB
  { roster_id: 2, players: ['2'] },
  { roster_id: 3, players: ['3'] },   // schwacher RB
]

describe('rosterValueSplit', () => {
  it('mit dynasty_value: Summe je Position gegen den Liga-Median', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('value')
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(100)
    expect(rb.median).toBe(40)     // Median aus 100, 40, 10
    expect(rb.diff).toBe(60)
  })

  it('ohne dynasty_value: rangbasiert, positives diff heisst weiterhin besser', () => {
    const ohneWert = board.map(({ dynasty_value, ...rest }) => rest)
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('rank')
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(5)        // bester eigener RB
    expect(rb.median).toBe(50)     // Median aus 5, 50, 80
    expect(rb.diff).toBe(45)       // median - mine, weil kleiner Rang besser ist
  })

  it('Deckungsgrad zaehlt gematchte Kaderspieler', () => {
    const mitUnbekannt = [{ roster_id: 1, players: ['1', '999'] }, ...rosters.slice(1)]
    const r = rosterValueSplit({
      leagueRosters: mitUnbekannt, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.coverage).toBeCloseTo(3 / 4)
  })

  it('ein einzelner Kader: Median ist der eigene Wert, diff 0', () => {
    const r = rosterValueSplit({
      leagueRosters: [rosters[0]], boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.teamCount).toBe(1)
    expect(r.positions.find((p) => p.pos === 'RB').diff).toBe(0)
  })

  it('ohne leagueRosters -> leere, gueltige Struktur', () => {
    const r = rosterValueSplit({
      leagueRosters: [], boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.positions).toEqual([])
    expect(r.coverage).toBe(0)
  })

  it('unbekanntes myRosterId -> mine und diff null, Median bleibt gueltig', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 99,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBeNull()
    expect(rb.diff).toBeNull()
    expect(rb.median).toBe(40)
  })
})
