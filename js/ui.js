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
      const st = c.dataset.stage !== undefined ? +c.dataset.stage : (G.heroes[k]?.stage || 0);
      RIG.card(c, 'hum', lookAtStage(k, st), { col: ROLE_COL[CLASSES[HEROES[k].cls].role], bust: !!c.dataset.bust, seed: k, zoom: +(c.dataset.zoom || 1) });
    });
    root.querySelectorAll('canvas[data-ic]').forEach(c => RIG.icon(c, c.dataset.ic, c.dataset.c));
  });
}
const icHtml = it => `<canvas class="ic" data-ic="${it.icon}" data-c="${RARITY[it.r].c}" style="--rc:${RARITY[it.r].c}"></canvas>`;

/* ---------- HUD ---------- */
function buildHud() {
  $('#party').innerHTML = G.party.map(k => `<div class="pc" data-k="${k}" style="--rc:${heroCol(k)}"><canvas data-card="${k}" data-bust="1"></canvas><div class="hpv"></div><span class="pl">${G.heroes[k].lvl}</span><div class="ultbar"><i></i></div></div>`).join('');
  $$('#party .pc').forEach(el => el.onclick = () => { sfx('click'); openHero(el.dataset.k); });
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
  const party = G.party.slice();
  if (r.win) {
    G.stats.wins++; addChest(kind === 'boss' ? 3 : 1);
    const rw = battleReward(kind, r.enemies.filter(e => e.xp));
    if (kind === 'boss' && r.setCh !== undefined) { const S2 = chapterSet(r.setCh); if (S2 && Math.random() < .6) rw.items.push(genSetItem(S2, r.enemies.reduce((a, e) => Math.max(a, e.lvl), 1))); }
    const lvBefore = Object.fromEntries(owned().map(k => [k, G.heroes[k].lvl]));
    const res = applyReward(rw, party);
    lootPop(rw.items, rw.gold); if (rw.mithril) toast(`+${rw.mithril} ✧ Mithril`, 'mini');
    for (const k of Object.keys(res)) {
      if (!res[k].ups) continue; const a = lvBefore[k], b = G.heroes[k].lvl, H = HEROES[k];
      if (party.includes(k)) toast(`<b>${esc(H.n)}</b> erreicht Stufe ${b}`, 'lvl');
      if (a < ACT2_LVL && b >= ACT2_LVL) toast(`${esc(H.n)}: neue Fähigkeit <b>${esc(H.act2.n)}</b>`, 'unlock');
      H.pas.forEach(ps => { if (ps.lvl > 1 && a < ps.lvl && b >= ps.lvl) toast(`${esc(H.n)}: Passiv <b>${esc(ps.n)}</b>`, 'unlock'); });
      if (res[k].capped && party.includes(k)) toast(`${esc(H.n)} hat die Stufengrenze erreicht. Entwicklung möglich!`, 'unlock');
    }
    if (Object.values(res).some(x => x.ups)) sfx('level');
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
    if (G.tower.queued) { await towerRun(); continue; }
    if (G.queue) { const q = G.queue; if (q.type === 'boss') await bossRematch(q.ch); else if (q.type === 'side') await sideRun(q.id); else if (q.type === 'raid') await raidRun(q.key); else G.queue = null; continue; }
    if (w < WAVES) {
      if ((ch.mid?.[w] || ch.midLine?.[w]) && !G.story.mids[mk]) {
        await dialog(ch.midLine?.[w]); for (const k of ch.mid?.[w] || []) { joinHero(k); applyParty(); await joinSplash(k); }
        G.story.mids[mk] = 1; save();
      }
      applyParty(); await W.walk(1500);
      const kind = isEliteWave(w) ? 'elite' : 'normal';
      const r = await W.fight(chapterWaves()[w], waveLvl(w), kind);
      onResult(r, kind);
      if (r.win) { G.story.wave++; track('wins', 1); } else { G.story.wave = Math.max(0, w - 1); banner('Rückzug! Die Gruppe sammelt sich.', 'foe'); }
      save(); continue;
    }
    if (G.story.farm) {
      applyParty(); await W.walk(1500);
      const r = await W.fight(chapterWaves()[WAVES - 1], waveLvl(WAVES - 1), 'normal'); onResult(r, 'normal'); continue;
    }
    if (!G.story.bossSeen) { await dialog(ch.bossLine); G.story.bossSeen = true; save(); }
    applyParty(); await W.walk(1200);
    const bk = ch.boss.find(k => ENEMIES[k].boss) || ch.boss[0]; await bossSplash(bk);
    const r = await W.fight(ch.boss, waveLvl(WAVES) + 1, 'boss'); r.setCh = G.story.ch;
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
      const chest = genItem(chapterLvl() + 2, Math.random() < .25 ? 4 : 3); addItem(chest); const mith = 20 + G.story.ch * 4; G.mithril += mith;
      if (G.settings.autoEquip) autoEquip();
      await splash(`<div class="cdone"><div class="kicker">Kapitel abgeschlossen</div><h1>${esc(ch.n)}</h1><p>Kapitel-Truhe: ✧ ${mith} Mithril und</p><div class="loot1">${icHtml(chest)}<b style="color:${RARITY[chest.r].c}">${esc(chest.name)}</b></div><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
      G.story.ch++; if (G.story.ch >= STORY.length) { G.story.ch = 0; G.story.loop++; G.stats.loops++; const m = activeMods(); await splash(`<div class="cdone"><div class="kicker">Heldenreise ${G.story.loop + 1}</div><h1>Die Reise beginnt von Neuem</h1><p>Stärkere Gegner, bessere Beute (+${G.story.loop * 25} % Gold & EP, seltenere Gegenstände).</p><p><b>Erschwernisse:</b> ${m.map(x => esc(x.d)).join(' · ')}</p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      Object.assign(G.story, { wave: 0, intro: false, bossSeen: false, farm: false }); applyParty(); save();
    } else { G.story.farm = true; save(); banner('Der Boss ist zu stark. Die Gruppe trainiert.', 'foe'); toast('Werdet stärker und fordert den Boss dann erneut heraus.', 'unlock'); }
  }
}

