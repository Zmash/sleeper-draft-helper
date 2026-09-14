import { describe, it, expect } from 'vitest'
import {
  optimalLineupByPoints, benchMisses, playerEntry, buildLeagueWeek, buildWeek,
  weekRecord, buildOutliers, buildInjuryReport, positionBreakdown, weekOptions, startSlots,
} from './weeklyModel'

const META = {
  QB1: { player_id: 'QB1', full_name: 'Joe Burrow', position: 'QB', fantasy_positions: ['QB'], team: 'CIN' },
  RB1: { player_id: 'RB1', full_name: 'Bijan Robinson', position: 'RB', fantasy_positions: ['RB'], team: 'ATL' },
  RB2: { player_id: 'RB2', full_name: 'Rico Dowdle', position: 'RB', fantasy_positions: ['RB'], team: 'DAL' },
  WR1: { player_id: 'WR1', full_name: "Ja'Marr Chase", position: 'WR', fantasy_positions: ['WR'], team: 'CIN' },
  WR2: { player_id: 'WR2', full_name: 'Jayden Reed', position: 'WR', fantasy_positions: ['WR'], team: 'GB', injury_status: 'Out' },
  TE1: { player_id: 'TE1', full_name: 'Mike Gesicki', position: 'TE', fantasy_positions: ['TE'], team: 'CIN' },
  SEA: { player_id: 'SEA', position: 'DEF', fantasy_positions: ['DEF'], team: null },
}

const game = (abbr, over = {}) => ({
  id: `g-${abbr}`, state: 'post', period: 4, clock: '0:00',
  home: { abbr, score: 20 }, away: { abbr: 'OPP', score: 17 }, ...over,
})
const BY_TEAM = {
  CIN: game('CIN'), ATL: game('ATL'), DAL: game('DAL'), GB: game('GB'),
  SEA: game('SEA', { state: 'in' }),
}

const ROSTER_POSITIONS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DEF', 'BN', 'BN', 'IR']

describe('startSlots', () => {
  it('laesst BN/IR/TAXI weg und behaelt die Reihenfolge', () => {
    expect(startSlots(['QB', 'RB', 'BN', 'FLEX', 'IR', 'TAXI'])).toEqual(['QB', 'RB', 'FLEX'])
  })
})

describe('optimalLineupByPoints', () => {
  const players = [
    { playerId: 'QB1', pos: 'QB', points: 22 },
    { playerId: 'RB1', pos: 'RB', points: 18 },
    { playerId: 'RB2', pos: 'RB', points: 4 },
    { playerId: 'WR1', pos: 'WR', points: 25 },
    { playerId: 'WR2', pos: 'WR', points: 9 },
    { playerId: 'TE1', pos: 'TE', points: 6 },
    { playerId: 'SEA', pos: 'DEF', points: 11 },
  ]

  it('besetzt feste Slots mit den Punktbesten und den FLEX aus dem Rest', () => {
    const { slots, points } = optimalLineupByPoints({ players, rosterPositions: ROSTER_POSITIONS })
    const bySlot = slots.map((s) => [s.slot, s.player ? s.player.playerId : null])
    expect(bySlot).toEqual([
      ['QB', 'QB1'], ['RB', 'RB1'], ['RB', 'RB2'], ['WR', 'WR1'], ['WR', 'WR2'],
      ['TE', 'TE1'], ['DEF', 'SEA'], ['FLEX', null],
    ])
    expect(points).toBeCloseTo(95)
  })

  it('fuellt FLEX aus dem Rest, wenn genug Spieler da sind', () => {
    const extra = [...players, { playerId: 'WR3', pos: 'WR', points: 14 }]
    const { slots } = optimalLineupByPoints({ players: extra, rosterPositions: ROSTER_POSITIONS })
    // WR1/WR3 besetzen die festen WR-Slots, der schwaechere WR2 rutscht in den FLEX.
    expect(slots.find((s) => s.slot === 'WR').player.playerId).toBe('WR1')
    expect(slots.find((s) => s.slot === 'FLEX').player.playerId).toBe('WR2')
  })

  it('besetzt SUPER_FLEX nach FLEX, weil es die weitere Eignung hat', () => {
    const { slots } = optimalLineupByPoints({
      players: [
        { playerId: 'QB1', pos: 'QB', points: 30 },
        { playerId: 'QB2', pos: 'QB', points: 24 },
        { playerId: 'RB1', pos: 'RB', points: 26 },
      ],
      rosterPositions: ['QB', 'SUPER_FLEX', 'FLEX'],
    })
    expect(slots.map((s) => [s.slot, s.player?.playerId])).toEqual([
      ['QB', 'QB1'], ['FLEX', 'RB1'], ['SUPER_FLEX', 'QB2'],
    ])
  })

  it('ohne Startslots gibt es kein Optimum', () => {
    expect(optimalLineupByPoints({ players, rosterPositions: ['BN', 'BN'] })).toEqual({ slots: [], points: 0 })
  })
})

