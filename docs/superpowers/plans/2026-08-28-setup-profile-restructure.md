# Setup/Profile-Restrukturierung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Format-Overrides und Draft-Strategie aus getrennten globalen `localStorage`-Keys in ein gemeinsames, kontext-gebundenes "Format-Profil" überführen (Liga-ID für echte Ligen, Format-Fingerprint für Mock-Drafts), die Setup-Seite entschlacken und ein neues Profile-Hub sowie einen Board-Profil-Hinweis hinzufügen.

**Architecture:** Ein neuer Service `profileStore.js` ersetzt `storage.js`'s `loadSetup/saveSetup` und `strategyStore.js` vollständig. `resolveProfile()` ist eine reine Funktion (kein Storage-Write) — Profile werden nur persistiert, wenn der Nutzer tatsächlich etwas ändert (verhindert Karteileichen durch React-StrictMode-Doppelaufrufe und durch bloßes Betrachten eines Mocks). `strategyMatch.js` liefert weiterhin die Fingerprint-/Abweichungs-Logik, jetzt für ganze Profile statt einzelne Strategie-Items. `App.jsx` und `BoardSection.jsx` lösen unabhängig voneinander (wie heute schon bei anderer Logik üblich) über `resolveProfile()` auf, statt einen globalen Override-Key zu lesen.

**Tech Stack:** React 18, Zustand (nicht betroffen — reine `localStorage`-Services), Vitest, react-router-dom.

## Global Constraints

- UI-Text und Kommentare sind Deutsch (CLAUDE.md).
- Kein Linter im Projekt — keine ESLint-Anpassungen nötig, `// eslint-disable-line`-Kommentare an bestehenden Stellen unangetastet lassen.
- `npm test` (Vitest, einmalig) muss nach jedem Task grün sein.
- Destruktive Aktionen (Profil löschen) nutzen `window.confirm`, wie es der Rest der App bereits durchgängig tut (siehe `LeagueCard.jsx`, `StrategySection.jsx`).
- Keine neuen Dependencies — alles mit vorhandenen Paketen (`lucide-react` für Icons ist schon Dependency).
- Keine Emoji als Struktur-Icons — ausschließlich `Icon.jsx` (lucide-react).
- `React.StrictMode` ist aktiv (`main.jsx`) — jede neue Funktion, die aus `useMemo` heraus aufgerufen wird, muss doppel-aufruf-sicher sein (keine Schreib-Nebenwirkungen in reinen Ableitungen).

---

## Datei-Übersicht

| Datei | Aktion |
|---|---|
| `src/services/profileStore.js` | neu |
| `src/services/profileStore.test.js` | neu |
| `src/services/strategyMatch.js` | ersetzt (Fingerprint ohne `season`, `pickProfile` statt `pickStrategy`) |
| `src/services/strategyMatch.test.js` | ersetzt |
| `src/services/strategyStore.js` | löschen |
| `src/services/strategyStore.test.js` | löschen |
| `src/services/storage.js` | `loadSetup/saveSetup/SETUP_KEY` entfernen |
| `src/stores/migrate.js` | `migrateLegacyStrategy` → `migrateLegacyProfile` |
| `src/components/Icon.jsx` | `anchor`, `shuffle` ergänzen |
| `src/components/StrategySection.jsx` | umgeschrieben (ein Strategie-Objekt statt Items-Liste) |
| `src/components/ProfileEditor.jsx` | neu |
| `src/components/ProfileBadgeCard.jsx` | neu |
| `src/components/SetupForm.jsx` | Akkordeon aufgelöst, Format/Strategie-Block ersetzt |
| `src/pages/SetupPage.jsx` | löst Profil auf, lädt Profil-Liste, reicht durch |
| `src/App.jsx` | `resolveProfile` statt `loadSetup`, Storage-Key-Filter aktualisiert |
| `src/components/BoardSection.jsx` | `resolveProfile` statt Roh-Parse, Profil-Hinweis-UI |
| `src/pages/ProfilesPage.jsx` | neu |
| `src/components/Topbar.jsx` | Zahnrad-Button + Modal |
| `CLAUDE.md` | Abschnitt "Setup overrides" durch "Format-Profile" ersetzt |

---

### Task 1: `profileStore.js` — Kern-Datenmodell (lesen/schreiben, ohne Auflösung)

**Files:**
- Create: `src/services/profileStore.js`
- Test: `src/services/profileStore.test.js`

**Interfaces:**
- Produces: `PROFILES_KEY`, `PRINCIPLES_KEY`, `loadProfiles(): Profile[]`, `saveProfiles(profiles: Profile[]): void`, `loadPrinciples(): string`, `savePrinciples(text: string): void`, `upsertProfileOverrides(profile: Profile, patch: object): Profile`, `upsertProfileStrategy(profile: Profile, patch: object): Profile`, `renameProfile(id: string, name: string): Profile|null`, `duplicateProfile(id: string): Profile|null`, `deleteProfile(id: string): void`, `createBlankProfile(name: string): Profile`, `rebindProfile(id: string, { leagueId, fingerprint }): Profile|null`, `migrateLegacyProfile(): void`.
- `Profile` shape: `{ id, name, boundLeagueId, fingerprint, overrides: { scoring_type, superflex, roster_positions, teams, rounds, type, strategies }, strategy: { summary, rules, sources, contested, source, updatedAt }, createdAt, updatedAt }`.

- [ ] **Step 1: Write the failing tests**

```js
// src/services/profileStore.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  PROFILES_KEY, PRINCIPLES_KEY, loadProfiles, saveProfiles,
  loadPrinciples, savePrinciples,
  upsertProfileOverrides, upsertProfileStrategy,
  renameProfile, duplicateProfile, deleteProfile, createBlankProfile, rebindProfile,
  migrateLegacyProfile,
} from './profileStore'

beforeEach(() => { localStorage.clear() })

describe('loadProfiles/saveProfiles', () => {
  it('liefert eine leere Liste, wenn nichts gespeichert ist', () => {
    expect(loadProfiles()).toEqual([])
  })

  it('liefert eine leere Liste bei kaputtem JSON', () => {
    localStorage.setItem(PROFILES_KEY, '{nicht json')
    expect(loadProfiles()).toEqual([])
  })

  it('schreibt und liest zurueck', () => {
    const p = createBlankProfile('Test')
    expect(loadProfiles()).toHaveLength(1)
    expect(loadProfiles()[0].id).toBe(p.id)
  })
})

describe('createBlankProfile', () => {
  it('legt ein ungebundenes Profil mit leeren Overrides an', () => {
    const p = createBlankProfile('Mein Profil')
    expect(p.name).toBe('Mein Profil')
    expect(p.boundLeagueId).toBeNull()
    expect(p.fingerprint).toBeNull()
    expect(p.overrides.scoring_type).toBeNull()
    expect(p.strategy.summary).toBe('')
  })

  it('faellt bei leerem Namen auf "Neues Profil" zurueck', () => {
    expect(createBlankProfile('').name).toBe('Neues Profil')
  })
})

// Synthetische Profile (wie resolveProfile sie in Task 3 fuer noch nicht
// gespeicherte Treffer liefert) werden nicht ueber createBlankProfile erzeugt,
// sondern sind einfache Objekte gemaess der Profile-Shape:
function fakeProfile(over = {}) {
  return {
    id: 'prof_x', name: 'X', boundLeagueId: null, fingerprint: null,
    overrides: { scoring_type: null, superflex: null, roster_positions: null, teams: null, rounds: null, type: null, strategies: ['balanced'] },
    strategy: { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

describe('upsertProfileOverrides', () => {
  it('persistiert ein noch nicht gespeichertes (synthetisches) Profil beim ersten Edit', () => {
    const synthetic = fakeProfile()
    expect(loadProfiles()).toHaveLength(0)
    const updated = upsertProfileOverrides(synthetic, { superflex: true })
    expect(updated.overrides.superflex).toBe(true)
    expect(loadProfiles()).toHaveLength(1)
    expect(loadProfiles()[0].id).toBe('prof_x')
  })

  it('aktualisiert ein bereits gespeichertes Profil, statt es zu duplizieren', () => {
    const p = createBlankProfile('Test')
    upsertProfileOverrides(p, { teams: 10 })
    upsertProfileOverrides({ ...p, overrides: { ...p.overrides, teams: 10 } }, { rounds: 15 })
    expect(loadProfiles()).toHaveLength(1)
    expect(loadProfiles()[0].overrides).toMatchObject({ teams: 10, rounds: 15 })
  })
})

describe('upsertProfileStrategy', () => {
  it('schreibt strategy-Patch und aktualisiert updatedAt', () => {
    const p = createBlankProfile('Test')
    const updated = upsertProfileStrategy(p, { summary: 'S', rules: ['R1'], source: 'ai' })
    expect(updated.strategy.summary).toBe('S')
    expect(updated.strategy.source).toBe('ai')
    expect(updated.updatedAt).not.toBe(p.updatedAt)
  })
})

describe('renameProfile/duplicateProfile/deleteProfile', () => {
  it('benennt um', () => {
    const p = createBlankProfile('Alt')
    renameProfile(p.id, 'Neu')
    expect(loadProfiles()[0].name).toBe('Neu')
  })

  it('dupliziert ohne Bindung zu uebernehmen', () => {
    const p = createBlankProfile('Original')
    rebindProfile(p.id, { leagueId: 'L1' })
    const copy = duplicateProfile(p.id)
    expect(copy.name).toBe('Original (Kopie)')
    expect(copy.boundLeagueId).toBeNull()
    expect(copy.id).not.toBe(p.id)
    expect(loadProfiles()).toHaveLength(2)
  })

  it('loescht', () => {
    const p = createBlankProfile('Weg')
    deleteProfile(p.id)
    expect(loadProfiles()).toHaveLength(0)
  })
})

describe('rebindProfile', () => {
  it('bindet an eine Liga und entfernt die Bindung beim vorherigen Halter', () => {
    const a = createBlankProfile('A')
    const b = createBlankProfile('B')
    rebindProfile(a.id, { leagueId: 'L1' })
    rebindProfile(b.id, { leagueId: 'L1' })
    const profiles = loadProfiles()
    expect(profiles.find(p => p.id === a.id).boundLeagueId).toBeNull()
    expect(profiles.find(p => p.id === b.id).boundLeagueId).toBe('L1')
  })

  it('bindet an einen Fingerprint und loescht die Liga-Bindung', () => {
    const a = createBlankProfile('A')
    rebindProfile(a.id, { leagueId: 'L1' })
    rebindProfile(a.id, { fingerprint: { draftMode: 'redraft', scoringType: 'ppr', superflex: false, teams: 12, starters: [] } })
    const updated = loadProfiles()[0]
    expect(updated.boundLeagueId).toBeNull()
    expect(updated.fingerprint.teams).toBe(12)
  })
})

describe('loadPrinciples/savePrinciples', () => {
  it('liefert leeren String ohne gespeicherten Wert', () => {
    expect(loadPrinciples()).toBe('')
  })

  it('schreibt und liest zurueck', () => {
    savePrinciples('DEF wird gestreamt.')
    expect(loadPrinciples()).toBe('DEF wird gestreamt.')
  })
})

describe('migrateLegacyProfile', () => {
  it('fuehrt sdh.setup.v2 und sdh.strategies.v1 zu einem ungebundenen Profil zusammen', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { scoring_type: 'half_ppr', superflex: true, roster_positions: null, teams: 10, rounds: 15, type: 'snake', strategies: ['zeroRB'] } }))
    localStorage.setItem('sdh.strategies.v1', JSON.stringify({
      principles: 'DEF wird gestreamt.',
      items: [{ id: 'a', label: 'A', summary: 'Leitlinie.', rules: ['R1'], sources: [], contested: [], source: 'ai', createdAt: '2026-01-01T00:00:00.000Z' }],
    }))
    migrateLegacyProfile()
    const profiles = loadProfiles()
    expect(profiles).toHaveLength(1)
    expect(profiles[0].name).toBe('Migriert')
    expect(profiles[0].boundLeagueId).toBeNull()
    expect(profiles[0].fingerprint).toBeNull()
    expect(profiles[0].overrides).toMatchObject({ scoring_type: 'half_ppr', superflex: true, teams: 10, strategies: ['zeroRB'] })
    expect(profiles[0].strategy.summary).toBe('Leitlinie.')
    expect(loadPrinciples()).toBe('DEF wird gestreamt.')
  })

  it('laesst alte Keys stehen (Rollback bleibt moeglich)', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { superflex: true } }))
    migrateLegacyProfile()
    expect(localStorage.getItem('sdh.setup.v2')).not.toBeNull()
  })

  it('ist idempotent (laeuft nur, wenn noch keine Profile existieren)', () => {
    localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { superflex: true } }))
    migrateLegacyProfile()
    migrateLegacyProfile()
    expect(loadProfiles()).toHaveLength(1)
  })

  it('tut nichts ohne alte Keys', () => {
    migrateLegacyProfile()
    expect(loadProfiles()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- profileStore -t "" 2>&1 | head -50` (oder `npx vitest run src/services/profileStore.test.js`)
