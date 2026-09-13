import { describe, it, expect } from 'vitest'
import {
  selectedLeagueIds, toggleLeague, soloLeague,
  gamesByTeam, carryPossession, playerGameState, playerTeam,
  buildMatchupTiles, buildPlayers, relevantTeams, countsByGame,
  buildRedzoneAlerts, matchScoringPlay, buildTicker,
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

const META = {
  P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB', fantasy_positions: ['QB'] },
  P2: { player_id: 'P2', full_name: "Ja'Marr Chase", team: 'CIN', position: 'WR', fantasy_positions: ['WR'] },
  P3: { player_id: 'P3', full_name: 'Mike Gesicki', team: 'CIN', position: 'TE', fantasy_positions: ['TE'] },
  P4: { player_id: 'P4', full_name: 'Josh Allen', team: 'BUF', position: 'QB', fantasy_positions: ['QB'] },
}
const GAMES = [game('g1', 'CIN', 'TB'), game('g2', 'HOU', 'BUF', { state: 'pre' })]
const BY_TEAM = gamesByTeam(GAMES)
const L1 = {
  league: { league_id: 'L1', name: 'Büro-Liga', avatar: null },
  rosters: [{ roster_id: 1, owner_id: 'me' }, { roster_id: 2, owner_id: 'u2' }],
  users: [{ user_id: 'u2', display_name: 'Kevin' }],
  matchups: [
    { roster_id: 1, matchup_id: 5, points: 48.3, starters: ['P1', 'P2'], players_points: { P1: 14.6, P2: 9.4 } },
    { roster_id: 2, matchup_id: 5, points: 61.9, starters: ['P3', '0'], players_points: { P3: 9.2 } },
  ],
}
const L2 = {
  league: { league_id: 'L2', name: 'Dynasty Bros', avatar: 'abc' },
  rosters: [{ roster_id: 7, owner_id: 'me' }, { roster_id: 8, owner_id: 'u8' }],
  users: [],
  matchups: [
    { roster_id: 7, matchup_id: 1, points: 50, starters: ['P1'], players_points: { P1: 16.1 } },
    { roster_id: 8, matchup_id: 1, points: 50, starters: ['P4'], players_points: { P4: 0 } },
  ],
}
const noProj = () => null
const base = { myUserId: 'me', byTeam: BY_TEAM, playersMeta: META, projectPlayer: noProj }

describe('buildMatchupTiles', () => {
  it('liefert Stand, Gegner, offene Starter und Punkteanteil ohne Projektion', () => {
    const [tile] = buildMatchupTiles({ ...base, leagueData: [L1] })
    expect(tile).toEqual({
      leagueId: 'L1', leagueName: 'Büro-Liga', leagueAvatar: null,
      myPoints: 48.3, opponentPoints: 61.9, opponentName: 'Kevin',
      myWinPct: 44, hasProjection: false, myOpen: 2, oppOpen: 1,
    })
  })
  it('nutzt die Siegchance, sobald beide Seiten Projektionen haben', () => {
    const [tile] = buildMatchupTiles({ ...base, leagueData: [L1], projectPlayer: () => 20 })
    expect(tile.hasProjection).toBe(true)
    expect(tile.myWinPct).toBeGreaterThanOrEqual(1)
    expect(tile.myWinPct).toBeLessThanOrEqual(99)
  })
  it('sortiert knappste Partie zuerst, Fehler zuletzt, Ligen ohne eigenes Team fallen raus', () => {
    const foreign = { ...L1, league: { league_id: 'L3', name: 'Fremd' }, rosters: [{ roster_id: 1, owner_id: 'x' }] }
    const broken = { league: { league_id: 'L4', name: 'Kaputt' }, error: 'HTTP 500' }
    const tiles = buildMatchupTiles({ ...base, leagueData: [broken, L1, L2, foreign] })
    expect(tiles.map((t) => t.leagueId)).toEqual(['L2', 'L1', 'L4'])
    expect(tiles[2]).toEqual({ leagueId: 'L4', leagueName: 'Kaputt', error: 'HTTP 500' })
  })
})

describe('buildPlayers', () => {
  const { mine, opponents } = buildPlayers({ ...base, leagueData: [L1, L2] })
  it('buendelt eigene Spieler ueber Ligen und nimmt die hoechsten Punkte', () => {
    const burrow = mine.find((p) => p.playerId === 'P1')
    expect(burrow.leagues.map((l) => l.leagueId)).toEqual(['L1', 'L2'])
    expect(burrow.points).toBe(16.1)
    expect(burrow.state).toBe('in')
    expect(burrow.game.id).toBe('g1')
  })
  it('listet Gegner-Starter getrennt und ignoriert leere Slots', () => {
    expect(opponents.map((p) => p.playerId).sort()).toEqual(['P3', 'P4'])
  })
  it('sortiert laufende Spiele vor anstehenden', () => {
    expect(opponents.map((p) => p.state)).toEqual(['in', 'pre'])
  })
})

describe('relevantTeams / countsByGame', () => {
  it('sammelt Teams aller eigenen und gegnerischen Starter', () => {
    expect([...relevantTeams({ leagueData: [L1, L2], myUserId: 'me', playersMeta: META })].sort()).toEqual(['BUF', 'CIN'])
  })
  it('zaehlt meine und gegnerische Starter je Spiel', () => {
    const players = buildPlayers({ ...base, leagueData: [L1, L2] })
    expect(countsByGame(GAMES, players)).toEqual({ g1: { mine: 2, opp: 1 }, g2: { mine: 0, opp: 1 } })
  })
})

const entry = (playerId, name, team, pos = 'WR') => ({ playerId, name, team, pos, state: 'in', leagues: [] })

describe('buildRedzoneAlerts', () => {
  const mine = [entry('P1', 'Joe Burrow', 'CIN', 'QB'), entry('P4', 'Josh Allen', 'BUF', 'QB')]
  const opponents = [entry('P3', 'Mike Gesicki', 'CIN', 'TE')]

  it('meldet Redzone-Spiele, in denen das Team mit Ballbesitz beteiligte Starter hat', () => {
    const g = game('g1', 'CIN', 'TB', { isRedZone: true, possessionAbbr: 'CIN' })
    const [alert] = buildRedzoneAlerts({ games: [g], mine, opponents })
    expect(alert.game.id).toBe('g1')
    expect(alert.mine.map((p) => p.playerId)).toEqual(['P1'])
    expect(alert.opponents.map((p) => p.playerId)).toEqual(['P3'])
  })
  it('ignoriert Redzone ohne Beteiligte, ohne Ballbesitz oder ausserhalb laufender Spiele', () => {
    const games = [
      game('a', 'TB', 'CIN', { isRedZone: true, possessionAbbr: 'TB' }),
      game('b', 'CIN', 'TB', { isRedZone: true, possessionAbbr: null }),
      game('c', 'CIN', 'TB', { isRedZone: true, possessionAbbr: 'CIN', state: 'post' }),
    ]
    expect(buildRedzoneAlerts({ games, mine, opponents })).toEqual([])
  })
})

describe('matchScoringPlay', () => {
  const play = (text, teamAbbr) => ({ id: text, text, teamAbbr, type: 'TD', period: 1, clockValue: 100 })

  it('findet Passer und Receiver im Text, beschraenkt aufs punktende Team', () => {
    const cands = [entry('P1', 'Joe Burrow', 'CIN'), entry('P3', 'Mike Gesicki', 'CIN'), entry('X', 'Ja\'Marr Chase', 'CIN')]
    const hits = matchScoringPlay(play('Mike Gesicki 2 Yd pass from Joe Burrow (Evan McPherson Kick)', 'CIN'), cands)
    expect(hits.map((p) => p.playerId)).toEqual(['P1', 'P3'])
  })
  it('gleicher Name in anderem Team ist kein Treffer, DEF trifft bei Defensiv-TD', () => {
    const cands = [entry('P4', 'Josh Allen', 'BUF', 'QB'), entry('JAX', 'Jacksonville Jaguars', 'JAX', 'DEF')]
    const hits = matchScoringPlay(play('Josh Allen 20 Yd Fumble Return (Cam Little Kick)', 'JAX'), cands)
    expect(hits.map((p) => p.playerId)).toEqual(['JAX'])
  })
  it('DEF trifft nicht bei normalem Offensiv-TD', () => {
    const cands = [entry('DET', 'Detroit Lions', 'DET', 'DEF')]
    expect(matchScoringPlay(play('Jahmyr Gibbs 1 Yd Rush (Jake Bates Kick)', 'DET'), cands)).toEqual([])
  })
})

describe('buildTicker', () => {
  it('liefert nur Plays mit Beteiligten, neueste zuerst, markiert neue', () => {
    const mine = [entry('P1', 'Joe Burrow', 'CIN'), entry('G', 'Jahmyr Gibbs', 'DET', 'RB')]
    const scoringPlaysByEvent = {
      g1: [
        { id: 'a', text: 'Chase McLaughlin 34 Yd Field Goal', teamAbbr: 'TB', period: 1, clockValue: 549 },
        { id: 'b', text: 'Mike Gesicki 2 Yd pass from Joe Burrow', teamAbbr: 'CIN', period: 1, clockValue: 108 },
      ],
      g2: [{ id: 'c', text: 'Jahmyr Gibbs 1 Yd Rush', teamAbbr: 'DET', period: 1, clockValue: 219 }],
    }
    const items = buildTicker({ scoringPlaysByEvent, mine, opponents: [], newPlayIds: ['b'] })
    expect(items.map((i) => i.play.id)).toEqual(['b', 'c'])
    expect(items[0].isNew).toBe(true)
    expect(items[1].mine.map((p) => p.playerId)).toEqual(['G'])
  })
})
