# Live-Redzone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Neue Seite `/redzone` für NFL-Spieltage: Spielleiste, Matchup-Reihe, eigene Spieler, Redzone-Alarm, Gegner live, Scoring-Ticker, filterbar nach Ligen; Einstiege erscheinen nur während laufender Spiele.

**Architecture:** Alles im Client. ESPN (`site.api.espn.com`, CORS offen) liefert Spiele/Situation/Scoring-Plays, Sleeper liefert Matchups (`players_points`) und den Spielplan (Live-Erkennung). Rohdaten landen in `useRedzoneStore` (30-s-Polling), reine Funktionen in `services/redzone/redzoneModel.js` bauen daraus die Bausteine, `RedzonePage` rendert. `useGamesLiveStore` (2-min-Polling in `App.jsx`) steuert Rail-Eintrag, Mehr-Sheet, Tabs und Dashboard-Banner.

**Tech Stack:** React 18, Zustand (+persist), Vitest + Testing Library (jsdom), lucide via `Icon.jsx`.

**Spec:** `docs/superpowers/specs/2026-09-13-live-redzone-design.md` · **Mock:** `docs/mocks/redzone-mocks.html`

## Global Constraints

- UI-Texte **deutsch** mit Umlauten; Kommentare im Stil der Umgebung (ASCII-Umschreibung ok).
- Keine Emojis als Icons (`src/components/no-emoji.test.js`), Icons nur über `Icon.jsx` (`radio` = Live-Icon).
- Farben nur über Role-Tokens; Live/Redzone immer `var(--live)`, Text darauf `var(--live-on)`. Keine Side-Stripe-Borders.
- Zahlen: `font-family: var(--font-mono)` + `font-variant-numeric: tabular-nums`.
- Kein neuer Server-Endpoint, keine neue Dependency.
- Polling: Redzone 30 s, Live-Erkennung 2 min, beides nur bei `!document.hidden`.
- ESPN-Summary nur für relevante Spiele und nur bei geändertem Spielstand/-status.
- Filter: kein "Alle"-Chip; gespeichert werden **abgewählte** Liga-IDs unter `sdh-redzone-v1` → `{ deselectedLeagueIds: string[] }`; letzte aktive Liga nicht abwählbar.
- Theme-Live-Farben: Ferrari `--live: #fff200` / `--live-on: #111111`; Nike `--live: #d14900` / `--live-on: #ffffff`; alle anderen `--live` unverändert, `--live-on: #ffffff`.
- Tests: `npm test` (Vitest einmalig). Kein Linter.
- Commits nur, wenn Dario die Commit-Kadenz freigegeben hat (Commit-Schritte sind vorbereitet).

## File Structure

| Datei | Verantwortung |
|---|---|
| `src/styles/tokens.css` (mod) | `--live-on` in allen Themes, Ferrari/Nike-`--live` |
| `src/styles/style.css` (mod) | `.badge--live`, `.bmb-badge` auf Tokens |
| `src/theme/liveTokens.test.js` (neu) | Token-Vollständigkeit |
| `src/services/redzone/espnLive.js` (neu) | ESPN-Fetch + Normalisierung |
| `src/services/redzone/redzoneModel.js` (neu) | reine Logik: Filter, Spielstatus, Matchups, Spieler, Alarm, Ticker |
| `src/services/weekProjections.js` (neu) | geteiltes Laden der Wochenprojektionen (aus `useDashboardStore` extrahiert) |
| `src/stores/useGamesLiveStore.js` (neu) | `liveCount` aus Sleeper-Spielplan |
| `src/stores/useRedzoneStore.js` (neu) | Polling, Rohdaten, Filter-Persistenz |
| `src/pages/RedzonePage.jsx` (neu) | Seite, Projektion, Layout |
| `src/components/redzone/RedzoneParts.jsx` (neu) | präsentationale Bausteine |
| `src/styles/redzone.css` (neu) | Styles Seite + Dashboard-Banner |
| `src/App.jsx`, `NextShell.jsx`, `MobileMoreSheet.jsx`, `MobileNav.jsx`, `TabsNav.jsx`, `DashboardPage.jsx`, `newshell.css` (mod) | Route, Polling, Einstiege |

---

### Task 1: Live-Farbe je Theme

**Files:**
- Modify: `src/styles/tokens.css` (jeder Theme-Block, direkt unter `--live`)
- Modify: `src/styles/style.css` (`.badge--live` ~Z. 1657, `.bmb-badge` ~Z. 2754)
- Test: `src/theme/liveTokens.test.js`

**Interfaces:**
- Produces: CSS-Tokens `--live`, `--live-on` in allen 7 Themes.

- [ ] **Step 1: Failing test** — `src/theme/liveTokens.test.js`

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { THEMES } from './themes'

const css = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8')

// Block eines Themes: vom Selektor bis zur schliessenden Klammer.
function block(id) {
  const start = css.indexOf(`[data-theme='${id}']`)
  const open = css.indexOf('{', start)
  return css.slice(open, css.indexOf('}', open))
}
const val = (b, name) => (b.match(new RegExp(`${name}:\\s*([^;]+);`)) || [])[1]?.trim()

