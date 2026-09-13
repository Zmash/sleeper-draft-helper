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
    const kCtx = JSON.parse(k.messages[0].content.replace(/^[^{]*/, ''))
    expect(kCtx.league.keeper).toBe(true)
    // Keeper nutzt Dynasty-Werte (resolveDraftMode-Konvention) -- muss der KI auch als
    // dynasty gezeigt werden, sonst widerspricht das Format-Label der Wertequelle.
    expect(kCtx.league.format).toBe('dynasty')
  })
  it('Redraft-Prompt laesst Picks-/Profil-Saetze weg, Dynasty-Prompt behaelt sie', () => {
    const redraftEval = { ...evalResult, profile: null, avgAge: null }
    const r = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult: redraftEval, dynastyRoster: [], league: redraftLeague })
    const d = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: dynastyLeague })
    expect(r.system).not.toMatch(/Team-Profil/)
    expect(r.system).not.toMatch(/zukuenftige Picks/)
    expect(d.system).toMatch(/Team-Profil/)
    expect(d.system).toMatch(/zukuenftige Picks/)
    const rCtx = JSON.parse(r.messages[0].content.replace(/^[^{]*/, ''))
    expect(rCtx.your_team.profile).toBeUndefined()
    expect(rCtx.value_scale_note).toMatch(/market_value/)
    const dCtx = JSON.parse(d.messages[0].content.replace(/^[^{]*/, ''))
    expect(dCtx.your_team.profile).toBe('balanced')
    expect(dCtx.value_scale_note).toMatch(/dynasty_value/)
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
