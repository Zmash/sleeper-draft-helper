import { describe, it, expect } from 'vitest'
import { median, rosterValueSplit, teamPowerRanking, ageProfile, starterVsBenchSplit } from './rosterStats'

describe('median', () => {
  it('ungerade Anzahl -> mittlerer Wert', () => {
    expect(median([3, 1, 2])).toBe(2)
  })
  it('gerade Anzahl -> Mittel der beiden mittleren', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('leere Liste -> null statt NaN', () => {
    expect(median([])).toBeNull()
  })
  it('sortiert numerisch, nicht lexikografisch', () => {
    expect(median([1, 10, 9])).toBe(9)
  })
})

const board = [
  { sleeper_id: '1', nname: 'a a', pos: 'RB', ecr: 5, dynasty_value: 100 },
  { sleeper_id: '2', nname: 'b b', pos: 'RB', ecr: 50, dynasty_value: 40 },
  { sleeper_id: '3', nname: 'c c', pos: 'RB', ecr: 80, dynasty_value: 10 },
]
// leagueRosters fuehrt seit Befund 1 je Spieler ein angereichertes Objekt
// (sleeper_id, name, nname, pos), nicht mehr die rohe Sleeper-ID -- siehe
// useDynastyStore.js loadDynastyRoster.
const rosters = [
  { roster_id: 1, players: [{ sleeper_id: '1', nname: 'a a' }] },   // starker RB
  { roster_id: 2, players: [{ sleeper_id: '2', nname: 'b b' }] },
  { roster_id: 3, players: [{ sleeper_id: '3', nname: 'c c' }] },   // schwacher RB
]

describe('rosterValueSplit', () => {
  it('mit dynasty_value: Summe je Position gegen den Liga-Median', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('value')
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(100)
    expect(rb.median).toBe(40)     // Median aus 100, 40, 10
    expect(rb.diff).toBe(60)
  })

  it('ohne dynasty_value: rangbasiert, positives diff heisst weiterhin besser', () => {
    const ohneWert = board.map(({ dynasty_value, ...rest }) => rest)
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('rank')
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(5)        // bester eigener RB
    expect(rb.median).toBe(50)     // Median aus 5, 50, 80
    expect(rb.diff).toBe(45)       // median - mine, weil kleiner Rang besser ist
  })

  it('Deckungsgrad zaehlt gematchte Kaderspieler', () => {
    const mitUnbekannt = [
      { roster_id: 1, players: [{ sleeper_id: '1', nname: 'a a' }, { sleeper_id: '999', nname: 'unbekannt x' }] },
      ...rosters.slice(1),
    ]
    const r = rosterValueSplit({
      leagueRosters: mitUnbekannt, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.coverage).toBeCloseTo(3 / 4)
  })

  it('ein einzelner Kader: Median ist der eigene Wert, diff 0', () => {
    const r = rosterValueSplit({
      leagueRosters: [rosters[0]], boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.teamCount).toBe(1)
    expect(r.positions.find((p) => p.pos === 'RB').diff).toBe(0)
  })

  it('ohne leagueRosters -> leere, gueltige Struktur', () => {
    const r = rosterValueSplit({
      leagueRosters: [], boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.positions).toEqual([])
    expect(r.coverage).toBe(0)
  })

  it('unbekanntes myRosterId -> mine und diff null, Median bleibt gueltig', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 99,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBeNull()
    expect(rb.diff).toBeNull()
    expect(rb.median).toBe(40)
  })

  it('Befund 1: Spieler mit leerem ECR wird im Rangmodus gefiltert, nicht als bester sortiert', () => {
    // Testfall: ein Spieler mit ecr: '' (wird zu Number('') = 0, also sehr gut wenn nicht gefiltert)
    // und ein Spieler mit ecr: 50 (legitim)
    const boardWithEmptyECR = [
      { sleeper_id: '1', nname: 'bad', pos: 'RB', ecr: '', dynasty_value: 10 },
      { sleeper_id: '2', nname: 'good', pos: 'RB', ecr: 50, dynasty_value: 5 },
    ]
    const rostersForEmpty = [
      { roster_id: 1, players: [{ sleeper_id: '1', nname: 'bad' }] },  // nur Spieler mit ecr: ''
      { roster_id: 2, players: [{ sleeper_id: '2', nname: 'good' }] },  // Spieler mit ecr: 50
    ]
    const ohneWert = boardWithEmptyECR.map(({ dynasty_value, ...rest }) => rest)
    const r = rosterValueSplit({
      leagueRosters: rostersForEmpty, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    // Der Spieler mit leerem ECR sollte gefiltert werden, daher mine = null
    expect(rb.mine).toBeNull()
    // Der Median sollte nur den gültigen Rang enthalten (50)
    expect(rb.median).toBe(50)
  })

  it('Rangmodus: eigenes Team schlechter als Median -> diff negativ', () => {
    // Testfall: eigenes Team hat Rang 80 (schlecht), Liga-Median ist 50 (besser)
    // diff sollte negativ sein: median - mine = 50 - 80 = -30
    const rankBoard = [
      { sleeper_id: '1', nname: 'my worst', pos: 'RB', ecr: 80 },
      { sleeper_id: '2', nname: 'league best', pos: 'RB', ecr: 5 },
      { sleeper_id: '3', nname: 'league mid', pos: 'RB', ecr: 50 },
    ]
    const rankRosters = [
      { roster_id: 1, players: [{ sleeper_id: '1', nname: 'my worst' }] },  // mein schlechter Rang
      { roster_id: 2, players: [{ sleeper_id: '2', nname: 'league best' }] },  // Liga: bester
      { roster_id: 3, players: [{ sleeper_id: '3', nname: 'league mid' }] },  // Liga: mittler
    ]
    const r = rosterValueSplit({
      leagueRosters: rankRosters, boardPlayers: rankBoard, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(80)
    expect(rb.median).toBe(50)
    expect(rb.diff).toBe(-30)  // negativ, weil ich schlechter bin
  })

  it('Wertmodus: eigenes Team schlechter als Median -> diff negativ', () => {
    // Testfall: eigenes Team hat value 10 (niedrig), Liga-Median ist 50 (besser)
    // diff sollte negativ sein: mine - median = 10 - 50 = -40
    const valueBoard = [
      { sleeper_id: '1', nname: 'my low', pos: 'RB', dynasty_value: 10 },
      { sleeper_id: '2', nname: 'league high', pos: 'RB', dynasty_value: 100 },
      { sleeper_id: '3', nname: 'league mid', pos: 'RB', dynasty_value: 50 },
    ]
    const valueRosters = [
      { roster_id: 1, players: [{ sleeper_id: '1', nname: 'my low' }] },  // mein niedriger Wert
      { roster_id: 2, players: [{ sleeper_id: '2', nname: 'league high' }] },  // Liga: höchster
      { roster_id: 3, players: [{ sleeper_id: '3', nname: 'league mid' }] },  // Liga: Median
    ]
    const r = rosterValueSplit({
      leagueRosters: valueRosters, boardPlayers: valueBoard, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(10)
    expect(rb.median).toBe(50)
    expect(rb.diff).toBe(-40)  // negativ, weil ich schlechter bin
  })

  it('Rangmodus: Spieler mit leerem ECR wird nicht vor gültigem Rang sortiert', () => {
    // Befund 2: Ein Spieler mit ecr: '' würde durch Number('') = 0 als bester Rang einsortiert,
    // wenn nicht gefiltert. Testfall: zwei Spieler an RB im eigenen Kader (einer ecr: '', einer ecr: 30),
    // nur ein Starter-Slot. Der gültige Spieler (30) sollte den Slot bekommen, nicht der leere.
    const boardWithEmptyAndValid = [
      { sleeper_id: '10', nname: 'empty ecr', pos: 'RB', ecr: '' },
      { sleeper_id: '11', nname: 'valid ecr 30', pos: 'RB', ecr: 30 },
      { sleeper_id: '12', nname: 'valid ecr 50', pos: 'RB', ecr: 50 },
    ]
    const rostersWithBoth = [
      // mein Kader: einer mit leerem ECR, einer mit 30
      { roster_id: 1, players: [{ sleeper_id: '10', nname: 'empty ecr' }, { sleeper_id: '11', nname: 'valid ecr 30' }] },
      { roster_id: 2, players: [{ sleeper_id: '12', nname: 'valid ecr 50' }] },        // zweiter Kader mit 50, damit Median entsteht
    ]
    const r = rosterValueSplit({
      leagueRosters: rostersWithBoth,
      boardPlayers: boardWithEmptyAndValid,
      rosterPositions: ['RB'],  // 1 Starter-Slot an RB
      myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    // Mit neuer Implementierung: Filter entfernt ecr:'', nur ecr:30 bleibt im Kader 1 -> mine = 30
    // Mit alter Implementierung (ohne Filter): ecr:'' wird zu Number('') = 0, sortiert vor 30 -> mine = 0 (BUG)
    expect(rb.mine).toBe(30)
    expect(rb.median).toBe(40)  // (30 + 50) / 2
  })

  it('Befund 1 (Betrieb): falsche sleeper_id im Board wird ueber nname aufgefangen', () => {
    // Im echten Board tragen die ersten ~250 Eintraege ihre Zeilennummer statt der
    // echten Sleeper-ID -- "Jahmyr Gibbs" hat dort sleeper_id "1". Der Kaderspieler
    // vom Sleeper-Kader-Endpoint traegt dagegen die echte ID. sleeper_id-Abgleich
    // schlaegt hier bewusst fehl, der Name muss die Bruecke schlagen.
    const brokenBoard = [
      { sleeper_id: '1', nname: 'jahmyr gibbs', pos: 'RB', ecr: 3, dynasty_value: 9000 },
    ]
    const rostersRealId = [
      { roster_id: 1, players: [{ sleeper_id: '4866', nname: 'jahmyr gibbs' }] },
      { roster_id: 2, players: [] },
    ]
    const r = rosterValueSplit({
      leagueRosters: rostersRealId, boardPlayers: brokenBoard, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.totalPlayers).toBe(1)
    expect(r.coverage).toBe(1)
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(9000)
  })

  it('Befund 2: laufender Draft liefert leere Kader -> totalPlayers 0, nicht mit Deckungsproblem verwechselbar', () => {
    const leereKader = [
      { roster_id: 1, players: [] },
      { roster_id: 2, players: [] },
    ]
    const r = rosterValueSplit({
      leagueRosters: leereKader, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.totalPlayers).toBe(0)
    expect(r.coverage).toBe(0)
    expect(r.teamCount).toBe(2)
  })

  it('rank: Wertmodus zaehlt Teams mit hoeherem Wert, +1', () => {
    // Werte 100/40/10 -- mein Team (100) hat niemanden ueber sich -> Platz 1
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.rank).toBe(1)
    expect(rb.teamCount).toBe(3)
  })

  it('rank: Rangmodus zaehlt Teams mit kleinerem (besserem) ECR, +1', () => {
    // ECR 5/50/80 -- mein Team (5) hat niemanden mit kleinerem ECR -> Platz 1
    const ohneWert = board.map(({ dynasty_value, ...rest }) => rest)
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.rank).toBe(1)
  })

  it('rank: mittleres Team liegt auf Platz 2 von 3', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 2,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.rank).toBe(2)
  })

  it('rank: unbekanntes myRosterId -> null statt falscher Platzierung', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 99,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.rank).toBeNull()
  })
})

describe('teamPowerRanking', () => {
  it('Wertmodus: summiert Starter-Werte je Team ueber alle Positionen und rankt absteigend', () => {
    const mixedBoard = [
      { sleeper_id: '1', nname: 'my rb', pos: 'RB', dynasty_value: 100 },
      { sleeper_id: '2', nname: 'my qb', pos: 'QB', dynasty_value: 50 },
      { sleeper_id: '3', nname: 'their rb', pos: 'RB', dynasty_value: 30 },
    ]
    const mixedRosters = [
      { roster_id: 1, players: [{ sleeper_id: '1', nname: 'my rb' }, { sleeper_id: '2', nname: 'my qb' }] },
      { roster_id: 2, players: [{ sleeper_id: '3', nname: 'their rb' }] },
    ]
    const r = teamPowerRanking({
      leagueRosters: mixedRosters, boardPlayers: mixedBoard, rosterPositions: ['QB', 'RB'], myRosterId: 1,
      rosterToUserMap: { 1: 'U1' }, ownerLabels: new Map([['user:U1', 'Mein Team']]),
    })
    expect(r.available).toBe(true)
    expect(r.mode).toBe('value')
    expect(r.myRank).toBe(1)
    expect(r.myMetric).toBe(150)
    expect(r.teams[0].label).toBe('Mein Team')
    expect(r.teams[1].metric).toBe(30)
  })

  it('ohne rosterToUserMap-Eintrag: Platzhalter-Label statt Absturz', () => {
    const r = teamPowerRanking({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.teams.find((t) => t.rosterId === 1).label).toBe('Team 1')
  })

  it('Rangmodus (Redraft, kein dynasty_value): rankt Teams je Position und mittelt die Platzierungen', () => {
    // RB: 5(bestes)/50/80 -> Rang 1/2/3. QB: 10/20/30 -> Rang 1/2/3.
    // Team 1 ist ueberall Rang 1 -> Schnitt 1, klar bestes Gesamt-Team.
    const mixedBoard = [
      { sleeper_id: '1', nname: 'rb best', pos: 'RB', ecr: 5 },
      { sleeper_id: '2', nname: 'rb mid', pos: 'RB', ecr: 50 },
      { sleeper_id: '3', nname: 'rb worst', pos: 'RB', ecr: 80 },
      { sleeper_id: '4', nname: 'qb best', pos: 'QB', ecr: 10 },
      { sleeper_id: '5', nname: 'qb mid', pos: 'QB', ecr: 20 },
      { sleeper_id: '6', nname: 'qb worst', pos: 'QB', ecr: 30 },
    ]
    const mixedRosters = [
      { roster_id: 1, players: [{ sleeper_id: '1', nname: 'rb best' }, { sleeper_id: '4', nname: 'qb best' }] },
      { roster_id: 2, players: [{ sleeper_id: '2', nname: 'rb mid' }, { sleeper_id: '5', nname: 'qb mid' }] },
      { roster_id: 3, players: [{ sleeper_id: '3', nname: 'rb worst' }, { sleeper_id: '6', nname: 'qb worst' }] },
    ]
    const r = teamPowerRanking({
      leagueRosters: mixedRosters, boardPlayers: mixedBoard, rosterPositions: ['QB', 'RB'], myRosterId: 1,
    })
    expect(r.available).toBe(true)
    expect(r.mode).toBe('rank')
    expect(r.myRank).toBe(1)
    expect(r.myMetric).toBe(1)              // Rang 1 bei RB und QB -> Schnitt 1
    expect(r.teams[0].positionsCounted).toBe(2)
    expect(r.teams[2].metric).toBe(3)       // durchgehend Letzter -> Schnitt 3
  })

  it('Rangmodus: ohne Dynasty-Werte trotzdem verfuegbar (keine Wertkurve erfunden, nur Rang-Aggregation)', () => {
    const ohneWert = board.map(({ dynasty_value, ...rest }) => rest)
    const r = teamPowerRanking({
      leagueRosters: rosters, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('rank')
    expect(r.available).toBe(true)
  })

  it('Standings-Modus: sobald Spiele stattfanden, zaehlt die echte Bilanz statt der Board-Raenge', () => {
    // Ohne dynasty_value, aber die Saison laeuft schon (roster.settings hat
    // Spiele) -> muss auf 'standings' umschalten statt beim Board-Rang zu bleiben.
    const ohneWert = board.map(({ dynasty_value, ...rest }) => rest)
    const mitBilanz = [
      { ...rosters[0], settings: { wins: 8, losses: 2, ties: 0, fpts: 1024, fpts_decimal: 56, fpts_against: 900, fpts_against_decimal: 0 } },
      { ...rosters[1], settings: { wins: 5, losses: 5, ties: 0, fpts: 1024, fpts_decimal: 56, fpts_against: 950, fpts_against_decimal: 0 } },
      { ...rosters[2], settings: { wins: 2, losses: 8, ties: 0, fpts: 800, fpts_decimal: 0, fpts_against: 1100, fpts_against_decimal: 0 } },
    ]
    const r = teamPowerRanking({
      leagueRosters: mitBilanz, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('standings')
    expect(r.myRank).toBe(1)
    expect(r.teams[0].record).toBe('8-2')
    // Gleiche Sieg-Quote, hoehere Punkte-Bilanz gewinnt den Tiebreak.
    const gleicheQuote = teamPowerRanking({
      leagueRosters: [
        { ...rosters[0], settings: { wins: 5, losses: 5, fpts: 1000, fpts_against: 900 } },
        { ...rosters[1], settings: { wins: 5, losses: 5, fpts: 1100, fpts_against: 900 } },
        { ...rosters[2], settings: { wins: 0, losses: 0 } },
      ],
      boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 2,
    })
    expect(gleicheQuote.teams[0].rosterId).toBe(2) // mehr Punkte bei gleicher Bilanz -> Platz 1
  })

  it('Rangmodus: nur ein Team an einer Position -> Position zaehlt nicht in den Schnitt', () => {
    // Nur ein Team hat einen RB im Fixture "rosters"/"board" -- eine
    // Ein-Team-Rangliste sagt nichts aus und darf den Schnitt nicht verfaelschen.
    const einzelBoard = [{ sleeper_id: '1', nname: 'solo rb', pos: 'RB', ecr: 5 }]
    const einzelRoster = [{ roster_id: 1, players: [{ sleeper_id: '1', nname: 'solo rb' }] }]
    const r = teamPowerRanking({
      leagueRosters: einzelRoster, boardPlayers: einzelBoard, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.available).toBe(false)
    expect(r.teams).toEqual([])
  })

  it('Befund (echte Daten, Zmash/Dynasty League Bochum): Rookie-Only-Board mit hohem dynasty_value-Vorkommen bleibt trotzdem gesperrt, wenn kaum ein Kaderspieler matcht', () => {
    // Reproduziert den realen Bug: ein Rookie-Only-Board (z.B. KTC Rookies,
    // ~50 Spieler) erfuellt hasValue=true locker, matcht aber nur eine
    // Handvoll Kaderspieler pro Team (die paar eigenen Rookies). Ohne
    // Deckungs-Check wirkte die Tabelle vollstaendig befuellt, zeigte aber
    // nur "wie viele wertvolle Rookies besitzt dieses Team" statt echter
    // Kaderstaerke.
    const rookieBoard = [
      { sleeper_id: '1', nname: 'team1 rookie', pos: 'RB', dynasty_value: 5000 },
      { sleeper_id: '2', nname: 'team2 rookie', pos: 'RB', dynasty_value: 3000 },
    ]
    // Jedes Team hat 10 Spieler, aber nur einer davon (der Rookie) steht im Board.
    const veteranPlayer = (n) => ({ sleeper_id: `v${n}`, nname: `veteran ${n}` })
    const sparseRosters = [
      { roster_id: 1, players: [{ sleeper_id: '1', nname: 'team1 rookie' }, ...Array.from({ length: 9 }, (_, i) => veteranPlayer(`1${i}`))] },
      { roster_id: 2, players: [{ sleeper_id: '2', nname: 'team2 rookie' }, ...Array.from({ length: 9 }, (_, i) => veteranPlayer(`2${i}`))] },
    ]
    const r = teamPowerRanking({
      leagueRosters: sparseRosters, boardPlayers: rookieBoard, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('value')          // hasValue ist erfuellt, das Board HAT dynasty_value
    expect(r.available).toBe(false)       // aber die Deckung (2 von 20) ist viel zu duenn
    expect(r.reason).toBe('low-coverage')
    expect(r.coverage).toBeCloseTo(2 / 20)
  })
})

describe('ageProfile', () => {
  const rostersWithAge = [
    { roster_id: 1, players: [{ nname: 'a', pos: 'RB', age: 24 }, { nname: 'b', pos: 'RB', age: 26 }] },
    { roster_id: 2, players: [{ nname: 'c', pos: 'RB', age: 30 }] },
    { roster_id: 3, players: [{ nname: 'd', pos: 'RB', age: 32 }] },
  ]

  it('mittelt das eigene Alter je Position und vergleicht mit dem Liga-Median', () => {
    const r = ageProfile({ leagueRosters: rostersWithAge, rosterPositions: ['RB', 'RB'], myRosterId: 1 })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(25)          // (24+26)/2
    expect(rb.leagueMedian).toBe(30)  // Median aus 25, 30, 32
    expect(rb.diff).toBe(-5)          // 5 Jahre juenger als die Liga
  })

  it('Spieler ohne Altersangabe werden nicht mitgezaehlt statt als 0 zu verfaelschen', () => {
    const mitLuecke = [
      { roster_id: 1, players: [{ nname: 'a', pos: 'RB', age: 24 }, { nname: 'b', pos: 'RB', age: null }] },
      { roster_id: 2, players: [{ nname: 'c', pos: 'RB', age: 30 }] },
    ]
    const r = ageProfile({ leagueRosters: mitLuecke, rosterPositions: ['RB'], myRosterId: 1 })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(24) // nur der Spieler mit Alter zaehlt, nicht (24+0)/2
  })

  it('Position ohne Starter-Slot taucht nicht auf', () => {
    const r = ageProfile({ leagueRosters: rostersWithAge, rosterPositions: ['QB'], myRosterId: 1 })
    expect(r.positions.find((p) => p.pos === 'RB')).toBeUndefined()
  })
})

describe('starterVsBenchSplit', () => {
  const valueBoard = [
    { sleeper_id: '1', nname: 'starter rb', pos: 'RB', dynasty_value: 100 },
    { sleeper_id: '2', nname: 'bench rb', pos: 'RB', dynasty_value: 20 },
    { sleeper_id: '3', nname: 'taxi wr', pos: 'WR', dynasty_value: 15 },
  ]
  const roster = [
    { sleeper_id: '1', nname: 'starter rb', slot: 'starter' },
    { sleeper_id: '2', nname: 'bench rb', slot: 'bench' },
    { sleeper_id: '3', nname: 'taxi wr', slot: 'taxi' },
  ]

  it('Wertmodus: summiert Dynasty-Wert je Slot-Kategorie', () => {
    const r = starterVsBenchSplit({ dynastyRoster: roster, boardPlayers: valueBoard })
    expect(r.available).toBe(true)
    expect(r.mode).toBe('value')
    expect(r.value.starter).toBe(100)
    expect(r.value.bench).toBe(20)
    expect(r.value.taxi).toBe(15)
    expect(r.total).toBe(135)
    expect(r.starterShare).toBeCloseTo(100 / 135)
  })

  it('ungematchte Spieler zaehlen nicht mit', () => {
    const r = starterVsBenchSplit({
      dynastyRoster: [...roster, { sleeper_id: '999', nname: 'unbekannt', slot: 'bench' }],
      boardPlayers: valueBoard,
    })
    expect(r.matched).toBe(3)
  })

  it('Rangmodus (Redraft, kein dynasty_value): Durchschnitts-ECR je Kategorie statt Summe', () => {
    const rankBoard = [
      { sleeper_id: '1', nname: 'starter rb', pos: 'RB', ecr: 5 },
      { sleeper_id: '2', nname: 'starter wr', pos: 'WR', ecr: 15 },
      { sleeper_id: '3', nname: 'bench rb', pos: 'RB', ecr: 60 },
      { sleeper_id: '4', nname: 'bench wr', pos: 'WR', ecr: 100 },
    ]
    const rankRoster = [
      { sleeper_id: '1', nname: 'starter rb', slot: 'starter' },
      { sleeper_id: '2', nname: 'starter wr', slot: 'starter' },
      { sleeper_id: '3', nname: 'bench rb', slot: 'bench' },
      { sleeper_id: '4', nname: 'bench wr', slot: 'bench' },
    ]
    const r = starterVsBenchSplit({ dynastyRoster: rankRoster, boardPlayers: rankBoard })
    expect(r.available).toBe(true)
    expect(r.mode).toBe('rank')
    expect(r.avgRank.starter).toBe(10)  // (5+15)/2
    expect(r.avgRank.bench).toBe(80)    // (60+100)/2
    expect(r.total).toBeUndefined()     // kein erfundener Summenwert im Rangmodus
    expect(r.starterShare).toBeUndefined()
  })

  it('Rangmodus: Kategorie ohne Spieler bleibt null statt 0 vorzutaeuschen', () => {
    const rankBoard = [{ sleeper_id: '1', nname: 'nur starter', pos: 'RB', ecr: 5 }]
    const rankRoster = [{ sleeper_id: '1', nname: 'nur starter', slot: 'starter' }]
    const r = starterVsBenchSplit({ dynastyRoster: rankRoster, boardPlayers: rankBoard })
    expect(r.avgRank.bench).toBeNull()
    expect(r.count.bench).toBe(0)
  })

  it('ohne gematchte Spieler nicht verfuegbar', () => {
    const r = starterVsBenchSplit({ dynastyRoster: [], boardPlayers: valueBoard })
    expect(r.available).toBe(false)
    expect(r.reason).toBe('no-match')
  })

  it('Befund (echte Daten): Rookie-Only-Board matcht nur 1 von 10 eigenen Spielern -> zu duenn statt irrefuehrend befuellt', () => {
    const rookieBoard = [{ sleeper_id: '1', nname: 'mein rookie', pos: 'RB', dynasty_value: 5000 }]
    const meinKader = [
      { sleeper_id: '1', nname: 'mein rookie', slot: 'bench' },
      ...Array.from({ length: 9 }, (_, i) => ({ sleeper_id: `v${i}`, nname: `veteran ${i}`, slot: 'starter' })),
    ]
    const r = starterVsBenchSplit({ dynastyRoster: meinKader, boardPlayers: rookieBoard })
    expect(r.available).toBe(false)
    expect(r.reason).toBe('low-coverage')
    expect(r.coverage).toBeCloseTo(1 / 10)
  })
})
