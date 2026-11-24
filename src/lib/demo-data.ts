// Beispieldaten für den Demo-Modus und für supabase/seed.sql (erzeugt über scripts/generate-seed.ts).
// Alle Betriebe, Marken und Personen sind frei erfunden.
import type { AccountType, Category, PostKind, VenueType } from './types'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export interface SeedProfile {
  id: string
  email: string
  handle: string
  name: string
  account_type: AccountType
  headline: string
  workplace: string
  bio: string
  city: string
  website: string | null
  verified: boolean
}

export interface SeedVenue {
  id: string
  owner_id: string | null
  name: string
  type: VenueType
  address: string
  city: string
  latitude: number
  longitude: number
  description: string
  website: string | null
  phone: string | null
}

export interface SeedPost {
  id: string
  author_id: string
  kind: PostKind
  title: string | null
  body: string
  category: Category
  link_url: string | null
  venue_id: string | null
  hoursAgo: number
}

export const P = {
  demo: id(1), rheinkeller: id(2), nordlicht: id(3), alpenbrand: id(4), schieferhang: id(5),
  waldbrand: id(6), nachtschatten: id(7), ochsen: id(8), lena: id(9), max: id(10), sofia: id(11), rebe: id(12),
}
export const V = {
  nachtschatten: id(101), rebe: id(102), ochsen: id(103), kupfer: id(104), hafen: id(105), dom: id(106),
  main: id(107), kö: id(108), leipzig: id(109), stuttgart: id(110), spree: id(111), schanze: id(112),
  isar: id(113), ehrenfeld: id(114), sachsenhausen: id(115), hotel: id(116),
}

/** Profil, mit dem man im Demo-Modus angemeldet ist */
export const DEMO_USER_ID = P.demo

export const seedProfiles: SeedProfile[] = [
  { id: P.demo, email: 'demo@example.com', handle: 'jonas.hartmann', name: 'Jonas Hartmann', account_type: 'gastro', headline: 'Barmanager', workplace: 'Kupferkessel', bio: 'Zehn Jahre hinter dem Tresen, Fokus auf deutsche Spirituosen.', city: 'Berlin', website: null, verified: false },
  { id: P.rheinkeller, email: 'rheinkeller@example.com', handle: 'rheinkeller', name: 'Rheinkeller Weinhandel', account_type: 'haendler', headline: '', workplace: '', bio: 'Weinfachhandel und Gastro-Belieferung seit 1987. Über 1.200 Positionen.', city: 'Köln', website: 'https://example.com/rheinkeller', verified: true },
  { id: P.nordlicht, email: 'nordlicht@example.com', handle: 'nordlicht.getraenke', name: 'Nordlicht Getränkegroßhandel', account_type: 'lieferant', headline: '', workplace: '', bio: 'Großhandel für Gastronomie in Norddeutschland. Spirituosen, Wein, Bier, Alkoholfreies.', city: 'Hamburg', website: 'https://example.com/nordlicht', verified: true },
  { id: P.alpenbrand, email: 'alpenbrand@example.com', handle: 'alpenbrand', name: 'Alpenbrand Spirituosen', account_type: 'marke', headline: '', workplace: '', bio: 'Gin, Kräuterlikör und Obstbrände aus den bayerischen Alpen.', city: 'München', website: 'https://example.com/alpenbrand', verified: true },
  { id: P.schieferhang, email: 'schieferhang@example.com', handle: 'weingut.schieferhang', name: 'Weingut Schieferhang', account_type: 'marke', headline: '', workplace: '', bio: 'Familienweingut in fünfter Generation. Steillagen-Riesling von der Mosel.', city: 'Bernkastel-Kues', website: null, verified: true },
  { id: P.waldbrand, email: 'waldbrand@example.com', handle: 'waldbrand.destille', name: 'Waldbrand Destillerie', account_type: 'marke', headline: '', workplace: '', bio: 'Kleine Brennerei im Schwarzwald. Tastings jeden Samstag.', city: 'Freiburg', website: null, verified: false },
  { id: P.nachtschatten, email: 'nachtschatten@example.com', handle: 'nachtschatten.bar', name: 'Nachtschatten', account_type: 'bar', headline: '', workplace: '', bio: 'Speakeasy in Kreuzberg. Saisonale Karte, über 200 Spirituosen.', city: 'Berlin', website: null, verified: true },
  { id: P.ochsen, email: 'ochsen@example.com', handle: 'goldener.ochse', name: 'Zum Goldenen Ochsen', account_type: 'restaurant', headline: '', workplace: '', bio: 'Gehobene bayerische Küche mit 400 Weinen auf der Karte.', city: 'München', website: null, verified: false },
  { id: P.rebe, email: 'rebe@example.com', handle: 'rebeundreife', name: 'Rebe & Reife', account_type: 'bar', headline: '', workplace: '', bio: 'Naturweinbar mit kleinen Tellern im Schanzenviertel.', city: 'Hamburg', website: null, verified: false },
  { id: P.lena, email: 'lena@example.com', handle: 'lena.somm', name: 'Lena Brandt', account_type: 'gastro', headline: 'Chef-Sommelière', workplace: 'Zum Goldenen Ochsen', bio: 'Riesling-Nerd. WSET Diploma.', city: 'München', website: null, verified: false },
  { id: P.max, email: 'max@example.com', handle: 'maxmixes', name: 'Max Keller', account_type: 'gastro', headline: 'Head Bartender', workplace: 'Nachtschatten', bio: 'Klassiker neu gedacht. Fermentation und Kräuter.', city: 'Berlin', website: null, verified: false },
  { id: P.sofia, email: 'sofia@example.com', handle: 'sofia_drams', name: 'Sofia Weiß', account_type: 'privat', headline: '', workplace: '', bio: 'Single Malt, Islay und Torf. Hobby-Tasterin.', city: 'Köln', website: null, verified: false },
]

