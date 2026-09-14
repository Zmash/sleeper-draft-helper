import { describe, it, expect } from 'vitest'
import { blendedPlayerProjection, isRuledOut, liveStarterTotals, remainingGameFraction } from './matchupProjection'

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

describe('remainingGameFraction', () => {
  it('kein Spiel bekannt -> null (Aufrufer behaelt die volle Projektion)', () => {
    expect(remainingGameFraction(null)).toBeNull()
    expect(remainingGameFraction({ state: 'none' })).toBeNull()
  })

  it('vor Kickoff steht alles offen, nach Schlusspfiff nichts mehr', () => {
    expect(remainingGameFraction({ state: 'pre' })).toBe(1)
    expect(remainingGameFraction({ state: 'post' })).toBe(0)
  })

  it('laufendes Spiel: Rest nach Viertel und Uhr', () => {
    // Halbzeit: 2. Viertel abgelaufen -> die Haelfte steht noch aus.
    expect(remainingGameFraction({ state: 'in', period: 2, clockSeconds: 0 })).toBe(0.5)
    // Mitte 1. Viertel (7:30 Restzeit) -> 7/8.
    expect(remainingGameFraction({ state: 'in', period: 1, clockSeconds: 450 })).toBeCloseTo(0.875, 5)
    // 4. Viertel, 2 Minuten Restzeit.
    expect(remainingGameFraction({ state: 'in', period: 4, clockSeconds: 120 })).toBeCloseTo(120 / 3600, 5)
  })

  it('Overtime zaehlt als ausgespielt, fehlendes Viertel als halb', () => {
    expect(remainingGameFraction({ state: 'in', period: 5, clockSeconds: 600 })).toBe(0)
    expect(remainingGameFraction({ state: 'in' })).toBe(0.5)
  })
})

describe('liveStarterTotals', () => {
  const proj = (map) => (id) => map[id] ?? null

  it('summiert die volle Projektion, solange kein Spiel gestartet ist', () => {
    const r = liveStarterTotals({
      starterIds: ['1', '0', '2'],
      projectionFor: proj({ 1: 12, 2: 8 }),
      gameFor: () => ({ state: 'pre' }),
    })
    expect(r).toEqual({ rest: 20, open: 2, hasGameStates: true })
  })

  it('fertige Spiele steuern nichts mehr bei', () => {
    const r = liveStarterTotals({
      starterIds: ['1', '2'],
      projectionFor: proj({ 1: 12, 2: 8 }),
      pointsFor: (id) => ({ 1: 21.4, 2: 3.1 }[id]),
      gameFor: () => ({ state: 'post' }),
    })
    expect(r).toEqual({ rest: 0, open: 0, hasGameStates: true })
  })

  it('laufende Spiele anteilig, fertige gar nicht', () => {
    const games = { 1: { state: 'post' }, 2: { state: 'in', period: 2, clockSeconds: 0 } }
    const r = liveStarterTotals({
      starterIds: ['1', '2'],
      projectionFor: proj({ 1: 12, 2: 8 }),
      gameFor: (id) => games[id],
    })
    expect(r.rest).toBe(4)
    expect(r.open).toBe(1)
  })

  it('ohne Spielstatus bleibt der Rest die Differenz zur Projektion', () => {
    const r = liveStarterTotals({
      starterIds: ['1', '2'],
      projectionFor: proj({ 1: 12, 2: 8 }),
      pointsFor: (id) => ({ 1: 5, 2: 9 }[id]),
    })
    expect(r).toEqual({ rest: 7, open: 1, hasGameStates: false })
  })

  it('null, wenn kein Starter irgendeine Projektion hat', () => {
    expect(liveStarterTotals({ starterIds: ['4'], projectionFor: () => null })).toBeNull()
    expect(liveStarterTotals({ starterIds: [], projectionFor: () => 10 })).toBeNull()
  })
})

describe('isRuledOut', () => {
  it('erkennt eindeutige Ausfaelle aus injury_status und status', () => {
    expect(isRuledOut({ injury_status: 'Out' })).toBe(true)
    expect(isRuledOut({ injury_status: 'IR' })).toBe(true)
    expect(isRuledOut({ injury_status: 'NFI-R' })).toBe(true)
    expect(isRuledOut({ status: 'Inactive' })).toBe(true)
    expect(isRuledOut({ status: 'Injured Reserve' })).toBe(true)
    expect(isRuledOut({ status: 'Physically Unable to Perform' })).toBe(true)
  })

  it('laesst Unsicheres in Ruhe -- Questionable/Doubtful klaeren sich mit den Inactives', () => {
    expect(isRuledOut({ injury_status: 'Questionable' })).toBe(false)
    expect(isRuledOut({ injury_status: 'Doubtful' })).toBe(false)
    expect(isRuledOut({ status: 'Active', injury_status: null })).toBe(false)
    expect(isRuledOut(null)).toBe(false)
    expect(isRuledOut({})).toBe(false)
  })
})

describe('liveStarterTotals — Ausfaelle', () => {
  it('ein inaktiver Starter steuert nichts mehr bei, auch vor Kickoff', () => {
    const r = liveStarterTotals({
      starterIds: ['a', 'b'],
      projectionFor: () => 14,
      gameFor: () => ({ state: 'pre' }),
      outFor: (id) => id === 'a',
    })
    expect(r.rest).toBe(14)
    expect(r.open).toBe(1)
  })

  it('bereits erzielte Punkte bleiben stehen, wenn jemand erst spaeter ausfaellt', () => {
    // Der Stand kommt aus matchup.points, liveStarterTotals liefert nur den Rest.
    const r = liveStarterTotals({
      starterIds: ['a'],
      projectionFor: () => 14,
      pointsFor: () => 9,
      gameFor: () => ({ state: 'in', period: 2, clockSeconds: 0 }),
      outFor: () => true,
    })
    expect(r.rest).toBe(0)
    expect(r.open).toBe(0)
  })
})
