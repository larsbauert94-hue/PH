'use strict';
/* =====================================================================
   RINGFAHRT – Spiellogik: Profil, Werte, Ausrüstung, Talente, Belohnungen
   ===================================================================== */
const SAVE_KEY = 'ringfahrt2-save';
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

let G = null; // Profil

const STAGE_CAP = [15, 30, 50];
const STAGE_MULT = [1, 1.22, 1.5];
const EVOLVE_COST = [{ gold: 600, mithril: 40 }, { gold: 2500, mithril: 120 }];
const xpNeed = l => Math.round(40 + l * 28 + l * l * 2.4);

function newProfile() {
  const heroes = {};
  for (const [k, h] of Object.entries(HEROES)) if (h.start) heroes[k] = newHeroState();
  G = {
    v: 2, gold: 150, mithril: 30, heroes, party: ['gimli', 'aragorn', 'legolas', 'gandalf', 'sam'],
    inv: [], nextId: 1, prog: { ringkrieg: -1, ringe: -1 }, run: null, tower: { best: 0 },
    stats: { wins: 0, bosses: 0, epics: 0, legends: 0, heroes: Object.keys(heroes).length, evolutions: 0, talents: 0, maxLvl: 1, maxEnh: 0, tower: 0, camp_ringkrieg: 0, camp_ringe: 0 },
    ach: {}, settings: { speed: 2, sound: true, autoUlt: true }, news: []
  };
  // Startausrüstung
  for (const k of G.party) { const h = HEROES[k]; const it = genItem(1, 0, { base: CLASSES[h.cls].wcls[0] }); G.inv.push(it); G.heroes[k].eq.weapon = it.id; }
  save();
  return G;
}
function newHeroState() { return { lvl: 1, xp: 0, stage: 0, talents: {}, eq: { weapon: null, armor: null, trinket: null }, tactic: 'normal' }; }
function save() { if (G) store.set(SAVE_KEY, G); }
function load() { const g = store.get(SAVE_KEY); if (g && g.v === 2) { G = g; return true; } return false; }

