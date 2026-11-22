# Ringfahrt

Ein Auto-Kampf-RPG im Browser mit Helden aus „Der Herr der Ringe“ und „Die Ringe der Macht“ (inoffizielles Fan-Projekt).

**Spielen:** `index.html` im Browser öffnen. Keine Installation, kein Build.

## Inhalt
- **23 Helden** in drei Rollen wie in einem MMO: **Tank** (Schildwache, Bollwerk, Urgewalt), **Schaden** (Klingenmeister, Waldläufer, Schattenläufer, Zauberer) und **Heiler** (Lichtheiler, Naturheiler), jeweils mit eigener Ressource (Wut, Energie, Fokus, Mana)
- **Automatische Kämpfe** mit Bedrohungssystem: Tanks spotten, Heiler heilen, Schadensverursacher wählen passende Fähigkeiten; Ultimates automatisch oder per Klick
- **Flüssige Animationen:** Figuren als Vektor-Rigs mit Gelenken, interpolierte Bewegungen bei 60 fps, Partikel, Lichteffekte, Kamera-Zoom
- **Ausrüstung** in fünf Seltenheiten inkl. 20 legendärer Gegenstände (Andúril, Stich, Nenya, Mithrilhemd …), Verstärken bis +10, Zerlegen
- **Talentbäume** mit drei Spezialisierungen pro Klasse und **Entwicklungsstufen** (z. B. Gandalf der Graue → Gandalf der Weiße)
- **Belohnungen:** Kapitel-Truhen, 18 Erfolge, Rekrutierung in der Taverne, endloser Orthanc-Turm
- **Zwei Kampagnen:** „Der Ringkrieg“ (8 Kapitel) und „Die Ringe der Macht“ (6 Kapitel)

## Dateien
- `index.html`: Seite und Stylesheet
- `js/data.js`: Klassen, Helden, Gegner, Kampagnen, Gegenstände
- `js/render.js`: Render-Engine (Figuren-Rigs, Animationen, Hintergründe, Icons)
- `js/core.js`: Spielstand, Werte, Beute, Talente, Entwicklung
- `js/battle.js`: Auto-Kampf-Engine
- `js/ui.js`: Bildschirme und Bedienung
- `classic.html`: die erste, rundenbasierte Version mit Timing-Eingaben
