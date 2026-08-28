# CSV-Board: ADP-Override & Bye-Week-Ergänzung — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CSV-importierte Boards bekommen (1) einen Button, um ihre ADP durch Sleeper-/FFC-Markt-ADP zu ersetzen, und (2) eine bedingte Aktion im Setup-Import-Banner, um fehlende Bye Weeks aus derselben Marktquelle nachzutragen.

**Architecture:** Beide Features sind dünne Erweiterungen bestehender, bereits getesteter Mechanismen — keine neue Infrastruktur. `overlayMarketData` (Markt gewinnt pro Feld) wird für CSV-Boards sichtbar gemacht statt neu gebaut; eine neue Geschwisterfunktion `fillMissingBye` (Basis gewinnt, Markt füllt nur Lücken) übernimmt die Bye-Ergänzung. Beide laufen über dieselbe `fetchMarketAdp`-Fetch-Kaskade (Sleeper zuerst, FFC-Fallback), die im Store schon existiert.

**Tech Stack:** React 18, Zustand, Vitest + @testing-library/react. Keine neuen Abhängigkeiten.

## Global Constraints

- UI-Texte sind Deutsch (siehe CLAUDE.md-Konvention).
- Kein Linter im Projekt — nicht versuchen, ESLint-Befehle auszuführen.
- `overlayMarketData`, `mergeRankingsWithMarket`, `enrichWithInjuries`, `enrichBoardPlayersWithSleeper` bleiben unverändert — nur additive Änderungen.
- Rookie/Dynasty-Boards bekommen KEINEN Zugriff auf beide neuen Aktionen (keine Redraft-ADP für Rookie-Ränge) — exakt dieselbe Guard-Meldung wie beim bestehenden `refreshMarketData`.
- Nach Abschluss aller Tasks: `graphify update .` ausführen (Projekt-Konvention aus CLAUDE.md).
- Ganzer Feature-Branch läuft in einem eigenen Git-Worktree (vom Nutzer explizit gewünscht) — wird von der ausführenden Session vor Task 1 per `superpowers:using-git-worktrees` angelegt, nicht Teil dieses Plans.

---

### Task 1: `fillMissingBye`-Funktion in `marketMerge.js`

**Files:**
- Modify: `src/services/marketMerge.js` (neue Funktion nach `overlayMarketData`, vor `enrichWithInjuries`, aktuell Zeile 113/115)
- Test: `src/services/marketMerge.test.js` (neuer `describe`-Block am Ende, Import-Zeile erweitern)

**Interfaces:**
- Consumes: `marketIndex(marketPlayers)` (bereits vorhanden in derselben Datei, `marketMerge.js:9-16`), `normalizePlayerName` (aus `../utils/formatting`, bereits importiert).
- Produces: `export function fillMissingBye(boardPlayers, marketPlayers) -> { players, stats: { filled } }`. `players` ist ein neues Array (nicht in-place mutiert), `stats.filled` zählt, wie viele Bye-Werte tatsächlich ergänzt wurden. Wird von Task 2 importiert.

- [ ] **Step 1: Failing Tests schreiben**

In `src/services/marketMerge.test.js`, Import-Zeile 2 ersetzen:

```js
import { mergeRankingsWithMarket, overlayMarketData, enrichWithInjuries, fillMissingBye } from './marketMerge'
```

Am Dateiende (nach dem letzten `describe('enrichWithInjuries', ...)`-Block) anfügen:

