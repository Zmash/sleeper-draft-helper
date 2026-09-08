# Graph Report - sleeper-draft-helper  (2026-09-07)

## Corpus Check
- 202 files · ~211,317 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1065 nodes · 2342 edges · 68 communities (60 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.75)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c9e296a3`
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
- BoardSection.advice-cache.test.jsx
- buildAdviceRequestArgs
- SetupPage.test.jsx
- aiValidate.js
- useDynastyStore.js
- tradeValue.js
- NextBoard

## God Nodes (most connected - your core abstractions)
1. `cx()` - 42 edges
2. `normalizePlayerName()` - 42 edges
3. `normalizePos()` - 36 edges
4. `Icon()` - 33 edges
5. `useSessionStore` - 31 edges
6. `BoardSection()` - 30 edges
7. `fetchJson()` - 27 edges
8. `App()` - 24 edges
9. `useBoardStore` - 23 edges
10. `registerApiRoutes()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `football.html - Canvas Football Animation` --references--> `Sleeper Draft Helper`  [INFERRED]
  public/football.html → README.md
- `BoardSection()` --references--> `react`  [EXTRACTED]
  src/components/BoardSection.jsx → package.json
- `DraftAnalysis()` --references--> `react`  [EXTRACTED]
  src/components/DraftAnalysis.jsx → package.json
- `PlayerSearch()` --indirect_call--> `p()`  [INFERRED]
  src/components/TradeAnalyzer.jsx → src/services/analysis/marketStats.test.js
- `TradeSide()` --indirect_call--> `p()`  [INFERRED]
  src/components/TradeAnalyzer.jsx → src/services/analysis/marketStats.test.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Feature Plan-Spec Pairs** — plan_broadcast_redesign, spec_broadcast_redesign, plan_redraft_flow, spec_redraft_flow, plan_ai_mehrwert, spec_ai_mehrwert [EXTRACTED 0.95]
- **Server Proxy Stack** — concept_express_ai_proxy, concept_anthropic_sdk, concept_deploy_pipeline, concept_sleeper_api [EXTRACTED 0.95]
- **Frontend SPA Stack** — concept_react_vite_spa, concept_zustand_stores, concept_appjsx_orchestrator, concept_capacitor_android [EXTRACTED 0.95]

## Communities (68 total, 8 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.11
Nodes (14): AiResult(), CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), PlayerSearch(), POS_FILTERS, PROFILE_ICONS (+6 more)

