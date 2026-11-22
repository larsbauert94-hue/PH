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
  $('#pips').innerHTML = [0, 1, 2, 3, 4].map(i => `<i class="${i < w ? 'done' : i === w ? 'cur' : ''}"></i>`).join('') + `<b class="${w >= 5 ? 'cur' : ''}">✦</b>`;
  $('#farm').hidden = !(G.story.farm && w >= 5);
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
    if (w < 5) {
      if ((ch.mid?.[w] || ch.midLine?.[w]) && !G.story.mids[mk]) {
        await dialog(ch.midLine?.[w]); for (const k of ch.mid?.[w] || []) { joinHero(k); applyParty(); await joinSplash(k); }
        G.story.mids[mk] = 1; save();
      }
      applyParty(); await W.walk(1500);
      const kind = w === 3 ? 'elite' : 'normal';
      const r = await W.fight(ch.waves[w], waveLvl(w), kind);
      onResult(r, kind);
      if (r.win) G.story.wave++; else { G.story.wave = Math.max(0, w - 1); banner('Rückzug! Die Gruppe sammelt sich.', 'foe'); }
      save(); continue;
    }
    if (G.story.farm) {
      applyParty(); await W.walk(1500);
      const r = await W.fight(ch.waves[4], waveLvl(4), 'normal'); onResult(r, 'normal'); continue;
    }
    if (!G.story.bossSeen) { await dialog(ch.bossLine); G.story.bossSeen = true; save(); }
    applyParty(); await W.walk(1200);
    const bk = ch.boss.find(k => ENEMIES[k].boss) || ch.boss[0]; await bossSplash(bk);
    const r = await W.fight(ch.boss, waveLvl(5) + 1, 'boss');
    onResult(r, 'boss');
    if (r.win) {
      G.stats.bosses++; await W.wait(400);
      await dialog(ch.outro);
      for (const k of ch.end || []) { joinHero(k); applyParty(); await joinSplash(k); }
      for (const k of ch.away || []) { G.away[k] = 1; toast(`${esc(HEROES[k].n)} hat die Gruppe verlassen …`, 'unlock'); }
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
    <div class="grid">${own.map(k => heroCard(k)).join('')}${locked.map(k => heroCard(k, 1)).join('')}</div>`, s => {
    s.querySelectorAll('.hcard[data-k]').forEach(b => b.onclick = () => { sfx('click'); openHero(b.dataset.k); });
    s.querySelector('#autoP').onclick = () => { G.settings.autoParty = !G.settings.autoParty; if (G.settings.autoParty) { autoParty(); W.pendingParty = 1; buildHud(); } save(); openHeroes(); };
  });
}
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
function openStory() {
  openSheet('Die Geschichte', `<div class="story-list">${STORY.map((c, i) => { const done = i < G.story.ch || G.story.loop > 0, cur = i === G.story.ch; const joins = [...(c.join || []), ...Object.values(c.mid || {}).flat(), ...(c.end || [])]; return `<div class="st ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${!done && !cur ? 'locked' : ''}"><div class="st-n">${i + 1}</div><div class="st-i"><small>${esc(c.part)}</small><b>${esc(c.n)}</b>${cur ? `<span>${G.story.wave >= 5 ? 'Boss' : 'Welle ' + (G.story.wave + 1) + ' von 5'}</span>` : ''}${joins.length ? `<div class="st-j">${joins.map(k => `<span class="${G.heroes[k] ? '' : 'lk'}">${G.heroes[k] ? esc(HEROES[k].n) : '???'}</span>`).join('')}</div>` : ''}</div><div class="st-s">${done ? '✓' : cur ? '▶' : '🔒'}</div></div>`; }).join('')}</div>`);
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
  W = new World($('#world'), { banner });
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
  $('#tContinue').onclick = () => { if (started) return; started = true; ac(); sfx('join'); $('#title').classList.add('out'); document.body.classList.remove('titled'); setTimeout(() => $('#title').hidden = true, 600); W.walking = false; W.heroes.forEach(h => W.setAnim(h, 'idle')); director(); };
  $('#nHeroes').onclick = () => { sfx('click'); openHeroes(); };
  $('#nBag').onclick = () => { sfx('click'); openBag(); };
  $('#nStory').onclick = () => { sfx('click'); openStory(); };
  $('#nAch').onclick = () => { sfx('click'); openAch(); };
  $('#nOpt').onclick = () => { sfx('click'); openSettings(); };
  $('#spd').onclick = () => { G.settings.speed = G.settings.speed >= 3 ? 1 : G.settings.speed + 1; W.speed = G.settings.speed; $('#spd').textContent = G.settings.speed + '×'; save(); };
  $('#spd').textContent = (G.settings.speed || 1) + '×';
  $('#farm').onclick = () => { G.story.farm = false; save(); toast('Der Boss wird erneut herausgefordert!', 'lvl'); updateHud(); };
  $('#rotOk').onclick = () => { layoutMode.dismissed = 1; $('#rotate').hidden = true; };
  addEventListener('resize', layoutMode);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
}
boot();
