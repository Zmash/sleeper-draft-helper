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

describe('computeMatchupProbability — live mit Restprojektion', () => {
  it('nichts mehr offen -> 100/0 statt einer Restchance (Befund Week 1 2026)', () => {
    const r = computeMatchupProbability({
      myPoints: 97.2, myProjected: 97.2, opponentPoints: 72.8, opponentProjected: 72.8,
      myRemaining: 0, opponentRemaining: 0,
    })
    expect(r.myWinPct).toBe(100)
    expect(r.oppFinal).toBe(72.8)

    const loss = computeMatchupProbability({
      myPoints: 72.8, myProjected: 72.8, opponentPoints: 97.2, opponentProjected: 97.2,
      myRemaining: 0, opponentRemaining: 0,
    })
    expect(loss.myWinPct).toBe(0)
  })

  it('gleicher Vorsprung wird sicherer, je weniger noch aussteht', () => {
    const args = { myPoints: 90, myProjected: 110, opponentPoints: 80, opponentProjected: 100 }
    const early = computeMatchupProbability({ ...args, myRemaining: 110, opponentRemaining: 110 })
    const late = computeMatchupProbability({ ...args, myRemaining: 8, opponentRemaining: 8 })
    expect(late.myWinPct).toBeGreaterThan(early.myWinPct)
    expect(early.myWinPct).toBeGreaterThan(50)
    expect(late.myWinPct).toBeLessThanOrEqual(99)
  })

  it('bei gleichem Endstand bleibt es 50:50', () => {
    const r = computeMatchupProbability({
      myPoints: 100, myProjected: 100, opponentPoints: 100, opponentProjected: 100,
      myRemaining: 0, opponentRemaining: 0,
    })
    expect(r.myWinPct).toBe(50)
  })

  it('ohne Restangabe bleibt es bei der alten ELO-Formel (1..99)', () => {
    const r = computeMatchupProbability({ myPoints: 0, myProjected: 300, opponentPoints: 0, opponentProjected: 50 })
    expect(r.myWinPct).toBe(99)
    expect(r.remaining).toBeNull()
  })

  it('offene Woche liegt nahe an der ELO-Kalibrierung', () => {
    const live = computeMatchupProbability({
      myPoints: 0, myProjected: 112, opponentPoints: 0, opponentProjected: 100,
      myRemaining: 112, opponentRemaining: 100,
    })
    const elo = computeMatchupProbability({ myPoints: 0, myProjected: 112, opponentPoints: 0, opponentProjected: 100 })
    expect(Math.abs(live.myWinPct - elo.myWinPct)).toBeLessThanOrEqual(5)
  })
})
