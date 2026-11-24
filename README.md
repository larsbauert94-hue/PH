# Ringfahrt

Ein Auto-Kampf-RPG im Browser, gebaut für das iPhone im Querformat, mit Helden aus „Der Herr der Ringe“ und „Die Ringe der Macht“ (inoffizielles Fan-Projekt).

**Spielen:** `index.html` im Browser öffnen. Keine Installation, kein Build.

## Als App auf den iPhone-Homebildschirm
1. Auf GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, Branch wählen, Ordner `/ (root)`, speichern.
2. Nach 1–2 Minuten die angezeigte Adresse (z. B. `https://<name>.github.io/PH/`) in **Safari** öffnen.
3. **Teilen → Zum Home-Bildschirm**. Ringfahrt startet dann als Vollbild-App mit eigenem Icon, ohne Safari-Leisten, und funktioniert nach dem ersten Start auch offline (`sw.js`).
4. Bei Updates: App einmal mit Internet öffnen und neu starten.

Optimiert für iPhone 11 (896 × 414 pt, Notch links/rechts, Home-Leiste unten). Unter **Optionen → Grafik** lässt sich zwischen *Auto*, *Hoch* (Figuren mit Szenenlicht, Kantenlicht und Bodenverdeckung) und *Normal* wählen; *Auto* schaltet bei zu niedriger Bildrate selbst herunter.

## Neu in Version 20.1 – Fehlerbehebung
- **Unsichtbare Figuren behoben:** Trug ein Held eine mythische Waffe oder ein mythisches Amulett, fehlte beim Zeichnen die Farbe dieser Seltenheit. Dann blieben seine Karte und alle folgenden Heldenkarten leer, und im Kampf verschwanden Figuren.
- **Fehlerfestes Zeichnen:** Ein Fehler bei einer einzelnen Figur lässt nie mehr andere Figuren oder Karten verschwinden.

## Neu in Version 20 – Grafik-Update 2
- **Drachen neu gezeichnet:** Flügel mit nach hinten gefächerten Fingerknochen, Adern und gewellter Flughaut, Schuppen und Bauchplatten, Rückenstacheln, gehörnter Kopf mit beweglichem Kiefer, Zähnen und glühendem Schlund, eigene Laufbewegung
- **Spinnen neu gezeichnet:** gegliederte Beine mit Gelenken und Borsten, birnenförmiger behaarter Hinterleib mit Zeichnung und Glanz, Kopfbrust mit Furchen und Tastern
- **Alle Wahrzeichen neu:** Hornburg mit Klammwall, Rampe und Bergfried; Minas Tirith mit sieben Ringen, Felsbug und Weißem Turm; Barad-dûr mit gestaffelten Türmen und glühenden Schlitzen; die Argonath; die Wetterspitze mit zerbrochenem Mauerring und verwitterten Steinen; der Erebor mit Felsbändern, Zwergentor und Wächtern; Minas Morgul; Dol Guldur mit toten Bäumen und Nebel; ein Harad-Wachturm mit Palmen und Lehmhäusern; ein Tempel in Rhûn mit Jurten; ein Elbenschiff mit Schwanenbug; die Ruinen von Ost-in-Edhil mit Stechpalmen
- **Waffen und Schilde:** Schwerter mit Hohlkehle, geschwungener Parierstange, Lederwicklung und Knauf; Äxte mit Schneidenlicht, Metallringen und Rückendorn; Hämmer mit Kanten; Speere mit Blattklinge; Bögen mit Griffwicklung; Schilde mit Brettern, Metallrand, Nieten und Buckel
- **Bärte** mit Strähnen in Licht und Schatten
- **Menüs:** goldene Eckornamente an Karten und Dialogen, Zierstein unter den Reitern, filigrane Ecken am Seitenfenster

