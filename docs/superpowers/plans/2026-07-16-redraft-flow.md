# Redraft-Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Redraft-Pfad bekommt echte Marktdaten (ADP, Bye, K/DEF), der Mock-Draft wird zum Ein-Klick-Einstieg, und die App legt Herkunft und Alter ihrer Zahlen offen.

**Architecture:** Zwei Datenquellen werden zu einem Board vereinigt — Rang/Tier von FantasyCalc (`isDynasty=false`), Markt (ADP/Bye/Streuung) von Fantasy Football Calculator. Der Merge ist eine reine Funktion (`marketMerge.js`), die Format-Ableitung ebenfalls (`deriveFormat.js`); beide sind ohne Netz und ohne Store testbar. Darauf setzen Store-Aktionen, UI und Tipplogik auf.

**Tech Stack:** React 18, Vite, Zustand (+`persist`), Express 5, Vitest (jsdom), lucide via `src/components/Icon.jsx`.

**Spec:** `docs/superpowers/specs/2026-07-16-redraft-flow-design.md` — bei Widersprüchen gewinnt die Spec.

## Global Constraints

- **UI-Texte, Kommentare und user-sichtbare Strings sind Deutsch.** Gilt für jeden neuen String.
- **Keine Emoji als Icons.** `src/components/Icon.jsx` (lucide). Erzwungen durch `src/components/no-emoji.test.js` — dieser Test muss grün bleiben. Typografische Pfeile (→) sind erlaubt.
- **Keine rohen Hex-Werte in Komponenten.** Nur Role-Tokens aus `src/styles/tokens.css` (`--surface-*`, `--text-*`, `--accent-*`, `--live`, `--good`, `--bad`, `--pos-*`). `--border` gehört tokens.css — niemals neu bridgen (zirkulär).
- **Zahlen in JetBrains Mono mit `tabular-nums`.** Barlow Condensed **nur** für On-the-clock-Hero und kurze Spalten-/Section-Labels; Spielernamen und Datenzellen in regular Barlow, Sentence Case.
- **Keine Side-Stripe-Borders**, keine Skew/clip-path außer am On-the-clock-Hero. Radius: 2px Controls, 3px Cards.
- **`src/server/index.js` (dev, Port 5175) und `src/server/prod.js` (prod, Port 8080) sind Near-Duplikate.** Jede Änderung an einem AI-Endpoint oder Rankings-Endpoint muss in **beide** Dateien.
- **Sleeper `league.settings.type` ist eine Zahl** (0=redraft, 1=keeper, 2=dynasty) — niemals gegen String-Literale vergleichen.
- **Δ-ADP-Konvention ist `adp - rk`** (positiv = Value). Nicht umdrehen — `csv.js:56` und `useDraftTips.js:89` hängen daran.
- **Der CSV-Import bleibt unverändert.** `parseFantasyProsCsv` und `handleCsvLoad` werden nicht angefasst (Nutzer-Vorgabe).
- **Der Rookie-/Dynasty-Pfad ändert sein Verhalten nicht.** `isDynasty` defaultet auf `true`;
  `useRookieDraftTips` wird nicht angefasst. **Ausnahme (Nutzer-Entscheidung 2026-07-16):**
  `handleKtcRookieImport` bekommt den Undo-Snapshot aus Task 4 — rein additiv, ändert kein
  Rookie-Verhalten. Begründung: sonst rettet das Netz beim Redraft-Import, beim KTC-Import aber nicht.
- Tests: `npm test` (Vitest, einmalig) bzw. `npm run test:watch`. Dev: `npm run dev:all` (Client **und** API — ohne API keine Rankings).

---

## Task 0: Projekt-Hygiene (blockiert alles andere)

**Warum zuerst:** CLAUDE.md behauptet, es gäbe keinen Test-Runner. Ein Agent, der das liest, schreibt keine Tests — der gesamte TDD-Plan würde ins Leere laufen. Zusätzlich zieht Vitest ein liegengebliebenes Worktree mit rein und führt alle Tests doppelt aus.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `vitest.config.js`

**Interfaces:**
- Consumes: nichts
- Produces: verlässliches `npm test` für alle Folge-Tasks

- [ ] **Step 1: Belegen, dass der Test-Runner existiert**

Run: `npm test`
Expected: alle Tests grün.

**Hinweis zur Umgebung:** Im Haupt-Checkout (`F:/sleeper-draft-helper`) liefert das
`Tests 78 passed (78)`, weil Vitest die Worktrees unter `.claude/worktrees/` mitsammelt und die
Suite doppelt läuft. **In einem Worktree siehst du diese Doppelung nicht** — dort sind es
`Tests 39 passed (39)`, weil ein Worktree keine verschachtelten Worktrees enthält. Beide Zahlen
sind korrekt; die Doppelung ist trotzdem real und der Ausschluss in Step 2 gehört gemacht, damit
das Haupt-Checkout nicht weiter doppelt testet und ein `npm test` dort nicht auf fremde Arbeitskopien
schaut.

- [ ] **Step 2: Worktrees aus Vitest ausschließen**

`vitest.config.js` komplett ersetzen:

```js
import { defineConfig } from 'vitest/config'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // .claude/worktrees enthält Arbeitskopien des Repos — ohne diesen
    // Ausschluss läuft die komplette Suite doppelt.
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
  },
})
```

- [ ] **Step 3: Verifizieren, dass die Doppelausführung weg ist**

Run: `npm test`
Expected: `Test Files 5 passed (5)` / `Tests 39 passed (39)` — und **keine** `.claude/worktrees/`-Zeilen.
Im Worktree war das schon vorher so; entscheidend ist, dass die Zahl sich hier **nicht** ändert
(der Ausschluss darf nichts kaputt machen) und dass das Haupt-Checkout nach dem Merge nur noch
einfach testet.

- [ ] **Step 4: Fehlende Test-Abhaengigkeit nachziehen**

`@testing-library/react` und `@testing-library/jest-dom` sind bereits installiert und
`src/test/setup.js` importiert jest-dom schon. **`@testing-library/user-event` fehlt** — Tasks 8
und 10 brauchen es. Hier zentral installieren, damit es nicht in parallelen UI-Tasks doppelt passiert:

Run: `npm i -D @testing-library/user-event`
Expected: Installation ohne Fehler.

Run: `node -e "console.log(require('./package.json').devDependencies['@testing-library/user-event'])"`
Expected: eine Versionsnummer, nicht `undefined`.

- [ ] **Step 5: CLAUDE.md korrigieren**

Den Absatz unter `## Commands` ersetzen. Alt:

```
There is **no test runner and no linter configured** — do not assume `npm test`/`npm run lint` exist.
```

Neu:

```
`npm test` (Vitest, einmalig) und `npm run test:watch` **existieren und laufen**. Es gibt **keinen
Linter** — die `eslint-disable-line`-Kommentare im Quelltext sind historisch und durch kein
ESLint-Setup gedeckt.
```

Und in den Command-Block aufnehmen:

```bash
npm test          # Vitest einmalig
npm run test:watch # Vitest im Watch-Modus
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md vitest.config.js package.json package-lock.json
git commit -m "chore: Testlauf reparieren, CLAUDE.md-Behauptung korrigieren

CLAUDE.md behauptete, es gaebe keinen Test-Runner - npm test laeuft aber
(Vitest, 78 Tests gruen). Zusaetzlich zog Vitest .claude/worktrees mit
rein und fuehrte die komplette Suite doppelt aus.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1: `deriveFormat` — eine Regel statt drei Kopien

**Warum:** Die `slots_*`-Mapping-Logik steht heute dreimal (`App.jsx:102`, `SetupForm.jsx:12`, `BoardSection.jsx:81`). Genau daher kommt B3: Mocks ohne Liga verlieren ihr Format, weil zwei der drei Kopien nur `selectedLeague` lesen.

**Files:**
- Create: `src/services/draftFormat.js`
- Test: `src/services/draftFormat.test.js`

**Interfaces:**
- Consumes: nichts (reine Funktion)
- Produces:
  ```
  deriveFormat({ draft, league, overrides }) -> {
    rosterPositions: string[], scoringType: 'ppr'|'half_ppr'|'standard',
    isSuperflex: boolean, teams: number, rounds: number,
    type: 'snake'|'linear'|'auction', source: 'override'|'draft'|'league'|'default'
  }
  ```
  Konsumiert von Task 5 (Store), Task 6 (App/SetupForm/BoardSection).

- [ ] **Step 1: Den failing test schreiben**

`src/services/draftFormat.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { deriveFormat } from './draftFormat'

const draft = {
  type: 'snake',
  settings: { teams: 10, rounds: 15, slots_qb: 1, slots_rb: 2, slots_wr: 2, slots_super_flex: 1, slots_bn: 5 },
  metadata: { scoring_type: 'half_ppr' },
}
const league = {
  total_rosters: 12,
  roster_positions: ['QB', 'RB', 'WR', 'TE', 'FLEX'],
  scoring_settings: { rec: 1 },
}

