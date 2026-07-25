# Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den einen globalen Strategie-Freitext durch eine formatgebundene Strategie-Bibliothek ersetzen, deren Einträge Claude per Web-Recherche erzeugen kann.

**Architecture:** Reine Matching-Logik in `strategyMatch.js`, Persistenz in `strategyStore.js`, eine neue SSE-Route `/api/ai-draft-strategy` mit Claudes serverseitigem `web_search`-Tool, UI im bestehenden `SetupForm`. Die Prompt-Pipeline (`ai.js`, `adviceRequestArgs.js`) bleibt unangetastet — sie bekommt weiterhin einen Textblock, nur aus neuer Quelle.

**Tech Stack:** React 18 + Vite, Zustand, Express 5, `@anthropic-ai/sdk`, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-25-draft-strategie-design.md`

## Global Constraints

- UI-Texte, Kommentare und alle nutzersichtbaren Strings auf **Deutsch** (Projektkonvention aus `CLAUDE.md`).
- Kein Linter im Projekt — vorhandene `eslint-disable-line`-Kommentare sind historisch, keine neuen hinzufügen.
- Tests laufen mit `npm test` (Vitest, einmalig) bzw. `npm run test:watch`.
- Alle `/api/*`-Routen ausschließlich in `src/server/apiRoutes.js`. `index.js` und `prod.js` nicht anfassen.
- AI-Modell-Default: `claude-sonnet-5` über die bestehende `MODEL`-Konstante. **Kein `temperature`** — der Parameter wird abgelehnt.
- Sleeper `settings.type` ist eine **Zahl** (0=redraft, 1=keeper, 2=dynasty) — nie gegen String-Literale vergleichen.
- Der Nutzer-Key reist im Header `x-anthropic-key`, niemals im Body.
- Nach Codeänderungen `graphify update .` laufen lassen.

---

### Task 1: Matching-Logik

**Files:**
- Create: `src/services/strategyMatch.js`
- Test: `src/services/strategyMatch.test.js`

**Interfaces:**
- Consumes: nichts (reine Funktionen, keine Imports aus dem Projekt)
- Produces:
  - `makeFingerprint({ format, season, draftMode }) → Fingerprint`
  - `pickStrategy(items, fingerprint) → { item, deviations } | null`
  - `resolveStrategyText(store, fingerprint) → string`
  - `Fingerprint = { draftMode: string, scoringType: string, superflex: boolean, season: string, teams: number, starters: string[] }`

- [ ] **Step 1: Testdatei schreiben**

Erstelle `src/services/strategyMatch.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { makeFingerprint, pickStrategy, resolveStrategyText } from './strategyMatch'

const FORMAT = {
  scoringType: 'half_ppr',
  superflex: false,
  teams: 12,
  rosterPositions: ['QB','RB','RB','WR','WR','TE','FLEX','BN','BN','BN'],
}

const fp = (over = {}) => ({
  draftMode: 'redraft', scoringType: 'half_ppr', superflex: false,
  season: '2026', teams: 12, starters: ['FLEX','QB','RB','RB','TE','WR','WR'],
  ...over,
})

const item = (over = {}) => ({
  id: 'a', label: 'A', fingerprint: fp(), summary: 'Leitlinie.', rules: ['R1'],
  sources: [], contested: [], source: 'ai', createdAt: '2026-07-01T00:00:00.000Z',
  ...over,
})

describe('makeFingerprint', () => {
  it('entfernt BN und sortiert die Starter stabil', () => {
    const got = makeFingerprint({ format: FORMAT, season: 2026, draftMode: 'redraft' })
    expect(got.starters).toEqual(['FLEX','QB','RB','RB','TE','WR','WR'])
  })

  it('normalisiert season zu String, teams zu Number, superflex zu Boolean', () => {
    const got = makeFingerprint({
      format: { ...FORMAT, teams: '12', superflex: 1 },
      season: 2026,
      draftMode: 'redraft',
    })
    expect(got.season).toBe('2026')
    expect(got.teams).toBe(12)
    expect(got.superflex).toBe(true)
  })
})

describe('pickStrategy — harter Filter', () => {
  it('waehlt eine Dynasty-Strategie nie im Redraft', () => {
    const items = [item({ fingerprint: fp({ draftMode: 'rookie' }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })

  it('schliesst abweichendes Scoring aus', () => {
    const items = [item({ fingerprint: fp({ scoringType: 'ppr' }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })

  it('schliesst abweichendes Superflex aus', () => {
    const items = [item({ fingerprint: fp({ superflex: true }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })

  it('schliesst eine andere Saison aus', () => {
    const items = [item({ fingerprint: fp({ season: '2025' }) })]
    expect(pickStrategy(items, fp())).toBeNull()
  })
})

describe('pickStrategy — weiche Auswahl', () => {
  it('liefert bei exaktem Treffer keine Abweichungen', () => {
    const got = pickStrategy([item()], fp())
    expect(got.item.id).toBe('a')
    expect(got.deviations).toEqual([])
  })

  it('bevorzugt den Kandidaten mit weniger Abweichungen', () => {
    const items = [
      item({ id: 'weit', fingerprint: fp({ teams: 8, starters: ['QB','RB','WR'] }) }),
      item({ id: 'nah',  fingerprint: fp({ teams: 10 }) }),
    ]
    const got = pickStrategy(items, fp())
    expect(got.item.id).toBe('nah')
    expect(got.deviations).toHaveLength(1)
    expect(got.deviations[0]).toContain('10')
  })

  it('nimmt bei Gleichstand den juengeren Eintrag', () => {
    const items = [
      item({ id: 'alt',  createdAt: '2026-01-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
      item({ id: 'neu',  createdAt: '2026-06-01T00:00:00.000Z', fingerprint: fp({ teams: 10 }) }),
    ]
    expect(pickStrategy(items, fp()).item.id).toBe('neu')
  })
})

describe('pickStrategy — Wildcard', () => {
  it('gewinnt nur, wenn kein echter Treffer existiert', () => {
    const wild = item({ id: 'wild', fingerprint: null })
    expect(pickStrategy([wild], fp()).item.id).toBe('wild')
    expect(pickStrategy([wild, item({ id: 'echt' })], fp()).item.id).toBe('echt')
  })
})

describe('resolveStrategyText', () => {
  const store = { version: 1, principles: 'DEF wird gestreamt.', items: [item()] }

  it('enthaelt Grundsaetze und Regeln, aber keine Quellen', () => {
    const text = resolveStrategyText(
      { ...store, items: [item({ sources: [{ title: 'FP', url: 'https://fantasypros.com/x' }] })] },
      fp(),
    )
    expect(text).toContain('DEF wird gestreamt.')
    expect(text).toContain('Leitlinie.')
    expect(text).toContain('R1')
    expect(text).not.toContain('fantasypros.com')
  })

  it('liefert nur die Grundsaetze, wenn keine Strategie passt', () => {
    const text = resolveStrategyText(store, fp({ season: '2099' }))
    expect(text).toBe('DEF wird gestreamt.')
  })

  it('kappt bei 4000 Zeichen', () => {
    const long = item({ rules: ['x'.repeat(5000)] })
    const text = resolveStrategyText({ ...store, items: [long] }, fp())
    expect(text.length).toBe(4000)
  })

  it('kommt mit leerem Store klar', () => {
    expect(resolveStrategyText({ version: 1, principles: '', items: [] }, fp())).toBe('')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/services/strategyMatch.test.js`
Expected: FAIL — `Failed to resolve import "./strategyMatch"`

- [ ] **Step 3: Implementierung schreiben**

Erstelle `src/services/strategyMatch.js`:

```js
// Ordnet einer Liga/einem Draft die passende gespeicherte Draft-Strategie zu.
// Reine Funktionen ohne React- oder Storage-Abhaengigkeit, damit testbar.

const MAX_STRATEGY_CHARS = 4000

// Rundenzahl und Draft-Typ (snake/auction) fehlen hier bewusst: sie aendern die
// Strategie kaum, wuerden aber laufend falsche Nicht-Treffer erzeugen.
export function makeFingerprint({ format = {}, season, draftMode } = {}) {
  const roster = Array.isArray(format.rosterPositions) ? format.rosterPositions : []
  return {
    draftMode: String(draftMode || 'redraft'),
    scoringType: String(format.scoringType || 'ppr'),
    // Normalisierung ist Pflicht: season kommt je nach Herkunft als Zahl oder
    // String, teams ebenso. Ohne sie scheitert der harte Filter still.
    superflex: !!format.superflex,
    season: String(season ?? ''),
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

function deviationsBetween(itemFp, fp) {
  const out = []
  if (itemFp.teams !== fp.teams) {
    out.push(`aus einer ${itemFp.teams}er-Liga, du draftest in einer ${fp.teams}er`)
  }
  if (!sameStarters(itemFp.starters, fp.starters)) {
    out.push(`andere Starter-Slots (${itemFp.starters.join(', ')})`)
  }
  return out
}

export function pickStrategy(items, fp) {
  if (!Array.isArray(items) || !items.length || !fp) return null

  const wildcards = items.filter(i => !i?.fingerprint)
  const matches = items.filter(i => {
    const f = i?.fingerprint
    if (!f) return false
    return f.draftMode === fp.draftMode
      && f.scoringType === fp.scoringType
      && !!f.superflex === !!fp.superflex
      && String(f.season) === fp.season
  })

  if (matches.length) {
    const scored = matches
      .map(item => ({ item, deviations: deviationsBetween(item.fingerprint, fp) }))
      .sort((a, b) => {
        const d = a.deviations.length - b.deviations.length
        if (d !== 0) return d
        return String(b.item.createdAt || '').localeCompare(String(a.item.createdAt || ''))
      })
    return scored[0]
  }

  if (wildcards.length) {
    const newest = [...wildcards].sort(
      (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    )[0]
    return { item: newest, deviations: [] }
  }

  return null
}

// Nur dieser Text geht in den AI-Prompt. sources und contested bleiben draussen —
// sie sind fuer die Anzeige, nicht fuer das Modell.
export function resolveStrategyText(store, fp) {
  const principles = String(store?.principles || '').trim()
  const hit = pickStrategy(store?.items, fp)

  const parts = []
  if (principles) parts.push(principles)
  if (hit?.item) {
    const summary = String(hit.item.summary || '').trim()
    if (summary) parts.push(summary)
    const rules = Array.isArray(hit.item.rules) ? hit.item.rules : []
    if (rules.length) parts.push(rules.map(r => `- ${r}`).join('\n'))
  }

  return parts.join('\n\n').slice(0, MAX_STRATEGY_CHARS)
}
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/services/strategyMatch.test.js`
Expected: PASS, 14 Tests

- [ ] **Step 5: Committen**

```bash
git add src/services/strategyMatch.js src/services/strategyMatch.test.js
git commit -m "feat(strategy): Fingerprint-Matching fuer Draft-Strategien"
```

---

### Task 2: Persistenz und Migration

**Files:**
- Create: `src/services/strategyStore.js`
- Test: `src/services/strategyStore.test.js`
- Modify: `src/stores/migrate.js`

**Interfaces:**
- Consumes: nichts aus Task 1 (bewusst getrennt — Matching kennt kein localStorage)
- Produces:
  - `STRATEGIES_KEY = 'sdh.strategies.v1'`
  - `loadStrategies() → { version: 1, principles: string, items: Item[] }`
  - `saveStrategies(store) → void`
  - `migrateLegacyStrategy() → void` (idempotent)
  - `newStrategyItem({ label, fingerprint, summary, rules, sources, contested, source }) → Item`

- [ ] **Step 1: Testdatei schreiben**

Erstelle `src/services/strategyStore.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import {
  STRATEGIES_KEY, loadStrategies, saveStrategies, migrateLegacyStrategy, newStrategyItem,
} from './strategyStore'

beforeEach(() => { localStorage.clear() })

describe('loadStrategies', () => {
  it('liefert einen leeren Store, wenn nichts gespeichert ist', () => {
    expect(loadStrategies()).toEqual({ version: 1, principles: '', items: [] })
  })

  it('liefert einen leeren Store bei kaputtem JSON', () => {
    localStorage.setItem(STRATEGIES_KEY, '{nicht json')
    expect(loadStrategies()).toEqual({ version: 1, principles: '', items: [] })
  })

  it('ergaenzt fehlende Felder', () => {
    localStorage.setItem(STRATEGIES_KEY, JSON.stringify({ version: 1 }))
    expect(loadStrategies()).toEqual({ version: 1, principles: '', items: [] })
  })
})

describe('saveStrategies', () => {
  it('schreibt und liest zurueck', () => {
    saveStrategies({ version: 1, principles: 'P', items: [] })
    expect(loadStrategies().principles).toBe('P')
  })
})

describe('migrateLegacyStrategy', () => {
  it('uebernimmt sdh.strategy.v1 als Wildcard-Item', () => {
    localStorage.setItem('sdh.strategy.v1', 'Alter Text')
    migrateLegacyStrategy()
    const store = loadStrategies()
    expect(store.items).toHaveLength(1)
    expect(store.items[0].fingerprint).toBeNull()
    expect(store.items[0].summary).toBe('Alter Text')
    expect(store.items[0].source).toBe('manual')
  })

  it('laesst den alten Key stehen (Rollback bleibt moeglich)', () => {
    localStorage.setItem('sdh.strategy.v1', 'Alter Text')
    migrateLegacyStrategy()
    expect(localStorage.getItem('sdh.strategy.v1')).toBe('Alter Text')
  })

  it('ist idempotent', () => {
    localStorage.setItem('sdh.strategy.v1', 'Alter Text')
    migrateLegacyStrategy()
    migrateLegacyStrategy()
    expect(loadStrategies().items).toHaveLength(1)
  })

  it('tut nichts ohne alten Key', () => {
    migrateLegacyStrategy()
    expect(localStorage.getItem(STRATEGIES_KEY)).toBeNull()
  })

  it('tut nichts bei leerem alten Key', () => {
    localStorage.setItem('sdh.strategy.v1', '   ')
    migrateLegacyStrategy()
    expect(localStorage.getItem(STRATEGIES_KEY)).toBeNull()
  })
})

describe('newStrategyItem', () => {
  it('vergibt id und createdAt', () => {
    const it1 = newStrategyItem({ label: 'A', summary: 'S' })
    expect(it1.id).toBeTruthy()
    expect(it1.createdAt).toBeTruthy()
    expect(it1.rules).toEqual([])
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/services/strategyStore.test.js`
Expected: FAIL — `Failed to resolve import "./strategyStore"`

- [ ] **Step 3: Implementierung schreiben**

Erstelle `src/services/strategyStore.js`:

```js
// Persistenz der Draft-Strategie-Bibliothek. Bewusst getrennt von
// strategyMatch.js: das Matching kennt kein localStorage und bleibt rein testbar.

export const STRATEGIES_KEY = 'sdh.strategies.v1'
const LEGACY_KEY = 'sdh.strategy.v1'

const EMPTY = { version: 1, principles: '', items: [] }

export function loadStrategies() {
  try {
    const raw = JSON.parse(localStorage.getItem(STRATEGIES_KEY) || 'null')
    if (!raw || typeof raw !== 'object') return { ...EMPTY }
    return {
      version: 1,
      principles: String(raw.principles || ''),
      items: Array.isArray(raw.items) ? raw.items : [],
    }
  } catch {
    return { ...EMPTY }
  }
}

export function saveStrategies(store) {
  try {
    localStorage.setItem(STRATEGIES_KEY, JSON.stringify({
      version: 1,
      principles: String(store?.principles || ''),
      items: Array.isArray(store?.items) ? store.items : [],
    }))
  } catch {}
}

export function newStrategyItem({
  label = '', fingerprint = null, summary = '', rules = [],
  sources = [], contested = [], source = 'manual',
} = {}) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? `str_${crypto.randomUUID()}`
    : `str_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  return {
    id, label, fingerprint, summary,
    rules: Array.isArray(rules) ? rules : [],
    sources: Array.isArray(sources) ? sources : [],
    contested: Array.isArray(contested) ? contested : [],
    source,
    createdAt: new Date().toISOString(),
  }
}

// Uebernimmt den alten globalen Freitext als Wildcard-Item (fingerprint: null) —
// es passt damit ueberall, wird aber nie einem echten Format-Treffer vorgezogen.
// Der alte Key bleibt liegen, damit ein Rollback moeglich bleibt.
export function migrateLegacyStrategy() {
  try {
    if (localStorage.getItem(STRATEGIES_KEY)) return
    const legacy = String(localStorage.getItem(LEGACY_KEY) || '').trim()
    if (!legacy) return
    saveStrategies({
      version: 1,
      principles: '',
      items: [newStrategyItem({ label: 'Uebernommen', summary: legacy, source: 'manual' })],
    })
    console.log('[SDH] Draft-Strategie aus sdh.strategy.v1 uebernommen')
  } catch {}
}
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/services/strategyStore.test.js`
Expected: PASS, 10 Tests

- [ ] **Step 5: Migration beim Start aufrufen**

`migrateOldStorage()` verlässt die Funktion früh, sobald `sdh-session-v1` existiert — also bei jedem Nutzer, der die alte Migration schon hinter sich hat. Der Aufruf muss deshalb **vor** dieses `return`, sonst läuft er bei genau den Bestandsnutzern nie, für die er gedacht ist.

Import in `src/stores/migrate.js` oben ergänzen:

```js
import { migrateLegacyStrategy } from '../services/strategyStore'
```

Dann die Zeilen 4–5 ersetzen. Vorher:

```js
  const SESSION_KEY = 'sdh-session-v1'
  if (localStorage.getItem(SESSION_KEY)) return // already migrated
```

Nachher:

```js
  const SESSION_KEY = 'sdh-session-v1'
  // Vor dem fruehen return: laeuft sonst nie bei Nutzern, die die alte
  // Migration schon hinter sich haben.
  migrateLegacyStrategy()
  if (localStorage.getItem(SESSION_KEY)) return // already migrated
```

Das ist der einzige Aufruf — nicht zusätzlich ans Funktionsende setzen.

- [ ] **Step 6: Gesamte Suite laufen lassen**

Run: `npm test`
Expected: PASS, keine Regression

- [ ] **Step 7: Committen**

```bash
git add src/services/strategyStore.js src/services/strategyStore.test.js src/stores/migrate.js
git commit -m "feat(strategy): Persistenz und Migration der Strategie-Bibliothek"
```

---

### Task 3: Server-Route mit Web-Recherche

**Files:**
- Modify: `src/server/apiRoutes.js`
- Test: `src/server/apiRoutes.test.js`

**Interfaces:**
- Consumes: `applyPromptCaching()`, `setSSEHeaders()`, `sendSSE()`, `MODEL` (alle bereits in der Datei)
- Produces:
  - `STRATEGY_TOOL` (exportiert, für den Test)
  - `STRATEGY_SOURCES` (exportiert, für den Test)
  - `buildStrategyPrompt({ format, season, draftMode, draftSlot, principles }) → string` (exportiert)
  - Route `POST /api/ai-draft-strategy`, SSE mit `event: result | error`

- [ ] **Step 1: Test schreiben**

Ergänze in `src/server/apiRoutes.test.js` (Import oben erweitern, dann Block anhängen):

```js
import { STRATEGY_TOOL, STRATEGY_SOURCES, buildStrategyPrompt } from './apiRoutes.js'

describe('STRATEGY_SOURCES', () => {
  it('trennt Redraft- und Rookie-Quellen', () => {
    expect(STRATEGY_SOURCES.redraft).toContain('fantasypros.com')
    expect(STRATEGY_SOURCES.rookie).toContain('dynastyleaguefootball.com')
  })

  it('enthaelt kein reddit.com — dort ist der Crawler gesperrt', () => {
    const all = [...STRATEGY_SOURCES.redraft, ...STRATEGY_SOURCES.rookie]
    expect(all.some(d => d.includes('reddit'))).toBe(false)
  })

  it('nennt Domains ohne Schema', () => {
    const all = [...STRATEGY_SOURCES.redraft, ...STRATEGY_SOURCES.rookie]
    for (const d of all) expect(d).not.toMatch(/^https?:\/\//)
  })
})

describe('STRATEGY_TOOL', () => {
  it('verlangt summary, rules und sources', () => {
    expect(STRATEGY_TOOL.input_schema.required).toEqual(['summary', 'rules', 'sources'])
  })

  it('begrenzt rules auf 4 bis 6', () => {
    expect(STRATEGY_TOOL.input_schema.properties.rules.minItems).toBe(4)
    expect(STRATEGY_TOOL.input_schema.properties.rules.maxItems).toBe(6)
  })
})

describe('buildStrategyPrompt', () => {
  const base = {
    format: { teams: 12, scoringType: 'half_ppr', superflex: false, rosterPositions: ['QB','RB','WR'] },
    season: '2026', draftMode: 'redraft', draftSlot: 7, principles: 'DEF wird gestreamt.',
  }

  it('setzt Format und Saison in den Query-Plan ein', () => {
    const p = buildStrategyPrompt(base)
    expect(p).toContain('12')
    expect(p).toContain('half_ppr')
    expect(p).toContain('2026')
    expect(p).toContain('1QB')
  })

  it('nennt den Draft-Slot, wenn bekannt', () => {
    expect(buildStrategyPrompt(base)).toContain('Draft-Slot 7')
  })

  // Auf 'Draft-Slot' pruefen, nicht auf 'Slot': der Prompt nennt immer die
  // 'Starter-Slots', ein blosses toContain('Slot') waere immer wahr.
  it('laesst die Slot-Frage weg, wenn kein Slot bekannt ist', () => {
    expect(buildStrategyPrompt({ ...base, draftSlot: null })).not.toContain('Draft-Slot')
  })

  it('markiert Superflex', () => {
    expect(buildStrategyPrompt({ ...base, format: { ...base.format, superflex: true } }))
      .toContain('Superflex')
  })

  it('uebernimmt die Grundsaetze als unveraenderlich', () => {
    const p = buildStrategyPrompt(base)
    expect(p).toContain('DEF wird gestreamt.')
    expect(p).toMatch(/nicht umschreiben|unveraenderlich|gesetzt/i)
  })

  it('weist an, Widersprueche zu benennen statt aufzuloesen', () => {
    expect(buildStrategyPrompt(base)).toMatch(/contested/)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/server/apiRoutes.test.js`
Expected: FAIL — `STRATEGY_TOOL` ist kein Export

- [ ] **Step 3: Schema, Quellen und Prompt-Builder ergänzen**

In `src/server/apiRoutes.js`, direkt **nach** dem `REVIEW_TOOL`-Block (nach Zeile 116) einfügen:

```js
// ---------- Draft-Strategie: Quellen, Schema, Prompt ----------
// Whitelist getrennt nach Draft-Modus: DLF ist fuer Redraft wertlos, FantasyPros
// und 4for4 sind fuer Dynasty duenn. reddit.com fehlt bewusst — der Anthropic-
// Crawler ist dort gesperrt (HTTP 400), Subreddits sind nicht erreichbar.
export const STRATEGY_SOURCES = {
  redraft: ['fantasypros.com', '4for4.com', 'footballguys.com', 'rotoballer.com'],
  rookie:  ['dynastyleaguefootball.com', 'footballguys.com', 'fantasypros.com', 'keeptradecut.com'],
}

export const STRATEGY_TOOL = {
  name: 'return_draft_strategy',
  description: 'Kompakte, recherchierte Draft-Strategie fuer ein konkretes Liga-Format und eine konkrete Saison.',
  input_schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Ein Satz Leitlinie, Deutsch (du-Form).' },
      rules: {
        type: 'array', minItems: 4, maxItems: 6,
        description: 'Konkrete Regeln mit Rundenbezug, Deutsch (du-Form).',
        items: { type: 'string' },
      },
      sources: {
        type: 'array',
        description: 'Belegende Quellen aus der Websuche. Nur tatsaechlich verwendete URLs.',
        items: {
          type: 'object',
          properties: { title: { type: 'string' }, url: { type: 'string' } },
          required: ['title', 'url'],
        },
      },
      contested: {
        type: 'array',
        description: 'Punkte, in denen sich die Quellen widersprechen. Leer lassen, wenn es keine gibt.',
        items: { type: 'string' },
      },
    },
    required: ['summary', 'rules', 'sources'],
  },
}

// Der Query-Plan ist fest: die Fragen sind jedes Jahr dieselben, nur das Format
// wechselt. Vier gezielte Suchen schlagen fuenfzehn tastende — deshalb steht der
// Plan hier und nicht im Ermessen des Modells.
export function buildStrategyPrompt({ format = {}, season, draftMode, draftSlot, principles } = {}) {
  const qb = format.superflex ? 'Superflex' : '1QB'
  const modus = draftMode === 'rookie' ? 'Dynasty/Rookie-Draft' : 'Redraft'
  const starters = (format.rosterPositions || []).filter(s => String(s).toUpperCase() !== 'BN').join(', ')

  const queries = [
    `Draft-Strategie fuer ${format.teams} Teams, ${format.scoringType}, ${qb}, Saison ${season}`,
    `Positions-Tiefe und Knappheit in ${season}`,
    ...(draftSlot ? [`Vorgehen an Draft-Slot ${draftSlot}`] : []),
    `Tragfaehigkeit der gaengigen Strategien (Zero RB, Hero RB, Robust RB) in ${season}`,
  ]

  return [
    `Du erstellst eine Draft-Strategie fuer eine Fantasy-Football-Liga (${modus}).`,
    '',
    'Format:',
    `- Teams: ${format.teams}`,
    `- Scoring: ${format.scoringType}`,
    `- ${qb}`,
    `- Starter-Slots: ${starters}`,
    `- Saison: ${season}`,
    ...(draftSlot ? [`- Draft-Slot: ${draftSlot}`] : []),
    '',
    'Recherchiere mit der Websuche genau diese Punkte, in dieser Reihenfolge:',
    ...queries.map((q, i) => `${i + 1}. ${q}`),
    '',
    'Regeln fuer das Ergebnis:',
    '- Alle Freitexte auf Deutsch, du-Form.',
    '- Jede Regel nennt einen Rundenbezug.',
    '- Widersprechen sich Quellen, gehoert der Konflikt nach contested. Loese ihn nicht zugunsten einer Seite auf.',
    '- Nenne in sources nur URLs, die du tatsaechlich gelesen hast.',
    '- Halte dich kurz: eine Leitlinie, vier bis sechs Regeln.',
    ...(String(principles || '').trim() ? [
      '',
      'Die folgenden Grundsaetze des Nutzers sind gesetzt. Beruecksichtige sie, aber schreibe sie nicht um',
      'und wiederhole sie nicht in den Regeln:',
      String(principles).trim(),
    ] : []),
  ].join('\n')
}
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/server/apiRoutes.test.js`
Expected: PASS

- [ ] **Step 5: Route ergänzen**

In `src/server/apiRoutes.js`, innerhalb von `registerApiRoutes()` **vor** der schließenden Klammer (nach der `ai-trade`-Route, Zeile 542) einfügen:

```js
  // ---------- Draft-Strategie erzeugen (SSE streaming, mit Websuche) ----------
  app.post('/api/ai-draft-strategy', async (req, res) => {
    const userKey = req.header('x-anthropic-key')
    if (!userKey) return res.status(401).json({ ok: false, error: 'Missing X-Anthropic-Key header' })

    const { format, season, draftMode, draftSlot = null, principles = '' } = req.body || {}
    if (!format || !season) {
      return res.status(400).json({ ok: false, error: 'Invalid payload: expected { format, season, draftMode }' })
    }

    setSSEHeaders(res)

    try {
      const mode = draftMode === 'rookie' ? 'rookie' : 'redraft'
      const prompt = buildStrategyPrompt({ format, season, draftMode: mode, draftSlot, principles })

      const p = applyPromptCaching({
        system: 'Du bist ein erfahrener Fantasy-Football-Analyst. Du recherchierst belegbar und antwortest ausschliesslich ueber das bereitgestellte Tool.',
        tools: [
          {
            type: 'web_search_20260318',
            name: 'web_search',
            max_uses: 6,
            allowed_domains: STRATEGY_SOURCES[mode],
            // Rohtreffer nicht in die Antwort spiegeln — wir brauchen nur das Schema.
            response_inclusion: 'excluded',
          },
          STRATEGY_TOOL,
        ],
      })

      const client = new Anthropic({ apiKey: userKey })
      let messages = [{ role: 'user', content: prompt }]
      let finalMessage = null

      // Server-Tools koennen die Antwort mit stop_reason "pause_turn" unterbrechen.
      // Fortsetzen heisst: die Assistant-Nachricht unveraendert zurueckschicken.
      for (let attempt = 0; attempt < 4; attempt++) {
        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          system: p.system,
          messages,
          tools: p.tools,
        })
        finalMessage = await stream.finalMessage()
        if (finalMessage.stop_reason !== 'pause_turn') break
        messages = [...messages, { role: 'assistant', content: finalMessage.content }]
      }

      if (finalMessage?.stop_reason === 'pause_turn') {
        sendSSE(res, 'error', { ok: false, message: 'Recherche wurde zu oft unterbrochen — bitte erneut versuchen' })
        return
      }

      const toolBlock = (finalMessage?.content || []).find(
        b => b.type === 'tool_use' && b.name === 'return_draft_strategy'
      )
      const parsed = toolBlock?.input || null

      if (!parsed) {
        sendSSE(res, 'error', { ok: false, message: 'Modell lieferte keine strukturierte Strategie' })
      } else {
        sendSSE(res, 'result', {
          ok: true, parsed, model: finalMessage.model, usage: finalMessage.usage,
        })
      }
    } catch (err) {
      sendSSE(res, 'error', { ok: false, message: err?.message || 'Strategie-Recherche fehlgeschlagen' })
    } finally {
      res.end()
    }
  })
```

Beachte: **kein `tool_choice`**. Ein erzwungenes `tool_choice` würde das Modell zwingen, das Tool sofort zu rufen — vor der Recherche. Die Anweisung im System-Prompt („antwortest ausschliesslich ueber das bereitgestellte Tool") übernimmt die Steuerung; das Fehlen des Tool-Blocks wird oben abgefangen.

- [ ] **Step 6: Gesamte Suite laufen lassen**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Manuell gegen die echte API prüfen**

Server starten: `npm run dev:api`

Dann in einem zweiten Terminal (echten Key einsetzen):

```bash
curl -N -X POST http://127.0.0.1:5175/api/ai-draft-strategy \
  -H 'Content-Type: application/json' \
  -H "x-anthropic-key: $ANTHROPIC_API_KEY" \
  -d '{"format":{"teams":12,"scoringType":"half_ppr","superflex":false,"rosterPositions":["QB","RB","RB","WR","WR","TE","FLEX","BN","BN"]},"season":"2026","draftMode":"redraft","draftSlot":7,"principles":"Defense wird gestreamt, letzter Pick oder gar nicht."}'
```

Expected: `event: result` mit `summary`, 4–6 `rules`, gefüllten `sources`.
Bei `event: error` mit „web search is not enabled": Websuche ist für die Organisation in der Anthropic-Console nicht freigeschaltet — das ist keine Code-Frage.

- [ ] **Step 8: Committen**

```bash
git add src/server/apiRoutes.js src/server/apiRoutes.test.js
git commit -m "feat(api): /api/ai-draft-strategy mit Websuche und Query-Plan"
```

---

### Task 4: Client für die Strategie-Route

**Files:**
- Create: `src/services/aiStrategyClient.js`
- Test: `src/services/aiStrategyClient.test.js`

**Interfaces:**
- Consumes: `getOpenAIKey()` aus `src/services/key.js`
- Produces: `callAiDraftStrategy({ format, season, draftMode, draftSlot, principles }) → Promise<{ parsed, usage, model }>`

- [ ] **Step 1: Test schreiben**

Erstelle `src/services/aiStrategyClient.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callAiDraftStrategy } from './aiStrategyClient'

const PAYLOAD = {
  format: { teams: 12, scoringType: 'half_ppr', superflex: false, rosterPositions: ['QB','RB'] },
  season: '2026', draftMode: 'redraft', draftSlot: 7, principles: 'P',
}

function sseResponse(lines) {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

beforeEach(() => { localStorage.setItem('sdh_api_key', 'sk-test') })
afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

describe('callAiDraftStrategy', () => {
  it('schickt den Key im Header, nicht im Body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(
      'event: result\ndata: {"ok":true,"parsed":{"summary":"S","rules":[],"sources":[]},"model":"m"}\n\n'
    ))
    vi.stubGlobal('fetch', fetchMock)

    await callAiDraftStrategy(PAYLOAD)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ai-draft-strategy')
    expect(opts.headers['x-anthropic-key']).toBe('sk-test')
    expect(opts.body).not.toContain('sk-test')
  })

  it('liefert das geparste Ergebnis', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(
      'event: result\ndata: {"ok":true,"parsed":{"summary":"Leitlinie","rules":["R1"],"sources":[]},"model":"m"}\n\n'
    )))
    const got = await callAiDraftStrategy(PAYLOAD)
    expect(got.parsed.summary).toBe('Leitlinie')
    expect(got.model).toBe('m')
  })

  it('wirft bei event: error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sseResponse(
      'event: error\ndata: {"ok":false,"message":"Kaputt"}\n\n'
    )))
    await expect(callAiDraftStrategy(PAYLOAD)).rejects.toThrow('Kaputt')
  })

  it('wirft ohne API-Key', async () => {
    localStorage.clear()
    await expect(callAiDraftStrategy(PAYLOAD)).rejects.toThrow(/key/i)
  })

  it('wirft bei HTTP-Fehler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Bad payload' }), { status: 400 })
    ))
    await expect(callAiDraftStrategy(PAYLOAD)).rejects.toThrow('Bad payload')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npx vitest run src/services/aiStrategyClient.test.js`
Expected: FAIL — `Failed to resolve import "./aiStrategyClient"`

- [ ] **Step 3: Implementierung schreiben**

Erstelle `src/services/aiStrategyClient.js`:

```js
import { getOpenAIKey } from './key'

// Liest den SSE-Stream von /api/ai-draft-strategy. Bewusst eigenstaendig statt
// gemeinsam mit aiDraftReviewClient: dort ist der Reader an das Review-Format
// gebunden, hier reichen result und error.
async function readSSEResult(res) {
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  let error = null
  let usage = null
  let model = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const chunks = buffer.split('\n\n')
    buffer = chunks.pop() || ''

    for (const chunk of chunks) {
      const evLine = chunk.split('\n').find(l => l.startsWith('event: '))
      const dataLine = chunk.split('\n').find(l => l.startsWith('data: '))
      if (!evLine || !dataLine) continue

      const event = evLine.slice(7).trim()
      let data = null
      try { data = JSON.parse(dataLine.slice(6)) } catch { continue }

      if (event === 'result') {
        result = data?.parsed || null
        usage = data?.usage || null
        model = data?.model || ''
      } else if (event === 'error') {
        error = data?.message || 'Strategie-Recherche fehlgeschlagen'
      }
    }
  }

  if (error) throw new Error(error)
  if (!result) throw new Error('Keine Strategie erhalten')
  return { parsed: result, usage, model }
}

/**
 * Ruft /api/ai-draft-strategy und liefert { parsed, usage, model }.
 * parsed = { summary, rules[], sources[], contested? }
 */
