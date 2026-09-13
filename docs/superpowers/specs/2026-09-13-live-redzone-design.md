# Live-Redzone — Design

**Datum:** 2026-09-13 · **Status:** Entwurf, wartet auf Review

## Ziel

Eine Spieltag-Ansicht `/redzone`, die während laufender NFL-Spiele alles Wichtige
zu den eigenen Teams über alle Ligen bündelt — orientiert an Sleeper Scores,
ESPN Fantasy Cast und FantasyPros My Playbook Live. Filterbar nach Ligen
(alle / mehrere / eine).

## Entscheidungen (mit Dario abgestimmt)

- **Fünf Bausteine:** Matchup-Scoreboard, Meine Spieler live, Redzone-Alarm,
  NFL-Spielleiste, TD-Ticker.
- **Sichtbarkeit:** Solange mind. ein Spiel `in_game` ist → LIVE-Eintrag in der
  Desktop-Rail (`NextShell`) und im Mobil-Mehr-Sheet (`MobileMoreSheet`) plus
  Banner oben im Dashboard. Sonst beides weg; `/redzone` direkt aufgerufen zeigt
  "Nächster Kickoff: …".
- **Filter:** ein Haken-Chip pro Liga, **kein "Alle"-Chip**. Standard: alle an;
  die letzte angehakte Liga lässt sich nicht abwählen. Doppelklick (mobil:
  Langdruck) = nur diese Liga, nochmal = wieder alle. Neu hinzugekommene Ligen
  sind automatisch angehakt (gespeichert werden die **abgewählten** IDs:
  `sdh-redzone-v1` → `{ deselectedLeagueIds: string[] }`). Wirkt auf alle
  Bausteine.
- **Kein neuer Server-Endpoint.** `site.api.espn.com` liefert
  `access-control-allow-origin: *` (live verifiziert 2026-09-13), Sleeper ist
  ohnehin CORS-offen. Alles läuft im Client → keine Deploy-Falle
  (fehlende Server-Dateien → 503), funktioniert identisch in Capacitor.
- **Takt:** 30 s Polling, pausiert bei `document.hidden`.
- **Umfang:** alle geladenen Ligen der Saison (`availableLeagues`), Redraft und
  Dynasty gleich. Mocks/Drafts ohne Liga nicht.

## Datenquellen (alle live getestet am 2026-09-13)

| Zweck | Endpoint | Felder |
|---|---|---|
| Live-Erkennung (billig) | `api.sleeper.com/schedule/nfl/regular/{season}` | `status: 'in_game'`, `week`, `date`, `home`/`away` |
| Spielleiste + Redzone | `site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard` | `status.type.state/shortDetail`, Scores, `situation.{isRedZone, possession, downDistanceText, lastPlay.text, lastPlay.probability}` |
| TD-Ticker | `site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={id}` | `scoringPlays[].{id, text, team.id, period, clock}` |
| Live-Punkte | `api.sleeper.app/v1/league/{id}/matchups/{week}` | `players_points`, `starters`, `points`, `matchup_id` |
| Projektion / Siegchance | bestehend: `useWeeklyRankingsStore` + `projectedTotalForStarters` + `computeMatchupProbability` | — |
| Spieler-Stammdaten | bestehend: `loadPlayersMetaCached` | `full_name`, `first_name`, `last_name`, `team`, `position`, `injury_status` |

Verworfen: Sleeper-GraphQL (undokumentiert), FantasyPros-RSS (leer),
RotoWire-RSS (5 Einträge, ~2 h Verzug), kostenpflichtige/kontingentierte APIs.
Sleeper-Stat-Zeilen (`/stats/nfl`) hängen ~4 min nach → **nicht** in v1; die
Punkte aus `players_points` reichen, ESPN liefert die Aktion.

**Bekannte Fallen:**
- ESPN-Kürzel `WSH` ≠ Sleeper `WAS` (Alias wie in `server/rankings.js`).
- ESPN `situation.possession` ist eine **Team-ID**, nicht das Kürzel → über
  `competitors[].team.id` auflösen.