Expected: FAIL — Modul `./profileStore` existiert nicht.

- [ ] **Step 3: Implement `profileStore.js`**

```js
// src/services/profileStore.js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/profileStore.test.js`
Expected: PASS (alle Tests aus Step 1)

- [ ] **Step 5: Commit**

```bash
git add src/services/profileStore.js src/services/profileStore.test.js
git commit -m "feat(profiles): profileStore mit CRUD + Migration aus altem Setup/Strategie-Key"
```

---

### Task 2: `strategyMatch.js` — Fingerprint & Profil-Matching

**Files:**
- Modify: `src/services/strategyMatch.js` (kompletter Ersatz des Inhalts)
- Modify: `src/services/strategyMatch.test.js` (kompletter Ersatz des Inhalts)

**Interfaces:**
- Consumes: nichts (reine Funktionen)
- Produces: `makeFingerprint({ format, draftMode }): Fingerprint` (ohne `season`!), `pickProfile(profiles: Profile[], fp: Fingerprint): { profile: Profile, deviations: string[] } | null`, `resolveStrategyText(principles: string, strategy: { summary, rules }): string`.
- Verwendet von: `profileStore.resolveProfile` (Task 3), `ProfileEditor`/`StrategySection` (Task 6), `App.jsx`/`BoardSection.jsx` (Task 9/10).

- [ ] **Step 1: Write the failing tests**

```js
// src/services/strategyMatch.test.js
import { describe, it, expect } from 'vitest'
import { makeFingerprint, pickProfile, resolveStrategyText } from './strategyMatch'

const FORMAT = {
  scoringType: 'half_ppr', superflex: false, teams: 12,
  rosterPositions: ['QB','RB','RB','WR','WR','TE','FLEX','BN','BN','BN'],
}

const fp = (over = {}) => ({
  draftMode: 'redraft', scoringType: 'half_ppr', superflex: false,
  teams: 12, starters: ['FLEX','QB','RB','RB','TE','WR','WR'],
  ...over,
})

const profile = (over = {}) => ({
  id: 'a', name: 'A', boundLeagueId: null, fingerprint: fp(),
  overrides: {}, strategy: {}, updatedAt: '2026-07-01T00:00:00.000Z',
  ...over,
})

describe('makeFingerprint', () => {
  it('entfernt BN und sortiert die Starter stabil', () => {
    const got = makeFingerprint({ format: FORMAT, draftMode: 'redraft' })
    expect(got.starters).toEqual(['FLEX','QB','RB','RB','TE','WR','WR'])
  })

  it('normalisiert teams zu Number, superflex zu Boolean, kennt kein season-Feld', () => {
    const got = makeFingerprint({ format: { ...FORMAT, teams: '12', superflex: 1 }, draftMode: 'redraft' })
    expect(got.teams).toBe(12)
    expect(got.superflex).toBe(true)
    expect(got.season).toBeUndefined()
  })
})

describe('pickProfile — harter Filter', () => {
  it('waehlt ein Rookie-Profil nie im Redraft', () => {
    const profiles = [profile({ fingerprint: fp({ draftMode: 'rookie' }) })]
    expect(pickProfile(profiles, fp())).toBeNull()
  })

  it('schliesst abweichendes Scoring aus', () => {
    const profiles = [profile({ fingerprint: fp({ scoringType: 'ppr' }) })]
    expect(pickProfile(profiles, fp())).toBeNull()
  })

  it('schliesst abweichendes Superflex aus', () => {
    const profiles = [profile({ fingerprint: fp({ superflex: true }) })]
    expect(pickProfile(profiles, fp())).toBeNull()
  })
})

describe('pickProfile — weiche Auswahl', () => {
  it('liefert bei exaktem Treffer keine Abweichungen', () => {
    const got = pickProfile([profile()], fp())
    expect(got.profile.id).toBe('a')
    expect(got.deviations).toEqual([])
  })

  it('bevorzugt den Kandidaten mit weniger Abweichungen', () => {
    const profiles = [
      profile({ id: 'weit', fingerprint: fp({ teams: 8, starters: ['QB','RB','WR'] }) }),
      profile({ id: 'nah', fingerprint: fp({ teams: 10 }) }),
    ]
    const got = pickProfile(profiles, fp())
    expect(got.profile.id).toBe('nah')
    expect(got.deviations).toHaveLength(1)
    expect(got.deviations[0]).toContain('10')
  })

  it('nimmt bei Gleichstand das zuletzt aktualisierte Profil', () => {
    const profiles = [
      profile({ id: 'alt', updatedAt: '2026-01-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
      profile({ id: 'neu', updatedAt: '2026-06-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
    ]
    expect(pickProfile(profiles, fp()).profile.id).toBe('neu')
  })
})

describe('pickProfile — Wildcard (migriertes Profil ohne Fingerprint)', () => {
  it('gewinnt nur, wenn kein echter Treffer existiert', () => {
    const wild = profile({ id: 'wild', fingerprint: null })
    expect(pickProfile([wild], fp()).profile.id).toBe('wild')
    expect(pickProfile([wild, profile({ id: 'echt' })], fp()).profile.id).toBe('echt')
  })
})

describe('pickProfile — Randfaelle', () => {
  it('liefert null ohne Profile oder ohne Fingerprint', () => {
    expect(pickProfile([], fp())).toBeNull()
    expect(pickProfile([profile()], null)).toBeNull()
  })
})

describe('resolveStrategyText', () => {
  it('enthaelt Grundsaetze, Leitlinie und Regeln, aber keine Quellen', () => {
    const text = resolveStrategyText('DEF wird gestreamt.', { summary: 'Leitlinie.', rules: ['R1'], sources: [{ title: 'FP', url: 'https://fantasypros.com/x' }] })
    expect(text).toContain('DEF wird gestreamt.')
    expect(text).toContain('Leitlinie.')
    expect(text).toContain('R1')
    expect(text).not.toContain('fantasypros.com')
  })

  it('liefert nur die Grundsaetze, wenn keine Strategie hinterlegt ist', () => {
    expect(resolveStrategyText('DEF wird gestreamt.', { summary: '', rules: [] })).toBe('DEF wird gestreamt.')
  })

  it('kappt bei 4000 Zeichen', () => {
    const text = resolveStrategyText('', { summary: '', rules: ['x'.repeat(5000)] })
    expect(text.length).toBe(4000)
  })

  it('kommt mit leeren Eingaben klar', () => {
    expect(resolveStrategyText('', { summary: '', rules: [] })).toBe('')
    expect(resolveStrategyText(null, null)).toBe('')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/strategyMatch.test.js`
Expected: FAIL — `pickProfile` ist nicht exportiert, `makeFingerprint`/`resolveStrategyText`-Signaturen stimmen nicht.

- [ ] **Step 3: Implement `strategyMatch.js`**

```js
// src/services/strategyMatch.js
// Ordnet einem Mock-Draft das passende Format-Profil per Fingerprint zu.
// Liga-Bindung wird NICHT hier, sondern direkt in profileStore.resolveProfile
// aufgeloest (eindeutige league_id, kein Fuzzy-Matching noetig).

export function makeFingerprint({ format = {}, draftMode } = {}) {
  const roster = Array.isArray(format.rosterPositions) ? format.rosterPositions : []
  return {
    draftMode: String(draftMode || 'redraft'),
    scoringType: String(format.scoringType || 'ppr'),
    superflex: !!format.superflex,
    teams: Number(format.teams) || 0,
    starters: roster
      .map(s => String(s).toUpperCase())
      .filter(s => s !== 'BN')
      .sort(),
  }
}

function sameStarters(a = [], b = []) {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

function deviationsBetween(profileFp, fp) {
  const out = []
  if (profileFp.teams !== fp.teams) {
    out.push(`aus einer ${profileFp.teams}er-Liga, du draftest in einer ${fp.teams}er`)
  }
  if (!sameStarters(profileFp.starters, fp.starters)) {
    out.push(`andere Starter-Slots (${profileFp.starters.join(', ')})`)
  }
  return out
}

// profiles: alle Kandidaten, die NICHT liga-gebunden sind (Aufrufer filtert das).
// Harter Filter auf draftMode/scoringType/superflex, weiche Abweichungs-
// Bewertung auf teams/starters. Profile ohne fingerprint (migrierter Altbestand)
// gewinnen nur, wenn kein echter Treffer existiert.
export function pickProfile(profiles, fp) {
  if (!Array.isArray(profiles) || !profiles.length || !fp) return null

  const wildcards = profiles.filter(p => !p?.fingerprint)
  const matches = profiles.filter(p => {
    const f = p?.fingerprint
    if (!f) return false
    return f.draftMode === fp.draftMode
      && f.scoringType === fp.scoringType
      && !!f.superflex === !!fp.superflex
  })

  if (matches.length) {
    const scored = matches
      .map(profile => ({ profile, deviations: deviationsBetween(profile.fingerprint, fp) }))
      .sort((a, b) => {
        const d = a.deviations.length - b.deviations.length
        if (d !== 0) return d
        return String(b.profile.updatedAt || '').localeCompare(String(a.profile.updatedAt || ''))
      })
    return scored[0]
  }

  if (wildcards.length) {
    const newest = [...wildcards].sort(
      (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    )[0]
    return { profile: newest, deviations: [] }
  }

  return null
}

const MAX_STRATEGY_CHARS = 4000

// principles gelten global (profilübergreifend), strategy ist die Format-
// spezifische Leitlinie+Regeln des jeweiligen Profils. sources/contested
// gehen bewusst nicht in den Prompt-Text ein — nur Anzeige.
export function resolveStrategyText(principles, strategy) {
  const p = String(principles || '').trim()
  const summary = String(strategy?.summary || '').trim()
  const rules = Array.isArray(strategy?.rules) ? strategy.rules : []
  const parts = []
  if (p) parts.push(p)
  if (summary) parts.push(summary)
  if (rules.length) parts.push(rules.map(r => `- ${r}`).join('\n'))
  return parts.join('\n\n').slice(0, MAX_STRATEGY_CHARS)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/strategyMatch.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/strategyMatch.js src/services/strategyMatch.test.js
git commit -m "refactor(profiles): pickStrategy -> pickProfile, Fingerprint ohne season"
```

---

### Task 3: `resolveProfile()` — Kontext-Auflösung (Liga-ID / Fingerprint)