export async function callAiDraftStrategy({ format, season, draftMode, draftSlot = null, principles = '' }) {
  const key = getOpenAIKey()
  if (!key) throw new Error('Kein Anthropic API-Key hinterlegt')

  const res = await fetch('/api/ai-draft-strategy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-anthropic-key': key },
    body: JSON.stringify({ format, season, draftMode, draftSlot, principles }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`)
  }

  return readSSEResult(res)
}
```

- [ ] **Step 4: Tests laufen lassen, Erfolg bestätigen**

Run: `npx vitest run src/services/aiStrategyClient.test.js`
Expected: PASS, 5 Tests

- [ ] **Step 5: Committen**

```bash
git add src/services/aiStrategyClient.js src/services/aiStrategyClient.test.js
git commit -m "feat(strategy): Client fuer die Strategie-Route"
```

---

### Task 5: UI im SetupForm

**Files:**
- Create: `src/components/StrategySection.jsx`
- Modify: `src/components/SetupForm.jsx`

**Interfaces:**
- Consumes: `makeFingerprint`, `pickStrategy` (Task 1), `loadStrategies`, `saveStrategies`, `newStrategyItem` (Task 2), `callAiDraftStrategy` (Task 4)
- Produces: `<StrategySection format={eff} season={seasonYear} draftMode={draftMode} draftSlot={null} />`

Eigene Datei statt Inline: `SetupForm.jsx` ist bereits groß, und der Abschnitt hat eigenen State (Laden, Fehler, Bearbeitungsmodus).

- [ ] **Step 1: Komponente schreiben**

Erstelle `src/components/StrategySection.jsx`:

```jsx
import React, { useEffect, useMemo, useState } from 'react'
import { makeFingerprint, pickStrategy } from '../services/strategyMatch'
import { loadStrategies, saveStrategies, newStrategyItem } from '../services/strategyStore'
import { callAiDraftStrategy } from '../services/aiStrategyClient'

export default function StrategySection({ format, season, draftMode, draftSlot = null }) {
  const [store, setStore] = useState(() => loadStrategies())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null) // null | 'new' | itemId

  const fingerprint = useMemo(
    () => makeFingerprint({ format, season, draftMode }),
    [JSON.stringify(format), season, draftMode]
  )

  const hit = useMemo(() => pickStrategy(store.items, fingerprint), [store.items, fingerprint])

  useEffect(() => { saveStrategies(store) }, [JSON.stringify(store)])

  function setPrinciples(principles) {
    setStore(s => ({ ...s, principles }))
  }

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const { parsed } = await callAiDraftStrategy({
        format, season, draftMode, draftSlot, principles: store.principles,
      })
      const label = `${format.teams}er ${format.scoringType} ${season}`
      const item = newStrategyItem({
        label,
        fingerprint,
        summary: parsed.summary || '',
        rules: parsed.rules || [],
        sources: parsed.sources || [],
        contested: parsed.contested || [],
        source: 'ai',
      })
      setStore(s => ({ ...s, items: [...s.items, item] }))
    } catch (e) {
      setError(e?.message || 'Strategie konnte nicht erzeugt werden')
    } finally {
      setBusy(false)
    }
  }

  function saveEdit(id, summary, rules) {
    setStore(s => ({
      ...s,
      items: s.items.map(i => i.id === id
        ? { ...i, summary, rules: rules.split('\n').map(r => r.trim()).filter(Boolean), source: 'manual' }
        : i),
    }))
    setEditing(null)
  }

  function remove(id) {
    setStore(s => ({ ...s, items: s.items.filter(i => i.id !== id) }))
  }

  return (
    <div className="strategy-section">
      <h3>Draft-Strategie</h3>

      <label className="muted" style={{ fontSize: 12 }}>Meine Grundsätze (gelten immer)</label>
      <textarea
        rows={3}
        value={store.principles}
        onChange={e => setPrinciples(e.target.value)}
        placeholder="z. B. Defense wird gestreamt — letzter Pick oder gar nicht."
      />

      {!hit && (
        <p className="muted">
          Für dieses Format ({format.teams} Teams, {format.scoringType}, {season}) ist noch keine
          Strategie hinterlegt.
        </p>
      )}

      {hit && (
        <div className="strategy-active">
          <div className="strategy-head">
            <strong>{hit.item.label || 'Strategie'}</strong>
            <span className="badge">{hit.item.source === 'ai' ? 'KI-recherchiert' : 'manuell'}</span>
          </div>

          {hit.deviations.length > 0 && (
            <p className="warn">Achtung: {hit.deviations.join('; ')}</p>
          )}

          {editing === hit.item.id ? (
            <EditForm item={hit.item} onCancel={() => setEditing(null)} onSave={saveEdit} />
          ) : (
            <>
              <p>{hit.item.summary}</p>
              <ul>{hit.item.rules.map((r, i) => <li key={i}>{r}</li>)}</ul>

              {hit.item.contested?.length > 0 && (
                <div className="strategy-contested">
                  <strong>Uneinig in den Quellen:</strong>
                  <ul>{hit.item.contested.map((c, i) => <li key={i}>{c}</li>)}</ul>
                </div>
              )}

              {hit.item.sources?.length > 0 && (
                <div className="strategy-sources">
                  <strong>Quellen:</strong>
                  <ul>
                    {hit.item.sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer noopener">{s.title || s.url}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="strategy-actions">
        <button type="button" onClick={generate} disabled={busy}>
          {busy ? 'Recherchiere…' : hit ? 'Neu erzeugen (KI)' : 'Strategie erzeugen (KI)'}
        </button>
        {hit && editing !== hit.item.id && (
          <button type="button" onClick={() => setEditing(hit.item.id)}>Bearbeiten</button>
        )}
        {hit && (
          <button type="button" onClick={() => remove(hit.item.id)}>Löschen</button>
        )}
      </div>

      {busy && (
        <p className="muted">
          Die KI durchsucht Experten-Quellen. Das dauert typischerweise 20–40 Sekunden.
        </p>
      )}
    </div>
  )
}

function EditForm({ item, onCancel, onSave }) {
  const [summary, setSummary] = useState(item.summary)
  const [rules, setRules] = useState((item.rules || []).join('\n'))
  return (
    <div className="strategy-edit">
      <label className="muted" style={{ fontSize: 12 }}>Leitlinie</label>
      <textarea rows={2} value={summary} onChange={e => setSummary(e.target.value)} />
      <label className="muted" style={{ fontSize: 12 }}>Regeln (eine pro Zeile)</label>
      <textarea rows={6} value={rules} onChange={e => setRules(e.target.value)} />
      <div className="strategy-actions">
        <button type="button" onClick={() => onSave(item.id, summary, rules)}>Speichern</button>
        <button type="button" onClick={onCancel}>Abbrechen</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: In SetupForm einhängen**

In `src/components/SetupForm.jsx` den Import oben ergänzen:

```js
import StrategySection from './StrategySection'
```

Und im JSX direkt **nach** dem Format-Bereich (dem Block, den `showFormat` / `showAdvancedFormat` steuert) einfügen:

```jsx
<StrategySection
  format={eff}
  season={seasonYear}
  draftMode={draftMode}
  draftSlot={null}
/>
```

`eff` (Zeile 78) liefert `scoring_type`, `roster_positions`, `superflex`, `teams`. `makeFingerprint` erwartet aber `scoringType` und `rosterPositions` — deshalb beim Übergeben umbenennen:

```jsx
<StrategySection
  format={{
    teams: eff.teams,
    scoringType: eff.scoring_type,
    superflex: eff.superflex,
    rosterPositions: eff.roster_positions,
  }}
  season={seasonYear}
  draftMode={draftMode}
  draftSlot={null}
/>
```

`seasonYear` und `draftMode` sind bereits Props von `SetupForm` (Zeilen 18 und 26) — nichts weiter zu verdrahten.

- [ ] **Step 3: Im Browser prüfen**

Dev-Server über das Preview-Tool starten (nicht über Bash), zu `/setup` navigieren, Liga und Draft wählen, Format-Bereich aufklappen.

Prüfen: Der Abschnitt „Draft-Strategie" erscheint. Ohne Eintrag steht dort der Hinweis mit dem konkreten Format. Grundsätze lassen sich tippen und überleben einen Reload.

- [ ] **Step 4: Erzeugung einmal echt auslösen**

Auf „Strategie erzeugen (KI)" klicken. `npm run dev:all` muss laufen, ein gültiger Key hinterlegt sein.

Expected: Nach 20–40 Sekunden erscheinen Leitlinie, vier bis sechs Regeln und eine Quellenliste mit klickbaren Links.

- [ ] **Step 5: Committen**

```bash
git add src/components/StrategySection.jsx src/components/SetupForm.jsx
git commit -m "feat(setup): Strategie-Bibliothek im Setup"
```

---

### Task 6: Umstellung der Prompt-Quelle

**Files:**
- Modify: `src/components/BoardSection.jsx:242`, `src/components/BoardSection.jsx:335`
- Modify: `src/components/ApiKeyDialog.jsx`

**Interfaces:**
- Consumes: `makeFingerprint`, `resolveStrategyText` (Task 1), `loadStrategies` (Task 2)
- Produces: nichts Neues — `ai.js` und `adviceRequestArgs.js` bleiben unverändert.

- [ ] **Step 1: BoardSection umstellen**

Imports oben in `src/components/BoardSection.jsx` ergänzen:

```js
import { makeFingerprint, resolveStrategyText } from '../services/strategyMatch'
import { loadStrategies } from '../services/strategyStore'
import { useSessionStore } from '../stores/useSessionStore'
```

`BoardSection` kennt `seasonYear` bisher nicht — im Komponentenrumpf, oben bei den übrigen Hooks, ergänzen:

```js
  const seasonYear = useSessionStore(s => s.seasonYear)
```

Direkt darunter den Strategietext ableiten. Er ersetzt beide `localStorage.getItem('sdh.strategy.v1')`-Aufrufe:

```js
  // Ersetzt den fruehen globalen Freitext: die Strategie wird jetzt nach
  // Liga-Format ausgewaehlt (siehe strategyMatch.js).
  const customStrategyText = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const fp = makeFingerprint({
      format: {
        teams: teamsCount,
        scoringType: draftFormat.scoringType,
        superflex: draftFormat.isSuperflex,
        rosterPositions,
      },
      season: seasonYear,
      draftMode,
    })
    return resolveStrategyText(loadStrategies(), fp)
  }, [teamsCount, draftFormat.scoringType, draftFormat.isSuperflex,
      JSON.stringify(rosterPositions), seasonYear, draftMode])
