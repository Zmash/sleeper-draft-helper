# Jev-News-Markierungen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Board-Zeilen markieren Spieler, deren neueste Meldung laut Jev (via OpenRouter) mehr/weniger Rolle oder einen Ausfall bedeutet — Kosten nur, wenn jemand hinschaut.

**Architecture:** Server-Modul `src/server/jevNews.js` (reine Logik + Datei-Store + Budget) und eine dünne Route `POST /api/news/signals` in `apiRoutes.js`, die nur Spielernamen annimmt und News selbst holt. Client-Hook `useNewsSignals` fragt für die ersten 50 ungedrafteten Zeilen nach; `NewsSignalMark` zeigt das Symbol in `BoardTable` (mobil) und `NextBoard` (Desktop).

**Tech Stack:** Node 18+/Express 5, `fetch`, React 18, Vitest + Testing Library.

Spec: `docs/superpowers/specs/2026-09-24-jev-news-markierungen-design.md`

## Global Constraints

- Endpoint `POST https://openrouter.ai/api/alpha/decisions`, Modell `typesafe/jev-1.13`, Header `Authorization: Bearer <SDH_OPENROUTER_KEY>`.
- Env: `SDH_OPENROUTER_KEY`, `SDH_JEV_FILE` (Default `os.tmpdir()/sdh-jev.json`), `SDH_JEV_DAILY_TOKENS` (Default `5000000`).
- Höchstens 50 Spieler pro Anfrage, Namen ≤ 80 Zeichen; Rate-Limit 60 / 10 min pro IP.
- Schwellen: `out ≥ 0.6` → injury; `down ≥ 0.75 && up < 0.75` → down; `up ≥ 0.75 && down < 0.75` → up.
- Cache-Einträge 14 Tage; Meldungen älter als 14 Tage werden nicht bewertet; Circuit-Breaker 1 h bei 401/402/403; Jev-Timeout 8 s.
- Kein `setInterval` im Client, keine Anfrage bei `document.hidden`, kein Hintergrund-Job.
- UI-Texte und Kommentare deutsch. Kanonische Tokens (`--good`, `--bad`, `--live`).
- Keine Commits ohne Aufforderung des Nutzers (Projektpräferenz) — Commit-Schritte entfallen.
- Nach Änderungen: `npm test`, `npm run build`, `graphify update .`.

## Abweichung von der Spec

Der Hook läuft direkt in `BoardTable` bzw. `NextBoard` (einmal pro Board, auf deren
bereits gefilterter Zeilenliste) statt in `BoardSection` — dieselbe Wirkung, ohne neue
Prop durch `BoardSection` zu fädeln. `NextBoard` bekommt keinen eigenen Render-Test
(braucht den ganzen Prop-Satz der Seite); dort prüft die Browser-Verifikation.

---

### Task 1: `jevNews.js` — Fragen, Zustand, Hash, Signal, Jev-Aufruf

**Files:**
- Create: `src/server/jevNews.js`
- Test: `src/server/jevNews.test.js`

**Interfaces:**
- Produces: `JEV_URL`, `JEV_MODEL`, `QUESTION_VERSION`, `JEV_QUESTIONS`, `buildState({name,pos,team,item})`, `newsHash(name,item) → string(32)`, `isNewsTooOld(item, now) → bool`, `signalProbs(answers) → {up,down,out}`, `deriveSignal({up,down,out}) → 'injury'|'down'|'up'|null`, `callJev({apiKey,state,fetchImpl,timeoutMs}) → {answers,usage}` (wirft `Error` mit `.status`).

- [ ] **Step 1: Tests schreiben** (`// @vitest-environment node`): `deriveSignal`-Tabelle inkl. Widerspruch und Grenzwerten, `signalProbs` summiert Score-Stufen 2+3, `newsHash` stabil / abhängig von Spieler und Text, `isNewsTooOld` für „Sep 24, 2026“-Format und unparsebares Datum, `buildState`, `callJev` mit gemocktem `fetch` (URL, Header, Body-Modell + Fragen, `.status` bei 402).
- [ ] **Step 2:** `npx vitest run src/server/jevNews.test.js` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementierung.
- [ ] **Step 4:** Tests → PASS.

### Task 2: `jevNews.js` — Store, Budget, Validierung, `evaluatePlayers`

**Files:**
- Modify: `src/server/jevNews.js`
- Test: `src/server/jevNews.test.js`

**Interfaces:**
- Produces: `JEV_FILE`, `DEFAULT_DAILY_TOKENS`, `MAX_SIGNAL_PLAYERS`, `emptyStore()`, `readJevStore(file)`, `writeJevStore(store, file, now)`, `budgetLeft(store, now, limit)`, `addUsage(store, tokens, now)`, `validateSignalPlayers(players) → string|null`, `cleanSignalPlayers(players) → [{name,pos,team}]` (dedupliziert), `mapLimit(items, limit, fn)`, `evaluatePlayers({players,getNews,store,apiKey,dailyTokens,now,fetchImpl,log}) → {signals, changed, budgetExhausted}`; `signals[name]` ist `null` oder `{signal, headline, date, url, p:{up,down,out}}`.

