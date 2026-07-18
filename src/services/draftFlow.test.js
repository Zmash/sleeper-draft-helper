import { describe, it, expect } from 'vitest'
import { snakeSlotForPick, detectRuns, opponentsUntilMyNext, RUN_MIN } from './draftFlow'

const pick = (no, pos) => ({ pick_no: no, metadata: { position: pos } })

describe('snakeSlotForPick', () => {
  it('Runde 1 laeuft vorwaerts, Runde 2 gespiegelt', () => {
    expect(snakeSlotForPick(1, 10)).toBe(1)
    expect(snakeSlotForPick(10, 10)).toBe(10)
    expect(snakeSlotForPick(11, 10)).toBe(10)   // Snake: Slot 10 pickt doppelt
    expect(snakeSlotForPick(20, 10)).toBe(1)
    expect(snakeSlotForPick(21, 10)).toBe(1)    // und Slot 1 auch
  })
  it('null bei kaputten Eingaben — niemals Slot 0 erfinden', () => {
    expect(snakeSlotForPick(null, 10)).toBe(null)
    expect(snakeSlotForPick(4, null)).toBe(null)
    expect(snakeSlotForPick(0, 10)).toBe(null)
  })
})

describe('detectRuns', () => {
  it('erkennt einen RB-Run im Fenster', () => {
    const picks = [
      ...[1,2,3,4,5].map(n => pick(n, 'RB')),
      ...[6,7,8,9,10,11,12].map(n => pick(n, 'WR')),
    ]
    const r = detectRuns(picks)
    expect(r.counts.RB).toBe(5)
    expect(r.run).toBe('WR')   // 7 von 12 = 58% — WR ist der staerkere Run
  })
  it('kein Run unter dem Minimum', () => {
    const picks = [pick(1,'RB'), pick(2,'RB'), pick(3,'RB'), pick(4,'WR')]
    expect(detectRuns(picks).run).toBe(null)   // RB 3 < RUN_MIN
    expect(RUN_MIN).toBe(4)
  })
  it('leere Picks: leeres Ergebnis, kein Wurf', () => {
    expect(detectRuns([])).toEqual({ recent: [], counts: {}, run: null })
  })
})

describe('opponentsUntilMyNext', () => {
  const roster = ['QB','RB','RB','WR','WR','TE','FLEX','BN']
  it('10 Teams, ich Slot 4, Pick 4 steht an: Gegner sind Picks 5–16, mein naechster ist 17', () => {
    const r = opponentsUntilMyNext({
      picks: [pick(1,'RB'), pick(2,'RB'), pick(3,'WR')],
      teamsCount: 10, mySlot: 4, upcomingPick: 4, rosterPositions: roster,
    })
    expect(r.my_next_pick).toBe(17)
    expect(r.between).toHaveLength(12)
    expect(r.between[0].pick_no).toBe(5)
    expect(r.between[0].slot).toBe(5)
    // Slots 1–3 haben zwar gepickt, liegen aber nicht im Fenster: zwischen Pick 4
    // und meinem naechsten (17) ziehen ausschliesslich die Slots 5–10. Keiner von
    // ihnen war bisher dran, also ist noch nichts gefuellt.
    expect(r.between.every(b => b.slot >= 5)).toBe(true)
    expect(r.between[0].open_starters.RB).toBe(3)   // req.RB(2)+FLEX(1)-0
  })
  it('bin ich nicht dran, zaehlen die Gegner ab upcomingPick', () => {
    const r = opponentsUntilMyNext({
      picks: [], teamsCount: 10, mySlot: 4, upcomingPick: 7, rosterPositions: roster,
    })
    expect(r.my_next_pick).toBe(17)
    expect(r.between[0].pick_no).toBe(7)
  })
  it('Vorpicks eines Gegners fuellen seine Positionen und senken den offenen Bedarf', () => {
    // Ich Slot 4 → meine Picks sind 4, 17, 24, 37. Bei Pick 24 auf der Uhr ziehen
    // bis 37 die Picks 25–36; Slot 5 ist darin zweimal (25 und 36). Slot 5 hatte
    // vorher die Picks 5 und 16 — beide RB.
    const picks = []
    for (let n = 1; n <= 23; n++) picks.push(pick(n, 'WR'))
    picks[4]  = pick(5, 'RB')    // Pick 5  → Slot 5
    picks[15] = pick(16, 'RB')   // Pick 16 → Slot 5
    const r = opponentsUntilMyNext({
      picks, teamsCount: 10, mySlot: 4, upcomingPick: 24, rosterPositions: roster,
    })
    expect(r.my_next_pick).toBe(37)
    expect(r.between[0].pick_no).toBe(25)
    const slot5 = r.between.find(b => b.slot === 5)
    expect(slot5.filled.RB).toBe(2)
    expect(slot5.open_starters.RB).toBe(1)   // req.RB(2)+FLEX(1)-2
  })
  it('mySlot null ⇒ null — die Number(null)-Falle', () => {
    expect(opponentsUntilMyNext({ picks: [], teamsCount: 10, mySlot: null, upcomingPick: 4, rosterPositions: roster })).toBe(null)
  })
})
