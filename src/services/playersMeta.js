// src/services/playersMeta.js
import { SLEEPER_API_BASE, fetchJson } from './api'
import { byeWeekForTeam } from '../data/nflByes'

// v5: bye_week-Fallback aus NFL_BYES (main) + status (waiver-wire) dazu --
// Versionsbump erzwingt einen Re-Fetch, sonst fehlen die neuen Felder bis
// zum naechsten TTL-Ablauf.
const CACHE_KEY = 'sdh.playersMeta.v5'
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

// Sleeper liefert kein ADP und keine bye_week (verifiziert 2026-07-16: 0 von
// 3221 aktiven Spielern). ADP kommt aus /api/rankings/ffc-adp, Bye aus der
// statischen NFL_BYES-Tabelle (src/data/nflByes.js) als Fallback — s. unten.
const SLIM_KEYS = [
  'player_id',
  'full_name',
  'first_name',
  'last_name',
  'team',
  'position',
  'fantasy_positions',
  'bye_week',
  'injury_status',
  'age',
  'status',
  'depth_chart_position',
  'depth_chart_order',
]

function slimPlayer(p) {
  const out = {}
  for (const k of SLIM_KEYS) out[k] = p?.[k] ?? null
  return out
}

export async function loadPlayersMetaCached({ season } = {}) {
  // Try cache
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      const cached = JSON.parse(raw)
      if (cached && cached.season === season && (Date.now() - cached.fetched_at) < TTL_MS && cached.data) {
        return cached.data
      }
    }
  } catch { /* ignore */ }

  // Fetch fresh
  let json = {}
  try {
    json = await fetchJson(`${SLEEPER_API_BASE}/players/nfl`)
  } catch (err) {
    console.warn('[playersMeta] fetch failed:', err)
    // bubble up empty record to not explode callers
    return {}
  }

  // Slim down to only required fields and index by player_id
  const data = {}
  for (const key of Object.keys(json)) {
    const slim = slimPlayer(json[key] || {})
    if (slim.player_id) data[slim.player_id] = slim
  }

  fillByeFallback(data, season)

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      season: season ?? null,
      fetched_at: Date.now(),
      data,
    }))
  } catch { /* ignore quota */ }

  return data
}

// Bye-Fallback: Sleeper-bye_week ist praktisch immer null — fehlende Werte
// werden aus der statischen Saisontabelle ergaenzt (Team-Ebene, gilt auch
// fuer DEF-Eintraege). Vorhandene Sleeper-Werte gewinnen immer; ohne
// Tabelleneintrag fuer die Saison passiert nichts (kein Fake).
export function fillByeFallback(data = {}, season) {
  for (const meta of Object.values(data)) {
    if (meta?.bye_week != null) continue
    const bye = byeWeekForTeam(meta?.team, season)
    if (bye != null) meta.bye_week = bye
  }
  return data
}

// Optional RAM reduction: keep only relevant players (by id or name match)
export function pickRelevantPlayers(playersMeta = {}, boardPlayers = []) {
  if (!boardPlayers?.length) return playersMeta
  const wantedIds = new Set(boardPlayers.map(p => p.player_id).filter(Boolean))
  const result = {}
  for (const [pid, meta] of Object.entries(playersMeta)) {
    if (wantedIds.has(pid)) result[pid] = meta
  }
  return Object.keys(result).length ? result : playersMeta
}