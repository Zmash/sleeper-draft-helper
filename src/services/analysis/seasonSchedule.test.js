import { describe, it, expect } from 'vitest'
import { buildRemainingSchedule, playoffCutoff } from './seasonSchedule'

describe('buildRemainingSchedule', () => {
  it('gruppiert Matchups per matchup_id zu Paaren', () => {
    const byWeek = new Map([
      [5, [
        { matchup_id: 1, roster_id: 1 },
        { matchup_id: 1, roster_id: 2 },
        { matchup_id: 2, roster_id: 3 },
        { matchup_id: 2, roster_id: 4 },
      ]],
    ])
    expect(buildRemainingSchedule({ matchupsByWeek: byWeek, fromWeek: 5 })).toEqual([
      { week: 5, a: '1', b: '2' },
      { week: 5, a: '3', b: '4' },
    ])
  })
  it('ignoriert Wochen vor fromWeek und unvollstaendige Paare', () => {
    const byWeek = new Map([
      [3, [{ matchup_id: 1, roster_id: 1 }, { matchup_id: 1, roster_id: 2 }]],
      [5, [{ matchup_id: 1, roster_id: 1 }]],
    ])
    expect(buildRemainingSchedule({ matchupsByWeek: byWeek, fromWeek: 5 })).toEqual([])
  })
  it('leere Eingabe ergibt leeren Schedule', () => {
    expect(buildRemainingSchedule({ matchupsByWeek: new Map(), fromWeek: 1 })).toEqual([])
  })
})

describe('playoffCutoff', () => {
  it('echte Sleeper-Felder (settings) haben Vorrang', () => {
    expect(playoffCutoff({ league: {
      playoff_start_week: 99,
      settings: { playoff_week_start: 14, playoff_teams: 8, playoff_teams_count: 4 },
    } })).toEqual({ playoffWeekStart: 14, playoffTeams: 8 })
  })
  it('ai.js-Konvention als Fallback, dann Defaults', () => {
    expect(playoffCutoff({ league: { playoff_start_week: 15, settings: { playoff_teams_count: 8 } } }))
      .toEqual({ playoffWeekStart: 15, playoffTeams: 8 })
  })
  it('faellt auf settings.playoff_week_start und 6 Teams zurueck', () => {
    expect(playoffCutoff({ league: { settings: {} } })).toEqual({ playoffWeekStart: 15, playoffTeams: 6 })
    expect(playoffCutoff({ league: null })).toEqual({ playoffWeekStart: 15, playoffTeams: 6 })
  })
})
