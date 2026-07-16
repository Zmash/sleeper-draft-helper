# Broadcast Lower-Third Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the app's visual layer in the committed "Broadcast Lower-Third" direction (night-navy, signal-yellow, condensed display + tabular mono, sharp corners, dense tables) with a role-token theming system that supports multiple switchable themes.

**Architecture:** Introduce a role-based CSS token layer (`tokens.css`) consumed by the existing global stylesheet; a small JS theme registry + `applyTheme` util + `useUIStore` migration drive `[data-theme]` switching. Components are restyled through tokens; emoji icons are replaced by an SVG set; a new persistent On-the-clock bar surfaces draft context. Logic is TDD (Vitest); visual work is verified by rendering the dev server and screenshotting.

**Tech Stack:** React 18, Vite 5, Zustand 5 (persist), Vitest + @testing-library (new, test-only), @fontsource (self-hosted fonts), lucide-react (icons).

## Global Constraints

- Fachlogik unverändert: keine Änderung an Sleeper-API, Stores-Logik (außer UI-Theme), AI-Services, Draft-/Mock-Logik.
- Keine erfundenen Daten: die Board-Tabelle nutzt nur real vorhandene Spalten (Rank, Pos, Player, Team, Bye, Tier, sowie geladene SOS/DYN/ECR). ADP/Proj/Value nur zeigen, wenn echte Daten existieren.
- Komponenten konsumieren **Rollen-Tokens**, nie Roh-Hex.
- Akzent `--accent-*` nur für Aktion/Auswahl/State, nie Deko.
- Barlow Condensed nur für On-the-clock-Hero + Spalten-/Section-Labels; Namen/Daten/Buttons = regular Barlow, Sentence Case. Kein Display-Font in Datenzellen/Buttons.
- Skew/`clip-path` nur am On-the-clock-Hero. Scharfe Kanten: `--r-ctl:2px`, `--r-card:3px`.
- Keine Side-Stripe-Borders. Keine Emoji-Icons. `prefers-reduced-motion` respektiert; sichtbare Fokus-Ringe.
- Default-Theme `broadcast-dark`; zweites Theme `broadcast-light`; Registry-getrieben.
- Spec: `docs/superpowers/specs/2026-07-15-broadcast-redesign-design.md` (Quelle der Wahrheit).

---

## File Structure

**New**
- `src/styles/tokens.css` — role tokens (`:root` = broadcast-dark) + `[data-theme="broadcast-light"]` overrides + theme-invariant tokens (radius/spacing/motion/font/z).
- `src/theme/themes.js` — theme registry `THEMES`, `DEFAULT_THEME_ID`.
- `src/theme/applyTheme.js` — `resolveInitialTheme()`, `applyTheme(id)`.
- `src/theme/themes.test.js`, `src/theme/applyTheme.test.js` — logic tests.
- `src/stores/useUIStore.test.js` — store migration/setTheme tests.
- `src/components/Icon.jsx` — thin wrapper around lucide-react (size tokens, aria).
- `src/components/no-emoji.test.js` — asserts no emoji in `src/components` + `src/pages`.
- `src/components/ThemeSelect.jsx` — theme picker popover (registry-fed).
- `src/components/OnTheClockBar.jsx` — persistent draft-context bar.
- `vitest.config.js`, `src/test/setup.js` — test runner config.

**Modified**
- `src/main.jsx` — import fontsource + `tokens.css` before `style.css`; init theme.
- `src/styles/style.css` — consume tokens; restyle chrome/table/cards/filters/states.
- `src/stores/useUIStore.js` — `themeId` + `setTheme`; persist migration.
- `src/App.jsx` — theme init effect (themeId → applyTheme); mount `OnTheClockBar`.
- `src/components/AppShell.jsx` — pass themeId/setTheme; render OnTheClockBar slot.
- `src/components/Topbar.jsx` — wordmark, season/live pills, ThemeSelect; no emoji.
- `src/components/TabsNav.jsx` — icon + label, active underline, `aria-current`.
- `src/components/BoardTable.jsx`, `BoardSection.jsx` — tokens, tabular-nums, badges, states, skeleton, `aria-sort`, filter chips.
- `src/pages/DashboardPage.jsx`, `src/components/AdviceDialog.jsx`, `src/components/Modal.jsx` — token restyle, emoji → Icon, states.

---

## Task 1: Design tokens + fonts foundation

**Files:**
- Create: `src/styles/tokens.css`
- Modify: `src/main.jsx`, `src/styles/style.css:1-40` (replace `:root` color block, wire base)

