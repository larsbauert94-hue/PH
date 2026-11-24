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
update public.profiles set bio = 'Zehn Jahre hinter dem Tresen, Fokus auf deutsche Spirituosen.', website = null, verified = false where id = '00000000-0000-4000-8000-000000000001';
update public.profiles set bio = 'Weinfachhandel und Gastro-Belieferung seit 1987. Über 1.200 Positionen.', website = 'https://example.com/rheinkeller', verified = true where id = '00000000-0000-4000-8000-000000000002';
update public.profiles set bio = 'Großhandel für Gastronomie in Norddeutschland. Spirituosen, Wein, Bier, Alkoholfreies.', website = 'https://example.com/nordlicht', verified = true where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set bio = 'Gin, Kräuterlikör und Obstbrände aus den bayerischen Alpen.', website = 'https://example.com/alpenbrand', verified = true where id = '00000000-0000-4000-8000-000000000004';
update public.profiles set bio = 'Familienweingut in fünfter Generation. Steillagen-Riesling von der Mosel.', website = null, verified = true where id = '00000000-0000-4000-8000-000000000005';
update public.profiles set bio = 'Kleine Brennerei im Schwarzwald. Tastings jeden Samstag.', website = null, verified = false where id = '00000000-0000-4000-8000-000000000006';
update public.profiles set bio = 'Speakeasy in Kreuzberg. Saisonale Karte, über 200 Spirituosen.', website = null, verified = true where id = '00000000-0000-4000-8000-000000000007';
update public.profiles set bio = 'Gehobene bayerische Küche mit 400 Weinen auf der Karte.', website = null, verified = false where id = '00000000-0000-4000-8000-000000000008';
update public.profiles set bio = 'Naturweinbar mit kleinen Tellern im Schanzenviertel.', website = null, verified = false where id = '00000000-0000-4000-8000-000000000012';
update public.profiles set bio = 'Riesling-Nerd. WSET Diploma.', website = null, verified = false where id = '00000000-0000-4000-8000-000000000009';
update public.profiles set bio = 'Klassiker neu gedacht. Fermentation und Kräuter.', website = null, verified = false where id = '00000000-0000-4000-8000-000000000010';
update public.profiles set bio = 'Single Malt, Islay und Torf. Hobby-Tasterin.', website = null, verified = false where id = '00000000-0000-4000-8000-000000000011';

insert into public.venues (id, owner_id, name, type, address, city, latitude, longitude, description, website, phone) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000007', 'Nachtschatten', 'cocktailbar', 'Oranienstraße 12', 'Berlin', 52.5016, 13.4189, 'Speakeasy mit saisonaler Cocktailkarte und über 200 Spirituosen.', null, null),
  ('00000000-0000-4000-8000-000000000104', null, 'Kupferkessel', 'bar', 'Weinbergsweg 4', 'Berlin', 52.5308, 13.4016, 'Whisky- und Brandbar mit deutschem Schwerpunkt.', null, null),
  ('00000000-0000-4000-8000-000000000111', null, 'Spreeblick Weinstube', 'weinbar', 'Am Kupfergraben 2', 'Berlin', 52.5208, 13.3955, 'Offene Weine aus Deutschland und Österreich.', null, null),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000012', 'Rebe & Reife', 'weinbar', 'Schanzenstraße 45', 'Hamburg', 53.5622, 9.9636, 'Naturweine, offene Flaschen und kleine Teller.', null, null),
  ('00000000-0000-4000-8000-000000000105', null, 'Hafenkante', 'restaurant', 'St. Pauli Hafenstraße 88', 'Hamburg', 53.5455, 9.9655, 'Fisch und Meeresfrüchte, große Weißweinkarte.', null, null),
  ('00000000-0000-4000-8000-000000000112', null, 'Tidenhub', 'cocktailbar', 'Susannenstraße 20', 'Hamburg', 53.5627, 9.9616, 'Kleine Cocktailbar mit Fokus auf Rum.', null, null),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000008', 'Zum Goldenen Ochsen', 'restaurant', 'Sendlinger Straße 8', 'München', 48.1355, 11.5707, 'Bayerische Küche, gehoben. Weinbegleitung mit 400 Positionen.', null, null),
  ('00000000-0000-4000-8000-000000000113', null, 'Isarlicht', 'bar', 'Reichenbachstraße 15', 'München', 48.1318, 11.5771, 'Gin-Bar mit über 150 Sorten.', null, null),
  ('00000000-0000-4000-8000-000000000116', null, 'Bar im Hotel Residenz', 'hotelbar', 'Maximilianstraße 30', 'München', 48.1394, 11.5841, 'Klassische Hotelbar mit Pianist am Wochenende.', null, null),
  ('00000000-0000-4000-8000-000000000106', null, 'Domblick', 'restaurant', 'Am Hof 20', 'Köln', 50.9397, 6.9591, 'Rheinische Küche mit Weinen von Mosel, Ahr und Mittelrhein.', null, null),
  ('00000000-0000-4000-8000-000000000114', null, 'Fass 7', 'bar', 'Venloer Straße 300', 'Köln', 50.9508, 6.9167, 'Craft-Bier und Spirituosen in Ehrenfeld.', null, null),
  ('00000000-0000-4000-8000-000000000107', null, 'Mainufer', 'weinbar', 'Schaumainkai 50', 'Frankfurt am Main', 50.1052, 8.6766, 'Weinbar mit Blick auf die Skyline.', null, null),
  ('00000000-0000-4000-8000-000000000115', null, 'Apfelwein & Söhne', 'restaurant', 'Große Rittergasse 10', 'Frankfurt am Main', 50.1029, 8.6879, 'Traditionelles Apfelweinlokal, neu interpretiert.', null, null),
  ('00000000-0000-4000-8000-000000000108', null, 'Silberbar', 'cocktailbar', 'Königsallee 60', 'Düsseldorf', 51.2203, 6.7793, 'Elegante Cocktailbar, Signature Drinks mit Champagner.', null, null),
  ('00000000-0000-4000-8000-000000000109', null, 'Barfußgässchen 3', 'bar', 'Barfußgässchen 3', 'Leipzig', 51.3407, 12.3728, 'Gemütliche Bar in der Altstadt mit Fokus auf Whisky.', null, null),
  ('00000000-0000-4000-8000-000000000110', null, 'Trollinger Stube', 'weinbar', 'Hans-im-Glück-Brunnen 1', 'Stuttgart', 48.7766, 9.1757, 'Württemberger Weine und Maultaschen.', null, null);

