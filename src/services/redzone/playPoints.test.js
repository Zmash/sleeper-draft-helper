import { describe, it, expect } from 'vitest'
import { parseScoringPlay, playPointsFor, playPoints, normName } from './playPoints'

const PPR = { pass_td: 4, pass_yd: 0.04, rush_td: 6, rush_yd: 0.1, rec_td: 6, rec_yd: 0.1, rec: 1, xpm: 1, fgm_40_49: 4, fgm_50p: 5 }
const HALF = { ...PPR, rec: 0.5, pass_td: 6 }
const play = (text) => ({ id: text, text, teamAbbr: 'CIN' })
const pl = (name, pos = 'WR', leagues = []) => ({ playerId: name, name, pos, team: 'CIN', leagues })

describe('parseScoringPlay', () => {
  it('liest Receiver, Passer und Kicker aus einem Pass-TD', () => {
    expect(parseScoringPlay("Ja'Marr Chase 23 Yd pass from Joe Burrow (Evan McPherson Kick)")).toEqual([
      { kind: 'rec', name: "Ja'Marr Chase", yds: 23 },
      { kind: 'pass', name: 'Joe Burrow', yds: 23 },
      { kind: 'xp', name: 'Evan McPherson' },
    ])
  })
  it('liest Lauf, Field Goal und Two-Point-Conversion', () => {
    expect(parseScoringPlay('Joe Mixon 2 Yd Run')).toEqual([{ kind: 'rush', name: 'Joe Mixon', yds: 2 }])
    expect(parseScoringPlay('Evan McPherson 45 Yd Field Goal')).toEqual([{ kind: 'fg', name: 'Evan McPherson', yds: 45 }])
    expect(parseScoringPlay('Tee Higgins 10 Yd pass from Joe Burrow (Joe Burrow Pass to Tee Higgins for Two-Point Conversion)').slice(2))
      .toEqual([{ kind: 'pass2', name: 'Joe Burrow' }, { kind: 'rec2', name: 'Tee Higgins' }])
  })
  it('ignoriert verschossenen Extrapunkt und unbekannte Formate', () => {
    expect(parseScoringPlay('Joe Mixon 2 Yd Run (Evan McPherson Kick Failed)')).toHaveLength(1)
    expect(parseScoringPlay('Something odd happened')).toEqual([])
  })
})

describe('playPointsFor', () => {
  const td = play("Ja'Marr Chase 23 Yd pass from Joe Burrow (Evan McPherson Kick)")
  it('bewertet jede Rolle mit dem Liga-Scoring', () => {
    expect(playPointsFor(td, pl("Ja'Marr Chase"), PPR)).toBe(9.3) // 6 + 2.3 + 1
    expect(playPointsFor(td, pl('Joe Burrow', 'QB'), PPR)).toBe(4.9) // 4 + 0.92
    expect(playPointsFor(td, pl('Evan McPherson', 'K'), PPR)).toBe(1)
    expect(playPointsFor(play('Evan McPherson 52 Yd Field Goal'), pl('Evan McPherson', 'K'), PPR)).toBe(5)
  })
  it('Namensabgleich ist robust gegen Apostroph und Suffix, aber nicht beliebig', () => {
    expect(normName("Ja'Marr Chase")).toBe('jamarr chase')
    expect(playPointsFor(play('Kenneth Walker 3 Yd Run'), pl('Kenneth Walker III', 'RB'), PPR)).toBe(6.3)
    expect(playPointsFor(td, pl('Chase Brown', 'RB'), PPR)).toBeNull()
  })
  it('DEF bekommt Defensiv-TD bzw. Safety', () => {
    expect(playPointsFor(play('Logan Wilson 30 Yd Interception Return'), pl('Cincinnati Bengals', 'DEF'), PPR)).toBe(6)
    expect(playPointsFor(play('Team Safety'), pl('Cincinnati Bengals', 'DEF'), PPR)).toBe(2)
  })
})

describe('playPoints', () => {
  it('nimmt ueber mehrere Ligen den hoechsten Wert', () => {
    const burrow = pl('Joe Burrow', 'QB', [{ scoring: PPR }, { scoring: HALF }])
    expect(playPoints(play('Chase Brown 10 Yd pass from Joe Burrow'), burrow)).toBe(6.4)
  })
})
