'use strict';
/* =====================================================================
   RINGFAHRT – Spieldaten
   Klassen nach Rollen (Tank / Schaden / Heiler) im Stil klassischer MMOs,
   Helden aus „Der Herr der Ringe“ und „Die Ringe der Macht“.
   ===================================================================== */

const ROLES = {
  tank: { n: 'Tank', c: '#6fa3e0', d: 'Zieht die Aufmerksamkeit der Feinde auf sich und hält viel aus.' },
  dd:   { n: 'Schaden', c: '#e0745a', d: 'Verursacht hohen Schaden, im Nahkampf, Fernkampf oder mit Magie.' },
  heal: { n: 'Heiler', c: '#7fd17a', d: 'Hält die Gruppe mit Heilung, Schilden und Segen am Leben.' }
};

const RESOURCES = {
  wut:     { n: 'Wut',     c: '#d24a3a', start: 20, regen: 0,  onHit: 9, onHurt: 12 },
  energie: { n: 'Energie', c: '#e8d05a', start: 60, regen: 25, onHit: 0, onHurt: 0 },
  fokus:   { n: 'Fokus',   c: '#e8964a', start: 50, regen: 20, onHit: 3, onHurt: 0 },
  mana:    { n: 'Mana',    c: '#4f8fe0', start: 100, regen: 14, onHit: 0, onHurt: 0 }
};

const WCLS = { klinge: 'Klingen', bogen: 'Bögen', wucht: 'Äxte & Hämmer', stab: 'Stäbe', speer: 'Speere' };

/* Talent-Knoten: 5 Ränge (Stufe 1 & 2) + Meisterschaft (1 Rang).
   e = Wert pro Rang. Rang 2 braucht 5 Punkte im Ast, Meisterschaft 10. */
const T = (n, e, d) => ({ n, e, d });
const CLASSES = {
  schildwache: { n: 'Schildwache', role: 'tank', sub: 'Schild & Schwert', res: 'wut', wcls: ['klinge', 'speer'], threat: 3,
    base: { hp: 178, atk: 14, mag: 5, def: 17, res: 11, spd: 9, crit: 5 },
    d: 'Ein gepanzerter Verteidiger. Provoziert Feinde, blockt Schläge und schützt Verbündete.',
    tree: [
      { n: 'Schutz', nodes: [T('Schildwall', { defPct: 4 }, '+4 % Verteidigung'), T('Standhaftigkeit', { hpPct: 5 }, '+5 % Lebenspunkte'), T('Letzte Bastion', { reviveSelf: .3 }, 'Einmal pro Kampf: Überlebt einen tödlichen Treffer mit 30 % LP')] },
      { n: 'Vergeltung', nodes: [T('Schwertarm', { atkPct: 3 }, '+3 % Angriff'), T('Dornenschild', { thorns: 4 }, 'Wirft 4 % des erlittenen Schadens zurück'), T('Gegenschlag', { counter: .25 }, '25 % Chance, Nahkampfangriffe zu kontern')] },
      { n: 'Befehl', nodes: [T('Herausforderung', { threat: 10 }, '+10 % Bedrohung'), T('Kampfeswut', { resGain: 10 }, '+10 % Ressourcengewinn'), T('Banner des Königs', { startBuffDef: 1 }, 'Kampfbeginn: Alle Verbündeten erhalten Wacht (2)')] }
    ] },
  bollwerk: { n: 'Bollwerk', role: 'tank', sub: 'Zwergische Wucht', res: 'wut', wcls: ['wucht'], threat: 3,
    base: { hp: 188, atk: 15, mag: 4, def: 16, res: 10, spd: 8, crit: 6 },
    d: 'Unerschütterlich wie der Fels. Viel Leben, schwere Hiebe, Wut als Antrieb.',
    tree: [
      { n: 'Stein', nodes: [T('Felsenhaut', { hpPct: 5 }, '+5 % Lebenspunkte'), T('Granit', { dmgRed: 2 }, '−2 % erlittener Schaden'), T('Steinhaut', { startShieldSelf: .15 }, 'Kampfbeginn: Schild in Höhe von 15 % LP')] },
      { n: 'Zorn', nodes: [T('Grimm', { atkPct: 3 }, '+3 % Angriff'), T('Wucht', { crit: 2 }, '+2 % kritische Trefferchance'), T('Berserker', { lowHpDmg: .5 }, 'Bis zu +50 % Schaden bei niedrigen LP')] },
      { n: 'Ahnen', nodes: [T('Ahnenschutz', { resPct: 4 }, '+4 % Widerstand'), T('Ahnenkraft', { healRecv: 5 }, '+5 % erhaltene Heilung'), T('Durins Segen', { reviveSelf: .35 }, 'Einmal pro Kampf: Überlebt einen tödlichen Treffer mit 35 % LP')] }
    ] },
  urgewalt: { n: 'Urgewalt', role: 'tank', sub: 'Naturkraft', res: 'wut', wcls: ['wucht'], threat: 3,
    base: { hp: 215, atk: 14, mag: 10, def: 13, res: 15, spd: 7, crit: 5 },
    d: 'Uralte Naturgewalt. Enorme Lebenspunkte, Selbstheilung und lähmende Wurzeln.',
    tree: [
      { n: 'Rinde', nodes: [T('Dicke Rinde', { hpPct: 5 }, '+5 % Lebenspunkte'), T('Hartholz', { defPct: 3 }, '+3 % Verteidigung'), T('Dornenranken', { thorns: 25 }, 'Wirft 25 % des erlittenen Schadens zurück')] },
      { n: 'Wurzel', nodes: [T('Saft des Lebens', { healRecv: 5 }, '+5 % erhaltene Heilung'), T('Tiefe Wurzeln', { regenTurn: 1 }, 'Heilt sich jede Runde um 1 % LP'), T('Ewige Wurzeln', { startBuffRegen: 1 }, 'Kampfbeginn: Alle Verbündeten erhalten Erholung (3)')] },
      { n: 'Sturm', nodes: [T('Astpeitsche', { atkPct: 3 }, '+3 % Angriff'), T('Ranken', { statusCh: 5 }, '+5 % Chance auf Zustände'), T('Zorn der Ents', { stunOnHit: .15 }, '15 % Chance, mit Treffern zu betäuben')] }
    ] },
  klingenmeister: { n: 'Klingenmeister', role: 'dd', sub: 'Nahkampf', res: 'wut', wcls: ['klinge', 'speer'], threat: 1,
    base: { hp: 128, atk: 19, mag: 6, def: 10, res: 9, spd: 11, crit: 12 },
    d: 'Meister der Klinge im Nahkampf. Schnelle Kombos, Blutungen und vernichtende Finisher.',
    tree: [
      { n: 'Waffen', nodes: [T('Klingenkunst', { atkPct: 3 }, '+3 % Angriff'), T('Tiefe Wunden', { critDmg: 8 }, '+8 % kritischer Schaden'), T('Doppelhieb', { doubleHit: .2 }, '20 % Chance auf einen zweiten Treffer')] },
      { n: 'Furor', nodes: [T('Kampfrausch', { spd: 1 }, '+1 Tempo'), T('Präzision', { crit: 2 }, '+2 % kritische Trefferchance'), T('Blutrausch', { lifesteal: 10 }, '10 % Lebensraub')] },
      { n: 'Ruhm', nodes: [T('Heldenmut', { ultCharge: 5 }, '+5 % Ultimate-Aufladung'), T('Unbeugsam', { hpPct: 4 }, '+4 % Lebenspunkte'), T('Hinrichten', { execute: .5 }, '+50 % Schaden gegen Feinde unter 30 % LP')] }
    ] },
  waldlaeufer: { n: 'Waldläufer', role: 'dd', sub: 'Fernkampf', res: 'fokus', wcls: ['bogen'], threat: 1,
    base: { hp: 108, atk: 18, mag: 7, def: 8, res: 9, spd: 13, crit: 18 },
    d: 'Präzise Schützen aus sicherer Entfernung. Markieren Ziele und lassen Pfeile regnen.',
    tree: [
      { n: 'Treffsicherheit', nodes: [T('Ruhige Hand', { atkPct: 3 }, '+3 % Angriff'), T('Schwachstellen', { critDmg: 8 }, '+8 % kritischer Schaden'), T('Todesschuss', { execute: .5 }, '+50 % Schaden gegen Feinde unter 30 % LP')] },
      { n: 'Überleben', nodes: [T('Wachsamkeit', { dodge: 2 }, '+2 % Ausweichen'), T('Zähigkeit', { hpPct: 4 }, '+4 % Lebenspunkte'), T('Giftpfeile', { poisonOnHit: .25 }, '25 % Chance, Ziele zu vergiften')] },
      { n: 'Wind', nodes: [T('Leichtfüßig', { spd: 1 }, '+1 Tempo'), T('Konzentration', { resGain: 10 }, '+10 % Fokusgewinn'), T('Doppelschuss', { doubleHit: .25 }, '25 % Chance auf einen zweiten Pfeil')] }
    ] },
  schurke: { n: 'Schattenläufer', role: 'dd', sub: 'Nahkampf / List', res: 'energie', wcls: ['klinge'], threat: .8,
    base: { hp: 100, atk: 17, mag: 8, def: 7, res: 10, spd: 15, crit: 22 },
    d: 'Flink und schwer zu fassen. Gifte, kritische Treffer und Tarnung.',
    tree: [
      { n: 'Meucheln', nodes: [T('Gezielte Stiche', { critDmg: 10 }, '+10 % kritischer Schaden'), T('Giftkunde', { statusCh: 5 }, '+5 % Chance auf Zustände'), T('Tödliches Gift', { poisonOnHit: .3 }, '30 % Chance, Ziele zu vergiften')] },
      { n: 'Kampf', nodes: [T('Kampfgeschick', { atkPct: 3 }, '+3 % Angriff'), T('Scharfes Auge', { crit: 2 }, '+2 % kritische Trefferchance'), T('Klingenwirbel', { doubleHit: .2 }, '20 % Chance auf einen zweiten Treffer')] },
      { n: 'Täuschung', nodes: [T('Ausweichen', { dodge: 3 }, '+3 % Ausweichen'), T('Flinkheit', { spd: 1 }, '+1 Tempo'), T('Unsichtbar', { startInvis: 1 }, 'Kampfbeginn: Unsichtbar (2)')] }
    ] },
  zauberer: { n: 'Zauberer', role: 'dd', sub: 'Magie', res: 'mana', wcls: ['stab'], threat: 1,
    base: { hp: 94, atk: 7, mag: 21, def: 6, res: 14, spd: 10, crit: 10 },
    d: 'Wirkt Feuer, Licht und Sturm. Hoher Flächenschaden, aber zerbrechlich.',
    tree: [
      { n: 'Feuer', nodes: [T('Flammenmacht', { magPct: 3 }, '+3 % Magie'), T('Glut', { critDmg: 8 }, '+8 % kritischer Schaden'), T('Flamme von Anor', { burnOnHit: .3 }, '30 % Chance, Ziele in Brand zu setzen')] },
      { n: 'Frost', nodes: [T('Kälteschild', { resPct: 4 }, '+4 % Widerstand'), T('Eisige Finger', { statusCh: 5 }, '+5 % Chance auf Zustände'), T('Frostbiss', { slowOnHit: .3 }, '30 % Chance, Ziele zu verlangsamen')] },
      { n: 'Arkan', nodes: [T('Manafluss', { resGain: 10 }, '+10 % Manaregeneration'), T('Sternenmacht', { ultCharge: 5 }, '+5 % Ultimate-Aufladung'), T('Echo', { echo: .2 }, '20 % Chance, dass ein Zauber keine Abklingzeit auslöst')] }
    ] },
  lichtheiler: { n: 'Lichtheiler', role: 'heal', sub: 'Heiliges Licht', res: 'mana', wcls: ['stab', 'klinge'], threat: .5,
    base: { hp: 108, atk: 10, mag: 18, def: 8, res: 13, spd: 11, crit: 6 },
    d: 'Elbenmagie und heiliges Licht. Starke Einzelheilung, Schilde und Reinigung.',
    tree: [
      { n: 'Licht', nodes: [T('Strahlen', { healPct: 6 }, '+6 % Heilung'), T('Gnade', { crit: 2 }, '+2 % kritische Heilung'), T('Lichtschild', { healShield: .2 }, 'Heilungen gewähren zusätzlich 20 % als Schild')] },
      { n: 'Disziplin', nodes: [T('Gelassenheit', { resPct: 4 }, '+4 % Widerstand'), T('Klarheit', { resGain: 10 }, '+10 % Manaregeneration'), T('Schutz der Eldar', { startShieldAll: 1.5 }, 'Kampfbeginn: Schild für alle (Magie × 1,5)')] },
      { n: 'Zorn', nodes: [T('Heiliger Eifer', { magPct: 3 }, '+3 % Magie'), T('Glanz', { ultCharge: 5 }, '+5 % Ultimate-Aufladung'), T('Heiliger Zorn', { healSmite: .3 }, '30 % jeder Heilung trifft einen Feind als Schaden')] }
    ] },
  naturheiler: { n: 'Naturheiler', role: 'heal', sub: 'Kräuter & Natur', res: 'mana', wcls: ['stab', 'wucht'], threat: .5,
    base: { hp: 115, atk: 11, mag: 17, def: 9, res: 12, spd: 11, crit: 6 },
    d: 'Kräuter, Proviant und die Kraft des Wachsens. Heilung über Zeit und Wiederbelebung.',
    tree: [
      { n: 'Wiederherstellung', nodes: [T('Heilkräuter', { healPct: 6 }, '+6 % Heilung'), T('Ausdauer', { hpPct: 3 }, '+3 % Lebenspunkte'), T('Lebensblüte', { healRegen: 1 }, 'Geheilte erhalten Erholung (2)')] },
      { n: 'Kräuterkunde', nodes: [T('Vorrat', { resGain: 10 }, '+10 % Manaregeneration'), T('Gute Hausmannskost', { healRecv: 5 }, '+5 % erhaltene Heilung'), T('Lebensfunke', { reviveAlly: .4 }, 'Einmal pro Kampf: Belebt den ersten Gefallenen mit 40 % LP')] },
      { n: 'Gleichgewicht', nodes: [T('Wachstum', { magPct: 3 }, '+3 % Magie'), T('Frische Luft', { spd: 1 }, '+1 Tempo'), T('Frühling', { startBuffRegen: 1 }, 'Kampfbeginn: Alle Verbündeten erhalten Erholung (3)')] }
    ] }
};

