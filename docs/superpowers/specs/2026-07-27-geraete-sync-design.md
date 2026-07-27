# Geräte-Sync — Design

**Datum:** 2026-07-27
**Status:** abgestimmt, noch nicht umgesetzt

## Problem

Die App hält allen Zustand im localStorage. Wer — wie der Betreiber selbst — am PC
vorbereitet und mobil draftet, muss heute nach jeder Änderung von Hand exportieren
und auf dem anderen Gerät importieren. Das ist der Schmerz.

Der Grund, warum bisher kein Online-Speicher existiert, ist bewusst gesetzt: Wenn
Mitspieler dieselbe App benutzen, soll der Betreiber deren Rankings und Strategien
**nicht lesen können**. Nicht "nicht dürfen" — nicht können.

## Ziel

Beide Geräte halten sich ohne manuelles Zutun aktuell, in beide Richtungen, und der
Server kann den Inhalt nicht deuten.

### Nicht-Ziele

- Konten, Login, Nutzerverwaltung
- Feldweises Zusammenführen paralleler Änderungen
- Verlässlicher Parallelbetrieb auf zwei offenen Geräten. Der 30-Sekunden-Takt
  gleicht zwar auch dann ab, aber wer gleichzeitig an beiden arbeitet, verliert
  eine Seite (siehe Konfliktregel). Darauf ist nicht ausgelegt.
- Historie, Versionierung, Wiederherstellung alter Stände

## Entscheidung: verschlüsselter Briefkasten

Der Browser verschlüsselt, bevor er hochlädt. Der Schlüssel erreicht den Server nie.
Beim Betreiber liegen Bytes ohne Bedeutung.

Verworfen wurden:

- **WebRTC im lokalen Netz.** Löst ein Problem, das nach der Verschlüsselung nicht
  mehr besteht, braucht trotzdem einen Vermittler auf dem Server, verlangt beide
  Geräte gleichzeitig offen — und bricht damit genau die Anforderung "unmanuell".
- **Fremd-Cloud (Drive/Dropbox/Gist).** Der Betreiber speichert nichts, dafür
  braucht jeder Mitspieler OAuth und ein Konto bei einem Dritten, um eine
  Draft-Hilfe zu benutzen. Die Komplexität wandert zum Nutzer.

## Kopplung

Gerät A würfelt 32 Byte (`crypto.getRandomValues`) und zeigt einen QR-Code, der
**einen Link auf die App enthält, mit dem Schlüssel im Fragment**:

```
https://<host>/setup#sync=<base64url(32 Byte)>
```

Das Handy scannt mit seiner gewöhnlichen Kamera-App — die App braucht **keinen
eigenen Scanner**. Der Teil hinter `#` wird von keinem Browser an den Server
gesendet. Zusätzlich wird der Schlüssel als Text angezeigt, damit die Kopplung auch
ohne Kamera möglich ist (PC hat oft keine).

Ein Modul liest `location.hash` beim Start — vor dem Render, analog zu
`migrate.js` —, speichert den Schlüssel und räumt den Hash weg. Dadurch braucht es
**keine neue Route**; der Link kann auf jede bestehende Seite zeigen.

Gespeichert wird unter `sdh.sync.v1`:

```
{ secret: string, lastSeenStamp: string|null, lastSentBundle: string|null }
```

## Schlüsselableitung

Aus dem einen Geheimnis werden zwei Werte abgeleitet, per SHA-256 über die
Konkatenation von Geheimnis und einem ASCII-Label:

| Wert | Ableitung | Wer kennt ihn |
|------|-----------|---------------|
| Raum-ID | `hex(SHA-256(secret ‖ "sdh-sync-room")).slice(0, 32)` | Server und Geräte |
| AES-Schlüssel | `SHA-256(secret ‖ "sdh-sync-enc")` → 32 Byte, `importKey('raw', …, 'AES-GCM')` | nur die Geräte |

Aus der Raum-ID lässt sich das Geheimnis nicht zurückrechnen, also auch der
AES-Schlüssel nicht.

**Warum SHA-256 statt HKDF oder PBKDF2:** Der Input ist bereits 32 Byte
Vollentropie aus dem CSPRNG, kein vom Menschen gewähltes Passwort. Key-Stretching
schützt gegen Raten und hat hier nichts zu tun; gebraucht wird ausschließlich
Domänentrennung, und dafür genügt ein Hash mit unterschiedlichem Label. Ein
Verfahren mehr wäre Zeremonie ohne Wirkung.