export const seedVenues: SeedVenue[] = [
  { id: V.nachtschatten, owner_id: P.nachtschatten, name: 'Nachtschatten', type: 'cocktailbar', address: 'Oranienstraße 12', city: 'Berlin', latitude: 52.5016, longitude: 13.4189, description: 'Speakeasy mit saisonaler Cocktailkarte und über 200 Spirituosen.', website: null, phone: null },
  { id: V.kupfer, owner_id: null, name: 'Kupferkessel', type: 'bar', address: 'Weinbergsweg 4', city: 'Berlin', latitude: 52.5308, longitude: 13.4016, description: 'Whisky- und Brandbar mit deutschem Schwerpunkt.', website: null, phone: null },
  { id: V.spree, owner_id: null, name: 'Spreeblick Weinstube', type: 'weinbar', address: 'Am Kupfergraben 2', city: 'Berlin', latitude: 52.5208, longitude: 13.3955, description: 'Offene Weine aus Deutschland und Österreich.', website: null, phone: null },
  { id: V.rebe, owner_id: P.rebe, name: 'Rebe & Reife', type: 'weinbar', address: 'Schanzenstraße 45', city: 'Hamburg', latitude: 53.5622, longitude: 9.9636, description: 'Naturweine, offene Flaschen und kleine Teller.', website: null, phone: null },
  { id: V.hafen, owner_id: null, name: 'Hafenkante', type: 'restaurant', address: 'St. Pauli Hafenstraße 88', city: 'Hamburg', latitude: 53.5455, longitude: 9.9655, description: 'Fisch und Meeresfrüchte, große Weißweinkarte.', website: null, phone: null },
  { id: V.schanze, owner_id: null, name: 'Tidenhub', type: 'cocktailbar', address: 'Susannenstraße 20', city: 'Hamburg', latitude: 53.5627, longitude: 9.9616, description: 'Kleine Cocktailbar mit Fokus auf Rum.', website: null, phone: null },
  { id: V.ochsen, owner_id: P.ochsen, name: 'Zum Goldenen Ochsen', type: 'restaurant', address: 'Sendlinger Straße 8', city: 'München', latitude: 48.1355, longitude: 11.5707, description: 'Bayerische Küche, gehoben. Weinbegleitung mit 400 Positionen.', website: null, phone: null },
  { id: V.isar, owner_id: null, name: 'Isarlicht', type: 'bar', address: 'Reichenbachstraße 15', city: 'München', latitude: 48.1318, longitude: 11.5771, description: 'Gin-Bar mit über 150 Sorten.', website: null, phone: null },
  { id: V.hotel, owner_id: null, name: 'Bar im Hotel Residenz', type: 'hotelbar', address: 'Maximilianstraße 30', city: 'München', latitude: 48.1394, longitude: 11.5841, description: 'Klassische Hotelbar mit Pianist am Wochenende.', website: null, phone: null },
  { id: V.dom, owner_id: null, name: 'Domblick', type: 'restaurant', address: 'Am Hof 20', city: 'Köln', latitude: 50.9397, longitude: 6.9591, description: 'Rheinische Küche mit Weinen von Mosel, Ahr und Mittelrhein.', website: null, phone: null },
  { id: V.ehrenfeld, owner_id: null, name: 'Fass 7', type: 'bar', address: 'Venloer Straße 300', city: 'Köln', latitude: 50.9508, longitude: 6.9167, description: 'Craft-Bier und Spirituosen in Ehrenfeld.', website: null, phone: null },
  { id: V.main, owner_id: null, name: 'Mainufer', type: 'weinbar', address: 'Schaumainkai 50', city: 'Frankfurt am Main', latitude: 50.1052, longitude: 8.6766, description: 'Weinbar mit Blick auf die Skyline.', website: null, phone: null },
  { id: V.sachsenhausen, owner_id: null, name: 'Apfelwein & Söhne', type: 'restaurant', address: 'Große Rittergasse 10', city: 'Frankfurt am Main', latitude: 50.1029, longitude: 8.6879, description: 'Traditionelles Apfelweinlokal, neu interpretiert.', website: null, phone: null },
  { id: V.kö, owner_id: null, name: 'Silberbar', type: 'cocktailbar', address: 'Königsallee 60', city: 'Düsseldorf', latitude: 51.2203, longitude: 6.7793, description: 'Elegante Cocktailbar, Signature Drinks mit Champagner.', website: null, phone: null },
  { id: V.leipzig, owner_id: null, name: 'Barfußgässchen 3', type: 'bar', address: 'Barfußgässchen 3', city: 'Leipzig', latitude: 51.3407, longitude: 12.3728, description: 'Gemütliche Bar in der Altstadt mit Fokus auf Whisky.', website: null, phone: null },
  { id: V.stuttgart, owner_id: null, name: 'Trollinger Stube', type: 'weinbar', address: 'Hans-im-Glück-Brunnen 1', city: 'Stuttgart', latitude: 48.7766, longitude: 9.1757, description: 'Württemberger Weine und Maultaschen.', website: null, phone: null },
]