describe('deriveFormat', () => {
  it('Mock ohne Liga: Format kommt aus den Draft-Settings (Regression B3)', () => {
    const f = deriveFormat({ draft, league: null, overrides: {} })
    expect(f.teams).toBe(10)
    expect(f.scoringType).toBe('half_ppr')
    expect(f.isSuperflex).toBe(true)
    expect(f.source).toBe('draft')
  })

  it('Draft schlaegt Liga', () => {
    const f = deriveFormat({ draft, league, overrides: {} })
    expect(f.teams).toBe(10)
    expect(f.scoringType).toBe('half_ppr')
  })

  it('Override schlaegt Draft', () => {
    const f = deriveFormat({ draft, league, overrides: { teams: 14, scoring_type: 'standard' } })
    expect(f.teams).toBe(14)
    expect(f.scoringType).toBe('standard')
    expect(f.source).toBe('override')
  })

  it('ohne Draft: Liga liefert Roster und Scoring', () => {
    const f = deriveFormat({ draft: null, league, overrides: {} })
    expect(f.teams).toBe(12)
    expect(f.scoringType).toBe('ppr')
    expect(f.isSuperflex).toBe(false)
    expect(f.source).toBe('league')
  })

  it('ohne alles: Defaults', () => {
    const f = deriveFormat({ draft: null, league: null, overrides: {} })
    expect(f.teams).toBe(12)
    expect(f.rounds).toBe(16)
    expect(f.type).toBe('snake')
    expect(f.scoringType).toBe('ppr')
    expect(f.source).toBe('default')
  })

  it('rosterPositions expandiert slots_* in eine Slot-Liste', () => {
    const f = deriveFormat({ draft, league: null, overrides: {} })
    expect(f.rosterPositions.filter(r => r === 'RB')).toHaveLength(2)
    expect(f.rosterPositions).toContain('SUPER_FLEX')
  })

  it('explizites superflex-Override schlaegt die Roster-Erkennung', () => {
    const f = deriveFormat({ draft, league: null, overrides: { superflex: false } })
    expect(f.isSuperflex).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- draftFormat`
Expected: FAIL — `Failed to resolve import "./draftFormat"`

- [ ] **Step 3: Implementieren**

`src/services/draftFormat.js`:

```js
// Eine einzige Quelle der Wahrheit fuer das Draft-Format.
// Vorher lag dieselbe Logik in App.jsx, SetupForm.jsx und BoardSection.jsx —
// zwei der drei Kopien lasen nur die Liga, wodurch Mocks (die keine Liga haben)
// still auf 12 Teams / PPR / 1QB zurueckfielen.

const SLOT_MAP = {
  slots_qb: 'QB', slots_rb: 'RB', slots_wr: 'WR', slots_te: 'TE',
  slots_k: 'K', slots_def: 'DEF', slots_flex: 'FLEX',
  slots_wr_rb: 'WR/RB', slots_wr_te: 'WR/TE', slots_rb_te: 'RB/TE',
  slots_super_flex: 'SUPER_FLEX', slots_idp_flex: 'IDP_FLEX',
  slots_dl: 'DL', slots_lb: 'LB', slots_db: 'DB', slots_bn: 'BN',
}

export const FORMAT_DEFAULTS = {
  teams: 12,
  rounds: 16,
  type: 'snake',
  scoringType: 'ppr',
  rosterPositions: ['QB','RB','RB','WR','WR','TE','FLEX','DEF','BN','BN','BN','BN','BN','BN'],
}

export function rosterFromDraftSettings(settings = {}) {
  const out = []
  for (const [k, v] of Object.entries(settings || {})) {
    if (!k.startsWith('slots_')) continue
    const name = SLOT_MAP[k]
    const n = Number(v)
    if (!name || !Number.isFinite(n) || n <= 0) continue
    for (let i = 0; i < n; i++) out.push(name)
  }
  return out
}

export function scoringTypeFromRec(rec) {
  const r = Number(rec)
  if (!Number.isFinite(r)) return null
  return r >= 0.95 ? 'ppr' : r >= 0.45 ? 'half_ppr' : 'standard'
}

function scoringTypeFromDraft(draft) {
  const t = String(draft?.metadata?.scoring_type || '').toLowerCase()
  return (t === 'ppr' || t === 'half_ppr' || t === 'standard') ? t : null
}

function hasSuper(roster) {
  return (roster || []).some(r => String(r).toUpperCase().includes('SUPER'))
}

export function deriveFormat({ draft = null, league = null, overrides = {} } = {}) {
  const o = overrides || {}
  const draftRoster = draft?.settings ? rosterFromDraftSettings(draft.settings) : []
  const leagueRoster = league?.roster_positions || league?.settings?.roster_positions || []

  const rosterPositions =
    o.roster_positions ??
    (draftRoster.length ? draftRoster : null) ??
    (leagueRoster.length ? leagueRoster : null) ??
    FORMAT_DEFAULTS.rosterPositions

  const scoringType =
    o.scoring_type ??
    scoringTypeFromDraft(draft) ??
    scoringTypeFromRec(league?.scoring_settings?.rec) ??
    FORMAT_DEFAULTS.scoringType

  const teams =
    Number(o.teams) ||
    Number(draft?.settings?.teams) || Number(draft?.teams) ||
    Number(league?.total_rosters) || Number(league?.league_size) ||
    FORMAT_DEFAULTS.teams

  const rounds =
    Number(o.rounds) ||
    Number(draft?.settings?.rounds) || Number(draft?.rounds) ||
    FORMAT_DEFAULTS.rounds

  const type = String(o.type ?? draft?.type ?? FORMAT_DEFAULTS.type).toLowerCase()

  const isSuperflex = o.superflex != null ? !!o.superflex : hasSuper(rosterPositions)

  // Woher stammt das Bild? Wird angezeigt (Herkunfts-Zeile), nicht nur intern genutzt.
  const source =
    (o.roster_positions || o.scoring_type || o.teams || o.rounds || o.type || o.superflex != null)
      ? 'override'
      : (draftRoster.length || draft?.settings?.teams || scoringTypeFromDraft(draft)) ? 'draft'
      : (leagueRoster.length || league?.total_rosters) ? 'league'
      : 'default'

  return { rosterPositions, scoringType, isSuperflex, teams, rounds, type, source }
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- draftFormat`
Expected: PASS — 7 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/services/draftFormat.js src/services/draftFormat.test.js
git commit -m "feat(format): deriveFormat als einzige Quelle der Wahrheit

Loest B3: Mocks ohne Liga verloren ihr Format, weil zwei der drei
Kopien der slots_*-Logik nur selectedLeague lasen.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `marketMerge` — zwei Meinungen zu einem Board

**Files:**
- Create: `src/services/marketMerge.js`
- Test: `src/services/marketMerge.test.js`

**Interfaces:**
- Consumes: `normalizePlayerName` aus `src/utils/formatting.js`
- Produces:
  ```
  mergeRankingsWithMarket(fcPlayers, ffcPlayers) -> {
    players: Array<{ ...board, rk: string, tier, sleeperId, adp, bye, stdev, high, low }>,
    stats: { total: number, withAdp: number, withoutAdp: number, unmatchedNames: string[] }
  }
  overlayMarketData(boardPlayers, ffcPlayers) -> { players, stats }
  ```
  Konsumiert von Task 5 (Store). `overlayMarketData` ist die nicht-destruktive Variante: sie fasst `rk` nicht an.

- [ ] **Step 1: Den failing test schreiben**

`src/services/marketMerge.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { mergeRankingsWithMarket, overlayMarketData } from './marketMerge'

const fc = [
  { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', overallRank: 1, tier: 1, sleeperId: '9509', value: 10491 },
  { name: 'Ja\'Marr Chase',  pos: 'WR', team: 'CIN', overallRank: 2, tier: 1, sleeperId: '7564', value: 9800 },
]
const ffc = [
  { name: 'Bijan Robinson', pos: 'RB', team: 'ATL', adp: 1.7, bye: 11, stdev: 0.7, high: 1, low: 4 },
  { name: 'Harrison Butker', pos: 'K', team: 'KC', adp: 150.2, bye: 6, stdev: 12.1, high: 120, low: 180 },
  { name: 'Ravens D/ST', pos: 'DEF', team: 'BAL', adp: 140.5, bye: 7, stdev: 10.0, high: 110, low: 170 },
]

describe('mergeRankingsWithMarket', () => {
  it('Rang und Tier kommen von FantasyCalc, ADP und Bye von FFC', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    const bijan = players.find(p => p.name === 'Bijan Robinson')
    expect(bijan.rk).toBe('1')
    expect(bijan.tier).toBe(1)
    expect(bijan.adp).toBe(1.7)
    expect(bijan.bye).toBe(11)
    expect(bijan.stdev).toBe(0.7)
  })

  it('Union: FFC-only Spieler (K/DEF) werden hinten angehaengt', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    expect(players).toHaveLength(4)
    const k = players.find(p => p.pos === 'K')
    expect(k).toBeTruthy()
    expect(Number(k.rk)).toBeGreaterThan(2)
  })

  it('angehaengte FFC-only Spieler sind nach ADP sortiert', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    const tail = players.slice(2)
    expect(tail.map(p => p.name)).toEqual(['Ravens D/ST', 'Harrison Butker'])
  })

  it('rk ist lueckenlos 1..n', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    expect(players.map(p => Number(p.rk))).toEqual([1, 2, 3, 4])
  })

  it('kein Match ist kein Fehler: adp bleibt null', () => {
    const { players } = mergeRankingsWithMarket(fc, [])
    const chase = players.find(p => p.name === 'Ja\'Marr Chase')
    expect(chase.adp).toBeNull()
    expect(chase.rk).toBe('2')
  })

  it('stats zaehlen korrekt', () => {
    const { stats } = mergeRankingsWithMarket(fc, ffc)
    expect(stats.total).toBe(4)
    expect(stats.withAdp).toBe(3)
    expect(stats.withoutAdp).toBe(1)
    expect(stats.unmatchedNames).toEqual(['Ja\'Marr Chase'])
  })

  it('leere Eingaben beidseitig', () => {
    expect(mergeRankingsWithMarket([], []).players).toEqual([])
    expect(mergeRankingsWithMarket(null, null).players).toEqual([])
    expect(mergeRankingsWithMarket([], ffc).players).toHaveLength(3)
  })

  it('jeder Spieler bekommt ein nname fuer den Pick-Abgleich', () => {
    const { players } = mergeRankingsWithMarket(fc, ffc)
    expect(players.every(p => typeof p.nname === 'string' && p.nname.length > 0)).toBe(true)
  })
})

describe('overlayMarketData', () => {
  const board = [
    { name: 'Bijan Robinson', nname: 'bijanrobinson', rk: '5', pos: 'RB', adp: null, status: 'me', pick_no: 3 },
    { name: 'Ja\'Marr Chase', nname: 'jamarrchase', rk: '1', pos: 'WR', adp: null, status: null, pick_no: null },
  ]

  it('fasst rk und Reihenfolge nicht an', () => {
    const { players } = overlayMarketData(board, ffc)
    expect(players.map(p => p.rk)).toEqual(['5', '1'])
    expect(players.map(p => p.name)).toEqual(['Bijan Robinson', 'Ja\'Marr Chase'])
  })

  it('legt nur Marktfelder drueber', () => {
    const { players } = overlayMarketData(board, ffc)
    expect(players[0].adp).toBe(1.7)
    expect(players[0].bye).toBe(11)
    expect(players[0].status).toBe('me')
    expect(players[0].pick_no).toBe(3)
  })

  it('haengt keine neuen Spieler an', () => {
    const { players } = overlayMarketData(board, ffc)
    expect(players).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- marketMerge`
Expected: FAIL — `Failed to resolve import "./marketMerge"`

- [ ] **Step 3: Implementieren**

`src/services/marketMerge.js`:

```js
import { normalizePlayerName } from '../utils/formatting'

// Ein Board braucht zwei Meinungen: eine Rangliste (wen sollte man nehmen) und
// einen Markt (wen nehmen die anderen). Nur aus der Differenz entsteht Value.
// Rang + Tier: FantasyCalc. Markt (ADP/Bye/Streuung) + K/DEF: FFC.

const MARKET_FIELDS = ['adp', 'bye', 'stdev', 'high', 'low', 'times_drafted']

function marketIndex(ffcPlayers) {
  const m = new Map()
  for (const p of ffcPlayers || []) {
    const key = p?.nname || normalizePlayerName(p?.name || '')
    if (key) m.set(key, p)
  }
  return m
}

function marketFieldsOf(src) {
  const out = {}
  for (const f of MARKET_FIELDS) out[f] = src?.[f] ?? null
  return out
}

export function mergeRankingsWithMarket(fcPlayers, ffcPlayers) {
  const market = marketIndex(ffcPlayers)
  const used = new Set()
  const unmatchedNames = []

  const ranked = (fcPlayers || [])
    .slice()
    .sort((a, b) => Number(a.overallRank) - Number(b.overallRank))
    .map((p) => {
      const nname = normalizePlayerName(p.name || '')
      const hit = market.get(nname)
      if (hit) used.add(nname)
      else unmatchedNames.push(p.name)
      return {
        ...p,
        nname,
        tier: p.tier ?? null,
        sleeperId: p.sleeperId ?? null,
        ...marketFieldsOf(hit),
        status: null, pick_no: null, picked_by: null,
      }
    })

  // Union: was nur der Markt kennt (K, DEF, tiefe Namen), haengen wir nach ADP
  // sortiert hinten an. FantasyCalc kennt weder Kicker noch Defense — im
  // 16-Runden-Redraft draftet man beide.
  const tail = (ffcPlayers || [])
    .filter((p) => {
      const nname = p?.nname || normalizePlayerName(p?.name || '')
      return nname && !used.has(nname)
    })
    .sort((a, b) => Number(a.adp) - Number(b.adp))
    .map((p) => ({
      ...p,
      nname: p.nname || normalizePlayerName(p.name || ''),
      tier: null,
      sleeperId: null,
      ...marketFieldsOf(p),
      status: null, pick_no: null, picked_by: null,
    }))

  const players = [...ranked, ...tail].map((p, i) => ({ ...p, rk: String(i + 1), ecr: i + 1 }))
  const withAdp = players.filter((p) => p.adp != null).length

  return {
    players,
    stats: {
      total: players.length,
      withAdp,
      withoutAdp: players.length - withAdp,
      unmatchedNames,
    },
  }
}

// Nicht-destruktiv: legt ausschliesslich Marktfelder ueber ein bestehendes Board.
// Fasst rk, Reihenfolge, Pick-Status und Praeferenzen nicht an — der Nutzer
// pflegt sein Board ueber Wochen, das darf ein Markt-Refresh nicht wegwerfen.
export function overlayMarketData(boardPlayers, ffcPlayers) {
  const market = marketIndex(ffcPlayers)
  let withAdp = 0
  const unmatchedNames = []

  const players = (boardPlayers || []).map((p) => {
    const nname = p?.nname || normalizePlayerName(p?.name || '')
    const hit = market.get(nname)
    if (!hit) {
      if (p.adp == null) unmatchedNames.push(p.name)
      else withAdp++
      return p
    }
    withAdp++
    return { ...p, ...marketFieldsOf(hit) }
  })

  return {
    players,
    stats: { total: players.length, withAdp, withoutAdp: players.length - withAdp, unmatchedNames },
  }
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- marketMerge`
Expected: PASS — 11 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add src/services/marketMerge.js src/services/marketMerge.test.js
git commit -m "feat(board): marketMerge - Rangliste und Markt zu einem Board vereinen

Union statt Left-Join: FantasyCalc kennt weder K noch DEF, im
16-Runden-Redraft draftet man beide.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Server — FFC-Endpoint und `isDynasty`-Parameter

**Files:**
- Modify: `src/server/index.js` (Rankings-Block ab Zeile ~126)
- Modify: `src/server/prod.js` (**identisch** — Duplikat-Pflicht, siehe Global Constraints)
- Create: `src/server/rankings.js` (gemeinsame Normalisierung, damit die Duplikat-Pflicht nicht zur Fehlerquelle wird)
- Test: `src/server/rankings.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `GET /api/rankings/ffc-adp?format=ppr|half-ppr|standard|2qb&teams=<n>&year=<season>`
    → `{ ok, meta: { source:'ffc', format, total_drafts, start_date, end_date, fetched_at }, players: [{ name, nname, pos, team, adp, adp_formatted, bye, stdev, high, low, times_drafted }] }`
  - `GET /api/rankings/fantasycalc?isDynasty=false&…` → zusätzlich `sleeperId`, `tier`, `meta`
  - Aus `rankings.js`: `FFC_FORMATS`, `normalizeFfcPlayer(raw)`, `normalizeFfcPos(pos)`
  Konsumiert von Task 5 (Store).

- [ ] **Step 1: Den failing test schreiben**

`src/server/rankings.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { FFC_FORMATS, normalizeFfcPos, normalizeFfcPlayer, isDynastyFromQuery } from './rankings'
import { normalizePlayerName } from '../utils/formatting'

describe('normalizeFfcPos', () => {
  it('FFC nennt Kicker PK — wir nennen ihn K', () => {
    expect(normalizeFfcPos('PK')).toBe('K')
  })
  it('DEF bleibt DEF', () => {
    expect(normalizeFfcPos('DEF')).toBe('DEF')
  })
  it('normale Positionen bleiben unveraendert und werden gross geschrieben', () => {
    expect(normalizeFfcPos('rb')).toBe('RB')
  })
})

describe('FFC_FORMATS', () => {
  it('ist eine Whitelist — kein Pfad-Durchreichen aus der Query', () => {
    expect(FFC_FORMATS).toContain('ppr')
    expect(FFC_FORMATS).toContain('2qb')
    expect(FFC_FORMATS).not.toContain('../../etc/passwd')
  })
})

describe('normalizeFfcPlayer', () => {
  const raw = {
    player_id: 5670, name: 'Bijan Robinson', position: 'RB', team: 'ATL',
    adp: 1.7, adp_formatted: '1.02', times_drafted: 241, high: 1, low: 4, stdev: 0.7, bye: 11,
  }
  it('bildet auf die Board-Form ab', () => {
    const p = normalizeFfcPlayer(raw)
    expect(p.name).toBe('Bijan Robinson')
    expect(p.pos).toBe('RB')
    expect(p.adp).toBe(1.7)
    expect(p.bye).toBe(11)
    expect(p.stdev).toBe(0.7)
  })
  it('setzt nname fuer den Merge — identisch zur Client-Normalisierung', () => {
    // Leerzeichen bleiben erhalten! normalizePlayerName strippt nur [^a-z\s]
    // und die Suffixe jr/sr/ii/iii/iv. Ein zusammengezogenes "bijanrobinson"
    // wuerde gegen das Board nie matchen.
    expect(normalizeFfcPlayer(raw).nname).toBe('bijan robinson')
  })
  it('strippt Suffixe wie die Client-Funktion', () => {
    expect(normalizeFfcPlayer({ ...raw, name: 'Marvin Harrison Jr.' }).nname).toBe('marvin harrison')
  })
  it('normalisiert PK zu K', () => {
    expect(normalizeFfcPlayer({ ...raw, position: 'PK' }).pos).toBe('K')
  })
})

describe('isDynastyFromQuery', () => {
  it('default ist true — der Rookie-Pfad bleibt unberuehrt (Regression)', () => {
    expect(isDynastyFromQuery(undefined)).toBe(true)
    expect(isDynastyFromQuery('')).toBe(true)
  })
  it('nur der explizite String "false" schaltet ab', () => {
    expect(isDynastyFromQuery('false')).toBe(false)
    expect(isDynastyFromQuery('true')).toBe(true)
    expect(isDynastyFromQuery('irgendwas')).toBe(true)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- rankings`
Expected: FAIL — `Failed to resolve import "./rankings"`

- [ ] **Step 3: Implementieren**

`src/server/rankings.js`:

```js
// Gemeinsame Normalisierung fuer index.js (dev) und prod.js (prod).
// Die beiden Server-Dateien sind Near-Duplikate; alles, was hier liegt,
// kann nicht auseinanderlaufen.

// Der Merge matcht Server-Daten gegen Board-Daten ueber genau diesen Schluessel.
// Deshalb wird die Client-Funktion IMPORTIERT und nicht nachgebaut: eine zweite
// Implementierung wuerde frueher oder spaeter abweichen, und dann matcht nichts
// mehr. formatting.js ist abhaengigkeitsfrei und laedt unter node.
import { normalizePlayerName } from '../utils/formatting.js'

export const FFC_FORMATS = ['ppr', 'half-ppr', 'standard', '2qb']

export function normalizeFfcPos(pos) {
  const p = String(pos || '').toUpperCase()
  return p === 'PK' ? 'K' : p
}

export function normalizeFfcPlayer(raw) {
  const name = raw?.name || ''
  return {
    name,
    nname: normalizePlayerName(name),
    pos: normalizeFfcPos(raw?.position),
    team: raw?.team || '',
    adp: raw?.adp ?? null,
    adp_formatted: raw?.adp_formatted ?? null,
    bye: raw?.bye ?? null,
    stdev: raw?.stdev ?? null,
    high: raw?.high ?? null,
    low: raw?.low ?? null,
    times_drafted: raw?.times_drafted ?? null,
  }
}

// Default true: der Rookie-/Dynasty-Pfad ruft ohne Parameter auf und muss
// unveraendert weiterlaufen.
export function isDynastyFromQuery(v) {
  return String(v) !== 'false'
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- rankings`
Expected: PASS — 10 Tests grün.

- [ ] **Step 5: `normalizePlayerNameServer` gegen den Client verifizieren**

Die Server-Normalisierung **muss** identisch zur Client-Funktion sein, sonst matcht der Merge nicht.

Run: `node -e "import('./src/utils/formatting.js').then(m => console.log(['Bijan Robinson',\"Ja'Marr Chase\",'Ravens D/ST','Amon-Ra St. Brown'].map(n => n + ' -> ' + m.normalizePlayerName(n)).join('\n')))"`

Vergleiche die Ausgabe mit `normalizePlayerNameServer`. **Wenn die Funktionen abweichen: `normalizePlayerNameServer` an den Client angleichen, nicht umgekehrt** — der Client-Wert steckt bereits in persistierten Boards. Ergänze `rankings.test.js` um einen Testfall pro abweichendem Namen.

- [ ] **Step 6: FFC-Endpoint in `index.js` ergänzen**

Direkt vor dem FantasyCalc-Block einfügen:

```js
import { FFC_FORMATS, normalizeFfcPlayer, isDynastyFromQuery } from './rankings.js'

// ---------- Rankings: Fantasy Football Calculator (ADP) ----------
app.get('/api/rankings/ffc-adp', async (req, res) => {
  const format = FFC_FORMATS.includes(String(req.query.format)) ? String(req.query.format) : 'ppr'
  const teams = parseInt(req.query.teams) || 12
  const year = parseInt(req.query.year) || new Date().getFullYear()
  const url = `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}`
  try {
    const upstream = await fetch(url)
    if (!upstream.ok) return res.status(502).json({ ok: false, error: `FFC antwortete mit ${upstream.status}` })
    const json = await upstream.json()
    if (json?.status !== 'Success' || !Array.isArray(json?.players)) {
      return res.status(502).json({ ok: false, error: 'FFC lieferte keine verwertbaren Daten' })
    }
    res.json({
      ok: true,
      meta: {
        source: 'ffc',
        format,
        total_drafts: json?.meta?.total_drafts ?? null,
        start_date: json?.meta?.start_date ?? null,
        end_date: json?.meta?.end_date ?? null,
        fetched_at: new Date().toISOString(),
      },
      players: json.players.map(normalizeFfcPlayer),
    })
  } catch (e) {
    res.status(502).json({ ok: false, error: e?.message || 'FFC nicht erreichbar' })
  }
})
```

- [ ] **Step 7: FantasyCalc-Endpoint in `index.js` reparieren**

`src/server/index.js:128–131` — `isDynasty` wird Parameter statt Konstante:

```js
app.get('/api/rankings/fantasycalc', async (req, res) => {
  const numQbs = parseInt(req.query.numQbs) === 2 ? 2 : 1
  const numTeams = parseInt(req.query.numTeams) || 12
  const ppr = req.query.ppr !== undefined ? Number(req.query.ppr) : 1
  const isDynasty = isDynastyFromQuery(req.query.isDynasty)
  const url = `https://api.fantasycalc.com/values/current?isDynasty=${isDynasty}&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${ppr}&includeAdp=false`
```

Im `players`-Mapping (ab ~Zeile 136) `sleeperId` und `tier` ergänzen und `adp: null` **belassen** (FantasyCalc liefert nachweislich keinen ADP — der kommt aus dem FFC-Endpoint):

```js
      sleeperId: fc?.player?.sleeperId ?? null,
      tier: fc?.maybeTier ?? null,
```

Und die Antwort um `meta` ergänzen:

```js
    res.json({
      ok: true,
      meta: { source: 'fantasycalc', isDynasty, numQbs, numTeams, ppr, fetched_at: new Date().toISOString() },
      players,
    })
```

- [ ] **Step 8: Schritte 6 und 7 in `prod.js` wiederholen**

`src/server/prod.js` ist ein Near-Duplikat. Dieselben zwei Änderungen, gleiche Zeilen (FantasyCalc-Block ab ~`prod.js:142`). **Diese Aufgabe ist nicht optional** — ein nur in `index.js` gefixter Endpoint funktioniert in der Produktion nicht.

Run: `diff <(grep -A 30 "rankings/ffc-adp" src/server/index.js) <(grep -A 30 "rankings/ffc-adp" src/server/prod.js)`
Expected: keine Ausgabe (identisch).

- [ ] **Step 9: Beide Endpoints live verifizieren**

Terminal 1: `npm run dev:api`
Terminal 2:

```bash
curl -s "http://127.0.0.1:5175/api/rankings/ffc-adp?format=ppr" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log('ok',d.ok,'| n',d.players.length,'| drafts',d.meta.total_drafts,'| mit adp',d.players.filter(p=>p.adp!=null).length,'| K/DEF',d.players.filter(p=>['K','DEF'].includes(p.pos)).length)})"
```
Expected: `ok true | n 207 | drafts <Zahl> | mit adp 207 | K/DEF <>0`

```bash
curl -s "http://127.0.0.1:5175/api/rankings/fantasycalc?isDynasty=false" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log('n',d.players.length,'| mit sleeperId',d.players.filter(p=>p.sleeperId).length,'| mit tier',d.players.filter(p=>p.tier!=null).length)})"
```
Expected: `n 200 | mit sleeperId 200 | mit tier 200`

```bash
curl -s "http://127.0.0.1:5175/api/rankings/fantasycalc" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log('Rookie-Regression — isDynasty:',d.meta.isDynasty,'| n:',d.players.length)})"
```
Expected: `isDynasty: true | n: 463` — der Dynasty-Pfad ist unberührt.

- [ ] **Step 10: Commit**

```bash
git add src/server/rankings.js src/server/rankings.test.js src/server/index.js src/server/prod.js
git commit -m "feat(server): FFC-ADP-Endpoint, isDynasty als Parameter