insert into public.posts (id, author_id, kind, title, body, category, link_url, venue_id, created_at) values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000004', 'neuheit', 'Alpenbrand Zirbe Dry Gin', 'Unser neuer Gin mit Zirbenzapfen und Bergwacholder ist ab 1. Dezember bei allen Partnern im Großhandel erhältlich. Gastro-Muster gibt es auf Anfrage.', 'spirituosen', 'https://example.com/alpenbrand', null, now() - interval '1 hours'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000010', 'beitrag', null, 'Neu auf unserer Winterkarte: Smoked Rosemary Negroni. Gin, Campari, Wermut und ein abgeflammter Rosmarinzweig.', 'cocktails', null, '00000000-0000-4000-8000-000000000101', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000003', 'angebot', 'Winteraktion für Gastro-Kunden', 'Bis Jahresende 8 % Rabatt auf alle Rum- und Whisky-Bestellungen ab 24 Flaschen. Lieferung in Hamburg und Schleswig-Holstein innerhalb von 48 Stunden.', 'spirituosen', null, null, now() - interval '5 hours'),
  ('00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000007', 'job', 'Bartender:in (Vollzeit) gesucht', 'Wir suchen ab Januar Verstärkung hinter dem Tresen. Erfahrung mit Klassikern, Lust auf Fermentation und ein gutes Team. Bewerbung per Direktnachricht oder E-Mail.', 'gastronomie', null, '00000000-0000-4000-8000-000000000101', now() - interval '8 hours'),
  ('00000000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000009', 'beitrag', null, 'Riesling Spätlese Alte Reben 2019 vom Weingut Schieferhang zum Rehrücken. Steinobst, Petrol und eine Säure wie ein Uhrwerk.', 'wein', null, '00000000-0000-4000-8000-000000000103', now() - interval '20 hours'),
  ('00000000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000005', 'event', 'Jahrgangspräsentation 2025 am 14. Dezember', 'Wir öffnen den Keller: Fassproben des Jahrgangs 2025, Steillagen-Führung und Winzervesper. Für Fachbesucher kostenlos, Anmeldung erforderlich.', 'wein', null, null, now() - interval '26 hours'),
  ('00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-000000000002', 'neuheit', 'Neu im Sortiment: Grüner Veltliner aus dem Kamptal', 'Drei Lagenweine eines jungen Winzerpaares sind ab sofort bei uns gelistet. Ideal für die glasweise Ausschank. Preisliste für Gastronomie auf Anfrage.', 'wein', null, null, now() - interval '30 hours'),
  ('00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-000000000011', 'beitrag', null, 'Gestern im Kupferkessel einen 12-jährigen Single Malt aus Bayern probiert. Hätte nie gedacht, dass deutscher Whisky so gut sein kann.', 'spirituosen', null, '00000000-0000-4000-8000-000000000104', now() - interval '40 hours'),
  ('00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-000000000006', 'neuheit', 'Alkoholfreier Kräuteraperitif', 'Nach zwei Jahren Entwicklung: unser erster alkoholfreier Aperitif mit Schwarzwälder Tannenspitzen. Funktioniert pur auf Eis oder als Spritz.', 'alkoholfrei', null, null, now() - interval '52 hours'),
  ('00000000-0000-4000-8000-000000000210', '00000000-0000-4000-8000-000000000012', 'event', 'Naturwein-Abend mit Winzer:innen aus dem Burgenland', 'Am Freitag ab 19 Uhr schenken drei Weingüter selbst aus. Kleine Teller aus der Küche, Eintritt frei.', 'wein', null, '00000000-0000-4000-8000-000000000102', now() - interval '70 hours'),
  ('00000000-0000-4000-8000-000000000211', '00000000-0000-4000-8000-000000000008', 'job', 'Commis de Rang und Sommelier-Assistenz', 'Für unser Restaurant suchen wir zwei Kolleg:innen im Service. Interesse an Wein ist ein Muss, Weiterbildungen bezahlen wir.', 'gastronomie', null, '00000000-0000-4000-8000-000000000103', now() - interval '96 hours'),
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000001', 'beitrag', null, 'Neue Hausspirituose im Kupferkessel: ein 5 Jahre alter Haferbrand aus Brandenburg. Wer kennt ähnliche Projekte?', 'spirituosen', null, '00000000-0000-4000-8000-000000000104', now() - interval '14 hours'),
  ('00000000-0000-4000-8000-000000000212', '00000000-0000-4000-8000-000000000010', 'beitrag', null, 'Tipp für alle Kolleg:innen: Zitronenschalen-Oleo-Saccharum hält sich vakuumiert locker zwei Wochen. Spart enorm Zeit im Service.', 'cocktails', null, null, now() - interval '120 hours');

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
  ('00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-000000000009');

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
