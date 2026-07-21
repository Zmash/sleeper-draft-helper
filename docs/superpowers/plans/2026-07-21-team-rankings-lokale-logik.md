# Team Rankings: neue lokale Bewertungslogik — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `computeTeamScores` durch fünf aussagekräftige lokale Metriken ersetzen (Value/Starter/Depth/Balance/Bye) und die Tabelle in DraftAnalysis anpassen.

**Architecture:** Reine Umstellung von `src/services/analysis.js` (Rank→Wert-Kurve + Greedy-Lineup als gemeinsame Basis) plus Spaltenumbenennung in `src/components/DraftAnalysis.jsx`. Aufrufsignatur und Ergebnis-Grundform (`{rank, key, total, ...}`) bleiben; `positional`/`diversity` werden zu `starter`/`depth`.

**Tech Stack:** React 18, Vitest 1.6, kein neues Package.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-team-rankings-lokale-logik-design.md`
- UI-Texte/Kommentare Deutsch; Commit-Subjects Deutsch mit ASCII-Transliteration ("fuer", "ueber")
- Kein `Number(null)`-Coercing: `x == null`-Guards (Repo-Konvention, siehe derive.js)
- `countStarters` aus `src/services/derive.js` wiederverwenden (FLEX/SUPER_FLEX-Aliase dort gelöst)
- Commit-Trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Neue Score-Logik in analysis.js (TDD)

**Files:**
- Modify: `src/services/analysis.js` (Zeilen 9-50 Helpers, 100-236 `computeTeamScores`)
- Create: `src/services/analysis.test.js`

**Interfaces:**
- Consumes: `countStarters(rosterPositions)` aus `./derive` → `{QB,RB,WR,TE,FLEX,SUPER_FLEX}`
- Produces: `computeTeamScores({boardPlayers, livePicks, teamsCount, rosterPositions})` → Array sortiert nach `total` absteigend, Elemente `{rank, key, total, value, starter, depth, balance, bye}` (alle Integer 0-100, `rank` 1..N). Keine Felder `positional`/`diversity` mehr.

- [ ] **Step 1: Failing Tests schreiben** — `src/services/analysis.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { computeTeamScores } from './analysis'

// 7 Starterplaetze: QB, 2 RB, 2 WR, TE, FLEX
const ROSTER = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'BN', 'BN', 'BN']
const ROSTER_SF = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'SUPER_FLEX', 'BN', 'BN', 'BN']

function boardFrom(defs) {
  return defs.map(d => ({
    sleeper_id: d.id, nname: d.id, rk: d.rk, adp: d.adp ?? d.rk,
    pos: d.pos, bye: d.bye ?? null,
  }))
}
function pick(no, by, id, pos) {
  return { pick_no: no, picked_by: by, player_id: id, metadata: { position: pos } }
}

