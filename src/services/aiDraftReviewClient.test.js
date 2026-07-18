import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildDraftReviewContext, buildDraftReviewPayload, callAiDraftReview } from './aiDraftReviewClient'

const baseCtxArgs = {
  league: { league_id: 'l1', name: 'Test', total_rosters: 10, roster_positions: ['QB','RB'], scoring_settings: { rec: 0 }, draft_order: { u1: 1 } },
  picks: [{ pick_no: 1, round: 1, picked_by: 'u1', metadata: { first_name: 'Bijan', last_name: 'Robinson', position: 'RB', team: 'ATL' } }],
  teamByRosterId: { 1: { owner_id: 'u1', players: [] } },
  ownerLabels: new Map([['u1', 'zmash']]),
  myOwnerId: 'u1', myRosterId: '1',
  board: { metadata: {}, players: Array.from({ length: 400 }, (_, i) => ({ id: i, name: `P${i}`, pos: 'WR', team: 'X', bye: 7, tier: 1, rk: i + 1 })) },
}

describe('buildDraftReviewContext — Diaet', () => {
  it('kappt das Board auf 300 und minifiziert die Felder', () => {
    const ctx = buildDraftReviewContext({ ...baseCtxArgs, draftMode: 'redraft' })
    expect(ctx.board.players).toHaveLength(300)
    expect(Object.keys(ctx.board.players[0]).sort()).toEqual(['name', 'pos', 'rk', 'team', 'tier'])
  })
  it('laesst draft_order weg und traegt draft_mode', () => {
    const ctx = buildDraftReviewContext({ ...baseCtxArgs, draftMode: 'rookie' })
    expect(ctx.league.draft_order).toBeUndefined()
    expect(ctx.draft_mode).toBe('rookie')
  })
})

describe('buildDraftReviewPayload — Format statt Raten', () => {
  it('kein Half-PPR-Hardcode mehr; Formatzeile aus dem Parameter', () => {
    const p = buildDraftReviewPayload({ draft_mode: 'redraft' }, { format: { scoringType: 'standard', teams: 10, isSuperflex: false } })
    expect(p.system).not.toMatch(/Half-PPR unless/)
    expect(p.system).toMatch(/standard/i)
    expect(p.system).toMatch(/10 Teams/)
    expect(p.system).toMatch(/Deutsch/)
  })
  it('verlangt lessonsForNextMock im User-Prompt', () => {
    const p = buildDraftReviewPayload({ draft_mode: 'redraft' }, { format: { scoringType: 'ppr', teams: 12, isSuperflex: true } })
    expect(p.messages[0].content).toMatch(/lessonsForNextMock/)
    expect(p.messages[0].content).not.toMatch(/myWeek1StartSit/)
  })
  it('weist das Modell an, Teams per display_name statt roher owner_id zu benennen', () => {
    // Regression: Der Review benannte Teams mit rohen Sleeper-owner-IDs
    // (z. B. "Team 848588368362205184", "Dein Team (344032843661434880)"),
    // weil der Prompt nie sagte, dass der display_name des Rosters gemeint ist.
    const p = buildDraftReviewPayload({ draft_mode: 'redraft' })
    const prompt = `${p.system}\n${p.messages[0].content}`
    expect(prompt).toContain('display_name')
    expect(prompt).toContain('owner_id')
    // Negativ-Anweisung: die rohe owner_id darf nie im Text erscheinen.
    expect(prompt).toMatch(/nie.*owner_id|owner_id.*nie/i)
  })
})

describe('callAiDraftReview — usage/model aus dem result-Event', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.removeItem('sdh_api_key')
  })

  it('gibt { parsed, usage, model } zurueck, nicht mehr nur parsed', async () => {
    localStorage.setItem('sdh_api_key', 'test-key')
    const eventPayload = {
      ok: true,
      parsed: { overallSummary: 'x' },
      usage: { input_tokens: 12, output_tokens: 3 },
      model: 'claude-sonnet-5',
    }
    const sse = `event: result\ndata: ${JSON.stringify(eventPayload)}\n\n`
    const bytes = new TextEncoder().encode(sse)
    let sent = false
    const reader = {
      read: async () => {
        if (sent) return { done: true, value: undefined }
        sent = true
        return { done: false, value: bytes }
      },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: { getReader: () => reader },
    }))

    const result = await callAiDraftReview({ system: 's', messages: [] })
    expect(result).toEqual({
      parsed: { overallSummary: 'x' },
      usage: { input_tokens: 12, output_tokens: 3 },
      model: 'claude-sonnet-5',
    })
  })
})
