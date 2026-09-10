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
// Sleeper ist die ADP-Hauptquelle. Bewusst anderer adp-Wert als FFC (1.4 vs 1.7),
// damit Tests sehen koennen, welche Quelle das Board tatsaechlich gespeist hat.
const SLEEPER = {
  ok: true,
  meta: { source: 'sleeper', provider: 'rotowire', format: 'ppr', total_drafts: null, end_date: null },
  players: [{ name: 'Bijan Robinson', nname: 'bijan robinson', pos: 'RB', team: 'ATL', adp: 1.4, bye: null, high: null, low: null, stdev: null }],
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

  it('nutzt Sleeper als ADP-Hauptquelle (nicht FFC)', async () => {
    const f = mockFetch({ 'sleeper-adp': SLEEPER, 'ffc-adp': FFC, 'fantasycalc': FC })
    vi.stubGlobal('fetch', f)
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    // adp 1.4 stammt aus SLEEPER, 1.7 waere FFC gewesen
    expect(useBoardStore.getState().boardPlayers[0].adp).toBe(1.4)
    expect(useBoardStore.getState().marketMeta.source).toBe('sleeper')
    expect(f.mock.calls.map(c => String(c[0])).some(u => u.includes('sleeper-adp'))).toBe(true)
  })

  it('Sleeper aus, FFC da: faellt auf FFC zurueck', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'sleeper-adp': new Error('offline'), 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    const res = await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    expect(res.ok).toBe(true)
    expect(useBoardStore.getState().boardPlayers[0].adp).toBe(1.7)
    expect(useBoardStore.getState().marketMeta.source).toBe('ffc')
  })

  it('Superflex: das 2qb-Format geht an die Sleeper-ADP-Quelle', async () => {
    const f = mockFetch({ 'sleeper-adp': SLEEPER, 'ffc-adp': FFC, 'fantasycalc': FC })
    vi.stubGlobal('fetch', f)
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: true, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    const sleeperCall = f.mock.calls.map(c => String(c[0])).find(u => u.includes('sleeper-adp'))
    expect(sleeperCall).toContain('format=2qb')
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

describe('refreshMarketData mit Format-Parametern', () => {
  it('nutzt das uebergebene Format statt marketMeta.format', async () => {
    const fetchSpy = mockFetch({ 'sleeper-adp': SLEEPER, 'ffc-adp': FFC })
    vi.stubGlobal('fetch', fetchSpy)
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', adp: null }])
    await useBoardStore.getState().refreshMarketData({ isSuperflex: false, effScoringType: 'half_ppr', numTeams: 10 })
    const call = fetchSpy.mock.calls.find(([u]) => String(u).includes('sleeper-adp'))
    expect(call).toBeTruthy()
    expect(String(call[0])).toContain('format=half-ppr')
  })

  it('ohne Parameter faellt weiter auf marketMeta.format zurueck (Bestandsverhalten)', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', adp: null }])
    await useBoardStore.getState().refreshMarketData()
    expect(useBoardStore.getState().boardPlayers[0].adp).toBe(1.7)
  })
})

describe('fillMissingBye (Store-Action)', () => {
  it('ergaenzt nur eine fehlende Bye, aendert ADP nicht', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([
      { name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', adp: 5.5, bye: null },
    ])
    const res = await useBoardStore.getState().fillMissingBye()
    expect(res.ok).toBe(true)
    const p = useBoardStore.getState().boardPlayers[0]
    expect(p.bye).toBe(11)
    expect(p.adp).toBe(5.5)
  })

  it('Guard: kein Board geladen', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([])
    const res = await useBoardStore.getState().fillMissingBye()
    expect(res.ok).toBe(false)
  })

  it('Guard: Rookie-Modus ruft keinen Fetch auf', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Ashton Jeanty', nname: 'ashton jeanty', rk: '1', bye: null }])
    useBoardStore.getState().setDraftMode('rookie')
    const res = await useBoardStore.getState().fillMissingBye()
    expect(res.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('boardsByKey / switchBoard', () => {
  it('sichert Redraft-Board und lädt Rookie-Board leer, zurückkehren stellt wieder her', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan', nname: 'bijan', rk: '1' }])
    useBoardStore.getState().switchBoard('league:L1:redraft')
    expect(useBoardStore.getState().activeBoardKey).toBe('league:L1:redraft')
    useBoardStore.getState().switchBoard('league:L9:rookie')
    expect(useBoardStore.getState().boardPlayers).toEqual([])
    useBoardStore.getState().setBoardPlayers([{ name: 'Jeanty', nname: 'jeanty', rk: '1' }])
    useBoardStore.getState().switchBoard('league:L1:redraft')
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Bijan')
    useBoardStore.getState().switchBoard('league:L9:rookie')
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Jeanty')
  })

  it('Undo wirkt nie liga-übergreifend (Snapshot wird beim Switch verworfen)', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'A', nname: 'a', rk: '1' }])
    useBoardStore.getState().switchBoard('league:L1:redraft')
    useBoardStore.getState().switchBoard('league:L9:rookie')
    expect(useBoardStore.getState().undoImport()).toBe(false)
  })
})

