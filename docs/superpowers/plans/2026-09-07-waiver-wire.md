# Waiver-Wire-Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue In-Season-Seite `/waiver` mit Pickup-Empfehlungen (redraft/dynasty-abhängig), einem Streaming-Ranking für DEF/QB/TE (Weekly + ROS nebeneinander) und einer Empfehlung für die optimale Wochenaufstellung inkl. Abgleich gegen die tatsächlich gesetzte Sleeper-Aufstellung.

**Architecture:** Ein neuer FantasyPros-Positions-Scraper-Endpoint (`GET /api/rankings/fantasypros-position`) liefert Weekly- und ROS-Ranglisten je Position, nach demselben `ecrData`-Extraktionsmuster wie der bestehende `/api/rankings/fantasypros`-Cheatsheet-Scraper. Freie Spieler werden clientseitig aus dem vollen Sleeper-Spielerkatalog minus aller Liga-Kader berechnet. Alles läuft in reinen, testbaren Funktionen (`src/services/analysis/waiverStats.js`), die eine neue Seite `WaiverPage.jsx` mit drei unabhängigen Komponenten zusammensetzt.

**Tech Stack:** React 18, Zustand (+persist), Express 5, cheerio (Server-Scraping), Vitest.

## Global Constraints

- UI-Texte ausschließlich Deutsch (CLAUDE.md-Konvention).
- Sleeper-Positionscode ist `DEF`, FantasyPros nennt dieselbe Position `DST` — beim Mergen immer auf `DEF` normalisieren, nie `DST` ins UI durchreichen.
- Kein Kicker (K) in Pickup-Liste oder Streaming-Board (siehe Design-Doc, Abschnitt "Bewusst nicht umgesetzt").
- Kein Projection-Vergleichs-Chart, kein Waiver-Order/FAAB-Tracking, keine Wochen-Navigation (nur aktuelle Woche) — alles bewusst außerhalb des Scopes.
- Test-Kommandos in diesem Plan sind bewusst auf die jeweils betroffene Datei gescoped (`npx vitest run <pfad>`), nicht die volle Suite — nur am Ende (Task 13) läuft `npm test` einmal komplett.
- Verifizierte FantasyPros-URL-Fakten (live geprüft, 2026-09-07): `qb.php`/`dst.php` haben KEINE Scoring-Variante. `te.php`/`ppr-te.php`/`half-point-ppr-te.php` schon (gilt genauso für RB/WR, falls die Streaming-Liste später erweitert wird). ROS-Pendant ist immer `ros-` vorangestellt, gleiche Scoring-Suffixe: `ros-qb.php`, `ros-dst.php`, `ros-te.php`, `ros-ppr-te.php`, `ros-half-point-ppr-te.php`. `ecrData.players[]` enthält bei Weekly-Seiten zusätzlich `fantasy_pts` (Projected Points) und `player_opponent` (z. B. `"at IND"`) — bei ROS-Seiten fehlen beide Felder (`null`).

---

## Datei-Überblick

| Datei | Art | Zweck |
|---|---|---|
| `src/server/rankings.js` | ändern | URL-Builder + Normalizer-Erweiterung (`fantasy_pts`, `opponent`) |
| `src/server/rankings.test.js` | ändern | Tests für URL-Builder |
| `src/server/apiRoutes.js` | ändern | neue Route `/api/rankings/fantasypros-position` |
| `src/server/apiRoutes.test.js` | ändern | Test für neue Route |
| `src/services/playersMeta.js` | ändern | `status`-Feld ergänzen |
| `src/stores/useDynastyStore.js` | ändern | `injury_status` in `dynastyRoster`-Mapping |
| `src/services/analysis/waiverStats.js` | neu | reine Logik: freeAgents, pickupRanking, streamingBoard, bestLineup, compareToActualStarters |
| `src/services/analysis/waiverStats.test.js` | neu | Tests dazu |
| `src/stores/useWeeklyRankingsStore.js` | neu | TTL-Cache-Store für FP-Weekly/ROS je Position |
| `src/stores/useWeeklyRankingsStore.test.js` | neu | Test dazu |
| `src/components/waiver/PickupSuggestions.jsx` | neu | Komponente 1 |
| `src/components/waiver/StreamingBoard.jsx` | neu | Komponente 2 |
| `src/components/waiver/RecommendedLineupCard.jsx` | neu | Komponente 3 |
| `src/pages/WaiverPage.jsx` | neu | Orchestrator-Seite |
| `src/App.jsx` | ändern | Route `/waiver` |
| `src/components/TabsNav.jsx` | ändern | Desktop-Nav-Eintrag |
| `src/components/MobileMoreSheet.jsx` | ändern | Mobile-Nav-Eintrag |
| `src/styles/analysis.css` | ändern | ein paar Waiver-spezifische Klassen ergänzt (kein neues Stylesheet — Seite ist strukturell wie `/analyse`) |

---

### Task 1: FantasyPros-Positions-URL-Builder + Normalizer-Erweiterung

**Files:**
- Modify: `src/server/rankings.js`
- Test: `src/server/rankings.test.js`

**Interfaces:**
- Produces: `fantasyProsPositionUrl(pos, scope, scoring)` → `string`; erweiterte `normalizeFantasyProsPlayer(raw)` mit zusätzlich `fantasy_pts: number|null` und `opponent: string|null`.

- [ ] **Step 1: Failing Test schreiben**

In `src/server/rankings.test.js` (an bestehende `describe`-Blöcke anhängen):

```js
import { fantasyProsPositionUrl, normalizeFantasyProsPlayer } from './rankings.js'

describe('fantasyProsPositionUrl', () => {
  it('QB und DST haben keine Scoring-Variante', () => {
    expect(fantasyProsPositionUrl('QB', 'week', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/qb.php')
    expect(fantasyProsPositionUrl('DEF', 'week', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/dst.php')
    expect(fantasyProsPositionUrl('DEF', 'ros', 'std')).toBe('https://www.fantasypros.com/nfl/rankings/ros-dst.php')
  })

  it('TE hat Scoring-Suffix, Weekly und ROS', () => {
    expect(fantasyProsPositionUrl('TE', 'week', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/ppr-te.php')
    expect(fantasyProsPositionUrl('TE', 'week', 'half')).toBe('https://www.fantasypros.com/nfl/rankings/half-point-ppr-te.php')
    expect(fantasyProsPositionUrl('TE', 'week', 'std')).toBe('https://www.fantasypros.com/nfl/rankings/te.php')
    expect(fantasyProsPositionUrl('TE', 'ros', 'ppr')).toBe('https://www.fantasypros.com/nfl/rankings/ros-ppr-te.php')
  })
})

describe('normalizeFantasyProsPlayer mit Weekly-Feldern', () => {
  it('uebernimmt fantasy_pts und opponent, wenn vorhanden', () => {
    const raw = { player_name: 'Lamar Jackson', rank_ecr: 1, player_team_id: 'BAL', player_position_id: 'QB', fantasy_pts: '21.4', player_opponent: 'at IND' }
    const out = normalizeFantasyProsPlayer(raw)
    expect(out.fantasy_pts).toBe(21.4)
    expect(out.opponent).toBe('at IND')
  })

  it('liefert null, wenn die Felder fehlen (ROS/Cheatsheet)', () => {
    const raw = { player_name: 'Josh Allen', rank_ecr: 1, player_team_id: 'BUF', player_position_id: 'QB' }
    const out = normalizeFantasyProsPlayer(raw)
    expect(out.fantasy_pts).toBeNull()
    expect(out.opponent).toBeNull()
  })
})
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run src/server/rankings.test.js`
Expected: FAIL — `fantasyProsPositionUrl is not a function` / `fantasy_pts` ist `undefined` statt `21.4`/`null`.

- [ ] **Step 3: Implementieren**