- ESPN-Scoring-Plays haben **keine Spieler-IDs**, nur Text ("Mike Gesicki 2 Yd
  pass from Joe Burrow (Evan McPherson Kick)"). Zuordnung über den vollen Namen
  im Text, eingeschränkt auf Spieler des punktenden Teams; DEF über das Team
  selbst bei Defensiv-/Special-Teams-TDs.
- Maßgebliche Woche ist die Sleeper-State-Woche (`fetchNflState().week`).

## Architektur

```
services/redzone/
  espnLive.js          fetchScoreboard(), fetchScoringPlays(eventId), normalizeScoreboard(json)
  espnLive.test.js
  redzoneModel.js      reine Funktionen → Bausteine
  redzoneModel.test.js
stores/useRedzoneStore.js   Polling, Rohdaten, Filter (persist: sdh-redzone-v1)
hooks/useGamesLive.js       Schedule-Poll (2 min) → { live, nextKickoff }
pages/RedzonePage.jsx       Layout, rendert Bausteine
components/redzone/         GameStrip, MatchupTile, MyPlayersList, RedzoneAlerts, TdTicker, LeagueFilterChips
styles/redzone.css
```

**`espnLive.js`** — dünne Fetch-Schicht + `normalizeScoreboard` →
`games: [{ id, state, detail, home:{abbr,score,id}, away:{…}, possessionAbbr,
isRedZone, downDistance, lastPlay, homeWinPct }]`, Kürzel normalisiert.

**`redzoneModel.js`** (rein, testbar, Kern der Logik):
- `applyLeagueFilter(leagues, selectedIds)` — leeres Set = "Alle".
- `playerGameState(player, gamesByTeam)` → `pre | in | post` + Spiel.
- `buildMatchupTiles({ leagues, matchupsByLeague, rostersByLeague, usersByLeague, myUserId, projArgs, gamesByTeam })`
  → Kacheln inkl. Siegchance (`computeMatchupProbability`) und "noch zu spielen"
  (Starter mit `pre`/`in`), sortiert nach knappster Siegchance zuerst.
- `buildMyPlayers(...)` → ligaübergreifend nach `player_id` gebündelt:
  `{ player, points, myLeagues:[...], opponentLeagues:[...], gameState }`,
  sortiert live → pre → post.
- `buildRedzoneAlerts(games, myPlayers)` → Spiele mit `isRedZone`, deren
  Ballbesitz-Team eigene **oder** gegnerische Starter hat; je Spieler markiert,
  ob meiner (gut) oder Gegner (schlecht).
- `matchScoringPlay(play, teamAbbr, candidates)` → betroffene Spieler.

**`useRedzoneStore`** — hält `games`, `matchupsByLeague`, `scoringPlaysByEvent`,
`selectedLeagueIds` (persistiert), `lastUpdated`, `error`. `poll()` lädt
Scoreboard + Matchups der gefilterten Ligen parallel; Summary nur für Spiele im
Zustand `in`/`post` **mit eigenen oder gegnerischen Startern** und **nur, wenn
sich der Spielstand dieses Spiels seit dem letzten Summary-Abruf geändert hat**
(Scoring-Plays ändern sich nur mit dem Score; ein Summary ist ~32 KB gzip, ohne
diese Regel wären es bei 8 relevanten Spielen ~30 MB/h statt ~6 MB/h). Beendete
Spiele werden nach dem letzten Abruf nicht mehr geladen. Rosters/Users
einmal pro Liga je Besuch (ändern sich während des Spieltags nicht). Neue
Scoring-Plays werden an ihrer `id` erkannt → kurze Hervorhebung im Ticker.

**`useGamesLive`** — in `App.jsx` genutzt (Nav, Banner). Pollt den
Sleeper-Schedule alle 2 min (nur bei sichtbarem Tab), liefert `live` und den
nächsten Kickoff.

## Layout

**Desktop (≥900px, NextShell):** oben Spielleiste (horizontal scrollbar, Karte je
Spiel: Kürzel, Stand, Quarter/Uhr, Ballbesitz-Markierung, Redzone-Markierung,
Zähler "3 meine · 1 Gegner"). Darunter Filter-Chips. Darunter **Matchups als flache
Reihe** über die volle Breite (Grid, bricht bei vielen Ligen um): pro Liga nur
Name, Stand, Siegchance, Balken, offene Starter (meine · Gegner) — keine
Avatare/Teamnamen/Projektionen. Darunter zweispaltig: links **Meine Spieler**
(nur eigene; Gruppen Läuft / Noch nicht / Fertig), rechts Redzone-Alarm, darunter
**Gegner live** (gegnerische Starter in laufenden Spielen), darunter Scoring-Ticker.

**Mobil (<900px, AppShell):** Filter-Chips sticky oben, Redzone-Alarm als Band,
Matchup-Reihe seitlich wischbar, Spielleiste seitlich wischbar, dann Meine Spieler,
Gegner live, Scoring.

**Design-System:** Broadcast Lower-Third — Role-Tokens, `--live` für
LIVE/Redzone, `--good`/`--bad` für meine vs. Gegner-Spieler, Zahlen JetBrains
Mono tabular, Icons nur über `Icon.jsx`, keine Side-Stripe-Borders, keine Emojis.
Die flache Matchup-Kachel ist eine eigene kleine Komponente; die Siegchance kommt
wie in `LeagueCard.MatchupBlock` aus `computeMatchupProbability` (inkl. Fallback
Punkteanteil). Entwurf: `docs/mocks/redzone-mocks.html`.

**Live-Farbe pro Theme:** Rot ist die Live-/Redzone-Farbe, aber immer das Token
`--live` des Themes. Neues Token `--live-on` (Text auf `--live`-Fläche) in allen
Theme-Blöcken von `tokens.css`. Ferrari und Nike haben einen roten Akzent, dort
weicht `--live` ab (gemessen 2026-09-13, Farbton-Abstand zum Akzent 8° bzw. 6°):
Ferrari `--live: #fff200` (Giallo Modena, Text/Card 12.9:1, `--live-on: #111111`),
Nike `--live: #d14900` (Text/Weiß 4.5:1, `--live-on: #ffffff`). Das färbt in diesen
zwei Themes auch die bestehenden "Out"-/Warn-Markierungen um (gewollt: sie heben
sich dann ebenfalls vom Akzent ab). Bestehendes `color: #fff` auf `--live`
(`style.css` ~2754) wird auf `var(--live-on)` umgestellt; `themes.test.js` bleibt
unverändert (kein neues Theme).

## Fehlerbehandlung

- ESPN nicht erreichbar → Spielleiste/Alarm/Ticker zeigen "ESPN-Daten gerade
  nicht verfügbar", Matchups + Spielerpunkte (Sleeper) laufen weiter.
- Matchups einer Liga schlagen fehl → diese Kachel mit Fehlerhinweis, Rest normal.
- Projektionen fehlen → Kachel ohne Siegchance, Fallback auf Punkteanteil (wie
  `MatchupBlock`).
- Scoring-Play ohne Namenstreffer → erscheint nicht im Ticker (lieber weglassen
  als falsch zuordnen).
- "Stand vor X s" sichtbar; Hinweisfarbe, wenn älter als 2 min.

## Tests

- `redzoneModel.test.js`: Filter ("Alle", mehrere, eine); Bündelung eines Spielers
  über Ligen inkl. Gegner-Rolle; Spielstatus pro Spieler; Redzone-Alarm nur bei
  beteiligten Startern und korrektem Ballbesitz; Scoring-Play-Match (Passer +
  Receiver, gleicher Name in anderem Team ≠ Treffer, DEF-TD).
- `espnLive.test.js`: `normalizeScoreboard` gegen eine gekürzte echte Antwort
  (Fixture aus dem Live-Test 2026-09-13), inkl. `WSH→WAS` und
  Possession-ID→Kürzel.
- `useGamesLive`: `in_game` → live; nur `pre`/`complete` → nicht live + nächster
  Kickoff.
- Manuelle Verifikation in einem Live-Slot mit echtem Account, beide Shells; was
  nicht live geprüft werden konnte, wird benannt.

## Nicht in v1

Sleeper-Stat-Zeilen, Push-Benachrichtigungen bei Redzone/TD, Inaktiven-News,
Siegchance-Verlauf als Sparkline, Play-by-Play-Feed, Filter-Presets.
