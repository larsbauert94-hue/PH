# Ringfahrt

Ein Auto-Kampf-RPG im Browser, gebaut für das iPhone im Querformat, mit Helden aus „Der Herr der Ringe“ und „Die Ringe der Macht“ (inoffizielles Fan-Projekt).

**Spielen:** `index.html` im Browser öffnen. Keine Installation, kein Build.

## Als App auf den iPhone-Homebildschirm
1. Auf GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, Branch wählen, Ordner `/ (root)`, speichern.
2. Nach 1–2 Minuten die angezeigte Adresse (z. B. `https://<name>.github.io/PH/`) in **Safari** öffnen.
3. **Teilen → Zum Home-Bildschirm**. Ringfahrt startet dann als Vollbild-App mit eigenem Icon, ohne Safari-Leisten, und funktioniert nach dem ersten Start auch offline (`sw.js`).
4. Bei Updates: App einmal mit Internet öffnen und neu starten.

Optimiert für iPhone 11 (896 × 414 pt, Notch links/rechts, Home-Leiste unten). Unter **Optionen → Grafik** lässt sich zwischen *Auto*, *Hoch* (Figuren mit Szenenlicht, Kantenlicht und Bodenverdeckung) und *Normal* wählen; *Auto* schaltet bei zu niedriger Bildrate selbst herunter.

## Inhalt
- **Vollbild im Querformat:** Die Welt läuft ununterbrochen, Menüs liegen als Glas-Panels darüber
- **21 Story-Kapitel** in drei Teilen (Der Hobbit, Der Ringkrieg mit Epilog, Die Ringe der Macht), je 8 Wellen + Boss
- **4 Nebenquests** (Der Alte Wald, Die Hügelgräberhöhen, Die Pfade der Toten, Die Tunnel von Ostirith), wiederholbar
- **34 Helden** in den Rollen Tank, Schaden und Heiler; je 3 Passive, zwei Aktive und eine Ultimate
- **Mehrphasige Bosse** (Balrog und Smaug fliegen, Sauron ruft die Neun …) und Großangriffe mit Vorwarnung
- **Bündnisse, 14 Heldenbande, 9 Begleiter, 21 Relikte, 8 Ausrüstungs-Sets** (farmbar durch erneute Bosskämpfe)
- **Prüfungen der Macht** (Raid-Bosse, beliebig oft), **Orthanc-Turm**, **Heldenreisen** mit Erschwernissen und besserer Beute
- **Auftragstafel und Siegestruhe** ohne Zeitsperren: alles wird erspielt
- **Selbst erzeugte Musik**, Spielstand-Export und -Import

## Dateien
- `index.html`: Seite und Stylesheet
- `manifest.webmanifest`, `sw.js`, `icons/`: Homebildschirm-App und Offline-Cache
- `js/data.js`: Klassen, Helden, Gegner, Kampagnen, Gegenstände
- `js/render.js`: Render-Engine (Figuren-Rigs, Charakterkarten, Parallax-Ebenen, Icons)
- `js/core.js`: Spielstand, Werte, Beute, Talente, Entwicklung
- `js/world.js`: Welt- und Kampf-Engine
- `js/ui.js`: HUD, Menüs und Story-Regie
- `classic.html`: die erste, rundenbasierte Version mit Timing-Eingaben
