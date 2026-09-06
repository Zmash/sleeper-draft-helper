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
  it('sortiert numerisch, nicht lexikografisch', () => {
    expect(median([1, 10, 9])).toBe(9)
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

  it('Befund 1: Spieler mit leerem ECR wird im Rangmodus gefiltert, nicht als bester sortiert', () => {
    // Testfall: ein Spieler mit ecr: '' (wird zu Number('') = 0, also sehr gut wenn nicht gefiltert)
    // und ein Spieler mit ecr: 50 (legitim)
    const boardWithEmptyECR = [
      { sleeper_id: '1', nname: 'bad', pos: 'RB', ecr: '', dynasty_value: 10 },
      { sleeper_id: '2', nname: 'good', pos: 'RB', ecr: 50, dynasty_value: 5 },
    ]
    const rostersForEmpty = [
      { roster_id: 1, players: ['1'] },  // nur Spieler mit ecr: ''
      { roster_id: 2, players: ['2'] },  // Spieler mit ecr: 50
    ]
    const ohneWert = boardWithEmptyECR.map(({ dynasty_value, ...rest }) => rest)
    const r = rosterValueSplit({
      leagueRosters: rostersForEmpty, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    // Der Spieler mit leerem ECR sollte gefiltert werden, daher mine = null
    expect(rb.mine).toBeNull()
    // Der Median sollte nur den gültigen Rang enthalten (50)
    expect(rb.median).toBe(50)
  })

  it('Rangmodus: eigenes Team schlechter als Median -> diff negativ', () => {
    // Testfall: eigenes Team hat Rang 80 (schlecht), Liga-Median ist 50 (besser)
    // diff sollte negativ sein: median - mine = 50 - 80 = -30
    const rankBoard = [
      { sleeper_id: '1', nname: 'my worst', pos: 'RB', ecr: 80 },
      { sleeper_id: '2', nname: 'league best', pos: 'RB', ecr: 5 },
      { sleeper_id: '3', nname: 'league mid', pos: 'RB', ecr: 50 },
    ]
    const rankRosters = [
      { roster_id: 1, players: ['1'] },  // mein schlechter Rang
      { roster_id: 2, players: ['2'] },  // Liga: bester
      { roster_id: 3, players: ['3'] },  // Liga: mittler
    ]
    const r = rosterValueSplit({
      leagueRosters: rankRosters, boardPlayers: rankBoard, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(80)
    expect(rb.median).toBe(50)
    expect(rb.diff).toBe(-30)  // negativ, weil ich schlechter bin
  })

  it('Wertmodus: eigenes Team schlechter als Median -> diff negativ', () => {
    // Testfall: eigenes Team hat value 10 (niedrig), Liga-Median ist 50 (besser)
    // diff sollte negativ sein: mine - median = 10 - 50 = -40
    const valueBoard = [
      { sleeper_id: '1', nname: 'my low', pos: 'RB', dynasty_value: 10 },
      { sleeper_id: '2', nname: 'league high', pos: 'RB', dynasty_value: 100 },
      { sleeper_id: '3', nname: 'league mid', pos: 'RB', dynasty_value: 50 },
    ]
    const valueRosters = [
      { roster_id: 1, players: ['1'] },  // mein niedriger Wert
      { roster_id: 2, players: ['2'] },  // Liga: höchster
      { roster_id: 3, players: ['3'] },  // Liga: Median
    ]
    const r = rosterValueSplit({
      leagueRosters: valueRosters, boardPlayers: valueBoard, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(10)
    expect(rb.median).toBe(50)
    expect(rb.diff).toBe(-40)  // negativ, weil ich schlechter bin
  })
})
