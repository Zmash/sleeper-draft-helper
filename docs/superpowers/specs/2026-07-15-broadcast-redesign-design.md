# Design-Spec — Visuelles Redesign „Broadcast Lower-Third"

**Projekt:** Sleeper Draft Helper (React 18 + Vite)
**Datum:** 2026-07-15
**Status:** Entwurf zur Freigabe
**Vorarbeit:** Brainstorming (Richtungs-Galerie → Richtung 02 gewählt), volle Board-Mock,
Bewertung mit `ui-ux-pro-max`, Gegencheck mit `impeccable`.

---

## 1. Ziel & Nicht-Ziele

**Ziel:** Weg vom generischen „AI-Slop"-Look (AI-Blau, Über-Rundung, Emoji-Icons, charakterloser
System-Font) hin zu einer eigenständigen, football-spezifischen Design-Sprache — der Richtung
**„Broadcast Lower-Third"**: committed Dark „Night-Draft-Room", Field-Night-Navy, Signal-Gelb-Akzent,
scharfe Kanten, dichte tabellarische Daten. Der Look bleibt ein **Werkzeug**: die Wucht steckt in
Header/Bauchbinde/Akzenten, die Datenflächen bleiben ruhig und lesbar.

**Szene (Design-Anker):** Ein:e Nutzer:in sitzt abends beim Live-Draft am Laptop, mehrere Picks laufen
schnell, die Uhr tickt — braucht auf einen Blick Kontext (wer ist dran, was ist der beste verfügbare
Pick) unter geringem Umgebungslicht. → committed Dark ist hier eine Entscheidung, kein Default.

**Nicht-Ziele:**
- Keine Änderung der Fachlogik (Sleeper-API, Stores, AI-Services, Draft-/Mock-Logik).
- Keine neuen Datenquellen. Die Tabelle nutzt **vorhandene** Board-Daten; keine erfundenen Spalten.
- Keine Architektur-Neuschreibung des CSS (kein Wechsel zu CSS-Modules/Tailwind in v1) — stattdessen
  eine Token-Ebene einziehen und bestehende Regeln darauf umstellen.

---

## 2. Design-Entscheidungen (verbindlich)

| Thema | Entscheidung |
|---|---|
| Richtung | Broadcast Lower-Third |
| Theme | **Mehrere umschaltbare Themes.** v1: „Broadcast Dark" (Identität/Default) + „Broadcast Light" (eigenständig gestaltet, kein naiver Invert). Architektur für weitere Themes vorbereitet (§3.5). |
| Akzent | Neon-Gelb `#ffd21e` (Nutzer-Entscheidung) |
| Namen/Daten-Schrift | **Verfeinert:** Condensed Caps nur für On-the-clock-Hero + Spalten-/Section-Labels; Spielernamen & Tabellendaten in **regular Barlow, Sentence Case** (impeccable-Empfehlung, Nutzer bestätigt) |
| Icons | SVG-Set (Lucide), einheitliche Strichstärke — **alle Emoji ersetzt** |
| Kanten | Scharf: 2px Controls, 3px Cards |

---

## 3. Design-Tokens (CSS Custom Properties)

Eingezogen als Token-Ebene oben in `src/styles/style.css` (ersetzt die aktuellen `:root`-Farben).

### Farbe
```css
--field-900:#071026;  /* Seiten-Hintergrund            */
--field-800:#0a1836;  /* Nav / Basis-Surface           */
--field-700:#0f2149;  /* Card / erhabene Fläche         */
--field-600:#102450;  /* Hover / empfohlene Zeile       */
--line:#1c336a;       /* Standard-Rahmen 1px            */
--line-soft:#16264d;  /* Tabellen-Hairline              */
--ink-0:#eef3ff;      /* Primärtext  (>7:1 auf 800/900) */
--ink-1:#93a6cf;      /* muted       (>4.5:1)           */
--ink-2:#6b7fa8;      /* dim / Metadaten (nur ≥3:1-Kontexte: Labels ≥14px bold) */

--signal:#ffd21e;     /* Akzent: NUR Aktion/Auswahl/State, nie Deko */
--on-signal:#1a1400;  /* Text auf Signal-Fläche         */
--live:#ff3b47;       /* On-the-clock / Live-Indikator   */
--good:#37d67a;       /* Value ↑ (semantisch, ≠ Akzent) */
--bad:#ff7a6b;        /* Value ↓ (semantisch)           */

/* Positionsfarben — Kontrast auf Dark je Nutzung prüfen (§7). */
--pos-rb:#22b455; --pos-wr:#2f8fe0; --pos-qb:#ef4a63;
--pos-te:#f0982f; --pos-k:#a06ff0;  --pos-def:#8a94a6;
```

