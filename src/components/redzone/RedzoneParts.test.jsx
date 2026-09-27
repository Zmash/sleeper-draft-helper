import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LeagueChips, GameStrip, gameClock, MyPlayers, PlayerTabs, MatchupRow, ScoringTicker, RedzoneAlerts, shortName } from './RedzoneParts'

const g = (id, home, away, over = {}) => ({
  id, state: 'in', period: 2, clock: '6:09', date: '2026-09-13T20:25Z',
  home: { abbr: home, score: 14 }, away: { abbr: away, score: 3 },
  possessionAbbr: home, isRedZone: false, downDistance: null, lastPlay: null, ...over,
})
const p = (playerId, name, team, over = {}) => ({
  playerId, name, team, pos: 'QB', state: 'in', game: g('g1', 'CIN', 'TB'), points: 14.6, projected: 22.1,
  leagues: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], ...over,
})

describe('LeagueChips', () => {
  const leagues = [{ id: 'L1', label: 'Büro-Liga', avatar: null }, { id: 'L2', label: 'Dynasty Bros', avatar: null }]

  it('Klick schaltet um, Doppelklick waehlt nur diese Liga', () => {
    const onToggle = vi.fn(); const onSolo = vi.fn()
    render(<LeagueChips leagues={leagues} activeIds={['L1']} onToggle={onToggle} onSolo={onSolo} />)
    const chip = screen.getByRole('button', { name: /Dynasty Bros/ })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(onToggle).toHaveBeenCalledWith('L2')
    fireEvent.doubleClick(chip)
    expect(onSolo).toHaveBeenCalledWith('L2')
  })

  it('Langdruck waehlt nur diese Liga und loest keinen Toggle aus', () => {
    vi.useFakeTimers()
    const onToggle = vi.fn(); const onSolo = vi.fn()
    render(<LeagueChips leagues={leagues} activeIds={['L1', 'L2']} onToggle={onToggle} onSolo={onSolo} />)
    const chip = screen.getByRole('button', { name: /Büro-Liga/ })
    fireEvent.pointerDown(chip)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.pointerUp(chip)
    fireEvent.click(chip)
    expect(onSolo).toHaveBeenCalledWith('L1')
    expect(onToggle).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('GameStrip', () => {
  it('zeigt laufende vor anstehenden vor beendeten Spielen und markiert die Redzone', () => {
    const games = [g('post', 'SF', 'LAR', { state: 'post' }), g('pre', 'GB', 'MIN', { state: 'pre' }), g('rz', 'CIN', 'TB', { isRedZone: true })]
    const { container } = render(<GameStrip games={games} counts={{ rz: { mine: 3, opp: 1 } }} />)
    const cards = [...container.querySelectorAll('.rz-game')]
    expect(cards.map((c) => c.dataset.id)).toEqual(['rz', 'pre', 'post'])
    expect(cards[0]).toHaveClass('is-redzone')
    expect(screen.getByText('RZ')).toBeInTheDocument()
  })
  it('formatiert Uhr je Status', () => {
    expect(gameClock(g('a', 'CIN', 'TB'))).toBe('Q2 6:09')
    expect(gameClock(g('b', 'CIN', 'TB', { state: 'post' }))).toBe('Final')
  })
})

describe('MyPlayers', () => {
  it('gruppiert nach Status und fasst mehrere Ligen zusammen', () => {
    const players = [
      p('P1', 'Joe Burrow', 'CIN', { leagues: [{ leagueId: 'L1', leagueName: 'A' }, { leagueId: 'L2', leagueName: 'B' }] }),
      p('P2', 'Jayden Reed', 'GB', { state: 'pre', points: null }),
    ]
    render(<MyPlayers players={players} />)
    expect(screen.getByText('Läuft')).toBeInTheDocument()
    expect(screen.getByText('Noch nicht')).toBeInTheDocument()
    expect(screen.getByText('2 Ligen')).toBeInTheDocument()
    expect(screen.getByText('14.6')).toBeInTheDocument()
  })
})

describe('RedzoneAlerts / ScoringTicker', () => {
  it('listet meine und gegnerische Beteiligte im Alarm, mit ihren Punkten', () => {
    const alerts = [{ game: g('g1', 'CIN', 'TB', { isRedZone: true, downDistance: '1st & Goal at TB 5' }), mine: [p('P1', 'Joe Burrow', 'CIN')], opponents: [p('P3', 'Mike Gesicki', 'CIN', { points: 3.1 })] }]
    render(<RedzoneAlerts alerts={alerts} />)
    expect(screen.getByText('1st & Goal at TB 5')).toBeInTheDocument()
    expect(screen.getByTitle('Joe Burrow')).toHaveTextContent('J. Burrow14.6')
    expect(screen.getByTitle('Mike Gesicki')).toHaveClass('rz-who--opp')
    expect(screen.getByTitle('Mike Gesicki')).toHaveTextContent('3.1')
  })
  it('rendert ohne Alarm nichts (die Seite zeigt "gerade ruhig" im Kopf)', () => {
    const { container } = render(<RedzoneAlerts alerts={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('zeigt im Ticker die erzeugten Punkte und nur die letzten fuenf Eintraege', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      play: { id: `x${i}`, text: `Play ${i}`, teamAbbr: 'CIN', type: 'TD', period: 4, clock: '1:00' },
      mine: [p('P1', 'Joe Burrow', 'CIN')], opponents: [], pts: { P1: 6.4 }, isNew: false,
    }))
    const { container } = render(<ScoringTicker items={items} />)
    expect(container.querySelectorAll('.rz-tick')).toHaveLength(5)
    expect(screen.getAllByText('+6.4')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Alle 7 anzeigen' }))
    expect(container.querySelectorAll('.rz-tick')).toHaveLength(7)
  })
  it('hebt neue Plays hervor', () => {
    const items = [{ play: { id: 'b', text: 'Joe Burrow 1 Yd Rush', teamAbbr: 'CIN', type: 'TD', period: 1, clock: '1:48' }, mine: [p('P1', 'Joe Burrow', 'CIN')], opponents: [], isNew: true }]
    const { container } = render(<ScoringTicker items={items} />)
    expect(container.querySelector('.rz-tick')).toHaveClass('is-new')
  })
})

describe('shortName', () => {
  it('kuerzt den Vornamen', () => {
    expect(shortName("Ja'Marr Chase")).toBe('J. Chase')
    expect(shortName('Amon-Ra St. Brown')).toBe('A. St. Brown')
    expect(shortName('Chase')).toBe('Chase')
  })
})

describe('PlayerTabs', () => {
  const mine = [
    p('P1', 'Joe Burrow', 'CIN'),
    p('P2', 'Jayden Reed', 'GB', { state: 'pre', points: null }),
    p('P5', 'Puka Nacua', 'LAR', { state: 'post', points: 21.3 }),
    p('P6', 'Bye Guy', 'NYJ', { state: 'none', points: null }),
  ]
  const opponents = [p('P3', 'Mike Gesicki', 'CIN', { points: 3.1 })]

  it('zaehlt je Reiter, startet auf Live und wechselt zu Gegner', () => {
    const { container } = render(<PlayerTabs mine={mine} opponents={opponents} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['Live 1', 'Noch nicht 1', 'Fertig 2', 'Gegner 1'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(container.querySelector('.rz-pane.is-active')).toHaveTextContent('Joe Burrow')
    fireEvent.click(tabs[3])
    expect(container.querySelector('.rz-pane.is-active')).toHaveClass('rz-pane--opp')
    expect(container.querySelector('.rz-pane.is-active')).toHaveTextContent('Mike Gesicki')
  })
  it('ohne Live-Spieler startet der erste Reiter mit Inhalt', () => {
    render(<PlayerTabs mine={mine.slice(1)} opponents={[]} />)
    expect(screen.getByRole('tab', { name: /Noch nicht/ })).toHaveAttribute('aria-selected', 'true')
  })
  it('Fertig enthaelt auch Spieler ohne Spiel', () => {
    const { container } = render(<PlayerTabs mine={mine} opponents={opponents} />)
    fireEvent.click(screen.getByRole('tab', { name: /Fertig/ }))
    const pane = container.querySelector('.rz-pane.is-active')
    expect(pane).toHaveTextContent('Puka Nacua')
    expect(pane).toHaveTextContent('Kein Spiel')
  })
})

describe('MatchupRow', () => {
  it('eine kompakte Zeile je Liga mit Stand und Siegchance', () => {
    const tiles = [
      { leagueId: 'L1', leagueName: 'Büro-Liga', leagueAvatar: null, myPoints: 112.4, opponentPoints: 98.7, opponentName: 'Max', myWinPct: 71, myOpen: 3, oppOpen: 2 },
      { leagueId: 'L2', leagueName: 'Dynasty Bros', error: 'HTTP 500' },
    ]
    const { container } = render(<MatchupRow tiles={tiles} />)
    const rows = container.querySelectorAll('.rz-mt')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('112.4–98.771%')
    expect(rows[0]).toHaveAttribute('title', 'gegen Max · offen: 3 ich · 2 Gegner')
    expect(rows[1]).toHaveTextContent('nicht geladen')
  })
})