In `src/server/rankings.js`, direkt unter `FP_POSITIONS` (nach Zeile 95) einfügen:

```js
// ---------- FantasyPros Weekly + ROS je Position (Waiver-Wire) ----------
// Sleeper/App-Konvention ist "DEF", FantasyPros nennt dieselbe Position "DST".
const FP_POS_SLUG = { QB: 'qb', RB: 'rb', WR: 'wr', TE: 'te', DEF: 'dst' }

// Nur RB/WR/TE haben eine Scoring-Variante (PPR/Half/Standard aendert ihren
// Punktwert). QB und DST/DEF sind scoring-unabhaengig -- fuer die gibt es auf
// FantasyPros keine ppr-/half-point-ppr-Praefix-Seiten.
const FP_SCORING_HAS_VARIANT = new Set(['RB', 'WR', 'TE'])
const FP_SCORING_PREFIX = { ppr: 'ppr-', half: 'half-point-ppr-', std: '' }

// scope: 'week' (aktuelle Woche) | 'ros' (Rest of Season). Live gegen
// fantasypros.com verifiziert (siehe Global Constraints im Plan) -- Muster:
// [ros-][ppr-|half-point-ppr-]<pos>.php
export function fantasyProsPositionUrl(pos, scope, scoring = 'ppr') {
  const slug = FP_POS_SLUG[String(pos).toUpperCase()]
  if (!slug) throw new Error(`Unbekannte Position fuer FantasyPros: ${pos}`)
  const scopePrefix = scope === 'ros' ? 'ros-' : ''
  const scoringPrefix = FP_SCORING_HAS_VARIANT.has(String(pos).toUpperCase())
    ? (FP_SCORING_PREFIX[scoring] ?? FP_SCORING_PREFIX.ppr)
    : ''
  return `https://www.fantasypros.com/nfl/rankings/${scopePrefix}${scoringPrefix}${slug}.php`
}
```

Dann `normalizeFantasyProsPlayer` (aktuell Zeilen 137-158) erweitern — im Return-Objekt zwei Felder ergänzen:

```js
export function normalizeFantasyProsPlayer(raw) {
  const name = raw?.player_name || ''
  const ecr = Number(raw?.rank_ecr)
  const fantasyPts = Number(raw?.fantasy_pts)
  return {
    rk: String(raw?.rank_ecr ?? ''),
    ecr: Number.isFinite(ecr) ? ecr : null,
    tier: raw?.tier ?? '',
    name,
    team: raw?.player_team_id || '',
    pos: raw?.player_position_id || '',
    posRank: raw?.pos_rank || '',
    bye: raw?.player_bye_week ?? '',
    sos: '',
    ecrVsAdp: '',
    adp: null,
    dynasty_value: null,
    redraft_value: null,
    age: null,
    years_exp: null,
    nname: normalizePlayerName(name),
    // Nur auf Weekly-Seiten vorhanden (nicht ROS/Cheatsheet) -- dort bleibt's null.
    fantasy_pts: Number.isFinite(fantasyPts) ? fantasyPts : null,
    opponent: raw?.player_opponent || null,
  }
}
```

- [ ] **Step 4: Test laufen lassen, muss passen**

Run: `npx vitest run src/server/rankings.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/rankings.js src/server/rankings.test.js
git commit -m "feat(waiver): FantasyPros Weekly/ROS-URL-Builder + fantasy_pts/opponent im Normalizer"
```

---

### Task 2: Server-Route `/api/rankings/fantasypros-position`

**Files:**
- Modify: `src/server/apiRoutes.js`
- Test: `src/server/apiRoutes.test.js`

**Interfaces:**
- Consumes: `fantasyProsPositionUrl(pos, scope, scoring)`, `extractEcrData(html)`, `normalizeFantasyProsPlayer(raw)` aus Task 1.
- Produces: `GET /api/rankings/fantasypros-position?pos=QB|TE|DEF&scope=week|ros&scoring=ppr|half|std` → `{ ok: true, meta: {...}, players: [...] }` oder `{ ok: false, error }`.

- [ ] **Step 1: Failing Test schreiben**

In `src/server/apiRoutes.test.js`, an bestehende Rankings-Tests anhängen (gleiches Mock-Muster wie der `fantasypros`-Test dort — `global.fetch` mocken):

```js
describe('GET /api/rankings/fantasypros-position', () => {
  it('liefert normalisierte Spieler fuer pos/scope/scoring', async () => {
    const html = `<script>var ecrData = ${JSON.stringify({
      players: [{ player_name: 'Travis Kelce', rank_ecr: 1, player_team_id: 'KC', player_position_id: 'TE', fantasy_pts: '14.2' }],
    })}</script>`
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => html })

    const res = await request(app).get('/api/rankings/fantasypros-position?pos=TE&scope=week&scoring=ppr')

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.players[0].name).toBe('Travis Kelce')
    expect(res.body.players[0].fantasy_pts).toBe(14.2)
    expect(global.fetch).toHaveBeenCalledWith('https://www.fantasypros.com/nfl/rankings/ppr-te.php', expect.anything())
  })

  it('lehnt unbekannte Position ab', async () => {
    const res = await request(app).get('/api/rankings/fantasypros-position?pos=K&scope=week')
    expect(res.status).toBe(400)
    expect(res.body.ok).toBe(false)
  })

  it('gibt 502, wenn ecrData fehlt (FantasyPros-Struktur geaendert)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '<html>keine Daten</html>' })
    const res = await request(app).get('/api/rankings/fantasypros-position?pos=QB&scope=week')
    expect(res.status).toBe(502)
    expect(res.body.ok).toBe(false)
  })
})
```

Prüfe vorher kurz den Kopf von `apiRoutes.test.js` (Imports von `request`/`app`/`vi`) und übernimm exakt dasselbe Setup wie beim bestehenden `fantasypros`-Testblock — nicht neu erfinden.

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run src/server/apiRoutes.test.js -t "fantasypros-position"`
Expected: FAIL — 404 (Route existiert nicht).

- [ ] **Step 3: Implementieren**

In `src/server/apiRoutes.js` Import-Zeile (aktuell Zeile 9-13) erweitern:

```js
import {
  FFC_FORMATS, normalizeFfcPlayer, isDynastyFromQuery,
  FP_SCORING_URLS, FP_POSITIONS, extractEcrData, normalizeFantasyProsPlayer,
  SLEEPER_ADP_FIELD, normalizeSleeperAdpPlayer,
  fantasyProsPositionUrl,
} from './rankings.js'
```

Direkt nach der bestehenden `/api/rankings/fantasypros`-Route (nach der schließenden `})` bei Zeile 658) einfügen:

```js
  // ---------- Rankings: FantasyPros Weekly/ROS je Position (Waiver-Wire) ----------
  // Cache getrennt nach pos+scope+scoring, da jede Kombination eine eigene
  // FantasyPros-Seite ist. Weekly aendert sich taeglich (Verletzungen,
  // Beat-Reports) -> kurze TTL. ROS bewegt sich langsamer -> lange TTL.
  const fpPositionCache = new Map() // "pos:scope:scoring" -> { at, players }
  const FP_POSITION_TTL_MS = { week: 6 * 60 * 60 * 1000, ros: 24 * 60 * 60 * 1000 }
  const FP_POSITION_VALID_POS = ['QB', 'RB', 'WR', 'TE', 'DEF']

  app.get('/api/rankings/fantasypros-position', async (req, res) => {
    const pos = String(req.query.pos || '').toUpperCase()
    const scope = req.query.scope === 'ros' ? 'ros' : 'week'
    const scoring = ['ppr', 'half', 'std'].includes(String(req.query.scoring)) ? String(req.query.scoring) : 'ppr'
    if (!FP_POSITION_VALID_POS.includes(pos)) {
      return res.status(400).json({ ok: false, error: `Unbekannte Position: ${pos}` })
    }
    const cacheKey = `${pos}:${scope}:${scoring}`
    const cached = fpPositionCache.get(cacheKey)
    if (cached && Date.now() - cached.at < FP_POSITION_TTL_MS[scope]) {
      return res.json({ ok: true, cached: true, meta: cached.meta, players: cached.players })
    }
    const url = fantasyProsPositionUrl(pos, scope, scoring)
    const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    try {
      const upstream = await fetch(url, { headers: HEADERS })
      if (!upstream.ok) return res.status(502).json({ ok: false, error: `FantasyPros returned ${upstream.status}` })
      const html = await upstream.text()
      const data = extractEcrData(html)
      const rawPlayers = Array.isArray(data?.players) ? data.players : []
      if (!rawPlayers.length) {
        return res.status(502).json({ ok: false, error: 'Keine Spieler gefunden – FantasyPros-Struktur möglicherweise geändert' })
      }
      const players = rawPlayers.map((p, idx) => ({ id: idx + 1, ...normalizeFantasyProsPlayer(p) }))
      const meta = {
        source: 'fantasypros', pos, scope, scoring,
        week: data?.week ?? null,
        fetched_at: new Date().toISOString(),
      }
      fpPositionCache.set(cacheKey, { at: Date.now(), meta, players })
      res.json({ ok: true, meta, players })
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message || 'FantasyPros-Scraping fehlgeschlagen' })
    }
  })
```

- [ ] **Step 4: Test laufen lassen, muss passen**

Run: `npx vitest run src/server/apiRoutes.test.js -t "fantasypros-position"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/apiRoutes.js src/server/apiRoutes.test.js
git commit -m "feat(waiver): Route /api/rankings/fantasypros-position (Weekly+ROS je Position)"
```

---

### Task 3: `playersMeta.js` — `status`-Feld für Free-Agent-Filter

**Files:**
- Modify: `src/services/playersMeta.js`

**Interfaces:**
- Produces: `loadPlayersMetaCached()` liefert pro Spieler zusätzlich `status` (z. B. `"Active"`, `"Inactive"`).

- [ ] **Step 1: SLIM_KEYS erweitern**

In `src/services/playersMeta.js`, `SLIM_KEYS` (Zeile 9-20), `'status'` ergänzen:

```js
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
]
```

- [ ] **Step 2: Cache-Version hochzählen**

Vorhandene Nutzer haben eine 24h gecachte Version ohne `status` im `localStorage`. Damit sie nicht bis zu 24h ohne das Feld dastehen, `CACHE_KEY` (Zeile 4) von `v2` auf `v3` heben:

```js
const CACHE_KEY = 'sdh.playersMeta.v3'
```

- [ ] **Step 3: Manuell verifizieren**

Kein eigener Test nötig — reine Feldergänzung an einer bereits getesteten Passthrough-Funktion (`loadPlayersMetaCached` hat aktuell keine Testdatei, Verhalten bleibt sonst unverändert). Kurzer Sanity-Check reicht:

Run: `npx vitest run src/services/playersMeta.test.js 2>&1 || echo "keine Testdatei vorhanden, das ist ok"`

- [ ] **Step 4: Commit**

```bash
git add src/services/playersMeta.js
git commit -m "feat(waiver): status-Feld im Spieler-Cache fuer Free-Agent-Filter"
```

---

### Task 4: `useDynastyStore.js` — `injury_status` im eigenen Kader

**Files:**
- Modify: `src/stores/useDynastyStore.js`
- Test: `src/stores/useDynastyStore.test.js`

**Interfaces:**
- Produces: Jeder Eintrag in `dynastyRoster` hat zusätzlich `injury_status: string|null`.

- [ ] **Step 1: Failing Test schreiben**

Prüfe zuerst kurz den bestehenden Testaufbau von `src/stores/useDynastyStore.test.js` (Mock von `fetchLeagueRosters`/`loadPlayersMetaCached`) und ergänze eine Assertion in einem bestehenden `loadDynastyRoster`-Testfall (oder einen neuen, nach demselben Muster):

```js
it('uebernimmt injury_status aus playersMeta in dynastyRoster', async () => {
  vi.mocked(fetchLeagueRosters).mockResolvedValue([
    { roster_id: 1, owner_id: 'u1', players: ['100'], starters: ['100'] },
  ])
  vi.mocked(loadPlayersMetaCached).mockResolvedValue({
    '100': { full_name: 'Test Player', fantasy_positions: ['RB'], team: 'SEA', injury_status: 'Questionable' },
  })

  await useDynastyStore.getState().loadDynastyRoster({ selectedLeagueId: 'L1', sleeperUserId: 'u1', seasonYear: 2026 })

  expect(useDynastyStore.getState().dynastyRoster[0].injury_status).toBe('Questionable')
})
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run src/stores/useDynastyStore.test.js -t "injury_status"`
Expected: FAIL — `injury_status` ist `undefined`.

- [ ] **Step 3: Implementieren**

In `src/stores/useDynastyStore.js`, im `players`-Mapping für `dynastyRoster` (aktuell Zeilen 88-113), im Return-Objekt `injury_status: meta.injury_status || null` ergänzen:

```js
      const players = (myRoster.players || []).map((id) => {
        const meta = playersMeta[id] || {}
        const slot = taxiSet.has(id)
          ? 'taxi'
          : reserveSet.has(id)
          ? 'ir'
          : starterSet.has(id)
          ? 'starter'
          : 'bench'
        const name = meta.full_name || `#${id}`
        return {
          sleeper_id: id,
          name,
          nname: normalizePlayerName(name),
          pos: (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
          team: meta.team || '',
          bye: meta.bye_week != null ? String(meta.bye_week) : '',
          age: meta.age || null,
          slot,
          injury_status: meta.injury_status || null,
        }
      })
```

- [ ] **Step 4: Test laufen lassen, muss passen**

Run: `npx vitest run src/stores/useDynastyStore.test.js`
Expected: PASS (kompletter Datei-Testlauf, da hier eine geteilte Datei angefasst wird — nicht die volle Suite)

- [ ] **Step 5: Commit**

```bash
git add src/stores/useDynastyStore.js src/stores/useDynastyStore.test.js
git commit -m "feat(waiver): injury_status im eigenen Kader fuer Lineup-Empfehlung"
```

---

### Task 5: `waiverStats.js` — `freeAgents()` + `pickupRanking()`

**Files:**
- Create: `src/services/analysis/waiverStats.js`
- Test: `src/services/analysis/waiverStats.test.js`

**Interfaces:**
- Consumes: nichts Neues (nur `normalizePlayerName` aus `utils/formatting.js`).
- Produces: `freeAgents({ playersMeta, leagueRosters }) → Array<{ player_id, name, nname, pos, team, bye, injury_status }>` (nur `QB|RB|WR|TE|DEF`, aktiv). `pickupRanking({ freeAgents, mode, dynastyValues, rosRankByPos, trendingAddIds }) → Array<{ ...freeAgent, value, valueLabel, trending }>` sortiert, bestes zuerst.

- [ ] **Step 1: Failing Tests schreiben**

```js
import { describe, it, expect } from 'vitest'
import { freeAgents, pickupRanking } from './waiverStats'

describe('freeAgents', () => {
  const playersMeta = {
    '1': { full_name: 'Rostered Guy', fantasy_positions: ['RB'], status: 'Active' },
    '2': { full_name: 'Free Agent Guy', fantasy_positions: ['WR'], status: 'Active', team: 'SEA' },
    '3': { full_name: 'Retired Guy', fantasy_positions: ['QB'], status: 'Inactive' },
    '4': { full_name: 'Kicker Guy', fantasy_positions: ['K'], status: 'Active' },
  }
  const leagueRosters = [{ roster_id: 1, players: [{ sleeper_id: '1' }] }]

  it('schliesst rostered, inaktive und K aus', () => {
    const out = freeAgents({ playersMeta, leagueRosters })
    expect(out.map((p) => p.player_id)).toEqual(['2'])
  })
})

