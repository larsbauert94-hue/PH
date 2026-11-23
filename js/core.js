'use strict';
/* =====================================================================
   RINGFAHRT – Spiellogik: Profil, Werte, Passive, Ausrüstung, Belohnungen
   ===================================================================== */
const SAVE_KEY = 'ringfahrt4-save';
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

const STAGE_CAP = [25, 50, 80];
const STAGE_MULT = [1, 1.25, 1.55];
const EVOLVE_COST = [{ gold: 900 }, { gold: 4500 }];
const xpNeed = l => Math.round(30 + l * 26 + l * l * 2.6);
const PCT_KEYS = ['crit', 'critDmg', 'lifesteal', 'healPct', 'dodge', 'threat'];

function newProfile() {
  G = { v: 4, gold: 100, frags: {}, rings: {}, unl: {}, heroes: {}, party: [], inv: [], nextId: 1, away: {}, relics: {}, tower: { best: 0, queued: false },
    chest: 0, board: null, side: {}, comps: {}, companion: null, raid: {}, queue: null,
    story: { ch: 0, wave: 0, loop: 0, intro: false, farm: false, bossSeen: false, mids: {} },
    stats: { wins: 0, bosses: 0, epics: 0, legends: 0, heroes: 0, evolutions: 0, maxLvl: 1, maxEnh: 0, chapters: 0, relics: 0, towerBest: 0, maxCombo: 0 },
    ach: {}, settings: { speed: 1, sound: true, autoEquip: true, autoParty: true } };
  save(); return G;
}
function newHeroState() { return { lvl: 1, xp: 0, stage: 0, eq: { weapon: null, armor: null, trinket: null } }; }
function save() { if (G) store.set(SAVE_KEY, G); }
function load() { const g = store.get(SAVE_KEY); if (g && g.v === 4) { G = g; migrate(); return true; } return false; }
function migrate() {
  if (!G.frags) { G.frags = {}; G.rings = {}; G.unl = G.unl || {}; G.gold += (G.mithril || 0) * 25; delete G.mithril; const n = (G.story?.ch || 0) + (G.story?.loop || 0) * 20; grantFragments(Math.round(n * 1.4), true); }
  if (!G.unl) G.unl = {};
  if (!G.team) { const ls = Object.values(G.heroes || {}).map(h => h.lvl || 1); G.team = { lvl: Math.max(1, ...ls), xp: 0 }; }
  if (!G.bestiary) G.bestiary = {};
  if (!G.ride) G.ride = {}; if (!G.mounts) { G.mounts = {}; if (G.story) grantMounts(); }
  const d = { chest: 0, board: null, side: {}, comps: {}, companion: null, raid: {}, queue: null, relics: {}, tower: { best: 0, queued: false } };
  for (const [k, v] of Object.entries(d)) if (G[k] === undefined) G[k] = v;
  for (const k of ['sides', 'comps', 'fullSet', 'loops', 'relics', 'towerBest', 'maxCombo']) if (G.stats[k] === undefined) G.stats[k] = 0;
  syncLevels();
  if (G.heroes && G.story) for (const [k, ch] of [['eomer', 10], ['haldir', 10], ['gollum', 11], ['celebrimbor', 20]]) if (!G.heroes[k] && HEROES[k] && (G.story.ch > ch || G.story.loop > 0)) joinHero(k);
  delete G.idle; delete G.daily;
}

