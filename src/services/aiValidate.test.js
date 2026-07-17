import { describe, it, expect } from 'vitest'
import { validateAdvice, validateTradeSuggestions } from './aiValidate'

const avail = new Set(['bijan robinson', 'puka nacua', 'jamarr chase'])
const P = (nname, extra = {}) => ({ player_nname: nname, player_display: nname, pos: 'RB', why: 'x', ...extra })

describe('validateAdvice', () => {
  it('laesst valide Antworten unveraendert durch', () => {
    const parsed = {
      primary: P('bijan robinson'),
      alternatives: [P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [{ player_nname: 'bijan robinson', verdict: 'muenzwurf', reason: 'r' }],
      plan_next_picks: [{ pick_number: 17, target_positions: ['WR'], candidate_nnames: ['jamarr chase'], note: 'n' }],
    }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned).toEqual(parsed)
    expect(warnings).toEqual([])
  })

  it('sortiert nicht verfuegbare Alternativen aus — mit Warnung', () => {
    const parsed = {
      primary: P('bijan robinson'),
      alternatives: [P('geist spieler', { tradeoff_vs_primary: 'y' }), P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [], plan_next_picks: [],
    }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned.alternatives).toHaveLength(1)
    expect(warnings[0]).toContain('geist spieler')
  })

  it('rueckt bei invalider Empfehlung die erste valide Alternative nach', () => {
    const parsed = {
      primary: P('geist spieler'),
      alternatives: [P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [], plan_next_picks: [],
    }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned.primary.player_nname).toBe('puka nacua')
    expect(cleaned.alternatives).toHaveLength(0)
    expect(warnings.some(w => w.includes('nachgerückt'))).toBe(true)
  })

  it('alles invalide ⇒ cleaned null, Warnungen bleiben', () => {
    const parsed = { primary: P('geist'), alternatives: [P('phantom', { tradeoff_vs_primary: 'y' })], survival: [], plan_next_picks: [] }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned).toBe(null)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('filtert Survival-Eintraege und Plan-Kandidaten auf bekannte Namen', () => {
    const parsed = {
      primary: P('bijan robinson'),
      alternatives: [P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [
        { player_nname: 'bijan robinson', verdict: 'muenzwurf', reason: 'r' },
        { player_nname: 'geist', verdict: 'muenzwurf', reason: 'r' },
      ],
      plan_next_picks: [{ pick_number: 17, target_positions: ['WR'], candidate_nnames: ['geist', 'jamarr chase'], note: 'n' }],
    }
    const { cleaned } = validateAdvice(parsed, avail)
    expect(cleaned.survival).toHaveLength(1)
    expect(cleaned.plan_next_picks[0].candidate_nnames).toEqual(['jamarr chase'])
  })
})

describe('validateTradeSuggestions', () => {
  const my = {
    players: [{ name: 'Bijan Robinson', nname: 'bijan robinson', dynasty_value: 9000 }],
    picks: [{ label: '2027 1st (mid)', dynasty_value: 3000 }],
  }
  const opp = new Map([['team rakete', {
    players: [{ name: 'Puka Nacua', nname: 'puka nacua', dynasty_value: 8000 }],
    picks: [],
  }]])

  it('rechnet die Werte aus unseren Daten neu — Modell-Zahlen werden verworfen', () => {
    const parsed = { team_summary: 's', suggestions: [{
      opponent: 'Team Rakete', you_give: ['Bijan Robinson'], you_get: ['Puka Nacua'],
      value_you_give: 1, value_you_get: 999999, rationale: 'r',
    }]}
    const { cleaned, warnings } = validateTradeSuggestions(parsed, { myAssets: my, opponentAssetsByName: opp })
    expect(cleaned.suggestions[0].value_you_give).toBe(9000)
    expect(cleaned.suggestions[0].value_you_get).toBe(8000)
    expect(warnings).toEqual([])
  })

  it('sortiert Vorschlaege mit unbekannten Namen aus', () => {
    const parsed = { team_summary: 's', suggestions: [{
      opponent: 'Team Rakete', you_give: ['Erfundener Mann'], you_get: ['Puka Nacua'], rationale: 'r',
    }]}
    const { cleaned, warnings } = validateTradeSuggestions(parsed, { myAssets: my, opponentAssetsByName: opp })
    expect(cleaned.suggestions).toHaveLength(0)
    expect(warnings[0]).toContain('Erfundener Mann')
  })

  it('matcht Picks ueber das Label und unbekannte Gegner fallen durch', () => {
    const parsed = { team_summary: 's', suggestions: [
      { opponent: 'Team Rakete', you_give: ['2027 1st (mid)'], you_get: ['Puka Nacua'], rationale: 'r' },
      { opponent: 'Unbekanntes Team', you_give: ['Bijan Robinson'], you_get: ['Puka Nacua'], rationale: 'r' },
    ]}
    const { cleaned, warnings } = validateTradeSuggestions(parsed, { myAssets: my, opponentAssetsByName: opp })
    expect(cleaned.suggestions).toHaveLength(1)
    expect(cleaned.suggestions[0].value_you_give).toBe(3000)
    expect(warnings.some(w => w.includes('Unbekanntes Team'))).toBe(true)
  })
})
