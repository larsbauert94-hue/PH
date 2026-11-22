'use strict';
/* =====================================================================
   RINGFAHRT – Spiellogik: Profil, Werte, Passive, Ausrüstung, Belohnungen
   ===================================================================== */
const SAVE_KEY = 'ringfahrt3-save';
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } }
};
let G = null;

const STAGE_CAP = [20, 40, 60];
const STAGE_MULT = [1, 1.25, 1.55];
const EVOLVE_COST = [{ gold: 800, mithril: 40 }, { gold: 4000, mithril: 150 }];
const xpNeed = l => Math.round(30 + l * 22 + l * l * 1.6);
const PCT_KEYS = ['crit', 'critDmg', 'lifesteal', 'healPct', 'dodge', 'threat'];

function newProfile() {
  G = { v: 3, gold: 100, mithril: 20, heroes: {}, party: [], inv: [], nextId: 1, away: {},
    story: { ch: 0, wave: 0, loop: 0, intro: false, farm: false, bossSeen: false, mids: {} },
    stats: { wins: 0, bosses: 0, epics: 0, legends: 0, heroes: 0, evolutions: 0, maxLvl: 1, maxEnh: 0, chapters: 0 },
    ach: {}, settings: { speed: 1, sound: true, autoEquip: true, autoParty: true } };
  save(); return G;
}
function newHeroState() { return { lvl: 1, xp: 0, stage: 0, eq: { weapon: null, armor: null, trinket: null } }; }
function save() { if (G) store.set(SAVE_KEY, G); }
function load() { const g = store.get(SAVE_KEY); if (g && g.v === 3) { G = g; return true; } return false; }

