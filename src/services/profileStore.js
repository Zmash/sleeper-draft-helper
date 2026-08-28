// Persistenz fuer Format-Profile (Overrides + Strategie), gebunden an eine
// Liga-ID (stabil ueber Saisons) oder einen Format-Fingerprint (Mock-Drafts).
// Ersetzt storage.js::loadSetup/saveSetup und strategyStore.js vollstaendig.

export const PROFILES_KEY = 'sdh.profiles.v1'
export const PRINCIPLES_KEY = 'sdh.strategyPrinciples.v1'
const LEGACY_SETUP_KEY = 'sdh.setup.v2'
const LEGACY_STRATEGIES_KEY = 'sdh.strategies.v1'

const EMPTY_OVERRIDES = {
  scoring_type: null, superflex: null, roster_positions: null,
  teams: null, rounds: null, type: null, strategies: ['balanced'],
}
const EMPTY_STRATEGY = { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null }

function newId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? `prof_${crypto.randomUUID()}`
    : `prof_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function newProfile({ name, boundLeagueId = null, fingerprint = null } = {}) {
  const now = new Date().toISOString()
  return {
    id: newId(), name, boundLeagueId, fingerprint,
    overrides: { ...EMPTY_OVERRIDES },
    strategy: { ...EMPTY_STRATEGY },
    createdAt: now, updatedAt: now,
  }
}

export function loadProfiles() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILES_KEY) || 'null')
    return Array.isArray(raw?.profiles) ? raw.profiles : []
  } catch {
    return []
  }
}

export function saveProfiles(profiles) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify({ version: 1, profiles: profiles || [] }))
  } catch {}
}

export function loadPrinciples() {
  try {
    return String(localStorage.getItem(PRINCIPLES_KEY) || '')
  } catch {
    return ''
  }
}

export function savePrinciples(text) {
  try {
    localStorage.setItem(PRINCIPLES_KEY, String(text || ''))
  } catch {}
}

function upsertProfile(profile) {
  const profiles = loadProfiles()
  const idx = profiles.findIndex(p => p.id === profile.id)
  const next = idx >= 0 ? profiles.map((p, i) => (i === idx ? profile : p)) : [...profiles, profile]
  saveProfiles(next)
  return profile
}

export function upsertProfileOverrides(profile, overridesPatch) {
  const next = {
    ...profile,
    overrides: { ...profile.overrides, ...overridesPatch },
    updatedAt: new Date().toISOString(),
  }
  return upsertProfile(next)
}

export function upsertProfileStrategy(profile, strategyPatch) {
  const next = {
    ...profile,
    strategy: { ...profile.strategy, ...strategyPatch },
    updatedAt: new Date().toISOString(),
  }
  return upsertProfile(next)
}

export function renameProfile(id, name) {
  const profiles = loadProfiles()
  const next = profiles.map(p => (p.id === id ? { ...p, name: String(name || '').trim() || 'Profil', updatedAt: new Date().toISOString() } : p))
  saveProfiles(next)
  return next.find(p => p.id === id) || null
}

export function duplicateProfile(id) {
  const profiles = loadProfiles()
  const src = profiles.find(p => p.id === id)
  if (!src) return null
  const now = new Date().toISOString()
  const copy = {
    ...src, id: newId(), name: `${src.name} (Kopie)`,
    boundLeagueId: null, fingerprint: null,
    createdAt: now, updatedAt: now,
  }
  saveProfiles([...profiles, copy])
  return copy
}

export function deleteProfile(id) {
  saveProfiles(loadProfiles().filter(p => p.id !== id))
}

export function createBlankProfile(name) {
  const created = newProfile({ name: String(name || 'Neues Profil').trim() || 'Neues Profil' })
  saveProfiles([...loadProfiles(), created])
  return created
}

// leagueId gesetzt -> Liga-Bindung (vorherigem Halter wird die Bindung entzogen,
// damit resolveProfile().find(...) nie zwei Treffer fuer dieselbe Liga hat).
// fingerprint gesetzt -> Format-Bindung (Mock). Beide schliessen sich aus.
export function rebindProfile(id, { leagueId = null, fingerprint = null } = {}) {
  let profiles = loadProfiles()
  if (leagueId) {
    profiles = profiles.map(p => (p.boundLeagueId === leagueId && p.id !== id ? { ...p, boundLeagueId: null } : p))
  }
  profiles = profiles.map(p => (p.id === id
    ? { ...p, boundLeagueId: leagueId || null, fingerprint: leagueId ? null : (fingerprint || null), updatedAt: new Date().toISOString() }
    : p))
  saveProfiles(profiles)
  return profiles.find(p => p.id === id) || null
}

// Einmalig aus main.jsx (ueber stores/migrate.js) aufgerufen, bevor irgendetwas
// resolveProfile() aufruft. Kein Datenverlust: alte Keys bleiben liegen.
export function migrateLegacyProfile() {
  if (loadProfiles().length) return

  let legacyOverrides = null
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_SETUP_KEY) || 'null')
    legacyOverrides = raw?.overrides || null
  } catch {}

  let legacyStrategy = null
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_STRATEGIES_KEY) || 'null')
    if (raw?.principles) savePrinciples(raw.principles)
    const first = Array.isArray(raw?.items) ? raw.items[0] : null
    if (first) {
      legacyStrategy = {
        summary: first.summary || '', rules: first.rules || [],
        sources: first.sources || [], contested: first.contested || [],
        source: first.source || 'manual', updatedAt: first.createdAt || null,
      }
    }
  } catch {}

  if (!legacyOverrides && !legacyStrategy) return

  const migrated = newProfile({ name: 'Migriert' })
  if (legacyOverrides) migrated.overrides = { ...EMPTY_OVERRIDES, ...legacyOverrides }
  if (legacyStrategy) migrated.strategy = legacyStrategy
  saveProfiles([migrated])
}
