import { describe, it, expect } from 'vitest'
import { teamDraftRanking } from './draftStats'

// ECR 1 = bester Spieler (kleiner Rang = besser). delta = pick_no - ecr,
// positiv = spaeter gegangen als der Rang hergibt = unter Wert geholt.
const board = [
  { nname: 'aaron jones', name: 'Aaron Jones', pos: 'RB', ecr: 5 },
  { nname: 'brian burns', name: 'Brian Burns', pos: 'WR', ecr: 20 },
  { nname: 'carl carter', name: 'Carl Carter', pos: 'TE', ecr: 30 },
]

const pick = (no, first, last, user, pos = 'RB') => ({
  pick_no: no,
  picked_by: user,
  metadata: { first_name: first, last_name: last, position: pos },
})

describe('teamDraftRanking', () => {
  it('summiert pick_no - ecr je Team und sortiert absteigend', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),   // 1 - 5 = -4
      pick(2, 'Brian', 'Burns', 'u2'),   // 2 - 20 = -18
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    // -4 ist der bessere (weniger negative) Wert -> u1 vor u2.
    expect(r.teams.map((t) => t.key)).toEqual(['user:u1', 'user:u2'])
    expect(r.teams[0].delta).toBe(-4)
    expect(r.teams[1].delta).toBe(-18)
  })

  it('Picks ohne Board-Treffer zaehlen NICHT als 0, sondern als unmatched', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),
      pick(2, 'Unbekannt', 'Spieler', 'u1'),
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.teams[0].delta).toBe(-4)  // nur der getroffene Pick
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
      pick(1, 'Carl', 'Carter', 'u1'),   // 1 - 30 = -29  Reach (viel zu frueh)
      pick(40, 'Aaron', 'Jones', 'u2'),  // 40 - 5 = +35  Steal (spaet gegangen)
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.steals[0].name).toBe('Aaron Jones')
    expect(r.steals[0].delta).toBe(35)
    expect(r.reaches[0].name).toBe('Carl Carter')
    expect(r.reaches[0].delta).toBe(-29)
    expect(r.steals.length).toBeLessThanOrEqual(5)
  })

  it('Vorzeichen-Regression: Rang 10 bei Pick 50 ist ein Steal, Rang 150 bei Pick 20 ein Reach', () => {
    // Reproduziert den Befund aus dem Bugreport (Josh Jacobs / Caleb Williams):
    // ein spaet gezogener Top-Spieler ist ein Schnaeppchen, ein frueh gezogener
    // Nachzuegler ein Fehlgriff -- unabhaengig vom absoluten Betrag der Zahl.
    const b = [
      { nname: 'late steal', name: 'Late Steal', pos: 'WR', ecr: 10 },
      { nname: 'early reach', name: 'Early Reach', pos: 'WR', ecr: 150 },
    ]
    const picks = [
      pick(50, 'Late', 'Steal', 'u1'),   // Rang 10, erst Pick 50 -> Steal
      pick(20, 'Early', 'Reach', 'u2'),  // Rang 150, schon Pick 20 -> Reach
    ]
    const r = teamDraftRanking({ picks, boardPlayers: b, teamsCount: 2 })

    expect(r.steals.some((s) => s.name === 'Late Steal')).toBe(true)
    expect(r.steals.some((s) => s.name === 'Early Reach')).toBe(false)
    expect(r.reaches.some((s) => s.name === 'Early Reach')).toBe(true)
    expect(r.reaches.some((s) => s.name === 'Late Steal')).toBe(false)

    const lateSteal = r.steals.find((s) => s.name === 'Late Steal')
    const earlyReach = r.reaches.find((s) => s.name === 'Early Reach')
    expect(lateSteal.delta).toBe(40)    // 50 - 10
    expect(earlyReach.delta).toBe(-130) // 20 - 150
  })

  it('myTeamKey liefert Rang und Delta; ohne ihn bleiben beide null', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),
      pick(2, 'Brian', 'Burns', 'u2'),
    ]
    const mit = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2, myTeamKey: 'user:u1' })
    expect(mit.myRank).toBe(1)
    expect(mit.myDelta).toBe(-4)

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

  it('Kicker und Defense werden aus Team-Summen und Steal-/Reach-Listen ausgeschlossen und als skipped gezaehlt', () => {
    const b = [
      ...board,
      { nname: 'league kicker', name: 'League Kicker', pos: 'K', ecr: 200 },
      { nname: 'dst one', name: 'DST One', pos: 'DST', ecr: 186 },
      { nname: 'dst two', name: 'DST Two', pos: 'D/ST', ecr: 190 },
    ]
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1', 'RB'),      // zaehlt normal
      pick(150, 'League', 'Kicker', 'u1', 'K'),   // ausgeschlossen
      pick(151, 'DST', 'One', 'u1', 'DEF'),       // ausgeschlossen
      pick(152, 'DST', 'Two', 'u1', 'DEF'),       // ausgeschlossen
    ]
    const r = teamDraftRanking({ picks, boardPlayers: b, teamsCount: 2 })

    // Nur der RB-Pick zaehlt in Team-Delta und matched; die drei anderen sind
    // "skipped", nicht "unmatched" -- sie hatten einen Ranking-Treffer, wurden
    // aber bewusst herausgefiltert.
    expect(r.matched).toBe(1)
    expect(r.unmatched).toBe(0)
    expect(r.skipped).toBe(3)
    expect(r.teams[0].delta).toBe(-4) // 1 - 5, nur Aaron Jones
    expect(r.teams[0].picks).toBe(4)  // alle vier Picks zaehlen als Picks

    expect(r.steals.some((s) => s.name.includes('Kicker'))).toBe(false)
    expect(r.steals.some((s) => s.name.includes('DST'))).toBe(false)
    expect(r.reaches.some((s) => s.name.includes('Kicker'))).toBe(false)
    expect(r.reaches.some((s) => s.name.includes('DST'))).toBe(false)
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

  // rounds explizit gesetzt (statt den FORMAT_DEFAULTS-Rueckfall zu nutzen):
  // 2 Teams x 16 Runden x 1.25 Puffer = 40 -- weit ueber dem hoechsten ecr
  // (10) im Fixture, der Relevanzfilter greift in diesen Tests also nicht ein.
  it('Replacement ist der bedarf-te verfuegbare Spieler', () => {
    // 2 Teams x 2 RB-Slots = Bedarf 4 -> Replacement ist ecr 4
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 2, rounds: 16,
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
      boardPlayers: rbBoard, picks, rosterPositions: ['RB', 'RB'], teamsCount: 2, rounds: 16,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.available).toBe(8)
    expect(rb.bestEcr).toBe(3)        // ecr 1 und 2 sind weg, bester ist ecr 3
    expect(rb.replacementEcr).toBe(6) // der 4. verfuegbare hat ecr 6
  })

  it('weniger verfuegbar als Bedarf -> erschoepft, kein Replacement', () => {
    const r = positionalScarcity({
      boardPlayers: rbBoard.slice(0, 2), picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 12, rounds: 16,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.exhausted).toBe(true)
    expect(rb.replacementEcr).toBeNull()
    expect(rb.vor).toBeNull()
  })

  it('Bruchteile werden erst nach der Multiplikation gerundet', () => {
    // 12 Teams x 1/3 FLEX = 4.0 -> Bedarf 4, nicht 12 x round(1/3) = 0
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['FLEX'], teamsCount: 12, rounds: 16,
    })
    expect(r.find((x) => x.pos === 'RB').need).toBe(4)
  })

  it('Position ohne Starter-Slot taucht nicht auf', () => {
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['QB'], teamsCount: 12, rounds: 16,
    })
    expect(r.find((x) => x.pos === 'RB')).toBeUndefined()
  })

  it('ohne Rundenzahl greift derselbe Rueckfall wie deriveFormat (FORMAT_DEFAULTS.rounds)', () => {
    // Kein rounds-Feld (z.B. Mock-Draft ohne eigene Einstellung): 2 Teams x
    // FORMAT_DEFAULTS.rounds(16) x 1.25 Puffer = 40 -- deckt das Fixture
    // (ecr bis 10) komplett ab, exakt wie mit explizit gesetztem rounds: 16.
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 2,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.available).toBe(10)
    expect(rb.relevanceLimit).toBe(40)
  })

  it('Spieler weit hinter der Pickzahl blaehen "available" nicht auf', () => {
    // 12 Teams x 14 Runden x 1.25 Puffer = 210 Relevanzgrenze. 5 relevante RB
    // (ecr 1-5) plus 50 voellig irrelevante (ecr 300+, weit jenseits jeder
    // realistischen Pickzahl in dieser Liga) -- ohne Filter waeren es 55.
    const relevant = rbBoard.slice(0, 5)
    const irrelevant = Array.from({ length: 50 }, (_, i) => ({
      nname: `bench rb ${i}`, name: `Bench RB ${i}`, pos: 'RB', ecr: 300 + i,
    }))
    const r = positionalScarcity({
      boardPlayers: [...relevant, ...irrelevant],
      picks: [],
      rosterPositions: ['RB', 'RB'],
      teamsCount: 12,
      rounds: 14,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.relevanceLimit).toBe(210)
    expect(rb.available).toBe(5)     // nicht 55
    expect(rb.exhausted).toBe(true)  // 5 verfuegbar, aber 24 Slots (12 x 2) noetig
  })

  it('Position wird sichtbar knapp, wenn der relevante Pool schrumpft', () => {
    // 3 Teams x 2 RB-Slots = Bedarf 6, genau 6 relevante RB im Board.
    const board = rbBoard.slice(0, 6)
    const before = positionalScarcity({
      boardPlayers: board, picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 3, rounds: 10,
    })
    const rbBefore = before.find((x) => x.pos === 'RB')
    expect(rbBefore.available).toBe(6)
    expect(rbBefore.exhausted).toBe(false)

    // Zwei der sechs relevanten RB werden gedraftet -> der Pool schrumpft
    // sichtbar unter den Bedarf.
    const picks = [
      { pick_no: 1, metadata: { first_name: 'Joe', last_name: 'Burrow', position: 'RB' } },
      { pick_no: 2, metadata: { first_name: 'Josh', last_name: 'Allen', position: 'RB' } },
    ]
    const after = positionalScarcity({
      boardPlayers: board, picks, rosterPositions: ['RB', 'RB'], teamsCount: 3, rounds: 10,
    })
    const rbAfter = after.find((x) => x.pos === 'RB')
    expect(rbAfter.available).toBe(4)
    expect(rbAfter.exhausted).toBe(true)
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

import { positionalRuns } from './draftStats'

const rp = (no, pos) => ({ pick_no: no, metadata: { position: pos } })

describe('positionalRuns', () => {
  it('erkennt einen Run: mindestens 3 Picks UND doppelter Anteil', () => {
    // 20 Picks, im Fenster der letzten 8 liegen 6 RB. Gesamt-RB-Anteil 6/20 = 0.30,
    // Fensteranteil 6/8 = 0.75 -> mehr als das Doppelte.
    const picks = [
      ...Array.from({ length: 12 }, (_, i) => rp(i + 1, 'WR')),
      ...Array.from({ length: 6 }, (_, i) => rp(13 + i, 'RB')),
      rp(19, 'WR'), rp(20, 'WR'),
    ]
    const r = positionalRuns({ picks, teamsCount: 12 })
    const rb = r.runs.find((x) => x.pos === 'RB')
    expect(rb).toBeDefined()
    expect(rb.count).toBe(6)
    expect(r.window).toBe(8)
  })

  it('2 Picks im Fenster sind kein Run, auch bei hohem Anteil', () => {
    // QB kommt sonst nie vor -> Anteil vervielfacht sich, aber absolut nur 2.
    const picks = [
      ...Array.from({ length: 18 }, (_, i) => rp(i + 1, 'WR')),
      rp(19, 'QB'), rp(20, 'QB'),
    ]
    const r = positionalRuns({ picks, teamsCount: 12 })
    expect(r.runs.find((x) => x.pos === 'QB')).toBeUndefined()
  })

  it('3 Picks bei doppeltem Anteil sind ein Run (Gegenprobe zur Grenze)', () => {
    const picks = [
      ...Array.from({ length: 17 }, (_, i) => rp(i + 1, 'WR')),
      rp(18, 'QB'), rp(19, 'QB'), rp(20, 'QB'),
    ]
    const r = positionalRuns({ picks, teamsCount: 12 })
    expect(r.runs.find((x) => x.pos === 'QB')).toBeDefined()
  })

  it('gleichmaessige Verteilung ergibt keinen Run', () => {
    const picks = Array.from({ length: 20 }, (_, i) => rp(i + 1, ['QB', 'RB', 'WR', 'TE'][i % 4]))
    expect(positionalRuns({ picks, teamsCount: 12 }).runs).toEqual([])
  })

  it('nicht mehr Picks als Fensterbreite -> keine Runs, aber gueltige Struktur', () => {
    const picks = Array.from({ length: 6 }, (_, i) => rp(i + 1, 'RB'))
    const r = positionalRuns({ picks, teamsCount: 12 })
    expect(r.runs).toEqual([])
    expect(r.timeline).toHaveLength(6)
  })

  it('Fenster ist durch teamsCount begrenzt, wenn die Liga klein ist', () => {
    const picks = Array.from({ length: 20 }, (_, i) => rp(i + 1, 'RB'))
    expect(positionalRuns({ picks, teamsCount: 4 }).window).toBe(4)
  })

  it('timeline ist nach pick_no sortiert, auch bei unsortierter Eingabe', () => {
    const r = positionalRuns({ picks: [rp(3, 'RB'), rp(1, 'WR'), rp(2, 'TE')], teamsCount: 12 })
    expect(r.timeline.map((t) => t.pick_no)).toEqual([1, 2, 3])
  })
})
