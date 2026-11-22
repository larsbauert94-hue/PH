'use strict';
/* =====================================================================
   RINGFAHRT – Oberfläche & Story-Regie
   Der Kampf läuft dauerhaft im Vollbild; Menüs liegen als Glas-Panels darüber.
   ===================================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let W = null, artRaf = 0, started = false;
const fmt = n => Math.round(n).toLocaleString('de-DE');
const ROLE_COL = { tank: '#6fa3e0', dd: '#ef7d5e', heal: '#7fd17a' };

/* ---------- Ton ---------- */
let AC = null;
function ac() { if (G && !G.settings.sound) return null; if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
function tone(f, d = .1, type = 'square', vol = .04, slide = 0, delay = 0) { const a = ac(); if (!a) return; const t = a.currentTime + delay; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02); }
function noise(d = .1, vol = .06, freq = 1200) { const a = ac(); if (!a) return; const len = Math.floor(a.sampleRate * d), b = a.createBuffer(1, len, a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len); const s = a.createBufferSource(); s.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; const g = a.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(a.destination); s.start(); }
const lastSfx = {};
const SFX = {
  hit() { noise(.08, .06, 1400); tone(150, .08, 'square', .02, -70); }, crit() { noise(.16, .09, 2400); tone(260, .18, 'sawtooth', .035, -180); },
  swing() { noise(.09, .035, 3000); }, blunt() { noise(.12, .08, 500); tone(90, .1, 'square', .025, -30); }, bow() { tone(700, .05, 'triangle', .025, -300); noise(.05, .025, 4000); },
  cast() { tone(520, .2, 'sine', .03, 400); }, charge() { tone(300, .25, 'sine', .02, 300); }, shout() { tone(180, .25, 'sawtooth', .03, 60); },
  heal() { tone(520, .15, 'sine', .035, 220); tone(780, .2, 'sine', .025, 220, .08); }, buff() { [392, 523, 659].forEach((f, i) => tone(f, .1, 'triangle', .03, 0, i * .06)); },
  miss() { tone(240, .12, 'sine', .025, -80); }, die() { tone(320, .4, 'sawtooth', .035, -250); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, .22, 'triangle', .04, 0, i * .12)); }, lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, .3, 'sine', .045, 0, i * .18)); },
  ult() { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, .25, 'sawtooth', .025, 0, i * .05)); }, level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, 'triangle', .045, 0, i * .09)); },
  click() { tone(480, .04, 'triangle', .02); }, loot() { [784, 988, 1318].forEach((f, i) => tone(f, .12, 'triangle', .035, 0, i * .07)); },
  join() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, .3, 'triangle', .04, 0, i * .1)); }, step() { }
};
function sfx(n) { try { const now = performance.now(); if (lastSfx[n] && now - lastSfx[n] < 40) return; lastSfx[n] = now; SFX[n] && SFX[n](); } catch (e) { } }

/* ---------- Musik (selbst erzeugt) ---------- */
const MUSIC = (() => {
  let timer = 0, next = 0, step = 0, bus = null, mode = 'explore';
  const CH = { explore: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]], battle: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], boss: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]] };
  const BPM = { explore: 72, battle: 100, boss: 116 };
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  function out() {
    const a = ac(); if (!a) return null;
    if (!bus) { bus = a.createGain(); bus.gain.value = .5; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; const dl = a.createDelay(); dl.delayTime.value = .32; const fb = a.createGain(); fb.gain.value = .28; bus.connect(lp); lp.connect(a.destination); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(a.destination); }
    return a;
  }
  function note(a, freq, t, d, type, vol, att = .02) { const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(bus); o.start(t); o.stop(t + d + .05); }
  function drum(a, t, low, vol) { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(low ? 90 : 160, t); o.frequency.exponentialRampToValueAtTime(low ? 40 : 70, t + .2); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3); o.connect(g).connect(bus); o.start(t); o.stop(t + .35); }
  function schedule() {
    const a = out(); if (!a) return;
    if (next < a.currentTime) next = a.currentTime + .05;
    while (next < a.currentTime + .4) {
      const spb = 60 / BPM[mode] / 2, bar = Math.floor(step / 8) % 4, beat = step % 8, chord = CH[mode][bar], t = next;
      if (beat === 0) { chord.forEach(m => note(a, f(m + 12), t, spb * 8.5, 'triangle', .016, .5)); note(a, f(chord[0] - 12), t, spb * 7, 'sine', .05, .05); }
      if (mode === 'explore') { if (beat % 2 === 0) note(a, f(chord[(beat / 2) % 3] + 24), t, spb * 2.2, 'sine', .014); }
      else { const arp = [0, 1, 2, 1, 0, 2, 1, 2][beat]; note(a, f(chord[arp] + 24), t, spb * 1.2, 'triangle', .013); if (beat % 2 === 0) note(a, f(chord[0] - (mode === 'boss' ? 12 : 0)), t, spb * 1.5, 'sine', .03); }
      if (mode === 'battle' && (beat === 0 || beat === 4)) drum(a, t, 1, .12);
      if (mode === 'boss') { if (beat % 2 === 0) drum(a, t, 1, beat === 0 ? .2 : .12); if (beat === 3 || beat === 7) drum(a, t, 0, .07); }
      next += spb; step++;
    }
  }
  return {
    sync() { const on = G && G.settings.music !== false && started; if (on && !timer) { timer = setInterval(() => { const m = !W ? 'explore' : W.fighting ? (W.enemies.some(e => e.boss && alive(e)) ? 'boss' : 'battle') : 'explore'; if (m !== mode && step % 8 === 0) mode = m; schedule(); }, 100); } if (!on && timer) { clearInterval(timer); timer = 0; } }
  };
})();

/* ---------- Kleine Helfer ---------- */
function toast(html, cls = '') { const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200); }
function heroCol(k) { return ROLE_COL[roleOf(k)]; }
function stars(n) { return '<span class="stars">' + [0, 1, 2].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('') + '</span>'; }
function paintCards(root = document) {
  requestAnimationFrame(() => {
    root.querySelectorAll('canvas[data-card]').forEach(c => {
      const k = c.dataset.card;
      if (c.dataset.enemy) { const E = ENEMIES[k]; RIG.card(c, E.type, Object.assign({ wpn: E.wpn }, E.look), { col: '#ff5a3a', flip: 1, seed: k, bust: E.type === 'hum' && !!c.dataset.bust, zoom: +(c.dataset.zoom || 1) }); return; }
      const LK = c.dataset.stage !== undefined ? lookAtStage(k, +c.dataset.stage) : G.heroes[k] ? heroLook(k) : lookAtStage(k, 0);
      RIG.card(c, 'hum', LK, { col: ROLE_COL[CLASSES[HEROES[k].cls].role], bust: !!c.dataset.bust, seed: k, zoom: +(c.dataset.zoom || 1) });
    });
    root.querySelectorAll('canvas[data-ic]').forEach(c => RIG.icon(c, c.dataset.ic, c.dataset.c, c.dataset.r !== undefined ? +c.dataset.r : 2));
  });
}
const icHtml = it => `<canvas class="ic r${it.r}" data-ic="${it.icon}" data-c="${RARITY[it.r].c}" data-r="${it.r}" style="--rc:${RARITY[it.r].c}"></canvas>`;

/* ---------- HUD ---------- */
function buildHud() {
  $('#party').innerHTML = G.party.map(k => `<div class="pc" data-k="${k}" style="--rc:${heroCol(k)}"><canvas data-card="${k}" data-bust="1"></canvas><div class="hpv"></div><span class="pl">${G.heroes[k].lvl}</span><div class="ultbar"><i></i></div></div>`).join('');
  $$('#party .pc').forEach(el => el.onclick = () => { if (W.manualUlt(el.dataset.k)) { sfx('ult'); return; } sfx('click'); openHero(el.dataset.k); });
  paintCards($('#party'));
}
function updateHud() {
  if (!W || !G) return;
  const ch = STORY[G.story.ch];
  $('#chapPart').textContent = ch.part + (G.story.loop ? ` · Heldenreise ${G.story.loop + 1}` : '');
  $('#chapName').textContent = `${G.story.ch + 1}. ${ch.n}`;
  const w = G.story.wave;
  $('#pips').innerHTML = Array.from({ length: WAVES }, (_, i) => `<i class="${i < w ? 'done' : i === w ? 'cur' : ''} ${isEliteWave(i) ? 'el' : ''}"></i>`).join('') + `<b class="${w >= WAVES ? 'cur' : ''}">✦</b>`;
  $('#farm').hidden = !(G.story.farm && w >= WAVES);
  const bn = activeBonds().length, mods = activeMods();
  const syn = activeFactions().filter(f => f.tier >= 0).map(f => `<span style="--fc:${f.F.c}" title="${esc(f.F.n)}: ${esc(f.F.t[f.tier][2])}">${f.F.ic}<b>${f.n}</b></span>`).join('') + (bn ? `<span style="--fc:#ff8aa8" title="Heldenbande">♥<b>${bn}</b></span>` : '') + (mods.length ? `<span style="--fc:#ff6a4a" title="${esc(mods.map(m => m.d).join(', '))}">☠<b>${mods.length}</b></span>` : '');
  if ($('#syn').dataset.v !== syn) { $('#syn').innerHTML = syn; $('#syn').dataset.v = syn; }
  const cs = chestState(); $('#chestFill').style.height = (cs.n / CHEST_MAX * 100) + '%'; $('#chest').classList.toggle('ready', cs.ready); $('#chestT').textContent = cs.n + '/' + CHEST_MAX;
  const qc = questsClaimable(); $('#qBadge').hidden = !qc; $('#qBadge').textContent = qc;
  $('#gold').textContent = fmt(G.gold); $('#mith').textContent = fmt(G.mithril);
  $('#power').textContent = fmt(G.party.reduce((a, k) => a + heroStats(k).power, 0));
  const cc = claimableCount(); $('#achBadge').hidden = !cc; $('#achBadge').textContent = cc;
  if (!updateHud.t || Date.now() - updateHud.t > 1000) { updateHud.t = Date.now(); refreshLooks(); const ev = owned().filter(k => canEvolve(k)?.ok).length; $('#hBadge').hidden = !ev; $('#hBadge').textContent = ev; }
  for (const u of W.heroes) {
    const el = document.querySelector(`#party .pc[data-k="${u.key}"]`); if (!el) continue;
    el.querySelector('.ultbar i').style.width = Math.min(100, u.energy) + '%';
    el.classList.toggle('ready', u.energy >= 100 && alive(u)); el.classList.toggle('dead', !alive(u)); el.classList.toggle('act', W.active === u);
    el.querySelector('.hpv').style.height = (100 - u.hp / u.maxHp * 100) + '%';
    el.querySelector('.pl').textContent = G.heroes[u.key]?.lvl || '';
  }
  const boss = W.enemies.find(e => e.boss && alive(e)), bb = $('#bossbar');
  bb.hidden = !boss || !W.fighting;
  if (boss) { $('#bossName').textContent = boss.name; $('#bossFill').style.width = (boss.hp / boss.maxHp * 100) + '%'; }
}
let bannerT = 0;
function comboFx(n) { const c = $('#combo'); c.innerHTML = `<small>Gemeinschafts-Kombo</small>×${n}`; c.className = 'show'; clearTimeout(comboFx.t); comboFx.t = setTimeout(() => c.className = '', 1600); G.stats.maxCombo = Math.max(G.stats.maxCombo, n); if (n === 2) track('combos', 1); sfx('ult'); }
function banner(txt, cls) { const b = $('#banner'); b.textContent = txt; b.className = 'show ' + (cls || ''); clearTimeout(bannerT); bannerT = setTimeout(() => b.className = '', cls === 'ult' ? 1400 : 900); }
/* Ausrüstungs-Vorschläge: neue bessere Teile direkt anlegen (oder Bestätigung, wenn automatisch angelegt) */
function gearCard(k, it, d, done) {
  const box = $('#gsug'); if (!box || !G.heroes[k]) return; while (box.children.length >= 2) box.firstChild.remove();
  const H = HEROES[k], e = document.createElement('div'); e.className = 'gsg' + (done ? ' done' : '') + (it.r >= 4 ? ' leg' : ''); e.style.setProperty('--rc', RARITY[it.r].c);
  e.innerHTML = `<canvas class="gsg-h" data-card="${k}" data-bust="1"></canvas><div class="gsg-t"><small>${done ? '✓ Angelegt' : 'Besser für'} · ${esc(H.n)}</small><div class="gsg-i">${icHtml(it)}<b>${esc(it.name)}</b></div><span class="pos">+${fmt(d)} ⚡ Kampfkraft</span></div>${done ? '<button class="btn small gsg-v">Team</button>' : '<button class="btn small gold gsg-a">Anlegen</button>'}<button class="gsg-x" aria-label="Schließen">✕</button>`;
  box.appendChild(e); paintCards(e); sfx(it.r >= 3 ? 'loot' : 'click');
  const kill = () => { e.classList.add('out'); setTimeout(() => e.remove(), 300); };
  const t = setTimeout(kill, done ? 5000 : 9000);
  e.querySelector('.gsg-x').onclick = ev => { ev.stopPropagation(); clearTimeout(t); kill(); };
  const a = e.querySelector('.gsg-a'); if (a) a.onclick = () => { clearTimeout(t); if (G.inv.includes(it)) { equip(k, it); W.pendingParty = 1; refreshLooks(); sfx('level'); toast(`${esc(H.n)}: <b style="color:${RARITY[it.r].c}">${esc(it.name)}</b> angelegt`, 'lvl'); } kill(); };
  const v = e.querySelector('.gsg-v'); if (v) v.onclick = () => { clearTimeout(t); kill(); openHeroes('team'); };
}
function suggestGear(items) {
  const auto = autoEquip.last || []; autoEquip.last = [];
  if (G.settings.autoEquip) { auto.filter(x => x.d > 0).sort((a, b) => b.d - a.d).slice(0, 2).forEach((x, i) => setTimeout(() => gearCard(x.k, x.it, x.d, true), 700 + i * 500)); return; }
  const sug = []; for (const it of items || []) { const b = bestHeroFor(it); if (b) sug.push([b.k, it, b.d]); }
  sug.sort((a, b) => b[2] - a[2]).slice(0, 2).forEach(([k, it, d], i) => setTimeout(() => gearCard(k, it, d, false), 700 + i * 500));
}
function lootPop(items, gold) {
  const box = $('#loot');
  if (gold) { const e = document.createElement('div'); e.className = 'lp gold'; e.textContent = `+${fmt(gold)} ◆`; box.appendChild(e); setTimeout(() => e.remove(), 2200); }
  items.forEach((it, i) => setTimeout(() => { const e = document.createElement('div'); e.className = 'lp'; e.style.setProperty('--rc', RARITY[it.r].c); e.innerHTML = `${icHtml(it)}<span>${esc(it.name)}</span>`; box.appendChild(e); paintCards(e); if (it.r >= 3) sfx('loot'); setTimeout(() => e.remove(), 2600); }, 250 + i * 300));
}

