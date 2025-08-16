// src/services/tipsPrioritizer.js
import { normalizePlayerName, normalizePos } from '../utils/formatting'

// leichte, textbasierte Typ-Erkennung für vorhandene Tipps
const TYPE_WEIGHTS = [
  { key: 'on_the_clock',  w: 30,  rx: /\bon the clock\b|\bdu bist dran\b/i },
  { key: 'value',         w: 18,  rx: /\bvalue\b|\bschnäppchen\b|\bunter ADP\b/i },
  { key: 'pos_need',      w: 20,  rx: /\bneed\b|\bbrauchst\b|\bfehl(t)? dir\b/i },
  { key: 'run_warning',   w: 15,  rx: /\brun\b|\bposition run\b|\bran\b/i },
  { key: 'stack',         w: 12,  rx: /\bstack\b|\bkombi\b|\bdouble down\b/i },
  { key: 'bye_risk',      w: -6,  rx: /\bbye\b|\bbye-week\b/i },
  { key: 'injury',        w: -12, rx: /\binjury\b|\bverletzt\b|\bout\b/i },
  { key: 'roster_full',   w: -8,  rx: /\broster full\b|\bposition voll\b/i },
]

// Hilfswerte für Positionsbedarf (Start-Slots aus League-Settings)
function computeRequiredStarters(rosterPositions = []) {
  const req = { QB:0, RB:0, WR:0, TE:0, DEF:0, K:0 }
  for (const slot of rosterPositions || []) {
    const s = normalizePos(slot)
    if (req[s] != null) req[s] += 1
  }
  return req
}

// Mein Roster nach Position aus bereits gemachten Picks
function computeMyStartersFromPicks(picks = [], meUserId) {
  const have = { QB:0, RB:0, WR:0, TE:0, DEF:0, K:0 }
  for (const p of picks || []) {
    if (p.picked_by !== meUserId) continue
    const pos = normalizePos(p?.metadata?.position || p?.position || '')
    if (have[pos] != null) have[pos] += 1
  }
  return have
}

// Spieler-Matching: versucht aus einem Tipp den Spieler in boardPlayers zu finden
function resolvePlayerFromTip(tip, boardPlayers = []) {
  // bevorzugt eindeutige IDs oder Namen
  const byId = tip?.player_id || tip?.sleeper_id || tip?.id
  if (byId) {
    const hit = boardPlayers.find(p => p.sleeper_id === byId || p.id === byId)
    if (hit) return hit
  }
  const name = tip?.player?.name || tip?.playerName || tip?.name || tip?.title
  if (name) {
    const nn = normalizePlayerName(name)
    const hit = boardPlayers.find(p => p.nname === nn || normalizePlayerName(p.name) === nn)
    if (hit) return hit
  }
  return null
}

// einfache “bald-weg”-Heuristik: Spieler mit kleinem RK, die in ~1 Runde weg sein könnten
function soonToBeGoneBoost(player, currentPickNumber, teamsCount) {
  if (!player || !teamsCount) return 0
  const rkNum = Number(player.rk)
  if (!Number.isFinite(rkNum) || !currentPickNumber) return 0
  const windowEnd = currentPickNumber + teamsCount  // ~ nächste Runde
  if (rkNum <= windowEnd) return 7
  if (rkNum <= windowEnd + teamsCount) return 3
  return 0
}

// Value Heuristik aus ECR (rk) und adp (aus CSV bereits berechnet)
function valueDeltaBoost(player) {
  if (!player) return 0
  const rk = Number(player.rk)
  const adp = Number(player.adp)
  if (!Number.isFinite(rk) || !Number.isFinite(adp)) return 0
  const delta = adp - rk // positiver Wert = günstiger als ADP
  if (delta >= 12) return 10
  if (delta >= 8)  return 7
  if (delta >= 4)  return 4
  if (delta <= -10) return -6 // deutlicher Reach -> leicht abwerten
  return 0
}

// Positionsbedarf in Score gießen
function positionNeedBoost(pos, required, have) {
  const P = normalizePos(pos || '')
  if (required[P] == null) return 0
  const gap = Math.max(0, (required[P] || 0) - (have[P] || 0))
  if (gap >= 2) return 10
  if (gap === 1) return 6
  return 0
}

// textbasierte Typ-Gewichtung
function typeWeightFromText(tip) {
  const type = String(tip?.type || '').toLowerCase()
  const weightsByKey = Object.fromEntries(TYPE_WEIGHTS.map(r => [r.key, r.w]))
  if (type && weightsByKey[type] != null) return weightsByKey[type]
  const text = [tip?.type, tip?.title, tip?.message, tip?.reason, tip?.text].filter(Boolean).join(' ')
  let w = 0
  for (const rule of TYPE_WEIGHTS) {
    if (rule.rx && rule.rx.test(text)) w += rule.w
  }
  return w
}

// Key zum Deduplizieren (gleicher Spieler / gleiche Aussage)
function tipKey(tip) {
  return (
    tip?.key ||
    tip?.player_id ||
    tip?.sleeper_id ||
    normalizePlayerName(tip?.player?.name || tip?.playerName || tip?.name || '') ||
    String(tip?.title || tip?.message || '')
  )
}

/**
 * Priorisiert, dedupliziert und begrenzt Tipps.
 *
 * @param {Array<Object>} tips – “rohe” Tipps deiner aktuellen Logik
 * @param {Object} ctx – Kontext für Scoring
 *  - boardPlayers
 *  - picks
 *  - meUserId
 *  - teamsCount
 *  - rosterPositions
 *  - currentPickNumber
 *  - maxTips (default 7)
 *  - minScore (default 10)
 */
export function prioritizeTips(tips = [], ctx = {}) {
  const {
    boardPlayers = [],
    picks = [],
    meUserId,
    teamsCount,
    rosterPositions = [],
    currentPickNumber = 0,
    maxTips = 7,
    minScore = 10,
  } = ctx

  const required = computeRequiredStarters(rosterPositions)
  const have = computeMyStartersFromPicks(picks, meUserId)
  const is1QBLeague = (required.QB || 0) < 1.5

  const byKey = new Map()

  for (const tip of tips || []) {
    const key = tipKey(tip)
    const player = resolvePlayerFromTip(tip, boardPlayers)
    const pos = normalizePos(player?.pos || tip?.pos || tip?.player?.pos || '')

    let score = 0
    score += typeWeightFromText(tip)
    score += positionNeedBoost(pos, required, have)
    score += valueDeltaBoost(player)
    score += soonToBeGoneBoost(player, currentPickNumber, teamsCount)

    // kleine Extras
    if (player?.injury_status && /out|ir/i.test(String(player.injury_status))) {
      score -= 8
    }

    const enriched = { ...tip, _score: score, _pos: pos, _playerId: player?.sleeper_id || player?.id || null }

    // Deduplizieren: pro key den höchsten Score behalten
    const prev = byKey.get(key)
    if (!prev || enriched._score > prev._score) {
      byKey.set(key, enriched)
    }
  }

  // sortieren + filtern
  let ranked = Array.from(byKey.values()).sort((a, b) => b._score - a._score)

  // Mindest-Score anwenden; wenn dadurch alles wegfällt, gib wenigstens Top 3 aus
  const filtered = ranked.filter(t => t._score >= minScore)
  if (filtered.length > 0) ranked = filtered

  if (ranked.length > maxTips) {
    ranked = ranked.slice(0, maxTips)
  }

  return ranked
}
