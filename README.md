# Sleeper Draft Helper

Ein Draft-Helper für **NFL Fantasy Sleeper Drafts**. Verfolge deinen Draft live, importiere eigene Rankings, behalte dein Roster im Blick und lass dir per KI den nächsten Pick empfehlen – im Browser oder als Android-App.

> **Inoffizielles Community-Tool.** Steht in keiner Verbindung zu Sleeper, FantasyPros, FantasyCalc oder KeepTradeCut und nutzt lediglich deren öffentliche APIs bzw. öffentlich zugängliche Daten.

---

## Funktionen

- **Live-Draft-Tracking** – ruft Picks laufend über die Sleeper API ab (konfigurierbares Auto-Refresh-Intervall).
- **Ranking-Import** – CSV (z. B. FantasyPros) sowie direkter Import von **FantasyCalc** und **KeepTradeCut** (Dynasty & Rookies).
- **Board** – Spielerliste mit Suche, Positions-/Team-Filtern, Tiers und Draft-Status.
- **Roster-Ansicht** – dein aktuelles Team jederzeit im Überblick.
- **Dashboard** – Übersicht über deine Ligen und Drafts.
- **Draft-Tipps** – kontextbasierte Empfehlungen, getrennt für **Redraft** und **Rookie/Dynasty**.
- **KI-Draft-Advice** – Empfehlung für den nächsten Pick inkl. Begründung und Alternativen (Live-Streaming).
- **KI-Draft-Review** – Post-Draft-Analyse mit Team-Rankings und Bewertungen.
- **KI-Trade-Analyse** – Bewertung und Vorschläge für Trades.
- **Setup-Overrides** – Scoring, Roster-Positionen, Superflex und Strategien manuell übersteuern.
- **Dark/Light-Theme** und **Android-App** via Capacitor.

## Tech-Stack

| Bereich   | Technologie |
|-----------|-------------|
| Frontend  | React 18, Vite, React Router, Zustand |
| Backend   | Express 5 (KI-Proxy), Server-Sent Events (SSE) |
| KI        | Anthropic SDK (`@anthropic-ai/sdk`), Modell `claude-sonnet-4-6` |
| Daten     | Sleeper API (öffentlich), FantasyCalc, KeepTradeCut |
| Mobile    | Capacitor (Android) |

## Architektur

Die App besteht aus zwei unabhängig lauffähigen Teilen:

1. **React-SPA** (`src/`) – spricht für alle Draft-, Liga- und Pick-Daten **direkt** die öffentliche Sleeper API an. Für das reine Draft-Tracking wird kein eigenes Backend benötigt.
2. **Express-KI-Proxy** (`src/server/`) – kapselt die KI-Aufrufe und das Scraping der Ranking-Quellen serverseitig. Das Frontend ruft ihn unter `/api/*` auf; im Dev-Betrieb proxyt Vite `/api` → `127.0.0.1:5175`.

Der Anthropic-API-Key wird **ausschließlich lokal im Browser** gespeichert (`localStorage`) und pro Anfrage über den Header `X-Anthropic-Key` an den Proxy übergeben – er wird **nie serverseitig persistiert**.

> **Hinweis für Entwicklung:** `src/server/index.js` (Dev, Port `5175`) und `src/server/prod.js` (Prod, Port `8080`, liefert zusätzlich das statische Build aus) definieren dieselben Endpunkte. Änderungen an KI-Endpunkten müssen in **beiden** Dateien erfolgen.

## Voraussetzungen

- **Node.js** ≥ 18
- Ein **Sleeper-Benutzername** (für Live-Daten)
- Ein **Anthropic-API-Key** – nur nötig für die KI-Funktionen (Advice, Review, Trade)

## Installation & Entwicklung

```bash
git clone https://github.com/Zmash/sleeper-draft-helper.git
cd sleeper-draft-helper
npm install
```

Client und KI-Proxy zusammen starten (empfohlen, damit KI- und Import-Funktionen verfügbar sind):

```bash
npm run dev:all      # Client (5173) + API (5175)
```

Einzeln:

```bash
npm run dev          # nur Vite-Client   → http://localhost:5173
npm run dev:api      # nur Express-Proxy → http://localhost:5175
```

## Nutzung

1. **Account** – Sleeper-Benutzername im Setup eingeben und Liga & Draft auswählen.
2. **Ranking importieren** – CSV hochladen/einfügen oder FantasyCalc / KeepTradeCut importieren.
3. **Draft verfolgen** – Auto-Fetch aktivieren; Picks werden live auf dem Board markiert.
4. **KI nutzen** – im **Board-Tab** auf **„🤖 AI Advice“** klicken. Beim ersten Mal wird der Anthropic-API-Key hinterlegt (nur lokal). Nach dem Draft steht die **Draft-Analyse/Review** bereit.

> Etwaige Kosten für KI-Anfragen fallen über dein **eigenes** Anthropic-Konto an.

## Konfiguration (Umgebungsvariablen)

Serverseitig (Express-Proxy):

| Variable      | Standard                       | Beschreibung |
|---------------|--------------------------------|--------------|
| `SDH_MODEL`   | `claude-sonnet-4-6`            | Überschreibt das verwendete Claude-Modell. |
| `CORS_ORIGIN` | `http://localhost:5173`        | Erlaubter Origin für den Dev-Proxy. |
| `PORT`        | `5175` (dev) / `8080` (prod)   | Port des Express-Servers. |

## Produktion

```bash
npm run build                    # erzeugt das statische Build in dist/
PORT=8080 node src/server/prod.js  # liefert dist/ aus und stellt /api bereit
```

`prod.js` bedient sowohl die statischen Assets als auch die `/api/*`-Endpunkte auf demselben Port.

## Android (Capacitor)

```bash
npm run build
npm run cap:copy          # Web-Build in das Android-Projekt kopieren
npm run cap:open:android  # Android Studio öffnen
```

App-ID: `eu.zmash.sleeperdrafthelper`, `webDir`: `dist`. Der Ordner `android/` ist ein generiertes Capacitor-Projekt.

## Projektstruktur (Auszug)

```
src/
├── components/   UI-Komponenten (Board, Roster, Dialoge, …)
├── pages/        Routen-Seiten (Dashboard, Setup, Board, Roster, Trade)
├── stores/       Zustand-Stores (Session, Board, Live, UI, Dynasty, Trade)
├── services/     Sleeper-API, KI-Payloads, Rankings, Analyse, Storage
├── hooks/        Draft-Tipp-Hooks
└── server/       Express-KI-Proxy (index.js = dev, prod.js = prod)
```

## Support

Fragen oder Bugs? Bitte ein [Issue](https://github.com/Zmash/sleeper-draft-helper/issues) öffnen.

## Lizenz

MIT – siehe [LICENSE.md](LICENSE.md).

## Haftungsausschluss

Dieses Projekt steht in **keiner Verbindung** zu Sleeper, FantasyPros, FantasyCalc oder KeepTradeCut. Es ist ein **inoffizielles, von der Community erstelltes Tool**, das deren öffentliche APIs bzw. öffentlich zugängliche Daten nutzt. Alle Markennamen, Logos und Produktbezeichnungen sind Eigentum ihrer jeweiligen Inhaber.

---

Entwickelt mit ❤️ für Fantasy-Football-Fans.