/* ---------- Dialoge & Splashes ---------- */
function speakerInfo(s) {
  if (s === 'narr') return { name: 'Erzähler', art: '<div class="narr-ic">❦</div>' };
  if (s.startsWith('e:')) { const k = s.slice(2); return { name: ENEMIES[k].n, art: `<canvas data-card="${k}" data-enemy="1" data-bust="1"></canvas>`, foe: 1 }; }
  return { name: HEROES[s].n, art: `<canvas data-card="${s}" data-bust="1"></canvas>`, col: ROLE_COL[CLASSES[HEROES[s].cls].role] };
}
function dialog(lines) {
  if (!lines || !lines.length) return Promise.resolve();
  return new Promise(res => {
    W.hold = true; const box = $('#dialog'); let i = 0, typing = null;
    const show = () => {
      const [s, txt] = lines[i], inf = speakerInfo(s);
      box.className = 'dlg ' + (inf.foe ? 'foe' : s === 'narr' ? 'narr' : '');
      box.innerHTML = `<div class="dport" style="--rc:${inf.col || '#ff5a3a'}">${inf.art}</div><div class="dbody"><div class="dname">${esc(inf.name)}</div><p class="dtext"></p><div class="dhint">Tippen zum Fortfahren</div></div><button class="dskip">Überspringen ›</button>`;
      box.hidden = false; paintCards(box);
      const p = box.querySelector('.dtext'); let n = 0; clearInterval(typing);
      typing = setInterval(() => { n += 2; p.textContent = txt.slice(0, n); if (n >= txt.length) { clearInterval(typing); typing = null; } }, 18);
      box.querySelector('.dskip').onclick = e => { e.stopPropagation(); done(); };
      box.onclick = () => { if (typing) { clearInterval(typing); typing = null; p.textContent = txt; return; } sfx('click'); i++; if (i >= lines.length) done(); else show(); };
    };
    const done = () => { clearInterval(typing); box.hidden = true; box.onclick = null; W.hold = false; res(); };
    show();
  });
}
function splash(html, ms = 0, cls = '') {
  return new Promise(res => {
    const s = $('#splash'); s.className = 'splash ' + cls; s.innerHTML = html; s.hidden = false; paintCards(s); paintComps(s);
    W.hold = true;
    const close = () => { s.classList.add('out'); setTimeout(() => { s.hidden = true; s.classList.remove('out'); W.hold = false; res(); }, 300); };
    if (ms) setTimeout(close, ms); else { s.onclick = () => { s.onclick = null; sfx('click'); close(); }; }
  });
}
/* Drei verdeckte Truhen: eine wählen, danach werden alle aufgedeckt */
function pickChest(title, mith) {
  const lv = chapterLvl() + 2, opts = [
    { k: 'item', it: genItem(lv, Math.random() < .35 ? 4 : 3) },
    { k: 'mith', v: Math.round(mith * 2.5) },
    { k: 'gold', v: Math.round(300 + lv * 90), it: genItem(lv, 2) }
  ].sort(() => Math.random() - .5);
  const show = o => o.k === 'item' ? `${icHtml(o.it)}<b style="color:${RARITY[o.it.r].c}">${esc(o.it.name)}</b>` : o.k === 'mith' ? `<span class="pk-big">✧ ${o.v}</span><b>Mithril</b>` : `<span class="pk-big">◆ ${fmt(o.v)}</span><b>Gold + ${esc(o.it.name)}</b>`;
  return new Promise(res => {
    const s = $('#splash'); s.className = 'splash doneS'; s.hidden = false; W.hold = true; s.onclick = null;
    s.innerHTML = `<div class="cdone pick"><div class="kicker">Kapitel abgeschlossen · ✧ ${mith} Mithril</div><h1>${esc(title)}</h1><p>Wähle eine der drei Truhen!</p><div class="pk">${opts.map((o, i) => `<button class="pkc" data-i="${i}"><span class="pk-lid">?</span><div class="pk-in">${show(o)}</div></button>`).join('')}</div><div class="dhint" hidden>Tippen zum Fortfahren</div></div>`;
    paintCards(s);
    s.querySelectorAll('.pkc').forEach(b => b.onclick = e => {
      e.stopPropagation(); if (s.querySelector('.pkc.open')) return;
      const o = opts[+b.dataset.i]; sfx('join');
      if (o.k === 'mith') G.mithril += o.v; if (o.k === 'gold') { G.gold += o.v; addItem(o.it); } if (o.k === 'item') addItem(o.it);
      if (G.settings.autoEquip) autoEquip(); save(); updateHud();
      b.classList.add('open', 'mine'); setTimeout(() => s.querySelectorAll('.pkc').forEach(x => x.classList.add('open')), 650);
      setTimeout(() => { s.querySelector('.dhint').hidden = false; s.onclick = () => { s.onclick = null; s.classList.add('out'); setTimeout(() => { s.hidden = true; s.classList.remove('out'); W.hold = false; res(); }, 300); }; }, 900);
    });
  });
}
function chapterTitle(ch) { return splash(`<div class="ctitle"><div class="kicker">${esc(ch.part)}</div><h1>Kapitel ${G.story.ch + 1}</h1><h2>${esc(ch.n)}</h2></div>`, 2300, 'chap'); }
function kitLines(k) { const H = HEROES[k]; return `<li><b class="k-ult">Ultimate</b> ${esc(H.ult.n)}</li><li><b class="k-act">Aktiv</b> ${esc(H.act.n)}</li><li><b class="k-act2">Aktiv II</b> ${esc(H.act2.n)}</li>`; }
function joinSplash(k, back) {
  sfx('join'); const H = HEROES[k], C = CLASSES[H.cls];
  return splash(`<div class="join" style="--rc:${heroCol(k)}"><canvas class="jart" data-card="${k}" data-zoom="1.05"></canvas><div class="jinfo"><div class="kicker">${back ? 'Kehrt zurück' : 'Neuer Gefährte'}</div><h1>${esc(H.n)}</h1><h3>${esc(heroTitle(k))}</h3><div class="chips"><span class="role r-${C.role}">${ROLES[C.role].n}</span><span>${esc(C.n)} · ${esc(C.sub)}</span></div><ul class="kit">${kitLines(k)}</ul><div class="dhint">Tippen zum Fortfahren</div></div></div>`, 0, 'joinS');
}
function bossSplash(key) {
  sfx('crit'); const E = ENEMIES[key];
  return splash(`<div class="bossS"><canvas class="bart" data-card="${key}" data-enemy="1" data-zoom="${ENEMIES[key].type === 'hum' && !RIG.dims('hum', ENEMIES[key].look).big ? 1.1 : .85}"></canvas><div class="binfo"><div class="kicker">Boss</div><h1>${esc(E.n)}</h1></div></div>`, 2200, 'bossSp');
}