**Interfaces:**
- Produces: role tokens `--surface-page/-nav/-card/-raised`, `--text-primary/-muted/-dim`, `--border/-soft`, `--accent-fill/-on/-text`, `--live/-good/-bad`, `--pos-{rb,wr,qb,te,k,def}`, `--font-{ui,display,mono}`, `--r-ctl/-card`, `--sp-1..8`, `--dur`, `--z-*`. Consumed by every later task.

- [ ] **Step 1: Install self-hosted fonts + icons**

Run:
```bash
npm i @fontsource/barlow @fontsource/barlow-condensed @fontsource/jetbrains-mono lucide-react
```
Expected: packages added to dependencies.

- [ ] **Step 2: Create `src/styles/tokens.css`**

```css
/* Theme-invariant tokens */
:root {
  --font-ui: 'Barlow', ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
  --font-display: 'Barlow Condensed', 'Barlow', sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Consolas, monospace;
  --r-ctl: 2px; --r-card: 3px;
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-6: 24px; --sp-8: 32px;
  --dur: 180ms; --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --z-dropdown: 10; --z-sticky: 20; --z-backdrop: 40; --z-modal: 50; --z-toast: 60; --z-tooltip: 70;
}

/* Broadcast Dark (default) */
:root, :root[data-theme='broadcast-dark'] {
  --surface-page: #071026; --surface-nav: #0a1836; --surface-card: #0f2149; --surface-raised: #102450;
  --border: #1c336a; --border-soft: #16264d;
  --text-primary: #eef3ff; --text-muted: #93a6cf; --text-dim: #6b7fa8;
  --accent-fill: #ffd21e; --accent-on: #1a1400; --accent-text: #ffd21e;
  --live: #ff3b47; --good: #37d67a; --bad: #ff7a6b;
  --pos-rb: #22b455; --pos-wr: #2f8fe0; --pos-qb: #ef4a63; --pos-te: #f0982f; --pos-k: #a06ff0; --pos-def: #8a94a6;
  --pos-on: #ffffff;
  color-scheme: dark;
}

/* Broadcast Light (day game — designed, not inverted) */
:root[data-theme='broadcast-light'] {
  --surface-page: #eef1f6; --surface-nav: #ffffff; --surface-card: #ffffff; --surface-raised: #f3f6fb;
  --border: #d3dbe8; --border-soft: #e4e9f2;
  --text-primary: #0a1836; --text-muted: #4a5a7a; --text-dim: #6b7896;
  --accent-fill: #ffd21e; --accent-on: #1a1400; --accent-text: #8a6d00;
  --live: #d81028; --good: #1c8f4e; --bad: #c8402f;
  --pos-rb: #1e9c4c; --pos-wr: #1f6fc0; --pos-qb: #cf3550; --pos-te: #c9761f; --pos-k: #7a53c8; --pos-def: #5f6b82;
  --pos-on: #ffffff;
  color-scheme: light;
}
```

- [ ] **Step 3: Wire imports in `src/main.jsx`**

Add above `import './styles/style.css'`:
```js
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles/tokens.css'
```

- [ ] **Step 4: Rewire base in `src/styles/style.css`**

Replace the existing `:root { --bg … }` / `:root[data-theme='light']` color block (lines ~4-24) with a bridge that maps legacy vars to tokens, so existing rules keep working during migration:
```css
:root {
  --bg: var(--surface-page);
  --card: var(--surface-card);
  --muted: var(--text-muted);
  --text: var(--text-primary);
  --border: var(--border);
  --accent: var(--accent-fill);
  --control-h: 36px;
}
```
Update `body` font:
```css
body {
  margin: 0; background: var(--surface-page); color: var(--text-primary);
  font: 15px/1.55 var(--font-ui);
}
```

- [ ] **Step 5: Verify render**