const STATUS = {
  bleed:  { n: 'Blutung', l: 'BLT', c: '#e0645a', bad: 1, d: 'Verliert jede Runde 5 % LP.' },
  burn:   { n: 'Brand', l: 'BRD', c: '#f08a3c', bad: 1, d: 'Verliert jede Runde 6 % LP.' },
  poison: { n: 'Gift', l: 'GFT', c: '#9bd06a', bad: 1, d: 'Verliert jede Runde 6 % LP.' },
  stun:   { n: 'Betäubt', l: 'BET', c: '#f3d78f', bad: 1, d: 'Setzt den nächsten Zug aus.' },
  atkUp:  { n: 'Stärke', l: 'ATK+', c: '#f3b36b', d: '+30 % Angriff und Magie.' },
  atkDown:{ n: 'Schwäche', l: 'ATK−', c: '#b48fd8', bad: 1, d: '−25 % Angriff und Magie.' },
  defUp:  { n: 'Wacht', l: 'DEF+', c: '#93c6c0', d: '+50 % Verteidigung und Widerstand.' },
  defDown:{ n: 'Rüstungsbruch', l: 'DEF−', c: '#d88f8f', bad: 1, d: '−35 % Verteidigung und Widerstand.' },
  shield: { n: 'Schild', l: 'SCH', c: '#a8d4ff', d: 'Absorbiert Schaden.' },
  taunt:  { n: 'Spott', l: 'SPOTT', c: '#ff9d6b', d: 'Feinde müssen dieses Ziel angreifen.' },
  regen:  { n: 'Erholung', l: 'REG', c: '#9fe07a', d: 'Heilt jede Runde 7 % LP.' },
  invis:  { n: 'Unsichtbar', l: 'UNS', c: '#c7c7c7', d: 'Kann nicht direkt angegriffen werden.' },
  mark:   { n: 'Markiert', l: 'MRK', c: '#ffdf7a', bad: 1, d: 'Erleidet 30 % mehr Schaden.' },
  slow:   { n: 'Lähmung', l: 'LANG', c: '#8fa8d8', bad: 1, d: '−30 % Tempo.' },
  haste:  { n: 'Eile', l: 'EILE', c: '#7fe0d0', d: '+35 % Tempo.' },
  guard:  { n: 'Schildblock', l: 'BLOCK', c: '#c8d8ff', d: '−40 % erlittener Schaden.' },
  enrage: { n: 'Raserei', l: 'WUT', c: '#ff5a3c', d: '+25 % Angriff und Magie.' }
};

/* ---------------- Fähigkeiten ----------------
   anim: melee | spin | shoot | cast | throw | shout
   fx:   slash | arrow | fire | light | lightning | heal | buff | axe | stone | ice | water | dark | leaf | bite | web | holy
   tgt:  single | all | random | self | lowestAlly | allAllies
   dmg (Stärke), hits, stat ('atk' | 'mag'), st [[Zustand, Chance, Dauer]] auf Ziele,
   buff [[Zustand, Dauer]] auf Verbündete (tgt allAllies) bzw. Ziel, self [[Zustand, Dauer]] auf Anwender,
   heal (Magie-Faktor), healPct, shield (Faktor), cleanse, revive, taunt (alle Feinde), cost (Ressource), cd (Runden) */
