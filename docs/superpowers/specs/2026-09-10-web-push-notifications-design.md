# Design: Web-Push-Benachrichtigungen (PWA, Android)

Stand: 2026-09-10 · Status: freigegeben · Nächster Schritt: Implementierungsplan (`writing-plans`)

## Kontext

Lineup-Seite hat seit Kurzem den Reiter „Alle Teams" (ligaübergreifende
Warnstufen Rot/Gelb/Grün aus `src/services/analysis/allTeamsLineup.js`).
Gewünscht: Server prüft regelmäßig und schickt bei Problemen Push, plus
morgendliche Waiver-Erinnerung. Rahmen: Server läuft always-on (eigener
Server, HTTPS), Nutzer nur Android, ausschließlich PWA (kein Capacitor).

## Ziele

1. Push bei Lineup-Problemen (rot/gelb aus „Alle Teams") vor Spieltagen,
   mit Spielernamen und Liga.
2. Morgendliche Waiver-Erinnerung mit Top-Pickup-Vorschlägen je Liga.
3. Kein Spam: nur bei echten Befunden, max. 1 Nachricht je Lauf und Gerät.

## Nicht-Ziele

- iOS-Support (Web Push dort nur für installierte PWAs ab 16.4 – irrelevant,
  keine iOS-Nutzer).
- Capacitor/FCM-Pfad (wird nicht genutzt).
- E-Mail/Telegram-Alternativen (verworfen: Push reicht).

## Architektur

- **Client:** `vite-plugin-pwa` mit eigenem Service Worker (`injectManifest`,
  z. B. `src/sw.js`): Push anzeigen, Klick öffnet `/lineup`. Opt-in-UI
  (Setup- oder Lineup-Seite): Notification-Permission holen, Subscription mit
  VAPID-Public-Key erzeugen, an Server senden **inkl. Sleeper-Username**.
- **Server:** neue Routen in `src/server/apiRoutes.js` (einzige Quelle für
  `/api/*`): `GET /api/push/vapid-key`, `POST /api/push/subscribe`,
  `POST /api/push/unsubscribe`. Ablage als JSON-Datei via `SDH_PUSH_FILE`
  (Muster wie `SDH_SCORES_FILE`). Versand mit `web-push`.
- **Scheduler:** `node-cron` im Server-Prozess, aktiv nur mit
  `SDH_SCHEDULER=1` (nur Prod – kein Doppelversand aus Dev-Läufen).
- **Config (Env):** `SDH_VAPID_PUBLIC_KEY`, `SDH_VAPID_PRIVATE_KEY`,
  `SDH_VAPID_SUBJECT`, `SDH_PUSH_FILE`, `SDH_SCHEDULER`. Keys einmalig
  generieren (`web-push generate-vapid-keys`).
- **Voraussetzung:** HTTPS auf Prod (Web Push braucht Secure Context;
  `localhost` zum Testen genügt).

## Datenfluss

- **Morgens (8:00 Europe/Berlin):** je Subscription (gespeicherter
  Sleeper-Username) → Ligen laden → Kader + Starter → `bestLineup` +
  `buildAllTeamsRows` (beide ESM ohne Browser-APIs → serverseitig
  wiederverwendbar) → bei Rot/Gelb Push mit Namen
  (z. B. „Dynasty: A.J. Brown (Out) aufgestellt"). Waiver-Teil: Top-3 aus
  `pickupRanking` je Liga (bestehende Rankings-Routen + Sleeper-Spielermeta
  mit Datei-Cache).
- **Pre-Game (Do + So, 60–90 Min vor Kickoff):** nur Lineup-Check
  (Bye/Out + Injury-Updates), keine Waiver-Texte.
- **Anti-Spam:** max. 1 Nachricht je Lauf und Gerät; Versand nur bei
  vorhandenen Warnungen; Waiver-Reminder nur bei Top-Pickups mit Wert.

## Fehlerfälle / Betrieb

- Push-Fehlschlag 410/404 → Subscription automatisch aus der Datei löschen.
- Rankings/Meta nicht erreichbar → Check degradiert zu text-only statt
  zu scheitern.
- Läufe werden protokolliert (idempotent, kein Doppelversand nach Restart).
- Abmelden: `unsubscribe`-Route; zusätzlich Hinweis bei App-Daten-Löschung.

## Testing

- Unit: Payload-Aufbau + Dedupe/Cleanup mit gemockten Sleeper-Daten
  (Warnstufen-Tests in `allTeamsLineup.test.js` existieren bereits).
- Manuell: End-to-End gegen Dev-Server mit echtem Abo (Secure Context),
  dann Prod-Verifikation.
- Neue Dependencies: `web-push`, `node-cron`, `vite-plugin-pwa` (dev).

## Offene Punkte für den Plan

- Exakte Pre-Game-Zeiten (Kickoff variabel – Do 02:15 / So 19:00 MEZ als
  Startwerte, später ggf. dynamisch aus `fetchNflState`/Schedule).
- Opt-in-Platzierung (Setup vs. Lineup-Reiter).
- Waiver-Reminder-Inhalt bei Dynasty (KTC-Top-Werte statt ROS-Rängen?).
