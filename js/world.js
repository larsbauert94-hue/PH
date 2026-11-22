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
  addEnemy(key, lvl, kind) {
    const E = ENEMIES[key], m = 1 + .15 * (lvl - 1) + .002 * (lvl - 1) * (lvl - 1), D = DIFF_E;
    const hpMul = (E.boss ? 4.6 : E.elite ? 3 : 2.6) * D.hp;
    const u = this.prep({
      side: 'enemy', key, name: E.n, type: E.type, look: Object.assign({ wpn: E.wpn || 'sword' }, E.look), wpn: E.wpn || 'claws',
      maxHp: Math.round(E.hp * m * hpMul), atk: Math.round(E.atk * m * D.dmg * 3.3), mag: Math.round(E.mag * m * D.dmg * 3.3), def: Math.round(E.def * m), res: Math.round(E.res * m),
      spd: E.spd, crit: 5, critDmg: 50, p: {}, boss: !!E.boss, elite: !!E.elite || kind === 'elite', tags: E.tags || [], lvl, statuses: [], cd: {}, threat: 0,
      skills: E.sk.map(id => ESK[id]), xp: Math.round(E.xp * (1 + .22 * (lvl - 1))), gold: Math.round(E.g * (1 + .16 * (lvl - 1))), transform: E.transform, ranged: !!E.ranged,
      atkStat: E.look.glowC && E.wpn === 'staff' ? 'mag' : 'atk'
    });
    u.hp = u.maxHp; const Dm = RIG.dims(u.type, u.look); u.h = Dm.h; u.big = Dm.big; u.w = Dm.w;
    this.enemies.push(u); return u;
  }
  all() { return [...this.heroes, ...this.enemies]; }

  /* ---------- Zeit ---------- */
  wait(ms) { return new Promise(res => this.timers.push({ t: this.time + ms, res })); }
  loop(now) {
    if (this.dead) return;
    const dt = Math.min(60, now - this.last); this.last = now;
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
  async fight(group, lvl, kind) {
    this.enemies = []; this.parts = this.parts.filter(p => p.amb);
    this.restoreHeroes();
    group.forEach(k => this.addEnemy(k, lvl, kind)); this.layoutEnemies();
    // Gegner marschieren heran, während die Gruppe weiterzieht
    this.walking = true; this.heroes.forEach(h => this.setAnim(h, 'walk'));
    const dist = this.LW * .75;
    await Promise.all(this.enemies.map((e, i) => { e.ox = dist + i * 8; this.setAnim(e, 'walk'); return this.moveTo(e, e.x, e.y, 1300 + i * 120); }));
    this.walking = false; this.all().forEach(u => this.setAnim(u, 'idle'));
    if (kind === 'boss') { this.focus(this.enemies[0], 1.28, 900); this.shake(3); sfx('crit'); }
    this.applyStartPassives();
    [...this.heroes, ...this.enemies].forEach(u => { u.atb = rnd(0, 40) + u.spd; });
    this.fighting = true; this.busy = false; this.turn = 0;
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
  checkEnd() { if (!this.fighting) return null; if (this.enemies.every(e => !alive(e))) return 'win'; if (this.heroes.every(h => !alive(h))) return 'lose'; return null; }
  async finish(res) {
    this.fighting = false; this.busy = true;
    if (res === 'win') { this.heroes.filter(alive).forEach(h => { h.holdAnim = 'victory'; this.setAnim(h, 'victory'); }); sfx('win'); }
    else sfx('lose');
    await this.wait(1300);
    this.heroes.forEach(h => { h.holdAnim = null; if (alive(h)) this.setAnim(h, 'idle'); });
    this.busy = false;
    const cb = this.onFightEnd; this.onFightEnd = null; cb && cb({ win: res === 'win', enemies: this.enemies });
  }
  async act(u) {
    this.busy = true; u.atb = 0; this.active = u; this.turn++;
    try {
      const skip = await this.turnStart(u);
      if (alive(u) && !skip && !this.checkEnd()) { const plan = this.ai(u); if (plan) await this.perform(u, plan.sk, plan.t, plan.ult); }
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
      else { addS(u, 'enrage', 99, 0, this); this.h.banner?.(`${u.name} gerät in Raserei!`, 'foe'); this.flash('#ff3a1a', 400); this.shake(3); sfx('crit'); await this.wait(600); }
    }
    return false;
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
    if (u.energy >= 100 && this.useful(u, K.ult, friends, foes)) return { sk: K.ult, t: this.pickTarget(u, K.ult, foes, friends), ult: 1 };
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
    const foes = this.foesOf(u);
    if (isUlt) u.energy = 0;
    if (sk.cd) u.cd[sk.n] = sk.cd;
    if (u.side === 'hero' && !isUlt) u.energy = Math.min(100, u.energy + 14 * (1 + (u.p.ultCharge || 0) / 100));
    if (!sk.basic) this.h.banner?.(isUlt ? `${u.name}: ${sk.n}` : sk.n, u.side === 'enemy' ? 'foe' : isUlt ? 'ult' : '', u);
    this.h.log?.(u, sk);
    if (isUlt) { this.focus(u, 1.26, 1100); sfx('ult'); this.flash(u.side === 'hero' ? '#ffe9a8' : '#ff3a1a', 500); this.fxs.push({ k: 'pillar', x: u.x, y: u.y, c: '#ffe080', t: 0, dur: 800 }); this.shake(2); this.h.ult?.(u, sk); await this.wait(500); }
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
          for (const t of tgs) { this.fxs.push({ k: 'slash', x: t.x + t.ox, y: t.y + t.oy - t.h * .55, r: t.big ? 14 : 7, dir: -dir, t: 0, dur: 180 }); if (sk.fx !== 'slash') this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, sk.fx, 8); doHit(t); }
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
    if (t.p?.dodge && Math.random() < t.p.dodge / 100) { this.num(t, 'Ausgewichen', '#c8c8c8'); sfx('miss'); return 0; }
    const stat = sk.stat || (sk.basic ? a.atkStat : 'atk');
    const A = effStat(a, stat), D = effStat(t, stat === 'mag' ? 'res' : 'def');
    let d = (sk.dmg || 1) * A * (1.5 * A) / (1.5 * A + D) * mult;
    const hpF = t.hp / t.maxHp, ap = a.p || {}, tp = t.p || {};
    if (sk.bonusTag && t.tags?.includes(sk.bonusTag)) d *= 1.4;
    if (sk.bossBonus && t.boss) d *= sk.bossBonus;
    if (sk.exec && hpF < .4) d *= 2;
    if (sk.lowHp) d *= 1 + (1 - a.hp / a.maxHp);
    if (ap.execute && hpF < .3) d *= 1 + ap.execute;
    if (ap.lowHpDmg) d *= 1 + ap.lowHpDmg * (1 - a.hp / a.maxHp);
    if (ap.vsOrk && t.tags?.includes('ork')) d *= 1 + ap.vsOrk;
    if (ap.vsGeist && t.tags?.includes('geist')) d *= 1 + ap.vsGeist;
    if (hasS(t, 'mark')) d *= 1.3;
    if (hasS(t, 'guard')) d *= .6;
    if (tp.dmgRed) d *= 1 - tp.dmgRed / 100;
    const crit = !!sk.alwaysCrit || Math.random() < (a.crit + (sk.critB || 0)) / 100;
    if (crit) d *= 1 + a.critDmg / 100;
    d *= rnd(.92, 1.08);
    let dmg = Math.max(1, Math.round(d));
    const sh = hasS(t, 'shield');
    if (sh) { const ab = Math.min(sh.val, dmg); sh.val -= ab; dmg -= ab; if (sh.val <= 0) rmS(t, 'shield'); if (ab) this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, 'ice', 4); }
    t.hp = Math.max(0, t.hp - dmg);
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
    amt *= (1 + (sp.healPct || 0) / 100) * (1 + (tp.healRecv || 0) / 100);
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
    u.hp = 0; u.statuses = []; this.setAnim(u, 'dead'); sfx('die');
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
    if (glow && n >= 6) this.fxs.push({ k: 'burst', x, y, r: 6 + n * .4, c: c[0], t: 0, dur: 320 });
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
    tile(L.mid, .35, YO, L.HZ + 4);
    tile(L.ground, 1, L.HZ + YO, LH - L.HZ - YO + 4);
    this.drawAtmos(ctx, gt);
    const units = this.all().filter(u => u.fade > 0).sort((a, b) => (a.y + a.oy) - (b.y + b.oy));
    for (const u of units) { const x = u.x + u.ox + u.kb, y = u.y + u.oy; ctx.globalAlpha = .45 * u.fade; const gr = ctx.createRadialGradient(x, y, 0, x, y, u.w + 2); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(x, y, u.w + 2, (u.w + 2) * .28, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const f of this.fxs) if (f.under) this.drawFx(f);
    for (const u of units) this.drawUnit(u, gt);
    for (const f of this.fxs) if (!f.under) this.drawFx(f);
    for (const p of this.projs) this.drawProj(p);
    this.drawParts(ctx);
    for (const u of units) if (alive(u) && (this.fighting || u.side === 'enemy')) this.drawBars(u);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of this.nums) {
      const k = n.t / 1000, pop = k < .15 ? RIG.easeOut(k / .15) * 1.35 : 1.35 - Math.min(.35, (k - .15) * 1.5);
      ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
      ctx.font = `700 ${(n.sc > 1 ? 9.5 : 6.4) * pop}px Cinzel, Georgia, serif`; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(10,6,12,.9)';
      const y = n.y - RIG.easeOut(Math.min(1, k * 1.3)) * 12;
      ctx.strokeText(n.txt, n.x, y); ctx.fillStyle = n.c; ctx.fillText(n.txt, n.x, y);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Vignette
    const vg = ctx.createRadialGradient(this.cv.width / 2, this.cv.height * .55, this.cv.height * .4, this.cv.width / 2, this.cv.height * .55, this.cv.width * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, this.cv.width, this.cv.height);
    if (this.flashV) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 * Math.pow(1 - this.flashV.t / this.flashV.dur, 2); ctx.fillStyle = this.flashV.c; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (this.fade > 0) { ctx.globalAlpha = Math.sin(this.fade * Math.PI); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.globalAlpha = 1; }
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
  drawUnit(u, gt) {
    const ctx = this.ctx, x = u.x + u.ox + u.kb, y = u.y + u.oy;
    ctx.save(); ctx.translate(x, y); if (u.side === 'enemy') ctx.scale(-1, 1);
    ctx.globalAlpha = u.fade * (hasS(u, 'invis') ? .38 : 1);
    RIG.draw(ctx, u.type, u.look, u.anim.n, u.anim.el, gt + u.gt0);
    if (u.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, u.flash / 110) * .55; RIG.draw(ctx, u.type, u.look, u.anim.n, u.anim.el, gt + u.gt0); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore(); ctx.globalAlpha = 1;
    if (hasS(u, 'shield') && alive(u)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22 + Math.sin(gt / 200) * .06; const r = u.h * .62; const g = ctx.createRadialGradient(x, y - u.h * .5, r * .5, x, y - u.h * .5, r); g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(1, 'rgba(160,210,255,.9)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - u.h * .5, r * .75, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (u.side === 'hero' && u.energy >= 100 && alive(u)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25 + Math.sin(gt / 150) * .12; const g = ctx.createRadialGradient(x, y - u.h * .5, 0, x, y - u.h * .5, u.h * .7); g.addColorStop(0, 'rgba(255,220,120,.6)'); g.addColorStop(1, 'rgba(255,200,80,0)'); ctx.fillStyle = g; ctx.fillRect(x - u.h, y - u.h * 1.3, u.h * 2, u.h * 1.6); ctx.restore(); }
    if (this.active === u && alive(u)) { const ty = y - u.h - 11 + Math.sin(gt / 180) * 1.2; ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.moveTo(x - 2, ty); ctx.lineTo(x + 2, ty); ctx.lineTo(x, ty + 2.4); ctx.fill(); }
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
    if (f.k === 'slash') { ctx.globalCompositeOperation = 'lighter'; ctx.translate(f.x, f.y); ctx.scale(f.dir, 1); const st = -1.6 + k * .9, en = st + 2.2 * Math.min(1, k * 2.2); ctx.lineCap = 'round'; for (const [w, col] of [[3.2, 'rgba(160,200,255,.35)'], [1.4, 'rgba(255,255,255,.95)']]) { ctx.globalAlpha = 1 - k; ctx.strokeStyle = col; ctx.lineWidth = w * (1 - k * .6); ctx.beginPath(); ctx.arc(0, 0, f.r, st, en); ctx.stroke(); } }
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
