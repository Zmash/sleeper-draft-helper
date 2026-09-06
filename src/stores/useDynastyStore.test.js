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

// Liga B fuer die Ligawechsel-Tests: bewusst andere roster_ids/owner_ids als ROSTERS (Liga A),
// damit ein versehentliches Stehenbleiben von A-Daten in den Assertions auffaellt.
const ROSTERS_B = [
  { roster_id: 9, owner_id: 'U9', players: ['900'], starters: ['900'], taxi: [], reserve: [] },
]

// Fetch-Mock fuer den Wettlauf-Test: die Antwort auf `holdKey` wird nicht sofort aufgeloest,
// sondern haengt in einem Promise, dessen Resolver der Test spaeter selbst aufruft (`resolveHeld`).
// Es reicht, genau eine Antwort (die des aelteren Aufrufs) zurueckzuhalten - Promise.all im
// Store wartet dann so lange wie dieser eine Fetch, unabhaengig davon, was der neuere Aufruf tut.
function controllableFetch(routes, holdKey) {
  let resolveHeld
  const held = new Promise((resolve) => { resolveHeld = resolve })
  const fetchMock = vi.fn((url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k))
    const data = key ? routes[key] : []
    if (key === holdKey) {
      return held.then(() => ({ ok: true, status: 200, json: () => Promise.resolve(data) }))
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) })
  })
  return { fetchMock, resolveHeld }
}

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

  it('ersetzt bei einem echten Ligawechsel (zwei aufeinanderfolgende Aufrufe) die Kader vollstaendig', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/league/L1/rosters': ROSTERS,
      '/league/L2/rosters': ROSTERS_B,
      '/players/nfl': {},
    }))
    const { useDynastyStore } = await import('./useDynastyStore')

    // Erst Liga A erfolgreich laden.
    await useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L1',
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })
    expect(useDynastyStore.getState().leagueRosters).toEqual(ROSTERS)

    // Dann zu Liga B wechseln, in der der Nutzer keinen eigenen Kader hat.
    await useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L2',
      sleeperUserId: 'UNBEKANNT',
      seasonYear: '2026',
    })

    expect(useDynastyStore.getState().leagueRosters).toEqual(ROSTERS_B)
    expect(useDynastyStore.getState().dynastyRoster).toEqual([])
  })

  it('Wettlauf beim schnellen Ligawechsel: die Daten des spaeter gestarteten, schneller aufgeloesten Aufrufs gewinnen', async () => {
    const { fetchMock, resolveHeld } = controllableFetch({
      '/league/L1/rosters': ROSTERS,   // aelterer Aufruf, wird zurueckgehalten
      '/league/L2/rosters': ROSTERS_B, // neuerer Aufruf, loest sofort auf
      '/players/nfl': {},
    }, '/league/L1/rosters')
    vi.stubGlobal('fetch', fetchMock)
    const { useDynastyStore } = await import('./useDynastyStore')

    // Ligawechsel A -> B, bevor die Antwort fuer A eingetroffen ist.
    const laufA = useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L1',
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })
    const laufB = useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L2',
      sleeperUserId: 'U9',
      seasonYear: '2026',
    })

    // B (neuer, schneller) trifft zuerst ein und setzt seine Werte.
    await laufB
    expect(useDynastyStore.getState().leagueRosters).toEqual(ROSTERS_B)

    // Jetzt erst loest die zurueckgehaltene, aeltere Antwort fuer A auf.
    resolveHeld()
    await laufA

    // Ohne Schutz wuerde A hier B ueberschreiben - das darf nicht passieren.
    expect(useDynastyStore.getState().leagueRosters).toEqual(ROSTERS_B)
    expect(useDynastyStore.getState().mySleeperRosterId).toBe(9)
  })

  it('clearDynastyData entwertet einen noch laufenden loadDynastyRoster-Aufruf (Liga abwaehlen waehrend des Ladens)', async () => {
    const { fetchMock, resolveHeld } = controllableFetch({
      '/league/L1/rosters': ROSTERS, // haengt, bis der Test sie aufloest
      '/players/nfl': {},
    }, '/league/L1/rosters')
    vi.stubGlobal('fetch', fetchMock)
    const { useDynastyStore } = await import('./useDynastyStore')

    // Laden fuer Liga L1 anstossen, aber Antwort haengt noch.
    const lauf = useDynastyStore.getState().loadDynastyRoster({
      selectedLeagueId: 'L1',
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })

    // Waehrend die Antwort noch aussteht: Liga abwaehlen (z.B. Logout/Mock-Draft-Wechsel).
    useDynastyStore.getState().clearDynastyData()
    expect(useDynastyStore.getState().leagueRosters).toEqual([])
    expect(useDynastyStore.getState().dynastyRoster).toEqual([])
    expect(useDynastyStore.getState().mySleeperRosterId).toBeNull()

    // Jetzt erst trifft die (veraltete) Antwort fuer L1 ein.
    resolveHeld()
    await lauf

    // Der Store muss leer bleiben - die verspaetete Antwort der abgewaehlten Liga
    // darf nicht mehr zurueckschreiben.
    expect(useDynastyStore.getState().leagueRosters).toEqual([])
    expect(useDynastyStore.getState().dynastyRoster).toEqual([])
    expect(useDynastyStore.getState().mySleeperRosterId).toBeNull()
  })
})
