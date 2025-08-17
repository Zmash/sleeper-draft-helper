const TYPE_WEIGHTS = {
  on_the_clock: 30,
  value: 18,
  pos_need: 20,
  run_warning: 15,
  stack: 8,
  injury: -4,
  bye_risk: -2,
  strategy: -99, // informational; keep out of top 3
}

const SEV = { info:0, warn:4, critical:8 }
const COOLDOWN_KEY = 'sdh.tip.cooldown.v2'
const COOLDOWN_MS = 10 * 60 * 1000

function loadCooldown(){ try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}') } catch { return {} } }
function saveCooldown(m){ try { localStorage.setItem(COOLDOWN_KEY, JSON.stringify(m||{})) } catch {} }
function coolPenalty(key){ const ts=(loadCooldown()[key]||0); return (Date.now()-ts)<COOLDOWN_MS ? 10 : 0 }
function markShown(key){ const m=loadCooldown(); m[key]=Date.now(); saveCooldown(m) }

export function prioritizeTips(raw = [], {
  round = null,
  isSuperflex = false,
  needQB = 0,
  needRB = 0,
  needWR = 0,
  needTE = 0,
  strategies = ['balanced'],
  maxTips = 4,
} = {}) {
  const S = new Set(strategies || [])
  const boostRBearly = S.has('hero_rb') && (round == null || round <= 3)
  const downRBearly  = S.has('zero_rb') && (round == null || round <= 5)
  const boostTEelite = S.has('elite_te') && (round == null || round <= 4)
  const boostQBsf    = S.has('qb_early_sf') && isSuperflex

  const scored = (raw||[]).map(t => {
    const base = SEV[t.severity] ?? 0
    const typeW = TYPE_WEIGHTS[t.type] ?? 0

    // 1-QB QB-need gate before R7 (unless strategy says otherwise)
    let gate = 0
    if (t.type === 'pos_need' && String(t.pos).toUpperCase() === 'QB' && !isSuperflex && !S.has('qb_early_sf')) {
      if ((round != null && round < 7) && (needRB > 0 || needWR > 0)) gate = -999
    }

    // Feature flags from generator
    const f = t._features || {}
    const needGap = Number(f.need || 0)
    const tierPressure = Number(f.leftInTier || 0) <= 1 ? 1 : 0
    const valueEdge = Number(f.delta || 0) >= 6 ? 1 : 0
    const goneRisk = Number(f.risk || 0) >= 0.5 ? 1 : 0

    // Strategy nudges
    let strat = 0
    if (t.type === 'pos_need') {
      const P = String(t.pos || '').toUpperCase()
      if (P === 'RB') {
        if (boostRBearly) strat += 6
        if (downRBearly)  strat -= 10
      }
      if (P === 'TE' && boostTEelite) strat += 6
      if (P === 'QB' && boostQBsf) strat += 10
    }
    if (t.type === 'run_warning') {
      const P = String(t.pos || '').toUpperCase()
      if (P === 'RB' && downRBearly) strat -= 6 // don't panic into RB in Zero RB unless tier truly collapses
      if (P === 'TE' && boostTEelite) strat += 4
    }

    const cooldown = coolPenalty(t.id || `${t.type}:${t.text}`)
    const score = base + typeW + 6*needGap + 5*tierPressure + 4*valueEdge + 4*goneRisk + strat - cooldown + gate

    return { ...t, _score: score }
  })

  // sort + filter
  const ranked = scored.filter(t => t._score > -500).sort((a,b) => b._score - a._score)

  // de-dup by type; show top 3–4
  const seenType = new Map()
  const out = []
  for (const t of ranked) {
    const c = seenType.get(t.type) || 0
    if (t.type !== 'pos_need' && c >= 2) continue
    if (t.type === 'strategy') continue
    out.push(t)
    seenType.set(t.type, c + 1)
    if (out.length >= maxTips) break
  }

  for (const t of out) markShown(t.id || `${t.type}:${t.text}`)
  return out
}
