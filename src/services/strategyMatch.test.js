import { describe, it, expect } from 'vitest'
import { makeFingerprint, pickStrategy, resolveStrategyText } from './strategyMatch'

const FORMAT = {
  scoringType: 'half_ppr',
  superflex: false,
  teams: 12,
  rosterPositions: ['QB','RB','RB','WR','WR','TE','FLEX','BN','BN','BN'],
}

const fp = (over = {}) => ({
  draftMode: 'redraft', scoringType: 'half_ppr', superflex: false,
  season: '2026', teams: 12, starters: ['FLEX','QB','RB','RB','TE','WR','WR'],
  ...over,
})

const item = (over = {}) => ({
  id: 'a', label: 'A', fingerprint: fp(), summary: 'Leitlinie.', rules: ['R1'],
  sources: [], contested: [], source: 'ai', createdAt: '2026-07-01T00:00:00.000Z',
  ...over,
})

describe('makeFingerprint', () => {
  it('entfernt BN und sortiert die Starter stabil', () => {
    const got = makeFingerprint({ format: FORMAT, season: 2026, draftMode: 'redraft' })
    expect(got.starters).toEqual(['FLEX','QB','RB','RB','TE','WR','WR'])
  })

  it('normalisiert season zu String, teams zu Number, superflex zu Boolean', () => {
    const got = makeFingerprint({
      format: { ...FORMAT, teams: '12', superflex: 1 },
      season: 2026,
      draftMode: 'redraft',
    })
    expect(got.season).toBe('2026')
    expect(got.teams).toBe(12)
    expect(got.superflex).toBe(true)
  })
})

describe('pickStrategy — harter Filter', () => {
  it('waehlt eine Dynasty-Strategie nie im Redraft', () => {
    const items = [item({ fingerprint: fp({ draftMode: 'rookie' }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })

  it('schliesst abweichendes Scoring aus', () => {
    const items = [item({ fingerprint: fp({ scoringType: 'ppr' }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })

  it('schliesst abweichendes Superflex aus', () => {
    const items = [item({ fingerprint: fp({ superflex: true }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })

  it('schliesst eine andere Saison aus', () => {
    const items = [item({ fingerprint: fp({ season: '2025' }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })
})

describe('pickStrategy — weiche Auswahl', () => {
  it('liefert bei exaktem Treffer keine Abweichungen', () => {
    const got = pickStrategy([item()], fp())
    expect(got.item.id).toBe('a')
    expect(got.deviations).toEqual([])
  })

  it('bevorzugt den Kandidaten mit weniger Abweichungen', () => {
    const items = [
      item({ id: 'weit', fingerprint: fp({ teams: 8, starters: ['QB','RB','WR'] }) }),
      item({ id: 'nah',  fingerprint: fp({ teams: 10 }) }),
    ]
    const got = pickStrategy(items, fp())
    expect(got.item.id).toBe('nah')
    expect(got.deviations).toHaveLength(1)
    expect(got.deviations[0]).toContain('10')
  })

  it('nimmt bei Gleichstand den juengeren Eintrag', () => {
    const items = [
      item({ id: 'alt',  createdAt: '2026-01-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
      item({ id: 'neu',  createdAt: '2026-06-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
    ]
    expect(pickStrategy(items, fp()).item.id).toBe('neu')
  })
})

describe('pickStrategy — Wildcard', () => {
  it('gewinnt nur, wenn kein echter Treffer existiert', () => {
    const wild = item({ id: 'wild', fingerprint: null })
    expect(pickStrategy([wild], fp()).item.id).toBe('wild')
    expect(pickStrategy([wild, item({ id: 'echt' })], fp()).item.id).toBe('echt')
  })
})

describe('resolveStrategyText', () => {
  const store = { version: 1, principles: 'DEF wird gestreamt.', items: [item()] }

  it('enthaelt Grundsaetze und Regeln, aber keine Quellen', () => {
    const text = resolveStrategyText(
      { ...store, items: [item({ sources: [{ title: 'FP', url: 'https://fantasypros.com/x' }] })] },
      fp(),
    )
    expect(text).toContain('DEF wird gestreamt.')
    expect(text).toContain('Leitlinie.')
    expect(text).toContain('R1')
    expect(text).not.toContain('fantasypros.com')
  })

  it('liefert nur die Grundsaetze, wenn keine Strategie passt', () => {
    const text = resolveStrategyText(store, fp({ season: '2099' }))
    expect(text).toBe('DEF wird gestreamt.')
  })

  it('kappt bei 4000 Zeichen', () => {
    const long = item({ rules: ['x'.repeat(5000)] })
    const text = resolveStrategyText({ ...store, items: [long] }, fp())
    expect(text.length).toBe(4000)
  })

  it('kommt mit leerem Store klar', () => {
    expect(resolveStrategyText({ version: 1, principles: '', items: [] }, fp())).toBe('')
  })
})
