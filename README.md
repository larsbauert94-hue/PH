# Ringfahrt

Ein Auto-Kampf-RPG im Browser, gebaut für das iPhone im Querformat, mit Helden aus „Der Herr der Ringe“ und „Die Ringe der Macht“ (inoffizielles Fan-Projekt).

**Spielen:** `index.html` im Browser öffnen. Keine Installation, kein Build.

## Inhalt
- **Vollbild im Querformat:** Die Welt läuft ununterbrochen, Menüs liegen als Glas-Panels darüber
- **Feste Story in 14 Kapiteln** (Der Ringkrieg & Die Ringe der Macht) mit Dialogen, Boss-Auftritten und Gefährten, die unterwegs dazustoßen
- **23 Helden** in den Rollen Tank, Schaden und Heiler; je 3 Passive, eine häufige Aktive, eine seltene Aktive (ab Stufe 10) und eine Ultimate
- **Eine Leiste pro Held:** Ist sie voll, folgt automatisch die Ultimate
- **Flüssige Animationen** mit Vektor-Rigs, Parallax-Landschaften, Licht und Partikeln
- **Ausrüstung** in fünf Seltenheiten (inkl. legendärer Gegenstände), automatisches Anlegen, Verstärken
- **Entwicklungsstufen** mit neuem Aussehen, Erfolge mit Belohnungen

## Dateien
- `index.html`: Seite und Stylesheet
- `js/data.js`: Klassen, Helden, Gegner, Kampagnen, Gegenstände
- `js/render.js`: Render-Engine (Figuren-Rigs, Charakterkarten, Parallax-Ebenen, Icons)
- `js/core.js`: Spielstand, Werte, Beute, Talente, Entwicklung
- `js/world.js`: Welt- und Kampf-Engine
- `js/ui.js`: HUD, Menüs und Story-Regie
- `classic.html`: die erste, rundenbasierte Version mit Timing-Eingaben
