import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// SetupForm hat eigene, umfangreiche interne Logik (Schritte, Validierung, …), die fuer
// diesen Test irrelevant ist. Ein schlanker Stub ruft nur die Handler auf, die SetupPage
// selbst verdrahtet (wrappedCsvLoad, wrappedAutoImport, wrappedKtcImport) — genau die Naht,
// an der Minor 7 (ImportResultBanner-Wiring) und Blocker 4 (boardSource) sitzen.
vi.mock('../components/SetupForm', () => ({
  default: (props) => (
    <div>
      <button onClick={() => props.handleCsvLoad()}>DoCsvLoad</button>
      <button onClick={() => props.handleAutoImport()}>DoAutoImport</button>
    </div>
  ),
}))

const FFC = {
  ok: true,
  meta: { source: 'ffc', format: 'ppr', total_drafts: 10, end_date: '2026-07-16', fetched_at: '2026-07-16T12:00:00Z' },
  players: [{ name: 'Bijan Robinson', nname: 'bijan robinson', pos: 'RB', team: 'ATL', adp: 1.7, bye: 11, high: 1, low: 4 }],
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

async function setup() {
  const { default: SetupPage } = await import('./SetupPage')
  return render(
    <MemoryRouter initialEntries={['/setup']}>
      <SetupPage selectedLeague={null} selectedDraft={null} isAndroid={false} />
    </MemoryRouter>
  )
}

describe('SetupPage: CSV-Wiring (Blocker 4)', () => {
  it('setzt boardSource auf "csv" nach erfolgreichem CSV-Import', async () => {
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setCsvRawText('RK,PLAYER NAME,TEAM,POS\n1,Test Player,ATL,RB')
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers.length).toBe(1))
    expect(useBoardStore.getState().boardSource).toBe('csv')
  })
})

describe('SetupPage: ImportResultBanner-Wiring (Minor 7)', () => {
  it('Undo-Button ist verdrahtet: ruft undoImport und stellt das alte Board wieder her', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Handsortiert', nname: 'handsortiert', rk: '1' }])
    await setup()

    await userEvent.click(screen.getByRole('button', { name: 'DoAutoImport' }))
    // Board ist schon belegt -> Overwrite-Bestaetigung geht vor.
    await userEvent.click(await screen.findByRole('button', { name: 'Überschreiben' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /Rückgängig/ })).toBeTruthy())
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Bijan Robinson')

    await userEvent.click(screen.getByRole('button', { name: /Rückgängig/ }))
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Handsortiert')
    expect(screen.queryByRole('button', { name: /Rückgängig/ })).toBeNull()
  })

  it('CSV-Import bietet kein Undo an (handleCsvLoad setzt keinen Snapshot)', async () => {
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setCsvRawText('RK,PLAYER NAME,TEAM,POS\n1,Test Player,ATL,RB')
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    // Anchored: die CSV-Fixture hat keine BYE-WEEK-Spalte, daher zeigt das Banner
    // zusaetzlich "1 Spieler ohne Bye Week" — /1 Spieler/ ohne Anker matcht beides.
    await waitFor(() => expect(screen.getByText(/^1 Spieler$/)).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Rückgängig/ })).toBeNull()
  })
})

describe('SetupPage: Bye-Week-Ergaenzung im CSV-Import-Banner', () => {
  it('zeigt die Bye-Week-Zeile, wenn der CSV-Import Luecken hat', async () => {
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setCsvRawText(
      'RK,PLAYER NAME,TEAM,POS,BYE WEEK\n1,Test Player,ATL,RB,\n2,Other Player,KC,WR,7'
    )
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers.length).toBe(2))
    expect(screen.getByText(/1 Spieler ohne Bye Week/)).toBeTruthy()
  })

  it('Jetzt ergaenzen ruft fillMissingBye und aktualisiert die Zaehlung', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setCsvRawText('RK,PLAYER NAME,TEAM,POS,BYE WEEK\n1,Bijan Robinson,ATL,RB,')
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers.length).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: /Jetzt ergänzen/ }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers[0].bye).toBe(11))
    expect(screen.queryByText(/ohne Bye Week/)).toBeNull()
  })

  it('im Rookie-Modus erscheint kein "Jetzt ergaenzen"-Button, auch wenn Byes fehlen', async () => {
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setDraftMode('rookie')
    useBoardStore.getState().setCsvRawText(
      'RK,PLAYER NAME,TEAM,POS,BYE WEEK\n1,Test Player,ATL,RB,\n2,Other Player,KC,WR,7'
    )
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers.length).toBe(2))
    // Zeile bleibt sichtbar (Nutzer soll die Luecke sehen) — nur der Button fehlt,
    // weil fillMissingBye im Rookie-Modus ohnehin immer fehlschlaegt (Redraft-ADP
    // passt nicht auf Rookie-Raenge).
    expect(screen.getByText(/1 Spieler ohne Bye Week/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Jetzt ergänzen/ })).toBeNull()
  })

  it('fehlgeschlagenes fillMissingBye zeigt die Fehler-Banner statt still zu bleiben', async () => {
    // Weder sleeper-adp noch ffc-adp sind erreichbar -> fillMissingBye liefert
    // { ok: false, error: 'Marktdaten nicht erreichbar' } (siehe fetchMarketAdp).
    vi.stubGlobal('fetch', mockFetch({}))
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setCsvRawText('RK,PLAYER NAME,TEAM,POS,BYE WEEK\n1,Bijan Robinson,ATL,RB,')
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers.length).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: /Jetzt ergänzen/ }))
    expect(await screen.findByText(/Marktdaten nicht erreichbar/)).toBeTruthy()
  })
})
