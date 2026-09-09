import { describe, it, expect } from 'vitest'
import { boardKeyFor } from './boardKey'

describe('boardKeyFor', () => {
  it('Liga-Key enthält Liga-ID und Modus', () => {
    expect(boardKeyFor({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'redraft',
    })).toBe('league:L1:redraft')
  })
  it('gleiche Liga, anderer Modus = anderer Key', () => {
    const a = boardKeyFor({ league: { league_id: 'L1' }, draft: { draft_id: 'D1', league_id: 'L1' }, draftMode: 'redraft' })
    const b = boardKeyFor({ league: { league_id: 'L1' }, draft: { draft_id: 'D1', league_id: 'L1' }, draftMode: 'rookie' })
    expect(a).not.toBe(b)
  })
  it('Standalone-Key enthält Fingerprint + Modus (stabil)', () => {
    const draft = { draft_id: 'M1', league_id: null, settings: { teams: 12, rounds: 15 }, metadata: { scoring_type: 'ppr' } }
    const a = boardKeyFor({ league: { league_id: 'L9' }, draft, draftMode: 'redraft' })
    const b = boardKeyFor({ league: null, draft, draftMode: 'redraft' })
    expect(a).toBe(b)
    expect(a.startsWith('fp:')).toBe(true)
    expect(a.endsWith(':redraft')).toBe(true)
  })
  it('Wildcard mit fremdem mode wird nicht gepickt', async () => {
    const { pickProfile } = await import('./strategyMatch.js')
    const fp = { draftMode: 'rookie', scoringType: 'ppr', superflex: false, teams: 12, starters: [] }
    const res = pickProfile([{ id: 'w', fingerprint: null, mode: 'redraft', updatedAt: '2026-01-01' }], fp)
    expect(res).toBeNull()
  })
})
