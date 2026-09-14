import { describe, it, expect } from 'vitest'
import {
  optimalLineupByPoints, benchMisses, playerEntry, buildLeagueWeek, buildWeek,
  weekRecord, buildOutliers, buildInjuryReport, positionBreakdown, weekOptions, startSlots,
  actualSlotAssignment, alignOptimalToActual,
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
const sumPoints = (list) => list.reduce((a, p) => a + (p.points ?? 0), 0)

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
    // Ausgabe in Roster-Reihenfolge (FLEX vor DEF), damit sie sich Slot fuer
    // Slot gegen die tatsaechliche Aufstellung legen laesst.
    expect(bySlot).toEqual([
      ['QB', 'QB1'], ['RB', 'RB1'], ['RB', 'RB2'], ['WR', 'WR1'], ['WR', 'WR2'],
      ['TE', 'TE1'], ['FLEX', null], ['DEF', 'SEA'],
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
    // Besetzt wird QB -> FLEX -> SUPER_FLEX, ausgegeben in Roster-Reihenfolge.
    expect(slots.map((s) => [s.slot, s.player?.playerId])).toEqual([
      ['QB', 'QB1'], ['SUPER_FLEX', 'QB2'], ['FLEX', 'RB1'],
    ])
  })

  it('ohne Startslots gibt es kein Optimum', () => {
    expect(optimalLineupByPoints({ players, rosterPositions: ['BN', 'BN'] })).toEqual({ slots: [], points: 0 })
  })
})

describe('actualSlotAssignment', () => {
  it('haelt die Zuordnung ueber die 0-Platzhalter hinweg stabil', () => {
    const a = { playerId: 'A', pos: 'QB' }
    const b = { playerId: 'B', pos: 'WR' }
    const rows = actualSlotAssignment({
      rosterPositions: ['QB', 'RB', 'WR', 'BN'],
      rawStarters: ['A', '0', 'B'],
      byId: new Map([['A', a], ['B', b]]),
    })
    // Ohne den '0'-Platzhalter waere B faelschlich im RB-Slot gelandet.
    expect(rows).toEqual([{ slot: 'QB', player: a }, { slot: 'RB', player: null }, { slot: 'WR', player: b }])
  })
})

describe('alignOptimalToActual', () => {
  const slot = (s, player) => ({ slot: s, player })

  it('laesst Spieler in gleichnamigen Slots auf ihrem Platz', () => {
    const rb1 = { playerId: 'RB1', pos: 'RB', points: 18 }
    const rb2 = { playerId: 'RB2', pos: 'RB', points: 2 }
    const gem = { playerId: 'GEM', pos: 'RB', points: 21 }
    // Das Optimum setzt den Punktbesten in den ERSTEN RB-Slot; tatsaechlich
    // stand dort RB1. Nach dem Ausrichten bleibt RB1, GEM ersetzt RB2.
    const aligned = alignOptimalToActual(
      [slot('RB', gem), slot('RB', rb1)],
      [slot('RB', rb1), slot('RB', rb2)]
    )
    expect(aligned.map((s) => s.player.playerId)).toEqual(['RB1', 'GEM'])
  })

  it('laesst einzelne Slots unveraendert', () => {
    const a = { playerId: 'A', pos: 'QB', points: 9 }
    expect(alignOptimalToActual([slot('QB', a)], [slot('QB', null)])).toEqual([slot('QB', a)])
  })
})

