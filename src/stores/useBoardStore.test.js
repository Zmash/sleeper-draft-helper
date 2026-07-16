import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const FFC = {
  ok: true,
  meta: { source: 'ffc', format: 'ppr', total_drafts: 2072, end_date: '2026-07-16', fetched_at: '2026-07-16T12:00:00Z' },
  players: [{ name: 'Bijan Robinson', nname: 'bijan robinson', pos: 'RB', team: 'ATL', adp: 1.7, bye: 11, stdev: 0.7, high: 1, low: 4 }],
}
const FC = {
  ok: true,
  meta: { source: 'fantasycalc', isDynasty: false },
  players: [{ name: 'Bijan Robinson', pos: 'RB', team: 'ATL', overallRank: 1, tier: 1, sleeperId: '9509' }],
}

function mockFetch(routes) {
  return vi.fn((url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k))
    if (!key) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
    const r = routes[key]
    if (r instanceof Error) return Promise.reject(r)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(r) })
  })
}

beforeEach(() => { localStorage.clear(); vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals() })

describe('refreshMarketData', () => {
  it('fasst rk und Reihenfolge nicht an', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([
      { name: 'Bijan Robinson', nname: 'bijan robinson', rk: '7', pos: 'RB', adp: null },
    ])
    await useBoardStore.getState().refreshMarketData()
    const p = useBoardStore.getState().boardPlayers[0]
    expect(p.rk).toBe('7')
    expect(p.adp).toBe(1.7)
    expect(p.bye).toBe(11)
  })

  it('schreibt marketMeta fuer die Herkunfts-Zeile', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'X', nname: 'x', rk: '1' }])
    await useBoardStore.getState().refreshMarketData()
    expect(useBoardStore.getState().marketMeta.total_drafts).toBe(2072)
    expect(useBoardStore.getState().marketMeta.source).toBe('ffc')
  })

  it('ein fehlgeschlagener Refresh laesst das Board unangetastet', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': new Error('offline') }))
    const { useBoardStore } = await import('./useBoardStore')
    const before = [{ name: 'Bijan Robinson', nname: 'bijanrobinson', rk: '7', adp: 3.3 }]
    useBoardStore.getState().setBoardPlayers(before)
    const res = await useBoardStore.getState().refreshMarketData()
    expect(res.ok).toBe(false)
    expect(useBoardStore.getState().boardPlayers[0].adp).toBe(3.3)
    expect(useBoardStore.getState().boardPlayers[0].rk).toBe('7')
  })
})

describe('handleAutoImport (redraft)', () => {
  it('merged beide Quellen und liefert stats', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    const res = await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    expect(res.ok).toBe(true)
    expect(res.stats.withAdp).toBe(1)
    const p = useBoardStore.getState().boardPlayers[0]
    expect(p.rk).toBe('1')
    expect(p.adp).toBe(1.7)
    expect(p.tier).toBe(1)
  })

  it('ruft FantasyCalc mit isDynasty=false auf (Kern-Bugfix)', async () => {
    const f = mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC })
    vi.stubGlobal('fetch', f)
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    const fcCall = f.mock.calls.map(c => String(c[0])).find(u => u.includes('fantasycalc'))
    expect(fcCall).toContain('isDynasty=false')
  })

  it('Superflex nutzt das 2qb-Format bei FFC und numQbs=2 bei FantasyCalc', async () => {
    const f = mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC })
    vi.stubGlobal('fetch', f)
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: true, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    const urls = f.mock.calls.map(c => String(c[0]))
    expect(urls.find(u => u.includes('ffc-adp'))).toContain('format=2qb')
    expect(urls.find(u => u.includes('fantasycalc'))).toContain('numQbs=2')
  })

  it('FFC weg, FantasyCalc da: Import gelingt trotzdem, ohne ADP', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': new Error('offline'), 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    const res = await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    expect(res.ok).toBe(true)
    expect(res.stats.withAdp).toBe(0)
    expect(useBoardStore.getState().boardPlayers).toHaveLength(1)
    expect(useBoardStore.getState().marketMeta).toBeNull()
  })

  it('FantasyCalc weg: Import schlaegt fehl, Board bleibt', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': new Error('offline') }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Alt', nname: 'alt', rk: '1' }])
    const res = await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft', force: true,
    })
    expect(res.ok).toBe(false)
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Alt')
  })
})

describe('undoImport', () => {
  it('stellt das Board von vor dem Import wieder her', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Handsortiert', nname: 'handsortiert', rk: '1' }])
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft', force: true,
    })
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Bijan Robinson')
    expect(useBoardStore.getState().undoImport()).toBe(true)
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Handsortiert')
  })

  it('ohne Snapshot ein No-Op', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    expect(useBoardStore.getState().undoImport()).toBe(false)
  })

  it('der Snapshot wird nicht persistiert', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'A', nname: 'a', rk: '1' }])
    const raw = localStorage.getItem('sdh-board-v1') || ''
    expect(raw).not.toContain('lastBoardSnapshot')
  })
})