```js
describe('fillMissingBye', () => {
  it('ergaenzt eine fehlende Bye aus dem Markt', () => {
    const board = [{ name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', bye: null }]
    const market = [{ name: 'Bijan Robinson', nname: 'bijan robinson', bye: 11 }]
    const { players, stats } = fillMissingBye(board, market)
    expect(players[0].bye).toBe(11)
    expect(stats.filled).toBe(1)
  })

  it('ueberschreibt eine vorhandene Bye nie', () => {
    const board = [{ name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', bye: '11' }]
    const market = [{ name: 'Bijan Robinson', nname: 'bijan robinson', bye: 99 }]
    const { players, stats } = fillMissingBye(board, market)
    expect(players[0].bye).toBe('11')
    expect(stats.filled).toBe(0)
  })

  it('kein Markt-Treffer bleibt unveraendert', () => {
    const board = [{ name: 'Ghost Player', nname: 'ghost player', rk: '1', bye: null }]
    const { players, stats } = fillMissingBye(board, [])
    expect(players[0].bye).toBeNull()
    expect(stats.filled).toBe(0)
  })

  it('Markt-Treffer ohne eigene Bye aendert nichts', () => {
    const board = [{ name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', bye: null }]
    const market = [{ name: 'Bijan Robinson', nname: 'bijan robinson', bye: null }]
    const { players, stats } = fillMissingBye(board, market)
    expect(players[0].bye).toBeNull()
    expect(stats.filled).toBe(0)
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/services/marketMerge.test.js`
Expected: FAIL — `fillMissingBye is not a function` (oder Import-Fehler).

- [ ] **Step 3: Funktion implementieren**

In `src/services/marketMerge.js`, direkt nach dem Ende von `overlayMarketData` (nach der schließenden `}` vor dem Kommentar zu `enrichWithInjuries`) einfügen:

```js
// Ergaenzt nur eine fehlende Bye Week aus dem Markt (Sleeper/FFC) -- im
// Unterschied zu overlayMarketData/mergeMarketFields gewinnt hier die
// Rang-Quelle IMMER, wenn sie schon eine Bye hat. Grund: players/nfl (die
// Quelle fuer Team/Pos/Alter in enrichBoardWithSleeper.js) hat in der Praxis
// keine Bye-Daten -- die Markt-ADP-Endpunkte schon, sollen aber nie einen
// vom Nutzer importierten Wert ueberschreiben.
export function fillMissingBye(boardPlayers, marketPlayers) {
  const market = marketIndex(marketPlayers)
  let filled = 0

  const players = (boardPlayers || []).map((p) => {
    if (p.bye) return p
    const nname = p?.nname || normalizePlayerName(p?.name || '')
    const hit = market.get(nname)
    if (!hit?.bye) return p
    filled += 1
    return { ...p, bye: hit.bye }
  })

  return { players, stats: { filled } }
}
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/services/marketMerge.test.js`
Expected: PASS (alle Tests in der Datei, inkl. der bereits bestehenden für `mergeRankingsWithMarket`/`overlayMarketData`/`enrichWithInjuries`).

- [ ] **Step 5: Commit**

```bash
git add src/services/marketMerge.js src/services/marketMerge.test.js
git commit -m "feat(board): fillMissingBye ergaenzt Bye Week nur wenn leer"
```

---

### Task 2: Store-Actions in `useBoardStore.js`

**Files:**
- Modify: `src/stores/useBoardStore.js` (Import-Zeile 5, `refreshMarketData` Zeilen 231-245, neue Action danach)
- Test: `src/stores/useBoardStore.test.js` (neue `describe`-Blöcke)

**Interfaces:**
- Consumes: `fillMissingBye` aus Task 1 (`../services/marketMerge`), `ffcFormatFor({isSuperflex, effScoringType})` und `fetchMarketAdp(format, numTeams)` (beide bereits in derselben Datei definiert, `useBoardStore.js:10-15` bzw. `:29-36`).
- Produces: `refreshMarketData({ isSuperflex, effScoringType, numTeams } = {})` — Signatur erweitert, bestehende Aufrufe ohne Argument bleiben unverändert funktionsfähig (fallen auf `marketMeta?.format || 'ppr'` zurück). Neue Action `fillMissingBye({ isSuperflex, effScoringType, numTeams } = {}) -> Promise<{ ok, stats? , error? }>`, wird von Task 5 (SetupPage) aufgerufen.

- [ ] **Step 1: Failing Tests schreiben**

In `src/stores/useBoardStore.test.js`, am Dateiende anfügen (nach dem letzten bestehenden `describe`-Block):

