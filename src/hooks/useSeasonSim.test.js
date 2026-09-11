import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Worker mocken: Vitest/jsdom kann keine echten Worker laden. Der Mock ruft
// onmessage synchron mit einem Minimal-Ergebnis auf.
vi.mock('../workers/simWorker.js?worker', () => ({
  default: class {
    constructor() {
      if (globalThis.__SDH_FORCE_NO_WORKER) throw new Error('kein Worker')
      this.onmessage = null; this.onerror = null
    }
    postMessage(msg) {
      if (msg?.type === 'run') {
        this.onmessage?.({ data: { type: 'done', results: [{ rosterId: '1', winsAvg: 10, playoffPct: 100, byePct: 50, titlePct: 60 }] } })
      }
    }
    terminate() {}
  },
}))

import { useSeasonSim } from './useSeasonSim'

const league = {
  league_id: 'lg1',
  roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN', 'BN'],
  settings: { playoff_week_start: 15, playoff_teams_count: 4 },
}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const json = async () => {
      if (String(url).includes('/state/nfl')) return { week: 5, season_type: 'regular', season: '2026' }
      if (String(url).includes('/rosters')) return [
        { roster_id: 1, owner_id: 'u1', players: ['p1', 'p2'], starters: ['p1'], settings: { wins: 3, losses: 1 } },
        { roster_id: 2, owner_id: 'u2', players: ['p1', 'p2'], starters: ['p2'], settings: { wins: 2, losses: 2 } },
        { roster_id: 3, owner_id: 'u3', players: ['p1'], starters: [], settings: { wins: 1, losses: 3 } },
        { roster_id: 4, owner_id: 'u4', players: ['p2'], starters: [], settings: { wins: 0, losses: 4 } },
      ]
      if (String(url).includes('/matchups/')) return [
        { matchup_id: 1, roster_id: 1 },
        { matchup_id: 1, roster_id: 2 },
      ]
      if (String(url).includes('players/nfl')) return {}
      return {}
    }
    return { ok: true, json }
  }))
}

beforeEach(() => { vi.unstubAllGlobals() })

describe('useSeasonSim', () => {
  it('startet idle und meldet unavailable ohne Liga', async () => {
    stubFetch()
    const { result } = renderHook(() => useSeasonSim({ league: null, seasonYear: 2026, scoringType: 'ppr', rosterPositions: [], ownerLabels: new Map() }))
    expect(result.current.state).toBe('unavailable')
    expect(result.current.unavailableReason).toContain('Liga')
  })

  it('liefert done mit reducedAccuracy wenn Projektionen fehlen', async () => {
    stubFetch()
    const { result } = renderHook(() => useSeasonSim({ league, seasonYear: 2026, scoringType: 'ppr', rosterPositions: league.roster_positions, ownerLabels: new Map(), draftMode: 'redraft' }))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('done')
    expect(result.current.odds?.length).toBeGreaterThan(0)
    expect(result.current.odds[0].reducedAccuracy).toBe(true)
  })

  it('Inline-Fallback liefert done wenn kein Worker existiert', async () => {
    stubFetch()
    globalThis.__SDH_FORCE_NO_WORKER = true
    try {
      const { result } = renderHook(() => useSeasonSim({ league, seasonYear: 2026, scoringType: 'ppr', rosterPositions: league.roster_positions, ownerLabels: new Map(), draftMode: 'redraft' }))
      await act(async () => { await result.current.start() })
      expect(result.current.state).toBe('done')
      expect(result.current.odds?.length).toBeGreaterThan(0)
    } finally {
      delete globalThis.__SDH_FORCE_NO_WORKER
    }
  })
})
