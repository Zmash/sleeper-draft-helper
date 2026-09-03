# Graph Report - sleeper-draft-helper  (2026-09-03)

## Corpus Check
- 178 files · ~174,812 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 919 nodes · 1871 edges · 61 communities (52 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b4401c65`
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
- DraftAnalysis.jsx
- ApiKeyDialog.jsx
- Server API Routes
- Advice Dialog & Modals
- Trade Service & AI
- Dashboard & League Cards
- Mock Draft Card
- tradeValue.js
- Team Rankings: neue lokale Bewertungslogik
- tradeValue.js
- Draft-Strategie: Bibliothek + AI-Recherche
- Global Constraints
- DataProvenanceBar.jsx
- SetupPage.test.jsx
- Global Constraints
- Dashboard Store Tests
- BoardPage.jsx
- Board Store Tests
- Type Definitions
- Year Constants
- Draft Strategies
- Datei-Übersicht
- Setup/Profile-Restrukturierung — Design
- aiCost.js
- Geräte-Sync — Design
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
- useUIStore.js
- CLAUDE.md
- extraction-spec.md
- formatting.js
- DataProvenanceBar.jsx
- AppShell.jsx
- BoardSection.empty.test.jsx
- settingsTransfer.js

## God Nodes (most connected - your core abstractions)
1. `normalizePlayerName()` - 37 edges
2. `BoardSection()` - 28 edges
3. `Icon()` - 27 edges
4. `fetchJson()` - 25 edges
5. `useSessionStore` - 24 edges
6. `App()` - 21 edges
7. `registerApiRoutes()` - 20 edges
8. `deriveFormat()` - 18 edges
9. `TradePage()` - 16 edges
10. `useBoardStore` - 16 edges

## Surprising Connections (you probably didn't know these)
- `football.html - Canvas Football Animation` --references--> `Sleeper Draft Helper`  [INFERRED]
  public/football.html → README.md
- `BoardSection()` --references--> `react`  [EXTRACTED]
  src/components/BoardSection.jsx → package.json
- `Draft Modes (Redraft vs. Rookie/Dynasty)` --references--> `Sleeper Draft Helper`  [EXTRACTED]
  CLAUDE.md → README.md
- `Sleeper Draft Helper` --references--> `Capacitor Android Build`  [EXTRACTED]
  README.md → CLAUDE.md
- `Deploy Pipeline (current-symlink)` --references--> `Express 5 AI Proxy`  [EXTRACTED]
  .github/workflows/deploy.yml → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Feature Plan-Spec Pairs** — plan_broadcast_redesign, spec_broadcast_redesign, plan_redraft_flow, spec_redraft_flow, plan_ai_mehrwert, spec_ai_mehrwert [EXTRACTED 0.95]
- **Server Proxy Stack** — concept_express_ai_proxy, concept_anthropic_sdk, concept_deploy_pipeline, concept_sleeper_api [EXTRACTED 0.95]
- **Frontend SPA Stack** — concept_react_vite_spa, concept_zustand_stores, concept_appjsx_orchestrator, concept_capacitor_android [EXTRACTED 0.95]

## Communities (61 total, 9 thin omitted)

### Community 1 - "aiTrade.js"
Cohesion: 0.22
Nodes (12): buildTradeAnalysisRequest(), buildTradeSuggestionsRequest(), deriveLeagueContext(), formatItem(), formatPickSummary(), formatRosterSummary(), SCORING_LABEL, dynastyLeague (+4 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.07
Nodes (42): fmtPick(), OnTheClockBar(), draft, groupBy(), hashId(), POS, base, roster (+34 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.08
Nodes (51): DraftGrid(), posInRound(), draft, ownerLabels, DynastyRosterGroup(), POS_ORDER, RosterSection(), sortByPos() (+43 more)

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

### Community 9 - "ApiKeyDialog.jsx"
Cohesion: 0.10
Nodes (27): react, react, ApiKeyDialog(), backdropStyle, boxStyle, btnBase, btnDanger, btnGhost (+19 more)

### Community 10 - "Server API Routes"
Cohesion: 0.14
Nodes (31): applyPromptCaching(), buildStrategyPrompt(), isValidRoom(), pickToolInput(), prune(), readRoom(), registerApiRoutes(), REVIEW_TOOL (+23 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.20
Nodes (9): Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan, Global Constraints, Nach dem Plan, Task 1: Matching-Logik, Task 2: Persistenz und Migration, Task 3: Server-Route mit Web-Recherche, Task 4: Client für die Strategie-Route, Task 5: UI im SetupForm (+1 more)

### Community 14 - "Dashboard & League Cards"
Cohesion: 0.16
Nodes (11): AdviceBody(), AdviceDialog(), backdropStyle, bodyScrollStyle, btnGhost, dialogStyle, headRow, preStyle (+3 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.14
Nodes (13): 1. `src/services/marketMerge.js`, 2. `src/stores/useBoardStore.js`, 3. `src/components/BoardSection.jsx`, 4. `src/components/DataProvenanceBar.jsx`, 5. `src/pages/SetupPage.jsx` + `src/components/ImportResultBanner.jsx`, CSV-Board: ADP-Override & Bye-Week-Ergänzung, Datenfluss, Nicht-Ziele (+5 more)

### Community 16 - "tradeValue.js"
Cohesion: 0.31
Nodes (9): ageModifier(), applyModifier(), avgStarterAge(), detectTeamProfile(), evaluateTrade(), pickModifier(), ROUND_CONFIGS, TIER_NORM (+1 more)

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.11
Nodes (15): AiResult(), CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), POS_FILTERS, PROFILE_ICONS, PROFILE_LABELS (+7 more)

### Community 19 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.08
Nodes (28): RootRedirect(), DraftCardInner(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard(), LeagueCardInner() (+20 more)

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

### Community 21 - "DataProvenanceBar.jsx"
Cohesion: 0.24
Nodes (9): BoardToolbar(), INTERVALS, Icon(), MAP, Modal(), ProfileBadgeCard(), fpScoringLabel(), SetupForm() (+1 more)

### Community 22 - "SetupPage.test.jsx"
Cohesion: 0.06
Nodes (62): App(), ImportResultBanner(), stats, ProfileEditor(), formatSummary(), ProfilesPage(), scoringLabel(), canOfferUndo() (+54 more)

### Community 23 - "Global Constraints"
Cohesion: 0.22
Nodes (8): CSV-Board: ADP-Override & Bye-Week-Ergänzung — Implementation Plan, Global Constraints, Task 1: `fillMissingBye`-Funktion in `marketMerge.js`, Task 2: Store-Actions in `useBoardStore.js`, Task 3: `BoardSection.jsx` — korrektes Format an `refreshMarketData` übergeben, Task 4: `DataProvenanceBar.jsx` — ADP-Override-Button für CSV-Boards, Task 5: Bye-Week-Ergänzung im Setup-Import-Banner, Task 6: Vollständige Regression + graphify update

### Community 24 - "Dashboard Store Tests"
Cohesion: 0.33
Nodes (4): LEAGUE_2026, NFL_STATE, REAL_MOCK, STALE_LEAGUE_DRAFT

### Community 25 - "BoardPage.jsx"
Cohesion: 0.12
Nodes (23): initials(), normalizePos(), RosterList(), matchAsset(), norm(), avail, validateAdvice(), validateTradeSuggestions() (+15 more)

### Community 26 - "Board Store Tests"
Cohesion: 0.40
Nodes (3): FC, FFC, SLEEPER

### Community 37 - "Datei-Übersicht"
Cohesion: 0.11
Nodes (17): Datei-Übersicht, Global Constraints, Selbstprüfung (vor Abschluss), Setup/Profile-Restrukturierung Implementation Plan, Task 10: `BoardSection.jsx` — `resolveProfile` + Profil-Hinweis auf dem Board, Task 11: `/profiles`-Seite (Profile-Hub), Task 12: Zahnrad-Menü im Topbar, Task 13: `CLAUDE.md` aktualisieren (+9 more)

### Community 38 - "Setup/Profile-Restrukturierung — Design"
Cohesion: 0.11
Nodes (17): Board-Seite: Profil-Hinweis, Datenmodell, Format-Profil, Icon-Konvention, Komponenten, Migration, Navigation, Nicht-Ziele (+9 more)

### Community 39 - "aiCost.js"
Cohesion: 0.56
Nodes (7): estimateCostUsd(), estimateTokens(), formatEstimate(), formatTokens(), formatUsage(), formatUsd(), PRICING

### Community 40 - "Geräte-Sync — Design"
Cohesion: 0.12
Nodes (15): Abgleich und Konflikte, Absicherung, Bewusst ausgelassen, Bündel, Entscheidung: verschlüsselter Briefkasten, Fehlerfälle, Geräte-Sync — Design, Komponenten (+7 more)

### Community 42 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.15
Nodes (12): Anbindung an die bestehenden Prompts, Bewusst nicht enthalten, Client, Datenmodell, Draft-Strategie: Bibliothek + AI-Recherche, Getroffene Entscheidungen, Matching — `src/services/strategyMatch.js`, Recherche-Probelauf (2026-07-25) (+4 more)

### Community 43 - "Dateien"
Cohesion: 0.18
Nodes (10): Dateien, Geräte-Sync Implementation Plan, Global Constraints, Nach dem Plan, Task 1: syncCrypto — Ableitung und Verschlüsselung, Task 2: syncBundle — sammeln und anwenden, Task 3: Server — Briefkasten mit zwei Routen, Task 4: syncClient — Kopplung und Abgleich (+2 more)

### Community 44 - "preferences.js"
Cohesion: 0.22
Nodes (18): BoardSection(), BoardTable(), deltaAdp(), formatDeltaAdp(), isAdviceButtonDisabled(), exportBoardAsCsv(), clearPreferencesForMode(), getPreference() (+10 more)

### Community 45 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 46 - "tipsPrioritizer.js"
Cohesion: 0.43
Nodes (7): coolPenalty(), loadCooldown(), markShown(), prioritizeTips(), saveCooldown(), SEV, TYPE_WEIGHTS

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

### Community 53 - "useUIStore.js"
Cohesion: 0.33
Nodes (5): validThemeId(), applyTheme(), firstOfKind(), resolveInitialTheme(), THEMES

### Community 57 - "formatting.js"
Cohesion: 0.36
Nodes (6): BoardMobileBar(), SYNC_PRESETS, FiltersRow(), TABS, TabsNav(), cx()

### Community 58 - "DataProvenanceBar.jsx"
Cohesion: 0.42
Nodes (7): ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween(), FORMAT_LABEL, formatMarketAge(), isStale(), MODE_LABEL

### Community 60 - "AppShell.jsx"
Cohesion: 0.36
Nodes (5): AppShell(), Footer(), sevClass(), TipsDock(), Topbar()

### Community 61 - "BoardSection.empty.test.jsx"
Cohesion: 0.25
Nodes (6): handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport, setBoardSource, setCsvRawText

### Community 62 - "settingsTransfer.js"
Cohesion: 0.43
Nodes (6): collectKeysToExport(), findHighestVersionKey(), FIXED_KEYS, getAllLocalStorageKeys(), importSettingsObject(), VERSIONED_PREFIXES

## Knowledge Gaps
- **301 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+296 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `ApiKeyDialog.jsx`, `Package Dependencies (dev)`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `react` connect `ApiKeyDialog.jsx` to `preferences.js`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `preferences.js` to `Board & Draft Components`, `Trade & Draft Tips Hooks`, `App Core & Analysis`, `aiCost.js`, `DraftAnalysis.jsx`, `ApiKeyDialog.jsx`, `SetupPage.test.jsx`, `formatting.js`, `BoardSection.empty.test.jsx`, `BoardSection.advice-cache.test.jsx`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _301 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Trade & Draft Tips Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.07130333138515488 - nodes in this community are weakly interconnected._
- **Should `App Core & Analysis` be split into smaller, more focused modules?**
  _Cohesion score 0.0770735524256651 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies (dev)` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._