```js
describe('refreshMarketData mit Format-Parametern', () => {
  it('nutzt das uebergebene Format statt marketMeta.format', async () => {
    const fetchSpy = mockFetch({ 'sleeper-adp': SLEEPER, 'ffc-adp': FFC })
    vi.stubGlobal('fetch', fetchSpy)
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', adp: null }])
    await useBoardStore.getState().refreshMarketData({ isSuperflex: false, effScoringType: 'half_ppr', numTeams: 10 })
    const call = fetchSpy.mock.calls.find(([u]) => String(u).includes('sleeper-adp'))
    expect(call).toBeTruthy()
    expect(String(call[0])).toContain('format=half-ppr')
  })

  it('ohne Parameter faellt weiter auf marketMeta.format zurueck (Bestandsverhalten)', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', adp: null }])
    await useBoardStore.getState().refreshMarketData()
    expect(useBoardStore.getState().boardPlayers[0].adp).toBe(1.7)
  })
})

describe('fillMissingBye (Store-Action)', () => {
  it('ergaenzt nur eine fehlende Bye, aendert ADP nicht', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([
      { name: 'Bijan Robinson', nname: 'bijan robinson', rk: '1', adp: 5.5, bye: null },
    ])
    const res = await useBoardStore.getState().fillMissingBye()
    expect(res.ok).toBe(true)
    const p = useBoardStore.getState().boardPlayers[0]
    expect(p.bye).toBe(11)
    expect(p.adp).toBe(5.5)
  })

  it('Guard: kein Board geladen', async () => {
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([])
    const res = await useBoardStore.getState().fillMissingBye()
    expect(res.ok).toBe(false)
  })

  it('Guard: Rookie-Modus ruft keinen Fetch auf', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { useBoardStore } = await import('./useBoardStore')
    useBoardStore.getState().setBoardPlayers([{ name: 'Ashton Jeanty', nname: 'ashton jeanty', rk: '1', bye: null }])
    useBoardStore.getState().setDraftMode('rookie')
    const res = await useBoardStore.getState().fillMissingBye()
    expect(res.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/stores/useBoardStore.test.js`
Expected: FAIL — `useBoardStore.getState().fillMissingBye is not a function`, sowie der Format-Test schlägt fehl, weil `refreshMarketData` das Argument noch ignoriert.

- [ ] **Step 3: Store anpassen**

In `src/stores/useBoardStore.js`, Zeile 5 (Import) ersetzen:

```js
import { mergeRankingsWithMarket, overlayMarketData, enrichWithInjuries, fillMissingBye as fillMissingByeInMarket } from '../services/marketMerge'
```

`refreshMarketData` (aktuell Zeilen 231-245) komplett ersetzen durch:

