import { describe, it, expect } from 'vitest'
import { normalizeStandings, collectEntries } from './espnStandings'

const entry = (abbr, stats, team = {}) => ({
  team: { abbreviation: abbr, shortDisplayName: abbr, logos: [{ href: `${abbr}.png` }], ...team },
  stats,
})
const stat = (name, value, displayValue) => ({ name, value, displayValue })

const FULL = [
  stat('wins', 2), stat('losses', 1), stat('ties', 0),
  stat('winPercent', 0.667, '.667'),
  stat('pointsFor', 70), stat('pointsAgainst', 55),
  stat('differential', 15, '+15'),
  stat('streak', 2, 'W2'), stat('vsDiv', null, '1-0'), stat('playoffSeed', 3),
]

describe('collectEntries', () => {
  it('findet Eintraege auf jeder Verschachtelungstiefe', () => {
    const conferenceShape = { children: [{ standings: { entries: [entry('CIN', FULL)] } }] }
    const divisionShape = { children: [{ children: [{ standings: { entries: [entry('BAL', FULL)] } }] }] }
    const flatShape = { entries: [entry('PIT', FULL)] }
    expect(collectEntries(conferenceShape)).toHaveLength(1)
    expect(collectEntries(divisionShape)).toHaveLength(1)
    expect(collectEntries(flatShape)).toHaveLength(1)
  })

  it('ignoriert Muell statt zu werfen', () => {
    expect(collectEntries(null)).toEqual([])
    expect(collectEntries({ children: 'nope', entries: [{ kein: 'team' }] })).toEqual([])
  })
})

describe('normalizeStandings', () => {
  it('liest Bilanz, Punkte, Differenz, Serie und Setzplatz', () => {
    const [r] = normalizeStandings({ children: [{ standings: { entries: [entry('CIN', FULL)] } }] })
    expect(r).toEqual({
      abbr: 'CIN', name: 'CIN', logo: 'CIN.png',
      wins: 2, losses: 1, ties: 0, played: 3, winPercent: 0.667,
      pointsFor: 70, pointsAgainst: 55, differential: 15,
      streak: 'W2', divisionRecord: '1-0', playoffSeed: 3,
    })
  })

  it('normalisiert WSH auf WAS, damit die Divisionstabelle greift', () => {
    const [r] = normalizeStandings({ entries: [entry('WSH', FULL)] })
    expect(r.abbr).toBe('WAS')
  })

  it('nimmt ein Team nur einmal, auch wenn es doppelt im Baum haengt', () => {
    const e = entry('CIN', FULL)
    const rows = normalizeStandings({ children: [
      { standings: { entries: [e] } },
      { children: [{ standings: { entries: [e] } }] },
    ] })
    expect(rows.map((r) => r.abbr)).toEqual(['CIN'])
  })

  it('rechnet Siegquote und Differenz selbst, wenn ESPN sie nicht liefert', () => {
    const [r] = normalizeStandings({ entries: [entry('BAL', [
      stat('wins', 3), stat('losses', 1), stat('pointsFor', 100), stat('pointsAgainst', 80),
    ])] })
    expect(r.winPercent).toBeCloseTo(0.75)
    expect(r.differential).toBe(20)
    expect(r.ties).toBe(0)
  })

  it('zaehlt Unentschieden halb in die Siegquote', () => {
    const [r] = normalizeStandings({ entries: [entry('PIT', [stat('wins', 1), stat('losses', 1), stat('ties', 1)])] })
    expect(r.winPercent).toBeCloseTo(0.5)
    expect(r.played).toBe(3)
  })

  it('bleibt bei fehlenden Kennzahlen bei null statt NaN', () => {
    const [r] = normalizeStandings({ entries: [entry('TEN', [])] })
    expect(r).toMatchObject({ wins: 0, losses: 0, played: 0, winPercent: 0, differential: null, streak: null })
  })

  it('liefert [] bei kaputter Antwort', () => {
    expect(normalizeStandings(null)).toEqual([])
    expect(normalizeStandings({})).toEqual([])
  })
})
