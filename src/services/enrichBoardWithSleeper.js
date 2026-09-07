// src/services/enrichBoardWithSleeper.js
import { loadPlayersMetaCached, pickRelevantPlayers } from './playersMeta'
import { normalizePlayerName } from '../utils/formatting'

const TTL_MS = 24 * 60 * 60 * 1000

// v2: sleeper_id-Namensabgleich gegen den Zeilennummer-Bug (siehe unten) --
// Bump erzwingt einmalig einen Re-Merge ALLER Spieler, auch solcher, die
// schon (falsch) auf depth_chart_order: null gemerged wurden. Ein reiner
// "Feld fehlt"-Check haette diese bereits falsch gemergten Eintraege nicht
// erneut angefasst.
const ENRICH_VERSION = 2

function isFresh(player) {
  if (player?.enrich_v !== ENRICH_VERSION) return false
  const ts = Number(player?.enriched_at)
  return Number.isFinite(ts) && (Date.now() - ts) < TTL_MS
}

function primaryPos(meta) {
  const arr = Array.isArray(meta?.fantasy_positions) ? meta.fantasy_positions : []
  return arr[0] || meta?.position || ''
}

function buildNameIndex(metas) {
  const byName = new Map()
  for (const meta of Object.values(metas || {})) {
    const key = normalizePlayerName(meta?.full_name || '')
    if (!key) continue
    const arr = byName.get(key) || []
    arr.push(meta)
    byName.set(key, arr)
  }
  return byName
}

function mergePlayer(csv, meta) {
  if (!meta) {
    return {
      ...csv,
      enriched: true,
      enriched_at: Date.now(),
      enrich_v: ENRICH_VERSION,
      match_status: 'unmatched',
    }
  }

  const next = { ...csv }

  // CSV hat Vorrang; nur leere Felder befüllen
  if (!next.team && meta.team) next.team = meta.team
  const ppos = primaryPos(meta)
  if (!next.pos && ppos) next.pos = ppos
  if (!next.bye && meta.bye_week !== undefined && meta.bye_week !== null && String(meta.bye_week) !== '') {
    next.bye = String(meta.bye_week)
  }

  // ADP bewusst NICHT anfassen – kommt jetzt aus der CSV-Rechnung

  // Immer übernehmen/ergänzen
  next.sleeper_id = meta.player_id || next.sleeper_id || null
  next.injury_status = meta.injury_status ?? next.injury_status ?? null
  next.age = meta.age ?? next.age ?? null
  next.fantasy_positions = meta.fantasy_positions ?? next.fantasy_positions ?? []
  next.depth_chart_position = meta.depth_chart_position ?? next.depth_chart_position ?? null
  next.depth_chart_order = meta.depth_chart_order ?? next.depth_chart_order ?? null

  next.enriched = true
  next.enriched_at = Date.now()
  next.enrich_v = ENRICH_VERSION
  next.match_status = 'matched'
  return next
}

export async function enrichBoardPlayersWithSleeper(boardPlayers = [], { season } = {}) {
  if (!Array.isArray(boardPlayers) || boardPlayers.length === 0) return boardPlayers
  if (boardPlayers.every(isFresh)) return boardPlayers

  const metaAll = await loadPlayersMetaCached({ season })
  const metas = pickRelevantPlayers(metaAll, boardPlayers)
  const nameIdx = buildNameIndex(metas)

  const out = boardPlayers.map((bp) => {
    if (isFresh(bp)) return bp

    let meta = null
    const id = bp.sleeper_id || bp.player_id || bp.id
    const nameKey = normalizePlayerName(bp.name || '')
    // Bekannter Bug bei CSV-Importen: die ersten ~250 Raenge tragen als
    // sleeper_id teils nur ihre Zeilennummer statt einer echten Sleeper-ID
    // (siehe rosterStats.js). Kleine Zahlen wie "88" oder "91" sind bei
    // Sleeper laengst zurueckgetretene Alt-Spieler (Antoine Bethea, Carson
    // Palmer, ...) -- ohne den Namensabgleich wuerde deren leerer Datensatz
    // (kein Team, keine Depth-Chart) als "Treffer" durchgehen und die
    // eigentlich passende Namenssuche nie erreicht.
    if (id && metas[id] && normalizePlayerName(metas[id].full_name || '') === nameKey) {
      meta = metas[id]
    } else {
      const candidates = nameKey ? (nameIdx.get(nameKey) || []) : []
      if (candidates.length === 1) {
        meta = candidates[0]
      } else if (candidates.length > 1) {
        const team = String(bp.team || '').toUpperCase()
        const pos  = String(bp.pos || '').toUpperCase()
        const byTeam = team
          ? candidates.filter(c => String(c.team || '').toUpperCase() === team)
          : []
        if (byTeam.length === 1) {
          meta = byTeam[0]
        } else if (byTeam.length > 1) {
          meta = byTeam.find(c => (primaryPos(c) || '').toUpperCase() === pos) || byTeam[0]
        } else {
          meta = candidates.find(c => (primaryPos(c) || '').toUpperCase() === pos) || candidates[0]
        }
      }
    }

    return mergePlayer(bp, meta)
  })

  return out
}
