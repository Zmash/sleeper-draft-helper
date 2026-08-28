# CSV-Board: ADP-Override & Bye-Week-Ergänzung

## Problem

Beim CSV-Import (eigenes Ranking, z. B. aus FantasyPros exportiert) trägt jede
Zeile ihre eigene ADP, berechnet aus `ecr + ecrVsAdp` (`src/services/csv.js`).
Wer lieber die Sleeper-Markt-ADP sehen will (z. B. weil das eigene Ranking nur
den Rang, nicht die ADP-Einschätzung des Marktes widerspiegeln soll), hat
dafür aktuell keine Möglichkeit — die dafür nötige Infrastruktur existiert
bereits (`overlayMarketData`, `refreshMarketData`), ist aber für CSV-Boards in
der UI absichtlich ausgeblendet
(`DataProvenanceBar.jsx:61` — "beim CSV-Board gibt es nichts zu
aktualisieren").

Bye Week wird zwar automatisch nach jedem Import ergänzt
(`enrichBoardPlayersWithSleeper`), aber aus Sleepers `players/nfl`-Endpoint,
der laut bestehendem Code-Kommentar (`playersMeta.js:7-8`) in der Praxis
keine Bye-Daten liefert. Die einzige verlässliche Bye-Quelle im Projekt sind
die Markt-ADP-Endpunkte (`/api/rankings/sleeper-adp`, `/api/rankings/ffc-adp`),
die `bye` als Teil von `MARKET_FIELDS` mitliefern.

## Ziel

Zwei zusätzliche Aktionen anbieten, an zwei unterschiedlichen Stellen:

1. **ADP übernehmen** (Board-Seite, `DataProvenanceBar`) — überschreibt ADP
   (und die übrigen Marktfelder: bye, stdev, high, low, times_drafted) mit
   Werten aus der Sleeper-ADP (Fallback FFC), wo der Markt einen Treffer hat.
   Reihenfolge/Rang/Status bleiben unangetastet (wie beim bestehenden Refresh
   für Market-Boards). Dauerhaft sichtbar, wie der bestehende
   "Aktualisieren"-Button.
2. **Bye Week ergänzen** (Setup-Seite, `ImportResultBanner`) — trägt `bye` nur
   dort nach, wo das Feld aktuell leer ist. Überschreibt nie einen
   vorhandenen Wert. **Nicht dauerhaft sichtbar**: erscheint nur direkt nach
   einem CSV-Import, und nur als Zeile im Import-Ergebnis-Banner, wenn dabei
   tatsächlich Spieler ohne Bye Week erkannt wurden — analog zur
   bestehenden "X ohne Marktdaten"-Zeile im selben Banner.

Die Δ-ADP-Spalte in `BoardTable.jsx` braucht keine Änderung: sie liest bereits
`p.adp` und `p.rk` direkt vom Board-Objekt und zieht automatisch mit, sobald
`boardPlayers` aktualisiert wird.

## Nicht-Ziele

- Team/Position/Alter/Verletzung: laufen bereits automatisch über
  `enrichBoardPlayersWithSleeper` bei jedem Import — keine Änderung.
- Keine UI zur freien Auswahl der ADP-Quelle (Sleeper vs. FFC) — folgt
  demselben impliziten Fallback wie der Rest der App (`fetchMarketAdp`).
- Kein Rookie/Dynasty-Support — Redraft-ADP passt nicht auf Rookie-Ränge,
  exakt dieselbe Einschränkung wie beim bestehenden Refresh.

## Änderungen

### 1. `src/services/marketMerge.js`

Neue reine Funktion, Geschwister von `mergeMarketFields`, aber mit
umgekehrter Präzedenz (Basis gewinnt, Markt füllt nur Lücken) und beschränkt
auf `bye`:

```js
export function fillMissingBye(boardPlayers, marketPlayers) {
  const market = marketIndex(marketPlayers)
  let filled = 0
  const players = (boardPlayers || []).map((p) => {
    if (p.bye) return p
    const nname = p?.nname || normalizePlayerName(p?.name || '')
    const hit = market.get(nname)
    if (!hit?.bye) return p
    filled += 1
    return { ...p, bye: hit.bye }
  })
  return { players, stats: { filled } }
}
```

### 2. `src/stores/useBoardStore.js`

- `refreshMarketData` bekommt ein optionales Argument
  `{ isSuperflex, effScoringType, numTeams } = {}`. Format-Berechnung:
  `format = (isSuperflex !== undefined) ? ffcFormatFor({ isSuperflex, effScoringType }) : (marketMeta?.format || 'ppr')`.
  Bestehende Aufrufe ohne Argument (Market-Boards, deren `marketMeta.format`
  bereits gesetzt ist) verhalten sich unverändert.
- Neue Action `fillMissingBye({ isSuperflex, effScoringType, numTeams } = {})`:
  identischer Ablauf wie `refreshMarketData` bis zum Fetch (`fetchMarketAdp`
  mit demselben Format-Fallback), ruft aber
  `fillMissingBye()` aus `marketMerge.js` statt `overlayMarketData` auf.
  Guard identisch zu `refreshMarketData` (kein Board → Fehler, Rookie-Modus →
  Fehler mit derselben Meldung).

### 3. `src/components/BoardSection.jsx`

- `handleRefreshMarket` reicht `{ isSuperflex: draftFormat.isSuperflex, effScoringType: draftFormat.scoringType, numTeams: draftFormat.teams }` durch (dieselben Werte, die
  bereits bei `handleAutoImport`/`handleFantasyProsImport` verwendet werden,
  siehe `BoardSection.jsx:167-169`).
- Das ist die einzige Änderung hier — `fillMissingBye` wird nicht von hier aus
  aufgerufen (siehe Punkt 5, SetupPage).

### 4. `src/components/DataProvenanceBar.jsx`

CSV-Zweig (aktuell frühes `return` ohne Buttons) bekommt:

- Einen neuen Button ("ADP übernehmen"), guarded wie beim bestehenden
  Refresh-Button (`draftMode === 'rookie'` → ausgeblendet).
- Eine optionale ADP-Quellen-Zeile, sobald `marketMeta` gesetzt ist (nach
  einem "ADP übernehmen"-Klick), analog zur bestehenden Market-Zeile
  (Quelle, Stand, Format).
- Neue Props: `onOverlayAdp`, `overlayingAdp`, `overlayError`, `marketMeta`
  (bereits vorhanden, aber im CSV-Zweig bisher ungenutzt).

### 5. `src/pages/SetupPage.jsx` + `src/components/ImportResultBanner.jsx`

- `wrappedCsvLoad` zählt nach erfolgreichem `handleCsvLoad()` die Spieler ohne
  `bye` im frisch geladenen Board und packt das Ergebnis als `missingBye`
  (Zahl) in `importDone.stats` (zusätzlich zum bestehenden, unveränderten
  Platzhalter-`statsForCount`).
- Neue Funktion `handleFillBye()`: ruft `deriveFormat(...)` (wie
  `wrappedAutoImport` es bereits tut) und dann die neue Store-Action
  `fillMissingBye({ isSuperflex, effScoringType, numTeams })` auf; setzt
  danach `importDone.stats.missingBye` auf die neu ermittelte Lückenzahl
  (i. d. R. 0). Eigener Loading-State (`fillingBye`).
- `ImportResultBanner` bekommt neue optionale Props `missingBye`,
  `onFillBye`, `fillingBye`. Zeile erscheint nur, wenn `missingBye > 0`
  (analog zur bestehenden `withoutAdp`-Zeile): "X Spieler ohne Bye Week ·
  [Jetzt ergänzen]". Für alle anderen Import-Methoden bleibt `missingBye`
  `undefined` (deren Stats-Objekte setzen das Feld nicht) — die Zeile
  erscheint dort also nie, ohne dass es einer expliziten Methodenprüfung
  bedarf.

## Datenfluss

```
CSV-Board (boardSource='csv')
  → Klick "ADP übernehmen"
    → fetchMarketAdp(ffcFormatFor(...))
    → overlayMarketData(boardPlayers, market.players)   // bestehend, unveraendert
    → set({ boardPlayers, marketMeta })                  // boardSource bleibt 'csv'
    → BoardTable liest p.adp neu → Δ-ADP-Spalte aktualisiert sich automatisch

CSV-Import im Setup (SetupPage.jsx)
  → handleCsvLoad() erfolgreich → missingBye = boardPlayers.filter(p => !p.bye).length
  → ImportResultBanner zeigt "X ohne Bye Week" NUR wenn missingBye > 0
  → Klick "Jetzt ergänzen"
    → fetchMarketAdp(ffcFormatFor(...))
    → fillMissingBye(boardPlayers, market.players)        // neu, Store-Action
    → set({ boardPlayers })                               // marketMeta unveraendert
    → Banner-Zeile verschwindet (missingBye neu berechnet, i.d.R. 0)
```

## Tests

- `marketMerge.test.js` (falls vorhanden, sonst neu): `fillMissingBye` — füllt
  leere Bye, lässt vorhandene Bye unangetastet, ignoriert Markt-Treffer ohne
  Bye.
- `useBoardStore.test.js`: neue `describe`-Blöcke für `fillMissingBye`-Action
  (Guard: kein Board, Guard: Rookie-Modus, Happy Path) und für
  `refreshMarketData` mit übergebenen Format-Parametern (regressions-check,
  dass bestehende Aufrufe ohne Parameter weiter `marketMeta.format` nutzen).
- `ImportResultBanner.test.jsx`: Zeile erscheint nur bei `missingBye > 0`,
  bleibt weg bei `missingBye === 0` oder `undefined` (bestehende Methoden).
- `SetupPage.test.jsx`: `wrappedCsvLoad` ermittelt `missingBye` korrekt aus
  den geladenen `boardPlayers`.

## Offene Risiken

- Sleeper-ADP/FFC-ADP haben Kicker/Defense evtl. nicht vollständig — Bye bleibt
  dort dann leer, das ist erwartetes Verhalten (kein Fehler).
- Namens-Mismatch (CSV-Name ≠ Sleeper-Name) führt wie überall im Board zu
  keinem Treffer — bestehendes, bekanntes Verhalten von `normalizePlayerName`,
  hier nicht neu adressiert.
