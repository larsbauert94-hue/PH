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
    man: { hw: 3.7, hh: 4.3, nk: 1.2, tw: 7, th: 11, ll: 14.5, al: 12.5, lw: 2.6 },
    slim: { hw: 3.5, hh: 4.1, nk: 1.3, tw: 5.8, th: 10.4, ll: 14.6, al: 12, lw: 2.2 },
    elf: { hw: 3.6, hh: 4.2, nk: 1.3, tw: 6.2, th: 11.2, ll: 15.8, al: 13, lw: 2.3 },
    hobbit: { hw: 3.9, hh: 4.3, nk: .9, tw: 6.2, th: 7.6, ll: 7.6, al: 8.4, lw: 2.3, feet: 1 },
    dwarf: { hw: 4.3, hh: 4.6, nk: .5, tw: 9, th: 8.8, ll: 7, al: 8.8, lw: 3.2 },
    orc: { hw: 4, hh: 4.5, nk: .8, tw: 7.6, th: 9.4, ll: 10.5, al: 11, lw: 2.6, hunch: 1.2 },
    goblin: { hw: 3.8, hh: 4.3, nk: .6, tw: 6.2, th: 7.2, ll: 7.6, al: 8.8, lw: 2.1, hunch: 1.4 },
    uruk: { hw: 4, hh: 4.7, nk: 1, tw: 9.2, th: 12, ll: 13.5, al: 12.5, lw: 3.2 },
    troll: { hw: 8, hh: 8, nk: 1, tw: 17, th: 17, ll: 13, al: 16, lw: 5.4, big: 1, hunch: 2.5 },
    ent: { hw: 7, hh: 9, nk: 2, tw: 12, th: 22, ll: 15, al: 16, lw: 4.2, big: 1 },
    giant: { hw: 8, hh: 8.5, nk: 1.5, tw: 16, th: 19, ll: 16, al: 17, lw: 5.2, big: 1 }
  };
  function dims(type, look) {
    if (type === 'hum' && look.mount) { const B = BODY[look.body] || BODY.man; return { h: -MOUNT_SADDLE[look.mount.kind] * (look.mount.kind === 'fell' ? 1 : .86) + B.th + B.nk + B.hh + 2, big: 0, w: 13 }; }
    if (type === 'hum') { const B = BODY[look.body] || BODY.man; return { h: B.ll + B.th + B.nk + B.hh + 2, big: !!B.big, w: B.big ? 20 : 8 }; }
    if (type === 'quad') return look.huge ? { h: 34, big: 1, w: 22 } : { h: look.size ? 18 : 15, big: 0, w: look.size ? 12 : 10 };
    if (type === 'spider') return look.size ? { h: 30, big: 1, w: 22 } : { h: 14, big: 0, w: 10 };
    if (type === 'worm') return { h: 70, big: 1, w: 18 };
    if (type === 'dragon') return { h: 50, big: 1, w: 30 };
    return { h: 58, big: 1, w: 26 };
  }

  /* ---------- Zeichenhilfen ---------- */
  const OL = 'rgba(16,10,18,.62)';
  function P(c) {
    const o = {
      fill(build, fill, ow = .45) { c.beginPath(); build(); c.fillStyle = fill; c.fill(); if (ow) { c.lineWidth = ow; c.strokeStyle = OL; c.stroke(); } },
      limb(pts, w, col, ow = .45) { c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); if (ow) { c.strokeStyle = OL; c.lineWidth = w + ow * 2; c.stroke(); } c.strokeStyle = col; c.lineWidth = w; c.stroke(); },
      ell(x, y, rx, ry, fill, ow = .45, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot, 0, TAU); c.fillStyle = fill; c.fill(); if (ow) { c.lineWidth = ow; c.strokeStyle = OL; c.stroke(); } },
      rr(x, y, w, h, r, fill, ow = .45) { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fillStyle = fill; c.fill(); if (ow) { c.lineWidth = ow; c.strokeStyle = OL; c.stroke(); } },
      lin(x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; },
      rad(x, y, r, stops) { const g = c.createRadialGradient(x, y, 0, x, y, r); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; },
      taper(pts, ws, col, ow = .4) {
        const n = pts.length, A = pts[0], Z = pts[n - 1]; let dx = Z[0] - A[0], dy = Z[1] - A[1]; const Ln = Math.hypot(dx, dy) || 1; let nx = -dy / Ln, ny = dx / Ln; if (nx - ny * .4 < 0) { nx = -nx; ny = -ny; }
        const mw = Math.max(...ws) * .6, mx = (A[0] + Z[0]) / 2, my = (A[1] + Z[1]) / 2;
        const shape = (ex) => { for (let i = 0; i < n - 1; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], ddx = x1 - x0, ddy = y1 - y0, L = Math.hypot(ddx, ddy) || 1, qx = -ddy / L, qy = ddx / L, r0 = ws[i] / 2 + ex, r1 = ws[i + 1] / 2 + ex; c.beginPath(); c.moveTo(x0 + qx * r0, y0 + qy * r0); c.lineTo(x1 + qx * r1, y1 + qy * r1); c.lineTo(x1 - qx * r1, y1 - qy * r1); c.lineTo(x0 - qx * r0, y0 - qy * r0); c.closePath(); c.fill(); } for (let i = 0; i < n; i++) { c.beginPath(); c.arc(pts[i][0], pts[i][1], ws[i] / 2 + ex, 0, TAU); c.fill(); } };
        if (ow) { c.fillStyle = OL; shape(ow); }
        c.fillStyle = o.lin(mx + nx * mw, my + ny * mw, mx - nx * mw, my - ny * mw, [sh(col, .2), col, sh(col, -.32)]); shape(0);
      },
      glow(x, y, r, col, a = .8) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = o.rad(x, y, r, [rgba(col, a), rgba(col, a * .35), rgba(col, 0)]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); }
    };
    return o;
  }
  const dir = a => [Math.cos(a), Math.sin(a)];

  /* ---------- Menschenähnliche Figuren ---------- */
  function drawHum(c, L, p, gt) {
    const B = BODY[L.body] || BODY.man, big = !!B.big, K = big ? 1.7 : 1, g = P(c);
    const skin = L.skin || '#d8a880', tunic = L.tunic || '#6a5a4a', pants = L.pants || sh(tunic, -.35), boots = L.boots || '#2a2018';
    const hair = L.hair || '#3a2a1a', bc = L.bc || hair, wc = L.wc || '#c8d0d8', ow = big ? .5 : .3;
    const w = L.wpn || 'sword';
    const bob = p.bob || 0, cr = (p.crouch || 0), lean = p.lean || 0;
    const hipY = -B.ll + bob + cr, cx = lean * .8;
    const top = hipY - B.th, hunch = B.hunch || 0;
    const tilt = lean * .03;
    const hk = B.hh / 6.2, nk = B.nk || 1, hxC = cx + .45 + hunch * .8 + lean * .25, chinY = top - nk + Math.min(hunch, 1.2) * .8 + .35;
    const sF = [cx + B.tw / 2 - 1.1 + lean * .15, top + 1.3 + (big ? 1 : 0)], sB = [cx - B.tw / 2 + 1.1, top + 1.3];
    const sleeve = L.armor && big ? L.armor : tunic;

    if (L.aura) { g.glow(cx, top + B.th * .3, B.th * 2.2, L.aura, .35 + Math.sin(gt / 600) * .08); }
    const acc = L.acc || [];
    if (acc.includes('quiver')) { c.save(); c.translate(cx - B.tw / 2 + .4, top + 2); c.rotate(.42); g.rr(-1.3, -2.5, 2.8, B.th * .95, 1, g.lin(-1.3, 0, 1.5, 0, ['#4a2e18', '#7a4e2a', '#4a2e18']), .4); for (let i = 0; i < 4; i++) { g.limb([[-.8 + i * .6, -2.4], [-.8 + i * .6, -4.6]], .35, '#d8c8a0', 0); g.fill(() => { c.moveTo(-1.1 + i * .6, -4.4); c.lineTo(-.8 + i * .6, -5.8); c.lineTo(-.5 + i * .6, -4.4); }, i % 2 ? '#e8e0d0' : '#a83a2a', 0); } c.restore(); }
    if (acc.includes('knives')) for (const d of [-1, 1]) { c.save(); c.translate(cx - B.tw / 2 + 1.2, top + 1.6); c.rotate(-.55 + d * .32); g.rr(-.45, -5.6, .9, 3.4, .3, '#6a4a2a', .3); g.fill(() => { c.moveTo(-.55, -2.3); c.lineTo(.55, -2.3); c.lineTo(.2, 2.6); c.lineTo(-.2, 2.6); c.closePath(); }, g.lin(-.5, 0, .5, 0, ['#9aa4ae', '#f0f4f8']), .25); c.restore(); }
    if (acc.includes('pack')) { g.rr(cx - B.tw / 2 - 3.2, top + .4, 4.2, B.th * .8, 1.2, g.lin(cx - 4, 0, cx, 0, ['#5a3e22', '#8a6a3e']), .45); g.ell(cx - B.tw / 2 - 1.2, top - .1, 2.4, 1.1, '#8a3a2a', .35); g.ell(cx - B.tw / 2 - 2.8, top + B.th * .55, 1.1, 1.1, '#3a3a3a', .3); }
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
      c.save(); c.lineCap = 'round'; for (let i = 0; i < 3; i++) { const fx = sB[0] - .2 - i * 1.15; c.strokeStyle = rgba(sh(L.cape, -.55), .42); c.lineWidth = .38; c.beginPath(); c.moveTo(fx + .7, top + 2 + i); c.quadraticCurveTo(fx - .5 - sway * .2, (top + bot) / 2 + i, fx - 1.1 - sway * (.5 + i * .25), bot - 1.1 - i * .25); c.stroke(); c.strokeStyle = rgba(sh(L.cape, .35), .22); c.lineWidth = .2; c.beginPath(); c.moveTo(fx + 1.1, top + 2.4 + i); c.quadraticCurveTo(fx - .1 - sway * .2, (top + bot) / 2 + i, fx - .6 - sway * (.5 + i * .25), bot - 1 - i * .25); c.stroke(); } c.restore();
    }
    // hinterer Arm
    const arm = (s, a, len) => { const e = [s[0] + Math.cos(a + .35) * len * .52, s[1] + Math.sin(a + .35) * len * .52]; const h = [e[0] + Math.cos(a - .2) * len * .52, e[1] + Math.sin(a - .2) * len * .52]; return { e, h }; };
    const aF = arm(sF, p.aF, B.al);
    const wd = dir(p.wa), wp = [-Math.sin(p.wa), Math.cos(p.wa)];
    let aB = arm(sB, p.aB, B.al);
    if (w === 'bow' && p.draw > 0) { const hh = [aF.h[0] - wp[0] * (1.5 + p.draw * 6.5), aF.h[1] - wp[1] * (1.5 + p.draw * 6.5)]; aB = { e: [(sB[0] + hh[0]) / 2 - .3, (sB[1] + hh[1]) / 2 + 1.4], h: hh }; }
    g.taper([sB, aB.e, aB.h], [B.lw * .9, B.lw * .66, B.lw * .48], sh(sleeve, -.3), ow * .8);
    g.ell(aB.h[0], aB.h[1], B.lw * .36, B.lw * .4, sh(skin, -.25), ow * .8);
    // Beine
    const legs = (front) => {
      if (L.seated) { if (!front) return; const hx = cx + .2, kn = [hx + B.ll * .42, hipY + B.ll * .16], ft = [hx + B.ll * .34, hipY + B.ll * .62];
        g.taper([[hx, hipY], kn, ft], [B.lw * 1.3, B.lw * .86, B.lw * .58], pants, ow * .8);
        if (B.feet) g.ell(ft[0] + .9, ft[1] + .3, 1.6, .8, skin, ow * .7);
        else { g.taper([[kn[0] + (ft[0] - kn[0]) * .4, kn[1] + (ft[1] - kn[1]) * .4], ft], [B.lw * .94, B.lw * .7], boots, ow * .8); g.ell(ft[0] + .9, ft[1] + .35, 1.4, .72, boots, ow * .6); }
        return; }
      const s = (front ? 1 : -1) * (p.stride || 0), hx = cx + (front ? .45 : -.45) * B.lw;
      const lift = p.walkPh !== undefined ? Math.max(0, Math.sin(p.walkPh + (front ? 0 : Math.PI))) * 1.6 : 0;
      const foot = [hx + s, -.7 - lift], knee = [(hx + foot[0]) / 2 + .9 * K + cr * .6, (hipY + foot[1]) / 2 - lift * .3];
      const col = front ? pants : sh(pants, -.25);
      const ank = [foot[0], foot[1] - B.lw * .35];
      g.taper([[hx, hipY], knee, ank], [B.lw * 1.3, B.lw * .86, B.lw * .56], col, ow * .8);
      // Wadenmuskel
      g.ell((knee[0] + ank[0]) / 2 - B.lw * .14, (knee[1] * .62 + ank[1] * .38), B.lw * .42, Math.abs(ank[1] - knee[1]) * .3, sh(col, front ? .04 : -.04), 0);
      if (B.feet) { const fc = front ? skin : sh(skin, -.2); g.fill(() => { c.moveTo(ank[0] - B.lw * .4, ank[1]); c.quadraticCurveTo(ank[0] - B.lw * .5, foot[1] + .5, ank[0] - .2, foot[1] + .5); c.lineTo(ank[0] + 2.4, foot[1] + .5); c.quadraticCurveTo(ank[0] + 2.8, foot[1] - .3, ank[0] + 1.4, foot[1] - .5); c.quadraticCurveTo(ank[0] + .6, ank[1] - .2, ank[0] - B.lw * .4, ank[1]); }, g.lin(0, ank[1], 0, foot[1] + .5, [sh(fc, .1), sh(fc, -.2)]), ow * .8); c.fillStyle = rgba(hair, .7); for (let i = 0; i < 4; i++) c.fillRect(ank[0] + .1 + i * .45, foot[1] - .7 - (i % 2) * .2, .25, .5); }
      else {
        const bc0 = front ? boots : sh(boots, -.3), sx = knee[0] + (ank[0] - knee[0]) * .38, sy = knee[1] + (ank[1] - knee[1]) * .38;
        g.taper([[sx, sy], ank], [B.lw * .92, B.lw * .66], bc0, ow * .8);
        g.taper([[sx, sy], [sx + (ank[0] - sx) * .18, sy + (ank[1] - sy) * .18]], [B.lw * 1.05, B.lw * .98], sh(bc0, .18), ow * .6);
        g.fill(() => { c.moveTo(ank[0] - B.lw * .36, ank[1] - .2); c.lineTo(ank[0] - B.lw * .42, foot[1] + .55); c.lineTo(ank[0] + B.lw * .55 + 1.5 * K, foot[1] + .55); c.quadraticCurveTo(ank[0] + B.lw * .6 + 1.6 * K, foot[1] - .5, ank[0] + B.lw * .3, foot[1] - .7); c.lineTo(ank[0] + B.lw * .32, ank[1] - .2); c.closePath(); }, g.lin(0, ank[1], 0, foot[1] + .5, [sh(bc0, .15), bc0, sh(bc0, -.35)]), ow * .8);
        g.rr(ank[0] - B.lw * .44, foot[1] + .25, B.lw * .98 + 1.6 * K, .38, .15, sh(bc0, -.5), 0);
      }
    };
    if (L.coat && !L.robe) {
      const sw = (p.walkPh !== undefined ? Math.sin(p.walkPh) * .9 : 0) + (p.cape || 0) * .3;
      g.fill(() => { c.moveTo(cx - B.tw * .42, hipY - 1.5); c.lineTo(cx + B.tw * .42, hipY - 1.5); c.lineTo(cx + B.tw / 2 + .8 + sw * .3, hipY + B.ll * .62); c.lineTo(cx + .4, hipY + B.ll * .5); c.lineTo(cx - B.tw / 2 - 1.6 + sw * .6, hipY + B.ll * .66); c.closePath(); }, g.lin(cx - B.tw, 0, cx + B.tw, 0, [sh(L.coat, -.3), L.coat, sh(L.coat, .1)]), ow);
    }
    if (L.robe) {
      legs(false); legs(true); const rb = L.seated ? hipY + B.ll * .55 : 0;
      const sw = (p.walkPh !== undefined ? Math.sin(p.walkPh) * 1.2 : 0) + (p.cape || 0) * .3;
      g.fill(() => { c.moveTo(cx - B.tw * .4, hipY - B.th * .3); c.lineTo(cx + B.tw * .41, hipY - B.th * .27); c.quadraticCurveTo(cx + B.tw / 2 + 1, hipY + B.ll * .5, cx + B.tw / 2 + 1.6 + sw * .5, rb - 1.2); c.quadraticCurveTo(cx + sw * .4, rb - .2 + Math.sin(gt / 380) * .3, cx - B.tw / 2 - 1.8 + sw * .4, rb - 1.4); c.quadraticCurveTo(cx - B.tw / 2 - .8, hipY + B.ll * .5, cx - B.tw * .4, hipY - B.th * .3); }, g.lin(cx - B.tw, 0, cx + B.tw, 0, [sh(tunic, -.3), tunic, sh(tunic, .12)]), ow);
    } else { legs(false); legs(true); }
    // Torso
    c.save(); c.translate(cx, hipY); c.rotate(tilt); c.translate(-cx, -hipY);
    const br = (p.breath || 0) * .15;
    // Hals
    g.taper([[hxC - .25, top + .8], [hxC - .35 * hk * 6.2 / 4.3, chinY - .6]], [B.hw * .5, B.hw * .44], sh(skin, -.18), ow * .7);
    c.fillStyle = rgba('#000000', .22); c.beginPath(); c.ellipse(hxC - .1, chinY + .15, B.hw * .3, .45, 0, 0, TAU); c.fill();
    const wst = B.tw * .39, hipW = B.tw * .43, tg = g.lin(cx - B.tw / 2, top, cx + B.tw / 2, top + B.th * .4, [sh(tunic, -.32), sh(tunic, -.05), tunic, sh(tunic, .16)]);
    g.fill(() => { c.moveTo(cx - B.tw / 2 + .3, top + .9); c.quadraticCurveTo(cx - B.tw / 2 + .4, top - .3 - br, cx - B.tw * .15, top - .35 - br); c.lineTo(cx + B.tw * .15, top - .35 - br); c.quadraticCurveTo(cx + B.tw / 2 + .2, top - .2, cx + B.tw / 2 + .1, top + 1.4); c.quadraticCurveTo(cx + B.tw / 2 + .55, top + B.th * .36, cx + wst + .2, hipY - B.th * .26); c.lineTo(cx + hipW, hipY + .2); c.lineTo(cx - hipW, hipY + .2); c.lineTo(cx - wst, hipY - B.th * .3); c.quadraticCurveTo(cx - B.tw / 2 - .2, top + B.th * .36, cx - B.tw / 2 + .3, top + .9); c.closePath(); }, tg, ow);
    if (!L.robe && !big) { c.strokeStyle = rgba(sh(tunic, -.55), .6); c.lineWidth = .28; c.beginPath(); c.moveTo(hxC - B.hw * .45, top + .1); c.quadraticCurveTo(hxC + .1, top + 1.6, hxC + B.hw * .5, top + .1); c.stroke(); }
    if (!L.armor && !L.robe && !big && ['sword', 'dagger', 'axe'].includes(w)) { const bc0 = '#4a3020'; c.save(); c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = .95; c.beginPath(); c.moveTo(sF[0] - .4, top + .6); c.lineTo(cx - B.tw * .36, hipY - 1.2); c.stroke(); c.strokeStyle = g.lin(0, top, 0, hipY, [sh(bc0, .25), bc0]); c.lineWidth = .7; c.stroke(); c.strokeStyle = rgba('#e8c890', .5); c.setLineDash([.3, .35]); c.lineWidth = .1; c.stroke(); c.setLineDash([]); c.restore(); }
    // Stofffalten, Brust- und Rückenschatten
    c.save(); c.beginPath(); c.moveTo(cx - B.tw / 2, top - 1); c.lineTo(cx + B.tw / 2 + 1, top - 1); c.lineTo(cx + B.tw / 2 + 1, hipY); c.lineTo(cx - B.tw / 2, hipY); c.clip();
    c.strokeStyle = rgba(sh(tunic, -.55), .38); c.lineWidth = .32; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx + B.tw * .32, top + B.th * .42); c.quadraticCurveTo(cx + B.tw * .05, top + B.th * .5, cx - B.tw * .12, top + B.th * .44); c.moveTo(cx + B.tw * .1, hipY - B.th * .2); c.quadraticCurveTo(cx + B.tw * .2, hipY - B.th * .35, cx + B.tw * .32, hipY - B.th * .45); c.moveTo(cx - B.tw * .25, hipY - .8); c.quadraticCurveTo(cx - B.tw * .15, hipY - B.th * .3, cx - B.tw * .3, top + B.th * .55); c.stroke();
    c.strokeStyle = 'rgba(255,238,205,.3)'; c.lineWidth = .4; c.beginPath(); c.moveTo(cx + B.tw / 2 - .2, top + 1); c.quadraticCurveTo(cx + B.tw / 2 + .2, top + B.th * .36, cx + wst, hipY - B.th * .26); c.stroke();
    c.restore();
    if (!L.robe && !L.coat && !big && !hunch && !L.bark) {
      const sw = (p.walkPh !== undefined ? Math.sin(p.walkPh) * .5 : 0) + (p.cape || 0) * .2, hl = B.ll * .27;
      g.fill(() => { c.moveTo(cx - hipW, hipY - 1); c.lineTo(cx + hipW, hipY - 1); c.quadraticCurveTo(cx + hipW + .5, hipY + hl * .5, cx + hipW + .9 + sw * .4, hipY + hl); for (let i = 3; i >= 0; i--) c.lineTo(cx - hipW - .7 + (hipW * 2 + 1.6) * i / 4 + sw * .3, hipY + hl + (i % 2 ? .5 : 0)); c.quadraticCurveTo(cx - hipW - .4, hipY + hl * .5, cx - hipW, hipY - 1); c.closePath(); }, g.lin(cx - hipW, 0, cx + hipW, 0, [sh(tunic, -.38), sh(tunic, -.1), sh(tunic, .08)]), ow);
      c.strokeStyle = rgba(sh(tunic, -.6), .4); c.lineWidth = .25; c.beginPath(); for (let i = 1; i < 4; i++) { const fx = cx - hipW + hipW * 2 * i / 4; c.moveTo(fx, hipY); c.lineTo(fx + sw * .3 + (i - 2) * .25, hipY + hl); } c.stroke();
    }
    if (!L.robe) { g.rr(cx - hipW - .1, hipY - 1.6, hipW * 2 + .2, 1.1, .3, g.lin(0, hipY - 1.6, 0, hipY - .5, ['#5a4028', '#2a1a10']), .25); g.rr(cx + hipW - 1.8, hipY - 1.75, 1.3, 1.4, .3, g.lin(0, hipY - 1.8, 0, hipY - .4, ['#fff0a0', '#c8902a']), .2); }
    if (L.armor) {
      const ah = B.th * .58;
      g.fill(() => { c.moveTo(cx - B.tw / 2 + .2, top + .4); c.lineTo(cx + B.tw / 2 - .2, top + .4); c.lineTo(cx + B.tw / 2 - .4, top + ah); c.quadraticCurveTo(cx, top + ah + 1.2, cx - B.tw / 2 + .4, top + ah); c.closePath(); }, g.lin(cx, top, cx, top + ah, [sh(L.armor, .45), L.armor, sh(L.armor, -.35)]), ow);
      g.ell(sF[0] + .2, top + .6, big ? 3.4 : 2.1, big ? 2.2 : 1.4, g.lin(sF[0], top - 1, sF[0], top + 2, [sh(L.armor, .5), sh(L.armor, -.2)]), ow);
      c.save(); c.beginPath(); c.moveTo(cx - B.tw / 2 + .2, top + .4); c.lineTo(cx + B.tw / 2 - .2, top + .4); c.lineTo(cx + B.tw / 2 - .4, top + ah); c.quadraticCurveTo(cx, top + ah + 1.2, cx - B.tw / 2 + .4, top + ah); c.closePath(); c.clip();
      c.strokeStyle = rgba(sh(L.armor, -.55), .32); c.lineWidth = .1; const st = big ? 1.4 : .8; for (let yy = top + 1, r2 = 0; yy < top + ah + 1; yy += st * .6, r2++) { c.beginPath(); for (let xx = cx - B.tw / 2 + (r2 % 2) * st * .5; xx < cx + B.tw / 2; xx += st) { c.moveTo(xx - st * .4, yy); c.quadraticCurveTo(xx, yy + st * .5, xx + st * .4, yy); } c.stroke(); }
      c.strokeStyle = rgba('#ffffff', .25); c.lineWidth = .3; c.beginPath(); c.moveTo(cx + B.tw / 2 - .6, top + .8); c.lineTo(cx + B.tw / 2 - .8, top + ah - .4); c.stroke(); c.restore();
    }
    if (L.vest) { g.fill(() => { c.moveTo(cx - B.tw / 2 + .1, top + .6); c.lineTo(cx + .2, top + .8); c.lineTo(cx + .9, hipY - 1.6); c.lineTo(cx - B.tw / 2 + .3, hipY - 1.6); c.closePath(); }, g.lin(cx - B.tw / 2, 0, cx, 0, [sh(L.vest, -.25), L.vest]), .3); g.fill(() => { c.moveTo(cx + B.tw / 2 - .1, top + .8); c.lineTo(cx + 1.6, top + 1); c.lineTo(cx + 2, hipY - 1.6); c.lineTo(cx + B.tw / 2 - .3, hipY - 1.6); c.closePath(); }, g.lin(cx, 0, cx + B.tw / 2, 0, [L.vest, sh(L.vest, .12)]), .3); for (let i = 0; i < 3; i++) g.ell(cx + 1.4, top + 2 + i * 1.6, .25, .25, '#e0c070', 0); }
    if (L.bark) { c.strokeStyle = rgba(sh(tunic, -.45), .7); c.lineWidth = .5; for (let i = 0; i < 6; i++) { const bx = cx - B.tw / 2 + 1 + i * (B.tw - 2) / 5; c.beginPath(); c.moveTo(bx, top + 1); c.bezierCurveTo(bx + 1, top + B.th * .3, bx - 1, top + B.th * .6, bx + .4, hipY - .5); c.stroke(); } for (let i = 0; i < 4; i++) g.ell(cx - B.tw / 2 + 2 + (i * 3.1) % (B.tw - 3), top + 3 + (i * 4.7) % (B.th - 4), .9, .6, sh(L.hair || '#4f7a2e', -.1), 0); }
    if (L.emblem === 'tree' && L.armor) { const ex0 = cx + .6, ey0 = top + B.th * .3; c.strokeStyle = '#f4f6fa'; c.lineWidth = .35; c.beginPath(); c.moveTo(ex0, ey0 + 2); c.lineTo(ex0, ey0 - 1.6); for (const d of [-1, 1]) { c.moveTo(ex0, ey0 - .2); c.quadraticCurveTo(ex0 + d * .9, ey0 - .6, ex0 + d * 1.3, ey0 - 1.6); c.moveTo(ex0, ey0 + .7); c.quadraticCurveTo(ex0 + d * 1, ey0 + .3, ex0 + d * 1.6, ey0 - .6); } c.stroke(); for (let i = 0; i < 3; i++) g.ell(ex0 - 1 + i, ey0 - 2.4 - (i === 1 ? .4 : 0), .18, .18, '#ffffff', 0); }
    if (L.fur) { for (let i = 0; i < 6; i++) g.ell(cx - B.tw / 2 + .4 + i * (B.tw - .8) / 5, top + .2 + Math.sin(i * 2.1) * .3, 1.5, 1.2, g.rad(cx, top - 1, B.tw, [sh(L.fur, .25), L.fur]), .3); }
    if (L.scarf) { g.ell(cx + .4, top + .4, B.tw * .52, 1.1, g.lin(0, top - 1, 0, top + 1.5, [sh(L.scarf, .2), L.scarf]), .35); g.fill(() => { c.moveTo(cx + 1.4, top + .8); c.quadraticCurveTo(cx + 2.4 + Math.sin(gt / 400) * .3, top + 3.5, cx + 1.8, top + 5.4); c.lineTo(cx + .8, top + 5); c.quadraticCurveTo(cx + 1.2, top + 3, cx + .4, top + 1); }, L.scarf, .3); }
    if (acc.includes('brooch')) { const bx = cx + B.tw / 2 - 1.4, by = top + 1.1; g.fill(() => { c.moveTo(bx, by - .9); c.quadraticCurveTo(bx + .9, by, bx, by + 1.1); c.quadraticCurveTo(bx - .9, by, bx, by - .9); }, g.lin(bx, by - 1, bx, by + 1, ['#b8e8a0', '#3a8a3a']), .25); g.limb([[bx, by + 1.1], [bx, by + 1.6]], .25, '#d8dce4', 0); }
    if (acc.includes('horn')) { c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - B.tw / 2 + .4, hipY - 2.6); c.quadraticCurveTo(cx - B.tw / 2 - 2.2, hipY - .6, cx - B.tw / 2 - 1.2, hipY + 1.6); c.stroke(); c.strokeStyle = g.lin(0, hipY - 3, 0, hipY + 2, ['#f4ecd8', '#a88a58']); c.lineWidth = 1; c.stroke(); }
    if (acc.includes('pouch')) g.rr(cx - B.tw / 2 - .6, hipY - 2.2, 1.8, 2.2, .5, '#6a4628', .3);
    if (L.mark) { c.fillStyle = L.mark; c.beginPath(); c.ellipse(cx + .4, top + 3.4, 1, 1.2, 0, 0, TAU); c.fill(); for (let i = -1; i <= 1; i++) { c.fillRect(cx + .4 + i * .7 - .2, top + 1.4, .45, 1.4); } }
    const GR = L.gear || {};
    if (GR.a && GR.a.r >= 3) { const tc = GR.a.r >= 4 ? '#ffe08a' : '#d8c0ff'; c.strokeStyle = tc; c.lineWidth = .32; c.beginPath(); c.moveTo(cx - B.tw * .42, top + .7); c.lineTo(cx + .3, top + B.th * .36); c.lineTo(cx + B.tw * .44, top + .7); c.stroke(); c.strokeStyle = rgba(tc, .6); c.lineWidth = .22; c.beginPath(); c.moveTo(cx - B.tw * .38, hipY - 2); c.lineTo(cx + B.tw * .38, hipY - 2); c.stroke(); }
    if (GR.a && GR.a.r >= 4) { const pr = .55 + .25 * Math.sin(gt / 320); g.glow(cx + .3, top + B.th * .46, 2.6, '#ff9a30', pr); g.fill(() => { const ex = cx + .3, ey = top + B.th * .46; c.moveTo(ex, ey - 1); c.lineTo(ex + .7, ey); c.lineTo(ex, ey + 1); c.lineTo(ex - .7, ey); c.closePath(); }, '#fff2c0', .2); }
    if (GR.t && GR.t.r >= 2) { const ac = RCOL[GR.t.r], px = cx + B.tw * .18, py = top + B.th * .3; c.strokeStyle = '#d8c070'; c.lineWidth = .14; c.beginPath(); c.moveTo(cx - B.tw * .12, top + .2); c.quadraticCurveTo(px - .4, py - 1, px, py - .5); c.moveTo(cx + B.tw * .3, top + .3); c.quadraticCurveTo(px + .4, py - 1, px, py - .5); c.stroke(); g.ell(px, py, .55, .65, g.rad(px - .2, py - .2, .8, ['#ffffff', ac, sh(ac, -.4)]), .15); if (GR.t.r >= 3) g.glow(px, py, 1.8 + GR.t.r * .3, ac, .5 + .2 * Math.sin(gt / 280)); }
    if (L.shield) {
      const sw = big ? 7 : 4.4, shh = big ? 11 : 7.4, sx = cx + B.tw / 2 - 1.6, sy = top + 1;
      g.fill(() => { c.moveTo(sx, sy); c.lineTo(sx + sw, sy); c.lineTo(sx + sw, sy + shh * .55); c.quadraticCurveTo(sx + sw, sy + shh * .9, sx + sw / 2, sy + shh); c.quadraticCurveTo(sx, sy + shh * .9, sx, sy + shh * .55); c.closePath(); }, g.lin(sx, sy, sx + sw, sy + shh, [sh(L.shield, .35), L.shield, sh(L.shield, -.35)]), ow * 1.4);
      g.ell(sx + sw / 2, sy + shh * .42, sw * .16, sw * .16, sh(L.shield, .55), .3);
    }
    c.restore();
    // Kopf (eigener Raum: kanonischer Kopf 5.3 x 6.2, auf echte Größe skaliert)
    c.save(); c.translate(hxC, chinY); c.scale(hk, hk);
    const HW = 5.3, HH = 6.2, x0 = -HW / 2, y0 = -HH, hxL = 0, owH = ow / hk * .85;
    const hsw = Math.sin(gt / 520) * .35 + (p.cape || 0) * .3 + (p.walkPh !== undefined ? Math.sin(p.walkPh * 2) * .3 : 0) - lean * .15;
    if (L.hs === 'long' || L.hs === 'braids' || L.hs === 'wild') {
      const ln = L.hs === 'long' ? HH + 4.4 : HH + 2.6;
      g.fill(() => { c.moveTo(x0 + 1.8, y0 + .5); c.bezierCurveTo(x0 - 1.7, y0 + HH * .4, x0 - 1.5 - hsw, y0 + ln * .7, x0 - 1.3 - hsw * 1.4, y0 + ln); c.quadraticCurveTo(x0 + .5 - hsw, y0 + ln - .5, x0 + 2.3, y0 + HH + .5); c.lineTo(x0 + 2.5, y0 + 2); c.closePath(); }, g.lin(x0 - 1, y0, x0 + 2, y0 + ln, [sh(hair, .15), hair, sh(hair, -.38)]), owH * .7);
      c.strokeStyle = rgba(sh(hair, .45), .38); c.lineWidth = .14; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(x0 + 1.4 - i * .25, y0 + 1 + i * .3); c.quadraticCurveTo(x0 - 1.1 - i * .1, y0 + ln * .55, x0 - 1.1 - hsw * 1.3 + i * .38, y0 + ln - .3); } c.stroke();
    }
    const skull = () => { c.moveTo(x0 + 1.3, y0 + HH * .96); c.bezierCurveTo(x0 - .35, y0 + HH * .76, x0 - .55, y0 + HH * .2, x0 + HW * .36, y0 - .05); c.bezierCurveTo(x0 + HW * .8, y0 - .28, x0 + HW + .08, y0 + HH * .12, x0 + HW + .02, y0 + HH * .36); c.quadraticCurveTo(x0 + HW + .3, y0 + HH * .42, x0 + HW + .06, y0 + HH * .48); c.quadraticCurveTo(x0 + HW + .52, y0 + HH * .6, x0 + HW + .72, y0 + HH * .665); c.quadraticCurveTo(x0 + HW + .34, y0 + HH * .71, x0 + HW + .1, y0 + HH * .71); c.quadraticCurveTo(x0 + HW + .28, y0 + HH * .76, x0 + HW + .14, y0 + HH * .8); c.quadraticCurveTo(x0 + HW + .24, y0 + HH * .86, x0 + HW + .1, y0 + HH * .91); c.quadraticCurveTo(x0 + HW - .05, y0 + HH + .08, x0 + HW * .6, y0 + HH * .98); c.quadraticCurveTo(x0 + HW * .3, y0 + HH * .93, x0 + HW * .24, y0 + HH * .7); c.quadraticCurveTo(x0 + HW * .12, y0 + HH * .9, x0 + 1.3, y0 + HH * .96); c.closePath(); };
    g.fill(skull, g.lin(x0, 0, x0 + HW + .7, 0, [sh(skin, -.3), sh(skin, -.08), skin, sh(skin, .1)]), owH);
    if (!L.noface) { c.save(); c.beginPath(); skull(); c.clip();
      c.fillStyle = g.rad(x0 + HW * .72, y0 + HH * .62, HW * .45, [rgba(sh(skin, .25), .5), rgba(skin, 0)]); c.fillRect(x0, y0, HW + 1, HH + 1);
      c.fillStyle = g.rad(x0 + HW - 1.05, y0 + HH * .46, 1.1, [rgba(sh(skin, -.5), .45), rgba(skin, 0)]); c.fillRect(x0, y0, HW + 1, HH + 1);
      c.fillStyle = g.lin(0, y0 + HH * .78, 0, y0 + HH, [rgba('#000000', 0), rgba('#000000', .22)]); c.fillRect(x0, y0 + HH * .78, HW * .62, HH * .3);
      c.fillStyle = rgba('#ff7a6a', .14); c.beginPath(); c.ellipse(x0 + HW * .72, y0 + HH * .66, .8, .45, 0, 0, TAU); c.fill();
      c.restore(); }
    if (L.noface) g.rr(x0 + 1, y0 + .9, HW - 1, HH - 1.6, 1.4, '#050506', 0);
    else { c.strokeStyle = 'rgba(255,240,215,.35)'; c.lineWidth = .4; c.beginPath(); c.moveTo(x0 + HW - .35, y0 + 1.4); c.quadraticCurveTo(x0 + HW + .1, y0 + HH * .5, x0 + HW - .5, y0 + HH - 1); c.stroke(); g.ell(x0 + HW * .78, y0 + HH * .68, .7, .4, rgba('#ff8a7a', .18), 0); }
    if (L.paint) { c.fillStyle = L.paint; c.fillRect(x0 + 1.8, y0 + .3, .9, HH - .6); }
    const ey = y0 + HH * .47 - (big ? .4 : 0), ex = x0 + HW - 1.05;
    if (L.glow) { g.glow(ex, ey, big ? 4 : 2.6, L.glow, .9); c.fillStyle = sh(L.glow, .4); c.beginPath(); c.ellipse(ex, ey, .55, .45, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(ex - 2, ey, .5, .4, 0, 0, TAU); c.fill(); }
    else if (!L.noface) {
      const blink = (gt % 3700) < 110 ? .12 : 1;
      if (!(hunch || big)) {
        c.fillStyle = '#f4efe6'; c.beginPath(); c.moveTo(ex - .62, ey + .02); c.quadraticCurveTo(ex - .05, ey - .42 * blink, ex + .5, ey - .02); c.quadraticCurveTo(ex, ey + .3 * blink, ex - .62, ey + .02); c.fill();
        if (blink > .5) { c.fillStyle = g.rad(ex + .16, ey, .3, [sh(L.eyeC || '#5a4630', .35), L.eyeC || '#4a3a2a']); c.beginPath(); c.arc(ex + .16, ey, .27, 0, TAU); c.fill(); c.fillStyle = '#0a0808'; c.beginPath(); c.arc(ex + .2, ey, .13, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ex + .08, ey - .1, .07, 0, TAU); c.fill(); }
        c.strokeStyle = rgba('#1a0e08', .85); c.lineWidth = .2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - .66, ey + .02); c.quadraticCurveTo(ex - .05, ey - .46 * blink, ex + .54, ey - .02); c.stroke();
        c.strokeStyle = rgba(sh(skin, -.35), .6); c.lineWidth = .12; c.beginPath(); c.moveTo(ex - .5, ey - .42); c.quadraticCurveTo(ex, ey - .62, ex + .45, ey - .4); c.stroke();
        c.strokeStyle = sh(L.bc || hair, -.1); c.lineWidth = .34; c.beginPath(); c.moveTo(ex - .8, ey - .78 + (p.jaw > .5 ? .2 : 0)); c.quadraticCurveTo(ex, ey - 1.08, ex + .75, ey - .86); c.stroke();
        c.fillStyle = rgba(sh(skin, -.5), .7); c.beginPath(); c.ellipse(x0 + HW + .22, y0 + HH * .685, .14, .08, .3, 0, TAU); c.fill();
        c.strokeStyle = rgba(sh(skin, -.5), .8); c.lineWidth = .18; c.beginPath(); c.moveTo(x0 + HW - .75, y0 + HH * .775); c.quadraticCurveTo(x0 + HW - .25, y0 + HH * .775 + (p.jaw > .3 ? .5 : .08), x0 + HW + .12, y0 + HH * .765); c.stroke();
        c.fillStyle = rgba('#b85a50', .35); c.beginPath(); c.ellipse(x0 + HW - .15, y0 + HH * .81, .3, .12, 0, 0, TAU); c.fill();
        if (!L.ears && !['hood', 'helm', 'spikehelm'].includes(L.hat)) { g.ell(x0 + HW * .36, y0 + HH * .55, .55, .95, g.lin(x0 + 1.4, 0, x0 + 2.4, 0, [sh(skin, -.25), skin]), owH * .8, -.15); c.strokeStyle = rgba(sh(skin, -.5), .6); c.lineWidth = .14; c.beginPath(); c.arc(x0 + HW * .37, y0 + HH * .55, .32, -1.2, 1.6); c.stroke(); }
      } else { c.fillStyle = '#1a1010'; c.beginPath(); c.ellipse(ex, ey, .45, .55 * blink, 0, 0, TAU); c.fill(); }

      if (p.jaw > .2 && (hunch || big)) { c.fillStyle = '#2a0a0a'; c.fillRect(x0 + HW - 2.6, y0 + HH - 1.8, 2.4, .8 * p.jaw); }
    }
    // Haare
    const hs = L.hs || 'short';
    if (hs === 'long' || hs === 'braids' || hs === 'wild' || hs === 'short' || hs === 'curly') {
      g.fill(() => { c.moveTo(x0 - .3, y0 + HH * (hs === 'short' || hs === 'curly' ? .55 : .8)); c.quadraticCurveTo(x0 - .8, y0 - 1, x0 + HW * .45, y0 - 1.1); c.quadraticCurveTo(x0 + HW + .5, y0 - .9, x0 + HW + .2, y0 + 1.5); c.quadraticCurveTo(x0 + HW * .55, y0 + .9, x0 + 1.6, y0 + 1.8); c.quadraticCurveTo(x0 + 1, y0 + HH * .5, x0 + .9, y0 + HH * .8); c.closePath(); }, g.lin(x0, y0 - 1, x0, y0 + HH, [sh(hair, .2), hair, sh(hair, -.25)]), owH);
      c.strokeStyle = rgba(sh(hair, .5), .5); c.lineWidth = .16; c.beginPath(); for (let i = 0; i < 7; i++) { const t = i / 6; c.moveTo(x0 + HW * (.85 - t * .25), y0 + .1 + t * .2); c.quadraticCurveTo(x0 + HW * (.45 - t * .2), y0 - .7 + t * .6, x0 + .1 - t * .2, y0 + HH * (.3 + t * .35)); } c.stroke(); c.strokeStyle = rgba(sh(hair, -.5), .45); c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(x0 + HW * (.7 - i * .12), y0 + .5); c.quadraticCurveTo(x0 + HW * (.35 - i * .08), y0 + .2, x0 + .5 - i * .2, y0 + HH * (.45 + i * .08)); } c.stroke();
      if (hs !== 'curly') { for (let i = 0; i < 5; i++) { const fx = x0 + HW * (.5 + i * .1), fy = y0 + 1.1 + i * .1; g.fill(() => { c.moveTo(fx - .55, fy - .6); c.quadraticCurveTo(fx - .15, fy + .5 + (i % 2) * .4, fx + .2 + hsw * .1, fy + .85 + (i % 2) * .5); c.lineTo(fx + .45, fy - .4); c.closePath(); }, sh(hair, i % 2 ? .06 : -.12), 0); } }
      if ((hs === 'long' || hs === 'wild') && !L.beard) g.fill(() => { c.moveTo(x0 + HW * .28, y0 + HH * .28); c.quadraticCurveTo(x0 + HW * .12 - hsw * .2, y0 + HH * .7, x0 + HW * .22 - hsw * .4, y0 + HH * 1.02); c.lineTo(x0 + HW * .38 - hsw * .3, y0 + HH * .95); c.quadraticCurveTo(x0 + HW * .36, y0 + HH * .6, x0 + HW * .5, y0 + HH * .3); c.closePath(); }, g.lin(0, y0, 0, y0 + HH, [hair, sh(hair, -.25)]), owH * .5);
      c.strokeStyle = rgba(sh(hair, .7), .3); c.lineWidth = .45; c.beginPath(); c.moveTo(x0 + .3, y0 + .9); c.quadraticCurveTo(x0 + HW * .4, y0 - .55, x0 + HW * .85, y0 + .2); c.stroke();
      if (hs === 'curly') for (let i = 0; i < 13; i++) { const a = Math.PI * (1.08 - i * .075), cxl = hxL - .35 + Math.cos(a) * HW * .58, cyl = y0 + HH * .32 - Math.sin(a) * HH * .45 + (i % 2) * .25, r = .62 + (i % 3) * .1; g.ell(cxl, cyl, r, r * .9, g.rad(cxl - r * .3, cyl - r * .3, r * 1.2, [sh(hair, .3), hair, sh(hair, -.3)]), .16); c.strokeStyle = rgba(sh(hair, -.5), .5); c.lineWidth = .1; c.beginPath(); c.arc(cxl + .05, cyl + .05, r * .45, .5, 3.6); c.stroke(); }
      if (hs === 'braids') { c.strokeStyle = sh(hair, -.2); c.lineWidth = 1; c.beginPath(); c.moveTo(x0 - .4, y0 + 2); c.quadraticCurveTo(x0 - 1.8, y0 + HH + 2, x0 - 1 + Math.sin(gt / 500) * .4, y0 + HH + 6); c.stroke(); g.ell(x0 - 1 + Math.sin(gt / 500) * .4, y0 + HH + 6.4, .6, .6, '#e8e0c0', .2); }
      if (hs === 'wild') for (let i = 0; i < 4; i++) g.fill(() => { c.moveTo(x0 + i * 1.6 - 1, y0 + .4); c.lineTo(x0 + i * 1.6 - 1.8, y0 - 2.2 - (i % 2)); c.lineTo(x0 + i * 1.6 + .6, y0); }, hair, .3);
    } else if (hs === 'leaves') {
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI; g.ell(hxL + Math.cos(Math.PI + a) * HW * .75, y0 + 1 - Math.sin(a) * HH * .55 + Math.sin(gt / 600 + i) * .3, 2.4, 2, sh(hair, (i % 3 - 1) * .15), .35); }
    } else if (hs === 'fire') {
      c.save(); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const fx = x0 - 1 + i * HW / 5, hgt = 4 + Math.sin(gt / 90 + i * 1.7) * 2 + (i % 2) * 2; c.fillStyle = g.lin(fx, y0, fx, y0 - hgt, ['rgba(255,90,20,.9)', 'rgba(255,170,40,.7)', 'rgba(255,230,120,0)']); c.beginPath(); c.moveTo(fx - 1.6, y0 + 1); c.quadraticCurveTo(fx - .6, y0 - hgt * .6, fx + Math.sin(gt / 120 + i) * 1.2, y0 - hgt); c.quadraticCurveTo(fx + 1, y0 - hgt * .5, fx + 1.8, y0 + 1); c.fill(); }
      c.restore();
    }
    if (L.horns) for (const s of [0, 1]) g.fill(() => { const bx = x0 + (s ? HW - 1.5 : 1); c.moveTo(bx - 1, y0 + .8); c.quadraticCurveTo(bx - 2 - s, y0 - 4, bx - 5 + s * 3, y0 - 6); c.quadraticCurveTo(bx - 1.5 + s, y0 - 2.5, bx + 1, y0 + .5); }, g.lin(0, y0, 0, y0 - 6, [L.horns, sh(L.horns, .4)]), owH);
    // Bart
    const bd = L.beard;
    if (bd === 'stubble') { c.fillStyle = rgba(sh(skin, -.45), .45); c.beginPath(); c.ellipse(x0 + HW * .62, y0 + HH - 1.2, HW * .38, 1.2, 0, 0, TAU); c.fill(); }
    if (bd === 'short') g.fill(() => { c.moveTo(x0 + HW * .3, y0 + HH * .6); c.quadraticCurveTo(x0 + HW * .62, y0 + HH * .78, x0 + HW - .2, y0 + HH * .74); c.lineTo(x0 + HW + .25, y0 + HH * .78); c.quadraticCurveTo(x0 + HW + .3, y0 + HH + .7, x0 + HW * .55, y0 + HH + .6); c.quadraticCurveTo(x0 + HW * .2, y0 + HH * .9, x0 + HW * .3, y0 + HH * .6); }, g.lin(0, y0 + HH - 2, 0, y0 + HH + 1.4, [bc, sh(bc, -.25)]), owH);
    if (bd === 'long' || bd === 'dwarf') {
      const len = (bd === 'dwarf' ? B.th * .62 : B.th * .42) / hk, wid = bd === 'dwarf' ? HW + .4 : HW - .6, sw = Math.sin(gt / 700) * .3 + (p.lean || 0) * -.2;
      g.fill(() => { c.moveTo(x0 + HW * (bd === 'dwarf' ? .2 : .3), y0 + HH * .55); c.quadraticCurveTo(x0 + HW * .62, y0 + HH * .8, x0 + HW - .25, y0 + HH * .74); c.lineTo(x0 + HW + .3, y0 + HH * .78); c.quadraticCurveTo(x0 + HW + .4, y0 + HH + len * .6, x0 + HW * .55 + sw, y0 + HH + len); c.quadraticCurveTo(x0 + HW - wid, y0 + HH + len * .5, x0 + HW * (bd === 'dwarf' ? .2 : .3), y0 + HH * .55); }, g.lin(0, y0 + HH, 0, y0 + HH + len, [sh(bc, .15), bc, sh(bc, -.25)]), owH);
      if (bd === 'dwarf' && L.beadC) { g.ell(x0 + HW * .35, y0 + HH + len * .78, .55, .7, L.beadC, .25); g.ell(x0 + HW * .8, y0 + HH + len * .6, .5, .65, L.beadC, .25); }
      if (bd === 'dwarf') { c.strokeStyle = rgba('#000000', .35); c.lineWidth = .35; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x0 + HW * .5, y0 + HH + i * len / 4 - 1); c.lineTo(x0 + HW * .62, y0 + HH + i * len / 4); c.stroke(); } }
      if (L.glow) { /* Augen über dem Bart */ }
    }
    if (bd === 'short' || bd === 'long' || bd === 'dwarf') {
      g.fill(() => { c.moveTo(x0 + HW - 1.1, y0 + HH * .74); c.quadraticCurveTo(x0 + HW - .2, y0 + HH * .69, x0 + HW + .5, y0 + HH * .73); c.quadraticCurveTo(x0 + HW + .4, y0 + HH * .82, x0 + HW - .1, y0 + HH * .8); c.quadraticCurveTo(x0 + HW - .6, y0 + HH * .8, x0 + HW - 1.1, y0 + HH * .74); }, sh(bc, .08), owH * .6);
      const bl = bd === 'short' ? 1.3 : (bd === 'dwarf' ? B.th * .62 : B.th * .42) / hk; c.strokeStyle = rgba(sh(bc, .45), .45); c.lineWidth = .14; c.beginPath(); for (let i = 0; i < 6; i++) { const bx = x0 + HW * (.42 + i * .1); c.moveTo(bx, y0 + HH * .86); c.quadraticCurveTo(bx + .2, y0 + HH + bl * .4, bx - .1 + i * .05, y0 + HH + bl * .85); } c.stroke();
    }
    if (L.ears) g.fill(() => { c.moveTo(x0 + HW * .3, y0 + HH * .72); c.quadraticCurveTo(x0 + HW * .1, y0 + HH * .5, x0 - .4, y0 + HH * .18); c.quadraticCurveTo(x0 + HW * .35, y0 + HH * .35, x0 + HW * .48, y0 + HH * .5); c.closePath(); }, g.lin(x0, 0, x0 + HW * .5, 0, [sh(skin, -.2), skin]), owH * .8);
    // Kopfbedeckung
    const hat = L.hat, hc = L.hatC || '#6a6a6a';
    if (hat === 'wizard') {
      g.ell(hxL + .2, y0 - .2, HW * .95, 1, sh(hc, -.1), owH);
      g.fill(() => { c.moveTo(x0 + .2, y0 - .4); c.lineTo(x0 + HW - .2, y0 - .4); c.quadraticCurveTo(x0 + HW * .6, y0 - 5, x0 - 1.4 + Math.sin(gt / 900) * .5, y0 - 8.4); c.quadraticCurveTo(x0 + HW * .3, y0 - 4, x0 + .2, y0 - .4); }, g.lin(x0, 0, x0 + HW, 0, [sh(hc, -.25), hc, sh(hc, .15)]), owH);
    } else if (hat === 'feather') {
      g.ell(hxL + .2, y0 - .1, HW * .95, 1.1, sh(hc, -.1), owH);
      g.fill(() => { c.moveTo(x0 + .4, y0 - .3); c.quadraticCurveTo(x0 + HW * .5, y0 - 5.4, x0 + HW - .4, y0 - .3); }, g.lin(0, y0 - 5, 0, y0, [sh(hc, .2), hc]), owH);
      c.strokeStyle = '#3a6ad8'; c.lineWidth = .7; c.beginPath(); c.moveTo(x0 + 1.2, y0 - 1.6); c.quadraticCurveTo(x0 - 1.8, y0 - 5 + Math.sin(gt / 500) * .4, x0 - 3.4, y0 - 7); c.stroke();
    } else if (hat === 'hood') {
      g.fill(() => { c.moveTo(x0 + HW + .4, y0 + HH * .7); c.quadraticCurveTo(x0 + HW + .8, y0 - 1.4, x0 + HW * .4, y0 - 1.3); c.quadraticCurveTo(x0 - 1.4, y0 - 1, x0 - 1.2, y0 + HH + 2); c.lineTo(x0 + 2, y0 + HH + 1); c.quadraticCurveTo(x0 + 1.4, y0 + 1.6, x0 + HW - .8, y0 + 1.2); c.quadraticCurveTo(x0 + HW - .2, y0 + HH * .5, x0 + HW + .4, y0 + HH * .7); }, g.lin(x0, y0, x0 + HW, y0 + HH, [sh(hc, .1), hc, sh(hc, -.35)]), owH);
      if (L.noface) { c.fillStyle = '#030304'; c.beginPath(); c.ellipse(x0 + HW * .62, y0 + HH * .5, HW * .32, HH * .36, 0, 0, TAU); c.fill(); if (L.glow) { g.glow(ex, ey, 2.6, L.glow, .9); g.glow(ex - 2, ey, 2.2, L.glow, .7); } }
    } else if (hat === 'helm') {
      g.fill(() => { c.moveTo(x0 - .5, y0 + 2.2); c.quadraticCurveTo(x0 - .3, y0 - 1.6, x0 + HW * .5, y0 - 1.5); c.quadraticCurveTo(x0 + HW + .6, y0 - 1.4, x0 + HW + .4, y0 + 2.2); c.closePath(); }, g.lin(0, y0 - 1.5, 0, y0 + 2.2, [sh(hc, .5), hc, sh(hc, -.3)]), owH);
      g.rr(x0 + HW - .8, y0 + 1.6, .9, 2.2, .3, sh(hc, -.1), .3); g.rr(x0 - .8, y0 + 1.8, 2, 2.6, .5, sh(hc, -.2), .3);
      if (L.mark) { c.fillStyle = L.mark; c.beginPath(); c.ellipse(x0 + HW * .45, y0, .7, .6, 0, 0, TAU); c.fill(); }
      if (L.crest) g.fill(() => { c.moveTo(x0 + .6, y0 - 1.2); c.quadraticCurveTo(x0 + HW * .5, y0 - 3.2, x0 + HW - .4, y0 - 1.3); c.quadraticCurveTo(x0 + HW * .5, y0 - 1.9, x0 + .6, y0 - 1.2); }, sh(hc, .25), .3);
    } else if (hat === 'crown') {
      g.fill(() => { c.moveTo(x0 + .2, y0 + .4); for (let i = 0; i <= 4; i++) { c.lineTo(x0 + .2 + i * (HW - .4) / 4, y0 - (i % 2 ? .4 : 2.2)); } c.lineTo(x0 + HW - .2, y0 + .4); c.closePath(); }, g.lin(0, y0 - 2, 0, y0 + .4, [sh(hc, .5), hc]), .35);
      g.ell(x0 + HW * .5, y0 - .3, .5, .5, '#e04040', 0);
    } else if (hat === 'circlet') {
      c.strokeStyle = hc; c.lineWidth = .7; c.beginPath(); c.moveTo(x0 + .3, y0 + 1.4); c.quadraticCurveTo(x0 + HW * .5, y0 + 1.1, x0 + HW - .1, y0 + 1.2); c.stroke(); g.ell(x0 + HW - .6, y0 + 1.2, .55, .55, '#ffffff', 0); g.glow(x0 + HW - .6, y0 + 1.2, 1.8, '#ffffff', .5);
    } else if (hat === 'spikehelm') {
      g.rr(x0 - .6, y0 - .8, HW + 1.2, HH + 1, 2, g.lin(0, y0, 0, y0 + HH, [sh(hc, .35), hc, sh(hc, -.35)]), owH);
      for (let i = 0; i < 4; i++) g.fill(() => { const sx = x0 - .4 + i * (HW + .8) / 3.4; c.moveTo(sx - .8, y0 - .6); c.lineTo(sx + .1 - i * .2, y0 - 3.2 - (i % 2) * 1.6 - (big ? 2.2 : 0)); c.lineTo(sx + .9, y0 - .6); }, sh(hc, -.1), .35);
      c.fillStyle = '#050506'; c.fillRect(x0 + .8, ey - .4, HW - 1, .9); g.glow(ex, ey, big ? 4 : 2.6, L.glow || '#ff4020', 1); g.glow(ex - 2.2, ey, big ? 3.4 : 2.2, L.glow || '#ff4020', .8);
    }
    c.restore();
    // Waffe + vorderer Arm
    if (!p.hide) { weapon(c, g, w, aF.h, wd, wp, B, K, wc, L, p, aB.h, ow, gt); gearGlow(c, g, L, w, aF.h, wd, K, gt); }
    g.taper([sF, aF.e, aF.h], [B.lw * .98, B.lw * .7, B.lw * .5], sh(sleeve, -.02), ow * .8);
    g.ell(sF[0] + .1, sF[1] + .3, B.lw * .56, B.lw * .5, g.rad(sF[0] + .4, sF[1] - .3, B.lw * .7, [sh(sleeve, .18), sleeve, rgba(sh(sleeve, -.2), .0)]), 0);
    if (L.gear && L.gear.a && L.gear.a.r >= 2) { const ar = L.gear.a.r, pc = ar >= 4 ? '#ffcf6a' : ar >= 3 ? '#b8a8e8' : '#a8bccc', px = sF[0] + .15, py = sF[1] + .1, rw = B.lw * .78, rh = B.lw * .55;
      g.fill(() => { c.ellipse(px, py, rw, rh, -.25, Math.PI * 1.02, Math.PI * 2.08); c.closePath(); }, g.lin(px, py - rh, px, py + rh * .4, [sh(pc, .55), pc, sh(pc, -.4)]), ow * .9);
      g.fill(() => { c.ellipse(px - .1, py + rh * .45, rw * .85, rh * .5, -.25, Math.PI * 1.02, Math.PI * 2.05); c.closePath(); }, g.lin(px, py, px, py + rh, [sh(pc, .3), sh(pc, -.45)]), ow * .7);
      c.fillStyle = sh(pc, .7); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(px - rw * .5 + i * rw * .5, py - rh * .35 + Math.abs(i - 1) * .2, .14, 0, TAU); c.fill(); }
      if (ar >= 4) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba('#ffd070', .5 + .2 * Math.sin(gt / 300)); c.lineWidth = .25; c.beginPath(); c.ellipse(px, py, rw, rh, -.25, Math.PI * 1.05, Math.PI * 2.02); c.stroke(); c.restore(); } }
    if (L.bracers) g.taper([[aF.e[0] + (aF.h[0] - aF.e[0]) * .3, aF.e[1] + (aF.h[1] - aF.e[1]) * .3], [aF.e[0] + (aF.h[0] - aF.e[0]) * .85, aF.e[1] + (aF.h[1] - aF.e[1]) * .85]], [B.lw * .78, B.lw * .62], L.bracers, .3);
    { const fa = Math.atan2(aF.h[1] - aF.e[1], aF.h[0] - aF.e[0]), q = B.lw; c.save(); c.translate(aF.h[0], aF.h[1]); c.rotate(fa);
      g.rr(-q * .32, -q * .36, q * .8, q * .72, q * .3, g.lin(0, -q * .4, 0, q * .4, [sh(skin, .16), skin, sh(skin, -.28)]), ow * .8);
      g.ell(q * .02, -q * .4, q * .24, q * .14, sh(skin, .06), ow * .55, .4);
      c.strokeStyle = rgba(sh(skin, -.55), .55); c.lineWidth = .1; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(q * .3, -q * .34 + i * q * .17); c.lineTo(q * .46, -q * .34 + i * q * .17); } c.stroke(); c.restore(); }
    if (L.gear) { const lg = ['w', 'a', 't'].filter(s => L.gear[s] && L.gear[s].r >= 4).length; if (lg) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 2 + lg * 2; i++) { const t = ((gt / 1400) + i / (2 + lg * 2)) % 1, a = i * 2.39; c.globalAlpha = Math.sin(t * Math.PI) * .8; g.glow(cx + Math.cos(a) * B.tw * .7, hipY + 2 - t * (B.th + B.ll * .6), .9, '#ffc850', .9); } c.restore(); } }
    if (L.fire) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { const fx = cx - B.tw / 2 + ((i * 5.3) % B.tw), fy = top + ((i * 7.1) % B.th); const a = .4 + .4 * Math.sin(gt / 140 + i * 2); g.glow(fx, fy, 2.4, i % 2 ? '#ff7a1a' : '#ffb030', a); } c.restore(); }
  }
  /* Ausrüstung sichtbar: seltene Waffen leuchten, epische funkeln, legendäre brennen förmlich */
  const RCOL = ['#c8c8c8', '#7fd17a', '#5aa8ff', '#c070ff', '#ffa040'];
  function gearGlow(c, g, L, kind, h, d, K, gt) {
    const gw = L.gear && L.gear.w; if (!gw || gw.r < 2) return;
    const col = RCOL[gw.r], len = ({ sword: 10.5, dagger: 6, axe: 8, hammer: 8, mace: 8, club: 9, staff: 14, spear: 15, bow: 0, whip: 8, pan: 7, claws: 2 }[kind] ?? 9) * K, k = .45 + gw.r * .12 + Math.min(10, gw.e) * .03 + Math.sin(gt / 260) * .08;
    c.save(); c.globalCompositeOperation = 'lighter';
    if (!len) g.glow(h[0], h[1], 6 * K, col, k * .7);
    else { c.lineCap = 'round'; for (const [lw, a] of [[3.2, .16], [1.6, .3], [.6, .6]]) { c.strokeStyle = rgba(col, a * k * 1.6); c.lineWidth = lw * K; c.beginPath(); c.moveTo(h[0] + d[0] * 1.5 * K, h[1] + d[1] * 1.5 * K); c.lineTo(h[0] + d[0] * len, h[1] + d[1] * len); c.stroke(); } }
    const n = gw.r >= 4 ? 5 : gw.r >= 3 ? 3 : 1;
    for (let i = 0; i < n; i++) { const t = ((gt / (700 + i * 130)) + i / n) % 1, along = (len || 4 * K) * (.3 + .7 * ((i * .37 + t * .5) % 1)), x = h[0] + d[0] * along + Math.sin(gt / 200 + i) * .8, y = h[1] + d[1] * along - t * 5 * K; c.globalAlpha = Math.sin(t * Math.PI); g.glow(x, y, (gw.r >= 4 ? 1.6 : 1.1) * K, gw.r >= 4 ? '#ffcf60' : col, .9); }
    c.restore();
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
      if (L.staffTop === 'hook') { c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 1.8 * s; c.beginPath(); c.moveTo(...at(len - .5)); c.bezierCurveTo(...at(len + 2.4 * s, 0), ...at(len + 3 * s, 2.6 * s), ...at(len + 1.4 * s, 2.4 * s)); c.stroke(); c.strokeStyle = wc; c.lineWidth = 1 * s; c.stroke(); }
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
    if (L.horse) return drawHorse(c, L, anim, el, gt);
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
    const leg = (x, off, far) => { const a = gait ? Math.sin(ph + off) * .55 : 0, lift = gait ? Math.max(0, Math.cos(ph + off)) * 1.4 : 0; const hip = [x, by + bh * .1], foot = [x + Math.sin(a) * 3.2, -.7 - lift], knee = [(hip[0] + foot[0]) / 2 + (off % 2 ? -.9 : .9), hip[1] + (foot[1] - hip[1]) * .5], col = far ? sh(fur, -.35) : sh(fur, -.08); g.taper([hip, knee, foot], [big ? 3.4 : 2.8, big ? 1.6 : 1.3, big ? 1.2 : 1], col, .3); g.ell(foot[0] + .5, foot[1] + .1, big ? 1.3 : 1.05, .65, sh(col, -.15), .25); };
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

  function drawHorse(c, L, anim, el, gt) {
    const g = P(c), pony = L.pony, bl = pony ? 17 : 21, bh = pony ? 8 : 8.5, ll = pony ? 8 : 12;
    let ph = gt / 1400 * TAU, gait = 0, bob = (Math.sin(ph) + 1) * .3;
    if (anim === 'walk') { ph = el / 520 * TAU; gait = 1; bob = Math.abs(Math.sin(ph)) * .9; }
    const by = -ll - bh / 2 + bob, mane = L.mane || sh(L.fur, -.4);
    c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 3; const tw = Math.sin(gt / 380) * 1.5;
    c.beginPath(); c.moveTo(-bl / 2 + 1, by - 2); c.quadraticCurveTo(-bl / 2 - 4, by + 1 + tw, -bl / 2 - 4, by + 7 + tw); c.stroke(); c.strokeStyle = mane; c.lineWidth = 2; c.stroke();
    const leg = (x, off, far) => { const a = gait ? Math.sin(ph + off) * .5 : 0, lift = gait ? Math.max(0, Math.cos(ph + off)) * 1.6 : 0; const hip = [x, by + bh * .12], foot = [x + Math.sin(a) * 3.5, -.9 - lift], knee = [(hip[0] + foot[0]) / 2 + (off % 2 ? -.7 : .7), hip[1] + (foot[1] - hip[1]) * .46], fet = [foot[0] + (off % 2 ? .35 : -.2), foot[1] - 1.7], col = far ? sh(L.fur, -.32) : L.fur; g.taper([hip, knee, fet], [pony ? 3.4 : 3.9, pony ? 1.5 : 1.6, pony ? 1.2 : 1.1], col, .3); g.taper([fet, [foot[0], foot[1] - .4]], [pony ? 1.2 : 1.1, pony ? 1.5 : 1.3], sh(col, -.12), .28); g.fill(() => { c.moveTo(foot[0] - .9, foot[1] - .75); c.lineTo(foot[0] + .9, foot[1] - .75); c.lineTo(foot[0] + 1.15, foot[1] + .45); c.lineTo(foot[0] - 1, foot[1] + .45); c.closePath(); }, '#2a2018', .28); };
    leg(-bl / 2 + 3, Math.PI, 1); leg(bl / 2 - 3, 0, 1);
    { const bg = g.lin(0, by - bh / 2 - 1, 0, by + bh / 2, [sh(L.fur, .22), L.fur, L.belly || sh(L.fur, -.2)]); g.ell(-bl / 2 + 4.2, by - .4, 4.6, bh / 2 + .6, bg, .4); g.ell(bl / 2 - 3.2, by + .2, 4.1, bh / 2 + .5, bg, .4); g.ell(0, by, bl / 2, bh / 2, bg, 0);
      c.strokeStyle = rgba('#ffffff', .22); c.lineWidth = .45; c.beginPath(); c.moveTo(-bl / 2 + 2, by - bh / 2 + .5); c.quadraticCurveTo(0, by - bh / 2 - .3, bl / 2 - 3, by - bh / 2 + .6); c.stroke(); c.strokeStyle = rgba(sh(L.fur, -.5), .35); c.lineWidth = .3; c.beginPath(); c.arc(-bl / 2 + 4.2, by, 3.2, -.4, 1.3); c.moveTo(bl / 2 - 1.5, by + 1); c.arc(bl / 2 - 3.2, by + .4, 2.8, .2, 1.8); c.stroke(); }
    if (L.gear) { g.rr(-3, by - bh / 2 - .5, 6, 3.4, 1, L.gear, .3); g.limb([[0, by + bh / 2 - 1], [0, by + bh / 2 + 2]], .4, '#5a3a22', 0); }
    leg(-bl / 2 + 4.5, 0, 0); leg(bl / 2 - 1.5, Math.PI, 0);
    const nx = bl / 2 - 1, hx = bl / 2 + 4 + (gait ? Math.sin(ph * 2) * .5 : 0), hy = by - bh / 2 - (pony ? 5 : 8);
    g.taper([[nx - 3.2, by - 1.4], [hx - 1, hy + 1.6]], [pony ? 5.6 : 6.2, pony ? 3.2 : 3.4], L.fur, .35);
    for (let i = 0; i < 8; i++) { const t = i / 7, mx = nx - 3.6 + (hx - 1.4 - (nx - 3.6)) * t, my = by - 3.4 + (hy - .6 - (by - 3.4)) * t, sw = gait ? Math.sin(ph * 2 + i) * .5 : Math.sin(gt / 600 + i) * .2; g.fill(() => { c.moveTo(mx + .7, my - .9); c.quadraticCurveTo(mx - 1 + sw, my + .2, mx - 2.2 + sw * 1.5, my + 2.4); c.lineTo(mx + .5, my + .7); c.closePath(); }, i % 2 ? mane : sh(mane, .18), .18); }
    g.fill(() => { c.moveTo(hx - 2, hy - 1); c.lineTo(hx + 5, hy + 1.5); c.lineTo(hx + 5, hy + 3.4); c.lineTo(hx - 2, hy + 3); c.closePath(); }, L.fur, .4);
    g.ell(hx - 1, hy, 2.6, 2.4, L.fur);
    g.fill(() => { c.moveTo(hx - 1.6, hy - 2); c.lineTo(hx - 1, hy - 4.4); c.lineTo(hx, hy - 1.8); }, sh(L.fur, -.1), .3);
    if (L.gear) { c.strokeStyle = sh(L.gear, -.35); c.lineWidth = .38; c.beginPath(); c.moveTo(hx + 3.8, hy + 2.2); c.lineTo(hx - 1.2, hy + .2); c.moveTo(hx + 2.5, hy + 2.8); c.lineTo(hx - .4, hy - 1.6); c.stroke(); g.ell(hx + 2.6, hy + 2.4, .32, .32, '#e0c070', 0); }
    g.ell(hx + .4, hy - .3, .5, .5, L.eye || '#2a1a12', 0); g.ell(hx + 4.6, hy + 2.6, .4, .3, '#1a1010', 0);
  }
  function drawEagle(c, L, gt) {
    const g = P(c), f = Math.sin(gt / 220);
    for (const side of [-1, 1]) g.fill(() => { c.moveTo(0, 0); c.quadraticCurveTo(side * 10, -6 - f * 8, side * 22, -2 - f * 10); c.quadraticCurveTo(side * 16, 1 - f * 3, side * 18, 3 - f * 4); c.quadraticCurveTo(side * 9, 2, 0, 3); }, g.lin(0, -10, 0, 4, [sh(L.fur, .2), L.fur, sh(L.fur, -.3)]), .5);
    g.ell(0, 1, 3.2, 5, g.lin(0, -3, 0, 6, [L.belly, L.fur]), .5);
    g.ell(2.4, -3.6, 2.1, 1.9, '#e8dcc0', .4); g.fill(() => { c.moveTo(4, -4); c.lineTo(6.4, -3); c.lineTo(4, -2.4); }, '#e8b830', .3); g.ell(3, -4.2, .35, .35, '#1a1010', 0);
    g.fill(() => { c.moveTo(-1.6, 5.5); c.lineTo(0, 9); c.lineTo(1.6, 5.5); }, L.fur, .4);
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

  /* ---------- Drache ---------- */
  function drawDragon(c, L, anim, el, gt) {
    const g = P(c), sk = L.skin, bl = L.belly;
    let lean = 0, jaw = .12, rear = 0, fall = 0; const flap = Math.sin(gt / 320);
    if (anim === 'attack' || anim === 'throw') { const q = clamp01(el / animTime('attack')); lean = Math.sin(q * Math.PI) * 9 - (q < .25 ? q * 8 : 0); jaw = Math.sin(q * Math.PI); }
    if (anim === 'cast' || anim === 'shoot' || anim === 'shout') { const q = clamp01(el / animTime(anim)); rear = -Math.sin(q * Math.PI) * 7; jaw = clamp01(Math.sin(q * Math.PI) * 1.5); }
    if (anim === 'hurt') lean = -3 * (1 - clamp01(el / 300));
    if (anim === 'dead') fall = ease(clamp01(el / 800));
    if (fall) { c.save(); c.translate(0, -6); c.rotate(fall * .35); c.translate(0, 6 + fall * 6); }
    const wing = (near) => {
      const sx = -4 + lean * .5, sy = -30 + rear * .6, f = flap * (near ? 10 : 7);
      const tips = [[sx - 34, sy - 26 - f], [sx - 24, sy - 30 - f * 1.2], [sx - 12, sy - 28 - f], [sx + 4, sy - 22 - f * .6]];
      g.fill(() => { c.moveTo(sx, sy); c.lineTo(...tips[0]); c.quadraticCurveTo(sx - 30, sy - 6, sx - 26, sy + 8 - f * .2); c.quadraticCurveTo(sx - 14, sy - 2, sx - 8, sy + 10); c.quadraticCurveTo(sx - 2, sy + 2, sx + 6, sy + 6); c.lineTo(...tips[3]); c.closePath(); }, g.lin(sx, sy - 30, sx - 20, sy + 10, [sh(L.wing, near ? .15 : -.1), L.wing, sh(L.wing, -.45)]), .7);
      c.strokeStyle = rgba('#000000', .45); c.lineWidth = .7; tips.forEach(t => { c.beginPath(); c.moveTo(sx, sy); c.lineTo(...t); c.stroke(); });
    };
    // Schwanz
    const tw = Math.sin(gt / 500) * 4;
    const tail = [[-18 + lean * .3, -16], [-34, -12 + tw * .4], [-48, -8 + tw], [-58, -14 + tw * 1.4], [-64, -22 + tw * 1.2]];
    for (let i = 0; i < tail.length - 1; i++) g.limb([tail[i], tail[i + 1]], 9 - i * 2, sk, .6);
    g.fill(() => { const t = tail[tail.length - 1]; c.moveTo(t[0] - 2, t[1] + 2); c.lineTo(t[0] - 6, t[1] - 4); c.lineTo(t[0] + 2, t[1] - 3); c.closePath(); }, sh(sk, -.2), .4);
    wing(false);
    const leg = (x, far, off) => { const a = Math.sin(off) * 0; g.limb([[x + lean, -16], [x + lean - 2, -8], [x + lean + 1, -1]], far ? 5 : 6, far ? sh(sk, -.3) : sh(sk, -.05), .6); for (let i = 0; i < 3; i++) g.limb([[x + lean + i * 1.2, -1], [x + lean + 1.6 + i * 1.2, .6]], .7, L.horn, .2); };
    leg(-14, 1, 0); leg(8, 1, 1);
    g.ell(-4 + lean, -20 + rear * .3, 24, 11, g.rad(-6 + lean, -26, 26, [sh(sk, .25), sk, sh(sk, -.4)]), .8);
    g.ell(-2 + lean, -14 + rear * .3, 18, 5, g.lin(0, -18, 0, -9, [sh(bl, .2), bl]), .4);
    c.strokeStyle = rgba(sh(bl, -.4), .6); c.lineWidth = .4; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-16 + lean + i * 4, -18); c.lineTo(-15 + lean + i * 4, -10); c.stroke(); }
    for (let i = 0; i < 7; i++) g.fill(() => { const x = -22 + lean + i * 5; c.moveTo(x, -29 + rear * .3); c.lineTo(x + 1.5, -34 - (i % 2) + rear * .3); c.lineTo(x + 3, -29 + rear * .3); }, sh(sk, -.3), .3);
    leg(-10, 0, 2); leg(12, 0, 3);
    // Hals & Kopf
    const hx = 30 + lean * 1.2, hy = -42 + rear;
    const neck = [[12 + lean, -24 + rear * .3], [20 + lean, -34 + rear * .6], [hx - 4, hy + 2]];
    for (let i = 0; i < 2; i++) g.limb([neck[i], neck[i + 1]], 10 - i * 2, sk, .7);
    g.limb([[14 + lean, -22 + rear * .3], [hx - 4, hy + 5]], 4, bl, 0);
    for (const s2 of [0, 1]) g.fill(() => { c.moveTo(hx - 3 + s2 * 2, hy - 3); c.quadraticCurveTo(hx - 10 + s2 * 3, hy - 10, hx - 14 + s2 * 4, hy - 8); c.quadraticCurveTo(hx - 8 + s2 * 3, hy - 6, hx - 1 + s2 * 2, hy - 1); }, g.lin(0, hy - 10, 0, hy, [L.horn, sh(L.horn, -.3)]), .4);
    g.ell(hx, hy, 7, 5, g.rad(hx, hy - 2, 8, [sh(sk, .25), sk, sh(sk, -.3)]), .7);
    g.fill(() => { c.moveTo(hx + 3, hy - 3); c.lineTo(hx + 14, hy - 1.5); c.lineTo(hx + 14, hy + 1); c.lineTo(hx + 3, hy + 2); c.closePath(); }, g.lin(0, hy - 3, 0, hy + 2, [sh(sk, .2), sk]), .6);
    c.save(); c.translate(hx + 3, hy + 2); c.rotate(jaw * .45);
    g.fill(() => { c.moveTo(0, 0); c.lineTo(10.5, -.6); c.lineTo(10, 2); c.lineTo(0, 3); c.closePath(); }, g.lin(0, 0, 0, 3, [sh(sk, -.1), bl]), .5);
    c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(2 + i * 2.2, -.2); c.lineTo(2.8 + i * 2.2, -1.4); c.lineTo(3.4 + i * 2.2, -.2); c.fill(); }
    c.restore();
    if (jaw > .4) g.glow(hx + 12, hy + 1, 6 + jaw * 6, '#ff7a1a', .5 * jaw);
    g.glow(hx + 2, hy - 2, 4, L.eye, .9); g.ell(hx + 2, hy - 2, 1.2, .8, L.eye, .2); c.fillStyle = '#1a0a00'; c.fillRect(hx + 1.8, hy - 2.7, .4, 1.4);
    wing(true);
    if (fall) c.restore();
  }

  /* ---------- Haupt-API ---------- */
  /* ---------- Reittiere ---------- */
  const MOUNT_SADDLE = { horse: -20.2, pony: -15.4, warg: -13.4, fell: -24 };
  function drawMounted(c, L, anim, el, gt) {
    const M = L.mount, run = anim === 'walk' || anim === 'attack' || anim === 'throw', mel = anim === 'walk' ? el : (gt % 1040);
    const B = BODY[L.body] || BODY.man, sy = MOUNT_SADDLE[M.kind] || -20;
    if (M.kind === 'fell') {
      c.save(); const fl = Math.sin(gt / 300) * 1.2; c.translate(-3, fl); c.scale(.6, .6); drawDragon(c, M.look, 'idle', 0, gt); c.restore();
    } else { c.save(); c.scale(.86, .86); drawQuad(c, Object.assign({ horse: M.kind === 'horse' || M.kind === 'pony' ? 1 : 0, pony: M.kind === 'pony' ? 1 : 0 }, M.look), run ? 'walk' : 'idle', run ? (anim === 'walk' ? el : gt % 520) : mel, gt); c.restore(); }
    const p = poseAt(anim, el, L.wpn || 'sword', gt), bob = run ? Math.abs(Math.sin(gt / 520 * TAU)) * .8 : 0, ms = M.kind === 'fell' ? 1 : .86;
    c.save(); c.translate(-1.2 * ms, sy * ms + B.ll - bob + (M.kind === 'fell' ? Math.sin(gt / 300) * 1.2 : 0)); drawHum(c, Object.assign({}, L, { seated: 1 }), p, gt); c.restore();
  }
  function draw(c, type, look, anim, el, gt) {
    if (type === 'quad') { if (look.huge) { c.save(); c.scale(1.9, 1.9); drawQuad(c, look, anim, el, gt); c.restore(); return; } return drawQuad(c, look, anim, el, gt); }
    if (type === 'spider') return drawSpider(c, look, anim, el, gt);
    if (type === 'worm') return drawWorm(c, look, anim, el, gt);
    if (type === 'olifant') return drawOlifant(c, look, anim, el, gt);
    if (type === 'dragon') return drawDragon(c, look, anim, el, gt);
    if (look.mount && anim !== 'dead') return drawMounted(c, look, anim, el, gt);
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
      const headY = -B.ll - B.th - (B.nk || 1) - B.hh / 2 + (B.hunch ? 1 : 0);
      c.setTransform(sc, 0, 0, sc, cv.width / 2 - (.45 + (B.hunch || 0) * .8) * sc, cv.height / 2 - headY * sc + sc * .3);
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
    else if (false) { const col = key === 'pelennor' ? '#e0dcd0' : '#c8b8a0'; for (let i = 0; i < 6; i++) g.rr(20 + i * 6, HZ - 14 - i * 7, 60 - i * 12, 7, .6, g.lin(0, 0, 0, 7, [col, sh(col, -.25)]), .3); g.rr(46, HZ - 62, 4, 14, .5, '#f8f4ea', .3); if (key === 'pelennor') for (let i = 0; i < 4; i++) { const x = 120 + i * 35; g.glow(x, HZ - 4, 10, '#ff7a2a', .7); c.fillStyle = 'rgba(40,32,30,.45)'; c.beginPath(); c.moveTo(x - 2, HZ - 4); c.bezierCurveTo(x - 8, HZ - 30, x + 8, HZ - 50, x - 4, HZ - 80); c.lineTo(x + 6, HZ - 80); c.bezierCurveTo(x + 14, HZ - 50, x + 4, HZ - 30, x + 3, HZ - 4); c.fill(); } else { for (let i = 0; i < 6; i++) tree(g, c, 120 + i * 24, HZ, 7, '#1e4a2a'); g.glow(230, HZ - 6, 14, '#ff8a2a', .8); } }
    else if (key === 'doom') { for (let i = 0; i < 6; i++) g.fill(() => { c.moveTo(i * 48, HZ); c.lineTo(i * 48 + 20, HZ - 14 - R() * 10); c.lineTo(i * 48 + 44, HZ); }, '#1a0a08', 0); }
    else if (key === 'snow') { for (let i = 0; i < 8; i++) { const x = 10 + i * 34 + R() * 10, h = 10 + R() * 18; g.fill(() => { c.moveTo(x, HZ + 2); c.lineTo(x + 4, HZ - h); c.lineTo(x + 9, HZ + 2); }, g.lin(x, 0, x + 9, 0, ['#e0f4ff', '#8ac0e8']), .3); } }
    else if (key === 'sea') { c.fillStyle = g.lin(0, 62, 0, HZ, ['#4a7aa8', '#1e4a7a']); c.fillRect(0, 64, 256, HZ - 64); c.strokeStyle = 'rgba(200,230,255,.35)'; c.lineWidth = .4; for (let i = 0; i < 40; i++) { const x = R() * 256, y = 66 + R() * 22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3 + R() * 4, y); c.stroke(); } g.limb([[200, 70], [200, 40]], 1.2, '#5a3a22', .3); g.fill(() => { c.moveTo(201, 42); c.quadraticCurveTo(214, 50, 201, 62); c.lineTo(222, 60); c.quadraticCurveTo(216, 50, 201, 42); }, '#ece4d4', .3); }
    else if (key === 'south') { g.rr(30, HZ - 30, 40, 30, 1, g.lin(0, HZ - 30, 0, HZ, ['#a8865e', '#7a5a3a']), .3); g.rr(170, HZ - 40, 14, 40, 1, '#7a5a3a', .3); g.rr(168, HZ - 44, 18, 4, .5, '#8a6a4a', .3); }
    else if (key === 'mirkwood') { for (let i = 0; i < 11; i++) { const x = 4 + i * 24 + R() * 8, w = 5 + R() * 4; g.rr(x, HZ - 70, w, 72, 1, g.lin(x, 0, x + w, 0, ['#1a120c', '#3a2a1c', '#1a120c']), .3); g.ell(x + w / 2, HZ - 66, 16, 10, rgba('#0e1a10', .9), 0); c.strokeStyle = 'rgba(40,28,20,.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + w / 2, HZ - 40); c.quadraticCurveTo(x + w + 6, HZ - 46, x + w + 10, HZ - 38); c.stroke(); } c.strokeStyle = 'rgba(220,220,230,.22)'; c.lineWidth = .3; for (let i = 0; i < 5; i++) { const x = 30 + i * 50; for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(x, HZ - 40); c.lineTo(x + Math.cos(j) * 12, HZ - 40 + Math.sin(j) * 12); c.stroke(); } } }
    else if (key === 'lake') { g.fill(() => { c.moveTo(150, HZ - 26); c.lineTo(196, 14); c.lineTo(242, HZ - 26); }, g.lin(0, 14, 0, HZ, ['#8a8a96', '#4a4a56']), 0); c.fillStyle = g.lin(0, HZ - 26, 0, HZ, ['#5a7a98', '#2a4a6a']); c.fillRect(0, HZ - 26, 256, 28); c.strokeStyle = 'rgba(220,235,255,.35)'; c.lineWidth = .4; for (let i = 0; i < 30; i++) { const x = R() * 256, y = HZ - 24 + R() * 22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y); c.stroke(); } for (let i = 0; i < 6; i++) { const x = 12 + i * 22; for (const d of [1, 9]) g.limb([[x + d, HZ - 4], [x + d, HZ - 16]], .8, '#4a3220', .2); g.rr(x, HZ - 24, 11, 9, .4, g.lin(x, 0, x + 11, 0, ['#5a3e26', '#7a5a38']), .3); g.fill(() => { c.moveTo(x - 1.5, HZ - 24); c.lineTo(x + 5.5, HZ - 31); c.lineTo(x + 12.5, HZ - 24); }, '#3a2a1e', .3); g.ell(x + 5.5, HZ - 20, 1, 1, '#ffcc66', 0); } }
    else if (key === 'erebor') { g.fill(() => { c.moveTo(20, HZ); c.lineTo(128, 8); c.lineTo(236, HZ); }, g.lin(0, 8, 0, HZ, ['#9a8a7a', '#5a4a40']), .3); g.rr(116, HZ - 30, 24, 30, 1, '#1a120c', .4); g.rr(113, HZ - 34, 30, 5, .5, '#7a6a58', .3); for (const x of [96, 150]) { g.rr(x, HZ - 40, 10, 40, 1, g.lin(x, 0, x + 10, 0, ['#6a5a4a', '#8a7a68']), .3); g.ell(x + 5, HZ - 42, 4, 3.4, '#7a6a58', .3); } g.glow(128, HZ - 18, 18, '#ffb040', .4); }
    else if (key === 'dolguldur') { for (let i = 0; i < 5; i++) { const x = 20 + i * 52, h = 34 + (i * 17) % 26; g.fill(() => { c.moveTo(x, HZ); c.lineTo(x, HZ - h); c.lineTo(x + 3, HZ - h - 6); c.lineTo(x + 6, HZ - h + 2); c.lineTo(x + 10, HZ - h - 4); c.lineTo(x + 14, HZ - h); c.lineTo(x + 14, HZ); }, g.lin(x, 0, x + 14, 0, ['#141a16', '#2a342c']), .3); g.glow(x + 7, HZ - h + 10, 5, '#7aff9a', .5); } }
    else if (key === 'rhun') { for (let i = 0; i < 5; i++) { const x = 20 + i * 52; g.rr(x, HZ - 10 - (i % 3) * 4, 5, 10 + (i % 3) * 4, 1, g.lin(x, 0, x + 5, 0, ['#5a4a5a', '#7a6a7a']), .3); } }
  }


  /* ---------- Wahrzeichen der Lore (Fernsicht, gecacht) ---------- */
  const lmCache = new Map();
  const LANDMARKS = {
    pelennor: { w: 150, h: 104, base: 6, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 104); c.lineTo(36, 26); c.lineTo(66, 8); c.lineTo(108, 30); c.lineTo(150, 104); c.closePath(); }, g.lin(0, 8, 0, 104, [sh(T.far, .25), T.far]), 0);
      g.fill(() => { c.moveTo(56, 15); c.lineTo(66, 8); c.lineTo(78, 14); c.lineTo(70, 18); c.lineTo(62, 16); c.closePath(); }, 'rgba(240,244,250,.8)', 0);
      for (let i = 0; i < 7; i++) { const w = 84 - i * 10.5, y = 104 - (i + 1) * 8.4, x = 74 - w / 2; g.rr(x, y, w, 8.6, 1, g.lin(0, y, 0, y + 8.6, ['#f4f2ec', '#c8c4ba']), .25); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x + .5, y + .3, w - 1, .6); c.fillStyle = 'rgba(255,214,140,.75)'; for (let j = 0; j < w / 6; j++) if ((i * 7 + j * 3) % 5 < 2) c.fillRect(x + 2 + j * 6, y + 3.6, .9, 1.4); }
      g.fill(() => { c.moveTo(68, 47); c.lineTo(80, 47); c.lineTo(96, 104); c.lineTo(84, 104); c.closePath(); }, g.lin(68, 0, 96, 0, ['#e8e4dc', '#a8a49a']), .25);
      g.rr(66, 38, 16, 7, .8, '#f4f2ec', .25); g.rr(72, 10, 4, 29, .5, g.lin(72, 0, 76, 0, ['#ffffff', '#c8c8c4']), .25); g.fill(() => { c.moveTo(71.5, 10.5); c.lineTo(74, 2); c.lineTo(76.5, 10.5); c.closePath(); }, '#f8f8f4', .2);
      c.strokeStyle = '#d8d8d0'; c.lineWidth = .25; c.beginPath(); c.moveTo(74, 2); c.lineTo(74, -2); c.stroke(); g.fill(() => { c.moveTo(74, -2); c.lineTo(79, -1); c.lineTo(74, 0); c.closePath(); }, '#ffffff', 0);
    }, anim(ctx, x, y, gt) { const a = .35 + .15 * Math.sin(gt / 500); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 74, y + 4, 0, x + 74, y + 4, 9); r.addColorStop(0, `rgba(255,250,230,${a})`); r.addColorStop(1, 'rgba(255,250,230,0)'); ctx.fillStyle = r; ctx.fillRect(x + 64, y - 6, 20, 20); ctx.restore(); } },
    doom: { w: 168, h: 136, base: 4, k: .55, paint(c, g, T) {
      g.fill(() => { c.moveTo(4, 136); c.lineTo(14, 96); c.lineTo(21, 98); c.lineTo(26, 64); c.lineTo(32, 66); c.lineTo(35, 34); c.lineTo(39, 24); c.lineTo(41, 30); c.lineTo(43, 10); c.lineTo(46, 28); c.lineTo(50, 28); c.lineTo(53, 10); c.lineTo(55, 30); c.lineTo(57, 24); c.lineTo(61, 34); c.lineTo(64, 66); c.lineTo(70, 64); c.lineTo(75, 98); c.lineTo(82, 96); c.lineTo(92, 136); c.closePath(); }, g.lin(0, 10, 0, 136, ['#08060a', '#140a0a', '#3a120a']), 0);
      c.strokeStyle = 'rgba(255,110,40,.35)'; c.lineWidth = .35; c.beginPath(); for (const [a, b] of [[14, 96], [26, 64], [35, 34], [61, 34], [70, 64], [82, 96]]) { c.moveTo(a, b); c.lineTo(a + (a < 48 ? -3 : 3), b + 30); } c.stroke();
      g.fill(() => { c.moveTo(98, 136); c.lineTo(126, 62); c.lineTo(140, 60); c.lineTo(168, 136); c.closePath(); }, g.lin(0, 60, 0, 136, ['#2a1008', '#160806']), 0);
      c.strokeStyle = '#ff6a1a'; c.lineWidth = .9; c.lineCap = 'round'; c.beginPath(); c.moveTo(131, 62); c.quadraticCurveTo(128, 82, 121, 96); c.quadraticCurveTo(117, 108, 112, 120); c.moveTo(136, 62); c.quadraticCurveTo(140, 84, 147, 104); c.stroke(); c.strokeStyle = 'rgba(255,200,80,.7)'; c.lineWidth = .35; c.stroke();
      g.ell(133, 61, 7, 2.2, '#ff7a2a', 0);
    }, anim(ctx, x, y, gt) {
      const ex = x + 48, ey = y + 17, p = .75 + .25 * Math.sin(gt / 380); ctx.save(); ctx.globalCompositeOperation = 'lighter';
      let r = ctx.createRadialGradient(ex, ey, 0, ex, ey, 22); r.addColorStop(0, `rgba(255,140,40,${.55 * p})`); r.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = r; ctx.fillRect(ex - 22, ey - 22, 44, 44);
      ctx.fillStyle = `rgba(255,${150 + 60 * p | 0},60,.95)`; ctx.beginPath(); ctx.ellipse(ex, ey, 4.6, 2.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#100404'; ctx.beginPath(); ctx.ellipse(ex + Math.sin(gt / 2300) * .8, ey, .55, 2.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'lighter'; r = ctx.createRadialGradient(x + 133, y + 60, 0, x + 133, y + 60, 16); r.addColorStop(0, `rgba(255,120,40,${.4 * p})`); r.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = r; ctx.fillRect(x + 117, y + 44, 32, 32);
      ctx.globalCompositeOperation = 'source-over'; for (let i = 0; i < 6; i++) { const t = ((gt / 4200) + i / 6) % 1; ctx.fillStyle = `rgba(30,22,22,${.45 * (1 - t)})`; ctx.beginPath(); ctx.arc(x + 133 + t * 22 + Math.sin(t * 6 + i) * 3, y + 58 - t * 46, 4 + t * 10, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore(); } },
    cirith: { w: 110, h: 104, base: 4, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 104); c.lineTo(8, 54); c.lineTo(18, 64); c.lineTo(28, 40); c.lineTo(40, 58); c.lineTo(78, 52); c.lineTo(90, 34); c.lineTo(100, 56); c.lineTo(110, 104); c.closePath(); }, g.lin(0, 34, 0, 104, ['#1e1a28', '#0e0c14']), 0);
      g.rr(36, 80, 38, 24, 1, g.lin(0, 80, 0, 104, ['#3a4a44', '#1e2a26']), .3);
      g.fill(() => { c.moveTo(48, 84); c.lineTo(49.5, 26); c.lineTo(52, 20); c.lineTo(55, 12); c.lineTo(58, 20); c.lineTo(60.5, 26); c.lineTo(62, 84); c.closePath(); }, g.lin(48, 0, 62, 0, ['#2a3a34', '#5a7a6a', '#2a3a34']), .3);
      c.fillStyle = 'rgba(200,255,220,.85)'; for (let i = 0; i < 6; i++) c.fillRect(54, 30 + i * 9, 1.2, 2.2); for (let i = 0; i < 6; i++) c.fillRect(40 + i * 6, 88, 1.2, 2);
    }, anim(ctx, x, y, gt) { const a = .35 + .2 * Math.sin(gt / 700); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 55, y + 40, 0, x + 55, y + 40, 40); r.addColorStop(0, `rgba(170,255,200,${a})`); r.addColorStop(1, 'rgba(120,255,180,0)'); ctx.fillStyle = r; ctx.fillRect(x + 15, y, 80, 80); ctx.restore(); } },
    amonhen: { w: 160, h: 96, base: 4, k: .56, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 96); c.lineTo(0, 30); c.lineTo(22, 40); c.lineTo(30, 96); c.closePath(); }, g.lin(0, 30, 0, 96, [sh(T.far, .1), sh(T.far, -.2)]), 0);
      g.fill(() => { c.moveTo(160, 96); c.lineTo(160, 30); c.lineTo(138, 40); c.lineTo(130, 96); c.closePath(); }, g.lin(0, 30, 0, 96, [sh(T.far, .1), sh(T.far, -.2)]), 0);
      c.fillStyle = g.lin(0, 80, 0, 96, ['rgba(170,200,220,.6)', 'rgba(90,120,150,.6)']); c.fillRect(60, 86, 40, 10);
      const king = (bx, dir) => { c.save(); c.translate(bx, 96); c.scale(dir, 1); const st = g.lin(-14, 0, 14, 0, ['#5e5e58', '#9a9a92', '#6a6a64']);
        g.rr(-15, -18, 30, 18, 1, st, .3);
        g.fill(() => { c.moveTo(-11, -18); c.lineTo(-8, -60); c.lineTo(8, -60); c.lineTo(11, -18); c.closePath(); }, st, .3);
        g.fill(() => { c.moveTo(-8, -58); c.lineTo(-16, -80); c.lineTo(-13, -82); c.lineTo(-5, -61); c.closePath(); }, st, .3); g.rr(-19.5, -89, 6, 9, 2, st, .3);
        g.fill(() => { c.moveTo(7, -58); c.lineTo(10, -40); c.lineTo(7, -38); c.lineTo(4, -56); c.closePath(); }, st, .3); g.rr(9.2, -78, 1.8, 58, .4, '#6a6a64', .25); g.fill(() => { c.moveTo(10, -78); c.quadraticCurveTo(17, -80, 16, -70); c.quadraticCurveTo(12, -71, 10, -72); c.closePath(); }, '#8a8a84', .25);
        g.ell(0, -66, 5.4, 6.4, st, .3); g.fill(() => { c.moveTo(-5.6, -68); c.lineTo(-4, -78); c.lineTo(0, -74); c.lineTo(4, -78); c.lineTo(5.6, -68); c.closePath(); }, '#7a7a74', .3);
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = .4; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(-6 + i * 4, -58); c.lineTo(-8 + i * 5, -20); } c.stroke(); c.restore(); };
      king(42, 1); king(118, -1);
    } },
    shire: { w: 150, h: 70, base: 3, k: .5, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 70); c.quadraticCurveTo(30, 18, 78, 16); c.quadraticCurveTo(122, 18, 150, 70); c.closePath(); }, g.lin(0, 16, 0, 70, ['#6aa04a', '#3e7230']), 0);
      c.strokeStyle = 'rgba(255,255,220,.25)'; c.lineWidth = .6; c.beginPath(); c.moveTo(20, 50); c.quadraticCurveTo(70, 18, 130, 46); c.stroke();
      g.ell(76, 52, 9.5, 9.5, '#5a3a22', .4); g.ell(76, 52, 8, 8, g.rad(74, 50, 9, ['#3a8a4a', '#1e5a2a']), .3); g.ell(76, 52, .9, .9, '#e8c050', 0);
      for (const [x, y] of [[54, 50], [98, 50]]) { g.ell(x, y, 3.2, 3.2, '#5a3a22', .3); g.ell(x, y, 2.4, 2.4, 'rgba(255,214,120,.85)', 0); c.strokeStyle = '#5a3a22'; c.lineWidth = .4; c.beginPath(); c.moveTo(x - 2.4, y); c.lineTo(x + 2.4, y); c.moveTo(x, y - 2.4); c.lineTo(x, y + 2.4); c.stroke(); }
      g.rr(88, 22, 2.6, 8, .4, '#7a5a4a', .3); g.rr(70, 60, 12, 10, 0, '#a89a7a', 0);
      g.rr(128, 30, 4, 40, 1, g.lin(128, 0, 132, 0, ['#4a3020', '#6a4a30']), .3); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; g.ell(130 + Math.cos(a) * 11, 24 + Math.sin(a) * 8, 9, 7.5, g.rad(128, 18, 14, ['#7ab050', '#3e7a30']), .3); } g.ell(130, 22, 11, 9, '#5a9a42', 0);
      c.strokeStyle = 'rgba(255,240,180,.7)'; c.lineWidth = .3; c.beginPath(); for (let i = 0; i < 8; i++) { const x = 118 + i * 3.4; c.moveTo(x, 34 + Math.sin(i) * 2); c.lineTo(x, 38 + Math.sin(i) * 2); } c.stroke();
      c.fillStyle = 'rgba(255,214,120,.9)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(118 + i * 3.4, 38.6 + Math.sin(i) * 2, .7, 0, Math.PI * 2); c.fill(); }
    }, anim(ctx, x, y, gt) { const a = .25 + .15 * Math.sin(gt / 600); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [px, py] of [[54, 50], [98, 50]]) { const r = ctx.createRadialGradient(x + px, y + py, 0, x + px, y + py, 7); r.addColorStop(0, `rgba(255,200,100,${a})`); r.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = r; ctx.fillRect(x + px - 7, y + py - 7, 14, 14); } const sm = (gt / 3000) % 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = `rgba(230,230,230,${.35 * (1 - sm)})`; ctx.beginPath(); ctx.arc(x + 89 + sm * 6, y + 20 - sm * 14, 1.5 + sm * 4, 0, Math.PI * 2); ctx.fill(); ctx.restore(); } },
    sea: { w: 120, h: 80, base: 10, k: .5, front: 1, paint(c, g, T) {
      g.fill(() => { c.moveTo(14, 62); c.quadraticCurveTo(60, 74, 108, 60); c.lineTo(114, 52); c.quadraticCurveTo(60, 60, 8, 52); c.closePath(); }, g.lin(0, 52, 0, 72, ['#e8e0d0', '#8a7a6a']), .4);
      g.fill(() => { c.moveTo(108, 60); c.quadraticCurveTo(118, 50, 120, 40); c.lineTo(116, 42); c.quadraticCurveTo(114, 50, 104, 56); c.closePath(); }, '#d8d0c0', .3);
      for (const [mx, top] of [[40, 6], [72, 2]]) { g.rr(mx - .8, top, 1.6, 52, .4, '#6a5a4a', .25); g.fill(() => { c.moveTo(mx - 16, top + 8); c.quadraticCurveTo(mx, top + 4, mx + 16, top + 8); c.lineTo(mx + 14, top + 34); c.quadraticCurveTo(mx, top + 30, mx - 14, top + 34); c.closePath(); }, g.lin(mx - 16, 0, mx + 16, 0, ['#d8dce4', '#ffffff', '#c8ccd4']), .35);
        c.fillStyle = '#e0e8ff'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r2 = i % 2 ? 1.6 : 4; c.lineTo(mx + Math.cos(a) * r2, top + 20 + Math.sin(a) * r2); } c.closePath(); c.fill(); c.fillStyle = '#3a5a9a'; c.beginPath(); c.arc(mx, top + 20, 1.2, 0, Math.PI * 2); c.fill(); }
      g.fill(() => { c.moveTo(72, 2); c.lineTo(82, 4); c.lineTo(72, 6); c.closePath(); }, '#3a5a9a', .2);
      c.fillStyle = 'rgba(255,220,140,.8)'; for (let i = 0; i < 7; i++) c.fillRect(24 + i * 11, 58, 1.6, 1.4);
    }, anim(ctx, x, y, gt) {} },
    eregion: { w: 140, h: 76, base: 4, paint(c, g, T) {
      const st = g.lin(0, 20, 0, 76, ['#efe4d0', '#b8a88c']);
      g.rr(8, 50, 124, 26, 1, st, .3); for (let i = 0; i < 9; i++) { const x = 12 + i * 13.5; g.fill(() => { c.moveTo(x, 76); c.lineTo(x, 60); c.quadraticCurveTo(x + 5.5, 50, x + 11, 60); c.lineTo(x + 11, 76); c.closePath(); }, 'rgba(70,50,40,.55)', 0); }
      g.ell(34, 50, 12, 9, st, .3); g.ell(104, 50, 14, 10, st, .3); g.rr(31, 36, 6, 16, .8, st, .3);
      g.fill(() => { c.moveTo(66, 52); c.lineTo(68, 12); c.lineTo(70, 6); c.lineTo(72, 12); c.lineTo(74, 52); c.closePath(); }, g.lin(66, 0, 74, 0, ['#f8f0e0', '#c8b898']), .3);
      c.fillStyle = 'rgba(255,200,110,.85)'; for (const [a, b] of [[69.4, 20], [69.4, 30], [69.4, 40], [20, 64], [60, 64], [92, 64], [118, 64]]) c.fillRect(a, b, 1.3, 2.4);
    }, anim(ctx, x, y, gt) { const a = .4 + .2 * Math.sin(gt / 420); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 70, y + 10, 0, x + 70, y + 10, 14); r.addColorStop(0, `rgba(255,190,90,${a})`); r.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = r; ctx.fillRect(x + 56, y - 4, 28, 28); ctx.restore(); } }
  };
  function landmark(key, s) {
    const D = LANDMARKS[key]; if (!D) return null; const ck = key + s; if (lmCache.has(ck)) return lmCache.get(ck);
    const T = (typeof BACKGROUNDS !== 'undefined' && BACKGROUNDS[key]) || { far: '#4a5060', sky: ['#8090a0'] }, q = .75, cv = document.createElement('canvas'); cv.width = Math.ceil(D.w * s * q); cv.height = Math.ceil(D.h * s * q);
    const c = cv.getContext('2d'); c.scale(s * q, s * q); D.paint(c, P(c), T);
    // Luftperspektive: in die Ferne gerückt, leicht in Himmelsfarbe getaucht
    const sk = T.sky ? T.sky[T.sky.length - 1] : '#8090a0'; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = rgba(sk.length === 7 ? sk : '#8090a0', .2); c.fillRect(0, 0, cv.width, cv.height);
    const r = { cv, w: D.w, h: D.h, base: D.base, anim: D.anim, k: D.k || .46, front: !!D.front }; lmCache.set(ck, r); return r;
  }

  /* ---------- Item-Icons ---------- */
  function icon(cv, kind, col, r = 1) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 40; cv.width = Math.round(W * dpr); cv.height = cv.width;
    const c = cv.getContext('2d'), g = P(c); c.setTransform(cv.width / 16, 0, 0, cv.width / 16, 0, 0); c.clearRect(0, 0, 16, 16);
    // Hintergrund: Samt mit Lichtkegel in Seltenheitsfarbe
    c.fillStyle = g.rad(8, 6.5, 11, [rgba(col, .5 + r * .06), rgba(sh(col, -.55), .35), 'rgba(4,6,9,.9)']); c.fillRect(0, 0, 16, 16);
    if (r >= 3) { c.save(); c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + .2; c.fillStyle = rgba(col, .07 + (r - 3) * .05); c.beginPath(); c.moveTo(8, 8); c.lineTo(8 + Math.cos(a - .12) * 12, 8 + Math.sin(a - .12) * 12); c.lineTo(8 + Math.cos(a + .12) * 12, 8 + Math.sin(a + .12) * 12); c.fill(); } c.restore(); }
    c.save(); c.shadowColor = 'rgba(0,0,0,.75)'; c.shadowBlur = cv.width / 16 * 1.2; c.shadowOffsetY = cv.width / 16 * .5; icon2(c, g, kind, col); c.restore();
    // Glanz und Funkeln je nach Seltenheit
    if (r >= 2) { c.save(); c.globalCompositeOperation = 'source-atop'; c.restore(); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g.lin(2, 2, 14, 14, ['rgba(255,255,255,0)', 'rgba(255,255,255,' + (.1 + r * .04) + ')', 'rgba(255,255,255,0)']); c.fillRect(0, 0, 16, 16); c.restore(); }
    if (r >= 3) { c.save(); c.globalCompositeOperation = 'lighter'; const sp = r >= 4 ? [[12.6, 3.2, 1.6], [3.4, 12.4, 1.1], [13.2, 11.8, .8]] : [[12.6, 3.2, 1.2]]; for (const [x, y, s] of sp) { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x, y, x + s, y); c.quadraticCurveTo(x, y, x, y + s); c.quadraticCurveTo(x, y, x - s, y); c.quadraticCurveTo(x, y, x, y - s); c.fill(); g.glow(x, y, s * 1.8, col, .6); } c.restore(); }
  }
  function icon2(c, g, kind, col) {
    const metal = g.lin(3, 3, 13, 13, ['#ffffff', '#c8d0d8', '#7a8490']), wood = '#8a5a30';
    if (kind === 'sword') { g.fill(() => { c.moveTo(3.2, 12); c.lineTo(12, 2.6); c.lineTo(13.4, 2.6); c.lineTo(13.4, 4); c.lineTo(4.6, 12.8); c.closePath(); }, metal, .4); g.limb([[2.2, 10.2], [5.8, 13.8]], 1, '#c8a040', .3); g.limb([[3.2, 13], [1.6, 14.6]], 1.1, '#5a3a22', .3); }
    else if (kind === 'bow') { c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 2; c.beginPath(); c.moveTo(9, 1.5); c.quadraticCurveTo(2, 8, 9, 14.5); c.stroke(); c.strokeStyle = wood; c.lineWidth = 1.1; c.stroke(); c.strokeStyle = '#eee'; c.lineWidth = .3; c.beginPath(); c.moveTo(9, 1.5); c.lineTo(9, 14.5); c.stroke(); g.limb([[4, 8], [14, 8]], .6, '#d8c8a0', .25); }
    else if (kind === 'axe') { g.limb([[3.5, 14], [11, 3]], 1.2, wood, .35); g.fill(() => { c.moveTo(8.6, 3); c.quadraticCurveTo(10, -0.6, 14.6, 2.6); c.quadraticCurveTo(14, 7, 12.4, 8.2); c.closePath(); }, metal, .4); }
    else if (kind === 'staff') { g.limb([[3.5, 14.5], [11, 3.5]], 1.2, wood, .35); g.glow(12, 3, 5, col, .9); g.ell(12, 3, 1.8, 1.8, g.rad(12, 3, 2, ['#fff', col]), .3); }
    else if (kind === 'spear') { g.limb([[2, 14.5], [11.5, 4.5]], .9, wood, .3); g.fill(() => { c.moveTo(10.2, 3.6); c.lineTo(14.6, 1.2); c.lineTo(12.6, 5.8); c.closePath(); }, metal, .35); }
    else if (kind === 'armor') { g.fill(() => { c.moveTo(4, 3); c.lineTo(12, 3); c.lineTo(14.5, 5); c.lineTo(13, 7.5); c.lineTo(12, 7); c.lineTo(12, 13.5); c.quadraticCurveTo(8, 14.8, 4, 13.5); c.lineTo(4, 7); c.lineTo(3, 7.5); c.lineTo(1.5, 5); c.closePath(); }, metal, .45); g.ell(8, 9.5, 1.3, 1.3, col, .3); g.fill(() => { c.moveTo(6, 3); c.quadraticCurveTo(8, 5.4, 10, 3); }, '#3a3a40', 0); }
    else if (kind === 'gem') { g.glow(8, 8, 7, col, .6); g.fill(() => { c.moveTo(8, 2); c.lineTo(13.5, 6.5); c.lineTo(8, 14.5); c.lineTo(2.5, 6.5); c.closePath(); }, g.lin(3, 2, 13, 14, ['#ffffff', col, sh(col, -.4)]), .45); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = .3; c.beginPath(); c.moveTo(2.5, 6.5); c.lineTo(13.5, 6.5); c.moveTo(8, 2); c.lineTo(6, 6.5); c.lineTo(8, 14.5); c.stroke(); }
    else if (kind === 'orb') { g.glow(8, 8, 8, col, .7); g.ell(8, 8, 5.4, 5.4, g.rad(6.4, 6.2, 6, ['#ffffff', col, sh(col, -.5)]), .45); g.ell(6.5, 6.3, 1.2, .8, 'rgba(255,255,255,.8)', 0); }
    else if (kind === 'scroll') { g.rr(3.5, 3, 9, 10.5, 1, g.lin(3, 0, 13, 0, ['#c8b088', '#f0e4c4']), .4); g.ell(3.5, 8.2, 1.4, 5.2, '#b89a68', .35); g.ell(12.5, 8.2, 1.4, 5.2, '#b89a68', .35); c.strokeStyle = sh(col, -.3); c.lineWidth = .4; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(5.5, 5.5 + i * 1.8); c.lineTo(10.5, 5.5 + i * 1.8); c.stroke(); } }
    else if (kind === 'key') { g.limb([[4, 12], [11, 5]], 1.3, col, .4); g.ell(11.8, 4.2, 2.6, 2.6, col, .4); g.ell(11.8, 4.2, 1, 1, '#0a0c0f', 0); g.limb([[5.4, 10.6], [7, 12.2]], 1, col, .3); g.limb([[6.8, 9.2], [8.2, 10.6]], 1, col, .3); }
    else if (kind === 'ring') { c.lineWidth = 2.2; c.strokeStyle = OL; c.beginPath(); c.ellipse(8, 9.5, 4.2, 4, 0, 0, TAU); c.stroke(); c.lineWidth = 1.4; c.strokeStyle = g.lin(4, 6, 12, 13, ['#fff3b0', '#e0b040', '#8a6010']); c.stroke(); g.glow(8, 4.6, 4, col, .9); g.ell(8, 4.6, 1.8, 1.8, g.rad(7.4, 4, 2, ['#fff', col]), .35); }
  }

  /* ---------- Charakterkarten (Splash-Art) ---------- */
  const off = document.createElement('canvas');
  function card(cv, type, look, o = {}) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth || cv.width, H = cv.clientHeight || cv.height;
    cv.width = Math.max(2, Math.round(W * dpr)); cv.height = Math.max(2, Math.round(H * dpr));
    const c = cv.getContext('2d'), w = cv.width, h = cv.height, col = o.col || '#e0b552', g = P(c), R = rng(o.seed || 'x');
    // Hintergrund
    c.fillStyle = g.rad(w * .5, h * .36, Math.max(w, h) * .85, [rgba(col, .55), '#17202a', '#06080b']); c.fillRect(0, 0, w, h);
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .28 + Math.sin(i * 7) * .05; c.fillStyle = rgba(col, .05); c.beginPath(); c.moveTo(w * .5, -h * .1); c.lineTo(w * .5 + Math.cos(a - .06) * h * 2, -h * .1 - Math.sin(a - .06) * -h * 2); c.lineTo(w * .5 + Math.cos(a + .06) * h * 2, -h * .1 - Math.sin(a + .06) * -h * 2); c.fill(); }
    for (let i = 0; i < 16; i++) { const x = R() * w, y = R() * h, r = (R() * .03 + .006) * w; c.fillStyle = g.rad(x, y, r, [rgba(col, .25 + R() * .25), rgba(col, 0)]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
    c.restore();
    c.fillStyle = g.rad(w * .5, h * .97, w * .5, [rgba(col, .35), 'rgba(0,0,0,0)']); c.fillRect(0, h * .7, w, h * .3);
    // Figur in Puffer zeichnen und mit Leuchtkante einsetzen
    off.width = w; off.height = h; const oc = off.getContext('2d'); oc.setTransform(1, 0, 0, 1, 0, 0); oc.clearRect(0, 0, w, h);
    const D = dims(type, look);
    if (o.bust && type === 'hum') {
      const B = BODY[look.body] || BODY.man, hk = B.hh / 6.2, upper = B.hh + (B.nk || 1) + B.th * .62 + (look.hat === 'wizard' || look.hat === 'spikehelm' ? 8 : 3.5) * hk + 1, sc = h / upper * (o.zoom || .92);
      oc.setTransform(o.flip ? -sc : sc, 0, 0, sc, w * .5, h + (B.ll + B.th * .38) * sc);
    } else {
      const span = Math.max(D.h + 8, (D.w + 16) * h / w), sc = h / span * (o.zoom || 1);
      oc.setTransform(o.flip ? -sc : sc, 0, 0, sc, w * .5 + (o.dx || 0) * sc, h - sc * 3);
    }
    draw(oc, type, look, o.anim || 'idle', o.el || 0, o.gt ?? 600);
    c.save(); c.shadowColor = rgba(col, .95); c.shadowBlur = Math.max(4, w * .035); c.drawImage(off, 0, 0); c.restore();
    c.fillStyle = g.lin(0, h * .72, 0, h, ['rgba(0,0,0,0)', 'rgba(4,6,9,.85)']); c.fillRect(0, h * .72, w, h * .28);
  }

  /* ---------- Parallax-Ebenen (nahtlos kachelbar) ---------- */
  const TW = 512, layerCache = new Map();
  function layers(key, s) {
    s = Math.max(1, Math.round(s * 4) / 4);
    const ck = key + '@' + s; if (layerCache.has(ck)) return layerCache.get(ck);
    const T = BACKGROUNDS[key] || BACKGROUNDS.shire, HZ = 90, R = rng(key + 'L');
    const mk = (hgt, q = 1) => { const cv = document.createElement('canvas'); cv.width = Math.round(TW * s * q); cv.height = Math.round(hgt * s * q); const c = cv.getContext('2d'); c.scale(s * q, s * q); return [cv, c, P(c)]; };
    const fq = k => k * TAU / TW;
    // Himmel
    const [sky, sc, sg] = mk(HZ + 4, .5);
    const grd = sc.createLinearGradient(0, 0, 0, HZ); T.sky.forEach((x, i) => grd.addColorStop(i / (T.sky.length - 1), x)); sc.fillStyle = grd; sc.fillRect(0, 0, TW, HZ + 4);
    if (T.stars || T.moon) for (let i = 0; i < 160; i++) { sc.fillStyle = `rgba(255,255,255,${.3 + R() * .7})`; sc.beginPath(); sc.arc(R() * TW, R() * 55, R() * .45 + .12, 0, TAU); sc.fill(); }
    if (T.sun) { sg.glow(210, 26, 46, T.sun, .55); sg.ell(210, 26, 8, 8, sg.rad(208, 24, 9, ['#ffffff', T.sun]), 0); }
    if (T.moon) { sg.glow(60, 22, 28, T.moon, .35); sg.ell(60, 22, 6.5, 6.5, sg.rad(58, 20, 7, ['#ffffff', T.moon]), 0); }
    for (let i = 0; i < 5; i++) { const x = R() * TW, y = 14 + R() * 30, w = 30 + R() * 50; sc.fillStyle = 'rgba(255,255,255,.07)'; sc.beginPath(); sc.ellipse(x, y, w, 3 + R() * 3, 0, 0, TAU); sc.fill(); }
    const ridge = (c, g, base, amp, ks, ph, col, col2, snow) => {
      c.beginPath(); c.moveTo(0, HZ + 4);
      for (let x = 0; x <= TW; x += 2) c.lineTo(x, base - (Math.sin(x * fq(ks[0]) + ph) * amp + Math.sin(x * fq(ks[1]) + ph * 1.7) * amp * .45 + Math.sin(x * fq(ks[2]) + ph) * amp * .14));
      c.lineTo(TW, HZ + 4); c.closePath(); c.fillStyle = g.lin(0, base - amp * 1.5, 0, HZ, [col, col2]); c.fill();
      if (snow) { c.save(); c.clip(); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, 0, TW, base - amp * .9); c.restore(); }
    };
    const snowy = ['weather', 'snow', 'amonhen', 'helm', 'rhun', 'khazad'].includes(key);
    const [far, fc, fg] = mk(HZ + 4, .38);
    ridge(fc, fg, 60, 13, [5, 11, 29], R() * 9, sh(T.far, .12), T.sky[T.sky.length - 1], snowy);
    fc.fillStyle = fg.lin(0, 46, 0, HZ, ['rgba(255,255,255,0)', rgba(T.sky[T.sky.length - 1], .55)]); fc.fillRect(0, 46, TW, HZ - 46);
    if (key === 'doom') { for (const x0 of [128, 128 + TW]) { fg.fill(() => { fc.moveTo(x0 - 48, HZ); fc.lineTo(x0 - 6, 18); fc.lineTo(x0 + 6, 18); fc.lineTo(x0 + 48, HZ); }, fg.lin(0, 18, 0, HZ, ['#3a120a', '#1a0806']), 0); fg.glow(x0, 18, 30, '#ff5a1a', .8); } }
    const [mid, mc, mg] = mk(HZ + 4, .7);
    ridge(mc, mg, 78, 6, [8, 19, 41], R() * 9, sh(T.mid, .1), sh(T.mid, -.15), false);
    for (const dx of [0, -TW]) { mc.save(); mc.translate(dx, 0); props(mc, mg, key, T, rng(key + 'P'), HZ); mc.restore(); mc.save(); mc.translate(dx + 256, 0); props(mc, mg, key, T, rng(key + 'Q'), HZ); mc.restore(); }
    const [ground, gc, gg] = mk(144 - HZ + 2);
    gc.translate(0, -HZ);
    gc.fillStyle = gg.lin(0, HZ, 0, 144, [sh(T.ground, .1), T.ground, T.gd]); gc.fillRect(0, HZ, TW, 144 - HZ + 2);
    const both = (fn) => { fn(0); fn(-TW); fn(TW); };
    for (let i = 0; i < 520; i++) { const x = R() * TW, y = HZ + 2 + R() * 52, rx = .6 + R() * 2.4 * (y - HZ) / 54, ry = .3 + R() * .5, col = R() < .5 ? rgba(sh(T.gd, -.2), .35) : rgba(sh(T.ground, .25), .3); both(d => { gc.fillStyle = col; gc.beginPath(); gc.ellipse(x + d, y, rx, ry, 0, 0, TAU); gc.fill(); }); }
    if (['shire', 'amonhen', 'eregion', 'rhun', 'weather', 'south'].includes(key)) { gc.strokeStyle = rgba(sh(T.ground, .35), .7); gc.lineWidth = .35; for (let i = 0; i < 320; i++) { const x = R() * TW, y = HZ + 3 + R() * 52, hh = 1 + (y - HZ) / 25, q = R(); both(d => { gc.beginPath(); gc.moveTo(x + d, y); gc.quadraticCurveTo(x + d + .5, y - hh * .6, x + d + .9 + q, y - hh); gc.stroke(); }); } }
    if (key === 'snow') for (let i = 0; i < 80; i++) { const x = R() * TW, y = HZ + 3 + R() * 50; both(d => { gc.fillStyle = 'rgba(255,255,255,.8)'; gc.beginPath(); gc.ellipse(x + d, y, 2 + R() * 3, .6, 0, 0, TAU); gc.fill(); }); }
    if (key === 'sea') { gc.strokeStyle = 'rgba(40,24,12,.6)'; gc.lineWidth = .4; for (let y = HZ + 6; y < 144; y += 7) { gc.beginPath(); gc.moveTo(0, y); gc.lineTo(TW, y); gc.stroke(); } for (let x = 0; x < TW; x += 40) { gc.beginPath(); gc.moveTo(x, HZ); gc.lineTo(x - 8, 144); gc.stroke(); } }
    if (T.lava) for (let i = 0; i < 7; i++) { const x = R() * TW, y = 112 + R() * 26, rr = 10 + R() * 8; both(d => { gg.glow(x + d, y, 16, '#ff5a1a', .5); gg.ell(x + d, y, rr, 2.4, gg.lin(x + d - 10, 0, x + d + 10, 0, ['#a82a0a', '#ffb040', '#a82a0a']), 0); }); }
    if (['shire', 'amonhen', 'south', 'rhun', 'weather', 'eregion', 'helm'].includes(key)) for (let i = 0; i < 18; i++) { const x = R() * TW, y = HZ + 6 + R() * 46, r = .8 + R() * 1.6 * (y - HZ) / 40; both(d => gg.ell(x + d, y, r * 1.3, r * .8, gg.lin(0, y - r, 0, y + r, [sh(T.gd, .3), sh(T.gd, -.2)]), .25)); }
    const out = { sky, far, mid, ground, TW, HZ, s };
    layerCache.set(ck, out); if (layerCache.size > 6) layerCache.delete(layerCache.keys().next().value);
    return out;
  }

  return { landmark, drawEagle, draw, toCanvas, card, layers, dims, ANIMS, impactTime, animTime, background, icon, BODY, sh, rgba, ease, easeOut, P };
})();
