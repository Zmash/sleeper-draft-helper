# Design-Spec: AI-Mehrwert — Live-Advice als Kern, Vertrauen & Kosten für alle drei Features

**Datum:** 2026-07-17
**Branch:** `worktree-ai-review` (Worktree `.claude/worktrees/ai-review`, Basis: main `460e0cd`)
**Status:** vom Nutzer abgenommen (Ansatz A + Hygiene-Paket + Server-Konsolidierung)
**Vorgabe des Nutzers:** „Die AI soll einen echten Mehrwert bieten und nicht nur eine Spielerei sein."
**Kostenvorgabe:** Ein API-Key ist zum Testen hinterlegt. Echte Calls kosten Geld — sparsam einsetzen
(„wenn nötig gut, sonst nicht"). Payload-Prüfungen laufen kostenlos über Fetch-Interception (§13).

---

## 1. Ausgangslage & Befund

Es gibt drei AI-Features. **AI-Advice** (`src/services/ai.js` → `POST /api/ai-advice`) wurde am
2026-07-17 auf dem Redraft-Branch gefixt (scoringType, adp, upcoming_pick_number, market_value —
Commit `b5a0829`, auf main gemerged) und mit einem echten Call bewiesen. **Draft-Review**
(`src/services/aiDraftReviewClient.js` → `POST /api/ai-draft-review`) und **Trade**
(`src/services/aiTrade.js` → `POST /api/ai-trade`) wurden **noch nie ausgeführt** und tragen
statisch nachweisbar dieselben Fehlerklassen plus eigene.

### Befunde (Review 2026-07-17, alle statisch verifiziert)

**Vertrauen — die AI behauptet Dinge, die nicht aus den Daten kommen:**

| # | Befund | Ort |
|---|--------|-----|
| V1 | System-Prompt hardcodet „League is Half-PPR unless scoring settings say otherwise" | `aiDraftReviewClient.js:76` |
| V2 | Schema **erzwingt** Week-1-Start/Sit (`required`), obwohl kein Spielplan-/Matchup-Datum im Kontext liegt — Fabrikation per Design. Bei Rookie-Drafts zusätzlich sinnfrei. | `REVIEW_TOOL` in `src/server/index.js:112-121` + `prod.js` |
| V3 | Die „+X% for you"-Badges der Trade-Vorschläge rechnen mit **modell-gelieferten** Zahlen (`value_you_give/get`), nicht mit unseren KTC/FC-Werten | `TradeAnalyzer.jsx:371-375` |
| V4 | Keine Output-Validierung: empfohlene Spieler werden nicht gegen das Board geprüft, Trade-Namen nicht gegen die Roster | überall |
| V5 | Trade hardcodet `format: 'dynasty'` und `rec ?? 1` → PPR-Default | `aiTrade.js:105-107, 134, 173-175` |
| V6 | Advice: `is_snake: true` hardcodiert; `slot` nur via `inferMySlot` (erst nach dem ersten eigenen Pick bekannt), obwohl `App.jsx` den `draftSlot` berechnet | `ai.js` (`makeContext`) |
| V7 | `favBonus: 6` / `avoidPenalty: 10` werden top-level übergeben, aber aus `options` gelesen → tote Parameter, es gelten still 5/8 | `BoardSection.jsx:131-132` vs. `ai.js` (`user_bias.weights`) |

**Kosten — der Nutzer zahlt, ohne es zu sehen:**

| # | Befund | Ort |
|---|--------|-----|
| K1 | `DraftAnalysis` feuert den teuersten Call der App (Liga + alle Picks + alle Roster + bis 500 Board-Spieler) **automatisch** per `useEffect` beim Modal-Öffnen. `Modal` rendert `null` wenn zu → jedes Wiederöffnen remountet und zahlt erneut. | `DraftAnalysis.jsx:51-53`, `App.jsx:349`, `Modal.jsx:18` |
| K2 | Kein Prompt-Caching: System-Prompt und Tool-Schemas sind statisch, werden aber jedes Mal voll berechnet | `src/server/index.js` + `prod.js` |
| K3 | `usage` wird bei Advice und Trade im Result mitgeschickt, aber nirgends angezeigt; beim Review fehlt es sogar im Result | Server + alle Dialoge |
| K4 | Ein Modell für alles: `claude-sonnet-4-6` (veraltet) | `index.js:22`, `prod.js` |

**Sprache & Wahrnehmung:**

| # | Befund | Ort |
|---|--------|-----|
| S1 | Alle drei Features antworten auf Englisch — bei Trade explizit („Respond in English"), im Live-Test sichtbar: deutsche Labels, englische Beratung | alle System-Prompts |
| S2 | „Streaming" ist Illusion: mit forced `tool_choice` gibt es keine `text`-Events; die `streamingText`-Pipeline in AdviceDialog/BoardSection ist de facto tot | `BoardSection.jsx` (SSE-Loop), `AdviceDialog.jsx` |

**Mehrwert — das eigentliche „Spielerei"-Problem:**

Die kostenlose Tipp-Engine (`useDraftTips`) liefert bereits: Value vs. ADP **mit Spannen-Urteil**
(high/low/stdev), Tier-Drop-Warnungen, Positional Need, Bye-Cluster, Injury. Das Advice-Feature
liefert heute größtenteils dieselben Erkenntnisse — langsamer und gegen Geld. Was die AI könnte,
was Heuristiken nicht können (Trade-offs zwischen konkreten Kandidaten abwägen, einen Plan über
die nächsten 2–3 Picks legen, auf einen laufenden Positions-Run reagieren, die Roster-Lücken der
dazwischen ziehenden Gegner einpreisen), dafür bekommt sie die Daten nicht: kein
`high`/`low`/`stdev`, keine Pick-Historie, kein Gegner-Roster-Blick.

### Server-Struktur

`src/server/index.js` (dev, 5175) und `src/server/prod.js` (prod, 8080, serviert `dist/`) sind
Fast-Zwillinge; CLAUDE.md verlangt, jede AI-Änderung doppelt zu machen. Das ist die Fehlerklasse
„nur in einer Datei gefixt" — sie wird in diesem Branch strukturell beseitigt.

---

## 2. Entscheidungen (Nutzer, 2026-07-17)

1. **Kern des Mehrwerts: Live-Advice im Draft.** Review und Trade bekommen das Hygiene-Paket,
   keinen Tiefbau. (Ausnahme: der Week-1→Learnings-Tausch im Review, explizit abgenommen.)
2. **Trigger: manuell + Vorbereitung.** Der Button bleibt die einzige Geldausgabe. Die App baut
   den Kontext vor dem Klick zusammen und zeigt eine Kostenschätzung; kein Auto-Prefetch.
3. **Modell: `claude-sonnet-5` für alles.** Env-Override `SDH_MODEL` bleibt.
4. **Ansatz A:** bessere Ein-Schuss-Beratung (ein Call, ein Tool), kein Zwei-Stufen-System.
5. **Server-Konsolidierung: ja.**
6. **Week-1-Start/Sit fliegt aus dem Review**, ersetzt durch „Learnings für den nächsten Mock".

---

## 3. Nicht im Scope

- **Kein Auto-Prefetch** des Advice (bewusst abgelehnt, Kosten).
- **Kein Tiefbau am Trade-Feature** (nur Hygiene: Format, Deutsch, Validierung, ehrliche Zahlen).
- **Kein Umbau der Gratis-Tipp-Engine** (`useDraftTips` bleibt unangetastet; sie liefert nur
  zusätzlich Signale in den AI-Kontext).
- **Der manuelle CSV-Import bleibt exakt wie er ist** (stehende Nutzer-Vorgabe).
- **Kein Streaming-Umbau auf partial-JSON**: die tote streamingText-Pipeline wird entfernt,
  nicht durch input_json-Delta-Streaming ersetzt (Aufwand/Nutzen).
- `POST /api/validate-key` bleibt auf Haiku (bewusst billig).

---

## 4. Architektur-Überblick

```
Client                                        Server (geteilt: apiRoutes.js)
──────────────────────────────────────────    ──────────────────────────────
BoardSection ──┐
               ├─ ai.js (Kontext+Schema) ───► POST /api/ai-advice ──► Anthropic
AdviceDialog ◄─┴─ aiValidate.js (Filter)          │ (Sonnet 5, cache_control,
                                                  │  usage im result)
DraftAnalysis ── aiDraftReviewClient.js ────► POST /api/ai-draft-review
TradeAnalyzer ── aiTrade.js ────────────────► POST /api/ai-trade

Neu (pure, getestet):
  src/services/draftFlow.js   — Run-Erkennung + Gegner-Lücken (Snake-Mathe)
  src/services/aiValidate.js  — Output-Validierung gegen Board/Roster
  src/services/aiCost.js      — Token-Schätzung + Preiskonstanten
  src/server/apiRoutes.js     — alle /api-Routen, von index.js & prod.js registriert
```

---

## 5. Teil A: Server-Konsolidierung

**Neu: `src/server/apiRoutes.js`** exportiert `registerApiRoutes(app, { model })` und registriert
dort **alle** heutigen `/api/*`-Routen (ffc-adp, fantasycalc, ktc-dynasty, ktc-rookies, health,
validate-key, ai-advice, ai-draft-review, ai-trade). `REVIEW_TOOL` zieht mit um. `index.js`
schrumpft auf: express + CORS + `registerApiRoutes` + listen; `prod.js` auf: express +
`registerApiRoutes` + Static-Serving + listen. Verhalten identisch (Ports, Header, SSE-Format).

**Modell:** Default `claude-sonnet-5` statt `claude-sonnet-4-6`; `SDH_MODEL` überschreibt weiter.

**Prompt-Caching:** Der Server transformiert eingehende Payloads vor dem Anthropic-Call:
- `system` (String vom Client) → `[{ type: 'text', text, cache_control: { type: 'ephemeral' } }]`
- letztes Element von `tools` bekommt `cache_control: { type: 'ephemeral' }`

Als **pure Funktion** `applyPromptCaching(payload)` in `apiRoutes.js` exportiert und unit-getestet.
Hinweis: Caching greift erst ab ~1024 Tokens Präfix (Sonnet); liegt der statische Teil darunter,
passiert schlicht nichts — kein Fehlerfall. Cache-TTL ~5 min, passt zum Advice-Rhythmus im Draft.

**Usage:** Alle drei AI-Endpunkte schicken `usage` (inkl. `cache_read_input_tokens` /
`cache_creation_input_tokens`, sofern vorhanden) im `result`-Event. Beim Review fehlt das heute.

**CLAUDE.md aktualisieren:** Der Absatz „Dev vs. prod server split (keep in sync)" beschreibt nach
diesem Umbau die Welt falsch — er wird ersetzt durch die neue Regel (AI-/Rankings-Änderungen nur
noch in `apiRoutes.js`).

---

## 6. Teil B: Advice-Kontext — `draftFlow.js` + Erweiterungen in `ai.js`

**Neu: `src/services/draftFlow.js`** (pure, ohne React):

- `detectRuns(picks, { window = 12 })` → `{ recent: [{pick_no, pos}], counts: {RB: 5, WR: 3, …}, run: 'RB' | null }`.
  `run` ist gesetzt, wenn eine Position ≥ 40 % des Fensters stellt (mind. 4 Picks). Schwelle als
  exportierte Konstante.
- `opponentsUntilMyNext({ picks, teamsCount, mySlot, upcomingPick, myNextPick, rosterPositions })` →
  Liste der Slots, die zwischen `upcomingPick` und `myNextPick` ziehen (Snake-Mathe aus `pick_no`:
  Runde `r = ceil(n/teams)`, Slot in gerader Runde gespiegelt), je mit `filled` (Positions-Zählung
  der bisherigen Picks dieses Slots) und `open_starters` (gegen `countStarters(rosterPositions)`).
  **Vorsicht `Number(null)`** — die bekannte Falle (siehe `project_dev_gotchas`): `mySlot == null`
  ⇒ Rückgabe `null`, niemals mit Slot 0 rechnen.

**`makeContext` in `ai.js` erweitert:**

- `minifyBoardPlayer` gibt zusätzlich `high`, `low`, `stdev` mit (nur wenn `!= null` — dieselbe
  Guard-Disziplin wie bei `adp`).
- `context.draft` bekommt: `my_slot` (Parameter `draftSlot` hat Vorrang, Fallback `inferMySlot`),
  `my_next_pick_number` und `picks_until_my_next` (via `picksUntilMyNext` aus `derive.js`),
  `draft_type` (aus `draft.type`; `is_snake` wird daraus abgeleitet statt hardcodiert).
- `context.draft_flow` = Ergebnis von `detectRuns`.
- `context.opponents_before_my_next` = Ergebnis von `opponentsUntilMyNext` (nur Snake, sonst weg).
- `context.my_team.bye_weeks` = Zählung `{week: count}` der eigenen Picks.
- `context.tips_signals` = die aktuell gefeuerten Gratis-Tipps, kompakt `[{type, text}]`, max. 7 —
  von `BoardSection` übergeben (BoardPage hat sie bereits für den TipsDock).
- `user_bias.weights` liest `options.favBonus ?? params.favBonus` — und `BoardSection` verschiebt
  die beiden Werte in `options` (V7 damit doppelt abgesichert).

**Durchreichung:** `App.jsx` reicht seinen berechneten `draftSlot` über `pageProps` → `BoardPage`
→ `BoardSection` → `buildAIAdviceRequest`. (Heute endet er bei `useDraftTips`.)

---

## 7. Teil C: Advice-Output-Schema

`return_draft_advice` wird umgebaut (Feldnamen englisch, **alle Freitexte deutsch, du-Form** — im
System-Prompt als harte Regel):

```
primary:        { player_nname, player_display, pos, rk, why, fit_score }
alternatives:   2–4 × { player_nname, player_display, pos, rk, why,
                        tradeoff_vs_primary }   ← „Was gebe ich auf, wenn ich primary nehme?"
survival:       je Kandidat (primary + alternatives):
                { player_nname, verdict: 'duerfte_da_sein'|'muenzwurf'|'duerfte_weg_sein', reason }
                ← gestützt auf high/low vs. my_next_pick_number; UI-Wortlaut identisch mit der
                  Tipp-Engine („dürfte da sein / ein Münzwurf / dürfte weg sein")
plan_next_picks: bis 3 × { pick_number, target_positions[], candidate_nnames[], note }
run_alert:      { pos, note } | null
strategy_notes: string
risk_level, confidence (wie bisher)
```

**System-Prompt neu geschrieben:** verweist explizit auf `survival`-Begründung nur aus
`high`/`low`/`adp`; `plan_next_picks` muss `opponents_before_my_next` und `bye_weeks` einbeziehen;
Kandidaten ausschließlich aus dem Board; Deutsch (du-Form) für `why`, `tradeoff_vs_primary`,
`reason`, `note`, `strategy_notes`. `max_tokens` von 1024 auf 2000 (mehr Struktur im Output).

**AdviceDialog** rendert neu: Empfehlung → Vergleich (Alternativen mit Trade-off) → „Überlebt bis
Pick N?" (Survival-Verdicts) → Plan → Run-Hinweis → Validierungs-Warnungen → Usage-Footer.
Deutsche Labels. `streamingText` und zugehörige SSE-`text`-Verarbeitung in `BoardSection` entfallen
(S2); Ladezustand wird ein ehrlicher statischer Hinweis.

---

## 8. Teil D: Validierungsschicht — `aiValidate.js`

**Neu: `src/services/aiValidate.js`** (pure):

- `validateAdvice(parsed, availableNnames: Set)` → `{ cleaned, warnings: string[] }`.
  Prüft `primary`, jede Alternative und `plan_next_picks[].candidate_nnames` gegen die Menge der
  **verfügbaren** Board-Spieler (nname-normalisiert via `normalizePlayerName`). Nicht gefundene
  oder bereits gepickte Namen werden entfernt; Warnung je Fund: „AI nannte ‚X' — nicht (mehr)
  verfügbar, aussortiert." Fällt `primary` durch, rückt die erste valide Alternative nach
  (Warnung: „Empfehlung war nicht verfügbar — ‚Y' nachgerückt."). Bleibt nichts übrig:
  `cleaned = null` + Warnung; der Dialog zeigt dann die Warnungen statt einer leeren Empfehlung.
- `validateTradeSuggestions(parsed, { myRoster, rostersByName })` → `{ cleaned, warnings }`.
  Jeder Name in `you_give` muss auf dem eigenen Roster, jeder in `you_get` auf dem Roster des
  genannten Gegners existieren (nname-Vergleich, `stripSuffix`-tolerant). Vorschläge mit
  unbekannten Namen werden aussortiert (Warnung). `value_you_give`/`value_you_get` werden
  **verworfen und aus unseren Werten neu summiert** (`dynasty_value` der gematchten Spieler bzw.
  `pickDynastyValue` für Picks); die „+X%"-Badges rechnen ausschließlich damit (V3, V4).

AdviceDialog und TradeSuggestions rendern `warnings` sichtbar (dezenter Warnblock, kein Modal).

---

## 9. Teil E: Draft-Review — Auto-Call weg, Learnings statt Week-1

- **K1-Fix:** Der `useEffect`-Auto-Call in `DraftAnalysis.jsx` entfällt. Stattdessen Button
  „Review starten" mit Kostenschätzung daneben (§10). Das Ergebnis (`ai.data`) wandert als State
  nach `App.jsx` (dort lebt schon das Modal) und wird per Prop übergeben — Wiederöffnen zeigt das
  gecachte Ergebnis plus „Neu berechnen"-Button. Draft-Wechsel (`prevDraftIdRef`-Reset in App.jsx)
  leert den State mit.
- **V1-Fix:** Der System-Prompt baut die Scoring-Zeile aus `deriveFormat({ draft, league,
  overrides })` („League ist ‹scoringType›, ‹teams› Teams, Superflex: ja/nein") statt Half-PPR zu
  raten. `buildDraftReviewPayload` bekommt dafür das Format als Parameter.
- **V2-Fix:** `myWeek1StartSit` fliegt aus `REVIEW_TOOL`, dem Prompt und der UI. Ersatz:
  `lessonsForNextMock`: 2–4 × `{ lesson, evidence }` — konkrete, belegbare Learnings („Du hast in
  R3–5 zweimal gegen fallende WR-Value gepickt — Evidenz: Picks 28 und 52 je >6 Plätze über ADP").
  `evidence` muss sich auf konkrete Picks/Ränge aus dem Kontext beziehen. Required.
- **Deutsch** (du-Form) für alle Freitexte; Rookie-Bewusstsein: `draftMode` wandert in den Kontext,
  der Prompt passt Steals/Reaches-Sprache an (Rookie: Wert vs. Board-Rang statt ADP).
- **Kontext-Diät:** `board.players` auf 300 gekappt und auf `{name, pos, team, rk, tier}`
  minifiziert; `league.draft_order` entfällt (ungenutzt). Rosters/Picks bleiben vollständig
  (Kern des Reviews).
- Der Fallback „erstes Team = mein Team" bleibt, aber das Review sagt es dann dazu (Feld
  `meta.myTeamAssumed` → UI-Hinweis), statt still das falsche Team zu vertiefen.

---

## 10. Teil F: Kostenanzeige — `aiCost.js`

**Neu: `src/services/aiCost.js`** (pure):

- `estimateTokens(payload)` → `Math.round(JSON.stringify(payload).length / 4)` — bewusst grob,
  wird als „≈" angezeigt.
- `PRICING = { 'claude-sonnet-5': { inputPerMTok: …, outputPerMTok: … } }` — **Werte bei der
  Umsetzung von docs.anthropic.com übernehmen**, eine Stelle, Kommentar mit Stand-Datum.
- `formatCost({ inputTokens, outputTokens, model })` → „≈ 9k Tokens · ~0,03 $".

**UI:** Neben jedem AI-Button („AI-Advice", „Review starten", „AI Analysis", „Suggest Trades")
steht die Schätzung vor dem Klick; nach dem Call zeigt der jeweilige Ergebnisbereich den echten
Verbrauch aus `usage` („Verbraucht: 9,2k in / 0,8k out · Cache-Treffer 2,1k · ~0,04 $").

---

## 11. Teil G: Trade-Hygiene

- `format` ehrlich: `league.settings.type === 2 ? 'dynasty' : 'redraft'` — **numerisch vergleichen**
  (0=redraft, 1=keeper, 2=dynasty; Keeper ⇒ 'redraft' mit Hinweisfeld `keeper: true`).
- Scoring über `deriveFormat` statt `rec ?? 1` (V5).
- Beide System-Prompts: Deutsch (du-Form) statt „Respond in English" (S1).
- Validierung + Wert-Neuberechnung aus §8 (V3, V4).
- `max_tokens` der Suggestions 2000 → 2500 (vier Vorschläge + Rationales passten knapp).

---

## 12. Teil H: Aufräumarbeiten

- `BoardSection`: SSE-`text`-Handling und `streamingText`-State raus (S2); `favBonus`/
  `avoidPenalty` in `options` (V7); `tips` als neue Prop für `tips_signals` (§6).
- `AdviceDialog`: Umbau auf die neuen Sektionen (§7), Usage-Footer, Warnungsblock.
- `DraftAnalysis`: Button statt Auto-Call, Ergebnis-Prop, Learnings-Sektion statt Week-1 (§9).

---

## 13. Teststrategie & Verifikation

**Unit (Vitest, TDD):**
- `draftFlow.test.js`: Run-Erkennung (Schwelle, Fenster kleiner 12, leere Picks); Snake-Mathe der
  Gegner-Slots (gerade/ungerade Runde, Rundenwechsel, `mySlot null` ⇒ `null` — die
  `Number(null)`-Falle explizit testen).
- `aiValidate.test.js`: Aussortieren, Nachrücken der Alternative, alles-invalide ⇒ `cleaned null`;
  Trade: Namens-Matching (Suffix-tolerant), Wert-Neuberechnung ignoriert Modell-Zahlen.
- `ai.test.js` (erweitern): high/low/stdev nur wenn vorhanden; `my_slot`-Vorrang vor `inferMySlot`;
  `draft_type`-Ableitung; `tips_signals`-Kappung; favBonus wirksam.
- `aiDraftReviewClient.test.js` (neu): kein Half-PPR-Text mehr; Format-Zeile aus `deriveFormat`;
  Kontext-Diät (300, minifizierte Felder, kein `draft_order`); Deutsch-Mandat im Prompt.
- `aiTrade.test.js` (neu): Format numerisch aus `settings.type`; deutscher Prompt.
- `apiRoutes.test.js` (neu): `applyPromptCaching` (String-System → Block mit cache_control;
  letztes Tool markiert; Payload ohne tools unverändert); `REVIEW_TOOL` enthält
  `lessonsForNextMock`, kein `myWeek1StartSit`.

**Kostenlose End-to-End-Prüfung:** `window.fetch` im Browser patchen, `/api/ai-*`-Body abfangen
und vor dem Absenden rejecten — Payload beliebig oft gratis inspizieren (Technik bewährt am
2026-07-17). Erst wenn der Payload nachweislich stimmt, echte Calls.

**Bezahlte Verifikation (Budget: max. 3 Calls):** je ein Call Advice (im laufenden/pausierten
Mock — prüft deutsche Texte, Survival-Verdicts, Plan, Validierung, Usage-Anzeige, Cache-Feld),
Review (prüft Learnings, kein Week-1, Format-Zeile), Trade-Suggestions (prüft Namens-Validierung
und neu gerechnete Badges). Advice ggf. zweimal kurz hintereinander, um `cache_read_input_tokens
> 0` zu belegen — dann entfällt der Trade-Call zugunsten des Budgets, Trade bleibt
payload-verifiziert.

**Regression:** volle Suite (Basis: 186 Tests) + `npx vite build` + beide Server-Entrypoints
starten (`node src/server/index.js`, kurz `prod.js` gegen gebautes `dist/`) und `GET /api/health`
prüfen.

---

## 14. Risiken & offene Punkte

- **Sonnet 5 antwortet strukturell anders als 4-6** (z. B. knappere Tool-Inputs). Die Validierung
  (§8) fängt Namensfehler; Schema-`required` fängt Lücken. Restrisiko klein, per Live-Call geprüft.
- **`livePicks` ist nicht persistiert** (bekannt, offen): direkt nach einem Reload ist der
  AI-Kontext für ~10 s leer — Advice würde „Pick 1, leeres Roster" beraten. Dieser Branch gated
  den Advice-Button, solange `picks.length === 0 && selectedDraftId` frisch lädt (billiger Guard,
  ehrlicher Hinweis), die echte Persistenz bleibt separat.
- **Cache-Mindestgröße:** Liegt System+Tools unter ~1024 Tokens, cached Anthropic nicht — harmlos,
  aber die Usage-Anzeige zeigt dann eben 0 Cache-Treffer. Nicht als Fehler behandeln.
- **Preiskonstanten veralten.** Eine Stelle (`aiCost.js`), Kommentar mit Stand-Datum, „~"-Anzeige.
- **`draft.type` bei Sleeper:** erwartet `'snake' | 'linear' | 'auction'`; bei unbekanntem Wert
  wird `opponents_before_my_next` weggelassen statt geraten (Guard, kein Fehler).
