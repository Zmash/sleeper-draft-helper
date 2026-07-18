# FantasyPros Ranking-Import (Scraper) + reservierter API-Key

**Datum:** 2026-07-18
**Status:** Design freigegeben, bereit für Implementierungsplan

## Ziel

Eine **zusätzliche** Ranking-Import-Quelle: FantasyPros Consensus-Rankings (Redraft)
für Standard / Half-PPR / PPR. Der bestehende Import (CSV, FantasyCalc-Auto-Import,
KTC) bleibt **unverändert** — es kommt nur eine neue Option dazu.

Der in `src/.env` hinterlegte `FANTASY_PROS_API_KEY` wird in dieser Session **nicht
für den Ranking-Import** verwendet (dazu unten mehr), aber für spätere Spieler-Info-,
News- und Verletzungs-Abrufe (bei Klick auf einen Spieler) verdrahtet und bereitgehalten.

## Warum Scraper statt API

Der vorhandene Key liegt auf dem **öffentlichen/kostenlosen Tier**
(`"public_api_limited": true, "limit": 10`). Getestet: die
`consensus-rankings`-API liefert damit **maximal 10 Spieler pro Position**
(~60 offensive Spieler gesamt) — für ein Draft-Board (150–300 Spieler) unbrauchbar.
Pagination (`limit`/`offset`/`page`) wird ignoriert.

Die öffentlichen Cheatsheet-Seiten betten dagegen die **vollständige** Rangliste als
`var ecrData = {…}` im HTML ein (getestet: 510–783 Spieler, mit ECR, Tier, Pos-Rank,
Bye). Das ist dieselbe Datenstruktur wie die API, nur ungekürzt. Deshalb: scrapen wie
bei KTC/FFC, nicht die limitierte API nutzen.

## Datenquellen

| `scoring` | Cheatsheet-URL | ecrData `type` |
|-----------|----------------|----------------|
| `ppr`  | `https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php` | `Draft PPR` |
| `half` | `https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php` | `Draft Half PPR` |
| `std`  | `https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php` | `Draft` |

Mapping App-`effScoringType` → `scoring`: `ppr → ppr`, `half_ppr → half`,
`standard → std`.

### Relevante Felder im `ecrData.players[]`

| FantasyPros-Feld | Board-Feld | Hinweis |
|---|---|---|
| `rank_ecr` | `ecr` / `rk` | numerischer Consensus-Rank |
| `player_name` | `name` | |
| `player_team_id` | `team` | z. B. `CIN` |
| `player_position_id` | `pos` | QB/RB/WR/TE/K/DST |
| `pos_rank` | `posRank` | z. B. `WR1` |
| `tier` | `tier` | |
| `player_bye_week` | `bye` | |
| — | `adp` | null (kommt via FFC-Overlay, siehe Pipeline) |
| — | `dynasty_value`, `age`, `years_exp` | null (Redraft-Quelle) |

## Architektur

### 1. Server-Route (`src/server/apiRoutes.js` — einzige Quelle)

`GET /api/rankings/fantasypros?scoring=ppr|half|std`

- `scoring` validieren (Default `ppr`), auf die passende Cheatsheet-URL mappen.
- Seite mit Browser-`User-Agent` fetchen (wie KTC-Routen).
- `ecrData` aus dem HTML extrahieren, Spieler normalisieren, auf
  `QB/RB/WR/TE/K/DST` filtern.
- Antwortform wie KTC: `{ ok: true, players: [...], meta: {...} }`.
- Fehlerpfade wie KTC: Upstream-nicht-ok → `502`; keine Spieler gefunden →
  `502` mit deutscher Meldung `"Keine Spieler gefunden – FantasyPros-Struktur
  möglicherweise geändert"`; Exception → `500`.

### 2. Reine, getestete Helfer (`src/server/rankings.js`)

- `extractEcrData(html)` → geparstes `ecrData`-Objekt oder `null`.
  **Balanced-Brace-Extraktion** ab `ecrData` + erster `{` (robuster als Regex
  gegen verschachtelte Objekte/Strings). Keine externe Abhängigkeit.
- `normalizeFantasyProsPlayer(raw)` → Board-Spieler-Shape (identisch zu
  `normalizeFfcPlayer`/FantasyCalc-Route: `id, rk, ecr, name, team, pos, posRank,
  bye, tier, adp, dynasty_value, age, years_exp`), inkl. `nname` via
  `normalizePlayerName`.
