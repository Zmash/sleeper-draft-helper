import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PROFILES_KEY, PRINCIPLES_KEY, loadProfiles, saveProfiles,
  loadPrinciples, savePrinciples, persistProfile,
  upsertProfileOverrides, upsertProfileStrategy,
  renameProfile, duplicateProfile, deleteProfile, createBlankProfile, rebindProfile,
  unbindLeague, leagueIdsOf,
  migrateLegacyProfile, migrateProfilesToMode, resolveProfile, computeDetectedFingerprint,
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
    expect(p.boundLeagueIds).toEqual([])
    expect('boundLeagueId' in p).toBe(false)
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
    id: 'prof_x', name: 'X', boundLeagueIds: [], fingerprint: null,
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
    expect(leagueIdsOf(copy)).toEqual([])
    expect(copy.fingerprint).toBeNull()
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
  it('entfernt die Liga beim vorherigen Halter desselben Modus (eine Liga = ein Profil pro Modus)', () => {
    const a = createBlankProfile('A')
    const b = createBlankProfile('B')
    rebindProfile(a.id, { leagueId: 'L1' })
    rebindProfile(b.id, { leagueId: 'L1' })
    const profiles = loadProfiles()
    expect(leagueIdsOf(profiles.find(p => p.id === a.id))).toEqual([])
    expect(leagueIdsOf(profiles.find(p => p.id === b.id))).toEqual(['L1'])
  })

  it('N:1 — dasselbe Profil kann mehrere Ligen teilen (Ziel-Liste wächst, kein Überschreiben)', () => {
    const p = createBlankProfile('Shared')
    rebindProfile(p.id, { leagueId: 'LA' })
    rebindProfile(p.id, { leagueId: 'LB' })
    expect(leagueIdsOf(loadProfiles().find(x => x.id === p.id)).sort()).toEqual(['LA', 'LB'])
    for (const lid of ['LA', 'LB']) {
      const { profile, isNew } = resolveProfile({
        draft: { league_id: lid, settings: {} },
        league: { league_id: lid, name: lid },
        draftMode: 'redraft',
      })
      expect(profile.id).toBe(p.id)
      expect(isNew).toBe(false)
    }
    // Erneutes Binden derselben Liga erzeugt kein Duplikat.
    rebindProfile(p.id, { leagueId: 'LA' })
    expect(leagueIdsOf(loadProfiles().find(x => x.id === p.id)).sort()).toEqual(['LA', 'LB'])
  })

  it('bindet an einen Fingerprint und loescht die Liga-Bindung', () => {
    const a = createBlankProfile('A')
    rebindProfile(a.id, { leagueId: 'L1' })
    rebindProfile(a.id, { fingerprint: { draftMode: 'redraft', scoringType: 'ppr', superflex: false, teams: 12, starters: [] } })
    const updated = loadProfiles()[0]
    expect(leagueIdsOf(updated)).toEqual([])
    expect(updated.fingerprint.teams).toBe(12)
  })

  it('bindet an einen Fingerprint und entfernt den identischen Fingerprint beim vorherigen Halter', () => {
    const fp = { draftMode: 'redraft', scoringType: 'ppr', superflex: false, teams: 12, starters: [] }
    const a = createBlankProfile('A')
    const b = createBlankProfile('B')
    rebindProfile(a.id, { fingerprint: fp })
    rebindProfile(b.id, { fingerprint: fp })
    const profiles = loadProfiles()
    expect(profiles.find(p => p.id === a.id).fingerprint).toBeNull()
    expect(profiles.find(p => p.id === b.id).fingerprint).toEqual(fp)
  })

  it('F2: Rebind im Rookie-Modus setzt mode rookie und evictet nur das gleiche Composite', () => {
    // Gleiches Composite (Liga + rookie) wird evictet ...
    const alt = createBlankProfile('Alt')
    rebindProfile(alt.id, { leagueId: 'L1', mode: 'rookie' })
    const ziel = createBlankProfile('Ziel')
    const updated = rebindProfile(ziel.id, { leagueId: 'L1', mode: 'rookie' })
    expect(updated.mode).toBe('rookie')
    expect(leagueIdsOf(updated)).toEqual(['L1'])
    const profiles = loadProfiles()
    expect(leagueIdsOf(profiles.find(p => p.id === alt.id))).toEqual([])
    // ... aber eine zweite Liga-Bindung mit anderem Modus bleibt bestehen.
    const red = createBlankProfile('Red')
    rebindProfile(red.id, { leagueId: 'L1', mode: 'redraft' })
    rebindProfile(ziel.id, { leagueId: 'L1', mode: 'rookie' })
    const nachher = loadProfiles()
    expect(leagueIdsOf(nachher.find(p => p.id === red.id))).toEqual(['L1'])
    expect(nachher.find(p => p.id === red.id).mode).toBe('redraft')
    expect(nachher.find(p => p.id === ziel.id).mode).toBe('rookie')
  })
})

