# Graph Report - csv-adp-bye-override  (2026-08-28)

## Corpus Check
- 158 files · ~144,825 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 782 nodes · 1659 edges · 36 communities (33 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f08490be`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Board & Draft Components
- Core Pages & Actions
- Trade & Draft Tips Hooks
- App Core & Analysis
- Package Dependencies (dev)
- Project Architecture Concepts
- Package Dependencies (prod)
- Roster CSV & Market
- React UI Components
- App Shell & Navigation
- Server API Routes
- Trade Analyzer UI
- Advice Dialog & Modals
- Trade Service & AI
- Dashboard & League Cards
- Mock Draft Card
- Icon & Utility Components
- Team Rankings: neue lokale Bewertungslogik
- tradeValue.js
- Draft-Strategie: Bibliothek + AI-Recherche
- Global Constraints
- DataProvenanceBar.jsx
- SetupPage.test.jsx
- Global Constraints
- Dashboard Store Tests
- Board Store Tests
- Type Definitions
- Year Constants
- Draft Strategies

## God Nodes (most connected - your core abstractions)
1. `normalizePlayerName()` - 37 edges
2. `BoardSection()` - 30 edges
3. `useSessionStore` - 24 edges
4. `Icon()` - 23 edges
5. `fetchJson()` - 23 edges
6. `registerApiRoutes()` - 20 edges
7. `App()` - 19 edges
8. `deriveFormat()` - 17 edges
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

## Communities (36 total, 3 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.06
Nodes (45): BoardMobileBar(), sevClass(), SYNC_PRESETS, BoardSection(), handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport (+37 more)

### Community 1 - "Core Pages & Actions"
Cohesion: 0.11
Nodes (27): initials(), normalizePos(), RosterList(), DynastyRosterGroup(), POS_ORDER, RosterSection(), sortByPos(), parseFantasyProsCsv() (+19 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.07
Nodes (44): fmtPick(), OnTheClockBar(), draft, AvailablePicks(), groupBy(), hashId(), POS, base (+36 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.06
Nodes (71): App(), RootRedirect(), DraftCardInner(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard() (+63 more)

### Community 4 - "Package Dependencies (dev)"
Cohesion: 0.05
Nodes (39): @capacitor/cli, @capacitor/core, concurrently, devDependencies, @capacitor/cli, @capacitor/core, concurrently, jsdom (+31 more)

### Community 5 - "Project Architecture Concepts"
Cohesion: 0.12
Nodes (29): CLAUDE.md Project Instructions, AI-Mehrwert (Live-Advice as Core), Anthropic SDK / Claude Sonnet 5, App.jsx Orchestrator, Broadcast Lower-Third Design System, Capacitor Android Build, Deploy Pipeline (current-symlink), Draft Modes (Redraft vs. Rookie/Dynasty) (+21 more)

### Community 6 - "Package Dependencies (prod)"
Cohesion: 0.06
Nodes (33): @anthropic-ai/sdk, @capacitor/android, cheerio, cors, dotenv, express, dependencies, @anthropic-ai/sdk (+25 more)

### Community 7 - "Roster CSV & Market"
Cohesion: 0.11
Nodes (31): qrSvg(), SyncSection(), applyBundle(), collectBundle(), EXCLUDE_KEYS, EXTRA_KEYS, isBundled(), mergeBundles() (+23 more)

### Community 8 - "React UI Components"
Cohesion: 0.18
Nodes (16): scoringLabel(), StrategySection(), deviationsBetween(), makeFingerprint(), pickStrategy(), resolveStrategyText(), sameStarters(), FORMAT (+8 more)

### Community 9 - "App Shell & Navigation"
Cohesion: 0.15
Nodes (11): AppShell(), Footer(), ThemeSelect(), sevClass(), TipsDock(), Topbar(), validThemeId(), applyTheme() (+3 more)

### Community 10 - "Server API Routes"
Cohesion: 0.14
Nodes (31): applyPromptCaching(), buildStrategyPrompt(), isValidRoom(), pickToolInput(), prune(), readRoom(), registerApiRoutes(), REVIEW_TOOL (+23 more)

### Community 11 - "Trade Analyzer UI"
Cohesion: 0.10
Nodes (23): ImportResultBanner(), stats, Modal(), fpScoringLabel(), SetupForm(), canOfferUndo(), FC, FFC (+15 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.12
Nodes (15): Abgleich und Konflikte, Absicherung, Bewusst ausgelassen, Bündel, Entscheidung: verschlüsselter Briefkasten, Fehlerfälle, Geräte-Sync — Design, Komponenten (+7 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.20
Nodes (9): Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan, Global Constraints, Nach dem Plan, Task 1: Matching-Logik, Task 2: Persistenz und Migration, Task 3: Server-Route mit Web-Recherche, Task 4: Client für die Strategie-Route, Task 5: UI im SetupForm (+1 more)

### Community 14 - "Dashboard & League Cards"
Cohesion: 0.06
Nodes (44): react, react, AdviceBody(), AdviceDialog(), backdropStyle, bodyScrollStyle, btnGhost, dialogStyle (+36 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.14
Nodes (13): 1. `src/services/marketMerge.js`, 2. `src/stores/useBoardStore.js`, 3. `src/components/BoardSection.jsx`, 4. `src/components/DataProvenanceBar.jsx`, 5. `src/pages/SetupPage.jsx` + `src/components/ImportResultBanner.jsx`, CSV-Board: ADP-Override & Bye-Week-Ergänzung, Datenfluss, Nicht-Ziele (+5 more)

### Community 16 - "Icon & Utility Components"
Cohesion: 0.18
Nodes (8): MockDraftCard(), attach, navigate, setBoardPlayers, setSelectedDraftId, setSelectedLeagueId, REAL_DRAFT, parseDraftId()

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.07
Nodes (40): CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), POS_FILTERS, PROFILE_ICONS, PROFILE_LABELS, TIER_LABELS (+32 more)

### Community 19 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.15
Nodes (12): Anbindung an die bestehenden Prompts, Bewusst nicht enthalten, Client, Datenmodell, Draft-Strategie: Bibliothek + AI-Recherche, Getroffene Entscheidungen, Matching — `src/services/strategyMatch.js`, Recherche-Probelauf (2026-07-25) (+4 more)

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

### Community 21 - "DataProvenanceBar.jsx"
Cohesion: 0.42
Nodes (7): ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween(), FORMAT_LABEL, formatMarketAge(), isStale(), MODE_LABEL

### Community 22 - "SetupPage.test.jsx"
Cohesion: 0.18
Nodes (10): Dateien, Geräte-Sync Implementation Plan, Global Constraints, Nach dem Plan, Task 1: syncCrypto — Ableitung und Verschlüsselung, Task 2: syncBundle — sammeln und anwenden, Task 3: Server — Briefkasten mit zwei Routen, Task 4: syncClient — Kopplung und Abgleich (+2 more)

### Community 23 - "Global Constraints"
Cohesion: 0.22
Nodes (8): CSV-Board: ADP-Override & Bye-Week-Ergänzung — Implementation Plan, Global Constraints, Task 1: `fillMissingBye`-Funktion in `marketMerge.js`, Task 2: Store-Actions in `useBoardStore.js`, Task 3: `BoardSection.jsx` — korrektes Format an `refreshMarketData` übergeben, Task 4: `DataProvenanceBar.jsx` — ADP-Override-Button für CSV-Boards, Task 5: Bye-Week-Ergänzung im Setup-Import-Banner, Task 6: Vollständige Regression + graphify update

### Community 24 - "Dashboard Store Tests"
Cohesion: 0.33
Nodes (4): LEAGUE_2026, NFL_STATE, REAL_MOCK, STALE_LEAGUE_DRAFT

### Community 26 - "Board Store Tests"
Cohesion: 0.40
Nodes (3): FC, FFC, SLEEPER

## Knowledge Gaps
- **225 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+220 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `Package Dependencies (dev)`, `Dashboard & League Cards`?**
  _High betweenness centrality (0.138) - this node is a cross-community bridge._
- **Why does `react` connect `Dashboard & League Cards` to `Board & Draft Components`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `Board & Draft Components` to `Trade & Draft Tips Hooks`, `App Core & Analysis`, `React UI Components`, `Trade Analyzer UI`, `Dashboard & League Cards`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _225 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06169772256728778 - nodes in this community are weakly interconnected._
- **Should `Core Pages & Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.10960960960960961 - nodes in this community are weakly interconnected._
- **Should `Trade & Draft Tips Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.06949152542372881 - nodes in this community are weakly interconnected._