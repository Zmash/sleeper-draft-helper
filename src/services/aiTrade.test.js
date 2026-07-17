import { describe, it, expect } from 'vitest'
import { buildTradeAnalysisRequest, buildTradeSuggestionsRequest } from './aiTrade'

const dynastyLeague = { settings: { type: 2 }, scoring_settings: { rec: 0 }, roster_positions: ['QB','RB'], total_rosters: 10 }
const redraftLeague = { settings: { type: 0 }, scoring_settings: { rec: 0 }, roster_positions: ['QB','RB'], total_rosters: 10 }
const evalResult = { totalGive: 1, totalGet: 1, ratio: 1, verdict: 'fair', profile: 'balanced', avgAge: 26, enrichedGive: [], enrichedGet: [] }

describe('aiTrade — ehrliches Format', () => {
  it('redraft-Liga heisst redraft, nicht dynasty', () => {
    const p = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: redraftLeague })
    const ctx = JSON.parse(p.messages[0].content.replace(/^[^{]*/, ''))
    expect(ctx.league.format).toBe('redraft')
  })
  it('settings.type wird numerisch gelesen — 2 ist dynasty, 1 ist keeper', () => {
    const p = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: dynastyLeague })
    const ctx = JSON.parse(p.messages[0].content.replace(/^[^{]*/, ''))
    expect(ctx.league.format).toBe('dynasty')
    const k = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: { ...redraftLeague, settings: { type: 1 } } })
    expect(JSON.parse(k.messages[0].content.replace(/^[^{]*/, '')).league.keeper).toBe(true)
  })
  it('Scoring kommt aus deriveFormat, nicht aus rec??1 — rec 0 ist standard', () => {
    const p = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: redraftLeague })
    const ctx = JSON.parse(p.messages[0].content.replace(/^[^{]*/, ''))
    expect(ctx.league.scoring.toLowerCase()).toContain('standard')
  })
  it('beide Prompts sind deutsch', () => {
    const a = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: dynastyLeague })
    const s = buildTradeSuggestionsRequest({ myRoster: { displayName: 'x', players: [], picks: [] }, enrichedRosters: {}, myRosterId: '1', league: dynastyLeague, profile: 'balanced' })
    expect(a.system).toMatch(/Deutsch/)
    expect(a.system).not.toMatch(/Respond in English/)
    expect(s.system).toMatch(/Deutsch/)
    expect(s.max_tokens).toBe(2500)
  })
})
