// src/hooks/useDraftTips.js
import { useEffect, useMemo } from 'react'
import { normalizePlayerName } from '../utils/formatting'
import { getTeamsCount as deriveTeamsCount } from '../services/derive'

function hashId(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return String(h >>> 0)
}

const normPos = (p='') => String(p||'').toUpperCase().replace(/\d+/g,'').replace('D/ST','DEF').replace('DST','DEF')

export function useDraftTips({ picks = [], boardPlayers = [], meUserId = null, teamsCount = null, playerPrefs = {}, rosterPositions = null } = {}) {
  const tips = useMemo(() => {
    const t = []
    const teams = Number(teamsCount) || deriveTeamsCount({ picks })

    // Helper: map of teamId -> positions picked (starters heuristic not applied here)
    const byOwner = new Map()
    for (const p of picks) {
      const owner = p?.owner_id || p?.picked_by || p?.metadata?.owner_id || 'unknown'
      const arr = byOwner.get(owner) || []
      const pos = normPos(p?.metadata?.position || p?.position || '')
      if (pos) arr.push(pos)
      byOwner.set(owner, arr)
    }

    // Determine my next pick number (simple snake draft heuristic)
    const myPicks = picks.filter(p => (p?.owner_id || p?.picked_by) === meUserId).map(p => Number(p.pick_no)).filter(Number.isFinite).sort((a,b)=>a-b)
    const currentPick = Math.max(0, ...picks.map(p => Number(p.pick_no)).filter(Number.isFinite))
    const nextMyPick = myPicks.find(n => n > currentPick) || null

    // A) Positional Pressure
    const positions = ['QB','RB','WR','TE','DEF','K']
    for (const P of positions) {
      let needers = 0
      const startersHeuristic = { QB:1, RB:2, WR:2, TE:1, DEF:1, K:1 }
      for (const [owner, posArr] of byOwner.entries()) {
        // Only count teams between now and my next pick (coarse heuristic)
        // If nextMyPick null -> count all others
        if (nextMyPick) {
          // assume owners pick one time each between now and nextMyPick => not perfect but ok
        }
        const haveP = posArr.filter(x => x === P).length
        if (haveP < (startersHeuristic[P] || 1)) needers++
      }
      const sev = needers === 0 ? 'info' : (needers >= Math.ceil(teams/2) ? 'critical' : 'warn')
      const text = needers === 0
        ? `Zwischen jetzt und deinem nächsten Pick scheint auf ${P} wenig Druck zu sein.`
        : `Bis zu deinem nächsten Pick benötigen ca. ${needers} Teams noch einen ${P}.`
      t.push({ id: hashId(`pressure:${P}:${needers}`), severity: sev, text, ts: Date.now() })
    }

    // B) Value vs. ADP (+/-)
    const avail = boardPlayers.filter(bp => !bp.picked)
    for (const bp of avail.slice(0, 300)) {
      const adp = Number(bp.adp || bp.adp_ppr)
      const ecrVsAdp = Number(bp.ecrVsAdp)
      if (Number.isFinite(adp) && Number.isFinite(currentPick)) {
        const delta = Math.round(adp - currentPick)
        if (delta > 10) {
          t.push({ id: hashId(`value:pos:${bp.name}:${delta}`), severity: 'success', text: `${bp.pos || ''} ${bp.name} ist ~+${delta} vs. ADP verfügbar.`, ts: Date.now() })
        }
      } else if (Number.isFinite(ecrVsAdp) && ecrVsAdp < 0) {
        t.push({ id: hashId(`value:ecr:${bp.name}:${ecrVsAdp}`), severity: 'success', text: `${bp.pos || ''} ${bp.name} liegt ~${Math.abs(ecrVsAdp)} Plätze über ADP.`, ts: Date.now() })
      }
    }

    // C) Roster Balance (for me)
    if (meUserId) {
      const myPos = byOwner.get(meUserId) || []
      const starters = rosterPositions && Array.isArray(rosterPositions) ? rosterPositions : ['QB','RB','RB','WR','WR','TE','FLEX','K','DEF']
      const reqCounts = starters.reduce((acc, slot) => {
        const pp = normPos(slot)
        if (['RB','WR','TE'].includes(pp) && pp === 'FLEX') return acc
        acc[pp] = (acc[pp] || 0) + 1
        return acc
      }, {})
      for (const [slot, req] of Object.entries(reqCounts)) {
        const have = myPos.filter(x => x === slot).length
        if (have < req) {
          t.push({ id: hashId(`need:${slot}:${have}->${req}`), severity: 'warn', text: `Dir fehlt noch mindestens ein Starter auf ${slot}.`, ts: Date.now() })
        }
      }
    }

    // D) Diversity
    const myTeamCounts = {}
    for (const p of picks.filter(p => (p?.owner_id || p?.picked_by) === meUserId)) {
      const tm = (p?.metadata?.team || p?.team || '').toUpperCase()
      if (!tm) continue
      myTeamCounts[tm] = (myTeamCounts[tm] || 0) + 1
    }
    for (const [tm, count] of Object.entries(myTeamCounts)) {
      if (count >= 3) {
        t.push({ id: hashId(`diversity:${tm}:${count}`), severity: 'warn', text: `Bereits ${count} Spieler von ${tm} – erhöhte Korrelation/Bye-Risiko.`, ts: Date.now() })
      }
    }

    // E) Bye overlap (light)
    const myByes = {}
    for (const p of picks.filter(p => (p?.owner_id || p?.picked_by) === meUserId)) {
      const bye = String(p?.metadata?.bye || p?.bye || '').trim()
      if (!bye) continue
      myByes[bye] = (myByes[bye] || 0) + 1
    }
    for (const [bye, cnt] of Object.entries(myByes)) {
      if (cnt >= 2) t.push({ id: hashId(`bye:${bye}:${cnt}`), severity: 'warn', text: `Mehrere Starter mit Bye-Week ${bye}.`, ts: Date.now() })
    }

    // Deduplicate by id
    const map = new Map()
    for (const tip of t) {
      if (!map.has(tip.id)) map.set(tip.id, tip)
    }
    return Array.from(map.values())
  }, [JSON.stringify(picks), JSON.stringify(boardPlayers), meUserId, teamsCount, JSON.stringify(rosterPositions)])

  return tips
}