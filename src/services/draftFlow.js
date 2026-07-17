// Pick-Verlauf lesen: Positions-Runs und die Luecken der Gegner, die zwischen
// jetzt und meinem naechsten Pick ziehen. Pure Snake-Mathe, keine API-Calls.
import { countStarters } from './derive'

export const RUN_WINDOW = 12
export const RUN_SHARE = 0.4
export const RUN_MIN = 4

export function snakeSlotForPick(pickNo, teams) {
  // Kein x==null-Shortcut: Number(null)===0 waere hier ein erfundener Slot.
  if (pickNo == null || teams == null) return null
  const n = Number(pickNo), t = Number(teams)
  if (!Number.isFinite(n) || n < 1 || !Number.isFinite(t) || t < 1) return null
  const round = Math.ceil(n / t)
  const inRound = n - (round - 1) * t
  return round % 2 === 1 ? inRound : t - inRound + 1
}

export function detectRuns(picks = [], { window = RUN_WINDOW } = {}) {
  const sorted = (picks || [])
    .filter(p => Number.isFinite(Number(p?.pick_no)) && p?.pick_no != null)
    .sort((a, b) => a.pick_no - b.pick_no)
  const recent = sorted.slice(-window).map(p => ({
    pick_no: p.pick_no,
    pos: String(p?.metadata?.position || '').toUpperCase() || '?',
  }))
  const counts = {}
  for (const r of recent) { if (r.pos !== '?') counts[r.pos] = (counts[r.pos] || 0) + 1 }
  let run = null
  for (const [pos, c] of Object.entries(counts)) {
    if (c >= RUN_MIN && c >= Math.ceil(recent.length * RUN_SHARE)) {
      if (!run || c > counts[run]) run = pos
    }
  }
  return { recent, counts, run }
}

export function opponentsUntilMyNext({ picks = [], teamsCount, mySlot, upcomingPick, rosterPositions = [] } = {}) {
  if (mySlot == null || teamsCount == null || upcomingPick == null) return null
  const t = Number(teamsCount), slot = Number(mySlot), up = Number(upcomingPick)
  if (!Number.isFinite(t) || t < 1 || !Number.isFinite(slot) || !Number.isFinite(up) || up < 1) return null

  const from = snakeSlotForPick(up, t) === slot ? up + 1 : up
  let myNext = null
  for (let n = from; n <= from + 2 * t; n++) {
    if (snakeSlotForPick(n, t) === slot) { myNext = n; break }
  }
  if (myNext == null) return null

  const filled = {}
  for (const p of picks || []) {
    const s = snakeSlotForPick(p?.pick_no, t)
    if (s == null) continue
    const pos = String(p?.metadata?.position || '').toUpperCase()
    if (!pos) continue
    if (!filled[s]) filled[s] = {}
    filled[s][pos] = (filled[s][pos] || 0) + 1
  }

  const req = countStarters(rosterPositions)
  const isSF = (rosterPositions || []).some(r => String(r).toUpperCase().includes('SUPER'))
  const between = []
  for (let n = from; n < myNext; n++) {
    const s = snakeSlotForPick(n, t)
    const f = filled[s] || {}
    // Bewusst dieselbe (vereinfachte) Bedarfsrechnung wie useDraftTips: ein FLEX-Startplatz
    // kann sowohl mit einem RB als auch einem WR gefuellt werden, daher wird sein Bedarf
    // sowohl RB als auch WR zugerechnet (nicht aufgeteilt) — bewusste Modellierung, kein Bug.
    between.push({
      pick_no: n, slot: s, filled: f,
      open_starters: {
        QB: Math.max(0, (isSF ? req.QB + (req.SUPER_FLEX || 0) : req.QB) - (f.QB || 0)),
        RB: Math.max(0, (req.RB + (req.FLEX || 0)) - (f.RB || 0)),
        WR: Math.max(0, (req.WR + (req.FLEX || 0)) - (f.WR || 0)),
        TE: Math.max(0, req.TE - (f.TE || 0)),
      },
    })
  }
  return { my_next_pick: myNext, between }
}