```

Dann in **beiden** `buildAdviceRequestArgs`-Aufrufen (Zeile 242 und Zeile 335) diese Zeile:

```js
        customStrategyText: (typeof window !== 'undefined' ? localStorage.getItem('sdh.strategy.v1') : '') || '',
```

ersetzen durch:

```js
        customStrategyText,
```

Im Abhängigkeits-Array des `adviceEstimate`-`useMemo` (ab Zeile 247) `customStrategyText` ergänzen — sonst zeigt die Kostenschätzung einen veralteten Wert.

- [ ] **Step 2: Prüfen, dass keine Altlast bleibt**

Run: `grep -rn "sdh.strategy.v1" src/`
Expected: nur noch `src/services/strategyStore.js` (die Migration) und `src/services/strategyStore.test.js`.

- [ ] **Step 3: ApiKeyDialog aufräumen**

In `src/components/ApiKeyDialog.jsx` entfernen:
- `const STRATEGY_KEY = 'sdh.strategy.v1'` (Zeile 6) und `const MAX_STRATEGY = 4000` (Zeile 7)
- den `strategy`-State (Zeile 21) und das Vorbefüllen aus localStorage (Zeilen 30–33)
- das Speichern beim Absenden (Zeilen 56–59)
- den gesamten Block „Custom Draft Strategy" im JSX (Zeilen 117–142), inklusive Zeichenzähler

An die Stelle des JSX-Blocks tritt:

```jsx
          <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>
            Deine Draft-Strategie pflegst du jetzt im Setup — dort kennt die App
            Liga-Format und Saison und wählt die passende Strategie automatisch.
          </p>
