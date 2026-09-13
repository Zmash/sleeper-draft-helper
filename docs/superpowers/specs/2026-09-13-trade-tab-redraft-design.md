# Design-Spec — Trade-Tab: Redraft-Unterstützung

**Projekt:** Sleeper Draft Helper (React 18 + Vite)
**Datum:** 2026-09-13
**Status:** Freigegeben
**Vorarbeit:** Code-Audit des Trade-Tabs (`TradePage.jsx`, `TradeAnalyzer.jsx`, `tradeValue.js`,
`aiTrade.js`), Web-Recherche zu FantasyCalc/KeepTradeCut/RotoTrade/Draft Sharks (Redraft- vs.
Dynasty-Trade-Bewertung), Abgleich mit bereits vorhandenem, unfertigem Spec
`2026-07-17-ai-mehrwert-design.md` (Teil G „Trade-Hygiene", Worktree `ai-review`) zur
Vermeidung von Doppelarbeit.
**Vorgänger:** `2026-07-16-redraft-flow-design.md` (Board/Markt-Redraft-Flow — hat den
`isDynasty`-Serverparameter an `/api/rankings/fantasycalc` gebracht, den dieser Spec erstmals
für den Trade-Tab nutzt)

---

## 1. Ziel & Nicht-Ziele

**Ziel:** Der Trade-Tab ist heute vollständig dynasty-verdrahtet — er lädt immer FantasyCalc-
**Dynasty**-Werte, erzeugt pro Manager automatisch über Jahre handelbare Draft-Picks, und
gewichtet Trades über eine altersbasierte Contender/Balanced/Rebuild-Achse. Für eine
Redraft-Liga (Sleeper `settings.type === 0`, keine Roster-Persistenz über die Saison hinaus)
ergeben diese drei Dinge keinen Sinn und liefern falsche Werte. Ziel dieses Umbaus: der
Trade-Tab erkennt den Liga-Typ und zeigt in jedem Modus die richtige Sorte Wert — **ohne den
bestehenden Dynasty-Pfad in irgendeiner Weise zu verändern oder zu verschlechtern.**

**Recherche-Befund (grosse Redraft-Trade-Tools):** FantasyCalc, KeepTradeCut, RotoTrade und
Draft Sharks unterscheiden Redraft- von Dynasty-Werten dadurch, dass Redraft-Werte **nur die
laufende Saison** abbilden (aktuelle Rolle/Produktion/Snap-Share), **ohne Alters-Malus** —
ein Rebuild-Konzept ergibt keinen Sinn, wenn es keine Zukunft gibt, in die investiert wird.

**Nicht-Ziele (bewusst ausgeschlossen):**
- **Keine vollständige Englisch→Deutsch-Übersetzung von `TradeAnalyzer.jsx`.** Dafür existiert
  bereits ein fertiger, noch nicht umgesetzter Spec (`2026-07-17-ai-mehrwert-design.md`, Teil G
  „Trade-Hygiene", Worktree `.claude/worktrees/ai-review`, Branch `worktree-ai-review`). Das hier
  mit reinzuziehen würde diese bereits geplante Arbeit duplizieren und Merge-Konflikte
  provozieren. Neue, in diesem Umbau geschriebene Strings sind Deutsch (Projektregel); bereits
  vorhandene englische Strings, die nicht angefasst werden müssen, bleiben unangetastet.
- **Keine Validierung der KI-Badge-Zahlen** (`value_you_give/get` aus dem Modell statt
  eigener Neuberechnung) — ebenfalls Teil G, eigener Scope.
- **Kein Fix des Englisch-Leerzustands** ("No League Selected") — vorbestehend, separat getrackt.
- **Keine Playoff-Tabellenstand-basierte Profil-Achse für Redraft.** Stattdessen entfällt die
  Profil-Zeile bei Redraft komplett — deckt sich mit der Praxis von FantasyPros/ESPN
  (reiner Wertevergleich ohne Team-Kontext-Achse bei Redraft-Trades).
- **Keine Änderung am Dynasty-/Keeper-Pfad.** `isDynastyMode` folgt exakt der bestehenden
  `resolveDraftMode`-Konvention (`draftFormat.js`): `type 1`/`2` → wie Dynasty, `type 0` →
  Redraft. Kein neuer Sonderfall, keine App-weite Inkonsistenz.
- **Kein Teilprojekt C (Live-Draft-Intelligenz)** — unabhängig von diesem Thema.

---

## 2. Ausgangslage — verifizierte Befunde

| # | Befund | Beleg |
|---|---|---|
| T1 | FantasyCalc-Fetch im Trade-Tab setzt nie `isDynasty` → Server-Default `true` greift immer, auch in Redraft-Ligen. Der Server-Parameter existiert bereits (aus dem Board-Redraft-Flow). | `TradePage.jsx:247`; `apiRoutes.js:578` |
| T2 | `buildManagerRosters` generiert für **jeden** Manager unbedingt Picks über die aktuelle und nächste Saison (inkl. Sleeper-Calls für `fetchTradedPicks`/`fetchDraft`/`fetchDraftPicks`) — auch wenn die Liga pure Redraft ist und diese Picks nie real handelbar sind. | `TradePage.jsx:130–196, 286–303` |
| T3 | `evaluateTrade` wendet immer einen altersbasierten Contender/Balanced/Rebuild-Modifikator an (`ageModifier`/`pickModifier`), unabhängig vom Liga-Typ. | `tradeValue.js:66–89` |
| T4 | `aiTrade.js`s `deriveLeagueContext` labelt `type === 2` als `'dynasty'`, alles andere (inkl. `type === 1`, Keeper) als `'redraft'` — widerspricht der App-weiten `resolveDraftMode`-Konvention (`type 1`/`2` → dynasty-artig) und würde nach diesem Umbau der KI ein falsches Format zeigen, während die Werte selbst (Entscheidung unten) für Keeper weiter Dynasty-Werte sind. | `aiTrade.js:7–15`; vgl. `draftFormat.js:117–133` |
| T5 | Der 24h-FantasyCalc-Cache (`sdh-fc-dynasty-v1`) schlüsselt nur nach `numQbs`, nicht nach `isDynasty` — ein Liga-Wechsel Redraft↔Dynasty würde nach diesem Umbau die falsche gecachte Antwort ausliefern. | `TradePage.jsx:16–36` |
| T6 | `TradeAnalyzer.jsx` hat keinen Mechanismus, Picks-UI (`+ Pick`-Button, `AvailablePicks`-Leiste) oder die Profil-Zeile bedingt auszublenden — beides ist heute unbedingt gerendert. | `TradeAnalyzer.jsx:276–299, 732–749` |

---

## 3. Verbindliche Entscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Modus-Erkennung | `resolveDraftMode({ league })` aus `draftFormat.js`, lokal in `TradePage.jsx` ausgewertet zu `isDynastyMode = resolveDraftMode({ league }) !== 'redraft'` | Bestehende, App-weite Konvention; kein neuer Sonderfall; `type 1`/`2` (Keeper/Dynasty) bleiben wie heute |
| Wertequelle Redraft | FantasyCalc `isDynasty=false` (Server-Endpoint existiert bereits) | Einzige im Projekt bereits integrierte Quelle mit sauberer Redraft/Dynasty-Trennung; kein neuer Server-Code nötig |
| Picks bei Redraft | Komplett ausgeblendet (kein `+ Pick`, keine `AvailablePicks`-Leiste, `buildManagerRosters` erzeugt kein Picks-Array, keine Sleeper-Calls für Picks/Draft-Order) | Pure Redraft hat keine über die Saison hinaus persistenten, handelbaren Picks |
| Team-Profil bei Redraft | Zeile entfällt komplett, `adjusted_value === dynasty_value` (Modifikator 1.0) | Deckt sich mit FantasyPros/ESPN-Praxis; kein Rebuild-Konzept ohne Zukunft |
| Team-Profil bei Dynasty/Keeper | **Unverändert** — Alters-Modifikator, Contender/Balanced/Rebuild-Auswahl bleibt exakt wie heute | Nicht-Ziel: Dynasty-Pfad darf sich nicht ändern |
| KI-Format-Label | `deriveLeagueContext` korrigiert auf `type === 0 ? 'redraft' : 'dynasty'` | Muss mit der tatsächlichen Wertequelle übereinstimmen (Keeper nutzt Dynasty-Werte) |
| Cache-Schlüssel | `FC_CACHE_KEY`-Eintrag bekommt `isDynasty` als zusätzliches Feld im gespeicherten Objekt, Cache-Treffer nur bei Übereinstimmung | Verhindert falsch gecachte Werte bei Liga-Wechsel Redraft↔Dynasty |
| Sichtbarkeit | Kleiner Modus-Hinweis im Trade-Header („Redraft-Werte" / „Dynasty-Werte") | Sichtbarkeit schlägt Magie (gleiche Leitlinie wie die Board-Herkunftszeile) |
| Sprache neuer Strings | Deutsch (Modus-Hinweis, angepasste Lade-/Fehlertexte) | Projektregel (CLAUDE.md); unberührte Alt-Strings bleiben bewusst Englisch (Teil G) |

---

## 4. Architektur

### 4.1 `src/pages/TradePage.jsx`

- Neue lokale Ableitung: `const isDynastyMode = resolveDraftMode({ league }) !== 'redraft'`
  (Import aus `../services/draftFormat`).
- FantasyCalc-Fetch: `fetch('/api/rankings/fantasycalc?numQbs=...&numTeams=...&ppr=...&isDynasty=' + isDynastyMode)`.
- `FC_CACHE_KEY`-Payload (`loadFcCache`/`saveFcCache`) bekommt ein zusätzliches Feld `dyn`
  (bool); ein Cache-Treffer erfordert `nq === numQbs && dyn === isDynastyMode`.
- Der `useEffect`, der den Fetch auslöst, bekommt `isDynastyMode` in die Dependency-Liste
  (heute nur `[isSuperflex]`), damit ein Liga-Wechsel Redraft↔Dynasty tatsächlich neu lädt.
- `buildManagerRosters(...)` bekommt ein neues Options-Feld `{ ..., isDynastyMode }`. Bei
  `isDynastyMode === false`:
  - Der komplette Picks-Aufbau (aktuelle Saison, `tradedToHere`, nächste Saison) entfällt —
    Funktion liefert `picks: []` pro Roster.
  - Der `loadLeagueRosters`-Callback überspringt bei Redraft die Aufrufe von
    `fetchTradedPicks`/`fetchDraft`/`fetchDraftPicks` (heute unbedingt bei vorhandenem
    `upcomingDraft.draft_id` ausgeführt) — spart unnötige Sleeper-Calls, da das Ergebnis ohnehin
    verworfen würde.
- Modus-Hinweis im `trade-page-header`: ein `<span>` neben dem Liga-Namen,
  „Redraft-Werte" bzw. „Dynasty-Werte" (Deutsch, neuer String).
- `isDynastyMode` wird als neue Prop an `TradeAnalyzer` durchgereicht.

### 4.2 `src/services/tradeValue.js`

- `evaluateTrade(sideGive, sideGet, { dynastyRoster, profileOverride, isDynastyMode = true } = {})`:
  - Bei `isDynastyMode === false`: `profile = null`, `applyModifier` wird durch eine Identitäts-
    Abbildung ersetzt (`adjusted_value = dynasty_value`, `modifier = 1`) — kein Aufruf von
    `detectTeamProfile`/`ageModifier`/`pickModifier`.
  - Bei `isDynastyMode === true` (Default, deckt bestehende Aufrufer ohne Änderung ab):
    **exaktes bestehendes Verhalten**, keine Änderung an Berechnung oder Rückgabewert.
  - `avgAge` bleibt bei Redraft `null` (kein `dynastyRoster`-Alters-Kontext gewünscht).
- `pickDynastyValue`, `buildTradeablePlayers`, `stripSuffix`, `detectTeamProfile`: unverändert.

### 4.3 `src/components/TradeAnalyzer.jsx`

- Neue Prop `isDynastyMode` (Default `true`, damit ein vergessener Call-Site weiterhin wie
  heute funktioniert).
- `evaluateTrade(...)`-Aufruf bekommt `isDynastyMode` durchgereicht.
- `TradeSide`: neue Prop `isDynastyMode`. `+ Pick`-Button und `AvailablePicks`-Leiste werden nur
  gerendert, wenn `isDynastyMode === true` (zusätzlich zur bestehenden `!managerRoster`-Bedingung
  für den manuellen `PickForm`-Weg).
- Team-Profil-Block (`.trade-profile-row`): nur gerendert, wenn `isDynastyMode === true`.
- Lade-/Fehlertexte für die Werte (`"Loading dynasty values…"` / `"Failed to load dynasty
  values."`): werden durch eine mode-neutrale, deutsche Formulierung ersetzt (z. B. „Werte werden
  geladen…" / „Werte konnten nicht geladen werden."), da ich diese Zeilen ohnehin anfasse.
  Restliche, unberührte englische Strings bleiben unverändert (Nicht-Ziel).

### 4.4 `src/services/aiTrade.js`

- `deriveLeagueContext`: `const format = leagueType === 0 ? 'redraft' : 'dynasty'` (statt
  `leagueType === 2 ? 'dynasty' : 'redraft'`) — Keeper (`type === 1`) zählt jetzt korrekt als
  `'dynasty'`, konsistent mit `resolveDraftMode` und der tatsächlichen Wertequelle.
- `buildTradeAnalysisRequest`/`buildTradeSuggestionsRequest`: `instruction`-Text und
  `value_scale_note` verzweigen auf `format`:
  - Redraft: `value_scale_note: 'market_value auf 0–10000-Skala (FantasyCalc, Redraft/aktuelle
    Saison).'`, `instruction` ohne den Picks-Satz und ohne „Beziehe das Team-Profil ein".
  - Dynasty: **unverändert** (heutiger Text, nur ggf. `dynasty_value` statt `market_value`
    beibehalten).
  - Spiegelt den bereits vorhandenen `dynasty_value`→`market_value`-Kniff, der laut
    `project_next_steps`-Memory beim Board für dasselbe Problem gemacht wurde.
- `profile_note` in `buildTradeAnalysisRequest`: bei Redraft (`profile === null`) entfällt der
  ganze Profil-Block im Kontext-Objekt statt eines leeren/falschen Werts.

---

## 5. Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| FantasyCalc-Fetch mit `isDynasty=false` schlägt fehl | Wie heute: `ktcLoading` false, `hasDynastyValues` false, bestehender Hinweis (jetzt mode-neutral formuliert) |
| Liga wechselt von Dynasty zu Redraft (oder umgekehrt) während die Seite offen ist | `useEffect`-Dependency auf `isDynastyMode` löst Neu-Fetch aus; Cache liefert wegen `dyn`-Feld keinen falschen Treffer |
| Keeper-Liga (`type === 1`) | Verhält sich exakt wie Dynasty (Picks, Profil, Werte, KI-Label) — keine Sonderbehandlung |
| Liga-Typ nicht ermittelbar (`league` noch `null`, z. B. Ladezustand) | `resolveDraftMode` fällt auf `current` zurück (Default-Parameter `'redraft'` in `resolveDraftMode`) — **Achtung:** das bedeutet einen kurzen Moment „Redraft-Ansicht" beim ersten Rendern, bevor `league` geladen ist, auch für eine Dynasty-Liga. Das ist bereits heute so für andere `resolveDraftMode`-Konsumenten in der App und kein neues Risiko; UI flackert höchstens kurz (Picks-Leiste erscheint verzögert), keine falschen Werte werden persistiert. |

---

## 6. Tests

| Datei | Testfälle |
|---|---|
| `tradeValue.test.js` (neu) | `evaluateTrade` mit `isDynastyMode:false`: `adjusted_value === dynasty_value` für alle Items, `modifier === 1`, `profile === null`; Verdict-Schwellen greifen weiterhin auf Rohsummen. `evaluateTrade` mit `isDynastyMode:true` (oder ohne den Parameter): **bestehendes Verhalten unverändert** (Regressionstest — Modifikator, Profil-Erkennung, Verdict identisch zu vorher). |
| `aiTrade.test.js` (Ergänzung) | `deriveLeagueContext`: `type 0` → `'redraft'`; `type 1` (Keeper) → `'dynasty'`; `type 2` → `'dynasty'`; fehlendes `settings.type` → Fallback wie bisher. `buildTradeAnalysisRequest`/`buildTradeSuggestionsRequest` im Redraft-Fall ohne Picks-/Profil-Sätze im Prompt. |

Manuelle Verifikation (`npm run dev:all`) gegen eine echte Redraft-Liga UND eine echte
Dynasty-Liga von Dario — insbesondere: Redraft zeigt plausible (nicht Dynasty-Skala) Werte,
keine Picks-UI; Dynasty-Ansicht ist Pixel-für-Pixel wie vor dem Umbau. Wird Teil der Umsetzung,
nicht vorher als erfolgt behauptet.

---

## 7. Umsetzungsreihenfolge (Vorgriff auf den Plan)

1. **Fundament:** `evaluateTrade`-Erweiterung in `tradeValue.js` + `tradeValue.test.js`. Reine
   Funktion, kein UI-Risiko, blockiert nichts anderes.
2. **Parallel danach:**
   - `deriveLeagueContext`-Fix + Format-Verzweigung in `aiTrade.js` + Test-Ergänzung.
   - `TradePage.jsx`: Modus-Erkennung, FantasyCalc-`isDynasty`-Param, Cache-Key-Fix,
     Picks-Gating in `buildManagerRosters` + `loadLeagueRosters`.
3. **Zuletzt (braucht 1+2):** `TradeAnalyzer.jsx` — `isDynastyMode`-Prop durchreichen,
   Picks-UI und Profil-Zeile bedingt rendern, Lade-/Fehlertexte anpassen, Modus-Hinweis im
   Header.
4. **Abschluss:** manuelle Verifikation gegen echte Dynasty- UND Redraft-Liga.