const S = (o) => o;
const HEROES = {
  /* ---------- Der Herr der Ringe ---------- */
  aragorn: { n: 'Aragorn', era: 'Drittes Zeitalter', cls: 'klingenmeister', wpn: 'sword', start: 1,
    stages: ['Streicher', 'Erbe Isildurs', 'König Elessar'],
    look: { body: 'man', skin: '#d6a07c', hair: '#3a281c', hs: 'long', beard: 'stubble', tunic: '#4d5a3c', pants: '#3b3026', cape: '#3c4636', wc: '#d8e0e8' },
    stageLook: [{}, { armor: '#8d969e', cape: '#2b3450' }, { tunic: '#1f2c4a', cape: '#141c33', armor: '#c9d1d9', hat: 'circlet', hatC: '#e7c75a', wc: '#f0f6ff' }],
    skills: [
      S({ n: 'Andúril-Hieb', d: 'Kräftiger Hieb (170 %), 50 % Blutung.', cost: 25, cd: 2, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.7, st: [['bleed', .5, 3]] }),
      S({ n: 'Klingenwirbel', d: 'Zwei Hiebe gegen alle Feinde (je 80 %).', cost: 35, cd: 3, anim: 'spin', fx: 'slash', tgt: 'all', dmg: .8, hits: 2 }),
      S({ n: 'Sammelruf', d: 'Alle Verbündeten: Stärke (3).', cost: 20, cd: 5, anim: 'shout', fx: 'buff', tgt: 'allAllies', buff: [['atkUp', 3]], stage: 1 })
    ],
    ult: { n: 'Der König kehrt wieder', d: 'Alle Feinde 240 %. Verbündete: Stärke & Erholung (3).', anim: 'spin', fx: 'holy', tgt: 'all', dmg: 2.4, buffAll: [['atkUp', 3], ['regen', 3]] } },
  legolas: { n: 'Legolas', era: 'Drittes Zeitalter', cls: 'waldlaeufer', wpn: 'bow', start: 1,
    stages: ['Prinz des Düsterwalds', 'Gefährte des Rings', 'Herr von Ithilien'],
    look: { body: 'elf', skin: '#f0d2b4', hair: '#f3e3a1', hs: 'long', ears: 1, tunic: '#5d7a3a', pants: '#4a3b2a', wc: '#c79b52' },
    stageLook: [{}, { cape: '#55703f' }, { tunic: '#7a8f6a', cape: '#9aae7f', armor: '#c8ccc0', hat: 'circlet', hatC: '#d8e4f0' }],
    skills: [
      S({ n: 'Doppelschuss', d: 'Zwei Pfeile (je 85 %).', cost: 25, cd: 1, anim: 'shoot', fx: 'arrow', tgt: 'single', dmg: .85, hits: 2 }),
      S({ n: 'Elbenblick', d: 'Schuss (70 %), markiert das Ziel (+30 % Schaden).', cost: 20, cd: 3, anim: 'shoot', fx: 'arrow', tgt: 'single', dmg: .7, st: [['mark', 1, 3]] }),
      S({ n: 'Pfeilhagel', d: 'Drei Salven auf alle Feinde (je 50 %).', cost: 40, cd: 3, anim: 'shoot', fx: 'arrow', tgt: 'all', dmg: .5, hits: 3, stage: 1 })
    ],
    ult: { n: 'Sturm des Düsterwalds', d: 'Sieben Pfeile auf zufällige Feinde (je 85 %).', anim: 'shoot', fx: 'arrow', tgt: 'random', dmg: .85, hits: 7 } },
  gimli: { n: 'Gimli', era: 'Drittes Zeitalter', cls: 'bollwerk', wpn: 'axe', start: 1,
    stages: ['Sohn Glóins', 'Elbenfreund', 'Herr der Glitzernden Grotten'],
    look: { body: 'dwarf', skin: '#d79b7a', hair: '#b5472a', hs: 'short', beard: 'dwarf', bc: '#b5472a', tunic: '#5e3d24', pants: '#4a3a2a', armor: '#8a8f96', hat: 'helm', hatC: '#8a8f96', wc: '#b8bec6' },
    stageLook: [{}, { armor: '#9aa3ad', cape: '#4a2e1c' }, { armor: '#d8c070', hatC: '#d8c070', cape: '#3a2a5a', wc: '#e8eef4' }],
    skills: [
      S({ n: 'Baruk Khazâd!', d: 'Spott: Alle Feinde greifen Gimli an (2). Wacht (2).', cost: 20, cd: 4, anim: 'shout', fx: 'buff', tgt: 'self', taunt: 2, self: [['defUp', 2]] }),
      S({ n: 'Axtwurf', d: '140 % Schaden, 70 % Rüstungsbruch.', cost: 25, cd: 2, anim: 'throw', fx: 'axe', tgt: 'single', dmg: 1.4, st: [['defDown', .7, 3]] }),
      S({ n: 'Spaltender Hieb', d: 'Alle Feinde 100 %, 25 % Betäubung.', cost: 35, cd: 3, anim: 'spin', fx: 'slash', tgt: 'all', dmg: 1, st: [['stun', .25, 1]], stage: 1 })
    ],
    ult: { n: 'Zorn von Khazad-dûm', d: 'Alle Feinde 210 %, 60 % Betäubung. Spott (2).', anim: 'spin', fx: 'stone', tgt: 'all', dmg: 2.1, st: [['stun', .6, 1]], taunt: 2 } },
  gandalf: { n: 'Gandalf', era: 'Drittes Zeitalter', cls: 'zauberer', wpn: 'staff', start: 1,
    stages: ['Gandalf der Graue', 'Mithrandir', 'Gandalf der Weiße'],
    look: { body: 'man', skin: '#e3b796', hair: '#c9c9c9', hs: 'long', beard: 'long', bc: '#d0d0d0', tunic: '#8d8f94', robe: 1, hat: 'wizard', hatC: '#85878c', wc: '#7a5530', glowC: '#fff6c0' },
    stageLook: [{}, { tunic: '#7a7e88', hatC: '#6f737c', cape: '#5d606a' }, { tunic: '#eeeeee', hair: '#f6f6f6', bc: '#f6f6f6', hat: 'none', cape: '#dcdcdc', wc: '#f4f4f4', glowC: '#ffffff' }],
    skills: [
      S({ n: 'Stabblitz', d: 'Blitz (170 % Magie).', cost: 20, cd: 1, anim: 'cast', fx: 'lightning', tgt: 'single', dmg: 1.7, stat: 'mag' }),
      S({ n: 'Flamme von Anor', d: 'Alle Feinde 110 % Magie, 60 % Brand.', cost: 35, cd: 3, anim: 'cast', fx: 'fire', tgt: 'all', dmg: 1.1, stat: 'mag', st: [['burn', .6, 3]] }),
      S({ n: 'Du kannst nicht vorbei!', d: '260 % Magie, betäubt sicher.', cost: 45, cd: 4, anim: 'cast', fx: 'light', tgt: 'single', dmg: 2.6, stat: 'mag', st: [['stun', 1, 1]], stage: 1 })
    ],
    ult: { n: 'Der Weiße Reiter', d: 'Alle Feinde 260 % Magie, heilt alle Verbündeten um 25 %.', anim: 'cast', fx: 'holy', tgt: 'all', dmg: 2.6, stat: 'mag', healAllPct: .25 } },
  frodo: { n: 'Frodo', era: 'Drittes Zeitalter', cls: 'schurke', wpn: 'dagger', start: 1,
    stages: ['Ringträger', 'Freund der Elben', 'Held der Ringfahrt'],
    look: { body: 'hobbit', skin: '#f0c8a0', hair: '#4a3020', hs: 'curly', tunic: '#7d5a35', pants: '#5a6b3a', cape: '#5f6e48', wc: '#cfe4ff' },
    stageLook: [{}, { armor: '#e8eef6', cape: '#6f7f58' }, { armor: '#f2f6fb', cape: '#8b9a74', tunic: '#5a4a6a' }],
    skills: [
      S({ n: 'Stich leuchtet', d: '150 % Schaden, +40 % gegen Orks.', cost: 30, cd: 1, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.5, bonusTag: 'ork' }),
      S({ n: 'Der Eine Ring', d: 'Unsichtbar & Stärke (2).', cost: 20, cd: 5, anim: 'cast', fx: 'dark', tgt: 'self', self: [['invis', 2], ['atkUp', 2]] }),
      S({ n: 'Phiole Galadriels', d: 'Alle Feinde 90 % Magie, 80 % Schwäche.', cost: 45, cd: 4, anim: 'cast', fx: 'light', tgt: 'all', dmg: .9, stat: 'mag', st: [['atkDown', .8, 3]], stage: 1 })
    ],
    ult: { n: 'Für das Auenland!', d: 'Garantierter kritischer Treffer (340 %).', anim: 'melee', fx: 'holy', tgt: 'single', dmg: 3.4, alwaysCrit: 1 } },
  sam: { n: 'Samweis', era: 'Drittes Zeitalter', cls: 'naturheiler', wpn: 'pan', start: 1,
    stages: ['Gärtner', 'Der Getreue', 'Bürgermeister des Auenlands'],
    look: { body: 'hobbit', skin: '#f0c098', hair: '#a0703a', hs: 'curly', tunic: '#a88a5a', pants: '#6b5a3a', cape: '#6a7a4a', wc: '#3a3a3a' },
    stageLook: [{}, { cape: '#5f6e48', tunic: '#8a7048' }, { tunic: '#e0c060', cape: '#4a7a3a' }],
    skills: [
      S({ n: 'Proviant', d: 'Heilt einen Verbündeten (180 % Magie) + Erholung (3).', cost: 25, cd: 1, anim: 'cast', fx: 'heal', tgt: 'lowestAlly', heal: 1.8, buff: [['regen', 3]] }),
      S({ n: 'Bratpfanne', d: '130 % Schaden, 35 % Betäubung.', cost: 15, cd: 3, anim: 'melee', fx: 'stone', tgt: 'single', dmg: 1.3, st: [['stun', .35, 1]] }),
      S({ n: 'Kaninchen mit Kräutern', d: 'Heilt alle (110 % Magie) + Erholung (3).', cost: 45, cd: 3, anim: 'cast', fx: 'heal', tgt: 'allAllies', heal: 1.1, buff: [['regen', 3]], stage: 1 })
    ],
    ult: { n: 'Ich kann dich tragen!', d: 'Belebt alle Gefallenen (50 %) und heilt alle um 40 %.', anim: 'cast', fx: 'holy', tgt: 'allAllies', revive: .5, healPct: .4 } },
  merry: { n: 'Merry', era: 'Drittes Zeitalter', cls: 'schurke', wpn: 'dagger', unlock: { camp: 'ringkrieg', ch: 0 }, cost: 120,
    stages: ['Brandybock', 'Knappe Rohans', 'Herr von Bockland'],
    look: { body: 'hobbit', skin: '#f0c8a0', hair: '#b7864a', hs: 'curly', tunic: '#6b7a3a', pants: '#5a4a3a', cape: '#5f6e48', wc: '#d8e0e8' },
    stageLook: [{}, { armor: '#7a8a5a', cape: '#2f5a3a', tunic: '#3f6a3a' }, { armor: '#c8c070', cape: '#2f6a3a' }],
    skills: [
      S({ n: 'Hinterhalt', d: '160 % Schaden, doppelt gegen Ziele unter 40 % LP.', cost: 30, cd: 2, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.6, exec: 1 }),
      S({ n: 'Horn von Bockland', d: 'Alle Verbündeten: Eile (3).', cost: 25, cd: 5, anim: 'shout', fx: 'buff', tgt: 'allAllies', buff: [['haste', 3]] }),
      S({ n: 'Klinge von Westernis', d: '190 % Schaden, Rüstungsbruch. +60 % gegen Geister.', cost: 40, cd: 3, anim: 'melee', fx: 'holy', tgt: 'single', dmg: 1.9, bonusTag: 'geist', st: [['defDown', 1, 3]], stage: 1 })
    ],
    ult: { n: 'Für Rohan!', d: 'Alle Feinde 200 %. Verbündete: Stärke (3).', anim: 'spin', fx: 'slash', tgt: 'all', dmg: 2, buffAll: [['atkUp', 3]] } },
  pippin: { n: 'Pippin', era: 'Drittes Zeitalter', cls: 'schurke', wpn: 'dagger', unlock: { camp: 'ringkrieg', ch: 0 }, cost: 120,
    stages: ['Tuk', 'Wache der Zitadelle', 'Thain des Auenlands'],
    look: { body: 'hobbit', skin: '#f2caa4', hair: '#8a5a30', hs: 'curly', tunic: '#5b6e8a', pants: '#5a4a3a', cape: '#5f6e48', wc: '#d8e0e8' },
    stageLook: [{}, { tunic: '#222226', armor: '#3a3a40', cape: '#1a1a1e' }, { tunic: '#2a2a34', armor: '#c0c6d0', cape: '#202028' }],
    skills: [
      S({ n: 'Steinwurf', d: '120 % Schaden, 30 % Betäubung.', cost: 20, cd: 1, anim: 'throw', fx: 'stone', tgt: 'single', dmg: 1.2, st: [['stun', .3, 1]] }),
      S({ n: 'Lied für den Truchsess', d: 'Alle Verbündeten: Erholung (3) und Reinigung.', cost: 30, cd: 4, anim: 'shout', fx: 'heal', tgt: 'allAllies', buff: [['regen', 3]], cleanse: 1 }),
      S({ n: 'Turmwache', d: '170 % Schaden. Selbst: Wacht (2).', cost: 35, cd: 3, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.7, self: [['defUp', 2]], stage: 1 })
    ],
    ult: { n: 'Narrenglück', d: 'Fünf garantierte kritische Treffer auf zufällige Feinde (je 90 %).', anim: 'throw', fx: 'stone', tgt: 'random', dmg: .9, hits: 5, alwaysCrit: 1 } },
  boromir: { n: 'Boromir', era: 'Drittes Zeitalter', cls: 'schildwache', wpn: 'sword', unlock: { camp: 'ringkrieg', ch: 2 }, cost: 140,
    stages: ['Sohn Denethors', 'Hauptmann Gondors', 'Held von Amon Hen'],
    look: { body: 'man', skin: '#d9a684', hair: '#8a5a2e', hs: 'short', beard: 'short', bc: '#8a5a2e', tunic: '#7a2a2a', pants: '#3a2a22', armor: '#7d6a4a', cape: '#5a1e1e', shield: '#b2965a', wc: '#d0d6dc' },
    stageLook: [{}, { armor: '#9aa0a8', shield: '#c8ccd2' }, { armor: '#d8dde4', shield: '#e8e8f0', cape: '#7a1e1e' }],
    skills: [
      S({ n: 'Horn Gondors', d: 'Spott (3). Alle Verbündeten: Wacht (2).', cost: 20, cd: 4, anim: 'shout', fx: 'buff', tgt: 'allAllies', taunt: 3, buff: [['defUp', 2]] }),
      S({ n: 'Schildstoß', d: '120 % Schaden, 35 % Betäubung.', cost: 20, cd: 2, anim: 'melee', fx: 'stone', tgt: 'single', dmg: 1.2, st: [['stun', .35, 1]] }),
      S({ n: 'Schildblock', d: 'Selbst: −40 % Schaden & Wacht (3).', cost: 25, cd: 4, anim: 'shout', fx: 'buff', tgt: 'self', self: [['guard', 3], ['defUp', 3]], stage: 1 })
    ],
    ult: { n: 'Für Gondor!', d: 'Alle Feinde 190 %. Schild für alle Verbündeten (Angriff × 2). Spott (2).', anim: 'spin', fx: 'slash', tgt: 'all', dmg: 1.9, shieldAll: 2, shieldStat: 'atk', taunt: 2 } },
  faramir: { n: 'Faramir', era: 'Drittes Zeitalter', cls: 'waldlaeufer', wpn: 'bow', unlock: { camp: 'ringkrieg', ch: 5 }, cost: 160,
    stages: ['Waldläufer Ithiliens', 'Hauptmann Gondors', 'Fürst von Ithilien'],
    look: { body: 'man', skin: '#d9a684', hair: '#8a6a42', hs: 'short', beard: 'stubble', tunic: '#3f5a3a', pants: '#3a3226', cape: '#33452f', hat: 'hood', hatC: '#3a4a34', wc: '#8a6a42' },
    stageLook: [{}, { hat: 'none', armor: '#7a8088' }, { hat: 'none', armor: '#c8ced6', cape: '#1e2a40', tunic: '#2a3a5a' }],
    skills: [
      S({ n: 'Ithilien-Pfeil', d: '140 % Schaden, +15 % Krit.', cost: 20, cd: 1, anim: 'shoot', fx: 'arrow', tgt: 'single', dmg: 1.4, critB: 15 }),
      S({ n: 'Hinterhalt im Wald', d: 'Alle Feinde 75 %, 50 % Lähmung.', cost: 35, cd: 3, anim: 'shoot', fx: 'arrow', tgt: 'all', dmg: .75, st: [['slow', .5, 2]] }),
      S({ n: 'Kapitän von Gondor', d: 'Alle Verbündeten: Stärke & Wacht (2).', cost: 30, cd: 5, anim: 'shout', fx: 'buff', tgt: 'allAllies', buff: [['atkUp', 2], ['defUp', 2]], stage: 1 })
    ],
    ult: { n: 'Henneth Annûn', d: 'Sechs Pfeile auf zufällige Feinde (je 95 %).', anim: 'shoot', fx: 'arrow', tgt: 'random', dmg: .95, hits: 6 } },
  eowyn: { n: 'Éowyn', era: 'Drittes Zeitalter', cls: 'klingenmeister', wpn: 'sword', unlock: { camp: 'ringkrieg', ch: 3 }, cost: 150,
    stages: ['Schildmaid Rohans', 'Dernhelm', 'Weiße Herrin von Rohan'],
    look: { body: 'slim', skin: '#f2d3b8', hair: '#e8cf7a', hs: 'long', tunic: '#d8d4c4', pants: '#6a6a60', cape: '#4c6b3a', shield: '#4c6b3a', wc: '#d8e0e8' },
    stageLook: [{}, { armor: '#a8aeb6', hat: 'helm', hatC: '#a8aeb6', tunic: '#5a6a4a' }, { armor: '#e0e4ea', tunic: '#f0f0f0', cape: '#e8e8e8', hat: 'circlet', hatC: '#e7c75a' }],
    skills: [
      S({ n: 'Klingentanz', d: 'Zwei schnelle Hiebe (je 85 %).', cost: 25, cd: 1, anim: 'melee', fx: 'slash', tgt: 'single', dmg: .85, hits: 2 }),
      S({ n: 'Schildmaid', d: 'Selbst: Stärke & Eile (3).', cost: 20, cd: 5, anim: 'shout', fx: 'buff', tgt: 'self', self: [['atkUp', 3], ['haste', 3]] }),
      S({ n: 'Kein Mann bin ich!', d: '220 % Schaden, gegen Bosse ×1,8.', cost: 40, cd: 3, anim: 'melee', fx: 'holy', tgt: 'single', dmg: 2.2, bossBonus: 1.8, stage: 1 })
    ],
    ult: { n: 'Tod!', d: 'Alle Feinde 230 %. Verbündete: Stärke (3).', anim: 'spin', fx: 'slash', tgt: 'all', dmg: 2.3, buffAll: [['atkUp', 3]] } },
  theoden: { n: 'Théoden', era: 'Drittes Zeitalter', cls: 'schildwache', wpn: 'sword', unlock: { camp: 'ringkrieg', ch: 4 }, cost: 160,
    stages: ['König von Rohan', 'Herr der Mark', 'König Théoden der Glorreiche'],
    look: { body: 'man', skin: '#e0b090', hair: '#d0c8b0', hs: 'long', beard: 'short', bc: '#d0c8b0', tunic: '#3f5f3a', pants: '#3a3226', armor: '#b89a4a', cape: '#6a2a1e', hat: 'helm', hatC: '#c9a640', shield: '#3f5f3a', wc: '#e0e4e8' },
    stageLook: [{}, { cape: '#2f4f2a', shield: '#c9a640' }, { armor: '#e8cc60', cape: '#e8e8e0', shield: '#e8cc60' }],
    skills: [
      S({ n: 'Erhebt euch, Reiter!', d: 'Spott (2). Alle Verbündeten: Stärke (2).', cost: 25, cd: 4, anim: 'shout', fx: 'buff', tgt: 'allAllies', taunt: 2, buff: [['atkUp', 2]] }),
      S({ n: 'Königlicher Hieb', d: '150 % Schaden.', cost: 20, cd: 1, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.5 }),
      S({ n: 'Wacht am Klamm', d: 'Selbst: Schildblock & Erholung (3).', cost: 25, cd: 4, anim: 'shout', fx: 'buff', tgt: 'self', self: [['guard', 3], ['regen', 3]], stage: 1 })
    ],
    ult: { n: 'Rote Morgendämmerung', d: 'Alle Feinde 220 %, 40 % Betäubung. Spott (2).', anim: 'spin', fx: 'fire', tgt: 'all', dmg: 2.2, st: [['stun', .4, 1]], taunt: 2 } },
  arwen: { n: 'Arwen', era: 'Drittes Zeitalter', cls: 'lichtheiler', wpn: 'sword', unlock: { camp: 'ringkrieg', ch: 1 }, cost: 140,
    stages: ['Abendstern', 'Herrin von Bruchtal', 'Königin Gondors'],
    look: { body: 'slim', skin: '#f2dcc8', hair: '#2a1a14', hs: 'long', ears: 1, tunic: '#5a3a6a', robe: 1, hat: 'circlet', hatC: '#d8e0f0', wc: '#e0e8f0' },
    stageLook: [{}, { tunic: '#3a4a6a', cape: '#2a3456' }, { tunic: '#e8e4f0', cape: '#c8c0e0', hatC: '#f0e080' }],
    skills: [
      S({ n: 'Licht des Abendsterns', d: 'Heilt einen Verbündeten (200 % Magie) und reinigt.', cost: 25, cd: 1, anim: 'cast', fx: 'holy', tgt: 'lowestAlly', heal: 2, cleanse: 1 }),
      S({ n: 'Flut des Bruinen', d: 'Alle Feinde 100 % Magie, 60 % Lähmung.', cost: 35, cd: 3, anim: 'cast', fx: 'water', tgt: 'all', dmg: 1, stat: 'mag', st: [['slow', .6, 2]] }),
      S({ n: 'Gnade der Eldar', d: 'Schild für alle Verbündeten (Magie × 1,4).', cost: 40, cd: 4, anim: 'cast', fx: 'light', tgt: 'allAllies', shield: 1.4, stage: 1 })
    ],
    ult: { n: 'Unsterbliches Licht', d: 'Belebt alle Gefallenen (40 %), heilt alle um 50 %.', anim: 'cast', fx: 'holy', tgt: 'allAllies', revive: .4, healPct: .5 } },
  baumbart: { n: 'Baumbart', era: 'Drittes Zeitalter', cls: 'urgewalt', wpn: 'claws', unlock: { camp: 'ringkrieg', ch: 4 }, cost: 180,
    stages: ['Hirte der Bäume', 'Fangorn', 'Ältester der Ents'],
    look: { body: 'ent', skin: '#6b4a2a', hair: '#4f7a2e', hs: 'leaves', beard: 'long', bc: '#7a8a4a', tunic: '#5a3e22', pants: '#4a321c', wc: '#5a3e22' },
    stageLook: [{}, { hair: '#6a9a3a' }, { hair: '#c8a040', bc: '#9aa060' }],
    skills: [
      S({ n: 'Hum, Hom!', d: 'Spott (3). Selbst: Wacht & Erholung (3).', cost: 20, cd: 4, anim: 'shout', fx: 'leaf', tgt: 'self', taunt: 3, self: [['defUp', 3], ['regen', 3]] }),
      S({ n: 'Astschlag', d: '150 % Schaden.', cost: 15, cd: 1, anim: 'melee', fx: 'stone', tgt: 'single', dmg: 1.5 }),
      S({ n: 'Wurzelgriff', d: 'Alle Feinde 90 %, 35 % Betäubung.', cost: 35, cd: 3, anim: 'cast', fx: 'leaf', tgt: 'all', dmg: .9, st: [['stun', .35, 1]], stage: 1 })
    ],
    ult: { n: 'Der letzte Marsch der Ents', d: 'Alle Feinde 260 %. Spott (2).', anim: 'spin', fx: 'stone', tgt: 'all', dmg: 2.6, taunt: 2 } },

  /* ---------- Die Ringe der Macht ---------- */
  galadriel: { n: 'Galadriel', era: 'Zweites Zeitalter', cls: 'klingenmeister', wpn: 'sword', unlock: { camp: 'ringe', ch: -1 }, cost: 180,
    stages: ['Kommandantin des Nordens', 'Herrin des Lichts', 'Trägerin von Nenya'],
    look: { body: 'slim', skin: '#f4dcc4', hair: '#f2dc90', hs: 'braids', ears: 1, tunic: '#e6e6ea', pants: '#8a8a90', armor: '#c9cfd6', wc: '#eaf2ff' },
    stageLook: [{}, { cape: '#d8dce6', armor: '#e0e6ee' }, { robe: 1, tunic: '#f4f4fa', armor: null, cape: '#e8ecf6', hat: 'circlet', hatC: '#ffffff', glowC: '#ffffff' }],
    skills: [
      S({ n: 'Klinge Valinors', d: '160 % Schaden, +10 % Krit.', cost: 25, cd: 1, anim: 'melee', fx: 'holy', tgt: 'single', dmg: 1.6, critB: 10 }),
      S({ n: 'Licht der Bäume', d: 'Alle Feinde 100 %, 50 % Schwäche.', cost: 35, cd: 3, anim: 'spin', fx: 'light', tgt: 'all', dmg: 1, st: [['atkDown', .5, 2]] }),
      S({ n: 'Kommandantin', d: 'Alle Verbündeten: Stärke (3). Selbst: Eile (3).', cost: 25, cd: 5, anim: 'shout', fx: 'buff', tgt: 'allAllies', buff: [['atkUp', 3]], self: [['haste', 3]], stage: 1 })
    ],
    ult: { n: 'Nenya', d: 'Alle Feinde 250 %, heilt alle Verbündeten um 25 %.', anim: 'cast', fx: 'holy', tgt: 'all', dmg: 2.5, healAllPct: .25 } },
  elrond: { n: 'Elrond', era: 'Zweites Zeitalter', cls: 'lichtheiler', wpn: 'staff', unlock: { camp: 'ringe', ch: -1 }, cost: 180,
    stages: ['Herold Gil-galads', 'Halbelb', 'Herr von Bruchtal'],
    look: { body: 'elf', skin: '#ecd0b8', hair: '#2a2018', hs: 'short', ears: 1, tunic: '#6a3a2a', robe: 1, hat: 'circlet', hatC: '#c8a040', wc: '#c8b080', glowC: '#bfe8ff' },
    stageLook: [{}, { hs: 'long', tunic: '#5a2a3a', cape: '#3a1e2a' }, { hs: 'long', tunic: '#3a2a5a', cape: '#2a1e40', glowC: '#80c8ff', hatC: '#e8c860' }],
    skills: [
      S({ n: 'Heilkunst', d: 'Heilt einen Verbündeten (190 % Magie) + Erholung (2).', cost: 25, cd: 1, anim: 'cast', fx: 'heal', tgt: 'lowestAlly', heal: 1.9, buff: [['regen', 2]] }),
      S({ n: 'Rat der Weisen', d: 'Alle Verbündeten: Wacht (3) und Reinigung.', cost: 30, cd: 4, anim: 'cast', fx: 'light', tgt: 'allAllies', buff: [['defUp', 3]], cleanse: 1 }),
      S({ n: 'Licht Eärendils', d: 'Heilt alle Verbündeten (100 % Magie).', cost: 45, cd: 3, anim: 'cast', fx: 'holy', tgt: 'allAllies', heal: 1, stage: 1 })
    ],
    ult: { n: 'Macht von Vilya', d: 'Heilt alle um 60 %, Schild für alle (Magie × 1).', anim: 'cast', fx: 'holy', tgt: 'allAllies', healPct: .6, shield: 1 } },
  durin: { n: 'Durin IV.', era: 'Zweites Zeitalter', cls: 'bollwerk', wpn: 'hammer', unlock: { camp: 'ringe', ch: 4 }, cost: 200,
    stages: ['Prinz von Khazad-dûm', 'Freund der Elben', 'König unter dem Berg'],
    look: { body: 'dwarf', skin: '#c98b6a', hair: '#2a1a12', hs: 'short', beard: 'dwarf', bc: '#2a1a12', tunic: '#6a4a2a', pants: '#4a3424', armor: '#8a6a3a', wc: '#9aa0a8' },
    stageLook: [{}, { armor: '#a8885a', cape: '#5a2a1a' }, { armor: '#e0c060', hat: 'crown', hatC: '#e8c860', cape: '#2a3a6a' }],
    skills: [
      S({ n: 'Stolz von Khazad-dûm', d: 'Spott (2). Selbst: Schildblock (2).', cost: 20, cd: 4, anim: 'shout', fx: 'buff', tgt: 'self', taunt: 2, self: [['guard', 2]] }),
      S({ n: 'Hammerschlag', d: '150 % Schaden, 25 % Betäubung.', cost: 20, cd: 1, anim: 'melee', fx: 'stone', tgt: 'single', dmg: 1.5, st: [['stun', .25, 1]] }),
      S({ n: 'Felsbrecher', d: 'Alle Feinde 110 %, 50 % Rüstungsbruch.', cost: 35, cd: 3, anim: 'spin', fx: 'stone', tgt: 'all', dmg: 1.1, st: [['defDown', .5, 3]], stage: 1 })
    ],
    ult: { n: 'Hammer Durins', d: '340 % Schaden, betäubt sicher. Spott (2).', anim: 'melee', fx: 'stone', tgt: 'single', dmg: 3.4, st: [['stun', 1, 1]], taunt: 2 } },
  arondir: { n: 'Arondir', era: 'Zweites Zeitalter', cls: 'waldlaeufer', wpn: 'bow', unlock: { camp: 'ringe', ch: 2 }, cost: 180,
    stages: ['Silvan-Wächter', 'Hüter der Südlande', 'Held von Ostirith'],
    look: { body: 'elf', skin: '#8a5a3a', hair: '#1a1210', hs: 'short', ears: 1, tunic: '#4a5a3a', pants: '#3a3428', armor: '#6a6a5a', wc: '#7a5a3a' },
    stageLook: [{}, { cape: '#3a4a2e' }, { armor: '#c0c8b8', cape: '#5a6a3e' }],
    skills: [
      S({ n: 'Silvan-Pfeil', d: '140 % Schaden.', cost: 20, cd: 1, anim: 'shoot', fx: 'arrow', tgt: 'single', dmg: 1.4 }),
      S({ n: 'Pfeil ins Auge', d: '100 % Schaden, markiert, 30 % Betäubung.', cost: 30, cd: 3, anim: 'shoot', fx: 'arrow', tgt: 'single', dmg: 1, st: [['mark', 1, 3], ['stun', .3, 1]] }),
      S({ n: 'Sprungangriff', d: '190 % Schaden im Nahkampf, Blutung.', cost: 35, cd: 3, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.9, st: [['bleed', .8, 3]], stage: 1 })
    ],
    ult: { n: 'Wächter der Südlande', d: 'Sechs Pfeile auf zufällige Feinde (je 95 %).', anim: 'shoot', fx: 'arrow', tgt: 'random', dmg: .95, hits: 6 } },
  isildur: { n: 'Isildur', era: 'Zweites Zeitalter', cls: 'klingenmeister', wpn: 'sword', unlock: { camp: 'ringe', ch: 1 }, cost: 180,
    stages: ['Seekadett', 'Sohn Elendils', 'Hoher König'],
    look: { body: 'man', skin: '#dcac88', hair: '#3a2a1e', hs: 'short', tunic: '#2d4a6a', pants: '#2a2a2e', cape: '#1e2f4a', wc: '#d8e0e8' },
    stageLook: [{}, { armor: '#b0b8c0' }, { armor: '#e0e6ee', hat: 'circlet', hatC: '#f0f0f0', wc: '#fff0c0' }],
    skills: [
      S({ n: 'Seemannsklinge', d: '150 % Schaden.', cost: 20, cd: 1, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.5 }),
      S({ n: 'Wagemut', d: '200 % Schaden, bis doppelt so stark bei wenig LP.', cost: 35, cd: 3, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 2, lowHp: 1 }),
      S({ n: 'Sturm von Númenor', d: 'Alle Feinde 105 %.', cost: 35, cd: 3, anim: 'spin', fx: 'water', tgt: 'all', dmg: 1.05, stage: 1 })
    ],
    ult: { n: 'Narsil', d: '400 % Schaden gegen ein Ziel.', anim: 'melee', fx: 'holy', tgt: 'single', dmg: 4 } },
  elendil: { n: 'Elendil', era: 'Zweites Zeitalter', cls: 'schildwache', wpn: 'sword', unlock: { camp: 'ringe', ch: 3 }, cost: 200,
    stages: ['Kapitän Númenors', 'Herr der Getreuen', 'Hoher König von Arnor & Gondor'],
    look: { body: 'man', skin: '#d8a882', hair: '#3a2a1e', hs: 'short', beard: 'short', bc: '#6a5a4a', tunic: '#2a3f5a', pants: '#2a2a2e', armor: '#c0c8d0', cape: '#1a2a40', shield: '#c0c8d0', wc: '#e0e8f0' },
    stageLook: [{}, { cape: '#283a5a' }, { armor: '#eef2f8', hat: 'crown', hatC: '#f0f4ff', shield: '#f0f4ff' }],
    skills: [
      S({ n: 'Schildwall', d: 'Spott (3). Alle Verbündeten: Wacht (2).', cost: 25, cd: 4, anim: 'shout', fx: 'buff', tgt: 'allAllies', taunt: 3, buff: [['defUp', 2]] }),
      S({ n: 'Hauptmannshieb', d: '140 % Schaden, 20 % Betäubung.', cost: 20, cd: 1, anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.4, st: [['stun', .2, 1]] }),
      S({ n: 'Stern des Elendil', d: 'Alle Feinde 90 %, markiert (50 %).', cost: 35, cd: 3, anim: 'cast', fx: 'light', tgt: 'all', dmg: .9, st: [['mark', .5, 3]], stage: 1 })
    ],
    ult: { n: 'Letztes Bündnis', d: 'Alle Feinde 210 %. Schild für alle (Angriff × 1,6). Spott (2).', anim: 'spin', fx: 'holy', tgt: 'all', dmg: 2.1, shieldAll: 1.6, shieldStat: 'atk', taunt: 2 } },
  miriel: { n: 'Míriel', era: 'Zweites Zeitalter', cls: 'zauberer', wpn: 'staff', unlock: { camp: 'ringe', ch: 1 }, cost: 200,
    stages: ['Königin-Regentin', 'Seherin des Palantír', 'Tar-Míriel'],
    look: { body: 'slim', skin: '#c99a72', hair: '#1e1410', hs: 'long', tunic: '#e8e2d0', robe: 1, hat: 'circlet', hatC: '#e7c75a', wc: '#d8c080', glowC: '#80e0ff' },
    stageLook: [{}, { tunic: '#d0e0f0', cape: '#2a4a7a' }, { tunic: '#f4f0e0', cape: '#e0c060', hat: 'crown', hatC: '#f0d060' }],
    skills: [
      S({ n: 'Gezeitenstoß', d: '160 % Magie.', cost: 20, cd: 1, anim: 'cast', fx: 'water', tgt: 'single', dmg: 1.6, stat: 'mag' }),
      S({ n: 'Flutwelle', d: 'Alle Feinde 110 % Magie, 50 % Lähmung.', cost: 35, cd: 3, anim: 'cast', fx: 'water', tgt: 'all', dmg: 1.1, stat: 'mag', st: [['slow', .5, 2]] }),
      S({ n: 'Vision des Palantír', d: 'Alle Verbündeten: Eile & Stärke (2).', cost: 35, cd: 5, anim: 'cast', fx: 'light', tgt: 'allAllies', buff: [['haste', 2], ['atkUp', 2]], stage: 1 })
    ],
    ult: { n: 'Untergang der Wellen', d: 'Alle Feinde 260 % Magie, 40 % Betäubung.', anim: 'cast', fx: 'water', tgt: 'all', dmg: 2.6, stat: 'mag', st: [['stun', .4, 1]] } },
  nori: { n: 'Nori Brandyfuß', era: 'Zweites Zeitalter', cls: 'naturheiler', wpn: 'staff', unlock: { camp: 'ringe', ch: 0 }, cost: 160,
    stages: ['Harfuß', 'Wanderin', 'Freundin der Sterne'],
    look: { body: 'hobbit', skin: '#e8b890', hair: '#c58a4a', hs: 'wild', tunic: '#6a7a4a', pants: '#5a4a3a', cape: '#7a5a3a', wc: '#7a5a3a', glowC: '#c0ff90' },
    stageLook: [{}, { cape: '#8a6a3a', tunic: '#8a7a4a' }, { cape: '#3a4a6a', glowC: '#ffffff' }],
    skills: [
      S({ n: 'Harfuß-Kräuter', d: 'Heilt einen Verbündeten (170 % Magie) + Erholung (3).', cost: 25, cd: 1, anim: 'cast', fx: 'heal', tgt: 'lowestAlly', heal: 1.7, buff: [['regen', 3]] }),
      S({ n: 'Wanderstock', d: '120 % Schaden, 30 % Lähmung.', cost: 10, cd: 2, anim: 'melee', fx: 'stone', tgt: 'single', dmg: 1.2, st: [['slow', .3, 2]] }),
      S({ n: 'Wanderlied', d: 'Heilt alle (100 % Magie) und Eile (2).', cost: 45, cd: 3, anim: 'cast', fx: 'heal', tgt: 'allAllies', heal: 1, buff: [['haste', 2]], stage: 1 })
    ],
    ult: { n: 'Niemand geht allein', d: 'Belebt alle Gefallenen (50 %), heilt alle um 35 %.', anim: 'cast', fx: 'holy', tgt: 'allAllies', revive: .5, healPct: .35 } },
  fremder: { n: 'Der Fremde', era: 'Zweites Zeitalter', cls: 'zauberer', wpn: 'staff', unlock: { camp: 'ringe', ch: 0 }, cost: 200,
    stages: ['Der Fremde', 'Istar', 'Der Graue Wanderer'],
    look: { body: 'man', skin: '#d8b090', hair: '#9a8a70', hs: 'wild', beard: 'long', bc: '#9a8a70', tunic: '#6a6a62', robe: 1, wc: '#5a4a32', glowC: '#a0e0ff' },
    stageLook: [{}, { tunic: '#5a6070', cape: '#4a5060' }, { tunic: '#8d8f94', hat: 'wizard', hatC: '#7a7c82', hair: '#c0c0c0', bc: '#c8c8c8', glowC: '#fff6c0' }],
    skills: [
      S({ n: 'Sternenfunken', d: '170 % Magie.', cost: 20, cd: 1, anim: 'cast', fx: 'light', tgt: 'single', dmg: 1.7, stat: 'mag' }),
      S({ n: 'Frostwind', d: 'Alle Feinde 100 % Magie, 60 % Lähmung.', cost: 35, cd: 3, anim: 'cast', fx: 'ice', tgt: 'all', dmg: 1, stat: 'mag', st: [['slow', .6, 2]] }),
      S({ n: 'Glühwürmchen', d: '240 % Magie, 50 % Brand.', cost: 40, cd: 3, anim: 'cast', fx: 'fire', tgt: 'single', dmg: 2.4, stat: 'mag', st: [['burn', .5, 3]], stage: 1 })
    ],
    ult: { n: 'Stimme der Sterne', d: 'Alle Feinde 270 % Magie, 30 % Betäubung.', anim: 'cast', fx: 'lightning', tgt: 'all', dmg: 2.7, stat: 'mag', st: [['stun', .3, 1]] } }
};

