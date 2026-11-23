# Ringfahrt

Ein Auto-Kampf-RPG im Browser, gebaut für das iPhone im Querformat, mit Helden aus „Der Herr der Ringe“ und „Die Ringe der Macht“ (inoffizielles Fan-Projekt).

**Spielen:** `index.html` im Browser öffnen. Keine Installation, kein Build.

## Als App auf den iPhone-Homebildschirm
1. Auf GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, Branch wählen, Ordner `/ (root)`, speichern.
2. Nach 1–2 Minuten die angezeigte Adresse (z. B. `https://<name>.github.io/PH/`) in **Safari** öffnen.
3. **Teilen → Zum Home-Bildschirm**. Ringfahrt startet dann als Vollbild-App mit eigenem Icon, ohne Safari-Leisten, und funktioniert nach dem ersten Start auch offline (`sw.js`).
4. Bei Updates: App einmal mit Internet öffnen und neu starten.

Optimiert für iPhone 11 (896 × 414 pt, Notch links/rechts, Home-Leiste unten). Unter **Optionen → Grafik** lässt sich zwischen *Auto*, *Hoch* (Figuren mit Szenenlicht, Kantenlicht und Bodenverdeckung) und *Normal* wählen; *Auto* schaltet bei zu niedriger Bildrate selbst herunter.

## Neu in Version 10
- **Hochformat-Layout:** eigene Anordnung für das iPhone hochkant – Kopfbereich, Kampfszene als Band, große Heldenkarten, Bereich für Truhe/Hinweise/Vorschläge, Tab-Leiste unten; alle Menüs bildschirmfüllend mit Hochkant-Rastern
- **Querformat mit Browserleisten:** Kompaktstufe für Safari und die Claude-App (z. B. 800 × 364), keine abgeschnittenen Knöpfe mehr
- **Überlappungs-Prüfung** für 6 Bildschirmgrößen (Hoch- und Querformat) ohne Befund
- Layout misst sich an der Spielfläche (Container-Abfragen) statt am Bildschirm

## Neu in Version 9.1
- **Sturmangriff der Rohirrim:** Théodens, Éomers und Éowyns Ultimate lässt eine Reiterschwadron über das Schlachtfeld galoppieren
- **Boss-Arena Brücke von Khazad-dûm:** schmale Steinbrücke über dem feurigen Abgrund; die Brücke bricht und der Balrog stürzt
- **Neue Wahrzeichen:** Hornburg mit Klammwall und Fackeln, Erebor mit großem Tor, Eilendem Wasser und Rabenberg

## Neu in Version 9
- **Reittiere** (eigener Tab im Heldenmenü): Schattenfell, Brego, Asfaloth, Schneemähne, Feuerfuß, Arod, Windfola, Stybba – geritten im Kampf, mit Bonus; Feinde auf Wargen, Rappen und Flugbestien
- **Wahrzeichen:** Minas Tirith, Barad-dûr mit dem Auge, Orodruin, Minas Morgul, Argonath, Ost-in-Edhil
- **Wuchtigere Angriffe:** Nachbilder, Funkenschlag, Bodenrisse, Runenkreise
- **Lore-Prüfung:** Aussehen nach Tolkiens Beschreibungen (u. a. Théoden, Kíli, Dwalin, Beorn, Tom Bombadil); neu: Celebrimbor und Gollum (44 Helden)

## Neu in Version 8.2
- **Boss-Auftritt als Kinoszene:** Kinobalken, Kamerafahrt, Brüllen mit Schockwelle und Staub
- **Finisher-Zeitlupe:** der letzte Treffer in Zeitlupe mit Zoom und Lichtstrahlen
- **Gruppenstufen-Feier:** Lichtsäulen über allen Helden
- **Dynamisches Licht:** Feuer, Blitze und heilige Magie erhellen die Umgebung
- **Optimiert:** vorberechnete Schatten, Bloom nur jedes zweite Bild

## Neu in Version 8.1
- **Neue Symbole:** gemalte Menü-Icons (Helm, Beutel, Karte, Schriftrolle, Kristall, Pokal, Zahnrad) und Münze/Mithril/Blitz in der Leiste
- **Edleres Menü:** goldene Zierlinie, metallische Knöpfe, leuchtende Tabs, Tiefe für alle Karten
- **Gerichtete Schatten:** Figuren werfen Schatten passend zur Lichtquelle des Gebiets
- **Balance geprüft** (Teil I–V): Wellen sicher, Bosse fordernd, Khamûl und Glaurung entschärft

