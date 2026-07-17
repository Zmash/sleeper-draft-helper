import { describe, it, expect } from 'vitest'
import { picksUntilMyNext, countStarters } from './derive'

// Szenario aus der Bug-Meldung: 12 Teams, 3 Picks bereits gelaufen, ich habe noch nicht gepickt.
const picksNoOwnPick = [
  { pick_no: 1, picked_by: 'other-1' },
  { pick_no: 2, picked_by: 'other-2' },
  { pick_no: 3, picked_by: 'other-3' },
]

describe('picksUntilMyNext', () => {
  it('draftSlot null + kein eigener Pick -> unbekannt (null), nicht erfunden (Regression)', () => {
    // Vorher lieferte der Bug hier 21 (aus Number(null) === 0 hochgerechnet).
    const result = picksUntilMyNext({
      picks: picksNoOwnPick,
      meUserId: 'me',
      teamsCount: 12,
      draftSlot: null,
    })
    expect(result).toBeNull()
  })

  it('draftSlot-Key komplett weggelassen + kein eigener Pick -> unbekannt (null)', () => {
    const result = picksUntilMyNext({
      picks: picksNoOwnPick,
      meUserId: 'me',
      teamsCount: 12,
    })
    expect(result).toBeNull()
  })

  it('draftSlot 7, 12 Teams, 3 Picks gelaufen -> 3 (korrekte Rechnung bleibt unveraendert)', () => {
    const result = picksUntilMyNext({
      picks: picksNoOwnPick,
      meUserId: 'me',
      teamsCount: 12,
      draftSlot: 7,
    })
    expect(result).toBe(3)
  })

  it('draftSlot null, aber ich habe schon gepickt -> Fallback leitet Slot aus fruehestem eigenen Pick ab (kein null)', () => {
    const picks = [
      { pick_no: 1, picked_by: 'other-1' },
      { pick_no: 2, picked_by: 'other-2' },
      { pick_no: 3, picked_by: 'other-3' },
      { pick_no: 4, picked_by: 'other-4' },
      { pick_no: 5, picked_by: 'me' }, // mein fruehester Pick -> Slot 5 (Runde 1)
      { pick_no: 6, picked_by: 'other-6' },
      { pick_no: 7, picked_by: 'other-7' },
      { pick_no: 8, picked_by: 'other-8' },
      { pick_no: 9, picked_by: 'other-9' },
      { pick_no: 10, picked_by: 'other-10' },
    ]
    const result = picksUntilMyNext({
      picks,
      meUserId: 'me',
      teamsCount: 12,
      draftSlot: null,
    })
    expect(result).toBe(9)
  })

  it('Snake-Umkehr: in einer geraden Runde stimmt die Richtung', () => {
    // Runde 2 laeuft rueckwaerts (Snake-Draft). Aktueller Pick 15 = Runde 2, Position 3.
    const picks = Array.from({ length: 15 }, (_, i) => ({
      pick_no: i + 1,
      picked_by: `other-${i + 1}`,
    }))
    const result = picksUntilMyNext({
      picks,
      meUserId: 'me',
      teamsCount: 12,
      draftSlot: 7,
    })
    expect(result).toBe(2)
  })
})

describe('countStarters', () => {
  it('FLEX zaehlt genau einmal, nicht doppelt (Regression)', () => {
    const req = countStarters(['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN'])
    expect(req.FLEX).toBe(1)
  })

  it('FLEX und der Alias RB/WR/TE liefern denselben FLEX-Wert', () => {
    const viaFlex = countStarters(['QB', 'RB', 'WR', 'FLEX'])
    const viaAlias = countStarters(['QB', 'RB', 'WR', 'RB/WR/TE'])
    expect(viaFlex.FLEX).toBe(viaAlias.FLEX)
    expect(viaFlex.FLEX).toBe(1)
  })

  it('SUPER_FLEX und der Alias SFLEX liefern denselben SUPER_FLEX-Wert', () => {
    const viaSuperFlex = countStarters(['QB', 'RB', 'WR', 'SUPER_FLEX'])
    const viaAlias = countStarters(['QB', 'RB', 'WR', 'SFLEX'])
    expect(viaSuperFlex.SUPER_FLEX).toBe(viaAlias.SUPER_FLEX)
    expect(viaSuperFlex.SUPER_FLEX).toBe(1)
  })

  it('QB-Default greift, wenn kein QB-Slot im Roster ist', () => {
    const req = countStarters(['RB', 'WR'])
    expect(req.QB).toBe(1)
  })
})
