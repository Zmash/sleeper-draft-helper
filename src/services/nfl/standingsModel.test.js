import { describe, it, expect } from 'vitest'
import { groupByDivision, byConference, compareRows, recordLabel, hasPlayedGames } from './standingsModel'

const row = (abbr, wins, losses, over = {}) => ({
  abbr, name: abbr, logo: null, wins, losses, ties: 0, played: wins + losses,
  winPercent: wins + losses ? wins / (wins + losses) : 0,
  pointsFor: null, pointsAgainst: null, differential: null,
  streak: null, divisionRecord: null, playoffSeed: null, ...over,
})

describe('compareRows', () => {
  it('sortiert nach Siegquote, dann Punktdifferenz', () => {
    const sorted = [row('CLE', 0, 2), row('BAL', 2, 0), row('CIN', 1, 1, { differential: 10 }), row('PIT', 1, 1, { differential: -5 })]
      .sort(compareRows)
    expect(sorted.map((r) => r.abbr)).toEqual(['BAL', 'CIN', 'PIT', 'CLE'])
  })

  it('bleibt bei voellig gleichem Stand stabil (Kuerzel als letzter Schluessel)', () => {
    const sorted = [row('PIT', 1, 1), row('CIN', 1, 1), row('BAL', 1, 1)].sort(compareRows)
    expect(sorted.map((r) => r.abbr)).toEqual(['BAL', 'CIN', 'PIT'])
  })
})

describe('recordLabel', () => {
  it('nennt Unentschieden nur, wenn es welche gibt', () => {
    expect(recordLabel(row('BAL', 2, 1))).toBe('2-1')
    expect(recordLabel({ ...row('BAL', 2, 1), ties: 1 })).toBe('2-1-1')
    expect(recordLabel(null)).toBe('')
  })
})

describe('groupByDivision', () => {
  it('verteilt alle Teams auf ihre Division und sortiert innerhalb', () => {
    const groups = groupByDivision([row('CLE', 0, 2), row('BAL', 2, 0), row('PIT', 1, 1), row('CIN', 1, 1, { differential: 9 })])
    expect(groups).toHaveLength(8)
    const north = groups.find((g) => g.id === 'afc-north')
    expect(north.title).toBe('AFC North')
    expect(north.teams.map((t) => t.abbr)).toEqual(['BAL', 'CIN', 'PIT', 'CLE'])
  })

  it('fuehrt fehlende Teams als leere Zeile statt sie zu verschlucken', () => {
    const north = groupByDivision([row('BAL', 2, 0)]).find((g) => g.id === 'afc-north')
    expect(north.teams).toHaveLength(4)
    expect(north.teams.filter((t) => t.missing).map((t) => t.abbr).sort()).toEqual(['CIN', 'CLE', 'PIT'])
  })

  it('liefert auch ohne Daten alle 8 Divisionen mit je 4 Zeilen', () => {
    const groups = groupByDivision([])
    expect(groups.flatMap((g) => g.teams)).toHaveLength(32)
  })
})

describe('byConference', () => {
  it('teilt die Divisionen in AFC und NFC', () => {
    const [afc, nfc] = byConference(groupByDivision([]))
    expect(afc.conference).toBe('AFC')
    expect(afc.groups.map((g) => g.division)).toEqual(['East', 'North', 'South', 'West'])
    expect(nfc.groups).toHaveLength(4)
  })
})

describe('hasPlayedGames', () => {
  it('erkennt eine Tabelle ohne ein einziges Spiel', () => {
    expect(hasPlayedGames([row('BAL', 0, 0)])).toBe(false)
    expect(hasPlayedGames([row('BAL', 1, 0)])).toBe(true)
    expect(hasPlayedGames([])).toBe(false)
  })
})
