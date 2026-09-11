import { describe, it, expect } from 'vitest'
import { ELO_SCALE, winProbability, matchWinProbability, byeCountFor, pointsFieldFor, mulberry32, simulateSeason, aggregateOdds } from './seasonSim'

describe('winProbability', () => {
  it('delta 0 ergibt 0.5', () => {
    expect(winProbability(0)).toBe(0.5)
  })
  it('positives Delta ergibt > 0.5, symmetrisch zu negativem', () => {
    expect(winProbability(50)).toBeGreaterThan(0.5)
    expect(winProbability(50)).toBeCloseTo(1 - winProbability(-50), 10)
  })
  it('ELO_SCALE ist 45 (kalibriert, keine Schach-Skala)', () => {
    expect(ELO_SCALE).toBe(45)
  })
  it('typische Kader-Spanne (~12 Punkte) ergibt klaren Favoriten (~0.65)', () => {
    expect(winProbability(12)).toBeGreaterThan(0.6)
    expect(winProbability(12)).toBeLessThan(0.7)
  })
})

describe('byeCountFor', () => {
  it('Single-Elim-Freilose: 6->2, 8->0, 10->2, 12->4, 4->0', () => {
    expect(byeCountFor(6)).toBe(2)
    expect(byeCountFor(8)).toBe(0)
    expect(byeCountFor(10)).toBe(2)
    expect(byeCountFor(12)).toBe(4)
    expect(byeCountFor(4)).toBe(0)
  })
  it('Kleinstfaelle: 0/1/2/3 -> 0/0/0/1', () => {
    expect(byeCountFor(0)).toBe(0)
    expect(byeCountFor(1)).toBe(0)
    expect(byeCountFor(2)).toBe(0)
    expect(byeCountFor(3)).toBe(1)
  })
})

describe('matchWinProbability (R1 Dynasty-Tiebreak)', () => {
  it('ohne Totals gilt exakt die ELO-Formel', () => {
    expect(matchWinProbability(10, null, null)).toBe(winProbability(10))
    expect(matchWinProbability(0.2, null, null)).toBe(winProbability(0.2))
  })
  it('bei < 0.5 Differenz gewinnt hoeheres Total mit 0.55', () => {
    expect(matchWinProbability(0.2, 5000, 3000)).toBe(0.55)
    expect(matchWinProbability(-0.2, 3000, 5000)).toBe(0.45)
    expect(matchWinProbability(0.2, 3000, 5000)).toBe(0.45)
  })
  it('gleiche oder nicht-finite Totals fallen auf ELO zurueck', () => {
    expect(matchWinProbability(0.2, 5000, 5000)).toBe(winProbability(0.2))
    expect(matchWinProbability(0.2, NaN, 3000)).toBe(winProbability(0.2))
  })
  it('Grenze 0.5 ist strikt (0.5 -> ELO)', () => {
    expect(matchWinProbability(0.5, 5000, 3000)).toBe(winProbability(0.5))
  })
})

describe('pointsFieldFor', () => {
  it('mappt ppr/half_ppr/standard auf Sleeper-Projektionsfelder', () => {
    expect(pointsFieldFor('ppr')).toBe('pts_ppr')
    expect(pointsFieldFor('half_ppr')).toBe('pts_half_ppr')
    expect(pointsFieldFor('standard')).toBe('pts_std')
  })
  it('unbekannt/null faellt auf pts_ppr zurueck', () => {
    expect(pointsFieldFor(null)).toBe('pts_ppr')
    expect(pointsFieldFor('komisch')).toBe('pts_ppr')
  })
})

describe('mulberry32', () => {
  it('gleicher Seed ergibt gleiche Folge', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('Werte liegen in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

const strengthsByWeek = new Map([
  [1, new Map([['1', 120], ['2', 100]])],
  [2, new Map([['1', 120], ['2', 100]])],
])
const schedule = [{ week: 1, a: '1', b: '2' }, { week: 2, a: '1', b: '2' }]

describe('simulateSeason', () => {
  it('staerkeres Team gewinnt im Mittel mehr Spiele (fester Seed)', () => {
    let w1 = 0
    for (let s = 0; s < 20; s++) {
      const r = simulateSeason({ strengthsByWeek, schedule, playoffTeams: 2, seed: s })
      w1 += r.wins.get('1')
    }
    expect(w1 / 20).toBeGreaterThan(1.2)
  })
  it('liefert Champion und topSeeds nach Siegen sortiert', () => {
    const r = simulateSeason({ strengthsByWeek, schedule, playoffTeams: 2, seed: 3 })
    expect(['1', '2']).toContain(r.champion)
    expect(r.topSeeds[0]).toBe('1')
  })
  it('leerer Schedule ergibt 0 Siege und keinen Champion', () => {
    const r = simulateSeason({ strengthsByWeek, schedule: [], playoffTeams: 2, seed: 1 })
    expect(r.wins.size).toBe(0)
    expect(r.champion).toBeNull()
  })
  it('dynastyTotals aendert nichts bei klarer Staerke-Differenz', () => {
    const dt = new Map([['1', 1000], ['2', 9000]])
    const r = simulateSeason({ strengthsByWeek, schedule, playoffTeams: 2, seed: 3, dynastyTotals: dt })
    expect(r.topSeeds[0]).toBe('1')
  })
})

describe('aggregateOdds', () => {
  it('mittelt Siege und zaehlt Playoff/Bye/Title als Prozent', () => {
    const results = [
      { wins: new Map([['1', 10], ['2', 4]]), champion: '1', topSeeds: ['1', '2'] },
      { wins: new Map([['1', 8], ['2', 6]]), champion: '2', topSeeds: ['1', '2'] },
    ]
    const odds = aggregateOdds(results, { rosterIds: ['1', '2'], sims: 2 })
    expect(odds.get('1').winsAvg).toBe(9)
    expect(odds.get('1').playoffPct).toBe(100)
    expect(odds.get('1').titlePct).toBe(50)
    expect(odds.get('1').byePct).toBe(0)
    expect(odds.get('2').titlePct).toBe(50)
  })
  it('6er-Cut: Top-2-Seeds bekommen Bye-Credit, Rest nicht', () => {
    const seeds = ['1', '2', '3', '4', '5', '6']
    const results = [
      { wins: new Map(seeds.map((s) => [s, 7])), champion: '1', topSeeds: seeds },
      { wins: new Map(seeds.map((s) => [s, 7])), champion: '2', topSeeds: seeds },
    ]
    const odds = aggregateOdds(results, { rosterIds: seeds, sims: 2 })
    expect(odds.get('1').byePct).toBe(100)
    expect(odds.get('2').byePct).toBe(100)
    expect(odds.get('3').byePct).toBe(0)
    expect(odds.get('6').byePct).toBe(0)
  })
})
