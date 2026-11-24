# Pour

Das soziale Netzwerk für die Wein-, Spirituosen- und Gastroszene. Es mischt LinkedIn und Instagram: Betriebe und Menschen aus der Branche teilen Neuigkeiten, Marken kündigen Produkte an, Händler und Lieferanten posten Angebote, Bars suchen Personal, und eine Karte zeigt, wo welche Bar und welches Restaurant ist.

„Pour“ ist ein Arbeitstitel.

## Funktionen

| Bereich | Inhalt |
| --- | --- |
| **Login** | Apple (nativ auf iOS), Google, E-Mail mit Passwort |
| **Onboarding** | Kontotyp wählen. Betriebe: Bar, Restaurant, Händler, Lieferant, Marke. Personen: Gastro-Profi, Genießer:in. Dazu Name, Nutzername, Position und Arbeitsplatz, Bestätigung „18+“ und Zustimmung zu den Nutzungsbedingungen |
| **Feed** | Filter: Alle, Folge ich, Neuheiten, Marken & Handel, Bars & Restaurants, Jobs, Events |
| **Posten** | Arten: Beitrag, Neuheit, Angebot, Event, Job. Jeweils mit Foto, Kategorie, markiertem Ort und Link |
| **Karte** | Alle Bars und Restaurants auf Apple Maps bzw. Google Maps, filterbar nach Art. Listenansicht, eigener Standort, Route. Bars und Restaurants können sich selbst eintragen |
| **Netzwerk** | Verzeichnis aller Profile mit Filter nach Typ und Suche nach Name, Stadt oder Position |
| **Profile** | Für Personen mit Position und Arbeitsplatz wie bei LinkedIn, für Betriebe mit Haken „verifiziert“. Folgen, Follower und Beiträge |
| **Sicherheit** | Beiträge und Profile melden, Nutzer blockieren, Account in der App löschen (Pflicht im App Store) |

## Schnellstart (Demo-Modus)

```bash
npm install
npx expo start
```

Ohne Supabase-Zugangsdaten startet die App im **Demo-Modus** mit erfundenen Beispieldaten. Die Anmeldung funktioniert dann ohne echte Konten:

- Apple und Google legen ein neues Demo-Konto an und führen durch das Onboarding.
- Mit `demo@example.com` und beliebigem Passwort meldest du dich als bestehender Nutzer an.

Zum Ausprobieren auf dem Handy die App **Expo Go** installieren und den QR-Code scannen. Für den nativen Apple-Login und Google Maps auf Android braucht es einen Development Build (siehe unten).

## Supabase einrichten

1. Ein Projekt auf [supabase.com](https://supabase.com) anlegen, am besten in der Region EU (Frankfurt).
2. Das Schema einspielen. Entweder mit der CLI:
   ```bash
   npx supabase link --project-ref <projekt-ref>
   npx supabase db push
   ```
   oder den Inhalt von `supabase/migrations/20261124000000_init.sql` im SQL Editor ausführen.
3. Optional die Beispieldaten laden: `supabase/seed.sql` im SQL Editor ausführen. Neu erzeugen lässt sich die Datei mit `npm run seed:generate`.
4. `.env.example` nach `.env` kopieren und URL sowie Publishable Key eintragen (zu finden unter Project Settings → API).
5. Unter **Authentication → Providers**:
   - **Email**: aktiviert lassen.
   - **Apple**: aktivieren. Bei „Client IDs“ die Bundle-ID `app.pour.mobile` eintragen.
   - **Google**: aktivieren. Client-ID und Secret aus der Google Cloud Console eintragen (OAuth-Client vom Typ „Web“).
6. Unter **Authentication → URL Configuration** die Redirect-URL `pour://**` hinzufügen.

### Datenbank

- **Tabellen**: `profiles`, `venues`, `posts`, `likes`, `comments`, `follows`, `blocks`, `reports`.
- **Views** für die App: `feed`, `comment_feed`, `profile_stats`.
- **Row Level Security** auf allen Tabellen: Lesen ist nur angemeldet möglich, schreiben darf man nur eigene Daten. Den Haken „verifiziert“ und den Kontotyp können Nutzer nicht selbst ändern. Blockieren blendet Inhalte in beide Richtungen aus.
- **Funktionen**: `complete_onboarding()` und `delete_account()`.
- **Bilder**: Bucket `media`. Jeder Nutzer darf nur in seinen eigenen Ordner hochladen.
- **Moderation**: Meldungen landen in `reports` und sind nur im Supabase-Dashboard sichtbar. Profile verifiziert man dort mit `update profiles set verified = true where handle = '…'`.

## Ab in den App Store

Voraussetzungen:

- Ein [Apple Developer Account](https://developer.apple.com) (99 €/Jahr).
- Ein [Expo-Account](https://expo.dev) für EAS (der Free-Tarif reicht für den Anfang).

```bash
npx eas-cli@latest login
npx eas-cli@latest init        # verknüpft das Projekt mit Expo
# Jetzt auf expo.dev beim Projekt unter "Environment variables" für "production"
# EXPO_PUBLIC_SUPABASE_URL und EXPO_PUBLIC_SUPABASE_KEY eintragen
npx eas-cli@latest build --profile production --platform ios
npx eas-cli@latest submit --platform ios
```

Vorher anpassen:

- [ ] Bundle-ID `app.pour.mobile` in `app.json` auf eine eigene ändern, zum Beispiel `de.deinefirma.pour`.
- [ ] In App Store Connect die App anlegen und die `ascAppId` in `eas.json` eintragen.
- [ ] Bei „Sign in with Apple“ im Apple Developer Portal die Capability für die App-ID aktivieren (EAS macht das in der Regel automatisch).
- [ ] Nutzungsbedingungen und Datenschutzerklärung juristisch prüfen lassen und Impressum ergänzen (`src/app/rechtliches.tsx`). App Store Connect verlangt außerdem eine öffentliche URL zur Datenschutzerklärung.
- [ ] Altersfreigabe in App Store Connect: wegen der Alkohol-Inhalte die höchste Stufe (18+) wählen.
- [ ] App-Datenschutzangaben („App Privacy“): E-Mail, Name, Fotos, Nutzerinhalte und ungefährer Standort (wird nicht gespeichert).
- [ ] Für das Review einen Test-Account mit E-Mail und Passwort hinterlegen.
- [ ] Android: einen Google-Maps-API-Key in `app.json` bei `androidGoogleMapsApiKey` eintragen.

Für Tests auf dem eigenen iPhone vor dem Release: `npx eas-cli@latest build --profile development --platform ios`.

## Entwicklung

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm run web            # im Browser ansehen (Karte dort nur als vereinfachte Vorschau)
```

**Struktur**

- `src/app/`: Bildschirme (Expo Router). `(auth)` enthält den Login, `(tabs)` die Hauptnavigation.
- `src/components/`: Bausteine wie PostCard, ProfileView, Karte und UI-Elemente.
- `src/lib/`: Datenschicht (`api.ts` für Supabase, `demo-api.ts` für den Demo-Modus), Login (`auth.tsx`), Queries, Typen und Theme.
- `supabase/`: Migration und Beispieldaten.

## Nächste Schritte (Vorschläge)

- Direktnachrichten zwischen Betrieben und Personen, etwa für Bewerbungen oder Musteranfragen
- Push-Benachrichtigungen bei Likes, Kommentaren und neuen Followern
- Profilbilder hochladen
- Admin-Ansicht für Meldungen und Verifizierungen
- Ausführlichere Ortsseiten mit Öffnungszeiten, Fotos und Getränkekarte
- Paginierung im Feed (aktuell die neuesten 100 Beiträge)
