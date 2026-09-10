# Board pro Profil/Liga + strikte Modus-Trennung + Ein-Klick-Profil Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Board-Ranking-Ping-Pong zwischen Dynasty (Rookie) und Redraft beenden: jedes Liga-/Format-Profil bekommt sein eigenes Board, ein Profil gilt strikt für genau einen Modus, und im Setup gibt es einen Ein-Klick-Button „Profil für diese Liga speichern".

**Architecture:** `profileStore.js` bekommt ein Pflichtfeld `mode: 'redraft' | 'rookie'`, die Liga-Bindung wird zum Composite-Key `(boundLeagueId, mode)`. `useBoardStore.js` behält das aktive Board als Top-Level-Felder (kein UI-Umbau nötig) und bekommt zusätzlich einen persistierten Cache `boardsByKey`; `App.jsx` ruft bei Liga-/Draft-/Modus-Wechsel `switchBoard(boardKey)` auf, das das aktuelle Board wegsichert und das passende lädt. Ein neuer Service `boardKey.js` berechnet stabile Keys. Ein neuer Export `persistProfile()` speichert ein noch-nicht-persistiertes `isNew`-Profil ohne Hand-Edit.

**Tech Stack:** React 18, Zustand + persist (localStorage), Vitest, react-router-dom.

**Spec:** User-Antworten aus der Fehlersuche (2026-09-09): Board-Fix „Pro Liga/Profil, aber ein Profil kann nicht für mehrere Modi verwendet werden; Migration legt pro Modus ein Profil an" + „Ja, Button einbauen (Empfohlen)".

## Global Constraints

- UI-Text und Kommentare sind Deutsch (CLAUDE.md).
- Kein Linter im Projekt — keine ESLint-Anpassungen nötig, `// eslint-disable-line`-Kommentare an bestehenden Stellen unangetastet lassen.
- `npm test` (Vitest, einmalig) muss nach jedem Task grün sein.
- Destruktive Aktionen nutzen `window.confirm`, wie der Rest der App (siehe `LeagueCard.jsx`, `ProfilesPage.jsx`).
- Keine neuen Dependencies.
- Keine Emoji als Struktur-Icons — ausschließlich `Icon.jsx` (lucide-react).
- `React.StrictMode` ist aktiv (`main.jsx`) — keine Schreib-Nebenwirkungen in reinen Ableitungen (`resolveProfile`, `boardKeyFor`, `deriveFormat` bleiben rein).
- `src/server/apiRoutes.js` bleibt die einzige Quelle für `/api/*`-Routen — hier keine Server-Änderung nötig.
- Nach Code-Änderungen `graphify update .` ausführen (CLAUDE.md), damit der Wissensgraph aktuell bleibt.

---

## Datei-Übersicht

| Datei | Aktion |
|---|---|
| `src/services/profileStore.js` | erweitern: `mode`-Feld, `persistProfile()`, `migrateProfilesToMode()`, `resolveProfile` + `rebindProfile` modus-scharf, `migrateLegacyProfile` legt pro Modus an |
| `src/services/profileStore.test.js` | erweitern: Modus-Tests, Persist-Tests, Migrations-Tests |
| `src/services/strategyMatch.js` | anpassen: `pickProfile` filtert Wildcards zusätzlich nach `mode` |
| `src/services/boardKey.js` | neu: `boardKeyFor({ league, draft, draftMode, fingerprint })` + `isStandaloneDraft`-Reuse |
| `src/services/boardKey.test.js` | neu |
| `src/stores/useBoardStore.js` | erweitern: `boardsByKey` + `activeBoardKey` + `switchBoard()`; alle Import-Actions sichern in den Cache |
| `src/stores/useBoardStore.test.js` | erweitern: Switch-/Cache-/Migrations-Tests |
| `src/App.jsx` | erweitern: Effekt berechnet Board-Key und ruft `switchBoard` |
| `src/components/ProfileBadgeCard.jsx` | erweitern: „Profil für diese Liga speichern"-Button bei `isNew` |
| `src/pages/SetupPage.jsx` | erweitern: `handlePersistProfile` (persist + Tick) |
| `src/pages/ProfilesPage.jsx` | erweitern: Modus-Badge pro Profil |
| `src/stores/migrate.js` | erweitern: `migrateProfilesToMode()` beim Start aufrufen |

---

### Task 1: `profileStore.js` — Pflicht-`mode`, Composite-Bindung, `persistProfile`

**Files:**
- Modify: `src/services/profileStore.js`
- Test: `src/services/profileStore.test.js`

