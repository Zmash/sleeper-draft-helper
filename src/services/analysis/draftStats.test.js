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
