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
  const syn = activeFactions().filter(f => f.tier >= 0).map(f => `<span style="--fc:${f.F.c}" title="${esc(f.F.n)}: ${esc(f.F.t[f.tier][2])}">${f.F.ic}<b>${f.n}</b></span>`).join('');
  if ($('#syn').dataset.v !== syn) { $('#syn').innerHTML = syn; $('#syn').dataset.v = syn; }
  const idle = idleState(); $('#chestFill').style.height = Math.min(100, idle.min / 120 * 100) + '%'; $('#chest').classList.toggle('ready', idle.min >= 30); $('#chestT').textContent = idle.min >= 60 ? Math.floor(idle.min / 60) + ' h' : Math.floor(idle.min) + ' min';
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
    const s = $('#splash'); s.className = 'splash ' + cls; s.innerHTML = html; s.hidden = false; paintCards(s);
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
    G.stats.wins++;
    const rw = battleReward(kind, r.enemies.filter(e => e.xp));
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
  save(); updateHud();
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
    const r = await W.fight(ch.boss, waveLvl(WAVES) + 1, 'boss');
    onResult(r, 'boss');
    if (r.win) {
      G.stats.bosses++; track('bosses', 1); await W.wait(400);
      await dialog(ch.outro);
      for (const k of ch.end || []) { joinHero(k); applyParty(); await joinSplash(k); }
      for (const k of ch.away || []) { G.away[k] = 1; toast(`${esc(HEROES[k].n)} hat die Gruppe verlassen …`, 'unlock'); }
      const relic = G.story.loop === 0 ? grantRelic(G.story.ch) : null;
      if (relic) { W.pendingParty = 1; await splash(`<div class="cdone relic"><div class="kicker">Relikt gefunden</div><canvas class="ric" data-ic="${relic.ic}" data-c="${relic.c}"></canvas><h1>${esc(relic.n)}</h1><p>Dauerhafter Gruppenbonus: <b>${esc(relic.d)}</b></p><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS'); }
      G.stats.chapters = Math.max(G.stats.chapters, G.story.ch + 1 + G.story.loop * STORY.length);
      const chest = genItem(chapterLvl() + 2, Math.random() < .25 ? 4 : 3); addItem(chest); const mith = 20 + G.story.ch * 4; G.mithril += mith;
      if (G.settings.autoEquip) autoEquip();
      await splash(`<div class="cdone"><div class="kicker">Kapitel abgeschlossen</div><h1>${esc(ch.n)}</h1><p>Kapitel-Truhe: ✧ ${mith} Mithril und</p><div class="loot1">${icHtml(chest)}<b style="color:${RARITY[chest.r].c}">${esc(chest.name)}</b></div><div class="dhint">Tippen zum Fortfahren</div></div>`, 0, 'doneS');
      G.story.ch++; if (G.story.ch >= STORY.length) { G.story.ch = 0; G.story.loop++; }
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
  if (locked) { const ci = STORY.findIndex(c => [...(c.join || []), ...(c.end || []), ...Object.values(c.mid || {}).flat()].includes(k)); return `<div class="hcard locked" style="--rc:${ROLE_COL[C.role]}"><canvas data-card="${k}" data-bust="1" data-stage="0"></canvas><div class="hc-info"><b>???</b><small>Kapitel ${ci + 1}</small></div></div>`; }
  return `<button class="hcard ${G.party.includes(k) ? 'in' : ''} ${G.away[k] ? 'away' : ''}" data-k="${k}" style="--rc:${ROLE_COL[C.role]}"><canvas data-card="${k}" data-bust="1"></canvas><span class="role-dot r-${C.role}"></span><div class="hc-info"><b>${esc(H.n)}</b>${stars(hs.stage)}<span class="pw">⚡ ${fmt(heroStats(k).power)}</span><small>Stufe ${hs.lvl}</small></div>${G.away[k] ? '<span class="tag">Fort</span>' : G.party.includes(k) ? '<span class="tag in">Gruppe</span>' : ''}</button>`;
}
function openHeroes() {
  const own = owned().sort((a, b) => (G.party.includes(b) - G.party.includes(a)) || heroStats(b).power - heroStats(a).power);
  const locked = Object.keys(HEROES).filter(k => !G.heroes[k]);
  openSheet('Helden', `
    <div class="party-row"><div class="pr-title">${own.length} von ${Object.keys(HEROES).length} Helden <small>${G.settings.autoParty ? 'Gruppe wird automatisch aufgestellt' : 'Eigene Aufstellung'}</small></div><button class="btn small ${G.settings.autoParty ? 'on' : ''}" id="autoP">Auto-Aufstellung</button></div>
    ${factionPanel()}
    <div class="grid">${own.map(k => heroCard(k)).join('')}${locked.map(k => heroCard(k, 1)).join('')}</div>`, s => {
    s.querySelectorAll('.hcard[data-k]').forEach(b => b.onclick = () => { sfx('click'); openHero(b.dataset.k); });
    s.querySelector('#autoP').onclick = () => { G.settings.autoParty = !G.settings.autoParty; if (G.settings.autoParty) { autoParty(); W.pendingParty = 1; buildHud(); } save(); openHeroes(); };
  });
}
function factionPanel() {
  return `<div class="facs">${activeFactions().map(f => `<div class="fac ${f.tier >= 0 ? 'on' : ''}" style="--fc:${f.F.c}"><span class="fi">${f.F.ic}</span><div><b>${esc(f.F.n)}</b><small>${f.F.t.map((t, i) => `<i class="${f.tier >= i ? 'act' : ''}">${t[0]}: ${esc(t[2])}</i>`).join(' · ')}</small></div><span class="fn">${f.n}</span></div>`).join('')}</div>`;
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
        <div class="hi-fac">${heroFactions(k)}</div>
        <div class="power">⚡ ${fmt(st.power)}<small>Kampfkraft</small></div>
        <div class="lvl"><span>Stufe ${hs.lvl}<small>/${cap}</small></span><div class="bar"><i style="width:${hs.lvl >= cap ? 100 : hs.xp / xpNeed(hs.lvl) * 100}%"></i></div></div>
        <div class="stats">${[['Leben', st.hp], [magic ? 'Magie' : 'Angriff', magic ? st.mag : st.atk], ['Verteidigung', st.def], ['Tempo', st.spd], ['Krit', st.crit + ' %']].map(([n, v]) => `<div><small>${n}</small><b>${typeof v === 'number' ? fmt(v) : v}</b></div>`).join('')}</div>
        <h3>Fähigkeiten</h3>
        ${skillRow('ult', kit.ult, false, 'wenn die Leiste voll ist')}
        ${skillRow('act', H.act, false, `alle ${H.act.cd + 1} Züge`)}
        ${skillRow('act2', H.act2, hs.lvl < ACT2_LVL, hs.lvl < ACT2_LVL ? `ab Stufe ${ACT2_LVL}` : `alle ${H.act2.cd + 1} Züge`)}
        ${H.pas.map(p => skillRow('pas', p, hs.lvl < p.lvl, hs.lvl < p.lvl ? `ab Stufe ${p.lvl}` : '')).join('')}
        <h3>Ausrüstung</h3><div class="gear">${gear}</div>
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
    <div class="cc-row"><b>Gegnerstufe</b><span>${C.lvl + G.story.loop * LOOP_LVL}–${C.lvl + G.story.loop * LOOP_LVL + 4}</span></div></div></div>`;
}
function openStory(part, sel) {
  if (part === undefined) part = Math.max(0, PARTS.indexOf(STORY[G.story.ch].part));
  if (sel === undefined || STORY[sel]?.part !== PARTS[part]) sel = STORY[G.story.ch].part === PARTS[part] ? G.story.ch : STORY.findIndex(c => c.part === PARTS[part]);
  const f = towerFloor(), tg = towerGroup(f);
  openSheet('Die Reise', `<div class="ptabs">${PARTS.map((p, i) => `<button class="ptab ${i === part ? 'on' : ''}" data-part="${i}" style="--c:${PART_COL[i]}">${esc(p.split(' · ')[1])}</button>`).join('')}</div>
    <div class="mapwrap"><canvas id="map" class="map"></canvas><div class="maphint">Tippe auf eine Station für Details</div></div>
    <div id="chDetail">${chapterCard(sel)}</div>
    <div class="tower"><div><div class="kicker">Herausforderung</div><b>Orthanc-Turm · Etage ${f}</b><small>Gegnerstufe ${towerLvl(f)} · Belohnung ◆${fmt(towerReward(f).gold)} ✧${towerReward(f).mithril} · Bestwert: Etage ${G.tower.best}</small></div><button class="btn gold" id="tw" ${G.tower.queued ? 'disabled' : ''}>${G.tower.queued ? 'Nach diesem Kampf' : 'Herausfordern'}</button></div>`, s => {
    const cv = s.querySelector('#map');
    requestAnimationFrame(() => drawMap(cv, part, sel));
    cv.onclick = e => { const rc = cv.getBoundingClientRect(), x = e.clientX - rc.left, y = e.clientY - rc.top; const h = (cv._hits || []).map(h => ({ ...h, d: Math.hypot(h.x - x, h.y - y) })).filter(h => h.d < h.r).sort((a, b) => a.d - b.d)[0]; if (h) { sfx('click'); sel = h.i; drawMap(cv, part, sel); s.querySelector('#chDetail').innerHTML = chapterCard(sel); paintCards(s.querySelector('#chDetail')); } };
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
    <li><b>Unten links</b> sammelt die Lagerfeuer-Truhe Belohnungen, auch wenn du nicht spielst.</li></ul><div class="dhint">Tippen zum Starten</div></div>`, 0, 'helpS');
}
function openQuests() {
  const d = ensureDaily();
  openSheet('Tägliche Aufträge', `<p class="muted">Jeden Tag gibt es vier neue Aufträge. Wer alle abschließt, öffnet die Bonustruhe.</p><div class="achs">${d.ids.map(id => { const st = questState(id); return `<div class="ach ${st.claimed ? 'claimed' : st.done ? 'ready' : ''}"><div><b>${esc(st.q.n)}</b><div class="bar"><i style="width:${Math.min(100, st.v / st.q.goal * 100)}%"></i></div><small>${Math.min(st.v, st.q.goal)} / ${st.q.goal}</small></div><div class="ar"><span>◆ ${fmt(st.r.gold)} ✧ ${st.r.mithril}</span>${st.claimed ? '<small>Erhalten</small>' : `<button class="btn small ${st.done ? 'gold' : ''}" data-q="${id}" ${st.done ? '' : 'disabled'}>Abholen</button>`}</div></div>`; }).join('')}
    <div class="ach bonus ${d.bonus ? 'claimed' : dailyBonusReady() ? 'ready' : ''}"><div><b>Bonustruhe</b><small>Alle vier Aufträge abholen: ✧ 30 und ein epischer oder legendärer Gegenstand</small></div><div class="ar">${d.bonus ? '<small>Erhalten</small>' : `<button class="btn small ${dailyBonusReady() ? 'gold' : ''}" id="qb" ${dailyBonusReady() ? '' : 'disabled'}>Öffnen</button>`}</div></div></div>`, s => {
    s.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { if (claimQuest(b.dataset.q)) { sfx('loot'); updateHud(); openQuests(); } });
    const qb = s.querySelector('#qb'); if (qb) qb.onclick = () => { const it = claimDailyBonus(); if (it) { sfx('join'); lootPop([it], 0); W.pendingParty = 1; updateHud(); openQuests(); } };
  });
}
function openRelics() {
  const n = Object.keys(G.relics).length, a = partyAura();
  openSheet('Schatzkammer', `<p class="muted">Jeder Kapitel-Boss hinterlässt beim ersten Sieg ein Relikt. Ihre Boni gelten dauerhaft für alle Helden. ${n} von ${RELICS.length} gefunden.</p>
    <div class="relics">${RELICS.map((r, i) => G.relics[i] ? `<div class="rel" style="--rc:${r.c}"><canvas class="ic" data-ic="${r.ic}" data-c="${r.c}"></canvas><b>${esc(r.n)}</b><small>${esc(r.d)}</small></div>` : `<div class="rel lk"><div class="ic empty"></div><b>???</b><small>Kapitel ${i + 1}: ${esc(STORY[i].n)}</small></div>`).join('')}</div>`);
}
function openChest() {
  const st = idleState();
  openSheet('Lagerfeuer-Truhe', `<div class="chestbox"><div class="kicker">Während du fort warst</div><p>Die Gefährten sammeln am Lagerfeuer Vorräte, auch wenn du nicht spielst (bis zu ${IDLE_CAP_MIN / 60} Stunden).</p>
    <div class="chest-r"><span>◆ ${fmt(st.gold)} Gold</span><span>★ ${fmt(st.xp)} EP</span><span>✧ ${st.mithril} Mithril</span><span>▣ ${st.items} Gegenstände</span></div>
    <p class="muted">Gesammelt seit ${st.min >= 60 ? Math.floor(st.min / 60) + ' h ' + Math.floor(st.min % 60) + ' min' : Math.floor(st.min) + ' min'}${st.full ? ' · Truhe voll!' : ''}</p>
    <button class="btn gold big" id="claimIdle" ${st.min >= 1 ? '' : 'disabled'}>Einsammeln</button></div>`, s => {
    s.querySelector('#claimIdle').onclick = () => { const r = claimIdle(); if (!r) return; sfx('join'); lootPop(r.rw.items.slice(0, 6), r.rw.gold); if (r.rw.mithril) toast(`+${r.rw.mithril} ✧ Mithril`, 'mini'); toast(`+${fmt(r.rw.xp)} EP für die Gruppe`, 'lvl'); W.pendingParty = 1; updateHud(); closeSheet(); };
  });
}
function openAch() {
  openSheet('Erfolge', `<div class="achs">${ACHIEVEMENTS.map(a => { const s = achState(a); return `<div class="ach ${s.claimed ? 'claimed' : s.done ? 'ready' : ''}"><div><b>${esc(a.n)}</b><small>${esc(a.d)}</small><div class="bar"><i style="width:${Math.min(100, s.v / a.goal * 100)}%"></i></div></div><div class="ar"><span>${a.r.gold ? '◆ ' + fmt(a.r.gold) : ''}${a.r.mithril ? '✧ ' + a.r.mithril : ''}</span>${s.claimed ? '<small>Erhalten</small>' : `<button class="btn small ${s.done ? 'gold' : ''}" data-a="${a.id}" ${s.done ? '' : 'disabled'}>Abholen</button>`}</div></div>`; }).join('')}</div>`, s => {
    s.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { if (claimAch(ACHIEVEMENTS.find(x => x.id === b.dataset.a))) { sfx('loot'); updateHud(); openAch(); } });
  });
}
function openSettings() {
  const S = G.settings;
  const tg = (id, on, label) => `<div class="opt"><span>${label}</span><button class="btn small ${on ? 'on' : ''}" id="${id}">${on ? 'An' : 'Aus'}</button></div>`;
  openSheet('Optionen', `${tg('o-snd', S.sound, 'Ton')}${tg('o-eq', S.autoEquip, 'Beste Ausrüstung automatisch anlegen')}${tg('o-party', S.autoParty, 'Gruppe automatisch aufstellen')}
    <div class="opt"><span>Spielstand</span><button class="btn small danger" id="o-del">Neu beginnen</button></div><div id="o-conf" hidden class="opt warn"><span>Der gesamte Fortschritt wird gelöscht.</span><button class="btn small danger" id="o-del2">Ja, löschen</button></div>
    <p class="muted small">Inoffizielles Fan-Spiel nach J.R.R. Tolkien und „Die Ringe der Macht“. Alle Grafiken, Texte und Mechaniken sind eigene Umsetzungen.</p>`, s => {
    s.querySelector('#o-snd').onclick = () => { S.sound = !S.sound; save(); openSettings(); };
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
  $('#tContinue').onclick = async () => { if (started) return; started = true; ac(); sfx('join'); $('#title').classList.add('out'); document.body.classList.remove('titled'); setTimeout(() => $('#title').hidden = true, 600); W.walking = false; W.heroes.forEach(h => W.setAnim(h, 'idle')); if (!G.seenHelp) { await introHelp(); G.seenHelp = 1; save(); } director(); };
  $('#nHeroes').onclick = () => { sfx('click'); openHeroes(); };
  $('#nBag').onclick = () => { sfx('click'); openBag(); };
  $('#nStory').onclick = () => { sfx('click'); openStory(); };
  $('#nAch').onclick = () => { sfx('click'); openAch(); };
  $('#nOpt').onclick = () => { sfx('click'); openSettings(); };
  $('#nQuest').onclick = () => { sfx('click'); openQuests(); };
  $('#nRelic').onclick = () => { sfx('click'); openRelics(); };
  $('#chest').onclick = () => { sfx('click'); openChest(); };
  $('#syn').onclick = () => { sfx('click'); openHeroes(); };
  ensureDaily();
  $('#spd').onclick = () => { G.settings.speed = G.settings.speed >= 3 ? 1 : G.settings.speed + 1; W.speed = G.settings.speed; $('#spd').textContent = G.settings.speed + '×'; save(); };
  $('#spd').textContent = (G.settings.speed || 1) + '×';
  $('#farm').onclick = () => { G.story.farm = false; save(); toast('Der Boss wird erneut herausgefordert!', 'lvl'); updateHud(); };
  $('#rotOk').onclick = () => { layoutMode.dismissed = 1; $('#rotate').hidden = true; };
  addEventListener('resize', layoutMode);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
}
boot();