/* ---------- Story-Regie ---------- */
function applyParty() {
  G.party = G.party.filter(k => G.heroes[k] && !G.away[k]);
  if (G.settings.autoParty || !G.party.length) autoParty();
  W.setParty(G.party); buildHud();
}
function onResult(r, kind) {
  if (r.aborted) return;
  const party = G.party.slice();
  if (r.win) {
    G.stats.wins++; addChest(kind === 'boss' ? 3 : 1);
    const rw = battleReward(kind, r.enemies.filter(e => e.xp));
    if (kind === 'boss' && r.setCh !== undefined) { const S2 = chapterSet(r.setCh); if (S2 && Math.random() < .6) rw.items.push(genSetItem(S2, r.enemies.reduce((a, e) => Math.max(a, e.lvl), 1))); }
    const lvBefore = Object.fromEntries(owned().map(k => [k, G.heroes[k].lvl]));
    autoEquip.last = []; const res = applyReward(rw, party); suggestGear(rw.items);
    lootPop(rw.items, rw.gold); if (rw.mithril) toast(`+${rw.mithril} ✧ Mithril`, 'mini');
    const r0 = Object.values(res)[0];
    if (r0 && r0.ups) {
      const a = r0.from, b = G.team.lvl; sfx('level'); toast(`Gruppenstufe <b>${b}</b>! Alle Helden werden stärker.`, 'lvl');
      for (const k of party) { const H = HEROES[k]; if (a < ACT2_LVL && b >= ACT2_LVL) toast(`${esc(H.n)}: neue Fähigkeit <b>${esc(H.act2.n)}</b>`, 'unlock'); H.pas.forEach(ps => { if (ps.lvl > 1 && a < ps.lvl && b >= ps.lvl) toast(`${esc(H.n)}: Passiv <b>${esc(ps.n)}</b>`, 'unlock'); }); }
      if (STAGE_CAP.slice(0, 2).some(c2 => a < c2 && b >= c2)) toast('Neue Entwicklungsstufe möglich! Entwickle deine Helden im Heldenmenü.', 'unlock');
    }
  } else {
    const xp = Math.round(r.enemies.filter(e => !alive(e) && e.xp).reduce((a, e) => a + e.xp, 0) * .4);
    applyReward({ xp, gold: 0, items: [], mithril: 0 }, party);
  }
  checkFullSet(); save(); updateHud();
}
async function bossRematch(ch) {
  const C = STORY[ch], prevBg = W.bgKey; G.queue = null; save();
  W.setBg(C.bg); await splash(`<div class="ctitle"><div class="kicker">Erneuter Bosskampf</div><h1>Kapitel ${ch + 1}</h1><h2>${esc(C.n)}</h2></div>`, 1600, 'chap');
  applyParty(); await W.walk(1000);
  const lvl = C.lvl + 3 + G.story.loop * LOOP_LVL, r = await W.fight(C.boss, lvl, 'boss'); r.setCh = ch;
  onResult(r, 'boss'); if (r.win) { G.stats.bosses++; track('bosses', 1); } else toast('Der Boss war zu stark. Werdet stärker und versucht es erneut.', 'unlock');
  W.setBg(prevBg);
}
async function sideRun(id) {
  const sd = SIDE.find(x => x.id === id), prevBg = W.bgKey, first = !G.side[id]; G.queue = null; save();
  W.setBg(sd.bg); await splash(`<div class="ctitle"><div class="kicker">Nebenquest</div><h1>${first ? 'Neu' : 'Wiederholung'}</h1><h2>${esc(sd.n)}</h2></div>`, 1800, 'chap');
  if (first) await dialog(sd.intro);
  const lvl = sideLvl(sd);
  for (let i = 0; i < sd.waves.length; i++) {
    applyParty(); await W.walk(1100);
    const r = await W.fight(sd.waves[i], lvl + Math.floor(i / 2), 'normal'); onResult(r, 'normal');
    if (!r.win) { toast(`${esc(sd.n)}: Die Gruppe musste sich zurückziehen.`, 'unlock'); W.setBg(prevBg); return; }
  }
  applyParty(); await W.walk(1000);
  const bk = sd.boss.find(k => ENEMIES[k].boss) || sd.boss[0]; await bossSplash(bk);
  const r = await W.fight(sd.boss, lvl + 2, 'boss'); onResult(r, 'boss');
  if (r.win) {
    G.stats.bosses++; track('bosses', 1);
    if (first) {
      G.side[id] = 1; G.stats.sides = Object.keys(G.side).length;
      await dialog(sd.outro);
      if (sd.hero) { joinHero(sd.hero); applyParty(); await joinSplash(sd.hero); }
      if (sd.comp) { const cp = grantCompanion(sd.comp); if (cp) await companionSplash(cp); }
      if (sd.legend) { const li = LEGENDARIES.findIndex(l => l.n === sd.legend); const it = genItem(lvl + 2, 4, { leg: li }); addItem(it); if (G.settings.autoEquip) autoEquip(); await splash(`<div class="cdone"><div class="kicker">Legendärer Fund</div><div class="loot1">${icHtml(it)}<b style="color:${RARITY[4].c}">${esc(it.name)}</b></div><p>${esc(it.passive || '')}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      G.mithril += 40; toast('Nebenquest abgeschlossen: +40 ✧', 'lvl');
    } else G.side[id]++;
    save();
  } else toast(`${esc(sd.n)}: Der Boss war zu stark.`, 'unlock');
  W.setBg(prevBg);
}
/* ---------- Spezialmodi (beliebig oft, ohne Zeitsperren) ---------- */
const MODES = [
  { id: 'horde', n: 'Endloser Ansturm', ic: '∞', d: 'Welle um Welle, ohne Heilung dazwischen. Wie weit kommt deine Gruppe?' },
  { id: 'rush', n: 'Bossrausch', ic: '♛', d: 'Fünf bereits besiegte Bosse hintereinander. Zwischen den Kämpfen nur 30 % Heilung.' },
  { id: 'chaos', n: 'Chaos-Prüfung', ic: '✷', d: 'Fünf Kämpfe, jeder mit einer verrückten Regel: Blitztempo, Glaskanonen, Kritsturm …' }
];
const CHAOS = [['schnell', 'Blitztempo: alle sind 70 % schneller'], ['glas', 'Glaskanonen: doppelter Schaden, 40 % weniger Leben'], ['energie', 'Volle Kraft: alle Ultimates sofort bereit'], ['krit', 'Kritsturm: +45 % Krit-Chance für alle'], ['riesen', 'Riesenwuchs: Gegner mit 80 % mehr Leben']];
function modeUnlocked() { return G.story.ch >= 3 || G.story.loop > 0; }
function modePool() { const last = G.story.loop ? STORY.length : Math.max(1, G.story.ch); const waves = [], bosses = []; for (let i = 0; i < last; i++) { (STORY[i].waves || []).forEach(w => waves.push(w)); bosses.push(i); } return { waves, bosses }; }
function healParty(pct) { for (const h of W.heroes) { if (h.hp > 0) h.hp = Math.min(h.maxHp, Math.round(h.hp + h.maxHp * pct)); } }
async function modeRun(id) {
  const M = MODES.find(m => m.id === id), prevBg = W.bgKey, pool = modePool(); G.queue = null; G.modes = G.modes || {}; save();
  await splash(`<div class="ctitle"><div class="kicker">Spezialmodus</div><h1>${M.ic} ${esc(M.n)}</h1><h2>${esc(M.d)}</h2></div>`, 2200, 'chap');
  applyParty(); W.restoreHeroes();
  let n = 0, gold = 0, mith = 0; const items = [], base = Math.max(1, chapterLvl() - 2);
  if (id === 'horde') {
    for (;;) {
      const grp = pool.waves[Math.floor(Math.random() * pool.waves.length)], lvl = base + Math.floor(n / 2);
      if (n % 5 === 0) W.setBg(STORY[pool.bosses[Math.floor(Math.random() * pool.bosses.length)]].bg);
      banner(`Welle ${n + 1}`, 'ult'); await W.walk(700);
      const r = await W.fight(n % 5 === 4 ? [...grp, ...grp].slice(0, 5) : grp, lvl, n % 5 === 4 ? 'elite' : 'normal', { keepHp: 1 }); onResult(r, 'normal');
      if (!r.win) break; n++; healParty(.08);
      if (n % 5 === 0) { mith += 10 + n; items.push(genItem(lvl + 1, rollRarity('elite'))); toast(`Welle ${n} geschafft! Bonus gesichert.`, 'lvl'); }
    }
    gold = n * (60 + base * 12);
  } else if (id === 'rush') {
    const order = pool.bosses.slice().sort(() => Math.random() - .5).slice(0, 5);
    for (const ci of order) {
      const C = STORY[ci]; W.setBg(C.bg); await W.walk(700); const bk = C.boss.find(k => ENEMIES[k].boss) || C.boss[0]; await bossSplash(bk);
      const r = await W.fight(C.boss, base + 2 + n, 'boss', { keepHp: 1 }); r.setCh = ci; onResult(r, 'boss');
      if (!r.win) break; n++; healParty(.3); mith += 12;
    }
    if (n >= 5) { items.push(genItem(base + 6, Math.random() < .5 ? 4 : 3)); mith += 40; }
    gold = n * (180 + base * 25);
  } else {
    const rules = CHAOS.slice().sort(() => Math.random() - .5);
    for (let i = 0; i < 5; i++) {
      const [rid, rd] = rules[i % rules.length], grp = pool.waves[Math.floor(Math.random() * pool.waves.length)];
      await splash(`<div class="ctitle"><div class="kicker">Chaos-Regel ${i + 1}/5</div><h1>✷</h1><h2>${esc(rd)}</h2></div>`, 1700, 'chap');
      applyParty(); await W.walk(600); const r = await W.fight(grp, base + 1 + i, i === 4 ? 'elite' : 'normal', { chaos: rid }); onResult(r, 'normal');
      if (!r.win) break; n++; mith += 6;
    }
    if (n >= 5) { items.push(genItem(base + 4, rollRarity('boss'))); mith += 25; }
    gold = n * (90 + base * 15);
  }
  const best = G.modes[id] || 0, rec = n > best; G.modes[id] = Math.max(best, n);
  G.gold += gold; G.mithril += mith; items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save(); applyParty(); W.restoreHeroes();
  const unit = id === 'horde' ? 'Wellen' : id === 'rush' ? 'Bosse' : 'Kämpfe';
  await splash(`<div class="cdone"><div class="kicker">${esc(M.n)} beendet</div><h1>${n} ${unit}</h1><p>${rec ? '<b>Neuer Rekord!</b> ' : `Rekord: ${G.modes[id]} · `}◆ ${fmt(gold)} · ✧ ${mith}${items.length ? ' · ' + items.length + ' Gegenstände' : ''}</p>${items.length ? `<div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div>` : ''}<div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  W.setBg(prevBg); updateHud();
}
async function raidRun(key) {
  const R = RAIDS.find(x => x.key === key), prevBg = W.bgKey; G.queue = null; save();
  W.setBg(R.bg); await splash(`<div class="ctitle"><div class="kicker">Prüfung der Macht</div><h1>45 Sekunden</h1><h2>${esc(R.n)}</h2></div>`, 1800, 'chap');
  applyParty(); await W.walk(800);
  const r = await W.fight([key], raidLvl(), 'boss', { raid: 1, time: 45000 });
  const st = G.raid[key] || (G.raid[key] = { best: 0, tiers: 0 }), pct = r.dmgPct;
  const tier = RAID_TIERS.filter(t => pct >= t).length, first = tier > st.tiers;
  st.best = Math.max(st.best, pct); if (first) st.tiers = tier;
  const rw = raidRewards(pct, first), items = []; for (let i = 0; i < rw.items; i++) items.push(genItem(raidLvl(), rollRarity(tier >= 5 ? 'boss' : 'elite')));
  G.gold += rw.gold; G.mithril += rw.mithril; items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save();
  await splash(`<div class="cdone"><div class="kicker">Prüfung beendet</div><h1>${Math.round(pct * 100)} % Schaden</h1><p>${first ? '<b>Neue Bestmarke!</b> ' : ''}Stufe ${tier} von ${RAID_TIERS.length} · ◆ ${fmt(rw.gold)} · ✧ ${rw.mithril} · ${items.length} Gegenstände</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  W.setBg(prevBg); updateHud();
}
function companionSplash(cp) {
  sfx('join');
  return splash(`<div class="cdone"><div class="kicker">Neuer Begleiter</div><canvas class="compart" data-comp="${cp.id}"></canvas><h1>${esc(cp.n)}</h1><p>${esc(cp.d)}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
}
async function towerRun() {
  const f = towerFloor(), tg = towerGroup(f), prevBg = W.bgKey;
  G.tower.queued = false; save();
  W.setBg('helm'); await splash(`<div class="ctitle"><div class="kicker">Orthanc-Turm</div><h1>Etage</h1><h2>${f}</h2></div>`, 1800, 'chap');
  applyParty(); await W.walk(1000);
  const r = await W.fight(tg.group, towerLvl(f), tg.kind);
  if (r.win) {
    G.tower.best = f; G.stats.towerBest = Math.max(G.stats.towerBest, f); track('tower', 1);
    const tr = towerReward(f); onResult(r, tg.kind); G.gold += tr.gold; G.mithril += tr.mithril;
    toast(`Orthanc-Turm Etage ${f} bezwungen: +${fmt(tr.gold)} ◆ +${tr.mithril} ✧`, 'lvl'); save();
  } else { onResult(r, tg.kind); toast(`Etage ${f} war zu stark. Werdet stärker und versucht es erneut.`, 'unlock'); }
  W.setBg(prevBg);
}
async function director() {
  while (true) {
    const ch = STORY[G.story.ch]; W.setBg(ch.bg);
    if (!G.story.intro) {
      await W.wait(400); await chapterTitle(ch);
      if (ch.back) for (const k of ch.back) { delete G.away[k]; const hs = G.heroes[k]; if (hs) { hs.stage = Math.max(hs.stage, 2); hs.lvl = Math.max(hs.lvl, ...G.party.map(x => G.heroes[x].lvl)); } }
      await dialog(ch.intro);
      for (const k of ch.join || []) { joinHero(k); applyParty(); await joinSplash(k); }
      if (ch.back) for (const k of ch.back) { applyParty(); await joinSplash(k, 1); }
      applyParty(); G.story.intro = true; save();
    }
    const w = G.story.wave, mk = G.story.ch + '-' + w;
    if (G.tower.queued) { running = 'Orthanc-Turm'; try { await towerRun(); } finally { running = null; } continue; }
    if (G.queue) { const q = G.queue; running = { boss: 'Bosskampf', side: 'Nebenquest', raid: 'Prüfung der Macht', mode: 'Spezialmodus' }[q.type] || 'Herausforderung'; try { if (q.type === 'boss') await bossRematch(q.ch); else if (q.type === 'side') await sideRun(q.id); else if (q.type === 'raid') await raidRun(q.key); else if (q.type === 'mode') await modeRun(q.id); else G.queue = null; } finally { running = null; } continue; }
    if (w < WAVES) {
      if ((ch.mid?.[w] || ch.midLine?.[w]) && !G.story.mids[mk]) {
        await dialog(ch.midLine?.[w]); for (const k of ch.mid?.[w] || []) { joinHero(k); applyParty(); await joinSplash(k); }
        G.story.mids[mk] = 1; save();
      }
      applyParty(); await W.walk(1500);
      const kind = isEliteWave(w) ? 'elite' : 'normal';
      const r = await W.fight(chapterWaves()[w], waveLvl(w), kind);
      if (r.aborted) continue;
      onResult(r, kind);
      if (r.win) { G.story.wave++; track('wins', 1); } else { G.story.wave = Math.max(0, w - 1); banner('Rückzug! Die Gruppe sammelt sich.', 'foe'); }
      save(); continue;
    }
    if (G.story.farm) {
      applyParty(); await W.walk(1500);
      const r = await W.fight(chapterWaves()[WAVES - 1], waveLvl(WAVES - 1), 'normal'); if (!r.aborted) onResult(r, 'normal'); continue;
    }
    if (!G.story.bossSeen) { await dialog(ch.bossLine); G.story.bossSeen = true; save(); }
    applyParty(); await W.walk(1200);
    const bk = ch.boss.find(k => ENEMIES[k].boss) || ch.boss[0]; await bossSplash(bk);
    const r = await W.fight(ch.boss, waveLvl(WAVES) + 1, 'boss'); r.setCh = G.story.ch;
    if (r.aborted) continue;
    onResult(r, 'boss');
    if (r.win) {
      G.stats.bosses++; track('bosses', 1); await W.wait(400);
      await dialog(ch.outro);
      for (const k of ch.end || []) { joinHero(k); applyParty(); await joinSplash(k); }
      for (const k of ch.away || []) { G.away[k] = 1; toast(`${esc(HEROES[k].n)} hat die Gruppe verlassen …`, 'unlock'); }
      const relic = G.story.loop === 0 ? grantRelic(G.story.ch) : null;
      if (relic) { W.pendingParty = 1; await splash(`<div class="cdone relic"><div class="kicker">Relikt gefunden</div><canvas class="ric" data-ic="${relic.ic}" data-c="${relic.c}"></canvas><h1>${esc(relic.n)}</h1><p>Dauerhafter Gruppenbonus: <b>${esc(relic.d)}</b></p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      const cp = chapterCompanion(G.story.ch); if (cp && !G.comps[cp.id]) { grantCompanion(cp.id); W.pendingParty = 1; await companionSplash(cp); }
      G.stats.chapters = Math.max(G.stats.chapters, G.story.ch + 1 + G.story.loop * STORY.length);
      const mith = 20 + G.story.ch * 4; G.mithril += mith;
      await pickChest(ch.n, mith);
      G.story.ch++; if (G.story.ch >= STORY.length) { G.story.ch = 0; G.story.loop++; G.stats.loops++; const m = activeMods(); await splash(`<div class="cdone"><div class="kicker">Heldenreise ${G.story.loop + 1}</div><h1>Die Reise beginnt von Neuem</h1><p>Stärkere Gegner, bessere Beute (+${G.story.loop * 25} % Gold & EP, seltenere Gegenstände).</p><p><b>Erschwernisse:</b> ${m.map(x => esc(x.d)).join(' · ')}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      Object.assign(G.story, { wave: 0, intro: false, bossSeen: false, farm: false }); applyParty(); save();
    } else { G.story.farm = true; save(); banner('Der Boss ist zu stark. Die Gruppe trainiert.', 'foe'); toast('Werdet stärker und fordert den Boss dann erneut heraus.', 'unlock'); }
  }
}

/* ---------- Menüs (Glas-Panel) ---------- */
/* ================= Menüs: ein Bildschirm, Tabs statt Scrollen, Blättern statt Listen ================= */
let running = null;
/* Sofort spielen: laufenden Kampf abbrechen (ohne Strafe) und direkt starten */
function playNow(q, label) {
  if (running) { toast(`Gerade läuft: ${esc(running)}`, 'mini'); return; }
  if (q.type === 'tower') G.tower.queued = true; else G.queue = q;
  save(); closeSheet(); sfx('join'); toast(`▶ ${esc(label)}`, 'lvl'); W.abort();
}
function refreshLooks() { for (const u of W.heroes) { const L = heroLook(u.key), sig = JSON.stringify(L.gear || null); if (u._gsig !== undefined && u._gsig !== sig && alive(u)) W.gearUp(u); u._gsig = sig; u.look = L; } }
function openSheet(title, html, after, o = {}) {
  cancelAnimationFrame(artRaf);
  const s = $('#sheet');
  const tabs = o.tabs ? `<div class="m-tabs">${o.tabs.map(([id, n, badge]) => `<button class="m-tab ${o.tab === id ? 'on' : ''}" data-tab="${id}">${n}${badge ? `<i>${badge}</i>` : ''}</button>`).join('')}</div>` : '';
  const pg = o.pages > 1 ? `<div class="m-pg"><button class="m-pb" data-pg="-1" ${o.page <= 0 ? 'disabled' : ''}>‹</button><span>${o.page + 1}/${o.pages}</span><button class="m-pb" data-pg="1" ${o.page >= o.pages - 1 ? 'disabled' : ''}>›</button></div>` : '';
  s.innerHTML = `<div class="sh-head"><h2>${title}</h2>${tabs}<div class="m-hr">${o.extra || ''}${pg}<button class="x" aria-label="Schließen">✕</button></div></div><div class="sh-body fit">${html}</div>`;
  s.hidden = false; requestAnimationFrame(() => s.classList.add('open')); document.body.classList.add('sheet-open');
  s.querySelector('.x').onclick = closeSheet;
  if (o.onTab) s.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { sfx('click'); o.onTab(b.dataset.tab); });
  if (o.onPage) s.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { sfx('click'); o.onPage(o.page + +b.dataset.pg); });
  paintCards(s); after && after(s);
  if (!s._swipe) { s._swipe = 1; let x0 = 0, y0 = 0, t0 = 0;
    s.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); });
    s.addEventListener('pointerup', e => { const dx = e.clientX - x0, dy = e.clientY - y0; if (Date.now() - t0 < 600 && Math.abs(dx) > 70 && Math.abs(dy) < 45 && !e.target.closest('canvas#map')) { const b = s.querySelector(`.m-pb[data-pg="${dx < 0 ? 1 : -1}"]:not(:disabled)`); if (b) b.click(); } });
  }
}
function closeSheet() { cancelAnimationFrame(artRaf); const s = $('#sheet'); s.classList.remove('open'); document.body.classList.remove('sheet-open'); setTimeout(() => { if (!s.classList.contains('open')) s.hidden = true; }, 260); }
const pages = (n, per) => Math.max(1, Math.ceil(n / per));
const clampPg = (p, n) => Math.max(0, Math.min(n - 1, p || 0));

/* ---------- Helden ---------- */
function heroCard(k, locked) {
  const H = HEROES[k], C = CLASSES[H.cls], hs = G.heroes[k];
  if (locked) { const ci = STORY.findIndex(c => [...(c.join || []), ...(c.end || []), ...Object.values(c.mid || {}).flat()].includes(k)), sd = SIDE.find(x => x.hero === k); return `<div class="hcard locked" style="--rc:${ROLE_COL[C.role]}"><canvas data-card="${k}" data-bust="1" data-stage="0"></canvas><div class="hc-info"><b>???</b><small>${ci >= 0 ? 'Kapitel ' + (ci + 1) : sd ? 'Nebenquest' : ''}</small></div></div>`; }
  return `<button class="hcard ${G.party.includes(k) ? 'in' : ''} ${G.away[k] ? 'away' : ''}" data-k="${k}" style="--rc:${ROLE_COL[C.role]}"><canvas data-card="${k}" data-bust="1"></canvas><span class="role-dot r-${C.role}"></span>${G.away[k] ? '<span class="tag">Fort</span>' : G.party.includes(k) ? '<span class="tag in">Gruppe</span>' : ''}<div class="hc-info"><b>${esc(H.n)}</b><span class="pw">⚡ ${fmt(heroStats(k).power)}</span><small>St. ${hs.lvl} ${stars(hs.stage)}</small></div></button>`;
}
/* ---------- Team: die fünf Eingesetzten mit ihrer Ausrüstung ---------- */
function teamView() {
  const aura = partyAura(), stats = G.party.map(k => [k, heroStats(k, aura)]), total = stats.reduce((a, [, st]) => a + st.power, 0);
  const facs = activeFactions().filter(f => f.tier >= 0).map(f => `<span class="fchip" style="--fc:${f.F.c}">${f.F.ic} ${esc(f.F.n)}</span>`).join('');
  const bonds = BONDS.filter(b => G.party.includes(b.a) && G.party.includes(b.b)).map(b => `<span class="fchip bond on">♥ ${esc(b.n)}</span>`).join('');
  const card = i => { const k = G.party[i]; if (!k) return `<button class="m-tc empty" data-gohero="1"><span>+</span><small>Platz frei</small></button>`;
    const H = HEROES[k], C = CLASSES[H.cls], hs = G.heroes[k], st = stats[i][1];
    return `<div class="m-tc" style="--rc:${ROLE_COL[C.role]}"><button class="m-tart" data-hero="${k}"><canvas data-card="${k}" data-zoom="1.08"></canvas><span class="role-dot r-${C.role}"></span><span class="m-tstar">${stars(hs.stage)}</span></button><b>${esc(H.n)}</b><span class="pw">⚡ ${fmt(st.power)}</span>
      <div class="m-slots">${Object.keys(SLOTS).map(sl => { const it = hs.eq[sl] && itemById(hs.eq[sl]); return `<button class="m-slot ${it ? 'r' + it.r : 'none'}" data-slot="${k}|${sl}" style="--rc:${it ? RARITY[it.r].c : '#3a444e'}" title="${SLOTS[sl]}">${it ? icHtml(it) : '<div class="ic empty"></div>'}${it && it.enh ? `<em>+${it.enh}</em>` : ''}${upgradeFor(k, sl) ? '<i class="up">▲</i>' : ''}</button>`; }).join('')}</div></div>`; };
  return `<div class="m-team"><div class="m-tsum"><div class="m-tl"><small>Gruppenstufe</small><b>${G.team.lvl}</b><div class="bar"><i style="width:${G.team.xp / xpNeed(G.team.lvl) * 100}%"></i></div></div><div class="m-tp"><small>Kampfkraft</small><b>⚡ ${fmt(total)}</b></div><div class="m-tf">${facs}${bonds}</div></div><div class="m-tcards">${[0, 1, 2, 3, 4].map(card).join('')}</div></div>`;
}
function openSlot(k, sl, page = 0) {
  const H = HEROES[k], cur = G.heroes[k].eq[sl] && itemById(G.heroes[k].eq[sl]);
  const list = G.inv.filter(it => it.slot === sl && canEquip(k, it) && it.id !== cur?.id).map(it => [it, powerDiff(k, it), equippedBy(it.id)]).sort((a, b) => b[1] - a[1]);
  const per = 15, np = pages(list.length, per); page = clampPg(page, np);
  const det = cur ? `<div class="m-idet" style="--rc:${RARITY[cur.r].c}"><small class="muted">Angelegt</small><div class="m-ih">${icHtml(cur)}<div><b style="color:${RARITY[cur.r].c}">${esc(cur.name)}${cur.enh ? ' +' + cur.enh : ''}</b><small>${RARITY[cur.r].n} · St. ${cur.lvl}</small></div></div><ul>${itemLines(cur).map(l => `<li>${esc(l)}</li>`).join('')}</ul>${cur.passive ? `<p class="leg">${esc(cur.passive)}</p>` : ''}<div class="m-ia"><button class="btn small gold" id="slBest">Bestes anlegen</button><button class="btn small ghost" id="slOff">Ablegen</button></div></div>` : `<div class="m-idet"><small class="muted">Angelegt</small><p class="muted">Nichts. Wähle rechts einen Gegenstand.</p><div class="m-ia"><button class="btn small gold" id="slBest">Bestes anlegen</button></div></div>`;
  openSheet(`${esc(H.n)} · ${SLOTS[sl]}`, `<div class="m-slotv">${det}<div class="m-items">${list.slice(page * per, page * per + per).map(([it, d, by]) => `<button class="m-it" data-eq="${it.id}" style="--rc:${RARITY[it.r].c}">${icHtml(it)}<b>${esc(it.name)}${it.enh ? ' +' + it.enh : ''}</b><span class="m-d ${d > 0 ? 'pos' : d < 0 ? 'neg' : ''}">${d > 0 ? '+' : ''}${fmt(d)} ⚡</span>${by ? `<i>${esc(HEROES[by].n)}</i>` : ''}</button>`).join('') || '<p class="muted">Keine passenden Gegenstände im Beutel. Sie fallen in Kämpfen.</p>'}</div></div>`, s => {
    const done = (it, d) => { equip(k, it); W.pendingParty = 1; refreshLooks(); sfx(d > 0 ? 'level' : 'click'); toast(`${esc(H.n)}: <b style="color:${RARITY[it.r].c}">${esc(it.name)}</b> angelegt${d ? ` · ${d > 0 ? '+' : ''}${fmt(d)} ⚡` : ''}`, d > 0 ? 'lvl' : 'mini'); openHeroes('team'); };
    s.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const e = list.find(x => x[0].id === +b.dataset.eq); done(e[0], e[1]); });
    const sb = s.querySelector('#slBest'); if (sb) sb.onclick = () => { const n = autoEquip([k]); refreshLooks(); W.pendingParty = 1; toast(n ? 'Beste Ausrüstung angelegt' : 'Bereits optimal', 'mini'); openHeroes('team'); };
    const so = s.querySelector('#slOff'); if (so) so.onclick = () => { unequip(k, sl); refreshLooks(); W.pendingParty = 1; openSlot(k, sl); };
    const bk = s.querySelector('#slBack'); if (bk) bk.onclick = () => openHeroes('team');
  }, { pages: np, page, onPage: p => openSlot(k, sl, p), extra: '<button class="btn small" id="slBack">‹ Team</button>' });
}
function openHeroes(tab = openHeroes.tab || 'team', page = openHeroes.page) {
  openHeroes.tab = tab;
  const own = owned().sort((a, b) => (G.party.includes(b) - G.party.includes(a)) || heroStats(b).power - heroStats(a).power);
  const all = [...own.map(k => [k, 0]), ...Object.keys(HEROES).filter(k => !G.heroes[k]).map(k => [k, 1])];
  const per = 12, np = tab === 'helden' ? pages(all.length, per) : 1; page = openHeroes.page = clampPg(page, np);
  let body = '';
  if (tab === 'team') body = teamView();
  else if (tab === 'helden') body = `<div class="m-heroes">${all.slice(page * per, page * per + per).map(([k, l]) => heroCard(k, l)).join('')}</div>`;
  else if (tab === 'begleiter') body = `<div class="m-comps">${COMPANIONS.map(cp => { const own2 = G.comps[cp.id], src = cp.from.ch !== undefined ? 'Kapitel ' + (cp.from.ch + 1) : 'Nebenquest'; return `<button class="comp ${own2 ? '' : 'lk'} ${G.companion === cp.id ? 'on' : ''}" data-cp="${cp.id}"><canvas data-comp="${cp.id}"></canvas><b>${own2 ? esc(cp.n) : '???'}</b><small>${own2 ? esc(cp.d) : src}</small>${G.companion === cp.id ? '<span class="tag in">Aktiv</span>' : ''}</button>`; }).join('')}</div>`;
  else body = `<div class="m-facs">${activeFactions().map(f => `<div class="fac ${f.tier >= 0 ? 'on' : ''}" style="--fc:${f.F.c}"><span class="fi">${f.F.ic}</span><div><b>${esc(f.F.n)} <em>${f.n}</em></b><small>${f.F.t.map((t, i) => `<i class="${f.tier >= i ? 'act' : ''}">${t[0]}: ${esc(t[2])}</i>`).join('<br>')}</small></div></div>`).join('')}</div>`;
  openSheet('Helden', body, s => {
    s.querySelectorAll('.hcard[data-k]').forEach(b => b.onclick = () => { sfx('click'); openHero(b.dataset.k); });
    s.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => { sfx('click'); openHero(b.dataset.hero, 'werte'); });
    s.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { sfx('click'); const [hk, sl] = b.dataset.slot.split('|'); openSlot(hk, sl); });
    s.querySelectorAll('[data-gohero]').forEach(b => b.onclick = () => openHeroes('helden', 0));
    s.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { const id = b.dataset.cp; if (!G.comps[id]) return; G.companion = id; sfx('click'); W.pendingParty = 1; save(); openHeroes(); });
    paintComps(s);
    const oa = s.querySelector('#optAll'); if (oa) oa.onclick = () => {
      const p0 = G.party.reduce((a, k) => a + heroStats(k).power, 0); if (G.settings.autoParty) autoParty(); const eq = autoEquip(); const tr = 0; refreshLooks();
      save(); W.pendingParty = 1; buildHud(); const p1 = G.party.reduce((a, k) => a + heroStats(k).power, 0);
      sfx(tr || eq ? 'level' : 'click'); toast(eq ? `Optimiert: ${eq} Ausrüstungswechsel · Kampfkraft +${fmt(p1 - p0)}` : 'Schon optimal ausgerüstet.', eq ? 'lvl' : 'mini'); openHeroes();
    };
    const ap = s.querySelector('#autoP'); if (ap) ap.onclick = () => { G.settings.autoParty = !G.settings.autoParty; if (G.settings.autoParty) { autoParty(); W.pendingParty = 1; buildHud(); } save(); openHeroes(); };
  }, { tabs: [['team', 'Team'], ['helden', `Alle ${own.length}/${Object.keys(HEROES).length}`], ['begleiter', 'Begleiter'], ['buende', 'Bündnisse']], tab, onTab: t => openHeroes(t, 0), pages: np, page, onPage: p => openHeroes(tab, p),
    extra: tab === 'team' || tab === 'helden' ? `<button class="btn small gold" id="optAll">⚡ Optimieren</button><button class="btn small ${G.settings.autoParty ? 'on' : ''}" id="autoP" title="Gruppe automatisch aufstellen">Auto</button>` : '' });
}
function paintComps(root) { root.querySelectorAll('canvas[data-comp]').forEach(c => { const cp = COMPANIONS.find(x => x.id === c.dataset.comp); requestAnimationFrame(() => compArt(c, cp)); }); }
function compArt(cv, cp) {
  const dpr = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; const c = cv.getContext('2d');
  const g = c.createRadialGradient(cv.width / 2, cv.height / 2, 2, cv.width / 2, cv.height / 2, cv.width * .7); g.addColorStop(0, 'rgba(232,189,92,.35)'); g.addColorStop(1, 'rgba(10,13,18,1)'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  const sc = cv.height / 34; c.setTransform(sc, 0, 0, sc, cv.width / 2, cv.height * .86);
  if (cp.kind === 'eagle') { c.translate(0, -14); RIG.drawEagle(c, cp.look, 400); }
  else if (cp.kind === 'ghosts') { c.globalAlpha = .7; c.scale(.8, .8); RIG.draw(c, 'hum', Object.assign({ wpn: 'sword' }, ENEMIES.dead_soldier.look), 'idle', 0, 400); }
  else if (cp.kind === 'sled') { c.scale(.8, .8); RIG.draw(c, 'quad', Object.assign({ eye: '#2a1a1a' }, cp.look), 'idle', 0, 400); }
  else RIG.draw(c, 'quad', Object.assign({ horse: 1, pony: cp.kind === 'pony', eye: '#2a1a12' }, cp.look), 'idle', 0, 400);
}
function setLines(k) {
  const n = {}; for (const sl of Object.keys(SLOTS)) { const it = G.heroes[k].eq[sl] && itemById(G.heroes[k].eq[sl]); if (it?.set) n[it.set] = (n[it.set] || 0) + 1; }
  return Object.entries(n).map(([id, c]) => { const S2 = SETS.find(x => x.id === id); return `<div class="setl" style="--sc:${S2.c}"><b>${esc(S2.n)} (${c}/3)</b><span class="${c >= 2 ? 'on' : ''}">2: ${esc(S2.d2)}</span><span class="${c >= 3 ? 'on' : ''}">3: ${esc(S2.d3)}</span></div>`; }).join('');
}
function heroFactions(k) { return Object.values(FACTIONS).filter(F => F.m.includes(k)).map(F => `<span class="fchip" style="--fc:${F.c}">${F.ic} ${esc(F.n)}</span>`).join(''); }
function skillRow(type, s, locked, note) {
  return `<div class="sk ${type} ${locked ? 'locked' : ''}"><div class="sk-h"><span class="sk-t">${{ ult: 'Ultimate', act: 'Aktiv', act2: 'Aktiv II', pas: 'Passiv' }[type]}</span>${note ? `<small>${note}</small>` : ''}</div><b>${esc(s.n)}</b><p>${esc(s.d)}</p></div>`;
}
function openHero(k, tab = openHero.tab || 'werte') {
  openHero.tab = tab;
  const H = HEROES[k], C = CLASSES[H.cls], hs = G.heroes[k], st = heroStats(k, G.party.includes(k) ? partyAura() : undefined), kit = heroKit(k), ev = canEvolve(k);
  const inP = G.party.includes(k), cap = STAGE_CAP[hs.stage], magic = C.base.mag > C.base.atk;
  const list = owned().sort((a, b) => (G.party.includes(b) - G.party.includes(a)) || heroStats(b).power - heroStats(a).power), idx = list.indexOf(k);
  let right = '';
  if (tab === 'werte') right = `
    <div class="hi-top"><span class="role r-${C.role}">${ROLES[C.role].n}</span><span class="muted">${esc(C.n)} · ${esc(C.sub)}</span></div>
    <div class="m-pow"><div class="power">⚡ ${fmt(st.power)}<small>Kampfkraft</small></div><div class="lvl"><span>Gruppenstufe ${G.team.lvl}</span><div class="bar"><i style="width:${G.team.xp / xpNeed(G.team.lvl) * 100}%"></i></div></div></div>
    <div class="stats">${[['Leben', st.hp], [magic ? 'Magie' : 'Angriff', magic ? st.mag : st.atk], ['Verteid.', st.def], ['Tempo', st.spd], ['Krit', st.crit + ' %']].map(([n, v]) => `<div><small>${n}</small><b>${typeof v === 'number' ? fmt(v) : v}</b></div>`).join('')}</div>
    <div class="hi-fac">${heroFactions(k)}${BONDS.filter(b => b.a === k || b.b === k).map(b => { const o = b.a === k ? b.b : b.a, on = G.party.includes(k) && G.party.includes(o); return `<span class="fchip bond ${on ? 'on' : ''}">♥ ${G.heroes[o] ? esc(HEROES[o].n) : '???'}${on ? ' · aktiv' : ''}</span>`; }).join('')}</div>
    <div class="acts">
      <button class="btn ${inP ? '' : 'primary'}" id="toggleP" ${G.away[k] ? 'disabled' : ''}>${inP ? 'Aus der Gruppe' : 'In die Gruppe'}</button>
      <button class="btn" id="toEq">Ausrüstung</button>
      ${ev ? `<button class="btn ${ev.ok ? 'gold' : ''}" id="evo" ${ev.ok ? '' : 'disabled'}>Entwickeln <small>${ev.lvlOk ? '◆' + fmt(ev.cost.gold) + ' · ' : 'ab Gruppenstufe ' + cap + ' · '}✧${ev.cost.mithril}</small></button>` : '<span class="muted small">Höchste Stufe</span>'}
    </div>`;
  else if (tab === 'faehig') right = `<div class="m-skills">${skillRow('ult', kit.ult, false, 'Leiste voll')}${skillRow('act', H.act, false, `alle ${H.act.cd + 1} Züge`)}${skillRow('act2', H.act2, hs.lvl < ACT2_LVL, hs.lvl < ACT2_LVL ? `ab Stufe ${ACT2_LVL}` : `alle ${H.act2.cd + 1} Züge`)}${H.pas.map(p => skillRow('pas', p, hs.lvl < p.lvl, hs.lvl < p.lvl ? `ab Stufe ${p.lvl}` : '')).join('')}</div>`;
  else right = `<div class="gear">${Object.entries(SLOTS).map(([slot, n]) => { const it = hs.eq[slot] && itemById(hs.eq[slot]); return `<div class="gs" data-slot="${k}|${slot}" style="--rc:${it ? RARITY[it.r].c : '#3a444e'}">${it ? icHtml(it) : '<div class="ic empty"></div>'}<div><small>${n}</small><b style="${it ? 'color:' + RARITY[it.r].c : ''}">${it ? esc(it.name) + (it.enh ? ' +' + it.enh : '') : 'Leer'}</b>${it ? `<span>${itemLines(it).slice(0, 3).join(' · ')}</span>` : ''}</div></div>`; }).join('')}</div>${setLines(k)}<div class="acts"><button class="btn gold" id="bestEq">Beste anlegen</button><button class="btn" id="toTeam">Team-Übersicht</button></div>`;
  openSheet(esc(H.n), `<div class="m-hero"><div class="hero-art" style="--rc:${ROLE_COL[C.role]}"><canvas id="bigArt"></canvas><div class="ha-foot">${stars(hs.stage)}<span>${esc(heroTitle(k))}</span></div></div><div class="m-hr-r">${right}</div></div>`, s => {
    const cv = s.querySelector('#bigArt'); const seq = ['idle', { melee: 'attack', spin: 'attack', cast: 'cast', shoot: 'shoot', throw: 'throw', shout: 'shout' }[H.act.anim] || 'attack', 'idle', 'victory'];
    let si = 0, t0 = performance.now();
    const loop = now => { const a = seq[si]; const dur = a === 'idle' ? 2600 : a === 'victory' ? 1800 : RIG.animTime(a) + 300; if (now - t0 > dur) { si = (si + 1) % seq.length; t0 = now; } RIG.card(cv, 'hum', heroLook(k), { col: ROLE_COL[C.role], seed: k, anim: seq[si], el: now - t0, gt: now, zoom: 1.02 }); artRaf = requestAnimationFrame(loop); };
    artRaf = requestAnimationFrame(loop);
    const on = (id, f) => { const e = s.querySelector(id); if (e) e.onclick = f; };
    on('#train', () => { if (train(k)) { sfx('level'); toast(`${esc(H.n)} erreicht Stufe ${G.heroes[k].lvl}`, 'lvl'); W.pendingParty = 1; openHero(k); } });
    on('#toTeam', () => openHeroes('team'));
    on('#bestEq', () => { const n = autoEquip([k]); refreshLooks(); toast(n ? 'Ausrüstung verbessert' : 'Bereits optimal ausgerüstet', 'mini'); W.pendingParty = 1; openHero(k); });
    on('#toBag', () => openBag());
    on('#toEq', () => openHero(k, 'ausr'));
    on('#toggleP', () => {
      G.settings.autoParty = false;
      if (inP) { if (G.party.length > 1) G.party = G.party.filter(x => x !== k); }
      else if (G.party.length < 5) G.party.push(k);
      else { const same = G.party.filter(x => roleOf(x) === roleOf(k)); const out = (same.length ? same : G.party).reduce((a, b) => heroStats(b).power < heroStats(a).power ? b : a); G.party = G.party.map(x => x === out ? k : x); toast(`${esc(HEROES[out].n)} wurde ersetzt`, 'mini'); }
      save(); W.pendingParty = 1; buildHud(); openHero(k);
    });
    s.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { sfx('click'); const [hk, sl] = b.dataset.slot.split('|'); openSlot(hk, sl); });
    on('#evo', () => { if (evolve(k)) { W.pendingParty = 1; closeSheet(); joinSplash(k, 0).then(() => toast(`${esc(HEROES[k].n)} ist jetzt <b>${esc(heroTitle(k))}</b>!`, 'lvl')); } });
    on('#hBack', () => openHeroes());
  }, { tabs: [['werte', 'Werte'], ['faehig', 'Fähigkeiten'], ['ausr', 'Ausrüstung']], tab, onTab: t => openHero(k, t), pages: list.length, page: idx, onPage: p => openHero(list[clampPg(p, list.length)], tab), extra: '<button class="btn small" id="hBack">‹ Alle</button>' });
}