describe('benchMisses', () => {
  it('paart Bankspieler, die ins Optimum gehoeren, mit den schwaechsten Startern', () => {
    const starters = [{ playerId: 'A', name: 'A', pos: 'RB', points: 3 }]
    const bench = [{ playerId: 'B', name: 'B', pos: 'RB', points: 20 }]
    const optimal = [{ slot: 'RB', player: bench[0] }]
    const misses = benchMisses({ starters, bench, optimal })
    expect(misses).toHaveLength(1)
    expect(misses[0].in.playerId).toBe('B')
    expect(misses[0].out.playerId).toBe('A')
    expect(misses[0].gain).toBeCloseTo(17)
  })

  it('meldet einen leeren Slot ohne Gegenspieler', () => {
    const bench = [{ playerId: 'B', name: 'B', pos: 'RB', points: 20 }]
    const misses = benchMisses({ starters: [], bench, optimal: [{ slot: 'FLEX', player: bench[0] }] })
    expect(misses).toEqual([{ in: bench[0], out: null, gain: 20 }])
  })

  it('meldet nichts, wenn die Aufstellung optimal war', () => {
    const starters = [{ playerId: 'A', pos: 'RB', points: 20 }]
    const bench = [{ playerId: 'B', pos: 'RB', points: 3 }]
    expect(benchMisses({ starters, bench, optimal: [{ slot: 'RB', player: starters[0] }] })).toEqual([])
  })
})

describe('playerEntry', () => {
  it('haengt Spiel, Status und Differenz zur Projektion an', () => {
    const e = playerEntry({ playerId: 'QB1', playersMeta: META, points: 28.4, projected: 20, byTeam: BY_TEAM })
    expect(e.name).toBe('Joe Burrow')
    expect(e.pos).toBe('QB')
    expect(e.state).toBe('post')
    expect(e.final).toBe(true)
    expect(e.delta).toBeCloseTo(8.4)
  })

  it('ohne Punkte oder Projektion bleibt die Differenz null', () => {
    const e = playerEntry({ playerId: 'QB1', playersMeta: META, points: null, projected: 20, byTeam: BY_TEAM })
    expect(e.points).toBeNull()
    expect(e.delta).toBeNull()
  })

  it('erkennt DEF ueber die Team-ID und markiert laufende Spiele als nicht final', () => {
    const e = playerEntry({ playerId: 'SEA', playersMeta: META, points: 5, projected: 7, byTeam: BY_TEAM })
    expect(e.pos).toBe('DEF')
    expect(e.team).toBe('SEA')
    expect(e.final).toBe(false)
  })
})

// ── Liga-Woche ──────────────────────────────────────────────────────────────