Run: `npm run dev` then open `http://localhost:5173` in the browser pane; screenshot.
Expected: night-navy background, Barlow font visibly loaded (not system default), no console errors. Dark is default.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/styles/tokens.css src/main.jsx src/styles/style.css
git commit -m "feat(design): add broadcast token layer and self-hosted fonts"
```

---

## Task 2: Theme registry + store migration + apply (TDD)

**Files:**
- Create: `vitest.config.js`, `src/test/setup.js`, `src/theme/themes.js`, `src/theme/applyTheme.js`, `src/theme/themes.test.js`, `src/theme/applyTheme.test.js`, `src/stores/useUIStore.test.js`
- Modify: `src/stores/useUIStore.js`, `package.json` (test script)

**Interfaces:**
- Produces: `THEMES: {id,label,kind}[]`, `DEFAULT_THEME_ID: 'broadcast-dark'`; `resolveInitialTheme(): string`; `applyTheme(id): string`; `useUIStore` state `themeId`, action `setTheme(id)`.
- Consumes: nothing.

- [ ] **Step 1: Test setup config**

Create `vitest.config.js`:
```js
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.js'], globals: true },
})
```
Create `src/test/setup.js`:
```js
import '@testing-library/jest-dom'
```
Add devDeps + script:
```bash
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom
npm pkg set scripts.test="vitest run" scripts.test:watch="vitest"
```

- [ ] **Step 2: Write failing tests**

`src/theme/themes.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { THEMES, DEFAULT_THEME_ID } from './themes'
describe('theme registry', () => {
  it('exposes broadcast-dark and broadcast-light', () => {
    expect(THEMES.map(t => t.id)).toEqual(['broadcast-dark', 'broadcast-light'])
  })
  it('defaults to broadcast-dark', () => {
    expect(DEFAULT_THEME_ID).toBe('broadcast-dark')
    expect(THEMES.find(t => t.id === DEFAULT_THEME_ID).kind).toBe('dark')
  })
})
```
`src/theme/applyTheme.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, resolveInitialTheme } from './applyTheme'
beforeEach(() => { document.documentElement.removeAttribute('data-theme') })
describe('applyTheme', () => {
  it('sets data-theme for a valid id', () => {
    applyTheme('broadcast-light')
    expect(document.documentElement.dataset.theme).toBe('broadcast-light')
  })
  it('falls back to default for an unknown id', () => {
    expect(applyTheme('nope')).toBe('broadcast-dark')
    expect(document.documentElement.dataset.theme).toBe('broadcast-dark')
  })
})
describe('resolveInitialTheme', () => {
  it('returns light when the OS prefers light', () => {
    window.matchMedia = (q) => ({ matches: q.includes('light'), media: q, addEventListener() {}, removeEventListener() {} })
    expect(resolveInitialTheme()).toBe('broadcast-light')
  })
})
```
`src/stores/useUIStore.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest'
beforeEach(() => { localStorage.clear() })
describe('useUIStore theming', () => {
  it('migrates legacy themeMode:light to broadcast-light', async () => {
    localStorage.setItem('sdh-ui-v1', JSON.stringify({ state: { themeMode: 'light' }, version: 0 }))
    const { useUIStore } = await import('./useUIStore')
    expect(useUIStore.getState().themeId).toBe('broadcast-light')
  })
  it('setTheme updates themeId', async () => {
    const { useUIStore } = await import('./useUIStore')
    useUIStore.getState().setTheme('broadcast-light')
    expect(useUIStore.getState().themeId).toBe('broadcast-light')
  })
})
```

- [ ] **Step 3: Run tests, verify they fail**

Run: `npm test`
Expected: FAIL — modules `./themes`, `./applyTheme` not found; store has no `themeId`.

- [ ] **Step 4: Implement**

`src/theme/themes.js`:
```js
export const THEMES = [
  { id: 'broadcast-dark', label: 'Broadcast Dark', kind: 'dark' },
  { id: 'broadcast-light', label: 'Broadcast Light', kind: 'light' },
]
export const DEFAULT_THEME_ID = 'broadcast-dark'
```
`src/theme/applyTheme.js`:
```js
import { THEMES, DEFAULT_THEME_ID } from './themes'
export function resolveInitialTheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return DEFAULT_THEME_ID
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'broadcast-light' : 'broadcast-dark'
}
export function applyTheme(themeId) {
  const id = THEMES.some((t) => t.id === themeId) ? themeId : DEFAULT_THEME_ID
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = id
  return id
}
```
Rewrite `src/stores/useUIStore.js`:
```js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { resolveInitialTheme } from '../theme/applyTheme'
import { THEMES, DEFAULT_THEME_ID } from '../theme/themes'

const validThemeId = (id) => (THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME_ID)