**Interfaces:**
- Consumes: `deriveFormat` (nicht nötig), `makeFingerprint`, `pickProfile` (aus `./strategyMatch`), `isStandaloneDraft`, `deriveFormat` (aus `./draftFormat` für `computeDetectedFingerprint`, Bestand).
- Produces: `Profile.mode: 'redraft' | 'rookie'` (Pflicht ab jetzt; Altbestand `null` = legacy, wird in Task 2 migriert); `newProfile({ name, boundLeagueId, fingerprint, mode })`; `createBlankProfile(name, mode = 'redraft')`; `persistProfile(profile: Profile): Profile` (speichert ein isNew-Profil unverändert, wirft bei fehlender Bindung/Fingerprint keinen Fehler, gibt gespeichertes Profil zurück); `resolveProfile({ draft, league, draftMode }): { profile, deviations, isNew }` (Liga-Zweig matcht `(boundLeagueId, mode)`); `rebindProfile(id, { leagueId, fingerprint, mode })` (Evict nur bei gleichem Composite).

- [ ] **Step 1: Write the failing test**

```js
// in src/services/profileStore.test.js ergänzen:
import { persistProfile } from './profileStore'

it('persistProfile speichert ein isNew-Liga-Profil ohne Override-Edit', () => {
  const { profile, isNew } = resolveProfile({
    draft: { league_id: 'L9', settings: {} },
    league: { league_id: 'L9', name: 'Dynasty Liga' },
    draftMode: 'rookie',
  })
  expect(isNew).toBe(true)
  expect(profile.mode).toBe('rookie')
  const saved = persistProfile(profile)
  expect(loadProfiles()).toHaveLength(1)
  expect(loadProfiles()[0].id).toBe(saved.id)
  const again = resolveProfile({
    draft: { league_id: 'L9', settings: {} },
    league: { league_id: 'L9', name: 'Dynasty Liga' },
    draftMode: 'rookie',
  })
  expect(again.isNew).toBe(false)
  expect(again.profile.id).toBe(saved.id)
})

it('gleiche Liga, anderer Modus = anderes Profil (kein Cross-Mode-Match)', () => {
  const red = resolveProfile({
    draft: { league_id: 'L9', settings: {} },
    league: { league_id: 'L9', name: 'Liga' },
    draftMode: 'redraft',
  })
  persistProfile(red.profile)
  const rook = resolveProfile({
    draft: { league_id: 'L9', settings: {} },
    league: { league_id: 'L9', name: 'Liga' },
    draftMode: 'rookie',
  })
  expect(rook.isNew).toBe(true)
  expect(rook.profile.mode).toBe('rookie')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/profileStore.test.js`
Expected: FAIL — `persistProfile is not a function` bzw. `profile.mode` ist `undefined`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/profileStore.js — Änderungen:

// 1) newProfile bekommt mode (Default redraft, Fallback für Altaufrufe):
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

// 2) createBlankProfile reicht mode durch:
export function createBlankProfile(name, mode = 'redraft') {
  const created = newProfile({ name: String(name || 'Neues Profil').trim() || 'Neues Profil', mode })
  saveProfiles([...loadProfiles(), created])
  return created
}

// 3) persistProfile: speichert ein (ggf. synthetisches) Profil unverändert.
// Rein speichern, keine Overrides anfassen — StrictMode-sicher, weil nur auf
// expliziten Button-Klick aufgerufen, nie aus useMemo/render heraus.
export function persistProfile(profile) {
  if (!profile || !profile.id) throw new Error('Kein Profil zum Speichern')
  return upsertProfile({ ...profile, updatedAt: new Date().toISOString() })
}

// 4) resolveProfile Liga-Zweig wird modus-scharf:
if (league?.league_id && !standalone) {
  const existing = profiles.find(p => p.boundLeagueId === league.league_id && (p.mode == null || p.mode === draftMode))
  if (existing) return { profile: existing, deviations: [], isNew: false }
  return { profile: newProfile({ name: league.name || 'Liga', boundLeagueId: league.league_id, mode: draftMode }), deviations: [], isNew: true }
}

// 5) rebindProfile evictet nur im gleichen Composite + setzt mode:
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
```

Hinweis: `duplicateProfile` muss `mode` mitkopieren (Spread kopiert es bereits — nichts zu tun, aber im Test unten verankert). `renameProfile`/`deleteProfile` unverändert.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/profileStore.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/profileStore.js src/services/profileStore.test.js
git commit -m "feat: profile mode Pflichtfeld, Composite-Bindung, persistProfile"
```

---

### Task 2: Migration — Altbestand wird pro Modus angelegt

**Files:**
- Modify: `src/services/profileStore.js`
- Test: `src/services/profileStore.test.js`
- Modify: `src/stores/migrate.js`

