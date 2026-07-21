// src/services/analysis.js
import { normalizePlayerName } from '../utils/formatting'
import { countStarters } from './derive'

const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

// --- Value-Tuning ---
const VALUE_ECR_WEIGHT = 0.85   // ECR dominiert
const VALUE_ADP_WEIGHT = 0.15   // ADP nur leicht als Kontext
const VALUE_DELTA_CAP  = 20     // harte Kappung der Deltas
const VALUE_SCALE      = 4      // ponytail: Punkte je Delta-Schnitt um die 50er-Mitte

// --- Rank->Wert-Kurve (Basis fuer Starter/Depth) ---
const RANK_DECAY     = 45       // ponytail: Tuning-Knopf; kleiner = Studs zaehlen staerker
const UNRANKED_VALUE = 2        // Floor fuer ungerankte/ungematchte Spieler
const DEPTH_BENCH_N  = 5        // wie viele Bench-Spieler in Depth einfliessen

// --- Balance-Tuning ---
const BALANCE_SOFT_W       = 5  // Punkte je Einheit Soll-Abweichung
const BALANCE_HARD_MISSING = 12 // Punkte je fehlendem Pflicht-Starter (inkl. K/DST)

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

// Spielerwert aus dem Overall-Rank: rk 1 -> 100, rk 30 -> ~52, rk 100 -> ~11
function playerValue(rk) {
  if (rk == null || !Number.isFinite(rk)) return UNRANKED_VALUE
  return 100 * Math.exp(-(rk - 1) / RANK_DECAY)
}

// Starterplaetze aus den Roster-Settings; leeres Roster -> Standard-Lineup
function lineupSlots(rosterPositions = []) {
  if (!(rosterPositions || []).length) {
    return { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPER_FLEX: 0 }
  }
  return countStarters(rosterPositions)
}

