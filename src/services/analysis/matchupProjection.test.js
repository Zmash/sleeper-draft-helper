import { describe, it, expect } from 'vitest'
import { blendedPlayerProjection, projectedTotalForStarters } from './matchupProjection'

const PLAYERS_META = {
  '1': { full_name: 'Travis Kelce', fantasy_positions: ['TE'], team: 'KC' },
  '2': { full_name: 'No FP Data Guy', fantasy_positions: ['WR'], team: 'MIA' },
  '3': { full_name: 'No Sleeper Data Guy', fantasy_positions: ['RB'], team: 'SF' },
  '4': { full_name: 'Nobody Guy', fantasy_positions: ['QB'], team: 'BAL' },
  SEA: { full_name: 'Seattle Seahawks', fantasy_positions: ['DEF'], team: 'SEA' },
}

describe('blendedPlayerProjection', () => {
  it('mittelt Sleeper- und FantasyPros-Projektion, wenn beide vorliegen', () => {
    const sleeperWeekById = new Map([['1', { pts_ppr: 14 }]])
    const fpPtsByKey = new Map([['NAME:travis kelce', 10]])
    const v = blendedPlayerProjection({
      playerId: '1', playersMeta: PLAYERS_META, sleeperWeekById, scoringField: 'pts_ppr', fpPtsByKey,
    })
    expect(v).toBe(12)
  })

  it('faellt auf Sleeper allein zurueck, wenn FantasyPros den Spieler nicht kennt', () => {
    const sleeperWeekById = new Map([['2', { pts_ppr: 8 }]])
    const fpPtsByKey = new Map()
    const v = blendedPlayerProjection({
      playerId: '2', playersMeta: PLAYERS_META, sleeperWeekById, scoringField: 'pts_ppr', fpPtsByKey,
    })
    expect(v).toBe(8)
  })

  it('faellt auf FantasyPros allein zurueck, wenn Sleeper den Spieler nicht kennt', () => {
    const sleeperWeekById = new Map()
    const fpPtsByKey = new Map([['NAME:no sleeper data guy', 11]])
    const v = blendedPlayerProjection({
      playerId: '3', playersMeta: PLAYERS_META, sleeperWeekById, scoringField: 'pts_ppr', fpPtsByKey,
    })
    expect(v).toBe(11)
  })

  it('null, wenn keine Quelle etwas weiss', () => {
    const v = blendedPlayerProjection({
      playerId: '4', playersMeta: PLAYERS_META, sleeperWeekById: new Map(), scoringField: 'pts_ppr', fpPtsByKey: new Map(),
    })
    expect(v).toBeNull()
  })

  it('DEF matcht ueber Team-Key, nicht ueber den Namen', () => {
    const sleeperWeekById = new Map([['SEA', { pts_ppr: 6 }]])
    const fpPtsByKey = new Map([['TEAM:SEA', 8]])
    const v = blendedPlayerProjection({
      playerId: 'SEA', playersMeta: PLAYERS_META, sleeperWeekById, scoringField: 'pts_ppr', fpPtsByKey,
    })
    expect(v).toBe(7)
  })
})

describe('projectedTotalForStarters', () => {
  it('summiert geblendete Werte, ueberspringt leere Slots ("0")', () => {
    const sleeperWeekById = new Map([['1', { pts_ppr: 14 }], ['2', { pts_ppr: 8 }]])
    const fpPtsByKey = new Map([['NAME:travis kelce', 10]])
    const total = projectedTotalForStarters({
      starterIds: ['1', '0', '2'], playersMeta: PLAYERS_META, sleeperWeekById, scoringField: 'pts_ppr', fpPtsByKey,
    })
    expect(total).toBe(12 + 8)
  })

  it('null, wenn kein Starter irgendeine Projektion hat', () => {
    const total = projectedTotalForStarters({
      starterIds: ['4'], playersMeta: PLAYERS_META, sleeperWeekById: new Map(), scoringField: 'pts_ppr', fpPtsByKey: new Map(),
    })
    expect(total).toBeNull()
  })
})
