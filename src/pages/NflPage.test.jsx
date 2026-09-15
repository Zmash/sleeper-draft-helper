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
    setWeek: vi.fn(),
    load: vi.fn(() => Promise.resolve()),
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

  it('nennt zu jedem Spiel die deutschen Sender', () => {
    render(<NflPage />)
    // Nachtspiel: feste Uebertragung bei RTL und Sky.
    expect(screen.getAllByText('RTL').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sky Sport').length).toBeGreaterThan(0)
    expect(screen.getAllByText('NFL Game Pass')).toHaveLength(3)
    // Sonntagsfenster: nur eine Auswahl, das muss an der Karte stehen
    // (der gleichlautende Hinweis in der Legende zaehlt hier nicht mit).
    expect(screen.getAllByTitle(/Die Sender wählen pro Fenster/)).toHaveLength(2)
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

  it('sagt es, wenn eine Woche keine Spiele hat', () => {
    nfl.gamesByWeek = {}
    render(<NflPage />)
    expect(screen.getByText(/keine Spiele vor/)).toBeInTheDocument()
  })
})
