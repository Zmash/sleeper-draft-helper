import { describe, it, expect } from 'vitest'
import { validateAdvice, validateTradeSuggestions } from './aiValidate'
import { normalizePlayerName } from '../utils/formatting'

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

// Deckt die tragende Normalisierung explizit ab: das Set entsteht — wie in der
// echten UI — aus `normalizePlayerName`, damit die Tests die reale Pipeline
// pruefen und nicht eine Wunsch-Normalisierung.
describe('validateAdvice — Normalisierung & robuste Eingaben', () => {
  it('erkennt Board-Namen unabhaengig von Gross-/Kleinschreibung', () => {
    const board = new Set(['Bijan Robinson', 'Puka Nacua'].map(normalizePlayerName))
    const parsed = {
      primary: P('BIJAN ROBINSON'),
      alternatives: [P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [], plan_next_picks: [],
    }
    const { cleaned, warnings } = validateAdvice(parsed, board)
    expect(cleaned).not.toBeNull()
    expect(cleaned.primary.player_nname).toBe('BIJAN ROBINSON')
    expect(cleaned.alternatives).toHaveLength(1)
    expect(warnings).toEqual([])
  })

  it('matcht Initialen mit und ohne Punkte (P.J. Walker <-> PJ Walker)', () => {
    const fromDotted = new Set(['P.J. Walker'].map(normalizePlayerName))
    const r1 = validateAdvice({ primary: P('PJ Walker'), alternatives: [], survival: [], plan_next_picks: [] }, fromDotted)
    expect(r1.cleaned).not.toBeNull()
    expect(r1.warnings).toEqual([])

    const fromPlain = new Set(['PJ Walker'].map(normalizePlayerName))
    const r2 = validateAdvice({ primary: P('P.J. Walker'), alternatives: [], survival: [], plan_next_picks: [] }, fromPlain)
    expect(r2.cleaned).not.toBeNull()
    expect(r2.warnings).toEqual([])
  })

  it('kollabiert nicht zwei verschiedene Spieler auf denselben Schluessel', () => {
    // 'P.J. Walker' -> 'pj walker'; ein anderer Walker darf NICHT durchrutschen.
    const board = new Set(['P.J. Walker'].map(normalizePlayerName))
    const { cleaned, warnings } = validateAdvice({ primary: P('Kenny Walker'), alternatives: [], survival: [], plan_next_picks: [] }, board)
    expect(cleaned).toBeNull()
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('verwirft einen erfundenen Namen und behaelt den echten (Gegenrichtung)', () => {
    const board = new Set(['Bijan Robinson', 'Puka Nacua'].map(normalizePlayerName))
    const parsed = {
      primary: P('Bijan Robinson'),
      alternatives: [P('Zzz Phantom', { tradeoff_vs_primary: 'y' }), P('Puka Nacua', { tradeoff_vs_primary: 'y' })],
      survival: [], plan_next_picks: [],
    }
    const { cleaned, warnings } = validateAdvice(parsed, board)
    expect(cleaned.primary.player_nname).toBe('Bijan Robinson')
    expect(cleaned.alternatives.map(a => a.player_nname)).toEqual(['Puka Nacua'])
    expect(warnings.some(w => w.includes('Zzz Phantom'))).toBe(true)
  })

  it('wirft nicht bei parsed === null', () => {
    const board = new Set(['Bijan Robinson'].map(normalizePlayerName))
    const { cleaned, warnings } = validateAdvice(null, board)
    expect(cleaned).toBeNull()
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('wirft nicht, wenn alternatives/survival/plan_next_picks fehlen', () => {
    const board = new Set(['Bijan Robinson'].map(normalizePlayerName))
    const { cleaned, warnings } = validateAdvice({ primary: P('Bijan Robinson') }, board)
    expect(cleaned).not.toBeNull()
    expect(cleaned.alternatives).toEqual([])
    expect(cleaned.survival).toEqual([])
    expect(cleaned.plan_next_picks).toEqual([])
    expect(warnings).toEqual([])
  })
})

describe('validateTradeSuggestions — Suffixe & robuste Eingaben', () => {
  const oppMap = new Map([['team blitz', {
    players: [{ name: 'Puka Nacua', nname: normalizePlayerName('Puka Nacua'), dynasty_value: 8000 }],
    picks: [],
  }]])

  it('matcht Spieler mit und ohne Suffix (Marvin Harrison Jr. <-> Marvin Harrison)', () => {
    // nname wie in der echten Pipeline aus normalizePlayerName gebildet.
    const myJr = { players: [{ name: 'Marvin Harrison Jr.', nname: normalizePlayerName('Marvin Harrison Jr.'), dynasty_value: 7000 }], picks: [] }
    const r1 = validateTradeSuggestions(
      { suggestions: [{ opponent: 'Team Blitz', you_give: ['Marvin Harrison'], you_get: ['Puka Nacua'], rationale: 'r' }] },
      { myAssets: myJr, opponentAssetsByName: oppMap },
    )
    expect(r1.cleaned.suggestions).toHaveLength(1)
    expect(r1.cleaned.suggestions[0].value_you_give).toBe(7000)
    expect(r1.warnings).toEqual([])

    const myPlain = { players: [{ name: 'Marvin Harrison', nname: normalizePlayerName('Marvin Harrison'), dynasty_value: 7000 }], picks: [] }
    const r2 = validateTradeSuggestions(
      { suggestions: [{ opponent: 'Team Blitz', you_give: ['Marvin Harrison Jr.'], you_get: ['Puka Nacua'], rationale: 'r' }] },
      { myAssets: myPlain, opponentAssetsByName: oppMap },
    )
    expect(r2.cleaned.suggestions).toHaveLength(1)
    expect(r2.cleaned.suggestions[0].value_you_give).toBe(7000)
    expect(r2.warnings).toEqual([])
  })

  it('sortiert sauber aus, wenn myAssets fehlt (kein Wurf)', () => {
    const parsed = { suggestions: [{ opponent: 'Team Blitz', you_give: ['Bijan Robinson'], you_get: ['Puka Nacua'], rationale: 'r' }] }
    const { cleaned, warnings } = validateTradeSuggestions(parsed, { myAssets: undefined, opponentAssetsByName: oppMap })
    expect(cleaned.suggestions).toEqual([])
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('wirft nicht, wenn suggestions und opponentAssetsByName fehlen', () => {
    const { cleaned, warnings } = validateTradeSuggestions({ team_summary: 's' }, { myAssets: undefined, opponentAssetsByName: undefined })
    expect(cleaned.suggestions).toEqual([])
    expect(warnings).toEqual([])
  })
})
