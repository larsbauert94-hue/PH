'use strict';
/* =====================================================================
   RINGFAHRT – Render-Engine
   Figuren als Vektor-Rigs mit Gelenken; alle Bewegungen werden pro
   Bild flüssig interpoliert (Atmen, Laufzyklus, Schläge, Zauber,
   Treffer, Fallen). Dazu gemalte Hintergründe und Item-Icons.
   Koordinaten: logische Einheiten, Füße bei (0,0), Blick nach rechts.
   ===================================================================== */
const RIG = (() => {
  const TAU = Math.PI * 2;
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const easeOut = k => 1 - Math.pow(1 - k, 3);
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  function sh(c, f) { if (!c || c[0] !== '#') return c; const [r, g, b] = rgb(c); return f < 0 ? hex(r * (1 + f), g * (1 + f), b * (1 + f)) : hex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f); }
  function rgba(c, a) { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; }

  /* ---------- Animationstabelle (gleiche Taktung wie die Kampflogik) ---------- */
  const ANIMS = {
    idle: { ms: [1700], loop: 1 }, walk: { ms: [420], loop: 1 },
    attack: { ms: [110, 80, 90, 100, 160], hit: 2 }, throw: { ms: [110, 80, 90, 100, 160], hit: 2 },
    cast: { ms: [150, 160, 150, 220], hit: 3 }, shoot: { ms: [130, 190, 90, 170], hit: 2 },
    shout: { ms: [130, 170, 190, 170], hit: 2 }, hurt: { ms: [300] }, victory: { ms: [900], loop: 1 }, dead: { ms: [600], hold: 1 }
  };
  const impactTime = a => { const A = ANIMS[a]; let t = 0; for (let i = 0; i < (A.hit || 0); i++) t += A.ms[i]; return t; };
  const animTime = a => ANIMS[a].ms.reduce((x, y) => x + y, 0);

  const IDLE_WA = { sword: -0.9, dagger: -0.7, axe: -1.1, hammer: -1.1, mace: -1.1, club: -1.2, staff: -1.5, spear: -1.35, bow: -1.5708, pan: -0.9, whip: 1.0, claws: 0 };
  function base(w) {
    const p = { bob: 0, stride: 0, aF: 1.2, aB: 1.45, wa: IDLE_WA[w] ?? -0.9, lean: 0, glow: .35, draw: 0, cape: .6, jaw: 0, headDx: 0, hide: 0, crouch: 0 };
    if (w === 'bow') p.aF = .75; if (w === 'staff' || w === 'spear') p.aF = 1.15; if (w === 'claws') p.aF = 1.35;
    return p;
  }
  // Schlüsselposen pro Phase (wie Keyframes)
  function key(anim, f, w) {
    const p = base(w), thrust = ['dagger', 'spear', 'claws'].includes(w);
    switch (anim) {
      case 'attack': case 'throw':
        if (w === 'bow') return key('shoot', Math.min(f, 3), w);
        if (thrust) Object.assign(p, [{ aF: .9, wa: w === 'claws' ? 0 : -.3, lean: -1.5, crouch: .5 }, { aF: .4, wa: 0, lean: 0 }, { aF: -.05, wa: 0, lean: 3.5, stride: 2.5 }, { aF: .15, wa: 0, lean: 2.2, stride: 1.5 }, { aF: .9, wa: -.4, lean: 0 }][f]);
        else Object.assign(p, [{ aF: -2.2, wa: -2.5, lean: -1.5, crouch: .6 }, { aF: -1.2, wa: -1, lean: 1 }, { aF: .35, wa: .7, lean: 2.5, stride: 2.5 }, { aF: .95, wa: 1.25, lean: 1.4, stride: 1.5 }, { aF: 1.15, wa: p.wa, lean: 0 }][f]);
        if (anim === 'throw' && f >= 2 && f <= 3) p.hide = 1;
        p.jaw = [0, .3, 1, .6, 0][f]; p.headDx = [0, 1, 3, 2, 0][f];
        break;
      case 'cast': Object.assign(p, [{ aF: -.6, wa: -1.2, glow: .5, crouch: .4 }, { aF: -1.5, wa: -1.57, glow: .9, bob: -1, aB: -1.1 }, { aF: -1.65, wa: -1.57, glow: 1.2, bob: -1.4, aB: -1.3 }, { aF: -.35, wa: -.65, glow: .7, lean: 1.2 }][f]); break;
      case 'shoot':
        if (w === 'bow') Object.assign(p, [{ aF: 0, wa: -1.5708, draw: .25, aB: .6 }, { aF: -.02, wa: -1.5708, draw: 1, lean: -1 }, { aF: 0, wa: -1.5708, draw: 0, lean: .4 }, { aF: .35, wa: -1.5708 }][f]);
        else Object.assign(p, [{ aF: .5, glow: .5 }, { aF: 0, wa: -.2, glow: .9, lean: -1 }, { aF: -.1, wa: -.1, glow: 1.2, lean: 1.2 }, { aF: .6 }][f]);
        p.jaw = f === 2 ? 1 : 0; p.headDx = [0, 0, 2, 1][f]; break;
      case 'shout': Object.assign(p, [{ aF: -1, aB: -1, crouch: .5 }, { aF: -1.45, aB: -1.55, bob: -1.2 }, { aF: -1.55, aB: -1.65, bob: -2 }, { aF: -.6, aB: .3 }][f]); if (w !== 'bow') p.wa = -1.5; p.jaw = [0, 1, 1, .3][f]; break;
      case 'hurt': Object.assign(p, { lean: -2.5, aF: 1.7, aB: 1.8, bob: 1, wa: p.wa + .6, crouch: .8 }); break;
      case 'dead': Object.assign(p, { lean: -1, aF: 1.6, aB: 1.6, wa: p.wa + .8 }); break;
    }
    return p;
  }
  function mixP(a, b, k) { const o = {}; for (const kk in a) o[kk] = typeof a[kk] === 'number' ? lerp(a[kk], b[kk] ?? a[kk], k) : a[kk]; return o; }
  function poseAt(anim, el, w, gt) {
    const b = base(w);
    if (anim === 'idle') {
      const ph = gt / 1700 * TAU;
      b.bob = (Math.sin(ph) + 1) * .45; b.aF += Math.sin(ph) * .05; b.aB += Math.sin(ph + 1) * .07; b.wa += Math.sin(ph) * .05;
      b.cape = .7 + Math.sin(ph * .8) * .7; b.glow = .4 + Math.sin(ph * 1.3) * .2; b.breath = Math.sin(ph); return b;
    }
    if (anim === 'walk') {
      const ph = el / 420 * TAU;
      b.stride = Math.sin(ph) * 3; b.bob = Math.abs(Math.cos(ph)) * .9 - .4; b.aB = 1.45 + Math.sin(ph) * .5; b.aF += -Math.sin(ph) * .15; b.cape = 2; b.walkPh = ph; b.lean = .6; return b;
    }
    if (anim === 'victory') {
      const ph = el / 900 * TAU; Object.assign(b, { bob: -Math.abs(Math.sin(ph)) * 3, aF: -1.6 + Math.sin(ph) * .1, wa: -1.57, aB: 1.4 - Math.abs(Math.sin(ph)) * 2.6, cape: 1.4 }); return b;
    }
    if (anim === 'hurt') { const k = clamp01(el / 300); const h = key('hurt', 0, w); return mixP(h, b, ease(clamp01((k - .25) / .75))); }
    if (anim === 'dead') { const p = key('dead', 0, w); p.fall = ease(clamp01(el / 600)); return p; }
    const A = ANIMS[anim]; let t = el, f = 0;
    while (f < A.ms.length - 1 && t >= A.ms[f]) { t -= A.ms[f]; f++; }
    const k = clamp01(t / A.ms[f]);
    const p0 = key(anim, f, w), p1 = f < A.ms.length - 1 ? key(anim, f + 1, w) : b;
    const p = mixP(p0, p1, ease(k)); p.hide = p0.hide; return p;
  }

  /* ---------- Körpermaße ---------- */
  const BODY = {
    man: { hw: 6, hh: 6.4, tw: 6, th: 9, ll: 10, al: 8, lw: 2.2 },
    slim: { hw: 5.8, hh: 6.2, tw: 5.2, th: 9, ll: 10.4, al: 8, lw: 2 },
    elf: { hw: 5.8, hh: 6.3, tw: 5.3, th: 10, ll: 11, al: 9, lw: 2 },
    hobbit: { hw: 6.2, hh: 6.2, tw: 6, th: 6.2, ll: 5.4, al: 6, lw: 2.2, feet: 1 },
    dwarf: { hw: 7, hh: 6.2, tw: 8.4, th: 7.4, ll: 5.2, al: 6.2, lw: 3 },
    orc: { hw: 6.4, hh: 6, tw: 7.2, th: 8.2, ll: 8.4, al: 8.4, lw: 2.4, hunch: 1.2 },
    goblin: { hw: 6, hh: 5.4, tw: 6, th: 6.4, ll: 6.4, al: 7, lw: 2, hunch: 1.4 },
    uruk: { hw: 6.4, hh: 6.4, tw: 8.4, th: 10.4, ll: 11, al: 9.4, lw: 3 },
    troll: { hw: 10, hh: 9, tw: 17, th: 17, ll: 13, al: 16, lw: 5, big: 1, hunch: 2.5 },
    ent: { hw: 9, hh: 10, tw: 12, th: 22, ll: 15, al: 16, lw: 4, big: 1 },
    giant: { hw: 10, hh: 10, tw: 16, th: 19, ll: 16, al: 17, lw: 5, big: 1 }
  };
  function dims(type, look) {
    if (type === 'hum') { const B = BODY[look.body] || BODY.man; return { h: B.ll + B.th + B.hh + 2, big: !!B.big, w: B.big ? 20 : 8 }; }
    if (type === 'quad') return { h: look.size ? 18 : 15, big: 0, w: look.size ? 12 : 10 };
    if (type === 'spider') return look.size ? { h: 30, big: 1, w: 22 } : { h: 14, big: 0, w: 10 };
    if (type === 'worm') return { h: 70, big: 1, w: 18 };
    return { h: 58, big: 1, w: 26 };
  }

  /* ---------- Zeichenhilfen ---------- */
  const OL = 'rgba(12,9,16,.92)';
  function P(c) {
    const o = {
      fill(build, fill, ow = .45) { c.beginPath(); build(); c.fillStyle = fill; c.fill(); if (ow) { c.lineWidth = ow; c.strokeStyle = OL; c.stroke(); } },
      limb(pts, w, col, ow = .45) { c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (ow) { c.strokeStyle = OL; c.lineWidth = w + ow * 2; c.stroke(); } c.strokeStyle = col; c.lineWidth = w; c.stroke(); },
      ell(x, y, rx, ry, fill, ow = .45, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); c.fillStyle = fill; c.fill(); if (ow) { c.lineWidth = ow; c.strokeStyle = OL; c.stroke(); } },
      rr(x, y, w, h, r, fill, ow = .45) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fillStyle = fill; c.fill(); if (ow) { c.lineWidth = ow; c.strokeStyle = OL; c.stroke(); } },
      lin(x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; },
      rad(x, y, r, stops) { const g = c.createRadialGradient(x, y, 0, x, y, r); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; },
      glow(x, y, r, col, a = .8) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = o.rad(x, y, r, [rgba(col, a), rgba(col, a * .35), rgba(col, 0)]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); }
    };
    return o;
  }
  const dir = a => [Math.cos(a), Math.sin(a)];

  /* ---------- Menschenähnliche Figuren ---------- */
  function drawHum(c, L, p, gt) {
    const B = BODY[L.body] || BODY.man, big = !!B.big, K = big ? 1.7 : 1, g = P(c);
    const skin = L.skin || '#d8a880', tunic = L.tunic || '#6a5a4a', pants = L.pants || sh(tunic, -.35), boots = L.boots || '#2a2018';
    const hair = L.hair || '#3a2a1a', bc = L.bc || hair, wc = L.wc || '#c8d0d8', ow = big ? .7 : .45;
    const w = L.wpn || 'sword';
    const bob = p.bob || 0, cr = (p.crouch || 0), lean = p.lean || 0;
    const hipY = -B.ll + bob + cr, cx = lean * .8;
    const top = hipY - B.th, hunch = B.hunch || 0;
    const tilt = lean * .03;
    const hx0 = cx + .6 + hunch + lean * .25, hy0 = top - B.hh + Math.min(hunch, 1.2) + .4;
    const sF = [cx + B.tw / 2 - 1.1 + lean * .15, top + 1.3 + (big ? 1 : 0)], sB = [cx - B.tw / 2 + 1.1, top + 1.3];
    const sleeve = L.armor && big ? L.armor : tunic;

    // Flügel
    if (L.wings) {
      const fl = Math.sin(gt / 260) * 4;
      for (const side of [1, 0]) {
        const col = side ? sh(L.wings, .12) : L.wings, o = side ? 5 : 0;
        g.fill(() => { c.moveTo(cx - 2, top + 3); c.quadraticCurveTo(cx - 16 - o, top - 18 - fl, cx - 30 - o, top - 14 - fl * 1.2); c.quadraticCurveTo(cx - 24 - o, top - 4, cx - 26 - o, top + 6 - fl * .4); c.quadraticCurveTo(cx - 18, top + 4, cx - 14, top + B.th - 2); c.closePath(); }, g.lin(cx, top - 20, cx - 30, top + 10, [sh(col, .2), col, sh(col, -.4)]), ow);
        c.strokeStyle = rgba('#000000', .4); c.lineWidth = .5; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(cx - 2, top + 3); c.quadraticCurveTo(cx - 14 - i * 4, top - 6 - fl * .5, cx - 22 - o - i * 2, top - 10 + i * 7 - fl); c.stroke(); }
      }
    }
    // Umhang
    if (L.cape) {
      const sway = (p.cape || 0) * 1.4 + (p.walkPh !== undefined ? Math.sin(p.walkPh * 2) * .6 : 0);
      const bot = Math.min(-.6, hipY + B.ll * .78);
      g.fill(() => { c.moveTo(sB[0] + .5, top + .4); c.lineTo(sF[0] - 1, top + .2); c.quadraticCurveTo(cx - 1, (top + bot) / 2, cx - B.tw / 2 - 1.2 - sway * .3, bot); c.quadraticCurveTo(cx - B.tw / 2 - 3 - sway, bot - 1 + Math.sin(gt / 300) * .6, cx - B.tw / 2 - 4.2 - sway * 1.2, bot - 2.2); c.quadraticCurveTo(cx - B.tw / 2 - 2.2 - sway * .6, (top + bot) / 2, sB[0] - .6, top + 1); c.closePath(); }, g.lin(cx, top, cx - 6, bot, [L.cape, sh(L.cape, -.3)]), ow);
    }
    // hinterer Arm
    const arm = (s, a, len) => { const e = [s[0] + Math.cos(a + .35) * len * .52, s[1] + Math.sin(a + .35) * len * .52]; const h = [e[0] + Math.cos(a - .2) * len * .52, e[1] + Math.sin(a - .2) * len * .52]; return { e, h }; };
    const aF = arm(sF, p.aF, B.al);
    const wd = dir(p.wa), wp = [-Math.sin(p.wa), Math.cos(p.wa)];
    let aB = arm(sB, p.aB, B.al);
    if (w === 'bow' && p.draw > 0) { const hh = [aF.h[0] - wp[0] * (1.5 + p.draw * 6.5), aF.h[1] - wp[1] * (1.5 + p.draw * 6.5)]; aB = { e: [(sB[0] + hh[0]) / 2 - .3, (sB[1] + hh[1]) / 2 + 1.4], h: hh }; }
    g.limb([sB, aB.e, aB.h], big ? 3.2 : 1.9, sh(sleeve, -.3), ow);
    g.ell(aB.h[0], aB.h[1], big ? 1.7 : 1.05, big ? 1.7 : 1.05, sh(skin, -.2), ow);
    // Beine
    const legs = (front) => {
      const s = (front ? 1 : -1) * (p.stride || 0), hx = cx + (front ? .45 : -.45) * B.lw;
      const lift = p.walkPh !== undefined ? Math.max(0, Math.sin(p.walkPh + (front ? 0 : Math.PI))) * 1.6 : 0;
      const foot = [hx + s, -.7 - lift], knee = [(hx + foot[0]) / 2 + .9 * K + cr * .6, (hipY + foot[1]) / 2 - lift * .3];
      const col = front ? pants : sh(pants, -.25);
      g.limb([[hx, hipY], knee, foot], B.lw * 1.08, col, ow);
      if (B.feet) g.ell(foot[0] + 1, foot[1] + .1, 1.9, .9, front ? skin : sh(skin, -.2), ow);
      else g.limb([[foot[0] - .2, foot[1] - .6], [foot[0] + 1.2 * K, foot[1] + .2]], B.lw * 1.15, front ? boots : sh(boots, -.3), ow);
    };
    if (L.robe) {
      legs(false); legs(true);
      const sw = (p.walkPh !== undefined ? Math.sin(p.walkPh) * 1.2 : 0) + (p.cape || 0) * .3;
      g.fill(() => { c.moveTo(cx - B.tw / 2 + .3, hipY - 2); c.lineTo(cx + B.tw / 2 - .3, hipY - 2); c.quadraticCurveTo(cx + B.tw / 2 + 1.2, hipY + B.ll * .5, cx + B.tw / 2 + 2 + sw * .5, -1.2); c.quadraticCurveTo(cx + sw * .4, -.2 + Math.sin(gt / 380) * .3, cx - B.tw / 2 - 2.2 + sw * .4, -1.4); c.quadraticCurveTo(cx - B.tw / 2 - 1, hipY + B.ll * .5, cx - B.tw / 2 + .3, hipY - 2); }, g.lin(cx - B.tw, 0, cx + B.tw, 0, [sh(tunic, -.3), tunic, sh(tunic, .12)]), ow);
    } else { legs(false); legs(true); }
    // Torso
    c.save(); c.translate(cx, hipY); c.rotate(tilt); c.translate(-cx, -hipY);
    const br = (p.breath || 0) * .15;
    g.fill(() => { c.moveTo(cx - B.tw / 2, top + 1.2); c.quadraticCurveTo(cx - B.tw / 2, top - br, cx - B.tw / 2 + 1.2, top - br); c.lineTo(cx + B.tw / 2 - 1.2, top - br); c.quadraticCurveTo(cx + B.tw / 2 + br, top, cx + B.tw / 2, top + 1.4); c.lineTo(cx + B.tw / 2 - .4, hipY); c.lineTo(cx - B.tw / 2 + .3, hipY); c.closePath(); }, g.lin(cx - B.tw / 2, 0, cx + B.tw / 2, 0, [sh(tunic, -.28), tunic, sh(tunic, .14)]), ow);
    if (!L.robe) { g.rr(cx - B.tw / 2 + .2, hipY - 1.6, B.tw - .4, 1, .3, '#3a2a1a', 0); g.rr(cx + B.tw / 2 - 2, hipY - 1.8, 1.2, 1.4, .3, '#e0b84a', .2); }
    if (L.armor) {
      const ah = B.th * .58;
      g.fill(() => { c.moveTo(cx - B.tw / 2 + .2, top + .4); c.lineTo(cx + B.tw / 2 - .2, top + .4); c.lineTo(cx + B.tw / 2 - .4, top + ah); c.quadraticCurveTo(cx, top + ah + 1.2, cx - B.tw / 2 + .4, top + ah); c.closePath(); }, g.lin(cx, top, cx, top + ah, [sh(L.armor, .45), L.armor, sh(L.armor, -.35)]), ow);
      g.ell(sF[0] + .2, top + .6, big ? 3.4 : 2.1, big ? 2.2 : 1.4, g.lin(sF[0], top - 1, sF[0], top + 2, [sh(L.armor, .5), sh(L.armor, -.2)]), ow);
    }
    if (L.mark) { c.fillStyle = L.mark; c.beginPath(); c.ellipse(cx + .4, top + 3.4, 1, 1.2, 0, 0, TAU); c.fill(); for (let i = -1; i <= 1; i++) { c.fillRect(cx + .4 + i * .7 - .2, top + 1.4, .45, 1.4); } }
    if (L.shield) {
      const sw = big ? 7 : 4.4, shh = big ? 11 : 7.4, sx = cx + B.tw / 2 - 1.6, sy = top + 1;
      g.fill(() => { c.moveTo(sx, sy); c.lineTo(sx + sw, sy); c.lineTo(sx + sw, sy + shh * .55); c.quadraticCurveTo(sx + sw, sy + shh * .9, sx + sw / 2, sy + shh); c.quadraticCurveTo(sx, sy + shh * .9, sx, sy + shh * .55); c.closePath(); }, g.lin(sx, sy, sx + sw, sy + shh, [sh(L.shield, .35), L.shield, sh(L.shield, -.35)]), ow * 1.4);
      g.ell(sx + sw / 2, sy + shh * .42, sw * .16, sw * .16, sh(L.shield, .55), .3);
    }
    c.restore();
    // Kopf
    const x0 = hx0 - B.hw / 2, y0 = hy0, HW = B.hw, HH = B.hh;
    if (L.hs === 'long' || L.hs === 'braids' || L.hs === 'wild') g.fill(() => { c.moveTo(x0 + 1, y0 + 1); c.quadraticCurveTo(x0 - 1.4, y0 + HH * .7, x0 - .6, y0 + HH + 2.6 + (p.cape || 0) * .2); c.lineTo(x0 + 2, y0 + HH + 1.4); c.lineTo(x0 + 2.2, y0 + 2); c.closePath(); }, g.lin(x0, y0, x0, y0 + HH + 3, [hair, sh(hair, -.3)]), ow);
    g.rr(x0, y0, HW, HH, HW * .38, g.lin(x0, 0, x0 + HW, 0, [sh(skin, -.18), skin, sh(skin, .08)]), ow);
    if (L.noface) g.rr(x0 + 1, y0 + .9, HW - 1, HH - 1.6, 1.4, '#050506', 0);
    if (L.paint) { c.fillStyle = L.paint; c.fillRect(x0 + 1.8, y0 + .3, .9, HH - .6); }
    const ey = y0 + HH * .46 - (big ? .6 : 0), ex = x0 + HW - 1.6;
    if (L.glow) { g.glow(ex, ey, big ? 4 : 2.6, L.glow, .9); c.fillStyle = sh(L.glow, .4); c.beginPath(); c.ellipse(ex, ey, .55, .45, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(ex - 2, ey, .5, .4, 0, 0, TAU); c.fill(); }
    else if (!L.noface) {
      c.fillStyle = '#1a1010'; c.beginPath(); c.ellipse(ex, ey, .42, Math.abs(Math.sin(gt / 2300)) > .03 ? .55 : .1, 0, 0, TAU); c.fill();
      c.fillStyle = sh(skin, -.25); c.beginPath(); c.moveTo(x0 + HW, ey + .5); c.lineTo(x0 + HW + .7, ey + 1.6); c.lineTo(x0 + HW - .2, ey + 1.7); c.fill();
      if (p.jaw > .2 && (hunch || big)) { c.fillStyle = '#2a0a0a'; c.fillRect(x0 + HW - 2.6, y0 + HH - 1.8, 2.4, .8 * p.jaw); }
    }
    // Haare
    const hs = L.hs || 'short';
    if (hs === 'long' || hs === 'braids' || hs === 'wild' || hs === 'short' || hs === 'curly') {
      g.fill(() => { c.moveTo(x0 - .3, y0 + HH * (hs === 'short' || hs === 'curly' ? .55 : .8)); c.quadraticCurveTo(x0 - .8, y0 - 1, x0 + HW * .45, y0 - 1.1); c.quadraticCurveTo(x0 + HW + .5, y0 - .9, x0 + HW + .2, y0 + 1.5); c.quadraticCurveTo(x0 + HW * .55, y0 + .9, x0 + 1.6, y0 + 1.8); c.quadraticCurveTo(x0 + 1, y0 + HH * .5, x0 + .9, y0 + HH * .8); c.closePath(); }, g.lin(x0, y0 - 1, x0, y0 + HH, [sh(hair, .2), hair, sh(hair, -.25)]), ow);
      if (hs === 'curly') for (let i = 0; i < 4; i++) g.ell(x0 + .6 + i * 1.6, y0 - .4 - (i % 2) * .4, 1, .9, sh(hair, i % 2 ? .1 : -.05), .3);
      if (hs === 'braids') { c.strokeStyle = sh(hair, -.2); c.lineWidth = 1; c.beginPath(); c.moveTo(x0 - .4, y0 + 2); c.quadraticCurveTo(x0 - 1.8, y0 + HH + 2, x0 - 1 + Math.sin(gt / 500) * .4, y0 + HH + 6); c.stroke(); g.ell(x0 - 1 + Math.sin(gt / 500) * .4, y0 + HH + 6.4, .6, .6, '#e8e0c0', .2); }
      if (hs === 'wild') for (let i = 0; i < 4; i++) g.fill(() => { c.moveTo(x0 + i * 1.6 - 1, y0 + .4); c.lineTo(x0 + i * 1.6 - 1.8, y0 - 2.2 - (i % 2)); c.lineTo(x0 + i * 1.6 + .6, y0); }, hair, .3);
    } else if (hs === 'leaves') {
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI; g.ell(hx0 + Math.cos(Math.PI + a) * HW * .75, y0 + 1 - Math.sin(a) * HH * .55 + Math.sin(gt / 600 + i) * .3, 2.4, 2, sh(hair, (i % 3 - 1) * .15), .35); }
    } else if (hs === 'fire') {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const fx = x0 - 1 + i * HW / 5, hgt = 4 + Math.sin(gt / 90 + i * 1.7) * 2 + (i % 2) * 2; c.fillStyle = g.lin(fx, y0, fx, y0 - hgt, ['rgba(255,90,20,.9)', 'rgba(255,170,40,.7)', 'rgba(255,230,120,0)']); c.beginPath(); c.moveTo(fx - 1.6, y0 + 1); c.quadraticCurveTo(fx - .6, y0 - hgt * .6, fx + Math.sin(gt / 120 + i) * 1.2, y0 - hgt); c.quadraticCurveTo(fx + 1, y0 - hgt * .5, fx + 1.8, y0 + 1); c.fill(); }
      c.restore();
    }
    if (L.horns) for (const s of [0, 1]) g.fill(() => { const bx = x0 + (s ? HW - 1.5 : 1); c.moveTo(bx - 1, y0 + .8); c.quadraticCurveTo(bx - 2 - s, y0 - 4, bx - 5 + s * 3, y0 - 6); c.quadraticCurveTo(bx - 1.5 + s, y0 - 2.5, bx + 1, y0 + .5); }, g.lin(0, y0, 0, y0 - 6, [L.horns, sh(L.horns, .4)]), ow);
    // Bart
    const bd = L.beard;
    if (bd === 'stubble') { c.fillStyle = rgba(sh(skin, -.45), .45); c.beginPath(); c.ellipse(x0 + HW * .62, y0 + HH - 1.2, HW * .38, 1.2, 0, 0, TAU); c.fill(); }
    if (bd === 'short') g.fill(() => { c.moveTo(x0 + .8, y0 + HH - 2.4); c.lineTo(x0 + HW + .2, y0 + HH - 2); c.quadraticCurveTo(x0 + HW, y0 + HH + 1.4, x0 + HW * .5, y0 + HH + 1.2); c.quadraticCurveTo(x0 + 1, y0 + HH + .6, x0 + .8, y0 + HH - 2.4); }, g.lin(0, y0 + HH - 2, 0, y0 + HH + 1.4, [bc, sh(bc, -.25)]), ow);
    if (bd === 'long' || bd === 'dwarf') {
      const len = bd === 'dwarf' ? B.th - .5 : B.th * .6, wid = bd === 'dwarf' ? HW + .4 : HW - .6, sw = Math.sin(gt / 700) * .3 + (p.lean || 0) * -.2;
      g.fill(() => { c.moveTo(x0 + (bd === 'dwarf' ? -.2 : .8), y0 + HH - 3); c.lineTo(x0 + HW + .2, y0 + HH - 2.4); c.quadraticCurveTo(x0 + HW, y0 + HH + len * .6, x0 + HW * .55 + sw, y0 + HH + len); c.quadraticCurveTo(x0 + HW - wid, y0 + HH + len * .5, x0 + (bd === 'dwarf' ? -.2 : .8), y0 + HH - 3); }, g.lin(0, y0 + HH, 0, y0 + HH + len, [sh(bc, .15), bc, sh(bc, -.25)]), ow);
      if (bd === 'dwarf') { c.strokeStyle = rgba('#000000', .35); c.lineWidth = .35; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x0 + HW * .5, y0 + HH + i * len / 4 - 1); c.lineTo(x0 + HW * .62, y0 + HH + i * len / 4); c.stroke(); } }
      if (L.glow) { /* Augen über dem Bart */ }
    }
    if (L.ears) g.fill(() => { c.moveTo(x0 + 1, y0 + HH * .42); c.lineTo(x0 - .6, y0 + HH * .05); c.lineTo(x0 + 2.2, y0 + HH * .5); }, skin, .35);
    // Kopfbedeckung
    const hat = L.hat, hc = L.hatC || '#6a6a6a';
    if (hat === 'wizard') {
      g.ell(hx0 + .2, y0 - .2, HW * .95, 1, sh(hc, -.1), ow);
      g.fill(() => { c.moveTo(x0 + .2, y0 - .4); c.lineTo(x0 + HW - .2, y0 - .4); c.quadraticCurveTo(x0 + HW * .6, y0 - 5, x0 - 1.4 + Math.sin(gt / 900) * .5, y0 - 8.4); c.quadraticCurveTo(x0 + HW * .3, y0 - 4, x0 + .2, y0 - .4); }, g.lin(x0, 0, x0 + HW, 0, [sh(hc, -.25), hc, sh(hc, .15)]), ow);
    } else if (hat === 'hood') {
      g.fill(() => { c.moveTo(x0 + HW + .4, y0 + HH * .7); c.quadraticCurveTo(x0 + HW + .8, y0 - 1.4, x0 + HW * .4, y0 - 1.3); c.quadraticCurveTo(x0 - 1.4, y0 - 1, x0 - 1.2, y0 + HH + 2); c.lineTo(x0 + 2, y0 + HH + 1); c.quadraticCurveTo(x0 + 1.4, y0 + 1.6, x0 + HW - .8, y0 + 1.2); c.quadraticCurveTo(x0 + HW - .2, y0 + HH * .5, x0 + HW + .4, y0 + HH * .7); }, g.lin(x0, y0, x0 + HW, y0 + HH, [sh(hc, .1), hc, sh(hc, -.35)]), ow);
      if (L.noface) { c.fillStyle = '#030304'; c.beginPath(); c.ellipse(x0 + HW * .62, y0 + HH * .5, HW * .32, HH * .36, 0, 0, TAU); c.fill(); if (L.glow) { g.glow(ex, ey, 2.6, L.glow, .9); g.glow(ex - 2, ey, 2.2, L.glow, .7); } }
    } else if (hat === 'helm') {
      g.fill(() => { c.moveTo(x0 - .5, y0 + 2.2); c.quadraticCurveTo(x0 - .3, y0 - 1.6, x0 + HW * .5, y0 - 1.5); c.quadraticCurveTo(x0 + HW + .6, y0 - 1.4, x0 + HW + .4, y0 + 2.2); c.closePath(); }, g.lin(0, y0 - 1.5, 0, y0 + 2.2, [sh(hc, .5), hc, sh(hc, -.3)]), ow);
      g.rr(x0 + HW - .8, y0 + 1.6, .9, 2.2, .3, sh(hc, -.1), .3); g.rr(x0 - .8, y0 + 1.8, 2, 2.6, .5, sh(hc, -.2), .3);
      if (L.mark) { c.fillStyle = L.mark; c.beginPath(); c.ellipse(x0 + HW * .45, y0, .7, .6, 0, 0, TAU); c.fill(); }
    } else if (hat === 'crown') {
      g.fill(() => { c.moveTo(x0 + .2, y0 + .4); for (let i = 0; i <= 4; i++) { c.lineTo(x0 + .2 + i * (HW - .4) / 4, y0 - (i % 2 ? .4 : 2.2)); } c.lineTo(x0 + HW - .2, y0 + .4); c.closePath(); }, g.lin(0, y0 - 2, 0, y0 + .4, [sh(hc, .5), hc]), .35);
      g.ell(x0 + HW * .5, y0 - .3, .5, .5, '#e04040', 0);
    } else if (hat === 'circlet') {
      c.strokeStyle = hc; c.lineWidth = .7; c.beginPath(); c.moveTo(x0 + .3, y0 + 1.4); c.quadraticCurveTo(x0 + HW * .5, y0 + 1.1, x0 + HW - .1, y0 + 1.2); c.stroke(); g.ell(x0 + HW - .6, y0 + 1.2, .55, .55, '#ffffff', 0); g.glow(x0 + HW - .6, y0 + 1.2, 1.8, '#ffffff', .5);
    } else if (hat === 'spikehelm') {
      g.rr(x0 - .6, y0 - .8, HW + 1.2, HH + 1, 2, g.lin(0, y0, 0, y0 + HH, [sh(hc, .35), hc, sh(hc, -.35)]), ow);
      for (let i = 0; i < 4; i++) g.fill(() => { const sx = x0 - .4 + i * (HW + .8) / 3.4; c.moveTo(sx - .8, y0 - .6); c.lineTo(sx + .1 - i * .2, y0 - 3.2 - (i % 2) * 1.6 - (big ? 2.2 : 0)); c.lineTo(sx + .9, y0 - .6); }, sh(hc, -.1), .35);
      c.fillStyle = '#050506'; c.fillRect(x0 + .8, ey - .4, HW - 1, .9); g.glow(ex, ey, big ? 4 : 2.6, L.glow || '#ff4020', 1); g.glow(ex - 2.2, ey, big ? 3.4 : 2.2, L.glow || '#ff4020', .8);
    }
    // Waffe + vorderer Arm
    if (!p.hide) weapon(c, g, w, aF.h, wd, wp, B, K, wc, L, p, aB.h, ow, gt);
    g.limb([sF, aF.e, aF.h], big ? 3.4 : 2.1, sh(sleeve, -.04), ow);
    g.ell(aF.h[0], aF.h[1], big ? 1.9 : 1.15, big ? 1.9 : 1.15, skin, ow);
    if (L.fire) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const fx = cx - B.tw / 2 + ((i * 5.3) % B.tw), fy = top + ((i * 7.1) % B.th); const a = .4 + .4 * Math.sin(gt / 140 + i * 2); g.glow(fx, fy, 2.4, i % 2 ? '#ff7a1a' : '#ffb030', a); } c.restore(); }
  }
  function weapon(c, g, kind, h, d, pp, B, K, wc, L, p, hB, ow, gt) {
    const at = (a, b = 0) => [h[0] + d[0] * a + pp[0] * b, h[1] + d[1] * a + pp[1] * b];
    const big = K > 1, s = K;
    const metal = (x, y, x2, y2) => g.lin(x, y, x2, y2, [sh(wc, .5), wc, sh(wc, -.3)]);
    if (kind === 'sword' || kind === 'dagger' || kind === 'pan') {
      if (kind === 'pan') { const e = at(5 * s); g.limb([h, e], .8 * s, '#4a3a2a', ow); g.ell(...at(7.3 * s), 2.6 * s, 2.2 * s, g.rad(...at(7 * s), 2.6 * s, [sh(wc, .35), wc]), ow); return; }
      const len = (kind === 'dagger' ? 6 : 10.5) * s, wid = (kind === 'dagger' ? .9 : 1.1) * s;
      const a = at(1, -wid / 2), b = at(len - 1.2, -wid / 2), tip = at(len), c2 = at(len - 1.2, wid / 2), e = at(1, wid / 2);
      g.fill(() => { c.moveTo(...a); c.lineTo(...b); c.lineTo(...tip); c.lineTo(...c2); c.lineTo(...e); c.closePath(); }, metal(...a, ...e), ow * .8);
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .3; c.beginPath(); c.moveTo(...at(1.4, -.1)); c.lineTo(...at(len - 1.4, -.1)); c.stroke();
      g.limb([at(.4, -2 * s), at(.4, 2 * s)], .9 * s, '#b8903a', ow * .8); g.limb([at(-.2), at(-1.8 * s)], .9 * s, '#5a3a22', ow * .8); g.ell(...at(-2.2 * s), .7 * s, .7 * s, '#d8b04a', .25);
      if (L.glowC && kind === 'sword' && p.glow > .8) g.glow(...at(len * .6), 4 * s, L.glowC, .5);
    } else if (kind === 'axe' || kind === 'hammer' || kind === 'mace' || kind === 'club') {
      const len = (kind === 'club' ? 12 : 9.5) * s;
      if (kind === 'club') { g.limb([at(-1.5), at(len)], 1.5 * s, wc, ow); g.limb([at(len * .55), at(len + .5)], 3 * s, sh(wc, -.1), ow); for (let i = 0; i < 3; i++) g.ell(...at(len * .6 + i * 1.6 * s, (i % 2 ? 1.2 : -1.2) * s), .5 * s, .5 * s, sh(wc, -.35), 0); return; }
      g.limb([at(-2.2), at(len)], 1 * s, '#6a4a2a', ow);
      if (kind === 'axe') g.fill(() => { c.moveTo(...at(len - 3.4 * s, .3)); c.quadraticCurveTo(...at(len - 4 * s, -4.4 * s), ...at(len - 1.6 * s, -4.6 * s)); c.quadraticCurveTo(...at(len + 1.2 * s, -2.4 * s), ...at(len + .2, .3)); c.closePath(); }, metal(...at(len - 3 * s), ...at(len, -4 * s)), ow);
      if (kind === 'hammer') g.fill(() => { c.moveTo(...at(len - 2.2 * s, -2.4 * s)); c.lineTo(...at(len + .8 * s, -2.4 * s)); c.lineTo(...at(len + .8 * s, 2.4 * s)); c.lineTo(...at(len - 2.2 * s, 2.4 * s)); c.closePath(); }, metal(...at(len - 2 * s, -2), ...at(len, 2)), ow);
      if (kind === 'mace') { g.ell(...at(len), 1.9 * s, 1.9 * s, g.rad(...at(len), 2 * s, [sh(wc, .4), wc, sh(wc, -.3)]), ow); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; const q = at(len + Math.cos(an) * 2.6 * s, Math.sin(an) * 2.6 * s); g.ell(q[0], q[1], .5 * s, .5 * s, sh(wc, -.2), .2); } }
    } else if (kind === 'staff') {
      const len = 14 * s; g.limb([at(-5 * s), at(len)], 1 * s, g.lin(...at(-5 * s), ...at(len), [sh(wc, -.3), wc, sh(wc, .2)]), ow);
      const tip = at(len + 1 * s); const gc = L.glowC || '#fff6c0';
      g.ell(tip[0], tip[1], 1.3 * s, 1.3 * s, g.rad(tip[0], tip[1], 1.3 * s, ['#ffffff', gc]), .3);
      g.glow(tip[0], tip[1], (3 + (p.glow || 0) * 6) * s, gc, Math.min(1, .3 + (p.glow || 0) * .6));
    } else if (kind === 'spear') {
      const len = 15 * s; g.limb([at(-4 * s), at(len)], .9 * s, '#7a5a3a', ow);
      g.fill(() => { c.moveTo(...at(len, -1.1 * s)); c.lineTo(...at(len + 4 * s)); c.lineTo(...at(len, 1.1 * s)); c.closePath(); }, metal(...at(len), ...at(len + 4)), ow);
    } else if (kind === 'bow') {
      const len = 9 * s, tip1 = at(-len), tip2 = at(len), mid = at(0, 3.2 * s);
      c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 1.6 * s; c.beginPath(); c.moveTo(...tip1); c.quadraticCurveTo(...at(-len * .3, 5 * s), ...at(0, 2)); c.quadraticCurveTo(...at(len * .3, 5 * s), ...tip2); c.stroke();
      c.strokeStyle = g.lin(...tip1, ...tip2, [sh(wc, -.2), sh(wc, .25), sh(wc, -.2)]); c.lineWidth = .8 * s; c.stroke();
      const sp = p.draw > 0 ? hB : at(0, -.2);
      c.strokeStyle = 'rgba(240,232,214,.9)'; c.lineWidth = .3; c.beginPath(); c.moveTo(...tip1); c.lineTo(...sp); c.lineTo(...tip2); c.stroke();
      if (p.draw > 0) { g.limb([sp, at(0, 4 * s)], .45, '#d8c8a0', .2); g.fill(() => { const t = at(0, 4.8 * s); c.moveTo(...at(-.6, 3.8 * s)); c.lineTo(...t); c.lineTo(...at(.6, 3.8 * s)); }, '#d0d8e0', .2); }
    } else if (kind === 'whip') {
      c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
      for (const [wdt, col] of [[2.4 * s, 'rgba(255,90,20,.35)'], [1.1 * s, 'rgba(255,160,40,.9)'], [.4 * s, 'rgba(255,240,170,.9)']]) {
        c.strokeStyle = col; c.lineWidth = wdt; c.beginPath(); c.moveTo(...h);
        for (let i = 1; i <= 24; i++) { const q = at(i * .95 * s, Math.sin(i * .45 + gt / 110) * 2.4 * (i / 24) * s); c.lineTo(...q); } c.stroke();
      }
      c.restore();
    }
  }

  /* ---------- Vierbeiner ---------- */
  function drawQuad(c, L, anim, el, gt) {
    const g = P(c), big = L.size ? 1 : 0, bl = big ? 20 : 16, bh = big ? 8.4 : 6.6, ll = big ? 7.4 : 6.2;
    const fur = L.fur, belly = L.belly;
    let lean = 0, jaw = 0, bob = 0, ph = gt / 900 * TAU, gait = 0, fall = 0;
    if (anim === 'walk') { ph = el / 360 * TAU; gait = 1; bob = Math.abs(Math.sin(ph)) * .8; }
    else if (anim === 'attack' || anim === 'throw' || anim === 'shoot') { const k = clamp01(el / animTime('attack')); lean = Math.sin(k * Math.PI) * 5 - (k < .2 ? k * 6 : 0); jaw = clamp01(Math.sin(k * Math.PI) * 1.6 - .3); }
    else if (anim === 'shout') { const k = clamp01(el / animTime('shout')); jaw = Math.sin(k * Math.PI); bob = -Math.sin(k * Math.PI) * 1.4; }
    else if (anim === 'hurt') lean = -2 * (1 - clamp01(el / 300));
    else if (anim === 'dead') fall = ease(clamp01(el / 600));
    else bob = (Math.sin(ph) + 1) * .3;
    if (fall) { c.save(); c.translate(0, -bh); c.scale(1, 1 - 2 * fall); c.translate(0, bh + (fall > .5 ? -ll * .4 : 0)); }
    const by = -ll - bh / 2 + bob, bx = lean;
    // Schwanz
    c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 2.4; const tx = bx - bl / 2, tw = Math.sin(gt / 240) * 1.6;
    c.beginPath(); c.moveTo(tx + 1, by - 1); c.quadraticCurveTo(tx - 4, by - 3 + tw, tx - 7, by - 1 + tw); c.stroke(); c.strokeStyle = fur; c.lineWidth = 1.5; c.stroke();
    const leg = (x, off, far) => { const a = gait ? Math.sin(ph + off) * .55 : 0, lift = gait ? Math.max(0, Math.cos(ph + off)) * 1.4 : 0; const hip = [x, by + bh * .3], foot = [x + Math.sin(a) * 3.2, -.6 - lift], knee = [(hip[0] + foot[0]) / 2 + (off % 2 ? -.8 : .8), (hip[1] + foot[1]) / 2]; g.limb([hip, knee, foot], big ? 2.2 : 1.8, far ? sh(fur, -.35) : sh(fur, -.1)); };
    leg(bx - bl / 2 + 3, Math.PI, 1); leg(bx + bl / 2 - 3, 0, 1);
    g.ell(bx, by, bl / 2, bh / 2, g.lin(0, by - bh / 2, 0, by + bh / 2, [sh(fur, .12), fur, belly]));
    if (L.mane) g.ell(bx + bl / 2 - 3.5, by - 1.4, 4.4, 3.6, sh(fur, -.3), .35);
    leg(bx - bl / 2 + 4.5, 0, 0); leg(bx + bl / 2 - 1.5, Math.PI, 0);
    // Kopf
    const hx = bx + bl / 2 + 1.5 + lean * .3, hy = by - bh / 2 - 1 + jaw * .5;
    g.fill(() => { c.moveTo(hx - 3, hy - 2.2); c.lineTo(hx - 2.2, hy - 5); c.lineTo(hx - .6, hy - 2.4); }, sh(fur, -.15), .35);
    g.fill(() => { c.moveTo(hx - 1, hy - 2.6); c.lineTo(hx + .2, hy - 5.2); c.lineTo(hx + 1.2, hy - 2.2); }, fur, .35);
    g.ell(hx, hy, 3.6, 2.9, g.lin(0, hy - 3, 0, hy + 3, [sh(fur, .1), fur, belly]));
    g.fill(() => { c.moveTo(hx + 2, hy - 1.6); c.lineTo(hx + 6.2, hy - .4); c.lineTo(hx + 6, hy + .9); c.lineTo(hx + 2, hy + 1.2); c.closePath(); }, fur, .4);
    if (jaw > .05) { g.fill(() => { c.moveTo(hx + 2, hy + 1.2); c.lineTo(hx + 5.6, hy + 1.2 + jaw * 2.2); c.lineTo(hx + 2, hy + 2.2); }, '#7a1a1a', .3); c.fillStyle = '#fff'; c.fillRect(hx + 4.4, hy + .9, .4, .7); c.fillRect(hx + 3.2, hy + 1.1, .4, .6); }
    g.ell(hx + 6, hy - .1, .6, .55, '#141010', 0);
    g.glow(hx + 1.6, hy - .8, 1.8, L.eye || '#ffd040', .7); g.ell(hx + 1.6, hy - .8, .45, .4, L.eye || '#ffd040', 0);
    if (fall) c.restore();
  }

  /* ---------- Spinnen ---------- */
  function drawSpider(c, L, anim, el, gt) {
    const g = P(c), k = L.size ? 2.2 : 1;
    let lean = 0, bob = (Math.sin(gt / 500) + 1) * .3 * k, gait = 0, ph = 0, raise = 0, fall = 0;
    if (anim === 'walk') { gait = 1; ph = el / 300 * TAU; }
    if (anim === 'attack' || anim === 'shoot' || anim === 'throw') { const q = clamp01(el / animTime('attack')); lean = (Math.sin(q * Math.PI) * 4 - (q < .25 ? q * 4 : 0)) * k * .6; raise = Math.sin(q * Math.PI); }
    if (anim === 'hurt') lean = -2 * (1 - clamp01(el / 300));
    if (anim === 'dead') fall = ease(clamp01(el / 600));
    if (fall) { c.save(); c.translate(0, -8 * k); c.scale(1, 1 - 2 * fall); c.translate(0, 8 * k); }
    const col = L.body, legC = sh(col, -.15);
    const legs = (far) => {
      for (let i = 0; i < 4; i++) {
        const ox = lean + (i - 1.5) * 2.2 * k, oy = -7 * k + bob, off = i * 1.3 + (far ? Math.PI : 0);
        const sw = gait ? Math.sin(ph + off) * 1.6 * k : Math.sin(gt / 700 + i) * .3 * k;
        const up = !far && i === 3 ? raise * 7 * k : 0;
        const knee = [ox + (i - 1.5) * 3.2 * k + (far ? -1 : 1), oy - 6 * k - up];
        const foot = [ox + (i - 1.5) * 5.8 * k + sw + up * .8, up ? oy - 8 * k : -.4 - (gait ? Math.max(0, Math.cos(ph + off)) * 1.2 * k : 0)];
        g.limb([[ox, oy], knee, foot], (L.size ? 1.6 : .8), far ? sh(legC, -.35) : legC, L.size ? .6 : .35);
      }
    };
    legs(true);
    g.ell(lean - 5 * k, -10 * k + bob, 7 * k, 5.6 * k, g.rad(lean - 6 * k, -12 * k + bob, 8 * k, [sh(col, .25), col, sh(col, -.3)]), L.size ? .8 : .45);
    g.ell(lean - 5 * k, -11 * k + bob, 3 * k, 2 * k, L.mark, 0);
    g.ell(lean + 3 * k, -8 * k + bob, 4 * k, 3 * k, g.rad(lean + 3 * k, -9 * k, 4 * k, [sh(col, .2), col]), L.size ? .8 : .45);
    for (let i = 0; i < (L.size ? 6 : 3); i++) { const ex = lean + 5.4 * k + (i % 3) * .9 * k, ey = -9 * k + bob + Math.floor(i / 3) * 1.2 * k - .6; g.glow(ex, ey, 1.4 * k, L.eye, .6); g.ell(ex, ey, .35 * k, .35 * k, L.eye, 0); }
    if (raise > .5) { c.fillStyle = '#fff'; c.fillRect(lean + 6.8 * k, -6 * k, .5 * k, 1.2 * k); }
    legs(false);
    if (fall) c.restore();
  }

  /* ---------- Seewurm ---------- */
  function drawWorm(c, L, anim, el, gt) {
    const g = P(c);
    let raise = 0, lean = 0, open = 0;
    if (anim === 'attack' || anim === 'cast' || anim === 'shoot') { const q = clamp01(el / animTime('attack')); raise = Math.sin(q * Math.PI) * 8; lean = Math.sin(q * Math.PI) * 7; open = clamp01(Math.sin(q * Math.PI) * 1.5); }
    if (anim === 'hurt') lean = -3 * (1 - clamp01(el / 300));
    const sink = anim === 'dead' ? ease(clamp01(el / 900)) * 60 : 0;
    const pts = [];
    for (let i = 0; i < 12; i++) { const t = i / 11; pts.push([-16 + i * 2.6 + Math.sin(t * 3 + gt / 500) * 5 * (1 - t) + lean * t, -4 - i * 5.8 - raise * t + sink, 9 - i * .35]); }
    for (let i = 0; i < pts.length; i++) { const [x, y, r] = pts[i]; g.ell(x, y, r, r * .92, g.rad(x - r * .3, y - r * .3, r * 1.3, [sh(L.skin, .25), L.skin, sh(L.skin, -.35)]), .6); g.ell(x + r * .45, y + .8, r * .45, r * .55, rgba(L.belly, .8), 0); }
    const [hx, hy] = pts[pts.length - 1];
    g.ell(hx + 4, hy - 2, 7, 5.6, g.rad(hx + 3, hy - 4, 8, [sh(L.skin, .2), L.skin, sh(L.skin, -.3)]), .7);
    g.fill(() => { c.moveTo(hx + 5, hy - 1); c.lineTo(hx + 12, hy - 1 - open * 2); c.lineTo(hx + 12, hy + open * 4); c.lineTo(hx + 5, hy + 1.6); c.closePath(); }, '#3a0a0a', .5);
    c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(hx + 6 + i * 1.6, hy - 1 - open * 1.4 * (i / 3)); c.lineTo(hx + 6.8 + i * 1.6, hy + .6); c.lineTo(hx + 7.4 + i * 1.6, hy - 1 - open * 1.4 * (i / 3)); c.fill(); }
    g.glow(hx + 3, hy - 5, 2.4, L.eye, .8); g.ell(hx + 3, hy - 5, .7, .6, L.eye, 0);
    // Wasser
    c.fillStyle = g.lin(0, -8, 0, 4, ['rgba(70,140,200,.0)', 'rgba(40,100,170,.85)', 'rgba(20,60,120,.95)']); c.beginPath(); c.moveTo(-34, 4);
    for (let x = -34; x <= 30; x += 2) c.lineTo(x, -5 + Math.sin(x * .35 + gt / 260) * 1.2); c.lineTo(30, 4); c.fill();
    c.strokeStyle = 'rgba(200,230,255,.7)'; c.lineWidth = .4; c.beginPath(); for (let x = -34; x <= 30; x += 2) c[x === -34 ? 'moveTo' : 'lineTo'](x, -5 + Math.sin(x * .35 + gt / 260) * 1.2); c.stroke();
  }

  /* ---------- Olifant ---------- */
  function drawOlifant(c, L, anim, el, gt) {
    const g = P(c), sk = L.skin;
    let lean = 0, bob = (Math.sin(gt / 900) + 1) * .4, ph = 0, gait = 0, rear = 0, trunk = 0, fall = 0;
    if (anim === 'walk') { gait = 1; ph = el / 600 * TAU; bob = Math.abs(Math.sin(ph)) * 1; }
    if (anim === 'attack' || anim === 'throw') { const q = clamp01(el / animTime('attack')); rear = -Math.sin(Math.min(1, q * 2) * Math.PI) * 4; lean = q > .4 ? Math.sin((q - .4) / .6 * Math.PI) * 7 : -q * 4; trunk = Math.sin(q * Math.PI); }
    if (anim === 'hurt') lean = -3 * (1 - clamp01(el / 300));
    if (anim === 'dead') fall = ease(clamp01(el / 700));
    if (fall) { c.save(); c.rotate(-fall * .5); c.translate(-fall * 6, fall * 6); }
    const leg = (x, off, far) => { const a = gait ? Math.sin(ph + off) * 2.6 : 0; g.limb([[x + lean, -22 + bob], [x + lean + a * .5, -10], [x + lean + a, -1]], 5, far ? sh(sk, -.3) : sk, .7); g.ell(x + lean + a, -.8, 2.8, 1.2, sh(sk, -.4), .5); };
    leg(-18, Math.PI, 1); leg(10, 0, 1);
    g.ell(-4 + lean, -28 + bob + rear * .5, 24, 14, g.rad(-8 + lean, -34, 30, [sh(sk, .2), sk, sh(sk, -.35)]), .8);
    leg(-12, 0, 0); leg(16, Math.PI, 0);
    g.rr(-18 + lean, -50 + bob + rear, 20, 9, 1.5, g.lin(0, -50, 0, -41, ['#a83a32', '#7a2420']), .6);
    g.rr(-18 + lean, -50 + bob + rear, 20, 1.3, .5, '#e0b84a', 0); g.rr(-18 + lean, -42.6 + bob + rear, 20, 1.3, .5, '#e0b84a', 0);
    g.limb([[-17 + lean, -50 + bob + rear], [-17 + lean, -58 + bob + rear]], .8, '#5a3a2a', .3); g.limb([[1 + lean, -50 + bob + rear], [1 + lean, -58 + bob + rear]], .8, '#5a3a2a', .3);
    g.fill(() => { c.moveTo(-19 + lean, -58 + bob + rear); c.quadraticCurveTo(-8 + lean, -63 + bob + rear, 3 + lean, -58 + bob + rear); c.closePath(); }, '#c8a040', .5);
    const hx = 20 + lean * 1.1, hy = -34 + bob + rear;
    g.ell(hx - 6, hy, 8, 9.5, g.rad(hx - 6, hy, 10, [sh(sk, .05), sh(sk, -.25)]), .7);
    g.ell(hx, hy, 9, 9, g.rad(hx + 2, hy - 3, 11, [sh(sk, .25), sk, sh(sk, -.3)]), .8);
    g.ell(hx + 3.4, hy - 3, .9, .7, '#1a0a0a', 0);
    c.lineCap = 'round'; const tsw = Math.sin(gt / 600) * 2;
    c.strokeStyle = OL; c.lineWidth = 4.6; c.beginPath(); c.moveTo(hx + 6, hy + 3); c.quadraticCurveTo(hx + 12 + trunk * 6 + tsw, hy + 12 - trunk * 14, hx + 8 + trunk * 12 + tsw, hy + 22 - trunk * 26); c.stroke();
    c.strokeStyle = sk; c.lineWidth = 3.4; c.stroke();
    c.strokeStyle = OL; c.lineWidth = 2.2; c.beginPath(); c.moveTo(hx + 4, hy + 5); c.quadraticCurveTo(hx + 12, hy + 10, hx + 15, hy + 4); c.stroke(); c.strokeStyle = '#f0ece0'; c.lineWidth = 1.4; c.stroke();
    if (fall) c.restore();
  }

  /* ---------- Haupt-API ---------- */
  function draw(c, type, look, anim, el, gt) {
    if (type === 'quad') return drawQuad(c, look, anim, el, gt);
    if (type === 'spider') return drawSpider(c, look, anim, el, gt);
    if (type === 'worm') return drawWorm(c, look, anim, el, gt);
    if (type === 'olifant') return drawOlifant(c, look, anim, el, gt);
    const p = poseAt(anim, el, look.wpn || 'sword', gt);
    if (anim === 'dead') {
      c.save(); const f = p.fall; c.translate(-f * 3, -f * 2.2); c.rotate(-Math.PI / 2 * f); drawHum(c, look, p, gt); c.restore();
    } else drawHum(c, look, p, gt);
  }
  // In ein HTML-Canvas zeichnen (Porträt oder Ganzkörper)
  function toCanvas(cv, type, look, o = {}) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || cv.width, H = cv.clientHeight || cv.height;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const c = cv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
    const D = dims(type, look);
    if (o.portrait && type === 'hum') {
      const B = BODY[look.body] || BODY.man, sc = cv.height / (B.hh * 2.5);
      const headY = -B.ll - B.th - B.hh / 2 + (B.hunch ? 1 : 0);
      c.setTransform(sc, 0, 0, sc, cv.width / 2 - (.6 + (B.hunch || 0)) * sc, cv.height / 2 - headY * sc + sc * .6);
    } else {
      const span = Math.max(D.h + 10, (D.w + 14) * cv.height / cv.width * 1.1), sc = cv.height / span;
      c.setTransform(o.flip ? -sc : sc, 0, 0, sc, cv.width / 2, cv.height - sc * 3);
    }
    draw(c, type, look, o.anim || 'idle', o.el || 0, o.gt ?? 400);
  }

  /* ---------- Gemalte Hintergründe ---------- */
  const bgCache = new Map();
  function rng(seed) { let s = 0; for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function background(key, W, H) {
    const ck = key + W + 'x' + H; if (bgCache.has(ck)) return bgCache.get(ck);
    const T = BACKGROUNDS[key] || BACKGROUNDS.shire, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), g = P(c), R = rng(key), HZ = 90;
    c.scale(W / 256, H / 144);
    const sky = c.createLinearGradient(0, 0, 0, HZ); T.sky.forEach((s, i) => sky.addColorStop(i / (T.sky.length - 1), s)); c.fillStyle = sky; c.fillRect(0, 0, 256, HZ + 2);
    if (T.stars || T.moon) for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(255,255,255,${.3 + R() * .7})`; c.beginPath(); c.arc(R() * 256, R() * 55, R() * .45 + .15, 0, TAU); c.fill(); }
    if (T.sun) { g.glow(206, 26, 40, T.sun, .55); g.ell(206, 26, 8, 8, g.rad(204, 24, 9, ['#ffffff', T.sun]), 0); }
    if (T.moon) { g.glow(48, 22, 26, T.moon, .35); g.ell(48, 22, 6.5, 6.5, g.rad(46, 20, 7, ['#ffffff', T.moon]), 0); }
    const ridge = (base, amp, fr, ph, col, col2, snow) => {
      c.beginPath(); c.moveTo(0, HZ + 4);
      for (let x = 0; x <= 256; x += 2) c.lineTo(x, base - (Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 2.6 + ph * 1.7) * amp * .45 + Math.sin(x * fr * 6 + ph) * amp * .12));
      c.lineTo(256, HZ + 4); c.closePath(); c.fillStyle = g.lin(0, base - amp * 1.5, 0, HZ, [col, col2]); c.fill();
      if (snow) { c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, 0, 256, base - amp * .9); c.restore(); }
    };
    const snowy = ['weather', 'snow', 'amonhen', 'helm', 'rhun', 'khazad'].includes(key);
    ridge(62, 12, .028, R() * 9, sh(T.far, .12), T.sky[T.sky.length - 1], snowy);
    if (key === 'doom') { g.fill(() => { c.moveTo(80, HZ); c.lineTo(122, 20); c.lineTo(134, 20); c.lineTo(176, HZ); }, g.lin(0, 20, 0, HZ, ['#3a120a', '#1a0806']), 0); g.glow(128, 20, 30, '#ff5a1a', .8); c.strokeStyle = '#ff8a2a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(128, 22); c.bezierCurveTo(124, 40, 136, 55, 128, 78); c.stroke(); }
    c.fillStyle = g.lin(0, 50, 0, HZ, ['rgba(255,255,255,0)', rgba(T.sky[T.sky.length - 1], .55)]); c.fillRect(0, 50, 256, HZ - 50);
    ridge(78, 6, .045, R() * 9, sh(T.mid, .1), sh(T.mid, -.15), false);
    props(c, g, key, T, R, HZ);
    // Boden
    c.fillStyle = g.lin(0, HZ, 0, 144, [sh(T.ground, .1), T.ground, T.gd]); c.fillRect(0, HZ, 256, 144 - HZ);
    for (let i = 0; i < 260; i++) { const x = R() * 256, y = HZ + 2 + R() * 52; c.fillStyle = R() < .5 ? rgba(sh(T.gd, -.2), .35) : rgba(sh(T.ground, .25), .3); c.beginPath(); c.ellipse(x, y, .6 + R() * 2.4 * (y - HZ) / 54, .3 + R() * .5, 0, 0, TAU); c.fill(); }
    if (['shire', 'amonhen', 'eregion', 'rhun', 'weather', 'south'].includes(key)) { c.strokeStyle = rgba(sh(T.ground, .35), .7); c.lineWidth = .35; for (let i = 0; i < 160; i++) { const x = R() * 256, y = HZ + 3 + R() * 52, h = 1 + (y - HZ) / 25; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + .5, y - h * .6, x + .9 + R(), y - h); c.stroke(); } }
    if (key === 'sea') { c.strokeStyle = 'rgba(40,24,12,.6)'; c.lineWidth = .4; for (let y = HZ + 6; y < 144; y += 7) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); } }
    if (T.lava) for (let i = 0; i < 4; i++) { const x = 20 + R() * 220, y = 118 + R() * 20; g.glow(x, y, 16, '#ff5a1a', .55); g.ell(x, y, 11 + R() * 6, 2.4, g.lin(x - 10, 0, x + 10, 0, ['#a82a0a', '#ffb040', '#a82a0a']), 0); }
    const vg = c.createRadialGradient(128, 80, 60, 128, 80, 170); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); c.fillStyle = vg; c.fillRect(0, 0, 256, 144);
    bgCache.set(ck, cv); if (bgCache.size > 12) bgCache.delete(bgCache.keys().next().value);
    return cv;
  }
  function tree(g, c, x, y, s, col) { g.limb([[x, y], [x, y - s]], s * .22, '#4a3020', .3); for (let i = 0; i < 3; i++) g.ell(x + (i - 1) * s * .35, y - s - s * .35 - (i === 1 ? s * .25 : 0), s * .55, s * .5, g.rad(x - s * .3, y - s * 1.6, s * 1.2, [sh(col, .25), col, sh(col, -.25)]), .3); }
  function pine(g, c, x, y, s, col) { g.limb([[x, y], [x, y - 3]], 1, '#3a2a1a', .2); for (let i = 0; i < 3; i++) g.fill(() => { c.moveTo(x - s * (.5 - i * .12), y - 2 - i * s * .28); c.lineTo(x, y - 2 - s * (.55 + i * .28)); c.lineTo(x + s * (.5 - i * .12), y - 2 - i * s * .28); c.closePath(); }, g.lin(x - s / 2, 0, x + s / 2, 0, [sh(col, -.25), col, sh(col, .15)]), .3); }
  function props(c, g, key, T, R, HZ) {
    if (key === 'shire') { g.ell(60, HZ + 2, 40, 16, g.lin(0, HZ - 14, 0, HZ + 10, [sh(T.mid, .2), T.mid]), 0); g.ell(60, HZ - 2, 6.6, 6.6, '#2e6a3a', .5); g.ell(60, HZ - 2, 5.2, 5.2, '#3a8a4a', 0); g.ell(61.5, HZ - 2, .8, .8, '#e8c040', 0); c.strokeStyle = '#7a5a3a'; c.lineWidth = .8; c.beginPath(); c.moveTo(150, HZ - 2); c.lineTo(250, HZ - 2); c.stroke(); for (let x = 150; x < 250; x += 6) { c.beginPath(); c.moveTo(x, HZ - 4); c.lineTo(x, HZ + 1); c.stroke(); } tree(g, c, 120, HZ, 8, '#3a7a32'); tree(g, c, 230, HZ - 4, 9, '#2e6a2a'); tree(g, c, 20, HZ - 2, 7, '#3a7a32'); }
    else if (key === 'weather') { g.ell(180, HZ - 4, 52, 22, g.lin(0, HZ - 26, 0, HZ, [sh(T.mid, .1), T.mid]), 0); for (let i = 0; i < 6; i++) { const x = 150 + i * 11, h = 8 + (i * 7) % 12; g.rr(x, HZ - 18 - h, 4, h, .5, g.lin(x, 0, x + 4, 0, ['#5a5a58', '#8a8a86']), .3); } }
    else if (key === 'moria' || key === 'khazad') { for (const x of [14, 62, 186, 234]) { g.rr(x, -2, 12, HZ + 6, 1, g.lin(x, 0, x + 12, 0, key === 'khazad' ? ['#2a3240', '#4e5868', '#2a3240'] : ['#1a1616', '#3a3434', '#1a1616']), .4); g.rr(x - 3, HZ - 2, 18, 6, 1, key === 'khazad' ? '#46505e' : '#322c2a', .3); } if (key === 'khazad') for (const x of [40, 130, 210]) { g.glow(x, 28, 14, '#7ae0ff', .7); g.ell(x, 28, 2, 2, '#c8f4ff', 0); } else g.glow(128, HZ, 60, '#ff5a1a', .5); }
    else if (key === 'amonhen') { for (let i = 0; i < 14; i++) pine(g, c, 6 + i * 19 + R() * 6, HZ + 2, 14 + R() * 10, i % 2 ? '#1e4a2a' : '#245a32'); g.rr(124, HZ - 22, 8, 22, 1, g.lin(124, 0, 132, 0, ['#6a6a62', '#9a9a92']), .3); }
    else if (key === 'helm') { g.rr(-2, HZ - 26, 260, 26, 0, g.lin(0, HZ - 26, 0, HZ, ['#6a6a66', '#4a4a46']), .3); for (let x = 0; x < 256; x += 8) g.rr(x, HZ - 30, 4, 5, .3, '#62625e', .2); g.rr(190, HZ - 54, 30, 54, 1, g.lin(190, 0, 220, 0, ['#5a5a56', '#7a7a74']), .4); g.glow(204, HZ - 36, 8, '#ffb050', .7); }
    else if (key === 'cirith') { c.strokeStyle = 'rgba(220,220,240,.25)'; c.lineWidth = .3; for (let i = 0; i < 4; i++) { const ox = i < 2 ? 0 : 256, oy = i % 2 ? 0 : 30; for (let j = 0; j < 7; j++) { c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(ox + (i < 2 ? 1 : -1) * (10 + j * 5), oy + 30, ox + (i < 2 ? 1 : -1) * (20 + j * 10), oy + 40 - j * 6); c.stroke(); } } g.fill(() => { c.moveTo(150, HZ); c.lineTo(172, 28); c.lineTo(180, 28); c.lineTo(200, HZ); }, '#1a1222', 0); g.glow(176, 36, 6, '#ff5a3a', .9); }
    else if (key === 'pelennor' || key === 'eregion') { const col = key === 'pelennor' ? '#e0dcd0' : '#c8b8a0'; for (let i = 0; i < 6; i++) g.rr(20 + i * 6, HZ - 14 - i * 7, 60 - i * 12, 7, .6, g.lin(0, 0, 0, 7, [col, sh(col, -.25)]), .3); g.rr(46, HZ - 62, 4, 14, .5, '#f8f4ea', .3); if (key === 'pelennor') for (let i = 0; i < 4; i++) { const x = 120 + i * 35; g.glow(x, HZ - 4, 10, '#ff7a2a', .7); c.fillStyle = 'rgba(40,32,30,.45)'; c.beginPath(); c.moveTo(x - 2, HZ - 4); c.bezierCurveTo(x - 8, HZ - 30, x + 8, HZ - 50, x - 4, HZ - 80); c.lineTo(x + 6, HZ - 80); c.bezierCurveTo(x + 14, HZ - 50, x + 4, HZ - 30, x + 3, HZ - 4); c.fill(); } else { for (let i = 0; i < 6; i++) tree(g, c, 120 + i * 24, HZ, 7, '#1e4a2a'); g.glow(230, HZ - 6, 14, '#ff8a2a', .8); } }
    else if (key === 'doom') { for (let i = 0; i < 6; i++) g.fill(() => { c.moveTo(i * 48, HZ); c.lineTo(i * 48 + 20, HZ - 14 - R() * 10); c.lineTo(i * 48 + 44, HZ); }, '#1a0a08', 0); }
    else if (key === 'snow') { for (let i = 0; i < 8; i++) { const x = 10 + i * 34 + R() * 10, h = 10 + R() * 18; g.fill(() => { c.moveTo(x, HZ + 2); c.lineTo(x + 4, HZ - h); c.lineTo(x + 9, HZ + 2); }, g.lin(x, 0, x + 9, 0, ['#e0f4ff', '#8ac0e8']), .3); } }
    else if (key === 'sea') { c.fillStyle = g.lin(0, 62, 0, HZ, ['#4a7aa8', '#1e4a7a']); c.fillRect(0, 64, 256, HZ - 64); c.strokeStyle = 'rgba(200,230,255,.35)'; c.lineWidth = .4; for (let i = 0; i < 40; i++) { const x = R() * 256, y = 66 + R() * 22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3 + R() * 4, y); c.stroke(); } g.limb([[200, 70], [200, 40]], 1.2, '#5a3a22', .3); g.fill(() => { c.moveTo(201, 42); c.quadraticCurveTo(214, 50, 201, 62); c.lineTo(222, 60); c.quadraticCurveTo(216, 50, 201, 42); }, '#ece4d4', .3); }
    else if (key === 'south') { g.rr(30, HZ - 30, 40, 30, 1, g.lin(0, HZ - 30, 0, HZ, ['#a8865e', '#7a5a3a']), .3); g.rr(170, HZ - 40, 14, 40, 1, '#7a5a3a', .3); g.rr(168, HZ - 44, 18, 4, .5, '#8a6a4a', .3); }
    else if (key === 'rhun') { for (let i = 0; i < 5; i++) { const x = 20 + i * 52; g.rr(x, HZ - 10 - (i % 3) * 4, 5, 10 + (i % 3) * 4, 1, g.lin(x, 0, x + 5, 0, ['#5a4a5a', '#7a6a7a']), .3); } }
  }

  /* ---------- Item-Icons ---------- */
  function icon(cv, kind, col) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 40; cv.width = Math.round(W * dpr); cv.height = cv.width;
    const c = cv.getContext('2d'), g = P(c); c.setTransform(cv.width / 16, 0, 0, cv.width / 16, 0, 0); c.clearRect(0, 0, 16, 16);
    c.fillStyle = g.rad(8, 8, 10, [rgba(col, .35), 'rgba(0,0,0,0)']); c.fillRect(0, 0, 16, 16);
    const metal = g.lin(3, 3, 13, 13, ['#ffffff', '#c8d0d8', '#7a8490']), wood = '#8a5a30';
    if (kind === 'sword') { g.fill(() => { c.moveTo(3.2, 12); c.lineTo(12, 2.6); c.lineTo(13.4, 2.6); c.lineTo(13.4, 4); c.lineTo(4.6, 12.8); c.closePath(); }, metal, .4); g.limb([[2.2, 10.2], [5.8, 13.8]], 1, '#c8a040', .3); g.limb([[3.2, 13], [1.6, 14.6]], 1.1, '#5a3a22', .3); }
    else if (kind === 'bow') { c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(9, 1.5); c.quadraticCurveTo(2, 8, 9, 14.5); c.stroke(); c.strokeStyle = wood; c.lineWidth = 1.1; c.stroke(); c.strokeStyle = '#eee'; c.lineWidth = .3; c.beginPath(); c.moveTo(9, 1.5); c.lineTo(9, 14.5); c.stroke(); g.limb([[4, 8], [14, 8]], .6, '#d8c8a0', .25); }
    else if (kind === 'axe') { g.limb([[3.5, 14], [11, 3]], 1.2, wood, .35); g.fill(() => { c.moveTo(8.6, 3); c.quadraticCurveTo(10, -0.6, 14.6, 2.6); c.quadraticCurveTo(14, 7, 12.4, 8.2); c.closePath(); }, metal, .4); }
    else if (kind === 'staff') { g.limb([[3.5, 14.5], [11, 3.5]], 1.2, wood, .35); g.glow(12, 3, 5, col, .9); g.ell(12, 3, 1.8, 1.8, g.rad(12, 3, 2, ['#fff', col]), .3); }
    else if (kind === 'spear') { g.limb([[2, 14.5], [11.5, 4.5]], .9, wood, .3); g.fill(() => { c.moveTo(10.2, 3.6); c.lineTo(14.6, 1.2); c.lineTo(12.6, 5.8); c.closePath(); }, metal, .35); }
    else if (kind === 'armor') { g.fill(() => { c.moveTo(4, 3); c.lineTo(12, 3); c.lineTo(14.5, 5); c.lineTo(13, 7.5); c.lineTo(12, 7); c.lineTo(12, 13.5); c.quadraticCurveTo(8, 14.8, 4, 13.5); c.lineTo(4, 7); c.lineTo(3, 7.5); c.lineTo(1.5, 5); c.closePath(); }, metal, .45); g.ell(8, 9.5, 1.3, 1.3, col, .3); g.fill(() => { c.moveTo(6, 3); c.quadraticCurveTo(8, 5.4, 10, 3); }, '#3a3a40', 0); }
    else if (kind === 'ring') { c.lineWidth = 2.2; c.strokeStyle = OL; c.beginPath(); c.ellipse(8, 9.5, 4.2, 4, 0, 0, TAU); c.stroke(); c.lineWidth = 1.4; c.strokeStyle = g.lin(4, 6, 12, 13, ['#fff3b0', '#e0b040', '#8a6010']); c.stroke(); g.glow(8, 4.6, 4, col, .9); g.ell(8, 4.6, 1.8, 1.8, g.rad(7.4, 4, 2, ['#fff', col]), .35); }
  }

  return { draw, toCanvas, dims, ANIMS, impactTime, animTime, background, icon, BODY, sh, rgba, ease, easeOut, P };
})();
