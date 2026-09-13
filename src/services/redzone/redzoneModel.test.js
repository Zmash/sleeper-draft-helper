import { describe, it, expect } from 'vitest'
import {
  selectedLeagueIds, toggleLeague, soloLeague,
  gamesByTeam, carryPossession, playerGameState, playerTeam,
} from './redzoneModel'

const ALL = ['A', 'B', 'C']

describe('Liga-Filter', () => {
  it('ohne Abwahl sind alle Ligen aktiv', () => {
    expect(selectedLeagueIds(ALL, [])).toEqual(ALL)
  })
  it('abgewaehlte Ligen fallen raus; alles abgewaehlt zaehlt als alle', () => {
    expect(selectedLeagueIds(ALL, ['B'])).toEqual(['A', 'C'])
    expect(selectedLeagueIds(ALL, ['A', 'B', 'C'])).toEqual(ALL)
  })
  it('toggle waehlt ab und wieder an; die letzte Liga bleibt an', () => {
    expect(toggleLeague(ALL, [], 'B')).toEqual(['B'])
    expect(toggleLeague(ALL, ['B'], 'B')).toEqual([])
    expect(toggleLeague(ALL, ['A', 'B'], 'C')).toEqual(['A', 'B'])
  })
  it('toggle raeumt IDs verschwundener Ligen weg', () => {
    expect(toggleLeague(ALL, ['OLD'], 'A')).toEqual(['A'])
  })
  it('solo = nur diese Liga, nochmal = wieder alle', () => {
    expect(soloLeague(ALL, [], 'B')).toEqual(['A', 'C'])
    expect(soloLeague(ALL, ['A', 'C'], 'B')).toEqual([])
  })
  it('neue Ligen sind automatisch aktiv', () => {
    expect(selectedLeagueIds([...ALL, 'D'], ['B'])).toEqual(['A', 'C', 'D'])
  })
})

const game = (id, home, away, over = {}) => ({
  id, state: 'in', home: { abbr: home, score: 0 }, away: { abbr: away, score: 0 },
  possessionAbbr: null, isRedZone: false, ...over,
})

describe('Spielstatus', () => {
  const byTeam = gamesByTeam([game('1', 'CIN', 'TB'), game('2', 'GB', 'MIN', { state: 'pre' })])

  it('ordnet beide Teams ihrem Spiel zu', () => {
    expect(byTeam.CIN.id).toBe('1')
    expect(byTeam.TB.id).toBe('1')
  })
  it('liest den Status ueber das Team, DEF ueber die player_id', () => {
    expect(playerGameState({ team: 'CIN' }, byTeam)).toBe('in')
    expect(playerGameState({ team: 'MIN' }, byTeam)).toBe('pre')
    expect(playerGameState({ team: 'KC' }, byTeam)).toBe('none')
    expect(playerGameState(null, byTeam)).toBe('none')
    expect(playerTeam({ position: 'DEF', team: null }, 'cin')).toBe('CIN')
  })
  it('behaelt den letzten Ballbesitz, wenn ESPN ihn in Timeouts leert', () => {
    const prev = [game('1', 'CIN', 'TB', { possessionAbbr: 'CIN', isRedZone: true })]
    expect(carryPossession(prev, [game('1', 'CIN', 'TB', { isRedZone: true })])[0].possessionAbbr).toBe('CIN')
    expect(carryPossession(prev, [game('1', 'CIN', 'TB', { state: 'post' })])[0].possessionAbbr).toBeNull()
  })
})