/* ---------------- Gegner ---------------- */
const ESK = {
  slash:   { n: 'Hieb', anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1, w: 3 },
  heavy:   { n: 'Wuchtschlag', anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.6, w: 1.5, cd: 2 },
  bite:    { n: 'Biss', anim: 'melee', fx: 'bite', tgt: 'single', dmg: 1, w: 3, st: [['bleed', .35, 3]] },
  howl:    { n: 'Heulen', anim: 'shout', fx: 'buff', tgt: 'allAllies', w: 1, cd: 5, buff: [['atkUp', 3]] },
  arrow:   { n: 'Pfeilschuss', anim: 'shoot', fx: 'arrow', tgt: 'single', dmg: 1.1, w: 3, ranged: 1 },
  volley:  { n: 'Pfeilsalve', anim: 'shoot', fx: 'arrow', tgt: 'all', dmg: .55, w: 1.4, cd: 3, ranged: 1 },
  shriek:  { n: 'Schrei der Neun', anim: 'shout', fx: 'dark', tgt: 'all', dmg: .55, stat: 'mag', w: 1.5, cd: 3, st: [['atkDown', .5, 2]] },
  morgul:  { n: 'Morgulklinge', anim: 'melee', fx: 'dark', tgt: 'single', dmg: 1.4, stat: 'mag', w: 2, st: [['poison', .7, 3]] },
  drain:   { n: 'Grabeskälte', anim: 'cast', fx: 'ice', tgt: 'single', dmg: 1.2, stat: 'mag', w: 2, st: [['slow', .6, 2]], ranged: 1 },
  smash:   { n: 'Keulenschwung', anim: 'spin', fx: 'stone', tgt: 'all', dmg: .85, w: 2, cd: 2, st: [['stun', .2, 1]] },
  web:     { n: 'Spinnennetz', anim: 'shoot', fx: 'web', tgt: 'single', dmg: .3, w: 1.2, cd: 3, st: [['stun', .75, 1]], ranged: 1 },
  sting:   { n: 'Giftstachel', anim: 'melee', fx: 'bite', tgt: 'single', dmg: 1.5, w: 2, st: [['poison', .8, 3]] },
  whip:    { n: 'Flammenpeitsche', anim: 'cast', fx: 'fire', tgt: 'all', dmg: .95, stat: 'mag', w: 2, cd: 2, st: [['burn', .5, 3]] },
  firesword:{ n: 'Flammenschwert', anim: 'melee', fx: 'fire', tgt: 'single', dmg: 2, w: 1.5, cd: 2 },
  staff:   { n: 'Blitz aus Orthanc', anim: 'cast', fx: 'lightning', tgt: 'single', dmg: 1.5, stat: 'mag', w: 3, ranged: 1 },
  voice:   { n: 'Stimme Sarumans', anim: 'shout', fx: 'dark', tgt: 'all', dmg: .45, stat: 'mag', w: 1.5, cd: 3, st: [['atkDown', .6, 2], ['slow', .4, 2]] },
  summonUruk:{ n: 'Ruf nach Isengart', anim: 'shout', fx: 'dark', tgt: 'self', summon: 'uruk', w: 1.6, cd: 4 },
  summonSpider:{ n: 'Brut Kankras', anim: 'shout', fx: 'web', tgt: 'self', summon: 'spiderling', w: 1.4, cd: 4 },
  summonNaz:{ n: 'Ruf der Neun', anim: 'shout', fx: 'dark', tgt: 'self', summon: 'nazgul', w: 1.1, cd: 6 },
  summonOrc:{ n: 'Ruf der Uruks', anim: 'shout', fx: 'dark', tgt: 'self', summon: 'adar_orc', w: 1.4, cd: 4 },
  trample: { n: 'Zertrampeln', anim: 'spin', fx: 'stone', tgt: 'all', dmg: 1.15, w: 2, cd: 2 },
  mace:    { n: 'Morgul-Streitkolben', anim: 'melee', fx: 'dark', tgt: 'single', dmg: 1.8, w: 2, cd: 1, st: [['defDown', .6, 3]] },
  darkness:{ n: 'Welle der Finsternis', anim: 'cast', fx: 'dark', tgt: 'all', dmg: 1.05, stat: 'mag', w: 2, cd: 2, st: [['randomDebuff', .6, 2]] },
  gaze:    { n: 'Blick des Auges', anim: 'cast', fx: 'fire', tgt: 'single', dmg: 1.9, stat: 'mag', w: 1.5, cd: 2, st: [['mark', 1, 3]], ranged: 1 },
  darkMight:{ n: 'Dunkle Macht', anim: 'shout', fx: 'dark', tgt: 'self', w: .8, cd: 6, self: [['regen', 3], ['atkUp', 3]] },
  warcry:  { n: 'Kriegsschrei', anim: 'shout', fx: 'buff', tgt: 'allAllies', w: 1, cd: 5, buff: [['atkUp', 3]] },
  frost:   { n: 'Eisatem', anim: 'cast', fx: 'ice', tgt: 'all', dmg: .9, stat: 'mag', w: 2, cd: 2, st: [['slow', .5, 2]] },
  wave:    { n: 'Sturmflut', anim: 'cast', fx: 'water', tgt: 'all', dmg: 1, stat: 'mag', w: 2, cd: 2 },
  swallow: { n: 'Verschlingen', anim: 'melee', fx: 'bite', tgt: 'single', dmg: 2.2, w: 1.4, cd: 3 },
  heal:    { n: 'Dunkle Heilung', anim: 'cast', fx: 'dark', tgt: 'lowestAlly', heal: 1.6, w: 1.4, cd: 2 },
  spear:   { n: 'Speerstoß', anim: 'melee', fx: 'slash', tgt: 'single', dmg: 1.2, w: 3 },
  forge:   { n: 'Schmiedefeuer', anim: 'cast', fx: 'fire', tgt: 'all', dmg: 1.1, stat: 'mag', w: 2, cd: 2, st: [['burn', .5, 3]] },
  deceive: { n: 'Gabe der Täuschung', anim: 'cast', fx: 'light', tgt: 'all', dmg: .5, stat: 'mag', w: 1.4, cd: 3, st: [['atkDown', .6, 2], ['defDown', .5, 2]] }
};