**Interfaces:**
- Consumes: `loadProfiles`, `saveProfiles`, `newProfile` (Task 1).
- Produces: `migrateLegacyProfile()` (ändert Verhalten: legt bei vorhandenem Legacy-Setup **zwei** Profile `Migriert (Redraft)`/`Migriert (Rookie)` an); `migrateProfilesToMode(): { migrated: number }` (idempotent; vergibt fehlendes `mode`: `fingerprint.draftMode ?? 'redraft'`; **Spezialfall**: genau ein ungebundenes, fingerprint-loses Profil namens `Migriert` wird in zwei modus-scharfe Kopien aufgespalten).

- [ ] **Step 1: Write the failing test**

```js
it('migrateLegacyProfile legt pro Modus ein Profil an', () => {
  localStorage.setItem('sdh.setup.v2', JSON.stringify({ overrides: { scoring_type: 'half_ppr', superflex: true, roster_positions: null, teams: 10, rounds: 15, type: 'snake', strategies: ['zeroRB'] } }))
  migrateLegacyProfile()
  const profiles = loadProfiles()
  expect(profiles).toHaveLength(2)
  expect(profiles.map(p => p.mode).sort()).toEqual(['redraft', 'rookie'])
  expect(profiles.every(p => p.overrides.scoring_type === 'half_ppr')).toBe(true)
})

it('migrateProfilesToMode spaltet einzelnes fingerprint-loses Migriert-Profil auf', () => {
  localStorage.setItem(PROFILES_KEY, JSON.stringify({ version: 1, profiles: [{
    id: 'prof_alt', name: 'Migriert', boundLeagueId: null, fingerprint: null, mode: null,
    overrides: { scoring_type: 'ppr', superflex: false, roster_positions: null, teams: 12, rounds: 16, type: 'snake', strategies: ['balanced'] },
    strategy: { summary: '', rules: [], sources: [], contested: [], source: 'manual', updatedAt: null },
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }] }))
  const res = migrateProfilesToMode()
  expect(res.migrated).toBeGreaterThan(0)
  const profiles = loadProfiles()
  expect(profiles).toHaveLength(2)
  expect(profiles.map(p => p.mode).sort()).toEqual(['redraft', 'rookie'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/profileStore.test.js`
Expected: FAIL — `migrateProfilesToMode is not defined`, Längen-Erwartung 2 scheitert.

- [ ] **Step 3: Write minimal implementation**

```js
// migrateLegacyProfile umbauen (nur der Erstellungs-Block am Ende):
if (!legacyOverrides && !legacyStrategy) return
const base = { ...EMPTY_OVERRIDES, ...legacyOverrides }
const mk = (mode, name) => {
  const p = newProfile({ name, mode })
  p.overrides = { ...base }
  if (legacyStrategy) p.strategy = legacyStrategy
  return p
}
saveProfiles([mk('redraft', 'Migriert (Redraft)'), mk('rookie', 'Migriert (Rookie)')])

// Neu: Altbestand ohne mode heilen (idempotent):
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
```

```js
// src/stores/migrate.js:
import { migrateLegacyProfile, migrateProfilesToMode } from '../services/profileStore'
export function migrateOldStorage() {
  const SESSION_KEY = 'sdh-session-v1'
  migrateLegacyProfile()
  try { migrateProfilesToMode() } catch {}
  if (localStorage.getItem(SESSION_KEY)) return
  // ... Rest unverändert
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/profileStore.test.js`
Expected: PASS. Danach Full-Suite: `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/services/profileStore.js src/services/profileStore.test.js src/stores/migrate.js
git commit -m "feat: Profil-Migration legt pro Modus an, heilt Altbestand"
```

---

### Task 3: `pickProfile` — Wildcards modus-scharf + neuer `boardKey`-Service

**Files:**
- Modify: `src/services/strategyMatch.js`
- Create: `src/services/boardKey.js`
- Create: `src/services/boardKey.test.js`

**Interfaces:**
- Consumes: `isStandaloneDraft` (aus `./draftFormat`).
- Produces: `pickProfile(profiles, fp)` (unveränderte Signatur; Wildcard-Fallback filtert zusätzlich `p.mode == null || p.mode === fp.draftMode`); `boardKeyFor({ league, draft, draftMode }): string` — Liga-Drafts: `league:<league_id>:<draftMode>`; Standalone/Mock: `fp:<teams>:<scoringType>:<superflex 0/1>:<starters joined by +>:<draftMode>` (Starters aus `computeDetectedFingerprint`-kompatibler Ableitung, sortiert).

- [ ] **Step 1: Write the failing test**

