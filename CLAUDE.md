# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite client only (http://localhost:5173)
npm run dev:api    # Express AI proxy only (http://localhost:5175)
npm run dev:all    # Both concurrently (needed for any AI/rankings feature)
npm run build      # Vite production build → dist/
npm run preview    # Preview the production build

npm test          # Vitest einmalig
npm run test:watch # Vitest im Watch-Modus

npm run cap:copy         # Copy web build into the Android project
npm run cap:open:android # Open Android Studio (Capacitor)
```

`npm test` (Vitest, einmalig) und `npm run test:watch` **existieren und laufen**. Es gibt **keinen
Linter** — die `eslint-disable-line`-Kommentare im Quelltext sind historisch und durch kein
ESLint-Setup gedeckt.

The app requires a real Sleeper account/username and a user-supplied Anthropic API key to be fully exercised; there are no fixtures.

## Architecture

Two independently-runnable pieces:

1. **React 18 + Vite SPA** (`src/`, everything except `src/server/`). Talks directly to the public **Sleeper API** (`https://api.sleeper.app/v1`, see `src/services/api.js`) for all league/draft/pick data — no backend needed for core draft tracking.
2. **Express 5 AI proxy** (`src/server/`). Exists so the user's Anthropic key and web-scraping live server-side. The client calls it under `/api/*`; Vite proxies `/api` → `127.0.0.1:5175` in dev.

### Server-Routen: eine Quelle

`src/server/apiRoutes.js` enthält **alle** `/api/*`-Routen (Rankings, validate-key,
ai-advice, ai-draft-review, ai-trade) samt Tool-Schemas. `index.js` (dev, Port 5175,
CORS) und `prod.js` (prod, Port 8080, serviert `dist/`) sind dünne Entrypoints, die
`registerApiRoutes(app, { model })` aufrufen. **Endpoint-Änderungen passieren nur
noch in `apiRoutes.js`.** AI-Modell-Default: `claude-sonnet-5` (`SDH_MODEL` überschreibt).

- `GET /api/rankings/{fantasycalc,ktc-dynasty,ktc-rookies}` — fetch/scrape third-party rankings (uses `cheerio`).
- `POST /api/validate-key` — validates the Anthropic key (uses `claude-haiku-4-5-20251001`).
- `POST /api/ai-advice`, `POST /api/ai-draft-review`, `POST /api/ai-trade` — all return **SSE streams** with `event: text | result | error`.
- `GET /api/scores`, `POST /api/score` — Field-Goal-Highscores (Easter Egg, no key needed; JSON file via `SDH_SCORES_FILE`, profanity filter `@2toad/profanity` + DE supplement, IP rate limit).

The user's key travels in the `X-Anthropic-Key` header and is stored only in browser localStorage under `sdh_api_key` (`src/services/key.js`). Payloads are Anthropic-native (top-level `system`, tools as `{name, description, input_schema}`, forced `tool_choice`).

### State: split Zustand stores

State is split across per-domain Zustand stores in `src/stores/`. Some are `persist`ed to localStorage, some are in-memory only:

| Store | localStorage key | Notes |
|-------|------------------|-------|
| `useSessionStore` | `sdh-session-v1` | Sleeper user, season, selected league/draft, available leagues/drafts. |
| `useBoardStore` | `sdh-board-v1` | Imported rankings (`boardPlayers`), CSV text, filters, `draftMode`. |
| `useLiveStore` | `sdh-live-v1` | Live picks + auto-refresh polling settings. |
| `useUIStore` | `sdh-ui-v1` | Theme, modal open state, `setupVersion` counter. |
| `useDynastyStore`, `useTradeStore`, `useDashboardStore` | — | Not persisted; rebuilt from API each session. |

`src/stores/migrate.js` runs once in `main.jsx` before render, migrating the old monolithic `draft-helper-state-v3` key into the per-store keys (idempotent).

### Format-Profile — kontext-gebundene Overrides statt eines globalen Keys

