# Sleeper-Draft-Assistant

Dieses Repository enthält eine React-Webanwendung, die über die Sleeper API kommuniziert.  
Sie dient als Draft-Helper für NFL Fantasy Sleeper Drafts und ermöglicht es dir, deinen Draft live zu verfolgen, eigene Rankings zu importieren und dein Team im Blick zu behalten.

## Über

Der NFL Fantasy Sleeper Draft Assistant ist ein webbasiertes Tool zur Automatisierung und Visualisierung von NFL Fantasy Drafts.  
Mit einer klaren, modernen Benutzeroberfläche hilft er dir, Picks in Echtzeit zu verfolgen, dein Roster im Blick zu behalten und strategische Entscheidungen schnell zu treffen.

## Hauptfunktionen

- **Automatischer Fetch:** Verfolgt automatisch alle Picks in deinem Fantasy-Draft.
- **Echtzeit-Aktualisierung:** Updates werden laufend über die Sleeper API abgerufen.
- **CSV-Import:** Lade deine Rankings z. B. von FantasyPros als CSV-Datei hoch.
- **Filter & Suche:** Finde Spieler schnell nach Name oder Position.
- **Roster-Ansicht:** Behalte dein aktuelles Team jederzeit im Blick.

## Einrichtung

1. **Repository klonen**  
   ```bash
   git clone https://github.com/Zmash/sleeper-draft-helper.git
   cd sleeper-draft-helper
   ```

2. **Abhängigkeiten installieren**  
   ```bash
   npm install
   ```

3. **Entwicklung starten**  
   ```bash
   npm run dev
   ```
   Die App läuft nun lokal, standardmäßig auf `http://localhost:5173/`.

4. **Ranking importieren**  
   - Navigiere zum CSV-Import in der App.
   - Lade deine Ranking-Datei hoch oder füge den CSV-Text ein.
   - Die App übernimmt automatisch deine Liste.

5. **Draft verfolgen**  
   - Wähle deine Liga und Draft-ID aus.
   - Starte den Auto-Fetch oder aktualisiere manuell.
   - Beobachte live, wie deine Picks und die der Gegner markiert werden.

## Support

Falls du Unterstützung benötigst oder einen Fehler melden möchtest,  
öffne bitte einen [Issue](https://github.com/Zmash/sleeper-draft-helper/issues).

## Lizenz

Dieses Projekt steht unter der MIT-Lizenz – siehe die [LICENSE.md](LICENSE.md) Datei für Details.

---

Entwickelt mit ❤️ für Fantasy-Football-Fans.
