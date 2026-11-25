// Beispieldaten für den Demo-Modus und für supabase/seed.sql (erzeugt über scripts/generate-seed.ts).
// Alle Betriebe, Marken und Personen sind frei erfunden.
import type { AccountType, Category, PostKind, Recipe, StoryOverlay, Template, Track, VenueType } from './types'

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
  certificates?: string[]
  skills?: string[]
  stations?: string[]
  open_to_work?: boolean
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
  opens?: string
  closes?: string
  happy_hour?: string
  reservation_url?: string
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
  /** Schlüssel aus demo-media.ts (nur Demo-Modus) */
  media?: string[]
  video?: string
  music?: Track
  rating?: number
  aromas?: string[]
  product_id?: string
  recipe?: Recipe
  remix_of?: string
  collab_id?: string
  group_id?: string
  urgent?: boolean
  template?: Template
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
  { id: P.demo, email: 'demo@example.com', handle: 'jonas.hartmann', name: 'Jonas Hartmann', account_type: 'gastro', headline: 'Barmanager', workplace: 'Kupferkessel', bio: 'Zehn Jahre hinter dem Tresen, Fokus auf deutsche Spirituosen.', city: 'Berlin', website: null, verified: false, certificates: ['WSET Level 2 Spirits', 'Barkeeper-Ausbildung IHK'], skills: ['Klassiker', 'Barmanagement', 'Deutsche Spirituosen'], stations: ['Kupferkessel, Berlin · seit 2021', 'Hotelbar Residenz, München · 2017–2021'] },
  { id: P.rheinkeller, email: 'rheinkeller@example.com', handle: 'rheinkeller', name: 'Rheinkeller Weinhandel', account_type: 'haendler', headline: '', workplace: '', bio: 'Weinfachhandel und Gastro-Belieferung seit 1987. Über 1.200 Positionen.', city: 'Köln', website: 'https://example.com/rheinkeller', verified: true },
  { id: P.nordlicht, email: 'nordlicht@example.com', handle: 'nordlicht.getraenke', name: 'Nordlicht Getränkegroßhandel', account_type: 'lieferant', headline: '', workplace: '', bio: 'Großhandel für Gastronomie in Norddeutschland. Spirituosen, Wein, Bier, Alkoholfreies.', city: 'Hamburg', website: 'https://example.com/nordlicht', verified: true },
  { id: P.alpenbrand, email: 'alpenbrand@example.com', handle: 'alpenbrand', name: 'Alpenbrand Spirituosen', account_type: 'marke', headline: '', workplace: '', bio: 'Gin, Kräuterlikör und Obstbrände aus den bayerischen Alpen.', city: 'München', website: 'https://example.com/alpenbrand', verified: true },
  { id: P.schieferhang, email: 'schieferhang@example.com', handle: 'weingut.schieferhang', name: 'Weingut Schieferhang', account_type: 'marke', headline: '', workplace: '', bio: 'Familienweingut in fünfter Generation. Steillagen-Riesling von der Mosel.', city: 'Bernkastel-Kues', website: null, verified: true },
  { id: P.waldbrand, email: 'waldbrand@example.com', handle: 'waldbrand.destille', name: 'Waldbrand Destillerie', account_type: 'marke', headline: '', workplace: '', bio: 'Kleine Brennerei im Schwarzwald. Tastings jeden Samstag.', city: 'Freiburg', website: null, verified: false },
  { id: P.nachtschatten, email: 'nachtschatten@example.com', handle: 'nachtschatten.bar', name: 'Nachtschatten', account_type: 'bar', headline: '', workplace: '', bio: 'Speakeasy in Kreuzberg. Saisonale Karte, über 200 Spirituosen.', city: 'Berlin', website: null, verified: true },
  { id: P.ochsen, email: 'ochsen@example.com', handle: 'goldener.ochse', name: 'Zum Goldenen Ochsen', account_type: 'restaurant', headline: '', workplace: '', bio: 'Gehobene bayerische Küche mit 400 Weinen auf der Karte.', city: 'München', website: null, verified: false },
  { id: P.rebe, email: 'rebe@example.com', handle: 'rebeundreife', name: 'Rebe & Reife', account_type: 'bar', headline: '', workplace: '', bio: 'Naturweinbar mit kleinen Tellern im Schanzenviertel.', city: 'Hamburg', website: null, verified: false },
  { id: P.lena, email: 'lena@example.com', handle: 'lena.somm', name: 'Lena Brandt', account_type: 'gastro', headline: 'Chef-Sommelière', workplace: 'Zum Goldenen Ochsen', bio: 'Riesling-Nerd. WSET Diploma.', city: 'München', website: null, verified: false, certificates: ['WSET Diploma', 'Sommelière IHK'], skills: ['Riesling', 'Weinbegleitung', 'Einkauf'], stations: ['Zum Goldenen Ochsen · seit 2020'] },
  { id: P.max, email: 'max@example.com', handle: 'maxmixes', name: 'Max Keller', account_type: 'gastro', headline: 'Head Bartender', workplace: 'Nachtschatten', bio: 'Klassiker neu gedacht. Fermentation und Kräuter.', city: 'Berlin', website: null, verified: false, skills: ['Fermentation', 'Signature Drinks', 'Speed-Service'], stations: ['Nachtschatten · seit 2022'], open_to_work: true },
  { id: P.sofia, email: 'sofia@example.com', handle: 'sofia_drams', name: 'Sofia Weiß', account_type: 'privat', headline: '', workplace: '', bio: 'Single Malt, Islay und Torf. Hobby-Tasterin.', city: 'Köln', website: null, verified: false },
]

