# Season-Simulator V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vierter Reiter „Saison" auf der Analyse-Seite: Playoff-%/Bye-%/Title-% + proj. W-L aus 10k lokalen Monte-Carlo-Sims im WebWorker, ohne KI-Key.

**Architecture:** Drei reine Service-Module (`seasonSim.js`: Sim-Mathematik, `seasonSchedule.js`: Schedule/Playoff-Cutoff, `seasonStrengths.js`: Starter-Auswahl via bestehendem `bestLineup` + Projektions-Summe) plus dünner `simWorker.js`, Hook `useSeasonSim.js` (lädt Inputs, steuert Worker) und presentational `SeasonTab.jsx`. Keine Store-Änderungen, kein App.jsx-Umbau (pageProps enthält alles).

**Tech Stack:** React 18, Vite WebWorker (`new Worker(new URL(...), {type:'module'})`), Vitest (colocierte `*.test.js`, Stil wie `draftStats.test.js`), vorhandene Sleeper-API-Funktionen aus `src/services/api.js`.

**Spec:** `docs/superpowers/specs/2026-09-10-season-simulator-design.md`

## Global Constraints

- UI-Texte, Kommentare und user-facing Strings sind Deutsch.
- Keine neuen npm-Dependencies.
- Keine Änderungen an `useDynastyStore.js`, `waiverStats.js`, `api.js`, `App.jsx` (nur neue Dateien + `AnalysisPage.jsx` + `analysis.css` + Tests).
- `console.warn` für Ladefehler (Konvention aus `useDynastyStore.js:126`), keine Throws an die UI.
- Fehlende Projektionen sind KEIN 0-Punkte-Fake: Replacement-Level-Fallback + `missingCount`, Badge „reduzierte Genauigkeit" ab >2 fehlenden Startern.
- Kein `localStorage` für Sim-Ergebnisse (Ergebnis lebt im Hook-State, verfällt bei Unmount).
- ELO-Skala fix `400` (`ELO_SCALE`), Default `10000` Sims (`DEFAULT_SIMS`), Chunk `1000` (`SIM_CHUNK`).

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `src/services/analysis/seasonSim.js` (neu) | Reine Sim-Mathematik: `ELO_SCALE`, `mulberry32`, `winProbability`, `pointsFieldFor`, `simulateSeason`, `aggregateOdds` |
| `src/services/analysis/seasonSim.test.js` (neu) | Vitest für obiges, fester Seed |
| `src/services/analysis/seasonSchedule.js` (neu) | `buildRemainingSchedule` (matchup_id-Gruppierung), `playoffCutoff` (ai.js-Konvention + Fallbacks) |
| `src/services/analysis/seasonSchedule.test.js` (neu) | Vitest für obiges |
| `src/services/analysis/seasonStrengths.js` (neu) | `buildIdRankMaps` (Muster `LineupPage.jsx:191`), `selectAndScore` (bestLineup-Auswahl + Projektions-Summe + Replacement + Dynasty-Tiebreak) |
| `src/services/analysis/seasonStrengths.test.js` (neu) | Vitest mit Fixture-Rank-Maps |
| `src/workers/simWorker.js` (neu) | Dünner Worker: `run`/`cancel`-Protokoll, ruft `simulateSeason` chunkweise auf, postet Progress |
| `src/hooks/useSeasonSim.js` (neu) | Lädt Raw-Rosters + Meta + NFL-State + Rank-Maps + Projektionen + Matchups, baut Stärken, steuert Worker |
| `src/hooks/useSeasonSim.test.js` (neu) | Vitest mit `vi.stubGlobal('fetch')`, Worker als `vi.mock` |
| `src/components/analysis/SeasonTab.jsx` (neu) | Presentational: `SimControls` + `OddsTable`, Zustände idle/loading/progress/done/unavailable |
| `src/components/analysis/SeasonTab.test.jsx` (neu) | Render-Test mit statischen Props |
| `src/pages/AnalysisPage.jsx` (ändern) | `TABS` + `'saison'`, Panel rendert `SeasonTab`, neue Props `selectedLeague, seasonYear, effScoringType` (kommen aus pageProps) |
| `src/styles/analysis.css` (ändern) | `.an-odds-table`, `.an-sim-controls`, `.an-progress`, `.an-badge` |

**Interfaces (Namen sind verbindlich, alle Tasks nutzen exakt diese):**
- `winProbability(delta: number): number`
- `pointsFieldFor(scoringType: 'ppr'|'half_ppr'|'standard'|null): 'pts_ppr'|'pts_half_ppr'|'pts_std'`
- `mulberry32(seed: number): () => number` (gibt Funktion zurück, die [0,1) liefert)
- `simulateSeason({ strengthsByWeek: Map<number, Map<string,number>>, schedule: Array<{week:number,a:string,b:string}>, playoffTeams: number, seed: number }): { wins: Map<string,number>, champion: string|null, topSeeds: Array<string> }` — genau EINE Saison
- `aggregateOdds(results: Array<{wins:Map,champion,topSeeds}>, { rosterIds: Array<string>, sims: number }): Map<string,{winsAvg:number,playoffPct:number,byePct:number,titlePct:number}>`
- `buildRemainingSchedule({ matchupsByWeek: Map<number,Array<{matchup_id:number,roster_id:number}>>, fromWeek: number }): Array<{week:number,a:string,b:string}>` (roster_ids als String; Wochen ohne gültige Paare werden übersprungen)
- `playoffCutoff({ league }): { playoffWeekStart: number, playoffTeams: number }` (Regel: `league?.playoff_start_week ?? league?.settings?.playoff_week_start ?? 15`; Teams: `league?.settings?.playoff_teams_count ?? 6`)
- `buildIdRankMaps({ rosterPlayers, getRankMap }): { wk: Map, fx: Map, sfx: Map }` (Keys `ID:${sleeper_id}`, Quelle `matchKey` aus `waiverStats.js`, Scopes `week`, Positionen QB/RB/WR/TE/DEF + FLEX + SUPER_FLEX)
- `selectAndScore({ rosterPlayers, rosterPositions, rankMaps: {wk,fx,sfx}, byeWeek: string|null, pointsById: Map, field: string, dynastyValuesByName: Map|null }): { points: number, missingCount: number, starterIds: Array<string> }` (Auswahl via `bestLineup`, Summe via `pointsById`; fehlende Projektion = Positions-Minimum der projizierten Starter = Replacement-Level, sonst 0; Dynasty-Tiebreak: `dynastyValuesByName` null im Redraft-Modus)
- Worker-Protokoll: inbound `{type:'run', payload:{strengthsByWeek, schedule, playoffTeams, sims, seed}}` / `{type:'cancel'}`; outbound `{type:'progress', done:number, total:number}` / `{type:'done', results:Array}` / `{type:'error', message:string}`. `strengthsByWeek` reist als `Array<[week, Array<[rosterId, points]>]>` (Maps sind nicht structured-clone-sicher über alle Android-WebViews — Arrays schon).
- `useSeasonSim({ league, seasonYear, scoringType, rosterPositions, ownerLabels })` gibt zurück `{ state:'idle'|'loading'|'simulating'|'done'|'unavailable', progress:{done,total}|null, odds:Array<{rosterId:string,name:string,isMine:boolean,winsAvg,playoffPct,byePct,titlePct,reducedAccuracy:boolean}>|null, unavailableReason:string|null, start:()=>void, cancel:()=>void }`. Simuliert wird NUR nach explizitem `start()` (kein Auto-Run beim Tab-Wechsel — 10k Sims + ~17 Matchup-Requests kosten sonst bei jedem Klick).

---

### Task 1: Sim-Mathematik (`seasonSim.js`)

**Files:**
- Create: `src/services/analysis/seasonSim.js`
- Test: `src/services/analysis/seasonSim.test.js`

