// src/services/preferences.js
// Spieler-Preferences: stabiler Key statt Ranking-Index
import { normalizePlayerName } from '../utils/formatting'

console.info('[prefs] loaded v2 with stable playerKey')

const STORAGE_KEY_V2 = 'sdh.playerPreferences.v2'   // NEU (wir ignorieren v1 bewusst)
const LEGACY_V1_KEY  = 'sdh.playerPreferences.v1'   // ALT (Ranking-Index -> pref)

// Konsistente Enums
export const PlayerPreference = {
  FAVORITE: 'favorite',
  AVOID: 'avoid',
}

/**
 * Liefert einen STABILEN Player-Key.
 */
export function playerKey(p) {
  if (!p) return ''

  // 1) harte ID nur verwenden, wenn sie NICHT wie ein rk aussieht
  const sidRaw = p.sleeper_id ?? p.player_id ?? null
  if (sidRaw != null) {
    const sid = String(sidRaw).trim()
    const rk  = String(p.rk ?? '').trim()
    const looksLikeShortNumber = /^\d{1,6}$/.test(sid)  // kurze rein numerische ID = verdächtig
    const equalsRk             = rk && sid === rk       // identisch zu rk? dann ignorieren
    if (sid && !looksLikeShortNumber && !equalsRk) {
      return sid
    }
    // Debug (optional):
    // console.warn('[playerKey] ignore sid because looks like rk/short number', { sid, rk, p })
  }

  // 2) robusten Namen aufbauen
  const rawName = (p.nname ?? null) || (p.name ?? '')
  let nname = ''
  try { nname = rawName ? normalizePlayerName(rawName) : '' } catch { nname = '' }
  if (!nname && rawName) {
    nname = String(rawName).trim().toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
  }

  const pos  = String(p.pos  ?? '').toUpperCase()
  const team = String(p.team ?? '').toUpperCase()

  // 3) Composite-Keys in absteigender Güte
  if (nname && pos && team) return `${nname}|${pos}|${team}`
  if (nname && pos)         return `${nname}|${pos}`
  if (nname)                return nname

  // 4) letzter Fallback – nie blanke Zahlen
  const softId = [
    team || null,
    pos || null,
    p.rk != null ? `rk${p.rk}` : null,
    p.id != null ? `id${p.id}` : null,
  ].filter(Boolean).join('|')

  return softId || `anon|${Math.random().toString(36).slice(2,8)}`
}


// --- Laden/Speichern v2 ---
export function loadPreferences() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_V2)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function savePreferences(map) {
  try {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(map || {}))
  } catch {}
}

/** Gibt 'favorite' | 'avoid' | null für einen Spieler/Key zurück */
export function getPreference(map, playerOrKey) {
  const key = typeof playerOrKey === 'string' ? playerOrKey : playerKey(playerOrKey)
  return map[key] || null
}

/** Setzt/entfernt die Pref und persisted v2 */
export function setPreference(map, playerOrKey, pref) {
  const key = typeof playerOrKey === 'string' ? playerOrKey : playerKey(playerOrKey)
  const next = { ...map }
  if (pref == null) delete next[key]
  else next[key] = pref
  savePreferences(next)
  return next
}

// --- Migrations-Helfer: v1 (Ranking-Index-Map) -> v2 (stable keys) ---
function loadLegacyV1() {
  try {
    const raw = localStorage.getItem(LEGACY_V1_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Migriert v1 anhand aktueller boardPlayers (wir matchen per rk == alter Key).
 * - Wird nur einmal aufgerufen (deine Komponente kann eine 'migrated'-Flag setzen)
 * - Gibt die neue v2-Map zurück (oder null, wenn nichts migriert wurde).
 */
export function migrateV1ToV2IfNeeded(boardPlayers = []) {
  const v1 = loadLegacyV1()
  if (!v1 || !Object.keys(v1).length || !Array.isArray(boardPlayers) || !boardPlayers.length) {
    return null
  }

  // Map rk -> player
  const byRk = new Map()
  for (const p of boardPlayers) {
    const rk = String(p?.rk ?? '')
    if (rk) byRk.set(rk, p)
  }

  // v2-Map aufbauen
  const v2 = {}
  for (const [oldRk, pref] of Object.entries(v1)) {
    const p = byRk.get(String(oldRk))
    if (!p) continue
    const k = playerKey(p)
    if (k) v2[k] = pref
  }

  // persist v2 + Markierung, dass migriert wurde
  if (Object.keys(v2).length) {
    savePreferences(v2)
    try {
      localStorage.setItem(`${STORAGE_KEY_V2}.migratedFromV1`, '1')
    } catch {}
    return v2
  }
  return null
}
