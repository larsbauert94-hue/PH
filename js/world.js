'use strict';
/* =====================================================================
   RINGFAHRT – Welt-Engine
   Dauerhaft laufende Szene im Vollbild: Die Gruppe wandert durch eine
   Parallax-Landschaft, Gegner treten auf, Kämpfe laufen automatisch.
   ===================================================================== */
const LH = 144, YO = -14; // Horizont nach oben versetzt, damit unten Platz für die Heldenleiste bleibt
const FX_COL = {
  slash: ['#ffffff', '#d8e0f0'], arrow: ['#e8d8b0'], fire: ['#ff5a1a', '#ffb030', '#ffe070'], light: ['#ffffff', '#fff6c0', '#c8e8ff'],
  lightning: ['#ffffff', '#a8d8ff', '#6ab0ff'], heal: ['#9fe07a', '#d8ffb0', '#ffffff'], buff: ['#f3d78f', '#ffffff'], axe: ['#c8ccd0'],
  stone: ['#9a9a92', '#c8c8c0'], ice: ['#c8f0ff', '#8ad0ff', '#ffffff'], water: ['#4a9ae0', '#8ac8f0', '#ffffff'], dark: ['#8a3ac8', '#4a1a6a', '#d080ff'],
  leaf: ['#6ab03a', '#a8d860', '#3a7a2a'], bite: ['#ffffff', '#e04040'], web: ['#e8e8f0', '#c8c8d8'], holy: ['#ffe080', '#ffffff', '#ffd040']
};
const DIFF_E = { hp: 1, dmg: 1 };
/* Szenenlicht: Farbe & Richtung des Kantenlichts, Farbstimmung (oben/unten) */
const LIGHT = {
  _: { c: '220,230,255', a: .22, from: 'right' },
  shire: { c: '255,236,190', a: .3, from: 'right', grade: ['#ffe8b0', '#2a4a20'] }, weather: { c: '180,200,255', a: .28, from: 'left', grade: ['#6a80c0', '#101828'] },
  moria: { c: '255,120,50', a: .38, from: 'below', grade: ['#1a1010', '#ff5a20'] }, amonhen: { c: '230,255,210', a: .24, from: 'right', grade: ['#d8f0c0', '#1a2a1a'] },
  helm: { c: '190,205,230', a: .22, from: 'left', grade: ['#8090a8', '#1a1c22'] }, cirith: { c: '200,150,255', a: .3, from: 'left', grade: ['#6a40a0', '#100818'] },
  pelennor: { c: '255,150,80', a: .32, from: 'below', grade: ['#ffb070', '#3a1a10'] }, doom: { c: '255,90,40', a: .42, from: 'below', grade: ['#3a0a06', '#ff4010'] },
  snow: { c: '210,235,255', a: .3, from: 'right', grade: ['#e0f0ff', '#4a6080'] }, sea: { c: '200,230,255', a: .26, from: 'right', grade: ['#a8c8f0', '#1a2a40'] },
  south: { c: '255,210,150', a: .3, from: 'right', grade: ['#ffd8a0', '#4a2a10'] }, rhun: { c: '255,190,220', a: .26, from: 'left', grade: ['#e0a0c0', '#20142a'] },
  khazad: { c: '140,220,255', a: .32, from: 'left', grade: ['#5a8ab0', '#0a1018'] }, eregion: { c: '255,180,110', a: .32, from: 'right', grade: ['#ffc080', '#2a1410'] },
  mirkwood: { c: '200,255,170', a: .22, from: 'left', grade: ['#4a6a3a', '#060c06'] }, lake: { c: '255,225,190', a: .28, from: 'right', grade: ['#f0d8b0', '#1a2a38'] },
  erebor: { c: '255,200,120', a: .34, from: 'right', grade: ['#ffc070', '#2a1a10'] }, dolguldur: { c: '150,255,180', a: .3, from: 'left', grade: ['#3a6a4a', '#060a08'] }
};
STATUS.fly = { n: 'Fliegt', l: 'FLUG', c: '#c8e8ff', d: 'Nahkampfangriffe verfehlen zu 50 %.' };

