import { describe, it, expect } from 'vitest'
import { freeAgents, pickupRanking, streamingBoard } from './waiverStats'

describe('freeAgents', () => {
  const playersMeta = {
    '1': { full_name: 'Rostered Guy', fantasy_positions: ['RB'], status: 'Active' },
    '2': { full_name: 'Free Agent Guy', fantasy_positions: ['WR'], status: 'Active', team: 'SEA' },
    '3': { full_name: 'Retired Guy', fantasy_positions: ['QB'], status: 'Inactive' },
    '4': { full_name: 'Kicker Guy', fantasy_positions: ['K'], status: 'Active' },
  }
  const leagueRosters = [{ roster_id: 1, players: [{ sleeper_id: '1' }] }]

  it('schliesst rostered, inaktive und K aus', () => {
    const out = freeAgents({ playersMeta, leagueRosters })
    expect(out.map((p) => p.player_id)).toEqual(['2'])
  })
})

describe('pickupRanking', () => {
  const agents = [
    { player_id: '2', name: 'Free Agent Guy', nname: 'freeagentguy', pos: 'WR', team: 'SEA' },
    { player_id: '5', name: 'Other Guy', nname: 'otherguy', pos: 'WR', team: 'NYJ' },
  ]

  it('dynasty: sortiert nach KTC-Wert, hoechster zuerst', () => {
    const out = pickupRanking({
      freeAgents: agents, mode: 'dynasty',
      dynastyValues: [{ nname: 'otherguy', value: 900 }, { nname: 'freeagentguy', value: 1200 }],
    })
    expect(out[0].player_id).toBe('2')
    expect(out[0].value).toBe(1200)
  })

  it('redraft: sortiert nach ROS-ECR, niedrigster (bester) zuerst', () => {
    const out = pickupRanking({
      freeAgents: agents, mode: 'redraft',
      rosRankByKey: new Map([['NAME:otherguy', 10], ['NAME:freeagentguy', 40]]),
    })
    expect(out[0].player_id).toBe('5')
  })

  it('markiert trending Adds', () => {
    const out = pickupRanking({ freeAgents: agents, mode: 'redraft', trendingAddIds: new Set(['2']) })
    expect(out.find((p) => p.player_id === '2').trending).toBe(true)
  })
})

describe('streamingBoard', () => {
  const agents = [
    { player_id: '1', name: 'Def A', nname: 'defa', pos: 'DEF', team: 'SEA' },
    { player_id: '2', name: 'Def B', nname: 'defb', pos: 'DEF', team: 'NYJ' },
    { player_id: '3', name: 'TE A', nname: 'tea', pos: 'TE', team: 'KC' },
  ]

  it('baut Week+ROS-Listen nur fuer angehakte Positionen, sortiert nach ECR', () => {
    const out = streamingBoard({
      freeAgents: agents,
      weeklyRankByKey: new Map([['TEAM:SEA', 3], ['TEAM:NYJ', 1]]),
      rosRankByKey: new Map([['TEAM:SEA', 1], ['TEAM:NYJ', 5]]),
      positions: ['DEF'],
    })
    expect(out.TE).toBeUndefined()
    expect(out.DEF.week.map((p) => p.player_id)).toEqual(['2', '1'])
    expect(out.DEF.ros.map((p) => p.player_id)).toEqual(['1', '2'])
  })
})
