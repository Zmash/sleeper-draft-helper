import { describe, it, expect } from 'vitest'
import { freeAgents, pickupRanking, streamingBoard, bestLineup, compareToActualStarters, matchKey } from './waiverStats'

describe('matchKey', () => {
  it('returns NAME: for non-DEF positions', () => {
    expect(matchKey('QB', { name: 'Tom Brady' })).toBe('NAME:tom brady')
    expect(matchKey('WR', { nname: 'davante adams' })).toBe('NAME:davante adams')
  })

  it('returns TEAM: for DEF positions', () => {
    expect(matchKey('DEF', { team: 'KC' })).toBe('TEAM:KC')
  })

  it('normalizes Sleeper JAX to FantasyPros JAC for DEF', () => {
    expect(matchKey('DEF', { team: 'JAX' })).toBe('TEAM:JAC')
  })
})

describe('freeAgents', () => {
  const playersMeta = {
    '1': { full_name: 'Rostered Guy', fantasy_positions: ['RB'], status: 'Active', team: 'DAL' },
    '2': { full_name: 'Free Agent Guy', fantasy_positions: ['WR'], status: 'Active', team: 'SEA' },
    '3': { full_name: 'Retired Guy', fantasy_positions: ['QB'], status: 'Inactive', team: null },
    '4': { full_name: 'Kicker Guy', fantasy_positions: ['K'], status: 'Active', team: 'KC' },
    // Sleeper markiert langjaehrig zurueckgetretene Spieler oft nie als "Inactive" --
    // status bleibt "Active", aber team ist null. Ohne Team ist niemand claimbar.
    '5': { full_name: 'Stale Active Guy', fantasy_positions: ['QB'], status: 'Active', team: null },
  }
  const leagueRosters = [{ roster_id: 1, players: [{ sleeper_id: '1' }] }]

  it('schliesst rostered, inaktive, teamlose und K aus', () => {
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

describe('bestLineup', () => {
  const roster = [
    { sleeper_id: '1', name: 'QB Starter', pos: 'QB', bye: '', injury_status: null },
    { sleeper_id: '2', name: 'RB Best', pos: 'RB', bye: '', injury_status: null },
    { sleeper_id: '3', name: 'RB Worse', pos: 'RB', bye: '', injury_status: null },
    { sleeper_id: '4', name: 'WR Bye', pos: 'WR', bye: '7', injury_status: null },
    { sleeper_id: '5', name: 'WR Hurt', pos: 'WR', bye: '', injury_status: 'Out' },
  ]
  const ranks = new Map([['1', 5], ['2', 3], ['3', 20], ['4', 1], ['5', 2]]) // von rank_ecr, niedriger = besser
  const weeklyRankByKey = new Map([...ranks].map(([id, r]) => [`ID:${id}`, r]))

  it('nimmt den besseren RB in den Slot, schwaecheren in FLEX, schliesst Bye/Injury aus', () => {
    const out = bestLineup({
      myRosterPlayers: roster,
      rosterPositions: ['QB', 'RB', 'FLEX', 'BN', 'BN'],
      weeklyRankByKey,
      currentWeekBye: '7',
    })
    const bySlot = Object.fromEntries(out.slots.map((s) => [s.slot + (s.slotIndex ?? ''), s.player?.sleeper_id]))
    expect(bySlot.QB0).toBe('1')
    expect(bySlot.RB0).toBe('2')
    expect(bySlot.FLEX0).toBe('3') // WR Bye (4) und WR Hurt (5) sind raus
    expect(out.bench.map((p) => p.sleeper_id)).toContain('4')
    expect(out.bench.map((p) => p.sleeper_id)).toContain('5')
  })

  it('IR-Slot wird uebersprungen, REC_FLEX zieht WR/TE', () => {
    const out = bestLineup({
      myRosterPlayers: roster,
      rosterPositions: ['QB', 'REC_FLEX', 'IR', 'BN'],
      weeklyRankByKey,
    })
    const bySlot = Object.fromEntries(out.slots.map((s) => [s.slot, s.player?.sleeper_id]))
    expect(bySlot.IR).toBeUndefined() // IR erzeugt keinen Slot in der Ausgabe
    expect(bySlot.REC_FLEX).toBe('4') // WR Bye (5 = WR Hurt ist wegen injury_status 'Out' raus)
  })

  it('schliesst zusaetzliche Verletzungs-Status (PUP/Sus) aus', () => {
    const rosterWithPup = [
      ...roster,
      { sleeper_id: '6', name: 'WR PUP', pos: 'WR', bye: '', injury_status: 'PUP' },
    ]
    const out = bestLineup({
      myRosterPlayers: rosterWithPup,
      rosterPositions: ['QB', 'FLEX', 'BN', 'BN', 'BN'],
      weeklyRankByKey: new Map([...weeklyRankByKey, ['ID:6', 0]]), // bester Rang, darf trotzdem nicht starten
    })
    const flex = out.slots.find((s) => s.slot === 'FLEX')
    expect(flex.player?.sleeper_id).not.toBe('6')
    expect(out.bench.map((p) => p.sleeper_id)).toContain('6')
  })
})

describe('compareToActualStarters', () => {
  it('isOptimal=true, wenn identisch', () => {
    const slots = [{ slot: 'QB', slotIndex: 0, player: { sleeper_id: '1' } }]
    const out = compareToActualStarters({ recommendedSlots: slots, actualStarterIds: ['1'] })
    expect(out.isOptimal).toBe(true)
    expect(out.diffs).toEqual([])
  })

  it('meldet Abweichung, wenn ein Starter fehlt', () => {
    const slots = [{ slot: 'RB', slotIndex: 0, player: { sleeper_id: '2', name: 'RB Best' } }]
    const out = compareToActualStarters({ recommendedSlots: slots, actualStarterIds: ['3'] })
    expect(out.isOptimal).toBe(false)
    expect(out.diffs).toContainEqual({ slot: 'RB', in: '2', name: 'RB Best' })
    // '3' ist aktueller Starter, taucht aber in keinem empfohlenen Slot auf -> "raus".
    expect(out.diffs).toContainEqual({ slot: null, out: '3' })
  })
})