class World {
  constructor(canvas, hooks = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.h = hooks;
    this.time = 0; this.timers = []; this.speed = 1; this.hold = false;
    this.heroes = []; this.enemies = []; this.parts = []; this.projs = []; this.nums = []; this.fxs = [];
    this.scroll = 0; this.walking = false; this.fighting = false; this.busy = false; this.bgKey = 'shire'; this.fade = 0;
    this.cam = { z: 1.14, tz: 1.14, x: 128, y: 92, tx: 128, ty: 92 }; this.shakeV = 0; this.flashV = null; this.turn = 0;
    this.LW = 256; this.resize();
    this.last = performance.now(); this.raf = requestAnimationFrame(t => this.loop(t));
  }
  /* ---------- Layout ---------- */
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = r.width || 800, ch = r.height || 450;
    this.LW = clamp(Math.round(LH * cw / ch), 200, 360);
    this.cv.width = Math.round(cw * dpr); this.cv.height = Math.round(ch * dpr);
    this.s = this.cv.height / LH; this.ox0 = (this.cv.width - this.LW * this.s) / 2; if (this.cam) { this.cam.x = this.cam.tx = this.LW / 2; }
    this.layoutHeroes(); this.layoutEnemies(true);
  }
  get cx() { return this.LW / 2; }
  spread() { return clamp(this.LW / 256, 1, 1.35); }
  setBg(key) {
    if (key === this.bgKey) return;
    this.fade = 1; this.nextBg = key;
  }
  /* ---------- Einheiten ---------- */
  setParty(keys) {
    const aura = partyAura(keys);
    const old = new Map(this.heroes.map(h => [h.key, h]));
    this.heroes = keys.filter(k => G.heroes[k]).map(k => {
      const st = heroStats(k, aura), H = HEROES[k], C = CLASSES[H.cls], o = old.get(k);
      const u = o || this.prep({ side: 'hero', key: k, energy: 0, statuses: [], cd: {}, threat: 0 });
      Object.assign(u, { name: H.n, type: 'hum', look: heroLook(k), wpn: H.wpn, role: C.role, maxHp: st.hp, atk: st.atk, mag: st.mag, def: st.def, res: st.res, spd: st.spd, crit: st.crit, critDmg: st.critDmg, p: st.p, kit: heroKit(k), threatMul: C.threat * (1 + (st.p.threat || 0) / 100), atkStat: C.base.mag > C.base.atk && H.wpn === 'staff' ? 'mag' : 'atk', lvl: G.heroes[k].lvl });
      if (!o) u.hp = u.maxHp; else u.hp = Math.min(u.hp, u.maxHp);
      const D = RIG.dims('hum', u.look); u.h = D.h; u.big = D.big; u.w = D.w;
      return u;
    });
    this.layoutHeroes();
  }
  prep(u) { u.ox = 0; u.oy = 0; u.kb = 0; u.anim = { n: 'idle', el: 0 }; u.gt0 = Math.random() * 5000; u.flash = 0; u.fade = 1; u.atb = 0; return u; }
  slotRank(u) { if (u.role === 'tank') return 0; if (u.role === 'dd' && !['bow', 'staff'].includes(u.wpn)) return 1; if (u.role === 'dd') return 2; return 3; }
  layoutHeroes() {
    const S = [[-26, 106], [-46, 93], [-44, 119], [-70, 99], [-74, 121]], sp = this.spread();
    [...this.heroes].sort((a, b) => this.slotRank(a) - this.slotRank(b)).forEach((u, i) => { const s = S[i] || S[4]; u.x = this.cx + s[0] * sp; u.y = s[1]; });
  }
  layoutEnemies(keep) {
    const sp = this.spread(), cx = this.cx;
    const boss = this.enemies.find(e => e.big);
    let S = [[26, 106], [46, 93], [44, 119], [70, 99], [74, 121], [92, 110]];
    if (boss) { boss.x = cx + 66 * sp; boss.y = 113; S = [[24, 96], [26, 120], [12, 108], [92, 122], [96, 96]]; }
    this.enemies.filter(e => e !== boss).sort((a, b) => (a.ranged ? 1 : 0) - (b.ranged ? 1 : 0)).forEach((u, i) => { if (keep && u.x !== undefined && !u.summoned) { const s = S[i % S.length]; u.x = cx + s[0] * sp; u.y = s[1]; } else if (u.x === undefined) { const s = S[i % S.length]; u.x = cx + s[0] * sp; u.y = s[1]; } });
  }
  /* Ultimate per Fingertipp: Held handelt als Nächstes, +20 % Heldenmut */
  manualUlt(k) {
    const u = this.heroes.find(h => h.key === k);
    if (!u || !alive(u) || !this.fighting || u.energy < 100 || u.forceUlt) return false;
    u.forceUlt = 1; u.atb = 1e6; this.num(u, 'Heldenmut!', '#ffe39a'); this.burst(u.x, u.y - u.h * .6, 'holy', 12, 1, .5); return true;
  }
  addEnemy(key, lvl, kind) {
    const E = ENEMIES[key], m = 1 + .15 * (lvl - 1) + .002 * (lvl - 1) * (lvl - 1), D = DIFF_E;
    const ps = clamp(.55 + .09 * this.heroes.length, .72, 1), hpMul = (E.boss ? 4.6 * modVal('bossHp') * (this.raid ? 34 : 1) : E.elite ? 3 : 2.6) * D.hp * ps * modVal('hp');
    const u = this.prep({
      side: 'enemy', key, name: E.n, type: E.type, look: Object.assign({ wpn: E.wpn || 'sword' }, E.look), wpn: E.wpn || 'claws',
      maxHp: Math.round(E.hp * m * hpMul), atk: Math.round(E.atk * m * D.dmg * 3.3 * ps * modVal('dmg')), mag: Math.round(E.mag * m * D.dmg * 3.3 * ps * modVal('dmg')), def: Math.round(E.def * m), res: Math.round(E.res * m),
      spd: Math.round(E.spd * modVal('spd')), crit: 5, critDmg: 50, p: {}, boss: !!E.boss, elite: !!E.elite || kind === 'elite', tags: E.tags || [], lvl, statuses: [], cd: {}, threat: 0,
      skills: E.sk.map(id => ESK[id]), xp: Math.round(E.xp * (1 + .22 * (lvl - 1))), gold: Math.round(E.g * (1 + .16 * (lvl - 1))), transform: E.transform, ranged: !!E.ranged,
      atkStat: E.look.glowC && E.wpn === 'staff' ? 'mag' : 'atk'
    });
    if (E.fly) addS(u, 'fly', 99, 0, this);
    u.hp = u.maxHp; const Dm = RIG.dims(u.type, u.look); u.h = Dm.h; u.big = Dm.big; u.w = Dm.w;
    this.enemies.push(u); return u;
  }
  all() { return [...this.heroes, ...this.enemies]; }

  /* ---------- Zeit ---------- */
  wait(ms) { return new Promise(res => this.timers.push({ t: this.time + ms, res })); }
  loop(now) {
    if (this.dead) return;
    let dt = Math.min(60, now - this.last); this.last = now; this.perf(now - this._lastRaw || 0); this._lastRaw = now;
    if (this.hitstop > 0) { this.hitstop -= dt; dt *= .1; } else if (this.slowUntil && this.time < this.slowUntil) dt *= .35;
    this.update(dt * this.speed); this.render();
    this.raf = requestAnimationFrame(t => this.loop(t));
  }
  update(dt) {
    this.time += dt;
    const due = this.timers.filter(t => t.t <= this.time); this.timers = this.timers.filter(t => t.t > this.time); due.forEach(t => t.res());
    if (this.walking) this.scroll += dt * .03;
    if (this.fade > 0) { this.fade -= dt / 700; if (this.fade < .5 && this.nextBg) { this.bgKey = this.nextBg; this.nextBg = null; } if (this.fade < 0) this.fade = 0; }
    for (const u of this.all()) {
      const A = RIG.ANIMS[u.anim.n]; u.anim.el += dt;
      if (!A.loop && !A.hold && u.anim.el >= RIG.animTime(u.anim.n)) u.anim = { n: alive(u) ? (u.holdAnim || (this.walking && u.side === 'hero' ? 'walk' : 'idle')) : 'dead', el: alive(u) ? 0 : 9999 };
      if (u.move) { const m = u.move; m.t += dt; const k = RIG.ease(Math.min(1, m.t / m.dur)); u.ox = m.fx + (m.tx - m.fx) * k; u.oy = m.fy + (m.ty - m.fy) * k; if (m.t >= m.dur) { u.move = null; m.res(); } }
      if (u.flash > 0) u.flash -= dt;
      if (u.kb) { u.kb *= Math.pow(.86, dt / 16); if (Math.abs(u.kb) < .05) u.kb = 0; }
      if (!alive(u) && u.side === 'enemy') u.fade = Math.max(0, u.fade - dt / 1400);
    }
    const c = this.cam, cz = Math.pow(.9, dt / 16); c.z = c.tz + (c.z - c.tz) * cz; c.x = c.tx + (c.x - c.tx) * cz; c.y = c.ty + (c.y - c.ty) * cz;
    for (const p of this.projs) { p.t += dt; if (p.t >= p.dur && !p.done) { p.done = 1; p.res(); } }
    this.projs = this.projs.filter(p => !p.done);
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += (p.g || 0) * dt / 16; if (p.amb && this.walking) p.x -= dt * .03 * .6; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const n of this.nums) n.t += dt; this.nums = this.nums.filter(n => n.t < 1000);
    for (const f of this.fxs) f.t += dt; this.fxs = this.fxs.filter(f => f.t < f.dur);
    this.shakeV = Math.max(0, this.shakeV - dt * .02);
    if (this.flashV) { this.flashV.t += dt; if (this.flashV.t > this.flashV.dur) this.flashV = null; }
    this.ambient(dt);
    if (this.fighting && !this.busy && this.raid && this.time >= this.raidEnd) { this.busy = true; this.finish('time'); }
    if (this.fighting && !this.busy && !this.hold) {
      const live = this.all().filter(alive);
      for (const u of live) u.atb += effSpd(u) * dt * .016;
      const ready = live.filter(u => u.atb >= 100).sort((a, b) => b.atb - a.atb)[0];
      if (ready) this.act(ready);
    }
  }
  ambient(dt) {
    const T = BACKGROUNDS[this.bgKey] || {}; const kind = T.parts;
    if (!kind || kind === 'none') return;
    const rate = { rain: .5, snow: .15, embers: .07, fireflies: .03, leaves: .04, ash: .06, spray: .05 }[kind] || 0;
    if (Math.random() < rate * dt / 16) {
      const p = { t: 0, life: 4500, x: Math.random() * this.LW, y: -2, vx: 0, vy: .5, amb: kind };
      if (kind === 'rain') Object.assign(p, { vx: -.6, vy: 3.2, life: 900, c: '#8a9ab0' });
      if (kind === 'snow') Object.assign(p, { vx: -.15, vy: .35, c: '#ffffff' });
      if (kind === 'embers') Object.assign(p, { y: LH, vy: -.45, vx: rnd(-.2, .2), c: pick(['#ff6a1a', '#ffb040', '#ff3a10']) });
      if (kind === 'fireflies') Object.assign(p, { y: rnd(50, 115), vy: rnd(-.1, .1), vx: rnd(-.15, .15), c: '#e8ff80', life: 3000 });
      if (kind === 'leaves') Object.assign(p, { vx: .3, vy: .4, c: pick(['#6a9a3a', '#a8a040']) });
      if (kind === 'ash') Object.assign(p, { vx: .15, vy: .25, c: '#8a8088' });
      if (kind === 'spray') Object.assign(p, { y: 80, vy: -.4, vx: rnd(-.3, .3), g: .02, life: 900, c: '#c8e0f0' });
      this.parts.push(p);
    }
  }

  /* ---------- Reise & Kampf ---------- */
  async walk(ms) {
    this.walking = true; this.heroes.filter(alive).forEach(h => this.setAnim(h, 'walk'));
    await this.wait(ms);
    this.walking = false; this.heroes.filter(alive).forEach(h => this.setAnim(h, 'idle'));
  }
  restoreHeroes() { for (const h of this.heroes) { if (!alive(h)) { h.fade = 1; } h.hp = h.maxHp; h.statuses = []; h.cd = {}; h.threat = 0; h.atb = 0; h.usedRevive = 0; h.usedReviveAlly = 0; h.holdAnim = null; h.anim = { n: 'idle', el: 0 }; } }
  /* Laufenden Kampf ohne Folgen beenden (für „Sofort spielen“) */
  levelFx(lv) { for (const h of this.heroes) if (alive(h)) { this.fxs.push({ k: 'pillar', x: h.x + h.ox, y: h.y + h.oy, c: '#ffe080', t: 0, dur: 900 }); this.burst(h.x + h.ox, h.y + h.oy - h.h * .5, 'holy', 12, .8, .9); } this.flash('#ffe9a8', 350); this.h.banner?.(`Gruppenstufe ${lv}!`, 'ult'); }
  gearUp(u) { this.burst(u.x + u.ox, u.y + u.oy - u.h * .5, 'holy', 14, .9, .7); this.fxs.push({ k: 'pillar', x: u.x + u.ox, y: u.y + u.oy, c: '#ffe080', t: 0, dur: 650 }); }
  abort() {
    if (!this.fighting) { this.abortNext = true; return; }
    this.fighting = false; this.busy = false; this.enemies.forEach(e => { e.fade = 0; e.hp = 0; });
    const cb = this.onFightEnd; this.onFightEnd = null; cb && cb({ win: false, aborted: true, enemies: [], dmgPct: 0 });
  }
  async fight(group, lvl, kind, opts = {}) {
    if (this.abortNext) { this.abortNext = false; return { win: false, aborted: true, enemies: [], dmgPct: 0 }; }
    this.raid = !!opts.raid; this.raidEnd = 0;
    this.enemies = []; this.parts = this.parts.filter(p => p.amb);
    this.arena = group.includes('balrog') ? 'bridge' : null; this.bridgeBreak = null;
    if (opts.keepHp) { for (const h of this.heroes) { h.statuses = []; h.cd = {}; h.threat = 0; h.atb = 0; h.holdAnim = null; if (alive(h)) h.anim = { n: 'idle', el: 0 }; } } else this.restoreHeroes();
    if (hasMod('noEnergy')) this.heroes.forEach(h => h.energy = 0);
    group.forEach(k => this.addEnemy(k, lvl, kind)); this.layoutEnemies();
    // Gegner marschieren heran, während die Gruppe weiterzieht
    this.walking = true; this.heroes.forEach(h => this.setAnim(h, 'walk'));
    const dist = this.LW * .75;
    await Promise.all(this.enemies.map((e, i) => { e.ox = dist + i * 8; this.setAnim(e, 'walk'); return this.moveTo(e, e.x, e.y, 1300 + i * 120); }));
    this.walking = false; this.all().forEach(u => this.setAnim(u, 'idle'));
    if (kind === 'boss') { const bz = this.enemies.find(e => e.boss) || this.enemies[0]; this.cine = { t: this.time, dur: 2100 }; this.focus(bz, 1.34, 1600); this.setAnim(bz, 'shout'); sfx('crit'); await this.wait(350); this.shake(5); this.flash('#ff3a1a', 450); this.fxs.push({ k: 'ring', x: bz.x, y: bz.y - 2, r: 80, c: '#ffd0a0', t: 0, dur: 750 }); this.fxs.push({ k: 'ring', x: bz.x, y: bz.y - 2, r: 46, c: '#ff8a50', t: 0, dur: 520 }); this.burst(bz.x, bz.y - 3, 'stone', 28, 1.9, .5); await this.wait(1100); }
    if (this.abortNext) { this.abortNext = false; this.enemies.forEach(e => { e.fade = 0; e.hp = 0; }); return { win: false, aborted: true, enemies: [], dmgPct: 0 }; }
    this.applyStartPassives();
    const ch = opts.chaos;
    if (ch === 'schnell') this.all().forEach(u => u.spd = Math.round(u.spd * 1.7));
    if (ch === 'glas') this.all().forEach(u => { u.atk *= 2; u.mag *= 2; u.maxHp = Math.round(u.maxHp * .6); u.hp = Math.min(u.hp, u.maxHp); });
    if (ch === 'energie') this.heroes.forEach(h => { if (alive(h)) h.energy = 100; });
    if (ch === 'krit') this.all().forEach(u => { u.crit += 45; u.critDmg += 50; });
    if (ch === 'riesen') this.enemies.forEach(e => { e.maxHp = Math.round(e.maxHp * 1.8); e.hp = e.maxHp; e.atk = Math.round(e.atk * 1.15); });
    [...this.heroes, ...this.enemies].forEach(u => { u.atb = rnd(0, 40) + u.spd; });
    this.fighting = true; this.busy = false; this.turn = 0;
    if (this.raid) this.raidEnd = this.time + (opts.time || 45000);
    return new Promise(res => { this.onFightEnd = res; });
  }
  applyStartPassives() {
    const hs = this.heroes.filter(alive);
    for (const u of hs) {
      const p = u.p;
      if (p.startShieldSelf) addS(u, 'shield', 5, Math.round(u.maxHp * p.startShieldSelf), this);
      if (p.startShieldAll) hs.forEach(t => addS(t, 'shield', 4, Math.round(u.mag * p.startShieldAll), this));
      if (p.startBuffRegen) hs.forEach(t => addS(t, 'regen', 3, 0, this));
      if (p.startInvis) addS(u, 'invis', 2, 0, this);
      if (p.startHaste) addS(u, 'haste', 3, 0, this);
    }
  }
  checkEnd() { if (!this.fighting) return null; if (this.enemies.every(e => !alive(e))) return 'win'; if (this.heroes.every(h => !alive(h))) return 'lose'; if (this.raid && this.time >= this.raidEnd) return 'time'; return null; }
  async finish(res) {
    this.fighting = false; this.busy = true;
    if (res === 'win' || res === 'time') { this.heroes.filter(alive).forEach(h => { h.holdAnim = 'victory'; this.setAnim(h, 'victory'); }); sfx('win'); }
    else sfx('lose');
    await this.wait(1300);
    this.heroes.forEach(h => { h.holdAnim = null; if (alive(h)) this.setAnim(h, 'idle'); });
    this.busy = false;
    const boss = this.enemies.find(e => e.boss);
    const cb = this.onFightEnd; this.onFightEnd = null; cb && cb({ win: res === 'win', timeout: res === 'time', enemies: this.enemies, dmgPct: boss ? 1 - boss.hp / boss.maxHp : 0 });
  }
  async act(u) {
    this.busy = true; u.atb = 0; this.active = u; this.turn++;
    try {
      const skip = await this.turnStart(u);
      if (alive(u) && !skip && !this.checkEnd()) { const plan = this.ai(u); if (plan) await this.perform(u, plan.sk, plan.t, plan.ult); }
      u.manualUlt = 0;
    } catch (e) { console.error(e); }
    this.active = null;
    const end = this.checkEnd(); if (end) return this.finish(end);
    await this.wait(110);
    this.busy = false;
  }
  async turnStart(u) {
    let ticked = false;
    for (const s of [...u.statuses]) {
      const pct = { bleed: .05, burn: .06, poison: .06 }[s.id];
      if (pct) { const d = Math.max(1, Math.round(u.maxHp * pct * (u.boss ? .4 : 1))); u.hp = Math.max(0, u.hp - d); this.num(u, d, STATUS[s.id].c); u.flash = 80; ticked = true; if (u.hp <= 0) { this.die(u); return true; } }
      if (s.id === 'regen') { this.heal(u, u, u.maxHp * .07, { silent: 1 }); ticked = true; }
    }
    if (u.p?.regenTurn) this.heal(u, u, u.maxHp * u.p.regenTurn / 100, { silent: 1 });
    const stunned = !!hasS(u, 'stun');
    u.statuses.forEach(s => { if (s.dur < 90) s.dur--; }); u.statuses = u.statuses.filter(s => s.dur > 0);
    for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--;
    if (ticked) await this.wait(280);
    if (stunned) { this.num(u, 'Betäubt', '#f3d78f'); this.setAnim(u, 'hurt'); await this.wait(420); return true; }
    if (u.boss && u.hp < u.maxHp * .5 && !u.phased) {
      u.phased = 1;
      if (u.transform) await this.transformUnit(u);
      else if (PHASE2[u.key]) await this.phaseTwo(u);
      else { addS(u, 'enrage', 99, 0, this); this.h.banner?.(`${u.name} gerät in Raserei!`, 'foe'); this.flash('#ff3a1a', 400); this.shake(3); sfx('crit'); await this.wait(600); }
    }
    return false;
  }
  async phaseTwo(u) {
    const P2 = PHASE2[u.key];
    this.h.banner?.(P2.msg, 'warn'); this.flash('#ff3a1a', 500); this.shake(4); sfx('ult'); this.focus(u, 1.24, 1300);
    addS(u, 'enrage', 99, 0, this);
    if (P2.fly) { addS(u, 'fly', 99, 0, this); u.flyY = 1; }
    if (P2.add) u.skills = [...u.skills, ...P2.add.map(id => ESK[id])];
    for (const k of P2.summon || []) {
      if (this.enemies.filter(alive).length >= 5) break;
      const e = this.addEnemy(k, Math.max(1, u.lvl - 1), 'normal'); e.summoned = 1;
      const sp = this.spread(), cx = this.cx, free = [[22, 96], [24, 122], [10, 108], [40, 100], [40, 124]].map(s2 => [cx + s2[0] * sp, s2[1]]).find(s2 => !this.enemies.some(o => alive(o) && o !== e && Math.abs(o.x - s2[0]) < 8 && Math.abs(o.y - s2[1]) < 8)) || [cx + 30, 108];
      e.x = free[0]; e.y = free[1]; e.atb = 0; this.burst(e.x, e.y - 8, 'dark', 16, 1.2, .5); await this.wait(150);
    }
    await this.wait(600);
  }
  async transformUnit(u) {
    const T = u.transform, E = ENEMIES[T.to];
    this.h.banner?.(T.msg, 'foe'); this.flash('#ffffff', 700); this.shake(4); sfx('ult'); this.focus(u, 1.3, 1400);
    for (let i = 0; i < 4; i++) { this.burst(u.x, u.y - 20, 'fire', 14, 1.6, .5); await this.wait(120); }
    Object.assign(u, { key: T.to, name: E.n, type: E.type, look: Object.assign({ wpn: E.wpn }, E.look), wpn: E.wpn, skills: E.sk.map(id => ESK[id]) });
    const D = RIG.dims(u.type, u.look); u.h = D.h; u.big = D.big; u.w = D.w;
    u.atk = Math.round(u.atk * 1.15); u.mag = Math.round(u.mag * 1.15); addS(u, 'enrage', 99, 0, this);
    this.h.boss?.(u);
    await this.wait(500);
  }

  /* ---------- KI ---------- */
  foesOf(u) { return (u.side === 'hero' ? this.enemies : this.heroes).filter(alive); }
  friendsOf(u) { return (u.side === 'hero' ? this.heroes : this.enemies).filter(alive); }
  useful(u, s, friends, foes) {
    const lowF = Math.min(...friends.map(f => f.hp / f.maxHp)), dead = this.heroes.some(h => !alive(h)) && u.side === 'hero';
    const missing = friends.reduce((a, f) => a + (1 - f.hp / f.maxHp), 0) / friends.length;
    if (s.revive) return dead || lowF < .55 || missing > .3;
    if ((s.heal || s.healPct) && !s.dmg) return s.tgt === 'allAllies' ? (missing > .15 || lowF < .5) : lowF < .85;
    if (s.dmg) return true;
    if (s.taunt && !hasS(u, 'taunt')) return true;
    const st = (s.buff || s.self || [[null]])[0][0];
    if (!st) return true;
    const tg = s.tgt === 'allAllies' ? friends : [u];
    return !tg.every(f => hasS(f, st)) || (s.cleanse && friends.some(f => f.statuses.some(x => STATUS[x.id].bad)));
  }
  ai(u) {
    const foes = this.foesOf(u), friends = this.friendsOf(u); if (!foes.length) return null;
    const basic = basicSkill(u);
    if (u.side === 'enemy' && u.boss) {
      u.acts = (u.acts || 0) + 1;
      if (u.charging) { u.charging = false; const mag = u.mag > u.atk; return { sk: { n: bossMega(u), anim: mag ? 'cast' : 'spin', fx: u.type === 'dragon' || u.key === 'balrog' ? 'fire' : mag ? 'dark' : 'stone', tgt: 'all', dmg: 1.9, stat: mag ? 'mag' : 'atk', st: [['stun', .3, 1]], mega: 1 }, t: null }; }
      if (u.acts % 4 === 0) return { sk: { n: 'sammelt Kraft …', anim: 'shout', fx: 'dark', tgt: 'self', charge: 1 }, t: null };
    }
    if (u.side === 'enemy') {
      let opts = u.skills.filter(s => !((u.cd[s.n] || 0) > 0)).filter(s => {
        if (s.summon) return this.enemies.filter(alive).length < 5;
        if (s.heal) return friends.some(f => f.hp / f.maxHp < .6);
        if ((s.buff || s.self) && !s.dmg) { const st = (s.buff || s.self)[0][0]; return s.tgt === 'self' ? !hasS(u, st) : !friends.every(f => hasS(f, st)); }
        return true;
      });
      if (!opts.length) opts = [basic];
      let r = Math.random() * opts.reduce((a, s) => a + (s.w || 1), 0), sk = opts[0];
      for (const s of opts) { r -= s.w || 1; if (r <= 0) { sk = s; break; } }
      return { sk, t: this.pickTarget(u, sk, foes, friends) };
    }
    const K = u.kit;
    if (u.forceUlt && u.energy >= 100) { u.forceUlt = 0; u.manualUlt = 1; return { sk: K.ult, t: this.pickTarget(u, K.ult, foes, friends), ult: 1 }; }
    if (u.energy >= 100 && G.settings.autoUlt !== false && this.useful(u, K.ult, friends, foes)) return { sk: K.ult, t: this.pickTarget(u, K.ult, foes, friends), ult: 1 };
    for (const s of [K.act2, K.act]) if (s && !((u.cd[s.n] || 0) > 0) && this.useful(u, s, friends, foes)) return { sk: s, t: this.pickTarget(u, s, foes, friends) };
    return { sk: basic, t: this.pickTarget(u, basic, foes, friends) };
  }
  pickTarget(u, sk, foes, friends) {
    if (sk.tgt === 'lowestAlly') return friends.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a), friends[0]);
    if (sk.tgt !== 'single') return null;
    const vis = foes.filter(f => !hasS(f, 'invis')); const pool = vis.length ? vis : foes;
    if (u.side === 'enemy') {
      const taunt = pool.filter(f => hasS(f, 'taunt')); if (taunt.length) return pick(taunt);
      if (Math.random() < .78) return pool.reduce((a, b) => (b.threat > a.threat ? b : a), pool[0]);
      return pick(pool);
    }
    const marked = pool.filter(f => hasS(f, 'mark')); if (marked.length) return marked[0];
    const adds = pool.filter(f => !f.boss); const p2 = adds.length ? adds : pool;
    return p2.reduce((a, b) => (b.hp < a.hp ? b : a), p2[0]);
  }

  /* ---------- Aktion ---------- */
  async perform(u, sk, target, isUlt) {
    sk = Object.assign({}, sk);
    const foes = this.foesOf(u);
    if (isUlt) u.energy = 0;
    if (sk.cd) u.cd[sk.n] = sk.cd;
    if (u.side === 'hero' && !isUlt) u.energy = Math.min(100, u.energy + 14 * (1 + (u.p.ultCharge || 0) / 100));
    if (sk.charge) { u.charging = true; this.h.banner?.(`⚠ ${u.name} sammelt Kraft!`, 'warn'); this.flash('#ff2a1a', 300); sfx('crit'); }
    else if (sk.mega) { this.h.banner?.(`${u.name}: ${sk.n}`, 'foe'); this.focus(u, 1.26, 1000); this.shake(4); this.flash('#ff5a1a', 450); }
    else if (!sk.basic) this.h.banner?.(isUlt ? `${u.name}: ${sk.n}` : sk.n, u.side === 'enemy' ? 'foe' : isUlt ? 'ult' : '', u);
    if (isUlt && u.side === 'hero') {
      this.combo = this.time - (this.lastUlt ?? -1e9) < 3800 ? (this.combo || 1) + 1 : 1; this.lastUlt = this.time;
      if (this.combo >= 2) { sk = Object.assign({}, sk, { comboMul: 1 + .25 * (this.combo - 1) }); this.h.combo?.(this.combo); }
      this.h.ultUsed?.(u);
    }
    this.h.log?.(u, sk);
    if (isUlt && u.side === 'hero' && ['theoden', 'eomer', 'eowyn'].includes(u.key)) { this.charge = { t: this.time }; this.shake(3); }
    if (isUlt) { this.hitstop = 140; this.cine = { t: this.time }; this.slowUntil = this.time + 420; this.speedFx = { x: u.x, y: u.y - u.h * .5, t: this.time, c: u.side === 'hero' ? '255,236,180' : '255,90,60' }; this.focus(u, 1.26, 1100); sfx('ult'); this.flash(u.side === 'hero' ? '#ffe9a8' : '#ff3a1a', 500); this.fxs.push({ k: 'pillar', x: u.x, y: u.y, c: '#ffe080', t: 0, dur: 800 }); this.shake(2); this.h.ult?.(u, sk); await this.wait(500); }
    const hits = sk.hits || 1, hitSet = new Set(), counters = [];
    const doHit = (t, mult = 1) => { const r = this.hit(u, t, sk, mult); if (r > 0) hitSet.add(t); if (r === -2) counters.push(t); };
    if (sk.dmg) {
      if (sk.anim === 'melee' || sk.anim === 'spin') {
        const dir = u.side === 'hero' ? 1 : -1;
        let dest;
        if (sk.tgt === 'single') dest = { x: target.x + target.ox - dir * (target.big ? 26 : 14), y: target.y + target.oy + 1 };
        else { const fs = foes; dest = { x: fs.reduce((a, f) => a + f.x, 0) / fs.length - dir * 22, y: fs.reduce((a, f) => a + f.y, 0) / fs.length }; }
        if (u.big || u.type === 'worm') dest = { x: u.x + dir * 14, y: u.y };
        this.setAnim(u, 'walk'); await this.moveTo(u, dest.x, dest.y, 280);
        for (let i = 0; i < hits; i++) {
          let tgs = sk.tgt === 'all' ? this.foesOf(u) : sk.tgt === 'random' ? [pick(this.foesOf(u))].filter(Boolean) : [target];
          if (sk.tgt === 'single' && !alive(target)) { const l = this.foesOf(u); if (!l.length) break; target = pick(l); tgs = [target]; }
          if (!tgs.length) break;
          this.setAnim(u, 'attack'); await this.wait(RIG.impactTime('attack'));
          sfx(sk.fx === 'stone' ? 'blunt' : 'swing');
          for (const t of tgs) { this.impact(t, -dir, isUlt || (sk.dmg || 0) >= 2); this.fxs.push({ k: 'slash', x: t.x + t.ox, y: t.y + t.oy - t.h * .55, r: t.big ? 14 : 7, dir: -dir, t: 0, dur: 180 }); if (sk.fx !== 'slash') this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, sk.fx, 8); doHit(t); }
          await this.wait(hits > 1 ? 180 : 260);
        }
        if (alive(u)) { this.setAnim(u, 'walk'); await this.moveTo(u, u.x, u.y, 260); this.setAnim(u, 'idle'); }
      } else {
        const ranged = sk.anim === 'shoot' || sk.anim === 'throw' ? sk.anim : 'cast';
        for (let i = 0; i < hits; i++) {
          let tgs = sk.tgt === 'all' ? this.foesOf(u) : sk.tgt === 'random' ? [pick(this.foesOf(u))].filter(Boolean) : [target];
          if (sk.tgt === 'single' && !alive(target)) { const l = this.foesOf(u); if (!l.length) break; target = pick(l); tgs = [target]; }
          if (!tgs.length) break;
          if (i === 0 || ranged !== 'shoot') { this.setAnim(u, ranged); if (ranged === 'cast') { this.fxs.push({ k: 'circle', x: u.x, y: u.y, c: (FX_COL[sk.fx] || ['#fff'])[0], t: 0, dur: 650, under: 1 }); sfx('charge'); } await this.wait(i ? 120 : RIG.impactTime(ranged)); }
          else { this.setAnim(u, 'shoot'); await this.wait(140); }
          sfx(ranged === 'shoot' ? 'bow' : ranged === 'throw' ? 'swing' : 'cast');
          const kind = ranged === 'shoot' && u.wpn === 'bow' ? 'arrow' : sk.fx === 'slash' ? 'light' : sk.fx;
          const ps = tgs.map(t => {
            if (sk.fx === 'lightning') { this.fxs.push({ k: 'bolt', x: u.x + u.ox, y: u.y - u.h, tx: t.x + t.ox, ty: t.y + t.oy - t.h * .5, t: 0, dur: 240 }); return this.wait(90).then(() => { this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, 'lightning', 10); doHit(t); }); }
            return this.proj(u, t, kind, kind === 'arrow' ? 210 : 320, ranged === 'throw' ? 10 : kind === 'arrow' ? 3 : 0).then(() => { this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, kind === 'arrow' ? 'slash' : kind, kind === 'arrow' ? 4 : 12); doHit(t); });
          });
          if (hits > 1 && sk.tgt !== 'all' && i < hits - 1) await this.wait(110); else await Promise.all(ps);
        }
        await this.wait(200);
      }
    } else {
      this.setAnim(u, sk.anim === 'shout' ? 'shout' : 'cast');
      if (sk.anim !== 'shout') this.fxs.push({ k: 'circle', x: u.x, y: u.y, c: (FX_COL[sk.fx] || ['#fff'])[0], t: 0, dur: 650, under: 1 });
      sfx(sk.anim === 'shout' ? 'shout' : 'charge');
      await this.wait(RIG.impactTime(sk.anim === 'shout' ? 'shout' : 'cast'));
      if (sk.anim === 'shout') this.fxs.push({ k: 'ring', x: u.x, y: u.y - u.h * .5, r: 28, c: (FX_COL[sk.fx] || ['#f3d78f'])[0], t: 0, dur: 550 });
    }
    // Heilung / Belebung / Schild
    if (sk.heal || sk.healPct || sk.revive || sk.shield) {
      let tgs = sk.tgt === 'lowestAlly' ? [target].filter(Boolean) : sk.tgt === 'self' ? [u] : (u.side === 'hero' ? this.heroes : this.enemies);
      if (sk.revive) for (const t of tgs) if (!alive(t)) this.revive(t, sk.revive);
      tgs = tgs.filter(alive);
      if (sk.heal || sk.healPct) { sfx('heal'); for (const t of tgs) { const amt = sk.healPct ? t.maxHp * sk.healPct : sk.heal * effStat(u, 'mag') * 1.1; this.heal(u, t, amt); } }
      if (sk.shield) for (const t of tgs) { addS(t, 'shield', 4, Math.round(effStat(u, sk.shieldStat || 'mag') * sk.shield), this); this.burst(t.x, t.y - t.h * .5, 'ice', 6); }
      if (sk.cleanse) tgs.forEach(t => cleanse(t));
    }
    if (sk.st) for (const t of hitSet) {
      if (!alive(t) || t.side === u.side) continue;
      for (const [id, ch, dur] of sk.st) { if (Math.random() > ch * (1 + (u.p?.statusCh || 0) / 100)) continue; addS(t, id === 'randomDebuff' ? pick(['atkDown', 'defDown', 'slow', 'bleed', 'poison']) : id, dur, 0, this); }
    }
    if (sk.buff) {
      const tgs = sk.tgt === 'allAllies' ? this.friendsOf(u) : sk.tgt === 'lowestAlly' ? [target].filter(alive) : [u];
      tgs.forEach(t => { sk.buff.forEach(([id, d]) => addS(t, id, d, 0, this)); this.burst(t.x, t.y - t.h * .5, 'buff', 5, .6, .6); });
      if (sk.cleanse && !sk.heal) tgs.forEach(t => cleanse(t));
      if (!sk.heal) sfx('buff');
    }
    if (sk.self) { sk.self.forEach(([id, d]) => addS(u, id, d, 0, this)); this.burst(u.x, u.y - u.h * .5, 'buff', 6, .6, .6); }
    if (sk.taunt) { addS(u, 'taunt', sk.taunt, 0, this); const mx = Math.max(0, ...this.heroes.map(h => h.threat)); u.threat = mx * 1.3 + 50; }
    if (sk.buffAll) this.friendsOf(u).forEach(t => sk.buffAll.forEach(([id, d]) => addS(t, id, d, 0, this)));
    if (sk.healAllPct) this.friendsOf(u).forEach(t => this.heal(u, t, t.maxHp * sk.healAllPct));
    if (sk.shieldAll) this.friendsOf(u).forEach(t => addS(t, 'shield', 4, Math.round(effStat(u, sk.shieldStat || 'mag') * sk.shieldAll), this));
    if (sk.summon && this.enemies.filter(alive).length < 5) {
      const e = this.addEnemy(sk.summon, Math.max(1, u.lvl - 1), 'normal'); e.summoned = 1;
      const sp = this.spread(), cx = this.cx;
      const free = [[22, 96], [24, 122], [10, 108], [92, 122], [96, 96], [40, 108]].map(s => [cx + s[0] * sp, s[1]]).find(s => !this.enemies.some(o => alive(o) && o !== e && Math.abs(o.x - s[0]) < 8 && Math.abs(o.y - s[1]) < 8)) || [cx + 30, 108];
      e.x = free[0]; e.y = free[1]; e.atb = 0; this.burst(e.x, e.y - 8, 'dark', 16, 1.2, .5);
    }
    for (const c of counters) {
      if (!alive(c) || !alive(u)) continue;
      await this.wait(120); this.setAnim(c, 'attack'); await this.wait(RIG.impactTime('attack'));
      this.num(c, 'Konter', '#f0b070'); this.hit(c, u, basicSkill(c), .8);
    }
    if (alive(u) && u.anim.n !== 'idle' && u.anim.n !== 'dead') await this.wait(140);
  }
  hit(a, t, sk, mult = 1) {
    if (!alive(t)) return 0;
    if (hasS(t, 'fly') && (sk.anim === 'melee' || sk.anim === 'spin') && Math.random() < .5) { this.num(t, 'Verfehlt', '#c8e8ff'); sfx('miss'); return 0; }
    if (t.p?.dodge && Math.random() < t.p.dodge / 100) { this.num(t, 'Ausgewichen', '#c8c8c8'); sfx('miss'); return 0; }
    const stat = sk.stat || (sk.basic ? a.atkStat : 'atk');
    const A = effStat(a, stat), D = effStat(t, stat === 'mag' ? 'res' : 'def');
    let d = (sk.dmg || 1) * A * (1.5 * A) / (1.5 * A + D) * mult * (sk.comboMul || 1);
    const hpF = t.hp / t.maxHp, ap = a.p || {}, tp = t.p || {};
    if (sk.bonusTag && t.tags?.includes(sk.bonusTag)) d *= 1.4;
    if (sk.bossBonus && t.boss) d *= sk.bossBonus;
    if (sk.exec && hpF < .4) d *= 2;
    if (sk.lowHp) d *= 1 + (1 - a.hp / a.maxHp);
    if (ap.execute && hpF < .3) d *= 1 + ap.execute;
    if (ap.lowHpDmg) d *= 1 + ap.lowHpDmg * (1 - a.hp / a.maxHp);
    if (ap.vsOrk && t.tags?.includes('ork')) d *= 1 + ap.vsOrk;
    if (ap.vsGeist && t.tags?.includes('geist')) d *= 1 + ap.vsGeist;
    if (ap.bossDmg && t.boss) d *= 1 + ap.bossDmg / 100;
    if (hasS(t, 'mark')) d *= 1.3;
    if (hasS(t, 'guard')) d *= .6;
    if (tp.dmgRed) d *= 1 - tp.dmgRed / 100;
    const crit = !!sk.alwaysCrit || Math.random() < (a.crit + (sk.critB || 0)) / 100;
    if (crit) d *= 1 + a.critDmg / 100;
    if (a.manualUlt) d *= 1.2;
    d *= rnd(.92, 1.08);
    let dmg = Math.max(1, Math.round(d));
    const sh = hasS(t, 'shield');
    if (sh) { const ab = Math.min(sh.val, dmg); sh.val -= ab; dmg -= ab; if (sh.val <= 0) rmS(t, 'shield'); if (ab) this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, 'ice', 4); }
    t.hp = Math.max(0, t.hp - dmg);
    if (crit && a.side === 'hero') this.h.crit?.();
    if (crit || t.boss) this.hitstop = Math.max(this.hitstop || 0, crit ? 70 : 35);
    if (crit) { this.fxs.push({ k: 'ring', x: t.x + t.ox, y: t.y + t.oy - t.h * .45, r: 30 + (t.big ? 16 : 0), c: '#fff2c0', t: 0, dur: 420 }); this.fxs.push({ k: 'burst', x: t.x + t.ox, y: t.y + t.oy - t.h * .5, r: 12, c: '#ffe8a0', t: 0, dur: 220 }); }
    this.num(t, dmg === 0 ? 'Schild' : (crit ? dmg + '!' : dmg), dmg === 0 ? '#a8d4ff' : crit ? '#ffd040' : t.side === 'hero' ? '#ff9a8a' : '#ffffff', crit ? 2 : 1);
    t.flash = 110; t.kb = (t.side === 'hero' ? -1 : 1) * (crit ? 3.5 : 2); if (t.anim.n === 'idle' || t.anim.n === 'hurt') this.setAnim(t, 'hurt');
    this.shake(crit ? 2.5 : 1.1); sfx(crit ? 'crit' : 'hit');
    if (a.side === 'hero') { a.threat += dmg * a.threatMul; a.energy = Math.min(100, a.energy + 3 * (1 + (ap.ultCharge || 0) / 100)); }
    if (t.side === 'hero') t.energy = Math.min(100, t.energy + dmg / t.maxHp * 60 * (1 + (tp.ultCharge || 0) / 100));
    if (ap.lifesteal && dmg > 0) this.heal(a, a, dmg * ap.lifesteal / 100, { silent: 1 });
    if (tp.thorns && dmg > 0 && alive(a)) { const r = Math.max(1, Math.round(dmg * tp.thorns / 100)); a.hp = Math.max(0, a.hp - r); this.num(a, r, '#f0b070'); if (a.hp <= 0) this.die(a); }
    if (dmg > 0 && alive(t)) { const proc = (k, s, dur) => { if (ap[k] && Math.random() < ap[k]) addS(t, s, dur, 0, this); }; proc('burnOnHit', 'burn', 3); proc('poisonOnHit', 'poison', 3); proc('slowOnHit', 'slow', 2); proc('stunOnHit', 'stun', 1); }
    if (ap.doubleHit && !sk.isDouble && Math.random() < ap.doubleHit && alive(t)) { this.num(t, 'Doppelt', '#ffe080'); this.hit(a, t, Object.assign({}, sk, { isDouble: 1 }), mult * .6); }
    if (t.hp <= 0) this.die(t);
    if (alive(t) && tp.counter && (sk.anim === 'melee' || sk.anim === 'spin') && Math.random() < tp.counter && alive(a)) return -2;
    return dmg;
  }
  heal(src, t, amt, o = {}) {
    if (!alive(t)) return 0;
    const sp = src.p || {}, tp = t.p || {};
    amt *= (1 + (sp.healPct || 0) / 100) * (1 + (tp.healRecv || 0) / 100) * (src.side === 'hero' ? modVal('heal') : 1);
    if (!o.silent && src.side === 'hero' && Math.random() < src.crit / 100) amt *= 1.5;
    amt = Math.round(amt);
    const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + amt); const got = t.hp - before;
    if (got > 0 || !o.silent) this.num(t, '+' + got, '#9fe07a');
    if (!o.silent) {
      this.burst(t.x + t.ox, t.y + t.oy - t.h * .4, 'heal', 8, .5, .8);
      if (src.side === 'hero') src.threat += got * .4 * src.threatMul;
      if (sp.healShield && amt > 0) addS(t, 'shield', 3, Math.round(amt * sp.healShield), this);
      if (sp.healRegen) addS(t, 'regen', 2, 0, this);
    }
    return got;
  }
  revive(t, pct) { if (alive(t)) return; t.hp = Math.max(1, Math.round(t.maxHp * pct)); t.statuses = []; t.holdAnim = null; this.setAnim(t, 'idle'); t.fade = 1; this.num(t, 'Belebt', '#9fe07a'); this.burst(t.x, t.y - 8, 'holy', 16, .8, 1); this.fxs.push({ k: 'pillar', x: t.x, y: t.y, c: '#ffe080', t: 0, dur: 650 }); }
  die(u) {
    if (u.p?.reviveSelf && !u.usedRevive) { u.usedRevive = 1; u.hp = Math.round(u.maxHp * u.p.reviveSelf); this.num(u, 'Unbeugsam', '#ffe080'); this.burst(u.x, u.y - u.h * .5, 'holy', 14, 1, .6); return; }
    u.hp = 0; u.statuses = []; u.charging = false; this.setAnim(u, 'dead'); sfx('die');
    if (u.key === 'balrog' && this.arena === 'bridge') { u.falling = this.time; this.bridgeBreak = { x: u.x + u.ox, t: this.time }; this.shake(6); for (let i = 0; i < 24; i++) this.parts.push({ x: u.x + u.ox + rnd(-14, 14), y: 100 + rnd(-6, 24), vx: rnd(-.8, .8), vy: rnd(-1.2, .2), g: .05, t: 0, life: rnd(700, 1300), c: pick(['#5a5650', '#3e3a36', '#24201e']), s: 1.8 }); this.h.banner?.('Die Brücke bricht!', 'warn'); }
    if (u.side === 'enemy' && this.fighting && this.enemies.every(e => !alive(e) || e === u)) { this.slowUntil = this.time + 750; this.cine = { t: this.time, dur: 1500 }; this.focus(u, 1.24, 1000); this.flash('#fff4d0', 380); this.fxs.push({ k: 'rays', x: u.x + u.ox, y: u.y + u.oy - u.h * .5, t: 0, dur: 1300 }); }
    if (u.side === 'enemy') { this.h.kill?.(u); const n = u.big ? 34 : 18; for (let i = 0; i < n; i++) this.parts.push({ x: u.x + u.ox + rnd(-u.w, u.w) * .6, y: u.y + u.oy - rnd(0, u.h), vx: rnd(-.25, .25), vy: -rnd(.15, .6), g: -.002, t: 0, life: rnd(700, 1300), c: pick(['#ff9a40', '#ffcf70', '#c04a20', '#4a3a3a']), s: Math.random() < .4 ? 1.6 : 1, glow: Math.random() < .7 }); }
    this.burst(u.x, u.y - u.h * .5, u.side === 'enemy' ? 'dark' : 'slash', 10, 1);
    if (u.side === 'hero') {
      const saver = this.heroes.find(h => alive(h) && h.p.reviveAlly && !h.usedReviveAlly);
      if (saver) { saver.usedReviveAlly = 1; this.wait(500).then(() => { if (this.fighting) { this.revive(u, saver.p.reviveAlly); } }); }
    }
  }

  /* ---------- Effekte ---------- */
  burst(x, y, kind, n = 10, spread = 1.2, up = 0) {
    const c = FX_COL[kind] || ['#ffffff'];
    const glow = ['fire', 'light', 'lightning', 'heal', 'holy', 'buff', 'ice', 'dark', 'water'].includes(kind);
    if (glow && n >= 6) { this.fxs.push({ k: 'burst', x, y, r: 6 + n * .4, c: c[0], t: 0, dur: 320 }); if (this.hq()) this.fxs.push({ k: 'light', x, y, r: 34 + n * 1.6, c: c[0], t: 0, dur: 520, a: .24 }); }
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-spread, spread), vy: rnd(-spread, spread) - up, g: up ? -.004 : .035, t: 0, life: rnd(350, 750), c: pick(c), s: Math.random() < .3 ? 1.6 : 1, glow });
  }
  num(u, txt, c, sc = 1) { this.nums.push({ x: u.x + u.ox + rnd(-4, 4), y: u.y + u.oy - u.h - 10, txt: String(txt), c, sc, t: 0 }); }
  shake(v) { this.shakeV = Math.max(this.shakeV, v); }
  flash(c, dur = 300) { this.flashV = { c, t: 0, dur }; }
  focus(u, z = 1.08, ms = 700) { this.cam.tz = z; this.cam.tx = u.x; this.cam.ty = u.y - u.h * .5; const id = (this._camId = (this._camId || 0) + 1); this.wait(ms).then(() => { if (this._camId === id) { this.cam.tz = 1.14; this.cam.tx = this.cx; this.cam.ty = 92; } }); }
  setAnim(u, n) { if (!alive(u) && n !== 'dead') return; u.anim = { n, el: 0 }; }
  moveTo(u, tx, ty, dur) { return new Promise(res => { u.move = { fx: u.ox, fy: u.oy, tx: tx - u.x, ty: ty - u.y, t: 0, dur, res }; }); }
  proj(from, to, kind, dur = 260, arc = 0) {
    const fx = from.x + from.ox + (from.side === 'hero' ? 6 : -6), fy = from.y + from.oy - from.h * .6, tx = to.x + to.ox, ty = to.y + to.oy - to.h * .5;
    return new Promise(res => this.projs.push({ x: fx, y: fy, tx, ty, t: 0, dur, kind, arc, res }));
  }

  /* ---------- Darstellung ---------- */
  render() {
    const ctx = this.ctx, s = this.s, cam = this.cam, gt = this.time, LW = this.LW;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = '#06080b'; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    const shx = this.shakeV ? Math.sin(gt * .09) * this.shakeV * .8 : 0, shy = this.shakeV ? Math.cos(gt * .11) * this.shakeV * .5 : 0;
    const z = cam.z, base = (x, y) => ctx.setTransform(s * z, 0, 0, s * z, this.ox0 + (-(LW / 2) * (z - 1) - (cam.x - LW / 2) * (z - 1) + shx) * s, (-(LH / 2) * (z - 1) - (cam.y - LH / 2) * (z - 1) + shy) * s);
    base();
    // Parallax-Hintergrund
    const L = RIG.layers(this.bgKey, s);
    const tile = (cv, par, y, hgt) => { const w = L.TW, off = -((this.scroll * par) % w + w) % w; for (let x = off - w; x < LW + w; x += w) ctx.drawImage(cv, x - (LW > w ? 0 : 0) - 20, y, w, hgt); };
    tile(L.sky, .03, YO, L.HZ + 4);
    this.drawAtmosBack(ctx, gt);
    tile(L.far, .12, YO, L.HZ + 4);
    this.drawLandmark(ctx, gt, L);
    if (this.bgKey === 'weather' || this.bgKey === 'helm') this.drawStorm(ctx, gt, L);
    tile(L.mid, .35, YO, L.HZ + 4);
    this.drawLandmark(ctx, gt, L, true);
    tile(L.ground, 1, L.HZ + YO, LH - L.HZ - YO + 4);
    if (this.hq()) this.drawRays(ctx, gt, L);
    this.drawArena(ctx, gt, L);
    this.drawAtmos(ctx, gt);
    const units = this.all().filter(u => u.fade > 0).sort((a, b) => (a.y + a.oy) - (b.y + b.oy));
    for (const u of units) { const x = u.x + u.ox + u.kb, y = u.y + u.oy; const Ls = LIGHT[this.bgKey] || LIGHT._, sd = Ls.from === 'left' ? 1 : Ls.from === 'right' ? -1 : 0, fl = hasS(u, 'fly') ? .45 : 1; ctx.globalAlpha = .32 * u.fade * fl; ctx.save(); ctx.translate(x + sd * u.h * .32, y); ctx.transform(1, 0, sd * -.9, 1, 0, 0); const spr = this.shadowSprite(), rx = u.h * .5 + u.w * .3, ry = (u.w + 2) * .32; ctx.globalAlpha *= .65; ctx.drawImage(spr, -rx, -ry, rx * 2, ry * 2); ctx.restore(); ctx.globalAlpha = .62 * u.fade * fl; const cx2 = u.w + 1, cy2 = (u.w + 1) * .24; ctx.drawImage(spr, x - cx2, y - cy2, cx2 * 2, cy2 * 2); }
    ctx.globalAlpha = 1;
    if (this.walking && this.time - (this._dust || 0) > 220) { this._dust = this.time; for (const h of this.heroes) if (alive(h) && Math.random() < .6) this.burst(h.x + h.ox - 3, h.y + h.oy - 1, 'stone', 2, .35, .15); }
    for (const f of this.fxs) if (f.under) this.drawFx(f);
    this.drawCompanion(ctx, gt);
    if (this.hq()) for (const u of units) this.drawCastFx(u);
    for (const u of units) this.drawUnit(u, gt);
    for (const u of units) this.drawTrail(u);
    this.drawCharge(ctx, gt);
    for (const f of this.fxs) if (!f.under) this.drawFx(f);
    for (const p of this.projs) this.drawProj(p);
    this.drawParts(ctx);
    if (this.hq()) this.drawFore(ctx, tile);
    for (const u of units) if (alive(u) && (this.fighting || u.side === 'enemy')) this.drawBars(u);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of this.nums) {
      const k = n.t / 1000, pop = k < .15 ? RIG.easeOut(k / .15) * 1.35 : 1.35 - Math.min(.35, (k - .15) * 1.5);
      ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
      ctx.font = `700 ${(n.sc > 1 ? 9.5 : 6.4) * pop}px Cinzel, Georgia, serif`; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(10,6,12,.9)';
      const y = n.y - RIG.easeOut(Math.min(1, k * 1.3)) * 12;
      ctx.strokeText(n.txt, n.x, y);
      if (n.sc > 1) { const gg = ctx.createLinearGradient(0, y - 5, 0, y + 5); gg.addColorStop(0, '#fffbe0'); gg.addColorStop(.5, '#ffd34a'); gg.addColorStop(1, '#ff9a2a'); ctx.fillStyle = gg; ctx.shadowColor = 'rgba(255,190,60,.9)'; ctx.shadowBlur = 6 * this.s; } else ctx.fillStyle = n.c;
      ctx.fillText(n.txt, n.x, y); ctx.shadowBlur = 0;
    }
    // Speedlines bei Ultimates
    if (this.speedFx && this.time - this.speedFx.t < 650) {
      const sf = this.speedFx, k = (this.time - sf.t) / 650; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * .38; ctx.strokeStyle = `rgba(${sf.c},1)`;
      for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + sf.t, r0 = 16 + k * 30 + (i % 3) * 6, r1 = r0 + 60 + (i % 4) * 20; ctx.lineWidth = .5 + (i % 3) * .3; ctx.beginPath(); ctx.moveTo(sf.x + Math.cos(a) * r0, sf.y + Math.sin(a) * r0 * .7); ctx.lineTo(sf.x + Math.cos(a) * r1, sf.y + Math.sin(a) * r1 * .7); ctx.stroke(); }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.hq()) this.bloom(ctx);
    const LG = LIGHT[this.bgKey] || LIGHT._;
    if (LG.grade) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .35; const gr = ctx.createLinearGradient(0, 0, 0, this.cv.height); gr.addColorStop(0, LG.grade[0]); gr.addColorStop(1, LG.grade[1]); ctx.fillStyle = gr; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.restore(); }
    if (this.hq()) this.drawGrain(ctx);
    if (this.cine) { const k = (this.time - this.cine.t) / (this.cine.dur || 1500); if (k >= 1) this.cine = null; else { const e = k < .2 ? RIG.easeOut(k / .2) : k > .75 ? 1 - (k - .75) / .25 : 1, bh = this.cv.height * .085 * e; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.cv.width, bh); ctx.fillRect(0, this.cv.height - bh, this.cv.width, bh); } }
    // Vignette
    const vg = ctx.createRadialGradient(this.cv.width / 2, this.cv.height * .55, this.cv.height * .4, this.cv.width / 2, this.cv.height * .55, this.cv.width * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    if (this.flashV) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 * Math.pow(1 - this.flashV.t / this.flashV.dur, 2); ctx.fillStyle = this.flashV.c; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (this.fade > 0) { ctx.globalAlpha = Math.sin(this.fade * Math.PI); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.globalAlpha = 1; }
  }
  drawCompanion(ctx, gt) {
    const cp = typeof G !== 'undefined' && G && COMPANIONS.find(c => c.id === G.companion && G.comps[c.id]); if (!cp) return;
    const back = this.heroes.length ? Math.min(...this.heroes.map(h => h.x)) : this.cx - 80, anim = this.walking ? 'walk' : 'idle', el = gt % 1000;
    if (cp.kind === 'eagle') { const x = this.cx - 40 + Math.sin(gt / 2600) * 60, y = 30 + Math.sin(gt / 900) * 5; ctx.save(); ctx.translate(x, y); RIG.drawEagle(ctx, cp.look, gt); ctx.restore(); return; }
    if (cp.kind === 'ghosts') { for (let i = 0; i < 3; i++) { ctx.save(); ctx.globalAlpha = .38; ctx.shadowColor = 'rgba(160,255,210,.9)'; ctx.shadowBlur = 8 * this.s; ctx.translate(back - 16 - i * 9, 98 + i * 11); RIG.draw(ctx, 'hum', Object.assign({ wpn: 'sword' }, ENEMIES.dead_soldier.look), anim, el, gt + i * 500); ctx.restore(); } return; }
    if (cp.kind === 'sled') { ctx.save(); ctx.translate(back - 20, 120); const P = RIG.P(ctx); P.rr(-10, -4, 10, 4, 1, '#7a5a3a', .4); for (let i = 0; i < 2; i++) { ctx.save(); ctx.translate(4 + i * 7, -i * 2); ctx.scale(.45, .45); RIG.draw(ctx, 'quad', Object.assign({ eye: '#2a1a1a' }, cp.look), anim, el, gt + i * 300); ctx.restore(); } ctx.restore(); return; }
    ctx.save(); ctx.translate(back - 22, 117); RIG.draw(ctx, 'quad', Object.assign({ horse: 1, pony: cp.kind === 'pony', eye: '#2a1a12' }, cp.look), anim, el, gt); ctx.restore();
  }
  drawAtmosBack(ctx, gt) {
    const T = BACKGROUNDS[this.bgKey] || {};
    if (T.sun) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .07 + Math.sin(gt / 3000) * .02; ctx.fillStyle = '#fff3c0'; const sx = this.LW * .75; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx - 6 + i * 4, 12); ctx.lineTo(sx - 90 - i * 40, 150); ctx.lineTo(sx - 60 - i * 40, 150); ctx.closePath(); ctx.fill(); } ctx.restore(); }
  }
  drawAtmos(ctx, gt) {
    const T = BACKGROUNDS[this.bgKey] || {};
    ctx.save(); ctx.globalAlpha = .14;
    for (let i = 0; i < 5; i++) { const x = ((gt * .004 * (i + 1) - this.scroll * .5 + i * 90) % (this.LW + 120) + this.LW + 120) % (this.LW + 120) - 60, y = 72 + i * 6; const g = ctx.createRadialGradient(x, y, 0, x, y, 50); g.addColorStop(0, T.sky ? T.sky[T.sky.length - 1] : '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 60, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (T.lava) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .12 + Math.sin(gt / 500) * .05; const g = ctx.createLinearGradient(0, 144, 0, 76); g.addColorStop(0, '#ff4a10'); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.fillRect(-20, 76, this.LW + 40, 70); ctx.restore(); }
  }
  /* Kino-Nachbearbeitung: helle Stellen weich überstrahlen (Verkleinern, Potenzieren, Hochskalieren) */
  shadowSprite() { if (!this._shs) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(.6, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); this._shs = c; } return this._shs; }
  bloom(ctx) {
    const W1 = this.cv.width >> 2, H1 = this.cv.height >> 2, W2 = W1 >> 2, H2 = H1 >> 2;
    if (!this._b1) { this._b1 = document.createElement('canvas'); this._b2 = document.createElement('canvas'); }
    const a = this._b1, b = this._b2; if (a.width !== W1) { a.width = W1; a.height = H1; b.width = W2; b.height = H2; }
    this._bfr = (this._bfr || 0) + 1;
    if (this._bfr % 2 || !this._bReady) { const ac = a.getContext('2d'), bc = b.getContext('2d');
    ac.globalCompositeOperation = 'copy'; ac.drawImage(this.cv, 0, 0, W1, H1);
    ac.globalCompositeOperation = 'multiply'; ac.drawImage(a, 0, 0); ac.drawImage(a, 0, 0);
    bc.globalCompositeOperation = 'copy'; bc.drawImage(a, 0, 0, W2, H2); this._bReady = 1; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .26; ctx.drawImage(b, 0, 0, this.cv.width, this.cv.height); ctx.globalAlpha = .14; ctx.drawImage(a, 0, 0, this.cv.width, this.cv.height); ctx.restore();
  }
  drawRays(ctx, gt, L) {
    const Lt = LIGHT[this.bgKey] || LIGHT._, sky = ['shire', 'amonhen', 'lake', 'erebor', 'eregion', 'south', 'sea', 'snow', 'mirkwood', 'helm', 'pelennor'].includes(this.bgKey);
    const hz = L.HZ + YO;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (sky) { const sx = this.LW * .78, sy = YO - 8; for (let i = 0; i < 6; i++) { const a = 1.95 + i * .17 + Math.sin(gt / 3000 + i * 1.7) * .03, w = .035 + (i % 3) * .015, len = 260; ctx.globalAlpha = .05 + .035 * Math.sin(gt / 1700 + i * 2.1) ** 2; const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * len * .7, sy + Math.sin(a) * len * .7); g.addColorStop(0, `rgba(${Lt.c},.9)`); g.addColorStop(1, `rgba(${Lt.c},0)`); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a - w) * len, sy + Math.sin(a - w) * len); ctx.lineTo(sx + Math.cos(a + w) * len, sy + Math.sin(a + w) * len); ctx.closePath(); ctx.fill(); } }
    // Dunst am Horizont trennt Hinter- und Vordergrund
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const fg = ctx.createLinearGradient(0, hz - 14, 0, hz + 16); fg.addColorStop(0, `rgba(${Lt.c},0)`); fg.addColorStop(.5, `rgba(${Lt.c},.13)`); fg.addColorStop(1, `rgba(${Lt.c},0)`); ctx.fillStyle = fg; ctx.fillRect(-30, hz - 14, this.LW + 60, 30);
    ctx.restore();
  }
  /* Unscharfe Vordergrund-Silhouetten (Gras, Steine) wie bei einer Kamera mit geringer Schärfentiefe */
  drawFore(ctx, tile) {
    const key = this.bgKey; if (!this._fore || this._foreKey !== key) {
      const T = 512, H = 30, q = .22, cv = document.createElement('canvas'); cv.width = T * q * this.s | 0; cv.height = H * q * this.s | 0; const c = cv.getContext('2d'); c.scale(q * this.s, q * this.s);
      let seed = 0; for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0; const R = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const snow = key === 'snow', col = snow ? 'rgba(210,225,240,.9)' : key === 'doom' || key === 'moria' ? 'rgba(18,8,6,.95)' : 'rgba(8,12,8,.95)';
      c.fillStyle = col;
      for (let i = 0; i < 9; i++) { const x = R() * T, w = 30 + R() * 60, h = 8 + R() * 14; c.beginPath(); c.ellipse(x, H, w / 2, h, 0, Math.PI, 0); c.fill(); if (x + w / 2 > T) { c.beginPath(); c.ellipse(x - T, H, w / 2, h, 0, Math.PI, 0); c.fill(); } }
      for (let i = 0; i < 70; i++) { const x = R() * T, h = 6 + R() * 16; c.beginPath(); c.moveTo(x - 1.6, H); c.quadraticCurveTo(x + R() * 4 - 2, H - h * .6, x + R() * 6 - 3, H - h); c.lineTo(x + 1.6, H); c.fill(); }
      this._fore = cv; this._foreKey = key;
    }
    const w = 512, off = -((this.scroll * 1.45) % w + w) % w;
    ctx.save(); ctx.globalAlpha = .9; for (let x = off - w; x < this.LW + w; x += w) ctx.drawImage(this._fore, x - 20, LH - 30 + 4, w, 30); ctx.restore();
  }
  drawStorm(ctx, gt, L) {
    if (!this._bolt || this.time > this._bolt.end + 2500 + Math.random() * 4000) { if (!this._bolt || this.time > this._bolt.end) { const x = 30 + Math.random() * (this.LW - 60), pts = [[x, YO - 6]]; let px = x, py = YO - 6; while (py < L.HZ + YO - 18) { px += (Math.random() - .5) * 12; py += 5 + Math.random() * 7; pts.push([px, py]); } this._bolt = { pts, t: this.time, end: this.time + 260 }; } }
    const b = this._bolt, k = (this.time - b.t) / 260; if (k < 0 || k > 1) return;
    const a = k < .15 ? 1 : k < .3 ? .3 : k < .45 ? .9 : 1 - k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(200,215,255,${.22 * a})`; ctx.fillRect(-20, YO - 20, this.LW + 40, L.HZ + 30);
    ctx.strokeStyle = `rgba(235,240,255,${a})`; ctx.lineWidth = 1.1; ctx.lineJoin = 'round'; ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.strokeStyle = `rgba(150,180,255,${a * .5})`; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
  }
  drawCharge(ctx, gt) {
    const ch = this.charge; if (!ch) return; const k = (this.time - ch.t) / 1600; if (k > 1) { this.charge = null; return; }
    if (!this._rohan) this._rohan = ['#6a4a2a', '#e8e4dc', '#3a2a1a', '#8a6a4a', '#5a3a22', '#c8b8a0', '#4a3a2e', '#9a7a5a'].map((f, i) => ({ body: 'man', skin: '#e0b490', hair: i % 2 ? '#c8a060' : '#8a6a3a', hs: 'long', beard: i % 3 ? 'short' : null, bc: '#b89050', tunic: i % 2 ? '#3a4a2a' : '#2e4030', armor: '#a8a090', hat: 'helm', hatC: '#c0b080', crest: 1, cape: i % 2 ? '#5a3a20' : '#2e4a2a', wc: '#d8dce0', wpn: 'spear', mount: { kind: 'horse', look: { fur: f, mane: RIG.sh(f, -.45), belly: RIG.sh(f, .1), gear: '#7a5a3a' } } }));
    for (let i = 0; i < 8; i++) {
      const row = i % 4, x = -70 + k * (this.LW + 170) - Math.floor(i / 4) * 34 - row * 9, y = 98 + row * 9;
      if (x < -60 || x > this.LW + 60) continue;
      ctx.save(); ctx.translate(x, y); RIG.draw(ctx, 'hum', this._rohan[i], 'walk', (gt + i * 130) % 1040, gt + i * 77); ctx.restore();
      if (Math.random() < .35) this.parts.push({ x: x - 12, y: y - 1, vx: rnd(-.6, -.1), vy: rnd(-.4, -.1), g: -.002, t: 0, life: rnd(400, 800), c: pick(['#a89878', '#8a7a62', '#c8b898']), s: 1.6 });
    }
  }
  drawArena(ctx, gt, L) {
    if (this.arena !== 'bridge') return; const top = 86, bot = 134, hz = L.HZ + YO;
    ctx.save(); let g = ctx.createLinearGradient(0, hz, 0, LH); g.addColorStop(0, '#080404'); g.addColorStop(.5, '#1a0604'); g.addColorStop(1, '#5a1406'); ctx.fillStyle = g; ctx.fillRect(-20, hz, this.LW + 40, LH - hz + 10);
    ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const fx = ((i * 97 + gt / 30) % (this.LW + 60)) - 30, a = .25 + .15 * Math.sin(gt / 200 + i); g = ctx.createRadialGradient(fx, LH + 6, 0, fx, LH + 6, 46); g.addColorStop(0, `rgba(255,110,30,${a})`); g.addColorStop(1, 'rgba(255,60,10,0)'); ctx.fillStyle = g; ctx.fillRect(fx - 46, LH - 50, 92, 60); }
    ctx.globalCompositeOperation = 'source-over';
    const slab = (x0, x1) => { ctx.beginPath(); ctx.moveTo(x0, top); ctx.lineTo(x1, top); ctx.lineTo(x1, bot); ctx.lineTo(x0, bot); ctx.closePath(); };
    const bb = this.bridgeBreak, gap = bb ? Math.min(1, (this.time - bb.t) / 500) * 22 : 0;
    const segs = bb ? [[-20, bb.x - gap], [bb.x + gap, this.LW + 20]] : [[-20, this.LW + 20]];
    for (const [x0, x1] of segs) { if (x1 <= x0) continue; slab(x0, x1); g = ctx.createLinearGradient(0, top, 0, bot); g.addColorStop(0, '#5a5650'); g.addColorStop(.15, '#3e3a36'); g.addColorStop(1, '#24201e'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(255,140,60,.35)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(x0, bot); ctx.lineTo(x1, bot); ctx.stroke(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .3; ctx.beginPath(); for (let x = Math.ceil(x0 / 14) * 14; x < x1; x += 14) { ctx.moveTo(x, top); ctx.lineTo(x - 3, bot); } ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,220,.08)'; ctx.fillRect(x0, top, x1 - x0, 1.2); }
    ctx.restore();
  }
  drawLandmark(ctx, gt, L, front = false) {
    const lm = RIG.landmark(this.bgKey, this.s); if (!lm || lm.front !== front) return;
    const k = lm.k, w = lm.w * k, h = lm.h * k, span = this.LW + w + 60; let X = this.LW * .6 - w / 2 - ((this.scroll * .05) % span + span) % span; if (X < -w - 30) X += span;
    const bobY = this.bgKey === 'sea' ? Math.sin(gt / 900) * 1.2 : 0, rot = this.bgKey === 'sea' ? Math.sin(gt / 1300) * .025 : 0;
    const Y = L.HZ + YO - h + lm.base * k + 2 + bobY; ctx.save(); ctx.translate(X + w / 2, Y + h); ctx.rotate(rot); ctx.translate(-w / 2, -h); ctx.scale(k, k); ctx.drawImage(lm.cv, 0, 0, lm.w, lm.h); if (lm.anim) lm.anim(ctx, 0, 0, gt); ctx.restore();
  }
  impact(t, dir, heavy) {
    const x = t.x + t.ox, y = t.y + t.oy - t.h * .5, n = heavy ? 16 : 9;
    for (let i = 0; i < n; i++) { const a = (dir > 0 ? 0 : Math.PI) + rnd(-1.1, 1.1), sp = rnd(1.2, heavy ? 3.4 : 2.4); this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - .4, g: .05, t: 0, life: rnd(180, 360), c: pick(['#fff6d0', '#ffd27a', '#ffffff']), s: 1, streak: 1 }); }
    this.fxs.push({ k: 'burst', x, y, r: heavy ? 16 : 10, c: '#ffffff', t: 0, dur: 150 });
    if (heavy) { this.fxs.push({ k: 'crack', x: t.x + t.ox, y: t.y + t.oy, r: t.big ? 30 : 20, t: 0, dur: 1100, seed: Math.random() * 1000 }); this.burst(t.x + t.ox, t.y + t.oy - 1, 'stone', 12, 1.4, .35); this.shake(2.5); }
  }
  drawCastFx(u) {
    if (!alive(u) || u.anim.n !== 'cast') return; const el = u.anim.el, k = Math.min(1, el / 380), out = Math.max(0, (el - 560) / 160); if (out >= 1) return;
    const ctx = this.ctx, x = u.x + u.ox, y = u.y + u.oy, R = 9 + u.w * .7, col = u.side === 'hero' ? (u.look.glowC || '#ffd070') : '#ff5a3a', rot = this.time / 650;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .8 * k * (1 - out); ctx.translate(x, y); ctx.scale(1, .3);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R); g.addColorStop(0, RIG.rgba(col, .4)); g.addColorStop(1, RIG.rgba(col, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = .9; ctx.beginPath(); ctx.arc(0, 0, R * k, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = .45; ctx.beginPath(); ctx.arc(0, 0, R * .72 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(rot); for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.beginPath(); ctx.moveTo(R * .75, 0); ctx.lineTo(R * .95, i % 2 ? 1.6 : -1.6); ctx.stroke(); }
    ctx.rotate(-rot * 2.4); ctx.beginPath(); for (let i = 0; i <= 5; i++) { const a = i * 4 * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * R * .7 * k, Math.sin(a) * R * .7 * k); } ctx.stroke(); ctx.restore();
  }
  drawTrail(u) {
    const a = u.anim; if (!alive(u) || a.n !== 'attack' || ['bow', 'staff'].includes(u.look.wpn) || u.type !== 'hum') return;
    const k = (a.el - 150) / 260; if (k < 0 || k > 1) return;
    const ctx = this.ctx, dir = u.side === 'hero' ? 1 : -1, cx = u.x + u.ox + u.kb + dir * u.w * .3, cy = u.y + u.oy - u.h * .55, r = u.h * (u.big ? .5 : .62);
    const a0 = -2.1 + k * 1.2, a1 = a0 + 1.6 * Math.min(1, k * 2.2);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * .75; if (dir < 0) { ctx.translate(cx, cy); ctx.scale(-1, 1); ctx.translate(-cx, -cy); }
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, r - i * 1.2, a0 + i * .08, a1); ctx.strokeStyle = i ? 'rgba(255,230,190,.35)' : 'rgba(255,255,255,.75)'; ctx.lineWidth = (2.2 - i * .6) * (u.big ? 1.6 : 1); ctx.lineCap = 'round'; ctx.stroke(); }
    ctx.restore();
  }
  drawGrain(ctx) {
    if (!this._grain) { const g = document.createElement('canvas'); g.width = g.height = 160; const c = g.getContext('2d'), im = c.createImageData(160, 160); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } c.putImageData(im, 0, 0); this._grain = ctx.createPattern(g, 'repeat'); }
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .06; ctx.translate(Math.random() * 160 | 0, Math.random() * 160 | 0); ctx.fillStyle = this._grain; ctx.fillRect(-160, -160, this.cv.width + 320, this.cv.height + 320); ctx.restore();
  }
  drawUnit(u, gt) {
    const ctx = this.ctx, x = u.x + u.ox + u.kb, y = u.y + u.oy;
    const fly = (hasS(u, 'fly') ? 14 + Math.sin(gt / 260) * 3 : 0) - (u.falling ? Math.pow(Math.min(1.6, (this.time - u.falling) / 700), 2) * 70 : 0);
    if (this.hq()) {
      const img = this.litSprite(u, gt);
      const gp = u._gp || (u._gp = []); if (!gp.length || this.time - gp[gp.length - 1].t > 26) { gp.push({ x, y: y - fly, t: this.time }); if (gp.length > 5) gp.shift(); }
      if (gp.length > 2 && Math.abs(gp[0].x - x) > 7 && this.time - gp[0].t < 200 && alive(u)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < gp.length - 1; i++) { ctx.globalAlpha = (.08 + i * .05) * u.fade; ctx.drawImage(img.cv, gp[i].x - img.ax, gp[i].y - img.ay, img.bw, img.bh); } ctx.restore(); }
      ctx.save(); ctx.globalAlpha = u.fade * (hasS(u, 'invis') ? .38 : 1) * (u.look.ghost ? .62 : 1);
      if (u.look.ghost) { ctx.shadowColor = 'rgba(160,255,210,.9)'; ctx.shadowBlur = 8 * this.s; }
      ctx.drawImage(img.cv, x - img.ax, y - fly - img.ay, img.bw, img.bh);
      ctx.restore(); ctx.globalAlpha = 1;
    } else {
      ctx.save(); ctx.translate(x, y - fly); if (u.side === 'enemy') ctx.scale(-1, 1);
      ctx.globalAlpha = u.fade * (hasS(u, 'invis') ? .38 : 1) * (u.look.ghost ? .62 : 1);
      if (u.look.ghost) { ctx.shadowColor = 'rgba(160,255,210,.9)'; ctx.shadowBlur = 8 * this.s; }
      RIG.draw(ctx, u.type, u.look, u.anim.n, u.anim.el, gt + u.gt0);
      ctx.shadowBlur = 0;
      if (u.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, u.flash / 110) * .55; RIG.draw(ctx, u.type, u.look, u.anim.n, u.anim.el, gt + u.gt0); ctx.globalCompositeOperation = 'source-over'; }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    if (hasS(u, 'shield') && alive(u)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22 + Math.sin(gt / 200) * .06; const r = u.h * .62; const g = ctx.createRadialGradient(x, y - u.h * .5, r * .5, x, y - u.h * .5, r); g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(1, 'rgba(160,210,255,.9)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - u.h * .5, r * .75, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (u.charging && alive(u)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 + Math.sin(gt / 90) * .2; const g = ctx.createRadialGradient(x, y - u.h * .5, 0, x, y - u.h * .5, u.h * .9); g.addColorStop(0, 'rgba(255,60,30,.7)'); g.addColorStop(1, 'rgba(255,30,10,0)'); ctx.fillStyle = g; ctx.fillRect(x - u.h, y - u.h * 1.5, u.h * 2, u.h * 1.8); ctx.restore(); }
    if (u.side === 'hero' && u.energy >= 100 && alive(u)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + Math.sin(gt / 150) * .12; const g = ctx.createRadialGradient(x, y - u.h * .5, 0, x, y - u.h * .5, u.h * .7); g.addColorStop(0, 'rgba(255,220,120,.6)'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.fillRect(x - u.h, y - u.h * 1.3, u.h * 2, u.h * 1.6); ctx.restore(); }
    if (this.active === u && alive(u)) { const ty = y - u.h - 11 + Math.sin(gt / 180) * 1.2; ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.moveTo(x - 2, ty); ctx.lineTo(x + 2, ty); ctx.lineTo(x, ty + 2.4); ctx.fill(); }
  }
  /* Grafikqualität: 'hoch' | 'normal' | 'auto' (auto schaltet bei dauerhaft < ~40 FPS auf normal) */
  hq() { const m = (G && G.settings.gfx) || 'auto'; return m === 'hoch' || (m === 'auto' && !this.lowFps); }
  perf(dt) {
    if (document.hidden || dt <= 0) return;
    this._pf = this._pf || { t: 0, n: 0, slow: 0 }; const pf = this._pf; pf.t += dt; pf.n++;
    if (pf.t > 2500) { const avg = pf.t / pf.n; if (avg > 25) pf.slow++; else pf.slow = Math.max(0, pf.slow - 1); if (pf.slow >= 2 && !this.lowFps) { this.lowFps = true; } pf.t = 0; pf.n = 0; }
  }
  litSprite(u, gt) {
    const k = this.s * Math.ceil(Math.max(1, this.cam.z) * 4) / 4, L = LIGHT[this.bgKey] || LIGHT._;
    const bw = u.type === 'dragon' ? 220 : u.type === 'worm' ? 140 : u.type === 'olifant' ? 160 : u.big ? 130 : 90, bh = u.h + (u.type === 'dragon' ? 90 : 52), ax = bw / 2, ay = bh - 12;
    const W2 = Math.ceil(bw * k), H2 = Math.ceil(bh * k);
    const cv = u._oc || (u._oc = document.createElement('canvas'));
    if (cv.width !== W2 || cv.height !== H2) { cv.width = W2; cv.height = H2; }
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W2, H2);
    c.setTransform(u.side === 'enemy' ? -k : k, 0, 0, k, ax * k, ay * k);
    RIG.draw(c, u.type, u.look, u.anim.n, u.anim.el, gt + u.gt0);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop';
    // Licht-Overlay (Oberlicht, Bodenverdeckung, farbiges Kantenlicht) einmal pro Gebiet & Größe vorberechnet
    const key = this.bgKey + W2 + 'x' + H2; let ov = this._lit && this._lit.get(key);
    if (!ov) {
      this._lit = this._lit || new Map(); if (this._lit.size > 24) this._lit.clear();
      ov = document.createElement('canvas'); ov.width = Math.ceil(W2 / 4); ov.height = Math.ceil(H2 / 4); const o = ov.getContext('2d'), w = ov.width, h = ov.height;
      let g = o.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.34)'); o.fillStyle = g; o.fillRect(0, 0, w, h);
      g = L.from === 'below' ? o.createLinearGradient(0, h, 0, h * .35) : L.from === 'left' ? o.createLinearGradient(w * .25, 0, w * .5, 0) : o.createLinearGradient(w * .75, 0, w * .5, 0);
      g.addColorStop(0, `rgba(${L.c},${L.a})`); g.addColorStop(1, `rgba(${L.c},0)`); o.fillStyle = g; o.fillRect(0, 0, w, h);
      this._lit.set(key, ov);
    }
    c.drawImage(ov, 0, 0, W2, H2);
    if (u.flash > 0) { c.fillStyle = `rgba(255,255,255,${Math.min(1, u.flash / 110) * .7})`; c.fillRect(0, 0, W2, H2); }
    if (u.charging) { c.fillStyle = `rgba(255,60,30,${.18 + Math.sin(gt / 90) * .1})`; c.fillRect(0, 0, W2, H2); }
    c.globalCompositeOperation = 'source-over';
    return { cv, ax, ay, bw, bh };
  }
  drawBars(u) {
    const ctx = this.ctx, x = u.x + u.ox + u.kb, y = u.y + u.oy - u.h - 6, w = u.big ? 28 : 15;
    const rr = (x0, y0, ww, hh, r, col) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, Math.max(0, ww), hh, r) : ctx.rect(x0, y0, Math.max(0, ww), hh); ctx.fillStyle = col; ctx.fill(); };
    rr(x - w / 2 - .6, y - .6, w + 1.2, 3.2, 1.2, 'rgba(8,6,10,.85)');
    const f = u.hp / u.maxHp;
    if (u.ghost === undefined || u.ghost < f) u.ghost = f; u.ghost = Math.max(f, u.ghost - .006);
    rr(x - w / 2, y, w * u.ghost, 2, 1, '#f4e8c8');
    const g = ctx.createLinearGradient(0, y, 0, y + 2); if (u.side === 'hero') { g.addColorStop(0, f < .3 ? '#ff7a6a' : '#9ff08a'); g.addColorStop(1, f < .3 ? '#c8302a' : '#3a9a3a'); } else { g.addColorStop(0, '#ff8a6a'); g.addColorStop(1, '#b8281e'); }
    rr(x - w / 2, y, w * f, 2, 1, g);
    const sh = hasS(u, 'shield'); if (sh) rr(x - w / 2, y + 2.1, Math.min(w, w * sh.val / u.maxHp), .8, .4, '#a8d4ff');
    let i = 0; for (const st of u.statuses) { if (i > 5) break; ctx.fillStyle = STATUS[st.id].c; ctx.beginPath(); ctx.arc(x - w / 2 + 1 + i * 3, y - 2.2, 1, 0, Math.PI * 2); ctx.fill(); i++; }
  }
  drawParts(ctx) {
    for (const p of this.parts) {
      const a = p.amb ? .85 : Math.max(0, 1 - p.t / p.life);
      if (p.streak) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.strokeStyle = p.c; ctx.lineWidth = .55; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2.6, p.y - p.vy * 2.6); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; continue; }
      if (p.amb === 'rain') { ctx.globalAlpha = .5; ctx.strokeStyle = p.c; ctx.lineWidth = .35; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 1.6, p.y - p.vy * 1.6); ctx.stroke(); continue; }
      const glow = p.glow || p.amb === 'embers' || p.amb === 'fireflies';
      if (glow) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (p.amb === 'fireflies' ? .5 + .5 * Math.sin(p.t / 200) : 1); const r = (p.s || 1) * 2.4; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, p.c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); if (p.amb === 'leaves') ctx.ellipse(p.x, p.y, 1, .5, p.t / 300, 0, Math.PI * 2); else ctx.arc(p.x, p.y, (p.s || 1) * .55, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
  }
  drawProj(p) {
    const ctx = this.ctx, k = Math.min(1, p.t / p.dur), x = p.x + (p.tx - p.x) * k, y = p.y + (p.ty - p.y) * k - Math.sin(k * Math.PI) * (p.arc || 0);
    const c = FX_COL[p.kind] || ['#fff'], a = Math.atan2(p.ty - p.y - Math.cos(k * Math.PI) * (p.arc || 0) * 2, p.tx - p.x);
    ctx.save(); ctx.translate(x, y);
    if (p.kind === 'arrow') { ctx.rotate(a); const g = ctx.createLinearGradient(-14, 0, 0, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.5)'); ctx.fillStyle = g; ctx.fillRect(-14, -.3, 12, .6); ctx.strokeStyle = '#c8a878'; ctx.lineWidth = .5; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(1.5, 0); ctx.stroke(); ctx.fillStyle = '#e8eef4'; ctx.beginPath(); ctx.moveTo(3, 0); ctx.lineTo(1.2, -.8); ctx.lineTo(1.2, .8); ctx.fill(); ctx.fillStyle = '#c84040'; ctx.fillRect(-5.2, -.7, 1.4, 1.4); }
    else if (p.kind === 'axe' || p.kind === 'stone') { ctx.rotate(p.t / 50); if (p.kind === 'axe') { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.stroke(); ctx.fillStyle = '#c8ccd0'; ctx.beginPath(); ctx.moveTo(1.6, 0); ctx.quadraticCurveTo(2, -3.4, 4, -2.6); ctx.lineTo(3.2, .4); ctx.fill(); } else { ctx.fillStyle = '#9a9a92'; ctx.beginPath(); ctx.ellipse(0, 0, 1.4, 1.1, 0, 0, Math.PI * 2); ctx.fill(); } }
    else if (p.kind === 'web') { ctx.strokeStyle = 'rgba(240,240,250,.9)'; ctx.lineWidth = .3; for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(3.5, 0); ctx.stroke(); } ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 5); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, c[0]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill(); if (Math.random() < .8) this.parts.push({ x, y, vx: rnd(-.25, .25), vy: rnd(-.25, .25), t: 0, life: 380, c: pick(c), glow: 1 }); }
    ctx.restore();
  }
  drawFx(f) {
    const ctx = this.ctx, k = f.t / f.dur;
    ctx.save();
    if (f.k === 'crack') { const a = k < .1 ? k / .1 : 1 - Math.max(0, (k - .5) / .5); let sd = f.seed; const R = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; }; ctx.translate(f.x, f.y); ctx.scale(1, .3); ctx.lineCap = 'round';
      for (let i = 0; i < 7; i++) { const ang = i / 7 * Math.PI * 2 + R() * .5; let px = 0, py = 0; ctx.beginPath(); ctx.moveTo(0, 0); for (let j = 1; j <= 4; j++) { const rr = f.r * j / 4 * (.6 + R() * .5); px = Math.cos(ang + (R() - .5) * .5) * rr; py = Math.sin(ang + (R() - .5) * .5) * rr; ctx.lineTo(px, py); } ctx.globalAlpha = a * .8; ctx.strokeStyle = 'rgba(10,6,4,.9)'; ctx.lineWidth = 1.6; ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(255,140,60,${.7 * (1 - k)})`; ctx.lineWidth = .5; ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; } }
    else if (f.k === 'rays') { ctx.globalCompositeOperation = 'lighter'; ctx.translate(f.x, f.y); ctx.rotate(this.time / 1100); const a = Math.sin(Math.min(1, k * 1.4) * Math.PI); for (let i = 0; i < 14; i++) { ctx.rotate(Math.PI / 7); const len = 70 + (i % 3) * 26, g = ctx.createLinearGradient(0, 0, len, 0); g.addColorStop(0, `rgba(255,244,210,${.55 * a})`); g.addColorStop(1, 'rgba(255,244,210,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, -3 - (i % 3) * 2.5); ctx.lineTo(len, 3 + (i % 3) * 2.5); ctx.fill(); } const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, 26); g2.addColorStop(0, `rgba(255,255,240,${.8 * a})`); g2.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill(); }
    else if (f.k === 'light') { ctx.globalCompositeOperation = 'lighter'; const a = (1 - k) * (1 - k) * (f.a || .25), g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); g.addColorStop(0, RIG.rgba(f.c, a)); g.addColorStop(.5, RIG.rgba(f.c, a * .35)); g.addColorStop(1, RIG.rgba(f.c, 0)); ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2); }
    else if (f.k === 'slash') { ctx.globalCompositeOperation = 'lighter'; ctx.translate(f.x, f.y); ctx.scale(f.dir, 1); const st = -1.6 + k * .9, en = st + 2.2 * Math.min(1, k * 2.2); ctx.lineCap = 'round'; for (const [w, col] of [[3.2, 'rgba(160,200,255,.35)'], [1.4, 'rgba(255,255,255,.95)']]) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = col; ctx.lineWidth = w * (1 - k * .6); ctx.beginPath(); ctx.arc(0, 0, f.r, st, en); ctx.stroke(); } }
    else if (f.k === 'bolt') { ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round'; const pts = f.pts || (f.pts = Array.from({ length: 9 }, (_, i) => [f.x + (f.tx - f.x) * i / 8 + (i && i < 8 ? rnd(-4, 4) : 0), f.y + (f.ty - f.y) * i / 8 + (i && i < 8 ? rnd(-3, 3) : 0)])); if (Math.random() < .3) f.pts = null; for (const [w, col] of [[3, 'rgba(100,170,255,.4)'], [1, '#ffffff']]) { ctx.globalAlpha = 1 - k * .7; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.stroke(); } }
    else if (f.k === 'ring') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (1 - k) * .9; ctx.strokeStyle = f.c; ctx.lineWidth = 1.4 * (1 - k) + .3; ctx.beginPath(); ctx.ellipse(f.x, f.y, 2 + RIG.easeOut(k) * f.r, (2 + RIG.easeOut(k) * f.r) * .45, 0, 0, Math.PI * 2); ctx.stroke(); }
    else if (f.k === 'circle') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(k * Math.PI) * .9; ctx.translate(f.x, f.y); ctx.scale(1, .38); ctx.rotate(k * 3); ctx.strokeStyle = f.c; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.fillStyle = f.c; ctx.fillRect(6.8, -.4, 1.8, .8); } }
    else if (f.k === 'pillar') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(k * Math.PI) * .8; const g = ctx.createLinearGradient(f.x - 6, 0, f.x + 6, 0); g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(.5, f.c); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 6, -20, 12, f.y + 20); }
    else if (f.k === 'burst') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; const r = 2 + RIG.easeOut(k) * f.r; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, f.c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}

