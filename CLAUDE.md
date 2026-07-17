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

### Setup overrides — a separate channel from the stores

League/roster *overrides* (scoring type, roster positions, strategies, superflex) are **not** in a Zustand store. They live under localStorage key `sdh.setup.v2` via `loadSetup()/saveSetup()` in `src/services/storage.js`. `SetupForm` writes that key and dispatches a `sdh:setup-changed` window event (and cross-tab `storage` events); `App.jsx` listens and bumps `useUIStore.setupVersion`, which invalidates the `useMemo`s that read overrides. When touching setup/override logic, preserve this event → `setupVersion` → memo-recompute chain.

### `App.jsx` is the orchestrator

`App.jsx` is large by design: it reads from every store, computes all derived values (`teamsCount`, `effRoster`, `effScoringType`, `ownerLabels`, draft slot, per-team scores) with `useMemo`, runs the global effects (league→draft loading, dynasty roster loading, pick polling, draft-change reset), and passes a shared `pageProps` object down to the route pages. Pages (`src/pages/*Page.jsx`) are relatively thin. Routes: `/dashboard`, `/setup`, `/board`, `/roster`, `/trade`; `/` redirects based on whether a Sleeper user id is set.

### Draft modes: redraft vs. rookie (dynasty)

`draftMode` (`'redraft' | 'rookie'`) drives which tip engine runs (`useDraftTips` vs. `useRookieDraftTips`) and whether dynasty roster / traded-pick data loads. It is auto-detected from the league type (dynasty/keeper → rookie) but can be overridden. Sleeper league `settings.type` is a **number** (0=redraft, 1=keeper, 2=dynasty) — compare numerically, not against string literals.

## Conventions

- UI text, comments, and user-facing strings are in **German**. Match that when editing.
- Mobile builds ship via **Capacitor** (Android); `webDir` is `dist`, appId `eu.zmash.sleeperdrafthelper`. The `android/` directory is a generated Capacitor project — do not hand-edit its `build/` artifacts.
- This is an **unofficial** tool; it only consumes public Sleeper/FantasyPros/FantasyCalc/KTC data.