/* ---------- Helden & Gruppe ---------- */
function owned() { return Object.keys(G.heroes); }
function available() { return owned().filter(k => !G.away[k]); }
function joinHero(k) {
  if (G.heroes[k]) return false;
  const lv = available().map(x => G.heroes[x].lvl); const avg = lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 1;
  if (!G.team) G.team = { lvl: 1, xp: 0 }; const hs = newHeroState(); hs.lvl = G.team.lvl; hs.xp = G.team.xp; G.heroes[k] = hs;
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
const AURA0 = () => ({ atk: 0, def: 0, hp: 0, spd: 0, crit: 0, mag: 0, dodge: 0, ultCharge: 0, healPct: 0, thorns: 0, startBuffRegen: 0 });
function activeFactions(keys = G.party) {
  const out = [];
  for (const [id, F] of Object.entries(FACTIONS)) {
    const n = keys.filter(k => F.m.includes(k)).length; let tier = -1;
    F.t.forEach((t, i) => { if (n >= t[0]) tier = i; });
    out.push({ id, F, n, tier });
  }
  return out;
}
function partyAura(keys = G.party) {
  const a = Object.assign(AURA0(), { _party: 1 }), add = (e) => { for (const [k, v] of Object.entries(e)) a[k] = (a[k] || 0) + v; };
  for (const k of keys) { if (!G.heroes[k]) continue; for (const ps of HEROES[k].pas) if (ps.lvl <= G.heroes[k].lvl) for (const [key, v] of Object.entries(ps.e)) { if (key === 'auraAtk') a.atk += v; if (key === 'auraDef') a.def += v; if (key === 'auraHp') a.hp += v; if (key === 'auraSpd') a.spd += v; if (key === 'auraCrit') a.crit += v; } }
  for (const f of activeFactions(keys)) if (f.tier >= 0) add(f.F.t[f.tier][1]);
  for (const i of Object.keys(G.relics || {})) if (RELICS[i]) add(RELICS[i].e);
  for (const R of RINGS) { const r = G.rings?.[R.id]; if (r && r.stars > 0 && r.owner && keys.includes(r.owner) && R.aura) { const m = RING_STARS[r.stars] || 1; for (const [k, v] of Object.entries(R.aura)) a[k] = (a[k] || 0) + Math.round(v * m); } }
  const cp = COMPANIONS.find(c => c.id === G.companion); if (cp && G.comps[cp.id]) add(cp.e);
  return a;
}
function activeBonds(keys = G.party) { return BONDS.filter(b => keys.includes(b.a) && keys.includes(b.b)); }
function itemById(id) { return G.inv.find(i => i.id === id); }
function itemStats(it) { const m = 1 + .1 * (it.enh || 0); const o = {}; for (const [k, v] of Object.entries(it.stats)) o[k] = AFFIX[k]?.int ? Math.round(v * m) : (PCT_KEYS.includes(k) ? Math.round(v * m * 10) / 10 : Math.round(v * m)); return o; }
function heroStats(key, aura) {
  const H = HEROES[key], C = CLASSES[H.cls], hs = G.heroes[key] || newHeroState();
  aura = Object.assign(AURA0(), aura || {});
  if (!aura._party) for (const i of Object.keys(G.relics || {})) if (RELICS[i]) for (const [k, v] of Object.entries(RELICS[i].e)) aura[k] += v;
  if (aura._party) for (const b of activeBonds()) if (b.a === key || b.b === key) for (const [k, v] of Object.entries(b.e)) aura[k] = (aura[k] || 0) + v;
  const lv = hs.lvl, sc = (1 + .11 * (lv - 1)) * STAGE_MULT[hs.stage];
  const flat = { hp: 0, atk: 0, mag: 0, def: 0, res: 0, spd: 0 }, p = {};
  const add = (k, v) => { if (k in flat) flat[k] += v; else p[k] = (p[k] || 0) + v; };
  for (const slot of Object.keys(SLOTS)) { const it = hs.eq[slot] && itemById(hs.eq[slot]); if (!it) continue; for (const [k, v] of Object.entries(itemStats(it))) add(k, v); if (it.bonus) for (const [k, v] of Object.entries(it.bonus)) add(k, v); if (it.fav === key) { add('atkPct', 10); add('magPct', 10); } }
  const mt = mountOf(key); if (mt) for (const [k, v] of Object.entries(mt.b)) add(k, v);
  const rg = ringOf(key); if (rg) { for (const [k, v] of Object.entries(ringBonus(rg.R, rg.stars))) add(k, v); for (const [k, v] of Object.entries(rg.R.p)) add(k, v); }
  for (const ps of H.pas) if (ps.lvl <= lv) for (const [k, v] of Object.entries(ps.e)) if (!k.startsWith('aura')) add(k, v);
  const setN = {}; for (const slot of Object.keys(SLOTS)) { const it = hs.eq[slot] && itemById(hs.eq[slot]); if (it?.set) setN[it.set] = (setN[it.set] || 0) + 1; }
  for (const [id, n] of Object.entries(setN)) { const S2 = SETS.find(x => x.id === id); if (!S2) continue; if (n >= 2) for (const [k, v] of Object.entries(S2.b2)) add(k, v); if (n >= 3) for (const [k, v] of Object.entries(S2.b3)) add(k, v); }
  const B = C.base;
  const st = {
    hp: Math.round((B.hp * sc + flat.hp) * (1 + ((p.hpPct || 0) + aura.hp) / 100)),
    atk: Math.round((B.atk * sc + flat.atk) * (1 + ((p.atkPct || 0) + aura.atk) / 100)),
    mag: Math.round((B.mag * sc + flat.mag) * (1 + ((p.magPct || 0) + aura.atk + aura.mag) / 100)),
    def: Math.round((B.def * sc + flat.def) * (1 + ((p.defPct || 0) + aura.def) / 100)),
    res: Math.round((B.res * sc + flat.res) * (1 + ((p.resPct || 0) + aura.def) / 100)),
    spd: Math.round((B.spd + Math.floor(lv / 10) + hs.stage + flat.spd + (p.spd || 0)) * (1 + aura.spd / 100)),
    crit: B.crit + (p.crit || 0) + aura.crit, critDmg: 60 + (p.critDmg || 0)
  };
  for (const k of ['hpPct', 'atkPct', 'magPct', 'defPct', 'resPct', 'spd', 'crit', 'critDmg']) delete p[k];
  for (const k of ['dodge', 'ultCharge', 'healPct', 'thorns']) if (aura[k]) p[k] = (p[k] || 0) + aura[k];
  if (aura.startBuffRegen) p.startBuffRegen = 1;
  st.p = p;
  st.power = Math.round(st.hp * .25 + (st.atk + st.mag) * 2.2 + (st.def + st.res) * 1.6 + st.spd * 4 + st.crit * 2 + (lv >= ACT2_LVL ? 40 : 0) + hs.stage * 60);
  return st;
}
function mountOf(key) { if (!G.heroes[key] || !G.mounts || (G.ride || {})[key] === false) return null; return MOUNTS.find(m => m.heroes.includes(key) && G.mounts[m.id]) || null; }
function mountFor(key) { return MOUNTS.find(m => m.heroes.includes(key)) || null; }
function grantMounts() { G.mounts = G.mounts || {}; const got = []; for (const m of MOUNTS) if (!G.mounts[m.id] && (G.story.ch > m.ch || G.story.loop > 0)) { G.mounts[m.id] = 1; got.push(m); } return got; }
/* ---------- Ringe der Macht ---------- */
const RING_STARS = [0, 1, 1.25, 1.55, 1.9, 2.3];
function ringProg() { return (G.story?.loop || 0) > 0 ? 999 : (G.story?.ch || 0); }
function ringEligible() { return RINGS.filter(r => r.from <= ringProg() && ((G.rings?.[r.id]?.stars || 0) < 5)); }
function grantFragments(n, silent) {
  G.frags = G.frags || {}; G.rings = G.rings || {}; const got = [];
  for (let i = 0; i < n; i++) { const el = ringEligible(); if (!el.length) break; let x = Math.random() * el.reduce((a, r) => a + 1 / r.need, 0), pr = el[0]; for (const r of el) { x -= 1 / r.need; if (x <= 0) { pr = r; break; } } G.frags[pr.id] = (G.frags[pr.id] || 0) + 1; got.push(pr); }
  if (got.length && !silent && typeof onFragments === 'function') onFragments(got); return got;
}
function ringCost(id) { const R = RINGS.find(r => r.id === id), st = G.rings?.[id]?.stars || 0; return st === 0 ? R.need : Math.ceil(R.need * (.5 + st * .25)); }
function canForge(id) { const st = G.rings?.[id]?.stars || 0; return st < 5 && (G.frags?.[id] || 0) >= ringCost(id); }
function forgeableCount() { return RINGS.filter(r => canForge(r.id)).length; }
function fragTotal() { return Object.values(G.frags || {}).reduce((a, b) => a + b, 0); }
function ringOf(key) { for (const R of RINGS) { const r = G.rings?.[R.id]; if (r && r.stars > 0 && r.owner === key) return { R, stars: r.stars }; } return null; }
function ringBonus(R, stars) { const m = RING_STARS[stars] || 1, o = {}; for (const [k, v] of Object.entries(R.e)) o[k] = Math.round(v * m * 10) / 10; return o; }
function setRingOwner(id, key) { for (const R of RINGS) { const r = G.rings[R.id]; if (r && r.owner === key) r.owner = null; } if (G.rings[id]) G.rings[id].owner = key; save(); }
function autoRings() { let n = 0; const order = RINGS.slice().reverse(); for (const R of order) { const r = G.rings[R.id]; if (!r || r.stars < 1 || (r.owner && G.party.includes(r.owner))) continue; const free = G.party.filter(k => !ringOf(k)).sort((a, b) => heroStats(b).power - heroStats(a).power); if (free.length) { r.owner = free[0]; n++; } } if (n) save(); return n; }
function forgeRing(id) { if (!canForge(id)) return false; G.frags[id] -= ringCost(id); const r = G.rings[id] || (G.rings[id] = { stars: 0, owner: null }); r.stars++; G.stats.rings = RINGS.filter(x => (G.rings[x.id]?.stars || 0) > 0).length; if (!r.owner) autoRings(); save(); return true; }
function gearOf(key) { const hs = G.heroes[key]; if (!hs || !hs.eq) return null; const f = sl => { const it = hs.eq[sl] && itemById(hs.eq[sl]); return it ? { r: it.r, e: it.enh || 0 } : null; }; return { w: f('weapon'), a: f('armor'), t: f('trinket') }; }
function heroLook(key) { const H = HEROES[key], hs = G.heroes[key] || { stage: 0 }; const L = Object.assign({ wpn: H.wpn }, H.look); for (let i = 1; i <= hs.stage; i++) Object.assign(L, H.stageLook[i] || {}); for (const k in L) if (L[k] === null) delete L[k];
  const mt = mountOf(key); if (mt) L.mount = { kind: mt.kind, look: mt.look };
  const rg = ringOf(key); if (rg) { L.ring = rg.R.c; L.ringOne = rg.R.id === 'einer' ? 1 : 0; }
  const gr = gearOf(key); if (gr) { L.gear = gr; if (gr.w && gr.w.r >= 3) L.wc = gr.w.r >= 4 ? '#fff0b8' : '#e4d6ff'; }
  return L; }
function lookAtStage(key, st) { const H = HEROES[key]; const L = Object.assign({ wpn: H.wpn }, H.look); for (let i = 1; i <= st; i++) Object.assign(L, H.stageLook[i] || {}); for (const k in L) if (L[k] === null) delete L[k]; return L; }
function heroTitle(key) { const hs = G.heroes[key]; return HEROES[key].stages[hs ? hs.stage : 0]; }
function heroKit(key) {
  const H = HEROES[key], hs = G.heroes[key] || newHeroState();
  const ult = hs.stage >= 2 ? Object.assign({}, H.ult, { n: H.ult.n + ' ✦', dmg: H.ult.dmg ? H.ult.dmg * 1.35 : H.ult.dmg, healPct: H.ult.healPct ? Math.min(1, H.ult.healPct * 1.3) : H.ult.healPct, up: 1 }) : H.ult;
  return { act: H.act, act2: hs.lvl >= ACT2_LVL ? H.act2 : null, ult };
}
/* Gemeinsame Gruppenstufe: alle Helden steigen nur durch Kämpfe auf und sind immer gleich stark gelevelt */
const LVL_MAX = 250;
function syncLevels() { if (!G.team) return; for (const k of Object.keys(G.heroes)) { G.heroes[k].lvl = G.team.lvl; G.heroes[k].xp = G.team.xp; } G.stats.maxLvl = Math.max(G.stats.maxLvl || 1, G.team.lvl); }
function teamXp(xp) { const t = G.team; let ups = 0; t.xp += Math.round(xp * 1.35); while (t.lvl < LVL_MAX && t.xp >= xpNeed(t.lvl)) { t.xp -= xpNeed(t.lvl); t.lvl++; ups++; } if (t.lvl >= LVL_MAX) t.xp = 0; syncLevels(); if (ups) track('levels', ups); return ups; }
function bestHeroFor(it) { let best = null; const by = equippedBy(it.id); if (by && G.party.includes(by)) return null; for (const k of G.party) { if (!G.heroes[k] || !canEquip(k, it) || G.heroes[k].eq[it.slot] === it.id) continue; const d = Math.round(powerDiff(k, it)); if (d > 0 && (!best || d > best.d)) best = { k, d }; } return best; }
function upgradeFor(k, sl) { for (const it of G.inv) { if (it.slot !== sl || !canEquip(k, it) || G.heroes[k].eq[sl] === it.id) continue; const by = equippedBy(it.id); if (by && by !== k && G.party.includes(by)) continue; if (powerDiff(k, it) > 0) return true; } return false; }
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
function canEvolve(key) { const hs = G.heroes[key]; if (hs.stage >= 2) return null; const cap = STAGE_CAP[hs.stage], lvlOk = hs.lvl >= cap, gold = lvlOk ? 0 : Math.round(EVOLVE_COST[hs.stage].gold * (1 + (cap - hs.lvl) / 6)); return { cost: { gold }, lvlOk, ok: lvlOk || G.gold >= gold }; }
function evolve(key) { const e = canEvolve(key); if (!e || !e.ok) return false; G.gold -= e.cost.gold; G.heroes[key].stage++; G.stats.evolutions++; save(); return true; }

/* ---------- Gegenstände ---------- */
function rollRarity(kind) {
  const W = { normal: [58, 30, 10, 1.8, .2], elite: [20, 42, 28, 8.5, 1.5], boss: [0, 22, 45, 27, 6], chest: [0, 0, 30, 55, 15] }[kind] || [60, 30, 9, 1, 0];
  let r = Math.random() * W.reduce((a, b) => a + b, 0), out = 0; for (let i = 0; i < W.length; i++) { r -= W[i]; if (r <= 0) { out = i; break; } }
  const loop = G?.story?.loop || 0; if (loop && out < 4 && Math.random() < Math.min(.5, .15 * loop)) out++;
  return out;
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
function addItem(it) { if (it.r >= 2) it.nw = 1; G.inv.push(it); if (it.r === 3) G.stats.epics++; if (it.r === 4) G.stats.legends++; }
function powerDiff(k, it) { const hs = G.heroes[k], prev = hs.eq[it.slot], before = heroStats(k).power; hs.eq[it.slot] = it.id; const after = heroStats(k).power; hs.eq[it.slot] = prev; return after - before; }
function autoEquip(keys = G.party) {
  let n = 0; const ch = []; autoEquip.last = ch;
  for (const k of keys) for (const slot of Object.keys(SLOTS)) {
    let best = null, bestD = 0;
    for (const it of G.inv) { if (it.slot !== slot || !canEquip(k, it)) continue; const by = equippedBy(it.id); if (by && by !== k && G.party.includes(by)) continue; if (G.heroes[k].eq[slot] === it.id) continue; const d = powerDiff(k, it); if (d > bestD) { bestD = d; best = it; } }
    if (best) { equip(k, best); n++; ch.push({ k, it: best, d: Math.round(bestD) }); }
  }
  // Überschuss automatisch zerlegen (gewöhnlich, nicht angelegt), damit der Beutel übersichtlich bleibt
  if (G.inv.length > 80) G.inv.filter(it => it.r === 0 && !equippedBy(it.id)).forEach(salvage);
  return n;
}
function itemLines(it) {
  const s = itemStats(it), out = [];
  if (it.set) { const S2 = SETS.find(x => x.id === it.set); if (S2) out.push(`Set: ${S2.n}`); }
  for (const [k, v] of Object.entries(s)) { const n = { atk: 'Angriff', mag: 'Magie', def: 'Verteidigung', res: 'Widerstand', hp: 'LP', spd: 'Tempo' }[k] || AFFIX[k]?.n || k; out.push(`+${v} ${n}`); }
  return out;
}

/* ---------- Story & Belohnungen ---------- */
const LOOP_LVL = 40;
function chapterLvl(ch = G.story.ch) { return STORY[ch].lvl + G.story.loop * LOOP_LVL; }
function waveLvl(wave) { return chapterLvl() + Math.floor(wave / 3); }
function chapterWaves(i = G.story.ch) {
  const C = STORY[i], w = C.waves, pool = [...new Set(w.flat())].filter(k => !ENEMIES[k].elite);
  const plus = (grp, j) => grp.length >= 4 ? grp : [...grp, pool[(i * 3 + j) % pool.length]];
  return [w[0], w[1], w[2], w[3], w[4], plus(w[0], 1), plus(w[2], 2), plus(w[3], 3)].slice(0, WAVES);
}
const isEliteWave = w => w === 3 || w === 7;
function battleReward(kind, enemies) {
  const lb = 1 + .25 * (G.story.loop || 0);
  const xp = Math.round(enemies.reduce((a, e) => a + e.xp, 0) * (kind === 'elite' ? 1.3 : 1) * lb);
  const gold = Math.round(enemies.reduce((a, e) => a + e.gold, 0) * rnd(.85, 1.15) * lb);
  const lvl = enemies.reduce((a, e) => Math.max(a, e.lvl), 1);
  const items = [];
  const n = kind === 'boss' ? ri(2, 3) : kind === 'elite' ? 1 : (Math.random() < .3 ? 1 : 0);
  for (let i = 0; i < n; i++) items.push(genItem(lvl + ri(-1, 1), rollRarity(kind)));
  const frags = kind === 'boss' ? 1 + (Math.random() < .3 ? 1 : 0) : kind === 'elite' ? (Math.random() < .15 ? 1 : 0) : (Math.random() < .025 ? 1 : 0);
  return { xp, gold, items, frags };
}
function applyReward(rw, partyKeys) {
  G.gold += rw.gold; if (rw.frags) grantFragments(rw.frags); rw.items.forEach(addItem); if (rw.items.length) track('items', rw.items.length);
  const res = {};
  if (!G.team) G.team = { lvl: 1, xp: 0 }; const from = G.team.lvl, ups = teamXp(rw.xp); for (const k of owned()) res[k] = { ups, from };
  if (G.settings.autoEquip) autoEquip();
  return res;
}

/* ---------- Erfolge ---------- */
function achState(a) { const v = G.stats[a.stat] || 0; return { v, done: v >= a.goal, claimed: !!G.ach[a.id] }; }
function claimAch(a) { const s = achState(a); if (!s.done || s.claimed) return false; G.ach[a.id] = 1; if (a.r.gold) G.gold += a.r.gold; if (a.r.frags) grantFragments(a.r.frags); save(); return true; }
function claimableCount() { return ACHIEVEMENTS.filter(a => { const s = achState(a); return s.done && !s.claimed; }).length; }

/* ---------- Training ---------- */
function trainCost(k) { const hs = G.heroes[k]; return Math.round(xpNeed(hs.lvl) * 1.6 + hs.lvl * 10); }
function train(k) { const hs = G.heroes[k], c = trainCost(k); if (hs.lvl >= STAGE_CAP[hs.stage] || G.gold < c) return false; G.gold -= c; hs.lvl++; hs.xp = 0; G.stats.maxLvl = Math.max(G.stats.maxLvl, hs.lvl); track('levels', 1); save(); return true; }

/* ---------- Siegestruhe (füllt sich durch Kämpfe) ---------- */
const CHEST_MAX = 30;
function addChest(n) { G.chest = Math.min(CHEST_MAX, (G.chest || 0) + n); }
function chestState() { const n = G.chest || 0, lvl = chapterLvl(); return { n, gold: n * (12 + lvl * 5), xp: n * (15 + lvl * 9), frags: Math.floor(n / 10), items: Math.floor(n / 6), ready: n >= 5, full: n >= CHEST_MAX }; }
function claimChest() {
  const st = chestState(); if (!st.ready) return null;
  const items = []; for (let i = 0; i < st.items; i++) items.push(genItem(chapterLvl() + 1, rollRarity('elite')));
  const rw = { gold: st.gold, xp: st.xp, frags: st.frags, items };
  const res = applyReward(rw, G.party); G.chest = 0; save(); return { rw, res };
}

/* ---------- Auftragstafel (abgeholte Aufträge werden sofort ersetzt) ---------- */
function ensureBoard() {
  if (G.board && G.board.active?.length === 4) return G.board;
  G.board = { active: [], done: 0, bonus: 0 }; while (G.board.active.length < 4) addQuest(); save(); return G.board;
}
function addQuest() {
  const used = G.board.active.map(q => q.id), pool = QUESTS.filter(q => !used.includes(q.id) && (q.id !== 'tower' || G.story.ch >= 3));
  const q = pick(pool), scale = 1 + Math.floor(G.board.done / 8) * .5;
  G.board.active.push({ id: q.id, goal: Math.round(q.goal * scale), prog: 0 });
}
function track(stat, n = 1) { if (!G) return; const b = ensureBoard(); for (const a of b.active) { const q = QUESTS.find(x => x.id === a.id); if (q.stat === stat) a.prog += n; } }
function questReward() { const lvl = chapterLvl(); return { gold: 260 + lvl * 30 }; }
function questState(i) { const a = ensureBoard().active[i], q = QUESTS.find(x => x.id === a.id); return { a, q, v: a.prog, goal: a.goal, done: a.prog >= a.goal, r: questReward() }; }
function claimQuest(i) { const st = questState(i); if (!st.done) return false; G.gold += st.r.gold; G.board.done++; G.board.bonus++; G.board.active.splice(i, 1); addQuest(); save(); return true; }
function boardBonusReady() { return (ensureBoard().bonus || 0) >= 4; }
function claimBoardBonus() { if (!boardBonusReady()) return null; G.board.bonus -= 4; const it = genItem(chapterLvl() + 2, Math.random() < .2 ? 4 : 3); addItem(it); grantFragments(1); if (G.settings.autoEquip) autoEquip(); save(); return it; }
function questsClaimable() { const b = ensureBoard(); return b.active.filter((a, i) => questState(i).done).length + (boardBonusReady() ? 1 : 0); }

/* ---------- Relikte ---------- */
function grantRelic(i) { if (!RELICS[i] || G.relics[i]) return null; G.relics[i] = 1; G.stats.relics = Object.keys(G.relics).length; save(); return RELICS[i]; }

/* ---------- Orthanc-Turm ---------- */
function towerFloor() { return G.tower.best + 1; }
function towerLvl(f = towerFloor()) { return Math.round(4 + f * 2.2); }
function towerGroup(f = towerFloor()) {
  const pool = STORY.filter(c => c.lvl <= towerLvl(f) + 4); const C = pool.length ? pool[(f * 7) % pool.length] : STORY[0];
  if (f % 10 === 0) return { group: C.boss, kind: 'boss', bg: C.bg };
  const w = C.waves[(f * 3) % C.waves.length];
  return { group: f % 5 === 0 ? [...w, 'mordor_troll'].slice(0, 5) : w, kind: f % 5 === 0 ? 'elite' : 'normal', bg: C.bg };
}
function towerReward(f) { return { gold: 160 + f * 50, frags: f % 5 === 0 ? 1 : 0 }; }

/* ---------- Begleiter ---------- */
function grantCompanion(id) { if (G.comps[id]) return null; G.comps[id] = 1; if (!G.companion) G.companion = id; G.stats.comps = Object.keys(G.comps).length; save(); return COMPANIONS.find(c => c.id === id); }
function chapterCompanion(ch) { return COMPANIONS.find(c => c.from.ch === ch); }

/* ---------- Sets ---------- */
function chapterSet(ch) { return SETS.find(x => x.ch === ch); }
function setOwned(id) { const o = {}; for (const it of G.inv) if (it.set === id && (!o[it.slot] || it.r > o[it.slot].r || it.lvl > o[it.slot].lvl)) o[it.slot] = it; return o; }
function genSetItem(S2, lvl, r = 3) {
  const slot = pick(['weapon', 'armor', 'trinket']);
  let base = slot; if (slot === 'weapon') { const cls = G.party.filter(k => HEROES[k]).flatMap(k => CLASSES[HEROES[k].cls].wcls); base = cls.length ? pick(cls) : 'klinge'; }
  const it = genItem(lvl, r, { base }); it.set = S2.id; it.name = `${S2.n}: ${{ weapon: BASES[base].names[0], armor: 'Rüstung', trinket: 'Amulett' }[slot]}`; return it;
}
function checkFullSet() { for (const k of G.party) { const n = {}; for (const s2 of Object.keys(SLOTS)) { const it = G.heroes[k].eq[s2] && itemById(G.heroes[k].eq[s2]); if (it?.set) n[it.set] = (n[it.set] || 0) + 1; } if (Object.values(n).some(x => x >= 3)) G.stats.fullSet = 1; } }

/* ---------- Nebenquests ---------- */
function sideUnlocked(sd) { return G.story.ch > sd.after || G.story.loop > 0 || !!(G.unl && G.unl['side:' + sd.id]); }
function sideLvl(sd) { return STORY[sd.after].lvl + 3 + G.story.loop * LOOP_LVL; }

/* ---------- Heldenreise-Modifikatoren ---------- */
function activeMods() { const L = G.story.loop || 0; const out = []; for (let i = 0; i < Math.min(4, L); i++) out.push(MODS[(L * 2 + i * 3) % MODS.length]); return [...new Set(out)]; }
function modVal(k) { let v = 1; for (const m of activeMods()) if (m.e[k] !== undefined) v *= m.e[k]; return v; }
function hasMod(k) { return activeMods().some(m => k in m.e); }

/* ---------- Raid-Prüfungen ---------- */
function raidLvl() { return Math.max(...G.party.map(k => G.heroes[k].lvl)) + 2; }
function raidRewards(pct, first) { const lvl = raidLvl(); return { gold: Math.round((200 + lvl * 40) * (1 + pct * 4)), frags: Math.round(pct * 2) + (first ? 1 : 0), items: Math.max(1, Math.round(pct * 4)) }; }

/* ---------- Spielstand sichern ---------- */
function exportSave() { save(); return btoa(unescape(encodeURIComponent(JSON.stringify(G)))); }
function importSave(code) { try { const g = JSON.parse(decodeURIComponent(escape(atob(code.trim())))); if (!g || g.v !== 4 || !g.heroes) return false; store.set(SAVE_KEY, g); return true; } catch (e) { return false; } }