### Community 1 - "aiTrade.js"
Cohesion: 0.06
Nodes (67): DraftTab(), Runs(), Scarcity(), TeamRanking(), Tiers(), MarketTab(), AgeProfile(), BENCH_SEGMENTS (+59 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.12
Nodes (20): RootRedirect(), DraftCardInner(), EditableTitle(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard() (+12 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.20
Nodes (19): loadDraftOptionsAction(), loadLeaguesAction(), loadLeagueUsersAction(), loadPicksAction(), resolveUserIdAction(), fetchDraft(), fetchJson(), fetchLeague() (+11 more)

### Community 4 - "Package Dependencies (dev)"
Cohesion: 0.05
Nodes (39): @capacitor/cli, @capacitor/core, concurrently, jsdom, devDependencies, @capacitor/cli, @capacitor/core, concurrently (+31 more)

### Community 5 - "Project Architecture Concepts"
Cohesion: 0.12
Nodes (29): CLAUDE.md Project Instructions, AI-Mehrwert (Live-Advice as Core), Anthropic SDK / Claude Sonnet 5, App.jsx Orchestrator, Broadcast Lower-Third Design System, Capacitor Android Build, Deploy Pipeline (current-symlink), Draft Modes (Redraft vs. Rookie/Dynasty) (+21 more)

### Community 6 - "Package Dependencies (prod)"
Cohesion: 0.06
Nodes (33): @anthropic-ai/sdk, @capacitor/android, cheerio, cors, dotenv, express, @fontsource/barlow, @fontsource/barlow-condensed (+25 more)

### Community 7 - "Roster CSV & Market"
Cohesion: 0.11
Nodes (31): qrSvg(), SyncSection(), applyBundle(), collectBundle(), EXCLUDE_KEYS, EXTRA_KEYS, isBundled(), mergeBundles() (+23 more)

### Community 8 - "aiTrade.js"
Cohesion: 0.16
Nodes (11): MockDraftCard(), attach, navigate, sessionState, setBoardPlayers, setDraftViewAs, setSelectedDraftId, setSelectedLeagueId (+3 more)

### Community 9 - "ApiKeyDialog.jsx"
Cohesion: 0.46
Nodes (7): buildManagerRosters(), loadFcCache(), saveFcCache(), TradePage(), fetchDraftPicks(), fetchTradedPicks(), pickDynastyValue()

### Community 10 - "Server API Routes"
Cohesion: 0.14
Nodes (31): applyPromptCaching(), buildStrategyPrompt(), isValidRoom(), pickToolInput(), prune(), readRoom(), registerApiRoutes(), REVIEW_TOOL (+23 more)

### Community 11 - "DraftAnalysis.jsx"
Cohesion: 0.24
Nodes (15): DraftAnalysis(), baseProps, emptyParsed, estimateCostUsd(), estimateTokens(), formatEstimate(), formatTokens(), formatUsage() (+7 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.20
Nodes (9): Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan, Global Constraints, Nach dem Plan, Task 1: Matching-Logik, Task 2: Persistenz und Migration, Task 3: Server-Route mit Web-Recherche, Task 4: Client für die Strategie-Route, Task 5: UI im SetupForm (+1 more)

### Community 14 - "useLiveStore"
Cohesion: 0.05
Nodes (67): App(), useIsWideViewport(), ProfileBadgeCard(), ProfileEditor(), fpScoringLabel(), SetupForm(), formatSummary(), ProfilesPage() (+59 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.14
Nodes (13): 1. `src/services/marketMerge.js`, 2. `src/stores/useBoardStore.js`, 3. `src/components/BoardSection.jsx`, 4. `src/components/DataProvenanceBar.jsx`, 5. `src/pages/SetupPage.jsx` + `src/components/ImportResultBanner.jsx`, CSV-Board: ADP-Override & Bye-Week-Ergänzung, Datenfluss, Nicht-Ziele (+5 more)

### Community 16 - "TradePage.jsx"
Cohesion: 0.17
Nodes (18): buildAdviceTool(), buildAIAdviceRequest(), buildSystemPrompt(), countBy(), deriveFavAvoid(), findHandcuffs(), groupBy(), inferMySlot() (+10 more)

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.27
Nodes (7): DraftGrid(), posInRound(), draft, ownerLabels, MobileNav(), fetchLeagueRosters(), useLiveStore

### Community 19 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.11
Nodes (18): Analyse-Seite (lokal berechnete Statistiken) — Design, Architektur, Bewusst zurückgestellt (Runde 2), Datenfluss, Die Kennzahlen, Layout, Liga-Kader in allen Ligen, Namen und Navigation (+10 more)

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

### Community 21 - "DataProvenanceBar.jsx"
Cohesion: 0.06
Nodes (47): AppShell(), BoardMobileBar(), SYNC_PRESETS, BoardToolbar(), INTERVALS, ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween() (+39 more)

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
Cohesion: 0.23
Nodes (12): DraftPanel(), FP_PLAYER(), PlayerPanel(), POS_FILTERS, POS_LABEL, RosterPanel(), PlayerDetailSheet(), usePlayerNews() (+4 more)

### Community 40 - "Geräte-Sync — Design"
Cohesion: 0.12
Nodes (15): Abgleich und Konflikte, Absicherung, Bewusst ausgelassen, Bündel, Entscheidung: verschlüsselter Briefkasten, Fehlerfälle, Geräte-Sync — Design, Komponenten (+7 more)

### Community 41 - "formatEstimate"
Cohesion: 0.62
Nodes (4): BoardPage(), useDynastyStore, buildBoardSearch(), parseBoardParams()

### Community 42 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.15
Nodes (12): Anbindung an die bestehenden Prompts, Bewusst nicht enthalten, Client, Datenmodell, Draft-Strategie: Bibliothek + AI-Recherche, Getroffene Entscheidungen, Matching — `src/services/strategyMatch.js`, Recherche-Probelauf (2026-07-25) (+4 more)

### Community 43 - "Dateien"
Cohesion: 0.18
Nodes (10): Dateien, Geräte-Sync Implementation Plan, Global Constraints, Nach dem Plan, Task 1: syncCrypto — Ableitung und Verschlüsselung, Task 2: syncBundle — sammeln und anwenden, Task 3: Server — Briefkasten mit zwei Routen, Task 4: syncClient — Kopplung und Abgleich (+2 more)

### Community 44 - "preferences.js"
Cohesion: 0.21
Nodes (13): TradeAnalyzer(), buildTradeAnalysisRequest(), buildTradeSuggestionsRequest(), deriveLeagueContext(), formatItem(), formatPickSummary(), formatRosterSummary(), SCORING_LABEL (+5 more)

### Community 45 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 46 - "tipsPrioritizer.js"
Cohesion: 0.25
Nodes (6): handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport, setBoardSource, setCsvRawText

### Community 47 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 48 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 49 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 50 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 53 - "enrichBoardWithSleeper.js"
Cohesion: 0.21
Nodes (18): p(), parseFantasyProsCsv(), toNum(), enrichWithInjuries(), fillMissingBye(), MARKET_FIELDS, marketIndex(), mergeMarketFields() (+10 more)

### Community 57 - "SetupPage.test.jsx"
Cohesion: 0.29
Nodes (15): BoardSection(), BoardTable(), deltaAdp(), formatDeltaAdp(), exportBoardAsCsv(), clearPreferencesForMode(), getPreference(), loadLegacyV1() (+7 more)

### Community 58 - "tradeValue.js"
Cohesion: 0.17
Nodes (12): react, react, ApiKeyDialog(), backdropStyle, boxStyle, btnBase, btnDanger, btnGhost (+4 more)

### Community 59 - "settingsTransfer.js"
Cohesion: 0.36
Nodes (8): collectKeysToExport(), exportSettings(), findHighestVersionKey(), FIXED_KEYS, getAllLocalStorageKeys(), importSettingsFromFile(), importSettingsObject(), VERSIONED_PREFIXES

### Community 61 - "BoardSection.advice-cache.test.jsx"
Cohesion: 0.13
Nodes (3): boardPlayers, mocks, boardPlayers

### Community 62 - "buildAdviceRequestArgs"
Cohesion: 0.43
Nodes (7): coolPenalty(), loadCooldown(), markShown(), prioritizeTips(), saveCooldown(), SEV, TYPE_WEIGHTS

### Community 63 - "SetupPage.test.jsx"
Cohesion: 0.23
Nodes (7): EMPTY_STRATEGY, scoringLabel(), StrategySection(), callAiDraftStrategy(), readSSEResult(), PAYLOAD, getOpenAIKey()

### Community 64 - "aiValidate.js"
Cohesion: 0.29
Nodes (8): askAiAdvice(), validateAnthropicKey(), matchAsset(), norm(), avail, validateAdvice(), validateTradeSuggestions(), stripSuffix()

### Community 65 - "useDynastyStore.js"
Cohesion: 0.33
Nodes (9): buildNameIndex(), enrichBoardPlayersWithSleeper(), isFresh(), mergePlayer(), primaryPos(), loadPlayersMetaCached(), pickRelevantPlayers(), SLIM_KEYS (+1 more)

### Community 66 - "tradeValue.js"
Cohesion: 0.27
Nodes (10): ageModifier(), applyModifier(), avgStarterAge(), buildTradeablePlayers(), detectTeamProfile(), evaluateTrade(), pickModifier(), ROUND_CONFIGS (+2 more)

### Community 67 - "NextBoard"
Cohesion: 0.31
Nodes (5): NextBoard(), ADVICE_REQUEST_OPTIONS, buildAdviceRequestArgs(), baseInputs, isAdviceButtonDisabled()

## Knowledge Gaps
- **349 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+344 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `tradeValue.js`, `Package Dependencies (dev)`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `react` connect `tradeValue.js` to `SetupPage.test.jsx`, `DraftAnalysis.jsx`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `SetupPage.test.jsx` to `NextBoard`, `formatEstimate`, `DraftAnalysis.jsx`, `useLiveStore`, `tipsPrioritizer.js`, `TradePage.jsx`, `DataProvenanceBar.jsx`, `enrichBoardWithSleeper.js`, `tradeValue.js`, `settingsTransfer.js`, `BoardSection.advice-cache.test.jsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _349 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11052631578947368 - nodes in this community are weakly interconnected._
- **Should `aiTrade.js` be split into smaller, more focused modules?**
  _Cohesion score 0.055593685655456415 - nodes in this community are weakly interconnected._
- **Should `Trade & Draft Tips Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._