// Voller 2-Team-Draft: A bekommt die ungeraden (besseren) Ranks, B die geraden.
// Jeder pickt exakt nach Board-Reihenfolge -> alle Deltas 0.
const POS_SEQ = ['QB', 'QB', 'RB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'WR', 'TE', 'TE', 'RB', 'RB']
const fullBoard = boardFrom(POS_SEQ.map((pos, i) => ({ id: `p${i + 1}`, rk: i + 1, pos })))
const fullPicks = POS_SEQ.map((pos, i) =>
  pick(i + 1, i % 2 === 0 ? 'A' : 'B', `p${i + 1}`, pos))

describe('computeTeamScores — neues Metrik-Set', () => {
  it('liefert starter/depth statt positional/diversity und differenziert (Regression: Positional war immer 100)', () => {
    const scores = computeTeamScores({ boardPlayers: fullBoard, livePicks: fullPicks, teamsCount: 2, rosterPositions: ROSTER })
    expect(scores).toHaveLength(2)
    expect(scores[0]).not.toHaveProperty('positional')
    expect(scores[0]).not.toHaveProperty('diversity')
    const a = scores.find(s => s.key === 'user:A')
    const b = scores.find(s => s.key === 'user:B')
    expect(a.starter).toBe(100)          // bestes Lineup der Liga
    expect(b.starter).toBeLessThan(100)  // differenziert endlich
    expect(a.total).toBeGreaterThan(b.total)
    expect(scores[0].rank).toBe(1)
  })

  it('Value: Draft exakt nach ECR/ADP -> beide Teams 50 (Marktwert-Mitte)', () => {
    const scores = computeTeamScores({ boardPlayers: fullBoard, livePicks: fullPicks, teamsCount: 2, rosterPositions: ROSTER })
    for (const s of scores) expect(s.value).toBe(50)
  })

  it('Value: klare Steals (rk weit besser als Pick-Nr.) -> deutlich ueber 50', () => {
    const defs = POS_SEQ.slice(0, 7).map((pos, i) => ({ id: `s${i + 1}`, rk: i + 1, pos }))
    const board = boardFrom(defs)
    // Ein Team pickt die Spieler 15 Picks spaeter als ihr Rank -> positive Deltas
    const picks = defs.map((d, i) => pick(i + 16, 'A', d.id, d.pos))
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 12, rosterPositions: ROSTER })
    expect(scores[0].value).toBeGreaterThan(50)
  })

  it('Balance (Superflex): nur 1 QB wird bestraft, 2 QB nicht', () => {
    const posA = ['QB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'TE']
    const posB = ['QB', 'QB', 'RB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE']
    const defs = [
      ...posA.map((pos, i) => ({ id: `a${i}`, rk: i * 2 + 1, pos })),
      ...posB.map((pos, i) => ({ id: `b${i}`, rk: i * 2 + 2, pos })),
    ]
    const board = boardFrom(defs)
    const picks = [
      ...posA.map((pos, i) => pick(i * 2 + 1, 'A', `a${i}`, pos)),
      ...posB.map((pos, i) => pick(i * 2 + 2, 'B', `b${i}`, pos)),
    ]
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 2, rosterPositions: ROSTER_SF })
    const a = scores.find(s => s.key === 'user:A')
    const b = scores.find(s => s.key === 'user:B')
    expect(a.balance).toBe(90)   // -10: kein zweiter QB fuer den SF-Slot
    expect(b.balance).toBe(100)
  })

  it('Bye: 3 Starter mit gleicher Bye-Woche schlechter als gespreizte Byes', () => {
    const posSeq = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'RB']
    const defs = [
      ...posSeq.map((pos, i) => ({ id: `x${i}`, rk: i * 2 + 1, pos, bye: i < 3 ? '7' : String(8 + i) })),
      ...posSeq.map((pos, i) => ({ id: `y${i}`, rk: i * 2 + 2, pos, bye: String(i + 1) })),
    ]
    const board = boardFrom(defs)
    const picks = [
      ...posSeq.map((pos, i) => pick(i * 2 + 1, 'X', `x${i}`, pos)),
      ...posSeq.map((pos, i) => pick(i * 2 + 2, 'Y', `y${i}`, pos)),
    ]
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 2, rosterPositions: ROSTER })
    const x = scores.find(s => s.key === 'user:X')
    const y = scores.find(s => s.key === 'user:Y')
    expect(x.bye).toBe(80)   // (3-1) * 10 Strafe
    expect(y.bye).toBe(100)
  })

  it('laufender Draft: 3 Picks -> keine Unbesetzt-Strafen ueber die Pickzahl hinaus', () => {
    const defs = [
      { id: 'q1', rk: 1, pos: 'QB' },
      { id: 'r1', rk: 2, pos: 'RB' },
      { id: 'w1', rk: 3, pos: 'WR' },
    ]
    const board = boardFrom(defs)
    const picks = defs.map((d, i) => pick(i + 1, 'A', d.id, d.pos))
    const scores = computeTeamScores({ boardPlayers: board, livePicks: picks, teamsCount: 12, rosterPositions: ROSTER })
    expect(scores[0].balance).toBe(100)
  })

  it('leeres Board (kein Ranking importiert): neutrale 50er, keine NaN', () => {
    const picks = [pick(1, 'A', 'unknown1', 'RB'), pick(2, 'B', 'unknown2', 'WR')]
    const scores = computeTeamScores({ boardPlayers: [], livePicks: picks, teamsCount: 2, rosterPositions: ROSTER })
    for (const s of scores) {
      expect(s.value).toBe(50)
      expect(s.starter).toBe(50)
      expect(s.depth).toBe(50)
      for (const k of ['total', 'value', 'starter', 'depth', 'balance', 'bye']) {
        expect(Number.isFinite(s[k])).toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/services/analysis.test.js`
Expected: FAIL (u.a. `starter` undefined, `positional`-Property vorhanden)

- [ ] **Step 3: `analysis.js` umbauen** — Helpers `scale01`/`scale100`/`requiredStarters` entfernen, `countStarters` importieren, neue Konstanten/Helpers und `computeTeamScores` ersetzen. Vollständiger neuer Inhalt der betroffenen Abschnitte:

Kopf (Importe + Konstanten, ersetzt Zeilen 1-50):

```js
// src/services/analysis.js
import { normalizePlayerName } from '../utils/formatting'
import { countStarters } from './derive'

const isNum = (n) => Number.isFinite(n)
const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

// --- Value-Tuning ---
const VALUE_ECR_WEIGHT = 0.85   // ECR dominiert
const VALUE_ADP_WEIGHT = 0.15   // ADP nur leicht als Kontext
const VALUE_DELTA_CAP  = 20     // harte Kappung der Deltas
const VALUE_SCALE      = 4      // ponytail: Punkte je Delta-Schnitt um die 50er-Mitte

// --- Rank->Wert-Kurve (Basis fuer Starter/Depth) ---
const RANK_DECAY     = 45       // ponytail: Tuning-Knopf; kleiner = Studs zaehlen staerker
const UNRANKED_VALUE = 2        // Floor fuer ungerankte/ungematchte Spieler
const DEPTH_BENCH_N  = 5        // wie viele Bench-Spieler in Depth einfliessen

const capDelta = (d, cap = VALUE_DELTA_CAP) => clamp(d, -cap, cap)

// Späte Runden schwächer werten: <=100 voll, 101..160 75%, >160 50%
function lateRoundWeight(pickNo) {
  const n = Number(pickNo)
  if (!Number.isFinite(n)) return 1
  if (n <= 100) return 1
  if (n <= 160) return 0.75
  return 0.5
}

// K/DST (bzw. DEF) deutlich entwerten
function positionWeight(pos) {
  const p = String(pos || '').toUpperCase()
  if (p === 'K' || p === 'DST' || p === 'DEF') return 0.25
  return 1
}

// Spielerwert aus dem Overall-Rank: rk 1 -> 100, rk 30 -> ~52, rk 100 -> ~11
function playerValue(rk) {
  if (rk == null || !Number.isFinite(rk)) return UNRANKED_VALUE
  return 100 * Math.exp(-(rk - 1) / RANK_DECAY)
}

// Starterplaetze aus den Roster-Settings; leeres Roster -> Standard-Lineup
function lineupSlots(rosterPositions = []) {
  if (!(rosterPositions || []).length) {
    return { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPER_FLEX: 0 }
  }
  return countStarters(rosterPositions)
}

// Greedy: dedizierte Slots zuerst (beste Ranks), dann FLEX/SUPER_FLEX aus dem Rest
function fillLineup(entries, req) {
  const pool = entries.slice().sort((a, b) => b.val - a.val)
  const used = new Set()
  const starters = []
  const take = (allowed, count) => {
    for (const e of pool) {
      if (count <= 0) break
      if (used.has(e) || !allowed.includes(e.pos)) continue
      used.add(e)
      starters.push(e)
      count -= 1
    }
  }
  take(['QB'], req.QB || 0)
  take(['RB'], req.RB || 0)
  take(['WR'], req.WR || 0)
  take(['TE'], req.TE || 0)
  take(['RB', 'WR', 'TE'], req.FLEX || 0)
  take(['QB', 'RB', 'WR', 'TE'], req.SUPER_FLEX || 0)
  return { starters, bench: pool.filter(e => !used.has(e)) }
}
```

`ownerKeyFromPick`, `estimateRounds`, `isDraftComplete` bleiben unverändert. Danach `computeTeamScores` komplett ersetzen:

```js
/**
 * Team-Scores berechnen (Value/Starter/Depth/Balance/Bye + Total).
 * Bedeutungen: Value 50 = nach Marktwert gedraftet; Starter/Depth 100 = bestes
 * Lineup bzw. tiefste Bench der Liga; Balance/Bye = 100 minus konkrete Strafen.
 */
export function computeTeamScores({
  boardPlayers = [],
  livePicks = [],
  teamsCount = 0,
  rosterPositions = [],
}) {
  const bySleeperId = new Map(
    boardPlayers.filter(p => p?.sleeper_id != null).map(p => [String(p.sleeper_id), p])
  )
  const byName = new Map(boardPlayers.map(p => [p.nname, p]))

  const playerForPick = (pick) => {
    const sid = String(pick?.player_id ?? pick?.metadata?.player_id ?? pick?.metadata?.id ?? '')
    if (sid && bySleeperId.has(sid)) return bySleeperId.get(sid)
    const name = normalizePlayerName(`${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`)
    if (name && byName.has(name)) return byName.get(name)
    return null
  }

  const req = lineupSlots(rosterPositions)
  const isSF = (req.SUPER_FLEX || 0) > 0
  const slotsTotal = (req.QB || 0) + (req.RB || 0) + (req.WR || 0) + (req.TE || 0) + (req.FLEX || 0) + (req.SUPER_FLEX || 0)

  const teams = new Map()
  for (const pick of (livePicks || [])) {
    const key = ownerKeyFromPick(pick, teamsCount)
    if (!teams.has(key)) teams.set(key, { key, picks: [] })
    teams.get(key).picks.push(pick)
  }

  // Ohne ein einziges Board-Match sind Rank-basierte Scores erfunden -> neutral 50.
  let anyRanked = false

  for (const team of teams.values()) {
    let deltaSum = 0
    let deltaCount = 0
    const entries = []   // { pos, val, bye } nur QB/RB/WR/TE

    for (const pick of team.picks) {
      const player = playerForPick(pick)
      const rawPos = player?.pos ?? pick?.metadata?.position
      const pos = String(rawPos || '').toUpperCase() === 'DEF' ? 'DST' : String(rawPos || '').toUpperCase()
      const rk = player ? toNum(player.rk) : null
      if (rk != null) anyRanked = true

      if (player) {
        const evA = toNum(player.ecrVsAdp ?? player['ECR VS. ADP'] ?? player['ECRvsADP'])
        const adp = toNum(player.adp ?? ((rk != null && evA != null) ? rk + evA : null))
        const pickNo = toNum(pick.pick_no)
        const expertDelta = (rk != null && pickNo != null) ? (pickNo - rk) : null
        const marketDelta = (adp != null && pickNo != null) ? (pickNo - adp) : null
        if (expertDelta != null || marketDelta != null) {
          const blended =
            VALUE_ECR_WEIGHT * capDelta(expertDelta ?? marketDelta) +
            VALUE_ADP_WEIGHT * capDelta(marketDelta ?? expertDelta)
          deltaSum += blended * lateRoundWeight(pickNo) * positionWeight(pos)
          deltaCount += 1
        }
      }

      if (pos === 'QB' || pos === 'RB' || pos === 'WR' || pos === 'TE') {
        const byeStr = String(player?.bye ?? '').trim()
        entries.push({ pos, val: playerValue(rk), bye: byeStr || null })
      }
    }

    const { starters, bench } = fillLineup(entries, req)
    team._entries = entries
    team._starters = starters
    team._deltaAvg = deltaCount ? deltaSum / deltaCount : null
    team._starterRaw = starters.reduce((s, e) => s + e.val, 0)
    team._depthRaw = bench.slice(0, DEPTH_BENCH_N).reduce((s, e) => s + e.val, 0)
  }

  const teamsArr = Array.from(teams.values())
  const maxStarter = Math.max(0, ...teamsArr.map(t => t._starterRaw))
  const maxDepth = Math.max(0, ...teamsArr.map(t => t._depthRaw))

  for (const team of teamsArr) {
    // Value: 50 = Marktwert, Steals darueber, Reaches darunter
    const value = (!anyRanked || team._deltaAvg == null)
      ? 50
      : Math.round(clamp(50 + VALUE_SCALE * team._deltaAvg, 0, 100))

    // Starter/Depth: relativ zum Liga-Besten
    const starter = (!anyRanked || maxStarter <= 0) ? 50 : Math.round(100 * team._starterRaw / maxStarter)
    const depth = (!anyRanked || maxDepth <= 0) ? 50 : Math.round(100 * team._depthRaw / maxDepth)

    // Balance: Kaderbau vs. Bedarf
    const counts = { QB: 0, RB: 0, WR: 0, TE: 0 }
    for (const e of team._entries) counts[e.pos] += 1
    const picksN = team.picks.length
    let balance = 100
    // Unbesetzte Starterplaetze — nur soweit die eigenen Picks sie haetten fuellen koennen
    const fillable = Math.min(slotsTotal, picksN)
    balance -= Math.max(0, fillable - team._starters.length) * 15
    // Backup-Strafen erst, wenn genug Picks fuer Starter + Backup da sind
    if (picksN >= slotsTotal + 1) {
      if (counts.RB < (req.RB || 0) + 1) balance -= 10
      if (counts.WR < (req.WR || 0) + 1) balance -= 10
      if (isSF && counts.QB < (req.QB || 0) + (req.SUPER_FLEX || 0)) balance -= 10
    }
    // Hortung: QBs in 1QB-Ligen, TEs generell
    if (!isSF) balance -= Math.max(0, counts.QB - ((req.QB || 0) + 1)) * 8
    balance -= Math.max(0, counts.TE - ((req.TE || 0) + 1)) * 5
    balance = clamp(balance, 0, 100)

    // Bye: nur Ueberschneidungen innerhalb der Starter
    const byeCounts = {}
    for (const e of team._starters) {
      if (e.bye) byeCounts[e.bye] = (byeCounts[e.bye] || 0) + 1
    }
    let byePenalty = 0
    for (const n of Object.values(byeCounts)) byePenalty += Math.max(0, n - 1) * 10
    const bye = clamp(100 - byePenalty, 0, 100)

    team.value = value
    team.starter = starter
    team.depth = depth
    team.balance = balance
    team.bye = bye
    team.total = Math.round(0.35 * starter + 0.30 * value + 0.15 * depth + 0.10 * balance + 0.10 * bye)
  }

  return teamsArr
    .sort((a, b) => b.total - a.total)
    .map((t, i) => ({
      rank: i + 1,
      key: t.key,           // passt zu ownerLabels (user:, roster:, slot:)
      total: t.total,
      value: t.value,
      starter: t.starter,
      depth: t.depth,
      balance: t.balance,
      bye: t.bye,
    }))
}
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/services/analysis.test.js`
Expected: PASS (7 Tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis.js src/services/analysis.test.js
git commit -m "feat(review): lokale Team-Scores neu (Starter/Depth statt Positional/Diversity)"
```

Body: Positional war nach vollem Draft immer 100; Value min-max erzwang 0/100. Neue Basis: Rank->Wert-Kurve + Greedy-Lineup (FLEX/SF-bewusst), Value um 50 zentriert, Balance/Bye mit konkreten Strafen.

---

### Task 2: Tabelle + App-Aufruf anpassen

**Files:**
- Modify: `src/components/DraftAnalysis.jsx:84-115` (Spalten)
- Modify: `src/App.jsx:188-194` (Legacy-Fallback-Aufruf entfernen)

**Interfaces:**
- Consumes: `scores`-Elemente `{rank, key, total, value, starter, depth, balance, bye}` aus Task 1

- [ ] **Step 1: Spalten in `DraftAnalysis.jsx` umstellen** — im `<thead>` `Positional`→`Starter`, `Diversity`→`Depth` (Reihenfolge: Rank, Team, Total, Value, Starter, Depth, Balance, Bye) und im Body:

```jsx
<td>{r.total}</td>
<td>{r.value}</td>
<td>{r.starter}</td>
<td>{r.depth}</td>
<td>{r.balance}</td>
<td>{r.bye}</td>
```

- [ ] **Step 2: `App.jsx` Legacy-Fallback entfernen** — der zweite `computeTeamScores(boardPlayers, effRoster, teamsCount, livePicks)`-Aufruf mit Positionsargumenten (Zeile 192) ist tot (Signatur ist ein Objekt); `scores`-Memo vereinfachen:

```jsx
const scores = useMemo(() => {
  try {
    return computeTeamScores({ boardPlayers, rosterPositions: effRoster, teamsCount, livePicks })
  } catch {
    return []
  }
}, [boardPlayers, effRoster, teamsCount, livePicks])
```

- [ ] **Step 3: Gesamte Testsuite**

Run: `npm test`
Expected: alle Tests grün (bekannte Flake: BoardSection.*-waitFor unter Paralleldruck — bei genau 1 Failure dort in Isolation nachprüfen)

- [ ] **Step 4: Commit**

```bash
git add src/components/DraftAnalysis.jsx src/App.jsx
git commit -m "feat(review): Team-Rankings-Tabelle zeigt Starter/Depth-Spalten"
```

---

### Task 3: Verifikation im Browser + graphify

- [ ] **Step 1:** `npm run dev:all` via preview_start (`client`), Board mit Daten laden (Mock-Draft `1384881999428218880`, User `zmash`), Draft-Review öffnen: Tabelle zeigt differenzierte Starter-Werte (nicht überall 100), Value um 50 gestreut.
- [ ] **Step 2:** `graphify update .` (voller Pfad `& "$env:USERPROFILE\.local\bin\graphify.exe" update .`).
- [ ] **Step 3:** Spec + Plan committen:

```bash
git add docs/superpowers/specs/2026-07-21-team-rankings-lokale-logik-design.md docs/superpowers/plans/2026-07-21-team-rankings-lokale-logik.md
git commit -m "docs(review): Spec + Plan fuer neue lokale Team-Rankings-Logik"
```
