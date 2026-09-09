import { describe, it, expect } from 'vitest'
import { toFiniteOrNull, normalizePlayerName, normalizePos, signed, posColor, fantasyProsSlug, formatProjectedPts } from './formatting'

describe('toFiniteOrNull', () => {
  it('echte Zahl kommt durch', () => {
    expect(toFiniteOrNull(5)).toBe(5)
    expect(toFiniteOrNull(0)).toBe(0)
    expect(toFiniteOrNull(-3)).toBe(-3)
  })

  it('numerischer String kommt als Zahl durch', () => {
    expect(toFiniteOrNull('42')).toBe(42)
    expect(toFiniteOrNull('0')).toBe(0)
    expect(toFiniteOrNull('-7')).toBe(-7)
  })

  it('null ergiebt null', () => {
    expect(toFiniteOrNull(null)).toBeNull()
  })

  it('undefined ergiebt null', () => {
    expect(toFiniteOrNull(undefined)).toBeNull()
  })

  it('leerer String ergiebt null', () => {
    expect(toFiniteOrNull('')).toBeNull()
  })

  it('nicht-numerischer String ergiebt null', () => {
    expect(toFiniteOrNull('abc')).toBeNull()
    expect(toFiniteOrNull('foo123')).toBeNull()
  })

  it('0 bleibt 0 und wird nicht zu null (Regression)', () => {
    // Das ist der kritische Fall: ein naiver if (!v) Guard wuerde 0 zu null machen,
    // was falsch ist. pick_no = 0 sollte null sein (kein Pick), aber ecr/pick_no-Vergleiche
    // muessen mit 0 rechnen koennen, wenn 0 tatsaechlich ein gueltige Rang ist.
    expect(toFiniteOrNull(0)).toBe(0)
    expect(toFiniteOrNull('0')).toBe(0)
  })

  it('Infinity und NaN ergeben null', () => {
    expect(toFiniteOrNull(Infinity)).toBeNull()
    expect(toFiniteOrNull(-Infinity)).toBeNull()
    expect(toFiniteOrNull(NaN)).toBeNull()
  })
})

describe('signed', () => {
  it('positive Zahl bekommt ein +', () => {
    expect(signed(5)).toBe('+5')
    expect(signed(42)).toBe('+42')
  })

  it('negative Zahl behaelt ihr -', () => {
    expect(signed(-3)).toBe('-3')
    expect(signed(-10)).toBe('-10')
  })

  it('0 bleibt "0" ohne Vorzeichen', () => {
    expect(signed(0)).toBe('0')
  })

  it('Bruchwert wird gerundet', () => {
    expect(signed(3.4)).toBe('+3')
    expect(signed(3.6)).toBe('+4')
    expect(signed(-2.4)).toBe('-2')
    expect(signed(-2.6)).toBe('-3')
  })
})

describe('posColor', () => {
  it('baut die CSS-Variable aus der normalisierten Position', () => {
    expect(posColor('RB')).toBe('var(--pos-rb, #666)')
    expect(posColor('rb')).toBe('var(--pos-rb, #666)')
  })

  it('normalisiert D/ST zu def - roh waere der Ausdruck ungueltig (Regression)', () => {
    // var(--pos-d/st, #666) ist kein gueltiges CSS: der Schraegstrich bricht das
    // Ident-Token, damit faellt die ganze Deklaration weg statt auf #666.
    expect(posColor('D/ST')).toBe('var(--pos-def, #666)')
    expect(posColor('DST')).toBe('var(--pos-def, #666)')
  })

  it('leere Eingaben ergeben einen syntaktisch gueltigen Ausdruck', () => {
    expect(posColor(null)).toBe('var(--pos-, #666)')
    expect(posColor('')).toBe('var(--pos-, #666)')
  })
})

describe('fantasyProsSlug', () => {
  it('einfache Namen werden klein geschrieben und mit Bindestrich verbunden', () => {
    expect(fantasyProsSlug('Ja\'Marr Chase')).toBe('jamarr-chase')
  })

  it('streift einen eigenstaendigen Roman-Ziffern-Suffix', () => {
    expect(fantasyProsSlug('Kenneth Walker III')).toBe('kenneth-walker')
    expect(fantasyProsSlug('Robert Griffin IV')).toBe('robert-griffin')
  })

  it('laesst "v"/"ii"/"iii"/"iv" als Teil eines echten Wortes stehen (Regression)', () => {
    // Vorher: der Regex traf jedes einzelne "v" im Namen, nicht nur einen
    // eigenstaendigen Suffix -- "Devaughn Vele" wurde zu "deaughn-ele".
    expect(fantasyProsSlug('Devaughn Vele')).toBe('devaughn-vele')
    expect(fantasyProsSlug('Las Vegas Raiders')).toBe('las-vegas-raiders')
    expect(fantasyProsSlug('Calvin Ridley')).toBe('calvin-ridley')
    expect(fantasyProsSlug('Trevor Lawrence')).toBe('trevor-lawrence')
  })

  it('behaelt Jr./Sr. im Slug -- anders als Sohn/Vater waeren sonst nicht unterscheidbar', () => {
    expect(fantasyProsSlug('Marvin Harrison Jr.')).toBe('marvin-harrison-jr')
  })
})

describe('formatProjectedPts', () => {
  it('eine Nachkommastelle, fehlende Werte als Strich', () => {
    expect(formatProjectedPts(21.44)).toBe('21.4')
    expect(formatProjectedPts(7)).toBe('7.0')
    expect(formatProjectedPts(null)).toBe('–')
    expect(formatProjectedPts(undefined)).toBe('–')
    expect(formatProjectedPts(NaN)).toBe('–')
  })
})
