'use strict';
/* =====================================================================
   RINGFAHRT – Oberfläche
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const app = $('#app');
let curBattle = null, curScenes = [], hudTimer = null, bannerTimer = null;

/* ---------- Ton ---------- */
let AC = null;
function ac() { if (G && !G.settings.sound) return null; if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d = .1, type = 'square', vol = .04, slide = 0, delay = 0) { const a = ac(); if (!a) return; const t = a.currentTime + delay; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02); }
function noise(d = .1, vol = .06, freq = 1200) { const a = ac(); if (!a) return; const len = Math.floor(a.sampleRate * d), b = a.createBuffer(1, len, a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len); const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = a.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start(); }
let lastSfx = {};
const SFX = {
  hit() { noise(.08, .07, 1400); tone(150, .08, 'square', .025, -70); }, crit() { noise(.16, .1, 2400); tone(260, .18, 'sawtooth', .04, -180); },
  swing() { noise(.09, .04, 3000); }, blunt() { noise(.12, .09, 500); tone(90, .1, 'square', .03, -30); }, bow() { tone(700, .05, 'triangle', .03, -300); noise(.05, .03, 4000); },
  cast() { tone(520, .2, 'sine', .035, 400); }, charge() { tone(300, .25, 'sine', .025, 300); }, shout() { tone(180, .25, 'sawtooth', .035, 60); },
  heal() { tone(520, .15, 'sine', .04, 220); tone(780, .2, 'sine', .03, 220, .08); }, buff() { [392, 523, 659].forEach((f, i) => tone(f, .1, 'triangle', .035, 0, i * .06)); },
  miss() { tone(240, .12, 'sine', .03, -80); }, die() { tone(320, .4, 'sawtooth', .04, -250); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, .22, 'triangle', .05, 0, i * .12)); }, lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, .3, 'sine', .05, 0, i * .18)); },
  ult() { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, .25, 'sawtooth', .03, 0, i * .05)); }, level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, 'triangle', .05, 0, i * .09)); },
  click() { tone(480, .04, 'triangle', .025); }, loot() { [784, 988, 1318].forEach((f, i) => tone(f, .12, 'triangle', .04, 0, i * .07)); }, step() { }
};
function sfx(n) { try { const now = performance.now(); if (lastSfx[n] && now - lastSfx[n] < 40) return; lastSfx[n] = now; SFX[n] && SFX[n](); } catch (e) { } }