### Typografie
- Familien (self-hosted via `@font-face`, `font-display:swap`):
  **Barlow** (UI/Body/Namen, 400/500/600) · **Barlow Condensed** (Display/Hero/Labels, 600/700) ·
  **JetBrains Mono** (alle Zahlen, `font-variant-numeric:tabular-nums`).
- Skala (fixe rem, kein fluid — Product-Register): `--fs-11 .6875rem` · `--fs-12 .75rem` ·
  `--fs-13 .8125rem` · `--fs-15 .9375rem` · `--fs-16 1rem` · `--fs-20 1.25rem` · `--fs-26 1.625rem`
  · `--fs-30 1.875rem`.
- **Schrift-Skopierung (verbindlich):**
  - Barlow Condensed **nur**: On-the-clock-Pick-Nummer, Wortmarke, Spalten-Header, kurze
    Section-/Nameplate-Labels. Uppercase erlaubt (kurze Labels), tracking ~.04em.
  - Regular **Barlow**, Sentence Case: Spielernamen, Zellinhalte, Buttons, Nav-Labels, Fließtext.
  - **JetBrains Mono**: Rank, Bye, Tier, ADP/Proj/Value, Clock, alle Spaltenzahlen.
  - Verbot (Product-Ban): Display-Font in generischen UI-Labels/Buttons/Datenzellen.

### Spacing / Radius / Motion / Z-Index
- Spacing 4er-Basis: 4 · 8 · 12 · 16 · 24 · 32 (`--sp-1..--sp-8`).
- Radius: `--r-ctl:2px` · `--r-card:3px` (scharf, committed).
- Motion: 150–220ms, ease-out; nur State/Feedback/Reveal, keine Page-Load-Choreografie.
  `--dur:180ms`, Row-Flash bei neuem Pick. `@media (prefers-reduced-motion:reduce)` → Crossfade/instant.
- Z-Index-Skala semantisch: dropdown 10 · sticky 20 · modal-backdrop 40 · modal 50 · toast 60 · tooltip 70.

### 3.5 Theming-Architektur (mehrere Themes vorbereitet)
Ziel: Themes umschaltbar, neue Themes ohne Komponenten-Änderung ergänzbar.
- **Rollen-Tokens statt Roh-Hex in Komponenten.** Die konkreten Hex-Werte oben sind die Werte des
  Default-Themes „Broadcast Dark". Komponenten konsumieren ausschließlich **Rollen**:
  `--surface-page/-nav/-card/-raised`, `--text-primary/-muted/-dim`, `--border/-soft`,
  `--accent-fill` + `--accent-on` (Text auf Akzentfläche) + **`--accent-text`** (Akzent als
  Text/Icon — in Light ein dunkleres Gold/Navy, weil `#ffd21e` als Text auf Hell durchfällt),
  `--live`, `--good`, `--bad`, `--pos-*`.
- **Theme-Umschaltung:** `:root` = Default (Dark). Overrides je Theme unter `:root[data-theme="<id>"]`
  — nur die Rollen-Tokens werden neu belegt, Komponenten bleiben unberührt.
- **Theme-Registry:** kleine Liste `{ id, label, kind:'dark'|'light' }` als Single Source of Truth für
  die Theme-Auswahl-UI und die Persistenz. v1-Einträge: `broadcast-dark`, `broadcast-light`.
- **Light-Variante „Broadcast Light" (eigenständig, kein Invert):** heller „Day-Game"-Grund
  (kühles Stadion-Weiß/Grau), tiefes Navy als Text, Akzent bleibt Signal-Gelb **als Fläche**
  (mit dunklem `--accent-on`); `--accent-text` wird zu dunklem Gold/Navy für Kontrast ≥4.5:1.
  Positions-/Semantik-Farben je Theme auf Kontrast geprüft.
- **Persistenz:** Theme-ID im bestehenden `useUIStore` (ersetzt das binäre `themeMode`,
  Migration von `'dark'|'light'` → `broadcast-dark|broadcast-light`). `data-theme` +
  vorhandener `localStorage`-Sync bleiben.
- `prefers-color-scheme` liefert nur den **Startwert**, wenn noch keine Wahl gespeichert ist; die
  explizite Nutzerwahl gewinnt und wird über `data-theme` gesetzt.

---

## 4. Komponenten-Specs

Jede interaktive Komponente liefert **alle** Zustände: default · hover · focus (sichtbarer Ring
`2px var(--signal)`) · active · disabled · loading · error.

