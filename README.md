# Ringfahrt

Ein Auto-Kampf-RPG im Browser, gebaut für das iPhone im Querformat, mit Helden aus „Der Herr der Ringe“ und „Die Ringe der Macht“ (inoffizielles Fan-Projekt).

**Spielen:** `index.html` im Browser öffnen. Keine Installation, kein Build.

## Inhalt
- **Vollbild im Querformat:** Die Welt läuft ununterbrochen, Menüs liegen als Glas-Panels darüber
- **21 Story-Kapitel** in drei Teilen (Der Hobbit, Der Ringkrieg mit Epilog, Die Ringe der Macht), je 8 Wellen + Boss, danach endlose Heldenreisen
- **32 Helden** in den Rollen Tank, Schaden und Heiler; je 3 Passive, eine häufige und eine seltene Aktive (ab Stufe 10) und eine Ultimate
- **Bündnisse** (z. B. Gemeinschaft, Hobbits, Elben, Zwerge, Thorins Gefolgschaft) mit Gruppenboni
- **Relikte** von jedem Boss, **tägliche Aufträge**, **Lagerfeuer-Truhe** (Belohnungen über Zeit), **Training** mit Gold
- **Gemeinschafts-Kombos** bei schnell aufeinanderfolgenden Ultimates, **Boss-Großangriffe** mit Vorwarnung
- **Reise-Karte** von Mittelerde mit antippbaren Stationen, **Orthanc-Turm** als endlose Herausforderung
- **Flüssige Animationen** mit Vektor-Rigs, Parallax-Landschaften, Licht und Partikeln; Smaug als Drache
- **Ausrüstung** in fünf Seltenheiten, Entwicklungsstufen, Erfolge

## Dateien
- `index.html`: Seite und Stylesheet
- `js/data.js`: Klassen, Helden, Gegner, Kampagnen, Gegenstände
- `js/render.js`: Render-Engine (Figuren-Rigs, Charakterkarten, Parallax-Ebenen, Icons)
- `js/core.js`: Spielstand, Werte, Beute, Talente, Entwicklung
- `js/world.js`: Welt- und Kampf-Engine
- `js/ui.js`: HUD, Menüs und Story-Regie
- `classic.html`: die erste, rundenbasierte Version mit Timing-Eingaben