describe('Cache-Durchschrieb F3/F4/F6 (writeThroughActiveBoard)', () => {
  // F4: Nutzer-Reorder muss den Reload mit Cache-Hit ueberleben — der Cache
  // (boardsByKey, persistiert) muss den Reorder-Stand enthalten, sonst
  // ueberschreibt der stale Hit nach Rehydrate den Top-Level-Stand.
  it('onBoardReorder landet im Cache und ueberlebt simulierten Reload (persist-rehydrate)', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().switchBoard('league:L1:redraft')
    useBoardStore.getState().setBoardPlayers([
      { name: 'A-Spieler', nname: 'a-spieler', rk: '1' },
      { name: 'B-Spieler', nname: 'b-spieler', rk: '2' },
    ])
    useBoardStore.getState().onBoardReorder('a-spieler', 'b-spieler')
    expect(useBoardStore.getState().boardPlayers[0].nname).toBe('b-spieler')
    const cached = useBoardStore.getState().boardsByKey['league:L1:redraft']
    expect(cached.boardPlayers[0].nname).toBe('b-spieler')
    // Simulierter Reload: boardsByKey ist persistiert und traegt den Reorder-Stand.
    const raw = JSON.parse(localStorage.getItem('sdh-board-v1') || '{}')
    expect(raw.state.boardsByKey['league:L1:redraft'].boardPlayers[0].nname).toBe('b-spieler')
  })

  // F6: undoImport muss den Cache mit zurueckdrehen — sonst reanimiert ein
  // Reload-mit-Hit den rueckgaengig gemachten Import-Stand.
  it('undoImport aktualisiert den Cache', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().switchBoard('league:L1:redraft')
    useBoardStore.getState().setBoardPlayers([{ name: 'Handsortiert', nname: 'handsortiert', rk: '1' }])
    useBoardStore.getState().setBoardSource('csv')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft', force: true,
    })
    expect(useBoardStore.getState().boardsByKey['league:L1:redraft'].boardSource).toBe('market')
    expect(useBoardStore.getState().undoImport()).toBe(true)
    const cached = useBoardStore.getState().boardsByKey['league:L1:redraft']
    expect(cached.boardPlayers[0].name).toBe('Handsortiert')
    expect(cached.boardSource).toBe('csv')
  })

  // F3: handleCsvLoad setzt boardSource nicht selbst (macht der Aufrufer via
  // setBoardSource) — deshalb muss setBoardSource den Cache nachfuehren, sonst
  // luegt die Herkunfts-Zeile nach Switch+zurueck fuer CSV-Boards.
  it('setBoardSource(csv) landet im Cache', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().switchBoard('league:L1:redraft')
    useBoardStore.getState().setBoardPlayers([{ name: 'CSV-Spieler', nname: 'csv-spieler', rk: '1' }])
    useBoardStore.getState().setBoardSource('csv')
    expect(useBoardStore.getState().boardSource).toBe('csv')
    expect(useBoardStore.getState().boardsByKey['league:L1:redraft'].boardSource).toBe('csv')
  })
})

describe('copyBoard (geteilter Modus-Key -> Profil-Board)', () => {
  // Persist-Pfad mit geteilter Quelle: der mode:-Key bleibt fuer den Rest
  // bestehen, das Ziel ist danach identisch, Undo ist isoliert.
  it('Quelle bleibt, Ziel identisch, Undo verworfen', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().switchBoard('mode:redraft')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan', nname: 'bijan', rk: '1' }])
    useBoardStore.getState().setBoardSource('market')
    useBoardStore.getState().copyBoard('mode:redraft', 'profile:p1')
    const st = useBoardStore.getState()
    expect(st.boardsByKey['mode:redraft'].boardPlayers[0].name).toBe('Bijan')
    expect(st.boardsByKey['profile:p1'].boardPlayers).toEqual(st.boardsByKey['mode:redraft'].boardPlayers)
    expect(st.boardsByKey['profile:p1'].boardSource).toBe('market')
    expect(st.activeBoardKey).toBe('mode:redraft')
    expect(st.lastBoardSnapshot).toBeNull()
    expect(st.undoImport()).toBe(false)
  })

  it('ohne Quelle ein No-Op', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().copyBoard('mode:redraft', 'profile:p9')
    expect(useBoardStore.getState().boardsByKey['profile:p9']).toBeUndefined()
  })
})