**Files:**
- Modify: `src/services/profileStore.js` (ergänzen)
- Modify: `src/services/profileStore.test.js` (ergänzen)

**Interfaces:**
- Consumes: `loadProfiles`, `newProfile` (aus Task 1), `makeFingerprint`, `pickProfile` (aus Task 2), `deriveFormat`, `isStandaloneDraft` (aus `./draftFormat`, bestehend).
- Produces: `resolveProfile({ draft, league, draftMode }): { profile: Profile, deviations: string[], isNew: boolean }`. **Reine Funktion — kein `localStorage`-Write.** Bei `isNew: true` ist `profile` ein frisches, noch NICHT gespeichertes Objekt (Aufrufer persistiert es erst beim ersten echten Edit über `upsertProfileOverrides`/`upsertProfileStrategy`, s. Task 1).

- [ ] **Step 1: Write the failing tests**

```js
// an profileStore.test.js anhaengen
import { resolveProfile } from './profileStore'

describe('resolveProfile — Liga-Bindung', () => {
  it('findet ein existierendes, liga-gebundenes Profil', () => {
    const p = createBlankProfile('Meine Liga')
    rebindProfile(p.id, { leagueId: 'L1' })
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L1', settings: {} },
      league: { league_id: 'L1', name: 'Meine Liga' },
      draftMode: 'redraft',
    })
    expect(profile.id).toBe(p.id)
    expect(isNew).toBe(false)
  })

  it('legt ein neues, NICHT persistiertes Profil an, wenn die Liga noch kein Profil hat', () => {
    const { profile, isNew } = resolveProfile({
      draft: { league_id: 'L2', settings: {} },
      league: { league_id: 'L2', name: 'Neue Liga' },
      draftMode: 'redraft',
    })
    expect(isNew).toBe(true)
    expect(profile.boundLeagueId).toBe('L2')
    expect(profile.name).toBe('Neue Liga')
    expect(loadProfiles()).toHaveLength(0) // kein Write als Seiteneffekt
  })
})

describe('resolveProfile — Mock/Standalone (Fingerprint)', () => {
  const mockDraft = { league_id: null, settings: { teams: 12, rounds: 15 }, metadata: { scoring_type: 'ppr' } }

  it('matched ein bestehendes Format-Profil exakt', () => {
    const p = createBlankProfile('12er PPR')
    const fp = makeFingerprintFromMock()
    rebindProfile(p.id, { fingerprint: fp })
    const { profile, deviations, isNew } = resolveProfile({ draft: mockDraft, league: null, draftMode: 'redraft' })
    expect(profile.id).toBe(p.id)
    expect(deviations).toEqual([])
    expect(isNew).toBe(false)
  })

  it('legt ein neues, unpersistiertes Profil an, wenn kein Fingerprint passt', () => {
    const { profile, isNew } = resolveProfile({ draft: mockDraft, league: null, draftMode: 'redraft' })
    expect(isNew).toBe(true)
    expect(profile.fingerprint).toMatchObject({ teams: 12, scoringType: 'ppr', superflex: false })
    expect(loadProfiles()).toHaveLength(0)
  })

  it('eine noch ausgewaehlte Liga darf einen Standalone-Mock nicht beeinflussen', () => {
    const league = { league_id: 'L3', total_rosters: 8 }
    const { profile } = resolveProfile({ draft: mockDraft, league, draftMode: 'redraft' })
    expect(profile.boundLeagueId).toBeNull()
    expect(profile.fingerprint.teams).toBe(12) // aus dem Mock, nicht aus der 8er-Liga
  })

  function makeFingerprintFromMock() {
    return { draftMode: 'redraft', scoringType: 'ppr', superflex: false, teams: 12, starters: [] }
  }
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/profileStore.test.js`
Expected: FAIL — `resolveProfile` ist nicht exportiert.

- [ ] **Step 3: Implement `resolveProfile`**

An `src/services/profileStore.js` anhängen (Import-Zeile oben ergänzen):

```js
import { deriveFormat, isStandaloneDraft } from './draftFormat'
import { makeFingerprint, pickProfile } from './strategyMatch'
```

```js
function fingerprintLabel(fp) {
  const scoring = fp.scoringType === 'half_ppr' ? 'Half-PPR' : fp.scoringType === 'standard' ? 'Standard' : 'PPR'
  return `${fp.teams}T ${scoring}${fp.superflex ? ' Superflex' : ''}`
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
    const existing = profiles.find(p => p.boundLeagueId === league.league_id)
    if (existing) return { profile: existing, deviations: [], isNew: false }
    return { profile: newProfile({ name: league.name || 'Liga', boundLeagueId: league.league_id }), deviations: [], isNew: true }
  }

  const effLeague = standalone ? null : league
  const detected = deriveFormat({ draft, league: effLeague, overrides: {} })
  const fp = makeFingerprint({
    format: {
      teams: detected.teams, scoringType: detected.scoringType,
      superflex: detected.isSuperflex, rosterPositions: detected.rosterPositions,
    },
    draftMode,
  })

  const candidates = profiles.filter(p => !p.boundLeagueId)
  const hit = pickProfile(candidates, fp)
  if (hit) return { profile: hit.profile, deviations: hit.deviations, isNew: false }

  return { profile: newProfile({ name: fingerprintLabel(fp), fingerprint: fp }), deviations: [], isNew: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/profileStore.test.js`
Expected: PASS (alle Tests aus Task 1 + 3)

- [ ] **Step 5: Commit**

```bash
git add src/services/profileStore.js src/services/profileStore.test.js
git commit -m "feat(profiles): resolveProfile loest Liga-/Mock-Kontext auf Format-Profil auf"
```

---

### Task 4: Migration verdrahten, alte Dateien entfernen

**Files:**
- Modify: `src/stores/migrate.js`
- Modify: `src/services/storage.js`
- Delete: `src/services/strategyStore.js`
- Delete: `src/services/strategyStore.test.js`

**Interfaces:**
- Consumes: `migrateLegacyProfile` aus `profileStore.js` (Task 1).

- [ ] **Step 1: Read current `migrate.js` and confirm the only caller of `migrateLegacyStrategy`**

Run: `grep -rn "migrateLegacyStrategy\|strategyStore" src/`
Expected: nur `src/stores/migrate.js` (Aufruf) und `src/services/strategyStore.js`/`strategyStore.test.js` (Definition/Test) — sonst keine Treffer.

- [ ] **Step 2: Update `src/stores/migrate.js`**

```js
// One-time migration from draft-helper-state-v3 (old monolithic key) to per-store keys.
// Called in main.jsx before React renders. Safe to call multiple times (idempotent).
import { migrateLegacyProfile } from '../services/profileStore'

export function migrateOldStorage() {
  migrateLegacyProfile()
}
```

(Vorherigen Body-Inhalt ansehen — falls dort noch weitere Migrationsschritte vor `migrateLegacyStrategy()` standen, diese Zeilen unverändert lassen und nur den `strategyStore`-Import/Aufruf durch `profileStore` ersetzen.)

- [ ] **Step 3: Remove `loadSetup`/`saveSetup`/`SETUP_KEY` from `src/services/storage.js`**

```js
// LocalStorage keys
export const STORAGE_KEY = 'draft-helper-state-v3'
export const THEME_STORAGE_KEY = 'draft-helper-theme' // 'dark' | 'light'

export const saveToLocalStorage = (partial) => {
  const previous = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  const next = { ...previous, ...partial }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

export const loadFromLocalStorage = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}
```

- [ ] **Step 4: Delete the superseded files**

```bash
git rm src/services/strategyStore.js src/services/strategyStore.test.js
```

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: PASS — kein verbliebener Import von `strategyStore` oder `loadSetup`/`saveSetup`/`SETUP_KEY` (werden erst in späteren Tasks entfernt; falls hier noch Referenzen aus `App.jsx`/`BoardSection.jsx`/`SetupForm.jsx` fehlschlagen, ist das erwartet und wird in Task 7–10 behoben — in diesem Fall diesen Schritt nur gegen `src/services/*.test.js` und `src/stores/*.test.js` laufen lassen: `npx vitest run src/services src/stores`).

- [ ] **Step 6: Commit**

```bash
git add src/stores/migrate.js src/services/storage.js
git commit -m "refactor(profiles): Migration auf profileStore umgestellt, strategyStore entfernt"
```

---

### Task 5: Icons ergänzen (`anchor`, `shuffle`)

**Files:**
- Modify: `src/components/Icon.jsx`

**Interfaces:**
- Produces: `<Icon name="anchor" />` (Liga-gebunden), `<Icon name="shuffle" />` (Format-gebunden) — genutzt in Task 6 (ProfileBadgeCard) und Task 10 (Board-Hinweis).

- [ ] **Step 1: Modify `Icon.jsx`**

```jsx
import {
  Sun, Moon, Palette, Bot, Key, RefreshCw, Save, Upload, ClipboardList, ClipboardCopy,
  Trophy, Star, X, Check, CircleCheck, ThumbsUp, Scale, Hammer, TriangleAlert,
  ArrowLeftRight, Search, Eye, EyeOff, ChartColumn, MessageCircle, Radio, Plus, ClipboardCheck,
  Home, Users, LayoutList, Zap, Menu, SlidersHorizontal, ArrowDownToLine, Settings,
  ChevronUp, ChevronDown, Trash2, Maximize2, Minimize2, Anchor, Shuffle,
} from 'lucide-react'

const MAP = {
  sun: Sun, moon: Moon, palette: Palette, bot: Bot, key: Key, refresh: RefreshCw,
  save: Save, upload: Upload, clipboard: ClipboardList, 'clipboard-copy': ClipboardCopy,
  'clipboard-check': ClipboardCheck, trophy: Trophy, star: Star, x: X, check: Check,
  'check-circle': CircleCheck, 'thumbs-up': ThumbsUp, scale: Scale, hammer: Hammer,
  warning: TriangleAlert, swap: ArrowLeftRight, search: Search, eye: Eye, 'eye-off': EyeOff,
  chart: ChartColumn, message: MessageCircle, radio: Radio, plus: Plus,
  home: Home, roster: Users, board: LayoutList, zap: Zap,
  menu: Menu, filter: SlidersHorizontal, 'arrow-down': ArrowDownToLine, settings: Settings,
  'chevron-up': ChevronUp, 'chevron-down': ChevronDown, 'trash-2': Trash2,
  maximize: Maximize2, minimize: Minimize2, anchor: Anchor, shuffle: Shuffle,
}

export default function Icon({ name, size = 18, label, className, strokeWidth = 2 }) {
  const C = MAP[name] || Star
  return (
    <C
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev` (oder `npm run dev:all`), `Icon`-Komponente irgendwo testweise mit `name="anchor"` rendern (z. B. temporär in `Topbar.jsx`), prüfen, dass ein Anker-Symbol erscheint, dann die Testzeile wieder entfernen.

- [ ] **Step 3: Commit**

```bash
git add src/components/Icon.jsx
git commit -m "feat(icons): anchor/shuffle fuer Profil-Badges ergaenzen"
```

---

### Task 6: `StrategySection.jsx` umschreiben — ein Strategie-Objekt pro Profil

**Files:**
- Modify: `src/components/StrategySection.jsx` (kompletter Ersatz)

**Interfaces:**
- Consumes: `callAiDraftStrategy` (bestehend, `../services/aiStrategyClient`, unverändert).
- Produces: Props `{ profile, onSaveStrategy(patch), principles, onSavePrinciples(text), format, season, draftMode, draftSlot }`. `onSaveStrategy`/`onSavePrinciples` sind Callbacks des Elternteils (`ProfileEditor`, Task 7) — diese Komponente hält keinen eigenen `localStorage`-Zugriff mehr.

- [ ] **Step 1: Replace `StrategySection.jsx`**