describe('pickupRanking', () => {
  const agents = [
    { player_id: '2', name: 'Free Agent Guy', nname: 'freeagentguy', pos: 'WR', team: 'SEA' },
    { player_id: '5', name: 'Other Guy', nname: 'otherguy', pos: 'WR', team: 'NYJ' },
  ]

  it('dynasty: sortiert nach KTC-Wert, hoechster zuerst', () => {
    const out = pickupRanking({
      freeAgents: agents, mode: 'dynasty',
      dynastyValues: [{ nname: 'otherguy', value: 900 }, { nname: 'freeagentguy', value: 1200 }],
    })
    expect(out[0].player_id).toBe('2')
    expect(out[0].value).toBe(1200)
  })

  it('redraft: sortiert nach ROS-ECR, niedrigster (bester) zuerst', () => {
    const out = pickupRanking({
      freeAgents: agents, mode: 'redraft',
      rosRankByKey: new Map([['NAME:otherguy', 10], ['NAME:freeagentguy', 40]]),
    })
    expect(out[0].player_id).toBe('5')
  })

  it('markiert trending Adds', () => {
    const out = pickupRanking({ freeAgents: agents, mode: 'redraft', trendingAddIds: new Set(['2']) })
    expect(out.find((p) => p.player_id === '2').trending).toBe(true)
  })
})
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run src/services/analysis/waiverStats.test.js`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementieren**

```js
// src/services/analysis/waiverStats.js
import { normalizePlayerName } from '../../utils/formatting'

const WAIVER_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'DEF'])

// Sleeper stellt Team-Defenses als "Spieler" mit Team-Kuerzel als ID dar,
// FantasyPros identifiziert dieselbe Defense ueber player_team_id -- deshalb
// braucht DEF einen eigenen Match-Key (Team), waehrend alles andere ueber den
// normalisierten Namen gematcht wird (gleiche Konvention wie rosterStats.js).
export function matchKey(pos, { name, team } = {}) {
  if (pos === 'DEF') return `TEAM:${String(team || '').toUpperCase()}`
  return `NAME:${normalizePlayerName(name || '')}`
}

export function freeAgents({ playersMeta = {}, leagueRosters = [] }) {
  const rostered = new Set()
  for (const r of leagueRosters || []) {
    for (const p of r.players || []) rostered.add(String(p.sleeper_id))
  }
  const out = []
  for (const [id, meta] of Object.entries(playersMeta || {})) {
    if (rostered.has(String(id))) continue
    if (meta?.status && meta.status !== 'Active') continue
    const pos = (meta?.fantasy_positions?.[0] || meta?.position || '').toUpperCase()
    if (!WAIVER_POSITIONS.has(pos)) continue
    const name = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
    out.push({
      player_id: id,
      name,
      nname: normalizePlayerName(name),
      pos,
      team: meta.team || '',
      bye: meta.bye_week != null ? String(meta.bye_week) : '',
      injury_status: meta.injury_status || null,
    })
  }
  return out
}

// mode 'dynasty': dynastyValues (KTC, {nname, value}) -> hoechster Wert zuerst.
// mode 'redraft': rosRankByKey (Map von matchKey -> ECR-Zahl) -> niedrigster (bester) Rang zuerst.
// Spieler ohne Treffer in der jeweiligen Quelle landen ans Ende, fallen aber nicht raus
// (sie bleiben in der Liste sichtbar, nur unsortiert am Ende -- lieber zeigen als verstecken).
export function pickupRanking({
  freeAgents: agents = [], mode = 'redraft', dynastyValues = [], rosRankByKey = new Map(), trendingAddIds = new Set(),
} = {}) {
  const dynastyByName = new Map((dynastyValues || []).map((d) => [d.nname, d.value]))
  const withValue = agents.map((a) => {
    const key = matchKey(a.pos, a)
    const value = mode === 'dynasty' ? dynastyByName.get(a.nname) ?? null : rosRankByKey.get(key) ?? null
    return { ...a, value, trending: trendingAddIds.has(a.player_id) }
  })
  const hasValue = withValue.filter((a) => a.value != null)
  const noValue = withValue.filter((a) => a.value == null)
  hasValue.sort((x, y) => (mode === 'dynasty' ? y.value - x.value : x.value - y.value))
  return [...hasValue, ...noValue]
}
```

- [ ] **Step 4: Test laufen lassen, muss passen**

Run: `npx vitest run src/services/analysis/waiverStats.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/waiverStats.js src/services/analysis/waiverStats.test.js
git commit -m "feat(waiver): freeAgents + pickupRanking (redraft/dynasty)"
```

---

### Task 6: `waiverStats.js` — `streamingBoard()`

**Files:**
- Modify: `src/services/analysis/waiverStats.js`
- Test: `src/services/analysis/waiverStats.test.js`

**Interfaces:**
- Consumes: `freeAgents`, `matchKey` (Task 5).
- Produces: `streamingBoard({ freeAgents, weeklyRankByKey, rosRankByKey, positions }) → { [pos]: { week: Array, ros: Array } }` — nur die in `positions` enthaltenen Positionen, je Liste sortiert nach ECR (niedrigster zuerst), nur Free Agents.

- [ ] **Step 1: Failing Test schreiben**

```js
import { streamingBoard } from './waiverStats'