```js
// src/services/boardKey.test.js (neu):
import { describe, it, expect } from 'vitest'
import { boardKeyFor } from './boardKey'

describe('boardKeyFor', () => {
  it('Liga-Key enthält Liga-ID und Modus', () => {
    expect(boardKeyFor({
      league: { league_id: 'L1' },
      draft: { draft_id: 'D1', league_id: 'L1' },
      draftMode: 'redraft',
    })).toBe('league:L1:redraft')
  })
  it('gleiche Liga, anderer Modus = anderer Key', () => {
    const a = boardKeyFor({ league: { league_id: 'L1' }, draft: { draft_id: 'D1', league_id: 'L1' }, draftMode: 'redraft' })
    const b = boardKeyFor({ league: { league_id: 'L1' }, draft: { draft_id: 'D1', league_id: 'L1' }, draftMode: 'rookie' })
    expect(a).not.toBe(b)
  })
  it('Standalone-Key enthält Fingerprint + Modus (stabil)', () => {
    const draft = { draft_id: 'M1', league_id: null, settings: { teams: 12, rounds: 15 }, metadata: { scoring_type: 'ppr' } }
    const a = boardKeyFor({ league: { league_id: 'L9' }, draft, draftMode: 'redraft' })
    const b = boardKeyFor({ league: null, draft, draftMode: 'redraft' })
    expect(a).toBe(b)
    expect(a.startsWith('fp:')).toBe(true)
    expect(a.endsWith(':redraft')).toBe(true)
  })
})
```

Wildcard-Modus-Test in `strategyMatch`-Tests (oder `profileStore.test.js`, je nach vorhandener Testdatei — im Repo liegt der Fingerprint-Test in `profileStore.test.js`, `pickProfile`-Unit fehlt; deshalb hier direkt in `boardKey.test.js`-Durchlauf plus folgender Test in passender Datei):

```js
it('Wildcard mit fremdem mode wird nicht gepickt', async () => {
  const { pickProfile } = await import('./strategyMatch.js')
  const fp = { draftMode: 'rookie', scoringType: 'ppr', superflex: false, teams: 12, starters: [] }
  const res = pickProfile([{ id: 'w', fingerprint: null, mode: 'redraft', updatedAt: '2026-01-01' }], fp)
  expect(res).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/boardKey.test.js`
Expected: FAIL — `boardKey.js` fehlt.

- [ ] **Step 3: Write minimal implementation**

```js
// src/services/boardKey.js:
import { isStandaloneDraft } from './draftFormat'
import { computeDetectedFingerprint } from './profileStore'

export function boardKeyFor({ league = null, draft = null, draftMode = 'redraft' } = {}) {
  const mode = draftMode === 'rookie' ? 'rookie' : 'redraft'
  if (league?.league_id && !isStandaloneDraft(draft)) return `league:${league.league_id}:${mode}`
  if (draft && !isStandaloneDraft(draft) && draft.draft_id && !league) return `draft:${draft.draft_id}:${mode}`
  const fp = computeDetectedFingerprint({ draft, league, draftMode: mode })
  const starters = Array.isArray(fp.starters) && fp.starters.length ? fp.starters.join('+') : 'nostarters'
  return `fp:${fp.teams}:${fp.scoringType}:${fp.superflex ? 1 : 0}:${starters}:${mode}`
}
```

```js
// src/services/strategyMatch.js — nur der Wildcard-Block:
const wildcards = profiles.filter(p => !p?.fingerprint && (p?.mode == null || p.mode === fp.draftMode))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/boardKey.test.js`
Expected: PASS. Danach `npm test` (Full-Suite).

- [ ] **Step 5: Commit**

```bash
git add src/services/boardKey.js src/services/boardKey.test.js src/services/strategyMatch.js
git commit -m "feat: modus-scharfe Wildcards, stabile Board-Keys"
```

---

### Task 4: `useBoardStore` — `boardsByKey`-Cache + `switchBoard`

**Files:**
- Modify: `src/stores/useBoardStore.js`
- Test: `src/stores/useBoardStore.test.js`

**Interfaces:**
- Consumes: keine neuen Imports (reine Zustandserweiterung).
- Produces: persistiert `boardsByKey: Record<string, { boardPlayers, boardMode, boardSource, rankingSource, marketMeta, csvRawText, lastImportStats }>`; nicht-persistiert `activeBoardKey: string | null`; `switchBoard(key: string): void` (sichert aktives Board unter altem Key, lädt Board unter neuem Key oder leeres Board; setzt `lastBoardSnapshot: null` beim Wechsel, damit Undo nie liga-übergreifend wirkt); alle Import-Actions (`handleAutoImport`, `handleFantasyProsImport`, `handleKtcRookieImport`, `handleCsvLoad`) schreiben nach Erfolg zusätzlich ihren Stand in `boardsByKey[activeBoardKey]`.

- [ ] **Step 1: Write the failing test**

