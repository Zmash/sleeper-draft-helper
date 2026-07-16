import { describe, it, expect } from 'vitest'
import { deltaAdp, formatDeltaAdp } from './BoardTable'

describe('deltaAdp', () => {
  // Konvention adp - rk, positiv = Value. Nicht umdrehen:
  // csv.js:56 rechnet adp = ecr + ecrVsAdp, useDraftTips.js:89 nutzt adp - rk.
  it('positiv = faellt dir zu (Value)', () => {
    expect(deltaAdp({ rk: '5', adp: 20 })).toBe(15)
  })
  it('negativ = wird vor seinem Rang gezogen', () => {
    expect(deltaAdp({ rk: '20', adp: 5 })).toBe(-15)
  })
  it('ohne ADP null', () => {
    expect(deltaAdp({ rk: '5', adp: null })).toBeNull()
  })
  it('nutzt den CSV-Wert ecrVsAdp, wenn kein numerischer ADP da ist', () => {
    expect(deltaAdp({ rk: '5', adp: null, ecrVsAdp: '+3' })).toBe(3)
  })
})

describe('formatDeltaAdp', () => {
  it('Vorzeichen steht am Wert — Farbe ist nie der einzige Bedeutungstraeger', () => {
    expect(formatDeltaAdp(15)).toBe('+15')
    expect(formatDeltaAdp(-15)).toBe('-15')
  })
  it('fehlender Wert wird zum Gedankenstrich, nicht zu leer', () => {
    expect(formatDeltaAdp(null)).toBe('—')
  })
  it('rundet auf eine Nachkommastelle', () => {
    expect(formatDeltaAdp(3.14)).toBe('+3.1')
  })
})