Verschlüsselt wird mit AES-GCM und einem frischen 12-Byte-IV je Vorgang. Alles über
WebCrypto, kein zusätzliches Paket. WebCrypto verlangt einen Secure Context — Prod
läuft hinter HTTPS, `localhost` und die Capacitor-App gelten ebenfalls als sicher.

## Bündel

Aufgenommen wird **jeder localStorage-Key, der mit `sdh` beginnt**, plus
`draft-helper-theme`; ausgenommen ist nur `sdh.sync.v1` selbst.

Eine gepflegte Whitelist wurde verworfen: genau daran krankt der heutige
Datei-Export. `VERSIONED_PREFIXES` in `src/utils/settingsTransfer.js` erfasst nur
die Punkt-Keys, weshalb die Zustand-Stores (`sdh-board-v1`, `sdh-session-v1`) mit
Bindestrich seit jeher durchs Raster fallen — die Rankings sind im Datei-Export
nicht enthalten. Die Präfixregel kann keinen künftigen Store vergessen.

Bewusst mit im Bündel, vom Nutzer bestätigt: der Anthropic-Key und die
Sleeper-Session. Beides ist verschlüsselt und geht ausschließlich an die eigenen
gekoppelten Geräte.

## Abgleich und Konflikte

**Der Server vergibt den Stempel.** Client-Uhren laufen auseinander; ein Vergleich
von Gerätezeitstempeln lässt irgendwann die falsche Seite gewinnen. Der Server
stempelt beim Schreiben, die Geräte prüfen nur auf **Gleichheit** — damit gibt es
genau eine Uhr und keine Zeitsynchronisation.

Jedes Gerät merkt sich `lastSeenStamp`: den Stempel des Bündels, das es zuletzt
geholt oder geschrieben hat.

Beim Start und danach alle 30 Sekunden:

1. `GET` mit `If-None-Match: <lastSeenStamp>`. Hat sich nichts geändert, antwortet
   der Server mit `304` und leerem Body — der Regelfall kostet damit ein paar
   hundert Byte statt des vollen Bündels. Der Server setzt dazu den Stempel als
   `ETag`; ein eigener "nur den Stempel"-Endpunkt erübrigt sich.
2. `remote.stamp !== lastSeenStamp` → ein anderes Gerät hat geschrieben:
   entschlüsseln, localStorage schreiben, `lastSeenStamp` setzen, Seite neu laden.
3. Sonst: das Bündel serialisieren und mit `lastSentBundle` vergleichen. Bei
   Unterschied verschlüsseln, `POST`, den zurückgegebenen Stempel und den
   gesendeten Stand merken.

Zusätzlich läuft Schritt 3 einmal bei `visibilitychange` auf `hidden` — also genau
dann, wenn der PC weggelegt und zum Handy gegriffen wird.

Der Dirty-Vergleich läuft über den serialisierten Inhalt. Kein Store wird
instrumentiert, kein Event verdrahtet.

**Der Reload beendet sich selbst:** Nach dem Anwenden ist `lastSeenStamp` gleich
`remote.stamp`, die Bedingung in Schritt 2 also falsch. Kein zweiter Durchlauf.

**Konfliktregel:** Das ganze Bündel gewinnt oder verliert gemeinsam. Trifft ein
fremder Push auf lokale Änderungen, gewinnt der fremde und die lokalen Änderungen
seit dem letzten Abgleich sind verloren. Beim Nutzungsmuster "ein Gerät zur Zeit"
folgenlos; feldweises Zusammenführen wäre ein Vielfaches an Code für einen Fall,
den es nicht gibt.

## Server

Zwei Routen in `src/server/apiRoutes.js`:

```
GET  /api/sync/:room   → { stamp, iv, ciphertext } + ETag: <stamp> | 304 | 404
POST /api/sync/:room   → { stamp }
```

Der Server kennt weder Nutzer noch Inhalt. Ablage: eine JSON-Datei je Raum unter
`os.tmpdir()/sdh-sync/<room>.json`.

**Warum tmpdir:** Der Deploy schaltet Releases per Symlink um und löscht alte
(`keep last 5` in `.github/workflows/deploy.yml`). Alles unterhalb des
Release-Verzeichnisses wäre nach zwei Deploys weg. tmpdir liegt außerhalb, überlebt
Deploys, und der Verlust bei einem Reboot ist unkritisch: die Wahrheit steht im
localStorage der Geräte, das nächste Gerät lädt das Bündel wieder hoch. Nebenbei
erledigt das die Aufräumfrage.

