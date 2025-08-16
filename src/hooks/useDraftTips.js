// src/hooks/useDraftTips.js
import { useMemo } from 'react'
import { normalizePos } from '../utils/formatting'
import { getTeamsCount as deriveTeamsCount } from '../services/derive'

/**
 * Shape expected by <TipsDock />:
 * { id: string, severity: 'info'|'warn'|'critical'|'success', text: string, type?: string, pos?: string, player_id?: string }
 * All tips are in ENGLISH.
 */

function hashId(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 }
  return String(h >>> 0)
}

const POS_ALL = ['QB','RB','WR','TE','DEF','K']

function computeRequired(rosterPositions = []) {
  // Treat DEF/DST the same and approximate FLEX
  const req = { QB:0, RB:0, WR:0, TE:0, DEF:0, K:0 }
  let wrRbTeFlex = 0
  let superflex  = 0

  for (const raw of rosterPositions || []) {
    const s = String(raw || '').toUpperCase().trim()
    const n = normalizePos(s)
    if (req[n] != null) { req[n] += 1; continue }
    if (/^(FLEX|WRT)$/.test(s) || /RB.?WR.?TE/.test(s) || /WR.?RB.?TE/.test(s)) { wrRbTeFlex++; continue }
    if (/SUPER.?FLEX|SFLEX/.test(s) || /QB.?RB.?WR.?TE/.test(s)) { superflex++; continue }
  }

  for (let i = 0; i < wrRbTeFlex; i++) { req.RB += 0.5; req.WR += 0.5; req.TE += 0.25 }
  if (superflex) req.QB += superflex

  // Reasonable defaults if league not loaded
  if (!rosterPositions || rosterPositions.length === 0) {
    req.QB = Math.max(req.QB, 1)
    req.RB = Math.max(req.RB, 2)
    req.WR = Math.max(req.WR, 2)
    req.TE = Math.max(req.TE, 1)
  }
  return req
}

function countMyPositions(picks = [], meUserId) {
  const have = { QB:0, RB:0, WR:0, TE:0, DEF:0, K:0 }
  for (const p of picks || []) {
    if (p.picked_by !== meUserId) continue
    const pos = normalizePos(p?.metadata?.position || p?.position || '')
    if (have[pos] != null) have[pos] += 1
  }
  return have
}

function currentPickNumber(picks = []) {
  const nums = (picks || []).map(p => Number(p?.pick_no)).filter(Number.isFinite)
  return nums.length ? Math.max(...nums) : 0
}

function nextMyPickNumber(picks = [], meUserId) {
  const myNums = (picks || []).filter(p => p.picked_by === meUserId).map(p => Number(p?.pick_no)).filter(Number.isFinite).sort((a,b)=>a-b)
  const cur = currentPickNumber(picks)
  return myNums.find(n => n > cur) || null
}

function lastNPicks(picks = [], n = 6) {
  const arr = (picks || []).slice().sort((a,b)=> (a.pick_no||0)-(b.pick_no||0))
  return arr.slice(Math.max(0, arr.length - n))
}

function availablePlayers(boardPlayers = []) {
  return (boardPlayers || []).filter(p => !p.status) // not picked
}

function groupBy(arr, fn) {
  const map = new Map()
  for (const x of arr) {
    const k = fn(x)
    map.set(k, (map.get(k) || []).concat([x]))
  }
  return map
}

function topNByPos(avail, nPerPos = 8) {
  const byPos = groupBy(avail, p => normalizePos(p.pos || 'OTHER'))
  const out = {}
  for (const P of POS_ALL) {
    const list = (byPos.get(P) || []).slice().sort((a,b) => Number(a.rk) - Number(b.rk))
    out[P] = list.slice(0, nPerPos)
  }
  return out
}

function tierCliffTips(avail, windowPicks, nPerPos = 20) {
  // If only few players remain in the current tier at a position and the next tier starts with a big rk jump,
  // warn that a cliff is imminent before your next pick.
  const tips = []
  const byPos = groupBy(avail, p => normalizePos(p.pos || 'OTHER'))
  for (const P of POS_ALL) {
    const list = (byPos.get(P) || []).slice().sort((a,b)=> Number(a.rk) - Number(b.rk))
    if (!list.length) continue
    // consider first nPerPos players
    const subset = list.slice(0, nPerPos)
    // count players belonging to the top tier in subset
    const tier0 = subset.length ? String(subset[0].tier || '') : ''
    const leftInTier = subset.filter(p => String(p.tier||'') === tier0).length
    // Find next tier's first player rk
    const nextTierIdx = subset.findIndex(p => String(p.tier||'') !== tier0)
    if (nextTierIdx > 0) {
      const nextTierFirst = subset[nextTierIdx]
      const gap = Number(nextTierFirst.rk) - Number(subset[Math.max(0,leftInTier-1)].rk)
      if (leftInTier <= Math.max(2, Math.ceil(windowPicks/3)) && gap >= 10) {
        tips.push({
          id: hashId(`tiercliff:${P}:${leftInTier}:${gap}:${windowPicks}`),
          severity: 'warn',
          type: 'tier_cliff',
          pos: P,
          text: `Tier drop incoming at ${P}: only ${leftInTier} left in current tier and a big gap (~${gap} picks) afterwards.`
        })
      }
    }
  }
  return tips
}

