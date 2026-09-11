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
      try { (globalThis.__SDH_WORKER_MSGS ||= []).push(msg) } catch {}
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

function stubFetch(adpPlayers = null) {
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
      if (String(url).includes('players/nfl')) return {
        p1: { player_id: 'p1', full_name: 'A Back', fantasy_positions: ['RB'], team: 'KC' },
        p2: { player_id: 'p2', full_name: 'B Back', fantasy_positions: ['WR'], team: 'SEA' },
      }
      if (String(url).includes('/api/rankings/sleeper-adp')) {
        if (!adpPlayers) return { ok: false }
        return { ok: true, players: adpPlayers }
      }
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

  it('ADP-Modell meldet unavailable wenn ADP-Daten fehlen', async () => {
    stubFetch(null)
    const { result } = renderHook(() => useSeasonSim({ league, seasonYear: 2026, scoringType: 'ppr', rosterPositions: league.roster_positions, ownerLabels: new Map(), draftMode: 'redraft', model: 'adp' }))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('unavailable')
    expect(result.current.unavailableReason).toContain('ADP')
  })

  it('ADP-Modell liefert done mit normiertem Rating wenn ADP-Daten da sind', async () => {
    stubFetch([
      { nname: 'a back', adp: 10 },
      { nname: 'b back', adp: 60 },
    ])
    const { result } = renderHook(() => useSeasonSim({ league, seasonYear: 2026, scoringType: 'ppr', rosterPositions: league.roster_positions, ownerLabels: new Map(), draftMode: 'redraft', model: 'adp' }))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('done')
    expect(result.current.odds?.length).toBeGreaterThan(0)
    // Rating ist normiert (Zahl), nicht der Roh-ADP-Wert.
    expect(Number.isFinite(Number(result.current.odds[0].rating))).toBe(true)
  })

  it('postet strengthsByWeek (Worker-Protokoll) an den Worker', async () => {    // Regression: der Worker las p.strengthsByWeek, der Hook postete
    // strengthsPayload — der Worker simulierte mit leerer Map (alle W-L = 7).
    stubFetch()
    globalThis.__SDH_WORKER_MSGS = []
    try {
      const { result } = renderHook(() => useSeasonSim({ league, seasonYear: 2026, scoringType: 'ppr', rosterPositions: league.roster_positions, ownerLabels: new Map(), draftMode: 'redraft' }))
      await act(async () => { await result.current.start() })
      const run = globalThis.__SDH_WORKER_MSGS.find((m) => m?.type === 'run')
      expect(run).toBeTruthy()
      expect(Array.isArray(run.payload.strengthsByWeek)).toBe(true)
      expect(run.payload.strengthsByWeek.length).toBeGreaterThan(0)
      expect(run.payload.strengthsByWeek[0][1].length).toBeGreaterThan(0)
    } finally {
      delete globalThis.__SDH_WORKER_MSGS
    }
  })

  it('Modellwechsel zeigt Cache ohne Re-Sim', async () => {
    stubFetch([
      { nname: 'a back', adp: 10 },
      { nname: 'b back', adp: 60 },
    ])
    globalThis.__SDH_WORKER_MSGS = []
    try {
      const { result, rerender } = renderHook(
        ({ m }) => useSeasonSim({ league, seasonYear: 2026, scoringType: 'ppr', rosterPositions: league.roster_positions, ownerLabels: new Map(), draftMode: 'redraft', model: m }),
        { initialProps: { m: 'projections' } }
      )
      await act(async () => { await result.current.start() })
      expect(result.current.state).toBe('done')
      const runsAfterFirst = globalThis.__SDH_WORKER_MSGS.filter((x) => x?.type === 'run').length
      // Wechsel zu ADP ohne Cache -> idle, kein Sim-Lauf:
      rerender({ m: 'adp' })
      expect(result.current.state).toBe('idle')
      expect(result.current.odds).toBeNull()
      await act(async () => { await result.current.start() })
      expect(result.current.state).toBe('done')
      // Zurueck zu Projektionen -> Cache, kein neuer Worker-Run:
      rerender({ m: 'projections' })
      expect(result.current.state).toBe('done')
      expect(result.current.odds?.length).toBeGreaterThan(0)
      expect(globalThis.__SDH_WORKER_MSGS.filter((x) => x?.type === 'run').length).toBe(runsAfterFirst + 1)
    } finally {
      delete globalThis.__SDH_WORKER_MSGS
    }
  })
})