- [ ] **Step 1: Tests:** Store round-trip + Aufräumen > 14 Tage + defekte Datei → leerer Store; Budget-Reset über Berliner Tagesgrenze (22:30 UTC = 00:30 Berlin); Validierung (leer, 51, Name 81 Zeichen); `cleanSignalPlayers` dedupliziert; `evaluatePlayers`: keine News → kein Jev-Aufruf; Cache-Treffer → kein Aufruf; kein Key → kein Aufruf; Budget 0 → `budgetExhausted`; 402 → `breakerUntil` gesetzt und danach kein Aufruf; 500 → nicht gecacht; zu alte Meldung → kein Aufruf.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementierung.
- [ ] **Step 4:** Tests → PASS.

### Task 3: Route `POST /api/news/signals`, gemeinsamer News-Helfer, Rate-Limit, `trust proxy`

**Files:**
- Modify: `src/server/apiRoutes.js` (Imports, `checkRateLimit`, `registerApiRoutes`-Optionen, News-Abschnitt ~Z. 662–724)
- Modify: `src/server/prod.js`
- Test: `src/server/apiRoutes.test.js`

**Interfaces:**
- Consumes: alles aus Task 1/2.
- Produces: `checkRateLimit(store, ip, limit, windowMs, now)`; `registerApiRoutes(app, { model, jevFile, openrouterKey, jevDailyTokens })`; Route antwortet `{ ok, enabled, budgetExhausted, signals }`.

- [ ] **Step 1: Tests:** Route registriert; 400 bei 51 Spielern; ohne Key `enabled:false` und kein `fetch` an `openrouter.ai`; mit Key: FantasyPros-HTML + Jev-Antwort gemockt → Signal `injury`, zweiter Aufruf ohne erneuten Jev-`fetch`; 61. Anfrage derselben IP → 429; `/api/news/player` liefert weiterhin `cached: true` beim zweiten Aufruf.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementierung: `getPlayerNews(name)` aus der bestehenden Route ziehen; neue Route; `checkScoreRateLimit` delegiert an `checkRateLimit`; `app.set('trust proxy', 1)` in `prod.js`.
- [ ] **Step 4:** `npx vitest run src/server` → PASS.

### Task 4: Client-Hook `useNewsSignals`

**Files:**
- Create: `src/hooks/useNewsSignals.js`
- Test: `src/hooks/useNewsSignals.test.js`

**Interfaces:**
- Produces: `newsSignalTargets(rows, max=50) → [{name,pos,team}]`, `useNewsSignals(rows, { debounceMs = 500 } = {}) → { [name]: signalInfo|null }`, `SIGNAL_FRESH_MS = 600000`.

- [ ] **Step 1: Tests:** `newsSignalTargets` überspringt gedraftete (`status`) und begrenzt auf 50; Hook fragt einmal, bei unveränderter Liste nicht erneut; bei `document.hidden` keine Anfrage; `visibilitychange` nach > 10 min fragt erneut, davor nicht.
- [ ] **Step 2:** FAIL. **Step 3:** Implementierung. **Step 4:** PASS.

### Task 5: `NewsSignalMark` + Einbau in beide Boards

**Files:**
- Create: `src/components/NewsSignalMark.jsx`
- Test: `src/components/NewsSignalMark.test.jsx`
- Modify: `src/components/BoardTable.jsx` (Import, Hook, Mark hinter `.player-name-btn`)
- Modify: `src/components/NextBoard.jsx` (Import, Hook auf `rows`, Mark hinter `{p.name}`)
- Modify: `src/styles/style.css` (`.news-mark*`)

- [ ] **Step 1: Tests:** Mark rendert Symbol + `aria-label` je Signal, nichts bei `null`/unbekannt; `BoardTable` mit gemocktem `fetch` zeigt nach der Antwort `+` in der Zeile.
- [ ] **Step 2:** FAIL. **Step 3:** Implementierung. **Step 4:** PASS, dann `npm test` komplett.

### Task 6: Auswertungsskript, Doku, Build, Verifikation

**Files:**
- Create: `scripts/jev-news-eval.mjs`
- Modify: `CLAUDE.md` (Abschnitt „Jev (Entscheidungsmodell)“)
- Modify: Memory `project_jev_openrouter.md`

- [ ] **Step 1:** Skript: liest `src/.env` (dotenv), holt News über den laufenden Dev-Server (`/api/news/player`), ruft `callJev` direkt, druckt Tabelle. Ohne Key: klare Meldung, Exit 1.
- [ ] **Step 2:** `CLAUDE.md` + Memory aktualisieren.
- [ ] **Step 3:** `npm test`, `npm run build`, `graphify update .`.
- [ ] **Step 4:** Browser: `dev:all` starten, `/board` öffnen, Netzwerk prüfen — `POST /api/news/signals` 200 mit `enabled:false` (kein Key) und keine Anfrage bei verstecktem Tab. Live-Markierungen erst mit Key (offen, ehrlich melden).