const LEAGUE = { league_id: 'L1', name: 'Büro-Liga', avatar: null, roster_positions: ROSTER_POSITIONS }
const ROSTERS = [
  { roster_id: 1, owner_id: 'me' },
  { roster_id: 2, owner_id: 'rival' },
  { roster_id: 3, owner_id: 'third' },
]
const USERS = [
  { user_id: 'me', display_name: 'Ich' },
  { user_id: 'rival', display_name: 'Rivale' },
  { user_id: 'third', display_name: 'Dritter' },
]
const MATCHUPS = [
  {
    roster_id: 1, matchup_id: 1, points: 100,
    starters: ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', '0', 'SEA'],
    players: ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'SEA'],
    players_points: { QB1: 28.4, RB1: 18, RB2: 2, WR1: 25, WR2: 0, TE1: 6, SEA: 5 },
  },
  {
    roster_id: 2, matchup_id: 1, points: 90,
    starters: ['WR1'], players: ['WR1'], players_points: { WR1: 25 },
  },
  { roster_id: 3, matchup_id: 2, points: 120, starters: [], players: [], players_points: {} },
]
const PROJ = { QB1: 20, RB1: 14, RB2: 9, WR1: 16, WR2: 11, TE1: 7, SEA: 7 }
const leagueArgs = {
  league: LEAGUE, matchups: MATCHUPS, rosters: ROSTERS, users: USERS, myUserId: 'me',
  playersMeta: META, byTeam: BY_TEAM, projectPlayer: (_l, id) => PROJ[id] ?? null,
}

