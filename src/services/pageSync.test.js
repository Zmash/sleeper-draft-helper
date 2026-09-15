import { describe, it, expect } from 'vitest'
import { pageSyncFor, autoSecondsFor, staleSecondsFor, syncStatus, toMs, PAGE_SYNC, STALE_FACTOR } from './pageSync'

describe('pageSyncFor', () => {
  it('trifft die Seite ueber ihr Pfad-Praefix', () => {
    expect(pageSyncFor('/scores').label).toBe('Spielstände aktualisieren')
    expect(pageSyncFor('/redzone').autoSeconds).toBe(30)
  })

  it('faellt fuer unbekannte Pfade auf das Draft-Intervall zurueck', () => {
    expect(pageSyncFor('/gibtsnicht').draftInterval).toBe(true)
    expect(pageSyncFor(null).label).toBe('Daten aktualisieren')
  })

  it('jede Seite hat entweder einen Takt oder sagt bewusst nein', () => {
    for (const e of PAGE_SYNC) {
      const declared = e.draftInterval || e.autoSeconds === null || Number.isFinite(e.autoSeconds)
      expect(declared, `${e.prefix} ohne Aussage zum Auto-Sync`).toBe(true)
    }
  })
})

describe('autoSecondsFor', () => {
  it('schaltet bei laufenden Spielen auf den schnelleren Takt', () => {
    const scores = pageSyncFor('/scores')
    expect(autoSecondsFor(scores, { live: false })).toBe(300)
    expect(autoSecondsFor(scores, { live: true })).toBe(30)
  })

  it('nimmt fuer Draft-Seiten das eingestellte Intervall, mit 4 s als Untergrenze', () => {
    const board = pageSyncFor('/board')
    expect(autoSecondsFor(board, { draftSeconds: 30 })).toBe(30)
    expect(autoSecondsFor(board, { draftSeconds: 1 })).toBe(4)
    // Kein Draft-Intervall bekannt = kein Auto-Sync.
    expect(autoSecondsFor(board, {})).toBeNull()
  })

  it('null fuer Seiten ohne Auto-Sync', () => {
    expect(autoSecondsFor(pageSyncFor('/setup'), {})).toBeNull()
    expect(autoSecondsFor(null, {})).toBeNull()
  })
})

describe('staleSecondsFor', () => {
  it('leitet die Schwelle aus dem Takt ab', () => {
    expect(staleSecondsFor(pageSyncFor('/weekly'))).toBe(600 * STALE_FACTOR)
  })

  it('haelt kurze Takte bei mindestens 90 s, damit ein Netzhaenger nicht sofort rot faerbt', () => {
    expect(staleSecondsFor(pageSyncFor('/redzone'))).toBe(90) // 30 s * 3 = 90
    expect(staleSecondsFor(pageSyncFor('/scores'), { live: true })).toBe(90)
  })

  it('null fuer Seiten ohne Auto-Sync — die koennen nicht veralten', () => {
    expect(staleSecondsFor(pageSyncFor('/setup'))).toBeNull()
  })
})

describe('syncStatus', () => {
  const now = Date.parse('2026-09-20T17:00:00Z')
  const agoSeconds = (s) => now - s * 1000

  it('gruen, solange Auto-Sync laeuft und der Stand frisch ist', () => {
    expect(syncStatus({ lastAt: agoSeconds(10), staleSeconds: 90, autoOn: true, now })).toBe('auto')
  })

  it('rot, sobald der Stand zu alt ist — auch mit ausgeschaltetem Auto-Sync', () => {
    expect(syncStatus({ lastAt: agoSeconds(120), staleSeconds: 90, autoOn: true, now })).toBe('stale')
    expect(syncStatus({ lastAt: agoSeconds(120), staleSeconds: 90, autoOn: false, now })).toBe('stale')
  })

  it('zeigt nichts, wenn noch nie geladen wurde', () => {
    expect(syncStatus({ lastAt: null, staleSeconds: 90, autoOn: false, now })).toBe('none')
    // ... auch nicht rot: es ist nichts veraltet, es ist noch nichts da.
    expect(syncStatus({ lastAt: null, staleSeconds: 90, autoOn: true, now })).toBe('auto')
  })

  it('zeigt nichts auf Seiten ohne Schwelle', () => {
    expect(syncStatus({ lastAt: agoSeconds(99999), staleSeconds: null, autoOn: false, now })).toBe('none')
  })

  it('versteht Date genauso wie Millisekunden', () => {
    expect(syncStatus({ lastAt: new Date(agoSeconds(120)), staleSeconds: 90, autoOn: true, now })).toBe('stale')
    expect(toMs(new Date(5))).toBe(5)
    expect(toMs('kaputt')).toBeNull()
    expect(toMs(null)).toBeNull()
  })
})