/* ---------- Helden & Gruppe ---------- */
function owned() { return Object.keys(G.heroes); }
function available() { return owned().filter(k => !G.away[k]); }
function joinHero(k) {
  if (G.heroes[k]) return false;
  const lv = available().map(x => G.heroes[x].lvl); const avg = lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 1;
  const hs = newHeroState(); hs.lvl = clamp(avg, 1, STAGE_CAP[0]); G.heroes[k] = hs;
  // Startausrüstung passend zur Klasse
  const it = genItem(Math.max(1, hs.lvl), 1, { base: CLASSES[HEROES[k].cls].wcls[0] }); addItem(it); hs.eq.weapon = it.id;
  G.stats.heroes = owned().length;
  if (G.settings.autoParty || G.party.length < 5) autoParty();
  return true;
}
function roleOf(k) { return CLASSES[HEROES[k].cls].role; }
function autoParty() {
  const pool = available().sort((a, b) => heroStats(b).power - heroStats(a).power);
  const out = []; const take = r => { const k = pool.find(x => roleOf(x) === r && !out.includes(x)); if (k) out.push(k); };
  take('tank'); take('heal');
  for (const k of pool) { if (out.length >= 5) break; if (!out.includes(k) && roleOf(k) === 'dd') out.push(k); }
  for (const k of pool) { if (out.length >= 5) break; if (!out.includes(k)) out.push(k); }
  G.party = out; save(); return out;
}
function partyAura(keys = G.party) {
  const a = { atk: 0, def: 0, hp: 0, spd: 0, crit: 0 };
  for (const k of keys) { if (!G.heroes[k]) continue; for (const ps of HEROES[k].pas) if (ps.lvl <= G.heroes[k].lvl) for (const [key, v] of Object.entries(ps.e)) { if (key === 'auraAtk') a.atk += v; if (key === 'auraDef') a.def += v; if (key === 'auraHp') a.hp += v; if (key === 'auraSpd') a.spd += v; if (key === 'auraCrit') a.crit += v; } }
  return a;
}
function itemById(id) { return G.inv.find(i => i.id === id); }
function itemStats(it) { const m = 1 + .1 * (it.enh || 0); const o = {}; for (const [k, v] of Object.entries(it.stats)) o[k] = AFFIX[k]?.int ? Math.round(v * m) : (PCT_KEYS.includes(k) ? Math.round(v * m * 10) / 10 : Math.round(v * m)); return o; }
function heroStats(key, aura) {
  const H = HEROES[key], C = CLASSES[H.cls], hs = G.heroes[key] || newHeroState();
  aura = aura || { atk: 0, def: 0, hp: 0, spd: 0, crit: 0 };
  const lv = hs.lvl, sc = (1 + .11 * (lv - 1)) * STAGE_MULT[hs.stage];
  const flat = { hp: 0, atk: 0, mag: 0, def: 0, res: 0, spd: 0 }, p = {};
  const add = (k, v) => { if (k in flat) flat[k] += v; else p[k] = (p[k] || 0) + v; };
  for (const slot of Object.keys(SLOTS)) { const it = hs.eq[slot] && itemById(hs.eq[slot]); if (!it) continue; for (const [k, v] of Object.entries(itemStats(it))) add(k, v); if (it.bonus) for (const [k, v] of Object.entries(it.bonus)) add(k, v); if (it.fav === key) { add('atkPct', 10); add('magPct', 10); } }
  for (const ps of H.pas) if (ps.lvl <= lv) for (const [k, v] of Object.entries(ps.e)) if (!k.startsWith('aura')) add(k, v);
  const B = C.base;
  const st = {
    hp: Math.round((B.hp * sc + flat.hp) * (1 + ((p.hpPct || 0) + aura.hp) / 100)),
    atk: Math.round((B.atk * sc + flat.atk) * (1 + ((p.atkPct || 0) + aura.atk) / 100)),
    mag: Math.round((B.mag * sc + flat.mag) * (1 + ((p.magPct || 0) + aura.atk) / 100)),
    def: Math.round((B.def * sc + flat.def) * (1 + ((p.defPct || 0) + aura.def) / 100)),
    res: Math.round((B.res * sc + flat.res) * (1 + ((p.resPct || 0) + aura.def) / 100)),
    spd: Math.round((B.spd + Math.floor(lv / 10) + hs.stage + flat.spd + (p.spd || 0)) * (1 + aura.spd / 100)),
    crit: B.crit + (p.crit || 0) + aura.crit, critDmg: 60 + (p.critDmg || 0)
  };
  for (const k of ['hpPct', 'atkPct', 'magPct', 'defPct', 'resPct', 'spd', 'crit', 'critDmg']) delete p[k];
  st.p = p;
  st.power = Math.round(st.hp * .25 + (st.atk + st.mag) * 2.2 + (st.def + st.res) * 1.6 + st.spd * 4 + st.crit * 2 + (lv >= ACT2_LVL ? 40 : 0) + hs.stage * 60);
  return st;
}
function heroLook(key) { const H = HEROES[key], hs = G.heroes[key] || { stage: 0 }; const L = Object.assign({ wpn: H.wpn }, H.look); for (let i = 1; i <= hs.stage; i++) Object.assign(L, H.stageLook[i] || {}); for (const k in L) if (L[k] === null) delete L[k]; return L; }
function lookAtStage(key, st) { const H = HEROES[key]; const L = Object.assign({ wpn: H.wpn }, H.look); for (let i = 1; i <= st; i++) Object.assign(L, H.stageLook[i] || {}); for (const k in L) if (L[k] === null) delete L[k]; return L; }
function heroTitle(key) { const hs = G.heroes[key]; return HEROES[key].stages[hs ? hs.stage : 0]; }
function heroKit(key) {
  const H = HEROES[key], hs = G.heroes[key] || newHeroState();
  const ult = hs.stage >= 2 ? Object.assign({}, H.ult, { n: H.ult.n + ' ✦', dmg: H.ult.dmg ? H.ult.dmg * 1.35 : H.ult.dmg, healPct: H.ult.healPct ? Math.min(1, H.ult.healPct * 1.3) : H.ult.healPct, up: 1 }) : H.ult;
  return { act: H.act, act2: hs.lvl >= ACT2_LVL ? H.act2 : null, ult };
}
function grantXp(key, xp) {
  const hs = G.heroes[key]; if (!hs) return { ups: 0 };
  const cap = STAGE_CAP[hs.stage]; let ups = 0;
  if (hs.lvl >= cap) { hs.xp = Math.min(hs.xp + xp, xpNeed(hs.lvl)); return { ups: 0, capped: true }; }
  hs.xp += xp;
  while (hs.lvl < cap && hs.xp >= xpNeed(hs.lvl)) { hs.xp -= xpNeed(hs.lvl); hs.lvl++; ups++; }
  if (hs.lvl >= cap) hs.xp = Math.min(hs.xp, xpNeed(hs.lvl));
  G.stats.maxLvl = Math.max(G.stats.maxLvl, hs.lvl);
  return { ups, capped: hs.lvl >= cap };
}
function canEvolve(key) { const hs = G.heroes[key]; if (hs.stage >= 2) return null; const c = EVOLVE_COST[hs.stage]; return { cost: c, lvlOk: hs.lvl >= STAGE_CAP[hs.stage], ok: hs.lvl >= STAGE_CAP[hs.stage] && G.gold >= c.gold && G.mithril >= c.mithril }; }
function evolve(key) { const e = canEvolve(key); if (!e || !e.ok) return false; G.gold -= e.cost.gold; G.mithril -= e.cost.mithril; G.heroes[key].stage++; G.stats.evolutions++; save(); return true; }

