import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'

const side = (abbr, score, over = {}) => ({ abbr, score, name: abbr, logo: null, record: '1-0', ...over })
const game = (id, over = {}) => ({
  id, date: '2026-09-20T17:00:00Z', state: 'pre', period: null, clock: '', detail: '',
  home: side('CIN', 0), away: side('TB', 0), possessionAbbr: null, isRedZone: false,
  downDistance: null, network: 'FOX', venue: null, neutralSite: false, ...over,
})

let nfl
vi.mock('../stores/useSessionStore', () => {
  const state = { seasonYear: '2026' }
  const hook = (sel) => (sel ? sel(state) : state)
  hook.getState = () => state
  return { useSessionStore: hook }
})
vi.mock('../stores/useNflStore', () => ({ useNflStore: () => nfl }))

import NflPage from './NflPage'

beforeEach(() => {
  nfl = {
    week: 3,
    currentWeek: 3,
    season: 2026,
    gamesByWeek: {
      3: [
        game('early'),
        game('snf', { date: '2026-09-21T00:20:00Z', state: 'in', period: 3, clock: '7:42', possessionAbbr: 'CIN',
          home: side('CIN', 21), away: side('TB', 17) }),
        game('late', { date: '2026-09-20T20:25:00Z', state: 'post', period: 4, home: side('GB', 31), away: side('DET', 24) }),
      ],
    },
    lastUpdated: Date.now(),
    loading: false,
    error: null,
    standings: [],
    standingsAt: null,
    standingsLoading: false,
    standingsError: null,
    setWeek: vi.fn(),
    load: vi.fn(() => Promise.resolve()),
    loadStandings: vi.fn(() => Promise.resolve()),
  }
})