describe('migrateBoardsToModeKeys (reine Seed-Funktion)', () => {
  const entry = (names) => ({
    boardPlayers: names.map((name, i) => ({ name, nname: name.toLowerCase(), rk: String(i + 1) })),
    boardMode: 'redraft', boardSource: 'market', rankingSource: 'FantasyCalc',
    marketMeta: null, csvRawText: '', lastImportStats: null,
  })

  it('der inhaltsreichste Eintrag gewinnt pro Modus', async () => {
    const { migrateBoardsToModeKeys } = await import('./useBoardStore')
    const raw = JSON.stringify({
      state: { boardsByKey: {
        'league:L1:redraft': entry(['A']),
        'league:L2:redraft': entry(['A', 'B', 'C']),
        'fp:12:ppr:0:nostarters:rookie': { ...entry(['R1', 'R2']), boardMode: 'rookie' },
      } },
      version: 0,
    })
    const next = migrateBoardsToModeKeys(raw)
    expect(next).not.toBeNull()
    const parsed = JSON.parse(next)
    expect(parsed.state.boardsByKey['mode:redraft'].boardPlayers).toHaveLength(3)
    expect(parsed.state.boardsByKey['mode:rookie'].boardPlayers).toHaveLength(2)
  })

  it('ist idempotent (zweiter Lauf: Ziel vorhanden -> null)', async () => {
    const { migrateBoardsToModeKeys } = await import('./useBoardStore')
    const raw = JSON.stringify({
      state: { boardsByKey: { 'league:L1:redraft': entry(['A']) } },
      version: 0,
    })
    const once = migrateBoardsToModeKeys(raw)
    expect(once).not.toBeNull()
    expect(migrateBoardsToModeKeys(once)).toBeNull()
  })

  it('loescht nichts (Quellen bleiben)', async () => {
    const { migrateBoardsToModeKeys } = await import('./useBoardStore')
    const raw = JSON.stringify({
      state: { boardsByKey: { 'league:L1:redraft': entry(['A', 'B']) } },
      version: 0,
    })
    const parsed = JSON.parse(migrateBoardsToModeKeys(raw))
    expect(parsed.state.boardsByKey['league:L1:redraft'].boardPlayers).toHaveLength(2)
    expect(parsed.state.boardsByKey['mode:redraft'].boardPlayers).toHaveLength(2)
  })

  it('leere Boards zaehlen nicht (kein Seed, null)', async () => {
    const { migrateBoardsToModeKeys } = await import('./useBoardStore')
    const raw = JSON.stringify({
      state: { boardsByKey: { 'league:L1:redraft': entry([]), 'fp:12:ppr:0:nostarters:redraft': entry([]) } },
      version: 0,
    })
    expect(migrateBoardsToModeKeys(raw)).toBeNull()
    expect(migrateBoardsToModeKeys(null)).toBeNull()
    expect(migrateBoardsToModeKeys('kein-json')).toBeNull()
  })
})
describe('moveBoard / deleteBoard', () => {
  // Persist-Pfad: das Fallback-Board (inkl. Inhalt und Herkunft) zieht auf
  // profile:<id> um, die Quelle verschwindet, Undo wirkt nicht profil-uebergreifend.
  it('moveBoard zieht den Eintrag inkl. Inhalt um', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().switchBoard('league:L1:redraft')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan', nname: 'bijan', rk: '1' }])
    useBoardStore.getState().setBoardSource('market')
    useBoardStore.getState().moveBoard('league:L1:redraft', 'profile:p1')
    const st = useBoardStore.getState()
    expect(st.boardsByKey['profile:p1'].boardPlayers[0].name).toBe('Bijan')
    expect(st.boardsByKey['profile:p1'].boardSource).toBe('market')
    expect(st.boardsByKey['league:L1:redraft']).toBeUndefined()
    expect(st.activeBoardKey).toBe('profile:p1')
    expect(st.lastBoardSnapshot).toBeNull()
  })

  // Delete-Pfad: der Profil-Cache geht weg, das aktive Top-Level-Board fasst
  // deleteBoard nicht an (BoardSection liest nur das aktive Board).
  it('deleteBoard loescht nur den Cache-Eintrag', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().switchBoard('profile:p1')
    useBoardStore.getState().setBoardPlayers([{ name: 'Jeanty', nname: 'jeanty', rk: '1' }])
    useBoardStore.getState().setBoardSource('market')
    expect(useBoardStore.getState().boardsByKey['profile:p1']).toBeTruthy()
    useBoardStore.getState().deleteBoard('profile:p1')
    expect(useBoardStore.getState().boardsByKey['profile:p1']).toBeUndefined()
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Jeanty')
  })
})

