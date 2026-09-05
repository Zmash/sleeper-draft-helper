# Analyse-Seite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/roster` wird von der reinen Roster-Anzeige zu einer Analyse-Seite mit drei Reitern (Draft / Kader / Markt) und sechs lokal gerechneten Kacheln — ohne AI, ohne neue Abhängigkeit.

**Architecture:** Alle Formeln leben als reine Funktionen in `src/services/analysis/*.js` und werden einzeln per Vitest geprüft. Die Komponenten unter `src/components/analysis/` rendern ausschliesslich; sie rechnen nicht. `AnalysisPage.jsx` ruft die Formeln in `useMemo` auf und verteilt die Ergebnisse an die Reiter.

**Tech Stack:** React 18, Zustand, Vitest + @testing-library, Inline-SVG (keine Chart-Bibliothek), Vite.

**Spec:** `docs/superpowers/specs/2026-09-05-analyse-seite-design.md`

## Global Constraints

- UI-Texte, Kommentare und Commit-Messages auf **Deutsch** (Projektkonvention aus `CLAUDE.md`).
- **Keine neue npm-Abhängigkeit.** Grafiken sind Inline-SVG.
- **Kein Zugriff auf `preferences.js`** (Fav/Avoid) aus dem gesamten Analyse-Code. Ausdrückliche Nutzerentscheidung.
- **`DraftAnalysis.jsx` wird nicht angefasst.** Das AI-Review bleibt unverändert.
- Positionsfarben kommen aus den bestehenden `--pos-*`-CSS-Tokens.
- Sleeper `league.settings.type` ist eine **Zahl** (0=redraft, 1=keeper, 2=dynasty) — nie gegen Strings vergleichen.
- Tests laufen mit `npm test` (Vitest, einmalig). Es gibt **keinen Linter** im Projekt.
- Nach Code-Änderungen `graphify update .` laufen lassen.

---

## File Structure

**Neu:**

| Datei | Verantwortung |
|---|---|
| `src/services/analysis/draftStats.js` | Kacheln 1–4: Team-Ranking, Knappheit, Tiers, Runs |
| `src/services/analysis/draftStats.test.js` | Tests dazu |
| `src/services/analysis/rosterStats.js` | Kachel 5: Wert-Split gegen Liga-Median |
| `src/services/analysis/rosterStats.test.js` | Tests dazu |
| `src/services/analysis/marketStats.js` | Kachel 6: Streit + Zugriffs-Fenster |
| `src/services/analysis/marketStats.test.js` | Tests dazu |
| `src/components/analysis/StatCard.jsx` | Kachel-Gerüst (Titel, Headline, Inhalt, Datengrundlage) |
| `src/components/analysis/DraftTab.jsx` | rendert Kacheln 1–4 |
| `src/components/analysis/RosterTab.jsx` | rendert Kachel 5 |
| `src/components/analysis/MarketTab.jsx` | rendert Kachel 6 |
| `src/pages/AnalysisPage.jsx` | Reiter-Container, ruft die Formeln auf |
| `src/styles/analysis.css` | Raster + Kachel-Stile |

**Geändert:**

| Datei | Änderung |
|---|---|
| `src/services/derive.js` | `teamKeyFromPick()` neu (aus `App.jsx` extrahiert) |
| `src/services/derive.test.js` | Tests für `teamKeyFromPick()` |
| `src/stores/useDynastyStore.js` | Feld `leagueRosters` |
| `src/App.jsx` | Ladebedingung Zeile ~310, Route, Import |
| `src/components/NextShell.jsx` | Label „Roster & Analyse" → „Analyse" (2 Stellen) |

**Gelöscht:** `src/pages/RosterPage.jsx`, `src/components/RosterSection.jsx` (nur nach Aufrufer-Prüfung in Task 12).

---

### Task 1: `teamKeyFromPick` extrahieren

Die Zuordnung Pick → Team liegt in `App.jsx` dreimal dupliziert, in zwei unterschiedlichen Fassungen. `draftStats.js` braucht dieselbe Zuordnung. Statt einer vierten Kopie wird die vollständige Fassung nach `derive.js` gezogen.

**Wichtig:** In diesem Task wird **nur** die `ownerLabels`-Nutzung (`App.jsx:122–129`) umgestellt — die einzige Stelle, die die vollständige Fassung bereits verwendet. Die beiden anderen Vorkommen (`App.jsx:186–192`, `196–199`) kennen `roster_id`/`draft_slot` nicht; sie umzustellen würde die Schlüssel von `teamByRosterId` ändern und damit das AI-Draft-Review beeinflussen. Das ist ausserhalb dieses Plans. **Nicht anfassen.**

**Files:**
- Modify: `src/services/derive.js`
- Modify: `src/services/derive.test.js`
- Modify: `src/App.jsx:118-143`

**Interfaces:**
- Consumes: nichts
- Produces: `teamKeyFromPick(pick, teamsCount = 0) → string` — liefert einen stabilen Schlüssel je Team in der Form `user:<id>` | `roster:<id>` | `slot:<n>` | `slot:unknown`. Wird von Task 2 und Task 12 benutzt.

- [ ] **Step 1: Test schreiben**

An `src/services/derive.test.js` anhängen (den bestehenden Import um `teamKeyFromPick` erweitern):

```js
import { teamKeyFromPick } from './derive'

describe('teamKeyFromPick', () => {
  it('picked_by hat Vorrang vor allem anderen', () => {
    expect(teamKeyFromPick({ picked_by: 'u1', roster_id: 3, draft_slot: 5 }, 12)).toBe('user:u1')
  })

  it('ohne picked_by faellt es auf roster_id zurueck', () => {
    expect(teamKeyFromPick({ roster_id: 3, draft_slot: 5 }, 12)).toBe('roster:3')
  })

  it('ohne picked_by und roster_id zaehlt der draft_slot', () => {
    expect(teamKeyFromPick({ draft_slot: 5 }, 12)).toBe('slot:5')
  })

  it('nur pick_no + teamsCount -> Slot aus der Snake-Rechnung', () => {
    expect(teamKeyFromPick({ pick_no: 13 }, 12)).toBe('slot:1')
  })

  it('roster_id 0 ist ein gueltiger Wert, kein fehlender', () => {
    expect(teamKeyFromPick({ roster_id: 0 }, 12)).toBe('roster:0')
  })

  it('ohne jede Information -> unknown statt Absturz', () => {
    expect(teamKeyFromPick({}, 0)).toBe('slot:unknown')
    expect(teamKeyFromPick(null, 12)).toBe('slot:unknown')
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/services/derive.test.js
```

Erwartet: FAIL — `teamKeyFromPick is not a function`.

- [ ] **Step 3: Implementieren**

An `src/services/derive.js` anhängen:

```js
/**
 * Stabiler Schluessel je Team fuer einen Pick. Reihenfolge der Fallbacks ist
 * bewusst: picked_by ist die einzige echte Identitaet, roster_id gilt nur
 * innerhalb einer Liga, der Slot ist die letzte Rettung fuer Mock-Drafts ohne
 * Teilnehmer-IDs.
 *
 * @param {object|null} pick  Sleeper-Pick
 * @param {number} teamsCount Teamzahl, nur fuer den pick_no-Fallback noetig
 * @returns {string} 'user:<id>' | 'roster:<id>' | 'slot:<n>' | 'slot:unknown'
 */
export function teamKeyFromPick(pick, teamsCount = 0) {
  if (pick?.picked_by) return `user:${pick.picked_by}`
  if (pick?.roster_id != null) return `roster:${pick.roster_id}`
  if (pick?.draft_slot != null) return `slot:${pick.draft_slot}`
  if (teamsCount && pick?.pick_no) return `slot:${((pick.pick_no - 1) % teamsCount) + 1}`
  return 'slot:unknown'
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/services/derive.test.js
```

Erwartet: PASS, alle Tests.

- [ ] **Step 5: `App.jsx` auf die Funktion umstellen**

In `src/App.jsx` den Import aus `./services/derive` um `teamKeyFromPick` erweitern. Dann im `ownerLabels`-`useMemo` die lokale Funktion `teamKeyFromPick` **löschen** und ihre Aufrufe auf die importierte umstellen:

```js
    for (const p of livePicks || []) {
      const key = teamKeyFromPick(p, teamsCount)
      if (!m.has(key)) m.set(key, teamLabelFromPick(p))
    }
```

`teamLabelFromPick` bleibt lokal — sie ist reine Anzeigelogik und hat keinen zweiten Aufrufer.

- [ ] **Step 6: Gesamte Testsuite laufen lassen**

```bash
npm test
```

Erwartet: PASS. Falls ein bestehender Test bricht, war die Umstellung nicht verhaltensgleich — dann Step 5 zurücknehmen und nur die neue Funktion behalten.

- [ ] **Step 7: Commit**

```bash
git add src/services/derive.js src/services/derive.test.js src/App.jsx
git commit -m "refactor(derive): teamKeyFromPick aus App.jsx herausgezogen"
```

---

### Task 2: Team-Draft-Ranking (Kachel 1)

**Files:**
- Create: `src/services/analysis/draftStats.js`
- Create: `src/services/analysis/draftStats.test.js`

**Interfaces:**
- Consumes: `teamKeyFromPick` aus Task 1; `normalizePlayerName`, `normalizePos` aus `src/utils/formatting.js`
- Produces:
  - `pickName(pick) → string` (normalisierter Spielername eines Picks, passend zu `nname`)
  - `teamDraftRanking({ picks, boardPlayers, teamsCount, ownerLabels, myTeamKey }) → { teams, steals, reaches, matched, unmatched, myRank, myDelta }`
    - `teams`: `Array<{ key, label, delta, picks, best, worst }>`, absteigend nach `delta`
    - `steals` / `reaches`: `Array<{ name, pick_no, delta, teamLabel }>`, je max. 5
    - `myRank`: 1-basiert oder `null`; `myDelta`: Zahl oder `null`

- [ ] **Step 1: Test schreiben**