FantasyCalc war auf isDynasty=true hartkodiert - Redraft-Nutzer bekamen
Dynasty-Werte. Default bleibt true, der Rookie-Pfad ist unberuehrt.
FFC liefert erstmals ADP, Bye, Streuung und K/DEF.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Store — Import, Markt-Refresh, Undo

**Files:**
- Modify: `src/stores/useBoardStore.js`
- Test: `src/stores/useBoardStore.test.js` (neu)

**Interfaces:**
- Consumes: `mergeRankingsWithMarket`, `overlayMarketData` (Task 2); `deriveFormat` (Task 1); die Endpoints aus Task 3
- Produces:
  - `handleAutoImport({ isSuperflex, effScoringType, numTeams, draftMode })` → `{ ok, stats }`
  - `refreshMarketData()` → `{ ok, stats }` — nicht-destruktiv
  - `undoImport()` → `boolean`
  - State: `marketMeta` (persistiert), `lastBoardSnapshot` (**nicht** persistiert), `lastImportStats`
  Konsumiert von Task 6 (Herkunfts-Zeile), Task 7 (Banner).

- [ ] **Step 1: Den failing test schreiben**

`src/stores/useBoardStore.test.js`:

```js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

const FFC = {
  ok: true,
  meta: { source: 'ffc', format: 'ppr', total_drafts: 2072, end_date: '2026-07-16', fetched_at: '2026-07-16T12:00:00Z' },
  players: [{ name: 'Bijan Robinson', nname: 'bijanrobinson', pos: 'RB', team: 'ATL', adp: 1.7, bye: 11, stdev: 0.7, high: 1, low: 4 }],
}
const FC = {
  ok: true,
  meta: { source: 'fantasycalc', isDynasty: false },
  players: [{ name: 'Bijan Robinson', pos: 'RB', team: 'ATL', overallRank: 1, tier: 1, sleeperId: '9509' }],
}

function mockFetch(routes) {
  return vi.fn((url) => {
    const key = Object.keys(routes).find((k) => String(url).includes(k))
    if (!key) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) })
    const r = routes[key]
    if (r instanceof Error) return Promise.reject(r)
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(r) })
  })
}

beforeEach(() => { localStorage.clear(); vi.resetModules() })
afterEach(() => { vi.unstubAllGlobals() })

describe('refreshMarketData', () => {
  it('fasst rk und Reihenfolge nicht an', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([
      { name: 'Bijan Robinson', nname: 'bijanrobinson', rk: '7', pos: 'RB', adp: null },
    ])
    await useBoardStore.getState().refreshMarketData()
    const p = useBoardStore.getState().boardPlayers[0]
    expect(p.rk).toBe('7')
    expect(p.adp).toBe(1.7)
    expect(p.bye).toBe(11)
  })

  it('schreibt marketMeta fuer die Herkunfts-Zeile', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'X', nname: 'x', rk: '1' }])
    await useBoardStore.getState().refreshMarketData()
    expect(useBoardStore.getState().marketMeta.total_drafts).toBe(2072)
    expect(useBoardStore.getState().marketMeta.source).toBe('ffc')
  })

  it('ein fehlgeschlagener Refresh laesst das Board unangetastet', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': new Error('offline') }))
    const { useBoardStore } = await import('./useBoardStore')
    const before = [{ name: 'Bijan Robinson', nname: 'bijanrobinson', rk: '7', adp: 3.3 }]
    useBoardStore.getState().setBoardPlayers(before)
    const res = await useBoardStore.getState().refreshMarketData()
    expect(res.ok).toBe(false)
    expect(useBoardStore.getState().boardPlayers[0].adp).toBe(3.3)
    expect(useBoardStore.getState().boardPlayers[0].rk).toBe('7')
  })
})

describe('handleAutoImport (redraft)', () => {
  it('merged beide Quellen und liefert stats', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    const res = await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    expect(res.ok).toBe(true)
    expect(res.stats.withAdp).toBe(1)
    const p = useBoardStore.getState().boardPlayers[0]
    expect(p.rk).toBe('1')
    expect(p.adp).toBe(1.7)
    expect(p.tier).toBe(1)
  })

  it('ruft FantasyCalc mit isDynasty=false auf (Kern-Bugfix)', async () => {
    const f = mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC })
    vi.stubGlobal('fetch', f)
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    const fcCall = f.mock.calls.map(c => String(c[0])).find(u => u.includes('fantasycalc'))
    expect(fcCall).toContain('isDynasty=false')
  })

  it('Superflex nutzt das 2qb-Format bei FFC und numQbs=2 bei FantasyCalc', async () => {
    const f = mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC })
    vi.stubGlobal('fetch', f)
    const { useBoardStore } = await import('./useBoardStore')
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: true, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    const urls = f.mock.calls.map(c => String(c[0]))
    expect(urls.find(u => u.includes('ffc-adp'))).toContain('format=2qb')
    expect(urls.find(u => u.includes('fantasycalc'))).toContain('numQbs=2')
  })

  it('FFC weg, FantasyCalc da: Import gelingt trotzdem, ohne ADP', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': new Error('offline'), 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    const res = await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft',
    })
    expect(res.ok).toBe(true)
    expect(res.stats.withAdp).toBe(0)
    expect(useBoardStore.getState().boardPlayers).toHaveLength(1)
    expect(useBoardStore.getState().marketMeta).toBeNull()
  })

  it('FantasyCalc weg: Import schlaegt fehl, Board bleibt', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': new Error('offline') }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Alt', nname: 'alt', rk: '1' }])
    const res = await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft', force: true,
    })
    expect(res.ok).toBe(false)
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Alt')
  })
})

describe('undoImport', () => {
  it('stellt das Board von vor dem Import wieder her', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC, 'fantasycalc': FC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Handsortiert', nname: 'handsortiert', rk: '1' }])
    await useBoardStore.getState().handleAutoImport({
      isSuperflex: false, effScoringType: 'ppr', numTeams: 12, draftMode: 'redraft', force: true,
    })
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Bijan Robinson')
    expect(useBoardStore.getState().undoImport()).toBe(true)
    expect(useBoardStore.getState().boardPlayers[0].name).toBe('Handsortiert')
  })

  it('ohne Snapshot ein No-Op', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    expect(useBoardStore.getState().undoImport()).toBe(false)
  })

  it('der Snapshot wird nicht persistiert', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'A', nname: 'a', rk: '1' }])
    const raw = localStorage.getItem('sdh-board-v1') || ''
    expect(raw).not.toContain('lastBoardSnapshot')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- useBoardStore`