```js
describe('boardsByKey / switchBoard', () => {
  it('sichert Redraft-Board und lädt Rookie-Board leer, zurückkehren stellt wieder her', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan', nname: 'bijan', rk: '1' }])
    useBoardStore.getState().switchBoard('league:L1:redraft')
    expect(useBoardStore.getState().activeBoardKey).toBe('league:L1:redraft')
    useBoardStore.getState().switchBoard('league:L9:rookie')
    expect(useBoardStore.getState().boardPlayers).toEqual([])
    useBoardStore.getState().setBoardPlayers([{ name: 'Jeanty', nname: 'jeanty', rk: '1' }])
    useBoardStore.getState().switchBoard('league:L1:redraft')
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Bijan')
    useBoardStore.getState().switchBoard('league:L9:rookie')
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Jeanty')
  })

  it('Undo wirkt nie liga-übergreifend (Snapshot wird beim Switch verworfen)', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'A', nname: 'a', rk: '1' }])
    useBoardStore.getState().switchBoard('league:L1:redraft')
    useBoardStore.getState().switchBoard('league:L9:rookie')
    expect(useBoardStore.getState().undoImport()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/stores/useBoardStore.test.js`
Expected: FAIL — `switchBoard is not a function`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/stores/useBoardStore.js — im create-State ergänzen:
boardsByKey: {},
activeBoardKey: null,

switchBoard: (key) => set((s) => {
  const nextKey = String(key || '')
  if (!nextKey || s.activeBoardKey === nextKey) {
    return nextKey && s.activeBoardKey !== nextKey ? { activeBoardKey: nextKey } : {}
  }
  const cache = { ...(s.boardsByKey || {}) }
  // Aktiven Stand wegsichern (nur wenn überhaupt ein Key aktiv war oder Board Inhalt hat)
  if (s.activeBoardKey) {
    cache[s.activeBoardKey] = {
      boardPlayers: s.boardPlayers, boardMode: s.boardMode, boardSource: s.boardSource,
      rankingSource: s.rankingSource, marketMeta: s.marketMeta, csvRawText: s.csvRawText,
      lastImportStats: s.lastImportStats,
    }
  }
  const hit = cache[nextKey]
  return {
    activeBoardKey: nextKey,
    boardsByKey: cache,
    boardPlayers: hit?.boardPlayers || [],
    boardMode: hit?.boardMode ?? null,
    boardSource: hit?.boardSource ?? null,
    rankingSource: hit?.rankingSource ?? null,
    marketMeta: hit?.marketMeta ?? null,
    csvRawText: hit?.csvRawText ?? '',
    lastImportStats: hit?.lastImportStats ?? null,
    lastBoardSnapshot: null,
  }
}),
```

Nach jedem erfolgreichen Import (`set({...})` in `handleAutoImport`, `handleFantasyProsImport`, `handleKtcRookieImport`, `handleCsvLoad`) zusätzlich cachen — Muster (in jeder der vier Actions nach dem `set`):

```js
// BoardsByKey-Cache nachführen (aktiver Key = Quelle der Wahrheit für switchBoard):
{
  const st = get()
  if (st.activeBoardKey) {
    set((s) => ({
      boardsByKey: {
        ...(s.boardsByKey || {}),
        [s.activeBoardKey]: {
          boardPlayers: s.boardPlayers, boardMode: s.boardMode, boardSource: s.boardSource,
          rankingSource: s.rankingSource, marketMeta: s.marketMeta, csvRawText: s.csvRawText,
          lastImportStats: s.lastImportStats,
        },
      },
    }))
  }
}
```

`partialize` erweitern um `boardsByKey` (aber NICHT `activeBoardKey`, NICHT `lastBoardSnapshot`):

```js
partialize: (s) => ({
  csvRawText: s.csvRawText,
  boardPlayers: s.boardPlayers,
  // ... Bestand ...
  boardsByKey: s.boardsByKey || {},
}),
```

Migrations-Hinweis im Store: Beim allerersten Laden nach dem Update enthält `boardsByKey` noch nichts, das aktive Board steht in den Top-Level-Feldern — `switchBoard` sichert es beim ersten Wechsel automatisch (siehe Code oben: Schreiben unter altem Key nur wenn `activeBoardKey` gesetzt; deshalb beim Store-Init `activeBoardKey: null` lassen und den ersten `switchBoard`-Aufruf aus App.jsx abwarten — der alte Stand darf dabei NICHT verloren gehen: falls `activeBoardKey` null ist und `boardPlayers` nicht leer, vor dem Laden unter dem alten leeren Key zuerst unter dem neuen Key prüfen, sonst aktiven Stand als Basis für den neuen Key übernehmen? Vereinfacht: App ruft switchBoard erst auf, NACHDEM sie den initialen Key kennt; der vorhandene Top-Level-Stand gehört logisch zu genau diesem Key — deshalb in switchBoard zusätzlich: wenn `!s.activeBoardKey && s.boardPlayers.length && !cache[nextKey]` → `boardPlayers` behalten statt leeren (kein Datenverlust beim Upgrade). Als Code:

```js
// in switchBoard, bei hit == null:
const keepLegacy = !s.activeBoardKey && (s.boardPlayers || []).length > 0
// → dann boardPlayers & Co. unverändert lassen statt auf [] / null zu resetten.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/stores/useBoardStore.test.js`
Expected: PASS. Danach `npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useBoardStore.js src/stores/useBoardStore.test.js
git commit -m "feat: Board-Cache pro Liga/Profil mit switchBoard"
```