/* ---------- Beutel: Raster links, Details rechts ---------- */
function openBag(f = openBag.f || 'all', page = openBag.page, sel = openBag.sel) {
  openBag.f = f;
  const list = G.inv.filter(it => f === 'all' || it.slot === f).sort((a, b) => b.r - a.r || b.lvl - a.lvl);
  const per = 15, np = pages(list.length, per); page = openBag.page = clampPg(page, np);
  const it = itemById(sel) || list[page * per]; openBag.sel = it?.id;
  const by = it && equippedBy(it.id);
  const det = it ? `<div class="m-idet" style="--rc:${RARITY[it.r].c}"><div class="m-ih">${icHtml(it)}<div><b style="color:${RARITY[it.r].c}">${esc(it.name)}${it.enh ? ' +' + it.enh : ''}</b><small>${RARITY[it.r].n} · ${SLOTS[it.slot]}${it.slot === 'weapon' ? ' · ' + WCLS[it.base] : ''} · St. ${it.lvl}</small></div></div>
    <ul>${itemLines(it).map(l => `<li>${esc(l)}</li>`).join('')}</ul>${it.passive ? `<p class="leg">${esc(it.passive)}</p>` : ''}
    <div class="m-ia">${(() => { const b = bestHeroFor(it); return b ? `<button class="btn small gold" data-eqb="${b.k}">Anlegen: ${esc(HEROES[b.k].n)} <span class="pos">+${fmt(b.d)} ⚡</span></button>` : ''; })()}${by ? `<span class="m-worn">Getragen von ${esc(HEROES[by].n)}</span>` : ''}<div class="m-ia2"><button class="btn small" data-enh="${it.id}" ${G.gold < enhCost(it) || it.enh >= 10 ? 'disabled' : ''}>Verstärken<small>◆${fmt(enhCost(it))}</small></button><button class="btn small ghost" data-sv="${it.id}" ${by ? 'disabled' : ''}>Zerlegen<small>◆${fmt(itemValue(it))}</small></button></div></div></div>` : '<div class="m-idet"><p class="muted">Noch keine Gegenstände. Sie fallen in Kämpfen.</p></div>';
  openSheet('Beutel', `<div class="m-bag"><div class="m-items">${list.slice(page * per, page * per + per).map(x => `<button class="m-it ${x.id === it?.id ? 'sel' : ''} ${x.r >= 4 ? 'leg' : ''}" data-it="${x.id}" style="--rc:${RARITY[x.r].c}">${icHtml(x)}<b>${esc(x.name)}</b>${equippedBy(x.id) ? '<i>●</i>' : bestHeroFor(x) ? '<i class="up">▲</i>' : ''}</button>`).join('')}</div>${det}</div>`, s => {
    s.querySelectorAll('[data-it]').forEach(b => b.onclick = () => { sfx('click'); openBag(f, page, +b.dataset.it); });
    s.querySelectorAll('[data-eqb]').forEach(b => b.onclick = () => { const hk = b.dataset.eqb; equip(hk, it); W.pendingParty = 1; refreshLooks(); sfx('level'); toast(`${esc(HEROES[hk].n)}: <b style="color:${RARITY[it.r].c}">${esc(it.name)}</b> angelegt`, 'lvl'); openBag(f, page, it.id); });
    s.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { const v = salvage(itemById(+b.dataset.sv)); save(); toast(`+${fmt(v)} ◆`, 'mini'); openBag(f, page, null); });
    s.querySelectorAll('[data-enh]').forEach(b => b.onclick = () => { if (enhance(itemById(+b.dataset.enh))) { sfx('buff'); W.pendingParty = 1; } openBag(f, page, it.id); });
    const sv = s.querySelector('#salv'); if (sv) sv.onclick = () => { let g = 0; G.inv.filter(x => x.r <= 1 && !equippedBy(x.id)).forEach(x => g += salvage(x)); save(); toast(`Zerlegt: +${fmt(g)} ◆`, 'mini'); openBag(f, 0, null); };
  }, { tabs: [['all', 'Alle'], ['weapon', 'Waffen'], ['armor', 'Rüstung'], ['trinket', 'Schmuck']], tab: f, onTab: t => openBag(t, 0, null), pages: np, page, onPage: p => openBag(f, p, null), extra: '<button class="btn small" id="salv" title="Alle gewöhnlichen, nicht angelegten Teile zerlegen">Aufräumen</button>' });
}