```jsx
import React, { useState } from 'react'
import { callAiDraftStrategy } from '../services/aiStrategyClient'

function scoringLabel(t) {
  if (t === 'half_ppr') return 'Half-PPR'
  if (t === 'standard') return 'Standard'
  return String(t || 'ppr').toUpperCase()
}

const EMPTY_STRATEGY = { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null }

export default function StrategySection({
  profile, onSaveStrategy, principles, onSavePrinciples,
  format, season, draftMode, draftSlot = null,
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)

  const strategy = profile?.strategy || EMPTY_STRATEGY
  const hasStrategy = !!(strategy.summary || strategy.rules?.length)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const { parsed } = await callAiDraftStrategy({ format, season, draftMode, draftSlot, principles })
      onSaveStrategy({
        summary: parsed.summary || '', rules: parsed.rules || [],
        sources: parsed.sources || [], contested: parsed.contested || [],
        source: 'ai', updatedAt: new Date().toISOString(),
      })
    } catch (e) {
      setError(e?.message || 'Strategie konnte nicht erzeugt werden')
    } finally {
      setBusy(false)
    }
  }

  function saveEdit(summary, rulesText) {
    onSaveStrategy({
      summary,
      rules: rulesText.split('\n').map(r => r.trim()).filter(Boolean),
      source: 'manual', updatedAt: new Date().toISOString(),
    })
    setEditing(false)
  }

  function remove() {
    if (!window.confirm('Diese Strategie wirklich löschen? Das kann nicht rückgängig gemacht werden.')) return
    onSaveStrategy({ ...EMPTY_STRATEGY })
  }

  return (
    <div className="strategy-section">
      <h3>Draft-Strategie</h3>

      <label className="muted" style={{ fontSize: 12 }}>Meine Grundsätze (gelten immer, für alle Profile)</label>
      <textarea
        className="control"
        rows={3}
        value={principles}
        onChange={e => onSavePrinciples(e.target.value)}
        placeholder="z. B. Defense wird gestreamt — letzter Pick oder gar nicht."
      />

      {!hasStrategy && (
        <p className="muted">
          Für dieses Profil ({format.teams} Teams, {scoringLabel(format.scoringType)}, {season}) ist
          noch keine Strategie hinterlegt.
        </p>
      )}

      {hasStrategy && (
        <div className="strategy-active">
          <div className="strategy-head">
            <strong>{profile.name}</strong>
            <span className="badge">{strategy.source === 'ai' ? 'KI-recherchiert' : 'manuell'}</span>
          </div>

          {editing ? (
            <EditForm strategy={strategy} onCancel={() => setEditing(false)} onSave={saveEdit} />
          ) : (
            <>
              <p>{strategy.summary}</p>
              <ul>{(strategy.rules || []).map((r, i) => <li key={i}>{r}</li>)}</ul>

              {strategy.contested?.length > 0 && (
                <div className="strategy-contested">
                  <strong>Uneinig in den Quellen:</strong>
                  <ul>{strategy.contested.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}

              {strategy.sources?.length > 0 && (
                <div className="strategy-sources">
                  <strong>Quellen:</strong>
                  <ul>
                    {strategy.sources.map((s, i) => (
                      <li key={i}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.title || s.url}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="strategy-actions">
        <button type="button" className="btn btn-primary" onClick={generate} disabled={busy}>
          {busy ? 'Recherchiere…' : hasStrategy ? 'Neu erzeugen (KI)' : 'Strategie erzeugen (KI)'}
        </button>
        {hasStrategy && !editing && (
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Bearbeiten</button>
        )}
        {hasStrategy && (
          <button type="button" className="btn btn-secondary" onClick={remove}>Löschen</button>
        )}
      </div>

      {busy && <p className="muted">Die KI durchsucht Experten-Quellen. Das dauert typischerweise 20–40 Sekunden.</p>}
    </div>
  )
}

function EditForm({ strategy, onCancel, onSave }) {
  const [summary, setSummary] = useState(strategy.summary)
  const [rules, setRules] = useState((strategy.rules || []).join('\n'))
  return (
    <div className="strategy-edit">
      <label className="muted" style={{ fontSize: 12 }}>Leitlinie</label>
      <textarea className="control" rows={2} value={summary} onChange={e => setSummary(e.target.value)} />
      <label className="muted" style={{ fontSize: 12 }}>Regeln (eine pro Zeile)</label>
      <textarea className="control" rows={6} value={rules} onChange={e => setRules(e.target.value)} />
      <div className="strategy-actions">
        <button type="button" className="btn btn-primary" onClick={() => onSave(summary, rules)}>Speichern</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification (kein Vitest — Komponente hat keine dedizierte Testdatei, wird in Task 7/8 im Kontext verdrahtet)**

Diesen Task erst nach Task 7 (ProfileEditor) im Browser prüfen — hier nur `npx vitest run src/components` laufen lassen, um sicherzustellen, dass kein anderer Test `StrategySection` importiert und an der alten Props-Signatur bricht.

Run: `grep -rln "StrategySection" src/`
Expected: nur `src/components/StrategySection.jsx` selbst und (nach Task 7) `src/components/ProfileEditor.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/StrategySection.jsx
git commit -m "refactor(profiles): StrategySection auf ein Strategie-Objekt pro Profil umgestellt"
```

---

### Task 7: `ProfileEditor.jsx` + `ProfileBadgeCard.jsx` (neue Komponenten)

**Files:**
- Create: `src/components/ProfileEditor.jsx`
- Create: `src/components/ProfileBadgeCard.jsx`

**Interfaces:**
- Consumes: `FORMAT_DEFAULTS`, `deriveFormat` (`../services/draftFormat`), `upsertProfileOverrides`, `upsertProfileStrategy`, `loadPrinciples`, `savePrinciples` (`../services/profileStore`), `StrategySection` (Task 6), `Icon` (Task 5).
- Produces: `<ProfileEditor profile detected strategyFormat season draftMode onProfileChange />`, `<ProfileBadgeCard profile deviations isNew allProfiles onRebind onManage />`.

- [ ] **Step 1: Create `ProfileEditor.jsx`**

```jsx
import React, { useState } from 'react'
import { FORMAT_DEFAULTS } from '../services/draftFormat'
import { upsertProfileOverrides, upsertProfileStrategy, loadPrinciples, savePrinciples } from '../services/profileStore'
import StrategySection from './StrategySection'