describe('NflPage', () => {
  it('gruppiert nach deutschem Kalendertag — das Nachtspiel steht unter Montag', () => {
    render(<NflPage />)
    const days = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(days[0]).toContain('Sonntag, 20. September')
    expect(days[1]).toContain('Montag, 21. September')
  })

  it('zeigt Live-Stand mit Viertel und Uhr, Endstand und deutschen Kickoff', () => {
    render(<NflPage />)
    expect(screen.getByText('Q3 7:42')).toBeInTheDocument()
    expect(screen.getByText('Endstand')).toBeInTheDocument()
    expect(screen.getByText('So 19:00')).toBeInTheDocument()
    expect(screen.getByText('1 LIVE')).toBeInTheDocument()
  })

  it('nennt zu jedem Spiel die deutschen Sender, aber nicht den Game Pass', () => {
    render(<NflPage />)
    expect(screen.getAllByText('RTL').length).toBe(3)
    expect(screen.getAllByText('Sky').length).toBe(3)
    // Der Game Pass zeigt ohnehin jedes Spiel -- er steht nur in der Legende,
    // nicht an jeder Zeile.
    expect(screen.queryByTitle('NFL Game Pass')).not.toBeInTheDocument()
    // Sonntagsfenster: nur eine Auswahl, das muss an der Zeile stehen.
    expect(screen.getAllByTitle(/Die Sender zeigen je ein Spiel/)).toHaveLength(2)
  })

  it('filtert auf laufende Spiele', () => {
    render(<NflPage />)
    fireEvent.click(screen.getByRole('button', { name: /Läuft/ }))
    expect(screen.getByText('Q3 7:42')).toBeInTheDocument()
    expect(screen.queryByText('Endstand')).not.toBeInTheDocument()
  })

  it('blaettert die Spielwoche ueber den Store', () => {
    render(<NflPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Woche zurück' }))
    expect(nfl.setWeek).toHaveBeenCalledWith(2)
    fireEvent.click(screen.getByRole('button', { name: '5' }))
    expect(nfl.setWeek).toHaveBeenCalledWith(5)
  })

  it('laedt beim Mounten und auf Knopfdruck neu', () => {
    render(<NflPage />)
    expect(nfl.load).toHaveBeenCalledWith({ season: '2026', force: false })
    fireEvent.click(screen.getByRole('button', { name: /Aktualisieren/ }))
    expect(nfl.load).toHaveBeenCalledWith({ season: '2026', force: true })
  })

  // Der Grund, warum der Punktestand immer gerendert wird: fehlt das Element,
  // verrutscht die Zahlenspalte gegen die Nachbarzeilen.
  it('reserviert die Punktespalte auch vor dem Anpfiff und zeigt keine Bilanz', () => {
    nfl.gamesByWeek = { 3: [
      game('vorspiel'),
      game('final', { state: 'post', period: 4, home: side('GB', 31), away: side('DET', 7) }),
    ] }
    const { container } = render(<NflPage />)
    const lines = container.querySelectorAll('.nfl-team')
    expect(lines).toHaveLength(4)
    for (const line of lines) expect(line.querySelectorAll('.nfl-score')).toHaveLength(1)
    // Die Saisonbilanz gehoert in die Tabelle, nicht in die Spielzeile.
    expect(container.querySelectorAll('.nfl-rec')).toHaveLength(0)
    expect(screen.queryByText('1-0')).not.toBeInTheDocument()
    // Vor dem Anpfiff bleibt der Platz leer, statt "–" zu wiederholen.
    expect(within(lines[0]).getByText('', { selector: '.nfl-score' })).toBeInTheDocument()
    expect(within(lines[3]).getByText('31', { selector: '.nfl-score' })).toBeInTheDocument()
  })

  it('zeigt die Bye-Teams der Woche', () => {
    nfl.week = 5
    nfl.gamesByWeek = { 5: [game('a')] }
    render(<NflPage />)
    expect(screen.getByText(/CAR · KC/)).toBeInTheDocument()
  })

  it('meldet einen ESPN-Ausfall, ohne den letzten Stand zu verwerfen', () => {
    nfl.error = 'Spieldaten gerade nicht verfügbar (ESPN).'
    render(<NflPage />)
    expect(screen.getByText(nfl.error)).toBeInTheDocument()
    expect(screen.getByText('Q3 7:42')).toBeInTheDocument()
  })

  it('zeigt die Tabelle erst nach dem Umschalten und holt sie dann nach', () => {
    render(<NflPage />)
    expect(nfl.loadStandings).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('tab', { name: 'Tabelle' }))
    expect(nfl.loadStandings).toHaveBeenCalledWith({ season: '2026' })
    // Ohne Daten steht da ein Satz, keine leeren Tabellen.
    expect(screen.getByText(/noch keine Tabelle/)).toBeInTheDocument()
    // Der Wochenwähler gehört zur Spieleansicht und verschwindet mit ihr.
    expect(screen.queryByRole('button', { name: 'Woche zurück' })).not.toBeInTheDocument()
  })

  it('gruppiert die Tabelle nach Division und sortiert innerhalb', () => {
    const t = (abbr, wins, losses, differential) => ({
      abbr, name: abbr, logo: null, wins, losses, ties: 0, played: wins + losses,
      winPercent: wins / (wins + losses), pointsFor: null, pointsAgainst: null,
      differential, streak: null, divisionRecord: null, playoffSeed: null,
    })
    nfl.standings = [t('CLE', 0, 2, -21), t('BAL', 2, 0, 15), t('PIT', 1, 1, -5), t('CIN', 1, 1, 9)]
    render(<NflPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Tabelle' }))

    // Acht Divisionen, jede mit vier Zeilen — auch die ohne Daten.
    expect(screen.getAllByRole('table')).toHaveLength(8)
    const north = screen.getByRole('table', { name: 'Tabelle AFC North' })
    const rows = within(north).getAllByRole('row').slice(1) // ohne Kopfzeile
    expect(rows.map((r) => within(r).getByText(/^[A-Z]{2,3}$/).textContent)).toEqual(['BAL', 'CIN', 'PIT', 'CLE'])
    expect(within(rows[0]).getByText('2-0')).toBeInTheDocument()
    expect(within(rows[0]).getByText('+15')).toBeInTheDocument()
    expect(within(rows[3]).getByText('-21')).toBeInTheDocument()
    // Teams ohne Datensatz bleiben sichtbar, statt die Division zu verkuerzen.
    const east = screen.getByRole('table', { name: 'Tabelle AFC East' })
    expect(within(east).getAllByRole('row').slice(1)).toHaveLength(4)
    expect(within(east).getAllByText('—')).toHaveLength(4)
  })

  it('aktualisiert in der Tabellenansicht die Tabelle, nicht den Spielplan', () => {
    render(<NflPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Tabelle' }))
    nfl.load.mockClear()
    nfl.loadStandings.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /Aktualisieren/ }))
    expect(nfl.loadStandings).toHaveBeenCalledWith({ season: '2026', force: true })
    expect(nfl.load).not.toHaveBeenCalled()
  })

  it('sagt es, wenn eine Woche keine Spiele hat', () => {
    nfl.gamesByWeek = {}
    render(<NflPage />)
    expect(screen.getByText(/keine Spiele vor/)).toBeInTheDocument()
  })
})
