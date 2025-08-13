# Sleeper-Draft-Helper

Dieses Repository enthält eine React-Webanwendung, die über die Sleeper API kommuniziert.  
Sie dient als Draft-Helper für NFL Fantasy Sleeper Drafts und ermöglicht es dir, deinen Draft live zu verfolgen, eigene Rankings zu importieren und dein Team im Blick zu behalten.

## Über

Der NFL Fantasy Sleeper Draft Helper ist ein webbasiertes Tool zur Automatisierung und Visualisierung von NFL Fantasy Drafts.  
Mit einer klaren, modernen Benutzeroberfläche hilft er dir, Picks in Echtzeit zu verfolgen, dein Roster im Blick zu behalten und strategische Entscheidungen schnell zu treffen.

## Hauptfunktionen

- **Automatischer Fetch:** Verfolgt automatisch alle Picks in deinem Fantasy-Draft.
- **Echtzeit-Aktualisierung:** Updates werden laufend über die Sleeper API abgerufen.
- **CSV-Import:** Lade deine Rankings z. B. von FantasyPros als CSV-Datei hoch.
- **Filter & Suche:** Finde Spieler schnell nach Name oder Position.
- **Roster-Ansicht:** Behalte dein aktuelles Team jederzeit im Blick.
- **AI Draft Advice:** Empfiehlt auf Knopfdruck den nächsten Pick – basierend auf deinem Board, deiner Liga und deinem aktuellen Roster.

## AI Draft Advice

Die integrierte KI liefert dir im **Board-Tab** eine Empfehlung für deinen nächsten Pick – samt kurzer Begründung und sinnvollen Alternativen.  
Dabei berücksichtigt sie u. a. dein aktuelles Team, die Ligaeinstellungen (z.B. PPR) sowie die Verfügbarkeit der besten Kandidaten aus deinem Board.

**So funktioniert’s:**  
1. Importiere dein Ranking (CSV) und wähle Liga & Draft aus.  
2. Öffne den **Board-Tab** und klicke auf **„🤖 AI Advice“**.  
3. Beim ersten Mal hinterlegst du deinen **OpenAI API‑Key** (nur lokal im Browser gespeichert).  
4. Du erhältst eine **Empfehlung**, **Alternativen** und kurze **Strategie‑Hinweise**.

**Hinweise:**  
- Der API‑Key wird ausschließlich **lokal** gespeichert.  
- Etwaige Kosten für KI‑Anfragen fallen über dein **eigenes** OpenAI‑Konto an.  

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

## Haftungsausschluss

Dieses Projekt steht in **keiner Verbindung** zu Sleeper oder FantasyPros.  
Es handelt sich um ein **inoffizielles, von der Community erstelltes Tool**, das lediglich deren öffentliche APIs nutzt.  
Alle Markennamen, Logos und Produktbezeichnungen sind Eigentum ihrer jeweiligen Inhaber.