/* ---------- Grundgerüst ---------- */
function clearAll() { curScenes.forEach(s => s.stop()); curScenes = []; if (curBattle) { curBattle.destroy(); curBattle = null; } clearInterval(hudTimer); hudTimer = null; }
function screen(html) { clearAll(); app.innerHTML = html; window.scrollTo(0, 0); paintCanvases(); }
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="mbox">${html}</div>`; m.hidden = false; m.onclick = e => { if (e.target === m) closeModal(); }; paintCanvases(m); }
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
const fmt = n => Math.round(n).toLocaleString('de-DE');
function topbar(title, back = 'hub', extra = '') {
  return `<header class="topbar"><div class="tb-in">
    ${back ? `<button class="btn ghost small" data-nav="${back}">← Zurück</button>` : '<span></span>'}
    <h1 class="tb-title">${title}</h1>
    <div class="res"><span class="gold" title="Gold">◆ ${fmt(G.gold)}</span><span class="mith" title="Mithril">✧ ${fmt(G.mithril)}</span>${extra}</div>
  </div></header>`;
}
document.addEventListener('click', e => {
  const n = e.target.closest('[data-nav]'); if (!n) return; sfx('click'); NAV[n.dataset.nav]?.();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); if (e.key === ' ' && curBattle && document.activeElement === document.body) { e.preventDefault(); togglePause(); } });
window.addEventListener('resize', () => { curBattle?.resize(); curScenes.forEach(s => s.resize()); });

/* ---------- Leinwände in HTML (Porträts, Figuren, Icons) ---------- */
function lookFor(k, st) { const L = Object.assign({ wpn: HEROES[k].wpn }, HEROES[k].look); for (let i = 1; i <= st; i++) Object.assign(L, HEROES[k].stageLook[i] || {}); return L; }
function paintCanvases(root = document) {
  requestAnimationFrame(() => {
    root.querySelectorAll('canvas[data-ic]').forEach(c => RIG.icon(c, c.dataset.ic, c.dataset.c));
    root.querySelectorAll('canvas[data-hero]').forEach(c => { const k = c.dataset.hero, st = +(c.dataset.stage ?? (G.heroes[k]?.stage || 0)); RIG.toCanvas(c, 'hum', lookFor(k, st), { portrait: c.classList.contains('pt') }); });
    root.querySelectorAll('canvas[data-enemy]').forEach(c => { const E = ENEMIES[c.dataset.enemy]; RIG.toCanvas(c, E.type, Object.assign({ wpn: E.wpn }, E.look), { flip: 1 }); });
  });
}
const icHtml = (it, cls = '') => `<canvas class="ic ${cls}" data-ic="${it.icon}" data-c="${RARITY[it.r].c}" style="--rc:${RARITY[it.r].c}"></canvas>`;
const roleChip = role => `<span class="role r-${role}">${ROLES[role].n}</span>`;

/* ---------- Mini-Szene (Lager, Vorschau) ---------- */
class Scene {
  constructor(cv, o) { this.cv = cv; Object.assign(this, { W: o.w, H: o.h, units: o.units, bg: o.bg, bgY: o.bgY || 0, fire: o.fire, night: o.night }); this.parts = []; this.t = 0; this.last = performance.now(); this.resize(); this.raf = requestAnimationFrame(t => this.loop(t)); }
  stop() { cancelAnimationFrame(this.raf); this.dead = 1; }
  resize() { const r = this.cv.getBoundingClientRect(), dpr = devicePixelRatio || 1; const W = Math.round((r.width || this.W * 3) * dpr); this.s = W / this.W; this.cv.width = W; this.cv.height = Math.round(this.H * this.s); }
  loop(now) { if (this.dead) return; const dt = Math.min(100, now - this.last); this.last = now; this.t += dt; this.update(dt); this.draw(); this.raf = requestAnimationFrame(t => this.loop(t)); }
  update(dt) {
    for (const u of this.units) {
      u.el = (u.el || 0) + dt; const A = RIG.ANIMS[u.anim];
      if (!A.loop) { const tot = RIG.animTime(u.anim) + (u.anim === 'dead' ? 900 : 500); if (u.el > tot) { u.el = 0; if (!u.repeat) u.anim = 'idle'; } }
    }
    if (this.fire && Math.random() < dt / 30) this.parts.push({ x: this.fire.x + rnd(-3, 3), y: this.fire.y - 4, vx: rnd(-.15, .15), vy: rnd(-.6, -.3), t: 0, life: rnd(500, 1100), c: pick(['#ff6a1a', '#ffb040', '#ffe070']) });
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; }
    this.parts = this.parts.filter(p => p.t < p.life);
  }
  draw() {
    const ctx = this.cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.s, 0, 0, this.s, 0, 0);
    if (this.bg) ctx.drawImage(RIG.background(this.bg, Math.round(256 * this.s), Math.round(144 * this.s)), 0, this.bgY, 256, 144);
    if (this.night) { ctx.fillStyle = 'rgba(8,10,30,.5)'; ctx.fillRect(0, 0, this.W, this.H); }
    if (this.fire) {
      const f = this.fire, t = this.t;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const gl = ctx.createRadialGradient(f.x, f.y - 4, 0, f.x, f.y - 4, 60 + Math.sin(t / 130) * 4); gl.addColorStop(0, 'rgba(255,150,60,.45)'); gl.addColorStop(1, 'rgba(255,120,40,0)'); ctx.fillStyle = gl; ctx.fillRect(f.x - 70, f.y - 70, 140, 100);
      for (let i = 0; i < 5; i++) { const h = 7 + Math.sin(t / 90 + i * 1.9) * 2.4, x = f.x - 4 + i * 2; const g = ctx.createLinearGradient(x, f.y, x, f.y - h); g.addColorStop(0, 'rgba(255,80,20,.95)'); g.addColorStop(.5, 'rgba(255,170,40,.8)'); g.addColorStop(1, 'rgba(255,240,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - 2.2, f.y); ctx.quadraticCurveTo(x - 1, f.y - h * .6, x + Math.sin(t / 110 + i) * 1.4, f.y - h); ctx.quadraticCurveTo(x + 1.4, f.y - h * .5, x + 2.2, f.y); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = '#4a2e1a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(f.x - 6, f.y + .5); ctx.lineTo(f.x + 6, f.y - .5); ctx.moveTo(f.x - 6, f.y - .5); ctx.lineTo(f.x + 6, f.y + .5); ctx.stroke();
    }
    const us = [...this.units].sort((a, b) => a.y - b.y);
    for (const u of us) {
      const g = ctx.createRadialGradient(u.x, u.y, 0, u.x, u.y, 9); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(u.x, u.y, 9, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.translate(u.x, u.y); if (u.flip) ctx.scale(-1, 1); RIG.draw(ctx, u.type, u.look, u.anim, u.el || 0, this.t + (u.ph || 0)); ctx.restore();
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) { ctx.globalAlpha = 1 - p.t / p.life; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, .7, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
}
function heroUnitLook(k) { return { type: 'hum', look: heroLook(k), ph: Math.random() * 4000 }; }

/* ---------- Titel ---------- */
function titleScreen() {
  const has = load();
  screen(`<div class="title">
    <canvas id="tscene" class="pix tscene"></canvas>
    <div class="wrap title-in">
      <div class="kicker">Ein Auto-Kampf-RPG in Mittelerde</div>
      <h1 class="logo">RINGFAHRT</h1>
      <p class="lead">Stelle eine Gruppe aus Tank, Heilern und Kämpfern zusammen. Sammle Ausrüstung, entwickle deine Helden und begleite sie vom Auenland bis nach Eregion.</p>
      <div class="menu">
        ${has ? `<button class="btn primary big" id="b-cont">Weiterspielen</button>` : ''}
        <button class="btn ${has ? '' : 'primary big'}" id="b-new">${has ? 'Neues Spiel' : 'Reise beginnen'}</button>
        <div id="confirmNew" hidden class="confirm">Der bisherige Fortschritt wird gelöscht. <button class="btn small danger" id="b-new2">Ja, neu beginnen</button></div>
      </div>
      <p class="foot">Inoffizielles Fan-Spiel nach J.R.R. Tolkien und „Die Ringe der Macht“. Alle Grafiken, Texte und Mechaniken sind eigene Umsetzungen.</p>
    </div></div>`);
  const keys = ['frodo', 'sam', 'gandalf', 'aragorn', 'legolas', 'gimli', 'galadriel'];
  const pos = [[100, 84], [116, 88], [150, 86], [166, 82], [76, 80], [184, 90], [132, 78]];
  const units = keys.map((k, i) => ({ type: 'hum', look: lookFor(k, 0), x: pos[i][0], y: pos[i][1], anim: 'idle', ph: i * 700, flip: pos[i][0] > 132 }));
  curScenes.push(new Scene($('#tscene'), { w: 256, h: 100, bg: 'weather', bgY: -44, units, fire: { x: 132, y: 88 }, night: 1 }));
  if ($('#b-cont')) $('#b-cont').onclick = () => { sfx('click'); hub(); };
  $('#b-new').onclick = () => { sfx('click'); if (has) { $('#confirmNew').hidden = false; } else { newProfile(); intro(); } };
  if ($('#b-new2')) $('#b-new2').onclick = () => { newProfile(); intro(); };
}
function intro() {
  modal(`<div class="help"><h2>Willkommen, Gefährte</h2>
    <p>Deine Gruppe kämpft <b>selbstständig</b>. Jeder Held nutzt seine Fähigkeiten, sobald er am Zug ist. Deine Aufgabe ist die Planung:</p>
    <ul>
      <li><b>Gruppe:</b> 1 Tank, 1 Heiler und 3 Schadensverursacher sind eine bewährte Aufstellung.</li>
      <li><b>Ausrüstung:</b> Gegner lassen Waffen, Rüstungen und Schmuck fallen, von Gewöhnlich bis Legendär.</li>
      <li><b>Talente:</b> Jede Stufe bringt einen Talentpunkt für drei Spezialisierungen.</li>
      <li><b>Entwicklung:</b> Bei Stufe 15 und 30 steigen Helden auf. Sie werden stärker, erhalten neue Fähigkeiten und ein neues Aussehen.</li>
      <li><b>Belohnungen:</b> Kapitel-Truhen, Erfolge, der Orthanc-Turm und neue Helden für Mithril in der Taverne.</li>
    </ul>
    <div class="row"><button class="btn primary" onclick="closeModal();hub()">Zum Lager</button></div></div>`);
}

/* ---------- Lager ---------- */
function hub() {
  save();
  const party = G.party.filter(k => G.heroes[k]);
  const power = party.reduce((a, k) => a + heroStats(k).power, 0);
  const claim = claimableCount();
  const tiles = [
    ['adventure', 'Abenteuer', 'Kampagnen & Kapitel', '⚔'],
    ['party', 'Gruppe', 'Aufstellung wählen', '⛨'],
    ['heroes', 'Helden', 'Talente, Ausrüstung, Entwicklung', '♛'],
    ['inventory', 'Inventar', `${G.inv.length} Gegenstände`, '▣'],
    ['tavern', 'Taverne', 'Neue Helden rekrutieren', '♨'],
    ['tower', 'Orthanc-Turm', `Bestwert: Etage ${G.tower.best}`, '♜'],
    ['achievements', 'Erfolge', claim ? `${claim} Belohnung${claim > 1 ? 'en' : ''} bereit` : 'Ziele & Belohnungen', '✪'],
    ['settings', 'Optionen', 'Ton, Schwierigkeit, Hilfe', '⚙']
  ];
  screen(`${topbar('Lager der Gemeinschaft', 'title', `<span class="pow" title="Kampfkraft der Gruppe">⚡ ${fmt(power)}</span>`)}
    <div class="wrap">
      <div class="scene-box"><canvas id="hscene" class="pix"></canvas></div>
      ${G.run ? `<div class="runbar"><span>Laufende Reise: <b>${CAMPAIGNS[G.run.camp].chapters[G.run.ch].n}</b>, Etappe ${G.run.cur + 1}/5</span><button class="btn primary" data-nav="map">Reise fortsetzen</button></div>` : ''}
      <div class="tiles">${tiles.map(([id, n, d, g]) => `<button class="tile ${id === 'achievements' && claim ? 'hot' : ''}" data-nav="${id}"><span class="tg">${g}</span><span class="tn">${n}</span><span class="td">${d}</span></button>`).join('')}</div>
    </div>`);
  const pos = [[92, 86], [110, 92], [150, 90], [166, 84], [128, 80]];
  const units = party.map((k, i) => Object.assign(heroUnitLook(k), { x: pos[i][0], y: pos[i][1], anim: 'idle', flip: pos[i][0] > 130 }));
  curScenes.push(new Scene($('#hscene'), { w: 256, h: 100, bg: 'shire', bgY: -44, units, fire: { x: 130, y: 90 }, night: 1 }));
}

/* ---------- Abenteuer ---------- */
function adventure() {
  screen(`${topbar('Abenteuer')}<div class="wrap">
    ${G.run ? `<div class="runbar"><span>Du bist mitten in <b>${CAMPAIGNS[G.run.camp].chapters[G.run.ch].n}</b>.</span><button class="btn primary" data-nav="map">Fortsetzen</button><button class="btn ghost small" id="b-abort">Reise abbrechen</button></div>` : ''}
    ${Object.entries(CAMPAIGNS).map(([cid, C]) => {
      const un = campUnlocked(cid);
      return `<section class="camp ${un ? '' : 'locked'}"><div class="camp-h"><div><div class="kicker">${C.era}</div><h2>${C.n}</h2><p class="muted">${C.d}</p></div>
        ${un ? '' : `<div class="lockmsg">🔒 Freigeschaltet nach Kapitel ${C.req.ch + 1} von „${CAMPAIGNS[C.req.camp].n}“</div>`}</div>
        <div class="chapters">${C.chapters.map((ch, i) => {
          const cleared = G.prog[cid] >= i, open = un && chapterUnlocked(cid, i);
          const boss = ch.boss.filter((v, j, a) => a.indexOf(v) === j && ENEMIES[v].boss)[0] || ch.boss[0];
          return `<button class="chap ${cleared ? 'done' : ''} ${open ? '' : 'locked'}" data-camp="${cid}" data-ch="${i}" ${open && !G.run ? '' : 'disabled'}>
            <canvas class="chap-boss pix" width="56" height="52" data-enemy="${boss}"></canvas>
            <span class="chn">${i + 1}. ${ch.n}</span><span class="chl">Stufe ${ch.lvl}–${ch.lvl + 2} · Boss: ${ENEMIES[boss].n}</span>
            <span class="chs">${cleared ? '✓ Abgeschlossen · Wiederholbar' : open ? 'Bereit' : 'Gesperrt'}</span></button>`;
        }).join('')}</div></section>`;
    }).join('')}</div>`);
  $$('.chap[data-camp]').forEach(b => b.onclick = () => { sfx('click'); startRun(b.dataset.camp, +b.dataset.ch); chapterIntro(); });
  if ($('#b-abort')) $('#b-abort').onclick = () => { G.run = null; save(); adventure(); };
}
function chapterIntro() {
  const R = G.run, C = CAMPAIGNS[R.camp], ch = C.chapters[R.ch];
  screen(`${topbar(C.n, 'adventure')}<div class="wrap narrow"><div class="panel intro bg-${ch.bg}">
    <div class="kicker">Kapitel ${R.ch + 1}</div><h2 class="big">${ch.n}</h2><p class="story">${ch.story}</p>
    <div class="row"><button class="btn primary" data-nav="map">Aufbrechen</button></div></div></div>`);
}
const NODE = {
  battle: { g: '⚔', n: 'Kampf', d: 'Feinde auf dem Weg' }, elite: { g: '☠', n: 'Elite', d: 'Stark, reiche Beute' },
  event: { g: '?', n: 'Begegnung', d: 'Ungewisses Ereignis' }, rest: { g: '♨', n: 'Lagerfeuer', d: 'Rasten oder üben' },
  treasure: { g: '▣', n: 'Schatz', d: 'Eine verborgene Truhe' }, boss: { g: '✦', n: 'Boss', d: '' }
};
function mapScreen() {
  const R = G.run; if (!R) return adventure();
  const C = CAMPAIGNS[R.camp], ch = C.chapters[R.ch];
  const bossN = ch.boss.filter((v, j, a) => a.indexOf(v) === j).map(k => ENEMIES[k].n).join(' & ');
  const party = G.party.filter(k => G.heroes[k]);
  screen(`${topbar(ch.n, 'hub')}<div class="wrap">
    <div class="partystrip">${party.map(k => { const f = R.hp[k] ?? 1; return `<div class="pm ${f <= 0 ? 'dead' : ''}"><canvas class="pt" width="24" height="24" data-hero="${k}"></canvas><div><b>${HEROES[k].n}</b><div class="bar hp"><i style="width:${f * 100}%"></i></div></div></div>`; }).join('')}</div>
    <div class="path">${R.rows.map((row, ri_) => `${ri_ ? '<div class="conn"></div>' : ''}<div class="prow">${row.map((t, ni) => {
      let st = 'future'; if (ri_ < R.cur) st = R.picks[ri_] === ni ? 'done' : 'skip'; else if (ri_ === R.cur) st = 'cur';
      const N = NODE[t]; return `<button class="node n-${t} ${st}" data-n="${ni}" ${st === 'cur' ? '' : 'disabled'}><span class="ng">${N.g}</span><span class="nn">${t === 'boss' ? bossN : N.n}</span><span class="nd">${t === 'boss' ? 'Kapitel-Boss' : N.d}</span></button>`;
    }).join('')}</div>`).join('')}</div>
    <div class="row center"><button class="btn ghost" data-nav="party">Gruppe ändern</button><button class="btn ghost" data-nav="heroes">Helden</button><button class="btn ghost danger" id="b-abort">Reise abbrechen</button></div>
  </div>`);
  $$('.node.cur').forEach(b => b.onclick = () => { sfx('click'); enterNode(+b.dataset.n); });
  $('#b-abort').onclick = () => { G.run = null; save(); adventure(); };
}
function enterNode(ni) {
  const R = G.run, t = R.rows[R.cur][ni]; R.picks[R.cur] = ni; save();
  const ch = CAMPAIGNS[R.camp].chapters[R.ch];
  if (t === 'battle') runBattle(pick(ch.normal), ch.lvl + Math.floor(R.cur / 2), 'normal');
  else if (t === 'elite') runBattle(pick(ch.elite), ch.lvl + 1, 'elite');
  else if (t === 'boss') runBattle(ch.boss, ch.lvl + 2, 'boss');
  else if (t === 'rest') restScreen();
  else if (t === 'treasure') treasureScreen();
  else eventScreen();
}
function nodeDone() { const R = G.run; R.cur++; save(); mapScreen(); }
function runBattle(group, lvl, kind) {
  const R = G.run, ch = CAMPAIGNS[R.camp].chapters[R.ch];
  battleScreen({
    label: `${ch.n} · ${kind === 'boss' ? 'Boss' : kind === 'elite' ? 'Elite' : 'Kampf'}`, bg: ch.bg, kind,
    enemies: group.map(k => ({ key: k, lvl })), useRun: true,
    onEnd: (r) => {
      const party = G.party.filter(k => G.heroes[k]);
      r.heroes.forEach(h => { R.hp[h.key] = h.hpFrac; R.energy[h.key] = h.energy; });
      if (r.win) {
        G.stats.wins++;
        party.forEach(k => { if ((R.hp[k] ?? 1) <= 0) R.hp[k] = .15; });
        const rw = rewardFor(kind, lvl, r.enemies.filter(e => e.xp));
        const xp = applyReward(rw, party);
        let chapter = null;
        if (kind === 'boss') { chapter = completeChapter(R.camp, R.ch); }
        save();
        resultScreen({ rw, xp, party, chapter, next: () => { if (kind === 'boss') { G.run = null; save(); chapterDone(chapter, R); } else nodeDone(); } });
      } else {
        const rw = { xp: Math.round(r.enemies.filter(e => !alive(e) && e.xp).reduce((a, e) => a + e.xp, 0) * .5), gold: 0, items: [], mithril: 0 };
        const xp = applyReward(rw, party); G.run = null; save();
        defeatScreen(rw, xp, party);
      }
    }
  });
}

/* ---------- Kampfbildschirm ---------- */
function battleScreen(cfg) {
  DIFF_E.hp = { easy: .75, normal: 1, hard: 1.3 }[G.settings.diff || 'normal']; DIFF_E.dmg = { easy: .75, normal: 1, hard: 1.25 }[G.settings.diff || 'normal'];
  const party = G.party.filter(k => G.heroes[k]);
  screen(`<div class="bscreen">
    <div class="bhead"><span class="blabel">${esc(cfg.label)}</span>
      <div class="bctl"><button class="btn small ghost" id="b-pause">❚❚</button>${[1, 2, 4].map(s => `<button class="btn small ${G.settings.speed === s ? 'on' : 'ghost'}" data-spd="${s}">${s}×</button>`).join('')}
      <button class="btn small ${G.settings.autoUlt ? 'on' : 'ghost'}" id="b-aut" title="Ultimates automatisch auslösen">Auto-Ult</button></div></div>
    <div class="stage"><canvas id="bcv" class="pix"></canvas><div id="bossbar" hidden><span id="bossname"></span><div class="bar boss"><i id="bossfill"></i></div></div><div id="banner"></div></div>
    <div class="hud">${party.map(k => `<div class="hc" data-k="${k}"><canvas class="pt" width="24" height="24" data-hero="${k}"></canvas><div class="hcb"><b>${HEROES[k].n}</b>
      <div class="bar hp"><i></i><span></span></div><div class="bar rs"><i></i></div><div class="bar en"><i></i></div><div class="hst"></div></div><button class="ultb" hidden>ULT</button></div>`).join('')}</div>
    <div class="blog" id="blog"></div>
  </div>`);
  const heroes = party.map(k => ({ key: k, hpFrac: cfg.useRun ? (G.run.hp[k] ?? 1) : 1, energy: cfg.useRun ? (G.run.energy[k] || 0) : 0 }));
  if (heroes.every(h => h.hpFrac <= 0)) heroes.forEach(h => h.hpFrac = .3);
  const logs = [];
  const B = new Battle({
    canvas: $('#bcv'), heroes, enemies: cfg.enemies, kind: cfg.kind, bg: cfg.bg, speed: G.settings.speed,
    onEnd: r => { clearInterval(hudTimer); setTimeout(() => cfg.onEnd(r, B), 200); },
    onBanner: (u, txt, cls) => { const b = $('#banner'); if (!b) return; b.textContent = (cls === 'foe' || cls === 'ult' || !u ? '' : u.name + ': ') + txt; if (cls === 'ult') b.textContent = `${u.name}: ${txt}`; b.className = 'show ' + (cls || ''); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.className = '', 1100 / Math.max(1, B.speed * .6)); },
    onLog: (u, sk) => { logs.push(sk.death ? `<i>${esc(u.name)} fällt.</i>` : `<b class="${u.side}">${esc(u.name)}</b> ${sk.basic ? 'greift an' : sk.n.startsWith('ruft') ? esc(sk.n) : '» ' + esc(sk.n)}`); if (logs.length > 3) logs.shift(); const l = $('#blog'); if (l) l.innerHTML = logs.join(' · '); }
  });
  curBattle = B;
  $$('[data-spd]').forEach(b => b.onclick = () => { G.settings.speed = +b.dataset.spd; B.speed = G.settings.speed; $$('[data-spd]').forEach(x => x.className = 'btn small ' + (x === b ? 'on' : 'ghost')); save(); });
  $('#b-pause').onclick = togglePause;
  $('#b-aut').onclick = e => { G.settings.autoUlt = !G.settings.autoUlt; e.target.className = 'btn small ' + (G.settings.autoUlt ? 'on' : 'ghost'); save(); };
  $$('.hc').forEach(c => c.querySelector('.ultb').onclick = () => { const k = c.dataset.k; B.ultQueue.add(k); sfx('ult'); c.querySelector('.ultb').classList.add('queued'); });
  const boss = () => B.enemies.find(e => e.boss && alive(e));
  hudTimer = setInterval(() => {
    for (const h of B.heroes) {
      const c = document.querySelector(`.hc[data-k="${h.key}"]`); if (!c) continue;
      c.classList.toggle('dead', !alive(h)); c.classList.toggle('act', B.active === h);
      const bars = c.querySelectorAll('.bar i');
      bars[0].style.width = (h.hp / h.maxHp * 100) + '%'; c.querySelector('.bar.hp span').textContent = `${h.hp}`;
      bars[1].style.width = h.resV + '%'; bars[1].style.background = RESOURCES[h.resT].c;
      bars[2].style.width = h.energy + '%'; c.querySelector('.bar.en').classList.toggle('full', h.energy >= 100);
      c.querySelector('.hst').innerHTML = h.statuses.slice(0, 4).map(s => `<span style="color:${STATUS[s.id].c}" title="${STATUS[s.id].n}">${STATUS[s.id].l}</span>`).join('');
      const ub = c.querySelector('.ultb'); ub.hidden = G.settings.autoUlt || h.energy < 100 || !alive(h); if (ub.hidden) ub.classList.remove('queued');
    }
    const bo = boss(); const bb = $('#bossbar');
    if (bb) { bb.hidden = !bo; if (bo) { $('#bossname').textContent = bo.name; $('#bossfill').style.width = (bo.hp / bo.maxHp * 100) + '%'; } }
  }, 100);
}
function togglePause() { if (!curBattle) return; curBattle.paused = !curBattle.paused; const b = $('#b-pause'); if (b) b.textContent = curBattle.paused ? '▶' : '❚❚'; }

/* ---------- Ergebnisse ---------- */
function lootCard(it, isNew = true) {
  return `<div class="loot r${it.r} ${isNew ? 'reveal' : ''}">${icHtml(it)}<div><b style="color:${RARITY[it.r].c}">${esc(it.name)}</b><small>${RARITY[it.r].n} · ${SLOTS[it.slot]}${it.slot === 'weapon' ? ' (' + WCLS[it.base] + ')' : ''} · St. ${it.lvl}</small><small class="muted">${itemLines(it).join(' · ')}</small>${it.passive ? `<small class="leg">${esc(it.passive)}</small>` : ''}</div></div>`;
}
function xpRows(xp, party) {
  return party.map(k => { const hs = G.heroes[k], r = xp[k] || {}; const cap = hs.lvl >= STAGE_CAP[hs.stage]; return `<div class="xprow"><canvas class="pt" width="24" height="24" data-hero="${k}"></canvas><span class="xn">${HEROES[k].n} <small>St. ${hs.lvl}</small></span><div class="bar xp"><i style="width:${cap ? 100 : hs.xp / xpNeed(hs.lvl) * 100}%"></i></div>${r.ups ? `<span class="up">+${r.ups} Stufe${r.ups > 1 ? 'n' : ''}!</span>` : cap ? '<span class="cap">Stufengrenze: entwickeln!</span>' : ''}</div>`; }).join('');
}
function resultScreen({ rw, xp, party, chapter, next }) {
  sfx('loot'); if (Object.values(xp).some(r => r.ups)) setTimeout(() => sfx('level'), 500);
  screen(`${topbar('Sieg', null)}<div class="wrap narrow"><div class="panel">
    <h2 class="big gold-t">Sieg!</h2>
    <div class="rewards"><span>◆ +${fmt(rw.gold)} Gold</span>${rw.mithril ? `<span>✧ +${rw.mithril} Mithril</span>` : ''}<span>★ +${fmt(rw.xp)} EP</span></div>
    ${xpRows(xp, party)}
    ${rw.items.length ? `<h3>Beute</h3><div class="loots">${rw.items.map(it => lootCard(it)).join('')}</div>` : '<p class="muted">Diesmal keine Beute.</p>'}
    <div class="row"><button class="btn primary" id="b-next">Weiter</button></div></div></div>`);
  $('#b-next').onclick = () => { sfx('click'); next(); };
}
function chapterDone(ch, R) {
  const C = CAMPAIGNS[R.camp], c = C.chapters[R.ch], last = R.ch === C.chapters.length - 1;
  sfx('win');
  screen(`${topbar('Kapitel abgeschlossen', null)}<div class="wrap narrow"><div class="panel intro bg-${c.bg}">
    <div class="kicker">${C.n}</div><h2 class="big gold-t">${last ? (R.camp === 'ringkrieg' ? 'Der Ring ist vernichtet!' : 'Sauron ist entlarvt!') : c.n + ' bezwungen'}</h2>
    ${ch.first ? `<p>Kapitel-Truhe: <b>✧ +${ch.mithril} Mithril</b></p><div class="loots">${ch.chest.map(it => lootCard(it)).join('')}</div>` : '<p class="muted">Erneut abgeschlossen. Die Kapitel-Truhe gibt es nur beim ersten Mal.</p>'}
    ${ch.unlocked.length ? `<h3>Neue Gefährten schließen sich an!</h3><div class="newheroes">${ch.unlocked.map(k => `<div class="nh"><canvas class="pix" width="56" height="52" data-hero="${k}" data-stage="0"></canvas><b>${HEROES[k].n}</b><small>${CLASSES[HEROES[k].cls].n}</small></div>`).join('')}</div>` : ''}
    <div class="row"><button class="btn primary" data-nav="adventure">Weiter</button></div></div></div>`);
}
function defeatScreen(rw, xp, party) {
  screen(`${topbar('Niederlage', null)}<div class="wrap narrow"><div class="panel">
    <h2 class="big">Die Gruppe musste sich zurückziehen</h2>
    <p>Die Reise ist beendet. Erfahrung aus besiegten Gegnern bleibt erhalten (+${fmt(rw.xp)} EP).</p>
    ${xpRows(xp, party)}
    <p class="muted">Tipp: Verbessere Ausrüstung im Inventar, verteile Talentpunkte oder achte auf Tank und Heiler in der Gruppe.</p>
    <div class="row"><button class="btn primary" data-nav="hub">Zum Lager</button><button class="btn" data-nav="heroes">Helden stärken</button></div></div></div>`);
}

/* ---------- Lager, Schatz, Begegnungen ---------- */
function runParty() { return G.party.filter(k => G.heroes[k]); }
function simple(title, kicker, body, buttons) {
  const R = G.run, bg = R ? CAMPAIGNS[R.camp].chapters[R.ch].bg : 'shire';
  screen(`${topbar(title, null)}<div class="wrap narrow"><div class="panel intro bg-${bg}"><div class="kicker">${kicker}</div><h2 class="big">${title}</h2><div class="story">${body}</div>
    <div class="row">${buttons.map((b, i) => `<button class="btn ${i === 0 ? 'primary' : ''}" data-b="${i}" ${b.dis ? 'disabled' : ''}>${b.l}</button>`).join('')}</div></div></div>`);
  $$('[data-b]').forEach(el => el.onclick = () => { sfx('click'); buttons[+el.dataset.b].fn(); });
}
function outcome(title, html) { save(); simple(title, 'Ergebnis', html, [{ l: 'Weiter', fn: nodeDone }]); }
function restScreen() {
  simple('Lagerfeuer', 'Rast', '<p>Das Feuer knistert. Die Gruppe kann sich erholen oder die Nacht zum Üben nutzen.</p>', [
    { l: 'Rasten: +60 % LP, Gefallene erwachen', fn: () => { runParty().forEach(k => G.run.hp[k] = Math.min(1, Math.max(.3, (G.run.hp[k] ?? 1) + .6))); sfx('heal'); outcome('Erholt', '<p>Alle schlafen tief und brechen gestärkt auf.</p>'); } },
    { l: 'Üben: viel Erfahrung', fn: () => { const ups = []; runParty().forEach(k => { const r = grantXp(k, Math.round(xpNeed(G.heroes[k].lvl) * .55)); if (r.ups) ups.push(HEROES[k].n); }); sfx('level'); outcome('Training', `<p>Bis tief in die Nacht klirren die Klingen.${ups.length ? ' Stufenaufstieg: ' + ups.join(', ') + '.' : ''}</p>`); } }]);
}
function treasureScreen() {
  const ch = CAMPAIGNS[G.run.camp].chapters[G.run.ch];
  const items = [genItem(ch.lvl + 1, rollRarity('elite')), genItem(ch.lvl + 1, rollRarity('normal'))]; items.forEach(addItem);
  const gold = ri(30, 60) + ch.lvl * 6; G.gold += gold; save(); sfx('loot');
  simple('Verborgene Truhe', 'Schatz', `<p>Unter Wurzeln und Moos liegt eine alte Truhe. Darin: <b>◆ ${gold} Gold</b> und</p><div class="loots">${items.map(it => lootCard(it)).join('')}</div>`, [{ l: 'Weiter', fn: nodeDone }]);
  paintCanvases();
}
const EVENTS = [
  () => simple('Elbenrast', 'Begegnung', '<p>Eine Schar Elben auf dem Weg zu den Grauen Anfurten teilt ihr Lager mit euch. Ihre Lieder heilen mehr als nur Wunden.</p>', [
    { l: 'Rasten (+40 % LP, +40 Ultimate)', fn: () => { runParty().forEach(k => { G.run.hp[k] = Math.min(1, Math.max(.2, (G.run.hp[k] ?? 1) + .4)); G.run.energy[k] = Math.min(100, (G.run.energy[k] || 0) + 40); }); sfx('heal'); outcome('Elbenlieder', '<p>Ihr schlaft so tief wie lange nicht.</p>'); } },
    { l: 'Um Rat bitten (Erfahrung)', fn: () => { runParty().forEach(k => grantXp(k, Math.round(xpNeed(G.heroes[k].lvl) * .4))); sfx('level'); outcome('Alte Weisheit', '<p>Ihre Worte schärfen euren Blick.</p>'); } }]),
  () => simple('Augen im Dunkeln', 'Begegnung', '<p>Ein hageres Wesen kauert hinter einem Felsen und murmelt von seinem Schatz. Es beobachtet euch gierig.</p>', [
    { l: 'Ihm Gold geben (40)', dis: G.gold < 40, fn: () => { G.gold -= 40; const it = genItem(CAMPAIGNS[G.run.camp].chapters[G.run.ch].lvl + 1, 2 + (Math.random() < .3 ? 1 : 0)); addItem(it); sfx('loot'); outcome('Ein seltsames Geschenk', `<p>Es kichert und lässt etwas zurück:</p><div class="loots">${lootCard(it)}</div>`); paintCanvases(); } },
    { l: 'Verjagen', fn: () => { const g = ri(20, 50); G.gold += g; outcome('Ein kleiner Fund', `<p>In seinem Versteck liegen ${g} Goldmünzen.</p>`); } }]),
  () => { const hs = runParty().map(k => G.heroes[k].eq.weapon && itemById(G.heroes[k].eq.weapon)).filter(Boolean); const it = hs.length ? pick(hs) : null;
    simple('Verlassene Zwergenschmiede', 'Begegnung', `<p>Amboss und Hämmer sind noch brauchbar. ${it ? `Gimli meint, <b>${esc(it.name)}</b> ließe sich verbessern.` : 'Leider hat niemand eine Waffe dabei.'}</p>`, [
      { l: it ? 'Waffe verstärken (+1)' : 'Weiterziehen', fn: () => { if (it && it.enh < 10) { it.enh++; G.stats.maxEnh = Math.max(G.stats.maxEnh, it.enh); sfx('buff'); } outcome('Funken fliegen', it ? `<p>${esc(it.name)} ist jetzt +${it.enh}.</p>` : '<p>Ihr zieht weiter.</p>'); } }]); },
  () => simple('Der Spiegel der Herrin', 'Begegnung', '<p>In einer silbernen Schale spiegelt sich, was war, was ist und was vielleicht sein wird.</p>', [
    { l: 'Hineinblicken (viel Erfahrung)', fn: () => { runParty().forEach(k => grantXp(k, Math.round(xpNeed(G.heroes[k].lvl) * .7))); sfx('level'); outcome('Visionen', '<p>Ihr seht Feuer und Hoffnung und kehrt entschlossener zurück.</p>'); } },
    { l: 'Sich abwenden (+8 Mithril)', fn: () => { G.mithril += 8; outcome('Ein Geschenk', '<p>Die Herrin lächelt und reicht euch eine Handvoll Mithril.</p>'); } }]),
  () => { const opts = [['Der Wind', 0], ['Ein Fluss', 1], ['Die Zeit', 0]].sort(() => Math.random() - .5);
    simple('Rätsel am Brückenpfeiler', 'Begegnung', '<p>Ein alter Wächter versperrt den Weg: „Ich wandere ohne Füße, singe ohne Mund und trage Steine bis ins Meer. Was bin ich?“</p>',
      opts.map(([l, ok]) => ({ l, fn: () => { if (ok) { G.mithril += 10; G.gold += 60; sfx('level'); outcome('Richtig!', '<p>Der Wächter lacht: +60 Gold und +10 Mithril.</p>'); } else { G.gold = Math.max(0, G.gold - 25); sfx('miss'); outcome('Falsch', '<p>Ihr zahlt 25 Gold Brückenzoll.</p>'); } } }))); },
  () => simple('Ein Hirte der Bäume', 'Begegnung', '<p>„Hm, hum, nicht so hastig“, brummt ein Baum und reicht euch eine Schale mit funkelndem Wasser.</p>', [
    { l: 'Trinken (+30 % LP, volle Ultimate)', fn: () => { runParty().forEach(k => { G.run.hp[k] = Math.min(1, Math.max(.2, (G.run.hp[k] ?? 1) + .3)); G.run.energy[k] = 100; }); sfx('heal'); outcome('Ent-Trunk', '<p>Ihr fühlt euch, als würdet ihr wachsen.</p>'); } }]),
  () => simple('Adler über den Bergen', 'Begegnung', '<p>Ein gewaltiger Adler kreist über euch und lässt etwas Glänzendes fallen.</p>', [
    { l: 'Auffangen', fn: () => { const it = genItem(CAMPAIGNS[G.run.camp].chapters[G.run.ch].lvl + 2, rollRarity('boss')); addItem(it); sfx('loot'); outcome('Ein Geschenk der Lüfte', `<div class="loots">${lootCard(it)}</div>`); paintCanvases(); } }])
];
function eventScreen() { pick(EVENTS)(); }

/* ---------- Gruppe ---------- */
function partyScreen() {
  const owned = Object.keys(G.heroes);
  const roleOf = k => CLASSES[HEROES[k].cls].role;
  const counts = { tank: 0, dd: 0, heal: 0 }; G.party.forEach(k => counts[roleOf(k)]++);
  const warn = [!counts.tank && 'Kein Tank: Die Feinde greifen eure Schadensverursacher an.', !counts.heal && 'Kein Heiler: Lebenspunkte erholen sich kaum.'].filter(Boolean);
  let filter = partyScreen.filter || 'all';
  screen(`${topbar('Gruppe', G.run ? 'map' : 'hub')}<div class="wrap">
    <p class="muted">Bis zu fünf Helden ziehen in den Kampf. Klicke auf einen Helden, um ihn hinzuzufügen oder zu entfernen. Bewährt hat sich: 1 Tank, 1 Heiler, 3 Schaden.</p>
    <div class="slots">${[0, 1, 2, 3, 4].map(i => { const k = G.party[i]; return k ? `<button class="slot full" data-rm="${k}"><canvas class="pix" width="56" height="52" data-hero="${k}"></canvas><b>${HEROES[k].n}</b>${roleChip(roleOf(k))}<small>St. ${G.heroes[k].lvl} · ⚡${fmt(heroStats(k).power)}</small></button>` : `<div class="slot empty">Freier Platz</div>`; }).join('')}</div>
    ${warn.map(w => `<div class="warn">⚠ ${w}</div>`).join('')}
    <div class="filters">${[['all', 'Alle'], ['tank', 'Tanks'], ['dd', 'Schaden'], ['heal', 'Heiler']].map(([f, n]) => `<button class="btn small ${filter === f ? 'on' : 'ghost'}" data-f="${f}">${n}</button>`).join('')}</div>
    <div class="roster">${owned.filter(k => filter === 'all' || roleOf(k) === filter).sort((a, b) => heroStats(b).power - heroStats(a).power).map(k => `<button class="rh ${G.party.includes(k) ? 'in' : ''}" data-k="${k}"><canvas class="pix" width="56" height="52" data-hero="${k}"></canvas><b>${HEROES[k].n}</b><small>${CLASSES[HEROES[k].cls].n}</small>${roleChip(roleOf(k))}<small>St. ${G.heroes[k].lvl} · ⚡${fmt(heroStats(k).power)}</small></button>`).join('')}</div>
  </div>`);
  $$('[data-f]').forEach(b => b.onclick = () => { partyScreen.filter = b.dataset.f; partyScreen(); });
  $$('[data-rm]').forEach(b => b.onclick = () => { if (G.party.length <= 1) return toast('Mindestens ein Held muss dabei sein.'); G.party = G.party.filter(k => k !== b.dataset.rm); sfx('click'); save(); partyScreen(); });
  $$('.rh').forEach(b => b.onclick = () => { const k = b.dataset.k; if (G.party.includes(k)) { if (G.party.length <= 1) return; G.party = G.party.filter(x => x !== k); } else { if (G.party.length >= 5) return toast('Die Gruppe ist voll. Entferne zuerst einen Helden.'); G.party.push(k); if (G.run && G.run.hp[k] === undefined) G.run.hp[k] = 1; } sfx('click'); save(); partyScreen(); });
}

/* ---------- Helden ---------- */
function heroesScreen() {
  const owned = Object.keys(G.heroes).sort((a, b) => heroStats(b).power - heroStats(a).power);
  screen(`${topbar('Helden')}<div class="wrap"><div class="roster">${owned.map(k => { const hs = G.heroes[k], pts = talentPoints(hs), ev = canEvolve(k); return `<button class="rh" data-k="${k}"><canvas class="pix" width="56" height="52" data-hero="${k}"></canvas><b>${HEROES[k].n}</b><small>${heroTitle(k)}</small>${roleChip(CLASSES[HEROES[k].cls].role)}<small>St. ${hs.lvl}/${STAGE_CAP[hs.stage]} · ⚡${fmt(heroStats(k).power)}</small>${pts ? `<span class="badge">${pts} Talentpunkt${pts > 1 ? 'e' : ''}</span>` : ''}${ev && ev.lvlOk ? '<span class="badge evo">Entwicklung bereit</span>' : ''}</button>`; }).join('')}</div>
    <p class="muted center">${Object.keys(HEROES).length - owned.length} weitere Helden warten in der Taverne.</p></div>`);
  $$('.rh').forEach(b => b.onclick = () => { sfx('click'); heroScreen(b.dataset.k); });
}
function heroScreen(k, tab = heroScreen.tab || 'over') {
  heroScreen.tab = tab; heroScreen.cur = k;
  const H = HEROES[k], C = CLASSES[H.cls], hs = G.heroes[k], st = heroStats(k);
  const tabs = [['over', 'Übersicht'], ['gear', 'Ausrüstung'], ['talent', `Talente${talentPoints(hs) ? ' (' + talentPoints(hs) + ')' : ''}`], ['evo', 'Entwicklung']];
  let body = '';
  if (tab === 'over') {
    const ul = heroUlt(k);
    body = `<div class="hero-over"><div class="preview"><canvas id="pv" class="pix"></canvas><div class="animbtns">${[['idle', 'Stehen'], ['walk', 'Laufen'], ['attack', 'Angriff'], ['cast', 'Zauber'], ['shoot', 'Schuss'], ['throw', 'Wurf'], ['shout', 'Kampfruf'], ['hurt', 'Treffer'], ['victory', 'Sieg'], ['dead', 'Fallen']].map(([a, n]) => `<button class="btn small ghost" data-anim="${a}">${n}</button>`).join('')}</div></div>
      <div class="stats"><div class="statgrid">${[['Lebenspunkte', st.hp], ['Angriff', st.atk], ['Magie', st.mag], ['Verteidigung', st.def], ['Widerstand', st.res], ['Tempo', st.spd], ['Krit-Chance', st.crit + ' %'], ['Krit-Schaden', '+' + st.critDmg + ' %']].map(([n, v]) => `<div><span>${n}</span><b>${v}</b></div>`).join('')}</div>
      ${Object.keys(st.p).length ? `<div class="passives">${Object.entries(st.p).map(([pk, v]) => `<span>${passiveName(pk, v)}</span>`).join('')}</div>` : ''}
      <div class="tactic"><span>Taktik:</span>${[['safe', 'Vorsichtig'], ['normal', 'Ausgewogen'], ['aggro', 'Aggressiv']].map(([t, n]) => `<button class="btn small ${hs.tactic === t ? 'on' : 'ghost'}" data-tac="${t}">${n}</button>`).join('')}</div>
      <h3>Fähigkeiten</h3><div class="skills">${H.skills.map(s => `<div class="sk ${s.stage && s.stage > hs.stage ? 'locked' : ''}"><b>${s.n}</b><small>${s.cost} ${RESOURCES[C.res].n} · Abklingzeit ${s.cd}${s.stage && s.stage > hs.stage ? ' · ab Entwicklungsstufe ' + (s.stage + 1) : ''}</small><p>${s.d}</p></div>`).join('')}
      <div class="sk ult"><b>Ultimate · ${ul.n}</b><small>Lädt sich durch Aktionen und erlittenen Schaden auf${ul.up ? ' · verstärkt' : ''}</small><p>${ul.d}</p></div></div></div></div>`;
  } else if (tab === 'gear') {
    body = `<div class="gear">${Object.entries(SLOTS).map(([slot, sn]) => { const it = hs.eq[slot] && itemById(hs.eq[slot]); return `<div class="gslot"><div class="gsh">${sn}</div>${it ? `${lootCard(it, false)}<div class="row"><button class="btn small ghost" data-un="${slot}">Ablegen</button><button class="btn small ghost" data-enh="${it.id}" ${G.gold < enhCost(it) || it.enh >= 10 ? 'disabled' : ''}>Verstärken +${it.enh + 1} (◆${fmt(enhCost(it))})</button></div>` : '<p class="muted">Leer</p>'}</div>`; }).join('')}</div>
      <h3>Passende Gegenstände</h3><p class="muted">Waffen: ${C.wcls.map(w => WCLS[w]).join(', ')}. Rüstung und Schmuck kann jeder tragen.</p>
      <div class="loots list">${G.inv.filter(it => canEquip(k, it) && hs.eq[it.slot] !== it.id).sort((a, b) => b.r - a.r || b.lvl - a.lvl).slice(0, 40).map(it => { const d = powerDiff(k, it); const by = equippedBy(it.id); return `<div class="lrow">${lootCard(it, false)}<div class="lact"><span class="${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : ''}${fmt(d)} ⚡</span>${by ? `<small>trägt ${HEROES[by].n}</small>` : ''}<button class="btn small" data-eq="${it.id}">Anlegen</button></div></div>`; }).join('') || '<p class="muted">Keine passenden Gegenstände im Inventar.</p>'}</div>`;
  } else if (tab === 'talent') {
    const pts = talentPoints(hs), resetCost = 40 * hs.lvl;
    body = `<div class="tpoints"><span>Verfügbare Punkte: <b>${pts}</b></span><span class="muted">Ein Punkt pro Stufe. Rang 2 braucht 5 Punkte im Ast, die Meisterschaft 10.</span><button class="btn small ghost" id="b-reset" ${talentSpent(hs) && G.gold >= resetCost ? '' : 'disabled'}>Zurücksetzen (◆${fmt(resetCost)})</button></div>
      <div class="tree">${C.tree.map((br, b) => `<div class="branch"><h3>${br.n} <small>${branchSpent(hs, b)} Punkte</small></h3>${br.nodes.map((nd, n) => { const r = hs.talents[`${b}-${n}`] || 0, max = n === 2 ? 1 : 5, can = canRank(hs, b, n), lock = branchSpent(hs, b) < [0, 5, 10][n]; return `<button class="tnode ${r ? 'has' : ''} ${n === 2 ? 'cap' : ''} ${lock ? 'lock' : ''}" data-t="${b}-${n}" ${can ? '' : 'disabled'}><b>${nd.n}</b><span class="rk">${r}/${max}</span><small>${nd.d}</small></button>`; }).join('<div class="tline"></div>')}</div>`).join('')}</div>`;
  } else if (tab === 'evo') {
    const ev = canEvolve(k);
    body = `<div class="evo">${H.stages.map((s, i) => `<div class="evs ${i === hs.stage ? 'cur' : i < hs.stage ? 'past' : ''}"><canvas class="pix" width="56" height="52" data-hero="${k}" data-stage="${i}"></canvas><b>${s}</b><small>Stufe ${i === 0 ? 1 : STAGE_CAP[i - 1]}–${STAGE_CAP[i]} · Werte ×${STAGE_MULT[i]}</small><small>${i === 1 ? 'Neue Fähigkeit: ' + (H.skills.find(x => x.stage === 1)?.n || '') : i === 2 ? 'Ultimate verstärkt, neues Aussehen' : 'Grundform'}</small></div>`).join('<div class="evarrow">➜</div>')}</div>
      ${ev ? `<div class="panel evobox"><p>Nächste Entwicklung: <b>${H.stages[hs.stage + 1]}</b></p><p>Voraussetzung: Stufe ${STAGE_CAP[hs.stage]} ${ev.lvlOk ? '✓' : `(aktuell ${hs.lvl})`} · Kosten: ◆ ${fmt(ev.cost.gold)} Gold, ✧ ${ev.cost.mithril} Mithril</p><button class="btn primary" id="b-evo" ${ev.ok ? '' : 'disabled'}>Entwickeln</button></div>` : '<p class="center gold-t">Höchste Entwicklungsstufe erreicht.</p>'}`;
  }
  screen(`${topbar(H.n, 'heroes')}<div class="wrap">
    <div class="hero-head"><canvas class="pt big" width="24" height="24" data-hero="${k}"></canvas><div><h2>${H.n} <small>${heroTitle(k)}</small></h2><div class="hmeta">${roleChip(C.role)}<span>${C.n} · ${C.sub}</span><span>${H.era}</span><span>Stufe ${hs.lvl}/${STAGE_CAP[hs.stage]}</span><span>⚡ ${fmt(st.power)}</span></div>
    <div class="bar xp"><i style="width:${hs.lvl >= STAGE_CAP[hs.stage] ? 100 : hs.xp / xpNeed(hs.lvl) * 100}%"></i></div><p class="muted">${C.d}</p></div></div>
    <div class="tabs">${tabs.map(([t, n]) => `<button class="tab ${t === tab ? 'on' : ''}" data-tab="${t}">${n}</button>`).join('')}</div>
    ${body}</div>`);
  $$('[data-tab]').forEach(b => b.onclick = () => { sfx('click'); heroScreen(k, b.dataset.tab); });
  if (tab === 'over') {
    const u = Object.assign(heroUnitLook(k), { x: 32, y: 40, anim: 'idle', repeat: 1 });
    curScenes.push(new Scene($('#pv'), { w: 64, h: 43, bg: null, units: [u] }));
    $$('[data-anim]').forEach(b => b.onclick = () => { u.anim = b.dataset.anim; u.el = 0; });
    $$('[data-tac]').forEach(b => b.onclick = () => { hs.tactic = b.dataset.tac; save(); heroScreen(k); });
  }
  $$('[data-eq]').forEach(b => b.onclick = () => { const it = itemById(+b.dataset.eq); equip(k, it); sfx('buff'); heroScreen(k); });
  $$('[data-un]').forEach(b => b.onclick = () => { unequip(k, b.dataset.un); heroScreen(k); });
  $$('[data-enh]').forEach(b => b.onclick = () => { if (enhance(itemById(+b.dataset.enh))) { sfx('buff'); toast('Verstärkt!'); } heroScreen(k); });
  $$('[data-t]').forEach(b => b.onclick = () => { const [br, n] = b.dataset.t.split('-').map(Number); if (canRank(hs, br, n)) { hs.talents[b.dataset.t] = (hs.talents[b.dataset.t] || 0) + 1; G.stats.talents++; sfx('buff'); save(); heroScreen(k); } });
  if ($('#b-reset')) $('#b-reset').onclick = () => { const c = 40 * hs.lvl; if (G.gold < c) return; G.gold -= c; hs.talents = {}; save(); heroScreen(k); };
  if ($('#b-evo')) $('#b-evo').onclick = () => { if (evolve(k)) { sfx('ult'); evolveCelebration(k); } };
}
function evolveCelebration(k) {
  const hs = G.heroes[k];
  modal(`<div class="center"><div class="kicker">Entwicklung</div><h2 class="big gold-t">${HEROES[k].n}</h2><p>wird zu <b>${HEROES[k].stages[hs.stage]}</b></p>
    <canvas id="evc" class="pix" style="width:288px;max-width:100%"></canvas><p class="muted">Alle Werte steigen, die Stufengrenze wird auf ${STAGE_CAP[hs.stage]} angehoben.</p>
    <button class="btn primary" onclick="closeModal();heroScreen('${k}','evo')">Großartig!</button></div>`);
  const u = Object.assign(heroUnitLook(k), { x: 32, y: 40, anim: 'victory', repeat: 1 });
  const sc = new Scene($('#evc'), { w: 64, h: 43, bg: null, units: [u] }); curScenes.push(sc);
}
function powerDiff(k, it) { const hs = G.heroes[k], prev = hs.eq[it.slot], before = heroStats(k).power; const owner = equippedBy(it.id); hs.eq[it.slot] = it.id; const after = heroStats(k).power; hs.eq[it.slot] = prev; if (owner && owner !== k) G.heroes[owner].eq[it.slot] = it.id; return after - before; }
function passiveName(k, v) {
  const N = { dodge: `${v} % Ausweichen`, lifesteal: `${v} % Lebensraub`, thorns: `${v} % Dornen`, healPct: `+${v} % Heilung`, healRecv: `+${v} % erh. Heilung`, threat: `+${v} % Bedrohung`, resGain: `+${v} % Ressource`, ultCharge: `+${v} % Ultimate`, statusCh: `+${v} % Zustände`, dmgRed: `−${v} % Schaden`, regenTurn: `${v} % Regeneration`,
    execute: `Hinrichten +${Math.round(v * 100)} %`, lowHpDmg: `Berserker +${Math.round(v * 100)} %`, doubleHit: `${Math.round(v * 100)} % Doppeltreffer`, counter: `${Math.round(v * 100)} % Konter`, burnOnHit: `${Math.round(v * 100)} % Brand`, poisonOnHit: `${Math.round(v * 100)} % Gift`, slowOnHit: `${Math.round(v * 100)} % Lähmung`, stunOnHit: `${Math.round(v * 100)} % Betäubung`,
    echo: `${Math.round(v * 100)} % Echo`, reviveSelf: `Unbeugsam (${Math.round(v * 100)} %)`, reviveAlly: `Lebensfunke (${Math.round(v * 100)} %)`, startShieldSelf: 'Startschild', startShieldAll: 'Gruppenschild', startBuffDef: 'Banner', startBuffRegen: 'Frühling', startInvis: 'Tarnung', startHaste: 'Starteile', startEnergy: `+${v} Start-Ultimate`, healShield: 'Lichtschild', healSmite: 'Heiliger Zorn', healRegen: 'Lebensblüte', vsOrk: `+${Math.round(v * 100)} % gegen Orks` };
  return N[k] || k;
}

/* ---------- Inventar ---------- */
function inventoryScreen() {
  const f = inventoryScreen.f || 'all';
  const list = G.inv.filter(it => f === 'all' || it.slot === f).sort((a, b) => b.r - a.r || b.lvl - a.lvl);
  screen(`${topbar('Inventar')}<div class="wrap">
    <div class="filters">${[['all', 'Alle'], ['weapon', 'Waffen'], ['armor', 'Rüstungen'], ['trinket', 'Schmuck']].map(([x, n]) => `<button class="btn small ${f === x ? 'on' : 'ghost'}" data-f="${x}">${n}</button>`).join('')}
      <button class="btn small danger" id="b-salv">Gewöhnliche & Ungewöhnliche zerlegen</button></div>
    <div class="loots list">${list.map(it => { const by = equippedBy(it.id); return `<div class="lrow">${lootCard(it, false)}<div class="lact">${by ? `<small>trägt ${HEROES[by].n}</small>` : ''}<button class="btn small ghost" data-give="${it.id}">Anlegen …</button><button class="btn small ghost" data-enh="${it.id}" ${G.gold < enhCost(it) || it.enh >= 10 ? 'disabled' : ''}>+${it.enh + 1} (◆${fmt(enhCost(it))})</button><button class="btn small ghost" data-sv="${it.id}" ${by ? 'disabled' : ''}>Zerlegen ◆${fmt(itemValue(it))}</button></div></div>`; }).join('') || '<p class="muted">Noch keine Gegenstände.</p>'}</div></div>`);
  $$('[data-f]').forEach(b => b.onclick = () => { inventoryScreen.f = b.dataset.f; inventoryScreen(); });
  $$('[data-sv]').forEach(b => b.onclick = () => { const v = salvage(itemById(+b.dataset.sv)); save(); toast(`+${v} Gold`); inventoryScreen(); });
  $$('[data-enh]').forEach(b => b.onclick = () => { if (enhance(itemById(+b.dataset.enh))) sfx('buff'); inventoryScreen(); });
  $('#b-salv').onclick = () => { let g = 0; G.inv.filter(it => it.r <= 1 && !equippedBy(it.id)).forEach(it => g += salvage(it)); save(); toast(`Zerlegt: +${fmt(g)} Gold`); inventoryScreen(); };
  $$('[data-give]').forEach(b => b.onclick = () => {
    const it = itemById(+b.dataset.give);
    const hs = Object.keys(G.heroes).filter(k => canEquip(k, it));
    modal(`<h2>${esc(it.name)} anlegen</h2><div class="givelist">${hs.map(k => `<button class="rh small" data-to="${k}"><canvas class="pt" width="24" height="24" data-hero="${k}"></canvas><b>${HEROES[k].n}</b><small class="${powerDiff(k, it) >= 0 ? 'pos' : 'neg'}">${powerDiff(k, it) >= 0 ? '+' : ''}${fmt(powerDiff(k, it))} ⚡</small></button>`).join('')}</div>`);
    $$('[data-to]').forEach(x => x.onclick = () => { equip(x.dataset.to, it); closeModal(); sfx('buff'); inventoryScreen(); });
  });
}

/* ---------- Taverne ---------- */
function tavernScreen() {
  const locked = Object.keys(HEROES).filter(k => !G.heroes[k]);
  screen(`${topbar('Taverne zum Tänzelnden Pony')}<div class="wrap"><p class="muted">Hier warten Helden auf ihre Gelegenheit. Manche schließen sich nach Kapiteln von selbst an, alle anderen gewinnst du mit Mithril.</p>
    <div class="roster">${locked.map(k => { const H = HEROES[k], C = CLASSES[H.cls]; const u = H.unlock; const cond = u ? `Kommt nach ${u.ch < 0 ? 'Freischaltung' : 'Kapitel ' + (u.ch + 1)} von „${CAMPAIGNS[u.camp].n}“` : ''; return `<div class="rh tav"><canvas class="pix" width="56" height="52" data-hero="${k}" data-stage="0"></canvas><b>${H.n}</b><small>${H.era}</small>${roleChip(C.role)}<small>${C.n}: ${C.sub}</small><small class="muted">${cond}</small><button class="btn small primary" data-rec="${k}" ${G.mithril >= H.cost ? '' : 'disabled'}>Anwerben ✧${H.cost}</button></div>`; }).join('') || '<p>Alle Helden sind bereits in deiner Gemeinschaft!</p>'}</div></div>`);
  $$('[data-rec]').forEach(b => b.onclick = () => { const k = b.dataset.rec; if (recruit(k)) { sfx('level'); toast(`${HEROES[k].n} schließt sich an!`); tavernScreen(); } });
}

/* ---------- Orthanc-Turm ---------- */
function towerScreen() {
  const f = G.tower.best + 1, tg = towerGroup(f);
  screen(`${topbar('Orthanc-Turm')}<div class="wrap narrow"><div class="panel intro bg-helm">
    <div class="kicker">Endlose Herausforderung</div><h2 class="big">Etage ${f}</h2>
    <p>Jede Etage ist ein einzelner Kampf mit voller Gesundheit. Jede fünfte Etage wartet ein Elitegegner, jede zehnte ein Boss. Bestwert: Etage ${G.tower.best}.</p>
    <div class="foes">${tg.group.map(k => `<div class="foe"><canvas class="pix" width="56" height="52" data-enemy="${k}"></canvas><small>${ENEMIES[k].n}</small></div>`).join('')}</div>
    <p>Gegnerstufe ${towerLvl(f)} · Belohnung: ◆ ${fmt(40 + f * 25)} Gold${f % 5 === 0 ? `, ✧ ${f * 2} Mithril` : ''} und Beute</p>
    <div class="row"><button class="btn primary" id="b-fight">Kämpfen</button></div></div></div>`);
  $('#b-fight').onclick = () => {
    const party = G.party.filter(k => G.heroes[k]), lvl = towerLvl(f);
    battleScreen({ label: `Orthanc-Turm · Etage ${f}`, bg: tg.bg, kind: tg.kind, enemies: tg.group.map(k => ({ key: k, lvl })), useRun: false,
      onEnd: r => {
        if (r.win) {
          G.stats.wins++; G.tower.best = f; G.stats.tower = Math.max(G.stats.tower, f);
          const rw = rewardFor('tower', lvl, r.enemies.filter(e => e.xp)); rw.gold += 40 + f * 25; if (f % 5 === 0) { rw.mithril += f * 2; rw.items.push(genItem(lvl + 1, rollRarity('boss'))); }
          const xp = applyReward(rw, party); save();
          resultScreen({ rw, xp, party, next: towerScreen });
        } else { save(); defeatScreen({ xp: 0 }, {}, party); }
      } });
  };
}

/* ---------- Erfolge ---------- */
function achievementsScreen() {
  screen(`${topbar('Erfolge')}<div class="wrap"><div class="achs">${ACHIEVEMENTS.map(a => { const s = achState(a); return `<div class="ach ${s.claimed ? 'claimed' : s.done ? 'ready' : ''}"><div><b>${a.n}</b><small>${a.d}</small><div class="bar xp"><i style="width:${Math.min(100, s.v / a.goal * 100)}%"></i></div><small>${Math.min(s.v, a.goal)}/${a.goal}</small></div><div class="ar"><span>${a.r.gold ? '◆ ' + fmt(a.r.gold) : ''}${a.r.mithril ? '✧ ' + a.r.mithril : ''}</span>${s.claimed ? '<small>Erhalten</small>' : `<button class="btn small ${s.done ? 'primary' : 'ghost'}" data-a="${a.id}" ${s.done ? '' : 'disabled'}>Abholen</button>`}</div></div>`; }).join('')}</div></div>`);
  $$('[data-a]').forEach(b => b.onclick = () => { const a = ACHIEVEMENTS.find(x => x.id === b.dataset.a); if (claimAch(a)) { sfx('loot'); achievementsScreen(); } });
}

/* ---------- Optionen & Hilfe ---------- */
function settingsScreen() {
  const s = G.settings;
  screen(`${topbar('Optionen')}<div class="wrap narrow"><div class="panel">
    <h3>Ton</h3><div class="row"><button class="btn small ${s.sound ? 'on' : 'ghost'}" id="o-snd">${s.sound ? 'An' : 'Aus'}</button></div>
    <h3>Schwierigkeit</h3><div class="row">${[['easy', 'Leicht'], ['normal', 'Normal'], ['hard', 'Schwer']].map(([d, n]) => `<button class="btn small ${(s.diff || 'normal') === d ? 'on' : 'ghost'}" data-d="${d}">${n}</button>`).join('')}</div>
    <h3>Ultimates</h3><div class="row"><button class="btn small ${s.autoUlt ? 'on' : 'ghost'}" id="o-ult">${s.autoUlt ? 'Automatisch' : 'Manuell per Klick'}</button></div>
    <h3>Hilfe</h3><div class="row"><button class="btn small" id="o-help">Anleitung öffnen</button></div>
    <h3>Spielstand</h3><div class="row"><button class="btn small danger" id="o-del">Fortschritt löschen</button><span id="o-conf" hidden>Wirklich? <button class="btn small danger" id="o-del2">Ja, löschen</button></span></div>
  </div></div>`);
  $('#o-snd').onclick = () => { s.sound = !s.sound; save(); settingsScreen(); };
  $('#o-ult').onclick = () => { s.autoUlt = !s.autoUlt; save(); settingsScreen(); };
  $$('[data-d]').forEach(b => b.onclick = () => { s.diff = b.dataset.d; save(); settingsScreen(); });
  $('#o-help').onclick = helpModal;
  $('#o-del').onclick = () => { $('#o-conf').hidden = false; };
  $('#o-del2').onclick = () => { store.del(SAVE_KEY); G = null; titleScreen(); };
}
function helpModal() {
  modal(`<div class="help"><h2>Anleitung</h2>
    <h3>Rollen wie in einem MMO</h3><ul>
      <li><b class="r-tank">Tanks</b> (Schildwache, Bollwerk, Urgewalt) erzeugen viel Bedrohung und verspotten Feinde. Gegner greifen bevorzugt an, wer die meiste Bedrohung hat.</li>
      <li><b class="r-dd">Schaden</b>: Klingenmeister (Nahkampf, Wut), Waldläufer (Fernkampf, Fokus), Schattenläufer (List, Energie) und Zauberer (Magie, Mana).</li>
      <li><b class="r-heal">Heiler</b>: Lichtheiler (Schilde, Reinigung) und Naturheiler (Heilung über Zeit, Wiederbelebung).</li></ul>
    <h3>Ressourcen</h3><p><b>Wut</b> entsteht durch Treffen und Getroffenwerden. <b>Energie</b> und <b>Fokus</b> füllen sich jede Runde. <b>Mana</b> regeneriert langsam. Jede Fähigkeit kostet Ressource und hat eine Abklingzeit. Die <b>Ultimate</b> (goldene Leiste) lädt sich durch Aktionen und erlittenen Schaden auf.</p>
    <h3>Auto-Kampf</h3><p>Die Zugreihenfolge richtet sich nach dem Tempo. Mit 1×, 2× und 4× steuerst du die Geschwindigkeit, die Leertaste pausiert. Unter „Optionen“ kannst du Ultimates auf manuell stellen und dann im Kampf selbst auslösen.</p>
    <h3>Fortschritt</h3><ul><li><b>Stufen</b> bringen Werte und Talentpunkte. Auch Helden auf der Bank erhalten 30 % der Erfahrung.</li><li><b>Entwicklung</b> bei Stufe 15 und 30 (kostet Gold & Mithril): neue Fähigkeit, verstärkte Ultimate, neues Aussehen.</li>
    <li><b>Ausrüstung</b> in fünf Seltenheiten. Legendäre Gegenstände haben besondere Effekte und sind für bestimmte Helden noch stärker. Beim Schmied (Inventar) verstärkst du Gegenstände bis +10.</li></ul>
    <div class="row"><button class="btn primary" onclick="closeModal()">Verstanden</button></div></div>`);
}

const NAV = { hub, title: titleScreen, adventure, map: mapScreen, party: partyScreen, heroes: heroesScreen, inventory: inventoryScreen, tavern: tavernScreen, tower: towerScreen, achievements: achievementsScreen, settings: settingsScreen };
document.addEventListener('pointerdown', () => { if (G?.settings.sound) ac(); }, { once: true });
titleScreen();
