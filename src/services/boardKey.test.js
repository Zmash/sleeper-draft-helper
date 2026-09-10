import { describe, it, expect } from 'vitest'
import { boardKeyFor, boardKeyForContext } from './boardKey'

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

describe('boardKeyForContext', () => {
  it('persistiertes Profil nutzt profile:<id>', () => {
    expect(boardKeyForContext({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'redraft',
      resolved: { profile: { id: 'p123' }, isNew: false },
    })).toBe('profile:p123')
  })
  it('isNew Liga teilt das Modus-Board (redraft)', () => {
    expect(boardKeyForContext({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'redraft',
      resolved: { profile: { id: 'tmp-neu' }, isNew: true },
    })).toBe('mode:redraft')
  })
  it('isNew Liga teilt das Modus-Board (rookie)', () => {
    expect(boardKeyForContext({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'rookie',
      resolved: { profile: { id: 'tmp-neu' }, isNew: true },
    })).toBe('mode:rookie')
  })
  it('isNew Mock teilt das Modus-Board (beide Modi)', () => {
    const draft = { draft_id: 'M1', league_id: null, settings: { teams: 12, rounds: 15 }, metadata: { scoring_type: 'ppr' } }
    expect(boardKeyForContext({
      league: null, draft, draftMode: 'redraft',
      resolved: { profile: { id: 'tmp-neu' }, isNew: true },
    })).toBe('mode:redraft')
    expect(boardKeyForContext({
      league: null, draft, draftMode: 'rookie',
      resolved: { profile: { id: 'tmp-neu' }, isNew: true },
    })).toBe('mode:rookie')
  })
  it('ohne Aufloesung faellt auf das Modus-Board zurueck', () => {
    expect(boardKeyForContext({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'redraft',
    })).toBe('mode:redraft')
  })
  it('zwei verschiedene ungespeicherte Ligen teilen sich den Modus-Key', () => {
    const a = boardKeyForContext({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'redraft',
      resolved: { profile: { id: 'tmp-a' }, isNew: true },
    })
    const b = boardKeyForContext({
      league: { league_id: 'L2' },
      draft: { draft_id: 'D2', league_id: 'L2' },
      draftMode: 'redraft',
      resolved: { profile: { id: 'tmp-b' }, isNew: true },
    })
    expect(a).toBe('mode:redraft')
    expect(b).toBe('mode:redraft')
    expect(a).toBe(b)
  })
  it('gleiche Profil-ID teilt sich einen Key (ueber Ligen hinweg)', () => {
    const resolved = { profile: { id: 'p123' }, isNew: false }
    const a = boardKeyForContext({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'redraft', resolved,
    })
    const b = boardKeyForContext({
      league: { league_id: 'L2' },
      draft: { draft_id: 'D2', league_id: 'L2' },
      draftMode: 'redraft', resolved,
    })
    expect(a).toBe('profile:p123')
    expect(b).toBe('profile:p123')
  })
})