Expected: FAIL — `refreshMarketData is not a function`

- [ ] **Step 3: Implementieren**

In `src/stores/useBoardStore.js` die Imports ergänzen:

```js
import { mergeRankingsWithMarket, overlayMarketData } from '../services/marketMerge'
```

State ergänzen (neben `boardPlayers`):

```js
      marketMeta: null,          // { source, format, total_drafts, end_date, fetched_at }
      lastImportStats: null,     // { total, withAdp, withoutAdp, unmatchedNames }
      lastBoardSnapshot: null,   // Ein Level Undo — bewusst nicht persistiert
```

Hilfsfunktion oberhalb von `create(`:

```js
function ffcFormatFor({ isSuperflex, effScoringType }) {
  if (isSuperflex) return '2qb'
  if (effScoringType === 'half_ppr') return 'half-ppr'
  if (effScoringType === 'standard') return 'standard'
  return 'ppr'
}

async function fetchJsonOk(url) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Server antwortete mit ${resp.status}`)
  const data = await resp.json()
  if (!data.ok) throw new Error(data.error || 'Unbekannter Fehler')
  return data
}
```

`handleAutoImport` ersetzen. Der Rookie-Zweig bleibt **wortgleich** wie heute; neu ist nur der Redraft-Zweig:

```js
      handleAutoImport: async ({ isSuperflex, effScoringType, numTeams, draftMode = 'redraft', force = false } = {}) => {
        const { boardPlayers } = get()
        if (boardPlayers.length && !force) {
          // Bestaetigung liegt beim Aufrufer (Modal, Task 8) — der Store fragt nicht.
          return { ok: false, needsConfirm: true }
        }
        const snapshot = boardPlayers.length ? boardPlayers : null
        const numQbs = isSuperflex ? 2 : 1
        const pprVal = effScoringType === 'ppr' ? 1 : effScoringType === 'half_ppr' ? 0.5 : 0
        const isDynasty = draftMode === 'rookie'

        // Rangliste ist Pflicht — ohne sie gibt es kein Board.
        let fc
        try {
          fc = await fetchJsonOk(
            `/api/rankings/fantasycalc?isDynasty=${isDynasty}&numQbs=${numQbs}&numTeams=${numTeams}&ppr=${pprVal}`
          )
        } catch (e) {
          return { ok: false, error: e.message || 'Rangliste nicht erreichbar' }
        }

        // Markt ist Kuer — ein Board ohne ADP ist besser als kein Board.
        // Fuer Rookie/Dynasty liefert FFC nichts, deshalb gar nicht erst fragen.
        let ffc = null
        if (!isDynasty) {
          try {
            ffc = await fetchJsonOk(`/api/rankings/ffc-adp?format=${ffcFormatFor({ isSuperflex, effScoringType })}&teams=${numTeams}`)
          } catch { ffc = null }
        }

        const { players, stats } = mergeRankingsWithMarket(fc.players, ffc?.players || [])
        set({
          csvRawText: '',
          boardPlayers: players,
          marketMeta: ffc?.meta || null,
          lastImportStats: stats,
          lastBoardSnapshot: snapshot,
        })
        const { selectedDraftId } = useSessionStore.getState()
        if (selectedDraftId) await useLiveStore.getState().loadPicks(selectedDraftId)
        return { ok: true, stats, marketMissing: !isDynasty && !ffc }
      },

      refreshMarketData: async () => {
        const { boardPlayers, marketMeta } = get()
        if (!boardPlayers.length) return { ok: false, error: 'Kein Board geladen' }
        const format = marketMeta?.format || 'ppr'
        try {
          const ffc = await fetchJsonOk(`/api/rankings/ffc-adp?format=${format}`)
          const { players, stats } = overlayMarketData(boardPlayers, ffc.players)
          // rk und Reihenfolge bleiben unberuehrt — der Nutzer pflegt sein Board.
          set({ boardPlayers: players, marketMeta: ffc.meta })
          return { ok: true, stats }
        } catch (e) {
          return { ok: false, error: e.message || 'Marktdaten nicht erreichbar' }
        }
      },

      undoImport: () => {
        const { lastBoardSnapshot } = get()
        if (!lastBoardSnapshot) return false
        set({ boardPlayers: lastBoardSnapshot, lastBoardSnapshot: null, lastImportStats: null })
        return true
      },
```

`handleKtcRookieImport` bekommt denselben Snapshot-Mechanismus (eine Zeile: `lastBoardSnapshot: boardPlayers.length ? boardPlayers : null` im `set`), damit Undo auch dort greift.

`partialize` erweitern — `marketMeta` rein, `lastBoardSnapshot` **bewusst nicht**:

```js
      partialize: (s) => ({
        csvRawText: s.csvRawText,
        boardPlayers: s.boardPlayers,
        searchQuery: s.searchQuery,
        positionFilter: s.positionFilter,
        teamFilter: s.teamFilter,
        draftMode: s.draftMode,
        marketMeta: s.marketMeta,
        // lastBoardSnapshot bleibt in-memory: ein Undo ueber Sessions hinweg
        // waere ueberraschend, und der Snapshot verdoppelt den Speicherbedarf.
      }),
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- useBoardStore`
Expected: PASS — 11 Tests grün.

- [ ] **Step 5: Gesamte Suite grün halten**

Run: `npm test`
Expected: alle Tests grün — insbesondere darf sich am Rookie-Pfad nichts geändert haben.

- [ ] **Step 6: Commit**

```bash
git add src/stores/useBoardStore.js src/stores/useBoardStore.test.js
git commit -m "feat(store): Merge-Import, nicht-destruktiver Markt-Refresh, Undo

Import merged Rangliste + Markt. refreshMarketData legt nur Marktfelder
ueber das Board und fasst rk nie an. Ein Level Undo als Netz gegen den
destruktiven Neu-Import.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Format-Konsumenten umstellen + draftMode-Falle schließen

**Files:**
- Modify: `src/App.jsx:100–147` (`effRoster`, `effScoringType`, `isSuperflex`), `:275–279` (draftMode-Effekt)
- Modify: `src/components/SetupForm.jsx:12–30` (lokale Kopien raus), `:70–96` (`detected`)
- Modify: `src/components/BoardSection.jsx:81–97` (lokale Kopie raus)
- Modify: `src/pages/SetupPage.jsx:62–78` (`wrappedAutoImport`)
- Test: `src/services/draftFormat.test.js` (bereits aus Task 1 — hier nur die draftMode-Regel ergänzen)

**Interfaces:**
- Consumes: `deriveFormat` (Task 1), `handleAutoImport` (Task 4)
- Produces: `pageProps` in `App.jsx` bekommt zusätzlich `formatSource` (String) für die Herkunfts-Zeile (Task 6)

- [ ] **Step 1: Den failing test für die draftMode-Regel schreiben**

Ergänze `src/services/draftFormat.test.js`:

```js
import { resolveDraftMode } from './draftFormat'

describe('resolveDraftMode', () => {
  it('Dynasty-Liga -> rookie', () => {
    expect(resolveDraftMode({ league: { league_type: 'dynasty' }, draft: {}, current: 'redraft' })).toBe('rookie')
  })
  it('Keeper-Liga -> rookie', () => {
    expect(resolveDraftMode({ league: { league_type: 'keeper' }, draft: {}, current: 'redraft' })).toBe('rookie')
  })
  it('Redraft-Liga -> redraft', () => {
    expect(resolveDraftMode({ league: { league_type: 'redraft' }, draft: {}, current: 'rookie' })).toBe('redraft')
  })
  it('Mock ohne Liga -> redraft, statt still auf rookie zu bleiben (Regression B6)', () => {
    expect(resolveDraftMode({ league: null, draft: { draft_id: '1' }, current: 'rookie' })).toBe('redraft')
  })
  it('weder Liga noch Draft -> aktueller Wert bleibt', () => {
    expect(resolveDraftMode({ league: null, draft: null, current: 'rookie' })).toBe('rookie')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- draftFormat`
Expected: FAIL — `resolveDraftMode is not a function`

- [ ] **Step 3: `resolveDraftMode` in `draftFormat.js` ergänzen**

```js
// Ein Mock hat keine Liga. Vorher griff die Erkennung dann gar nicht und der
// Modus blieb still auf dem alten Wert stehen — nach einem Rookie-Draft lief
// der Redraft-Mock mit der Rookie-Tipplogik.
export function resolveDraftMode({ league = null, draft = null, current = 'redraft' } = {}) {
  const lt = league?.league_type
  if (lt === 'dynasty' || lt === 'keeper') return 'rookie'
  if (lt === 'redraft') return 'redraft'
  if (draft && !league) return 'redraft'
  return current
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- draftFormat`
Expected: PASS — 12 Tests grün.

- [ ] **Step 5: `App.jsx` umstellen**

`effRoster`, `effScoringType` und `isSuperflex` (Zeilen 102–143) durch **einen** Aufruf ersetzen:

```js
  const format = useMemo(
    () => deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: setupOverrides }),
    [selectedDraft, selectedLeague, setupOverrides]
  )
  const effRoster = format.rosterPositions
  const effScoringType = format.scoringType
  const isSuperflex = format.isSuperflex
```

Import ergänzen: `import { deriveFormat, resolveDraftMode } from './services/draftFormat'`

Den draftMode-Effekt (275–279) ersetzen:

```js
  useEffect(() => {
    const next = resolveDraftMode({ league: selectedLeague, draft: selectedDraft, current: draftMode })
    if (next !== draftMode) setDraftMode(next)
  }, [selectedLeague?.league_type, selectedDraft?.draft_id]) // eslint-disable-line
```

`pageProps` erweitern:

```js
  const pageProps = { selectedLeague, selectedDraft, teamsCount, ownerLabels, effRoster, isSuperflex, effScoringType, formatSource: format.source }
```

- [ ] **Step 6: `SetupForm.jsx` umstellen**

Lokale `rosterFromDraftSettings` und `detectScoringTypeStrict` (Zeilen 12–30) **löschen**. `detected` (70–96) ersetzen:

```js
  const detected = useMemo(
    () => deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: {} }),
    [selectedDraft, selectedLeague]
  )
```

Alle Lesezugriffe anpassen: `detected.roster_positions` → `detected.rosterPositions`,
`detected.scoring_type` → `detected.scoringType`, `detected.source` bleibt. Import:
`import { deriveFormat, FORMAT_DEFAULTS } from '../services/draftFormat'`; das lokale `DEFAULTS`
durch `FORMAT_DEFAULTS` ersetzen.

**`eff` bleibt in snake_case** — Task 9 liest `eff.scoring_type` / `eff.superflex`, und die
`overrides` sind snake_case (sie werden so unter `sdh.setup.v2` persistiert, siehe
`services/storage.js`). Nur die rechte Seite wechselt auf die neuen `detected`-Namen:

```js
  const eff = {
    scoring_type: overrides.scoring_type ?? detected.scoringType,
    roster_positions: overrides.roster_positions ?? detected.rosterPositions,
    superflex: overrides.superflex ?? detected.isSuperflex,
    teams:  Number(overrides.teams  ?? detected.teams)  || FORMAT_DEFAULTS.teams,
    rounds: Number(overrides.rounds ?? detected.rounds) || FORMAT_DEFAULTS.rounds,
    type:   String(overrides.type   ?? detected.type).toLowerCase(),
  }
```

Das ist bewusst **keine** Umbenennung der Override-Keys: die liegen bereits in der localStorage
von Nutzern, ein Rename braeuchte eine Migration und ist hier nicht das Thema.

- [ ] **Step 7: `BoardSection.jsx` umstellen**

Lokale `mapSlotsToRoster` (81–91) **löschen**. `rosterPositions` (93–97) ersetzen:

```js
  const rosterPositions = deriveFormat({ draft, league, overrides: setupOverrides }).rosterPositions
```

- [ ] **Step 8: `SetupPage.jsx` — `wrappedAutoImport` reparieren (B3)**

Liest heute ausschließlich `selectedLeague`. Ersetzen:

```js
  async function wrappedAutoImport() {
    const fmt = deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: loadSetup()?.overrides || {} })
    const res = await handleAutoImport({
      isSuperflex: fmt.isSuperflex,
      effScoringType: fmt.scoringType,
      numTeams: fmt.teams,
      draftMode,
    })
    if (res.ok) {
      setImportDone({ method: res.marketMissing ? 'FantasyCalc (ohne Marktdaten)' : 'FantasyCalc + FFC', stats: res.stats })
    } else if (res.error) {
      setImportError(res.error)
    }
    return res
  }
```

`selectedDraft` muss dafür als Prop ankommen — `SetupPage` bekommt es bereits über `pageProps`.

- [ ] **Step 9: Verifizieren, dass keine Kopie übrig ist**

