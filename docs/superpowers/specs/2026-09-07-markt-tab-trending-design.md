# Markt-Tab: Trending-Kacheln (Sleeper Waiver-Trends) — Design

Status: entworfen, noch nicht implementiert

## Problem

Der Markt-Tab der Analyse-Seite (`MarketTab.jsx`) zeigt genau eine Kachel:
"Umstrittenste Spieler" — die ADP-Streuung aus FFC-Mock-Drafts, gefiltert auf
Spieler, die im aktuellen Board noch nicht gepickt sind (`marketDisagreement()`
in `marketStats.js`). Das Problem: die Filterung gegen die eigenen Picks macht
die Kachel nach einem fortgeschrittenen Draft dünn — meist bleiben nur wenige
Positionen (oft fast nur TE) übrig, deren hohe Streuung nichts über echte
Marktuneinigkeit aussagt, sondern nur über die kleine Restauswahl.

Der Tab heißt "Markt", liefert aber keine aktuellen, laufenden Marktdaten —
nur eine statische Draft-Kennzahl. Für Season-Long-Entscheidungen (Waiver,
wer trended gerade) bietet er nichts.

Sleeper stellt dafür einen öffentlichen, ligaübergreifenden Endpunkt bereit
(`/players/nfl/trending/{add|drop}`), der zeigt, welche Spieler aktuell (Default:
letzte 24h) am meisten hinzugefügt bzw. fallengelassen werden — echtes,
zeitnahes Marktsignal, ohne neuen Scraping-Aufwand. Die App hat bereits alles,
um daraus Namen/Team/Position/Verletzungsstatus zu machen: `loadPlayersMetaCached()`
cached den kompletten Sleeper-Spieler-Datensatz 24h in `localStorage`.

## Ziele

- Markt-Tab bekommt zwei neue Kacheln: "Meistgeholt" und "Meistgedroppt",
  basierend auf Sleepers Trending-Endpunkt (letzte 24h, Top 15).
- Funktioniert unabhängig vom aktuellen Board/Draft-Zustand — auch im
  Mock-Draft-Modus ohne Liga-Kontext, da nicht gegen Liga-Rosters gefiltert
  wird (Nutzerentscheidung: alle trending Spieler zeigen, nicht nur
  Free-Agents der eigenen Liga).
- Jeder Eintrag verlinkt zum Spieler (FantasyPros-Profil, bestehendes Muster).
- Ladezustand und Netzwerkfehler dürfen die Seite nicht zum Absturz bringen —
  gleiches Fehlerverhalten wie der bestehende `usePlayerNews`-Hook.

## Nicht-Ziele

- Keine Filterung nach Liga-Rosters/Free-Agent-Status. Das würde Liga-Kontext
  voraussetzen (nicht immer vorhanden, z. B. Mock-Draft) und ist explizit
  nicht gewünscht.
- Keine Positions-Ausschlüsse (K/DEF bleiben drin) — anders als bei
  `marketDisagreement()`, wo K/DEF ein Streuungs-Artefakt sind, ist ein
  trendender Kicker/Streaming-DST hier ein echtes Signal.
- Kein News-Teaser pro Trend-Eintrag. `usePlayerNews` bleibt auf
  Einzelspieler-Ansichten (Board-Inspector, Detail-Sheet) beschränkt — 15–25
  Scraping-Requests pro Tab-Öffnung wären unverhältnismäßig.
- Die bestehende "Umstrittenste Spieler"-Kachel bleibt unverändert bestehen.
- Kein konfigurierbares Zeitfenster/Limit in der UI — 24h/Top 15 sind fest
  codiert (YAGNI, kann bei Bedarf später Parameter werden).

## Architektur

### Neue/geänderte Dateien

```
src/services/api.js                    + fetchTrendingPlayers(type, opts)
src/hooks/useTrendingPlayers.js        neu — lädt & merged Trending-Daten
src/hooks/useTrendingPlayers.test.js   neu
src/components/analysis/MarketTab.jsx  + zwei StatCards
src/utils/formatting.js                + fantasyProsPlayerUrl(name)
src/components/NextBoard.jsx           nutzt fantasyProsPlayerUrl() statt Inline-FP_PLAYER
src/components/PlayerDetailSheet.jsx   nutzt fantasyProsPlayerUrl() statt Inline-Template
src/styles/analysis.css                + Badge-Klassen für Trend-Zeilen
```

### Datenfluss

1. **`fetchTrendingPlayers(type, { lookbackHours = 24, limit = 25 } = {})`**
   in `api.js`, gleiches Muster wie die übrigen Sleeper-Fetches dort:
   `GET ${SLEEPER_API_BASE}/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`.
   `type` ist `'add'` oder `'drop'`. Antwort: `[{ player_id, count }]`.