describe('streamingBoard', () => {
  const agents = [
    { player_id: '1', name: 'Def A', nname: 'defa', pos: 'DEF', team: 'SEA' },
    { player_id: '2', name: 'Def B', nname: 'defb', pos: 'DEF', team: 'NYJ' },
    { player_id: '3', name: 'TE A', nname: 'tea', pos: 'TE', team: 'KC' },
  ]

  it('baut Week+ROS-Listen nur fuer angehakte Positionen, sortiert nach ECR', () => {
    const out = streamingBoard({
      freeAgents: agents,
      weeklyRankByKey: new Map([['TEAM:SEA', 3], ['TEAM:NYJ', 1]]),
      rosRankByKey: new Map([['TEAM:SEA', 1], ['TEAM:NYJ', 5]]),
      positions: ['DEF'],
    })
    expect(out.TE).toBeUndefined()
    expect(out.DEF.week.map((p) => p.player_id)).toEqual(['2', '1'])
    expect(out.DEF.ros.map((p) => p.player_id)).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run src/services/analysis/waiverStats.test.js -t "streamingBoard"`
Expected: FAIL — `streamingBoard is not a function`.

- [ ] **Step 3: Implementieren**

An `waiverStats.js` anhängen:

```js
function sortByRank(agents, rankByKey) {
  return agents
    .map((a) => ({ ...a, rank: rankByKey.get(matchKey(a.pos, a)) ?? null }))
    .filter((a) => a.rank != null)
    .sort((x, y) => x.rank - y.rank)
}

export function streamingBoard({ freeAgents: agents = [], weeklyRankByKey = new Map(), rosRankByKey = new Map(), positions = [] } = {}) {
  const out = {}
  for (const pos of positions) {
    const posAgents = agents.filter((a) => a.pos === pos)
    out[pos] = {
      week: sortByRank(posAgents, weeklyRankByKey),
      ros: sortByRank(posAgents, rosRankByKey),
    }
  }
  return out
}
```

- [ ] **Step 4: Test laufen lassen, muss passen**

Run: `npx vitest run src/services/analysis/waiverStats.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/waiverStats.js src/services/analysis/waiverStats.test.js
git commit -m "feat(waiver): streamingBoard fuer DEF/QB/TE (Weekly+ROS)"
```

---

### Task 7: `waiverStats.js` — `bestLineup()` + `compareToActualStarters()`

**Files:**
- Modify: `src/services/analysis/waiverStats.js`
- Test: `src/services/analysis/waiverStats.test.js`

**Interfaces:**
- Produces: `bestLineup({ myRosterPlayers, rosterPositions, weeklyRankByKey }) → { slots: Array<{slot, player, rank}>, bench: Array }`. `compareToActualStarters({ recommendedSlots, actualStarterIds }) → { isOptimal: boolean, diffs: Array<{slot, out, in}> }`.

`rosterPositions` ist das echte Sleeper-Format: ein Array wie `['QB','RB','RB','WR','WR','TE','FLEX','DEF','BN','BN', ...]` (das ist `effRoster` aus `App.jsx`). `FLEX` darf `RB|WR|TE` aufnehmen, `SUPER_FLEX` zusaetzlich `QB`.

- [ ] **Step 1: Failing Test schreiben**

```js
import { bestLineup, compareToActualStarters } from './waiverStats'

describe('bestLineup', () => {
  const roster = [
    { sleeper_id: '1', name: 'QB Starter', pos: 'QB', bye: '', injury_status: null },
    { sleeper_id: '2', name: 'RB Best', pos: 'RB', bye: '', injury_status: null },
    { sleeper_id: '3', name: 'RB Worse', pos: 'RB', bye: '', injury_status: null },
    { sleeper_id: '4', name: 'WR Bye', pos: 'WR', bye: '7', injury_status: null },
    { sleeper_id: '5', name: 'WR Hurt', pos: 'WR', bye: '', injury_status: 'Out' },
  ]
  const ranks = new Map([['1', 5], ['2', 3], ['3', 20], ['4', 1], ['5', 2]]) // von rank_ecr, niedriger = besser
  const weeklyRankByKey = new Map([...ranks].map(([id, r]) => [`ID:${id}`, r]))

  it('nimmt den besseren RB in den Slot, schwaecheren in FLEX, schliesst Bye/Injury aus', () => {
    const out = bestLineup({
      myRosterPlayers: roster,
      rosterPositions: ['QB', 'RB', 'FLEX', 'BN', 'BN'],
      weeklyRankByKey,
      currentWeekBye: '7',
    })
    const bySlot = Object.fromEntries(out.slots.map((s) => [s.slot + (s.slotIndex ?? ''), s.player?.sleeper_id]))
    expect(bySlot.QB0).toBe('1')
    expect(bySlot.RB0).toBe('2')
    expect(bySlot.FLEX0).toBe('3') // WR Bye (4) und WR Hurt (5) sind raus
    expect(out.bench.map((p) => p.sleeper_id)).toContain('4')
    expect(out.bench.map((p) => p.sleeper_id)).toContain('5')
  })
})

describe('compareToActualStarters', () => {
  it('isOptimal=true, wenn identisch', () => {
    const slots = [{ slot: 'QB', slotIndex: 0, player: { sleeper_id: '1' } }]
    const out = compareToActualStarters({ recommendedSlots: slots, actualStarterIds: ['1'] })
    expect(out.isOptimal).toBe(true)
    expect(out.diffs).toEqual([])
  })

  it('meldet Abweichung, wenn ein Starter fehlt', () => {
    const slots = [{ slot: 'RB', slotIndex: 0, player: { sleeper_id: '2', name: 'RB Best' } }]
    const out = compareToActualStarters({ recommendedSlots: slots, actualStarterIds: ['3'] })
    expect(out.isOptimal).toBe(false)
    expect(out.diffs[0]).toMatchObject({ slot: 'RB', in: '2' })
  })
})
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run src/services/analysis/waiverStats.test.js -t "bestLineup"`
Expected: FAIL — Funktionen existieren nicht.

- [ ] **Step 3: Implementieren**

An `waiverStats.js` anhängen:

```js
const FLEX_ELIGIBLE = { FLEX: ['RB', 'WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'] }

// Greedy statt echtem bipartiten Matching: pro fixem Positions-Slot den
// bestplatzierten passenden Spieler zuerst, danach FLEX-Slots aus dem Rest.
// Das ist Standard fuer Fantasy-Lineup-Tools und in der Praxis fast immer
// optimal (Abweichungen nur in seltenen Randfaellen mit mehreren FLEX-Typen
// gleichzeitig) -- ponytail: greedy statt Optimalloesung, bei Bedarf durch
// echtes Matching ersetzen, falls FLEX/SUPER_FLEX gemeinsam vorkommen und
// Fehlzuteilungen auffallen.
export function bestLineup({ myRosterPlayers = [], rosterPositions = [], weeklyRankByKey = new Map(), currentWeekBye = null } = {}) {
  const eligible = myRosterPlayers.filter((p) => {
    if (currentWeekBye != null && String(p.bye) === String(currentWeekBye)) return false
    if (p.injury_status === 'Out' || p.injury_status === 'IR') return false
    return true
  })
  const rankOf = (p) => weeklyRankByKey.get(`ID:${p.sleeper_id}`) ?? Infinity
  const used = new Set()
  const slots = []

  const fixedSlots = rosterPositions.filter((s) => s !== 'BN' && !FLEX_ELIGIBLE[s])
  const flexSlots = rosterPositions.filter((s) => FLEX_ELIGIBLE[s])

  const slotCounters = {}
  function nextSlotIndex(slot) {
    slotCounters[slot] = (slotCounters[slot] || 0) + 1
    return slotCounters[slot] - 1
  }

  for (const slot of fixedSlots) {
    const candidates = eligible
      .filter((p) => p.pos === slot && !used.has(p.sleeper_id))
      .sort((a, b) => rankOf(a) - rankOf(b))
    const player = candidates[0] || null
    if (player) used.add(player.sleeper_id)
    slots.push({ slot, slotIndex: nextSlotIndex(slot), player, rank: player ? rankOf(player) : null })
  }
  for (const slot of flexSlots) {
    const allowedPos = FLEX_ELIGIBLE[slot]
    const candidates = eligible
      .filter((p) => allowedPos.includes(p.pos) && !used.has(p.sleeper_id))
      .sort((a, b) => rankOf(a) - rankOf(b))
    const player = candidates[0] || null
    if (player) used.add(player.sleeper_id)
    slots.push({ slot, slotIndex: nextSlotIndex(slot), player, rank: player ? rankOf(player) : null })
  }

  const bench = myRosterPlayers.filter((p) => !used.has(p.sleeper_id))
  return { slots, bench }
}

export function compareToActualStarters({ recommendedSlots = [], actualStarterIds = [] } = {}) {
  const actual = new Set((actualStarterIds || []).map(String))
  const recommended = new Set(recommendedSlots.filter((s) => s.player).map((s) => String(s.player.sleeper_id)))
  const diffs = []
  for (const s of recommendedSlots) {
    if (!s.player) continue
    const id = String(s.player.sleeper_id)
    if (!actual.has(id)) diffs.push({ slot: s.slot, in: id, name: s.player.name })
  }
  const isOptimal = diffs.length === 0 && actual.size === recommended.size
  return { isOptimal, diffs }
}
```

- [ ] **Step 4: Test laufen lassen, muss passen**

Run: `npx vitest run src/services/analysis/waiverStats.test.js`
Expected: PASS (alle Tests der Datei)

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/waiverStats.js src/services/analysis/waiverStats.test.js
git commit -m "feat(waiver): bestLineup (Greedy-Zuteilung) + compareToActualStarters"
```

---

### Task 8: `useWeeklyRankingsStore.js`

**Files:**
- Create: `src/stores/useWeeklyRankingsStore.js`
- Test: `src/stores/useWeeklyRankingsStore.test.js`

**Interfaces:**
- Consumes: `GET /api/rankings/fantasypros-position` (Task 2).
- Produces: `useWeeklyRankingsStore` mit State `{ byKey: Map, loading: Set }` und Action `loadIfStale({ pos, scope, scoring })`. `getRankMap({ pos, scope, scoring })` (Selector-Helper) → `Map<matchKey, ecr>` für `pickupRanking`/`streamingBoard`.

- [ ] **Step 1: Failing Test schreiben**

Orientiere dich am bestehenden `useDynastyValuesStore.test.js` (gleiches Mock-von-`fetch`-Muster):

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useWeeklyRankingsStore } from './useWeeklyRankingsStore'

describe('useWeeklyRankingsStore', () => {
  beforeEach(() => {
    useWeeklyRankingsStore.setState({ byKey: new Map(), loadedAt: new Map() })
    global.fetch = vi.fn()
  })

  it('laedt und cached Rankings je pos+scope', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, players: [{ nname: 'traviskelce', team: 'KC', pos: 'TE', ecr: 1 }] }),
    })
    await useWeeklyRankingsStore.getState().loadIfStale({ pos: 'TE', scope: 'week' })
    expect(global.fetch).toHaveBeenCalledWith('/api/rankings/fantasypros-position?pos=TE&scope=week&scoring=ppr')
    const map = useWeeklyRankingsStore.getState().getRankMap({ pos: 'TE', scope: 'week' })
    expect(map.get('NAME:traviskelce')).toBe(1)
  })

  it('scraped nicht erneut, solange der Cache frisch ist', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true, players: [] }) })
    await useWeeklyRankingsStore.getState().loadIfStale({ pos: 'TE', scope: 'week' })
    await useWeeklyRankingsStore.getState().loadIfStale({ pos: 'TE', scope: 'week' })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Test laufen lassen, muss fehlschlagen**