export default function ProfileEditor({ profile, detected, strategyFormat, season, draftMode, onProfileChange }) {
  const [showAdvancedFormat, setShowAdvancedFormat] = useState(false)
  const [principles, setPrinciples] = useState(() => loadPrinciples())

  const overrides = profile.overrides
  const eff = {
    scoring_type: overrides.scoring_type ?? detected.scoringType,
    superflex: overrides.superflex ?? detected.isSuperflex,
    teams: Number(overrides.teams ?? detected.teams) || FORMAT_DEFAULTS.teams,
    rounds: Number(overrides.rounds ?? detected.rounds) || FORMAT_DEFAULTS.rounds,
    type: String(overrides.type ?? detected.type).toLowerCase(),
  }

  function patchOverrides(patch) {
    const updated = upsertProfileOverrides(profile, patch)
    window.dispatchEvent(new CustomEvent('sdh:setup-changed', { detail: updated }))
    onProfileChange(updated)
  }

  function saveStrategy(strategyPatch) {
    const updated = upsertProfileStrategy(profile, strategyPatch)
    window.dispatchEvent(new CustomEvent('sdh:setup-changed', { detail: updated }))
    onProfileChange(updated)
  }

  function handlePrinciplesChange(text) {
    setPrinciples(text)
    savePrinciples(text)
    window.dispatchEvent(new CustomEvent('sdh:setup-changed'))
  }

  return (
    <div className="card profile-editor">
      <div className="collapse">
        <button
          type="button"
          className={`collapse-toggle ${showAdvancedFormat ? 'is-open' : ''}`}
          onClick={() => setShowAdvancedFormat(s => !s)}
        >
          Erkannt: {eff.teams} Teams · {eff.type} · {String(eff.scoring_type).toUpperCase()}
          {eff.superflex ? ' · Superflex' : ' · kein Superflex'} · Anpassen
        </button>
        {showAdvancedFormat && (
          <div className="collapse-body">
            <div className="form-row">
              <label className="field">
                <span>Scoring</span>
                <select
                  className="control"
                  value={overrides.scoring_type ?? detected.scoringType}
                  onChange={e => patchOverrides({ scoring_type: e.target.value || null })}
                >
                  <option value="ppr">PPR</option>
                  <option value="half_ppr">Half-PPR</option>
                  <option value="standard">Standard</option>
                </select>
                <div className="muted text-xs mt-1">Erkannt: {detected.scoringType || '—'} (Quelle: {detected.source})</div>
              </label>

              <label className="field">
                <span>Superflex</span>
                <select
                  className="control"
                  value={String(overrides.superflex ?? detected.isSuperflex)}
                  onChange={e => patchOverrides({ superflex: e.target.value === 'true' })}
                >
                  <option value="true">An</option>
                  <option value="false">Aus</option>
                </select>
                <div className="muted text-xs mt-1">Erkannt: {detected.isSuperflex ? 'Ja' : 'Nein'}</div>
              </label>
            </div>

            <div className="form-row">
              <label className="field">
                <span>Teams / Runden / Typ</span>
                <div className="row">
                  <input
                    className="control" type="number" min={2}
                    value={overrides.teams ?? detected.teams ?? FORMAT_DEFAULTS.teams}
                    onChange={e => patchOverrides({ teams: Number(e.target.value || 0) || null })}
                    aria-label="Teams" title="Teams"
                  />
                  <input
                    className="control" type="number" min={1}
                    value={overrides.rounds ?? detected.rounds ?? FORMAT_DEFAULTS.rounds}
                    onChange={e => patchOverrides({ rounds: Number(e.target.value || 0) || null })}
                    aria-label="Runden" title="Runden"
                  />
                  <select
                    className="control"
                    value={overrides.type ?? detected.type ?? FORMAT_DEFAULTS.type}
                    onChange={e => patchOverrides({ type: e.target.value || null })}
                    aria-label="Draft-Typ" title="Draft-Typ"
                  >
                    <option value="snake">Snake</option>
                    <option value="linear">Linear</option>
                    <option value="auction">Auction</option>
                  </select>
                </div>
                <div className="muted text-xs mt-1">Erkannt: {(detected.teams ?? '—')} Teams · {(detected.rounds ?? '—')} Runden · {(detected.type || '—')}</div>
              </label>
            </div>

            <label className="field">
              <span>Roster-Positionen (Override — optional)</span>
              <div className="muted text-xs mb-1">Erkannt:</div>
              <div className="chips">
                {(detected.rosterPositions || []).map((r, i) => <span key={i} className="chip chip--small">{r}</span>)}
              </div>
              <textarea
                rows={2}
                placeholder="Optionaler Override, kommagetrennt: QB,RB,RB,WR,WR,TE,FLEX,SUPER_FLEX"
                defaultValue=""
                onBlur={(e) => {
                  const raw = (e.target.value || '').trim()
                  if (!raw) { patchOverrides({ roster_positions: null }); return }
                  const arr = raw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                  patchOverrides({ roster_positions: arr.length ? arr : null })
                }}
              />
              <div className="muted text-xs mt-1">
                Effektiv: {(overrides.roster_positions ?? detected.rosterPositions)?.join(', ') || '—'}
              </div>
              <div className="row mt-2">
                <button
                  type="button" className="btn btn-secondary control"
                  onClick={() => patchOverrides({
                    scoring_type: FORMAT_DEFAULTS.scoringType, superflex: false,
                    roster_positions: FORMAT_DEFAULTS.rosterPositions,
                    teams: FORMAT_DEFAULTS.teams, rounds: FORMAT_DEFAULTS.rounds, type: FORMAT_DEFAULTS.type,
                  })}
                >
                  Standardwerte übernehmen
                </button>
                <span className="muted text-xs">Standard: 12 Teams · Snake · PPR · kein Superflex · Roster: QB, 2×RB, 2×WR, TE, FLEX, DEF; 6×BN</span>
              </div>
            </label>
          </div>
        )}
      </div>

      <StrategySection
        profile={profile}
        onSaveStrategy={saveStrategy}
        principles={principles}
        onSavePrinciples={handlePrinciplesChange}
        format={{
          teams: strategyFormat.teams, scoringType: strategyFormat.scoringType,
          superflex: strategyFormat.isSuperflex, rosterPositions: strategyFormat.rosterPositions,
        }}
        season={season}
        draftMode={draftMode}
        draftSlot={null}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `ProfileBadgeCard.jsx`**

```jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'

export default function ProfileBadgeCard({ profile, deviations, isNew, allProfiles, onRebind, onRename }) {
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(profile.name)

  const isLeagueBound = !!profile.boundLeagueId
  const otherProfiles = (allProfiles || []).filter(p => p.id !== profile.id)

  return (
    <div className="card profile-badge-card">
      <div className="profile-badge-row">
        <Icon name={isLeagueBound ? 'anchor' : 'shuffle'} size={16} label={isLeagueBound ? 'Liga-gebunden' : 'Format-gebunden'} />
        {renaming ? (
          <input
            className="control control--sm"
            value={nameInput}
            autoFocus
            onChange={e => setNameInput(e.target.value)}
            onBlur={() => { onRename(nameInput); setRenaming(false) }}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
          />
        ) : (
          <button type="button" className="profile-badge-name" onClick={() => setRenaming(true)} title="Umbenennen">
            {profile.name}
          </button>
        )}
        <span className="badge badge--neutral">{isLeagueBound ? 'Liga-gebunden' : 'Format-gebunden'}</span>
        {isNew && <span className="badge badge--info">Neu erkannt</span>}
      </div>

      {deviations?.length > 0 && (
        <p className="form-error">
          Achtung: dieser Draft weicht vom gespeicherten Profil ab — {deviations.join('; ')}
        </p>
      )}

      <div className="row profile-badge-actions">
        {otherProfiles.length > 0 && (
          <select
            className="control control--sm"
            value=""
            onChange={e => { if (e.target.value) onRebind(e.target.value) }}
          >
            <option value="">Anderes Profil verwenden…</option>
            {otherProfiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/profiles', { state: { focusProfileId: profile.id } })}>
          Profil verwalten
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2b: Add minimal CSS for the new classes**

**Files:** Modify: `src/styles/style.css` (an geeigneter Stelle bei den bestehenden `.card`/`.badge`-Regeln ergänzen — Datei vorher mit `grep -n "\.badge--info\|\.profile-" src/styles/style.css` prüfen, ob `.badge--info` schon existiert).

```css
.profile-badge-row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.profile-badge-name { background: none; border: none; padding: 0; font: inherit; font-weight: 600; cursor: pointer; color: inherit; }
.profile-badge-actions { margin-top: 0.5rem; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; }
```

Falls `.badge--info` in `style.css` noch nicht existiert, zusätzlich (Farbe an bestehende `.badge--warn`/`.badge--neutral`-Definitionen angleichen, gleiche Datei, gleicher Block):

```css
.badge--info { background: var(--color-info-bg, rgba(90, 150, 255, 0.15)); color: var(--color-info-text, #7fb3ff); }
```

- [ ] **Step 3: Manual verification**

Diese beiden Komponenten werden erst in Task 8 (SetupForm/SetupPage) tatsächlich gerendert — hier nur sicherstellen, dass die Datei syntaktisch fehlerfrei ist:

Run: `npx vite build --mode development 2>&1 | grep -i "ProfileEditor\|ProfileBadgeCard"`
Expected: keine Fehlermeldung zu den beiden neuen Dateien (Build kann an anderer Stelle noch fehlschlagen, so lange App.jsx/SetupForm.jsx noch nicht angepasst sind — das ist in diesem Task erwartet).

- [ ] **Step 4: Commit**

```bash
git add src/components/ProfileEditor.jsx src/components/ProfileBadgeCard.jsx src/styles/style.css
git commit -m "feat(profiles): ProfileEditor + ProfileBadgeCard Komponenten"
```

---

### Task 8: `SetupForm.jsx` / `SetupPage.jsx` — Akkordeon auflösen, Profil einhängen

**Files:**
- Modify: `src/components/SetupForm.jsx`
- Modify: `src/pages/SetupPage.jsx`

**Interfaces:**
- Consumes: `resolveProfile`, `loadProfiles`, `rebindProfile`, `renameProfile` (`../services/profileStore`), `ProfileBadgeCard`, `ProfileEditor` (Task 7).
- Produces: `SetupPage` löst `profile` pro aktivem Liga/Draft-Kontext auf und reicht `profile`, `profileDeviations`, `isNewProfile`, `allProfiles`, `onProfileChange`, `onRebindProfile`, `onRenameProfile` an `SetupForm` durch.

- [ ] **Step 1: Modify `SetupPage.jsx`**

Ergänze die Imports und löse das Profil im Funktionskörper auf (vor dem `return`, nach den bestehenden Hooks):

```js
// Import-Block ergänzen
import { resolveProfile, loadProfiles, rebindProfile, renameProfile } from '../services/profileStore'
import { useState as useStateAlias } from 'react' // NICHT nötig -- useState ist schon importiert, siehe unten
```

(Hinweis: `useState` ist in `SetupPage.jsx` bereits importiert — die zweite Zeile oben NICHT hinzufügen, sie dient nur der Klarstellung im Plan. Nur die erste `profileStore`-Importzeile ergänzen.)

Im Komponentenkörper, direkt nach der bestehenden `useBoardStore`-Destrukturierung:

```js
const [profileTick, setProfileTick] = useState(0)
const resolved = useMemo(
  () => resolveProfile({ draft: selectedDraft, league: selectedLeague, draftMode }),
  [selectedDraft, selectedLeague, draftMode, profileTick]
)
const allProfiles = useMemo(() => loadProfiles(), [profileTick])

function handleProfileChange() {
  setProfileTick(t => t + 1)
}

function handleRebindProfile(targetProfileId) {
  if (resolved.profile.boundLeagueId) {
    rebindProfile(targetProfileId, { leagueId: resolved.profile.boundLeagueId })
  } else {
    rebindProfile(targetProfileId, { fingerprint: resolved.profile.fingerprint })
  }
  setProfileTick(t => t + 1)
}

function handleRenameProfile(name) {
  // Ein noch nicht persistiertes (isNew) Profil existiert erst nach dem ersten
  // Override-/Strategie-Edit in der DB -- vorher gibt es nichts umzubenennen.
  if (resolved.isNew) return
  renameProfile(resolved.profile.id, name)
  setProfileTick(t => t + 1)
}
```

`useMemo` und `useState` müssen im Import-Header von `SetupPage.jsx` vorhanden sein — aktuell importiert die Datei nur `{ useEffect, useState }` von `react` (siehe Datei-Kopf); `useMemo` ergänzen: `import { useEffect, useMemo, useState } from 'react'`.

Erweitere den `<SetupForm ...>`-Aufruf um die neuen Props:

```jsx
<SetupForm
  {/* ...bestehende Props unveraendert... */}
  profile={resolved.profile}
  profileDeviations={resolved.deviations}
  isNewProfile={resolved.isNew}
  allProfiles={allProfiles}
  onProfileChange={handleProfileChange}
  onRebindProfile={handleRebindProfile}
  onRenameProfile={handleRenameProfile}
/>
```

- [ ] **Step 2: Modify `SetupForm.jsx` — Imports und Props**

Entferne die Imports `loadSetup, saveSetup` und `deriveFormat, FORMAT_DEFAULTS` (letzterer wandert komplett nach `ProfileEditor.jsx`), ergänze:

```js
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deriveFormat } from '../services/draftFormat'
import { loadPreferences, clearPreferencesForMode } from '../services/preferences'
import ProfileBadgeCard from './ProfileBadgeCard'
import ProfileEditor from './ProfileEditor'
import SyncSection from './SyncSection'
import Icon from './Icon'
```

Props-Destrukturierung ergänzen:

```js
export default function SetupForm(props) {
  const {
    sleeperUsername, sleeperUserId, seasonYear,
    availableLeagues, selectedLeagueId,
    availableDrafts, selectedDraftId, leaguesById,
    manualDraftInput, csvRawText, isAndroid,
    setSleeperUsername, setSleeperUserId, setSeasonYear,
    setSelectedLeagueId, setSelectedDraftId, setManualDraftInput, setCsvRawText,
    saveToLocalStorage, resolveUserId, loadLeagues, loadDraftOptions,
    attachDraftByIdOrUrl, handleCsvLoad, handleAutoImport, handleFantasyProsImport, handleKtcRookieImport, formatDraftLabel,
    draftMode, setDraftMode, selectedLeague: selectedLeagueProp,
    profile, profileDeviations, isNewProfile, allProfiles,
    onProfileChange, onRebindProfile, onRenameProfile,
  } = props
```

- [ ] **Step 3: Remove old override state and replace `detected`/`strategyFormat`**

Entferne komplett (aus dem ursprünglichen `SetupForm.jsx`):
- `const [overrides, setOverrides] = useState(...)`
- Den `useEffect`, der `saveSetup({ overrides })` aufruft
- Die manuelle `eff`-Objekt-Konstruktion

Ersetze durch:

```js
const detected = useMemo(
  () => deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: {} }),
  [selectedDraft, selectedLeague]
)

const resolvedFormat = useMemo(
  () => deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: profile.overrides }),
  [selectedDraft, selectedLeague, profile.overrides]
)

