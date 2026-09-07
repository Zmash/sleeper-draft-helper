# Waiver-Wire-Tool — Design

## Ziel

Neue In-Season-Seite `/waiver`, die drei bisher fehlende Fragen beantwortet:

1. Wer von den verfügbaren Free Agents könnte sich lohnen (Quelle je nach Redraft/Dynasty unterschiedlich)?
2. Wie ranken sich verfügbare Streaming-Positionen (DEF/QB/TE, vom Nutzer wählbar) für diese Woche und für den Rest der Saison (ROS)?
3. Was ist die optimale Aufstellung für die aktuelle Woche im eigenen Kader, und ist sie bereits so gesetzt?

Das Tool ist reines In-Season-Feature (nach dem Draft). Es ist bewusst kein vierter Tab in `/analyse`, weil diese Seite strikt an den Draft-Kontext gebunden ist (`livePicks`, `boardPlayers`, `selectedDraft`) — Waiver-Wire braucht einen eigenen, wochenbezogenen State.

## Bestand, der wiederverwendet wird (keine Änderung nötig)

- `useDynastyStore.leagueRosters` / `mySleeperRosterId` — wird in `App.jsx` bereits für **jede** echte Liga geladen (nicht nur Dynasty), nicht nur beim Öffnen von `/analyse`.
- `useDynastyValuesStore` — KTC-Dynasty-Werte, laufen bereits im Hintergrund.
- `useTrendingPlayers` (`src/hooks/useTrendingPlayers.js`) — ligaübergreifende Sleeper-Add/Drop-Trends, schon fertig für den Markt-Tab.
- `loadPlayersMetaCached()` (`src/services/playersMeta.js`) — voller Sleeper-Spielerkatalog, 24h gecacht.
- `fetchNflState()`, `fetchMatchups(leagueId, week)` (`src/services/api.js`) — existieren bereits, wurden bisher nicht benutzt.
- `/api/rankings/fantasypros`-Scraper (`extractEcrData`, `normalizeFantasyProsPlayer`, HEADERS) — liefert das `ecrData`-Blob von FantasyPros-Cheatsheet-Seiten. Gleiches Muster funktioniert für Weekly- und ROS-Positionsseiten, nur mit anderer URL.

## Kleine, gerechtfertigte Erweiterungen an bestehendem Code

- `playersMeta.js`: `status` zu `SLIM_KEYS` hinzufügen. Fehlt aktuell komplett — ohne das tauchen zurückgetretene/inaktive Spieler in der Free-Agent-Liste auf.
- `useDynastyStore.js`: `injury_status` in die `enrichedRosters`-Anreicherung übernehmen (Feld existiert schon in `playersMeta`, wird beim Bauen von `leagueRosters` nur nicht durchgereicht). Nötig, damit die Lineup-Empfehlung verletzte Spieler ausschließen kann.

Beides sind additive Ein-Zeiler an geteiltem Code, kein Umbau.

## Neuer Server-Endpoint

`GET /api/rankings/fantasypros-position?pos=QB&scope=week|ros&scoring=ppr`

- `pos`: `QB | RB | WR | TE | DST` (DEF intern als `DST`, wie Sleeper/FantasyPros es nennen)
- `scope=week`: aktuelle Wochen-ECR-Rankingseite je Position (z. B. `qb.php`, `ppr-rb.php`, `te.php`, `dst.php`)
- `scope=ros`: Rest-of-Season-Rankingseite je Position (ROS-Pendant der obigen URLs)
- Exakte URL-Struktur je Position/Scope wird beim Implementieren live gegen FantasyPros verifiziert (Scoring-Suffix existiert vermutlich nur bei RB/WR/TE, nicht bei QB/DST) — Fallback-Logik: schlägt eine Positions-URL fehl, liefert die Route `ok:false` für genau diese Position, keine Kaskade.
- Response-Form identisch zu `/api/rankings/fantasypros` (`{ ok, meta, players }`), `players` normalisiert über die bestehende `normalizeFantasyProsPlayer`.
- Caching: In-Memory-Map wie bei `ktc-dynasty`, Key = `${pos}:${scope}:${scoring}`. TTL: `week` 6h, `ros` 24h (ROS ändert sich langsamer).

## Neuer Client-Store

`useWeeklyRankingsStore` (gleiches Muster wie `useDynastyValuesStore`): lädt/cached FP-Weekly+ROS-Rankings je angefragter Position, TTL-gesteuert, kein Re-Scrape bei jedem Seitenaufruf. Wird ausschließlich von `/waiver` befüllt (kein Hintergrund-Auto-Load wie bei Dynasty-Werten, da Redraft-Ligen die Werte gar nicht brauchen, solange die Seite nicht offen ist).

## Neue reine Logik: `src/services/analysis/waiverStats.js`

Testbar wie `marketStats.js`, keine React-Abhängigkeit:

- `freeAgents({ playersMeta, leagueRosters })` — alle Spieler aus `playersMeta` (aktiv, `status`-Filter), die in keinem `leagueRosters[].players` auftauchen.
- `pickupRanking({ freeAgents, mode: 'redraft'|'dynasty', dynastyValues, rosRankByPlayer, trendingAdds })` — sortiert nach KTC-Wert (Dynasty) bzw. ROS-Rang (Redraft), reichert mit 🔥-Trend-Badge an (Schnittmenge mit `trendingAdds`).
- `streamingBoard({ freeAgents, weeklyRankByPos, rosRankByPos, positions })` — für jede ausgewählte Position (DEF/QB/TE) zwei sortierte Listen: Weekly und ROS.
- `bestLineup({ myRosterPlayers, rosterPositions, weeklyRankByPlayer })` — Greedy-Zuteilung: pro Slot-Typ (aus `effRoster`, den echten Liga-Slots inkl. Superflex/Mehrfach-FLEX) den bestplatzierten verfügbaren Spieler zuerst, Rest in FLEX-fähige Slots, Rest Bank. Schließt Bye-Week und `injury_status === 'Out'` aus der Empfehlung aus, markiert sie aber, falls sie aktuell trotzdem im Sleeper-Lineup stehen.
- `compareToActualStarters({ recommended, actualStarterIds })` — Diff: `isOptimal` (bool) + Liste der Abweichungen (rein/raus je Slot).

## Komponenten

Neue Seite `WaiverPage.jsx` (Route `/waiver`, Orchestrator wie `AnalysisPage.jsx`), mit drei unabhängigen Bausteinen:

1. **`PickupSuggestions`** — Tabelle: Name/Pos/Team, Wert/Rang, 🔥-Badge bei Trending-Add. Datenquelle je nach `draftMode`/Liga-Typ automatisch (dynasty → KTC, redraft → FP-ROS), kein manueller Umschalter nötig (folgt der bestehenden Redraft/Dynasty-Erkennung).
2. **`StreamingBoard`** — Checkboxen DEF/QB/TE (State in `useUIStore`, kein neuer Store), pro aktivierter Position zwei Spalten nebeneinander: **Diese Woche** (FP-Weekly) und **ROS** (FP-Rest-of-Season) — nur Free Agents. Spaltenbeschriftung bewusst "ROS", nicht "nächste 3 Wochen" — es ist eine Rest-of-Season-Einschätzung, kein echtes 3-Wochen-Fenster, und soll nicht als etwas anderes beschriftet werden, als es ist.
3. **`RecommendedLineupCard`** — beste Aufstellung aus dem eigenen Kader für die aktuelle Woche + Status "✓ bereits optimal gesetzt" oder Diff-Liste. Kein Projection-Quellen-Vergleichs-Chart (bewusst aus dem Scope raus, siehe Entscheidung unten).

## Navigation

Desktop: 5. Eintrag in `TabsNav.jsx`. Mobile: Eintrag in `MobileMoreSheet` neben "Trade" (kein Bottom-Bar-Slot, gleiche Begründung wie bei Trade — niedrigere Zugriffsfrequenz als Board/Analyse).

## Bewusst nicht umgesetzt

- **Projection-Genauigkeits-Vergleichschart** (rechte Hälfte des Dynasty-Daddy-Vorbilds): bräuchte mehrere Projection-Quellen + Trefferquoten-Historie über Wochen. Nur eine Quelle (FantasyPros) geplant, Mehrwert ggü. Aufwand aktuell nicht gegeben. Kann später als eigenständige Erweiterung nachgezogen werden, wenn eine zweite Wochen-Datenquelle dazukommt.
- **Kicker (K)** bleibt außerhalb von Pickup-Liste und Streaming-Board — vom Nutzer nicht verlangt, gleiche Ausschluss-Logik wie an anderen Stellen im Projekt (`SCORING_EXCLUDED_POS`).
- **Waiver-Order/FAAB-Budget-Tracking** — nicht Teil der Anfrage, kein Datenpfad dafür vorgesehen.
- **Wochen-Auswahl (vor/zurück)** — MVP zeigt nur die aktuelle Woche (`fetchNflState`). Historische oder zukünftige Wochen sind kein Teil dieses Scopes.

## Fehlerbehandlung

Scraping-Fehler pro Position/Scope (FantasyPros-Struktur geändert, 502) lassen nur den betroffenen Baustein "Rankings gerade nicht verfügbar" zeigen — kein Absturz der Seite, keine Kaskade auf die anderen zwei Bausteine. Fehlt `mySleeperRosterId` (kein eigener Kader in der Liga gefunden), verschwindet nur `RecommendedLineupCard`; Pickup-Liste und Streaming-Board bleiben nutzbar, da sie nicht vom eigenen Kader abhängen.

## Tests

- `waiverStats.test.js`: `freeAgents`-Filterung (inaktive/rostered raus), `bestLineup`-Zuteilung inkl. Bye/Injury-Ausschluss und Superflex-Slot-Fall, `compareToActualStarters`-Diff (identisch, ein Unterschied, mehrere Unterschiede).
- Server-Route-Test wie `rankings.test.js`: HTML-Fixture rein (inkl. Fixture mit fehlendem `ecrData` für den Fehlerfall), normalisierte Spieler bzw. `ok:false` raus.