describe('leagueIdsOf (Altbestand-Kompat)', () => {
  it('liest Alt-String, neue Liste und leere Profile', () => {
    expect(leagueIdsOf({ boundLeagueId: 'L1' })).toEqual(['L1'])
    expect(leagueIdsOf({ boundLeagueIds: ['L1', 'L2'], boundLeagueId: 'L1' })).toEqual(['L1', 'L2'])
    expect(leagueIdsOf({ boundLeagueIds: [] })).toEqual([])
    expect(leagueIdsOf({})).toEqual([])
    expect(leagueIdsOf(null)).toEqual([])
  })
})

describe('unbindLeague', () => {
  it('Liga fällt danach auf Automatik zurück (isNew) + Strategie-Prefill greift', () => {
    const p = createBlankProfile('Liga-Profil')
    rebindProfile(p.id, { leagueId: 'LX', mode: 'redraft' })
    const donor = createBlankProfile('Wildcard')
    saveProfiles(loadProfiles().map(x => {
      if (x.id === donor.id) return { ...x, strategy: { summary: 'Wildcard-Strategie', rules: [], sources: [], contested: [], source: 'manual', updatedAt: '2026-03-01T00:00:00.000Z' }, updatedAt: '2026-03-01T00:00:00.000Z' }
      if (x.id === p.id) return { ...x, updatedAt: '2026-01-01T00:00:00.000Z' }
      return x
    }))
    unbindLeague('LX', 'redraft')
    expect(leagueIdsOf(loadProfiles().find(x => x.id === p.id))).toEqual([])
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'LX', settings: {} },
      league: { league_id: 'LX', name: 'LX' },
      draftMode: 'redraft',
    })
    expect(isNew).toBe(true)
    expect(profile.strategy.summary).toBe('Wildcard-Strategie')
  })

  it('berührt andere Modi nicht (Composite-Trennung)', () => {
    const red = createBlankProfile('Red')
    rebindProfile(red.id, { leagueId: 'LZ', mode: 'redraft' })
    const rook = createBlankProfile('Rook')
    rebindProfile(rook.id, { leagueId: 'LZ', mode: 'rookie' })
    unbindLeague('LZ', 'rookie')
    const nachher = loadProfiles()
    expect(leagueIdsOf(nachher.find(p => p.id === red.id))).toEqual(['LZ'])
    expect(leagueIdsOf(nachher.find(p => p.id === rook.id))).toEqual([])
  })
})

