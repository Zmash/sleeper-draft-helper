import { normalizePlayerName } from '../utils/formatting'

// Dynasty value scale: 0–10000 (FantasyCalc / KTC)

// Per-round config: value at slot 1 and exponential decay across 11 steps (to slot 12 in a 12-team league).
// Calibrated against FantasyCalc dynasty data (12-team, 1QB, PPR, mid-2025).
const ROUND_CONFIGS = {
  1: { start: 8200, decay: 0.886 },  // 1.01 ≈ 8200 → 1.12 ≈ 2250
  2: { start: 2200, decay: 0.940 },  // 2.01 ≈ 2200 → 2.12 ≈ 1100
  3: { start: 1050, decay: 0.945 },  // 3.01 ≈ 1050 → 3.12 ≈ 560
  4: { start:  520, decay: 0.950 },  // 4.01 ≈  520 → 4.12 ≈ 290
  5: { start:  250, decay: 0.955 },  // 5.01 ≈  250 → 5.12 ≈ 147
}

// Tier → normalised slot position [0, 1] representing average of that third of the field.
// early = slots 1–4,  mid = slots 5–8,  late = slots 9–12  (in a 12-team league)
const TIER_NORM = { early: 0.136, mid: 0.500, late: 0.864 }

// Future-pick year discount: each year of uncertainty reduces value.
const YEAR_DISCOUNT = [1.00, 0.82, 0.67, 0.54]

/**
 * Compute a pick's dynasty value on the 0–10000 scale.
 *
 * @param {number} round      Draft round (1-based; rounds ≥ 5 use round-5 config).
 * @param {string} tier       'early' | 'mid' | 'late' — used when slot is unknown.
 * @param {object} opts
 *   slot       (number)  1-based pick slot within the round (most accurate when known).
 *   numTeams   (number)  League size; normalises slot so any league size maps to the same curve.
 *   yearOffset (number)  0 = current draft year, 1 = next year, 2 = two years out, etc.
 */
export function pickDynastyValue(round, tier = 'mid', { slot, numTeams = 12, yearOffset = 0 } = {}) {
  const r        = Math.max(Number(round) || 1, 1)
  const teams    = Math.max(Number(numTeams) || 12, 2)
  const yOff     = Math.min(Math.max(Number(yearOffset) || 0, 0), 3)
  const cfg      = ROUND_CONFIGS[Math.min(r, 5)]
  const discount = YEAR_DISCOUNT[yOff]

  // Normalise slot to [0, 1] so the curve is league-size-independent.
  const slotNorm = (slot != null)
    ? Math.max(0, Math.min(1, (slot - 1) / (teams - 1)))
    : (TIER_NORM[tier] ?? TIER_NORM.mid)

  // Exponential decay: value at slotNorm 0 = start, at slotNorm 1 ≈ start * decay^11
  const base = Math.round(cfg.start * Math.pow(cfg.decay, slotNorm * 11))
  return Math.round(base * discount)
}

export function detectTeamProfile(dynastyRoster) {
  const starters = (dynastyRoster || []).filter(p => p.slot === 'starter')
  const ages = starters.map(p => p.age).filter(a => a > 0 && a < 50)
  if (ages.length < 3) return 'balanced'
  const avg = ages.reduce((a, b) => a + b, 0) / ages.length
  if (avg >= 27.5) return 'contender'
  if (avg <= 25.0) return 'rebuild'
  return 'balanced'
}

export function avgStarterAge(dynastyRoster) {
  const starters = (dynastyRoster || []).filter(p => p.slot === 'starter')
  const ages = starters.map(p => p.age).filter(a => a > 0 && a < 50)
  if (!ages.length) return null
  return (ages.reduce((a, b) => a + b, 0) / ages.length)
}

function ageModifier(age, profile) {
  if (!age || profile === 'balanced') return 1.0
  if (profile === 'contender') {
    if (age >= 28) return 1.12  // proven vets more useful
    if (age <= 23) return 0.88  // upside less important to contender
  }
  if (profile === 'rebuild') {
    if (age <= 23) return 1.15  // youth premium
    if (age >= 29) return 0.82  // aging vets less desirable
  }
  return 1.0
}

function pickModifier(profile) {
  if (profile === 'contender') return 0.78  // picks less valuable when window is now
  if (profile === 'rebuild')   return 1.18  // picks more valuable when building
  return 1.0
}

function applyModifier(item, profile) {
  const base = item.dynasty_value || 0
  const mod = item.type === 'pick' ? pickModifier(profile) : ageModifier(item.age, profile)
  return { ...item, adjusted_value: Math.round(base * mod), modifier: mod }
}