Format-Overrides (Scoring, Superflex, Roster-Positionen, Teams/Runden/Typ) und
die Draft-Strategie leben nicht mehr in einem einzigen globalen Key, sondern in
`localStorage`-Key `sdh.profiles.v1` (`src/services/profileStore.js`) — eine
Liste von **Format-Profilen**. Jedes Profil ist entweder an eine echte Liga
(`boundLeagueId`, stabil über Saisons) oder an einen Mock-Draft-Format-
Fingerprint (`fingerprint`, gematcht wie zuvor die Draft-Strategien) gebunden.
`resolveProfile({ draft, league, draftMode })` ist eine **reine** Funktion
(kein Storage-Write, liefert `{ profile, deviations, isNew }`) — sie liefert
bei fehlendem Treffer ein frisches, noch nicht persistiertes Profil zurück;
gespeichert wird erst beim ersten tatsächlichen Edit über
`upsertProfileOverrides`/`upsertProfileStrategy` (verhindert Karteileichen
durch React-StrictMode-Doppelaufrufe aus `useMemo`).

Cross-profilübergreifende "Grundsätze" (freier Strategie-Text, der immer
gilt) liegen separat unter `sdh.strategyPrinciples.v1`.

`ProfileEditor.jsx` dispatcht nach jedem Save (Format-Override, Strategie,
Prinzipien) weiterhin `sdh:setup-changed` (Custom Event) + schreibt in
`localStorage` — `StrategySection.jsx` ist rein präsentational und ruft dafür
nur `onSaveStrategy`/`onSavePrinciples`-Props auf, ohne selbst zu schreiben
oder zu dispatchen. `App.jsx` und `BoardSection.jsx` hören beide unabhängig darauf (Storage-Key-Filter:
`sdh.profiles.v1` / `sdh.strategyPrinciples.v1`) und lösen jeweils selbst über
`resolveProfile()` auf. Beim Anfassen dieser Kette: die Doppel-Auflösung in
`App.jsx` UND `BoardSection.jsx` ist bewusst (beide waren schon vor diesem
Umbau unabhängig) — nicht versuchen, sie in einem gemeinsamen Prop-Pfad zu
vereinheitlichen, ohne die Board-Renderpfade komplett zu verstehen.

### `App.jsx` is the orchestrator

`App.jsx` is large by design: it reads from every store, computes all derived values (`teamsCount`, `effRoster`, `effScoringType`, `ownerLabels`, draft slot, per-team scores) with `useMemo`, runs the global effects (league→draft loading, dynasty roster loading, pick polling, draft-change reset), and passes a shared `pageProps` object down to the route pages. Pages (`src/pages/*Page.jsx`) are relatively thin. Routes: `/dashboard`, `/setup`, `/board`, `/analyse`, `/lineup`, `/trade`, `/profiles`, `/redzone`, `/weekly`, `/scores`; `/` redirects based on whether a Sleeper user id is set. `/waiver` and `/roster` are legacy bookmarks redirecting to `/lineup` and `/analyse`.

### Spieltags-Seiten: `/redzone` (live) und `/weekly` (Rückblick)

Beide Seiten teilen sich die Datenquellen (ESPN-Scoreboard via `services/redzone/espnLive.js`,
Sleeper-Matchups, `services/weekProjections.js`) und das Muster "dünner Store mit Rohdaten +
reines Modell + präsentationale Parts":

| | `/redzone` | `/weekly` |
|---|---|---|
| Frage | Was passiert **gerade**? | Was ist in **dieser Woche** passiert? |
| Sichtbar | nur bei laufenden Spielen (`useGamesLiveStore.liveCount`) | immer |
| Store | `useRedzoneStore` (30-s-Polling) | `useWeeklyStore` (kein Polling, Cache pro Woche) |
| Modell | `services/redzone/redzoneModel.js` | `services/weekly/weeklyModel.js` |