describe('computeDetectedFingerprint', () => {
  it('liefert den Fingerprint des aktuell erkannten Formats fuer einen Standalone-Mock', () => {
    const mockDraft = { league_id: null, settings: { teams: 12, rounds: 15 }, metadata: { scoring_type: 'ppr' } }
    const fp = computeDetectedFingerprint({ draft: mockDraft, league: null, draftMode: 'redraft' })
    expect(fp).toMatchObject({ teams: 12, scoringType: 'ppr', superflex: false })
  })

  it('ignoriert eine mitgegebene Liga, wenn der Draft standalone ist', () => {
    const mockDraft = { league_id: null, settings: { teams: 12, rounds: 15 }, metadata: { scoring_type: 'ppr' } }
    const league = { league_id: 'L3', total_rosters: 8 }
    const fp = computeDetectedFingerprint({ draft: mockDraft, league, draftMode: 'redraft' })
    expect(fp.teams).toBe(12) // aus dem Mock, nicht aus der 8er-Liga
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
  it('fuehrt sdh.setup.v2 und sdh.strategies.v1 zu je einem ungebundenen Profil pro Modus zusammen', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { scoring_type: 'half_ppr', superflex: true, roster_positions: null, teams: 10, rounds: 15, type: 'snake', strategies: ['zeroRB'] } }))
    localStorage.setItem('sdh.strategies.v1', JSON.stringify({
      principles: 'DEF wird gestreamt.',
      items: [{ id: 'a', label: 'A', summary: 'Leitlinie.', rules: ['R1'], sources: [], contested: [], source: 'ai', createdAt: '2026-01-01T00:00:00.000Z' }],
    }))
    migrateLegacyProfile()
    const profiles = loadProfiles()
    expect(profiles).toHaveLength(2)
    expect(profiles.map(p => p.mode).sort()).toEqual(['redraft', 'rookie'])
    expect(profiles.map(p => p.name).sort()).toEqual(['Migriert (Redraft)', 'Migriert (Rookie)'])
    expect(profiles.every(p => leagueIdsOf(p).length === 0)).toBe(true)
    expect(profiles.every(p => p.fingerprint === null)).toBe(true)
    expect(profiles.every(p => p.overrides.scoring_type === 'half_ppr')).toBe(true)
    expect(profiles[0].overrides).toMatchObject({ scoring_type: 'half_ppr', superflex: true, teams: 10, strategies: ['zeroRB'] })
    expect(profiles.every(p => p.strategy.summary === 'Leitlinie.')).toBe(true)
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
    expect(loadProfiles()).toHaveLength(2)
  })

  it('tut nichts ohne alte Keys', () => {
    migrateLegacyProfile()
    expect(loadProfiles()).toHaveLength(0)
  })
})

describe('resolveProfile — Liga-Bindung', () => {
  it('findet ein existierendes, liga-gebundenes Profil', () => {
    const p = createBlankProfile('Meine Liga')
    rebindProfile(p.id, { leagueId: 'L1' })
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L1', settings: {} },
      league: { league_id: 'L1', name: 'Meine Liga' },
      draftMode: 'redraft',
    })
    expect(profile.id).toBe(p.id)
    expect(isNew).toBe(false)
  })

  it('legt ein neues, NICHT persistiertes Profil an, wenn die Liga noch kein Profil hat', () => {
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L2', settings: {} },
      league: { league_id: 'L2', name: 'Neue Liga' },
      draftMode: 'redraft',
    })
    expect(isNew).toBe(true)
    expect(leagueIdsOf(profile)).toEqual(['L2'])
    expect(profile.name).toBe('Neue Liga')
    expect(loadProfiles()).toHaveLength(0) // kein Write als Seiteneffekt
  })
})

