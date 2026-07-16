import { describe, it, expect } from 'vitest'
import { deriveFormat, resolveDraftMode } from './draftFormat'

const draft = {
  type: 'snake',
  settings: { teams: 10, rounds: 15, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_super_flex: 1, slots_bn: 5 },
  metadata: { scoring_type: 'half_ppr' },
}
const league = {
  total_rosters: 12,
  roster_positions: ['QB', 'RB', 'WR', 'TE', 'FLEX'],
  scoring_settings: { rec: 1 },
}

describe('deriveFormat', () => {
  it('Mock ohne Liga: Format kommt aus den Draft-Settings (Regression B3)', () => {
    const f = deriveFormat({ draft, league: null, overrides: {} })
    expect(f.teams).toBe(10)
    expect(f.scoringType).toBe('half_ppr')
    expect(f.isSuperflex).toBe(true)
    expect(f.source).toBe('draft')
  })

  it('Draft schlaegt Liga', () => {
    const f = deriveFormat({ draft, league, overrides: {} })
    expect(f.teams).toBe(10)
    expect(f.scoringType).toBe('half_ppr')
  })

  it('Override schlaegt Draft', () => {
    const f = deriveFormat({ draft, league, overrides: { teams: 14, scoring_type: 'standard' } })
    expect(f.teams).toBe(14)
    expect(f.scoringType).toBe('standard')
    expect(f.source).toBe('override')
  })

  it('ohne Draft: Liga liefert Roster und Scoring', () => {
    const f = deriveFormat({ draft: null, league, overrides: {} })
    expect(f.teams).toBe(12)
    expect(f.scoringType).toBe('ppr')
    expect(f.isSuperflex).toBe(false)
    expect(f.source).toBe('league')
  })

  it('ohne alles: Defaults', () => {
    const f = deriveFormat({ draft: null, league: null, overrides: {} })
    expect(f.teams).toBe(12)
    expect(f.rounds).toBe(16)
    expect(f.type).toBe('snake')
    expect(f.scoringType).toBe('ppr')
    expect(f.source).toBe('default')
  })

  it('rosterPositions expandiert slots_* in eine Slot-Liste', () => {
    const f = deriveFormat({ draft, league: null, overrides: {} })
    expect(f.rosterPositions.filter(r => r === 'RB')).toHaveLength(2)
    expect(f.rosterPositions).toContain('SUPER_FLEX')
  })

  it('explizites superflex-Override schlaegt die Roster-Erkennung', () => {
    const f = deriveFormat({ draft, league: null, overrides: { superflex: false } })
    expect(f.isSuperflex).toBe(false)
  })
})

describe('resolveDraftMode', () => {
  // league_type wird nirgends im Code gesetzt und kommt nicht von der Sleeper-API.
  // Rohe Sleeper-Ligen tragen settings.type als Zahl (0=redraft, 1=keeper, 2=dynasty)
  // -- das ist die Konvention, die Produktionsdaten tatsaechlich liefern.
  it('Dynasty-Liga (settings.type: 2, echte Sleeper-Konvention) -> rookie', () => {
    expect(resolveDraftMode({ league: { settings: { type: 2 } }, draft: {}, current: 'redraft' })).toBe('rookie')
  })
  it('Keeper-Liga (settings.type: 1) -> rookie', () => {
    expect(resolveDraftMode({ league: { settings: { type: 1 } }, draft: {}, current: 'redraft' })).toBe('rookie')
  })
  it('Redraft-Liga (settings.type: 0) -> redraft', () => {
    expect(resolveDraftMode({ league: { settings: { type: 0 } }, draft: {}, current: 'rookie' })).toBe('redraft')
  })
  it('Fallback: angereicherte Liga mit league_type als String -> rookie', () => {
    expect(resolveDraftMode({ league: { league_type: 'dynasty' }, draft: {}, current: 'redraft' })).toBe('rookie')
  })
  it('Mock ohne Liga -> redraft, statt still auf rookie zu bleiben (Regression B6)', () => {
    expect(resolveDraftMode({ league: null, draft: { draft_id: '1' }, current: 'rookie' })).toBe('redraft')
  })
  it('weder Liga noch Draft -> aktueller Wert bleibt', () => {
    expect(resolveDraftMode({ league: null, draft: null, current: 'rookie' })).toBe('rookie')
  })
})