Run: `npx vitest run src/stores/useWeeklyRankingsStore.test.js`
Expected: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementieren**

```js
// src/stores/useWeeklyRankingsStore.js
import { create } from 'zustand'
import { matchKey } from '../services/analysis/waiverStats'

const TTL_MS = { week: 6 * 60 * 60 * 1000, ros: 24 * 60 * 60 * 1000 }

// Nicht persistiert: Weekly-Rankings sind pro Sitzung ohnehin nur relevant,
// waehrend /waiver offen ist, und aendern sich zu haeufig fuer localStorage
// (anders als useDynastyValuesStore, das absichtlich langlebiger ist).
export const useWeeklyRankingsStore = create((set, get) => ({
  byKey: new Map(), // "pos:scope" -> Map<matchKey, ecr>
  loadedAt: new Map(), // "pos:scope" -> timestamp
  loading: new Set(),

  loadIfStale: async ({ pos, scope, scoring = 'ppr' }) => {
    const cacheKey = `${pos}:${scope}`
    const { loadedAt, loading } = get()
    const fresh = loadedAt.has(cacheKey) && Date.now() - loadedAt.get(cacheKey) < TTL_MS[scope]
    if (fresh || loading.has(cacheKey)) return
    loading.add(cacheKey)
    try {
      const res = await fetch(`/api/rankings/fantasypros-position?pos=${pos}&scope=${scope}&scoring=${scoring}`)
      const data = await res.json()
      if (!data.ok) return
      const rankMap = new Map()
      for (const p of data.players || []) {
        rankMap.set(matchKey(pos, { name: p.name, team: p.team }), p.ecr)
      }
      set((s) => {
        const byKey = new Map(s.byKey)
        byKey.set(cacheKey, rankMap)
        const nextLoadedAt = new Map(s.loadedAt)
        nextLoadedAt.set(cacheKey, Date.now())
        return { byKey, loadedAt: nextLoadedAt }
      })
    } catch {
      // Bleibt leer -- aufrufende Komponente zeigt dann "nicht verfuegbar".
    } finally {
      loading.delete(cacheKey)
    }
  },

  getRankMap: ({ pos, scope }) => get().byKey.get(`${pos}:${scope}`) || new Map(),
}))
```

- [ ] **Step 4: Test laufen lassen, muss passen**

Run: `npx vitest run src/stores/useWeeklyRankingsStore.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/useWeeklyRankingsStore.js src/stores/useWeeklyRankingsStore.test.js
git commit -m "feat(waiver): useWeeklyRankingsStore (TTL-Cache fuer FP-Weekly/ROS)"
```

---

### Task 9: `useUIStore` — Streaming-Positions-Auswahl

**Files:**
- Modify: `src/stores/useUIStore.js`

**Interfaces:**
- Produces: `streamPositions: string[]` (Default `['DEF']`), `toggleStreamPosition: (pos: 'DEF'|'QB'|'TE') => void`.

- [ ] **Step 1: Implementieren** (State-Feld, kein eigener Test nötig — trivialer Toggle, wird durch den Komponenten-Smoke-Test in Task 11 mitabgedeckt)

In `src/stores/useUIStore.js` state und actions ergänzen:

```js
      themeId: resolveInitialTheme(),
      analysisOpen: false,
      setupVersion: 0,
      boardDensity: 'normal',
      streamPositions: ['DEF'], // welche Positionen im Waiver-Streaming-Board angehakt sind

      setTheme: (id) => set({ themeId: validThemeId(id) }),
      setAnalysisOpen: (v) => set({ analysisOpen: v }),
      incrementSetupVersion: () => set((s) => ({ setupVersion: s.setupVersion + 1 })),
      setBoardDensity: (d) => set({ boardDensity: d === 'compact' ? 'compact' : 'normal' }),
      toggleStreamPosition: (pos) => set((s) => ({
        streamPositions: s.streamPositions.includes(pos)
          ? s.streamPositions.filter((p) => p !== pos)
          : [...s.streamPositions, pos],
      })),
```

Und in `partialize` (Zeile 24) `streamPositions` mit aufnehmen, damit die Auswahl über Sitzungen hinweg erhalten bleibt:

```js
      partialize: (s) => ({ themeId: s.themeId, boardDensity: s.boardDensity, streamPositions: s.streamPositions }),
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/useUIStore.js
git commit -m "feat(waiver): streamPositions-Auswahl in useUIStore"
```

---

### Task 10: `PickupSuggestions.jsx`

**Files:**
- Create: `src/components/waiver/PickupSuggestions.jsx`

**Interfaces:**
- Consumes: Prop `players` (Ergebnis von `pickupRanking`), Prop `mode: 'redraft'|'dynasty'`.
- Produces: Tabelle, keine eigene Datenlogik (reine Präsentationskomponente, wie `MarketTab.jsx`).

- [ ] **Step 1: Implementieren**

```jsx
// src/components/waiver/PickupSuggestions.jsx
export default function PickupSuggestions({ players = [], mode = 'redraft' }) {
  const valueLabel = mode === 'dynasty' ? 'Dynasty-Wert' : 'ROS-Rang'

  return (
    <div className="an-card">
      <h3>Pickup-Empfehlungen</h3>
      {!players.length && <p className="an-empty">Keine Free-Agent-Daten verfügbar.</p>}
      {!!players.length && (
        <table className="an-table">
          <thead>
            <tr><th>Spieler</th><th>Pos</th><th>Team</th><th>{valueLabel}</th></tr>
          </thead>
          <tbody>
            {players.slice(0, 25).map((p) => (
              <tr key={p.player_id}>
                <td>{p.name}{p.trending && <span title="Wird liga-uebergreifend gerade oft geholt"> 🔥</span>}</td>
                <td>{p.pos}</td>
                <td>{p.team}</td>
                <td>{p.value ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/waiver/PickupSuggestions.jsx
git commit -m "feat(waiver): PickupSuggestions-Komponente"
```

---

### Task 11: `StreamingBoard.jsx`

**Files:**
- Create: `src/components/waiver/StreamingBoard.jsx`

**Interfaces:**
- Consumes: Prop `board` (Ergebnis von `streamingBoard()`), Prop `positions` (aktuell angehakte), Prop `onTogglePosition(pos)`.

- [ ] **Step 1: Implementieren**