**Interfaces:**
- Consumes: nichts (eigenständig, keine Imports ausser Vitest im Test)
- Produces: `ELO_SCALE`, `DEFAULT_SIMS`, `SIM_CHUNK`, `mulberry32`, `winProbability`, `pointsFieldFor`, `simulateSeason`, `aggregateOdds` (Signaturen siehe oben)

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { ELO_SCALE, winProbability, pointsFieldFor, mulberry32, simulateSeason, aggregateOdds } from './seasonSim'

describe('winProbability', () => {
  it('delta 0 ergibt 0.5', () => {
    expect(winProbability(0)).toBe(0.5)
  })
  it('positives Delta ergibt > 0.5, symmetrisch zu negativem', () => {
    expect(winProbability(50)).toBeGreaterThan(0.5)
    expect(winProbability(50)).toBeCloseTo(1 - winProbability(-50), 10)
  })
  it('ELO_SCALE ist 400', () => {
    expect(ELO_SCALE).toBe(400)
  })
})

describe('pointsFieldFor', () => {
  it('mappt ppr/half_ppr/standard auf Sleeper-Projektionsfelder', () => {
    expect(pointsFieldFor('ppr')).toBe('pts_ppr')
    expect(pointsFieldFor('half_ppr')).toBe('pts_half_ppr')
    expect(pointsFieldFor('standard')).toBe('pts_std')
  })
  it('unbekannt/null faellt auf pts_ppr zurueck', () => {
    expect(pointsFieldFor(null)).toBe('pts_ppr')
    expect(pointsFieldFor('komisch')).toBe('pts_ppr')
  })
})