```js
      refreshMarketData: async ({ isSuperflex, effScoringType, numTeams } = {}) => {
        const { boardPlayers, marketMeta, draftMode } = get()
        if (!boardPlayers.length) return { ok: false, error: 'Kein Board geladen' }
        // Markt-ADP ist NFL-weite Redraft-ADP — im Rookie/Dynasty-Modus waere das ein
        // Rookie-Rang gegen einen fremden Markt gerechnet, bedeutungslos und nicht
        // rueckholbar (kein Snapshot hier). handleAutoImport guardet das bereits genauso.
        if (draftMode === 'rookie') return { ok: false, error: 'Marktdaten-Refresh ist im Rookie-Modus nicht verfügbar (Redraft-ADP passt nicht auf Rookie-Ränge).' }
        // Format explizit uebergeben (Board-Seite kennt isSuperflex/effScoringType/numTeams
        // ueber draftFormat) -- ohne Argument bleibt der Fallback auf marketMeta.format,
        // fuer Aufrufer, die das schon aus einem vorherigen Import kennen.
        const format = effScoringType != null
          ? ffcFormatFor({ isSuperflex, effScoringType })
          : (marketMeta?.format || 'ppr')
        const market = await fetchMarketAdp(format, numTeams)
        if (!market) return { ok: false, error: 'Marktdaten nicht erreichbar' }
        const { players, stats } = overlayMarketData(boardPlayers, market.players)
        // rk und Reihenfolge bleiben unberuehrt — der Nutzer pflegt sein Board.
        set({ boardPlayers: players, marketMeta: market.meta })
        return { ok: true, stats }
      },

      // Bye Week ist die einzige Luecke, die enrichBoardPlayersWithSleeper strukturell
      // nicht fuellen kann (players/nfl hat in der Praxis keine Bye-Daten) -- diese
      // Action holt sie stattdessen aus derselben Markt-ADP-Quelle wie refreshMarketData,
      // aendert aber NIE eine bereits vorhandene Bye (siehe fillMissingBye in marketMerge.js).
      fillMissingBye: async ({ isSuperflex, effScoringType, numTeams } = {}) => {
        const { boardPlayers, draftMode } = get()
        if (!boardPlayers.length) return { ok: false, error: 'Kein Board geladen' }
        if (draftMode === 'rookie') return { ok: false, error: 'Bye-Week-Ergänzung ist im Rookie-Modus nicht verfügbar (Redraft-ADP passt nicht auf Rookie-Ränge).' }
        const format = effScoringType != null ? ffcFormatFor({ isSuperflex, effScoringType }) : 'ppr'
        const market = await fetchMarketAdp(format, numTeams)
        if (!market) return { ok: false, error: 'Marktdaten nicht erreichbar' }
        const { players, stats } = fillMissingByeInMarket(boardPlayers, market.players)
        set({ boardPlayers: players })
        return { ok: true, stats }
      },
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/stores/useBoardStore.test.js`
Expected: PASS (alle Tests in der Datei, inkl. bestehender `refreshMarketData`/`handleAutoImport`/etc.-Blöcke).

- [ ] **Step 5: Commit**

```bash
git add src/stores/useBoardStore.js src/stores/useBoardStore.test.js
git commit -m "feat(board): refreshMarketData kennt Format-Parameter, neue fillMissingBye-Action"
```

---

### Task 3: `BoardSection.jsx` — korrektes Format an `refreshMarketData` übergeben

**Files:**
- Modify: `src/components/BoardSection.jsx:79-85` (`handleRefreshMarket`)

**Interfaces:**
- Consumes: `draftFormat` (bereits im selben Funktionskörper deklariert, `BoardSection.jsx:211`, Objekt mit `.isSuperflex`, `.scoringType`, `.teams`), `refreshMarketData` aus Task 2 (neue optionale Argumente).
- Produces: keine neue Schnittstelle — reiner Bugfix/Voraussetzung dafür, dass Task 4s neuer CSV-Button ein korrektes Format anfragt statt immer `'ppr'`.

Kein neuer dedizierter Test nötig: `draftFormat.isSuperflex/scoringType/teams` wird an exakt derselben Stelle im selben Funktionskörper bereits identisch für `handleFantasyProsImport` verwendet (`BoardSection.jsx:167-169`, bestehender, laufender Code) — dasselbe Muster, hier nur auf `handleRefreshMarket` übertragen. Regression wird über den vollständigen Testlauf in Step 3 abgesichert.

- [ ] **Step 1: `handleRefreshMarket` anpassen**

In `src/components/BoardSection.jsx`, Zeilen 79-85 ersetzen:

```js
  async function handleRefreshMarket() {
    setRefreshingMarket(true)
    setMarketError(null)
    const res = await refreshMarketData({
      isSuperflex: draftFormat.isSuperflex,
      effScoringType: draftFormat.scoringType,
      numTeams: draftFormat.teams,
    })
    if (!res.ok) setMarketError(res.error)
    setRefreshingMarket(false)
  }
```

- [ ] **Step 2: Vollständigen Testlauf ausführen — muss weiter bestehen**

Run: `npm test`
Expected: PASS (keine Regression in `BoardSection.test.jsx`, `BoardSection.mismatch.test.jsx`, `BoardSection.empty.test.jsx`, `BoardSection.advice-cache.test.jsx` — diese mocken `useBoardStore` komplett und rufen `handleRefreshMarket` nicht auf, sind also von der Argument-Erweiterung nicht betroffen).

- [ ] **Step 3: Commit**