describe('Live-Farbe je Theme', () => {
  it.each(THEMES.map((t) => t.id))('%s definiert --live und --live-on', (id) => {
    const b = block(id)
    expect(val(b, '--live')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(val(b, '--live-on')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('Themes mit rotem Akzent bekommen eine abweichende Live-Farbe', () => {
    expect(val(block('broadcast-ferrari'), '--live')).toBe('#fff200')
    expect(val(block('broadcast-ferrari'), '--live-on')).toBe('#111111')
    expect(val(block('broadcast-nike'), '--live')).toBe('#d14900')
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/theme/liveTokens.test.js`
Expected: FAIL (`--live-on` fehlt, Ferrari noch `#ff3b47`).

- [ ] **Step 3: Tokens ergänzen** — `src/styles/tokens.css`:
  - In **jedem** der 7 Theme-Blöcke direkt unter der `--live:`-Zeile: `  --live-on: #ffffff;`
  - Ferrari: `--live: #ff3b47;` → `--live: #fff200;`, dessen `--live-on` → `#111111`. Über `--live` kommentieren: `/* Akzent ist selbst Rot (8° Farbton-Abstand, gemessen 2026-09-13) -> Giallo Modena. */`
  - Nike: `--live: #d81028;` → `--live: #d14900;`. Kommentar: `/* Akzent ist Sale-Rot (6° Abstand) -> Orange, 4.5:1 auf Weiss. */`

- [ ] **Step 4: Hartcodierte Live-Farben in `src/styles/style.css`**

```css
.badge--live    { background: var(--live); color: var(--live-on); animation: pulse-badge 2s infinite; }
```
In `.bmb-badge`: `background: var(--live); color: #fff;` → `background: var(--live); color: var(--live-on);`

- [ ] **Step 5: Tests grün**

Run: `npx vitest run src/theme`
Expected: PASS (inkl. `themes.test.js`).

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/styles/style.css src/theme/liveTokens.test.js
git commit -m "feat(theme): --live-on Token, eigene Live-Farbe fuer Ferrari und Nike"
```

---

### Task 2: ESPN-Live-Client

**Files:**
- Create: `src/services/redzone/espnLive.js`
- Test: `src/services/redzone/espnLive.test.js`

**Interfaces:**
- Consumes: `fetchJson(url)` aus `src/services/api.js` (wirft `Error('HTTP <status>')`).
- Produces:
  - `normAbbr(abbr): string` (`WSH`→`WAS`, uppercase)
  - `normalizeScoreboard(json): Game[]`, `Game = { id, date, state: 'pre'|'in'|'post', detail, period, clock, home: {id, abbr, score:number}, away: {id, abbr, score}, possessionAbbr: string|null, isRedZone: boolean, downDistance: string|null, lastPlay: string|null }`
  - `normalizeScoringPlays(json): Play[]`, `Play = { id, text, teamAbbr, type, period: number|null, clockValue: number|null, clock }`
  - `fetchScoreboard({ season, week }): Promise<Game[]>`
  - `fetchScoringPlays(eventId): Promise<Play[]>`

- [ ] **Step 1: Failing test** — `src/services/redzone/espnLive.test.js` (Struktur gekürzt aus echter Antwort vom 2026-09-13)

```js
import { describe, it, expect } from 'vitest'
import { normalizeScoreboard, normalizeScoringPlays, normAbbr } from './espnLive'

const comp = (over = {}) => ({
  status: { displayClock: '6:09', period: 2, type: { state: 'in', shortDetail: '6:09 - 2nd' } },
  competitors: [
    { homeAway: 'home', score: '14', team: { id: '4', abbreviation: 'CIN' } },
    { homeAway: 'away', score: '3', team: { id: '27', abbreviation: 'TB' } },
  ],
  situation: { possession: '4', isRedZone: true, downDistanceText: '1st & Goal at TB 5', lastPlay: { text: ' J.Burrow pass short right ' } },
  ...over,
})

describe('normalizeScoreboard', () => {
  it('liest Stand, Uhr, Ballbesitz (Team-ID -> Kuerzel) und Redzone', () => {
    const [g] = normalizeScoreboard({ events: [{ id: 401872925, date: '2026-09-13T17:00Z', competitions: [comp()] }] })
    expect(g).toEqual({
      id: '401872925', date: '2026-09-13T17:00Z', state: 'in', detail: '6:09 - 2nd', period: 2, clock: '6:09',
      home: { id: '4', abbr: 'CIN', score: 14 }, away: { id: '27', abbr: 'TB', score: 3 },
      possessionAbbr: 'CIN', isRedZone: true, downDistance: '1st & Goal at TB 5', lastPlay: 'J.Burrow pass short right',
    })
  })

  it('normalisiert WSH auf Sleepers WAS und kommt ohne situation aus', () => {
    const c = comp({ situation: undefined, competitors: [
      { homeAway: 'home', score: '0', team: { id: '28', abbreviation: 'WSH' } },
      { homeAway: 'away', score: '0', team: { id: '21', abbreviation: 'PHI' } },
    ] })
    const [g] = normalizeScoreboard({ events: [{ id: '1', competitions: [c] }] })
    expect(g.home.abbr).toBe('WAS')
    expect(g.possessionAbbr).toBeNull()
    expect(g.isRedZone).toBe(false)
    expect(g.lastPlay).toBeNull()
  })

  it('liefert [] bei kaputter Antwort', () => {
    expect(normalizeScoreboard(null)).toEqual([])
    expect(normAbbr('wsh')).toBe('WAS')
  })
})

describe('normalizeScoringPlays', () => {
  it('liest Text, Team, Typ, Viertel und Uhr', () => {
    const plays = normalizeScoringPlays({ scoringPlays: [{
      id: '401872925861', text: 'Mike Gesicki 2 Yd pass from Joe Burrow (Evan McPherson Kick)',
      type: { abbreviation: 'TD' }, team: { id: '4', abbreviation: 'CIN' },
      period: { number: 1 }, clock: { value: 108, displayValue: '1:48' },
    }] })
    expect(plays).toEqual([{
      id: '401872925861', text: 'Mike Gesicki 2 Yd pass from Joe Burrow (Evan McPherson Kick)',
      teamAbbr: 'CIN', type: 'TD', period: 1, clockValue: 108, clock: '1:48',
    }])
    expect(normalizeScoringPlays({})).toEqual([])
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/services/redzone/espnLive.test.js`
Expected: FAIL ("Failed to resolve import ./espnLive").

- [ ] **Step 3: Implementierung** — `src/services/redzone/espnLive.js`

```js
// ESPN-Live-Daten fuer die Redzone. site.api.espn.com sendet
// access-control-allow-origin: * (verifiziert 2026-09-13) -> direkt aus dem
// Browser/Capacitor, kein Server-Proxy. Inoffizielle API: defensiv lesen.
import { fetchJson } from '../api'

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

// Einzige bekannte Kuerzel-Abweichung ESPN vs. Sleeper (vgl. server/rankings.js).
const TEAM_ALIAS = { WSH: 'WAS' }

export function normAbbr(abbr) {
  const u = String(abbr || '').toUpperCase()
  return TEAM_ALIAS[u] || u
}

export function normalizeScoreboard(json) {
  const events = Array.isArray(json?.events) ? json.events : []
  return events.map((ev) => {
    const comp = ev?.competitions?.[0] || {}
    const side = (homeAway) => {
      const c = (comp.competitors || []).find((t) => t.homeAway === homeAway) || {}
      return { id: String(c.team?.id ?? ''), abbr: normAbbr(c.team?.abbreviation), score: Number(c.score) || 0 }
    }
    const home = side('home')
    const away = side('away')
    const sit = comp.situation || {}
    // possession ist eine Team-ID, kein Kuerzel.
    const possId = sit.possession != null ? String(sit.possession) : null
    const possessionAbbr = possId && possId === home.id ? home.abbr : possId && possId === away.id ? away.abbr : null
    const status = comp.status || ev?.status || {}
    return {
      id: String(ev?.id ?? ''),
      date: ev?.date || null,
      state: status.type?.state || 'pre',
      detail: status.type?.shortDetail || '',
      period: status.period ?? null,
      clock: status.displayClock || '',
      home,
      away,
      possessionAbbr,
      isRedZone: !!sit.isRedZone,
      downDistance: sit.downDistanceText || null,
      lastPlay: sit.lastPlay?.text?.trim() || null,
    }
  })
}

export function normalizeScoringPlays(json) {
  const plays = Array.isArray(json?.scoringPlays) ? json.scoringPlays : []
  return plays.map((p) => ({
    id: String(p.id),
    text: String(p.text || '').trim(),
    teamAbbr: normAbbr(p.team?.abbreviation),
    type: p.type?.abbreviation || '',
    period: p.period?.number ?? null,
    clockValue: p.clock?.value ?? null,
    clock: p.clock?.displayValue || '',
  }))
}

export async function fetchScoreboard({ season, week }) {
  return normalizeScoreboard(await fetchJson(`${ESPN_BASE}/scoreboard?seasontype=2&week=${week}&dates=${season}`))
}

export async function fetchScoringPlays(eventId) {
  return normalizeScoringPlays(await fetchJson(`${ESPN_BASE}/summary?event=${encodeURIComponent(eventId)}`))
}
```

- [ ] **Step 4: Tests grün**

Run: `npx vitest run src/services/redzone/espnLive.test.js`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/redzone/espnLive.js src/services/redzone/espnLive.test.js
git commit -m "feat(redzone): ESPN-Live-Client fuer Scoreboard und Scoring-Plays"
```

---

### Task 3: Redzone-Modell I — Filter und Spielstatus

**Files:**
- Create: `src/services/redzone/redzoneModel.js`
- Test: `src/services/redzone/redzoneModel.test.js`

**Interfaces:**
- Consumes: `Game` aus Task 2.
- Produces:
  - `selectedLeagueIds(allIds: string[], deselectedIds: string[]): string[]`
  - `toggleLeague(allIds, deselectedIds, id): string[]` (neue Abwahl-Liste)
  - `soloLeague(allIds, deselectedIds, id): string[]`
  - `gamesByTeam(games): Record<abbr, Game>`
  - `carryPossession(prevGames, games): Game[]`
  - `playerTeam(meta, playerId): string` (uppercase; DEF → player_id)
  - `playerGameState(meta, byTeam): 'pre'|'in'|'post'|'none'`

- [ ] **Step 1: Failing test** — `src/services/redzone/redzoneModel.test.js`

```js
import { describe, it, expect } from 'vitest'
import {
  selectedLeagueIds, toggleLeague, soloLeague,
  gamesByTeam, carryPossession, playerGameState, playerTeam,
} from './redzoneModel'

const ALL = ['A', 'B', 'C']

describe('Liga-Filter', () => {
  it('ohne Abwahl sind alle Ligen aktiv', () => {
    expect(selectedLeagueIds(ALL, [])).toEqual(ALL)
  })
  it('abgewaehlte Ligen fallen raus; alles abgewaehlt zaehlt als alle', () => {
    expect(selectedLeagueIds(ALL, ['B'])).toEqual(['A', 'C'])
    expect(selectedLeagueIds(ALL, ['A', 'B', 'C'])).toEqual(ALL)
  })
  it('toggle waehlt ab und wieder an; die letzte Liga bleibt an', () => {
    expect(toggleLeague(ALL, [], 'B')).toEqual(['B'])
    expect(toggleLeague(ALL, ['B'], 'B')).toEqual([])
    expect(toggleLeague(ALL, ['A', 'B'], 'C')).toEqual(['A', 'B'])
  })
  it('toggle raeumt IDs verschwundener Ligen weg', () => {
    expect(toggleLeague(ALL, ['OLD'], 'A')).toEqual(['A'])
  })
  it('solo = nur diese Liga, nochmal = wieder alle', () => {
    expect(soloLeague(ALL, [], 'B')).toEqual(['A', 'C'])
    expect(soloLeague(ALL, ['A', 'C'], 'B')).toEqual([])
  })
  it('neue Ligen sind automatisch aktiv', () => {
    expect(selectedLeagueIds([...ALL, 'D'], ['B'])).toEqual(['A', 'C', 'D'])
  })
})

const game = (id, home, away, over = {}) => ({
  id, state: 'in', home: { abbr: home, score: 0 }, away: { abbr: away, score: 0 },
  possessionAbbr: null, isRedZone: false, ...over,
})

describe('Spielstatus', () => {
  const byTeam = gamesByTeam([game('1', 'CIN', 'TB'), game('2', 'GB', 'MIN', { state: 'pre' })])

  it('ordnet beide Teams ihrem Spiel zu', () => {
    expect(byTeam.CIN.id).toBe('1')
    expect(byTeam.TB.id).toBe('1')
  })
  it('liest den Status ueber das Team, DEF ueber die player_id', () => {
    expect(playerGameState({ team: 'CIN' }, byTeam)).toBe('in')
    expect(playerGameState({ team: 'MIN' }, byTeam)).toBe('pre')
    expect(playerGameState({ team: 'KC' }, byTeam)).toBe('none')
    expect(playerGameState(null, byTeam)).toBe('none')
    expect(playerTeam({ position: 'DEF', team: null }, 'cin')).toBe('CIN')
  })
  it('behaelt den letzten Ballbesitz, wenn ESPN ihn in Timeouts leert', () => {
    const prev = [game('1', 'CIN', 'TB', { possessionAbbr: 'CIN', isRedZone: true })]
    expect(carryPossession(prev, [game('1', 'CIN', 'TB', { isRedZone: true })])[0].possessionAbbr).toBe('CIN')
    expect(carryPossession(prev, [game('1', 'CIN', 'TB', { state: 'post' })])[0].possessionAbbr).toBeNull()
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/services/redzone/redzoneModel.test.js`
Expected: FAIL ("Failed to resolve import ./redzoneModel").

- [ ] **Step 3: Implementierung** — `src/services/redzone/redzoneModel.js`

```js
// Reine Redzone-Logik: aus Rohdaten (ESPN-Spiele, Sleeper-Matchups/Rosters/
// Users, playersMeta) die Bausteine der Seite bauen. Kein Fetch, kein Store.

// ── Liga-Filter ─────────────────────────────────────────────────────────────
// Gespeichert werden ABGEWAEHLTE IDs, damit neue Ligen automatisch aktiv sind.

export function selectedLeagueIds(allIds, deselectedIds = []) {
  const off = new Set(deselectedIds)
  const on = allIds.filter((id) => !off.has(id))
  return on.length ? on : allIds
}

export function toggleLeague(allIds, deselectedIds = [], id) {
  const known = deselectedIds.filter((x) => allIds.includes(x))
  const on = selectedLeagueIds(allIds, known)
  if (!on.includes(id)) return known.filter((x) => x !== id)
  if (on.length === 1) return known // letzte aktive Liga bleibt an
  return [...known, id]
}

export function soloLeague(allIds, deselectedIds = [], id) {
  const on = selectedLeagueIds(allIds, deselectedIds)
  if (on.length === 1 && on[0] === id) return []
  return allIds.filter((x) => x !== id)
}

// ── Spiele ──────────────────────────────────────────────────────────────────

export function gamesByTeam(games = []) {
  const out = {}
  for (const g of games) {
    out[g.home.abbr] = g
    out[g.away.abbr] = g
  }
  return out
}

// ESPN leert situation.possession in Timeouts, isRedZone bleibt aber true ->
// ohne Uebernahme wuerde der Alarm bei jeder Auszeit flackern.
export function carryPossession(prevGames = [], games = []) {
  const prev = new Map(prevGames.map((g) => [g.id, g]))
  return games.map((g) =>
    g.possessionAbbr || g.state !== 'in' ? g : { ...g, possessionAbbr: prev.get(g.id)?.possessionAbbr ?? null }
  )
}

// DEF-Eintraege in Sleeper: player_id ist das Team-Kuerzel.
export function playerTeam(meta, playerId) {
  return String(meta?.team || (meta?.position === 'DEF' ? playerId : '') || '').toUpperCase()
}

export function playerGameState(meta, byTeam) {
  const team = playerTeam(meta, meta?.player_id)
  return (team && byTeam[team]?.state) || 'none'
}
```

- [ ] **Step 4: Tests grün**

Run: `npx vitest run src/services/redzone/redzoneModel.test.js`
Expected: PASS (9 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/redzone/redzoneModel.js src/services/redzone/redzoneModel.test.js
git commit -m "feat(redzone): Liga-Filter und Spielstatus als reine Funktionen"
```

---

### Task 4: Redzone-Modell II — Matchups und Spieler

**Files:**
- Modify: `src/services/redzone/redzoneModel.js` (anhängen)
- Test: `src/services/redzone/redzoneModel.test.js` (anhängen)

**Interfaces:**
- Consumes: `gamesByTeam`, `playerGameState`, `playerTeam` (Task 3); `computeMatchupProbability` aus `src/services/analysis/matchupProbability.js`.
- Produces (`LeagueData = { league: {league_id, name, avatar}, matchups, rosters, users, error? }`, `projectPlayer(league, playerId) => number|null`):
  - `buildMatchupTiles({ leagueData, myUserId, byTeam, playersMeta, projectPlayer }): Tile[]`, `Tile = { leagueId, leagueName, leagueAvatar, myPoints, opponentPoints, opponentName, myWinPct, hasProjection, myOpen, oppOpen }` oder `{ leagueId, leagueName, error }`; sortiert: Siegchance am nächsten an 50 zuerst, Fehler-Kacheln zuletzt.
  - `buildPlayers({ leagueData, myUserId, byTeam, playersMeta, projectPlayer }): { mine: Entry[], opponents: Entry[] }`, `Entry = { playerId, name, pos, team, state, game, points, projected, leagues: [{leagueId, leagueName}] }`; sortiert `in` → `pre` → `post` → `none`, dann Punkte absteigend.
  - `relevantTeams({ leagueData, myUserId, playersMeta }): Set<abbr>`
  - `countsByGame(games, { mine, opponents }): Record<gameId, {mine:number, opp:number}>`

- [ ] **Step 1: Failing tests anhängen** — ans Ende von `src/services/redzone/redzoneModel.test.js` (Imports oben ergänzen: `buildMatchupTiles, buildPlayers, relevantTeams, countsByGame`)

```js
const META = {
  P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB', fantasy_positions: ['QB'] },
  P2: { player_id: 'P2', full_name: "Ja'Marr Chase", team: 'CIN', position: 'WR', fantasy_positions: ['WR'] },
  P3: { player_id: 'P3', full_name: 'Mike Gesicki', team: 'CIN', position: 'TE', fantasy_positions: ['TE'] },
  P4: { player_id: 'P4', full_name: 'Josh Allen', team: 'BUF', position: 'QB', fantasy_positions: ['QB'] },
}
const GAMES = [game('g1', 'CIN', 'TB'), game('g2', 'HOU', 'BUF', { state: 'pre' })]
const BY_TEAM = gamesByTeam(GAMES)
const L1 = {
  league: { league_id: 'L1', name: 'Büro-Liga', avatar: null },
  rosters: [{ roster_id: 1, owner_id: 'me' }, { roster_id: 2, owner_id: 'u2' }],
  users: [{ user_id: 'u2', display_name: 'Kevin' }],
  matchups: [
    { roster_id: 1, matchup_id: 5, points: 48.3, starters: ['P1', 'P2'], players_points: { P1: 14.6, P2: 9.4 } },
    { roster_id: 2, matchup_id: 5, points: 61.9, starters: ['P3', '0'], players_points: { P3: 9.2 } },
  ],
}
const L2 = {
  league: { league_id: 'L2', name: 'Dynasty Bros', avatar: 'abc' },
  rosters: [{ roster_id: 7, owner_id: 'me' }, { roster_id: 8, owner_id: 'u8' }],
  users: [],
  matchups: [
    { roster_id: 7, matchup_id: 1, points: 50, starters: ['P1'], players_points: { P1: 16.1 } },
    { roster_id: 8, matchup_id: 1, points: 50, starters: ['P4'], players_points: { P4: 0 } },
  ],
}
const noProj = () => null
const base = { myUserId: 'me', byTeam: BY_TEAM, playersMeta: META, projectPlayer: noProj }

describe('buildMatchupTiles', () => {
  it('liefert Stand, Gegner, offene Starter und Punkteanteil ohne Projektion', () => {
    const [tile] = buildMatchupTiles({ ...base, leagueData: [L1] })
    expect(tile).toEqual({
      leagueId: 'L1', leagueName: 'Büro-Liga', leagueAvatar: null,
      myPoints: 48.3, opponentPoints: 61.9, opponentName: 'Kevin',
      myWinPct: 44, hasProjection: false, myOpen: 2, oppOpen: 1,
    })
  })
  it('nutzt die Siegchance, sobald beide Seiten Projektionen haben', () => {
    const [tile] = buildMatchupTiles({ ...base, leagueData: [L1], projectPlayer: () => 20 })
    expect(tile.hasProjection).toBe(true)
    expect(tile.myWinPct).toBeGreaterThanOrEqual(1)
    expect(tile.myWinPct).toBeLessThanOrEqual(99)
  })
  it('sortiert knappste Partie zuerst, Fehler zuletzt, Ligen ohne eigenes Team fallen raus', () => {
    const foreign = { ...L1, league: { league_id: 'L3', name: 'Fremd' }, rosters: [{ roster_id: 1, owner_id: 'x' }] }
    const broken = { league: { league_id: 'L4', name: 'Kaputt' }, error: 'HTTP 500' }
    const tiles = buildMatchupTiles({ ...base, leagueData: [broken, L1, L2, foreign] })
    expect(tiles.map((t) => t.leagueId)).toEqual(['L2', 'L1', 'L4'])
    expect(tiles[2]).toEqual({ leagueId: 'L4', leagueName: 'Kaputt', error: 'HTTP 500' })
  })
})

describe('buildPlayers', () => {
  const { mine, opponents } = buildPlayers({ ...base, leagueData: [L1, L2] })
  it('buendelt eigene Spieler ueber Ligen und nimmt die hoechsten Punkte', () => {
    const burrow = mine.find((p) => p.playerId === 'P1')
    expect(burrow.leagues.map((l) => l.leagueId)).toEqual(['L1', 'L2'])
    expect(burrow.points).toBe(16.1)
    expect(burrow.state).toBe('in')
    expect(burrow.game.id).toBe('g1')
  })
  it('listet Gegner-Starter getrennt und ignoriert leere Slots', () => {
    expect(opponents.map((p) => p.playerId).sort()).toEqual(['P3', 'P4'])
  })
  it('sortiert laufende Spiele vor anstehenden', () => {
    expect(opponents.map((p) => p.state)).toEqual(['in', 'pre'])
  })
})

describe('relevantTeams / countsByGame', () => {
  it('sammelt Teams aller eigenen und gegnerischen Starter', () => {
    expect([...relevantTeams({ leagueData: [L1, L2], myUserId: 'me', playersMeta: META })].sort()).toEqual(['BUF', 'CIN'])
  })
  it('zaehlt meine und gegnerische Starter je Spiel', () => {
    const players = buildPlayers({ ...base, leagueData: [L1, L2] })
    expect(countsByGame(GAMES, players)).toEqual({ g1: { mine: 2, opp: 1 }, g2: { mine: 0, opp: 1 } })
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/services/redzone/redzoneModel.test.js`
Expected: FAIL ("buildMatchupTiles is not a function" bzw. Import-Fehler).

- [ ] **Step 3: Implementierung anhängen** — oben in `redzoneModel.js` den Import ergänzen und ans Ende anhängen:

```js
import { computeMatchupProbability } from '../analysis/matchupProbability'
```

```js
// ── Matchups & Spieler ──────────────────────────────────────────────────────

const STATE_ORDER = { in: 0, pre: 1, post: 2, none: 3 }
const starterIds = (m) => (m?.starters || []).filter((id) => id && id !== '0')

// Mein Matchup-Eintrag + Gegner einer Liga; null, wenn ich dort kein Team habe.
function leagueView({ matchups = [], rosters = [], users = [] }, myUserId) {
  const myRoster = rosters.find((r) => String(r.owner_id) === String(myUserId))
  const mine = myRoster && matchups.find((m) => m.roster_id === myRoster.roster_id)
  if (!mine) return null
  const opp = matchups.find(
    (m) => m.matchup_id != null && m.matchup_id === mine.matchup_id && m.roster_id !== mine.roster_id
  ) || null
  const oppRoster = opp && rosters.find((r) => r.roster_id === opp.roster_id)
  const oppUser = oppRoster && users.find((u) => String(u.user_id) === String(oppRoster.owner_id))
  const opponentName = oppUser?.display_name || oppUser?.username || (opp ? `Team ${opp.roster_id}` : null)
  return { mine, opp, opponentName }
}

export function buildMatchupTiles({ leagueData = [], myUserId, byTeam, playersMeta, projectPlayer }) {
  const tiles = []
  const errors = []
  for (const d of leagueData) {
    if (d.error) {
      errors.push({ leagueId: d.league.league_id, leagueName: d.league.name, error: d.error })
      continue
    }
    const v = leagueView(d, myUserId)
    if (!v) continue
    const open = (m) => starterIds(m).filter((id) => ['pre', 'in'].includes(playerGameState(playersMeta[id], byTeam))).length
    const projTotal = (m) => {
      let sum = 0
      let any = false
      for (const id of starterIds(m)) {
        const p = projectPlayer(d.league, id)
        if (p != null) { sum += p; any = true }
      }
      return any ? sum : null
    }
    const myPoints = v.mine.points || 0
    const opponentPoints = v.opp?.points || 0
    const prob = v.opp
      ? computeMatchupProbability({ myPoints, myProjected: projTotal(v.mine), opponentPoints, opponentProjected: projTotal(v.opp) })
      : null
    const total = myPoints + opponentPoints
    tiles.push({
      leagueId: d.league.league_id,
      leagueName: d.league.name,
      leagueAvatar: d.league.avatar ?? null,
      myPoints,
      opponentPoints,
      opponentName: v.opponentName,
      myWinPct: prob ? prob.myWinPct : total > 0 ? Math.round((myPoints / total) * 100) : 50,
      hasProjection: !!prob,
      myOpen: open(v.mine),
      oppOpen: v.opp ? open(v.opp) : 0,
    })
  }
  tiles.sort((a, b) => Math.abs(a.myWinPct - 50) - Math.abs(b.myWinPct - 50))
  return [...tiles, ...errors]
}

export function buildPlayers({ leagueData = [], myUserId, byTeam, playersMeta, projectPlayer }) {
  const mine = new Map()
  const opponents = new Map()
  const add = (map, id, d, matchup) => {
    const meta = playersMeta[id]
    if (!meta) return
    const team = playerTeam(meta, id)
    const e = map.get(id) || {
      playerId: id,
      name: meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || id,
      pos: String(meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
      team,
      state: (team && byTeam[team]?.state) || 'none',
      game: (team && byTeam[team]) || null,
      points: null,
      projected: null,
      leagues: [],
    }
    // ponytail: Punkte/Projektion unterscheiden sich je Liga-Scoring; gezeigt wird der
    // hoechste Wert. Pro-Liga-Aufschluesselung erst, wenn es jemand vermisst.
    const pts = matchup.players_points?.[id]
    if (pts != null) e.points = Math.max(e.points ?? -Infinity, pts)
    const proj = projectPlayer(d.league, id)
    if (proj != null) e.projected = Math.max(e.projected ?? -Infinity, proj)
    e.leagues.push({ leagueId: d.league.league_id, leagueName: d.league.name })
    map.set(id, e)
  }
  for (const d of leagueData) {
    if (d.error) continue
    const v = leagueView(d, myUserId)
    if (!v) continue
    for (const id of starterIds(v.mine)) add(mine, id, d, v.mine)
    if (v.opp) for (const id of starterIds(v.opp)) add(opponents, id, d, v.opp)
  }
  const sort = (list) => list.sort((a, b) =>
    STATE_ORDER[a.state] - STATE_ORDER[b.state] || (b.points ?? 0) - (a.points ?? 0))
  return { mine: sort([...mine.values()]), opponents: sort([...opponents.values()]) }
}

export function relevantTeams({ leagueData = [], myUserId, playersMeta }) {
  const teams = new Set()
  for (const d of leagueData) {
    if (d.error) continue
    const v = leagueView(d, myUserId)
    if (!v) continue
    for (const id of [...starterIds(v.mine), ...starterIds(v.opp)]) {
      const team = playerTeam(playersMeta[id], id)
      if (team) teams.add(team)
    }
  }
  return teams
}

export function countsByGame(games = [], { mine = [], opponents = [] }) {
  const out = {}
  for (const g of games) {
    const inGame = (p) => p.team === g.home.abbr || p.team === g.away.abbr
    out[g.id] = { mine: mine.filter(inGame).length, opp: opponents.filter(inGame).length }
  }
  return out
}
```

- [ ] **Step 4: Tests grün**

Run: `npx vitest run src/services/redzone/redzoneModel.test.js`
Expected: PASS (17 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/redzone/redzoneModel.js src/services/redzone/redzoneModel.test.js
git commit -m "feat(redzone): Matchup-Kacheln und ligauebergreifende Spielerliste"
```

---

### Task 5: Redzone-Modell III — Alarm und Scoring-Ticker

**Files:**
- Modify: `src/services/redzone/redzoneModel.js` (anhängen)
- Test: `src/services/redzone/redzoneModel.test.js` (anhängen)

**Interfaces:**
- Consumes: `Game`, `Play` (Task 2), `Entry` (Task 4).
- Produces:
  - `buildRedzoneAlerts({ games, mine, opponents }): { game, mine: Entry[], opponents: Entry[] }[]`
  - `matchScoringPlay(play, candidates: Entry[]): Entry[]`
  - `buildTicker({ scoringPlaysByEvent, mine, opponents, newPlayIds }): { play, mine, opponents, isNew }[]` (neueste zuerst)

- [ ] **Step 1: Failing tests anhängen** (Imports ergänzen: `buildRedzoneAlerts, matchScoringPlay, buildTicker`)

```js
const entry = (playerId, name, team, pos = 'WR') => ({ playerId, name, team, pos, state: 'in', leagues: [] })

describe('buildRedzoneAlerts', () => {
  const mine = [entry('P1', 'Joe Burrow', 'CIN', 'QB'), entry('P4', 'Josh Allen', 'BUF', 'QB')]
  const opponents = [entry('P3', 'Mike Gesicki', 'CIN', 'TE')]

  it('meldet Redzone-Spiele, in denen das Team mit Ballbesitz beteiligte Starter hat', () => {
    const g = game('g1', 'CIN', 'TB', { isRedZone: true, possessionAbbr: 'CIN' })
    const [alert] = buildRedzoneAlerts({ games: [g], mine, opponents })
    expect(alert.game.id).toBe('g1')
    expect(alert.mine.map((p) => p.playerId)).toEqual(['P1'])
    expect(alert.opponents.map((p) => p.playerId)).toEqual(['P3'])
  })
  it('ignoriert Redzone ohne Beteiligte, ohne Ballbesitz oder ausserhalb laufender Spiele', () => {
    const games = [
      game('a', 'TB', 'CIN', { isRedZone: true, possessionAbbr: 'TB' }),
      game('b', 'CIN', 'TB', { isRedZone: true, possessionAbbr: null }),
      game('c', 'CIN', 'TB', { isRedZone: true, possessionAbbr: 'CIN', state: 'post' }),
    ]
    expect(buildRedzoneAlerts({ games, mine, opponents })).toEqual([])
  })
})

describe('matchScoringPlay', () => {
  const play = (text, teamAbbr) => ({ id: text, text, teamAbbr, type: 'TD', period: 1, clockValue: 100 })

  it('findet Passer und Receiver im Text, beschraenkt aufs punktende Team', () => {
    const cands = [entry('P1', 'Joe Burrow', 'CIN'), entry('P3', 'Mike Gesicki', 'CIN'), entry('X', 'Ja\'Marr Chase', 'CIN')]
    const hits = matchScoringPlay(play('Mike Gesicki 2 Yd pass from Joe Burrow (Evan McPherson Kick)', 'CIN'), cands)
    expect(hits.map((p) => p.playerId)).toEqual(['P1', 'P3'])
  })
  it('gleicher Name in anderem Team ist kein Treffer, DEF trifft bei Defensiv-TD', () => {
    const cands = [entry('P4', 'Josh Allen', 'BUF', 'QB'), entry('JAX', 'Jacksonville Jaguars', 'JAX', 'DEF')]
    const hits = matchScoringPlay(play('Josh Allen 20 Yd Fumble Return (Cam Little Kick)', 'JAX'), cands)
    expect(hits.map((p) => p.playerId)).toEqual(['JAX'])
  })
  it('DEF trifft nicht bei normalem Offensiv-TD', () => {
    const cands = [entry('DET', 'Detroit Lions', 'DET', 'DEF')]
    expect(matchScoringPlay(play('Jahmyr Gibbs 1 Yd Rush (Jake Bates Kick)', 'DET'), cands)).toEqual([])
  })
})

describe('buildTicker', () => {
  it('liefert nur Plays mit Beteiligten, neueste zuerst, markiert neue', () => {
    const mine = [entry('P1', 'Joe Burrow', 'CIN'), entry('G', 'Jahmyr Gibbs', 'DET', 'RB')]
    const scoringPlaysByEvent = {
      g1: [
        { id: 'a', text: 'Chase McLaughlin 34 Yd Field Goal', teamAbbr: 'TB', period: 1, clockValue: 549 },
        { id: 'b', text: 'Mike Gesicki 2 Yd pass from Joe Burrow', teamAbbr: 'CIN', period: 1, clockValue: 108 },
      ],
      g2: [{ id: 'c', text: 'Jahmyr Gibbs 1 Yd Rush', teamAbbr: 'DET', period: 1, clockValue: 219 }],
    }
    const items = buildTicker({ scoringPlaysByEvent, mine, opponents: [], newPlayIds: ['b'] })
    expect(items.map((i) => i.play.id)).toEqual(['b', 'c'])
    expect(items[0].isNew).toBe(true)
    expect(items[1].mine.map((p) => p.playerId)).toEqual(['G'])
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/services/redzone/redzoneModel.test.js`
Expected: FAIL ("buildRedzoneAlerts is not a function").

- [ ] **Step 3: Implementierung anhängen** — ans Ende von `redzoneModel.js`

```js
// ── Redzone-Alarm & Scoring ─────────────────────────────────────────────────

export function buildRedzoneAlerts({ games = [], mine = [], opponents = [] }) {
  return games
    .filter((g) => g.state === 'in' && g.isRedZone && g.possessionAbbr)
    .map((g) => ({
      game: g,
      mine: mine.filter((p) => p.team === g.possessionAbbr),
      opponents: opponents.filter((p) => p.team === g.possessionAbbr),
    }))
    .filter((a) => a.mine.length || a.opponents.length)
}

// Defensiv-/Special-Teams-Scores, die in Sleeper der DEF gutgeschrieben werden.
const DEF_SCORE = /(interception return|fumble return|blocked|safety|punt return|kickoff return)/i

// ESPN-Scoring-Plays tragen keine Spieler-IDs -> Namensabgleich, streng aufs
// punktende Team begrenzt. Lieber ein Play auslassen als falsch zuordnen.
export function matchScoringPlay(play, candidates = []) {
  const text = String(play.text || '').toLowerCase()
  return candidates.filter((p) => {
    if (p.team !== play.teamAbbr) return false
    if (p.pos === 'DEF') return DEF_SCORE.test(play.text)
    return !!p.name && text.includes(p.name.toLowerCase())
  })
}

export function buildTicker({ scoringPlaysByEvent = {}, mine = [], opponents = [], newPlayIds = [] }) {
  const fresh = new Set(newPlayIds)
  const items = []
  for (const plays of Object.values(scoringPlaysByEvent)) {
    for (const play of plays) {
      const m = matchScoringPlay(play, mine)
      const o = matchScoringPlay(play, opponents)
      if (m.length || o.length) items.push({ play, mine: m, opponents: o, isNew: fresh.has(play.id) })
    }
  }
  // ponytail: Reihenfolge ueber Viertel + Restzeit, nicht Echtzeit -- parallel
  // laufende Spiele sind so nur ungefaehr chronologisch. Reicht fuer einen Ticker.
  return items.sort((a, b) =>
    (b.play.period ?? 0) - (a.play.period ?? 0) || (a.play.clockValue ?? 0) - (b.play.clockValue ?? 0))
}
```

- [ ] **Step 4: Tests grün**

Run: `npx vitest run src/services/redzone/redzoneModel.test.js`
Expected: PASS (23 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/redzone/redzoneModel.js src/services/redzone/redzoneModel.test.js
git commit -m "feat(redzone): Redzone-Alarm und Scoring-Ticker mit Namensabgleich"
```

---

### Task 6: Wochenprojektionen teilen (Dashboard + Redzone)

`useDashboardStore` lädt Sleeper- + FantasyPros-Wochenprojektionen inline. Die Redzone braucht exakt dasselbe → in ein Service-Modul ziehen, Dashboard darauf umstellen (Verhalten unverändert).

**Files:**
- Create: `src/services/weekProjections.js`
- Test: `src/services/weekProjections.test.js`
- Modify: `src/stores/useDashboardStore.js` (Konstanten `FP_WEEK_POSITIONS`/`FP_SCORING_FOR_TYPE`, `detectScoringType`, Lade- und Merge-Block in `loadDashboard`)

**Interfaces:**
- Consumes: `useWeeklyRankingsStore.getState()` → `loadSleeperWeekIfStale({season, week})`, `loadFpWeekPtsIfStale({pos, scoring})`, `getFpWeekPtsMap({pos, scoring})`, `sleeperWeekById`.
- Produces:
  - `detectScoringType(league): 'ppr'|'half_ppr'|'standard'`
  - `loadWeekProjections({ season, week, scoringTypes: Iterable<string> }): Promise<void>`
  - `fpPtsMapFor(scoringType): Map<matchKey, number>`

- [ ] **Step 1: Failing test** — `src/services/weekProjections.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

const store = {
  loadSleeperWeekIfStale: vi.fn(() => Promise.resolve()),
  loadFpWeekPtsIfStale: vi.fn(() => Promise.resolve()),
  getFpWeekPtsMap: vi.fn(({ pos, scoring }) => new Map([[`${pos}-key`, scoring === 'half' ? 5 : 1]])),
}
vi.mock('../stores/useWeeklyRankingsStore', () => ({ useWeeklyRankingsStore: { getState: () => store } }))

import { detectScoringType, loadWeekProjections, fpPtsMapFor } from './weekProjections'

beforeEach(() => vi.clearAllMocks())

describe('weekProjections', () => {
  it('erkennt das Scoring an scoring_settings.rec', () => {
    expect(detectScoringType({ scoring_settings: { rec: 1 } })).toBe('ppr')
    expect(detectScoringType({ scoring_settings: { rec: 0.5 } })).toBe('half_ppr')
    expect(detectScoringType({ scoring_settings: { rec: 0 } })).toBe('standard')
    expect(detectScoringType({})).toBe('ppr')
  })
  it('laedt Sleeper einmal und FantasyPros je Position und Scoring', async () => {
    await loadWeekProjections({ season: '2026', week: 1, scoringTypes: new Set(['ppr', 'half_ppr']) })
    expect(store.loadSleeperWeekIfStale).toHaveBeenCalledWith({ season: '2026', week: 1 })
    expect(store.loadFpWeekPtsIfStale).toHaveBeenCalledTimes(10)
    expect(store.loadFpWeekPtsIfStale).toHaveBeenCalledWith({ pos: 'DEF', scoring: 'half' })
  })
  it('schluckt Ladefehler einzelner Quellen', async () => {
    store.loadSleeperWeekIfStale.mockRejectedValueOnce(new Error('offline'))
    await expect(loadWeekProjections({ season: '2026', week: 1, scoringTypes: ['ppr'] })).resolves.toBeUndefined()
  })
  it('merged die FP-Punkte aller Positionen fuer ein Scoring', () => {
    const map = fpPtsMapFor('half_ppr')
    expect(map.size).toBe(5)
    expect(map.get('QB-key')).toBe(5)
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/services/weekProjections.test.js`
Expected: FAIL ("Failed to resolve import ./weekProjections").

- [ ] **Step 3: Implementierung** — `src/services/weekProjections.js`

```js
// Wochenprojektionen aus zwei unabhaengigen Quellen (Sleeper + FantasyPros),
// geteilt von Dashboard-Matchups und Redzone. Gemittelt wird spaeter pro
// Spieler in matchupProjection.blendedPlayerProjection. Beide Stores cachen 6h.
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'

// Positionen identisch zur Sleeper-Wochenprojektion (rankings.js
// SLEEPER_WEEK_POSITIONS); FP-Scoring-Slug je App-Scoringtyp.
export const FP_WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']
export const FP_SCORING_FOR_TYPE = { ppr: 'ppr', half_ppr: 'half', standard: 'std' }

export function detectScoringType(league) {
  const rec = Number(league?.scoring_settings?.rec ?? 1)
  return rec >= 0.95 ? 'ppr' : rec >= 0.45 ? 'half_ppr' : 'standard'
}

export async function loadWeekProjections({ season, week, scoringTypes }) {
  const store = useWeeklyRankingsStore.getState()
  await Promise.all([
    store.loadSleeperWeekIfStale({ season, week }).catch(() => {}),
    ...[...scoringTypes].flatMap((type) =>
      FP_WEEK_POSITIONS.map((pos) =>
        store.loadFpWeekPtsIfStale({ pos, scoring: FP_SCORING_FOR_TYPE[type] || 'ppr' }).catch(() => {})
      )
    ),
  ])
}

// matchKey-Namespaces ueberschneiden sich nicht zwischen Positionen
// (siehe waiverStats.matchKey) -> einfaches Mergen ist verlustfrei.
export function fpPtsMapFor(scoringType) {
  const store = useWeeklyRankingsStore.getState()
  const scoring = FP_SCORING_FOR_TYPE[scoringType] || 'ppr'
  const merged = new Map()
  for (const pos of FP_WEEK_POSITIONS) {
    for (const [k, v] of store.getFpWeekPtsMap({ pos, scoring })) merged.set(k, v)
  }
  return merged
}
```

- [ ] **Step 4: Tests grün**

Run: `npx vitest run src/services/weekProjections.test.js`
Expected: PASS (4 Tests).

- [ ] **Step 5: Dashboard umstellen** — in `src/stores/useDashboardStore.js`:
  1. Import ergänzen: `import { detectScoringType, loadWeekProjections, fpPtsMapFor } from '../services/weekProjections'`
  2. Löschen: den Kommentar + `const FP_WEEK_POSITIONS = …`, `const FP_SCORING_FOR_TYPE = …` und die komplette `function detectScoringType(league) { … }`.
  3. In `loadDashboard` den Block `if (isInSeason) { await Promise.all([ … ]) }` ersetzen durch:

```js
      if (isInSeason) {
        await loadWeekProjections({ season: nflState?.season || seasonYear, week: currentWeek, scoringTypes: scoringTypesUsed })
      }
```
  4. Den Merge-Block (`const fpPtsByScoringType = {}` bis zum Ende der `for`-Schleife) ersetzen durch:

```js
      const fpPtsByScoringType = {}
      for (const scoringType of scoringTypesUsed) fpPtsByScoringType[scoringType] = fpPtsMapFor(scoringType)
```
  Der Kommentar "Projektionen fuer den Proj-vs-Live-Balken: zwei unabhaengige Quellen …" bleibt über `scoringTypesUsed` stehen. `useWeeklyRankingsStore`-Import bleibt (für `sleeperWeekById`).

- [ ] **Step 6: Regression Dashboard**

Run: `npx vitest run src/services/weekProjections.test.js src/stores/useDashboardStore.test.js src/pages/DashboardPage.test.jsx src/components`
Expected: PASS, keine neuen Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/services/weekProjections.js src/services/weekProjections.test.js src/stores/useDashboardStore.js
git commit -m "refactor(dashboard): Wochenprojektionen in weekProjections-Service ausgelagert"
```

---

### Task 7: Live-Erkennung (`useGamesLiveStore`)

**Files:**
- Modify: `src/services/api.js` (neue Funktion unter `fetchMatchups`)
- Create: `src/stores/useGamesLiveStore.js`
- Test: `src/stores/useGamesLiveStore.test.js`
- Modify: `src/App.jsx` (Import + Effect vor `// ── Shared page props`)

**Interfaces:**
- Produces:
  - `fetchNflSchedule(season): Promise<{status: 'pre_game'|'in_game'|'complete'|'canceled', date, home, away, week, game_id}[]>`
  - `useGamesLiveStore` → `{ liveCount: number, refresh(season): Promise<void> }` (Tasks 9, 10 lesen `liveCount`)

- [ ] **Step 1: Failing test** — `src/stores/useGamesLiveStore.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({ fetchNflSchedule: vi.fn() }))

import { fetchNflSchedule } from '../services/api'
import { useGamesLiveStore } from './useGamesLiveStore'

beforeEach(() => {
  vi.clearAllMocks()
  useGamesLiveStore.setState({ liveCount: 0 })
})

describe('useGamesLiveStore', () => {
  it('zaehlt Spiele mit Status in_game', async () => {
    fetchNflSchedule.mockResolvedValue([
      { status: 'in_game' }, { status: 'pre_game' }, { status: 'in_game' }, { status: 'complete' },
    ])
    await useGamesLiveStore.getState().refresh('2026')
    expect(fetchNflSchedule).toHaveBeenCalledWith('2026')
    expect(useGamesLiveStore.getState().liveCount).toBe(2)
  })
  it('behaelt bei Netzfehler den letzten Stand', async () => {
    useGamesLiveStore.setState({ liveCount: 3 })
    fetchNflSchedule.mockRejectedValue(new Error('HTTP 503'))
    await useGamesLiveStore.getState().refresh('2026')
    expect(useGamesLiveStore.getState().liveCount).toBe(3)
  })
  it('fragt ohne Saison nichts ab', async () => {
    await useGamesLiveStore.getState().refresh('')
    expect(fetchNflSchedule).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/stores/useGamesLiveStore.test.js`
Expected: FAIL ("Failed to resolve import ./useGamesLiveStore").

- [ ] **Step 3: API-Funktion** — in `src/services/api.js` unter `fetchMatchups` einfügen:

```js
// NFL-Spielplan der Regular Season mit Status je Spiel ('pre_game' | 'in_game'
// | 'complete' | 'canceled'). Inoffizieller api.sleeper.com-Endpoint (ohne /v1),
// verifiziert 2026-09-13. Grundlage der Live-Erkennung fuer die Redzone.
export async function fetchNflSchedule(season) {
  return fetchJson(`https://api.sleeper.com/schedule/nfl/regular/${season}`)
}
```

- [ ] **Step 4: Store** — `src/stores/useGamesLiveStore.js`

```js
import { create } from 'zustand'
import { fetchNflSchedule } from '../services/api'

// Laeuft gerade mindestens ein NFL-Spiel? Steuert, ob die Redzone-Einstiege
// (Rail, Mehr-Sheet, Tabs, Dashboard-Banner) sichtbar sind. Nicht persistiert:
// ein alter Wert aus localStorage wuerde nach dem Spieltag faelschlich "live" zeigen.
export const useGamesLiveStore = create((set) => ({
  liveCount: 0,
  refresh: async (season) => {
    if (!season) return
    try {
      const games = await fetchNflSchedule(season)
      set({ liveCount: (Array.isArray(games) ? games : []).filter((g) => g.status === 'in_game').length })
    } catch {
      // Netzfehler: letzten Stand behalten, der naechste Tick versucht es erneut.
    }
  },
}))
```

- [ ] **Step 5: Tests grün**

Run: `npx vitest run src/stores/useGamesLiveStore.test.js`
Expected: PASS (3 Tests).

- [ ] **Step 6: Polling in `src/App.jsx`**
  - Import bei den Stores: `import { useGamesLiveStore } from './stores/useGamesLiveStore'`
  - Direkt **vor** der Zeile `  // ── Shared page props ──…` einfügen:

```jsx
  // ── Live-Erkennung (Redzone-Einstiege) ─────────────────────────────────────
  // 3 KB alle 2 Minuten, nur bei sichtbarem Tab. Die Redzone selbst pollt
  // schneller, aber nur solange sie offen ist.
  const refreshGamesLive = useGamesLiveStore((s) => s.refresh)
  useEffect(() => {
    const tick = () => { if (!document.hidden) refreshGamesLive(seasonYear) }
    tick()
    const id = setInterval(tick, 2 * 60 * 1000)
    return () => clearInterval(id)
  }, [seasonYear, refreshGamesLive])
```

- [ ] **Step 7: Gesamtsuite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/services/api.js src/stores/useGamesLiveStore.js src/stores/useGamesLiveStore.test.js src/App.jsx
git commit -m "feat(redzone): Live-Erkennung ueber Sleeper-Spielplan"
```

---

### Task 8: Redzone-Store (Polling, Filter, Summary-Sparregel)

**Files:**
- Create: `src/stores/useRedzoneStore.js`
- Test: `src/stores/useRedzoneStore.test.js`

**Interfaces:**
- Consumes: `fetchNflState`, `fetchMatchups(leagueId, week)`, `fetchLeagueRosters(leagueId)`, `fetchLeagueUsers(leagueId)` (api.js); `loadPlayersMetaCached({season})`; `fetchScoreboard`, `fetchScoringPlays` (Task 2); `selectedLeagueIds`, `toggleLeague`, `soloLeague`, `carryPossession`, `relevantTeams` (Tasks 3–4).
- Produces: `useRedzoneStore` mit State `{ deselectedLeagueIds, week, games, leagueData: Record<leagueId, {matchups, rosters, users, error}>, scoringPlaysByEvent, scoreKeyByEvent, newPlayIds, playersMeta, lastUpdated: number|null, espnError: string|null, loading }` und Actions `toggleLeague(allIds, id)`, `soloLeague(allIds, id)`, `poll({ leagues, season, myUserId })`. Persistiert nur `deselectedLeagueIds` unter `sdh-redzone-v1`.

- [ ] **Step 1: Failing test** — `src/stores/useRedzoneStore.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/api', () => ({
  fetchNflState: vi.fn(), fetchMatchups: vi.fn(), fetchLeagueRosters: vi.fn(), fetchLeagueUsers: vi.fn(),
}))
vi.mock('../services/playersMeta', () => ({ loadPlayersMetaCached: vi.fn() }))
vi.mock('../services/redzone/espnLive', () => ({ fetchScoreboard: vi.fn(), fetchScoringPlays: vi.fn() }))

import { fetchNflState, fetchMatchups, fetchLeagueRosters, fetchLeagueUsers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchScoreboard, fetchScoringPlays } from '../services/redzone/espnLive'
import { useRedzoneStore } from './useRedzoneStore'

const INITIAL = useRedzoneStore.getState()
const LEAGUES = [{ league_id: 'L1', name: 'Büro-Liga' }, { league_id: 'L2', name: 'Dynasty Bros' }]
const META = { P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB' } }
const board = (cinScore) => [
  { id: 'g1', state: 'in', home: { id: '4', abbr: 'CIN', score: cinScore }, away: { id: '27', abbr: 'TB', score: 3 }, possessionAbbr: 'CIN', isRedZone: false },
  { id: 'g2', state: 'pre', home: { id: '9', abbr: 'GB', score: 0 }, away: { id: '16', abbr: 'MIN', score: 0 }, possessionAbbr: null, isRedZone: false },
  { id: 'g3', state: 'in', home: { id: '12', abbr: 'KC', score: 7 }, away: { id: '7', abbr: 'DEN', score: 0 }, possessionAbbr: null, isRedZone: false },
]
const args = { leagues: LEAGUES, season: '2026', myUserId: 'me' }

beforeEach(() => {
  vi.clearAllMocks()
  useRedzoneStore.setState({ ...INITIAL, deselectedLeagueIds: [] }, true)
  fetchNflState.mockResolvedValue({ week: 1 })
  loadPlayersMetaCached.mockResolvedValue(META)
  fetchLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: 'me' }])
  fetchLeagueUsers.mockResolvedValue([])
  fetchMatchups.mockResolvedValue([{ roster_id: 1, matchup_id: 1, points: 10, starters: ['P1'], players_points: { P1: 10 } }])
  fetchScoreboard.mockResolvedValue(board(14))
  fetchScoringPlays.mockResolvedValue([{ id: 'a', text: 'Joe Burrow 1 Yd Rush', teamAbbr: 'CIN', period: 1, clockValue: 100 }])
})

describe('useRedzoneStore.poll', () => {
  it('laedt nur aktive Ligen und fuellt Spiele + Ligadaten', async () => {
    useRedzoneStore.getState().toggleLeague(['L1', 'L2'], 'L2')
    await useRedzoneStore.getState().poll(args)
    expect(fetchMatchups).toHaveBeenCalledTimes(1)
    expect(fetchMatchups).toHaveBeenCalledWith('L1', 1)
    const s = useRedzoneStore.getState()
    expect(s.games).toHaveLength(3)
    expect(s.leagueData.L1.error).toBeNull()
    expect(s.lastUpdated).toEqual(expect.any(Number))
  })

  it('holt Rosters/Users nur beim ersten Poll', async () => {
    await useRedzoneStore.getState().poll(args)
    await useRedzoneStore.getState().poll(args)
    expect(fetchLeagueRosters).toHaveBeenCalledTimes(2) // je Liga einmal
    expect(fetchMatchups).toHaveBeenCalledTimes(4)
  })

  it('laedt Scoring-Plays nur fuer relevante Spiele und nur bei geaendertem Stand', async () => {
    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(1)
    expect(fetchScoringPlays).toHaveBeenCalledWith('g1')
    expect(useRedzoneStore.getState().newPlayIds).toEqual([]) // erster Abruf markiert nichts

    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(1)

    fetchScoreboard.mockResolvedValue(board(21))
    fetchScoringPlays.mockResolvedValue([
      { id: 'a', text: 'Joe Burrow 1 Yd Rush', teamAbbr: 'CIN', period: 1, clockValue: 100 },
      { id: 'b', text: 'Joe Burrow 5 Yd Rush', teamAbbr: 'CIN', period: 2, clockValue: 300 },
    ])
    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(2)
    expect(useRedzoneStore.getState().newPlayIds).toEqual(['b'])
  })

  it('versucht einen fehlgeschlagenen Summary-Abruf beim naechsten Poll erneut', async () => {
    fetchScoringPlays.mockRejectedValueOnce(new Error('HTTP 500'))
    await useRedzoneStore.getState().poll(args)
    await useRedzoneStore.getState().poll(args)
    expect(fetchScoringPlays).toHaveBeenCalledTimes(2)
  })

  it('behaelt bei ESPN-Ausfall die letzten Spiele und meldet den Fehler', async () => {
    await useRedzoneStore.getState().poll(args)
    fetchScoreboard.mockRejectedValue(new Error('HTTP 502'))
    await useRedzoneStore.getState().poll(args)
    const s = useRedzoneStore.getState()
    expect(s.games).toHaveLength(3)
    expect(s.espnError).toBe('ESPN-Daten gerade nicht verfügbar')
  })

  it('markiert eine Liga mit Fehler, ohne die anderen zu stoeren', async () => {
    fetchMatchups.mockImplementation((id) => (id === 'L2' ? Promise.reject(new Error('HTTP 500')) : Promise.resolve([])))
    await useRedzoneStore.getState().poll(args)
    const s = useRedzoneStore.getState()
    expect(s.leagueData.L2.error).toBe('HTTP 500')
    expect(s.leagueData.L1.error).toBeNull()
  })
})

describe('Filter-Persistenz', () => {
  it('speichert nur die abgewaehlten Liga-IDs', () => {
    useRedzoneStore.getState().soloLeague(['L1', 'L2'], 'L1')
    const persisted = useRedzoneStore.persist.getOptions().partialize(useRedzoneStore.getState())
    expect(persisted).toEqual({ deselectedLeagueIds: ['L2'] })
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/stores/useRedzoneStore.test.js`
Expected: FAIL ("Failed to resolve import ./useRedzoneStore").

- [ ] **Step 3: Implementierung** — `src/stores/useRedzoneStore.js`

```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { fetchNflState, fetchMatchups, fetchLeagueRosters, fetchLeagueUsers } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { fetchScoreboard, fetchScoringPlays } from '../services/redzone/espnLive'
import {
  selectedLeagueIds, toggleLeague, soloLeague, carryPossession, relevantTeams,
} from '../services/redzone/redzoneModel'

// Scoring-Plays aendern sich nur mit dem Spielstand. Der Status gehoert dazu,
// damit ein Spiel nach "Final" genau einmal nachgeladen wird.
const scoreKey = (g) => `${g.away.score}:${g.home.score}:${g.state}`

// Rohdaten der Redzone. Aufbereitung passiert in redzoneModel (rein) bzw. in
// RedzonePage. Persistiert wird nur der Liga-Filter.
export const useRedzoneStore = create(
  persist(
    (set, get) => ({
      deselectedLeagueIds: [],
      week: null,
      games: [],
      leagueData: {},
      scoringPlaysByEvent: {},
      scoreKeyByEvent: {},
      newPlayIds: [],
      playersMeta: {},
      lastUpdated: null,
      espnError: null,
      loading: false,

      toggleLeague: (allIds, id) =>
        set((s) => ({ deselectedLeagueIds: toggleLeague(allIds, s.deselectedLeagueIds, id) })),
      soloLeague: (allIds, id) =>
        set((s) => ({ deselectedLeagueIds: soloLeague(allIds, s.deselectedLeagueIds, id) })),

      poll: async ({ leagues = [], season, myUserId }) => {
        if (get().loading || !leagues.length) return
        set({ loading: true })
        try {
          const s = get()
          const nfl = await fetchNflState().catch(() => null)
          const week = Number(nfl?.week) || s.week || 1
          const weekChanged = s.week != null && s.week !== week
          const playersMeta = Object.keys(s.playersMeta).length
            ? s.playersMeta
            : await loadPlayersMetaCached({ season: Number(season) }).catch(() => ({}))

          const activeIds = new Set(selectedLeagueIds(leagues.map((l) => l.league_id), s.deselectedLeagueIds))
          const active = leagues.filter((l) => activeIds.has(l.league_id))

          // Rosters/Users aendern sich am Spieltag nicht -> nur einmal holen.
          const loadLeague = async (league) => {
            const prev = s.leagueData[league.league_id]
            try {
              const [matchups, rosters, users] = await Promise.all([
                fetchMatchups(league.league_id, week),
                prev?.rosters || fetchLeagueRosters(league.league_id),
                prev?.users || fetchLeagueUsers(league.league_id),
              ])
              return [league.league_id, { matchups, rosters, users, error: null }]
            } catch (e) {
              return [league.league_id, { ...prev, error: e.message || 'Fehler beim Laden' }]
            }
          }

          const [scoreboard, ...leagueEntries] = await Promise.all([
            fetchScoreboard({ season, week }).then((games) => ({ games }), () => ({ games: null })),
            ...active.map(loadLeague),
          ])

          const prevGames = weekChanged ? [] : s.games
          const games = scoreboard.games ? carryPossession(prevGames, scoreboard.games) : prevGames
          const leagueData = { ...s.leagueData, ...Object.fromEntries(leagueEntries) }

          // Summary (~32 KB) nur fuer Spiele mit eigenen/gegnerischen Startern
          // und nur, wenn sich dort der Stand seit dem letzten Abruf bewegt hat.
          const teams = relevantTeams({
            leagueData: active.map((l) => ({ league: l, ...leagueData[l.league_id] })),
            myUserId,
            playersMeta,
          })
          const prevPlays = weekChanged ? {} : s.scoringPlaysByEvent
          const prevKeys = weekChanged ? {} : s.scoreKeyByEvent
          const due = games.filter((g) =>
            g.state !== 'pre' && (teams.has(g.home.abbr) || teams.has(g.away.abbr)) && prevKeys[g.id] !== scoreKey(g))
          const results = await Promise.all(
            due.map((g) => fetchScoringPlays(g.id).then((plays) => ({ g, plays }), () => null))
          )

          const known = new Set(Object.values(prevPlays).flat().map((p) => p.id))
          const scoringPlaysByEvent = { ...prevPlays }
          const scoreKeyByEvent = { ...prevKeys }
          const newPlayIds = []
          for (const r of results) {
            if (!r) continue // fehlgeschlagen: scoreKey bleibt alt -> naechster Poll versucht es erneut
            if (known.size) for (const p of r.plays) if (!known.has(p.id)) newPlayIds.push(p.id)
            scoringPlaysByEvent[r.g.id] = r.plays
            scoreKeyByEvent[r.g.id] = scoreKey(r.g)
          }

          set({
            week, games, playersMeta, leagueData, scoringPlaysByEvent, scoreKeyByEvent, newPlayIds,
            espnError: scoreboard.games ? null : 'ESPN-Daten gerade nicht verfügbar',
            lastUpdated: Date.now(),
            loading: false,
          })
        } catch (e) {
          console.warn('[redzone] poll failed', e)
          set({ loading: false })
        }
      },
    }),
    {
      name: 'sdh-redzone-v1',
      version: 1,
      partialize: (s) => ({ deselectedLeagueIds: s.deselectedLeagueIds }),
    }
  )
)
```

- [ ] **Step 4: Tests grün**

Run: `npx vitest run src/stores/useRedzoneStore.test.js`
Expected: PASS (7 Tests).

> Hinweis zum 3. Test: Nach dem ersten Poll kennt der Store Play `a`. Beim Stand 21 kommt `b` hinzu → `newPlayIds` = `['b']`. Das erste Poll markiert nichts, weil `known` leer ist.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useRedzoneStore.js src/stores/useRedzoneStore.test.js
git commit -m "feat(redzone): Store mit 30-s-Polling, Liga-Filter und Summary-Sparregel"
```

---

### Task 9: Präsentationale Bausteine + Styles

**Files:**
- Create: `src/components/redzone/RedzoneParts.jsx`
- Create: `src/styles/redzone.css`
- Test: `src/components/redzone/RedzoneParts.test.jsx`

**Interfaces:**
- Consumes: `Game` (Task 2), `Tile`/`Entry` (Task 4), Alert/Ticker-Items (Task 5); `SleeperAvatar`, `Icon`, `cx` (`src/utils/formatting.js`).
- Produces (named exports):
  - `LeagueChips({ leagues: {id, label, avatar}[], activeIds: string[], onToggle(id), onSolo(id) })`
  - `GameStrip({ games, counts })` + Helper `gameClock(game): string`
  - `MatchupRow({ tiles })`
  - `PlayerRow({ player, variant: 'mine'|'opp' })`, `MyPlayers({ players })`, `OpponentsLive({ players })`
  - `RedzoneAlerts({ alerts })`
  - `ScoringTicker({ items })`
  - `Stamp({ at: number|null })`

- [ ] **Step 1: Failing test** — `src/components/redzone/RedzoneParts.test.jsx`

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { LeagueChips, GameStrip, gameClock, MyPlayers, ScoringTicker, RedzoneAlerts } from './RedzoneParts'

const g = (id, home, away, over = {}) => ({
  id, state: 'in', period: 2, clock: '6:09', date: '2026-09-13T20:25Z',
  home: { abbr: home, score: 14 }, away: { abbr: away, score: 3 },
  possessionAbbr: home, isRedZone: false, downDistance: null, lastPlay: null, ...over,
})
const p = (playerId, name, team, over = {}) => ({
  playerId, name, team, pos: 'QB', state: 'in', game: g('g1', 'CIN', 'TB'), points: 14.6, projected: 22.1,
  leagues: [{ leagueId: 'L1', leagueName: 'Büro-Liga' }], ...over,
})

describe('LeagueChips', () => {
  const leagues = [{ id: 'L1', label: 'Büro-Liga', avatar: null }, { id: 'L2', label: 'Dynasty Bros', avatar: null }]

  it('Klick schaltet um, Doppelklick waehlt nur diese Liga', () => {
    const onToggle = vi.fn(); const onSolo = vi.fn()
    render(<LeagueChips leagues={leagues} activeIds={['L1']} onToggle={onToggle} onSolo={onSolo} />)
    const chip = screen.getByRole('button', { name: /Dynasty Bros/ })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(chip)
    expect(onToggle).toHaveBeenCalledWith('L2')
    fireEvent.doubleClick(chip)
    expect(onSolo).toHaveBeenCalledWith('L2')
  })

  it('Langdruck waehlt nur diese Liga und loest keinen Toggle aus', () => {
    vi.useFakeTimers()
    const onToggle = vi.fn(); const onSolo = vi.fn()
    render(<LeagueChips leagues={leagues} activeIds={['L1', 'L2']} onToggle={onToggle} onSolo={onSolo} />)
    const chip = screen.getByRole('button', { name: /Büro-Liga/ })
    fireEvent.pointerDown(chip)
    act(() => { vi.advanceTimersByTime(500) })
    fireEvent.pointerUp(chip)
    fireEvent.click(chip)
    expect(onSolo).toHaveBeenCalledWith('L1')
    expect(onToggle).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('GameStrip', () => {
  it('zeigt laufende vor anstehenden vor beendeten Spielen und markiert die Redzone', () => {
    const games = [g('post', 'SF', 'LAR', { state: 'post' }), g('pre', 'GB', 'MIN', { state: 'pre' }), g('rz', 'CIN', 'TB', { isRedZone: true })]
    const { container } = render(<GameStrip games={games} counts={{ rz: { mine: 3, opp: 1 } }} />)
    const cards = [...container.querySelectorAll('.rz-game')]
    expect(cards.map((c) => c.dataset.id)).toEqual(['rz', 'pre', 'post'])
    expect(cards[0]).toHaveClass('is-redzone')
    expect(screen.getByText('RZ')).toBeInTheDocument()
  })
  it('formatiert Uhr je Status', () => {
    expect(gameClock(g('a', 'CIN', 'TB'))).toBe('Q2 6:09')
    expect(gameClock(g('b', 'CIN', 'TB', { state: 'post' }))).toBe('Final')
  })
})

describe('MyPlayers', () => {
  it('gruppiert nach Status und fasst mehrere Ligen zusammen', () => {
    const players = [
      p('P1', 'Joe Burrow', 'CIN', { leagues: [{ leagueId: 'L1', leagueName: 'A' }, { leagueId: 'L2', leagueName: 'B' }] }),
      p('P2', 'Jayden Reed', 'GB', { state: 'pre', points: null }),
    ]
    render(<MyPlayers players={players} />)
    expect(screen.getByText('Läuft')).toBeInTheDocument()
    expect(screen.getByText('Noch nicht')).toBeInTheDocument()
    expect(screen.getByText('2 Ligen')).toBeInTheDocument()
    expect(screen.getByText('14.6')).toBeInTheDocument()
  })
})

describe('RedzoneAlerts / ScoringTicker', () => {
  it('listet meine und gegnerische Beteiligte im Alarm', () => {
    const alerts = [{ game: g('g1', 'CIN', 'TB', { isRedZone: true, downDistance: '1st & Goal at TB 5' }), mine: [p('P1', 'Joe Burrow', 'CIN')], opponents: [p('P3', 'Mike Gesicki', 'CIN')] }]
    render(<RedzoneAlerts alerts={alerts} />)
    expect(screen.getByText('1st & Goal at TB 5')).toBeInTheDocument()
    expect(screen.getByText('Joe Burrow')).toBeInTheDocument()
    expect(screen.getByText('Mike Gesicki')).toBeInTheDocument()
  })
  it('hebt neue Plays hervor', () => {
    const items = [{ play: { id: 'b', text: 'Joe Burrow 1 Yd Rush', teamAbbr: 'CIN', type: 'TD', period: 1, clock: '1:48' }, mine: [p('P1', 'Joe Burrow', 'CIN')], opponents: [], isNew: true }]
    const { container } = render(<ScoringTicker items={items} />)
    expect(container.querySelector('.rz-tick')).toHaveClass('is-new')
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/components/redzone/RedzoneParts.test.jsx`
Expected: FAIL ("Failed to resolve import ./RedzoneParts").

- [ ] **Step 3: Komponenten** — `src/components/redzone/RedzoneParts.jsx`

```jsx
import { useEffect, useRef, useState } from 'react'
import Icon from '../Icon'
import SleeperAvatar from '../SleeperAvatar'
import { cx } from '../../utils/formatting'

const STATE_ORDER = { in: 0, pre: 1, post: 2 }
const pts = (n) => (n == null ? '–' : Number(n).toFixed(1))
const LONG_PRESS_MS = 450

// ── Liga-Filter ─────────────────────────────────────────────────────────────

function LeagueChip({ league, active, onToggle, onSolo }) {
  const timer = useRef(null)
  const longPressed = useRef(false)
  const start = () => {
    longPressed.current = false
    timer.current = setTimeout(() => { longPressed.current = true; onSolo(league.id) }, LONG_PRESS_MS)
  }
  const stop = () => clearTimeout(timer.current)
  useEffect(() => stop, [])
  return (
    <button
      type="button"
      className={cx('rz-chip', active && 'is-on')}
      aria-pressed={active}
      onClick={() => {
        // Nach Langdruck feuert der Browser trotzdem click -> nicht zusaetzlich toggeln.
        if (longPressed.current) { longPressed.current = false; return }
        onToggle(league.id)
      }}
      onDoubleClick={() => onSolo(league.id)}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      <SleeperAvatar avatar={league.avatar} name={league.label} size={16} className="rz-chip-av" />
      <span>{league.label}</span>
      {active && <Icon name="check" size={13} />}
    </button>
  )
}

export function LeagueChips({ leagues, activeIds, onToggle, onSolo }) {
  return (
    <div className="rz-chips" role="group" aria-label="Ligen filtern">
      {leagues.map((l) => (
        <LeagueChip key={l.id} league={l} active={activeIds.includes(l.id)} onToggle={onToggle} onSolo={onSolo} />
      ))}
      <span className="rz-chips-hint">Doppelklick oder lang drücken = nur diese · nochmal = alle</span>
    </div>
  )
}

// ── Spielleiste ─────────────────────────────────────────────────────────────

export function gameClock(game) {
  if (game.state === 'in') return `Q${game.period ?? '?'} ${game.clock}`.trim()
  if (game.state === 'post') return 'Final'
  if (!game.date) return ''
  return new Date(game.date).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function GameSide({ side, game }) {
  const lead = game.state !== 'pre' && side.score >= Math.max(game.home.score, game.away.score)
  return (
    <div className={cx('rz-game-row', lead && 'is-lead')}>
      <span className={cx('rz-poss', game.state === 'in' && game.possessionAbbr === side.abbr && 'is-on')} />
      <span className="rz-game-abbr">{side.abbr}</span>
      <span className="rz-game-score">{game.state === 'pre' ? '–' : side.score}</span>
    </div>
  )
}

export function GameStrip({ games, counts = {} }) {
  const sorted = [...games].sort((a, b) => (STATE_ORDER[a.state] ?? 3) - (STATE_ORDER[b.state] ?? 3))
  return (
    <div className="rz-strip">
      {sorted.map((game) => {
        const c = counts[game.id] || { mine: 0, opp: 0 }
        const rz = game.state === 'in' && game.isRedZone
        return (
          <div key={game.id} data-id={game.id} className={cx('rz-game', rz && 'is-redzone', game.state === 'post' && 'is-final')}>
            <GameSide side={game.away} game={game} />
            <GameSide side={game.home} game={game} />
            <div className="rz-game-foot">
              {rz && <span className="rz-tag">RZ</span>}
              <span className="rz-num">{gameClock(game)}</span>
              <span className="rz-game-inv">
                {c.mine > 0 && <span className="rz-cnt rz-cnt--me" title="Meine Starter">{c.mine}</span>}
                {c.opp > 0 && <span className="rz-cnt rz-cnt--opp" title="Gegner-Starter">{c.opp}</span>}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Matchups ────────────────────────────────────────────────────────────────

export function MatchupRow({ tiles }) {
  if (!tiles.length) return null
  return (
    <div className="rz-matchups">
      {tiles.map((t) => (
        <div key={t.leagueId} className="rz-mt">
          <div className="rz-mt-top">
            <SleeperAvatar avatar={t.leagueAvatar} name={t.leagueName} size={16} />
            <span className="rz-mt-name">{t.leagueName}</span>
            {!t.error && <span className="rz-mt-open"><span className="rz-num">{t.myOpen} · {t.oppOpen}</span> offen</span>}
          </div>
          {t.error ? (
            <div className="rz-mt-error">Matchup nicht geladen ({t.error})</div>
          ) : (
            <>
              <div className="rz-mt-score" title={t.opponentName ? `gegen ${t.opponentName}` : undefined}>
                <span className="rz-num rz-mt-me">{pts(t.myPoints)}</span>
                <span className="rz-mt-vs">:</span>
                <span className="rz-num rz-mt-opp">{pts(t.opponentPoints)}</span>
                <span className={cx('rz-num rz-mt-pct', t.myWinPct >= 50 ? 'is-good' : 'is-bad')}>{t.myWinPct}%</span>
              </div>
              <div className="rz-bar" aria-hidden="true">
                <span><i className="rz-bar-me" style={{ width: `${t.myWinPct}%` }} /></span>
                <span><i className="rz-bar-opp" style={{ width: `${100 - t.myWinPct}%` }} /></span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Spieler ─────────────────────────────────────────────────────────────────

function leagueLabel(leagues) {
  return leagues.length === 1 ? leagues[0].leagueName : `${leagues.length} Ligen`
}

export function PlayerRow({ player, variant = 'mine' }) {
  const g = player.game
  const rz = g && g.state === 'in' && g.isRedZone && g.possessionAbbr === player.team
  const score = g && g.state !== 'pre'
    ? `${player.team} ${g.home.abbr === player.team ? g.home.score : g.away.score}–${g.home.abbr === player.team ? g.away.score : g.home.score} · ${gameClock(g)}`
    : g ? gameClock(g) : 'kein Spiel'
  return (
    <div className={cx('rz-player', rz && 'is-redzone', variant === 'opp' && 'is-opp')}>
      <span className={`rz-pos rz-pos--${player.pos.toLowerCase()}`}>{player.pos}</span>
      <div className="rz-player-main">
        <div className="rz-player-name">{player.name}{rz && <span className="rz-tag">RZ</span>}</div>
        <div className="rz-player-sub">
          <span className="rz-num">{score}</span>
          <span className={cx('rz-cnt', variant === 'opp' ? 'rz-cnt--opp' : 'rz-cnt--me')} title={player.leagues.map((l) => l.leagueName).join(', ')}>
            {leagueLabel(player.leagues)}
          </span>
        </div>
      </div>
      <div className="rz-player-pts">
        <span className="rz-num">{pts(player.points)}</span>
        {player.projected != null && <small className="rz-num">Proj {pts(player.projected)}</small>}
      </div>
    </div>
  )
}

const GROUPS = [
  { key: 'in', label: 'Läuft' },
  { key: 'pre', label: 'Noch nicht' },
  { key: 'post', label: 'Fertig' },
  { key: 'none', label: 'Kein Spiel' },
]

export function MyPlayers({ players }) {
  if (!players.length) return <div className="rz-empty">Keine Starter in den gewählten Ligen.</div>
  return (
    <div className="rz-card rz-list">
      {GROUPS.map(({ key, label }) => {
        const list = players.filter((p) => p.state === key)
        if (!list.length) return null
        return (
          <div key={key}>
            <div className={cx('rz-group', key === 'in' && 'is-live')}>{label}</div>
            {list.map((p) => <PlayerRow key={p.playerId} player={p} />)}
          </div>
        )
      })}
    </div>
  )
}

export function OpponentsLive({ players }) {
  if (!players.length) return <div className="rz-empty">Gerade kein Gegner-Starter im Einsatz.</div>
  return (
    <div className="rz-card rz-list">
      {players.map((p) => <PlayerRow key={p.playerId} player={p} variant="opp" />)}
    </div>
  )
}

// ── Redzone-Alarm & Ticker ──────────────────────────────────────────────────

const names = (list) => list.map((p) => p.name).join(' · ')

export function RedzoneAlerts({ alerts }) {
  if (!alerts.length) return <div className="rz-empty">Gerade keine Redzone mit deinen oder gegnerischen Startern.</div>
  return alerts.map(({ game, mine, opponents }) => {
    const other = game.possessionAbbr === game.home.abbr ? game.away : game.home
    const own = game.possessionAbbr === game.home.abbr ? game.home : game.away
    return (
      <div key={game.id} className="rz-card rz-alert" role="status">
        <div className="rz-alert-top">
          <span className="rz-tag rz-tag--lg">REDZONE</span>
          <span className="rz-alert-team">{own.abbr}</span>
          <span className="rz-num rz-muted">{own.score}–{other.score} {other.abbr}</span>
          <span className="rz-num rz-alert-clock">{gameClock(game)}</span>
        </div>
        {game.downDistance && <div className="rz-num rz-alert-dd">{game.downDistance}</div>}
        {game.lastPlay && <div className="rz-alert-last">{game.lastPlay}</div>}
        {mine.length > 0 && <div className="rz-alert-inv"><span className="rz-side rz-side--me">MEINE</span><span>{names(mine)}</span></div>}
        {opponents.length > 0 && <div className="rz-alert-inv"><span className="rz-side rz-side--opp">GEGNER</span><span>{names(opponents)}</span></div>}
      </div>
    )
  })
}

export function ScoringTicker({ items }) {
  if (!items.length) return <div className="rz-empty">Noch keine Scores deiner oder gegnerischer Starter.</div>
  return (
    <div className="rz-card rz-list">
      {items.map(({ play, mine, opponents, isNew }) => (
        <div key={play.id} className={cx('rz-tick', isNew && 'is-new')}>
          <div className="rz-num rz-tick-when">Q{play.period}<br />{play.clock}</div>
          <div className="rz-tick-what">{play.text}<span>{play.teamAbbr} · {play.type}</span></div>
          <div className="rz-tick-imp">
            {mine.length > 0 && <span className="rz-cnt rz-cnt--me">{names(mine)}</span>}
            {opponents.length > 0 && <span className="rz-cnt rz-cnt--opp">{names(opponents)}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Aktualitaet ─────────────────────────────────────────────────────────────

export function Stamp({ at }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!at) return <span className="rz-stamp">lädt …</span>
  const s = Math.max(0, Math.round((now - at) / 1000))
  return (
    <span className={cx('rz-stamp', s > 120 && 'is-stale')}>
      Stand vor <span className="rz-num">{s < 60 ? `${s} s` : `${Math.floor(s / 60)} min`}</span>
    </span>
  )
}
```

- [ ] **Step 4: Styles** — `src/styles/redzone.css` (Werte aus `docs/mocks/redzone-mocks.html`, nur Tokens)

```css
/* Live-Redzone. Layout per grid-areas: mobil einspaltig (Alarm oben),
   ab 900px Spielleiste/Chips/Matchups ueber zwei Spalten. */
.rz-page { display: grid; gap: 10px; grid-template-columns: minmax(0, 1fr);
  grid-template-areas: 'head' 'notice' 'chips' 'alarm' 'matchups' 'strip' 'players' 'opps' 'ticker'; }
.rz-head { grid-area: head; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.rz-notice { grid-area: notice; } .rz-chips { grid-area: chips; } .rz-alerts { grid-area: alarm; }
.rz-matchups { grid-area: matchups; } .rz-strip { grid-area: strip; } .rz-players { grid-area: players; }
.rz-opps { grid-area: opps; } .rz-ticker { grid-area: ticker; }
.rz-section { display: grid; gap: 6px; align-content: start; min-width: 0; }
@media (min-width: 900px) {
  .rz-page { grid-template-columns: minmax(0, 1fr) 380px;
    grid-template-areas: 'head head' 'notice notice' 'strip strip' 'chips chips' 'matchups matchups'
      'players alarm' 'players opps' 'players ticker'; grid-template-rows: repeat(5, auto) auto auto 1fr; }
}

.rz-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.rz-muted { color: var(--text-muted); }
.rz-title { font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; letter-spacing: .02em; }
.rz-live { display: inline-flex; align-items: center; gap: 6px; background: var(--live); color: var(--live-on);
  font-family: var(--font-display); font-weight: 700; font-size: .75rem; letter-spacing: .08em; padding: 3px 8px; border-radius: var(--r-ctl); }
.rz-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; animation: rz-pulse 1.6s infinite; }
@keyframes rz-pulse { 50% { opacity: .35; } }
.rz-stamp { margin-left: auto; font-size: .75rem; color: var(--text-dim); }
.rz-stamp.is-stale { color: var(--bad); }
.rz-h { font-family: var(--font-display); font-weight: 600; font-size: .8rem; letter-spacing: .08em; text-transform: uppercase; color: var(--text-muted); }
.rz-card { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--r-card); }
.rz-empty { font-size: .8rem; color: var(--text-dim); padding: 8px 2px; }
.rz-notice-box { border: 1px solid var(--border); background: var(--surface-card); border-radius: var(--r-card); padding: 8px 12px; color: var(--text-muted); font-size: .85rem; }

.rz-tag { font-family: var(--font-display); font-weight: 700; font-size: .7rem; letter-spacing: .06em; padding: 0 4px;
  border-radius: var(--r-ctl); background: var(--live); color: var(--live-on); }
.rz-tag--lg { font-size: .75rem; padding: 1px 6px; }
.rz-cnt { font-family: var(--font-mono); font-size: .68rem; font-weight: 700; padding: 0 4px; border-radius: var(--r-ctl); white-space: nowrap; }
.rz-cnt--me { color: var(--good); background: color-mix(in srgb, var(--good) 14%, transparent); }
.rz-cnt--opp { color: var(--bad); background: color-mix(in srgb, var(--bad) 14%, transparent); }

/* Chips */
.rz-chips { display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.rz-chips::-webkit-scrollbar { display: none; }
.rz-chip { display: inline-flex; align-items: center; gap: 6px; flex: none; border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); font: 500 .82rem var(--font-ui); padding: 4px 10px; border-radius: var(--r-ctl); cursor: pointer;
  user-select: none; -webkit-touch-callout: none; }
.rz-chip.is-on { border-color: var(--accent-fill); color: var(--text-primary); background: color-mix(in srgb, var(--accent-fill) 10%, transparent); }
.rz-chip.is-on svg { color: var(--accent-text); }
.rz-chip:focus-visible { outline: 2px solid var(--accent-fill); outline-offset: 1px; }
.rz-chips-hint { margin-left: auto; flex: none; font-size: .72rem; color: var(--text-dim); }
@media (max-width: 899px) {
  .rz-chips { position: sticky; top: 0; z-index: var(--z-sticky); background: var(--surface-page); padding: 6px 0; }
  .rz-chips-hint { display: none; }
}

/* Spielleiste */
.rz-strip { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.rz-strip::-webkit-scrollbar { display: none; }
.rz-game { flex: none; width: 132px; background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--r-card); padding: 6px 8px; display: grid; gap: 3px; }
.rz-game.is-redzone { border-color: var(--live); background: color-mix(in srgb, var(--live) 12%, var(--surface-card)); }
.rz-game.is-final { opacity: .6; }
.rz-game-row { display: flex; align-items: center; gap: 6px; font-size: .8rem; color: var(--text-muted); }
.rz-game-row.is-lead { color: var(--text-primary); }
.rz-game-abbr { font-weight: 600; }
.rz-game-score { margin-left: auto; font-family: var(--font-mono); font-weight: 700; }
.rz-poss { width: 6px; height: 6px; border-radius: 50%; }
.rz-poss.is-on { background: var(--accent-fill); }
.rz-game-foot { display: flex; align-items: center; gap: 6px; font-size: .68rem; color: var(--text-muted); border-top: 1px solid var(--border-soft); padding-top: 3px; }
.rz-game-inv { margin-left: auto; display: flex; gap: 4px; }

/* Matchups */
.rz-matchups { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
@media (max-width: 899px) {
  .rz-matchups { grid-auto-flow: column; grid-template-columns: none; grid-auto-columns: 190px; overflow-x: auto; scrollbar-width: none; }
}
.rz-mt { background: var(--surface-card); border: 1px solid var(--border); border-radius: var(--r-card); padding: 6px 10px 7px; display: grid; gap: 4px; min-width: 0; }
.rz-mt-top { display: flex; align-items: center; gap: 6px; font-size: .75rem; color: var(--text-muted); min-width: 0; }
.rz-mt-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rz-mt-open { margin-left: auto; font-size: .68rem; color: var(--text-dim); white-space: nowrap; }
.rz-mt-score { display: flex; align-items: baseline; gap: 8px; }
.rz-mt-me, .rz-mt-opp { font-weight: 700; font-size: 1.1rem; line-height: 1; }
.rz-mt-opp { color: var(--text-muted); }
.rz-mt-vs { color: var(--text-dim); font-size: .75rem; }
.rz-mt-pct { margin-left: auto; font-size: .8rem; font-weight: 700; }
.rz-mt-pct.is-good { color: var(--good); } .rz-mt-pct.is-bad { color: var(--bad); }
.rz-mt-error { font-size: .75rem; color: var(--bad); }
.rz-bar { display: flex; height: 4px; gap: 2px; }
.rz-bar span { flex: 1; display: flex; background: var(--border); border-radius: 1px; overflow: hidden; }
.rz-bar span:first-child { justify-content: flex-end; }
.rz-bar i { display: block; transition: width .4s var(--ease); }
.rz-bar-me { background: var(--good); } .rz-bar-opp { background: var(--bad); }

/* Spielerlisten */
.rz-list { overflow: hidden; }
.rz-group { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 600; font-size: .75rem;
  letter-spacing: .08em; text-transform: uppercase; color: var(--text-dim); padding: 6px 10px 4px; border-bottom: 1px solid var(--border-soft); }
.rz-group.is-live::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--live); }
.rz-player { display: grid; grid-template-columns: 30px minmax(0, 1fr) 70px; align-items: center; gap: 10px; padding: 7px 10px; border-bottom: 1px solid var(--border-soft); }
.rz-player.is-redzone { background: color-mix(in srgb, var(--live) 10%, transparent); }
.rz-player.is-opp .rz-player-name { color: var(--text-muted); }
.rz-pos { font: 700 .66rem var(--font-ui); color: var(--pos-on); text-align: center; padding: 2px 0; border-radius: var(--r-ctl); background: var(--pos-def); }
.rz-pos--qb { background: var(--pos-qb); } .rz-pos--rb { background: var(--pos-rb); } .rz-pos--wr { background: var(--pos-wr); }
.rz-pos--te { background: var(--pos-te); } .rz-pos--k { background: var(--pos-k); }
.rz-player-name { font-weight: 600; font-size: .875rem; display: flex; align-items: center; gap: 6px; }
.rz-player-sub { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: 1px; font-size: .72rem; color: var(--text-muted); }
.rz-player-pts { text-align: right; font-weight: 700; font-size: 1rem; }
.rz-player-pts small { display: block; font-size: .66rem; font-weight: 500; color: var(--text-dim); }

/* Alarm */
.rz-alerts { display: grid; gap: 8px; align-content: start; }
.rz-alert { border-color: var(--live); background: color-mix(in srgb, var(--live) 9%, var(--surface-card)); padding: 10px; display: grid; gap: 6px; }
.rz-alert-top { display: flex; align-items: center; gap: 8px; }
.rz-alert-team { font-family: var(--font-display); font-weight: 700; font-size: 1.2rem; }
.rz-alert-clock { margin-left: auto; font-size: .75rem; color: var(--text-muted); }
.rz-alert-dd { font-weight: 700; font-size: .82rem; }
.rz-alert-last { font-size: .75rem; color: var(--text-muted); line-height: 1.4; }
.rz-alert-inv { display: flex; align-items: center; gap: 8px; font-size: .82rem; }
.rz-side { font-family: var(--font-display); font-weight: 700; font-size: .68rem; letter-spacing: .08em; width: 48px; flex: none; }
.rz-side--me { color: var(--good); } .rz-side--opp { color: var(--bad); }

/* Ticker */
.rz-tick { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--border-soft); align-items: start; }
.rz-tick.is-new { background: color-mix(in srgb, var(--accent-fill) 8%, transparent); }
.rz-tick-when { font-size: .68rem; color: var(--text-dim); line-height: 1.3; }
.rz-tick-what { font-size: .82rem; line-height: 1.35; }
.rz-tick-what span { display: block; margin-top: 2px; font-size: .68rem; color: var(--text-dim); }
.rz-tick-imp { display: grid; gap: 3px; justify-items: end; }

/* Dashboard-Banner */
.rz-dash-banner { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
  background: var(--surface-card); color: var(--text-primary); border: 1px solid var(--live); border-radius: var(--r-card);
  padding: 10px 14px; margin-bottom: 12px; font: inherit; }
.rz-dash-banner-cta { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; background: var(--live); color: var(--live-on);
  font-weight: 600; font-size: .8rem; padding: 5px 10px; border-radius: var(--r-ctl); white-space: nowrap; }
.rz-dash-banner:focus-visible { outline: 2px solid var(--live); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  .rz-live::before { animation: none; }
  .rz-bar i { transition: none; }
}
```

- [ ] **Step 5: Tests grün**

Run: `npx vitest run src/components/redzone/RedzoneParts.test.jsx src/components/no-emoji.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/redzone/RedzoneParts.jsx src/components/redzone/RedzoneParts.test.jsx src/styles/redzone.css
git commit -m "feat(redzone): praesentationale Bausteine und Styles"
```

---

### Task 10: Redzone-Seite + Route

**Files:**
- Create: `src/pages/RedzonePage.jsx`
- Test: `src/pages/RedzonePage.test.jsx`
- Modify: `src/App.jsx` (Import, Route, `handleMobileSync`, `mobileSyncLabel`)

**Interfaces:**
- Consumes: `useRedzoneStore` (Task 8), `useGamesLiveStore` (Task 7), `useSessionStore` (`sleeperUserId`, `seasonYear`, `availableLeagues`, `cardNicknames`), `useWeeklyRankingsStore` (`sleeperWeekById`, `fpWeekPtsByScoring`), `detectScoringType`/`loadWeekProjections`/`fpPtsMapFor` (Task 6), `pointsFieldFor` (`services/analysis/seasonSim.js`), `blendedPlayerProjection` (`services/analysis/matchupProjection.js`), Modell (Tasks 3–5), Bausteine (Task 9).
- Produces: `export default function RedzonePage()`; Route `/redzone`.

- [ ] **Step 1: Failing test** — `src/pages/RedzonePage.test.jsx`

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const session = {
  sleeperUserId: 'me', seasonYear: '2026', cardNicknames: {},
  availableLeagues: [
    { league_id: 'L1', name: 'Büro-Liga', scoring_settings: { rec: 1 } },
    { league_id: 'L2', name: 'Dynasty Bros', scoring_settings: { rec: 0.5 } },
  ],
}
const game = (over = {}) => ({
  id: 'g1', state: 'in', period: 2, clock: '6:09', date: '2026-09-13T17:00Z',
  home: { id: '4', abbr: 'CIN', score: 14 }, away: { id: '27', abbr: 'TB', score: 3 },
  possessionAbbr: 'CIN', isRedZone: true, downDistance: '1st & Goal at TB 5', lastPlay: null, ...over,
})
let rz
const L1_DATA = {
  rosters: [{ roster_id: 1, owner_id: 'me' }, { roster_id: 2, owner_id: 'u2' }],
  users: [{ user_id: 'u2', display_name: 'Kevin' }],
  matchups: [
    { roster_id: 1, matchup_id: 1, points: 48.3, starters: ['P1'], players_points: { P1: 14.6 } },
    { roster_id: 2, matchup_id: 1, points: 61.9, starters: ['P3'], players_points: { P3: 9.2 } },
  ],
  error: null,
}

vi.mock('../stores/useSessionStore', () => ({ useSessionStore: () => session }))
vi.mock('../stores/useRedzoneStore', () => ({ useRedzoneStore: () => rz }))
vi.mock('../services/weekProjections', () => ({
  detectScoringType: () => 'ppr', loadWeekProjections: vi.fn(() => Promise.resolve()), fpPtsMapFor: () => new Map(),
}))

import RedzonePage from './RedzonePage'

beforeEach(() => {
  rz = {
    deselectedLeagueIds: [], week: 1, games: [game()], leagueData: { L1: L1_DATA },
    scoringPlaysByEvent: {}, newPlayIds: [], lastUpdated: Date.now(), espnError: null, loading: false,
    playersMeta: {
      P1: { player_id: 'P1', full_name: 'Joe Burrow', team: 'CIN', position: 'QB' },
      P3: { player_id: 'P3', full_name: 'Mike Gesicki', team: 'CIN', position: 'TE' },
    },
    poll: vi.fn(), toggleLeague: vi.fn(), soloLeague: vi.fn(),
  }
})

describe('RedzonePage', () => {
  it('pollt beim Oeffnen mit Ligen, Saison und User', () => {
    render(<RedzonePage />)
    expect(rz.poll).toHaveBeenCalledWith({ leagues: session.availableLeagues, season: '2026', myUserId: 'me' })
  })

  it('zeigt Chips, Matchup, Redzone-Alarm und Gegner live', () => {
    render(<RedzonePage />)
    expect(screen.getByRole('button', { name: /Dynasty Bros/ })).toBeInTheDocument()
    expect(screen.getByText('48.3')).toBeInTheDocument()
    expect(screen.getByText('1st & Goal at TB 5')).toBeInTheDocument()
    expect(screen.getAllByText('Mike Gesicki').length).toBeGreaterThan(0)
  })

  it('reicht Chip-Klicks mit allen Liga-IDs an den Store weiter', () => {
    render(<RedzonePage />)
    fireEvent.click(screen.getByRole('button', { name: /Dynasty Bros/ }))
    expect(rz.toggleLeague).toHaveBeenCalledWith(['L1', 'L2'], 'L2')
  })

  it('zeigt den naechsten Kickoff, wenn kein Spiel laeuft', () => {
    rz.games = [game({ state: 'pre', isRedZone: false })]
    render(<RedzonePage />)
    expect(screen.getByText(/Gerade läuft kein Spiel\. Nächster Kickoff/)).toBeInTheDocument()
  })

  it('zeigt den ESPN-Fehler statt zu schweigen', () => {
    rz.espnError = 'ESPN-Daten gerade nicht verfügbar'
    render(<RedzonePage />)
    expect(screen.getByText('ESPN-Daten gerade nicht verfügbar')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/pages/RedzonePage.test.jsx`
Expected: FAIL ("Failed to resolve import ./RedzonePage").

- [ ] **Step 3: Seite** — `src/pages/RedzonePage.jsx`

```jsx
import { useCallback, useEffect, useMemo } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useRedzoneStore } from '../stores/useRedzoneStore'
import { useGamesLiveStore } from '../stores/useGamesLiveStore'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { detectScoringType, loadWeekProjections, fpPtsMapFor } from '../services/weekProjections'
import { pointsFieldFor } from '../services/analysis/seasonSim'
import { blendedPlayerProjection } from '../services/analysis/matchupProjection'
import {
  selectedLeagueIds, gamesByTeam, buildMatchupTiles, buildPlayers, buildRedzoneAlerts, buildTicker, countsByGame,
} from '../services/redzone/redzoneModel'
import {
  LeagueChips, GameStrip, MatchupRow, MyPlayers, OpponentsLive, RedzoneAlerts, ScoringTicker, Stamp,
} from '../components/redzone/RedzoneParts'
import Icon from '../components/Icon'
import '../styles/redzone.css'

const POLL_MS = 30 * 1000

export default function RedzonePage() {
  const { sleeperUserId, seasonYear, availableLeagues, cardNicknames } = useSessionStore()
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const rz = useRedzoneStore()
  const sleeperWeekById = useWeeklyRankingsStore((s) => s.sleeperWeekById)
  const fpWeekPtsByScoring = useWeeklyRankingsStore((s) => s.fpWeekPtsByScoring)

  const leagues = useMemo(() => availableLeagues || [], [availableLeagues])
  const allIds = useMemo(() => leagues.map((l) => l.league_id), [leagues])
  const activeIds = selectedLeagueIds(allIds, rz.deselectedLeagueIds)
  const filterKey = activeIds.join(',')
  const labelOf = (l) => cardNicknames?.[l.league_id] || l.name

  const pollNow = useCallback(
    () => rz.poll({ leagues, season: seasonYear, myUserId: sleeperUserId }),
    [rz.poll, leagues, seasonYear, sleeperUserId] // eslint-disable-line
  )

  // Filterwechsel pollt sofort neu (filterKey in den Deps).
  useEffect(() => {
    if (!leagues.length || !sleeperUserId) return
    const tick = () => { if (!document.hidden) pollNow() }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => clearInterval(id)
  }, [pollNow, filterKey]) // eslint-disable-line

  // Projektionen je Woche und benoetigtem Scoring (Stores cachen 6h).
  const scoringKey = [...new Set(leagues.map(detectScoringType))].sort().join(',')
  useEffect(() => {
    if (!rz.week || !scoringKey) return
    loadWeekProjections({ season: seasonYear, week: rz.week, scoringTypes: scoringKey.split(',') })
  }, [rz.week, scoringKey, seasonYear])

  const fpMaps = useMemo(
    () => Object.fromEntries(scoringKey.split(',').filter(Boolean).map((t) => [t, fpPtsMapFor(t)])),
    [scoringKey, fpWeekPtsByScoring] // eslint-disable-line
  )
  const projectPlayer = useCallback((league, playerId) => {
    const type = detectScoringType(league)
    return blendedPlayerProjection({
      playerId, playersMeta: rz.playersMeta, sleeperWeekById, scoringField: pointsFieldFor(type), fpPtsByKey: fpMaps[type],
    })
  }, [rz.playersMeta, sleeperWeekById, fpMaps])

  const view = useMemo(() => {
    const leagueData = leagues
      .filter((l) => activeIds.includes(l.league_id) && rz.leagueData[l.league_id])
      .map((l) => ({ ...rz.leagueData[l.league_id], league: { ...l, name: labelOf(l) } }))
    const args = { leagueData, myUserId: sleeperUserId, byTeam: gamesByTeam(rz.games), playersMeta: rz.playersMeta, projectPlayer }
    const { mine, opponents } = buildPlayers(args)
    return {
      tiles: buildMatchupTiles(args),
      mine,
      opponentsLive: opponents.filter((p) => p.state === 'in'),
      alerts: buildRedzoneAlerts({ games: rz.games, mine, opponents }),
      ticker: buildTicker({ scoringPlaysByEvent: rz.scoringPlaysByEvent, mine, opponents, newPlayIds: rz.newPlayIds }),
      counts: countsByGame(rz.games, { mine, opponents }),
    }
  }, [leagues, filterKey, rz.leagueData, rz.games, rz.playersMeta, rz.scoringPlaysByEvent, rz.newPlayIds, sleeperUserId, projectPlayer, cardNicknames]) // eslint-disable-line

  if (!sleeperUserId || !leagues.length) {
    return (
      <section className="card dashboard-empty">
        <div className="dashboard-empty-icon"><Icon name="radio" size={40} /></div>
        <h2>Redzone</h2>
        <p className="muted">Lade zuerst deine Ligen im Setup.</p>
      </section>
    )
  }

  const liveGames = rz.games.filter((g) => g.state === 'in').length
  const next = rz.games.filter((g) => g.state === 'pre' && g.date).sort((a, b) => a.date.localeCompare(b.date))[0]
  const notice = rz.espnError
    || (rz.lastUpdated && !liveGames
      ? `Gerade läuft kein Spiel.${next ? ` Nächster Kickoff: ${new Date(next.date).toLocaleString('de-DE', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}`
      : null)

  return (
    <section className="rz-page">
      <header className="rz-head">
        <span className="rz-title">Redzone</span>
        {rz.week && <span className="rz-muted">Week {rz.week}</span>}
        {(liveGames || liveCount) > 0 && <span className="rz-live">{liveGames || liveCount} LIVE</span>}
        <Stamp at={rz.lastUpdated} />
        <button type="button" className="btn btn-secondary btn-sm" onClick={pollNow} disabled={rz.loading}>
          <Icon name="refresh" size={14} /> Aktualisieren
        </button>
      </header>

      {notice && <div className="rz-notice"><div className="rz-notice-box">{notice}</div></div>}

      <GameStrip games={rz.games} counts={view.counts} />
      <LeagueChips
        leagues={leagues.map((l) => ({ id: l.league_id, label: labelOf(l), avatar: l.avatar ?? null }))}
        activeIds={activeIds}
        onToggle={(id) => rz.toggleLeague(allIds, id)}
        onSolo={(id) => rz.soloLeague(allIds, id)}
      />
      <MatchupRow tiles={view.tiles} />

      <div className="rz-section rz-players"><div className="rz-h">Meine Spieler</div><MyPlayers players={view.mine} /></div>
      <div className="rz-section rz-alerts"><div className="rz-h">Redzone</div><RedzoneAlerts alerts={view.alerts} /></div>
      <div className="rz-section rz-opps"><div className="rz-h">Gegner live</div><OpponentsLive players={view.opponentsLive} /></div>
      <div className="rz-section rz-ticker"><div className="rz-h">Scoring</div><ScoringTicker items={view.ticker} /></div>
    </section>
  )
}
```

- [ ] **Step 4: Tests grün**

Run: `npx vitest run src/pages/RedzonePage.test.jsx`
Expected: PASS (5 Tests).

- [ ] **Step 5: Route + mobile Sync in `src/App.jsx`**
  - Imports: `import RedzonePage from './pages/RedzonePage'` (bei den Pages) und `import { useRedzoneStore } from './stores/useRedzoneStore'` (bei den Stores).
  - Unter `<Route path="/lineup" … />`: `<Route path="/redzone" element={<RedzonePage />} />`
  - In `handleMobileSync` vor dem `/trade`-Zweig:

```jsx
    } else if (nsPathname.startsWith('/redzone')) {
      useRedzoneStore.getState().poll({ leagues: availableLeagues, season: seasonYear, myUserId: sleeperUserId })
```
  - `mobileSyncLabel`: vor dem `/trade`-Fall `: nsPathname.startsWith('/redzone') ? 'Live-Daten aktualisieren'` einfügen.

- [ ] **Step 6: Gesamtsuite + Build**

Run: `npm test && npm run build`
Expected: Tests PASS, Build ohne Fehler.

- [ ] **Step 7: Commit**

```bash
git add src/pages/RedzonePage.jsx src/pages/RedzonePage.test.jsx src/App.jsx
git commit -m "feat(redzone): Seite /redzone mit Filter, Matchups, Spielern, Alarm und Ticker"
```

---

### Task 11: Einstiege nur während Live-Spielen

Sichtbar, wenn `liveCount > 0` **oder** die Redzone gerade offen ist (sonst verschwindet der aktive Eintrag unter dem Nutzer, sobald das letzte Spiel endet).

**Files:**
- Modify: `src/components/NextShell.jsx` (Rail + Befehlspalette)
- Modify: `src/styles/newshell.css` (Live-Rail-Button)
- Modify: `src/components/MobileMoreSheet.jsx` (Kachel)
- Modify: `src/components/MobileNav.jsx` (Live-Punkt am „Mehr“)
- Modify: `src/components/TabsNav.jsx` (Tab 560–899px)
- Modify: `src/styles/style.css` (Live-Varianten Kachel/Tab/Punkt)
- Modify: `src/pages/DashboardPage.jsx` (Banner)
- Test: `src/pages/DashboardPage.test.jsx` (anhängen)

**Interfaces:**
- Consumes: `useGamesLiveStore((s) => s.liveCount)` (Task 7), Klassen `.rz-dash-banner`, `.rz-live`, `.rz-dash-banner-cta` (Task 9).

- [ ] **Step 1: Failing test** — ans Ende von `src/pages/DashboardPage.test.jsx` (Imports ergänzen: `afterEach` aus vitest, `import { useGamesLiveStore } from '../stores/useGamesLiveStore'`)

```jsx
describe('Redzone-Banner', () => {
  afterEach(() => {
    useGamesLiveStore.setState({ liveCount: 0 })
    sessionState.availableLeagues = []
  })

  it('erscheint nur, solange NFL-Spiele laufen', () => {
    sessionState.availableLeagues = [{ league_id: 'L1', name: 'Büro-Liga' }]
    const { unmount } = setup()
    expect(screen.queryByText(/Redzone öffnen/)).not.toBeInTheDocument()
    unmount()

    useGamesLiveStore.setState({ liveCount: 3 })
    setup()
    expect(screen.getByRole('button', { name: /3 Spiele laufen/ })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Fehlschlag prüfen**

Run: `npx vitest run src/pages/DashboardPage.test.jsx`
Expected: FAIL (Button "3 Spiele laufen" nicht gefunden).

- [ ] **Step 3: Dashboard-Banner** — `src/pages/DashboardPage.jsx`
  - Imports: `import { useGamesLiveStore } from '../stores/useGamesLiveStore'` und `import '../styles/redzone.css'`
  - In `DashboardPage()` nach `const { nflState, … } = useDashboardStore()`: `const liveCount = useGamesLiveStore((s) => s.liveCount)`
  - Im Haupt-`return` direkt nach dem schließenden `</div>` von `.dashboard-header`:

```jsx
      {liveCount > 0 && (
        <button type="button" className="rz-dash-banner" onClick={() => navigate('/redzone')}>
          <span className="rz-live">LIVE</span>
          <b>{liveCount === 1 ? '1 Spiel läuft' : `${liveCount} Spiele laufen`}</b>
          <span className="rz-dash-banner-cta"><Icon name="radio" size={14} />Redzone öffnen</span>
        </button>
      )}
```

- [ ] **Step 4: Test grün**

Run: `npx vitest run src/pages/DashboardPage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Desktop-Rail + Befehlspalette** — `src/components/NextShell.jsx`
  - Import: `import { useGamesLiveStore } from '../stores/useGamesLiveStore'`
  - Nach `const { pathname } = useLocation()`:

```jsx
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const showRedzone = liveCount > 0 || pathname === '/redzone'
  const rail = showRedzone
    ? [...RAIL, { icon: 'radio', tip: liveCount > 0 ? `Redzone · ${liveCount} live` : 'Redzone', path: '/redzone', live: liveCount > 0 }]
    : RAIL
```
  - Im Rail-Rendering `RAIL.map((r) => (` → `rail.map((r) => (`, `className={cx('ns-rail-btn', pathname === r.path && 'is-active', r.live && 'ns-rail-btn--live')}` und nach dem Icon/Logo-Ausdruck: `{r.live && <span className="ns-rail-live-dot" aria-hidden="true" />}`
  - In `commands` nach dem Eintrag `Trade-Analyse`: `...(showRedzone ? [{ group: 'Gehe zu', label: 'Redzone', run: () => navigate('/redzone') }] : []),` und `showRedzone` in die Dependency-Liste des `useMemo` aufnehmen.
  - `src/styles/newshell.css`, nach `.ns-rail-btn.is-active::before { … }`:

```css
.ns-rail-btn--live { color: var(--live); }
.ns-rail-btn--live.is-active { color: var(--live); }
.ns-rail-btn--live.is-active::before { background: var(--live); }
.ns-rail-live-dot {
  position: absolute; top: 5px; right: 6px; width: 7px; height: 7px; border-radius: 50%;
  background: var(--live); box-shadow: 0 0 0 2px var(--surface-nav); animation: ns-live-pulse 1.6s infinite;
}
@keyframes ns-live-pulse { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .ns-rail-live-dot { animation: none; } }
```

- [ ] **Step 6: Mobile Einstiege**
  - `src/components/MobileMoreSheet.jsx`: Import `useGamesLiveStore`; in der Komponente

```jsx
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const nav = liveCount > 0 || pathname === '/redzone'
    ? [{ icon: 'radio', label: liveCount > 0 ? `Redzone · ${liveCount} live` : 'Redzone', path: '/redzone', live: liveCount > 0 }, ...NAV]
    : NAV
```
    `NAV.map` → `nav.map`, Kachel-Klasse `cx('mob-more-tile', pathname === n.path && 'is-active', n.live && 'mob-more-tile--live')`.
  - `src/components/MobileNav.jsx`: Import `useGamesLiveStore`; `const liveCount = useGamesLiveStore((s) => s.liveCount)`; im „Mehr“-Button `<Icon name="menu" size={20} />` ersetzen durch:

```jsx
          <span className="bmb-badge-wrap">
            <Icon name="menu" size={20} />
            {liveCount > 0 && <span className="bmb-live-dot" aria-hidden="true" />}
          </span>
```
    und dem Button `aria-label={liveCount > 0 ? 'Mehr – Spiele laufen' : 'Mehr'}` geben.
  - `src/components/TabsNav.jsx`: Import `useGamesLiveStore`; in `TabsNav()`

```jsx
  const liveCount = useGamesLiveStore((s) => s.liveCount)
  const tabs = liveCount > 0 || pathname === '/redzone'
    ? [...TABS, { path: '/redzone', label: 'Redzone', icon: 'radio', live: liveCount > 0 }]
    : TABS
```
    `TABS.map(({ path, label, icon }) =>` → `tabs.map(({ path, label, icon, live }) =>`, Klasse `cx('tab', active && 'active', live && 'tab--live')`.
  - `src/styles/style.css`, direkt nach `.bmb-badge { … }`:

```css
.bmb-live-dot { position: absolute; top: -2px; right: -5px; width: 7px; height: 7px; border-radius: 50%; background: var(--live); }
.mob-more-tile--live { color: var(--live); }
.tab--live { color: var(--live); }
```

- [ ] **Step 7: Gesamtsuite + Build**

Run: `npm test && npm run build`
Expected: PASS, Build ohne Fehler.

- [ ] **Step 8: Commit**

```bash
git add src/components/NextShell.jsx src/styles/newshell.css src/components/MobileMoreSheet.jsx src/components/MobileNav.jsx src/components/TabsNav.jsx src/styles/style.css src/pages/DashboardPage.jsx src/pages/DashboardPage.test.jsx
git commit -m "feat(redzone): Einstiege in Rail, Mehr-Sheet, Tabs und Dashboard nur bei Live-Spielen"
```

---

### Task 12: Live-Verifikation, Doku, Graph

Nicht automatisierbar: echte Sleeper-Ligen + laufende Spiele. **Zeitfenster:** Sonntag 19:00–06:00 MESZ, Montag/Donnerstag ~02:15 MESZ. Ohne Live-Spiel nur Teil A.

**Files:**
- Modify: `CLAUDE.md` (Routen-Liste)
- Modify: `docs/superpowers/specs/2026-09-13-live-redzone-design.md` (Status, Abweichungen)

- [ ] **Step 1: Server starten** — `preview_start` mit `name: "client"` aus `.claude/launch.json` (Vite-Client reicht; der `api`-Proxy wird für die Redzone nicht gebraucht). Mit echtem Account einloggen (Ligen im Setup geladen).

- [ ] **Step 2: Teil A (immer)** — `/redzone` direkt öffnen:
  - Konsole ohne Fehler (`read_console_messages`), Netzwerk: `site.api.espn.com/…/scoreboard` 200, `api.sleeper.app/v1/league/…/matchups/<week>` 200 je aktiver Liga.
  - Ohne Live-Spiel: Hinweis „Gerade läuft kein Spiel. Nächster Kickoff: …“, Rail-/Tab-/Sheet-Einstieg **nicht** sichtbar außer auf `/redzone` selbst, Dashboard ohne Banner.
  - Filter: Liga abwählen → nur noch aktive Ligen im Netzwerk-Log beim nächsten Poll; letzte Liga lässt sich nicht abwählen; Doppelklick = nur diese, nochmal = alle; Reload behält Auswahl (`localStorage['sdh-redzone-v1']`).
  - Theme-Wechsel Ferrari/Nike: LIVE-Badge gelb bzw. orange, übrige Themes rot.
  - Viewport `mobile` (375px) und 700px: Chips sticky, Matchups seitlich wischbar, keine horizontale Seiten-Scrollbar.

- [ ] **Step 3: Teil B (während Live-Spielen)**
  - Einstiege erscheinen binnen 2 min (Rail mit rotem Punkt, Mehr-Punkt, Tab, Dashboard-Banner).
  - Spielleiste: Stand/Uhr stimmen mit ESPN-Gamecast überein (max. ~40 s Verzug). Redzone-Karte bei `isRedZone`.
  - Punkte eigener Spieler vs. Sleeper-App vergleichen; **Verzug von `players_points` notieren** (Spec: bisher ungemessen).
  - Scoring-Ticker: neuer TD eines eigenen Starters erscheint hervorgehoben; Netzwerk: `summary?event=` nur nach Score-Änderung eines relevanten Spiels.
  - Screenshot Desktop + mobil → `SendUserFile`.

- [ ] **Step 4: Ehrlich berichten** — was A/B tatsächlich geprüft hat, was nicht (z. B. „kein Live-Spiel verfügbar, Teil B offen“).

- [ ] **Step 5: Doku**
  - `CLAUDE.md`, Abschnitt „`App.jsx` is the orchestrator“: Routen-Liste auf den tatsächlichen Stand bringen: `/dashboard`, `/setup`, `/board`, `/analyse`, `/lineup`, `/trade`, `/profiles`, `/redzone`.
  - Spec: Status → „Umgesetzt“, Abweichungen vermerken: Bausteine in einer Datei `RedzoneParts.jsx`; Live-Erkennung als `useGamesLiveStore` (nextKickoff aus ESPN-Daten der Seite); Punkte je Spieler = höchster Wert über Ligen.

- [ ] **Step 6: Graph + Commit**

Run: `graphify update .`

```bash
git add CLAUDE.md docs/superpowers/specs/2026-09-13-live-redzone-design.md graphify-out
git commit -m "docs(redzone): Routen, Spec-Status und Graph aktualisiert"
```

---

## Self-Review (erledigt beim Schreiben)

- **Spec-Abdeckung:** fünf Bausteine (T9/T10), Sichtbarkeit nur live (T7/T11), Filter ohne „Alle“ + Persistenz (T3/T8/T9), kein Server (T2/T7), 30 s/2 min Polling (T7/T10), Summary-Sparregel (T8), Theme-Live-Farben (T1), Fehlerfälle ESPN/Liga/Projektion/Namensabgleich (T4/T5/T8/T10), Tests + Live-Verifikation (alle/T12).
- **Bewusste Abweichungen von der Spec:** eine Komponentendatei statt sechs; `useGamesLiveStore` statt `useGamesLive`-Hook (mehrere Leser, ein Poller); „nächster Kickoff“ aus ESPN statt Sleeper-Spielplan (Sleeper liefert nur Datum ohne Uhrzeit).
- **Typen konsistent:** `Game`/`Play` (T2) → `Entry`/`Tile` (T4) → Alerts/Ticker (T5) → Store-State (T8) → Page-Props (T9/T10).
