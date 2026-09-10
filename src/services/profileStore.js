// Persistenz fuer Format-Profile (Overrides + Strategie), gebunden an eine
// Liga-ID (stabil ueber Saisons) oder einen Format-Fingerprint (Mock-Drafts).
// Ersetzt storage.js::loadSetup/saveSetup und strategyStore.js vollstaendig.

import { deriveFormat, isStandaloneDraft } from './draftFormat'
import { makeFingerprint, pickProfile } from './strategyMatch'

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

export function newProfile({ name, boundLeagueId = null, fingerprint = null, mode = null } = {}) {
  const now = new Date().toISOString()
  const effMode = mode || fingerprint?.draftMode || 'redraft'
  return {
    id: newId(), name, boundLeagueId, fingerprint, mode: effMode,
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

export function createBlankProfile(name, mode = 'redraft') {
  const created = newProfile({ name: String(name || 'Neues Profil').trim() || 'Neues Profil', mode })
  saveProfiles([...loadProfiles(), created])
  return created
}

// Speichert ein (ggf. synthetisches) Profil unveraendert — rein speichern,
// keine Overrides anfassen. StrictMode-sicher, weil nur auf expliziten
// Button-Klick aufgerufen, nie aus useMemo/render heraus.
export function persistProfile(profile) {
  if (!profile || !profile.id) throw new Error('Kein Profil zum Speichern')
  return upsertProfile({ ...profile, updatedAt: new Date().toISOString() })
}

// leagueId gesetzt -> Liga-Bindung (vorherigem Halter wird die Bindung entzogen,
// damit resolveProfile().find(...) nie zwei Treffer fuer dieselbe Liga hat).
// fingerprint gesetzt -> Format-Bindung (Mock). Beide schliessen sich aus.
// Symmetrisch zur Liga-Bindung wird auch hier dem vorherigen Halter desselben
// Fingerprints die Bindung entzogen -- sonst haben nach einem Rebind zwei
// Profile denselben Fingerprint und pickProfile()'s Tie-Break-by-updatedAt
// kann den Draft spaeter wieder ans alte Profil zurueckreissen.
export function rebindProfile(id, { leagueId = null, fingerprint = null, mode = null } = {}) {
  let profiles = loadProfiles()
  const effMode = mode || fingerprint?.draftMode || 'redraft'
  if (leagueId) {
    profiles = profiles.map(p => (p.boundLeagueId === leagueId && (p.mode == null || p.mode === effMode) && p.id !== id ? { ...p, boundLeagueId: null } : p))
  } else if (fingerprint) {
    const fpKey = JSON.stringify(fingerprint)
    profiles = profiles.map(p => (p.id !== id && p.fingerprint && JSON.stringify(p.fingerprint) === fpKey ? { ...p, fingerprint: null } : p))
  }
  profiles = profiles.map(p => (p.id === id
    ? { ...p, boundLeagueId: leagueId || null, fingerprint: leagueId ? null : (fingerprint || null), mode: leagueId ? effMode : (fingerprint?.draftMode || p.mode || 'redraft'), updatedAt: new Date().toISOString() }
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
  const base = { ...EMPTY_OVERRIDES, ...legacyOverrides }
  const mk = (mode, name) => {
    const p = newProfile({ name, mode })
    p.overrides = { ...base }
    if (legacyStrategy) p.strategy = legacyStrategy
    return p
  }
  saveProfiles([mk('redraft', 'Migriert (Redraft)'), mk('rookie', 'Migriert (Rookie)')])
}

// Altbestand ohne mode heilen (idempotent):
export function migrateProfilesToMode() {
  const profiles = loadProfiles()
  if (!profiles.length) return { migrated: 0 }
  const lone = profiles.length === 1 && profiles[0].name === 'Migriert'
    && !profiles[0].boundLeagueId && !profiles[0].fingerprint && (profiles[0].mode == null)
  if (lone) {
    const src = profiles[0]
    const now = new Date().toISOString()
    const mkCopy = (mode, name) => ({ ...src, id: `${src.id}-${mode}`, name, mode, createdAt: src.createdAt, updatedAt: now })
    saveProfiles([mkCopy('redraft', 'Migriert (Redraft)'), mkCopy('rookie', 'Migriert (Rookie)')])
    return { migrated: 2 }
  }
  let n = 0
  const next = profiles.map(p => {
    if (p.mode === 'redraft' || p.mode === 'rookie') return p
    n += 1
    return { ...p, mode: p.fingerprint?.draftMode || 'redraft', updatedAt: p.updatedAt }
  })
  if (n) saveProfiles(next)
  return { migrated: n }
}

function fingerprintLabel(fp) {
  const scoring = fp.scoringType === 'half_ppr' ? 'Half-PPR' : fp.scoringType === 'standard' ? 'Standard' : 'PPR'
  return `${fp.teams}T ${scoring}${fp.superflex ? ' Superflex' : ''}`
}

// Fingerprint des AKTUELL aktiven Drafts/Liga -- unabhaengig davon, was
// irgendein Profil gerade gespeichert hat. Extrahiert aus resolveProfile()'s
// Standalone-Zweig, damit ein manuelles Rebind (SetupPage.handleRebindProfile)
// denselben frischen Fingerprint berechnen kann statt den (moeglicherweise
// abweichenden) Fingerprint des ALTEN Profils wiederzuverwenden.
export function computeDetectedFingerprint({ draft = null, league = null, draftMode = 'redraft' } = {}) {
  const standalone = isStandaloneDraft(draft)
  const effLeague = standalone ? null : league
  const detected = deriveFormat({ draft, league: effLeague, overrides: {} })
  return makeFingerprint({
    format: {
      teams: detected.teams, scoringType: detected.scoringType,
      superflex: detected.isSuperflex, rosterPositions: detected.rosterPositions,
    },
    draftMode,
  })
}

// Reine Funktion -- kein Storage-Write. React.StrictMode ruft aus useMemo
// heraus aufgerufene Funktionen im Dev-Modus doppelt auf; ein Write hier
// wuerde bei jedem neu erkannten Format/jeder neuen Liga eine Karteileiche
// anlegen. Persistiert wird erst, wenn der Nutzer tatsaechlich etwas aendert
// (upsertProfileOverrides/upsertProfileStrategy) -- siehe ProfileEditor.
export function resolveProfile({ draft = null, league = null, draftMode = 'redraft' } = {}) {
  const profiles = loadProfiles()
  const standalone = isStandaloneDraft(draft)

  if (league?.league_id && !standalone) {
    const existing = profiles.find(p => p.boundLeagueId === league.league_id && (p.mode == null || p.mode === draftMode))
    if (existing) return { profile: existing, deviations: [], isNew: false }
    // Kein Bound-Treffer: Vorschauprofil mit Strategie-Prefill aus der neuesten
    // modus-passenden Wildcard (ungebunden, mode passt). Nur `strategy` wird
    // uebernommen (Deep-Copy) — Overrides bleiben NULL, damit die Erkennung
    // massgeblich bleibt (kein Superflex-Schatten). Rein: kein Storage-Write.
    const preview = newProfile({ name: league.name || 'Liga', boundLeagueId: league.league_id, mode: draftMode })
    const donor = profiles
      .filter(p => !p.boundLeagueId && (p.mode == null || p.mode === draftMode))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))[0]
    if (donor?.strategy) {
      try {
        const s = JSON.parse(JSON.stringify(donor.strategy))
        preview.strategy = {
          summary: s.summary ?? '', rules: s.rules ?? [], sources: s.sources ?? [],
          contested: s.contested ?? [], source: s.source ?? 'manual', updatedAt: s.updatedAt ?? null,
        }
      } catch {}
    }
    return { profile: preview, deviations: [], isNew: true }
  }

  const fp = computeDetectedFingerprint({ draft, league, draftMode })

  const candidates = profiles.filter(p => !p.boundLeagueId)
  const hit = pickProfile(candidates, fp)
  if (hit) return { profile: hit.profile, deviations: hit.deviations, isNew: false }

  return { profile: newProfile({ name: fingerprintLabel(fp), fingerprint: fp }), deviations: [], isNew: true }
}
