import { describe, it, expect } from 'vitest'
import { standingsRankFor } from './standings'

const ROSTERS = [
  { roster_id: 1, settings: { wins: 2, fpts: 210, fpts_decimal: 40 } },
  { roster_id: 2, settings: { wins: 3, fpts: 190, fpts_decimal: 0 } },
  { roster_id: 3, settings: { wins: 2, fpts: 210, fpts_decimal: 90 } },
]

describe('standingsRankFor', () => {
  it('sortiert nach Siegen, bei Gleichstand nach Punkten', () => {
    expect(standingsRankFor(ROSTERS, 2)).toBe(1)
    expect(standingsRankFor(ROSTERS, 3)).toBe(2)
    expect(standingsRankFor(ROSTERS, 1)).toBe(3)
  })

  it('beruecksichtigt fpts_decimal als Nachkommastellen', () => {
    const knapp = [
      { roster_id: 1, settings: { wins: 1, fpts: 100, fpts_decimal: 10 } },
      { roster_id: 2, settings: { wins: 1, fpts: 100, fpts_decimal: 90 } },
    ]
    expect(standingsRankFor(knapp, 2)).toBe(1)
  })

  it('laesst die Eingabe unveraendert', () => {
    const order = ROSTERS.map((r) => r.roster_id)
    standingsRankFor(ROSTERS, 1)
    expect(ROSTERS.map((r) => r.roster_id)).toEqual(order)
  })

  it('null bei fehlenden Daten oder unbekanntem Roster', () => {
    expect(standingsRankFor([], 1)).toBeNull()
    expect(standingsRankFor(ROSTERS, null)).toBeNull()
    expect(standingsRankFor(ROSTERS, 99)).toBeNull()
  })
})