## Neu in Version 19 – großes Grafik-Update
- **Figuren neu gezeichnet:** Arme und Beine als durchgehende, muskulös geformte Konturen mit Licht- und Schattenseite statt aneinandergereihter Röhren und Gelenkscheiben; Stiefel mit umgeschlagener Stulpe; Roben als ein fließendes Gewand mit Faltenwurf, Gürtelkordel und weiten Glockenärmeln
- **Riesen und Trolle:** Riesen mit breiten Schultern und schmaler Taille, Trolle mit Buckel und Wanst; Plattenpanzer mit Lamellen und Nieten, geschichtete Schulterpanzer (bei Sauron mit Stacheln), gefächerter Plattenschurz; neuer Dornenhelm mit Visier statt Kastenkopf; Balrog mit Muskeln und Glutrissen
- **Wölfe und Warge:** geformte Beine mit Pfoten, zottige zurückfließende Mähne, Fellstruktur, keine Halsnaht
- **Landschaften:** Berge mit schroffen Graten, weiche Haufenwolken, belaubte Bäume mit Blattstruktur, gestufte Tannen (im Norden verschneit), Waldsäume in vielen Gebieten, Wiesen mit Grasbüscheln, Wildblumen und Pfad
- **Bruchtal und Lothlórien neu:** geschichtete Felswände mit Wasserfällen und ein elbisches Haus mit Turm und geschwungenen Dächern; Mallorn-Bäume mit silbrigen Stämmen, Ästen und goldenen Kronen
- **Kapitelbelohnung:** statt der Truhenwahl gibt es immer direkt den Gegenstand; die Bonusleiste öffnet ein festes Fenster

## Neu in Version 18
- **Lebendige Landschaften:** Trommeln in der Tiefe von Moria mit bebendem Boden und rieselndem Staub, glühende Spinnenaugen und eine sich abseilende Spinne im Düsterwald, das Auge Saurons mit wanderndem Suchstrahl über Mordor, Polarlichter im Norden, Schiffe und Möwen am Meer, Smaugs ferner Schatten über Seestadt und Erebor, Nazgûl-Geister um Dol Guldur, Krähenschwärme an der Wetterspitze, Laternenlichter in Lórien und Bruchtal, Schmetterlinge und abendliches Feuerwerk im Auenland
- **Schimmernde Gegner:** selten taucht ein goldglänzender Gegner auf – zäher, aber mit garantiert legendärer oder mythischer Beute; im Roten Buch markiert, mit zwei neuen Heldentaten
- **Die Adler kommen!** In verzweifelten Bosskämpfen können die Adler herabstoßen: schwerer Schaden für alle Feinde, Gefallene stehen wieder auf
- **Sternschnuppen:** ab und zu zieht eine Sternschnuppe über den Himmel – wer sie antippt, erhält ein Ringfragment
- **Eigene Ultimates der großen Helden:** Gandalfs Lichtkuppel, Aragorns Totenheer, Boromirs Horn, Earendils Sternenstrahlen, das Licht von Sam und Frodo, Bilbos Schatten, Túrins schwarze Flamme, Elronds Vilya, Arwens Blüten und Finrods Lied
- **Mythischer Fund:** eigene Bühne mit rotierendem Lichtkranz, Funken und den Werten des Gegenstands

