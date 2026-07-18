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

describe('refreshMarketData im Rookie-Modus', () => {
  // handleAutoImport guardet sorgfaeltig gegen Rookie/Dynasty, bevor es FFC anfasst.
  // refreshMarketData tat das nicht: ein Klick auf [Aktualisieren] auf einem
  // Rookie-Board hat NFL-weite Redraft-ADP ueber Rookie-Raenge gelegt. Rookie-Pfad
  // darf sein Verhalten nicht aendern.
  it('laesst boardPlayers unveraendert', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { useBoardStore } = await import('./useBoardStore')
    const before = [{ name: 'Ashton Jeanty', nname: 'ashton jeanty', rk: '1', adp: null }]
    useBoardStore.getState().setBoardPlayers(before)
    useBoardStore.getState().setDraftMode('rookie')
    const res = await useBoardStore.getState().refreshMarketData()
    expect(res.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(useBoardStore.getState().boardPlayers).toEqual(before)
  })
})

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

  // Blocker 4: die Herkunfts-Zeile darf nie an csvRawText haengen (das aendert
  // sich bei jedem Tastendruck im Setup-Feld, auch ohne dass ein CSV-Import
  // tatsaechlich stattfand). Auto-/KTC-Importpfade setzen boardSource direkt.
  it('setzt boardSource auf "market"', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    expect(useBoardStore.getState().boardSource).toBe('market')
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

describe('handleKtcRookieImport', () => {
  const KTC = { ok: true, players: [{ name: 'Ashton Jeanty', pos: 'RB', team: 'LV', rk: 1 }] }

  it('setzt boardSource auf "market" (kein CSV)', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ktc-rookies': KTC }))
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleKtcRookieImport()
    expect(useBoardStore.getState().boardSource).toBe('market')
  })

  it('ueberspringt bei force=true die Overwrite-Rueckfrage', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ktc-rookies': KTC }))
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Alt', nname: 'alt', rk: '1' }])
    const ok = await useBoardStore.getState().handleKtcRookieImport(true)
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(ok).toBe(true)
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Ashton Jeanty')
    confirmSpy.mockRestore()
  })
})

describe('boardMode-Typmarkierung (Draft-Typ-Guard)', () => {
  const KTC = { ok: true, players: [{ name: 'Ashton Jeanty', pos: 'RB', team: 'LV', rk: 1 }] }

  it('startet als null (alte Boards ohne Markierung loesen keine Warnung aus)', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    expect(useBoardStore.getState().boardMode).toBeNull()
  })

  it('handleAutoImport markiert ein Redraft-Board als "redraft"', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    expect(useBoardStore.getState().boardMode).toBe('redraft')
  })

  it('handleAutoImport markiert ein Dynasty-Board als "rookie"', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'rookie',
    })
    expect(useBoardStore.getState().boardMode).toBe('rookie')
  })

  it('handleKtcRookieImport markiert das Board als "rookie"', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ktc-rookies': KTC }))
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleKtcRookieImport()
    expect(useBoardStore.getState().boardMode).toBe('rookie')
  })

  it('handleCsvLoad uebernimmt den aktuellen draftMode', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setDraftMode('rookie')
    useBoardStore.getState().setCsvRawText(
      'RK,PLAYER NAME,TEAM,POS,BYE WEEK\n1,Ashton Jeanty,LV,RB,10'
    )
    await useBoardStore.getState().handleCsvLoad()
    expect(useBoardStore.getState().boardMode).toBe('rookie')
  })
})

describe('boardSource-Herkunftsmerkmal', () => {
  // Blocker 4: hasCsvBoard darf nicht an csvRawText (Tastendruck-Feld) haengen.
  // setBoardSource ist die vom Aufrufer (SetupPage) gesetzte Wahrheit ueber die
  // tatsaechliche Herkunft des AKTUELLEN Boards.
  it('setBoardSource setzt und persistiert das Feld', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardSource('csv')
    expect(useBoardStore.getState().boardSource).toBe('csv')
  })

  it('boardSource startet als null', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    expect(useBoardStore.getState().boardSource).toBeNull()
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

  // Die Herkunfts-Zeile ("Die Zeile luegt nie") liest boardSource/marketMeta direkt
  // aus dem Store. Undo darf nur boardPlayers wiederherstellen, wenn es auch
  // boardSource/marketMeta mit zurueckdreht — sonst behauptet die Zeile nach einem
  // Undo weiterhin FantasyCalc-Marktdaten fuer ein Board, das wieder CSV ist.
  it('stellt boardSource und marketMeta zusammen mit boardPlayers wieder her', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Handsortiert', nname: 'handsortiert', rk: '1' }])
    useBoardStore.getState().setBoardSource('csv')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft', force: true,
    })
    expect(useBoardStore.getState().boardSource).toBe('market')
    expect(useBoardStore.getState().marketMeta).not.toBeNull()
    expect(useBoardStore.getState().undoImport()).toBe(true)
    expect(useBoardStore.getState().boardSource).toBe('csv')
    expect(useBoardStore.getState().marketMeta).toBeNull()
  })

  it('der Snapshot wird nicht persistiert', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'A', nname: 'a', rk: '1' }])
    const raw = localStorage.getItem('sdh-board-v1') || ''
    expect(raw).not.toContain('lastBoardSnapshot')
  })
})
