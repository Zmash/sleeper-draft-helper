# Graph Report - sleeper-draft-helper  (2026-09-12)

## Corpus Check
- 251 files · ~262,787 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1357 nodes · 3131 edges · 81 communities (74 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fca2619d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Board & Draft Components
- aiTrade.js
- Trade & Draft Tips Hooks
- App Core & Analysis
- Package Dependencies (dev)
- Project Architecture Concepts
- Package Dependencies (prod)
- Roster CSV & Market
- aiTrade.js
- ApiKeyDialog.jsx
- Server API Routes
- DraftAnalysis.jsx
- Advice Dialog & Modals
- Trade Service & AI
- useLiveStore
- Mock Draft Card
- TradePage.jsx
- Team Rankings: neue lokale Bewertungslogik
- tradeValue.js
- Draft-Strategie: Bibliothek + AI-Recherche
- Global Constraints
- DataProvenanceBar.jsx
- SetupPage.test.jsx
- Global Constraints
- Dashboard Store Tests
- StrategySection.jsx
- Board Store Tests
- Type Definitions
- Year Constants
- Draft Strategies
- Datei-Übersicht
- Setup/Profile-Restrukturierung — Design
- ApiKeyDialog.jsx
- Geräte-Sync — Design
- formatEstimate
- Draft-Strategie: Bibliothek + AI-Recherche
- Dateien
- preferences.js
- graphify reference: extra exports and benchmark
- tipsPrioritizer.js
- graphify reference: query, path, explain
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- enrichBoardWithSleeper.js
- CLAUDE.md
- extraction-spec.md
- SetupPage.test.jsx
- tradeValue.js
- settingsTransfer.js
- useDynastyStore.test.js
- buildAdviceRequestArgs
- SetupPage.test.jsx
- aiValidate.js
- useDynastyStore.js
- tradeValue.js
- NextBoard
- NextShell.jsx
- SetupPage.jsx
- useUIStore.js
- AppShell.jsx
- DataProvenanceBar.jsx
- formatEstimate
- SetupPage.test.jsx
- BoardSection.mismatch.test.jsx
- @fontsource/barlow-condensed
- react-dom
- react-router-dom
- enrichBoardWithSleeper.js

## God Nodes (most connected - your core abstractions)
1. `normalizePlayerName()` - 53 edges
2. `cx()` - 48 edges
3. `normalizePos()` - 38 edges
4. `p()` - 37 edges
5. `Icon()` - 36 edges
6. `registerApiRoutes()` - 36 edges
7. `useSessionStore` - 33 edges
8. `BoardSection()` - 30 edges
9. `fetchJson()` - 28 edges
10. `App()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `football.html - Canvas Football Animation` --references--> `Sleeper Draft Helper`  [INFERRED]
  public/football.html → README.md
- `BoardSection()` --references--> `react`  [EXTRACTED]
  src/components/BoardSection.jsx → package.json
- `DraftAnalysis()` --references--> `react`  [EXTRACTED]
  src/components/DraftAnalysis.jsx → package.json
- `TradeSide()` --indirect_call--> `p()`  [INFERRED]
  src/components/TradeAnalyzer.jsx → src/services/analysis/marketStats.test.js
- `defaultDeps()` --indirect_call--> `enriched()`  [INFERRED]
  src/server/lineupCheck.js → src/stores/useDynastyStore.test.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Feature Plan-Spec Pairs** — plan_broadcast_redesign, spec_broadcast_redesign, plan_redraft_flow, spec_redraft_flow, plan_ai_mehrwert, spec_ai_mehrwert [EXTRACTED 0.95]
- **Server Proxy Stack** — concept_express_ai_proxy, concept_anthropic_sdk, concept_deploy_pipeline, concept_sleeper_api [EXTRACTED 0.95]
- **Frontend SPA Stack** — concept_react_vite_spa, concept_zustand_stores, concept_appjsx_orchestrator, concept_capacitor_android [EXTRACTED 0.95]

## Communities (81 total, 7 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.12
Nodes (17): AiResult(), CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), POS_FILTERS, PROFILE_ICONS, PROFILE_LABELS (+9 more)

### Community 1 - "aiTrade.js"
Cohesion: 0.13
Nodes (20): fmtPick(), OnTheClockBar(), draft, groupBy(), hashId(), POS, base, roster (+12 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.12
Nodes (21): RootRedirect(), DraftCardInner(), EditableTitle(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard() (+13 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.13
Nodes (36): DraftTab(), AnalysisPage(), TABS, ecrByName(), FLEX_FRACTION_LABELS, FLEX_SLOTS, formatComposition(), formatFlexShare() (+28 more)

### Community 4 - "Package Dependencies (dev)"
Cohesion: 0.05
Nodes (41): @capacitor/cli, @capacitor/core, concurrently, jsdom, devDependencies, @capacitor/cli, @capacitor/core, concurrently (+33 more)

### Community 5 - "Project Architecture Concepts"
Cohesion: 0.12
Nodes (29): CLAUDE.md Project Instructions, AI-Mehrwert (Live-Advice as Core), Anthropic SDK / Claude Sonnet 5, App.jsx Orchestrator, Broadcast Lower-Third Design System, Capacitor Android Build, Deploy Pipeline (current-symlink), Draft Modes (Redraft vs. Rookie/Dynasty) (+21 more)

### Community 6 - "Package Dependencies (prod)"
Cohesion: 0.05
Nodes (39): @2toad/profanity, @anthropic-ai/sdk, @capacitor/android, cheerio, cors, dotenv, express, @fontsource/barlow (+31 more)

### Community 7 - "Roster CSV & Market"
Cohesion: 0.11
Nodes (31): qrSvg(), SyncSection(), applyBundle(), collectBundle(), EXCLUDE_KEYS, EXTRA_KEYS, isBundled(), mergeBundles() (+23 more)

### Community 8 - "aiTrade.js"
Cohesion: 0.08
Nodes (35): AppShell(), BoardToolbar(), INTERVALS, Footer(), Icon(), MAP, ImportResultBanner(), stats (+27 more)

### Community 9 - "ApiKeyDialog.jsx"
Cohesion: 0.11
Nodes (17): Datei-Überblick, Global Constraints, Self-Review (durchgeführt), Task 10: `PickupSuggestions.jsx`, Task 11: `StreamingBoard.jsx`, Task 12: `RecommendedLineupCard.jsx`, Task 13: `WaiverPage.jsx` + Routing/Nav-Integration + finale Verifikation, Task 1: FantasyPros-Positions-URL-Builder + Normalizer-Erweiterung (+9 more)

### Community 10 - "Server API Routes"
Cohesion: 0.06
Nodes (64): addScore(), applyPromptCaching(), buildStrategyPrompt(), checkScoreRateLimit(), isProfaneName(), isValidRoom(), isValidScoreEntry(), isValidScoreName() (+56 more)

### Community 11 - "DraftAnalysis.jsx"
Cohesion: 0.08
Nodes (30): fmtPct(), fmtRating(), fmtRecord(), heat(), OddsTable(), SeasonTab(), doneSim, rosterLabel() (+22 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.08
Nodes (45): MarketTab(), byeWeekForTeam(), NFL_BYES, TEAM_ALIAS, mergeWithMeta(), primaryPos(), meta, useTrendingPlayers() (+37 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.20
Nodes (9): Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan, Global Constraints, Nach dem Plan, Task 1: Matching-Logik, Task 2: Persistenz und Migration, Task 3: Server-Route mit Web-Recherche, Task 4: Client für die Strategie-Route, Task 5: UI im SetupForm (+1 more)

### Community 14 - "useLiveStore"
Cohesion: 0.07
Nodes (59): ProfileEditor(), EMPTY_STRATEGY, scoringLabel(), StrategySection(), formatSummary(), ProfilesPage(), scoringLabel(), canOfferUndo() (+51 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.14
Nodes (13): 1. `src/services/marketMerge.js`, 2. `src/stores/useBoardStore.js`, 3. `src/components/BoardSection.jsx`, 4. `src/components/DataProvenanceBar.jsx`, 5. `src/pages/SetupPage.jsx` + `src/components/ImportResultBanner.jsx`, CSV-Board: ADP-Override & Bye-Week-Ergänzung, Datenfluss, Nicht-Ziele (+5 more)

### Community 16 - "TradePage.jsx"
Cohesion: 0.16
Nodes (20): DraftPanel(), buildAdviceTool(), buildAIAdviceRequest(), buildSystemPrompt(), countBy(), deriveFavAvoid(), findHandcuffs(), groupBy() (+12 more)

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.21
Nodes (20): availableStreamPositionsFor(), LineupPage(), bestLineup(), compareToActualStarters(), FLEX_ELIGIBLE, freeAgents(), IR_ELIGIBLE_STATUSES, IR_PRIORITY (+12 more)

### Community 19 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.11
Nodes (18): Analyse-Seite (lokal berechnete Statistiken) — Design, Architektur, Bewusst zurückgestellt (Runde 2), Datenfluss, Die Kennzahlen, Layout, Liga-Kader in allen Ligen, Namen und Navigation (+10 more)

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

### Community 21 - "DataProvenanceBar.jsx"
Cohesion: 0.27
Nodes (8): FiltersRow(), RosterPanel(), p(), assignRosterSlots(), ROSTER_SLOT_CONFIG, rosterRows(), BASE_POSITIONS, positionFiltersFromRoster()

### Community 22 - "SetupPage.test.jsx"
Cohesion: 0.16
Nodes (11): AdviceBody(), AdviceDialog(), backdropStyle, bodyScrollStyle, btnGhost, dialogStyle, headRow, preStyle (+3 more)

### Community 23 - "Global Constraints"
Cohesion: 0.22
Nodes (8): CSV-Board: ADP-Override & Bye-Week-Ergänzung — Implementation Plan, Global Constraints, Task 1: `fillMissingBye`-Funktion in `marketMerge.js`, Task 2: Store-Actions in `useBoardStore.js`, Task 3: `BoardSection.jsx` — korrektes Format an `refreshMarketData` übergeben, Task 4: `DataProvenanceBar.jsx` — ADP-Override-Button für CSV-Boards, Task 5: Bye-Week-Ergänzung im Setup-Import-Banner, Task 6: Vollständige Regression + graphify update

### Community 24 - "Dashboard Store Tests"
Cohesion: 0.33
Nodes (4): LEAGUE_2026, NFL_STATE, REAL_MOCK, STALE_LEAGUE_DRAFT

### Community 25 - "StrategySection.jsx"
Cohesion: 0.12
Nodes (16): Analyse-Seite Implementation Plan, File Structure, Global Constraints, Self-Review, Task 10: Reiter „Draft", Task 11: Reiter „Kader" und „Markt", Task 12: Seite verdrahten, Route umstellen, aufräumen, Task 1: `teamKeyFromPick` extrahieren (+8 more)

### Community 26 - "Board Store Tests"
Cohesion: 0.40
Nodes (3): FC, FFC, SLEEPER

### Community 37 - "Datei-Übersicht"
Cohesion: 0.11
Nodes (17): Datei-Übersicht, Global Constraints, Selbstprüfung (vor Abschluss), Setup/Profile-Restrukturierung Implementation Plan, Task 10: `BoardSection.jsx` — `resolveProfile` + Profil-Hinweis auf dem Board, Task 11: `/profiles`-Seite (Profile-Hub), Task 12: Zahnrad-Menü im Topbar, Task 13: `CLAUDE.md` aktualisieren (+9 more)

### Community 38 - "Setup/Profile-Restrukturierung — Design"
Cohesion: 0.11
Nodes (17): Board-Seite: Profil-Hinweis, Datenmodell, Format-Profil, Icon-Konvention, Komponenten, Migration, Navigation, Nicht-Ziele (+9 more)

### Community 39 - "ApiKeyDialog.jsx"
Cohesion: 0.29
Nodes (9): BoardTable(), deltaAdp(), formatDeltaAdp(), PlayerPanel(), PlayerDetailSheet(), PlayerSearch(), usePlayerNews(), DEPTH_CHART_POSITIONS (+1 more)

### Community 40 - "Geräte-Sync — Design"
Cohesion: 0.12
Nodes (15): Abgleich und Konflikte, Absicherung, Bewusst ausgelassen, Bündel, Entscheidung: verschlüsselter Briefkasten, Fehlerfälle, Geräte-Sync — Design, Komponenten (+7 more)

### Community 41 - "formatEstimate"
Cohesion: 0.19
Nodes (12): NextShell(), RAIL, ThemeMenu(), TipsBubble(), useMarketRefresh(), useBoardStore, useUIStore, validThemeId() (+4 more)

### Community 42 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.15
Nodes (12): Anbindung an die bestehenden Prompts, Bewusst nicht enthalten, Client, Datenmodell, Draft-Strategie: Bibliothek + AI-Recherche, Getroffene Entscheidungen, Matching — `src/services/strategyMatch.js`, Recherche-Probelauf (2026-07-25) (+4 more)

### Community 43 - "Dateien"
Cohesion: 0.18
Nodes (10): Dateien, Geräte-Sync Implementation Plan, Global Constraints, Nach dem Plan, Task 1: syncCrypto — Ableitung und Verschlüsselung, Task 2: syncBundle — sammeln und anwenden, Task 3: Server — Briefkasten mit zwei Routen, Task 4: syncClient — Kopplung und Abgleich (+2 more)

### Community 44 - "preferences.js"
Cohesion: 0.22
Nodes (12): buildTradeAnalysisRequest(), buildTradeSuggestionsRequest(), deriveLeagueContext(), formatItem(), formatPickSummary(), formatRosterSummary(), SCORING_LABEL, dynastyLeague (+4 more)

### Community 45 - "graphify reference: extra exports and benchmark"
Cohesion: 0.17
Nodes (12): react, react, ApiKeyDialog(), backdropStyle, boxStyle, btnBase, btnDanger, btnGhost (+4 more)

### Community 46 - "tipsPrioritizer.js"
Cohesion: 0.25
Nodes (6): handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport, setBoardSource, setCsvRawText

### Community 47 - "graphify reference: query, path, explain"
Cohesion: 0.18
Nodes (15): AllTeamsOverview(), GROUPS, primaryReason(), REASON_LABEL, REASON_PRIORITY, rows, buildAllTeamsRows(), countBySeverity() (+7 more)

### Community 48 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.18
Nodes (15): checkUserLeagues(), defaultDeps(), fetchCurrentWeek(), FLEX_POSITIONS, FP_HEADERS, loadMetaDefault(), REASON_TEXT, SFLEX_POSITIONS (+7 more)

### Community 49 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.29
Nodes (6): dynastyRoster, loadIfStale, loadSleeperWeekIfStale, props, rankMaps, sleeperWeekById

### Community 50 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.40
Nodes (3): FULL_KTC, KTC, useDynastyValuesStore

### Community 52 - "graphify reference: transcribe video and audio"
Cohesion: 0.20
Nodes (7): attach, navigate, sessionState, setBoardPlayers, setDraftViewAs, setSelectedDraftId, setSelectedLeagueId

### Community 53 - "enrichBoardWithSleeper.js"
Cohesion: 0.29
Nodes (8): askAiAdvice(), validateAnthropicKey(), matchAsset(), norm(), avail, validateAdvice(), validateTradeSuggestions(), stripSuffix()

### Community 56 - "extraction-spec.md"
Cohesion: 0.15
Nodes (12): Addendum 2026-09-10: Board ans Profil gebunden (User-Feedback nach Live-Test), Board pro Profil/Liga + strikte Modus-Trennung + Ein-Klick-Profil Implementation Plan, Datei-Übersicht, Global Constraints, Self-Review, Task 1: `profileStore.js` — Pflicht-`mode`, Composite-Bindung, `persistProfile`, Task 2: Migration — Altbestand wird pro Modus angelegt, Task 3: `pickProfile` — Wildcards modus-scharf + neuer `boardKey`-Service (+4 more)

### Community 57 - "SetupPage.test.jsx"
Cohesion: 0.18
Nodes (21): BoardSection(), DraftGrid(), posInRound(), NextBoard(), POS_LABEL, ADVICE_REQUEST_OPTIONS, buildAdviceRequestArgs(), baseInputs (+13 more)

### Community 58 - "tradeValue.js"
Cohesion: 0.36
Nodes (9): DraftAnalysis(), baseProps, emptyParsed, buildDraftReviewContext(), buildDraftReviewPayload(), callAiDraftReview(), readSSEResult(), baseCtxArgs (+1 more)

### Community 59 - "settingsTransfer.js"
Cohesion: 0.36
Nodes (8): collectKeysToExport(), exportSettings(), findHighestVersionKey(), FIXED_KEYS, getAllLocalStorageKeys(), importSettingsFromFile(), importSettingsObject(), VERSIONED_PREFIXES

### Community 60 - "useDynastyStore.test.js"
Cohesion: 0.33
Nodes (3): enriched(), ROSTERS, ROSTERS_B

### Community 62 - "buildAdviceRequestArgs"
Cohesion: 0.15
Nodes (12): Architektur (Ansatz A — lokal im Worker), Datenfluss, Error-Handling, Komponenten, Nicht-Ziele (V1), Problem, Risiken, Season-Simulator (Playoff-/Title-Odds, lokal) — Design (+4 more)

### Community 63 - "SetupPage.test.jsx"
Cohesion: 0.15
Nodes (21): Runs(), Scarcity(), TeamRanking(), Tiers(), DisagreementCard(), TrendList(), AgeProfile(), BENCH_SEGMENTS (+13 more)

### Community 65 - "useDynastyStore.js"
Cohesion: 0.15
Nodes (12): Bestand, der wiederverwendet wird (keine Änderung nötig), Bewusst nicht umgesetzt, Fehlerbehandlung, Kleine, gerechtfertigte Erweiterungen an bestehendem Code, Komponenten, Navigation, Neue reine Logik: `src/services/analysis/waiverStats.js`, Neuer Client-Store (+4 more)

### Community 66 - "tradeValue.js"
Cohesion: 0.17
Nodes (11): File Structure, Global Constraints, Season-Simulator V1 Implementation Plan, Self-Review, Task 1: Sim-Mathematik (`seasonSim.js`), Task 2: Schedule + Playoff-Cutoff (`seasonSchedule.js`), Task 3: Stärken-Berechnung (`seasonStrengths.js`), Task 4: Worker (`simWorker.js`) (+3 more)

### Community 67 - "NextBoard"
Cohesion: 0.14
Nodes (11): draft, ownerLabels, BoardPage(), fetchFfcSpread(), fetchJsonOk(), fetchMarketAdp(), safeStorage, useDynastyStore (+3 more)

### Community 68 - "NextShell.jsx"
Cohesion: 0.22
Nodes (11): App(), useIsWideViewport(), ShareTargetPage(), estimateRounds(), isDraftComplete(), getInitialSharedText(), onSharedText(), ShareReceiver (+3 more)

### Community 70 - "useUIStore.js"
Cohesion: 0.18
Nodes (10): Architektur, Datenfluss, Fehlerverhalten, Markt-Tab: Trending-Kacheln (Sleeper Waiver-Trends) — Design, Neue/geänderte Dateien, Nicht-Ziele, Problem, Styling (+2 more)

### Community 71 - "AppShell.jsx"
Cohesion: 0.47
Nodes (3): callAiDraftStrategy(), readSSEResult(), PAYLOAD

### Community 72 - "DataProvenanceBar.jsx"
Cohesion: 0.42
Nodes (7): ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween(), FORMAT_LABEL, formatMarketAge(), isStale(), MODE_LABEL

### Community 73 - "formatEstimate"
Cohesion: 0.56
Nodes (7): estimateCostUsd(), estimateTokens(), formatEstimate(), formatTokens(), formatUsage(), formatUsd(), PRICING

### Community 74 - "SetupPage.test.jsx"
Cohesion: 0.43
Nodes (7): coolPenalty(), loadCooldown(), markShown(), prioritizeTips(), saveCooldown(), SEV, TYPE_WEIGHTS

### Community 75 - "BoardSection.mismatch.test.jsx"
Cohesion: 0.18
Nodes (14): PickupSuggestions(), POS_ORDER, players, altText(), RecommendedLineupCard(), SLOT_LABEL, SLOT_ORDER, lineup (+6 more)

### Community 78 - "@fontsource/barlow-condensed"
Cohesion: 0.17
Nodes (11): File Map, Global Constraints, Self-Review, Task 1: Dependencies + VAPID-Keys, Task 2: Server Push-Storage + Routen, Task 3: Check-Engine (Warnungen + Nachricht), Task 4: Scheduler-Verdrahtung, Task 5: Service Worker + Build-Integration (+3 more)

### Community 79 - "react-dom"
Cohesion: 0.20
Nodes (9): Architektur, Datenfluss, Design: Web-Push-Benachrichtigungen (PWA, Android), Fehlerfälle / Betrieb, Kontext, Nicht-Ziele, Offene Punkte für den Plan, Testing (+1 more)

### Community 80 - "react-router-dom"
Cohesion: 0.31
Nodes (9): ageModifier(), applyModifier(), avgStarterAge(), detectTeamProfile(), evaluateTrade(), pickModifier(), ROUND_CONFIGS, TIER_NORM (+1 more)

### Community 83 - "enrichBoardWithSleeper.js"
Cohesion: 0.18
Nodes (20): parseFantasyProsCsv(), toNum(), buildNameIndex(), enrichBoardPlayersWithSleeper(), isFresh(), mergePlayer(), primaryPos(), enrichWithInjuries() (+12 more)

## Knowledge Gaps
- **438 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+433 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `Package Dependencies (dev)`, `graphify reference: extra exports and benchmark`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `react` connect `graphify reference: extra exports and benchmark` to `SetupPage.test.jsx`, `tradeValue.js`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `SetupPage.test.jsx` to `aiValidate.js`, `NextBoard`, `formatEstimate`, `formatEstimate`, `graphify reference: extra exports and benchmark`, `useLiveStore`, `tipsPrioritizer.js`, `TradePage.jsx`, `graphify reference: GitHub clone and cross-repo merge`, `DataProvenanceBar.jsx`, `settingsTransfer.js`, `BoardSection.advice-cache.test.jsx`, `SetupPage.test.jsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `p()` (e.g. with `App()` and `TrendList()`) actually correct?**
  _`p()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _438 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11688311688311688 - nodes in this community are weakly interconnected._
- **Should `aiTrade.js` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._