describe('resolveProfile — Mock/Standalone (Fingerprint)', () => {
  const mockDraft = { league_id: null, settings: { teams: 12, rounds: 15 }, metadata: { scoring_type: 'ppr' } }

  it('matched ein bestehendes Format-Profil exakt', () => {
    const p = createBlankProfile('12er PPR')
    const fp = makeFingerprintFromMock()
    rebindProfile(p.id, { fingerprint: fp })
    const { profile, deviations, isNew } = resolveProfile({ draft: mockDraft, league: null, draftMode: 'redraft' })
    expect(profile.id).toBe(p.id)
    expect(deviations).toEqual([])
    expect(isNew).toBe(false)
  })

  it('legt ein neues, unpersistiertes Profil an, wenn kein Fingerprint passt', () => {
    const { profile, isNew } = resolveProfile({ draft: mockDraft, league: null, draftMode: 'redraft' })
    expect(isNew).toBe(true)
    expect(profile.fingerprint).toMatchObject({ teams: 12, scoringType: 'ppr', superflex: false })
    expect(loadProfiles()).toHaveLength(0)
  })

  it('eine noch ausgewaehlte Liga darf einen Standalone-Mock nicht beeinflussen', () => {
    const league = { league_id: 'L3', total_rosters: 8 }
    const { profile } = resolveProfile({ draft: mockDraft, league, draftMode: 'redraft' })
    expect(leagueIdsOf(profile)).toEqual([])
    expect(profile.fingerprint.teams).toBe(12) // aus dem Mock, nicht aus der 8er-Liga
  })

  function makeFingerprintFromMock() {
    return { draftMode: 'redraft', scoringType: 'ppr', superflex: false, teams: 12, starters: ['DEF', 'FLEX', 'QB', 'RB', 'RB', 'TE', 'WR', 'WR'] }
  }
})

describe('persistProfile / modus-scharfe Liga-Bindung (Task 1)', () => {
  it('persistProfile speichert ein isNew-Liga-Profil ohne Override-Edit', () => {
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L9', settings: {} },
      league: { league_id: 'L9', name: 'Dynasty Liga' },
      draftMode: 'rookie',
    })
    expect(isNew).toBe(true)
    expect(profile.mode).toBe('rookie')
    const saved = persistProfile(profile)
    expect(loadProfiles()).toHaveLength(1)
    expect(loadProfiles()[0].id).toBe(saved.id)
    const again = resolveProfile({
      draft: { league_id: 'L9', settings: {} },
      league: { league_id: 'L9', name: 'Dynasty Liga' },
      draftMode: 'rookie',
    })
    expect(again.isNew).toBe(false)
    expect(again.profile.id).toBe(saved.id)
  })

  it('gleiche Liga, anderer Modus = anderes Profil (kein Cross-Mode-Match)', () => {
    const red = resolveProfile({
      draft: { league_id: 'L9', settings: {} },
      league: { league_id: 'L9', name: 'Liga' },
      draftMode: 'redraft',
    })
    persistProfile(red.profile)
    const rook = resolveProfile({
      draft: { league_id: 'L9', settings: {} },
      league: { league_id: 'L9', name: 'Liga' },
      draftMode: 'rookie',
    })
    expect(rook.isNew).toBe(true)
    expect(rook.profile.mode).toBe('rookie')
  })
})

describe('Strategie-Prefill aus Wildcard (Addendum v2)', () => {
  it('Vorschauprofil einer ungebundenen Liga uebernimmt die Strategie der neuesten modus-passenden Wildcard, Overrides bleiben null', () => {
    // Zwei ungebundene Redraft-Wildcards mit eindeutigen updatedAt-Staenden
    // (deterministisch — upsertProfileStrategy-Zeiten koennten kollidieren).
    const alt = createBlankProfile('Alt')
    const neu = createBlankProfile('Neu')
    saveProfiles(loadProfiles().map(p => (p.id === alt.id
      ? { ...p, strategy: { summary: 'Alt-Strategie', rules: [], sources: [], contested: [], source: 'manual', updatedAt: '2026-01-01T00:00:00.000Z' }, updatedAt: '2026-01-01T00:00:00.000Z' }
      : { ...p, strategy: { summary: 'Neu-Strategie', rules: ['R1'], sources: [], contested: [], source: 'manual', updatedAt: '2026-02-01T00:00:00.000Z' }, updatedAt: '2026-02-01T00:00:00.000Z' })))
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L9', settings: {} },
      league: { league_id: 'L9', name: 'Neue Liga' },
      draftMode: 'redraft',
    })
    expect(isNew).toBe(true)
    expect(profile.strategy.summary).toBe('Neu-Strategie')
    expect(profile.strategy.rules).toEqual(['R1'])
    expect(profile.overrides.scoring_type).toBeNull()
    expect(profile.overrides.superflex).toBeNull()
    expect(loadProfiles()).toHaveLength(2) // kein Write als Seiteneffekt
    // Deep-Copy: Edit am Vorschauprofil darf den Spender nicht anfassen.
    profile.strategy.rules.push('R2')
    expect(loadProfiles().find(p => p.id === neu.id).strategy.rules).toEqual(['R1'])
  })

  it('Wildcard mit fremdem Modus wird nicht als Spender genommen', () => {
    const fremd = createBlankProfile('Fremd', 'rookie')
    saveProfiles(loadProfiles().map(p => (p.id === fremd.id
      ? { ...p, strategy: { summary: 'Rookie-Strategie', rules: [], sources: [], contested: [], source: 'manual', updatedAt: '2026-02-01T00:00:00.000Z' }, updatedAt: '2026-02-01T00:00:00.000Z' }
      : p)))
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L9', settings: {} },
      league: { league_id: 'L9', name: 'Neue Liga' },
      draftMode: 'redraft',
    })
    expect(isNew).toBe(true)
    expect(profile.strategy.summary).toBe('')
  })

  it('ohne Wildcard bleibt die Strategie des Vorschauprofils leer', () => {
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L9', settings: {} },
      league: { league_id: 'L9', name: 'Neue Liga' },
      draftMode: 'redraft',
    })
    expect(isNew).toBe(true)
    expect(profile.strategy.summary).toBe('')
    expect(profile.strategy.rules).toEqual([])
    expect(profile.overrides.scoring_type).toBeNull()
  })
})