/* ---------- Gegenstände ---------- */
function rollRarity(kind) {
  const W = { normal: [58, 30, 10, 1.8, .2], elite: [20, 42, 28, 8.5, 1.5], boss: [0, 22, 45, 27, 6], chest: [0, 0, 30, 55, 15] }[kind] || [60, 30, 9, 1, 0];
  let r = Math.random() * W.reduce((a, b) => a + b, 0); for (let i = 0; i < W.length; i++) { r -= W[i]; if (r <= 0) return i; } return 0;
}
function genItem(lvl, r, opt = {}) {
  lvl = Math.max(1, Math.round(lvl));
  let leg = null, base = opt.base;
  if (r === 4) { leg = opt.leg ?? Math.floor(Math.random() * LEGENDARIES.length); base = LEGENDARIES[leg].base; }
  if (!base) {
    const slot = pick(['weapon', 'weapon', 'armor', 'trinket']);
    if (slot === 'weapon') { const cls = (G?.party || []).filter(k => HEROES[k]).flatMap(k => CLASSES[HEROES[k].cls].wcls); base = Math.random() < .8 && cls.length ? pick(cls) : pick(['klinge', 'bogen', 'wucht', 'stab', 'speer']); }
    else base = slot;
  }
  const B = BASES[base], R = RARITY[r], m = R.mult, stats = {};
  if (B.slot === 'weapon') stats[base === 'stab' ? 'mag' : 'atk'] = Math.round((2 + lvl * .75) * m);
  if (B.slot === 'armor') { stats.def = Math.round((1 + lvl * .5) * m); stats.hp = Math.round((8 + lvl * 4) * m); }
  if (B.slot === 'trinket') { stats.hp = Math.round((5 + lvl * 2.5) * m); const mm = leg !== null ? LEGENDARIES[leg].main : pick(['atk', 'mag', 'res']); stats[mm] = (stats[mm] || 0) + Math.round((1 + lvl * .4) * m); }
  const keys = Object.keys(AFFIX).filter(k => !(k in stats)); const affs = [];
  for (let i = 0; i < R.aff && keys.length; i++) { const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0]; const A = AFFIX[k]; let v = A.f(lvl) * m * rnd(.8, 1.1); v = A.int ? Math.max(1, Math.round(v)) : (PCT_KEYS.includes(k) ? Math.round(v * 10) / 10 : Math.round(v)); stats[k] = (stats[k] || 0) + v; affs.push(k); }
  let name;
  if (leg !== null) name = LEGENDARIES[leg].n;
  else { name = (r >= 2 ? pick(ORIGINS) + ' ' : '') + pick(B.names) + (affs.length ? ' ' + AFFIX[affs[0]].suf : ''); name = name.replace('Dúnedain- ', 'Dúnedain-'); }
  const it = { id: G ? G.nextId++ : Math.floor(Math.random() * 1e9), base, slot: B.slot, r, lvl, name, stats, enh: 0, icon: B.icon };
  if (leg !== null) { it.bonus = Object.assign({}, LEGENDARIES[leg].bonus); it.leg = leg; it.passive = LEGENDARIES[leg].p; if (LEGENDARIES[leg].fav) it.fav = LEGENDARIES[leg].fav; }
  return it;
}
function itemValue(it) { return Math.round((8 + it.lvl * 3) * [1, 2, 4, 9, 20][it.r] * (1 + (it.enh || 0) * .3)); }
function enhCost(it) { return Math.round((20 + it.lvl * 6) * [1, 1.4, 2, 3, 4.5][it.r] * Math.pow(1.45, it.enh || 0)); }
function canEquip(key, it) { return it.slot !== 'weapon' || CLASSES[HEROES[key].cls].wcls.includes(it.base); }
function equippedBy(id) { for (const [k, hs] of Object.entries(G.heroes)) for (const s of Object.keys(SLOTS)) if (hs.eq[s] === id) return k; return null; }
function equip(key, it) { const prev = equippedBy(it.id); if (prev) G.heroes[prev].eq[it.slot] = null; G.heroes[key].eq[it.slot] = it.id; save(); }
function unequip(key, slot) { G.heroes[key].eq[slot] = null; save(); }
function salvage(it) { if (equippedBy(it.id)) return 0; const v = itemValue(it); G.gold += v; G.inv = G.inv.filter(i => i.id !== it.id); return v; }
function enhance(it) { const c = enhCost(it); if (G.gold < c || it.enh >= 10) return false; G.gold -= c; it.enh++; G.stats.maxEnh = Math.max(G.stats.maxEnh, it.enh); save(); return true; }
function addItem(it) { G.inv.push(it); if (it.r === 3) G.stats.epics++; if (it.r === 4) G.stats.legends++; }
function powerDiff(k, it) { const hs = G.heroes[k], prev = hs.eq[it.slot], before = heroStats(k).power; hs.eq[it.slot] = it.id; const after = heroStats(k).power; hs.eq[it.slot] = prev; return after - before; }
function autoEquip(keys = G.party) {
  let n = 0;
  for (const k of keys) for (const slot of Object.keys(SLOTS)) {
    let best = null, bestD = 0;
    for (const it of G.inv) { if (it.slot !== slot || !canEquip(k, it)) continue; const by = equippedBy(it.id); if (by && by !== k && G.party.includes(by)) continue; if (G.heroes[k].eq[slot] === it.id) continue; const d = powerDiff(k, it); if (d > bestD) { bestD = d; best = it; } }
    if (best) { equip(k, best); n++; }
  }
  // Überschuss automatisch zerlegen (gewöhnlich, nicht angelegt), damit der Beutel übersichtlich bleibt
  if (G.inv.length > 80) G.inv.filter(it => it.r === 0 && !equippedBy(it.id)).forEach(salvage);
  return n;
}
function itemLines(it) {
  const s = itemStats(it), out = [];
  for (const [k, v] of Object.entries(s)) { const n = { atk: 'Angriff', mag: 'Magie', def: 'Verteidigung', res: 'Widerstand', hp: 'LP', spd: 'Tempo' }[k] || AFFIX[k]?.n || k; out.push(`+${v} ${n}`); }
  return out;
}