Run: `grep -rn "slots_qb" src/ --include=*.jsx --include=*.js | grep -v draftFormat | grep -v test`
Expected: **keine Ausgabe** — die Mapping-Logik existiert nur noch in `draftFormat.js`.

Run: `npm test`
Expected: alle grün.

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx src/components/SetupForm.jsx src/components/BoardSection.jsx src/pages/SetupPage.jsx src/services/draftFormat.js src/services/draftFormat.test.js
git commit -m "fix(format): drei Kopien der slots_*-Logik durch deriveFormat ersetzen

Loest B3 (Mock ohne Liga verlor Scoring/Superflex/Teams) und B6 (draftMode
blieb bei Mocks still auf dem alten Wert - Redraft-Mock lief mit
Rookie-Tipplogik).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Herkunfts-Zeile

**Files:**
- Create: `src/components/DataProvenanceBar.jsx`
- Create: `src/components/DataProvenanceBar.test.jsx`
- Modify: `src/components/BoardSection.jsx` (einhängen über `FiltersRow`)
- Modify: `src/styles/style.css` (Klassen `.provenance-bar`, `.provenance-item`, `.provenance-stale`)

**Interfaces:**
- Consumes: `marketMeta`, `refreshMarketData` (Task 4); `draftMode` (Store); `formatSource` (Task 5)
- Produces: `<DataProvenanceBar marketMeta draftMode hasCsvBoard csvFileName onRefresh />`

- [ ] **Step 1: Den failing test schreiben**

`src/components/DataProvenanceBar.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DataProvenanceBar, { formatMarketAge, isStale } from './DataProvenanceBar'

describe('formatMarketAge', () => {
  it('heute', () => expect(formatMarketAge('2026-07-16', new Date('2026-07-16'))).toBe('heute'))
  it('gestern', () => expect(formatMarketAge('2026-07-15', new Date('2026-07-16'))).toBe('gestern'))
  it('vor N Tagen', () => expect(formatMarketAge('2026-07-10', new Date('2026-07-16'))).toBe('vor 6 Tagen'))
  it('ohne Datum', () => expect(formatMarketAge(null, new Date('2026-07-16'))).toBeNull())
})

describe('isStale', () => {
  it('7 Tage sind noch frisch — das ist die FFC-Fensterbreite', () => {
    expect(isStale('2026-07-09', new Date('2026-07-16'))).toBe(false)
  })
  it('ab 8 Tagen veraltet', () => {
    expect(isStale('2026-07-08', new Date('2026-07-16'))).toBe(true)
  })
  it('ohne Datum nicht veraltet', () => expect(isStale(null, new Date())).toBe(false))
})

describe('DataProvenanceBar', () => {
  const meta = { source: 'ffc', format: 'ppr', total_drafts: 2072, end_date: '2026-07-10' }

  it('nennt beide Quellen, die Draft-Zahl und den Modus', () => {
    render(<DataProvenanceBar marketMeta={meta} draftMode="redraft" now={new Date('2026-07-16')} />)
    expect(screen.getByText(/FantasyCalc/)).toBeTruthy()
    expect(screen.getByText(/Fantasy Football Calculator/)).toBeTruthy()
    expect(screen.getByText(/2072 Mocks/)).toBeTruthy()
    expect(screen.getByText(/Redraft/)).toBeTruthy()
  })

  it('CSV-Board: keine Auto-Quellen, kein Aktualisieren-Button', () => {
    render(<DataProvenanceBar marketMeta={null} hasCsvBoard csvFileName="ranks.csv" draftMode="redraft" />)
    expect(screen.getByText(/ranks\.csv/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Aktualisieren/ })).toBeNull()
  })

  it('ohne ADP wird das benannt statt verschwiegen', () => {
    render(<DataProvenanceBar marketMeta={null} draftMode="redraft" />)
    expect(screen.getByText(/ADP fehlt/)).toBeTruthy()
  })

  it('Aktualisieren ruft onRefresh', async () => {
    const onRefresh = vi.fn()
    render(<DataProvenanceBar marketMeta={meta} draftMode="redraft" onRefresh={onRefresh} now={new Date('2026-07-16')} />)
    screen.getByRole('button', { name: /Aktualisieren/ }).click()
    expect(onRefresh).toHaveBeenCalled()
  })

  it('veraltete Daten werden hervorgehoben', () => {
    const { container } = render(
      <DataProvenanceBar marketMeta={{ ...meta, end_date: '2026-07-01' }} draftMode="redraft" now={new Date('2026-07-16')} />
    )
    expect(container.querySelector('.provenance-stale')).toBeTruthy()
  })

  it('Rookie-Modus wird angezeigt — ein falscher Modus ist damit sichtbar statt still', () => {
    render(<DataProvenanceBar marketMeta={null} draftMode="rookie" />)
    expect(screen.getByText(/Rookie/)).toBeTruthy()
  })
})
```

**Hinweis:** `@testing-library/react` und `jest-dom` sind bereits installiert, `src/test/setup.js`
importiert jest-dom bereits. Nichts zu tun.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- DataProvenanceBar`
Expected: FAIL — Modul nicht gefunden.

- [ ] **Step 3: Implementieren**

`src/components/DataProvenanceBar.jsx`:

```jsx
import React from 'react'
import Icon from './Icon'

// FFC rechnet ADP ueber ein rollierendes 7-Tage-Fenster. Aelter als das Fenster
// = die Zahl beschreibt einen Markt, den es so nicht mehr gibt.
const STALE_AFTER_DAYS = 7

const MODE_LABEL = { redraft: 'Redraft', rookie: 'Rookie Draft' }
const FORMAT_LABEL = { ppr: 'PPR', 'half-ppr': 'Half-PPR', standard: 'Standard', '2qb': '2QB / Superflex' }

function daysBetween(dateStr, now) {
  if (!dateStr) return null
  const then = new Date(dateStr)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((now.getTime() - then.getTime()) / 86400000)
}

export function formatMarketAge(dateStr, now = new Date()) {
  const d = daysBetween(dateStr, now)
  if (d == null) return null
  if (d <= 0) return 'heute'
  if (d === 1) return 'gestern'
  return `vor ${d} Tagen`
}

export function isStale(dateStr, now = new Date()) {
  const d = daysBetween(dateStr, now)
  return d == null ? false : d > STALE_AFTER_DAYS
}

export default function DataProvenanceBar({
  marketMeta = null,
  draftMode = 'redraft',
  hasCsvBoard = false,
  csvFileName = '',
  onRefresh,
  refreshing = false,
  error = null,
  now = new Date(),
}) {
  const mode = MODE_LABEL[draftMode] || draftMode

  // Die Zeile luegt nie: beim CSV-Board gibt es nichts zu aktualisieren.
  if (hasCsvBoard) {
    return (
      <div className="provenance-bar">
        <span className="provenance-item">
          <Icon name="clipboard" size={13} /> Rangliste &amp; ADP aus CSV
          {csvFileName ? <> · {csvFileName}</> : null}
        </span>
        <span className="provenance-item">Modus <strong>{mode}</strong></span>
      </div>
    )
  }

  const age = formatMarketAge(marketMeta?.end_date, now)
  const stale = isStale(marketMeta?.end_date, now)

  return (
    <div className="provenance-bar">
      <span className="provenance-item">Rangliste <strong>FantasyCalc</strong></span>
      {marketMeta ? (
        <span className={`provenance-item${stale ? ' provenance-stale' : ''}`}>
          ADP <strong>Fantasy Football Calculator</strong>
          {marketMeta.total_drafts ? <>, {marketMeta.total_drafts} Mocks</> : null}
          {marketMeta.format ? <> ({FORMAT_LABEL[marketMeta.format] || marketMeta.format})</> : null}
          {age ? <> · Stand <strong>{age}</strong></> : null}
        </span>
      ) : (
        <span className="provenance-item provenance-stale">
          <Icon name="warning" size={13} /> ADP fehlt
        </span>
      )}
      <span className="provenance-item">Modus <strong>{mode}</strong></span>
      {onRefresh && (
        <button className="btn-compact" onClick={onRefresh} disabled={refreshing} title="Marktdaten neu laden — deine Reihenfolge bleibt">
          {refreshing ? '…' : <Icon name="refresh" size={13} />} Aktualisieren
        </button>
      )}
      {error && <span className="provenance-item provenance-stale">{error}</span>}
    </div>
  )
}
```

**Icon-Namen (verifiziert 2026-07-16 gegen `src/components/Icon.jsx`):** `refresh` (→ `RefreshCw`)
und `warning` (→ `TriangleAlert`) sind registriert und werden hier genutzt. **`alert-triangle`
existiert NICHT** — dieser Name hätte still ein falsches Icon gerendert, siehe unten.

**Achtung, stille Falle:** `Icon.jsx` fällt bei unbekanntem Namen auf `MAP[name] || Star` zurück —
ein Tippfehler im Icon-Namen wirft **keinen Fehler**, sondern zeigt kommentarlos einen Stern.
Prüfe jeden verwendeten Namen gegen die `MAP` in `src/components/Icon.jsx`, bevor du ihn nutzt.

- [ ] **Step 4: CSS ergänzen**

In `src/styles/style.css` — nur Role-Tokens, keine rohen Hex-Werte:

```css
/* Herkunfts-Zeile: beantwortet Herkunft, Alter und Modus an einer Stelle. */
.provenance-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem;
  padding: 0.4rem 0.6rem; margin-top: 0.5rem;
  border: 1px solid var(--border); border-radius: 2px;
  background: var(--surface-2);
  font-size: 0.75rem; color: var(--text-muted);
}
.provenance-item { display: inline-flex; align-items: center; gap: 0.3rem; }
.provenance-item strong { color: var(--text); font-weight: 500; }
.provenance-item :is(strong) { font-variant-numeric: tabular-nums; }
.provenance-stale { color: var(--bad); }
.provenance-stale strong { color: var(--bad); }
```

- [ ] **Step 5: Tests laufen lassen**

Run: `npm test -- DataProvenanceBar`
Expected: PASS — 10 Tests grün.

- [ ] **Step 6: In `BoardSection` einhängen**

Direkt unter `<FiltersRow …/>`, nur wenn ein Board existiert (der Empty-State-Return oben greift ohnehin vorher):

```jsx
      <DataProvenanceBar
        marketMeta={marketMeta}
        draftMode={draftMode}
        hasCsvBoard={!!csvRawText}
        onRefresh={handleRefreshMarket}
        refreshing={refreshingMarket}
        error={marketError}
      />
```

Mit lokalem Handler in `BoardSection`:

```jsx
  const { marketMeta, csvRawText, refreshMarketData } = useBoardStore()
  const [refreshingMarket, setRefreshingMarket] = useState(false)
  const [marketError, setMarketError] = useState(null)

  async function handleRefreshMarket() {
    setRefreshingMarket(true)
    setMarketError(null)
    const res = await refreshMarketData()
    if (!res.ok) setMarketError(res.error)
    setRefreshingMarket(false)
  }
```

- [ ] **Step 7: Commit**

```bash
git add src/components/DataProvenanceBar.jsx src/components/DataProvenanceBar.test.jsx src/components/BoardSection.jsx src/styles/style.css
git commit -m "feat(board): Herkunfts-Zeile - Quelle, Alter und Modus an einer Stelle

Beantwortet, was bisher niemand beantwortet hat: woher die Zahlen kommen,
wie alt sie sind, welcher Modus laeuft. Macht auch einen falschen draftMode
sichtbar statt still.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Board-Spalten — ADP und genau eine Δ-Spalte

**Files:**
- Modify: `src/components/BoardTable.jsx:21–24` (`has*`-Flags), `:94–107` (Header), `:196–213` (Zellen + Mobile-Subline)
- Test: `src/components/BoardTable.test.jsx` (neu)

**Interfaces:**
- Consumes: `adp`, `bye`, `stdev` auf `boardPlayers` (Task 4)
- Produces: nichts für Folge-Tasks

- [ ] **Step 1: Den failing test schreiben**

`src/components/BoardTable.test.jsx`:

```jsx
import { describe, it, expect } from 'vitest'
import { deltaAdp, formatDeltaAdp } from './BoardTable'

describe('deltaAdp', () => {
  // Konvention adp - rk, positiv = Value. Nicht umdrehen:
  // csv.js:56 rechnet adp = ecr + ecrVsAdp, useDraftTips.js:89 nutzt adp - rk.
  it('positiv = faellt dir zu (Value)', () => {
    expect(deltaAdp({ rk: '5', adp: 20 })).toBe(15)
  })
  it('negativ = wird vor seinem Rang gezogen', () => {
    expect(deltaAdp({ rk: '20', adp: 5 })).toBe(-15)
  })
  it('ohne ADP null', () => {
    expect(deltaAdp({ rk: '5', adp: null })).toBeNull()
  })
  it('nutzt den CSV-Wert ecrVsAdp, wenn kein numerischer ADP da ist', () => {
    expect(deltaAdp({ rk: '5', adp: null, ecrVsAdp: '+3' })).toBe(3)
  })
})

describe('formatDeltaAdp', () => {
  it('Vorzeichen steht am Wert — Farbe ist nie der einzige Bedeutungstraeger', () => {
    expect(formatDeltaAdp(15)).toBe('+15')
    expect(formatDeltaAdp(-15)).toBe('-15')
  })
  it('fehlender Wert wird zum Gedankenstrich, nicht zu leer', () => {
    expect(formatDeltaAdp(null)).toBe('—')
  })
  it('rundet auf eine Nachkommastelle', () => {
    expect(formatDeltaAdp(3.14)).toBe('+3.1')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- BoardTable`
Expected: FAIL — `deltaAdp is not a function`

- [ ] **Step 3: Implementieren**

In `src/components/BoardTable.jsx` oben ergänzen:

```jsx
// Konvention: adp - rk, positiv = Value (faellt dir zu).
// Nicht umdrehen — csv.js:56 und useDraftTips.js:89 haengen daran.
export function deltaAdp(p) {
  const rk = Number(p?.rk)
  const adp = Number(p?.adp)
  if (Number.isFinite(rk) && Number.isFinite(adp)) return Math.round((adp - rk) * 10) / 10
  const csvDelta = Number(String(p?.ecrVsAdp ?? '').replace('+', ''))
  return Number.isFinite(csvDelta) ? csvDelta : null
}

export function formatDeltaAdp(d) {
  if (d == null || !Number.isFinite(Number(d))) return '—'
  const n = Math.round(Number(d) * 10) / 10
  return n > 0 ? `+${n}` : String(n)
}
```

`has*`-Flags (21–24) — `hasEcrVsAdp` weicht der quellenunabhängigen Variante:

```jsx
  const hasAdp = useMemo(
    () => (filteredPlayers || []).some(p => p.adp != null || p.ecrVsAdp),
    [filteredPlayers]
  )
```

Header (nach `col-pos`, vor `col-bye`):

```jsx
              {hasAdp && <th className="col-adp" title="Average Draft Position">ADP</th>}
              {hasAdp && <th className="col-delta" title="ADP minus Rang — positiv heisst, er faellt dir zu">Δ ADP</th>}
```

Zellen (an gleicher Stelle):

```jsx
                  {hasAdp && <td className="col-adp">{p.adp != null ? Math.round(p.adp * 10) / 10 : '—'}</td>}
                  {hasAdp && (() => {
                    const d = deltaAdp(p)
                    return (
                      <td className={`col-delta${d == null ? '' : d > 0 ? ' delta-good' : d < 0 ? ' delta-bad' : ''}`}>
                        {formatDeltaAdp(d)}
                      </td>
                    )
                  })()}
```

Die alte `hasEcrVsAdp`-Spalte (Header **und** Zelle) **entfernen** — zwei Delta-Spalten würden sich widersprechen.

Mobile-Subline anpassen:

```jsx
                      {hasAdp && p.adp != null ? ` · ADP ${Math.round(p.adp * 10) / 10}` : ''}
                      {hasAdp ? ` · Δ ${formatDeltaAdp(deltaAdp(p))}` : ''}
```

CSS in `style.css`:

```css
.col-adp, .col-delta { text-align: right; font-variant-numeric: tabular-nums; }
.delta-good { color: var(--good); }
.delta-bad  { color: var(--bad); }
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test -- BoardTable`
Expected: PASS — 7 Tests grün.

- [ ] **Step 5: Verifizieren, dass keine zweite Delta-Spalte übrig ist**

Run: `grep -n "ecrVsAdp" src/components/BoardTable.jsx`
Expected: nur innerhalb von `deltaAdp` und `hasAdp` — keine eigene Spalte mehr.

- [ ] **Step 6: Commit**

```bash
git add src/components/BoardTable.jsx src/components/BoardTable.test.jsx src/styles/style.css
git commit -m "feat(board): ADP-Spalte und genau eine Delta-Spalte

Quellenunabhaengig nach der etablierten Konvention adp - rk. Die alte
ECR+/-ADP-Spalte weicht - zwei Delta-Spalten wuerden sich widersprechen.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Mock-Start auf dem Dashboard

**Files:**
- Create: `src/components/MockDraftCard.jsx`
- Create: `src/components/MockDraftCard.test.jsx`
- Modify: `src/pages/DashboardPage.jsx:194–206` (Grid)
- Modify: `src/styles/style.css`

**Interfaces:**
- Consumes: `attachDraftByIdOrUrl`, `setSelectedDraftId` (`useSessionStore`); `parseDraftId` (`src/utils/parse.js`)
- Produces: `<MockDraftCard />`

**Der Kern dieser Task:** Sie darf das Board **nicht** anfassen. Genau darin unterscheidet sie sich vom Add-Modus (`SetupPage.jsx:37–50`, der `setBoardPlayers([])` ruft) — und genau deshalb läuft sie nicht über `/setup`. Die gepflegte Rangliste muss jeden neuen Mock überleben.

- [ ] **Step 1: Den failing test schreiben**

`src/components/MockDraftCard.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => navigate,
}))

const attach = vi.fn()
const setSelectedDraftId = vi.fn()
const setBoardPlayers = vi.fn()

vi.mock('../stores/useSessionStore', () => ({
  useSessionStore: () => ({ attachDraftByIdOrUrl: attach, setSelectedDraftId }),
}))
vi.mock('../stores/useBoardStore', () => ({
  useBoardStore: { getState: () => ({ setBoardPlayers }) },
}))

import MockDraftCard from './MockDraftCard'

const setup = () => render(<MemoryRouter><MockDraftCard /></MemoryRouter>)

beforeEach(() => { vi.clearAllMocks() })

describe('MockDraftCard', () => {
  it('haengt den Draft an, waehlt ihn aus und springt aufs Board', async () => {
    attach.mockResolvedValue('12345')
    setup()
    await userEvent.type(screen.getByRole('textbox'), 'https://sleeper.com/draft/nfl/12345')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/board'))
    expect(attach).toHaveBeenCalled()
    expect(setSelectedDraftId).toHaveBeenCalledWith('12345')
  })

  it('fasst das Board nicht an — die gepflegte Rangliste ueberlebt den Mock', async () => {
    attach.mockResolvedValue('12345')
    setup()
    await userEvent.type(screen.getByRole('textbox'), '12345')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    await waitFor(() => expect(navigate).toHaveBeenCalled())
    expect(setBoardPlayers).not.toHaveBeenCalled()
  })

  it('ungueltiger Link: Fehler inline mit Loesungsweg, kein alert', async () => {
    attach.mockResolvedValue(null)
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    setup()
    await userEvent.type(screen.getByRole('textbox'), 'kaputt')
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    expect(await screen.findByText(/Sleeper-Draft/i)).toBeTruthy()
    expect(alertSpy).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('leere Eingabe tut nichts', async () => {
    setup()
    await userEvent.click(screen.getByRole('button', { name: /Starten/i }))
    expect(attach).not.toHaveBeenCalled()
  })
})
```

**Hinweis:** `@testing-library/user-event` wird in Task 0 installiert. Laeuft diese Task
eigenstaendig und der Import schlaegt fehl: `npm i -D @testing-library/user-event`.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- MockDraftCard`
Expected: FAIL — Modul nicht gefunden.

- [ ] **Step 3: Implementieren**

`src/components/MockDraftCard.jsx`:

```jsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/useSessionStore'
import { parseDraftId } from '../utils/parse'
import Icon from './Icon'

// Bewusst NICHT ueber /setup: der Add-Modus dort loescht das Board mit.
// Ein Mock ist Vorbereitung, kein Neuanfang — die gepflegte Rangliste bleibt.
export default function MockDraftCard() {
  const navigate = useNavigate()
  const { attachDraftByIdOrUrl, setSelectedDraftId } = useSessionStore()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleStart() {
    const raw = input.trim()
    if (!raw) return
    setBusy(true)
    setError(null)
    try {
      const draftId = await attachDraftByIdOrUrl(raw, parseDraftId)
      if (!draftId) {
        setError('Kein Draft unter diesem Link gefunden — prüfe, ob der Link auf einen Sleeper-Draft zeigt (sleeper.com/draft/nfl/…).')
        return
      }
      setSelectedDraftId(String(draftId))
      setInput('')
      navigate('/board')
    } catch (e) {
      setError(`Draft konnte nicht geladen werden: ${e?.message || e}. Prüfe deine Verbindung und versuche es erneut.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="league-card league-card--mock">
      <div className="lc-mock-head">
        <Icon name="zap" size={16} /> <span className="lc-mock-title">Mock-Draft starten</span>
      </div>
      <p className="lc-mock-desc muted">Sleeper-Link einfügen — dein Board bleibt wie es ist.</p>
      <div className="lc-mock-row">
        <input
          className="control control--sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          placeholder="sleeper.com/draft/nfl/…"
          aria-label="Sleeper-Draft-Link"
        />
        <button className="btn btn-primary btn-sm" onClick={handleStart} disabled={busy}>
          {busy ? '…' : 'Starten'}
        </button>
      </div>
      {error && <p className="lc-mock-error">{error}</p>}
    </div>
  )
}
```

**Wichtig:** `attachDraftByIdOrUrl` muss die Draft-ID zurückgeben, nicht nur `true`.
Run: `grep -n "attachDraftByIdOrUrl" -A 20 src/stores/useSessionStore.js`
Gibt sie heute `boolean` zurück: auf `draft_id` (String) bzw. `null` umstellen und die bestehenden Aufrufer in `SetupForm.jsx:253` prüfen (`if (ok)` funktioniert mit einem String weiter, da truthy).

- [ ] **Step 4: `zap` in `Icon.jsx` ergänzen**

**`zap` ist NICHT registriert** (verifiziert 2026-07-16). Ohne Ergänzung rendert `Icon.jsx` still
einen **Stern** statt eines Fehlers (`MAP[name] || Star`) — der Fehler fiele niemandem auf.

In `src/components/Icon.jsx` nach bestehendem Muster ergänzen: `Zap` zum `lucide-react`-Import
hinzufügen und `zap: Zap,` in die `MAP` eintragen. Kein Emoji als Ersatz.

Run: `node -e "const s=require('fs').readFileSync('src/components/Icon.jsx','utf8'); console.log('zap registriert:', /zap:\s*Zap/.test(s) && /Zap/.test(s.split('from')[0]))"`
Expected: `zap registriert: true`

- [ ] **Step 5: Ins Dashboard-Grid einhängen**

In `DashboardPage.jsx`, im `dashboard-grid` **vor** die Add-Karte:

```jsx
        <MockDraftCard />
        <button className="league-card league-card--add" onClick={goToAdd}>
```

- [ ] **Step 6: CSS**

```css
.league-card--mock { display: flex; flex-direction: column; gap: 0.5rem; justify-content: center; }
.lc-mock-head { display: flex; align-items: center; gap: 0.4rem; color: var(--text); }
.lc-mock-title { font-weight: 500; }
.lc-mock-desc { font-size: 0.75rem; margin: 0; }
.lc-mock-row { display: flex; gap: 0.4rem; }
.lc-mock-row .control { flex: 1; min-width: 0; }
.lc-mock-error { font-size: 0.75rem; color: var(--bad); margin: 0; }
```

- [ ] **Step 7: Tests laufen lassen**

Run: `npm test -- MockDraftCard`
Expected: PASS — 4 Tests grün.

- [ ] **Step 8: Commit**

```bash
git add src/components/MockDraftCard.jsx src/components/MockDraftCard.test.jsx src/pages/DashboardPage.jsx src/stores/useSessionStore.js src/styles/style.css
git commit -m "feat(dashboard): Mock-Draft per Link starten

Aus sechs bis sieben Interaktionen wird ein Einfuegen und ein Klick.
Faehrt bewusst am Add-Modus vorbei, der das Board mitloescht.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Wizard straffen und Sackgasse schließen

**Files:**
- Modify: `src/components/SetupForm.jsx` (Schritt 3 → Collapse, Schritt 4 → Kopfzeile, alle englischen Labels, `alert` raus)
- Modify: `src/pages/SetupPage.jsx` (Banner, Fehler-State)

**Interfaces:**
- Consumes: `deriveFormat` (Task 1), `handleAutoImport`/`undoImport` (Task 4)
- Produces: nichts für Folge-Tasks

- [ ] **Step 1: Schritt 4 auflösen**

Den kompletten Schritt-4-Block (`SetupForm.jsx:546–572`) löschen. Die `summary-grid`-Inhalte wandern als dauerhafte Kopfzeile direkt unter `<p className="muted">Liga & Draft auswählen…</p>`:

```jsx
      <div className="summary-card summary-card--sticky">
        <div className="summary-grid">
          <div className="summary-item"><span className="k">Liga</span><span className="v">{selectedLeague?.name || '—'}</span></div>
          <div className="summary-item"><span className="k">Draft</span><span className="v">{selectedDraft ? (formatDraftLabel ? formatDraftLabel(selectedDraft, leaguesById || new Map()) : selectedDraft.draft_id) : '—'}</span></div>
          <div className="summary-item"><span className="k">Modus</span><span className="v">{draftMode === 'rookie' ? 'Rookie Draft (Dynasty)' : 'Redraft'}</span></div>
          <div className="summary-item"><span className="k">Format</span><span className="v">{eff.teams} Teams · {eff.type} · {String(eff.scoring_type).toUpperCase()}{eff.superflex ? ' · Superflex' : ''}</span></div>
        </div>
      </div>
```

Schritt 2 endet jetzt mit dem echten Ausgang statt mit `window.scrollTo`:

```jsx
          <div className="step-actions">
            <button className="btn btn-secondary" onClick={() => setOpenStep(1)}>Zurück</button>
            <button className="btn btn-primary" onClick={() => navigate('/board')}>Fertig → Board</button>
          </div>
```

`useNavigate` importieren.

- [ ] **Step 2: Schritt 3 zum Collapse machen**

Der bisherige Schritt-3-Block wird zu einer Zeile am Ende von Schritt 1 — Overrides sind der Ausnahmefall, seit das Format aus dem Draft kommt:

```jsx
            <div className="collapse">
              <button
                type="button"
                className={`collapse-toggle ${showFormat ? 'is-open' : ''}`}
                onClick={() => setShowFormat(s => !s)}
              >
                Erkannt: {eff.teams} Teams · {eff.type} · {String(eff.scoring_type).toUpperCase()}
                {eff.superflex ? ' · Superflex' : ' · kein Superflex'} · Anpassen
              </button>
              {showFormat && <div className="collapse-body">{/* bisheriger Schritt-3-Inhalt, unveraendert */}</div>}
            </div>
```

Die Step-Badges neu nummerieren: aus 1/2/3/4 werden **1 (Liga & Draft)** und **2 (Rankings)**.

- [ ] **Step 3: Alle englischen Labels übersetzen**