/* ---------- Reise: Karte + Kapitel, Modi als Kacheln ---------- */
const PARTS = ['Teil I · Der Hobbit', 'Teil II · Der Ringkrieg', 'Teil III · Die Ringe der Macht'];
const PART_COL = ['#2e8a4a', '#b8402a', '#3a5ab8'];
function chapterStatus(i) { if (i < G.story.ch || G.story.loop > 0) return 'done'; if (i === G.story.ch) return 'cur'; return 'locked'; }
function drawMap(cv, part, sel) {
  const dpr = Math.min(2, devicePixelRatio || 1), W0 = cv.clientWidth, H0 = cv.clientHeight; cv.width = W0 * dpr; cv.height = H0 * dpr;
  const c = cv.getContext('2d'), sx = cv.width / 100, sy = cv.height / 75, X = x => x * sx, Y = y => y * sy, r = Math.min(sx, sy);
  const g = c.createRadialGradient(cv.width * .5, cv.height * .45, 10, cv.width * .5, cv.height * .5, cv.width * .7); g.addColorStop(0, '#ecdcb4'); g.addColorStop(1, '#a8916a'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = 'rgba(70,110,150,.3)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(X(10), 0); c.quadraticCurveTo(X(4), Y(40), X(12), Y(75)); c.lineTo(0, Y(75)); c.fill();
  c.strokeStyle = 'rgba(70,110,150,.5)'; c.lineWidth = r * .6; c.beginPath(); c.moveTo(X(56), Y(12)); c.bezierCurveTo(X(52), Y(35), X(60), Y(50), X(62), Y(75)); c.stroke();
  const mtn = (x0, y0, x1, y1, n) => { c.fillStyle = 'rgba(90,70,50,.4)'; for (let i = 0; i <= n; i++) { const x = X(x0 + (x1 - x0) * i / n), y = Y(y0 + (y1 - y0) * i / n); c.beginPath(); c.moveTo(x - r * 1.5, y + r); c.lineTo(x, y - r * 1.5); c.lineTo(x + r * 1.5, y + r); c.fill(); } };
  mtn(42, 8, 44, 44, 12); mtn(64, 52, 82, 52, 8); mtn(64, 66, 82, 66, 8); mtn(66, 52, 66, 66, 5); mtn(40, 4, 70, 6, 10);
  const wood = (x, y, rx, ry) => { c.fillStyle = 'rgba(60,90,50,.3)'; c.beginPath(); c.ellipse(X(x), Y(y), rx * sx, ry * sy, 0, 0, Math.PI * 2); c.fill(); };
  wood(62, 26, 7, 12); wood(47, 48, 3, 3); wood(53, 44, 2.5, 2.5);
  const idx = STORY.map((ch, i) => i).filter(i => STORY[i].part === PARTS[part]), col = PART_COL[part];
  c.setLineDash([r * 1.4, r * .9]); c.lineWidth = r * .55; c.strokeStyle = col; c.beginPath();
  idx.forEach((i, j) => { const p = STORY[i].map; j ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])); }); c.stroke(); c.setLineDash([]);
  cv._hits = [];
  SIDE.filter(sd => STORY[sd.after].part === PARTS[part]).forEach(sd => {
    const x = X(sd.map[0]), y = Y(sd.map[1]), R = r * 2.4, un = sideUnlocked(sd), done = G.side[sd.id];
    c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillStyle = done ? '#8a6ac8' : un ? '#a888ff' : '#8a8070'; c.fillRect(-R * .8, -R * .8, R * 1.6, R * 1.6); c.lineWidth = r * .4; c.strokeStyle = '#2a1a0a'; c.strokeRect(-R * .8, -R * .8, R * 1.6, R * 1.6); c.restore();
    if (sel === 'side:' + sd.id) { c.strokeStyle = '#fff6d0'; c.lineWidth = r * .6; c.beginPath(); c.arc(x, y, R + r * 1.4, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#fff'; c.font = `800 ${r * 2.4}px Cinzel, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(done ? '✓' : un ? '!' : '🔒', x, y + r * .2);
    cv._hits.push({ i: 'side:' + sd.id, x: x / dpr, y: y / dpr, r: Math.max(22, R / dpr + 8) });
  });
  idx.forEach(i => {
    const p = STORY[i].map, st = chapterStatus(i), R = r * (st === 'cur' ? 3.1 : 2.6), x = X(p[0]), y = Y(p[1]);
    if (st === 'cur') { c.fillStyle = 'rgba(192,57,30,.25)'; c.beginPath(); c.arc(x, y, R * 1.7, 0, Math.PI * 2); c.fill(); }
    if (i === sel) { c.strokeStyle = '#fff6d0'; c.lineWidth = r * .6; c.beginPath(); c.arc(x, y, R + r * 1.1, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fillStyle = st === 'cur' ? '#c0391e' : st === 'done' ? '#b8862e' : '#8a8070'; c.fill(); c.lineWidth = r * .4; c.strokeStyle = '#2a1a0a'; c.stroke();
    c.fillStyle = '#fff'; c.font = `800 ${r * 2.8}px Cinzel, serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(st === 'done' ? '✓' : st === 'locked' ? '🔒' : i + 1, x, y + r * .2);
    const lbl = STORY[i].n.replace(/ & .*/, ''); c.font = `700 ${r * 2.3}px "Alegreya Sans", sans-serif`; const tw = c.measureText(lbl).width, lx = Math.min(cv.width - tw / 2 - r, Math.max(tw / 2 + r, x)), ly = y + R + r * 2.6;
    c.fillStyle = 'rgba(255,248,230,.85)'; c.fillRect(lx - tw / 2 - r * .6, ly - r * 1.4, tw + r * 1.2, r * 2.8); c.fillStyle = '#2a1a0a'; c.fillText(lbl, lx, ly);
    cv._hits.push({ i, x: x / dpr, y: y / dpr, r: Math.max(22, R / dpr + 8) });
  });
}
function chapterCard(i) {
  const C = STORY[i], st = chapterStatus(i), joins = [...(C.join || []), ...Object.values(C.mid || {}).flat(), ...(C.end || [])].filter((k, j, a) => a.indexOf(k) === j);
  const boss = C.boss.find(k => ENEMIES[k].boss) || C.boss[0], seen = st !== 'locked';
  const btn = st === 'cur' ? `<button class="btn gold big m-play" id="goOn">▶ ${G.story.wave >= WAVES ? 'Zum Bosskampf' : 'Weiterspielen'}</button>` : st === 'done' ? `<button class="btn gold big m-play" data-rematch="${i}">▶ Boss erneut${chapterSet(i) ? ' · Set' : ''}</button>` : '<button class="btn big m-play" disabled>🔒 Noch gesperrt</button>';
  return `<div class="m-ch ${st}"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1" class="${seen ? '' : 'sil'}"></canvas><span class="cc-st">${st === 'done' ? '✓ Geschafft' : st === 'cur' ? (G.story.wave >= WAVES ? 'Boss wartet' : `Welle ${G.story.wave + 1}/${WAVES}`) : 'Gesperrt'}</span></div>
    <small>Kapitel ${i + 1}</small><h3>${esc(C.n)}</h3>
    <div class="cc-rows"><div><b>Boss</b><span>${seen ? esc(ENEMIES[boss].n) : '???'}</span></div>${joins.length ? `<div><b>Helden</b><span>${joins.map(k => G.heroes[k] ? esc(HEROES[k].n) : '???').join(', ')}</span></div>` : ''}<div><b>Relikt</b><span>${G.relics[i] ? esc(RELICS[i].n) : '???'}</span></div><div><b>Stufe</b><span>${C.lvl + G.story.loop * LOOP_LVL}+</span></div></div>${btn}</div>`;
}
function sideCard(sd) {
  const un = sideUnlocked(sd), done = G.side[sd.id], boss = sd.boss.find(k => ENEMIES[k].boss);
  const rew = [sd.hero ? (done ? esc(HEROES[sd.hero].n) : 'Neuer Held') : '', sd.comp ? (done ? esc(COMPANIONS.find(c => c.id === sd.comp).n) : 'Begleiter') : '', sd.legend ? (done ? esc(sd.legend) : 'Legendäre Waffe') : ''].filter(Boolean).join(', ');
  return `<div class="m-ch side ${un ? (done ? 'done' : 'cur') : 'locked'}"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1" class="${un ? '' : 'sil'}"></canvas><span class="cc-st">${!un ? 'Gesperrt' : done ? `✓ ${done}×` : 'Neu!'}</span></div>
    <small>Nebenquest</small><h3>${esc(sd.n)}</h3>
    <div class="cc-rows"><div><b>Boss</b><span>${un ? esc(ENEMIES[boss].n) : '???'}</span></div><div><b>Beute</b><span>${rew}</span></div><div><b>Stufe</b><span>${sideLvl(sd)}+</span></div></div>
    ${un ? `<button class="btn gold big m-play" data-side="${sd.id}">▶ ${done ? 'Erneut spielen' : 'Starten'}</button>` : `<button class="btn big m-play" disabled>🔒 ab Kapitel ${sd.after + 2}</button>`}</div>`;
}
function openStory(tab = openStory.tab || 'story', part, sel) {
  openStory.tab = tab;
  if (tab === 'modi') return openModes();
  if (tab === 'chronik') return openChronik();
  if (tab === 'best') return openBestiary();
  if (part === undefined) part = Math.max(0, PARTS.indexOf(STORY[G.story.ch].part));
  if (typeof sel === 'string') { } else if (sel === undefined || STORY[sel]?.part !== PARTS[part]) sel = STORY[G.story.ch].part === PARTS[part] ? G.story.ch : STORY.findIndex(c => c.part === PARTS[part]);
  const mods = activeMods();
  openSheet('Reise', `<div class="m-story"><div class="mapwrap"><canvas id="map" class="map"></canvas><div class="m-parts">${PARTS.map((p, i) => `<button class="ptab ${i === part ? 'on' : ''}" data-part="${i}" style="--c:${PART_COL[i]}">${esc(p.split(' · ')[1])}</button>`).join('')}</div>${mods.length ? `<div class="m-loop">Heldenreise ${G.story.loop + 1} · ☠ ${mods.length} Erschwernisse · +${G.story.loop * 25} % Beute</div>` : ''}</div><div id="chDetail">${typeof sel === 'string' ? sideCard(SIDE.find(x => 'side:' + x.id === sel)) : chapterCard(sel)}</div></div>`, s => {
    const cv = s.querySelector('#map');
    requestAnimationFrame(() => drawMap(cv, part, sel));
    const wire = root => {
      const go = root.querySelector('#goOn'); if (go) go.onclick = () => { closeSheet(); sfx('click'); };
      root.querySelectorAll('[data-rematch]').forEach(b => b.onclick = () => playNow({ type: 'boss', ch: +b.dataset.rematch }, 'Bosskampf: ' + STORY[+b.dataset.rematch].n));
      root.querySelectorAll('[data-side]').forEach(b => b.onclick = () => playNow({ type: 'side', id: b.dataset.side }, SIDE.find(x => x.id === b.dataset.side).n));
    };
    wire(s);
    cv.onclick = e => { const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top; const h = (cv._hits || []).map(h => ({ ...h, d: Math.hypot(h.x - x, h.y - y) })).filter(h => h.d < h.r).sort((a, b) => a.d - b.d)[0]; if (h) { sfx('click'); sel = h.i; drawMap(cv, part, sel); const d = s.querySelector('#chDetail'); d.innerHTML = typeof sel === 'string' ? sideCard(SIDE.find(x => 'side:' + x.id === sel)) : chapterCard(sel); paintCards(d); wire(d); } };
    s.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { sfx('click'); openStory('story', +b.dataset.part); });
  }, { tabs: STORY_TABS, tab, onTab: t => openStory(t) });
}
const STORY_TABS = [['story', 'Geschichte'], ['modi', 'Modi'], ['chronik', 'Chronik'], ['best', 'Bestiarium']];
function speaker(id) { if (id === 'narr') return ''; if (id.startsWith('e:')) return ENEMIES[id.slice(2)]?.n || ''; return HEROES[id]?.n || id; }
function openChronik(page = openChronik.page) {
  const max = G.story.loop ? STORY.length - 1 : G.story.ch, np = max + 1; page = openChronik.page = clampPg(page ?? max, np);
  const C = STORY[page], done = chapterStatus(page) === 'done', boss = C.boss.find(k => ENEMIES[k].boss) || C.boss[0];
  const lines = [...(C.intro || []), ...(done ? (C.outro || []) : [])].filter(l => l && l[1]).slice(0, 9);
  openSheet('Reise', `<div class="m-chron"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1"></canvas></div><div class="m-book"><small>${esc(C.part)} · Kapitel ${page + 1}</small><h3>${esc(C.n)}</h3><div class="m-lines">${lines.map(([who, t]) => `<p>${speaker(who) ? `<b>${esc(speaker(who))}:</b> ` : ''}${esc(t)}</p>`).join('')}</div>${done ? '<span class="m-seal">✓ Kapitel abgeschlossen</span>' : '<span class="m-seal cur">▶ Die Geschichte geht weiter …</span>'}</div></div>`, null,
    { tabs: STORY_TABS, tab: 'chronik', onTab: t => openStory(t), pages: np, page, onPage: p => openChronik(p) });
}
function openBestiary(page = openBestiary.page) {
  const keys = Object.keys(ENEMIES), seen = keys.filter(k => (G.bestiary || {})[k]).length, per = 16, np = pages(keys.length, per); page = openBestiary.page = clampPg(page, np);
  openSheet('Reise', `<div class="m-best">${keys.slice(page * per, page * per + per).map(k => { const n = (G.bestiary || {})[k] || 0, E = ENEMIES[k]; return `<div class="m-be ${n ? '' : 'lk'} ${E.boss ? 'boss' : ''}"><canvas data-card="${k}" data-enemy="1" data-bust="1" class="${n ? '' : 'sil'}"></canvas><b>${n ? esc(E.n) : '???'}</b><small>${n ? `${E.boss ? 'Boss · ' : ''}${fmt(n)}× besiegt` : 'Noch nicht begegnet'}</small></div>`; }).join('')}</div>`, null,
    { tabs: STORY_TABS, tab: 'best', onTab: t => openStory(t), pages: np, page, onPage: p => openBestiary(p), extra: `<span class="muted small">${seen}/${keys.length}</span>` });
}
function openModes() {
  const ok = modeUnlocked(), f = towerFloor(), tr = towerReward(f);
  const tile = (cls, art, n, sub, data, label, dis) => `<div class="m-tile ${cls}">${art}<b>${n}</b><small>${sub}</small><button class="btn small gold" ${data} ${dis ? 'disabled' : ''}>${label}</button></div>`;
  const tiles = [
    ...MODES.map(M => tile('mode', `<span class="m-ic">${M.ic}</span>`, esc(M.n), `${esc(M.d.split('.')[0])}.<br><em>Rekord: ${(G.modes || {})[M.id] || 0}</em>`, `data-mode="${M.id}"`, ok ? '▶ Spielen' : 'ab Kapitel 4', !ok)),
    tile('tower', '<span class="m-ic">♜</span>', 'Orthanc-Turm', `Etage ${f} · Stufe ${towerLvl(f)}<br><em>◆${fmt(tr.gold)} ✧${tr.mithril}</em>`, 'id="tw"', '▶ Etage ' + f, false),
    ...RAIDS.map(R => { const st = G.raid[R.key] || { best: 0, tiers: 0 }; return tile('raid', `<canvas data-card="${R.key}" data-enemy="1" data-bust="1"></canvas>`, esc(R.n), `45 Sek. · Bestwert ${Math.round(st.best * 100)} %<br><em>Stufe ${st.tiers}/${RAID_TIERS.length}</em>`, `data-raid="${R.key}"`, ok ? '▶ Spielen' : 'ab Kapitel 4', !ok); })
  ];
  openSheet('Reise', `<div class="m-tiles">${tiles.join('')}</div>`, s => {
    s.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => playNow({ type: 'mode', id: b.dataset.mode }, MODES.find(m => m.id === b.dataset.mode).n));
    s.querySelectorAll('[data-raid]').forEach(b => b.onclick = () => playNow({ type: 'raid', key: b.dataset.raid }, 'Prüfung: ' + RAIDS.find(r => r.key === b.dataset.raid).n));
    s.querySelector('#tw').onclick = () => playNow({ type: 'tower' }, 'Orthanc-Turm Etage ' + f);
  }, { tabs: STORY_TABS, tab: 'modi', onTab: t => openStory(t) });
}
function introHelp() {
  return splash(`<div class="help"><div class="kicker">So funktioniert Ringfahrt</div><h1>Willkommen, Gefährte</h1><ul>
    <li><b>Kämpfe laufen von selbst.</b> Die Helden setzen ihre Fähigkeiten automatisch ein.</li>
    <li><b>Goldene Leiste</b> unter jedem Helden: Ist sie voll, tippe die Karte für eine Ultimate mit Bonus.</li>
    <li><b>Oben rechts</b> öffnest du Helden, Beutel, Reise, Aufträge und mehr.</li>
    <li><b>Reise</b> zeigt die Karte und alle Modi. Ein Tipp auf ▶ startet sofort.</li></ul><div class="dhint">Tippen zum Starten</div></div>`, 0, 'helpS');
}

/* ---------- Aufträge, Relikte, Erfolge, Truhe, Optionen ---------- */
function openQuests() {
  const b = ensureBoard();
  openSheet('Aufträge', `<div class="m-quests">${b.active.map((a, i) => { const st = questState(i); return `<div class="ach ${st.done ? 'ready' : ''}"><b>${esc(st.q.n.replace(/\d+/, st.goal))}</b><div class="bar"><i style="width:${Math.min(100, st.v / st.goal * 100)}%"></i></div><div class="ar"><small>${Math.min(st.v, st.goal)} / ${st.goal}</small><span>◆ ${fmt(st.r.gold)} ✧ ${st.r.mithril}</span><button class="btn small ${st.done ? 'gold' : ''}" data-q="${i}" ${st.done ? '' : 'disabled'}>Abholen</button></div></div>`; }).join('')}
    <div class="ach bonus ${boardBonusReady() ? 'ready' : ''}"><b>Bonustruhe</b><small>Nach je 4 Aufträgen: ✧ 30 und ein epischer oder legendärer Gegenstand</small><div class="bar"><i style="width:${Math.min(100, b.bonus / 4 * 100)}%"></i></div><div class="ar"><small>${Math.min(4, b.bonus)} / 4 · bisher ${b.done} erledigt</small><button class="btn small ${boardBonusReady() ? 'gold' : ''}" id="qb" ${boardBonusReady() ? '' : 'disabled'}>Öffnen</button></div></div></div>`, s => {
    s.querySelectorAll('[data-q]').forEach(x => x.onclick = () => { if (claimQuest(+x.dataset.q)) { sfx('loot'); updateHud(); openQuests(); } });
    const qb = s.querySelector('#qb'); if (qb) qb.onclick = () => { const it = claimBoardBonus(); if (it) { sfx('join'); lootPop([it], 0); W.pendingParty = 1; updateHud(); openQuests(); } };
  });
}
function openRelics(sel = openRelics.sel ?? Object.keys(G.relics).map(Number)[0] ?? 0) {
  openRelics.sel = sel; const n = Object.keys(G.relics).length, R = RELICS[sel], own = G.relics[sel];
  openSheet('Relikte', `<div class="m-reldet" style="--rc:${own ? R.c : '#555'}">${own ? `<canvas class="ic" data-ic="${R.ic}" data-c="${R.c}"></canvas><div><b>${esc(R.n)}</b><small>${esc(R.d)} · gilt dauerhaft für alle Helden</small></div>` : `<div class="ic empty"></div><div><b>???</b><small>Boss von Kapitel ${sel + 1}: ${esc(STORY[sel].n)}</small></div>`}<span class="m-cnt">${n}/${RELICS.length}</span></div>
    <div class="m-relics">${RELICS.map((r, i) => `<button class="m-rel ${G.relics[i] ? '' : 'lk'} ${i === sel ? 'sel' : ''}" data-r="${i}" style="--rc:${r.c}">${G.relics[i] ? `<canvas class="ic" data-ic="${r.ic}" data-c="${r.c}"></canvas>` : '<div class="ic empty"></div>'}<small>${G.relics[i] ? esc(r.n) : 'Kap. ' + (i + 1)}</small></button>`).join('')}</div>`, s => {
    s.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { sfx('click'); openRelics(+b.dataset.r); });
  });
}
function openAch(page = openAch.page) {
  const list = ACHIEVEMENTS.map(a => [a, achState(a)]).sort((x, y) => (y[1].done && !y[1].claimed) - (x[1].done && !x[1].claimed) || x[1].claimed - y[1].claimed);
  const per = 9, np = pages(list.length, per); page = openAch.page = clampPg(page, np);
  openSheet('Erfolge', `<div class="m-achs">${list.slice(page * per, page * per + per).map(([a, s]) => `<div class="ach ${s.claimed ? 'claimed' : s.done ? 'ready' : ''}"><b>${esc(a.n)}</b><small>${esc(a.d)}</small><div class="bar"><i style="width:${Math.min(100, s.v / a.goal * 100)}%"></i></div><div class="ar"><span>${a.r.gold ? '◆ ' + fmt(a.r.gold) : ''}${a.r.mithril ? ' ✧ ' + a.r.mithril : ''}</span>${s.claimed ? '<span class="tag in">✓</span>' : `<button class="btn small ${s.done ? 'gold' : ''}" data-a="${a.id}" ${s.done ? '' : 'disabled'}>Abholen</button>`}</div></div>`).join('')}</div>`, s => {
    s.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (claimAch(ACHIEVEMENTS.find(x => x.id === b.dataset.a))) { sfx('loot'); updateHud(); openAch(); } });
  }, { pages: np, page, onPage: p => openAch(p) });
}
function openChest() {
  const st = chestState();
  openSheet('Siegestruhe', `<div class="chestbox"><p>Jeder Sieg legt Beute in die Truhe, ein Bosssieg dreifach. Ab 5 Siegen kannst du sie öffnen, voll ist sie bei ${CHEST_MAX}.</p>
    <div class="bar big"><i style="width:${st.n / CHEST_MAX * 100}%"></i></div><p><b>${st.n} / ${CHEST_MAX}</b> Siege gesammelt</p>
    <div class="chest-r"><span>◆ ${fmt(st.gold)} Gold</span><span>★ ${fmt(st.xp)} EP</span><span>✧ ${st.mithril} Mithril</span><span>▣ ${st.items} Gegenstände</span></div>
    <button class="btn gold big" id="claimIdle" ${st.ready ? '' : 'disabled'}>${st.ready ? 'Öffnen' : 'Noch ' + (5 - st.n) + ' Siege'}</button></div>`, s => {
    s.querySelector('#claimIdle').onclick = () => { const r = claimChest(); if (!r) return; sfx('join'); lootPop(r.rw.items.slice(0, 6), r.rw.gold); if (r.rw.mithril) toast(`+${r.rw.mithril} ✧ Mithril`, 'mini'); toast(`+${fmt(r.rw.xp)} EP für die Gruppe`, 'lvl'); W.pendingParty = 1; updateHud(); closeSheet(); };
  });
}
function openSettings() {
  const S = G.settings;
  const tg = (id, on, label) => `<div class="opt"><span>${label}</span><button class="btn small ${on ? 'on' : ''}" id="${id}">${on ? 'An' : 'Aus'}</button></div>`;
  openSheet('Optionen', `<div class="m-opts"><div>
    ${tg('o-mus', S.music !== false, 'Musik')}${tg('o-snd', S.sound, 'Soundeffekte')}${tg('o-eq', S.autoEquip, 'Beste Ausrüstung automatisch')}${tg('o-party', S.autoParty, 'Gruppe automatisch')}${tg('o-ult', S.autoUlt !== false, 'Ultimates automatisch')}
    <div class="opt"><span>Grafik</span><span class="seg">${[['auto', 'Auto'], ['hoch', 'Hoch'], ['normal', 'Normal']].map(([v, l]) => `<button class="btn small ${(S.gfx || 'auto') === v ? 'on' : ''}" data-gfx="${v}">${l}</button>`).join('')}</span></div></div>
    <div><h3 class="sect">Spielstand</h3><p class="muted small">Mit dem Code stellst du deinen Fortschritt wieder her, auch auf einem anderen Gerät.</p>
    <div class="opt"><button class="btn small" id="o-exp">Code kopieren</button><button class="btn small" id="o-imp">Code einfügen</button><button class="btn small danger" id="o-del">Neu beginnen</button></div>
    <textarea id="o-code" hidden rows="2" spellcheck="false"></textarea><div id="o-impbox" hidden class="opt"><button class="btn small gold" id="o-imp2">Spielstand laden</button><span id="o-msg" class="muted small"></span></div>
    <div id="o-conf" hidden class="opt warn"><span>Alles wird gelöscht.</span><button class="btn small danger" id="o-del2">Ja, löschen</button></div>
    <p class="muted small">Inoffizielles Fan-Spiel nach J.R.R. Tolkien und „Die Ringe der Macht“. Grafiken, Texte und Mechaniken sind eigene Umsetzungen.</p></div></div>`, s => {
    s.querySelectorAll('[data-gfx]').forEach(b => b.onclick = () => { S.gfx = b.dataset.gfx; W.lowFps = false; W._pf = null; save(); openSettings(); });
    s.querySelector('#o-ult').onclick = () => { S.autoUlt = S.autoUlt === false; save(); openSettings(); };
    s.querySelector('#o-snd').onclick = () => { S.sound = !S.sound; save(); openSettings(); };
    s.querySelector('#o-mus').onclick = () => { S.music = S.music === false; save(); MUSIC.sync(); openSettings(); };
    const ta = s.querySelector('#o-code');
    s.querySelector('#o-exp').onclick = () => { ta.hidden = false; ta.readOnly = true; ta.value = exportSave(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => toast('Code kopiert', 'mini'), () => toast('Code markiert. Bitte kopieren.', 'mini')); } catch (e) { toast('Code markiert. Bitte kopieren.', 'mini'); } };
    s.querySelector('#o-imp').onclick = () => { ta.hidden = false; ta.readOnly = false; ta.value = ''; ta.placeholder = 'Code hier einfügen'; s.querySelector('#o-impbox').hidden = false; ta.focus(); };
    s.querySelector('#o-imp2').onclick = () => { if (importSave(ta.value)) { s.querySelector('#o-msg').textContent = 'Geladen. Das Spiel startet neu …'; setTimeout(() => location.reload(), 700); } else s.querySelector('#o-msg').textContent = 'Der Code ist ungültig.'; };
    s.querySelector('#o-eq').onclick = () => { S.autoEquip = !S.autoEquip; if (S.autoEquip) { autoEquip(); W.pendingParty = 1; } save(); openSettings(); };
    s.querySelector('#o-party').onclick = () => { S.autoParty = !S.autoParty; if (S.autoParty) { autoParty(); W.pendingParty = 1; buildHud(); } save(); openSettings(); };
    s.querySelector('#o-del').onclick = () => { s.querySelector('#o-conf').hidden = false; };
    s.querySelector('#o-del2').onclick = () => { store.del(SAVE_KEY); location.reload(); };
  });
}