/* ---------- Werte ---------- */
function itemById(id) { return G.inv.find(i => i.id === id); }
function itemStats(it) { const m = 1 + .1 * (it.enh || 0); const o = {}; for (const [k, v] of Object.entries(it.stats)) o[k] = AFFIX[k]?.int ? Math.round(v * m) : (['crit', 'critDmg', 'lifesteal', 'healPct', 'dodge', 'threat'].includes(k) ? Math.round(v * m * 10) / 10 : Math.round(v * m)); return o; }
function talentSpent(hs) { return Object.values(hs.talents).reduce((a, b) => a + b, 0); }
function talentPoints(hs) { return Math.max(0, hs.lvl - 1) - talentSpent(hs); }
function branchSpent(hs, b) { let s = 0; for (const [k, v] of Object.entries(hs.talents)) if (k.startsWith(b + '-')) s += v; return s; }
function canRank(hs, b, n) {
  if (talentPoints(hs) <= 0) return false;
  const cur = hs.talents[`${b}-${n}`] || 0, max = n === 2 ? 1 : 5;
  if (cur >= max) return false;
  const req = [0, 5, 10][n];
  return branchSpent(hs, b) >= req;
}
function heroStats(key) {
  const H = HEROES[key], C = CLASSES[H.cls], hs = G.heroes[key];
  const lv = hs.lvl, sm = STAGE_MULT[hs.stage], sc = (1 + .11 * (lv - 1)) * sm;
  const flat = { hp: 0, atk: 0, mag: 0, def: 0, res: 0, spd: 0 };
  const p = {}; // Prozent/Passiv
  const add = (k, v) => { if (k in flat) flat[k] += v; else p[k] = (p[k] || 0) + v; };
  for (const slot of Object.keys(SLOTS)) { const it = hs.eq[slot] && itemById(hs.eq[slot]); if (!it) continue; for (const [k, v] of Object.entries(itemStats(it))) add(k, v); if (it.bonus) for (const [k, v] of Object.entries(it.bonus)) add(k, v); if (it.fav === key) { p.atkPct = (p.atkPct || 0) + 10; p.magPct = (p.magPct || 0) + 10; } }
  C.tree.forEach((br, b) => br.nodes.forEach((nd, n) => { const r = hs.talents[`${b}-${n}`] || 0; if (r) for (const [k, v] of Object.entries(nd.e)) add(k, v * r); }));
  const B = C.base;
  const st = {
    hp: Math.round((B.hp * sc + flat.hp) * (1 + (p.hpPct || 0) / 100)),
    atk: Math.round((B.atk * sc + flat.atk) * (1 + (p.atkPct || 0) / 100)),
    mag: Math.round((B.mag * sc + flat.mag) * (1 + (p.magPct || 0) / 100)),
    def: Math.round((B.def * sc + flat.def) * (1 + (p.defPct || 0) / 100)),
    res: Math.round((B.res * sc + flat.res) * (1 + (p.resPct || 0) / 100)),
    spd: B.spd + Math.floor(lv / 10) + hs.stage + flat.spd + (p.spd || 0),
    crit: B.crit + (p.crit || 0), critDmg: 60 + (p.critDmg || 0)
  };
  delete p.hpPct; delete p.atkPct; delete p.magPct; delete p.defPct; delete p.resPct; delete p.spd; delete p.crit; delete p.critDmg;
  st.p = p;
  st.power = Math.round(st.hp * .25 + (st.atk + st.mag) * 2.2 + (st.def + st.res) * 1.6 + st.spd * 4 + st.crit * 2);
  return st;
}
function heroLook(key) { const H = HEROES[key], hs = G.heroes[key] || { stage: 0 }; const L = Object.assign({ wpn: H.wpn }, H.look); for (let i = 1; i <= hs.stage; i++) Object.assign(L, H.stageLook[i] || {}); return L; }
function heroTitle(key) { const hs = G.heroes[key]; return HEROES[key].stages[hs ? hs.stage : 0]; }
function heroSkills(key) { const hs = G.heroes[key]; return HEROES[key].skills.filter(s => !s.stage || s.stage <= hs.stage); }
function heroUlt(key) {
  const hs = G.heroes[key], u = HEROES[key].ult;
  if (hs.stage < 2) return u;
  return Object.assign({}, u, { n: u.n + ' ✦', dmg: u.dmg ? u.dmg * 1.35 : u.dmg, healPct: u.healPct ? Math.min(1, u.healPct * 1.3) : u.healPct, up: 1 });
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
function canEvolve(key) { const hs = G.heroes[key]; if (hs.stage >= 2) return null; const c = EVOLVE_COST[hs.stage]; return { cost: c, ok: hs.lvl >= STAGE_CAP[hs.stage] && G.gold >= c.gold && G.mithril >= c.mithril, lvlOk: hs.lvl >= STAGE_CAP[hs.stage] }; }
function evolve(key) { const e = canEvolve(key); if (!e || !e.ok) return false; G.gold -= e.cost.gold; G.mithril -= e.cost.mithril; G.heroes[key].stage++; G.stats.evolutions++; save(); return true; }
function recruit(key) { const H = HEROES[key]; if (G.heroes[key] || G.mithril < H.cost) return false; G.mithril -= H.cost; G.heroes[key] = newHeroState(); boostNewHero(key); G.stats.heroes = Object.keys(G.heroes).length; save(); return true; }
function boostNewHero(key) {
  // Neue Helden steigen in Höhe des Gruppen-Durchschnitts ein (−2)
  const lv = G.party.filter(k => G.heroes[k]).map(k => G.heroes[k].lvl); const avg = lv.length ? Math.floor(lv.reduce((a, b) => a + b, 0) / lv.length) : 1;
  const hs = G.heroes[key]; hs.lvl = clamp(avg - 2, 1, STAGE_CAP[0]);
}
function unlockHero(key) { if (G.heroes[key]) return false; G.heroes[key] = newHeroState(); boostNewHero(key); G.stats.heroes = Object.keys(G.heroes).length; return true; }

/* ---------- Gegenstände ---------- */
function rollRarity(kind) {
  const W = { normal: [55, 30, 12, 2.7, .3], elite: [18, 40, 30, 10, 2], boss: [0, 20, 45, 28, 7], chest: [0, 0, 30, 55, 15] }[kind] || [60, 30, 9, 1, 0];
  let r = Math.random() * W.reduce((a, b) => a + b, 0); for (let i = 0; i < W.length; i++) { r -= W[i]; if (r <= 0) return i; } return 0;
}
function genItem(lvl, r, opt = {}) {
  lvl = Math.max(1, Math.round(lvl));
  let leg = null, base = opt.base;
  if (r === 4) { leg = opt.leg ?? Math.floor(Math.random() * LEGENDARIES.length); base = LEGENDARIES[leg].base; }
  if (!base) {
    const slot = pick(['weapon', 'weapon', 'armor', 'trinket']);
    if (slot === 'weapon') {
      const cls = (G?.party || []).filter(k => HEROES[k]).flatMap(k => CLASSES[HEROES[k].cls].wcls);
      base = Math.random() < .75 && cls.length ? pick(cls) : pick(['klinge', 'bogen', 'wucht', 'stab', 'speer']);
    } else base = slot;
  }
  const B = BASES[base], R = RARITY[r], m = R.mult;
  const stats = {};
  if (B.slot === 'weapon') stats[base === 'stab' ? 'mag' : 'atk'] = Math.round((2 + lvl * .75) * m);
  if (B.slot === 'armor') { stats.def = Math.round((1 + lvl * .5) * m); stats.hp = Math.round((8 + lvl * 4) * m); }
  if (B.slot === 'trinket') { stats.hp = Math.round((5 + lvl * 2.5) * m); const mm = leg !== null ? LEGENDARIES[leg].main : pick(['atk', 'mag', 'res']); stats[mm] = (stats[mm] || 0) + Math.round((1 + lvl * .4) * m); }
  const keys = Object.keys(AFFIX).filter(k => !(k in stats)); const affs = [];
  for (let i = 0; i < R.aff && keys.length; i++) { const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0]; const A = AFFIX[k]; let v = A.f(lvl) * m * rnd(.8, 1.1); v = A.int ? Math.max(1, Math.round(v)) : (['crit', 'critDmg', 'lifesteal', 'healPct', 'dodge', 'threat'].includes(k) ? Math.round(v * 10) / 10 : Math.round(v)); stats[k] = (stats[k] || 0) + v; affs.push(k); }
  let name;
  if (leg !== null) name = LEGENDARIES[leg].n;
  else { const bn = pick(B.names); name = (r >= 2 ? pick(ORIGINS) + ' ' : '') + bn + (affs.length ? ' ' + AFFIX[affs[0]].suf : ''); name = name.replace('Dúnedain- ', 'Dúnedain-'); }
  const it = { id: G ? G.nextId++ : Math.floor(Math.random() * 1e9), base, slot: B.slot, r, lvl, name, stats, enh: 0, icon: B.icon };
  if (leg !== null) { it.bonus = Object.assign({}, LEGENDARIES[leg].bonus); it.leg = leg; it.passive = LEGENDARIES[leg].p; if (LEGENDARIES[leg].fav) it.fav = LEGENDARIES[leg].fav; }
  return it;
}
function itemValue(it) { return Math.round((8 + it.lvl * 3) * [1, 2, 4, 9, 20][it.r] * (1 + (it.enh || 0) * .3)); }
function enhCost(it) { return Math.round((20 + it.lvl * 6) * [1, 1.4, 2, 3, 4.5][it.r] * Math.pow(1.45, it.enh || 0)); }
function canEquip(key, it) { if (it.slot !== 'weapon') return true; return CLASSES[HEROES[key].cls].wcls.includes(it.base); }
function equippedBy(id) { for (const [k, hs] of Object.entries(G.heroes)) for (const s of Object.keys(SLOTS)) if (hs.eq[s] === id) return k; return null; }
function equip(key, it) { const prev = equippedBy(it.id); if (prev) G.heroes[prev].eq[it.slot] = null; G.heroes[key].eq[it.slot] = it.id; save(); }
function unequip(key, slot) { G.heroes[key].eq[slot] = null; save(); }
function salvage(it) { if (equippedBy(it.id)) return 0; const v = itemValue(it); G.gold += v; G.inv = G.inv.filter(i => i.id !== it.id); return v; }
function enhance(it) { const c = enhCost(it); if (G.gold < c || it.enh >= 10) return false; G.gold -= c; it.enh++; G.stats.maxEnh = Math.max(G.stats.maxEnh, it.enh); save(); return true; }
function addItem(it) { G.inv.push(it); if (it.r === 3) G.stats.epics++; if (it.r === 4) G.stats.legends++; }
function itemLines(it) {
  const s = itemStats(it), out = [];
  for (const [k, v] of Object.entries(s)) { const n = { atk: 'Angriff', mag: 'Magie', def: 'Verteidigung', res: 'Widerstand', hp: 'Lebenspunkte', spd: 'Tempo' }[k] || AFFIX[k]?.n || k; out.push(`+${v} ${n}`); }
  return out;
}