function runDetectionTips(picks = [], window = 6) {
  const tips = []
  const recent = lastNPicks(picks, window)
  const counts = {}
  for (const p of recent) {
    const P = normalizePos(p?.metadata?.position || p?.position || '')
    counts[P] = (counts[P] || 0) + 1
  }
  const P = Object.keys(counts).sort((a,b)=> counts[b]-counts[a])[0]
  if (P && counts[P] >= Math.ceil(window*0.66)) {
    tips.push({
      id: hashId(`run:${P}:${counts[P]}`),
      severity: 'warn',
      type: 'run_warning',
      pos: P,
      text: `Position run detected on ${P}: ${counts[P]} of the last ${recent.length} picks. Adjust if you still need ${P}.`
    })
  }
  return tips
}

function needTips(required, have, nextWindow) {
  const tips = []
  for (const P of POS_ALL) {
    const gap = Math.max(0, (required[P] || 0) - (have[P] || 0))
    if (gap >= 2) {
      tips.push({ id: hashId(`need:${P}:2`), severity: 'critical', type: 'pos_need', pos: P, text: `You still need multiple ${P} starters. Prioritize ${P} in the next ${nextWindow || 'few'} picks.` })
    } else if (gap === 1) {
      tips.push({ id: hashId(`need:${P}:1`), severity: 'info', type: 'pos_need', pos: P, text: `You still need a starter at ${P}.` })
    }
  }
  return tips
}

function valueTips(avail, topN = 20) {
  const tips = []
  const best = avail.slice().sort((a,b)=> Number(a.rk) - Number(b.rk)).slice(0, topN)
  // candidates where ADP significantly higher than our ECR (adp - rk >= threshold)
  const cand = best.filter(p => Number.isFinite(Number(p.adp)) && Number.isFinite(Number(p.rk)))
  const scored = cand.map(p => ({ p, delta: Number(p.adp) - Number(p.rk) }))
                     .filter(x => x.delta >= 6)
                     .sort((a,b)=> b.delta - a.delta)
                     .slice(0, 3)
  if (scored.length) {
    const names = scored.map(x => x.p.name).slice(0, 2).join(', ')
    tips.push({
      id: hashId(`value:${names}`),
      severity: 'success',
      type: 'value',
      text: `Value on the board: ${names}${scored.length>2?', …':''} appear to be falling vs ADP.`
    })
  }
  return tips
}

function byeConflictTips(myPicks, corePositions = ['QB','RB','WR','TE']) {
  const tips = []
  const core = myPicks.filter(p => corePositions.includes(normalizePos(p?.metadata?.position || p?.position || '')))
  const byBye = groupBy(core, p => String(p?.metadata?.bye_week || p?.bye || ''))
  for (const [bye, arr] of byBye.entries()) {
    if (!bye || bye === 'null' || bye === 'undefined') continue
    if (arr.length >= 3) {
      tips.push({
        id: hashId(`bye:${bye}:${arr.length}`),
        severity: 'warn',
        type: 'bye_risk',
        text: `You have ${arr.length} core starters with the same bye week (${bye}).`
      })
    }
  }
  return tips
}

function stackTips(avail, myPicks) {
  const tips = []
  const myTeams = new Set(myPicks.map(p => (p?.metadata?.team || p?.team || '').toUpperCase()).filter(Boolean))
  if (!myTeams.size) return tips
  const interesting = avail.filter(p => p.pos === 'WR' || p.pos === 'TE').slice(0, 30)
  const stacks = interesting.filter(p => myTeams.has(String(p.team||'').toUpperCase()))
  if (stacks.length) {
    const names = stacks.slice(0,2).map(p => p.name).join(', ')
    tips.push({
      id: hashId(`stack:${names}`),
      severity: 'info',
      type: 'stack',
      text: `Stack opportunity available: ${names} match one of your QB/skill players' teams.`
    })
  }
  return tips
}

function earlyDefKTips(avail, curPickNo, have, required) {
  const tips = []
  const tooEarly = curPickNo < 100 // conservative threshold
  const needCore = ['RB','WR','TE','QB'].some(P => ((required[P]||0) - (have[P]||0)) > 0)
  const hasDefK = avail.some(p => p.pos === 'DEF' || p.pos === 'K')
  if (tooEarly && needCore && hasDefK) {
    tips.push({
      id: hashId(`early:defk:${curPickNo}`),
      severity: 'info',
      type: 'strategy',
      text: `It's still early — avoid DEF/K until later while starters at RB/WR/TE/QB remain.` 
    })
  }
  return tips
}

export function useDraftTips({
  picks = [],
  boardPlayers = [],
  meUserId = '',
  teamsCount: teamsCountInput = null,
  rosterPositions = [],
} = {}) {

  return useMemo(() => {
    const teamsCount = teamsCountInput || deriveTeamsCount({ picks })
    const curPickNo = currentPickNumber(picks)
    const nextMine = nextMyPickNumber(picks, meUserId)
    const window = nextMine ? Math.max(0, nextMine - curPickNo - 1) : (teamsCount || 12)

    const required = computeRequired(rosterPositions)
    const have = countMyPositions(picks, meUserId)

    const avail = availablePlayers(boardPlayers).map(p => ({ ...p, pos: normalizePos(p.pos || '') }))
    const tips = []

    tips.push(...needTips(required, have, window))
    tips.push(...tierCliffTips(avail, window, 24))
    tips.push(...runDetectionTips(picks, 6))
    tips.push(...valueTips(avail, 24))
    tips.push(...byeConflictTips(picks))
    tips.push(...stackTips(avail, picks.filter(p => p.picked_by === meUserId)))
    tips.push(...earlyDefKTips(avail, curPickNo, have, required))

    // Deduplicate by id and keep order
    const map = new Map()
    for (const t of tips) {
      if (!map.has(t.id)) map.set(t.id, t)
    }
    return Array.from(map.values())
  }, [JSON.stringify(picks), JSON.stringify(boardPlayers), meUserId, teamsCountInput, JSON.stringify(rosterPositions)])
}
