import { describe, it, expect } from 'vitest'
import { buildIdRankMaps, selectAndScore } from './seasonStrengths'

const players = [
  { sleeper_id: '1', name: 'Q Back', nname: 'q back', pos: 'QB', team: 'CHI', bye: '5' },
  { sleeper_id: '2', name: 'R Back', nname: 'r back', pos: 'RB', team: 'KC', bye: '6' },
  { sleeper_id: '3', name: 'W Receiver', nname: 'w receiver', pos: 'WR', team: 'SEA', bye: '5' },
]

// getRankMap-Fake im Muster von useWeeklyRankingsStore: matchKey -> ECR.
const fakeGetRankMap = ({ pos }) => {
  const maps = {
    QB: new Map([['NAME:q back', 7]]),
    RB: new Map([['NAME:r back', 12]]),
    WR: new Map([['NAME:w receiver', 4]]),
    TE: new Map(),
    DEF: new Map(),
    FLEX: new Map([['NAME:r back', 20], ['NAME:w receiver', 10]]),
    SUPER_FLEX: new Map(),
  }
  return maps[pos] || new Map()
}

describe('buildIdRankMaps', () => {
  it('mappt Raenge auf ID:-Keys pro Spieler', () => {
    const { wk } = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    expect(wk.get('ID:1')).toBe(7)
    expect(wk.get('ID:2')).toBe(12)
    expect(wk.get('ID:3')).toBe(4)
  })
  it('legt Flex-Maps an', () => {
    const { fx } = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    expect(fx.get('ID:3')).toBe(10)
  })
})

const pointsById = new Map([
  ['1', { pts_ppr: 18.3, pts_half_ppr: 17.5, pts_std: 16.0 }],
  ['2', { pts_ppr: 12.3, pts_half_ppr: 12.0, pts_std: 11.5 }],
  ['3', { pts_ppr: 16.3, pts_half_ppr: 15.0, pts_std: 13.0 }],
])

describe('selectAndScore', () => {
  it('summiert Projektionen der bestLineup-Starter', () => {
    const rankMaps = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    const r = selectAndScore({
      rosterPlayers: players,
      rosterPositions: ['QB', 'RB', 'WR', 'BN', 'BN'],
      rankMaps,
      byeWeek: null,
      pointsById,
      field: 'pts_ppr',
      dynastyValuesByName: null,
    })
    expect(r.missingCount).toBe(0)
    expect(r.points).toBeCloseTo(18.3 + 12.3 + 16.3, 5)
    expect(r.starterIds).toHaveLength(3)
  })
  it('schliesst Bye-Week-Spieler fuer die Simulations-Woche aus', () => {
    const rankMaps = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    const r = selectAndScore({
      rosterPlayers: players,
      rosterPositions: ['QB', 'RB', 'WR', 'BN', 'BN'],
      rankMaps,
      byeWeek: '5',
      pointsById,
      field: 'pts_ppr',
      dynastyValuesByName: null,
    })
    // QB (Bye 5) und WR (Bye 5) fallen raus -- nur RB bleibt Starter.
    expect(r.points).toBeCloseTo(12.3, 5)
  })
  it('fehlende Projektion zaehlt Replacement-Level, nicht 0', () => {
    const rankMaps = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    const thin = new Map([[ '1', { pts_ppr: 18.3 } ]])
    const r = selectAndScore({
      rosterPlayers: players,
      rosterPositions: ['QB', 'RB', 'WR', 'BN', 'BN'],
      rankMaps,
      byeWeek: null,
      pointsById: thin,
      field: 'pts_ppr',
      dynastyValuesByName: null,
    })
    expect(r.missingCount).toBe(2)
    // Replacement = Positions-Minimum der projizierten Starter; hier kennt nur
    // QB eine Projektion -> RB/WR fallen auf 0 zurueck, QB zahlt voll.
    expect(r.points).toBeCloseTo(18.3, 5)
  })
})