## Neu in Version 17
- **Spiegel der Galadriel** (ab Kapitel 18): Kampf gegen dunkle Spiegelbilder der eigenen Gruppe mit ihren Fähigkeiten und Ultimates; jede Spiegelstufe stärker, alle fünf Stufen ein großer Fund; zerspringt ein Spiegelbild, schöpft der echte Held daraus Kraft
- **Neue Gegner mit eigenen Tricks:** der Wächter im Wasser (Fangarme, Umschlingen), Grabunholde mit lähmendem Grabesbann, Huorns mit Wurzelgriff und Borkenhaut, Hügeltrolle mit Felsbrocken und Flächenschaden, Ork-Katapulte mit Brandgeschossen aus der hinteren Reihe
- **Bosse in Phasen:** bei 50 % sichtbarer Gestaltwandel (der Hexenkönig besteigt sein Flugross, der Balrog entfacht Flammen, Saruman schillert in vielen Farben), bei 25 % das letzte Aufbäumen
- **Große Auftritte:** der Balrog steigt aus dem Feuerspalt, Smaug überfliegt das Feld, Nazgûl stoßen herab, Kankra seilt sich ab, Sauron und Morgoth wachsen aus dem Schatten, Saruman kommt mit dem Blitz
- **Finaler Schlag:** Treffer-Stillstand, lange Zeitlupe, Kamerafahrt und Schockwellen beim Todesstoß gegen einen Boss
- **Schlachtfelder mit Heeren:** auf dem Pelennor, in Helms Klamm (Fackeln in der Nacht), bei den Fünf Heeren, am Morannon und in der Ersten Zeit kämpfen Heere am Horizont – mit Pfeilsalven, Katapultfeuer und heranstürmenden Rohirrim
- **Musik je Region:** eigene Motive und Klangfarben für Auenland, Elben, Lórien, Düsterwald, Zwergenhallen, Rohan, Mordor, Schnee und Meer
- **Heldenhalle** (ab Kapitel 15): ein begehbarer Raum mit allen Helden, Bannern, Ringen auf Sockeln und den Trophäen besiegter Bosse
- **Erinnerungsbild:** nach Kapiteln, Sagen und Spiegelstufen ein gestaltetes Bild der Gruppe mit Kapitelname – teilen oder in Fotos sichern
- **Schneller auf dem iPhone:** Figuren werden in passgenauen Rahmen gezeichnet, der Leuchteffekt in einem Schritt; rund 40 % mehr Bilder pro Sekunde, hinter offenen Menüs läuft das Spielfeld sparsamer; neue Grafikstufe **Akku** (30 Bilder pro Sekunde, weniger Weichzeichner)

## Neu in Version 16
- **Siegesposen je Waffe:** Zauberer reißen den leuchtenden Stab empor, Schwertkämpfer recken die Klinge, Zwerge jubeln mit Axt und Hammer, Bogenschützen präsentieren den Bogen
- **Lichtsäule für große Beute:** fällt Legendäres oder Mythisches, steigt an der Stelle des Gegners eine Lichtsäule in der Farbe der Seltenheit auf
- **Rast am Lagerfeuer:** nach jedem Kapitel sitzt die Gruppe unter dem Sternenhimmel am Feuer, mit Funkenflug, Mondlicht und dem Begleiter
- **Begegnungen unterwegs:** Tom Bombadil, Gandalfs Feuerwerk, Beorns Halle, wandernde Elben, eine verlassene Truhe oder frische Orkspuren – zwei Wege zur Wahl, Segen für drei Kämpfe, Fragmente, Gegenstände oder ein Hinterhalt mit legendärer Chance

## Neu in Version 15
- **Ziele:** neuer erster Reiter im Reise-Menü mit allem, was sich gerade lohnt – Story, Sagen, Nebenquests, Kopfgeld, offene Sterne, Turm – jeweils mit ▶ und ↻5
- **Auto-Wiederholen:** Nebenquests, Kopfgeld, Prüfungen und Sagen 5× hintereinander; „Nächster Schritt“ zeigt den Stand und stoppt auf Tipp; endet automatisch nach einer Niederlage
- **Gefahren-Ampel** (Leicht / Fordernd / Gefährlich) auf Zielen, Jagd-, Sagen- und Questkarten
- **Beutel räumt sich selbst auf:** überholte Gegenstände werden verwertet (abschaltbar in den Optionen); Legendäres, Mythisches und Sets bleiben immer
- **Zeigefinger-Hinweis** auf den richtigen Knopf nach jeder Freischaltung
- **Automatische Sicherung** nach jedem Kapitel (die letzten drei), wiederherstellbar in den Optionen
- **Ultimates mit eigener Inszenierung:** Lichtexplosion (Gandalf), dunkle Königin (Galadriel), Pfeilregen, Erdbeben, Blitzlanzen, Sternenfall, Flammenbogen, Reiterangriff; Siegesfunken nach jedem Kampf
- **Neue Wahrzeichen:** Amon Sûl, Forodwaith mit eingefrorenem Schiff, Wachturm von Ostirith, Tempel von Rhûn, Dol Guldur
- **Neue Helden des Ersten Zeitalters:** Túrin Turambar, Fingon, Finrod Felagund, Húrin und Eärendil – über vier neue Sagen-Nebenquests in Teil V