---

### Task 5: `App.jsx` — automatischer Board-Wechsel bei Liga/Draft/Modus

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `boardKeyFor` (aus `./services/boardKey`), `useBoardStore().switchBoard`, `selectedLeague`, `selectedDraft`, `draftMode`.
- Produces: kein neues Interface; Effekt `useEffect(() => { switchBoard(boardKeyFor({ league: selectedLeague, draft: selectedDraft, draftMode })) }, [selectedLeague?.league_id, selectedDraft?.draft_id, draftMode])` — steht DIREKT NACH dem Draft-Mode-Auto-Detect-Effekt, damit der Key den frischen Modus sieht.

- [ ] **Step 1: Write the failing test**

Kein Unit-Test sinnvoll (App-Effekt mit Stores/Router). Stattdessen manueller Nachweis als Test-Schritte im Code-Review; automatisiert bleibt Task 4 die Abdeckung. Als Ersatz einen Integrations-Check in `src/stores/useBoardStore.test.js` gibt es bereits — hier direkt implementieren und per `npm test` + manuellem Klickpfad verifizieren:
1. Dynasty-Liga wählen → Rookie-Board importieren.
2. Redraft-Liga wählen → Board ist das alte Redraft-Board (kein Mismatch-Banner).
3. Zurück zur Dynasty-Liga → Rookie-Board ist wieder da.

- [ ] **Step 2: Run test to verify current behavior**

Manuell: aktuell zeigt Schritt 2 das Rookie-Board mit Mismatch-Banner (Fehlerbild aus dem Bug-Report).

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/App.jsx — Import ergänzen:
import { boardKeyFor } from './services/boardKey'

// Direkt nach dem Draft-Mode-Auto-Detect-useEffect einfügen:
// Board pro Liga/Profil: bei Liga-/Draft-/Modus-Wechsel das passende Board
// laden (useBoardStore.switchBoard sichert das alte automatisch weg).
// Kein Board-Reset hier — switchBoard ist die einzige Stelle, die tauscht.
useEffect(() => {
  try {
    const key = boardKeyFor({ league: selectedLeague, draft: selectedDraft, draftMode })
    useBoardStore.getState().switchBoard(key)
  } catch {}
}, [selectedLeague?.league_id, selectedDraft?.draft_id, draftMode]) // eslint-disable-line
```

Der bestehende Draft-Wechsel-Effekt (prevDraftIdRef: livePicks-Clear + Board-Status-Clear) bleibt UNVERÄNDERT — er löscht nur Pick-Markierungen (`status`/`pick_no`/`picked_by`), nicht das Ranking. Reihenfolge ist egal, da beide Effekte auf unterschiedliche Felder wirken.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Manuell: Klickpfad aus Step 1 ohne Mismatch-Banner.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: Board wechselt automatisch pro Liga/Profil"
```

---

### Task 6: Setup — Ein-Klick „Profil für diese Liga speichern"

**Files:**
- Modify: `src/components/ProfileBadgeCard.jsx`
- Modify: `src/pages/SetupPage.jsx`
- Modify: `src/components/SetupForm.jsx` (nur Prop-Durchreiche)

**Interfaces:**
- Consumes: `persistProfile(profile)` (Task 1), `onProfileChange()`, `sdh:setup-changed`-Event (Bestandsmuster aus `ProfileEditor.jsx`).
- Produces: `SetupPage.handlePersistProfile()` — `persistProfile(resolved.profile)` + `window.dispatchEvent(new CustomEvent('sdh:setup-changed'))` + `setProfileTick(t => t + 1)`; `ProfileBadgeCard`-Props zusätzlich `isNew`, `onPersist` (Button nur wenn `isNew === true`).

- [ ] **Step 1: Write the failing test**

Manueller UI-Pfad (kein JSDOM-Klick-Test im Repo-Stil nötig): Setup öffnen mit Dynasty-Liga ohne Profil → Badge zeigt „Neu erkannt" + Button „Profil für diese Liga speichern" → Klick → Badge zeigt „Liga-gebunden" ohne „Neu erkannt", Reload → Profil bleibt. Automatisiert ist `persistProfile` bereits in Task 1 getestet.

- [ ] **Step 2: Run test to verify it fails**

