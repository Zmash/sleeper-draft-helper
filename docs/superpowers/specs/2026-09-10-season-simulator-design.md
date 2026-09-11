# Season-Simulator (Playoff-/Title-Odds, lokal) — Design

Status: entworfen, noch nicht implementiert
Datum: 2026-09-10

## Problem

Die App ist im Draft stark (Live-Tracking, Board, Tipps, KI-Advice/Review),
aber in-Season fehlt die Antwort auf die härteste wiederkehrende Frage:
„Bin ich Contender oder Pretender — und mit welcher Wahrscheinlichkeit?"
`AnalysisPage.jsx` hat heute drei Reiter (`TABS = Draft/Roster/Markt`), alle
rückblickend oder zustandsbeschreibend. `LineupPage.jsx` hilft bei der
nächsten Woche (Waiver, Streaming, Recommended Lineup via `bestLineup` aus
`waiverStats.js`), aber nicht beim Rest der Saison.

Konkurrenz (Dynasty-Daddy Playoff-Calculator 10k Sims, SmashAccept/LineupLab
Season-Simulator 1k Sims mit echtem Schedule, FantasyCalc Playoff Odds)
beantwortet genau das — immer aus denselben Zahlen wie die Trade-Tools, damit
Board und Trades nie widersprechen.

## Ziele

- Vierter Reiter **„Saison"** in `AnalysisPage.jsx` (keine eigene Route).
  Nutzt vorhandene Props (`teamsCount`, `selectedLeague`, `effRoster`,
  `effScoringType`, `seasonYear`) plus vorhandene Stores — kein neuer
  globaler Store.
- **Playoff-% / Bye-% / Title-% + projizierte W-L-Bilanz** für jedes Team,
  Default **10k Simulationen** (User-Entscheidung 2026-09-10).
- **Offline-first, ohne KI-Key:** alle Sims laufen lokal im WebWorker,
  deterministisch per Seed für Tests. Die Berechnungen selbst gehen nie ins
  Netz; nur die ohnehin vorhandenen Ranking-/Schedule-Requests liefern Input.
- Team-Stärke aus **denselben Quellen wie Kader-/Lineup-Tabs**
  (`sleeperWeekById` + FP-ROS-ECR via `useWeeklyRankingsStore.getRankMap`, via
  `bestLineup` projizierte Starter-Punkte) — keine zweite Wahrheit.
- Redraft primär, Dynasty sekundär: im Rookie-Modus fliesst `dynastyValues`
  nur als Tie-Break ein, kein eigener Simulator.

## Nicht-Ziele (V1)

