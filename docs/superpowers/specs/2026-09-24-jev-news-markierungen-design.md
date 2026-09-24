# Design: News-Markierungen mit Jev (Pilot)

Stand: 2026-09-24 · Status: im Gespräch abgestimmt · Nächster Schritt: Implementierungsplan (`writing-plans`)

## Kontext

Die AI-Funktionen laufen heute alle über Claude (Sonnet 5) mit dem Key des Nutzers
und liefern Text oder große Tool-JSONs — gut für Erklärungen, zu langsam und zu
teuer für „dauerhaft mitlaufende“ Hinweise. Jev (TypeSafe AI, System-One-Modell)
beantwortet eng gefasste Fragen typisiert mit Wahrscheinlichkeiten statt Text, in
~0,25 s, für $0.042 pro 1M Input-Tokens (Output kostenlos).

Jev soll Claude **ergänzen**, nicht ersetzen. Pilot: Spieler-News im Draft-Board
als Markierung auswerten. Das hier gebaute Muster (geschlossener Input, Cache,
Budget) ist die Vorlage für spätere Einsätze (Start/Sit, Trade-Ampel).

Zugang: Ein TypeSafe-Beta-Zugang ist nicht verfügbar — Jev läuft über **OpenRouter**
(`typesafe/jev-1.13`, `POST https://openrouter.ai/api/alpha/decisions`, alpha).

## Ziele

1. Board-Zeilen zeigen ein kleines Symbol, wenn die neueste Meldung eines Spielers
   eine Rollenänderung oder einen Ausfall bedeutet.
2. Kosten entstehen **nur, wenn jemand das Board offen und sichtbar hat**.
3. Niemand — auch kein Bot — kann über die Seite nennenswerte Kosten verursachen.

## Nicht-Ziele

- Kein Hintergrund-Job, kein Vorberechnen per `scheduler.js`.
- Keine Erklärtexte von Jev (die Schlagzeile selbst ist die Erklärung).
- Keine Markierungen außerhalb des Boards (Lineup, Analyse, Trade) — spätere Schritte.
- Kein Zugangscode, keine Nutzerkonten.
- Kein OpenRouter-SDK (`@openrouter/sdk`): ein `fetch` reicht, bei einer
  alpha-Schnittstelle ist das robuster und bringt keine Abhängigkeit.

## Verworfene Alternativen

| Ansatz | Warum nicht |
|---|---|
| Client schickt News-Text/Fragen an eine generische `/api/decide`-Route | Offene Eingabe: jeder kann beliebig viel Text auf unsere Kosten auswerten lassen. |
| Server berechnet Top-300 regelmäßig vor | Kostet auch, wenn niemand schaut. |
| Claude Haiku mit Tool-Schema | Langsamer (Sekunden), keine kalibrierten Wahrscheinlichkeiten, braucht den Key des Nutzers. |

## Architektur

### Grundprinzip: geschlossener Input

Der Browser schickt **nur Spielernamen**. Der Server holt die News selbst
(bestehender FantasyPros-Scrape), baut den Zustand selbst, die Fragen stehen fest
im Code. Damit ist die Kostenmenge durch „Anzahl Spieler × Anzahl Meldungen“
begrenzt, und jede Meldung wird für alle Nutzer genau einmal bewertet.

### Server

- **`src/server/jevNews.js`** (neu, reine Funktionen + Datei-Store, testbar ohne Express):
  - `JEV_QUESTIONS` + `QUESTION_VERSION` (siehe unten).
  - `buildState({ name, pos, team, item })` → `{ player, position, team, headline, body, impact }`.
  - `newsHash(name, item)` → Hash über Spieler + `headline + body + impact` + `QUESTION_VERSION`.
  - `deriveSignal(answers)` → `'injury' | 'down' | 'up' | null` (Regeln unten).
  - `callJev({ apiKey, state, fetchImpl })` → `{ answers, usage }`; wirft bei HTTP-Fehler mit `status`.
  - Store: `readJevStore(file)` / `writeJevStore(file, store)`; Budget: `budgetLeft(store, now)`,
    `addUsage(store, tokens, now)`; Tagesgrenze Europe/Berlin.
- **`src/server/apiRoutes.js`** (einzige Quelle für `/api/*`):
  - Den News-Abruf aus `/api/news/player` in einen Helfer `getPlayerNews(name)` innerhalb
    `registerApiRoutes` ziehen, damit beide Routen denselben `newsCache` (10 min) teilen.
  - Neue Route `POST /api/news/signals`, Body `{ players: [{ name, pos, team }] }`.
