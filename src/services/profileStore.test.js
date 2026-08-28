import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PROFILES_KEY, PRINCIPLES_KEY, loadProfiles, saveProfiles,
  loadPrinciples, savePrinciples,
  upsertProfileOverrides, upsertProfileStrategy,
  renameProfile, duplicateProfile, deleteProfile, createBlankProfile, rebindProfile,
  migrateLegacyProfile,
} from './profileStore'

beforeEach(() => { localStorage.clear() })

describe('loadProfiles/saveProfiles', () => {
  it('liefert eine leere Liste, wenn nichts gespeichert ist', () => {
    expect(loadProfiles()).toEqual([])
  })

  it('liefert eine leere Liste bei kaputtem JSON', () => {
    localStorage.setItem(PROFILES_KEY, '{nicht json')
    expect(loadProfiles()).toEqual([])
  })

  it('schreibt und liest zurueck', () => {
    const p = createBlankProfile('Test')
    expect(loadProfiles()).toHaveLength(1)
    expect(loadProfiles()[0].id).toBe(p.id)
  })
})

describe('createBlankProfile', () => {
  it('legt ein ungebundenes Profil mit leeren Overrides an', () => {
    const p = createBlankProfile('Mein Profil')
    expect(p.name).toBe('Mein Profil')
    expect(p.boundLeagueId).toBeNull()
    expect(p.fingerprint).toBeNull()
    expect(p.overrides.scoring_type).toBeNull()
    expect(p.strategy.summary).toBe('')
  })

  it('faellt bei leerem Namen auf "Neues Profil" zurueck', () => {
    expect(createBlankProfile('').name).toBe('Neues Profil')
  })
})

