import { describe, it, expect } from 'vitest'
import { normalizeScoreboard, normalizeScoringPlays, normAbbr, lastKickoffAt } from './espnLive'

const comp = (over = {}) => ({
  status: { displayClock: '6:09', clock: 369, period: 2, type: { state: 'in', shortDetail: '6:09 - 2nd' } },
  competitors: [
    { homeAway: 'home', score: '14', team: { id: '4', abbreviation: 'CIN', shortDisplayName: 'Bengals', logo: 'cin.png', color: 'FB4F14' }, records: [{ type: 'total', summary: '1-0' }] },
    { homeAway: 'away', score: '3', team: { id: '27', abbreviation: 'TB', shortDisplayName: 'Buccaneers', logo: 'tb.png' } },
  ],
  situation: { possession: '4', isRedZone: true, downDistanceText: '1st & Goal at TB 5', lastPlay: { text: ' J.Burrow pass short right ' } },
  broadcasts: [{ market: 'national', names: ['FOX'] }],
  venue: { fullName: 'Paycor Stadium' },
  ...over,
})

describe('normalizeScoreboard', () => {
  it('liest Stand, Uhr, Ballbesitz (Team-ID -> Kuerzel) und Redzone', () => {
    const [g] = normalizeScoreboard({ events: [{ id: 401872925, date: '2026-09-13T17:00Z', competitions: [comp()] }] })
    expect(g).toEqual({
      id: '401872925', date: '2026-09-13T17:00Z', state: 'in', detail: '6:09 - 2nd', period: 2, clock: '6:09', clockSeconds: 369,
      home: { id: '4', abbr: 'CIN', score: 14, name: 'Bengals', logo: 'cin.png', color: '#FB4F14', record: '1-0' },
      away: { id: '27', abbr: 'TB', score: 3, name: 'Buccaneers', logo: 'tb.png', color: null, record: null },
      possessionAbbr: 'CIN', isRedZone: true, downDistance: '1st & Goal at TB 5', lastPlay: 'J.Burrow pass short right',
      network: 'FOX', venue: 'Paycor Stadium', neutralSite: false,
    })
  })

  it('liest den US-Sender auch aus geoBroadcasts und bleibt ohne Sender still', () => {
    const c = comp({ broadcasts: [], geoBroadcasts: [{ media: { shortName: 'NBC' } }] })
    expect(normalizeScoreboard({ events: [{ id: '1', competitions: [c] }] })[0].network).toBe('NBC')
    const bare = comp({ broadcasts: undefined, geoBroadcasts: undefined, venue: undefined })
    const [g] = normalizeScoreboard({ events: [{ id: '1', competitions: [bare] }] })
    expect(g.network).toBeNull()
    expect(g.venue).toBeNull()
  })

  it('ohne numerische Uhr bleibt clockSeconds null', () => {
    const c = comp({ status: { displayClock: '', period: null, type: { state: 'pre' } } })
    const [g] = normalizeScoreboard({ events: [{ id: '1', competitions: [c] }] })
    expect(g.clockSeconds).toBeNull()
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

describe('lastKickoffAt', () => {
  const now = Date.parse('2026-09-13T21:30:00Z')
  const g = (date) => ({ date })

  it('nimmt den spaetesten bereits erfolgten Kickoff', () => {
    const at = lastKickoffAt([g('2026-09-13T17:00:00Z'), g('2026-09-13T20:05:00Z'), g('2026-09-14T00:20:00Z')], now)
    expect(at).toBe(Date.parse('2026-09-13T20:05:00Z'))
  })

  it('null, wenn noch nichts angepfiffen wurde oder keine Termine bekannt sind', () => {
    expect(lastKickoffAt([g('2026-09-14T00:20:00Z')], now)).toBeNull()
    expect(lastKickoffAt([{ date: null }, {}], now)).toBeNull()
    expect(lastKickoffAt([], now)).toBeNull()
  })
})