const eff = {
  teams: resolvedFormat.teams, type: resolvedFormat.type,
  scoring_type: resolvedFormat.scoringType, superflex: resolvedFormat.isSuperflex,
}
```

(`selectedDraft`/`selectedLeague` werden weiterhin oben in der Komponente aus `availableDrafts`/`availableLeagues` per `useMemo` abgeleitet — dieser Teil bleibt unverändert.)

- [ ] **Step 4: Flatten the accordion — remove `openStep`/`isStepOpen`, render plain cards**

Entferne `const [openStep, setOpenStep] = useState(...)` und `const isStepOpen = (n) => openStep === n`. Ersetze den gesamten `<div className="setup-steps">...</div>`-Block (STEP 1 + STEP 2) durch nicht geschachtelte Karten:

```jsx
      <div className="card">
        <h3>Liga & Draft</h3>
        <div className="form-row">
          <label className="field">
            <span>Liga</span>
            <div className="row">
              <select
                className="control"
                value={selectedLeagueId || ''}
                onChange={(e) => {
                  const val = e.target.value
                  setSelectedLeagueId(val)
                  saveToLocalStorage({ leagueId: val })
                  if (val) loadDraftOptions(val)
                }}
              >
                <option value="">— keine —</option>
                {(availableLeagues || []).map(l => (
                  <option key={l.league_id} value={l.league_id}>{l.name || l.league_id}</option>
                ))}
              </select>
              <button className="btn btn-secondary control" disabled={busyResolveAndLoad} onClick={handleResolveAndLoad} title="Ligen erneut von Sleeper laden">
                {busyResolveAndLoad ? '…' : 'Ligen neu laden'}
              </button>
            </div>
          </label>

          <label className="field">
            <span>Draft</span>
            <div className="row">
              <select
                className="control"
                value={selectedDraftId || ''}
                onChange={(e) => { const val = e.target.value; setSelectedDraftId(val); saveToLocalStorage({ draftId: val }) }}
              >
                <option value="" disabled>— auswählen —</option>
                {(availableDrafts || []).map(d => (
                  <option key={d.draft_id} value={d.draft_id}>{formatDraftLabel ? formatDraftLabel(d, leaguesById || new Map()) : (d?.metadata?.name || d.draft_id)}</option>
                ))}
              </select>
              <button
                className="btn btn-secondary control"
                onClick={async () => {
                  if (!selectedLeagueId) { setFormError('Wähle zuerst eine Liga — oder hänge den Draft unten per ID/Link an.'); return }
                  setFormError(null)
                  try { await loadDraftOptions(selectedLeagueId) } catch (e) { setFormError(`Drafts konnten nicht geladen werden: ${e?.message || e}. Prüfe deine Verbindung und versuche es erneut.`) }
                }}
              >
                Drafts neu laden
              </button>
            </div>

            <div className="collapse">
              <button type="button" className={`collapse-toggle ${showAttachAlt ? 'is-open' : ''}`} onClick={() => setShowAttachAlt(s => !s)}>
                {showAttachAlt ? 'Ausblenden' : 'Draft per ID/Link anhängen'}
              </button>
              {showAttachAlt && (
                <div className="collapse-body">
                  <div className="row">
                    <input
                      className="control"
                      value={manualDraftInput || ''}
                      onChange={(e) => setManualDraftInput(e.target.value)}
                      placeholder="https://sleeper.com/draft/nfl/123... oder 123..."
                    />
                    <button
                      className="btn btn-primary control"
                      onClick={async () => {
                        if (!manualDraftInput) return
                        setFormError(null)
                        try {
                          const ok = await attachDraftByIdOrUrl(manualDraftInput)
                          if (ok) { setManualDraftInput(''); saveToLocalStorage({ manualDraftInput: '' }) }
                          else setFormError('Kein Draft unter dieser ID/diesem Link gefunden — prüfe, ob er auf einen Sleeper-Draft zeigt (sleeper.com/draft/nfl/…).')
                        } catch (e) { setFormError(`Draft konnte nicht angehängt werden: ${e?.message || e}.`) }
                      }}
                    >
                      Anhängen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </label>

          <label className="field">
            <span>Draft-Modus</span>
            <div className="row">
              {['redraft', 'rookie'].map(mode => (
                <label key={mode} className="radio-option" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                  <input type="radio" name="draftMode" value={mode} checked={draftMode === mode} onChange={() => setDraftMode(mode)} />
                  {mode === 'redraft' ? 'Redraft' : 'Rookie Draft (Dynasty)'}
                </label>
              ))}
            </div>
            {selectedLeague?.league_type === 'dynasty' && draftMode === 'redraft' && (
              <div className="muted text-xs mt-1">Dynasty-Liga erkannt — Rookie Draft empfohlen</div>
            )}
            {selectedLeague?.league_type && selectedLeague.league_type !== 'dynasty' && draftMode === 'rookie' && (
              <div className="muted text-xs mt-1">Erkannt: {selectedLeague.league_type}</div>
            )}
          </label>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button" className="btn-compact btn-icon" onClick={handleClearMarkings}
            title={`Alle Fav/Avoid-Markierungen für ${draftMode === 'rookie' ? 'Rookie Draft' : 'Redraft'} löschen`}
            aria-label="Markierungen löschen"
          >
            <Icon name="trash-2" size={14} />
          </button>
        </div>
      </div>

      <ProfileBadgeCard
        profile={profile}
        deviations={profileDeviations}
        isNew={isNewProfile}
        allProfiles={allProfiles}
        onRebind={onRebindProfile}
        onRename={onRenameProfile}
      />

      <ProfileEditor
        profile={profile}
        detected={detected}
        strategyFormat={resolvedFormat}
        season={seasonYear}
        draftMode={draftMode}
        onProfileChange={onProfileChange}
      />

      <div className="card">
        <h3>Rankings importieren</h3>
        {draftMode !== 'rookie' && (
          <div className="form-row">
            <label className="field">
              <span>Auto-Import – Quelle wählen</span>
              <div className="muted text-xs mb-1">Rangliste direkt importieren, ADP &amp; Byes inklusive – kein CSV nötig.</div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-primary control" disabled={busyFpImport || busyAutoImport}
                  onClick={async () => { setBusyFpImport(true); try { await handleFantasyProsImport() } finally { setBusyFpImport(false) } }}
                >
                  {busyFpImport ? 'Wird geladen…' : `FantasyPros (${fpScoringLabel(eff.scoring_type)} ECR)`}
                </button>
                <button
                  className="btn btn-secondary control" disabled={busyAutoImport || busyFpImport}
                  onClick={async () => { setBusyAutoImport(true); try { await handleAutoImport() } finally { setBusyAutoImport(false) } }}
                >
                  {busyAutoImport ? 'Wird geladen…' : 'FantasyCalc'}
                </button>
              </div>
            </label>
          </div>
        )}
        {draftMode === 'rookie' && (
          <div className="form-row">
            <label className="field">
              <span>Auto-Import – Quelle wählen</span>
              <div className="muted text-xs mb-1">Rookie-Rankings direkt importieren – kein CSV nötig. Wähle eine Quelle:</div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="btn btn-primary control" disabled={busyKtcImport || busyAutoImport}
                  onClick={async () => { setBusyKtcImport(true); try { await handleKtcRookieImport() } finally { setBusyKtcImport(false) } }}
                >
                  {busyKtcImport ? 'Wird geladen…' : 'KTC Rookies'}
                </button>
                <button
                  className="btn btn-secondary control" disabled={busyAutoImport || busyKtcImport}
                  onClick={async () => { setBusyAutoImport(true); try { await handleAutoImport() } finally { setBusyAutoImport(false) } }}
                >
                  {busyAutoImport ? 'Wird geladen…' : 'FantasyCalc'}
                </button>
              </div>
            </label>
          </div>
        )}
        <div className="form-row">
          <label className="field">
            <span>FantasyPros CSV (file)</span>
            {draftMode === 'rookie' && (
              <div className="muted text-xs mb-1">Rookie-Modus: Lade ein Rookie-Only-Ranking hoch (z.B. FantasyPros Dynasty Rookies)</div>
            )}
            <div className="row">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileChange} />
              <button className="btn btn-primary control" onClick={() => fileRef.current?.click()}>CSV-Datei wählen</button>
              <span className="muted text-ellipsis" title={csvFileName}>{csvFileName || 'Keine Datei gewählt'}</span>
            </div>
            <div className="collapse">
              <button type="button" className={`collapse-toggle ${showCsvAdvanced ? 'is-open' : ''}`} onClick={() => setShowCsvAdvanced(s => !s)}>
                {showCsvAdvanced ? 'Einfügefeld ausblenden' : 'CSV-Text einfügen'}
              </button>
              {showCsvAdvanced && (
                <div className="collapse-body">
                  <textarea
                    value={csvRawText || ''} spellCheck={false}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    placeholder="CSV-Inhalt hier einfügen…"
                    rows={isAndroid ? 6 : 8}
                  />
                  <div className="row">
                    <button className="btn btn-primary control" onClick={() => handleCsvLoad()}>CSV laden</button>
                    <button className="btn btn-secondary control" onClick={() => { setCsvRawText(''); saveToLocalStorage({ csvRawText: '' }); setCsvFileName('') }}>Leeren</button>
                  </div>
                </div>
              )}
            </div>
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => navigate('/board')}>Fertig → Board</button>
        </div>
      </div>
```

(Der `return`-Rahmen davor — `<section className="card"><h2>Setup</h2>...<div className="summary-card summary-card--sticky">...</div>` — bleibt unverändert; der `eff`-Zugriff im `summary-grid` auf `eff.scoring_type`/`eff.superflex` funktioniert weiter, da `eff` oben identisch benannt neu aufgebaut wird.)

- [ ] **Step 5: Update `SetupPage.test.jsx` mock**

`SetupForm` wird weiterhin komplett gemockt (`vi.mock('../components/SetupForm', ...)`) — der bestehende Mock ruft nur `props.handleCsvLoad`/`props.handleAutoImport` auf und bleibt unverändert gültig, da diese Props unangetastet blieben. Kein Änderungsbedarf an der Testdatei.

Run: `npx vitest run src/pages/SetupPage.test.jsx`
Expected: PASS (unverändert, da SetupForm gemockt bleibt)

- [ ] **Step 6: Run full test suite + manual browser check**

Run: `npm test`
Expected: PASS für alle Tests außerhalb von `App.jsx`/`BoardSection.jsx` (die werden erst in Task 9/10 fertig verdrahtet — falls hier noch Fehler aus diesen beiden Dateien auftreten, ist das bis Task 10 erwartet).

Danach im Browser (`npm run dev:all`, `/setup` öffnen): Liga wählen → Format-Override ändern (z. B. Superflex an) → Seite neu laden → Override muss erhalten bleiben und nur für DIESE Liga gelten (zweite Liga wählen → Override darf dort nicht auftauchen).

- [ ] **Step 7: Commit**

```bash
git add src/components/SetupForm.jsx src/pages/SetupPage.jsx
git commit -m "refactor(setup): Akkordeon aufgeloest, Profil-Karte + ProfileEditor eingehaengt"
```

---

### Task 9: `App.jsx` — `resolveProfile` statt `loadSetup`

**Files:**
- Modify: `src/App.jsx:14,118,130-133,242-252`

**Interfaces:**
- Consumes: `resolveProfile` aus `../services/profileStore` (ersetzt `loadSetup` aus `../services/storage`).

- [ ] **Step 1: Update the import**

Zeile 14 ändern von:
```js
import { loadSetup } from './services/storage'
```
zu:
```js
import { resolveProfile } from './services/profileStore'
```

- [ ] **Step 2: Replace the `setupOverrides` memo**

Zeile 118 ändern von:
```js
const setupOverrides = useMemo(() => loadSetup()?.overrides || {}, [setupVersion])
```
zu:
```js
const resolvedProfile = useMemo(
  () => resolveProfile({ draft: selectedDraft, league: selectedLeague, draftMode }),
  [selectedDraft, selectedLeague, draftMode, setupVersion]
)
const setupOverrides = resolvedProfile.profile.overrides
```

(`selectedDraft`/`selectedLeague`/`draftMode` sind an dieser Stelle bereits weiter oben in `App.jsx` definiert — keine neuen Variablen nötig.)

- [ ] **Step 3: `strategies`-Zugriff bleibt unverändert**

Zeilen 128–134 (`const strategies = useMemo(() => Array.isArray(setupOverrides.strategies) ...)`) bleiben exakt wie sie sind — `setupOverrides` zeigt jetzt auf `resolvedProfile.profile.overrides`, das Feld `strategies` existiert dort weiterhin (Default `['balanced']`, siehe `profileStore.js` `EMPTY_OVERRIDES`).

- [ ] **Step 4: Update the storage-key filter**

Zeilen 242–252 ändern von:
```js
  // Setup change listener (SetupForm writes sdh.setup.v2 and fires this event)
  useEffect(() => {
    const onSetup = () => incrementSetupVersion()
    const onStorage = (e) => { if (e.key === 'sdh.setup.v2') onSetup() }
    window.addEventListener('sdh:setup-changed', onSetup)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('sdh:setup-changed', onSetup)
      window.removeEventListener('storage', onStorage)
    }
  }, []) // eslint-disable-line
```
zu:
```js
  // Setup change listener (ProfileEditor writes sdh.profiles.v1 and fires this event)
  useEffect(() => {
    const onSetup = () => incrementSetupVersion()
    const onStorage = (e) => { if (e.key === 'sdh.profiles.v1' || e.key === 'sdh.strategyPrinciples.v1') onSetup() }
    window.addEventListener('sdh:setup-changed', onSetup)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('sdh:setup-changed', onSetup)
      window.removeEventListener('storage', onStorage)
    }
  }, []) // eslint-disable-line