Manuell: aktuell gibt es bei `isNew` keinen Speicher-Button — das Profil entsteht erst beim ersten Override-/Strategie-Edit (Bestandsverhalten).

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/pages/SetupPage.jsx:
import { persistProfile } from '../services/profileStore'
function handlePersistProfile() {
  try {
    persistProfile(resolved.profile)
    window.dispatchEvent(new CustomEvent('sdh:setup-changed'))
    setProfileTick(t => t + 1)
  } catch (e) { setImportError(e?.message || String(e)) }
}
// an SetupForm durchreichen: onPersistProfile={handlePersistProfile}
```

```jsx
// src/components/SetupForm.jsx — Props + Durchreiche (3 Zeilen):
// Props: onPersistProfile,
// <ProfileBadgeCard ... onPersist={onPersistProfile} />
```

```jsx
// src/components/ProfileBadgeCard.jsx:
export default function ProfileBadgeCard({ profile, deviations, isNew, allProfiles, onRebind, onRename, onPersist }) {
  // ... Bestand ...
  {isNew && (
    <button type="button" className="btn btn-primary btn-sm" onClick={onPersist}>
      Profil für diese Liga speichern
    </button>
  )}
  // Hinweis-Text unter dem Button:
  // {isNew && <p className="muted text-xs">Noch nicht gespeichert — Übernimmt das erkannte Format, nichts muss von Hand gesetzt werden.</p>}
}
```

Wichtig: `ProfileEditor`-Edits nach dem Persist laufen auf `resolved.profile` (jetzt mit echter ID) — `upsertProfileOverrides` findet die ID und dupliziert nicht (Test in Task 1 sichert das).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS. Manuell: Klickpfad aus Step 1.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProfileBadgeCard.jsx src/pages/SetupPage.jsx src/components/SetupForm.jsx
git commit -m "feat: Ein-Klick Profil aus Liga-Einstellung speichern"
```

---

### Task 7: `ProfilesPage` Modus-Badge + Abschluss-Verifikation

**Files:**
- Modify: `src/pages/ProfilesPage.jsx`

**Interfaces:**
- Consumes: `profile.mode` (Task 1).
- Produces: Badge `{profile.mode === 'rookie' ? 'Rookie' : 'Redraft'}` neben dem bestehenden Liga-/Format-Badge; `formatSummary` bleibt unverändert.

- [ ] **Step 1: Write the failing test**

Sichtprüfung (kein neuer Vitest nötig — `profile.mode` ist in Tasks 1–2 abgedeckt).

- [ ] **Step 2: Run to verify current state**

`npm test` muss grün sein; manuell: `/profiles` zeigt noch kein Modus-Badge.

- [ ] **Step 3: Write minimal implementation**

```jsx
// src/pages/ProfilesPage.jsx — in der Badge-Row ergänzen:
<span className="badge badge--neutral">{profile.mode === 'rookie' ? 'Rookie' : 'Redraft'}</span>
```

- [ ] **Step 4: Run verification**

```bash
npm test
graphify update .
```

Expected: `npm test` PASS (alle Suiten inkl. `profileStore`, `boardKey`, `useBoardStore`); `graphify update .` ohne Fehler.

