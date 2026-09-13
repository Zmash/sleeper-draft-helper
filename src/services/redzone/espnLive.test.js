import { describe, it, expect } from 'vitest'
import { normalizeScoreboard, normalizeScoringPlays, normAbbr } from './espnLive'

const comp = (over = {}) => ({
  status: { displayClock: '6:09', period: 2, type: { state: 'in', shortDetail: '6:09 - 2nd' } },
  competitors: [
    { homeAway: 'home', score: '14', team: { id: '4', abbreviation: 'CIN' } },
    { homeAway: 'away', score: '3', team: { id: '27', abbreviation: 'TB' } },
  ],
  situation: { possession: '4', isRedZone: true, downDistanceText: '1st & Goal at TB 5', lastPlay: { text: ' J.Burrow pass short right ' } },
  ...over,
})

describe('normalizeScoreboard', () => {
  it('liest Stand, Uhr, Ballbesitz (Team-ID -> Kuerzel) und Redzone', () => {
    const [g] = normalizeScoreboard({ events: [{ id: 401872925, date: '2026-09-13T17:00Z', competitions: [comp()] }] })
    expect(g).toEqual({
      id: '401872925', date: '2026-09-13T17:00Z', state: 'in', detail: '6:09 - 2nd', period: 2, clock: '6:09',
      home: { id: '4', abbr: 'CIN', score: 14 }, away: { id: '27', abbr: 'TB', score: 3 },
      possessionAbbr: 'CIN', isRedZone: true, downDistance: '1st & Goal at TB 5', lastPlay: 'J.Burrow pass short right',
    })
  })

  it('normalisiert WSH auf Sleepers WAS und kommt ohne situation aus', () => {
    const c = comp({ situation: undefined, competitors: [
      { homeAway: 'home', score: '0', team: { id: '28', abbreviation: 'WSH' } },
      { homeAway: 'away', score: '0', team: { id: '21', abbreviation: 'PHI' } },
    ] })
    const [g] = normalizeScoreboard({ events: [{ id: '1', competitions: [c] }] })
    expect(g.home.abbr).toBe('WAS')
    expect(g.possessionAbbr).toBeNull()
    expect(g.isRedZone).toBe(false)
    expect(g.lastPlay).toBeNull()
  })

  it('liefert [] bei kaputter Antwort', () => {
    expect(normalizeScoreboard(null)).toEqual([])
    expect(normAbbr('wsh')).toBe('WAS')
  })
})

describe('normalizeScoringPlays', () => {
  it('liest Text, Team, Typ, Viertel und Uhr', () => {
    const plays = normalizeScoringPlays({ scoringPlays: [{
      id: '401872925861', text: 'Mike Gesicki 2 Yd pass from Joe Burrow (Evan McPherson Kick)',
      type: { abbreviation: 'TD' }, team: { id: '4', abbreviation: 'CIN' },
      period: { number: 1 }, clock: { value: 108, displayValue: '1:48' },
    }] })
    expect(plays).toEqual([{
      id: '401872925861', text: 'Mike Gesicki 2 Yd pass from Joe Burrow (Evan McPherson Kick)',
      teamAbbr: 'CIN', type: 'TD', period: 1, clockValue: 108, clock: '1:48',
    }])
    expect(normalizeScoringPlays({})).toEqual([])
  })
})