- **`src/server/prod.js`**: `app.set('trust proxy', 1)` — hinter dem Nginx Proxy Manager
  sieht Express sonst für alle Besucher dieselbe IP; das betrifft auch die bestehenden
  Rate-Limits von `/api/score` und `/api/push/*`.
- **Env:** `SDH_OPENROUTER_KEY` (Key), `SDH_JEV_FILE` (Store, Default
  `os.tmpdir()/sdh-jev.json`), `SDH_JEV_DAILY_TOKENS` (Default `5000000`).
  Dev: `.env` (wie bisher per dotenv), Prod: wie `SDH_VAPID_*`.

### Ablauf `POST /api/news/signals`

1. Rate-Limit pro IP: 60 Anfragen / 10 min → sonst `429`.
2. Validieren: höchstens 50 Spieler, Namen ≤ 80 Zeichen; mehr → `400`.
3. Pro Spieler (höchstens 4 gleichzeitig): `getPlayerNews(name)` → neueste Meldung.
   - Keine Meldung → `signal: null`, **kein Jev-Aufruf**.
   - Datum parsebar und älter als 14 Tage → `signal: null`, kein Jev-Aufruf.
4. `newsHash` im Store? → gespeichertes Ergebnis zurückgeben.
5. Sonst, wenn Key vorhanden, Budget übrig und kein Circuit-Breaker aktiv:
   `callJev` (höchstens 4 gleichzeitig), `usage.input_tokens` aufs Tagesbudget,
   Ergebnis mit Zeitstempel in den Store.
6. Store einmal pro Anfrage schreiben (nur wenn neu berechnet), Einträge älter als
   14 Tage dabei entfernen.

Antwort:

```json
{
  "ok": true,
  "enabled": true,
  "budgetExhausted": false,
  "signals": {
    "Puka Nacua": {
      "signal": "injury",
      "headline": "…", "date": "…", "url": "…",
      "p": { "up": 0.04, "down": 0.31, "out": 0.88 }
    }
  }
}
```

Ohne `SDH_OPENROUTER_KEY`: `enabled: false`, sofort — weder Jev-Aufrufe noch FantasyPros-Scrapes (50 Seiten ≈ 5 s, die nie ein Signal ergeben könnten).

### Fragen an Jev (`QUESTION_VERSION = 2`)

Englisch, weil die Meldungen englisch sind:

| Schlüssel | Typ | Frage | Kriterien |
|---|---|---|---|
| `role_up` | noul | Ignoring injuries, does this news mean the player's role on the team will grow? | true: new starter, promoted, target share up · false: no change, decrease, or injury-only news |
| `role_down` | noul | Ignoring injuries, does this news mean the player's role on the team will shrink? | true: demoted, benched, losing snaps to a teammate · false: no change, increase, or injury-only news |
| `injury` | score | How much playing time will the player miss due to injury? | `No injury mentioned` · `Questionable / day-to-day, likely to play` · `Likely to miss this week's game` · `Out for multiple weeks` · `Out for the season` |

Fragen ändern → `QUESTION_VERSION` hochzählen → alle Meldungen werden neu bewertet.

### `deriveSignal` (eine Quelle für Schwellen, serverseitig)

- `out = P(injury ≥ 2)` (diese Woche raus, Wochen, Saison); `out ≥ 0.6` → `'injury'`
- sonst `role_down ≥ 0.75` und `role_up < 0.75` → `'down'`
- sonst `role_up ≥ 0.75` und `role_down < 0.75` → `'up'`
- sonst `null` (auch bei widersprüchlichem up+down)

### Client

- **`src/hooks/useNewsSignals.js`** (neu): nimmt eine Liste `{ name, pos, team }`,
  fragt `/api/news/signals` für Namen ohne frisches Ergebnis (jünger als 10 min),
  Anfragen um 500 ms entprellt. **Kein `setInterval`** (Regel aus `pageSync.js`):
  neu geladen wird nur bei geänderter Namensliste und beim Zurückkehren in einen
  sichtbaren Tab (`visibilitychange`), wenn die Daten älter als 10 min sind.
  Bei `document.hidden` keine Anfrage. Fehler/`429` → still, alte Werte bleiben.
- **Welche Spieler:** die ersten 50 noch nicht gedrafteten Zeilen der aktuell
  angezeigten, gefilterten Liste — in beiden Boards.
- **`src/components/NewsSignalMark.jsx`** (neu): kleines Symbol (↑ / ↓ / +) mit
  `title` + `aria-label` („Neue Meldung: mehr Rolle — <Schlagzeile>“). Farben aus
  den kanonischen Tokens (`tokens.css`).