## Neu in Version 14
- **Duo-Ultimates:** 13 Heldenpaare aus der Lore (Legolas & Gimli, Frodo & Sam, Théoden & Éomer, Beren & Lúthien …) greifen nach einem Ultimate einmal pro Kampf gemeinsam an – mit goldenem Lichtbogen zwischen beiden
- **Sagen-Bosse:** Ancalagon der Schwarze, Ungoliant und Draugluin – riesig, mit Verstärkung bei 66 % und 33 % LP, steigender Sagenstufe und mythischem Schatz beim ersten Sieg (Modi, Seite 3)
- **Lebendige Reisekarte:** Nebel über unerforschten Gebieten, dein Banner markiert den aktuellen Ort, zwischen Kapiteln wandert die Gruppe sichtbar weiter
- **Wetter und Tageszeit:** Regen, Gewitter mit Blitzen, Schneesturm, Ascheregen, Nebel, Abendrot und Nacht mit Fackellicht – passend zum Schauplatz
- **Kinomomente ohne Text:** Smaugs Fall, Gandalf und der Balrog, Morgengrauen über Helms Klamm, der Untergang des Rings, die Fahrt zu den Grauen Anfurten
- **Das Rote Buch der Westmark:** Sammelkarten für Helden, Gegner, Orte, Ringe, Banner und Schätze; volle Kapitel geben Dauerboni, besondere Karten leuchten golden
- **Heldenruhm:** Titel von „Bekannt“ bis „Unsterblich im Lied“, sichtbar als Goldsaum, Umhangspange, goldene Funken und Lichtschein

## Neu in Version 13
- **Mehr Herausforderung:** Elite-Gegner mit Eigenschaften (Gepanzert, Rasend, Morgul-Gift, Anführer, Schattenhaft, Uralt) – erkennbar an der Raute über der Lebensleiste
- **Kapitel-Prüfungen** Heldenhaft und Legendär mit je drei Sternen (Sieg, kein Held gefallen, Zeit) und Sternen-Meilensteinen
- **Kopfgeldjagd:** Golfimbul, Grishnákh, Mauhúr, Uglúk, Gorbag, Shagrat, der Mund Saurons, Ulfang – mit steigender Jagdstufe und Trophäen als Dauerbonus
- **Acht neue Nebenquests** mit exklusiven legendären Waffen: Wetterspitze, Kammer von Mazarbul, Jagd auf Gollum, Schlacht von Fornost, Korsaren von Umbar, Schmieden von Eregion, Adar im Südland, Untergang von Númenor
- **Helms Klamm** (Tor halten, Rammbock-Trolle, Gandalf im Morgengrauen) und **Pfad der Verzweiflung** (15 Kämpfe, Segen wählen, gefallene Helden bleiben zurück)
- **Mythische Gegenstände** (Gurthang, Aranrúth, Dramborleg, Silmaril …) nur aus den härtesten Herausforderungen
- **Heldentaten**, die beim normalen Spielen erkannt und sofort belohnt werden
- **Banner statt Wappen:** Gegner einer Fraktion stellen ein Kriegsbanner auf; die eigene Gruppe sammelt Banner (Thal, Erebor, Lórien, Rohan, Gondor, Noldor, Gondolin) und stellt eines für einen Gruppenbonus auf
- **Freischaltplan:** alles wird Schritt für Schritt freigeschaltet, gesperrte Dinge sind grau mit Hinweis, Neues wird angekündigt und mit NEU markiert
- **Bonusleiste** mit Begleiter, Banner, Bündnissen, Relikten, Trophäen, Ringen und Sets – oben links im Querformat, unter den Helden im Hochformat
- **Neue Grafik:** anatomisch gezeichnete Pferde und Ponys mit Mähne, Schweif und Sattelzeug, echte Wölfe und Warge, Radagasts Kaninchenschlitten, Gwaihir mit Federschwingen
- **Weniger Text im Kampf:** keine Fähigkeitsnamen mehr, Story-Dialoge optional (Optionen: Aus / An / Auto)
- **Neue Gegnergrafik:** Spinnen mit haarigem Hinterleib, Augenkranz, Giftklauen und gegliederten Beinen; Mûmakil mit Kriegsturm, Schabracke, Stoßzähnen und gegliedertem Rüssel; Drachen mit glatten Schwänzen und Hälsen, Rückenstacheln, Bauchplatten, Schuppen und Membranflügeln