| Alt | Neu |
|---|---|
| `League` | `Liga` |
| `Draft` | `Draft` (bleibt) |
| `— None —` | `— keine —` |
| `— select —` | `— auswählen —` |
| `Refresh drafts` | `Drafts neu laden` |
| `Alternative: Attach draft by ID/URL` / `Hide alternative` | `Draft per ID/Link anhängen` / `Ausblenden` |
| `Attach` | `Anhängen` |
| `Choose CSV file` | `CSV-Datei wählen` |
| `No file selected` | `Keine Datei gewählt` |
| `Alternative: paste raw CSV` / `Hide paste field` | `CSV-Text einfügen` / `Einfügefeld ausblenden` |
| `Load CSV` | `CSV laden` |
| `Clear` | `Leeren` |
| `Show advanced options` / `Hide advanced options` | `Erweiterte Optionen` / `Erweiterte Optionen ausblenden` |
| `Apply defaults` | `Standardwerte übernehmen` |
| `Detected:` | `Erkannt:` |
| `Effective:` | `Effektiv:` |
| `Enabled` / `Disabled` | `An` / `Aus` |
| `Teams / Rounds / Type` | `Teams / Runden / Typ` |
| `Roster positions (override — optional)` | `Roster-Positionen (Override — optional)` |

Run: `grep -nE "\"(League|Attach|Clear|Load CSV|Refresh drafts)\"|>(League|Attach|Clear)<" src/components/SetupForm.jsx`
Expected: keine Ausgabe.

- [ ] **Step 4: `alert()` raus**

Die drei `alert(...)` in `SetupForm.jsx` (Zeilen ~130, ~147, ~223) durch einen Inline-Fehler-State ersetzen:

```jsx
  const [formError, setFormError] = useState(null)
```

Statt `alert('Failed to resolve user or load leagues: ' + …)`:

```jsx
      setFormError(`Ligen konnten nicht geladen werden: ${e?.message || e}. Prüfe den Sleeper-Username und deine Verbindung.`)
```

Statt `alert('Pick a league first (or attach by ID/URL below).')`:

```jsx
      setFormError('Wähle zuerst eine Liga — oder hänge den Draft unten per ID/Link an.')
```

Statt `alert('Failed to read CSV: ' + …)`:

```jsx
      setFormError(`CSV konnte nicht gelesen werden: ${err?.message || err}. Prüfe, ob es eine gültige FantasyPros-CSV ist.`)
```

Gerendert unter der Kopfzeile:

```jsx
      {formError && <div className="form-error" role="alert">{formError}</div>}
```

CSS:

```css
.form-error { padding: 0.5rem 0.6rem; border: 1px solid var(--bad); border-radius: 2px; color: var(--bad); font-size: 0.8rem; }
```

Run: `grep -cn "alert(" src/components/SetupForm.jsx`
Expected: `0`

- [ ] **Step 5: Verifizieren**

Run: `npm test`
Expected: alle grün, `no-emoji.test.js` inklusive.

- [ ] **Step 6: Commit**

```bash
git add src/components/SetupForm.jsx src/pages/SetupPage.jsx src/styles/style.css
git commit -m "feat(setup): vier Schritte auf zwei, Sackgasse geschlossen, deutsch

'Fertig' rief window.scrollTo - das Setup hatte keinen Ausgang zum Board.
Schritt 3 wird Collapse (Overrides sind Ausnahmefall), Schritt 4 wird
Kopfzeile. alert() raus, Labels deutsch.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Ehrliches Import-Banner mit Undo

**Files:**
- Modify: `src/pages/SetupPage.jsx:103–117` (Banner)
- Modify: `src/stores/useBoardStore.js` (Confirm-Dialog raus — der Store fragt nicht mehr)
- Create: `src/components/ImportResultBanner.jsx`
- Create: `src/components/ImportResultBanner.test.jsx`

**Interfaces:**
- Consumes: `lastImportStats`, `undoImport` (Task 4)
- Produces: `<ImportResultBanner stats method marketMissing onUndo onClose onGoToBoard />`

- [ ] **Step 1: Den failing test schreiben**

`src/components/ImportResultBanner.test.jsx`:

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ImportResultBanner from './ImportResultBanner'

const stats = { total: 207, withAdp: 195, withoutAdp: 12, unmatchedNames: ['A B', 'C D'] }

describe('ImportResultBanner', () => {
  it('nennt Gesamtzahl, ADP-Treffer und Fehlschlaege', () => {
    render(<ImportResultBanner stats={stats} method="FantasyCalc + FFC" />)
    expect(screen.getByText(/207 Spieler/)).toBeTruthy()
    expect(screen.getByText(/195 mit ADP/)).toBeTruthy()
    expect(screen.getByText(/12 ohne Marktdaten/)).toBeTruthy()
  })

  it('zeigt die nicht gematchten Namen auf Klick — nicht stillschweigen', async () => {
    render(<ImportResultBanner stats={stats} method="x" />)
    await userEvent.click(screen.getByRole('button', { name: /anzeigen/i }))
    expect(screen.getByText(/A B/)).toBeTruthy()
    expect(screen.getByText(/C D/)).toBeTruthy()
  })

  it('Undo nur wenn moeglich', () => {
    const { rerender } = render(<ImportResultBanner stats={stats} method="x" onUndo={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Rückgängig/ })).toBeTruthy()
    rerender(<ImportResultBanner stats={stats} method="x" />)
    expect(screen.queryByRole('button', { name: /Rückgängig/ })).toBeNull()
  })

  it('Undo ruft den Handler', async () => {
    const onUndo = vi.fn()
    render(<ImportResultBanner stats={stats} method="x" onUndo={onUndo} />)
    await userEvent.click(screen.getByRole('button', { name: /Rückgängig/ }))
    expect(onUndo).toHaveBeenCalled()
  })

  it('fehlender Markt wird benannt', () => {
    render(<ImportResultBanner stats={{ ...stats, withAdp: 0, withoutAdp: 207 }} method="FantasyCalc" marketMissing />)
    expect(screen.getByText(/Marktdaten nicht erreichbar/)).toBeTruthy()
  })

  it('ohne Fehlschlaege kein anzeigen-Button', () => {
    render(<ImportResultBanner stats={{ total: 5, withAdp: 5, withoutAdp: 0, unmatchedNames: [] }} method="x" />)
    expect(screen.queryByRole('button', { name: /anzeigen/i })).toBeNull()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- ImportResultBanner`
Expected: FAIL — Modul nicht gefunden.

- [ ] **Step 3: Implementieren**

`src/components/ImportResultBanner.jsx`:

```jsx
import React, { useState } from 'react'
import Icon from './Icon'

// Ehrlich statt beruhigend: der Merge trifft nicht jeden Namen. Wer das
// verschweigt, laesst den Nutzer eine Luecke fuer einen Datenfehler halten.
export default function ImportResultBanner({
  stats, method, marketMissing = false, onUndo, onClose, onGoToBoard,
}) {
  const [showUnmatched, setShowUnmatched] = useState(false)
  if (!stats) return null

  return (
    <div className="import-done-banner">
      <div className="import-done-main">
        <span className="import-done-text">
          <Icon name="check" size={14} /> <strong>{stats.total} Spieler</strong> importiert ({method})
          {stats.withAdp > 0 && <> · <strong>{stats.withAdp} mit ADP</strong></>}
          {stats.withoutAdp > 0 && (
            <> · {stats.withoutAdp} ohne Marktdaten{' '}
              <button className="btn-link" onClick={() => setShowUnmatched(s => !s)}>
                {showUnmatched ? 'ausblenden' : 'anzeigen'}
              </button>
            </>
          )}
        </span>
        {marketMissing && (
          <span className="import-done-warn">
            <Icon name="warning" size={13} /> Marktdaten nicht erreichbar — Rangliste ist da, ADP fehlt.
          </span>
        )}
      </div>

      {showUnmatched && !!stats.unmatchedNames?.length && (
        <ul className="import-unmatched">
          {stats.unmatchedNames.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}

      <div className="import-done-actions">
        {onGoToBoard && <button className="btn btn-primary btn-sm" onClick={onGoToBoard}>→ Board</button>}
        {onUndo && <button className="btn btn-secondary btn-sm" onClick={onUndo}>Rückgängig</button>}
        {onClose && (
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Schließen">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
```

CSS:

```css
.import-done-main { display: flex; flex-direction: column; gap: 0.2rem; }
.import-done-warn { font-size: 0.75rem; color: var(--bad); display: inline-flex; align-items: center; gap: 0.3rem; }
.import-unmatched { margin: 0.4rem 0 0; padding-left: 1.1rem; font-size: 0.75rem; color: var(--text-muted); max-height: 8rem; overflow-y: auto; }
.btn-link { background: none; border: 0; padding: 0; color: var(--accent-text); text-decoration: underline; cursor: pointer; font: inherit; }
```

- [ ] **Step 4: In `SetupPage` einhängen**

Das bestehende `importDone`-Banner ersetzen:

```jsx
      {importDone && (
        <ImportResultBanner
          stats={importDone.stats}
          method={importDone.method}
          marketMissing={importDone.marketMissing}
          onUndo={useBoardStore.getState().lastBoardSnapshot ? () => { undoImport(); setImportDone(null) } : undefined}
          onClose={() => setImportDone(null)}
          onGoToBoard={() => navigate('/board')}
        />
      )}
      {importError && <div className="form-error" role="alert">{importError}</div>}
```

- [ ] **Step 5: Überschreib-Confirm aus dem Store in ein Modal heben**

`window.confirm` in `handleCsvLoad` und `handleKtcRookieImport` **bleibt vorerst** (CSV-Pfad ist tabu). Für `handleAutoImport` gibt der Store seit Task 4 `{ ok: false, needsConfirm: true }` zurück. In `SetupPage`:

```jsx
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  async function wrappedAutoImport(force = false) {
    const fmt = deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: loadSetup()?.overrides || {} })
    const res = await handleAutoImport({
      isSuperflex: fmt.isSuperflex, effScoringType: fmt.scoringType, numTeams: fmt.teams, draftMode, force,
    })
    if (res.needsConfirm) { setConfirmOverwrite(true); return res }
    if (res.ok) setImportDone({ method: res.marketMissing ? 'FantasyCalc' : 'FantasyCalc + FFC', stats: res.stats, marketMissing: res.marketMissing })
    else if (res.error) setImportError(res.error)
    return res
  }
```

Mit dem vorhandenen `Modal`:

```jsx
      <Modal open={confirmOverwrite} onClose={() => setConfirmOverwrite(false)} title="Rankings überschreiben?">
        <p>Es sind bereits Rankings geladen. Beim Neu-Import geht deine eigene Reihenfolge verloren.</p>
        <p className="muted text-xs">Nur die Marktdaten aktualisieren? Das geht ohne Datenverlust über „Aktualisieren" am Board.</p>
        <div className="row end" style={{ gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setConfirmOverwrite(false)}>Abbrechen</button>
          <button className="btn btn-primary" onClick={() => { setConfirmOverwrite(false); wrappedAutoImport(true) }}>Überschreiben</button>
        </div>
      </Modal>
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npm test -- ImportResultBanner`
Expected: PASS — 6 Tests grün.

Run: `npm test`
Expected: alle grün.

- [ ] **Step 7: Commit**

```bash
git add src/components/ImportResultBanner.jsx src/components/ImportResultBanner.test.jsx src/pages/SetupPage.jsx src/stores/useBoardStore.js src/styles/style.css
git commit -m "feat(setup): ehrliches Import-Banner mit Undo

Nennt Treffer und Fehlschlaege beim Merge samt Namen, statt Luecken
stillschweigend als Datenfehler dastehen zu lassen. window.confirm weicht
dem Modal, Undo ist das Netz.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Tipplogik — Deutsch, Streuung, Bye-Cluster, `pos_need`, Injury

**Files:**
- Modify: `src/hooks/useDraftTips.js` (komplett)
- Modify: `src/services/playersMeta.js:16–17` (tote Felder)
- Test: `src/hooks/useDraftTips.test.js` (neu)

**Interfaces:**
- Consumes: `adp`, `stdev`, `high`, `low`, `bye`, `sleeperId` auf `boardPlayers` (Task 4)
- Produces: nichts für Folge-Tasks

- [ ] **Step 1: Den failing test schreiben**

`src/hooks/useDraftTips.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDraftTips, POS_NEED_SLACK } from './useDraftTips'

const roster = ['QB','RB','RB','WR','WR','TE','FLEX','BN','BN','BN','BN','BN','BN','BN','BN','BN']
const base = {
  meUserId: 'u1', teamsCount: 12, rosterPositions: roster,
  scoringSettings: { rec: 1 }, scoringType: 'ppr', draftType: 'snake',
  strategies: ['balanced'], draftSlot: 1, enabled: true,
}
const tipsOf = (over) => renderHook(() => useDraftTips({ ...base, ...over })).result.current

describe('Sprache', () => {
  it('alle Tips sind deutsch', () => {
    const tips = tipsOf({
      picks: [], boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 20 }],
    })
    const text = tips.map(t => t.text).join(' ')
    expect(text).not.toMatch(/\b(You|your|Only|Value on board|carries)\b/)
  })
})

describe('Value mit Streuung', () => {
  it('nennt die Spanne, wenn stdev vorliegt', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 20 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24, stdev: 6, high: 18, low: 31 }],
    })
    const t = tips.find(x => x.type === 'value')
    expect(t.text).toMatch(/zwischen Pick 18 und 31/)
  })

  it('faellt ohne stdev auf die Binaer-Aussage zurueck (CSV-Board)', () => {
    const tips = tipsOf({
      picks: Array.from({ length: 20 }, (_, i) => ({ pick_no: i + 1, picked_by: 'u2' })),
      boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', adp: 24 }],
    })
    const t = tips.find(x => x.type === 'value')
    expect(t).toBeTruthy()
    expect(t.text).not.toMatch(/zwischen Pick/)
  })
})

