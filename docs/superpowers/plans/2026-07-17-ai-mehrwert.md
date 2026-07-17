# AI-Mehrwert Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die drei AI-Features (Advice, Draft-Review, Trade) werden vertrauenswürdig, kostentransparent und deutsch — mit dem Live-Advice als ausgebautem Kern (Run-Erkennung, Gegner-Lücken, Survival-Verdicts, Pick-Plan).

**Architecture:** Server-Routen konsolidieren in `src/server/apiRoutes.js` (dev & prod registrieren dasselbe Modul, Prompt-Caching zentral). Client bekommt drei neue pure Module (`draftFlow.js`, `aiValidate.js`, `aiCost.js`), erweiterte Payload-Builder und umgebaute Dialoge. Jede AI-Ausgabe läuft vor dem Rendern durch eine Validierungsschicht gegen Board/Roster.

**Tech Stack:** React 18 + Vite, Express 5, `@anthropic-ai/sdk` (Streaming + Tool-Use), Zustand, Vitest 1.6 + jsdom 24 + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-17-ai-mehrwert-design.md` — bei Widersprüchen gilt die Spec.

## Global Constraints

- **Arbeitsverzeichnis ist der Worktree** `F:\sleeper-draft-helper\.claude\worktrees\ai-review` (Branch `worktree-ai-review`). Alle Kommandos dort ausführen — ein Testlauf im Haupt-Checkout sammelt fremde Worktrees ein.
- **Node 18.16**: `vitest` bleibt `^1.6`, `jsdom` bleibt `^24`. Keine Dependency-Upgrades.
- **Kein Linter.** `npm test` = `vitest run`. Baseline: **20 Dateien / 186 Tests grün**, `npx vite build` sauber. Jede Task endet mit voller Suite + Build.
- **UI-Texte, Kommentare, AI-Freitexte: Deutsch (du-Form).** Feld-/Funktionsnamen englisch.
- **Modell-Default: `claude-sonnet-5`**, Override via `SDH_MODEL`. `/api/validate-key` bleibt auf `claude-haiku-4-5-20251001`.
- **Sleeper `league.settings.type` ist eine Zahl** (0=redraft, 1=keeper, 2=dynasty) — numerisch vergleichen.
- **`Number(null) === 0`-Falle:** „kein Wert" ist im Board `null`. Immer `x == null` prüfen, bevor `Number(x)` gerechnet wird. Niemals mit Slot/Pick 0 weiterrechnen, wenn die Quelle `null` war.
- **Icon-Namen vor Benutzung gegen `MAP` in `src/components/Icon.jsx` prüfen** — unbekannte Namen rendern still einen Star.
- **Der manuelle CSV-Import (`parseFantasyProsCsv`, `handleCsvLoad`) wird nicht angefasst.**
- **Kein echter AI-Call während Task 1–12.** Bezahlte Verifikation ausschließlich in Task 13 (Budget: max. 3 Calls, Key ist im Browser hinterlegt).
- Commits: prägnante deutsche Subjects wie im Repo üblich (`fix(ai): …`, `feat(server): …`). Mehrzeilige Messages per Bash-Heredoc (PowerShell-Here-Strings zerlegen Subjects).

---

### Task 1: Server-Konsolidierung — `apiRoutes.js`, schlanke Entrypoints, Sonnet-5-Default

**Files:**
- Create: `src/server/apiRoutes.js`
- Create: `src/server/apiRoutes.test.js`
- Modify: `src/server/index.js` (komplett neu, ~25 Zeilen)
- Modify: `src/server/prod.js` (komplett neu, ~35 Zeilen)
- Modify: `CLAUDE.md` (Abschnitt „Dev vs. prod server split")

**Interfaces:**
- Produces: `registerApiRoutes(app, { model })` — registriert **alle** `/api/*`-Routen; `REVIEW_TOOL` (named export); `DEFAULT_MODEL = 'claude-sonnet-5'` (named export).
- Consumes: `FFC_FORMATS`, `normalizeFfcPlayer`, `isDynastyFromQuery` aus `./rankings.js` (existiert, getestet).

- [ ] **Step 1: Beide Quelldateien vollständig lesen**

`src/server/index.js` (463 Zeilen) und `src/server/prod.js` (458 Zeilen) komplett lesen. Sie sind Fast-Zwillinge; prod-exklusiv sind nur: `path`/`fileURLToPath`-Imports, `__dirname`/`distDir`, `express.static(distDir)`, der SPA-Fallback `app.get(/^\/(?!api).*/, …)` und Port 8080. index-exklusiv: `cors`.

- [ ] **Step 2: Failing Test für das neue Modul schreiben**

`src/server/apiRoutes.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { registerApiRoutes, REVIEW_TOOL, DEFAULT_MODEL } from './apiRoutes.js'

describe('apiRoutes — Modul-Vertrag', () => {
  it('exportiert registerApiRoutes als Funktion', () => {
    expect(typeof registerApiRoutes).toBe('function')
  })

  it('Default-Modell ist Sonnet 5', () => {
    expect(DEFAULT_MODEL).toBe('claude-sonnet-5')
  })

  it('registriert alle bekannten Routen auf der App', () => {
    const registered = []
    const fakeApp = {
      get: (p) => registered.push(`GET ${p}`),
      post: (p) => registered.push(`POST ${p}`),
    }
    registerApiRoutes(fakeApp, { model: DEFAULT_MODEL })
    for (const r of [
      'GET /api/rankings/ffc-adp', 'GET /api/rankings/fantasycalc',
      'GET /api/rankings/ktc-dynasty', 'GET /api/rankings/ktc-rookies',
      'GET /api/health', 'POST /api/validate-key',
      'POST /api/ai-advice', 'POST /api/ai-draft-review', 'POST /api/ai-trade',
    ]) expect(registered).toContain(r)
  })

  it('REVIEW_TOOL ist das Draft-Review-Schema', () => {
    expect(REVIEW_TOOL.name).toBe('return_draft_review')
  })
})
```

- [ ] **Step 3: Test rot sehen**

Run: `npx vitest run src/server/apiRoutes.test.js`
Expected: FAIL — „Failed to resolve import ./apiRoutes.js".

- [ ] **Step 4: `apiRoutes.js` anlegen — Inhalt aus index.js verschieben**

Neues `src/server/apiRoutes.js` mit dieser Struktur; die markierten Blöcke **wörtlich** aus `src/server/index.js` übernehmen (Zeilenangaben Stand HEAD `16b2574`):

```js
// Alle /api-Routen von Dev- UND Prod-Server. Eine Aenderung hier gilt fuer beide —
// die alte Regel "index.js und prod.js synchron halten" ist damit Geschichte.
import Anthropic from '@anthropic-ai/sdk'
import { load as cheerioLoad } from 'cheerio'
import { FFC_FORMATS, normalizeFfcPlayer, isDynastyFromQuery } from './rankings.js'

export const DEFAULT_MODEL = 'claude-sonnet-5'

// [verschoben: index.js 24–35] setSSEHeaders, sendSSE — unveraendert
// [verschoben: index.js 38–125] const REVIEW_TOOL = { … } — unveraendert,
//   aber mit `export const REVIEW_TOOL`

export function registerApiRoutes(app, { model = DEFAULT_MODEL } = {}) {
  const MODEL = model

  // [verschoben: index.js 128–155] app.get('/api/rankings/ffc-adp', …)
  // [verschoben: index.js 158–195] app.get('/api/rankings/fantasycalc', …)
  // [verschoben: index.js 198–248] app.get('/api/rankings/ktc-dynasty', …)
  // [verschoben: index.js 251–298] app.get('/api/rankings/ktc-rookies', …)
  // [verschoben: index.js 301–309] app.get('/api/health', …)
  //   → im Response-Objekt bleibt `model: MODEL`
  // [verschoben: index.js 312–327] app.post('/api/validate-key', …)
  // [verschoben: index.js 330–372] app.post('/api/ai-advice', …)
  // [verschoben: index.js 375–416] app.post('/api/ai-draft-review', …)
  // [verschoben: index.js 419–457] app.post('/api/ai-trade', …)
}
```

Beim Verschieben zwei gezielte Änderungen (mehr nicht — Caching kommt in Task 2):

a) **Review-Result bekommt `usage` und `model`** (heute fehlen beide). In der ai-draft-review-Route:

```js
      parsed.meta = parsed.meta || {}
      parsed.meta.model = parsed.meta.model || finalMessage.model
      sendSSE(res, 'result', { ok: true, parsed, model: finalMessage.model, usage: finalMessage.usage })
```

b) `stream.on('text', …)` in **ai-advice** und **ai-trade** entfällt ersatzlos (mit forced `tool_choice` feuert es nie; der Client baut sein Text-Handling in Task 9 zurück).

- [ ] **Step 5: `index.js` auf den Kern schrumpfen**

Kompletter neuer Inhalt von `src/server/index.js`:

```js
// Dev-Start: node src/server/index.js  (oder via "npm run dev:api")
// Alle Routen liegen in apiRoutes.js und gelten identisch fuer den Prod-Server.
import express from 'express'
import cors from 'cors'
import { registerApiRoutes, DEFAULT_MODEL } from './apiRoutes.js'

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))

const ALLOW_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
app.use(cors({ origin: ALLOW_ORIGIN }))

const MODEL = process.env.SDH_MODEL || DEFAULT_MODEL
registerApiRoutes(app, { model: MODEL })

const PORT = Number(process.env.PORT) || 5175
app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI server listening on http://localhost:${PORT} (model: ${MODEL})`)
})
```

- [ ] **Step 6: `prod.js` auf den Kern schrumpfen**

Kompletter neuer Inhalt von `src/server/prod.js` — `distDir`-Zuweisung aus der bestehenden Datei **wörtlich** übernehmen (Step 1):

```js
// Start (Prod):  PORT=8080 node src/server/prod.js
// Model override: SDH_MODEL=… node src/server/prod.js
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerApiRoutes, DEFAULT_MODEL } from './apiRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const app = express()

const PORT = Number(process.env.PORT) || 8080
const MODEL = process.env.SDH_MODEL || DEFAULT_MODEL

app.disable('x-powered-by')
app.use(express.json({ limit: '3mb' }))

registerApiRoutes(app, { model: MODEL })

// [distDir-Zeile(n) wörtlich aus der alten prod.js übernehmen]
app.use(express.static(distDir))
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Prod server running on http://localhost:${PORT} (model: ${MODEL})`)
})
```

- [ ] **Step 7: Tests grün + beide Server starten**

Run: `npx vitest run` → 21 Dateien grün (Baseline + apiRoutes.test.js).
Run: `node src/server/index.js` (kurz), dann `curl -s http://127.0.0.1:5175/api/health` →
Expected: `"model":"claude-sonnet-5"`. Server wieder beenden.
Run: `npx vite build && node src/server/prod.js` (kurz), `curl -s http://127.0.0.1:8080/api/health` → gleiches Modell; `curl -s http://127.0.0.1:8080/ | head -3` liefert HTML. Beenden.

- [ ] **Step 8: CLAUDE.md aktualisieren**

Den Abschnitt „### Dev vs. prod server split (keep in sync)" ersetzen durch:

```markdown
### Server-Routen: eine Quelle

`src/server/apiRoutes.js` enthält **alle** `/api/*`-Routen (Rankings, validate-key,
ai-advice, ai-draft-review, ai-trade) samt Tool-Schemas. `index.js` (dev, Port 5175,
CORS) und `prod.js` (prod, Port 8080, serviert `dist/`) sind dünne Entrypoints, die
`registerApiRoutes(app, { model })` aufrufen. **Endpoint-Änderungen passieren nur
noch in `apiRoutes.js`.** AI-Modell-Default: `claude-sonnet-5` (`SDH_MODEL` überschreibt).
```

Die Endpoint-Aufzählung darunter bleibt inhaltlich, der Satz zum Modell-Default (`claude-sonnet-4-6`) wird auf `claude-sonnet-5` korrigiert.

- [ ] **Step 9: Commit**

```bash
git add src/server/apiRoutes.js src/server/apiRoutes.test.js src/server/index.js src/server/prod.js CLAUDE.md
git commit -m "refactor(server): /api-Routen in apiRoutes.js konsolidiert, Default Sonnet 5"
```

---

### Task 2: Prompt-Caching — `applyPromptCaching`

**Files:**
- Modify: `src/server/apiRoutes.js`
- Test: `src/server/apiRoutes.test.js` (erweitern)

**Interfaces:**
- Produces: `applyPromptCaching(payload)` (named export aus `apiRoutes.js`) — nimmt `{system?, tools?, …}`, gibt neues Objekt zurück: String-`system` → Block-Array mit `cache_control`, letztes Tool markiert. Wird in allen drei AI-Routen vor dem Anthropic-Call angewandt.

- [ ] **Step 1: Failing Tests schreiben** (an `apiRoutes.test.js` anhängen)

```js
import { applyPromptCaching } from './apiRoutes.js'

describe('applyPromptCaching', () => {
  it('macht aus String-system einen gecachten Text-Block', () => {
    const out = applyPromptCaching({ system: 'Du bist Analyst.', messages: [] })
    expect(out.system).toEqual([
      { type: 'text', text: 'Du bist Analyst.', cache_control: { type: 'ephemeral' } },
    ])
  })

  it('markiert nur das letzte Tool', () => {
    const tools = [{ name: 'a', input_schema: {} }, { name: 'b', input_schema: {} }]
    const out = applyPromptCaching({ tools })
    expect(out.tools[0].cache_control).toBeUndefined()
    expect(out.tools[1].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('laesst Payloads ohne system/tools unangetastet und mutiert nie das Original', () => {
    const p = { messages: [{ role: 'user', content: 'x' }] }
    const out = applyPromptCaching(p)
    expect(out.system).toBeUndefined()
    expect(out.tools).toBeUndefined()
    const q = { system: 's', tools: [{ name: 'a' }] }
    applyPromptCaching(q)
    expect(q.system).toBe('s')
    expect(q.tools[0].cache_control).toBeUndefined()
  })
})
```

- [ ] **Step 2: Rot sehen** — `npx vitest run src/server/apiRoutes.test.js` → FAIL (kein Export).

- [ ] **Step 3: Implementieren** (in `apiRoutes.js`, oberhalb von `registerApiRoutes`)

```js
// Statische Payload-Teile (System-Prompt, Tool-Schemas) fuer Anthropic-Prompt-Caching
// markieren. Greift erst ab ~1024 Token Praefix — darunter passiert schlicht nichts,
// das ist KEIN Fehlerfall. Cache-TTL ~5 min, passt zum Advice-Rhythmus im Draft.
export function applyPromptCaching(payload = {}) {
  const out = { ...payload }
  if (typeof out.system === 'string' && out.system) {
    out.system = [{ type: 'text', text: out.system, cache_control: { type: 'ephemeral' } }]
  }
  if (Array.isArray(out.tools) && out.tools.length) {
    out.tools = out.tools.map((t, i, arr) =>
      i === arr.length - 1 ? { ...t, cache_control: { type: 'ephemeral' } } : t
    )
  }
  return out
}
```

- [ ] **Step 4: In den drei AI-Routen verdrahten**

In `ai-advice` und `ai-trade` als erste Zeile im `try`: `const p = applyPromptCaching(payload)` — danach überall `p.system`, `p.messages`, `p.tools`, `p.tool_choice`, `p.max_tokens`, `p.temperature` statt `payload.*` im `client.messages.stream({...})`.
In `ai-draft-review` (Tools kommen vom Server): `const p = applyPromptCaching({ ...payload, tools: [REVIEW_TOOL] })` und im Stream-Call `tools: p.tools` statt `tools: [REVIEW_TOOL]`.

- [ ] **Step 5: Grün + volle Suite** — `npx vitest run` → alles grün.

- [ ] **Step 6: Commit**

```bash
git add src/server/apiRoutes.js src/server/apiRoutes.test.js
git commit -m "feat(server): Prompt-Caching fuer System-Prompt und Tool-Schemas"
```

---

### Task 3: `draftFlow.js` — Run-Erkennung und Gegner-Lücken (Snake-Mathe)

**Files:**
- Create: `src/services/draftFlow.js`
- Create: `src/services/draftFlow.test.js`

**Interfaces:**
- Consumes: `countStarters(rosterPositions)` aus `src/services/derive.js` (existiert; liefert `{QB,RB,WR,TE,FLEX,SUPER_FLEX,…}`).
- Produces:
  - `snakeSlotForPick(pickNo, teams)` → `number | null`
  - `detectRuns(picks, { window })` → `{ recent: [{pick_no,pos}], counts: {POS:n}, run: 'RB'|null }`; Konstanten `RUN_WINDOW=12`, `RUN_SHARE=0.4`, `RUN_MIN=4` exportiert
  - `opponentsUntilMyNext({ picks, teamsCount, mySlot, upcomingPick, rosterPositions })` → `{ my_next_pick: number, between: [{pick_no, slot, filled: {POS:n}, open_starters: {QB,RB,WR,TE}}] } | null`

- [ ] **Step 1: Failing Tests schreiben**

`src/services/draftFlow.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { snakeSlotForPick, detectRuns, opponentsUntilMyNext, RUN_MIN } from './draftFlow'

const pick = (no, pos) => ({ pick_no: no, metadata: { position: pos } })

describe('snakeSlotForPick', () => {
  it('Runde 1 laeuft vorwaerts, Runde 2 gespiegelt', () => {
    expect(snakeSlotForPick(1, 10)).toBe(1)
    expect(snakeSlotForPick(10, 10)).toBe(10)
    expect(snakeSlotForPick(11, 10)).toBe(10)   // Snake: Slot 10 pickt doppelt
    expect(snakeSlotForPick(20, 10)).toBe(1)
    expect(snakeSlotForPick(21, 10)).toBe(1)    // und Slot 1 auch
  })
  it('null bei kaputten Eingaben — niemals Slot 0 erfinden', () => {
    expect(snakeSlotForPick(null, 10)).toBe(null)
    expect(snakeSlotForPick(4, null)).toBe(null)
    expect(snakeSlotForPick(0, 10)).toBe(null)
  })
})

describe('detectRuns', () => {
  it('erkennt einen RB-Run im Fenster', () => {
    const picks = [
      ...[1,2,3,4,5].map(n => pick(n, 'RB')),
      ...[6,7,8,9,10,11,12].map(n => pick(n, 'WR')),
    ]
    const r = detectRuns(picks)
    expect(r.counts.RB).toBe(5)
    expect(r.run).toBe('WR')   // 7 von 12 = 58% — WR ist der staerkere Run
  })
  it('kein Run unter dem Minimum', () => {
    const picks = [pick(1,'RB'), pick(2,'RB'), pick(3,'RB'), pick(4,'WR')]
    expect(detectRuns(picks).run).toBe(null)   // RB 3 < RUN_MIN
    expect(RUN_MIN).toBe(4)
  })
  it('leere Picks: leeres Ergebnis, kein Wurf', () => {
    expect(detectRuns([])).toEqual({ recent: [], counts: {}, run: null })
  })
})

describe('opponentsUntilMyNext', () => {
  const roster = ['QB','RB','RB','WR','WR','TE','FLEX','BN']
  it('10 Teams, ich Slot 4, Pick 4 steht an: Gegner sind Picks 5–16, mein naechster ist 17', () => {
    const r = opponentsUntilMyNext({
      picks: [pick(1,'RB'), pick(2,'RB'), pick(3,'WR')],
      teamsCount: 10, mySlot: 4, upcomingPick: 4, rosterPositions: roster,
    })
    expect(r.my_next_pick).toBe(17)
    expect(r.between).toHaveLength(12)
    expect(r.between[0].pick_no).toBe(5)
    expect(r.between[0].slot).toBe(5)
    // Slot 1 hat Pick 1 (RB) gemacht → gefuellt, offener RB-Bedarf sinkt
    const slot1 = r.between.find(b => b.slot === 1)
    expect(slot1.filled.RB).toBe(1)
    expect(slot1.open_starters.RB).toBe(2)   // req.RB(2)+FLEX(1)-1
  })
  it('bin ich nicht dran, zaehlen die Gegner ab upcomingPick', () => {
    const r = opponentsUntilMyNext({
      picks: [], teamsCount: 10, mySlot: 4, upcomingPick: 7, rosterPositions: roster,
    })
    expect(r.my_next_pick).toBe(17)
    expect(r.between[0].pick_no).toBe(7)
  })
  it('mySlot null ⇒ null — die Number(null)-Falle', () => {
    expect(opponentsUntilMyNext({ picks: [], teamsCount: 10, mySlot: null, upcomingPick: 4, rosterPositions: roster })).toBe(null)
  })
})
```

- [ ] **Step 2: Rot sehen** — `npx vitest run src/services/draftFlow.test.js` → FAIL (Modul fehlt).

- [ ] **Step 3: Implementieren**

`src/services/draftFlow.js`:

```js
// Pick-Verlauf lesen: Positions-Runs und die Luecken der Gegner, die zwischen
// jetzt und meinem naechsten Pick ziehen. Pure Snake-Mathe, keine API-Calls.
import { countStarters } from './derive'

export const RUN_WINDOW = 12
export const RUN_SHARE = 0.4
export const RUN_MIN = 4

export function snakeSlotForPick(pickNo, teams) {
  // Kein x==null-Shortcut: Number(null)===0 waere hier ein erfundener Slot.
  if (pickNo == null || teams == null) return null
  const n = Number(pickNo), t = Number(teams)
  if (!Number.isFinite(n) || n < 1 || !Number.isFinite(t) || t < 1) return null
  const round = Math.ceil(n / t)
  const inRound = n - (round - 1) * t
  return round % 2 === 1 ? inRound : t - inRound + 1
}

export function detectRuns(picks = [], { window = RUN_WINDOW } = {}) {
  const sorted = (picks || [])
    .filter(p => Number.isFinite(Number(p?.pick_no)) && p?.pick_no != null)
    .sort((a, b) => a.pick_no - b.pick_no)
  const recent = sorted.slice(-window).map(p => ({
    pick_no: p.pick_no,
    pos: String(p?.metadata?.position || '').toUpperCase() || '?',
  }))
  const counts = {}
  for (const r of recent) { if (r.pos !== '?') counts[r.pos] = (counts[r.pos] || 0) + 1 }
  let run = null
  for (const [pos, c] of Object.entries(counts)) {
    if (c >= RUN_MIN && c >= Math.ceil(recent.length * RUN_SHARE)) {
      if (!run || c > counts[run]) run = pos
    }
  }
  return { recent, counts, run }
}

export function opponentsUntilMyNext({ picks = [], teamsCount, mySlot, upcomingPick, rosterPositions = [] } = {}) {
  if (mySlot == null || teamsCount == null || upcomingPick == null) return null
  const t = Number(teamsCount), slot = Number(mySlot), up = Number(upcomingPick)
  if (!Number.isFinite(t) || t < 1 || !Number.isFinite(slot) || !Number.isFinite(up) || up < 1) return null

  const from = snakeSlotForPick(up, t) === slot ? up + 1 : up
  let myNext = null
  for (let n = from; n <= from + 2 * t; n++) {
    if (snakeSlotForPick(n, t) === slot) { myNext = n; break }
  }
  if (myNext == null) return null

  const filled = {}
  for (const p of picks || []) {
    const s = snakeSlotForPick(p?.pick_no, t)
    if (s == null) continue
    const pos = String(p?.metadata?.position || '').toUpperCase()
    if (!pos) continue
    if (!filled[s]) filled[s] = {}
    filled[s][pos] = (filled[s][pos] || 0) + 1
  }

  const req = countStarters(rosterPositions)
  const isSF = (rosterPositions || []).some(r => String(r).toUpperCase().includes('SUPER'))
  const between = []
  for (let n = from; n < myNext; n++) {
    const s = snakeSlotForPick(n, t)
    const f = filled[s] || {}
    // Bewusst dieselbe (vereinfachte) Bedarfsrechnung wie useDraftTips: FLEX
    // zaehlt auf RB UND WR — konsistent falsch ist besser als inkonsistent richtig.
    between.push({
      pick_no: n, slot: s, filled: f,
      open_starters: {
        QB: Math.max(0, (isSF ? req.QB + (req.SUPER_FLEX || 0) : req.QB) - (f.QB || 0)),
        RB: Math.max(0, (req.RB + (req.FLEX || 0)) - (f.RB || 0)),
        WR: Math.max(0, (req.WR + (req.FLEX || 0)) - (f.WR || 0)),
        TE: Math.max(0, req.TE - (f.TE || 0)),
      },
    })
  }
  return { my_next_pick: myNext, between }
}
```

- [ ] **Step 4: Grün sehen** — `npx vitest run src/services/draftFlow.test.js` → PASS. Volle Suite grün.

- [ ] **Step 5: Commit**

```bash
git add src/services/draftFlow.js src/services/draftFlow.test.js
git commit -m "feat(ai): draftFlow — Positions-Runs und Gegner-Luecken per Snake-Mathe"
```

---

### Task 4: `aiCost.js` — Token-Schätzung und Preisformat

**Files:**
- Create: `src/services/aiCost.js`
- Create: `src/services/aiCost.test.js`

**Interfaces:**
- Produces: `estimateTokens(payload)` → `number|null`; `estimateCostUsd({inputTokens, outputTokens, model})` → `number`; `formatTokens(n)` → `'9,2k'`; `formatEstimate(payload, model)` → `'≈ 9,2k Tokens · ~0,03 $'`; `formatUsage(usage, model)` → `'9,2k in / 0,8k out · Cache 2,1k · ~0,04 $'`; `PRICING` (export).

- [ ] **Step 1: Failing Tests schreiben**

`src/services/aiCost.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateCostUsd, formatTokens, formatEstimate, formatUsage } from './aiCost'

describe('aiCost', () => {
  it('schaetzt Tokens grob als Zeichen/4', () => {
    expect(estimateTokens({ a: 'x'.repeat(396) })).toBe(Math.round(408 / 4)) // JSON: {"a":"xxx…"}
  })
  it('rechnet Kosten aus der Preistabelle', () => {
    const usd = estimateCostUsd({ inputTokens: 1_000_000, outputTokens: 0, model: 'claude-sonnet-5' })
    expect(usd).toBeGreaterThan(0)
  })
  it('formatiert Tokens mit deutschem Komma', () => {
    expect(formatTokens(9234)).toBe('9,2k')
    expect(formatTokens(412)).toBe('412')
    expect(formatTokens(null)).toBe('—')
  })
  it('formatiert die Schaetzung fuer den Button', () => {
    expect(formatEstimate({ x: 'y'.repeat(4000) }, 'claude-sonnet-5')).toMatch(/^≈ 1,0k Tokens · ~0,0\d \$$/)
  })
  it('formatiert echten Verbrauch inkl. Cache', () => {
    const s = formatUsage({ input_tokens: 9234, output_tokens: 811, cache_read_input_tokens: 2100 }, 'claude-sonnet-5')
    expect(s).toContain('9,2k in')
    expect(s).toContain('0,8k out')
    expect(s).toContain('Cache 2,1k')
    expect(s).toMatch(/~\d+,\d\d \$/)
  })
  it('usage null ⇒ leerer String, kein Wurf', () => {
    expect(formatUsage(null, 'claude-sonnet-5')).toBe('')
  })
})
```

- [ ] **Step 2: Rot sehen** — `npx vitest run src/services/aiCost.test.js` → FAIL.

- [ ] **Step 3: Implementieren**

`src/services/aiCost.js`:

```js
// Kostenschaetzung fuer AI-Calls. Grob per Design: die Anzeige sagt "≈" und "~".
// USD je Million Tokens. Stand 2026-07 — bei Modellwechsel gegen
// https://docs.anthropic.com (Pricing) pruefen. EINZIGE Preis-Stelle der App.
export const PRICING = {
  'claude-sonnet-5': { input: 3, output: 15 },
}
const FALLBACK = PRICING['claude-sonnet-5']

export function estimateTokens(payload) {
  try { return Math.round(JSON.stringify(payload).length / 4) } catch { return null }
}

export function estimateCostUsd({ inputTokens = 0, outputTokens = 0, model } = {}) {
  const p = PRICING[model] || FALLBACK
  return (inputTokens * p.input + outputTokens * p.output) / 1e6
}

export function formatTokens(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')}k` : String(v)
}

function formatUsd(usd) {
  return `${usd.toFixed(2).replace('.', ',')} $`
}

export function formatEstimate(payload, model) {
  const tok = estimateTokens(payload)
  if (tok == null) return ''
  const usd = estimateCostUsd({ inputTokens: tok, model })
  return `≈ ${formatTokens(tok)} Tokens · ~${formatUsd(usd)}`
}

export function formatUsage(usage, model) {
  if (!usage) return ''
  const inTok = usage.input_tokens ?? 0
  const outTok = usage.output_tokens ?? 0
  const cache = usage.cache_read_input_tokens ?? 0
  const usd = estimateCostUsd({ inputTokens: inTok, outputTokens: outTok, model })
  const parts = [`${formatTokens(inTok)} in / ${formatTokens(outTok)} out`]
  if (cache > 0) parts.push(`Cache ${formatTokens(cache)}`)
  parts.push(`~${formatUsd(usd)}`)
  return parts.join(' · ')
}
```

Hinweis: der erste Test rechnet mit exakter JSON-Länge — falls die Erwartung um ±1 daneben liegt, die Testerwartung an `JSON.stringify({a:'x'.repeat(396)}).length` anpassen, nicht die Implementierung.

- [ ] **Step 4: Grün + volle Suite.**

- [ ] **Step 5: Commit**

```bash
git add src/services/aiCost.js src/services/aiCost.test.js
git commit -m "feat(ai): aiCost — Token-Schaetzung, Preistabelle, Anzeigeformate"
```

---

### Task 5: Advice-Kontext — `ai.js` bekommt Markt-Spannen, Slot, Runs, Gegner, Byes, Tipps

**Files:**
- Modify: `src/services/ai.js`
- Test: `src/services/ai.test.js` (erweitern)

**Interfaces:**
- Consumes: `detectRuns`, `opponentsUntilMyNext` aus `./draftFlow` (Task 3).
- Produces: `buildAIAdviceRequest(params)` akzeptiert zusätzlich `draftSlot` (number|null) und `tips` (Array `{type, text}`); der Kontext enthält neu: `draft.my_slot`, `draft.my_next_pick_number`, `draft.picks_until_my_next`, `draft.draft_type`, `draft.is_snake` (abgeleitet), `draft_flow`, `opponents_before_my_next`, `my_team.bye_weeks`, `tips_signals`; Kandidaten tragen `high`/`low`/`stdev`.

- [ ] **Step 1: Failing Tests schreiben** (an `src/services/ai.test.js` anhängen; das Extraktions-Muster `<CONTEXT_JSON>`-Regex existiert dort bereits)

```js
const ctxOf = (req) => JSON.parse(req.messages[0].content.match(/<CONTEXT_JSON>\n([\s\S]*)\n<\/CONTEXT_JSON>/)[1])

describe('buildAIAdviceRequest — erweiterter Kontext', () => {
  it('gibt Markt-Spannen mit, aber nur wenn vorhanden', () => {
    const board = [
      { ...mockBoard[0], high: 12, low: 24, stdev: 2.7 },
      { ...mockBoard[1] },
    ]
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, boardPlayers: board, scoringType: 'standard' }))
    const [a, b] = ctx.board.overall_top
    expect([a.high, a.low, a.stdev]).toEqual([12, 24, 2.7])
    expect('high' in b).toBe(false)
  })

  it('draftSlot hat Vorrang vor der Ableitung aus den Picks', () => {
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, draftSlot: 4, scoringType: 'standard' }))
    expect(ctx.draft.my_slot).toBe(4)
  })

  it('kennt meinen naechsten Pick und die Gegner dazwischen', () => {
    const ctx = ctxOf(buildAIAdviceRequest({
      ...baseParams, draftSlot: 4, currentPickNumber: 3, scoringType: 'standard',
      draft: { settings: { teams: 10, rounds: 15 }, type: 'snake' },
    }))
    expect(ctx.draft.my_next_pick_number).toBe(17)
    expect(ctx.draft.picks_until_my_next).toBe(13)   // 17 - upcoming(4)
    expect(ctx.opponents_before_my_next.between).toHaveLength(12)
  })

  it('draft_type kommt aus dem Draft, is_snake wird abgeleitet — nie hardcodiert', () => {
    const ctx = ctxOf(buildAIAdviceRequest({
      ...baseParams, scoringType: 'standard',
      draft: { settings: { teams: 10, rounds: 15 }, type: 'auction' },
    }))
    expect(ctx.draft.draft_type).toBe('auction')
    expect(ctx.draft.is_snake).toBe(false)
    expect(ctx.opponents_before_my_next).toBeUndefined()   // keine Snake-Mathe fuer Auctions
  })

  it('zaehlt die Byes meiner markierten Spieler', () => {
    const board = [
      { ...mockBoard[0], status: 'me', bye: 6 },
      { ...mockBoard[1], status: 'me', bye: 6 },
      { ...mockBoard[2], status: 'me', bye: 11 },
    ]
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, boardPlayers: board, scoringType: 'standard' }))
    expect(ctx.my_team.bye_weeks).toEqual({ 6: 2, 11: 1 })
  })

  it('reicht die Gratis-Tipps gekappt als Signale durch', () => {
    const tips = Array.from({ length: 10 }, (_, i) => ({ type: 'value', text: `Tipp ${i}`, severity: 'info' }))
    const ctx = ctxOf(buildAIAdviceRequest({ ...baseParams, tips, scoringType: 'standard' }))
    expect(ctx.tips_signals).toHaveLength(7)
    expect(ctx.tips_signals[0]).toEqual({ type: 'value', text: 'Tipp 0' })
  })

  it('favBonus wirkt — egal ob in options oder top-level uebergeben', () => {
    const a = ctxOf(buildAIAdviceRequest({ ...baseParams, options: { favBonus: 6 }, scoringType: 'standard' }))
    const b = ctxOf(buildAIAdviceRequest({ ...baseParams, favBonus: 6, scoringType: 'standard' }))
    expect(a.user_bias.weights.fav_bonus).toBe(6)
    expect(b.user_bias.weights.fav_bonus).toBe(6)
  })
})
```

- [ ] **Step 2: Rot sehen** — `npx vitest run src/services/ai.test.js` → die neuen Tests FAILen.

- [ ] **Step 3: Implementieren**

In `src/services/ai.js`:

a) Import ergänzen: `import { detectRuns, opponentsUntilMyNext } from './draftFlow'`

b) `minifyBoardPlayer` — nach der `adp`-Zeile:

```js
  if (p.high != null) base.high = p.high
  if (p.low != null) base.low = p.low
  if (p.stdev != null) base.stdev = p.stdev
```

c) `makeContext`-Signatur erweitern um `draftSlot`, `tips`:

```js
function makeContext({ boardPlayers, livePicks, me, league, draft, currentPickNumber, options, draftMode, dynastyRoster, myDraftPicks, scoringType, draftSlot, tips }) {
```

d) Den `draftContext`-Block ersetzen durch:

```js
  const upcomingPick = Number.isFinite(currentPickNumber) && currentPickNumber != null
    ? currentPickNumber + 1
    : null

  const teamsForMath = league?.total_rosters ?? draft?.settings?.teams ?? draft?.teams ?? null
  const draftType = String(draft?.type || 'snake').toLowerCase()
  const isSnake = draftType === 'snake'
  // draftSlot (aus App.jsx) schlaegt die Pick-Ableitung — die kennt den Slot
  // erst nach dem ersten eigenen Pick.
  const mySlot = draftSlot != null ? Number(draftSlot) : inferMySlot({ draft, livePicks, me })

  const opponents = isSnake
    ? opponentsUntilMyNext({
        picks: livePicks, teamsCount: teamsForMath, mySlot,
        upcomingPick, rosterPositions: league?.roster_positions || [],
      })
    : null

  const draftContext = {
    upcoming_pick_number: upcomingPick,
    completed_picks: Number.isFinite(currentPickNumber) ? currentPickNumber : null,
    my_slot: mySlot,
    my_next_pick_number: opponents?.my_next_pick ?? null,
    picks_until_my_next: opponents && upcomingPick != null ? opponents.my_next_pick - upcomingPick : null,
    draft_type: draftType,
    is_snake: isSnake,
    rounds: draft?.settings?.rounds ?? draft?.rounds ?? null,
    teams: teamsForMath,
  }
```

(Die bisherigen Zeilen `slot: inferMySlot(…)` und `is_snake: true` entfallen damit; der erklärende `Number(null)`-Kommentar über `upcomingPick` bleibt.)

e) Im Rückgabeobjekt von `makeContext` ergänzen:

```js
    draft_flow: detectRuns(livePicks),
    ...(opponents ? { opponents_before_my_next: opponents } : {}),
```

und in `my_team`:

```js
      bye_weeks: (() => {
        const byes = {}
        for (const p of boardPlayers || []) {
          if (p?.status !== 'me' || p?.bye == null) continue
          const b = Number(p.bye)
          if (Number.isFinite(b)) byes[b] = (byes[b] || 0) + 1
        }
        return byes
      })(),
```

und auf oberster Kontext-Ebene:

```js
    ...(Array.isArray(tips) && tips.length
      ? { tips_signals: tips.slice(0, 7).map(t => ({ type: t.type, text: t.text })) }
      : {}),
```

f) `buildAIAdviceRequest`: `draftSlot` und `tips` aus `params` destrukturieren und an `makeContext` durchreichen; `user_bias.weights` fixen:

```js
      fav_bonus: Number.isFinite(options.favBonus) ? options.favBonus
        : Number.isFinite(params?.favBonus) ? params.favBonus : 5,
      avoid_penalty: Number.isFinite(options.avoidPenalty) ? options.avoidPenalty
        : Number.isFinite(params?.avoidPenalty) ? params.avoidPenalty : 8,
```

- [ ] **Step 4: Grün + volle Suite** — bestehende ai.test.js-Tests dürfen sich nicht ändern müssen (das Schema ist noch das alte).

- [ ] **Step 5: Commit**

```bash
git add src/services/ai.js src/services/ai.test.js
git commit -m "feat(ai): Advice-Kontext — Spannen, Slot, Runs, Gegner-Luecken, Byes, Tipp-Signale"
```

---

### Task 6: Advice-Output — neues Tool-Schema und deutsche System-Prompts

**Files:**
- Modify: `src/services/ai.js` (`buildAdviceTool`, `buildSystemPrompt`, `max_tokens`)
- Test: `src/services/ai.test.js` (erweitern)

**Interfaces:**
- Produces: `return_draft_advice`-Schema mit `primary`, `alternatives` (je mit `tradeoff_vs_primary`), `survival` (Verdict-Enum `duerfte_da_sein|muenzwurf|duerfte_weg_sein`), `plan_next_picks`, `run_alert` (optional), `strategy_notes`, `risk_level`, `confidence`. Tasks 7–9 verlassen sich auf exakt diese Feldnamen.

- [ ] **Step 1: Failing Tests schreiben**

```js
describe('buildAIAdviceRequest — Schema & Prompt', () => {
  it('das Tool verlangt Vergleich, Survival und Plan', () => {
    const req = buildAIAdviceRequest({ ...baseParams, scoringType: 'standard' })
    const schema = req.tools[0].input_schema
    expect(schema.required).toEqual(expect.arrayContaining(['primary', 'alternatives', 'survival', 'plan_next_picks']))
    expect(schema.properties.alternatives.items.required).toContain('tradeoff_vs_primary')
    expect(schema.properties.survival.items.properties.verdict.enum)
      .toEqual(['duerfte_da_sein', 'muenzwurf', 'duerfte_weg_sein'])
  })
  it('der Prompt erzwingt Deutsch und verbietet erfundene Survival-Gruende', () => {
    const req = buildAIAdviceRequest({ ...baseParams, scoringType: 'standard' })
    expect(req.system).toMatch(/Deutsch/)
    expect(req.system).toMatch(/du-Form/)
    expect(req.system).toMatch(/high.*low|low.*high/)
    expect(req.max_tokens).toBe(2000)
  })
  it('auch der Rookie-Prompt ist deutsch und behaelt die Rookie-Regeln', () => {
    const req = buildAIAdviceRequest({ ...baseParams, draftMode: 'rookie' })
    expect(req.system).toMatch(/Deutsch/)
    expect(req.system).toMatch(/[Tt]axi/)
  })
})
```

- [ ] **Step 2: Rot sehen.**

- [ ] **Step 3: `buildAdviceTool` komplett ersetzen**

```js
function buildAdviceTool() {
  const playerCore = {
    player_nname: { type: 'string', description: 'Normalisierter Name, exakt wie board.nname' },
    player_display: { type: 'string' },
    pos: { type: 'string', enum: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'OTHER'] },
    rk: { type: 'integer' },
  }
  return {
    name: 'return_draft_advice',
    description: 'Naechster-Pick-Empfehlung mit Vergleich, Survival-Einschaetzung und Plan fuer die kommenden eigenen Picks.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        primary: {
          type: 'object', additionalProperties: false,
          properties: {
            ...playerCore,
            fit_score: { type: 'number', minimum: 0, maximum: 100 },
            why: { type: 'string', description: 'Begruendung auf Deutsch (du-Form): Fit, Knappheit, Risiko' },
          },
          required: ['player_nname', 'pos', 'why'],
        },
        alternatives: {
          type: 'array', minItems: 2, maxItems: 4,
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              ...playerCore,
              why: { type: 'string', description: 'Deutsch (du-Form)' },
              tradeoff_vs_primary: { type: 'string', description: 'Was gebe ich auf, wenn ich stattdessen primary nehme? Deutsch (du-Form)' },
            },
            required: ['player_nname', 'pos', 'why', 'tradeoff_vs_primary'],
          },
        },
        survival: {
          type: 'array',
          description: 'Je ein Eintrag fuer primary und jede Alternative: ueberlebt der Spieler bis my_next_pick_number?',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              player_nname: { type: 'string' },
              verdict: { type: 'string', enum: ['duerfte_da_sein', 'muenzwurf', 'duerfte_weg_sein'] },
              reason: { type: 'string', description: 'Nur aus high/low/adp und den Gegner-Luecken begruenden. Deutsch (du-Form)' },
            },
            required: ['player_nname', 'verdict', 'reason'],
          },
        },
        plan_next_picks: {
          type: 'array', maxItems: 3,
          description: 'Plan fuer die naechsten eigenen Picks (Pick-Nummern aus dem Kontext).',
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              pick_number: { type: 'integer' },
              target_positions: { type: 'array', items: { type: 'string' } },
              candidate_nnames: { type: 'array', items: { type: 'string' } },
              note: { type: 'string', description: 'Deutsch (du-Form)' },
            },
            required: ['pick_number', 'target_positions', 'note'],
          },
        },
        run_alert: {
          type: 'object', additionalProperties: false,
          description: 'Nur setzen, wenn draft_flow.run gesetzt ist.',
          properties: {
            pos: { type: 'string' },
            note: { type: 'string', description: 'Deutsch (du-Form)' },
          },
          required: ['pos', 'note'],
        },
        strategy_notes: { type: 'string', description: '1-3 kurze Punkte, Deutsch (du-Form)' },
        risk_level: { type: 'string', enum: ['low', 'medium', 'high'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
      },
      required: ['primary', 'alternatives', 'survival', 'plan_next_picks'],
    },
  }
}
```

- [ ] **Step 4: `buildSystemPrompt` komplett ersetzen**

```js
function buildSystemPrompt(draftMode) {
  const shared = [
    'Harte Regeln:',
    '- Alle Freitext-Felder (why, tradeoff_vs_primary, reason, note, strategy_notes) auf Deutsch, du-Form.',
    '- Empfiehl niemals Spieler aus constraints.avoid_nnames (bereits gepickt).',
    '- Nur Spieler aus board.overall_top oder board.by_position nennen — auch in plan_next_picks.',
    '- survival: Begruendung ausschliesslich aus high/low/adp des Spielers und opponents_before_my_next. Keine erfundenen Faktoren.',
    '- plan_next_picks: nutze draft.my_next_pick_number und die folgenden eigenen Picks; beruecksichtige opponents_before_my_next (wer schnappt was weg?) und my_team.bye_weeks.',
    '- Wenn draft_flow.run gesetzt ist, erklaere in run_alert, was der Run fuer diesen Pick bedeutet — sonst run_alert weglassen.',
    '- tips_signals sind Heuristik-Hinweise der App: bestaetige oder widersprich ihnen explizit, statt sie zu ignorieren.',
    '- Respektiere context.user_bias (Favoriten bevorzugen, Avoids nur bei extremem Value).',
    '- Wenn context.custom_strategy existiert, folge ihr, solange sie den harten Regeln nicht widerspricht.',
    'Antworte durch Aufruf des Tools `return_draft_advice`.',
  ]

  if (draftMode === 'rookie') {
    return [
      'Du bist ein erfahrener Dynasty-Fantasy-Football-Berater, spezialisiert auf Rookie-Drafts bei Sleeper.',
      'Aufgabe: Empfiehl den naechsten Rookie-Pick unter Beruecksichtigung des bestehenden Dynasty-Kaders.',
      ...shared,
      'Rookie-Spezifika:',
      '- Alle verfuegbaren Spieler sind NFL-Rookies. Langfristiger Dynasty-Wert schlaegt Sofort-Impact.',
      '- Bewertungsfaktoren: Landing Spot (Depth Chart), College-Produktion, Alter/Athletik, Positionswert (WR > RB langfristig).',
      '- Picks landen oft auf dem Taxi Squad — Sofort-Starter-Wert ist NICHT noetig.',
      '- my_team.existing_dynasty_roster_counts zeigt den Bestand: fuelle Positions-Schwaechen.',
      '- draft.my_picks zeigt, in welchen Runden du Picks hast — passe die Dringlichkeit an.',
      '- Bye-Weeks sind irrelevant, erwaehne sie nicht. Kein Handcuff-Denken.',
      '- Der Pool ist klein (20-60 Spieler): sei praezise bei Tier-Abbruechen.',
    ].join('\n')
  }

  return [
    'Du bist ein erfahrener Fantasy-Football-Draft-Berater, spezialisiert auf Sleeper-Drafts.',
    'Aufgabe: Empfiehl den naechsten Pick fuer den Nutzer — mit echtem Vergleich der Alternativen, nicht nur einer Nennung.',
    ...shared,
    '- Respektiere Scoring und Kaderanforderungen aus context.league und context.format.',
    '- Positionsknappheit, Kader-Balance und Tier-Druck zaehlen; Byes nur als Tie-Breaker.',
    '- In 1-QB-Ligen QB vor Runde 7 abwerten (ausser Elite-Value); in Superflex QBs priorisieren.',
    '- context.strategies sind weiche Tie-Breaker (Zero RB, Hero RB, Elite TE).',
    '- Handcuffs aus handcuff_opportunities ab Runde 8 erwaegen, wenn die Kadertiefe es erlaubt.',
  ].join('\n')
}
```

- [ ] **Step 5: `max_tokens` in `buildAIAdviceRequest` von 1024 auf 2000.**

- [ ] **Step 6: Grün + volle Suite.** Falls Alt-Tests auf das alte Schema prüfen (z. B. `strategy_notes` in `required`), die Alt-Tests an das neue Schema anpassen — die Spec ist die Referenz.

- [ ] **Step 7: Commit**

```bash
git add src/services/ai.js src/services/ai.test.js
git commit -m "feat(ai): Advice-Schema — Vergleich, Survival-Verdicts, Pick-Plan, deutsche Prompts"
```

---

### Task 7: `aiValidate.js` — AI-Output gegen Board und Roster prüfen

**Files:**
- Create: `src/services/aiValidate.js`
- Create: `src/services/aiValidate.test.js`

**Interfaces:**
- Consumes: `normalizePlayerName` aus `../utils/formatting`; `stripSuffix` aus `./tradeValue` (beide existieren).
- Produces:
  - `validateAdvice(parsed, availableNnames: Set<string>)` → `{ cleaned: object|null, warnings: string[] }`
  - `validateTradeSuggestions(parsed, { myAssets, opponentAssetsByName })` → `{ cleaned, warnings }` — `myAssets`/je Gegner: `{ players: [{name, nname, dynasty_value}], picks: [{label, dynasty_value}] }`; `opponentAssetsByName` ist eine `Map<lowercased displayName, assets>`. Werte in `cleaned.suggestions[].value_you_give/get` sind **neu summiert**, Modell-Zahlen verworfen.

- [ ] **Step 1: Failing Tests schreiben**

`src/services/aiValidate.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { validateAdvice, validateTradeSuggestions } from './aiValidate'

const avail = new Set(['bijan robinson', 'puka nacua', 'jamarr chase'])
const P = (nname, extra = {}) => ({ player_nname: nname, player_display: nname, pos: 'RB', why: 'x', ...extra })

describe('validateAdvice', () => {
  it('laesst valide Antworten unveraendert durch', () => {
    const parsed = {
      primary: P('bijan robinson'),
      alternatives: [P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [{ player_nname: 'bijan robinson', verdict: 'muenzwurf', reason: 'r' }],
      plan_next_picks: [{ pick_number: 17, target_positions: ['WR'], candidate_nnames: ['jamarr chase'], note: 'n' }],
    }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned).toEqual(parsed)
    expect(warnings).toEqual([])
  })

  it('sortiert nicht verfuegbare Alternativen aus — mit Warnung', () => {
    const parsed = {
      primary: P('bijan robinson'),
      alternatives: [P('geist spieler', { tradeoff_vs_primary: 'y' }), P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [], plan_next_picks: [],
    }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned.alternatives).toHaveLength(1)
    expect(warnings[0]).toContain('geist spieler')
  })

  it('rueckt bei invalider Empfehlung die erste valide Alternative nach', () => {
    const parsed = {
      primary: P('geist spieler'),
      alternatives: [P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [], plan_next_picks: [],
    }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned.primary.player_nname).toBe('puka nacua')
    expect(cleaned.alternatives).toHaveLength(0)
    expect(warnings.some(w => w.includes('nachgerückt'))).toBe(true)
  })

  it('alles invalide ⇒ cleaned null, Warnungen bleiben', () => {
    const parsed = { primary: P('geist'), alternatives: [P('phantom', { tradeoff_vs_primary: 'y' })], survival: [], plan_next_picks: [] }
    const { cleaned, warnings } = validateAdvice(parsed, avail)
    expect(cleaned).toBe(null)
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('filtert Survival-Eintraege und Plan-Kandidaten auf bekannte Namen', () => {
    const parsed = {
      primary: P('bijan robinson'),
      alternatives: [P('puka nacua', { tradeoff_vs_primary: 'y' })],
      survival: [
        { player_nname: 'bijan robinson', verdict: 'muenzwurf', reason: 'r' },
        { player_nname: 'geist', verdict: 'muenzwurf', reason: 'r' },
      ],
      plan_next_picks: [{ pick_number: 17, target_positions: ['WR'], candidate_nnames: ['geist', 'jamarr chase'], note: 'n' }],
    }
    const { cleaned } = validateAdvice(parsed, avail)
    expect(cleaned.survival).toHaveLength(1)
    expect(cleaned.plan_next_picks[0].candidate_nnames).toEqual(['jamarr chase'])
  })
})

describe('validateTradeSuggestions', () => {
  const my = {
    players: [{ name: 'Bijan Robinson', nname: 'bijan robinson', dynasty_value: 9000 }],
    picks: [{ label: '2027 1st (mid)', dynasty_value: 3000 }],
  }
  const opp = new Map([['team rakete', {
    players: [{ name: 'Puka Nacua', nname: 'puka nacua', dynasty_value: 8000 }],
    picks: [],
  }]])

  it('rechnet die Werte aus unseren Daten neu — Modell-Zahlen werden verworfen', () => {
    const parsed = { team_summary: 's', suggestions: [{
      opponent: 'Team Rakete', you_give: ['Bijan Robinson'], you_get: ['Puka Nacua'],
      value_you_give: 1, value_you_get: 999999, rationale: 'r',
    }]}
    const { cleaned, warnings } = validateTradeSuggestions(parsed, { myAssets: my, opponentAssetsByName: opp })
    expect(cleaned.suggestions[0].value_you_give).toBe(9000)
    expect(cleaned.suggestions[0].value_you_get).toBe(8000)
    expect(warnings).toEqual([])
  })

  it('sortiert Vorschlaege mit unbekannten Namen aus', () => {
    const parsed = { team_summary: 's', suggestions: [{
      opponent: 'Team Rakete', you_give: ['Erfundener Mann'], you_get: ['Puka Nacua'], rationale: 'r',
    }]}
    const { cleaned, warnings } = validateTradeSuggestions(parsed, { myAssets: my, opponentAssetsByName: opp })
    expect(cleaned.suggestions).toHaveLength(0)
    expect(warnings[0]).toContain('Erfundener Mann')
  })

  it('matcht Picks ueber das Label und unbekannte Gegner fallen durch', () => {
    const parsed = { team_summary: 's', suggestions: [
      { opponent: 'Team Rakete', you_give: ['2027 1st (mid)'], you_get: ['Puka Nacua'], rationale: 'r' },
      { opponent: 'Unbekanntes Team', you_give: ['Bijan Robinson'], you_get: ['Puka Nacua'], rationale: 'r' },
    ]}
    const { cleaned, warnings } = validateTradeSuggestions(parsed, { myAssets: my, opponentAssetsByName: opp })
    expect(cleaned.suggestions).toHaveLength(1)
    expect(cleaned.suggestions[0].value_you_give).toBe(3000)
    expect(warnings.some(w => w.includes('Unbekanntes Team'))).toBe(true)
  })
})
```

- [ ] **Step 2: Rot sehen.**

- [ ] **Step 3: Implementieren**

`src/services/aiValidate.js`:

```js
// Kein AI-Output erreicht ungeprueft die UI. Ein einziger halluzinierter Name,
// der gerendert wird, zerstoert das Vertrauen in das ganze Feature — deshalb
// wird aussortiert UND sichtbar gewarnt, nie still repariert.
import { normalizePlayerName } from '../utils/formatting'
import { stripSuffix } from './tradeValue'

const norm = (s) => normalizePlayerName(String(s || ''))

export function validateAdvice(parsed, availableNnames) {
  const warnings = []
  if (!parsed || !parsed.primary) return { cleaned: null, warnings: ['Die AI-Antwort enthielt keine Empfehlung.'] }
  const ok = (n) => availableNnames.has(norm(n))
  const label = (p) => p?.player_display || p?.player_nname || '?'

  const alternatives = (parsed.alternatives || []).filter(a => {
    if (ok(a.player_nname)) return true
    warnings.push(`AI nannte „${label(a)}" — nicht (mehr) verfügbar, aussortiert.`)
    return false
  })

  let primary = parsed.primary
  if (!ok(primary.player_nname)) {
    const promoted = alternatives.shift() || null
    warnings.push(promoted
      ? `Empfehlung „${label(primary)}" war nicht verfügbar — „${label(promoted)}" nachgerückt.`
      : `Empfehlung „${label(primary)}" war nicht verfügbar.`)
    primary = promoted
  }
  if (!primary) {
    return { cleaned: null, warnings: [...warnings, 'Keine der genannten Optionen ist auf dem Board verfügbar.'] }
  }

  const known = new Set([primary.player_nname, ...alternatives.map(a => a.player_nname)].map(norm))
  const survival = (parsed.survival || []).filter(s => known.has(norm(s.player_nname)))

  const plan_next_picks = (parsed.plan_next_picks || []).map(p => ({
    ...p,
    candidate_nnames: (p.candidate_nnames || []).filter(n => {
      if (ok(n)) return true
      warnings.push(`AI nannte „${n}" im Plan — nicht (mehr) verfügbar, aussortiert.`)
      return false
    }),
  }))

  return { cleaned: { ...parsed, primary, alternatives, survival, plan_next_picks }, warnings }
}

function matchAsset(assetStr, assets) {
  const s = String(assetStr || '').trim()
  if (!s) return null
  for (const pk of assets?.picks || []) {
    if (pk.label && pk.label.toLowerCase() === s.toLowerCase()) return { value: pk.dynasty_value || 0 }
  }
  // Fuehrendes Positions-Kuerzel ("RB Bijan Robinson") tolerieren
  const bare = s.replace(/^(QB|RB|WR|TE|K|DEF)\s+/i, '')
  const n = norm(bare)
  for (const pl of assets?.players || []) {
    const pn = pl.nname || norm(pl.name)
    if (pn === n || stripSuffix(pn) === stripSuffix(n)) return { value: pl.dynasty_value || 0 }
  }
  return null
}

export function validateTradeSuggestions(parsed, { myAssets, opponentAssetsByName }) {
  const warnings = []
  if (!parsed) return { cleaned: null, warnings: ['Die AI-Antwort war leer.'] }

  const suggestions = []
  for (const s of parsed.suggestions || []) {
    const opp = opponentAssetsByName.get(String(s.opponent || '').toLowerCase())
    if (!opp) {
      warnings.push(`Vorschlag gegen „${s.opponent}" aussortiert — Team unbekannt.`)
      continue
    }
    let give = 0, get = 0, valid = true
    for (const item of s.you_give || []) {
      const m = matchAsset(item, myAssets)
      if (!m) { warnings.push(`Vorschlag aussortiert — „${item}" ist nicht auf deinem Roster.`); valid = false; break }
      give += m.value
    }
    if (valid) for (const item of s.you_get || []) {
      const m = matchAsset(item, opp)
      if (!m) { warnings.push(`Vorschlag aussortiert — „${item}" ist nicht auf dem Roster von ${s.opponent}.`); valid = false; break }
      get += m.value
    }
    if (!valid) continue
    // Modell-Zahlen bewusst verwerfen: die Badges rechnen nur mit unseren Werten.
    suggestions.push({ ...s, value_you_give: give, value_you_get: get })
  }
  return { cleaned: { ...parsed, suggestions }, warnings }
}
```

- [ ] **Step 4: Grün + volle Suite.**

- [ ] **Step 5: Commit**

```bash
git add src/services/aiValidate.js src/services/aiValidate.test.js
git commit -m "feat(ai): aiValidate — Empfehlungen und Trade-Vorschlaege gegen echte Daten geprueft"
```

---

### Task 8: AdviceDialog — Vergleich, Survival, Plan, Warnungen, Usage

**Files:**
- Modify: `src/components/AdviceDialog.jsx`
- Create: `src/components/AdviceDialog.test.jsx`

**Interfaces:**
- Consumes: das Schema aus Task 6 (Feldnamen exakt) und `formatUsage` aus `../services/aiCost`.
- Produces: `AdviceDialog` akzeptiert neue Props `warnings` (string[]), `usage` (Anthropic-usage|null), `model` (string), `myNextPick` (number|null). Task 9 übergibt sie.

- [ ] **Step 1: Bestand lesen** — `src/components/AdviceDialog.jsx` (176 Zeilen) und die Verwendung in `BoardSection.jsx` vollständig lesen. Der Dialog-Rahmen (open/close, Titel „AI Draft Advice", Debug-Toggle) bleibt; der Ergebnis-Body wird ersetzt.

- [ ] **Step 2: Failing Komponententest schreiben**

`src/components/AdviceDialog.test.jsx` (Mock-Muster wie `MockDraftCard.test.jsx`):

```jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdviceDialog from './AdviceDialog'

const advice = {
  primary: { player_nname: 'bijan robinson', player_display: 'Bijan Robinson', pos: 'RB', rk: 2, why: 'Bester RB-Value.', fit_score: 91 },
  alternatives: [
    { player_nname: 'puka nacua', player_display: 'Puka Nacua', pos: 'WR', rk: 4, why: 'WR1-Profil.', tradeoff_vs_primary: 'Nimmst du Bijan, ist Puka bei Pick 17 wahrscheinlich weg.' },
  ],
  survival: [
    { player_nname: 'puka nacua', verdict: 'duerfte_weg_sein', reason: 'Wird typisch zwischen 4 und 9 gezogen.' },
  ],
  plan_next_picks: [
    { pick_number: 17, target_positions: ['WR', 'TE'], candidate_nnames: ['jamarr chase'], note: 'WR-Tier kippt vor Runde 3.' },
  ],
  run_alert: { pos: 'RB', note: '5 der letzten 12 Picks waren RBs.' },
  strategy_notes: 'RB-Anker zuerst.',
}

describe('AdviceDialog', () => {
  it('rendert Empfehlung, Trade-off, Survival-Verdict, Plan und Run-Hinweis', () => {
    render(<AdviceDialog open advice={advice} onClose={() => {}} myNextPick={17} />)
    expect(screen.getByText('Bijan Robinson')).toBeTruthy()
    expect(screen.getByText(/ist Puka bei Pick 17 wahrscheinlich weg/)).toBeTruthy()
    expect(screen.getByText(/dürfte weg sein/)).toBeTruthy()
    expect(screen.getByText(/WR-Tier kippt/)).toBeTruthy()
    expect(screen.getByText(/5 der letzten 12 Picks/)).toBeTruthy()
  })

  it('zeigt Validierungs-Warnungen sichtbar an', () => {
    render(<AdviceDialog open advice={advice} warnings={['AI nannte „Geist" — nicht (mehr) verfügbar, aussortiert.']} onClose={() => {}} />)
    expect(screen.getByText(/Geist/)).toBeTruthy()
  })

  it('zeigt den echten Verbrauch im Footer', () => {
    render(<AdviceDialog open advice={advice} usage={{ input_tokens: 9234, output_tokens: 811 }} model="claude-sonnet-5" onClose={() => {}} />)
    expect(screen.getByText(/9,2k in/)).toBeTruthy()
  })

  it('advice null + Warnungen: Warnungen statt leerer Empfehlung', () => {
    render(<AdviceDialog open advice={null} warnings={['Keine der genannten Optionen ist auf dem Board verfügbar.']} onClose={() => {}} />)
    expect(screen.getByText(/Keine der genannten Optionen/)).toBeTruthy()
  })
})
```

- [ ] **Step 3: Rot sehen** — `npx vitest run src/components/AdviceDialog.test.jsx`.

- [ ] **Step 4: Ergebnis-Body ersetzen**

Verdict-Anzeige und Sektionen (in den bestehenden Dialog-Rahmen einsetzen; bestehende CSS-Klassen des Dialogs weiterverwenden, neue Klassen mit Rollen-Tokens in `style.css` ergänzen — keine Roh-Hexwerte, siehe Design-System):

```jsx
import { formatUsage } from '../services/aiCost'

const SURVIVAL_LABEL = {
  duerfte_da_sein: 'dürfte da sein',
  muenzwurf: 'ein Münzwurf',
  duerfte_weg_sein: 'dürfte weg sein',
}

function AdviceBody({ advice, warnings = [], usage = null, model = '', myNextPick = null }) {
  if (!advice) {
    return warnings.length
      ? <div className="advice-warnings">{warnings.map((w, i) => <p key={i}>{w}</p>)}</div>
      : null
  }
  const survivalFor = (nname) => (advice.survival || []).find(s => s.player_nname === nname)
  return (
    <>
      {warnings.length > 0 && (
        <div className="advice-warnings">
          {warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      <section className="advice-section">
        <h3>Empfehlung</h3>
        <p><strong>{advice.primary.player_display || advice.primary.player_nname}</strong>
          {' '}· {advice.primary.pos}{advice.primary.rk != null ? ` · RK ${advice.primary.rk}` : ''}</p>
        <p>{advice.primary.why}</p>
      </section>

      {advice.alternatives?.length > 0 && (
        <section className="advice-section">
          <h3>Vergleich</h3>
          <ul>
            {advice.alternatives.map(a => (
              <li key={a.player_nname}>
                <strong>{a.player_display || a.player_nname}</strong> · {a.pos}
                {a.rk != null ? ` · RK ${a.rk}` : ''} — {a.why}
                <div className="advice-tradeoff">{a.tradeoff_vs_primary}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {advice.survival?.length > 0 && (
        <section className="advice-section">
          <h3>{myNextPick ? `Überlebt bis Pick ${myNextPick}?` : 'Überlebt bis zu deinem nächsten Pick?'}</h3>
          <ul>
            {advice.survival.map(s => (
              <li key={s.player_nname}>
                <strong>{s.player_nname}</strong>: {SURVIVAL_LABEL[s.verdict] || s.verdict} — {s.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {advice.plan_next_picks?.length > 0 && (
        <section className="advice-section">
          <h3>Plan für deine nächsten Picks</h3>
          <ul>
            {advice.plan_next_picks.map(p => (
              <li key={p.pick_number}>
                <strong>Pick {p.pick_number}</strong> · {(p.target_positions || []).join('/')} — {p.note}
              </li>
            ))}
          </ul>
        </section>
      )}

      {advice.run_alert && (
        <section className="advice-section advice-run">
          <h3>Run-Hinweis: {advice.run_alert.pos}</h3>
          <p>{advice.run_alert.note}</p>
        </section>
      )}

      {advice.strategy_notes && (
        <section className="advice-section">
          <h3>Strategie-Notizen</h3>
          <p>{advice.strategy_notes}</p>
        </section>
      )}

      {usage && <div className="advice-usage muted">Verbraucht: {formatUsage(usage, model)}</div>}
    </>
  )
}
```

Props der Hauptkomponente erweitern (`warnings`, `usage`, `model`, `myNextPick`) und `AdviceBody` an der Stelle des alten Ergebnis-Renderings einsetzen. Der alte `streamingText`-Prop (falls vorhanden) entfällt; der Ladezustand wird ein statischer Text „Analysiere Board, Liga und Roster …" (existiert schon).

- [ ] **Step 5: Grün + volle Suite + Build.**

- [ ] **Step 6: Commit**

```bash
git add src/components/AdviceDialog.jsx src/components/AdviceDialog.test.jsx src/styles/style.css
git commit -m "feat(board): AdviceDialog — Vergleich, Survival, Plan, Warnungen, Verbrauch"
```

---

### Task 9: Verdrahtung — App.jsx, BoardPage, BoardSection (Slot, Tipps, Gate, Kosten, Validierung)

**Files:**
- Modify: `src/App.jsx` (pageProps), `src/pages/BoardPage.jsx`, `src/components/BoardSection.jsx`

**Interfaces:**
- Consumes: `validateAdvice` (Task 7), `formatEstimate` (Task 4), Dialog-Props (Task 8), `buildAIAdviceRequest`-Params `draftSlot`/`tips` (Task 5).
- Produces: nichts Neues für spätere Tasks.

- [ ] **Step 1: Bestand prüfen**

`App.jsx:191` definiert `draftSlot` (useMemo); die Tipps liegen in App.jsx als Ergebnis von `useDraftTips`/`useRookieDraftTips` (um Zeile 220). Prüfen, unter welchem Namen die priorisierten Tipps in `pageProps` wandern könnten und wie `BoardPage` → `BoardSection` durchreicht (`BoardPage.jsx:155-175`).

- [ ] **Step 2: `draftSlot` und `tips` in `pageProps` aufnehmen**

In App.jsx dem `pageProps`-Objekt `draftSlot` und `tips` (die fertige Tipp-Liste) hinzufügen. In `BoardPage.jsx` beide an `<BoardSection …>` weitergeben (`draftSlot={draftSlot}` `tips={tips}`).

- [ ] **Step 3: `BoardSection` umbauen**

a) Props `draftSlot`, `tips` entgegennehmen.

b) Im `buildAIAdviceRequest`-Aufruf ergänzen bzw. ändern:

```js
        draftSlot,
        tips,
        options: { topNOverall: 60, topPerPos: 20, temperature: 0.2, favBonus: 6, avoidPenalty: 10 },
```

(die alten Top-Level-`favBonus`/`avoidPenalty`-Zeilen entfallen).

c) **SSE-`text`-Handling entfernen:** im Stream-Loop den `eventType === 'text'`-Zweig und den `streamingText`-State samt Übergabe an den Dialog streichen. Der `result`/`error`-Pfad bleibt unverändert.

d) **Validierung vor dem Rendern:**

```js
import { validateAdvice } from '../services/aiValidate'
// im result-Zweig, statt setAdvice(data.parsed):
const availableNnames = new Set(
  (boardPlayers || [])
    .filter(p => !p.status)
    .map(p => String(p.nname || '').trim().toLowerCase())
)
const { cleaned, warnings } = validateAdvice(data.parsed, availableNnames)
setAdvice(cleaned)
setAdviceWarnings(warnings)
setAdviceUsage(data.usage || null)
setAdviceModel(data.model || '')
```

(drei neue useState: `adviceWarnings` `[]`, `adviceUsage` `null`, `adviceModel` `''` — beim Start eines neuen Calls zurücksetzen.)

e) **Kostenschätzung am Button** (Payload nur bei sichtbarem Button memoisieren):

```js
import { formatEstimate } from '../services/aiCost'
const adviceEstimate = useMemo(() => {
  if (!hasBoard) return ''
  try {
    return formatEstimate(buildAIAdviceRequest({
      boardPlayers, livePicks, me: meUserId || '', league: league || {},
      draft: draft || null, currentPickNumber, draftSlot, tips,
      scoringType: draftFormat.scoringType, isSuperflex: draftFormat.isSuperflex,
      rosterPositions, draftMode, dynastyRoster, myDraftPicks, options: {},
    }), 'claude-sonnet-5')
  } catch { return '' }
}, [boardPlayers, livePicks, currentPickNumber, draftMode])
```

Anzeige als `muted`-Span neben dem AI-Advice-Button: `{adviceEstimate && <span className="muted text-xs">{adviceEstimate}</span>}`.

f) **Button-Gate gegen den leeren Reload-Zustand:** Der AI-Advice-Button wird `disabled`, wenn `draft?.status === 'drafting' && !(livePicks?.length)` — mit `title="Picks werden geladen — gleich verfügbar"`. (Vor Draft-Start, `status: 'pre_draft'`, bleibt er aktiv: „Wen picke ich zuerst?" ist legitim.)

g) Dialog-Aufruf erweitern: `warnings={adviceWarnings}` `usage={adviceUsage}` `model={adviceModel}` `myNextPick={advice?.plan_next_picks?.[0]?.pick_number ?? null}` — falls der Dialog das Feld `myNextPick` besser direkt aus dem Kontext bekommen soll: `draftSlot`-basiert ist er im `advice` nicht enthalten; einfachste korrekte Quelle ist `opponentsUntilMyNext` — dazu in BoardSection: `import { opponentsUntilMyNext } from '../services/draftFlow'` und `const myNextPick = useMemo(() => opponentsUntilMyNext({ picks: livePicks, teamsCount, mySlot: draftSlot, upcomingPick: (currentPickNumber ?? 0) + 1, rosterPositions })?.my_next_pick ?? null, [livePicks, teamsCount, draftSlot, currentPickNumber])`.

- [ ] **Step 4: Manuell prüfen (kostenlos)** — `npm run dev:all` NICHT nötig; `npx vitest run` + `npx vite build` grün. Im Browser-Preview (Vite aus dem Worktree!): Board öffnen, AI-Advice-Button zeigt Schätzung; Fetch-Interception (Task 13, Schritt „Interception") kann vorgezogen werden, um den Payload einmal gratis zu sichten: `draft_flow`, `opponents_before_my_next`, `tips_signals` vorhanden.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/pages/BoardPage.jsx src/components/BoardSection.jsx
git commit -m "feat(board): Advice verdrahtet — Slot, Tipp-Signale, Kostenschaetzung, Gate, Validierung"
```

---

### Task 10: Draft-Review — Schema (Learnings statt Week-1) und Payload (Format, Diät, Deutsch)

**Files:**
- Modify: `src/server/apiRoutes.js` (`REVIEW_TOOL`)
- Modify: `src/services/aiDraftReviewClient.js`
- Test: `src/server/apiRoutes.test.js`, Create: `src/services/aiDraftReviewClient.test.js`

**Interfaces:**
- Produces: `REVIEW_TOOL` ohne `myWeek1StartSit`, mit `lessonsForNextMock` (required). `buildDraftReviewPayload(context, { temperature, format })` — `format` ist `{scoringType, teams, isSuperflex}`; `buildDraftReviewContext` nimmt zusätzlich `draftMode` und liefert `draft_mode` im Kontext. Task 11 verlässt sich auf `lessonsForNextMock: [{lesson, evidence}]`.

- [ ] **Step 1: Failing Tests schreiben**

An `apiRoutes.test.js`:

```js
describe('REVIEW_TOOL — Learnings statt Week-1', () => {
  it('verlangt lessonsForNextMock und kennt kein myWeek1StartSit mehr', () => {
    const props = REVIEW_TOOL.input_schema.properties
    expect(props.myWeek1StartSit).toBeUndefined()
    expect(props.lessonsForNextMock.items.required).toEqual(['lesson', 'evidence'])
    expect(REVIEW_TOOL.input_schema.required).toContain('lessonsForNextMock')
    expect(REVIEW_TOOL.input_schema.required).not.toContain('myWeek1StartSit')
  })
})
```

Neu `src/services/aiDraftReviewClient.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildDraftReviewContext, buildDraftReviewPayload } from './aiDraftReviewClient'

const baseCtxArgs = {
  league: { league_id: 'l1', name: 'Test', total_rosters: 10, roster_positions: ['QB','RB'], scoring_settings: { rec: 0 }, draft_order: { u1: 1 } },
  picks: [{ pick_no: 1, round: 1, picked_by: 'u1', metadata: { first_name: 'Bijan', last_name: 'Robinson', position: 'RB', team: 'ATL' } }],
  teamByRosterId: { 1: { owner_id: 'u1', players: [] } },
  ownerLabels: new Map([['u1', 'zmash']]),
  myOwnerId: 'u1', myRosterId: '1',
  board: { metadata: {}, players: Array.from({ length: 400 }, (_, i) => ({ id: i, name: `P${i}`, pos: 'WR', team: 'X', bye: 7, tier: 1, rk: i + 1 })) },
}

describe('buildDraftReviewContext — Diaet', () => {
  it('kappt das Board auf 300 und minifiziert die Felder', () => {
    const ctx = buildDraftReviewContext({ ...baseCtxArgs, draftMode: 'redraft' })
    expect(ctx.board.players).toHaveLength(300)
    expect(Object.keys(ctx.board.players[0]).sort()).toEqual(['name', 'pos', 'rk', 'team', 'tier'])
  })
  it('laesst draft_order weg und traegt draft_mode', () => {
    const ctx = buildDraftReviewContext({ ...baseCtxArgs, draftMode: 'rookie' })
    expect(ctx.league.draft_order).toBeUndefined()
    expect(ctx.draft_mode).toBe('rookie')
  })
})

describe('buildDraftReviewPayload — Format statt Raten', () => {
  it('kein Half-PPR-Hardcode mehr; Formatzeile aus dem Parameter', () => {
    const p = buildDraftReviewPayload({ draft_mode: 'redraft' }, { format: { scoringType: 'standard', teams: 10, isSuperflex: false } })
    expect(p.system).not.toMatch(/Half-PPR unless/)
    expect(p.system).toMatch(/standard/i)
    expect(p.system).toMatch(/10 Teams/)
    expect(p.system).toMatch(/Deutsch/)
  })
  it('verlangt lessonsForNextMock im User-Prompt', () => {
    const p = buildDraftReviewPayload({ draft_mode: 'redraft' }, { format: { scoringType: 'ppr', teams: 12, isSuperflex: true } })
    expect(p.messages[0].content).toMatch(/lessonsForNextMock/)
    expect(p.messages[0].content).not.toMatch(/myWeek1StartSit/)
  })
})
```

- [ ] **Step 2: Rot sehen.**

- [ ] **Step 3: `REVIEW_TOOL` ändern** (in `apiRoutes.js`)

`myWeek1StartSit`-Property und den Eintrag im `required`-Array entfernen; stattdessen:

```js
      lessonsForNextMock: {
        type: 'array', minItems: 2, maxItems: 4,
        description: 'Konkrete, belegbare Learnings fuer den naechsten Mock-Draft des Nutzers.',
        items: {
          type: 'object',
          properties: {
            lesson:   { type: 'string', description: 'Das Learning, Deutsch (du-Form), handlungsleitend formuliert' },
            evidence: { type: 'string', description: 'Beleg mit konkreten Picks/Raengen aus dem Kontext (z. B. "Picks 28 und 52 je >6 Plaetze ueber ADP")' },
          },
          required: ['lesson', 'evidence'],
        },
      },
```

`required`: `'myWeek1StartSit'` → `'lessonsForNextMock'`. Auch die `description` des Tools anpassen (kein „week-1 start/sit" mehr).

- [ ] **Step 4: Client umbauen** (`aiDraftReviewClient.js`)

a) `buildDraftReviewContext`: Signatur um `draftMode` erweitern. `safeLeague` ohne `draft_order`. Board-Block ersetzen:

```js
    board: board ? {
      meta: board.metadata || {},
      players: (board.players || []).slice(0, 300).map(p => ({
        name: p.name, pos: p.pos, team: p.team, rk: p.rk ?? null, tier: p.tier ?? null,
      })),
    } : null,
    draft_mode: draftMode || 'redraft',
```

b) `buildDraftReviewPayload` komplett ersetzen:

```js
export function buildDraftReviewPayload(context, { temperature = 0.3, format = null } = {}) {
  const fmtLine = format
    ? `Liga-Format: ${format.scoringType}, ${format.teams} Teams, Superflex: ${format.isSuperflex ? 'ja' : 'nein'}.`
    : 'Liga-Format: siehe scoring_settings im Kontext.'
  const system = [
    'Du bist ein akribischer Fantasy-Football-Draft-Analyst.',
    'Alle Freitexte auf Deutsch (du-Form). Sei praezise und handlungsorientiert.',
    'Ranke strikt (1 = am besten), Scores 0-100 monoton zu den Raengen.',
    'Stuetze jede Aussage auf den mitgelieferten Kontext; erfinde nichts.',
    fmtLine,
    context?.draft_mode === 'rookie'
      ? 'Rookie-Draft: bewerte Value gegen den Board-Rang, nicht gegen ADP.'
      : '',
  ].filter(Boolean).join(' ')

  const user = `Erzeuge aus dem folgenden CONTEXT_JSON:
- overallRankings (strikt 1..N, score 0-100),
- teamOneLiners (eine Zeile je Team),
- overallSummary (knapp),
- myTeamDeepDive (grade, strengths, weaknesses, risks, recommendedMoves, longText),
- steals (bester Value, mit Begruendung),
- reaches (schlechtester Value, mit Begruendung),
- lessonsForNextMock (2-4 konkrete Learnings fuer den naechsten Mock; evidence MUSS sich auf konkrete Picks/Raenge aus dem Kontext beziehen).

<CONTEXT_JSON>
${JSON.stringify(context)}
</CONTEXT_JSON>`

  return { system, messages: [{ role: 'user', content: user }], temperature, max_tokens: 4096 }
}
```

- [ ] **Step 5: Grün + volle Suite.**

- [ ] **Step 6: Commit**

```bash
git add src/server/apiRoutes.js src/server/apiRoutes.test.js src/services/aiDraftReviewClient.js src/services/aiDraftReviewClient.test.js
git commit -m "feat(review): Learnings statt Week-1-Fabrikation, Format aus deriveFormat, Diaet, Deutsch"
```

---

### Task 11: Draft-Review-UI — Button statt Auto-Call, State-Lift, Learnings-Sektion

**Files:**
- Modify: `src/components/DraftAnalysis.jsx`, `src/App.jsx`

**Interfaces:**
- Consumes: `buildDraftReviewPayload(context, { format })` (Task 10), `formatEstimate`/`formatUsage` (Task 4).
- Produces: `DraftAnalysis`-Props: `reviewResult`, `onReviewResult(result)` — der Ergebnis-Cache lebt in App.jsx.

- [ ] **Step 1: Bestand lesen** — `DraftAnalysis.jsx` komplett (249 Zeilen), insbesondere den Render-Teil ab Zeile 80 (wo Week-1 angezeigt wird) und den Draft-Reset-Effekt in `App.jsx` (`prevDraftIdRef`).

- [ ] **Step 2: App.jsx — Ergebnis-Cache**

```js
const [reviewResult, setReviewResult] = useState(null)
```

Im bestehenden Draft-Wechsel-Reset (`prevDraftIdRef`-Effekt) zusätzlich `setReviewResult(null)`. An `<DraftAnalysis …>` übergeben: `reviewResult={reviewResult}` `onReviewResult={setReviewResult}` sowie `draftMode={draftMode}` und `format={{ scoringType: effScoringType, teams: teamsCount, isSuperflex }}` (die drei Werte existieren in App.jsx als Memos — exakte Namen beim Lesen verifizieren).

- [ ] **Step 3: DraftAnalysis umbauen**

a) **Auto-Call entfernen:** den `React.useEffect(() => { if (canAI && !ai.ran … ) runAI() })` ersatzlos streichen.

b) Ergebnis aus Props: `const data = props.reviewResult` statt `ai.data`; `runAI` ruft am Ende `props.onReviewResult(parsed)`.

c) `buildDraftReviewContext({ …, draftMode })` und `buildDraftReviewPayload(ctx, { temperature: 0.3, format })` mit den neuen Props aufrufen.

d) **Button + Kosten** (an der Stelle, wo bisher automatisch geladen wurde):

```jsx
{!data && !ai.loading && (
  <div className="review-start">
    <button className="btn btn-primary" onClick={runAI} disabled={!canAI}>
      Review starten
    </button>
    <span className="muted text-xs">{estimate}</span>
  </div>
)}
{data && (
  <button className="btn btn-ghost btn-sm" onClick={runAI} disabled={ai.loading}>
    Neu berechnen
  </button>
)}
```

mit

```js
const estimate = React.useMemo(() => {
  if (!canAI) return ''
  try {
    const ctx = buildDraftReviewContext({ league, picks, teamByRosterId, ownerLabels, myOwnerId, myRosterId, board, draftMode })
    return formatEstimate(buildDraftReviewPayload(ctx, { format }), 'claude-sonnet-5')
  } catch { return '' }
}, [canAI, picks?.length, draftMode])
```

e) **Learnings statt Week-1:** die Week-1-Sektion im Render entfernen; stattdessen:

```jsx
{data?.lessonsForNextMock?.length > 0 && (
  <section className="review-lessons">
    <h3>Learnings für den nächsten Mock</h3>
    <ul>
      {data.lessonsForNextMock.map((l, i) => (
        <li key={i}>
          <strong>{l.lesson}</strong>
          <div className="muted text-xs">{l.evidence}</div>
        </li>
      ))}
    </ul>
  </section>
)}
```

f) **Fallback ehrlich machen:** wo `fallbackRosterId` greift (erstes Team statt meinem), einen Hinweis rendern: `{usedFallback && <p className="muted text-xs">Hinweis: Dein Team konnte nicht sicher erkannt werden — der Deep-Dive beschreibt das erste Team der Liste.</p>}` (`usedFallback = !myRosterId || !rosterKeys.includes(myRosterId)`).

g) **Usage anzeigen:** `callAiDraftReview` gibt heute nur `parsed` zurück — die SSE-Verarbeitung in `readSSEResult` zusätzlich `usage`/`model` aus dem `result`-Event mitnehmen (`return { parsed: result, usage: lastUsage, model: lastModel }`-Form; Aufrufer entsprechend anpassen) und im Footer `formatUsage(usage, model)` rendern. Das gecachte `reviewResult` in App.jsx wird dafür `{ parsed, usage, model }`.

- [ ] **Step 4: Grün + Build; manuell im Preview:** Modal öffnen ⇒ **kein** Netzwerk-Call (Netzwerk-Tab/`read_network_requests` leer bzgl. `/api/ai-draft-review`), Button mit Schätzung sichtbar. Schließen/Öffnen ⇒ weiterhin kein Call.

- [ ] **Step 5: Commit**

```bash
git add src/components/DraftAnalysis.jsx src/App.jsx
git commit -m "fix(review): kein Auto-Call mehr — Button mit Kostenschaetzung, Ergebnis-Cache, Learnings-Sektion"
```

---

### Task 12: Trade-Hygiene — ehrliches Format, Deutsch, validierte Vorschläge, echte Badges

**Files:**
- Modify: `src/services/aiTrade.js`, `src/components/TradeAnalyzer.jsx`
- Create: `src/services/aiTrade.test.js`

**Interfaces:**
- Consumes: `deriveFormat` aus `./draftFormat`, `validateTradeSuggestions` (Task 7), `formatEstimate`/`formatUsage` (Task 4).

- [ ] **Step 1: Failing Tests schreiben**

`src/services/aiTrade.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { buildTradeAnalysisRequest, buildTradeSuggestionsRequest } from './aiTrade'

const dynastyLeague = { settings: { type: 2 }, scoring_settings: { rec: 0 }, roster_positions: ['QB','RB'], total_rosters: 10 }
const redraftLeague = { settings: { type: 0 }, scoring_settings: { rec: 0 }, roster_positions: ['QB','RB'], total_rosters: 10 }
const evalResult = { totalGive: 1, totalGet: 1, ratio: 1, verdict: 'fair', profile: 'balanced', avgAge: 26, enrichedGive: [], enrichedGet: [] }

describe('aiTrade — ehrliches Format', () => {
  it('redraft-Liga heisst redraft, nicht dynasty', () => {
    const p = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: redraftLeague })
    const ctx = JSON.parse(p.messages[0].content.replace(/^[^{]*/, ''))
    expect(ctx.league.format).toBe('redraft')
  })
  it('settings.type wird numerisch gelesen — 2 ist dynasty, 1 ist keeper', () => {
    const p = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: dynastyLeague })
    const ctx = JSON.parse(p.messages[0].content.replace(/^[^{]*/, ''))
    expect(ctx.league.format).toBe('dynasty')
    const k = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: { ...redraftLeague, settings: { type: 1 } } })
    expect(JSON.parse(k.messages[0].content.replace(/^[^{]*/, '')).league.keeper).toBe(true)
  })
  it('Scoring kommt aus deriveFormat, nicht aus rec??1 — rec 0 ist standard', () => {
    const p = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: redraftLeague })
    const ctx = JSON.parse(p.messages[0].content.replace(/^[^{]*/, ''))
    expect(ctx.league.scoring.toLowerCase()).toContain('standard')
  })
  it('beide Prompts sind deutsch', () => {
    const a = buildTradeAnalysisRequest({ tradeGive: [], tradeGet: [], evalResult, dynastyRoster: [], league: dynastyLeague })
    const s = buildTradeSuggestionsRequest({ myRoster: { displayName: 'x', players: [], picks: [] }, enrichedRosters: {}, myRosterId: '1', league: dynastyLeague, profile: 'balanced' })
    expect(a.system).toMatch(/Deutsch/)
    expect(a.system).not.toMatch(/Respond in English/)
    expect(s.system).toMatch(/Deutsch/)
    expect(s.max_tokens).toBe(2500)
  })
})
```

Hinweis: die `JSON.parse(…replace(/^[^{]*/, ''))`-Extraktion setzt voraus, dass der Kontext als JSON im User-Content endet — vor Umsetzung an den realen Content-Aufbau anpassen (heute: `Analyze this dynasty trade:\n\n${JSON.stringify(context, null, 2)}` → Präfixtext bis zur ersten `{` abschneiden funktioniert).

- [ ] **Step 2: Rot sehen.**

- [ ] **Step 3: `aiTrade.js` umbauen**

In beiden Buildern (`buildTradeAnalysisRequest`, `buildTradeSuggestionsRequest`):

```js
import { deriveFormat } from './draftFormat'

  const leagueType = Number(league?.settings?.type)   // 0=redraft, 1=keeper, 2=dynasty — Zahl!
  const format = leagueType === 2 ? 'dynasty' : 'redraft'
  const keeper = leagueType === 1
  const scoringType = deriveFormat({ league }).scoringType   // 'ppr'|'half_ppr'|'standard'
  const scoring = { ppr: 'PPR', half_ppr: '0.5 PPR', standard: 'Standard' }[scoringType] || scoringType
```

`context.league` wird `{ format, ...(keeper ? { keeper: true } : {}), scoring, superflex: isSuperflex, teams: … }` (isSuperflex-Ableitung bleibt). Die alten `scoringRec`-Zeilen entfallen.

System-Prompts ersetzen — Analyse:

```js
  const system = `Du bist ein erfahrener Fantasy-Football-Analyst (${format === 'dynasty' ? 'Dynasty' : 'Redraft'}). Analysiere den Trade aus Sicht des Nutzers ("you give" / "you receive").

Regeln:
- Nutze AUSSCHLIESSLICH die mitgelieferten Werte (dynasty_value/adjusted_value).
- Ueberbewerte zukuenftige Picks nicht.
- Beruecksichtige Kaderstaerken und Beduerfnisse beider Teams.
- Beziehe das Team-Profil ein (Contender vs. Rebuild).
- Alle Freitexte auf Deutsch (du-Form).`
```

Suggestions analog (Kernregeln behalten: nur Namen aus den Daten, ±10 % Balance, beidseitiger Nutzen — plus Deutsch-Zeile); `max_tokens: 2000` → `2500`.

- [ ] **Step 4: `TradeAnalyzer.jsx` — Validierung, echte Badges, Usage, Schätzung**

a) Im `doSuggestWithKey`-result-Zweig statt `setSuggestResult(data.parsed)`:

```js
import { validateTradeSuggestions } from '../services/aiValidate'
// …
const opponentAssetsByName = new Map(
  Object.entries(enrichedRosters || {})
    .filter(([rid]) => rid !== (managerGive || myRosterId))
    .map(([, d]) => [String(d.displayName || '').toLowerCase(), { players: d.players, picks: d.picks }])
)
const myAssets = { players: myRoster.players, picks: myRoster.picks }
const { cleaned, warnings } = validateTradeSuggestions(data.parsed, { myAssets, opponentAssetsByName })
setSuggestResult(cleaned)
setSuggestWarnings(warnings)
setSuggestUsage(data.usage || null)
```

(zwei neue useState `suggestWarnings` `[]` und `suggestUsage` `null`; analog `aiUsage` für die Analyse — dort ist `data.usage` bereits im Event enthalten.)

b) `TradeSuggestions` rendert `warnings` (Prop) oberhalb der Karten als `muted`-Absätze und einen Usage-Footer (`formatUsage(suggestUsage, 'claude-sonnet-5')`). Die `balanced`-Prozentrechnung bleibt unverändert — sie arbeitet jetzt automatisch mit den neu summierten Werten.

c) Kostenschätzung neben beiden Buttons („AI Analysis", „Suggest Trades") per `formatEstimate(payload, 'claude-sonnet-5')` — Payload dafür im `useMemo` bauen wie in Task 9e (try/catch, leerer String bei Fehlern).

d) `AiResult` bekommt einen Usage-Footer (`aiUsage`).

- [ ] **Step 5: Grün + volle Suite + Build.**

- [ ] **Step 6: Commit**

```bash
git add src/services/aiTrade.js src/services/aiTrade.test.js src/components/TradeAnalyzer.jsx
git commit -m "fix(trade): ehrliches Format, deutsche Antworten, validierte Vorschlaege, Badges aus eigenen Werten"
```

---

### Task 13: Manuelle Live-Verifikation (Fetch-Interception + max. 3 bezahlte Calls)

**Files:** keine Code-Änderungen erwartet; Fixes, die hier auffallen, werden als eigene Commits nachgezogen.

**Voraussetzungen:** Browser-Pane; Vite **aus dem Worktree** starten (5173 kann fremd belegt sein — Marker-Check!); API-Server aus dem Worktree (`npm run dev:api`); Sleeper-Mock des Nutzers oder der von gestern (`sdh-session-v1` hat ggf. noch Draft `1383717351475662848`). Der Anthropic-Key liegt in `localStorage.sdh_api_key`.

- [ ] **Step 1: Server + Tab hochziehen, Worktree-Identität beweisen**

Vite im Worktree starten, im Browser `fetch('/src/services/aiValidate.js')` — 200 beweist, dass der Server DIESEN Code serviert (nicht den einer anderen Session).

- [ ] **Step 2: Kostenlose Payload-Prüfung per Interception**

```js
window.__realFetch = window.fetch
window.__cap = {}
window.fetch = function (url, opts) {
  const u = String(url)
  const hit = ['/api/ai-advice', '/api/ai-draft-review', '/api/ai-trade'].find(e => u.includes(e))
  if (hit) { window.__cap[hit] = JSON.parse(opts.body); return Promise.reject(new Error('INTERCEPTED_NO_SPEND')) }
  return window.__realFetch.apply(this, arguments)
}
```

Dann je Feature den Button klicken und prüfen:
- **Advice** (`__cap['/api/ai-advice']`): Kontext enthält `draft_flow`, `opponents_before_my_next` (bei Snake), `tips_signals` (≤7), `my_slot`, `draft.my_next_pick_number`; Kandidaten tragen `adp`/`high`/`low`/`stdev`; `max_tokens === 2000`; Schema verlangt `survival`.
- **Review** (`__cap['/api/ai-draft-review']`): `system` deutsch, Formatzeile korrekt (Standard-Mock ⇒ „standard"), kein „Half-PPR unless"; `board.players.length ≤ 300` mit 5 Feldern; kein `draft_order`; User-Prompt nennt `lessonsForNextMock`. **Und: das Modal öffnen alleine darf keinen Request auslösen** — erst der Button.
- **Trade** (`__cap['/api/ai-trade']`, Suggest-Button): `league.format` passt zum Liga-Typ, `system` deutsch.
- UI: neben allen AI-Buttons steht die „≈ …Tokens · ~…$"-Schätzung.

Danach `window.fetch = window.__realFetch`.

- [ ] **Step 3: Bezahlter Call 1+2 — Advice, zweimal kurz nacheinander**

AI-Advice klicken (Call 1). Prüfen: deutsche Texte (du-Form) in Empfehlung/Trade-offs/Survival/Plan; Survival-Verdicts als „dürfte da sein / ein Münzwurf / dürfte weg sein"; Plan nennt echte kommende Pick-Nummern; Usage-Footer zeigt Zahlen. Direkt danach erneut klicken (Call 2): im Footer muss `Cache …` > 0 erscheinen (`cache_read_input_tokens`) — das beweist das Prompt-Caching Ende-zu-Ende.

- [ ] **Step 4: Bezahlter Call 3 — Draft-Review**

„Review starten" klicken. Prüfen: deutsche Ausgabe; `lessonsForNextMock` gerendert mit `evidence`, die konkrete Picks/Ränge nennt; kein Week-1-Abschnitt; Usage im Footer; Modal schließen/öffnen zeigt das gecachte Ergebnis ohne neuen Call; „Neu berechnen"-Button vorhanden. **Trade bleibt payload-verifiziert** (Budget) — das ist im Abschlussbericht ehrlich auszuweisen.

- [ ] **Step 5: Regression + Abschluss**

`npx vitest run` (volle Suite grün), `npx vite build` sauber, `node src/server/prod.js` gegen frisches `dist/` + `curl /api/health` (Sonnet 5). Befunde und ggf. Fix-Commits im Ledger festhalten.

- [ ] **Step 6: Commit (falls Fixes anfielen) und Abschlussbericht an den Nutzer**

Ehrlich trennen: live bewiesen (Advice inkl. Cache, Review) vs. nur payload-verifiziert (Trade).

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** §5→Task 1+2, §6→Task 3+5, §7→Task 6+8, §8→Task 7 (+9d/12a), §9→Task 10+11, §10→Task 4 (+9e/11d/12c), §11→Task 12, §12→Task 8+9, §13→alle Test-Steps + Task 13, Risiko „livePicks leer"→Task 9f. Keine Lücke gefunden.
- **Platzhalter:** Die „[verschoben: …]"-Marker in Task 1 sind Verschiebe-Anweisungen mit exakten Zeilenangaben, kein TBD. `distDir` wird explizit aus der Bestandsdatei übernommen (Step 1 liest sie).
- **Typ-Konsistenz:** `validateAdvice(parsed, Set)` einheitlich (Task 7 Def, Task 9d Aufruf); `formatEstimate(payload, model)` einheitlich (Task 4 Def; 9e/11d/12c Aufrufe); `REVIEW_TOOL.lessonsForNextMock` = `{lesson, evidence}` (Task 10 Def, Task 11e Render); Survival-Enum identisch in Task 6 (Schema), Task 8 (Label-Map) und Spec.
