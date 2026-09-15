import { describe, it, expect } from 'vitest'
import { slotForKickoff, broadcastFor, RIGHTS_SEASONS } from './nflBroadcast'

const names = (bc) => bc.outlets.map((o) => o.name)

describe('slotForKickoff', () => {
  it('ordnet die Nachtspiele dem richtigen US-Spieltag zu', () => {
    expect(slotForKickoff('2026-09-18T00:15:00Z')).toBe('tnf') // Fr 02:15 MESZ
    expect(slotForKickoff('2026-09-21T00:20:00Z')).toBe('snf') // Mo 02:20 MESZ
    expect(slotForKickoff('2026-09-22T00:15:00Z')).toBe('mnf') // Di 02:15 MESZ
  })

  it('unterscheidet die Sonntagsfenster nach deutscher Uhrzeit', () => {
    expect(slotForKickoff('2026-09-20T13:30:00Z')).toBe('intl') // 15:30 MESZ
    expect(slotForKickoff('2026-09-20T17:00:00Z')).toBe('early') // 19:00 MESZ
    expect(slotForKickoff('2026-09-20T20:25:00Z')).toBe('late') // 22:25 MESZ
  })

  it('erkennt die Fenster auch in der Woche zwischen den Zeitumstellungen', () => {
    // 25.10.-01.11.: Europa schon MEZ, USA noch Sommerzeit -> alles eine Stunde frueher.
    expect(slotForKickoff('2026-10-25T17:00:00Z')).toBe('early') // 18:00 MEZ
    expect(slotForKickoff('2026-10-25T20:25:00Z')).toBe('late') // 21:25 MEZ
  })

  it('kennt Freitags-, Samstags- und Donnerstagsspiele', () => {
    expect(slotForKickoff('2026-11-27T14:00:00Z')).toBe('fri') // Black Friday, 15:00 MEZ
    expect(slotForKickoff('2026-12-19T18:00:00Z')).toBe('sat')
    expect(slotForKickoff('2026-11-26T18:30:00Z')).toBe('thu') // Thanksgiving
  })

  it('null bei unbekanntem oder fehlendem Termin', () => {
    expect(slotForKickoff(null)).toBeNull()
    expect(slotForKickoff('2026-09-23T18:00:00Z')).toBeNull() // Mittwoch
  })
})

describe('broadcastFor', () => {
  const ctx = { week: 2, season: 2026 }

  it('nennt fuer Nachtspiele RTL und Sky als feste Uebertragung', () => {
    const bc = broadcastFor({ date: '2026-09-21T00:20:00Z' }, ctx)
    expect(bc.label).toBe('Sunday Night Football')
    expect(bc.short).toBe('SNF')
    expect(names(bc)).toEqual(['RTL', 'Sky Sport', 'NFL Game Pass'])
    expect(bc.selection).toBe(false)
  })

  it('markiert die Sonntagsfenster als Auswahl und nennt die Konferenz', () => {
    const bc = broadcastFor({ date: '2026-09-20T17:00:00Z' }, ctx)
    expect(bc.selection).toBe(true)
    expect(names(bc)).toEqual(['RTL', 'RTL+', 'Sky Sport', 'NFL Game Pass'])
    expect(bc.conference).toContain('Sky Sport Top Event')
    expect(bc.conference).toContain('NITRO') // Wochen 1-3
  })

  it('laesst NITRO ab Woche 4 aus der Konferenz fallen', () => {
    const bc = broadcastFor({ date: '2026-10-18T17:00:00Z' }, { week: 6, season: 2026 })
    expect(bc.conference).toBe('Sky NFL Konferenz: Sky Sport Top Event')
  })

  it('weist International Games ohne Einschraenkung RTL zu', () => {
    const bc = broadcastFor({ date: '2026-11-15T14:30:00Z' }, { week: 11, season: 2026 })
    expect(bc.short).toBe('INTL')
    // Keine Auswahl und kein Zusatzhinweis: die RTL-Kachel steht fuer sich.
    expect(bc.selection).toBe(false)
    expect(names(bc)).toEqual(['RTL', 'NFL Game Pass'])
    expect(bc.note).toBeNull()
  })

  it('warnt bei Weihnachtsspielen vor abweichenden Uebertragungswegen', () => {
    const bc = broadcastFor({ date: '2026-12-25T18:00:00Z' }, { week: 17, season: 2026 })
    expect(bc.note).toContain('Christmas Game')
  })

  it('nennt ausserhalb der hinterlegten Saisons nur den Game Pass', () => {
    const bc = broadcastFor({ date: '2030-09-22T17:00:00Z' }, { week: 3, season: 2030 })
    expect(names(bc)).toEqual(['NFL Game Pass'])
    expect(bc.note).toContain('nicht hinterlegt')
    expect(RIGHTS_SEASONS).not.toContain(2030)
  })

  it('kommt ohne Termin klar', () => {
    const bc = broadcastFor({}, ctx)
    expect(bc.slot).toBeNull()
    expect(names(bc)).toEqual(['NFL Game Pass'])
  })
})
