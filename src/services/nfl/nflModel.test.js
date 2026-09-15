import { describe, it, expect } from 'vitest'
import {
  sortGames, statusLabel, kickoffLabel, leaderAbbr, groupByGermanDay, withBroadcast, summarize, byeTeams,
} from './nflModel'

const game = (over = {}) => ({
  id: 'g1', date: '2026-09-20T17:00:00Z', state: 'pre', period: null, clock: '', detail: '',
  home: { abbr: 'CIN', score: 0 }, away: { abbr: 'TB', score: 0 }, ...over,
})

describe('statusLabel', () => {
  it('zeigt bei laufenden Spielen Viertel und Uhr', () => {
    expect(statusLabel(game({ state: 'in', period: 2, clock: '6:09' }))).toEqual({ text: 'Q2 6:09', tone: 'live' })
  })

  it('zeigt in der Verlaengerung OT statt Q5', () => {
    expect(statusLabel(game({ state: 'in', period: 5, clock: '2:00' })).text).toBe('OT 2:00')
  })

  it('faellt in Pausen auf ESPNs Kurztext zurueck', () => {
    expect(statusLabel(game({ state: 'in', period: 2, clock: '', detail: 'Halftime' })).text).toBe('Halftime')
  })

  it('unterscheidet Endstand und Endstand nach Verlaengerung', () => {
    expect(statusLabel(game({ state: 'post', period: 4 }))).toEqual({ text: 'Endstand', tone: 'final' })
    expect(statusLabel(game({ state: 'post', period: 5 })).text).toBe('Endstand (OT)')
  })

  it('zeigt vor dem Spiel den deutschen Kickoff', () => {
    expect(statusLabel(game())).toEqual({ text: 'So 19:00', tone: 'pre' })
    expect(kickoffLabel(game({ date: null }))).toBe('Termin offen')
  })
})

describe('leaderAbbr', () => {
  it('nennt das fuehrende Team, aber nicht bei Gleichstand oder vor dem Spiel', () => {
    expect(leaderAbbr(game({ state: 'in', home: { abbr: 'CIN', score: 14 }, away: { abbr: 'TB', score: 3 } }))).toBe('CIN')
    expect(leaderAbbr(game({ state: 'post', home: { abbr: 'CIN', score: 3 }, away: { abbr: 'TB', score: 14 } }))).toBe('TB')
    expect(leaderAbbr(game({ state: 'in', home: { abbr: 'CIN', score: 7 }, away: { abbr: 'TB', score: 7 } }))).toBeNull()
    expect(leaderAbbr(game())).toBeNull()
  })
})

describe('sortGames', () => {
  it('stellt laufende Spiele nach vorn, dann kommende, dann beendete', () => {
    const games = [
      game({ id: 'post', state: 'post' }),
      game({ id: 'pre2', date: '2026-09-20T20:25:00Z' }),
      game({ id: 'live', state: 'in' }),
      game({ id: 'pre1', date: '2026-09-20T17:00:00Z' }),
    ]
    expect(sortGames(games).map((g) => g.id)).toEqual(['live', 'pre1', 'pre2', 'post'])
  })
})

describe('groupByGermanDay', () => {
  it('gruppiert nach deutschem Kalendertag — das US-Sonntagabendspiel wird Montag', () => {
    const groups = groupByGermanDay([
      game({ id: 'snf', date: '2026-09-21T00:20:00Z' }),
      game({ id: 'early', date: '2026-09-20T17:00:00Z' }),
    ])
    expect(groups.map((g) => g.key)).toEqual(['2026-09-20', '2026-09-21'])
    expect(groups[0].label).toBe('Sonntag, 20. September')
    expect(groups[1].label).toBe('Montag, 21. September')
    expect(groups[1].games.map((g) => g.id)).toEqual(['snf'])
  })

  it('sortiert innerhalb eines Tages nach Anpfiff und sammelt Spiele ohne Termin', () => {
    const groups = groupByGermanDay([
      game({ id: 'spaet', date: '2026-09-20T20:25:00Z' }),
      game({ id: 'frueh', date: '2026-09-20T17:00:00Z' }),
      game({ id: 'offen', date: null }),
    ])
    expect(groups[0].games.map((g) => g.id)).toEqual(['frueh', 'spaet'])
    expect(groups.at(-1)).toMatchObject({ key: 'offen', label: 'Termin offen' })
  })
})

describe('withBroadcast', () => {
  it('haengt jedem Spiel seine deutschen Sender an', () => {
    const [g] = withBroadcast([game()], { week: 2, season: 2026 })
    expect(g.broadcast.short).toBe('SO 19')
    expect(g.broadcast.outlets.map((o) => o.name)).toContain('RTL')
    expect(g.id).toBe('g1') // Originalfelder bleiben erhalten
  })
})

describe('summarize', () => {
  it('zaehlt Zustaende und nennt den naechsten Kickoff', () => {
    const s = summarize([
      game({ id: 'a', state: 'in' }),
      game({ id: 'b', state: 'post' }),
      game({ id: 'c', date: '2026-09-20T20:25:00Z' }),
      game({ id: 'd', date: '2026-09-20T17:00:00Z' }),
    ])
    expect(s).toMatchObject({ total: 4, live: 1, final: 1, upcoming: 2 })
    expect(s.next.id).toBe('d')
  })

  it('kommt mit einer leeren Woche klar', () => {
    expect(summarize([])).toMatchObject({ total: 0, live: 0, final: 0, upcoming: 0, next: null })
  })
})

describe('byeTeams', () => {
  it('liest die Bye-Teams der Woche aus der gepflegten Tabelle', () => {
    expect(byeTeams(5, 2026)).toEqual(['CAR', 'KC'])
    expect(byeTeams(1, 2026)).toEqual([])
  })

  it('leer, wenn Saison oder Woche fehlen', () => {
    expect(byeTeams(5, 1999)).toEqual([])
    expect(byeTeams(null, 2026)).toEqual([])
  })
})
