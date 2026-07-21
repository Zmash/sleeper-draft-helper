import { describe, it, expect } from 'vitest'
import { computeTeamScores } from './analysis'

// 7 Starterplaetze: QB, 2 RB, 2 WR, TE, FLEX
const ROSTER = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN', 'BN']
const ROSTER_SF = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'SUPER_FLEX', 'BN', 'BN', 'BN']

function boardFrom(defs) {
  return defs.map(d => ({
    sleeper_id: d.id, nname: d.id, rk: d.rk, adp: d.adp ?? d.rk,
    pos: d.pos, bye: d.bye ?? null,
  }))
}
function pick(no, by, id, pos) {
  return { pick_no: no, picked_by: by, player_id: id, metadata: { position: pos } }
}

// Voller 2-Team-Draft: A bekommt die ungeraden (besseren) Ranks, B die geraden.
// Jeder pickt exakt nach Board-Reihenfolge -> alle Deltas 0.
const POS_SEQ = ['QB', 'QB', 'RB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'WR', 'TE', 'TE', 'RB', 'RB']
const fullBoard = boardFrom(POS_SEQ.map((pos, i) => ({ id: `p${i + 1}`, rk: i + 1, pos })))
const fullPicks = POS_SEQ.map((pos, i) =>
  pick(i + 1, i % 2 === 0 ? 'A' : 'B', `p${i + 1}`, pos))

describe('computeTeamScores — neues Metrik-Set', () => {
  it('liefert starter/depth statt positional/diversity und differenziert (Regression: Positional war immer 100)', () => {
    const scores = computeTeamScores({ boardPlayers: fullBoard, livePicks: fullPicks, teamsCount: 2, rosterPositions: ROSTER })
    expect(scores).toHaveLength(2)
    expect(scores[0]).not.toHaveProperty('positional')
    expect(scores[0]).not.toHaveProperty('diversity')
    const a = scores.find(s => s.key === 'user:A')
    const b = scores.find(s => s.key === 'user:B')
    expect(a.starter).toBe(100)          // bestes Lineup der Liga
    expect(b.starter).toBeLessThan(100)  // differenziert endlich
    expect(a.total).toBeGreaterThan(b.total)
    expect(scores[0].rank).toBe(1)
  })

  it('Value: Draft exakt nach ECR/ADP -> beide Teams 50 (Marktwert-Mitte)', () => {
    const scores = computeTeamScores({ boardPlayers: fullBoard, livePicks: fullPicks, teamsCount: 2, rosterPositions: ROSTER })
    for (const s of scores) expect(s.value).toBe(50)
  })

  it('Value: klare Steals (rk weit besser als Pick-Nr.) -> deutlich ueber 50', () => {
    const defs = POS_SEQ.slice(0, 7).map((pos, i) => ({ id: `s${i + 1}`, rk: i + 1, pos }))
    const board = boardFrom(defs)
    // Ein Team pickt die Spieler 15 Picks spaeter als ihr Rank -> positive Deltas
    const picks = defs.map((d, i) => pick(i + 16, 'A', d.id, d.pos))
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 12, rosterPositions: ROSTER })
    expect(scores[0].value).toBeGreaterThan(50)
  })

  it('Balance (Superflex): nur 1 QB wird bestraft, 2 QB nicht', () => {
    const posA = ['QB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'TE']
    const posB = ['QB', 'QB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE']
    const defs = [
      ...posA.map((pos, i) => ({ id: `a${i}`, rk: i * 2 + 1, pos })),
      ...posB.map((pos, i) => ({ id: `b${i}`, rk: i * 2 + 2, pos })),
    ]
    const board = boardFrom(defs)
    const picks = [
      ...posA.map((pos, i) => pick(i * 2 + 1, 'A', `a${i}`, pos)),
      ...posB.map((pos, i) => pick(i * 2 + 2, 'B', `b${i}`, pos)),
    ]
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 2, rosterPositions: ROSTER_SF })
    const a = scores.find(s => s.key === 'user:A')
    const b = scores.find(s => s.key === 'user:B')
    expect(a.balance).toBe(90)   // -10: kein zweiter QB fuer den SF-Slot
    expect(b.balance).toBe(100)
  })

  it('Bye: 3 Starter mit gleicher Bye-Woche schlechter als gespreizte Byes', () => {
    const posSeq = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'RB']
    const defs = [
      ...posSeq.map((pos, i) => ({ id: `x${i}`, rk: i * 2 + 1, pos, bye: i < 3 ? '7' : String(8 + i) })),
      ...posSeq.map((pos, i) => ({ id: `y${i}`, rk: i * 2 + 2, pos, bye: String(i + 1) })),
    ]
    const board = boardFrom(defs)
    const picks = [
      ...posSeq.map((pos, i) => pick(i * 2 + 1, 'X', `x${i}`, pos)),
      ...posSeq.map((pos, i) => pick(i * 2 + 2, 'Y', `y${i}`, pos)),
    ]
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 2, rosterPositions: ROSTER })
    const x = scores.find(s => s.key === 'user:X')
    const y = scores.find(s => s.key === 'user:Y')
    expect(x.bye).toBe(80)   // (3-1) * 10 Strafe
    expect(y.bye).toBe(100)
  })

  it('laufender Draft: 3 Picks -> keine Unbesetzt-Strafen ueber die Pickzahl hinaus', () => {
    const defs = [
      { id: 'q1', rk: 1, pos: 'QB' },
      { id: 'r1', rk: 2, pos: 'RB' },
      { id: 'w1', rk: 3, pos: 'WR' },
    ]
    const board = boardFrom(defs)
    const picks = defs.map((d, i) => pick(i + 1, 'A', d.id, d.pos))
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 12, rosterPositions: ROSTER })
    expect(scores[0].balance).toBe(100)
  })

  it('leeres Board (kein Ranking importiert): neutrale 50er, keine NaN', () => {
    const picks = [pick(1, 'A', 'unknown1', 'RB'), pick(2, 'B', 'unknown2', 'WR')]
    const scores = computeTeamScores({ boardPlayers: [], livePicks: picks, teamsCount: 2, rosterPositions: ROSTER })
    for (const s of scores) {
      expect(s.value).toBe(50)
      expect(s.starter).toBe(50)
      expect(s.depth).toBe(50)
      for (const k of ['total', 'value', 'starter', 'depth', 'balance', 'bye']) {
        expect(Number.isFinite(s[k])).toBe(true)
      }
    }
  })
})
