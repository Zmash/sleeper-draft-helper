import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateCostUsd, formatTokens, formatEstimate, formatUsage } from './aiCost'

describe('aiCost', () => {
  it('schaetzt Tokens grob als Zeichen/4', () => {
    expect(estimateTokens({ a: 'x'.repeat(396) })).toBe(Math.round(404 / 4)) // JSON: {"a":"xxx…"}
  })
  it('rechnet Kosten aus der Preistabelle', () => {
    const usd = estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 0, model: 'claude-sonnet-5' })
    expect(usd).toBeGreaterThan(0)
  })
  it('formatiert Tokens mit deutschem Komma', () => {
    expect(formatTokens(9234)).toBe('9,2k')
    expect(formatTokens(412)).toBe('412')
    expect(formatTokens(null)).toBe('—')
  })
  it('formatiert die Schaetzung fuer den Button', () => {
    expect(formatEstimate({ x: 'y'.repeat(4000) }, 'claude-sonnet-5')).toMatch(/^≈ 1,0k Tokens · ~0,0\d \$$/)
  })
  it('formatiert echten Verbrauch inkl. Cache', () => {
    const s = formatUsage({ input_tokens: 9234, output_tokens: 811, cache_read_input_tokens: 2100 }, 'claude-sonnet-5')
    expect(s).toContain('9,2k in')
    expect(s).toContain('0,8k out')
    expect(s).toContain('Cache 2,1k')
    expect(s).toMatch(/~\d+,\d\d \$/)
  })
  it('usage null ⇒ leerer String, kein Wurf', () => {
    expect(formatUsage(null, 'claude-sonnet-5')).toBe('')
  })
})
