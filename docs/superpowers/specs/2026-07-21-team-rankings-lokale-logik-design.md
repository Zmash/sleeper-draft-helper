# Team Rankings: neue lokale Bewertungslogik

**Datum:** 2026-07-21
**Status:** Entwurf (von Dario freigegebene Richtung: neues Metrik-Set)

## Problem

Die lokale Team-Rankings-Tabelle in der Draft Review (`computeTeamScores` in
`src/services/analysis.js`, gerendert in `src/components/DraftAnalysis.jsx`)
liefert Werte, mit denen man nichts anfangen kann:

- **Positional** ist nach einem vollen Draft immer 100 (zählt nur, ob 1 QB /
  2 RB / 2 WR / 1 TE irgendwann gedraftet wurden; FLEX/Superflex ignoriert).
- **Balance** misst ausschließlich, ob RB- und WR-Anzahl 50/50 sind.
- **Diversity** (unique Positionen der ersten 8 Picks / 4) landet fast immer
  bei 75 oder 100.
- **Value** min-max-skaliert über die Liga → ein Team hat erzwungen 0, eines
  erzwungen 100; nicht absolut interpretierbar.
- **Bye** zählt Bye-Stau im Gesamtkader — Bench/K wiegt gleich wie Starter.

## Ziel

Fünf Metriken + Total, alle **lokal** berechenbar (Board-Daten: `rk`, `adp`,
`ecrVsAdp`, `pos`, `bye`; Roster-Settings inkl. FLEX/SUPER_FLEX aus
`effRoster`; Picks). Werte sollen differenzieren und eine klare Bedeutung
haben. Keine neuen Dependencies, keine API-Aufrufe.

## Design

### Gemeinsame Basis: Rank→Wert-Kurve

Spielerwert aus dem Overall-Rank: `v(rk) = 100 * exp(-(rk - 1) / 45)`
(rk 1 → 100, rk 30 → ~52, rk 100 → ~11). Ungerankte/ungematcht gepickte
Spieler erhalten einen Floor-Wert (2). Die Konstante 45 ist ein Tuning-Knopf.

Für die Positionszählung wird bei ungematchten Picks auf
`pick.metadata.position` zurückgegriffen, damit K/DST/unbekannte Spieler
Balance und Lineup-Füllung nicht verfälschen.

### Starting-Lineup (Grundlage für Starter, Depth, Bye)

Aus `rosterPositions` werden die Starterplätze gebaut: dedizierte QB/RB/WR/TE-
Slots, dann FLEX (RB/WR/TE) und SUPER_FLEX (QB/RB/WR/TE). K/DEF/BN/IDP werden
ignoriert. Greedy-Füllung: dedizierte Slots zuerst mit den bestgerankten
Spielern der Position, danach FLEX/SF aus dem Rest.

### Die 5 Metriken

1. **Value** — Draft-Wert vs. Markt. Pro Pick wie bisher gekapptes Delta
   (85 % ECR, 15 % ADP, Cap ±20, späte Runden und K/DST abgeschwächt). Neu:
   Score = `clamp(50 + VALUE_SCALE * (gewichtete Delta-Summe / gezählte
   Picks), 0, 100)` mit `VALUE_SCALE = 4`. **50 = nach Marktwert gedraftet**,
   darüber Steals, darunter Reaches. Kein erzwungenes 0/100 mehr.

2. **Starter** (ersetzt Positional) — Stärke des Starting-Lineups. Summe der
   `v(rk)` aller Lineup-Spieler; Score = `round(100 * teamSum / maxTeamSum)`
   über die Liga. **100 = bestes Starting-Lineup der Liga**, andere Teams in
   Prozent davon.

3. **Depth** (ersetzt Diversity) — Bench-Substanz. Wert der besten 5
   Nicht-Starter (nur QB/RB/WR/TE) mit derselben Kurve; Score relativ zum
   Liga-Maximum wie bei Starter.

4. **Balance** — Kaderbau vs. Bedarf. Start bei 100, Strafen:
   - je unbesetztem Starterplatz −15, aber nur soweit die Anzahl eigener
     Picks den Platz hätte füllen können (`min(starterSlots, teamPicks)`),
     damit laufende Drafts nicht pauschal bestraft werden;
   - fehlendes RB- bzw. WR-Backup (Anzahl < Starterbedarf + 1): je −10;
   - fehlender QB-Backup in Superflex-Ligen: −10;
   - Hortung: jeder QB über Bedarf + 1 in 1QB-Ligen −8, jeder TE über
     Bedarf + 1 −5.
   Clamp auf 0..100. Backup-/Hortungs-Strafen greifen erst, wenn das Team
   genug Picks hat, um Starter + das jeweilige Backup zu besitzen.

5. **Bye** — Bye-Stau **nur innerhalb der Starter**. Je Bye-Woche mit ≥ 2
   Startern: Strafe `(Anzahl − 1) * 10`. Score = `clamp(100 − Summe, 0, 100)`.
   K/DST und Bench sind egal.

### Total

`0.35 * Starter + 0.30 * Value + 0.15 * Depth + 0.10 * Balance + 0.10 * Bye`,
gerundet. Sortierung absteigend, Rank 1..N wie bisher.

## Schnittstellen / betroffene Dateien

- `src/services/analysis.js`: `computeTeamScores` neu; Rückgabeform bleibt
  `{ rank, key, total, value, starter, depth, balance, bye }`
  (Felder `positional`/`diversity` entfallen). `isDraftComplete` unverändert.
- `src/components/DraftAnalysis.jsx`: Tabellen-Spalten
  Rank / Team / Total / Value / Starter / Depth / Balance / Bye.
- `src/App.jsx`: Aufruf unverändert (`boardPlayers`, `livePicks`,
  `teamsCount`, `rosterPositions`); der Legacy-Fallback-Aufruf mit
  Positionsargumenten (`App.jsx:192`) entfällt.
- Weitere Konsumenten von `scores` werden vor der Umsetzung per grep
  verifiziert und ggf. auf die neuen Feldnamen umgestellt.

## Fehlerbehandlung

- Leere `boardPlayers` (kein Ranking importiert): Starter/Depth/Value fallen
  auf neutrale 50 zurück statt 0/NaN; Balance/Bye rechnen über
  `metadata.position`/`metadata.bye`, soweit vorhanden.
- `rosterPositions` leer: Default-Lineup 1 QB / 2 RB / 2 WR / 1 TE / 1 FLEX.
- Kein `null`-Coercing: `x == null`-Guards wie im Repo üblich
  (`Number(null) === 0`-Falle).

## Tests

Neues `src/services/analysis.test.js` (Vitest):

- Voller 2-Team-Minidraft: Team mit besseren Ranks bekommt höheren
  Starter-Score; Positional-Immer-100-Regression (Scores differenzieren).
- Value: Draft exakt nach ADP/ECR → Score ≈ 50; klarer Steal-Draft > 50.
- Balance: fehlender QB-Backup in Superflex bestraft, in 1QB-Liga nicht.
- Bye: 3 Starter mit gleicher Bye-Woche < Team ohne Überschneidung.
- Laufender Draft (3 Picks): keine Unbesetzt-Strafen über die Pickzahl hinaus.
- Leeres Board: keine NaN, neutrale Werte.

## Nicht-Ziele

- Keine Projections/Points-Berechnung (keine Datenquelle lokal).
- AI-Review (Halluzinationen, Team-IDs im Mock) ist ein separates Folgethema.
