// Gerechnete Draft-Statistiken. Reine Funktionen, kein React, kein Netz.
//
// Grundgroesse ueberall: delta = ecr - pick_no.
// Positiv heisst: der Spieler ging spaeter als sein Rang, also unter Wert geholt.
import { normalizePlayerName, normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { teamKeyFromPick } from '../derive'

/** Board -> Map normalisierter Name -> { ecr, name }. Nur mit numerischem ecr. */
function ecrByName(boardPlayers = []) {
  const m = new Map()
  for (const bp of boardPlayers || []) {
    if (!bp?.nname) continue
    const ecr = toFiniteOrNull(bp?.ecr)
    if (ecr === null) continue
    m.set(bp.nname, { ecr, name: bp.name || bp.nname })
  }
  return m
}

/** Normalisierter Name eines Picks, passend zum nname der Board-Spieler. */
export function pickName(pick) {
  const full = `${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`.trim()
  return full ? normalizePlayerName(full) : ''
}

export function teamDraftRanking({
  picks = [], boardPlayers = [], teamsCount = 0, ownerLabels = null, myTeamKey = null,
}) {
  const byName = ecrByName(boardPlayers)
  const teams = new Map()
  const scored = []
  let matched = 0
  let unmatched = 0

  for (const p of picks || []) {
    const key = teamKeyFromPick(p, teamsCount)
    if (!teams.has(key)) {
      teams.set(key, {
        key,
        label: ownerLabels?.get?.(key) || key,
        delta: 0, picks: 0, best: null, worst: null,
      })
    }
    const t = teams.get(key)
    t.picks += 1

    const hit = byName.get(pickName(p))
    const pickNo = toFiniteOrNull(p?.pick_no)
    // Kein Treffer heisst "unbekannt", nicht "Wert 0" -- sonst wuerde ein Team
    // belohnt, dessen Picks schlicht nicht im Ranking stehen.
    if (!hit || pickNo === null) { unmatched += 1; continue }

    matched += 1
    const delta = hit.ecr - pickNo
    t.delta += delta
    const entry = { name: hit.name, pick_no: pickNo, delta, teamLabel: t.label }
    scored.push(entry)
    if (!t.best || delta > t.best.delta) t.best = entry
    if (!t.worst || delta < t.worst.delta) t.worst = entry
  }

  const list = [...teams.values()].sort((a, b) => b.delta - a.delta)
  const myIndex = myTeamKey ? list.findIndex((t) => t.key === myTeamKey) : -1

  return {
    teams: list,
    steals: scored.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
    reaches: scored.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    matched,
    unmatched,
    myRank: myIndex >= 0 ? myIndex + 1 : null,
    myDelta: myIndex >= 0 ? list[myIndex].delta : null,
  }
}

const SCARCITY_POS = ['QB', 'RB', 'WR', 'TE']

// Welche Flex-Slots welche Positionen aufnehmen. Der Anteil ist 1 geteilt durch
// die Zahl der aufnehmbaren Positionen -- ein FLEX ist zu einem Drittel ein
// RB-Slot, weil sich RB, WR und TE darum bewerben.
const FLEX_SLOTS = {
  FLEX: ['RB', 'WR', 'TE'],
  WRT: ['RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
}

/**
 * Starter-Slots einer Position, Flex anteilig.
 * @returns {number} kann gebrochen sein -- erst nach x teamsCount runden.
 */
export function starterSlots(pos, rosterPositions = []) {
  const want = String(pos || '').toUpperCase()
  let n = 0
  for (const raw of rosterPositions || []) {
    const slot = String(raw || '').toUpperCase()
    if (slot === want) { n += 1; continue }
    const takers = FLEX_SLOTS[slot]
    if (takers && takers.includes(want)) n += 1 / takers.length
  }
  return n
}

export function positionalScarcity({
  boardPlayers = [], picks = [], rosterPositions = [], teamsCount = 12,
}) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))
  const teams = Number(teamsCount) || 0
  const out = []

  for (const pos of SCARCITY_POS) {
    const need = Math.round(teams * starterSlots(pos, rosterPositions))
    if (need <= 0) continue

    // toFiniteOrNull statt Number(): Number(null) waere 0 und damit ein
    // gueltiger Rang 0 -- der beste Spieler ueberhaupt.
    const pool = (boardPlayers || [])
      .filter((bp) => {
        if (toFiniteOrNull(bp?.ecr) === null) return false
        if (normalizePos(bp?.pos) !== pos) return false
        if (!bp?.nname) return false
        if (taken.has(bp.nname)) return false
        return true
      })
      .sort((a, b) => toFiniteOrNull(a.ecr) - toFiniteOrNull(b.ecr))

    const exhausted = pool.length < need
    const best = pool[0] || null
    const replacement = exhausted ? null : pool[need - 1]

    out.push({
      pos,
      need,
      available: pool.length,
      startable: Math.min(pool.length, need),
      exhausted,
      bestName: best?.name || null,
      bestEcr: best ? toFiniteOrNull(best.ecr) : null,
      replacementEcr: replacement ? toFiniteOrNull(replacement.ecr) : null,
      vor: (best && replacement)
        ? toFiniteOrNull(replacement.ecr) - toFiniteOrNull(best.ecr)
        : null,
    })
  }
  return out
}

