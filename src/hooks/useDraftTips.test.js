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

  // Minor 9: die Spanne allein zwingt den Nutzer, myNext selbst dagegen zu
  // halten. Der Tip soll das Urteil liefern, nicht nur die Rohdaten.
  it('urteilt "duerfte da sein", wenn myNext unter high liegt', () => {
    // draftSlot 6, 1 Pick bisher -> myNext = 5 (< high 18)
    const tips = tipsOf({
      picks: [{ pick_no: 1, picked_by: 'u2' }],
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24, high: 18, low: 31 }],
      draftSlot: 6,
    })
    const t = tips.find(x => x.type === 'value')
    expect(t.text).toMatch(/dürfte da sein/)
  })

  it('urteilt "duerfte weg sein", wenn myNext ueber low liegt', () => {
    // draftSlot 1, 25 Picks bisher -> myNext = 47 (> low 31)
    const tips = tipsOf({
      picks: Array.from({ length: 25 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24, high: 18, low: 31 }],
      draftSlot: 1,
    })
    const t = tips.find(x => x.type === 'value')
    expect(t.text).toMatch(/dürfte weg sein/)
  })

  it('urteilt "ein Muenzwurf", wenn myNext zwischen high und low liegt', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 20 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24, stdev: 6, high: 18, low: 31 }],
    })
    const t = tips.find(x => x.type === 'value')
    expect(t.text).toMatch(/ein Münzwurf/)
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

  // Regression fuer App.jsx: draftSlot wurde an useRookieDraftTips durchgereicht,
  // an useDraftTips (Redraft) aber nicht. Ohne draftSlot faellt picksUntilMyNext
  // vor dem eigenen ersten Pick auf mine.length===0 -> null zurueck, und die
  // "bis zu deinem naechsten Pick"-Aussage bleibt in Runde 1 tot.
  it('nennt "naechster Pick" schon vor dem eigenen ersten Pick, wenn draftSlot bekannt ist', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 5 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24 }],
      draftSlot: 1,
    })
    const t = tips.find(x => x.type === 'value')
    expect(t).toBeTruthy()
    expect(t.text).toMatch(/nächsten Pick/)
  })

  // Dokumentiert (nicht aendert) das Fallback-Verhalten von picksUntilMyNext:
  // Vorsicht, Number(null) ist 0 (finite!) und faellt damit NICHT auf den
  // mine.length-Zweig zurueck. Nur ein wirklich unbestimmbarer Slot (NaN) loest
  // den echten Fallback (kein eigener Pick -> return null) aus.
  it('schweigt ganz ohne bestimmbaren draftSlot und ohne eigenen Pick', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 5 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24 }],
      draftSlot: NaN,
    })
    const t = tips.find(x => x.type === 'value')
    expect(t).toBeTruthy()
    expect(t.text).not.toMatch(/nächsten Pick/)
  })
})

describe('adp: null ist kein Fehler, kein erfundener Tip', () => {
  // mergeRankingsWithMarket setzt fuer jeden Nicht-Treffer explizit adp/high/low
  // auf null. Number(null) ist 0 (finite!) — ohne expliziten Guard erfindet der
  // Value-Tip ein Delta und eine Dringlichkeit fuer einen Spieler ohne ADP.
  it('kein Value-Tip fuer einen Spieler ohne ADP', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 20 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'Unmatched Guy', nname: 'unmatchedguy', pos: 'WR', rk: '2', adp: null, high: null, low: null }],
    })
    const t = tips.find(x => x.type === 'value' && /Unmatched Guy/.test(x.text))
    expect(t).toBeUndefined()
  })

  it('kein Tip-Text enthaelt das Wort "null"', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 20 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [
        { name: 'Unmatched Guy', nname: 'unmatchedguy', pos: 'WR', rk: '2', adp: null, high: null, low: null },
        { name: 'Matched Guy', nname: 'matchedguy', pos: 'RB', rk: '1', adp: 24, high: 18, low: 31 },
      ],
    })
    const text = tips.map(t => t.text).join(' ')
    expect(text).not.toMatch(/\bnull\b/)
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
