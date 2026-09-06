import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Task 8: loadDynastyRoster behaelt jetzt zusaetzlich alle rohen Liga-Kader
// (leagueRosters) — bisher wurde nur der eigene, aufbereitete Kader (dynastyRoster)
// behalten und der Rest der Antwort verworfen. Kein zusaetzlicher Request noetig,
// nur das vorhandene Ergebnis nicht mehr wegwerfen.

function mockFetch(routes) {
  return vi.fn((url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k))
    const r = key ? routes[key] : []
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(r) })
  })
}

const ROSTERS = [
  { roster_id: 1, owner_id: 'U1', players: ['100', '200'], starters: ['100'], taxi: [], reserve: [] },
  { roster_id: 2, owner_id: 'U2', players: ['300'], starters: ['300'], taxi: [], reserve: [] },
]

beforeEach(() => { localStorage.clear(); vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals() })

describe('useDynastyStore.loadDynastyRoster — leagueRosters', () => {
  it('behaelt alle Liga-Kader zusaetzlich zum eigenen, aufbereiteten Kader', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/league/L1/rosters': ROSTERS,
      '/players/nfl': {},
    }))
    const { useDynastyStore } = await import('./useDynastyStore')

    await useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L1',
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })

    expect(useDynastyStore.getState().leagueRosters).toEqual(ROSTERS)
    expect(useDynastyStore.getState().dynastyRoster).toHaveLength(2)
  })

  it('behaelt die Liga-Kader auch wenn kein eigener Kader gefunden wird (Liga-Feld-Vergleich bleibt moeglich)', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/league/L1/rosters': ROSTERS,
      '/players/nfl': {},
    }))
    const { useDynastyStore } = await import('./useDynastyStore')

    await useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L1',
      sleeperUserId: 'UNBEKANNT',
      seasonYear: '2026',
    })

    expect(useDynastyStore.getState().leagueRosters).toEqual(ROSTERS)
    expect(useDynastyStore.getState().dynastyRoster).toEqual([])
  })

  it('leert leagueRosters ohne ausgewaehlte Liga', async () => {
    vi.stubGlobal('fetch', mockFetch({}))
    const { useDynastyStore } = await import('./useDynastyStore')
    useDynastyStore.setState({ leagueRosters: ROSTERS })

    await useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: null,
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })

    expect(useDynastyStore.getState().leagueRosters).toEqual([])
  })

  it('leert leagueRosters, wenn der Request fehlschlaegt', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) })))
    const { useDynastyStore } = await import('./useDynastyStore')
    useDynastyStore.setState({ leagueRosters: ROSTERS })

    await useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L1',
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })

    expect(useDynastyStore.getState().leagueRosters).toEqual([])
    expect(useDynastyStore.getState().dynastyRoster).toEqual([])
  })
})