export const seedVenues: SeedVenue[] = [
  { id: V.nachtschatten, owner_id: P.nachtschatten, name: 'Nachtschatten', type: 'cocktailbar', address: 'Oranienstraße 12', city: 'Berlin', latitude: 52.5016, longitude: 13.4189, description: 'Speakeasy mit saisonaler Cocktailkarte und über 200 Spirituosen.', website: null, phone: '+49 30 0000000', opens: '19:00', closes: '03:00', happy_hour: 'Mo–Do 19–20 Uhr: Klassiker 9 €', reservation_url: 'https://example.com/nachtschatten/reservieren' },
  { id: V.kupfer, owner_id: null, name: 'Kupferkessel', type: 'bar', address: 'Weinbergsweg 4', city: 'Berlin', latitude: 52.5308, longitude: 13.4016, description: 'Whisky- und Brandbar mit deutschem Schwerpunkt.', website: null, phone: null, opens: '18:00', closes: '02:00', happy_hour: 'Täglich 18–19 Uhr: Whisky-Flight 15 €' },
  { id: V.spree, owner_id: null, name: 'Spreeblick Weinstube', type: 'weinbar', address: 'Am Kupfergraben 2', city: 'Berlin', latitude: 52.5208, longitude: 13.3955, description: 'Offene Weine aus Deutschland und Österreich.', website: null, phone: null, opens: '16:00', closes: '00:00' },
  { id: V.rebe, owner_id: P.rebe, name: 'Rebe & Reife', type: 'weinbar', address: 'Schanzenstraße 45', city: 'Hamburg', latitude: 53.5622, longitude: 9.9636, description: 'Naturweine, offene Flaschen und kleine Teller.', website: null, phone: null, opens: '17:00', closes: '01:00' },
  { id: V.hafen, owner_id: null, name: 'Hafenkante', type: 'restaurant', address: 'St. Pauli Hafenstraße 88', city: 'Hamburg', latitude: 53.5455, longitude: 9.9655, description: 'Fisch und Meeresfrüchte, große Weißweinkarte.', website: null, phone: null },
  { id: V.schanze, owner_id: null, name: 'Tidenhub', type: 'cocktailbar', address: 'Susannenstraße 20', city: 'Hamburg', latitude: 53.5627, longitude: 9.9616, description: 'Kleine Cocktailbar mit Fokus auf Rum.', website: null, phone: null },
  { id: V.ochsen, owner_id: P.ochsen, name: 'Zum Goldenen Ochsen', type: 'restaurant', address: 'Sendlinger Straße 8', city: 'München', latitude: 48.1355, longitude: 11.5707, description: 'Bayerische Küche, gehoben. Weinbegleitung mit 400 Positionen.', website: null, phone: '+49 89 0000000', opens: '12:00', closes: '23:00', reservation_url: 'https://example.com/ochsen/tisch' },
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

export const PR = { zirbe: id(801), riesling: id(802), haferbrand: id(803), tannenspitz: id(804), negroni: id(805) }
export const G = { berlinBar: id(901), sommeliers: id(902), gin: id(903), tasting: id(904) }

export const seedProducts: { id: string; name: string; brand_id: string | null; brand_name: string; category: Category; description: string; shop_url: string | null }[] = [
  { id: PR.zirbe, name: 'Zirbe Dry Gin', brand_id: P.alpenbrand, brand_name: 'Alpenbrand Spirituosen', category: 'spirituosen', description: 'Dry Gin mit Zirbenzapfen und Bergwacholder, 43 % vol.', shop_url: 'https://example.com/alpenbrand/zirbe' },
  { id: PR.riesling, name: 'Riesling Spätlese Alte Reben 2019', brand_id: P.schieferhang, brand_name: 'Weingut Schieferhang', category: 'wein', description: 'Steillage, Blauschiefer, 60 Jahre alte Reben.', shop_url: null },
  { id: PR.haferbrand, name: 'Haferbrand 5 Jahre', brand_id: null, brand_name: 'Brennerei Uckermark', category: 'spirituosen', description: 'Fassgereifter Brand aus Brandenburger Hafer.', shop_url: null },
  { id: PR.tannenspitz, name: 'Tannenspitz Aperitif 0,0 %', brand_id: P.waldbrand, brand_name: 'Waldbrand Destillerie', category: 'alkoholfrei', description: 'Alkoholfreier Kräuteraperitif mit Schwarzwälder Tannenspitzen.', shop_url: null },
]

export const seedGroups: { id: string; name: string; description: string; city: string; emoji: string; startsInHours: number | null; created_by: string; members: string[] }[] = [
  { id: G.berlinBar, name: 'Bar-Szene Berlin', description: 'Austausch für alle, die in Berlin hinter dem Tresen stehen: Jobs, Lieferanten, Feierabend-Tipps.', city: 'Berlin', emoji: '🍸', startsInHours: null, created_by: P.max, members: [P.max, P.demo, P.nachtschatten] },
  { id: G.sommeliers, name: 'Sommeliers Deutschland', description: 'Weinwissen, Prüfungsvorbereitung und Verkostungen.', city: '', emoji: '🍷', startsInHours: null, created_by: P.lena, members: [P.lena, P.schieferhang, P.rheinkeller] },
  { id: G.gin, name: 'Craft-Gin-Fans', description: 'Neue Gins, Tonics und Garnituren. Für Profis und Genießer.', city: '', emoji: '🌿', startsInHours: null, created_by: P.alpenbrand, members: [P.alpenbrand, P.sofia, P.demo] },
  { id: G.tasting, name: 'Live-Tasting: Riesling aus der Steillage', description: 'Lena verkostet mit dem Weingut Schieferhang sechs Rieslinge. Stellt eure Fragen hier im Raum.', city: '', emoji: '🥂', startsInHours: 26, created_by: P.schieferhang, members: [P.schieferhang, P.lena] },
]

export const seedPosts: SeedPost[] = [
  { id: id(201), author_id: P.alpenbrand, kind: 'neuheit', title: 'Alpenbrand Zirbe Dry Gin', body: 'Unser neuer Gin mit Zirbenzapfen und Bergwacholder ist ab 1. Dezember bei allen Partnern im Großhandel erhältlich. Gastro-Muster gibt es auf Anfrage.', category: 'spirituosen', link_url: 'https://example.com/alpenbrand', venue_id: null, media: ['gintonic-post'], hoursAgo: 1 },
  { id: id(202), author_id: P.max, kind: 'beitrag', title: null, body: 'Neu auf unserer Winterkarte: Smoked Rosemary Negroni. Gin, Campari, Wermut und ein abgeflammter Rosmarinzweig.', category: 'cocktails', link_url: null, venue_id: V.nachtschatten, media: ['negroni-post', 'bar-post'], hoursAgo: 3 },
  { id: id(203), author_id: P.nordlicht, kind: 'angebot', title: 'Winteraktion für Gastro-Kunden', body: 'Bis Jahresende 8 % Rabatt auf alle Rum- und Whisky-Bestellungen ab 24 Flaschen. Lieferung in Hamburg und Schleswig-Holstein innerhalb von 48 Stunden.', category: 'spirituosen', link_url: null, venue_id: null, hoursAgo: 5 },
  { id: id(204), author_id: P.nachtschatten, kind: 'job', title: 'Bartender:in (Vollzeit) gesucht', body: 'Wir suchen ab Januar Verstärkung hinter dem Tresen. Erfahrung mit Klassikern, Lust auf Fermentation und ein gutes Team. Bewerbung per Direktnachricht oder E-Mail.', category: 'gastronomie', link_url: null, venue_id: V.nachtschatten, hoursAgo: 8 },
  { id: id(205), author_id: P.lena, kind: 'beitrag', title: null, body: 'Riesling Spätlese Alte Reben 2019 vom Weingut Schieferhang zum Rehrücken. Steinobst, Petrol und eine Säure wie ein Uhrwerk.', category: 'wein', link_url: null, venue_id: V.ochsen, media: ['weinberg-post'], hoursAgo: 20 },
  { id: id(206), author_id: P.schieferhang, kind: 'event', title: 'Jahrgangspräsentation 2025 am 14. Dezember', body: 'Wir öffnen den Keller: Fassproben des Jahrgangs 2025, Steillagen-Führung und Winzervesper. Für Fachbesucher kostenlos, Anmeldung erforderlich.', category: 'wein', link_url: null, venue_id: null, media: ['keller-post'], hoursAgo: 26 },
  { id: id(207), author_id: P.rheinkeller, kind: 'neuheit', title: 'Neu im Sortiment: Grüner Veltliner aus dem Kamptal', body: 'Drei Lagenweine eines jungen Winzerpaares sind ab sofort bei uns gelistet. Ideal für die glasweise Ausschank. Preisliste für Gastronomie auf Anfrage.', category: 'wein', link_url: null, venue_id: null, media: ['rotwein-post'], hoursAgo: 30 },
  { id: id(208), author_id: P.sofia, kind: 'beitrag', title: null, body: 'Gestern im Kupferkessel einen 12-jährigen Single Malt aus Bayern probiert. Hätte nie gedacht, dass deutscher Whisky so gut sein kann.', category: 'spirituosen', link_url: null, venue_id: V.kupfer, media: ['whisky-post'], hoursAgo: 40 },
  { id: id(209), author_id: P.waldbrand, kind: 'neuheit', title: 'Alkoholfreier Kräuteraperitif', body: 'Nach zwei Jahren Entwicklung: unser erster alkoholfreier Aperitif mit Schwarzwälder Tannenspitzen. Funktioniert pur auf Eis oder als Spritz.', category: 'alkoholfrei', link_url: null, venue_id: null, hoursAgo: 52 },
  { id: id(210), author_id: P.rebe, kind: 'event', title: 'Naturwein-Abend mit Winzer:innen aus dem Burgenland', body: 'Am Freitag ab 19 Uhr schenken drei Weingüter selbst aus. Kleine Teller aus der Küche, Eintritt frei.', category: 'wein', link_url: null, venue_id: V.rebe, media: ['champagner-post'], hoursAgo: 70 },
  { id: id(211), author_id: P.ochsen, kind: 'job', title: 'Commis de Rang und Sommelier-Assistenz', body: 'Für unser Restaurant suchen wir zwei Kolleg:innen im Service. Interesse an Wein ist ein Muss, Weiterbildungen bezahlen wir.', category: 'gastronomie', link_url: null, venue_id: V.ochsen, hoursAgo: 96 },
  { id: id(213), author_id: P.demo, kind: 'beitrag', title: null, body: 'Neue Hausspirituose im Kupferkessel: ein 5 Jahre alter Haferbrand aus Brandenburg. Wer kennt ähnliche Projekte?', category: 'spirituosen', link_url: null, venue_id: V.kupfer, media: ['keller-post'], hoursAgo: 14 },
  { id: id(214), author_id: P.max, kind: 'beitrag', title: null, body: 'Smoked Rosemary Negroni in 6 Sekunden 🔥 #negroni #cocktails', category: 'cocktails', link_url: null, venue_id: V.nachtschatten, hoursAgo: 4, media: ['negroni-reel-thumb'], video: 'negroni-reel', music: { id: 'demo-track-2', title: 'Negroni Sunset', artist: 'Lisa Marlowe', cover_url: null, spotify_url: null, preview_url: null } },
  { id: id(215), author_id: P.alpenbrand, kind: 'neuheit', title: 'Zirbe & Tonic', body: 'So schmeckt der Winter: Zirbe Dry Gin mit Tonic und Limette. #gin #neuheit', category: 'spirituosen', link_url: null, venue_id: null, hoursAgo: 9, media: ['gintonic-reel-thumb'], video: 'gintonic-reel' },
  { id: id(216), author_id: P.nachtschatten, kind: 'beitrag', title: null, body: 'Freitagabend im Nachtschatten. Wir sehen uns ab 20 Uhr! #bar #berlin', category: 'cocktails', link_url: null, venue_id: V.nachtschatten, hoursAgo: 28, media: ['bar-reel-thumb'], video: 'bar-reel', music: { id: 'demo-track-5', title: 'Last Call', artist: 'The Backbar Band', cover_url: null, spotify_url: null, preview_url: null } },
  { id: id(220), author_id: P.sofia, kind: 'checkin', title: null, body: 'Zirbe & Tonic mit Gurke. Harzig, frisch, sehr rund.', category: 'spirituosen', link_url: null, venue_id: V.isar, hoursAgo: 2, rating: 5, aromas: ['harzig', 'frisch', 'zitrisch'], product_id: PR.zirbe, media: ['gintonic-post'] },
  { id: id(221), author_id: P.max, kind: 'checkin', title: null, body: 'Nach der Schicht noch ein Glas Riesling.', category: 'wein', link_url: null, venue_id: V.spree, hoursAgo: 1.5, rating: 4, aromas: ['mineralisch', 'Steinobst'], product_id: PR.riesling },
  { id: id(222), author_id: P.demo, kind: 'checkin', title: null, body: 'Haferbrand pur, leicht gekühlt. Getreide, Honig, ein Hauch Vanille.', category: 'spirituosen', link_url: null, venue_id: V.kupfer, hoursAgo: 30, rating: 4, aromas: ['Honig', 'Vanille', 'getreidig'], product_id: PR.haferbrand },
  { id: id(223), author_id: P.demo, kind: 'checkin', title: null, body: 'Negroni-Klassiker im Nachtschatten. Perfekt balanciert.', category: 'cocktails', link_url: null, venue_id: V.nachtschatten, hoursAgo: 60, rating: 5, aromas: ['bitter', 'Orange'] },
  { id: id(224), author_id: P.lena, kind: 'checkin', title: null, body: 'Ein Klassiker, der immer passt.', category: 'wein', link_url: null, venue_id: V.ochsen, hoursAgo: 48, rating: 5, aromas: ['Petrol', 'Steinobst', 'mineralisch'], product_id: PR.riesling },
  { id: id(225), author_id: P.max, kind: 'rezept', title: 'Smoked Rosemary Negroni', body: 'Unser Signature von der Winterkarte zum Nachmixen. Zeigt mir eure Version! #negroni', category: 'cocktails', link_url: null, venue_id: V.nachtschatten, hoursAgo: 11, media: ['negroni-post'], recipe: { ingredients: [{ name: 'Gin', amount: '30 ml' }, { name: 'Campari', amount: '30 ml' }, { name: 'Roter Wermut', amount: '30 ml' }, { name: 'Rosmarinzweig', amount: '1' }, { name: 'Orangenzeste', amount: '1' }], steps: ['Rosmarin kurz abflammen und das Glas damit ausräuchern.', 'Gin, Campari und Wermut auf Eis 20 Sekunden rühren.', 'Auf einen großen Eiswürfel abseihen.', 'Mit Orangenzeste und Rosmarin garnieren.'] } },
  { id: id(226), author_id: P.demo, kind: 'beitrag', title: null, body: 'Nachgemixt: der Smoked Rosemary Negroni mit unserem Haferbrand statt Gin. Spannend erdig! #negroni', category: 'cocktails', link_url: null, venue_id: V.kupfer, hoursAgo: 7, remix_of: id(225), media: ['bar-post'] },
  { id: id(227), author_id: P.alpenbrand, kind: 'event', title: 'Zirbe-Abend im Isarlicht', body: 'Gemeinsam mit dem Isarlicht: vier Gin-Drinks mit Zirbe, DJ und Brotzeit. Donnerstag ab 19 Uhr.', category: 'spirituosen', link_url: null, venue_id: V.isar, hoursAgo: 6, collab_id: P.ochsen, template: 'plakat' },
  { id: id(228), author_id: P.nachtschatten, kind: 'job', title: 'Aushilfe für heute Abend gesucht', body: 'Krankheitsfall: Wer kann heute ab 19 Uhr hinter der Bar aushelfen? Bezahlung sofort.', category: 'gastronomie', link_url: null, venue_id: V.nachtschatten, hoursAgo: 0.7, urgent: true },
  { id: id(229), author_id: P.ochsen, kind: 'angebot', title: 'Mittagskarte diese Woche', body: 'Kalbsrahmgulasch mit Spätzle · Forelle Müllerin · Kaiserschmarrn. Dazu ein Glas Silvaner für 6 €.', category: 'gastronomie', link_url: null, venue_id: V.ochsen, hoursAgo: 15, template: 'karte' },
  { id: id(230), author_id: P.max, kind: 'beitrag', title: null, body: 'Wer kennt einen guten Lieferanten für Bio-Zitrusfrüchte in Berlin?', category: 'gastronomie', link_url: null, venue_id: null, hoursAgo: 3, group_id: G.berlinBar },
  { id: id(231), author_id: P.lena, kind: 'beitrag', title: null, body: 'Fragen für Freitag gern schon hier sammeln. Wir verkosten sechs Lagen von 2015 bis 2023.', category: 'wein', link_url: null, venue_id: null, hoursAgo: 5, group_id: G.tasting },
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
  [id(213), P.max], [id(213), P.sofia], [id(213), P.lena],
  [id(225), P.demo], [id(225), P.lena], [id(225), P.sofia], [id(220), P.max], [id(226), P.max],
]

export const seedComments: { id: string; post_id: string; author_id: string; body: string; hoursAgo: number }[] = [
  { id: id(301), post_id: id(201), author_id: P.max, body: 'Muster bitte an uns! Klingt perfekt für einen Winter-Martini.', hoursAgo: 0.5 },
  { id: id(302), post_id: id(205), author_id: P.schieferhang, body: 'Danke für die schöne Empfehlung, Lena!', hoursAgo: 18 },
  { id: id(303), post_id: id(204), author_id: P.demo, body: 'Kenne jemanden, schicke ich euch rüber.', hoursAgo: 6 },
  { id: id(304), post_id: id(213), author_id: P.max, body: 'Spannend! Bring mal eine Flasche mit.', hoursAgo: 10 },
]

/** Unterhaltungen mit Nachrichten (Absender, Text, vor wie vielen Stunden) */
export const seedConversations: { id: string; members: [string, string]; messages: [string, string, number][] }[] = [
  {
    id: id(401), members: [P.demo, P.max], messages: [
      [P.max, 'Hey Jonas, danke für den Tipp mit der Stelle!', 7],
      [P.demo, 'Gern. Sie meldet sich die Tage bei euch.', 6.5],
      [P.max, 'Top. Kommst du Freitag zum Tasting?', 2],
    ],
  },
  {
    id: id(402), members: [P.demo, P.nordlicht], messages: [
      [P.nordlicht, 'Hallo Herr Hartmann, anbei wie besprochen unsere aktuelle Gastro-Preisliste. Die Winteraktion gilt bis 31.12.', 20],
    ],
  },
]

/** Storys der letzten 24 Stunden (nur Demo-Modus) */
export const seedStories: { id: string; author_id: string; media: string; caption: string | null; hoursAgo: number }[] = [
  { id: id(501), author_id: P.nachtschatten, media: 'bar-story', caption: 'Heute DJ ab 22 Uhr 🎶', hoursAgo: 2 },
  { id: id(502), author_id: P.nachtschatten, media: 'negroni-story', caption: 'Drink des Abends', hoursAgo: 1.5 },
  { id: id(503), author_id: P.alpenbrand, media: 'gintonic-story', caption: 'Die Musterpakete sind raus!', hoursAgo: 3 },
  { id: id(504), author_id: P.schieferhang, media: 'weinberg-story', caption: 'Sonnenuntergang über der Steillage', hoursAgo: 5 },
  { id: id(505), author_id: P.lena, media: 'rotwein-story', caption: 'Weinbegleitung für heute Abend steht', hoursAgo: 6 },
  { id: id(506), author_id: P.rebe, media: 'champagner-story', caption: 'Freitag = Schaumwein', hoursAgo: 8 },
  { id: id(507), author_id: P.max, media: 'whisky-story', caption: null, hoursAgo: 10 },
]

/** Erfundene Beispiel-Songs für den Demo-Modus (echte Songs kommen über die Spotify-Suche) */
const track = (n: number, title: string, artist: string): Track => ({ id: `demo-track-${n}`, title, artist, cover_url: null, spotify_url: null, preview_url: null })
export const DEMO_TRACKS: Track[] = [
  track(1, 'Mitternachtsblau', 'Die Kellerkinder'),
  track(2, 'Negroni Sunset', 'Lisa Marlowe'),
  track(3, 'Steillage', 'Mosel Collective'),
  track(4, 'Zirbenduft', 'Alpenglühn'),
  track(5, 'Last Call', 'The Backbar Band'),
  track(6, 'Rosé am Rhein', 'Hanna & die Trauben'),
  track(7, 'Barrique', 'Velvet Oak'),
  track(8, 'Tonic Water', 'Kühl & Klar'),
  track(9, 'Champagnerlaune', 'Perlage'),
  track(10, 'Old Fashioned Love', 'Smokey Joe & the Bitters'),
]

/** Sticker auf einzelnen Beispiel-Storys */
export const seedStoryExtras: Record<string, { music?: Track; overlays?: StoryOverlay[] }> = {
  [id(501)]: { music: DEMO_TRACKS[4], overlays: [{ type: 'music', track: DEMO_TRACKS[4], x: 0.5, y: 0.2 }] },
  [id(503)]: { overlays: [{ type: 'mention', profile_id: P.nordlicht, handle: 'nordlicht.getraenke', x: 0.5, y: 0.78 }] },
  [id(502)]: { overlays: [{ type: 'location', venue_id: V.nachtschatten, name: 'Nachtschatten', x: 0.5, y: 0.15 }] },
  [id(504)]: { music: DEMO_TRACKS[2] },
  [id(505)]: { overlays: [{ type: 'poll', question: 'Riesling oder Silvaner zum Wild?', options: ['Riesling', 'Silvaner'], x: 0.5, y: 0.4 }] },
  [id(506)]: { overlays: [{ type: 'code', label: 'Freitag 10 % auf Schaumwein', code: 'PERLAGE10', x: 0.5, y: 0.7 }, { type: 'link', label: 'Tisch reservieren', url: 'https://example.com/rebe/reservieren', x: 0.5, y: 0.3 }] },
}

/** Ältere (abgelaufene) Storys, die in Highlights stecken */
export const seedArchivedStories: { id: string; author_id: string; media: string; caption: string | null; hoursAgo: number }[] = [
  { id: id(601), author_id: P.nachtschatten, media: 'negroni-story', caption: 'Signature: Smoked Negroni', hoursAgo: 24 * 12 },
  { id: id(602), author_id: P.nachtschatten, media: 'gintonic-story', caption: 'Zirbe & Tonic', hoursAgo: 24 * 11 },
  { id: id(603), author_id: P.nachtschatten, media: 'whisky-story', caption: 'Whisky-Abend', hoursAgo: 24 * 9 },
  { id: id(604), author_id: P.nachtschatten, media: 'bar-story', caption: 'Silvester bei uns', hoursAgo: 24 * 20 },
  { id: id(605), author_id: P.demo, media: 'keller-story', caption: 'Kellerführung', hoursAgo: 24 * 6 },
  { id: id(606), author_id: P.demo, media: 'whisky-story', caption: 'Haferbrand-Tasting', hoursAgo: 24 * 4 },
]

export const seedHighlights: { id: string; owner_id: string; title: string; cover: string; stories: string[] }[] = [
  { id: id(701), owner_id: P.nachtschatten, title: 'Drinks', cover: 'negroni-story', stories: [id(601), id(602), id(603)] },
  { id: id(702), owner_id: P.nachtschatten, title: 'Events', cover: 'bar-story', stories: [id(604)] },
  { id: id(703), owner_id: P.demo, title: 'Kupferkessel', cover: 'keller-story', stories: [id(605), id(606)] },
]