`src/services/analysis/draftStats.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { teamDraftRanking } from './draftStats'

// ECR 1 = bester Spieler. delta = ecr - pick_no, positiv = unter Wert geholt.
const board = [
  { nname: 'aaron jones', name: 'Aaron Jones', pos: 'RB', ecr: 5 },
  { nname: 'brian burns', name: 'Brian Burns', pos: 'WR', ecr: 20 },
  { nname: 'carl carter', name: 'Carl Carter', pos: 'TE', ecr: 30 },
]

const pick = (no, first, last, user) => ({
  pick_no: no,
  picked_by: user,
  metadata: { first_name: first, last_name: last, position: 'RB' },
})

describe('teamDraftRanking', () => {
  it('summiert ecr - pick_no je Team und sortiert absteigend', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),   // 5 - 1 = +4
      pick(2, 'Brian', 'Burns', 'u2'),   // 20 - 2 = +18
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.teams.map((t) => t.key)).toEqual(['user:u2', 'user:u1'])
    expect(r.teams[0].delta).toBe(18)
    expect(r.teams[1].delta).toBe(4)
  })

  it('Picks ohne Board-Treffer zaehlen NICHT als 0, sondern als unmatched', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),
      pick(2, 'Unbekannt', 'Spieler', 'u1'),
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.teams[0].delta).toBe(4)   // nur der getroffene Pick
    expect(r.teams[0].picks).toBe(2)   // aber beide Picks gezaehlt
    expect(r.unmatched).toBe(1)
    expect(r.matched).toBe(1)
  })

  it('Board-Spieler ohne numerischen ecr gelten als nicht getroffen', () => {
    const picks = [pick(1, 'Dave', 'Doe', 'u1')]
    const boardOhneEcr = [{ nname: 'dave doe', name: 'Dave Doe', pos: 'RB', ecr: null }]
    const r = teamDraftRanking({ picks, boardPlayers: boardOhneEcr, teamsCount: 2 })
    expect(r.unmatched).toBe(1)
    expect(r.teams[0].delta).toBe(0)
  })

  it('Steals und Reaches sind nach Betrag sortiert und auf 5 begrenzt', () => {
    const picks = [
      pick(1, 'Carl', 'Carter', 'u1'),   // 30 - 1 = +29  Steal
      pick(40, 'Aaron', 'Jones', 'u2'),  //  5 - 40 = -35 Reach
    ]
    const r = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(r.steals[0].name).toBe('Carl Carter')
    expect(r.steals[0].delta).toBe(29)
    expect(r.reaches[0].name).toBe('Aaron Jones')
    expect(r.reaches[0].delta).toBe(-35)
    expect(r.steals.length).toBeLessThanOrEqual(5)
  })

  it('myTeamKey liefert Rang und Delta; ohne ihn bleiben beide null', () => {
    const picks = [
      pick(1, 'Aaron', 'Jones', 'u1'),
      pick(2, 'Brian', 'Burns', 'u2'),
    ]
    const mit = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2, myTeamKey: 'user:u1' })
    expect(mit.myRank).toBe(2)
    expect(mit.myDelta).toBe(4)

    const ohne = teamDraftRanking({ picks, boardPlayers: board, teamsCount: 2 })
    expect(ohne.myRank).toBeNull()
    expect(ohne.myDelta).toBeNull()
  })

  it('leere Eingaben liefern eine leere, aber gueltige Struktur', () => {
    const r = teamDraftRanking({ picks: [], boardPlayers: [], teamsCount: 12 })
    expect(r.teams).toEqual([])
    expect(r.steals).toEqual([])
    expect(r.matched).toBe(0)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: FAIL — Modul `./draftStats` existiert nicht.

- [ ] **Step 3: Implementieren**

`src/services/analysis/draftStats.js`:

```js
// Gerechnete Draft-Statistiken. Reine Funktionen, kein React, kein Netz.
//
// Grundgroesse ueberall: delta = ecr - pick_no.
// Positiv heisst: der Spieler ging spaeter als sein Rang, also unter Wert geholt.
import { normalizePlayerName, normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { teamKeyFromPick } from '../derive'

/** Board -> Map normalisierter Name -> { ecr, name }. Nur mit numerischem ecr. */
function ecrByName(boardPlayers = []) {
  const m = new Map()
  for (const bp of boardPlayers || []) {
    const ecr = Number(bp?.ecr)
    if (!bp?.nname || !Number.isFinite(ecr)) continue
    m.set(bp.nname, { ecr, name: bp.name || bp.nname })
  }
  return m
}

/** Normalisierter Name eines Picks, passend zum nname der Board-Spieler. */
export function pickName(pick) {
  const full = `${pick?.metadata?.first_name || ''} ${pick?.metadata?.last_name || ''}`.trim()
  return full ? normalizePlayerName(full) : ''
}

export function teamDraftRanking({
  picks = [], boardPlayers = [], teamsCount = 0, ownerLabels = null, myTeamKey = null,
}) {
  const byName = ecrByName(boardPlayers)
  const teams = new Map()
  const scored = []
  let matched = 0
  let unmatched = 0

  for (const p of picks || []) {
    const key = teamKeyFromPick(p, teamsCount)
    if (!teams.has(key)) {
      teams.set(key, {
        key,
        label: ownerLabels?.get?.(key) || key,
        delta: 0, picks: 0, best: null, worst: null,
      })
    }
    const t = teams.get(key)
    t.picks += 1

    const hit = byName.get(pickName(p))
    const pickNo = Number(p?.pick_no)
    // Kein Treffer heisst "unbekannt", nicht "Wert 0" -- sonst wuerde ein Team
    // belohnt, dessen Picks schlicht nicht im Ranking stehen.
    if (!hit || !Number.isFinite(pickNo)) { unmatched += 1; continue }

    matched += 1
    const delta = hit.ecr - pickNo
    t.delta += delta
    const entry = { name: hit.name, pick_no: pickNo, delta, teamLabel: t.label }
    scored.push(entry)
    if (!t.best || delta > t.best.delta) t.best = entry
    if (!t.worst || delta < t.worst.delta) t.worst = entry
  }

  const list = [...teams.values()].sort((a, b) => b.delta - a.delta)
  const myIndex = myTeamKey ? list.findIndex((t) => t.key === myTeamKey) : -1

  return {
    teams: list,
    steals: scored.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5),
    reaches: scored.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5),
    matched,
    unmatched,
    myRank: myIndex >= 0 ? myIndex + 1 : null,
    myDelta: myIndex >= 0 ? list[myIndex].delta : null,
  }
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: PASS, 6 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/draftStats.js src/services/analysis/draftStats.test.js
git commit -m "feat(analyse): Team-Draft-Ranking mit Steals und Reaches"
```

---

### Task 3: Positionsknappheit (Kachel 2)

Rangbasiertes VORP: Replacement-Level ist der Spieler, den das letzte Team noch als Starter bekäme.

**Files:**
- Modify: `src/services/analysis/draftStats.js`
- Modify: `src/services/analysis/draftStats.test.js`

**Interfaces:**
- Consumes: `pickName()` aus Task 2
- Produces:
  - `starterSlots(pos, rosterPositions) → number` (Bruchzahl, FLEX anteilig)
  - `positionalScarcity({ boardPlayers, picks, rosterPositions, teamsCount }) → Array<{ pos, need, available, startable, exhausted, bestName, bestEcr, replacementEcr, vor }>`

- [ ] **Step 1: Test schreiben**

An `draftStats.test.js` anhängen:

```js
import { starterSlots, positionalScarcity } from './draftStats'

describe('starterSlots', () => {
  it('zaehlt dedizierte Slots', () => {
    expect(starterSlots('RB', ['QB', 'RB', 'RB', 'WR', 'BN'])).toBe(2)
  })

  it('FLEX verteilt sich zu je einem Drittel auf RB, WR, TE', () => {
    expect(starterSlots('RB', ['FLEX'])).toBeCloseTo(1 / 3)
    expect(starterSlots('TE', ['FLEX'])).toBeCloseTo(1 / 3)
    expect(starterSlots('QB', ['FLEX'])).toBe(0)
  })

  it('SUPER_FLEX verteilt sich zu je einem Viertel und schliesst QB ein', () => {
    expect(starterSlots('QB', ['SUPER_FLEX'])).toBeCloseTo(1 / 4)
    expect(starterSlots('RB', ['SUPER_FLEX'])).toBeCloseTo(1 / 4)
  })

  it('REC_FLEX ist WR/TE, nicht RB', () => {
    expect(starterSlots('WR', ['REC_FLEX'])).toBeCloseTo(1 / 2)
    expect(starterSlots('RB', ['REC_FLEX'])).toBe(0)
  })

  it('Bank- und Sonderslots zaehlen nicht', () => {
    expect(starterSlots('RB', ['BN', 'IR', 'TAXI'])).toBe(0)
  })
})

