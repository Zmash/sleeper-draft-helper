# Design-Spec — Redraft-Flow: Marktdaten, Mock-Workflow, Transparenz

**Projekt:** Sleeper Draft Helper (React 18 + Vite)
**Datum:** 2026-07-16
**Status:** Entwurf zur Freigabe
**Vorarbeit:** Brainstorming-Session (Code-Audit des Redraft-Pfads, API-Verifikation von
FantasyCalc / FantasyPros / Sleeper / Fantasy Football Calculator), UX-Gegencheck mit
`ui-ux-pro-max` als Prüfraster.
**Vorgänger:** `2026-07-15-broadcast-redesign-design.md` (Designsystem — hier verbindlich)

---

## 1. Ziel & Nicht-Ziele

**Ziel:** Den Redraft-Pfad auf das Niveau bringen, das der Rookie-/Dynasty-Pfad nach der letzten
Runde hat. Drei Dinge: **(a)** das Board bekommt echte Marktdaten (ADP, Bye, K/DEF), damit die
vorhandene Tipplogik überhaupt feuern kann; **(b)** der Mock-Draft wird zum erstklassigen Einstieg
statt zur versteckten „Alternative"; **(c)** die App legt offen, woher ihre Zahlen kommen und wie alt
sie sind.

**Szene (Design-Anker):** Der Nutzer macht über drei Wochen zehn Sleeper-Mocks zur Vorbereitung,
pflegt zwischendurch seine eigene Rangliste per Drag-and-Drop, und will bei jedem Mock aktuellen
Markt sehen, ohne seine Arbeit zu verlieren. Am Draft-Abend zählt dann, dass er in Sekunden weiß:
wer ist da, was ist Value, wer überlebt bis zu meinem nächsten Pick.