Manueller End-to-End-Pfad (Pflicht vor Abschluss):
1. Dynasty-Liga wählen → Setup zeigt „Neu erkannt" → „Profil für diese Liga speichern" → Reload → Profil bleibt, Modus-Badge `Rookie` in `/profiles`.
2. Rookie-Rankings importieren → Board voll.
3. Redraft-Liga wählen → eigenes (leeres/altes Redraft-)Board, KEIN Mismatch-Banner → Redraft-Rankings importieren.
4. Zurück zur Dynasty-Liga → Rookie-Board wieder da, KEIN Re-Import nötig.
5. Bestehender Nutzer mit einzelnem `Migriert`-Profil: nach Reload zwei Profile `Migriert (Redraft)`/`Migriert (Rookie)`, kein Datenverlust (alte Keys `sdh.setup.v2`/`sdh.strategies.v1` bleiben liegen).

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilesPage.jsx
git commit -m "feat: Modus-Badge in Profilverwaltung"
```

---

## Self-Review

- Spec-Abdeckung: Board pro Liga/Profil (Tasks 3–5) ✓; strikt ein Modus pro Profil inkl. Migration pro Modus (Tasks 1–2) ✓; Ein-Klick-Profil ohne Handarbeit (Task 6) ✓; Sichtbarkeit des Modus (Task 7) ✓.
- Keine Platzhalter: alle Steps enthalten ausführbaren Code, exakte Run-Befehle und Commit-Zeilen.
- Typ-Konsistenz: `mode` immer `'redraft' | 'rookie'`; Board-Key immer `league:<id>:<mode> | draft:<id>:<mode> | fp:<teams>:<scoring>:<0|1>:<starters>:<mode>`; `persistProfile`/`switchBoard`/`boardKeyFor`/`migrateProfilesToMode` heißen überall gleich.

---

## Addendum 2026-09-10: Board ans Profil gebunden (User-Feedback nach Live-Test)

**Problem:** Board-pro-Liga erzeugt leere Boards bei jeder neuen Liga (Re-Import nötig) und Verwirrung („Neu erkannt"-Badges). Superflex-Erkennung in einer Dynasty-Liga schlug fehl — Verdacht: gespeicherte Overrides (u. a. migrierte Wildcards) überschatten die Erkennung, ohne dass die UI das zeigt.

**Zielmodell (User-Vorgabe):** Alles automatisch, keine Handgriffe. Bei Mock/neuer Liga wird das passende Profil gesucht und ALLE Einstellungen (Format, Strategie, Rankings) von dort genommen. Einziges Opt-in: einer einzelnen Liga ein eigenes Profil geben; eigene Profile anlegen und im Setup zuweisen bleibt möglich.

**Beschlossene Änderung (ersetzt die Board-Key-Regel oben):**
- Board-Key folgt der Profilauflösung: `boardKeyForContext({ draft, league, draftMode, resolved })` in `boardKey.js`. Aufgelöstes Profil persistiert (`isNew === false`) → Key `profile:<profilId>`. Noch-ungespeichert (`isNew === true`) → geteilter Modus-Key `mode:<redraft|rookie>` (alle unzugeordneten Drafts eines Modus teilen sich ein Board — neue Liga hat sofort Rankings).
- `persistProfile`-Pfad (SetupPage): Quelle `mode:<…>` ist geteilt → per neuem `copyBoard(fromKey, toKey)` KOPIEREN (nicht moven, sonst verliert der Rest das Board), dann `switchBoard`. Quelle ein exklusiver Fallback → `moveBoard` wie bisher.
- `resolveProfile` Liga-Zweig ohne Bound-Treffer: Vorschauprofil übernimmt die STRATEGIE (nur `strategy`, keine Overrides — Format bleibt immer Erkennung) der neuesten modus-passenden Wildcard (`!boundLeagueId`, `mode == null || mode === draftMode`, neueste `updatedAt`). Overrides bleiben null.
- Einmalige Board-Migration in `migrate.js` (rohes `sdh-board-v1`-JSON): pro Modus `mode:<m>` aus dem inhaltsreichsten `league:*:<m>`-/`fp:*:<m>`-Eintrag seeden (nur kopieren, nie löschen/löschen-nichts).
- Tests: Kontext-Key (`profile:<id>` vs `mode:<m>`), Strategie-Prefill, copyBoard-Semantik (Quelle bleibt), Migration (reichster Eintrag gewinnt, Idempotenz).
- **Superflex-Sichtbarkeit:** `ProfileEditor` markiert jedes Feld, das der Erkennung folgt, mit „(erkannt)" und zeigt bei Override den erkannten Wert daneben — Override-Schatten wird sichtbar statt still. Keine Erkennungslogik-Änderung in `deriveFormat` ohne Evidenz (Erkannt-Zeile + Quelle auslesen).
- Effekt: Ligen/Mocks mit gleichem Profil teilen sich Format, Strategie UND Rankings. Neue Liga mit passendem Profil hat sofort alles. Rankings-Import schreibt ins aktive Profil-Board („Rankings beim Profil" — ohne Datenmodell-Änderung, der Key macht die Bindung).
- `persistProfile`-Pfad (SetupPage): nach dem Speichern Board-Eintrag per neuem `moveBoard(fromKey, toKey)` vom Fallback-Key auf `profile:<id>` umziehen, dann `switchBoard`. Kein Re-Import, kein Verlust.
- Rebind-Pfad (Liga bekommt anderes Profil): `switchBoard` auf dessen Profil-Board (ggf. leer/geteilt — bewusst, Zuweisung ist explizite Aktion).
- `deleteProfile`: zugehörigen `profile:<id>`-Cache-Eintrag per neuem `deleteBoard(key)` mitlöschen (keine Orphans).
- `App.jsx`-Effekt nutzt statt `boardKeyFor` den neuen `boardKeyForContext` mit dem dort bereits vorhandenen `resolvedProfile`.
- Tests: Key-Ableitung (persistiert vs isNew, Sharing bei gleichem Profil), moveBoard-Umzug, deleteBoard-Cleanup.
- **Superflex-Sichtbarkeit:** `ProfileEditor` markiert jedes Feld, das der Erkennung folgt, mit „(erkannt)" und zeigt bei Override den erkannten Wert daneben — Override-Schatten wird sichtbar statt still. Keine Erkennungslogik-Änderung in `deriveFormat` ohne Evidenz (Erkannt-Zeile + Quelle auslesen).
- Unverändert: `mode`-Pflicht, Composite-Bindung, Migration pro Modus, Ein-Klick-Button, Modus-Badge, `mergeLivePicks`/Enrichment ohne Durchschrieb.