describe('positionalScarcity', () => {
  // 10 RB, ecr 1..10, keiner gepickt
  const rbBoard = Array.from({ length: 10 }, (_, i) => ({
    nname: `rb ${i + 1}`, name: `RB ${i + 1}`, pos: 'RB', ecr: i + 1,
  }))

  it('Replacement ist der bedarf-te verfuegbare Spieler', () => {
    // 2 Teams x 2 RB-Slots = Bedarf 4 -> Replacement ist ecr 4
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 2,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.need).toBe(4)
    expect(rb.replacementEcr).toBe(4)
    expect(rb.bestEcr).toBe(1)
    expect(rb.vor).toBe(3)       // 4 - 1
    expect(rb.startable).toBe(4)
  })

  it('gepickte Spieler fallen aus dem verfuegbaren Pool', () => {
    const picks = [
      { pick_no: 1, metadata: { first_name: 'RB', last_name: '1', position: 'RB' } },
      { pick_no: 2, metadata: { first_name: 'RB', last_name: '2', position: 'RB' } },
    ]
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks, rosterPositions: ['RB', 'RB'], teamsCount: 2,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.available).toBe(8)
    expect(rb.bestEcr).toBe(3)        // 1 und 2 sind weg
    expect(rb.replacementEcr).toBe(6) // der 4. verfuegbare
  })

  it('weniger verfuegbar als Bedarf -> erschoepft, kein Replacement', () => {
    const r = positionalScarcity({
      boardPlayers: rbBoard.slice(0, 2), picks: [], rosterPositions: ['RB', 'RB'], teamsCount: 12,
    })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.exhausted).toBe(true)
    expect(rb.replacementEcr).toBeNull()
    expect(rb.vor).toBeNull()
  })

  it('Bruchteile werden erst nach der Multiplikation gerundet', () => {
    // 12 Teams x 1/3 FLEX = 4.0 -> Bedarf 4, nicht 12 x round(1/3) = 0
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['FLEX'], teamsCount: 12,
    })
    expect(r.find((x) => x.pos === 'RB').need).toBe(4)
  })

  it('Position ohne Starter-Slot taucht nicht auf', () => {
    const r = positionalScarcity({
      boardPlayers: rbBoard, picks: [], rosterPositions: ['QB'], teamsCount: 12,
    })
    expect(r.find((x) => x.pos === 'RB')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: FAIL — `starterSlots is not a function`.

- [ ] **Step 3: Implementieren**

An `draftStats.js` anhängen:

```js
const SCARCITY_POS = ['QB', 'RB', 'WR', 'TE']

// Welche Flex-Slots welche Positionen aufnehmen. Der Anteil ist 1 geteilt durch
// die Zahl der aufnehmbaren Positionen -- ein FLEX ist zu einem Drittel ein
// RB-Slot, weil sich RB, WR und TE darum bewerben.
const FLEX_SLOTS = {
  FLEX: ['RB', 'WR', 'TE'],
  WRT: ['RB', 'WR', 'TE'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
}

/**
 * Starter-Slots einer Position, Flex anteilig.
 * @returns {number} kann gebrochen sein -- erst nach x teamsCount runden.
 */
export function starterSlots(pos, rosterPositions = []) {
  const want = String(pos || '').toUpperCase()
  let n = 0
  for (const raw of rosterPositions || []) {
    const slot = String(raw || '').toUpperCase()
    if (slot === want) { n += 1; continue }
    const takers = FLEX_SLOTS[slot]
    if (takers && takers.includes(want)) n += 1 / takers.length
  }
  return n
}

export function positionalScarcity({
  boardPlayers = [], picks = [], rosterPositions = [], teamsCount = 12,
}) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))
  const teams = Number(teamsCount) || 0
  const out = []

  for (const pos of SCARCITY_POS) {
    const need = Math.round(teams * starterSlots(pos, rosterPositions))
    if (need <= 0) continue

    // toFiniteOrNull statt Number(): Number(null) waere 0 und damit ein
    // gueltiger Rang 0 -- der beste Spieler ueberhaupt.
    const pool = (boardPlayers || [])
      .filter((bp) => toFiniteOrNull(bp?.ecr) !== null
        && normalizePos(bp?.pos) === pos
        && bp?.nname && !taken.has(bp.nname))
      .sort((a, b) => toFiniteOrNull(a.ecr) - toFiniteOrNull(b.ecr))

    const exhausted = pool.length < need
    const best = pool[0] || null
    const replacement = exhausted ? null : pool[need - 1]

    out.push({
      pos,
      need,
      available: pool.length,
      startable: Math.min(pool.length, need),
      exhausted,
      bestName: best?.name || null,
      bestEcr: best ? toFiniteOrNull(best.ecr) : null,
      replacementEcr: replacement ? toFiniteOrNull(replacement.ecr) : null,
      vor: (best && replacement)
        ? toFiniteOrNull(replacement.ecr) - toFiniteOrNull(best.ecr)
        : null,
    })
  }
  return out
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: PASS, 11 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/draftStats.js src/services/analysis/draftStats.test.js
git commit -m "feat(analyse): Positionsknappheit als rangbasiertes VORP"
```

---

### Task 4: Tier-Verbrauch (Kachel 3)

**Files:**
- Modify: `src/services/analysis/draftStats.js`
- Modify: `src/services/analysis/draftStats.test.js`

**Interfaces:**
- Consumes: `pickName()` aus Task 2
- Produces: `tierUsage({ boardPlayers, picks }) → Array<{ pos, tiers, activeTier, remainingInActive }>`, `tiers` ist `Array<{ tier, total, remaining }>` aufsteigend

- [ ] **Step 1: Test schreiben**

An `draftStats.test.js` anhängen:

```js
import { tierUsage } from './draftStats'

describe('tierUsage', () => {
  const board = [
    { nname: 'a a', name: 'A A', pos: 'RB', tier: '1' },
    { nname: 'b b', name: 'B B', pos: 'RB', tier: '1' },
    { nname: 'c c', name: 'C C', pos: 'RB', tier: '2' },
    { nname: 'd d', name: 'D D', pos: 'WR', tier: '1' },
  ]

  it('zaehlt je Position und Tier Gesamt und Rest', () => {
    const picks = [{ pick_no: 1, metadata: { first_name: 'A', last_name: 'A' } }]
    const r = tierUsage({ boardPlayers: board, picks })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.tiers).toEqual([
      { tier: 1, total: 2, remaining: 1 },
      { tier: 2, total: 1, remaining: 1 },
    ])
  })

  it('aktives Tier ist das oberste mit Restbestand', () => {
    const picks = [
      { pick_no: 1, metadata: { first_name: 'A', last_name: 'A' } },
      { pick_no: 2, metadata: { first_name: 'B', last_name: 'B' } },
    ]
    const r = tierUsage({ boardPlayers: board, picks })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.activeTier).toBe(2)       // Tier 1 ist leer
    expect(rb.remainingInActive).toBe(1)
  })

  it('nicht-numerische Tier-Werte fallen heraus, ohne den Rest zu stoeren', () => {
    const mit = [...board, { nname: 'e e', name: 'E E', pos: 'RB', tier: '' },
                           { nname: 'f f', name: 'F F', pos: 'RB', tier: 'n/a' }]
    const r = tierUsage({ boardPlayers: mit, picks: [] })
    const rb = r.find((x) => x.pos === 'RB')
    expect(rb.tiers.reduce((s, t) => s + t.total, 0)).toBe(3)  // nur 1,1,2
  })

  it('alles gepickt -> kein aktives Tier statt Absturz', () => {
    const picks = [{ pick_no: 1, metadata: { first_name: 'D', last_name: 'D' } }]
    const r = tierUsage({ boardPlayers: [board[3]], picks })
    expect(r.find((x) => x.pos === 'WR').activeTier).toBeNull()
  })

  it('Board ohne jede Tier-Spalte liefert eine leere Liste', () => {
    const r = tierUsage({ boardPlayers: [{ nname: 'x x', pos: 'RB' }], picks: [] })
    expect(r).toEqual([])
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: FAIL — `tierUsage is not a function`.

- [ ] **Step 3: Implementieren**

An `draftStats.js` anhängen:

```js
/**
 * Tier-Verbrauch je Position. Das oberste Tier mit Restbestand ist das aktive
 * -- seine Restzahl ist die Cliff-Warnung.
 */
export function tierUsage({ boardPlayers = [], picks = [] }) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))
  const byPos = new Map()

  for (const bp of boardPlayers || []) {
    const tier = Number(String(bp?.tier ?? '').trim())
    const pos = normalizePos(bp?.pos)
    if (!Number.isFinite(tier) || tier <= 0 || !pos) continue

    if (!byPos.has(pos)) byPos.set(pos, new Map())
    const tiers = byPos.get(pos)
    if (!tiers.has(tier)) tiers.set(tier, { tier, total: 0, remaining: 0 })

    const entry = tiers.get(tier)
    entry.total += 1
    if (!bp.nname || !taken.has(bp.nname)) entry.remaining += 1
  }

  return [...byPos.entries()].map(([pos, tiers]) => {
    const list = [...tiers.values()].sort((a, b) => a.tier - b.tier)
    const active = list.find((t) => t.remaining > 0) || null
    return {
      pos,
      tiers: list,
      activeTier: active?.tier ?? null,
      remainingInActive: active?.remaining ?? 0,
    }
  })
}
```

Hinweis: `Number('')` ist `0`, `Number('n/a')` ist `NaN` — die Bedingung `tier <= 0` fängt den ersten Fall, `Number.isFinite` den zweiten.

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: PASS, 16 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/draftStats.js src/services/analysis/draftStats.test.js
git commit -m "feat(analyse): Tier-Verbrauch mit Cliff-Warnung"
```

---

### Task 5: Positional Runs (Kachel 4)

**Files:**
- Modify: `src/services/analysis/draftStats.js`
- Modify: `src/services/analysis/draftStats.test.js`

**Interfaces:**
- Produces: `positionalRuns({ picks, teamsCount }) → { window, runs, timeline }`
  - `runs`: `Array<{ pos, count, windowShare, overallShare }>`, absteigend nach `count`
  - `timeline`: `Array<{ pick_no, pos }>` über alle Picks, nach `pick_no` sortiert

**Wichtige Eigenschaft:** Ein Run braucht mehr Picks als das Fenster breit ist — sonst wäre der Fensteranteil gleich dem Gesamtanteil und die Erkennung strukturell blind. Bei 12 Teams (Fenster 8) liefert die Funktion also ab dem 9. Pick Ergebnisse.

- [ ] **Step 1: Test schreiben**

An `draftStats.test.js` anhängen:

```js
import { positionalRuns } from './draftStats'

const rp = (no, pos) => ({ pick_no: no, metadata: { position: pos } })

describe('positionalRuns', () => {
  it('erkennt einen Run: mindestens 3 Picks UND doppelter Anteil', () => {
    // 20 Picks, im Fenster der letzten 8 liegen 6 RB. Gesamt-RB-Anteil 6/20 = 0.30,
    // Fensteranteil 6/8 = 0.75 -> mehr als das Doppelte.
    const picks = [
      ...Array.from({ length: 12 }, (_, i) => rp(i + 1, 'WR')),
      ...Array.from({ length: 6 }, (_, i) => rp(13 + i, 'RB')),
      rp(19, 'WR'), rp(20, 'WR'),
    ]
    const r = positionalRuns({ picks, teamsCount: 12 })
    const rb = r.runs.find((x) => x.pos === 'RB')
    expect(rb).toBeDefined()
    expect(rb.count).toBe(6)
    expect(r.window).toBe(8)
  })

  it('2 Picks im Fenster sind kein Run, auch bei hohem Anteil', () => {
    // QB kommt sonst nie vor -> Anteil vervielfacht sich, aber absolut nur 2.
    const picks = [
      ...Array.from({ length: 18 }, (_, i) => rp(i + 1, 'WR')),
      rp(19, 'QB'), rp(20, 'QB'),
    ]
    const r = positionalRuns({ picks, teamsCount: 12 })
    expect(r.runs.find((x) => x.pos === 'QB')).toBeUndefined()
  })

  it('3 Picks bei doppeltem Anteil sind ein Run (Gegenprobe zur Grenze)', () => {
    const picks = [
      ...Array.from({ length: 17 }, (_, i) => rp(i + 1, 'WR')),
      rp(18, 'QB'), rp(19, 'QB'), rp(20, 'QB'),
    ]
    const r = positionalRuns({ picks, teamsCount: 12 })
    expect(r.runs.find((x) => x.pos === 'QB')).toBeDefined()
  })

  it('gleichmaessige Verteilung ergibt keinen Run', () => {
    const picks = Array.from({ length: 20 }, (_, i) => rp(i + 1, ['QB', 'RB', 'WR', 'TE'][i % 4]))
    expect(positionalRuns({ picks, teamsCount: 12 }).runs).toEqual([])
  })

  it('nicht mehr Picks als Fensterbreite -> keine Runs, aber gueltige Struktur', () => {
    const picks = Array.from({ length: 6 }, (_, i) => rp(i + 1, 'RB'))
    const r = positionalRuns({ picks, teamsCount: 12 })
    expect(r.runs).toEqual([])
    expect(r.timeline).toHaveLength(6)
  })

  it('Fenster ist durch teamsCount begrenzt, wenn die Liga klein ist', () => {
    const picks = Array.from({ length: 20 }, (_, i) => rp(i + 1, 'RB'))
    expect(positionalRuns({ picks, teamsCount: 4 }).window).toBe(4)
  })

  it('timeline ist nach pick_no sortiert, auch bei unsortierter Eingabe', () => {
    const r = positionalRuns({ picks: [rp(3, 'RB'), rp(1, 'WR'), rp(2, 'TE')], teamsCount: 12 })
    expect(r.timeline.map((t) => t.pick_no)).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: FAIL — `positionalRuns is not a function`.

- [ ] **Step 3: Implementieren**

An `draftStats.js` anhängen:

```js
const RUN_MIN_PICKS = 3      // absolute Untergrenze gegen Zufallstreffer
const RUN_SHARE_FACTOR = 2   // Fensteranteil muss den Gesamtanteil verdoppeln

/**
 * Positional Runs im rollierenden Fenster der letzten Picks.
 *
 * Beide Bedingungen muessen gelten: absolut mindestens RUN_MIN_PICKS und
 * anteilig mindestens das RUN_SHARE_FACTOR-fache des Gesamtanteils. Nur die
 * Quote wuerde am Draft-Anfang bei jeder seltenen Position anschlagen, nur die
 * absolute Zahl bei jeder haeufigen.
 *
 * Ist der Draft nicht laenger als das Fenster, sind Fenster- und Gesamtanteil
 * identisch -- dann ist keine Aussage moeglich und runs bleibt leer.
 */
