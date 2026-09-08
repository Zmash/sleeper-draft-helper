import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useDynastyValuesStore } from './useDynastyValuesStore'

const KTC = {
  ok: true,
  players: [{ name: 'Bijan Robinson', pos: 'RB', team: 'ATL', dynasty_value: 9000, age: 24 }],
}

// Erst ab dieser Groesse gilt ein Datensatz als "frisch" (Self-Healing-Guard).
const FULL_KTC = {
  ok: true,
  players: Array.from({ length: 150 }, (_, i) => ({
    name: `Player ${i}`, pos: 'RB', team: 'ATL', dynasty_value: 9000 - i, age: 24,
  })),
}

function mockFetch(response) {
  return vi.fn(() => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(response) }))
}

beforeEach(() => {
  localStorage.clear()
  useDynastyValuesStore.setState({
    dynastyValues: [], dynastyValuesFetchedAt: null, dynastyValuesSuperflex: null, loading: false,
  })
})
afterEach(() => { vi.unstubAllGlobals() })

describe('loadDynastyValuesIfStale', () => {
  it('laedt beim ersten Aufruf und normalisiert nname', async () => {
    const fetchSpy = mockFetch(KTC)
    vi.stubGlobal('fetch', fetchSpy)
    await useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: false })
    expect(fetchSpy).toHaveBeenCalledWith('/api/rankings/ktc-dynasty?superflex=false')
    const { dynastyValues, dynastyValuesFetchedAt } = useDynastyValuesStore.getState()
    expect(dynastyValues).toHaveLength(1)
    expect(dynastyValues[0].nname).toBe('bijan robinson')
    expect(dynastyValues[0].value).toBe(9000)
    expect(dynastyValues[0].dynasty_value).toBe(9000)
    expect(dynastyValuesFetchedAt).not.toBeNull()
  })

  it('ruft bei frischem Cache (gleiches Format) kein zweites Mal fetch auf', async () => {
    const fetchSpy = mockFetch(FULL_KTC)
    vi.stubGlobal('fetch', fetchSpy)
    await useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: false })
    await useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: false })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('ein Format-Wechsel (superflex) gilt als stale und laedt neu', async () => {
    const fetchSpy = mockFetch(KTC)
    vi.stubGlobal('fetch', fetchSpy)
    await useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: false })
    await useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenLastCalledWith('/api/rankings/ktc-dynasty?superflex=true')
  })

  it('ein unvollstaendiger Datensatz (< 100) ist nie frisch und laedt neu (Selbstheilung)', async () => {
    const fetchSpy = mockFetch(KTC)
    vi.stubGlobal('fetch', fetchSpy)
    await useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: false })
    await useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: false })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('Fehler beim Fetch: still bleiben, kein Crash, kein Datenverlust', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network down'))))
    await expect(
      useDynastyValuesStore.getState().loadDynastyValuesIfStale({ superflex: false })
    ).resolves.toBeUndefined()
    expect(useDynastyValuesStore.getState().dynastyValues).toEqual([])
    expect(useDynastyValuesStore.getState().loading).toBe(false)
  })
})