export const seedPosts: SeedPost[] = [
  { id: id(201), author_id: P.alpenbrand, kind: 'neuheit', title: 'Alpenbrand Zirbe Dry Gin', body: 'Unser neuer Gin mit Zirbenzapfen und Bergwacholder ist ab 1. Dezember bei allen Partnern im Großhandel erhältlich. Gastro-Muster gibt es auf Anfrage.', category: 'spirituosen', link_url: 'https://example.com/alpenbrand', venue_id: null, hoursAgo: 1 },
  { id: id(202), author_id: P.max, kind: 'beitrag', title: null, body: 'Neu auf unserer Winterkarte: Smoked Rosemary Negroni. Gin, Campari, Wermut und ein abgeflammter Rosmarinzweig.', category: 'cocktails', link_url: null, venue_id: V.nachtschatten, hoursAgo: 3 },
  { id: id(203), author_id: P.nordlicht, kind: 'angebot', title: 'Winteraktion für Gastro-Kunden', body: 'Bis Jahresende 8 % Rabatt auf alle Rum- und Whisky-Bestellungen ab 24 Flaschen. Lieferung in Hamburg und Schleswig-Holstein innerhalb von 48 Stunden.', category: 'spirituosen', link_url: null, venue_id: null, hoursAgo: 5 },
  { id: id(204), author_id: P.nachtschatten, kind: 'job', title: 'Bartender:in (Vollzeit) gesucht', body: 'Wir suchen ab Januar Verstärkung hinter dem Tresen. Erfahrung mit Klassikern, Lust auf Fermentation und ein gutes Team. Bewerbung per Direktnachricht oder E-Mail.', category: 'gastronomie', link_url: null, venue_id: V.nachtschatten, hoursAgo: 8 },
  { id: id(205), author_id: P.lena, kind: 'beitrag', title: null, body: 'Riesling Spätlese Alte Reben 2019 vom Weingut Schieferhang zum Rehrücken. Steinobst, Petrol und eine Säure wie ein Uhrwerk.', category: 'wein', link_url: null, venue_id: V.ochsen, hoursAgo: 20 },
  { id: id(206), author_id: P.schieferhang, kind: 'event', title: 'Jahrgangspräsentation 2025 am 14. Dezember', body: 'Wir öffnen den Keller: Fassproben des Jahrgangs 2025, Steillagen-Führung und Winzervesper. Für Fachbesucher kostenlos, Anmeldung erforderlich.', category: 'wein', link_url: null, venue_id: null, hoursAgo: 26 },
  { id: id(207), author_id: P.rheinkeller, kind: 'neuheit', title: 'Neu im Sortiment: Grüner Veltliner aus dem Kamptal', body: 'Drei Lagenweine eines jungen Winzerpaares sind ab sofort bei uns gelistet. Ideal für die glasweise Ausschank. Preisliste für Gastronomie auf Anfrage.', category: 'wein', link_url: null, venue_id: null, hoursAgo: 30 },
  { id: id(208), author_id: P.sofia, kind: 'beitrag', title: null, body: 'Gestern im Kupferkessel einen 12-jährigen Single Malt aus Bayern probiert. Hätte nie gedacht, dass deutscher Whisky so gut sein kann.', category: 'spirituosen', link_url: null, venue_id: V.kupfer, hoursAgo: 40 },
  { id: id(209), author_id: P.waldbrand, kind: 'neuheit', title: 'Alkoholfreier Kräuteraperitif', body: 'Nach zwei Jahren Entwicklung: unser erster alkoholfreier Aperitif mit Schwarzwälder Tannenspitzen. Funktioniert pur auf Eis oder als Spritz.', category: 'alkoholfrei', link_url: null, venue_id: null, hoursAgo: 52 },
  { id: id(210), author_id: P.rebe, kind: 'event', title: 'Naturwein-Abend mit Winzer:innen aus dem Burgenland', body: 'Am Freitag ab 19 Uhr schenken drei Weingüter selbst aus. Kleine Teller aus der Küche, Eintritt frei.', category: 'wein', link_url: null, venue_id: V.rebe, hoursAgo: 70 },
  { id: id(211), author_id: P.ochsen, kind: 'job', title: 'Commis de Rang und Sommelier-Assistenz', body: 'Für unser Restaurant suchen wir zwei Kolleg:innen im Service. Interesse an Wein ist ein Muss, Weiterbildungen bezahlen wir.', category: 'gastronomie', link_url: null, venue_id: V.ochsen, hoursAgo: 96 },
  { id: id(212), author_id: P.max, kind: 'beitrag', title: null, body: 'Tipp für alle Kolleg:innen: Zitronenschalen-Oleo-Saccharum hält sich vakuumiert locker zwei Wochen. Spart enorm Zeit im Service.', category: 'cocktails', link_url: null, venue_id: null, hoursAgo: 120 },
]

