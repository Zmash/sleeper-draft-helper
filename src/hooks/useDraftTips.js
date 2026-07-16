import { useMemo } from 'react'
import { normalizePos } from '../utils/formatting'
import { currentPickNumber, countStarters } from '../services/derive'
import { picksUntilMyNext } from '../services/derive'

// helper
function groupBy(arr, fn){ const m=new Map(); for (const x of arr||[]) { const k=fn(x); if(!m.has(k)) m.set(k, []); m.get(k).push(x) } return m }
function hashId(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h<<5)-h+s.charCodeAt(i); h|=0 } return String(h>>>0) }

const POS = ['QB','RB','WR','TE']

// Der pos_need-Tip feuert erst, wenn die verbleibenden eigenen Picks die
// offenen Startplaetze kaum noch decken. Vorher war er ab Pick 1 aktiv und
// damit trivial wahr ("Du brauchst noch RB-Starter" — ja, es ist Pick 1).
export const POS_NEED_SLACK = 2

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
  draftRounds = null,     // Rundenzahl fuer die pos_need-Restpick-Rechnung
  enabled = true,
} = {}) {
  return useMemo(() => {
    if (!enabled) return []
    const curPick = currentPickNumber(picks)
    const window = (draftType === 'snake' && teamsCount)
      ? picksUntilMyNext({ picks, meUserId, teamsCount, draftSlot })
      : null

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
          text: `Du bist gleich dran. Entscheidung treffen.`
        })
      } else if (window <= 3) {
        tips.push({
          id: hashId(`soon-${curPick}`),
          type: 'on_the_clock',
          severity: 'warn',
          text: `Du bist in ~${window} Picks dran. 2–3 Namen vormerken.`
        })
      }
    }

    // 1) Value (rk vs ADP & survival)
    const top = avail.slice(0, 30).sort((a,b)=> Number(a.rk) - Number(b.rk))
    for (const p of top) {
      const adp = Number(p.adp)
      const delta = Number.isFinite(adp) ? Math.round((adp - Number(p.rk)) * 10) / 10 : null
      const myNext = Number.isFinite(window) ? curPick + window : null

      // Mit Streuung koennen wir eine Spanne nennen statt eines Muenzwurf-Labels.
      const hasSpread = Number.isFinite(Number(p.high)) && Number.isFinite(Number(p.low))
      let reachText = ''
      if (hasSpread && myNext != null) {
        reachText = ` Wird typisch zwischen Pick ${p.high} und ${p.low} gezogen — dein nächster Pick ist ${myNext}.`
      } else if (Number.isFinite(adp) && myNext != null) {
        reachText = adp > myNext
          ? ` Überlebt wahrscheinlich bis zu deinem nächsten Pick (${myNext}).`
          : ` Ist bis zu deinem nächsten Pick (${myNext}) wahrscheinlich weg.`
      }

      const survivesUnlikely = Number.isFinite(adp) && myNext != null && adp <= myNext
      if ((delta != null && delta >= 6) || survivesUnlikely) {
        tips.push({
          id: hashId(`value-${p.id || p.nname}`),
          type: 'value',
          severity: 'info',
          text: `Value auf dem Board: ${p.name} (${p.pos})${delta != null ? ` liegt ${delta} unter ADP.` : '.'}${reachText}`,
          player_id: p.player_id, pos: p.pos,
          _features: { delta, risk: survivesUnlikely ? 0.9 : 0.3 },
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
          text: `Letzter ${P} im Tier. Nächste Gruppe ~${gap} Plätze zurück — ${cand.name} nicht liegenlassen.`,
          pos: P, player_id: cand.player_id,
          _features: { leftInTier, gap }
        })
      }
    }

    // 3) Positional need (with gates based on format & strategies)
    // Wie viele eigene Picks bleiben, und wie viele Startplaetze sind offen?
    const rounds = Number(draftRounds) || 16
    const myPickCount = (picks || []).filter(p => String(p?.picked_by) === String(meUserId)).length
    const remainingOwnPicks = Math.max(0, rounds - myPickCount)
    const openStarterSlots = Math.max(0, (need.QB > 0 ? need.QB : 0) + (need.RB > 0 ? need.RB : 0) +
                                        (need.WR > 0 ? need.WR : 0) + (need.TE > 0 ? need.TE : 0))
    const needIsReal = (remainingOwnPicks - openStarterSlots) <= POS_NEED_SLACK

    if (needIsReal) {
      for (const P of ['QB', 'RB', 'WR', 'TE']) {
        if (need[P] <= 0) continue
        const best = topByPos(P, 1)[0]
        if (!best) continue
        tips.push({
          id: hashId(`need-${P}-${best.id || best.nname}`),
          type: 'pos_need',
          severity: 'info',
          text: P === 'QB'
            ? `Dir fehlt noch ein Start-QB. ${best.name} ist der beste Verfügbare.`
            : `Dir fehlen noch ${P}-Starter. Bester Verfügbarer: ${best.name}.`,
          pos: P, player_id: best.player_id,
          _features: { need: need[P] },
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
          text: `${p.name} hat einen Verletzungsstatus (${st}). Abwerten oder Plan B vorbereiten.`,
          player_id: p.player_id, pos: p.pos
        })
      }
    }

    // Im Kommentar seit jeher als "Injury & Bye cluster" angekuendigt, nie gebaut.
    const myPlayers = (boardPlayers || []).filter(p => p.status === 'me')
    const byeByPos = new Map()
    for (const p of myPlayers) {
      const pos = normalizePos(p.pos || p.position || '')
      const bye = Number(p.bye)
      if (!POS.includes(pos) || !Number.isFinite(bye)) continue
      const key = `${pos}:${bye}`
      byeByPos.set(key, (byeByPos.get(key) || 0) + 1)
    }
    for (const [key, count] of byeByPos) {
      if (count < 2) continue
      const [pos, bye] = key.split(':')
      tips.push({
        id: hashId(`bye-${key}`),
        type: 'bye_cluster',
        severity: 'warn',
        text: `${count} deiner ${pos} haben Bye in Woche ${bye}. In dieser Woche wird es dünn — bei weiteren ${pos} auf eine andere Bye achten.`,
        pos,
        _features: { count, bye: Number(bye) },
      })
    }

    // Strategy nudges (cheap & clear, used by prioritizer via _features)
    if (preferZeroRB) tips.push({ id: 'strategy-zero-rb', type: 'strategy', severity: 'info', text: 'Strategie aktiv: Zero RB — früh WR/TE, RB-Schnäppchen später.' })
    if (preferHeroRB) tips.push({ id: 'strategy-hero-rb', type: 'strategy', severity: 'info', text: 'Strategie aktiv: Hero RB — ein RB früh als Anker, danach WR/TE.' })
    if (preferEliteTE) tips.push({ id: 'strategy-elite-te', type: 'strategy', severity: 'info', text: 'Strategie aktiv: Elite TE — Top-TE nehmen, wenn das Tier kippt; sonst punten.' })
    if (preferQBearly) tips.push({ id: 'strategy-qb-early-sf', type: 'strategy', severity: 'info', text: 'Strategie aktiv: Früher QB (SF) — zwei Starter sichern hat Vorrang.' })

    return tips
  }, [enabled, JSON.stringify(picks), JSON.stringify(boardPlayers), meUserId, teamsCount, JSON.stringify(rosterPositions), JSON.stringify(scoringSettings), scoringType, draftType, JSON.stringify(strategies), draftSlot, draftRounds])
}