export const useUIStore = create(
  persist(
    (set) => ({
      themeId: resolveInitialTheme(),
      analysisOpen: false,
      setupVersion: 0,
      setTheme: (id) => set({ themeId: validThemeId(id) }),
      setAnalysisOpen: (v) => set({ analysisOpen: v }),
      incrementSetupVersion: () => set((s) => ({ setupVersion: s.setupVersion + 1 })),
    }),
    {
      name: 'sdh-ui-v1',
      version: 1,
      partialize: (s) => ({ themeId: s.themeId }),
      migrate: (persisted, version) => {
        if (persisted && version < 1) {
          persisted.themeId = persisted.themeMode === 'light' ? 'broadcast-light' : 'broadcast-dark'
          delete persisted.themeMode
        }
        if (persisted) persisted.themeId = validThemeId(persisted.themeId)
        return persisted
      },
    }
  )
)
```

- [ ] **Step 5: Run tests, verify pass**

Run: `npm test`
Expected: PASS (all theme + store tests green).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.js src/test src/theme src/stores/useUIStore.js src/stores/useUIStore.test.js package.json package-lock.json
git commit -m "feat(theme): registry, applyTheme, and useUIStore themeId migration"
```

---

## Task 3: SVG icons — replace all emoji (TDD guard)

**Files:**
- Create: `src/components/Icon.jsx`, `src/components/no-emoji.test.js`
- Modify: every `src/components/*.jsx` / `src/pages/*.jsx` that renders an emoji (at least: `Topbar.jsx`, `DashboardPage.jsx`, `AdviceDialog.jsx`, and the analysis toggle in `App.jsx`)

**Interfaces:**
- Produces: `Icon` component — `<Icon name="sun" size={18} label="Light" />` renders a lucide icon; decorative icons omit `label` and get `aria-hidden`.

- [ ] **Step 1: Write the failing guard test**

`src/components/no-emoji.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u
function jsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsxFiles(join(dir, e.name)) : e.name.endsWith('.jsx') ? [join(dir, e.name)] : []
  )
}
describe('no emoji icons in UI source', () => {
  for (const f of [...jsxFiles('src/components'), ...jsxFiles('src/pages')]) {
    it(`has no emoji: ${f}`, () => {
      expect(EMOJI.test(readFileSync(f, 'utf8'))).toBe(false)
    })
  }
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- no-emoji`
Expected: FAIL for `Topbar.jsx` (☀️🌙), `DashboardPage.jsx` (🏈📋), `AdviceDialog.jsx`, `App.jsx`-adjacent, etc.

- [ ] **Step 3: Implement `Icon.jsx`**

```jsx
import {
  Sun, Moon, Radio, ClipboardList, Sparkles, RefreshCw, BarChart3, Search, X, Check, Plus, Palette,
} from 'lucide-react'
const MAP = { sun: Sun, moon: Moon, radio: Radio, clipboard: ClipboardList, sparkles: Sparkles,
  refresh: RefreshCw, chart: BarChart3, search: Search, x: X, check: Check, plus: Plus, palette: Palette }
export default function Icon({ name, size = 18, label, className, strokeWidth = 2 }) {
  const C = MAP[name] || Sparkles
  return <C size={size} strokeWidth={strokeWidth} className={className}
    aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined} />
}
```

- [ ] **Step 4: Replace emoji at each failing file**

Replace each emoji usage with `<Icon name="…" label="…"/>` (label only on icon-only controls). Read each file first, then swap. Example — `DashboardPage.jsx` empty state `🏈` → `<Icon name="clipboard" size={40} />`; refresh `↺` → `<Icon name="refresh" size={16} />`. (Topbar theme icon handled in Task 4; if still present here, swap now.)

- [ ] **Step 5: Run test, verify pass**

Run: `npm test -- no-emoji`
Expected: PASS for all files.

- [ ] **Step 6: Verify render + commit**

Run app; screenshot Dashboard — icons render crisply. Then:
```bash
git add src/components src/pages src/App.jsx
git commit -m "feat(icons): replace emoji with lucide SVG icon set"
```

---

## Task 4: Topbar + Nav + Theme selector (visual)

**Files:**
- Create: `src/components/ThemeSelect.jsx`
- Modify: `src/components/Topbar.jsx`, `src/components/TabsNav.jsx`, `src/components/AppShell.jsx`, `src/App.jsx`, `src/styles/style.css` (topbar/tabs blocks)

**Interfaces:**
- Consumes: `useUIStore` `themeId`/`setTheme`; `THEMES`; `applyTheme`; `Icon`.
- Produces: theme applied on change via `App` effect; `ThemeSelect` popover.

- [ ] **Step 1: App theme init effect**

In `src/App.jsx`, replace the old theme-sync effect (`document.documentElement.dataset.theme = themeMode …`) with:
```jsx
const { themeId, setTheme } = useUIStore()
useEffect(() => { applyTheme(themeId) }, [themeId])
```
Add `import { applyTheme } from './theme/applyTheme'`. Pass `themeId`/`setTheme` into `AppShell` (replace `themeMode`/`onToggleTheme`). Remove the `localStorage.setItem('draft-helper-theme', …)` line.