/* ---------- Story & Belohnungen ---------- */
const LOOP_LVL = 40;
function chapterLvl(ch = G.story.ch) { return STORY[ch].lvl + G.story.loop * LOOP_LVL; }
function waveLvl(wave) { return chapterLvl() + Math.floor(wave / 2); }
function battleReward(kind, enemies) {
  const xp = Math.round(enemies.reduce((a, e) => a + e.xp, 0) * (kind === 'elite' ? 1.3 : 1));
  const gold = Math.round(enemies.reduce((a, e) => a + e.gold, 0) * rnd(.85, 1.15));
  const lvl = enemies.reduce((a, e) => Math.max(a, e.lvl), 1);
  const items = [];
  const n = kind === 'boss' ? ri(2, 3) : kind === 'elite' ? 1 : (Math.random() < .3 ? 1 : 0);
  for (let i = 0; i < n; i++) items.push(genItem(lvl + ri(-1, 1), rollRarity(kind)));
  const mithril = kind === 'boss' ? ri(10, 16) : kind === 'elite' ? ri(1, 3) : (Math.random() < .12 ? 1 : 0);
  return { xp, gold, items, mithril };
}
function applyReward(rw, partyKeys) {
  G.gold += rw.gold; G.mithril += rw.mithril; rw.items.forEach(addItem);
  const res = {};
  for (const k of owned()) { const share = partyKeys.includes(k) ? 1 : .4; res[k] = grantXp(k, Math.round(rw.xp * share)); }
  if (G.settings.autoEquip) autoEquip();
  return res;
}

/* ---------- Erfolge ---------- */
function achState(a) { const v = G.stats[a.stat] || 0; return { v, done: v >= a.goal, claimed: !!G.ach[a.id] }; }
function claimAch(a) { const s = achState(a); if (!s.done || s.claimed) return false; G.ach[a.id] = 1; if (a.r.gold) G.gold += a.r.gold; if (a.r.mithril) G.mithril += a.r.mithril; save(); return true; }
function claimableCount() { return ACHIEVEMENTS.filter(a => { const s = achState(a); return s.done && !s.claimed; }).length; }