### 4.1 Topbar + Nav (`Topbar.jsx`, `TabsNav.jsx`)
- Wortmarke „DRAFT**HELPER**" (Condensed, „HELPER" in Signal) + `small` „Sleeper".
- Season/Week-Pill (Mono) · Live-Chip „Draft läuft" (geschrägt, `--live`) nur bei laufendem Draft.
- Nav-Tabs (Home/Board/Roster/Trade): Barlow, Sentence Case, **SVG-Icon + Label**; aktiv =
  `--ink-0` + Unterstrich `2px var(--signal)`; `aria-current="page"`.
- User-Badge (`@name`, grüner Status-Dot) · **Theme-Auswahl** (kleines Dropdown/Popover, aus der
  Theme-Registry §3.5 gespeist) statt binärem Toggle — Icon-Button öffnet die Auswahl (kein Emoji).

### 4.2 On-the-clock-Leiste (neue Komponente, persistenter Draft-Kontext)
- Geschrägter Signal-Block (`clip-path`, **einziger** Skew im UI): „On the clock" + Pick `1.07`
  (Condensed) + wessen Pick.
- Kennzahlen (Mono): Runde `1/15`, Gesamt-Pick `7/180`, nächster Pick + „in N Picks", Board-Count.
- Clock in Signal-Gelb, `tabular-nums`, `--live`-Ring.
- **Mock-Modus:** deutliches `MOCK`-Badge; „bis zu meinem Pick simulieren" / „Mock neu starten".
- Datenquelle: `livePicks`, `selectedDraft.settings`, `inferMyDraftSlot`, `teamsCount` (vorhanden).

### 4.3 Board-Tabelle (`BoardTable.jsx`, `.board-table`)
- Bestehende Struktur beibehalten; nur Tokens + Broadcast-Feinschliff.
- Zeilenhöhe ~30px, Hairline-Trenner, `tabular-nums` auf allen Zahlenspalten.
- **Spalten = vorhandene Daten** (kein Erfinden): `#`/Rank, POS-Badge, Player (regular Barlow),
  Team, Bye, Tier — plus vorhandene `SOS`, `DYN` (Dynasty-Value), `ECR` wo geladen. Die Mock-Spalten
  ADP/Proj/Value sind **optional** und nur zu zeigen, wenn echte Daten existieren, sonst weglassen.
- POS-Badge: Positionsfarbe + **immer** POS-Text (Farbe-nicht-allein).
- Tier-Trennzeilen; empfohlene Zeile = `--field-600` + Signal-Rang-Block + „PICK"-Nameplate;
  gedraftet = gedimmt + durchgestrichen + Drafter-Label; eigene/fremde Zeile (`row-me`/`row-other`)
  über Tokens statt roher rgba.
