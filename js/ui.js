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
  cast() { tone(520, .2, 'sine', .03, 400); }, drum() { tone(68, .55, 'sine', .1, -28); noise(.22, .035, 180); }, star() { tone(1250, .3, 'sine', .025, 900); tone(1880, .35, 'sine', .016, 700, .09); }, eagle() { tone(980, .4, 'sawtooth', .018, -520); noise(.35, .03, 2800); }, shiny() { tone(1400, .16, 'triangle', .026, 300); tone(2100, .22, 'triangle', .02, 240, .1); }, horn() { tone(196, .95, 'sawtooth', .032, 6); tone(294, .95, 'sawtooth', .018, 5, .06); }, charge() { tone(300, .25, 'sine', .02, 300); }, shout() { tone(180, .25, 'sawtooth', .03, 60); },
  heal() { tone(520, .15, 'sine', .035, 220); tone(780, .2, 'sine', .025, 220, .08); }, buff() { [392, 523, 659].forEach((f, i) => tone(f, .1, 'triangle', .03, 0, i * .06)); },
  miss() { tone(240, .12, 'sine', .025, -80); }, die() { tone(320, .4, 'sawtooth', .035, -250); },
  win() { [392, 494, 587, 784].forEach((f, i) => tone(f, .22, 'triangle', .04, 0, i * .12)); }, lose() { [392, 349, 311, 262].forEach((f, i) => tone(f, .3, 'sine', .045, 0, i * .18)); },
  ult() { [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, .25, 'sawtooth', .025, 0, i * .05)); }, level() { [523, 659, 784, 1046].forEach((f, i) => tone(f, .18, 'triangle', .045, 0, i * .09)); },
  click() { tone(480, .04, 'triangle', .02); }, loot() { [784, 988, 1318].forEach((f, i) => tone(f, .12, 'triangle', .035, 0, i * .07)); },
  join() { [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, .3, 'triangle', .04, 0, i * .1)); }, step() { }
};
function sfx(n) { try { const now = performance.now(); if (lastSfx[n] && now - lastSfx[n] < 40) return; lastSfx[n] = now; SFX[n] && SFX[n](); } catch (e) { } }

/* ---------- Musik (selbst erzeugt, eigene Motive je Region) ---------- */
const MUSIC = (() => {
  let timer = 0, next = 0, step = 0, bus = null, mode = 'explore', th = 'shire', noise = null, wantM = 'explore', wantT = 'shire';
  const _ = null;
  const REG = { shire: 'shire', lake: 'shire', rivendell: 'elves', eregion: 'elves', lorien: 'lorien', mirkwood: 'dark', dolguldur: 'dark', cirith: 'dark', khazad: 'dwarves', moria: 'dwarves', erebor: 'dwarves', helm: 'rohan', pelennor: 'rohan', amonhen: 'rohan', rhun: 'rohan', south: 'rohan', doom: 'mordor', snow: 'wild', weather: 'wild', sea: 'sea' };
  // Akkorde (Halbtöne über dem Grundton) für 4 Takte, Melodie in Vierteln (16 pro Durchlauf), Klangfarben & Schlagwerk je Region
  const TH = {
    shire:   { root: 62, bpm: 84, ch: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], mel: [12, 14, 16, 19, 17, 16, 14, _, 14, 16, 19, 21, 19, 16, 12, _], lead: 'flute', pad: 'soft', perc: 'tick', bat: 'light' },
    elves:   { root: 65, bpm: 70, ch: [[0, 4, 7], [2, 6, 9], [9, 12, 16], [0, 4, 7]], mel: [16, _, 19, 18, 14, _, 21, _, 16, 19, 21, 23, 24, _, 19, _], lead: 'harp', pad: 'choir', perc: _, bat: 'light' },
    lorien:  { root: 57, bpm: 58, ch: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], mel: [12, _, _, 15, 19, _, 17, _, 15, _, 14, _, 12, _, _, _], lead: 'choir', pad: 'choir', perc: _, bat: 'light' },
    dark:    { root: 52, bpm: 66, ch: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [10, 13, 17]], mel: [12, 13, _, 12, 10, _, 7, _, 12, 15, 13, 12, 10, 8, 7, _], lead: 'strings', pad: 'strings', perc: 'pulse', bat: 'pulse' },
    dwarves: { root: 50, bpm: 76, ch: [[0, 3, 7], [10, 14, 17], [5, 9, 12], [0, 3, 7]], mel: [12, _, 15, 17, 14, _, 12, 10, 9, 12, 14, _, 12, _, _, _], lead: 'horn', pad: 'strings', perc: 'doom', bat: 'doom' },
    rohan:   { root: 57, bpm: 88, ch: [[0, 3, 7], [10, 14, 17], [5, 9, 12], [7, 10, 14]], mel: [12, 15, 17, 19, 17, 15, 14, _, 12, 14, 15, 17, 19, _, 12, _], lead: 'fiddle', pad: 'soft', perc: 'gallop', bat: 'gallop' },
    mordor:  { root: 49, bpm: 72, ch: [[0, 3, 7], [1, 4, 8], [0, 3, 6], [1, 5, 8]], mel: [0, _, 0, 1, 0, _, 6, _, 0, _, 0, 1, 3, _, 1, _], lead: 'brass', pad: 'strings', perc: 'anvil', bat: 'anvil' },
    wild:    { root: 59, bpm: 64, ch: [[0, 3, 7], [5, 8, 12], [8, 12, 15], [7, 10, 14]], mel: [19, _, _, 15, 17, _, _, _, 20, _, 19, _, 14, _, _, _], lead: 'bells', pad: 'soft', perc: 'wind', bat: 'light' },
    sea:     { root: 55, bpm: 74, ch: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], mel: [12, 16, 19, _, 21, 19, 16, _, 17, 16, 14, 12, 14, _, _, _], lead: 'harp', pad: 'choir', perc: 'tick', bat: 'light' }
  };
  const PERC = { tick: [0, 0, .5, 0, 0, 0, .5, 0], pulse: [1, .6, 0, 0, 0, 0, 0, 0], doom: [1, 0, 0, .8, 0, 0, 0, 0], gallop: [1, 0, .45, .65, 1, 0, .45, .65], anvil: [1, 0, 0, 0, .7, 0, 0, 0], light: [1, 0, 0, 0, .7, 0, 0, 0] };
  const f = m => 440 * Math.pow(2, (m - 69) / 12);
  function out() {
    const a = ac(); if (!a) return null;
    if (!bus) { bus = a.createGain(); bus.gain.value = .5; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; const dl = a.createDelay(); dl.delayTime.value = .32; const fb = a.createGain(); fb.gain.value = .28; bus.connect(lp); lp.connect(a.destination); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(a.destination); }
    if (!noise) { noise = a.createBuffer(1, a.sampleRate * 2, a.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    return a;
  }
  function env(a, t, d, vol, att) { const g = a.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + d); g.connect(bus); return g; }
  function osc(a, type, freq, t, d, dest, det = 0) { const o = a.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det; o.connect(dest); o.start(t); o.stop(t + d + .05); return o; }
  function vib(a, o, t, d, rate, depth) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = rate; lg.gain.value = depth; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + d + .05); }
  function filt(a, freq, dest) { const fl = a.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = freq; fl.connect(dest); return fl; }
  function inst(a, name, m, t, d, vol) {
    const fr = f(m);
    if (name === 'flute') { const g = env(a, t, d, vol, .07); const o = osc(a, 'sine', fr, t, d, g); vib(a, o, t, d, 5.2, fr * .006); osc(a, 'sine', fr * 2, t, d, env(a, t, d * .6, vol * .12, .05)); }
    else if (name === 'harp') { osc(a, 'triangle', fr, t, d, env(a, t, d, vol * 1.3, .004)); osc(a, 'sine', fr * 2, t, d * .5, env(a, t, d * .5, vol * .3, .004)); }
    else if (name === 'horn') { const g = env(a, t, d, vol * .9, .09); osc(a, 'sawtooth', fr, t, d, filt(a, 900, g)); }
    else if (name === 'fiddle') { const g = env(a, t, d, vol * .7, .05); const o = osc(a, 'sawtooth', fr, t, d, filt(a, 1700, g)); vib(a, o, t, d, 6.2, fr * .008); }
    else if (name === 'choir') { const g = env(a, t, d, vol * .8, Math.min(.5, d * .4)); osc(a, 'sine', fr, t, d, g, -6); osc(a, 'sine', fr, t, d, g, 6); osc(a, 'triangle', fr * 2, t, d, env(a, t, d, vol * .1, .4)); }
    else if (name === 'strings') { const g = env(a, t, d, vol * .8, Math.min(.35, d * .3)); osc(a, 'sawtooth', fr, t, d, filt(a, 650, g)); osc(a, 'sawtooth', fr, t, d, filt(a, 650, g), 9); }
    else if (name === 'bells') { osc(a, 'sine', fr, t, d, env(a, t, d, vol * 1.2, .004)); osc(a, 'sine', fr * 2.76, t, d * .5, env(a, t, d * .5, vol * .35, .004)); }
    else if (name === 'brass') { const g = env(a, t, d, vol * 1.1, .05); osc(a, 'sawtooth', fr, t, d, filt(a, 560, g)); osc(a, 'square', fr / 2, t, d, filt(a, 300, env(a, t, d, vol * .5, .05))); }
    else osc(a, 'triangle', fr, t, d, env(a, t, d, vol, .3));
  }
  function drum(a, t, low, vol, len = .3) { const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(low ? 90 : 160, t); o.frequency.exponentialRampToValueAtTime(low ? 38 : 70, t + len * .7); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + len); o.connect(g).connect(bus); o.start(t); o.stop(t + len + .05); }
  function perc(a, kind, t, k) {
    if (!k) return;
    if (kind === 'tick') { const g = env(a, t, .05, .012 * k, .002); osc(a, 'sine', 2300, t, .05, g); }
    else if (kind === 'pulse') drum(a, t, 1, .09 * k, .35);
    else if (kind === 'doom') drum(a, t, 1, .2 * k, .7);
    else if (kind === 'gallop') drum(a, t, 0, .06 * k, .16);
    else if (kind === 'anvil') { drum(a, t, 1, .16 * k, .5); if (k < 1) { const g = env(a, t, .25, .01, .002); osc(a, 'square', 1250, t, .25, filt(a, 3000, g)); osc(a, 'square', 1870, t, .2, filt(a, 3000, g)); } }
    else if (kind === 'light') drum(a, t, 1, .1 * k, .3);
    else if (kind === 'wind') { const src = a.createBufferSource(); src.buffer = noise; const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = .7; const g = env(a, t, 2.6, .025 * k, 1.1); src.connect(bp).connect(g); src.start(t, Math.random()); src.stop(t + 2.7); }
  }
  function schedule() {
    const a = out(); if (!a) return;
    if (next < a.currentTime) next = a.currentTime + .05;
    while (next < a.currentTime + .4) {
      if (step % 8 === 0) { if (wantM !== mode) mode = wantM; if (wantT !== th) { th = wantT; step = 0; } }
      const T = TH[th], bpm = mode === 'boss' ? Math.max(110, T.bpm * 1.4) : mode === 'battle' ? Math.max(96, T.bpm * 1.25) : T.bpm, spb = 60 / bpm / 2, bar = Math.floor(step / 8) % 4, beat = step % 8, chord = T.ch[bar].map(x => x + T.root), t = next;
      if (beat === 0) { chord.forEach(m => inst(a, T.pad === 'soft' ? 'pad' : T.pad, m + (T.pad === 'strings' ? 0 : 12), t, spb * 8.5, T.pad === 'soft' ? .016 : .014)); inst(a, 'pad', chord[0] - 12, t, spb * 7, .045); }
      if (beat % 2 === 0) { const q = bar * 4 + beat / 2, mv = T.mel[q]; if (mv !== null && (mode === 'explore' || q % 2 === 0)) { let len = 2; while (len < 6 && T.mel[q + len / 2] === null && q + len / 2 < 16) len += 2; inst(a, T.lead, T.root + mv + (T.lead === 'brass' || T.lead === 'strings' || T.lead === 'horn' ? 12 : 24) - (mode === 'boss' ? 12 : 0), t, spb * len * 1.05, mode === 'explore' ? .02 : .013); } }
      if (mode !== 'explore') { const arp = [0, 1, 2, 1, 0, 2, 1, 2][beat]; inst(a, 'harp', chord[arp] + (mode === 'boss' ? 12 : 24), t, spb * 1.2, .009); if (beat % 2 === 0) inst(a, 'pad', chord[0] - (mode === 'boss' ? 12 : 0), t, spb * 1.5, .028); perc(a, T.bat, t, PERC[T.bat][beat]); if (beat === 0 || beat === 4) drum(a, t, 1, mode === 'boss' ? .18 : .1); if (mode === 'boss' && (beat === 3 || beat === 7)) drum(a, t, 0, .07); }
      else if (T.perc) perc(a, T.perc, t, T.perc === 'wind' ? (beat === 0 && bar % 2 === 0 ? 1 : 0) : PERC[T.perc][beat] * .8);
      next += spb; step++;
    }
  }
  return {
    sync() { const on = G && G.settings.music !== false && started; if (on && !timer) { timer = setInterval(() => { wantM = !W ? 'explore' : W.fighting ? (W.enemies.some(e => e.boss && alive(e)) ? 'boss' : 'battle') : 'explore'; wantT = REG[W && W.bgKey] || wantT; schedule(); }, 100); } if (!on && timer) { clearInterval(timer); timer = 0; } },
    get theme() { return th; }
  };
})();

