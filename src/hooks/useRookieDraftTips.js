import { useMemo } from 'react'
import { normalizePos } from '../utils/formatting'
import { currentPickNumber, picksUntilMyNext } from '../services/derive'

// Altersgrenze ab der ein Spieler als "auf dem absteigenden Ast" gilt (Dynasty-Perspektive)
const AGING_THRESHOLD = { QB: 32, RB: 27, WR: 28, TE: 30 }

// Mindesttiefe die ein gesundes Dynasty-Roster pro Position haben sollte
const DEPTH_TARGET = { QB: 2, RB: 5, WR: 5, TE: 2 }

function hashId(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0 } return String(h >>> 0) }
function countByPos(arr) {
  const m = {}
  for (const p of arr || []) {
    const k = normalizePos(p?.pos || p?.metadata?.position || '')
    if (k) m[k] = (m[k] || 0) + 1
  }
  return m
}
function groupByPos(arr) {
  const m = new Map()
  for (const p of arr || []) {
    const k = normalizePos(p?.pos || '')
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(p)
  }
  return m
}

export function useRookieDraftTips({
  picks = [],           // Picks die in diesem Rookie-Draft bereits gemacht wurden
  boardPlayers = [],    // Rookie-Board (verfügbare Spieler)
  meUserId = '',
  dynastyRoster = [],   // Bestehender Dynasty-Kader [{name, pos, age, slot}]
  teamsCount = null,
  draftSlot = null,
  myDraftPicks = [],    // Meine Picks in diesem Draft [{round, type, pick_pos}]
  enabled = true,
} = {}) {
  return useMemo(() => {
    if (!enabled) return []

    const tips = []
    const curPick = currentPickNumber(picks)
    const window = teamsCount
      ? picksUntilMyNext({ picks, meUserId, teamsCount, draftSlot })
      : null

    const avail = (boardPlayers || []).filter(p => !p.status)
    const byPos = groupByPos(avail)

    // ── 1) On-the-clock ──────────────────────────────────────────────────────
    if (Number.isFinite(window)) {
      if (window <= 1) {
        tips.push({ id: hashId(`otc-${curPick}`), type: 'on_the_clock', severity: 'critical', text: `Du bist gleich dran. Entscheidung treffen.` })
      } else if (window <= 3) {
        tips.push({ id: hashId(`soon-${curPick}`), type: 'on_the_clock', severity: 'warn', text: `Du bist in ~${window} Picks dran. 2–3 Namen vormerken.` })
      }
    }

    // ── 2) Dynasty-Bedarf ─────────────────────────────────────────────────────
    // Bestehender Kader + bereits in diesem Draft gepickte Spieler
    const existingByPos  = countByPos(dynastyRoster)
    const myPicksSoFar   = (picks || []).filter(p => String(p?.picked_by) === String(meUserId))
    const draftedByPos   = countByPos(myPicksSoFar)

    // Alternde Starters im bestehenden Kader (Sleeper-Enrichment liefert age)
    const agingByPos = countByPos(
      (dynastyRoster || []).filter(p => {
        const pos   = normalizePos(p.pos || '')
        const thresh = AGING_THRESHOLD[pos]
        return thresh && Number.isFinite(Number(p.age)) && Number(p.age) >= thresh
      })
    )

    // Junge Spieler (unter Altersschwelle) im bestehenden Kader
    const youngByPos = countByPos(
      (dynastyRoster || []).filter(p => {
        const pos   = normalizePos(p.pos || '')
        const thresh = AGING_THRESHOLD[pos]
        return thresh && Number.isFinite(Number(p.age)) && Number(p.age) < thresh
      })
    )

    const needTips = []
    for (const pos of ['WR', 'RB', 'QB', 'TE']) {
      const existing  = existingByPos[pos] || 0
      const drafted   = draftedByPos[pos]  || 0
      const total     = existing + drafted
      const aging     = agingByPos[pos]    || 0
      const young     = youngByPos[pos]    || 0
      const target    = DEPTH_TARGET[pos]
      const bestAvail = (byPos.get(pos) || [])[0]
      if (!bestAvail) continue

      const isThin        = total < target
      const agingFraction = existing > 0 ? aging / existing : 0
      const hasAgingIssue = aging >= 2 || (agingFraction >= 0.5 && existing >= 2)

      if (isThin && hasAgingIssue) {
        needTips.push({
          id: hashId(`rook-need-aging-${pos}`),
          type: 'pos_need',
          severity: 'warn',
          text: `${pos}-Lücke: nur ${total} gesamt, davon ${aging} altersbedingt wackelig. ${bestAvail.name} ist bester Verfügbarer.`,
          pos,
          _features: { need: target - total + aging, isThin: true, hasAgingIssue: true, urgency: 3 }
        })
      } else if (isThin) {
        needTips.push({
          id: hashId(`rook-need-thin-${pos}`),
          type: 'pos_need',
          severity: 'info',
          text: `${pos}-Tiefe dünn: ${total} von Ziel ${target}+. ${bestAvail.name} stärkt die Zukunft.`,
          pos,
          _features: { need: target - total, isThin: true, urgency: 2 }
        })
      } else if (hasAgingIssue && young < 2) {
        // Genug Spieler, aber zu wenig Jugend für langfristige Sicherheit
        needTips.push({
          id: hashId(`rook-aging-nobackup-${pos}`),
          type: 'pos_need',
          severity: 'info',
          text: `${pos} skews alt: ${aging} alternd, wenig Ersatz. ${bestAvail.name} für die Zukunft sichern.`,
          pos,
          _features: { need: aging, hasAgingIssue: true, urgency: 1 }
        })
      }
    }
    // Maximal die 3 dringendsten Positions-Tips
    needTips.sort((a, b) => (b._features?.urgency || 0) - (a._features?.urgency || 0))
    tips.push(...needTips.slice(0, 3))

    // ── 3) Positions-Sättigung ────────────────────────────────────────────────
    for (const pos of ['WR', 'RB']) {
      const total  = (existingByPos[pos] || 0) + (draftedByPos[pos] || 0)
      const young  = (youngByPos[pos]   || 0) + (draftedByPos[pos] || 0)
      if (total >= DEPTH_TARGET[pos] + 3 && young >= 4 && myPicksSoFar.length >= 1) {
        const otherPos = pos === 'WR' ? 'RB' : 'WR'
        const altBest  = (byPos.get(otherPos) || [])[0]
        tips.push({
          id: hashId(`rook-deep-${pos}`),
          type: 'depth_warning',
          severity: 'info',
          text: `${pos}-Überfluss: ${total} gesamt, ${young} jung. Pivot zu ${otherPos}${altBest ? ` — ${altBest.name}` : ''} erwägen.`,
          pos,
          _features: { saturated: true }
        })
      }
    }

    // ── 4) Dynasty-Value-Klippe / Tier-Druck ─────────────────────────────────
    for (const pos of ['WR', 'RB', 'QB', 'TE']) {
      const posPlayers = (byPos.get(pos) || []).slice().sort((a, b) => Number(a.rk) - Number(b.rk))
      if (posPlayers.length < 2) continue

      const hasDV = posPlayers.some(p => p.dynasty_value != null)

      if (hasDV) {
        // Dynasty Value: Abfall zwischen Platz 1 und 2
        const sorted = posPlayers.slice().sort((a, b) => (b.dynasty_value || 0) - (a.dynasty_value || 0))
        const top = sorted[0]; const second = sorted[1]
        if (top?.dynasty_value && second?.dynasty_value) {
          const gap = top.dynasty_value - second.dynasty_value
          if (gap >= 12) {
            tips.push({
              id: hashId(`dv-cliff-${pos}-${top.nname || top.name}`),
              type: 'run_warning',
              severity: 'warn',
              text: `Dynasty-Value-Klippe bei ${pos}: ${top.name} (${top.dynasty_value}) vs. nächster (${second.dynasty_value}). ${top.name} nicht liegenlassen.`,
              pos,
              _features: { gap, leftInTier: 1 }
            })
          }
        }
      } else {
        // Fallback: ECR-Tier-Druck
        const t0          = String(posPlayers[0].tier || '')
        const leftInTier  = t0 ? posPlayers.filter(x => String(x.tier || '') === t0).length : 0
        const nextInNext  = posPlayers.find(x => String(x.tier || '') !== t0)
        const gap         = nextInNext ? (Number(nextInNext.rk) - Number(posPlayers[0].rk)) : 0
        if (t0 && leftInTier === 1 && gap >= 6) {
          tips.push({
            id: hashId(`rook-tier-${pos}-${posPlayers[0].nname || posPlayers[0].name}`),
            type: 'run_warning',
            severity: 'warn',
            text: `Letzter ${pos} im Tier. Nächste Gruppe ~${gap} Plätze hinten — ${posPlayers[0].name} nicht verpassen.`,
            pos,
            _features: { leftInTier: 1, gap }
          })
        }
      }
    }

    return tips
  }, [
    enabled,
    JSON.stringify(picks), JSON.stringify(boardPlayers), meUserId,
    teamsCount, JSON.stringify(dynastyRoster), draftSlot, JSON.stringify(myDraftPicks)
  ])
}