`/weekly` kann jede bereits gespielte Woche anzeigen. Für **zurückliegende** Wochen zählt allein
Sleepers Wochenprojektion (`/api/rankings/sleeper-projections-week`, hat einen Wochenparameter);
FantasyPros liefert unter `scope=week` immer nur die laufende Woche und wird deshalb nur dann
dazugemischt, wenn die gezeigte Woche die laufende ist. `useWeeklyRankingsStore` cacht die
Sleeper-Projektionen pro Woche (`sleeperWeekByKey` / `getSleeperWeekMap`) — `sleeperWeekById`
zeigt immer nur auf die *zuletzt* geladene Woche und ist beim Blättern nicht verlässlich.

Der Liga-Filter (`LeagueChips` aus `components/redzone/RedzoneParts.jsx`) wird geteilt, die
abgewählten IDs aber je Seite getrennt persistiert (`sdh-redzone-v1` / `sdh-weekly-v1`).

### `/scores` — Spielplan, Live-Stand, deutsche Sender

Die einzige Seite ohne Liga-Bezug: sie laeuft auch ohne Sleeper-Account. Quelle ist
dasselbe ESPN-Scoreboard wie in Redzone/Weekly (`services/redzone/espnLive.js`,
`fetchScoreboard`) — dessen `normalizeScoreboard` liefert zusaetzlich zu den
Redzone-Feldern Teamname/Logo/Bilanz, US-Sender (`network`), `venue` und
`neutralSite`; die Redzone liest diese Felder nicht.

| Baustein | Datei |
|---|---|
| Store (kein persist, Cache je Woche) | `stores/useNflStore.js` |
| Reines Modell (Sortierung, Tagesgruppen, Statustexte) | `services/nfl/nflModel.js` |
| Deutsche Rechtetabelle | `data/nflBroadcast.js` |
| Zeitzonen-Helfer | `utils/berlinTime.js` |
| Praesentation | `components/nfl/NflParts.jsx`, `pages/NflPage.jsx` |

Zwei Punkte, die man beim Anfassen kennen muss:

1. **Alle Zeiten sind Europe/Berlin, nicht die Geraetezeitzone.** `utils/berlinTime.js`
   rechnet fest ueber `Intl`; `new Date().getHours()` waere auf einem Handy im
   Ausland falsch. Gruppiert wird nach deutschem Kalendertag — das US-Sonntag-
   abendspiel steht deshalb unter *Montag*.
2. **`data/nflBroadcast.js` ist eine gepflegte Tabelle wie `nflByes.js`**, keine API.
   Sie bildet nur das *Sendefenster* auf Sender ab (abgeleitet aus dem deutschen
   Kickoff-Zeitpunkt), nicht das konkrete Spiel: welches Sonntagsspiel RTL, RTL+
   bzw. Sky in einer Woche waehlen, gibt keine offene Quelle her. Diese Fenster
   sind `selection: true` und werden in der UI als "Auswahl" gekennzeichnet.
   `RIGHTS_SEASONS` begrenzt die Tabelle auf die Saisons des aktuellen
   RTL/Sky-Vertrags — ausserhalb nennt die Seite gar keinen Sender und sagt
   warum, statt eine Rechtelage zu raten. Der NFL Game Pass steht bewusst
   nicht in `outlets`: er zeigt jedes Spiel und waere unter jeder Zeile
   dieselbe Angabe — einmal in der Legende der Seite genuegt.

Die Spielkachel (`GameRow`) hat zwei Layouts aus derselben DOM: ab 561 px
eine zweizeilige Zeile (links Kuerzel/Punkte, rechts Status und Sender,
Meta-Spalte fest 140 px), darunter zwei Kacheln nebeneinander mit
gestapeltem Inhalt (Status / Teams / Sender) — dafuer loest
`.nfl-meta { display: contents }` nur den Meta-Container auf. Was nirgends
Platz hat (voller Teamname, Spielort, Down & Distance), haengt am `title`
der Kachel statt eine weitere Zeile aufzumachen. Nicht angezeigt werden der
US-Sender (fuer "wo kann ich das sehen" ohne Belang) und die Saisonbilanz
(die gehoert in die Tabelle, nicht an jedes Spiel).