/* type: hum | quad | spider | worm | olifant ; tags für Boni */
const ENEMIES = {
  wolf:      { n: 'Wilder Wolf', type: 'quad', look: { fur: '#6a6258', belly: '#8a8070', eye: '#ffd040', size: 0 }, hp: 60, atk: 11, def: 5, mag: 3, res: 4, spd: 13, sk: ['bite', 'bite', 'howl'], xp: 18, g: 6, tags: ['tier'] },
  warg:      { n: 'Warg', type: 'quad', look: { fur: '#3a3028', belly: '#5a4a3a', eye: '#ff4020', size: 1, mane: 1 }, hp: 95, atk: 14, def: 6, mag: 3, res: 5, spd: 14, sk: ['bite', 'bite', 'howl'], xp: 26, g: 10, tags: ['tier'] },
  wight:     { n: 'Grabunhold', type: 'hum', look: { body: 'man', skin: '#b8c8d0', hair: '#d8e0e8', hs: 'long', tunic: '#3a4a52', robe: 1, hat: 'crown', hatC: '#8a9a9a', wc: '#a8b0b8', glow: '#9ff' }, hp: 105, atk: 10, def: 6, mag: 14, res: 11, spd: 9, sk: ['drain', 'slash'], xp: 30, g: 14, tags: ['geist'], wpn: 'sword' },
  orc:       { n: 'Ork', type: 'hum', look: { body: 'orc', skin: '#6f7f3a', hair: '#1a1a1a', hs: 'wild', tunic: '#4a3a2a', pants: '#3a2e22', armor: '#5a5048', wc: '#8a8a80', glow: '#ffd040' }, wpn: 'sword', hp: 78, atk: 13, def: 7, mag: 3, res: 5, spd: 10, sk: ['slash', 'heavy'], xp: 20, g: 8, tags: ['ork'] },
  orc_archer:{ n: 'Ork-Schütze', type: 'hum', look: { body: 'orc', skin: '#7a7a3a', hair: '#1a1a1a', hs: 'bald', tunic: '#3a3022', pants: '#2e2620', wc: '#5a4030', glow: '#ffd040' }, wpn: 'bow', hp: 60, atk: 13, def: 5, mag: 3, res: 5, spd: 12, sk: ['arrow', 'arrow', 'volley'], xp: 20, g: 9, tags: ['ork'], ranged: 1 },
  goblin:    { n: 'Moria-Ork', type: 'hum', look: { body: 'goblin', skin: '#8a9478', hair: '#1a1a1a', hs: 'bald', tunic: '#2e2a26', pants: '#26221e', wc: '#7a7a70', glow: '#ffe080' }, wpn: 'spear', hp: 55, atk: 11, def: 4, mag: 2, res: 4, spd: 14, sk: ['spear', 'slash'], xp: 15, g: 6, tags: ['ork'] },
  uruk:      { n: 'Uruk-hai', type: 'hum', look: { body: 'uruk', skin: '#3a3530', hair: '#141210', hs: 'long', tunic: '#2a2622', pants: '#22201c', armor: '#3a3a3a', hat: 'helm', hatC: '#2e2e30', mark: '#f0f0f0', wc: '#9a9a90', glow: '#ff8030' }, wpn: 'sword', hp: 110, atk: 16, def: 10, mag: 3, res: 6, spd: 10, sk: ['slash', 'heavy'], xp: 30, g: 12, tags: ['ork'] },
  berserker: { n: 'Uruk-Berserker', type: 'hum', look: { body: 'uruk', skin: '#3a3530', hair: '#141210', hs: 'wild', tunic: '#3a2a22', pants: '#2a201c', paint: '#f0f0f0', wc: '#a8a8a0', glow: '#ff5030' }, wpn: 'sword', hp: 125, atk: 19, def: 6, mag: 3, res: 5, spd: 11, sk: ['heavy', 'slash', 'warcry'], xp: 38, g: 15, tags: ['ork'] },
  adar_orc:  { n: 'Uruk Adars', type: 'hum', look: { body: 'orc', skin: '#8a8f7a', hair: '#2a2a2a', hs: 'wild', tunic: '#3a2f2a', pants: '#2a2420', cape: '#2a2420', armor: '#4a4440', wc: '#8a8a80', glow: '#e0e080' }, wpn: 'sword', hp: 95, atk: 15, def: 8, mag: 3, res: 6, spd: 11, sk: ['slash', 'heavy'], xp: 26, g: 11, tags: ['ork'] },
  pirate:    { n: 'Seeräuber', type: 'hum', look: { body: 'man', skin: '#b08060', hair: '#2a1a12', hs: 'short', beard: 'short', bc: '#2a1a12', tunic: '#6a3a2a', pants: '#3a3a4a', hat: 'hood', hatC: '#3a2a2a', wc: '#a0a0a0' }, wpn: 'sword', hp: 85, atk: 14, def: 7, mag: 3, res: 6, spd: 12, sk: ['slash', 'heavy'], xp: 24, g: 14, tags: [] },
  mystic:    { n: 'Entsagte Mystikerin', type: 'hum', look: { body: 'slim', skin: '#d8c0a8', hair: '#e0d8c8', hs: 'long', tunic: '#d8d0c0', robe: 1, hat: 'hood', hatC: '#c8c0b0', wc: '#4a3a2a', glowC: '#b080ff' }, wpn: 'staff', hp: 80, atk: 8, def: 6, mag: 16, res: 13, spd: 11, sk: ['drain', 'heal'], xp: 30, g: 14, tags: [], ranged: 1 },
  haradrim:  { n: 'Haradrim', type: 'hum', look: { body: 'man', skin: '#8a5a3a', hair: '#1a1210', hs: 'short', tunic: '#8a2a2a', pants: '#4a2a1a', hat: 'hood', hatC: '#a02a2a', armor: '#c8a040', wc: '#a0a0a0' }, wpn: 'spear', hp: 95, atk: 15, def: 8, mag: 3, res: 6, spd: 11, sk: ['spear', 'arrow'], xp: 28, g: 12, tags: [] },
  spiderling:{ n: 'Spinnenbrut', type: 'spider', look: { body: '#2a2230', mark: '#6a3a7a', eye: '#ff4040', size: 0 }, hp: 50, atk: 12, def: 4, mag: 3, res: 4, spd: 15, sk: ['sting', 'bite'], xp: 14, g: 5, tags: ['tier'] },
  cave_troll:{ n: 'Höhlentroll', type: 'hum', look: { body: 'troll', skin: '#7a8078', tunic: '#4a3a2a', pants: '#3a2e22', hs: 'bald', wc: '#5a4030', glow: '#ffd040' }, wpn: 'club', hp: 300, atk: 21, def: 12, mag: 3, res: 6, spd: 6, sk: ['smash', 'heavy', 'slash'], xp: 70, g: 30, tags: ['troll'], elite: 1 },
  mordor_troll:{ n: 'Bergtroll', type: 'hum', look: { body: 'troll', skin: '#4a4a48', tunic: '#2a2622', pants: '#22201c', armor: '#3a3a3c', hs: 'bald', wc: '#6a6a6c', glow: '#ff6020' }, wpn: 'mace', hp: 290, atk: 23, def: 14, mag: 3, res: 7, spd: 7, sk: ['smash', 'heavy'], xp: 75, g: 30, tags: ['troll'], elite: 1 },
  snow_troll:{ n: 'Schneetroll', type: 'hum', look: { body: 'troll', skin: '#d8e0e8', hair: '#f0f4f8', hs: 'wild', tunic: '#a8b8c8', pants: '#8898a8', wc: '#8a8a8a', glow: '#60c0ff' }, wpn: 'club', hp: 320, atk: 20, def: 12, mag: 14, res: 10, spd: 7, sk: ['smash', 'frost', 'heavy'], xp: 80, g: 34, tags: ['troll'], elite: 1 },
  olifant:   { n: 'Olifant', type: 'olifant', look: { skin: '#6a645c' }, hp: 420, atk: 21, def: 15, mag: 3, res: 8, spd: 5, sk: ['trample', 'heavy'], xp: 90, g: 40, tags: ['tier'], elite: 1 },
  nazgul:    { n: 'Ringgeist', type: 'hum', look: { body: 'man', skin: '#0a0a0c', tunic: '#121216', robe: 1, cape: '#0e0e12', hat: 'hood', hatC: '#101014', wc: '#b8c0c8', glow: '#ff3030', noface: 1 }, wpn: 'sword', hp: 200, atk: 15, def: 8, mag: 16, res: 12, spd: 11, sk: ['morgul', 'shriek', 'slash'], xp: 60, g: 25, tags: ['geist'], elite: 1 },
  // Bosse Ringkrieg
  black_rider:{ n: 'Schwarzer Reiter', type: 'hum', look: { body: 'man', skin: '#0a0a0c', tunic: '#121216', robe: 1, cape: '#0e0e12', hat: 'hood', hatC: '#101014', wc: '#c8d0d8', glow: '#ff2020', noface: 1 }, wpn: 'sword', hp: 330, atk: 14, def: 8, mag: 15, res: 11, spd: 11, sk: ['morgul', 'shriek', 'slash'], xp: 90, g: 50, tags: ['geist'], boss: 1 },
  balrog:    { n: 'Balrog', type: 'hum', look: { body: 'giant', skin: '#2a120c', tunic: '#1a0a06', pants: '#1a0a06', hs: 'fire', hair: '#ff6a1a', wings: '#1a0a08', horns: '#3a2a20', fire: 1, wc: '#ff8a2a', glow: '#ffb030' }, wpn: 'whip', hp: 560, atk: 22, def: 13, mag: 20, res: 13, spd: 9, sk: ['whip', 'firesword', 'heavy'], xp: 180, g: 90, tags: ['dämon'], boss: 1 },
  lurtz:     { n: 'Lurtz', type: 'hum', look: { body: 'uruk', skin: '#2a2522', hair: '#0e0c0a', hs: 'wild', tunic: '#2a201a', pants: '#1e1a16', paint: '#f0f0f0', wc: '#a0a098', glow: '#ff6020' }, wpn: 'sword', hp: 440, atk: 21, def: 12, mag: 4, res: 8, spd: 11, sk: ['heavy', 'arrow', 'slash', 'warcry'], xp: 170, g: 80, tags: ['ork'], boss: 1 },
  saruman:   { n: 'Saruman', type: 'hum', look: { body: 'man', skin: '#e0c0a0', hair: '#f4f4f4', hs: 'long', beard: 'long', bc: '#f4f4f4', tunic: '#ececec', robe: 1, cape: '#d8d8d8', wc: '#1a1a1a', glowC: '#ffffff' }, wpn: 'staff', hp: 480, atk: 10, def: 10, mag: 23, res: 18, spd: 12, sk: ['staff', 'voice', 'summonUruk', 'staff'], xp: 220, g: 110, tags: [], boss: 1, ranged: 1 },
  shelob:    { n: 'Kankra', type: 'spider', look: { body: '#1a1418', mark: '#4a2a5a', eye: '#ff3030', size: 1 }, hp: 560, atk: 23, def: 15, mag: 6, res: 12, spd: 12, sk: ['sting', 'web', 'bite', 'summonSpider'], xp: 250, g: 120, tags: ['tier'], boss: 1 },
  witch_king:{ n: 'Hexenkönig von Angmar', type: 'hum', look: { body: 'uruk', skin: '#0a0a0c', tunic: '#121216', robe: 1, cape: '#0e0e12', hat: 'spikehelm', hatC: '#5a5a62', armor: '#3a3a40', wc: '#5a5a62', glow: '#ff3030', noface: 1 }, wpn: 'mace', hp: 620, atk: 23, def: 14, mag: 23, res: 16, spd: 11, sk: ['mace', 'shriek', 'morgul', 'darkMight'], xp: 300, g: 150, tags: ['geist'], boss: 1 },
  sauron:    { n: 'Sauron', type: 'hum', look: { body: 'giant', skin: '#1a1a1c', tunic: '#202024', pants: '#18181a', armor: '#2e2e34', hat: 'spikehelm', hatC: '#3a3a42', wc: '#4a4a52', glow: '#ff7020', noface: 1 }, wpn: 'mace', hp: 760, atk: 26, def: 17, mag: 27, res: 17, spd: 10, sk: ['darkness', 'gaze', 'mace', 'summonNaz', 'darkMight'], xp: 400, g: 200, tags: [], boss: 1 },
  // Bosse Zweites Zeitalter
  snow_boss: { n: 'Eistroll von Forodwaith', type: 'hum', look: { body: 'troll', skin: '#e8eef4', hair: '#ffffff', hs: 'wild', tunic: '#b8c8d8', pants: '#98a8b8', armor: '#a8c8e8', wc: '#c8e0f8', glow: '#40a0ff' }, wpn: 'club', hp: 420, atk: 20, def: 12, mag: 16, res: 11, spd: 7, sk: ['smash', 'frost', 'heavy'], xp: 160, g: 80, tags: ['troll'], boss: 1 },
  seawurm:   { n: 'Seewurm', type: 'worm', look: { skin: '#3a5a5a', belly: '#8aa098', eye: '#ffe040' }, hp: 520, atk: 21, def: 12, mag: 18, res: 12, spd: 9, sk: ['swallow', 'wave', 'bite'], xp: 190, g: 95, tags: ['tier'], boss: 1 },
  adar:      { n: 'Adar', type: 'hum', look: { body: 'elf', skin: '#8a8478', hair: '#1a1a1a', hs: 'long', ears: 1, tunic: '#2a2420', robe: 1, cape: '#1e1a16', wc: '#b0b4b8', glow: '#e0e080' }, wpn: 'sword', hp: 560, atk: 22, def: 13, mag: 14, res: 13, spd: 12, sk: ['heavy', 'slash', 'summonOrc', 'warcry'], xp: 230, g: 110, tags: [], boss: 1 },
  dark_wizard:{ n: 'Der Dunkle Zauberer', type: 'hum', look: { body: 'man', skin: '#c0a890', hair: '#3a3a3a', hs: 'long', beard: 'short', bc: '#4a4a4a', tunic: '#2a2030', robe: 1, cape: '#1a1420', hat: 'hood', hatC: '#22182a', wc: '#3a2a2a', glowC: '#c060ff', glow: '#c060ff' }, wpn: 'staff', hp: 560, atk: 10, def: 11, mag: 26, res: 18, spd: 12, sk: ['drain', 'darkness', 'heal', 'darkMight'], xp: 260, g: 120, tags: [], boss: 1, ranged: 1 },
  damrod:    { n: 'Damrod, der Hügeltroll', type: 'hum', look: { body: 'troll', skin: '#6a7a5a', tunic: '#4a3a2a', pants: '#3a2e22', armor: '#5a5a50', hs: 'bald', wc: '#4a3a22', glow: '#ffd040' }, wpn: 'club', hp: 700, atk: 25, def: 16, mag: 4, res: 9, spd: 7, sk: ['smash', 'heavy', 'trample'], xp: 300, g: 140, tags: ['troll'], boss: 1 },
  annatar:   { n: 'Annatar, Herr der Gaben', type: 'hum', look: { body: 'elf', skin: '#f0d8c0', hair: '#e8c070', hs: 'long', tunic: '#c8a050', robe: 1, cape: '#e0c070', wc: '#d8b060', glowC: '#ffe080' }, wpn: 'hammer', hp: 820, atk: 24, def: 16, mag: 28, res: 18, spd: 11, sk: ['forge', 'deceive', 'gaze', 'darkMight'], xp: 420, g: 220, tags: [], boss: 1,
    transform: { at: .5, to: 'sauron_rop', msg: 'Annatar wirft seine schöne Gestalt ab!' } },
  sauron_rop:{ n: 'Sauron', type: 'hum', look: { body: 'giant', skin: '#1a1a1c', tunic: '#26201a', pants: '#18181a', armor: '#3a3028', hat: 'spikehelm', hatC: '#4a3a2a', wc: '#d8a040', glow: '#ff8020', noface: 1 }, wpn: 'hammer', hp: 820, atk: 27, def: 17, mag: 28, res: 18, spd: 11, sk: ['forge', 'darkness', 'mace', 'gaze'], xp: 0, g: 0, tags: [], boss: 1 }
};

