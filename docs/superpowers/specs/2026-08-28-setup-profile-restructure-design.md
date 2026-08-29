# Setup/Profile-Restrukturierung — Design

Status: entworfen, noch nicht implementiert
Branch: `design/setup-profile-restructure`

## Problem

Die App ist ursprünglich auf eine einzige Liga + ein Board ausgelegt und seither
gewachsen. Heute:

- `SetupForm.jsx` ist eine ~600-Zeilen-Komponente: Liga/Draft-Auswahl,
  Draft-Modus, Format-Overrides, Draft-Strategie, Sync-Settings, CSV-/Auto-Import
  — alles in einem 2-Step-Akkordeon.
- Format-Overrides (`scoring_type`, `superflex`, `roster_positions`, `teams`,
  `rounds`, `type`) liegen in **einem einzigen globalen** `localStorage`-Key
  (`sdh.setup.v2`), unabhängig von der aktiven Liga/dem aktiven Draft. Wechselt
  man die Liga oder öffnet einen neuen Mock-Draft, bleiben alte Overrides
  bestehen und werden auf ein Format angewendet, für das sie nie gedacht waren
  — mit direktem Effekt auf die Pick-Empfehlungen (stiller Fehler, kein Crash).
- Draft-Strategien (`sdh.strategies.v1`) sind bereits klüger gelöst: sie hängen
  an einem **Format-Fingerprint** (Teams × Scoring × Superflex × Draft-Modus),
  nicht an einer Liga — mehrere Drafts mit gleichem Format teilen sich
  automatisch dieselbe Strategie, mit toleranter Abweichungs-Erkennung
  (`strategyMatch.js`).
- Reale Ligen sind selten (meist 1–3, über Jahre stabil), der dominante
  Use-Case ist aber das schnelle Mock-Draften — Mocks haben keine `league_id`
  und sind das eigentliche Ziel der "pro Kontext"-Overrides.

Der Nutzer will eine bewusste Trennung: Einstellungen, die **liga-/mock-
übergreifend** sinnvoll sind, sollen zentral über **Profile** verwaltet werden;
das Liga/Mock-Setup selbst bleibt schlank (nur Identität + Import) und kann
gezielt am zugewiesenen Profil drehen.

## Ziele

- Format-Overrides und Draft-Strategie leben in einem gemeinsamen,
  wiederverwendbaren **Format-Profil**, nicht mehr in getrennten globalen Keys.
- Profile werden automatisch der richtigen Liga/dem richtigen Mock zugeordnet
  — kein manuelles Neu-Einstellen bei jedem Liga-/Mock-Wechsel, kein Leaken
  zwischen unterschiedlichen Formaten.
- Ein Profil ist über zwei Einstiege bearbeitbar: im Kontext eines aktiven
  Drafts (Setup-Seite) und unabhängig davon in einem neuen Profile-Hub.
- Die Setup-Seite wird spürbar schlanker und übersichtlicher.
- Ein falsch zugeordnetes Profil muss sichtbar werden, bevor es die
  Draft-Session beeinflusst — nicht nur beim Einrichten, auch während des
  Draftens.

## Nicht-Ziele

- `preferences.js` (Fav/Avoid-Markierungen) bleibt unverändert — weiterhin
  scoped nach `draftMode` (redraft/rookie), nicht nach Profil. Das ist ein
  anderer Belang (spielerbezogen, nicht formatbezogen) und wurde vom Nutzer
  nicht als Problem benannt.
- App-weite Settings (Sleeper-Account, Theme, API-Key, Sync/Polling) bleiben
  global — daran ändert sich nichts Strukturelles, nur ihr Zugriffsweg (siehe
  Navigation).
- Keine Board-Daten-Trennung pro Liga/Mock (`boardPlayers` bleibt ein
  einzelnes aktives Board, wie heute). Das ist ein separates Thema.

## Datenmodell

### Format-Profil

```js
{
  id: 'prof_xxx',
  name: 'Meine Dynasty-Liga',        // auto-generiert oder umbenannt
  boundLeagueId: 'league_id' | null, // gesetzt bei echter Liga
  fingerprint: {                     // gesetzt bei Mock/Standalone (boundLeagueId null)
    draftMode, scoringType, superflex, teams, starters: [...]
  } | null,
  overrides: {
    scoring_type, superflex, roster_positions, teams, rounds, type,
  },
  strategy: {
    principles: '',
    items: [ { id, label, summary, rules, sources, contested, source, createdAt } ],
  },
  createdAt, updatedAt,
}
```

