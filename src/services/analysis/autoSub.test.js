import { describe, it, expect } from 'vitest'
import { autoSubRules, readAutoSubs, applyAutoSubs, pendingAutoSubCount, recommendAutoSubs } from './autoSub'

const P = (id, pos, extra = {}) => ({ sleeper_id: id, name: `P${id}`, pos, team: 'KC', bye: '', injury_status: null, ...extra })

describe('autoSubRules', () => {
  it('liefert null ohne AutoSubs', () => {
    expect(autoSubRules({ settings: {} })).toBeNull()
    expect(autoSubRules({ settings: { max_subs: 0 } })).toBeNull()
    expect(autoSubRules(null)).toBeNull()
  })
  it('liest Anzahl und Kickoff-Regel', () => {
    expect(autoSubRules({ settings: { max_subs: 3, sub_start_time_eligibility: 1 } }))
      .toEqual({ maxSubs: 3, requireLaterKickoff: true })
    expect(autoSubRules({ settings: { max_subs: 2 } }))
      .toEqual({ maxSubs: 2, requireLaterKickoff: false })
  })
})

describe('readAutoSubs', () => {
  const roster = { starters: ['1', '2'], players: ['1', '2', '3', '4'] }
  it('liest eine Starter->Sub-Map und prueft sie gegen den Kader', () => {
    const subs = readAutoSubs({ roster: { ...roster, metadata: { autosubs: { 1: '3', 2: '1', 9: '4' } } } })
    // 2 -> 1 faellt raus (Sub ist selbst Starter), 9 ist kein Starter.
    expect([...subs]).toEqual([['1', '3']])
  })
  it('liest Listen mit sprechenden Feldern', () => {
    const subs = readAutoSubs({ roster, matchup: { starters: ['1', '2'], subs: [{ starter_id: '2', sub_id: '4' }] } })
    expect(subs.get('2')).toBe('4')
  })
  it('bleibt leer, wenn nichts belegbar ist', () => {
    expect(readAutoSubs({ roster }).size).toBe(0)
    expect(readAutoSubs({}).size).toBe(0)
  })
})

describe('applyAutoSubs', () => {
  const rules = { maxSubs: 1, requireLaterKickoff: false }
  it('tauscht ausgefallene Starter gegen ihren Sub, bis zum Limit', () => {
    const subs = new Map([['1', '3'], ['2', '4']])
    const r = applyAutoSubs({ starterIds: ['1', '2'], subs, rules, outFor: () => true })
    expect(r.starterIds).toEqual(['3', '2'])
    expect(r.applied).toEqual([{ outId: '1', subId: '3' }])
  })
  it('laesst gesunde und bereits punktende Starter stehen', () => {
    const subs = new Map([['1', '3']])
    expect(applyAutoSubs({ starterIds: ['1'], subs, rules, outFor: () => false }).starterIds).toEqual(['1'])
    expect(applyAutoSubs({ starterIds: ['1'], subs, rules, outFor: () => true, pointsFor: () => 4 }).starterIds).toEqual(['1'])
  })
  it('ohne Regeln oder Subs unveraendert', () => {
    const ids = ['1']
    expect(applyAutoSubs({ starterIds: ids, subs: new Map(), rules }).starterIds).toBe(ids)
    expect(applyAutoSubs({ starterIds: ids, subs: new Map([['1', '2']]), rules: null }).starterIds).toBe(ids)
  })
})

describe('pendingAutoSubCount', () => {
  const rules = { maxSubs: 2, requireLaterKickoff: false }
  it('zaehlt ausgefallene Starter vor Kickoff, gedeckelt aufs Limit', () => {
    const n = pendingAutoSubCount({
      starterIds: ['1', '2', '3', '4'], rules,
      outFor: (id) => id !== '4',
      gameFor: (id) => ({ state: id === '3' ? 'post' : 'pre' }),
    })
    expect(n).toBe(2)
  })
  it('0 ohne Regeln', () => {
    expect(pendingAutoSubCount({ starterIds: ['1'], rules: null, outFor: () => true })).toBe(0)
  })
})