/* ---------- Menüs (Glas-Panel) ---------- */
function openSheet(title, html, after) {
  cancelAnimationFrame(artRaf);
  const s = $('#sheet');
  s.innerHTML = `<div class="sh-head"><h2>${title}</h2><button class="x" aria-label="Schließen">✕</button></div><div class="sh-body">${html}</div>`;
  s.hidden = false; requestAnimationFrame(() => s.classList.add('open'));
  s.querySelector('.x').onclick = closeSheet;
  paintCards(s); after && after(s);
}
function closeSheet() { cancelAnimationFrame(artRaf); const s = $('#sheet'); s.classList.remove('open'); setTimeout(() => { if (!s.classList.contains('open')) s.hidden = true; }, 260); }
function heroCard(k, locked) {
  const H = HEROES[k], C = CLASSES[H.cls], hs = G.heroes[k];
  if (locked) { const ci = STORY.findIndex(c => [...(c.join || []), ...(c.end || []), ...Object.values(c.mid || {}).flat()].includes(k)), sd = SIDE.find(x => x.hero === k); return `<div class="hcard locked" style="--rc:${ROLE_COL[C.role]}"><canvas data-card="${k}" data-bust="1" data-stage="0"></canvas><div class="hc-info"><b>???</b><small>${ci >= 0 ? 'Kapitel ' + (ci + 1) : sd ? 'Nebenquest: ' + esc(sd.n) : ''}</small></div></div>`; }
  return `<button class="hcard ${G.party.includes(k) ? 'in' : ''} ${G.away[k] ? 'away' : ''}" data-k="${k}" style="--rc:${ROLE_COL[C.role]}"><canvas data-card="${k}" data-bust="1"></canvas><span class="role-dot r-${C.role}"></span><div class="hc-info"><b>${esc(H.n)}</b>${stars(hs.stage)}<span class="pw">⚡ ${fmt(heroStats(k).power)}</span><small>Stufe ${hs.lvl}</small></div>${G.away[k] ? '<span class="tag">Fort</span>' : G.party.includes(k) ? '<span class="tag in">Gruppe</span>' : ''}</button>`;
}
function openHeroes() {
  const own = owned().sort((a, b) => (G.party.includes(b) - G.party.includes(a)) || heroStats(b).power - heroStats(a).power);
  const locked = Object.keys(HEROES).filter(k => !G.heroes[k]);
  openSheet('Helden', `
    <div class="party-row"><div class="pr-title">${own.length} von ${Object.keys(HEROES).length} Helden <small>${G.settings.autoParty ? 'Gruppe wird automatisch aufgestellt' : 'Eigene Aufstellung'}</small></div><button class="btn small ${G.settings.autoParty ? 'on' : ''}" id="autoP">Auto-Aufstellung</button></div>
    ${companionPanel()}
    ${factionPanel()}
    <div class="grid">${own.map(k => heroCard(k)).join('')}${locked.map(k => heroCard(k, 1)).join('')}</div>`, s => {
    s.querySelectorAll('.hcard[data-k]').forEach(b => b.onclick = () => { sfx('click'); openHero(b.dataset.k); });
    s.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { const id = b.dataset.cp; if (!G.comps[id]) return; G.companion = id; sfx('click'); W.pendingParty = 1; save(); openHeroes(); });
    paintComps(s);
    s.querySelector('#autoP').onclick = () => { G.settings.autoParty = !G.settings.autoParty; if (G.settings.autoParty) { autoParty(); W.pendingParty = 1; buildHud(); } save(); openHeroes(); };
  });
}
function paintComps(root) { root.querySelectorAll('canvas[data-comp]').forEach(c => { const cp = COMPANIONS.find(x => x.id === c.dataset.comp); requestAnimationFrame(() => compArt(c, cp)); }); }
function compArt(cv, cp) {
  const dpr = Math.min(2, devicePixelRatio || 1); cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; const c = cv.getContext('2d');
  const g = c.createRadialGradient(cv.width / 2, cv.height / 2, 2, cv.width / 2, cv.height / 2, cv.width * .7); g.addColorStop(0, 'rgba(232,189,92,.35)'); g.addColorStop(1, 'rgba(10,13,18,1)'); c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
  const sc = cv.height / 34; c.setTransform(sc, 0, 0, sc, cv.width / 2, cv.height * .86);
  if (cp.kind === 'eagle') { c.translate(0, -14); RIG.drawEagle(c, cp.look, 400); }
  else if (cp.kind === 'ghosts') { c.globalAlpha = .7; RIG.draw(c, 'hum', Object.assign({ wpn: 'sword' }, ENEMIES.dead_soldier.look), 'idle', 0, 400); }
  else if (cp.kind === 'sled') { c.scale(.8, .8); RIG.draw(c, 'quad', Object.assign({ eye: '#2a1a1a' }, cp.look), 'idle', 0, 400); }
  else RIG.draw(c, 'quad', Object.assign({ horse: 1, pony: cp.kind === 'pony', eye: '#2a1a12' }, cp.look), 'idle', 0, 400);
}
function companionPanel() {
  return `<div class="pr-title" style="margin-bottom:6px">Begleiter <small>Ein Begleiter reist mit und stärkt die ganze Gruppe.</small></div><div class="comps">${COMPANIONS.map(cp => { const own = G.comps[cp.id], src = cp.from.ch !== undefined ? 'Kapitel ' + (cp.from.ch + 1) : 'Nebenquest: ' + esc(SIDE.find(x => x.id === cp.from.side)?.n || ''); return `<button class="comp ${own ? '' : 'lk'} ${G.companion === cp.id ? 'on' : ''}" data-cp="${cp.id}"><canvas data-comp="${cp.id}"></canvas><b>${own ? esc(cp.n) : '???'}</b><small>${own ? esc(cp.d) : src}</small>${G.companion === cp.id ? '<span class="tag in">Aktiv</span>' : ''}</button>`; }).join('')}</div>`;
}
function factionPanel() {
  return `<div class="facs">${activeFactions().map(f => `<div class="fac ${f.tier >= 0 ? 'on' : ''}" style="--fc:${f.F.c}"><span class="fi">${f.F.ic}</span><div><b>${esc(f.F.n)}</b><small>${f.F.t.map((t, i) => `<i class="${f.tier >= i ? 'act' : ''}">${t[0]}: ${esc(t[2])}</i>`).join(' · ')}</small></div><span class="fn">${f.n}</span></div>`).join('')}</div>`;
}
function setLines(k) {
  const n = {}; for (const sl of Object.keys(SLOTS)) { const it = G.heroes[k].eq[sl] && itemById(G.heroes[k].eq[sl]); if (it?.set) n[it.set] = (n[it.set] || 0) + 1; }
  return Object.entries(n).map(([id, c]) => { const S2 = SETS.find(x => x.id === id); return `<div class="setl" style="--sc:${S2.c}"><b>${esc(S2.n)} (${c}/3)</b><span class="${c >= 2 ? 'on' : ''}">2: ${esc(S2.d2)}</span><span class="${c >= 3 ? 'on' : ''}">3: ${esc(S2.d3)}</span></div>`; }).join('');
}
function heroFactions(k) { return Object.values(FACTIONS).filter(F => F.m.includes(k)).map(F => `<span class="fchip" style="--fc:${F.c}">${F.ic} ${esc(F.n)}</span>`).join(''); }
function skillRow(type, s, locked, note) {
  return `<div class="sk ${type} ${locked ? 'locked' : ''}"><div class="sk-h"><span class="sk-t">${{ ult: 'Ultimate', act: 'Aktiv', act2: 'Aktiv II', pas: 'Passiv' }[type]}</span><b>${esc(s.n)}</b>${note ? `<small>${note}</small>` : ''}</div><p>${esc(s.d)}</p></div>`;
}
function openHero(k) {
  const H = HEROES[k], C = CLASSES[H.cls], hs = G.heroes[k], st = heroStats(k, G.party.includes(k) ? partyAura() : undefined), kit = heroKit(k), ev = canEvolve(k);
  const inP = G.party.includes(k), cap = STAGE_CAP[hs.stage], magic = C.base.mag > C.base.atk;
  const gear = Object.entries(SLOTS).map(([slot, n]) => { const it = hs.eq[slot] && itemById(hs.eq[slot]); return `<div class="gs" style="--rc:${it ? RARITY[it.r].c : '#3a444e'}">${it ? icHtml(it) : '<div class="ic empty"></div>'}<div><small>${n}</small><b style="${it ? 'color:' + RARITY[it.r].c : ''}">${it ? esc(it.name) + (it.enh ? ' +' + it.enh : '') : 'Leer'}</b>${it ? `<span>${itemLines(it).slice(0, 2).join(' · ')}</span>` : ''}</div></div>`; }).join('');
  openSheet(esc(H.n), `
    <div class="hero">
      <div class="hero-art" style="--rc:${ROLE_COL[C.role]}"><canvas id="bigArt"></canvas><div class="ha-foot">${stars(hs.stage)}<span>${esc(heroTitle(k))}</span></div></div>
      <div class="hero-info">
        <div class="hi-top"><span class="role r-${C.role}">${ROLES[C.role].n}</span><span class="muted">${esc(C.n)} · ${esc(C.sub)}</span></div>
        <div class="hi-fac">${heroFactions(k)}${BONDS.filter(b => b.a === k || b.b === k).map(b => { const o = b.a === k ? b.b : b.a, on = G.party.includes(k) && G.party.includes(o); return `<span class="fchip bond ${on ? 'on' : ''}" title="${esc(b.d)}">♥ ${esc(b.n)} · ${G.heroes[o] ? esc(HEROES[o].n) : '???'}${on ? ' · aktiv' : ''}</span>`; }).join('')}</div>
        <div class="power">⚡ ${fmt(st.power)}<small>Kampfkraft</small></div>
        <div class="lvl"><span>Stufe ${hs.lvl}<small>/${cap}</small></span><div class="bar"><i style="width:${hs.lvl >= cap ? 100 : hs.xp / xpNeed(hs.lvl) * 100}%"></i></div></div>
        <div class="stats">${[['Leben', st.hp], [magic ? 'Magie' : 'Angriff', magic ? st.mag : st.atk], ['Verteidigung', st.def], ['Tempo', st.spd], ['Krit', st.crit + ' %']].map(([n, v]) => `<div><small>${n}</small><b>${typeof v === 'number' ? fmt(v) : v}</b></div>`).join('')}</div>
        <h3>Fähigkeiten</h3>
        ${skillRow('ult', kit.ult, false, 'wenn die Leiste voll ist')}
        ${skillRow('act', H.act, false, `alle ${H.act.cd + 1} Züge`)}
        ${skillRow('act2', H.act2, hs.lvl < ACT2_LVL, hs.lvl < ACT2_LVL ? `ab Stufe ${ACT2_LVL}` : `alle ${H.act2.cd + 1} Züge`)}
        ${H.pas.map(p => skillRow('pas', p, hs.lvl < p.lvl, hs.lvl < p.lvl ? `ab Stufe ${p.lvl}` : '')).join('')}
        <h3>Ausrüstung</h3><div class="gear">${gear}</div>${setLines(k)}
        <div class="acts">
          <button class="btn" id="train" ${hs.lvl >= cap || G.gold < trainCost(k) ? 'disabled' : ''}>Training +1 Stufe <small>◆${fmt(trainCost(k))}</small></button>
          <button class="btn" id="bestEq">Beste Ausrüstung</button>
          <button class="btn ${inP ? '' : 'primary'}" id="toggleP" ${G.away[k] ? 'disabled' : ''}>${inP ? 'Aus der Gruppe' : 'In die Gruppe'}</button>
          ${ev ? `<button class="btn ${ev.ok ? 'gold' : ''}" id="evo" ${ev.ok ? '' : 'disabled'}>Entwickeln <small>${ev.lvlOk ? '' : 'ab Stufe ' + cap + ' · '}◆${fmt(ev.cost.gold)} ✧${ev.cost.mithril}</small></button>` : '<span class="muted">Höchste Entwicklung erreicht</span>'}
        </div>
      </div>
    </div>`, s => {
    const cv = s.querySelector('#bigArt'); const seq = ['idle', { melee: 'attack', spin: 'attack', cast: 'cast', shoot: 'shoot', throw: 'throw', shout: 'shout' }[H.act.anim] || 'attack', 'idle', 'victory'];
    let si = 0, t0 = performance.now();
    const loop = now => { const a = seq[si]; const dur = a === 'idle' ? 2600 : a === 'victory' ? 1800 : RIG.animTime(a) + 300; if (now - t0 > dur) { si = (si + 1) % seq.length; t0 = now; } RIG.card(cv, 'hum', heroLook(k), { col: ROLE_COL[C.role], seed: k, anim: seq[si], el: now - t0, gt: now, zoom: 1.02 }); artRaf = requestAnimationFrame(loop); };
    artRaf = requestAnimationFrame(loop);
    s.querySelector('#train').onclick = () => { if (train(k)) { sfx('level'); toast(`${esc(H.n)} erreicht Stufe ${G.heroes[k].lvl}`, 'lvl'); W.pendingParty = 1; openHero(k); } };
    s.querySelector('#bestEq').onclick = () => { const n = autoEquip([k]); toast(n ? 'Ausrüstung verbessert' : 'Bereits optimal ausgerüstet', 'mini'); W.pendingParty = 1; openHero(k); };
    s.querySelector('#toggleP').onclick = () => {
      G.settings.autoParty = false;
      if (inP) { if (G.party.length > 1) G.party = G.party.filter(x => x !== k); }
      else if (G.party.length < 5) G.party.push(k);
      else { const same = G.party.filter(x => roleOf(x) === roleOf(k)); const out = (same.length ? same : G.party).reduce((a, b) => heroStats(b).power < heroStats(a).power ? b : a); G.party = G.party.map(x => x === out ? k : x); toast(`${esc(HEROES[out].n)} wurde ersetzt`, 'mini'); }
      save(); W.pendingParty = 1; buildHud(); openHero(k);
    };
    const e = s.querySelector('#evo'); if (e) e.onclick = () => { if (evolve(k)) { W.pendingParty = 1; closeSheet(); joinSplash(k, 0).then(() => toast(`${esc(HEROES[k].n)} ist jetzt <b>${esc(heroTitle(k))}</b>!`, 'lvl')); } };
  });
}
function openBag() {
  const f = openBag.f || 'all';
  const list = G.inv.filter(it => f === 'all' || it.slot === f).sort((a, b) => b.r - a.r || b.lvl - a.lvl);
  openSheet('Beutel', `<div class="filters">${[['all', 'Alle'], ['weapon', 'Waffen'], ['armor', 'Rüstung'], ['trinket', 'Schmuck']].map(([x, n]) => `<button class="btn small ${f === x ? 'on' : ''}" data-f="${x}">${n}</button>`).join('')}<button class="btn small" id="salv">Gewöhnliche zerlegen</button></div>
    <div class="items">${list.map(it => { const by = equippedBy(it.id); return `<div class="item" style="--rc:${RARITY[it.r].c}">${icHtml(it)}<div class="it-i"><b style="color:${RARITY[it.r].c}">${esc(it.name)}${it.enh ? ' +' + it.enh : ''}</b><small>${RARITY[it.r].n} · ${SLOTS[it.slot]}${it.slot === 'weapon' ? ' · ' + WCLS[it.base] : ''} · St. ${it.lvl}</small><small class="muted">${itemLines(it).join(' · ')}</small>${it.passive ? `<small class="leg">${esc(it.passive)}</small>` : ''}</div><div class="it-a">${by ? `<span class="tag in">${esc(HEROES[by].n)}</span>` : ''}<button class="btn small" data-enh="${it.id}" ${G.gold < enhCost(it) || it.enh >= 10 ? 'disabled' : ''}>Verstärken ◆${fmt(enhCost(it))}</button><button class="btn small ghost" data-sv="${it.id}" ${by ? 'disabled' : ''}>Zerlegen ◆${fmt(itemValue(it))}</button></div></div>`; }).join('') || '<p class="muted">Noch keine Gegenstände.</p>'}</div>`, s => {
    s.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { openBag.f = b.dataset.f; openBag(); });
    s.querySelectorAll('[data-sv]').forEach(b => b.onclick = () => { const v = salvage(itemById(+b.dataset.sv)); save(); toast(`+${fmt(v)} ◆`, 'mini'); openBag(); });
    s.querySelectorAll('[data-enh]').forEach(b => b.onclick = () => { if (enhance(itemById(+b.dataset.enh))) { sfx('buff'); W.pendingParty = 1; } openBag(); });
    s.querySelector('#salv').onclick = () => { let g = 0; G.inv.filter(it => it.r <= 1 && !equippedBy(it.id)).forEach(it => g += salvage(it)); save(); toast(`Zerlegt: +${fmt(g)} ◆`, 'mini'); openBag(); };
  });
}
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
    cv._hits.push({ i: 'side:' + sd.id, x: x / (Math.min(2, devicePixelRatio || 1)), y: y / (Math.min(2, devicePixelRatio || 1)), r: Math.max(22, R / Math.min(2, devicePixelRatio || 1) + 8) });
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
  return `<div class="chcard ${st}"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1" class="${seen ? '' : 'sil'}"></canvas></div><div class="cc-info">
    <small>${esc(C.part)} · Kapitel ${i + 1}</small><h3>${esc(C.n)}</h3>
    <div class="cc-st">${st === 'done' ? '✓ Abgeschlossen' : st === 'cur' ? (G.story.wave >= WAVES ? '▶ Jetzt: Bosskampf' : `▶ Jetzt: Welle ${G.story.wave + 1} von ${WAVES}`) : '🔒 Noch nicht erreicht'}</div>
    <div class="cc-row"><b>Boss</b><span>${seen ? esc(ENEMIES[boss].n) : '???'}</span></div>
    ${joins.length ? `<div class="cc-row"><b>Gefährten</b><span>${joins.map(k => G.heroes[k] ? esc(HEROES[k].n) : '???').join(', ')}</span></div>` : ''}
    <div class="cc-row"><b>Relikt</b><span>${G.relics[i] ? esc(RELICS[i].n) + ' · ' + esc(RELICS[i].d) : '???'}</span></div>
    <div class="cc-row"><b>Gegnerstufe</b><span>${C.lvl + G.story.loop * LOOP_LVL}–${C.lvl + G.story.loop * LOOP_LVL + 4}</span></div>
    ${chapterSet(i) ? `<div class="cc-row"><b>Set-Beute</b><span style="color:${chapterSet(i).c}">${esc(chapterSet(i).n)}</span></div>` : ''}
    ${chapterCompanion(i) ? `<div class="cc-row"><b>Begleiter</b><span>${G.comps[chapterCompanion(i).id] ? esc(chapterCompanion(i).n) : '???'}</span></div>` : ''}
    ${st === 'done' ? `<button class="btn gold small" data-rematch="${i}" ${G.queue ? 'disabled' : ''}>Boss erneut bekämpfen${chapterSet(i) ? ' · Set-Teile' : ''}</button>` : ''}</div></div>`;
}
function sideCard(sd) {
  const un = sideUnlocked(sd), done = G.side[sd.id];
  const rew = [sd.hero ? (done ? esc(HEROES[sd.hero].n) : 'Neuer Held') : '', sd.comp ? (done ? esc(COMPANIONS.find(c => c.id === sd.comp).n) : 'Begleiter') : '', sd.legend ? (done ? esc(sd.legend) : 'Legendäre Waffe') : ''].filter(Boolean).join(', ');
  const boss = sd.boss.find(k => ENEMIES[k].boss);
  return `<div class="chcard side ${un ? (done ? 'done' : 'cur') : 'locked'}"><div class="cc-art"><canvas data-card="${boss}" data-enemy="1" data-bust="1" class="${un ? '' : 'sil'}"></canvas></div><div class="cc-info">
    <small>Nebenquest · ab Kapitel ${sd.after + 2}</small><h3>${esc(sd.n)}</h3>
    <div class="cc-st">${!un ? '🔒 Noch nicht erreicht' : done ? `✓ Abgeschlossen (${done}×)` : '◆ Verfügbar'}</div>
    <div class="cc-row"><b>Boss</b><span>${un ? esc(ENEMIES[boss].n) : '???'}</span></div>
    <div class="cc-row"><b>Belohnung</b><span>${rew}${done ? ' · wiederholbar für Beute' : ''}</span></div>
    <div class="cc-row"><b>Gegnerstufe</b><span>${sideLvl(sd)}–${sideLvl(sd) + 3}</span></div>
    ${un ? `<button class="btn gold small" data-side="${sd.id}" ${G.queue ? 'disabled' : ''}>${done ? 'Erneut spielen' : 'Nebenquest starten'}</button>` : ''}</div></div>`;
}
function openStory(part, sel) {
  if (part === undefined) part = Math.max(0, PARTS.indexOf(STORY[G.story.ch].part));
  if (typeof sel === 'string') { } else if (sel === undefined || STORY[sel]?.part !== PARTS[part]) sel = STORY[G.story.ch].part === PARTS[part] ? G.story.ch : STORY.findIndex(c => c.part === PARTS[part]);
  const f = towerFloor(), tg = towerGroup(f);
  openSheet('Die Reise', `<div class="ptabs">${PARTS.map((p, i) => `<button class="ptab ${i === part ? 'on' : ''}" data-part="${i}" style="--c:${PART_COL[i]}">${esc(p.split(' · ')[1])}</button>`).join('')}</div>
    <div class="mapwrap"><canvas id="map" class="map"></canvas><div class="maphint">Tippe auf eine Station für Details</div></div>
    <div id="chDetail">${typeof sel === 'string' ? sideCard(SIDE.find(x => 'side:' + x.id === sel)) : chapterCard(sel)}</div>
    ${activeMods().length ? `<div class="mods"><b>Heldenreise ${G.story.loop + 1}</b> ${activeMods().map(m => `<span>☠ ${esc(m.d)}</span>`).join('')}<span class="good">+${G.story.loop * 25} % Gold & EP, seltenere Beute</span></div>` : ''}
    <h3 class="sect">Prüfungen der Macht <small>45 Sekunden gegen einen übermächtigen Boss. Je mehr Schaden, desto größer die Belohnung. Beliebig oft spielbar.</small></h3>
    <div class="raids">${RAIDS.map(R => { const st = G.raid[R.key] || { best: 0, tiers: 0 }; return `<div class="raid"><canvas data-card="${R.key}" data-enemy="1" data-bust="1"></canvas><div><b>${esc(R.n)}</b><small>Bestwert ${Math.round(st.best * 100)} % · Stufe ${st.tiers}/${RAID_TIERS.length}</small><div class="bar"><i style="width:${st.best * 100}%"></i></div></div><button class="btn small gold" data-raid="${R.key}" ${G.queue || G.story.ch < 3 && !G.story.loop ? 'disabled' : ''}>Starten</button></div>`; }).join('')}</div>
    <div class="tower"><div><div class="kicker">Herausforderung</div><b>Orthanc-Turm · Etage ${f}</b><small>Gegnerstufe ${towerLvl(f)} · Belohnung ◆${fmt(towerReward(f).gold)} ✧${towerReward(f).mithril} · Bestwert: Etage ${G.tower.best}</small></div><button class="btn gold" id="tw" ${G.tower.queued ? 'disabled' : ''}>${G.tower.queued ? 'Nach diesem Kampf' : 'Herausfordern'}</button></div>`, s => {
    const cv = s.querySelector('#map');
    requestAnimationFrame(() => drawMap(cv, part, sel));
    const wireQ = root => {
      root.querySelectorAll('[data-rematch]').forEach(b => b.onclick = () => { G.queue = { type: 'boss', ch: +b.dataset.rematch }; save(); toast('Nach diesem Kampf geht es zum Boss.', 'lvl'); openStory(part, sel); });
      root.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { G.queue = { type: 'side', id: b.dataset.side }; save(); toast('Nach diesem Kampf beginnt die Nebenquest.', 'lvl'); openStory(part, sel); });
      root.querySelectorAll('[data-raid]').forEach(b => b.onclick = () => { G.queue = { type: 'raid', key: b.dataset.raid }; save(); toast('Nach diesem Kampf beginnt die Prüfung.', 'lvl'); openStory(part, sel); });
    };
    wireQ(s);
    cv.onclick = e => { const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top; const h = (cv._hits || []).map(h => ({ ...h, d: Math.hypot(h.x - x, h.y - y) })).filter(h => h.d < h.r).sort((a, b) => a.d - b.d)[0]; if (h) { sfx('click'); sel = h.i; drawMap(cv, part, sel); const d = s.querySelector('#chDetail'); d.innerHTML = typeof sel === 'string' ? sideCard(SIDE.find(x => 'side:' + x.id === sel)) : chapterCard(sel); paintCards(d); wireQ(d); } };
    s.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { sfx('click'); openStory(+b.dataset.part); });
    s.querySelector('#tw').onclick = () => { G.tower.queued = true; save(); toast('Die Gruppe zieht nach diesem Kampf zum Orthanc-Turm.', 'lvl'); openStory(part, sel); };
  });
}
function introHelp() {
  return splash(`<div class="help"><div class="kicker">So funktioniert Ringfahrt</div><h1>Willkommen, Gefährte</h1><ul>
    <li><b>Kämpfe laufen von selbst.</b> Die Helden setzen ihre Fähigkeiten automatisch ein.</li>
    <li><b>Goldene Leiste</b> unter jedem Helden: Ist sie voll, folgt die Ultimate.</li>
    <li><b>Oben links</b> siehst du Kapitel, Wellen und aktive Bündnisse.</li>
    <li><b>Oben rechts</b> öffnest du Helden, Beutel, die Reise-Karte, Aufträge und Relikte.</li>
    <li><b>Unten links</b> füllt sich die Siegestruhe mit jedem gewonnenen Kampf.</li>
    <li><b>Reise</b> zeigt die Karte mit Nebenquests, erneuten Bosskämpfen und den Prüfungen der Macht.</li></ul><div class="dhint">Tippen zum Starten</div></div>`, 0, 'helpS');
}
function openQuests() {
  const b = ensureBoard();
  openSheet('Auftragstafel', `<p class="muted">Erledigte Aufträge holst du ab, und sofort erscheint ein neuer. Nach je vier abgeholten Aufträgen öffnet sich die Bonustruhe.</p><div class="achs">${b.active.map((a, i) => { const st = questState(i); return `<div class="ach ${st.done ? 'ready' : ''}"><div><b>${esc(st.q.n.replace(/\d+/, st.goal))}</b><div class="bar"><i style="width:${Math.min(100, st.v / st.goal * 100)}%"></i></div><small>${Math.min(st.v, st.goal)} / ${st.goal}</small></div><div class="ar"><span>◆ ${fmt(st.r.gold)} ✧ ${st.r.mithril}</span><button class="btn small ${st.done ? 'gold' : ''}" data-q="${i}" ${st.done ? '' : 'disabled'}>Abholen</button></div></div>`; }).join('')}
    <div class="ach bonus ${boardBonusReady() ? 'ready' : ''}"><div><b>Bonustruhe</b><small>${Math.min(4, b.bonus)} / 4 Aufträge · ✧ 30 und ein epischer oder legendärer Gegenstand</small><div class="bar"><i style="width:${Math.min(100, b.bonus / 4 * 100)}%"></i></div></div><div class="ar"><button class="btn small ${boardBonusReady() ? 'gold' : ''}" id="qb" ${boardBonusReady() ? '' : 'disabled'}>Öffnen</button></div></div></div>
    <p class="muted small">Bisher erledigt: ${b.done} Aufträge.</p>`, s => {
    s.querySelectorAll('[data-q]').forEach(x => x.onclick = () => { if (claimQuest(+x.dataset.q)) { sfx('loot'); updateHud(); openQuests(); } });
    const qb = s.querySelector('#qb'); if (qb) qb.onclick = () => { const it = claimBoardBonus(); if (it) { sfx('join'); lootPop([it], 0); W.pendingParty = 1; updateHud(); openQuests(); } };
  });
}
function openRelics() {
  const n = Object.keys(G.relics).length;
  openSheet('Schatzkammer', `<p class="muted">Jeder Kapitel-Boss hinterlässt beim ersten Sieg ein Relikt. Ihre Boni gelten dauerhaft für alle Helden. ${n} von ${RELICS.length} gefunden.</p>
    <div class="relics">${RELICS.map((r, i) => G.relics[i] ? `<div class="rel" style="--rc:${r.c}"><canvas class="ic" data-ic="${r.ic}" data-c="${r.c}"></canvas><b>${esc(r.n)}</b><small>${esc(r.d)}</small></div>` : `<div class="rel lk"><div class="ic empty"></div><b>???</b><small>Kapitel ${i + 1}: ${esc(STORY[i].n)}</small></div>`).join('')}</div>`);
}
function openChest() {
  const st = chestState();
  openSheet('Siegestruhe', `<div class="chestbox"><div class="kicker">Kriegsbeute</div><p>Jeder Sieg legt Beute in die Truhe, ein Bosssieg dreifach. Ab 5 Siegen kannst du sie öffnen, voll ist sie bei ${CHEST_MAX}.</p>
    <div class="bar big"><i style="width:${st.n / CHEST_MAX * 100}%"></i></div><p><b>${st.n} / ${CHEST_MAX}</b> Siege gesammelt</p>
    <div class="chest-r"><span>◆ ${fmt(st.gold)} Gold</span><span>★ ${fmt(st.xp)} EP</span><span>✧ ${st.mithril} Mithril</span><span>▣ ${st.items} Gegenstände</span></div>
    <button class="btn gold big" id="claimIdle" ${st.ready ? '' : 'disabled'}>${st.ready ? 'Öffnen' : 'Noch ' + (5 - st.n) + ' Siege'}</button></div>`, s => {
    s.querySelector('#claimIdle').onclick = () => { const r = claimChest(); if (!r) return; sfx('join'); lootPop(r.rw.items.slice(0, 6), r.rw.gold); if (r.rw.mithril) toast(`+${r.rw.mithril} ✧ Mithril`, 'mini'); toast(`+${fmt(r.rw.xp)} EP für die Gruppe`, 'lvl'); W.pendingParty = 1; updateHud(); closeSheet(); };
  });
}
function openSettings() {
  const S = G.settings;
  const tg = (id, on, label) => `<div class="opt"><span>${label}</span><button class="btn small ${on ? 'on' : ''}" id="${id}">${on ? 'An' : 'Aus'}</button></div>`;
  openSheet('Optionen', `${tg('o-mus', S.music !== false, 'Musik')}${tg('o-snd', S.sound, 'Soundeffekte')}${tg('o-eq', S.autoEquip, 'Beste Ausrüstung automatisch anlegen')}${tg('o-party', S.autoParty, 'Gruppe automatisch aufstellen')}
    <h3 class="sect">Spielstand sichern</h3>
    <p class="muted small">Kopiere den Code und bewahre ihn auf. Mit ihm stellst du deinen Fortschritt jederzeit wieder her, auch auf einem anderen Gerät.</p>
    <div class="opt"><button class="btn small" id="o-exp">Code anzeigen & kopieren</button><button class="btn small" id="o-imp">Code einfügen</button></div>
    <textarea id="o-code" hidden rows="3" spellcheck="false"></textarea><div id="o-impbox" hidden class="opt"><button class="btn small gold" id="o-imp2">Spielstand laden</button><span id="o-msg" class="muted small"></span></div>
    <div class="opt"><span>Spielstand</span><button class="btn small danger" id="o-del">Neu beginnen</button></div><div id="o-conf" hidden class="opt warn"><span>Der gesamte Fortschritt wird gelöscht.</span><button class="btn small danger" id="o-del2">Ja, löschen</button></div>
    <p class="muted small">Inoffizielles Fan-Spiel nach J.R.R. Tolkien und „Die Ringe der Macht“. Alle Grafiken, Texte und Mechaniken sind eigene Umsetzungen.</p>`, s => {
    s.querySelector('#o-snd').onclick = () => { S.sound = !S.sound; save(); openSettings(); };
    s.querySelector('#o-mus').onclick = () => { S.music = S.music === false; save(); MUSIC.sync(); openSettings(); };
    const ta = s.querySelector('#o-code');
    s.querySelector('#o-exp').onclick = () => { ta.hidden = false; ta.readOnly = true; ta.value = exportSave(); ta.select(); try { navigator.clipboard.writeText(ta.value).then(() => toast('Code kopiert', 'mini'), () => toast('Code markiert. Bitte kopieren.', 'mini')); } catch (e) { toast('Code markiert. Bitte kopieren.', 'mini'); } };
    s.querySelector('#o-imp').onclick = () => { ta.hidden = false; ta.readOnly = false; ta.value = ''; ta.placeholder = 'Code hier einfügen'; s.querySelector('#o-impbox').hidden = false; ta.focus(); };
    s.querySelector('#o-imp2').onclick = () => { if (importSave(ta.value)) { s.querySelector('#o-msg').textContent = 'Geladen. Das Spiel startet neu …'; setTimeout(() => location.reload(), 700); } else s.querySelector('#o-msg').textContent = 'Der Code ist ungültig. Bitte vollständig einfügen.'; };
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
  W = new World($('#world'), { banner, combo: comboFx, ultUsed: () => track('ults', 1), crit: () => track('crits', 1), kill: u => { if (u.tags?.includes('ork')) track('orcs', 1); if (u.tags?.includes('tier')) track('beasts', 1); } });
  layoutMode();
  W.speed = G.settings.speed || 1;
  W.bgKey = STORY[G.story.ch].bg;
  applyParty();
  W.walking = true; W.heroes.forEach(h => W.setAnim(h, 'walk'));
  const origWalk = W.walk.bind(W); W.walk = async ms => { if (W.pendingParty) { W.pendingParty = 0; applyParty(); } return origWalk(ms); };
  const origFight = W.fight.bind(W); W.fight = (g, l, k) => { W.pendingParty = 0; W.setParty(G.party); buildHud(); return origFight(g, l, k); };
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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
}
boot();