Genau eine der beiden Bindungen ist gesetzt: `boundLeagueId` ODER
`fingerprint`. Die Fingerprint-Berechnung ist identisch zu
`strategyMatch.js::makeFingerprint`, nur dass sie jetzt für Profile statt für
einzelne Strategie-Items verwendet wird (siehe unten, Konsolidierung).

### Zuordnung (Resolution)

Neue Funktion `resolveProfile({ draft, league, draftMode, overrides })`
(ersetzt `loadSetup`/`saveSetup` + Teile von `strategyStore.js`):

1. Ist `draft` an eine Liga gebunden (`!isStandaloneDraft(draft)`) → suche
   Profil mit `boundLeagueId === league.league_id`. Kein Treffer → neues
   Profil anlegen, `boundLeagueId` gesetzt, Overrides leer (volle
   Auto-Erkennung via `deriveFormat`).
2. Standalone-Draft (Mock) → berechne den Fingerprint aus dem **erkannten**
   Format (vor Overrides) und matche gegen vorhandene `fingerprint`-Profile,
   mit derselben toleranten Logik wie heute `pickStrategy` (harter Filter auf
   `scoringType`/`superflex`/`draftMode`, weiche Abweichungs-Bewertung auf
   `teams`/`starters`). Treffer mit Abweichungen → Profil wird trotzdem
   angewendet, aber mit sichtbarer Warnung (siehe UI). Kein Treffer → neues
   Profil mit diesem Fingerprint anlegen.
3. Rückgabe: `{ profile, deviations: string[], isNew: boolean }`.

Das Ergebnis speist `deriveFormat({ draft, league, overrides: profile.overrides })`
genau wie heute — an `draftFormat.js` ändert sich nichts.

### Storage

Neue Datei `src/services/profileStore.js` ersetzt `storage.js`'s
`loadSetup/saveSetup` und `strategyStore.js` vollständig (Konsolidierung —
beide lösten bereits denselben Belang mit unterschiedlicher Reichweite).

- Key: `sdh.profiles.v1`
- `loadProfiles()`, `saveProfiles(list)`
- `resolveProfile(...)` (siehe oben)
- `upsertProfileOverrides(id, patch)`, `upsertProfileStrategy(id, patch)`
- `renameProfile(id, name)`, `duplicateProfile(id)`, `deleteProfile(id)`
- `createBlankProfile(name)` — für manuell angelegte Profile ohne Bindung,
  über das Profile-Hub wählbar

`strategyMatch.js` bleibt bestehen (reine Fingerprint-/Matching-Funktionen,
kein Storage) und wird für Profile statt für einzelne Strategie-Items
verwendet — die Deviation-Scoring-Logik (`pickStrategy`) wird zu
`pickProfile` verallgemeinert. Die bisherige "mehrere Strategie-Items pro
Wildcard-Fingerprint"-Komplexität entfällt: ein Profil hat explizite
Overrides und braucht daher nur eine Strategie, nicht mehrere konkurrierende
Kandidaten.

### Migration

Einmalig beim ersten Laden (`migrateLegacyProfile()`):

- Liest `sdh.setup.v2` (Overrides) und `sdh.strategies.v1` (Prinzipien +
  Items).
- Erzeugt daraus ein Profil `"Migriert"` ohne Bindung (`fingerprint: null`,
  wirkt wie ein Wildcard — wird nur verwendet, wenn kein spezifischeres
  Profil zutrifft), damit nichts verloren geht.
- Alte Keys bleiben unangetastet liegen (Rollback-fähig, wie es das Projekt
  bei früheren Migrationen schon so gehandhabt hat).
- Ab dem ersten echten Liga-/Mock-Kontakt entstehen daneben die
  kontext-spezifischen Profile ganz normal über `resolveProfile`.

## Komponenten

### `ProfileEditor` (neu, ersetzt den Format-/Strategie-Teil von `SetupForm`)

Eine Komponente, zwei Einstiege:

- Format-Overrides (Scoring, Superflex, Roster-Positionen, Teams/Runden/Typ)
  — identische Felder wie heute im Akkordeon, aber ohne Akkordeon-Verschachtelung.
- `StrategySection` bleibt als Kind-Komponente bestehen, liest/schreibt aber
  jetzt `profile.strategy` statt des globalen `sdh.strategies.v1`.
- Props: `profileId`. Lädt/speichert direkt über `profileStore`.

### `/setup` (bestehende Route, entschlackt)