```

- [ ] **Step 5: Run tests and manually verify**

Run: `npx vitest run src/App.test.jsx` (falls vorhanden — sonst `grep -rn "App.test" src/` prüfen, ob es eine gibt; falls nicht, diesen Schritt überspringen und stattdessen `npm test` laufen lassen).

Im Browser: Board öffnen, Tipps müssen weiterhin auf Basis der pro-Liga aufgelösten Overrides erscheinen (z. B. Superflex-Override in Setup ändern → Board-Tipps/Format sofort aktualisiert, wie vor dem Umbau über `sdh:setup-changed`).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "refactor(profiles): App.jsx loest Format ueber resolveProfile statt globalem Setup-Key auf"
```

---

### Task 10: `BoardSection.jsx` — `resolveProfile` + Profil-Hinweis auf dem Board

**Files:**
- Modify: `src/components/BoardSection.jsx:12-13,127,140,208-236`

**Interfaces:**
- Consumes: `resolveProfile`, `resolveStrategyText` (`resolveStrategyText` jetzt aus `strategyMatch.js` mit neuer Signatur), `loadPrinciples` (`../services/profileStore`).
- Produces: kompakter Profil-Hinweis (Name + Abweichungswarnung) sichtbar während des Draftens.

- [ ] **Step 1: Update imports**

Zeilen 12–13 ändern von:
```js
import { makeFingerprint, resolveStrategyText } from '../services/strategyMatch'
import { loadStrategies } from '../services/strategyStore'
```
zu:
```js
import { resolveStrategyText } from '../services/strategyMatch'
import { resolveProfile, loadPrinciples } from '../services/profileStore'
```

- [ ] **Step 2: Replace the raw `setupOverrides` read**

Zeile 140 ändern von:
```js
  const setupOverrides = (() => { try { return JSON.parse(localStorage.getItem('sdh.setup.v2') || '{}').overrides || {} } catch { return {} } })()
```
zu:
```js
  const resolvedProfile = useMemo(
    () => resolveProfile({ draft, league, draftMode }),
    [draft, league, draftMode, setupTick]
  )
  const { profile, deviations: profileDeviations } = resolvedProfile
  const setupOverrides = profile.overrides
```

(`useMemo` ist in dieser Datei bereits importiert — siehe bestehende Nutzung weiter unten für `customStrategyText`.)

- [ ] **Step 3: Simplify `customStrategyText` — no more re-computed fingerprint**

Zeilen 208–236 ändern von:
```js
  // Das ganze Format, nicht nur der Kader: scoringType und isSuperflex gingen
  // hier verloren, sodass die AI beim Mock immer den PPR-Default und "1 QB"
  // beschrieben bekam — und Setup-Overrides gar nicht sah.
  const draftFormat = deriveFormat({ draft, league, overrides: setupOverrides })
  const { rosterPositions } = draftFormat

  // Ersetzt den fruehen globalen Freitext: die Strategie wird jetzt nach
  // Liga-Format ausgewaehlt (siehe strategyMatch.js).
  const customStrategyText = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const fp = makeFingerprint({
      format: {
        // teamsCount (getTeamsCount) ignoriert sdh.setup.v2-Overrides und
        // liefert 0, wenn unbekannt -- draftFormat.teams ist override-aware
        // und identisch zu dem, was Setup fuer denselben Fingerprint nutzt.
        teams: draftFormat.teams,
        scoringType: draftFormat.scoringType,
        superflex: draftFormat.isSuperflex,
        rosterPositions,
      },
      season: seasonYear,
      draftMode,
    })
    return resolveStrategyText(loadStrategies(), fp)
  // setupTick mit in den Deps: loadStrategies() liest localStorage, und das
  // aendert sich auch ohne Formatwechsel — durch einen Sync-Pull oder durch
  // Bearbeiten im Setup.
  }, [draftFormat.teams, draftFormat.scoringType, draftFormat.isSuperflex,
      JSON.stringify(rosterPositions), seasonYear, draftMode, setupTick])
```
zu:
```js
  // Das ganze Format, nicht nur der Kader: scoringType und isSuperflex gingen
  // hier verloren, sodass die AI beim Mock immer den PPR-Default und "1 QB"
  // beschrieben bekam — und Setup-Overrides gar nicht sah.
  const draftFormat = deriveFormat({ draft, league, overrides: setupOverrides })
  const { rosterPositions } = draftFormat

  // Matching passiert jetzt einmalig in resolveProfile() (Liga-ID/Fingerprint) —
  // hier nur noch principles + profile.strategy zu Text zusammensetzen.
  const customStrategyText = useMemo(
    () => resolveStrategyText(loadPrinciples(), profile.strategy),
    [profile.strategy, setupTick]
  )
```

- [ ] **Step 4: Update the `setupTick` storage-key filter**

Suche die `setupTick`-Effect-Definition (nahe Zeile 127–137) und ändere den Key-Filter analog zu Task 9:

```js
  useEffect(() => {
    const onSetup = () => setSetupTick(x => x + 1)
    const onStorage = (e) => { if (e.key === 'sdh.profiles.v1' || e.key === 'sdh.strategyPrinciples.v1') onSetup() }
    window.addEventListener('sdh:setup-changed', onSetup)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('sdh:setup-changed', onSetup)
      window.removeEventListener('storage', onStorage)
    }
  }, [])
```

- [ ] **Step 5: Add the profile indicator to the JSX**

Finde in `BoardSection.jsx` die bestehende Warnbanner-Stelle für `boardTypeMismatch` (Zeile ~259 laut Lesevorgang: `const boardTypeMismatch = boardMode != null && hasBoard && boardMode !== draftMode`) und deren zugehöriges Render-Fragment weiter unten in der `return`-JSX (mit `grep -n "boardTypeMismatch" src/components/BoardSection.jsx` die genaue Render-Stelle finden). Füge unmittelbar davor ein neues, gleich gestaltetes Hinweis-Fragment ein:

```jsx
{profileDeviations?.length > 0 && (
  <div className="board-notice board-notice--warn">
    <Icon name="warning" size={14} />
    <span>
      Profil „{profile.name}" weicht ab: {profileDeviations.join('; ')} —{' '}
      <a href="/setup" onClick={(e) => { e.preventDefault(); navigate('/setup') }}>Setup öffnen</a>
    </span>
  </div>
)}
```

(Falls `navigate` in `BoardSection.jsx` noch nicht importiert ist: `grep -n "useNavigate" src/components/BoardSection.jsx` prüfen — falls fehlend, `import { useNavigate } from 'react-router-dom'` ergänzen und `const navigate = useNavigate()` am Komponentenanfang hinzufügen. Falls bereits vorhanden, wiederverwenden.)

Ergänze passendes CSS in `src/styles/style.css` (analog zu bestehenden `.import-error-banner`/`.form-error`-Regeln — vorher mit `grep -n "board-notice\|import-error-banner" src/styles/style.css` prüfen, ob ein wiederverwendbares Muster existiert, statt eine neue Klasse zu duplizieren):

```css
.board-notice { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
.board-notice--warn { background: var(--color-warn-bg, rgba(255, 180, 60, 0.15)); color: var(--color-warn-text, #ffb43c); }
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run src/components/BoardSection.advice-cache.test.jsx src/components/BoardSection.mismatch.test.jsx src/components/BoardSection.empty.test.jsx`
Expected: PASS — keine dieser Testdateien referenziert `sdh.setup.v2`/`strategyStore` direkt (siehe Recherche in Task-Vorbereitung), sollten also ohne Anpassung durchlaufen. Falls eine Testdatei doch bricht (z. B. weil sie `draft`/`league` als `undefined` rendert und `resolveProfile` damit nicht umgehen kann), Fehlermeldung lesen und `resolveProfile` defensiv gegen `draft=null, league=null` prüfen (ist in Task 3 bereits abgedeckt: `isStandaloneDraft(null)` liefert `false`, `deriveFormat` mit allen `null`-Werten liefert `FORMAT_DEFAULTS` — sollte bereits robust sein).

Run: `npm test`
Expected: PASS (gesamte Suite)

- [ ] **Step 7: Manual browser verification**

`npm run dev:all`, Mock-Draft mit 10 Teams anhängen, im Setup ein Format-Override setzen, das nicht zum tatsächlich erkannten Format passt (z. B. Teams-Override auf 8 bei einem 10-Team-Mock) → auf `/board` wechseln → Warnhinweis mit Abweichung muss erscheinen.

- [ ] **Step 8: Commit**

```bash
git add src/components/BoardSection.jsx src/styles/style.css
git commit -m "feat(profiles): BoardSection nutzt resolveProfile, zeigt Profil-Abweichung waehrend des Draftens"
```

---

### Task 11: `/profiles`-Seite (Profile-Hub)

**Files:**
- Create: `src/pages/ProfilesPage.jsx`
- Modify: `src/App.jsx` (Route ergänzen)

**Interfaces:**
- Consumes: `loadProfiles`, `renameProfile`, `duplicateProfile`, `deleteProfile`, `createBlankProfile` (`../services/profileStore`), `ProfileEditor` (Task 7), `Icon`.

- [ ] **Step 1: Create `ProfilesPage.jsx`**