Die Seite hat zwei Ansichten (`ViewTabs`, lokaler State): **Spiele** und
**Tabelle**. Die Tabelle wird erst beim Aufschlagen geholt und danach nur,
wenn ihr Stand aelter als 10 Minuten ist (`loadStandings`, eigener Ladepfad
und eigener Fehlerzustand im Store) — der 30-s-Takt der Spieleansicht waere
dafuer Verschwendung.

Zur Tabelle gibt es eine Besonderheit: **gruppiert wird ueber die eigene
Tabelle `data/nflDivisions.js`, nicht ueber ESPNs Baum.** Dessen
Verschachtelung wechselt je nach Parameter zwischen Conference- und
Division-Ebene; `collectEntries` sammelt darum jeden Eintrag unabhaengig von
der Tiefe ein, und die Zuordnung macht die statische Divisionsliste. Damit
braucht die Seite aus der Antwort nur Kuerzel und Bilanz. Teams ohne
Datensatz bleiben als leere Zeile stehen, statt die Division auf drei
Zeilen zu verkuerzen. Sortiert wird nach Siegquote und Punktdifferenz — die
echten NFL-Tiebreaker bildet das bewusst nicht nach, dafuer fehlen die Daten.

Beim Anfassen der Spalten: Punktestand und Meta-Spalte haben feste Breiten,
und der Punktestand wird auch vor dem Anpfiff gerendert (leer). Beides ist
Absicht — jede Kachel ist ihr eigenes Grid, ohne feste Breiten hat jede Zeile
eine andere Spaltenflucht. `NflPage.test.jsx` haelt das fest.

### Draft modes: redraft vs. rookie (dynasty)

`draftMode` (`'redraft' | 'rookie'`) drives which tip engine runs (`useDraftTips` vs. `useRookieDraftTips`) and whether dynasty roster / traded-pick data loads. It is auto-detected from the league type (dynasty/keeper → rookie) but can be overridden. Sleeper league `settings.type` is a **number** (0=redraft, 1=keeper, 2=dynasty) — compare numerically, not against string literals.

## Conventions

- UI text, comments, and user-facing strings are in **German**. Match that when editing.
  Das gilt auch fuer Menuepunkte und Seitentitel — englische Begriffe nur dort,
  wo sie im Football ohnehin englisch sind (Week, Redzone, Lineup). Pfade
  duerfen englisch sein (`/scores`), der sichtbare Name ist deutsch (`NFL`).

### Reiter: ein Muster, `.tabs` / `.tab`

Alle Reiter — Routen-Navigation wie Reiter innerhalb einer Seite — nutzen
`.tabs` und `.tab` aus `style.css`, aktiver Reiter `.tab.active`.
Unterstrich-Reiter, Farben aus den Tokens. **Keine eigenen Knopfleisten
bauen**: es gab zeitweise vier leicht abweichende Kopien (`.an-tabs`,
`.wk-tabs`, `.nfl-views`, `.tabs`), die sich in Hoehe, Schriftgrad und
Akzentfarbe unterschieden. Der Zusatz `tabs--route` markiert die
Routen-Navigation (`TabsNav`); nur sie wird mobil ausgeblendet, weil dort
die Bottom-Bar uebernimmt. In einer Grid-Seite mit `gap` gehoert
`margin-bottom: 0` auf die Leiste, sonst steht der Abstand doppelt.

Ausnahme: `.ns-insp-tabs` in `NextBoard.jsx` ist ein kompakter Umschalter
im Inspektor-Panel der neuen Shell, kein Seitenreiter — der bleibt eigen.

### Tokens: kanonische Namen und Alt-Kurznamen

Kanonisch sind die langen Namen aus `tokens.css` (`--text-primary`,
`--text-muted`, `--accent-fill`, `--surface-card`). Aeltere Stylesheets
schreiben `var(--muted, #888)`, `var(--fg, #eee)`, `var(--accent, #4ea1ff)`,
`var(--card-bg, …)`, `var(--hover, …)`. Diese Kurznamen gab es lange **gar
nicht** — jede dieser ~53 Stellen zeigte still ihren hartkodierten
Ersatzwert statt der Theme-Farbe (die Analyse-Reiter etwa blau). Sie sind
jetzt in `tokens.css` als Verweise auf die kanonischen Tokens definiert und
folgen damit jedem Theme. **Neuer Code nimmt die kanonischen Namen.**