## Neu in Version 8
- **Zwei neue Story-Teile (7 Kapitel):** Teil IV „Das Letzte Bündnis“ (Lindon, Dagorlad, Orodruin) und Teil V „Das Erste Zeitalter“ (Jähes Feuer, Beren & Lúthien, Fall von Gondolin, Angband)
- **8 neue Helden:** Gil-galad, Círdan, Glorfindel, Lúthien, Beren, Fingolfin, Éomer, Haldir (insgesamt 42)
- **Neue Gegner:** Morgoth, Glaurung, Gothmog, Carcharoth, Khamûl, Sauron in voller Macht, Balrog-Krieger, Werwölfe, Ostlinge
- **14 Sets** mit eigener Übersicht (Beutel → Sets): Fortschritt, Boni und „▶ Farmen“ direkt zur Quelle (Kapitelbosse, Orthanc-Turm, Endloser Ansturm, Prüfungen der Macht)
- **Spielfluss:** Stufenanzeige Gruppe vs. Gegner, Dialoge laufen automatisch weiter (abschaltbar)
- **Mehr Details:** Kettenhemden, Schwertgurte, Stiefelstulpen, Kragen

## Neu in Version 7.1
- **Ausrüstungs-Vorschläge:** Fällt ein besseres Teil, erscheint unten rechts „Besser für …: +X ⚡ · Anlegen“ (bei Auto-Ausrüstung: „✓ Angelegt“)
- **Beutel:** ▲ markiert Upgrades, „Anlegen: Held (+X ⚡)“ mit einem Tipp, „Aufräumen“ zerlegt Gewöhnliches
- **Edlere Icons** nach Seltenheit (Lichtkegel, Glanz, Funkeln, pulsierende Legendäre)
- **Bedienung:** Wischen blättert in allen Menüs, Tippen auf die Welt schließt das Menü

## Neu in Version 7
- **Gemeinsame Gruppenstufe:** Helden steigen nur durch Kämpfe auf, alle haben immer dieselbe Stufe (kein Nachleveln, kein Gold-Training)
- **Team-Übersicht:** die fünf Eingesetzten mit Ausrüstung, ▲ zeigt bessere Teile, Antippen eines Slots wechselt direkt mit Kampfkraft-Vergleich
- **Sichtbare Ausrüstung:** seltene Waffen leuchten, epische funkeln, legendäre sprühen Funken; Schulterplatten, Goldbesatz, Amulette und Aura je nach Seltenheit
- **Chronik** (die Geschichte zum Nachlesen) und **Bestiarium** (alle besiegten Gegner)
- Bloom, Lichtstrahlen, Horizontdunst, unscharfer Vordergrund, Schockwellen, Gegner zerfallen zu Glut

## Neu in Version 6
- **Menschliche Figuren:** realistische Proportionen, Gesichter im Profil, modellierte Gliedmaßen mit Licht und Schatten
- **Filmischer Look:** Kinobalken und Zeitlupe bei Ultimates, Schwertspuren, Filmkörnung, Laufstaub
- **Ultimate per Fingertipp** (+20 % Heldenmut) und **Truhenwahl** nach jedem Kapitel
- **Spezialmodi:** Endloser Ansturm, Bossrausch, Chaos-Prüfung (alle beliebig oft spielbar)
- **Neue Menüs:** alles auf einem Bildschirm, Tabs und Blättern statt Scrollen, ▶ startet sofort

## Inhalt
- **Vollbild im Querformat:** Die Welt läuft ununterbrochen, Menüs liegen als Glas-Panels darüber
- **28 Story-Kapitel** in drei Teilen (Der Hobbit, Der Ringkrieg mit Epilog, Die Ringe der Macht), je 8 Wellen + Boss
- **4 Nebenquests** (Der Alte Wald, Die Hügelgräberhöhen, Die Pfade der Toten, Die Tunnel von Ostirith), wiederholbar
- **44 Helden** in den Rollen Tank, Schaden und Heiler; je 3 Passive, zwei Aktive und eine Ultimate
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
