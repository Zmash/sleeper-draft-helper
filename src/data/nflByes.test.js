import { describe, it, expect } from 'vitest'
import { NFL_BYES, byeWeekForTeam } from './nflByes'

describe('byeWeekForTeam', () => {
  it('deckt alle 32 Teams der Saison 2026 ab', () => {
    expect(Object.keys(NFL_BYES[2026])).toHaveLength(32)
    for (const bye of Object.values(NFL_BYES[2026])) {
      expect(bye).toBeGreaterThanOrEqual(5)
      expect(bye).toBeLessThanOrEqual(14)
    }
  })
  it('Stichproben: KC=5, BUF=7, NE=11, DAL=14', () => {
    expect(byeWeekForTeam('KC', 2026)).toBe(5)
    expect(byeWeekForTeam('BUF', 2026)).toBe(7)
    expect(byeWeekForTeam('NE', 2026)).toBe(11)
    expect(byeWeekForTeam('DAL', 2026)).toBe(14)
  })
  it('JAC-Alias (FantasyPros-Schreibweise) mappt auf JAX', () => {
    expect(byeWeekForTeam('JAC', 2026)).toBe(byeWeekForTeam('JAX', 2026))
  })
  it('unbekanntes Team und unbekannte Saison geben null', () => {
    expect(byeWeekForTeam('XXX', 2026)).toBeNull()
    expect(byeWeekForTeam('KC', 1999)).toBeNull()
    expect(byeWeekForTeam(null, 2026)).toBeNull()
  })
})