- **Kein Trade-Impact-Delta** („+4 % Playoff-Odds durch diesen Trade") —
  User-Entscheidung: deferred auf V2. `TradePage.jsx` wird nicht angefasst.
- Kein Trade Finder / keine Trade-DB / keine Value-Alerts (Prio-2-Cluster
  explizit auf „Später" gelegt).
- Keine SOS-Tabelle, keine Portfolio-Sicht (alle Teams des Users über Ligen),
  keine Contender/Rebuilder-Labels mit Handlungsempfehlung — nur Odds.
- Kein Multi-Plattform-Ausbau: nur Sleeper (`src/services/api.js`:
  `fetchMatchups`, `fetchNflState`, `fetchLeagueRosters`). Kein
  `LeagueAdapter`-Interface in V1 (Scope-Reduktion 2026-09-10).
- Keine KI-Erzählung (Ansatz B verworfen), kein Server-Cron (Ansatz C
  verworfen). Keine Persistenz der Sim-Ergebnisse (pro Sitzung neu).

## Architektur (Ansatz A — lokal im Worker)

```
AnalysisPage (Tab „Saison")
 └─ SeasonTab.jsx (presentational: Tabelle + Controls + Hinweise)
     ├─ SimControls.jsx (Sim-Anzahl fix 10k Default, ADP-vs-ELO-Umschalter,
     │                    Startwoche; Progress + Abbrechen)
     └─ OddsTable.jsx (Team, proj. W-L, Playoff-%, Bye-%, Title-%)
 └─ useSeasonSim.js (Hook: lädt Inputs, steuert Worker, aggregiert)
     ├─ src/services/analysis/seasonSim.js (reine Funktionen, Vitest)
     └─ src/workers/simWorker.js (Monte-Carlo, gechunkt 10×1k)
Inputs: leagueRosters (useDynastyStore), effRoster/effScoringType (Props),
        ROS-ECR (useWeeklyRankingsStore.loadIfStale ros),
        Sleeper-Wochenprojektionen (loadSleeperWeekIfStale),
        Schedule + NFL-State (fetchMatchups, fetchNflState),
        Playoff-Format aus Liga-Objekt (Konvention wie `ai.js:267`:
        `league?.playoff_start_week` mit Fallback auf
        `settings.playoff_week_start`; Team-Anzahl via
        `settings.playoff_teams_count`, Fallback 6).
```

- `seasonSim.js` enthält nur reine Funktionen: `teamStrength()`,
  `winProbability()`, `simulateSeason()`, `aggregateOdds()`. Keine
  Store-Imports, kein `fetch` — per Vitest mit Seed prüfbar.
- `simWorker.js` ruft nur `simulateSeason`-Chunks auf und postet Progress.
  Fallback ohne Worker: synchron 2k Sims mit Hinweis (alte Android
  WebViews).
- `useSeasonSim` owned keinen Persist-Store: Ergebnis lebt im Hook-State der
  Seite und verfällt bei Unmount (bewusst wie `useWeeklyRankingsStore`:
  Weekly-Daten sind zu volatil für localStorage).

## Komponenten

- `SeasonTab.jsx`: lädt via `useSeasonSim`, zeigt bei fehlenden Inputs den
  gleichen „nicht verfügbar"-Zustand wie Weekly-Rankings (kein Fake-0 %).
  Deaktiviert sich bei < 4 Rostern.
- `SimControls.jsx`: 10k Default (fix, nicht wählbar in V1 — Entscheidung),
  ADP-vs-ELO-Umschalter (wie Dynasty-Daddy), Startwoche (Default: aktuelle
  NFL-Woche aus `fetchNflState`). Abbrechen-Button bricht Worker ab.
- `OddsTable.jsx`: sortiert nach Title-%, eigenes Team (via `mySleeperRosterId`
  / `draftSlot`-Logik aus `AnalysisPage.jsx:50`) hervorgehoben. Zahlen gross
  zuerst, kein Chart in V1 (Zahl trägt die Aussage).

## Datenfluss

1. `useSeasonSim` ruft `loadIfStale({ scope: 'ros' })` + 
   `loadSleeperWeekIfStale({ season, week })` — wiederverwendet 6h/24h-TTLs.
2. `teamStrength(roster)`: `bestLineup` mit projizierten Punkten füllen
   (Sleeper-Week > FP-ROS-Fallback), Summe Starter-Punkte = Stärke. Bye-Weeks
   aus `playersMeta` werden in der jeweiligen Woche mit 0 gewertet. V1-Vereinfachung: die aktuelle Wochenprojektion wird für alle Restwochen fortgeschrieben; Wochen unterscheiden sich nur via Bye-Ausschluss.
3. Schedule: `fetchMatchups` Rest-Spielplan ab aktueller Woche; fehlende
   Wochen (Playoffs ausserhalb Sleeper-Schedule) werden als
   Seeding-Runde modelliert, nicht als Matchups.
4. Monte-Carlo: pro Matchup `p Sieg = 1 / (1 + 10^(-delta / 400))`
   (ELO-Modus, delta = Stärke-Differenz in projizierten Punkten, 400 = fixe
   Skala aus V1-Konstante `ELO_SCALE`) oder dieselbe Formel mit
   delta = (gegnerischer ADP-Rang-Mittel − eigener) im ADP-Modus. 10k Läufe gechunkt,    Aggregation zu
   W-L-Mittelwert, Playoff-% (>= playoff_teams nach Seeding), Bye-% (Top-Seeds),
   Title-% (K.-o.-Baum nach Sleeper-Playoff-Format: jede Paarung wird probabilistisch mit Last-Week-Stärke simuliert, ohne wochen-spezifische Projektionen).
5. Dynasty-Modus (`draftMode === 'rookie'`): identischer Pfad, nur
   `dynastyValues` als Tie-Break bei Stärke-Gleichstand (±1 %).

## Error-Handling

- Keine ROS-Daten (FP-Scrape leer + keine Sleeper-Projektionen): Tab zeigt
  „Projektionen nicht verfügbar" — keine Odds, kein 0-%-Fake.
- Weniger als 4 Roster / kein Schedule: Tab deaktiviert mit Begründung.
- Worker-Fehler/Timeout (> 30 s ohne Progress): Fallback 2k synchron +
  Badge „reduzierte Genauigkeit".
- IDP-/DEF-Ligen: `availableStreamPositionsFor`-Logik (LineupPage) bestimmt,
  welche Slots in `bestLineup` zählen; unbekannte Slots werden ignoriert,
  nicht geraten.

## Testing

- Vitest `seasonSim.test.js` mit festem Seed: 12er PPR (8-4-Team muss >
  60 % Playoff haben), SF+TEP (QB-Stärke zählt mehr), Dynasty-Tie-Break,
  Bye-Week-Nullung, <4-Roster-Guard. Keine Netz-Requests in Unit-Tests
  (Fixtures für Rankings/Schedule).
- `SeasonTab`-Render-Test analog `DraftAnalysis.test.jsx`: lädt, zeigt
  Progress, zeigt Tabelle, zeigt „nicht verfügbar" bei leerem Input.
- Manuell: echte Sleeper-Liga (Redraft + Dynasty), Flugmodus-Re-Render aus
  Cache, Android Chrome Worker-Check. Kein neuer Sleeper-Account nötig.

## Risiken

- 10k Default auf alten Androids 2–5 s — via Chunking + Progress +
  Abbrechen akzeptabel; keine Paginierung nötig.
- FP-ROS-Scrape (`fantasypros-position`) ist fragil (Cheerio-Selektoren in
  `apiRoutes.js`/`rankings.js`) — Fallback-Kette Sleeper-Projektionen zuerst
  mindert das.
- Vereinfachter Playoff-Baum (kein Einzelmatchup-Sim) unterschätzt Varianz —
  bewusst dokumentiert, V2-Kandidat.

## V2-Kandidaten (nicht in diesem Spec)

Trade-Impact-Delta in `TradePage`, SOS-Spalte, Portfolio-Sicht,
Contender/Rebuilder-Badges mit Buy/Sell-Fenstern, wählbare Sim-Tiefe
(1k/2k/10k), Server-Cache via Cron, Multi-Plattform-Adapter, KI-Erzählung
via bestehender SSE-Infra.