/* ---------------- Kampagnen ---------------- */
const CAMPAIGNS = {
  ringkrieg: { n: 'Der Ringkrieg', era: 'Drittes Zeitalter', d: 'Vom Auenland bis zum Schicksalsberg: die Reise der Gemeinschaft.',
    chapters: [
      { n: 'Das Auenland', bg: 'shire', lvl: 1, story: 'Schwarze Reiter fragen in Hobbingen nach einem Beutlin. Die Gefährten müssen das Auenland verlassen, bevor die Straße nach Bockland gesperrt ist.',
        normal: [['wolf', 'wolf'], ['wolf', 'wolf', 'wolf'], ['wight']], elite: [['wight', 'wolf', 'wolf']], boss: ['black_rider', 'wolf'] },
      { n: 'Die Wetterspitze', bg: 'weather', lvl: 3, story: 'Auf der Ruine von Amon Sûl brennt nachts ein kleines Feuer. Fünf dunkle Gestalten steigen den Hang hinauf.',
        normal: [['orc', 'orc'], ['orc', 'orc_archer', 'wolf'], ['wolf', 'warg']], elite: [['warg', 'warg', 'orc']], boss: ['nazgul', 'nazgul'] },
      { n: 'Die Minen von Moria', bg: 'moria', lvl: 6, story: 'In der Kammer Mazarbul hallen Trommeln aus der Tiefe. Etwas Älteres als die Orks erwacht in den Feuern unter der Brücke.',
        normal: [['goblin', 'goblin', 'goblin'], ['goblin', 'goblin', 'orc_archer'], ['orc', 'goblin', 'goblin']], elite: [['cave_troll', 'goblin', 'goblin']], boss: ['balrog'] },
      { n: 'Amon Hen', bg: 'amonhen', lvl: 9, story: 'Am Hang von Amon Hen bricht die Gemeinschaft auseinander. Aus dem Wald stürmen Uruk-hai mit der weißen Hand.',
        normal: [['uruk', 'uruk'], ['uruk', 'orc_archer', 'orc'], ['berserker', 'orc']], elite: [['berserker', 'uruk', 'uruk']], boss: ['lurtz', 'uruk', 'orc_archer'] },
      { n: 'Helms Klamm & Isengart', bg: 'helm', lvl: 12, story: 'Zehntausend Uruk-hai marschieren durch den Regen auf die Hornburg. Dahinter wartet der Weiße Zauberer in Orthanc.',
        normal: [['uruk', 'berserker', 'orc_archer'], ['uruk', 'uruk', 'uruk'], ['warg', 'uruk']], elite: [['warg', 'warg', 'berserker']], boss: ['saruman', 'uruk'] },
      { n: 'Cirith Ungol', bg: 'cirith', lvl: 15, story: 'Über die Treppen von Cirith Ungol führt der Weg nach Mordor. Netze, dick wie Taue, hängen im Tunnel.',
        normal: [['orc', 'orc', 'orc_archer'], ['spiderling', 'spiderling', 'spiderling'], ['uruk', 'orc_archer', 'orc']], elite: [['mordor_troll', 'orc']], boss: ['shelob', 'spiderling'] },
      { n: 'Die Pelennor-Felder', bg: 'pelennor', lvl: 18, story: 'Minas Tirith brennt, als im Morgengrauen die Hörner Rohans erklingen. Über dem Feld kreist der Herr der Neun.',
        normal: [['haradrim', 'haradrim', 'orc'], ['orc', 'orc', 'mordor_troll'], ['uruk', 'haradrim', 'orc_archer']], elite: [['olifant', 'haradrim'], ['nazgul', 'haradrim']], boss: ['witch_king', 'orc', 'orc'] },
      { n: 'Der Schicksalsberg', bg: 'doom', lvl: 21, story: 'Vor dem Schwarzen Tor fordern die Heerführer des Westens Sauron heraus. Am Orodruin entscheidet sich das Schicksal Mittelerdes.',
        normal: [['mordor_troll', 'orc', 'orc'], ['nazgul', 'orc_archer', 'orc'], ['uruk', 'uruk', 'berserker']], elite: [['mordor_troll', 'mordor_troll'], ['nazgul', 'nazgul']], boss: ['sauron'] }
    ] },
  ringe: { n: 'Die Ringe der Macht', era: 'Zweites Zeitalter', d: 'Tausende Jahre zuvor: Galadriel jagt Sauron, und in Eregion werden die Ringe geschmiedet.', req: { camp: 'ringkrieg', ch: 5 },
    chapters: [
      { n: 'Forodwaith', bg: 'snow', lvl: 17, story: 'Im ewigen Eis des Nordens folgt Galadriel der letzten Spur Saurons. Ihre Gefährten wollen umkehren, doch im Schnee lauert etwas Großes.',
        normal: [['wolf', 'wolf', 'warg'], ['adar_orc', 'adar_orc'], ['warg', 'warg']], elite: [['snow_troll', 'wolf']], boss: ['snow_boss'] },
      { n: 'Das Belegaer-Meer', bg: 'sea', lvl: 19, story: 'Auf einem Floß inmitten des Ozeans treiben Schiffbrüchige. Unter den Wellen bewegt sich ein Schatten, länger als jedes Schiff.',
        normal: [['pirate', 'pirate'], ['pirate', 'pirate', 'pirate'], ['adar_orc', 'pirate']], elite: [['pirate', 'pirate', 'warg']], boss: ['seawurm', 'pirate'] },
      { n: 'Die Südlande', bg: 'south', lvl: 21, story: 'In Tirharad und Ostirith verstecken sich die Menschen vor Adars Uruks. Der dunkle Elb nennt die Orks seine Kinder.',
        normal: [['adar_orc', 'adar_orc', 'orc_archer'], ['adar_orc', 'warg'], ['orc', 'orc', 'adar_orc']], elite: [['adar_orc', 'adar_orc', 'mordor_troll']], boss: ['adar', 'adar_orc'] },
      { n: 'Rhûn', bg: 'rhun', lvl: 23, story: 'In den Steppen des Ostens sucht ein Dunkler Zauberer nach dem Fremden, der vom Himmel fiel. Seine Mystikerinnen sind ihm treu ergeben.',
        normal: [['mystic', 'mystic', 'warg'], ['wight', 'mystic'], ['warg', 'warg', 'mystic']], elite: [['mystic', 'mystic', 'mystic']], boss: ['dark_wizard', 'mystic'] },
      { n: 'Khazad-dûm', bg: 'khazad', lvl: 25, story: 'Die Hallen der Zwerge leuchten noch. Doch Durin und sein Vater sind zerstritten, und ein Hügeltroll bricht in die Minen ein.',
        normal: [['goblin', 'goblin', 'cave_troll'], ['adar_orc', 'adar_orc', 'goblin'], ['wight', 'wight']], elite: [['cave_troll', 'cave_troll']], boss: ['damrod'] },
      { n: 'Eregion', bg: 'eregion', lvl: 28, story: 'Celebrimbor hat die Ringe geschmiedet, angeleitet von einem strahlenden Fremden. Nun belagert Adar die Stadt, und Annatar zeigt sein wahres Gesicht.',
        normal: [['adar_orc', 'adar_orc', 'berserker'], ['wight', 'wight', 'adar_orc'], ['mordor_troll', 'adar_orc']], elite: [['nazgul', 'mordor_troll']], boss: ['annatar'] }
    ] }
};