describe('Quota-Fix: Single-Source-Active, kein csvRawText im Cache, safeStorage', () => {
  // (a) Das geladene Board lebt nur Top-Level (kein Doppel-Speichern), beim
  // Weg-Wechseln sichert switchBoard es wieder weg — der Roundtrip bleibt.
  it('switchBoard loescht den geladenen Key aus dem Cache, Roundtrip sichert zurueck', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    const st = () => useBoardStore.getState()
    st().switchBoard('k:A')
    st().setBoardPlayers([{ name: 'A-Spieler', nname: 'a-spieler', rk: '1' }])
    st().setBoardSource('market')
    st().switchBoard('k:B')
    expect(st().boardPlayers).toEqual([])
    expect(st().boardsByKey['k:B']).toBeUndefined()
    st().setBoardPlayers([{ name: 'B-Spieler', nname: 'b-spieler', rk: '1' }])
    st().setBoardSource('market')
    st().switchBoard('k:A')
    expect(st().boardPlayers[0].name).toBe('A-Spieler')
    expect(st().boardsByKey['k:A']).toBeUndefined()
    expect(st().boardsByKey['k:B'].boardPlayers[0].name).toBe('B-Spieler')
    st().switchBoard('k:B')
    expect(st().boardPlayers[0].name).toBe('B-Spieler')
    expect(st().boardsByKey['k:B']).toBeUndefined()
    expect(st().boardsByKey['k:A'].boardPlayers[0].name).toBe('A-Spieler')
  })

  // (b) Der CSV-Rohtext ist gross und gehoert nur ins aktive Top-Level-Feld
  // (Import-Dialog) — pro Cache-Eintrag triebe er localStorage Richtung Quota.
  it('Cache-Eintraege enthalten kein csvRawText, Top-Level schon', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    const st = () => useBoardStore.getState()
    st().switchBoard('league:L1:redraft')
    st().setCsvRawText('RK,PLAYER NAME\n1,Testspieler')
    st().setBoardPlayers([{ name: 'Bijan', nname: 'bijan', rk: '1' }])
    st().setBoardSource('csv')
    expect('csvRawText' in st().boardsByKey['league:L1:redraft']).toBe(false)
    expect(st().csvRawText).toContain('Testspieler')
    st().moveBoard('league:L1:redraft', 'profile:p1')
    expect('csvRawText' in st().boardsByKey['profile:p1']).toBe(false)
    st().copyBoard('profile:p1', 'profile:p2')
    expect('csvRawText' in st().boardsByKey['profile:p2']).toBe(false)
  })

  // (c) Bei vollem localStorage wirft safeStorage den verzichtbaren Cache ab —
  // das aktive Top-Level-Board persistiert trotzdem. Das Storage wird per
  // stubGlobal ersetzt (spyOn greift auf der jsdom-Storage-Instanz nicht).
  it('safeStorage: Quota beim ersten setItem -> zweiter Call mit boardsByKey:{} und intaktem Board', async () => {
    const { safeStorage } = await import('./useBoardStore')
    const payload = JSON.stringify({
      state: {
        boardPlayers: [{ name: 'Bijan', nname: 'bijan', rk: '1' }],
        boardsByKey: { 'league:L1:redraft': { boardPlayers: [{ name: 'Alt' }] } },
      },
      version: 0,
    })
    const realLS = globalThis.localStorage
    const calls = []
    const quotaErr = () => {
      const e = new Error('The quota has been exceeded')
      e.name = 'QuotaExceededError'
      return e
    }
    let throwsLeft = 1
    vi.stubGlobal('localStorage', {
      getItem: (k) => realLS.getItem(k),
      setItem: (k, v) => {
        if (throwsLeft > 0) { throwsLeft -= 1; throw quotaErr() }
        calls.push([k, v])
      },
      removeItem: (k) => realLS.removeItem(k),
    })
    safeStorage.setItem('sdh-board-v1-test', payload)
    expect(calls).toHaveLength(1)
    const slim = JSON.parse(calls[0][1])
    expect(slim.state.boardsByKey).toEqual({})
    expect(slim.state.boardPlayers[0].name).toBe('Bijan')
  })

  // (d) Echte Fehler (kein Quota) duerfen nicht geschluckt werden.
  it('safeStorage: Nicht-Quota-Fehler werden weitergeworfen', async () => {
    const { safeStorage } = await import('./useBoardStore')
    const realLS = globalThis.localStorage
    vi.stubGlobal('localStorage', {
      getItem: (k) => realLS.getItem(k),
      setItem: () => { throw new Error('Platte kaputt') },
      removeItem: (k) => realLS.removeItem(k),
    })
    expect(() => safeStorage.setItem('sdh-board-v1-test', '{}')).toThrow('Platte kaputt')
  })
})
