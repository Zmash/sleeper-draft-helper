// src/services/analysis.js
import { normalizePlayerName } from '../utils/formatting'

const isNum = (n) => Number.isFinite(n)
const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const scale01 = (x, min, max) => {
  if (!isNum(min) || !isNum(max) || max <= min) return 0.5
  return (x - min) / (max - min)
}
const scale100 = (x, min, max) => Math.round(100 * Math.max(0, Math.min(1, scale01(x, min, max))))

// --- Value-Tuning ---
const VALUE_ECR_WEIGHT = 0.85   // ECR dominiert
const VALUE_ADP_WEIGHT = 0.15   // ADP nur leicht als Kontext
const VALUE_DELTA_CAP  = 20     // harte Kappung der Deltas

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
const capDelta = (d, cap = VALUE_DELTA_CAP) => clamp(d, -cap, cap)

// Späte Runden schwächer werten: <=100 voll, 101..160 75%, >160 50%
function lateRoundWeight(pickNo) {
  const n = Number(pickNo)
  if (!Number.isFinite(n)) return 1
  if (n <= 100) return 1
  if (n <= 160) return 0.75
  return 0.5
}

// K/DST (bzw. DEF) deutlich entwerten
function positionWeight(pos) {
  const p = String(pos || '').toUpperCase()
  if (p === 'K' || p === 'DST' || p === 'DEF') return 0.25
  return 1
}

function requiredStarters(rosterPositions = []) {
  const req = { QB:0, RB:0, WR:0, TE:0 }
  for (const slot of rosterPositions || []) {
    const s = String(slot || '').toUpperCase()
    if (req[s] != null) req[s] += 1
  }
  if (!req.QB) req.QB = 1
  if (!req.RB) req.RB = 2
  if (!req.WR) req.WR = 2
  if (!req.TE) req.TE = 1
  return req
}

/** interner Helper: Team-Key konsistent zu App.jsx/ownerLabels */
function ownerKeyFromPick(p, teamsCount = 0) {
  // Priorität: echte User-ID -> Roster -> Draft-Slot -> aus pick_no ableiten
  if (p?.picked_by) return `user:${p.picked_by}`
  if (p?.roster_id != null) return `roster:${p.roster_id}`
  const slot = p?.draft_slot ?? p?.metadata?.draft_slot ?? p?.slot
  if (slot != null) return `slot:${slot}`

  if (teamsCount && p?.pick_no) {
    const s = ((Number(p.pick_no) - 1) % Number(teamsCount)) + 1
    return `slot:${s}`
  }
  return `slot:unknown`
}

/** Runden robust schätzen, falls nicht aus Draft vorhanden */
function estimateRounds(livePicks = [], teamsCount = 0) {
  if (!Number.isFinite(teamsCount) || teamsCount <= 0) return 0
  let maxPickNo = 0
  for (const p of (livePicks || [])) {
    const n = Number(p?.pick_no)
    if (Number.isFinite(n) && n > maxPickNo) maxPickNo = n
  }
  if (!maxPickNo) return 0
  return Math.ceil(maxPickNo / teamsCount)
}

/**
 * Prüft, ob der Draft vollständig ist.
 * Falls rounds fehlt, wird es aus den Picks geschätzt.
 */
export function isDraftComplete(livePicks = [], teamsCount = 0, rounds = 0) {
  const t = Number(teamsCount)
  let r = Number(rounds)
  if (!Number.isFinite(r) || r <= 0) {
    r = estimateRounds(livePicks, t)
  }
  if (!Number.isFinite(t) || !Number.isFinite(r) || t <= 0 || r <= 0) return false
  const expected = t * r

  const uniquePickNos = new Set()
  for (const p of (livePicks || [])) {
    const n = Number(p?.pick_no)
    if (Number.isFinite(n) && n > 0) uniquePickNos.add(n)
  }
  return uniquePickNos.size >= expected
}

/**
 * Team-Scores berechnen (Value/Positional/Balance/Diversity/Bye + Total)
 */