export const seedFollows: [string, string][] = [
  [P.demo, P.max], [P.demo, P.lena], [P.demo, P.alpenbrand], [P.demo, P.nordlicht], [P.demo, P.nachtschatten],
  [P.max, P.demo], [P.lena, P.schieferhang], [P.lena, P.rheinkeller], [P.sofia, P.demo], [P.sofia, P.alpenbrand],
  [P.max, P.alpenbrand], [P.rebe, P.rheinkeller],
]

export const seedLikes: [string, string][] = [
  [id(201), P.max], [id(201), P.lena], [id(201), P.sofia], [id(202), P.demo], [id(202), P.sofia],
  [id(203), P.max], [id(205), P.schieferhang], [id(205), P.demo], [id(206), P.lena], [id(207), P.lena],
  [id(208), P.demo], [id(209), P.max], [id(210), P.lena], [id(212), P.demo], [id(212), P.lena],
]

export const seedComments: { id: string; post_id: string; author_id: string; body: string; hoursAgo: number }[] = [
  { id: id(301), post_id: id(201), author_id: P.max, body: 'Muster bitte an uns! Klingt perfekt für einen Winter-Martini.', hoursAgo: 0.5 },
  { id: id(302), post_id: id(205), author_id: P.schieferhang, body: 'Danke für die schöne Empfehlung, Lena!', hoursAgo: 18 },
  { id: id(303), post_id: id(204), author_id: P.demo, body: 'Kenne jemanden, schicke ich euch rüber.', hoursAgo: 6 },
]