- [ ] **Step 2: AppShell + Topbar wiring**

`AppShell.jsx`: accept `themeId`, `setTheme`; pass to `Topbar`. `Topbar.jsx`:
```jsx
import Icon from './Icon'
import ThemeSelect from './ThemeSelect'
export default function Topbar({ themeId, setTheme, season }) {
  return (
    <header className="topbar">
      <div className="brand"><b>Draft<span className="brand-accent">Helper</span></b><small>Sleeper</small></div>
      <ThemeSelect themeId={themeId} setTheme={setTheme} />
    </header>
  )
}
```

- [ ] **Step 3: ThemeSelect.jsx**

```jsx
import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'
import { THEMES } from '../theme/themes'
export default function ThemeSelect({ themeId, setTheme }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc); return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div className="theme-select" ref={ref}>
      <button className="icnbtn" aria-label="Theme wählen" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}><Icon name="palette" size={18} /></button>
      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((t) => (
            <button key={t.id} role="menuitemradio" aria-checked={t.id === themeId}
              className={t.id === themeId ? 'theme-opt is-active' : 'theme-opt'}
              onClick={() => { setTheme(t.id); setOpen(false) }}>
              {t.label}{t.id === themeId && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: TabsNav icons + active underline**

`TabsNav.jsx`: add an icon per tab (`home`→chart, `board`→clipboard, `roster`→check, `trade`→refresh — pick apt lucide names, extend `Icon` MAP as needed) and:
```jsx
<button className={cx('tab', pathname === path && 'active')} aria-current={pathname === path ? 'page' : undefined} …>
  <Icon name={icon} size={16} /> {label}
</button>
```

- [ ] **Step 5: CSS — topbar, tabs, theme menu**

Replace the `.topbar`, `.tabs`, `.tab`, `.tab.active` blocks in `style.css` with token-based Broadcast styling:
```css
.topbar { display:flex; align-items:center; gap:16px; height:54px; padding:0 16px;
  background:var(--surface-nav); border-bottom:1px solid var(--border); margin-bottom:16px; }
.brand b { font-family:var(--font-display); font-weight:700; font-size:19px; text-transform:uppercase;
  letter-spacing:.02em; color:var(--text-primary); }
.brand-accent { color:var(--accent-text); }
.brand small { font-family:var(--font-mono); font-size:10px; letter-spacing:.18em; color:var(--text-dim);
  text-transform:uppercase; margin-left:8px; }
.tabs { display:flex; gap:2px; margin:0 0 16px; }
.tab { display:inline-flex; align-items:center; gap:7px; font-family:var(--font-ui); font-size:14px;
  color:var(--text-muted); background:transparent; border:0; border-bottom:2px solid transparent;
  padding:8px 13px; cursor:pointer; transition:color var(--dur) var(--ease); }
.tab:hover { color:var(--text-primary); }
.tab.active { color:var(--text-primary); border-bottom-color:var(--accent-fill); }
.tab:focus-visible { outline:2px solid var(--accent-fill); outline-offset:2px; }
.icnbtn { width:32px; height:32px; display:grid; place-items:center; border:1px solid var(--border);
  background:transparent; color:var(--text-muted); border-radius:var(--r-ctl); cursor:pointer; }
.icnbtn:hover { color:var(--text-primary); border-color:var(--accent-fill); }
.theme-select { position:relative; margin-left:auto; }
.theme-menu { position:absolute; right:0; top:38px; z-index:var(--z-dropdown); background:var(--surface-raised);
  border:1px solid var(--border); border-radius:var(--r-card); padding:4px; min-width:180px; display:flex; flex-direction:column; }
.theme-opt { display:flex; align-items:center; justify-content:space-between; gap:8px; font-family:var(--font-ui);
  font-size:13px; color:var(--text-muted); background:transparent; border:0; padding:8px 10px; border-radius:var(--r-ctl); cursor:pointer; text-align:left; }
