import { describe, it, expect } from 'vitest'
import { teamDraftRanking } from './draftStats'

// ECR 1 = bester Spieler. delta = ecr - pick_no, positiv = unter Wert geholt.
const board = [
  { nname: 'aaron jones', name: 'Aaron Jones', pos: 'RB', ecr: 5 },
  { nname: 'brian burns', name: 'Brian Burns', pos: 'WR', ecr: 20 },
  { nname: 'carl carter', name: 'Carl Carter', pos: 'TE', ecr: 30 },
]

const pick = (no, first, last, user) => ({
  pick_no: no,
  picked_by: user,
  metadata: { first_name: first, last_name: last, position: 'RB' },
})

describe('teamDraftRanking', () => {
  it('summiert ecr - pick_no je Team und sortiert absteigend', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),   // 5 - 1 = +4
      pick(2, 'Brian', 'Burns', 'u2'),   // 20 - 2 = +18
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.teams.map((t) => t.key)).toEqual(['user:u2', 'user:u1'])
    expect(r.teams[0].delta).toBe(18)
    expect(r.teams[1].delta).toBe(4)
  })

  it('Picks ohne Board-Treffer zaehlen NICHT als 0, sondern als unmatched', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),
      pick(2, 'Unbekannt', 'Spieler', 'u1'),
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.teams[0].delta).toBe(4)   // nur der getroffene Pick
    expect(r.teams[0].picks).toBe(2)   // aber beide Picks gezaehlt
    expect(r.unmatched).toBe(1)
    expect(r.matched).toBe(1)
  })

  it('Board-Spieler ohne numerischen ecr gelten als nicht getroffen', () => {
    const picks = [pick(1, 'Dave', 'Doe', 'u1')]
    const boardOhneEcr = [{ nname: 'dave doe', name: 'Dave Doe', pos: 'RB', ecr: null }]
    const r = teamDraftRanking({ picks, boardPlayers: boardOhneEcr, teamsCount: 2 })
    expect(r.unmatched).toBe(1)
    expect(r.teams[0].delta).toBe(0)
  })

  it('Steals und Reaches sind nach Betrag sortiert und auf 5 begrenzt', () => {
    const picks = [
      pick(1, 'Carl', 'Carter', 'u1'),   // 30 - 1 = +29  Steal
      pick(40, 'Aaron', 'Jones', 'u2'),  //  5 - 40 = -35 Reach
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.steals[0].name).toBe('Carl Carter')
    expect(r.steals[0].delta).toBe(29)
    expect(r.reaches[0].name).toBe('Aaron Jones')
    expect(r.reaches[0].delta).toBe(-35)
    expect(r.steals.length).toBeLessThanOrEqual(5)
  })

  it('myTeamKey liefert Rang und Delta; ohne ihn bleiben beide null', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),
      pick(2, 'Brian', 'Burns', 'u2'),
    ]
    const mit = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2, myTeamKey: 'user:u1' })
    expect(mit.myRank).toBe(2)
    expect(mit.myDelta).toBe(4)

    const ohne = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(ohne.myRank).toBeNull()
    expect(ohne.myDelta).toBeNull()
  })

  it('leere Eingaben liefern eine leere, aber gueltige Struktur', () => {
    const r = teamDraftRanking({ picks: [], boardPlayers: [], teamsCount: 12 })
    expect(r.teams).toEqual([])
    expect(r.steals).toEqual([])
    expect(r.matched).toBe(0)
  })
})

import { starterSlots, positionalScarcity } from './draftStats'

describe('starterSlots', () => {
  it('zaehlt dedizierte Slots', () => {
    expect(starterSlots('RB', ['QB', 'RB', 'RB', 'WR', 'BN'])).toBe(2)
  })

  it('FLEX verteilt sich zu je einem Drittel auf RB, WR, TE', () => {
    expect(starterSlots('RB', ['FLEX'])).toBeCloseTo(1 / 3)
    expect(starterSlots('TE', ['FLEX'])).toBeCloseTo(1 / 3)
    expect(starterSlots('QB', ['FLEX'])).toBe(0)
  })

  it('SUPER_FLEX verteilt sich zu je einem Viertel und schliesst QB ein', () => {
    expect(starterSlots('QB', ['SUPER_FLEX'])).toBeCloseTo(1 / 4)
    expect(starterSlots('RB', ['SUPER_FLEX'])).toBeCloseTo(1 / 4)
  })

  it('REC_FLEX ist WR/TE, nicht RB', () => {
    expect(starterSlots('WR', ['REC_FLEX'])).toBeCloseTo(1 / 2)
    expect(starterSlots('RB', ['REC_FLEX'])).toBe(0)
  })

  it('Bank- und Sonderslots zaehlen nicht', () => {
    expect(starterSlots('RB', ['BN', 'IR', 'TAXI'])).toBe(0)
  })
})