export function positionalRuns({ picks = [], teamsCount = 12 }) {
  const sorted = (picks || [])
    .filter((p) => Number.isFinite(Number(p?.pick_no)))
    .sort((a, b) => Number(a.pick_no) - Number(b.pick_no))

  const timeline = sorted.map((p) => ({
    pick_no: Number(p.pick_no),
    pos: normalizePos(p?.metadata?.position) || null,
  }))

  const window = Math.min(Number(teamsCount) || 12, 8)
  if (timeline.length <= window) return { window, runs: [], timeline }

  const count = (list) => {
    const m = {}
    for (const t of list) if (t.pos) m[t.pos] = (m[t.pos] || 0) + 1
    return m
  }
  const overall = count(timeline)
  const inWindow = count(timeline.slice(-window))

  const runs = []
  for (const [pos, c] of Object.entries(inWindow)) {
    const windowShare = c / window
    const overallShare = (overall[pos] || 0) / timeline.length
    if (c >= RUN_MIN_PICKS && overallShare > 0 && windowShare >= RUN_SHARE_FACTOR * overallShare) {
      runs.push({ pos, count: c, windowShare, overallShare })
    }
  }
  runs.sort((a, b) => b.count - a.count)

  return { window, runs, timeline }
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/services/analysis/draftStats.test.js
```

Erwartet: PASS, 23 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/draftStats.js src/services/analysis/draftStats.test.js
git commit -m "feat(analyse): Positional-Run-Erkennung im rollierenden Fenster"
```

---

### Task 6: Wert-Split gegen Liga-Median (Kachel 5)

Zwei Betriebsarten: mit `dynasty_value` wertbasiert, ohne rangbasiert.

**Files:**
- Create: `src/services/analysis/rosterStats.js`
- Create: `src/services/analysis/rosterStats.test.js`

**Interfaces:**
- Consumes: `starterSlots()` aus Task 3
- Produces:
  - `median(numbers) → number|null`
  - `rosterValueSplit({ leagueRosters, boardPlayers, rosterPositions, myRosterId }) → { mode, positions, coverage, teamCount }`
    - `mode`: `'value'` | `'rank'`
    - `positions`: `Array<{ pos, mine, median, diff }>`, `diff` ist in beiden Modi so gedreht, dass **positiv = besser als das Feld**
    - `coverage`: 0..1

- [ ] **Step 1: Test schreiben**

`src/services/analysis/rosterStats.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { median, rosterValueSplit } from './rosterStats'

describe('median', () => {
  it('ungerade Anzahl -> mittlerer Wert', () => {
    expect(median([3, 1, 2])).toBe(2)
  })
  it('gerade Anzahl -> Mittel der beiden mittleren', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })
  it('leere Liste -> null statt NaN', () => {
    expect(median([])).toBeNull()
  })
})

const board = [
  { sleeper_id: '1', nname: 'a a', pos: 'RB', ecr: 5, dynasty_value: 100 },
  { sleeper_id: '2', nname: 'b b', pos: 'RB', ecr: 50, dynasty_value: 40 },
  { sleeper_id: '3', nname: 'c c', pos: 'RB', ecr: 80, dynasty_value: 10 },
]
const rosters = [
  { roster_id: 1, players: ['1'] },   // starker RB
  { roster_id: 2, players: ['2'] },
  { roster_id: 3, players: ['3'] },   // schwacher RB
]

describe('rosterValueSplit', () => {
  it('mit dynasty_value: Summe je Position gegen den Liga-Median', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('value')
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(100)
    expect(rb.median).toBe(40)     // Median aus 100, 40, 10
    expect(rb.diff).toBe(60)
  })

  it('ohne dynasty_value: rangbasiert, positives diff heisst weiterhin besser', () => {
    const ohneWert = board.map(({ dynasty_value, ...rest }) => rest)
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: ohneWert, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.mode).toBe('rank')
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBe(5)        // bester eigener RB
    expect(rb.median).toBe(50)     // Median aus 5, 50, 80
    expect(rb.diff).toBe(45)       // median - mine, weil kleiner Rang besser ist
  })

  it('Deckungsgrad zaehlt gematchte Kaderspieler', () => {
    const mitUnbekannt = [{ roster_id: 1, players: ['1', '999'] }, ...rosters.slice(1)]
    const r = rosterValueSplit({
      leagueRosters: mitUnbekannt, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.coverage).toBeCloseTo(3 / 4)
  })

  it('ein einzelner Kader: Median ist der eigene Wert, diff 0', () => {
    const r = rosterValueSplit({
      leagueRosters: [rosters[0]], boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.teamCount).toBe(1)
    expect(r.positions.find((p) => p.pos === 'RB').diff).toBe(0)
  })

  it('ohne leagueRosters -> leere, gueltige Struktur', () => {
    const r = rosterValueSplit({
      leagueRosters: [], boardPlayers: board, rosterPositions: ['RB'], myRosterId: 1,
    })
    expect(r.positions).toEqual([])
    expect(r.coverage).toBe(0)
  })

  it('unbekanntes myRosterId -> mine und diff null, Median bleibt gueltig', () => {
    const r = rosterValueSplit({
      leagueRosters: rosters, boardPlayers: board, rosterPositions: ['RB'], myRosterId: 99,
    })
    const rb = r.positions.find((p) => p.pos === 'RB')
    expect(rb.mine).toBeNull()
    expect(rb.diff).toBeNull()
    expect(rb.median).toBe(40)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/services/analysis/rosterStats.test.js
```

Erwartet: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementieren**

`src/services/analysis/rosterStats.js`:

```js
// Kader-Statistiken: eigener Kader gegen das Liga-Feld.
//
// Zwei Betriebsarten. Fuehrt das Board dynasty_value, wird der Wert summiert.
// Sonst wird rein ueber Raenge verglichen -- bewusst OHNE eine Wertkurve ueber
// die Raenge zu legen, denn die waere eine Annahme, keine Quelle.
import { normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { starterSlots } from './draftStats'

const SPLIT_POS = ['QB', 'RB', 'WR', 'TE']

export function median(numbers = []) {
  const list = numbers.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!list.length) return null
  const mid = Math.floor(list.length / 2)
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2
}

export function rosterValueSplit({
  leagueRosters = [], boardPlayers = [], rosterPositions = [], myRosterId = null,
}) {
  const byId = new Map()
  for (const bp of boardPlayers || []) {
    if (bp?.sleeper_id) byId.set(String(bp.sleeper_id), bp)
  }
  // toFiniteOrNull, nicht Number(): sonst zaehlt dynasty_value: null als 0
  // und der Wertmodus wuerde auf einem Board ohne Werte anspringen.
  const hasValue = (boardPlayers || []).some((bp) => toFiniteOrNull(bp?.dynasty_value) !== null)
  const mode = hasValue ? 'value' : 'rank'

  let total = 0
  let matched = 0
  const perTeam = []

  for (const roster of leagueRosters || []) {
    const players = []
    for (const id of roster?.players || []) {
      total += 1
      const bp = byId.get(String(id))
      if (bp) { matched += 1; players.push(bp) }
    }
    perTeam.push({ rosterId: roster?.roster_id ?? null, players })
  }

  const positions = []
  for (const pos of SPLIT_POS) {
    const raw = starterSlots(pos, rosterPositions)
    if (raw === 0) continue
    const slots = Math.max(1, Math.round(raw))

    // Wertmodus: Summe der besten `slots` Spieler. Rangmodus: der Rang des
    // besten Spielers -- summierte Raenge waeren bedeutungslos.
    const scoreOf = (team) => {
      const atPos = team.players
        .filter((bp) => normalizePos(bp.pos) === pos)
        .sort((a, b) => mode === 'value'
          ? Number(b.dynasty_value || 0) - Number(a.dynasty_value || 0)
          : Number(a.ecr ?? Infinity) - Number(b.ecr ?? Infinity))
        .slice(0, slots)
      if (!atPos.length) return null
      return mode === 'value'
        ? atPos.reduce((s, bp) => s + (Number(bp.dynasty_value) || 0), 0)
        : Number(atPos[0].ecr)
    }

    const scores = perTeam.map(scoreOf).filter((v) => Number.isFinite(v))
    if (!scores.length) continue

    const me = perTeam.find((t) => String(t.rosterId) === String(myRosterId))
    const mineRaw = me ? scoreOf(me) : null
    const mine = Number.isFinite(mineRaw) ? mineRaw : null
    const med = median(scores)
    // Bei Raengen ist klein gut, deshalb dreht sich das Vorzeichen -- positiv
    // heisst in beiden Modi "besser als das Feld".
    const diff = (mine !== null && Number.isFinite(med))
      ? (mode === 'value' ? mine - med : med - mine)
      : null

    positions.push({ pos, mine, median: med, diff })
  }

  return { mode, positions, coverage: total ? matched / total : 0, teamCount: perTeam.length }
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/services/analysis/rosterStats.test.js
```

Erwartet: PASS, 9 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/rosterStats.js src/services/analysis/rosterStats.test.js
git commit -m "feat(analyse): Wert-Split gegen den Liga-Median, wert- und rangbasiert"
```

---

### Task 7: Streit und Zugriffs-Fenster (Kachel 6)

**Files:**
- Create: `src/services/analysis/marketStats.js`
- Create: `src/services/analysis/marketStats.test.js`

**Interfaces:**
- Consumes: `pickName()` aus Task 2
- Produces: `marketDisagreement({ boardPlayers, picks, limit = 10 }) → { players, basis, scaleMin, scaleMax }`
  - `players`: `Array<{ name, pos, adp, low, high, stdev }>`, absteigend nach `stdev`

- [ ] **Step 1: Test schreiben**

`src/services/analysis/marketStats.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { marketDisagreement } from './marketStats'

const p = (nname, name, stdev, adp, low, high) =>
  ({ nname, name, pos: 'RB', stdev, adp, low, high })

describe('marketDisagreement', () => {
  it('sortiert absteigend nach stdev', () => {
    const board = [p('a a', 'A A', 2, 10, 8, 12), p('b b', 'B B', 9, 20, 5, 40)]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((x) => x.name)).toEqual(['B B', 'A A'])
  })

  it('Spieler ohne stdev oder ohne high/low fallen heraus', () => {
    const board = [
      p('a a', 'A A', 5, 10, 8, 12),
      p('b b', 'B B', null, 20, 5, 40),
      { nname: 'c c', name: 'C C', pos: 'RB', stdev: 3, adp: 15 },  // kein low/high
    ]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.players.map((x) => x.name)).toEqual(['A A'])
    expect(r.basis).toBe(1)
  })

  it('gepickte Spieler fallen heraus', () => {
    const board = [p('a a', 'A A', 5, 10, 8, 12), p('b b', 'B B', 9, 20, 5, 40)]
    const picks = [{ pick_no: 1, metadata: { first_name: 'B', last_name: 'B' } }]
    const r = marketDisagreement({ boardPlayers: board, picks })
    expect(r.players.map((x) => x.name)).toEqual(['A A'])
  })

  it('Skala umspannt alle low/high-Werte', () => {
    const board = [p('a a', 'A A', 5, 10, 8, 12), p('b b', 'B B', 9, 20, 5, 40)]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.scaleMin).toBe(5)
    expect(r.scaleMax).toBe(40)
  })

  it('low === high ergibt eine Skala mit Breite, keine Division durch null', () => {
    const board = [p('a a', 'A A', 5, 10, 10, 10)]
    const r = marketDisagreement({ boardPlayers: board, picks: [] })
    expect(r.scaleMax).toBeGreaterThan(r.scaleMin)
  })

  it('limit begrenzt die Liste', () => {
    const board = Array.from({ length: 20 }, (_, i) =>
      p(`x${i} y`, `X${i} Y`, i, 10, 5, 15))
    expect(marketDisagreement({ boardPlayers: board, picks: [], limit: 3 }).players).toHaveLength(3)
  })

  it('leeres Board -> gueltige Struktur, basis 0', () => {
    const r = marketDisagreement({ boardPlayers: [], picks: [] })
    expect(r.players).toEqual([])
    expect(r.basis).toBe(0)
  })
})
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run src/services/analysis/marketStats.test.js
```

Erwartet: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementieren**

`src/services/analysis/marketStats.js`:

```js
// Markt-Statistiken aus den Feldern, die marketMerge.js mitbringt:
// stdev (Streuung der ADP), low/high (Extremwerte), adp (Mittel).
import { normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { pickName } from './draftStats'

/**
 * Die Spieler, ueber die sich der Markt am wenigsten einig ist -- samt ihrem
 * realistischen Zugriffs-Fenster.
 */
export function marketDisagreement({ boardPlayers = [], picks = [], limit = 10 }) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))

  const num = toFiniteOrNull

  const usable = (boardPlayers || [])
    .filter((bp) => num(bp?.stdev) !== null
      && num(bp?.low) !== null
      && num(bp?.high) !== null
      && bp?.nname && !taken.has(bp.nname))
    .map((bp) => ({
      name: bp.name || bp.nname,
      pos: normalizePos(bp.pos),
      adp: num(bp.adp),
      low: num(bp.low),
      high: num(bp.high),
      stdev: num(bp.stdev),
    }))
    .sort((a, b) => b.stdev - a.stdev)

  const players = usable.slice(0, limit)
  const scaleMin = players.length ? Math.min(...players.map((x) => x.low)) : 0
  // Mindestbreite 1, damit die Balkenberechnung nie durch null teilt.
  const scaleMax = players.length
    ? Math.max(Math.max(...players.map((x) => x.high)), scaleMin + 1)
    : 1

  return { players, basis: usable.length, scaleMin, scaleMax }
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
npx vitest run src/services/analysis/marketStats.test.js
```

Erwartet: PASS, 7 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/analysis/marketStats.js src/services/analysis/marketStats.test.js
git commit -m "feat(analyse): Markt-Streit und Zugriffs-Fenster"
```

---

### Task 8: Liga-Kader in allen Ligen laden

**Files:**
- Modify: `src/stores/useDynastyStore.js`
- Modify: `src/App.jsx:308-315`

**Interfaces:**
- Produces: `useDynastyStore().leagueRosters` — `Array` der rohen Sleeper-Roster-Objekte (`{ roster_id, owner_id, players: string[], starters, taxi, reserve }`), `[]` wenn nicht geladen. Wird von Task 12 gelesen.

- [ ] **Step 1: Store erweitern**

In `src/stores/useDynastyStore.js` das Feld im Initialzustand ergänzen (neben `dynastyRoster: []`):

```js
  leagueRosters: [],
```

Setter daneben:

```js
  setLeagueRosters: (v) => set({ leagueRosters: v }),
```

In `loadDynastyRoster` das bestehende `set({ rosterToUserMap: rMap })` ersetzen durch:

```js
      set({ rosterToUserMap: rMap, leagueRosters: rosters || [] })
```

Im frühen Rücksprung ohne Liga und im `catch` jeweils mitleeren:

```js
    if (!selectedLeagueId || !sleeperUserId) { set({ dynastyRoster: [], leagueRosters: [] }); return }
```

```js
      console.warn('[dynastyRoster] load failed', e)
      set({ dynastyRoster: [], leagueRosters: [] })
```

- [ ] **Step 2: Ladebedingung in `App.jsx` lockern**

`src/App.jsx`, der Effekt bei Zeile ~309. Vorher:

```js
  useEffect(() => {
    if (draftMode !== 'rookie' || !selectedLeagueId || !sleeperUserId) {
      useDynastyStore.getState().setDynastyRoster([])
      return
    }
    loadDynastyRoster({ selectedLeagueId, sleeperUserId, seasonYear })
  }, [draftMode, selectedLeagueId, sleeperUserId, seasonYear]) // eslint-disable-line
```

Nachher:

```js
  // Kader werden fuer JEDE echte Liga geladen, nicht nur im Rookie-Modus: die
  // Analyse-Seite vergleicht den eigenen Kader gegen das Liga-Feld, und in einer
  // Redraft-Liga ist der aktuelle Stand (nach Waivers/Trades) eine andere
  // Information als die Draft-Picks. Mock-Drafts haben keine league_id und
  // loesen weiterhin nichts aus.
  useEffect(() => {
    if (!selectedLeagueId || !sleeperUserId) {
      useDynastyStore.getState().setDynastyRoster([])
      useDynastyStore.getState().setLeagueRosters([])
      return
    }
    loadDynastyRoster({ selectedLeagueId, sleeperUserId, seasonYear })
  }, [selectedLeagueId, sleeperUserId, seasonYear]) // eslint-disable-line
```

