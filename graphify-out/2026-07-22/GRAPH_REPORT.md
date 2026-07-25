# Graph Report - sleeper-draft-helper  (2026-07-22)

## Corpus Check
- 148 files · ~119,855 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 651 nodes · 1384 edges · 35 communities (32 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `342d1f1a`
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
- aiCost.js
- Global Constraints
- DataProvenanceBar.jsx
- SetupPage.test.jsx
- Dashboard Store Tests
- Board Store Tests
- Type Definitions
- Year Constants
- Draft Strategies

## God Nodes (most connected - your core abstractions)
1. `normalizePlayerName()` - 38 edges
2. `BoardSection()` - 23 edges
3. `fetchJson()` - 23 edges
4. `Icon()` - 21 edges
5. `useSessionStore` - 21 edges
6. `App()` - 19 edges
7. `TradePage()` - 16 edges
8. `deriveFormat()` - 16 edges
9. `useBoardStore` - 15 edges
10. `registerApiRoutes()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `football.html - Canvas Football Animation` --references--> `Sleeper Draft Helper`  [INFERRED]
  public/football.html → README.md
- `BoardSection()` --references--> `react`  [EXTRACTED]
  src/components/BoardSection.jsx → package.json
- `DraftAnalysis()` --references--> `react`  [EXTRACTED]
  src/components/DraftAnalysis.jsx → package.json
- `CLAUDE.md Project Instructions` --references--> `Graphify (Knowledge Graph Tool)`  [EXTRACTED]
  CLAUDE.md → .claude/skills/graphify/SKILL.md
- `Draft Modes (Redraft vs. Rookie/Dynasty)` --references--> `Sleeper Draft Helper`  [EXTRACTED]
  CLAUDE.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Pipeline Steps** — skills_graphify_skill_md, skills_graphify_extraction_spec, skills_graphify_query, skills_graphify_update, skills_graphify_add_watch, skills_graphify_exports, skills_graphify_transcribe, skills_graphify_github_merge, skills_graphify_hooks [EXTRACTED 0.95]
- **Feature Plan-Spec Pairs** — plan_broadcast_redesign, spec_broadcast_redesign, plan_redraft_flow, spec_redraft_flow, plan_ai_mehrwert, spec_ai_mehrwert [EXTRACTED 0.95]
- **Server Proxy Stack** — concept_express_ai_proxy, concept_anthropic_sdk, concept_deploy_pipeline, concept_sleeper_api [EXTRACTED 0.95]
- **Frontend SPA Stack** — concept_react_vite_spa, concept_zustand_stores, concept_appjsx_orchestrator, concept_capacitor_android [EXTRACTED 0.95]

## Communities (35 total, 3 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.06
Nodes (47): BoardMobileBar(), sevClass(), SYNC_PRESETS, BoardSection(), handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport (+39 more)

### Community 1 - "Core Pages & Actions"
Cohesion: 0.13
Nodes (33): buildManagerRosters(), loadFcCache(), saveFcCache(), TradePage(), loadDraftOptionsAction(), loadLeaguesAction(), loadLeagueUsersAction(), loadPicksAction() (+25 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.07
Nodes (42): fmtPick(), OnTheClockBar(), draft, groupBy(), hashId(), POS, base, roster (+34 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.09
Nodes (41): App(), RootRedirect(), Modal(), fpScoringLabel(), SetupForm(), BoardPage(), RosterPage(), canOfferUndo() (+33 more)

### Community 4 - "Package Dependencies (dev)"
Cohesion: 0.05
Nodes (39): @capacitor/cli, @capacitor/core, concurrently, jsdom, devDependencies, @capacitor/cli, @capacitor/core, concurrently (+31 more)

### Community 5 - "Project Architecture Concepts"
Cohesion: 0.08
Nodes (40): Graphify Trigger (CLAUDE.md), CLAUDE.md Project Instructions, AI-Mehrwert (Live-Advice as Core), Anthropic SDK / Claude Sonnet 5, App.jsx Orchestrator, Broadcast Lower-Third Design System, Capacitor Android Build, Deploy Pipeline (current-symlink) (+32 more)

### Community 6 - "Package Dependencies (prod)"
Cohesion: 0.06
Nodes (31): @anthropic-ai/sdk, @capacitor/android, cheerio, cors, dotenv, express, @fontsource/barlow, @fontsource/barlow-condensed (+23 more)

### Community 7 - "Roster CSV & Market"
Cohesion: 0.27
Nodes (7): initials(), normalizePos(), RosterList(), DynastyRosterGroup(), POS_ORDER, RosterSection(), sortByPos()

### Community 8 - "React UI Components"
Cohesion: 0.18
Nodes (12): react, react, ApiKeyDialog(), backdropStyle, boxStyle, btnBase, btnDanger, btnGhost (+4 more)

### Community 9 - "App Shell & Navigation"
Cohesion: 0.15
Nodes (11): AppShell(), Footer(), ThemeSelect(), sevClass(), TipsDock(), Topbar(), validThemeId(), applyTheme() (+3 more)

### Community 10 - "Server API Routes"
Cohesion: 0.11
Nodes (35): applyPromptCaching(), registerApiRoutes(), REVIEW_TOOL, sendSSE(), setSSEHeaders(), app, app, __dirname (+27 more)

### Community 11 - "Trade Analyzer UI"
Cohesion: 0.11
Nodes (12): AiResult(), CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), POS_FILTERS, PROFILE_ICONS, PROFILE_LABELS (+4 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.38
Nodes (9): DraftAnalysis(), baseProps, emptyParsed, buildDraftReviewContext(), buildDraftReviewPayload(), callAiDraftReview(), readSSEResult(), baseCtxArgs (+1 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.15
Nodes (17): capDelta(), clamp(), computeTeamScores(), estimateRounds(), fillLineup(), isDraftComplete(), lateRoundWeight(), lineupSlots() (+9 more)

### Community 14 - "Dashboard & League Cards"
Cohesion: 0.16
Nodes (11): AdviceBody(), AdviceDialog(), backdropStyle, bodyScrollStyle, btnGhost, dialogStyle, headRow, preStyle (+3 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.07
Nodes (25): DraftCardInner(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard(), LeagueCardInner(), LeagueCardSkeleton() (+17 more)

### Community 16 - "Icon & Utility Components"
Cohesion: 0.21
Nodes (13): TradeAnalyzer(), buildTradeAnalysisRequest(), buildTradeSuggestionsRequest(), deriveLeagueContext(), formatItem(), formatPickSummary(), formatRosterSummary(), SCORING_LABEL (+5 more)

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.17
Nodes (16): matchAsset(), norm(), avail, validateAdvice(), validateTradeSuggestions(), ageModifier(), applyModifier(), avgStarterAge() (+8 more)

### Community 19 - "aiCost.js"
Cohesion: 0.56
Nodes (7): estimateCostUsd(), estimateTokens(), formatEstimate(), formatTokens(), formatUsage(), formatUsd(), PRICING

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
- **176 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+171 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `React UI Components`, `Package Dependencies (dev)`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Why does `react` connect `React UI Components` to `Board & Draft Components`, `Advice Dialog & Modals`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `Board & Draft Components` to `React UI Components`, `App Core & Analysis`, `Trade & Draft Tips Hooks`, `aiCost.js`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _176 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.055135135135135134 - nodes in this community are weakly interconnected._
- **Should `Core Pages & Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.12560975609756098 - nodes in this community are weakly interconnected._
- **Should `Trade & Draft Tips Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.07130333138515488 - nodes in this community are weakly interconnected._