/* ---------- Kleine Helfer ---------- */
function toast(html, cls = '') { const box = $('#toasts'); while (box.children.length >= (innerHeight < 390 || innerHeight > innerWidth ? 1 : 2)) box.firstChild.remove(); const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = html; $('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200); }
function heroCol(k) { return ROLE_COL[roleOf(k)]; }
function stars(n) { return '<span class="stars">' + [0, 1, 2].map(i => `<i class="${i <= n ? 'on' : ''}">★</i>`).join('') + '</span>'; }
function paintCards(root = document) {
  requestAnimationFrame(() => {
    root.querySelectorAll('canvas[data-card]').forEach(c => {
      const k = c.dataset.card;
      if (c.dataset.enemy) { const E = ENEMIES[k]; RIG.card(c, E.type, Object.assign({ wpn: E.wpn }, E.look), { col: '#ff5a3a', flip: 1, seed: k, bust: E.type === 'hum' && !!c.dataset.bust, zoom: +(c.dataset.zoom || 1) }); return; }
      if (!HEROES[k]) return;
      if (c.dataset.mirror) { RIG.card(c, 'hum', mirrorLook(G.heroes[k] ? heroLook(k) : lookAtStage(k, 0)), { col: '#a868ff', flip: 1, bust: !!c.dataset.bust, seed: k, zoom: +(c.dataset.zoom || 1) }); return; }
      const LK = c.dataset.stage !== undefined ? lookAtStage(k, +c.dataset.stage) : G.heroes[k] ? footLook(k) : lookAtStage(k, 0);
      RIG.card(c, 'hum', LK, { col: ROLE_COL[CLASSES[HEROES[k].cls].role], bust: !!c.dataset.bust, seed: k, zoom: +(c.dataset.zoom || 1) });
    });
    root.querySelectorAll('canvas[data-ic]').forEach(c => RIG.icon(c, c.dataset.ic, c.dataset.c, c.dataset.r !== undefined ? +c.dataset.r : 2));
  });
}
const icHtml = it => `<canvas class="ic r${it.r}" data-ic="${it.icon}" data-c="${RARITY[it.r].c}" data-r="${it.r}" style="--rc:${RARITY[it.r].c}"></canvas>`;

/* ---------- HUD ---------- */
function buildHud() {
  $('#party').innerHTML = '<div id="boons" class="boons"></div>' + G.party.map(k => `<div class="pc" data-k="${k}" style="--rc:${heroCol(k)}"><canvas data-card="${k}" data-bust="1"></canvas><div class="hpv"></div><span class="pl">${G.heroes[k].lvl}</span>${ringOf(k) ? `<i class="pc-ring" style="--rc:${ringOf(k).R.c}" title="${esc(ringOf(k).R.n)}"></i>` : ''}<div class="hpb"><i class="tr"></i><i class="hp"></i></div><div class="ultbar"><i></i></div></div>`).join('');
  $$('#party .pc').forEach(el => el.onclick = () => { if (W.manualUlt(el.dataset.k)) { sfx('ult'); return; } sfx('click'); openHero(el.dataset.k); });
  paintCards($('#party')); renderBoons.sig = null; renderBoons();
}
function updateHud() {
  if (!W || !G) return;
  applyLocks(); renderBoons();
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
  updateHud.gs = updateHud.gs ?? G.gold; { const d = G.gold - updateHud.gs; updateHud.gs = Math.abs(d) < 2 ? G.gold : updateHud.gs + Math.round(d * .25); } $('#gold').textContent = fmt(updateHud.gs); $('#mith').textContent = fmt(fragTotal()); { const nn = G.inv.filter(x => x.nw).length; $('#bBadge').hidden = !nn; $('#bBadge').textContent = nn > 9 ? '9+' : nn; } const fc = forgeableCount(); $('#fBadge').hidden = !fc; $('#fBadge').textContent = fc;
  $('#power').textContent = fmt(G.party.reduce((a, k) => a + heroStats(k).power, 0));
  const cc = claimableCount(); $('#achBadge').hidden = !cc; $('#achBadge').textContent = cc; $('#nextP').classList.toggle('dim', $('#toasts').children.length > 0);
  if (G.team) { const el = waveLvl(Math.min(G.story.wave, WAVES)), d = G.team.lvl - el, v = `<span class="${d >= 0 ? 'ok' : d >= -3 ? 'mid' : 'bad'}">Gruppe St. ${G.team.lvl}</span> · Gegner St. ${el}`; if ($('#lvc').dataset.v !== v) { $('#lvc').innerHTML = v; $('#lvc').dataset.v = v; } }
  if (!updateHud.t || Date.now() - updateHud.t > 1000) { updateHud.t = Date.now(); refreshLooks(); renderNext(); $('#world').classList.toggle('hq', W.hq()); const ev = G.party.filter(k => canEvolve(k)?.lvlOk).length; $('#hBadge').hidden = !ev; $('#hBadge').textContent = ev; }
  for (const u of W.heroes) {
    const el = document.querySelector(`#party .pc[data-k="${u.key}"]`); if (!el) continue;
    el.querySelector('.ultbar i').style.width = Math.min(100, u.energy) + '%';
    el.classList.toggle('ready', u.energy >= 100 && alive(u)); el.classList.toggle('dead', !alive(u)); el.classList.toggle('act', W.active === u);
    const f = Math.max(0, u.hp / u.maxHp); el.querySelector('.hpv').style.height = (100 - f * 100) + '%'; el.querySelector('.hpb .hp').style.width = f * 100 + '%'; el.querySelector('.hpb .tr').style.width = f * 100 + '%'; el.classList.toggle('low', f > 0 && f < .3);
    if (el._f !== undefined && W.fighting) { if (f < el._f - .01) { el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit'); } else if (f > el._f + .01) { el.classList.remove('heal'); void el.offsetWidth; el.classList.add('heal'); } } el._f = f;
    el.querySelector('.pl').textContent = G.heroes[u.key]?.lvl || '';
  }
  const boss = W.enemies.find(e => e.boss && alive(e)), bb = $('#bossbar'), tleft = W.raidEnd && W.fighting ? ` · ${Math.max(0, Math.ceil((W.raidEnd - W.time) / 1000))} s` : '';
  bb.hidden = !(boss || W.gate) || !W.fighting; bb.classList.toggle('gate', !boss && !!W.gate);
  if (!boss && W.gate) { $('#bossName').textContent = `Tor der Hornburg · Welle ${W.gate.wave}`; $('#bossFill').style.width = W.gate.hp + '%'; $('#bossTrail').style.width = W.gate.hp + '%'; $('#bossPct').textContent = Math.ceil(W.gate.hp) + ' %' + tleft; $('#bossMark').hidden = true; $('#bossMark3').hidden = true; }
  if (boss) { const bf = boss.hp / boss.maxHp * 100; $('#bossName').textContent = boss.name; $('#bossFill').style.width = bf + '%'; $('#bossTrail').style.width = bf + '%'; $('#bossPct').textContent = Math.ceil(bf) + ' %' + tleft; $('#bossMark').hidden = !!boss.phased || !(PHASE2[boss.key] || boss.transform) || bf <= 50; $('#bossMark3').hidden = !!boss.phased3 || !PHASE3[boss.key] || W.raid || bf <= 25; }
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
  items.forEach((it, i) => setTimeout(() => { while (box.children.length >= (innerHeight > innerWidth ? 2 : 4)) box.firstChild.remove(); const e = document.createElement('div'); e.className = 'lp'; e.style.setProperty('--rc', RARITY[it.r].c); e.innerHTML = `${icHtml(it)}<span>${esc(it.name)}</span>`; box.appendChild(e); paintCards(e); if (it.r >= 3) sfx('loot'); setTimeout(() => e.remove(), 2600); }, 250 + i * 300));
}

/* ---------- Dialoge & Splashes ---------- */
function speakerInfo(s) {
  if (s === 'narr') return { name: 'Erzähler', art: '<div class="narr-ic">❦</div>' };
  if (s.startsWith('e:')) { const k = s.slice(2); return { name: ENEMIES[k].n, art: `<canvas data-card="${k}" data-enemy="1" data-bust="1"></canvas>`, foe: 1 }; }
  return { name: HEROES[s].n, art: `<canvas data-card="${s}" data-bust="1"></canvas>`, col: ROLE_COL[CLASSES[HEROES[s].cls].role] };
}
function dialog(lines) {
  if (!lines || !lines.length || !G.settings.dialogs) return Promise.resolve();
  return new Promise(res => {
    W.hold = true; const box = $('#dialog'); let i = 0, typing = null, auto = null;
    const autoGo = txt => { clearTimeout(auto); if (G.settings.autoText !== false) auto = setTimeout(() => box.onclick && box.onclick(), Math.max(2200, txt.length * 52)); };
    const show = () => {
      const [s, txt] = lines[i], inf = speakerInfo(s);
      box.className = 'dlg ' + (inf.foe ? 'foe' : s === 'narr' ? 'narr' : '');
      box.innerHTML = `<div class="dport" style="--rc:${inf.col || '#ff5a3a'}">${inf.art}</div><div class="dbody"><div class="dname">${esc(inf.name)}</div><p class="dtext"></p><div class="dhint">Tippen zum Fortfahren</div></div><button class="dskip">Überspringen ›</button>`;
      box.hidden = false; paintCards(box);
      const p = box.querySelector('.dtext'); let n = 0; clearInterval(typing);
      clearTimeout(auto); typing = setInterval(() => { n += 2; p.textContent = txt.slice(0, n); if (n >= txt.length) { clearInterval(typing); typing = null; autoGo(txt); } }, 18);
      box.querySelector('.dskip').onclick = e => { e.stopPropagation(); done(); };
      box.onclick = () => { if (typing) { clearInterval(typing); typing = null; p.textContent = txt; autoGo(txt); return; } clearTimeout(auto); sfx('click'); i++; if (i >= lines.length) done(); else show(); };
    };
    const done = () => { clearInterval(typing); clearTimeout(auto); box.hidden = true; box.onclick = null; W.hold = false; res(); };
    show();
  });
}
function splash(html, ms = 0, cls = '') {
  return new Promise(res => {
    const s = $('#splash'); s.className = 'splash ' + cls; s.innerHTML = html; s.hidden = false; document.body.classList.add('splash-open'); paintCards(s); paintComps(s); paintFlags(s); bindMem(s);
    W.hold = true;
    const close = () => { s.classList.add('out'); setTimeout(() => { s.hidden = true; s.classList.remove('out'); document.body.classList.remove('splash-open'); W.hold = false; res(); }, 300); };
    if (ms) setTimeout(close, ms); else { s.onclick = () => { s.onclick = null; sfx('click'); close(); }; }
  });
}
/* ---------- Erinnerungsbild: die Gruppe nach einem großen Sieg als Bild zum Sichern ---------- */
let memInfo = null;
function memBtn(info) { memInfo = info; return `<button class="btn small gold mem" data-mem="1">📷 Erinnerungsbild</button>`; }
function bindMem(root) { const b = root.querySelector('[data-mem]'); if (b) b.onclick = e => { e.stopPropagation(); if (memInfo) memory(memInfo); }; }
async function memory(info) {
  sfx('click'); toast('Erinnerungsbild wird gemalt …', 'mini');
  const W2 = 1600, H2 = 900, cv = document.createElement('canvas'); cv.width = W2; cv.height = H2; const c = cv.getContext('2d'), s = H2 / 144, gt = 1200;
  try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 40px Cinzel'), new Promise(r => setTimeout(r, 800))]); } catch (e) { }
  c.drawImage(RIG.background(info.bg, W2, H2), 0, 0);
  c.save(); c.scale(s, s);
  const lm = RIG.landmark(info.bg, s); if (lm) { const k = lm.k, w = lm.w * k, h = lm.h * k; c.save(); c.translate(256 * .64 - w / 2, 92 - h + lm.base * k); c.scale(k, k); c.drawImage(lm.cv, 0, 0, lm.w, lm.h); c.restore(); }
  c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const a = 1.95 + i * .13, g = c.createLinearGradient(220, -10, 220 + Math.cos(a) * 200, -10 + Math.sin(a) * 200); g.addColorStop(0, 'rgba(255,236,190,.16)'); g.addColorStop(1, 'rgba(255,236,190,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(220, -10); c.lineTo(220 + Math.cos(a - .03) * 260, -10 + Math.sin(a - .03) * 260); c.lineTo(220 + Math.cos(a + .03) * 260, -10 + Math.sin(a + .03) * 260); c.fill(); } c.restore();
  if (info.foe && ENEMIES[info.foe]) { const E = ENEMIES[info.foe], big = E.type !== 'hum' || RIG.dims(E.type, E.look).big; c.save(); c.translate(206, 113); c.scale(-1.1 * (big ? .85 : 1.2), 1.1 * (big ? .85 : 1.2)); c.globalAlpha = .92; RIG.draw(c, E.type, Object.assign({ wpn: E.wpn || 'sword' }, E.look), 'dead', 9999, 700); c.restore(); }
  const BN = G.banner && BANNERS.find(b => b.id === G.banner); if (BN) { c.save(); c.translate(20, 114); c.scale(1.45, 1.45); RIG.flag(c, { em: BN.em, cloth: BN.cloth, emCol: BN.emCol, t: 1700 }); c.restore(); }
  const party = (info.party || G.party).filter(k => G.heroes[k]).sort((a, b) => (CLASSES[HEROES[a].cls].role === 'tank' ? 0 : 1) - (CLASSES[HEROES[b].cls].role === 'tank' ? 0 : 1));
  const slots = [[104, 119], [80, 109], [128, 110], [58, 121], [152, 122]], placed = party.map((k, i) => ({ k, x: slots[i % 5][0], y: slots[i % 5][1] })).sort((a, b) => a.y - b.y);
  for (const p2 of placed) { c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(p2.x, p2.y + .5, 9, 2.2, 0, 0, 6.29); c.fill(); c.translate(p2.x, p2.y); c.scale(1.32, 1.32); RIG.draw(c, 'hum', footLook(p2.k), 'victory', 380 + party.indexOf(p2.k) * 170, gt + party.indexOf(p2.k) * 333); c.restore(); }
  c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 60; i++) { const x = (i * 97) % 256, y = 20 + (i * 53) % 100, r = .3 + (i % 5) * .12; const g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, 'rgba(255,230,160,.7)'); g.addColorStop(1, 'rgba(255,230,160,0)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3, 0, 6.29); c.fill(); } c.restore();
  c.restore();
  let g = c.createLinearGradient(0, 0, 0, H2); g.addColorStop(0, 'rgba(255,214,150,.10)'); g.addColorStop(1, 'rgba(60,30,10,.18)'); c.save(); c.globalCompositeOperation = 'soft-light'; c.fillStyle = g; c.fillRect(0, 0, W2, H2); c.restore();
  g = c.createRadialGradient(W2 / 2, H2 * .45, H2 * .35, W2 / 2, H2 * .5, W2 * .7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = g; c.fillRect(0, 0, W2, H2);
  g = c.createLinearGradient(0, H2 - 260, 0, H2); g.addColorStop(0, 'rgba(6,5,4,0)'); g.addColorStop(.55, 'rgba(6,5,4,.72)'); g.addColorStop(1, 'rgba(6,5,4,.9)'); c.fillStyle = g; c.fillRect(0, H2 - 260, W2, 260);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.fillStyle = '#e8bd5c'; c.font = '700 24px Cinzel, Georgia, serif'; c.fillText(info.kicker.toUpperCase().split('').join(String.fromCharCode(8202)), W2 / 2, H2 - 152);
  c.shadowColor = 'rgba(255,190,90,.55)'; c.shadowBlur = 22; c.fillStyle = '#ffe6a8'; c.font = '700 64px Cinzel, Georgia, serif'; c.fillText(info.title, W2 / 2, H2 - 92); c.shadowBlur = 0;
  c.fillStyle = '#efe4cc'; c.font = '600 24px Georgia, serif'; c.fillText(party.map(k => HEROES[k].n).join('  ·  '), W2 / 2, H2 - 54);
  c.fillStyle = 'rgba(232,220,192,.6)'; c.font = '500 17px Georgia, serif'; c.fillText(`Ringfahrt  ·  Gruppe Stufe ${G.team.lvl}  ·  ${new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`, W2 / 2, H2 - 26);
  c.strokeStyle = 'rgba(232,189,92,.85)'; c.lineWidth = 5; c.strokeRect(16, 16, W2 - 32, H2 - 32); c.strokeStyle = 'rgba(232,189,92,.45)'; c.lineWidth = 1.5; c.strokeRect(28, 28, W2 - 56, H2 - 56);
  c.fillStyle = '#e8bd5c'; for (const [x, y] of [[16, 16], [W2 - 16, 16], [16, H2 - 16], [W2 - 16, H2 - 16]]) { c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-9, -9, 18, 18); c.restore(); }
  cv.toBlob(blob => blob && showMemory(blob, info), 'image/png');
}
function showMemory(blob, info) {
  let el = $('#memo'); if (!el) { el = document.createElement('div'); el.id = 'memo'; $('#app').appendChild(el); }
  const url = URL.createObjectURL(blob), file = typeof File !== 'undefined' ? new File([blob], 'ringfahrt-erinnerung.png', { type: 'image/png' }) : null, share = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
  el.innerHTML = `<div class="memo-in"><img src="${url}" alt="Erinnerungsbild"><div class="memo-b">${share ? '<button class="btn gold" id="memS">⇪ Teilen / In Fotos sichern</button>' : `<a class="btn gold" id="memD" href="${url}" download="ringfahrt-erinnerung.png">⇩ Bild sichern</a>`}<button class="btn" id="memX">Schließen</button></div><small>Tipp: Bild gedrückt halten und „Zu Fotos hinzufügen“ wählen.</small></div>`;
  el.hidden = false; sfx('join');
  el.onclick = e => e.stopPropagation();
  const close = () => { el.hidden = true; setTimeout(() => URL.revokeObjectURL(url), 2000); };
  el.querySelector('#memX').onclick = e => { e.stopPropagation(); close(); };
  const sb = el.querySelector('#memS'); if (sb) sb.onclick = async e => { e.stopPropagation(); try { await navigator.share({ files: [file], title: info.title }); } catch (err) { } };
}
/* Drei verdeckte Truhen: eine wählen, danach werden alle aufgedeckt */
function pickChest(title, mith) {
  // Keine Truhenwahl mehr: nach jedem Kapitel gibt es immer direkt den Gegenstand
  const lv = chapterLvl() + 2, it = genItem(lv, Math.random() < .35 ? 4 : 3);
  addItem(it); if (G.settings.autoEquip) autoEquip(); save(); updateHud();
  const C = STORY[G.story.ch];
  return splash(`<div class="cdone"><div class="kicker">Kapitel abgeschlossen · ◈ ${mith} Ringfragment</div><h1>${esc(title)}</h1><p>Deine Belohnung</p><div class="loot1">${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b></div><div class="dhint">${memBtn({ kicker: `Kapitel ${G.story.ch + 1} bezwungen`, title, bg: chBg(C), foe: C.boss.find(k => ENEMIES[k].boss) || C.boss[0] })}<span>Tippen zum Fortfahren</span></div></div>`, 0, 'doneS');
}
function paintPano(cv, key) {
  if (!cv) return; const dpr = Math.min(2, devicePixelRatio || 1), Wc = cv.clientWidth || 800, Hc = cv.clientHeight || 300; cv.width = Math.round(Wc * dpr); cv.height = Math.round(Hc * dpr);
  const c = cv.getContext('2d'), s = Math.max(cv.height / 124, cv.width / 270), LWp = cv.width / s, L = RIG.layers(key, s), lm = RIG.landmark(key, s), yo = Math.max(-8, cv.height / s - 128);
  const B = (BACKGROUNDS[key] || {}), sk = B.sky || ['#1a1e28', '#2a3040', '#3a4050']; let gr = c.createLinearGradient(0, 0, 0, cv.height); gr.addColorStop(0, sk[0]); gr.addColorStop(.6, sk[sk.length - 1]); gr.addColorStop(.61, B.gd || '#1a1a1a'); gr.addColorStop(1, B.gd || '#1a1a1a'); c.fillStyle = gr; c.fillRect(0, 0, cv.width, cv.height);
  c.setTransform(s, 0, 0, s, 0, 0); c.imageSmoothingEnabled = true;
  const tile = (img, y, hh) => { for (let x = -20; x < LWp + L.TW; x += L.TW) c.drawImage(img, x, y, L.TW, hh); };
  const land = (dy) => { const k = lm.k * Math.min(1.2, LWp * .92 / (lm.w * lm.k)), ww = lm.w * k, hh = lm.h * k; c.save(); c.translate(LWp * .5 - ww / 2, L.HZ + yo - hh + lm.base * k + dy); c.scale(k, k); c.drawImage(lm.cv, 0, 0, lm.w, lm.h); if (lm.anim) lm.anim(c, 0, 0, performance.now()); c.restore(); };
  tile(L.sky, yo, L.HZ + 4); tile(L.far, yo, L.HZ + 4); if (lm && !lm.front) land(2);
  tile(L.mid, yo, L.HZ + 4); if (lm && lm.front) land(6);
  tile(L.ground, L.HZ + yo, Math.max(60, cv.height / s - L.HZ - yo + 2));
}
function panoSplash(kicker, h1, h2, key, ms, extra = '') { const pr = splash(`<div class="ctitle pano"><canvas class="cpano"></canvas><div class="ct-text"><div class="kicker">${kicker}</div><h1>${h1}</h1><h2>${h2}</h2>${extra}</div></div>`, ms, 'chap panoS'); paintPano($('#splash .cpano'), key); return pr; }
/* ---------- Kinomomente: gemalte, animierte Szenen ohne Text ---------- */
const CINE_AT = { 3: 'smaug', 8: 'balrog', 10: 'helm', 13: 'doom', 14: 'havens' };
function cinema(key) {
  const pr = splash(`<div class="cine"><canvas class="cinecv"></canvas><div class="cine-bar t"></div><div class="cine-bar b"></div></div>`, 0, 'cineS'), cv = $('#splash .cinecv'), s0 = $('#splash'), close = s0.onclick;
  const t0 = performance.now(), DUR = 5600; let done = false; setTimeout(() => { if (!done && s0.onclick === close) close && close(); }, DUR + 200); pr.then(() => { done = true; });
  const dpr = Math.min(2, devicePixelRatio || 1); sfx('ult');
  const frame = now => { if (done || !cv.isConnected) return; const w = cv.clientWidth * dpr, h = cv.clientHeight * dpr; if (cv.width !== Math.round(w)) { cv.width = Math.round(w); cv.height = Math.round(h); }
    const c = cv.getContext('2d'), t = Math.min(1, (now - t0) / DUR), S = Math.min(cv.width / 160, cv.height / 90); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(S, 0, 0, S, (cv.width - 160 * S) / 2, (cv.height - 90 * S) / 2); c.save(); const z = 1 + t * .06; c.translate(80, 45); c.scale(z, z); c.translate(-80, -45);
    CINE[key](c, t, now); c.restore();
    const fade = Math.min(1, t * 8, (1 - t) * 8); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(0,0,0,${1 - fade})`; c.fillRect(0, 0, cv.width, cv.height); requestAnimationFrame(frame); };
  requestAnimationFrame(frame); return pr;
}
const cSky = (c, cols) => { const g = c.createLinearGradient(0, 0, 0, 90); cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col)); c.fillStyle = g; c.fillRect(-20, -20, 200, 130); };
const cGlow = (c, x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, RIG.rgba(col, a)); g.addColorStop(1, RIG.rgba(col, 0)); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
const cDragon = (c, x, y, sc, rot, flap, col) => { c.save(); c.translate(x, y); c.rotate(rot); c.scale(sc, sc); c.fillStyle = col; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(-4, -3, 6, -1); c.lineTo(12, -3); c.lineTo(14, -1.5); c.lineTo(8, 1); c.quadraticCurveTo(0, 3, -10, 2); c.quadraticCurveTo(-20, 4, -26, 1); c.quadraticCurveTo(-18, 1.5, -14, 0); c.fill(); for (const s2 of [1, -.6]) { c.beginPath(); c.moveTo(-6, -1); c.lineTo(-2 - s2 * 2, -14 * s2 * flap - 2); c.lineTo(6, -8 * s2 * flap - 1); c.lineTo(2, -1); c.closePath(); c.fill(); } c.restore(); };
const CINE = {
  smaug(c, t, now) { cSky(c, ['#050812', '#141c34', '#3a2a3a']); for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${.3 + .3 * Math.sin(now / 500 + i)})`; c.fillRect((i * 37) % 160, (i * 13) % 40, .4, .4); }
    c.fillStyle = '#0c1220'; c.fillRect(-20, 62, 200, 40); const fire = .6 + .4 * Math.sin(now / 120);
    for (let i = 0; i < 9; i++) { const x = 20 + i * 14, hh = 6 + (i % 3) * 3; c.fillStyle = '#05070c'; c.fillRect(x, 62 - hh, 9, hh); c.beginPath(); c.moveTo(x - 1, 62 - hh); c.lineTo(x + 4.5, 57 - hh); c.lineTo(x + 10, 62 - hh); c.fill(); cGlow(c, x + 4.5, 60 - hh, 10, '#ff6a20', .35 * fire * (1 - Math.max(0, t - .7) * 2)); }
    const fall = Math.max(0, (t - .5) / .5), dx = 150 - t * 90, dy = 22 + fall * fall * 46; cDragon(c, dx, dy, 1.6, fall * 1.1, Math.sin(now / 160) * (1 - fall), '#1a0806');
    if (t < .55) cGlow(c, dx + 18, dy, 14 * (.5 + .5 * Math.sin(now / 90)), '#ff7a20', .5);
    if (t > .38 && t < .56) { const k = (t - .38) / .12; c.strokeStyle = '#d8c8a0'; c.lineWidth = .8; c.beginPath(); c.moveTo(20 + k * (dx - 20 - 4), 70 - k * (70 - dy)); c.lineTo(20 + Math.max(0, k - .15) * (dx - 24), 70 - Math.max(0, k - .15) * (70 - dy)); c.stroke(); }
    if (fall > .85) { const k = (fall - .85) / .15; cGlow(c, dx, 66, 40 * k, '#ffd0a0', .6 * (1 - k * .5)); c.fillStyle = `rgba(220,230,240,${.6 * (1 - k)})`; for (let i = 0; i < 20; i++) c.fillRect(dx + (i - 10) * 1.5, 64 - Math.sin(i) * 10 * k, .6, 2); }
    c.fillStyle = 'rgba(255,140,60,.18)'; c.fillRect(-20, 62, 200, 1.2); },
  balrog(c, t, now) { cSky(c, ['#020203', '#08060a', '#1a0a06']); cGlow(c, 120, 80, 70, '#ff4a10', .35);
    const brk = Math.max(0, (t - .55) / .45); c.fillStyle = '#16120f'; c.fillRect(-20, 52, 92 - brk * 4, 3); if (brk < .3) c.fillRect(72, 52, 108, 3); else { c.save(); c.translate(100, 53 + (brk - .3) * 120); c.rotate((brk - .3) * .6); c.fillRect(-28, -1.5, 108, 3); c.restore(); }
    c.fillStyle = '#0a0808'; c.fillRect(-20, 55, 60, 50); c.fillRect(140, 55, 60, 50);
    const gx = 58, light = t > .4 ? 1 : t / .4; c.fillStyle = '#8a8a90'; c.beginPath(); c.moveTo(gx - 3, 52); c.lineTo(gx - 1.5, 38); c.lineTo(gx + 1.5, 38); c.lineTo(gx + 3, 52); c.fill(); c.beginPath(); c.arc(gx, 36.5, 1.8, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#6a5a40'; c.lineWidth = .7; c.beginPath(); c.moveTo(gx + 3, 52); c.lineTo(gx + 4, 30); c.stroke(); cGlow(c, gx + 4, 30, 8 + light * 18 * (t > .45 && t < .55 ? 2 : 1), '#ffffff', .8 * light);
    const by = 52 + (brk > .3 ? (brk - .3) * (brk - .3) * 200 : 0); c.save(); c.translate(102, by); c.fillStyle = '#0c0606'; c.beginPath(); c.moveTo(-8, 0); c.lineTo(-6, -22); c.lineTo(0, -28); c.lineTo(6, -22); c.lineTo(8, 0); c.fill(); for (const s2 of [-1, 1]) { c.beginPath(); c.moveTo(0, -20); c.quadraticCurveTo(s2 * 18, -34 - Math.sin(now / 300) * 3, s2 * 24, -18); c.quadraticCurveTo(s2 * 12, -18, 0, -14); c.fill(); } cGlow(c, 0, -26, 16, '#ff6a10', .7); for (let i = 0; i < 8; i++) { const k = ((now / 600) + i / 8) % 1; c.fillStyle = `rgba(255,${120 + i * 10},40,${1 - k})`; c.fillRect(-6 + i * 1.6, -26 - k * 14, .8, .8); } c.restore();
    if (t > .6) { c.strokeStyle = 'rgba(255,120,40,.8)'; c.lineWidth = .6; c.beginPath(); c.moveTo(96, by - 10); c.quadraticCurveTo(80, 40, gx + 2, 50); c.stroke(); } },
  helm(c, t, now) { const d = Math.min(1, t * 1.6); cSky(c, [`rgb(${20 + d * 200},${24 + d * 140},${40 + d * 60})`, `rgb(${30 + d * 225},${30 + d * 190},${50 + d * 90})`, '#2a2a30']);
    const sunY = 70 - d * 40; cGlow(c, 40, sunY, 30 + d * 30, '#fff0c0', .9 * d); c.fillStyle = '#fff8e0'; c.beginPath(); c.arc(40, sunY, 5, 0, Math.PI * 2); c.fill();
    c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 9; i++) { const a = -1.3 + i * .32; c.fillStyle = `rgba(255,230,170,${.06 * d})`; c.beginPath(); c.moveTo(40, sunY); c.lineTo(40 + Math.cos(a) * 200, sunY + Math.sin(a + .1) * 200); c.lineTo(40 + Math.cos(a + .08) * 200, sunY + Math.sin(a + .18) * 200); c.fill(); } c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#1a1814'; c.beginPath(); c.moveTo(-20, 60); c.quadraticCurveTo(30, 30, 70, 52); c.quadraticCurveTo(110, 70, 180, 64); c.lineTo(180, 110); c.lineTo(-20, 110); c.fill();
    for (let i = 0; i < 14; i++) { const k = Math.max(0, t - .35 - (i % 5) * .03), x = 34 + k * 140 + (i % 5) * 3 - Math.floor(i / 5) * 6, y = 38 + k * 32 + Math.floor(i / 5) * 4 + Math.abs(Math.sin(now / 110 + i)) * .8; if (t < .35 && i) continue; c.fillStyle = i ? '#141210' : '#f4f4ff'; c.beginPath(); c.ellipse(x, y, 3.2, 1.6, 0, 0, Math.PI * 2); c.fill(); c.fillRect(x + 2, y - 3, 1.2, 3); c.fillRect(x - 2, y, .8, 3); c.fillRect(x + 1.6, y, .8, 3); c.fillRect(x - .5, y - 4.5, 1.4, 3); if (!i) cGlow(c, x, y - 3, 10, '#ffffff', .8); } },
  doom(c, t, now) { cSky(c, ['#1a0806', '#4a1408', '#8a2a10']); const er = Math.max(0, (t - .5) / .5);
    c.fillStyle = '#0c0606'; c.beginPath(); c.moveTo(20, 90); c.lineTo(62, 34); c.lineTo(78, 34); c.lineTo(120, 90); c.fill(); cGlow(c, 70, 34, 14 + er * 60, '#ff6a10', .7 + er * .3);
    c.save(); c.translate(138, 90); c.rotate(er * .5); c.fillStyle = '#060404'; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-4, -60 + er * 20); c.lineTo(0, -66 + er * 20); c.lineTo(4, -60 + er * 20); c.lineTo(6, 0); c.fill(); if (er < .3) { cGlow(c, 0, -58, 6, '#ff4a10', .9); } c.restore();
    if (t < .55) { const ry = 6 + (t / .55) * 28; cGlow(c, 70, ry, 6, '#ffd860', .8); c.strokeStyle = '#ffd860'; c.lineWidth = .9; c.beginPath(); c.ellipse(70, ry, 2, 1.2, now / 200, 0, Math.PI * 2); c.stroke(); }
    if (er > 0) { for (let i = 0; i < 30; i++) { const a = -Math.PI / 2 + (i - 15) * .07, v = er * (40 + (i % 7) * 6); c.fillStyle = `rgba(255,${80 + (i % 5) * 30},20,${1 - er * .7})`; c.beginPath(); c.arc(70 + Math.cos(a) * v, 34 + Math.sin(a) * v + er * er * 30, 1.2, 0, Math.PI * 2); c.fill(); } c.fillStyle = `rgba(255,220,160,${Math.max(0, .5 - er)})`; c.fillRect(-20, -20, 200, 130); }
    if (t > .72) for (let i = 0; i < 3; i++) { const k = (t - .72) / .28, x = -20 + k * 120 + i * 14, y = 18 + i * 6 + Math.sin(now / 300 + i) * 2; c.fillStyle = '#2a1a10'; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - 6, y - 4 - Math.sin(now / 150 + i) * 3, x - 12, y - 1); c.quadraticCurveTo(x - 6, y - 1, x, y + 1); c.quadraticCurveTo(x + 6, y - 1, x + 12, y - 1); c.quadraticCurveTo(x + 6, y - 4 - Math.sin(now / 150 + i) * 3, x, y); c.fill(); } },
  havens(c, t, now) { cSky(c, ['#2a2a5a', '#d87a50', '#ffd8a0']); cGlow(c, 30, 56, 40, '#ffe0a0', .8); c.fillStyle = '#fff4d8'; c.beginPath(); c.arc(30, 56, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1a2a4a'; c.fillRect(-20, 58, 200, 40); c.fillStyle = 'rgba(255,220,160,.5)'; for (let i = 0; i < 18; i++) { const y = 60 + i * 1.6, w2 = 4 + i * 1.4 + Math.sin(now / 300 + i) * 1.5; c.fillRect(30 - w2 / 2, y, w2, .5); }
    c.fillStyle = '#0c1424'; c.beginPath(); c.moveTo(130, 58); c.lineTo(180, 40); c.lineTo(180, 100); c.lineTo(120, 100); c.fill(); for (let i = 0; i < 3; i++) c.fillRect(140 + i * 10, 40 - i * 3, 3, 18 + i * 3);
    const sx = 112 - t * 74, sc = 1 - t * .55, sy2 = 57; c.save(); c.translate(sx, sy2); c.scale(sc, sc); c.fillStyle = '#f4f0e8'; c.beginPath(); c.moveTo(-8, 0); c.quadraticCurveTo(0, 3, 9, 0); c.lineTo(7, -1.5); c.lineTo(-6, -1.5); c.closePath(); c.fill(); c.fillRect(-.3, -14, .6, 13); c.beginPath(); c.moveTo(.4, -13); c.quadraticCurveTo(6, -8, .4, -2); c.fill(); c.beginPath(); c.moveTo(-.4, -11); c.quadraticCurveTo(-4.5, -7, -.4, -3); c.fill(); c.beginPath(); c.moveTo(9, 0); c.quadraticCurveTo(11, -3, 10, -5); c.lineTo(9, -4.4); c.quadraticCurveTo(9.6, -2.6, 8, -.6); c.fill(); c.restore(); cGlow(c, sx, sy2 - 6 * sc, 12 * sc, '#ffffff', .4);
    for (let i = 0; i < 24; i++) { c.fillStyle = `rgba(255,255,255,${Math.max(0, t - .5) * (.6 + .4 * Math.sin(now / 400 + i))})`; c.fillRect((i * 41) % 160, (i * 17) % 30, .5, .5); } }
};
/* ---------- Rast am Lagerfeuer nach jedem Kapitel ---------- */
function campScene() {
  const pr = splash(`<div class="cine"><canvas class="cinecv"></canvas><div class="cine-bar t"></div><div class="cine-bar b"></div></div>`, 0, 'cineS'), cv = $('#splash .cinecv'), s0 = $('#splash'), close = s0.onclick, t0 = performance.now(), DUR = 3800; let done = false;
  setTimeout(() => { if (!done && s0.onclick === close) close && close(); }, DUR); pr.then(() => { done = true; });
  const party = G.party.slice(0, 5), spots = [[46, 73, 1], [60, 77, 1], [102, 77, -1], [116, 73, -1], [130, 70, -1]], cp = COMPANIONS.find(c => c.id === G.companion && G.comps[c.id]), dpr = Math.min(2, devicePixelRatio || 1);
  const looks = party.map(k => { const L = heroLook(k); delete L.mount; return L; });
  const frame = now => { if (done || !cv.isConnected) return; const w = cv.clientWidth * dpr, h = cv.clientHeight * dpr; if (cv.width !== Math.round(w)) { cv.width = Math.round(w); cv.height = Math.round(h); }
    const c = cv.getContext('2d'), t = (now - t0) / DUR, S = Math.min(cv.width / 160, cv.height / 90), fl = .85 + Math.sin(now / 90) * .08 + Math.sin(now / 37) * .06;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#000'; c.fillRect(0, 0, cv.width, cv.height); c.setTransform(S, 0, 0, S, (cv.width - 160 * S) / 2, (cv.height - 90 * S) / 2);
    cSky(c, ['#04060e', '#0c1430', '#1a1e34']); for (let i = 0; i < 60; i++) { c.fillStyle = `rgba(255,255,255,${.25 + .35 * Math.abs(Math.sin(now / 700 + i))})`; c.fillRect((i * 53) % 160, (i * 29) % 46, .4, .4); }
    cGlow(c, 128, 16, 16, '#dfe8ff', .3); c.fillStyle = '#eef2ff'; c.beginPath(); c.arc(128, 16, 3.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0e18'; c.beginPath(); c.moveTo(-10, 56); c.quadraticCurveTo(30, 40, 60, 52); c.quadraticCurveTo(100, 38, 170, 54); c.lineTo(170, 100); c.lineTo(-10, 100); c.fill();
    for (const x of [8, 18, 142, 152]) { c.fillStyle = '#05070c'; c.beginPath(); c.moveTo(x, 66); c.lineTo(x + 5, 38); c.lineTo(x + 10, 66); c.fill(); }
    c.fillStyle = '#0e1008'; c.fillRect(-10, 66, 180, 40);
    cGlow(c, 80, 68, 60 * fl, '#ff9a40', .32);
    if (cp && cp.kind === 'pony') { c.save(); c.translate(26, 74); c.scale(.55, .55); RIG.draw(c, 'quad', Object.assign({ horse: 1, pony: 1 }, cp.look), 'idle', 0, now); c.restore(); }
    party.forEach((k, i) => { const [x, y, d] = spots[i]; c.save(); c.translate(x, y); c.scale(.62 * d, .62); RIG.draw(c, 'hum', looks[i], 'idle', 0, now + i * 400); c.restore(); });
    c.fillStyle = '#3a2416'; c.save(); c.translate(80, 71); for (const a of [-.4, .4, 0]) { c.save(); c.rotate(a); c.fillRect(-7, -1, 14, 2); c.restore(); } c.restore();
    c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const ph = now / (140 + i * 23) + i, hh = 7 + Math.sin(ph) * 2 + (i % 3), xx = 80 + (i - 2.5) * 1.6; const g = c.createLinearGradient(xx, 71, xx, 71 - hh); g.addColorStop(0, 'rgba(255,120,30,.9)'); g.addColorStop(.6, 'rgba(255,200,80,.6)'); g.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(xx - 2.2, 71); c.quadraticCurveTo(xx - 1, 71 - hh * .6, xx + Math.sin(ph * 2) * 1.2, 71 - hh); c.quadraticCurveTo(xx + 1.2, 71 - hh * .5, xx + 2.2, 71); c.fill(); }
    for (let i = 0; i < 14; i++) { const k2 = ((now / 1300) + i / 14) % 1; c.fillStyle = `rgba(255,${170 + i * 5},80,${1 - k2})`; c.fillRect(80 + Math.sin(i * 2.7 + now / 400) * 4 * k2, 68 - k2 * 30, .6, .6); }
    for (let i = 0; i < 5; i++) { const [x, y] = spots[i] || [0, 0]; if (i < party.length) cGlow(c, x + (x < 80 ? 3 : -3), y - 9, 9, '#ffb060', .18 * fl); }
    c.globalCompositeOperation = 'source-over';
    const fade = Math.min(1, t * 6, (1 - t) * 6); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = `rgba(0,0,0,${1 - Math.max(0, fade)})`; c.fillRect(0, 0, cv.width, cv.height); requestAnimationFrame(frame); };
  requestAnimationFrame(frame); return pr;
}
function travelSplash(from, to) {
  const A = STORY[from], B = STORY[to]; if (!A || !B || !A.map || !B.map) return Promise.resolve();
  const part = PARTS.indexOf(B.part), same = A.part === B.part, pr = splash(`<div class="travel"><canvas class="trmap"></canvas></div>`, 2600, 'chap trS');
  const cv = $('#splash .trmap'), t0 = performance.now(), from2 = same ? A.map : B.map;
  const step = now => { if ($('#splash').hidden || !cv.isConnected) return; const k = Math.min(1, (now - t0) / 2000), e2 = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, mx = (from2[0] + B.map[0]) / 2, my = Math.min(from2[1], B.map[1]) - 6, u = 1 - e2;
    const pos = [u * u * from2[0] + 2 * u * e2 * mx + e2 * e2 * B.map[0], u * u * from2[1] + 2 * u * e2 * my + e2 * e2 * B.map[1]];
    drawMap(cv, part, to, { pos }); const c = cv.getContext('2d'), sx = cv.width / 100, sy = cv.height / 75, r = Math.min(sx, sy);
    c.save(); c.strokeStyle = 'rgba(160,40,20,.85)'; c.lineWidth = r * .7; c.setLineDash([r * 1.2, r * .8]); c.beginPath(); for (let i = 0; i <= 20; i++) { const t = e2 * i / 20, v = 1 - t; const px = v * v * from2[0] + 2 * v * t * mx + t * t * B.map[0], py = v * v * from2[1] + 2 * v * t * my + t * t * B.map[1]; i ? c.lineTo(px * sx, py * sy) : c.moveTo(px * sx, py * sy); } c.stroke(); c.restore();
    requestAnimationFrame(step); };
  requestAnimationFrame(() => requestAnimationFrame(step));
  return pr;
}
function chapterNews(i) { if (G.story.loop) return []; return [...UNLOCKS.filter(U => U.at >= i && U.at < i + 1).map(U => U.n), ...RINGS.filter(R => R.from === i && i > 0).map(R => R.n.split(',')[0] + '-Fragmente')]; }
function chapterTitle(ch) { const nw = chapterNews(G.story.ch); return panoSplash(esc(ch.part), `Kapitel ${G.story.ch + 1}`, esc(ch.n), chBg(ch, 0), nw.length ? 3300 : 2800, nw.length ? `<div class="ct-new">✦ Neu in diesem Kapitel: ${nw.map(esc).join(' · ')}</div>` : ''); }
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
  if (r.aborted) return; lastWin = !!r.win;
  if (G.tempBuff && --G.tempBuff.fights <= 0) { G.tempBuff = null; W.pendingParty = 1; }
  const party = G.party.slice();
  if (r.win) {
    G.stats.wins++; addChest(kind === 'boss' ? 3 : 1);
    for (const k of party) if (G.heroes[k]) { const before = fameRank(k); G.heroes[k].fame = (G.heroes[k].fame || 0) + (kind === 'boss' ? 3 : 1); const after = fameRank(k); if (after > before) { W.pendingParty = 1; toast(`✦ ${esc(HEROES[k].n)} ist jetzt <b>${FAME[after][1]}</b>`, 'lvl'); } }
    const rw = battleReward(kind, r.enemies.filter(e => e.xp));
    if (r.shiny && r.shiny.length) { const lv = r.enemies.reduce((a, e) => Math.max(a, e.lvl || 1), 1) + 2; G.shinies = G.shinies || {}; for (const k of r.shiny) { rw.items.push(genItem(lv, topRarity(.12, .88))); G.shinies[k] = (G.shinies[k] || 0) + 1; } }
    if (kind === 'boss' && r.setCh !== undefined) { const S2 = chapterSet(r.setCh); if (S2 && Math.random() < .6) rw.items.push(genSetItem(S2, r.enemies.reduce((a, e) => Math.max(a, e.lvl), 1))); }
    const lvBefore = Object.fromEntries(owned().map(k => [k, G.heroes[k].lvl]));
    autoEquip.last = []; const res = applyReward(rw, party); suggestGear(rw.items); autoClean();
    { const top = rw.items.reduce((m, it) => Math.max(m, it.r), 0), src = r.enemies.find(e => e.boss) || r.enemies[r.enemies.length - 1]; if (top >= 4 && src) { W.fxs.push({ k: 'beam', x: src.x + src.ox, y: src.y + src.oy, c: RARITY[top].c, t: 0, dur: 2200, under: 0 }); sfx('loot'); W.flash(RARITY[top].c, 260); } }
    lootPop(rw.items, rw.gold);
    const r0 = Object.values(res)[0];
    if (r0 && r0.ups) {
      const a = r0.from, b = G.team.lvl; sfx('level'); toast(`Gruppenstufe <b>${b}</b>! Alle Helden werden stärker.`, 'lvl'); setTimeout(() => W.levelFx(b), 600);
      for (const k of party) { const H = HEROES[k]; if (a < ACT2_LVL && b >= ACT2_LVL) toast(`${esc(H.n)}: neue Fähigkeit <b>${esc(H.act2.n)}</b>`, 'unlock'); H.pas.forEach(ps => { if (ps.lvl > 1 && a < ps.lvl && b >= ps.lvl) toast(`${esc(H.n)}: Passiv <b>${esc(ps.n)}</b>`, 'unlock'); }); }
      if (STAGE_CAP.slice(0, 2).some(c2 => a < c2 && b >= c2)) toast('Neue Entwicklungsstufe möglich! Entwickle deine Helden im Heldenmenü.', 'unlock');
    }
  } else {
    const xp = Math.round(r.enemies.filter(e => !alive(e) && e.xp).reduce((a, e) => a + e.xp, 0) * .4);
    applyReward({ xp, gold: 0, items: [], frags: 0 }, party);
  }
  checkFullSet(); save(); updateHud(); trackFeats({ r, kind });
}
/* ---------- Kapitel-Prüfungen: Heldenhaft & Legendär, je drei Sterne ---------- */
const TRIAL = { h: { n: 'Heldenhaft', off: 0, aff: { elite: 1, one: 1, boss: 1 }, time: 80000, c: '#7ab8ff' }, l: { n: 'Legendär', off: 5, aff: { all: 1, elite: 2, one: 2, boss: 2 }, time: 95000, c: '#ff9a3a' } };
const STAR_MS = [[6, { frags: 3 }], [15, { frags: 4, r: 4 }], [30, { frags: 5, r: 5 }], [50, { frags: 8, r: 4 }], [80, { frags: 10, r: 5 }], [120, { frags: 12, r: 5 }], [168, { frags: 20, r: 5 }]];
function trialLvl(ch, t) { return Math.max(STORY[ch].lvl + 3 + G.story.loop * LOOP_LVL, (G.team?.lvl || 1) - 4) + TRIAL[t].off; }
function trialStars(ch, t) { const m = (G.trials?.[ch]?.[t]) || 0; return (m & 1 ? 1 : 0) + (m & 2 ? 1 : 0) + (m & 4 ? 1 : 0); }
function starTotal() { let n = 0; for (const ch of Object.keys(G.trials || {})) for (const t of ['h', 'l']) n += trialStars(+ch, t); return n; }
function starStr(m) { return [1, 2, 4].map(b => m & b ? '★' : '☆').join(''); }
function trialOpen(ch, t) { return t === 'h' ? chapterStatus(ch) === 'done' : !!((G.trials?.[ch]?.h || 0) & 1); }
async function trialRun(ch, t) {
  const C = STORY[ch], T = TRIAL[t], prevBg = W.bgKey, lvl = trialLvl(ch, t); G.queue = null; G.trials = G.trials || {}; save();
  W.setBg(chBg(C)); await panoSplash(`Kapitel-Prüfung · ${T.n}`, `Kapitel ${ch + 1}`, esc(C.n), chBg(C), 2100);
  const wv = chapterWaves(ch), fights = [[wv[3], 'elite'], [wv[7], 'elite'], [C.boss, 'boss']];
  applyParty(); W.restoreHeroes();
  let fallen = 0, dur = 0, won = true, aborted = false;
  for (let i = 0; i < fights.length; i++) {
    const [grp, kind] = fights[i]; await W.walk(800);
    if (kind === 'boss') await bossSplash(C.boss.find(k => ENEMIES[k].boss) || C.boss[0]);
    const r = await W.fight(grp, lvl + i, kind, { aff: afxPlan(grp, T.aff), keepHp: i > 0 ? 1 : 0 });
    if (r.aborted) { aborted = true; break; }
    if (kind === 'boss') r.setCh = ch; onResult(r, kind); fallen += r.fallen; dur += r.dur;
    if (!r.win) { won = false; break; }
    for (const h of W.heroes) if (!alive(h)) W.revive(h, .3); healParty(.3);
  }
  if (aborted) { W.setBg(prevBg); return; }
  const rec = G.trials[ch] || (G.trials[ch] = {}), old = rec[t] || 0, got = (won ? 1 : 0) | (won && !fallen ? 2 : 0) | (won && dur <= T.time ? 4 : 0), nw = got & ~old;
  rec[t] = old | got; const items = []; let frags = 0, gold = 0;
  const nNew = [1, 2, 4].filter(b => nw & b).length; frags += nNew * (t === 'l' ? 2 : 1); gold += nNew * (t === 'l' ? 400 : 180) * (1 + G.story.loop * .25);
  if (won) { items.push(genItem(lvl + 2, t === 'l' ? topRarity(.12, .55) : rollRarity('boss'))); if ((nw & 1) && t === 'l') items.push(genItem(lvl + 2, topRarity(.35, 1))); }
  const before = starTotal() - [1, 2, 4].filter(b => nw & b).length; const ms = [];
  for (const [need, rw] of STAR_MS) if (before < need && starTotal() >= need) { ms.push(need); frags += rw.frags; if (rw.r) items.push(genItem(Math.max(lvl, chapterLvl()) + 2, rw.r)); }
  G.gold += Math.round(gold); if (frags) grantFragments(frags); items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save(); applyParty(); updateHud();
  trackFeats({ trial: t, won, ch });
  const line = (ok, txt) => `<div class="tr-c ${ok ? 'ok' : ''}"><b>${ok ? '★' : '☆'}</b>${txt}</div>`;
  await splash(`<div class="cdone trial" style="--tc:${T.c}"><div class="kicker">Kapitel-Prüfung · ${T.n} · Kapitel ${ch + 1}</div><h1 class="tr-st">${starStr(rec[t])}</h1><div class="tr-cs">${line(won, 'Sieg')}${line(won && !fallen, 'Kein Held gefallen')}${line(won && dur <= T.time, `Unter ${Math.round(T.time / 1000)} s Kampfzeit <small>(${Math.round(dur / 1000)} s)</small>`)}</div><p>${nNew ? `<b>${nNew} neue${nNew > 1 ? '' : 'r'} Stern${nNew > 1 ? 'e' : ''}!</b> ` : ''}${gold ? '◆ ' + fmt(Math.round(gold)) + ' · ' : ''}${frags ? '◈ ' + frags + ' · ' : ''}Sterne gesamt: ${starTotal()}${ms.length ? ` · <b>Meilenstein ${ms.join(', ')} erreicht!</b>` : ''}</p>${items.length ? `<div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div>` : ''}<div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  W.setBg(prevBg); updateHud();
}
async function bossRematch(ch) {
  const C = STORY[ch], prevBg = W.bgKey; G.queue = null; save();
  W.setBg(chBg(C)); await panoSplash('Erneuter Bosskampf', `Kapitel ${ch + 1}`, esc(C.n), chBg(C), 1900);
  applyParty(); await W.walk(1000);
  const lvl = C.lvl + 3 + G.story.loop * LOOP_LVL, r = await W.fight(C.boss, lvl, 'boss'); r.setCh = ch;
  onResult(r, 'boss'); if (r.win) { G.stats.bosses++; track('bosses', 1); } else toast('Der Boss war zu stark. Werdet stärker und versucht es erneut.', 'unlock');
  W.setBg(prevBg);
}
async function sideRun(id) {
  const sd = SIDE.find(x => x.id === id), prevBg = W.bgKey, first = !G.side[id]; G.queue = null; save();
  W.setBg(sd.bg); await panoSplash('Nebenquest', first ? 'Neu' : 'Wiederholung', esc(sd.n), sd.bg, 2200);
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
      for (const hk of sd.heroes || (sd.hero ? [sd.hero] : [])) { joinHero(hk); applyParty(); await joinSplash(hk); }
      if (sd.comp) { const cp = grantCompanion(sd.comp); if (cp) await companionSplash(cp); }
      if (sd.legend) { const li = LEGENDARIES.findIndex(l => l.n === sd.legend); const it = genItem(lvl + 2, 4, { leg: li }); addItem(it); if (G.settings.autoEquip) autoEquip(); await splash(`<div class="cdone"><div class="kicker">Legendärer Fund</div><div class="loot1">${icHtml(it)}<b style="color:${RARITY[4].c}">${esc(it.name)}</b></div><p>${esc(it.passive || '')}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      grantFragments(2); toast('Nebenquest abgeschlossen!', 'lvl');
    } else G.side[id]++;
    save();
  } else toast(`${esc(sd.n)}: Der Boss war zu stark.`, 'unlock');
  W.setBg(prevBg);
}
/* ---------- Spezialmodi (beliebig oft, ohne Zeitsperren) ---------- */
const MODES = [
  { id: 'horde', n: 'Endloser Ansturm', ic: '∞', d: 'Welle um Welle, ohne Heilung dazwischen. Wie weit kommt deine Gruppe?' },
  { id: 'rush', n: 'Bossrausch', ic: '♛', d: 'Fünf bereits besiegte Bosse hintereinander. Zwischen den Kämpfen nur 30 % Heilung.' },
  { id: 'chaos', n: 'Chaos-Prüfung', ic: '✷', d: 'Fünf Kämpfe, jeder mit einer verrückten Regel: Blitztempo, Glaskanonen, Kritsturm …' },
  { id: 'helm', n: 'Helms Klamm', ic: '⚔', d: 'Verteidigt das Tor der Hornburg gegen endlose Uruk-Wellen. Fällt das Tor, ist alles verloren.' },
  { id: 'pfad', n: 'Pfad der Verzweiflung', ic: '☠', d: '15 Kämpfe ohne Heilung. Nach jedem Sieg wählst du einen Segen.' }
];
const CHAOS = [['schnell', 'Blitztempo: alle sind 70 % schneller'], ['glas', 'Glaskanonen: doppelter Schaden, 40 % weniger Leben'], ['energie', 'Volle Kraft: alle Ultimates sofort bereit'], ['krit', 'Kritsturm: +45 % Krit-Chance für alle'], ['riesen', 'Riesenwuchs: Gegner mit 80 % mehr Leben']];
function modeUnlocked() { return isUnl('horde'); }
const MODE_PRICE = 2500;
function buyEarly(key, price, label, after) { if (G.gold < price) { toast(`Dafür brauchst du ◆ ${fmt(price)} Gold.`, 'mini'); return false; } G.gold -= price; G.unl = G.unl || {}; G.unl[key] = 1; save(); sfx('join'); toast(`<b>${esc(label)}</b> früher freigeschaltet!`, 'lvl'); updateHud(); after && after(); return true; }
function modePool() { const last = G.story.loop ? STORY.length : Math.max(1, G.story.ch); const waves = [], bosses = []; for (let i = 0; i < last; i++) { (STORY[i].waves || []).forEach(w => waves.push(w)); bosses.push(i); } return { waves, bosses }; }
function healParty(pct) { for (const h of W.heroes) { if (h.hp > 0) h.hp = Math.min(h.maxHp, Math.round(h.hp + h.maxHp * pct)); } }
async function modeRun(id) {
  if (id === 'helm') return helmRun();
  if (id === 'pfad') return pfadRun();
  const M = MODES.find(m => m.id === id), prevBg = W.bgKey, pool = modePool(); G.queue = null; G.modes = G.modes || {}; save();
  await splash(`<div class="ctitle"><div class="kicker">Spezialmodus</div><h1>${M.ic} ${esc(M.n)}</h1><h2>${esc(M.d)}</h2></div>`, 2200, 'chap');
  applyParty(); W.restoreHeroes();
  let n = 0, gold = 0, fr = 0; const items = [], base = Math.max(1, chapterLvl() - 2);
  if (id === 'horde') {
    for (;;) {
      const grp = pool.waves[Math.floor(Math.random() * pool.waves.length)], lvl = base + Math.floor(n / 2);
      if (n % 5 === 0) W.setBg(chBg(STORY[pool.bosses[Math.floor(Math.random() * pool.bosses.length)]], Math.floor(Math.random() * 8)));
      banner(`Welle ${n + 1}`, 'ult'); await W.walk(700);
      const r = await W.fight(n % 5 === 4 ? [...grp, ...grp].slice(0, 5) : grp, lvl, n % 5 === 4 ? 'elite' : 'normal', { keepHp: 1 }); onResult(r, 'normal');
      if (!r.win) break; n++; healParty(.08);
      if (n % 5 === 0) { fr += 1; items.push(genItem(lvl + 1, rollRarity('elite'))); if (Math.random() < .5) items.push(genSetItem(SETS.find(x => x.src === 'horde'), lvl + 1)); toast(`Welle ${n} geschafft! Bonus gesichert.`, 'lvl'); }
    }
    gold = n * (60 + base * 12);
  } else if (id === 'rush') {
    const order = pool.bosses.slice().sort(() => Math.random() - .5).slice(0, 5);
    for (const ci of order) {
      const C = STORY[ci]; W.setBg(chBg(C)); await W.walk(700); const bk = C.boss.find(k => ENEMIES[k].boss) || C.boss[0]; await bossSplash(bk);
      const r = await W.fight(C.boss, base + 2 + n, 'boss', { keepHp: 1 }); r.setCh = ci; onResult(r, 'boss');
      if (!r.win) break; n++; healParty(.3); if (Math.random() < .35) fr++;
    }
    if (n >= 5) { items.push(genItem(base + 6, Math.random() < .5 ? 4 : 3)); fr += 2; }
    gold = n * (180 + base * 25);
  } else {
    const rules = CHAOS.slice().sort(() => Math.random() - .5);
    for (let i = 0; i < 5; i++) {
      const [rid, rd] = rules[i % rules.length], grp = pool.waves[Math.floor(Math.random() * pool.waves.length)];
      await splash(`<div class="ctitle"><div class="kicker">Chaos-Regel ${i + 1}/5</div><h1>✷</h1><h2>${esc(rd)}</h2></div>`, 1700, 'chap');
      applyParty(); await W.walk(600); const r = await W.fight(grp, base + 1 + i, i === 4 ? 'elite' : 'normal', { chaos: rid }); onResult(r, 'normal');
      if (!r.win) break; n++;
    }
    if (n >= 5) { items.push(genItem(base + 4, rollRarity('boss'))); fr += 1; }
    gold = n * (90 + base * 15);
  }
  const best = G.modes[id] || 0, rec = n > best; G.modes[id] = Math.max(best, n);
  G.gold += gold; if (fr) grantFragments(fr); items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save(); applyParty(); W.restoreHeroes();
  const unit = id === 'horde' ? 'Wellen' : id === 'rush' ? 'Bosse' : 'Kämpfe';
  await splash(`<div class="cdone"><div class="kicker">${esc(M.n)} beendet</div><h1>${n} ${unit}</h1><p>${rec ? '<b>Neuer Rekord!</b> ' : `Rekord: ${G.modes[id]} · `}◆ ${fmt(gold)}${fr ? ' · ◈ ' + fr : ''}${items.length ? ' · ' + items.length + ' Gegenstände' : ''}</p>${items.length ? `<div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div>` : ''}<div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  W.setBg(prevBg); updateHud();
}
async function raidRun(key) {
  const R = RAIDS.find(x => x.key === key), prevBg = W.bgKey; G.queue = null; save();
  W.setBg(R.bg); await panoSplash('Prüfung der Macht', '45 Sekunden', esc(R.n), R.bg, 2000);
  applyParty(); await W.walk(800);
  const r = await W.fight([key], raidLvl(), 'boss', { raid: 1, time: 45000 });
  const st = G.raid[key] || (G.raid[key] = { best: 0, tiers: 0 }), pct = r.dmgPct;
  const tier = RAID_TIERS.filter(t => pct >= t).length, first = tier > st.tiers;
  st.best = Math.max(st.best, pct); if (first) st.tiers = tier;
  const rw = raidRewards(pct, first), items = []; for (let i = 0; i < rw.items; i++) items.push(genItem(raidLvl(), rollRarity(tier >= 5 ? 'boss' : 'elite')));
  if (tier >= 2 && Math.random() < .5 + tier * .05) items.push(genSetItem(SETS.find(x => x.src === 'raid'), raidLvl(), tier >= 6 ? 4 : 3));
  G.gold += rw.gold; if (rw.frags) grantFragments(rw.frags); items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save();
  await splash(`<div class="cdone"><div class="kicker">Prüfung beendet</div><h1>${Math.round(pct * 100)} % Schaden</h1><p>${first ? '<b>Neue Bestmarke!</b> ' : ''}Stufe ${tier} von ${RAID_TIERS.length} · ◆ ${fmt(rw.gold)}${rw.frags ? ' · ◈ ' + rw.frags : ''} · ${items.length} Gegenstände</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  W.setBg(prevBg); updateHud();
}
function companionSplash(cp) {
  sfx('join');
  return splash(`<div class="cdone"><div class="kicker">Neuer Begleiter</div><canvas class="compart" data-comp="${cp.id}"></canvas><h1>${esc(cp.n)}</h1><p>${esc(cp.d)}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
}
async function towerRun() {
  const f = towerFloor(), tg = towerGroup(f), prevBg = W.bgKey;
  G.tower.queued = false; save();
  W.setBg('helm'); await panoSplash('Orthanc-Turm', 'Etage', f, 'helm', 2000);
  applyParty(); await W.walk(1000);
  const r = await W.fight(tg.group, towerLvl(f), tg.kind);
  if (r.win) {
    G.tower.best = f; G.stats.towerBest = Math.max(G.stats.towerBest, f); track('tower', 1);
    const tr = towerReward(f); onResult(r, tg.kind); G.gold += tr.gold; if (tr.frags) grantFragments(tr.frags);
    if (Math.random() < .35) { const S2 = SETS.find(x => x.src === 'tower'), it = genSetItem(S2, towerLvl(f)); addItem(it); lootPop([it], 0); toast(`Set-Teil: <b style="color:${S2.c}">${esc(it.name)}</b>`, 'lvl'); suggestGear([it]); }
    toast(`Orthanc-Turm Etage ${f} bezwungen: +${fmt(tr.gold)} ◆${tr.frags ? ' · ◈ ' + tr.frags : ''}`, 'lvl'); save();
  } else { onResult(r, tg.kind); toast(`Etage ${f} war zu stark. Werdet stärker und versucht es erneut.`, 'unlock'); }
  W.setBg(prevBg);
}
async function director() {
  while (true) {
    await announceUnlocks();
    const ch = STORY[G.story.ch]; W.setBg(chBg(ch, G.story.wave));
    if (!G.story.intro) {
      await W.wait(400); if (G.story.ch > 0) { await campScene(); await travelSplash(G.story.ch - 1, G.story.ch); } await chapterTitle(ch);
      if (ch.back) for (const k of ch.back) { delete G.away[k]; const hs = G.heroes[k]; if (hs) { hs.stage = Math.max(hs.stage, 2); hs.lvl = Math.max(hs.lvl, ...G.party.map(x => G.heroes[x].lvl)); } }
      await dialog(ch.intro);
      for (const k of ch.join || []) { joinHero(k); applyParty(); await joinSplash(k); }
      if (ch.back) for (const k of ch.back) { applyParty(); await joinSplash(k, 1); }
      applyParty(); G.story.intro = true; save();
    }
    const w = G.story.wave, mk = G.story.ch + '-' + w;
    if (G.tower.queued) { running = 'Orthanc-Turm'; try { await towerRun(); } finally { running = null; } continue; }
    if (G.queue) { const q = G.queue, R2 = RUNS[q.type]; G.queue = null; running = R2 ? R2[0] : 'Herausforderung'; lastWin = null; try { if (R2) await R2[1](q); else G.queue = null; } catch (e) { console.error(e); G.queue = null; } finally { running = null; }
      if (REP && REP.left > 0 && lastWin !== false) { REP.left--; G.queue = REP.q; save(); } else { if (REP && lastWin === false) toast('Wiederholung beendet – der letzte Kampf ging verloren.', 'unlock'); REP = null; } renderNext(); continue; }
    if (w < WAVES) {
      if ((ch.mid?.[w] || ch.midLine?.[w]) && !G.story.mids[mk]) {
        await dialog(ch.midLine?.[w]); for (const k of ch.mid?.[w] || []) { joinHero(k); applyParty(); await joinSplash(k); }
        G.story.mids[mk] = 1; save();
      }
      const ek = G.story.ch + '-' + G.story.loop; if ([2, 4, 5].includes(w) && G.encCh !== ek && isUnl('quests') && Math.random() < .35) { G.encCh = ek; save(); await encounter(w); }
      applyParty(); await W.walk(1500);
      const kind = isEliteWave(w) ? 'elite' : 'normal'; if (kind === 'elite') waveCard(w, kind);
      const grp = chapterWaves()[w], r = await W.fight(grp, waveLvl(w), kind, { aff: storyAfx(grp, kind) });
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
    const r = await W.fight(ch.boss, waveLvl(WAVES) + 1, 'boss', { aff: storyAfx(ch.boss, 'boss') }); r.setCh = G.story.ch;
    if (r.aborted) continue;
    onResult(r, 'boss');
    if (r.win) {
      G.stats.bosses++; track('bosses', 1); await W.wait(400);
      await dialog(ch.outro);
      for (const k of ch.end || []) { joinHero(k); applyParty(); await joinSplash(k); }
      for (const k of ch.away || []) { G.away[k] = 1; toast(`${esc(HEROES[k].n)} hat die Gruppe verlassen …`, 'unlock'); }
      const relic = G.story.loop === 0 ? grantRelic(G.story.ch) : null;
      if (relic) { W.pendingParty = 1; await splash(`<div class="cdone relic"><div class="kicker">Relikt gefunden</div><canvas class="ric" data-ic="${relic.ic}" data-c="${relic.c}"></canvas><h1>${esc(relic.n)}</h1><p>Dauerhafter Gruppenbonus: <b>${esc(relic.d)}</b></p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      if (G.story.loop === 0 && CINE_AT[G.story.ch]) await cinema(CINE_AT[G.story.ch]);
      const cp = chapterCompanion(G.story.ch); if (cp && !G.comps[cp.id]) { grantCompanion(cp.id); W.pendingParty = 1; await companionSplash(cp); }
      const bn = G.story.loop === 0 && BANNERS.find(b => b.ch === G.story.ch); if (bn && !(G.banners || {})[bn.id]) { G.banners = G.banners || {}; G.banners[bn.id] = 1; if (!G.banner) G.banner = bn.id; W.pendingParty = 1; save(); sfx('join'); await splash(`<div class="cdone"><div class="kicker">Neues Banner</div><canvas class="bnrbig" data-flag="${bn.id}"></canvas><h1>${esc(bn.n)}</h1><p>Aufgestellt stärkt es die ganze Gruppe: <b>${esc(bn.d)}</b></p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      G.stats.chapters = Math.max(G.stats.chapters, G.story.ch + 1 + G.story.loop * STORY.length);
      const mith = 1; grantFragments(1);
      await pickChest(ch.n, mith);
      G.story.ch++; backupSave(); for (const m of grantMounts()) { W.pendingParty = 1; await splash(`<div class="cdone"><div class="kicker">Neues Reittier</div><canvas class="mcv" data-mount="${m.id}"></canvas><h1>${esc(m.n)}</h1><p>${esc(m.d)}</p><p>Reiter: <b>${m.heroes.map(k => esc(HEROES[k].n)).join(', ')}</b> · ${esc(m.bd)}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); } save();
      if (G.story.ch >= STORY.length) { G.story.ch = 0; G.story.loop++; G.stats.loops++; const m = activeMods(); await splash(`<div class="cdone"><div class="kicker">Heldenreise ${G.story.loop + 1}</div><h1>Die Reise beginnt von Neuem</h1><p>Stärkere Gegner, bessere Beute (+${G.story.loop * 25} % Gold & EP, seltenere Gegenstände).</p><p><b>Erschwernisse:</b> ${m.map(x => esc(x.d)).join(' · ')}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      Object.assign(G.story, { wave: 0, intro: false, bossSeen: false, farm: false }); applyParty(); save();
    } else { G.story.farm = true; save(); banner('Der Boss ist zu stark. Die Gruppe trainiert.', 'foe'); toast('Werdet stärker und fordert den Boss dann erneut heraus.', 'unlock'); }
  }
}

/* ---------- Menüs (Glas-Panel) ---------- */
/* ================= Menüs: ein Bildschirm, Tabs statt Scrollen, Blättern statt Listen ================= */
let running = null, lastWin = null, REP = null;
/* Auto-Wiederholen, Gefahren-Ampel, Aufräumen, Sicherungen */
function playRep(q, label, n = 5) { REP = { q, left: n - 1 }; playNow(q, label + ` · ↻ ${n}×`); renderNext(); }
function danger(lvl, boss) { const d = (G.team?.lvl || 1) - 4 - lvl - (boss ? 2 : 0); return d >= 3 ? ['#7ad86a', 'Leicht'] : d >= -2 ? ['#ffd060', 'Fordernd'] : ['#ff5a48', 'Gefährlich']; }
function dangerHtml(lvl, boss) { const [c, t] = danger(lvl, boss); return `<span class="dg" style="--dg:${c}">● ${t}</span>`; }
function autoClean() {
  if (G.settings.autoClean === false || G.inv.length < 30 || performance.now() - (autoClean.t || -1e9) < 15000) return; autoClean.t = performance.now();
  let n = 0, gold = 0; for (const it of G.inv.slice()) { if (it.r >= 4 || it.set || it.leg != null || it.myth != null || it.nw || equippedBy(it.id)) continue; const best = Math.max(-1, ...G.party.filter(k => canEquip(k, it)).map(k => powerDiff(k, it))); if (best <= 0) { gold += salvage(it); n++; } }
  if (n) { save(); toast(`Beutel aufgeräumt: ${n} alte Gegenstände verwertet · ◆ ${fmt(gold)}`, 'mini'); updateHud(); }
}
function backupSave() { try { const B = store.get(SAVE_KEY + '-bak') || []; B.unshift({ t: Date.now(), ch: G.story.ch, loop: G.story.loop, g: JSON.parse(JSON.stringify(G)) }); store.set(SAVE_KEY + '-bak', B.slice(0, 3)); } catch (e) { } }
function backups() { return store.get(SAVE_KEY + '-bak') || []; }
function restoreBackup(i) { const B = backups()[i]; if (!B) return; if (!confirm(`Spielstand von Kapitel ${B.ch + 1} (${new Date(B.t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}) wiederherstellen?`)) return; store.set(SAVE_KEY, B.g); location.reload(); }
/* ---------- Ziele: alles Lohnende auf einen Blick ---------- */
function goals() {
  const L = [], ch = G.story.ch, last = G.story.loop ? STORY.length : ch;
  L.push({ ic: '▶', t: `Kapitel ${ch + 1}: ${STORY[ch].n}`, s: G.story.wave >= WAVES ? 'Der Boss wartet' : `Welle ${Math.min(WAVES, G.story.wave + 1)} von ${WAVES}`, v: 100, go: () => closeSheet(), lvl: chapterLvl() });
  if (isUnl('saga')) for (const S of SAGAS) L.push({ ic: '☬', t: 'Sage: ' + S.sn, s: (G.sagas || {})[S.id] ? 'Sagenstufe ' + (G.sagas[S.id] + 1) : 'Mythischer Schatz beim ersten Sieg', v: (G.sagas || {})[S.id] ? 14 : 80, q: { type: 'saga', id: S.id }, lvl: sagaLvl(S), boss: 1 });
  if (isUnl('side')) for (const sd of SIDE) if (sideUnlocked(sd)) L.push({ ic: '◇', t: sd.n, s: G.side[sd.id] ? 'Erneut spielen' : sd.legend ? 'Legendär: ' + sd.legend : sd.hero ? 'Neuer Held: ' + HEROES[sd.hero].n : sd.heroes ? 'Neue Helden' : 'Neue Nebenquest', v: G.side[sd.id] ? 8 : 70, q: { type: 'side', id: sd.id }, lvl: sideLvl(sd), boss: 1 });
  if (isUnl('hunt')) for (const H of HUNTS) if (huntOpen(H)) L.push({ ic: '⚑', t: 'Kopfgeld: ' + H.sn, s: G.trophies?.[H.id] ? `Jagdstufe ${huntRank(H.id) + 1}` : 'Trophäe offen: ' + H.tr.n, v: G.trophies?.[H.id] ? 12 : 60, q: { type: 'hunt', id: H.id }, lvl: huntLvl(H), boss: 1 });
  if (isUnl('trialH')) for (let i = 0; i < last; i++) for (const t of ['h', 'l']) { if (!trialOpen(i, t) || !isUnl(t === 'h' ? 'trialH' : 'trialL')) continue; const miss = 3 - trialStars(i, t); if (miss > 0) L.push({ ic: t === 'h' ? '★' : '✪', t: `${TRIAL[t].n}: ${STORY[i].n}`, s: `${miss} Stern${miss > 1 ? 'e' : ''} offen`, v: 30 + miss * 6 + (t === 'l' ? 8 : 0) - i * .2, q: { type: 'trial', ch: i, t }, lvl: trialLvl(i, t), boss: 1 }); }
  if (isUnl('tower')) L.push({ ic: '♜', t: 'Orthanc-Turm', s: `Etage ${towerFloor()}`, v: 20, q: { type: 'tower' }, lvl: towerLvl() });
  return L.sort((a, b) => b.v - a.v);
}
function openGoals(page = openGoals.page || 0) {
  const L = goals(), per = innerHeight > innerWidth ? 7 : 8, np = pages(L.length, per); page = openGoals.page = clampPg(page, np);
  const row = (g, i) => { const rep = g.q && ['trial', 'hunt', 'side', 'saga'].includes(g.q.type); return `<div class="gl-r ${i === 0 && page === 0 ? 'top' : ''}"><span class="gl-ic">${g.ic}</span><div class="gl-t"><b>${esc(g.t)}</b><small>${esc(g.s)} · ${dangerHtml(g.lvl, g.boss)}</small></div><div class="gl-b"><button class="btn small gold" data-g="${i}">▶</button>${rep ? `<button class="btn small" data-gr="${i}" title="5× wiederholen">↻5</button>` : ''}</div></div>`; };
  const view = L.slice(page * per, page * per + per);
  openSheet('Reise', `<div class="m-goals">${view.map(row).join('')}</div>`, s => {
    s.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const g = view[+b.dataset.g]; if (g.go) return g.go(); playNow(g.q, g.t); });
    s.querySelectorAll('[data-gr]').forEach(b => b.onclick = () => { const g = view[+b.dataset.gr]; playRep(g.q, g.t, 5); });
  }, { tabs: STORY_TABS, tab: 'ziele', onTab: t => openStory(t), pages: np, page, onPage: p => openGoals(p) });
}
const RUNS = { boss: ['Bosskampf', q => bossRematch(q.ch)], side: ['Nebenquest', q => sideRun(q.id)], raid: ['Prüfung der Macht', q => raidRun(q.key)], mode: ['Spezialmodus', q => modeRun(q.id)], trial: ['Kapitel-Prüfung', q => trialRun(q.ch, q.t)], hunt: ['Kopfgeldjagd', q => huntRun(q.id)], saga: ['Sagen-Boss', q => sagaRun(q.id)], mirror: ['Spiegel der Galadriel', () => mirrorRun()] };
/* Sofort spielen: laufenden Kampf abbrechen (ohne Strafe) und direkt starten */
function playNow(q, label) {
  if (running) { toast(`Gerade läuft: ${esc(running)}`, 'mini'); return; }
  if (q.type === 'tower') G.tower.queued = true; else G.queue = q;
  save(); closeSheet(); sfx('join'); toast(`▶ ${esc(label)}`, 'lvl'); W.abort();
}
/* Empfehlung „Nächster Schritt“: die sinnvollste Aktion mit einem Tipp */
function nextStep() {
  if (REP) return { ic: '↻', t: `Wiederholung · noch ${REP.left + (running ? 1 : 0)} · Stopp`, c: '#7ad8ff', go: () => { REP = null; toast('Wiederholung gestoppt – der laufende Kampf wird noch beendet.', 'mini'); renderNext(); } };
  const nu = UNLOCKS.find(U => G.unlNew?.[U.id] && isUnl(U.id)); if (nu) return { ic: nu.ic, t: 'Neu: ' + nu.n, c: '#7ad8ff', go: () => (UNL_GO[nu.id] || (() => { delete G.unlNew[nu.id]; }))() };
  const fr = isUnl('forge') && RINGS.find(r => canForge(r.id)); if (fr) return { ic: '◍', t: (G.rings?.[fr.id]?.stars ? fr.n + ' veredeln' : fr.n + ' schmieden'), c: fr.c, go: () => openForge(Math.floor(RINGS.indexOf(fr) / 4)) };
  const fo = RINGS.find(R => (G.rings?.[R.id]?.stars || 0) > 0 && !(G.rings[R.id].owner && G.party.includes(G.rings[R.id].owner)) && G.party.some(k => !ringOf(k))); if (fo) return { ic: '◍', t: fo.n + ' anlegen', c: fo.c, go: () => openRingOwner(fo.id) };
  const cs = chestState(); if (isUnl('chest') && cs.ready && (G.chest || 0) >= CHEST_MAX * .6) return { ic: '⛁', t: 'Siegestruhe öffnen', c: '#e8bd5c', go: openChest };
  const q = isUnl('quests') && questsClaimable(); if (q) return { ic: '✎', t: q > 1 ? q + ' Aufträge abholen' : 'Auftrag abholen', c: '#e8bd5c', go: openQuests };
  const a = isUnl('ach') && claimableCount(); if (a) return { ic: '♛', t: a > 1 ? a + ' Erfolge abholen' : 'Erfolg abholen', c: '#e8bd5c', go: () => openAch() };
  const ev = G.party.find(k => canEvolve(k)?.lvlOk); if (ev) return { ic: '★', t: HEROES[ev].n + ' entwickeln', c: '#ffd760', go: () => openHero(ev, 'werte') };
  if (!G.settings.autoEquip && G.party.some(k => Object.keys(SLOTS).some(sl => upgradeFor(k, sl)))) return { ic: '⚡', t: 'Bessere Ausrüstung', c: '#7dff8a', go: () => openHeroes('team') };
  const up = UNLOCKS.find(U => !isUnl(U.id)); if (up) return { ic: '✧', t: `Bald: ${up.n} · ${unlWhen(up.id).replace('Kapitel', 'Kap.')}`, c: '#9aa4b8', go: () => lockHint(up.id) };
  return null;
}
function renderNext() {
  const n = nextStep(), sig = n ? n.t : '';
  for (const el of [$('#next'), $('#nextP')]) { if (!el) continue; el.hidden = !n; if (!n) continue; if (el.dataset.v !== sig) { el.dataset.v = sig; el.style.setProperty('--nc', n.c); el.innerHTML = `<span class="nx-ic">${n.ic}</span><span class="nx-t"><small>Nächster Schritt</small><b>${esc(n.t)}</b></span>`; } el.onclick = () => { sfx('click'); n.go(); }; }
}
/* Info-Karte beim Antippen einer Figur */
function unitInfo(u, cx, cy) {
  const box = $('#uinfo'); if (!u) { box.hidden = true; return; }
  const E = u.side === 'enemy' ? ENEMIES[u.key] || { n: u.name } : null, H = u.side === 'hero' ? HEROES[u.key] : null, f = Math.max(0, u.hp / u.maxHp);
  const tag = E ? (E.boss ? 'Boss' : u.elite ? 'Elite' : 'Gegner') : ROLES[CLASSES[H.cls].role].n;
  const skills = E ? [...new Set((u.skills || []).map(s => s.n))].slice(0, 4).join(' · ') : [H.act.n, H.act2.n, H.ult.n].join(' · ');
  const extra = u.mirror ? `Spiegelbild von ${esc(HEROES[u.mirror].n)}` : E ? `Bestiarium: ${fmt((G.bestiary || {})[u.key] || 0)}× besiegt` : `Ultimate ${Math.min(100, Math.round(u.energy))} %${ringOf(u.key) ? ' · ◍ ' + esc(ringOf(u.key).R.n) : ''}`;
  box.className = 'uinfo ' + (E ? 'foe' : 'hero');
  box.innerHTML = `<div class="ui-h"><b>${esc(u.name)}</b><span>${tag} · St. ${u.lvl || G.team.lvl}</span></div><div class="ui-hp"><i style="width:${f * 100}%"></i></div><small class="ui-n">${fmt(u.hp)} / ${fmt(u.maxHp)} LP${u.statuses.length ? ' · ' + u.statuses.slice(0, 4).map(st => `<span style="color:${STATUS[st.id].c}">●</span>`).join('') : ''}</small><small class="ui-s">${esc(skills)}</small>${u.afx && u.afx.length ? `<small class="ui-a">${u.afx.map(a => `<b style="color:${ELITE_AFX[a].c}">${ELITE_AFX[a].n}</b> ${esc(ELITE_AFX[a].d)}`).join('<br>')}</small>` : ''}<small class="ui-x">${extra}</small>`;
  box.hidden = false;
  const app = $('#app').getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight;
  box.style.left = Math.max(8, Math.min(app.width - bw - 8, cx - app.left - bw / 2)) + 'px'; box.style.top = Math.max(8, Math.min(app.height - bh - 8, cy - app.top - bh - 18)) + 'px';
  clearTimeout(unitInfo.t); unitInfo.t = setTimeout(() => { box.hidden = true; }, 4200);
}
/* Münzen fliegen vom besiegten Gegner zum Goldzähler */
function flyCoins(u, n) {
  if (!W || document.body.classList.contains('splash-open')) return;
  const app = $('#app').getBoundingClientRect(), tgt = $('.res .g').getBoundingClientRect(), p0 = W.screenPos(u.x + u.ox, u.y + u.oy - u.h * .5);
  const tx = tgt.left + 14 - app.left, ty = tgt.top + tgt.height / 2 - app.top;
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.className = 'coin'; const sx = p0.x - app.left + (Math.random() - .5) * 26, sy = p0.y - app.top + (Math.random() - .5) * 20;
    c.style.left = sx + 'px'; c.style.top = sy + 'px'; $('#app').appendChild(c);
    const dl = i * 55, mx = (sx + tx) / 2 + (Math.random() - .5) * 120, my = Math.min(sy, ty) - 40 - Math.random() * 60;
    const a = c.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 }, { transform: `translate(calc(-50% + ${(mx - sx) * .5}px),calc(-50% + ${(my - sy)}px)) scale(1.15)`, opacity: 1, offset: .35 }, { transform: `translate(calc(-50% + ${tx - sx}px),calc(-50% + ${ty - sy}px)) scale(.7)`, opacity: 1 }], { duration: 760 + Math.random() * 180, delay: 220 + dl, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'backwards' });
    a.onfinish = () => { c.remove(); const g = $('.res .g'); g.classList.remove('bump'); void g.offsetWidth; g.classList.add('bump'); };
  }
}
/* Story-Schlachten mit Heeren im Hintergrund (Fünf Heere, Morannon, Jähes Feuer, Angband) */
function armyHint() { if (running || !G) return null; return { 4: 'erebor', 13: 'doom', 24: 'doom', 27: 'doom' }[G.story.ch] || null; }
function chBg(C, w = 99) { let b = C.bg; for (const [w0, k] of Object.entries(C.bgAt || {})) if (w >= +w0) b = k; return b; }
function waveCard(w, kind) { const el = $('#wave'); el.className = 'wave ' + kind; el.innerHTML = `<small>${esc(STORY[G.story.ch].n)}</small><b>Welle ${w + 1} von ${WAVES}</b>${kind === 'elite' ? '<em>Elite</em>' : w === WAVES - 1 ? '<em>Letzte Welle</em>' : ''}`; el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); clearTimeout(waveCard.t); waveCard.t = setTimeout(() => { el.hidden = true; }, 1900); }
function refreshLooks() { for (const u of W.heroes) { const L = heroLook(u.key), sig = JSON.stringify(L.gear || null); if (u._gsig !== undefined && u._gsig !== sig && alive(u)) W.gearUp(u); u._gsig = sig; u.look = L; } }
/* ---------- Bonusleiste über den Heldenbildern ---------- */
const EFF_N = { hp: 'LP', atk: 'Angriff', mag: 'Magie', def: 'Verteidigung', spd: 'Tempo', crit: 'Krit', dodge: 'Ausweichen', healPct: 'Heilung', ultCharge: 'Ultimate', thorns: 'Dornen', startBuffRegen: 'Erholung zu Kampfbeginn' };
function effTxt(e) { return Object.entries(e).filter(([k, v]) => v).map(([k, v]) => k === 'startBuffRegen' ? EFF_N[k] : `+${String(Math.round(v * 10) / 10).replace('.', ',')} % ${EFF_N[k] || k}`).join(', '); }
function sumEff(list) { const o = {}; for (const e of list) for (const [k, v] of Object.entries(e)) o[k] = (o[k] || 0) + v; return o; }
function boonList() {
  const out = [], cp = COMPANIONS.find(c => c.id === G.companion && G.comps[c.id]);
  if (cp) out.push({ id: 'comp', ic: '❀', c: '#9fd08a', n: 'Begleiter: ' + cp.n, d: cp.d });
  if (G.tempBuff && G.tempBuff.fights > 0) out.push({ id: 'temp', ic: '✧', c: '#9fe6ff', n: 'Segen unterwegs', d: `${effTxt(G.tempBuff.e)} · noch ${G.tempBuff.fights} Kämpfe`, cnt: G.tempBuff.fights });
  for (const d of activeDuos(G.party)) out.push({ id: 'duo', ic: '⚯', c: d.c, n: `Duo: ${d.n}`, d: `${HEROES[d.a].n} & ${HEROES[d.b].n} – ${d.d} (nach einem Ultimate, einmal pro Kampf)` });
  const BN = isUnl('banner') && G.banner && BANNERS.find(b => b.id === G.banner); if (BN) out.push({ id: 'banner', ic: '⚐', c: BN.emCol === '#141010' ? '#e8c860' : BN.emCol, bg: BN.cloth, n: BN.n, d: BN.d });
  for (const f of activeFactions(G.party).filter(f => f.tier >= 0)) out.push({ id: 'bond', ic: f.F.ic, c: f.F.c, n: `Bündnis: ${f.F.n} (${f.n})`, d: f.F.t[f.tier][2] });
  const rl = Object.keys(G.relics || {}).filter(i => RELICS[i]); if (rl.length) out.push({ id: 'relic', ic: '◆', c: '#e8bd5c', n: `${rl.length} Relikte`, d: effTxt(sumEff(rl.map(i => RELICS[i].e))), cnt: rl.length });
  const tr = Object.keys(G.trophies || {}).map(id => HUNTS.find(h => h.id === id)).filter(Boolean); if (tr.length) out.push({ id: 'trophy', ic: '✦', c: '#ffd75a', n: `${tr.length} Jagdtrophäen`, d: effTxt(sumEff(tr.map(h => h.tr.e))), cnt: tr.length });
  const rg = G.party.map(k => [k, ringOf(k)]).filter(x => x[1]); if (rg.length) out.push({ id: 'ring', ic: '◍', c: rg[0][1].R.c, n: `${rg.length} Ring${rg.length > 1 ? 'e' : ''} der Macht`, d: rg.map(([k, r]) => `${r.R.n.split(',')[0]} ★${r.stars} (${HEROES[k].n}${loreBearer(r.R, k) ? ', wahrer Träger' : ''})`).join(' · '), cnt: rg.length });
  const sets = []; for (const k of G.party) { const n = {}; for (const sl of Object.keys(SLOTS)) { const it = G.heroes[k].eq[sl] && itemById(G.heroes[k].eq[sl]); if (it?.set) n[it.set] = (n[it.set] || 0) + 1; } for (const [id, c] of Object.entries(n)) if (c >= 2) { const S2 = SETS.find(x => x.id === id); if (S2) sets.push(`${S2.n} ${c}/3 (${HEROES[k].n})`); } }
  if (sets.length) out.push({ id: 'set', ic: '⛉', c: '#b8a8e8', n: 'Set-Boni', d: sets.join(' · '), cnt: sets.length });
  if (W && W.pfadB && W.pfadB.taken.length) out.push({ id: 'pfad', ic: '☘', c: '#c890ff', n: 'Segen des Pfades', d: W.pfadB.taken.map(id => BLESSINGS.find(b => b.id === id)?.n).filter(Boolean).join(', '), cnt: W.pfadB.taken.length });
  const mods = activeMods(); if (mods.length) out.push({ id: 'mods', ic: '☠', c: '#ff7a5a', n: `Heldenreise ${G.story.loop + 1}: Erschwernisse`, d: mods.map(m => m.n).join(', ') });
  return out;
}
const BOON_SLOTS = [['comp', 'comps', '❀', 'Begleiter'], ['banner', 'banner', '⚐', 'Banner'], ['bond', 'bonds', '⚭', 'Bündnisse'], ['relic', 'relics', '◆', 'Relikte'], ['trophy', 'hunt', '✦', 'Trophäen'], ['ring', 'forge', '◍', 'Ringe'], ['set', 'sets', '⛉', 'Sets']];
function renderBoons() {
  const els = [document.getElementById('boons'), document.getElementById('boonsL')].filter(Boolean); if (!els.length || !G) return; const L = boonList();
  const chips = BOON_SLOTS.map(([id, u, ic, n]) => { const act = L.filter(b => b.id === id); if (!isUnl(u)) return { st: 'lk', ic, lbl: n, u, c: '#8a8a8a' }; if (!act.length) return { st: 'off', ic, lbl: n, c: '#9a9480' };
    const a = act[0], cnt = id === 'bond' ? act.length : a.cnt || 0; const lbl = id === 'comp' ? a.n.replace('Begleiter: ', '').split(' ')[0] : id === 'banner' ? a.n.replace(/^Banner (von |der )?/, '') : id === 'bond' ? (act.length > 1 ? act.length + ' Bündnisse' : a.n.replace(/^Bündnis: /, '').replace(/ \(\d+\)$/, '')) : n;
    return { st: 'on', ic: a.ic, lbl, c: a.c, bg: a.bg, cnt }; });
  { const du = L.filter(b => b.id === 'duo'); if (du.length) chips.splice(1, 0, { st: 'on', ic: '⚯', lbl: du.length > 1 ? du.length + ' Duos' : 'Duo', c: du[0].c, cnt: du.length }); }
  { const tb = L.find(b => b.id === 'temp'); if (tb) chips.unshift({ st: 'on', ic: '✧', lbl: 'Segen', c: tb.c, cnt: tb.cnt }); }
  for (const b of L) if (b.id === 'pfad' || b.id === 'mods') chips.push({ st: 'on', ic: b.ic, lbl: b.id === 'pfad' ? 'Segen' : 'Erschwernis', c: b.c, cnt: b.cnt || 0 });
  const sig = JSON.stringify(chips); if (renderBoons.sig === sig) return; renderBoons.sig = sig;
  const html = chips.map(b => `<button class="bo ${b.st}" ${b.st === 'lk' ? `data-lock="${b.u}"` : ''} style="--bc:${b.c};${b.bg ? `--bb:${b.bg}` : ''}" title="${esc(b.lbl)}"><span>${b.ic}</span>${b.cnt > 1 ? `<i>${b.cnt}</i>` : ''}<em class="bo-l">${esc(b.lbl)}</em></button>`).join('');
  for (const el of els) { el.innerHTML = html; el.hidden = false; el.onclick = e => { e.stopPropagation(); const lk = e.target.closest('[data-lock]'); if (lk) return lockHint(lk.dataset.lock); sfx('click'); showBoons(el); }; }
}
function showBoons(src) {
  // Bonusübersicht als festes Fenster: bleibt offen, bis du es schließt
  const L = boonList(); if (!L.length) { toast('Noch keine Boni aktiv – Begleiter, Banner, Relikte und Ringe kommen im Lauf der Reise.', 'mini'); return; }
  $('#uinfo').hidden = true;
  openSheet('Aktive Boni', `<div class="m-boons">${L.map(b => `<div class="bo-r"><span class="bo-i" style="--bc:${b.c};${b.bg ? `--bb:${b.bg}` : ''}">${b.ic}</span><span><b>${esc(b.n)}</b><small>${esc(b.d)}</small></span></div>`).join('')}</div>`);
}
/* ---------- Freischaltungen: grau, Hinweis, NEU-Markierung, Ankündigung ---------- */
const TAB_UNL = { modi: 'horde', jagd: 'hunt', chronik: 'chronik', best: 'best', reittiere: 'mounts', begleiter: 'comps', banner: 'banner', buende: 'bonds', feat: 'feats', rel: 'relics', sets: 'sets' };
const TAB_CLEAR = { story: ['trialH', 'trialL', 'side'], modi: ['horde', 'rush', 'chaos', 'tower', 'raids', 'helm', 'pfad', 'saga', 'mirror'], jagd: ['hunt'], chronik: ['chronik'], best: ['best'], reittiere: ['mounts'], begleiter: ['comps'], banner: ['banner'], buende: ['bonds'], sets: ['sets'], feat: ['feats'], rel: ['relics'], ach: ['ach'] };
const NAV_NEW = { nHeroes: ['comps', 'bonds', 'banner', 'mounts', 'halle'], nBag: ['sets'], nStory: ['hunt', 'trialH', 'trialL', 'horde', 'rush', 'chaos', 'tower', 'raids', 'helm', 'pfad', 'saga', 'mirror', 'side', 'best', 'chronik'], nQuest: ['quests'], nForge: ['forge'], nAch: ['ach', 'relics', 'feats'], chest: ['chest'] };
const NAV_LOCK = { nQuest: 'quests', nForge: 'forge', nAch: 'ach', chest: 'chest' };
const UNL_GO = { best: () => openStory('best'), chest: () => openChest(), quests: () => openQuests(), comps: () => openHeroes('begleiter'), relics: () => openRelics(), chronik: () => openStory('chronik'), ach: () => openAch(), bonds: () => openHeroes('buende'), forge: () => openForge(0), hunt: () => openStory('jagd'), trialH: () => openStory('story', undefined, Math.max(0, G.story.ch - 1)), trialL: () => openStory('story', undefined, Math.max(0, G.story.ch - 1)), horde: () => openModes(0), rush: () => openModes(0), chaos: () => openModes(0), tower: () => openModes(0), helm: () => openModes(0), pfad: () => openModes(0), raids: () => openModes(1), saga: () => openModes(2), mirror: () => openModes(2), halle: () => openHall(), feats: () => openFeats(), banner: () => openHeroes('banner'), sets: () => openSets(0), side: () => openStory('story'), mounts: () => openHeroes('reittiere') };
function lockHint(id) { const U = UNLOCKS.find(u => u.id === id); if (!U) return; sfx('click'); toast(`🔒 <b>${esc(U.n)}</b> wird freigeschaltet ab ${unlWhen(id)}.`, 'unlock'); }
function gate(id) { if (!isUnl(id)) { lockHint(id); return false; } if (G.unlNew && G.unlNew[id]) { delete G.unlNew[id]; save(); setTimeout(updateHud, 0); } return true; }
function applyLocks() {
  for (const [id, u] of Object.entries(NAV_LOCK)) { const el = document.getElementById(id); if (el) el.classList.toggle('lk', !isUnl(u)); }
  for (const [id, us] of Object.entries(NAV_NEW)) { const el = document.getElementById(id); if (el) el.classList.toggle('nwu', us.some(u => G.unlNew?.[u] && isUnl(u))); }
}
async function announceUnlocks() {
  G.unlSeen = G.unlSeen || {}; G.unlNew = G.unlNew || {};
  const nw = UNLOCKS.filter(U => isUnl(U.id) && !G.unlSeen[U.id]); if (!nw.length) return;
  for (const U of nw) { G.unlSeen[U.id] = 1; G.unlNew[U.id] = 1; } save(); updateHud(); sfx('join');
  let go = null;
  const pr = splash(`<div class="unl"><div class="kicker">Neu freigeschaltet</div>${nw.map(U => `<div class="unl-c"><span class="unl-ic">${U.ic}</span><div><b>${esc(U.n)}</b><small>${esc(U.d)}</small></div></div>`).join('')}<div class="unl-b"><button class="btn gold" id="unlGo">▶ Jetzt ansehen</button><button class="btn" id="unlLater">Weiter</button></div></div>`, 0, 'unlS');
  const s = $('#splash'), close = s.onclick;
  s.querySelector('#unlGo').onclick = e => { e.stopPropagation(); go = nw[0]; close && close(); };
  s.querySelector('#unlLater').onclick = e => { e.stopPropagation(); close && close(); };
  await pr; if (go && UNL_GO[go.id]) UNL_GO[go.id](); else pointAt(nw.map(U => U.id));
}
function pointAt(ids) { for (const [nid, us] of Object.entries(NAV_NEW)) if (us.some(u => ids.includes(u))) { const el = document.getElementById(nid); if (!el) continue; el.classList.add('hint'); const off = () => el.classList.remove('hint'); el.addEventListener('click', off, { once: true }); setTimeout(off, 9000); } }
function paintFlags(root) {
  requestAnimationFrame(() => root.querySelectorAll('canvas[data-flag]').forEach(cv => { const B = BANNERS.find(b => b.id === cv.dataset.flag); if (!B) return; const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return; cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); const c = cv.getContext('2d'), g = c.createRadialGradient(cv.width / 2, cv.height * .45, 4, cv.width / 2, cv.height * .5, cv.width * .7); g.addColorStop(0, '#3a4256'); g.addColorStop(1, '#10121a'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height); const sc = cv.height / 56; c.setTransform(sc, 0, 0, sc, cv.width / 2 - 7 * sc, cv.height - 3 * sc); RIG.flag(c, { em: B.em, cloth: B.cloth, emCol: B.emCol, t: 900 }); }));
}
function openBanners() {
  const cards = BANNERS.map(B => { const own = G.banners?.[B.id], on = G.banner === B.id; return `<div class="m-tile bnr ${own ? '' : 'lk'} ${on ? 'on' : ''}"><canvas data-flag="${B.id}"></canvas><b>${esc(B.n)}</b><small>${esc(B.d)}<br><em>${own ? (on ? 'Steht hinter deiner Gruppe' : 'Im Besitz') : '🔒 Sieg in Kapitel ' + (B.ch + 1)}</em></small>${own ? `<button class="btn small ${on ? '' : 'gold'}" data-bn="${B.id}" ${on ? 'disabled' : ''}>${on ? '✓ Aufgestellt' : '⚐ Aufstellen'}</button>` : ''}</div>`; });
  openSheet('Helden', `<div class="m-tiles bnrs">${cards.join('')}<div class="m-tile info"><span class="m-ic">⚐</span><b>Banner</b><small>Das aufgestellte Banner weht hinter deiner Gruppe und stärkt alle Helden. Neue Banner gibt es für Kapitel-Siege.</small></div></div>`, s => {
    paintFlags(s); s.querySelectorAll('[data-bn]').forEach(b => b.onclick = () => { G.banner = b.dataset.bn; save(); sfx('buff'); W.pendingParty = 1; toast(`<b>${esc(BANNERS.find(x => x.id === G.banner).n)}</b> aufgestellt`, 'lvl'); openBanners(); });
  }, { tabs: heroTabs(), tab: 'banner', onTab: t => openHeroes(t, 0) });
}
function openSheet(title, html, after, o = {}) {
  cancelAnimationFrame(artRaf);
  const s = $('#sheet');
  if (o.tab && TAB_CLEAR[o.tab] && G.unlNew) { let ch2 = 0; for (const u of TAB_CLEAR[o.tab]) if (G.unlNew[u]) { delete G.unlNew[u]; ch2 = 1; } if (ch2) { save(); setTimeout(updateHud, 0); } }
  const tabs = o.tabs ? `<div class="m-tabs ${o.tabs.length > 5 ? 'many' : ''}">${o.tabs.map(([id, n, badge]) => { const lk = TAB_UNL[id] && !isUnl(TAB_UNL[id]), nw = !lk && (TAB_CLEAR[id] || []).some(u => G.unlNew?.[u]); return `<button class="m-tab ${o.tab === id ? 'on' : ''} ${lk ? 'lk' : ''} ${nw ? 'nw' : ''}" data-tab="${id}">${n}${badge ? `<i>${badge}</i>` : ''}</button>`; }).join('')}</div>` : '';
  const pg = o.pages > 1 ? `<div class="m-pg"><button class="m-pb" data-pg="-1" ${o.page <= 0 ? 'disabled' : ''}>‹</button><span>${o.page + 1}/${o.pages}</span><button class="m-pb" data-pg="1" ${o.page >= o.pages - 1 ? 'disabled' : ''}>›</button></div>` : '';
  const vk = title + '|' + (o.tab || '') + '|' + (o.page || 0), fresh = vk !== openSheet.vk || !s.classList.contains('open'); openSheet.vk = vk; s.classList.toggle('anim', fresh);
  s.innerHTML = `<div class="sh-head"><h2>${title}</h2>${tabs}<div class="m-hr">${o.extra || ''}${pg}<button class="x" aria-label="Schließen">✕</button></div></div><div class="sh-body fit">${html}</div>`;
  s.hidden = false; requestAnimationFrame(() => s.classList.add('open')); document.body.classList.add('sheet-open');
  s.querySelector('.x').onclick = closeSheet;
  if (o.onTab) s.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { sfx('click'); if (b.classList.contains('lk')) return lockHint(TAB_UNL[b.dataset.tab]); o.onTab(b.dataset.tab); });
  if (o.onPage) s.querySelectorAll('[data-pg]').forEach(b => b.onclick = () => { sfx('click'); o.onPage(o.page + +b.dataset.pg); });
  paintCards(s); after && after(s);
  if (!s._swipe) { s._swipe = 1; let x0 = 0, y0 = 0, t0 = 0;
    s.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; t0 = Date.now(); s._head = !!e.target.closest('.sh-head'); });
    s.addEventListener('pointerup', e => { const [dx, dy] = appDelta(e.clientX - x0, e.clientY - y0); const portrait = innerHeight > innerWidth, inHead = !!s._head; if (Date.now() - t0 < 900 && ((portrait && inHead && dy > 80 && Math.abs(dx) < 60) || (!portrait && dx > 110 && Math.abs(dy) < 45 && !s.querySelector('.m-pb[data-pg="-1"]:not(:disabled)')))) { closeSheet(); return; } if (Date.now() - t0 < 900 && Math.abs(dx) > 70 && Math.abs(dy) < 45 && !e.target.closest('canvas#map')) { const b = s.querySelector(`.m-pb[data-pg="${dx < 0 ? 1 : -1}"]:not(:disabled)`); if (b) b.click(); } });
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
    const rg = ringOf(k);
    return `<div class="m-tc" style="--rc:${ROLE_COL[C.role]}"><button class="m-tart" data-hero="${k}"><canvas data-card="${k}" data-zoom="1.08"></canvas><span class="role-dot r-${C.role}"></span><span class="m-tstar">${stars(hs.stage)}</span>${rg ? `<span class="m-rtag" style="--rc:${rg.R.c}">◍ ${'★'.repeat(rg.stars)}</span>` : ''}</button><b>${esc(H.n)}</b><span class="pw">⚡ ${fmt(st.power)}</span>
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
function heroTabs() { return [['team', 'Team'], ['helden', `Alle ${owned().length}`], ['reittiere', 'Reittiere'], ['begleiter', 'Begleiter'], ['banner', 'Banner'], ['buende', 'Bünde']]; }
function openHeroes(tab = openHeroes.tab || 'team', page = openHeroes.page) {
  if (TAB_UNL[tab] && !isUnl(TAB_UNL[tab])) tab = 'team';
  if (tab === 'banner') { openHeroes.tab = tab; return openBanners(); }
  openHeroes.tab = tab;
  const own = owned().sort((a, b) => (G.party.includes(b) - G.party.includes(a)) || heroStats(b).power - heroStats(a).power);
  const all = [...own.map(k => [k, 0]), ...Object.keys(HEROES).filter(k => !G.heroes[k]).map(k => [k, 1])];
  const per = 12, np = tab === 'helden' ? pages(all.length, per) : 1; page = openHeroes.page = clampPg(page, np);
  let body = '';
  if (tab === 'team') body = teamView();
  else if (tab === 'helden') body = `<div class="m-heroes">${all.slice(page * per, page * per + per).map(([k, l]) => heroCard(k, l)).join('')}</div>`;
  else if (tab === 'reittiere') body = `<div class="m-mounts">${MOUNTS.map(m => { const own = (G.mounts || {})[m.id], riders = m.heroes.map(k => G.heroes[k] ? esc(HEROES[k].n) : '???').join(', '), k0 = m.heroes.find(k => G.heroes[k]), on = own && k0 && (G.ride || {})[k0] !== false; return `<div class="m-mt ${own ? '' : 'lk'}"><canvas data-mount="${m.id}"></canvas><b>${own ? esc(m.n) : '???'}</b><small>${own ? esc(m.d) : 'Kapitel ' + (m.ch + 1) + ' abschließen'}</small><small class="m-mb">${riders} · ${esc(m.bd)}</small>${own && k0 ? `<button class="btn small ${on ? 'on' : ''}" data-ridek="${m.heroes.filter(k => G.heroes[k]).join(',')}">${on ? '🐎 Reitet' : 'Zu Fuß'}</button>` : !own ? `<button class="btn small gold" data-buym="${m.id}">🔓 Früher ◆${fmt(mountPrice(m))}</button>` : ''}</div>`; }).join('')}</div>`;
  else if (tab === 'begleiter') body = `<div class="m-comps">${COMPANIONS.map(cp => { const own2 = G.comps[cp.id], src = cp.from.ch !== undefined ? 'Kapitel ' + (cp.from.ch + 1) : 'Nebenquest'; return `<button class="comp ${own2 ? '' : 'lk'} ${G.companion === cp.id ? 'on' : ''}" data-cp="${cp.id}"><canvas data-comp="${cp.id}"></canvas><b>${own2 ? esc(cp.n) : '???'}</b><small>${own2 ? esc(cp.d) : src}</small>${G.companion === cp.id ? '<span class="tag in">Aktiv</span>' : ''}</button>`; }).join('')}</div>`;
  else body = `<div class="m-facs">${activeFactions().map(f => `<div class="fac ${f.tier >= 0 ? 'on' : ''}" style="--fc:${f.F.c}"><span class="fi">${f.F.ic}</span><div><b>${esc(f.F.n)} <em>${f.n}</em></b><small>${f.F.t.map((t, i) => `<i class="${f.tier >= i ? 'act' : ''}">${t[0]}: ${esc(t[2])}</i>`).join('<br>')}</small></div></div>`).join('')}</div>`;
  openSheet('Helden', body, s => {
    s.querySelectorAll('.hcard[data-k]').forEach(b => b.onclick = () => { sfx('click'); openHero(b.dataset.k); });
    s.querySelectorAll('[data-hero]').forEach(b => b.onclick = () => { sfx('click'); openHero(b.dataset.hero, 'werte'); });
    s.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { sfx('click'); const [hk, sl] = b.dataset.slot.split('|'); openSlot(hk, sl); });
    s.querySelectorAll('[data-gohero]').forEach(b => b.onclick = () => openHeroes('helden', 0));
    s.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { const id = b.dataset.cp; if (!G.comps[id]) return; G.companion = id; sfx('click'); W.pendingParty = 1; save(); openHeroes(); });
    paintComps(s);
    s.querySelectorAll('[data-buym]').forEach(b => b.onclick = () => buyMount(MOUNTS.find(x => x.id === b.dataset.buym), () => openHeroes('reittiere')));
    s.querySelectorAll('[data-ridek]').forEach(b => b.onclick = () => { G.ride = G.ride || {}; const ks = b.dataset.ridek.split(','), on = G.ride[ks[0]] !== false; ks.forEach(k => G.ride[k] = !on); save(); W.pendingParty = 1; refreshLooks(); sfx('click'); openHeroes('reittiere'); });
    const oa = s.querySelector('#optAll'); if (oa) oa.onclick = () => {
      const p0 = G.party.reduce((a, k) => a + heroStats(k).power, 0); if (G.settings.autoParty) autoParty(); const eq = autoEquip() + autoRings(); const tr = 0; refreshLooks();
      save(); W.pendingParty = 1; buildHud(); const p1 = G.party.reduce((a, k) => a + heroStats(k).power, 0);
      sfx(tr || eq ? 'level' : 'click'); toast(eq ? `Optimiert: ${eq} Ausrüstungswechsel · Kampfkraft +${fmt(p1 - p0)}` : 'Schon optimal ausgerüstet.', eq ? 'lvl' : 'mini'); openHeroes();
    };
    const ap = s.querySelector('#autoP'); if (ap) ap.onclick = () => { G.settings.autoParty = !G.settings.autoParty; if (G.settings.autoParty) { autoParty(); W.pendingParty = 1; buildHud(); } save(); openHeroes(); };
  }, { tabs: heroTabs(), tab, onTab: t => openHeroes(t, 0), pages: np, page, onPage: p => openHeroes(tab, p),
    extra: tab === 'team' || tab === 'helden' ? `${tab === 'team' ? `<button class="btn small ${isUnl('halle') ? '' : 'lk'}" id="hallB" title="Heldenhalle">🏛<span class="lbl"> Halle</span></button>` : ''}<button class="btn small gold" id="optAll" title="Beste Ausrüstung für alle anlegen">⚡<span class="lbl"> Optimieren</span></button><button class="btn small ${G.settings.autoParty ? 'on' : ''}" id="autoP" title="Gruppe automatisch aufstellen">Auto</button>` : '' });
  const hb = $('#sheet').querySelector('#hallB'); if (hb) hb.onclick = () => openHall();
}
function mountPrice(m) { return 1200 + m.ch * 260; }
function buyMount(m, after) { if (G.gold < mountPrice(m)) { toast(`Dafür brauchst du ◆ ${fmt(mountPrice(m))} Gold.`, 'mini'); return; } G.gold -= mountPrice(m); G.mounts = G.mounts || {}; G.mounts[m.id] = 1; save(); sfx('join'); toast(`<b>${esc(m.n)}</b> früher freigeschaltet!`, 'lvl'); W.pendingParty = 1; refreshLooks(); updateHud(); after && after(); }
function footLook(k) { const L = heroLook(k); delete L.mount; return L; }
function paintMounts(root) { root.querySelectorAll('canvas[data-mount]').forEach(cv => { const m = MOUNTS.find(x => x.id === cv.dataset.mount); requestAnimationFrame(() => { const dpr = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; const c = cv.getContext('2d'), g = c.createRadialGradient(cv.width / 2, cv.height * .55, 2, cv.width / 2, cv.height / 2, cv.width * .7); g.addColorStop(0, 'rgba(232,189,92,.3)'); g.addColorStop(1, 'rgba(10,13,18,0)'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height); const sc = Math.min(cv.height / 40, cv.width / 42); c.setTransform(sc, 0, 0, sc, cv.width / 2 - 4 * sc, cv.height * .93); RIG.draw(c, 'quad', Object.assign({ horse: 1, pony: m.kind === 'pony' ? 1 : 0, eye: '#2a1a12' }, m.look), 'idle', 0, 500); }); }); }
function paintComps(root) { paintMounts(root); if (typeof paintRings === 'function') paintRings(root); root.querySelectorAll('canvas[data-comp]').forEach(c => { const cp = COMPANIONS.find(x => x.id === c.dataset.comp); requestAnimationFrame(() => compArt(c, cp)); }); }
function compArt(cv, cp) {
  const dpr = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; const c = cv.getContext('2d');
  const g = c.createRadialGradient(cv.width / 2, cv.height / 2, 2, cv.width / 2, cv.height / 2, cv.width * .7); g.addColorStop(0, 'rgba(232,189,92,.35)'); g.addColorStop(1, 'rgba(10,13,18,1)'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  const hz = cp.kind === 'pony' || cp.kind === 'horse', sc = hz ? Math.min(cv.height / 40, cv.width / 42) : cv.height / 34; c.setTransform(sc, 0, 0, sc, cv.width / 2 - (hz ? 4 * sc : 0), cv.height * (hz ? .93 : .86));
  if (cp.kind === 'eagle') { c.translate(0, -14); RIG.drawEagle(c, cp.look, 400); }
  else if (cp.kind === 'ghosts') { c.globalAlpha = .7; c.scale(.8, .8); RIG.draw(c, 'hum', Object.assign({ wpn: 'sword' }, ENEMIES.dead_soldier.look), 'idle', 0, 400); }
  else if (cp.kind === 'sled') { c.scale(.95, .95); c.translate(-6, -2); RIG.sled(c, cp.look, 'idle', 0, 400); }
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
    ${(() => { const fr = fameRank(k), f = G.heroes[k].fame || 0, nx = FAME[fr + 1]; return `<div class="m-fame"><b>✦ ${FAME[fr][1]}</b><span>Ruhm ${fmt(f)}${nx ? ' / ' + fmt(nx[0]) : ''}</span><div class="bar"><i style="width:${nx ? Math.min(100, (f - FAME[fr][0]) / (nx[0] - FAME[fr][0]) * 100) : 100}%"></i></div></div>`; })()}
    <div class="m-pow"><div class="power">⚡ ${fmt(st.power)}<small>Kampfkraft</small></div><div class="lvl"><span>Gruppenstufe ${G.team.lvl}</span><div class="bar"><i style="width:${G.team.xp / xpNeed(G.team.lvl) * 100}%"></i></div></div></div>
    <div class="stats">${[['Leben', st.hp], [magic ? 'Magie' : 'Angriff', magic ? st.mag : st.atk], ['Verteid.', st.def], ['Tempo', st.spd], ['Krit', st.crit + ' %']].map(([n, v]) => `<div><small>${n}</small><b>${typeof v === 'number' ? fmt(v) : v}</b></div>`).join('')}</div>
    ${(() => { const rg = ringOf(k); return `<div class="m-mount m-hring ${rg ? '' : 'lk'}" style="--rc:${rg ? rg.R.c : '#888'}">${rg ? `<canvas data-ring="${rg.R.id}"></canvas>` : '<div class="ic empty"></div>'}<div><b>◍ ${rg ? esc(rg.R.n) + ' ' + '★'.repeat(rg.stars) : 'Kein Ring'}</b><small>${rg ? ringEff(rg.R, rg.stars) : 'Schmiede Ringe aus Fragmenten'}</small></div><button class="btn small ${rg ? '' : 'gold'}" id="toForge">Schmiede</button></div>`; })()}
    ${(() => { const m = mountFor(k); if (!m) return ''; const own = (G.mounts || {})[m.id], on = own && (G.ride || {})[k] !== false; return `<div class="m-mount ${own ? '' : 'lk'}"><canvas data-mount="${m.id}"></canvas><div><b>🐎 ${own ? esc(m.n) : '???'}</b><small>${own ? esc(m.bd) : 'Schaltet sich in Kapitel ' + (m.ch + 2) + ' frei'}</small></div>${own ? `<button class="btn small ${on ? 'on' : ''}" id="ride">${on ? 'Reitet' : 'Zu Fuß'}</button>` : ''}</div>`; })()}
    <div class="hi-fac">${heroFactions(k)}${BONDS.filter(b => b.a === k || b.b === k).map(b => { const o = b.a === k ? b.b : b.a, on = G.party.includes(k) && G.party.includes(o); return `<span class="fchip bond ${on ? 'on' : ''}">♥ ${G.heroes[o] ? esc(HEROES[o].n) : '???'}${on ? ' · aktiv' : ''}</span>`; }).join('')}</div>
    <div class="acts">
      <button class="btn ${inP ? '' : 'primary'}" id="toggleP" ${G.away[k] ? 'disabled' : ''}>${inP ? 'Aus der Gruppe' : 'In die Gruppe'}</button>
      <button class="btn" id="toEq">Ausrüstung</button>
      ${ev ? `<button class="btn ${ev.ok ? 'gold' : ''}" id="evo" ${ev.ok ? '' : 'disabled'}>${ev.lvlOk ? 'Entwickeln <small>kostenlos</small>' : `Früher entwickeln <small>◆${fmt(ev.cost.gold)} · sonst ab St. ${cap}</small>`}</button>` : '<span class="muted small">Höchste Stufe</span>'}
    </div>`;
  else if (tab === 'faehig') right = `<div class="m-skills">${skillRow('ult', kit.ult, false, 'Leiste voll')}${skillRow('act', H.act, false, `alle ${H.act.cd + 1} Züge`)}${skillRow('act2', H.act2, hs.lvl < ACT2_LVL, hs.lvl < ACT2_LVL ? `ab Stufe ${ACT2_LVL}` : `alle ${H.act2.cd + 1} Züge`)}${H.pas.map(p => skillRow('pas', p, hs.lvl < p.lvl, hs.lvl < p.lvl ? `ab Stufe ${p.lvl}` : '')).join('')}</div>`;
  else right = `<div class="gear">${Object.entries(SLOTS).map(([slot, n]) => { const it = hs.eq[slot] && itemById(hs.eq[slot]); return `<div class="gs" data-slot="${k}|${slot}" style="--rc:${it ? RARITY[it.r].c : '#3a444e'}">${it ? icHtml(it) : '<div class="ic empty"></div>'}<div><small>${n}</small><b style="${it ? 'color:' + RARITY[it.r].c : ''}">${it ? esc(it.name) + (it.enh ? ' +' + it.enh : '') : 'Leer'}</b>${it ? `<span>${itemLines(it).slice(0, 3).join(' · ')}</span>` : ''}</div></div>`; }).join('')}</div>${setLines(k)}<div class="acts"><button class="btn gold" id="bestEq">Beste anlegen</button><button class="btn" id="toTeam">Team-Übersicht</button></div>`;
  openSheet(esc(H.n), `<div class="m-hero"><div class="hero-art" style="--rc:${ROLE_COL[C.role]}"><canvas id="bigArt"></canvas><div class="ha-foot">${stars(hs.stage)}<span>${esc(heroTitle(k))}</span></div></div><div class="m-hr-r">${right}</div></div>`, s => {
    const cv = s.querySelector('#bigArt'); const seq = ['idle', { melee: 'attack', spin: 'attack', cast: 'cast', shoot: 'shoot', throw: 'throw', shout: 'shout' }[H.act.anim] || 'attack', 'idle', 'victory'];
    let si = 0, t0 = performance.now();
    const loop = now => { const a = seq[si]; const dur = a === 'idle' ? 2600 : a === 'victory' ? 1800 : RIG.animTime(a) + 300; if (now - t0 > dur) { si = (si + 1) % seq.length; t0 = now; } RIG.card(cv, 'hum', footLook(k), { col: ROLE_COL[C.role], seed: k, anim: seq[si], el: now - t0, gt: now, zoom: 1.02 }); artRaf = requestAnimationFrame(loop); };
    artRaf = requestAnimationFrame(loop);
    const on = (id, f) => { const e = s.querySelector(id); if (e) e.onclick = f; };
    on('#toTeam', () => openHeroes('team'));
    on('#bestEq', () => { const n = autoEquip([k]); refreshLooks(); toast(n ? 'Ausrüstung verbessert' : 'Bereits optimal ausgerüstet', 'mini'); W.pendingParty = 1; openHero(k); });
    on('#toBag', () => openBag());
    on('#toEq', () => openHero(k, 'ausr'));
    on('#toForge', () => openForge());
    paintRings(s);
    on('#ride', () => { G.ride = G.ride || {}; G.ride[k] = G.ride[k] === false; save(); W.pendingParty = 1; refreshLooks(); openHero(k); });
    paintMounts(s);
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
/* ---------- Sets: Übersicht, Fortschritt und wo man sie farmt ---------- */
function setSource(S) {
  if (S.ch !== undefined) { const ok = chapterStatus(S.ch) === 'done'; return { t: `Kapitelboss ${S.ch + 1} · ${STORY[S.ch].n}`, ok, lbl: ok ? '▶ Boss farmen' : `🔒 ab Kapitel ${S.ch + 1}`, go: () => playNow({ type: 'boss', ch: S.ch }, 'Bosskampf: ' + STORY[S.ch].n) }; }
  if (S.src === 'tower') return { t: 'Orthanc-Turm: 35 % pro bezwungener Etage', ok: isUnl('tower'), lbl: isUnl('tower') ? '▶ Turm' : '🔒 ab ' + unlWhen('tower'), go: () => playNow({ type: 'tower' }, 'Orthanc-Turm') };
  if (S.src === 'horde') return { t: 'Endloser Ansturm: Chance alle 5 Wellen', ok: isUnl('horde'), lbl: isUnl('horde') ? '▶ Ansturm' : '🔒 ab ' + unlWhen('horde'), go: () => playNow({ type: 'mode', id: 'horde' }, 'Endloser Ansturm') };
  return { t: 'Prüfungen der Macht: ab Stufe 2', ok: isUnl('raids'), lbl: isUnl('raids') ? '▶ Prüfungen' : '🔒 ab ' + unlWhen('raids'), go: () => openModes(1) };
}
function openSets(page = openSets.page) {
  if (!gate('sets')) return;
  const per = 6, np = pages(SETS.length, per); page = openSets.page = clampPg(page, np);
  openSheet('Beutel', `<div class="m-sets">${SETS.slice(page * per, page * per + per).map((S, i) => { const o = setOwned(S.id), n = Object.keys(o).length, src = setSource(S); return `<div class="m-set ${n >= 3 ? 'full' : ''}" style="--sc:${S.c}"><div class="m-sh"><b>${esc(S.n)}</b><span>${n}/3</span></div><div class="m-sp">${['weapon', 'armor', 'trinket'].map(sl => o[sl] ? icHtml(o[sl]) : `<div class="ic empty" title="${SLOTS[sl]}"></div>`).join('')}</div><small class="${n >= 2 ? 'on' : ''}">2 Teile: ${esc(S.d2)}</small><small class="${n >= 3 ? 'on' : ''}">3 Teile: ${esc(S.d3)}</small><div class="m-src" title="${esc(src.t)}">${esc(src.t)}</div><button class="btn small ${src.ok ? 'gold' : ''}" data-farm="${page * per + i}" ${src.ok ? '' : 'disabled'}>${src.lbl}</button></div>`; }).join('')}</div>`, s => {
    s.querySelectorAll('[data-farm]').forEach(b => b.onclick = () => setSource(SETS[+b.dataset.farm]).go());
  }, { tabs: [['all', 'Alle'], ['weapon', 'Waffen'], ['armor', 'Rüstung'], ['trinket', 'Schmuck'], ['sets', 'Sets']], tab: 'sets', onTab: t => t === 'sets' ? openSets() : openBag(t, 0, null), pages: np, page, onPage: p => openSets(p) });
}
function openBag(f = openBag.f || 'all', page = openBag.page, sel = openBag.sel) {
  if (f === 'sets') return openSets();
  openBag.f = f;
  const list = G.inv.filter(it => f === 'all' || it.slot === f).sort((a, b) => b.r - a.r || b.lvl - a.lvl);
  const per = 15, np = pages(list.length, per); page = openBag.page = clampPg(page, np);
  const it = itemById(sel) || list[page * per]; openBag.sel = it?.id;
  const by = it && equippedBy(it.id);
  const det = it ? `<div class="m-idet" style="--rc:${RARITY[it.r].c}"><div class="m-ih">${icHtml(it)}<div><b style="color:${RARITY[it.r].c}">${esc(it.name)}${it.enh ? ' +' + it.enh : ''}</b><small>${RARITY[it.r].n} · ${SLOTS[it.slot]}${it.slot === 'weapon' ? ' · ' + WCLS[it.base] : ''} · St. ${it.lvl}</small></div></div>
    <ul>${itemLines(it).map(l => `<li>${esc(l)}</li>`).join('')}</ul>${it.passive ? `<p class="leg">${esc(it.passive)}</p>` : ''}
    <div class="m-ia">${(() => { const b = bestHeroFor(it); return b ? `<button class="btn small gold" data-eqb="${b.k}">Anlegen: ${esc(HEROES[b.k].n)} <span class="pos">+${fmt(b.d)} ⚡</span></button>` : ''; })()}${by ? `<span class="m-worn">Getragen von ${esc(HEROES[by].n)}</span>` : ''}<div class="m-ia2 one"><button class="btn small ghost" data-sv="${it.id}" ${by ? 'disabled' : ''}>Zerlegen<small>◆${fmt(itemValue(it))}</small></button></div></div></div>` : '<div class="m-idet"><p class="muted">Noch keine Gegenstände. Sie fallen in Kämpfen.</p></div>';
  openSheet('Beutel', `<div class="m-bag"><div class="m-items">${list.slice(page * per, page * per + per).map(x => `<button class="m-it ${x.id === it?.id ? 'sel' : ''} ${x.r >= 4 ? 'leg' : ''}${x.r >= 5 ? ' myth' : ''}" data-it="${x.id}" style="--rc:${RARITY[x.r].c}">${icHtml(x)}<b>${esc(x.name)}</b>${x.nw ? '<em class="nw">NEU</em>' : ''}${equippedBy(x.id) ? '<i>●</i>' : bestHeroFor(x) ? '<i class="up">▲</i>' : ''}</button>`).join('')}</div>${det}</div>`, s => {
    s.querySelectorAll('[data-it]').forEach(b => b.onclick = () => { sfx('click'); openBag(f, page, +b.dataset.it); });
    s.querySelectorAll('[data-eqb]').forEach(b => b.onclick = () => { const hk = b.dataset.eqb; equip(hk, it); W.pendingParty = 1; refreshLooks(); sfx('level'); toast(`${esc(HEROES[hk].n)}: <b style="color:${RARITY[it.r].c}">${esc(it.name)}</b> angelegt`, 'lvl'); openBag(f, page, it.id); });
    list.slice(page * per, page * per + per).forEach(x => { if (x.nw) x.nw = 0; }); save();
    s.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { const x = itemById(+b.dataset.sv); if (x.r >= 3 && !b.dataset.armed) { b.dataset.armed = 1; b.classList.add('danger'); b.innerHTML = 'Wirklich zerlegen?<small>nochmal tippen</small>'; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.classList.remove('danger'); b.innerHTML = `Zerlegen<small>◆${fmt(itemValue(x))}</small>`; } }, 3000); return; } const v = salvage(x); save(); toast(`+${fmt(v)} ◆`, 'mini'); openBag(f, page, null); });
    const sv = s.querySelector('#salv'); if (sv) sv.onclick = () => { let g = 0; G.inv.filter(x => x.r <= 1 && !equippedBy(x.id)).forEach(x => g += salvage(x)); save(); toast(`Zerlegt: +${fmt(g)} ◆`, 'mini'); openBag(f, 0, null); };
  }, { tabs: [['all', 'Alle'], ['weapon', 'Waffen'], ['armor', 'Rüstung'], ['trinket', 'Schmuck'], ['sets', 'Sets']], tab: f, onTab: t => openBag(t, 0, null), pages: np, page, onPage: p => openBag(f, p, null), extra: '<button class="btn small" id="salv" title="Alle gewöhnlichen, nicht angelegten Teile zerlegen">Aufräumen</button>' });
}

/* ---------- Reise: Karte + Kapitel, Modi als Kacheln ---------- */
const PARTS = ['Teil I · Der Hobbit', 'Teil II · Der Ringkrieg', 'Teil III · Die Ringe der Macht', 'Teil IV · Das Letzte Bündnis', 'Teil V · Das Erste Zeitalter'];
const PART_COL = ['#2e8a4a', '#b8402a', '#3a5ab8', '#c8902a', '#8a3ac8'];
const PART_SHORT = ['I · Hobbit', 'II · Ringkrieg', 'III · Ringe', 'IV · Bündnis', 'V · Urzeit'];
function chapterStatus(i) { if (i < G.story.ch || G.story.loop > 0) return 'done'; if (i === G.story.ch) return 'cur'; return 'locked'; }

/* ---------- Pergamentkarte von Mittelerde (einmal gezeichnet, gecacht) ---------- */
function mapBase(w, h) {
  const key = w + 'x' + h; if (mapBase.k === key) return mapBase.cv; const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d'), sx = w / 100, sy = h / 75, X = x => x * sx, Y = y => y * sy, r = Math.min(sx, sy); let sd = 7; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  // Pergament
  let g = c.createRadialGradient(w * .5, h * .45, 10, w * .5, h * .5, w * .72); g.addColorStop(0, '#f1e3c0'); g.addColorStop(.7, '#dcc49a'); g.addColorStop(1, '#a88a5e'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { const x = R() * w, y = R() * h, rr = (4 + R() * 14) * r; g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, `rgba(140,100,50,${.05 + R() * .07})`); g.addColorStop(1, 'rgba(140,100,50,0)'); c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  c.strokeStyle = 'rgba(120,90,50,.08)'; c.lineWidth = .6; for (let i = 0; i < 260; i++) { const x = R() * w, y = R() * h, l = (1 + R() * 4) * r; c.beginPath(); c.moveTo(x, y); c.lineTo(x + l, y + (R() - .5) * l * .3); c.stroke(); }
  // Meer im Westen mit Küstenlinie und Wellen
  const coast = () => { c.beginPath(); c.moveTo(0, 0); c.lineTo(X(11), 0); c.bezierCurveTo(X(6), Y(14), X(13), Y(26), X(8), Y(38)); c.bezierCurveTo(X(4), Y(48), X(12), Y(60), X(13), Y(75)); c.lineTo(0, Y(75)); c.closePath(); };
  coast(); c.fillStyle = 'rgba(80,120,150,.28)'; c.fill(); c.save(); coast(); c.clip(); c.strokeStyle = 'rgba(60,90,120,.35)'; c.lineWidth = .7; for (let y = 4; y < 75; y += 4.5) for (let x = 1; x < 12; x += 5) { c.beginPath(); c.moveTo(X(x), Y(y)); c.quadraticCurveTo(X(x + 1.2), Y(y - 1), X(x + 2.4), Y(y)); c.stroke(); } c.restore();
  c.strokeStyle = 'rgba(70,50,30,.55)'; c.lineWidth = r * .35; c.beginPath(); c.moveTo(X(11), 0); c.bezierCurveTo(X(6), Y(14), X(13), Y(26), X(8), Y(38)); c.bezierCurveTo(X(4), Y(48), X(12), Y(60), X(13), Y(75)); c.stroke();
  // Flüsse
  const river = (pts, w0, w1) => { for (let i = 1; i < pts.length; i++) { const t = i / (pts.length - 1); c.strokeStyle = 'rgba(60,100,140,.6)'; c.lineWidth = r * (w0 + (w1 - w0) * t); c.lineCap = 'round'; c.beginPath(); c.moveTo(X(pts[i - 1][0]), Y(pts[i - 1][1])); c.lineTo(X(pts[i][0]), Y(pts[i][1])); c.stroke(); } };
  river([[56, 10], [55, 20], [57, 30], [55, 40], [58, 48], [60, 56], [61, 64], [63, 75]], .25, .75); river([[27, 18], [26, 28], [28, 38], [25, 48], [22, 58]], .2, .45); river([[78, 14], [79, 24], [82, 34], [86, 40]], .15, .35);
  // Gebirge in Tusche mit Licht- und Schattenseite
  const peak = (x, y, s2) => { const px = X(x), py = Y(y), ww = r * 1.9 * s2, hh = r * 2.6 * s2; c.fillStyle = 'rgba(250,240,215,.55)'; c.beginPath(); c.moveTo(px - ww, py + hh * .4); c.lineTo(px, py - hh); c.lineTo(px, py + hh * .4); c.fill(); c.fillStyle = 'rgba(110,80,50,.45)'; c.beginPath(); c.moveTo(px, py - hh); c.lineTo(px + ww, py + hh * .4); c.lineTo(px, py + hh * .4); c.fill();
    c.strokeStyle = 'rgba(70,46,26,.7)'; c.lineWidth = r * .22; c.beginPath(); c.moveTo(px - ww, py + hh * .4); c.lineTo(px, py - hh); c.lineTo(px + ww, py + hh * .4); c.stroke(); c.lineWidth = r * .12; c.beginPath(); for (let k = 1; k < 3; k++) { c.moveTo(px + ww * k * .25, py - hh + hh * 1.4 * k * .25); c.lineTo(px + ww * k * .25 + ww * .2, py + hh * .2); } c.stroke(); };
  const range = (x0, y0, x1, y1, n, s2 = 1) => { for (let i = 0; i <= n; i++) { const t = i / n; peak(x0 + (x1 - x0) * t + (R() - .5) * 1.2, y0 + (y1 - y0) * t + (R() - .5) * 1.2, s2 * (.75 + R() * .45)); } };
  range(42, 8, 44, 44, 15); range(46, 6, 70, 7, 11, .8); range(44, 60, 62, 61, 9, .85); range(64, 51, 84, 51, 9); range(64, 52, 65, 68, 7); range(65, 68, 84, 67, 8, .9); peak(76, 17, 1.7);
  // Wälder aus Baumzeichen
  const forest = (cx0, cy0, rx, ry, n, col) => { for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()); const x = X(cx0 + Math.cos(a) * rx * d), y = Y(cy0 + Math.sin(a) * ry * d); c.fillStyle = col; c.beginPath(); c.arc(x, y - r * .5, r * .75, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(60,46,26,.55)'; c.lineWidth = r * .14; c.stroke(); c.beginPath(); c.moveTo(x, y + r * .2); c.lineTo(x, y + r * .7); c.stroke(); } };
  forest(62, 26, 6.5, 11, 70, 'rgba(70,96,56,.55)'); forest(54, 46, 2.6, 2.4, 14, 'rgba(200,170,70,.6)'); forest(47, 52, 2.6, 2.6, 14, 'rgba(70,96,56,.55)'); forest(27, 39, 2, 1.8, 9, 'rgba(70,96,56,.5)');
  // Schicksalsberg glüht
  g = c.createRadialGradient(X(77), Y(60), 0, X(77), Y(60), r * 4); g.addColorStop(0, 'rgba(220,70,30,.55)'); g.addColorStop(1, 'rgba(220,70,30,0)'); c.fillStyle = g; c.fillRect(X(77) - r * 4, Y(60) - r * 4, r * 8, r * 8);
  // Regionsnamen
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(80,50,24,.42)';
  for (const [n, x, y, fs, rot] of [['ERIADOR', 22, 22, 3.2, -.05], ['RHOVANION', 70, 36, 2.6, 0], ['ROHAN', 49, 57, 2.8, .05], ['GONDOR', 54, 67, 2.8, 0], ['MORDOR', 75, 59, 3.2, 0], ['RHÛN', 90, 30, 2.6, 0], ['HARAD', 80, 72, 2.4, 0], ['FORODWAITH', 30, 4, 2.2, 0], ['LINDON', 7, 30, 2.2, -1.57]]) { c.save(); c.translate(X(x), Y(y)); c.rotate(rot); c.font = `600 ${r * fs}px Cinzel, serif`; c.letterSpacing = r * fs * .35 + 'px'; c.fillText(n, 0, 0); c.restore(); }
  // Kompassrose
  { const cx0 = X(93), cy0 = Y(64), rr = r * 4.2; c.save(); c.translate(cx0, cy0); c.strokeStyle = 'rgba(80,50,24,.6)'; c.lineWidth = r * .15; c.beginPath(); c.arc(0, 0, rr * .78, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, L2 = i % 2 ? rr * .55 : rr, wd = rr * .14; c.save(); c.rotate(a + Math.PI / 2); c.fillStyle = i === 0 ? 'rgba(170,40,30,.75)' : 'rgba(80,50,24,.6)'; c.beginPath(); c.moveTo(0, -L2); c.lineTo(wd, 0); c.lineTo(-wd, 0); c.closePath(); c.fill(); c.restore(); }
    c.fillStyle = 'rgba(80,50,24,.8)'; c.font = `700 ${r * 1.8}px Cinzel, serif`; c.fillText('N', 0, -rr - r * 1.2); c.restore(); }
  // angesengte, gealterte Ränder
  g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .38, w / 2, h / 2, Math.max(w, h) * .62); g.addColorStop(0, 'rgba(70,40,15,0)'); g.addColorStop(1, 'rgba(70,40,15,.5)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 70; i++) { const side = i % 4, t = R(), x = side === 0 ? t * w : side === 1 ? w : side === 2 ? t * w : 0, y = side === 0 ? 0 : side === 1 ? t * h : side === 2 ? h : t * h, rr = (1.5 + R() * 3.5) * r; g = c.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(40,22,8,.55)'); g.addColorStop(1, 'rgba(40,22,8,0)'); c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  mapBase.k = key; mapBase.cv = cv; return cv;
}
function mapFog(w, h) {
  const fc = document.createElement('canvas'); fc.width = w; fc.height = h; const f = fc.getContext('2d'), sx = w / 100, sy = h / 75, r = Math.min(sx, sy);
  f.fillStyle = 'rgba(52,44,34,.6)'; f.fillRect(0, 0, w, h); let sd = 3; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) { const x = R() * w, y = R() * h, rr = (6 + R() * 12) * r, g = f.createRadialGradient(x, y, 0, x, y, rr); g.addColorStop(0, 'rgba(230,220,200,.12)'); g.addColorStop(1, 'rgba(230,220,200,0)'); f.fillStyle = g; f.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  f.globalCompositeOperation = 'destination-out';
  const hole = (p, rr) => { const x = p[0] * sx, y = p[1] * sy, g = f.createRadialGradient(x, y, rr * .35, x, y, rr); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = g; f.fillRect(x - rr, y - rr, rr * 2, rr * 2); };
  STORY.forEach((C, i) => { const st = chapterStatus(i); if (st !== 'locked') hole(C.map, r * (st === 'cur' ? 13 : 15)); });
  SIDE.forEach(sd => { if (G.side[sd.id] || sideUnlocked(sd)) hole(sd.map, r * 8); });
  return fc;
}
function drawMap(cv, part, sel, travel) {
  const dpr = Math.min(2, devicePixelRatio || 1), W0 = cv.clientWidth, H0 = cv.clientHeight; if (cv.width !== Math.round(W0 * dpr) || cv.height !== Math.round(H0 * dpr)) { cv.width = Math.round(W0 * dpr); cv.height = Math.round(H0 * dpr); }
  const c = cv.getContext('2d'), sx = cv.width / 100, sy = cv.height / 75, X = x => x * sx, Y = y => y * sy, r = Math.min(sx, sy);
  c.drawImage(mapBase(cv.width, cv.height), 0, 0);
  if (!G.story.loop) { const fk = cv.width + 'x' + cv.height + ':' + G.story.ch + ':' + Object.keys(G.side || {}).length; if (drawMap.fk !== fk) { drawMap.fk = fk; drawMap.fog = mapFog(cv.width, cv.height); } c.drawImage(drawMap.fog, 0, 0); }
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
  { const cur = STORY[G.story.ch], here = travel ? travel.pos : cur && cur.part === PARTS[part] ? cur.map : null;
    if (here) { const x = X(here[0]), y = Y(here[1]), BN = G.banner && BANNERS.find(b => b.id === G.banner), k = r * .2, t = performance.now();
      c.save(); c.globalAlpha = .35 + .25 * Math.sin(t / 300); c.strokeStyle = '#fff2c0'; c.lineWidth = r * .5; c.beginPath(); c.arc(x, y, r * (4.4 + Math.sin(t / 300)), 0, Math.PI * 2); c.stroke(); c.restore();
      c.save(); c.translate(x + r * 2.2, y - r * .6); c.scale(k, k); RIG.flag(c, { em: BN ? BN.em : 'star', cloth: BN ? BN.cloth : '#8a1e1a', emCol: BN ? BN.emCol : '#f0d070', t, w: 11, h: 15, pole: 30 }); c.restore(); } }
}
function chapterCard(i) {
  const C = STORY[i], st = chapterStatus(i), joins = [...(C.join || []), ...Object.values(C.mid || {}).flat(), ...(C.end || [])].filter((k, j, a) => a.indexOf(k) === j);
  const boss = C.boss.find(k => ENEMIES[k].boss) || C.boss[0], seen = st !== 'locked';
  const btn = st === 'cur' ? `<button class="btn gold big m-play" id="goOn">▶ ${G.story.wave >= WAVES ? 'Zum Bosskampf' : 'Weiterspielen'}</button>` : st === 'done' ? `<button class="btn gold big m-play" data-rematch="${i}">▶ Boss erneut${chapterSet(i) ? ' · Set' : ''}</button>` : '<button class="btn big m-play" disabled>🔒 Noch gesperrt</button>';
  return `<div class="m-ch ${st}"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1" class="${seen ? '' : 'sil'}"></canvas><span class="cc-st">${st === 'done' ? '✓ Geschafft' : st === 'cur' ? (G.story.wave >= WAVES ? 'Boss wartet' : `Welle ${G.story.wave + 1}/${WAVES}`) : 'Gesperrt'}</span></div>
    <small>Kapitel ${i + 1}</small><h3>${esc(C.n)}</h3>
    ${st === 'done' ? `<div class="cc-trials">${['h', 'l'].map(t => { const op = trialOpen(i, t), m = G.trials?.[i]?.[t] || 0; const fu = isUnl(t === 'h' ? 'trialH' : 'trialL'); return `<button class="btn small tr-b ${t} ${fu ? '' : 'lk'}" ${op && fu ? `data-trial="${i}:${t}"` : fu ? 'disabled' : `data-lock="${t === 'h' ? 'trialH' : 'trialL'}"`} style="--tc:${TRIAL[t].c}"><span>${op && fu ? '' : '🔒 '}${TRIAL[t].n}</span><i>${fu ? starStr(m) : 'ab Kap. ' + (Math.floor(UNLOCKS.find(u => u.id === (t === 'h' ? 'trialH' : 'trialL')).at) + 1)}</i></button>`; }).join('')}</div>` : ''}
    <div class="cc-rows"><div><b>Boss</b><span>${seen ? esc(ENEMIES[boss].n) : '???'}</span></div>${joins.length ? `<div><b>Helden</b><span>${joins.map(k => G.heroes[k] ? esc(HEROES[k].n) : '???').join(', ')}</span></div>` : ''}<div class="cc-opt"><b>Relikt</b><span>${G.relics[i] ? esc(RELICS[i].n) : '???'}</span></div>${(() => { const nw = chapterNews(i), bn = BANNERS.find(b => b.ch === i); return (nw.length ? `<div class="cc-new"><b>Neu</b><span>${nw.map(esc).join(', ')}</span></div>` : '') + (bn ? `<div class="cc-opt"><b>Banner</b><span>${esc(bn.n)}</span></div>` : ''); })()}<div><b>Stufe</b><span>${C.lvl + G.story.loop * LOOP_LVL}+</span></div></div>${btn}</div>`;
}
function sidePrice(sd) { return 1500 + sd.after * 220; }
function sideCard(sd) {
  const un = sideUnlocked(sd), done = G.side[sd.id], boss = sd.boss.find(k => ENEMIES[k].boss);
  const rew = [sd.heroes ? (done ? sd.heroes.map(k => esc(HEROES[k].n)).join(', ') : 'Neue Helden') : '', sd.hero ? (done ? esc(HEROES[sd.hero].n) : 'Neuer Held') : '', sd.comp ? (done ? esc(COMPANIONS.find(c => c.id === sd.comp).n) : 'Begleiter') : '', sd.legend ? (done ? esc(sd.legend) : 'Legendäre Waffe') : ''].filter(Boolean).join(', ');
  return `<div class="m-ch side ${un ? (done ? 'done' : 'cur') : 'locked'}"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1" class="${un ? '' : 'sil'}"></canvas><span class="cc-st">${!un ? 'Gesperrt' : done ? `✓ ${done}×` : 'Neu!'}</span></div>
    <small>Nebenquest</small><h3>${esc(sd.n)}</h3>
    <div class="cc-rows"><div><b>Boss</b><span>${un ? esc(ENEMIES[boss].n) : '???'}</span></div><div><b>Beute</b><span>${rew}</span></div><div><b>Stufe</b><span>${sideLvl(sd)}+ · ${dangerHtml(sideLvl(sd), 1)}</span></div></div>
    ${un ? `<button class="btn gold big m-play" data-side="${sd.id}">▶ ${done ? 'Erneut spielen' : 'Starten'}</button>` : `<button class="btn big m-play" data-unlside="${sd.id}">🔓 Früher freischalten ◆${fmt(sidePrice(sd))}</button>`}</div>`;
}
function openStory(tab = openStory.tab || 'ziele', part, sel) {
  openStory.tab = tab;
  if (tab === 'ziele') return openGoals();
  if (tab === 'modi') return openModes();
  if (tab === 'jagd') return openHunts();
  if (tab === 'chronik') return openChronik();
  if (tab === 'best') return openBestiary();
  if (part === undefined) part = Math.max(0, PARTS.indexOf(STORY[G.story.ch].part));
  if (typeof sel === 'string') { } else if (sel === undefined || STORY[sel]?.part !== PARTS[part]) sel = STORY[G.story.ch].part === PARTS[part] ? G.story.ch : STORY.findIndex(c => c.part === PARTS[part]);
  const mods = activeMods();
  openSheet('Reise', `<div class="m-story"><div class="m-mapcol"><div class="m-parts">${PARTS.map((p, i) => `<button class="ptab ${i === part ? 'on' : ''}" data-part="${i}" style="--c:${PART_COL[i]}">${PART_SHORT[i]}</button>`).join('')}</div><div class="mapwrap"><canvas id="map" class="map"></canvas>${mods.length ? `<div class="m-loop">Heldenreise ${G.story.loop + 1} · ☠ ${mods.length} Erschwernisse · +${G.story.loop * 25} % Beute</div>` : ''}</div></div><div id="chDetail">${typeof sel === 'string' ? sideCard(SIDE.find(x => 'side:' + x.id === sel)) : chapterCard(sel)}</div></div>`, s => {
    const cv = s.querySelector('#map');
    requestAnimationFrame(() => drawMap(cv, part, sel));
    const wire = root => {
      const go = root.querySelector('#goOn'); if (go) go.onclick = () => { closeSheet(); sfx('click'); };
      root.querySelectorAll('[data-rematch]').forEach(b => b.onclick = () => playNow({ type: 'boss', ch: +b.dataset.rematch }, 'Bosskampf: ' + STORY[+b.dataset.rematch].n));
      root.querySelectorAll('[data-lock]').forEach(b => b.onclick = () => lockHint(b.dataset.lock));
      root.querySelectorAll('[data-trial]').forEach(b => b.onclick = () => { const [c2, t] = b.dataset.trial.split(':'); playNow({ type: 'trial', ch: +c2, t }, `${TRIAL[t].n}: ${STORY[+c2].n}`); });
      root.querySelectorAll('[data-side]').forEach(b => b.onclick = () => playNow({ type: 'side', id: b.dataset.side }, SIDE.find(x => x.id === b.dataset.side).n));
      root.querySelectorAll('[data-unlside]').forEach(b => b.onclick = () => { const sd = SIDE.find(x => x.id === b.dataset.unlside); buyEarly('side:' + sd.id, sidePrice(sd), sd.n, () => openStory('story', part, 'side:' + sd.id)); });
    };
    wire(s);
    cv.onclick = e => { const x = e.offsetX, y = e.offsetY; const h = (cv._hits || []).map(h => ({ ...h, d: Math.hypot(h.x - x, h.y - y) })).filter(h => h.d < h.r).sort((a, b) => a.d - b.d)[0]; if (h) { sfx('click'); sel = h.i; drawMap(cv, part, sel); const d = s.querySelector('#chDetail'); d.innerHTML = typeof sel === 'string' ? sideCard(SIDE.find(x => 'side:' + x.id === sel)) : chapterCard(sel); paintCards(d); wire(d); } };
    s.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { sfx('click'); openStory('story', +b.dataset.part); });
  }, { tabs: STORY_TABS, tab, onTab: t => openStory(t) });
}
const STORY_TABS = [['ziele', 'Ziele'], ['story', 'Geschichte'], ['modi', 'Modi'], ['jagd', 'Jagd'], ['chronik', 'Chronik'], ['best', 'Rotes Buch']];
const ACH_TABS = [['ach', 'Erfolge'], ['feat', 'Heldentaten'], ['rel', 'Relikte']];
const achTab = t => t === 'rel' ? openRelics() : t === 'feat' ? openFeats() : openAch();
function speaker(id) { if (id === 'narr') return ''; if (id.startsWith('e:')) return ENEMIES[id.slice(2)]?.n || ''; return HEROES[id]?.n || id; }
function openChronik(page = openChronik.page) {
  if (!gate('chronik')) return;
  const max = G.story.loop ? STORY.length - 1 : G.story.ch, np = max + 1; page = openChronik.page = clampPg(page ?? max, np);
  const C = STORY[page], done = chapterStatus(page) === 'done', boss = C.boss.find(k => ENEMIES[k].boss) || C.boss[0];
  const lines = [...(C.intro || []), ...(done ? (C.outro || []) : [])].filter(l => l && l[1]).slice(0, 9);
  openSheet('Reise', `<div class="m-chron"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1"></canvas></div><div class="m-rbook"><small>${esc(C.part)} · Kapitel ${page + 1}</small><h3>${esc(C.n)}</h3><div class="m-lines">${lines.map(([who, t]) => `<p>${speaker(who) ? `<b>${esc(speaker(who))}:</b> ` : ''}${esc(t)}</p>`).join('')}</div>${done ? '<span class="m-seal">✓ Kapitel abgeschlossen</span>' : '<span class="m-seal cur">▶ Die Geschichte geht weiter …</span>'}</div></div>`, null,
    { tabs: STORY_TABS, tab: 'chronik', onTab: t => openStory(t), pages: np, page, onPage: p => openChronik(p) });
}
function openBook(cat = openBook.cat || 'heroes', page = 0) {
  if (!gate('best')) return; openBook.cat = cat;
  const L = bookCards(cat), per = innerHeight > innerWidth ? 9 : 12, np = pages(L.length, per); page = clampPg(page, np); const B = BOOK.find(b => b.id === cat), got = L.filter(c => c.seen).length;
  const card = c => { const art = cat === 'heroes' ? `<canvas data-card="${c.k}" data-bust="1" class="${c.seen ? '' : 'sil'}"></canvas>` : cat === 'foes' ? `<canvas data-card="${c.k}" data-enemy="1" data-bust="1" class="${c.seen ? '' : 'sil'}"></canvas>` : cat === 'places' ? `<canvas class="bk-pl ${c.seen ? '' : 'sil'}" data-place="${c.k}"></canvas>` : cat === 'rings' ? `<canvas data-ring="${c.k}" class="${c.seen ? '' : 'sil'}"></canvas>` : cat === 'banners' ? `<canvas data-flag="${c.k}" class="${c.seen ? '' : 'sil'}"></canvas>` : `<div class="bk-ic ${c.seen ? '' : 'sil'}">${icHtml({ r: c.r, icon: c.icon })}</div>`;
    return `<div class="bk-c ${c.seen ? '' : 'lk'} ${c.gold ? 'gold' : ''}">${art}<b>${c.seen ? esc(c.n) : '???'}</b>${cat === 'foes' && c.seen ? `<small>${fmt(c.cnt)}× besiegt${(G.shinies || {})[c.k] ? ' · <em class="bk-sh">✦ schimmernd</em>' : ''}</small>` : ''}</div>`; };
  openSheet('Reise', `<div class="m-rbook"><div class="bk-cats">${BOOK.map(b => { const l2 = bookCards(b.id), g2 = l2.filter(c => c.seen).length; return `<button class="bk-cat ${b.id === cat ? 'on' : ''} ${g2 === l2.length ? 'done' : ''}" data-cat="${b.id}"><span>${b.ic}</span>${b.n}<i>${g2}/${l2.length}</i></button>`; }).join('')}</div>
    <div class="bk-info">${got === L.length ? '✓ ' : ''}${B.n} vollständig: <b>${B.d}</b> für alle Helden · ${got}/${L.length}</div><div class="bk-grid ${per === 9 ? 'p' : ''}">${L.slice(page * per, page * per + per).map(card).join('')}</div></div>`, s => {
    s.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { sfx('click'); openBook(b.dataset.cat, 0); });
    paintFlags(s); if (typeof paintRings === 'function') paintRings(s);
    requestAnimationFrame(() => s.querySelectorAll('canvas[data-place]').forEach(cv => paintPano(cv, cv.dataset.place)));
  }, { tabs: STORY_TABS, tab: 'best', onTab: t => openStory(t), pages: np, page, onPage: p => openBook(cat, p) });
}
function openBestiary(page = openBestiary.page) {
  if (!gate('best')) return; return openBook();
  const keys = Object.keys(ENEMIES), seen = keys.filter(k => (G.bestiary || {})[k]).length, per = 16, np = pages(keys.length, per); page = openBestiary.page = clampPg(page, np);
  openSheet('Reise', `<div class="m-best">${keys.slice(page * per, page * per + per).map(k => { const n = (G.bestiary || {})[k] || 0, E = ENEMIES[k]; return `<div class="m-be ${n ? '' : 'lk'} ${E.boss ? 'boss' : ''}"><canvas data-card="${k}" data-enemy="1" data-bust="1" class="${n ? '' : 'sil'}"></canvas><b>${n ? esc(E.n) : '???'}</b><small>${n ? `${E.boss ? 'Boss · ' : ''}${fmt(n)}× besiegt` : 'Noch nicht begegnet'}</small></div>`; }).join('')}</div>`, null,
    { tabs: STORY_TABS, tab: 'best', onTab: t => openStory(t), pages: np, page, onPage: p => openBestiary(p), extra: `<span class="muted small">${seen}/${keys.length}</span>` });
}
function openModes(page = openModes.page || 0) {
  if (!isUnl('horde') && !isUnl('tower')) return lockHint('horde');
  const f = towerFloor(), tr = towerReward(f); page = openModes.page = clampPg(page, 3);
  const lockTile = (cls, art, n, id) => `<div class="m-tile ${cls} lk">${art}<b>${esc(n)}</b><small>🔒 Ab ${unlWhen(id)}<br><em>${esc(UNLOCKS.find(u => u.id === id).d.split('.')[0])}.</em></small>${UNLOCKS.find(u => u.id === id).price ? `<button class="btn small" data-unl="${id}">🔓 Früher ◆${fmt(UNLOCKS.find(u => u.id === id).price)}</button>` : ''}</div>`;
  const tile = (cls, art, n, sub, data, label, dis) => `<div class="m-tile ${cls}">${art}<b>${n}</b><small>${sub}</small><button class="btn small gold" ${data} ${dis ? 'disabled' : ''}>${label}</button></div>`;
  const tiles = page === 0 ? [
    ...MODES.map(M => isUnl(M.id) ? tile('mode ' + M.id, `<span class="m-ic">${M.ic}</span>`, esc(M.n), `${esc(M.d.split('.')[0])}.<br><em>Rekord: ${(G.modes || {})[M.id] || 0}</em>`, `data-mode="${M.id}"`, '▶ Spielen', false) : lockTile('mode ' + M.id, `<span class="m-ic">${M.ic}</span>`, M.n, M.id)),
    isUnl('tower') ? tile('tower', '<span class="m-ic">♜</span>', 'Orthanc-Turm', `Etage ${f} · Stufe ${towerLvl(f)} · <em>◆${fmt(tr.gold)}${tr.frags ? ' · ◈ ' + tr.frags : ''}</em>`, 'id="tw"', '▶ Etage ' + f, false) : lockTile('tower', '<span class="m-ic">♜</span>', 'Orthanc-Turm', 'tower')
  ] : page === 2 ? [...SAGAS.map(S => { if (!isUnl('saga')) return lockTile('raid saga', `<canvas data-card="${S.foe}" data-enemy="1" data-bust="1" class="sil"></canvas>`, S.sn, 'saga'); const rk = (G.sagas || {})[S.id] || 0; return tile('raid saga', `<canvas data-card="${S.foe}" data-enemy="1" data-bust="1"></canvas>`, esc(S.sn), `Sagenstufe ${rk + 1} · ${dangerHtml(sagaLvl(S), 1)}<br><em>${rk ? '✓ besiegt' : 'Mythischer Schatz beim ersten Sieg'}</em>`, `data-saga="${S.id}"`, '▶ Herausfordern', false); }), isUnl('mirror') ? tile('raid mirror', `<canvas data-card="${G.party[0]}" data-mirror="1" data-bust="1"></canvas>`, 'Spiegel der Galadriel', `Spiegelstufe ${(G.mirror || 0) + 1} · ${dangerHtml(mirrorLvl(), 1)}<br><em>Kämpft gegen eure dunklen Abbilder</em>`, 'id="mir"', '▶ In den Spiegel', false) : lockTile('raid mirror', `<canvas data-card="${G.party[0]}" data-mirror="1" data-bust="1" class="sil"></canvas>`, 'Spiegel der Galadriel', 'mirror')] : RAIDS.map(R => { if (!isUnl('raids')) return lockTile('raid', `<canvas data-card="${R.key}" data-enemy="1" data-bust="1" class="sil"></canvas>`, R.n, 'raids'); const st = G.raid[R.key] || { best: 0, tiers: 0 }; return tile('raid', `<canvas data-card="${R.key}" data-enemy="1" data-bust="1"></canvas>`, esc(R.n), `45 Sek. · Bestwert ${Math.round(st.best * 100)} %<br><em>Stufe ${st.tiers}/${RAID_TIERS.length}</em>`, `data-raid="${R.key}"`, '▶ Spielen', false); });
  openSheet('Reise', `<div class="m-tiles ${page === 0 ? 'six' : 'four'}">${tiles.join('')}</div>`, s => {
    s.querySelectorAll('[data-unl]').forEach(b => b.onclick = () => { const U = UNLOCKS.find(u => u.id === b.dataset.unl); buyEarly('u:' + U.id, U.price, U.n, () => { G.unlSeen = G.unlSeen || {}; G.unlSeen[U.id] = 1; save(); openModes(openModes.page); }); });
    s.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => playNow({ type: 'mode', id: b.dataset.mode }, MODES.find(m => m.id === b.dataset.mode).n));
    s.querySelectorAll('[data-raid]').forEach(b => b.onclick = () => playNow({ type: 'raid', key: b.dataset.raid }, 'Prüfung: ' + RAIDS.find(r => r.key === b.dataset.raid).n));
    const tw = s.querySelector('#tw'); if (tw) tw.onclick = () => playNow({ type: 'tower' }, 'Orthanc-Turm Etage ' + f);
    s.querySelectorAll('[data-saga]').forEach(b => b.onclick = () => playNow({ type: 'saga', id: b.dataset.saga }, 'Sage: ' + SAGAS.find(x => x.id === b.dataset.saga).sn));
    const mi = s.querySelector('#mir'); if (mi) mi.onclick = () => playNow({ type: 'mirror' }, 'Spiegel der Galadriel');
  }, { tabs: STORY_TABS, tab: 'modi', onTab: t => openStory(t), pages: 3, page, onPage: p => openModes(p) });
}
/* ---------- Heldenhalle: ein begehbarer Raum voller Erinnerungen ---------- */
function openHall() {
  if (!gate('halle')) return;
  closeSheet(); sfx('join');
  let el = $('#hall');
  if (!el) { el = document.createElement('div'); el.id = 'hall'; el.innerHTML = '<canvas></canvas><div class="hall-cap"></div><button class="hall-x" aria-label="Schließen">✕</button><div class="hall-hint">‹ Wischen zum Durchstöbern ›</div>'; $('#app').appendChild(el); }
  el.hidden = false; document.body.classList.add('sheet-open');
  const cv = el.querySelector('canvas'), cap = el.querySelector('.hall-cap'), ctx = cv.getContext('2d');
  const heroes = owned().sort((a, b) => (G.party.includes(b) - G.party.includes(a)) || (G.heroes[b].fame || 0) - (G.heroes[a].fame || 0) || heroStats(b).power - heroStats(a).power);
  const rings = RINGS.filter(R => (G.rings?.[R.id]?.stars || 0) > 0);
  const trophies = [...new Set([...STORY.map((C, i) => chapterStatus(i) === 'done' ? (C.boss.find(k => ENEMIES[k].boss) || C.boss[0]) : null), ...HUNTS.filter(H => G.trophies?.[H.id]).map(H => H.foe), ...SAGAS.filter(S2 => (G.sagas || {})[S2.id]).map(S2 => S2.foe)].filter(Boolean))];
  cap.innerHTML = `<b>Heldenhalle</b><small>${heroes.length} Helden · ${Object.keys(G.banners || {}).length}/${BANNERS.length} Banner · ${rings.length} Ringe · ${trophies.length} Trophäen</small>`;
  const HS = 30, X0 = 46, heroEnd = X0 + heroes.length * HS, ringX = heroEnd + 34, LEN = Math.max(ringX + Math.max(1, rings.length) * 34 + 50, 22 + Math.ceil(trophies.length / 3) * 70 + 40, 22 + BANNERS.length * 70 + 40);
  const trophyX = i => 22 + Math.floor(i / 3) * 70 + 17 + (i % 3) * 18, bannerX = i => 22 + i * 70 + 27, TY = 32;
  const looks = Object.fromEntries(heroes.map(k => [k, heroLook(k)])), busts = {};
  const bust = k => { if (busts[k]) return busts[k]; const c2 = document.createElement('canvas'); c2.width = c2.height = 48; const E = ENEMIES[k]; RIG.card(c2, E.type, Object.assign({ wpn: E.wpn }, E.look), { col: '#ff5a3a', flip: 1, seed: k, bust: E.type === 'hum', zoom: E.type === 'hum' && !RIG.dims('hum', E.look).big ? 1.1 : .85 }); return (busts[k] = c2); };
  let scroll = 0, vel = 0, drag = null, raf = 0, lastF = 0, S = 1, VW = 200, oy = 0;
  const size = () => { const r = el.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); S = Math.min(cv.height / 144, cv.width / 150); VW = cv.width / S; oy = (cv.height - 144 * S) / 2; };
  size();
  const FY = 118, WALL = 96;
  function draw(t) {
    const gt = t;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0907'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(S, 0, 0, S, -scroll * S, oy);
    const x0 = scroll - 20, x1 = scroll + VW + 20, TOP = -oy / S - 2, BOT = (cv.height - oy) / S + 2;
    // Rückwand aus Stein mit Fugen
    let g = ctx.createLinearGradient(0, TOP, 0, WALL); g.addColorStop(0, '#120e0b'); g.addColorStop(.55, '#33281f'); g.addColorStop(1, '#4a3a2c'); ctx.fillStyle = g; ctx.fillRect(x0, TOP, x1 - x0, WALL - TOP);
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = .4; for (let y = 4 - Math.ceil((4 - TOP) / 18) * 18, r = 0; y < WALL; y += 9, r++) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); for (let x = Math.floor(x0 / 18) * 18 + (r % 2) * 9; x < x1; x += 18) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke(); } }
    // Lichtfahnen aus hohen Fenstern
    for (let x = 120; x < LEN; x += 210) { if (x < x0 - 90 || x > x1 + 30) continue;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; const lg = ctx.createLinearGradient(x, TOP, x + 60, 140); lg.addColorStop(0, 'rgba(255,230,170,.2)'); lg.addColorStop(1, 'rgba(255,230,170,0)'); ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(x - 10, TOP); ctx.lineTo(x + 8, TOP); ctx.lineTo(x + 76, 140); ctx.lineTo(x + 38, 140); ctx.fill();
      for (let i = 0; i < 8; i++) { const k = ((gt / 9000 + i / 8) % 1), px = x + 6 + k * 50 + Math.sin(gt / 1300 + i) * 4, py = 10 + k * 110; ctx.fillStyle = `rgba(255,240,200,${.5 * Math.sin(k * Math.PI)})`; ctx.fillRect(px, py, .7, .7); } ctx.restore(); }
    // Trophäen: Schilde mit den besiegten Bossen (drei je Säulenfeld)
    trophies.forEach((k, i) => { const x = trophyX(i), y = TY; if (x < x0 - 20 || x > x1 + 20) return; ctx.fillStyle = '#5a3c22'; ctx.beginPath(); ctx.arc(x, y, 8.2, 0, 6.29); ctx.fill(); ctx.strokeStyle = '#c8a050'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.save(); ctx.beginPath(); ctx.arc(x, y, 6.4, 0, 6.29); ctx.clip(); ctx.drawImage(bust(k), x - 6.4, y - 6.4, 12.8, 12.8); ctx.restore(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.arc(x, y, 6.4, 0, 6.29); ctx.stroke(); ctx.fillStyle = '#c8a050'; for (let a = 0; a < 6; a++) { ctx.beginPath(); ctx.arc(x + Math.cos(a * 1.047) * 7.4, y + Math.sin(a * 1.047) * 7.4, .55, 0, 6.29); ctx.fill(); } });
    // Säulen mit Fackeln
    for (let x = 22; x < LEN; x += 70) { if (x < x0 - 20 || x > x1 + 20) continue; g = ctx.createLinearGradient(x - 5, 0, x + 5, 0); g.addColorStop(0, '#2a2018'); g.addColorStop(.5, '#6a5440'); g.addColorStop(1, '#241a12'); ctx.fillStyle = g; ctx.fillRect(x - 4.5, TOP, 9, WALL - TOP + 2); ctx.fillStyle = '#7a6248'; ctx.fillRect(x - 6.5, 2, 13, 3); ctx.fillRect(x - 6.5, WALL - 2, 13, 3);
      const fl = 1 + Math.sin(gt / 90 + x) * .12 + Math.sin(gt / 37 + x * 2) * .06; ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - .7, 38, 1.4, 6); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const tg = ctx.createRadialGradient(x, 35, 0, x, 35, 34 * fl); tg.addColorStop(0, 'rgba(255,190,90,.35)'); tg.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = tg; ctx.fillRect(x - 36, 0, 72, 80); const fg = ctx.createRadialGradient(x, 35, 0, x, 35, 3.4 * fl); fg.addColorStop(0, '#fff4c0'); fg.addColorStop(.5, '#ffa030'); fg.addColorStop(1, 'rgba(255,80,10,0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x, 34.5, 2.2 * fl, 3.6 * fl, 0, 0, 6.29); ctx.fill(); ctx.restore(); }
    // Banner zwischen den Säulen
    BANNERS.forEach((B, i) => { const x = bannerX(i), own = G.banners?.[B.id]; if (x < x0 - 20 || x > x1 + 30) return; ctx.save(); ctx.translate(x, WALL + 1); ctx.scale(1.25, 1.25); if (own) RIG.flag(ctx, { em: B.em, cloth: B.cloth, emCol: B.emCol, t: gt * .5 + i * 400, pole: 40 }); else { ctx.globalAlpha = .35; RIG.flag(ctx, { em: B.em, cloth: '#2a2622', emCol: '#4a443c', t: 0, pole: 40 }); } ctx.restore(); });
    // Boden mit Teppich
    g = ctx.createLinearGradient(0, WALL, 0, Math.max(144, BOT)); g.addColorStop(0, '#2e241c'); g.addColorStop(1, '#0e0b08'); ctx.fillStyle = g; ctx.fillRect(x0, WALL, x1 - x0, Math.max(144, BOT) - WALL);
    ctx.fillStyle = '#5a1a16'; ctx.fillRect(x0, 112, x1 - x0, 14); ctx.fillStyle = '#c8a050'; ctx.fillRect(x0, 112, x1 - x0, .8); ctx.fillRect(x0, 125.2, x1 - x0, .8);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = .3; for (let x = Math.floor(x0 / 24) * 24; x < x1; x += 24) { ctx.beginPath(); ctx.moveTo(x, WALL); ctx.lineTo(x - 14, 144); ctx.stroke(); }
    // Ringe auf Sockeln
    rings.forEach((R, i) => { const x = ringX + i * 34, st = G.rings[R.id].stars; if (x < x0 - 20 || x > x1 + 20) return; g = ctx.createLinearGradient(x - 7, 0, x + 7, 0); g.addColorStop(0, '#3a3430'); g.addColorStop(.5, '#8a8078'); g.addColorStop(1, '#2e2a26'); ctx.fillStyle = g; ctx.fillRect(x - 5, 96, 10, FY - 96); ctx.fillRect(x - 7, 94, 14, 3); ctx.fillRect(x - 7, FY - 2, 14, 3);
      const fy = 86 + Math.sin(gt / 800 + i) * 1.5; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const rg = ctx.createRadialGradient(x, fy, 0, x, fy, 16); rg.addColorStop(0, RIG.rgba(R.c, .55)); rg.addColorStop(1, RIG.rgba(R.c, 0)); ctx.fillStyle = rg; ctx.fillRect(x - 16, fy - 16, 32, 32); ctx.restore();
      ctx.strokeStyle = '#e8c060'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(x, fy, 4.6, 2, Math.sin(gt / 1200 + i) * .3, 0, 6.29); ctx.stroke(); ctx.fillStyle = R.c; ctx.beginPath(); ctx.arc(x, fy - 2, 1.3, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ffd770'; ctx.font = '700 3.2px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★'.repeat(st), x, 101.5); });
    // Helden
    ctx.textAlign = 'center';
    heroes.forEach((k, i) => { const x = X0 + i * HS; if (x < x0 - 20 || x > x1 + 20) return; const inP = G.party.includes(k);
      ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.ellipse(x, FY + .5, 7, 1.8, 0, 0, 6.29); ctx.fill(); ctx.restore();
      if (inP) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const pg = ctx.createRadialGradient(x, FY, 0, x, FY, 11); pg.addColorStop(0, 'rgba(255,214,120,.45)'); pg.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(x, FY, 11, 3.2, 0, 0, 6.29); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.translate(x, FY); RIG.draw(ctx, 'hum', looks[k], 'idle', (gt + i * 377) % 1700, gt + i * 911); ctx.restore();
      ctx.font = '700 3.6px Cinzel, Georgia, serif'; ctx.fillStyle = inP ? '#ffd770' : '#e8dcc0'; ctx.fillText(HEROES[k].n, x, FY + 6.5); ctx.font = '600 2.6px sans-serif'; ctx.fillStyle = 'rgba(232,220,192,.7)'; const fr = fameRank(k); ctx.fillText(fr ? FAME[fr][1] : 'Stufe ' + G.heroes[k].lvl, x, FY + 10); });
    // Vignette
    ctx.setTransform(1, 0, 0, 1, 0, 0); const vg = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * .3, cv.width / 2, cv.height / 2, cv.width * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, cv.width, cv.height);
  }
  function loop(t) { raf = requestAnimationFrame(loop); if (t - lastF < 30) return; lastF = t; if (!drag) { scroll += vel; vel *= .92; if (Math.abs(vel) < .02) vel = 0; } scroll = Math.max(0, Math.min(Math.max(0, LEN - VW), scroll)); draw(t); }
  raf = requestAnimationFrame(loop);
  const close = () => { cancelAnimationFrame(raf); el.hidden = true; document.body.classList.remove('sheet-open'); window.removeEventListener('resize', size); };
  window.addEventListener('resize', size);
  el.querySelector('.hall-x').onclick = () => { sfx('click'); close(); };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, s: scroll, moved: 0, t: performance.now() }; vel = 0; };
  cv.onpointermove = e => { if (!drag) return; const [dx] = appDelta(e.clientX - drag.x, 0), dpr = cv.width / cv.getBoundingClientRect().width; const ns = drag.s - dx * dpr / S; vel = (scroll - ns) * -.5; scroll = ns; drag.moved = Math.max(drag.moved, Math.abs(dx)); };
  cv.onpointerup = e => { const d = drag; drag = null; if (!d || d.moved > 6) return; const r = cv.getBoundingClientRect(), dpr = cv.width / r.width, wx = (e.clientX - r.left) * dpr / S + scroll, wy = ((e.clientY - r.top) * dpr - oy) / S;
    const hi = heroes.findIndex((k, i) => Math.abs(X0 + i * HS - wx) < 11 && wy > FY - 40 && wy < FY + 11); if (hi >= 0) { close(); openHero(heroes[hi]); return; }
    const ri = rings.findIndex((R, i) => Math.abs(ringX + i * 34 - wx) < 9 && wy > 76 && wy < FY + 2); if (ri >= 0) { sfx('buff'); toast(`◍ <b>${esc(rings[ri].n)}</b> · ${'★'.repeat(G.rings[rings[ri].id].stars)}`, 'mini'); return; }
    const ti = trophies.findIndex((k, i) => Math.hypot(trophyX(i) - wx, TY - wy) < 10); if (ti >= 0) { sfx('click'); toast(`⚔ <b>${esc(ENEMIES[trophies[ti]].n)}</b> besiegt`, 'mini'); return; }
    const bi = BANNERS.findIndex((B, i) => Math.abs(bannerX(i) + 8 - wx) < 12 && wy > 44 && wy < WALL + 2); if (bi >= 0) { const B = BANNERS[bi]; toast(G.banners?.[B.id] ? `⚐ <b>${esc(B.n)}</b> · ${esc(B.d)}` : `⚐ Noch nicht errungen · Kapitel ${B.ch + 1}`, 'mini'); } };
  cv.onpointercancel = () => { drag = null; };
}
/* ---------- Kopfgeldjagd ---------- */
function openHunts(page = openHunts.page || 0) {
  if (!gate('hunt')) return;
  const per = innerHeight > innerWidth && innerHeight < 761 ? 4 : 8, np = pages(HUNTS.length, per); page = openHunts.page = clampPg(page, np);
  const tiles = HUNTS.slice(page * per, page * per + per).map(H => { const op = huntOpen(H), rk = huntRank(H.id), E = ENEMIES[H.foe], aff = huntAff(H)[0];
    return `<div class="m-tile raid hunt ${G.trophies?.[H.id] ? 'got' : ''}"><canvas data-card="${H.foe}" data-enemy="1" data-bust="1" class="${op ? '' : 'sil'}"></canvas><b>${esc(H.sn)}</b><small>${op ? `Stufe ${rk + 1} · ${dangerHtml(huntLvl(H), 1)}` : `Ab Kapitel ${H.after + 2}`}<br>${aff.map(a => `<span style="color:${ELITE_AFX[a].c}">${ELITE_AFX[a].n}</span>`).join(' · ')}<br><em class="${G.trophies?.[H.id] ? 'ok' : ''}">${G.trophies?.[H.id] ? '✓ ' : '✦ '}${esc(H.tr.n)} · ${esc(H.tr.d)}</em></small>${op ? `<button class="btn small gold" data-hunt="${H.id}">▶ Jagen</button>` : `<button class="btn small" data-unlhunt="${H.id}">🔓 ◆${fmt(huntPrice(H))}</button>`}</div>`; });
  openSheet('Reise', `<div class="m-tiles hunts ${per === 4 ? 'four' : ''}">${tiles.join('')}</div>`, s => {
    s.querySelectorAll('[data-hunt]').forEach(b => b.onclick = () => { const H = HUNTS.find(h => h.id === b.dataset.hunt); playNow({ type: 'hunt', id: H.id }, 'Kopfgeld: ' + H.sn); });
    s.querySelectorAll('[data-unlhunt]').forEach(b => b.onclick = () => { const H = HUNTS.find(h => h.id === b.dataset.unlhunt); buyEarly('hunt:' + H.id, huntPrice(H), 'Kopfgeld: ' + H.sn, () => openHunts()); });
  }, { tabs: STORY_TABS, tab: 'jagd', onTab: t => openStory(t), pages: np, page, onPage: p => openHunts(p) });
}
function sagaLvl(S) { return Math.max(STORY[S.after].lvl + 6 + G.story.loop * LOOP_LVL, (G.team?.lvl || 1) - 5) + ((G.sagas || {})[S.id] || 0) * 3; }
async function sagaRun(id) {
  const S = SAGAS.find(x => x.id === id), prevBg = W.bgKey, rk = (G.sagas || {})[id] || 0, lvl = sagaLvl(S), first = !rk; G.queue = null; G.sagas = G.sagas || {}; save();
  W.setBg(S.bg); await panoSplash(`Sagen-Boss · Stufe ${rk + 1}`, esc(S.sn), esc(S.lore), S.bg, 2600);
  applyParty(); W.restoreHeroes(); await W.walk(900); await bossSplash(S.foe);
  const r = await W.fight([S.foe], lvl, 'boss', { saga: S, aff: [rk >= 2 ? rollAfx(Math.min(2, Math.floor(rk / 2)), [S.foe, 'x']) : null] });
  if (r.aborted) { W.setBg(prevBg); return; }
  onResult(r, 'boss');
  if (r.win) { G.sagas[id] = rk + 1; G.stats.bosses++; track('bosses', 1);
    const items = [genItem(lvl + 2, first ? 5 : topRarity(.2, .8))], gold = Math.round((600 + lvl * 30) * (1 + G.story.loop * .25)), frags = first ? 6 : 3;
    G.gold += gold; grantFragments(frags); items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save(); applyParty(); updateHud(); trackFeats();
    await splash(`<div class="cdone"><div class="kicker">Sage bezwungen · Stufe ${rk + 1}</div><canvas class="mcv" data-card="${S.foe}" data-enemy="1" data-bust="1"></canvas><h1>${esc(S.sn)} ist gefallen</h1><p>◆ ${fmt(gold)} · ◈ ${frags}</p><div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div><div class="dhint">${memBtn({ kicker: 'Sage bezwungen', title: S.sn, bg: S.bg, foe: S.foe })}<span>Tippen zum Fortfahren</span></div></div>`, 0, 'doneS');
  } else toast(`${esc(S.sn)} ist zu mächtig. Werdet stärker und fordert die Sage erneut heraus.`, 'unlock');
  W.setBg(prevBg); updateHud();
}
/* ---------- Spiegel der Galadriel ---------- */
function mirrorLvl() { return Math.max(chapterLvl() - 2, (G.team?.lvl || 1) - 6) + (G.mirror || 0) * 2; }
async function mirrorRun() {
  const prevBg = W.bgKey, rk = G.mirror || 0, lvl = mirrorLvl(); G.queue = null; save();
  W.setBg('lorien'); await panoSplash(`Spiegel der Galadriel · Stufe ${rk + 1}`, 'Der Spiegel', 'Das Wasser zeigt, was war, was ist und was sein mag. Heute zeigt es euch selbst.', 'lorien', 2500);
  applyParty(); W.restoreHeroes(); await W.walk(800);
  W.flash('#c8b0ff', 600); sfx('cast');
  const party = W.heroes.map(h => h.key), r = await W.fight(party, lvl, 'elite', { mirror: party });
  if (r.aborted) { W.setBg(prevBg); return; }
  onResult(r, 'elite');
  if (r.win) {
    G.mirror = rk + 1; track('bosses', 1);
    const big = (rk + 1) % 5 === 0, items = [genItem(lvl + 1, big ? topRarity(.25, .75) : rollRarity('boss'))], gold = Math.round((300 + lvl * 18) * (1 + G.story.loop * .25)), frags = 2 + (big ? 3 : 0);
    G.gold += gold; grantFragments(frags); items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save(); applyParty(); updateHud(); trackFeats();
    await splash(`<div class="cdone mirror"><div class="kicker">Spiegelstufe ${rk + 1} bezwungen</div><canvas class="mcv" data-card="${party[0]}" data-mirror="1" data-bust="1"></canvas><h1>Ihr habt euch selbst besiegt</h1><p>◆ ${fmt(gold)} · ◈ ${frags} · Nächste Stufe: ${rk + 2}</p><div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div><div class="dhint">${memBtn({ kicker: `Spiegelstufe ${rk + 1} bezwungen`, title: 'Der Spiegel der Galadriel', bg: 'lorien' })}<span>Tippen zum Fortfahren</span></div></div>`, 0, 'doneS');
  } else toast('Die Spiegelbilder waren stärker. Werdet stärker und blickt erneut hinein.', 'unlock');
  W.setBg(prevBg); updateHud();
}
async function huntRun(id) {
  const H = HUNTS.find(h => h.id === id), prevBg = W.bgKey, rk = huntRank(id), lvl = huntLvl(H), first = rk === 0; G.queue = null; G.hunts = G.hunts || {}; save();
  W.setBg(H.bg); await panoSplash(`Kopfgeldjagd · Jagdstufe ${rk + 1}`, esc(H.sn), esc(H.lore), H.bg, 2300);
  applyParty(); await W.walk(900); await bossSplash(H.foe);
  const grp = [H.foe, ...H.esc], r = await W.fight(grp, lvl, 'boss', { aff: huntAff(H) });
  if (r.aborted) { W.setBg(prevBg); return; }
  onResult(r, 'boss');
  if (r.win) {
    G.hunts[id] = rk + 1; G.stats.bosses++; track('bosses', 1);
    const items = [genItem(lvl, rollRarity('boss'))]; if ((rk + 1) % 5 === 0) items.push(genItem(lvl + 2, topRarity(.25, .75)));
    const gold = Math.round((250 + lvl * 15) * (1 + G.story.loop * .25)), frags = 1 + (rk % 3 === 2 ? 1 : 0);
    G.gold += gold; grantFragments(frags); items.forEach(addItem); if (G.settings.autoEquip) autoEquip();
    if (first) { G.trophies = G.trophies || {}; G.trophies[id] = 1; W.pendingParty = 1; }
    save(); applyParty(); updateHud(); trackFeats();
    await splash(`<div class="cdone hunt"><div class="kicker">Kopfgeld eingelöst · Jagdstufe ${rk + 1}</div><canvas class="mcv" data-card="${H.foe}" data-enemy="1" data-bust="1"></canvas><h1>${esc(H.sn)} besiegt</h1>${first ? `<p><b>Trophäe: ${esc(H.tr.n)}</b> · dauerhaft ${esc(H.tr.d)} für alle Helden</p>` : ''}<p>◆ ${fmt(gold)} · ◈ ${frags} · Nächste Jagdstufe: ${rk + 2}</p><div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  } else toast(`${esc(H.sn)} ist entkommen. Werdet stärker und jagt ihn erneut.`, 'unlock');
  W.setBg(prevBg); updateHud();
}
/* ---------- Helms Klamm: das Tor halten ---------- */
async function helmRun() {
  const prevBg = W.bgKey, base = Math.max(1, chapterLvl() - 2); G.modes = G.modes || {}; G.queue = null; save();
  W.setBg('helm'); await panoSplash('Spezialmodus', 'Helms Klamm', 'Haltet das Tor bis zum Morgengrauen!', 'helm', 2400);
  applyParty(); W.restoreHeroes();
  const pool = [['uruk', 'uruk', 'orc_archer'], ['uruk', 'berserker', 'orc_archer'], ['uruk', 'uruk', 'uruk', 'orc_archer'], ['berserker', 'berserker', 'uruk'], ['uruk', 'orc_archer', 'orc_archer', 'uruk']];
  let n = 0, fr = 0, lvl = base; const items = []; W.gate = { hp: 100, wave: 1 };
  try {
    for (;;) {
      const wave = n + 1, ram = wave % 4 === 0, lead = wave % 3 === 0; W.gate.wave = wave; lvl = base + Math.floor(n * .8);
      let grp = pool[n % pool.length].slice(); if (ram) grp = ['ram_troll', ...grp].slice(0, 5);
      const aff = afxPlan(grp, { one: wave >= 6 ? 1 : 0 }); if (lead) { const i2 = grp.findIndex(k => k !== 'ram_troll'); aff[i2] = ['anfuehrer']; }
      banner(`Welle ${wave}${ram ? ' · Rammbock!' : ''}`, ram ? 'foe' : 'ult'); await W.walk(600);
      const r = await W.fight(grp, lvl, ram || lead ? 'elite' : 'normal', { keepHp: 1, time: 30000, aff });
      if (r.aborted) break;
      onResult(r, 'normal');
      if (!r.win && !r.timeout) { W.gate.hp = 0; break; }
      if (r.timeout) { const dmg = Math.round(10 + 30 * r.left + r.rams * 14); W.gate.hp = Math.max(0, W.gate.hp - dmg); W.shake(6); W.flash('#ff3a1a', 450); sfx('crit'); banner(`Das Tor bebt! −${dmg} %`, 'foe'); await W.wait(700); }
      if (W.gate.hp <= 0) break;
      n++;
      if (n % 10 === 0) { for (const h of W.heroes) if (!alive(h)) W.revive(h, .5); healParty(.6); W.gate.hp = Math.min(100, W.gate.hp + 25); W.flash('#fff4d0', 700); banner(n === 10 ? 'Gandalf kommt im Morgengrauen!' : 'Erkenbrand bringt Verstärkung!', 'ult'); sfx('join'); await W.wait(900); }
      else healParty(.12);
      if (n % 5 === 0) { fr++; items.push(genItem(lvl + 1, n >= 15 ? topRarity(.15, .5) : rollRarity('elite'))); toast(`Welle ${n} gehalten! Bonus gesichert.`, 'lvl'); }
    }
  } finally { W.gate = null; }
  const gold = Math.round(n * (70 + base * 12) * (1 + G.story.loop * .25)), best = G.modes.helm || 0, rec = n > best; G.modes.helm = Math.max(best, n);
  G.gold += gold; if (fr) grantFragments(fr); items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save(); applyParty(); W.restoreHeroes(); trackFeats();
  await splash(`<div class="cdone"><div class="kicker">Helms Klamm</div><h1>${n} Wellen gehalten</h1><p>${rec ? '<b>Neuer Rekord!</b> ' : `Rekord: ${G.modes.helm} · `}◆ ${fmt(gold)}${fr ? ' · ◈ ' + fr : ''}</p>${items.length ? `<div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div>` : ''}<div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  W.setBg(prevBg); updateHud();
}
/* ---------- Pfad der Verzweiflung ---------- */
async function encounter(w) {
  const E = ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)]; let ch2 = E.a;
  const card = (o, i) => `<button class="bl-c" data-o="${i}"><span class="bl-ic">${o.ic}</span><b>${esc(o.n)}</b><small>${esc(o.d)}</small></button>`;
  const art = E.who ? `<canvas class="enc-art" data-card="${E.who}" data-bust="1"></canvas>` : `<div class="enc-art enc-ic">${E.ic}</div>`;
  sfx('join');
  const pr = splash(`<div class="pfad enc"><div class="kicker">Begegnung unterwegs</div>${art}<h1>${esc(E.n)}</h1><div class="bl-row two">${card(E.a, 0)}${card(E.b, 1)}</div></div>`, 0, 'pfadS');
  const s = $('#splash'), close = s.onclick; s.onclick = null; s.querySelectorAll('[data-o]').forEach(bt => bt.onclick = ev => { ev.stopPropagation(); ch2 = bt.dataset.o === '1' ? E.b : E.a; sfx('buff'); close && close(); });
  await pr; const o = ch2, lvl = waveLvl(w);
  if (o.buff) { G.tempBuff = { e: o.buff, fights: 3 }; W.pendingParty = 1; toast(`✧ ${esc(o.n)}: ${esc(o.d)}`, 'lvl'); }
  if (o.frags) grantFragments(o.frags);
  if (o.item) { const it = genItem(lvl + 1, o.item); addItem(it); lootPop([it], 0); if (G.settings.autoEquip) autoEquip(); }
  if (o.gold) { const gd = 150 + lvl * 20; G.gold += gd; lootPop([], gd); }
  let ambush = !!o.ambush; if (o.gamble) { if (Math.random() < .65) { const it = genItem(lvl + 2, topRarity(.03, .35)); addItem(it); lootPop([it], 0); if (G.settings.autoEquip) autoEquip(); } else { ambush = true; toast('Eine Falle! Orks greifen an!', 'unlock'); } }
  if (ambush) { applyParty(); await W.walk(700); const grp = chapterWaves()[3], r = await W.fight(grp, lvl + 2, 'elite', { aff: afxPlan(grp, { one: 1, elite: 1 }) }); if (!r.aborted) { onResult(r, 'elite'); if (r.win && o.ambush) { const it = genItem(lvl + 2, topRarity(.05, .5)); addItem(it); lootPop([it], 0); if (G.settings.autoEquip) autoEquip(); } } }
  save(); updateHud();
}
function pickBlessing(n, B) {
  const dead = W.heroes.some(h => !alive(h)), pool = BLESSINGS.filter(b => !(b.needDead && !dead) && !(b.once !== false && !b.now && B.taken.includes(b.id) && !b.e && !b.p)); const opts = [];
  while (opts.length < 3 && pool.length) opts.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  const alive2 = W.heroes.filter(alive).length;
  let chosen = opts[0];
  const pr = splash(`<div class="pfad"><div class="kicker">Pfad der Verzweiflung · Kampf ${n} von 15 bestanden</div><h1>Wähle einen Segen</h1><div class="bl-row">${opts.map((b, i) => `<button class="bl-c" data-b="${i}"><span class="bl-ic">${b.ic}</span><b>${esc(b.n)}</b><small>${esc(b.d)}</small></button>`).join('')}</div><div class="pf-st">Helden auf den Beinen: <b>${alive2}/${W.heroes.length}</b>${B.taken.length ? ' · Segen: ' + B.taken.map(id => esc(BLESSINGS.find(x => x.id === id).n)).join(', ') : ''}</div></div>`, 0, 'pfadS');
  const s = $('#splash'), close = s.onclick; s.onclick = null;
  s.querySelectorAll('[data-b]').forEach(bt => bt.onclick = e => { e.stopPropagation(); chosen = opts[+bt.dataset.b]; sfx('buff'); close && close(); });
  return pr.then(() => chosen);
}
async function pfadRun() {
  const prevBg = W.bgKey, pool = modePool(), base = Math.max(1, chapterLvl() - 1); G.modes = G.modes || {}; G.queue = null; save();
  W.setBg('dolguldur'); await panoSplash('Spezialmodus', 'Pfad der Verzweiflung', '15 Kämpfe · keine Heilung · gefallene Helden bleiben zurück', 'dolguldur', 2600);
  applyParty(); W.restoreHeroes();
  const B = { atk: 0, mag: 0, hp: 0, spd: 0, crit: 0, critDmg: 0, p: {}, gold: 0, taken: [] }; let n = 0, lvl = base; W.pfadB = B;
  const topBoss = pool.bosses[pool.bosses.length - 1];
  for (let i = 0; i < 15; i++) {
    lvl = base + Math.round(i * 1.2);
    let grp, kind = 'normal', aff = null, ci = pool.bosses[Math.floor(Math.random() * pool.bosses.length)];
    if (i === 14) { ci = topBoss; grp = STORY[ci].boss; kind = 'boss'; aff = afxPlan(grp, { boss: 2, all: 1 }); }
    else if (i === 4 || i === 9) { grp = STORY[ci].boss; kind = 'boss'; aff = afxPlan(grp, { boss: i === 9 ? 2 : 1 }); }
    else { grp = pool.waves[Math.floor(Math.random() * pool.waves.length)]; kind = i % 3 === 2 ? 'elite' : 'normal'; if (i >= 3) aff = afxPlan(grp, { one: i >= 7 ? 2 : 1, all: i >= 12 ? 1 : 0 }); }
    W.setBg(chBg(STORY[ci], Math.floor(Math.random() * 8)));
    banner(i === 14 ? 'Der letzte Kampf' : `Kampf ${i + 1} von 15`, i === 14 ? 'foe' : 'ult'); await W.walk(700);
    if (kind === 'boss') await bossSplash(grp.find(k => ENEMIES[k].boss) || grp[0]);
    const frac = Object.fromEntries(W.heroes.map(h => [h.key, alive(h) ? h.hp / h.maxHp : 0])); applyParty();
    const r = await W.fight(grp, lvl, kind, { keepHp: 1, aff, bless: w => { for (const h of w.heroes) { h.atk = Math.round(h.atk * (1 + B.atk)); h.mag = Math.round(h.mag * (1 + B.mag)); h.spd = Math.round(h.spd * (1 + B.spd)); h.crit += B.crit; h.critDmg += B.critDmg; h.maxHp = Math.round(h.maxHp * (1 + B.hp)); const f2 = frac[h.key] ?? 1; h.hp = f2 > 0 ? Math.max(1, Math.round(f2 * h.maxHp)) : 0; if (h.hp <= 0) w.setAnim(h, 'dead'); h.p = Object.assign({}, h.p); for (const [k, v] of Object.entries(B.p)) h.p[k] = (h.p[k] || 0) + v; } } });
    if (r.aborted) { W.pfadB = null; W.setBg(prevBg); applyParty(); W.restoreHeroes(); return; }
    onResult(r, kind);
    if (!r.win) break;
    n++;
    if (n < 15) { const b = await pickBlessing(n, B); B.taken.push(b.id);
      if (b.id === 'lembas') for (const h of W.heroes) if (alive(h)) h.hp = Math.min(h.maxHp, Math.round(h.hp + h.maxHp * .5));
      if (b.id === 'athelas') { const d = W.heroes.find(h => !alive(h)); if (d) W.revive(d, .6); }
      if (b.e) for (const [k, v] of Object.entries(b.e)) B[k] += v; if (b.p) for (const [k, v] of Object.entries(b.p)) B.p[k] = (B.p[k] || 0) + v; if (b.gold) B.gold += b.gold; }
  }
  W.pfadB = null; const items = []; if (n >= 5) items.push(genItem(lvl + 1, topRarity(.05, .4))); if (n >= 10) items.push(genItem(lvl + 2, topRarity(.2, .7))); if (n >= 15) items.push(genItem(lvl + 3, 5));
  const gold = Math.round(n * (110 + base * 18) * (1 + B.gold) * (1 + G.story.loop * .25)), fr = Math.floor(n / 2) + (n >= 15 ? 5 : 0), best = G.modes.pfad || 0, rec = n > best; G.modes.pfad = Math.max(best, n);
  G.gold += gold; if (fr) grantFragments(fr); items.forEach(addItem); if (G.settings.autoEquip) autoEquip(); save(); applyParty(); W.restoreHeroes(); trackFeats();
  await splash(`<div class="cdone"><div class="kicker">Pfad der Verzweiflung</div><h1>${n >= 15 ? 'Bezwungen!' : n + ' von 15 Kämpfen'}</h1><p>${rec ? '<b>Neuer Rekord!</b> ' : `Rekord: ${G.modes.pfad} · `}◆ ${fmt(gold)}${fr ? ' · ◈ ' + fr : ''}</p>${items.length ? `<div class="loot1">${items.map(it => `${icHtml(it)}<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`).join('')}</div>` : ''}<div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
  W.setBg(prevBg); updateHud();
}
/* ---------- Heldentaten ---------- */
function featDone(id) { return !!(G.feats || {})[id]; }
function grantFeat(id) {
  if (featDone(id)) return; const F = FEATS.find(f => f.id === id); if (!F) return;
  G.feats = G.feats || {}; G.feats[id] = 1; const rw = F.rw, items = [];
  if (rw.gold) G.gold += rw.gold; if (rw.frags) grantFragments(rw.frags, true); if (rw.r) { const it = genItem(chapterLvl() + 2, rw.r); addItem(it); items.push(it); if (G.settings.autoEquip) autoEquip(); W.pendingParty = 1; }
  save(); sfx('ult'); updateHud();
  toast(`✦ Heldentat: <b>${esc(F.n)}</b> · ${[rw.gold ? '◆ ' + fmt(rw.gold) : '', rw.frags ? '◈ ' + rw.frags : '', ...items.map(it => `<b style="color:${RARITY[it.r].c}">${esc(it.name)}</b>`)].filter(Boolean).join(' · ')}`, 'lvl');
}
const FEAT_PROG = { glanz: () => [Object.values(G.shinies || {}).reduce((a, b) => a + b, 0), 1], glanz5: () => [Object.keys(G.shinies || {}).length, 5], stern: () => [G.stats.stars || 0, 10], adler: () => [G.stats.eagles || 0, 1], serie25: () => [G.fstats?.best || 0, 25], serie100: () => [G.fstats?.best || 0, 100], affix25: () => [G.fstats?.afx || 0, 25], affix150: () => [G.fstats?.afx || 0, 150], jaeger: () => [Object.keys(G.hunts || {}).length, 4], meisterjaeger: () => [Object.keys(G.hunts || {}).length, HUNTS.length], sterne15: () => [starTotal(), 15], sterne60: () => [starTotal(), 60], horn10: () => [G.modes?.helm || 0, 10], horn25: () => [G.modes?.helm || 0, 25], pfad8: () => [G.modes?.pfad || 0, 8], pfad15: () => [G.modes?.pfad || 0, 15], ringe3: () => [RINGS.filter(R => (G.rings?.[R.id]?.stars || 0) >= 3).length, 3], quests12: () => [Object.keys(G.side || {}).filter(k => G.side[k]).length, 12] };
function trackFeats(c = {}) {
  if (!G) return; const fs = G.fstats = G.fstats || { streak: 0, best: 0, afx: 0 }, r = c.r;
  if (r && !r.aborted) {
    if (r.win) fs.streak++; else if (!r.timeout) fs.streak = 0; fs.best = Math.max(fs.best || 0, fs.streak); fs.afx += r.afxKills || 0;
    if (r.win) { const keys = (r.enemies || []).map(e => e.key);
      if (c.kind === 'boss' && !r.fallen) grantFeat('makellos');
      if (!r.fallen && keys.some(k => k === 'smaug' || k === 'glaurung')) grantFeat('drache');
      if (keys.length >= 3 && r.dur < 8000) grantFeat('blitz');
      if (r.aliveEnd === 1 && W.heroes.length >= 3) grantFeat('letzter');
      if (c.kind === 'boss' && r.minTeam < .15) grantFeat('knapp'); }
  }
  if (c.trial === 'l' && c.won) grantFeat('legendaer');
  for (const [id, f] of Object.entries(FEAT_PROG)) { const [v, goal] = f(); if (v >= goal) grantFeat(id); }
  if ((G.stats.mythics || 0) > 0) grantFeat('mythos');
}
function onMythic(it) { setTimeout(() => { W.flash('#ff5a48', 700); W.shake(3); sfx('ult'); reveal(it); trackFeats(); }, 500); }
/* Mythischer Fund: eigene Bühne mit Lichtkranz, unabhängig von anderen Einblendungen */
function reveal(it) {
  let el = $('#reveal'); if (!el) { el = document.createElement('div'); el.id = 'reveal'; $('#app').appendChild(el); }
  const c = RARITY[it.r].c, lines = itemLines(it).slice(0, 3);
  el.style.setProperty('--rc', c);
  el.innerHTML = `<div class="rv-rays"></div><div class="rv-in"><div class="kicker">${RARITY[it.r].n || 'Mythisch'}er Fund</div><div class="rv-ic">${icHtml(it)}</div><h2>${esc(it.name)}</h2><small>${lines.map(esc).join(' · ')}</small></div>${Array.from({ length: 14 }, (_, i) => `<i class="rv-sp" style="--a:${i * 25.7}deg;--d:${(i % 5) * .12}s"></i>`).join('')}`;
  el.hidden = false; el.classList.remove('out'); paintCards(el);
  const close = () => { el.classList.add('out'); setTimeout(() => { el.hidden = true; el.classList.remove('out'); }, 350); };
  clearTimeout(reveal.t); reveal.t = setTimeout(close, 3400); el.onclick = e => { e.stopPropagation(); clearTimeout(reveal.t); close(); };
}
function openFeats(page = openFeats.page) {
  if (!gate('feats')) return;
  const list = FEATS.slice().sort((a, b) => featDone(a.id) - featDone(b.id)), per = 9, np = pages(list.length, per); page = openFeats.page = clampPg(page, np);
  const rw = F => [F.rw.gold ? '◆ ' + fmt(F.rw.gold) : '', F.rw.frags ? '◈ ' + F.rw.frags : '', F.rw.r ? `<b style="color:${RARITY[F.rw.r].c}">${RARITY[F.rw.r].n}</b>` : ''].filter(Boolean).join(' ');
  openSheet('Heldentaten', `<div class="m-achs">${list.slice(page * per, page * per + per).map(F => { const d = featDone(F.id), pr = FEAT_PROG[F.id]?.(); return `<div class="ach feat ${d ? 'claimed' : ''}"><b>${esc(F.n)}</b><small>${esc(F.d)}</small>${pr ? `<div class="bar"><i style="width:${Math.min(100, pr[0] / pr[1] * 100)}%"></i></div>` : ''}<div class="ar"><span>${rw(F)}</span>${d ? '<span class="tag in">✓</span>' : `<span class="tag">${pr ? Math.min(pr[0], pr[1]) + '/' + pr[1] : 'offen'}</span>`}</div></div>`; }).join('')}</div>`, null, { pages: np, page, onPage: p => openFeats(p), tabs: ACH_TABS, tab: 'feat', onTab: achTab });
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
  if (!gate('quests')) return;
  const b = ensureBoard();
  openSheet('Aufträge', `<div class="m-quests">${b.active.map((a, i) => { const st = questState(i); return `<div class="ach ${st.done ? 'ready' : ''}"><b>${esc(st.q.n.replace(/\d+/, st.goal))}</b><div class="bar"><i style="width:${Math.min(100, st.v / st.goal * 100)}%"></i></div><div class="ar"><small>${Math.min(st.v, st.goal)} / ${st.goal}</small><span>◆ ${fmt(st.r.gold)}</span><button class="btn small ${st.done ? 'gold' : ''}" data-q="${i}" ${st.done ? '' : 'disabled'}>Abholen</button></div></div>`; }).join('')}
    <div class="ach bonus ${boardBonusReady() ? 'ready' : ''}"><b>Bonustruhe</b><small>Nach je 4 Aufträgen: ◈ 1 Ringfragment und ein epischer oder legendärer Gegenstand</small><div class="bar"><i style="width:${Math.min(100, b.bonus / 4 * 100)}%"></i></div><div class="ar"><small>${Math.min(4, b.bonus)} / 4 · bisher ${b.done} erledigt</small><button class="btn small ${boardBonusReady() ? 'gold' : ''}" id="qb" ${boardBonusReady() ? '' : 'disabled'}>Öffnen</button></div></div></div>`, s => {
    s.querySelectorAll('[data-q]').forEach(x => x.onclick = () => { if (claimQuest(+x.dataset.q)) { sfx('loot'); updateHud(); openQuests(); } });
    const qb = s.querySelector('#qb'); if (qb) qb.onclick = () => { const it = claimBoardBonus(); if (it) { sfx('join'); lootPop([it], 0); W.pendingParty = 1; updateHud(); openQuests(); } };
  });
}
function openRelics(sel = openRelics.sel ?? Object.keys(G.relics).map(Number)[0] ?? 0) {
  if (!gate('relics')) return;
  openRelics.sel = sel; const n = Object.keys(G.relics).length, R = RELICS[sel], own = G.relics[sel];
  openSheet('Relikte', `<div class="m-reldet" style="--rc:${own ? R.c : '#555'}">${own ? `<canvas class="ic" data-ic="${R.ic}" data-c="${R.c}"></canvas><div><b>${esc(R.n)}</b><small>${esc(R.d)} · gilt dauerhaft für alle Helden</small></div>` : `<div class="ic empty"></div><div><b>???</b><small>Boss von Kapitel ${sel + 1}: ${esc(STORY[sel].n)}</small></div>`}<span class="m-cnt">${n}/${RELICS.length}</span></div>
    <div class="m-relics">${RELICS.map((r, i) => `<button class="m-rel ${G.relics[i] ? '' : 'lk'} ${i === sel ? 'sel' : ''}" data-r="${i}" style="--rc:${r.c}">${G.relics[i] ? `<canvas class="ic" data-ic="${r.ic}" data-c="${r.c}"></canvas>` : '<div class="ic empty"></div>'}<small>${G.relics[i] ? esc(r.n) : 'Kap. ' + (i + 1)}</small></button>`).join('')}</div>`, s => {
    s.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { sfx('click'); openRelics(+b.dataset.r); });
  }, { tabs: ACH_TABS, tab: 'rel', onTab: achTab });
}

/* ---------- Schmiede: Ringe der Macht ---------- */
function ringEff(R, stars) { const b = ringBonus(R, Math.max(1, stars)), N = { hpPct: '% LP', atkPct: '% Angriff', magPct: '% Magie', defPct: '% Verteidigung', healPct: '% Heilung', crit: '% Krit' }; return Object.entries(b).map(([k, v]) => `${v > 0 ? '+' : '−'}${Math.abs(v)} ${N[k] || k}`).join(', '); }
function paintRings(root) { root.querySelectorAll('canvas[data-ring]').forEach(cv => { const R = RINGS.find(r => r.id === cv.dataset.ring), own = (G.rings?.[R.id]?.stars || 0) > 0; requestAnimationFrame(() => RIG.icon(cv, R.id === 'einer' ? 'onering' : 'ring', R.c, own ? (R.id === 'einer' ? 4 : 3) : 1)); }); }
function onFragments(got) {
  const by = {}; got.forEach(R => by[R.id] = R); const ids = Object.keys(by);
  const R = by[ids[0]], ready = ids.find(id => canForge(id));
  if (ready) toast(`◈ <b>${esc(RINGS.find(r => r.id === ready).n)}</b> kann geschmiedet werden!`, 'unlock');
  else toast(`◈ Ringfragment${got.length > 1 ? 'e' : ''}: <b>${ids.map(id => esc(by[id].n)).join(', ')}</b> (${G.frags[R.id]}/${ringCost(R.id)})`, 'lvl');
  sfx('loot');
}
function openForge(page = openForge.page) {
  if (!gate('forge')) return;
  const per = 4, np = pages(RINGS.length + 1, per); page = openForge.page = clampPg(page, np);
  const card = R => { const r = G.rings?.[R.id] || { stars: 0 }, st = r.stars || 0, have = G.frags?.[R.id] || 0, cost = ringCost(R.id), lock = R.from > ringProg(), ok = canForge(R.id), owner = r.owner && G.heroes[r.owner] ? HEROES[r.owner].n : null;
    return `<div class="m-ring ${st ? 'own' : ''} ${lock ? 'lk' : ''} ${R.id === 'einer' ? 'one' : ''}" style="--rc:${R.c}"><canvas data-ring="${R.id}"></canvas><b>${esc(R.n)}</b><span class="m-stars">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= st ? 'on' : ''}">★</i>`).join('')}</span>
      <small class="m-eff">${ringEff(R, st || 1)}</small><small class="m-pas">${esc(R.pd)}</small><small class="m-aura">${esc(R.ad)}</small>
      ${lock ? `<small class="m-src">Fragmente ab Kapitel ${R.from + 1}</small>` : `<div class="m-fr"><div class="bar"><i style="width:${Math.min(100, have / cost * 100)}%"></i></div><small>◈ ${have}/${cost}</small></div>`}
      ${st ? `<small class="m-own">${owner ? 'Träger: ' + esc(owner) + (loreBearer(R, r.owner) ? ' <b class="m-lore">✦ +20 %</b>' : '') : 'Kein Träger'}</small>` : ''}
      <div class="m-ra">${st < 5 && !lock ? `<button class="btn small ${ok ? 'gold' : ''}" data-forge="${R.id}" ${ok ? '' : 'disabled'}>${st ? 'Veredeln ★' + (st + 1) : '⚒ Schmieden'}</button>` : ''}${st ? `<button class="btn small" data-owner="${R.id}">Träger</button>` : ''}</div></div>`; };
  openSheet('Schmiede', `<div class="m-forge">${RINGS.slice(page * per, page * per + per).map(card).join('')}${page === np - 1 ? `<div class="m-ring info"><b>Ringe der Macht</b><small>Ringfragmente findest du bei Bossen, in Truhen, bei Nebenquests, Erfolgen, im Orthanc-Turm, in Spezialmodi und Prüfungen.</small><small>Jeder Held trägt einen Ring. Weitere Fragmente veredeln ihn bis ★5.</small><small>✦ Wahre Träger aus der Lore (Elrond, Galadriel, Gandalf …) erhalten +20 % Ringwirkung.</small><small class="m-own">◈ ${fragTotal()} Fragmente gesammelt</small></div>` : ''}</div>`, s => {
    paintRings(s);
    s.querySelectorAll('[data-forge]').forEach(b => b.onclick = async () => { const id = b.dataset.forge, R = RINGS.find(r => r.id === id), first = !(G.rings?.[id]?.stars); if (!forgeRing(id)) return; W.pendingParty = 1; refreshLooks(); updateHud(); closeSheet(); sfx('ult'); W.flash(R.c, 600);
      await splash(`<div class="cdone forge" style="--rc:${R.c}"><div class="kicker">${first ? 'Ring geschmiedet' : 'Ring veredelt · ★' + G.rings[id].stars}</div><canvas class="ringbig" data-ring="${id}"></canvas><h1>${esc(R.n)}</h1><p class="lore">${esc(R.lore)}</p><p><b>${ringEff(R, G.rings[id].stars)}</b> · ${esc(R.pd)}<br>${esc(R.ad)}</p><p>${G.rings[id].owner ? 'Träger: <b>' + esc(HEROES[G.rings[id].owner].n) + '</b>' + (loreBearer(R, G.rings[id].owner) ? ' · ✦ wahrer Träger, +20 %' : '') : ''}${R.lb ? `<br><small>Wahre Träger: ${R.lb.filter(k => HEROES[k]).map(k => esc(HEROES[k].n)).join(', ')}</small>` : ''}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); openForge(); });
    s.querySelectorAll('[data-owner]').forEach(b => b.onclick = () => openRingOwner(b.dataset.owner));
  }, { pages: np, page, onPage: p => openForge(p) });
}
function openRingOwner(id, page = 0) {
  const R = RINGS.find(r => r.id === id), list = owned().filter(k => !G.away[k]).sort((a, b) => (loreBearer(R, b) - loreBearer(R, a)) || (G.party.includes(b) - G.party.includes(a)) || heroStats(b).power - heroStats(a).power), per = 12, np = pages(list.length, per); page = clampPg(page, np);
  openSheet(`${esc(R.n)} · Träger`, `<div class="m-heroes">${list.slice(page * per, page * per + per).map(k => { const rg = ringOf(k); return heroCard(k).replace('</button>', `${rg ? `<span class="m-rtag" style="--rc:${rg.R.c}">◍ ${esc(rg.R.n.split(',')[0])}</span>` : loreBearer(R, k) ? `<span class="m-rtag" style="--rc:${R.c}">✦ Wahrer Träger</span>` : ''}</button>`).replace('data-k=', 'data-rk='); }).join('')}</div>`, s => {
    s.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => { setRingOwner(id, b.dataset.rk); sfx('buff'); W.pendingParty = 1; refreshLooks(); toast(`${esc(HEROES[b.dataset.rk].n)} trägt jetzt <b>${esc(R.n)}</b>`, 'lvl'); openForge(); });
    const bk = s.querySelector('#rBack'); if (bk) bk.onclick = () => openForge();
  }, { pages: np, page, onPage: p => openRingOwner(id, p), extra: '<button class="btn small" id="rBack">‹ Schmiede</button>' });
}
function openAch(page = openAch.page) {
  if (!gate('ach')) return;
  const list = ACHIEVEMENTS.map(a => [a, achState(a)]).sort((x, y) => (y[1].done && !y[1].claimed) - (x[1].done && !x[1].claimed) || x[1].claimed - y[1].claimed);
  const per = 9, np = pages(list.length, per); page = openAch.page = clampPg(page, np);
  openSheet('Erfolge', `<div class="m-achs">${list.slice(page * per, page * per + per).map(([a, s]) => `<div class="ach ${s.claimed ? 'claimed' : s.done ? 'ready' : ''}"><b>${esc(a.n)}</b><small>${esc(a.d)}</small><div class="bar"><i style="width:${Math.min(100, s.v / a.goal * 100)}%"></i></div><div class="ar"><span>${a.r.gold ? '◆ ' + fmt(a.r.gold) : ''}${a.r.frags ? ' ◈ ' + a.r.frags : ''}</span>${s.claimed ? '<span class="tag in">✓</span>' : `<button class="btn small ${s.done ? 'gold' : ''}" data-a="${a.id}" ${s.done ? '' : 'disabled'}>Abholen</button>`}</div></div>`).join('')}</div>`, s => {
    s.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (claimAch(ACHIEVEMENTS.find(x => x.id === b.dataset.a))) { sfx('loot'); updateHud(); openAch(); } });
  }, { pages: np, page, onPage: p => openAch(p), tabs: ACH_TABS, tab: 'ach', onTab: achTab });
}
function openChest() {
  if (!gate('chest')) return;
  const st = chestState();
  openSheet('Siegestruhe', `<div class="chestbox"><p>Jeder Sieg legt Beute in die Truhe, ein Bosssieg dreifach. Ab 5 Siegen kannst du sie öffnen, voll ist sie bei ${CHEST_MAX}.</p>
    <div class="bar big"><i style="width:${st.n / CHEST_MAX * 100}%"></i></div><p><b>${st.n} / ${CHEST_MAX}</b> Siege gesammelt</p>
    <div class="chest-r"><span>◆ ${fmt(st.gold)} Gold</span><span>★ ${fmt(st.xp)} EP</span><span>◈ ${st.frags} Ringfragmente</span><span>▣ ${st.items} Gegenstände</span></div>
    <button class="btn gold big" id="claimIdle" ${st.ready ? '' : 'disabled'}>${st.ready ? 'Öffnen' : 'Noch ' + (5 - st.n) + ' Siege'}</button></div>`, s => {
    s.querySelector('#claimIdle').onclick = () => { const r = claimChest(); if (!r) return; sfx('join'); lootPop(r.rw.items.slice(0, 6), r.rw.gold); toast(`+${fmt(r.rw.xp)} EP für die Gruppe`, 'lvl'); W.pendingParty = 1; updateHud(); closeSheet(); };
  });
}
function ecoMode() { document.body.classList.toggle('eco', G.settings.gfx === 'akku'); }
function openSettings() {
  const S = G.settings;
  const tg = (id, on, label) => `<div class="opt"><span>${label}</span><button class="btn small ${on ? 'on' : ''}" id="${id}">${on ? 'An' : 'Aus'}</button></div>`;
  openSheet('Optionen', `<div class="m-opts"><div>
    ${tg('o-mus', S.music !== false, 'Musik')}${tg('o-snd', S.sound, 'Soundeffekte')}${tg('o-eq', S.autoEquip, 'Beste Ausrüstung automatisch')}${tg('o-clean', S.autoClean !== false, 'Beutel automatisch aufräumen')}${tg('o-party', S.autoParty, 'Gruppe automatisch')}${tg('o-ult', S.autoUlt !== false, 'Ultimates automatisch')}<div class="opt"><span>Story-Dialoge</span><span class="seg">${[['aus', 'Aus'], ['an', 'An'], ['auto', 'Auto']].map(([v, l]) => `<button class="btn small ${(!S.dialogs ? 'aus' : S.autoText !== false ? 'auto' : 'an') === v ? 'on' : ''}" data-dlg="${v}">${l}</button>`).join('')}</span></div><div class="opt"><span>Effekte</span><span class="seg">${[['voll', 'Voll'], ['sanft', 'Sanft']].map(([v, l]) => `<button class="btn small ${(S.fx || 'voll') === v ? 'on' : ''}" data-fx="${v}">${l}</button>`).join('')}</span></div>
    <div class="opt"><span>Grafik</span><span class="seg">${[['auto', 'Auto'], ['hoch', 'Hoch'], ['normal', 'Normal'], ['akku', 'Akku']].map(([v, l]) => `<button class="btn small ${(S.gfx || 'auto') === v ? 'on' : ''}" data-gfx="${v}">${l}</button>`).join('')}</span></div></div>
    <div><h3 class="sect">Spielstand</h3><p class="muted small">Mit dem Code stellst du deinen Fortschritt wieder her, auch auf einem anderen Gerät.</p>
    ${backups().length ? `<div class="opt"><span>Sicherungen</span><span class="seg">${backups().map((B, i) => `<button class="btn small" data-bak="${i}">Kap. ${B.ch + 1}</button>`).join('')}</span></div>` : ''}
    <div class="opt"><button class="btn small" id="o-exp">Code kopieren</button><button class="btn small" id="o-imp">Code einfügen</button><button class="btn small danger" id="o-del">Neu beginnen</button></div>
    <textarea id="o-code" hidden rows="2" spellcheck="false"></textarea><div id="o-impbox" hidden class="opt"><button class="btn small gold" id="o-imp2">Spielstand laden</button><span id="o-msg" class="muted small"></span></div>
    <div id="o-conf" hidden class="opt warn"><span>Alles wird gelöscht.</span><button class="btn small danger" id="o-del2">Ja, löschen</button></div>
    <p class="muted small">Inoffizielles Fan-Spiel nach J.R.R. Tolkien und „Die Ringe der Macht“. Grafiken, Texte und Mechaniken sind eigene Umsetzungen.</p></div></div>`, s => {
    s.querySelectorAll('[data-gfx]').forEach(b => b.onclick = () => { S.gfx = b.dataset.gfx; W.lowFps = false; W.qStep = 0; W._pf = null; save(); ecoMode(); W.resize(); openSettings(); });
    s.querySelector('#o-ult').onclick = () => { S.autoUlt = S.autoUlt === false; save(); openSettings(); };
    s.querySelectorAll('[data-fx]').forEach(b => b.onclick = () => { S.fx = b.dataset.fx; document.body.classList.toggle('fx-soft', S.fx === 'sanft'); save(); openSettings(); });
    s.querySelectorAll('[data-dlg]').forEach(b => b.onclick = () => { const v = b.dataset.dlg; S.dialogs = v !== 'aus'; S.autoText = v === 'auto'; save(); openSettings(); }); if (s.querySelector('#o-txt')) s.querySelector('#o-txt').onclick = () => { S.autoText = S.autoText === false; save(); openSettings(); };
    s.querySelector('#o-snd').onclick = () => { S.sound = !S.sound; save(); openSettings(); };
    s.querySelector('#o-mus').onclick = () => { S.music = S.music === false; save(); MUSIC.sync(); openSettings(); };
    const ta = s.querySelector('#o-code');
    s.querySelector('#o-exp').onclick = () => { ta.hidden = false; ta.readOnly = true; ta.value = exportSave(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => toast('Code kopiert', 'mini'), () => toast('Code markiert. Bitte kopieren.', 'mini')); } catch (e) { toast('Code markiert. Bitte kopieren.', 'mini'); } };
    s.querySelector('#o-imp').onclick = () => { ta.hidden = false; ta.readOnly = false; ta.value = ''; ta.placeholder = 'Code hier einfügen'; s.querySelector('#o-impbox').hidden = false; ta.focus(); };
    s.querySelector('#o-imp2').onclick = () => { if (importSave(ta.value)) { s.querySelector('#o-msg').textContent = 'Geladen. Das Spiel startet neu …'; setTimeout(() => location.reload(), 700); } else s.querySelector('#o-msg').textContent = 'Der Code ist ungültig.'; };
    s.querySelector('#o-clean').onclick = () => { S.autoClean = S.autoClean === false; save(); openSettings(); }; s.querySelectorAll('[data-bak]').forEach(b => b.onclick = () => restoreBackup(+b.dataset.bak)); s.querySelector('#o-eq').onclick = () => { S.autoEquip = !S.autoEquip; if (S.autoEquip) { autoEquip(); W.pendingParty = 1; } save(); openSettings(); };
    s.querySelector('#o-party').onclick = () => { S.autoParty = !S.autoParty; if (S.autoParty) { autoParty(); W.pendingParty = 1; buildHud(); } save(); openSettings(); };
    s.querySelector('#o-del').onclick = () => { s.querySelector('#o-conf').hidden = false; };
    s.querySelector('#o-del2').onclick = () => { store.del(SAVE_KEY); location.reload(); };
  });
}

