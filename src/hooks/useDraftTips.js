import { useMemo } from 'react'
import { normalizePos } from '../utils/formatting'
import { currentPickNumber, countStarters } from '../services/derive'
import { picksUntilMyNext } from '../services/derive'

// helper
function groupBy(arr, fn){ const m=new Map(); for (const x of arr||[]) { const k=fn(x); if(!m.has(k)) m.set(k, []); m.get(k).push(x) } return m }
function isTEpremium(sc) { const rec = Number(sc?.rec ?? 1); const teRec = Number(sc?.rec_te ?? rec); return Number.isFinite(teRec) && teRec > rec }
function hashId(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0 } return String(h>>>0) }

const POS = ['QB','RB','WR','TE']

export function useDraftTips({
  picks = [],
  boardPlayers = [],
  meUserId = '',
  teamsCount = null,
  rosterPositions = [],
  scoringSettings = {},
  scoringType = 'ppr',    // 'standard' | 'half_ppr' | 'ppr'
  draftType = 'snake',    // 'snake' | 'auction' | ...
  strategies = ['balanced'],
  draftSlot = null,       // optional; enables exact On-the-Clock if present
} = {}) {
  return useMemo(() => {
    const curPick = currentPickNumber(picks)
    const window = (draftType === 'snake' && teamsCount)
      ? picksUntilMyNext({ picks, meUserId, teamsCount, draftSlot })
      : null

    const tePrem = isTEpremium(scoringSettings)
    const isSF = (rosterPositions || []).some(r => String(r).toUpperCase().includes('SUPER'))
    const avail = (boardPlayers || []).filter(p => !p.status)
    const byPos = groupBy(avail, p => (normalizePos(p.pos || p.position || 'OTHER')))

    // roster needs
    const req = countStarters(rosterPositions)
    const myCounts = {QB:0,RB:0,WR:0,TE:0}
    for (const p of picks || []) {
      if (String(p?.picked_by) !== String(meUserId)) continue
      const pos = String(p?.metadata?.position || p?.position || '').toUpperCase()
      if (myCounts[pos] != null) myCounts[pos]++
    }
    const need = {
      QB: (isSF ? (req.QB + req.SUPER_FLEX) : req.QB) - myCounts.QB,
      RB: (req.RB + req.FLEX) - myCounts.RB,
      WR: (req.WR + req.FLEX) - myCounts.WR,
      TE: req.TE - myCounts.TE
    }

    // strategy knobs
    const S = new Set(strategies || [])
    const preferQBearly = S.has('qb_early_sf') && isSF
    const preferHeroRB = S.has('hero_rb')
    const preferZeroRB = S.has('zero_rb')
    const preferEliteTE = S.has('elite_te')

    function topByPos(P, n=1){
      return (byPos.get(P) || []).slice(0, n)
    }

    const tips = []

    // 0) On-the-Clock (only if we can compute a window)
    if (Number.isFinite(window)) {
      if (window <= 1) {
        tips.push({
          id: hashId(`otc-${curPick}`),
          type: 'on_the_clock',
          severity: 'critical',
          text: `You're on the clock next. Decide now.`
        })
      } else if (window <= 3) {
        tips.push({
          id: hashId(`soon-${curPick}`),
          type: 'on_the_clock',
          severity: 'warn',
          text: `You're up in ~${window} picks. Shortlist 2–3 names.`
        })
      }
    }

    // 1) Value (rk vs ADP & survival)
    const top = avail.slice(0, 30).sort((a,b)=> Number(a.rk) - Number(b.rk))
    for (const p of top) {
      const adp = Number(p.adp)
      const delta = Number.isFinite(adp) ? Math.round((adp - Number(p.rk)) * 10) / 10 : null
      const survive =
        (Number.isFinite(adp) && Number.isFinite(window) && (adp > (curPick + window))) ? 'likely' :
        (Number.isFinite(adp) && Number.isFinite(window) && (adp <= (curPick + window))) ? 'unlikely' :
        null
      if ((delta != null && delta >= 6) || survive === 'unlikely') {
        tips.push({
          id: hashId(`value-${p.id||p.nname}`),
          type: 'value',
          severity: 'info',
          text: `Value on board: ${p.name} (${p.pos}) ${delta != null ? `is ${delta} under ADP` : ''}${survive ? ` — ${survive} to reach your next pick` : ''}.`,
          player_id: p.player_id, pos: p.pos,
          _features: { delta, risk: survive === 'unlikely' ? 0.9 : 0.3 }
        })
      }
    }

    // 2) Tier drop warnings
    function tierInfo(list){
      const sorted = (list||[]).slice().sort((a,b)=> Number(a.rk) - Number(b.rk))
      const t0 = sorted.length ? String(sorted[0].tier || '') : ''
      const leftInTier = sorted.filter(x => String(x.tier||'') === t0).length
      const nextIdx = sorted.findIndex(x => String(x.tier||'') !== t0)
      const nextTierFirst = nextIdx > 0 ? sorted[nextIdx] : null
      const gap = nextTierFirst ? (Number(nextTierFirst.rk) - Number(sorted[0].rk)) : 0
      return { leftInTier, gap, top: sorted[0] || null }
    }
    for (const P of POS) {
      const { leftInTier, gap, top: cand } = tierInfo(byPos.get(P) || [])
      if (!cand) continue
      if (leftInTier <= 1 && gap >= 8) {
        tips.push({
          id: hashId(`tier-${P}-${cand.id||cand.nname}`),
          type: 'run_warning',
          severity: 'warn',
          text: `Only ${leftInTier} ${P} left in current tier. Next tier ~${gap} ranks back — consider ${cand.name}.`,
          pos: P, player_id: cand.player_id,
          _features: { leftInTier, gap }
        })
      }
    }

    // 3) Positional need (with gates based on format & strategies)
    const round = (teamsCount && curPick) ? Math.ceil(curPick / teamsCount) : null
    const qbGate = !isSF && !tePrem && (round != null && round < 7) && (need.RB > 0 || need.WR > 0) && !preferQBearly
    if (need.QB > 0 && !qbGate) {
      const qb = topByPos('QB', 1)[0]
      if (qb) tips.push({
        id: hashId(`need-qb-${qb.id||qb.nname}`),
        type: 'pos_need',
        severity: 'info',
        text: `You still need a starting QB. ${qb.name} is the best available.`,
        pos: 'QB', player_id: qb.player_id,
        _features: { need: need.QB }
      })
    }
    for (const P of ['RB','WR','TE']) {
      if (need[P] > 0) {
        const best = topByPos(P,1)[0]
        if (best) tips.push({
          id: hashId(`need-${P}-${best.id||best.nname}`),
          type: 'pos_need',
          severity: 'info',
          text: `You still need ${P} starters. Best available: ${best.name}.`,
          pos: P, player_id: best.player_id,
          _features: { need: need[P] }
        })
      }
    }

    // 4) Injury & Bye cluster (soft warnings)
    for (const p of top.slice(0, 50)) {
      const st = String(p.injury_status || '').toUpperCase()
      if (st === 'OUT' || st === 'IR' || st === 'DOUBTFUL' || st === 'QUESTIONABLE') {
        tips.push({
          id: hashId(`inj-${p.id||p.nname}-${st}`),
          type: 'injury',
          severity: 'warn',
          text: `${p.name} carries an injury tag (${st}). Discount or plan a contingency.`,
          player_id: p.player_id, pos: p.pos
        })
      }
    }

    // Strategy nudges (cheap & clear, used by prioritizer via _features)
    if (preferZeroRB) tips.push({ id: 'strategy-zero-rb', type: 'strategy', severity: 'info', text: 'Strategy active: Zero RB — lean WR/TE early; take RB discounts later.' })
    if (preferHeroRB) tips.push({ id: 'strategy-hero-rb', type: 'strategy', severity: 'info', text: 'Strategy active: Hero RB — anchor RB early, then pivot to WR/TE.' })
    if (preferEliteTE) tips.push({ id: 'strategy-elite-te', type: 'strategy', severity: 'info', text: 'Strategy active: Elite TE — take a top TE if tier is about to drop; otherwise punt.' })
    if (preferQBearly) tips.push({ id: 'strategy-qb-early-sf', type: 'strategy', severity: 'info', text: 'Strategy active: Early QB (SF) — prioritize securing two starters.' })

    return tips
  }, [JSON.stringify(picks), JSON.stringify(boardPlayers), meUserId, teamsCount, JSON.stringify(rosterPositions), JSON.stringify(scoringSettings), scoringType, draftType, JSON.stringify(strategies), draftSlot])
}
