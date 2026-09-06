import { describe, it, expect } from 'vitest'
import { toFiniteOrNull, normalizePlayerName, normalizePos, signed } from './formatting'

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
