import { describe, it, expect } from 'vitest'
import { computeMatchupProbability } from './matchupProbability'

describe('computeMatchupProbability', () => {
  it('liefert null, wenn eine Seite keine Projektion hat', () => {
    expect(computeMatchupProbability({ myPoints: 10, myProjected: null, opponentPoints: 5, opponentProjected: 100 })).toBeNull()
    expect(computeMatchupProbability({ myPoints: 10, myProjected: 100, opponentPoints: 5, opponentProjected: null })).toBeNull()
  })

  it('gleiche Projektion und gleicher Punktestand -> 50%', () => {
    const r = computeMatchupProbability({ myPoints: 20, myProjected: 100, opponentPoints: 20, opponentProjected: 100 })
    expect(r.myWinPct).toBe(50)
    expect(r.myFinal).toBe(100)
    expect(r.oppFinal).toBe(100)
  })

  it('Endstand faellt nie unter das bereits Erzielte', () => {
    const r = computeMatchupProbability({ myPoints: 130, myProjected: 100, opponentPoints: 20, opponentProjected: 100 })
    expect(r.myFinal).toBe(130)
    expect(r.myWinPct).toBeGreaterThan(50)
  })

  it('klarer Projektions-Vorsprung ergibt hohe Gewinnwahrscheinlichkeit, aber gekappt bei 99', () => {
    const r = computeMatchupProbability({ myPoints: 0, myProjected: 300, opponentPoints: 0, opponentProjected: 50 })
    expect(r.myWinPct).toBe(99)
  })

  it('klarer Rueckstand ist bei 1% gekappt', () => {
    const r = computeMatchupProbability({ myPoints: 0, myProjected: 50, opponentPoints: 0, opponentProjected: 300 })
    expect(r.myWinPct).toBe(1)
  })
})
