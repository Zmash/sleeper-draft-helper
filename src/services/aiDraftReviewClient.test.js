import { describe, it, expect } from 'vitest'
import { buildDraftReviewContext, buildDraftReviewPayload } from './aiDraftReviewClient'

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
})