/* ---------------- Ausrüstung ---------------- */
const RARITY = [
  { id: 'common', n: 'Gewöhnlich', c: '#b8b8b0', mult: 1, aff: 0 },
  { id: 'uncommon', n: 'Ungewöhnlich', c: '#5ecf5a', mult: 1.15, aff: 1 },
  { id: 'rare', n: 'Selten', c: '#4f9ae8', mult: 1.35, aff: 2 },
  { id: 'epic', n: 'Episch', c: '#b46ae8', mult: 1.6, aff: 3 },
  { id: 'legendary', n: 'Legendär', c: '#f09a2a', mult: 1.9, aff: 3 }
];
const SLOTS = { weapon: 'Waffe', armor: 'Rüstung', trinket: 'Schmuck' };
const BASES = {
  klinge: { slot: 'weapon', icon: 'sword', names: ['Kurzschwert', 'Langschwert', 'Dolch', 'Klinge', 'Säbel', 'Breitschwert'] },
  bogen:  { slot: 'weapon', icon: 'bow', names: ['Kurzbogen', 'Langbogen', 'Kompositbogen', 'Elbenbogen'] },
  wucht:  { slot: 'weapon', icon: 'axe', names: ['Handaxt', 'Streitaxt', 'Kriegshammer', 'Doppelaxt', 'Streitkolben'] },
  stab:   { slot: 'weapon', icon: 'staff', names: ['Wanderstab', 'Eichenstab', 'Zauberstab', 'Runenstab'] },
  speer:  { slot: 'weapon', icon: 'spear', names: ['Speer', 'Lanze', 'Glefe'] },
  armor:  { slot: 'armor', icon: 'armor', names: ['Lederwams', 'Kettenhemd', 'Schuppenpanzer', 'Plattenrüstung', 'Elbenmantel', 'Brigantine'] },
  trinket:{ slot: 'trinket', icon: 'ring', names: ['Ring', 'Amulett', 'Brosche', 'Talisman', 'Siegel'] }
};
const ORIGINS = ['Gondorisches', 'Elbisches', 'Zwergisches', 'Númenórisches', 'Rohirrisches', 'Altes', 'Dúnedain-'];
const AFFIX = {
  atk: { n: 'Angriff', suf: 'der Stärke', f: l => 1 + l * 0.4 },
  mag: { n: 'Magie', suf: 'des Wissens', f: l => 1 + l * 0.4 },
  def: { n: 'Verteidigung', suf: 'der Wacht', f: l => 1 + l * 0.3 },
  res: { n: 'Widerstand', suf: 'des Schutzes', f: l => 1 + l * 0.3 },
  hp:  { n: 'Lebenspunkte', suf: 'des Lebens', f: l => 8 + l * 3.5 },
  spd: { n: 'Tempo', suf: 'der Eile', f: l => 1 + l * 0.05, int: 1 },
  crit:{ n: 'Krit-Chance %', suf: 'der Präzision', f: l => 2 + l * 0.12 },
  critDmg: { n: 'Krit-Schaden %', suf: 'der Wucht', f: l => 6 + l * 0.4 },
  lifesteal: { n: 'Lebensraub %', suf: 'des Blutes', f: l => 2 + l * 0.12 },
  healPct: { n: 'Heilung %', suf: 'der Gnade', f: l => 4 + l * 0.3 },
  dodge: { n: 'Ausweichen %', suf: 'des Windes', f: l => 2 + l * 0.1 },
  threat: { n: 'Bedrohung %', suf: 'der Herausforderung', f: l => 8 + l * 0.4 }
};
const LEGENDARIES = [
  { n: 'Andúril, Flamme des Westens', base: 'klinge', fav: 'aragorn', main: 'atk', bonus: { critDmg: 25, burnOnHit: .2 }, p: 'Treffer setzen mit 20 % in Brand.' },
  { n: 'Stich', base: 'klinge', fav: 'frodo', main: 'atk', bonus: { dodge: 8, vsOrk: .3 }, p: '+30 % Schaden gegen Orks.' },
  { n: 'Glamdring, Feindhammer', base: 'klinge', main: 'atk', bonus: { crit: 8, vsOrk: .25 }, p: '+25 % Schaden gegen Orks.' },
  { n: 'Narsil', base: 'klinge', fav: 'isildur', main: 'atk', bonus: { execute: .4 }, p: '+40 % Schaden gegen Feinde unter 30 % LP.' },
  { n: 'Bogen der Galadhrim', base: 'bogen', fav: 'legolas', main: 'atk', bonus: { doubleHit: .25 }, p: '25 % Chance auf einen zweiten Pfeil.' },
  { n: 'Belthronding', base: 'bogen', main: 'atk', bonus: { crit: 10, critDmg: 20 }, p: '' },
  { n: 'Durins Axt', base: 'wucht', fav: 'gimli', main: 'atk', bonus: { stunOnHit: .15, hpPct: 10 }, p: '15 % Chance, mit Treffern zu betäuben.' },
  { n: 'Hammer des Schmiedekönigs', base: 'wucht', fav: 'durin', main: 'atk', bonus: { thorns: 20, defPct: 10 }, p: 'Wirft 20 % des Schadens zurück.' },
  { n: 'Stab des Istari', base: 'stab', fav: 'gandalf', main: 'mag', bonus: { echo: .15, magPct: 10 }, p: '15 % Chance: keine Abklingzeit.' },
  { n: 'Stab von Orthanc', base: 'stab', main: 'mag', bonus: { burnOnHit: .25, critDmg: 20 }, p: 'Treffer setzen mit 25 % in Brand.' },
  { n: 'Aiglos', base: 'speer', main: 'atk', bonus: { slowOnHit: .3, crit: 8 }, p: 'Treffer verlangsamen mit 30 %.' },
  { n: 'Mithrilhemd', base: 'armor', fav: 'frodo', main: 'def', bonus: { dmgRed: 15, defPct: 20 }, p: '−15 % erlittener Schaden.' },
  { n: 'Rüstung des Letzten Bündnisses', base: 'armor', main: 'def', bonus: { hpPct: 15, reviveSelf: .3 }, p: 'Überlebt einmal einen tödlichen Treffer (30 % LP).' },
  { n: 'Elbenmantel aus Lórien', base: 'armor', main: 'res', bonus: { dodge: 10, startInvis: 1 }, p: 'Kampfbeginn: Unsichtbar.' },
  { n: 'Narya, Ring des Feuers', base: 'trinket', main: 'mag', bonus: { startHaste: 1, magPct: 12, burnOnHit: .15 }, p: 'Kampfbeginn: Eile. Brand bei Treffern (15 %).' },
  { n: 'Nenya, Ring des Wassers', base: 'trinket', fav: 'galadriel', main: 'hp', bonus: { regenTurn: 3, healPct: 15 }, p: 'Heilt jede Runde 3 % LP.' },
  { n: 'Vilya, Ring der Luft', base: 'trinket', fav: 'elrond', main: 'mag', bonus: { healPct: 30, resGain: 20 }, p: '+30 % Heilung, +20 % Mana.' },
  { n: 'Elendilmir', base: 'trinket', main: 'hp', bonus: { startEnergy: 40, ultCharge: 20 }, p: 'Kampfbeginn: +40 Ultimate.' },
  { n: 'Evenstar-Anhänger', base: 'trinket', fav: 'arwen', main: 'res', bonus: { reviveSelf: .5, healPct: 15 }, p: 'Überlebt einmal einen tödlichen Treffer (50 % LP).' },
  { n: 'Phiole Galadriels', base: 'trinket', main: 'mag', bonus: { startShieldAll: 1, statusCh: 15 }, p: 'Kampfbeginn: Schild für alle.' }
];

