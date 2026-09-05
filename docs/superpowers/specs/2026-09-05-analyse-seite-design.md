# Analyse-Seite (lokal berechnete Statistiken) — Design

Status: entworfen, noch nicht implementiert

## Problem

Der Menüpunkt "Roster & Analyse" (`/roster`) zeigt heute ausschliesslich
`RosterSection` — den eigenen Kader. Diese Information ist seit dem
Shell-Umbau redundant: das Roster liegt im Board-Inspector der neuen Shell
(`NextBoard.jsx:450`, Tab "Roster") und ist dort während des Draftens direkt
neben dem Board sichtbar, also genau da, wo man sie braucht. Die eigene Seite
dafür aufzurufen kostet einen Kontextwechsel und liefert nichts Zusätzliches.

Gleichzeitig hat die App keine einzige **gerechnete** Auswertung. Alles, was
über die reine Pick-Liste hinausgeht, läuft über `DraftAnalysis.jsx` — ein
AI-Review, das einen Anthropic-Key voraussetzt, pro Aufruf Geld kostet und
Fliesstext liefert. Für wiederkehrende, harte Fragen ("welche Position wird
knapp?", "wie gut war mein Draft im Vergleich?", "wo ist der nächste
Tier-Abbruch?") ist das das falsche Werkzeug: die Antworten stehen bereits
vollständig in den Daten, die die App ohnehin lädt.

Ungenutzt liegen dabei konkret herum:

- `stdev`, `high`, `low`, `times_drafted` aus dem Markt-Merge
  (`marketMerge.js:7`) — Konsens- und Streuungsinformation, nirgends angezeigt.
- `tier` und `sos` aus der Ranking-CSV (`csv.js:82`) — nur als Spalte im Board.
- `detectTeamProfile()` und `avgStarterAge()` in `tradeValue.js:49/59` — im
  Trade-Pfad definiert, aber von keiner UI aufgerufen.
- Die kompletten Liga-Kader: `loadDynastyRoster` holt via `fetchLeagueRosters`
  alle Rosters, verwirft aber alle ausser dem eigenen
  (`useDynastyStore.js`).

## Ziele

- `/roster` wird zur reinen Analyse-Seite. Alle Kennzahlen werden **lokal aus
  vorhandenen Daten gerechnet**, mit festen Formeln und ohne AI. Die
  Berechnungen selbst gehen nie ins Netz; ein einziger zusätzlicher
  Sleeper-Request erweitert die Datenbasis (siehe "Liga-Kader in allen
  Ligen").
- Nutzbar **während** des Drafts (Knappheit, Tiers, Runs aktualisieren sich mit
  jedem Pick) und **nach** dem Draft (Team-Ranking, Steals/Reaches als
  Rückschau) — der Schwerpunkt liegt auf der Rückschau.
- Drei Themengebiete als Reiter: **Draft | Kader | Markt**.
- Jede Kachel nennt die harte Zahl gross und zuerst; Grafik nur dort, wo sie
  eine Aussage trägt, die eine Zahl nicht trägt (Verläufe, Verteilungen).
- Jede Formel ist eine reine Funktion und einzeln per Vitest prüfbar.

## Nicht-Ziele

- `DraftAnalysis.jsx` (AI-Draft-Review) bleibt **unverändert** und bleibt ein
  eigener Einstieg. Diese Seite ersetzt es nicht, sie ergänzt es um die
  Ebene, die keine AI braucht.
- Keine Auswertung persönlicher Präferenzen. `preferences.js` (Fav/Avoid) wird
  von dieser Seite **nicht gelesen**. Alle Kennzahlen sind marktbasiert und
  für jeden Betrachter identisch — bewusste Entscheidung des Nutzers.
- Keine Projektionen, keine Punkteprognosen, keine Saison-Simulation. Die App
  hat keine Projektionsdaten; alle Wertaussagen sind **rangbasiert**.
- Keine Liga-Historie über vergangene Saisons (zusätzliche API-Arbeit,
  separates Thema).
- Keine Mobile-Optimierung in diesem Schritt. Die Seite ist für die
  Desktop-Shell entworfen; die Bottom-Bar-Oberfläche unter 900px bekommt sie
  in ihrer bestehenden Form, ohne eigenes Layout.

## Architektur

### Neue Dateien

```
src/services/analysis/draftStats.js    reine Funktionen, Tab "Draft"
src/services/analysis/rosterStats.js   reine Funktionen, Tab "Kader"
src/services/analysis/marketStats.js   reine Funktionen, Tab "Markt"
src/pages/AnalysisPage.jsx             Tab-Container, ersetzt RosterPage.jsx
src/components/analysis/DraftTab.jsx   rendert nur
src/components/analysis/RosterTab.jsx  rendert nur
src/components/analysis/MarketTab.jsx  rendert nur
src/components/analysis/StatCard.jsx   gemeinsames Kachel-Gerüst
```

Drei Service-Module statt eines: die Domänen teilen keine Zwischenergebnisse,
und eine gemeinsame Datei würde bei sechs Kacheln plus Reserve schnell über
600 Zeilen wachsen. `src/services/analysis.js` (heute nur `isDraftComplete()`)
bleibt unangetastet, um den bestehenden Import-Pfad nicht zu brechen.

Die Trennung Service/Komponente ist die zentrale Regel dieses Designs: in den
`*.jsx` steht keine Rechnung, in den `*Stats.js` kein React. Damit ist jede
Formel ohne Renderer testbar — dasselbe Muster wie `derive.js` und
`tradeValue.js`.

### Datenfluss

`App.jsx` reicht bereits alles Nötige über `pageProps` durch (Zeile 377):
`selectedLeague`, `selectedDraft`, `teamsCount`, `ownerLabels`, `effRoster`,
`isSuperflex`, `effScoringType`, `draftSlot`. Dazu kommen aus den Stores
`livePicks` (`useLiveStore`), `boardPlayers` (`useBoardStore`),
`dynastyRoster` (`useDynastyStore`).

`AnalysisPage.jsx` sammelt diese Werte, ruft die Stats-Funktionen in
`useMemo` auf und gibt die fertigen Ergebnis-Objekte an die Tab-Komponenten.
Kein Tab rechnet selbst.

### Liga-Kader in allen Ligen

Zwei zusammenhängende Änderungen an derselben Stelle.

**Erstens** behält `useDynastyStore.loadDynastyRoster` die bereits geladene,
heute verworfene Rosters-Antwort in einem neuen Feld `leagueRosters`:

```js
set({ leagueRosters: rosters || [] })
```

Ohne diesen Wert gibt es keinen Liga-Median, also keinen Vergleich. Der
Request findet ohnehin statt; es geht ausschliesslich darum, das Ergebnis
nicht wegzuwerfen.

**Zweitens** wird die Ladebedingung in `App.jsx:310` gelockert. Heute lautet
sie `draftMode !== 'rookie' → nicht laden`, wodurch in einer Redraft-Liga nie
ein Kader geladen wird und der Kader-Tab dort dauerhaft leer bliebe. Neu wird
für jede echte Liga geladen (`selectedLeagueId && sleeperUserId`), unabhängig
vom Draft-Modus. Mock-Drafts haben keine `league_id` und lösen weiterhin
keinen Request aus.

Das ist der einzige zusätzliche Netzwerkzugriff dieses Designs: ein
`GET /league/{id}/rosters` pro Liga-Wechsel, derselbe Aufruf, den der
Dynasty-Pfad heute schon macht. Er verschafft dem Kader-Tab den aktuellen
Stand nach Waivers und Trades statt nur der Draft-Picks — in einer laufenden
Saison ist das der Unterschied zwischen einer Momentaufnahme vom Draft-Tag und
dem, was tatsächlich im Kader steht.

`dynastyRoster` (nur der eigene Kader) behält seine heutige Semantik und wird
weiterhin nur im Rookie-Modus für die Rookie-Ansichten benutzt — der
gelockerte Effekt füllt zusätzlich `leagueRosters`. `loadTradedPicks` bleibt
unverändert an `rookie` gebunden.

Der Store ist nicht persistiert — kein Migrationsbedarf.

## Die Kennzahlen

Alle Formeln arbeiten auf `ecr` (numerischer Experten-Rang, kleiner = besser)
und `adp` (Average Draft Position). Bei jeder Differenz gilt: *positiv = der
Spieler ging später als sein Rang, also unter Wert geholt*.

`ecr` ist für die Kacheln 1–3 das Pflichtfeld. Ein Board-Spieler ohne
numerischen `ecr` gilt dort als "ohne Ranking-Treffer" und wird genauso
behandelt wie ein Spieler, der gar nicht im Board steht — er verzerrt keine
Summe, sondern taucht in der Deckungsangabe auf.

Das eigene Team wird über `draftSlot` bestimmt, hilfsweise über `picked_by ===
sleeperUserId` — dieselbe Doppelprüfung, die `NextBoard.jsx:600` für das
Inspector-Roster nutzt. Lässt sich das eigene Team nicht bestimmen, entfallen
die Ich-bezogenen Angaben (eigener Rang, eigene nächste Pick-Nummer); die
liga-weiten Auswertungen bleiben vollständig und werden nicht auf ein
geratenes Team umgebogen.

### Tab "Draft"

**1. Team-Draft-Ranking**

Für jeden Pick `d = ecr(Spieler) − pick_no`. Pro Team die Summe über alle
Picks. Alle Teams absteigend nach Summe — das ist die Rangliste.
Zusätzlich je Team der beste und schlechteste Einzelpick.

Darunter zwei Listen über den gesamten Draft: **Top-5 Steals** (grösstes
positives `d`) und **Top-5 Reaches** (grösstes negatives `d`), jeweils mit
Spieler, Pick-Nummer und Team.

Headline-Zahl der Kachel: die eigene Summe und der eigene Rang
("+47 · Platz 3 von 12").

Picks ohne Board-Treffer (Spieler nicht im importierten Ranking) gehen
**nicht** in die Summe ein und werden separat als "n Picks ohne
Ranking-Treffer" ausgewiesen. Ein fehlender Treffer darf nicht als Wert 0
durchgehen — das würde ein Team belohnen, dessen Picks schlicht unbekannt sind.

**2. Positionsknappheit (Value over Replacement, rangbasiert)**

Replacement-Level je Position:

```
bedarf(pos) = teamsCount × starterSlots(pos, effRoster)
```

`starterSlots` zählt die dedizierten Slots der Position aus `effRoster` plus
den anteiligen FLEX-Anteil: ein `FLEX`-Slot verteilt sich zu je 1/3 auf RB, WR,
TE; ein `SUPER_FLEX` zusätzlich zu 1/4 auf QB, RB, WR, TE. Bruchteile werden
erst nach der Multiplikation mit `teamsCount` gerundet.

Der `bedarf(pos)`-te noch verfügbare Spieler der Position ist der Replacement.
Für jeden verfügbaren Spieler:

```
vor(spieler) = ecr(replacement) − ecr(spieler)
```

Die Kachel zeigt je Position: Anzahl verfügbarer Spieler oberhalb des
Replacement-Levels ("noch 4 startbare RB"), den `vor` des jeweils besten
verfügbaren Spielers, und einen Balken, der beides gegenüberstellt. Sinkt
sichtbar, während gedraftet wird.

Sind weniger Spieler verfügbar als `bedarf(pos)`, ist die Position erschöpft:
kein Replacement bestimmbar, die Kachel meldet "erschöpft" statt einer Zahl.

**3. Tier-Verbrauch**

`tier` kommt als Zeichenkette aus der CSV und wird zu einer Zahl geparst;
nicht-parsbare Werte fallen aus dieser Kachel heraus (nicht aus den anderen).

Je Position und Tier: wie viele Spieler ursprünglich darin lagen, wie viele
noch verfügbar sind. Das aktuell oberste Tier mit mindestens einem
verfügbaren Spieler ist das "aktive" Tier; die Kachel nennt die verbleibende
Anzahl darin ("RB Tier 3: noch 2") — das ist die Cliff-Warnung.

Darstellung: je Position eine Zeile aus Tier-Segmenten, verbrauchte Tiers
ausgegraut, das aktive hervorgehoben.

**4. Positional Runs**

Rollierendes Fenster über die letzten `min(teamsCount, 8, anzahlPicks)` Picks
— die dritte Grenze verhindert, dass das Fenster früh im Draft grösser ist als
der Draft selbst. Je Position
der Anteil in diesem Fenster. Ein "Run" liegt vor, wenn der Anteil einer
Position mindestens das Doppelte ihres Anteils über den gesamten bisherigen
Draft beträgt **und** absolut mindestens 3 Picks umfasst — beide Bedingungen,
damit ein Fenster mit zwei QBs am Draft-Anfang keinen Fehlalarm auslöst.

Live: Textzeile ("RB-Run: 5 der letzten 8 Picks").
Nach dem Draft: waagerechter Streifen über alle Picks, je Pick ein
positionsfarbenes Segment — die Runs werden als Farbblöcke sichtbar.

### Tab "Kader"

**5. Wert-Split nach Position vs. Liga-Median**

Die Spieler-IDs der Kader aus `leagueRosters` werden über `sleeper_id`,
hilfsweise über `nname`, gegen das Board gematcht. Danach hängt die Formel
davon ab, was das importierte Ranking hergibt:

*Führt das Board `dynasty_value`* (Dynasty-/Rookie-Rankings), ist das die
Grundlage: je Kader und Position die Summe. Über alle Kader je Position der
Median. Die Kachel zeigt den eigenen Wert je Position als Balken gegen die
Median-Linie, plus die Abweichung in Prozent.

*Fehlt `dynasty_value`* (Redraft-Rankings), wird rein rangbasiert verglichen:
je Position die `ecr`-Werte der besten `k` Spieler des Kaders, wobei `k` die
Starter-Slots dieser Position sind. Verglichen wird slot-weise gegen den
Liga-Median desselben Slots — "dein bester RB steht auf ECR 12, der
Liga-Median für den besten RB ist 34". Es wird **keine** Wertkurve über die
Ränge gelegt: eine solche Kurve wäre eine Annahme, und diese Seite soll nur
Zahlen zeigen, für die es eine Quelle gibt.

Die rangbasierte Variante hat eine bekannte Decke: Rangabstände sind nicht
wertproportional — der Sprung von RB1 auf RB2 wiegt schwerer als der von RB40
auf RB41. Sie beantwortet damit "besser oder schlechter als das Feld"
zuverlässig, "um wie viel" nur grob. Die Kachel formuliert entsprechend in
Rangabständen, nicht in Prozent.

In beiden Fällen der Median, nicht der Mittelwert: ein einzelnes Superteam
verzerrt den Mittelwert und zerstört die Aussage "stehe ich über oder unter
dem Feld".

Spieler ohne den jeweils nötigen Wert werden als Deckungsgrad ausgewiesen
("Deckung 84 %"). Liegt die Deckung unter 50 %, zeigt die Kachel statt der
Zahlen einen Hinweis, dass die Grundlage zu dünn ist.

### Tab "Markt"

**6. Zugriffs-Fenster und Streit**

Zwei zusammengehörige Auswertungen über das Board:

*Streit:* Top-10 der verfügbaren Spieler nach `stdev` absteigend — dort ist
sich der Markt am uneinsten, dort entstehen die grössten Abweichungen zwischen
Ligen.

*Zugriffs-Fenster:* für dieselben Spieler `low` – `adp` – `high` als
waagerechter Whisker, dazu die eigene nächste Pick-Nummer als senkrechte
Marke. Damit ist ablesbar, welche Spieler beim nächsten eigenen Pick
realistisch noch da sind und welche man nur am oberen Ende ihres Fensters
bekommt.

Spieler ohne `stdev` oder ohne `high`/`low` fallen aus dieser Kachel heraus;
die Kachel nennt, auf wie vielen Spielern sie beruht.

## Voraussetzungen und leere Zustände

Die Kacheln haben unterschiedliche Datenanforderungen. Jede prüft ihre eigene
Voraussetzung und blendet sich mit einer konkreten Begründung aus, statt
Nullwerte zu zeigen:

| Kachel | Braucht | Ohne das |
|---|---|---|
| Team-Draft-Ranking | Picks **und** Board | "Noch keine Picks" / "Kein Ranking importiert" |
| Positionsknappheit | Board **und** `effRoster` | "Kein Ranking importiert" |
| Tier-Verbrauch | Board mit `tier`-Spalte | "Dieses Ranking enthält keine Tiers" |
| Positional Runs | mindestens 6 Picks | "Zu früh im Draft" |
| Wert-Split | `leagueRosters` **und** Board | "Nur für echte Ligen — Mock-Drafts haben keine Kader" |
| Zugriffs-Fenster | Board mit `stdev`/`high`/`low` | "Dieses Ranking enthält keine Marktdaten" |

Ist ein ganzer Tab leer, zeigt er einen Satz mit dem Weg dorthin (Link ins
Setup zum Ranking-Import). Ein Tab wird nie ausgeblendet — sonst springt die
Reiter-Leiste je nach Datenlage, und der Nutzer sucht einen Bereich, den er
gestern noch gesehen hat.

## Layout

Reiter-Leiste (Draft | Kader | Markt) oben, darunter ein Kachel-Raster mit
`grid-template-columns: repeat(auto-fit, minmax(320px, 1fr))`. Breite Kacheln
(Team-Ranking-Tabelle, Run-Streifen) belegen `grid-column: span 2`.

`StatCard.jsx` gibt das gemeinsame Gerüst vor: Titel, optionaler
Erläuterungssatz, die Headline-Zahl gross, darunter der Inhalt, unten die
Datengrundlage in kleiner Schrift ("aus 142 Picks · 8 ohne Ranking-Treffer").
Diese Fusszeile ist Pflicht, nicht Dekoration: die Seite behauptet
Genauigkeit, also muss sie ihre Basis offenlegen.

Grafiken sind Inline-SVG, keine Bibliothek — Balken, Whisker,
Tier-Segmentleisten und der Run-Streifen sind Rechtecke auf einer Skala, wofür
eine Chart-Bibliothek keine Arbeit abnimmt. Farben kommen aus den bestehenden
`--pos-*`-Tokens, damit Positionen überall in der App gleich aussehen.

Reiter-Reihenfolge und aktiver Tab sind Zustand der Seite, nicht der URL —
`/roster` bleibt eine Route.

## Namen und Navigation

- Route bleibt `/roster` (Bookmarks, `G R`-Shortcut, `RAIL`-Eintrag bleiben
  gültig). Nur das Label ändert sich von "Roster & Analyse" zu "Analyse", in
  `NextShell.jsx` an beiden Stellen (`RAIL` und Command-Palette).
- `RosterPage.jsx` wird durch `AnalysisPage.jsx` ersetzt; die Datei entfällt.
- `RosterSection.jsx` verliert damit seinen einzigen Aufrufer. Vor dem Löschen
  wird per Aufrufer-Suche geprüft, ob `RosterSection` und `RosterList`
  tatsächlich nur von hier verwendet werden; `RosterList` wird nur gelöscht,
  wenn es keinen weiteren Aufrufer hat.

## Tests

Je Stats-Modul eine Vitest-Datei, die auf handgeschriebenen Minimal-Fixtures
arbeitet (kein Netz, keine echten Sleeper-Daten):

- `draftStats.test.js` — Team-Summe bei gemischten Treffern/Nicht-Treffern;
  Replacement-Level bei FLEX und SUPER_FLEX; erschöpfte Position;
  Run-Erkennung an der Doppelt-und-mindestens-3-Grenze (je ein Fall knapp
  darüber und darunter); Tier-Parsing bei nicht-numerischen Tier-Werten.
- `rosterStats.test.js` — Median bei gerader und ungerader Teamzahl; Verhalten
  bei einem einzelnen Kader; Deckungsgrad unter 50 %; Umschalten auf die
  rangbasierte Variante, wenn kein Board-Spieler `dynasty_value` führt.
- `marketStats.test.js` — Sortierung nach `stdev` mit fehlenden Werten;
  Whisker-Skala bei `low === high`.

Die Tab-Komponenten bekommen keine eigenen Tests: sie enthalten keine Logik.

## Verworfene Alternativen

- **Alles in `analysis.js`** — kürzester Diff, aber eine Datei über drei
  unzusammenhängende Domänen, die absehbar 600+ Zeilen erreicht.
- **Hooks statt reiner Funktionen** (`useDraftStats()`) — passt äusserlich zu
  `useDraftTips`, bringt aber keinen React-Zustand mit und macht jeden Test
  von einem Renderer abhängig.
- **Chart-Bibliothek** (Recharts o. ä.) — erste neue Laufzeit-Abhängigkeit des
  Projekts für Formen, die als SVG-Rechtecke kürzer sind als ihre
  Konfiguration.
- **Freies Kachel-Raster ohne Reiter** — vom Nutzer zugunsten der Reiter
  verworfen; die Themen-Zuordnung verschwimmt sonst.

## Bewusst zurückgestellt (Runde 2)

Bereits durchgesprochen, aus dem ersten Wurf herausgehalten, damit die sechs
Kacheln fertig werden: Draft-Grid als Value-Heatmap (färbt das bestehende
`DraftGrid` ein), Roster-Konstruktion aller Teams, Altersprofil und
Contender/Rebuild-Einordnung (`avgStarterAge`/`detectTeamProfile` liegen
fertig in `tradeValue.js`), Top-heavy-vs-Tiefe, Bye-Kollisionen,
Draft-Kapital aus `tradedPicks`, ECR-gegen-ADP-Scatter, Tier-Landkarte,
SOS-Verteilung, Datendeckungs-Kachel.
