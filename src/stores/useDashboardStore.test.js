import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Bug: ein echter Liga-Draft (league_id gesetzt) wurde als "Mock" gezeigt, sobald
// seine Liga nicht in availableLeagues steckte — z.B. weil Dynasty-Ligen pro Saison
// eine NEUE league_id bekommen und ein alter, persistierter Draft aus der Vorsaison
// haengenblieb. Ein Draft MIT league_id ist per Definition kein Mock.

function mockFetch(routes) {
  return vi.fn((url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k))
    const r = key ? routes[key] : []
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(r) })
  })
}

// Off-Season -> keine Matchups/PlayersMeta noetig, Karten bleiben schlank.
const NFL_STATE = { week: 1, season_type: 'off', season: '2026' }

const LEAGUE_2026 = {
  league_id: 'L2026',
  name: 'Dynasty League Bochum',
  settings: { type: 2 },
  total_rosters: 10,
  scoring_settings: { rec: 1 },
  status: 'in_season',
}

// Alter Draft aus der Vorsaison — andere league_id, die NICHT geladen ist.
const STALE_LEAGUE_DRAFT = {
  draft_id: 'D2025',
  league_id: 'L2025',
  status: 'complete',
  type: 'linear',
  settings: { teams: 10, rounds: 4 },
  metadata: { name: 'Dynasty League Bochum', scoring_type: 'dynasty_2qb' },
}

// Echter Sleeper-Mock: league_id === null.
const REAL_MOCK = {
  draft_id: 'MOCK1',
  league_id: null,
  status: 'drafting',
  type: 'snake',
  settings: { teams: 12, rounds: 14 },
  metadata: { name: 'HalfPPRTest', scoring_type: 'half_ppr' },
}

beforeEach(() => { localStorage.clear(); vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals() })

describe('useDashboardStore.loadDashboard — Mock-Erkennung', () => {
  it('zeigt einen Draft MIT league_id nie als Mock-Card, auch wenn seine Liga nicht geladen ist', async () => {
    vi.stubGlobal('fetch', mockFetch({
      '/state/nfl': NFL_STATE,
      '/league/L2026/drafts': [],
      '/league/L2026/rosters': [],
      '/league/L2026/users': [],
    }))
    const { useDashboardStore } = await import('./useDashboardStore')

    await useDashboardStore.getState().loadDashboard({
      leagues: [LEAGUE_2026],
      availableDrafts: [STALE_LEAGUE_DRAFT],
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })

    const cards = useDashboardStore.getState().cards
    const mockCards = cards.filter((c) => c.type === 'draft')
    expect(mockCards).toEqual([])
  })

  it('zeigt einen echten Mock (league_id === null) weiterhin als Mock-Card', async () => {
    vi.stubGlobal('fetch', mockFetch({ '/state/nfl': NFL_STATE }))
    const { useDashboardStore } = await import('./useDashboardStore')

    await useDashboardStore.getState().loadDashboard({
      leagues: [],
      availableDrafts: [REAL_MOCK],
      sleeperUserId: 'U1',
      seasonYear: '2026',
    })

    const cards = useDashboardStore.getState().cards
    const mockCards = cards.filter((c) => c.type === 'draft')
    expect(mockCards).toHaveLength(1)
    expect(mockCards[0].draftId).toBe('MOCK1')
  })
})
