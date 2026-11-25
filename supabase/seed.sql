-- Automatisch erzeugt aus src/lib/demo-data.ts (npm run seed:generate). Nicht von Hand bearbeiten.
-- Beispieldaten: alle Betriebe, Marken und Personen sind frei erfunden.
-- Die Beispiel-Accounts haben kein nutzbares Passwort (Anmeldung nur über eigene Accounts).

-- Nutzer anlegen; der Trigger on_auth_user_created erzeugt die Profile
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'demo@example.com', '', now(), '{"handle":"jonas.hartmann","name":"Jonas Hartmann","account_type":"gastro","headline":"Barmanager","workplace":"Kupferkessel","city":"Berlin","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rheinkeller@example.com', '', now(), '{"handle":"rheinkeller","name":"Rheinkeller Weinhandel","account_type":"haendler","headline":"","workplace":"","city":"Köln","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'nordlicht@example.com', '', now(), '{"handle":"nordlicht.getraenke","name":"Nordlicht Getränkegroßhandel","account_type":"lieferant","headline":"","workplace":"","city":"Hamburg","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'alpenbrand@example.com', '', now(), '{"handle":"alpenbrand","name":"Alpenbrand Spirituosen","account_type":"marke","headline":"","workplace":"","city":"München","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'schieferhang@example.com', '', now(), '{"handle":"weingut.schieferhang","name":"Weingut Schieferhang","account_type":"marke","headline":"","workplace":"","city":"Bernkastel-Kues","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'waldbrand@example.com', '', now(), '{"handle":"waldbrand.destille","name":"Waldbrand Destillerie","account_type":"marke","headline":"","workplace":"","city":"Freiburg","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'nachtschatten@example.com', '', now(), '{"handle":"nachtschatten.bar","name":"Nachtschatten","account_type":"bar","headline":"","workplace":"","city":"Berlin","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'ochsen@example.com', '', now(), '{"handle":"goldener.ochse","name":"Zum Goldenen Ochsen","account_type":"restaurant","headline":"","workplace":"","city":"München","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000012', 'authenticated', 'authenticated', 'rebe@example.com', '', now(), '{"handle":"rebeundreife","name":"Rebe & Reife","account_type":"bar","headline":"","workplace":"","city":"Hamburg","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000009', 'authenticated', 'authenticated', 'lena@example.com', '', now(), '{"handle":"lena.somm","name":"Lena Brandt","account_type":"gastro","headline":"Chef-Sommelière","workplace":"Zum Goldenen Ochsen","city":"München","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000010', 'authenticated', 'authenticated', 'max@example.com', '', now(), '{"handle":"maxmixes","name":"Max Keller","account_type":"gastro","headline":"Head Bartender","workplace":"Nachtschatten","city":"Berlin","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-8000-000000000011', 'authenticated', 'authenticated', 'sofia@example.com', '', now(), '{"handle":"sofia_drams","name":"Sofia Weiß","account_type":"privat","headline":"","workplace":"","city":"Köln","terms_accepted":true}', '{"provider":"email","providers":["email"]}', now() - interval '90 days', now());

-- Profildetails ergänzen, die der Trigger nicht setzt
update public.profiles set bio = 'Zehn Jahre hinter dem Tresen, Fokus auf deutsche Spirituosen.', website = null, verified = false, certificates = array['WSET Level 2 Spirits', 'Barkeeper-Ausbildung IHK']::text[], skills = array['Klassiker', 'Barmanagement', 'Deutsche Spirituosen']::text[], stations = array['Kupferkessel, Berlin · seit 2021', 'Hotelbar Residenz, München · 2017–2021']::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set bio = 'Weinfachhandel und Gastro-Belieferung seit 1987. Über 1.200 Positionen.', website = 'https://example.com/rheinkeller', verified = true, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set bio = 'Großhandel für Gastronomie in Norddeutschland. Spirituosen, Wein, Bier, Alkoholfreies.', website = 'https://example.com/nordlicht', verified = true, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set bio = 'Gin, Kräuterlikör und Obstbrände aus den bayerischen Alpen.', website = 'https://example.com/alpenbrand', verified = true, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000004';
update public.profiles set bio = 'Familienweingut in fünfter Generation. Steillagen-Riesling von der Mosel.', website = null, verified = true, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000005';
update public.profiles set bio = 'Kleine Brennerei im Schwarzwald. Tastings jeden Samstag.', website = null, verified = false, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000006';
update public.profiles set bio = 'Speakeasy in Kreuzberg. Saisonale Karte, über 200 Spirituosen.', website = null, verified = true, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000007';
update public.profiles set bio = 'Gehobene bayerische Küche mit 400 Weinen auf der Karte.', website = null, verified = false, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000008';
update public.profiles set bio = 'Naturweinbar mit kleinen Tellern im Schanzenviertel.', website = null, verified = false, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000012';
update public.profiles set bio = 'Riesling-Nerd. WSET Diploma.', website = null, verified = false, certificates = array['WSET Diploma', 'Sommelière IHK']::text[], skills = array['Riesling', 'Weinbegleitung', 'Einkauf']::text[], stations = array['Zum Goldenen Ochsen · seit 2020']::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000009';
update public.profiles set bio = 'Klassiker neu gedacht. Fermentation und Kräuter.', website = null, verified = false, certificates = '{}'::text[], skills = array['Fermentation', 'Signature Drinks', 'Speed-Service']::text[], stations = array['Nachtschatten · seit 2022']::text[], open_to_work = true where id = '00000000-0000-4000-8000-000000000010';
update public.profiles set bio = 'Single Malt, Islay und Torf. Hobby-Tasterin.', website = null, verified = false, certificates = '{}'::text[], skills = '{}'::text[], stations = '{}'::text[], open_to_work = false where id = '00000000-0000-4000-8000-000000000011';

insert into public.venues (id, owner_id, name, type, address, city, latitude, longitude, description, website, phone, opens, closes, happy_hour, reservation_url) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000007', 'Nachtschatten', 'cocktailbar', 'Oranienstraße 12', 'Berlin', 52.5016, 13.4189, 'Speakeasy mit saisonaler Cocktailkarte und über 200 Spirituosen.', null, '+49 30 0000000', '19:00', '03:00', 'Mo–Do 19–20 Uhr: Klassiker 9 €', 'https://example.com/nachtschatten/reservieren'),
  ('00000000-0000-4000-8000-000000000104', null, 'Kupferkessel', 'bar', 'Weinbergsweg 4', 'Berlin', 52.5308, 13.4016, 'Whisky- und Brandbar mit deutschem Schwerpunkt.', null, null, '18:00', '02:00', 'Täglich 18–19 Uhr: Whisky-Flight 15 €', null),
  ('00000000-0000-4000-8000-000000000111', null, 'Spreeblick Weinstube', 'weinbar', 'Am Kupfergraben 2', 'Berlin', 52.5208, 13.3955, 'Offene Weine aus Deutschland und Österreich.', null, null, '16:00', '00:00', '', null),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000012', 'Rebe & Reife', 'weinbar', 'Schanzenstraße 45', 'Hamburg', 53.5622, 9.9636, 'Naturweine, offene Flaschen und kleine Teller.', null, null, '17:00', '01:00', '', null),
  ('00000000-0000-4000-8000-000000000105', null, 'Hafenkante', 'restaurant', 'St. Pauli Hafenstraße 88', 'Hamburg', 53.5455, 9.9655, 'Fisch und Meeresfrüchte, große Weißweinkarte.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000112', null, 'Tidenhub', 'cocktailbar', 'Susannenstraße 20', 'Hamburg', 53.5627, 9.9616, 'Kleine Cocktailbar mit Fokus auf Rum.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000008', 'Zum Goldenen Ochsen', 'restaurant', 'Sendlinger Straße 8', 'München', 48.1355, 11.5707, 'Bayerische Küche, gehoben. Weinbegleitung mit 400 Positionen.', null, '+49 89 0000000', '12:00', '23:00', '', 'https://example.com/ochsen/tisch'),
  ('00000000-0000-4000-8000-000000000113', null, 'Isarlicht', 'bar', 'Reichenbachstraße 15', 'München', 48.1318, 11.5771, 'Gin-Bar mit über 150 Sorten.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000116', null, 'Bar im Hotel Residenz', 'hotelbar', 'Maximilianstraße 30', 'München', 48.1394, 11.5841, 'Klassische Hotelbar mit Pianist am Wochenende.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000106', null, 'Domblick', 'restaurant', 'Am Hof 20', 'Köln', 50.9397, 6.9591, 'Rheinische Küche mit Weinen von Mosel, Ahr und Mittelrhein.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000114', null, 'Fass 7', 'bar', 'Venloer Straße 300', 'Köln', 50.9508, 6.9167, 'Craft-Bier und Spirituosen in Ehrenfeld.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000107', null, 'Mainufer', 'weinbar', 'Schaumainkai 50', 'Frankfurt am Main', 50.1052, 8.6766, 'Weinbar mit Blick auf die Skyline.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000115', null, 'Apfelwein & Söhne', 'restaurant', 'Große Rittergasse 10', 'Frankfurt am Main', 50.1029, 8.6879, 'Traditionelles Apfelweinlokal, neu interpretiert.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000108', null, 'Silberbar', 'cocktailbar', 'Königsallee 60', 'Düsseldorf', 51.2203, 6.7793, 'Elegante Cocktailbar, Signature Drinks mit Champagner.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000109', null, 'Barfußgässchen 3', 'bar', 'Barfußgässchen 3', 'Leipzig', 51.3407, 12.3728, 'Gemütliche Bar in der Altstadt mit Fokus auf Whisky.', null, null, null, null, '', null),
  ('00000000-0000-4000-8000-000000000110', null, 'Trollinger Stube', 'weinbar', 'Hans-im-Glück-Brunnen 1', 'Stuttgart', 48.7766, 9.1757, 'Württemberger Weine und Maultaschen.', null, null, null, null, '', null);

insert into public.products (id, name, brand_id, brand_name, category, description, shop_url) values
  ('00000000-0000-4000-8000-000000000801', 'Zirbe Dry Gin', '00000000-0000-4000-8000-000000000004', 'Alpenbrand Spirituosen', 'spirituosen', 'Dry Gin mit Zirbenzapfen und Bergwacholder, 43 % vol.', 'https://example.com/alpenbrand/zirbe'),
  ('00000000-0000-4000-8000-000000000802', 'Riesling Spätlese Alte Reben 2019', '00000000-0000-4000-8000-000000000005', 'Weingut Schieferhang', 'wein', 'Steillage, Blauschiefer, 60 Jahre alte Reben.', null),
  ('00000000-0000-4000-8000-000000000803', 'Haferbrand 5 Jahre', null, 'Brennerei Uckermark', 'spirituosen', 'Fassgereifter Brand aus Brandenburger Hafer.', null),
  ('00000000-0000-4000-8000-000000000804', 'Tannenspitz Aperitif 0,0 %', '00000000-0000-4000-8000-000000000006', 'Waldbrand Destillerie', 'alkoholfrei', 'Alkoholfreier Kräuteraperitif mit Schwarzwälder Tannenspitzen.', null);

insert into public.groups (id, name, description, city, emoji, starts_at, created_by) values
  ('00000000-0000-4000-8000-000000000901', 'Bar-Szene Berlin', 'Austausch für alle, die in Berlin hinter dem Tresen stehen: Jobs, Lieferanten, Feierabend-Tipps.', 'Berlin', '🍸', null, '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000902', 'Sommeliers Deutschland', 'Weinwissen, Prüfungsvorbereitung und Verkostungen.', '', '🍷', null, '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000903', 'Craft-Gin-Fans', 'Neue Gins, Tonics und Garnituren. Für Profis und Genießer.', '', '🌿', null, '00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000904', 'Live-Tasting: Riesling aus der Steillage', 'Lena verkostet mit dem Weingut Schieferhang sechs Rieslinge. Stellt eure Fragen hier im Raum.', '', '🥂', now() + interval '26 hours', '00000000-0000-4000-8000-000000000005');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000901', '00000000-0000-4000-8000-000000000007'),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000902', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000903', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000904', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000904', '00000000-0000-4000-8000-000000000009');

-- Rezepte zuerst, damit „Nachgemixt“-Beiträge darauf verweisen können
insert into public.posts (id, author_id, kind, title, body, category, link_url, venue_id, rating, aromas, product_id, recipe, remix_of, collab_id, group_id, urgent, template, created_at) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000004', 'neuheit', 'Alpenbrand Zirbe Dry Gin', 'Unser neuer Gin mit Zirbenzapfen und Bergwacholder ist ab 1. Dezember bei allen Partnern im Großhandel erhältlich. Gastro-Muster gibt es auf Anfrage.', 'spirituosen', 'https://example.com/alpenbrand', null, null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '1 hours'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000010', 'beitrag', null, 'Neu auf unserer Winterkarte: Smoked Rosemary Negroni. Gin, Campari, Wermut und ein abgeflammter Rosmarinzweig.', 'cocktails', null, '00000000-0000-4000-8000-000000000101', null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '3 hours'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000003', 'angebot', 'Winteraktion für Gastro-Kunden', 'Bis Jahresende 8 % Rabatt auf alle Rum- und Whisky-Bestellungen ab 24 Flaschen. Lieferung in Hamburg und Schleswig-Holstein innerhalb von 48 Stunden.', 'spirituosen', null, null, null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '5 hours'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000007', 'job', 'Bartender:in (Vollzeit) gesucht', 'Wir suchen ab Januar Verstärkung hinter dem Tresen. Erfahrung mit Klassikern, Lust auf Fermentation und ein gutes Team. Bewerbung per Direktnachricht oder E-Mail.', 'gastronomie', null, '00000000-0000-4000-8000-000000000101', null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '8 hours'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000009', 'beitrag', null, 'Riesling Spätlese Alte Reben 2019 vom Weingut Schieferhang zum Rehrücken. Steinobst, Petrol und eine Säure wie ein Uhrwerk.', 'wein', null, '00000000-0000-4000-8000-000000000103', null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '20 hours'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000005', 'event', 'Jahrgangspräsentation 2025 am 14. Dezember', 'Wir öffnen den Keller: Fassproben des Jahrgangs 2025, Steillagen-Führung und Winzervesper. Für Fachbesucher kostenlos, Anmeldung erforderlich.', 'wein', null, null, null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '26 hours'),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000002', 'neuheit', 'Neu im Sortiment: Grüner Veltliner aus dem Kamptal', 'Drei Lagenweine eines jungen Winzerpaares sind ab sofort bei uns gelistet. Ideal für die glasweise Ausschank. Preisliste für Gastronomie auf Anfrage.', 'wein', null, null, null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '30 hours'),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000011', 'beitrag', null, 'Gestern im Kupferkessel einen 12-jährigen Single Malt aus Bayern probiert. Hätte nie gedacht, dass deutscher Whisky so gut sein kann.', 'spirituosen', null, '00000000-0000-4000-8000-000000000104', null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '40 hours'),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000006', 'neuheit', 'Alkoholfreier Kräuteraperitif', 'Nach zwei Jahren Entwicklung: unser erster alkoholfreier Aperitif mit Schwarzwälder Tannenspitzen. Funktioniert pur auf Eis oder als Spritz.', 'alkoholfrei', null, null, null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '52 hours'),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000012', 'event', 'Naturwein-Abend mit Winzer:innen aus dem Burgenland', 'Am Freitag ab 19 Uhr schenken drei Weingüter selbst aus. Kleine Teller aus der Küche, Eintritt frei.', 'wein', null, '00000000-0000-4000-8000-000000000102', null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '70 hours'),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000008', 'job', 'Commis de Rang und Sommelier-Assistenz', 'Für unser Restaurant suchen wir zwei Kolleg:innen im Service. Interesse an Wein ist ein Muss, Weiterbildungen bezahlen wir.', 'gastronomie', null, '00000000-0000-4000-8000-000000000103', null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '96 hours'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000001', 'beitrag', null, 'Neue Hausspirituose im Kupferkessel: ein 5 Jahre alter Haferbrand aus Brandenburg. Wer kennt ähnliche Projekte?', 'spirituosen', null, '00000000-0000-4000-8000-000000000104', null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '14 hours'),
  ('00000000-0000-4000-8000-000000000220', '00000000-0000-4000-8000-000000000011', 'checkin', null, 'Zirbe & Tonic mit Gurke. Harzig, frisch, sehr rund.', 'spirituosen', null, '00000000-0000-4000-8000-000000000113', 5, array['harzig', 'frisch', 'zitrisch']::text[], '00000000-0000-4000-8000-000000000801', null, null, null, null, false, null, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-000000000221', '00000000-0000-4000-8000-000000000010', 'checkin', null, 'Nach der Schicht noch ein Glas Riesling.', 'wein', null, '00000000-0000-4000-8000-000000000111', 4, array['mineralisch', 'Steinobst']::text[], '00000000-0000-4000-8000-000000000802', null, null, null, null, false, null, now() - interval '1.5 hours'),
  ('00000000-0000-4000-8000-000000000222', '00000000-0000-4000-8000-000000000001', 'checkin', null, 'Haferbrand pur, leicht gekühlt. Getreide, Honig, ein Hauch Vanille.', 'spirituosen', null, '00000000-0000-4000-8000-000000000104', 4, array['Honig', 'Vanille', 'getreidig']::text[], '00000000-0000-4000-8000-000000000803', null, null, null, null, false, null, now() - interval '30 hours'),
  ('00000000-0000-4000-8000-000000000223', '00000000-0000-4000-8000-000000000001', 'checkin', null, 'Negroni-Klassiker im Nachtschatten. Perfekt balanciert.', 'cocktails', null, '00000000-0000-4000-8000-000000000101', 5, array['bitter', 'Orange']::text[], null, null, null, null, null, false, null, now() - interval '60 hours'),
  ('00000000-0000-4000-8000-000000000224', '00000000-0000-4000-8000-000000000009', 'checkin', null, 'Ein Klassiker, der immer passt.', 'wein', null, '00000000-0000-4000-8000-000000000103', 5, array['Petrol', 'Steinobst', 'mineralisch']::text[], '00000000-0000-4000-8000-000000000802', null, null, null, null, false, null, now() - interval '48 hours'),
  ('00000000-0000-4000-8000-000000000225', '00000000-0000-4000-8000-000000000010', 'rezept', 'Smoked Rosemary Negroni', 'Unser Signature von der Winterkarte zum Nachmixen. Zeigt mir eure Version! #negroni', 'cocktails', null, '00000000-0000-4000-8000-000000000101', null, '{}'::text[], null, '{"ingredients":[{"name":"Gin","amount":"30 ml"},{"name":"Campari","amount":"30 ml"},{"name":"Roter Wermut","amount":"30 ml"},{"name":"Rosmarinzweig","amount":"1"},{"name":"Orangenzeste","amount":"1"}],"steps":["Rosmarin kurz abflammen und das Glas damit ausräuchern.","Gin, Campari und Wermut auf Eis 20 Sekunden rühren.","Auf einen großen Eiswürfel abseihen.","Mit Orangenzeste und Rosmarin garnieren."]}'::jsonb, null, null, null, false, null, now() - interval '11 hours'),
  ('00000000-0000-4000-8000-000000000227', '00000000-0000-4000-8000-000000000004', 'event', 'Zirbe-Abend im Isarlicht', 'Gemeinsam mit dem Isarlicht: vier Gin-Drinks mit Zirbe, DJ und Brotzeit. Donnerstag ab 19 Uhr.', 'spirituosen', null, '00000000-0000-4000-8000-000000000113', null, '{}'::text[], null, null, null, '00000000-0000-4000-8000-000000000008', null, false, 'plakat', now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000228', '00000000-0000-4000-8000-000000000007', 'job', 'Aushilfe für heute Abend gesucht', 'Krankheitsfall: Wer kann heute ab 19 Uhr hinter der Bar aushelfen? Bezahlung sofort.', 'gastronomie', null, '00000000-0000-4000-8000-000000000101', null, '{}'::text[], null, null, null, null, null, true, null, now() - interval '0.7 hours'),
  ('00000000-0000-4000-8000-000000000229', '00000000-0000-4000-8000-000000000008', 'angebot', 'Mittagskarte diese Woche', 'Kalbsrahmgulasch mit Spätzle · Forelle Müllerin · Kaiserschmarrn. Dazu ein Glas Silvaner für 6 €.', 'gastronomie', null, '00000000-0000-4000-8000-000000000103', null, '{}'::text[], null, null, null, null, null, false, 'karte', now() - interval '15 hours'),
  ('00000000-0000-4000-8000-000000000230', '00000000-0000-4000-8000-000000000010', 'beitrag', null, 'Wer kennt einen guten Lieferanten für Bio-Zitrusfrüchte in Berlin?', 'gastronomie', null, null, null, '{}'::text[], null, null, null, null, '00000000-0000-4000-8000-000000000901', false, null, now() - interval '3 hours'),
  ('00000000-0000-4000-8000-000000000231', '00000000-0000-4000-8000-000000000009', 'beitrag', null, 'Fragen für Freitag gern schon hier sammeln. Wir verkosten sechs Lagen von 2015 bis 2023.', 'wein', null, null, null, '{}'::text[], null, null, null, null, '00000000-0000-4000-8000-000000000904', false, null, now() - interval '5 hours'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000010', 'beitrag', null, 'Tipp für alle Kolleg:innen: Zitronenschalen-Oleo-Saccharum hält sich vakuumiert locker zwei Wochen. Spart enorm Zeit im Service.', 'cocktails', null, null, null, '{}'::text[], null, null, null, null, null, false, null, now() - interval '120 hours'),
  ('00000000-0000-4000-8000-000000000226', '00000000-0000-4000-8000-000000000001', 'beitrag', null, 'Nachgemixt: der Smoked Rosemary Negroni mit unserem Haferbrand statt Gin. Spannend erdig! #negroni', 'cocktails', null, '00000000-0000-4000-8000-000000000104', null, '{}'::text[], null, null, '00000000-0000-4000-8000-000000000225', null, null, false, null, now() - interval '7 hours');

insert into public.follows (follower_id, following_id) values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000007'),
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000002');

insert into public.likes (post_id, user_id) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000005'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000225', '00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000225', '00000000-0000-4000-8000-000000000009'),
  ('00000000-0000-4000-8000-000000000225', '00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000220', '00000000-0000-4000-8000-000000000010'),
  ('00000000-0000-4000-8000-000000000226', '00000000-0000-4000-8000-000000000010');

insert into public.comments (id, post_id, author_id, body, created_at) values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000010', 'Muster bitte an uns! Klingt perfekt für einen Winter-Martini.', now() - interval '0.5 hours'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000005', 'Danke für die schöne Empfehlung, Lena!', now() - interval '18 hours'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'Kenne jemanden, schicke ich euch rüber.', now() - interval '6 hours'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000010', 'Spannend! Bring mal eine Flasche mit.', now() - interval '10 hours');

-- Unterhaltungen (Mitteilungen zu Likes, Kommentaren und Follows erzeugen die Trigger automatisch)
insert into public.conversations (id) values ('00000000-0000-4000-8000-000000000401');
insert into public.conversation_members (conversation_id, user_id, last_read_at) values ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', now() - interval '2.1 hours'), ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000010', now() - interval '2.1 hours');
insert into public.messages (conversation_id, sender_id, body, created_at) values
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000010', 'Hey Jonas, danke für den Tipp mit der Stelle!', now() - interval '7 hours'),
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000001', 'Gern. Sie meldet sich die Tage bei euch.', now() - interval '6.5 hours'),
  ('00000000-0000-4000-8000-000000000401', '00000000-0000-4000-8000-000000000010', 'Top. Kommst du Freitag zum Tasting?', now() - interval '2 hours');
insert into public.conversations (id) values ('00000000-0000-4000-8000-000000000402');
insert into public.conversation_members (conversation_id, user_id, last_read_at) values ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000001', now() - interval '20.1 hours'), ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000003', now() - interval '20.1 hours');
insert into public.messages (conversation_id, sender_id, body, created_at) values
  ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000003', 'Hallo Herr Hartmann, anbei wie besprochen unsere aktuelle Gastro-Preisliste. Die Winteraktion gilt bis 31.12.', now() - interval '20 hours');
