# Pour

Ein soziales Netzwerk für die Wein- und Spirituosen-Szene, inklusive Bars, Restaurants, Brennereien und Weingütern. Der Name ist ein Arbeitstitel.

## Funktionen (Prototyp)

- **Feed**: Beiträge von Leuten, denen du folgst, oder von allen. Oben eine Leiste mit Orten im Story-Stil.
- **Posten**: Foto hochladen oder mit der Kamera aufnehmen, Getränk mit Kategorie, Produzent, Jahrgang, Region, Bewertung und Tasting Notes erfassen, einen Ort markieren.
- **Interaktion**: Likes (auch per Doppeltipp aufs Bild), Kommentare, Folgen.
- **Entdecken**: Suche nach Getränk, Region, Bar oder Stadt, Filter nach Kategorie (Rotwein, Whisky, Gin, Cocktail …), Vorschläge für Leute und Profis (Sommeliers, Bartender, Brenner).
- **Orte**: Bars, Restaurants, Weinbars, Brennereien und Weingüter mit Durchschnittsbewertung, allen dort getrunkenen Beiträgen und einer Merkliste.
- **Profil**: eigene Beiträge, gemerkte Orte und die Lieblingskategorie.

Alle Daten liegen bisher lokal im Browser (localStorage). Beim ersten Start werden Beispieldaten geladen. Über das Pfeil-Symbol im eigenen Profil lässt sich alles zurücksetzen.

## Entwicklung

```bash
npm install
npm run dev      # Entwicklungsserver
npm run build    # Produktions-Build nach dist/
```

Technik: React 19, TypeScript, Vite, Tailwind CSS, React Router, lucide-react.

## Nächste Schritte

- Backend mit Login, Datenbank und Bild-Speicher (z. B. Supabase oder Firebase)
- Altersverifikation (18+) und Hinweise zu verantwortungsvollem Konsum
- Karte mit Orten in der Nähe
- Verifizierte Profile für Bars und Restaurants, die selbst posten, Events anlegen und ihre Karte zeigen können
- Etikett-Scan zum automatischen Erkennen eines Getränks
- Native App über Capacitor oder React Native / Expo