// Synthetische Profile (wie resolveProfile sie in Task 3 fuer noch nicht
// gespeicherte Treffer liefert) werden nicht ueber createBlankProfile erzeugt,
// sondern sind einfache Objekte gemaess der Profile-Shape:
function fakeProfile(over = {}) {
  return {
    id: 'prof_x', name: 'X', boundLeagueId: null, fingerprint: null,
    overrides: { scoring_type: null, superflex: null, roster_positions: null, teams: null, rounds: null, type: null, strategies: ['balanced'] },
    strategy: { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('upsertProfileOverrides', () => {
  it('persistiert ein noch nicht gespeichertes (synthetisches) Profil beim ersten Edit', () => {
    const synthetic = fakeProfile()
    expect(loadProfiles()).toHaveLength(0)
    const updated = upsertProfileOverrides(synthetic, { superflex: true })
    expect(updated.overrides.superflex).toBe(true)
    expect(loadProfiles()).toHaveLength(1)
    expect(loadProfiles()[0].id).toBe('prof_x')
  })

  it('aktualisiert ein bereits gespeichertes Profil, statt es zu duplizieren', () => {
    const p = createBlankProfile('Test')
    upsertProfileOverrides(p, { teams: 10 })
    upsertProfileOverrides({ ...p, overrides: { ...p.overrides, teams: 10 } }, { rounds: 15 })
    expect(loadProfiles()).toHaveLength(1)
    expect(loadProfiles()[0].overrides).toMatchObject({ teams: 10, rounds: 15 })
  })
})

describe('upsertProfileStrategy', () => {
  it('schreibt strategy-Patch und aktualisiert updatedAt', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
    const p = createBlankProfile('Test')
    vi.advanceTimersByTime(1)
    const updated = upsertProfileStrategy(p, { summary: 'S', rules: ['R1'], source: 'ai' })
    vi.useRealTimers()
    expect(updated.strategy.summary).toBe('S')
    expect(updated.strategy.source).toBe('ai')
    expect(updated.updatedAt).not.toBe(p.updatedAt)
  })
})

describe('renameProfile/duplicateProfile/deleteProfile', () => {
  it('benennt um', () => {
    const p = createBlankProfile('Alt')
    renameProfile(p.id, 'Neu')
    expect(loadProfiles()[0].name).toBe('Neu')
  })

  it('dupliziert ohne Bindung zu uebernehmen', () => {
    const p = createBlankProfile('Original')
    rebindProfile(p.id, { leagueId: 'L1' })
    const copy = duplicateProfile(p.id)
    expect(copy.name).toBe('Original (Kopie)')
    expect(copy.boundLeagueId).toBeNull()
    expect(copy.id).not.toBe(p.id)
    expect(loadProfiles()).toHaveLength(2)
  })

  it('loescht', () => {
    const p = createBlankProfile('Weg')
    deleteProfile(p.id)
    expect(loadProfiles()).toHaveLength(0)
  })
})

describe('rebindProfile', () => {
  it('bindet an eine Liga und entfernt die Bindung beim vorherigen Halter', () => {
    const a = createBlankProfile('A')
    const b = createBlankProfile('B')
    rebindProfile(a.id, { leagueId: 'L1' })
    rebindProfile(b.id, { leagueId: 'L1' })
    const profiles = loadProfiles()
    expect(profiles.find(p => p.id === a.id).boundLeagueId).toBeNull()
    expect(profiles.find(p => p.id === b.id).boundLeagueId).toBe('L1')
  })

  it('bindet an einen Fingerprint und loescht die Liga-Bindung', () => {
    const a = createBlankProfile('A')
    rebindProfile(a.id, { leagueId: 'L1' })
    rebindProfile(a.id, { fingerprint: { draftMode: 'redraft', scoringType: 'ppr', superflex: false, teams: 12, starters: [] } })
    const updated = loadProfiles()[0]
    expect(updated.boundLeagueId).toBeNull()
    expect(updated.fingerprint.teams).toBe(12)
  })
})

describe('loadPrinciples/savePrinciples', () => {
  it('liefert leeren String ohne gespeicherten Wert', () => {
    expect(loadPrinciples()).toBe('')
  })

  it('schreibt und liest zurueck', () => {
    savePrinciples('DEF wird gestreamt.')
    expect(loadPrinciples()).toBe('DEF wird gestreamt.')
  })
})

describe('migrateLegacyProfile', () => {
  it('fuehrt sdh.setup.v2 und sdh.strategies.v1 zu einem ungebundenen Profil zusammen', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { scoring_type: 'half_ppr', superflex: true, roster_positions: null, teams: 10, rounds: 15, type: 'snake', strategies: ['zeroRB'] } }))
    localStorage.setItem('sdh.strategies.v1', JSON.stringify({
      principles: 'DEF wird gestreamt.',
      items: [{ id: 'a', label: 'A', summary: 'Leitlinie.', rules: ['R1'], sources: [], contested: [], source: 'ai', createdAt: '2026-01-01T00:00:00.000Z' }],
    }))
    migrateLegacyProfile()
    const profiles = loadProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('Migriert')
    expect(profiles[0].boundLeagueId).toBeNull()
    expect(profiles[0].fingerprint).toBeNull()
    expect(profiles[0].overrides).toMatchObject({ scoring_type: 'half_ppr', superflex: true, teams: 10, strategies: ['zeroRB'] })
    expect(profiles[0].strategy.summary).toBe('Leitlinie.')
    expect(loadPrinciples()).toBe('DEF wird gestreamt.')
  })

  it('laesst alte Keys stehen (Rollback bleibt moeglich)', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { superflex: true } }))
    migrateLegacyProfile()
    expect(localStorage.getItem('sdh.setup.v2')).not.toBeNull()
  })

  it('ist idempotent (laeuft nur, wenn noch keine Profile existieren)', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { superflex: true } }))
    migrateLegacyProfile()
    migrateLegacyProfile()
    expect(loadProfiles()).toHaveLength(1)
  })

  it('tut nichts ohne alte Keys', () => {
    migrateLegacyProfile()
    expect(loadProfiles()).toHaveLength(0)
  })
})
