import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDraftTips, POS_NEED_SLACK } from './useDraftTips'

const roster = ['QB','RB','RB','WR','WR','TE','FLEX','BN','BN','BN','BN','BN','BN','BN','BN','BN']
const base = {
  meUserId: 'u1', teamsCount: 12, rosterPositions: roster,
  scoringSettings: { rec: 1 }, scoringType: 'ppr', draftType: 'snake',
  strategies: ['balanced'], draftSlot: 1, enabled: true,
}
const tipsOf = (over) => renderHook(() => useDraftTips({ ...base, ...over })).result.current

describe('Sprache', () => {
  it('alle Tips sind deutsch', () => {
    const tips = tipsOf({
      picks: [], boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 20 }],
    })
    const text = tips.map(t => t.text).join(' ')
    expect(text).not.toMatch(/\b(You|your|Only|Value on board|carries)\b/)
  })
})

describe('Value mit Streuung', () => {
  it('nennt die Spanne, wenn stdev vorliegt', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 20 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24, stdev: 6, high: 18, low: 31 }],
    })
    const t = tips.find(x => x.type === 'value')
    expect(t.text).toMatch(/zwischen Pick 18 und 31/)
  })

  it('faellt ohne stdev auf die Binaer-Aussage zurueck (CSV-Board)', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 20 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24 }],
    })
    const t = tips.find(x => x.type === 'value')
    expect(t).toBeTruthy()
    expect(t.text).not.toMatch(/zwischen Pick/)
  })
})

describe('pos_need entrauscht', () => {
  it('schweigt bei Pick 1 — dort ist die Aussage trivial wahr', () => {
    const tips = tipsOf({
      picks: [], boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1' }],
    })
    expect(tips.find(t => t.type === 'pos_need')).toBeUndefined()
  })

  it('feuert, wenn die verbleibenden Picks die offenen Startplaetze kaum noch decken', () => {
    // 16 Runden, 15 eigene Picks verbraucht -> 1 Pick uebrig, Startplaetze offen
    const picks = []
    for (let i = 1; i <= 178; i++) picks.push({ pick_no: i, picked_by: i % 12 === 1 ? 'u1' : 'u2', metadata: { position: 'WR' } })
    const tips = tipsOf({ picks, boardPlayers: [{ name: 'R B', nname: 'rb', pos: 'RB', rk: '1' }] })
    expect(tips.find(t => t.type === 'pos_need')).toBeTruthy()
  })

  it('POS_NEED_SLACK ist eine benannte Konstante, keine Magic Number', () => {
    expect(POS_NEED_SLACK).toBe(2)
  })
})

describe('Bye-Cluster', () => {
  it('warnt, wenn eigene Starter derselben Position in derselben Bye-Woche klumpen', () => {
    const picks = [
      { pick_no: 1, picked_by: 'u1', metadata: { position: 'RB', first_name: 'A', last_name: 'B' } },
      { pick_no: 2, picked_by: 'u1', metadata: { position: 'RB', first_name: 'C', last_name: 'D' } },
    ]
    const boardPlayers = [
      { name: 'A B', nname: 'ab', pos: 'RB', rk: '1', bye: 7, status: 'me', pick_no: 1 },
      { name: 'C D', nname: 'cd', pos: 'RB', rk: '2', bye: 7, status: 'me', pick_no: 2 },
    ]
    const tips = tipsOf({ picks, boardPlayers })
    const t = tips.find(x => x.type === 'bye_cluster')
    expect(t).toBeTruthy()
    expect(t.text).toMatch(/Woche 7/)
  })

  it('schweigt ohne Klumpen', () => {
    const picks = [{ pick_no: 1, picked_by: 'u1', metadata: { position: 'RB' } }]
    const boardPlayers = [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', bye: 7, status: 'me', pick_no: 1 }]
    expect(tipsOf({ picks, boardPlayers }).find(t => t.type === 'bye_cluster')).toBeUndefined()
  })
})

describe('enabled', () => {
  it('liefert nichts, wenn ausgeschaltet', () => {
    expect(tipsOf({ enabled: false, picks: [], boardPlayers: [] })).toEqual([])
  })
})