## Neu in Version 12.3
- **Fehlerprüfung über das ganze Spiel:** alle Spezialmodi, Prüfungen der Macht, Orthanc-Turm, Nebenquests, Bossrevanchen, Ringschmiede, alle 44 Helden in allen Stufen und alle 20 Kulissen automatisch durchgespielt – ohne Fehler
- **Grammatik der Beute korrigiert:** „Elbische Brosche“, „Alter Kriegshammer“, „Gondorischer Zauberstab“ statt falscher Endungen; vorhandene Gegenstände werden beim Laden automatisch berichtigt; Werte mit deutschem Komma („+42,8 % Krit-Schaden“)
- **Wahre Ringträger:** Vilya geht automatisch an Elrond oder Gil-galad, Nenya an Galadriel, Narya an Gandalf, Durins Ring an Thorin, der Eine an Frodo – wahre Träger aus der Lore erhalten +20 % Ringwirkung
- **Grafik:** Baumbart mit Krone aus Zweigen und Laub (im Herbst golden), Gollum mit dünnen Strähnen statt Orkhauern, sanfteres Augenglühen bei Trollen, der Einsame Berg über der Seestadt mit Schneekappe und Spiegelung im See, natürlicher Schnee statt Überbelichtung
- **Layout:** Relikt-Namen und lange Set-Namen werden nicht mehr abgeschnitten; auf kleinen iPhones (SE/8) zweispaltige Bündnisse, nebeneinanderliegende Knöpfe und einzeilige Hinweise ohne Überlappung

## Neu in Version 12.2
- **Reisekarte als echte Mittelerde-Karte:** gealtertes Pergament mit Flecken und angesengten Rändern, schattierte Gebirgszüge (Nebelgebirge, Weiße Berge, Schattengebirge, Erebor), Wälder aus Baumzeichen (Düsterwald, Lórien, Fangorn), Flüsse mit Verlauf, Küste mit Wellen, Regionsnamen (Eriador, Rhovanion, Rohan, Gondor, Mordor …) und Kompassrose; glühender Schicksalsberg
- **Kapitel-Einblendung als Kinomoment:** bildschirmfüllendes, gemaltes Panorama des Schauplatzes mit seinem Wahrzeichen und langsamem Kamerazoom; auch bei Nebenquests, Bossrevanchen, Prüfungen und Orthanc-Etagen
- **Gegner mit mehr Charakter:** Orks, Uruks und Trolle mit Hauern, Narben und spitzen Ohren; Ringgeister ziehen wabernde Schattenschleier hinter sich her
- **Neue Wahrzeichen:** die Hallen von Moria und Khazad-dûm mit Säulenreihen, Lichtschacht und Staub, Zwergenlampen; der Düsterwald mit knorrigen Stämmen, durchhängenden Spinnennetzen und glimmenden Spinnenaugen

## Neu in Version 12.1
- **Wappen mittig als Wappenschild** auf der Brust (heraldischer Grund in Lore-Farbe, Metallrand); bei langen Bärten tiefer, bei Zwergen als Gürtelschnalle; Schilde mit schlichtem Buckel
- **Ausdrucksstärkere Gesichter:** Augenhöhlen, Wangenknochen, Lippen, Nasenrücken, Falten bei Älteren (Gandalf, Théoden, Balin, Círdan …), zornige Brauen im Kampf, geschlossene Augen bei Gefallenen
- **Neue Kulissen:** Bruchtal mit dem Letzten Heimeligen Haus und Wasserfällen, Lothlórien mit Mallorn-Bäumen, Fletts und Elbenlampen; Kapitel wechseln mittendrin die Kulisse (Bruchtal → Moria, Lórien → Amon Hen); fallende goldene Blätter
- **Kampfspuren:** Krater und Brandflecken bleiben während des Kampfs liegen; angeschlagene Figuren zeigen Kratzer, Schmutz und einen ausgefransten Umhang