/**
 * Tier-Verbrauch je Position. Das oberste Tier mit Restbestand ist das aktive
 * -- seine Restzahl ist die Cliff-Warnung.
 */
export function tierUsage({ boardPlayers = [], picks = [] }) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))
  const byPos = new Map()

  for (const bp of boardPlayers || []) {
    const tier = toFiniteOrNull(bp?.tier)
    const pos = normalizePos(bp?.pos)
    if (tier === null || tier <= 0 || !pos) continue

    if (!byPos.has(pos)) byPos.set(pos, new Map())
    const tiers = byPos.get(pos)
    if (!tiers.has(tier)) tiers.set(tier, { tier, total: 0, remaining: 0 })

    const entry = tiers.get(tier)
    entry.total += 1
    if (!bp.nname || !taken.has(bp.nname)) entry.remaining += 1
  }

  return [...byPos.entries()].map(([pos, tiers]) => {
    const list = [...tiers.values()].sort((a, b) => a.tier - b.tier)
    const active = list.find((t) => t.remaining > 0) || null
    return {
      pos,
      tiers: list,
      activeTier: active?.tier ?? null,
      remainingInActive: active?.remaining ?? 0,
    }
  })
}

const RUN_MIN_PICKS = 3      // absolute Untergrenze gegen Zufallstreffer
const RUN_SHARE_FACTOR = 2   // Fensteranteil muss den Gesamtanteil verdoppeln

/**
 * Positional Runs im rollierenden Fenster der letzten Picks.
 *
 * Beide Bedingungen muessen gelten: absolut mindestens RUN_MIN_PICKS und
 * anteilig mindestens das RUN_SHARE_FACTOR-fache des Gesamtanteils. Nur die
 * Quote wuerde am Draft-Anfang bei jeder seltenen Position anschlagen, nur die
 * absolute Zahl bei jeder haeufigen.
 *
 * Ist der Draft nicht laenger als das Fenster, sind Fenster- und Gesamtanteil
 * identisch -- dann ist keine Aussage moeglich und runs bleibt leer.
 */
export function positionalRuns({ picks = [], teamsCount = 12 }) {
  const sorted = (picks || [])
    .filter((p) => toFiniteOrNull(p?.pick_no) !== null)
    .sort((a, b) => toFiniteOrNull(a.pick_no) - toFiniteOrNull(b.pick_no))

  const timeline = sorted.map((p) => ({
    pick_no: toFiniteOrNull(p.pick_no),
    pos: normalizePos(p?.metadata?.position) || null,
  }))

  const window = Math.min(Number(teamsCount) || 12, 8)
  if (timeline.length <= window) return { window, runs: [], timeline }

  const count = (list) => {
    const m = {}
    for (const t of list) if (t.pos) m[t.pos] = (m[t.pos] || 0) + 1
    return m
  }
  const overall = count(timeline)
  const inWindow = count(timeline.slice(-window))

  const runs = []
  for (const [pos, c] of Object.entries(inWindow)) {
    const windowShare = c / window
    const overallShare = (overall[pos] || 0) / timeline.length
    if (c >= RUN_MIN_PICKS && overallShare > 0 && windowShare >= RUN_SHARE_FACTOR * overallShare) {
      runs.push({ pos, count: c, windowShare, overallShare })
    }
  }
  runs.sort((a, b) => b.count - a.count)

  return { window, runs, timeline }
}