const ACHIEVEMENTS = [
  { id: 'win1', n: 'Erste Schritte', d: 'Gewinne einen Kampf.', stat: 'wins', goal: 1, r: { gold: 100 } },
  { id: 'win25', n: 'Kampferprobt', d: 'Gewinne 25 Kämpfe.', stat: 'wins', goal: 25, r: { mithril: 40 } },
  { id: 'win100', n: 'Veteran des Ringkriegs', d: 'Gewinne 100 Kämpfe.', stat: 'wins', goal: 100, r: { mithril: 120 } },
  { id: 'boss3', n: 'Bosse fallen', d: 'Besiege 3 Bosse.', stat: 'bosses', goal: 3, r: { mithril: 40 } },
  { id: 'boss10', n: 'Bezwinger der Schatten', d: 'Besiege 10 Bosse.', stat: 'bosses', goal: 10, r: { mithril: 100 } },
  { id: 'epic5', n: 'Schatzsucher', d: 'Finde 5 epische Gegenstände.', stat: 'epics', goal: 5, r: { mithril: 40 } },
  { id: 'legend1', n: 'Legendär', d: 'Finde einen legendären Gegenstand.', stat: 'legends', goal: 1, r: { mithril: 60 } },
  { id: 'heroes10', n: 'Die Gemeinschaft wächst', d: 'Besitze 10 Helden.', stat: 'heroes', goal: 10, r: { mithril: 80 } },
  { id: 'heroes20', n: 'Rat von Elrond', d: 'Besitze 20 Helden.', stat: 'heroes', goal: 20, r: { mithril: 200 } },
  { id: 'evo1', n: 'Aufstieg', d: 'Entwickle einen Helden.', stat: 'evolutions', goal: 1, r: { mithril: 40 } },
  { id: 'evo5', n: 'Legenden erwachen', d: 'Führe 5 Entwicklungen durch.', stat: 'evolutions', goal: 5, r: { mithril: 120 } },
  { id: 'talent20', n: 'Weisheit', d: 'Verteile 20 Talentpunkte.', stat: 'talents', goal: 20, r: { gold: 800 } },
  { id: 'lvl20', n: 'Erfahrener Held', d: 'Ein Held erreicht Stufe 20.', stat: 'maxLvl', goal: 20, r: { mithril: 60 } },
  { id: 'enh5', n: 'Meisterschmied', d: 'Verstärke einen Gegenstand auf +5.', stat: 'maxEnh', goal: 5, r: { mithril: 50 } },
  { id: 'tower10', n: 'Orthanc-Stürmer', d: 'Erreiche Etage 10 im Orthanc-Turm.', stat: 'tower', goal: 10, r: { mithril: 80 } },
  { id: 'tower25', n: 'Herr des Turms', d: 'Erreiche Etage 25 im Orthanc-Turm.', stat: 'tower', goal: 25, r: { mithril: 200 } },
  { id: 'camp1', n: 'Der Ring ist vernichtet', d: 'Schließe „Der Ringkrieg“ ab.', stat: 'camp_ringkrieg', goal: 1, r: { mithril: 200 } },
  { id: 'camp2', n: 'Die Ringe sind geschmiedet', d: 'Schließe „Die Ringe der Macht“ ab.', stat: 'camp_ringe', goal: 1, r: { mithril: 250 } }
];

const BACKGROUNDS = {
  shire:   { sky: ['#5a8ab8', '#8ab8d8', '#c8e0e8'], far: '#6a8a6a', mid: '#4a7a3a', ground: '#5a8a3a', gd: '#3e6a2a', props: 'shire', parts: 'fireflies', sun: '#fff0b0' },
  weather: { sky: ['#1a2238', '#2e3a58', '#4a5878'], far: '#2a3242', mid: '#323a3a', ground: '#4a5240', gd: '#343a2e', props: 'ruins', parts: 'none', moon: '#e8eef8', stars: 1 },
  moria:   { sky: ['#0a0a0c', '#121014', '#1a1414'], far: '#1a1818', mid: '#221e1c', ground: '#2e2826', gd: '#1e1a18', props: 'pillars', parts: 'embers', lava: 1 },
  amonhen: { sky: ['#6a8aa8', '#9ab8c8', '#c8d8d0'], far: '#4a6a5a', mid: '#2e5a3a', ground: '#4a6a32', gd: '#32522a', props: 'forest', parts: 'leaves', sun: '#fff8d0' },
  helm:    { sky: ['#1e2228', '#2e343c', '#3e4650'], far: '#2a2e34', mid: '#3a3e42', ground: '#4a4a44', gd: '#34342e', props: 'wall', parts: 'rain' },
  cirith:  { sky: ['#120a18', '#1e1228', '#2a1a38'], far: '#1a1222', mid: '#22182a', ground: '#2a2230', gd: '#1a1420', props: 'webs', parts: 'ash', moon: '#c8b8e0' },
  pelennor:{ sky: ['#3a2218', '#6a3a22', '#a8642e'], far: '#4a3a32', mid: '#4a4030', ground: '#6a6040', gd: '#4a4230', props: 'city', parts: 'embers' },
  doom:    { sky: ['#1a0806', '#3a0e08', '#6a1a0a'], far: '#2a0e0a', mid: '#1e0c0a', ground: '#2e1a16', gd: '#1e100e', props: 'doom', parts: 'embers', lava: 1 },
  snow:    { sky: ['#8aa0c0', '#b8c8e0', '#e0e8f4'], far: '#c8d4e4', mid: '#dce4ee', ground: '#eef2f8', gd: '#c8d4e2', props: 'ice', parts: 'snow' },
  sea:     { sky: ['#2a3a5a', '#4a6a8a', '#8aa8c0'], far: '#3a5a7a', mid: '#2a4a6a', ground: '#7a6a4a', gd: '#5a4a32', props: 'sea', parts: 'spray' },
  south:   { sky: ['#a86a3a', '#d8a060', '#f0d090'], far: '#8a6a4a', mid: '#7a5a3a', ground: '#9a7a4a', gd: '#7a5e38', props: 'south', parts: 'ash', sun: '#fff0c0' },
  rhun:    { sky: ['#3a2a48', '#6a4a6a', '#b8808a'], far: '#5a4058', mid: '#6a5a4a', ground: '#8a7a50', gd: '#6a5a3a', props: 'steppe', parts: 'none', moon: '#f0e0f0' },
  khazad:  { sky: ['#14181e', '#1e242c', '#2a3038'], far: '#262c34', mid: '#2e343c', ground: '#3a4048', gd: '#2a3038', props: 'halls', parts: 'embers' },
  eregion: { sky: ['#3a2a3a', '#7a4a4a', '#d08a5a'], far: '#5a4a4a', mid: '#4a5a3a', ground: '#5a6a3a', gd: '#42502c', props: 'eregion', parts: 'embers', sun: '#ffd090' }
};