describe('mulberry32', () => {
  it('gleicher Seed ergibt gleiche Folge', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('Werte liegen in [0,1)', () => {
    const r = mulberry32(7)
    for (let i = 0; i < 50; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

const strengthsByWeek = new Map([
  [1, new Map([['1', 120], ['2', 100]])],
  [2, new Map([['1', 120], ['2', 100]])],
])
const schedule = [{ week: 1, a: '1', b: '2' }, { week: 2, a: '1', b: '2' }]

describe('simulateSeason', () => {
  it('staerkeres Team gewinnt im Mittel mehr Spiele (fester Seed)', () => {
    let w1 = 0
    for (let s = 0; s < 20; s++) {
      const r = simulateSeason({ strengthsByWeek, schedule, playoffTeams: 2, seed: s })
      w1 += r.wins.get('1')
    }
    expect(w1 / 20).toBeGreaterThan(1.2)
  })
  it('liefert Champion und topSeeds nach Siegen sortiert', () => {
    const r = simulateSeason({ strengthsByWeek, schedule, playoffTeams: 2, seed: 3 })
    expect(['1', '2']).toContain(r.champion)
    expect(r.topSeeds[0]).toBe('1')
  })
  it('leerer Schedule ergibt 0 Siege und keinen Champion', () => {
    const r = simulateSeason({ strengthsByWeek, schedule: [], playoffTeams: 2, seed: 1 })
    expect(r.wins.get('1')).toBe(0)
    expect(r.champion).toBeNull()
  })
})

describe('aggregateOdds', () => {
  it('mittelt Siege und zaehlt Playoff/Bye/Title als Prozent', () => {
    const results = [
      { wins: new Map([['1', 10], ['2', 4]]), champion: '1', topSeeds: ['1', '2'] },
      { wins: new Map([['1', 8], ['2', 6]]), champion: '2', topSeeds: ['1', '2'] },
    ]
    const odds = aggregateOdds(results, { rosterIds: ['1', '2'], sims: 2 })
    expect(odds.get('1').winsAvg).toBe(9)
    expect(odds.get('1').playoffPct).toBe(100)
    expect(odds.get('1').titlePct).toBe(50)
    expect(odds.get('1').byePct).toBe(100)
    expect(odds.get('2').titlePct).toBe(50)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/analysis/seasonSim.test.js`
Expected: FAIL with "Failed to resolve import ./seasonSim" (Datei existiert noch nicht)

- [ ] **Step 3: Write minimal implementation**

```js
// Saison-Simulation: reine Mathematik, kein Store-, kein Netzwerk-Zugriff.
// Alle IDs sind Strings (roster_id als String, vgl. useDynastyStore rMap).
export const ELO_SCALE = 400
export const DEFAULT_SIMS = 10000
export const SIM_CHUNK = 1000

// Deterministischer RNG, damit Tests mit festem Seed reproduzierbar sind.
// Der Hook nutzt Date.now() als Seed, Tests eine feste Zahl.
export function mulberry32(seed) {
  let a = Number(seed) >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ELO-Erwartung: p = 1 / (1 + 10^(-delta/400)). delta in projizierten Punkten.
export function winProbability(delta) {
  const d = Number(delta)
  if (!Number.isFinite(d)) return 0.5
  return 1 / (1 + Math.pow(10, -d / ELO_SCALE))
}

// effScoringType ('ppr'|'half_ppr'|'standard', vgl. draftFormat.js) ->
// Sleeper-Wochenprojektionsfeld (vgl. useWeeklyRankingsStore sleeperWeekById).
export function pointsFieldFor(scoringType) {
  if (scoringType === 'half_ppr') return 'pts_half_ppr'
  if (scoringType === 'standard') return 'pts_std'
  return 'pts_ppr'
}

// Genau EINE Saison: Regular Season aus schedule, danach Seeding nach Siegen
// (Tiebreak Rest-Staerke) und vereinfachter K.-o.-Baum (kein Einzelmatchup-Sim
// im Baum -- V1-Vereinfachung, im Spec dokumentiert). Bye: ab 8 Playoff-Teams
// bekommen die Top-2-Seeds ein Freilos (haeufigstes Sleeper-Format).
export function simulateSeason({ strengthsByWeek, schedule, playoffTeams, seed }) {
  const rng = mulberry32(seed)
  const teams = Math.max(2, Number(playoffTeams) || 2)
  const wins = new Map()
  const strengthOf = (week, id) => {
    const w = strengthsByWeek?.get(week)
    const v = w?.get(String(id))
    return Number.isFinite(Number(v)) ? Number(v) : 0
  }
  for (const g of schedule || []) {
    const a = String(g.a)
    const b = String(g.b)
    if (!wins.has(a)) wins.set(a, 0)
    if (!wins.has(b)) wins.set(b, 0)
    const p = winProbability(strengthOf(g.week, a) - strengthOf(g.week, b))
    if (rng() < p) wins.set(a, wins.get(a) + 1)
    else wins.set(b, wins.get(b) + 1)
  }
  const ids = [...wins.keys()]
  if (!ids.length) return { wins, champion: null, topSeeds: [] }
  const lastWeek = Math.max(...(schedule || []).map((g) => Number(g.week) || 0), 0)
  const ranked = [...ids].sort((x, y) => {
    const dw = wins.get(y) - wins.get(x)
    if (dw !== 0) return dw
    return strengthOf(lastWeek, y) - strengthOf(lastWeek, x)
  })
  const cut = ranked.slice(0, Math.min(teams, ranked.length))
  const byeCount = cut.length >= 8 ? 2 : 0
  const byeSeeds = cut.slice(0, byeCount)
  let round = cut.slice(byeCount)
  // Auf ungerade Runden auffuellen kann nicht passieren: cut ohne Byes ist
  // nur bei < 8 Teams ungerade moeglich (z.B. 6) -- dann bekommt Seed 1 das Freilos.
  if (round.length % 2 === 1) {
    byeSeeds.push(round.shift())
  }
  const playRound = (players) => {
    const winners = []
    for (let i = 0; i < players.length; i += 2) {
      const x = players[i]
      const y = players[i + 1]
      if (y == null) { winners.push(x); continue }
      const p = winProbability(strengthOf(lastWeek, x) - strengthOf(lastWeek, y))
      winners.push(rng() < p ? x : y)
    }
    return winners
  }
  let alive = [...byeSeeds, ...playRound(round)]
  while (alive.length > 1) alive = playRound(alive)
  return { wins, champion: alive[0] ?? null, topSeeds: cut }
}
```

```js
// Zaehlt N Einzelsaisons zu Odds pro Team. playoffPct: Team unter den topSeeds;
// byePct: unter den ersten 2 bei >= 8 Teams, sonst unter erstem Seed bei Freilos.
export function aggregateOdds(results, { rosterIds, sims }) {
  const n = Math.max(1, Number(sims) || 1)
  const out = new Map()
  for (const id of rosterIds || []) {
    out.set(String(id), { winsAvg: 0, playoffPct: 0, byePct: 0, titlePct: 0 })
  }
  for (const r of results || []) {
    for (const [id, w] of r.wins || []) {
      const key = String(id)
      if (out.has(key)) out.get(key).winsAvg += Number(w) || 0
    }
    const seeds = (r.topSeeds || []).map(String)
    const byeCount = seeds.length >= 8 ? 2 : seeds.length % 2 === 1 ? 1 : 0
    for (const s of seeds) {
      if (out.has(s)) out.get(s).playoffPct += 100 / n
    }
    for (const s of seeds.slice(0, byeCount)) {
      if (out.has(s)) out.get(s).byePct += 100 / n
    }
    const champ = r.champion != null ? String(r.champion) : null
    if (champ && out.has(champ)) out.get(champ).titlePct += 100 / n
  }
  for (const v of out.values()) v.winsAvg /= n
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/analysis/seasonSim.test.js`
Expected: PASS (alle 11 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/seasonSim.js src/services/analysis/seasonSim.test.js
git commit -m "feat(season-sim): Sim-Mathematik (ELO, simulateSeason, aggregateOdds)"
```

### Task 2: Schedule + Playoff-Cutoff (`seasonSchedule.js`)

**Files:**
- Create: `src/services/analysis/seasonSchedule.js`
- Test: `src/services/analysis/seasonSchedule.test.js`

**Interfaces:**
- Consumes: nichts (reine Funktionen)
- Produces: `buildRemainingSchedule`, `playoffCutoff` (Signaturen siehe oben)

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { buildRemainingSchedule, playoffCutoff } from './seasonSchedule'

describe('buildRemainingSchedule', () => {
  it('gruppiert Matchups per matchup_id zu Paaren', () => {
    const byWeek = new Map([
      [5, [
        { matchup_id: 1, roster_id: 1 },
        { matchup_id: 1, roster_id: 2 },
        { matchup_id: 2, roster_id: 3 },
        { matchup_id: 2, roster_id: 4 },
      ]],
    ])
    expect(buildRemainingSchedule({ matchupsByWeek: byWeek, fromWeek: 5 })).toEqual([
      { week: 5, a: '1', b: '2' },
      { week: 5, a: '3', b: '4' },
    ])
  })
  it('ignoriert Wochen vor fromWeek und unvollstaendige Paare', () => {
    const byWeek = new Map([
      [3, [{ matchup_id: 1, roster_id: 1 }, { matchup_id: 1, roster_id: 2 }]],
      [5, [{ matchup_id: 1, roster_id: 1 }]],
    ])
    expect(buildRemainingSchedule({ matchupsByWeek: byWeek, fromWeek: 5 })).toEqual([])
  })
  it('leere Eingabe ergibt leeren Schedule', () => {
    expect(buildRemainingSchedule({ matchupsByWeek: new Map(), fromWeek: 1 })).toEqual([])
  })
})

describe('playoffCutoff', () => {
  it('liest ai.js-Konvention playoff_start_week zuerst', () => {
    expect(playoffCutoff({ league: { playoff_start_week: 15, settings: { playoff_week_start: 14, playoff_teams_count: 8 } } }))
      .toEqual({ playoffWeekStart: 15, playoffTeams: 8 })
  })
  it('faellt auf settings.playoff_week_start und 6 Teams zurueck', () => {
    expect(playoffCutoff({ league: { settings: {} } })).toEqual({ playoffWeekStart: 15, playoffTeams: 6 })
    expect(playoffCutoff({ league: null })).toEqual({ playoffWeekStart: 15, playoffTeams: 6 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/analysis/seasonSchedule.test.js`
Expected: FAIL with "Failed to resolve import ./seasonSchedule"

- [ ] **Step 3: Write minimal implementation**

```js
// Rest-Spielplan aus Sleeper-Matchups: /matchups/{woche} liefert pro Roster
// { matchup_id, roster_id } -- gleiche matchup_id = Gegner dieser Woche.
// Nur Wochen >= fromWeek, nur vollstaendige Paare (unvollstaendige = Bye-Week
// der Liga oder fehlgeschlagener Request, beides wird uebersprungen).
export function buildRemainingSchedule({ matchupsByWeek, fromWeek }) {
  const from = Number(fromWeek) || 1
  const out = []
  for (const [week, matchups] of matchupsByWeek || []) {
    const w = Number(week)
    if (!Number.isFinite(w) || w < from) continue
    const byMatchup = new Map()
    for (const m of matchups || []) {
      if (m?.matchup_id == null || m?.roster_id == null) continue
      const key = String(m.matchup_id)
      if (!byMatchup.has(key)) byMatchup.set(key, [])
      byMatchup.get(key).push(String(m.roster_id))
    }
    for (const ids of byMatchup.values()) {
      if (ids.length === 2) out.push({ week: w, a: ids[0], b: ids[1] })
    }
  }
  out.sort((x, y) => x.week - y.week)
  return out
}

// Playoff-Format: Feld-Konvention wie ai.js:267 (league.playoff_start_week)
// zuerst, dann settings.playoff_week_start, Default 15. Team-Anzahl aus
// settings.playoff_teams_count, Default 6 (haeufigstes Sleeper-Format).
export function playoffCutoff({ league }) {
  const start = Number(league?.playoff_start_week ?? league?.settings?.playoff_week_start)
  const teams = Number(league?.settings?.playoff_teams_count)
  return {
    playoffWeekStart: Number.isFinite(start) && start > 0 ? start : 15,
    playoffTeams: Number.isFinite(teams) && teams > 0 ? teams : 6,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/analysis/seasonSchedule.test.js`
Expected: PASS (alle 5 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/seasonSchedule.js src/services/analysis/seasonSchedule.test.js
git commit -m "feat(season-sim): Rest-Spielplan und Playoff-Cutoff"
```

### Task 3: Stärken-Berechnung (`seasonStrengths.js`)

**Files:**
- Create: `src/services/analysis/seasonStrengths.js`
- Test: `src/services/analysis/seasonStrengths.test.js`

**Interfaces:**
- Consumes: `bestLineup`, `matchKey` aus `./waiverStats` (bestehend, getestet); `pointsFieldFor` aus `./seasonSim` (Task 1)
- Produces: `buildIdRankMaps`, `selectAndScore` (Signaturen siehe oben)

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect } from 'vitest'
import { buildIdRankMaps, selectAndScore } from './seasonStrengths'

const players = [
  { sleeper_id: '1', name: 'Q Back', nname: 'q back', pos: 'QB', team: 'CHI', bye: '5' },
  { sleeper_id: '2', name: 'R Back', nname: 'r back', pos: 'RB', team: 'KC', bye: '6' },
  { sleeper_id: '3', name: 'W Receiver', nname: 'w receiver', pos: 'WR', team: 'SEA', bye: '5' },
]

// getRankMap-Fake im Muster von useWeeklyRankingsStore: matchKey -> ECR.
const fakeGetRankMap = ({ pos }) => {
  const maps = {
    QB: new Map([['NAME:q back', 7]]),
    RB: new Map([['NAME:r back', 12]]),
    WR: new Map([['NAME:w receiver', 4]]),
    TE: new Map(),
    DEF: new Map(),
    FLEX: new Map([['NAME:r back', 20], ['NAME:w receiver', 10]]),
    SUPER_FLEX: new Map(),
  }
  return maps[pos] || new Map()
}

describe('buildIdRankMaps', () => {
  it('mappt Raenge auf ID:-Keys pro Spieler', () => {
    const { wk } = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    expect(wk.get('ID:1')).toBe(7)
    expect(wk.get('ID:2')).toBe(12)
    expect(wk.get('ID:3')).toBe(4)
  })
  it('legt Flex-Maps an', () => {
    const { fx } = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    expect(fx.get('ID:3')).toBe(10)
  })
})

const pointsById = new Map([
  ['1', { pts_ppr: 18.3, pts_half_ppr: 17.5, pts_std: 16.0 }],
  ['2', { pts_ppr: 12.3, pts_half_ppr: 12.0, pts_std: 11.5 }],
  ['3', { pts_ppr: 16.3, pts_half_ppr: 15.0, pts_std: 13.0 }],
])

describe('selectAndScore', () => {
  it('summiert Projektionen der bestLineup-Starter', () => {
    const rankMaps = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    const r = selectAndScore({
      rosterPlayers: players,
      rosterPositions: ['QB', 'RB', 'WR', 'BN', 'BN'],
      rankMaps,
      byeWeek: null,
      pointsById,
      field: 'pts_ppr',
      dynastyValuesByName: null,
    })
    expect(r.missingCount).toBe(0)
    expect(r.points).toBeCloseTo(18.3 + 12.3 + 16.3, 5)
    expect(r.starterIds).toHaveLength(3)
  })
  it('schliesst Bye-Week-Spieler fuer die Simulations-Woche aus', () => {
    const rankMaps = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    const r = selectAndScore({
      rosterPlayers: players,
      rosterPositions: ['QB', 'RB', 'WR', 'BN', 'BN'],
      rankMaps,
      byeWeek: '5',
      pointsById,
      field: 'pts_ppr',
      dynastyValuesByName: null,
    })
    // QB (Bye 5) und WR (Bye 5) fallen raus -- nur RB bleibt Starter.
    expect(r.points).toBeCloseTo(12.3, 5)
  })
  it('fehlende Projektion zaehlt Replacement-Level, nicht 0', () => {
    const rankMaps = buildIdRankMaps({ rosterPlayers: players, getRankMap: fakeGetRankMap })
    const thin = new Map([[ '1', { pts_ppr: 18.3 } ]])
    const r = selectAndScore({
      rosterPlayers: players,
      rosterPositions: ['QB', 'RB', 'WR', 'BN', 'BN'],
      rankMaps,
      byeWeek: null,
      pointsById: thin,
      field: 'pts_ppr',
      dynastyValuesByName: null,
    })
    expect(r.missingCount).toBe(2)
    // Replacement = Positions-Minimum der projizierten Starter; hier kennt nur
    // QB eine Projektion -> RB/WR fallen auf 0 zurueck, QB zahlt voll.
    expect(r.points).toBeCloseTo(18.3, 5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/analysis/seasonStrengths.test.js`
Expected: FAIL with "Failed to resolve import ./seasonStrengths"

- [ ] **Step 3: Write minimal implementation**

```js
// Team-Staerke = Summe der Wochenprojektionen der optimalen Starter.
// Auswahl via bestLineup (Rang-Maps, selbe Engine wie LineupPage), Groesse via
// Sleeper-Wochenprojektion (Punkte). Trennung ist Absicht: Raenge ordnen,
// Punkte zaehlen.
import { bestLineup, matchKey } from './waiverStats'

const WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']

// Baut ID:-Rank-Maps nach dem Muster von LineupPage.jsx:191-205: FantasyPros-
// Maps sind per matchKey (NAME:/TEAM:) geschluesselt, bestLineup braucht
// ID:${sleeper_id}. getRankMap ist useWeeklyRankingsStore.getRankMap.
export function buildIdRankMaps({ rosterPlayers, getRankMap }) {
  const wk = new Map()
  const fx = new Map()
  const sfx = new Map()
  for (const pos of WEEK_POSITIONS) {
    const rm = getRankMap({ pos, scope: 'week' })
    for (const p of rosterPlayers || []) {
      if ((p.pos || '').toUpperCase() !== pos) continue
      const v = rm.get(matchKey(pos, p))
      if (v != null) wk.set(`ID:${p.sleeper_id}`, v)
    }
  }
  const flexMap = getRankMap({ pos: 'FLEX', scope: 'week' })
  const sflexMap = getRankMap({ pos: 'SUPER_FLEX', scope: 'week' })
  for (const p of rosterPlayers || []) {
    const fv = flexMap.get(matchKey(p.pos, p))
    if (fv != null) fx.set(`ID:${p.sleeper_id}`, fv)
    const sv = sflexMap.get(matchKey(p.pos, p))
    if (sv != null) sfx.set(`ID:${p.sleeper_id}`, sv)
  }
  return { wk, fx, sfx }
}

// Wählt Starter via bestLineup (byeWeek = simulierte Woche als String, null =
// keine Bye-Beruecksichtigung) und summiert deren Projektionspunkte.
// Fehlende Projektion: Positions-Minimum der projizierten Starter im selben
// Aufruf (Replacement-Level, VORP-lite); gibt es keines, 0. missingCount
// zaehlt die Ersetzungen fuer das Genauigkeits-Badge.
// dynastyValuesByName (Map nname -> dynasty_value, nur Rookie-Modus, sonst
// null): bei < 0.5 Punkten Differenz gewinnt das hoehere Dynasty-Total mit
// p = 0.55 statt der ELO-Formel -- der Aufrufer (Hook) reicht dafuer beide
// Totals mit; diese Funktion liefert dafuer dynastyTotal im Ergebnis.
export function selectAndScore({ rosterPlayers, rosterPositions, rankMaps, byeWeek, pointsById, field, dynastyValuesByName }) {
  const res = bestLineup({
    myRosterPlayers: rosterPlayers || [],
    rosterPositions: rosterPositions || [],
    weeklyRankByKey: rankMaps?.wk || new Map(),
    flexRankByKey: rankMaps?.fx || new Map(),
    superflexRankByKey: rankMaps?.sfx || new Map(),
    currentWeekBye: byeWeek,
  })
  const starters = (res.slots || []).filter((s) => s.player)
  const knownByPos = new Map()
  for (const s of starters) {
    const pts = pointsById?.get(String(s.player.sleeper_id))?.[field]
    if (Number.isFinite(Number(pts))) {
      const pos = (s.player.pos || '').toUpperCase()
      if (!knownByPos.has(pos) || Number(pts) < knownByPos.get(pos)) knownByPos.set(pos, Number(pts))
    }
  }
  let points = 0
  let missingCount = 0
  let dynastyTotal = 0
  const starterIds = []
  for (const s of starters) {
    starterIds.push(String(s.player.sleeper_id))
    const raw = pointsById?.get(String(s.player.sleeper_id))?.[field]
    if (Number.isFinite(Number(raw))) {
      points += Number(raw)
    } else {
      missingCount += 1
      points += knownByPos.get((s.player.pos || '').toUpperCase()) ?? 0
    }
    if (dynastyValuesByName) {
      const dv = Number(dynastyValuesByName.get(s.player.nname))
      if (Number.isFinite(dv)) dynastyTotal += dv
    }
  }
  return { points, missingCount, starterIds, dynastyTotal }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/services/analysis/seasonStrengths.test.js`
Expected: PASS (alle 5 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/seasonStrengths.js src/services/analysis/seasonStrengths.test.js
git commit -m "feat(season-sim): Staerken-Berechnung (bestLineup-Auswahl + Projektions-Summe)"
```

### Task 4: Worker (`simWorker.js`)

**Files:**
- Create: `src/workers/simWorker.js`

**Interfaces:**
- Consumes: `simulateSeason`, `aggregateOdds` aus `../services/analysis/seasonSim` (Task 1); Protokoll siehe oben
- Produces: Worker-Skript (kein Unit-Test — Vitest kann Worker nicht laden; Abdeckung über Task-1-Tests + manuellen Check in Step 4)

- [ ] **Step 1: Write the worker**

```js
// Duenner WebWorker fuer die Saison-Simulation: empfaengt Inputs, simuliert in
// SIM_CHUNK-Bloecken (UI bleibt responsiv, Progress pro Block), postet Odds.
// Abbruch via {type:'cancel'}. Kein Unit-Test (Vitest laedt keine Worker);
// Logik liegt in seasonSim.js und ist dort getestet.
import { simulateSeason, aggregateOdds, SIM_CHUNK } from '../services/analysis/seasonSim'

let cancelled = false

function toMap(pairs) {
  const m = new Map()
  for (const [k, v] of pairs || []) m.set(k, v)
  return m
}

self.onmessage = (e) => {
  const msg = e?.data || {}
  if (msg.type === 'cancel') { cancelled = true; return }
  if (msg.type !== 'run') return
  cancelled = false
  try {
    const p = msg.payload || {}
    const strengthsByWeek = new Map()
    for (const [week, pairs] of p.strengthsByWeek || []) {
      strengthsByWeek.set(Number(week), toMap(pairs))
    }
    const schedule = (p.schedule || []).map((g) => ({ week: Number(g.week), a: String(g.a), b: String(g.b) }))
    const sims = Math.max(1, Number(p.sims) || 1)
    const rosterIds = [...new Set(schedule.flatMap((g) => [g.a, g.b]))]
    const results = []
    const chunk = SIM_CHUNK
    for (let done = 0; done < sims; done += chunk) {
      if (cancelled) return
      const n = Math.min(chunk, sims - done)
      for (let i = 0; i < n; i++) {
        results.push(simulateSeason({
          strengthsByWeek,
          schedule,
          playoffTeams: p.playoffTeams,
          seed: (Number(p.seed) || 0) + done + i,
        }))
      }
      self.postMessage({ type: 'progress', done: Math.min(done + n, sims), total: sims })
    }
    if (cancelled) return
    const odds = aggregateOdds(results, { rosterIds, sims })
    self.postMessage({ type: 'done', results: [...odds.entries()].map(([rosterId, o]) => ({ rosterId, ...o })) })
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.message || err) })
  }
}
```

- [ ] **Step 2: Verify worker loads in dev (manueller Check, kein Vitest)**

Run: `npm run dev:all` (in zwei Terminals oder Hintergrund), öffne `http://localhost:5173`, DevTools-Console:
```js
const w = new Worker(new URL('./src/workers/simWorker.js', import.meta.url), { type: 'module' })
```
— das geht nur im App-Kontext; einfacher: `node --check` entfällt (ESM+self). Stattdessen Build-Check:
Run: `npx vite build --mode development 2>&1 | tail -5`
Expected: Build erfolgreich, `simWorker` als separates Chunk im Output (`dist/assets/simWorker-*.js`)

- [ ] **Step 3: Commit**

```bash
git add src/workers/simWorker.js
git commit -m "feat(season-sim): WebWorker (gechunkte Sims mit Progress)"
```

### Task 5: Hook (`useSeasonSim.js`)

**Files:**
- Create: `src/hooks/useSeasonSim.js`
- Test: `src/hooks/useSeasonSim.test.js`

**Interfaces:**
- Consumes: `fetchLeagueRosters`, `fetchMatchups`, `fetchNflState` aus `../services/api`; `loadPlayersMetaCached` aus `../services/playersMeta`; `useWeeklyRankingsStore` (`loadIfStale`, `loadSleeperWeekIfStale`, `getRankMap`, `sleeperWeekById`); `normalizePlayerName` aus `../utils/formatting`; Tasks 1–3; `useDynastyValuesStore` NUR im Rookie-Modus (`dynastyValues`, `loadDynastyValuesIfStale`)
- Produces: Hook-Rückgabe (Signatur siehe oben). `start()` lädt alles + startet Worker; `cancel()` bricht ab + terminiert Worker. Bei Unmount wird der Worker terminiert (kein Leak bei Tab-Wechsel).

- [ ] **Step 1: Write the failing test**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Worker mocken: Vitest/jsdom kann keine echten Worker laden. Der Mock ruft
// onmessage synchron mit einem Minimal-Ergebnis auf.
const listeners = {}
vi.mock('../workers/simWorker.js?worker', () => ({
  default: class {
    constructor() { this.onmessage = null; this.onerror = null }
    postMessage(msg) {
      if (msg?.type === 'run') {
        this.onmessage?.({ data: { type: 'done', results: [{ rosterId: '1', winsAvg: 10, playoffPct: 100, byePct: 50, titlePct: 60 }] } })
      }
    }
    terminate() {}
  },
}))

import { useSeasonSim } from './useSeasonSim'

const league = {
  league_id: 'lg1',
  roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN', 'BN'],
  settings: { playoff_week_start: 15, playoff_teams_count: 4 },
}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const json = async () => {
      if (String(url).includes('/state/nfl')) return { week: 5, season_type: 'regular', season: '2026' }
      if (String(url).includes('/rosters')) return [
        { roster_id: 1, owner_id: 'u1', players: ['p1', 'p2'], starters: ['p1'], settings: { wins: 3, losses: 1 } },
      ]
      if (String(url).includes('/matchups/')) return [
        { matchup_id: 1, roster_id: 1 },
        { matchup_id: 1, roster_id: 2 },
      ]
      if (String(url).includes('players/nfl')) return {}
      return {}
    }
    return { ok: true, json }
  }))
}

beforeEach(() => { vi.unstubAllGlobals() })

describe('useSeasonSim', () => {
  it('startet idle und meldet unavailable ohne Liga', async () => {
    stubFetch()
    const { result } = renderHook(() => useSeasonSim({ league: null, seasonYear: 2026, scoringType: 'ppr', rosterPositions: [], ownerLabels: [] }))
    expect(result.current.state).toBe('unavailable')
    expect(result.current.unavailableReason).toContain('Liga')
  })
})
```

HINWEIS für den Implementierer: Der vollständige Hook-Test (done-Zustand mit Odds) braucht zusätzlich gemockte Rank-Maps und `sleeperWeekById`. Statt Stores zu mocken, lädt der Hook diese über die echten Store-Funktionen — `fetch` ist global gestubbt, die Ranking-Endpoints (`/api/rankings/...`) liefern `{ok:false}`, wodurch Rank-Maps leer bleiben und `selectAndScore` mit leeren Maps arbeitet (bestLineup sortiert dann alle gleich — Stärke kommt aus `pointsById`, das aus dem ebenfalls leeren `sleeperWeekById` fällt → Punkte 0, missingCount hoch → `reducedAccuracy: true`). Der Test assertet dann `state === 'done'`, `odds` hat einen Eintrag mit `reducedAccuracy === true`. Dieser Degradations-Pfad ist Absicht (Spec: „kein Fake, Badge statt Zahl").

```js
  it('liefert done mit reducedAccuracy wenn Projektionen fehlen', async () => {
    stubFetch()
    const { result } = renderHook(() => useSeasonSim({ league, seasonYear: 2026, scoringType: 'ppr', rosterPositions: league.roster_positions, ownerLabels: [] }))
    await act(async () => { await result.current.start() })
    expect(result.current.state).toBe('done')
    expect(result.current.odds?.length).toBeGreaterThan(0)
    expect(result.current.odds[0].reducedAccuracy).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/useSeasonSim.test.js`
Expected: FAIL with "Failed to resolve import ./useSeasonSim"

- [ ] **Step 3: Write minimal implementation**

```js
// Laedt alle Simulator-Inputs und steuert den Worker. Simuliert wird NUR nach
// explizitem start() (10k Sims + ~17 Matchup-Requests sind zu teuer fuer
// Auto-Run beim Tab-Wechsel). Raw-Rosters werden hier selbst geladen
// (fetchLeagueRosters), weil useDynastyStore.leagueRosters weder Wins noch
// Bye/Injury enthaelt -- der Store bleibt unangetastet.
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchLeagueRosters, fetchMatchups, fetchNflState } from '../services/api'
import { loadPlayersMetaCached } from '../services/playersMeta'
import { useWeeklyRankingsStore } from '../stores/useWeeklyRankingsStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import { useDynastyValuesStore } from '../stores/useDynastyValuesStore'
import { normalizePlayerName } from '../utils/formatting'
import { matchKey } from '../services/analysis/waiverStats'
import { pointsFieldFor, DEFAULT_SIMS } from '../services/analysis/seasonSim'
import { buildRemainingSchedule, playoffCutoff } from '../services/analysis/seasonSchedule'
import { buildIdRankMaps, selectAndScore } from '../services/analysis/seasonStrengths'
import SimWorker from '../workers/simWorker.js?worker'

const WEEK_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'DEF']

function rosterLabel(rosterId, { ownerLabels, rosterToUserMap }) {
  const ownerId = rosterToUserMap?.[String(rosterId)]
  const hit = (ownerLabels || []).find((l) => String(l?.userId ?? l?.owner_id ?? '') === String(ownerId || ''))
  return hit?.name || hit?.label || hit || `Team ${rosterId}`
}

export function useSeasonSim({ league, seasonYear, scoringType, rosterPositions, ownerLabels, draftMode }) {
  const [state, setState] = useState(league?.league_id ? 'idle' : 'unavailable')
  const [progress, setProgress] = useState(null)
  const [odds, setOdds] = useState(null)
  const [unavailableReason, setUnavailableReason] = useState(
    league?.league_id ? null : 'Keine Liga ausgewählt.'
  )
  const workerRef = useRef(null)
  const runIdRef = useRef(0)

  useEffect(() => () => {
    try { workerRef.current?.terminate() } catch {}
    workerRef.current = null
  }, [])

  const cancel = useCallback(() => {
    runIdRef.current += 1
    try { workerRef.current?.postMessage({ type: 'cancel' }) } catch {}
    try { workerRef.current?.terminate() } catch {}
    workerRef.current = null
    setState('idle')
    setProgress(null)
  }, [])

  const start = useCallback(async () => {
    const myRun = ++runIdRef.current
    const alive = () => runIdRef.current === myRun
    if (!league?.league_id) {
      setState('unavailable')
      setUnavailableReason('Keine Liga ausgewählt.')
      return
    }
    setState('loading')
    setProgress(null)
    setOdds(null)
    try {
      const { playoffWeekStart, playoffTeams } = playoffCutoff({ league })
      const [nfl, rawRosters, playersMeta] = await Promise.all([
        fetchNflState().catch(() => null),
        fetchLeagueRosters(league.league_id).catch(() => []),
        loadPlayersMetaCached({ season: Number(seasonYear) || new Date().getFullYear() }).catch(() => ({})),
      ])
      if (!alive()) return
      if (!rawRosters?.length || rawRosters.length < 4) {
        setState('unavailable')
        setUnavailableReason('Zu wenige Kader in dieser Liga (mindestens 4 nötig).')
        return
      }
      const week = Number(nfl?.week) || 1
      const positions = (rosterPositions?.length ? rosterPositions : league.roster_positions) || []
      const scoring = scoringType === 'half_ppr' ? 'half' : scoringType === 'standard' ? 'std' : 'ppr'
      const weekly = useWeeklyRankingsStore.getState()
      const jobs = []
      for (const pos of WEEK_POSITIONS) jobs.push(weekly.loadIfStale({ pos, scope: 'week', scoring }))
      const upper = new Set(positions.map((s) => String(s).toUpperCase()))
      if (['FLEX', 'REC_FLEX', 'WRRB_FLEX'].some((s) => upper.has(s))) jobs.push(weekly.loadIfStale({ pos: 'FLEX', scope: 'week', scoring }))
      if (upper.has('SUPER_FLEX')) jobs.push(weekly.loadIfStale({ pos: 'SUPER_FLEX', scope: 'week', scoring }))
      jobs.push(weekly.loadSleeperWeekIfStale({ season: Number(seasonYear) || Number(nfl?.season) || new Date().getFullYear(), week }))
      await Promise.all(jobs.map((j) => j.catch(() => null)))
      if (!alive()) return
      if (draftMode === 'rookie') {
        await useDynastyValuesStore.getState()
          .loadDynastyValuesIfStale({ superflex: upper.has('SUPER_FLEX') })
          .catch(() => null)
        if (!alive()) return
      }
      const fresh = useWeeklyRankingsStore.getState()
      const field = pointsFieldFor(scoringType)
      const pointsById = new Map()
      for (const [id, v] of fresh.sleeperWeekById || []) {
        pointsById.set(String(id), v)
      }
      const hasProjections = pointsById.size > 0
      const dynastyValuesByName = draftMode === 'rookie'
        ? new Map((useDynastyValuesStore.getState().dynastyValues || []).map((d) => [d.nname, d.dynasty_value]))
        : null
      // Kader aufbereiten (Muster LineupPage.jsx:169): inkl. team/bye/injury.
      const teams = rawRosters.map((r) => {
        const starterSet = new Set((r.starters || []).map(String))
        const taxiSet = new Set((r.taxi || []).map(String))
        const reserveSet = new Set((r.reserve || []).map(String))
        const rosterPlayers = (r.players || []).map((id) => {
          const meta = playersMeta[id] || {}
          const name = meta.full_name
            || `${meta.first_name || ''} ${meta.last_name || ''}`.trim()
            || `#${id}`
          return {
            sleeper_id: String(id),
            name,
            nname: normalizePlayerName(name),
            pos: (meta.fantasy_positions?.[0] || meta.position || '').toUpperCase(),
            team: meta.team || '',
            bye: meta.bye_week != null ? String(meta.bye_week) : '',
            injury_status: meta.injury_status || null,
            slot: taxiSet.has(String(id)) ? 'taxi' : reserveSet.has(String(id)) ? 'ir' : starterSet.has(String(id)) ? 'starter' : 'bench',
          }
        })
        return { rosterId: String(r.roster_id), rosterPlayers }
      })
      const rankMapsByTeam = new Map(
        teams.map((t) => [t.rosterId, buildIdRankMaps({ rosterPlayers: t.rosterPlayers, getRankMap: fresh.getRankMap })])
      )
      // Rest-Spielplan: Matchups currentWeek..playoffWeekStart-1, Fehler pro
      // Woche werden geschluckt (Woche fehlt dann im Schedule = dokumentierte
      // „reduzierte Genauigkeit", kein harter Fehler).
      const matchupsByWeek = new Map()
      await Promise.all(
        Array.from({ length: Math.max(0, playoffWeekStart - week) }, (_, i) => week + i).map(async (w) => {
          try {
            const m = await fetchMatchups(league.league_id, w)
            if (alive() && m?.length) matchupsByWeek.set(w, m)
          } catch {}
        })
      )
      if (!alive()) return
      const schedule = buildRemainingSchedule({ matchupsByWeek, fromWeek: week })
      if (!schedule.length) {
        setState('unavailable')
        setUnavailableReason('Kein Rest-Spielplan verfügbar (Saison ggf. beendet).')
        return
      }
      // Staerke je Team je Simulations-Woche (Bye-bereinigt via bestLineup).
      const weeks = [...new Set(schedule.map((g) => g.week))].sort((a, b) => a - b)
      const strengthsByWeek = weeks.map((w) => [w, teams.map((t) => {
        const s = selectAndScore({
          rosterPlayers: t.rosterPlayers,
          rosterPositions: positions,
          rankMaps: rankMapsByTeam.get(t.rosterId),
          byeWeek: String(w),
          pointsById,
          field,
          dynastyValuesByName,
        })
        return [t.rosterId, s.points, s.missingCount]
      })])
      const missingByTeam = new Map()
      const strengthsPayload = strengthsByWeek.map(([w, rows]) => {
        for (const [id, , missing] of rows) {
          missingByTeam.set(id, Math.max(missingByTeam.get(id) || 0, missing))
        }
        return [w, rows.map(([id, pts]) => [id, pts])]
      })
      setState('simulating')
      const worker = new SimWorker()
      workerRef.current = worker
      worker.onmessage = (e) => {
        if (!alive()) return
        const msg = e?.data || {}
        if (msg.type === 'progress') setProgress({ done: msg.done, total: msg.total })
        else if (msg.type === 'done') {
          const map = useDynastyStore.getState().rosterToUserMap || {}
          const mine = useDynastyStore.getState().mySleeperRosterId
          setOdds((msg.results || []).map((r) => ({
            rosterId: String(r.rosterId),
            name: rosterLabel(r.rosterId, { ownerLabels, rosterToUserMap: map }),
            isMine: String(mine ?? '') === String(r.rosterId),
            winsAvg: r.winsAvg,
            playoffPct: r.playoffPct,
            byePct: r.byePct,
            titlePct: r.titlePct,
            reducedAccuracy: !hasProjections || (missingByTeam.get(String(r.rosterId)) || 0) > 2,
          })).sort((a, b) => b.titlePct - a.titlePct))
          setState('done')
          setProgress(null)
        } else if (msg.type === 'error') {
          setState('unavailable')
          setUnavailableReason('Simulation fehlgeschlagen.')
        }
      }
      worker.onerror = () => {
        if (!alive()) return
        setState('unavailable')
        setUnavailableReason('Simulation fehlgeschlagen.')
      }
      worker.postMessage({
        type: 'run',
        payload: { strengthsByWeek: strengthsPayload, schedule, playoffTeams, sims: DEFAULT_SIMS, seed: Date.now() % 100000 },
      })
    } catch (e) {
      console.warn('[useSeasonSim] failed', e)
      if (!alive()) return
      setState('unavailable')
      setUnavailableReason('Daten konnten nicht geladen werden.')
    }
  }, [league, seasonYear, scoringType, rosterPositions, ownerLabels, draftMode])

  return { state, progress, odds, unavailableReason, start, cancel }
}
```

HINWEIS für den Implementierer: `matchKey`-Import wird nur gebraucht, falls `buildIdRankMaps` hierher wandert — er liegt in `seasonStrengths.js`; der Import oben ist für `buildIdRankMaps` NICHT nötig (nur `selectAndScore` nutzt intern `matchKey` via `waiverStats`). Falls der Linter/Unused-Import stört: `matchKey`-Zeile ersatzlos streichen. `useDynastyStore` wird gelesen (nicht geschrieben) für `rosterToUserMap`/`mySleeperRosterId` — kein Konflikt mit dem „Store bleibt unangetastet"-Constraint (das meint Schema/Setter).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/useSeasonSim.test.js`
Expected: PASS (beide Tests). Falls der done-Test wegen Store-Async flaky ist: `await act` + `vi.waitFor` statt einmaligem act verwenden.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSeasonSim.js src/hooks/useSeasonSim.test.js
git commit -m "feat(season-sim): useSeasonSim-Hook (Inputs laden, Worker steuern)"
```

### Task 6: UI (`SeasonTab.jsx` + Test)

**Files:**
- Create: `src/components/analysis/SeasonTab.jsx`
- Test: `src/components/analysis/SeasonTab.test.jsx`

**Interfaces:**
- Consumes: Hook-Rückgabe aus Task 5 (als Props entgegengenommen — Komponente ist presentational und kennt keinen Worker)
- Produces: `<SeasonTab sim={...} />` mit `sim = { state, progress, odds, unavailableReason, onStart, onCancel }`

- [ ] **Step 1: Write the failing test**

```jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SeasonTab from './SeasonTab'

const doneSim = {
  state: 'done',
  progress: null,
  unavailableReason: null,
  onStart: vi.fn(),
  onCancel: vi.fn(),
  odds: [
    { rosterId: '1', name: 'Team A', isMine: true, winsAvg: 9.5, playoffPct: 82.4, byePct: 20, titlePct: 15.2, reducedAccuracy: false },
    { rosterId: '2', name: 'Team B', isMine: false, winsAvg: 4.1, playoffPct: 5, byePct: 0, titlePct: 0.5, reducedAccuracy: true },
  ],
}

describe('SeasonTab', () => {
  it('zeigt Odds-Tabelle mit eigenem Team hervorgehoben', () => {
    render(<SeasonTab sim={doneSim} />)
    expect(screen.getByText('Team A')).toBeTruthy()
    expect(screen.getByText('82,4 %')).toBeTruthy()
  })
  it('zeigt reducedAccuracy-Badge statt falscher Praezision', () => {
    render(<SeasonTab sim={doneSim} />)
    expect(screen.getByText(/reduzierte Genauigkeit/i)).toBeTruthy()
  })
  it('idle zeigt Start-Button, loading/progress zeigt Abbrechen', () => {
    const idle = { ...doneSim, state: 'idle', odds: null }
    const { rerender } = render(<SeasonTab sim={idle} />)
    const btn = screen.getByRole('button', { name: /Simulation starten/i })
    fireEvent.click(btn)
    expect(idle.onStart).toHaveBeenCalledTimes(1)
    rerender(<SeasonTab sim={{ ...idle, state: 'simulating', progress: { done: 5000, total: 10000 } }} />)
    expect(screen.getByRole('button', { name: /Abbrechen/i })).toBeTruthy()
  })
  it('unavailable erklaert warum, ohne Fake-Zahlen', () => {
    render(<SeasonTab sim={{ ...doneSim, state: 'unavailable', odds: null, unavailableReason: 'Kein Rest-Spielplan verfügbar (Saison ggf. beendet).' }} />)
    expect(screen.getByText(/Kein Rest-Spielplan/i)).toBeTruthy()
    expect(screen.queryByText('Team A')).toBeNull()
  })
})
```

HINWEIS für den Implementierer: Prozent-Format deutsch (`82,4 %` via `toLocaleString('de-DE', {maximumFractionDigits: 1})`), Siege eine Nachkommastelle. Der Test nutzt `getByText('82,4 %')` — die Komponente MUSS exakt dieses Format rendern.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/analysis/SeasonTab.test.jsx`
Expected: FAIL with "Failed to resolve import ./SeasonTab"

- [ ] **Step 3: Write minimal implementation**

```jsx
// Saison-Tab: presentational. Alle Daten kommen als sim-Prop herein
// (useSeasonSim aus Task 5); diese Datei kennt weder Worker noch Stores.
const fmtPct = (v) => `${Number(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
const fmtWins = (v) => Number(v || 0).toLocaleString('de-DE', { maximumFractionDigits: 1 })

export function SimControls({ sim }) {
  if (sim.state === 'idle') {
    return (
      <div className="an-sim-controls">
        <p className="an-muted">10.000 Simulationen aus Rest-Spielplan und projizierten Punkten — lokal auf deinem Gerät, ohne KI.</p>
        <button type="button" className="an-btn" onClick={sim.onStart}>Simulation starten</button>
      </div>
    )
  }
  if (sim.state === 'loading' || sim.state === 'simulating') {
    const { done = 0, total = 10000 } = sim.progress || {}
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="an-sim-controls">
        <div className="an-progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100">
          <div className="an-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="an-muted">{sim.state === 'loading' ? 'Lade Daten …' : `${done.toLocaleString('de-DE')} / ${total.toLocaleString('de-DE')} Sims (${pct} %)`}</p>
        <button type="button" className="an-btn an-btn-ghost" onClick={sim.onCancel}>Abbrechen</button>
      </div>
    )
  }
  return (
    <div className="an-sim-controls">
      <button type="button" className="an-btn an-btn-ghost" onClick={sim.onStart}>Neu simulieren</button>
    </div>
  )
}

export function OddsTable({ odds }) {
  return (
    <table className="an-odds-table">
      <thead>
        <tr>
          <th scope="col">Team</th>
          <th scope="col" title="Projizierte Siege im Mittel">W-L (Ø)</th>
          <th scope="col" title="Anteil der Sims mit Playoff-Qualifikation">Playoffs</th>
          <th scope="col" title="Anteil der Sims mit Freilos in Runde 1">Bye</th>
          <th scope="col" title="Anteil der Sims mit Meisterschaft">Titel</th>
        </tr>
      </thead>
      <tbody>
        {(odds || []).map((o) => (
          <tr key={o.rosterId} className={o.isMine ? 'is-mine' : undefined}>
            <th scope="row">
              {o.name}
              {o.reducedAccuracy && <span className="an-badge" title="Weniger als 3 projizierte Starter mit echter Projektion"> reduzierte Genauigkeit</span>}
            </th>
            <td>{fmtWins(o.winsAvg)}</td>
            <td>{fmtPct(o.playoffPct)}</td>
            <td>{fmtPct(o.byePct)}</td>
            <td>{fmtPct(o.titlePct)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SeasonTab({ sim }) {
  if (sim.state === 'unavailable') {
    return (
      <div className="an-season">
        <p className="an-muted">{sim.unavailableReason || 'Simulation nicht verfügbar.'}</p>
      </div>
    )
  }
  return (
    <div className="an-season">
      <SimControls sim={sim} />
      {sim.state === 'done' && sim.odds && <OddsTable odds={sim.odds} />}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/analysis/SeasonTab.test.jsx`
Expected: PASS (alle 4 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis/SeasonTab.jsx src/components/analysis/SeasonTab.test.jsx
git commit -m "feat(season-sim): SeasonTab-UI (Controls, Odds-Tabelle, Zustaende)"
```

### Task 7: Verdrahtung (`AnalysisPage.jsx` + CSS + Gesamttest)

**Files:**
- Modify: `src/pages/AnalysisPage.jsx` (TABS, Props, Panel)
- Modify: `src/styles/analysis.css` (neue Klassen, existing Tokens)
- Test: Gesamtsuite `npm test`

**Interfaces:**
- Consumes: `useSeasonSim` (Task 5), `SeasonTab` (Task 6); Props `selectedLeague, seasonYear, effScoringType` kommen bereits aus `pageProps` (`App.jsx:388`) — KEINE App.jsx-Änderung

- [ ] **Step 1: Write the failing test (existiert implizit — neuer Tab fehlt)**

Run: `npm test -- src/components/analysis 2>&1 | tail -3`
Expected: PASS (Baseline grün — der „Fail" ist: kein Saison-Tab rendert; nach der Änderung prüfen wir per neuem Assert in Step 4)

- [ ] **Step 2: AnalysisPage ändern (3 Stellen, sonst nichts)**

Stelle 1 — TABS-Konstante (`AnalysisPage.jsx:21`):
```js
const TABS = [['draft', 'Draft'], ['roster', 'Kader'], ['market', 'Markt'], ['saison', 'Saison']]
```

Stelle 2 — Props-Signatur (nach `isSuperflex` einfügen):
```js
export default function AnalysisPage({
  teamsCount, ownerLabels, effRoster, draftSlot, selectedDraft, draftMode, isSuperflex,
  selectedLeague, seasonYear, effScoringType,
}) {
```

Stelle 3 — Imports + Hook + Panel (Imports oben ergänzen, Hook nach den anderen useMemos/in der Nähe von `useEffect`, Panel nach MarketTab):
```js
import { useSeasonSim } from '../hooks/useSeasonSim'
import SeasonTab from '../components/analysis/SeasonTab'
```
```js
  const seasonSim = useSeasonSim({
    league: selectedLeague, seasonYear, scoringType: effScoringType,
    rosterPositions: effRoster, ownerLabels, draftMode,
  })
```
```jsx
        {tab === 'saison' && (
          <SeasonTab sim={{
            state: seasonSim.state, progress: seasonSim.progress, odds: seasonSim.odds,
            unavailableReason: seasonSim.unavailableReason,
            onStart: seasonSim.start, onCancel: seasonSim.cancel,
          }} />
        )}
```

- [ ] **Step 3: CSS ergänzen (ans Ende von `analysis.css`, nur neue Klassen, nur existierende Tokens `var(--border)`, `var(--muted)`, `var(--fg)`, `var(--accent)`)**

```css
/* Saison-Tab: Odds-Tabelle, Sim-Controls, Progress, Badge. */
.an-season { display: grid; gap: 1rem; }
.an-sim-controls { display: grid; gap: .6rem; justify-items: start; }
.an-muted { font-size: .82rem; color: var(--muted, #888); margin: 0; }
.an-odds-table { width: 100%; border-collapse: collapse; font-size: .9rem; }
.an-odds-table th, .an-odds-table td { padding: .45rem .6rem; text-align: right; border-bottom: 1px solid var(--border, #2a2a2a); }
.an-odds-table th:first-child, .an-odds-table td:first-child { text-align: left; }
.an-odds-table thead th { color: var(--muted, #888); font-weight: 600; }
.an-odds-table tr.is-mine th { color: var(--fg, #eee); }
.an-odds-table tr.is-mine { background: color-mix(in srgb, var(--accent, #4ea1ff) 12%, transparent); }
.an-badge { font-size: .72rem; color: var(--muted, #888); border: 1px solid var(--border, #2a2a2a); border-radius: 999px; padding: .05rem .45rem; white-space: nowrap; }
.an-progress { height: .5rem; width: min(22rem, 100%); background: var(--border, #2a2a2a); border-radius: 999px; overflow: hidden; }
.an-progress-fill { height: 100%; background: var(--accent, #4ea1ff); transition: width .2s; }
```

HINWEIS für den Implementierer: Falls `color-mix` in der Android-WebView Probleme macht (altes Chromium), ersetze die `.is-mine`-Zeile durch `background: rgba(78, 161, 255, 0.12);` — keine Logikänderung, nur Farbe.

- [ ] **Step 4: Run full test suite**

Run: `npm test 2>&1 | tail -8`
Expected: PASS, keine Regressionen (Suite war vor Task 1 grün — bei Rot zuerst prüfen, ob der Fehler auch ohne diese Änderung auftritt: `git stash && npm test -- <datei>`)

- [ ] **Step 5: Commit**

```bash
git add src/pages/AnalysisPage.jsx src/styles/analysis.css
git commit -m "feat(season-sim): Saison-Tab auf Analyse-Seite verdrahten"
```

---

## Self-Review

**1. Spec-Coverage:** Problem/Ziele → Tasks 1–7. Nicht-Ziele eingehalten: kein Trade-Impact (TradePage unangetastet), kein Finder/DB/Alerts, keine Portfolio-Sicht, kein Multi-Plattform-Adapter, keine KI-Erzählung, keine Persistenz. 10k-Default (`DEFAULT_SIMS`), Saison-Tab (Task 7), Ansatz A lokal im Worker (Tasks 4–5), Playoff-Fallback 6 (Task 2), ELO 400 (Task 1), „nicht verfügbar statt Fake" (Tasks 5–6), Dynasty-Tiebreak ±Regel (Task 3/5). Lücke geschlossen: Spec sagte „Stärke via bestLineup" — Plan konkretisiert Auswahl (Rang) vs. Summe (Punkte) in Task 3.

**2. Placeholder-Scan:** Keine TBD/TODOs; alle Steps enthalten exakten Code oder exakte Commands; keine „ähnlich wie Task N"-Verweise (Interfaces oben definieren geteilte Namen einmalig, jede Task wiederholt ihren eigenen Code).

**3. Typ-Konsistenz:** rosterIds überall String (`String(...)` an jeder Grenze: Task 1 simulateSeason, Task 2 buildRemainingSchedule, Task 4 Worker-Serialisierung, Task 5 Hook). `strengthsByWeek` intern `Map<number,Map<string,number>>`, über Worker-Grenze als Array-Paare (Task 4 `toMap`, Task 5 Payload-Bau). Prozent als 0–100-Zahl bis zur Formatierung in Task 6 (`fmtPct`). `matchKey`-Keys (`NAME:`/`TEAM:`) nur innerhalb Task 3, `ID:`-Keys an `bestLineup`-Grenze (Muster LineupPage). `byeWeek` als String|null (Konvention `bestLineup currentWeekBye`). Hook-Rückgabe ↔ `SeasonTab sim`-Prop feldergleich (`state/progress/odds/unavailableReason/onStart/onCancel`).