### Absicherung

Der Schreibendpunkt ist offen — das ist eine Vertrauensgrenze und wird behandelt:

- `:room` muss `^[a-f0-9]{32}$` erfüllen, sonst `400`. Ohne diese Prüfung ist der
  Pfad für Traversal offen.
- Die Payload-Größe deckelt bereits `express.json({ limit: '3mb' })` in beiden
  Entrypoints. Ein Bündel mit Rankings passt auch nach base64-Aufblähung hinein.
- Beim Schreiben wird die Anzahl Dateien im Verzeichnis geprüft; über 500 werden
  die ältesten gelöscht. Das deckelt den Plattenverbrauch hart und ersetzt eine
  TTL.

## Komponenten

| Einheit | Verantwortung | Abhängigkeiten |
|---------|---------------|----------------|
| `src/services/syncCrypto.js` | Ableitung von Raum-ID und AES-Schlüssel, ver-/entschlüsseln | WebCrypto |
| `src/services/syncBundle.js` | Bündel aus localStorage sammeln und anwenden | localStorage |
| `src/services/syncClient.js` | Kopplung, Hash-Auswertung, Abgleichschleife, HTTP | die beiden oberen |
| `src/components/SyncSection.jsx` | Setup-UI: koppeln, QR anzeigen, Status, entkoppeln | `syncClient`, QR-Lib |
| `apiRoutes.js` (erweitert) | die zwei Routen | `node:fs`, `node:os` |

Die Trennung von Krypto und Bündel ist kein Selbstzweck: beide sind reine Funktionen
und dadurch ohne Netz und ohne React testbar. `syncClient` bleibt die einzige Stelle
mit Nebenwirkungen.

## Fehlerfälle

| Fall | Verhalten |
|------|-----------|
| Server nicht erreichbar | Stillschweigend überspringen, beim nächsten Tick erneut. Der Sync darf den Draft nie blockieren. |
| Entschlüsselung schlägt fehl | Bündel verwerfen, Status "Kopplung passt nicht" anzeigen. Nichts überschreiben. |
| Raum leer (404) | Kein Fehler — das eigene Bündel hochladen. |
| Kein Secure Context | Kopplungs-UI erklärt, dass Sync HTTPS braucht. Kein Absturz. |
| Ungültiger Schlüssel im Hash | Ignorieren, Hash trotzdem wegräumen. |

## Tests (Vitest)

- `syncCrypto`: Roundtrip ver-/entschlüsseln; gleiches Geheimnis ergibt gleiche
  Raum-ID, verschiedene Geheimnisse verschiedene; Raum-ID hat das vom Server
  geforderte Format; Entschlüsseln mit falschem Schlüssel wirft.
- `syncBundle`: sammelt alle `sdh`-Keys **einschließlich** der Bindestrich-Stores;
  schließt `sdh.sync.v1` aus; Anwenden schreibt genau die enthaltenen Keys.
- Hash-Kopplung: `#sync=<key>` wird übernommen und der Hash entfernt; Unsinn im
  Fragment koppelt nicht.
- Server: `:room` mit `../` gibt 400; GET auf unbekannten Raum gibt 404; POST und
  anschließendes GET liefern denselben Inhalt und einen Stempel; GET mit
  `If-None-Match` auf dem aktuellen Stempel gibt 304 ohne Body.

## Bewusst ausgelassen

- **Feldweises Mergen.** Siehe Konfliktregel.
- **Ein Scanner in der App.** Der QR-Code enthält einen Link, den die Kamera-App
  des Systems öffnet. `BarcodeDetector` gibt es nicht überall, und der Pfad, auf den
  es ankommt (PC zeigt, Handy scannt), funktioniert ohne ihn.
- **TTL/Ablaufdatum.** Die Deckelung auf 500 Dateien und die Flüchtigkeit von
  tmpdir genügen.
- **Rate-Limiting.** Kann nachgezogen werden, wenn Missbrauch auftritt; die
  Dateizahl ist bereits gedeckelt.
- **Sync des Sync-Schlüssels über den Datei-Export.** Die Kopplung läuft über den
  QR-Code; `sdh.sync.v1` bleibt aus dem Bündel heraus, sonst kopiert ein Gerät seine
  Kopplung in fremde Bündel.
