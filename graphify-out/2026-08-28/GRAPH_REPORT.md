# Graph Report - sleeper-draft-helper  (2026-08-24)

## Corpus Check
- 167 files · ~142,561 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 769 nodes · 1642 edges · 34 communities (31 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.7)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad0ffaaf`
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
- Global Constraints
- DataProvenanceBar.jsx
- SetupPage.test.jsx
- Dashboard Store Tests
- Board Store Tests
- Type Definitions
- Year Constants
- Draft Strategies

## God Nodes (most connected - your core abstractions)
1. `normalizePlayerName()` - 36 edges
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
- `CLAUDE.md Project Instructions` --references--> `Graphify (Knowledge Graph Tool)`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `Draft Modes (Redraft vs. Rookie/Dynasty)` --references--> `Sleeper Draft Helper`  [EXTRACTED]
  CLAUDE.md → README.md
- `Sleeper Draft Helper` --references--> `Capacitor Android Build`  [EXTRACTED]
  README.md → CLAUDE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Pipeline Steps** — skills_graphify_skill_md, skills_graphify_extraction_spec, skills_graphify_query, skills_graphify_update, skills_graphify_add_watch, skills_graphify_exports, skills_graphify_transcribe, skills_graphify_github_merge, skills_graphify_hooks [EXTRACTED 0.95]
- **Feature Plan-Spec Pairs** — plan_broadcast_redesign, spec_broadcast_redesign, plan_redraft_flow, spec_redraft_flow, plan_ai_mehrwert, spec_ai_mehrwert [EXTRACTED 0.95]
- **Server Proxy Stack** — concept_express_ai_proxy, concept_anthropic_sdk, concept_deploy_pipeline, concept_sleeper_api [EXTRACTED 0.95]
- **Frontend SPA Stack** — concept_react_vite_spa, concept_zustand_stores, concept_appjsx_orchestrator, concept_capacitor_android [EXTRACTED 0.95]

## Communities (34 total, 3 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.06
Nodes (46): BoardMobileBar(), sevClass(), SYNC_PRESETS, BoardSection(), handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport (+38 more)

### Community 1 - "Core Pages & Actions"
Cohesion: 0.10
Nodes (40): PickForm(), buildManagerRosters(), loadFcCache(), saveFcCache(), TradePage(), loadDraftOptionsAction(), loadLeaguesAction(), loadLeagueUsersAction() (+32 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.07
Nodes (44): fmtPick(), OnTheClockBar(), draft, AvailablePicks(), groupBy(), hashId(), POS, base (+36 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.06
Nodes (53): App(), RootRedirect(), DraftCardInner(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard() (+45 more)

### Community 4 - "Package Dependencies (dev)"
Cohesion: 0.05
Nodes (39): @capacitor/cli, @capacitor/core, concurrently, jsdom, devDependencies, @capacitor/cli, @capacitor/core, concurrently (+31 more)

### Community 5 - "Project Architecture Concepts"
Cohesion: 0.08
Nodes (40): Graphify Trigger (CLAUDE.md), CLAUDE.md Project Instructions, AI-Mehrwert (Live-Advice as Core), Anthropic SDK / Claude Sonnet 5, App.jsx Orchestrator, Broadcast Lower-Third Design System, Capacitor Android Build, Deploy Pipeline (current-symlink) (+32 more)

### Community 6 - "Package Dependencies (prod)"
Cohesion: 0.06
Nodes (33): @anthropic-ai/sdk, @capacitor/android, cheerio, cors, dotenv, express, @fontsource/barlow, @fontsource/barlow-condensed (+25 more)

### Community 7 - "Roster CSV & Market"
Cohesion: 0.10
Nodes (31): qrSvg(), SyncSection(), applyBundle(), collectBundle(), EXCLUDE_KEYS, EXTRA_KEYS, isBundled(), mergeBundles() (+23 more)

### Community 8 - "React UI Components"
Cohesion: 0.19
Nodes (16): scoringLabel(), StrategySection(), deviationsBetween(), makeFingerprint(), pickStrategy(), resolveStrategyText(), sameStarters(), FORMAT (+8 more)

### Community 9 - "App Shell & Navigation"
Cohesion: 0.15
Nodes (11): AppShell(), Footer(), ThemeSelect(), sevClass(), TipsDock(), Topbar(), validThemeId(), applyTheme() (+3 more)

### Community 10 - "Server API Routes"
Cohesion: 0.14
Nodes (31): applyPromptCaching(), buildStrategyPrompt(), isValidRoom(), pickToolInput(), prune(), readRoom(), registerApiRoutes(), REVIEW_TOOL (+23 more)

### Community 11 - "Trade Analyzer UI"
Cohesion: 0.10
Nodes (27): fpScoringLabel(), SetupForm(), buildTradeAnalysisRequest(), buildTradeSuggestionsRequest(), deriveLeagueContext(), formatItem(), formatPickSummary(), formatRosterSummary() (+19 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.15
Nodes (12): Anbindung an die bestehenden Prompts, Bewusst nicht enthalten, Client, Datenmodell, Draft-Strategie: Bibliothek + AI-Recherche, Getroffene Entscheidungen, Matching — `src/services/strategyMatch.js`, Recherche-Probelauf (2026-07-25) (+4 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.20
Nodes (9): Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan, Global Constraints, Nach dem Plan, Task 1: Matching-Logik, Task 2: Persistenz und Migration, Task 3: Server-Route mit Web-Recherche, Task 4: Client für die Strategie-Route, Task 5: UI im SetupForm (+1 more)

### Community 14 - "Dashboard & League Cards"
Cohesion: 0.06
Nodes (44): react, react, AdviceBody(), AdviceDialog(), backdropStyle, bodyScrollStyle, btnGhost, dialogStyle (+36 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.12
Nodes (15): Abgleich und Konflikte, Absicherung, Bewusst ausgelassen, Bündel, Entscheidung: verschlüsselter Briefkasten, Fehlerfälle, Geräte-Sync — Design, Komponenten (+7 more)

### Community 16 - "Icon & Utility Components"
Cohesion: 0.18
Nodes (10): Dateien, Geräte-Sync Implementation Plan, Global Constraints, Nach dem Plan, Task 1: syncCrypto — Ableitung und Verschlüsselung, Task 2: syncBundle — sammeln und anwenden, Task 3: Server — Briefkasten mit zwei Routen, Task 4: syncClient — Kopplung und Abgleich (+2 more)

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.06
Nodes (44): initials(), normalizePos(), RosterList(), DynastyRosterGroup(), POS_ORDER, RosterSection(), sortByPos(), CURRENT_YEAR (+36 more)

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

### Community 21 - "DataProvenanceBar.jsx"
Cohesion: 0.42
Nodes (7): ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween(), FORMAT_LABEL, formatMarketAge(), isStale(), MODE_LABEL

### Community 22 - "SetupPage.test.jsx"
Cohesion: 0.40
Nodes (3): FC, FFC, setup()

### Community 24 - "Dashboard Store Tests"
Cohesion: 0.33
Nodes (4): LEAGUE_2026, NFL_STATE, REAL_MOCK, STALE_LEAGUE_DRAFT

### Community 26 - "Board Store Tests"
Cohesion: 0.40
Nodes (3): FC, FFC, SLEEPER

## Knowledge Gaps
- **217 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+212 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `Package Dependencies (dev)`, `Dashboard & League Cards`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `react` connect `Dashboard & League Cards` to `Board & Draft Components`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `Board & Draft Components` to `Trade & Draft Tips Hooks`, `App Core & Analysis`, `React UI Components`, `Trade Analyzer UI`, `Dashboard & League Cards`?**
  _High betweenness centrality (0.093) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _217 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.05712050078247261 - nodes in this community are weakly interconnected._
- **Should `Core Pages & Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.10204081632653061 - nodes in this community are weakly interconnected._
- **Should `Trade & Draft Tips Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.06949152542372881 - nodes in this community are weakly interconnected._