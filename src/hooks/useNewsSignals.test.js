import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useNewsSignals, usePlayerNewsSignals, newsSignalTargets, newsTargetsFrom, SIGNAL_FRESH_MS } from './useNewsSignals'

const ROWS = [
  { name: 'Puka Nacua', pos: 'WR', team: 'LAR' },
  { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', status: 'other' },
  { name: 'Ja\'Marr Chase', pos: 'WR', team: 'CIN' },
]

function mockFetch() {
  global.fetch = vi.fn(async (_url, init) => {
    const { players } = JSON.parse(init.body)
    const signals = Object.fromEntries(players.map((p) => [p.name, p.name === 'Puka Nacua'
      ? { signal: 'injury', headline: 'Out for weeks', p: { up: 0, down: 0.2, out: 0.9 } }
      : null]))
    return { ok: true, json: async () => ({ ok: true, enabled: true, signals }) }
  })
}

function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
}

describe('newsSignalTargets', () => {
  it('ueberspringt gedraftete Spieler und liefert nur Name/Pos/Team', () => {
    expect(newsSignalTargets(ROWS)).toEqual([
      { name: 'Puka Nacua', pos: 'WR', team: 'LAR' },
      { name: 'Ja\'Marr Chase', pos: 'WR', team: 'CIN' },
    ])
  })
  it('begrenzt auf 50', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ name: `P${i}` }))
    expect(newsSignalTargets(many)).toHaveLength(50)
  })
})

describe('newsTargetsFrom (Saison-Listen)', () => {
  it('laesst Defenses und Kicker aus — dafuer gibt es keine Spieler-News', () => {
    expect(newsTargetsFrom([
      { name: 'Houston Texans', pos: 'DEF', team: 'HOU' },
      { name: 'Justin Tucker', pos: 'K', team: 'BAL' },
      { name: 'Puka Nacua', pos: 'WR', team: 'LAR' },
    ])).toEqual([{ name: 'Puka Nacua', pos: 'WR', team: 'LAR' }])
  })
  it('ignoriert status (in Saison-Daten kein "gedraftet") und dedupliziert Namen', () => {
    expect(newsTargetsFrom([
      { name: 'Puka Nacua', pos: 'WR', status: 'Active' },
      { name: 'Puka Nacua', pos: 'WR' },
      null,
      { pos: 'RB' },
    ])).toEqual([{ name: 'Puka Nacua', pos: 'WR', team: null }])
  })
  it('usePlayerNewsSignals fragt die Saison-Liste an', async () => {
    mockFetch()
    setHidden(false)
    const { result } = renderHook(() => usePlayerNewsSignals(
      [{ name: 'Puka Nacua', pos: 'WR', status: 'Active' }, { name: 'Houston Texans', pos: 'DEF' }],
      { debounceMs: 0 },
    ))
    await waitFor(() => expect(result.current['Puka Nacua']?.signal).toBe('injury'))
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).players.map((p) => p.name)).toEqual(['Puka Nacua'])
    delete global.fetch
  })
})

describe('useNewsSignals', () => {
  beforeEach(() => { setHidden(false); mockFetch() })
  afterEach(() => { delete global.fetch; vi.restoreAllMocks() })

  it('fragt die sichtbaren Spieler einmal an und liefert die Signale', async () => {
    const { result, rerender } = renderHook(({ rows }) => useNewsSignals(rows, { debounceMs: 0 }), {
      initialProps: { rows: ROWS },
    })
    await waitFor(() => expect(result.current['Puka Nacua']?.signal).toBe('injury'))
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = global.fetch.mock.calls[0]
    expect(url).toBe('/api/news/signals')
    expect(JSON.parse(init.body).players.map((p) => p.name)).toEqual(['Puka Nacua', 'Ja\'Marr Chase'])

    // Neue Array-Identitaet, gleiche Namen → keine neue Anfrage.
    rerender({ rows: [...ROWS] })
    await new Promise((r) => setTimeout(r, 20))
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('uebernimmt die Antwort auch unter StrictMode (Effekte laufen doppelt)', async () => {
    const { result } = renderHook(() => useNewsSignals(ROWS, { debounceMs: 0 }), { wrapper: StrictMode })
    await waitFor(() => expect(result.current['Puka Nacua']?.signal).toBe('injury'))
  })

  it('fragt bei neuen Namen nur die fehlenden an', async () => {
    const { rerender } = renderHook(({ rows }) => useNewsSignals(rows, { debounceMs: 0 }), {
      initialProps: { rows: ROWS },
    })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
    rerender({ rows: [...ROWS, { name: 'CeeDee Lamb', pos: 'WR', team: 'DAL' }] })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    expect(JSON.parse(global.fetch.mock.calls[1][1].body).players.map((p) => p.name)).toEqual(['CeeDee Lamb'])
  })

  it('fragt bei verstecktem Tab nicht', async () => {
    setHidden(true)
    renderHook(() => useNewsSignals(ROWS, { debounceMs: 0 }))
    await new Promise((r) => setTimeout(r, 20))
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('laedt beim Zurueckkehren in den Tab nach, aber erst wenn die Daten aelter als 10 min sind', async () => {
    const t0 = Date.now()
    const now = vi.spyOn(Date, 'now').mockReturnValue(t0)
    renderHook(() => useNewsSignals(ROWS, { debounceMs: 0 }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

    now.mockReturnValue(t0 + SIGNAL_FRESH_MS - 1000)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    now.mockReturnValue(t0 + SIGNAL_FRESH_MS + 1000)
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')) })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('Fehler bleiben still, alte Werte bleiben stehen', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useNewsSignals(ROWS, { debounceMs: 0 }))
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(result.current).toEqual({})
  })
})