describe('Migration pro Modus (Task 2)', () => {
  it('migrateLegacyProfile legt pro Modus ein Profil an', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { scoring_type: 'half_ppr', superflex: true, roster_positions: null, teams: 10, rounds: 15, type: 'snake', strategies: ['zeroRB'] } }))
    migrateLegacyProfile()
    const profiles = loadProfiles()
    expect(profiles).toHaveLength(2)
    expect(profiles.map(p => p.mode).sort()).toEqual(['redraft', 'rookie'])
    expect(profiles.every(p => p.overrides.scoring_type === 'half_ppr')).toBe(true)
  })

  it('migrateProfilesToMode spaltet einzelnes fingerprint-loses Migriert-Profil auf', () => {
    localStorage.setItem(PROFILES_KEY, JSON.stringify({ version: 1, profiles: [{
      id: 'prof_alt', name: 'Migriert', boundLeagueId: null, fingerprint: null, mode: null,
      overrides: { scoring_type: 'ppr', superflex: false, roster_positions: null, teams: 12, rounds: 16, type: 'snake', strategies: ['balanced'] },
      strategy: { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null },
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }] }))
    const res = migrateProfilesToMode()
    expect(res.migrated).toBeGreaterThan(0)
    const profiles = loadProfiles()
    expect(profiles).toHaveLength(2)
    expect(profiles.map(p => p.mode).sort()).toEqual(['redraft', 'rookie'])
  })

  it('migrateProfilesToMode konvertiert Alt-boundLeagueId-String in boundLeagueIds-Liste', () => {
    localStorage.setItem(PROFILES_KEY, JSON.stringify({ version: 1, profiles: [{
      id: 'prof_legacy', name: 'Legacy', boundLeagueId: 'L5', fingerprint: null, mode: 'redraft',
      overrides: { scoring_type: 'ppr', superflex: false, roster_positions: null, teams: 12, rounds: 16, type: 'snake', strategies: ['balanced'] },
      strategy: { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null },
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    }] }))
    const res = migrateProfilesToMode()
    expect(res.migrated).toBeGreaterThan(0)
    const profiles = loadProfiles()
    expect(leagueIdsOf(profiles[0])).toEqual(['L5'])
    expect(profiles[0].boundLeagueId).toBeNull()
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L5', settings: {} },
      league: { league_id: 'L5', name: 'L5' },
      draftMode: 'redraft',
    })
    expect(isNew).toBe(false)
    expect(profile.id).toBe('prof_legacy')
  })
})

