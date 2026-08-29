import { describe, it, expect } from 'vitest'
import { makeFingerprint, pickProfile, resolveStrategyText } from './strategyMatch'

const FORMAT = {
  scoringType: 'half_ppr', superflex: false, teams: 12,
  rosterPositions: ['QB','RB','RB','WR','WR','TE','FLEX','BN','BN','BN'],
}

const fp = (over = {}) => ({
  draftMode: 'redraft', scoringType: 'half_ppr', superflex: false,
  teams: 12, starters: ['FLEX','QB','RB','RB','TE','WR','WR'],
  ...over,
})

const profile = (over = {}) => ({
  id: 'a', name: 'A', boundLeagueId: null, fingerprint: fp(),
  overrides: {}, strategy: {}, updatedAt: '2026-07-01T00:00:00.000Z',
  ...over,
})

describe('makeFingerprint', () => {
  it('entfernt BN und sortiert die Starter stabil', () => {
    const got = makeFingerprint({ format: FORMAT, draftMode: 'redraft' })
    expect(got.starters).toEqual(['FLEX','QB','RB','RB','TE','WR','WR'])
  })

  it('normalisiert teams zu Number, superflex zu Boolean, kennt kein season-Feld', () => {
    const got = makeFingerprint({ format: { ...FORMAT, teams: '12', superflex: 1 }, draftMode: 'redraft' })
    expect(got.teams).toBe(12)
    expect(got.superflex).toBe(true)
    expect(got.season).toBeUndefined()
  })
})

describe('pickProfile — harter Filter', () => {
  it('waehlt ein Rookie-Profil nie im Redraft', () => {
    const profiles = [profile({ fingerprint: fp({ draftMode: 'rookie' }) })]
    expect(pickProfile(profiles, fp())).toBeNull()
  })

  it('schliesst abweichendes Scoring aus', () => {
    const profiles = [profile({ fingerprint: fp({ scoringType: 'ppr' }) })]
    expect(pickProfile(profiles, fp())).toBeNull()
  })

  it('schliesst abweichendes Superflex aus', () => {
    const profiles = [profile({ fingerprint: fp({ superflex: true }) })]
    expect(pickProfile(profiles, fp())).toBeNull()
  })
})

describe('pickProfile — weiche Auswahl', () => {
  it('liefert bei exaktem Treffer keine Abweichungen', () => {
    const got = pickProfile([profile()], fp())
    expect(got.profile.id).toBe('a')
    expect(got.deviations).toEqual([])
  })

  it('bevorzugt den Kandidaten mit weniger Abweichungen', () => {
    const profiles = [
      profile({ id: 'weit', fingerprint: fp({ teams: 8, starters: ['QB','RB','WR'] }) }),
      profile({ id: 'nah', fingerprint: fp({ teams: 10 }) }),
    ]
    const got = pickProfile(profiles, fp())
    expect(got.profile.id).toBe('nah')
    expect(got.deviations).toHaveLength(1)
    expect(got.deviations[0]).toContain('10')
  })

  it('nimmt bei Gleichstand das zuletzt aktualisierte Profil', () => {
    const profiles = [
      profile({ id: 'alt', updatedAt: '2026-01-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
      profile({ id: 'neu', updatedAt: '2026-06-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
    ]
    expect(pickProfile(profiles, fp()).profile.id).toBe('neu')
  })
})

describe('pickProfile — Wildcard (migriertes Profil ohne Fingerprint)', () => {
  it('gewinnt nur, wenn kein echter Treffer existiert', () => {
    const wild = profile({ id: 'wild', fingerprint: null })
    expect(pickProfile([wild], fp()).profile.id).toBe('wild')
    expect(pickProfile([wild, profile({ id: 'echt' })], fp()).profile.id).toBe('echt')
  })
})

describe('pickProfile — Randfaelle', () => {
  it('liefert null ohne Profile oder ohne Fingerprint', () => {
    expect(pickProfile([], fp())).toBeNull()
    expect(pickProfile([profile()], null)).toBeNull()
  })
})

describe('resolveStrategyText', () => {
  it('enthaelt Grundsaetze, Leitlinie und Regeln, aber keine Quellen', () => {
    const text = resolveStrategyText('DEF wird gestreamt.', { summary: 'Leitlinie.', rules: ['R1'], sources: [{ title: 'FP', url: 'https://fantasypros.com/x' }] })
    expect(text).toContain('DEF wird gestreamt.')
    expect(text).toContain('Leitlinie.')
    expect(text).toContain('R1')
    expect(text).not.toContain('fantasypros.com')
  })

  it('liefert nur die Grundsaetze, wenn keine Strategie hinterlegt ist', () => {
    expect(resolveStrategyText('DEF wird gestreamt.', { summary: '', rules: [] })).toBe('DEF wird gestreamt.')
  })

  it('kappt bei 4000 Zeichen', () => {
    const text = resolveStrategyText('', { summary: '', rules: ['x'.repeat(5000)] })
    expect(text.length).toBe(4000)
  })

  it('kommt mit leeren Eingaben klar', () => {
    expect(resolveStrategyText('', { summary: '', rules: [] })).toBe('')
    expect(resolveStrategyText(null, null)).toBe('')
  })
})