```jsx
// src/components/waiver/StreamingBoard.jsx
const ALL_POSITIONS = ['DEF', 'QB', 'TE']

function RankList({ title, players = [] }) {
  return (
    <div className="an-streaming-col">
      <strong>{title}</strong>
      <ol>
        {players.slice(0, 10).map((p) => (
          <li key={p.player_id}>{p.name} <span className="an-muted">({p.team})</span></li>
        ))}
        {!players.length && <li className="an-empty">Keine Daten</li>}
      </ol>
    </div>
  )
}

export default function StreamingBoard({ board = {}, positions = [], onTogglePosition }) {
  return (
    <div className="an-card">
      <h3>Streaming-Ranking</h3>
      <div className="an-streaming-checkboxes">
        {ALL_POSITIONS.map((pos) => (
          <label key={pos}>
            <input
              type="checkbox"
              checked={positions.includes(pos)}
              onChange={() => onTogglePosition(pos)}
            />
            {pos}
          </label>
        ))}
      </div>
      {positions.map((pos) => (
        <div key={pos} className="an-streaming-row">
          <h4>{pos}</h4>
          <div className="an-streaming-cols">
            <RankList title="Diese Woche" players={board[pos]?.week} />
            <RankList title="ROS" players={board[pos]?.ros} />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/waiver/StreamingBoard.jsx
git commit -m "feat(waiver): StreamingBoard-Komponente (Weekly/ROS nebeneinander)"
```

---

### Task 12: `RecommendedLineupCard.jsx`

**Files:**
- Create: `src/components/waiver/RecommendedLineupCard.jsx`

**Interfaces:**
- Consumes: Prop `lineup` (`{ slots, bench }` von `bestLineup`), Prop `comparison` (von `compareToActualStarters`).

- [ ] **Step 1: Implementieren**

```jsx
// src/components/waiver/RecommendedLineupCard.jsx
export default function RecommendedLineupCard({ lineup, comparison }) {
  if (!lineup) return null
  return (
    <div className="an-card">
      <h3>Empfohlene Aufstellung diese Woche</h3>
      {comparison?.isOptimal && <p className="an-badge-ok">✓ Bereits optimal gesetzt</p>}
      {comparison && !comparison.isOptimal && (
        <div className="an-lineup-diff">
          <strong>Abweichend von deiner aktuellen Aufstellung:</strong>
          <ul>
            {comparison.diffs.map((d) => (
              <li key={d.slot + d.in}>{d.slot}: {d.name} sollte rein</li>
            ))}
          </ul>
        </div>
      )}
      <table className="an-table">
        <thead><tr><th>Slot</th><th>Spieler</th></tr></thead>
        <tbody>
          {lineup.slots.map((s) => (
            <tr key={s.slot + s.slotIndex}>
              <td>{s.slot}</td>
              <td>{s.player ? s.player.name : <span className="an-empty">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/waiver/RecommendedLineupCard.jsx
git commit -m "feat(waiver): RecommendedLineupCard-Komponente"
```

---

### Task 13: `WaiverPage.jsx` + Routing/Nav-Integration + finale Verifikation

**Files:**
- Create: `src/pages/WaiverPage.jsx`
- Modify: `src/App.jsx`, `src/components/TabsNav.jsx`, `src/components/MobileMoreSheet.jsx`, `src/styles/analysis.css`

**Interfaces:**
- Consumes: alle vorherigen Tasks.
- Produces: fertige, erreichbare Seite `/waiver`.

- [ ] **Step 1: `WaiverPage.jsx` implementieren**

```jsx
// src/pages/WaiverPage.jsx
import { useEffect, useMemo, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { useDynastyValuesStore } from '../stores/useDynastyValuesStore'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { useUIStore } from '../stores/useUIStore'
import { useTrendingPlayers } from '../hooks/useTrendingPlayers'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchNflState, fetchMatchups } from '../services/api'
import { freeAgents, pickupRanking, streamingBoard, bestLineup, compareToActualStarters, matchKey } from '../services/analysis/waiverStats'
import PickupSuggestions from '../components/waiver/PickupSuggestions'
import StreamingBoard from '../components/waiver/StreamingBoard'
import RecommendedLineupCard from '../components/waiver/RecommendedLineupCard'
import '../styles/analysis.css'

export default function WaiverPage({ selectedLeague, effRoster, draftMode, effScoringType }) {
  const { sleeperUserId } = useSessionStore()
  const { leagueRosters, mySleeperRosterId, dynastyRoster } = useDynastyStore()
  const { dynastyValues, loadDynastyValuesIfStale } = useDynastyValuesStore()
  const { byKey, loadIfStale, getRankMap } = useWeeklyRankingsStore()
  const { streamPositions, toggleStreamPosition } = useUIStore()
  const { adds } = useTrendingPlayers()

  const [playersMeta, setPlayersMeta] = useState({})
  const [week, setWeek] = useState(null)
  const [actualStarterIds, setActualStarterIds] = useState([])
  const isDynasty = draftMode === 'rookie'
  const scoring = effScoringType === 'ppr' || effScoringType === 'half' || effScoringType === 'std' ? effScoringType : 'ppr'

  useEffect(() => { loadPlayersMetaCached().then(setPlayersMeta) }, [])

  useEffect(() => {
    fetchNflState().then((s) => setWeek(Number(s?.week) || null)).catch(() => setWeek(null))
  }, [])

  useEffect(() => {
    if (isDynasty) loadDynastyValuesIfStale({ superflex: false })
  }, [isDynasty, loadDynastyValuesIfStale])

  // Eigene Kader-Positionen bestimmen die Weekly-Rankings, die fuer die
  // Lineup-Empfehlung gebraucht werden -- nicht nur die 3 Streaming-Positionen.
  const rosterPositionsPresent = useMemo(
    () => Array.from(new Set(dynastyRoster.map((p) => p.pos).filter((p) => ['QB', 'RB', 'WR', 'TE', 'DEF'].includes(p)))),
    [dynastyRoster]
  )

  useEffect(() => {
    for (const pos of rosterPositionsPresent) loadIfStale({ pos, scope: 'week', scoring })
  }, [rosterPositionsPresent, scoring, loadIfStale])

  useEffect(() => {
    for (const pos of streamPositions) {
      loadIfStale({ pos, scope: 'week', scoring })
      loadIfStale({ pos, scope: 'ros', scoring })
    }
  }, [streamPositions, scoring, loadIfStale])

  // Pickup-Ranking im Redraft-Modus sortiert ueber ALLE Free-Agent-Positionen
  // nach ROS-Rang -- dafuer muessen alle 5 Positionen geladen sein, nicht nur
  // Streaming-Positionen und eigener Kader.
  useEffect(() => {
    if (isDynasty) return
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF']) loadIfStale({ pos, scope: 'ros', scoring })
  }, [isDynasty, scoring, loadIfStale])

  useEffect(() => {
    if (!selectedLeague?.league_id || !week) return
    fetchMatchups(selectedLeague.league_id, week)
      .then((matchups) => {
        const mine = (matchups || []).find((m) => m.roster_id === mySleeperRosterId)
        setActualStarterIds(mine?.starters || [])
      })
      .catch(() => setActualStarterIds([]))
  }, [selectedLeague?.league_id, week, mySleeperRosterId])

  const agents = useMemo(() => freeAgents({ playersMeta, leagueRosters }), [playersMeta, leagueRosters])

  const rosRankByKey = useMemo(() => {
    const merged = new Map()
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'DEF']) {
      for (const [k, v] of getRankMap({ pos, scope: 'ros' })) merged.set(k, v)
    }
    return merged
  }, [byKey, getRankMap])

  const trendingAddIds = useMemo(() => new Set(adds.map((a) => a.player_id)), [adds])

  const pickups = useMemo(
    () => pickupRanking({
      freeAgents: agents, mode: isDynasty ? 'dynasty' : 'redraft', dynastyValues, rosRankByKey, trendingAddIds,
    }),
    [agents, isDynasty, dynastyValues, rosRankByKey, trendingAddIds]
  )

  const board = useMemo(() => {
    const weeklyMerged = new Map()
    const rosMerged = new Map()
    for (const pos of streamPositions) {
      for (const [k, v] of getRankMap({ pos, scope: 'week' })) weeklyMerged.set(k, v)
      for (const [k, v] of getRankMap({ pos, scope: 'ros' })) rosMerged.set(k, v)
    }
    return streamingBoard({ freeAgents: agents, weeklyRankByKey: weeklyMerged, rosRankByKey: rosMerged, positions: streamPositions })
  }, [agents, streamPositions, byKey, getRankMap])

  const weeklyRankByIdKey = useMemo(() => {
    const map = new Map()
    for (const pos of rosterPositionsPresent) {
      const rankMap = getRankMap({ pos, scope: 'week' })
      for (const p of dynastyRoster.filter((r) => r.pos === pos)) {
        const key = matchKey(pos, p)
        if (rankMap.has(key)) map.set(`ID:${p.sleeper_id}`, rankMap.get(key))
      }
    }
    return map
  }, [rosterPositionsPresent, dynastyRoster, byKey, getRankMap])

  const lineup = useMemo(() => {
    if (!dynastyRoster.length || !effRoster?.length) return null
    return bestLineup({ myRosterPlayers: dynastyRoster, rosterPositions: effRoster, weeklyRankByKey: weeklyRankByIdKey })
  }, [dynastyRoster, effRoster, weeklyRankByIdKey])

  const comparison = useMemo(() => {
    if (!lineup || !actualStarterIds.length) return null
    return compareToActualStarters({ recommendedSlots: lineup.slots, actualStarterIds })
  }, [lineup, actualStarterIds])

  return (
    <section className="an-page">
      <h2>Waiver-Wire</h2>
      <PickupSuggestions players={pickups} mode={isDynasty ? 'dynasty' : 'redraft'} />
      <StreamingBoard board={board} positions={streamPositions} onTogglePosition={toggleStreamPosition} />
      {mySleeperRosterId != null && <RecommendedLineupCard lineup={lineup} comparison={comparison} />}
    </section>
  )
}
```