```bash
git add src/components/BoardSection.jsx
git commit -m "fix(board): Aktualisieren-Button nutzt echtes Liga-Format statt PPR-Default"
```

---

### Task 4: `DataProvenanceBar.jsx` — ADP-Override-Button für CSV-Boards

**Files:**
- Modify: `src/components/DataProvenanceBar.jsx:60-72` (früher `return` im `hasCsvBoard`-Zweig)
- Test: `src/components/DataProvenanceBar.test.jsx` (neue Tests)

**Interfaces:**
- Consumes: bestehende Props `marketMeta`, `onRefresh`, `refreshing`, `error`, `hasCsvBoard`, `csvFileName`, `draftMode`, `now` — **keine neuen Props**, der CSV-Zweig nutzt ab jetzt dieselben Props wie der Market-Zweig darunter. `formatMarketAge`/`isStale`/`ADP_SOURCE_LABEL` sind bereits Modul-Scope-Funktionen/Konstanten in derselben Datei (Zeilen 8-32), im CSV-Zweig bisher nur ungenutzt.
- Produces: keine neue Schnittstelle nach außen — `onRefresh` wird von `BoardSection.jsx:764` bereits unverändert durchgereicht (`onRefresh={draftMode === 'rookie' ? undefined : handleRefreshMarket}`), das greift jetzt auch im CSV-Zweig.

- [ ] **Step 1: Failing Tests schreiben**

In `src/components/DataProvenanceBar.test.jsx`, vor der schließenden `})` des `describe('DataProvenanceBar', ...)`-Blocks (nach dem bestehenden Test `'Rookie-Modus wird angezeigt...'`) einfügen:

```js
  it('CSV-Board: ADP uebernehmen erscheint mit onRefresh, heisst nicht "Aktualisieren"', () => {
    const onRefresh = vi.fn()
    render(<DataProvenanceBar marketMeta={null} hasCsvBoard csvFileName="ranks.csv" draftMode="redraft" onRefresh={onRefresh} />)
    const btn = screen.getByRole('button', { name: /ADP übernehmen/ })
    btn.click()
    expect(onRefresh).toHaveBeenCalled()
  })

  it('CSV-Board zeigt die Markt-ADP-Quelle, sobald marketMeta gesetzt ist', () => {
    render(
      <DataProvenanceBar
        marketMeta={{ source: 'sleeper', format: 'ppr', end_date: '2026-07-10' }}
        hasCsvBoard csvFileName="ranks.csv" draftMode="redraft" now={new Date('2026-07-16')}
      />
    )
    expect(screen.getByText(/Sleeper \(RotoWire\)/)).toBeTruthy()
  })

  it('CSV-Board ohne onRefresh (z.B. Rookie-Modus) zeigt keinen Button', () => {
    render(<DataProvenanceBar marketMeta={null} hasCsvBoard csvFileName="ranks.csv" draftMode="rookie" />)
    expect(screen.queryByRole('button', { name: /ADP übernehmen/ })).toBeNull()
  })
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/components/DataProvenanceBar.test.jsx`
Expected: FAIL — die ersten zwei neuen Tests finden den Button/Text nicht (aktueller CSV-Zweig rendert weder Button noch marketMeta).

- [ ] **Step 3: CSV-Zweig erweitern**

In `src/components/DataProvenanceBar.jsx`, Zeilen 60-72 ersetzen:

```jsx
  // CSV liefert Rang + eigene ADP -- optional laesst sich die ADP trotzdem aus
  // dem Markt uebernehmen (onRefresh), derselbe Mechanismus wie beim
  // Market-Board unten, nur mit anderem Label und ohne automatische ADP-Zeile
  // vor dem ersten Klick.
  if (hasCsvBoard) {
    const age = formatMarketAge(marketMeta?.end_date, now)
    const stale = isStale(marketMeta?.end_date, now)
    return (
      <div className="provenance-bar">
        <span className="provenance-item">
          <Icon name="clipboard" size={13} /> Rangliste aus CSV
          {csvFileName ? <> · {csvFileName}</> : null}
        </span>
        {marketMeta ? (
          <span className={`provenance-item${stale ? ' provenance-stale' : ''}`}>
            ADP <strong>{ADP_SOURCE_LABEL[marketMeta.source] || 'Fantasy Football Calculator'}</strong>
            {marketMeta.total_drafts ? <>, {marketMeta.total_drafts} Mocks</> : null}
            {age ? <> · Stand <strong>{age}</strong></> : null}
          </span>
        ) : (
          <span className="provenance-item">ADP aus CSV</span>
        )}
        <span className="provenance-item">Modus <strong>{mode}</strong></span>
        {onRefresh && (
          <button className="btn-compact" onClick={onRefresh} disabled={refreshing} title="Sleeper-ADP übernehmen — deine Reihenfolge bleibt">
            {refreshing ? '…' : <Icon name="refresh" size={13} />} ADP übernehmen
          </button>
        )}
        {error && <span className="provenance-item provenance-stale">{error}</span>}
        {progress}
      </div>
    )
  }
```

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/components/DataProvenanceBar.test.jsx`
Expected: PASS (alle Tests, inkl. dem bestehenden `'CSV-Board: keine Auto-Quellen, kein Aktualisieren-Button'` — der bleibt gültig, weil dieser Test kein `onRefresh` übergibt und der neue Button ohnehin "ADP übernehmen" statt "Aktualisieren" heißt).

- [ ] **Step 5: Commit**

```bash
git add src/components/DataProvenanceBar.jsx src/components/DataProvenanceBar.test.jsx
git commit -m "feat(board): ADP-uebernehmen-Button auch fuer CSV-Boards sichtbar"
```

---

### Task 5: Bye-Week-Ergänzung im Setup-Import-Banner

**Files:**
- Modify: `src/components/ImportResultBanner.jsx`
- Modify: `src/pages/SetupPage.jsx`
- Test: `src/components/ImportResultBanner.test.jsx`
- Test: `src/pages/SetupPage.test.jsx`

**Interfaces:**
- Consumes: `fillMissingBye` Store-Action aus Task 2, `deriveFormat` (bereits importiert in `SetupPage.jsx:8`, bereits genutzt in `wrappedAutoImport`/`wrappedFantasyProsImport`), `loadSetup` (bereits importiert, `SetupPage.jsx:9`).
- Produces: `ImportResultBanner` neue optionale Props `missingBye` (number, default 0), `onFillBye` (Funktion oder `undefined`), `fillingBye` (bool, default false). Keine weiteren Konsumenten außer `SetupPage.jsx`.

- [ ] **Step 1: Failing Tests für `ImportResultBanner` schreiben**

In `src/components/ImportResultBanner.test.jsx`, vor der schließenden `})` des `describe('ImportResultBanner', ...)`-Blocks einfügen:

```js
  it('zeigt fehlende Bye Weeks nur wenn missingBye > 0', () => {
    render(<ImportResultBanner stats={stats} method="CSV" missingBye={5} onFillBye={vi.fn()} />)
    expect(screen.getByText(/5 Spieler ohne Bye Week/)).toBeTruthy()
  })

  it('ohne fehlende Bye Weeks keine Zeile', () => {
    render(<ImportResultBanner stats={stats} method="CSV" missingBye={0} />)
    expect(screen.queryByText(/ohne Bye Week/)).toBeNull()
  })

  it('Jetzt ergaenzen ruft onFillBye', async () => {
    const onFillBye = vi.fn()
    render(<ImportResultBanner stats={stats} method="CSV" missingBye={3} onFillBye={onFillBye} />)
    await userEvent.click(screen.getByRole('button', { name: /Jetzt ergänzen/ }))
    expect(onFillBye).toHaveBeenCalled()
  })
```

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/components/ImportResultBanner.test.jsx`
Expected: FAIL — Zeile/Button existieren noch nicht.

- [ ] **Step 3: `ImportResultBanner.jsx` erweitern**

Komplette Datei durch folgende Fassung ersetzen (Signatur und `import-done-main`-Block geändert, Rest identisch):