/* ---------- Hilfen ---------- */
function alive(u) { return u && u.hp > 0; }
function hasS(u, id) { return u.statuses.find(s => s.id === id); }
function rmS(u, id) { u.statuses = u.statuses.filter(s => s.id !== id); }
function cleanse(u) { u.statuses = u.statuses.filter(s => !STATUS[s.id].bad); }
function addS(u, id, dur, val, W) {
  if (!alive(u)) return;
  if (id === 'stun' && u.boss && Math.random() < .5) { W?.num(u, 'Widersteht', '#c8c8c8'); return; }
  const ex = hasS(u, id);
  if (ex) { ex.dur = Math.max(ex.dur, dur); if (val) ex.val = Math.max(ex.val || 0, val); } else u.statuses.push({ id, dur, val });
}
function effStat(u, stat) {
  let v = u[stat];
  if (stat === 'atk' || stat === 'mag') { if (hasS(u, 'atkUp')) v *= 1.3; if (hasS(u, 'atkDown')) v *= .75; if (hasS(u, 'enrage')) v *= 1.25; }
  if (stat === 'def' || stat === 'res') { if (hasS(u, 'defUp')) v *= 1.5; if (hasS(u, 'defDown')) v *= .65; }
  return v;
}
function effSpd(u) { let v = u.spd; if (hasS(u, 'haste')) v *= 1.35; if (hasS(u, 'slow')) v *= .7; return v; }
function basicSkill(u) {
  const w = u.wpn, mag = u.atkStat === 'mag';
  const anim = w === 'bow' ? 'shoot' : mag ? 'cast' : u.side === 'enemy' && u.ranged ? 'shoot' : 'melee';
  const fx = w === 'bow' ? 'arrow' : mag ? (['#c060ff', '#b080ff'].includes(u.look.glowC) ? 'dark' : 'light') : u.type === 'quad' || u.type === 'spider' ? 'bite' : ['hammer', 'club', 'mace', 'claws', 'pan'].includes(w) ? 'stone' : 'slash';
  return { n: 'Angriff', basic: 1, anim, fx, tgt: 'single', dmg: 1, stat: mag ? 'mag' : 'atk' };
}

const MEGA = { balrog: 'Flammen von Udûn', smaug: 'Drachenfeuer', sauron: 'Macht des Einen', witch_king: 'Schrei von Angmar', annatar: 'Gabe der Vernichtung', sauron_rop: 'Gabe der Vernichtung', shelob: 'Netz der Finsternis', necromancer: 'Schatten von Dol Guldur', azog: 'Hass des Schänders' };
function bossMega(u) { return MEGA[u.key] || 'Vernichtungsschlag'; }