export function computeTeamScores({
  boardPlayers = [],
  livePicks = [],
  teamsCount = 0,
  rosterPositions = [],
}) {
  const bySleeperId = new Map(
    boardPlayers.filter(p => p?.sleeper_id != null).map(p => [String(p.sleeper_id), p])
  )
  const byName = new Map(boardPlayers.map(p => [p.nname, p]))

  const playerForPick = (pick) => {
    const sid = String(pick?.player_id ?? pick?.metadata?.player_id ?? pick?.metadata?.id ?? '')
    if (sid && bySleeperId.has(sid)) return bySleeperId.get(sid)
    const name = normalizePlayerName(`${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`)
    if (name && byName.has(name)) return byName.get(name)
    return null
  }

  // Teams mit konsistenten Keys aufbauen
  const teams = new Map()
  for (const pick of (livePicks || [])) {
    const key = ownerKeyFromPick(pick, teamsCount)
    if (!teams.has(key)) {
      teams.set(key, {
        key,
        picks: [],
        valueRaw: 0,
        posCounts: { QB:0, RB:0, WR:0, TE:0, K:0, DST:0 },
        byeCounts: {},
      })
    }
    teams.get(key).picks.push(pick)
  }

  // Value aggregieren
  for (const team of teams.values()) {
    for (const pick of team.picks) {
      const player = playerForPick(pick)
      if (!player) continue

      const rk     = toNum(player.rk)
      const evA    = toNum(player.ecrVsAdp ?? player['ECR VS. ADP'] ?? player['ECRvsADP'])
      // ADP-Fallback: ADP = RK + (ECRvsADP)
      const adp    = toNum(player.adp ?? (isNum(rk) && isNum(evA) ? rk + evA : null))
      const pickNo = toNum(pick.pick_no)

      // Deltas (Pick vs. ECR/ADP)
      const expertDelta = (isNum(rk)  && isNum(pickNo)) ? (pickNo - rk)  : 0
      const marketDelta = (isNum(adp) && isNum(pickNo)) ? (pickNo - adp) : 0

      // Kappen & Mischung: ECR dominiert, ADP nur leicht
      const blended =
        (VALUE_ECR_WEIGHT * capDelta(expertDelta)) +
        (VALUE_ADP_WEIGHT * capDelta(marketDelta))

      // Späte Runden & K/DST abschwächen
      const w = lateRoundWeight(pickNo) * positionWeight(player.pos)

      team.valueRaw += blended * w

      // Positions-/Bye-Statistiken
      const pos = String(player.pos || '').toUpperCase()
      const posKey = (pos === 'DEF') ? 'DST' : pos
      if (team.posCounts[posKey] != null) team.posCounts[posKey] += 1

      const bye = String(player.bye || '').trim()
      if (bye) team.byeCounts[bye] = (team.byeCounts[bye] || 0) + 1
    }
  }

  const rawValues = Array.from(teams.values()).map(t => t.valueRaw)
  const minV = rawValues.length ? Math.min(...rawValues) : 0
  const maxV = rawValues.length ? Math.max(...rawValues) : 1

  const req = requiredStarters(rosterPositions)

  for (const team of teams.values()) {
    const valueScore = scale100(team.valueRaw, minV, maxV)

    let have = 0, need = 0
    for (const p of ['QB','RB','WR','TE']) {
      need += req[p] || 0
      have += Math.min(team.posCounts[p] || 0, req[p] || 0)
    }
    const positionalScore = need ? Math.round(100 * (have / need)) : 50

    const rb = team.posCounts.RB || 0
    const wr = team.posCounts.WR || 0
    const totalRw = rb + wr
    let balanceScore = 50
    if (totalRw >= 2) {
      const ideal = totalRw / 2
      const diff = Math.abs(rb - ideal)
      balanceScore = Math.round(100 * (1 - diff / ideal))
    }

    const first8Players = team.picks.slice(0, 8).map(playerForPick).filter(Boolean)
    const uniqPos = new Set(first8Players.map(p => String(p.pos || '').toUpperCase()))
    const diversityScore = Math.round(100 * Math.min(1, uniqPos.size / 4))

    const maxPileup = Math.max(0, ...Object.values(team.byeCounts))
    const byePenalty = Math.max(0, maxPileup - 2) * 12
    const byeScore = Math.max(0, 100 - byePenalty)

    const total = Math.round(
      0.35 * valueScore +
      0.25 * positionalScore +
      0.15 * balanceScore +
      0.15 * diversityScore +
      0.10 * byeScore
    )

    team.value      = valueScore
    team.positional = positionalScore
    team.balance    = balanceScore
    team.diversity  = diversityScore
    team.bye        = byeScore
    team.total      = total
  }

  return Array.from(teams.values())
    .sort((a, b) => b.total - a.total)
    .map((t, i) => ({
      rank: i + 1,
      key: t.key,           // passt zu ownerLabels (user:, roster:, slot:)
      total: t.total,
      value: t.value,
      positional: t.positional,
      balance: t.balance,
      diversity: t.diversity,
      bye: t.bye,
    }))
}
