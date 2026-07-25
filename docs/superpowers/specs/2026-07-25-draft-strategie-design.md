# Draft-Strategie: Bibliothek + AI-Recherche

**Datum:** 2026-07-25
**Status:** Entwurf, abgestimmt
**Umfang:** Teil A (Strategie-Bibliothek mit Format-Matching) + Teil B (AI-gestützte Erzeugung mit Web-Recherche)

## Ziel

Heute gibt es genau **einen** globalen Strategie-Freitext (`sdh.strategy.v1`, max. 4000 Zeichen), gesetzt im
`ApiKeyDialog` und als `context.custom_strategy` an die AI weitergereicht. Er kennt weder Liga noch Format
noch Saison.

Dieses Feature ersetzt ihn durch:

1. **Eine Bibliothek** mehrerer Strategien, jede an ein Format gebunden, mit automatischer Vorauswahl.
2. **Einen Generator**, der eine Strategie aus Liga-Format, Saison, Draft-Slot und aktuellen
   Experten-Quellen erzeugt — recherchiert über Claudes serverseitiges `web_search`-Tool.

Getrennt davon: ein globales Feld **„Meine Grundsätze"** für persönliche, formatunabhängige Regeln
(z. B. „Defense wird gestreamt, letzter Pick oder gar nicht"). Die AI liest es, überschreibt es nie.

## Getroffene Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Recherche-Provider | Claude `web_search`, kein Perplexity | Serverseitig bei Anthropic, ein Key, keine zweite Integration. Die Recherche muss ohnehin durch Claude, weil nur Claude Format, Roster und Board kennt. |
| Recherche-Steuerung | Fester Query-Plan statt agentischer Freisuche | Die Fragen sind jedes Jahr dieselben, nur das Format wechselt. Vier gezielte Suchen statt fünfzehn tastende. |
| Quellenauswahl | Feste Whitelist, getrennt nach `draftMode` | Fantasy-Content ist voller SEO-Spam. Belegt durch Probelauf (siehe „Recherche-Probelauf"). |
| Matching-Strenge | Harte Felder filtern, weiche Felder wählen aus, Abweichung wird angezeigt | Kein Scoring-Modell. Abweichungen sind sichtbar statt geraten. |
| UI-Ort | `SetupForm`, unter dem Format-Bereich | Dort wird das Format eingestellt — der Fingerprint entsteht genau da. `eff` enthält das Tupel bereits. |
| Grundsätze | Eigenes Feld, getrennt von der Strategie | Persönliche Regeln überleben jedes Neu-Generieren. |
| Umfang der Strategie | Leitlinie + 4–6 Regeln + Quellen | Quellenliste macht prüfbar, worauf die Strategie fußt. |

## Recherche-Probelauf (2026-07-25)

Vorab getestet mit dem Format 12 Teams / Half-PPR / 1QB / Redraft / Saison 2026:

- **Reddit ist für den Anthropic-Crawler gesperrt** (HTTP 400). Subreddits scheiden als Quelle aus.
- **Slot-spezifischer Content existiert** — FantasyPros veröffentlicht pickgenaue Artikel (z. B. „How to
  Approach Pick 1.07"). Der Draft-Slot gehört fest in den Query-Plan.
- **Vier Suchen reichen.** Jede lieferte Substanz. `max_uses: 6` ist großzügig, nicht knapp.
- **Quellen widersprechen sich.** 4for4 nennt WR-Tiefe einen Trugschluss (nur 26 WR mit 10+ Half-PPR-Punkten
  pro Spiel in 2025), die Positionsanalysen lesen dieselbe Saison umgekehrt. Beide seriös. Der Prompt muss
  Konflikte **benennen lassen statt glätten**.
- Verworfen: ESPN/CBS/Yahoo/NFL.com (generisches Anfängerwissen, SEO-Duplikate), Establish The Run und
  Sharp Football (Inhalt hinter Paywall), The Fantasy Footballers (Podcast, nicht extrahierbar),
  KeepTradeCut für Redraft (nur Rankings, werden ohnehin über `/api/rankings/ktc-*` gezogen).

## Datenmodell

Neuer localStorage-Key `sdh.strategies.v1`:

```js
{
  version: 1,
  principles: '',          // global, formatunabhängig, nur vom Nutzer gepflegt
  items: [
    {
      id: 'str_...',       // crypto.randomUUID()
      label: '12er Half-PPR 2026',
      fingerprint: {       // null = "passt überall, nie bevorzugt"
        draftMode: 'redraft',
        scoringType: 'half_ppr',
        superflex: false,
        season: '2026',
        teams: 12,
        starters: ['QB','RB','RB','WR','WR','TE','FLEX'],  // sortiert, ohne BN
      },
      summary: 'Ein Satz Leitlinie.',
      rules: ['…', '…'],                    // 4–6 Einträge
      sources: [{ title, url }],            // nur Anzeige, nicht im Prompt
      contested: ['…'],                     // strittige Punkte zwischen Quellen, optional
      source: 'ai' | 'manual',
      createdAt: '2026-07-25T…',
    },
  ],
}
```

**Migration** (idempotent, läuft in `src/stores/migrate.js` mit): Existiert `sdh.strategies.v1` bereits,
passiert nichts. Sonst wird `sdh.strategy.v1` — falls vorhanden und nicht leer — als einzelnes Item mit
`fingerprint: null`, `source: 'manual'` und dem Text in `summary` übernommen. Der alte Key bleibt vorerst
liegen (keine Löschung, damit ein Rollback möglich bleibt).

`src/utils/settingsTransfer.js` braucht einen eigenen Eintrag. Ursprünglich stand hier die Annahme, der
vorhandene Prefix `sdh.strategy` erfasse `sdh.strategies.v1` automatisch mit — das ist **falsch**: der
Matcher baut die Regex `^sdh\.strategy\.v(\d+)$`, an der der neue Key vorbeiläuft. Ohne eigenen Eintrag
exportiert die App den toten Legacy-Key und lässt die Bibliothek fallen. `sdh.strategies` gehört in
`VERSIONED_PREFIXES` (im Branch-Review gefunden, in `7506c16` behoben).

## Matching — `src/services/strategyMatch.js`

Reine Funktionen ohne React-Abhängigkeit.

```js
makeFingerprint({ format, season, draftMode }) → fingerprint
```

`format` ist das Ergebnis von `deriveFormat()` bzw. das `eff`-Objekt aus `SetupForm`. `starters` entsteht
aus `rosterPositions` durch Entfernen aller `BN`-Einträge und Sortieren. Rundenzahl und Draft-Typ
(snake/auction) gehen **nicht** in den Fingerprint — sie ändern die Strategie kaum, würden aber laufend
falsche Nicht-Treffer erzeugen.

Normalisierung ist Pflicht, sonst scheitert der harte Filter still: `season` wird immer über `String()`
geführt (die Session liefert sie je nach Herkunft als Zahl oder String), `teams` immer über `Number()`,
`superflex` über `!!`. Der Vergleich läuft danach strikt.

```js
pickStrategy(items, fingerprint) → { item, deviations } | null
```

1. **Harter Filter:** `draftMode`, `scoringType`, `superflex`, `season` müssen exakt übereinstimmen.
   Items mit `fingerprint: null` überstehen den Filter immer.
2. **Weiche Auswahl:** Unter den Verbliebenen gewinnt das Item mit den wenigsten Abweichungen bei `teams`
   und `starters`. Gleichstand → das jüngste (`createdAt`).
3. **Wildcards zuletzt:** Ein Item mit `fingerprint: null` gewinnt nur, wenn kein anderes den harten Filter
   übersteht.
4. `deviations` ist ein Array lesbarer Strings, z. B. `'aus 12er-Liga, du draftest in einer 10er'`. Leer bei
   exaktem Treffer.

```js
resolveStrategyText(store, fingerprint) → string
```

Fügt `principles` und die gewählte Strategie (`summary` + `rules` als Aufzählung) zusammen und kappt bei
4000 Zeichen — dieselbe Grenze wie heute. `sources` und `contested` bleiben draußen; sie sind für die
Anzeige, nicht für den Prompt.

## Server — `POST /api/ai-draft-strategy`

Neu in `src/server/apiRoutes.js`, SSE mit `event: text | result | error` wie die bestehenden AI-Routen.
Modell: Projekt-Default `claude-sonnet-5` (`SDH_MODEL` überschreibt) — unterstützt Websuche mit
dynamischer Filterung.

**Eingabe (JSON):**

```js
{ format: { teams, scoringType, superflex, rosterPositions },
  season, draftMode, draftSlot: number|null, principles: string }
```

**Tools:**

```js
{
  type: 'web_search_20260318',
  name: 'web_search',
  max_uses: 6,
  allowed_domains: SOURCES[draftMode],
  response_inclusion: 'excluded',   // Rohtreffer nicht in die Antwort spiegeln
}
```

```js
const SOURCES = {
  redraft: ['fantasypros.com', '4for4.com', 'footballguys.com', 'rotoballer.com'],
  rookie:  ['dynastyleaguefootball.com', 'footballguys.com', 'fantasypros.com', 'keeptradecut.com'],
}
```

Dazu `STRATEGY_TOOL` mit erzwungenem `tool_choice`, nach dem Muster des bestehenden `REVIEW_TOOL`:

```js
{
  name: 'draft_strategy',
  input_schema: {
    type: 'object',
    properties: {
      summary:   { type: 'string' },                       // ein Satz Leitlinie
      rules:     { type: 'array', items: { type: 'string' }, minItems: 4, maxItems: 6 },
      sources:   { type: 'array', items: { type: 'object', properties: { title, url } } },
      contested: { type: 'array', items: { type: 'string' } },  // strittige Punkte, darf leer sein
    },
    required: ['summary', 'rules', 'sources'],
  },
}
```

**System-Prompt** enthält den Query-Plan mit eingesetztem Format — die AI erfindet keine Suchbegriffe:

1. Draft-Strategie für `{teams}` Teams, `{scoringType}`, `{superflex ? 'Superflex' : '1QB'}`, Saison `{season}`
2. Positions-Tiefe und Knappheit in `{season}`
3. Vorgehen an Draft-Slot `{draftSlot}` (entfällt, wenn kein Slot bekannt)
4. Tragfähigkeit der gängigen Strategien (Zero RB, Hero RB, Robust RB) in `{season}`

Weitere Prompt-Vorgaben: alle Freitexte auf Deutsch in Du-Form (Projektkonvention); `principles` sind
gesetzt und dürfen nicht umgeschrieben werden; widersprechen sich Quellen, gehört der Konflikt nach
`contested` statt zu einer Seite aufgelöst zu werden; jede Regel nennt einen Rundenbezug.

**`pause_turn`-Fortsetzung:** Server-Tools können die Antwort mit `stop_reason: 'pause_turn'` unterbrechen.
Die Route schickt die Assistant-Nachricht dann unverändert zurück, um fortzusetzen — maximal dreimal, danach
`event: error`. Dafür gibt es im Projekt bislang kein Vorbild; es ist der einzige echt neue Server-Baustein.

## Client

**`src/services/aiStrategyClient.js`** — analog zu `aiDraftReviewClient.js`: Key aus `getOpenAIKey()`,
`X-Anthropic-Key`-Header, SSE lesen, `result` als Objekt zurückgeben.

**`SetupForm.jsx`**, neuer Abschnitt direkt unter dem Format-Bereich:

- Textfeld **Meine Grundsätze** (global, sofort persistiert).
- Aktive Strategie: Label, Format-Badge, bei `deviations.length > 0` ein sichtbarer Hinweis.
- `summary` und `rules` als Text, `contested` als abgesetzter Hinweisblock, `sources` als Linkliste.
- Aktionen: **Neu erzeugen (AI)** · **Bearbeiten** · **Neue anlegen**.
- Während der Generierung Statuszeile aus dem SSE-`text`-Stream.

Zitierhinweis: Die Anthropic-Doku verlangt, dass bei Anzeige von Suchergebnissen an Endnutzer die Quellen
mit ausgegeben werden. Die Linkliste erfüllt das — sie ist nicht optional.

**Board:** Deeplink nach `/setup` (`navigate`), wie beim bestehenden Setup-Sprung.

## Anbindung an die bestehenden Prompts

`BoardSection.jsx:242` und `:335` lesen heute direkt `localStorage.getItem('sdh.strategy.v1')`. Beide
Stellen rufen künftig `resolveStrategyText()` auf.

**`src/services/ai.js` und `src/services/adviceRequestArgs.js` bleiben unverändert.** Es fließt weiterhin
ein Textblock als `customStrategyText` → `context.custom_strategy` in den Prompt; nur die Quelle ist eine
andere. Die bestehenden Tests in `adviceRequestArgs.test.js` bleiben gültig.

Im `ApiKeyDialog.jsx` entfallen das Strategie-Textfeld, `STRATEGY_KEY` und `MAX_STRATEGY`; an ihre Stelle
tritt ein Verweis auf Setup. Damit gibt es wieder genau einen Ort, der Strategie schreibt.

## Tests

`src/services/strategyMatch.test.js` (Vitest, bestehendes Setup):

- Harter Filter greift: Dynasty-Item wird in Redraft nie gewählt; abweichende `scoringType`, `superflex`
  oder `season` schließen aus.
- Weiche Auswahl: Bei zwei Kandidaten gewinnt der mit weniger Abweichungen; `deviations` benennt sie.
- Wildcard (`fingerprint: null`) gewinnt nur ohne echten Treffer.
- `makeFingerprint` entfernt `BN` und sortiert stabil.
- `resolveStrategyText` enthält die Grundsätze, kappt bei 4000 Zeichen, lässt `sources` weg.
- Migration ist idempotent und übernimmt einen vorhandenen `sdh.strategy.v1`.

## Risiken und offene Punkte

- **Paywalls.** 4for4 und Footballguys sind teils kostenpflichtig. Im Probelauf lieferte die Suche
  trotzdem Inhalt, vermutlich über frei zugängliche Auszüge. Ob das in der Tiefe trägt, zeigt der erste
  echte Lauf.
- **Dynasty-Whitelist ist schwächer belegt.** Vier Queries für Redraft, eine für Dynasty. DLF ist klar
  belegt, die drei Begleiter sind begründete Annahme. Redraft ist der Hauptfall.
- **`pause_turn`** ist neu im Projekt und der wahrscheinlichste Ort für Überraschungen.
- **Websuche muss in der Anthropic-Console für die Organisation freigeschaltet sein**, sonst antwortet die
  API mit 400 statt mit einem Fehler im Suchergebnis.
- **Kosten:** 10 $ pro 1000 Suchen, also rund 5 Cent pro erzeugter Strategie zuzüglich Tokens. Fällt einmal
  je Liga und Saison an.

## Bewusst nicht enthalten

- **Teil C** — bestehende Strategie ans laufende Board anpassen („Recreate"). Setzt diese Basis voraus.
- Perplexity oder ein zweiter Provider.
- Score-basiertes Matching.
- Auffangnetz-Suche ohne Domain-Beschränkung, wenn die Whitelist zu wenig hergibt.
- Anthropic Skills-API (Container plus zwei Beta-Header — für einen System-Prompt-Block unnötig).
- Aktuelle Spieler-News in den laufenden Draft-Tipps.
