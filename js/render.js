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
      /* Durchgehende Gliedmaße: eine weiche Kontur um die ganze Kette (keine Gelenkscheiben), Licht von rechts oben */
      limbS(pts, ws, col, ow = .4, rim = .22) {
        const n = pts.length; if (n < 2) return; const Lp = [], Rp = [], T = [];
        for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; T.push([tx, ty]); const r = ws[i] / 2; Lp.push([pts[i][0] - ty * r, pts[i][1] + tx * r]); Rp.push([pts[i][0] + ty * r, pts[i][1] - tx * r]); }
        const side = S => { for (let i = 1; i < n - 1; i++) c.quadraticCurveTo(S[i][0], S[i][1], (S[i][0] + S[i + 1][0]) / 2, (S[i][1] + S[i + 1][1]) / 2); c.lineTo(S[n - 1][0], S[n - 1][1]); };
        const path = () => { c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]); side(Lp); const ae = Math.atan2(T[n - 1][1], T[n - 1][0]); c.arc(pts[n - 1][0], pts[n - 1][1], ws[n - 1] / 2, ae + Math.PI / 2, ae - Math.PI / 2, true);
          const R2 = Rp.slice().reverse(); for (let i = 1; i < n - 1; i++) c.quadraticCurveTo(R2[i][0], R2[i][1], (R2[i][0] + R2[i + 1][0]) / 2, (R2[i][1] + R2[i + 1][1]) / 2); c.lineTo(Rp[0][0], Rp[0][1]); const a0 = Math.atan2(T[0][1], T[0][0]); c.arc(pts[0][0], pts[0][1], ws[0] / 2, a0 - Math.PI / 2, a0 + Math.PI / 2, true); c.closePath(); };
        const m = n >> 1, mw = Math.max(...ws) * .62; let nx = -T[m][1], ny = T[m][0]; if (nx - ny * .5 < 0) { nx = -nx; ny = -ny; }
        path(); c.fillStyle = o.lin(pts[m][0] + nx * mw, pts[m][1] + ny * mw, pts[m][0] - nx * mw, pts[m][1] - ny * mw, [sh(col, .24), sh(col, .06), col, sh(col, -.34)]); c.fill();
        if (ow) { c.lineWidth = ow; c.strokeStyle = OL; c.lineJoin = 'round'; c.stroke(); }
        if (rim) { const S = (nx * -T[m][1] + ny * T[m][0]) >= 0 ? Lp : Rp; c.save(); c.lineCap = 'round'; c.strokeStyle = rgba('#fff4e0', rim); c.lineWidth = Math.max(.12, mw * .22); c.beginPath(); c.moveTo(S[0][0] * .85 + pts[0][0] * .15, S[0][1] * .85 + pts[0][1] * .15); for (let i = 1; i < n; i++) c.lineTo(S[i][0] * .85 + pts[i][0] * .15, S[i][1] * .85 + pts[i][1] * .15); c.stroke(); c.restore(); }
      },
      glow(x, y, r, col, a = .8) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = o.rad(x, y, r, [rgba(col, a), rgba(col, a * .35), rgba(col, 0)]); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore(); }
    };
    return o;
  }
  const dir = a => [Math.cos(a), Math.sin(a)];
  const chain = (a, b, c2) => [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b, [(b[0] + c2[0]) / 2, (b[1] + c2[1]) / 2], c2];

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
    // weite Glockenärmel für Roben: vom Ellbogen zum Handgelenk aufgeweitet
    const robeSleeve = (A, col) => { const ex = A.e, hx = A.h, dx = hx[0] - ex[0], dy = hx[1] - ex[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w0 = B.lw * .45, w1 = B.lw * 1.05, end = [ex[0] + dx * .86, ex[1] + dy * .86];
      g.fill(() => { c.moveTo(ex[0] + nx * w0, ex[1] + ny * w0); c.quadraticCurveTo(ex[0] + dx * .5 + nx * w0 * 1.3, ex[1] + dy * .5 + ny * w0 * 1.3, end[0] + nx * w1, end[1] + ny * w1 + .6); c.quadraticCurveTo(end[0] + dx * .08, end[1] + dy * .08 + .9, end[0] - nx * w1 * .7, end[1] - ny * w1 * .7 + .3); c.quadraticCurveTo(ex[0] + dx * .45 - nx * w0, ex[1] + dy * .45 - ny * w0, ex[0] - nx * w0, ex[1] - ny * w0); c.closePath(); }, g.lin(ex[0] + nx * w1, ex[1] + ny * w1, ex[0] - nx * w1, ex[1] - ny * w1, [sh(col, .18), col, sh(col, -.32)]), ow * .8);
      c.strokeStyle = rgba(sh(col, -.5), .45); c.lineWidth = .18; c.beginPath(); c.moveTo(ex[0] + dx * .3, ex[1] + dy * .3); c.quadraticCurveTo(end[0] - nx * .2, end[1] - ny * .2, end[0] + nx * w1 * .3, end[1] + ny * w1 * .3 + .7); c.stroke(); };
    const aF = arm(sF, p.aF, B.al);
    const wd = dir(p.wa), wp = [-Math.sin(p.wa), Math.cos(p.wa)];
    let aB = arm(sB, p.aB, B.al);
    if (w === 'bow' && p.draw > 0) { const hh = [aF.h[0] - wp[0] * (1.5 + p.draw * 6.5), aF.h[1] - wp[1] * (1.5 + p.draw * 6.5)]; aB = { e: [(sB[0] + hh[0]) / 2 - .3, (sB[1] + hh[1]) / 2 + 1.4], h: hh }; }
    g.limbS(chain(sB, aB.e, aB.h), [B.lw * .98, B.lw * .88, B.lw * .64, B.lw * .68, B.lw * .48], sh(sleeve, -.3), ow * .8, 0);
    if (L.robe) robeSleeve(aB, sh(tunic, -.3));
    g.ell(aB.h[0], aB.h[1], B.lw * .38, B.lw * .42, g.rad(aB.h[0] + .2, aB.h[1] - .2, B.lw * .5, [sh(skin, -.1), sh(skin, -.32)]), ow * .8);
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
      const calf = [(knee[0] + ank[0]) / 2 - B.lw * .12, (knee[1] + ank[1]) / 2], thigh = [(hx + knee[0]) / 2 + B.lw * .06, (hipY + knee[1]) / 2];
      g.limbS([[hx, hipY], thigh, knee, calf, ank], [B.lw * 1.34, B.lw * 1.2, B.lw * .84, B.lw * .94, B.lw * .58], col, ow * .8, front ? .16 : 0);
      // Kniekehle und Kniescheibe als feine Falte statt Scheibe
      if (B.ll >= 9 && front) { const kx = knee[0], ky = knee[1]; c.save(); c.lineCap = 'round'; c.strokeStyle = rgba(sh(col, -.55), .45); c.lineWidth = .16; c.beginPath(); c.moveTo(kx - B.lw * .42, ky - .5); c.quadraticCurveTo(kx - B.lw * .2, ky + .1, kx - B.lw * .38, ky + .6); c.stroke(); c.strokeStyle = rgba(sh(col, .4), .3); c.beginPath(); c.moveTo(kx + B.lw * .18, ky - .4); c.quadraticCurveTo(kx + B.lw * .42, ky, kx + B.lw * .2, ky + .45); c.stroke(); c.restore(); }
      if (B.feet) { const fc = front ? skin : sh(skin, -.2); g.fill(() => { c.moveTo(ank[0] - B.lw * .4, ank[1]); c.quadraticCurveTo(ank[0] - B.lw * .5, foot[1] + .5, ank[0] - .2, foot[1] + .5); c.lineTo(ank[0] + 2.4, foot[1] + .5); c.quadraticCurveTo(ank[0] + 2.8, foot[1] - .3, ank[0] + 1.4, foot[1] - .5); c.quadraticCurveTo(ank[0] + .6, ank[1] - .2, ank[0] - B.lw * .4, ank[1]); }, g.lin(0, ank[1], 0, foot[1] + .5, [sh(fc, .1), sh(fc, -.2)]), ow * .8); c.fillStyle = rgba(hair, .7); for (let i = 0; i < 4; i++) c.fillRect(ank[0] + .1 + i * .45, foot[1] - .7 - (i % 2) * .2, .25, .5); }
      else {
        const bc0 = front ? boots : sh(boots, -.3), sx = knee[0] + (ank[0] - knee[0]) * .3, sy = knee[1] + (ank[1] - knee[1]) * .3;
        g.limbS([[sx, sy], [(sx + ank[0]) / 2 - B.lw * .06, (sy + ank[1]) / 2], ank], [B.lw * 1.02, B.lw * .94, B.lw * .7], bc0, ow * .8, front ? .14 : 0);
        // umgeschlagene Stulpe: schmales Band quer zum Bein, mit Lederfalte
        if (B.ll >= 9) { const ang = Math.atan2(ank[1] - sy, ank[0] - sx); c.save(); c.translate(sx, sy); c.rotate(ang); g.fill(() => { c.moveTo(-.55, -B.lw * .58); c.quadraticCurveTo(.2, -B.lw * .62, .75, -B.lw * .55); c.lineTo(.75, B.lw * .55); c.quadraticCurveTo(.2, B.lw * .62, -.55, B.lw * .58); c.closePath(); }, g.lin(0, -B.lw * .6, 0, B.lw * .6, [sh(bc0, .32), sh(bc0, .08), sh(bc0, -.3)]), ow * .6); c.strokeStyle = rgba(sh(bc0, -.6), .5); c.lineWidth = .12; c.beginPath(); c.moveTo(.1, -B.lw * .5); c.lineTo(.25, B.lw * .5); c.stroke(); c.restore(); }
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
      // Ein durchgehendes Gewand von der Schulter bis zum Saum, mit Taille, Faltenwurf und welligem Saum
      const rt = hipY - B.th, wst = B.tw * .37, br = (p.breath || 0) * .15, hemF = [cx + B.tw / 2 + 1.7 + sw * .5, rb - 1.1], hemB = [cx - B.tw / 2 - 1.9 + sw * .4, rb - 1.3];
      const robe = () => { c.moveTo(cx - B.tw / 2 + .3, rt + .9); c.quadraticCurveTo(cx - B.tw / 2 + .4, rt - .3 - br, cx - B.tw * .15, rt - .35 - br); c.lineTo(cx + B.tw * .15, rt - .35 - br); c.quadraticCurveTo(cx + B.tw / 2 + .2, rt - .2, cx + B.tw / 2 + .15, rt + 1.4); c.quadraticCurveTo(cx + B.tw / 2 + .7, rt + B.th * .38, cx + wst + .2, hipY - B.th * .28); c.bezierCurveTo(cx + wst + .5, hipY + B.ll * .2, hemF[0] - .4, hipY + B.ll * .55, hemF[0], hemF[1]);
        for (let i = 1; i <= 6; i++) { const t = i / 6, x = hemF[0] + (hemB[0] - hemF[0]) * t, y = hemF[1] + (hemB[1] - hemF[1]) * t + Math.sin(t * 9 + gt / 380) * .25; c.quadraticCurveTo(x + (hemB[0] - hemF[0]) / 12, y + .55, x, y); }
        c.bezierCurveTo(hemB[0] + .4, hipY + B.ll * .5, cx - wst - .6, hipY + B.ll * .2, cx - wst - .2, hipY - B.th * .3); c.quadraticCurveTo(cx - B.tw / 2 - .3, rt + B.th * .38, cx - B.tw / 2 + .3, rt + .9); c.closePath(); };
      g.fill(robe, g.lin(cx - B.tw * .9, 0, cx + B.tw * .9, 0, [sh(tunic, -.34), sh(tunic, -.08), tunic, sh(tunic, .14)]), ow);
      c.save(); c.beginPath(); robe(); c.clip(); c.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const fx = cx - B.tw * .32 + i * B.tw * .22, fy = hipY - B.th * .2, ex = fx + (i - 1.5) * 1.1 + sw * .35, ey = rb - .8; c.strokeStyle = rgba(sh(tunic, -.55), .42); c.lineWidth = .32; c.beginPath(); c.moveTo(fx, fy); c.quadraticCurveTo(fx + (i - 1.5) * .3, (fy + ey) / 2, ex, ey); c.stroke(); c.strokeStyle = rgba(sh(tunic, .5), .22); c.lineWidth = .22; c.beginPath(); c.moveTo(fx + .45, fy + .4); c.quadraticCurveTo(fx + .45 + (i - 1.5) * .3, (fy + ey) / 2, ex + .45, ey); c.stroke(); }
      c.fillStyle = g.lin(0, rb - 3, 0, rb, [rgba('#000000', 0), rgba('#000000', .18)]); c.fillRect(cx - B.tw * 2, rb - 3, B.tw * 4, 3);
      c.strokeStyle = rgba(sh(tunic, -.5), .35); c.lineWidth = .3; c.beginPath(); c.moveTo(cx + B.tw * .12, rt + .3); c.quadraticCurveTo(cx + B.tw * .18, rt + B.th * .3, cx + B.tw * .1, hipY - B.th * .3); c.stroke();
      c.restore();
    } else { legs(false); legs(true); }
    // Torso
    c.save(); c.translate(cx, hipY); c.rotate(tilt); c.translate(-cx, -hipY);
    const br = (p.breath || 0) * .15;
    // Hals
    g.limbS([[hxC - .25, top + .8], [hxC - .3 * hk * 6.2 / 4.3, (top + chinY) / 2], [hxC - .35 * hk * 6.2 / 4.3, chinY - .6]], [B.hw * .52, B.hw * .46, B.hw * .44], sh(skin, -.18), ow * .7, 0);
    c.fillStyle = rgba('#000000', .22); c.beginPath(); c.ellipse(hxC - .1, chinY + .15, B.hw * .3, .45, 0, 0, TAU); c.fill();
    // Riesen: breite Schultern, Brustwölbung, schmale Taille. Trolle: Buckel, vorgebeugter Oberkörper, Wanst
    const giantTorso = () => { const tw = B.tw; c.moveTo(cx - tw * .5, top + 1.6); c.quadraticCurveTo(cx - tw * .46, top - .2, cx - tw * .14, top - .7 - br); c.lineTo(cx + tw * .16, top - .7 - br); c.quadraticCurveTo(cx + tw * .46, top - .3, cx + tw * .52, top + 1.8); c.bezierCurveTo(cx + tw * .62, top + B.th * .26, cx + tw * .5, top + B.th * .48, cx + tw * .3, hipY - B.th * .22); c.quadraticCurveTo(cx + tw * .32, hipY - B.th * .08, cx + tw * .37, hipY + .2); c.lineTo(cx - tw * .37, hipY + .2); c.quadraticCurveTo(cx - tw * .33, hipY - B.th * .1, cx - tw * .31, hipY - B.th * .24); c.bezierCurveTo(cx - tw * .52, top + B.th * .48, cx - tw * .6, top + B.th * .26, cx - tw * .5, top + 1.6); c.closePath(); };
    const trollTorso = () => { const tw = B.tw; c.moveTo(cx - tw * .48, top + B.th * .35); c.bezierCurveTo(cx - tw * .62, top + B.th * .05, cx - tw * .42, top - 3.2, cx - tw * .05, top - 2.6 - br); c.quadraticCurveTo(cx + tw * .32, top - 1.8, cx + tw * .44, top + 1.4); c.bezierCurveTo(cx + tw * .58, top + B.th * .3, cx + tw * .66, hipY - B.th * .42, cx + tw * .58, hipY - B.th * .18); c.quadraticCurveTo(cx + tw * .5, hipY + .1, cx + tw * .36, hipY + .2); c.lineTo(cx - tw * .38, hipY + .2); c.quadraticCurveTo(cx - tw * .46, hipY - B.th * .2, cx - tw * .48, top + B.th * .35); c.closePath(); };
    const wst = B.tw * .39, hipW = B.tw * .43, tg = g.lin(cx - B.tw / 2, top, cx + B.tw / 2, top + B.th * .4, [sh(tunic, -.32), sh(tunic, -.05), tunic, sh(tunic, .16)]);
    const tpath = B.hunch >= 2 ? trollTorso : big ? giantTorso : (() => { c.moveTo(cx - B.tw / 2 + .3, top + .9); c.quadraticCurveTo(cx - B.tw / 2 + .4, top - .3 - br, cx - B.tw * .15, top - .35 - br); c.lineTo(cx + B.tw * .15, top - .35 - br); c.quadraticCurveTo(cx + B.tw / 2 + .2, top - .2, cx + B.tw / 2 + .1, top + 1.4); c.quadraticCurveTo(cx + B.tw / 2 + .55, top + B.th * .36, cx + wst + .2, hipY - B.th * .26); c.lineTo(cx + hipW, hipY + .2); c.lineTo(cx - hipW, hipY + .2); c.lineTo(cx - wst, hipY - B.th * .3); c.quadraticCurveTo(cx - B.tw / 2 - .2, top + B.th * .36, cx - B.tw / 2 + .3, top + .9); c.closePath(); });
    if (!L.robe) g.fill(tpath, tg, ow);
    if (B.hunch >= 2 || (big && !L.armor && !L.robe)) { c.save(); c.beginPath(); tpath(); c.clip(); c.lineCap = 'round';
      // Muskeln/Wanst: weiche Licht- und Schattenformen, keine Kästen
      c.fillStyle = g.rad(cx + B.tw * .2, top + B.th * .3, B.tw * .5, [rgba(sh(tunic, .35), .35), rgba(tunic, 0)]); c.fillRect(cx - B.tw, top - 4, B.tw * 2, B.th + 4);
      c.fillStyle = g.rad(cx - B.tw * .35, top + B.th * .5, B.tw * .55, [rgba('#000000', .28), rgba('#000000', 0)]); c.fillRect(cx - B.tw, top - 4, B.tw * 2, B.th + 4);
      c.strokeStyle = rgba(sh(tunic, -.55), .45); c.lineWidth = .4; c.beginPath(); if (B.hunch >= 2) { c.moveTo(cx - B.tw * .05, hipY - B.th * .45); c.quadraticCurveTo(cx + B.tw * .45, hipY - B.th * .5, cx + B.tw * .55, hipY - B.th * .15); c.moveTo(cx - B.tw * .3, top + .5); c.quadraticCurveTo(cx - B.tw * .1, top + B.th * .2, cx + B.tw * .2, top + B.th * .12); } else { c.moveTo(cx + B.tw * .05, top + B.th * .12); c.quadraticCurveTo(cx + B.tw * .3, top + B.th * .36, cx + B.tw * .48, top + B.th * .18); c.moveTo(cx + B.tw * .1, top + B.th * .5); c.lineTo(cx + B.tw * .12, hipY - 2); for (let i = 0; i < 3; i++) { c.moveTo(cx + B.tw * .02, top + B.th * (.55 + i * .1)); c.quadraticCurveTo(cx + B.tw * .2, top + B.th * (.57 + i * .1), cx + B.tw * .34, top + B.th * (.54 + i * .1)); } } c.stroke();
      if (L.fire) { c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba('#ff7a1a', .55 + Math.sin(gt / 200) * .2); c.lineWidth = .35; c.beginPath(); for (let i = 0; i < 6; i++) { const x1 = cx - B.tw * .3 + (i * 7.3 % 10) / 10 * B.tw * .6, y1 = top + 2 + (i * 4.1 % 10) / 10 * B.th * .7; c.moveTo(x1, y1); c.lineTo(x1 + 1.2, y1 + 1.6); c.lineTo(x1 + .6, y1 + 3); } c.stroke(); }
      c.restore(); }
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
    else if (!L.noface) { // Kordel oder Schärpe in der Taille
      const by = hipY - B.th * .3, rope = L.hat === 'wizard' ? sh(tunic, -.25) : '#d8b860', bw2 = B.tw * .4; c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = .9; c.beginPath(); c.moveTo(cx - bw2, by - .1); c.quadraticCurveTo(cx, by + .45, cx + bw2 + .2, by); c.stroke(); c.strokeStyle = rope; c.lineWidth = .6; c.stroke();
      const sw2 = Math.sin(gt / 500) * .3 + (p.cape || 0) * .15; c.strokeStyle = OL; c.lineWidth = .6; c.beginPath(); c.moveTo(cx + bw2 * .55, by + .2); c.quadraticCurveTo(cx + bw2 * .6 + sw2, by + 2.2, cx + bw2 * .45 + sw2 * 1.4, by + 4); c.stroke(); c.strokeStyle = rope; c.lineWidth = .35; c.stroke(); g.ell(cx + bw2 * .45 + sw2 * 1.4, by + 4.2, .35, .5, rope, .15); }
    if (L.armor && big) {
      // Plattenpanzer der Riesen: der Rumpfform folgend, mit Grat, Lamellen und Nieten; darunter Plattenschurz
      const A = L.armor; c.save(); c.beginPath(); tpath(); c.clip();
      c.fillStyle = g.lin(cx - B.tw * .5, top, cx + B.tw * .55, top + B.th * .5, [sh(A, -.35), sh(A, .05), sh(A, .32), sh(A, -.1)]); c.fillRect(cx - B.tw, top - 4, B.tw * 2, B.th * .74 + 4);
      c.strokeStyle = rgba(sh(A, -.6), .7); c.lineWidth = .35; for (let i = 0; i < 3; i++) { const yy = top + B.th * (.5 + i * .09); c.beginPath(); c.moveTo(cx - B.tw * .6, yy); c.quadraticCurveTo(cx, yy + 1.4, cx + B.tw * .6, yy - .2); c.stroke(); }
      c.strokeStyle = rgba(sh(A, .6), .45); c.lineWidth = .5; c.beginPath(); c.moveTo(cx + B.tw * .12, top); c.quadraticCurveTo(cx + B.tw * .2, top + B.th * .25, cx + B.tw * .1, top + B.th * .5); c.stroke();
      c.strokeStyle = rgba('#fff8e8', .3); c.lineWidth = .7; c.beginPath(); c.moveTo(cx + B.tw * .5, top + 2); c.bezierCurveTo(cx + B.tw * .58, top + B.th * .26, cx + B.tw * .5, top + B.th * .42, cx + B.tw * .38, top + B.th * .55); c.stroke();
      c.fillStyle = sh(A, .5); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(cx - B.tw * .35 + i * B.tw * .18, top + B.th * .74 - .8, .35, 0, TAU); c.fill(); }
      c.fillStyle = g.lin(0, top + B.th * .74, 0, hipY, [sh(tunic, -.1), sh(tunic, -.35)]); c.fillRect(cx - B.tw, top + B.th * .74, B.tw * 2, hipY - top);
      c.restore();
      // Plattenschurz unter dem Gürtel
      // gefächerte, überlappende Beinschienen-Lamellen (hinten dunkler, vorne heller)
      for (const i of [0, 4, 1, 3, 2]) { const t = i / 4, fx = cx - B.tw * .34 + t * B.tw * .68, sw2 = (p.walkPh !== undefined ? Math.sin(p.walkPh + i) * .3 : 0), fan = (t - .5) * .5, w0 = B.tw * .17, w1 = B.tw * .21, ln = B.ll * (.3 - Math.abs(t - .5) * .08), dk = i === 2 ? 0 : (i === 1 || i === 3) ? -.1 : -.22;
        c.save(); c.translate(fx, hipY - .7); c.rotate(fan * .35);
        g.fill(() => { c.moveTo(-w0, 0); c.lineTo(w0, 0); c.lineTo(w1 + sw2 * .3, ln - .6); c.quadraticCurveTo(sw2 * .3, ln + .9, -w1 + sw2 * .3, ln - .6); c.closePath(); }, g.lin(-w1, 0, w1, ln, [sh(A, .35 + dk), sh(A, dk), sh(A, -.38 + dk)]), ow * .7);
        c.strokeStyle = rgba(sh(A, -.6), .5); c.lineWidth = .22; c.beginPath(); c.moveTo(-w0 * 1.05, ln * .42); c.quadraticCurveTo(0, ln * .5, w0 * 1.05, ln * .42); c.stroke(); c.strokeStyle = rgba('#fff8e8', .25); c.beginPath(); c.moveTo(-w0 * .7, .5); c.lineTo(-w1 * .7, ln - 1); c.stroke(); c.restore(); }
    } else if (L.armor) {
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
      const sw = big ? 7 : 4.4, shh = big ? 11 : 7.4, sx = cx + B.tw / 2 - 1.6, sy = top + 1, sc = L.shield;
      const shp = () => { c.moveTo(sx, sy); c.lineTo(sx + sw, sy); c.lineTo(sx + sw, sy + shh * .55); c.quadraticCurveTo(sx + sw, sy + shh * .9, sx + sw / 2, sy + shh); c.quadraticCurveTo(sx, sy + shh * .9, sx, sy + shh * .55); c.closePath(); };
      g.fill(shp, g.lin(sx, sy, sx + sw, sy + shh, [sh(sc, .35), sc, sh(sc, -.35)]), ow * 1.4);
      c.save(); c.beginPath(); shp(); c.clip();
      // Bretter, Maserung, Abnutzung, Wölbung
      c.strokeStyle = rgba(sh(sc, -.55), .5); c.lineWidth = .16; c.beginPath(); for (let i = 1; i < 4; i++) { const x = sx + sw * i / 4; c.moveTo(x, sy); c.lineTo(x, sy + shh); } c.stroke();
      c.strokeStyle = rgba(sh(sc, -.4), .35); c.lineWidth = .08; c.beginPath(); for (let i = 0; i < 4; i++) { const x = sx + sw * (i + .5) / 4; c.moveTo(x - .2, sy + shh * .15); c.quadraticCurveTo(x + .25, sy + shh * .45, x - .1, sy + shh * .8); } c.stroke();
      c.fillStyle = g.lin(sx, sy, sx + sw, sy + shh, ['rgba(255,255,255,.22)', 'rgba(255,255,255,0)', 'rgba(0,0,0,.28)']); c.fillRect(sx, sy, sw, shh);
      c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = .1; c.beginPath(); c.moveTo(sx + sw * .18, sy + shh * .66); c.lineTo(sx + sw * .36, sy + shh * .6); c.moveTo(sx + sw * .64, sy + shh * .24); c.lineTo(sx + sw * .8, sy + shh * .3); c.moveTo(sx + sw * .3, sy + shh * .3); c.lineTo(sx + sw * .38, sy + shh * .36); c.stroke();
      // Metallrand (innen sichtbar)
      c.strokeStyle = g.lin(sx, sy, sx + sw, sy + shh, ['#e8e8f0', '#9a9aa6', '#5a5a66']); c.lineWidth = big ? 1.5 : 1.1; c.beginPath(); shp(); c.stroke(); c.restore();
      c.fillStyle = '#d8d8e0'; for (const [rx, ry] of [[.14, .1], [.86, .1], [.5, .1], [.12, .52], [.88, .52], [.5, .9]]) { c.beginPath(); c.arc(sx + sw * rx, sy + shh * ry, big ? .32 : .22, 0, TAU); c.fill(); }
      // Buckel mit Ring
      const bx = sx + sw / 2, by = sy + shh * .44, br = sw * .19;
      g.ell(bx, by, br * 1.35, br * 1.35, rgba(sh(sc, -.5), .55), 0);
      g.ell(bx, by, br, br, g.rad(bx - br * .35, by - br * .35, br * 1.3, ['#ffffff', '#c8c8d0', '#6a6a76']), .3);
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = .25; c.beginPath(); c.moveTo(sx + .5, sy + .45); c.lineTo(sx + sw - .5, sy + .45); c.stroke();
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
      { c.save(); c.beginPath(); c.moveTo(x0 + HW * (bd === 'dwarf' ? .2 : .3), y0 + HH * .55); c.quadraticCurveTo(x0 + HW * .62, y0 + HH * .8, x0 + HW - .25, y0 + HH * .74); c.lineTo(x0 + HW + .3, y0 + HH * .78); c.quadraticCurveTo(x0 + HW + .4, y0 + HH + len * .6, x0 + HW * .55 + sw, y0 + HH + len); c.quadraticCurveTo(x0 + HW - wid, y0 + HH + len * .5, x0 + HW * (bd === 'dwarf' ? .2 : .3), y0 + HH * .55); c.clip();
        c.lineWidth = .14; c.lineCap = 'round'; for (const [col, off] of [[rgba(sh(bc, .5), .45), 0], [rgba(sh(bc, -.5), .4), .3]]) { c.strokeStyle = col; c.beginPath(); for (let i = 0; i < 7; i++) { const t = i / 6, sx2 = x0 + HW * (.35 + t * .6) + off, ex2 = x0 + HW * .55 + sw + (t - .5) * wid * .5 + off; c.moveTo(sx2, y0 + HH * .8); c.bezierCurveTo(sx2 + .3, y0 + HH + len * .3, ex2 - .3, y0 + HH + len * .6, ex2, y0 + HH + len * .95); } c.stroke(); } c.restore(); }
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
      // Dornenhelm: Kuppel mit Visier, Nackenschutz und einer Krone schräg zurückgeschwungener Dornen
      const hm = g.lin(x0, y0 - 2, x0 + HW, y0 + HH, [sh(hc, .45), hc, sh(hc, -.4)]), sp = big ? 1.6 : 1;
      for (let i = 0; i < 5; i++) { const bx = x0 + .2 + i * (HW - .2) / 4.4, hgt = (3.6 + (i === 2 ? 2.2 : i % 2 ? .6 : 1.4)) * sp, lean2 = -.9 - i * .25; g.fill(() => { c.moveTo(bx - .7, y0 + .2); c.quadraticCurveTo(bx - .3 + lean2 * .4, y0 - hgt * .5, bx + lean2, y0 - hgt); c.quadraticCurveTo(bx + .2 + lean2 * .3, y0 - hgt * .45, bx + .75, y0 + .1); c.closePath(); }, g.lin(bx - .7, 0, bx + .7, 0, [sh(hc, -.45), sh(hc, .2), sh(hc, -.25)]), owH); }
      g.fill(() => { c.moveTo(x0 - .9, y0 + HH * .95); c.quadraticCurveTo(x0 - 1.2, y0 - .4, x0 + HW * .45, y0 - 1.1); c.quadraticCurveTo(x0 + HW + .9, y0 - .8, x0 + HW + .75, y0 + HH * .45); c.lineTo(x0 + HW + .5, y0 + HH * 1.02); c.quadraticCurveTo(x0 + HW * .5, y0 + HH * 1.1, x0 + HW * .2, y0 + HH * .98); c.lineTo(x0 + HW * .05, y0 + HH * 1.15); c.lineTo(x0 - .9, y0 + HH * .95); c.closePath(); }, hm, owH);
      c.strokeStyle = rgba(sh(hc, .7), .5); c.lineWidth = .25; c.beginPath(); c.moveTo(x0 + .2, y0 + .2); c.quadraticCurveTo(x0 + HW * .5, y0 - .8, x0 + HW + .3, y0 + HH * .3); c.stroke();
      c.strokeStyle = rgba(sh(hc, -.6), .6); c.lineWidth = .22; c.beginPath(); c.moveTo(x0 + HW * .35, y0 - .6); c.lineTo(x0 + HW * .3, y0 + HH * 1.05); c.moveTo(x0 + HW * .62, ey + .9); c.lineTo(x0 + HW + .55, ey + .9); c.stroke();
      c.fillStyle = '#050506'; c.beginPath(); c.moveTo(x0 + HW * .42, ey - .45); c.lineTo(x0 + HW + .8, ey - .55); c.lineTo(x0 + HW + .75, ey + .45); c.lineTo(x0 + HW * .42, ey + .35); c.closePath(); c.fill(); c.fillStyle = '#050506'; for (let i = 0; i < 3; i++) c.fillRect(x0 + HW * .7 + i * .45, ey + 1.6, .2, 1.1);
      g.glow(x0 + HW * .78, ey, big ? 4 : 2.6, L.glow || '#ff4020', 1); g.glow(x0 + HW * .5, ey, big ? 3 : 2, L.glow || '#ff4020', .7); c.fillStyle = sh(L.glow || '#ff4020', .5); c.fillRect(x0 + HW * .55, ey - .18, HW * .5, .36);
    }
    c.restore();
    // Waffe + vorderer Arm
    if (!p.hide) { weapon(c, g, w, aF.h, wd, wp, B, K, wc, L, p, aB.h, ow, gt); if (L.wglow) sigGlow(c, g, L, w, aF.h, wd, K, gt); gearGlow(c, g, L, w, aF.h, wd, K, gt); }
    g.limbS(chain(sF, aF.e, aF.h), [B.lw * 1.08, B.lw * .96, B.lw * .7, B.lw * .74, B.lw * .52], sh(sleeve, -.02), ow * .8, .2);
    if (L.robe) robeSleeve(aF, tunic);
    // geschichtete Schulterpanzer für gerüstete Riesen (bei Dornenhelm mit Stacheln)
    if (L.armor && big) { const A = L.armor, rx = B.lw * 1.02, ry = B.lw * .72; c.save(); c.translate(sF[0] + .3, sF[1] - .2); c.rotate(-.12 + (p.aF - 1.2) * .08);
      if (L.hat === 'spikehelm') for (let i = 0; i < 3; i++) g.fill(() => { const bx = -rx * .55 + i * rx * .5; c.moveTo(bx - .7, -ry * .7); c.lineTo(bx - .4 - i * .3, -ry * .7 - 3.4 - (i === 1 ? 1.2 : 0)); c.lineTo(bx + .7, -ry * .75); c.closePath(); }, sh(A, -.25), ow * .8);
      for (let i = 2; i >= 0; i--) { const yy = i * ry * .55, k2 = 1 - i * .1; g.fill(() => { c.ellipse(0, yy, rx * k2, ry * k2, 0, Math.PI, TAU); c.quadraticCurveTo(rx * k2 * .6, yy + ry * .35, 0, yy + ry * .38); c.quadraticCurveTo(-rx * k2 * .6, yy + ry * .35, -rx * k2, yy); c.closePath(); }, g.lin(0, yy - ry, 0, yy + ry * .4, [sh(A, .55), sh(A, .1), sh(A, -.4)]), ow); }
      c.strokeStyle = rgba('#fff8e8', .4); c.lineWidth = .4; c.beginPath(); c.ellipse(0, 0, rx * .82, ry * .78, 0, Math.PI * 1.15, Math.PI * 1.7); c.stroke(); c.fillStyle = sh(A, .6); for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * rx * .45, -ry * .35 + Math.abs(i) * .4, .3, 0, TAU); c.fill(); }
      c.restore(); }
    // Schulterwölbung (Deltamuskel) als weicher Lichtbogen
    c.save(); c.lineCap = 'round'; c.strokeStyle = rgba('#fff4e0', .2); c.lineWidth = B.lw * .2; c.beginPath(); c.arc(sF[0] + .1, sF[1] + .45, B.lw * .42, -2.4, -.5); c.stroke(); c.restore();
    if (L.gear && L.gear.a && L.gear.a.r >= 2) { const ar = L.gear.a.r, pc = ar >= 4 ? '#ffcf6a' : ar >= 3 ? '#b8a8e8' : '#a8bccc', px = sF[0] + .15, py = sF[1] + .1, rw = B.lw * .78, rh = B.lw * .55;
      g.fill(() => { c.ellipse(px, py, rw, rh, -.25, Math.PI * 1.02, Math.PI * 2.08); c.closePath(); }, g.lin(px, py - rh, px, py + rh * .4, [sh(pc, .55), pc, sh(pc, -.4)]), ow * .9);
      g.fill(() => { c.ellipse(px - .1, py + rh * .45, rw * .85, rh * .5, -.25, Math.PI * 1.02, Math.PI * 2.05); c.closePath(); }, g.lin(px, py, px, py + rh, [sh(pc, .3), sh(pc, -.45)]), ow * .7);
      c.fillStyle = sh(pc, .7); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(px - rw * .5 + i * rw * .5, py - rh * .35 + Math.abs(i - 1) * .2, .14, 0, TAU); c.fill(); }
      if (ar >= 4) { c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = rgba('#ffd070', .5 + .2 * Math.sin(gt / 300)); c.lineWidth = .25; c.beginPath(); c.ellipse(px, py, rw, rh, -.25, Math.PI * 1.05, Math.PI * 2.02); c.stroke(); c.restore(); } }
    if (L.bracers && !L.robe) { const b0 = [aF.e[0] + (aF.h[0] - aF.e[0]) * .3, aF.e[1] + (aF.h[1] - aF.e[1]) * .3], b1 = [aF.e[0] + (aF.h[0] - aF.e[0]) * .86, aF.e[1] + (aF.h[1] - aF.e[1]) * .86]; g.limbS([b0, [(b0[0] + b1[0]) / 2, (b0[1] + b1[1]) / 2], b1], [B.lw * .84, B.lw * .8, B.lw * .66], L.bracers, .3, .25); c.strokeStyle = rgba(sh(L.bracers, -.55), .55); c.lineWidth = .12; c.beginPath(); for (const t of [.35, .65]) { const q = [b0[0] + (b1[0] - b0[0]) * t, b0[1] + (b1[1] - b0[1]) * t], d0 = Math.atan2(b1[1] - b0[1], b1[0] - b0[0]) + Math.PI / 2; c.moveTo(q[0] + Math.cos(d0) * B.lw * .38, q[1] + Math.sin(d0) * B.lw * .38); c.lineTo(q[0] - Math.cos(d0) * B.lw * .38, q[1] - Math.sin(d0) * B.lw * .38); } c.stroke(); }
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
      const len = (kind === 'dagger' ? 6 : 10.5) * s, wid = (kind === 'dagger' ? .9 : 1.1) * s, bt = len - 1.6 * s;
      const a = at(1, -wid / 2), b = at(bt, -wid / 2), tip = at(len), c2 = at(bt, wid / 2), e = at(1, wid / 2);
      g.fill(() => { c.moveTo(...a); c.lineTo(...b); c.lineTo(...tip); c.lineTo(...c2); c.lineTo(...e); c.closePath(); }, metal(...a, ...e), ow * .8);
      // Schliff: untere Hälfte dunkler, Hohlkehle, Schneidenlicht
      g.fill(() => { c.moveTo(...at(1, 0)); c.lineTo(...at(bt, 0)); c.lineTo(...tip); c.lineTo(...c2); c.lineTo(...e); c.closePath(); }, rgba(sh(wc, -.5), .32), 0);
      if (kind === 'sword') { c.strokeStyle = rgba(sh(wc, -.55), .6); c.lineWidth = .3 * s; c.beginPath(); c.moveTo(...at(1.4, 0)); c.lineTo(...at(len * .66, 0)); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = .1 * s; c.beginPath(); c.moveTo(...at(1.4, -.18 * s)); c.lineTo(...at(len * .66, -.18 * s)); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = .2; c.beginPath(); c.moveTo(...at(1.4, -wid / 2 + .12)); c.lineTo(...at(bt, -wid / 2 + .12)); c.lineTo(...at(len - .35, 0)); c.stroke();
      // Parierstange mit geschwungenen Enden und Stein
      const gw2 = (kind === 'dagger' ? 1.6 : 2.3) * s, gold = g.lin(...at(0, -gw2), ...at(0, gw2), ['#fff0a8', '#d8b04a', '#8a6420']);
      g.fill(() => { c.moveTo(...at(1.05, -gw2)); c.quadraticCurveTo(...at(.2, -gw2 * .45), ...at(.35, 0)); c.quadraticCurveTo(...at(.2, gw2 * .45), ...at(1.05, gw2)); c.lineTo(...at(.1, gw2 * .92)); c.quadraticCurveTo(...at(-.45, gw2 * .35), ...at(-.4, 0)); c.quadraticCurveTo(...at(-.45, -gw2 * .35), ...at(.1, -gw2 * .92)); c.closePath(); }, gold, ow * .7);
      g.ell(...at(.15), .42 * s, .42 * s, g.rad(...at(.05, -.15 * s), .5 * s, ['#ffffff', L.glowC || '#d8403a', sh(L.glowC || '#d8403a', -.4)]), .15);
      // Griff mit Lederwicklung, Knauf
      const gl = (kind === 'dagger' ? 1.3 : 1.9) * s; g.limb([at(-.35), at(-gl)], .82 * s, g.lin(...at(0, -.4 * s), ...at(0, .4 * s), ['#7a5434', '#4a2e1a', '#2e1a0e']), ow * .8);
      c.strokeStyle = 'rgba(20,10,4,.65)'; c.lineWidth = .13 * s; c.beginPath(); for (let i = 0; i < 4; i++) { const t = -.55 - i * (gl - .6) / 4; c.moveTo(...at(t, -.4 * s)); c.lineTo(...at(t - .28 * s, .4 * s)); } c.stroke();
      g.ell(...at(-gl - .45 * s), .78 * s, .7 * s, g.rad(...at(-gl - .6 * s, -.25 * s), .9 * s, ['#fff4c0', '#d8b04a', '#7a5a1a']), .25);
      if (L.glowC && kind === 'sword' && p.glow > .8) g.glow(...at(len * .6), 4 * s, L.glowC, .5);
    } else if (kind === 'axe' || kind === 'hammer' || kind === 'mace' || kind === 'club') {
      const len = (kind === 'club' ? 12 : 9.5) * s;
      if (kind === 'club') { g.limb([at(-1.5), at(len)], 1.5 * s, wc, ow); g.limb([at(len * .55), at(len + .5)], 3 * s, sh(wc, -.1), ow); for (let i = 0; i < 3; i++) g.ell(...at(len * .6 + i * 1.6 * s, (i % 2 ? 1.2 : -1.2) * s), .5 * s, .5 * s, sh(wc, -.35), 0); return; }
      g.limb([at(-2.2), at(len)], 1 * s, g.lin(...at(0, -.5 * s), ...at(0, .5 * s), ['#8a6440', '#6a4a2a', '#3e2816']), ow);
      c.strokeStyle = 'rgba(30,16,6,.6)'; c.lineWidth = .12 * s; c.beginPath(); for (let i = 0; i < 4; i++) { const t = -1.8 + i * .55 * s; c.moveTo(...at(t, -.5 * s)); c.lineTo(...at(t + .3 * s, .5 * s)); } c.moveTo(...at(len * .3, -.15 * s)); c.lineTo(...at(len * .55, -.1 * s)); c.stroke();
      if (kind === 'axe') g.fill(() => { c.moveTo(...at(len - 3.4 * s, .3)); c.quadraticCurveTo(...at(len - 4 * s, -4.4 * s), ...at(len - 1.6 * s, -4.6 * s)); c.quadraticCurveTo(...at(len + 1.2 * s, -2.4 * s), ...at(len + .2, .3)); c.closePath(); }, metal(...at(len - 3 * s), ...at(len, -4 * s)), ow);
      if (kind === 'axe') { c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = .28 * s; c.beginPath(); c.moveTo(...at(len - 1.5 * s, -4.2 * s)); c.quadraticCurveTo(...at(len + .7 * s, -2.4 * s), ...at(len - .1, -.2 * s)); c.stroke(); c.strokeStyle = rgba(sh(wc, -.6), .5); c.lineWidth = .14 * s; c.beginPath(); c.moveTo(...at(len - 2.8 * s, -.6 * s)); c.quadraticCurveTo(...at(len - 2.4 * s, -2.6 * s), ...at(len - 1.6 * s, -3.4 * s)); c.stroke();
        g.fill(() => { c.moveTo(...at(len - 2.6 * s, .4)); c.lineTo(...at(len - 1.7 * s, 2.4 * s)); c.lineTo(...at(len - .7 * s, .4)); c.closePath(); }, metal(...at(len - 2 * s, 0), ...at(len - 1.5 * s, 2 * s)), ow * .8);
        for (const t of [len - 3.3 * s, len - .5 * s]) { g.limb([at(t), at(t + .55 * s)], 1.3 * s, g.lin(...at(0, -.7 * s), ...at(0, .7 * s), [sh(wc, .3), sh(wc, -.2), sh(wc, -.5)]), ow * .6); g.ell(...at(t + .27 * s, -.2 * s), .16 * s, .16 * s, '#ffffff', 0); } }
      if (kind === 'hammer') g.fill(() => { c.moveTo(...at(len - 2.2 * s, -2.4 * s)); c.lineTo(...at(len + .8 * s, -2.4 * s)); c.lineTo(...at(len + .8 * s, 2.4 * s)); c.lineTo(...at(len - 2.2 * s, 2.4 * s)); c.closePath(); }, metal(...at(len - 2 * s, -2), ...at(len, 2)), ow);
      if (kind === 'hammer') { for (const sd of [-1, 1]) g.limb([at(len - 2.5 * s, sd * 2.5 * s), at(len + 1.1 * s, sd * 2.5 * s)], .55 * s, sh(wc, -.35), ow * .6); c.strokeStyle = rgba(sh(wc, -.6), .55); c.lineWidth = .14 * s; c.beginPath(); c.moveTo(...at(len - 1.4 * s, -1.4 * s)); c.lineTo(...at(len - .2 * s, 0)); c.lineTo(...at(len - 1.4 * s, 1.4 * s)); c.moveTo(...at(len - .7 * s, -1.6 * s)); c.lineTo(...at(len - .7 * s, 1.6 * s)); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = .16 * s; c.beginPath(); c.moveTo(...at(len - 2, -2.1 * s)); c.lineTo(...at(len + .6 * s, -2.1 * s)); c.stroke(); }
      if (kind === 'mace') { g.ell(...at(len), 1.9 * s, 1.9 * s, g.rad(...at(len), 2 * s, [sh(wc, .4), wc, sh(wc, -.3)]), ow); for (let i = 0; i < 6; i++) { const an = i / 6 * TAU; const q = at(len + Math.cos(an) * 2.6 * s, Math.sin(an) * 2.6 * s); g.ell(q[0], q[1], .5 * s, .5 * s, sh(wc, -.2), .2); } }
    } else if (kind === 'staff') {
      const len = 14 * s; g.limb([at(-5 * s), at(len)], 1 * s, g.lin(...at(-5 * s), ...at(len), [sh(wc, -.3), wc, sh(wc, .2)]), ow);
      c.strokeStyle = rgba(sh(wc, -.5), .5); c.lineWidth = .12 * s; c.beginPath(); for (const [t0, t1, o] of [[-4, 1, -.2], [3, 8, .2], [9, 13, -.15]]) { c.moveTo(...at(t0 * s, o * s)); c.lineTo(...at(t1 * s, o * s)); } c.stroke(); for (const t of [2, 8.5]) g.ell(...at(t * s, .15 * s), .35 * s, .25 * s, sh(wc, -.4), 0);
      if (L.staffTop === 'hook') { c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 1.8 * s; c.beginPath(); c.moveTo(...at(len - .5)); c.bezierCurveTo(...at(len + 2.4 * s, 0), ...at(len + 3 * s, 2.6 * s), ...at(len + 1.4 * s, 2.4 * s)); c.stroke(); c.strokeStyle = wc; c.lineWidth = 1 * s; c.stroke(); }
      const tip = at(len + 1 * s); const gc = L.glowC || '#fff6c0';
      g.ell(tip[0], tip[1], 1.3 * s, 1.3 * s, g.rad(tip[0], tip[1], 1.3 * s, ['#ffffff', gc]), .3);
      g.glow(tip[0], tip[1], (3 + (p.glow || 0) * 6) * s, gc, Math.min(1, .3 + (p.glow || 0) * .6));
    } else if (kind === 'spear') {
      const len = 15 * s; g.limb([at(-4 * s), at(len)], .9 * s, '#7a5a3a', ow);
      g.fill(() => { c.moveTo(...at(len - .2)); c.quadraticCurveTo(...at(len + 1.2 * s, -1.7 * s), ...at(len + 4.6 * s)); c.quadraticCurveTo(...at(len + 1.2 * s, 1.7 * s), ...at(len - .2)); c.closePath(); }, metal(...at(len, -1.2 * s), ...at(len, 1.2 * s)), ow);
      c.strokeStyle = rgba(sh(wc, -.55), .6); c.lineWidth = .16 * s; c.beginPath(); c.moveTo(...at(len + .3)); c.lineTo(...at(len + 4.1 * s)); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = .14 * s; c.beginPath(); c.moveTo(...at(len + .8 * s, -.75 * s)); c.quadraticCurveTo(...at(len + 2.4 * s, -.8 * s), ...at(len + 4.2 * s, -.1 * s)); c.stroke();
      g.limb([at(len - 1.3 * s), at(len + .2)], 1.15 * s, g.lin(...at(0, -.6 * s), ...at(0, .6 * s), [sh(wc, .2), sh(wc, -.3)]), ow * .7);
      c.strokeStyle = 'rgba(30,16,6,.55)'; c.lineWidth = .12 * s; c.beginPath(); for (let i = 0; i < 4; i++) { const t = -1.4 + i * .5 * s; c.moveTo(...at(t, -.45 * s)); c.lineTo(...at(t + .3 * s, .45 * s)); } c.stroke();
    } else if (kind === 'bow') {
      const len = 9 * s, tip1 = at(-len), tip2 = at(len), mid = at(0, 3.2 * s);
      c.lineCap = 'round'; c.strokeStyle = OL; c.lineWidth = 1.6 * s; c.beginPath(); c.moveTo(...tip1); c.quadraticCurveTo(...at(-len * .3, 5 * s), ...at(0, 2)); c.quadraticCurveTo(...at(len * .3, 5 * s), ...tip2); c.stroke();
      c.strokeStyle = g.lin(...tip1, ...tip2, [sh(wc, -.2), sh(wc, .25), sh(wc, -.2)]); c.lineWidth = .8 * s; c.stroke();
      g.limb([at(-1.2 * s, 2.6 * s), at(1.2 * s, 2.6 * s)], .95 * s, '#5a3a22', ow * .6); c.strokeStyle = 'rgba(20,10,4,.6)'; c.lineWidth = .1 * s; c.beginPath(); for (let i = 0; i < 4; i++) { const t = -1 + i * .65 * s; c.moveTo(...at(t, 2.15 * s)); c.lineTo(...at(t + .25 * s, 3.05 * s)); } c.stroke();
      for (const q of [tip1, tip2]) g.ell(q[0], q[1], .38 * s, .38 * s, '#e8dcc0', .2);
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
    const legDraw = (pts, ws, col) => { g.limbS(pts, ws, col, .4, .1); const Z = pts[pts.length - 1];
      g.fill(() => { c.moveTo(Z[0] - 1, Z[1] - .5); c.quadraticCurveTo(Z[0] - 1.2, Z[1] + .6, Z[0] - .3, Z[1] + .65); c.lineTo(Z[0] + 1.5, Z[1] + .65); c.quadraticCurveTo(Z[0] + 2, Z[1] + .15, Z[0] + 1.2, Z[1] - .45); c.closePath(); }, g.lin(0, Z[1] - .5, 0, Z[1] + .65, [sh(col, .12), sh(col, -.28)]), .3);
      c.strokeStyle = rgba(sh(col, -.6), .6); c.lineWidth = .12; c.beginPath(); for (const t of [.35, .7]) { c.moveTo(Z[0] - 1 + t * 2.5, Z[1] + .65); c.lineTo(Z[0] - .9 + t * 2.4, Z[1] + .15); } c.stroke();
      const B2 = pts[1]; c.strokeStyle = rgba(sh(col, -.35), .5); c.lineWidth = .18; c.beginPath(); for (let t = 0; t < 3; t++) { const bx2 = B2[0] - ws[1] * .45, by2 = B2[1] - 1 + t * .9; c.moveTo(bx2, by2); c.quadraticCurveTo(bx2 - .6, by2 + .3, bx2 - .9, by2 + .9); } c.stroke(); };
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
    c.lineCap = 'round'; c.strokeStyle = rgba(sh(fur, .4), .38); c.lineWidth = .2; c.beginPath(); for (let i = 0; i < 16; i++) { const x = bx - 7.2 + i * .95, y = -11.9 + by + Math.sin(i * 1.7) * .35; c.moveTo(x, y); c.quadraticCurveTo(x - .5, y + .6, x - .95, y + 1.6); } c.stroke();
    c.strokeStyle = rgba(dark, .42); c.beginPath(); for (let i = 0; i < 12; i++) { const x = bx - 6.6 + i * 1.15, y = -9.6 + by + Math.sin(i * 2.3) * .5; c.moveTo(x, y); c.quadraticCurveTo(x - .4, y + .5, x - .7, y + 1.2); } c.stroke();
    c.strokeStyle = rgba(belly, .55); c.beginPath(); for (let i = 0; i < 8; i++) { const x = bx - 3.6 + i * 1.1, y = -7.4 + by; c.moveTo(x, y - .3); c.lineTo(x - .5, y + .6); } c.stroke(); c.restore();
    // nahe Beine
    hind(-4.2, .5, fur); front(6.2, 0, fur);
    // Hals, Halskrause, Kopf
    const hx = bx + 10.2 + lean * .15, hy = -12.8 + by - headUp * 1.4;
    { const neck = cl => { c.beginPath(); c.moveTo(bx + 3.6, -12.9 + by); c.quadraticCurveTo(bx + 7, -14.4 + by, hx - .6, hy - 1.6); c.lineTo(hx + .4, hy + 1.6); c.quadraticCurveTo(bx + 8.2, -8.4 + by, bx + 6.4, -7 + by); if (cl) c.closePath(); };
      neck(true); c.fillStyle = g.lin(bx + 5, -14 + by, bx + 8, -8 + by, [sh(fur, .1), fur, belly]); c.fill(); neck(false); c.strokeStyle = OL; c.lineWidth = .4; c.stroke();
      c.strokeStyle = rgba(belly, .6); c.lineWidth = .2; c.beginPath(); for (let i = 0; i < 5; i++) { const t = i / 4, x = bx + 6.4 + t * (hx - bx - 6), y = -8 + by + t * (hy - (-8 + by)) + .6; c.moveTo(x, y); c.quadraticCurveTo(x - .5, y + .5, x - .4, y + 1.2); } c.stroke(); }
    // zottige, nach hinten fließende Mähne aus geschwungenen Fellbüscheln
    { const n = L.mane || L.size ? 13 : 7, ln0 = L.mane || L.size ? 2.2 : 1.1; for (let i = n - 1; i >= 0; i--) { const t = i / (n - 1), x = bx + 1.6 + t * 7.4, y = -12.5 + by - t * 1.9 - headUp * t, l = ln0 + Math.sin(i * 2.1) * .55 + (L.size ? .5 : 0), sw = gait ? Math.sin(ph + i) * .35 : Math.sin(gt / 520 + i) * .22;
      g.fill(() => { c.moveTo(x - .9, y + .7); c.quadraticCurveTo(x - .1, y - l * .55, x - l * .85 + sw, y - l * .75); c.quadraticCurveTo(x + .1, y - l * .2, x + .9, y + .5); c.closePath(); }, g.lin(x, y - l, x, y + .7, [sh(fur, i % 2 ? -.5 : -.38), sh(fur, -.15)]), .16); } }
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
      const lc = far ? sh(legC, -.35) : legC, w = (L.size ? 1.35 : .8), m1 = [(base[0] + knee[0]) / 2 - d * .2 * k, (base[1] + knee[1]) / 2 - .4 * k], m2 = [(knee[0] + ank[0]) / 2, (knee[1] + ank[1]) / 2];
      // gegliedertes Bein: Schenkel, Schiene, Fußglied mit Klaue; Gelenkringe und Borsten
      g.limbS([base, m1, knee], [w * 1.55, w * 1.4, w * 1.1], lc, .3, far ? 0 : .12); g.limbS([knee, m2, ank], [w * 1.05, w * .98, w * .78], lc, .3, far ? 0 : .1); g.limbS([ank, foot], [w * .74, w * .36], lc, .25, 0);
      for (const p of [knee, ank]) { c.fillStyle = rgba(sh(lc, .4), far ? .2 : .45); c.beginPath(); c.ellipse(p[0], p[1], w * .66, w * .5, 0, 0, TAU); c.fill(); }
      if (!far) { c.strokeStyle = rgba(hair, .5); c.lineWidth = .11 * k; c.beginPath(); for (const [A, Bp, ww] of [[base, knee, w * .7], [knee, ank, w * .5]]) { const dx = Bp[0] - A[0], dy = Bp[1] - A[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; for (let j = 1; j < 8; j++) { const t = j / 8, x = A[0] + dx * t, y = A[1] + dy * t; for (const sg of [1, -1]) { c.moveTo(x + nx * ww * sg, y + ny * ww * sg); c.lineTo(x + nx * (ww + .7 * k) * sg + dx / l * .5 * k, y + ny * (ww + .7 * k) * sg + dy / l * .5 * k); } } } c.stroke(); } };
    for (let i = 0; i < 4; i++) leg(i, 1);
    // Hinterleib mit Haaren und Zeichnung
    const ax = cx - 5.4 * k, ay = cy - 1.6 * k, arx = 6.8 * k, ary = 5.6 * k;
    // Hinterleib: birnenförmig, pelzig, mit Zeichnung und Spinnwarzen
    c.save(); c.translate(ax, ay); c.rotate(-.18);
    const abd = () => { c.moveTo(arx * .95, -ary * .12); c.bezierCurveTo(arx * .78, -ary * 1.06, -arx * .62, -ary * 1.12, -arx * .99, -ary * .16); c.bezierCurveTo(-arx * 1.04, ary * .72, -arx * .2, ary * 1.06, arx * .5, ary * .76); c.quadraticCurveTo(arx * 1.03, ary * .46, arx * .95, -ary * .12); c.closePath(); };
    c.strokeStyle = rgba(sh(col, .25), .55); c.lineWidth = .13 * k; c.beginPath(); for (let i = 0; i < 90; i++) { const a = i / 90 * TAU + Math.sin(i * 7.3) * .03, rx = arx * (a > Math.PI * .1 && a < Math.PI * .9 ? .9 : .97), ry2 = ary * (a > Math.PI ? .98 : .86), x = Math.cos(a) * rx, y = Math.sin(a) * ry2 - ary * .1, ln = .05 + ((i * 7) % 5) / 5 * .09; c.moveTo(x, y); c.quadraticCurveTo(x * (1 + ln * .6), y * (1 + ln * .6) - .2 * k, x * (1 + ln) - .5 * k, y * (1 + ln) - .1 * k); } c.stroke();
    g.fill(abd, g.rad(-arx * .2, -ary * .55, arx * 1.45, [sh(col, .3), col, sh(col, -.45)]), L.size ? .8 : .45);
    c.save(); c.beginPath(); abd(); c.clip(); c.lineCap = 'round';
    c.strokeStyle = rgba(hair, .3); c.lineWidth = .14 * k; c.beginPath(); for (let i = 0; i < 70; i++) { const a = (i * 2.39) % TAU, rr = Math.sqrt((i * .618) % 1), x = Math.cos(a) * rr * arx * .9, y = Math.sin(a) * rr * ary * .9 - ary * .1; c.moveTo(x, y); c.lineTo(x - .55 * k, y + .25 * k); } c.stroke();
    c.fillStyle = L.mark; c.globalAlpha = .85; c.beginPath(); c.moveTo(-arx * .62, -ary * .2); c.quadraticCurveTo(-arx * .05, -ary * .62, arx * .5, -ary * .28); c.quadraticCurveTo(0, -ary * .32, -arx * .62, -ary * .2); c.fill();
    for (let i = 0; i < 4; i++) { const x = -arx * .5 + i * arx * .27, y = ary * (.05 + i * .02); c.beginPath(); c.moveTo(x - .9 * k, y); c.lineTo(x, y + ary * .26); c.lineTo(x + .9 * k, y); c.lineTo(x, y + ary * .13); c.closePath(); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.ellipse(-arx * .2, -ary * .55, arx * .5, ary * .2, -.2, 0, TAU); c.fill();
    c.fillStyle = g.lin(0, ary * .3, 0, ary, [rgba('#000000', 0), rgba('#000000', .3)]); c.fillRect(-arx * 1.1, ary * .3, arx * 2.2, ary); c.restore();
    for (const sp of [0, 1]) g.fill(() => { const sx = -arx * .96, sy = ary * (.18 + sp * .16); c.moveTo(sx + .3 * k, sy - .4 * k); c.lineTo(sx - 1 * k, sy + .1 * k); c.lineTo(sx + .3 * k, sy + .5 * k); c.closePath(); }, sh(col, -.25), .2);
    c.restore();
    // Kopfbrust mit Panzerfurchen und Borsten
    const cth = () => { c.ellipse(cx + 2 * k, cy - .3 * k, 3.9 * k, 3.1 * k, 0, 0, TAU); };
    g.fill(cth, g.rad(cx + 1.4 * k, cy - 1.8 * k, 4.6 * k, [sh(col, .35), col, sh(col, -.4)]), L.size ? .8 : .45);
    c.save(); c.beginPath(); cth(); c.clip(); c.strokeStyle = rgba(sh(col, -.55), .55); c.lineWidth = .16 * k; c.beginPath(); for (let i = 0; i < 5; i++) { const a = -2.6 + i * .5; c.moveTo(cx + 1.6 * k, cy - .9 * k); c.lineTo(cx + 1.6 * k + Math.cos(a) * 3.6 * k, cy - .9 * k + Math.sin(a) * 2.8 * k); } c.stroke(); c.fillStyle = rgba(sh(col, -.6), .6); c.beginPath(); c.ellipse(cx + 1.6 * k, cy - .9 * k, .5 * k, .3 * k, 0, 0, TAU); c.fill(); c.restore();
    c.strokeStyle = rgba(hair, .35); c.lineWidth = .12 * k; c.beginPath(); for (let i = 0; i < 14; i++) { const a = -2.9 + i * .2, x = cx + 2 * k + Math.cos(a) * 3.9 * k, y = cy - .3 * k + Math.sin(a) * 3.1 * k; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * .6 * k - .2 * k, y + Math.sin(a) * .6 * k); } c.stroke();
    // Taster vor den Klauen
    for (const s2 of [0, 1]) { const px = cx + (4.6 + s2 * .6) * k, py = cy + .2 * k, tip = [px + (1.6 + raise) * k, py + (1.6 - raise * 1.2) * k]; g.limbS([[px, py], [px + 1 * k, py + .3 * k], tip], [.7 * k, .6 * k, .45 * k], s2 ? legC : sh(legC, -.3), .25, 0); }
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
    const g = P(c), sk = L.skin, bl = L.belly, wingC = L.wing || sh(sk, -.3), horn = L.horn || '#e8dcc0', dk = sh(sk, -.42), lt = sh(sk, .28);
    let lean = 0, jaw = .1, rear = 0, fall = 0, gaitPh = 0, gait = 0; const flap = Math.sin(gt / 320), br = Math.sin(gt / 900) * .5;
    if (anim === 'attack' || anim === 'throw') { const q = clamp01(el / animTime('attack')); lean = Math.sin(q * Math.PI) * 9 - (q < .25 ? q * 8 : 0); jaw = Math.sin(q * Math.PI); }
    if (anim === 'cast' || anim === 'shoot' || anim === 'shout') { const q = clamp01(el / animTime(anim)); rear = -Math.sin(q * Math.PI) * 7; jaw = clamp01(Math.sin(q * Math.PI) * 1.5); }
    if (anim === 'walk') { gait = 1; gaitPh = el / 620 * TAU; }
    if (anim === 'hurt') lean = -3 * (1 - clamp01(el / 300));
    if (anim === 'dead') fall = ease(clamp01(el / 800));
    if (fall) { c.save(); c.translate(0, -6); c.rotate(fall * .35); c.translate(0, 6 + fall * 6); }
    const lx = lean, ry = rear * .3 + br * .4;
    const bez = (P0, P1, P2, P3, n) => { const out = []; for (let k = 0; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]); } return out; };
    // Rückenstacheln entlang einer Linie (nach hinten gebogen)
    const spines = (pts, sz0, sz1) => { for (let k = 1; k < pts.length - 1; k++) { const a = pts[k - 1], b = pts[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], Ln = Math.hypot(dx, dy) || 1, nx = dy / Ln, ny = -dx / Ln, t = k / (pts.length - 1), h = sz0 + (sz1 - sz0) * t, p0 = pts[k];
      g.fill(() => { c.moveTo(p0[0] - dx / Ln * h * .45, p0[1] - dy / Ln * h * .45); c.quadraticCurveTo(p0[0] + nx * h * .7, p0[1] + ny * h * .7, p0[0] + nx * h - dx / Ln * h * .55, p0[1] + ny * h - dy / Ln * h * .55); c.lineTo(p0[0] + dx / Ln * h * .45, p0[1] + dy / Ln * h * .45); c.closePath(); }, g.lin(p0[0], p0[1], p0[0] + nx * h, p0[1] + ny * h, [sh(horn, -.35), horn]), .3); } };
    // Flügel: Armknochen, vier gespreizte Finger, gewellte Flughaut mit Adern, Daumenkralle
    const wing = near => { const k = near ? 1 : .84, S = [6 * k + lx - (near ? 0 : 3), -30 + ry - (near ? 0 : 1)], f = flap * (near ? 1 : .8), a1 = -2.55 + f * .32, a2 = -1.05 + f * .5;
      const E = [S[0] + Math.cos(a1) * 15 * k, S[1] + Math.sin(a1) * 15 * k], Wr = [E[0] + Math.cos(a2) * 14 * k, E[1] + Math.sin(a2) * 14 * k];
      // Finger fächern nach hinten: vom langen oberen Finger bis zum unteren, der zur Flanke zeigt
      const fa = [-2.7, 3.12, 2.78, 2.42].map((a, n) => a - f * (.18 + n * .06)), fl = [34, 37, 32, 25].map(v => v * k), tips = fa.map((a, n) => [Wr[0] + Math.cos(a) * fl[n], Wr[1] + Math.sin(a) * fl[n]]), attach = [-17 * k + lx, -25 + ry];
      const col = near ? wingC : sh(wingC, -.3);
      const mem = () => { c.moveTo(S[0], S[1]); c.lineTo(E[0], E[1]); c.lineTo(Wr[0], Wr[1]); c.lineTo(tips[0][0], tips[0][1]); for (let n = 1; n < 4; n++) { const m = [(tips[n - 1][0] + tips[n][0]) / 2, (tips[n - 1][1] + tips[n][1]) / 2]; c.quadraticCurveTo(m[0] + (Wr[0] - m[0]) * .28, m[1] + (Wr[1] - m[1]) * .28, tips[n][0], tips[n][1]); } const m2 = [(tips[3][0] + attach[0]) / 2, (tips[3][1] + attach[1]) / 2]; c.quadraticCurveTo(m2[0] + (Wr[0] - m2[0]) * .35, m2[1] + (Wr[1] - m2[1]) * .35, attach[0], attach[1]); c.closePath(); };
      g.fill(mem, g.lin(Wr[0], Wr[1] - 20, attach[0], attach[1] + 6, [rgba(sh(col, .3), .95), rgba(col, .93), rgba(sh(col, -.35), .96)]), .55);
      c.save(); c.beginPath(); mem(); c.clip(); c.strokeStyle = rgba(sh(col, -.5), .45); c.lineWidth = .3; c.beginPath(); for (let n = 0; n < 4; n++) { const m = n < 3 ? [(tips[n][0] + tips[n + 1][0]) / 2, (tips[n][1] + tips[n + 1][1]) / 2] : [(tips[3][0] + attach[0]) / 2, (tips[3][1] + attach[1]) / 2]; c.moveTo(Wr[0], Wr[1]); c.quadraticCurveTo((Wr[0] + m[0]) / 2 + 2, (Wr[1] + m[1]) / 2 + 2, m[0] + (Wr[0] - m[0]) * .25, m[1] + (Wr[1] - m[1]) * .25); } c.stroke();
        c.fillStyle = g.rad(Wr[0] - 6, Wr[1] - 4, 22 * k, [rgba(sh(col, .5), .22), rgba(col, 0)]); c.fillRect(Wr[0] - 40, Wr[1] - 40, 80, 80); c.restore();
      g.limbS([S, [(S[0] + E[0]) / 2, (S[1] + E[1]) / 2], E, [(E[0] + Wr[0]) / 2, (E[1] + Wr[1]) / 2], Wr], [3.4 * k, 2.6 * k, 2 * k, 1.7 * k, 1.5 * k], near ? sh(sk, -.05) : dk, .45, near ? .15 : 0);
      c.lineCap = 'round'; for (const t of tips) { c.strokeStyle = OL; c.lineWidth = 1.2 * k; c.beginPath(); c.moveTo(Wr[0], Wr[1]); c.lineTo(t[0], t[1]); c.stroke(); c.strokeStyle = near ? sh(sk, -.12) : dk; c.lineWidth = .7 * k; c.stroke(); }
      g.fill(() => { c.moveTo(Wr[0] - .6, Wr[1]); c.quadraticCurveTo(Wr[0] + 1.8, Wr[1] - 1.4, Wr[0] + 2.2, Wr[1] - 3.4); c.quadraticCurveTo(Wr[0] + .9, Wr[1] - 1.6, Wr[0] + .2, Wr[1] + .5); c.closePath(); }, horn, .25); };
    // Beine mit Krallen
    const claws = (x, y, col) => { for (let n = 0; n < 3; n++) g.fill(() => { const cx0 = x + n * 1.5; c.moveTo(cx0, y - .6); c.quadraticCurveTo(cx0 + 1.6, y - .5, cx0 + 2, y + .6); c.quadraticCurveTo(cx0 + 1, y + .1, cx0 - .2, y + .2); c.closePath(); }, g.lin(x, y - .6, x, y + .6, [horn, sh(horn, -.35)]), .2); };
    const legF = (x, far) => { const sw = gait ? Math.sin(gaitPh + (far ? Math.PI : 0)) * 3 : 0, lift = gait ? Math.max(0, Math.sin(gaitPh + (far ? Math.PI : 0))) * 1.4 : 0, col = far ? dk : sh(sk, -.04), Sh = [x + lx, -17 + ry], El = [x + lx + 3 + sw * .3, -9.5 - lift * .5], Wr = [x + lx + 1 + sw, -2.6 - lift], Ft = [x + lx + 3.6 + sw, -.4 - lift];
      g.limbS([Sh, [(Sh[0] + El[0]) / 2 + 1, (Sh[1] + El[1]) / 2], El, [(El[0] + Wr[0]) / 2, (El[1] + Wr[1]) / 2], Wr, Ft], [7, 6, 3.8, 3.2, 2.6, 2.2], col, .55, far ? 0 : .14); claws(Ft[0] - 1, Ft[1] + .1, col); };
    const legH = (x, far) => { const sw = gait ? Math.sin(gaitPh + (far ? 0 : Math.PI)) * 3 : 0, lift = gait ? Math.max(0, Math.sin(gaitPh + (far ? 0 : Math.PI))) * 1.4 : 0, col = far ? dk : sh(sk, -.04), Hp = [x + lx, -19 + ry], Kn = [x + lx + 6 + sw * .4, -11 - lift * .4], Hk = [x + lx + .5 + sw, -5 - lift], Ft = [x + lx + 3.5 + sw, -.4 - lift];
      g.limbS([Hp, [(Hp[0] + Kn[0]) / 2, (Hp[1] + Kn[1]) / 2 + 1], Kn, [(Kn[0] + Hk[0]) / 2, (Kn[1] + Hk[1]) / 2], Hk, Ft], [11, 9, 4.6, 3.6, 2.8, 2.2], col, .55, far ? 0 : .14); claws(Ft[0] - 1, Ft[1] + .1, col); };
    // Schwanz mit Stacheln und Spatenspitze
    const tw = Math.sin(gt / 500) * 4, tp = bez([-19 + lx * .3, -19 + ry], [-38, -11 + tw * .5], [-56, -6 + tw * 1.2], [-66, -20 + tw * 1.3], 16);
    spines(tp.slice().reverse(), 1.4, 3.2);
    g.limbS(tp, tp.map((_, n) => Math.max(.8, 9.6 - n * .55)), sk, .55, .12);
    { c.save(); c.strokeStyle = rgba(bl, .8); c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath(); tp.forEach((p0, n) => { const y = p0[1] + Math.max(.4, 9.6 - n * .55) * .32; n ? c.lineTo(p0[0], y) : c.moveTo(p0[0], y); }); c.stroke(); c.restore(); }
    { const T0 = tp[tp.length - 1], T1 = tp[tp.length - 3], a = Math.atan2(T0[1] - T1[1], T0[0] - T1[0]); c.save(); c.translate(T0[0], T0[1]); c.rotate(a); g.fill(() => { c.moveTo(-.5, 0); c.quadraticCurveTo(1.5, -3.6, 4.6, 0); c.quadraticCurveTo(1.5, 3.6, -.5, 0); c.closePath(); }, g.lin(0, -3, 0, 3, [sh(horn, -.2), sh(sk, -.3)]), .35); c.restore(); }
    wing(false); legH(-17, 1); legF(9, 1);
    // Rumpf mit Brust, Bauch, Hüfte
    const body = () => { c.moveTo(15 + lx, -30 + ry); c.bezierCurveTo(5 + lx, -34 + ry, -10 + lx, -33 + ry, -20 + lx, -27.5 + ry); c.bezierCurveTo(-27 + lx, -24 + ry, -27 + lx, -16 + ry, -21 + lx, -12 + ry); c.bezierCurveTo(-12 + lx, -8 + ry, 4 + lx, -8.5 + ry, 13 + lx, -12 + ry); c.bezierCurveTo(19.5 + lx, -15 + ry, 21 + lx, -24 + ry, 15 + lx, -30 + ry); c.closePath(); };
    g.fill(body, g.lin(0, -34 + ry, 0, -8 + ry, [lt, sk, sh(sk, -.25)]), .7);
    c.save(); c.beginPath(); body(); c.clip();
    c.fillStyle = g.rad(10 + lx, -24 + ry, 12, [rgba(lt, .45), rgba(lt, 0)]); c.fillRect(-30 + lx, -36 + ry, 60, 30); c.fillStyle = g.rad(-16 + lx, -20 + ry, 11, [rgba(lt, .35), rgba(lt, 0)]); c.fillRect(-30 + lx, -36 + ry, 60, 30);
    c.fillStyle = g.lin(0, -18 + ry, 0, -8 + ry, [rgba(sh(sk, -.5), 0), rgba(sh(sk, -.5), .45)]); c.fillRect(-30 + lx, -18 + ry, 60, 12);
    c.lineWidth = .32; for (let r2 = 0; r2 < 7; r2++) for (let n = 0; n < 15; n++) { const x = -27 + lx + n * 3.4 + (r2 % 2) * 1.7, y = -32 + r2 * 2.6 + ry; c.strokeStyle = rgba(sh(sk, -.5), .4); c.beginPath(); c.arc(x + 1.5, y, 1.5, Math.PI * .1, Math.PI * .9); c.stroke(); c.strokeStyle = rgba(lt, .3); c.beginPath(); c.arc(x + 1.5, y - .3, 1.2, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    // Bauchplatten
    c.beginPath(); c.moveTo(-21 + lx, -14 + ry); c.bezierCurveTo(-12 + lx, -10.5 + ry, 4 + lx, -11 + ry, 16 + lx, -15 + ry); c.lineTo(17 + lx, -9 + ry); c.lineTo(-24 + lx, -9 + ry); c.closePath(); c.fillStyle = g.lin(0, -14 + ry, 0, -8 + ry, [sh(bl, .15), bl, sh(bl, -.25)]); c.fill();
    c.strokeStyle = rgba(sh(bl, -.5), .55); c.lineWidth = .3; for (let n = 0; n < 11; n++) { const x = -19 + lx + n * 3.5; c.beginPath(); c.moveTo(x, -13 + ry - Math.sin(n / 10 * Math.PI) * 1.4); c.quadraticCurveTo(x + .8, -10.5 + ry, x + .4, -8.5 + ry); c.stroke(); }
    c.restore();
    spines(bez([-21 + lx, -27 + ry], [-10 + lx, -33 + ry], [5 + lx, -34 + ry], [15 + lx, -30.5 + ry], 9), 3.2, 4.2);
    legH(-14, 0);
    // Hals (S-Bogen) mit Bauchschuppen und Stacheln
    const hx = 31 + lean * 1.2, hy = -43 + rear, np = bez([12 + lx, -25 + ry], [19 + lx, -30 + rear * .5], [20 + lx, -42 + rear * .8], [hx - 5, hy + 1.5], 12);
    spines(np, 3.6, 2.2);
    wing(true);
    g.limbS(np, np.map((_, n) => 11.5 - n * .55), sk, .6, .16);
    { c.save(); c.lineCap = 'round'; c.strokeStyle = rgba(bl, .6); c.lineWidth = 1.8; c.beginPath(); np.forEach((p0, n) => { const a = np[Math.min(np.length - 1, n + 1)], b = np[Math.max(0, n - 1)], dx = a[0] - b[0], dy = a[1] - b[1], Ln = Math.hypot(dx, dy) || 1, w2 = (11.5 - n * .55) * .33, x = p0[0] - dy / Ln * -w2, y = p0[1] + dx / Ln * -w2; n ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); c.strokeStyle = rgba(sh(bl, -.5), .5); c.lineWidth = .25; for (let n = 1; n < np.length - 1; n++) { const p0 = np[n], w2 = (11.5 - n * .55) * .33; c.beginPath(); c.moveTo(p0[0] + w2 * .6, p0[1] + w2 * .9); c.lineTo(p0[0] + w2 * 1.1, p0[1] + w2 * .2); c.stroke(); } c.restore(); }
    legF(11, 0);
    // Kopf: keilförmiger Schädel, Brauenwulst, Hörner, Wangenstacheln, Kiefer mit Zahnreihen
    c.save(); c.translate(hx, hy); c.rotate(-rear * .02 + lean * .01);
    for (const [hx0, hy0, len, w2, cc] of [[-3, -4.5, 14, 1.6, horn], [-1, -4, 10, 1.2, sh(horn, -.15)]]) g.fill(() => { c.moveTo(hx0, hy0 + w2); c.quadraticCurveTo(hx0 - len * .5, hy0 - 1, hx0 - len, hy0 - len * .45); c.quadraticCurveTo(hx0 - len * .45, hy0 - w2 * 1.2, hx0 + w2, hy0 - w2 * .4); c.closePath(); }, g.lin(hx0, hy0, hx0 - len, hy0 - len * .4, [sh(cc, -.25), cc, sh(cc, .3)]), .35);
    for (let n = 0; n < 3; n++) g.fill(() => { const bx = -4 + n * 2.2, by = 2.4 + n * .3; c.moveTo(bx, by); c.lineTo(bx - 3 - n * .5, by + 1.6 + n * .4); c.lineTo(bx + 1.2, by + .9); c.closePath(); }, sh(horn, -.2), .25);
    c.save(); c.rotate(jaw * .42); g.fill(() => { c.moveTo(-5, 1.2); c.quadraticCurveTo(4, 2.2, 15, 2); c.quadraticCurveTo(15.5, 3.4, 13, 4); c.quadraticCurveTo(4, 5.2, -4, 4.4); c.closePath(); }, g.lin(0, 1, 0, 5, [sh(sk, -.15), sh(bl, -.1)]), .5);
    c.fillStyle = '#f4ecd8'; for (let n = 0; n < 6; n++) { const tx = 2 + n * 2, ty = 2 + n * .02; c.beginPath(); c.moveTo(tx - .5, ty); c.lineTo(tx, ty - 1.3); c.lineTo(tx + .5, ty); c.fill(); } c.restore();
    if (jaw > .25) { c.fillStyle = '#3a0806'; c.beginPath(); c.moveTo(-2, 1.4); c.lineTo(15, 1.4); c.lineTo(Math.cos(jaw * .42) * 15 - Math.sin(jaw * .42) * 2.4, Math.sin(jaw * .42) * 15 + Math.cos(jaw * .42) * 2.4); c.closePath(); c.fill(); g.glow(8, 3 + jaw * 2, 6 + jaw * 6, '#ff7a1a', .55 * jaw); }
    const skull = () => { c.moveTo(-6, -1.5); c.bezierCurveTo(-5, -5.6, 1, -6.4, 5, -5); c.bezierCurveTo(9, -4.2, 14, -3.2, 17, -1.4); c.quadraticCurveTo(18, -.2, 16.5, 1.4); c.quadraticCurveTo(8, 2.2, -1, 2.4); c.quadraticCurveTo(-5, 2.6, -6, -1.5); c.closePath(); };
    g.fill(skull, g.lin(0, -6, 0, 2.4, [lt, sk, sh(sk, -.28)]), .6);
    c.save(); c.beginPath(); skull(); c.clip(); c.strokeStyle = rgba(sh(sk, -.5), .45); c.lineWidth = .25; for (let n = 0; n < 6; n++) { c.beginPath(); c.arc(6 + n * 1.8, -2.6 + n * .25, 1, Math.PI * .1, Math.PI * .9); c.stroke(); } c.fillStyle = rgba(sh(sk, -.55), .4); c.beginPath(); c.ellipse(3, -1, 3.2, 1.6, .1, 0, TAU); c.fill(); c.restore();
    c.fillStyle = '#f4ecd8'; for (let n = 0; n < 6; n++) { const tx = 3 + n * 2.1; c.beginPath(); c.moveTo(tx - .45, 1.7); c.lineTo(tx, 3 + (n % 2) * .3); c.lineTo(tx + .45, 1.7); c.fill(); }
    g.fill(() => { c.moveTo(-1, -3.6); c.quadraticCurveTo(3.5, -6.2, 8, -4.2); c.quadraticCurveTo(4, -4.6, -1, -2.8); c.closePath(); }, sh(sk, -.35), .25);
    g.glow(3.2, -2.6, 4.5, L.eye, .9); g.ell(3.2, -2.6, 1.5, .95, g.rad(3, -2.8, 1.5, ['#fffbe0', L.eye, sh(L.eye, -.3)]), .2); c.fillStyle = '#120600'; c.beginPath(); c.ellipse(3.3, -2.6, .3, .85, 0, 0, TAU); c.fill();
    g.ell(15.8, -1.4, .55, .35, '#1a0a08', 0); if (jaw < .25) { c.fillStyle = rgba('#a0a0a0', .25 + .15 * Math.sin(gt / 400)); c.beginPath(); c.arc(18 + (gt % 2000) / 2000 * 4, -2 - (gt % 2000) / 2000 * 3, .8 + (gt % 2000) / 2000 * 1.6, 0, TAU); c.fill(); }
    c.restore();
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
  const pick2 = (R, a) => a[Math.floor(R() * a.length) % a.length];
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
  /* Laubbaum: verzweigter Stamm, Krone aus vielen Blattballen in Schatten-, Mittel- und Lichtton */
  function tree(g, c, x, y, s, col, gold) {
    let sd = Math.abs(Math.round(x * 13.7 + y * 7.1)) + 1; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const bark = '#3e2a1a', top = y - s * 1.05;
    c.lineCap = 'round'; c.strokeStyle = bark; c.lineWidth = s * .2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x - s * .05, y - s * .5, x + s * .02, top); c.stroke();
    c.lineWidth = s * .09; c.beginPath(); c.moveTo(x, y - s * .55); c.quadraticCurveTo(x - s * .3, y - s * .75, x - s * .45, top - s * .05); c.moveTo(x + s * .01, y - s * .7); c.quadraticCurveTo(x + s * .32, y - s * .85, x + s * .42, top - s * .1); c.stroke();
    c.strokeStyle = rgba('#d8b890', .25); c.lineWidth = s * .05; c.beginPath(); c.moveTo(x + s * .06, y); c.quadraticCurveTo(x + s * .02, y - s * .5, x + s * .07, top + s * .2); c.stroke();
    const blobs = []; for (let k = 0; k < 11; k++) { const a = r() * TAU, d = Math.sqrt(r()) * s * .62; blobs.push([x + Math.cos(a) * d * 1.15, top - s * .25 + Math.sin(a) * d * .75, s * (.32 + r() * .2)]); }
    const dark = sh(col, -.42), lit = gold ? '#ffe9a0' : sh(col, .38);
    c.fillStyle = rgba('#0a0c08', .35); for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(bx, by, br + .45, 0, TAU); c.fill(); }
    for (const [bx, by, br] of blobs) { c.fillStyle = dark; c.beginPath(); c.arc(bx - br * .12, by + br * .12, br, 0, TAU); c.fill(); }
    for (const [bx, by, br] of blobs) { c.fillStyle = col; c.beginPath(); c.arc(bx + br * .06, by - br * .1, br * .86, 0, TAU); c.fill(); }
    for (const [bx, by, br] of blobs) if (by < top - s * .05 || bx > x) { c.fillStyle = rgba(lit, .42); c.beginPath(); c.ellipse(bx + br * .28, by - br * .32, br * .5, br * .36, -.4, 0, TAU); c.fill(); }
    // Blattstruktur: kleine, gedrehte Blätter in Licht- und Schattenton
    for (let k = 0; k < 34; k++) { const a = r() * TAU, d = Math.sqrt(r()) * s * .72, lx = x + Math.cos(a) * d * 1.12 + s * .04, ly = top - s * .28 + Math.sin(a) * d * .74, up = ly < top - s * .25; c.fillStyle = up ? rgba(lit, .6) : rgba(dark, .55); c.beginPath(); c.ellipse(lx, ly, s * .07, s * .035, r() * 3, 0, TAU); c.fill(); }
  }
  /* Nadelbaum: gestufte, hängende Astlagen mit Licht- und Schattenseite (optional verschneit) */
  function pine(g, c, x, y, s, col, snow) {
    const tiers = 5, dark = sh(col, -.4), lit = sh(col, .3);
    c.fillStyle = '#2e2014'; c.fillRect(x - s * .05, y - s * .2, s * .1, s * .22);
    for (let i = 0; i < tiers; i++) { const t = i / (tiers - 1), w = s * (.5 - t * .36), by = y - s * .12 - t * s * .82, h = s * .34;
      const tier = () => { c.moveTo(x, by - h); c.quadraticCurveTo(x - w * .4, by - h * .35, x - w, by + h * .12); for (let k = 0; k <= 4; k++) { const xx = x - w + (2 * w) * k / 4; c.lineTo(xx, by + h * (k % 2 ? .02 : .14)); } c.quadraticCurveTo(x + w * .4, by - h * .35, x, by - h); c.closePath(); };
      g.fill(tier, g.lin(x - w, 0, x + w, 0, [dark, col, lit]), .25);
      c.fillStyle = rgba(dark, .5); c.beginPath(); c.moveTo(x, by - h); c.lineTo(x - w * .1, by + h * .1); c.lineTo(x - w * .65, by + h * .1); c.closePath(); c.fill();
      if (snow) { c.fillStyle = 'rgba(250,252,255,.9)'; c.beginPath(); c.moveTo(x, by - h); c.quadraticCurveTo(x - w * .45, by - h * .3, x - w * .8, by - h * .02); c.quadraticCurveTo(x - w * .3, by - h * .2, x + w * .1, by - h * .45); c.quadraticCurveTo(x + w * .4, by - h * .2, x + w * .75, by); c.quadraticCurveTo(x + w * .35, by - h * .4, x, by - h); c.fill(); } }
  }
  /* Waldsäume für Gebiete ohne eigene Requisiten: Baumgruppen in mehreren Größen entlang des Horizonts */
  function forest(c, g, key, T, R, HZ) {
    const kind = { rivendell: 'mix', lorien: 'gold', eregion: 'none', erebor: 'none', lake: 'none', weather: 'pine', helm: 'pine', pelennor: 'none', snow: 'snowpine', amonhen: 'none', shire: 'leaf', rhun: 'leaf', south: 'none' }[key];
    if (!kind || kind === 'none') return;
    const base = key === 'rhun' ? '#5a6438' : sh(T.mid, -.12);
    for (let grp = 0; grp < 3; grp++) { const gx = 20 + grp * 85 + R() * 30, n = 3 + (R() * 4 | 0);
      for (let i = 0; i < n; i++) { const x = gx + i * (5 + R() * 6), y = HZ + 1 + R() * 3, sz = 6 + R() * 6, col = sh(base, (R() - .5) * .3);
        if (kind === 'pine' || kind === 'snowpine' || (kind === 'mix' && R() < .5)) pine(g, c, x, y, sz * 1.6, sh(col, -.1), kind === 'snowpine');
        else tree(g, c, x, y, sz, kind === 'gold' ? '#c8a838' : col, kind === 'gold'); } }
  }
  function props(c, g, key, T, R, HZ) {
    if (key === 'shire') { g.ell(60, HZ + 2, 40, 16, g.lin(0, HZ - 14, 0, HZ + 10, [sh(T.mid, .2), T.mid]), 0); g.ell(60, HZ - 2, 6.6, 6.6, '#2e6a3a', .5); g.ell(60, HZ - 2, 5.2, 5.2, '#3a8a4a', 0); g.ell(61.5, HZ - 2, .8, .8, '#e8c040', 0); c.strokeStyle = '#7a5a3a'; c.lineWidth = .8; c.beginPath(); c.moveTo(150, HZ - 2); c.lineTo(250, HZ - 2); c.stroke(); for (let x = 150; x < 250; x += 6) { c.beginPath(); c.moveTo(x, HZ - 4); c.lineTo(x, HZ + 1); c.stroke(); } tree(g, c, 120, HZ, 8, '#3a7a32'); tree(g, c, 230, HZ - 4, 9, '#2e6a2a'); tree(g, c, 20, HZ - 2, 7, '#3a7a32'); }
    else if (key === 'weather') { g.ell(180, HZ - 4, 52, 22, g.lin(0, HZ - 26, 0, HZ, [sh(T.mid, .1), T.mid]), 0); for (let i = 0; i < 6; i++) { const x = 150 + i * 11, h = 8 + (i * 7) % 12, y0 = HZ - 17, lean = (i % 3 - 1) * .8, tp = [R() * 2, R() * 2.5, R() * 1.5]; g.fill(() => { c.moveTo(x - .4, y0 + 1); c.lineTo(x + lean, y0 - h + tp[0]); c.lineTo(x + 1.4 + lean, y0 - h - tp[1]); c.lineTo(x + 2.6 + lean, y0 - h + tp[2]); c.lineTo(x + 4.2 + lean, y0 - h + 1 + tp[0]); c.lineTo(x + 4.4, y0 + 1); c.closePath(); }, g.lin(x, 0, x + 4.4, 0, ['#4a4a4c', '#8a8a88', '#6a6a6a', '#3e3e40']), .3); c.strokeStyle = 'rgba(20,20,24,.35)'; c.lineWidth = .25; c.beginPath(); for (let yy = y0 - 3; yy > y0 - h + 2; yy -= 3) { c.moveTo(x + .2, yy); c.lineTo(x + 4.2, yy + .2); } c.moveTo(x + 2, y0 - h + 3); c.lineTo(x + 2.6, y0 - h + 6); c.stroke(); c.fillStyle = 'rgba(90,120,70,.55)'; c.beginPath(); c.ellipse(x + 2, y0 - 1, 2.4, 1, 0, 0, TAU); c.fill(); if (i % 2) g.rr(x + 5 + lean, y0 - 1, 2.4, 1.4, .3, '#6a6a68', .2); } }
    else if (key === 'moria' || key === 'khazad') { for (const x of [14, 62, 186, 234]) { g.rr(x, -2, 12, HZ + 6, 1, g.lin(x, 0, x + 12, 0, key === 'khazad' ? ['#2a3240', '#4e5868', '#2a3240'] : ['#1a1616', '#3a3434', '#1a1616']), .4); g.rr(x - 3, HZ - 2, 18, 6, 1, key === 'khazad' ? '#46505e' : '#322c2a', .3); } if (key === 'khazad') for (const x of [40, 130, 210]) { g.glow(x, 28, 14, '#7ae0ff', .7); g.ell(x, 28, 2, 2, '#c8f4ff', 0); } else g.glow(128, HZ, 60, '#ff5a1a', .5); }
    else if (key === 'amonhen') { for (let i = 0; i < 14; i++) pine(g, c, 6 + i * 19 + R() * 6, HZ + 2, 14 + R() * 10, i % 2 ? '#1e4a2a' : '#245a32'); }
    else if (false) { g.rr(-2, HZ - 26, 260, 26, 0, g.lin(0, HZ - 26, 0, HZ, ['#6a6a66', '#4a4a46']), .3); for (let x = 0; x < 256; x += 8) g.rr(x, HZ - 30, 4, 5, .3, '#62625e', .2); g.rr(190, HZ - 54, 30, 54, 1, g.lin(190, 0, 220, 0, ['#5a5a56', '#7a7a74']), .4); g.glow(204, HZ - 36, 8, '#ffb050', .7); }
    else if (key === 'cirith') { c.strokeStyle = 'rgba(220,220,240,.25)'; c.lineWidth = .3; for (let i = 0; i < 4; i++) { const ox = i < 2 ? 0 : 256, oy = i % 2 ? 0 : 30; for (let j = 0; j < 7; j++) { c.beginPath(); c.moveTo(ox, oy); c.quadraticCurveTo(ox + (i < 2 ? 1 : -1) * (10 + j * 5), oy + 30, ox + (i < 2 ? 1 : -1) * (20 + j * 10), oy + 40 - j * 6); c.stroke(); } } g.fill(() => { c.moveTo(150, HZ); c.lineTo(172, 28); c.lineTo(180, 28); c.lineTo(200, HZ); }, '#1a1222', 0); g.glow(176, 36, 6, '#ff5a3a', .9); }
    else if (false) { const col = key === 'pelennor' ? '#e0dcd0' : '#c8b8a0'; for (let i = 0; i < 6; i++) g.rr(20 + i * 6, HZ - 14 - i * 7, 60 - i * 12, 7, .6, g.lin(0, 0, 0, 7, [col, sh(col, -.25)]), .3); g.rr(46, HZ - 62, 4, 14, .5, '#f8f4ea', .3); if (key === 'pelennor') for (let i = 0; i < 4; i++) { const x = 120 + i * 35; g.glow(x, HZ - 4, 10, '#ff7a2a', .7); c.fillStyle = 'rgba(40,32,30,.45)'; c.beginPath(); c.moveTo(x - 2, HZ - 4); c.bezierCurveTo(x - 8, HZ - 30, x + 8, HZ - 50, x - 4, HZ - 80); c.lineTo(x + 6, HZ - 80); c.bezierCurveTo(x + 14, HZ - 50, x + 4, HZ - 30, x + 3, HZ - 4); c.fill(); } else { for (let i = 0; i < 6; i++) tree(g, c, 120 + i * 24, HZ, 7, '#1e4a2a'); g.glow(230, HZ - 6, 14, '#ff8a2a', .8); } }
    else if (key === 'doom') { for (let i = 0; i < 6; i++) g.fill(() => { c.moveTo(i * 48, HZ); c.lineTo(i * 48 + 20, HZ - 14 - R() * 10); c.lineTo(i * 48 + 44, HZ); }, '#1a0a08', 0); }
    else if (key === 'snow') { for (let i = 0; i < 8; i++) { const x = 10 + i * 34 + R() * 10, h = 10 + R() * 18; g.fill(() => { c.moveTo(x, HZ + 2); c.lineTo(x + 4, HZ - h); c.lineTo(x + 9, HZ + 2); }, g.lin(x, 0, x + 9, 0, ['#e0f4ff', '#8ac0e8']), .3); } }
    else if (key === 'sea') { c.fillStyle = g.lin(0, 62, 0, HZ, ['#4a7aa8', '#1e4a7a']); c.fillRect(0, 64, 256, HZ - 64); c.strokeStyle = 'rgba(200,230,255,.35)'; c.lineWidth = .4; for (let i = 0; i < 40; i++) { const x = R() * 256, y = 66 + R() * 22; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 3 + R() * 4, y); c.stroke(); } g.limb([[200, 70], [200, 40]], 1.2, '#5a3a22', .3); g.fill(() => { c.moveTo(201, 42); c.quadraticCurveTo(214, 50, 201, 62); c.lineTo(222, 60); c.quadraticCurveTo(216, 50, 201, 42); }, '#ece4d4', .3); }
    else if (key === 'south') { const palm = (x, y, h) => { c.strokeStyle = '#6a4a2a'; c.lineCap = 'round'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 3, y - h * .5, x + 1.5, y - h); c.stroke(); c.strokeStyle = 'rgba(40,24,10,.5)'; c.lineWidth = .3; c.beginPath(); for (let i = 1; i < 8; i++) { const t = i / 8, px = x + 6 * t * (1 - t) + 1.5 * t * t; c.moveTo(px - .8, y - h * t); c.lineTo(px + .8, y - h * t - .4); } c.stroke(); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .55, L = 8 + (i % 2) * 2, ex = x + 1.5 + Math.cos(a) * L, ey = y - h + Math.sin(a) * L * .5 + 4; g.fill(() => { c.moveTo(x + 1.5, y - h); c.quadraticCurveTo((x + 1.5 + ex) / 2, y - h - 3 + (i === 3 ? -2 : 0), ex, ey); c.quadraticCurveTo((x + 1.5 + ex) / 2, y - h + 1, x + 1.5, y - h + .6); c.closePath(); }, i % 2 ? '#3a6a28' : '#4e8a34', .2); } };
      const house = (x, w, h, dome) => { const y = HZ - h; g.rr(x, y, w, h, .6, g.lin(x, 0, x + w, 0, ['#d8b484', '#b08a5a', '#8a6a44']), .3); c.fillStyle = 'rgba(60,40,20,.25)'; c.fillRect(x + w * .66, y, w * .34, h); if (dome) g.fill(() => { c.moveTo(x + 2, y); c.quadraticCurveTo(x + w / 2, y - w * .6, x + w - 2, y); c.closePath(); }, g.lin(x, y - 10, x + w, y, ['#f4e4c4', '#c09a68']), .3); else { g.rr(x - 1, y - 1.4, w + 2, 1.8, .3, '#c8a070', .2); for (let i = 0; i < w / 5; i++) g.rr(x + 1 + i * 5, y + 1, 1.4, 1, 0, '#5a3a20', 0); } c.fillStyle = '#2a1a10'; c.beginPath(); c.moveTo(x + w * .3, HZ); c.lineTo(x + w * .3, HZ - h * .45); c.arc(x + w * .3 + 2, HZ - h * .45, 2, Math.PI, 0); c.lineTo(x + w * .3 + 4, HZ); c.fill(); c.fillRect(x + w * .7, y + h * .3, 2.4, 3); };
      house(26, 26, 20, 1); house(54, 16, 14, 0); house(166, 20, 26, 0); house(188, 14, 16, 1); palm(18, HZ, 26); palm(80, HZ, 22); palm(210, HZ, 28); palm(232, HZ, 20); }
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
    else if (key === 'rhun') { for (const [x, w] of [[30, 22], [58, 16], [190, 24], [222, 14]]) { const y = HZ, h = w * .55; g.fill(() => { c.moveTo(x, y); c.lineTo(x, y - h * .5); c.quadraticCurveTo(x + w / 2, y - h * 1.4, x + w, y - h * .5); c.lineTo(x + w, y); c.closePath(); }, g.lin(x, 0, x + w, 0, ['#d8c8a8', '#b8a080', '#8a7458']), .3); c.strokeStyle = '#9a2a1e'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - h * .5); c.quadraticCurveTo(x + w / 2, y - h * .62, x + w, y - h * .5); c.stroke(); c.strokeStyle = 'rgba(90,60,40,.4)'; c.lineWidth = .3; c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(x + w * i / 5, y - h * .5 - .5); c.lineTo(x + w / 2, y - h * .98); } c.stroke(); g.fill(() => { c.moveTo(x + w * .42, y); c.lineTo(x + w * .42, y - h * .36); c.lineTo(x + w * .58, y - h * .36); c.lineTo(x + w * .58, y); c.closePath(); }, '#3a2414', 0); g.limb([[x + w / 2, y - h * .95], [x + w / 2, y - h * 1.2]], .4, '#4a3020', 0); }
      for (const x of [108, 150]) { g.limb([[x, HZ], [x, HZ - 26]], .7, '#4a3020', .2); for (let i = 0; i < 3; i++) g.ell(x, HZ - 8 - i * 6, 1.4, 1.2, '#8a5a30', .2); g.fill(() => { c.moveTo(x, HZ - 25); c.lineTo(x + 8, HZ - 23); c.lineTo(x + 6, HZ - 20); c.lineTo(x + 8, HZ - 17); c.lineTo(x, HZ - 17); c.closePath(); }, '#9a2a1e', .2); c.strokeStyle = '#3a2414'; c.lineWidth = .4; c.beginPath(); for (const d of [-1, 1]) { c.moveTo(x, HZ - 27); c.lineTo(x + d * 2.4, HZ - 30); } c.stroke(); } }
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
  /* Mauerwerk-Helfer für Wahrzeichen: Quaderfugen, Zinnen, Schießscharten */
  function masonry(c, x, y, w, h, bh, col, a = .28) { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = rgba(col, a); c.lineWidth = .3; c.beginPath(); for (let yy = y + bh, r = 0; yy < y + h; yy += bh, r++) { c.moveTo(x, yy); c.lineTo(x + w, yy); for (let xx = x + (r % 2) * bh * 1.1; xx < x + w; xx += bh * 2.2) { c.moveTo(xx, yy - bh); c.lineTo(xx, yy); } } c.stroke(); c.restore(); }
  function crenel(g, c, x, y, w, sz, col) { for (let xx = x; xx < x + w - sz * .5; xx += sz * 1.8) g.rr(xx, y - sz, sz, sz + .4, .15, col, .2); }
  const LANDMARKS = {
    pelennor: { w: 150, h: 104, base: 6, paint(c, g, T) {
      // Mindolluin im Rücken, verschneit
      g.fill(() => { c.moveTo(0, 104); c.lineTo(18, 54); c.lineTo(36, 30); c.lineTo(52, 16); c.lineTo(66, 6); c.lineTo(84, 18); c.lineTo(104, 30); c.lineTo(126, 56); c.lineTo(150, 104); c.closePath(); }, g.lin(0, 6, 150, 104, [sh(T.far, .3), T.far, sh(T.far, -.25)]), 0);
      g.fill(() => { c.moveTo(48, 19); c.lineTo(66, 6); c.lineTo(84, 18); c.lineTo(78, 21); c.lineTo(72, 17); c.lineTo(66, 22); c.lineTo(60, 18); c.lineTo(54, 23); c.closePath(); }, 'rgba(246,248,252,.85)', 0);
      // sieben Ringe aus weißem Stein, nach hinten kleiner, mit Häuserdächern auf jeder Stufe
      const stone = (y, h2) => g.lin(0, y, 0, y + h2, ['#fbfaf6', '#dcd8ce', '#b4b0a6']);
      for (let i = 0; i < 7; i++) { const w = 96 - i * 12, h2 = 8.2, y = 104 - (i + 1) * 8.2, x = 74 - w / 2;
        g.fill(() => { c.moveTo(x, y + h2); c.lineTo(x + 1.2, y + 1); c.quadraticCurveTo(74, y - 1.2, x + w - 1.2, y + 1); c.lineTo(x + w, y + h2); c.closePath(); }, stone(y, h2), .25);
        c.fillStyle = 'rgba(80,76,70,.35)'; c.fillRect(x + w * .55, y + 1.4, w * .45 - 1, h2 - 1.4);
        for (let j = 0; j < w / 2.2; j++) { const hx = x + 1.5 + j * 2.2; if (hx > x + w - 2) break; c.fillStyle = (i + j) % 3 ? '#8a8a96' : '#7a7a86'; c.fillRect(hx, y - .9 - ((i * 3 + j) % 3) * .35, 1.8, 1.4); }
        c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(x + 1, y + 1, w * .5, .45);
        c.fillStyle = 'rgba(255,210,130,.85)'; for (let j = 0; j < w / 5; j++) if ((i * 7 + j * 3) % 5 < 2) c.fillRect(x + 2.5 + j * 5, y + 3.8, .8, 1.3); }
      // der große Felsbug teilt die Ringe
      g.fill(() => { c.moveTo(70, 46); c.lineTo(78, 46); c.lineTo(84, 104); c.lineTo(74, 104); c.closePath(); }, g.lin(70, 0, 84, 0, ['#f4f2ec', '#c8c4ba', '#8e8a82']), .3);
      c.strokeStyle = 'rgba(90,86,80,.4)'; c.lineWidth = .3; c.beginPath(); for (let i = 1; i < 7; i++) { c.moveTo(71 + i * .9, 46 + i * 8.2); c.lineTo(78 + i * .9, 46 + i * 8.2); } c.stroke();
      // großes Tor
      g.fill(() => { c.moveTo(68, 104); c.lineTo(68, 99); c.quadraticCurveTo(71, 96, 74, 99); c.lineTo(74, 104); c.closePath(); }, '#2a2420', 0);
      // Zitadelle mit dem Weißen Turm Ecthelions
      g.rr(64, 38, 20, 8, .5, stone(38, 8), .25); crenel(g, c, 64, 38, 20, 1.2, '#efece4');
      g.fill(() => { c.moveTo(71.2, 39); c.lineTo(71.8, 9); c.lineTo(76.2, 9); c.lineTo(76.8, 39); c.closePath(); }, g.lin(71, 0, 77, 0, ['#ffffff', '#e8e6e0', '#b8b4aa']), .25);
      for (const yy of [14, 22, 30]) { c.fillStyle = '#4a4640'; c.fillRect(73.5, yy, .9, 2); } g.rr(70.6, 8, 6.8, 1.6, .3, '#f4f2ec', .2);
      g.fill(() => { c.moveTo(71.4, 8.4); c.quadraticCurveTo(73.4, 5, 74, -1); c.quadraticCurveTo(74.6, 5, 76.6, 8.4); c.closePath(); }, g.lin(71, 0, 77, 0, ['#ffffff', '#d8d6d0']), .2);
      c.strokeStyle = '#d8d8d0'; c.lineWidth = .25; c.beginPath(); c.moveTo(74, -1); c.lineTo(74, -5); c.stroke(); g.fill(() => { c.moveTo(74, -5); c.quadraticCurveTo(77, -5.4, 80, -4.4); c.lineTo(79.4, -3.2); c.quadraticCurveTo(76.6, -3.6, 74, -3.2); c.closePath(); }, '#1a1a1e', .15);
    }, anim(ctx, x, y, gt) { const a = .35 + .15 * Math.sin(gt / 500); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 74, y + 4, 0, x + 74, y + 4, 9); r.addColorStop(0, `rgba(255,250,230,${a})`); r.addColorStop(1, 'rgba(255,250,230,0)'); ctx.fillStyle = r; ctx.fillRect(x + 64, y - 6, 20, 20); ctx.restore(); } },
    doom: { w: 168, h: 136, base: 4, k: .55, paint(c, g, T) {
      // Barad-dûr: gestaffelte Türme mit Strebepfeilern und Dornen, glühende Schlitze; oben das Auge bei (48,17)
      const tower = () => { c.moveTo(2, 136); c.lineTo(10, 108); c.lineTo(8, 100); c.lineTo(16, 96); c.lineTo(18, 80); c.lineTo(14, 74); c.lineTo(22, 70); c.lineTo(26, 52); c.lineTo(23, 47); c.lineTo(31, 44); c.lineTo(34, 30); c.lineTo(32, 25); c.lineTo(38, 23); c.lineTo(40, 14); c.lineTo(41.5, 6); c.lineTo(43, 14); c.lineTo(46, 10); c.lineTo(48, 0); c.lineTo(50, 10); c.lineTo(53, 14); c.lineTo(54.5, 6); c.lineTo(56, 14); c.lineTo(58, 23); c.lineTo(64, 25); c.lineTo(62, 30); c.lineTo(65, 44); c.lineTo(73, 47); c.lineTo(70, 52); c.lineTo(74, 70); c.lineTo(82, 74); c.lineTo(78, 80); c.lineTo(80, 96); c.lineTo(88, 100); c.lineTo(86, 108); c.lineTo(94, 136); c.closePath(); };
      g.fill(tower, g.lin(0, 0, 96, 0, ['#050406', '#18100e', '#0c0808']), 0);
      c.save(); c.beginPath(); tower(); c.clip(); c.fillStyle = g.lin(0, 40, 0, 136, ['rgba(80,20,10,0)', 'rgba(120,30,10,.45)']); c.fillRect(0, 40, 96, 96);
      c.strokeStyle = 'rgba(255,100,40,.25)'; c.lineWidth = .35; c.beginPath(); for (const [x1, y1, x2, y2] of [[26, 52, 22, 70], [70, 52, 74, 70], [34, 30, 31, 44], [62, 30, 65, 44], [18, 80, 16, 96], [78, 80, 80, 96]]) { c.moveTo(x1, y1); c.lineTo(x2, y2); } c.stroke();
      c.fillStyle = 'rgba(255,90,30,.75)'; for (const [x, y] of [[44, 34], [52, 40], [40, 56], [56, 60], [30, 84], [64, 88], [48, 96], [36, 112], [58, 116], [48, 70]]) c.fillRect(x, y, .8, 2.2); c.restore();
      for (const [x, y, d] of [[16, 96, -1], [22, 70, -1], [31, 44, -1], [80, 96, 1], [74, 70, 1], [65, 44, 1]]) g.fill(() => { c.moveTo(x, y); c.lineTo(x + d * 6, y - 4); c.lineTo(x + d * 1.5, y + 2); c.closePath(); }, '#0c0808', 0);
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
    cirith: { w: 110, h: 104, base: 4, k: .5, paint(c, g, T) {
      // Minas Morgul: fahle Festung im Schattengebirge, Turm mit gezackter Krone, Brücke über das Morgultal
      g.fill(() => { c.moveTo(0, 104); c.lineTo(0, 44); c.lineTo(8, 50); c.lineTo(16, 36); c.lineTo(24, 58); c.lineTo(30, 70); c.lineTo(80, 68); c.lineTo(88, 50); c.lineTo(96, 30); c.lineTo(104, 44); c.lineTo(110, 40); c.lineTo(110, 104); c.closePath(); }, g.lin(0, 30, 0, 104, ['#241e30', '#0e0c14']), 0);
      c.strokeStyle = 'rgba(150,140,190,.12)'; c.lineWidth = .4; c.beginPath(); for (const [x1, y1, x2, y2] of [[16, 38, 10, 70], [96, 32, 102, 66], [8, 52, 4, 80], [104, 46, 106, 80]]) { c.moveTo(x1, y1); c.quadraticCurveTo(x1 - 2, (y1 + y2) / 2, x2, y2); } c.stroke();
      // Felssporn mit Mauern und Häusern
      g.fill(() => { c.moveTo(22, 104); c.lineTo(28, 86); c.lineTo(34, 80); c.lineTo(76, 79); c.lineTo(84, 88); c.lineTo(92, 104); c.closePath(); }, g.lin(0, 79, 0, 104, ['#2e2a36', '#141218']), .3);
      g.fill(() => { c.moveTo(30, 82); c.lineTo(31, 72); c.lineTo(80, 72); c.lineTo(81, 82); c.closePath(); }, g.lin(30, 0, 80, 0, ['#2a3430', '#4a5e56', '#26302c']), .3); masonry(c, 31, 72, 49, 10, 2.2, '#0c100e', .35); crenel(g, c, 31, 72, 49, 1.8, '#3a4a44');
      for (const [x, w2, h2] of [[36, 7, 8], [44, 6, 11], [66, 7, 10], [74, 5, 7]]) { g.rr(x, 72 - h2, w2, h2, .3, g.lin(x, 0, x + w2, 0, ['#26302c', '#3e4e48']), .25); g.fill(() => { c.moveTo(x - .5, 72 - h2); c.lineTo(x + w2 / 2, 72 - h2 - 3.5); c.lineTo(x + w2 + .5, 72 - h2); c.closePath(); }, '#1a2220', .2); }
      // Brücke über das Tal
      g.fill(() => { c.moveTo(0, 92); c.lineTo(30, 88); c.lineTo(30, 91); c.lineTo(0, 95); c.closePath(); }, '#3a4642', .25); c.fillStyle = '#0e0c14'; for (const x of [6, 16, 25]) { c.beginPath(); c.moveTo(x - 3.4, 104); c.lineTo(x - 3.4, 97); c.quadraticCurveTo(x, 92.5, x + 3.4, 96.4); c.lineTo(x + 3.4, 104); c.fill(); }
      // Turm mit verjüngtem Schaft, Kranzgesims, gezackter Krone und Spitze
      const tw = () => { c.moveTo(48, 74); c.lineTo(49.4, 30); c.lineTo(48, 26); c.lineTo(62, 26); c.lineTo(60.6, 30); c.lineTo(62, 74); c.closePath(); };
      g.fill(tw, g.lin(48, 0, 62, 0, ['#1e2824', '#5a7266', '#8aa496', '#2a3632']), .35); masonry(c, 49, 26, 12, 48, 2.6, '#0c1210', .3);
      g.rr(46.5, 23, 17, 3.4, .5, g.lin(0, 23, 0, 26.4, ['#7a9486', '#3a4a44']), .3);
      g.fill(() => { c.moveTo(47, 23); c.lineTo(48, 15); c.lineTo(50, 19); c.lineTo(52, 12); c.lineTo(55, 4); c.lineTo(58, 12); c.lineTo(60, 19); c.lineTo(62, 15); c.lineTo(63, 23); c.closePath(); }, g.lin(47, 0, 63, 0, ['#2a3632', '#6a8478', '#2a3632']), .3);
      g.limb([[55, 5], [55, -2]], .5, '#3a4a44', .15);
      c.fillStyle = 'rgba(200,255,220,.9)'; for (let i = 0; i < 5; i++) { c.fillRect(54.3, 32 + i * 8.4, 1.4, 3); } for (const [wx, wy] of [[51, 40], [58.6, 52], [51, 62], [52.4, 18], [57, 18]]) c.fillRect(wx, wy, .9, 1.8); for (let i = 0; i < 7; i++) c.fillRect(33 + i * 7, 77, 1.1, 2);
    }, anim(ctx, x, y, gt) { const a = .32 + .2 * Math.sin(gt / 700); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 55, y + 34, 0, x + 55, y + 34, 40); r.addColorStop(0, `rgba(170,255,200,${a})`); r.addColorStop(1, 'rgba(120,255,180,0)'); ctx.fillStyle = r; ctx.fillRect(x + 15, y - 6, 80, 80); const b = .25 + .25 * Math.sin(gt / 260); ctx.fillStyle = `rgba(210,255,225,${b})`; ctx.fillRect(x + 54, y + 9, 2, 2); ctx.restore(); } },
    amonhen: { w: 160, h: 96, base: 4, k: .56, paint(c, g, T) {
      // Felswände der Pforte, Fluss dazwischen
      for (const sd of [-1, 1]) { const X = sd < 0 ? 0 : 160, d = -sd; g.fill(() => { c.moveTo(X, 96); c.lineTo(X, 26); c.lineTo(X + d * 10, 22); c.lineTo(X + d * 20, 34); c.lineTo(X + d * 26, 60); c.lineTo(X + d * 32, 96); c.closePath(); }, g.lin(X, 0, X + d * 32, 0, [sh(T.far, -.25), sh(T.far, .05)]), 0); }
      c.fillStyle = g.lin(0, 82, 0, 96, ['rgba(170,205,225,.75)', 'rgba(70,110,140,.8)']); c.fillRect(30, 84, 100, 12); c.strokeStyle = 'rgba(230,245,255,.5)'; c.lineWidth = .35; c.beginPath(); for (let i = 0; i < 8; i++) { const x = 36 + i * 11; c.moveTo(x, 88 + (i % 3)); c.lineTo(x + 5, 88 + (i % 3)); } c.stroke();
      // Die Argonath: gekrönte Könige in Stein, linke Hand zur Warnung erhoben, rechts die Axt
      const king = (bx, dir) => { c.save(); c.translate(bx, 96); c.scale(dir, 1); const st = g.lin(-16, 0, 16, 0, ['#5a5a54', '#8e8e86', '#b4b4ac', '#6a6a64']), dk2 = '#4a4a46';
        g.fill(() => { c.moveTo(-17, 0); c.lineTo(-16, -16); c.lineTo(16, -16); c.lineTo(17, 0); c.closePath(); }, g.lin(0, -16, 0, 0, ['#8a8a82', '#5a5a54']), .3);
        g.fill(() => { c.moveTo(-12, -16); c.quadraticCurveTo(-13, -40, -9, -58); c.lineTo(9, -58); c.quadraticCurveTo(13, -40, 12, -16); c.closePath(); }, st, .3);
        c.strokeStyle = 'rgba(40,40,36,.4)'; c.lineWidth = .45; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(-6 + i * 3, -54); c.quadraticCurveTo(-8 + i * 4, -36, -10 + i * 5, -17); } c.stroke();
        g.rr(-10, -40, 20, 2.4, .5, '#7a7a72', .25);
        g.fill(() => { c.moveTo(-9.5, -55); c.quadraticCurveTo(-17, -60, -17, -68); c.lineTo(-16.6, -79); c.lineTo(-10.4, -79); c.lineTo(-11, -68); c.quadraticCurveTo(-10.5, -63, -3, -58.5); c.closePath(); }, st, .3); g.ell(-8, -56.5, 4.2, 3.2, st, .3);
        g.fill(() => { c.moveTo(-16.5, -78); c.lineTo(-17.5, -90); c.quadraticCurveTo(-13, -92, -9.5, -89); c.lineTo(-10, -78); c.closePath(); }, st, .3); c.strokeStyle = 'rgba(40,40,36,.45)'; c.lineWidth = .3; c.beginPath(); for (let i = 0; i < 3; i++) { c.moveTo(-16 + i * 2, -90.5); c.lineTo(-16 + i * 2, -86); } c.stroke();
        g.fill(() => { c.moveTo(7, -56); c.quadraticCurveTo(12, -46, 10, -36); c.lineTo(6.5, -36); c.quadraticCurveTo(7, -46, 4, -55); c.closePath(); }, st, .3);
        g.rr(9, -80, 2, 62, .4, dk2, .25); g.fill(() => { c.moveTo(10.5, -80); c.quadraticCurveTo(19, -82, 18, -70); c.quadraticCurveTo(14, -72, 10.5, -72); c.closePath(); }, g.lin(10, -80, 18, -70, ['#a4a49c', '#6a6a64']), .25);
        g.ell(0, -64, 5.4, 6.6, st, .3); g.fill(() => { c.moveTo(-6, -66); c.lineTo(-5, -73); c.lineTo(-3, -70); c.lineTo(0, -76); c.lineTo(3, -70); c.lineTo(5, -73); c.lineTo(6, -66); c.closePath(); }, '#8a8a82', .3);
        c.fillStyle = 'rgba(30,30,28,.55)'; c.fillRect(1.6, -65, 1.8, .9); c.fillStyle = 'rgba(80,110,60,.5)'; for (const [mx, my] of [[-8, -20], [6, -30], [-3, -46], [-14, -6], [10, -10]]) { c.beginPath(); c.ellipse(mx, my, 2.2, 1, 0, 0, TAU); c.fill(); }
        c.strokeStyle = 'rgba(20,20,18,.5)'; c.lineWidth = .3; c.beginPath(); c.moveTo(-4, -30); c.lineTo(-1, -24); c.lineTo(-3, -18); c.moveTo(5, -50); c.lineTo(3, -44); c.stroke(); c.restore(); };
      king(44, 1); king(116, -1);
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
      // Felswände mit Schichtung, Simsen, Moos und kleinen Tannen; das Licht fällt von rechts
      const cliff = side => { const X = side < 0 ? 0 : 200, d = -side, pts = [[X, 118], [X, 4], [X + d * 9, 1], [X + d * 15, 7], [X + d * 22, 3], [X + d * 30, 12], [X + d * 33, 24], [X + d * 38, 31], [X + d * 39, 44], [X + d * 44, 52], [X + d * 45, 66], [X + d * 50, 76], [X + d * 51, 92], [X + d * 56, 104], [X + d * 60, 118]];
        const path = () => { c.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) c.lineTo(pts[k][0], pts[k][1]); c.closePath(); };
        const lit = side < 0; g.fill(path, g.lin(X, 0, X + d * 58, 0, lit ? ['#2e3a34', '#56645c', '#8a988e'] : ['#2a3630', '#3e4a44', '#26302c']), .3);
        c.save(); c.beginPath(); path(); c.clip(); c.lineCap = 'round';
        for (let k = 0; k < 12; k++) { const y = 10 + k * 9 + (k % 3), x0 = X + d * 2, x1 = X + d * (30 + k * 2.4); c.strokeStyle = rgba('#141c18', .35); c.lineWidth = .5; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y + (k % 2 ? 2 : -1.5), x1, y + 1); c.stroke(); c.strokeStyle = rgba(lit ? '#c8d4c8' : '#7a8880', .18); c.lineWidth = .35; c.beginPath(); c.moveTo(x0, y - .7); c.quadraticCurveTo((x0 + x1) / 2, y - .7 + (k % 2 ? 2 : -1.5), x1, y + .3); c.stroke(); }
        for (let k = 0; k < 7; k++) { const x = X + d * (6 + k * 6.5); c.strokeStyle = rgba('#101814', .3); c.lineWidth = .4; c.beginPath(); c.moveTo(x, 8 + k * 4); c.lineTo(x + d * 1.5, 40 + k * 9); c.lineTo(x - d * 1, 70 + k * 6); c.stroke(); }
        for (const [px, py] of [[33, 24], [39, 44], [45, 66], [51, 92]]) { g.ell(X + d * (px - 3), py + .5, 5.5, 1.6, rgba('#4a7a3e', .85), 0); g.ell(X + d * (px - 2), py, 3.4, .9, rgba('#8ab868', .6), 0); }
        c.restore();
        for (const [px, py, s2] of [[36, 30, 7], [42, 50, 6], [48, 74, 8], [53, 100, 9]]) pine(g, c, X + d * px, py + 1, s2, '#2e5a3a'); };
      cliff(-1); cliff(1);
      // Wasserfälle in mehreren Strängen mit Gischt
      for (const [fx, fy] of [[36, 18], [158, 20]]) { for (let k = 0; k < 3; k++) { const w2 = 1.6 - k * .35, ox = (k - 1) * 1.6; c.fillStyle = g.lin(fx + ox - w2, 0, fx + ox + w2, 0, ['rgba(210,230,245,.25)', 'rgba(250,253,255,.92)', 'rgba(210,230,245,.25)']); c.beginPath(); c.moveTo(fx + ox - w2 * .6, fy); c.quadraticCurveTo(fx + ox - w2, fy + 40, fx + ox - w2 * 1.4, 110); c.lineTo(fx + ox + w2 * 1.4, 110); c.quadraticCurveTo(fx + ox + w2, fy + 40, fx + ox + w2 * .6, fy); c.closePath(); c.fill(); }
        for (let k = 0; k < 6; k++) g.ell(fx + (k - 2.5) * 3.2, 110 - (k % 2) * 1.6, 5 + (k % 3), 2.6, 'rgba(240,248,255,.45)', 0); }
      // Das Letzte Heimelige Haus: Terrassen, Säulengänge, geschwungene Dächer, schlanker Turm
      const wall = g.lin(0, 30, 0, 112, ['#f6eedc', '#dccca8']), roofG = y0 => g.lin(0, y0 - 8, 0, y0, ['#9ab8aa', '#5a7a6c', '#3e5a4e']), ow2 = .28;
      const roof = (x0, x1, y0, h0, lip) => g.fill(() => { c.moveTo(x0 - lip, y0 + .6); c.quadraticCurveTo(x0 + 1, y0 - .4, x0 + (x1 - x0) * .2, y0 - h0 * .55); c.quadraticCurveTo((x0 + x1) / 2, y0 - h0 * 1.15, x1 - (x1 - x0) * .2, y0 - h0 * .55); c.quadraticCurveTo(x1 - 1, y0 - .4, x1 + lip, y0 + .6); c.quadraticCurveTo((x0 + x1) / 2, y0 - .8, x0 - lip, y0 + .6); c.closePath(); }, roofG(y0), ow2);
      g.rr(58, 106, 84, 5, .6, g.lin(0, 106, 0, 111, ['#e8dcc0', '#b8a888']), ow2); c.strokeStyle = 'rgba(120,100,70,.5)'; c.lineWidth = .3; c.beginPath(); for (let x = 60; x <= 140; x += 3) { c.moveTo(x, 106); c.lineTo(x, 103.6); } c.moveTo(58, 103.6); c.lineTo(142, 103.6); c.stroke();
      g.rr(64, 86, 72, 20, .6, wall, ow2); for (let k = 0; k < 7; k++) { const ax = 67.4 + k * 9.6; g.fill(() => { c.moveTo(ax, 106); c.lineTo(ax, 94); c.quadraticCurveTo(ax + 3.2, 88.5, ax + 6.4, 94); c.lineTo(ax + 6.4, 106); c.closePath(); }, g.lin(0, 90, 0, 106, ['rgba(70,54,36,.7)', 'rgba(40,30,20,.55)']), 0); c.fillStyle = 'rgba(255,250,236,.8)'; c.fillRect(ax - 1.1, 88, 1, 18); }
      roof(62, 138, 86, 8, 3.5);
      g.rr(74, 62, 52, 22, .6, wall, ow2); for (let k = 0; k < 5; k++) { const ax = 78 + k * 9.2; g.fill(() => { c.moveTo(ax, 82); c.lineTo(ax, 70); c.quadraticCurveTo(ax + 2.8, 64.5, ax + 5.6, 70); c.lineTo(ax + 5.6, 82); c.closePath(); }, 'rgba(60,46,32,.55)', 0); }
      roof(71, 129, 62, 9, 3);
      g.rr(94, 32, 12, 30, .6, wall, ow2); for (const wy of [38, 48]) g.fill(() => { c.moveTo(98, wy + 6); c.lineTo(98, wy + 2); c.quadraticCurveTo(100, wy - .5, 102, wy + 2); c.lineTo(102, wy + 6); c.closePath(); }, 'rgba(60,46,32,.55)', 0);
      g.fill(() => { c.moveTo(91, 33); c.quadraticCurveTo(96, 30, 98, 22); c.quadraticCurveTo(100, 10, 100, 6); c.quadraticCurveTo(100, 10, 102, 22); c.quadraticCurveTo(104, 30, 109, 33); c.quadraticCurveTo(100, 31.5, 91, 33); c.closePath(); }, roofG(33), ow2); g.limb([[100, 6], [100, 2]], .4, '#d8c070', 0);
      g.rr(66, 92, 12, 14, .5, wall, ow2); roof(64, 80, 92, 5, 2); g.rr(122, 90, 13, 16, .5, wall, ow2); roof(120, 137, 90, 5.5, 2);
      c.strokeStyle = rgba('#000000', .12); c.lineWidth = 1.2; c.beginPath(); c.moveTo(126, 63); c.lineTo(126, 84); c.moveTo(136, 87); c.lineTo(136, 106); c.stroke();
      c.fillStyle = 'rgba(255,214,140,.95)'; for (const [x, y] of [[71, 100], [90, 100], [109, 100], [128, 100], [87, 74], [105, 74], [99, 44]]) { c.fillRect(x, y, 1.4, 2.4); }
      for (const [x, s2] of [[62, 9], [140, 10], [57, 7], [146, 8]]) tree(g, c, x, 116, s2, '#3a6a3e');
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const fx of [36, 158]) for (let i = 0; i < 4; i++) { const t = ((gt / 900) + i / 4) % 1; ctx.fillStyle = `rgba(255,255,255,${.35 * Math.sin(t * Math.PI)})`; ctx.fillRect(x + fx - 1.5 + (i % 2), y + 18 + t * 90, 2.2, 7); }
      const a = .3 + .15 * Math.sin(gt / 700); for (const [px, py] of [[71, 100], [109, 100], [99, 44]]) { const r = ctx.createRadialGradient(x + px, y + py, 0, x + px, y + py, 7); r.addColorStop(0, `rgba(255,200,110,${a})`); r.addColorStop(1, 'rgba(255,200,110,0)'); ctx.fillStyle = r; ctx.fillRect(x + px - 7, y + py - 7, 14, 14); } ctx.restore(); } },
    lorien: { w: 190, h: 128, base: 2, k: .52, paint(c, g, T) {
      // Mallorn-Bäume: silbrige Stämme mit Brettwurzeln, ausladende Äste und goldene Kronen in vielen Ballen
      let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (const [tx, tw] of [[34, 9], [164, 10], [100, 13]]) {
        const bark = g.lin(tx - tw, 0, tx + tw, 0, ['#4a5056', '#8e969c', '#c8cfd4', '#9aa2a8', '#454b52']);
        g.fill(() => { c.moveTo(tx - tw * 1.6, 128); c.quadraticCurveTo(tx - tw * .7, 124, tx - tw * .55, 112); c.bezierCurveTo(tx - tw * .48, 80, tx - tw * .36, 50, tx - tw * .3, 26); c.lineTo(tx + tw * .3, 26); c.bezierCurveTo(tx + tw * .36, 50, tx + tw * .48, 80, tx + tw * .55, 112); c.quadraticCurveTo(tx + tw * .7, 124, tx + tw * 1.6, 128); c.closePath(); }, bark, .3);
        c.lineCap = 'round'; c.strokeStyle = rgba('#3e444a', .4); c.lineWidth = .35; c.beginPath(); for (let k = 0; k < 6; k++) { const ox = (k - 2.5) * tw * .14; c.moveTo(tx + ox * 1.6, 126); c.bezierCurveTo(tx + ox * 1.1, 100, tx + ox * 1.2 + Math.sin(k) * .8, 70, tx + ox * .7, 30); } c.stroke();
        c.strokeStyle = rgba('#ffffff', .25); c.lineWidth = .6; c.beginPath(); c.moveTo(tx + tw * .3, 124); c.bezierCurveTo(tx + tw * .28, 90, tx + tw * .22, 60, tx + tw * .14, 30); c.stroke();
        c.strokeStyle = '#7a8288'; for (const [ax, ay, bx, by, w2] of [[-.3, 48, -26, 30, 2.2], [.3, 42, 24, 24, 2], [-.2, 34, -14, 18, 1.5], [.2, 32, 12, 14, 1.4]]) { c.lineWidth = w2 * tw / 10; c.beginPath(); c.moveTo(tx + ax * tw, ay); c.quadraticCurveTo(tx + bx * .4, ay - 6, tx + bx * tw / 10, by); c.stroke(); }
        const spr = Math.min(30 * tw / 10, Math.min(tx, 190 - tx) - 10), blobs = []; for (let k = 0; k < 26; k++) { const a = r() * TAU, dd = Math.sqrt(r()); blobs.push([tx + Math.cos(a) * dd * spr, 20 + Math.sin(a) * dd * 11, 5 + r() * 4]); }
        c.fillStyle = rgba('#3a2a08', .35); for (const [bx, by, br] of blobs) { c.beginPath(); c.arc(bx, by + .6, br + .5, 0, TAU); c.fill(); }
        for (const [bx, by, br] of blobs) { c.fillStyle = '#7a5a16'; c.beginPath(); c.arc(bx - br * .1, by + br * .15, br, 0, TAU); c.fill(); }
        for (const [bx, by, br] of blobs) { c.fillStyle = '#c89a2c'; c.beginPath(); c.arc(bx + br * .05, by - br * .1, br * .84, 0, TAU); c.fill(); }
        for (const [bx, by, br] of blobs) if (by < 24) { c.fillStyle = 'rgba(255,226,120,.55)'; c.beginPath(); c.ellipse(bx + br * .28, by - br * .35, br * .52, br * .34, -.3, 0, TAU); c.fill(); }
        for (let k = 0; k < 90; k++) { const a = r() * TAU, dd = Math.sqrt(r()), lx = tx + Math.cos(a) * dd * (spr + 2), ly = 20 + Math.sin(a) * dd * 12, up = ly < 21; c.fillStyle = up ? 'rgba(255,240,170,.7)' : 'rgba(120,84,20,.55)'; c.beginPath(); c.ellipse(lx, ly, .9, .45, r() * 3, 0, TAU); c.fill(); }
      }
      for (const [fx, fy, fw] of [[100, 74, 34], [34, 92, 26], [164, 60, 28]]) { g.rr(fx - fw / 2, fy, fw, 2.4, 1, g.lin(0, fy, 0, fy + 2.4, ['#f4f0e4', '#b8b0a0']), .25); c.strokeStyle = 'rgba(240,236,224,.75)'; c.lineWidth = .35; c.beginPath(); c.moveTo(fx - fw / 2, fy); c.lineTo(fx - fw / 2, fy - 4); c.lineTo(fx + fw / 2, fy - 4); c.lineTo(fx + fw / 2, fy); for (let x = fx - fw / 2 + 3; x < fx + fw / 2; x += 3) { c.moveTo(x, fy); c.lineTo(x, fy - 4); } c.stroke(); c.strokeStyle = 'rgba(120,100,70,.5)'; c.lineWidth = .3; c.beginPath(); c.moveTo(fx - fw / 2 + 2, fy + 2.4); c.lineTo(fx - 2, fy + 6); c.moveTo(fx + fw / 2 - 2, fy + 2.4); c.lineTo(fx + 2, fy + 6); c.stroke(); }
      c.strokeStyle = 'rgba(232,228,214,.75)'; c.lineWidth = .5; c.beginPath(); for (let k = 0; k < 14; k++) { const t = k / 13, yy = 124 - t * 48, xx = 100 + Math.sin(t * Math.PI * 3) * 9; k ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke();
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; let i = 0; for (const [px, py] of [[88, 71], [112, 71], [26, 89], [42, 89], [156, 57], [172, 57], [100, 46]]) { const a = .45 + .25 * Math.sin(gt / 500 + i++); const r = ctx.createRadialGradient(x + px, y + py, 0, x + px, y + py, 6); r.addColorStop(0, `rgba(220,240,255,${a})`); r.addColorStop(1, 'rgba(200,230,255,0)'); ctx.fillStyle = r; ctx.fillRect(x + px - 6, y + py - 6, 12, 12); ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(x + px - .5, y + py - .5, 1, 1); } ctx.restore(); } },
    helm: { w: 170, h: 104, base: 3, k: .5, paint(c, g, T) {
      // Klamm: zerklüftete Felswände mit Schichtung
      const cliff = () => { c.moveTo(0, 104); c.lineTo(0, 44); c.lineTo(10, 36); c.lineTo(20, 40); c.lineTo(30, 30); c.lineTo(46, 52); c.lineTo(58, 26); c.lineTo(70, 12); c.lineTo(80, 4); c.lineTo(92, 18); c.lineTo(104, 40); c.lineTo(116, 22); c.lineTo(132, 14); c.lineTo(150, 30); c.lineTo(170, 56); c.lineTo(170, 104); c.closePath(); };
      g.fill(cliff, g.lin(0, 4, 170, 104, ['#4a5060', '#2e323c', '#1c1f26']), 0);
      c.save(); c.beginPath(); cliff(); c.clip(); c.strokeStyle = 'rgba(10,12,18,.3)'; c.lineWidth = .45; c.beginPath(); for (let i = 0; i < 6; i++) { c.moveTo(0, 34 + i * 11); c.quadraticCurveTo(60, 28 + i * 11 + (i % 2 ? 5 : -4), 170, 38 + i * 11); } c.stroke(); c.strokeStyle = 'rgba(10,12,18,.25)'; c.lineWidth = .4; c.beginPath(); for (let i = 0; i < 6; i++) { const x = 12 + i * 29; c.moveTo(x, 14 + (i % 3) * 8); c.quadraticCurveTo(x + 4, 40, x + 1, 62); } c.stroke(); c.strokeStyle = 'rgba(160,170,190,.18)'; c.lineWidth = .6; c.beginPath(); c.moveTo(80, 4); c.lineTo(70, 40); c.moveTo(132, 14); c.lineTo(126, 50); c.stroke(); c.restore();
      // Felssporn der Hornburg
      const spur = () => { c.moveTo(94, 104); c.lineTo(100, 70); c.lineTo(106, 56); c.lineTo(118, 50); c.lineTo(158, 50); c.lineTo(166, 62); c.lineTo(170, 80); c.lineTo(170, 104); c.closePath(); };
      g.fill(spur, g.lin(94, 0, 170, 0, ['#6e6c66', '#4e4c48', '#36353a']), .35); c.strokeStyle = 'rgba(20,20,24,.4)'; c.lineWidth = .45; c.beginPath(); for (let i = 0; i < 5; i++) { c.moveTo(102 + i * 2, 62 + i * 9); c.lineTo(170, 60 + i * 9 + 3); } c.stroke();
      // Klammwall mit Zinnen, Strebepfeilern und dem Durchlass für den Klammbach
      const wall = g.lin(0, 66, 0, 88, ['#a8a6a0', '#7a7872', '#5a5854']);
      g.rr(0, 68, 104, 18, 0, wall, .35); masonry(c, 0, 68, 104, 18, 2.4, '#2a2826'); crenel(g, c, 0, 68, 104, 2.6, '#8e8c86');
      for (const bx of [14, 38, 70, 94]) g.fill(() => { c.moveTo(bx - 3, 104); c.lineTo(bx - 2, 86); c.lineTo(bx + 2, 86); c.lineTo(bx + 4, 104); c.closePath(); }, g.lin(bx - 3, 0, bx + 4, 0, ['#8a8882', '#5a5854']), .3);
      g.rr(0, 86, 104, 18, 0, g.lin(0, 86, 0, 104, ['#6a6862', '#3e3c3a']), .3); masonry(c, 0, 86, 104, 18, 3, '#1e1c1a', .22);
      g.fill(() => { c.moveTo(48, 104); c.lineTo(48, 94); c.quadraticCurveTo(52, 89, 56, 94); c.lineTo(56, 104); c.closePath(); }, '#0e0e10', 0); c.fillStyle = 'rgba(140,180,210,.6)'; c.fillRect(48.6, 101, 6.8, 3);
      // Rampe zum Tor
      g.fill(() => { c.moveTo(96, 104); c.lineTo(110, 56); c.lineTo(118, 56); c.lineTo(106, 104); c.closePath(); }, g.lin(96, 0, 118, 0, ['#8a8882', '#5e5c58']), .3); c.strokeStyle = 'rgba(30,30,30,.35)'; c.lineWidth = .3; c.beginPath(); for (let i = 1; i < 8; i++) { const t = i / 8; c.moveTo(96 + 14 * t, 104 - 48 * t); c.lineTo(106 + 12 * t, 104 - 48 * t); } c.stroke();
      // Äußere Ringmauer und Bergfried
      g.rr(108, 36, 54, 16, .3, wall, .35); masonry(c, 108, 36, 54, 16, 2.2, '#2a2826'); crenel(g, c, 108, 36, 54, 2.4, '#8e8c86');
      g.fill(() => { c.moveTo(113, 52); c.lineTo(113, 45); c.quadraticCurveTo(116, 41, 119, 45); c.lineTo(119, 52); c.closePath(); }, '#141416', 0);
      g.rr(126, 6, 17, 32, .3, g.lin(126, 0, 143, 0, ['#b8b6b0', '#8a8882', '#5e5c58']), .35); masonry(c, 126, 6, 17, 32, 2.2, '#2a2826'); crenel(g, c, 125.5, 6, 18, 2.3, '#9e9c96');
      g.rr(124.5, 20, 20, 1.2, .2, '#9a9892', .2); for (const wy of [12, 25, 31]) { c.fillStyle = '#121214'; c.fillRect(133.6, wy, 1.6, 3.2); }
      g.limb([[134.5, 3.8], [134.5, -6]], .45, '#5a4a3a', .15); g.fill(() => { const w2 = Math.sin(1) * .6; c.moveTo(134.7, -6); c.quadraticCurveTo(138, -5.6 + w2, 141, -5); c.lineTo(140.4, -3.4); c.quadraticCurveTo(137.6, -3.8 - w2, 134.7, -3.2); c.closePath(); }, '#3f6a3a', .2);
      c.fillStyle = 'rgba(255,170,80,.95)'; for (const [x, y] of [[20, 74], [62, 74], [92, 74], [118, 40], [150, 40], [134, 26]]) c.fillRect(x, y, 1.4, 2);
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [px, py, i] of [[20.7, 75, 0], [62.7, 75, 1], [92.7, 75, 2], [118.7, 41, 3], [150.7, 41, 4], [134.7, 27, 5]]) { const a = .35 + .25 * Math.sin(gt / 120 + i * 2.1), r = ctx.createRadialGradient(x + px, y + py, 0, x + px, y + py, 7); r.addColorStop(0, `rgba(255,160,60,${a})`); r.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = r; ctx.fillRect(x + px - 7, y + py - 7, 14, 14); } ctx.restore(); } },
    weather: { w: 150, h: 100, base: 2, k: .55, paint(c, g, T) {
      // Amon Sûl: kahler Hügel mit Felsterrassen, darauf der zerbrochene Ring des alten Wachturms
      g.fill(() => { c.moveTo(0, 100); c.bezierCurveTo(26, 70, 50, 50, 75, 46); c.bezierCurveTo(100, 50, 124, 70, 150, 100); c.closePath(); }, g.lin(0, 46, 0, 100, ['#4a4e56', '#2e3036', '#1c1e22']), 0);
      c.strokeStyle = 'rgba(10,10,14,.35)'; c.lineWidth = .5; c.beginPath(); for (const [x1, y1, x2, y2] of [[30, 76, 60, 64], [90, 62, 122, 78], [44, 86, 72, 74], [80, 74, 108, 88]]) { c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 3, x2, y2); } c.stroke();
      for (const [x, y, r2] of [[24, 90, 3], [118, 86, 2.6], [40, 80, 2], [104, 76, 2.4]]) g.ell(x, y, r2 * 1.4, r2, g.lin(0, y - r2, 0, y + r2, ['#6a6e76', '#3a3e44']), .25);
      const stn = ['#5a5e66', '#8e929a', '#a8acb4', '#4a4e56'];
      // hinterer Mauerring (dunkler), vordere Bruchstücke
      g.fill(() => { c.moveTo(50, 48); c.lineTo(52, 30); c.lineTo(56, 32); c.lineTo(58, 26); c.lineTo(64, 28); c.lineTo(66, 22); c.lineTo(72, 24); c.lineTo(76, 18); c.lineTo(82, 22); c.lineTo(86, 28); c.lineTo(92, 26); c.lineTo(96, 34); c.lineTo(100, 32); c.lineTo(102, 48); c.closePath(); }, g.lin(50, 0, 102, 0, ['#3a3e46', '#5a5e66', '#3a3e46']), .3);
      masonry(c, 50, 18, 52, 30, 2.4, '#14161a', .35);
      for (const x of [58, 70, 84]) { c.fillStyle = 'rgba(14,14,18,.85)'; c.beginPath(); c.moveTo(x, 44); c.lineTo(x, 37); c.arc(x + 2.5, 37, 2.5, Math.PI, 0); c.lineTo(x + 5, 44); c.fill(); }
      for (const [x, h2, w2] of [[46, 14, 7], [60, 9, 6], [92, 12, 7], [104, 7, 6]]) { g.fill(() => { c.moveTo(x, 50); c.lineTo(x + .5, 50 - h2); c.lineTo(x + w2 * .4, 50 - h2 - 2); c.lineTo(x + w2 * .7, 50 - h2 + 1); c.lineTo(x + w2, 50 - h2 - 1); c.lineTo(x + w2, 50); c.closePath(); }, g.lin(x, 0, x + w2, 0, stn), .3); masonry(c, x, 50 - h2 - 2, w2, h2 + 2, 2, '#1e2024', .4); }
      for (const [x, y, rr2] of [[38, 54, 2], [112, 52, 1.6], [70, 52, 1.4], [86, 54, 1.8]]) g.rr(x, y, rr2 * 2.4, rr2 * 1.4, .4, g.lin(0, y, 0, y + rr2, ['#7a7e86', '#4a4e56']), .25);
    } },
    snow: { w: 170, h: 100, base: 2, k: .55, paint(c, g, T) {
      for (const [x, h2, w2] of [[20, 60, 12], [44, 84, 16], [70, 52, 11], [118, 74, 14], [146, 56, 12]]) g.fill(() => { c.moveTo(x - w2, 100); c.lineTo(x - w2 * .2, 100 - h2); c.lineTo(x + w2 * .3, 100 - h2 * .82); c.lineTo(x + w2, 100); c.closePath(); }, g.lin(x - w2, 0, x + w2, 0, ['#e8f4ff', '#a8c8e8', '#6a8aaa']), .35);
      g.fill(() => { c.moveTo(80, 96); c.quadraticCurveTo(95, 102, 112, 94); c.lineTo(110, 88); c.lineTo(82, 90); c.closePath(); }, '#4a3a2e', .4); g.limb([[96, 90], [94, 58]], 1.2, '#3a2a20', .3); g.limb([[87, 68], [102, 66]], .7, '#3a2a20', .2);
      c.fillStyle = 'rgba(240,248,255,.85)'; c.fillRect(81, 88, 30, 2); c.beginPath(); c.moveTo(94, 58); c.lineTo(96, 56); c.lineTo(97, 60); c.fill();
    } },
    south: { w: 110, h: 120, base: 2, k: .55, paint(c, g, T) {
      // Harad: Wachturm auf einem roten Tafelberg, Balkone, Hörner auf den Zinnen, Signalfeuer oben
      const mesa = () => { c.moveTo(0, 120); c.lineTo(8, 96); c.lineTo(14, 92); c.lineTo(20, 82); c.lineTo(90, 80); c.lineTo(96, 90); c.lineTo(102, 94); c.lineTo(110, 120); c.closePath(); };
      g.fill(mesa, g.lin(0, 80, 0, 120, ['#b07a4a', '#8a5434', '#5a3420']), .4);
      c.save(); c.beginPath(); mesa(); c.clip(); c.strokeStyle = 'rgba(60,28,14,.35)'; c.lineWidth = .5; c.beginPath(); for (let y = 86; y < 120; y += 5) { c.moveTo(0, y); for (let x = 0; x <= 110; x += 10) c.lineTo(x, y + Math.sin(x * .2 + y) * 1.2); } c.stroke(); c.fillStyle = 'rgba(40,18,8,.3)'; c.beginPath(); c.moveTo(70, 80); c.lineTo(90, 80); c.lineTo(110, 120); c.lineTo(78, 120); c.closePath(); c.fill(); c.restore();
      // Turm: verjüngter Sandsteinschaft mit Bändern und Schießscharten
      const tw = () => { c.moveTo(40, 82); c.lineTo(44, 26); c.lineTo(64, 26); c.lineTo(68, 82); c.closePath(); };
      g.fill(tw, g.lin(40, 0, 68, 0, ['#8a6440', '#d8b07c', '#c49868', '#7a5434']), .4); masonry(c, 41, 26, 26, 56, 3, '#4a2e18', .28);
      for (const y of [42, 60]) g.rr(42 - (y - 26) * .07, y, 24 + (y - 26) * .14, 2.2, .4, '#e8c898', .25);
      c.fillStyle = '#1e120a'; for (const [x, y] of [[53, 32], [53, 48], [47, 66], [59, 66]]) { c.fillRect(x, y, 2, 6); c.beginPath(); c.arc(x + 1, y, 1, Math.PI, 0); c.fill(); }
      // Holzbalkon mit Streben
      g.rr(36, 52, 10, 1.6, .3, '#5a3a20', .25); for (const x of [37, 43]) g.limb([[x, 53.6], [45.5, 58]], .45, '#4a2e18', .15); g.rr(62, 36, 10, 1.6, .3, '#5a3a20', .25); g.limb([[70, 37.6], [63, 42]], .45, '#4a2e18', .15);
      // Zinnenkranz mit Hörnern, Feuerschale
      g.rr(41, 22, 26, 4.4, .5, g.lin(0, 22, 0, 26.4, ['#e0bc88', '#a07a50']), .3); crenel(g, c, 42, 22, 25, 2.6, '#c8a070');
      for (const [x, d] of [[41.5, -1], [66.5, 1]]) g.fill(() => { c.moveTo(x, 22); c.quadraticCurveTo(x + d * 4, 18, x + d * 2.5, 12); c.quadraticCurveTo(x + d * 1.5, 17, x - d * 1.4, 21); c.closePath(); }, '#e8dcc0', .3);
      g.fill(() => { c.moveTo(48, 19); c.lineTo(60, 19); c.lineTo(58, 16); c.lineTo(50, 16); c.closePath(); }, '#3a2a1c', .3);
      // Wimpel in Rot und Schwarz
      for (const [x, ln] of [[45, 18], [63, 14]]) { g.fill(() => { c.moveTo(x, 26.5); c.lineTo(x + 3, 26.5); c.lineTo(x + 3, 26.5 + ln); c.lineTo(x + 1.5, 24 + ln); c.lineTo(x, 26.5 + ln); c.closePath(); }, '#9a1c14', .2); c.fillStyle = '#1a0c0a'; c.fillRect(x, 30, 3, 1.6); c.fillRect(x, 26.5 + ln - 6, 3, 1.6); }
      // Lehmhäuser mit Kuppeln am Fuß
      for (const [x, w2, h2, dome] of [[10, 16, 9, 1], [80, 14, 8, 0], [94, 12, 10, 1]]) { const y = 120 - h2; g.rr(x, y, w2, h2, .4, g.lin(x, 0, x + w2, 0, ['#d8b484', '#b08a5a']), .3); if (dome) g.fill(() => { c.moveTo(x + 2, y); c.quadraticCurveTo(x + w2 / 2, y - w2 * .7, x + w2 - 2, y); c.closePath(); }, g.lin(x, y - 8, x + w2, y, ['#f0e0c0', '#c09a68']), .3); else for (let i = 0; i < 3; i++) g.rr(x + 1 + i * 5, y + 1, 1.2, .8, 0, '#5a3a20', 0); c.fillStyle = '#2a1a10'; c.beginPath(); c.moveTo(x + w2 / 2 - 1.6, 120); c.lineTo(x + w2 / 2 - 1.6, 120 - h2 * .5); c.arc(x + w2 / 2, 120 - h2 * .5, 1.6, Math.PI, 0); c.lineTo(x + w2 / 2 + 1.6, 120); c.fill(); }
    }, anim(ctx, x, y, gt) { const f = .7 + .3 * Math.sin(gt / 90) + .1 * Math.sin(gt / 37); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 54, y + 14, 0, x + 54, y + 14, 14 * f); r.addColorStop(0, 'rgba(255,200,90,.9)'); r.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = r; ctx.fillRect(x + 38, y - 2, 32, 32); ctx.fillStyle = 'rgba(255,230,150,.9)'; ctx.beginPath(); ctx.moveTo(x + 50, y + 16); ctx.quadraticCurveTo(x + 52 + Math.sin(gt / 70), y + 8 - f * 3, x + 54, y + 5 - f * 3); ctx.quadraticCurveTo(x + 56, y + 9, x + 58, y + 16); ctx.fill(); ctx.restore(); } },
    rhun: { w: 150, h: 104, base: 2, k: .55, paint(c, g, T) {
      // Rhûn: gestufter Tempel aus rotem Stein mit Mitteltreppe, Säulen, goldener Kuppel und Standarten
      for (let i = 0; i < 5; i++) { const w2 = 120 - i * 22, h2 = 14, x0 = 75 - w2 / 2, y0 = 104 - (i + 1) * h2;
        g.rr(x0, y0, w2, h2, .5, g.lin(0, y0, 0, y0 + h2, ['#b06a44', '#7a4028']), .35); masonry(c, x0, y0 + 2.4, w2, h2 - 2.4, 2.8, '#3a180c', .25);
        g.rr(x0 - 1.2, y0, w2 + 2.4, 2.4, .4, g.lin(0, y0, 0, y0 + 2.4, ['#e0a070', '#9a5a36']), .25);
        c.fillStyle = 'rgba(30,12,6,.6)'; for (let j = 0; j < 4; j++) { const wx = x0 + 6 + j * (w2 - 16) / 3; if (Math.abs(wx + 1.5 - 75) < 8) continue; c.fillRect(wx, y0 + 5, 3, 6); c.beginPath(); c.arc(wx + 1.5, y0 + 5, 1.5, Math.PI, 0); c.fill(); } }
      // Mitteltreppe
      g.fill(() => { c.moveTo(67, 104); c.lineTo(70, 48); c.lineTo(80, 48); c.lineTo(83, 104); c.closePath(); }, g.lin(0, 48, 0, 104, ['#d89a6a', '#9a5a36']), .3); c.strokeStyle = 'rgba(60,24,10,.45)'; c.lineWidth = .3; c.beginPath(); for (let y = 50; y < 104; y += 2.2) { const t = (y - 48) / 56; c.moveTo(70 - t * 3, y); c.lineTo(80 + t * 3, y); } c.stroke();
      // Säulenhalle oben
      g.rr(60, 34, 30, 2, .3, '#d89a6a', .25); for (let i = 0; i < 5; i++) g.rr(61.5 + i * 6.4, 36, 2.2, 12, .3, g.lin(0, 0, 2.2, 0, ['#e8b080', '#9a5a36']), .2);
      g.fill(() => { c.moveTo(63, 34); c.quadraticCurveTo(75, 12, 87, 34); c.closePath(); }, g.lin(63, 16, 87, 34, ['#ffe890', '#d8a030', '#8a5a18']), .35); c.strokeStyle = 'rgba(120,70,10,.5)'; c.lineWidth = .3; c.beginPath(); for (const dx of [-6, -2.5, 2.5, 6]) { c.moveTo(75, 18); c.quadraticCurveTo(75 + dx * 1.4, 26, 75 + dx * 1.7, 34); } c.stroke(); c.strokeStyle = 'rgba(255,250,210,.6)'; c.lineWidth = .6; c.beginPath(); c.arc(75, 34, 9, -2.4, -1.9); c.stroke();
      g.limb([[75, 18], [75, 7]], .6, '#3a2010', .2); g.ell(75, 7, 1.3, 1.3, '#f8d870', .2);
      for (const x of [26, 124]) { g.limb([[x, 92], [x, 50]], .7, '#2a1a10', .2); g.fill(() => { c.moveTo(x, 51); c.lineTo(x + 12, 53); c.lineTo(x + 9, 57.5); c.lineTo(x + 12, 62); c.lineTo(x, 61); c.closePath(); }, g.lin(x, 51, x + 12, 62, ['#b02a1e', '#6a1210']), .25); c.fillStyle = '#e0b040'; c.fillRect(x, 51, 12, .8); g.ell(x, 49.6, 1, 1, '#e0b040', .2); }
    } },
    dolguldur: { w: 170, h: 116, base: 2, k: .55, paint(c, g, T) {
      // Dol Guldur auf Amon Lanc: kahler Hügel mit Felsnasen und toten Bäumen, zerborstene Festung mit Zackentürmen
      const hill = () => { c.moveTo(0, 116); c.quadraticCurveTo(30, 84, 52, 72); c.lineTo(60, 66); c.lineTo(112, 64); c.lineTo(122, 72); c.quadraticCurveTo(146, 86, 170, 116); c.closePath(); };
      g.fill(hill, g.lin(0, 64, 0, 116, ['#262c28', '#141816', '#0a0c0b']), 0);
      c.save(); c.beginPath(); hill(); c.clip(); c.strokeStyle = 'rgba(120,150,120,.12)'; c.lineWidth = .5; c.beginPath(); for (const [x1, y1, x2, y2] of [[40, 82, 28, 100], [60, 74, 52, 96], [118, 76, 132, 98], [100, 72, 108, 92]]) { c.moveTo(x1, y1); c.quadraticCurveTo(x1 - 3, (y1 + y2) / 2, x2, y2); } c.stroke();
        for (const [x, y] of [[34, 92], [128, 90], [70, 84]]) g.fill(() => { c.moveTo(x - 7, y + 3); c.lineTo(x - 4, y - 3); c.lineTo(x + 2, y - 4); c.lineTo(x + 7, y + 3); c.closePath(); }, '#2e3630', .3); c.restore();
      // Treppe hinauf
      c.strokeStyle = 'rgba(70,84,74,.6)'; c.lineWidth = .5; c.beginPath(); for (let i = 0; i < 10; i++) { const y = 112 - i * 4.4, x = 86 + Math.sin(i * .8) * 6; c.moveTo(x - 3, y); c.lineTo(x + 3, y); } c.stroke();
      // Ringmauer mit gebrochenen Zinnen
      const st = g.lin(50, 0, 120, 0, ['#161a18', '#3a423c', '#4a544c', '#1a1e1c']);
      g.fill(() => { c.moveTo(52, 72); c.lineTo(54, 56); c.lineTo(58, 57); c.lineTo(62, 54); c.lineTo(108, 54); c.lineTo(112, 58); c.lineTo(116, 56); c.lineTo(120, 72); c.closePath(); }, st, .4); masonry(c, 53, 54, 66, 18, 2.6, '#080a09', .35);
      for (let x = 55; x < 117; x += 4.4) if ((x * 7 | 0) % 5) g.rr(x, 51.4 - ((x * 13 | 0) % 3) * .5, 2.4, 3, .2, '#2e3630', .2);
      g.fill(() => { c.moveTo(80, 72); c.lineTo(80, 64); c.quadraticCurveTo(86, 58, 92, 64); c.lineTo(92, 72); c.closePath(); }, '#040605', 0);
      // Türme: zentraler Bergfried mit schiefer Spitze, gebrochene Seitentürme, Strebepfeiler
      const tower = (x, w2, top) => { g.fill(() => { c.moveTo(x - w2, 72); c.lineTo(x - w2 * .82, top + 6); c.lineTo(x - w2, top + 2); c.lineTo(x - w2 * .5, top - 3); c.lineTo(x - w2 * .1, top + 2); c.lineTo(x + w2 * .3, top - 5); c.lineTo(x + w2 * .6, top + 1); c.lineTo(x + w2, top - 2); c.lineTo(x + w2 * .82, top + 6); c.lineTo(x + w2, 72); c.closePath(); }, g.lin(x - w2, 0, x + w2, 0, ['#101412', '#3a443e', '#4e5a52', '#141816']), .4); masonry(c, x - w2 * .82, top + 6, w2 * 1.64, 66 - top, 2.8, '#060807', .3); };
      tower(60, 7, 34); tower(112, 7.5, 30);
      g.fill(() => { c.moveTo(74, 72); c.lineTo(76, 20); c.lineTo(73, 16); c.lineTo(97, 16); c.lineTo(94, 20); c.lineTo(96, 72); c.closePath(); }, g.lin(73, 0, 97, 0, ['#0e1210', '#3a443e', '#56625a', '#121614']), .4); masonry(c, 76, 18, 18, 54, 3, '#060807', .3);
      g.fill(() => { c.moveTo(74, 16); c.lineTo(76, 10); c.lineTo(79, 13); c.lineTo(83, 4); c.lineTo(86, 9); c.lineTo(90, -2); c.lineTo(92, 10); c.lineTo(95, 8); c.lineTo(96, 16); c.closePath(); }, g.lin(74, 0, 96, 0, ['#141816', '#4a564e', '#141816']), .35);
      for (const [x, d] of [[74, -1], [96, 1]]) g.fill(() => { c.moveTo(x, 72); c.lineTo(x + d * 6, 72); c.lineTo(x, 44); c.closePath(); }, '#1a1e1c', .3);
      c.fillStyle = 'rgba(4,6,5,.95)'; for (const [wx, wy] of [[84, 24], [84, 36], [80, 48], [89, 48], [58, 44], [112, 40], [68, 62], [102, 62]]) { c.fillRect(wx, wy, 2, 4); c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx + 1, wy - 1.6); c.lineTo(wx + 2, wy); c.fill(); }
      // tote Bäume mit krummen Ästen
      const dead = (x, y, s2, d) => { c.strokeStyle = '#0e1210'; c.lineCap = 'round'; c.lineWidth = 1.4 * s2; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + d * 2 * s2, y - 8 * s2, x - d * s2, y - 16 * s2); c.stroke(); c.lineWidth = .7 * s2; c.beginPath(); c.moveTo(x + d * 1.2 * s2, y - 8 * s2); c.quadraticCurveTo(x + d * 6 * s2, y - 11 * s2, x + d * 8 * s2, y - 16 * s2); c.moveTo(x - d * .4 * s2, y - 12 * s2); c.quadraticCurveTo(x - d * 5 * s2, y - 14 * s2, x - d * 7 * s2, y - 19 * s2); c.moveTo(x - d * s2, y - 16 * s2); c.lineTo(x + d * 2 * s2, y - 21 * s2); c.stroke(); c.lineWidth = .35 * s2; c.beginPath(); c.moveTo(x + d * 6 * s2, y - 13 * s2); c.lineTo(x + d * 9 * s2, y - 12 * s2); c.moveTo(x - d * 5 * s2, y - 16 * s2); c.lineTo(x - d * 8 * s2, y - 15 * s2); c.stroke(); };
      dead(18, 106, 1, 1); dead(36, 96, .8, -1); dead(142, 102, 1, -1); dead(158, 110, .9, 1); dead(128, 92, .7, 1);
      // Nebelbänder am Hang
      for (const [x, y, w2] of [[30, 100, 50], [120, 98, 46], [86, 108, 60]]) { c.fillStyle = g.rad(x, y, w2, ['rgba(140,190,150,.18)', 'rgba(140,190,150,0)']); c.beginPath(); c.ellipse(x, y, w2, 5, 0, 0, TAU); c.fill(); }
    }, anim(ctx, x, y, gt) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [wx, wy] of [[85, 26], [85, 38], [81, 50], [90, 50], [59, 46], [113, 42], [69, 64], [103, 64]]) { const a = .4 + .3 * Math.sin(gt / 400 + wx * 1.7 + wy), r = ctx.createRadialGradient(x + wx, y + wy, 0, x + wx, y + wy, 5); r.addColorStop(0, `rgba(160,255,140,${a})`); r.addColorStop(1, 'rgba(120,255,100,0)'); ctx.fillStyle = r; ctx.fillRect(x + wx - 5, y + wy - 5, 10, 10); ctx.fillStyle = `rgba(200,255,180,${a})`; ctx.fillRect(x + wx - .5, y + wy - 1, 1, 2); } ctx.restore(); } },
    erebor: { w: 170, h: 112, base: 3, k: .55, paint(c, g, T) {
      // Der Einsame Berg: breiter Felsstock mit Nebengipfeln, Felsbändern und Schneerinnen
      const mtn = () => { c.moveTo(0, 112); c.lineTo(10, 96); c.lineTo(20, 90); c.lineTo(28, 76); c.lineTo(36, 72); c.lineTo(44, 56); c.lineTo(52, 50); c.lineTo(58, 36); c.lineTo(66, 30); c.lineTo(72, 18); c.lineTo(78, 14); c.lineTo(84, 4); c.lineTo(90, 8); c.lineTo(96, 6); c.lineTo(102, 16); c.lineTo(110, 22); c.lineTo(116, 20); c.lineTo(124, 34); c.lineTo(132, 40); c.lineTo(140, 58); c.lineTo(150, 66); c.lineTo(158, 86); c.lineTo(170, 112); c.closePath(); };
      g.fill(mtn, g.lin(0, 4, 0, 112, ['#c4b4a0', '#8a7866', '#54463a']), 0);
      c.save(); c.beginPath(); mtn(); c.clip();
      c.fillStyle = 'rgba(28,22,30,.4)'; c.beginPath(); c.moveTo(90, 8); c.lineTo(96, 6); c.lineTo(102, 16); c.lineTo(110, 22); c.lineTo(116, 20); c.lineTo(124, 34); c.lineTo(132, 40); c.lineTo(140, 58); c.lineTo(150, 66); c.lineTo(158, 86); c.lineTo(170, 112); c.lineTo(104, 112); c.quadraticCurveTo(96, 70, 100, 40); c.quadraticCurveTo(94, 24, 90, 8); c.fill();
      // Felsbänder quer über den Hang
      c.strokeStyle = 'rgba(40,30,24,.3)'; c.lineWidth = .6; c.beginPath(); for (const [y0, a] of [[30, 3], [46, 4], [62, 3], [78, 5], [94, 4]]) { c.moveTo(0, y0 + 10); for (let x = 0; x <= 170; x += 10) c.lineTo(x, y0 + Math.sin(x * .09 + y0) * a + (x > 90 ? 4 : 0)); } c.stroke();
      c.strokeStyle = 'rgba(255,240,220,.18)'; c.lineWidth = .4; c.beginPath(); for (const [y0, a] of [[31, 3], [47, 4], [63, 3], [79, 5]]) { for (let x = 20; x <= 88; x += 10) { const y = y0 + 1 + Math.sin(x * .09 + y0) * a; x === 20 ? c.moveTo(x, y) : c.lineTo(x, y); } } c.stroke();
      // Grate und Schluchten (gekrümmt, nicht strahlenförmig)
      c.strokeStyle = 'rgba(24,18,16,.42)'; c.lineWidth = .7; c.beginPath(); for (const [x1, y1, cx, cy, x2, y2] of [[84, 6, 70, 40, 60, 70], [96, 8, 104, 40, 118, 74], [72, 20, 52, 50, 34, 88], [116, 22, 132, 54, 146, 96], [66, 32, 60, 52, 50, 66], [124, 36, 120, 60, 128, 84]]) { c.moveTo(x1, y1); c.quadraticCurveTo(cx, cy, x2, y2); } c.stroke();
      c.restore();
      // Schneekappe mit Rinnen
      g.fill(() => { c.moveTo(70, 22); c.lineTo(78, 14); c.lineTo(84, 4); c.lineTo(90, 8); c.lineTo(96, 6); c.lineTo(102, 16); c.lineTo(110, 22); c.lineTo(104, 24); c.lineTo(102, 32); c.lineTo(98, 24); c.lineTo(94, 30); c.lineTo(90, 20); c.lineTo(86, 34); c.lineTo(83, 22); c.lineTo(78, 28); c.lineTo(76, 22); c.closePath(); }, g.lin(0, 4, 0, 34, ['#ffffff', '#dce4ee']), 0);
      c.fillStyle = 'rgba(150,170,200,.4)'; c.beginPath(); c.moveTo(90, 8); c.lineTo(96, 6); c.lineTo(102, 16); c.lineTo(110, 22); c.lineTo(104, 24); c.lineTo(102, 32); c.lineTo(98, 24); c.lineTo(94, 30); c.lineTo(91, 18); c.closePath(); c.fill();
      // Tornische: glatt behauene Felswand, gestufter Zwergengiebel, Pfeiler
      g.fill(() => { c.moveTo(58, 112); c.lineTo(60, 66); c.lineTo(68, 58); c.lineTo(104, 58); c.lineTo(112, 66); c.lineTo(114, 112); c.closePath(); }, g.lin(58, 0, 114, 0, ['#3e342c', '#6a5c4c', '#7a6a58', '#3e342c']), .45);
      masonry(c, 60, 58, 54, 54, 3.4, '#1a1410', .3);
      g.fill(() => { c.moveTo(66, 66); c.lineTo(66, 61); c.lineTo(72, 61); c.lineTo(72, 56); c.lineTo(78, 56); c.lineTo(78, 51); c.lineTo(94, 51); c.lineTo(94, 56); c.lineTo(100, 56); c.lineTo(100, 61); c.lineTo(106, 61); c.lineTo(106, 66); c.closePath(); }, g.lin(0, 51, 0, 66, ['#a8967e', '#6a5a48']), .35);
      c.strokeStyle = 'rgba(30,22,16,.45)'; c.lineWidth = .35; c.beginPath(); c.moveTo(68, 63.5); c.lineTo(104, 63.5); c.moveTo(74, 58.5); c.lineTo(98, 58.5); c.moveTo(80, 53.5); c.lineTo(92, 53.5); c.stroke();
      for (const x of [66, 102]) { g.rr(x, 66, 4.4, 46, .4, g.lin(x, 0, x + 4.4, 0, ['#5a4c3e', '#9a8a74', '#5a4c3e']), .3); g.rr(x - .6, 66, 5.6, 2, .3, '#8a7a64', .2); g.rr(x - .6, 108, 5.6, 4, .3, '#6a5a48', .2); }
      // Torbogen in Zwergenform (eckig gestuft) mit Tiefe und warmem Schein
      const door = () => { c.moveTo(76, 112); c.lineTo(76, 82); c.lineTo(79, 82); c.lineTo(79, 77); c.lineTo(83, 77); c.lineTo(83, 73); c.lineTo(89, 73); c.lineTo(89, 77); c.lineTo(93, 77); c.lineTo(93, 82); c.lineTo(96, 82); c.lineTo(96, 112); c.closePath(); };
      g.fill(door, g.lin(0, 73, 0, 112, ['#060404', '#1a0e08', '#3a1e0c']), 0); c.strokeStyle = '#a8967e'; c.lineWidth = .9; c.beginPath(); door(); c.stroke();
      c.strokeStyle = 'rgba(255,200,120,.18)'; c.lineWidth = .4; c.beginPath(); for (let i = 0; i < 4; i++) { c.moveTo(78 + i * 5, 112); c.lineTo(80 + i * 4, 90); } c.stroke();
      // Treppe vor dem Tor
      for (let i = 0; i < 3; i++) g.rr(72 - i * 3, 108 + i * 1.4, 28 + i * 6, 1.6, .2, sh('#8a7a64', -i * .12), .2);
      // Zwergenwächter mit Äxten zu beiden Seiten des Tores
      const guard = (gx, dir) => { c.save(); c.translate(gx, 108); c.scale(dir, 1); const st = g.lin(-6, 0, 6, 0, ['#4e4236', '#9a8a74', '#5a4c3e']);
        g.rr(-6.5, -5, 13, 5, .5, '#6a5c4c', .25);
        g.fill(() => { c.moveTo(-5.5, -5); c.lineTo(-6, -24); c.quadraticCurveTo(0, -28, 6, -24); c.lineTo(5.5, -5); c.closePath(); }, st, .3);
        c.strokeStyle = 'rgba(30,22,16,.4)'; c.lineWidth = .3; c.beginPath(); c.moveTo(-2, -24); c.lineTo(-2.5, -5); c.moveTo(2, -24); c.lineTo(2.5, -5); c.moveTo(-5.6, -14); c.lineTo(5.6, -14); c.stroke();
        g.ell(0, -29, 3.6, 3.8, st, .3); g.fill(() => { c.moveTo(-3.4, -28); c.quadraticCurveTo(-3, -17, 0, -15.5); c.quadraticCurveTo(3, -17, 3.4, -28); c.closePath(); }, g.lin(0, -28, 0, -15, ['#8a7a64', '#6a5c4c']), .25);
        c.strokeStyle = 'rgba(30,22,16,.4)'; c.lineWidth = .25; c.beginPath(); for (let k2 = -2; k2 <= 2; k2++) { c.moveTo(k2, -27); c.lineTo(k2 * .6, -17); } c.stroke();
        g.fill(() => { c.moveTo(-4, -30); c.quadraticCurveTo(0, -36.5, 4, -30); c.closePath(); }, '#7a6a56', .25); g.rr(-4.2, -31, 8.4, 1.6, .5, '#8a7a64', .2);
        g.rr(5.4, -42, 1.3, 38, .3, '#3e342a', .2); g.fill(() => { c.moveTo(6, -42); c.quadraticCurveTo(13.5, -44, 12.5, -34); c.quadraticCurveTo(9, -35.5, 6, -35.5); c.closePath(); }, g.lin(6, -42, 13, -34, ['#b0a490', '#7a6c5a']), .25);
        c.restore(); };
      guard(63, 1); guard(109, -1);
      // Fluss Eilend aus dem Tor; kleine Tannen an den Flanken (nicht vor dem Tor)
      c.fillStyle = g.lin(0, 104, 0, 112, ['rgba(130,180,215,.9)', 'rgba(70,120,170,.9)']); c.beginPath(); c.moveTo(96, 112); c.quadraticCurveTo(128, 104, 170, 107); c.lineTo(170, 112); c.closePath(); c.fill(); c.strokeStyle = 'rgba(230,245,255,.5)'; c.lineWidth = .3; c.beginPath(); for (let i = 0; i < 5; i++) { const x = 110 + i * 11; c.moveTo(x, 109 - i * .3); c.lineTo(x + 5, 109 - i * .3); } c.stroke();
      for (const [x, s2] of [[8, 16], [18, 20], [30, 14], [42, 18], [128, 14], [142, 19], [156, 15], [166, 18]]) pine(g, c, x, 112, s2, sh('#2e3a2a', (x % 7) * .02), false);
    }, anim(ctx, x, y, gt) { const a = .22 + .12 * Math.sin(gt / 900); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 86, y + 96, 0, x + 86, y + 96, 18); r.addColorStop(0, `rgba(255,190,90,${a})`); r.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = r; ctx.fillRect(x + 68, y + 78, 36, 34); ctx.restore(); } },
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
      // Elbenschiff: geschwungener Rumpf mit Planken und Goldleiste, Schwanenbug, geblähte Segel, Takelage
      const hull = () => { c.moveTo(8, 50); c.quadraticCurveTo(10, 60, 22, 64); c.quadraticCurveTo(60, 72, 98, 62); c.quadraticCurveTo(108, 58, 112, 50); c.quadraticCurveTo(60, 56, 8, 50); c.closePath(); };
      g.fill(hull, g.lin(0, 50, 0, 70, ['#f4ecdc', '#c8b8a0', '#7a6a58']), .4);
      c.save(); c.beginPath(); hull(); c.clip(); c.strokeStyle = 'rgba(90,70,50,.35)'; c.lineWidth = .35; c.beginPath(); for (let i = 1; i < 5; i++) { c.moveTo(8, 50 + i * 3.2); c.quadraticCurveTo(60, 56 + i * 3.4, 112, 50 + i * 2.6); } c.stroke(); c.restore();
      c.strokeStyle = '#d8b050'; c.lineWidth = .9; c.beginPath(); c.moveTo(10, 52.6); c.quadraticCurveTo(60, 59, 110, 52.6); c.stroke();
      g.fill(() => { c.moveTo(8, 50); c.quadraticCurveTo(2, 44, 6, 36); c.quadraticCurveTo(8, 42, 12, 50.6); c.closePath(); }, '#e0d6c4', .3);
      g.fill(() => { c.moveTo(110, 51); c.quadraticCurveTo(120, 44, 114, 34); c.quadraticCurveTo(110, 28, 114, 24); c.quadraticCurveTo(118, 22, 121, 25); c.lineTo(119, 26); c.quadraticCurveTo(116, 25, 116, 28); c.quadraticCurveTo(122, 38, 114, 52); c.closePath(); }, g.lin(108, 0, 122, 0, ['#e8e0d0', '#ffffff']), .3); g.fill(() => { c.moveTo(120.6, 24.6); c.lineTo(124, 26); c.lineTo(119.4, 26.4); c.closePath(); }, '#d8a030', .2); g.ell(117, 24.6, .5, .5, '#1a1a1a', 0);
      for (const [mx, top, sw] of [[42, 6, 15], [72, 2, 18]]) { g.rr(mx - .9, top, 1.8, 52 - top, .4, g.lin(mx - 1, 0, mx + 1, 0, ['#8a6a4a', '#5a3e28']), .25); g.rr(mx - sw - 1, top + 6, sw * 2 + 2, 1.2, .4, '#6a4e34', .2);
        const sail = () => { c.moveTo(mx - sw, top + 7.2); c.quadraticCurveTo(mx, top + 5, mx + sw, top + 7.2); c.quadraticCurveTo(mx + sw + 5, top + 22, mx + sw - 1, top + 36); c.quadraticCurveTo(mx, top + 33, mx - sw + 1, top + 36); c.quadraticCurveTo(mx - sw + 4, top + 22, mx - sw, top + 7.2); c.closePath(); };
        g.fill(sail, g.lin(mx - sw, 0, mx + sw + 5, 0, ['#cdd2dc', '#ffffff', '#f2f4f8', '#c0c6d2']), .35);
        c.save(); c.beginPath(); sail(); c.clip(); c.strokeStyle = 'rgba(120,130,150,.3)'; c.lineWidth = .3; c.beginPath(); for (let i = -2; i <= 2; i++) { c.moveTo(mx + i * sw * .38, top + 7); c.quadraticCurveTo(mx + i * sw * .42 + 3, top + 22, mx + i * sw * .38, top + 35); } c.stroke(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(mx + sw * .3, top + 18, sw * .3, 9, -.2, 0, TAU); c.fill(); c.restore(); }
      c.strokeStyle = 'rgba(70,50,34,.6)'; c.lineWidth = .3; c.beginPath(); c.moveTo(72, 2); c.lineTo(114, 30); c.moveTo(72, 2); c.lineTo(42, 6); c.moveTo(42, 6); c.lineTo(6, 38); c.moveTo(72, 4); c.lineTo(96, 58); c.moveTo(42, 8); c.lineTo(20, 60); c.stroke();
      g.fill(() => { c.moveTo(72, 2); c.quadraticCurveTo(80, 1, 86, 3.4); c.quadraticCurveTo(80, 4.5, 72, 5.4); c.closePath(); }, '#3a5a9a', .2);
      c.fillStyle = 'rgba(255,220,140,.85)'; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(24 + i * 11, 57.6 + Math.sin(i * .5) * .3, .8, 0, TAU); c.fill(); }
      c.strokeStyle = 'rgba(240,250,255,.7)'; c.lineWidth = .6; c.beginPath(); c.moveTo(16, 66); c.quadraticCurveTo(30, 68, 46, 68.4); c.moveTo(70, 68); c.quadraticCurveTo(90, 67, 104, 62); c.stroke();
    }, anim(ctx, x, y, gt) {} },
    eregion: { w: 140, h: 76, base: 4, k: .68, paint(c, g, T) {
      // Ost-in-Edhil: Terrasse mit zerbrochener Säulenhalle, heile Bögen, schlanker geborstener Turm, Stechpalmen
      g.rr(4, 66, 132, 10, .6, g.lin(0, 66, 0, 76, ['#e0d4bc', '#a89878']), .3); g.rr(8, 62, 124, 4.4, .5, g.lin(0, 62, 0, 66.4, ['#f4ecdc', '#c0b090']), .3); masonry(c, 4, 66, 132, 10, 3, '#5a4a36', .25);
      const col = (x, top, broken) => { g.rr(x - 2.2, top, 4.4, 62 - top, .3, g.lin(x - 2.2, 0, x + 2.2, 0, ['#b8a888', '#fbf4e6', '#d8ccb4', '#a89878']), .3); c.strokeStyle = 'rgba(120,100,80,.35)'; c.lineWidth = .25; c.beginPath(); for (const d of [-1, 0, 1]) { c.moveTo(x + d * 1.1, top + 2); c.lineTo(x + d * 1.1, 61); } c.stroke(); g.rr(x - 3, 60, 6, 2, .3, '#d8ccb4', .2);
        if (broken) g.fill(() => { c.moveTo(x - 2.4, top + 1); c.lineTo(x - 1, top - 1.4); c.lineTo(x + .4, top + .6); c.lineTo(x + 1.4, top - 2.2); c.lineTo(x + 2.4, top + 1); c.closePath(); }, '#e8decc', .25); else g.fill(() => { c.moveTo(x - 3.4, top); c.lineTo(x + 3.4, top); c.lineTo(x + 2.2, top + 2.4); c.lineTo(x - 2.2, top + 2.4); c.closePath(); }, '#f0e6d4', .25); };
      for (const [x, top, br] of [[14, 40, 1], [26, 30, 0], [38, 30, 0], [50, 46, 1], [92, 34, 1], [104, 28, 0], [116, 28, 0], [128, 50, 1]]) col(x, top, br);
      for (const [x1, x2] of [[26, 38], [104, 116]]) { g.rr(x1 - 3.6, 25.6, x2 - x1 + 7.2, 2.6, .3, g.lin(0, 25.6, 0, 28.2, ['#fbf4e6', '#c8b898']), .25); c.strokeStyle = '#e8decc'; c.lineWidth = 1.1; c.beginPath(); c.moveTo(x1 + 2.2, 30); c.quadraticCurveTo((x1 + x2) / 2, 26.6, x2 - 2.2, 30); c.stroke(); }
      g.fill(() => { c.moveTo(16.4, 41); c.lineTo(23, 36); c.lineTo(24, 38); c.lineTo(18, 42); c.closePath(); }, '#d8ccb4', .2); g.rr(52, 58.4, 8, 3.6, .4, '#c8b898', .2); g.rr(132, 59, 5, 3, .4, '#c8b898', .2);
      g.fill(() => { c.moveTo(64, 62); c.lineTo(65.4, 16); c.lineTo(67, 12); c.lineTo(68.6, 8); c.lineTo(70.4, 11); c.lineTo(72, 6); c.lineTo(74.6, 16); c.lineTo(76, 62); c.closePath(); }, g.lin(64, 0, 76, 0, ['#c0b090', '#fbf4e6', '#d8ccb4', '#a89878']), .3);
      c.strokeStyle = 'rgba(120,100,80,.35)'; c.lineWidth = .3; c.beginPath(); for (let y = 22; y < 62; y += 6) { c.moveTo(65.2, y); c.lineTo(74.8, y); } c.stroke();
      c.fillStyle = '#4a3a2a'; for (const y of [22, 34, 46]) { c.beginPath(); c.moveTo(69, y + 5); c.lineTo(69, y + 1.6); c.quadraticCurveTo(70, y, 71, y + 1.6); c.lineTo(71, y + 5); c.fill(); }
      c.fillStyle = 'rgba(60,110,50,.8)'; for (const [x, y0, n] of [[14, 44, 7], [50, 50, 5], [66, 36, 9], [92, 40, 8], [128, 54, 4]]) for (let i = 0; i < n; i++) { c.beginPath(); c.ellipse(x + Math.sin(i * 1.9) * 1.8, y0 + i * 2.4, 1.3, .8, i, 0, TAU); c.fill(); }
      for (const [hx, hy, r2] of [[6, 64, 11], [134, 64, 10]]) { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.ell(hx + Math.cos(a) * r2 * .5, hy - r2 + Math.sin(a) * r2 * .55, r2 * .6, r2 * .52, g.rad(hx, hy - r2 * 1.4, r2 * 1.6, ['#4a7a3a', '#1e4224']), .25); } g.ell(hx, hy - r2 * 1.1, r2 * .6, r2 * .5, '#3a6a32', 0); c.fillStyle = '#c8201a'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(hx + Math.cos(i * 2.3) * r2 * .7, hy - r2 + Math.sin(i * 1.7) * r2 * .6, .7, 0, TAU); c.fill(); } }
    }, anim(ctx, x, y, gt) { const a = .35 + .2 * Math.sin(gt / 420); ctx.save(); ctx.globalCompositeOperation = 'lighter'; const r = ctx.createRadialGradient(x + 70, y + 12, 0, x + 70, y + 12, 14); r.addColorStop(0, `rgba(255,220,150,${a})`); r.addColorStop(1, 'rgba(255,190,90,0)'); ctx.fillStyle = r; ctx.fillRect(x + 56, y - 2, 28, 28); ctx.restore(); } },
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
      // weiche Haufenwolken: jede Quellung mit weichem Rand, beschatteter Unterseite und sonnenbeschienener Kuppe
      const soft = (x, y, rx, ry, col) => { sc.save(); sc.translate(x, y); sc.scale(1, ry / rx); const gr = sc.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, col); gr.addColorStop(.62, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); sc.fillStyle = gr; sc.beginPath(); sc.arc(0, 0, rx, 0, TAU); sc.fill(); sc.restore(); };
      for (const dx of [0, -TW, TW]) { const ox = cx0 + dx, toSun = Math.sign(sunX - ox) || 1;
        for (const [px, py, rr] of puffs) soft(ox + px, cy0 + py + rr * .38, rr * 1.15, rr * .7, cShade);
        for (const [px, py, rr] of puffs) soft(ox + px, cy0 + py, rr * 1.05, rr * .68, cBody);
        for (const [px, py, rr] of puffs) soft(ox + px + toSun * rr * .25, cy0 + py - rr * .25, rr * .7, rr * .42, cLit); }
    }
    // Bergketten mit Licht- und Schattenflanken, Rinnen und natürlicher Schneegrenze
    const ridge = (c, g, base, amp, ks, ph, col, col2, snow, shade = 1) => {
      // Berge mit Graten: zur weichen Grundform kommen spitze Gipfel (gefaltetes Rauschen) und feine Felszacken
      const crag = shade >= .55 && amp >= 12, rid = x => 1 - Math.abs(Math.sin(x * fq(ks[1] * 2 + 1) + ph * 3.1)), rid2 = x => 1 - Math.abs(Math.sin(x * fq(ks[2] + 3) + ph * 1.3));
      const h = x => base - (Math.sin(x * fq(ks[0]) + ph) * amp + Math.sin(x * fq(ks[1]) + ph * 1.7) * amp * .45 + Math.sin(x * fq(ks[2]) + ph) * amp * .14 + Math.sin(x * fq(ks[2] * 3 + 1) + ph * 2.3) * amp * .05 + (crag ? Math.pow(rid(x), 4) * amp * .55 + Math.pow(rid2(x), 6) * amp * .22 + Math.sin(x * fq(97) + ph) * amp * .025 : 0));
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
    for (const dx of [0, -TW]) { for (const [ox, sd] of [[0, 'F'], [256, 'G']]) { mc.save(); mc.translate(dx + ox, 0); forest(mc, mg, key, T, rng(key + sd), HZ); mc.restore(); } mc.save(); mc.translate(dx, 0); props(mc, mg, key, T, rng(key + 'P'), HZ); mc.restore(); mc.save(); mc.translate(dx + 256, 0); props(mc, mg, key, T, rng(key + 'Q'), HZ); mc.restore(); }
    const [ground, gc, gg] = mk(144 - HZ + 2);
    gc.translate(0, -HZ);
    gc.fillStyle = gg.lin(0, HZ, 0, 144, [sh(T.ground, .1), T.ground, T.gd]); gc.fillRect(0, HZ, TW, 144 - HZ + 2);
    const both = (fn) => { fn(0); fn(-TW); fn(TW); };
    // großflächige Hell-Dunkel-Flecken und Horizontdunst für einen natürlichen Boden
    for (let i = 0; i < 46; i++) { const x = R() * TW, y = HZ + 4 + R() * 50, rx = 16 + R() * 40, sy = (.06 + R() * .1) * (1 + (y - HZ) / 40), lt = R() < .5, col = lt ? sh(T.ground, .3) : sh(T.gd, -.35); both(d => { gc.save(); gc.translate(x + d, y); gc.scale(1, sy); gc.fillStyle = gg.rad(0, 0, rx, [rgba(col, .2), rgba(col, 0)]); gc.beginPath(); gc.arc(0, 0, rx, 0, TAU); gc.fill(); gc.restore(); }); }
    gc.fillStyle = gg.lin(0, HZ, 0, HZ + 9, [rgba(T.sky[T.sky.length - 1], .32), rgba(T.sky[T.sky.length - 1], 0)]); gc.fillRect(0, HZ, TW, 9);
    for (let i = 0; i < 520; i++) { const x = R() * TW, y = HZ + 2 + R() * 52, rx = .6 + R() * 2.4 * (y - HZ) / 54, ry = .3 + R() * .5, col = R() < .5 ? rgba(sh(T.gd, -.2), .35) : rgba(sh(T.ground, .25), .3); both(d => { gc.fillStyle = col; gc.beginPath(); gc.ellipse(x + d, y, rx, ry, 0, 0, TAU); gc.fill(); }); }
    // ausgetretener Pfad mit weichen Rändern, Grasbüschel in zwei Tönen und Wildblumen für die grünen Lande
    const green = ['shire', 'rivendell', 'lorien', 'amonhen', 'eregion', 'pelennor', 'helm', 'weather', 'rhun', 'erebor', 'lake'].includes(key);
    if (green) { const py = HZ + 30; for (const d of [0, -TW, TW]) { const pg2 = gc.createLinearGradient(0, py - 9, 0, py + 9); pg2.addColorStop(0, rgba(sh(T.gd, .25), 0)); pg2.addColorStop(.3, rgba(sh('#8a6e4a', 0), .2)); pg2.addColorStop(.7, rgba('#7a6040', .22)); pg2.addColorStop(1, rgba(sh(T.gd, .25), 0)); gc.fillStyle = pg2; gc.beginPath(); gc.moveTo(d, py - 6); for (let x = 0; x <= TW; x += 8) gc.lineTo(d + x, py - 6 + Math.sin(x * .02) * 2.5); for (let x = TW; x >= 0; x -= 8) gc.lineTo(d + x, py + 7 + Math.sin(x * .017 + 1) * 2.5); gc.fill(); }
      for (let i = 0; i < 70; i++) { const x = R() * TW, y = py - 4 + R() * 9; both(d => { gc.fillStyle = rgba('#5a4630', .35); gc.beginPath(); gc.ellipse(x + d, y, .5 + R() * .7, .3, 0, 0, TAU); gc.fill(); }); }
      for (let i = 0; i < 260; i++) { const x = R() * TW, y = HZ + 4 + R() * 50; if (Math.abs(y - py) < 5) continue; const hh = .9 + (y - HZ) / 22, q = R(), dk = R() < .5; both(d => { gc.strokeStyle = dk ? rgba(sh(T.gd, -.35), .55) : rgba(sh(T.ground, .4), .6); gc.lineWidth = .3; gc.beginPath(); for (let b = -1; b <= 1; b++) { gc.moveTo(x + d + b * .4, y); gc.quadraticCurveTo(x + d + b * .6 + q * .3, y - hh * .6, x + d + b * 1.1 + q * .5, y - hh * (.8 + Math.abs(b) * -.2)); } gc.stroke(); }); }
      if (['shire', 'rivendell', 'lorien', 'eregion', 'amonhen'].includes(key)) for (let i = 0; i < 46; i++) { const x = R() * TW, y = HZ + 5 + R() * 48, col = pick2(R, key === 'lorien' ? ['#fff4c0', '#ffe070', '#ffffff'] : ['#ffffff', '#ffe070', '#e8a0d8', '#a8c8ff']), r2 = .35 + (y - HZ) / 110; both(d => { gc.fillStyle = col; for (let k = 0; k < 4; k++) { gc.beginPath(); gc.arc(x + d + Math.cos(k * 1.57) * r2 * .6, y + Math.sin(k * 1.57) * r2 * .4, r2 * .45, 0, TAU); gc.fill(); } gc.fillStyle = '#d8a020'; gc.beginPath(); gc.arc(x + d, y, r2 * .3, 0, TAU); gc.fill(); }); } }
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