// Greedy: dedizierte Slots zuerst (beste Ranks), dann FLEX/SUPER_FLEX aus dem Rest
function fillLineup(entries, req) {
  const pool = entries.slice().sort((a, b) => b.val - a.val)
  const used = new Set()
  const starters = []
  const take = (allowed, count) => {
    for (const e of pool) {
      if (count <= 0) break
      if (used.has(e) || !allowed.includes(e.pos)) continue
      used.add(e)
      starters.push(e)
      count -= 1
    }
  }
  take(['QB'], req.QB || 0)
  take(['RB'], req.RB || 0)
  take(['WR'], req.WR || 0)
  take(['TE'], req.TE || 0)
  take(['RB', 'WR', 'TE'], req.FLEX || 0)
  take(['QB', 'RB', 'WR', 'TE'], req.SUPER_FLEX || 0)
  return { starters, bench: pool.filter(e => !used.has(e)) }
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
 * Team-Scores berechnen (Value/Starter/Depth/Balance/Bye + Total).
 * Bedeutungen: Value 50 = nach Marktwert gedraftet; Starter/Depth 100 = bestes
 * Lineup bzw. tiefste Bench der Liga; Balance/Bye = 100 minus konkrete Strafen.
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

  const req = lineupSlots(rosterPositions)
  // countStarters kennt K/DEF nicht — direkt aus den Roster-Slots zaehlen.
  let reqK = 0, reqDST = 0
  for (const slot of rosterPositions || []) {
    const s = String(slot || '').toUpperCase()
    if (s === 'K') reqK += 1
    else if (s === 'DEF' || s === 'DST') reqDST += 1
  }
  const slotsTotal = (req.QB || 0) + (req.RB || 0) + (req.WR || 0) + (req.TE || 0) + (req.FLEX || 0) + (req.SUPER_FLEX || 0)
  const slotsAll = slotsTotal + reqK + reqDST

  // Soll-Verteilung fuer Balance: Starter + FLEX-Anteil + sinnvolle Backups.
  const target = {
    QB: (req.QB || 0) + (req.SUPER_FLEX || 0) + 1,
    RB: (req.RB || 0) + (req.FLEX || 0) / 2 + 1.5,
    WR: (req.WR || 0) + (req.FLEX || 0) / 2 + 1.5,
    TE: (req.TE || 0) + 0.5,
    K: reqK,
    DST: reqDST,
  }

  const teams = new Map()
  for (const pick of (livePicks || [])) {
    const key = ownerKeyFromPick(pick, teamsCount)
    if (!teams.has(key)) teams.set(key, { key, picks: [] })
    teams.get(key).picks.push(pick)
  }

  // Ohne ein einziges Board-Match sind Rank-basierte Scores erfunden -> neutral 50.
  let anyRanked = false

  for (const team of teams.values()) {
    let deltaSum = 0
    let deltaCount = 0
    const entries = []   // { pos, val, bye } nur QB/RB/WR/TE
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 }

    for (const pick of team.picks) {
      const player = playerForPick(pick)
      const rawPos = String(player?.pos ?? pick?.metadata?.position ?? '').toUpperCase()
      const pos = rawPos === 'DEF' ? 'DST' : rawPos
      const rk = player ? toNum(player.rk) : null
      if (rk != null) anyRanked = true

      if (player) {
        const evA = toNum(player.ecrVsAdp ?? player['ECR VS. ADP'] ?? player['ECRvsADP'])
        const adp = toNum(player.adp ?? ((rk != null && evA != null) ? rk + evA : null))
        const pickNo = toNum(pick.pick_no)
        const expertDelta = (rk != null && pickNo != null) ? (pickNo - rk) : null
        const marketDelta = (adp != null && pickNo != null) ? (pickNo - adp) : null
        if (expertDelta != null || marketDelta != null) {
          const blended =
            VALUE_ECR_WEIGHT * capDelta(expertDelta ?? marketDelta) +
            VALUE_ADP_WEIGHT * capDelta(marketDelta ?? expertDelta)
          deltaSum += blended * lateRoundWeight(pickNo) * positionWeight(pos)
          deltaCount += 1
        }
      }

      if (counts[pos] != null) counts[pos] += 1
      if (pos === 'QB' || pos === 'RB' || pos === 'WR' || pos === 'TE') {
        const byeStr = String(player?.bye ?? '').trim()
        entries.push({ pos, val: playerValue(rk), bye: byeStr || null })
      }
    }

    const { starters, bench } = fillLineup(entries, req)
    team._counts = counts
    team._starters = starters
    team._deltaAvg = deltaCount ? deltaSum / deltaCount : null
    team._starterRaw = starters.reduce((s, e) => s + e.val, 0)
    team._depthRaw = bench.slice(0, DEPTH_BENCH_N).reduce((s, e) => s + e.val, 0)
  }

  const teamsArr = Array.from(teams.values())
  const maxStarter = Math.max(0, ...teamsArr.map(t => t._starterRaw))
  const maxDepth = Math.max(0, ...teamsArr.map(t => t._depthRaw))

  for (const team of teamsArr) {
    // Value: 50 = Marktwert, Steals darueber, Reaches darunter
    const value = (!anyRanked || team._deltaAvg == null)
      ? 50
      : Math.round(clamp(50 + VALUE_SCALE * team._deltaAvg, 0, 100))

    // Starter/Depth: relativ zum Liga-Besten
    const starter = (!anyRanked || maxStarter <= 0) ? 50 : Math.round(100 * team._starterRaw / maxStarter)
    const depth = (!anyRanked || maxDepth <= 0) ? 50 : Math.round(100 * team._depthRaw / maxDepth)

    // Balance: Soll/Ist-Abweichung der Kaderstruktur (kontinuierlich statt binaer —
    // die binaeren Strafen ergaben im realen 12er-Mock fuer alle Teams 100).
    const counts = team._counts
    const picksN = team.picks.length
    let balance = 100

    // Hart: fehlende Pflicht-Starter (inkl. K/DST) — nur soweit die Picks sie
    // schon haetten decken koennen (laufender Draft wird nicht pauschal bestraft).
    const dedicated = { QB: req.QB || 0, RB: req.RB || 0, WR: req.WR || 0, TE: req.TE || 0, K: reqK, DST: reqDST }
    let missing = 0
    for (const p of Object.keys(dedicated)) missing += Math.max(0, dedicated[p] - counts[p])
    const allowance = Math.max(0, slotsAll - picksN)
    balance -= Math.max(0, missing - allowance) * BALANCE_HARD_MISSING

    // Weich: Abweichung von der Soll-Verteilung. Ueberschuss zaehlt immer
    // (6 RBs sind auch mitten im Draft schief), Unterdeckung erst, wenn genug
    // Picks fuer ein volles Lineup da waren. K/DST nur als Ueberschuss (die
    // Unterdeckung steckt schon in der harten Strafe).
    let dev = 0
    for (const p of ['QB', 'RB', 'WR', 'TE']) {
      const d = counts[p] - target[p]
      if (d > 0) dev += d
      else if (picksN >= slotsAll) dev += -d
    }
    dev += Math.max(0, counts.K - target.K) + Math.max(0, counts.DST - target.DST)
    balance -= dev * BALANCE_SOFT_W

    balance = Math.round(clamp(balance, 0, 100))

    // Bye: nur Ueberschneidungen innerhalb der Starter
    const byeCounts = {}
    for (const e of team._starters) {
      if (e.bye) byeCounts[e.bye] = (byeCounts[e.bye] || 0) + 1
    }
    let byePenalty = 0
    for (const n of Object.values(byeCounts)) byePenalty += Math.max(0, n - 1) * 10
    const bye = clamp(100 - byePenalty, 0, 100)

    team.value = value
    team.starter = starter
    team.depth = depth
    team.balance = balance
    team.bye = bye
    team.total = Math.round(0.35 * starter + 0.30 * value + 0.15 * depth + 0.10 * balance + 0.10 * bye)
  }

  return teamsArr
    .sort((a, b) => b.total - a.total)
    .map((t, i) => ({
      rank: i + 1,
      key: t.key,           // passt zu ownerLabels (user:, roster:, slot:)
      total: t.total,
      value: t.value,
      starter: t.starter,
      depth: t.depth,
      balance: t.balance,
      bye: t.bye,
    }))
}
