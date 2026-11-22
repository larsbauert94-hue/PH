'use strict';
/* =====================================================================
   RINGFAHRT – Auto-Kampf-Engine (Canvas, 256×144 logische Pixel)
   ===================================================================== */
const LW = 256, LH = 144;
const H_SLOTS = [[100, 114], [80, 99], [82, 129], [56, 106], [52, 132], [32, 118]];
const E_SLOTS = [[156, 114], [176, 99], [174, 129], [200, 106], [204, 132], [224, 118]];
const BOSS_SLOT = [196, 122];
const FX_COL = {
  slash: ['#ffffff', '#d8e0f0'], arrow: ['#e8d8b0'], fire: ['#ff5a1a', '#ffb030', '#ffe070'], light: ['#ffffff', '#fff6c0', '#c8e8ff'],
  lightning: ['#ffffff', '#a8d8ff', '#6ab0ff'], heal: ['#9fe07a', '#d8ffb0', '#ffffff'], buff: ['#f3d78f', '#ffffff'], axe: ['#c8ccd0'],
  stone: ['#9a9a92', '#c8c8c0'], ice: ['#c8f0ff', '#8ad0ff', '#ffffff'], water: ['#4a9ae0', '#8ac8f0', '#ffffff'], dark: ['#8a3ac8', '#4a1a6a', '#d080ff'],
  leaf: ['#6ab03a', '#a8d860', '#3a7a2a'], bite: ['#ffffff', '#e04040'], web: ['#e8e8f0', '#c8c8d8'], holy: ['#ffe080', '#ffffff', '#ffd040']
};

class Battle {
  constructor(o) {
    this.cv = o.canvas; this.ctx = this.cv.getContext('2d');
    this.bgKey = o.bg; this.cam = { z: 1, tz: 1, x: 128, y: 80, tx: 128, ty: 80 };
    this.kind = o.kind; this.onEnd = o.onEnd; this.onBanner = o.onBanner || (() => { }); this.onLog = o.onLog || (() => { });
    this.time = 0; this.timers = []; this.busy = false; this.over = false; this.paused = false;
    this.speed = o.speed || 1; this.parts = []; this.projs = []; this.nums = []; this.fxs = []; this.amb = []; this.shakeV = 0; this.flashV = null;
    this.ultQueue = new Set(); this.turn = 0;
    this.heroes = o.heroes.map((h, i) => this.mkHero(h, i));
    this.layoutHeroes();
    this.enemies = []; o.enemies.forEach(e => this.addEnemy(e.key, e.lvl, e.kind || o.kind));
    this.layoutEnemies();
    this.applyStartPassives();
    [...this.heroes, ...this.enemies].forEach(u => { u.atb = rnd(0, 45) + u.spd; });
    this.scale = 1; this.resize();
    this.last = performance.now(); this.raf = requestAnimationFrame(t => this.loop(t));
  }
  destroy() { cancelAnimationFrame(this.raf); this.over = true; this.dead = true; }

  /* ---------- Einheiten ---------- */
  mkHero(h, i) {
    const H = HEROES[h.key], C = CLASSES[H.cls], st = heroStats(h.key), hs = G.heroes[h.key];
    const look = heroLook(h.key);
    const u = {
      side: 'hero', key: h.key, name: H.n, sid: h.key + '#' + hs.stage, type: 'hum', look, wpn: H.wpn, cls: H.cls, role: C.role,
      maxHp: st.hp, hp: Math.max(1, Math.round(st.hp * (h.hpFrac ?? 1))), atk: st.atk, mag: st.mag, def: st.def, res: st.res, spd: st.spd, crit: st.crit, critDmg: st.critDmg, p: st.p,
      resT: C.res, resV: RESOURCES[C.res].start, energy: clamp(h.energy || 0, 0, 100) + (st.p.startEnergy || 0), threatMul: C.threat * (1 + (st.p.threat || 0) / 100),
      skills: heroSkills(h.key), ult: heroUlt(h.key), cd: {}, statuses: [], threat: 0, tactic: hs.tactic,
      atkStat: C.res === 'mana' && H.wpn === 'staff' ? 'mag' : 'atk', lvl: hs.lvl
    };
    if (h.hpFrac === 0) u.hp = 0;
    u.energy = clamp(u.energy, 0, 100);
    return this.prepUnit(u);
  }
  addEnemy(key, lvl, kind) {
    const E = ENEMIES[key], m = 1 + .15 * (lvl - 1) + .002 * (lvl - 1) * (lvl - 1), D = DIFF_E;
    const hpMul = (E.boss ? 3 : E.elite ? 2.3 : 2) * D.hp * (kind === 'boss' && !E.boss ? 1.3 : 1);
    const u = {
      side: 'enemy', key, name: E.n, sid: 'e:' + key, type: E.type, look: Object.assign({ wpn: E.wpn || 'sword' }, E.look), wpn: E.wpn || 'claws',
      maxHp: Math.round(E.hp * m * hpMul), atk: Math.round(E.atk * m * D.dmg * 2.6), mag: Math.round(E.mag * m * D.dmg * 2.6), def: Math.round(E.def * m), res: Math.round(E.res * m),
      spd: E.spd, crit: 5, critDmg: 50, p: {}, boss: !!E.boss, elite: !!E.elite, tags: E.tags || [], lvl,
      skills: E.sk.map(id => ESK[id]), cd: {}, statuses: [], threat: 0, xp: Math.round(E.xp * (1 + .22 * (lvl - 1))), gold: Math.round(E.g * (1 + .16 * (lvl - 1))),
      transform: E.transform, atkStat: E.look.glowC && E.wpn === 'staff' ? 'mag' : 'atk', ranged: !!E.ranged
    };
    u.hp = u.maxHp;
    this.prepUnit(u); this.enemies.push(u); return u;
  }
  prepUnit(u) {
    u.ox = 0; u.oy = 0; u.kb = 0; u.anim = { n: 'idle', el: 0 }; u.gt0 = Math.random() * 5000; u.flash = 0; u.fade = 1; u.atb = 0;
    const D = RIG.dims(u.type, u.look); u.h = D.h; u.big = D.big; u.w = D.w;
    if (u.hp <= 0) { u.anim = { n: 'dead', el: 9999 }; }
    return u;
  }
  layoutHeroes() {
    const order = [...this.heroes].sort((a, b) => this.slotRank(a) - this.slotRank(b));
    order.forEach((u, i) => { const s = H_SLOTS[i] || H_SLOTS[5]; u.x = s[0]; u.y = s[1]; });
  }
  slotRank(u) { if (u.role === 'tank') return 0; if (u.role === 'dd' && !['bow', 'staff'].includes(u.wpn)) return 1; if (u.role === 'dd') return 2; return 3; }
  layoutEnemies() {
    const live = this.enemies;
    const boss = live.find(e => e.big);
    let slots = E_SLOTS.slice();
    if (boss) { boss.x = BOSS_SLOT[0]; boss.y = BOSS_SLOT[1]; slots = [[150, 104], [154, 132], [138, 118], [230, 134], [232, 100]]; }
    const rest = live.filter(e => e !== boss).sort((a, b) => (a.ranged ? 1 : 0) - (b.ranged ? 1 : 0));
    rest.forEach((u, i) => { if (u.x === undefined) { const s = slots[i % slots.length]; u.x = s[0]; u.y = s[1]; } });
  }
  applyStartPassives() {
    const heroes = this.heroes.filter(alive);
    for (const u of heroes) {
      const p = u.p;
      if (p.startShieldSelf) addS(u, 'shield', 5, Math.round(u.maxHp * p.startShieldSelf), this);
      if (p.startShieldAll) heroes.forEach(t => addS(t, 'shield', 4, Math.round(u.mag * p.startShieldAll), this));
      if (p.startBuffDef) heroes.forEach(t => addS(t, 'defUp', 2, 0, this));
      if (p.startBuffRegen) heroes.forEach(t => addS(t, 'regen', 3, 0, this));
      if (p.startInvis) addS(u, 'invis', 2, 0, this);
      if (p.startHaste) addS(u, 'haste', 3, 0, this);
    }
  }

