import { describe, it, expect } from 'vitest'
import { buildAllTeamsRows, sortAllTeamsRows, countBySeverity } from './allTeamsLineup'

const teamA = {
  leagueId: 'l1',
  leagueName: 'Liga A',
  week: '5',
  roster: [
    { sleeper_id: '1', name: 'Bye Starter', pos: 'WR', team: 'DET', bye: '5', injury_status: null },
    { sleeper_id: '2', name: 'Gesunder Starter', pos: 'RB', team: 'SF', bye: '9', injury_status: null },
    { sleeper_id: '3', name: 'Besser Bank', pos: 'RB', team: 'BAL', bye: '9', injury_status: null },
  ],
  actualStarterIds: ['1', '2'],
  recommendedStarterIds: ['2', '3'],
}

const teamB = {
  leagueId: 'l2',
  leagueName: 'Liga B',
  week: '5',
  roster: [
    { sleeper_id: '9', name: 'Out Starter', pos: 'QB', team: 'KC', bye: '9', injury_status: 'Out' },
    { sleeper_id: '8', name: 'Optimaler', pos: 'TE', team: 'PHI', bye: '9', injury_status: null },
  ],
  actualStarterIds: ['9', '8'],
  recommendedStarterIds: ['8'],
}

describe('allTeamsLineup', () => {
  it('markiert Bye- und Out-Starter als rot', () => {
    const rows = buildAllTeamsRows({ teams: [teamA, teamB] })
    const byeRow = rows.find((r) => r.player.sleeper_id === '1')
    const outRow = rows.find((r) => r.player.sleeper_id === '9')
    expect(byeRow.severity).toBe('red')
    expect(byeRow.reasons).toContain('bye')
    expect(outRow.severity).toBe('red')
    expect(outRow.reasons).toContain('out')
  })

  it('markiert suboptimale Starter und bessere Bankspieler als gelb', () => {
    const rows = buildAllTeamsRows({ teams: [teamA] })
    const okRow = rows.find((r) => r.player.sleeper_id === '2')
    // Starter und empfohlen -> grün
    expect(okRow.severity).toBe('green')
    const benchRow = rows.find((r) => r.player.sleeper_id === '3')
    expect(benchRow.severity).toBe('yellow')
    expect(benchRow.reasons).toContain('better-on-bench')
  })

  it('sortiert rot vor gelb vor grün', () => {
    const rows = buildAllTeamsRows({ teams: [teamA, teamB] })
    const sorted = sortAllTeamsRows(rows)
    const order = sorted.map((r) => r.severity)
    const firstGreen = order.indexOf('green')
    const lastRed = order.lastIndexOf('red')
    expect(lastRed).toBeLessThan(firstGreen)
  })

  it('zählt Warnstufen für die Kopfzeile', () => {
    const rows = buildAllTeamsRows({ teams: [teamA, teamB] })
    const counts = countBySeverity(rows)
    expect(counts.red).toBe(2)
    expect(counts.total).toBe(5)
  })
})