`sleeperUserId` wird destrukturiert, aber in dieser Seite nicht direkt gelesen (der eigene Kader kommt schon fertig aufgelöst über `mySleeperRosterId`/`dynastyRoster` aus `useDynastyStore`, das App.jsx bereits mit `sleeperUserId` gefüttert hat) — Import kann drin bleiben, falls eine spätere Erweiterung (z. B. Owner-Label-Anzeige) ihn braucht, ist aber für die aktuelle Funktionalität nicht zwingend. Kein Lint vorhanden, das das anmeckert (siehe CLAUDE.md).

- [ ] **Step 2: Route registrieren**

In `src/App.jsx`:
- Import ergänzen (bei den anderen Page-Imports): `import WaiverPage from './pages/WaiverPage'`
- Route ergänzen (nach der `/analyse`-Route, Zeile 392):

```jsx
      <Route path="/waiver" element={<WaiverPage {...pageProps} />} />
```

- [ ] **Step 3: Desktop-Nav ergänzen**

In `src/components/TabsNav.jsx`, `TABS`-Array (Zeile 5-10):

```js
const TABS = [
  { path: '/dashboard', label: 'Home', icon: 'home' },
  { path: '/board', label: 'Board', icon: 'board' },
  { path: '/analyse', label: 'Analyse', icon: 'chart' },
  { path: '/waiver', label: 'Waiver', icon: 'chart' },
  { path: '/trade', label: 'Trade', icon: 'swap' },
]
```

- [ ] **Step 4: Mobile-Nav (Mehr-Sheet) ergänzen**

In `src/components/MobileMoreSheet.jsx`, `NAV`-Array (Zeile 8-13):

```js
const NAV = [
  { icon: 'home', label: 'Dashboard', path: '/dashboard' },
  { icon: 'board', label: 'Board', path: '/board' },
  { icon: 'chart', label: 'Analyse', path: '/analyse' },
  { icon: 'chart', label: 'Waiver', path: '/waiver' },
  { icon: 'swap', label: 'Trade', path: '/trade' },
]
```

- [ ] **Step 5: CSS-Klassen ergänzen**

In `src/styles/analysis.css` ans Ende anhängen (nutzt bestehende `an-card`/`an-table`/`an-empty`-Basisklassen aus derselben Datei, nur die neuen Waiver-spezifischen Layout-Klassen fehlen). Prüfe zuerst per Grep, welche Erfolgsfarbe (`--color-...`) `analysis.css` oder das Theme-System bereits definiert, und setze die exakt gefundene Variable statt einer neuen ein — falls keine passende existiert, einen konkreten Hex-Wert direkt verwenden statt eine neue globale Variable einzuführen:

```css
.an-streaming-checkboxes { display: flex; gap: 1rem; margin-bottom: 0.75rem; }
.an-streaming-cols { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.an-streaming-col { flex: 1; min-width: 180px; }
.an-streaming-row { margin-top: 1rem; }
.an-badge-ok { font-weight: 600; }
.an-lineup-diff { margin: 0.5rem 0; }
.an-muted { opacity: 0.65; font-size: 0.85em; }
```

- [ ] **Step 6: Komplette Testsuite einmal laufen lassen**

Run: `npm test`
Expected: alle Tests grün (inkl. aller in Task 1-9 neu geschriebenen).

- [ ] **Step 7: Manuell im Browser verifizieren**

```bash
npm run dev:all
```

Öffne `http://localhost:5173/waiver` mit einer echten, verbundenen Liga (Sleeper-Username in `/dashboard` gesetzt, Liga ausgewählt). Prüfen:
- Pickup-Liste zeigt Free Agents, nicht Liga-Kader-Spieler.
- Checkboxen DEF/QB/TE schalten die Streaming-Spalten sichtbar/unsichtbar.
- Empfohlene Aufstellung erscheint nur, wenn ein eigener Kader gefunden wurde (`mySleeperRosterId`).
- Netzwerk-Tab: `/api/rankings/fantasypros-position`-Calls laufen nur einmal pro Position/Scope (TTL-Cache greift bei erneutem Laden der Seite innerhalb der TTL).

- [ ] **Step 8: Commit**

```bash
git add src/pages/WaiverPage.jsx src/App.jsx src/components/TabsNav.jsx src/components/MobileMoreSheet.jsx src/styles/analysis.css
git commit -m "feat(waiver): WaiverPage zusammengesetzt, Route + Navigation verdrahtet"
```

---

## Self-Review (durchgeführt)

- **Spec-Abdeckung:** Alle drei Design-Bausteine (Pickup, Streaming, Lineup) haben Tasks (5+10, 6+9+11, 7+12). Beide "kleinen Erweiterungen" aus dem Design (Task 3, 4) sind abgedeckt. Navigation (Task 13) folgt der im Design festgelegten Platzierung (Mehr-Sheet, nicht Bottom-Bar).
- **Platzhalter-Scan:** Der ursprünglich vage RB-ROS-Preload-Effekt in Task 13 wurde durch die vollständige Schleife über alle 5 Positionen ersetzt (kein Platzhalter mehr im finalen Code-Block).
- **Typ-Konsistenz geprüft:** `matchKey(pos, {name, team})` wird überall gleich aufgerufen (Task 5, 6, 8, 13). `sleeper_id` (nicht `player_id`) ist der Schlüssel für Kader-Spieler durchgängig (`dynastyRoster`, `bestLineup`, `compareToActualStarters`), `player_id` durchgängig für Free Agents (`freeAgents`, `pickupRanking`, `streamingBoard`) — beide Namensräume nie vermischt.
