# Graph Report - sleeper-draft-helper  (2026-09-14)

## Corpus Check
- 285 files · ~306,578 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1595 nodes · 3740 edges · 105 communities (92 shown, 13 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `27716bea`
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
- NextShell.jsx
- SetupPage.jsx
- useUIStore.js
- AppShell.jsx
- DataProvenanceBar.jsx
- formatEstimate
- SetupPage.test.jsx
- BoardSection.mismatch.test.jsx
- Live-Redzone — Design
- strategyMatch.js
- @fontsource/barlow-condensed
- react-dom
- react-router-dom
- SetupPage.test.jsx
- matchupProjection.js
- enrichBoardWithSleeper.js
- migrate.js
- lucide-react
- prop-types
- qrcode-generator
- tradeValue.js
- rosterStats.js
- useBoardStore.js
- aiValidate.js
- strategyMatch.js
- DraftGrid.jsx
- RecommendedLineupCard.jsx
- LineupPage.test.jsx
- enrichBoardWithSleeper.js
- useDynastyStore.test.js
- useDynastyValuesStore.js
- useWeeklyRankingsStore.js
- SetupPage.test.jsx
- BoardSection.test.jsx
- RedzonePage.test.jsx
- @anthropic-ai/sdk

## God Nodes (most connected - your core abstractions)
1. `cx()` - 67 edges
2. `normalizePlayerName()` - 53 edges
3. `Icon()` - 40 edges
4. `useSessionStore` - 38 edges
5. `normalizePos()` - 38 edges
6. `registerApiRoutes()` - 35 edges
7. `fetchJson()` - 32 edges
8. `BoardSection()` - 29 edges
9. `App()` - 26 edges
10. `LineupPage()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `football.html - Canvas Football Animation` --references--> `Sleeper Draft Helper`  [INFERRED]
  public/football.html → README.md
- `BoardSection()` --references--> `react`  [EXTRACTED]
  src/components/BoardSection.jsx → package.json
- `DraftAnalysis()` --references--> `react`  [EXTRACTED]
  src/components/DraftAnalysis.jsx → package.json
- `fpRankMap()` --indirect_call--> `rp()`  [INFERRED]
  src/server/lineupCheck.js → src/services/analysis/draftStats.test.js
- `defaultDeps()` --indirect_call--> `enriched()`  [INFERRED]
  src/server/lineupCheck.js → src/stores/useDynastyStore.test.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Feature Plan-Spec Pairs** — plan_broadcast_redesign, spec_broadcast_redesign, plan_redraft_flow, spec_redraft_flow, plan_ai_mehrwert, spec_ai_mehrwert [EXTRACTED 0.95]
- **Server Proxy Stack** — concept_express_ai_proxy, concept_anthropic_sdk, concept_deploy_pipeline, concept_sleeper_api [EXTRACTED 0.95]
- **Frontend SPA Stack** — concept_react_vite_spa, concept_zustand_stores, concept_appjsx_orchestrator, concept_capacitor_android [EXTRACTED 0.95]

## Communities (105 total, 13 thin omitted)

### Community 0 - "Board & Draft Components"
Cohesion: 0.10
Nodes (17): AiResult(), CURRENT_YEAR, enrichPlayers(), lookupKtcValue(), PickForm(), PlayerSearch(), POS_FILTERS, PROFILE_ICONS (+9 more)

### Community 1 - "aiTrade.js"
Cohesion: 0.31
Nodes (7): fmtPct(), fmtRating(), fmtRecord(), heat(), OddsTable(), SeasonTab(), doneSim

### Community 2 - "Trade & Draft Tips Hooks"
Cohesion: 0.09
Nodes (39): L1_DATA, PROJ, session, WeeklyPage(), actualSlotAssignment(), alignOptimalToActual(), benchMisses(), buildInjuryReport() (+31 more)

### Community 3 - "App Core & Analysis"
Cohesion: 0.13
Nodes (20): fmtPick(), OnTheClockBar(), draft, groupBy(), hashId(), POS, base, roster (+12 more)

### Community 4 - "Package Dependencies (dev)"
Cohesion: 0.08
Nodes (25): @capacitor/cli, @capacitor/core, concurrently, jsdom, devDependencies, @capacitor/cli, @capacitor/core, concurrently (+17 more)

### Community 5 - "Project Architecture Concepts"
Cohesion: 0.12
Nodes (29): CLAUDE.md Project Instructions, AI-Mehrwert (Live-Advice as Core), Anthropic SDK / Claude Sonnet 5, App.jsx Orchestrator, Broadcast Lower-Third Design System, Capacitor Android Build, Deploy Pipeline (current-symlink), Draft Modes (Redraft vs. Rookie/Dynasty) (+21 more)

### Community 6 - "Package Dependencies (prod)"
Cohesion: 0.08
Nodes (25): @2toad/profanity, @capacitor/android, cheerio, dotenv, express, @fontsource/barlow-condensed, node-cron, dependencies (+17 more)

### Community 7 - "Roster CSV & Market"
Cohesion: 0.11
Nodes (31): qrSvg(), SyncSection(), applyBundle(), collectBundle(), EXCLUDE_KEYS, EXTRA_KEYS, isBundled(), mergeBundles() (+23 more)

### Community 8 - "aiTrade.js"
Cohesion: 0.14
Nodes (19): Modal(), canOfferUndo(), SetupPage(), formatDraftLabel(), boardKeyFor(), boardKeyForContext(), deriveFormat(), hasSuper() (+11 more)

### Community 9 - "ApiKeyDialog.jsx"
Cohesion: 0.11
Nodes (17): Datei-Überblick, Global Constraints, Self-Review (durchgeführt), Task 10: `PickupSuggestions.jsx`, Task 11: `StreamingBoard.jsx`, Task 12: `RecommendedLineupCard.jsx`, Task 13: `WaiverPage.jsx` + Routing/Nav-Integration + finale Verifikation, Task 1: FantasyPros-Positions-URL-Builder + Normalizer-Erweiterung (+9 more)

### Community 10 - "Server API Routes"
Cohesion: 0.06
Nodes (66): addScore(), applyPromptCaching(), buildStrategyPrompt(), checkScoreRateLimit(), isProfaneName(), isValidRoom(), isValidScoreEntry(), isValidScoreName() (+58 more)

### Community 11 - "DraftAnalysis.jsx"
Cohesion: 0.06
Nodes (42): DraftCardInner(), EditableTitle(), FORMAT_LABELS, formatPoints(), formatRecord(), INJURY_COLOR, LeagueCard(), LeagueCardInner() (+34 more)

### Community 12 - "Advice Dialog & Modals"
Cohesion: 0.22
Nodes (12): byeWeekForTeam(), NFL_BYES, TEAM_ALIAS, mergeWithMeta(), primaryPos(), meta, useTrendingPlayers(), fetchTrendingPlayers() (+4 more)

### Community 13 - "Trade Service & AI"
Cohesion: 0.20
Nodes (9): Draft-Strategie-Bibliothek mit AI-Recherche — Implementierungsplan, Global Constraints, Nach dem Plan, Task 1: Matching-Logik, Task 2: Persistenz und Migration, Task 3: Server-Route mit Web-Recherche, Task 4: Client für die Strategie-Route, Task 5: UI im SetupForm (+1 more)

### Community 14 - "useLiveStore"
Cohesion: 0.19
Nodes (26): ProfileEditor(), formatSummary(), ProfilesPage(), scoringLabel(), FORMAT_DEFAULTS, createBlankProfile(), deleteProfile(), duplicateProfile() (+18 more)

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
Cohesion: 0.25
Nodes (18): availableStreamPositionsFor(), LineupPage(), bestLineup(), compareToActualStarters(), FLEX_ELIGIBLE, freeAgents(), IR_ELIGIBLE_STATUSES, IR_PRIORITY (+10 more)

### Community 19 - "Draft-Strategie: Bibliothek + AI-Recherche"
Cohesion: 0.11
Nodes (18): Analyse-Seite (lokal berechnete Statistiken) — Design, Architektur, Bewusst zurückgestellt (Runde 2), Datenfluss, Die Kennzahlen, Layout, Liga-Kader in allen Ligen, Namen und Navigation (+10 more)

### Community 20 - "Global Constraints"
Cohesion: 0.33
Nodes (5): Global Constraints, Task 1: Neue Score-Logik in analysis.js (TDD), Task 2: Tabelle + App-Aufruf anpassen, Task 3: Verifikation im Browser + graphify, Team Rankings: neue lokale Bewertungslogik — Implementation Plan

### Community 21 - "DataProvenanceBar.jsx"
Cohesion: 0.19
Nodes (15): blendedPlayerProjection(), isRuledOut(), liveStarterTotals(), normStatus(), remainingGameFraction(), RULED_OUT, PLAYERS_META, pointsFor() (+7 more)

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
Cohesion: 0.15
Nodes (23): BoardSection(), boardPlayers, mocks, BoardTable(), deltaAdp(), formatDeltaAdp(), NextBoard(), useMarketRefresh() (+15 more)

### Community 40 - "Geräte-Sync — Design"
Cohesion: 0.12
Nodes (15): Abgleich und Konflikte, Absicherung, Bewusst ausgelassen, Bündel, Entscheidung: verschlüsselter Briefkasten, Fehlerfälle, Geräte-Sync — Design, Komponenten (+7 more)

### Community 41 - "formatEstimate"
Cohesion: 0.13
Nodes (25): g(), p(), RedzonePage(), buildMatchupTiles(), buildPlayers(), buildRedzoneAlerts(), buildTicker(), carryPossession() (+17 more)

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
Cohesion: 0.14
Nodes (18): react, react, ApiKeyDialog(), backdropStyle, boxStyle, btnBase, btnDanger, btnGhost (+10 more)

### Community 46 - "tipsPrioritizer.js"
Cohesion: 0.25
Nodes (6): handleAutoImport, handleCsvLoad, handleFantasyProsImport, handleKtcRookieImport, setBoardSource, setCsvRawText

### Community 47 - "graphify reference: query, path, explain"
Cohesion: 0.21
Nodes (13): FiltersRow(), PickupSuggestions(), POS_ORDER, players, ALL_POSITIONS, StreamingBoard(), board, BASE_POSITIONS (+5 more)

### Community 48 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.13
Nodes (21): fetchMatchups(), fetchScoreboard(), fetchScoringPlays(), lastKickoffAt(), normAbbr(), normalizeScoreboard(), normalizeScoringPlays(), TEAM_ALIAS (+13 more)

### Community 49 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.12
Nodes (16): File Structure, Global Constraints, Live-Redzone Implementation Plan, Self-Review (erledigt beim Schreiben), Task 10: Redzone-Seite + Route, Task 11: Einstiege nur während Live-Spielen, Task 12: Live-Verifikation, Doku, Graph, Task 1: Live-Farbe je Theme (+8 more)

### Community 50 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.16
Nodes (17): ecrByName(), FLEX_FRACTION_LABELS, FLEX_SLOTS, formatComposition(), formatFlexShare(), pickName(), pickPositionCounts(), positionalScarcity() (+9 more)

### Community 51 - "graphify reference: GitHub clone and cross-repo merge"
Cohesion: 0.10
Nodes (28): AppShell(), Footer(), MobileDraftSwitch(), CommandPalette(), DraftSwitcher(), NextShell(), RAIL, ThemeMenu() (+20 more)

### Community 52 - "graphify reference: transcribe video and audio"
Cohesion: 0.15
Nodes (12): 1. Ziel & Nicht-Ziele, 2. Ausgangslage — verifizierte Befunde, 3. Verbindliche Entscheidungen, 4.1 `src/pages/TradePage.jsx`, 4.2 `src/services/tradeValue.js`, 4.3 `src/components/TradeAnalyzer.jsx`, 4.4 `src/services/aiTrade.js`, 4. Architektur (+4 more)

### Community 53 - "enrichBoardWithSleeper.js"
Cohesion: 0.17
Nodes (12): scripts, build, cap:add:android, cap:copy, cap:open:android, dev, dev:all, dev:api (+4 more)

### Community 56 - "extraction-spec.md"
Cohesion: 0.15
Nodes (12): Addendum 2026-09-10: Board ans Profil gebunden (User-Feedback nach Live-Test), Board pro Profil/Liga + strikte Modus-Trennung + Ein-Klick-Profil Implementation Plan, Datei-Übersicht, Global Constraints, Self-Review, Task 1: `profileStore.js` — Pflicht-`mode`, Composite-Bindung, `persistProfile`, Task 2: Migration — Altbestand wird pro Modus angelegt, Task 3: `pickProfile` — Wildcards modus-scharf + neuer `boardKey`-Service (+4 more)

### Community 57 - "SetupPage.test.jsx"
Cohesion: 0.44
Nodes (7): DraftPanel(), PlayerPanel(), RosterPanel(), PlayerDetailSheet(), usePlayerNews(), fantasyProsPlayerUrl(), normalizePos()

### Community 58 - "tradeValue.js"
Cohesion: 0.24
Nodes (15): DraftAnalysis(), baseProps, emptyParsed, estimateCostUsd(), estimateTokens(), formatEstimate(), formatTokens(), formatUsage() (+7 more)

### Community 59 - "settingsTransfer.js"
Cohesion: 0.43
Nodes (6): collectKeysToExport(), findHighestVersionKey(), FIXED_KEYS, getAllLocalStorageKeys(), importSettingsObject(), VERSIONED_PREFIXES

### Community 60 - "useDynastyStore.test.js"
Cohesion: 0.28
Nodes (10): DisagreementCard(), MarketTab(), TrendList(), ADP_SOURCE_LABEL, DataProvenanceBar(), daysBetween(), FORMAT_LABEL, formatMarketAge() (+2 more)

### Community 61 - "BoardSection.advice-cache.test.jsx"
Cohesion: 0.47
Nodes (6): PushOptIn(), getPushState(), subscribePush(), unsubscribePush(), urlBase64ToUint8Array(), vapidKey()

### Community 62 - "buildAdviceRequestArgs"
Cohesion: 0.15
Nodes (12): Architektur (Ansatz A — lokal im Worker), Datenfluss, Error-Handling, Komponenten, Nicht-Ziele (V1), Problem, Risiken, Season-Simulator (Playoff-/Title-Odds, lokal) — Design (+4 more)

### Community 63 - "SetupPage.test.jsx"
Cohesion: 0.17
Nodes (13): DraftTab(), Runs(), Scarcity(), TeamRanking(), Tiers(), AgeProfile(), BENCH_SEGMENTS, KaderVsLiga() (+5 more)

### Community 64 - "aiValidate.js"
Cohesion: 0.18
Nodes (15): AllTeamsOverview(), GROUPS, primaryReason(), REASON_LABEL, REASON_PRIORITY, rows, buildAllTeamsRows(), countBySeverity() (+7 more)

### Community 65 - "useDynastyStore.js"
Cohesion: 0.15
Nodes (12): Bestand, der wiederverwendet wird (keine Änderung nötig), Bewusst nicht umgesetzt, Fehlerbehandlung, Kleine, gerechtfertigte Erweiterungen an bestehendem Code, Komponenten, Navigation, Neue reine Logik: `src/services/analysis/waiverStats.js`, Neuer Client-Store (+4 more)

### Community 66 - "tradeValue.js"
Cohesion: 0.17
Nodes (11): File Structure, Global Constraints, Season-Simulator V1 Implementation Plan, Self-Review, Task 1: Sim-Mathematik (`seasonSim.js`), Task 2: Schedule + Playoff-Cutoff (`seasonSchedule.js`), Task 3: Stärken-Berechnung (`seasonStrengths.js`), Task 4: Worker (`simWorker.js`) (+3 more)

### Community 67 - "NextBoard"
Cohesion: 0.20
Nodes (7): attach, navigate, sessionState, setBoardPlayers, setDraftViewAs, setSelectedDraftId, setSelectedLeagueId

### Community 68 - "NextShell.jsx"
Cohesion: 0.14
Nodes (21): App(), RootRedirect(), useIsWideViewport(), MockDraftCard(), DashboardPage(), formatLastRefreshed(), SEASON_TYPE_LABEL, SleeperConnectWidget() (+13 more)

### Community 69 - "SetupPage.jsx"
Cohesion: 0.15
Nodes (24): buildManagerRosters(), loadFcCache(), saveFcCache(), TradePage(), loadDraftOptionsAction(), loadLeaguesAction(), loadLeagueUsersAction(), loadPicksAction() (+16 more)

### Community 70 - "useUIStore.js"
Cohesion: 0.18
Nodes (10): Architektur, Datenfluss, Fehlerverhalten, Markt-Tab: Trending-Kacheln (Sleeper Waiver-Trends) — Design, Neue/geänderte Dateien, Nicht-Ziele, Problem, Styling (+2 more)

### Community 71 - "AppShell.jsx"
Cohesion: 0.25
Nodes (6): EMPTY_STRATEGY, scoringLabel(), StrategySection(), callAiDraftStrategy(), readSSEResult(), PAYLOAD

### Community 72 - "DataProvenanceBar.jsx"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 73 - "formatEstimate"
Cohesion: 0.18
Nodes (14): checkUserLeagues(), defaultDeps(), fetchCurrentWeek(), FLEX_POSITIONS, FP_HEADERS, fpRankMap(), loadMetaDefault(), REASON_TEXT (+6 more)

### Community 74 - "SetupPage.test.jsx"
Cohesion: 0.43
Nodes (7): coolPenalty(), loadCooldown(), markShown(), prioritizeTips(), saveCooldown(), SEV, TYPE_WEIGHTS

### Community 75 - "BoardSection.mismatch.test.jsx"
Cohesion: 0.22
Nodes (3): ADVICE_REQUEST_OPTIONS, buildAdviceRequestArgs(), baseInputs

### Community 76 - "Live-Redzone — Design"
Cohesion: 0.17
Nodes (11): Abweichungen von diesem Entwurf (beim Bauen entschieden), Architektur, Datenquellen (alle live getestet am 2026-09-13), Entscheidungen (mit Dario abgestimmt), Fehlerbehandlung, Layout, Live-Ergebnis (2026-09-13, Week 1, 7 laufende Spiele, echter Account), Live-Redzone — Design (+3 more)

### Community 77 - "strategyMatch.js"
Cohesion: 0.28
Nodes (11): AnalysisPage(), TABS, BoardPage(), positionalRuns(), tierUsage(), withDynastyValueFallback(), teamKeyFromPick(), useBoardStore (+3 more)

### Community 78 - "@fontsource/barlow-condensed"
Cohesion: 0.17
Nodes (11): File Map, Global Constraints, Self-Review, Task 1: Dependencies + VAPID-Keys, Task 2: Server Push-Storage + Routen, Task 3: Check-Engine (Warnungen + Nachricht), Task 4: Scheduler-Verdrahtung, Task 5: Service Worker + Build-Integration (+3 more)

### Community 79 - "react-dom"
Cohesion: 0.20
Nodes (9): Architektur, Datenfluss, Design: Web-Push-Benachrichtigungen (PWA, Android), Fehlerfälle / Betrieb, Kontext, Nicht-Ziele, Offene Punkte für den Plan, Testing (+1 more)

### Community 82 - "matchupProjection.js"
Cohesion: 0.06
Nodes (64): BoardMobileBar(), SYNC_PRESETS, BoardToolbar(), INTERVALS, Icon(), MAP, ImportResultBanner(), stats (+56 more)

### Community 83 - "enrichBoardWithSleeper.js"
Cohesion: 0.25
Nodes (14): parseFantasyProsCsv(), toNum(), enrichWithInjuries(), fillMissingBye(), MARKET_FIELDS, marketIndex(), mergeMarketFields(), mergeRankingsWithMarket() (+6 more)

### Community 88 - "tradeValue.js"
Cohesion: 0.20
Nodes (13): ageModifier(), applyIdentity(), applyModifier(), avgStarterAge(), detectTeamProfile(), evaluateTrade(), pickModifier(), ROUND_CONFIGS (+5 more)

### Community 89 - "rosterStats.js"
Cohesion: 0.29
Nodes (12): starterSlots(), ageProfile(), labelForRoster(), median(), ROSTER_SLOTS, rosterValueSplit(), SPLIT_POS, standingsOf() (+4 more)

### Community 90 - "useBoardStore.js"
Cohesion: 0.22
Nodes (6): migrateOldStorage(), fetchFfcSpread(), fetchJsonOk(), fetchMarketAdp(), migrateBoardsToModeKeys(), safeStorage

### Community 91 - "aiValidate.js"
Cohesion: 0.29
Nodes (8): askAiAdvice(), validateAnthropicKey(), matchAsset(), norm(), avail, validateAdvice(), validateTradeSuggestions(), stripSuffix()

### Community 93 - "strategyMatch.js"
Cohesion: 0.39
Nodes (7): deviationsBetween(), makeFingerprint(), pickProfile(), sameStarters(), FORMAT, fp(), profile()

### Community 94 - "DraftGrid.jsx"
Cohesion: 0.32
Nodes (4): DraftGrid(), posInRound(), draft, ownerLabels

### Community 95 - "RecommendedLineupCard.jsx"
Cohesion: 0.43
Nodes (5): altText(), RecommendedLineupCard(), SLOT_LABEL, SLOT_ORDER, lineup

### Community 96 - "LineupPage.test.jsx"
Cohesion: 0.29
Nodes (6): dynastyRoster, loadIfStale, loadSleeperWeekIfStale, props, rankMaps, sleeperWeekById

### Community 97 - "enrichBoardWithSleeper.js"
Cohesion: 0.57
Nodes (6): buildNameIndex(), enrichBoardPlayersWithSleeper(), isFresh(), mergePlayer(), primaryPos(), pickRelevantPlayers()

### Community 98 - "useDynastyStore.test.js"
Cohesion: 0.33
Nodes (3): enriched(), ROSTERS, ROSTERS_B

### Community 99 - "useDynastyValuesStore.js"
Cohesion: 0.40
Nodes (3): FULL_KTC, KTC, useDynastyValuesStore

### Community 100 - "useWeeklyRankingsStore.js"
Cohesion: 0.40
Nodes (3): MOCK_RANKINGS, TTL_MS, useWeeklyRankingsStore

### Community 101 - "SetupPage.test.jsx"
Cohesion: 0.40
Nodes (3): FC, FFC, setup()

## Knowledge Gaps
- **520 isolated node(s):** `name`, `version`, `private`, `type`, `dev` (+515 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies (prod)` to `DataProvenanceBar.jsx`, `@anthropic-ai/sdk`, `graphify reference: extra exports and benchmark`, `react-router-dom`, `SetupPage.test.jsx`, `migrate.js`, `lucide-react`, `prop-types`, `qrcode-generator`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `react` connect `graphify reference: extra exports and benchmark` to `tradeValue.js`, `Package Dependencies (prod)`, `ApiKeyDialog.jsx`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `normalizePlayerName()` connect `enrichBoardWithSleeper.js` to `Board & Draft Components`, `enrichBoardWithSleeper.js`, `useDynastyValuesStore.js`, `SetupPage.jsx`, `ApiKeyDialog.jsx`, `formatEstimate`, `Server API Routes`, `DraftAnalysis.jsx`, `strategyMatch.js`, `graphify reference: extra exports and benchmark`, `graphify reference: query, path, explain`, `TradePage.jsx`, `tradeValue.js`, `graphify reference: incremental update and cluster-only`, `tradeValue.js`, `useBoardStore.js`, `aiValidate.js`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _520 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Board & Draft Components` be split into smaller, more focused modules?**
  _Cohesion score 0.10276679841897234 - nodes in this community are weakly interconnected._
- **Should `Trade & Draft Tips Hooks` be split into smaller, more focused modules?**
  _Cohesion score 0.08773784355179703 - nodes in this community are weakly interconnected._
- **Should `App Core & Analysis` be split into smaller, more focused modules?**
  _Cohesion score 0.13054187192118227 - nodes in this community are weakly interconnected._