describe('benchMisses', () => {
  const slot = (s, player) => ({ slot: s, player })

  it('paart den Bankspieler mit dem schwaechsten Starter auf einem zulaessigen Slot', () => {
    const weakRb = { playerId: 'A', name: 'A', pos: 'RB', points: 3 }
    const gem = { playerId: 'B', name: 'B', pos: 'RB', points: 20 }
    const misses = benchMisses({
      actualSlots: [slot('RB', weakRb)],
      optimal: [slot('RB', gem)],
    })
    expect(misses).toHaveLength(1)
    expect(misses[0]).toMatchObject({ slot: 'RB', gain: 17 })
    expect(misses[0].in.playerId).toBe('B')
    expect(misses[0].out.playerId).toBe('A')
  })

  it('paart NIE ueber Positionsgrenzen hinweg', () => {
    // Der Befund aus der Praxis: Bank-QB (26.6) und Start-RB (2.3) wurden
    // gepaart, obwohl sie sich in dieser Liga keinen Slot teilen koennen.
    const rb = { playerId: 'GAINWELL', name: 'Kenny Gainwell', pos: 'RB', points: 2.3 }
    const benchQb = { playerId: 'DART', name: 'Jaxson Dart', pos: 'QB', points: 26.6 }
    const startedQb = { playerId: 'QB1', name: 'Starter QB', pos: 'QB', points: 9 }
    const misses = benchMisses({
      actualSlots: [slot('QB', startedQb), slot('RB', rb)],
      // Optimal steht Dart im QB-Slot -- verdraengt wird also der QB, nie der RB.
      optimal: [slot('QB', benchQb), slot('RB', rb)],
    })
    expect(misses).toHaveLength(1)
    expect(misses[0]).toMatchObject({ slot: 'QB' })
    expect(misses[0].out.playerId).toBe('QB1')
    expect(misses[0].gain).toBeCloseTo(17.6)
  })

  it('setzt einen Bankspieler in den FLEX, wenn dort der schwaechste sitzt', () => {
    const rb1 = { playerId: 'RB1', pos: 'RB', points: 18 }
    const flexDud = { playerId: 'WRX', pos: 'WR', points: 1.2 }
    const gem = { playerId: 'GEM', pos: 'WR', points: 22 }
    const misses = benchMisses({
      actualSlots: [slot('RB', rb1), slot('FLEX', flexDud)],
      optimal: [slot('RB', rb1), slot('FLEX', gem)],
    })
    expect(misses[0]).toMatchObject({ slot: 'FLEX', gain: 20.8 })
  })

  it('meldet einen leeren Slot ohne Gegenspieler', () => {
    const gem = { playerId: 'B', name: 'B', pos: 'RB', points: 20 }
    const misses = benchMisses({ actualSlots: [slot('FLEX', null)], optimal: [slot('FLEX', gem)] })
    expect(misses).toEqual([{ slot: 'FLEX', in: gem, out: null, gain: 20 }])
  })

  it('meldet nichts, wenn die Aufstellung optimal war', () => {
    const a = { playerId: 'A', pos: 'RB', points: 20 }
    expect(benchMisses({ actualSlots: [slot('RB', a)], optimal: [slot('RB', a)] })).toEqual([])
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
    // BENCHRB (21) uebernimmt den RB-Slot von RB2 (2). Dass RB2 dadurch den
    // leeren FLEX besetzt, ist eine Folge-Umbesetzung -- die restlichen 2
    // Punkte der Differenz stecken dort, nicht in einer eigenen Zeile.
    expect(l.misses[0]).toMatchObject({ slot: 'RB', gain: 19 })
    expect(l.misses[0].in.playerId).toBe('BENCHRB')
    expect(l.misses[0].out.playerId).toBe('RB2')
  })

  it('zaehlt NUR die Differenz zum Optimum, nicht die Bankpunkte', () => {
    // Zwei Bankspieler mit zusammen 33.4 Punkten, aber nur einer (BENCHRB)
    // haette ueberhaupt in die Aufstellung gehoert -- und auch nur mit dem
    // Zugewinn gegenueber dem leeren FLEX-Slot. Die Summe der Bankpunkte darf
    // hier nie herauskommen.
    const playersMeta = {
      ...META,
      BENCHRB: { player_id: 'BENCHRB', full_name: 'Bank Held', position: 'RB', fantasy_positions: ['RB'], team: 'DAL' },
      BENCHQB: { player_id: 'BENCHQB', full_name: 'Bank Backup', position: 'QB', fantasy_positions: ['QB'], team: 'CIN' },
    }
    const matchups = MATCHUPS.map((m) => (m.roster_id === 1
      ? {
        ...m,
        players: [...m.players, 'BENCHRB', 'BENCHQB'],
        players_points: { ...m.players_points, BENCHRB: 21, BENCHQB: 12.4 },
      }
      : m))
    const l = buildLeagueWeek({ ...leagueArgs, matchups, playersMeta })
    expect(l.bench.map((p) => p.playerId)).toEqual(['BENCHRB', 'BENCHQB'])
    // Bankpunkte gesamt waeren 33.4 -- der Backup-QB hat aber keinen Slot
    // (QB1 hat mehr) und zaehlt deshalb gar nicht.
    expect(l.pointsLeftOnBench).toBeCloseTo(21)
    expect(l.optimalPoints - sumPoints(l.starters)).toBeCloseTo(l.pointsLeftOnBench)
  })

  it('meldet 0 verschenkte Punkte, wenn die Bank nichts gebracht haette', () => {
    const playersMeta = {
      ...META,
      BENCHRB: { player_id: 'BENCHRB', full_name: 'Bank Niete', position: 'RB', fantasy_positions: ['RB'], team: 'DAL' },
    }
    // Bankspieler mit 1.0 Punkten: besetzt zwar den leeren FLEX, bringt aber
    // fast nichts -- verschenkt sind genau diese 1.0, nicht mehr.
    const matchups = MATCHUPS.map((m) => (m.roster_id === 1
      ? { ...m, players: [...m.players, 'BENCHRB'], players_points: { ...m.players_points, BENCHRB: 1 } }
      : m))
    const l = buildLeagueWeek({ ...leagueArgs, matchups, playersMeta })
    expect(l.pointsLeftOnBench).toBeCloseTo(1)
  })

  it('benennt den verdraengten Starter, wenn alle Slots besetzt waren', () => {
    const l = withBench({
      starters: ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'WR3', 'SEA'],
      players_points: { WR3: 1 },
    })
    // BENCHRB (21) uebernimmt den RB-Slot des schwaechsten RB (RB2, 2 Punkte) --
    // nicht den von RB1 (18), obwohl das Optimum ihn intern zuerst besetzt.
    expect(l.misses).toHaveLength(1)
    expect(l.misses[0]).toMatchObject({ slot: 'RB', gain: 19 })
    expect(l.misses[0].in.playerId).toBe('BENCHRB')
    expect(l.misses[0].out.playerId).toBe('RB2')
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

  it('summiert die verschenkten Punkte ueber alle Ligen', () => {
    const l = finished()
    expect(weekRecord([l, l]).pointsLeftOnBench).toBeCloseTo(l.pointsLeftOnBench * 2)
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