## Neu in Version 12
- **Erkennungszeichen:** Wappen auf Brust und Schild nach der Lore – Weißer Baum von Gondor, Pferd von Rohan, Stern der Noldor, Durins Krone, Mallorn-Blatt, Glorfindels Goldene Blume, Thrushs Vogel von Thal; Gegner mit Weißer Hand (Isengard) und Lidlosem Auge (Mordor)
- **Berühmte Klingen leuchten:** Stich, Andúril, Orcrist, Narsil, Aeglos, Ringil, Angrist, Hadhafang u. a.
- **Realistischere Landschaften:** plastische Wolken mit Licht- und Schattenseite, eine dritte, ferne Bergkette in Luftperspektive, Berge mit Licht- und Schattenflanken, Rinnen und natürlicher Schneegrenze, Bodenflecken und Horizontdunst
- **Figuren im Umgebungslicht:** Himmels- und Bodenfarbe färben die Figuren, kräftigeres Kantenlicht, weichere Konturen, natürlichere Beine
- **Filmische Farbabstimmung** des ganzen Bildes (Kontrast und Sättigung, nur bei hoher Grafik)

## Neu in Version 11.2
- **Belohnungen spürbar:** Münzen fliegen von besiegten Gegnern zum Goldzähler, der hochzählt und aufleuchtet
- **NEU-Markierungen** für seltene Fundstücke im Beutel, Zähler am Beutel-Knopf
- **Menüs:** Karten gleiten beim Öffnen gestaffelt herein, aktiver Tab mit Leuchtstrich; Zerlegen epischer/legendärer Teile braucht einen zweiten Tipp
- **Wellen-Ansage** „Welle 3 von 8“ mit Elite-/Letzte-Welle-Hinweis
- **Titelbildschirm:** wechselnde Kulissen, glänzendes Logo, aufsteigende Glut
- **Option „Effekte: Sanft“** für weniger Beben und Blitze

## Neu in Version 11.1
- **Nächster Schritt:** leuchtender Knopf mit der sinnvollsten Aktion (Ring schmieden, Truhe öffnen, Aufträge/Erfolge abholen, Held entwickeln) – ein Tipp führt hin
- **Figuren antippen:** Info-Karte mit Stufe, Leben, Zuständen, Fähigkeiten und Bestiarium
- **Wischen schließt Menüs** (hochkant: Kopfzeile nach unten, quer: nach rechts)
- **Heldenkarten** mit Lebensbalken, Schadensspur, Treffer-Blitz und Heil-Leuchten; **Bossleiste** mit Schadensspur, Prozent und Phasenmarke
- **Nebelbänke** in Düsterwald, Dol Guldur, Moria, Mordor u. a.

## Neu in Version 11
- **Ringe der Macht schmieden** (neuer Menüpunkt „Schmiede“): Barahirs Ring, Durins Ring, Vilya, Nenya, Narya, ein Ring der Neun und der Eine Ring – die mächtigsten Gegenstände des Spiels, mit Gruppen-Aura, veredelbar bis ★5, sichtbar leuchtend an der Hand des Trägers
- **Ringfragmente** findet man bei Bossen, in Truhen, Nebenquests, Erfolgen, im Orthanc-Turm, in Spezialmodi und Prüfungen
- **Kein Aufwerten mit Ressourcen mehr:** Verstärken und Mithril entfernt; Gold dient nur dazu, Dinge früher freizuschalten (Entwicklung vor der Stufengrenze, Reittiere, Spezialmodi, Nebenquests). Entwicklung ab der Stufengrenze ist kostenlos
- Relikte jetzt als Tab im Erfolge-Menü; bestehende Spielstände werden automatisch umgestellt

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