- Konstante erlaubter Positionen, z. B. `FP_POSITIONS = ['QB','RB','WR','TE','K','DST']`.

**Tests** (`src/server/rankings.test.js`): kleine HTML-Fixture mit eingebettetem
`ecrData` → `extractEcrData` liefert die Spieler; Extraktion überlebt verschachtelte
`{}`; `normalizeFantasyProsPlayer` mappt Felder korrekt; unbekannte Positionen werden
gefiltert.

### 3. Client-Store (`src/stores/useBoardStore.js`)

Neu: `handleFantasyProsImport({ effScoringType, force = false })`, aufgebaut wie
`handleKtcRookieImport` + Pipeline von `handleAutoImport`:

1. Bei vorhandenem Board und `!force`: `{ ok:false, needsConfirm:true }` zurück
   (Bestätigung liegt beim Aufrufer, wie beim Auto-Import).
2. Snapshot der bisherigen Herkunft (`boardPlayers/boardSource/marketMeta`) für Undo.
3. FantasyPros-Route für das gemappte `scoring` fetchen.
4. FFC-ADP-Overlay + `enrichWithInjuries` **wie im FantasyCalc-Auto-Import**
   (`mergeRankingsWithMarket(fpPlayers, ffcPlayers)`; FFC-Fehler/Rookie → Board bleibt
   ohne Markt, kein Abbruch). Verletzungs-Enrichment ist Kür (Fehler kippt Import nicht).
5. `set({ boardPlayers, marketMeta, lastImportStats, lastBoardSnapshot, boardSource:'market',
   boardMode:'redraft', csvRawText:'' })`, danach ggf. `loadPicks`.

FantasyPros ist eine **Redraft**-Quelle → immer `boardMode:'redraft'`, FFC-Overlay
zulässig (im Gegensatz zum Rookie-Pfad).

### 4. UI

FantasyPros als neue Redraft-Import-Quelle neben dem FantasyCalc-Auto-Import
anbieten (Label z. B. **„FantasyPros (Consensus ECR)"**). Bestehende Optionen
(CSV, FantasyCalc, KTC) bleiben unverändert. Bestätigungs-/`force`-Fluss und
Fehleranzeige analog zum vorhandenen `runImportForMode` in `BoardSection.jsx`.
Der genaue Einbauort (Setup-Import-UI vs. `BoardSection`-Direktimport) wird im
Implementierungsplan festgelegt, nachdem die aktuelle Import-UI gelesen wurde.

### 5. API-Key reservieren (`dotenv`)

`dotenv` ist bereits als Dependency vorhanden, wird aber nirgends geladen. Im
Dev-Entrypoint (`src/server/index.js`) `dotenv` so konfigurieren, dass `src/.env`
geladen wird, damit `process.env.FANTASY_PROS_API_KEY` verfügbar ist. **Kein
Endpoint nutzt den Key in dieser Session** — nur vorbereiten, klar kommentiert als
„reserviert für spätere FantasyPros-Spieler-Info/News/Verletzungen".

Prod (`prod.js`) setzt den Key später über die Host-Umgebung (die `.env` ist
gitignored und wird nicht deployt) — das ist erst relevant, wenn das Spieler-Info-
Feature gebaut wird, und kein Teil dieser Session.

## Nicht in dieser Session (bewusst ausgeklammert)

- Spieler-Info/News/Verletzungen aus der FantasyPros-API (nur Key vorbereiten).
- Dynasty/Rookie-Rankings von FantasyPros (KTC deckt das ab).
- Prod-Env-Verdrahtung des Keys.
- Caching der Cheatsheet-Fetches (Parität zu KTC/FFC: kein Cache).

## Risiken

- **HTML-Struktur ändert sich:** `var ecrData`-Muster könnte wegfallen →
  klarer 502-Fehler auf Deutsch, Board bleibt beim Alten. Gleiche Fragilität wie
  der bestehende KTC-Scraper, bewusst akzeptiert.
- **Seitengröße** (~730 KB HTML pro Import): vertretbar, Import ist selten;
  entspricht dem KTC-Scraping-Aufwand.
