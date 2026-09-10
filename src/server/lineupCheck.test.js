import { describe, it, expect } from 'vitest'
import { composeMessage, checkUserLeagues } from './lineupCheck.js'

const warn = (over = {}) => ({
  leagueName: 'Dynasty', playerName: 'A.J. Brown', pos: 'WR', team: 'NE',
  severity: 'red', reason: 'out', ...over,
})

describe('composeMessage', () => {
  it('gibt null bei leeren Befunden', () => {
    expect(composeMessage({ warnings: [], pickups: [], type: 'morning' })).toBeNull()
  })

  it('meldet die rote Warnung mit Liga und Spieler', () => {
    const msg = composeMessage({ warnings: [warn()], pickups: [], type: 'pregame' })
    expect(msg.url).toBe('/lineup')
    expect(msg.title).toContain('Dynasty')
    expect(msg.body).toContain('A.J. Brown')
  })

  it('morning hängt den besten Pickup an', () => {
    const msg = composeMessage({
      warnings: [warn()],
      pickups: [{ name: 'Jordan Love', pos: 'QB', team: 'GB', leagueName: 'FFL' }],
      type: 'morning',
    })
    expect(msg.body).toContain('Jordan Love')
  })

  it('pregame ignoriert Pickups', () => {
    const msg = composeMessage({
      warnings: [warn()],
      pickups: [{ name: 'Jordan Love', pos: 'QB', team: 'GB', leagueName: 'FFL' }],
      type: 'pregame',
    })
    expect(msg.body).not.toContain('Jordan Love')
  })

  it('nur gelbe Warnungen werden auch gemeldet', () => {
    const msg = composeMessage({
      warnings: [warn({ severity: 'yellow', reason: 'better-on-bench', playerName: 'Jordan Addison' })],
      pickups: [], type: 'morning',
    })
    expect(msg).not.toBeNull()
    expect(msg.body).toContain('Jordan Addison')
  })
})

const meta = {
  1: { full_name: 'Out Spieler', fantasy_positions: ['WR'], team: 'NE', bye_week: 9, injury_status: 'Out' },
  2: { full_name: 'Bank Star', fantasy_positions: ['WR'], team: 'MIN', bye_week: 9, injury_status: null },
}
const deps = () => ({
  fetchLeagues: async () => [{ league_id: 'l1', name: 'Dynasty', roster_positions: ['WR', 'BN', 'BN'] }],
  fetchRosters: async () => [{ owner_id: 'u1', players: ['1', '2'], starters: ['1'] }],
  fetchMeta: async () => meta,
  weekRanks: async () => ({ weeklyById: new Map([['ID:1', 90], ['ID:2', 5]]), flexById: new Map(), sflexById: new Map() }),
  rosPicks: async () => [{ player_id: '9', name: 'Jordan Love', pos: 'QB', team: 'GB', leagueName: 'Dynasty' }],
  resolveUserId: async () => 'u1',
  week: '5',
})

describe('checkUserLeagues', () => {
  it('findet den aufgestellten Out-Spieler als rote Warnung', async () => {
    const { warnings } = await checkUserLeagues({ username: 'Zmash', season: '2026', deps: deps() })
    const out = warnings.find((w) => w.playerName === 'Out Spieler')
    expect(out.severity).toBe('red')
    expect(out.leagueName).toBe('Dynasty')
  })

  it('liefert Pickups aus rosPicks', async () => {
    const { pickups } = await checkUserLeagues({ username: 'Zmash', season: '2026', deps: deps() })
    expect(pickups[0].name).toBe('Jordan Love')
  })

  it('leere Ligen geben leere Befunde', async () => {
    const d = deps()
    d.fetchLeagues = async () => []
    expect(await checkUserLeagues({ username: 'x', season: '2026', deps: d })).toEqual({ warnings: [], pickups: [] })
  })

  it('leere Positionen geben keine suboptimal-Warnung', async () => {
    const d = deps()
    d.fetchLeagues = async () => [{ league_id: 'l1', name: 'Dynasty' }]
    d.fetchRosters = async () => [{ owner_id: 'u1', players: ['1', '2'], starters: ['2'] }]
    const { warnings } = await checkUserLeagues({ username: 'Zmash', season: '2026', deps: d })
    expect(warnings.filter((w) => w.reason === 'suboptimal' || w.reason === 'better-on-bench')).toEqual([])
  })

  it('leere Positionen: Out-Starter bleibt rot', async () => {
    const d = deps()
    d.fetchLeagues = async () => [{ league_id: 'l1', name: 'Dynasty' }]
    const { warnings } = await checkUserLeagues({ username: 'Zmash', season: '2026', deps: d })
    const out = warnings.find((w) => w.playerName === 'Out Spieler')
    expect(out?.severity).toBe('red')
    expect(out?.reason).toBe('out')
  })
})