describe('buildLeagueWeek', () => {
  it('baut Ergebnis, Wochenrang und Spielerlisten', () => {
    const l = buildLeagueWeek(leagueArgs)
    expect(l.myPoints).toBe(100)
    expect(l.opponentPoints).toBe(90)
    expect(l.opponentName).toBe('Rivale')
    // SEA laeuft noch -> die Woche ist nicht entschieden.
    expect(l.result).toBe('live')
    expect(l.openStarters).toBe(1)
    expect(l.margin).toBe(10)
    expect(l.rank).toBe(2)
    expect(l.teams).toBe(3)
    expect(l.leagueHigh).toBe(120)
    expect(l.starters.map((p) => p.playerId)).toEqual(['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'SEA'])
    expect(l.bench).toEqual([])
  })

  it('wertet abgeschlossene Wochen als Sieg oder Niederlage', () => {
    const byTeam = { ...BY_TEAM, SEA: game('SEA') }
    expect(buildLeagueWeek({ ...leagueArgs, byTeam }).result).toBe('win')
    const behind = MATCHUPS.map((m) => (m.roster_id === 2 ? { ...m, points: 140 } : m))
    expect(buildLeagueWeek({ ...leagueArgs, matchups: behind, byTeam }).result).toBe('loss')
  })

  const withBench = (over = {}) => {
    const playersMeta = {
      ...META,
      BENCHRB: { player_id: 'BENCHRB', full_name: 'Bank Held', position: 'RB', fantasy_positions: ['RB'], team: 'DAL' },
      WR3: { player_id: 'WR3', full_name: 'Dritter Receiver', position: 'WR', fantasy_positions: ['WR'], team: 'ATL' },
    }
    const matchups = MATCHUPS.map((m) => (m.roster_id === 1
      ? {
        ...m,
        ...over,
        players: [...m.players, 'BENCHRB', ...(over.starters ? ['WR3'] : [])],
        players_points: { ...m.players_points, BENCHRB: 21, ...(over.players_points || {}) },
      }
      : m))
    return buildLeagueWeek({ ...leagueArgs, matchups, playersMeta })
  }

  it('trennt Bank von Startern und rechnet Effizienz plus verschenkte Punkte', () => {
    // Der FLEX-Slot blieb leer ('0' in starters) -- die 21 Bankpunkte sind
    // vollstaendig verschenkt, es gibt keinen verdraengten Starter.
    const l = withBench()
    expect(l.bench.map((p) => p.playerId)).toEqual(['BENCHRB'])
    expect(l.pointsLeftOnBench).toBeCloseTo(21)
    expect(l.efficiency).toBeLessThan(1)
    expect(l.misses[0]).toMatchObject({ gain: 21, out: null })
    expect(l.misses[0].in.playerId).toBe('BENCHRB')
  })

  it('benennt den verdraengten Starter, wenn alle Slots besetzt waren', () => {
    const l = withBench({
      starters: ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'WR3', 'SEA'],
      players_points: { WR3: 1 },
    })
    // WR2 (0 Punkte) ist der einzige Starter, der aus dem Optimum faellt.
    expect(l.misses[0].in.playerId).toBe('BENCHRB')
    expect(l.misses[0].out.playerId).toBe('WR2')
    expect(l.misses[0].gain).toBeCloseTo(21)
  })

  it('gibt null zurueck, wenn ich in der Liga kein Team habe', () => {
    expect(buildLeagueWeek({ ...leagueArgs, myUserId: 'fremd' })).toBeNull()
  })

  it('kommt ohne Gegner aus (Freilos)', () => {
    const solo = [{ ...MATCHUPS[0], matchup_id: 9 }]
    const l = buildLeagueWeek({ ...leagueArgs, matchups: solo })
    expect(l.result).toBe('none')
    expect(l.opponentPoints).toBeNull()
    expect(l.margin).toBeNull()
  })
})

describe('buildWeek', () => {
  it('sammelt Ligen und Fehler getrennt', () => {
    const { leagues, errors } = buildWeek({
      leagueData: [
        { ...leagueArgs, league: LEAGUE },
        { league: { league_id: 'L2', name: 'Kaputt' }, error: 'HTTP 500' },
      ],
      myUserId: 'me',
      playersMeta: META,
      byTeam: BY_TEAM,
      projectPlayer: (_l, id) => PROJ[id] ?? null,
    })
    expect(leagues).toHaveLength(1)
    expect(errors).toEqual([{ leagueId: 'L2', leagueName: 'Kaputt', error: 'HTTP 500' }])
  })
})

// ── Auswertungen ────────────────────────────────────────────────────────────

const finished = () => buildLeagueWeek({ ...leagueArgs, byTeam: { ...BY_TEAM, SEA: game('SEA') } })

describe('weekRecord', () => {
  it('zaehlt Bilanz, Punkte und Trefferquote', () => {
    const r = weekRecord([finished()])
    expect(r).toMatchObject({ wins: 1, losses: 0, ties: 0, live: 0, leagues: 1, totalPoints: 100 })
    // Ueber Projektion: QB1, RB1, WR1 -> 3 von 7.
    expect(r.ratedStarters).toBe(7)
    expect(r.hitRate).toBeCloseTo(3 / 7)
  })

  it('zaehlt laufende Ligen separat', () => {
    expect(weekRecord([buildLeagueWeek(leagueArgs)])).toMatchObject({ live: 1, wins: 0 })
  })
})

describe('buildOutliers', () => {
  it('trennt Ueber- und Unterperformer und haelt laufende Spiele heraus', () => {
    const o = buildOutliers([buildLeagueWeek(leagueArgs)], { minDelta: 5 })
    expect(o.over.map((p) => p.playerId)).toEqual(['WR1', 'QB1'])
    expect(o.under.map((p) => p.playerId)).toEqual(['WR2', 'RB2'])
    expect(o.pending).toBe(1) // SEA laeuft noch
  })

  it('kann auf die Gegnerseite umschalten', () => {
    const o = buildOutliers([finished()], { minDelta: 5, side: 'opponents' })
    expect(o.over.map((p) => p.playerId)).toEqual(['WR1'])
  })

  it('begrenzt die Liste', () => {
    expect(buildOutliers([finished()], { minDelta: 0.1, limit: 1 }).over).toHaveLength(1)
  })
})

describe('buildInjuryReport', () => {
  it('meldet aufgestellte Ausfaelle mit der betroffenen Liga', () => {
    const report = buildInjuryReport([finished()])
    // WR2 ist 'Out' UND hat 0 Punkte -- der Ausfall-Status gewinnt.
    expect(report.map((p) => [p.playerId, p.severity])).toEqual([['WR2', 'out']])
    expect(report[0].startedIn.map((l) => l.leagueName)).toEqual(['Büro-Liga'])
    expect(report[0].benchedIn).toEqual([])
  })

  it('meldet Starter mit 0 Punkten im abgepfiffenen Spiel als Ausfall', () => {
    const matchups = MATCHUPS.map((m) => (m.roster_id === 1
      ? { ...m, players_points: { ...m.players_points, TE1: 0 } } : m))
    const report = buildInjuryReport([buildLeagueWeek({ ...leagueArgs, matchups, byTeam: { ...BY_TEAM, SEA: game('SEA') } })])
    expect(report.find((p) => p.playerId === 'TE1')).toMatchObject({ severity: 'dnp' })
  })

  it('erkennt Game-Day-Inactives, die nur im Kaderstatus stehen', () => {
    // injury_status leer, aber status 'Inactive' -- genau der Fall, den
    // isRuledOut abdeckt und eine reine injury_status-Pruefung verpasst.
    const playersMeta = { ...META, TE1: { ...META.TE1, status: 'Inactive' } }
    const report = buildInjuryReport([buildLeagueWeek({ ...leagueArgs, playersMeta })])
    expect(report.find((p) => p.playerId === 'TE1')).toMatchObject({ severity: 'out' })
  })

  it('stuft fraglich Aufgestellte als Beobachtung ein, nicht als Ausfall', () => {
    const playersMeta = { ...META, RB1: { ...META.RB1, injury_status: 'Questionable' } }
    const report = buildInjuryReport([buildLeagueWeek({ ...leagueArgs, playersMeta })])
    expect(report.find((p) => p.playerId === 'RB1')).toMatchObject({ severity: 'watch' })
  })

  it('meldet verletzte Bankspieler mit niedrigerer Dringlichkeit', () => {
    const matchups = MATCHUPS.map((m) => (m.roster_id === 1
      ? { ...m, starters: ['QB1'], players: ['QB1', 'WR2'] } : m))
    const report = buildInjuryReport([buildLeagueWeek({ ...leagueArgs, matchups })])
    expect(report.find((p) => p.playerId === 'WR2')).toMatchObject({ severity: 'bench' })
  })

  it('bleibt leer, wenn nichts auffaellt', () => {
    const playersMeta = { ...META, WR2: { ...META.WR2, injury_status: null } }
    const matchups = MATCHUPS.map((m) => (m.roster_id === 1
      ? { ...m, players_points: { ...m.players_points, WR2: 11 } } : m))
    expect(buildInjuryReport([buildLeagueWeek({ ...leagueArgs, playersMeta, matchups })])).toEqual([])
  })
})

describe('positionBreakdown', () => {
  it('summiert Punkte und Projektion je Position in fester Reihenfolge', () => {
    const rows = positionBreakdown([buildLeagueWeek(leagueArgs)])
    expect(rows.map((r) => r.pos)).toEqual(['QB', 'RB', 'WR', 'TE'])
    const wr = rows.find((r) => r.pos === 'WR')
    expect(wr.points).toBeCloseTo(25)
    expect(wr.projected).toBeCloseTo(27)
    expect(wr.delta).toBeCloseTo(-2)
    expect(wr.count).toBe(2)
  })
})

describe('weekOptions', () => {
  it('zaehlt absteigend von der laufenden Woche', () => {
    expect(weekOptions(3)).toEqual([3, 2, 1])
    expect(weekOptions(null)).toEqual([1])
    expect(weekOptions(25)).toHaveLength(18)
  })
})
