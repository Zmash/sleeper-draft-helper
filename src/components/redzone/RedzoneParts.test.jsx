import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LeagueChips, GameStrip, gameClock, MyPlayers, ScoringTicker, RedzoneAlerts } from './RedzoneParts'

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
  it('listet meine und gegnerische Beteiligte im Alarm', () => {
    const alerts = [{ game: g('g1', 'CIN', 'TB', { isRedZone: true, downDistance: '1st & Goal at TB 5' }), mine: [p('P1', 'Joe Burrow', 'CIN')], opponents: [p('P3', 'Mike Gesicki', 'CIN')] }]
    render(<RedzoneAlerts alerts={alerts} />)
    expect(screen.getByText('1st & Goal at TB 5')).toBeInTheDocument()
    expect(screen.getByText('Joe Burrow')).toBeInTheDocument()
    expect(screen.getByText('Mike Gesicki')).toBeInTheDocument()
  })
  it('hebt neue Plays hervor', () => {
    const items = [{ play: { id: 'b', text: 'Joe Burrow 1 Yd Rush', teamAbbr: 'CIN', type: 'TD', period: 1, clock: '1:48' }, mine: [p('P1', 'Joe Burrow', 'CIN')], opponents: [], isNew: true }]
    const { container } = render(<ScoringTicker items={items} />)
    expect(container.querySelector('.rz-tick')).toHaveClass('is-new')
  })
})