  /* ---------- Zeit ---------- */
  wait(ms) { return new Promise(res => this.timers.push({ t: this.time + ms, res })); }
  loop(now) {
    if (this.dead) return;
    let dt = Math.min(100, now - this.last); this.last = now;
    if (!this.paused) this.update(dt * this.speed);
    this.render();
    this.raf = requestAnimationFrame(t => this.loop(t));
  }
  update(dt) {
    this.time += dt;
    const due = this.timers.filter(t => t.t <= this.time); this.timers = this.timers.filter(t => t.t > this.time); due.forEach(t => t.res());
    for (const u of this.all()) {
      const A = RIG.ANIMS[u.anim.n]; u.anim.el += dt;
      if (!A.loop && !A.hold && u.anim.el >= RIG.animTime(u.anim.n)) u.anim = { n: alive(u) ? (u.hold || 'idle') : 'dead', el: alive(u) ? 0 : 9999 };
      if (u.move) { const m = u.move; m.t += dt; const k = RIG.ease(Math.min(1, m.t / m.dur)); u.ox = m.fx + (m.tx - m.fx) * k; u.oy = m.fy + (m.ty - m.fy) * k; if (m.t >= m.dur) { u.move = null; m.res(); } }
      if (u.flash > 0) u.flash -= dt;
      if (u.kb) { u.kb *= Math.pow(.86, dt / 16); if (Math.abs(u.kb) < .05) u.kb = 0; }
      if (!alive(u) && u.side === 'enemy') u.fade = Math.max(0, u.fade - dt / 1400);
    }
    const c = this.cam, cz = Math.pow(.9, dt / 16); c.z = c.tz + (c.z - c.tz) * cz; c.x = c.tx + (c.x - c.tx) * cz; c.y = c.ty + (c.y - c.ty) * cz;
    for (const p of this.projs) { p.t += dt; if (p.t >= p.dur && !p.done) { p.done = 1; p.res(); } }
    this.projs = this.projs.filter(p => !p.done);
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += (p.g || 0) * dt / 16; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const n of this.nums) n.t += dt; this.nums = this.nums.filter(n => n.t < 1000);
    for (const f of this.fxs) f.t += dt; this.fxs = this.fxs.filter(f => f.t < f.dur);
    this.shakeV = Math.max(0, this.shakeV - dt * .02);
    if (this.flashV) { this.flashV.t += dt; if (this.flashV.t > this.flashV.dur) this.flashV = null; }
    this.ambient(dt);
    if (!this.busy && !this.over) {
      const live = this.all().filter(alive);
      for (const u of live) u.atb += effSpd(u) * dt * .016;
      const ready = live.filter(u => u.atb >= 100).sort((a, b) => b.atb - a.atb)[0];
      if (ready) this.act(ready);
    }
  }
  all() { return [...this.heroes, ...this.enemies]; }
  ambient(dt) {
    const T = BACKGROUNDS[this.bgKey] || {}; const kind = T.parts;
    if (!kind || kind === 'none') return;
    const rate = { rain: .5, snow: .12, embers: .06, fireflies: .02, leaves: .03, ash: .05, spray: .05 }[kind] || 0;
    if (Math.random() < rate * dt / 16) {
      const p = { t: 0, life: 4000, x: Math.random() * LW, y: -2, vx: 0, vy: .5, amb: kind };
      if (kind === 'rain') Object.assign(p, { vx: -.6, vy: 3.2, life: 900, c: '#8a9ab0' });
      if (kind === 'snow') Object.assign(p, { vx: -.15, vy: .35, c: '#ffffff' });
      if (kind === 'embers') Object.assign(p, { y: LH, vy: -.45, vx: rnd(-.2, .2), c: pick(['#ff6a1a', '#ffb040', '#ff3a10']) });
      if (kind === 'fireflies') Object.assign(p, { y: rnd(60, 130), vy: rnd(-.1, .1), vx: rnd(-.15, .15), c: '#e8ff80', life: 3000 });
      if (kind === 'leaves') Object.assign(p, { vx: .3, vy: .4, c: pick(['#6a9a3a', '#a8a040']) });
      if (kind === 'ash') Object.assign(p, { vx: .15, vy: .25, c: '#8a8088' });
      if (kind === 'spray') Object.assign(p, { y: 90, vy: -.4, vx: rnd(-.3, .3), g: .02, life: 900, c: '#c8e0f0' });
      this.parts.push(p);
    }
  }

  /* ---------- Darstellung ---------- */
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const W = Math.round((r.width || LW * 3) * dpr), H = Math.round(W * LH / LW);
    if (this.cv.width !== W) { this.cv.width = W; this.cv.height = H; }
    this.scale = W / LW;
  }
  render() {
    const ctx = this.ctx, s = this.scale, cam = this.cam, gt = this.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
    const shx = this.shakeV ? Math.sin(gt * .09) * this.shakeV * .8 : 0, shy = this.shakeV ? Math.cos(gt * .11) * this.shakeV * .5 : 0;
    // Kamera: leichter Zoom auf Aktionen
    const z = cam.z, ox = (cam.x - LW / 2) * (z - 1), oy = (cam.y - LH / 2) * (z - 1);
    const T = (x, y) => ctx.setTransform(s * z, 0, 0, s * z, (-(LW / 2) * (z - 1) - ox + shx) * s, (-(LH / 2) * (z - 1) - oy + shy) * s);
    T();
    ctx.drawImage(RIG.background(this.bgKey, this.cv.width, this.cv.height), 0, 0, LW, LH);
    this.drawAtmos(ctx, gt);
    const units = this.all().filter(u => u.fade > 0).sort((a, b) => (a.y + a.oy) - (b.y + b.oy));
    for (const u of units) { const x = u.x + u.ox + u.kb, y = u.y + u.oy; ctx.globalAlpha = .45 * u.fade; const g = ctx.createRadialGradient(x, y, 0, x, y, u.w + 2); g.addColorStop(0, 'rgba(0,0,0,.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, u.w + 2, (u.w + 2) * .28, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    for (const f of this.fxs) if (f.under) this.drawFx(f);
    for (const u of units) this.drawUnit(u, gt, s * z);
    for (const f of this.fxs) if (!f.under) this.drawFx(f);
    for (const p of this.projs) this.drawProj(p);
    this.drawParts(ctx);
    for (const u of units) if (alive(u)) this.drawBars(u);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const n of this.nums) {
      const k = n.t / 1000, pop = k < .15 ? RIG.easeOut(k / .15) * 1.35 : 1.35 - Math.min(.35, (k - .15) * 1.5);
      ctx.globalAlpha = k > .7 ? (1 - k) / .3 : 1;
      const fs = (n.sc > 1 ? 9.5 : 6.6) * pop;
      ctx.font = `700 ${fs}px Cinzel, Georgia, serif`; ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(10,6,12,.9)';
      const y = n.y - RIG.easeOut(Math.min(1, k * 1.3)) * 12;
      ctx.strokeText(n.txt, n.x, y); ctx.fillStyle = n.c; ctx.fillText(n.txt, n.x, y);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.flashV) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 * Math.pow(1 - this.flashV.t / this.flashV.dur, 2); ctx.fillStyle = this.flashV.c; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    if (this.paused) { ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(0, 0, this.cv.width, this.cv.height); ctx.fillStyle = '#f3d78f'; ctx.font = `700 ${16 * s}px Cinzel, serif`; ctx.textAlign = 'center'; ctx.fillText('PAUSE', this.cv.width / 2, this.cv.height / 2); }
  }
  drawAtmos(ctx, gt) {
    const T = BACKGROUNDS[this.bgKey] || {};
    // Nebelschwaden
    ctx.save(); ctx.globalAlpha = .16;
    for (let i = 0; i < 4; i++) { const x = ((gt * .004 * (i + 1) + i * 90) % 360) - 60, y = 84 + i * 6; const g = ctx.createRadialGradient(x, y, 0, x, y, 50); g.addColorStop(0, T.sky ? T.sky[T.sky.length - 1] : '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, 60, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    if (T.sun) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .07 + Math.sin(gt / 3000) * .02; ctx.fillStyle = '#fff3c0'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(206 - 6 + i * 4, 26); ctx.lineTo(120 - i * 40, 150); ctx.lineTo(150 - i * 40, 150); ctx.closePath(); ctx.fill(); } ctx.restore(); }
    if (T.lava) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .12 + Math.sin(gt / 500) * .05; const g = ctx.createLinearGradient(0, 144, 0, 90); g.addColorStop(0, '#ff4a10'); g.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = g; ctx.fillRect(0, 90, 256, 54); ctx.restore(); }
  }
  drawUnit(u, gt, px) {
    const ctx = this.ctx, x = u.x + u.ox + u.kb, y = u.y + u.oy;
    ctx.save(); ctx.translate(x, y); if (u.side === 'enemy') ctx.scale(-1, 1);
    ctx.globalAlpha = u.fade * (hasS(u, 'invis') ? .38 : 1);
    RIG.draw(ctx, u.type, u.look, u.anim.n, u.anim.el, gt + u.gt0);
    if (u.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, u.flash / 110) * .55; RIG.draw(ctx, u.type, u.look, u.anim.n, u.anim.el, gt + u.gt0); ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore(); ctx.globalAlpha = 1;
    if (hasS(u, 'shield') && alive(u)) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .22 + Math.sin(gt / 200) * .06; const r = u.h * .62; const g = ctx.createRadialGradient(x, y - u.h * .5, r * .5, x, y - u.h * .5, r); g.addColorStop(0, 'rgba(120,180,255,0)'); g.addColorStop(1, 'rgba(160,210,255,.9)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - u.h * .5, r * .75, r, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (this.active === u && alive(u)) { const ty = y - u.h - 11 + Math.sin(gt / 180) * 1.2; ctx.fillStyle = '#ffd97a'; ctx.beginPath(); ctx.moveTo(x - 2, ty); ctx.lineTo(x + 2, ty); ctx.lineTo(x, ty + 2.4); ctx.fill(); }
  }
  drawBars(u) {
    const ctx = this.ctx, x = u.x + u.ox + u.kb, y = u.y + u.oy - u.h - 6, w = u.big ? 28 : 15;
    const rr = (x0, y0, ww, hh, r, col) => { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, Math.max(0, ww), hh, r) : ctx.rect(x0, y0, Math.max(0, ww), hh); ctx.fillStyle = col; ctx.fill(); };
    rr(x - w / 2 - .6, y - .6, w + 1.2, 3.2, 1.2, 'rgba(8,6,10,.85)');
    const f = u.hp / u.maxHp;
    if (u.ghost === undefined) u.ghost = f; u.ghost = Math.max(f, u.ghost - .006);
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
    const c = FX_COL[p.kind] || ['#fff'];
    const a = Math.atan2(p.ty - p.y - Math.cos(k * Math.PI) * (p.arc || 0) * 2, p.tx - p.x);
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
    else if (f.k === 'pillar') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.sin(k * Math.PI) * .8; const g = ctx.createLinearGradient(f.x - 6, 0, f.x + 6, 0); g.addColorStop(0, 'rgba(255,220,120,0)'); g.addColorStop(.5, f.c); g.addColorStop(1, 'rgba(255,220,120,0)'); ctx.fillStyle = g; ctx.fillRect(f.x - 6, 0, 12, f.y); }
    else if (f.k === 'burst') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; const r = 2 + RIG.easeOut(k) * f.r; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.35, f.c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  burst(x, y, kind, n = 10, spread = 1.2, up = 0) {
    const c = FX_COL[kind] || ['#ffffff'];
    const glow = ['fire', 'light', 'lightning', 'heal', 'holy', 'buff', 'ice', 'dark', 'water'].includes(kind);
    if (glow && n >= 6) this.fxs.push({ k: 'burst', x, y, r: 6 + n * .4, c: c[0], t: 0, dur: 320 });
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rnd(-2, 2), y: y + rnd(-2, 2), vx: rnd(-spread, spread), vy: rnd(-spread, spread) - up, g: up ? -.004 : .035, t: 0, life: rnd(350, 750), c: pick(c), s: Math.random() < .3 ? 1.6 : 1, glow });
  }
  num(u, txt, c, sc = 1) { this.nums.push({ x: u.x + u.ox + rnd(-4, 4), y: u.y + u.oy - u.h - 10, txt: String(txt), c, sc, t: 0 }); }
  shake(v) { this.shakeV = Math.max(this.shakeV, v); }
  flash(c, dur = 300) { this.flashV = { c, t: 0, dur }; }
  focus(u, z = 1.08, ms = 700) { this.cam.tz = z; this.cam.tx = u.x; this.cam.ty = u.y - u.h * .5; clearTimeout(this._camT); this.wait(ms).then(() => { this.cam.tz = 1; this.cam.tx = 128; this.cam.ty = 80; }); }
  setAnim(u, n) { if (!alive(u) && n !== 'dead') return; u.anim = { n, el: 0 }; }
  moveTo(u, tx, ty, dur) { return new Promise(res => { u.move = { fx: u.ox, fy: u.oy, tx: tx - u.x, ty: ty - u.y, t: 0, dur, res }; }); }
  proj(from, to, kind, dur = 260, arc = 0) {
    const fx = from.x + from.ox + (from.side === 'hero' ? 6 : -6), fy = from.y + from.oy - from.h * .6;
    const tx = to.x + to.ox, ty = to.y + to.oy - to.h * .5;
    return new Promise(res => this.projs.push({ x: fx, y: fy, tx, ty, t: 0, dur, kind, arc, res }));
  }
  center(u) { return { x: u.x + u.ox, y: u.y + u.oy - u.h * .5 }; }

  /* ---------- Ablauf ---------- */
  async act(u) {
    this.busy = true; u.atb = 0; this.active = u; this.turn++;
    try {
      const skip = await this.turnStart(u);
      if (alive(u) && !skip && !this.checkEnd()) {
        const plan = this.ai(u);
        if (plan) await this.perform(u, plan.sk, plan.t, plan.ult);
      }
    } catch (e) { console.error(e); }
    this.active = null;
    const end = this.checkEnd();
    if (end) return this.finish(end);
    await this.wait(120);
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
    if (u.side === 'hero') { const R = RESOURCES[u.resT]; u.resV = clamp(u.resV + R.regen * (1 + (u.p.resGain || 0) / 100), 0, 100); }
    const stunned = !!hasS(u, 'stun');
    u.statuses.forEach(s => { if (s.dur < 90) s.dur--; }); u.statuses = u.statuses.filter(s => s.dur > 0);
    for (const k in u.cd) if (u.cd[k] > 0) u.cd[k]--;
    if (ticked) await this.wait(300);
    if (stunned) { this.num(u, 'BETAUBT', '#f3d78f'); this.setAnim(u, 'hurt'); await this.wait(450); return true; }
    // Boss-Phasen
    if (u.boss && u.hp < u.maxHp * .5 && !u.phased) {
      u.phased = 1;
      if (u.transform) await this.transformUnit(u);
      else { addS(u, 'enrage', 99, 0, this); this.onBanner(u, `${u.name} gerät in Raserei!`, 'foe'); this.flash('#ff3a1a', 400); this.shake(3); sfx('crit'); await this.wait(600); }
    }
    return false;
  }
  async transformUnit(u) {
    const T = u.transform, E = ENEMIES[T.to];
    this.onBanner(u, T.msg, 'foe'); this.flash('#ffffff', 700); this.shake(4); sfx('ult');
    for (let i = 0; i < 4; i++) { this.burst(u.x, u.y - 20, 'fire', 14, 1.6, .5); await this.wait(120); }
    u.key = T.to; u.name = E.n; u.sid = 'e:' + T.to; u.type = E.type; u.look = Object.assign({ wpn: E.wpn }, E.look); u.wpn = E.wpn; u.skills = E.sk.map(id => ESK[id]);
    const D = RIG.dims(u.type, u.look); u.h = D.h; u.big = D.big; u.w = D.w;
    u.atk = Math.round(u.atk * 1.15); u.mag = Math.round(u.mag * 1.15); addS(u, 'enrage', 99, 0, this);
    await this.wait(500);
  }
  checkEnd() { if (this.enemies.every(e => !alive(e))) return 'win'; if (this.heroes.every(h => !alive(h))) return 'lose'; return null; }
  async finish(res) {
    if (this.over) return; this.over = true; this.busy = true;
    if (res === 'win') { this.heroes.filter(alive).forEach(h => { h.hold = 'victory'; this.setAnim(h, 'victory'); }); sfx('win'); }
    else sfx('lose');
    await this.wait(1400);
    this.onEnd({ win: res === 'win', heroes: this.heroes.map(h => ({ key: h.key, hpFrac: alive(h) ? h.hp / h.maxHp : 0, energy: h.energy })), enemies: this.enemies });
  }

  /* ---------- KI ---------- */
  foesOf(u) { return (u.side === 'hero' ? this.enemies : this.heroes).filter(alive); }
  friendsOf(u) { return (u.side === 'hero' ? this.heroes : this.enemies).filter(alive); }
  ai(u) {
    const foes = this.foesOf(u), friends = this.friendsOf(u);
    if (!foes.length) return null;
    const basic = basicSkill(u);
    if (u.side === 'enemy') return this.enemyAi(u, foes, friends, basic);
    const lowest = friends.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a), friends[0]);
    const lowF = lowest.hp / lowest.maxHp, deadN = this.heroes.filter(h => !alive(h)).length;
    const missing = friends.reduce((a, f) => a + (1 - f.hp / f.maxHp), 0) / friends.length;
    const heals = s => s.heal || s.healPct || s.revive;
    const thr = u.tactic === 'safe' ? .8 : u.tactic === 'aggro' ? .5 : .68;
    // Ultimate
    if (u.energy >= 100 && (G.settings.autoUlt || this.ultQueue.has(u.key))) {
      const ul = u.ult; let ok = true;
      if (heals(ul) && !ul.dmg) ok = deadN > 0 || lowF < .6 || missing > .3;
      if (ok || this.ultQueue.has(u.key)) { this.ultQueue.delete(u.key); return { sk: ul, t: this.pickTarget(u, ul, foes, friends), ult: 1 }; }
    }
    let best = null, bestS = 0;
    for (const s of u.skills) {
      if ((u.cd[s.n] || 0) > 0 || u.resV < (s.cost || 0)) continue;
      let sc = 0;
      if (heals(s)) { if (s.tgt === 'allAllies') sc = (missing > .22 || friends.filter(f => f.hp / f.maxHp < .7).length >= 2) ? 9 + missing * 10 : 0; else sc = lowF < thr ? 6 + (1 - lowF) * 12 : 0; }
      else if (s.shield && !s.dmg) sc = friends.some(f => hasS(f, 'shield')) ? 0 : (this.turn > 2 ? 6 : 3);
      else if (s.taunt && !s.dmg) sc = hasS(u, 'taunt') ? 0 : 11;
      else if ((s.buff || s.self) && !s.dmg) { const st = (s.buff || s.self)[0][0]; const tg = s.tgt === 'allAllies' ? friends : [u]; sc = tg.every(f => hasS(f, st)) ? 0 : 5.5; if (s.cleanse && friends.some(f => f.statuses.some(x => STATUS[x.id].bad))) sc += 3; }
      else if (s.dmg) { sc = s.tgt === 'all' ? 3 + foes.length * 1.6 * s.dmg * (s.hits || 1) : 3 + s.dmg * (s.hits || 1) * 2.2; if (s.st && s.st[0][0] === 'stun' && foes.some(f => f.boss)) sc += 1.5; if (u.tactic === 'aggro') sc += 1; }
      if (u.role === 'heal' && s.dmg && lowF < thr) sc *= .3;
      if (sc > bestS) { bestS = sc; best = s; }
    }
    const sk = best || basic;
    return { sk, t: this.pickTarget(u, sk, foes, friends) };
  }
  pickTarget(u, sk, foes, friends) {
    if (sk.tgt === 'lowestAlly') { const pool = sk.revive ? (u.side === 'hero' ? this.heroes : this.enemies) : friends; return pool.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a), pool[0]); }
    if (sk.tgt !== 'single') return null;
    const vis = foes.filter(f => !hasS(f, 'invis')); const pool = vis.length ? vis : foes;
    if (u.side === 'enemy') {
      const taunt = pool.filter(f => hasS(f, 'taunt')); if (taunt.length) return pick(taunt);
      if (Math.random() < .78) return pool.reduce((a, b) => (b.threat > a.threat ? b : a), pool[0]);
      return pick(pool);
    }
    const marked = pool.filter(f => hasS(f, 'mark')); if (marked.length && u.tactic !== 'aggro') return marked[0];
    if (u.tactic === 'aggro') return pool.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a), pool[0]);
    // Fokusziel: Gegner mit den wenigsten LP (nicht Boss, solange Begleiter leben)
    const adds = pool.filter(f => !f.boss); const p2 = adds.length ? adds : pool;
    return p2.reduce((a, b) => (b.hp < a.hp ? b : a), p2[0]);
  }
  enemyAi(u, foes, friends, basic) {
    let opts = u.skills.filter(s => !((u.cd[s.n] || 0) > 0)).filter(s => {
      if (s.summon) return this.enemies.filter(alive).length < 5;
      if (s.heal) return friends.some(f => f.hp / f.maxHp < .6);
      if ((s.buff || s.self) && !s.dmg) { const st = (s.buff || s.self)[0][0]; return s.tgt === 'self' ? !hasS(u, st) : !friends.every(f => hasS(f, st)); }
      return true;
    });
    if (!opts.length) opts = [basic];
    let tot = opts.reduce((a, s) => a + (s.w || 1), 0), r = Math.random() * tot, sk = opts[0];
    for (const s of opts) { r -= s.w || 1; if (r <= 0) { sk = s; break; } }
    return { sk, t: this.pickTarget(u, sk, foes, friends) };
  }

  /* ---------- Aktion ausführen ---------- */
  async perform(u, sk, target, isUlt) {
    const foes = this.foesOf(u), friends = this.friendsOf(u);
    if (isUlt) u.energy = 0; else if (u.side === 'hero') u.resV -= sk.cost || 0;
    if (sk.cd && !(u.p?.echo && Math.random() < u.p.echo)) u.cd[sk.n] = sk.cd;
    if (u.side === 'hero') u.energy = Math.min(100, u.energy + 10 * (1 + (u.p.ultCharge || 0) / 100));
    if (!sk.basic) this.onBanner(u, sk.n, u.side === 'enemy' ? 'foe' : isUlt ? 'ult' : '');
    this.onLog(u, sk);
    if (isUlt) { this.focus(u, 1.1, 1100); sfx('ult'); this.flash(u.side === 'hero' ? '#ffe9a8' : '#ff3a1a', 500); this.fxs.push({ k: 'pillar', x: u.x, y: u.y, c: '#ffe080', t: 0, dur: 700 }); this.shake(2); await this.wait(450); }
    const isDmg = !!sk.dmg;
    const hits = sk.hits || 1;
    const hitSet = new Set();
    const counters = [];
    const doHit = (t, mult = 1) => { const r = this.hit(u, t, sk, mult, isUlt); if (r > 0) hitSet.add(t); if (r === -2) counters.push(t); };

    if (isDmg) {
      const anim = sk.anim === 'spin' ? 'attack' : sk.anim;
      if (sk.anim === 'melee' || sk.anim === 'spin') {
        const tg = sk.tgt === 'single' ? target : null;
        const dir = u.side === 'hero' ? 1 : -1;
        let dest;
        if (tg) dest = { x: tg.x + tg.ox - dir * (tg.big ? 26 : 14), y: tg.y + tg.oy + 1 };
        else { const fs = foes; dest = { x: fs.reduce((a, f) => a + f.x, 0) / fs.length - dir * 22, y: fs.reduce((a, f) => a + f.y, 0) / fs.length }; }
        if (u.big || u.type === 'worm') dest = { x: u.x + dir * 14, y: u.y };
        this.setAnim(u, 'walk'); sfx('step'); await this.moveTo(u, dest.x, dest.y, 260);
        for (let i = 0; i < hits; i++) {
          let tgs = sk.tgt === 'all' ? this.foesOf(u) : sk.tgt === 'random' ? [pick(this.foesOf(u))].filter(Boolean) : [target];
          if (sk.tgt === 'single' && !alive(target)) { const l = this.foesOf(u); if (!l.length) break; target = pick(l); tgs = [target]; }
          if (!tgs.length) break;
          this.setAnim(u, 'attack'); await this.wait(RIG.impactTime('attack'));
          sfx(sk.fx === 'stone' ? 'blunt' : 'swing');
          for (const t of tgs) { this.fxs.push({ k: 'slash', x: t.x + t.ox, y: t.y + t.oy - t.h * .55, r: t.big ? 14 : 7, dir: -dir, t: 0, dur: 160 }); if (sk.fx !== 'slash') this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, sk.fx, 8); doHit(t); }
          await this.wait(hits > 1 ? 180 : 260);
        }
        if (alive(u)) { this.setAnim(u, 'walk'); await this.moveTo(u, u.x, u.y, 240); this.setAnim(u, 'idle'); }
      } else {
        const ranged = anim === 'shoot' || anim === 'throw' ? anim : 'cast';
        for (let i = 0; i < hits; i++) {
          let tgs = sk.tgt === 'all' ? this.foesOf(u) : sk.tgt === 'random' ? [pick(this.foesOf(u))].filter(Boolean) : [target];
          if (sk.tgt === 'single' && !alive(target)) { const l = this.foesOf(u); if (!l.length) break; target = pick(l); tgs = [target]; }
          if (!tgs.length) break;
          const fast = i > 0;
          if (!fast || ranged !== 'shoot') { this.setAnim(u, ranged); if (ranged === 'cast') { this.fxs.push({ k: 'circle', x: u.x, y: u.y, c: (FX_COL[sk.fx] || ['#fff'])[0], t: 0, dur: 600 }); sfx('charge'); } await this.wait(fast ? 120 : RIG.impactTime(ranged)); }
          else { this.setAnim(u, 'shoot'); await this.wait(140); }
          sfx(ranged === 'shoot' ? 'bow' : ranged === 'throw' ? 'swing' : 'cast');
          const kind = ranged === 'shoot' && u.wpn === 'bow' ? 'arrow' : sk.fx === 'slash' ? 'light' : sk.fx;
          const ps = tgs.map(t => {
            if (sk.fx === 'lightning') { this.fxs.push({ k: 'bolt', x: u.x + u.ox, y: u.y - u.h, tx: t.x + t.ox, ty: t.y + t.oy - t.h * .5, t: 0, dur: 220 }); return this.wait(90).then(() => { this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, 'lightning', 10); doHit(t); }); }
            return this.proj(u, t, kind, kind === 'arrow' ? 200 : 300, ranged === 'throw' ? 10 : kind === 'arrow' ? 3 : 0).then(() => { this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, kind === 'arrow' ? 'slash' : kind, kind === 'arrow' ? 4 : 12); doHit(t); });
          });
          if (hits > 1 && sk.tgt !== 'all') await this.wait(110); else await Promise.all(ps);
          if (i === hits - 1) await Promise.all(ps);
        }
        await this.wait(200);
      }
    } else {
      // Unterstützung
      this.setAnim(u, sk.anim === 'shout' ? 'shout' : 'cast');
      if (sk.anim !== 'shout') this.fxs.push({ k: 'circle', x: u.x, y: u.y, c: (FX_COL[sk.fx] || ['#fff'])[0], t: 0, dur: 600 });
      sfx(sk.anim === 'shout' ? 'shout' : 'charge');
      await this.wait(RIG.impactTime(sk.anim === 'shout' ? 'shout' : 'cast'));
      if (sk.anim === 'shout') this.fxs.push({ k: 'ring', x: u.x, y: u.y - u.h * .5, r: 26, c: (FX_COL[sk.fx] || ['#f3d78f'])[0], t: 0, dur: 500 });
    }

    // Heilung / Belebung / Schild
    if (sk.heal || sk.healPct || sk.revive || sk.shield) {
      let tgs;
      if (sk.tgt === 'lowestAlly') tgs = [target].filter(Boolean);
      else if (sk.tgt === 'self') tgs = [u];
      else tgs = (u.side === 'hero' ? this.heroes : this.enemies);
      if (sk.revive) for (const t of tgs) if (!alive(t)) this.revive(t, sk.revive);
      tgs = tgs.filter(alive);
      if (sk.heal || sk.healPct) { sfx('heal'); for (const t of tgs) { const amt = sk.healPct ? t.maxHp * sk.healPct : sk.heal * effStat(u, 'mag') * 1.1; this.heal(u, t, amt); hitSet.add(t); } }
      if (sk.shield) for (const t of tgs) { addS(t, 'shield', 4, Math.round(effStat(u, sk.shieldStat || 'mag') * sk.shield), this); this.burst(t.x, t.y - t.h * .5, 'ice', 6); }
      if (sk.cleanse) tgs.forEach(t => cleanse(t));
    }
    // Zustände auf getroffene Gegner
    if (sk.st) for (const t of hitSet) {
      if (!alive(t) || t.side === u.side) continue;
      for (const [id, ch, dur] of sk.st) {
        if (Math.random() > ch * (1 + (u.p?.statusCh || 0) / 100)) continue;
        addS(t, id === 'randomDebuff' ? pick(['atkDown', 'defDown', 'slow', 'bleed', 'poison']) : id, dur, 0, this);
      }
    }
    // Stärkungen
    if (sk.buff) {
      const tgs = sk.tgt === 'allAllies' ? this.friendsOf(u) : sk.tgt === 'lowestAlly' ? [target].filter(alive) : [u];
      tgs.forEach(t => { sk.buff.forEach(([id, d]) => addS(t, id, d, 0, this)); this.burst(t.x, t.y - t.h * .5, 'buff', 5, .6, .6); });
      if (sk.cleanse && !sk.heal) tgs.forEach(t => cleanse(t));
      if (!sk.heal) sfx('buff');
    }
    if (sk.self) { sk.self.forEach(([id, d]) => addS(u, id, d, 0, this)); this.burst(u.x, u.y - u.h * .5, 'buff', 6, .6, .6); }
    if (sk.taunt) { addS(u, 'taunt', sk.taunt, 0, this); const mx = Math.max(...this.heroes.map(h => h.threat)); u.threat = mx * 1.3 + 50; }
    if (sk.buffAll) this.friendsOf(u).forEach(t => sk.buffAll.forEach(([id, d]) => addS(t, id, d, 0, this)));
    if (sk.healAllPct) this.friendsOf(u).forEach(t => this.heal(u, t, t.maxHp * sk.healAllPct));
    if (sk.shieldAll) this.friendsOf(u).forEach(t => addS(t, 'shield', 4, Math.round(effStat(u, sk.shieldStat || 'mag') * sk.shieldAll), this));
    if (sk.summon) {
      const n = this.enemies.filter(alive).length; if (n < 5) {
        const e = this.addEnemy(sk.summon, Math.max(1, u.lvl - 1), 'normal');
        const free = [[150, 104], [154, 132], [138, 118], [178, 96], [176, 136], [232, 100], [230, 134]].find(s => !this.enemies.some(o => alive(o) && o !== e && Math.abs(o.x - s[0]) < 8 && Math.abs(o.y - s[1]) < 8)) || [160, 118];
        e.x = free[0]; e.y = free[1]; e.atb = 0; this.burst(e.x, e.y - 8, 'dark', 16, 1.2, .5); this.onLog(u, { n: `ruft ${e.name}` });
      }
    }
    // Konter
    for (const c of counters) {
      if (!alive(c) || !alive(u)) continue;
      await this.wait(120); this.setAnim(c, 'attack'); await this.wait(RIG.impactTime('attack'));
      this.num(c, 'KONTER', '#f0b070'); this.hit(c, u, basicSkill(c), .8);
    }
    if (alive(u) && u.anim.n !== 'idle' && u.anim.n !== 'dead') await this.wait(150);
  }

  hit(a, t, sk, mult = 1, isUlt = false) {
    if (!alive(t)) return 0;
    if (t.p?.dodge && Math.random() < t.p.dodge / 100) { this.num(t, 'AUSGEWICHEN', '#c8c8c8'); sfx('miss'); return 0; }
    const stat = sk.stat || (sk.basic ? a.atkStat : 'atk');
    const A = effStat(a, stat), D = effStat(t, stat === 'mag' ? 'res' : 'def');
    let d = (sk.dmg || 1) * A * (1.5 * A) / (1.5 * A + D) * mult;
    const hpF = t.hp / t.maxHp;
    if (sk.bonusTag && t.tags?.includes(sk.bonusTag)) d *= 1.4;
    if (sk.bossBonus && t.boss) d *= sk.bossBonus;
    if (sk.exec && hpF < .4) d *= 2;
    if (sk.lowHp) d *= 1 + (1 - a.hp / a.maxHp);
    const ap = a.p || {}, tp = t.p || {};
    if (ap.execute && hpF < .3) d *= 1 + ap.execute;
    if (ap.lowHpDmg) d *= 1 + ap.lowHpDmg * (1 - a.hp / a.maxHp);
    if (ap.vsOrk && t.tags?.includes('ork')) d *= 1 + ap.vsOrk;
    if (hasS(t, 'mark')) d *= 1.3;
    if (hasS(t, 'guard')) d *= .6;
    if (tp.dmgRed) d *= 1 - tp.dmgRed / 100;
    const crit = !!sk.alwaysCrit || Math.random() < (a.crit + (sk.critB || 0)) / 100;
    if (crit) d *= 1 + a.critDmg / 100;
    d *= rnd(.92, 1.08);
    let dmg = Math.max(1, Math.round(d));
    // Schild
    const sh = hasS(t, 'shield');
    if (sh) { const ab = Math.min(sh.val, dmg); sh.val -= ab; dmg -= ab; if (sh.val <= 0) rmS(t, 'shield'); if (ab) this.burst(t.x + t.ox, t.y + t.oy - t.h * .5, 'ice', 4); }
    t.hp = Math.max(0, t.hp - dmg);
    this.num(t, dmg === 0 ? 'SCHILD' : (crit ? dmg + '!' : dmg), dmg === 0 ? '#a8d4ff' : crit ? '#ffd040' : t.side === 'hero' ? '#ff9a8a' : '#ffffff', crit ? 2 : 1);
    t.flash = 110; t.kb = (t.side === 'hero' ? -1 : 1) * (crit ? 3.5 : 2); if (t.anim.n === 'idle' || t.anim.n === 'hurt') this.setAnim(t, 'hurt');
    this.shake(crit ? 2.5 : t.big ? 1 : 1.2); sfx(crit ? 'crit' : 'hit');
    // Ressourcen & Bedrohung
    if (a.side === 'hero') { a.threat += dmg * a.threatMul; if (RESOURCES[a.resT].onHit) a.resV = clamp(a.resV + RESOURCES[a.resT].onHit * (1 + (ap.resGain || 0) / 100), 0, 100); a.energy = Math.min(100, a.energy + 3 * (1 + (ap.ultCharge || 0) / 100)); }
    if (t.side === 'hero') { if (RESOURCES[t.resT].onHurt) t.resV = clamp(t.resV + RESOURCES[t.resT].onHurt, 0, 100); t.energy = Math.min(100, t.energy + dmg / t.maxHp * 55 * (1 + (tp.ultCharge || 0) / 100)); }
    if (ap.lifesteal && dmg > 0) this.heal(a, a, dmg * ap.lifesteal / 100, { silent: 1 });
    if (tp.thorns && dmg > 0 && alive(a) && !sk.thornsHit) { const r = Math.max(1, Math.round(dmg * tp.thorns / 100)); a.hp = Math.max(0, a.hp - r); this.num(a, r, '#f0b070'); if (a.hp <= 0) this.die(a); }
    // Treffer-Effekte
    if (dmg > 0 && alive(t)) {
      const proc = (k, s, dur) => { if (ap[k] && Math.random() < ap[k]) addS(t, s, dur, 0, this); };
      proc('burnOnHit', 'burn', 3); proc('poisonOnHit', 'poison', 3); proc('slowOnHit', 'slow', 2); proc('stunOnHit', 'stun', 1);
    }
    if (ap.doubleHit && !sk.isDouble && Math.random() < ap.doubleHit && alive(t)) { this.num(t, 'DOPPEL', '#ffe080'); this.hit(a, t, Object.assign({}, sk, { isDouble: 1, st: null }), mult * .6); }
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
      if (sp.healShield && amt > 0) addS(t, 'shield', 3, Math.round(amt * sp.healShield), this, 1);
      if (sp.healRegen) addS(t, 'regen', 2, 0, this, 1);
      if (sp.healSmite && amt > 0) { const f = this.foesOf(src); if (f.length) { const e = pick(f); const d = Math.round(amt * sp.healSmite); e.hp = Math.max(0, e.hp - d); this.num(e, d, '#ffe080'); this.burst(e.x, e.y - e.h * .5, 'holy', 6); if (e.hp <= 0) this.die(e); } }
    }
    return got;
  }
  revive(t, pct) { if (alive(t)) return; t.hp = Math.max(1, Math.round(t.maxHp * pct)); t.statuses = []; t.hold = null; this.setAnim(t, 'idle'); t.fade = 1; this.num(t, 'BELEBT', '#9fe07a'); this.burst(t.x, t.y - 8, 'holy', 16, .8, 1); this.fxs.push({ k: 'pillar', x: t.x, y: t.y, c: '#ffe080', t: 0, dur: 600 }); }
  die(u) {
    if (u.p?.reviveSelf && !u.usedRevive) { u.usedRevive = 1; u.hp = Math.round(u.maxHp * u.p.reviveSelf); this.num(u, 'UNBEUGSAM', '#ffe080'); this.burst(u.x, u.y - u.h * .5, 'holy', 14, 1, .6); return; }
    u.hp = 0; u.statuses = []; this.setAnim(u, 'dead'); sfx('die');
    this.burst(u.x, u.y - u.h * .5, u.side === 'enemy' ? 'dark' : 'slash', 10, 1);
    this.onLog(u, { n: 'fällt', death: 1 });
    if (u.side === 'hero') {
      const saver = this.heroes.find(h => alive(h) && h.p.reviveAlly && !h.usedReviveAlly);
      if (saver) { saver.usedReviveAlly = 1; this.wait(500).then(() => { if (!this.over) { this.revive(u, saver.p.reviveAlly); this.num(saver, 'LEBENSFUNKE', '#9fe07a'); } }); }
    }
  }
}