```jsx
import React, { useState } from 'react'
import Icon from './Icon'

// Ehrlich statt beruhigend: der Merge trifft nicht jeden Namen. Wer das
// verschweigt, laesst den Nutzer eine Luecke fuer einen Datenfehler halten.
export default function ImportResultBanner({
  stats, method, marketMissing = false, onUndo, onClose, onGoToBoard,
  missingBye = 0, onFillBye, fillingBye = false,
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
              <button className="btn-link" onClick={() => setShowUnmatched((s) => !s)}>
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
        {missingBye > 0 && (
          <span className="import-done-warn">
            <Icon name="warning" size={13} /> {missingBye} Spieler ohne Bye Week
            {onFillBye && (
              <> · <button className="btn-link" onClick={onFillBye} disabled={fillingBye}>
                {fillingBye ? '…' : 'Jetzt ergänzen'}
              </button></>
            )}
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

- [ ] **Step 4: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/components/ImportResultBanner.test.jsx`
Expected: PASS (alle Tests der Datei).

- [ ] **Step 5: Failing Tests für `SetupPage` schreiben**

In `src/pages/SetupPage.test.jsx`, am Dateiende anfügen (nach dem letzten bestehenden `describe`-Block):

```js
describe('SetupPage: Bye-Week-Ergaenzung im CSV-Import-Banner', () => {
  it('zeigt die Bye-Week-Zeile, wenn der CSV-Import Luecken hat', async () => {
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setCsvRawText(
      'RK,PLAYER NAME,TEAM,POS,BYE WEEK\n1,Test Player,ATL,RB,\n2,Other Player,KC,WR,7'
    )
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers.length).toBe(2))
    expect(screen.getByText(/1 Spieler ohne Bye Week/)).toBeTruthy()
  })

  it('Jetzt ergaenzen ruft fillMissingBye und aktualisiert die Zaehlung', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ffc-adp': FFC }))
    const { useBoardStore } = await import('../stores/useBoardStore')
    useBoardStore.getState().setCsvRawText('RK,PLAYER NAME,TEAM,POS,BYE WEEK\n1,Bijan Robinson,ATL,RB,')
    await setup()
    await userEvent.click(screen.getByRole('button', { name: 'DoCsvLoad' }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers.length).toBe(1))
    await userEvent.click(screen.getByRole('button', { name: /Jetzt ergänzen/ }))
    await waitFor(() => expect(useBoardStore.getState().boardPlayers[0].bye).toBe(11))
    expect(screen.queryByText(/ohne Bye Week/)).toBeNull()
  })
})
```

- [ ] **Step 6: Tests laufen lassen — müssen fehlschlagen**

Run: `npx vitest run src/pages/SetupPage.test.jsx`
Expected: FAIL — `missingBye` wird noch nicht berechnet/angezeigt, `fillMissingBye` wird nicht aufgerufen.

- [ ] **Step 7: `SetupPage.jsx` anpassen**

Zeilen 50-54 (Store-Destructuring) ersetzen:

```js
  const {
    csvRawText, draftMode,
    setCsvRawText, setDraftMode, setBoardSource,
    handleCsvLoad, handleAutoImport, handleKtcRookieImport, handleFantasyProsImport, undoImport,
    fillMissingBye,
  } = useBoardStore()
```

Direkt nach dem `useBoardStore()`-Destructuring-Block (nach der schließenden `} = useBoardStore()`-Zeile, vor der `useEffect`-Deklaration) eine neue Zeile einfügen:

```js
  const [fillingBye, setFillingBye] = useState(false)
```

(`useState` ist bereits importiert — Zeile 1 lautet bereits `import { useEffect, useState } from 'react'`, keine Import-Änderung nötig.)

`wrappedCsvLoad` (aktuell Zeilen 81-94) ersetzen:

```js
  async function wrappedCsvLoad() {
    const ok = await handleCsvLoad()
    if (ok) {
      // handleCsvLoad selbst ist tabu (bleibt wie es ist) — die Herkunft wird hier vom
      // Aufrufer gesetzt, und zwar nur bei tatsaechlichem Erfolg. Tippen im Setup-Feld
      // oder ein abgebrochener Overwrite-Dialog aendern boardSource dadurch nicht.
      setBoardSource('csv')
      const players = useBoardStore.getState().boardPlayers
      const missingBye = players.filter((p) => !p.bye).length
      // handleCsvLoad setzt bewusst keinen lastBoardSnapshot (manueller Import
      // bleibt unveraendert, sichert sich stattdessen ueber window.confirm ab)
      // — also darf dieses Banner kein Undo anbieten.
      setImportDone({ method: 'CSV', stats: { ...statsForCount(players.length), missingBye }, canUndo: false })
    }
  }

  async function handleFillBye() {
    setFillingBye(true)
    const fmt = deriveFormat({ draft: selectedDraft, league: selectedLeague, overrides: loadSetup()?.overrides || {} })
    const res = await fillMissingBye({
      isSuperflex: fmt.isSuperflex,
      effScoringType: fmt.scoringType,
      numTeams: fmt.teams,
    })
    if (res.ok) {
      const players = useBoardStore.getState().boardPlayers
      const missingBye = players.filter((p) => !p.bye).length
      setImportDone((prev) => (prev ? { ...prev, stats: { ...prev.stats, missingBye } } : prev))
    }
    setFillingBye(false)
  }
```

`<ImportResultBanner ... />` (aktuell Zeilen 174-181) ersetzen:

```jsx
        <ImportResultBanner
          stats={importDone.stats}
          method={importDone.method}
          marketMissing={importDone.marketMissing}
          missingBye={importDone.stats?.missingBye || 0}
          onFillBye={importDone.method === 'CSV' ? handleFillBye : undefined}
          fillingBye={fillingBye}
          onUndo={canOfferUndo(importDone, useBoardStore.getState().lastBoardSnapshot) ? () => { undoImport(); setImportDone(null) } : undefined}
          onClose={() => setImportDone(null)}
          onGoToBoard={() => navigate('/board')}
        />
```

- [ ] **Step 8: Tests laufen lassen — müssen bestehen**

Run: `npx vitest run src/pages/SetupPage.test.jsx`
Expected: PASS (alle Tests der Datei, inkl. der bestehenden `'setzt boardSource auf "csv"...'` und `'ImportResultBanner-Wiring (Minor 7)'`-Blöcke).

- [ ] **Step 9: Commit**

```bash
git add src/components/ImportResultBanner.jsx src/components/ImportResultBanner.test.jsx src/pages/SetupPage.jsx src/pages/SetupPage.test.jsx
git commit -m "feat(setup): Bye-Week-Luecken nach CSV-Import erkennen und auf Wunsch ergaenzen"
```

---

### Task 6: Vollständige Regression + graphify update

**Files:** keine Code-Änderungen, nur Verifikation.

- [ ] **Step 1: Vollständige Testsuite laufen lassen**

Run: `npm test`
Expected: PASS — alle Tests im Projekt, inkl. aller in Task 1-5 geänderten/neuen Dateien.

- [ ] **Step 2: graphify aktualisieren**

Run: `graphify update .`
Expected: Läuft ohne Fehler durch (AST-only, kein API-Call — Projekt-Konvention aus CLAUDE.md).

- [ ] **Step 3: Manueller Smoke-Test im Dev-Server (optional, falls Browser-Preview verfügbar)**

Run: `npm run dev:all`
Im Browser: CSV mit fehlender Bye Week importieren → Banner zeigt "X Spieler ohne Bye Week" → "Jetzt ergänzen" klicken → Zeile verschwindet, Board zeigt Bye Weeks. Dann zum Board navigieren → "ADP übernehmen" klicken → Δ-ADP-Spalte aktualisiert sich, Provenance-Zeile zeigt Sleeper/FFC als ADP-Quelle.

- [ ] **Step 4: Commit (nur falls graphify-Artefakte sich geändert haben)**

```bash
git add graphify-out/
git commit -m "chore(graphify): Graph nach ADP/Bye-Feature aktualisieren"
```