.theme-opt:hover { background:var(--surface-card); color:var(--text-primary); }
.theme-opt.is-active { color:var(--accent-text); }
```

- [ ] **Step 6: Verify both themes + commit**

Run app; screenshot topbar/nav; open ThemeSelect, switch to Broadcast Light, screenshot (verify light variant is legible, accent-as-text uses dark gold, active tab underline visible). Then:
```bash
git add src/components/Topbar.jsx src/components/TabsNav.jsx src/components/ThemeSelect.jsx src/components/AppShell.jsx src/App.jsx src/styles/style.css
git commit -m "feat(chrome): broadcast topbar, nav, and theme selector"
```

---

## Task 5: On-the-clock bar (visual)

**Files:**
- Create: `src/components/OnTheClockBar.jsx`
- Modify: `src/App.jsx` (mount above routes), `src/styles/style.css` (clockbar block)

**Interfaces:**
- Consumes (all already computed in `App.jsx`): `selectedDraft`, `livePicks`, `teamsCount`, `currentPickNumber`, `draftSlot` (from `inferMyDraftSlot`), `sleeperUserId`. Mock flag: `selectedDraft && !selectedDraft.league_id`.
- Produces: presentational bar; no new state.

- [ ] **Step 1: OnTheClockBar.jsx**

```jsx
import Icon from './Icon'
function fmtPick(round, slot) { return slot ? `${round}.${String(slot).padStart(2, '0')}` : '—' }
export default function OnTheClockBar({ draft, picks, teamsCount, draftSlot }) {
  if (!draft) return null
  const rounds = Number(draft.settings?.rounds) || null
  const made = picks?.length || 0
  const overall = made + 1
  const teams = Number(teamsCount) || null
  const round = teams ? Math.floor(made / teams) + 1 : null
  const slotInRound = teams ? (made % teams) + 1 : null
  const isMock = !draft.league_id
  const yourNextIn = teams && draftSlot ? ((draftSlot - slotInRound + teams) % teams) : null
  return (
    <section className="clockbar" aria-label="Draft-Status">
      <div className="oc-tag">
        <span className="oc-lab">On the clock</span>
        <span className="oc-pick">{fmtPick(round, slotInRound)}</span>
      </div>
      <div className="oc-mid">
        {round && <div className="oc-stat"><span className="k">Runde</span><span className="v">{round}{rounds ? ` / ${rounds}` : ''}</span></div>}
        <div className="oc-stat"><span className="k">Pick</span><span className="v">{overall}</span></div>
        {yourNextIn != null && <div className="oc-stat"><span className="k">Bis zu dir</span><span className="v acc">{yourNextIn === 0 ? 'Jetzt' : `in ${yourNextIn}`}</span></div>}
        {isMock && <span className="oc-mock"><Icon name="radio" size={14} /> Mock</span>}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Mount in App**

In `AppShell` children region (or `App.jsx` before `<Routes>`), render `<OnTheClockBar draft={selectedDraft} picks={livePicks} teamsCount={teamsCount} draftSlot={draftSlot} />` when a draft is selected. Pass the needed props through `pageProps` or directly.

- [ ] **Step 3: CSS clockbar**

```css
.clockbar { display:flex; align-items:stretch; background:var(--surface-raised);
  border:1px solid var(--border); border-radius:var(--r-card); margin-bottom:16px; overflow:hidden; }
.oc-tag { display:flex; flex-direction:column; justify-content:center; gap:2px; background:var(--accent-fill);
  color:var(--accent-on); padding:10px 24px 10px 16px; clip-path:polygon(0 0,100% 0,90% 100%,0 100%); }
.oc-lab { font-family:var(--font-mono); font-size:10px; letter-spacing:.18em; text-transform:uppercase; font-weight:500; }
.oc-pick { font-family:var(--font-display); font-weight:700; font-size:26px; line-height:1; }
.oc-mid { display:flex; align-items:center; gap:22px; padding:0 18px; flex:1; }
.oc-stat { display:flex; flex-direction:column; gap:2px; }
.oc-stat .k { font-family:var(--font-mono); font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:var(--text-dim); }
.oc-stat .v { font-family:var(--font-mono); font-size:15px; font-weight:500; color:var(--text-primary); font-variant-numeric:tabular-nums; }
.oc-stat .v.acc { color:var(--accent-text); }
.oc-mock { margin-left:auto; display:inline-flex; align-items:center; gap:6px; font-family:var(--font-ui);
  font-size:12px; color:var(--live); border:1px solid var(--live); border-radius:var(--r-ctl); padding:3px 9px; }
```

- [ ] **Step 4: Verify + commit**

Run app with an active draft (or seed livePicks); screenshot the bar; verify pick math and Mock badge (mock draft). Then:
```bash
git add src/components/OnTheClockBar.jsx src/App.jsx src/components/AppShell.jsx src/styles/style.css
git commit -m "feat(draft): persistent on-the-clock context bar"
```

---

## Task 6: Board table restyle (visual)

**Files:**
- Modify: `src/components/BoardTable.jsx`, `src/styles/style.css` (`.board-table`, `.row-me/-other`, pos badges, tier rows, skeleton)

**Interfaces:**
- Consumes: existing board row data + tokens. No new columns invented.

- [ ] **Step 1: Read BoardTable.jsx** to inventory current columns/classes before editing.

- [ ] **Step 2: Position badge + tabular-nums + states CSS**

```css
.board-table { width:100%; border-collapse:collapse; }
.board-table thead th { font-family:var(--font-mono); font-size:10px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--text-dim); font-weight:400; text-align:left;
  background:var(--surface-nav); border-bottom:1px solid var(--border); padding:8px 8px; }
.board-table th, .board-table td { padding:5px 8px; line-height:1.3; }
.board-table td { border-bottom:1px solid var(--border-soft); }
.board-table .col-name strong { font-family:var(--font-ui); font-weight:600; }
.board-table .col-rk, .board-table .col-bye, .board-table .col-ecr, .board-table .col-tier,
.board-table .num { font-family:var(--font-mono); font-variant-numeric:tabular-nums; }
.pos-badge { display:inline-block; min-width:30px; text-align:center; font-family:var(--font-mono);
  font-weight:700; font-size:10.5px; color:var(--pos-on); padding:3px 0; border-radius:var(--r-ctl); }
.pos-badge.rb { background:var(--pos-rb); } .pos-badge.wr { background:var(--pos-wr); }
.pos-badge.qb { background:var(--pos-qb); } .pos-badge.te { background:var(--pos-te); }
.pos-badge.k { background:var(--pos-k); } .pos-badge.def { background:var(--pos-def); }
.board-table tr:focus-visible { outline:2px solid var(--accent-fill); outline-offset:-2px; }
.row-me td { background:color-mix(in srgb, var(--good) 14%, transparent); }
.row-other td { background:color-mix(in srgb, var(--live) 12%, transparent); color:var(--text-muted); }
.board-skeleton td { height:29px; }
.board-skeleton .sk { display:block; height:12px; border-radius:2px;
  background:color-mix(in srgb, var(--text-dim) 22%, transparent); }
@media (prefers-reduced-motion: no-preference) { .board-skeleton .sk { animation:skPulse 1.2s var(--ease) infinite; } }
@keyframes skPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
```

- [ ] **Step 3: BoardTable JSX**

Apply `pos-badge {rb|wr|qb|te|…}` class (from `normalizePos`) with the POS text kept inside (color-not-alone). Ensure numeric cells carry `col-*`/`num` classes. Add sortable header buttons with `aria-sort` reflecting current sort. Add a `board-skeleton` block of ~8 rows rendered while `picksLoading` / enriching and board empty.

- [ ] **Step 4: Verify + commit**

Run app; import a small CSV or load a draft; screenshot board (dense rows, tabular nums, colored POS badges with text, me/other rows, skeleton on load). Screenshot both themes. Then:
```bash
git add src/components/BoardTable.jsx src/styles/style.css
git commit -m "feat(board): broadcast dense table, position badges, states, skeleton"
```

---

## Task 7: Cards / AI advice / filters / modals + states (visual)

**Files:**
- Modify: `src/components/BoardSection.jsx` (filter chips, toolbar), `src/components/AdviceDialog.jsx`, `src/components/Modal.jsx`, `src/styles/style.css` (`.card`, `.btn*`, `.toolbar`, `.filters-row`, modal scrim)

**Interfaces:**
- Consumes: tokens, `Icon`.

- [ ] **Step 1: Card / button / control CSS via tokens**

```css
.card { background:var(--surface-card); border:1px solid var(--border); border-radius:var(--r-card);
  padding:16px; box-shadow:none; }
.btn { font-family:var(--font-ui); border-radius:var(--r-ctl); transition:background var(--dur) var(--ease); }
.btn-primary { background:var(--accent-fill); color:var(--accent-on); border:1px solid transparent; }
.btn-primary:hover { filter:brightness(1.05); }
.btn-secondary { background:transparent; color:var(--text-primary); border:1px solid var(--border); }
.btn:focus-visible { outline:2px solid var(--accent-fill); outline-offset:2px; }
.btn:disabled { opacity:.5; cursor:not-allowed; }
input.control, select.control, textarea.control { background:var(--surface-nav); color:var(--text-primary);
  border:1px solid var(--border); border-radius:var(--r-ctl); }
input.control:focus-visible { outline:2px solid var(--accent-fill); outline-offset:1px; }
.filter-chip { font-family:var(--font-ui); font-size:12px; font-weight:600; padding:6px 10px;
  border:1px solid var(--border); background:var(--surface-nav); color:var(--text-muted); border-radius:var(--r-ctl); cursor:pointer; }
.filter-chip.active { background:var(--accent-fill); color:var(--accent-on); border-color:transparent; }
.modal-backdrop { background:rgba(4,8,18,.55); z-index:var(--z-backdrop); }
.modal-card { z-index:var(--z-modal); }
```

- [ ] **Step 2: Position filter as chips**

In `BoardSection.jsx` (or `FiltersRow.jsx`), render the position filter as a row of `.filter-chip` buttons (`Alle/QB/RB/WR/TE`), active = current `positionFilter`. Keep existing `onPositionChange` handler semantics.

- [ ] **Step 3: AI advice + modal states**

Restyle `AdviceDialog.jsx` to token cards; the single primary CTA uses `.btn-primary` (sharp, no skew); alternatives use `.btn-secondary`. Ensure `Modal.jsx` scrim uses `.modal-backdrop` token and has visible close + Escape handling.

- [ ] **Step 4: Verify + commit**

Run app; open AI Advice dialog + analysis modal; toggle filter chips; screenshot both themes. Then:
```bash
git add src/components/BoardSection.jsx src/components/FiltersRow.jsx src/components/AdviceDialog.jsx src/components/Modal.jsx src/styles/style.css
git commit -m "feat(ui): token cards, chip filters, advice + modal states"
```

---

## Task 8: Empty states + a11y pass + verification

**Files:**
- Modify: `src/pages/DashboardPage.jsx`, `src/pages/BoardPage.jsx`, `src/styles/style.css`; add `aria-live` region for new picks (in `App.jsx` or `OnTheClockBar`).

- [ ] **Step 1: Empty states**

Ensure three states teach the interface with a clear CTA (token-styled, `Icon`, not bare text): not connected (Dashboard connect), no board imported (Board → link to Setup import), no picks yet (Board → "Auto-Refresh aktivieren"). Reuse existing `dashboard-empty` pattern, restyled.

- [ ] **Step 2: aria-live for picks**

Add a visually-hidden polite live region that announces the latest pick, e.g. `Pick 1.06: Jahmyr Gibbs`, updated when `livePicks` grows.
```jsx
<div className="sr-only" aria-live="polite">{latestPickAnnouncement}</div>
```
```css
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); border:0; }
```

- [ ] **Step 3: Reduced-motion + focus audit**

Confirm every animation has a `@media (prefers-reduced-motion: reduce)` fallback; every interactive element shows a visible focus ring (added in Tasks 4/6/7 — verify none missed).

- [ ] **Step 4: Full verification pass**

Run: `npm test` (all green) and `npm run build` (no errors). Then run the app and screenshot, in **both themes**: Dashboard (empty + with leagues), Board (with picks, empty, skeleton), Roster, Trade, Setup. Verify: no emoji anywhere, contrast legible, focus rings visible, on-the-clock + Mock badge correct.

- [ ] **Step 5: Grep guard + commit**

Run: `npm test` — the `no-emoji` guard must still pass.
```bash
git add src/pages src/App.jsx src/styles/style.css
git commit -m "feat(ux): empty states, aria-live picks, a11y pass"
```

---

## Task 9 (optional): Deep-linking draft + filters

**Files:** `src/App.jsx` / router, `src/stores/useSessionStore.js`, `src/stores/useBoardStore.js`.

Sync `selectedDraftId` and active filters to URL query params (`?draft=…&pos=…&q=…`) so state is shareable and preserved on back/forward. Clearly optional — behavioral change with regression risk; implement only if the user approves after Task 8. TDD the param serialize/parse helpers before wiring.

---

## Self-Review

- **Spec coverage:** Tokens/type/spacing/motion (§3) → T1; theming architecture (§3.5) → T2/T4; topbar/nav (§4.1) → T4; on-the-clock (§4.2) → T5; board table (§4.3) → T6; cards/AI/filters/modals (§4.4) → T7; icons (§5) → T3; UX/empty/a11y/deep-link (§6) → T8/T9; contrast (§7) → verified in T4/T6/T8; anti-slop (§8) → constraints + per-task; phases (§9) → task order; light theme (§10) → T1/T2/T4. All covered.
- **Placeholders:** none — logic tasks carry full code + tests; visual tasks carry concrete CSS + browser verification with explicit expected observations.
- **Type consistency:** `themeId`/`setTheme`/`THEMES`/`DEFAULT_THEME_ID`/`applyTheme`/`resolveInitialTheme`/`Icon` names consistent across T2–T8.