/* ---------- Hilfen ---------- */
const DIFF_E = { hp: 1, dmg: 1 };
function alive(u) { return u && u.hp > 0; }
function hasS(u, id) { return u.statuses.find(s => s.id === id); }
function rmS(u, id) { u.statuses = u.statuses.filter(s => s.id !== id); }
function cleanse(u) { u.statuses = u.statuses.filter(s => !STATUS[s.id].bad); }
function addS(u, id, dur, val, B, silent) {
  if (!alive(u)) return;
  if (id === 'stun' && u.boss && Math.random() < .5) { B?.num(u, 'WIDERSTEHT', '#c8c8c8'); return; }
  const ex = hasS(u, id);
  if (ex) { ex.dur = Math.max(ex.dur, dur); if (val) ex.val = Math.max(ex.val || 0, val); }
  else u.statuses.push({ id, dur, val });
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
  const anim = w === 'bow' ? 'shoot' : mag || (u.side === 'enemy' && u.ranged && w === 'staff') ? 'cast' : u.side === 'enemy' && u.ranged ? 'shoot' : 'melee';
  const fx = w === 'bow' ? 'arrow' : mag ? (u.look.glowC === '#c060ff' || u.look.glowC === '#b080ff' ? 'dark' : 'light') : u.type === 'quad' || u.type === 'spider' ? 'bite' : ['hammer', 'club', 'mace', 'claws', 'pan'].includes(w) ? 'stone' : 'slash';
  return { n: 'Angriff', basic: 1, anim, fx, tgt: 'single', dmg: 1, stat: mag ? 'mag' : 'atk' };
}
