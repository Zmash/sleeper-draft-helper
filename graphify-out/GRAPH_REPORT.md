# Graph Report - sleeper-draft-helper  (2026-09-12)

## Corpus Check
- 251 files · ~261,035 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1354 nodes · 3122 edges · 93 communities (82 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c43aa708`
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
- BoardSection.test.jsx
- ImportResultBanner.jsx
- @fontsource/barlow-condensed
- react-dom
- react-router-dom
- zustand
- SetupPage.test.jsx
- enrichBoardWithSleeper.js
- BoardTable.jsx
- SetupPage.test.jsx
- @capacitor/android
- cors
- @fontsource/jetbrains-mono
- lucide-react
- prop-types
- qrcode-generator

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
- `TradeSide()` --indirect_call--> `p()`  [INFERRED]
  src/components/TradeAnalyzer.jsx → src/services/analysis/marketStats.test.js
- `defaultDeps()` --indirect_call--> `enriched()`  [INFERRED]
  src/server/lineupCheck.js → src/stores/useDynastyStore.test.js
- `Draft Modes (Redraft vs. Rookie/Dynasty)` --references--> `Sleeper Draft Helper`  [EXTRACTED]
  CLAUDE.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Feature Plan-Spec Pairs** — plan_broadcast_redesign, spec_broadcast_redesign, plan_redraft_flow, spec_redraft_flow, plan_ai_mehrwert, spec_ai_mehrwert [EXTRACTED 0.95]
- **Server Proxy Stack** — concept_express_ai_proxy, concept_anthropic_sdk, concept_deploy_pipeline, concept_sleeper_api [EXTRACTED 0.95]
- **Frontend SPA Stack** — concept_react_vite_spa, concept_zustand_stores, concept_appjsx_orchestrator, concept_capacitor_android [EXTRACTED 0.95]

## Communities (93 total, 11 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.11
Nodes (16): AiResult(), CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), PlayerSearch(), POS_FILTERS, PROFILE_ICONS (+8 more)

### Community 1 - "aiTrade.js"
Cohesion: 0.08
Nodes (38): fmtPick(), OnTheClockBar(), draft, groupBy(), hashId(), POS, base, roster (+30 more)

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.12
Nodes (21): RootRedirect(), DraftCardInner(), EditableTitle(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard() (+13 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.13
Nodes (35): AnalysisPage(), TABS, ecrByName(), FLEX_FRACTION_LABELS, FLEX_SLOTS, formatComposition(), formatFlexShare(), pickName() (+27 more)

### Community 4 - "Package Dependencies (dev)"
Cohesion: 0.08
Nodes (25): @capacitor/cli, @capacitor/core, concurrently, jsdom, devDependencies, @capacitor/cli, @capacitor/core, concurrently (+17 more)

### Community 5 - "Project Architecture Concepts"
Cohesion: 0.12
Nodes (29): CLAUDE.md Project Instructions, AI-Mehrwert (Live-Advice as Core), Anthropic SDK / Claude Sonnet 5, App.jsx Orchestrator, Broadcast Lower-Third Design System, Capacitor Android Build, Deploy Pipeline (current-symlink), Draft Modes (Redraft vs. Rookie/Dynasty) (+21 more)

### Community 6 - "Package Dependencies (prod)"
Cohesion: 0.08
Nodes (25): @2toad/profanity, @anthropic-ai/sdk, cheerio, dotenv, express, @fontsource/barlow-condensed, node-cron, dependencies (+17 more)

### Community 7 - "Roster CSV & Market"
Cohesion: 0.11
Nodes (31): qrSvg(), SyncSection(), applyBundle(), collectBundle(), EXCLUDE_KEYS, EXTRA_KEYS, isBundled(), mergeBundles() (+23 more)

### Community 8 - "aiTrade.js"
Cohesion: 0.09
Nodes (29): AppShell(), Footer(), MobileDraftSwitch(), Modal(), CommandPalette(), DraftSwitcher(), NextShell(), RAIL (+21 more)

### Community 9 - "ApiKeyDialog.jsx"
Cohesion: 0.11
Nodes (17): Datei-Überblick, Global Constraints, Self-Review (durchgeführt), Task 10: `PickupSuggestions.jsx`, Task 11: `StreamingBoard.jsx`, Task 12: `RecommendedLineupCard.jsx`, Task 13: `WaiverPage.jsx` + Routing/Nav-Integration + finale Verifikation, Task 1: FantasyPros-Positions-URL-Builder + Normalizer-Erweiterung (+9 more)

### Community 10 - "Server API Routes"
Cohesion: 0.12
Nodes (27): addScore(), applyPromptCaching(), buildStrategyPrompt(), checkScoreRateLimit(), isProfaneName(), isValidRoom(), isValidScoreEntry(), isValidScoreName() (+19 more)

### Community 11 - "DraftAnalysis.jsx"
Cohesion: 0.16
Nodes (17): fmtPct(), fmtRating(), fmtRecord(), heat(), OddsTable(), SeasonTab(), doneSim, runInline() (+9 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.19
Nodes (18): buildManagerRosters(), loadFcCache(), saveFcCache(), TradePage(), fetchDraft(), fetchDraftPicks(), fetchLeagueRosters(), fetchLeagueUsers() (+10 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.20
Nodes (9): Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan, Global Constraints, Nach dem Plan, Task 1: Matching-Logik, Task 2: Persistenz und Migration, Task 3: Server-Route mit Web-Recherche, Task 4: Client für die Strategie-Route, Task 5: UI im SetupForm (+1 more)

### Community 14 - "useLiveStore"
Cohesion: 0.18
Nodes (27): ProfileEditor(), formatSummary(), ProfilesPage(), scoringLabel(), createBlankProfile(), deleteProfile(), duplicateProfile(), EMPTY_OVERRIDES (+19 more)

### Community 15 - "Mock Draft Card"
Cohesion: 0.14
Nodes (13): 1. `src/services/marketMerge.js`, 2. `src/stores/useBoardStore.js`, 3. `src/components/BoardSection.jsx`, 4. `src/components/DataProvenanceBar.jsx`, 5. `src/pages/SetupPage.jsx` + `src/components/ImportResultBanner.jsx`, CSV-Board: ADP-Override & Bye-Week-Ergänzung, Datenfluss, Nicht-Ziele (+5 more)

### Community 16 - "TradePage.jsx"
Cohesion: 0.16
Nodes (22): fpRankMap(), ESPN_TEAM_ALIAS, extractEcrData(), extractEmbeddedJson(), fantasyProsPositionUrl(), FFC_FORMATS, FP_POS_SLUG, FP_POSITIONS (+14 more)

### Community 17 - "Team Rankings: neue lokale Bewertungslogik"
Cohesion: 0.15
Nodes (12): Design, Die 5 Metriken, Fehlerbehandlung, Gemeinsame Basis: Rank→Wert-Kurve, Nicht-Ziele, Problem, Schnittstellen / betroffene Dateien, Starting-Lineup (Grundlage für Starter, Depth, Bye) (+4 more)

### Community 18 - "tradeValue.js"
Cohesion: 0.05
Nodes (59): rosterLabel(), league, useSeasonSim(), WEEK_POSITIONS, availableStreamPositionsFor(), LineupPage(), dynastyRoster, loadIfStale (+51 more)

### Community 19 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.11
Nodes (18): Analyse-Seite (lokal berechnete Statistiken) — Design, Architektur, Bewusst zurückgestellt (Runde 2), Datenfluss, Die Kennzahlen, Layout, Liga-Kader in allen Ligen, Namen und Navigation (+10 more)

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

### Community 21 - "DataProvenanceBar.jsx"
Cohesion: 0.21
Nodes (14): BoardMobileBar(), SYNC_PRESETS, BoardToolbar(), INTERVALS, FiltersRow(), Icon(), MAP, MobileMoreSheet() (+6 more)

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
Cohesion: 0.26
Nodes (14): TrendList(), DraftPanel(), PlayerPanel(), POS_LABEL, RosterPanel(), PlayerDetailSheet(), usePlayerNews(), PlayerPreference (+6 more)

### Community 40 - "Geräte-Sync — Design"
Cohesion: 0.12
Nodes (15): Abgleich und Konflikte, Absicherung, Bewusst ausgelassen, Bündel, Entscheidung: verschlüsselter Briefkasten, Fehlerfälle, Geräte-Sync — Design, Komponenten (+7 more)

### Community 41 - "formatEstimate"
Cohesion: 0.43
Nodes (5): altText(), RecommendedLineupCard(), SLOT_LABEL, SLOT_ORDER, lineup

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
Cohesion: 0.16
Nodes (15): app, composeMessage(), app, __dirname, distDir, __filename, addSub(), getVapidConfig() (+7 more)

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
Cohesion: 0.22
Nodes (12): byeWeekForTeam(), NFL_BYES, TEAM_ALIAS, mergeWithMeta(), primaryPos(), meta, useTrendingPlayers(), fetchTrendingPlayers() (+4 more)

### Community 50 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.22
Nodes (10): ImportResultBanner(), stats, canOfferUndo(), SetupPage(), boardKeyFor(), boardKeyForContext(), isStandaloneDraft(), computeDetectedFingerprint() (+2 more)

### Community 51 - "graphify reference: GitHub clone and cross-repo merge"
Cohesion: 0.19
Nodes (13): ProfileBadgeCard(), fpScoringLabel(), SetupForm(), deriveFormat(), FORMAT_DEFAULTS, hasSuper(), rosterFromDraftSettings(), scoringTypeFromDraft() (+5 more)

### Community 52 - "graphify reference: transcribe video and audio"
Cohesion: 0.16
Nodes (10): attach, navigate, sessionState, setBoardPlayers, setDraftViewAs, setSelectedDraftId, setSelectedLeagueId, isDraftParticipant() (+2 more)

### Community 53 - "enrichBoardWithSleeper.js"
Cohesion: 0.26
Nodes (9): askAiAdvice(), validateAnthropicKey(), matchAsset(), norm(), avail, validateAdvice(), validateTradeSuggestions(), buildTradeablePlayers() (+1 more)

### Community 56 - "extraction-spec.md"
Cohesion: 0.15
Nodes (12): Addendum 2026-09-10: Board ans Profil gebunden (User-Feedback nach Live-Test), Board pro Profil/Liga + strikte Modus-Trennung + Ein-Klick-Profil Implementation Plan, Datei-Übersicht, Global Constraints, Self-Review, Task 1: `profileStore.js` — Pflicht-`mode`, Composite-Bindung, `persistProfile`, Task 2: Migration — Altbestand wird pro Modus angelegt, Task 3: `pickProfile` — Wildcards modus-scharf + neuer `boardKey`-Service (+4 more)

### Community 57 - "SetupPage.test.jsx"
Cohesion: 0.13
Nodes (23): BoardSection(), boardPlayers, mocks, boardPlayers, NextBoard(), useMarketRefresh(), ADVICE_REQUEST_OPTIONS, buildAdviceRequestArgs() (+15 more)

### Community 58 - "tradeValue.js"
Cohesion: 0.15
Nodes (21): react, react, ApiKeyDialog(), backdropStyle, boxStyle, btnBase, btnDanger, btnGhost (+13 more)

### Community 59 - "settingsTransfer.js"
Cohesion: 0.43
Nodes (6): collectKeysToExport(), findHighestVersionKey(), FIXED_KEYS, getAllLocalStorageKeys(), importSettingsObject(), VERSIONED_PREFIXES

### Community 60 - "useDynastyStore.test.js"
Cohesion: 0.33
Nodes (3): enriched(), ROSTERS, ROSTERS_B

### Community 62 - "buildAdviceRequestArgs"
Cohesion: 0.15
Nodes (12): Architektur (Ansatz A — lokal im Worker), Datenfluss, Error-Handling, Komponenten, Nicht-Ziele (V1), Problem, Risiken, Season-Simulator (Playoff-/Title-Odds, lokal) — Design (+4 more)

### Community 63 - "SetupPage.test.jsx"
Cohesion: 0.15
Nodes (14): DraftTab(), Runs(), Scarcity(), TeamRanking(), Tiers(), AgeProfile(), BENCH_SEGMENTS, KaderVsLiga() (+6 more)

### Community 64 - "aiValidate.js"
Cohesion: 0.35
Nodes (10): loadDraftOptionsAction(), loadLeaguesAction(), loadLeagueUsersAction(), loadPicksAction(), resolveUserIdAction(), fetchJson(), fetchLeague(), fetchLeagueDrafts() (+2 more)

### Community 65 - "useDynastyStore.js"
Cohesion: 0.15
Nodes (12): Bestand, der wiederverwendet wird (keine Änderung nötig), Bewusst nicht umgesetzt, Fehlerbehandlung, Kleine, gerechtfertigte Erweiterungen an bestehendem Code, Komponenten, Navigation, Neue reine Logik: `src/services/analysis/waiverStats.js`, Neuer Client-Store (+4 more)

### Community 66 - "tradeValue.js"
Cohesion: 0.17
Nodes (11): File Structure, Global Constraints, Season-Simulator V1 Implementation Plan, Self-Review, Task 1: Sim-Mathematik (`seasonSim.js`), Task 2: Schedule + Playoff-Cutoff (`seasonSchedule.js`), Task 3: Stärken-Berechnung (`seasonStrengths.js`), Task 4: Worker (`simWorker.js`) (+3 more)

### Community 67 - "NextBoard"
Cohesion: 0.24
Nodes (8): DraftGrid(), posInRound(), draft, ownerLabels, BoardPage(), useLiveStore, buildBoardSearch(), parseBoardParams()

### Community 68 - "NextShell.jsx"
Cohesion: 0.16
Nodes (17): App(), useIsWideViewport(), ShareTargetPage(), estimateRounds(), isDraftComplete(), inferMyDraftSlot(), teamsAndRoundsFromDraft(), getTeamsCount() (+9 more)

### Community 69 - "SetupPage.jsx"
Cohesion: 0.17
Nodes (12): scripts, build, cap:add:android, cap:copy, cap:open:android, dev, dev:all, dev:api (+4 more)

### Community 70 - "useUIStore.js"
Cohesion: 0.18
Nodes (10): Architektur, Datenfluss, Fehlerverhalten, Markt-Tab: Trending-Kacheln (Sleeper Waiver-Trends) — Design, Neue/geänderte Dateien, Nicht-Ziele, Problem, Styling (+2 more)

### Community 71 - "AppShell.jsx"
Cohesion: 0.25
Nodes (6): EMPTY_STRATEGY, scoringLabel(), StrategySection(), callAiDraftStrategy(), readSSEResult(), PAYLOAD

### Community 72 - "DataProvenanceBar.jsx"
Cohesion: 0.32
Nodes (9): DisagreementCard(), MarketTab(), ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween(), FORMAT_LABEL, formatMarketAge(), isStale() (+1 more)

### Community 73 - "formatEstimate"
Cohesion: 0.56
Nodes (7): estimateCostUsd(), estimateTokens(), formatEstimate(), formatTokens(), formatUsage(), formatUsd(), PRICING

### Community 74 - "SetupPage.test.jsx"
Cohesion: 0.43
Nodes (6): coolPenalty(), loadCooldown(), markShown(), saveCooldown(), SEV, TYPE_WEIGHTS

### Community 75 - "BoardSection.mismatch.test.jsx"
Cohesion: 0.27
Nodes (8): PickupSuggestions(), POS_ORDER, players, ALL_POSITIONS, StreamingBoard(), board, formatProjectedPts(), injuryLabel()

### Community 76 - "BoardSection.test.jsx"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 78 - "@fontsource/barlow-condensed"
Cohesion: 0.17
Nodes (11): File Map, Global Constraints, Self-Review, Task 1: Dependencies + VAPID-Keys, Task 2: Server Push-Storage + Routen, Task 3: Check-Engine (Warnungen + Nachricht), Task 4: Scheduler-Verdrahtung, Task 5: Service Worker + Build-Integration (+3 more)

### Community 79 - "react-dom"
Cohesion: 0.20
Nodes (9): Architektur, Datenfluss, Design: Web-Push-Benachrichtigungen (PWA, Android), Fehlerfälle / Betrieb, Kontext, Nicht-Ziele, Offene Punkte für den Plan, Testing (+1 more)

### Community 80 - "react-router-dom"
Cohesion: 0.31
Nodes (9): ageModifier(), applyModifier(), avgStarterAge(), detectTeamProfile(), evaluateTrade(), pickModifier(), ROUND_CONFIGS, TIER_NORM (+1 more)

### Community 81 - "zustand"
Cohesion: 0.47
Nodes (6): PushOptIn(), getPushState(), subscribePush(), unsubscribePush(), urlBase64ToUint8Array(), vapidKey()

### Community 82 - "SetupPage.test.jsx"
Cohesion: 0.39
Nodes (7): deviationsBetween(), makeFingerprint(), pickProfile(), sameStarters(), FORMAT, fp(), profile()

### Community 83 - "enrichBoardWithSleeper.js"
Cohesion: 0.57
Nodes (6): buildNameIndex(), enrichBoardPlayersWithSleeper(), isFresh(), mergePlayer(), primaryPos(), pickRelevantPlayers()

### Community 84 - "BoardTable.jsx"
Cohesion: 0.80
Nodes (3): BoardTable(), deltaAdp(), formatDeltaAdp()

### Community 85 - "SetupPage.test.jsx"
Cohesion: 0.40
Nodes (3): FC, FFC, setup()

## Knowledge Gaps
- **437 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+432 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `tradeValue.js`, `BoardSection.test.jsx`, `ImportResultBanner.jsx`, `@capacitor/android`, `cors`, `@fontsource/jetbrains-mono`, `lucide-react`, `prop-types`, `qrcode-generator`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `react` connect `tradeValue.js` to `SetupPage.test.jsx`, `Package Dependencies (prod)`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `BoardSection()` connect `SetupPage.test.jsx` to `aiTrade.js`, `NextBoard`, `NextShell.jsx`, `formatEstimate`, `useLiveStore`, `tipsPrioritizer.js`, `tradeValue.js`, `graphify reference: GitHub clone and cross-repo merge`, `graphify reference: incremental update and cluster-only`, `DataProvenanceBar.jsx`, `tradeValue.js`, `BoardSection.advice-cache.test.jsx`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `p()` (e.g. with `App()` and `TrendList()`) actually correct?**
  _`p()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _437 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.10952380952380952 - nodes in this community are weakly interconnected._
- **Should `aiTrade.js` be split into smaller, more focused modules?**
  _Cohesion score 0.07547169811320754 - nodes in this community are weakly interconnected._