- Sortierbare Header mit `aria-sort`; horizontales Scrollen im `overflow-x:auto`-Wrapper.
- **Skeleton-Rows** beim Laden (ersetzt die „Picks werden geladen…"-Leiste).
- Drag-&-Drop-Reorder bleibt; Fokus-/Tastatur-Zugänglichkeit ergänzen.

### 4.4 Cards / AI-Advice / Filter / Modals
- Cards: scharf, `1px var(--line)`, kein dekorativer Akzent-Tick, keine verschachtelten Cards.
- AI-Advice: Empfehlung + Alternativen + Kurzbegründung; **primäre CTA** in Signal (nur diese eine
  pro View), Button = **scharfes Rechteck** (kein Skew).
- Filter: Segmented-Chips (Positionen), aktiver Chip in Signal; Suche mit sichtbarem Label/Placeholder
  (Kontrast ≥4.5:1).
- Modals: Scrim 40–60% Schwarz; sichtbare Schließen-Affordance; Fokus-Falle + Escape.

---

## 5. Icons
Emoji vollständig ersetzen durch ein SVG-Set (Lucide-Pfade als kleine React-Icon-Komponente oder
`lucide-react`). Betroffen u.a.: Topbar ☀️🌙, Dashboard 🏈📋, AI 🤖, Refresh ↺, Analyse 📊.
Einheitliche Strichstärke (1.5–2px), Größen-Tokens (16/20/24), `aria-label` bei Icon-only-Buttons.

---

## 6. UX-Verbesserungen (Draft + Mock)
- Persistente On-the-clock-Leiste; „Picks bis zu dir" sichtbar.
- **Deep-Links:** ausgewählter Draft + aktive Filter in URL (teilbar; Zustand bleibt bei Back).
- Echte **Empty-States** (nicht verbunden / kein Board / keine Picks) mit klarer CTA, die die
  Oberfläche erklären.
- **Value/ADP-Delta** (falls Daten vorhanden) mit Icon **und** Farbe (Reach/Value nicht nur farblich).
- **A11y:** Fokus-Ringe auf Zeilen/Controls; `aria-live="polite"` für neue Picks
  („Pick 1.06: Jahmyr Gibbs"); `tabular-nums`; reduced-motion; Kontrast in Dark geprüft.

---

## 7. Positions-Badge-Kontrast (offene Prüfung, in Umsetzung erledigen)
Weiß auf `--pos-wr #2f8fe0` / `--pos-qb #ef4a63` ist bei kleiner Badge grenzwertig (~3:1). In der
Umsetzung je Badge messen; falls < 3:1 → Hue abdunkeln **oder** getönter BG (Positionsfarbe @ ~18%)
mit farbigem Text der 800er-Stufe. POS-Text bleibt immer sichtbar.

---

## 8. Anti-Slop-Compliance (Checkliste)
- [x] Keine Side-Stripe-Borders (Absolute Ban) — entfernt, bleibt raus.
- [x] Kein Gradient-Text, keine Deko-Glassmorphism, kein Hero-Metric-Template.
- [x] Kein generisches AI-Blau als Identität; Akzent nur funktional.
- [x] Keine Emoji-Icons.
- [x] Kein Display-Font in Datenzellen/Buttons/Labels (Schrift-Skopierung §3).
- [x] Skew nur am einen Brand-Moment (On-the-clock), keine „invented affordances" sonst.
- [x] Keine eyebrow-/01·02·03-Scaffolds.

---

## 9. Umsetzungs-Ansatz & Phasen (für den Implementierungsplan)
1. **Token-Fundament + Theming:** Fonts self-hosten (`@font-face`), **Rollen-Tokens** + Default-Theme
   „Broadcast Dark", Theme-Registry + `[data-theme]`-Overrides, Base/Typo-Reset. `useUIStore` von
   binärem `themeMode` auf Theme-ID migrieren; `data-theme`/localStorage-Sync anpassen.
2. **Chrome + Theme-Auswahl:** Topbar + TabsNav → Broadcast; **Theme-Auswahl-UI** (Registry-gespeist)
   statt Toggle; SVG-Icon-Komponente einführen, Emoji ersetzen. „Broadcast Light" als zweites Theme
   fertigstellen und in beiden Themes prüfen.
3. **On-the-clock-Leiste:** neue Komponente, an vorhandenen Draft-State gebunden; Mock-Badge.
4. **Board-Tabelle:** Tokenisierung, `tabular-nums`, POS/Tier/State-System, Skeleton-Rows,
   `aria-sort`; nur vorhandene Datenspalten.
5. **Cards/AI/Filter/Modals:** Tokens + volles State-Vokabular; scharfe Buttons.
6. **Empty-States, Deep-Linking, A11y-Pass, Verifikation** (Kontrast/Focus/reduced-motion; App real
   durchklicken).

Optional als Teil der Umsetzung: `impeccable`-Projektkontext (PRODUCT.md/DESIGN.md) generieren, damit
spätere Design-Arbeit einen dokumentierten Anker hat.

---

## 10. Offene Punkte / Risiken
- **Light-Theme:** ~~offen~~ **entschieden:** Themes bleiben umschaltbar; v1 = Broadcast Dark (Default)
  + Broadcast Light, über die Theme-Registry/Rollen-Tokens (§3.5) so gebaut, dass weitere Themes
  später ohne Komponenten-Änderung dazukommen.
- **Datenabhängige Spalten (ADP/Proj/Value):** nur wenn Daten real vorliegen; sonst mit vorhandenen
  Spalten (RK/ECR/Tier/SOS/DYN/Bye) arbeiten.
- **Font-Hosting:** Barlow/Barlow Condensed/JetBrains Mono self-hosten (kein CDN-Zwang, offline/Capacitor-tauglich).
- **CSS-Umfang:** 1942-Zeilen-Global-Stylesheet wird tokenisiert, nicht neu strukturiert — Risiko von
  Spezifitäts-Kollisionen; in Phasen testen.

---

## 11. Verifikation (Definition of Done)
- Alle Emoji-Icons ersetzt; Grep auf Emoji im `src/` leer.
- Kontrast: Primärtext ≥4.5:1, große/bold Labels ≥3:1, Positions-Badges geprüft.
- Sichtbare Fokus-Zustände auf allen interaktiven Elementen; `prefers-reduced-motion` respektiert.
- App real durchgeklickt (Board mit Picks, leeres Board, Mock-Draft, Roster, Trade, Setup) —
  Screenshots als Nachweis.
- Keine offenen `impeccable`-Hook-Findings auf geänderten Dateien.