**Nicht-Ziele (bewusst ausgeschlossen, kommen ggf. in Folge-Specs):**
- Kein Snake-Grid, keine Pick-Queue, keine Run-Erkennung („5 der letzten 8 Picks waren RB").
  Das ist Teilprojekt **C (Live-Draft-Intelligenz)** und baut auf dieser Datenschicht auf.
- Kein Auktions-Budget-Tracking (Auction bleibt wählbar, bleibt aber unversorgt wie heute).
- Keine Änderung am **manuellen CSV-Import**. Der bleibt exakt wie er ist — Nutzer-Vorgabe,
  der Pfad ist ihm wichtig.
- Keine Änderung am Rookie-/Dynasty-Pfad. `isDynasty` bekommt einen Default, der ihn unberührt lässt.
- Kein Draft-ID-Deep-Link (siehe `project_next_steps` — eigenes Risiko, eigene Task).

---

## 2. Ausgangslage — verifizierte Befunde

Alle folgenden Punkte wurden im Code bzw. gegen die Live-APIs geprüft, nicht vermutet.

| # | Befund | Beleg |
|---|---|---|
| B1 | Auto-Import liefert im Redraft-Modus **Dynasty-Werte**. `isDynasty=true` ist hartkodiert. | `src/server/index.js:131`, `src/server/prod.js` (Duplikat) |
| B2 | **Kein ADP aus irgendeiner Server-Quelle** — alle drei setzen `adp: null`. Damit ist der Value-Tip-Block tot, sobald nicht per CSV importiert wurde. | `index.js:148,199,249`; `useDraftTips.js:86–104` |
| B3 | Bei **Mock ohne Liga** werden Scoring/Superflex/Teams ignoriert — beide Stellen lesen nur `selectedLeague`. Ergebnis: immer 1QB / PPR / 12 Teams. | `SetupPage.jsx:64–69`, `App.jsx:123` |
| B4 | `adp_ppr`, `adp`, `bye_week` in `playersMeta` sind **tote Felder** — Sleeper liefert für 0 von 3221 aktiven Spielern Werte. `search_rank` existiert, ist aber positionsbezogen (Josh Allen=1, Bijan=1), also kein ADP. | `playersMeta.js:16–18`; Live-Abruf `/v1/players/nfl` |
| B5 | Redraft-Tips sind **komplett englisch**, Rookie-Tips deutsch. Bye-Cluster ist im Kommentar angekündigt, aber nie implementiert. `pos_need` feuert ab Pick 1 für jede unvolle Position. | `useDraftTips.js:64–177` vs. `useRookieDraftTips.js:55–187` |
| B6 | `draftMode` wird nur aus `league_type` abgeleitet. Ein Mock hat keine Liga → **der Modus bleibt still auf dem alten Wert stehen**. Nach einem Rookie-Draft läuft der Redraft-Mock mit der Rookie-Tipplogik. | `App.jsx:275–279` |
| B7 | Wizard-Schritt 4 („Fertig") ruft `window.scrollTo({top:0})` — das Setup hat **keinen Ausgang zum Board**. | `SetupForm.jsx:570` |
| B8 | Add-Modus löscht das Board mit (`setBoardPlayers([])`). | `SetupPage.jsx:37–50` |
| B9 | `alert()` / `window.confirm()` im gesamten Setup-Pfad, englisch, ohne Lösungsweg, am Designsystem vorbei. Überschreiben ist destruktiv ohne Undo. | `SetupForm.jsx:130,147,223`; `useBoardStore.js:30–32,46–48,69–71` |

### Verifizierte Datenquellen (Stand 2026-07-16)

| Quelle | Liefert | Liefert **nicht** |
|---|---|---|
| **FantasyCalc** `isDynasty=false` | 200 Spieler, `value`, `overallRank`, `maybeTier`, **`sleeperId`** | ADP (`maybeAdp` ist bei allen 200 null, auch mit `includeAdp=true`), K, DEF |
| **Fantasy Football Calculator** `/api/v1/adp/{ppr,half-ppr,standard,2qb}` | 207 Spieler (PPR), **ADP für alle**, **Bye für alle**, `stdev`/`high`/`low`/`times_drafted`, **K (PK) + DEF**, Meta mit `total_drafts` + Zeitfenster | `sleeperId` (eigene `player_id`), Dynasty/Rookie (liefert 0 Spieler) |
| FantasyPros ADP-Seite | — | Nicht scrapebar: rendert nur 5 Zeilen server-seitig, Rest per JS |
| Sleeper `/v1/players/nfl` | `injury_status` (142), `years_exp`, `search_rank` | ADP, Bye (0 von 3221) |

**Daraus die Kernentscheidung:** Ein Board braucht **zwei Meinungen**. Eine nach ADP sortierte Liste
kann per Konstruktion keinen Value zeigen (Δ wäre immer 0). Der Value-Tip lebt davon, dass eine
*Rangliste* (wen sollte man nehmen) gegen einen *Markt* (wen nehmen die anderen) läuft.
→ **Rang + Tier von FantasyCalc, Markt von FFC.**

---

## 3. Verbindliche Entscheidungen

| Thema | Entscheidung | Begründung |
|---|---|---|
| Redraft-Ranking | FantasyCalc `isDynasty=false` | einzige freie Redraft-Wertquelle mit Tier + `sleeperId` |
| Redraft-Markt | Fantasy Football Calculator | einzige freie ADP-Quelle mit Bye + K/DEF + Streuung |
| Merge-Art | **Union**, nicht Left-Join | FantasyCalc kennt weder K noch DEF; im 16-Runden-Redraft draftet man beide |
| Merge-Schlüssel | `normalizePlayerName` | dieselbe Funktion, mit der die App heute Live-Picks auf Spieler matcht — kein neues Risiko |
| CSV-Import | **unverändert** | Nutzer-Vorgabe |
| Rookie-/Dynasty-Pfad | **unberührt** (`isDynasty` default `true`) | FFC liefert für Dynasty/Rookie nichts; KTC bleibt |
| Format-Quelle | `selectedDraft.settings` zuerst, `selectedLeague` als Fallback | Mocks haben keine Liga |
| Aktualisierung | zwei getrennte Aktionen: Markt-Refresh (nicht-destruktiv) vs. Neu-Import (destruktiv, mit Undo) | Nutzer pflegt sein Board über Wochen |
| Δ-Spalte | **genau eine**, quellenunabhängig | zwei Delta-Spalten würden sich widersprechen |
| Mock-Einstieg | Dashboard, nicht Setup | Mock ist der Normalfall, nicht die „Alternative" |
| Designsystem | `2026-07-15-broadcast-redesign-design.md` gilt unverändert | Role-Tokens, Icon-Komponente, kein Emoji, keine Side-Stripes |

---

## 4. Architektur

### 4.1 Server (`src/server/index.js` **und** `src/server/prod.js` — Duplikat-Pflicht!)

**Neu:** `GET /api/rankings/ffc-adp?format=ppr|half-ppr|standard|2qb`

- Proxyt `https://fantasyfootballcalculator.com/api/v1/adp/{format}?teams={n}&year={season}`.
- `format` wird gegen eine Whitelist geprüft (kein Pfad-Durchreichen aus der Query).
- Antwort normalisiert auf Board-Form:
  ```
  { ok: true,
    meta: { source: 'ffc', format, total_drafts, start_date, end_date, fetched_at },
    players: [{ name, nname, pos, team, adp, adp_formatted, bye, stdev, high, low, times_drafted }] }
  ```
- `pos`: FFC nutzt `PK` → auf `K` normalisieren, `DEF` bleibt.
- `meta` ist **nicht optional** — die Herkunfts-Zeile (§5.3) lebt davon.
- Fehler: `502` mit `{ ok:false, error }`, wie die bestehenden Rankings-Endpoints.

**Geändert:** `GET /api/rankings/fantasycalc`

- Neuer Query-Param `isDynasty` (`'false'` → false, alles andere → **true**). Default-true hält den
  Rookie-Pfad unberührt.
- `sleeperId` und `maybeTier` werden mit durchgereicht (heute verworfen).
- `meta` analog ergänzen (`source: 'fantasycalc'`, `isDynasty`, `fetched_at`).

### 4.2 Merge (`src/services/marketMerge.js` — neu)

Reine Funktion, ohne Store- und Netz-Abhängigkeit, damit sie testbar ist:

```
mergeRankingsWithMarket(fcPlayers, ffcPlayers) -> { players, stats }
```

- Basis: FantasyCalc-Spieler in `overallRank`-Reihenfolge → `rk = 1..n`, `tier`, `sleeperId`.
- Overlay per `nname`: `adp`, `bye`, `stdev`, `high`, `low` aus FFC.
- **Union:** FFC-Spieler ohne FantasyCalc-Match (K, DEF, tiefe Namen) werden nach ADP sortiert
  hinten angehängt und bekommen fortlaufende `rk` weiter.
- `stats = { total, withAdp, withoutAdp, unmatchedNames }` → speist Banner (§5.4).
- Kein Match ist **kein Fehler**: Spieler ohne ADP bleiben im Board, `adp === null`.

### 4.3 Store (`src/stores/useBoardStore.js`)

- `handleAutoImport` bekommt einen Redraft-Zweig: beide Quellen parallel (`Promise.all`), dann
  `mergeRankingsWithMarket`. Der Rookie-Zweig bleibt wie er ist.
- **Neu:** `refreshMarketData()` — holt nur FFC und legt `adp`/`bye`/`stdev`/`high`/`low` per `nname`
  über das bestehende `boardPlayers`. Fasst `rk` **nicht** an. Kein Confirm, keine Rückfrage.
- **Neu:** `marketMeta` (persistiert) — `{ source, format, total_drafts, end_date, fetched_at }`.
  Quelle der Wahrheit für die Herkunfts-Zeile.
- **Neu:** `lastBoardSnapshot` (**nicht** persistiert, in-memory) — das `boardPlayers` vor dem letzten
  destruktiven Import, plus `undoImport()`. Ein Level reicht.
- `partialize` um `marketMeta` erweitern; `lastBoardSnapshot` explizit **nicht**.

### 4.4 Format-Ableitung (`src/services/draftFormat.js` — neu)

Heute steht dieselbe `slots_*`-Mapping-Logik **dreimal** im Code (`App.jsx:102`,
`SetupForm.jsx:12`, `BoardSection.jsx:81`). Diese Spec fasst sie zu einer Funktion zusammen und
repariert dabei B3 an einer Stelle statt an dreien:

```
deriveFormat({ draft, league, overrides }) -> { rosterPositions, scoringType, isSuperflex, teams, rounds, type, source }
```

- Reihenfolge: `overrides` → `draft.settings` / `draft.metadata.scoring_type` → `league` → Defaults.
- `source` (`'override' | 'draft' | 'league' | 'default'`) wird angezeigt, nicht nur intern genutzt.
- Konsumenten: `App.jsx` (`effRoster`, `effScoringType`, `isSuperflex`), `SetupForm` (`detected`),
  `BoardSection` (`rosterPositions`), `SetupPage` (`wrappedAutoImport`).

Das ist bewusst enthalten und keine Refactoring-Ausweitung: B3 ist genau der Bug, der entsteht,
wenn dieselbe Regel an drei Orten leicht unterschiedlich implementiert ist.

### 4.5 draftMode bei Mocks (B6)

- `App.jsx`: Draft **ohne** Liga (`selectedDraft && !selectedLeague`) → `draftMode = 'redraft'`.
- Zusätzlich wird der aktive Modus in der Herkunfts-Zeile angezeigt → ein falscher Modus ist
  **sichtbar** statt still. Sichtbarkeit schlägt Magie.

---

## 5. UX

### 5.1 Mock-Start auf dem Dashboard

Eine neue Karte im `dashboard-grid`, gleichrangig zu „Draft/Liga hinzufügen":
**„Mock-Draft per Sleeper-Link starten"** — ein Eingabefeld, ein Button.

- Einfügen → `parseDraftId` → `attachDraftByIdOrUrl` → `setSelectedDraftId` → `navigate('/board')`.
  Ein Einfügen, ein Klick, statt der heutigen sechs bis sieben Interaktionen.
- **Rührt das Board nicht an.** Das ist der Unterschied zum Add-Modus (B8) und der Grund, warum
  dieser Weg nicht über `/setup` läuft: die gepflegte Rangliste überlebt jeden neuen Mock.
- Fehler inline unter dem Feld mit Lösungsweg („Kein Draft unter diesem Link gefunden — prüfe, ob
  der Link auf einen Sleeper-Draft zeigt"), kein `alert`.
- Der Wizard bleibt für die echte Liga; sein Attach-Collapse bleibt bestehen (kein Bruch für
  vorhandene Gewohnheiten), verliert aber seine Rolle als einziger Mock-Weg.

### 5.2 Wizard: vier Schritte → zwei

| Heute | Neu |
|---|---|
| 1 Liga & Draft | **1 Liga & Draft** (unverändert) |
| 2 Rankings importieren | **2 Rankings importieren** (Copy korrigiert, siehe §5.4) |
| 3 Draft-Format & Optionen | → eine Zeile: „Erkannt: 12 Teams · Snake · PPR · kein Superflex · **[Anpassen]**". Aufgeklappt = heutiger Schritt-3-Inhalt. Progressive Disclosure: Overrides sind der Ausnahmefall, seit das Format aus dem Draft kommt. |
| 4 Zusammenfassung (Sackgasse) | **gestrichen als Schritt.** Zusammenfassung wird dauerhafte Kopfzeile. „Fertig" → `/board` (B7). |

### 5.3 Herkunfts-Zeile über dem Board

Ein Element, das drei Fragen beantwortet, die heute niemand beantwortet — Herkunft, Alter, Modus:

> Rangliste **FantasyCalc** · ADP **Fantasy Football Calculator**, 2072 Mocks · Stand **vor 6 Tagen** · Modus **Redraft** · **[Aktualisieren]**

- Alter aus `marketMeta.end_date`, gleiche Formatierung wie `formatLastRefreshed` im Dashboard.
- Ab **> 7 Tagen** (FFC-Fensterbreite) wird der Hinweis hervorgehoben — die App sagt, wann es sich
  lohnt, statt den Nutzer raten zu lassen. Aktualisiert wird trotzdem **nur auf Klick**.
- `[Aktualisieren]` ruft `refreshMarketData()` → nicht-destruktiv, `rk` bleibt.
- Bei CSV-Board: „Rangliste & ADP aus CSV · <Dateiname>" ohne Aktualisieren-Button. Die Zeile lügt nie.
- Kein Board (Empty State) → Zeile wird nicht gerendert.
- Tokens/Icons nach Designsystem; das ist ein ruhiges Datenelement, kein Brand-Moment.

### 5.4 Ehrlicher Import + Undo

- Banner (`importDone` in `SetupPage`) wird konkret:
  **„207 Spieler · 195 mit ADP · 12 ohne Marktdaten [anzeigen] · [Rückgängig] · [→ Board]"**
- `[anzeigen]` listet die nicht gematchten Namen (aus `stats.unmatchedNames`) — der Nutzer sieht,
  *dass* und *wen* es trifft, statt es für einen Datenfehler zu halten.
- `[Rückgängig]` ruft `undoImport()` (§4.3). Nur sichtbar, wenn ein Snapshot existiert.
- Board-Spalte zeigt bei fehlendem ADP **„—"**, nicht leer: der Unterschied zwischen „kein Wert" und
  „Wert ist 0".
- Step-2-Copy im Redraft-Zweig wird ehrlich: heute steht dort „Holt **Dynasty**-Rankings automatisch"
  — im Redraft-Zweig. Neu: „Rangliste von FantasyCalc, ADP & Byes von Fantasy Football Calculator."

### 5.5 Eine Δ-Spalte (`BoardTable`)

- Vorhandenes `hasEcrVsAdp` wird zu `hasAdp`-Logik verallgemeinert; die Spalte heißt **„Δ ADP"** und
  wird **quellenunabhängig** gerechnet: **`adp - rk`**. **Positiv = fällt dir zu (Value)**, negativ =
  wird vor seinem Rang gezogen.
  Diese Richtung ist **nicht frei wählbar**: die CSV-Spalte rechnet heute `adp = ecr + ecrVsAdp`
  (`csv.js:56`), also ist `ecrVsAdp = adp - rk`; und `useDraftTips.js:89` nutzt `delta = adp - rk`
  mit `delta >= 6` als Value-Schwelle. Die neue Spalte muss dieselbe Konvention haben, sonst
  widersprechen sich Spalte und Tip beim selben Spieler.
- Neue Spalte **„ADP"** (bedingt, gleiches `has…`-Muster wie `hasBye`/`hasSos`).
- Bye-Spalte existiert bereits und füllt sich durch den Merge endlich auch beim Auto-Import.
- Farbe **nie allein** als Bedeutungsträger (Designsystem + `color-not-only`): Vorzeichen steht am
  Zahlwert. Zahlen in JetBrains Mono / `tabular-nums`, wie gesetzt.
- Mobile-Subline analog ergänzen.

### 5.6 Dialoge raus (B9)

- `alert()` → Inline-Fehler am auslösenden Element, deutsch, **mit Lösungsweg** (`error-clarity`).
- `window.confirm('… überschreiben?')` → `Modal` (Komponente existiert), deutsch, destruktive Aktion
  als solche gekennzeichnet, plus das Undo aus §5.4 als Netz.
- Setup-Labels durchgehend deutsch — „League"/„Refresh drafts"/„Attach"/„Choose CSV file"/
  „Apply defaults"/„Show advanced options" widersprechen der Projektregel.

---

## 6. Tipplogik (`src/hooks/useDraftTips.js`)

Die Tips sind der einzige Ort, an dem die neuen Daten im Draft **spürbar** werden — Daten ohne Tips
wären nur eine neue Spalte.

- **Deutsch**, Tonfall wie `useRookieDraftTips` (Nutzer-Entscheidung, Projektregel).
- **Streuung statt Binär:** heute `'likely' | 'unlikely'`. Mit `stdev`/`high`/`low`:
  „Wird typisch zwischen Pick 18 und 31 gezogen — bis zu deinem nächsten Pick (26) ein Münzwurf."
  Fällt auf die heutige Binär-Aussage zurück, wenn keine Streuung vorliegt (z. B. CSV-Board).
- **Bye-Cluster** wird nachgezogen (im Kommentar seit jeher angekündigt, nie implementiert):
  warnen, wenn unter den eigenen Startern eine Position in derselben Bye-Woche klumpt.
- **`pos_need` entrauschen:** feuert heute ab Pick 1 für jede unvolle Position („Du brauchst noch
  RB-Starter" — bei Pick 1 trivial wahr). Neue Regel, explizit: der Tip feuert nur, wenn
  **`verbleibendeEigenePicks - offeneStarterplätze <= 2`** — also erst dann, wenn kaum noch Picks
  übrig sind, um alle Startplätze zu füllen, und die Lücke damit real wird. Bei Pick 1 (≈16 Picks
  übrig, ≈9 offene Startplätze, Differenz 7) schweigt er. Die Konstante `2` wird im Plan als
  benannte Konstante geführt, nicht als Magic Number verstreut. Die heutige Runden-Heuristik
  (`round < 7` im `qbGate`) entfällt zugunsten dieser Regel.
- **Injury-Tips** bekommen erstmals Daten: `injury_status` aus `playersMeta` (142 Spieler haben es)
  über `sleeperId` aus FantasyCalc — der Grund, warum der Endpoint das Feld künftig durchreicht.
- **Tote Felder entfernen:** `adp_ppr`, `adp` aus `SLIM_KEYS` in `playersMeta.js` (B4). Sie
  suggerieren eine Datenquelle, die es nicht gibt.

---

## 7. Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| FFC nicht erreichbar, FantasyCalc ok | Import **gelingt** — Board ohne ADP, Banner sagt „Marktdaten nicht erreichbar, Rangliste importiert", Herkunfts-Zeile zeigt „ADP fehlt · [Erneut versuchen]". Kein harter Fehlschlag: ein Board ohne ADP ist besser als kein Board. |
| FantasyCalc nicht erreichbar | Import schlägt fehl, Inline-Fehler mit Wiederholen. Ohne Rangliste gibt es kein Board. |
| Beide nicht erreichbar | wie oben; Hinweis auf den CSV-Weg als Ausweichpfad. |
| `refreshMarketData` schlägt fehl | Board **unverändert**, Fehler in der Herkunfts-Zeile. Ein fehlgeschlagener Refresh darf nie Daten anfassen. |
| Ungültiger Mock-Link | Inline unter dem Feld, mit Lösungsweg. |
| Kein Match beim Merge | Kein Fehler. `adp: null`, „—" in der Spalte, Zahl im Banner. |

---

## 8. Tests

Vorhandene Basis: Vitest (`vitest.config.js`, `src/test/`, `urlState`/`useUIStore` sind getestet).
**Kein E2E-Runner** — das bleibt so.

| Einheit | Testfälle |
|---|---|
| `marketMerge` (rein, daher der Schwerpunkt) | Union hängt FFC-only (K/DEF) hinten an; `rk` bleibt lückenlos; Overlay überschreibt `rk` nicht; Nicht-Match → `adp: null`; `stats` zählt korrekt; leere Eingaben beidseitig |
| `deriveFormat` | Draft schlägt Liga; Override schlägt Draft; Mock ohne Liga → Draft-Settings (**B3, der Regressionstest**); Defaults ohne alles; `source` korrekt |
| `useBoardStore.refreshMarketData` | `rk` und Reihenfolge unverändert; nur Markt-Felder geändert; Fehler lässt Board unangetastet |
| `undoImport` | stellt vorherigen Zustand her; ohne Snapshot ein No-Op |
| `useDraftTips` | Streuungs-Text bei `stdev`; Fallback ohne `stdev`; `pos_need` schweigt bei Pick 1; Bye-Cluster feuert bei Klumpen |
| Server | Whitelist für `format`; `isDynasty` default true (**Rookie-Regressionstest**); `PK` → `K` |

Manuelle Verifikation (`npm run dev:all`) gegen einen echten Sleeper-Mock — die Herkunfts-Zeile und
die On-the-clock-Leiste wurden laut `project_next_steps` **nie gegen echte Draft-Daten gesehen**.
Diese Verifikation ist Teil der Umsetzung, und es wird nicht behauptet, sie sei erfolgt, bevor sie
erfolgt ist.

---

## 9. Umsetzungsreihenfolge (Vorgriff auf den Plan)

Parallelisierbar, weil die Schnittstellen vorab feststehen:

1. **Fundament (zuerst, blockiert den Rest):** `deriveFormat` + `marketMerge` als reine Funktionen
   mit Tests. Keine UI.
2. **Parallel danach:**
   - **Server:** FFC-Endpoint + `isDynasty`-Param, in **beiden** Server-Dateien.
   - **Store:** Import-Zweig, `refreshMarketData`, `marketMeta`, Undo-Snapshot.
   - **Format-Konsumenten:** `App.jsx` / `SetupForm` / `BoardSection` auf `deriveFormat` umstellen
     (B3, B6).
3. **Parallel danach:** Herkunfts-Zeile · Board-Spalten · Dashboard-Mock-Karte · Wizard-Straffung ·
   Dialoge/Deutsch.
4. **Zuletzt (braucht die Daten):** Tipplogik — Deutsch, Streuung, Bye-Cluster, `pos_need`, Injury.
5. **Abschluss:** manuelle Verifikation gegen echten Mock.

---

## 10. Offene Punkte

- **FFC `teams`-Param wirkt nicht:** 8/10/12/14 liefern identische 207 Spieler / 2072 Drafts. Wird
  trotzdem mitgeschickt (schadet nicht, falls FFC es später beachtet), aber die Liga-Größe darf
  **nicht** als im ADP berücksichtigt dargestellt werden. Die Herkunfts-Zeile nennt deshalb die
  Draft-Zahl, nicht die Team-Größe.
- **Superflex:** FFC hat kein `superflex`, aber `2qb` (185 Spieler, 595 Drafts) — wird dafür genutzt.
  Nicht identisch, aber die nächstbeste öffentliche Näherung; die Zeile nennt das Format ehrlich.
- **200 vs. 207 Spieler:** knapp für 12×16 = 192 Picks. Die Union entschärft es, ein tiefes Board ist
  es trotzdem nicht. Für Deep-Rosters bleibt CSV der bessere Weg — das ist ein Argument dafür, dass
  der CSV-Pfad bleibt, kein Fehler.
