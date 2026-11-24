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
      const ph = el / 900 * TAU, s = Math.sin(ph), as = Math.abs(s);
      if (w === 'staff') Object.assign(b, { bob: -as * .8, aF: -1.75 + s * .05, wa: -1.57, aB: 1.15, glow: 1, cape: 1.2, lean: -.05 });
      else if (w === 'bow') Object.assign(b, { bob: -as * .6, aF: -.55 + s * .08, aB: .35, cape: 1, lean: -.04 });
      else if (['axe', 'hammer', 'mace', 'club'].includes(w)) Object.assign(b, { bob: -as * 3.4, aF: -1.9 + as * .5, wa: -2.4, aB: 1.6 - as * 2.8, cape: 1.5, jaw: as * .6 });
      else if (['sword', 'dagger', 'spear'].includes(w)) Object.assign(b, { bob: -as * 1.4, aF: -2.1 + s * .12, wa: -1.95, aB: .9 + s * .3, glow: 1, cape: 1.4, lean: -.06 });
      else Object.assign(b, { bob: -as * 3, aF: -1.6 + s * .1, wa: -1.57, aB: 1.4 - as * 2.6, cape: 1.4 });
      return b;
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
    if (type === 'spider') return look.size === 2 ? { h: 44, big: 1, w: 32 } : look.size ? { h: 30, big: 1, w: 22 } : { h: 14, big: 0, w: 10 };
    if (type === 'worm') return { h: 70, big: 1, w: 18 };
    if (type === 'watcher') return { h: 40, big: 1, w: 26 };
    if (type === 'engine') return { h: 34, big: 1, w: 26 };
    if (type === 'dragon') return look.huge ? { h: 76, big: 1, w: 46 } : { h: 50, big: 1, w: 30 };
    return { h: 58, big: 1, w: 26 };
  }

  /* ---------- Zeichenhilfen ---------- */
  const OL = 'rgba(18,12,20,.5)';
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
      if ((L.wear || 0) > .5) { const wv = Math.min(1, (L.wear - .5) / .35); c.strokeStyle = rgba(sh(L.cape, -.6), .8 * wv); c.lineWidth = .22; c.beginPath(); for (let i = 0; i < 5; i++) { const t2 = i / 4, hx = cx - B.tw / 2 - 1.2 - sway * .3 - t2 * (3 + sway * .9), hy = bot - t2 * 2.2; c.moveTo(hx, hy); c.lineTo(hx - .25 + (i % 2) * .4, hy - .9 - (i % 3) * .4); } c.stroke(); }
      if ((L.fame || 0) >= 2) { c.strokeStyle = '#e8c060'; c.lineWidth = .42; c.beginPath(); c.moveTo(cx - B.tw / 2 - 1.2 - sway * .3, bot); c.quadraticCurveTo(cx - B.tw / 2 - 3 - sway, bot - 1 + Math.sin(gt / 300) * .6, cx - B.tw / 2 - 4.2 - sway * 1.2, bot - 2.2); c.stroke(); }
      if ((L.fame || 0) >= 3) { g.ell(sF[0] - .7, top + .7, .6, .6, g.rad(sF[0] - .9, top + .5, .8, ['#fff4c0', '#d8a830', '#8a6018']), .2); }
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
      { const kx = knee[0], ky = knee[1]; c.save(); c.globalAlpha = .35; c.strokeStyle = sh(col, -.45); c.lineWidth = .18; c.beginPath(); c.moveTo(kx - B.lw * .3, ky - .2); c.quadraticCurveTo(kx, ky + .35, kx + B.lw * .32, ky - .1); c.stroke(); c.restore(); }
      if (B.feet) { const fc = front ? skin : sh(skin, -.2); g.fill(() => { c.moveTo(ank[0] - B.lw * .4, ank[1]); c.quadraticCurveTo(ank[0] - B.lw * .5, foot[1] + .5, ank[0] - .2, foot[1] + .5); c.lineTo(ank[0] + 2.4, foot[1] + .5); c.quadraticCurveTo(ank[0] + 2.8, foot[1] - .3, ank[0] + 1.4, foot[1] - .5); c.quadraticCurveTo(ank[0] + .6, ank[1] - .2, ank[0] - B.lw * .4, ank[1]); }, g.lin(0, ank[1], 0, foot[1] + .5, [sh(fc, .1), sh(fc, -.2)]), ow * .8); c.fillStyle = rgba(hair, .7); for (let i = 0; i < 4; i++) c.fillRect(ank[0] + .1 + i * .45, foot[1] - .7 - (i % 2) * .2, .25, .5); }
      else {
        const bc0 = front ? boots : sh(boots, -.3), sx = knee[0] + (ank[0] - knee[0]) * .38, sy = knee[1] + (ank[1] - knee[1]) * .38;
        g.taper([[sx, sy], ank], [B.lw * .92, B.lw * .66], bc0, ow * .8);
        g.taper([[sx, sy], [sx + (ank[0] - sx) * .12, sy + (ank[1] - sy) * .12]], [B.lw * .95, B.lw * .9], sh(bc0, .12), ow * .5);
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
    if ((L.wear || 0) > .3) { const wv = Math.min(1, (L.wear - .3) / .5), n = 2 + Math.round(wv * 4); c.save(); c.lineCap = 'round';
      for (let i = 0; i < n; i++) { const fx = cx - B.tw * .4 + ((i * 3.7) % 1) * B.tw * .55 + (i * 1.3) % (B.tw * .5), fy = top + 1 + ((i * 2.9) % (B.th - 2)), dx = .9 + (i % 3) * .3, dy = .6 + (i % 2) * .4;
        c.strokeStyle = `rgba(0,0,0,${.35 * wv})`; c.lineWidth = .16; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + dx, fy + dy); c.stroke(); c.strokeStyle = `rgba(255,250,235,${.4 * wv})`; c.lineWidth = .08; c.beginPath(); c.moveTo(fx + .08, fy - .06); c.lineTo(fx + dx + .08, fy + dy - .06); c.stroke(); }
      for (let i = 0; i < 3; i++) { c.fillStyle = `rgba(40,28,18,${.16 * wv})`; c.beginPath(); c.ellipse(cx - B.tw * .25 + i * B.tw * .22, hipY - 1 - (i % 2) * B.th * .3, 1.1, .7, i, 0, TAU); c.fill(); }
      c.restore(); }
    if (L.emblem && L.showEmblem) { const bd2 = L.beard, er = big ? 2.3 : B.tw < 6.5 ? 1.35 : 1.5; if (bd2 === 'dwarf') badge(c, g, L.emblem, cx - .15, hipY - 1.15, er * .78, L.emCol); else badge(c, g, L.emblem, cx - .15, top + B.th * (bd2 === 'long' ? .6 : L.armor ? .31 : .37), er, L.emCol); }
    if (L.fur) { for (let i = 0; i < 6; i++) g.ell(cx - B.tw / 2 + .4 + i * (B.tw - .8) / 5, top + .2 + Math.sin(i * 2.1) * .3, 1.5, 1.2, g.rad(cx, top - 1, B.tw, [sh(L.fur, .25), L.fur]), .3); }
    if (L.scarf) { g.ell(cx + .4, top + .4, B.tw * .52, 1.1, g.lin(0, top - 1, 0, top + 1.5, [sh(L.scarf, .2), L.scarf]), .35); g.fill(() => { c.moveTo(cx + 1.4, top + .8); c.quadraticCurveTo(cx + 2.4 + Math.sin(gt / 400) * .3, top + 3.5, cx + 1.8, top + 5.4); c.lineTo(cx + .8, top + 5); c.quadraticCurveTo(cx + 1.2, top + 3, cx + .4, top + 1); }, L.scarf, .3); }
    if (acc.includes('brooch')) { const bx = cx + B.tw / 2 - 1.4, by = top + 1.1; g.fill(() => { c.moveTo(bx, by - .9); c.quadraticCurveTo(bx + .9, by, bx, by + 1.1); c.quadraticCurveTo(bx - .9, by, bx, by - .9); }, g.lin(bx, by - 1, bx, by + 1, ['#b8e8a0', '#3a8a3a']), .25); g.limb([[bx, by + 1.1], [bx, by + 1.6]], .25, '#d8dce4', 0); }
    if (acc.includes('horn')) { c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - B.tw / 2 + .4, hipY - 2.6); c.quadraticCurveTo(cx - B.tw / 2 - 2.2, hipY - .6, cx - B.tw / 2 - 1.2, hipY + 1.6); c.stroke(); c.strokeStyle = g.lin(0, hipY - 3, 0, hipY + 2, ['#f4ecd8', '#a88a58']); c.lineWidth = 1; c.stroke(); }
    if (acc.includes('pouch')) g.rr(cx - B.tw / 2 - .6, hipY - 2.2, 1.8, 2.2, .5, '#6a4628', .3);
    const GR = L.gear || {};
    if (GR.a && GR.a.r >= 3) { const tc = GR.a.r >= 4 ? '#ffe08a' : '#d8c0ff'; c.strokeStyle = tc; c.lineWidth = .32; c.beginPath(); c.moveTo(cx - B.tw * .42, top + .7); c.lineTo(cx + .3, top + B.th * .36); c.lineTo(cx + B.tw * .44, top + .7); c.stroke(); c.strokeStyle = rgba(tc, .6); c.lineWidth = .22; c.beginPath(); c.moveTo(cx - B.tw * .38, hipY - 2); c.lineTo(cx + B.tw * .38, hipY - 2); c.stroke(); }
    if (GR.a && GR.a.r >= 4) { const pr = .55 + .25 * Math.sin(gt / 320); g.glow(cx + .3, top + B.th * .46, 2.6, '#ff9a30', pr); g.fill(() => { const ex = cx + .3, ey = top + B.th * .46; c.moveTo(ex, ey - 1); c.lineTo(ex + .7, ey); c.lineTo(ex, ey + 1); c.lineTo(ex - .7, ey); c.closePath(); }, '#fff2c0', .2); }
    if (GR.t && GR.t.r >= 2) { const ac = RCOL[GR.t.r], px = cx + B.tw * .18, py = top + B.th * .3; c.strokeStyle = '#d8c070'; c.lineWidth = .14; c.beginPath(); c.moveTo(cx - B.tw * .12, top + .2); c.quadraticCurveTo(px - .4, py - 1, px, py - .5); c.moveTo(cx + B.tw * .3, top + .3); c.quadraticCurveTo(px + .4, py - 1, px, py - .5); c.stroke(); g.ell(px, py, .55, .65, g.rad(px - .2, py - .2, .8, ['#ffffff', ac, sh(ac, -.4)]), .15); if (GR.t.r >= 3) g.glow(px, py, 1.8 + GR.t.r * .3, ac, .5 + .2 * Math.sin(gt / 280)); }
    if (L.shield) {
      const sw = big ? 7 : 4.4, shh = big ? 11 : 7.4, sx = cx + B.tw / 2 - 1.6, sy = top + 1;
      g.fill(() => { c.moveTo(sx, sy); c.lineTo(sx + sw, sy); c.lineTo(sx + sw, sy + shh * .55); c.quadraticCurveTo(sx + sw, sy + shh * .9, sx + sw / 2, sy + shh); c.quadraticCurveTo(sx, sy + shh * .9, sx, sy + shh * .55); c.closePath(); }, g.lin(sx, sy, sx + sw, sy + shh, [sh(L.shield, .35), L.shield, sh(L.shield, -.35)]), ow * 1.4);
      g.ell(sx + sw / 2, sy + shh * .42, sw * .17, sw * .17, g.rad(sx + sw / 2 - sw * .05, sy + shh * .38, sw * .2, ['#ffffff', sh(L.shield, .5), sh(L.shield, -.2)]), .3); c.strokeStyle = rgba(sh(L.shield, -.45), .7); c.lineWidth = .3; c.beginPath(); c.moveTo(sx + sw / 2, sy + .6); c.lineTo(sx + sw / 2, sy + shh - .8); c.stroke();
      c.strokeStyle = rgba('#ffffff', .35); c.lineWidth = .25; c.beginPath(); c.moveTo(sx + .4, sy + .5); c.lineTo(sx + sw - .4, sy + .5); c.stroke();
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
    if (L.glow) { g.glow(ex, ey, big ? 2.6 : 2, L.glow, .75); c.fillStyle = sh(L.glow, .4); c.beginPath(); c.ellipse(ex, ey, .55, .45, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(ex - 2, ey, .5, .4, 0, 0, TAU); c.fill(); }
    else if (!L.noface) {
      const blink = (p.fall || 0) > .5 ? .1 : (gt % 3700) < 110 ? .12 : 1, anger = Math.min(1, Math.max(p.jaw || 0, ((p.lean || 0) - .8) / 2));
      if (!(hunch || big)) {
        c.fillStyle = g.rad(ex, ey - .3, 1.1, [rgba(sh(skin, -.55), .4), rgba(skin, 0)]); c.beginPath(); c.ellipse(ex - .05, ey - .25, 1.05, .7, 0, 0, TAU); c.fill();
        c.fillStyle = rgba(sh(skin, .35), .35); c.beginPath(); c.ellipse(ex - .2, ey + .95, .8, .32, -.2, 0, TAU); c.fill();
        c.fillStyle = '#f4efe6'; c.beginPath(); c.moveTo(ex - .62, ey + .02); c.quadraticCurveTo(ex - .05, ey - .42 * blink, ex + .5, ey - .02); c.quadraticCurveTo(ex, ey + .3 * blink, ex - .62, ey + .02); c.fill();
        if (blink > .5) { c.fillStyle = g.rad(ex + .16, ey, .3, [sh(L.eyeC || '#5a4630', .35), L.eyeC || '#4a3a2a']); c.beginPath(); c.arc(ex + .16, ey, .27, 0, TAU); c.fill(); c.fillStyle = '#0a0808'; c.beginPath(); c.arc(ex + .2, ey, .13, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ex + .08, ey - .1, .07, 0, TAU); c.fill(); }
        c.strokeStyle = rgba('#1a0e08', .85); c.lineWidth = .2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - .66, ey + .02); c.quadraticCurveTo(ex - .05, ey - .46 * blink, ex + .54, ey - .02); c.stroke();
        c.strokeStyle = rgba(sh(skin, -.35), .6); c.lineWidth = .12; c.beginPath(); c.moveTo(ex - .5, ey - .42); c.quadraticCurveTo(ex, ey - .62, ex + .45, ey - .4); c.stroke();
        c.strokeStyle = sh(L.bc || hair, -.1); c.lineWidth = .34; c.beginPath(); c.moveTo(ex - .8, ey - .8 + anger * .05); c.quadraticCurveTo(ex - .05, ey - 1.1 + anger * .2, ex + .75, ey - .86 + anger * .42); c.stroke();
        if (L.age) { c.strokeStyle = rgba(sh(skin, -.5), .55); c.lineWidth = .1; c.beginPath(); c.moveTo(x0 + HW * .55, y0 + HH * .2); c.quadraticCurveTo(x0 + HW * .75, y0 + HH * .17, x0 + HW * .92, y0 + HH * .21); c.moveTo(x0 + HW * .58, y0 + HH * .27); c.quadraticCurveTo(x0 + HW * .76, y0 + HH * .24, x0 + HW * .9, y0 + HH * .28); c.moveTo(ex - .75, ey + .1); c.lineTo(ex - 1.15, ey - .1); c.moveTo(ex - .75, ey + .22); c.lineTo(ex - 1.15, ey + .34); c.moveTo(x0 + HW - .1, y0 + HH * .7); c.quadraticCurveTo(x0 + HW - .55, y0 + HH * .76, x0 + HW - .7, y0 + HH * .84); c.stroke(); }
        c.fillStyle = rgba(sh(skin, -.5), .7); c.beginPath(); c.ellipse(x0 + HW + .22, y0 + HH * .685, .14, .08, .3, 0, TAU); c.fill();
        c.strokeStyle = rgba(sh(skin, -.5), .8); c.lineWidth = .18; c.beginPath(); c.moveTo(x0 + HW - .75, y0 + HH * .775); c.quadraticCurveTo(x0 + HW - .25, y0 + HH * .775 + (p.jaw > .3 ? .5 : .08), x0 + HW + .12, y0 + HH * .765); c.stroke();
        c.fillStyle = rgba('#a84a44', .42); c.beginPath(); c.ellipse(x0 + HW - .15, y0 + HH * .81, .3, .12, 0, 0, TAU); c.fill(); c.fillStyle = rgba('#ffffff', .25); c.beginPath(); c.ellipse(x0 + HW - .1, y0 + HH * .795, .12, .04, 0, 0, TAU); c.fill();
        c.strokeStyle = rgba('#ffffff', .35); c.lineWidth = .1; c.beginPath(); c.moveTo(x0 + HW + .02, y0 + HH * .5); c.quadraticCurveTo(x0 + HW + .45, y0 + HH * .6, x0 + HW + .55, y0 + HH * .655); c.stroke();
        if (!L.ears && !['hood', 'helm', 'spikehelm'].includes(L.hat)) { g.ell(x0 + HW * .36, y0 + HH * .55, .55, .95, g.lin(x0 + 1.4, 0, x0 + 2.4, 0, [sh(skin, -.25), skin]), owH * .8, -.15); c.strokeStyle = rgba(sh(skin, -.5), .6); c.lineWidth = .14; c.beginPath(); c.arc(x0 + HW * .37, y0 + HH * .55, .32, -1.2, 1.6); c.stroke(); }
      } else { c.fillStyle = '#1a1010'; c.beginPath(); c.ellipse(ex, ey, .45, .55 * blink, 0, 0, TAU); c.fill(); }

      if (p.jaw > .2 && (hunch || big)) { c.fillStyle = '#2a0a0a'; c.fillRect(x0 + HW - 2.6, y0 + HH - 1.8, 2.4, .8 * p.jaw); }
    }
    if (!L.noface && L.tusks !== 0 && ['orc', 'goblin', 'uruk', 'troll'].includes(L.body)) {
      const tk = L.body === 'troll' ? 1.3 : 1; c.fillStyle = '#ece2c4'; c.strokeStyle = 'rgba(40,30,20,.7)'; c.lineWidth = .12;
      for (const [tx, th] of [[x0 + HW - .35, 1.1], [x0 + HW - 1.25, .8]]) { c.beginPath(); c.moveTo(tx - .22 * tk, y0 + HH * .9); c.lineTo(tx + .05, y0 + HH * .9 - th * tk); c.lineTo(tx + .26 * tk, y0 + HH * .9); c.closePath(); c.fill(); c.stroke(); }
      c.strokeStyle = rgba(sh(skin, .45), .7); c.lineWidth = .16; c.beginPath(); c.moveTo(x0 + HW * .45, y0 + HH * .28); c.lineTo(x0 + HW * .82, y0 + HH * .62); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = .08; c.beginPath(); for (let i = 0; i < 3; i++) { const t = .3 + i * .2; c.moveTo(x0 + HW * (.45 + .37 * t) - .15, y0 + HH * (.28 + .34 * t) + .12); c.lineTo(x0 + HW * (.45 + .37 * t) + .15, y0 + HH * (.28 + .34 * t) - .12); } c.stroke();
      if (!['helm', 'spikehelm', 'hood'].includes(L.hat)) { g.fill(() => { c.moveTo(x0 + HW * .22, y0 + HH * .34); c.quadraticCurveTo(x0 - .6, y0 + HH * .18, x0 - 1.7, y0 + HH * .1); c.quadraticCurveTo(x0 - .4, y0 + HH * .5, x0 + HW * .46, y0 + HH * .66); c.closePath(); }, g.lin(x0 - 1.6, 0, x0 + HW * .5, 0, [sh(skin, -.35), skin]), owH * .8); c.strokeStyle = rgba(sh(skin, .5), .55); c.lineWidth = .14; c.beginPath(); c.moveTo(x0 + HW * .25, y0 + HH * .48); c.quadraticCurveTo(x0 - .2, y0 + HH * .3, x0 - 1.2, y0 + HH * .16); c.stroke(); }
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
      // Ent-Krone: Zweige wachsen aus dem Kopf, darauf Laub in mehreren Tönen, das leicht im Wind wiegt
      const bark = sh(skin, -.25); c.strokeStyle = bark; c.lineCap = 'round';
      const tw = [[.15, -2.6, -3.8], [.35, -1.2, -4.6], [.55, .2, -4.9], [.75, 1.4, -4.2], [.9, 2.2, -3]];
      for (const [fx, dx, dy] of tw) { const bx = x0 + HW * fx, by = y0 + .6; c.lineWidth = .55; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + dx * .3, by + dy * .6, bx + dx, by + dy); c.stroke(); c.lineWidth = .3; c.beginPath(); c.moveTo(bx + dx * .55, by + dy * .62); c.lineTo(bx + dx * .55 + (dx < 0 ? -1.1 : 1.1), by + dy * .85); c.stroke(); }
      let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 46; i++) { const t = rnd(), lx = x0 + HW * (-.3 + t * 1.55) + (rnd() - .5) * 1.6, ly = y0 - 1 - Math.sin(t * Math.PI) * 4.2 + (rnd() - .5) * 2.2 + Math.sin(gt / 700 + i) * .18, rot = rnd() * TAU, tone = (rnd() - .5) * .5;
        c.fillStyle = sh(hair, tone); c.beginPath(); c.ellipse(lx, ly, 1.1, .48, rot, 0, TAU); c.fill(); c.strokeStyle = rgba(sh(hair, -.5), .35); c.lineWidth = .08; c.beginPath(); c.moveTo(lx - Math.cos(rot) * .8, ly - Math.sin(rot) * .8); c.lineTo(lx + Math.cos(rot) * .8, ly + Math.sin(rot) * .8); c.stroke(); }
      c.fillStyle = rgba(sh(hair, .5), .25); for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(x0 + HW * (.1 + i * .12), y0 - 3.4 + Math.abs(i - 3.5) * .5, .7, .3, .4, 0, TAU); c.fill(); }
    } else if (hs === 'lank') {
      // dünne, strähnige Haare (Gollum)
      c.strokeStyle = rgba(hair, .9); c.lineWidth = .16; c.lineCap = 'round'; c.beginPath();
      for (let i = 0; i < 6; i++) { const sx = x0 + HW * (.12 + i * .11), sy = y0 + .15 + Math.abs(i - 2.5) * .12; c.moveTo(sx, sy); c.quadraticCurveTo(sx - .9 - i * .1, sy + HH * .25, sx - 1.3 - i * .12 + Math.sin(gt / 700 + i) * .2, sy + HH * (.45 + (i % 3) * .08)); } c.stroke();
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
    if (!p.hide) { weapon(c, g, w, aF.h, wd, wp, B, K, wc, L, p, aB.h, ow, gt); if (L.wglow) sigGlow(c, g, L, w, aF.h, wd, K, gt); gearGlow(c, g, L, w, aF.h, wd, K, gt); }
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
    if (L.ring) { const hx = aF.h[0] + .2, hy = aF.h[1] - .15, one = L.ringOne, pulse = .55 + .25 * Math.sin(gt / 280); c.save(); c.globalCompositeOperation = 'lighter'; g.glow(hx, hy, (one ? 5 : 3.4) * K, L.ring, pulse); if (one) for (let i = 0; i < 6; i++) { const a = gt / 700 + i * TAU / 6; g.glow(hx + Math.cos(a) * 3.2 * K, hy + Math.sin(a) * 1.6 * K, .9, '#ff7a20', .7 * pulse); } c.restore(); c.strokeStyle = one ? '#ffe07a' : L.ring; c.lineWidth = .42; c.beginPath(); c.arc(hx, hy, B.lw * .32, 0, TAU); c.stroke(); }
    if (L.noface && L.robe && (L.hat === 'hood' || L.hat === 'spikehelm')) { c.save(); for (let i = 0; i < 16; i++) { const t = ((gt / 1900) + i / 16) % 1, hi = i % 4 === 0, bx = cx - B.tw * .3 + (i % 3) * B.tw * .3, by = hi ? -B.ll - B.th * .9 : -.6 - (i % 3) * B.ll * .35, px = bx - t * (7 + i % 5) + Math.sin(gt / 500 + i) * .6, py = by - t * (hi ? 2 + i % 3 : 3 + (i % 4) * 2), rr = .7 + t * 2.6, a = .34 * Math.sin(t * Math.PI), q = c.createRadialGradient(px, py, 0, px, py, rr * 1.4); q.addColorStop(0, `rgba(10,8,14,${a})`); q.addColorStop(.6, `rgba(16,12,22,${a * .5})`); q.addColorStop(1, 'rgba(16,12,22,0)'); c.fillStyle = q; c.beginPath(); c.ellipse(px, py, rr * 1.6, rr, -.4 + t, 0, TAU); c.fill(); } c.restore(); }
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
    if (L.rabbit) return drawRabbit(c, L, anim, el, gt);
    const g = P(c), k = L.size ? 1.3 : 1, fur = L.fur, belly = L.belly || sh(fur, .15), dark = sh(fur, -.35), farC = sh(fur, -.28), eye = L.eye || '#ffd040';
    let lean = 0, jaw = 0, bob = Math.sin(gt / 650) * .15, ph = 0, gait = 0, fall = 0, crouch = 0, headUp = 0;
    if (anim === 'walk') { ph = el / 380 * TAU; gait = 1; bob = -Math.abs(Math.sin(ph)) * .9 + .3; }
    else if (anim === 'attack' || anim === 'throw' || anim === 'shoot') { const q = clamp01(el / animTime('attack')); lean = Math.sin(q * Math.PI) * 5 - (q < .2 ? q * 7 : 0); jaw = clamp01(Math.sin(q * Math.PI) * 1.8 - .2); crouch = q < .25 ? q * 4 : 0; }
    else if (anim === 'shout') { const q = clamp01(el / animTime('shout')); jaw = Math.sin(q * Math.PI); headUp = Math.sin(q * Math.PI) * .7; }
    else if (anim === 'hurt') lean = -2.2 * (1 - clamp01(el / 300));
    else if (anim === 'dead') fall = ease(clamp01(el / 600));
    c.save(); c.scale(k, k); if (fall) { c.translate(0, -1); c.rotate(-1.4 * fall); c.translate(0, 1); }
    c.lineJoin = 'round'; c.lineCap = 'round';
    const by = bob + crouch, bx = lean, rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)], add = (p, v) => [p[0] + v[0], p[1] + v[1]];
    const legA = off => { if (!gait) return { th: 0, bend: 0 }; const t = ((ph / TAU + off) % 1 + 1) % 1; if (t < .5) return { th: -.55 + 1.1 * (t / .5), bend: 0 }; const s2 = (t - .5) / .5; return { th: .55 - 1.1 * s2, bend: Math.sin(s2 * Math.PI) }; };
    const legDraw = (pts, ws, col) => { const quad = (i, ex) => { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, Ln = Math.hypot(dx, dy) || 1, qx = -dy / Ln, qy = dx / Ln, r0 = ws[i] / 2 + ex, r1 = ws[i + 1] / 2 + ex; c.beginPath(); c.moveTo(x0 + qx * r0, y0 + qy * r0); c.lineTo(x1 + qx * r1, y1 + qy * r1); c.lineTo(x1 - qx * r1, y1 - qy * r1); c.lineTo(x0 - qx * r0, y0 - qy * r0); c.closePath(); c.fill(); }, joint = (i, ex) => { c.beginPath(); c.arc(pts[i][0], pts[i][1], ws[i] / 2 + ex, 0, TAU); c.fill(); };
      c.fillStyle = OL; for (let i = 0; i < pts.length - 1; i++) quad(i, .35); for (let i = 1; i < pts.length; i++) joint(i, .35);
      c.fillStyle = g.lin(pts[0][0] - 2, 0, pts[0][0] + 2, 0, [sh(col, .15), col, sh(col, -.2)]); for (let i = 0; i < pts.length - 1; i++) quad(i, 0); for (let i = 1; i < pts.length - 1; i++) joint(i, 0);
      const Z = pts[pts.length - 1]; g.ell(Z[0] + .5, Z[1] - .1, 1.05, .55, sh(col, -.1), .3); };
    const front = (x, off, col) => { const { th, bend } = legA(off), S = [bx + x, -9.4 + by], E = add(S, rot([-.6, 3.2], th)), W = add(E, rot([.4, 3.6], th + bend * 1.3)), Pw = add(W, rot([.5, 2.2], th + bend * 1.8)); legDraw([S, E, W, Pw], [3.2, 2.1, 1.25, 1.2], col); };
    const hind = (x, off, col) => { const { th, bend } = legA(off), H = [bx + x, -9.6 + by], St = add(H, rot([1.6, 3.2], th * .8)), Hk = add(St, rot([-2.4, 3.1], th - bend * .6)), Pw = add(Hk, rot([.6, 3.1], th * .5 - bend * 1.4)); legDraw([H, St, Hk, Pw], [4.4, 3, 1.4, 1.2], col); };
    // ferne Beine
    front(5.4, .5, farC); hind(-5.2, 0, farC);
    // buschiger Schwanz
    { const sw = gait ? Math.sin(ph) * 1.4 : Math.sin(gt / 800) * .8, t0 = [bx - 7.4, -11 + by];
      g.fill(() => { c.moveTo(t0[0] + .8, t0[1] - .8); c.bezierCurveTo(t0[0] - 3, t0[1] - 1.4, t0[0] - 4.6 + sw * .3, t0[1] + 2.2, t0[0] - 5 + sw, t0[1] + 5.6); c.bezierCurveTo(t0[0] - 3.6 + sw, t0[1] + 5.2, t0[0] - 1.6, t0[1] + 2.4, t0[0] + .6, t0[1] + 1.4); c.closePath(); }, g.lin(t0[0], t0[1], t0[0] - 4, t0[1] + 5, [fur, sh(fur, -.25), sh(belly, .1)]), .4); }
    // Rumpf
    const body = () => { c.moveTo(bx + 4.4, -12.6 + by); c.bezierCurveTo(bx + 1.6, -11.6 + by, bx - 2.6, -11.4 + by, bx - 5.4, -12.1 + by); c.bezierCurveTo(bx - 7.8, -12.4 + by, bx - 8.8, -10.4 + by, bx - 8.2, -8.4 + by); c.bezierCurveTo(bx - 7.6, -6.8 + by, bx - 5.6, -6.4 + by, bx - 4.4, -7.2 + by); c.bezierCurveTo(bx - 2, -7.8 + by, bx + 1.6, -7 + by, bx + 4.2, -6.4 + by); c.bezierCurveTo(bx + 6.6, -6.2 + by, bx + 8, -7.8 + by, bx + 7.8, -9.6 + by); c.bezierCurveTo(bx + 7.6, -11.4 + by, bx + 6.4, -12.6 + by, bx + 4.4, -12.6 + by); c.closePath(); };
    g.fill(body, g.lin(0, -12.6 + by, 0, -6.4 + by, [sh(fur, .12), fur, belly]), .45);
    c.save(); c.beginPath(); body(); c.clip(); c.fillStyle = g.rad(bx + 5, -10 + by, 3.6, [rgba(sh(fur, .3), .45), rgba(sh(fur, .3), 0)]); c.fillRect(bx, -14 + by, 9, 9); c.fillStyle = g.rad(bx - 5.4, -10 + by, 3.8, [rgba(sh(fur, .28), .4), rgba(sh(fur, .28), 0)]); c.fillRect(bx - 10, -14 + by, 9, 9);
    c.strokeStyle = rgba(dark, .45); c.lineWidth = .22; c.beginPath(); for (let i = 0; i < 9; i++) { const x = bx - 6 + i * 1.4, y = -11.6 + by + Math.sin(i) * .3; c.moveTo(x, y); c.lineTo(x - .6, y + 1.2); } c.stroke(); c.restore();
    // nahe Beine
    hind(-4.2, .5, fur); front(6.2, 0, fur);
    // Hals, Halskrause, Kopf
    const hx = bx + 10.2 + lean * .15, hy = -12.8 + by - headUp * 1.4;
    g.fill(() => { c.moveTo(bx + 4.2, -12.8 + by); c.quadraticCurveTo(bx + 7, -14.2 + by, hx - .6, hy - 1.6); c.lineTo(hx + .4, hy + 1.6); c.quadraticCurveTo(bx + 8.2, -8.4 + by, bx + 6.8, -7.4 + by); c.closePath(); }, g.lin(bx + 5, -14 + by, bx + 8, -8 + by, [sh(fur, .1), fur, belly]), .4);
    if (L.mane || L.size) { for (let i = 0; i < 9; i++) { const t = i / 8, x = bx + 3 + t * 5.6, y = -12.6 + by - t * 1.6 - headUp * t, l = 1.6 + Math.sin(i * 2.1) * .5; g.fill(() => { c.moveTo(x - .6, y + .4); c.lineTo(x - .2 - l * .3, y - l); c.lineTo(x + .7, y + .2); c.closePath(); }, sh(fur, -.3), .2); } }
    c.save(); c.translate(hx, hy); c.rotate(-headUp * .3 - lean * .02);
    const skull = () => { c.moveTo(-2.4, -.6); c.bezierCurveTo(-2.2, -2.8, .4, -3.2, 1.8, -2.1); c.bezierCurveTo(3, -1.6, 4.4, -1.2, 5.4, -.7); c.bezierCurveTo(5.9, -.4, 5.8, .4, 5.2, .5); c.lineTo(1.6, .9); c.bezierCurveTo(.2, 1.6, -1.6, 1.8, -2.3, .9); c.closePath(); };
    g.fill(() => { c.moveTo(1.2, .7); c.lineTo(5 - jaw * .3, .5 + jaw * 1.4); c.quadraticCurveTo(4.6, 1.3 + jaw * 1.9, 3.4, 1.4 + jaw * 1.6); c.quadraticCurveTo(1.6, 1.8 + jaw, .2, 1.6); c.closePath(); }, sh(fur, -.08), .35);
    if (jaw > .1) { g.fill(() => { c.moveTo(1.6, .8); c.lineTo(5, .5); c.lineTo(4.8, .5 + jaw * 1.3); c.lineTo(1.8, 1.4); c.closePath(); }, '#5a1414', 0); c.fillStyle = '#f4ece0'; for (const [tx, up] of [[4.6, 1], [3.6, 1], [4.4, -1], [3.2, -1]]) { c.beginPath(); c.moveTo(tx - .25, up > 0 ? .55 : .55 + jaw * 1.3); c.lineTo(tx, up > 0 ? 1.15 : jaw * 1.3 - .05); c.lineTo(tx + .25, up > 0 ? .55 : .55 + jaw * 1.3); c.fill(); } }
    g.fill(skull, g.lin(0, -3, 0, 1.6, [sh(fur, .16), fur, sh(belly, -.05)]), .4);
    c.fillStyle = rgba(belly, .7); c.beginPath(); c.moveTo(1.4, .6); c.quadraticCurveTo(3.4, .1, 5.2, .4); c.lineTo(5, .6); c.quadraticCurveTo(3, 1, 1.2, 1.1); c.fill();
    for (const [ex2, col] of [[-1.5, sh(fur, -.2)], [-.2, fur]]) g.fill(() => { c.moveTo(ex2 - .9, -1.8); c.lineTo(ex2 - .3 - headUp * .2, -4.6); c.lineTo(ex2 + .9, -2.2); c.closePath(); }, col, .3);
    c.fillStyle = rgba(dark, .8); c.beginPath(); c.moveTo(-.3, -2.1); c.lineTo(-.2, -3.8); c.lineTo(.4, -2.3); c.fill();
    g.ell(5.4, -.45, .55, .4, '#120c0c', 0); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(5.3, -.62, .15, 0, TAU); c.fill();
    g.glow(1.2, -1.2, 1.7, eye, .6); g.ell(1.25, -1.2, .52, .32, eye, .15, -.2); g.ell(1.35, -1.2, .14, .26, '#140808', 0);
    c.strokeStyle = rgba(dark, .6); c.lineWidth = .22; c.beginPath(); c.moveTo(.4, -1.7); c.lineTo(2, -1.5); c.stroke();
    c.restore();
    c.restore();
  }
  function drawRabbit(c, L, anim, el, gt) {
    const g = P(c), fur = L.fur, belly = L.belly || '#f4eee6'; let hop = 0, lean = 0;
    if (anim === 'walk') { const t = (el % 420) / 420; hop = Math.sin(t * Math.PI) * 2.6; lean = Math.cos(t * TAU) * .12; } else hop = Math.max(0, Math.sin(gt / 900)) * .2;
    c.save(); c.translate(0, -hop); c.rotate(-lean);
    g.ell(-4.4, -4.6, 1.3, 1.2, '#fbf8f2', .3);
    g.ell(-2.2, -3.2, 3.2, 2.6, g.lin(0, -6, 0, 0, [sh(fur, .1), fur]), .4);
    g.ell(-.6, -4.6, 4.2, 3.4, g.lin(0, -8, 0, -1, [sh(fur, .14), fur, belly]), .4);
    g.ell(-3.2, -.6, 2.4, .8, sh(fur, -.1), .35);
    g.ell(2.8, -1.2, .9, 1.6, fur, .3);
    const ear = (x, a, col) => { c.save(); c.translate(x, -8.6); c.rotate(a + Math.sin(gt / 500 + x) * .05); g.fill(() => { c.moveTo(-.7, 0); c.quadraticCurveTo(-1.2, -3.2, -.2, -4.9); c.quadraticCurveTo(.9, -3, .7, 0); c.closePath(); }, col, .3); c.fillStyle = 'rgba(240,170,170,.6)'; c.beginPath(); c.moveTo(-.3, -.4); c.quadraticCurveTo(-.6, -3, -.1, -4.1); c.quadraticCurveTo(.4, -2.6, .3, -.4); c.fill(); c.restore(); };
    ear(2.4, -.45, sh(fur, -.12));
    g.ell(3.2, -7.2, 2.4, 2.1, g.lin(0, -9, 0, -5, [sh(fur, .15), fur]), .4); g.ell(4.6, -6.6, 1.2, .95, belly, 0);
    ear(3.4, -.2, fur);
    g.ell(3.9, -7.6, .45, .5, '#1a1010', 0); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(4.05, -7.8, .14, 0, TAU); c.fill(); g.ell(5.5, -6.9, .32, .24, '#e07a8a', 0);
    c.restore();
  }

  function drawHorse(c, L, anim, el, gt) {
    const g = P(c), pony = !!L.pony, fur = L.fur, mane = L.mane || sh(fur, -.45), belly = L.belly || sh(fur, -.12), white = (([r0, g0, b0]) => (r0 * .3 + g0 * .59 + b0 * .11) / 255)(rgb(fur)) > .7;
    const dark = sh(fur, white ? -.22 : -.34), farC = sh(fur, white ? -.16 : -.28), hoofC = white ? '#5a5048' : '#2a2220';
    let ph = gt / 1500 * TAU, gait = 0, bob = Math.sin(ph) * .18, nod = Math.sin(gt / 1700) * .025, pitch = 0;
    if (anim === 'walk') { ph = el / 520 * TAU; gait = 1; bob = -Math.abs(Math.sin(ph)) * 1.1 + .4; nod = Math.sin(ph * 2) * .06; pitch = Math.sin(ph) * .025; }
    else if (anim === 'dead') { c.save(); const f = ease(clamp01(el / 700)); c.translate(0, -2 * f); c.rotate(-1.35 * f); c.translate(0, 2 * f); }
    c.save(); if (pony) { c.scale(.84, .76); } c.lineJoin = 'round'; c.lineCap = 'round';
    const by = bob, rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)], add = (p, v) => [p[0] + v[0], p[1] + v[1]];
    // Beinbewegung: Stütz- und Schwungphase
    const legA = off => { if (!gait) return { th: Math.sin(gt / 2300 + off) * .03, bend: 0 }; const t = ((ph / TAU + off) % 1 + 1) % 1; if (t < .58) return { th: -.42 + .84 * (t / .58), bend: 0 }; const s = (t - .58) / .42; return { th: .42 - .84 * s, bend: Math.sin(s * Math.PI) }; };
    const front = (x, off, col, far) => { const { th, bend } = legA(off), S = [x, -16.4 + by], E = add(S, rot([-.7, 4.4], th)), K = add(E, rot([.3, 4.9], th)), F = add(K, rot([.15, 4.5], th + bend * 1.7)), Hf = add(F, rot([.75, 1.6], th + bend * 2.1));
      legDraw([S, E, K, F, Hf], [4.4, 3.1, 1.95, 1.8, 1.3], col); if (L.socks && !far) legDraw([F, Hf], [1.5, 1.2], '#f2eee6');
      hoof(Hf, th + bend * 2.1, far); };
    const hind = (x, off, col, far) => { const { th, bend } = legA(off), H0 = [x, -15.6 + by], St = add(H0, rot([2.1, 4.2], th * .8)), Hk = add(St, rot([-2.7, 4.5], th - bend * .5)), F = add(Hk, rot([.25, 4.5], th * .6 - bend * 1.3)), Hf = add(F, rot([.8, 1.55], th * .6 - bend * 1.6));
      legDraw([H0, St, Hk, F, Hf], [6, 4.3, 2.2, 1.8, 1.3], col); if (L.socks && !far) legDraw([F, Hf], [1.5, 1.2], '#f2eee6');
      hoof(Hf, th * .6 - bend * 1.6, far); };
    const legDraw = (pts, ws, col) => { const quad = (i, ex) => { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = x1 - x0, dy = y1 - y0, Ln = Math.hypot(dx, dy) || 1, qx = -dy / Ln, qy = dx / Ln, r0 = ws[i] / 2 + ex, r1 = ws[i + 1] / 2 + ex; c.beginPath(); c.moveTo(x0 + qx * r0, y0 + qy * r0); c.lineTo(x1 + qx * r1, y1 + qy * r1); c.lineTo(x1 - qx * r1, y1 - qy * r1); c.lineTo(x0 - qx * r0, y0 - qy * r0); c.closePath(); c.fill(); };
      const joint = (i, ex) => { c.beginPath(); c.arc(pts[i][0], pts[i][1], ws[i] / 2 + ex, 0, TAU); c.fill(); };
      c.fillStyle = OL; for (let i = 0; i < pts.length - 1; i++) quad(i, .38); for (let i = 1; i < pts.length; i++) joint(i, .38);
      const A = pts[0], Z = pts[pts.length - 1]; c.fillStyle = g.lin(A[0] - 2, 0, A[0] + 2, 0, [sh(col, .16), col, sh(col, -.22)]); for (let i = 0; i < pts.length - 1; i++) quad(i, 0); for (let i = 1; i < pts.length - 1; i++) joint(i, 0);
      c.strokeStyle = rgba(sh(col, .4), .35); c.lineWidth = .22; c.beginPath(); c.moveTo(pts[1][0] + .5, pts[1][1]); for (let i = 2; i < pts.length; i++) c.lineTo(pts[i][0] + ws[i] * .3, pts[i][1]); c.stroke(); };
    const hoof = (p, a, far) => { c.save(); c.translate(p[0], p[1]); c.rotate(-a * .4); g.fill(() => { c.moveTo(-.95, -1.1); c.lineTo(.95, -1.1); c.lineTo(1.35, .3); c.lineTo(-1.05, .3); c.closePath(); }, far ? sh(hoofC, -.2) : hoofC, .3); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-.7, -1, .5, 1); c.restore(); };
    // ferne Beine
    front(7.2, .5, farC, 1); hind(-7.6, .0, farC, 1);
    // Schweif
    { const tr = [-11.6, -19.4 + by], sw = gait ? Math.sin(ph) * 2.2 : Math.sin(gt / 900) * 1.2, len = pony ? 12 : 13.5;
      const tail = (dx, w, ln, col, ow) => g.fill(() => { const tx = tr[0] - 2.6 + sw + dx, ty = tr[1] + ln; c.moveTo(tr[0] + .8, tr[1] - .7); c.bezierCurveTo(tr[0] - 3.4 + dx, tr[1] + .6, tr[0] - 3.6 + sw * .5 + dx, tr[1] + ln * .5, tx, ty); c.bezierCurveTo(tr[0] - 1.6 + sw * .7 + dx + w, tr[1] + ln * .62, tr[0] + w * .45, tr[1] + 3.2, tr[0] + 1.6, tr[1] + .5); c.closePath(); }, col, ow);
      tail(-.9, 1.4, len * .9, sh(mane, -.25), .3); tail(.7, 1.6, len * .82, sh(mane, -.1), .25); tail(0, 2.6, len, g.lin(tr[0], tr[1], tr[0] - 2, tr[1] + len, [sh(mane, .18), mane, sh(mane, -.22)]), .35);
      c.strokeStyle = rgba(sh(mane, .45), .35); c.lineWidth = .18; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(tr[0] - .2 - i * .3, tr[1] + 1.2); c.bezierCurveTo(tr[0] - 2.4 - i * .3, tr[1] + 4, tr[0] - 2.8 + sw * .5 - i * .2, tr[1] + len * .6, tr[0] - 2.2 + sw - i * .25, tr[1] + len - .6); } c.stroke(); }
    // Rumpf
    const body = () => { c.moveTo(5.6, -21.7 + by); c.bezierCurveTo(3.4, -20.6 + by, -.5, -20.2 + by, -2.6, -20.5 + by); c.bezierCurveTo(-5.2, -20.9 + by, -8, -21.6 + by, -10.2, -20.6 + by); c.bezierCurveTo(-12.5, -19.6 + by, -12.9, -16.2 + by, -11.6, -13.6 + by); c.bezierCurveTo(-10.6, -11.8 + by, -8.6, -11.2 + by, -6.6, -11.6 + by); c.bezierCurveTo(-3, -10.9 + by, 2.2, -10.8 + by, 5.6, -11.8 + by); c.bezierCurveTo(8.2, -12.4 + by, 10.6, -13.8 + by, 10.6, -16.2 + by); c.bezierCurveTo(10.6, -18.4 + by, 9.6, -20.2 + by, 8.4, -21 + by); c.closePath(); };
    g.fill(body, g.lin(0, -22 + by, 0, -11 + by, [sh(fur, .14), fur, fur, belly, sh(belly, -.18)]), .5);
    // Muskelspiel: Schulter, Hinterhand, Rippen, Bauch
    c.save(); c.beginPath(); body(); c.clip();
    c.fillStyle = g.rad(6.6, -17.6 + by, 5, [rgba(sh(fur, .3), .5), rgba(sh(fur, .3), 0)]); c.fillRect(1, -23 + by, 11, 12);
    c.fillStyle = g.rad(-7.6, -17.8 + by, 5.6, [rgba(sh(fur, .3), .5), rgba(sh(fur, .3), 0)]); c.fillRect(-14, -23 + by, 12, 12);
    c.fillStyle = g.lin(0, -14 + by, 0, -11 + by, [rgba(dark, 0), rgba(dark, .45)]); c.fillRect(-13, -14 + by, 25, 4);
    c.strokeStyle = rgba(dark, .35); c.lineWidth = .3; c.beginPath(); c.moveTo(3.4, -19.6 + by); c.bezierCurveTo(4.6, -17 + by, 4.4, -14.4 + by, 3.2, -12.6 + by); c.moveTo(-4.6, -20 + by); c.bezierCurveTo(-3.8, -17.4 + by, -4.4, -14.6 + by, -5.8, -12.4 + by); c.moveTo(-1, -15.6 + by); c.quadraticCurveTo(1, -14.6 + by, 2.6, -15.4 + by); c.moveTo(-1.6, -14.2 + by); c.quadraticCurveTo(.6, -13.2 + by, 2.2, -13.9 + by); c.stroke();
    c.strokeStyle = rgba(sh(fur, .5), .4); c.lineWidth = .45; c.beginPath(); c.moveTo(5, -21.2 + by); c.bezierCurveTo(1.5, -20.1 + by, -5, -20.3 + by, -10, -20.2 + by); c.stroke();
    if (L.dapple) { c.fillStyle = rgba(sh(fur, .35), .35); for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(-10 + (i * 37 % 19), -19 + by + (i * 13 % 6), .7, 0, TAU); c.fill(); } }
    c.restore();
    // nahe Beine
    hind(-6.4, .5, fur, 0); front(8.2, 0, fur, 0);
    c.fillStyle = g.rad(-7.4, -17.2 + by, 4.8, [rgba(sh(fur, .25), .35), rgba(sh(fur, .25), 0)]); c.beginPath(); c.arc(-7.4, -17.2 + by, 4.8, 0, TAU); c.fill();
    // Sattelzeug
    const gear = L.gear;
    if (gear) {
      g.fill(() => { c.moveTo(-4.8, -21.1 + by); c.bezierCurveTo(-1.5, -20.2 + by, 1.6, -20.4 + by, 4.2, -21.4 + by); c.lineTo(4.6, -16.6 + by); c.quadraticCurveTo(0, -15 + by, -4.6, -16.4 + by); c.closePath(); }, g.lin(0, -21 + by, 0, -15.5 + by, [sh(gear, .1), gear, sh(gear, -.3)]), .35);
      c.strokeStyle = rgba('#f0d080', .7); c.lineWidth = .28; c.beginPath(); c.moveTo(4.4, -17 + by); c.quadraticCurveTo(0, -15.5 + by, -4.4, -16.8 + by); c.stroke();
      g.fill(() => { c.moveTo(-3.8, -23 + by); c.quadraticCurveTo(-3.4, -21 + by, -1, -21 + by); c.quadraticCurveTo(1.6, -21 + by, 2.6, -22.6 + by); c.lineTo(3.2, -21.2 + by); c.quadraticCurveTo(2, -19.8 + by, -.6, -19.9 + by); c.quadraticCurveTo(-3.6, -20 + by, -4.4, -21.4 + by); c.closePath(); }, g.lin(0, -23 + by, 0, -19.8 + by, ['#8a5a32', '#5a3a1e', '#3a2412']), .3);
      g.limb([[2.6, -20 + by], [3.2, -14.6 + by], [3.6, -11.6 + by]], .55, '#3a2616', .2);
      g.limb([[.2, -20.2 + by], [.4, -14.8 + by]], .3, '#2a1a10', 0); g.fill(() => { c.moveTo(-.5, -14.8 + by); c.lineTo(1.3, -14.8 + by); c.lineTo(1, -13.6 + by); c.lineTo(-.2, -13.6 + by); c.closePath(); }, '#b8b0a0', .25);
      if (L.breast !== 0) { c.strokeStyle = '#3a2616'; c.lineWidth = .55; c.beginPath(); c.moveTo(4.2, -18.6 + by); c.quadraticCurveTo(8.4, -15.2 + by, 10.4, -16.6 + by); c.stroke(); g.ell(9.4, -15.8 + by, .55, .55, '#e0c070', .2); }
    }
    // Hals & Kopf (nicken um den Widerrist)
    c.save(); c.translate(6, -20 + by); c.rotate(nod + pitch); c.translate(-6, 20 - by);
    const neck = () => { c.moveTo(4.4, -21.8 + by); c.bezierCurveTo(7.4, -26.6 + by, 10.2, -30.2 + by, 13.4, -31 + by); c.lineTo(15.6, -27.2 + by); c.bezierCurveTo(14.2, -23.4 + by, 12.4, -19.2 + by, 10.6, -16.2 + by); c.lineTo(8, -15.8 + by); c.closePath(); };
    g.fill(neck, g.lin(7, -29 + by, 13, -18 + by, [sh(fur, .16), fur, sh(fur, -.12)]), 0); c.strokeStyle = OL; c.lineWidth = .45; c.beginPath(); c.moveTo(4.4, -21.8 + by); c.bezierCurveTo(7.4, -26.6 + by, 10.2, -30.2 + by, 13.4, -31 + by); c.moveTo(15.6, -27.2 + by); c.bezierCurveTo(14.2, -23.4 + by, 12.4, -19.2 + by, 10.6, -16.2 + by); c.stroke();
    c.save(); c.beginPath(); neck(); c.clip(); c.strokeStyle = rgba(dark, .3); c.lineWidth = .3; c.beginPath(); c.moveTo(12.6, -27 + by); c.bezierCurveTo(11.6, -23.6 + by, 10.6, -20.6 + by, 9.6, -17.6 + by); c.stroke(); c.fillStyle = g.lin(0, -30 + by, 0, -24 + by, [rgba(sh(fur, .4), .3), rgba(sh(fur, .4), 0)]); c.fillRect(4, -31 + by, 10, 8); c.restore();
    // Kopf
    const head = () => { c.moveTo(13.2, -31.2 + by); c.bezierCurveTo(16.2, -31 + by, 19.4, -28.4 + by, 21.6, -25 + by); c.bezierCurveTo(22.5, -23.6 + by, 22.2, -22.2 + by, 20.9, -21.8 + by); c.bezierCurveTo(20, -21.6 + by, 19.2, -22 + by, 18.6, -22.6 + by); c.bezierCurveTo(17.4, -23.4 + by, 16, -24.2 + by, 14.8, -25.4 + by); c.bezierCurveTo(13.6, -26.6 + by, 12.8, -28.6 + by, 13.2, -31.2 + by); c.closePath(); };
    g.fill(head, g.lin(14, -31 + by, 21, -22 + by, [sh(fur, .18), fur, sh(fur, -.1)]), .45);
    c.save(); c.beginPath(); head(); c.clip();
    c.fillStyle = g.rad(15.6, -26.6 + by, 2.8, [rgba(sh(fur, .32), .55), rgba(sh(fur, .32), 0)]); c.fillRect(12, -30 + by, 7, 7);
    c.strokeStyle = rgba(dark, .45); c.lineWidth = .3; c.beginPath(); c.arc(15.8, -26.4 + by, 2.3, -.3, 2.4); c.stroke();
    c.fillStyle = g.lin(19, 0, 22.5, 0, [rgba(dark, 0), rgba(dark, .45)]); c.fillRect(18.6, -26 + by, 4, 5);
    if (L.blaze) { c.fillStyle = 'rgba(250,248,240,.92)'; c.beginPath(); c.moveTo(14.8, -30.8 + by); c.bezierCurveTo(17.6, -29.4 + by, 19.8, -26.6 + by, 21.2, -24.2 + by); c.lineTo(20.4, -23.8 + by); c.bezierCurveTo(19, -26.2 + by, 17.2, -28.4 + by, 14.6, -30 + by); c.closePath(); c.fill(); }
    c.restore();
    // Ohren
    const ear = (x, tip, col) => g.fill(() => { c.moveTo(x - .7, -30.6 + by); c.quadraticCurveTo(x - .5, -32.6 + by, x + tip, -34.4 + by); c.quadraticCurveTo(x + 1, -32.2 + by, x + .9, -30.4 + by); c.closePath(); }, col, .3);
    const flick = Math.max(0, Math.sin(gt / 700) - .92) * 6;
    ear(13.3, .2 - flick * .2, sh(fur, -.2)); ear(14.4, .5 + flick * .1, fur); c.strokeStyle = rgba(dark, .6); c.lineWidth = .22; c.beginPath(); c.moveTo(14.4, -31 + by); c.lineTo(14.8, -33.2 + by); c.stroke();
    // Auge, Nüster, Maul
    g.ell(16.7, -28.3 + by, .78, .58, '#140c08', .2, -.35); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(16.95, -28.5 + by, .2, 0, TAU); c.fill(); c.strokeStyle = rgba(dark, .55); c.lineWidth = .2; c.beginPath(); c.arc(16.7, -28.3 + by, 1.05, 3.6, 5.9); c.stroke();
    c.fillStyle = '#1a1010'; c.beginPath(); c.ellipse(21.15, -23.5 + by, .42, .26, -.6, 0, TAU); c.fill(); c.strokeStyle = rgba('#1a1010', .55); c.lineWidth = .2; c.beginPath(); c.moveTo(21.9, -22.5 + by); c.quadraticCurveTo(21, -22.2 + by, 19.9, -22.4 + by); c.stroke();
    // Mähne: fließendes Band entlang des Kamms, dazu Strähnen und Schopf
    { const sw = gait ? Math.sin(ph * 2) * .8 : Math.sin(gt / 700) * .3, thick = pony ? 3.4 : 2.6, crest = t => { const u = 1 - t; return [u * u * u * 13.6 + 3 * u * u * t * 10.2 + 3 * u * t * t * 7.4 + t * t * t * 4.6, (u * u * u * -31.2 + 3 * u * u * t * -30.4 + 3 * u * t * t * -26.8 + t * t * t * -21.9) + by]; };
      const band = (off, col) => g.fill(() => { const N = 14; c.moveTo(...crest(0)); for (let i = 1; i <= N; i++) { const p2 = crest(i / N); c.lineTo(p2[0] + .3, p2[1] - .5); } for (let i = N; i >= 0; i--) { const t = i / N, p2 = crest(t), w = thick * (.55 + .45 * Math.sin(t * Math.PI)) + off, wv = Math.sin(t * 9 + gt / 500) * .35; c.lineTo(p2[0] - w * .55 + sw * (1 - t), p2[1] + w + wv); } c.closePath(); }, col, off ? 0 : .3);
      band(.5, sh(mane, -.25)); band(0, g.lin(8, -31 + by, 8, -20 + by, [sh(mane, .2), mane, sh(mane, -.2)]));
      c.strokeStyle = rgba(sh(mane, .5), .4); c.lineWidth = .16; c.beginPath(); for (let i = 1; i < 9; i++) { const t = i / 9, p2 = crest(t), w = thick * (.55 + .45 * Math.sin(t * Math.PI)); c.moveTo(p2[0] + .2, p2[1]); c.quadraticCurveTo(p2[0] - w * .2 + sw * .5, p2[1] + w * .5, p2[0] - w * .5 + sw * (1 - t), p2[1] + w * .95); } c.stroke();
      g.fill(() => { c.moveTo(13.2, -31.4 + by); c.quadraticCurveTo(15.6, -31.2 + by, 16.2, -28.6 + by + (gait ? Math.sin(ph * 2) * .3 : 0)); c.quadraticCurveTo(15, -29.4 + by, 13.6, -29.8 + by); c.closePath(); }, sh(mane, .1), .22); }
    // Zaumzeug
    if (gear || L.bridle) { const lc = gear ? sh(gear, -.45) : '#3a2616'; c.strokeStyle = lc; c.lineWidth = .36; c.beginPath(); c.moveTo(14.2, -30.4 + by); c.lineTo(15.4, -25.6 + by); c.lineTo(19.6, -22.9 + by); c.moveTo(18.2, -26.8 + by); c.lineTo(19, -22.4 + by); c.moveTo(14.6, -29.6 + by); c.lineTo(16, -30 + by); c.stroke();
      c.strokeStyle = '#e0c070'; c.lineWidth = .25; c.beginPath(); c.arc(19.7, -22.9 + by, .5, 0, TAU); c.stroke();
      c.strokeStyle = lc; c.lineWidth = .3; c.beginPath(); c.moveTo(19.6, -22.9 + by); c.quadraticCurveTo(13, -18 + by, L.rein ? 5.4 : 4, (L.rein ? -23.4 : -21) + by); c.stroke();
      if (L.bells) for (let i = 0; i < 3; i++) g.ell(15.2 + i * 1.3, -25.4 + i * .9 + by, .32, .32, '#f0d070', .15); }
    c.restore();
    c.restore();
    if (anim === 'dead') c.restore();
  }
  /* Radagasts Schlitten, gezogen von Rhosgobel-Kaninchen */
  function sled(c, L, anim, el, gt) {
    const g = P(c), run = anim === 'walk';
    for (let i = 0; i < 3; i++) { const rx = 10 + i * 6.2 - (i % 2) * .8, ry = -(i % 2) * 1.6; c.strokeStyle = 'rgba(70,46,24,.85)'; c.lineWidth = .3; c.beginPath(); c.moveTo(4.6, -4.6); c.quadraticCurveTo(rx - 2, -5 + ry, rx - .6, -4.4 + ry); c.stroke(); c.save(); c.translate(rx, ry); c.scale(.62, .62); drawRabbit(c, Object.assign({ rabbit: 1 }, L), run ? 'walk' : 'idle', run ? (el + i * 140) % 420 : 0, gt + i * 377); c.restore(); }
    g.fill(() => { c.moveTo(-12, -.2); c.lineTo(5, -.2); c.quadraticCurveTo(8.4, -.4, 8.2, -3.2); c.quadraticCurveTo(7.8, -1.4, 5.4, -1.2); c.lineTo(-12, -1.2); c.closePath(); }, '#6a4a2a', .35);
    for (const x of [-9, -3, 3]) g.limb([[x, -1.2], [x + .4, -3.2]], .6, '#5a3a1e', .2);
    g.fill(() => { c.moveTo(-11.4, -3.2); c.lineTo(4.6, -3.2); c.lineTo(5.6, -6.4); c.lineTo(-10.8, -6.8); c.closePath(); }, g.lin(0, -7, 0, -3, ['#9a7448', '#6a4a2a']), .35);
    c.strokeStyle = 'rgba(40,24,10,.5)'; c.lineWidth = .2; c.beginPath(); for (let y = -6; y < -3.3; y += .9) { c.moveTo(-11, y); c.lineTo(5, y); } c.stroke();
    g.fill(() => { c.moveTo(-10.4, -6.6); c.quadraticCurveTo(-6, -9.6, -1, -7.8); c.quadraticCurveTo(2.4, -9.2, 4.8, -6.4); c.closePath(); }, g.lin(0, -9.4, 0, -6.4, ['#c8b090', '#8a6a48']), .3);
    g.ell(-7.6, -8.4, 1.6, 1.1, '#5a7a3a', .25); g.ell(-5.8, -8.9, 1.1, .9, '#6a8a44', .2);
  }
  function drawEagle(c, L, gt) {
    const g = P(c), f = Math.sin(gt / 260), fur = L.fur, belly = L.belly, gold = '#d8a850';
    c.lineJoin = 'round'; c.lineCap = 'round';
    const wing = (side, col, back) => { c.save(); c.scale(side, 1); c.rotate(-f * .28); const lift = -f * 6;
      g.fill(() => { c.moveTo(0, -1.4); c.bezierCurveTo(6, -5 + lift * .4, 12, -7 + lift * .8, 19, -5 + lift); c.lineTo(17, -2.4 + lift * .9); c.bezierCurveTo(11, -1.6 + lift * .5, 5, .6, 0, 2.2); c.closePath(); }, g.lin(0, -6, 0, 2, [sh(col, .18), col, sh(col, -.2)]), .4);
      for (let i = 0; i < 8; i++) { const t = i / 7, x = 9 + t * 11, y = -3.4 + lift * (.55 + t * .45) + t * 1.6, a2 = .25 + t * .55 - f * .08, len = 6 - Math.abs(t - .55) * 3.4;
        c.save(); c.translate(x, y); c.rotate(a2); g.fill(() => { c.moveTo(-.9, 0); c.quadraticCurveTo(-.6, len * .7, .2, len); c.quadraticCurveTo(1, len * .6, .9, 0); c.closePath(); }, i % 2 ? sh(col, -.28) : sh(col, -.18), .3); c.restore(); }
      c.strokeStyle = rgba(sh(col, .5), .35); c.lineWidth = .2; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(3 + i * 3, -2.4 + lift * .25 * i / 3); c.quadraticCurveTo(5 + i * 3, -.6 + lift * .2, 6 + i * 3, .4); } c.stroke();
      c.restore(); };
    wing(-1, sh(fur, -.2), 1);
    g.fill(() => { c.moveTo(-2.6, 5.4); c.lineTo(-3.4, 10); c.lineTo(0, 11.2); c.lineTo(3.4, 10); c.lineTo(2.6, 5.4); c.closePath(); }, g.lin(0, 5, 0, 11, [fur, sh(fur, -.25)]), .4);
    g.fill(() => { c.moveTo(-3.4, -1); c.bezierCurveTo(-3.8, 3, -2.4, 6.4, 0, 6.8); c.bezierCurveTo(2.4, 6.4, 3.8, 3, 3.4, -1); c.bezierCurveTo(2.4, -3.4, -2.4, -3.4, -3.4, -1); c.closePath(); }, g.lin(0, -3, 0, 7, [sh(belly, .1), belly, sh(fur, -.1)]), .45);
    c.strokeStyle = rgba(sh(fur, -.4), .4); c.lineWidth = .22; c.beginPath(); for (let i = 0; i < 6; i++) { const y = -.4 + i * 1.1; c.moveTo(-1.8 + (i % 2) * .6, y); c.quadraticCurveTo(-1.2 + (i % 2) * .6, y + .6, -.6 + (i % 2) * .6, y); c.moveTo(.6 + (i % 2) * .4, y + .4); c.quadraticCurveTo(1.2 + (i % 2) * .4, y + 1, 1.8 + (i % 2) * .4, y + .4); } c.stroke();
    for (const s2 of [-1, 1]) { g.limb([[s2 * 1.2, 5.8], [s2 * 1.6, 7.6]], .7, '#e0b040', .25); c.strokeStyle = '#2a2018'; c.lineWidth = .3; c.beginPath(); c.moveTo(s2 * 1.6, 7.6); c.lineTo(s2 * 2.2, 8.3); c.moveTo(s2 * 1.6, 7.6); c.lineTo(s2 * 1.4, 8.5); c.stroke(); }
    wing(1, fur, 0);
    g.ell(1.8, -4.2, 2.6, 2.3, g.lin(0, -6.5, 0, -2, [sh(gold, .25), gold, sh(fur, .05)]), .4);
    g.fill(() => { c.moveTo(3.6, -5); c.quadraticCurveTo(6.6, -4.9, 6.4, -2.9); c.quadraticCurveTo(5.9, -3.6, 5.2, -3.4); c.lineTo(3.8, -3.2); c.closePath(); }, g.lin(3.6, -5, 6.4, -3, ['#f8d860', '#d89a20']), .3);
    g.ell(2.9, -4.8, .5, .42, '#1a0c06', 0); c.fillStyle = '#f0b030'; c.beginPath(); c.arc(2.95, -4.85, .22, 0, TAU); c.fill(); c.fillStyle = '#140804'; c.beginPath(); c.arc(3, -4.85, .1, 0, TAU); c.fill();
    c.strokeStyle = rgba('#3a2010', .7); c.lineWidth = .3; c.beginPath(); c.moveTo(2, -5.5); c.lineTo(3.6, -5.2); c.stroke();
  }


  /* ---------- Spinnen ---------- */
  function drawSpider(c, L, anim, el, gt) {
    const g = P(c), k = L.size === 2 ? 3.2 : L.size ? 2.2 : 1, col = L.body, legC = sh(col, -.1), hair = sh(col, .35);
    let lean = 0, bob = Math.sin(gt / 520) * .25 * k, gait = 0, ph = 0, raise = 0, fall = 0, fang = .15 + Math.max(0, Math.sin(gt / 380)) * .15;
    if (anim === 'walk') { gait = 1; ph = el / 320 * TAU; bob = Math.sin(ph * 2) * .3 * k; }
    if (anim === 'attack' || anim === 'shoot' || anim === 'throw') { const q = clamp01(el / animTime('attack')); lean = (Math.sin(q * Math.PI) * 4.5 - (q < .25 ? q * 5 : 0)) * k * .6; raise = Math.sin(q * Math.PI); fang = .2 + raise * .8; }
    if (anim === 'hurt') lean = -2 * k * (1 - clamp01(el / 300));
    if (anim === 'dead') fall = ease(clamp01(el / 600));
    c.save(); if (fall) { c.translate(0, -6 * k); c.scale(1, 1 - 1.7 * fall); c.translate(0, 6 * k); }
    c.lineJoin = 'round'; c.lineCap = 'round';
    const cx = lean, cy = -8 * k + bob, DIR = [-1.3, -.55, .6, 1.35];
    const leg = (i, far) => { const d = DIR[i], base = [cx + (.4 + i * 1.05) * k, cy + .3 * k], sw = gait ? Math.sin(ph + i * 1.6 + (far ? Math.PI : 0)) * 1.6 * k : Math.sin(gt / 900 + i) * .2 * k, lift = gait ? Math.max(0, Math.cos(ph + i * 1.6 + (far ? Math.PI : 0))) * 1.4 * k : 0;
      const up = !far && i === 3 ? raise : 0, reach = (8.8 + Math.abs(d) * 1.4) * k * (far ? .88 : 1);
      const knee = [base[0] + d * reach * .42 + sw * .4, cy - (6.6 + (i === 1 || i === 2 ? 1.6 : 0)) * k - up * 4 * k - lift * .5], ank = [base[0] + d * reach * .78 + sw * .8, cy - 1.2 * k - up * 6 * k], foot = [base[0] + d * reach + sw + up * 2 * k, up ? cy - 6 * k : -.3 - lift];
      const lc = far ? sh(legC, -.35) : legC, w = (L.size ? 1.25 : .72);
      g.limb([base, knee], w * 1.25, lc, .3); g.limb([knee, ank], w, lc, .3); g.limb([ank, foot], w * .65, lc, .25);
      c.fillStyle = rgba(hair, far ? .15 : .35); for (const p of [knee, ank]) { c.beginPath(); c.arc(p[0], p[1], w * .62, 0, TAU); c.fill(); }
      if (!far) { c.strokeStyle = rgba(hair, .35); c.lineWidth = .14 * k; c.beginPath(); for (let j = 1; j < 5; j++) { const t = j / 5, x = base[0] + (knee[0] - base[0]) * t, y = base[1] + (knee[1] - base[1]) * t; c.moveTo(x, y); c.lineTo(x - d * .5 * k, y - .7 * k); } c.stroke(); } };
    for (let i = 0; i < 4; i++) leg(i, 1);
    // Hinterleib mit Haaren und Zeichnung
    const ax = cx - 5.4 * k, ay = cy - 1.6 * k, arx = 6.8 * k, ary = 5.6 * k;
    c.save(); c.translate(ax, ay); c.rotate(-.18);
    c.strokeStyle = rgba(sh(col, -.2), .9); c.lineWidth = .3 * k; c.beginPath(); for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, r1x = arx * .98, r1y = ary * .98; c.moveTo(Math.cos(a) * r1x, Math.sin(a) * r1y); c.lineTo(Math.cos(a) * (r1x + .7 * k), Math.sin(a) * (r1y + .7 * k)); } c.stroke();
    g.ell(0, 0, arx, ary, g.rad(-arx * .3, -ary * .45, arx * 1.3, [sh(col, .32), col, sh(col, -.4)]), L.size ? .8 : .45);
    c.fillStyle = L.mark; c.globalAlpha = .85; c.beginPath(); c.moveTo(-arx * .55, -ary * .15); c.quadraticCurveTo(0, -ary * .55, arx * .45, -ary * .2); c.quadraticCurveTo(0, -ary * .25, -arx * .55, -ary * .15); c.fill();
    for (let i = 0; i < 3; i++) { c.beginPath(); const x = -arx * .35 + i * arx * .3; c.moveTo(x - .9 * k, ary * .05); c.lineTo(x, ary * .35); c.lineTo(x + .9 * k, ary * .05); c.lineTo(x, ary * .2); c.closePath(); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.12)'; c.beginPath(); c.ellipse(-arx * .25, -ary * .5, arx * .45, ary * .18, -.2, 0, TAU); c.fill();
    c.restore();
    // Kopfbrust
    g.ell(cx + 2 * k, cy - .3 * k, 3.9 * k, 3.1 * k, g.rad(cx + 1.4 * k, cy - 1.6 * k, 4.6 * k, [sh(col, .35), col, sh(col, -.35)]), L.size ? .8 : .45);
    c.strokeStyle = rgba(sh(col, -.5), .6); c.lineWidth = .2 * k; c.beginPath(); c.moveTo(cx + .4 * k, cy - 2.4 * k); c.quadraticCurveTo(cx + 2.6 * k, cy - 1.2 * k, cx + 5 * k, cy - 1.8 * k); c.stroke();
    // Giftklauen
    for (const s2 of [0, 1]) { const fx = cx + (5.2 + s2 * .5) * k, fy = cy + .8 * k; g.fill(() => { c.moveTo(fx - .7 * k, fy - .6 * k); c.quadraticCurveTo(fx + .9 * k, fy, fx + .5 * k, fy + 1.4 * k); c.lineTo(fx + (.2 + fang) * k, fy + (2.4 + fang * .6) * k); c.lineTo(fx - .1 * k, fy + 1.3 * k); c.quadraticCurveTo(fx - .6 * k, fy + .4 * k, fx - .9 * k, fy); c.closePath(); }, s2 ? sh(col, -.1) : sh(col, -.3), .3); }
    // Augenkranz
    const eyes = [[5.3, -1.5, .62], [4.7, -1.2, .55], [5.9, -.9, .4], [4.3, -2, .4], [5, -2.4, .34], [5.8, -2.1, .3], [3.9, -1.4, .28], [6.1, -1.5, .26]];
    for (let i = 0; i < (L.size ? 8 : 6); i++) { const [ex, ey, er] = eyes[i], x = cx + ex * k, y = cy + ey * k; g.glow(x, y, er * 2.6 * k, L.eye, .55); g.ell(x, y, er * k, er * k, '#0a0608', 0); c.fillStyle = L.eye; c.beginPath(); c.arc(x + er * .2 * k, y - er * .2 * k, er * .5 * k, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(x + er * .35 * k, y - er * .35 * k, er * .18 * k, 0, TAU); c.fill(); }
    for (let i = 0; i < 4; i++) leg(i, 0);
    c.restore();
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

  /* ---------- Wächter im Wasser: Kopf im dunklen Teich, viele Fangarme ---------- */
  function drawWatcher(c, L, anim, el, gt) {
    const g = P(c), sk = L.skin || '#2e3a34', lt = sh(sk, .28), dk = sh(sk, -.42), eye = L.eye || '#c8ffb0';
    const act = ['attack', 'cast', 'shoot', 'throw'].includes(anim), q = act ? clamp01(el / animTime(anim)) : 0, lunge = act ? Math.sin(q * Math.PI) : 0;
    const flinch = anim === 'hurt' ? 1 - clamp01(el / 300) : 0, sink = anim === 'dead' ? ease(clamp01(el / 1100)) * 46 : 0;
    const arm = (bx, len, ph, w0, front, reach) => {
      const n = 11, pts = []; let x = bx, y = 1 + sink * .6, a = -Math.PI / 2 + Math.sin(gt / 700 + ph) * .25;
      for (let i = 0; i < n; i++) { pts.push([x, y]); const t = i / (n - 1), curl = Math.sin(gt / 520 + ph + t * 3) * (.18 + t * .32) * (1 - reach * .8) - flinch * .2; a += curl + reach * (front ? .13 : 0); x += Math.cos(a) * len / n * (1 - flinch * .3); y += Math.sin(a) * len / n * (1 - flinch * .3); }
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n - 1; i++) { const t = i / (n - 1), w = w0 * (1 - t * .85); c.strokeStyle = pass ? (i % 2 ? sk : sh(sk, .06)) : 'rgba(10,14,12,.6)'; c.lineWidth = pass ? w : w + .9; c.beginPath(); c.moveTo(pts[i][0], pts[i][1]); c.lineTo(pts[i + 1][0], pts[i + 1][1]); c.stroke(); }
      c.strokeStyle = rgba(lt, .55); c.lineWidth = .5; c.beginPath(); pts.forEach((p2, i) => i ? c.lineTo(p2[0] - .6, p2[1]) : c.moveTo(p2[0] - .6, p2[1])); c.stroke();
      c.fillStyle = 'rgba(230,220,200,.55)'; for (let i = 2; i < n - 1; i += 2) { const t = i / (n - 1); c.beginPath(); c.arc(pts[i][0] + .8, pts[i][1], w0 * (1 - t * .85) * .22, 0, TAU); c.fill(); }
    };
    c.save(); c.beginPath(); c.rect(-70, -130, 140, 128.5); c.clip();
    // hintere Fangarme
    arm(-24, 30, 0, 3.4, 0, 0); arm(-14, 36, 1.7, 3.8, 0, 0); arm(20, 32, 4.2, 3.4, 0, 0);
    // Kopf
    const hx = -3, hy = -9 + sink - lunge * 2;
    g.ell(hx, hy, 13, 10, g.rad(hx - 3, hy - 4, 16, [lt, sk, dk]), .7);
    for (let i = 0; i < 6; i++) g.ell(hx - 8 + i * 3.2, hy - 6 + Math.abs(i - 2.5) * 1.1, 1.5, 1.1, rgba(lt, .5), 0);
    for (const [ex, ey, r] of [[hx + 5, hy - 2, 2.4], [hx + 9.5, hy - .5, 1.9]]) { g.glow(ex, ey, r * 2.8, eye, .7); g.ell(ex, ey, r, r * .8, '#f4ffe8', .3); g.ell(ex + .4, ey, r * .35, r * .7, '#101810', 0); }
    // vordere Fangarme, einer schnellt beim Angriff nach vorn
    arm(-6, 30, 2.6, 3.6, 0, 0); arm(8, 34 + lunge * 26, 5.4, 4.2, 1, lunge); arm(15, 26, 3.3, 3, 0, lunge * .4);
    c.restore();
    // dunkler Teich: ovale Wasserfläche mit weichem Rand, Wellenringe um die Fangarme
    c.save(); c.translate(-2, .5); c.scale(1, .2); const pg = c.createRadialGradient(0, 0, 0, 0, 0, 40); pg.addColorStop(0, 'rgba(8,18,20,.97)'); pg.addColorStop(.75, 'rgba(14,30,32,.9)'); pg.addColorStop(1, 'rgba(20,40,40,0)'); c.fillStyle = pg; c.beginPath(); c.arc(0, 0, 40, 0, TAU); c.fill(); c.restore();
    c.save(); c.beginPath(); c.ellipse(-2, .5, 34, 6.4, 0, 0, TAU); c.clip();
    c.fillStyle = 'rgba(6,14,16,.9)'; c.beginPath(); c.moveTo(-40, 8); for (let x = -40; x <= 38; x += 2) c.lineTo(x, -1.6 + Math.sin(x * .32 + gt / 300) * .8 + Math.sin(x * .11 - gt / 900) * .6); c.lineTo(38, 8); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(170,220,210,.45)'; c.lineWidth = .4; c.beginPath(); for (let x = -40; x <= 38; x += 2) c[x === -40 ? 'moveTo' : 'lineTo'](x, -1.6 + Math.sin(x * .32 + gt / 300) * .8 + Math.sin(x * .11 - gt / 900) * .6); c.stroke(); c.restore();
    for (let i = 0; i < 3; i++) { const k = (gt / 1400 + i / 3) % 1; c.strokeStyle = `rgba(170,220,210,${.35 * (1 - k)})`; c.lineWidth = .4; c.beginPath(); c.ellipse(-3 + (i - 1) * 14, -1, 4 + k * 10, (4 + k * 10) * .2, 0, 0, TAU); c.stroke(); }
  }

  /* ---------- Ork-Katapult mit Bedienmannschaft ---------- */
  function drawEngine(c, L, anim, el, gt) {
    const g = P(c), wood = L.wood || '#6a4a2a', wl = sh(wood, .22), wd = sh(wood, -.38), iron = L.iron || '#4a4a4e', fire = L.fire || '#ff7a20';
    const act = ['attack', 'cast', 'shoot', 'throw'].includes(anim), q = act ? clamp01(el / animTime(anim)) : 0, dead = anim === 'dead' ? ease(clamp01(el / 800)) : 0;
    const COCK = Math.PI - .28, FIRED = Math.PI * 1.5 - .12;
    let a = dead ? COCK - dead * .6 : COCK; if (act) a = q < .22 ? COCK - Math.sin(q / .22 * Math.PI) * .04 : q < .4 ? lerp(COCK, FIRED, ease((q - .22) / .18)) : q < .7 ? FIRED : lerp(FIRED, COCK, ease((q - .7) / .3));
    const loaded = !act || q < .38 || q > .92, roll = anim === 'walk' ? gt / 140 : 0, rock = anim === 'hurt' ? Math.sin(clamp01(el / 300) * Math.PI * 3) * .05 * (1 - clamp01(el / 300)) : 0;
    // Bedienmannschaft (Ork hinter dem Katapult)
    if (L.crew && !dead) { c.save(); c.translate(-21, 0); drawHum(c, { body: 'goblin', skin: L.skin || '#6f7f3a', hair: '#1a1a1a', hs: 'wild', tunic: '#4a3a2a', pants: '#3a2e22', wc: '#8a8a80', wpn: 'dagger' }, poseAt(act ? 'attack' : anim === 'walk' ? 'walk' : 'idle', el, 'dagger', gt), gt); c.restore(); }
    c.save(); c.translate(0, -4.5); c.rotate(rock - dead * .07); c.translate(0, 4.5 + dead * 1.2);
    // Räder hinten
    const wheel = (x, r) => { g.ell(x, -r, r, r, g.rad(x - 1, -r - 1, r * 1.3, [wl, wood, wd]), .6); c.save(); c.translate(x, -r); c.rotate(roll); c.strokeStyle = wd; c.lineWidth = .7; for (let i = 0; i < 6; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(0, 0); c.lineTo(r * .86, 0); c.stroke(); } c.restore(); g.ell(x, -r, r * .3, r * .3, iron, .3); c.strokeStyle = iron; c.lineWidth = .8; c.beginPath(); c.arc(x, -r, r - .3, 0, TAU); c.stroke(); };
    wheel(-9, 4.6);
    // Gestell
    g.rr(-15, -9.5, 30, 3.6, .8, g.lin(0, -9.5, 0, -6, [wl, wood, wd]));
    g.limb([[-5, -8], [-1.5, -21]], 2, wood); g.limb([[5, -8], [1.5, -21]], 2, wd); g.limb([[-3.6, -14], [3.6, -14]], 1.2, wd);
    g.limb([[5.5, -21.5], [9, -8]], 1.4, wd);
    g.rr(3.5, -23, 5, 2, .5, g.lin(0, -23, 0, -21, [wl, wd])); // Prellbalken
    // Wurfarm
    const px = 0, py = -15, la = 22, ex = px + Math.cos(a) * la, ey = py + Math.sin(a) * la, cx2 = px - Math.cos(a) * 6, cy2 = py - Math.sin(a) * 6;
    g.limb([[cx2, cy2], [ex, ey]], 1.8, wl);
    g.rr(cx2 - 2.6, cy2, 5.2, 5, .8, g.lin(0, cy2, 0, cy2 + 5, [sh(iron, .2), iron, sh(iron, -.3)])); // Gegengewicht
    c.save(); c.translate(ex, ey); c.rotate(a + Math.PI / 2); g.fill(() => { c.moveTo(-3, 0); c.quadraticCurveTo(0, 3.6, 3, 0); c.closePath(); }, wd, .5); c.restore();
    if (loaded && !dead) { const lx = ex + Math.cos(a + Math.PI / 2) * -1.4, ly = ey + Math.sin(a + Math.PI / 2) * -1.4; g.ell(lx, ly - 1, 2.4, 2.2, '#2a2420', .4); g.glow(lx, ly - 2.4, 5 + Math.sin(gt / 90) * .8, fire, .75); g.ell(lx, ly - 2.4, 1.2, 1.6, '#ffe0a0', 0); }
    g.ell(px, py, 1.3, 1.3, iron, .4);
    if (dead) { c.save(); c.translate(9, -1.4); c.rotate(dead * 1.3); g.ell(0, 0, 4.6, 1.4, wood, .5); c.restore(); } else wheel(9, 4.6);
    c.restore();
    if (dead) { for (let i = 0; i < 4; i++) { const fx2 = -10 + i * 6, fl = 4 + Math.sin(gt / 110 + i * 1.7) * 1.6; g.glow(fx2, -8 - fl * .6, fl * 1.3, fire, .5 * dead); } c.fillStyle = `rgba(40,36,34,${.3 * dead})`; for (let i = 0; i < 4; i++) { const k = (gt / 1800 + i / 4) % 1; c.beginPath(); c.arc(-4 + i * 3 + k * 6, -14 - k * 26, 2 + k * 5, 0, TAU); c.fill(); } }
  }

  /* ---------- Olifant ---------- */
  function drawOlifant(c, L, anim, el, gt) {
    const g = P(c), sk = L.skin, dk = sh(sk, -.35), red = '#8a1e1a', gold = '#e0b84a';
    let lean = 0, bob = (Math.sin(gt / 900) + 1) * .4, ph = 0, gait = 0, rear = 0, trunk = 0, fall = 0;
    if (anim === 'walk') { gait = 1; ph = el / 600 * TAU; bob = Math.abs(Math.sin(ph)) * 1; }
    if (anim === 'attack' || anim === 'throw') { const q = clamp01(el / animTime('attack')); rear = -Math.sin(Math.min(1, q * 2) * Math.PI) * 4; lean = q > .4 ? Math.sin((q - .4) / .6 * Math.PI) * 7 : -q * 4; trunk = Math.sin(q * Math.PI); }
    if (anim === 'hurt') lean = -3 * (1 - clamp01(el / 300));
    if (anim === 'dead') fall = ease(clamp01(el / 700));
    if (fall) { c.save(); c.rotate(-fall * .5); c.translate(-fall * 6, fall * 6); }
    c.lineJoin = 'round'; c.lineCap = 'round';
    const leg = (x, off, far) => { const a = gait ? Math.sin(ph + off) * 2.6 : 0, col = far ? sh(sk, -.3) : sk, top = [x + lean, -24 + bob], kn = [x + lean + a * .5, -11], ft = [x + lean + a, -2];
      g.taper([top, kn], [10, 7.4], col, .7); g.taper([kn, ft], [7.4, 7.8], col, .7); g.ell(kn[0], kn[1], 3.8, 1.8, col, 0);
      c.strokeStyle = rgba(dk, .5); c.lineWidth = .4; c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(kn[0] - 3, kn[1] - 1 + i * 1.2); c.quadraticCurveTo(kn[0], kn[1] + i * 1.2, kn[0] + 3, kn[1] - 1 + i * 1.2); } c.stroke();
      g.ell(ft[0], ft[1] + .4, 4.4, 2, g.lin(0, ft[1] - 2, 0, ft[1] + 2, [col, sh(col, -.25)]), .6); for (let i = -1; i <= 1; i++) g.ell(ft[0] + i * 2 + 1, ft[1] + 1.4, .9, .55, '#e8dcc0', .3); };
    leg(-18, Math.PI, 1); leg(10, 0, 1);
    const by = bob + rear * .5;
    const body = () => { c.moveTo(16 + lean, -36 + by); c.bezierCurveTo(10 + lean, -44 + by, -4 + lean, -44 + by, -16 + lean, -40 + by); c.bezierCurveTo(-26 + lean, -37 + by, -30 + lean, -28 + by, -27 + lean, -20 + by); c.bezierCurveTo(-24 + lean, -14 + by, -14 + lean, -13 + by, -2 + lean, -14 + by); c.bezierCurveTo(8 + lean, -14 + by, 16 + lean, -16 + by, 19 + lean, -24 + by); c.closePath(); };
    g.fill(body, g.rad(-6 + lean, -38 + by, 32, [sh(sk, .22), sk, dk]), .8);
    c.save(); c.beginPath(); body(); c.clip(); c.strokeStyle = rgba(dk, .4); c.lineWidth = .35;
    c.beginPath(); for (let i = 0; i < 26; i++) { const x = -26 + (i * 37 % 44) + lean, y = -38 + (i * 23 % 22) + by; c.moveTo(x, y); c.quadraticCurveTo(x + 1.4, y + .6, x + 2.8, y); } c.stroke();
    c.fillStyle = rgba('#a02a1a', .55); for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-20 + i * 4 + lean, -36 + by); c.lineTo(-17 + i * 4 + lean, -36 + by); c.lineTo(-19 + i * 4 + lean, -18 + by); c.lineTo(-22 + i * 4 + lean, -18 + by); c.fill(); }
    c.restore();
    leg(-12, 0, 0); leg(16, Math.PI, 0);
    // Schabracke mit Goldfransen
    const ty = -42 + bob + rear;
    g.fill(() => { c.moveTo(-17 + lean, ty + 1); c.quadraticCurveTo(-5 + lean, ty - 2, 8 + lean, ty + 1); c.lineTo(9 + lean, ty + 15); c.lineTo(-18 + lean, ty + 15); c.closePath(); }, g.lin(0, ty, 0, ty + 15, ['#b8322a', red, '#5a1210']), .6);
    c.strokeStyle = gold; c.lineWidth = .7; c.beginPath(); c.moveTo(-18 + lean, ty + 13.6); c.lineTo(9 + lean, ty + 13.6); c.moveTo(-17 + lean, ty + 3); c.quadraticCurveTo(-5 + lean, ty, 8 + lean, ty + 3); c.stroke();
    c.strokeStyle = rgba(gold, .9); c.lineWidth = .35; c.beginPath(); for (let x = -17.6; x < 9; x += 1.1) { c.moveTo(x + lean, ty + 15); c.lineTo(x + lean + .2, ty + 16.8 + Math.sin(gt / 300 + x) * .3); } c.stroke();
    g.fill(() => { c.moveTo(-6 + lean, ty + 6); c.lineTo(-3 + lean, ty + 9); c.lineTo(-6 + lean, ty + 12); c.lineTo(-9 + lean, ty + 9); c.closePath(); }, gold, .3);
    // Kriegsturm
    const tb = ty - 1;
    g.rr(-15 + lean, tb - 11, 20, 11, .8, g.lin(-15, 0, 5, 0, ['#5a3a22', '#7a5230', '#4a2e1a']), .6);
    for (let i = 0; i < 5; i++) g.rr(-15 + lean + i * 4.2, tb - 13.4, 2.6, 2.6, .3, '#6a4428', .4);
    c.strokeStyle = 'rgba(30,18,8,.6)'; c.lineWidth = .3; c.beginPath(); for (let i = 1; i < 4; i++) { c.moveTo(-15 + lean, tb - 11 + i * 2.75); c.lineTo(5 + lean, tb - 11 + i * 2.75); } c.stroke();
    for (const sx of [-11, -4]) { g.ell(sx + lean, tb - 5.5, 2.6, 2.6, g.rad(sx + lean - .8, tb - 6.4, 3, ['#d8a040', '#8a2a1a']), .5); g.ell(sx + lean, tb - 5.5, .7, .7, '#e8c060', .2); }
    g.limb([[3 + lean, tb - 13], [3 + lean, tb - 26]], .7, '#3a2414', .3);
    const fw = Math.sin(gt / 260) * 1.2; g.fill(() => { c.moveTo(3.4 + lean, tb - 26); c.quadraticCurveTo(8 + lean, tb - 25 + fw, 12 + lean, tb - 24.4 - fw); c.lineTo(10 + lean, tb - 22); c.lineTo(12 + lean, tb - 20); c.quadraticCurveTo(8 + lean, tb - 20.6 + fw, 3.4 + lean, tb - 21); c.closePath(); }, red, .4);
    c.strokeStyle = '#140e0c'; c.lineWidth = .7; c.beginPath(); c.moveTo(6 + lean, tb - 22); c.bezierCurveTo(8 + lean, tb - 25 + fw, 6.4 + lean, tb - 24 + fw, 8.4 + lean, tb - 25.2); c.stroke();
    // Kopf, Ohr, Stoßzähne, Rüssel
    const hx = 20 + lean * 1.1, hy = -34 + bob + rear, flap = Math.sin(gt / 700) * .12;
    c.save(); c.translate(hx - 7, hy - 4); c.rotate(flap); g.fill(() => { c.moveTo(0, -6); c.bezierCurveTo(-9, -9, -11, 4, -6, 10); c.bezierCurveTo(-3, 13, 2, 9, 2, 4); c.closePath(); }, g.rad(-4, 0, 11, [sh(sk, .08), sh(sk, -.25)]), .7); c.strokeStyle = rgba(dk, .5); c.lineWidth = .35; c.beginPath(); c.moveTo(-1, -3); c.quadraticCurveTo(-6, 0, -5, 7); c.moveTo(-2, 1); c.quadraticCurveTo(-7, 4, -7, 8); c.stroke(); c.restore();
    g.ell(hx, hy, 9, 9.6, g.rad(hx + 2, hy - 4, 12, [sh(sk, .26), sk, dk]), .8);
    g.fill(() => { c.moveTo(hx - 3, hy - 8.6); c.quadraticCurveTo(hx + 3, hy - 11, hx + 7, hy - 6); c.lineTo(hx + 5, hy - 4); c.quadraticCurveTo(hx + 1, hy - 7.6, hx - 3, hy - 6); c.closePath(); }, red, .4); c.strokeStyle = gold; c.lineWidth = .4; c.beginPath(); c.moveTo(hx - 3, hy - 6.2); c.quadraticCurveTo(hx + 1, hy - 7.8, hx + 5, hy - 4.2); c.stroke();
    g.ell(hx + 3.6, hy - 2.6, 1, .75, '#140806', .2); c.fillStyle = 'rgba(255,220,160,.6)'; c.beginPath(); c.arc(hx + 3.9, hy - 2.85, .25, 0, TAU); c.fill(); c.strokeStyle = rgba(dk, .6); c.lineWidth = .3; c.beginPath(); c.arc(hx + 3.6, hy - 2.6, 1.8, 3.4, 5.6); c.stroke();
    const tusk = (dx, dy, len, w) => { g.fill(() => { c.moveTo(hx + 4 + dx, hy + 4 + dy); c.bezierCurveTo(hx + 10 + dx + len * .2, hy + 10 + dy - trunk * 2, hx + 14 + dx + len * .6, hy + 6 + dy - trunk * 4, hx + 15 + dx + len, hy - 1 + dy - trunk * 5); c.bezierCurveTo(hx + 12 + dx + len * .5, hy + 4 + dy - trunk * 3, hx + 8 + dx, hy + 6 + dy + w, hx + 4 + dx, hy + 6.4 + dy + w); c.closePath(); }, g.lin(hx, hy, hx + 16, hy, ['#d8ccb0', '#f8f2e4', '#e8dcc0']), .5); };
    tusk(-2, 1.4, 4, .6);
    c.lineCap = 'round'; const tsw = Math.sin(gt / 600) * 2, tp = t => { const u = 1 - t, x0 = hx + 6, y0 = hy + 3, x1 = hx + 12 + trunk * 6 + tsw, y1 = hy + 12 - trunk * 14, x2 = hx + 8 + trunk * 12 + tsw, y2 = hy + 22 - trunk * 26; return [u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2]; };
    for (let i = 0; i < 12; i++) { const a = tp(i / 12), b2 = tp((i + 1) / 12), w = 4.4 - i * .22; g.limb([a, b2], w, i % 2 ? sk : sh(sk, -.06), .45); }
    c.strokeStyle = rgba(dk, .55); c.lineWidth = .3; c.beginPath(); for (let i = 1; i < 12; i++) { const a = tp(i / 12), w = 2.1 - i * .1; c.moveTo(a[0] - w, a[1] - .3); c.lineTo(a[0] + w, a[1] + .3); } c.stroke();
    tusk(0, 0, 7, 1); c.strokeStyle = gold; c.lineWidth = .9; c.beginPath(); c.moveTo(hx + 10.6, hy + 6); c.lineTo(hx + 11.4, hy + 8.4); c.stroke();
    if (fall) c.restore();
  }
  function drawDragon(c, L, anim, el, gt) {
    const g = P(c), sk = L.skin, bl = L.belly;
    const smooth = (pts, ws, col, spikes, belly) => { const N = pts.length, side = (i, sgn, ex) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], Ln = Math.hypot(dx, dy) || 1, r = ws[i] / 2 + ex; return [pts[i][0] - dy / Ln * r * sgn, pts[i][1] + dx / Ln * r * sgn]; };
      const path = ex => { c.beginPath(); c.moveTo(...side(0, 1, ex)); for (let i = 1; i < N; i++) c.lineTo(...side(i, 1, ex)); for (let i = N - 1; i >= 0; i--) c.lineTo(...side(i, -1, ex)); c.closePath(); };
      if (spikes) for (let i = 1; i < N - 1; i += 1) { const p0 = side(i, -1, 0), a = pts[i - 1], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], Ln = Math.hypot(dx, dy) || 1, h = ws[i] * .45 + .8; g.fill(() => { c.moveTo(p0[0] - dx / Ln * 1.4, p0[1] - dy / Ln * 1.4); c.lineTo(p0[0] + dy / Ln * h, p0[1] - dx / Ln * h); c.lineTo(p0[0] + dx / Ln * 1.4, p0[1] + dy / Ln * 1.4); c.closePath(); }, sh(sk, -.35), .3); }
      c.fillStyle = OL; path(.6); c.fill(); const A = pts[0], Z = pts[N - 1]; c.fillStyle = g.lin(A[0], A[1] - ws[0], A[0], A[1] + ws[0], [sh(col, .25), col, sh(col, -.35)]); path(0); c.fill();
      if (belly) { c.save(); path(0); c.clip(); c.strokeStyle = rgba(bl, .85); c.lineWidth = Math.max(...ws) * .28; c.beginPath(); for (let i = 0; i < N; i++) { const q = side(i, 1, -ws[i] * .16); i ? c.lineTo(...q) : c.moveTo(...q); } c.stroke(); c.strokeStyle = rgba(sh(bl, -.45), .5); c.lineWidth = .3; c.beginPath(); for (let i = 1; i < N; i++) { const q = side(i, 1, -ws[i] * .05), q2 = side(i, 1, -ws[i] * .3); c.moveTo(...q); c.lineTo(...q2); } c.stroke(); c.restore(); } };
    const bez = (P0, P1, P2, P3, n) => { const out = []; for (let i = 0; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]); } return out; };
    let lean = 0, jaw = .12, rear = 0, fall = 0; const flap = Math.sin(gt / 320);
    if (anim === 'attack' || anim === 'throw') { const q = clamp01(el / animTime('attack')); lean = Math.sin(q * Math.PI) * 9 - (q < .25 ? q * 8 : 0); jaw = Math.sin(q * Math.PI); }
    if (anim === 'cast' || anim === 'shoot' || anim === 'shout') { const q = clamp01(el / animTime(anim)); rear = -Math.sin(q * Math.PI) * 7; jaw = clamp01(Math.sin(q * Math.PI) * 1.5); }
    if (anim === 'hurt') lean = -3 * (1 - clamp01(el / 300));
    if (anim === 'dead') fall = ease(clamp01(el / 800));
    if (fall) { c.save(); c.translate(0, -6); c.rotate(fall * .35); c.translate(0, 6 + fall * 6); }
    const wing = (near) => {
      const sx = -4 + lean * .5, sy = -30 + rear * .6, f = flap * (near ? 10 : 7), col = near ? sh(sk, -.08) : sh(sk, -.3);
      const tips = [[sx - 36, sy - 24 - f], [sx - 25, sy - 31 - f * 1.2], [sx - 12, sy - 29 - f], [sx + 4, sy - 22 - f * .6]], wr = [sx - 6, sy - 20 - f * .7];
      g.fill(() => { c.moveTo(sx, sy); c.lineTo(...wr); c.lineTo(...tips[0]); c.quadraticCurveTo(sx - 31, sy - 8, sx - 27, sy + 6 - f * .2); c.quadraticCurveTo(sx - 23, sy - 6 - f * .5, ...[tips[1][0] + 2, tips[1][1] + 26]); c.quadraticCurveTo(sx - 16, sy - 2, sx - 10, sy + 9); c.quadraticCurveTo(sx - 9, sy - 6 - f * .4, tips[2][0] + 4, tips[2][1] + 24); c.quadraticCurveTo(sx - 2, sy + 1, sx + 6, sy + 5); c.lineTo(...tips[3]); c.lineTo(...wr); c.closePath(); }, g.lin(sx - 30, sy - 30 - f, sx, sy + 8, [rgba(sh(col, .25), .96), rgba(col, .94), rgba(sh(col, -.3), .96)]), .6);
      c.strokeStyle = rgba(sh(col, .35), .25); c.lineWidth = .3; c.beginPath(); for (let i = 0; i < 6; i++) { const t = (i + .5) / 6; c.moveTo(wr[0], wr[1]); c.quadraticCurveTo(wr[0] - 10 * t, wr[1] + 12, sx - 28 + t * 30, sy + 4 - t * 4); } c.stroke();
      c.lineCap = 'round'; for (const t of tips) { c.strokeStyle = OL; c.lineWidth = 1.5; c.beginPath(); c.moveTo(...wr); c.lineTo(...t); c.stroke(); c.strokeStyle = sh(sk, -.15); c.lineWidth = .9; c.stroke(); }
      c.strokeStyle = OL; c.lineWidth = 2.2; c.beginPath(); c.moveTo(sx, sy); c.lineTo(...wr); c.stroke(); c.strokeStyle = sh(sk, -.05); c.lineWidth = 1.5; c.stroke();
      g.fill(() => { c.moveTo(wr[0] - .5, wr[1]); c.lineTo(wr[0] + 1.2, wr[1] - 2.6); c.lineTo(wr[0] + 1.2, wr[1] + .2); c.closePath(); }, '#e8dcc0', .3);
    };
    // Schwanz
    const tw = Math.sin(gt / 500) * 4;
    const tail = [[-18 + lean * .3, -16], [-34, -12 + tw * .4], [-48, -8 + tw], [-58, -14 + tw * 1.4], [-64, -22 + tw * 1.2]];
    { const tp = bez(tail[0], [-38, -10 + tw * .5], [-56, -6 + tw * 1.2], tail[4], 14).reverse(); smooth(tp, tp.map((_, i) => 1.1 + i * .6), sk, 1, 1); }
    g.fill(() => { const t = tail[tail.length - 1]; c.moveTo(t[0] - 2, t[1] + 2); c.lineTo(t[0] - 6, t[1] - 4); c.lineTo(t[0] + 2, t[1] - 3); c.closePath(); }, sh(sk, -.2), .4);
    wing(false);
    const leg = (x, far, off) => { const a = Math.sin(off) * 0; g.limb([[x + lean, -16], [x + lean - 2, -8], [x + lean + 1, -1]], far ? 5 : 6, far ? sh(sk, -.3) : sh(sk, -.05), .6); for (let i = 0; i < 3; i++) g.limb([[x + lean + i * 1.2, -1], [x + lean + 1.6 + i * 1.2, .6]], .7, L.horn, .2); };
    leg(-14, 1, 0); leg(8, 1, 1);
    g.ell(-4 + lean, -20 + rear * .3, 24, 11, g.rad(-6 + lean, -26, 26, [sh(sk, .25), sk, sh(sk, -.4)]), .8);
    g.ell(-2 + lean, -14 + rear * .3, 18, 5, g.lin(0, -18, 0, -9, [sh(bl, .2), bl]), .4);
    c.strokeStyle = rgba(sh(bl, -.4), .6); c.lineWidth = .4; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-16 + lean + i * 4, -18); c.lineTo(-15 + lean + i * 4, -10); c.stroke(); }
    c.save(); c.beginPath(); c.ellipse(-4 + lean, -20 + rear * .3, 24, 11, 0, 0, TAU); c.clip(); c.strokeStyle = rgba(sh(sk, -.45), .35); c.lineWidth = .3; c.beginPath(); for (let r2 = 0; r2 < 5; r2++) for (let i = 0; i < 12; i++) { const x = -26 + lean + i * 4 + (r2 % 2) * 2, y = -29 + r2 * 2.6 + rear * .3; c.moveTo(x, y); c.arc(x + 1.6, y, 1.6, Math.PI, 0, true); } c.stroke(); c.restore();
    for (let i = 0; i < 7; i++) g.fill(() => { const x = -22 + lean + i * 5; c.moveTo(x, -29 + rear * .3); c.lineTo(x + 1.5, -34 - (i % 2) + rear * .3); c.lineTo(x + 3, -29 + rear * .3); }, sh(sk, -.3), .3);
    leg(-10, 0, 2); leg(12, 0, 3);
    // Hals & Kopf
    const hx = 30 + lean * 1.2, hy = -42 + rear;
    const neck = [[12 + lean, -24 + rear * .3], [20 + lean, -34 + rear * .6], [hx - 4, hy + 2]];
    { const np = bez(neck[0], [16 + lean, -30 + rear * .5], [22 + lean, -40 + rear * .8], neck[2], 10); smooth(np, np.map((_, i) => 11 - i * .45), sk, 1, 1); }
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

  /* ---------- Wappen & Erkennungszeichen ---------- */
  const EMB_COL = { tree: '#f4f6fa', horse: '#f4efe2', star: '#e8f0ff', durin: '#f2d070', leaf: '#e8c860', eye: '#ff5a1a', hand: '#f4f4f0', bird: '#1e1a18', flower: '#ffd860' };
  /* Wappenschild: heraldischer Grund in der Lore-Farbe, Metallrand, Zeichen mittig */
  const BADGE = { tree: ['#12161e', '#d8dee8'], horse: ['#2e5a2a', '#e0c060'], star: ['#1e3a7a', '#dfe6f2'], durin: ['#2a221c', '#e0b850'], leaf: ['#284a2a', '#e0c060'], flower: ['#3a2e14', '#f0d070'], bird: ['#d8ceb4', '#8a6a3a'], eye: ['#1a0806', '#8a2a1a'], hand: ['#121212', '#9a9a9a'] };
  function badge(c, g, type, x, y, r, col) {
    const [bg, rim] = BADGE[type] || ['#1a1a20', '#c8c8c8'], w = r * 2.2, h = r * 2.55;
    c.save(); c.translate(x, y);
    const shp = () => { c.beginPath(); c.moveTo(-w / 2, -h / 2); c.lineTo(w / 2, -h / 2); c.lineTo(w / 2, h * .08); c.quadraticCurveTo(w / 2, h * .38, 0, h / 2); c.quadraticCurveTo(-w / 2, h * .38, -w / 2, h * .08); c.closePath(); };
    shp(); c.fillStyle = 'rgba(0,0,0,.35)'; c.save(); c.translate(.15, .2); c.fill(); c.restore();
    shp(); c.fillStyle = g.lin(0, -h / 2, 0, h / 2, [sh(bg, .18), bg, sh(bg, -.25)]); c.fill();
    c.lineWidth = r * .16; c.strokeStyle = g.lin(-w / 2, -h / 2, w / 2, h / 2, [sh(rim, .5), rim, sh(rim, -.35)]); c.stroke();
    c.restore();
    drawEmblem(c, g, type, x, y + h * .02, r * .72, col);
    c.save(); c.translate(x, y); shp(); c.clip(); c.fillStyle = g.lin(-w / 2, -h / 2, w * .1, h * .1, ['rgba(255,255,255,.22)', 'rgba(255,255,255,0)']); c.fillRect(-w / 2, -h / 2, w, h); c.restore();
  }
  /* Banner an einer Stange: hängendes Tuch mit Schwalbenschwanz, weht im Wind */
  function flag(c, o) {
    const g = P(c), t = (o.t || 0) / 1000, Wd = o.w || 13, Hd = o.h || 20, PH = o.pole || 46, top = -PH + 3;
    c.save();
    c.fillStyle = g.lin(-.8, 0, .8, 0, ['#2a1a10', '#8a6a40', '#2a1a10']); c.fillRect(-.7, -PH, 1.4, PH + 1);
    c.fillStyle = g.lin(-1.4, -PH - 3.4, 1.4, -PH, ['#fff4c0', '#c8a040', '#7a5a20']); c.beginPath(); c.moveTo(-1.3, -PH + .2); c.lineTo(0, -PH - 3.6); c.lineTo(1.3, -PH + .2); c.closePath(); c.fill();
    c.fillStyle = '#5a4026'; c.fillRect(-.5, top - .9, Wd + 1.6, 1.1); c.fillStyle = '#c8a040'; c.beginPath(); c.arc(Wd + 1.1, top - .35, .7, 0, TAU); c.fill();
    const wv = y => Math.sin(t * 2.4 + y * .32) * (y / Hd) * 1.8 + Math.sin(t * 1.3 + y * .11) * (y / Hd) * .8;
    const path = () => { c.beginPath(); c.moveTo(.6, top); for (let y = 0; y <= Hd; y += 2) c.lineTo(.6 + wv(y), top + y); c.lineTo(.6 + Wd * .5 + wv(Hd * .82), top + Hd * .82); c.lineTo(.6 + Wd + wv(Hd), top + Hd); for (let y = Hd; y >= 0; y -= 2) c.lineTo(.6 + Wd + wv(y), top + y); c.closePath(); };
    c.save(); path(); c.clip();
    c.fillStyle = g.lin(0, top, 0, top + Hd, [sh(o.cloth, .12), o.cloth, sh(o.cloth, -.25)]); c.fillRect(-2, top - 1, Wd + 6, Hd + 2);
    for (let y = 0; y < Hd; y += 1.5) { const k = Math.cos(t * 2.4 + y * .32); c.fillStyle = k > 0 ? `rgba(255,255,255,${.06 * k})` : `rgba(0,0,0,${-.14 * k})`; c.fillRect(-2, top + y, Wd + 6, 1.6); }
    const ex = .6 + Wd / 2 + wv(Hd * .42), ey = top + Hd * .42, er = Wd * .3;
    if (o.em === 'sun') { c.fillStyle = o.emCol; c.beginPath(); c.arc(ex, ey, er * .7, 0, TAU); c.fill(); c.strokeStyle = o.emCol; c.lineWidth = .5; c.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.moveTo(ex + Math.cos(a) * er * .85, ey + Math.sin(a) * er * .85); c.lineTo(ex + Math.cos(a) * er * 1.25, ey + Math.sin(a) * er * 1.25); } c.stroke(); }
    else if (o.em === 'peaks') { c.fillStyle = o.emCol; c.beginPath(); c.moveTo(ex - er * 1.3, ey + er * .8); c.lineTo(ex - er * .7, ey - er * .2); c.lineTo(ex, ey - er * 1.1); c.lineTo(ex + er * .7, ey - er * .2); c.lineTo(ex + er * 1.3, ey + er * .8); c.closePath(); c.fill(); }
    else if (o.em === 'serpent') { c.strokeStyle = o.emCol; c.lineWidth = er * .35; c.lineCap = 'round'; c.beginPath(); c.moveTo(ex - er, ey + er); c.bezierCurveTo(ex + er * 1.2, ey + er * .6, ex - er * 1.2, ey - er * .2, ex + er * .6, ey - er); c.stroke(); c.fillStyle = o.emCol; c.beginPath(); c.arc(ex + er * .7, ey - er * 1.05, er * .28, 0, TAU); c.fill(); }
    else if (o.em === 'ship') { c.fillStyle = o.emCol; c.beginPath(); c.moveTo(ex - er * 1.2, ey + er * .3); c.lineTo(ex + er * 1.2, ey + er * .3); c.lineTo(ex + er * .7, ey + er); c.lineTo(ex - er * .7, ey + er); c.closePath(); c.fill(); c.fillRect(ex - .25, ey - er * 1.2, .5, er * 1.5); c.beginPath(); c.moveTo(ex + .3, ey - er * 1.1); c.lineTo(ex + er, ey); c.lineTo(ex + .3, ey); c.closePath(); c.fill(); }
    else if (o.em === 'ring') { c.strokeStyle = o.emCol; c.lineWidth = er * .3; c.beginPath(); c.arc(ex, ey, er * .8, .4, TAU - .4); c.stroke(); }
    else if (o.em) drawEmblem(c, g, o.em, ex, ey, er, o.emCol);
    c.restore();
    path(); c.strokeStyle = o.trim || 'rgba(232,200,110,.85)'; c.lineWidth = .45; c.stroke();
    c.restore();
  }
  function drawEmblem(c, g, type, x, y, r, col) {
    col = col || EMB_COL[type] || '#ffffff'; c.save(); c.translate(x, y); c.lineCap = 'round'; c.lineJoin = 'round';
    const glowDot = (px, py, rr) => { c.beginPath(); c.arc(px, py, rr, 0, TAU); c.fill(); };
    c.fillStyle = col; c.strokeStyle = col;
    if (type === 'tree') {
      c.lineWidth = r * .18; c.beginPath(); c.moveTo(0, r); c.lineTo(0, -r * .55);
      for (const d of [-1, 1]) { c.moveTo(0, -r * .1); c.quadraticCurveTo(d * r * .5, -r * .3, d * r * .75, -r * .8); c.moveTo(0, r * .35); c.quadraticCurveTo(d * r * .55, r * .15, d * r * .95, -r * .25); c.moveTo(0, -r * .45); c.quadraticCurveTo(d * r * .2, -r * .7, d * r * .35, -r * 1); }
      c.stroke(); c.lineWidth = r * .1; c.beginPath(); c.moveTo(-r * .3, r); c.quadraticCurveTo(0, r * .8, r * .3, r); c.stroke();
      for (let i = 0; i < 7; i++) { const a = Math.PI * (1.12 + i * .127); glowDot(Math.cos(a) * r * 1.1, -r * .35 + Math.sin(a) * r * 1.05, r * .09); }
    } else if (type === 'horse') {
      c.scale(r / 9, r / 9); c.beginPath(); c.moveTo(-5, 9); c.lineTo(-5.6, 1); c.quadraticCurveTo(-5.4, -5, -.5, -7.6); c.lineTo(1.6, -9.2); c.lineTo(2.4, -7.6); c.lineTo(6.2, -5.4); c.quadraticCurveTo(7.2, -4, 5.6, -3.2); c.lineTo(2.6, -3.6); c.quadraticCurveTo(1.2, 1.5, 4.6, 9); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = .6; c.beginPath(); c.moveTo(-4.8, 0); c.quadraticCurveTo(-4, -5, -.6, -7); c.stroke(); c.fillStyle = 'rgba(0,0,0,.55)'; glowDot(3, -6.2, .55);
    } else if (type === 'star' || type === 'flower') {
      if (type === 'star') { c.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8 - Math.PI / 2, rr = i % 2 ? r * .38 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; glowDot(0, 0, r * .18); }
      else { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.beginPath(); c.ellipse(Math.cos(a) * r * .5, Math.sin(a) * r * .5, r * .42, r * .22, a, 0, TAU); c.fill(); } c.fillStyle = '#fff6c8'; glowDot(0, 0, r * .22); }
    } else if (type === 'durin') {
      c.beginPath(); c.moveTo(-r * .8, r * .9); c.lineTo(r * .8, r * .9); c.lineTo(r * .45, r * .45); c.lineTo(r * .9, r * .2); c.lineTo(-r * .9, r * .2); c.lineTo(-r * .45, r * .45); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-r * .7, -r * .1); c.lineTo(-r * .7, -r * .55); c.lineTo(-r * .35, -r * .3); c.lineTo(0, -r * .75); c.lineTo(r * .35, -r * .3); c.lineTo(r * .7, -r * .55); c.lineTo(r * .7, -r * .1); c.closePath(); c.fill();
      for (let i = 0; i < 3; i++) glowDot(-r * .55 + i * r * .55, -r * 1.05 + (i === 1 ? -r * .15 : 0), r * .11);
    } else if (type === 'leaf') {
      c.rotate(-.5); c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * .75, -r * .1, 0, r); c.quadraticCurveTo(-r * .75, -r * .1, 0, -r); c.fill();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = r * .07; c.beginPath(); c.moveTo(0, -r * .85); c.lineTo(0, r * 1.1); for (let i = 0; i < 3; i++) { c.moveTo(0, -r * .4 + i * r * .4); c.lineTo(r * .32, -r * .65 + i * r * .4); c.moveTo(0, -r * .4 + i * r * .4); c.lineTo(-r * .32, -r * .65 + i * r * .4); } c.stroke();
    } else if (type === 'eye') {
      c.beginPath(); c.moveTo(-r, 0); c.quadraticCurveTo(0, -r * .85, r, 0); c.quadraticCurveTo(0, r * .85, -r, 0); c.fill(); c.fillStyle = '#ffd27a'; c.beginPath(); c.ellipse(0, 0, r * .45, r * .42, 0, 0, TAU); c.fill(); c.fillStyle = '#120404'; c.beginPath(); c.ellipse(0, 0, r * .11, r * .4, 0, 0, TAU); c.fill();
    } else if (type === 'hand') {
      c.beginPath(); c.roundRect ? c.roundRect(-r * .5, -r * .1, r, r * .9, r * .2) : c.rect(-r * .5, -r * .1, r, r * .9); c.fill();
      for (let i = 0; i < 4; i++) { c.beginPath(); c.roundRect ? c.roundRect(-r * .5 + i * r * .26, -r * .85 + Math.abs(i - 1.5) * r * .12, r * .21, r * .8, r * .1) : c.rect(-r * .5 + i * r * .26, -r * .85, r * .21, r * .8); c.fill(); }
      c.beginPath(); c.ellipse(-r * .62, r * .15, r * .16, r * .36, .5, 0, TAU); c.fill();
    } else if (type === 'bird') { c.lineWidth = r * .22; c.beginPath(); c.moveTo(-r, -r * .1); c.quadraticCurveTo(-r * .45, -r * .55, 0, 0); c.quadraticCurveTo(r * .45, -r * .55, r, -r * .1); c.stroke(); }
    c.restore();
  }
  /* Berühmte Klingen leuchten: Stich, Andúril, Orcrist, Aeglos, Ringil … */
  function sigGlow(c, g, L, kind, h, d, K, gt) {
    const len = ({ sword: 10.5, dagger: 6, axe: 8, hammer: 8, spear: 15, staff: 14 }[kind] ?? 9) * K, col = L.wglow, p = .55 + .2 * Math.sin(gt / 240);
    c.save(); c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';
    for (const [lw, a] of [[4, .1], [2, .22], [.8, .55]]) { c.strokeStyle = rgba(col, a * p * 1.4); c.lineWidth = lw * K; c.beginPath(); c.moveTo(h[0] + d[0] * 2 * K, h[1] + d[1] * 2 * K); c.lineTo(h[0] + d[0] * len, h[1] + d[1] * len); c.stroke(); }
    g.glow(h[0] + d[0] * len * .7, h[1] + d[1] * len * .7, 4.5 * K, col, .35 * p);
    for (let i = 0; i < 3; i++) { const t = ((gt / 900) + i / 3) % 1, along = len * (.35 + .6 * ((i * .41 + t * .3) % 1)); c.globalAlpha = Math.sin(t * Math.PI) * .9; g.glow(h[0] + d[0] * along + Math.sin(gt / 180 + i) * .6, h[1] + d[1] * along - t * 4 * K, .9 * K, col, .9); }
    c.restore();
  }

  /* ---------- Reittiere ---------- */
  const MOUNT_SADDLE = { horse: -20.2, pony: -15.4, warg: -13.4, fell: -24 };
  function drawMounted(c, L, anim, el, gt) {
    const M = L.mount, run = anim === 'walk' || anim === 'attack' || anim === 'throw', mel = anim === 'walk' ? el : (gt % 1040);
    const B = BODY[L.body] || BODY.man, sy = MOUNT_SADDLE[M.kind] || -20;
    if (M.kind === 'fell') {
      c.save(); const fl = Math.sin(gt / 300) * 1.2; c.translate(-3, fl); c.scale(.6, .6); drawDragon(c, M.look, 'idle', 0, gt); c.restore();
    } else { c.save(); c.scale(.86, .86); drawQuad(c, Object.assign({ horse: M.kind === 'horse' || M.kind === 'pony' ? 1 : 0, pony: M.kind === 'pony' ? 1 : 0, rein: 1 }, M.look), run ? 'walk' : 'idle', run ? (anim === 'walk' ? el : gt % 520) : mel, gt); c.restore(); }
    const p = poseAt(anim, el, L.wpn || 'sword', gt), bob = run ? Math.abs(Math.sin(gt / 520 * TAU)) * .8 : 0, ms = M.kind === 'fell' ? 1 : .86;
    c.save(); c.translate(-1.2 * ms, sy * ms + B.ll - bob + (M.kind === 'fell' ? Math.sin(gt / 300) * 1.2 : 0)); drawHum(c, Object.assign({}, L, { seated: 1 }), p, gt); c.restore();
  }
  function draw(c, type, look, anim, el, gt) {
    if (type === 'quad') { if (look.huge) { c.save(); c.scale(1.9, 1.9); drawQuad(c, look, anim, el, gt); c.restore(); return; } return drawQuad(c, look, anim, el, gt); }
    if (type === 'spider') return drawSpider(c, look, anim, el, gt);
    if (type === 'worm') return drawWorm(c, look, anim, el, gt);
    if (type === 'olifant') return drawOlifant(c, look, anim, el, gt);
    if (type === 'watcher') return drawWatcher(c, look, anim, el, gt);
    if (type === 'engine') { c.save(); c.scale(1.22, 1.22); drawEngine(c, look, anim, el, gt); c.restore(); return; }
    if (type === 'dragon') { if (look.huge) { c.save(); c.scale(1.5, 1.5); drawDragon(c, look, anim, el, gt); c.restore(); return; } return drawDragon(c, look, anim, el, gt); }
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
    const snowy = snowy0(key);
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
    else if (false) { g.rr(-2, HZ - 26, 260, 26, 0, g.lin(0, HZ - 26, 0, HZ, ['#6a6a66', '#4a4a46']), .3); for (let x = 0; x < 256; x += 8) g.rr(x, HZ - 30, 4, 5, .3, '#62625e', .2); g.rr(190, HZ - 54, 30, 54, 1, g.lin(190, 0, 220, 0, ['#5a5a56', '#7a7a74']), .4); g.glow(204, HZ - 36, 8, '#ffb050', .7); }
    else if (key === 'cirith') { c.strokeStyle = 'rgba(220,220,240,.25)'; c.lineWidth = .3; for (let i = 0; i < 4; i++) { const ox = i < 2 ? 0 : 256, oy = i % 2 ? 0 : 30; for (let j = 0; j < 7; j++) { c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(ox + (i < 2 ? 1 : -1) * (10 + j * 5), oy + 30, ox + (i < 2 ? 1 : -1) * (20 + j * 10), oy + 40 - j * 6); c.stroke(); } } g.fill(() => { c.moveTo(150, HZ); c.lineTo(172, 28); c.lineTo(180, 28); c.lineTo(200, HZ); }, '#1a1222', 0); g.glow(176, 36, 6, '#ff5a3a', .9); }
    else if (false) { const col = key === 'pelennor' ? '#e0dcd0' : '#c8b8a0'; for (let i = 0; i < 6; i++) g.rr(20 + i * 6, HZ - 14 - i * 7, 60 - i * 12, 7, .6, g.lin(0, 0, 0, 7, [col, sh(col, -.25)]), .3); g.rr(46, HZ - 62, 4, 14, .5, '#f8f4ea', .3); if (key === 'pelennor') for (let i = 0; i < 4; i++) { const x = 120 + i * 35; g.glow(x, HZ - 4, 10, '#ff7a2a', .7); c.fillStyle = 'rgba(40,32,30,.45)'; c.beginPath(); c.moveTo(x - 2, HZ - 4); c.bezierCurveTo(x - 8, HZ - 30, x + 8, HZ - 50, x - 4, HZ - 80); c.lineTo(x + 6, HZ - 80); c.bezierCurveTo(x + 14, HZ - 50, x + 4, HZ - 30, x + 3, HZ - 4); c.fill(); } else { for (let i = 0; i < 6; i++) tree(g, c, 120 + i * 24, HZ, 7, '#1e4a2a'); g.glow(230, HZ - 6, 14, '#ff8a2a', .8); } }
    else if (key === 'doom') { for (let i = 0; i < 6; i++) g.fill(() => { c.moveTo(i * 48, HZ); c.lineTo(i * 48 + 20, HZ - 14 - R() * 10); c.lineTo(i * 48 + 44, HZ); }, '#1a0a08', 0); }
    else if (key === 'snow') { for (let i = 0; i < 8; i++) { const x = 10 + i * 34 + R() * 10, h = 10 + R() * 18; g.fill(() => { c.moveTo(x, HZ + 2); c.lineTo(x + 4, HZ - h); c.lineTo(x + 9, HZ + 2); }, g.lin(x, 0, x + 9, 0, ['#e0f4ff', '#8ac0e8']), .3); } }
    else if (key === 'sea') { c.fillStyle = g.lin(0, 62, 0, HZ, ['#4a7aa8', '#1e4a7a']); c.fillRect(0, 64, 256, HZ - 64); c.strokeStyle = 'rgba(200,230,255,.35)'; c.lineWidth = .4; for (let i = 0; i < 40; i++) { const x = R() * 256, y = 66 + R() * 22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3 + R() * 4, y); c.stroke(); } g.limb([[200, 70], [200, 40]], 1.2, '#5a3a22', .3); g.fill(() => { c.moveTo(201, 42); c.quadraticCurveTo(214, 50, 201, 62); c.lineTo(222, 60); c.quadraticCurveTo(216, 50, 201, 42); }, '#ece4d4', .3); }
    else if (key === 'south') { g.rr(30, HZ - 30, 40, 30, 1, g.lin(0, HZ - 30, 0, HZ, ['#a8865e', '#7a5a3a']), .3); g.rr(170, HZ - 40, 14, 40, 1, '#7a5a3a', .3); g.rr(168, HZ - 44, 18, 4, .5, '#8a6a4a', .3); }
    else if (key === 'mirkwood') { for (let i = 0; i < 11; i++) { const x = 4 + i * 24 + R() * 8, w = 5 + R() * 4; g.rr(x, HZ - 70, w, 72, 1, g.lin(x, 0, x + w, 0, ['#1a120c', '#3a2a1c', '#1a120c']), .3); g.ell(x + w / 2, HZ - 66, 16, 10, rgba('#0e1a10', .9), 0); c.strokeStyle = 'rgba(40,28,20,.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + w / 2, HZ - 40); c.quadraticCurveTo(x + w + 6, HZ - 46, x + w + 10, HZ - 38); c.stroke(); } c.strokeStyle = 'rgba(220,220,230,.22)'; c.lineWidth = .3; for (let i = 0; i < 5; i++) { const x = 30 + i * 50; for (let j = 0; j < 5; j++) { c.beginPath(); c.moveTo(x, HZ - 40); c.lineTo(x + Math.cos(j) * 12, HZ - 40 + Math.sin(j) * 12); c.stroke(); } } }
    else if (key === 'lake') {
      // Der Einsame Berg über dem Langen See: Licht- und Schattenflanke, Schneekappe, Grate, Spiegelung
      const mtn = () => { c.moveTo(146, HZ - 26); c.lineTo(166, 44); c.lineTo(182, 26); c.lineTo(196, 13); c.lineTo(206, 21); c.lineTo(224, 42); c.lineTo(246, HZ - 26); c.closePath(); };
      const paintM = () => { g.fill(mtn, g.lin(0, 13, 0, HZ - 26, ['#a4a2b2', '#6a6a7a', '#4a4a58']), 0);
        g.fill(() => { c.moveTo(196, 13); c.lineTo(206, 21); c.lineTo(224, 42); c.lineTo(246, HZ - 26); c.lineTo(200, HZ - 26); c.lineTo(198, 40); c.closePath(); }, 'rgba(30,30,46,.42)', 0);
        g.fill(() => { c.moveTo(184, 25); c.lineTo(196, 13); c.lineTo(207, 22); c.lineTo(203, 26); c.lineTo(199, 23); c.lineTo(196, 28); c.lineTo(192, 24); c.lineTo(188, 29); c.closePath(); }, g.lin(0, 13, 0, 30, ['#ffffff', '#d8e0ec']), 0);
        c.strokeStyle = 'rgba(30,28,40,.35)'; c.lineWidth = .5; c.beginPath(); for (const [x1, y1, x2, y2] of [[196, 28, 186, 60], [199, 30, 204, 64], [182, 34, 170, 58], [210, 30, 222, 56]]) { c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2 + 2, (y1 + y2) / 2, x2, y2); } c.stroke(); };
      paintM();
      c.fillStyle = g.lin(0, HZ - 26, 0, HZ, ['#5a7a98', '#2a4a6a']); c.fillRect(0, HZ - 26, 256, 28);
      c.save(); c.beginPath(); c.rect(0, HZ - 26, 256, 28); c.clip(); c.globalAlpha = .2; c.translate(0, (HZ - 26) * 2); c.scale(1, -1); paintM(); c.restore(); c.strokeStyle = 'rgba(220,235,255,.35)'; c.lineWidth = .4; for (let i = 0; i < 30; i++) { const x = R() * 256, y = HZ - 24 + R() * 22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 4, y); c.stroke(); } for (let i = 0; i < 6; i++) { const x = 12 + i * 22; for (const d of [1, 9]) g.limb([[x + d, HZ - 4], [x + d, HZ - 16]], .8, '#4a3220', .2); g.rr(x, HZ - 24, 11, 9, .4, g.lin(x, 0, x + 11, 0, ['#5a3e26', '#7a5a38']), .3); g.fill(() => { c.moveTo(x - 1.5, HZ - 24); c.lineTo(x + 5.5, HZ - 31); c.lineTo(x + 12.5, HZ - 24); }, '#3a2a1e', .3); g.ell(x + 5.5, HZ - 20, 1, 1, '#ffcc66', 0); } }
    else if (false) { g.fill(() => { c.moveTo(20, HZ); c.lineTo(128, 8); c.lineTo(236, HZ); }, g.lin(0, 8, 0, HZ, ['#9a8a7a', '#5a4a40']), .3); g.rr(116, HZ - 30, 24, 30, 1, '#1a120c', .4); g.rr(113, HZ - 34, 30, 5, .5, '#7a6a58', .3); for (const x of [96, 150]) { g.rr(x, HZ - 40, 10, 40, 1, g.lin(x, 0, x + 10, 0, ['#6a5a4a', '#8a7a68']), .3); g.ell(x + 5, HZ - 42, 4, 3.4, '#7a6a58', .3); } g.glow(128, HZ - 18, 18, '#ffb040', .4); }
    else if (key === 'dolguldur') { for (let i = 0; i < 5; i++) { const x = 20 + i * 52, h = 34 + (i * 17) % 26; g.fill(() => { c.moveTo(x, HZ); c.lineTo(x, HZ - h); c.lineTo(x + 3, HZ - h - 6); c.lineTo(x + 6, HZ - h + 2); c.lineTo(x + 10, HZ - h - 4); c.lineTo(x + 14, HZ - h); c.lineTo(x + 14, HZ); }, g.lin(x, 0, x + 14, 0, ['#141a16', '#2a342c']), .3); g.glow(x + 7, HZ - h + 10, 5, '#7aff9a', .5); } }
    else if (key === 'rhun') { for (let i = 0; i < 5; i++) { const x = 20 + i * 52; g.rr(x, HZ - 10 - (i % 3) * 4, 5, 10 + (i % 3) * 4, 1, g.lin(x, 0, x + 5, 0, ['#5a4a5a', '#7a6a7a']), .3); } }
  }



  /* Die Hallen von Khazad-dûm: Säulenreihen, die sich im Dunkel verlieren */
  function hall(c, g, lit) {
    const stone = lit ? ['#3a4658', '#6a7a8e', '#2a3444'] : ['#16141a', '#3a363c', '#0e0c10'];
    g.fill(() => { c.rect(0, 112, 200, 12); }, lit ? 'rgba(60,70,86,.8)' : 'rgba(20,18,22,.85)', 0);
    for (let row = 3; row >= 0; row--) { const sc = .45 + row * .2, gap = 34 * sc, hh = 124 * sc, top = 124 - hh, fade = .25 + row * .25;
      for (let x = (row % 2) * gap * .5 - 10; x < 210; x += gap) { const pw = 9 * sc; c.globalAlpha = fade; g.rr(x - pw / 2, top, pw, hh, .4, g.lin(x - pw / 2, 0, x + pw / 2, 0, stone), 0); g.rr(x - pw * .8, top, pw * 1.6, 3 * sc, .3, stone[1], 0); g.rr(x - pw * .8, 124 - 3 * sc, pw * 1.6, 3 * sc, .3, stone[2], 0);
        c.strokeStyle = lit ? 'rgba(200,220,255,.18)' : 'rgba(255,255,255,.06)'; c.lineWidth = .3; c.beginPath(); for (let k2 = 1; k2 < 5; k2++) { c.moveTo(x - pw * .3, top + hh * k2 / 5); c.lineTo(x + pw * .3, top + hh * k2 / 5); } c.stroke(); } }
    c.globalAlpha = 1;
    const beam = c.createLinearGradient(0, 0, 0, 124); beam.addColorStop(0, lit ? 'rgba(255,230,180,.35)' : 'rgba(200,220,255,.28)'); beam.addColorStop(1, 'rgba(200,220,255,0)'); c.fillStyle = beam; c.beginPath(); c.moveTo(92, 0); c.lineTo(108, 0); c.lineTo(126, 124); c.lineTo(80, 124); c.closePath(); c.fill();
    if (lit) { c.fillStyle = 'rgba(255,190,100,.9)'; for (let i = 0; i < 9; i++) c.fillRect(12 + i * 22, 70 + (i % 3) * 8, 1.4, 2.2); }
  }
  function hallAnim(ctx, x, y, gt, lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 10; i++) { const t = ((gt / 6000) + i / 10) % 1, px = x + 92 + (i * 7.3 % 26) + Math.sin(gt / 900 + i) * 2, py = y + t * 120; ctx.fillStyle = `rgba(255,250,230,${.5 * Math.sin(t * Math.PI)})`; ctx.fillRect(px, py, .7, .7); }
    if (lit) for (let i = 0; i < 9; i++) { const px = x + 12.7 + i * 22, py = y + 71 + (i % 3) * 8, a = .3 + .15 * Math.sin(gt / 300 + i), r = ctx.createRadialGradient(px, py, 0, px, py, 6); r.addColorStop(0, `rgba(255,180,90,${a})`); r.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = r; ctx.fillRect(px - 6, py - 6, 12, 12); } ctx.restore(); }
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
      { const a = Math.PI / 2 + .35 - Math.sin(gt / 5200) * 1.05, len = 620, bg = ctx.createLinearGradient(ex, ey, ex + Math.cos(a) * len, ey + Math.sin(a) * len); bg.addColorStop(0, 'rgba(255,150,60,.32)'); bg.addColorStop(.5, 'rgba(255,100,30,.1)'); bg.addColorStop(1, 'rgba(255,80,20,0)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a - .07) * len, ey + Math.sin(a - .07) * len); ctx.lineTo(ex + Math.cos(a + .07) * len, ey + Math.sin(a + .07) * len); ctx.closePath(); ctx.fill(); }
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
    moria: { w: 200, h: 124, base: 2, k: .6, paint(c, g, T) { hall(c, g, false); }, anim(ctx, x, y, gt) { hallAnim(ctx, x, y, gt, false); } },
    khazad: { w: 200, h: 124, base: 2, k: .6, paint(c, g, T) { hall(c, g, true); }, anim(ctx, x, y, gt) { hallAnim(ctx, x, y, gt, true); } },
    mirkwood: { w: 190, h: 122, base: 2, k: .6, paint(c, g, T) {
      for (const [tx, tw, lean] of [[20, 10, -4], [70, 13, 3], [128, 11, -2], [178, 12, 5]]) {
        g.fill(() => { c.moveTo(tx - tw, 122); c.bezierCurveTo(tx - tw * .4, 90, tx + lean - tw * .6, 50, tx + lean - tw * .35, 0); c.lineTo(tx + lean + tw * .35, 0); c.bezierCurveTo(tx + lean + tw * .5, 50, tx + tw * .4, 90, tx + tw, 122); c.closePath(); }, g.lin(tx - tw, 0, tx + tw, 0, ['#0e1210', '#2a3226', '#141a14']), 0);
        c.strokeStyle = 'rgba(60,70,50,.5)'; c.lineWidth = .5; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(tx - tw * .5 + i * tw * .3, 120); c.bezierCurveTo(tx - tw * .3 + i * tw * .2, 80, tx + lean - tw * .2 + i * tw * .1, 40, tx + lean - tw * .15 + i * tw * .1, 4); } c.stroke();
        c.strokeStyle = '#141a14'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx + lean * .6, 40); c.quadraticCurveTo(tx + 22, 30, tx + 34, 44); c.moveTo(tx + lean * .4, 62); c.quadraticCurveTo(tx - 18, 54, tx - 28, 66); c.stroke(); }
      c.strokeStyle = 'rgba(230,236,230,.4)'; c.lineWidth = .3;
      for (const [wx, wy, wr] of [[46, 50, 14], [150, 36, 12], [100, 84, 10]]) { const N = 9, an = i => i / N * Math.PI * 2 + Math.sin(i * 2.7 + wx) * .22, ln = i => wr * (.82 + .25 * Math.abs(Math.sin(i * 1.9 + wy))); for (let i = 0; i < N; i++) { c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + Math.cos(an(i)) * ln(i), wy + Math.sin(an(i)) * ln(i)); c.stroke(); }
        for (let k2 = 1; k2 <= 5; k2++) { c.beginPath(); for (let i = 0; i <= N; i++) { const j = i % N, rr = ln(j) * k2 / 5, x = wx + Math.cos(an(j)) * rr, y = wy + Math.sin(an(j)) * rr; if (!i) { c.moveTo(x, y); continue; } const jp = (i - 1) % N, am = (an(jp) + (j ? an(j) : an(j) + Math.PI * 2)) / 2, rm = (ln(jp) + ln(j)) / 2 * k2 / 5 * .78; c.quadraticCurveTo(wx + Math.cos(am) * rm, wy + Math.sin(am) * rm, x, y); } c.stroke(); }
        c.beginPath(); c.moveTo(wx + Math.cos(an(2)) * ln(2), wy + Math.sin(an(2)) * ln(2)); c.quadraticCurveTo(wx + 2, wy + wr + 8, wx + 4, wy + wr + 16); c.stroke(); }
      c.fillStyle = 'rgba(200,200,190,.06)'; for (let i = 0; i < 14; i++) { const x = 6 + i * 13.5, l = 10 + (i * 7) % 18; c.fillRect(x, 26 + (i * 11) % 30, .35, l); }
    }, anim(ctx, x, y, gt) { const ph = (gt % 5200) / 5200, open = ph < .9 ? 1 : Math.abs(Math.sin((ph - .9) * 30)); ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [cx0, cy0, sc] of [[100, 70, 1], [159, 92, .8]]) for (const [dx, dy, er] of [[-3.4, 0, 1.6], [3.4, 0, 1.6], [-1.3, -1.6, 1.1], [1.3, -1.6, 1.1], [-5.6, -1.4, .8], [5.6, -1.4, .8], [-2.2, 1.9, .7], [2.2, 1.9, .7]]) { const ex = x + cx0 + dx * sc, ey = y + cy0 + dy * sc, rr = er * 2 * sc, r = ctx.createRadialGradient(ex, ey, 0, ex, ey, rr); r.addColorStop(0, `rgba(230,255,150,${.9 * open})`); r.addColorStop(.35, `rgba(150,230,80,${.45 * open})`); r.addColorStop(1, 'rgba(120,220,60,0)'); ctx.fillStyle = r; ctx.beginPath(); ctx.ellipse(ex, ey, rr, rr * open, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); } },
    rivendell: { w: 200, h: 118, base: 3, k: .56, paint(c, g, T) {
      const rock = g.lin(0, 0, 0, 118, ['#5a6a64', '#3a4a42', '#2a3830']);
      g.fill(() => { c.moveTo(0, 118); c.lineTo(0, 10); c.quadraticCurveTo(18, 4, 34, 16); c.lineTo(48, 60); c.quadraticCurveTo(56, 92, 60, 118); c.closePath(); }, rock, 0);
      g.fill(() => { c.moveTo(200, 118); c.lineTo(200, 6); c.quadraticCurveTo(178, 2, 162, 18); c.lineTo(148, 58); c.quadraticCurveTo(140, 94, 136, 118); c.closePath(); }, rock, 0);
      for (const fx of [36, 158]) { const fw = g.lin(fx - 3, 0, fx + 3, 0, ['rgba(220,236,246,.2)', 'rgba(250,252,255,.9)', 'rgba(220,236,246,.2)']); c.fillStyle = fw; c.fillRect(fx - 2.6, 18, 5.2, 96); g.ell(fx, 112, 9, 3, 'rgba(240,248,255,.7)', 0); }
      for (let i = 0; i < 9; i++) { const px = 8 + i * 22 + (i % 2) * 6, ph = 14 + (i * 7) % 12; g.fill(() => { c.moveTo(px, 118); c.lineTo(px + 4, 118 - ph); c.lineTo(px + 8, 118); c.closePath(); }, i % 2 ? '#2e4a34' : '#355a3c', 0); }
      const wall = g.lin(0, 40, 0, 110, ['#f2e8d2', '#d8c8a6']), roof = g.lin(0, 0, 0, 20, ['#8aa69a', '#4e6a5e']);
      g.rr(64, 82, 72, 28, 1, wall, .3); for (let i = 0; i < 7; i++) { const ax = 68 + i * 9.6; g.fill(() => { c.moveTo(ax, 108); c.lineTo(ax, 92); c.quadraticCurveTo(ax + 3.2, 85, ax + 6.4, 92); c.lineTo(ax + 6.4, 108); c.closePath(); }, 'rgba(60,46,32,.55)', 0); }
      g.rr(60, 80, 80, 3, .6, '#eadcbe', .25);
      g.rr(80, 54, 40, 26, 1, wall, .3); for (let i = 0; i < 4; i++) { const ax = 84 + i * 9; g.fill(() => { c.moveTo(ax, 78); c.lineTo(ax, 64); c.quadraticCurveTo(ax + 3, 58, ax + 6, 64); c.lineTo(ax + 6, 78); c.closePath(); }, 'rgba(60,46,32,.5)', 0); }
      g.fill(() => { c.moveTo(76, 55); c.quadraticCurveTo(100, 36, 124, 55); c.closePath(); }, roof, .3);
      g.rr(94, 30, 12, 26, .8, wall, .3); g.fill(() => { c.moveTo(92, 31); c.quadraticCurveTo(100, 14, 108, 31); c.closePath(); }, roof, .3);
      g.fill(() => { c.moveTo(60, 83); c.quadraticCurveTo(100, 70, 140, 83); c.closePath(); }, roof, .3);
      c.fillStyle = 'rgba(255,214,140,.9)'; for (const [x, y] of [[71, 100], [90, 100], [109, 100], [128, 100], [87, 72], [105, 72], [99, 44]]) c.fillRect(x, y, 1.4, 2.2);
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const fx of [36, 158]) for (let i = 0; i < 4; i++) { const t = ((gt / 900) + i / 4) % 1; ctx.fillStyle = `rgba(255,255,255,${.35 * Math.sin(t * Math.PI)})`; ctx.fillRect(x + fx - 1.5 + (i % 2), y + 18 + t * 90, 2.2, 7); }
      const a = .3 + .15 * Math.sin(gt / 700); for (const [px, py] of [[71, 100], [109, 100], [99, 44]]) { const r = ctx.createRadialGradient(x + px, y + py, 0, x + px, y + py, 7); r.addColorStop(0, `rgba(255,200,110,${a})`); r.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = r; ctx.fillRect(x + px - 7, y + py - 7, 14, 14); } ctx.restore(); } },
    lorien: { w: 190, h: 128, base: 2, k: .52, paint(c, g, T) {
      const trunk = x => g.lin(x - 7, 0, x + 7, 0, ['#4e555c', '#a8b0b6', '#8a9299', '#3e444a']);
      for (const [tx, tw, th] of [[34, 9, 128], [100, 13, 128], [164, 10, 128]]) {
        g.fill(() => { c.moveTo(tx - tw / 2, 128); c.quadraticCurveTo(tx - tw * .6, 136, tx - tw, 128); c.lineTo(tx - tw * .35, 20); c.lineTo(tx + tw * .35, 20); c.lineTo(tx + tw, 128); c.quadraticCurveTo(tx + tw * .6, 136, tx + tw / 2, 128); c.closePath(); }, trunk(tx), .3);
        c.strokeStyle = 'rgba(90,96,104,.35)'; c.lineWidth = .4; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(tx - tw * .3 + i * tw * .2, 124); c.lineTo(tx - tw * .15 + i * tw * .1, 30); } c.stroke();
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU, rx = tx + Math.cos(a) * (13 + (i % 3) * 4), ry = 24 + Math.sin(a) * 8; g.ell(rx, ry + 2, 9, 6, '#6a5418', 0); }
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + .2, rx = tx + Math.cos(a) * (12 + (i % 3) * 4), ry = 21 + Math.sin(a) * 8; g.ell(rx, ry, 8.5, 5.5, g.rad(rx - 2, ry - 3, 10, ['#f4dc80', '#c89a30', '#8a6a1c']), 0); }
        for (let i = 0; i < 6; i++) { const rx = tx - 10 + i * 4, ry = 15 + (i % 2) * 3; g.ell(rx, ry, 5, 3.4, g.rad(rx - 1, ry - 1.5, 6, ['#fff0b0', '#e0b848']), 0); }
      }
      for (const [fx, fy, fw] of [[100, 74, 34], [34, 92, 26], [164, 60, 28]]) { g.rr(fx - fw / 2, fy, fw, 2.4, 1, g.lin(0, fy, 0, fy + 2.4, ['#f4f0e4', '#b8b0a0']), .25); c.strokeStyle = 'rgba(240,236,224,.7)'; c.lineWidth = .4; c.beginPath(); c.moveTo(fx - fw / 2, fy); c.lineTo(fx - fw / 2, fy - 4); c.lineTo(fx + fw / 2, fy - 4); c.lineTo(fx + fw / 2, fy); c.stroke(); }
      c.strokeStyle = 'rgba(232,228,214,.75)'; c.lineWidth = .5; c.beginPath(); for (let i = 0; i < 14; i++) { const t = i / 13, yy = 124 - t * 48, xx = 100 + Math.sin(t * Math.PI * 3) * 9; i ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; let i = 0; for (const [px, py] of [[88, 71], [112, 71], [26, 89], [42, 89], [156, 57], [172, 57], [100, 46]]) { const a = .45 + .25 * Math.sin(gt / 500 + i++); const r = ctx.createRadialGradient(x + px, y + py, 0, x + px, y + py, 6); r.addColorStop(0, `rgba(220,240,255,${a})`); r.addColorStop(1, 'rgba(200,230,255,0)'); ctx.fillStyle = r; ctx.fillRect(x + px - 6, y + py - 6, 12, 12); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(x + px - .5, y + py - .5, 1, 1); } ctx.restore(); } },
    helm: { w: 170, h: 104, base: 3, k: .5, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 104); c.lineTo(20, 40); c.lineTo(46, 58); c.lineTo(78, 8); c.lineTo(104, 44); c.lineTo(132, 18); c.lineTo(170, 70); c.lineTo(170, 104); c.closePath(); }, g.lin(0, 8, 0, 104, ['#3a3e48', '#22252c']), 0);
      g.fill(() => { c.moveTo(96, 104); c.lineTo(104, 58); c.lineTo(122, 46); c.lineTo(156, 48); c.lineTo(170, 70); c.lineTo(170, 104); c.closePath(); }, g.lin(0, 46, 0, 104, ['#5a5a56', '#36363a']), .3);
      const st = g.lin(0, 30, 0, 100, ['#8a8a84', '#5a5a56']);
      g.rr(0, 70, 104, 16, 0, st, .3); for (let x = 0; x < 104; x += 5) g.rr(x, 67, 3, 3.4, .2, '#7a7a74', .2); g.fill(() => { c.moveTo(48, 86); c.lineTo(48, 80); c.quadraticCurveTo(52, 76, 56, 80); c.lineTo(56, 86); c.closePath(); }, '#1a1a1c', 0);
      g.fill(() => { c.moveTo(96, 70); c.lineTo(112, 54); c.lineTo(118, 56); c.lineTo(102, 72); c.closePath(); }, '#6a6a64', .3);
      g.rr(110, 36, 50, 14, .5, st, .3); for (let x = 110; x < 160; x += 5) g.rr(x, 33, 3, 3.4, .2, '#7a7a74', .2);
      g.rr(128, 8, 13, 30, .6, g.lin(128, 0, 141, 0, ['#9a9a94', '#6a6a64']), .3); for (let x = 127; x < 142; x += 4) g.rr(x, 5, 2.6, 3.4, .2, '#8a8a84', .2); g.rr(133, 16, 3, 5, 1.2, '#1a1a1c', 0);
      c.fillStyle = 'rgba(255,170,80,.9)'; for (const [x, y] of [[20, 74], [62, 74], [92, 74], [118, 40], [150, 40], [134, 26]]) c.fillRect(x, y, 1.4, 2);
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [px, py, i] of [[20.7, 75, 0], [62.7, 75, 1], [92.7, 75, 2], [118.7, 41, 3], [150.7, 41, 4], [134.7, 27, 5]]) { const a = .35 + .25 * Math.sin(gt / 120 + i * 2.1), r = ctx.createRadialGradient(x + px, y + py, 0, x + px, y + py, 7); r.addColorStop(0, `rgba(255,160,60,${a})`); r.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = r; ctx.fillRect(x + px - 7, y + py - 7, 14, 14); } ctx.restore(); } },
    weather: { w: 150, h: 100, base: 2, k: .55, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 100); c.quadraticCurveTo(40, 52, 75, 46); c.quadraticCurveTo(112, 52, 150, 100); c.closePath(); }, g.lin(0, 46, 0, 100, ['#3a3e44', '#1e2024']), 0);
      const st = ['#6a6e76', '#9a9ea6', '#4a4e56']; for (const [x, h2] of [[58, 26], [66, 34], [74, 40], [82, 30], [90, 22]]) { g.rr(x, 48 - h2, 7, h2 + 2, .5, g.lin(x, 0, x + 7, 0, st), .3); g.fill(() => { c.moveTo(x, 48 - h2); c.lineTo(x + 2, 46 - h2 - 3); c.lineTo(x + 4.5, 48 - h2 - 1); c.lineTo(x + 7, 45 - h2); c.lineTo(x + 7, 48 - h2); c.closePath(); }, st[1], .2); }
      c.fillStyle = 'rgba(20,20,26,.8)'; for (const x of [62, 78]) { c.beginPath(); c.moveTo(x, 48); c.lineTo(x, 38); c.arc(x + 3, 38, 3, Math.PI, 0); c.lineTo(x + 6, 48); c.fill(); }
    } },
    snow: { w: 170, h: 100, base: 2, k: .55, paint(c, g, T) {
      for (const [x, h2, w2] of [[20, 60, 12], [44, 84, 16], [70, 52, 11], [118, 74, 14], [146, 56, 12]]) g.fill(() => { c.moveTo(x - w2, 100); c.lineTo(x - w2 * .2, 100 - h2); c.lineTo(x + w2 * .3, 100 - h2 * .82); c.lineTo(x + w2, 100); c.closePath(); }, g.lin(x - w2, 0, x + w2, 0, ['#e8f4ff', '#a8c8e8', '#6a8aaa']), .35);
      g.fill(() => { c.moveTo(80, 96); c.quadraticCurveTo(95, 102, 112, 94); c.lineTo(110, 88); c.lineTo(82, 90); c.closePath(); }, '#4a3a2e', .4); g.limb([[96, 90], [94, 58]], 1.2, '#3a2a20', .3); g.limb([[87, 68], [102, 66]], .7, '#3a2a20', .2);
      c.fillStyle = 'rgba(240,248,255,.85)'; c.fillRect(81, 88, 30, 2); c.beginPath(); c.moveTo(94, 58); c.lineTo(96, 56); c.lineTo(97, 60); c.fill();
    } },
    south: { w: 110, h: 120, base: 2, k: .55, paint(c, g, T) {
      g.fill(() => { c.moveTo(10, 120); c.lineTo(30, 80); c.lineTo(80, 76); c.lineTo(100, 120); c.closePath(); }, g.lin(0, 76, 0, 120, ['#8a6a48', '#4a3422']), .4);
      g.rr(44, 22, 20, 58, 1, g.lin(44, 0, 64, 0, ['#c8a878', '#9a7a52', '#6a5034']), .4); for (let i = 0; i < 5; i++) g.rr(43 + i * 4.6, 17, 3, 5, .3, '#b8986a', .25);
      c.fillStyle = '#2a1a10'; for (const y of [34, 50]) c.fillRect(52, y, 4, 7); c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = .3; c.beginPath(); for (let y = 28; y < 80; y += 6) { c.moveTo(44, y); c.lineTo(64, y); } c.stroke();
    }, anim(ctx, x, y, gt) { const f = .7 + .3 * Math.sin(gt / 90) + .1 * Math.sin(gt / 37); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 54, y + 14, 0, x + 54, y + 14, 14 * f); r.addColorStop(0, 'rgba(255,200,90,.9)'); r.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = r; ctx.fillRect(x + 38, y - 2, 32, 32); ctx.restore(); } },
    rhun: { w: 150, h: 104, base: 2, k: .55, paint(c, g, T) {
      for (let i = 0; i < 5; i++) { const w2 = 120 - i * 22, h2 = 14; g.rr(75 - w2 / 2, 104 - (i + 1) * h2, w2, h2, .5, g.lin(0, 104 - (i + 1) * h2, 0, 104 - i * h2, ['#9a5a3a', '#6a3a22']), .35); c.fillStyle = 'rgba(30,14,8,.55)'; for (let j = 0; j < 4; j++) c.fillRect(75 - w2 / 2 + 6 + j * (w2 - 16) / 3, 104 - (i + 1) * h2 + 4, 3, 6); }
      g.fill(() => { c.moveTo(64, 34); c.quadraticCurveTo(75, 14, 86, 34); c.closePath(); }, g.lin(64, 20, 86, 34, ['#f8d870', '#c08a28']), .35); g.limb([[75, 18], [75, 8]], .6, '#3a2010', .2);
      for (const x of [34, 116]) { g.limb([[x, 76], [x, 46]], .6, '#2a1a10', .2); g.fill(() => { c.moveTo(x, 47); c.lineTo(x + 10, 49); c.lineTo(x + 8, 53); c.lineTo(x + 10, 57); c.lineTo(x, 56); c.closePath(); }, '#8a1a14', .25); }
    } },
    dolguldur: { w: 170, h: 116, base: 2, k: .55, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 116); c.quadraticCurveTo(50, 70, 85, 64); c.quadraticCurveTo(125, 70, 170, 116); c.closePath(); }, g.lin(0, 64, 0, 116, ['#1e2420', '#0c100e']), 0);
      const tw = (x, w2, h2) => { g.fill(() => { c.moveTo(x - w2, 66); c.lineTo(x - w2 * .7, 66 - h2); c.lineTo(x, 66 - h2 - 10); c.lineTo(x + w2 * .7, 66 - h2); c.lineTo(x + w2, 66); c.closePath(); }, g.lin(x - w2, 0, x + w2, 0, ['#1a1e1c', '#2e3430', '#121614']), .4); };
      tw(60, 9, 30); tw(85, 13, 48); tw(110, 9, 34); g.rr(58, 50, 54, 16, .5, '#1a1e1c', .4);
      for (const x of [20, 40, 140, 158]) { c.strokeStyle = '#141614'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, 100); c.lineTo(x + 1, 82); c.lineTo(x - 4, 74); c.moveTo(x + 1, 86); c.lineTo(x + 6, 78); c.stroke(); }
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [wx, wy] of [[85, 30], [60, 44], [110, 40], [84, 46]]) { const a = .4 + .3 * Math.sin(gt / 400 + wx), r = ctx.createRadialGradient(x + wx, y + wy, 0, x + wx, y + wy, 5); r.addColorStop(0, `rgba(160,255,140,${a})`); r.addColorStop(1, 'rgba(120,255,100,0)'); ctx.fillStyle = r; ctx.fillRect(x + wx - 5, y + wy - 5, 10, 10); } ctx.restore(); } },
    erebor: { w: 170, h: 112, base: 3, k: .55, paint(c, g, T) {
      g.fill(() => { c.moveTo(0, 112); c.lineTo(48, 42); c.lineTo(86, 4); c.lineTo(122, 34); c.lineTo(170, 112); c.closePath(); }, g.lin(0, 4, 0, 112, ['#a89a8a', '#6a5a4c', '#4a3e34']), 0);
      g.fill(() => { c.moveTo(74, 16); c.lineTo(86, 4); c.lineTo(100, 16); c.lineTo(93, 20); c.lineTo(86, 15); c.lineTo(79, 21); c.closePath(); }, 'rgba(240,244,250,.85)', 0);
      c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = .6; c.beginPath(); c.moveTo(86, 6); c.lineTo(70, 60); c.moveTo(86, 6); c.lineTo(104, 58); c.stroke();
      g.fill(() => { c.moveTo(14, 112); c.lineTo(30, 62); c.lineTo(44, 66); c.lineTo(52, 112); c.closePath(); }, '#5a4c40', .3); g.rr(30, 52, 7, 12, .5, '#6a5c50', .3); g.rr(29, 50, 9, 3, .3, '#7a6c60', .2);
      g.rr(70, 66, 32, 46, 1, g.lin(70, 0, 102, 0, ['#5a4a3c', '#8a7a68', '#5a4a3c']), .4); g.fill(() => { c.moveTo(75, 112); c.lineTo(75, 80); c.quadraticCurveTo(86, 66, 97, 80); c.lineTo(97, 112); c.closePath(); }, '#120c08', 0);
      g.rr(66, 66, 6, 46, .8, '#7a6a58', .3); g.rr(100, 66, 6, 46, .8, '#7a6a58', .3); g.rr(64, 62, 44, 5, .6, '#8a7a66', .3);
      c.fillStyle = g.lin(0, 100, 0, 112, ['rgba(120,170,210,.9)', 'rgba(70,120,170,.9)']); c.beginPath(); c.moveTo(79, 112); c.quadraticCurveTo(84, 104, 88, 112); c.closePath(); c.fill(); c.beginPath(); c.moveTo(80, 112); c.quadraticCurveTo(120, 104, 170, 108); c.lineTo(170, 112); c.closePath(); c.fill();
    }, anim(ctx, x, y, gt) { const a = .2 + .12 * Math.sin(gt / 900); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 86, y + 94, 0, x + 86, y + 94, 18); r.addColorStop(0, `rgba(255,190,90,${a})`); r.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = r; ctx.fillRect(x + 68, y + 76, 36, 36); ctx.restore(); } },
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
    if (r >= 5) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = 'rgba(255,110,70,.85)'; c.lineWidth = .7; c.beginPath(); c.arc(8, 8, 7.2, 0, Math.PI * 2); c.stroke(); for (let i = 0; i < 6; i++) { const a2 = i / 6 * Math.PI * 2; g.glow(8 + Math.cos(a2) * 7, 8 + Math.sin(a2) * 7, 1.6, '#ff6a3a', .55); } c.restore(); }
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
    else if (kind === 'onering') { g.glow(8, 8.5, 8, '#ffb030', .5); c.lineWidth = 3; c.strokeStyle = OL; c.beginPath(); c.ellipse(8, 8.5, 5, 4.6, 0, 0, TAU); c.stroke(); c.lineWidth = 2.2; c.strokeStyle = g.lin(3, 4, 13, 13, ['#fff6c0', '#f0c040', '#a86a10', '#ffe080']); c.stroke(); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,110,30,.95)'; for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; c.beginPath(); c.arc(8 + Math.cos(a) * 5, 8.5 + Math.sin(a) * 4.6, .22 + (i % 3) * .08, 0, TAU); c.fill(); } c.restore(); c.strokeStyle = 'rgba(255,255,240,.85)'; c.lineWidth = .5; c.beginPath(); c.ellipse(8, 8.5, 5, 4.6, 0, 3.6, 4.9); c.stroke(); }
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
  const LDIR = { weather: -1, helm: -1, cirith: -1, rhun: -1, khazad: -1, mirkwood: -1, dolguldur: -1 };
  const snowy0 = key => ['weather', 'snow', 'amonhen', 'helm', 'rhun', 'khazad', 'erebor'].includes(key);
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
    // Plastische Wolken: Schatten-, Körper- und Lichtschicht, nahtlos gekachelt
    const lum = cc => { const [r, gg2, b] = rgb(cc); return (r * .3 + gg2 * .59 + b * .11) / 255; }, dark = lum(T.sky[0]) < .22, LD = LDIR[key] || 1, sunX = T.sun ? 210 : 300;
    const skyMid = T.sky[Math.floor(T.sky.length / 2)], cShade = dark ? 'rgba(12,8,10,.34)' : rgba(sh(skyMid, -.25), .32), cBody = dark ? rgba(sh(T.sky[T.sky.length - 1], -.1), .32) : 'rgba(255,255,255,.4)', cLit = dark ? rgba(T.sky[T.sky.length - 1], .25) : 'rgba(255,250,236,.6)';
    for (let i = 0; i < 9; i++) {
      const cx0 = R() * TW, cy0 = 12 + R() * 32, w = 20 + R() * 40, puffs = []; for (let j = 0; j < 9 + (R() * 7 | 0); j++) puffs.push([(R() - .5) * w * 1.6, (R() - .6) * w * .22, w * (.16 + R() * .2)]);
      for (const dx of [0, -TW, TW]) { const ox = cx0 + dx, toSun = Math.sign(sunX - ox) || 1;
        sc.fillStyle = cShade; for (const [px, py, rr] of puffs) { sc.beginPath(); sc.ellipse(ox + px, cy0 + py + rr * .35, rr * 1.05, rr * .62, 0, 0, TAU); sc.fill(); }
        sc.fillStyle = cBody; for (const [px, py, rr] of puffs) { sc.beginPath(); sc.ellipse(ox + px, cy0 + py, rr, rr * .6, 0, 0, TAU); sc.fill(); }
        sc.fillStyle = cLit; for (const [px, py, rr] of puffs) { sc.beginPath(); sc.ellipse(ox + px + toSun * rr * .25, cy0 + py - rr * .22, rr * .62, rr * .34, 0, 0, TAU); sc.fill(); } }
    }
    // Bergketten mit Licht- und Schattenflanken, Rinnen und natürlicher Schneegrenze
    const ridge = (c, g, base, amp, ks, ph, col, col2, snow, shade = 1) => {
      const h = x => base - (Math.sin(x * fq(ks[0]) + ph) * amp + Math.sin(x * fq(ks[1]) + ph * 1.7) * amp * .45 + Math.sin(x * fq(ks[2]) + ph) * amp * .14 + Math.sin(x * fq(ks[2] * 3 + 1) + ph * 2.3) * amp * .05);
      const path = () => { c.beginPath(); c.moveTo(0, HZ + 4); for (let x = 0; x <= TW; x += 2) c.lineTo(x, h(x)); c.lineTo(TW, HZ + 4); c.closePath(); };
      path(); c.fillStyle = g.lin(0, base - amp * 1.5, 0, HZ, [col, col2]); c.fill();
      if (!shade) return;
      c.save(); path(); c.clip();
      // Licht/Schatten in grober Zwischenebene berechnen und weich hochskalieren (natürlicher Weichzeichner)
      const soft = (pxu, pyu, fn) => { const tc = document.createElement('canvas'); tc.width = Math.ceil(TW * pxu); tc.height = Math.ceil((HZ + 4) * pyu); const t = tc.getContext('2d'); t.scale(pxu, pyu); fn(t); c.imageSmoothingEnabled = true; c.drawImage(tc, 0, 0, TW, HZ + 4); };
      soft(.34, .6, t => { for (let x = 0; x < TW; x += 1.5) { const y0 = h(x), sl = (h(x - 7) - h(x + 7)) / 14 * LD, a = Math.max(-1, Math.min(1, sl * 2)), dep = Math.max(8, (base + amp * .2 - y0) * 1.1 + 10);
        const gr = t.createLinearGradient(0, y0, 0, y0 + dep); gr.addColorStop(0, a > 0 ? `rgba(255,242,222,${a * .26 * shade})` : `rgba(6,8,20,${-a * .32 * shade})`); gr.addColorStop(1, a > 0 ? 'rgba(255,242,222,0)' : 'rgba(6,8,20,0)'); t.fillStyle = gr; t.fillRect(x - .5, y0 - 1, 2.6, dep + 1); } });
      c.strokeStyle = `rgba(0,0,0,${.14 * shade})`; c.lineWidth = .35; for (let i = 0; i < 30; i++) { const x = R() * TW, y0 = h(x); c.beginPath(); c.moveTo(x, y0 + 1); c.quadraticCurveTo(x + (R() - .5) * 4, y0 + 6, x + (R() - .5) * 6, y0 + 9 + R() * 12); c.stroke(); }
      if (snow) { const sl0 = base - amp * .3; soft(.6, 1, t => { for (let x = 0; x < TW; x += 1) { const y0 = h(x); if (y0 < sl0) { const dep = (sl0 - y0) * (.55 + .45 * (Math.sin(x * .21) * .5 + Math.sin(x * .053 + 1) * .5)) + 1.5, lit = (h(x - 6) - h(x + 6)) * LD > 0, gr = t.createLinearGradient(0, y0, 0, y0 + dep); gr.addColorStop(0, lit ? 'rgba(255,255,255,.88)' : 'rgba(205,218,240,.7)'); gr.addColorStop(.7, lit ? 'rgba(255,255,255,.55)' : 'rgba(205,218,240,.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); t.fillStyle = gr; t.fillRect(x - .3, y0 - 1, 1.8, dep + 1); } } }); }
      c.restore();
    };
    // Fernste Kette im Himmel: blass in der Luftperspektive
    ridge(sc, sg, 58, 15, [3, 7, 19], R() * 9, rgba(sh(T.far, .35), dark ? .55 : .5), rgba(T.sky[T.sky.length - 1], .2), snowy0(key), .55);
    const snowy = ['weather', 'snow', 'amonhen', 'helm', 'rhun', 'khazad'].includes(key);
    const [far, fc, fg] = mk(HZ + 4, .38);
    ridge(fc, fg, 60, 13, [5, 11, 29], R() * 9, sh(T.far, .12), T.sky[T.sky.length - 1], snowy);
    fc.fillStyle = fg.lin(0, 46, 0, HZ, ['rgba(255,255,255,0)', rgba(T.sky[T.sky.length - 1], .55)]); fc.fillRect(0, 46, TW, HZ - 46);
    if (key === 'doom') { for (const x0 of [128, 128 + TW]) { fg.fill(() => { fc.moveTo(x0 - 48, HZ); fc.lineTo(x0 - 6, 18); fc.lineTo(x0 + 6, 18); fc.lineTo(x0 + 48, HZ); }, fg.lin(0, 18, 0, HZ, ['#3a120a', '#1a0806']), 0); fg.glow(x0, 18, 30, '#ff5a1a', .8); } }
    const [mid, mc, mg] = mk(HZ + 4, .7);
    ridge(mc, mg, 78, 6, [8, 19, 41], R() * 9, sh(T.mid, .1), sh(T.mid, -.15), false, .7);
    for (const dx of [0, -TW]) { mc.save(); mc.translate(dx, 0); props(mc, mg, key, T, rng(key + 'P'), HZ); mc.restore(); mc.save(); mc.translate(dx + 256, 0); props(mc, mg, key, T, rng(key + 'Q'), HZ); mc.restore(); }
    const [ground, gc, gg] = mk(144 - HZ + 2);
    gc.translate(0, -HZ);
    gc.fillStyle = gg.lin(0, HZ, 0, 144, [sh(T.ground, .1), T.ground, T.gd]); gc.fillRect(0, HZ, TW, 144 - HZ + 2);
    const both = (fn) => { fn(0); fn(-TW); fn(TW); };
    // großflächige Hell-Dunkel-Flecken und Horizontdunst für einen natürlichen Boden
    for (let i = 0; i < 46; i++) { const x = R() * TW, y = HZ + 4 + R() * 50, rx = 16 + R() * 40, sy = (.06 + R() * .1) * (1 + (y - HZ) / 40), lt = R() < .5, col = lt ? sh(T.ground, .3) : sh(T.gd, -.35); both(d => { gc.save(); gc.translate(x + d, y); gc.scale(1, sy); gc.fillStyle = gg.rad(0, 0, rx, [rgba(col, .2), rgba(col, 0)]); gc.beginPath(); gc.arc(0, 0, rx, 0, TAU); gc.fill(); gc.restore(); }); }
    gc.fillStyle = gg.lin(0, HZ, 0, HZ + 9, [rgba(T.sky[T.sky.length - 1], .32), rgba(T.sky[T.sky.length - 1], 0)]); gc.fillRect(0, HZ, TW, 9);
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

  return { flag, sled, landmark, drawEagle, draw, toCanvas, card, layers, dims, ANIMS, impactTime, animTime, background, icon, BODY, sh, rgba, ease, easeOut, P };
})();