export function evaluateTrade(sideGive, sideGet, { dynastyRoster, profileOverride } = {}) {
  const profile =
    profileOverride && profileOverride !== 'auto'
      ? profileOverride
      : detectTeamProfile(dynastyRoster)

  const enrichedGive = sideGive.map(i => applyModifier(i, profile))
  const enrichedGet  = sideGet.map(i  => applyModifier(i, profile))

  const totalGive = enrichedGive.reduce((s, i) => s + i.adjusted_value, 0)
  const totalGet  = enrichedGet.reduce((s, i)  => s + i.adjusted_value, 0)

  let ratio = null
  let verdict = 'neutral'
  if (totalGive > 0 || totalGet > 0) {
    if (totalGet === 0)  { verdict = 'losing';    ratio = 99 }
    else if (totalGive === 0) { verdict = 'winning'; ratio = 0 }
    else {
      ratio = totalGive / totalGet
      if      (ratio > 1.25) verdict = 'losing'
      else if (ratio > 1.10) verdict = 'slight_lose'
      else if (ratio < 0.80) verdict = 'winning'
      else if (ratio < 0.91) verdict = 'slight_win'
      else                   verdict = 'fair'
    }
  }

  return {
    totalGive, totalGet, ratio, verdict, profile,
    enrichedGive, enrichedGet,
    avgAge: avgStarterAge(dynastyRoster),
  }
}

// Strip common name suffixes that differ between data sources (Sleeper vs FantasyCalc/KTC)
export function stripSuffix(nname) {
  return nname.replace(/(jr|sr|ii|iii|iv|v)$/, '')
}

// Build a tradeable player list: merge dynastyRoster with boardPlayers for dynasty_value
// extraValuesMap: optional Map<nname, dynasty_value> from a supplementary fetch
export function buildTradeablePlayers(dynastyRoster, boardPlayers, extraValuesMap = null) {
  const bySlId     = new Map()
  const byNname    = new Map()
  const byStripped = new Map() // fallback: suffix-stripped nname

  for (const bp of boardPlayers || []) {
    if (bp.sleeper_id) bySlId.set(String(bp.sleeper_id), bp)
    const key = bp.nname || normalizePlayerName(bp.name)
    if (key) {
      byNname.set(key, bp)
      const stripped = stripSuffix(key)
      if (stripped !== key) byStripped.set(stripped, bp)
    }
  }

  function lookupDynastyValue(sleeperIdStr, nname) {
    const stripped = stripSuffix(nname)
    const bp = bySlId.get(sleeperIdStr)
      || byNname.get(nname)
      || byStripped.get(stripped)
      || byNname.get(stripped)  // e.g. board has "michaelpittman", we look up "michaelpittman"
    if (bp?.dynasty_value) return bp.dynasty_value
    // Supplementary map (from FantasyCalc auto-fetch)
    if (extraValuesMap) {
      return extraValuesMap.get(nname) || extraValuesMap.get(stripped) || 0
    }
    return 0
  }

  // Roster players enriched with dynasty value
  const rosterPlayers = (dynastyRoster || []).map(rp => {
    const nname = normalizePlayerName(rp.name)
    const val   = lookupDynastyValue(String(rp.sleeper_id), nname)
    return {
      type: 'player',
      id: `player_${nname}`,
      name: rp.name,
      nname,
      pos: rp.pos,
      team: rp.team,
      age: rp.age,
      slot: rp.slot,
      dynasty_value: val,
      has_value: val > 0,
      source: 'roster',
    }
  })

  const rosterNnames = new Set(rosterPlayers.map(p => p.nname))

  // Board-only players not on the user's roster.
  // Include ALL board players (even with dynasty_value 0) so they're searchable.
  const boardOnly = (boardPlayers || [])
    .filter(bp => {
      const key = bp.nname || normalizePlayerName(bp.name)
      return key && !rosterNnames.has(key) && !rosterNnames.has(stripSuffix(key))
    })
    .map(bp => {
      const nname = bp.nname || normalizePlayerName(bp.name)
      const extraVal = extraValuesMap
        ? (extraValuesMap.get(nname) || extraValuesMap.get(stripSuffix(nname)) || 0)
        : 0
      const val = bp.dynasty_value || extraVal
      return {
        type: 'player',
        id: `player_${nname}`,
        name: bp.name,
        nname,
        pos: bp.pos,
        team: bp.team,
        age: bp.age,
        dynasty_value: val,
        has_value: val > 0,
        source: 'board',
      }
    })

  return [...rosterPlayers, ...boardOnly]
}