- Einbau hinter dem Namen, vor dem AI-Badge:
  - Desktop `NextBoard.jsx` (Zeile `.ns-name`),
  - Mobil `BoardTable.jsx` (`.cell-content`, neben `.ai-badge-wrap`). Mobil gibt es
    keinen Tooltip; die Meldung selbst steht schon im Detail-Sheet.
  - Der Hook läuft direkt in `BoardTable.jsx` bzw. `NextBoard.jsx` auf deren gefilterter Zeilenliste,
    einmal pro Board, nicht pro Zeile.

## Schutz gegen Kosten (zusammengefasst)

1. Geschlossener Input — keine freien Texte/Fragen vom Client.
2. Cache pro Meldung (14 Tage) für alle Nutzer, Datei übersteht Neustarts und Deploys.
3. Tagesbudget 5M Input-Tokens (~0,21 $), danach nur noch Cache bis Mitternacht (Berlin).
4. Circuit-Breaker: OpenRouter antwortet `401`/`402`/`403` → 1 h keine Aufrufe, Log-Warnung.
5. Rate-Limit 60 / 10 min pro IP (mit `trust proxy` tatsächlich pro Besucher).
6. Harte Grenze außerhalb des Codes: Prepaid-Guthaben + Ausgabenlimit am OpenRouter-Key.

## Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| FantasyPros nicht erreichbar | `signal: null` für den Spieler, kein Jev-Aufruf |
| Jev-Fehler (5xx, Timeout 8 s) | `signal: null`, **nicht** cachen, beim nächsten Abruf erneut |
| Jev `401/402/403` | Circuit-Breaker 1 h, `enabled` bleibt `true`, Log-Warnung |
| Budget erschöpft | `budgetExhausted: true`, nur Cache |
| Kein Key | `enabled: false`, kein Scrape, kein Aufruf |
| Store-Datei defekt | leerer Store, Log-Warnung (Muster `readScores`) |

## Tests

- `jevNews.test.js`: `deriveSignal`-Tabelle (inkl. Widerspruch), `newsHash` stabil und
  versionsabhängig, `buildState`, Budget über Tagesgrenze Berlin, Store lesen/schreiben/
  aufräumen, `callJev` mit gemocktem `fetch` (Header, Body, Fehler-Status).
- `apiRoutes.test.js`: Route mit Fake-App — Limit 50, Rate-Limit, kein Key → `enabled:false`
  ohne `fetch` an OpenRouter, Cache-Treffer ohne zweiten Aufruf, Budget erschöpft,
  Circuit-Breaker, keine News → kein Aufruf.
- `useNewsSignals.test.js`: keine Anfrage bei `document.hidden`, nur fehlende Namen,
  Entprellung, `visibilitychange`-Nachladen nach 10 min.
- `NewsSignalMark` + Einbau: Symbol je Signal, nichts bei `null`; je ein Render-Test in
  `BoardTable.test.jsx` und für `NextBoard`.

## Abnahme vor dem Einschalten

Skript `scripts/jev-news-eval.mjs`: holt News für ~30 Spieler, fragt Jev, gibt Tabelle
(Spieler, Schlagzeile, p-Werte, Signal) aus. Kosten < 1 Cent, braucht den Key. Dario
prüft die Tabelle; erst danach Schwellen festziehen und live schalten.
Ohne Key sind Server und UI vollständig testbar (gemockt) — der Live-Test bleibt bis
dahin ausdrücklich offen.

## Dokumentation

- `CLAUDE.md`: Abschnitt „Jev (Entscheidungsmodell)“ — geschlossener Input, Env-Variablen,
  Schutzschichten, `QUESTION_VERSION`.
- Memory `project_jev_openrouter.md` nachziehen.

## Live-Abnahme (2026-09-24)

27 echte Meldungen, 0,07 US-Cent. Zwei Korrekturen, danach `QUESTION_VERSION = 2`:

1. Rollen-Fragen klammern Verletzungen aus — vorher kam „Puka Nacua (hip) not making
   great progress“ als *weniger Rolle* (down 78 %) an, „Brock Bowers (knee) limited“
   mit up 50 %. Danach liegen Rollen-Werte bei Verletzungsmeldungen bei 3–9 %.
2. Neue Verletzungsstufe „Likely to miss this week's game“ — der häufigste Fall
   („likely to miss a second straight game“) fiel vorher zwischen „fraglich“ und
   „Wochen“ (out 51 %). Danach: Nacua out 100 %, Collins („trending towards missing“)
   out 83 %, reine Trainingsmeldungen („limited“, „rest“) bleiben ohne Markierung.

Außerdem liest `parseNewsDate` jetzt FantasyPros' relative Angaben („4 days ago“,
„Yesterday“), die vorher als unparsebar immer als aktuell galten.
Spielberichte erzeugen durchweg kein Signal (up/down < 50 %) — gewollt, kein Rauschen.