/* ---------- Start ---------- */
function layoutMode() {
  const portrait = innerHeight > innerWidth * 1.05;
  document.body.classList.toggle('portrait', portrait);
  if (portrait && !layoutMode.dismissed) $('#rotate').hidden = false; else $('#rotate').hidden = true;
  W && W.resize();
}
function boot() {
  const has = load();
  if (!has) { newProfile(); for (const k of STORY[0].join) joinHero(k); save(); }
  W = new World($('#world'), { banner, combo: comboFx, ultUsed: () => track('ults', 1), crit: () => track('crits', 1), kill: u => { G.bestiary = G.bestiary || {}; G.bestiary[u.key] = (G.bestiary[u.key] || 0) + 1; if (u.tags?.includes('ork')) track('orcs', 1); if (u.tags?.includes('tier')) track('beasts', 1); } });
  layoutMode();
  W.speed = G.settings.speed || 1;
  W.bgKey = STORY[G.story.ch].bg;
  applyParty();
  W.walking = true; W.heroes.forEach(h => W.setAnim(h, 'walk'));
  const origWalk = W.walk.bind(W); W.walk = async ms => { if (W.pendingParty) { W.pendingParty = 0; applyParty(); } return origWalk(ms); };
  const origFight = W.fight.bind(W); W.fight = (g, l, k, o) => { W.pendingParty = 0; W.setParty(G.party); buildHud(); return origFight(g, l, k, o); };
  setInterval(updateHud, 100); updateHud();
  $('#title').hidden = false; document.body.classList.add('titled');
  $('#tContinue').textContent = has ? `Weiterspielen · Kapitel ${G.story.ch + 1}` : 'Reise beginnen';
  $('#tContinue').onclick = async () => { if (started) return; started = true; ac(); MUSIC.sync(); sfx('join'); $('#title').classList.add('out'); document.body.classList.remove('titled'); setTimeout(() => $('#title').hidden = true, 600); W.walking = false; W.heroes.forEach(h => W.setAnim(h, 'idle')); if (!G.seenHelp) { await introHelp(); G.seenHelp = 1; save(); } director(); };
  $('#nHeroes').onclick = () => { sfx('click'); openHeroes(); };
  $('#nBag').onclick = () => { sfx('click'); openBag(); };
  $('#nStory').onclick = () => { sfx('click'); openStory(); };
  $('#nAch').onclick = () => { sfx('click'); openAch(); };
  $('#nOpt').onclick = () => { sfx('click'); openSettings(); };
  $('#nQuest').onclick = () => { sfx('click'); openQuests(); };
  $('#nRelic').onclick = () => { sfx('click'); openRelics(); };
  $('#chest').onclick = () => { sfx('click'); openChest(); };
  $('#syn').onclick = () => { sfx('click'); openHeroes(); };
  ensureBoard();
  $('#spd').onclick = () => { G.settings.speed = G.settings.speed >= 3 ? 1 : G.settings.speed + 1; W.speed = G.settings.speed; $('#spd').textContent = G.settings.speed + '×'; save(); };
  $('#spd').textContent = (G.settings.speed || 1) + '×';
  $('#farm').onclick = () => { G.story.farm = false; save(); toast('Der Boss wird erneut herausgefordert!', 'lvl'); updateHud(); };
  $('#rotOk').onclick = () => { layoutMode.dismissed = 1; $('#rotate').hidden = true; };
  addEventListener('resize', layoutMode);
  $('#world').addEventListener('click', () => { if ($('#sheet').classList.contains('open')) closeSheet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
}
boot();