- Der mobile Aktualisieren-Knopf sitzt im FAB der Bottom-Bar (`MobileNav`,
  verdrahtet ueber `handleMobileSync` in `App.jsx` — neue Seiten dort
  eintragen). Ein zusaetzlicher Knopf in der Seitenkopfzeile wird mobil
  ausgeblendet, statt zweimal dazustehen.

### Auto-Sync: `services/pageSync.js` ist die einzige Quelle

Wie oft sich eine Seite von selbst aktualisiert und ab wann ihr Stand als
veraltet gilt, steht **nur** in `PAGE_SYNC`. Vorher hatte jede Seite ihr
eigenes `setInterval` (Redzone 30 s, Scores 30 s/5 min, Draft-Picks in
`App.jsx`) — und der Wochenrueckblick gar keins.

- **Eine Schleife** in `App.jsx` treibt alle Seiten und ruft
  `handleMobileSync()` im Takt der offenen Seite. Neue Seite = ein Eintrag in
  `PAGE_SYNC` plus ein Zweig in `handleMobileSync`. **Kein eigenes
  `setInterval` in der Seite** — das wuerde doppelt holen. Laden beim Oeffnen
  oder bei Wechsel eines Parameters (Woche, Liga-Filter) gehoert weiter in die
  Seite.
- Der Takt haengt an der Ref `syncRef`, nicht direkt am Callback: `handleMobileSync`
  wechselt oft die Identitaet, und ein Intervall daran wuerde staendig neu
  starten und bei kurzen Takten nie ausloesen.
- **Veraltet-Schwelle** = `STALE_FACTOR` (3) x Takt, mindestens 90 s. Ein
  verpasster Tick ist normal, drei sind es nicht. Override per `staleSeconds`.
- **Verwaltet wird Auto-Sync mobil per Long-Press auf den Sync-FAB** (Sheet mit
  dem Hauptschalter, gleiches Muster wie das Pick-Intervall-Sheet in
  `BoardMobileBar`), am Desktop im Setup unter „Automatisch aktualisieren".
- Ein Knopf, den die Bottom-Bar schon traegt, wird per
  `body.mobile-nav-active` ausgeblendet — **nicht** an einem geratenen
  Breakpoint. Die Bar erscheint unter 900 px (`useIsWideViewport`); eine
  `max-width: 560px`-Regel liess den Knopf dazwischen doppelt stehen.
- Der Punkt am Sync-FAB hat drei Zustaende (`useSyncDot`): gruen = Auto-Sync
  laeuft und Stand frisch, **rot = Stand veraltet** (auch bei ausgeschaltetem
  Auto-Sync — gerade dann soll man es sehen), kein Punkt = nichts zu melden.
  Er tickt in der Bottom-Bar selbst weiter (10 s), nicht in `App.jsx`: dort
  wuerde jede Sekunde der ganze Orchestrator samt useMemos neu rechnen.
- `useUIStore.autoSyncEnabled` (persistiert, Default an) ist der Hauptschalter
  ueber alle Seiten; Draft-Seiten haben zusaetzlich weiterhin ihren eigenen
  `autoRefreshEnabled` samt Intervall-Presets aus dem Board.
- Zeitstempel sind uneinheitlich: `useLiveStore.lastSyncAt` ist ein `Date`,
  die uebrigen Stores halten Millisekunden. `toMs()` in `pageSync.js`
  vereinheitlicht beim Auswerten.

**`App.jsx` wird von keinem Test importiert** — ein Syntaxfehler dort faellt
erst im `npm run build` auf. Nach Aenderungen an `App.jsx` immer bauen.
- Mobile builds ship via **Capacitor** (Android); `webDir` is `dist`, appId `eu.zmash.sleeperdrafthelper`. The `android/` directory is a generated Capacitor project — do not hand-edit its `build/` artifacts.
- This is an **unofficial** tool; it only consumes public Sleeper/FantasyPros/FantasyCalc/KTC data.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