`draftMode` fällt aus der Bedingung **und** aus der Abhängigkeitsliste. `loadTradedPicks` im Effekt darunter bleibt **unverändert** an `rookie` gebunden.

- [ ] **Step 3: Testsuite laufen lassen**

```bash
npm test
```

Erwartet: PASS. Der Rookie-Pfad ist unberührt — `dynastyRoster` wird weiterhin befüllt, nur zusätzlich auch in Redraft-Ligen.

- [ ] **Step 4: Im Browser prüfen**

Dev-Server über die Preview-Werkzeuge starten (`npm run dev:all`), eine **Redraft**-Liga wählen und im Netzwerk-Log ein `GET .../league/<id>/rosters` bestätigen. Vor dieser Änderung fand der Request in Redraft-Ligen nicht statt.

- [ ] **Step 5: Commit**

```bash
git add src/stores/useDynastyStore.js src/App.jsx
git commit -m "feat(store): Liga-Kader auch in Redraft-Ligen laden und behalten"
```

---

### Task 9: `StatCard` und Stile

**Files:**
- Create: `src/components/analysis/StatCard.jsx`
- Create: `src/styles/analysis.css`
- Modify: `src/utils/formatting.js`

**Interfaces:**
- Produces:
  - `posColor(pos) → string` (CSS-`var()`-Ausdruck) und `signed(n) → string` in `src/utils/formatting.js` — beide werden von Task 10 **und** 11 gebraucht; sie liegen zentral, damit sie nicht in drei Reiter-Komponenten dupliziert werden.
  - `<StatCard title hint headline sub basis wide empty>{children}</StatCard>` — rendert `empty` als Begründungstext statt des Inhalts, wenn gesetzt.

- [ ] **Step 0: Gemeinsame Helfer in `formatting.js`**

An `src/utils/formatting.js` anhängen — beide Reiter-Komponenten brauchen sie, deshalb liegen sie neben `cx` und `normalizePos` statt je Komponente noch einmal:

```js
/** Positionsfarbe als CSS-var mit Rueckfall, fuer inline styles. */
export const posColor = (pos) => `var(--pos-${String(pos || '').toLowerCase()}, #666)`

/** Zahl mit sichtbarem Vorzeichen, gerundet. 0 bleibt "0". */
export const signed = (n) => {
  const v = Math.round(Number(n) || 0)
  return v > 0 ? `+${v}` : String(v)
}
```

- [ ] **Step 1: Komponente schreiben**

`src/components/analysis/StatCard.jsx`:

```jsx
import { cx } from '../../utils/formatting'

/**
 * Gemeinsames Kachel-Geruest der Analyse-Seite.
 *
 * `basis` ist Pflicht, sobald die Kachel Zahlen zeigt: die Seite behauptet
 * Genauigkeit, also legt sie ihre Grundlage offen.
 * `empty` ersetzt den Inhalt durch eine Begruendung -- eine Kachel ohne Daten
 * zeigt nie Nullwerte.
 */
export default function StatCard({
  title, hint = '', headline = null, sub = '', basis = '',
  wide = false, empty = '', children,
}) {
  return (
    <section className={cx('an-card', wide && 'an-card--wide')}>
      <header className="an-card-head">
        <h3 className="an-card-title">{title}</h3>
        {hint && <p className="an-card-hint">{hint}</p>}
      </header>

      {empty ? (
        <p className="an-card-empty">{empty}</p>
      ) : (
        <>
          {headline !== null && (
            <div className="an-card-headline">
              <span className="an-headline-value">{headline}</span>
              {sub && <span className="an-headline-sub">{sub}</span>}
            </div>
          )}
          <div className="an-card-body">{children}</div>
          {basis && <footer className="an-card-basis">{basis}</footer>}
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Stile schreiben**

`src/styles/analysis.css`:

```css
/* Analyse-Seite: Reiter, Kachel-Raster, Kachel-Innereien.
   Farben und Abstaende kommen aus den bestehenden Tokens der Shell. */

.an-tabs {
  display: flex;
  gap: .25rem;
  border-bottom: 1px solid var(--border, #2a2a2a);
  margin-bottom: 1rem;
}

.an-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: .6rem 1rem;
  color: var(--muted, #888);
  font: inherit;
  cursor: pointer;
}

.an-tab.is-on {
  color: var(--fg, #eee);
  border-bottom-color: var(--accent, #4ea1ff);
}

.an-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
  align-items: start;
}

.an-card {
  background: var(--card-bg, #161616);
  border: 1px solid var(--border, #2a2a2a);
  border-radius: 8px;
  padding: 1rem;
}

/* Breite Kacheln nur, wenn das Raster ueberhaupt zwei Spalten hat. */
@media (min-width: 720px) {
  .an-card--wide { grid-column: span 2; }
}

.an-card-title { margin: 0; font-size: .95rem; }

.an-card-hint {
  margin: .15rem 0 0;
  font-size: .78rem;
  color: var(--muted, #888);
}

.an-card-headline {
  display: flex;
  align-items: baseline;
  gap: .5rem;
  margin: .75rem 0;
}

.an-headline-value {
  font-size: 2rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.an-headline-sub { font-size: .85rem; color: var(--muted, #888); }

.an-card-basis {
  margin-top: .75rem;
  padding-top: .5rem;
  border-top: 1px solid var(--border, #2a2a2a);
  font-size: .72rem;
  color: var(--muted, #888);
}

.an-card-empty {
  margin: .75rem 0 0;
  font-size: .85rem;
  color: var(--muted, #888);
}

/* Zeilen mit Positions-Pille + Balken, von mehreren Kacheln genutzt. */
.an-row {
  display: grid;
  grid-template-columns: 2.5rem 1fr auto;
  align-items: center;
  gap: .5rem;
  padding: .3rem 0;
}

.an-pos {
  font-size: .72rem;
  font-weight: 600;
  text-align: center;
  border-radius: 3px;
  padding: .15rem 0;
  color: #000;
}

.an-num { font-variant-numeric: tabular-nums; }
.an-pos-good { color: var(--good, #4ec97b); }
.an-pos-bad { color: var(--bad, #e0555a); }

.an-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.an-table th, .an-table td { padding: .35rem .5rem; text-align: left; }
.an-table th { color: var(--muted, #888); font-weight: 500; }
.an-table td.an-num, .an-table th.an-num { text-align: right; }
.an-table tr.is-me { background: color-mix(in srgb, var(--accent, #4ea1ff) 12%, transparent); }

.an-steals { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
.an-steals h4 { margin: 0 0 .35rem; font-size: .8rem; color: var(--muted, #888); }
.an-steals ol { margin: 0; padding-left: 1.1rem; font-size: .82rem; }
.an-steals li { padding: .1rem 0; }

.an-tierbar { display: flex; gap: 2px; height: 10px; }
.an-tierseg { background: var(--border, #2a2a2a); border-radius: 2px; }
.an-tierseg.is-done { opacity: .3; }
.an-tierseg.is-active { background: var(--accent, #4ea1ff); }

.an-timeline { display: flex; gap: 1px; height: 22px; }
.an-tlseg { flex: 1 1 0; border-radius: 1px; min-width: 2px; }

.an-whisker {
  display: grid;
  grid-template-columns: 2.5rem minmax(6rem, 1fr) 2fr auto;
  align-items: center;
  gap: .5rem;
  padding: .25rem 0;
  font-size: .82rem;
}

.an-wname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.an-wtrack {
  position: relative;
  height: 10px;
  background: var(--border, #2a2a2a);
  border-radius: 5px;
}

.an-wrange {
  position: absolute; top: 0; height: 100%;
  background: var(--accent, #4ea1ff);
  opacity: .45;
  border-radius: 5px;
}

.an-wadp {
  position: absolute; top: -2px; width: 2px; height: 14px;
  background: var(--fg, #eee);
}

.an-wmine {
  position: absolute; top: -4px; width: 2px; height: 18px;
  background: var(--good, #4ec97b);
}

@media (max-width: 720px) {
  .an-steals { grid-template-columns: 1fr; }
  .an-whisker { grid-template-columns: 2.5rem 1fr auto; }
  .an-whisker .an-wtrack { grid-column: 1 / -1; }
}
```

- [ ] **Step 3: Prüfen, dass nichts bricht**

```bash
npm test
```

Erwartet: PASS (keine neuen Tests, aber die Suite muss grün bleiben).

- [ ] **Step 4: Commit**

```bash
git add src/components/analysis/StatCard.jsx src/styles/analysis.css
git commit -m "feat(analyse): Kachel-Geruest und Stile"
```

---

### Task 10: Reiter „Draft"

**Files:**
- Create: `src/components/analysis/DraftTab.jsx`

**Interfaces:**
- Consumes: `StatCard` aus Task 9; die Rückgaben von `teamDraftRanking`, `positionalScarcity`, `tierUsage`, `positionalRuns`
- Produces: `<DraftTab ranking scarcity tiers runs myTeamKey />`

- [ ] **Step 1: Komponente schreiben**

`src/components/analysis/DraftTab.jsx`:

```jsx
import StatCard from './StatCard'
import { cx, posColor, signed } from '../../utils/formatting'

function TeamRanking({ r, myTeamKey }) {
  if (!r.teams.length) {
    return <StatCard title="Team-Draft-Ranking" wide empty="Noch keine Picks in diesem Draft." />
  }
  return (
    <StatCard
      title="Team-Draft-Ranking"
      hint="Summe aus Experten-Rang minus Pick-Nummer. Positiv heisst: unter Wert geholt."
      headline={r.myDelta !== null ? signed(r.myDelta) : '—'}
      sub={r.myRank ? `Platz ${r.myRank} von ${r.teams.length}` : 'Dein Team nicht erkannt'}
      basis={`aus ${r.matched} bewerteten Picks${r.unmatched ? ` · ${r.unmatched} ohne Ranking-Treffer` : ''}`}
      wide
    >
      <table className="an-table">
        <thead>
          <tr>
            <th>#</th><th>Team</th><th className="an-num">Bilanz</th>
            <th>Bester Pick</th><th>Schwaechster</th>
          </tr>
        </thead>
        <tbody>
          {r.teams.map((t, i) => (
            <tr key={t.key} className={cx(t.key === myTeamKey && 'is-me')}>
              <td>{i + 1}</td>
              <td>{t.label}</td>
              <td className={cx('an-num', t.delta > 0 ? 'an-pos-good' : t.delta < 0 && 'an-pos-bad')}>
                {signed(t.delta)}
              </td>
              <td>{t.best ? `${t.best.name} (${signed(t.best.delta)})` : '—'}</td>
              <td>{t.worst ? `${t.worst.name} (${signed(t.worst.delta)})` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="an-steals">
        <div>
          <h4>Top Steals</h4>
          <ol>
            {r.steals.map((s) => (
              <li key={`s${s.pick_no}`}>
                {s.name} <span className="an-pos-good">{signed(s.delta)}</span>
                <span className="muted"> · Pick {s.pick_no} · {s.teamLabel}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4>Groesste Reaches</h4>
          <ol>
            {r.reaches.map((s) => (
              <li key={`r${s.pick_no}`}>
                {s.name} <span className="an-pos-bad">{signed(s.delta)}</span>
                <span className="muted"> · Pick {s.pick_no} · {s.teamLabel}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </StatCard>
  )
}

function Scarcity({ rows }) {
  if (!rows.length) {
    return <StatCard title="Positionsknappheit" empty="Kein Ranking importiert." />
  }
  const max = Math.max(...rows.map((r) => r.need), 1)
  const knappste = rows.slice().sort((a, b) => a.startable - b.startable)[0]

  return (
    <StatCard
      title="Positionsknappheit"
      hint="Startbare Spieler, die es fuer die Liga noch gibt — gemessen am Bedarf aller Teams."
      headline={knappste.exhausted ? 'erschoepft' : String(knappste.startable)}
      sub={`${knappste.pos} am knappsten`}
      basis="Bedarf = Teams x Starter-Slots, FLEX anteilig"
    >
      {rows.map((r) => (
        <div className="an-row" key={r.pos}>
          <span className="an-pos" style={{ background: posColor(r.pos) }}>{r.pos}</span>
          <svg viewBox={`0 0 ${max} 1`} preserveAspectRatio="none" height="10" role="img"
               aria-label={`${r.pos}: ${r.startable} von ${r.need} startbar`}>
            <rect x="0" y="0" width={max} height="1" fill="var(--border, #2a2a2a)" />
            <rect x="0" y="0" width={r.startable} height="1" fill={posColor(r.pos)} />
          </svg>
          <span className="an-num">
            {r.exhausted ? 'erschoepft' : `${r.startable}/${r.need}`}
            {r.vor !== null && <span className="muted"> · Vorsprung {r.vor}</span>}
          </span>
        </div>
      ))}
    </StatCard>
  )
}

function Tiers({ rows }) {
  if (!rows.length) {
    return <StatCard title="Tier-Verbrauch" empty="Dieses Ranking enthaelt keine Tiers." />
  }
  const warn = rows
    .filter((r) => r.activeTier !== null)
    .sort((a, b) => a.remainingInActive - b.remainingInActive)[0]

  return (
    <StatCard
      title="Tier-Verbrauch"
      hint="Wie viele Spieler im aktuell besten noch offenen Tier stehen."
      headline={warn ? String(warn.remainingInActive) : '—'}
      sub={warn ? `${warn.pos} Tier ${warn.activeTier}` : 'alle Tiers leer'}
      basis="Tiers aus dem importierten Ranking"
    >
      {rows.map((r) => (
        <div className="an-row" key={r.pos}>
          <span className="an-pos" style={{ background: posColor(r.pos) }}>{r.pos}</span>
          <div className="an-tierbar">
            {r.tiers.map((t) => (
              <span
                key={t.tier}
                className={cx('an-tierseg', t.remaining === 0 && 'is-done', t.tier === r.activeTier && 'is-active')}
                style={{ flexGrow: t.total }}
                title={`Tier ${t.tier}: ${t.remaining} von ${t.total} frei`}
              />
            ))}
          </div>
          <span className="an-num">
            {r.activeTier !== null ? `T${r.activeTier}: ${r.remainingInActive}` : 'leer'}
          </span>
        </div>
      ))}
    </StatCard>
  )
}

function Runs({ r }) {
  if (!r.timeline.length) {
    return <StatCard title="Positional Runs" wide empty="Zu frueh im Draft." />
  }
  const top = r.runs[0] || null
  return (
    <StatCard
      title="Positional Runs"
      hint={`Rollierendes Fenster ueber die letzten ${r.window} Picks.`}
      headline={top ? String(top.count) : 'kein Run'}
      sub={top ? `${top.pos} in den letzten ${r.window} Picks` : 'gleichmaessige Verteilung'}
      basis={`${r.timeline.length} Picks`}
      wide
    >
      <div className="an-timeline" role="img" aria-label="Positionsverlauf des Drafts">
        {r.timeline.map((t) => (
          <span
            key={t.pick_no}
            className="an-tlseg"
            style={{ background: t.pos ? posColor(t.pos) : 'var(--border, #2a2a2a)' }}
            title={`Pick ${t.pick_no}: ${t.pos || '?'}`}
          />
        ))}
      </div>
    </StatCard>
  )
}

export default function DraftTab({ ranking, scarcity, tiers, runs, myTeamKey }) {
  return (
    <div className="an-grid">
      <TeamRanking r={ranking} myTeamKey={myTeamKey} />
      <Scarcity rows={scarcity} />
      <Tiers rows={tiers} />
      <Runs r={runs} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/analysis/DraftTab.jsx
git commit -m "feat(analyse): Reiter Draft mit Ranking, Knappheit, Tiers und Runs"
```

---

### Task 11: Reiter „Kader" und „Markt"

**Files:**
- Create: `src/components/analysis/RosterTab.jsx`
- Create: `src/components/analysis/MarketTab.jsx`

**Interfaces:**
- Consumes: `StatCard` aus Task 9; Rückgaben von `rosterValueSplit` und `marketDisagreement`
- Produces: `<RosterTab split />`, `<MarketTab market nextPickNo />`

- [ ] **Step 1: `RosterTab` schreiben**

`src/components/analysis/RosterTab.jsx`:

```jsx
import StatCard from './StatCard'
import { cx, posColor, signed } from '../../utils/formatting'

export default function RosterTab({ split }) {
  const { mode, positions, coverage, teamCount } = split

  if (!teamCount) {
    return (
      <div className="an-grid">
        <StatCard
          title="Kader gegen das Liga-Feld"
          empty="Nur fuer echte Ligen — Mock-Drafts haben keine Kader."
        />
      </div>
    )
  }
  if (coverage < 0.5) {
    return (
      <div className="an-grid">
        <StatCard
          title="Kader gegen das Liga-Feld"
          empty={`Nur ${Math.round(coverage * 100)} % der Kaderspieler stehen im importierten Ranking — zu duenn fuer einen Vergleich.`}
        />
      </div>
    )
  }

  const einheit = mode === 'value' ? 'Punkten' : 'Raengen'
  const beste = positions.slice().sort((a, b) => (b.diff ?? -Infinity) - (a.diff ?? -Infinity))[0]
  const maxAbs = Math.max(...positions.map((p) => Math.abs(p.diff ?? 0)), 1)

  return (
    <div className="an-grid">
      <StatCard
        title="Kader gegen das Liga-Feld"
        hint={mode === 'value'
          ? 'Summe der Dynasty-Werte je Position, verglichen mit dem Median der Liga.'
          : 'Rang deines besten Spielers je Position, verglichen mit dem Median der Liga. Rangabstaende sind nicht wertproportional — die Richtung ist verlaesslich, der Betrag grob.'}
        headline={beste?.diff != null ? signed(beste.diff) : '—'}
        sub={beste ? `${beste.pos} ist deine staerkste Position` : ''}
        basis={`${teamCount} Kader · Deckung ${Math.round(coverage * 100)} % · in ${einheit}`}
        wide
      >
        {positions.map((p) => (
          <div className="an-row" key={p.pos}>
            <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
            <svg viewBox={`${-maxAbs} 0 ${maxAbs * 2} 1`} preserveAspectRatio="none" height="12"
                 role="img" aria-label={`${p.pos}: ${Math.round(p.diff ?? 0)} gegenueber dem Median`}>
              <line x1="0" y1="0" x2="0" y2="1" stroke="var(--muted, #888)" strokeWidth={maxAbs / 100} />
              <rect
                x={Math.min(0, p.diff ?? 0)} y="0.15"
                width={Math.abs(p.diff ?? 0)} height="0.7"
                fill={(p.diff ?? 0) >= 0 ? 'var(--good, #4ec97b)' : 'var(--bad, #e0555a)'}
              />
            </svg>
            <span className={cx('an-num', (p.diff ?? 0) >= 0 ? 'an-pos-good' : 'an-pos-bad')}>
              {p.diff != null ? signed(p.diff) : '—'}
            </span>
          </div>
        ))}
      </StatCard>
    </div>
  )
}
```

- [ ] **Step 2: `MarketTab` schreiben**

`src/components/analysis/MarketTab.jsx`:

```jsx
import StatCard from './StatCard'
import { posColor } from '../../utils/formatting'

export default function MarketTab({ market, nextPickNo = null }) {
  const { players, basis, scaleMin, scaleMax } = market

  if (!players.length) {
    return (
      <div className="an-grid">
        <StatCard
          title="Umstrittenste Spieler"
          empty="Dieses Ranking enthaelt keine Marktdaten (Streuung, Hoch- und Tiefstwerte)."
        />
      </div>
    )
  }

  const span = scaleMax - scaleMin
  const pct = (v) => ((v - scaleMin) / span) * 100

  return (
    <div className="an-grid">
      <StatCard
        title="Umstrittenste Spieler"
        hint="Grosse Streuung heisst: der Markt ist sich uneins — hier weichen Ligen am staerksten voneinander ab."
        headline={players[0].stdev.toFixed(1)}
        sub={`hoechste Streuung: ${players[0].name}`}
        basis={`${players.length} von ${basis} Spielern mit Marktdaten${nextPickNo ? ` · deine naechste Pick-Nr: ${nextPickNo}` : ''}`}
        wide
      >
        {players.map((p) => (
          <div className="an-whisker" key={p.name}>
            <span className="an-pos" style={{ background: posColor(p.pos) }}>{p.pos}</span>
            <span className="an-wname">{p.name}</span>
            <div className="an-wtrack">
              <span className="an-wrange"
                    style={{ left: `${pct(p.low)}%`, width: `${pct(p.high) - pct(p.low)}%` }} />
              {Number.isFinite(p.adp) && (
                <span className="an-wadp" style={{ left: `${pct(p.adp)}%` }} />
              )}
              {nextPickNo && nextPickNo >= scaleMin && nextPickNo <= scaleMax && (
                <span className="an-wmine" style={{ left: `${pct(nextPickNo)}%` }}
                      title={`Dein Pick ${nextPickNo}`} />
              )}
            </div>
            <span className="an-num">{Math.round(p.low)}–{Math.round(p.high)}</span>
          </div>
        ))}
      </StatCard>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/analysis/RosterTab.jsx src/components/analysis/MarketTab.jsx
git commit -m "feat(analyse): Reiter Kader und Markt"
```

---

### Task 12: Seite verdrahten, Route umstellen, aufräumen

**Files:**
- Create: `src/pages/AnalysisPage.jsx`
- Modify: `src/App.jsx` (Import + Route)
- Modify: `src/components/NextShell.jsx` (2 Labels)
- Delete: `src/pages/RosterPage.jsx`, ggf. `src/components/RosterSection.jsx`

**Interfaces:**
- Consumes: alles aus den Tasks 1–11

- [ ] **Step 1: `AnalysisPage` schreiben**

`src/pages/AnalysisPage.jsx`:

```jsx
import { useMemo, useState } from 'react'
import { useSessionStore } from '../stores/useSessionStore'
import { useBoardStore } from '../stores/useBoardStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useDynastyStore } from '../stores/useDynastyStore'
import {
  teamDraftRanking, positionalScarcity, tierUsage, positionalRuns,
} from '../services/analysis/draftStats'
import { rosterValueSplit } from '../services/analysis/rosterStats'
import { marketDisagreement } from '../services/analysis/marketStats'
import { teamKeyFromPick } from '../services/derive'
import DraftTab from '../components/analysis/DraftTab'
import RosterTab from '../components/analysis/RosterTab'
import MarketTab from '../components/analysis/MarketTab'
import { cx } from '../utils/formatting'
import '../styles/analysis.css'

const TABS = [['draft', 'Draft'], ['roster', 'Kader'], ['market', 'Markt']]

export default function AnalysisPage({ teamsCount, ownerLabels, effRoster, draftSlot }) {
  const [tab, setTab] = useState('draft')
  const { sleeperUserId } = useSessionStore()
  const { boardPlayers } = useBoardStore()
  const { livePicks } = useLiveStore()
  const { leagueRosters, mySleeperRosterId } = useDynastyStore()

  const teams = Number(teamsCount) || 12

  // Eigenes Team: erst ueber einen eigenen Pick, sonst ueber den Draft-Slot.
  // Findet sich keins, bleiben die Ich-Angaben leer -- lieber keine Zahl als
  // die eines geratenen Teams.
  const myTeamKey = useMemo(() => {
    const mine = (livePicks || []).find((p) => p?.picked_by && p.picked_by === sleeperUserId)
    if (mine) return teamKeyFromPick(mine, teams)
    if (draftSlot) {
      const bySlot = (livePicks || []).find((p) => Number(p?.draft_slot) === Number(draftSlot))
      if (bySlot) return teamKeyFromPick(bySlot, teams)
    }
    return null
  }, [livePicks, sleeperUserId, draftSlot, teams])

  const nextPickNo = (livePicks?.length || 0) + 1

  const ranking = useMemo(
    () => teamDraftRanking({ picks: livePicks, boardPlayers, teamsCount: teams, ownerLabels, myTeamKey }),
    [livePicks, boardPlayers, teams, ownerLabels, myTeamKey]
  )
  const scarcity = useMemo(
    () => positionalScarcity({ boardPlayers, picks: livePicks, rosterPositions: effRoster, teamsCount: teams }),
    [boardPlayers, livePicks, effRoster, teams]
  )
  const tiers = useMemo(
    () => tierUsage({ boardPlayers, picks: livePicks }),
    [boardPlayers, livePicks]
  )
  const runs = useMemo(
    () => positionalRuns({ picks: livePicks, teamsCount: teams }),
    [livePicks, teams]
  )
  const split = useMemo(
    () => rosterValueSplit({
      leagueRosters, boardPlayers, rosterPositions: effRoster, myRosterId: mySleeperRosterId,
    }),
    [leagueRosters, boardPlayers, effRoster, mySleeperRosterId]
  )
  const market = useMemo(
    () => marketDisagreement({ boardPlayers, picks: livePicks }),
    [boardPlayers, livePicks]
  )

  return (
    <section className="an-page">
      <nav className="an-tabs" role="tablist" aria-label="Analyse-Bereiche">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={cx('an-tab', tab === id && 'is-on')}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'draft' && (
        <DraftTab ranking={ranking} scarcity={scarcity} tiers={tiers} runs={runs} myTeamKey={myTeamKey} />
      )}
      {tab === 'roster' && <RosterTab split={split} />}
      {tab === 'market' && <MarketTab market={market} nextPickNo={nextPickNo} />}
    </section>
  )
}
```

- [ ] **Step 2: Route umstellen**

In `src/App.jsx` den Import ersetzen:

```js
import AnalysisPage from './pages/AnalysisPage'
```

(statt `import RosterPage from './pages/RosterPage'`)

Und die Route:

```jsx
      <Route path="/roster" element={<AnalysisPage {...pageProps} />} />
```

- [ ] **Step 3: Labels in `NextShell.jsx` ändern**

Zwei Stellen, beide von „Roster & Analyse" auf „Analyse":

```js
  { icon: 'chart', tip: 'Analyse', path: '/roster' },
```

```js
    { group: 'Gehe zu', label: 'Analyse', keys: 'G R', run: () => navigate('/roster') },
```

- [ ] **Step 4: Aufrufer prüfen, bevor gelöscht wird**

```bash
grep -rn "RosterPage\|RosterSection\|RosterList" src/ --include=*.jsx --include=*.js
```

Erwartet: `RosterPage` und `RosterSection` haben nach Step 2 **keinen** Treffer ausserhalb ihrer eigenen Dateien → beide löschen. `RosterList` wird von `RosterSection` benutzt; nur löschen, wenn der Befehl ausser `RosterSection.jsx` und der eigenen Datei nichts zeigt. **Im Zweifel behalten** — eine ungenutzte Datei kostet nichts, eine fehlende bricht den Build.

```bash
git rm src/pages/RosterPage.jsx src/components/RosterSection.jsx
```

- [ ] **Step 5: Testsuite und Build**

```bash
npm test && npm run build
```

Erwartet: beide grün. Ein Build-Fehler „Could not resolve ./RosterList" heisst, dass in Step 4 zu viel gelöscht wurde.

- [ ] **Step 6: Im Browser prüfen**

Dev-Server über die Preview-Werkzeuge starten, `/roster` öffnen und durchgehen:

1. Alle drei Reiter lassen sich anklicken, keiner wirft eine Konsolenmeldung.
2. Ohne importiertes Board zeigen die Kacheln ihre Begründungstexte, keine Nullen.
3. Mit Board und laufendem Draft stehen im Team-Ranking echte Namen und Zahlen.
4. Die Fusszeile jeder Kachel nennt ihre Datengrundlage.
5. Bei Fensterbreite 1280 stehen breite Kacheln über zwei Spalten.

- [ ] **Step 7: Wissensgraph aktualisieren und committen**

```bash
graphify update .
git add -A
git commit -m "feat(analyse): /roster wird zur Analyse-Seite mit drei Reitern"
```

---

## Self-Review

**Spec-Abdeckung:** Alle sechs Kacheln der Spec haben eine Task (1→T2, 2→T3, 3→T4, 4→T5, 5→T6, 6→T7). Die Store-Änderung samt gelockerter Ladebedingung ist T8. Layout, `StatCard` und Datengrundlagen-Fusszeile sind T9. Leere Zustände sind in T10/T11 je Kachel umgesetzt. Namen und Navigation sind T12. Die Test-Vorgaben der Spec (Median gerade/ungerade, erschöpfte Position, FLEX/SUPER_FLEX, Run-Grenze in beide Richtungen, `low === high`, Tier-Parsing) sind alle als benannte Tests vorhanden.

**Nicht abgedeckt, bewusst:** Der Abschnitt „Bewusst zurückgestellt (Runde 2)" der Spec bekommt keine Tasks — das ist seine Absicht.

**Typ-Konsistenz geprüft:** `teamKeyFromPick(pick, teamsCount)` gleich in T1, T2, T12. `pickName(pick)` in T2 definiert, in T3/T4/T7 verwendet. `starterSlots(pos, rosterPositions)` in T3 definiert, in T6 importiert. Die Felder von `positionalScarcity` (`startable`, `need`, `exhausted`, `vor`) stimmen zwischen T3 und T10 überein. `rosterValueSplit` liefert `{ mode, positions, coverage, teamCount }` — genau das liest T11. `marketDisagreement` liefert `{ players, basis, scaleMin, scaleMax }` — genau das liest T11.

**Bekannte Kante:** `positionalRuns` liefert erst Ergebnisse, wenn mehr Picks vorliegen als das Fenster breit ist (bei 12 Teams ab Pick 9). Als Test festgehalten (T5) und in der Kachel als „Zu frueh im Draft" abgefangen.