describe('recommendAutoSubs', () => {
  const rules = { maxSubs: 3, requireLaterKickoff: false }
  const pts = { 10: 15, 11: 12, 20: 9, 21: 11, 22: 4, 30: 7 }
  const ptsFor = (p) => pts[p.sleeper_id] ?? null

  it('empfiehlt nur fuer fragliche Starter, auch wenn mehr Subs erlaubt sind', () => {
    const slots = [
      { slot: 'WR', slotIndex: 0, player: P('10', 'WR', { injury_status: 'Questionable' }) },
      { slot: 'WR', slotIndex: 1, player: P('11', 'WR') },
    ]
    const bench = [P('20', 'WR'), P('21', 'WR'), P('30', 'RB')]
    const { picks } = recommendAutoSubs({ slots, bench, rules, ptsFor })
    expect(picks).toHaveLength(1)
    expect(picks[0].starter.sleeper_id).toBe('10')
    expect(picks[0].sub.sleeper_id).toBe('21')
  })

  it('beachtet Slot-Tauglichkeit und vergibt jeden Bankspieler nur einmal', () => {
    const slots = [
      { slot: 'RB', slotIndex: 0, player: P('10', 'RB', { injury_status: 'Doubtful' }) },
      { slot: 'FLEX', slotIndex: 0, player: P('11', 'WR', { injury_status: 'Questionable' }) },
    ]
    const bench = [P('30', 'RB'), P('22', 'WR')]
    const { picks } = recommendAutoSubs({ slots, bench, rules, ptsFor })
    const bySlot = Object.fromEntries(picks.map((p) => [p.slot, p.sub.sleeper_id]))
    // Der RB-Slot (hoeheres Risiko) bekommt den RB, der FLEX den WR.
    expect(bySlot).toEqual({ RB: '30', FLEX: '22' })
  })

  it('haelt das Liga-Limit ein und meldet den Rest als ungedeckt', () => {
    const slots = [
      { slot: 'WR', slotIndex: 0, player: P('10', 'WR', { injury_status: 'Questionable' }) },
      { slot: 'WR', slotIndex: 1, player: P('11', 'WR', { injury_status: 'Doubtful' }) },
    ]
    const bench = [P('20', 'WR'), P('21', 'WR')]
    const { picks, uncovered } = recommendAutoSubs({ slots, bench, rules: { maxSubs: 1, requireLaterKickoff: false }, ptsFor })
    expect(picks.map((p) => p.starter.sleeper_id)).toEqual(['11'])
    expect(uncovered).toEqual([expect.objectContaining({ reason: 'limit' })])
  })

  it('verlangt bei Kickoff-Regel einen gleich spaeten oder spaeteren Sub', () => {
    const kick = { 10: 2000, 20: 1000, 22: 3000 }
    const slots = [{ slot: 'WR', slotIndex: 0, player: P('10', 'WR', { injury_status: 'Questionable' }) }]
    const bench = [P('20', 'WR'), P('22', 'WR')]
    const { picks } = recommendAutoSubs({
      slots, bench, rules: { maxSubs: 1, requireLaterKickoff: true }, ptsFor,
      kickoffFor: (p) => kick[p.sleeper_id] ?? null,
    })
    expect(picks[0].sub.sleeper_id).toBe('22')
  })

  it('ignoriert gesperrte Starter und Bankspieler auf Bye oder Out', () => {
    const slots = [
      { slot: 'WR', slotIndex: 0, locked: true, player: P('10', 'WR', { injury_status: 'Questionable' }) },
      { slot: 'WR', slotIndex: 1, player: P('11', 'WR', { injury_status: 'Questionable' }) },
    ]
    const bench = [P('20', 'WR', { bye: '5' }), P('21', 'WR', { injury_status: 'Out' })]
    const { picks, uncovered } = recommendAutoSubs({ slots, bench, rules, ptsFor, currentWeekBye: '5' })
    expect(picks).toEqual([])
    expect(uncovered).toEqual([expect.objectContaining({ reason: 'none', starter: expect.objectContaining({ sleeper_id: '11' }) })])
  })

  it('ohne Regeln nichts', () => {
    expect(recommendAutoSubs({ slots: [], bench: [], rules: null })).toEqual({ picks: [], uncovered: [] })
  })
})