describe('positionalScarcity', () => {
  // 10 RB mit realistischen Namen (keine Ziffern, damit normalizePlayerName sie nicht aendert)
  const rbBoard = [
    { nname: 'joe burrow', name: 'Joe Burrow', pos: 'RB', ecr: 1 },
    { nname: 'josh allen', name: 'Josh Allen', pos: 'RB', ecr: 2 },
    { nname: 'patrick mahomes', name: 'Patrick Mahomes', pos: 'RB', ecr: 3 },
    { nname: 'travis kelce', name: 'Travis Kelce', pos: 'RB', ecr: 4 },
    { nname: 'tyreek hill', name: 'Tyreek Hill', pos: 'RB', ecr: 5 },
    { nname: 'davante adams', name: 'Davante Adams', pos: 'RB', ecr: 6 },
    { nname: 'stefon diggs', name: 'Stefon Diggs', pos: 'RB', ecr: 7 },
    { nname: 'christian mccaffrey', name: 'Christian McCaffrey', pos: 'RB', ecr: 8 },
    { nname: 'derrick henry', name: 'Derrick Henry', pos: 'RB', ecr: 9 },
    { nname: 'jonathan taylor', name: 'Jonathan Taylor', pos: 'RB', ecr: 10 },
  ]

  it('Replacement ist der bedarf-te verfuegbare Spieler', () => {
    // 2 Teams x 2 RB-Slots = Bedarf 4 -> Replacement ist ecr 4
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 2,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.need).toBe(4)
    expect(rb.replacementEcr).toBe(4)
    expect(rb.bestEcr).toBe(1)
    expect(rb.vor).toBe(3)       // 4 - 1
    expect(rb.startable).toBe(4)
  })

  it('gepickte Spieler fallen aus dem verfuegbaren Pool', () => {
    const picks = [
      { pick_no: 1, metadata: { first_name: 'Joe', last_name: 'Burrow', position: 'RB' } },
      { pick_no: 2, metadata: { first_name: 'Josh', last_name: 'Allen', position: 'RB' } },
    ]
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks, rosterPositions: ['RB', 'RB'], teamsCount: 2,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.available).toBe(8)
    expect(rb.bestEcr).toBe(3)        // ecr 1 und 2 sind weg, bester ist ecr 3
    expect(rb.replacementEcr).toBe(6) // der 4. verfuegbare hat ecr 6
  })

  it('weniger verfuegbar als Bedarf -> erschoepft, kein Replacement', () => {
    const r = positionalScarcity({
      boardPlayers: rbBoard.slice(0, 2), picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 12,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.exhausted).toBe(true)
    expect(rb.replacementEcr).toBeNull()
    expect(rb.vor).toBeNull()
  })

  it('Bruchteile werden erst nach der Multiplikation gerundet', () => {
    // 12 Teams x 1/3 FLEX = 4.0 -> Bedarf 4, nicht 12 x round(1/3) = 0
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['FLEX'], teamsCount: 12,
    })
    expect(r.find((x) => x.pos === 'RB').need).toBe(4)
  })

  it('Position ohne Starter-Slot taucht nicht auf', () => {
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['QB'], teamsCount: 12,
    })
    expect(r.find((x) => x.pos === 'RB')).toBeUndefined()
  })
})

import { tierUsage } from './draftStats'

describe('tierUsage', () => {
  const board = [
    { nname: 'a a', name: 'A A', pos: 'RB', tier: '1' },
    { nname: 'b b', name: 'B B', pos: 'RB', tier: '1' },
    { nname: 'c c', name: 'C C', pos: 'RB', tier: '2' },
    { nname: 'd d', name: 'D D', pos: 'WR', tier: '1' },
  ]

  it('zaehlt je Position und Tier Gesamt und Rest', () => {
    const picks = [{ pick_no: 1, metadata: { first_name: 'A', last_name: 'A' } }]
    const r = tierUsage({ boardPlayers: board, picks })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.tiers).toEqual([
      { tier: 1, total: 2, remaining: 1 },
      { tier: 2, total: 1, remaining: 1 },
    ])
  })

  it('aktives Tier ist das oberste mit Restbestand', () => {
    const picks = [
      { pick_no: 1, metadata: { first_name: 'A', last_name: 'A' } },
      { pick_no: 2, metadata: { first_name: 'B', last_name: 'B' } },
    ]
    const r = tierUsage({ boardPlayers: board, picks })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.activeTier).toBe(2)       // Tier 1 ist leer
    expect(rb.remainingInActive).toBe(1)
  })

  it('nicht-numerische Tier-Werte fallen heraus, ohne den Rest zu stoeren', () => {
    const mit = [...board, { nname: 'e e', name: 'E E', pos: 'RB', tier: '' },
                           { nname: 'f f', name: 'F F', pos: 'RB', tier: 'n/a' }]
    const r = tierUsage({ boardPlayers: mit, picks: [] })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.tiers.reduce((s, t) => s + t.total, 0)).toBe(3)  // nur 1,1,2
  })

  it('alles gepickt -> kein aktives Tier statt Absturz', () => {
    const picks = [{ pick_no: 1, metadata: { first_name: 'D', last_name: 'D' } }]
    const r = tierUsage({ boardPlayers: [board[3]], picks })
    expect(r.find((x) => x.pos === 'WR').activeTier).toBeNull()
    expect(r.find((x) => x.pos === 'WR').remainingInActive).toBe(0)
  })

  it('Tiers werden aufsteigend sortiert auch wenn Board sie absteigend hat', () => {
    // Board mit Tiers in absteigender Reihenfolge (10 vor 2)
    const unsortedBoard = [
      { nname: 'ann berg', name: 'Ann Berg', pos: 'RB', tier: '10' },
      { nname: 'carl dorn', name: 'Carl Dorn', pos: 'RB', tier: '2' },
    ]
    const picks = []
    const r = tierUsage({ boardPlayers: unsortedBoard, picks })
    const rb = r.find((x) => x.pos === 'RB')
    // Tiers müssen aufsteigend sein, nicht lexikografisch oder in Board-Reihenfolge
    expect(rb.tiers.map((t) => t.tier)).toEqual([2, 10])
    // Aktives Tier ist das kleinste mit Restbestand
    expect(rb.activeTier).toBe(2)
    expect(rb.remainingInActive).toBe(1)
  })

  it('Board ohne jede Tier-Spalte liefert eine leere Liste', () => {
    const r = tierUsage({ boardPlayers: [{ nname: 'x x', pos: 'RB' }], picks: [] })
    expect(r).toEqual([])
  })
})
