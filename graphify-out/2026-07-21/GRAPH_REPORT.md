# Graph Report - sleeper-draft-helper  (2026-07-21)

## Corpus Check
- 148 files · ~117,335 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 650 nodes · 1378 edges · 33 communities (30 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa43fb98`
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
- Dashboard Store Tests
- Board Store Tests
- Type Definitions
- Year Constants
- Draft Strategies

## God Nodes (most connected - your core abstractions)
1. `normalizePlayerName()` - 38 edges
2. `BoardSection()` - 23 edges
3. `fetchJson()` - 23 edges
4. `useSessionStore` - 21 edges
5. `App()` - 19 edges
6. `Icon()` - 19 edges
7. `TradePage()` - 16 edges
8. `deriveFormat()` - 16 edges
9. `useBoardStore` - 15 edges
10. `registerApiRoutes()` - 14 edges

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

## Communities (33 total, 3 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.06
Nodes (38): BoardMobileBar(), sevClass(), SYNC_PRESETS, BoardSection(), handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport (+30 more)

### Community 1 - "Core Pages & Actions"
Cohesion: 0.06
Nodes (61): RootRedirect(), DraftCardInner(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard(), LeagueCardInner() (+53 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.08
Nodes (34): fmtPick(), OnTheClockBar(), draft, groupBy(), hashId(), POS, base, roster (+26 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.10
Nodes (26): App(), Modal(), fpScoringLabel(), SetupForm(), canOfferUndo(), SetupPage(), FC, FFC (+18 more)

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
Cohesion: 0.11
Nodes (27): initials(), normalizePos(), RosterList(), matchAsset(), norm(), avail, validateAdvice(), validateTradeSuggestions() (+19 more)

### Community 8 - "React UI Components"
Cohesion: 0.15
Nodes (21): react, react, ApiKeyDialog(), backdropStyle, boxStyle, btnBase, btnDanger, btnGhost (+13 more)

### Community 9 - "App Shell & Navigation"
Cohesion: 0.11
Nodes (19): AppShell(), ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween(), FORMAT_LABEL, formatMarketAge(), isStale(), MODE_LABEL (+11 more)

### Community 10 - "Server API Routes"
Cohesion: 0.19
Nodes (20): applyPromptCaching(), registerApiRoutes(), REVIEW_TOOL, sendSSE(), setSSEHeaders(), app, app, __dirname (+12 more)

### Community 11 - "Trade Analyzer UI"
Cohesion: 0.11
Nodes (16): AiResult(), CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), POS_FILTERS, PROFILE_ICONS, PROFILE_LABELS (+8 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.14
Nodes (21): ADVICE_REQUEST_OPTIONS, buildAdviceRequestArgs(), baseInputs, buildAdviceTool(), buildAIAdviceRequest(), buildSystemPrompt(), countBy(), deriveFavAvoid() (+13 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.15
Nodes (17): capDelta(), clamp(), computeTeamScores(), estimateRounds(), fillLineup(), isDraftComplete(), lateRoundWeight(), lineupSlots() (+9 more)

### Community 14 - "Dashboard & League Cards"
Cohesion: 0.16
Nodes (11): AdviceBody(), AdviceDialog(), backdropStyle, bodyScrollStyle, btnGhost, dialogStyle, headRow, preStyle (+3 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.18
Nodes (8): MockDraftCard(), attach, navigate, setBoardPlayers, setSelectedDraftId, setSelectedLeagueId, REAL_DRAFT, parseDraftId()

### Community 16 - "Icon & Utility Components"
Cohesion: 0.22
Nodes (12): buildTradeAnalysisRequest(), buildTradeSuggestionsRequest(), deriveLeagueContext(), formatItem(), formatPickSummary(), formatRosterSummary(), SCORING_LABEL, dynastyLeague (+4 more)

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.31
Nodes (9): ageModifier(), applyModifier(), avgStarterAge(), detectTeamProfile(), evaluateTrade(), pickModifier(), ROUND_CONFIGS, TIER_NORM (+1 more)

### Community 19 - "aiCost.js"
Cohesion: 0.56
Nodes (7): estimateCostUsd(), estimateTokens(), formatEstimate(), formatTokens(), formatUsage(), formatUsd(), PRICING

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

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
- **Why does `react` connect `React UI Components` to `Board & Draft Components`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.169) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `Board & Draft Components` to `Core Pages & Actions`, `App Core & Analysis`, `React UI Components`, `Advice Dialog & Modals`, `aiCost.js`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _176 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.06440677966101695 - nodes in this community are weakly interconnected._
- **Should `Core Pages & Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.06288568909785483 - nodes in this community are weakly interconnected._
- **Should `Trade & Draft Tips Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.08069381598793364 - nodes in this community are weakly interconnected._