```jsx
import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FORMAT_DEFAULTS } from '../services/draftFormat'
import { loadProfiles, renameProfile, duplicateProfile, deleteProfile, createBlankProfile } from '../services/profileStore'
import Icon from '../components/Icon'
import ProfileEditor from '../components/ProfileEditor'

function scoringLabel(t) {
  if (t === 'half_ppr') return 'Half-PPR'
  if (t === 'standard') return 'Standard'
  return String(t || 'ppr').toUpperCase()
}

function formatSummary(profile) {
  const o = profile.overrides || {}
  const fp = profile.fingerprint
  const teams = o.teams ?? fp?.teams ?? FORMAT_DEFAULTS.teams
  const scoring = o.scoring_type ?? fp?.scoringType ?? FORMAT_DEFAULTS.scoringType
  const superflex = o.superflex ?? fp?.superflex ?? false
  return `${teams} Teams · ${scoringLabel(scoring)}${superflex ? ' · Superflex' : ''}`
}

export default function ProfilesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [tick, setTick] = useState(0)
  const [expandedId, setExpandedId] = useState(location.state?.focusProfileId || null)
  const [newName, setNewName] = useState('')

  const profiles = useMemo(() => loadProfiles(), [tick])
  const refresh = () => setTick(t => t + 1)

  function handleRename(id, name) {
    renameProfile(id, name)
    refresh()
  }

  function handleDuplicate(id) {
    const copy = duplicateProfile(id)
    refresh()
    if (copy) setExpandedId(copy.id)
  }

  function handleDelete(id, name) {
    if (!window.confirm(`Profil "${name}" wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return
    deleteProfile(id)
    if (expandedId === id) setExpandedId(null)
    refresh()
  }

  function handleCreate() {
    const created = createBlankProfile(newName)
    setNewName('')
    refresh()
    setExpandedId(created.id)
  }

  if (!profiles.length) {
    return (
      <section className="card profiles-empty">
        <div className="dashboard-empty-icon"><Icon name="shuffle" size={40} /></div>
        <h2>Noch keine Profile</h2>
        <p className="muted">
          Profile bündeln Format-Einstellungen und Draft-Strategie — sie entstehen automatisch,
          sobald du eine Liga verbindest oder einen Draft öffnest.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Liga/Mock hinzufügen</button>
      </section>
    )
  }

  return (
    <section className="profiles-page">
      <h2>Profile</h2>
      <div className="row" style={{ gap: 8, marginBottom: '1rem' }}>
        <input className="control" placeholder="Name für neues Profil" value={newName} onChange={e => setNewName(e.target.value)} />
        <button className="btn btn-secondary" onClick={handleCreate}>+ Neues Profil</button>
      </div>

      {profiles.map(profile => (
        <div key={profile.id} className="card profile-hub-card">
          <div className="profile-badge-row">
            <Icon name={profile.boundLeagueId ? 'anchor' : 'shuffle'} size={16} label={profile.boundLeagueId ? 'Liga-gebunden' : 'Format-gebunden'} />
            <strong>{profile.name}</strong>
            <span className="badge badge--neutral">{formatSummary(profile)}</span>
            <span className="muted text-xs">zuletzt geändert: {new Date(profile.updatedAt).toLocaleDateString('de-DE')}</span>
          </div>
          <div className="row profile-badge-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => setExpandedId(id => id === profile.id ? null : profile.id)}>
              {expandedId === profile.id ? 'Zuklappen' : 'Bearbeiten'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => { const name = window.prompt('Neuer Name', profile.name); if (name) handleRename(profile.id, name) }}>
              Umbenennen
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDuplicate(profile.id)}>Duplizieren</button>
            <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(profile.id, profile.name)} title="Löschen">
              <Icon name="trash-2" size={14} />
            </button>
          </div>
          {expandedId === profile.id && (
            <ProfileEditor
              profile={profile}
              detected={{
                scoringType: profile.fingerprint?.scoringType || FORMAT_DEFAULTS.scoringType,
                isSuperflex: profile.fingerprint?.superflex || false,
                teams: profile.fingerprint?.teams || FORMAT_DEFAULTS.teams,
                rounds: FORMAT_DEFAULTS.rounds,
                type: FORMAT_DEFAULTS.type,
                rosterPositions: FORMAT_DEFAULTS.rosterPositions,
                source: 'default',
              }}
              strategyFormat={{
                teams: profile.overrides.teams ?? profile.fingerprint?.teams ?? FORMAT_DEFAULTS.teams,
                scoringType: profile.overrides.scoring_type ?? profile.fingerprint?.scoringType ?? FORMAT_DEFAULTS.scoringType,
                isSuperflex: profile.overrides.superflex ?? profile.fingerprint?.superflex ?? false,
                rosterPositions: profile.overrides.roster_positions ?? FORMAT_DEFAULTS.rosterPositions,
              }}
              season={String(new Date().getFullYear())}
              draftMode={profile.fingerprint?.draftMode || 'redraft'}
              onProfileChange={refresh}
            />
          )}
        </div>
      ))}
    </section>
  )
}
```

**Hinweis zu `detected` im Hub-Kontext:** Außerhalb eines aktiven Drafts gibt es keine "erkannten" Sleeper-Rohdaten — das Hub zeigt deshalb das Profil selbst (`overrides`/`fingerprint`) als Ausgangswert an, nicht eine Live-Erkennung. Das ist ein bewusster, kleiner Unterschied zum Setup-Kontext (dort ist `detected` echt) und im UI dadurch erkennbar, dass "Erkannt: … (Quelle: default)" statt "Quelle: draft/league" steht.

- [ ] **Step 2: Add the route in `App.jsx`**

Import ergänzen (bei den anderen Page-Imports):
```js
import ProfilesPage from './pages/ProfilesPage'
```

Route ergänzen (neben den bestehenden `<Route path="/setup" .../>` etc., ca. Zeile 343–345):
```jsx
<Route path="/profiles" element={<ProfilesPage />} />
```

- [ ] **Step 3: Add minimal CSS**

`src/styles/style.css` ergänzen (gleicher Block wie Task 7/10):
```css
.profile-hub-card { margin-bottom: 1rem; }
.profiles-empty { text-align: center; padding: 2rem 1rem; }
```

- [ ] **Step 4: Manual verification**

`npm run dev:all`, `/profiles` direkt aufrufen (Deep-Link) — vor jeder Liga-/Mock-Nutzung muss der Empty-State erscheinen; nach dem Verbinden einer Liga und einer Override-Änderung im Setup muss das Profil hier auftauchen, bearbeitbar sein, und Umbenennen/Duplizieren/Löschen müssen funktionieren.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilesPage.jsx src/App.jsx src/styles/style.css
git commit -m "feat(profiles): Profile-Hub Seite unter /profiles"
```

---

### Task 12: Zahnrad-Menü im Topbar

**Files:**
- Modify: `src/components/Topbar.jsx`

**Interfaces:**
- Consumes: `Modal` (bestehend, `./Modal`), `Icon` (bestehend).
- Produces: Zahnrad-Button öffnet ein `Modal` mit drei Links (`/setup`, `/profiles`, API-Key-Dialog).

- [ ] **Step 1: Check the existing `ApiKeyDialog` trigger**

Run: `grep -rn "ApiKeyDialog" src/App.jsx src/components/BoardSection.jsx`

Der Dialog wird aktuell wahrscheinlich lokal in `BoardSection.jsx` geöffnet (State dort). Für das Topbar-Menü reicht ein einfacher Link zu `/setup` bzw. `/profiles`; der API-Key-Dialog wird NICHT dupliziert, sondern das Menü verlinkt stattdessen auf `/setup` mit einem Hinweistext, ODER (falls `ApiKeyDialog` einen eigenen offenen/geschlossenen Zustand ohne Prop-Drilling über einen globalen Zustand handhabt) direkt geöffnet. Prüfe das Ergebnis des `grep` und entscheide:

- Falls `ApiKeyDialog` sein Öffnen/Schließen über lokalen State in `BoardSection.jsx` verwaltet (kein globaler Zustand) → Topbar kann ihn nicht direkt öffnen, ohne den State nach `useUIStore` zu heben. Das ist außerhalb des Scopes dieses Plans (separates Ticket) — Topbar verlinkt stattdessen nur zu „Liga/Mock-Setup" und „Profile verwalten"; den dritten Menüpunkt „API-Key" auf dieses Ticket verschieben (siehe Hinweis am Ende dieses Tasks).

- [ ] **Step 2: Modify `Topbar.jsx`**

```jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ThemeSelect from './ThemeSelect'
import Modal from './Modal'
import Icon from './Icon'

export default function Topbar({ themeId, setTheme }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  function go(path) {
    setMenuOpen(false)
    navigate(path)
  }

  return (
    <header className="topbar">
      <Link to="/dashboard" className="brand" aria-label="Zur Startseite">
        <b>Draft<span className="brand-accent">Helper</span></b>
        <small>Sleeper</small>
      </Link>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <ThemeSelect themeId={themeId} setTheme={setTheme} />
        <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(true)} aria-label="Einstellungen" title="Einstellungen">
          <Icon name="settings" size={18} />
        </button>
      </div>
      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Einstellungen">
        <div className="settings-menu">
          <button className="btn btn-secondary settings-menu-item" onClick={() => go('/setup')}>
            Liga/Mock-Setup
          </button>
          <button className="btn btn-secondary settings-menu-item" onClick={() => go('/profiles')}>
            Profile verwalten
          </button>
        </div>
      </Modal>
    </header>
  )
}
```

(Den dritten Menüpunkt „API-Key" bewusst weglassen — er lebt aktuell in `BoardSection.jsx`-lokalem State und lässt sich ohne größeren Umbau nicht sauber von hier aus öffnen. Diese Lücke unten als offenen Punkt vermerken statt sie hier mit einem Hack zu schließen.)

- [ ] **Step 3: Add minimal CSS**

`src/styles/style.css` ergänzen:
```css
.settings-menu { display: flex; flex-direction: column; gap: 0.5rem; }
.settings-menu-item { text-align: left; }
```

- [ ] **Step 4: Manual verification**

`npm run dev:all` — Zahnrad-Icon im Topbar muss auf jeder Seite sichtbar sein, Klick öffnet das Modal, beide Links navigieren korrekt und schließen das Modal.

- [ ] **Step 5: Commit**

```bash
git add src/components/Topbar.jsx src/styles/style.css
git commit -m "feat(nav): Zahnrad-Menue im Topbar fuer Setup/Profile"
```

**Offener Punkt (nicht Teil dieses Plans):** API-Key-Dialog vom lokalen `BoardSection`-State in einen globalen Zustand (`useUIStore`) heben, damit er auch aus dem Topbar-Menü heraus geöffnet werden kann. Eigenständiges, kleines Folge-Ticket.

---

### Task 13: `CLAUDE.md` aktualisieren

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the "Setup overrides" section**

Suche den Abschnitt "### Setup overrides — a separate channel from the stores" und ersetze ihn durch:

```markdown
### Format-Profile — kontext-gebundene Overrides statt eines globalen Keys

Format-Overrides (Scoring, Superflex, Roster-Positionen, Teams/Runden/Typ) und
die Draft-Strategie leben nicht mehr in einem einzigen globalen Key, sondern in
`localStorage`-Key `sdh.profiles.v1` (`src/services/profileStore.js`) — eine
Liste von **Format-Profilen**. Jedes Profil ist entweder an eine echte Liga
(`boundLeagueId`, stabil über Saisons) oder an einen Mock-Draft-Format-
Fingerprint (`fingerprint`, gematcht wie zuvor die Draft-Strategien) gebunden.
`resolveProfile({ draft, league, draftMode })` ist eine **reine** Funktion
(kein Storage-Write) — sie liefert bei fehlendem Treffer ein frisches, noch
nicht persistiertes Profil zurück; gespeichert wird erst beim ersten
tatsächlichen Edit über `upsertProfileOverrides`/`upsertProfileStrategy`
(verhindert Karteileichen durch React-StrictMode-Doppelaufrufe aus `useMemo`).

Cross-profilübergreifende "Grundsätze" (freier Strategie-Text, der immer
gilt) liegen separat unter `sdh.strategyPrinciples.v1`.

`ProfileEditor.jsx`/`StrategySection.jsx` dispatchen nach jedem Save weiterhin
`sdh:setup-changed` (Custom Event) + schreiben in `localStorage` — `App.jsx`
und `BoardSection.jsx` hören beide unabhängig darauf (Storage-Key-Filter:
`sdh.profiles.v1` / `sdh.strategyPrinciples.v1`) und lösen jeweils selbst über
`resolveProfile()` auf. Beim Anfassen dieser Kette: die Doppel-Auflösung in
`App.jsx` UND `BoardSection.jsx` ist bewusst (beide waren schon vor diesem
Umbau unabhängig) — nicht versuchen, sie in einem gemeinsamen Prop-Pfad zu
vereinheitlichen, ohne die Board-Renderpfade komplett zu verstehen.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md auf Format-Profile-Architektur aktualisiert"
```

---

## Selbstprüfung (vor Abschluss)

- **Spec-Abdeckung:** Datenmodell (Task 1–3), Migration (Task 4), Icon-Konvention (Task 5), StrategySection-Vereinfachung (Task 6), ProfileEditor/ProfileBadgeCard (Task 7), Setup-Seite entschlackt (Task 8), App/Board-Verdrahtung + Board-Hinweis (Task 9–10), Profile-Hub (Task 11), Navigation (Task 12), Doku (Task 13) — jeder Abschnitt der Design-Spec hat eine Entsprechung.
- **Bekannte Lücke, bewusst nicht geschlossen:** API-Key-Dialog bleibt vorerst außerhalb des Zahnrad-Menüs (Task 12, offener Punkt) — Umbau seines State-Handling ist ein eigenständiges, unabhängiges Ticket, kein Teil der Setup/Profile-Restrukturierung.
- **Nicht angefasst (laut Spec explizit Nicht-Ziel):** `preferences.js` (Fav/Avoid), `SyncSection`/Polling-Settings, Board-Daten-Trennung pro Liga/Mock.