```

Prüfen, dass `chars` nach dem Entfernen nirgends mehr verwendet wird; sonst die Berechnung ebenfalls löschen.

- [ ] **Step 4: Gesamte Suite laufen lassen**

Run: `npm test`
Expected: PASS. Besonders `src/services/adviceRequestArgs.test.js` muss grün bleiben — die Prompt-Pipeline ist unverändert.

- [ ] **Step 5: Im Browser prüfen**

Über das Preview-Tool: Auf `/board` einen Draft öffnen, „AI-Tipp" auslösen. In der Netzwerkansicht prüfen, dass `context.custom_strategy` im Payload die Grundsätze **und** die Strategie-Regeln enthält.

Gegenprobe: Im Setup die Saison auf ein Jahr ohne Strategie stellen — dann darf `custom_strategy` nur noch die Grundsätze enthalten.

- [ ] **Step 6: Graph aktualisieren und committen**

```bash
graphify update .
git add src/components/BoardSection.jsx src/components/ApiKeyDialog.jsx graphify-out/
git commit -m "feat(board): Strategie aus der Bibliothek statt globalem Freitext"
```

---

## Nach dem Plan

Aus der Spec übernommen und weiterhin vertagt: Teil C (Strategie ans laufende Board anpassen), Perplexity, score-basiertes Matching, Auffangnetz-Suche ohne Whitelist.

**Eine bewusste Abweichung von der Spec:** Der Deeplink vom Board ins Setup steht dort unter „Client", hat hier aber keinen Task. Er ist ein Einzeiler (`navigate('/setup')`) ohne eigenen Testwert, und ob er an der richtigen Stelle sitzt, weißt du erst, wenn du im Draft danach greifst. Nachziehen, sobald das der Fall ist — nicht auf Verdacht einbauen.