2. **`useTrendingPlayers()`** (Hook, Vorbild `usePlayerNews.js`):
   - Lädt beim Mount `fetchTrendingPlayers('add', ...)`,
     `fetchTrendingPlayers('drop', ...)` und `loadPlayersMetaCached()`
     parallel (`Promise.all`).
   - Merged pro Eintrag: `{ player_id, count, name, team, pos, injury_status }`
     — `name`/`team`/`pos`/`injury_status` aus dem Spieler-Cache
     (`full_name`, `team`, `fantasy_positions[0] || position`, `injury_status`).
     Einträge ohne Treffer im Cache (sehr selten, z. B. brandneue IDs) werden
     übersprungen statt mit leerem Namen gerendert.
   - State: `{ adds, drops, state }` mit `state: 'idle' | 'loading' | 'ok' | 'error'`
     — ein gemeinsamer State für beide Listen reicht, da sie immer zusammen
     geladen werden und sich das UI nicht getrennt pro Liste verhält.
   - Kein eigenes Caching über die Hook-Lifetime hinaus: `loadPlayersMetaCached`
     hat schon einen 24h-`localStorage`-Cache, die Trending-Zahlen selbst sind
     kurzlebig genug, dass ein Re-Fetch bei jedem Tab-Öffnen sinnvoll ist.

3. **`MarketTab.jsx`** ruft `useTrendingPlayers()` auf und rendert zwei neue
   `StatCard`s unterhalb der bestehenden Kachel:
   - `title="Meistgeholt"`, `hint="Wer wird gerade ligaübergreifend am meisten vom Waiver geholt."`
   - `title="Meistgedroppt"`, `hint="Wer wird gerade ligaübergreifend am meisten abgegeben."`
   - Beide: `basis="Sleeper, ligaübergreifend, letzte 24h"`.
   - Bei `state === 'loading'`: `empty="lädt …"`.
   - Bei `state === 'error'`: `empty="Trend-Daten von Sleeper aktuell nicht erreichbar."`.
   - Bei leerem Ergebnis (Sleeper liefert 0 Einträge): `empty="Keine Trend-Daten verfügbar."`.
   - Zeilen-Layout je Eintrag: Positions-Badge (`posColor(pos)`, wie
     Bestandskachel) · Name als Link (`fantasyProsPlayerUrl(name)`,
     `target="_blank" rel="noreferrer"`) · Team · Verletzungs-Badge falls
     `injury_status` gesetzt (Kurzform `Q` für "Questionable", sonst
     Originalwert, analog zum `ns-inj`-Muster in `NextBoard.jsx`, hier als
     neue `an-inj`-Klasse) · Count rechtsbündig, `count.toLocaleString('de-DE')`.

4. **`fantasyProsPlayerUrl(name)`** in `formatting.js`:
   ```js
   export const fantasyProsPlayerUrl = (name) =>
     `https://www.fantasypros.com/nfl/players/${fantasyProsSlug(name)}.php`
   ```
   Ersetzt die inline duplizierte Version in `NextBoard.jsx` (`FP_PLAYER`) und
   `PlayerDetailSheet.jsx` (Template-String) — mit dieser dritten Nutzung lohnt
   sich die gemeinsame Stelle, spätere Änderungen (z. B. andere Zielseite)
   passieren dann an einer Stelle statt drei.

### Styling

`analysis.css` bekommt eine kompakte Listen-Zeile für Trend-Einträge (Flexbox:
Badge, Name+Link, Team, optionale Verletzungs-Badge, Count), angelehnt an das
bestehende `an-whisker`-Zeilenmuster in derselben Datei — kein neues
Layout-System.

## Fehlerverhalten

- Sleeper-API nicht erreichbar → `state: 'error'`, Kachel zeigt Fehlertext
  statt zu crashen (wie `usePlayerNews`).
- `loadPlayersMetaCached()` scheitert → liefert laut bestehender Implementierung
  bereits `{}` zurück (kein Throw); der Merge-Schritt in `useTrendingPlayers`
  überspringt dann alle Einträge mangels Metadaten → leere Liste,
  `state` bleibt `'ok'` (kein Netzwerkfehler im engeren Sinn), Kachel zeigt
  den "keine Trend-Daten"-Text.

## Testing

- `useTrendingPlayers.test.js`: mockt `fetchTrendingPlayers` und
  `loadPlayersMetaCached`, prüft Merge (Name/Team/Pos/Injury aus Cache),
  Sortierung (Sleeper liefert bereits sortiert — kein eigenes Sortieren nötig,
  Test verifiziert das lediglich), und den Fehlerpfad (Fetch wirft →
  `state === 'error'`).
- Kein neuer Test für `fantasyProsPlayerUrl` nötig (Ein-Zeiler,
  `fantasyProsSlug` selbst ist bereits getestet).