describe('pos_need entrauscht', () => {
  it('schweigt bei Pick 1 — dort ist die Aussage trivial wahr', () => {
    const tips = tipsOf({
      picks: [], boardPlayers: [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1' }],
    })
    expect(tips.find(t => t.type === 'pos_need')).toBeUndefined()
  })

  it('feuert, wenn die verbleibenden Picks die offenen Startplaetze kaum noch decken', () => {
    // 16 Runden, 15 eigene Picks verbraucht -> 1 Pick uebrig, Startplaetze offen
    const picks = []
    for (let i = 1; i <= 178; i++) picks.push({ pick_no: i, picked_by: i % 12 === 1 ? 'u1' : 'u2', metadata: { position: 'WR' } })
    const tips = tipsOf({ picks, boardPlayers: [{ name: 'R B', nname: 'rb', pos: 'RB', rk: '1' }] })
    expect(tips.find(t => t.type === 'pos_need')).toBeTruthy()
  })

  it('POS_NEED_SLACK ist eine benannte Konstante, keine Magic Number', () => {
    expect(POS_NEED_SLACK).toBe(2)
  })
})

describe('Bye-Cluster', () => {
  it('warnt, wenn eigene Starter derselben Position in derselben Bye-Woche klumpen', () => {
    const picks = [
      { pick_no: 1, picked_by: 'u1', metadata: { position: 'RB', first_name: 'A', last_name: 'B' } },
      { pick_no: 2, picked_by: 'u1', metadata: { position: 'RB', first_name: 'C', last_name: 'D' } },
    ]
    const boardPlayers = [
      { name: 'A B', nname: 'ab', pos: 'RB', rk: '1', bye: 7, status: 'me', pick_no: 1 },
      { name: 'C D', nname: 'cd', pos: 'RB', rk: '2', bye: 7, status: 'me', pick_no: 2 },
    ]
    const tips = tipsOf({ picks, boardPlayers })
    const t = tips.find(x => x.type === 'bye_cluster')
    expect(t).toBeTruthy()
    expect(t.text).toMatch(/Woche 7/)
  })

  it('schweigt ohne Klumpen', () => {
    const picks = [{ pick_no: 1, picked_by: 'u1', metadata: { position: 'RB' } }]
    const boardPlayers = [{ name: 'A B', nname: 'ab', pos: 'RB', rk: '1', bye: 7, status: 'me', pick_no: 1 }]
    expect(tipsOf({ picks, boardPlayers }).find(t => t.type === 'bye_cluster')).toBeUndefined()
  })
})

describe('enabled', () => {
  it('liefert nichts, wenn ausgeschaltet', () => {
    expect(tipsOf({ enabled: false, picks: [], boardPlayers: [] })).toEqual([])
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test -- useDraftTips`
Expected: FAIL — `POS_NEED_SLACK` nicht exportiert, Texte englisch.

- [ ] **Step 3: Implementieren**

In `src/hooks/useDraftTips.js`:

**a) Konstante exportieren:**

```js
// Der pos_need-Tip feuert erst, wenn die verbleibenden eigenen Picks die
// offenen Startplaetze kaum noch decken. Vorher war er ab Pick 1 aktiv und
// damit trivial wahr ("Du brauchst noch RB-Starter" — ja, es ist Pick 1).
export const POS_NEED_SLACK = 2
```

**b) Alle Texte übersetzen:**

| Alt | Neu |
|---|---|
| `You're on the clock next. Decide now.` | `Du bist gleich dran. Entscheidung treffen.` |
| `You're up in ~${window} picks. Shortlist 2–3 names.` | `Du bist in ~${window} Picks dran. 2–3 Namen vormerken.` |
| `Value on board: … is N under ADP … likely/unlikely to reach your next pick` | siehe (c) |
| `Only N ${P} left in current tier. Next tier ~${gap} ranks back — consider …` | `Letzter ${P} im Tier. Nächste Gruppe ~${gap} Plätze zurück — ${cand.name} nicht liegenlassen.` |
| `You still need a starting QB. … is the best available.` | `Dir fehlt noch ein Start-QB. ${qb.name} ist der beste Verfügbare.` |
| `You still need ${P} starters. Best available: …` | `Dir fehlen noch ${P}-Starter. Bester Verfügbarer: ${best.name}.` |
| `… carries an injury tag (${st}). Discount or plan a contingency.` | `${p.name} hat einen Verletzungsstatus (${st}). Abwerten oder Plan B vorbereiten.` |
| `Strategy active: Zero RB — lean WR/TE early; take RB discounts later.` | `Strategie aktiv: Zero RB — früh WR/TE, RB-Schnäppchen später.` |
| `Strategy active: Hero RB — anchor RB early, then pivot to WR/TE.` | `Strategie aktiv: Hero RB — ein RB früh als Anker, danach WR/TE.` |
| `Strategy active: Elite TE — take a top TE if tier is about to drop; otherwise punt.` | `Strategie aktiv: Elite TE — Top-TE nehmen, wenn das Tier kippt; sonst punten.` |
| `Strategy active: Early QB (SF) — prioritize securing two starters.` | `Strategie aktiv: Früher QB (SF) — zwei Starter sichern hat Vorrang.` |

**c) Value-Tip mit Streuung** — Block 1 (Zeilen 86–104) ersetzen:

```js
    const top = avail.slice(0, 30).sort((a, b) => Number(a.rk) - Number(b.rk))
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
```

**d) `pos_need` entrauschen** — Block 3 (131–157) ersetzen. Das runden-basierte `qbGate` entfällt:

```js
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
```

`draftRounds` als neuen Parameter aufnehmen (Signatur + `useMemo`-Deps) und in `App.jsx` aus `format.rounds` durchreichen.

**e) Bye-Cluster** — neuer Block nach dem Injury-Block:

```js
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
```

- [ ] **Step 4: Injury-Daten verdrahten — sonst feuert der Injury-Block nie**

Der Injury-Tip existiert seit jeher, hat aber **nie Daten**: weder FantasyCalc noch FFC liefern
`injury_status`. Sleeper liefert es (142 aktive Spieler, verifiziert), und seit Task 3 kommt
`sleeperId` mit — das ist die Brücke.

Test zuerst, in `src/services/marketMerge.test.js` ergänzen:

```js
import { enrichWithInjuries } from './marketMerge'

describe('enrichWithInjuries', () => {
  const meta = { '9509': { injury_status: 'Questionable' }, '7564': { injury_status: null } }

  it('haengt injury_status ueber die sleeperId an', () => {
    const out = enrichWithInjuries([{ name: 'A', sleeperId: '9509' }], meta)
    expect(out[0].injury_status).toBe('Questionable')
  })
  it('ohne sleeperId bleibt der Spieler unveraendert', () => {
    const out = enrichWithInjuries([{ name: 'B', sleeperId: null }], meta)
    expect(out[0].injury_status).toBeNull()
  })
  it('ohne Meta bleibt das Board unveraendert', () => {
    const out = enrichWithInjuries([{ name: 'A', sleeperId: '9509' }], {})
    expect(out[0].injury_status).toBeNull()
  })
})
```

Run: `npm test -- marketMerge` → FAIL (`enrichWithInjuries is not a function`)

In `src/services/marketMerge.js`:

```js
// Weder FantasyCalc noch FFC kennen Verletzungen. Sleeper schon — und seit dem
// sleeperId-Durchreichen im Rankings-Endpoint haben wir den Schluessel dafuer.
export function enrichWithInjuries(boardPlayers, playersMeta = {}) {
  return (boardPlayers || []).map((p) => {
    const meta = p?.sleeperId ? playersMeta[String(p.sleeperId)] : null
    return { ...p, injury_status: meta?.injury_status ?? p.injury_status ?? null }
  })
}
```

In `src/stores/useBoardStore.js` — `handleAutoImport` ruft es nach dem Merge auf. Die Meta ist
24h-gecacht (`loadPlayersMetaCached`), kostet also nur beim ersten Mal:

```js
import { loadPlayersMetaCached } from '../services/playersMeta'
import { mergeRankingsWithMarket, overlayMarketData, enrichWithInjuries } from '../services/marketMerge'

        // … nach dem Merge:
        let withInjuries = players
        try {
          const meta = await loadPlayersMetaCached({ season: new Date().getFullYear() })
          withInjuries = enrichWithInjuries(players, meta)
        } catch { /* Verletzungsdaten sind Kuer, kein Grund den Import zu kippen */ }
        set({ csvRawText: '', boardPlayers: withInjuries, /* … */ })
```

Run: `npm test -- marketMerge` → PASS

- [ ] **Step 5: Tote Felder in `playersMeta.js` entfernen**

`adp_ppr` und `adp` aus `SLIM_KEYS` (Zeilen 16–17) löschen. Sleeper liefert für 0 von 3221 aktiven Spielern Werte — die Felder suggerieren eine Datenquelle, die es nicht gibt. Kommentar:

```js
// Sleeper liefert kein ADP und keine bye_week (verifiziert 2026-07-16: 0 von
// 3221 aktiven Spielern). ADP kommt aus /api/rankings/ffc-adp, Bye ebenfalls.
```

`bye_week` **bleibt** — `mergeLivePicksWithBoard` liest `pick.metadata.bye_week` aus den Draft-Picks, das ist eine andere Quelle.

- [ ] **Step 6: Tests laufen lassen**

Run: `npm test -- useDraftTips`
Expected: PASS — 10 Tests grün.

Run: `npm test`
Expected: alle grün.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useDraftTips.js src/hooks/useDraftTips.test.js src/services/playersMeta.js src/services/marketMerge.js src/services/marketMerge.test.js src/stores/useBoardStore.js
git commit -m "feat(tips): deutsch, ADP-Streuung, Bye-Cluster, pos_need entrauscht

Die Redraft-Tips waren als einzige englisch. Value nennt jetzt die Spanne
statt eines Binaer-Labels, der Bye-Cluster wird endlich gebaut, pos_need
schweigt bei Pick 1. Tote adp-Felder aus playersMeta entfernt.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Verifikation gegen einen echten Sleeper-Mock

**Keine Code-Änderung.** Laut `project_next_steps` wurden die On-the-clock-Leiste und der gesamte AI-Pfad **nie** gegen echte Draft-Daten gesehen. Diese Task behauptet nichts, sie prüft.

- [ ] **Step 1: Beide Server starten**

Run: `npm run dev:all`
Expected: Client auf 5173, API auf 5175.

- [ ] **Step 2: Mock anlegen und starten**

Auf sleeper.com einen Mock-Draft anlegen, Link kopieren. Im Dashboard in die Mock-Karte einfügen, „Starten".
Expected: springt aufs Board, **das vorhandene Board bleibt erhalten**.

- [ ] **Step 3: Import prüfen**

Setup → Schritt 2 → „Rankings auto-importieren".
Expected: Banner nennt Gesamtzahl, ADP-Treffer und Fehlschläge. Board zeigt ADP-, Δ-ADP- und Bye-Spalte. K und DEF sind vorhanden.

- [ ] **Step 4: Herkunfts-Zeile prüfen**

Expected: nennt beide Quellen, die Draft-Zahl, ein plausibles Alter und **Modus: Redraft** (nicht Rookie — das ist der B6-Test in echt).

- [ ] **Step 5: Markt-Refresh prüfen**

Einen Spieler per Drag-and-Drop nach oben ziehen, dann „Aktualisieren".
Expected: **die manuelle Reihenfolge bleibt**, nur ADP/Stand ändern sich.

- [ ] **Step 6: Picks und Tips prüfen**

Im Mock ein paar Picks machen.
Expected: Gepickte Spieler werden markiert; die On-the-clock-Leiste zeigt eine plausible Runde/Pick-Nummer; Tips sind deutsch; bei Pick 1 erscheint **kein** `pos_need`-Tip.

- [ ] **Step 7: Ergebnis dokumentieren**

Was funktioniert hat und was nicht — ungeschönt. Fehlschläge werden zu Issues, nicht zu Fußnoten. Falls die On-the-clock-Leiste hier zum ersten Mal echte Daten sieht und falsch rechnet: **das ist ein Fund, kein Betriebsunfall.**

---

## Abhängigkeiten und Parallelisierung

```
Task 0 (Hygiene)
   └─> Task 1 (deriveFormat) ─┐
       Task 2 (marketMerge) ──┤
                              ├─> Task 3 (Server)      ─┐
                              ├─> Task 4 (Store)  ──────┤
                              └─> Task 5 (Konsumenten) ─┤
                                                        ├─> Task 6 (Herkunfts-Zeile)
                                                        ├─> Task 7 (Board-Spalten)
                                                        ├─> Task 8 (Mock-Karte)
                                                        ├─> Task 9 (Wizard)
                                                        └─> Task 10 (Banner)
                                                              └─> Task 11 (Tips)
                                                                    └─> Task 12 (Verifikation)
```

- **Task 0** blockiert alles (ohne verlässliches `npm test` kein TDD).
- **Tasks 1 + 2** sind reine Funktionen ohne gemeinsamen State → **echt parallel**.
- **Tasks 3, 4, 5** können parallel laufen: 3 fasst nur `src/server/*` an, 5 nur `App/SetupForm/BoardSection/SetupPage`, 4 nur `useBoardStore`. Task 4 braucht die Endpoints aus 3 **nur zur Laufzeit**, nicht zur Implementierung (die Tests mocken `fetch`).
- **Tasks 6–10** sind UI und berühren unterschiedliche Dateien — parallel möglich. **Achtung:** 6, 7, 8, 9, 10 schreiben **alle** in `src/styles/style.css`. Entweder sequenziell mergen oder Konflikte in Kauf nehmen (die Blöcke sind disjunkt, Konflikte daher mechanisch lösbar). Tasks 9 und 10 fassen beide `SetupPage.jsx` an → **nacheinander**.
- **Task 11** braucht die Datenfelder aus Task 4.
- **Task 12** ist der Schluss und braucht alles.