/* ---------- Start ---------- */
function layoutMode() {
  // Hochkant: das ganze Spiel wird um 90° gedreht, damit man das iPhone einfach quer halten kann (auch mit Ausrichtungssperre)
  const rot = false, app = $('#app'), aw = rot ? innerHeight : innerWidth, ah = rot ? innerWidth : innerHeight;
  document.body.classList.toggle('rot', rot); document.body.classList.remove('portrait');
  app.style.width = aw + 'px'; app.style.height = ah + 'px'; app.style.transform = rot ? `translate(${innerWidth}px,0) rotate(90deg)` : '';
  if (rot && !layoutMode.dismissed && !layoutMode.hinted) { layoutMode.hinted = 1; $('#rotate').hidden = false; clearTimeout(layoutMode.t); layoutMode.t = setTimeout(() => { $('#rotate').hidden = true; }, 4500); }
  if (!rot) $('#rotate').hidden = true;
  W && W.resize();
}
/* Wisch-Richtung im Spiel-Koordinatensystem (berücksichtigt die Drehung) */
function appDelta(dx, dy) { return document.body.classList.contains('rot') ? [dy, -dx] : [dx, dy]; }
function boot() {
  const has = load();
  if (!has) { newProfile(); for (const k of STORY[0].join) joinHero(k); save(); }
  ecoMode();
  W = new World($('#world'), { banner, starOk: () => started && isUnl('forge'), eagles: () => { G.stats.eagles = (G.stats.eagles || 0) + 1; }, combo: comboFx, ultUsed: () => track('ults', 1), crit: () => track('crits', 1), kill: u => { if (u.gold) flyCoins(u, u.boss ? 9 : u.elite ? 5 : 3); G.bestiary = G.bestiary || {}; if (!u.mirror) G.bestiary[u.key] = (G.bestiary[u.key] || 0) + 1; if (u.tags?.includes('ork')) track('orcs', 1); if (u.tags?.includes('tier')) track('beasts', 1); } });
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
  const titleBgs = ['shire', 'rivendell', 'pelennor', 'lorien', 'sea', 'erebor', 'helm', 'doom']; let tbi = titleBgs.indexOf(W.bgKey); const tbt = setInterval(() => { if (started) { clearInterval(tbt); return; } tbi = (tbi + 1) % titleBgs.length; W.setBg(titleBgs[tbi]); }, 5200);
  document.body.classList.toggle('fx-soft', G.settings.fx === 'sanft');
  $('#tContinue').onclick = async () => { if (started) return; started = true; clearInterval(tbt); W.setBg(chBg(STORY[G.story.ch], G.story.wave)); ac(); MUSIC.sync(); sfx('join'); $('#title').classList.add('out'); document.body.classList.remove('titled'); setTimeout(() => $('#title').hidden = true, 600); W.walking = false; W.heroes.forEach(h => W.setAnim(h, 'idle')); if (!G.seenHelp) { await introHelp(); G.seenHelp = 1; save(); } director(); };
  $('#nHeroes').onclick = () => { sfx('click'); openHeroes(); };
  $('#nBag').onclick = () => { sfx('click'); openBag(); };
  $('#nStory').onclick = () => { sfx('click'); openStory(); };
  $('#nAch').onclick = () => { sfx('click'); openAch(); };
  $('#nOpt').onclick = () => { sfx('click'); openSettings(); };
  $('#nQuest').onclick = () => { sfx('click'); openQuests(); };
  $('#nForge').onclick = () => { sfx('click'); openForge(); };
  document.querySelector('.res .m').onclick = () => { sfx('click'); openForge(); };
  $('#chest').onclick = () => { sfx('click'); openChest(); };
  $('#syn').onclick = () => { sfx('click'); openHeroes(); };
  ensureBoard();
  $('#spd').onclick = () => { G.settings.speed = G.settings.speed >= 3 ? 1 : G.settings.speed + 1; W.speed = G.settings.speed; $('#spd').textContent = G.settings.speed + '×'; save(); };
  $('#spd').textContent = (G.settings.speed || 1) + '×';
  $('#farm').onclick = () => { G.story.farm = false; save(); toast('Der Boss wird erneut herausgefordert!', 'lvl'); updateHud(); };
  $('#rotOk').onclick = () => { layoutMode.dismissed = 1; $('#rotate').hidden = true; };
  addEventListener('resize', layoutMode);
  $('#world').addEventListener('click', e => { if ($('#sheet').classList.contains('open')) { closeSheet(); return; } if (W.starAt(e.clientX, e.clientY)) { sfx('star'); G.stats.stars = (G.stats.stars || 0) + 1; grantFragments(1, true); toast('✦ Sternschnuppe gefangen · <b>+1 Ringfragment</b>', 'lvl'); save(); updateHud(); trackFeats(); return; } const u = W.unitAt(e.clientX, e.clientY); if (u) sfx('click'); unitInfo(u, e.clientX, e.clientY); });
  $('#uinfo').addEventListener('click', () => { $('#uinfo').hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
}
boot();
