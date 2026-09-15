import { describe, it, expect } from 'vitest'
import { berlinParts, berlinTime, berlinShortDay, berlinLongDay, toDate } from './berlinTime'

describe('berlinParts', () => {
  it('rechnet UTC in deutsche Ortszeit um (Sommerzeit, +2)', () => {
    expect(berlinParts('2026-09-20T17:00:00Z')).toMatchObject({
      weekday: 0, hour: 19, minute: 0, day: 20, month: 9, year: 2026, dayKey: '2026-09-20',
    })
  })

  it('schiebt das US-Sonntagabendspiel auf den deutschen Montag', () => {
    expect(berlinParts('2026-09-21T00:20:00Z')).toMatchObject({ weekday: 1, hour: 2, minute: 20, dayKey: '2026-09-21' })
  })

  it('rechnet Winterzeit (+1) korrekt', () => {
    // 8.11. ist in den USA schon Normalzeit: 13:00 ET = 19:00 MEZ.
    expect(berlinParts('2026-11-08T18:00:00Z')).toMatchObject({ weekday: 0, hour: 19 })
  })

  it('gibt bei kaputten Eingaben null zurueck', () => {
    expect(berlinParts(null)).toBeNull()
    expect(berlinParts('kein Datum')).toBeNull()
    expect(toDate(undefined)).toBeNull()
  })
})

describe('Labels', () => {
  it('formatiert Uhrzeit, Kurz- und Langtag auf Deutsch', () => {
    expect(berlinTime('2026-09-20T17:00:00Z')).toBe('19:00')
    expect(berlinShortDay('2026-09-20T17:00:00Z')).toBe('So')
    expect(berlinLongDay('2026-09-20T17:00:00Z')).toBe('Sonntag, 20. September')
  })

  it('liefert leere Strings statt "Invalid Date"', () => {
    expect(berlinTime(null)).toBe('')
    expect(berlinShortDay('x')).toBe('')
    expect(berlinLongDay(undefined)).toBe('')
  })
})