/* ---------- Kampagnen & Belohnungen ---------- */
function campUnlocked(cid) { const C = CAMPAIGNS[cid]; if (!C.req) return true; return G.prog[C.req.camp] >= C.req.ch; }
function chapterUnlocked(cid, ch) { return campUnlocked(cid) && G.prog[cid] >= ch - 1; }
function genMap() {
  const rows = []; const W = { battle: 44, elite: 14, event: 18, rest: 10, shop: 0, treasure: 10 };
  for (let r = 0; r < 4; r++) {
    const n = r === 0 ? 2 : ri(2, 3), set = new Set(); if (r === 3) set.add('rest');
    let guard = 0;
    while (set.size < n && guard++ < 60) {
      const pool = Object.entries(W).filter(([k, w]) => w > 0 && !(r === 0 && (k === 'elite' || k === 'rest')));
      let tot = pool.reduce((a, [, w]) => a + w, 0), x = Math.random() * tot, t = 'battle';
      for (const [k, w] of pool) { x -= w; if (x <= 0) { t = k; break; } } set.add(t);
    }
    if (r === 0) set.add('battle');
    rows.push([...set].slice(0, 3));
  }
  rows.push(['boss']);
  return rows;
}
function startRun(cid, ch) {
  G.run = { camp: cid, ch, rows: genMap(), cur: 0, picks: [], hp: {}, energy: {} };
  save();
}
function rewardFor(kind, lvl, enemies) {
  const xp = Math.round(enemies.reduce((a, e) => a + e.xp, 0) * (kind === 'elite' ? 1.3 : 1));
  const gold = Math.round(enemies.reduce((a, e) => a + e.gold, 0) * rnd(.85, 1.15) * (kind === 'elite' ? 1.3 : 1));
  const items = [];
  const n = kind === 'normal' ? (Math.random() < .65 ? 1 : 0) : kind === 'elite' ? ri(1, 2) : kind === 'tower' ? 1 : ri(2, 3);
  for (let i = 0; i < n; i++) items.push(genItem(lvl + ri(-1, 1), rollRarity(kind === 'tower' ? 'elite' : kind)));
  const mithril = kind === 'boss' ? ri(8, 14) : kind === 'elite' ? ri(2, 5) : (Math.random() < .2 ? 1 : 0);
  return { xp, gold, items, mithril };
}
function applyReward(rw, partyKeys) {
  G.gold += rw.gold; G.mithril += rw.mithril; rw.items.forEach(addItem);
  const res = {};
  for (const k of Object.keys(G.heroes)) { const share = partyKeys.includes(k) ? 1 : .3; res[k] = grantXp(k, Math.round(rw.xp * share)); }
  return res;
}
function completeChapter(cid, ch) {
  const first = G.prog[cid] < ch; const out = { first, unlocked: [], chest: [] };
  if (first) {
    G.prog[cid] = ch;
    for (const [k, h] of Object.entries(HEROES)) if (h.unlock && h.unlock.camp === cid && h.unlock.ch === ch && unlockHero(k)) out.unlocked.push(k);
    if (cid === 'ringkrieg' && CAMPAIGNS.ringe.req && ch === CAMPAIGNS.ringe.req.ch) for (const [k, h] of Object.entries(HEROES)) if (h.unlock && h.unlock.camp === 'ringe' && h.unlock.ch === -1 && unlockHero(k)) out.unlocked.push(k);
    const lvl = CAMPAIGNS[cid].chapters[ch].lvl + 2;
    const it = genItem(lvl, Math.random() < .25 ? 4 : 3); addItem(it); out.chest.push(it);
    out.mithril = 25 + ch * 5; G.mithril += out.mithril;
    if (ch === CAMPAIGNS[cid].chapters.length - 1) G.stats['camp_' + cid] = 1;
  }
  G.stats.bosses++;
  save(); return out;
}
function towerGroup(f) {
  const all = Object.values(CAMPAIGNS).flatMap(c => c.chapters);
  const pool = all.filter(c => c.lvl <= 4 + f * 1.4);
  const ch = pool.length ? pick(pool) : all[0];
  if (f % 10 === 0) return { group: ch.boss, kind: 'boss', bg: ch.bg };
  if (f % 5 === 0) return { group: pick(ch.elite), kind: 'elite', bg: ch.bg };
  return { group: pick(ch.normal), kind: 'normal', bg: ch.bg };
}
const towerLvl = f => Math.round(3 + f * 1.4);

/* ---------- Erfolge ---------- */
function achState(a) { const v = G.stats[a.stat] || 0; return { v, done: v >= a.goal, claimed: !!G.ach[a.id] }; }
function claimAch(a) { const s = achState(a); if (!s.done || s.claimed) return false; G.ach[a.id] = 1; if (a.r.gold) G.gold += a.r.gold; if (a.r.mithril) G.mithril += a.r.mithril; save(); return true; }
function claimableCount() { return ACHIEVEMENTS.filter(a => { const s = achState(a); return s.done && !s.claimed; }).length; }
