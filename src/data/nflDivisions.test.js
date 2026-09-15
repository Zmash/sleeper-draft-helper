import { describe, it, expect } from 'vitest'
import { NFL_DIVISIONS, CONFERENCES, divisionForTeam } from './nflDivisions'

describe('NFL_DIVISIONS', () => {
  it('deckt genau 32 Teams in 8 Divisionen ab, jedes Team genau einmal', () => {
    const teams = NFL_DIVISIONS.flatMap((d) => d.teams)
    expect(NFL_DIVISIONS).toHaveLength(8)
    expect(teams).toHaveLength(32)
    expect(new Set(teams).size).toBe(32)
  })

  it('verteilt die Divisionen gleichmaessig auf beide Conferences', () => {
    for (const c of CONFERENCES) {
      const divs = NFL_DIVISIONS.filter((d) => d.conference === c)
      expect(divs).toHaveLength(4)
      expect(divs.map((d) => d.division).sort()).toEqual(['East', 'North', 'South', 'West'])
    }
  })

  it('nutzt Sleeper-Kuerzel, keine ESPN-Abweichungen', () => {
    const teams = NFL_DIVISIONS.flatMap((d) => d.teams)
    expect(teams).toContain('WAS') // nicht WSH
    expect(teams).toContain('JAX') // nicht JAC
    expect(teams).not.toContain('WSH')
  })

  it('findet die Division eines Teams unabhaengig von der Schreibweise', () => {
    expect(divisionForTeam('cin')).toMatchObject({ conference: 'AFC', division: 'North' })
    expect(divisionForTeam('LAR')).toMatchObject({ conference: 'NFC', division: 'West' })
    expect(divisionForTeam('XXX')).toBeNull()
    expect(divisionForTeam(null)).toBeNull()
  })
})
