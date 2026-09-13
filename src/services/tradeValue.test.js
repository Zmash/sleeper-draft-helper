import { describe, it, expect } from 'vitest'
import { evaluateTrade } from './tradeValue'

const youngRoster = [
  { slot: 'starter', age: 23 },
  { slot: 'starter', age: 22 },
  { slot: 'starter', age: 24 },
]

const give = [{ id: 'p1', type: 'player', age: 23, dynasty_value: 5000 }]
const get  = [{ id: 'p2', type: 'player', age: 30, dynasty_value: 4000 }]

describe('evaluateTrade', () => {
  it('dynasty mode (default): behaves exactly as before — modifier applied, profile detected', () => {
    const result = evaluateTrade(give, get, { dynastyRoster: youngRoster })
    expect(result.profile).toBe('rebuild')
    // rebuild: young player (23) gets a premium, so adjusted_value !== dynasty_value
    expect(result.enrichedGive[0].adjusted_value).not.toBe(result.enrichedGive[0].dynasty_value)
    expect(result.avgAge).not.toBeNull()
  })

  it('isDynastyMode:true explicit matches the implicit default', () => {
    const implicit = evaluateTrade(give, get, { dynastyRoster: youngRoster })
    const explicit = evaluateTrade(give, get, { dynastyRoster: youngRoster, isDynastyMode: true })
    expect(explicit).toEqual(implicit)
  })

  it('redraft mode: no modifier, no profile, adjusted_value === dynasty_value', () => {
    const result = evaluateTrade(give, get, { dynastyRoster: youngRoster, isDynastyMode: false })
    expect(result.profile).toBeNull()
    expect(result.avgAge).toBeNull()
    for (const item of [...result.enrichedGive, ...result.enrichedGet]) {
      expect(item.modifier).toBe(1)
      expect(item.adjusted_value).toBe(item.dynasty_value)
    }
  })

  it('redraft mode: verdict thresholds still apply on raw totals', () => {
    const result = evaluateTrade(
      [{ id: 'p1', type: 'player', dynasty_value: 6000 }],
      [{ id: 'p2', type: 'player', dynasty_value: 4000 }],
      { isDynastyMode: false }
    )
    expect(result.totalGive).toBe(6000)
    expect(result.totalGet).toBe(4000)
    expect(result.verdict).toBe('losing') // ratio 1.5 > 1.25
  })
})