1. Liga/Draft-Verknüpfung (unverändert: Liga-Auswahl, Draft-Auswahl,
   Anhängen per ID/Link, Draft-Modus-Toggle).
2. **Profil-Karte**: Name, Bindungs-Badge (`Icon name="anchor"` = liga-gebunden
   / `Icon name="shuffle"` = format-gebunden), bei Abweichung ein Warnhinweis
   im bestehenden `form-error`-Stil (wie heute in `StrategySection`). Dropdown
   "Anderes Profil verwenden" (manuelles Umhängen auf ein bestehendes Profil)
   + Link "Profil verwalten" → `/profiles/:id`.
3. `<ProfileEditor profileId={resolved.profile.id} />`.
4. Rankings-Import (CSV/Auto) — unverändert, instanzbezogen.
5. Markierungen löschen — unverändert.

### `/profiles` (neu)

- Liste aller Profile als Karten: Name, Bindungs-Badge, Format-Zusammenfassung
  (Teams · Scoring · Superflex), "zuletzt verwendet".
- Aktionen pro Karte: Bearbeiten (`<ProfileEditor>` inline aufklappen oder
  eigene Route `/profiles/:id`), Umbenennen, Duplizieren, Löschen (mit
  `window.confirm`, wie der Rest der App das für destruktive Aktionen schon
  handhabt).
- "+ Neues Profil" (sekundär platziert, nicht die Haupt-CTA — siehe Empty
  State).
- **Empty State** (vor der ersten Liga-/Mock-Nutzung): kein leerer Bildschirm.
  Kurzer Erklärtext ("Profile bündeln Format-Einstellungen und
  Draft-Strategie — sie entstehen automatisch, sobald du eine Liga verbindest
  oder einen Draft öffnest.") + primäre CTA zurück zum Dashboard
  ("Liga/Mock hinzufügen"), nicht "+ Neues Profil".

### Board-Seite: Profil-Hinweis

Kompakter, nicht aufdringlicher Hinweis (Profil-Name + Abweichungs-Warnung
falls vorhanden, gleicher visueller Stil wie die Strategie-Abweichungsanzeige)
mit Link zurück zu `/setup`. Grund: ein falsch zugeordnetes Profil verzerrt
live die Pick-Empfehlungen — das muss während des Draftens sichtbar sein,
nicht nur beim Einrichten.

## Navigation

- `TabsNav` (Home/Board/Roster/Trade) bleibt unverändert — reiner
  Draft-Workflow, unabhängig von dieser Änderung.
- Neuer Zahnrad-Button im `Topbar`, öffnet ein `Modal` (bestehende
  Komponente, kein neues Dropdown-Widget) mit drei Links:
  „Liga/Mock-Setup" (→ `/setup`, aktueller Kontext), „Profile verwalten"
  (→ `/profiles`), „API-Key" (bestehender `ApiKeyDialog`, nur zentral
  erreichbar statt versteckt).
- Dashboard-Karten „Edit"-Buttons bleiben wie heute → springen direkt in
  `/setup` für die jeweilige Liga/den jeweiligen Mock.

## Icon-Konvention

Keine Emoji als Struktur-Icons — die App nutzt durchgängig `Icon.jsx` mit
einem definierten SVG-Set. Neue Bedeutungen:

| Bedeutung | Icon |
|---|---|
| Liga-gebunden | `anchor` |
| Format-gebunden (Mock) | `shuffle` |
| Abweichung/Warnung | `warning` (bereits im Set, gleicher Stil wie StrategySection) |

Falls `anchor`/`shuffle` nicht im bestehenden Icon-Set (`Icon.jsx`) vorhanden
sind, werden sie bei der Implementierung ergänzt (gleicher SVG-Stroke-Stil wie
die übrigen Icons).

## Offene Punkte für die Implementierungsplanung

- Reihenfolge: Datenmodell/Storage zuerst (mit Tests für `resolveProfile` und
  `pickProfile`-Deviation-Logik), dann `ProfileEditor`-Extraktion aus
  `SetupForm`, dann `/profiles`-Seite, dann Board-Hinweis, dann Navigation.
- Bestehende Tests (`SetupPage.test.jsx`, `StrategySection`-Verhalten indirekt
  über `BoardSection.advice-cache.test.jsx`) müssen auf das neue Profil-Modell
  angepasst werden.
- `SyncSection` (Auto-Refresh-Polling) bleibt vorerst in `/setup` — global,
  kein Profil-Bestandteil.
