/* ACCE 201 · Unit 1 — Equipment for gas–liquid operations
   Every topic opens with a 3-D mechanism scene + step-by-step walkthrough; design numbers and charts sit below. */
window.T201 = window.T201 || {};
(function () {
  const C = Chem, GAS = 0xe0703f, LIQ = 0x2f7fd8, METAL = 0x9aa3ab, SHELL = 0xa9c4dd, DARK = 0x5d666e, DUST = 0x5a4632, TRACE = 0x8fc3f0;
  const OFF = [0, -999, 0], hsh = (i, k = 7919) => ((i * k) % 997) / 997, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const f = (v, d = 3) => UI.fmt(v, d);
  // follow a polyline [[r,y],...] with parameter u∈[0,1] (equal length weighting) → [r,y]
  const poly = (P, u) => { let L = 0; const seg = []; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(l); L += l; } let d = u * L; for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const k = d / seg[i]; return [P[i][0] + (P[i + 1][0] - P[i][0]) * k, P[i][1] + (P[i + 1][1] - P[i][1]) * k]; } d -= seg[i]; } return P[P.length - 1]; };
  const T = (x, y, s, a = 'start', c = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${s}</text>`;
  const DEFS = '<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="a"/></marker></defs>';
  const arw = (x1, y1, x2, y2, cls = 's') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ar)"/>`;
  let MK = 0; const svg = (el, inner, vb = '0 0 640 300', mh = 360) => { const id = el._mk || (el._mk = 'ar' + (++MK)); el.innerHTML = `<svg class="app flow" viewBox="${vb}" style="width:100%;max-height:${mh}px">${(DEFS + inner).replace('id="ar"', `id="${id}"`).split('url(#ar)').join(`url(#${id})`)}</svg>`; };
  const cards = (el, items) => { el.innerHTML = ''; el.append(UI.h('div', { class: 'grid gA' }, ...items.map(([a, b]) => UI.h('div', { class: 'card pad' }, UI.h('div', { class: 'hint' }, a), UI.h('div', { html: b }))))); };

  /* =====================================================================
     3-D builders. Unit ≈ 0.5 m unless stated. Builders read a live state
     object `st` in their tick functions, so sliders animate without rebuild.
     ===================================================================== */
  const B = {};

  // gallery tower: 5 trays of the chosen type
  B.tray = (v, s, type) => {
    const N = 5, H = 6, sp = H / (N + 1), r = 1;
    v.cyl(r, H + .6, SHELL, [0, H / 2, 0], { op: s.cut ? .14 : .45, ds: 1, open: 1 });
    v.cyl(r * 1.02, .08, METAL, [0, H + .3, 0]); v.cyl(r * 1.02, .08, METAL, [0, -.3, 0]);
    const froth = [], discs = [];
    for (let k = 0; k < N; k++) {
      const y = sp * (k + 1), side = k % 2 ? 1 : -1;
      v.cyl(r * .98, .04, METAL, [0, y, 0], { m: .6 });
      v.box(.04, sp * .72, 1.5, METAL, [side * .62, y - sp * .36 + .02, 0], { m: .6 });
      v.box(.04, .18, 1.5, METAL, [side * .55, y + .09, 0], { m: .6 });
      froth.push(v.box(1.05, .18, 1.6, LIQ, [-side * .04, y + .09, 0], { op: .35 }));
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const p = [i * .3 - side * .04, y, j * .35];
        if (type === 'bubble') { v.cyl(.05, .14, METAL, [p[0], y + .07, p[2]]); v.cyl(.11, .1, DARK, [p[0], y + .17, p[2]]); }
        else if (type === 'valve') { const d = v.cyl(.09, .02, DARK, [p[0], y + .04, p[2]]); d.userData.y0 = y + .04; discs.push(d); }
        else v.cyl(.03, .05, 0x333333, p);
      }
    }
    v.stream(260, .07, GAS, (u, i) => { const x = (((i * 37) % 100) / 100 - .5) * 1.05, z = (((i * 61) % 100) / 100 - .5) * 1.4; return [x, -.2 + u * (H + .4), z]; }, .12 * s.G);
    v.stream(200, .07, LIQ, (u, i) => {
      const seg = u * N, k = Math.floor(seg), q = seg - k, ki = N - 1 - k, y = sp * (ki + 1), side = ki % 2 ? 1 : -1, z = (((i * 53) % 100) / 100 - .5) * 1.4;
      return q < .7 ? [side * (-.8 + 1.6 * q / .7), y + .08, z] : [side * .8, y - (q - .7) / .3 * sp * .9, z];
    }, .06 * s.L);
    v.tick(t => { froth.forEach((m, k) => { m.scale.y = .6 + .6 * s.G + .08 * Math.sin(t * 6 + k); }); discs.forEach(d => { d.position.y = d.userData.y0 + clamp(s.G - .3, 0, 1) * .06; }); });
    v.tag('Vapour in (bottom)', [0, -.5, 1.1]); v.tag('Liquid in (top)', [.8, H + .2, 0]); v.tag('Downcomer', [.62, sp * 3.6, .7]); v.tag('Outlet weir', [-.55, sp * 4 + .2, .7]);
    v.tag({ sieve: 'Sieve tray (holes)', valve: 'Valve tray (lifting discs)', bubble: 'Bubble caps' }[type], [0, sp * 2 + .2, -.7]);
  };
  B.packed = (v, s) => {
    const H = 6; v.cyl(1, H + .6, SHELL, [0, H / 2, 0], { op: s.cut ? .14 : .4, ds: 1, open: 1 });
    for (const [y0, y1] of [[.6, 2.6], [3.2, 5.2]]) {
      v.cyl(.98, .03, METAL, [0, y0 - .05, 0], { m: .6 });
      const rnd = C.rng(y0 * 100 + 3);
      for (let i = 0; i < 160; i++) { const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * .85; v.cyl(.07, .14, 0xc9b79c, [Math.cos(a) * rr, y0 + rnd() * (y1 - y0), Math.sin(a) * rr], { open: 1, ds: 1, rot: [rnd() * 3, rnd() * 3, 0], seg: 10 }); }
    }
    v.cyl(.5, .05, METAL, [0, 5.6, 0]); v.cyl(.5, .05, METAL, [0, 2.95, 0]);
    v.stream(300, .07, LIQ, (u, i) => { const a = i * 2.4, rr = .85 * Math.sqrt(((i * 31) % 97) / 97); return [Math.cos(a) * rr + .05 * Math.sin(u * 40 + i), 5.6 - u * 5.6, Math.sin(a) * rr]; }, .08 * s.L);
    v.stream(240, .07, GAS, (u, i) => { const a = i * 1.7, rr = .9 * Math.sqrt(((i * 17) % 89) / 89); return [Math.cos(a + u * 3) * rr, u * 6, Math.sin(a + u * 3) * rr]; }, .12 * s.G);
    v.tag('Liquid distributor', [0, 5.65, .5]); v.tag('Random packing', [.8, 1.6, .5]); v.tag('Redistributor', [0, 2.95, .5]); v.tag('Support plate', [0, .55, .9]); v.tag('Gas in', [0, -.2, 1]);
  };
  B.spray = (v, s) => sprayLive(v, { G: s.G, L: s.L, dd: 600 });
  B.wetted = (v, s) => wettedLive(v, { G: s.G, L: s.L, dmm: .3 });
  B.venturi = (v, s) => venturiLive(v, { vt: 60 + 30 * s.G, eta: .9, dd: 60, L: s.L });
  B.agitated = (v, s) => stirred(v, { imp: 'rushton', DT: .35, N: 2 * s.L, reg: 'CD', baff: true, vort: 0, gas: s.G });

  /* ---------- tray close-up (one tray section, true mechanism) ---------- */
  const LIM = {
    sieve: { n: 'Sieve tray', w: .45, e: 1.05, f: 1.25, dp: 45, td: '≈ 2 : 1', cost: '1 ×', dev: 'Perforations (holes 3–12 mm)' },
    valve: { n: 'Valve tray', w: .2, e: 1.05, f: 1.25, dp: 55, td: '4–5 : 1', cost: '1.2–1.5 ×', dev: 'Valves (lifting discs on legs)' },
    bubble: { n: 'Bubble-cap tray', w: .08, e: 1.02, f: 1.15, dp: 85, td: '8–10 : 1', cost: '2–3 ×', dev: 'Bubble caps over risers' }
  };
  function trayClose(v, st) {
    const type = st.type, dev = []; [-1.05, -.35, .35, 1.05].forEach(x => [-.55, 0, .55].forEach(z => dev.push([x, z])));
    v.box(3.84, 3.3, .02, SHELL, [0, .25, -1.01], { op: .16 });
    v.box(.05, 3.3, 2, SHELL, [-1.92, .25, 0], { op: .28 }); v.box(.05, 3.3, 2, SHELL, [1.92, .25, 0], { op: .28 });
    v.box(3.2, .05, 2, METAL, [-.05, -.025, 0], { m: .6 });                       // tray deck
    v.box(3.2, .04, 2, METAL, [.05, -1.4, 0], { m: .6, op: .35 });                // tray below (faint)
    v.box(.04, 1.62, 2, METAL, [-1.65, .95, 0], { m: .6 });                      // inlet apron (downcomer from tray above)
    v.box(.25, 1.45, 1.96, LIQ, [-1.785, .82, 0], { op: .22 });                   // liquid in inlet downcomer
    v.box(.04, .2, 2, METAL, [1.5, .1, 0], { m: .6 });                            // outlet weir
    v.box(.04, 1.25, 2, METAL, [1.55, -.6, 0], { m: .6 });                        // outlet apron
    const dcl = v.box(.33, 1, 1.96, LIQ, [1.74, -1, 0], { op: .25 });              // outlet downcomer liquid
    const discs = [];
    for (const [x, z] of dev) {
      if (type === 'sieve') { v.cyl(.07, .012, 0x222222, [x, .004, z]); for (let k = 0; k < 6; k++) v.cyl(.03, .012, 0x333333, [x + .2 * Math.cos(k), .004, z + .2 * Math.sin(k)]); }
      else if (type === 'valve') { v.cyl(.08, .012, 0x222222, [x, .004, z]); discs.push(v.cyl(.14, .022, DARK, [x, .03, z], { m: .7 })); for (let k = 0; k < 3; k++) { const a = k * 2.094; v.box(.016, .17, .016, DARK, [x + .13 * Math.cos(a), .085, z + .13 * Math.sin(a)]); } }
      else { v.cyl(.07, .17, METAL, [x, .085, z], { m: .6 }); v.cyl(.15, .15, DARK, [x, .195, z], { open: 1, ds: 1, m: .6 }); v.cyl(.15, .015, DARK, [x, .27, z], { m: .6 }); for (let k = 0; k < 8; k++) { const a = k * .785; v.box(.02, .05, .02, 0x222222, [x + .152 * Math.cos(a), .145, z + .152 * Math.sin(a)], { rot: [0, -a, 0] }); } }
    }
    const clear = v.box(3.1, 1, 1.96, LIQ, [-.07, .05, 0], { op: .3 }), froth = v.box(3.1, 1, 1.96, LIQ, [-.07, .5, 0], { op: .12 });
    const vap = v.stream(460, .065, GAS, (u, i) => {
      if (hsh(i, 31) > st.Gv) return OFF;
      const [dx, dz] = dev[i % dev.length], a = i * 2.39996;
      if (u < .2) { const k = u / .2; return [dx + Math.cos(a) * .3 * (1 - k), -1.35 + k * 1.35, dz + Math.sin(a) * .3 * (1 - k)]; }
      let k = (u - .2) / .8, y0 = 0, rx = 0;
      if (type === 'valve') { if (k < .12) { const r = .05 + k / .12 * .16; return [dx + Math.cos(a) * r, .03 + st.lift * .5, dz + Math.sin(a) * r]; } rx = .21; y0 = .03 + st.lift * .5; k = (k - .12) / .88; }
      else if (type === 'bubble') { if (k < .1) return [dx, k / .1 * .17, dz]; if (k < .18) return [dx + Math.cos(a) * .11, .17 - (k - .1) / .08 * .05, dz + Math.sin(a) * .11]; if (k < .24) { const r = .11 + (k - .18) / .06 * .12; return [dx + Math.cos(a) * r, .14, dz + Math.sin(a) * r]; } rx = .23; y0 = .14; k = (k - .24) / .76; }
      const top = Math.min(1.85, st.hf + 1), y = y0 + k * (top - y0), w = .05 + .13 * Math.min(1, y / Math.max(st.hf, .05));
      return [dx + Math.cos(a) * rx + w * Math.sin(k * 11 + i), y, dz + Math.sin(a) * rx + w * Math.cos(k * 9 + i)];
    }, .3);
    const liq = v.stream(320, .06, LIQ, (u, i) => {
      const z = (hsh(i, 53) - .5) * 1.8, j = hsh(i, 13);
      if (u < .18) return [-1.78 + (j - .5) * .18, 1.55 - u / .18 * 1.45, z];
      if (u < .82) { const k = (u - .18) / .64; if (st.weep > 0 && hsh(i, 71) < st.weep && k > .3) { const [dx, dz] = dev[i % dev.length], q = (k - .3) / .7; return [dx, -q * 1.35, dz]; } return [-1.65 + k * 3.15, .01 + j * st.hl, z]; }
      if (u < .86) return [1.5 + (u - .82) / .04 * .12, st.hl + .03, z];
      const k = (u - .86) / .14; return [1.74 + (j - .5) * .26, .15 - k * 1.45, z];
    }, .12);
    const ent = v.stream(160, .05, LIQ, (u, i) => { if (hsh(i, 41) > st.ent) return OFF; return [-1.4 + hsh(i, 23) * 2.8 + .1 * Math.sin(u * 8 + i), st.hf + u * st.ej, (hsh(i, 67) - .5) * 1.8]; }, .5);
    v.tick(t => {
      vap.speed = .16 + .26 * st.G; liq.speed = .08 + .05 * st.L; ent.speed = .3 + .3 * st.G;
      clear.scale.y = st.hl; clear.position.y = st.hl / 2; froth.scale.y = st.hf * (1 + .04 * Math.sin(t * 7)); froth.position.y = st.hf / 2;
      dcl.scale.y = st.dc; dcl.position.y = -1.38 + st.dc / 2; discs.forEach(d => d.position.y = .03 + st.lift);
    });
    v.tag('Inlet downcomer (liquid from tray above)', [-1.78, 1.2, 1], 'in'); v.tag(LIM[type].dev, [dev[4][0], .12, dev[4][1] + .3], 'dev'); v.tag('Froth / spray (mass transfer zone)', [0, .35, 1], 'froth');
    v.tag('Outlet weir (sets liquid depth)', [1.5, .2, 1], 'weir'); v.tag('Outlet downcomer (to tray below)', [1.74, -.7, 1], 'dc'); v.tag('Vapour from tray below', [-.3, -.9, 1], 'vin'); v.tag('Vapour to tray above', [.4, 1.7, 1], 'vout');
  }

  /* ---------- tray stack for hydraulics (true scale vertically, k units per metre) ---------- */
  function trayStack(v, st) {
    const k = 2.4, TS = st.TS / 1000 * k, hw = st.hw / 1000 * k, hap = Math.max(.012, (st.hw - 10) / 1000 * k), W = 1.5, dcw = st.dcw * 3, act = W - dcw, Nt = 3;
    v.box(3.04, (Nt + 1.2) * TS, .02, SHELL, [0, (Nt - 1) * TS / 2, -.81], { op: .15 });
    v.box(.04, (Nt + 1.2) * TS, 1.6, SHELL, [-W - .02, (Nt - 1) * TS / 2, 0], { op: .3 }); v.box(.04, (Nt + 1.2) * TS, 1.6, SHELL, [W + .02, (Nt - 1) * TS / 2, 0], { op: .3 });
    v.box(3, .03, 1.6, METAL, [0, -TS, 0], { op: .35 });
    const fr = [], dc = [];
    for (let i = 0; i < Nt; i++) {
      const y = i * TS, sg = i % 2 ? -1 : 1;
      v.box(3 - dcw, .03, 1.6, METAL, [-sg * dcw / 2, y, 0], { m: .6 });
      v.box(.025, hw, 1.6, METAL, [sg * act, y + hw / 2, 0], { m: .6 });
      v.box(.025, TS - hap, 1.6, METAL, [sg * act, y - (TS - hap) / 2, 0], { m: .6 });
      fr.push(v.box(2 * act, 1, 1.56, LIQ, [0, y, 0], { op: .22 }));
      dc.push(v.box(dcw - .03, 1, 1.56, LIQ, [sg * (act + dcw / 2), y - TS, 0], { op: .3 }));
      for (let j = 0; j < 9; j++) v.cyl(.02, .01, 0x333333, [-act + .2 + j * (2 * act - .4) / 8, y + .016, (j % 3 - 1) * .45]);
    }
    const vap = v.stream(380, .055, GAS, (u, i) => { const x = (hsh(i, 37) - .5) * 2 * act * .9, z = (hsh(i, 61) - .5) * 1.4, y = -TS + u * (Nt + .4) * TS; return [x + .05 * Math.sin(u * 30 + i), y, z]; }, .25);
    const liq = v.stream(320, .055, LIQ, (u, i) => {
      const seg = u * Nt, kk = Math.floor(seg), q = seg - kk, ti = Nt - 1 - kk, y = ti * TS, sg = ti % 2 ? -1 : 1, z = (hsh(i, 53) - .5) * 1.4;
      if (st.weep > 0 && hsh(i, 71) < st.weep && q > .3 && q < .7) { const x = sg * (-act + (q - .3) / .4 * act); return [x, y - (q - .3) / .4 * TS * .9, z]; }
      return q < .7 ? [sg * (-act - dcw / 2 + (2 * act + dcw / 2) * q / .7), y + .02 + hsh(i, 13) * st.hlU, z] : [sg * (act + dcw / 2), y - (q - .7) / .3 * TS * .95, z];
    }, .08);
    const ent = v.stream(200, .045, LIQ, (u, i) => { if (hsh(i, 41) > st.ent) return OFF; const ti = i % Nt; return [(hsh(i, 23) - .5) * 2 * act * .9, ti * TS + st.hfU + u * st.ejU, (hsh(i, 67) - .5) * 1.4]; }, .5);
    v.tick(t => {
      vap.speed = .1 + .25 * st.fl; ent.speed = .3 + .3 * st.fl;
      fr.forEach((m, i) => { const hh = st.hfU * (1 + .05 * Math.sin(t * 6 + i)); m.scale.y = hh; m.position.y = i * TS + .015 + hh / 2; });
      dc.forEach((m, i) => { const hh = Math.min(st.dcU, TS + hw); m.scale.y = hh; m.position.y = (i - 1) * TS + .015 + hh / 2; m.material.color.setHex(st.dcU > TS + hw ? 0xd9534f : LIQ); });
    });
    v.tag('Tray spacing', [-W, TS * 1.5, .8], 'ts'); v.tag('Froth on tray', [0, TS + .1, .8], 'froth'); v.tag('Downcomer back-up', [-(act + dcw / 2), .3 * TS, .8], 'dc'); v.tag('Outlet weir', [act, hw, .8], 'weir');
    v.tag('Entrained drops', [-.4, 2 * TS + .5 * TS, .8], 'ent'); v.tag('Weeping (liquid through holes)', [.3, -.5 * TS, .8], 'weep');
    return k;
  }

  /* ---------- stirred tank ---------- */
  function stirred(v, st) {
    const R = 1, H = 2, Ru = st.DT * R, yi = .67;
    v.cyl(R, H + .3, SHELL, [0, (H + .3) / 2, 0], { op: .2, ds: 1, open: 1 }); v.cyl(R, .04, METAL, [0, 0, 0]);
    v.cyl(R * .985, H, LIQ, [0, H / 2, 0], { op: .13, ds: 1 });
    if (st.baff) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .3; v.box(.03, H, .2, METAL, [Math.cos(a) * .88, H / 2 + .1, Math.sin(a) * .88], { rot: [0, -a, 0] }); }
    v.cyl(.025, H + .5, METAL, [0, yi + (H + .5) / 2, 0]); v.box(.4, .25, .3, DARK, [0, H + .85, 0]);
    const imp = new THREE.Group(); imp.position.set(0, yi, 0); v.root.add(imp); v.cyl(.05, .08, METAL, [0, 0, 0], { parent: imp });
    if (st.imp === 'rushton') { v.cyl(.75 * Ru, .015, METAL, [0, 0, 0], { parent: imp }); for (let k = 0; k < 6; k++) { const g = new THREE.Group(); g.rotation.y = k * Math.PI / 3; imp.add(g); v.box(.5 * Ru, .4 * Ru, .02, 0x6a737b, [.75 * Ru, 0, 0], { parent: g }); } }
    else { const nb = st.imp === 'pbt' ? 4 : 3, pitch = st.imp === 'pbt' ? Math.PI / 4 : Math.PI / 6, w = st.imp === 'pbt' ? .35 * Ru : .5 * Ru; for (let k = 0; k < nb; k++) { const g = new THREE.Group(); g.rotation.y = k * 2 * Math.PI / nb; imp.add(g); v.box(.85 * Ru, .02, w, 0x6a737b, [.5 * Ru, 0, 0], { parent: g, rot: [pitch, 0, 0] }); } }
    v.tor(.8 * Ru, .02, METAL, [0, .25, 0]); v.pipe([[.8 * Ru, .25, 0], [.95, .25, 0], [.95, H + .4, 0]], .02, METAL);
    const vort = v.add(new THREE.ConeGeometry(.9, 1, 40, 1, true), v.mat(0xffffff, { op: .25, ds: 1 }), [0, H, 0], [Math.PI, 0, 0]);
    const UP = [[Ru, yi], [.85, yi], [.85, H - .1], [.25, H - .1], [.25, yi + .12]], LO = [[Ru, yi], [.85, yi], [.85, .12], [.25, .12], [.25, yi - .12]], AX = [[.25, H - .1], [.25, yi + .05], [.6, .12], [.85, .12], [.85, H - .1], [.3, H - .1]];
    const trace = v.stream(220, .045, TRACE, (u, i) => {
      const a = i * 2.4 + u * 6 * st.N;
      if (!st.baff) { const r = .2 + .7 * hsh(i, 19), y = .15 + 1.7 * hsh(i, 29); return [Math.cos(a * 2) * r, y, Math.sin(a * 2) * r]; }
      const [r, y] = st.imp === 'rushton' ? poly(i % 2 ? UP : LO, u) : poly(AX, u); return [Math.cos(a) * r, y, Math.sin(a) * r];
    }, .25);
    const bub = v.stream(380, .07, GAS, (u, i) => {
      if (hsh(i, 43) > st.gas) return OFF;
      const a0 = i * 2.39996, sw = u * 4 * st.N * (st.baff ? .4 : 1.2), a = a0 + sw, rs = .8 * Ru; let r, y;
      if (st.reg === 'F' || st.N < .05) { r = rs + .15 * u; y = .25 + u * (H - .25); }
      else if (u < .12) { const q = u / .12; r = rs + (Ru - rs) * q; y = .25 + (yi - .25) * q; }
      else if (u < .3) { const q = (u - .12) / .18; r = Ru + (.86 - Ru) * q; y = yi; }
      else if (st.reg === 'CD' && hsh(i, 7) < .45) { [r, y] = poly([[.86, yi], [.86, .15], [.3, .15], [.3, yi - .1], [.5, H]], (u - .3) / .7); }
      else { const q = (u - .3) / .7; r = .86 - .05 * Math.sin(q * 9); y = yi + q * (H - yi); }
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    }, .3);
    v.tick((t, dt) => { imp.rotation.y += dt * 6 * st.N; trace.speed = .05 + .3 * st.N; bub.speed = .12 + .12 * st.N; const d = st.baff ? 0 : Math.min(1.2, .9 * st.N * st.N); vort.scale.y = Math.max(.001, d); vort.position.y = H - d / 2; vort.visible = d > .02; });
    v.tag({ rushton: 'Rushton turbine (radial flow)', pbt: '45° pitched-blade turbine (axial flow)', prop: 'Marine propeller (axial flow)' }[st.imp], [Ru, yi, 0], 'imp');
    if (st.baff) v.tag('Baffles (T/10) stop swirl & vortex', [.88, 1.6, 0], 'baff'); else v.tag('Vortex (no baffles)', [0, H - .3, 0], 'baff');
    v.tag('Gas sparger ring', [-.8 * Ru, .25, 0], 'sp'); v.tag('Gas bubbles', [-.86, 1.4, .2], 'bub'); v.tag('Motor & gearbox', [0, H + .85, 0], 'mot');
  }

  /* ---------- packed column, live ---------- */
  function packedLive(v, st) {
    const y0 = .5, y1 = 4.3, R = 1;
    v.cyl(R, 5.6, SHELL, [0, 2.6, 0], { op: .16, ds: 1, open: 1 });
    const rnd = C.rng(5); for (let i = 0; i < 260; i++) { const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * .86; v.cyl(.065, .12, 0xa88a62, [Math.cos(a) * rr, y0 + .1 + rnd() * (y1 - y0 - .15), Math.sin(a) * rr], { open: 1, ds: 1, rot: [rnd() * 3, rnd() * 3, 0], seg: 10 }); }
    for (let k = -4; k <= 4; k++) v.box(.03, .05, 2 * Math.sqrt(Math.max(0, 1 - (k / 4.6) ** 2)) * .97, METAL, [k * .21, y0, 0]);       // support grid
    v.box(1.8, .06, .08, METAL, [0, 4.75, 0]); for (let k = -3; k <= 3; k++) v.box(.06, .05, 1.6 * Math.sqrt(1 - (k / 3.8) ** 2), METAL, [k * .25, 4.72, 0]); // ladder distributor
    v.pipe([[0, 4.75, 0], [0, 5.2, 0], [1.4, 5.2, 0]], .06, METAL); v.pipe([[-1.5, .2, 0], [-.6, .2, 0]], .1, METAL); v.pipe([[0, 5.4, 0], [0, 5.9, 0]], .12, METAL);
    const hold = v.cyl(.95, y1 - y0, LIQ, [0, (y0 + y1) / 2, 0], { op: .05, ds: 1 }), pool = v.cyl(.97, 1, LIQ, [0, y1, 0], { op: .35 });
    v.cyl(.97, .3, LIQ, [0, -.05, 0], { op: .3 });
    const L = v.stream(380, .06, LIQ, (u, i) => {
      const a = i * 2.39996 + u * .6, rr = st.poor ? .78 + .18 * hsh(i, 29) : .9 * Math.sqrt(hsh(i, 29)), y = 4.7 - u * 4.85;
      if (st.flood > 0 && y > y1 && y < y1 + st.flood && u < .5) return [Math.cos(a) * rr * .9, y1 + st.flood * hsh(i, 5), Math.sin(a) * rr * .9];
      return [Math.cos(a) * rr + .04 * Math.sin(u * 60 + i), y, Math.sin(a) * rr + .04 * Math.cos(u * 50 + i)];
    }, .1);
    const G = v.stream(300, .065, GAS, (u, i) => { const a = i * 1.7 + u * 4, rr = .9 * Math.sqrt(hsh(i, 17)), y = .2 + u * 5.4; return y < .25 ? OFF : [Math.cos(a) * rr * (y > 5.3 ? .2 : 1), y, Math.sin(a) * rr * (y > 5.3 ? .2 : 1)]; }, .2);
    v.tick(t => { L.speed = .06 + .05 * st.L * (1 - .5 * clamp(st.fl - .7, 0, .5)); G.speed = .1 + .25 * st.fl; hold.material.opacity = .04 + .3 * st.hold; pool.visible = st.flood > .01; pool.scale.y = Math.max(.01, st.flood + .03 * Math.sin(t * 8)); pool.position.y = y1 + pool.scale.y / 2; });
    v.tag('Liquid distributor', [.7, 4.75, 0], 'dist'); v.tag('Random packing (wetted surface)', [.6, 2.6, .4], 'pack'); v.tag('Support plate (open grid)', [-.8, y0, 0], 'sup');
    v.tag('Gas in', [-1.4, .2, 0], 'gin'); v.tag('Gas out', [0, 5.9, 0], 'gout'); v.tag('Liquid in', [1.4, 5.2, 0], 'lin'); v.tag('Liquid pools here at flooding', [0, y1 + .2, .9], 'flood');
  }

  /* ---------- venturi scrubber + cyclonic separator ---------- */
  function venturiLive(v, st) {
    const prof = [[.9, 0], [.9, .5], [.35, 2.1], [.35, 2.7], [.9, 5.4], [.9, 5.8]].map(([r, y]) => new THREE.Vector2(r, y)), x0 = -4.2, yc = 1.5;
    v.add(new THREE.LatheGeometry(prof, 48), v.mat(SHELL, { op: .13, ds: 1 }), [x0, yc, 0], [0, 0, -Math.PI / 2]);
    const rAt = x => { const q = x - x0; return q < .5 ? .9 : q < 2.1 ? .9 - .55 * (q - .5) / 1.6 : q < 2.7 ? .35 : q < 5.4 ? .35 + .55 * (q - 2.7) / 2.7 : .9; }, xt = x0 + 2.4, xs = 2.6;
    v.cyl(.03, .7, METAL, [xt, yc + .7, 0]); v.cyl(.03, .7, METAL, [xt, yc - .7, 0]);
    v.cyl(1.1, 4.2, SHELL, [xs, 1.7, 0], { op: .11, ds: 1, open: 1 });
    v.add(new THREE.ConeGeometry(1.1, 1.1, 40, 1, true), v.mat(SHELL, { op: .11, ds: 1 }), [xs, -.95, 0], [Math.PI, 0, 0]);
    v.cyl(.35, 1.2, SHELL, [xs, 4.3, 0], { op: .2, ds: 1, open: 1 }); v.cyl(.15, .6, METAL, [xs, -1.8, 0], { op: .6 }); v.cyl(.18, .3, DUST, [xs, -1.3, 0], { r2: .45, op: .55 });
    const sep = (k, a0, up) => { const a = a0 + k * 10, y = up ? yc + k * 3.3 : yc - k * 2.2, r = up ? .9 - .55 * clamp((y - 3) / 1, 0, 1) : 1 - .8 * clamp(-y / 1.6, 0, 1); return [xs + Math.cos(a) * r, y, Math.sin(a) * r]; };
    const toSep = (k, i) => [x0 + 5.8 + k * (xs - 1.1 - x0 - 5.8), yc + (hsh(i, 3) - .5) * .5, (hsh(i, 5) - .5) * .5];
    const gas = v.stream(260, .06, GAS, (u, i) => { const a = i * 2.1, q = .85 * Math.sqrt(hsh(i, 29)); if (u < .6) { const x = x0 + u / .6 * 5.8; return [x, yc + Math.cos(a) * rAt(x) * q, Math.sin(a) * rAt(x) * q]; } if (u < .68) return toSep((u - .6) / .08, i); return sep((u - .68) / .32, i, 1); }, .25, { op: .55 });
    const dust = v.stream(300, .12, 0x8a5a2b, (u, i) => {
      const a = i * 2.3, q = Math.sqrt(hsh(i, 31)), cap = hsh(i, 47) < st.eta;
      if (u < .55) { const x = x0 + u / .55 * 5.8; return [x, yc + Math.cos(a) * rAt(x) * .8 * q, Math.sin(a) * rAt(x) * .8 * q]; }
      if (u < .63) return toSep((u - .55) / .08, i);
      return sep((u - .63) / .37, i * 1.3, !cap);
    }, .2);
    const drops = v.stream(320, .06, LIQ, (u, i) => {
      const sd = i % 2 ? 1 : -1;
      if (u < .08) return [xt + (hsh(i, 9) - .5) * .1, yc + sd * (1 - u / .08 * .7), (hsh(i, 11) - .5) * .1];
      if (u < .5) { const k = (u - .08) / .42, x = xt + k * (x0 + 5.8 - xt), a = i * 2.7, r = rAt(x) * .85 * Math.sqrt(hsh(i, 13)); return [x, yc + Math.cos(a) * r * Math.min(1, k * 4) - k * .2, Math.sin(a) * r * Math.min(1, k * 4)]; }
      if (u < .58) return toSep((u - .5) / .08, i);
      return sep((u - .58) / .42, i * 1.7, 0);
    }, .2);
    v.tick(() => { gas.speed = dust.speed = drops.speed = .1 + st.vt / 400; drops.pts.material.size = .05 + clamp(st.dd, 10, 300) / 300 * .1; });
    v.tag('Dirty gas in', [x0, yc, .9], 'in'); v.tag('Converging section (gas accelerates)', [x0 + 1.2, yc + .7, 0], 'conv'); v.tag('Throat 60–120 m/s', [xt, yc - .4, .3], 'throat'); v.tag('Liquid injected at throat', [xt, yc + 1.05, 0], 'inj');
    v.tag('Diverging section (pressure recovery)', [x0 + 4.3, yc + .6, 0], 'div'); v.tag('Cyclonic separator', [xs + 1.1, 1.2, 0], 'sep'); v.tag('Clean gas out', [xs, 4.9, 0], 'out'); v.tag('Slurry (dust + water) out', [xs, -2.1, 0], 'slurry');
  }

  /* ---------- spray tower ---------- */
  function sprayLive(v, st) {
    const H = 6; v.cyl(1, H, SHELL, [0, H / 2, 0], { op: .1, ds: 1, open: 1 });
    for (let i = -1; i <= 1; i++) { v.cyl(.06, .2, METAL, [i * .5, H - .55, 0], { r2: .02 }); v.add(new THREE.ConeGeometry(.12, .12, 16), v.mat(DARK), [i * .5, H - .7, 0], [Math.PI, 0, 0]); }
    v.pipe([[-.6, H - .45, 0], [.6, H - .45, 0], [1.4, H - .45, 0]], .04, METAL);
    for (let k = 0; k < 9; k++) v.box(.03, .3, 1.7, METAL, [-.8 + k * .2, H - .15, 0], { rot: [0, 0, (k % 2 ? 1 : -1) * .5] });
    v.cyl(.98, .35, LIQ, [0, .18, 0], { op: .3 }); v.pipe([[-1.6, .9, 0], [-.9, .9, 0]], .12, METAL);
    const d = v.stream(420, .08, LIQ, (u, i) => { const x0 = ((i % 3) - 1) * .5, a = i * 2.39, sp = Math.min(1, u * 4) * .7; return [x0 + Math.cos(a) * sp * .6, H - .75 - u * (H - 1), Math.sin(a) * sp * .8]; }, .12);
    const g = v.stream(220, .07, GAS, (u, i) => [(hsh(i, 37) - .5) * 1.7, .9 + u * (H - .6), (hsh(i, 59) - .5) * 1.7], .12);
    v.tick(() => { d.speed = .08 + .06 * st.L; g.speed = .08 + .08 * st.G; d.pts.material.size = .03 + clamp(st.dd, 50, 2000) / 2000 * .1; });
    v.tag('Spray nozzles (liquid dispersed as drops)', [.5, H - .7, 0], 'noz'); v.tag('Mist eliminator (chevrons)', [-.8, H - .15, 0], 'mist'); v.tag('Gas in (continuous phase)', [-1.6, .9, 0], 'gin'); v.tag('Liquid out', [0, .1, .9], 'lout');
  }

  /* ---------- wetted-wall column ---------- */
  function wettedLive(v, st) {
    const H = 6, R = .5; v.cyl(R, H, SHELL, [0, H / 2, 0], { op: .12, ds: 1, open: 1 });
    const film = v.cyl(R - .02, H, LIQ, [0, H / 2, 0], { op: .35, ds: 1, open: 1 });
    const fl = v.stream(260, .05, LIQ, (u, i) => { const a = i * .7; return [Math.cos(a) * (R - .03), H - u * H, Math.sin(a) * (R - .03)]; }, .07);
    const g = v.stream(200, .06, GAS, (u, i) => { const a = i * 1.3, rr = .3 * Math.sqrt(hsh(i, 13)); return [Math.cos(a) * rr, u * H, Math.sin(a) * rr]; }, .15);
    v.tick(() => { const k = 1 - clamp(st.dmm, .05, 2) * .08; film.scale.x = film.scale.z = k; fl.speed = .05 + .04 * st.L; g.speed = .08 + .1 * st.G; });
    v.tag('Liquid film on the wall (known area πDZ)', [R, 4, 0], 'film'); v.tag('Gas core', [0, 2, 0], 'core'); v.tag('Liquid in (weir)', [0, H, R], 'lin');
  }

  const KINDS = {
    sieve: ['Sieve-tray tower', 'Gas dispersed in liquid, stage-wise', 'Vapour passes through perforations (3–12 mm) and froths the cross-flowing liquid. Cheap, high capacity; weeps at low gas rate (turndown ≈ 2:1).', 'Distillation, absorption'],
    valve: ['Valve-tray tower', 'Gas dispersed in liquid, stage-wise', 'Each hole is covered by a disc that lifts with vapour flow and drops (seals) at low flow, so it weeps far less than a sieve tray. Turndown 4–5:1 at modest cost.', 'Most new distillation columns'],
    bubble: ['Bubble-cap tray tower', 'Gas dispersed in liquid, stage-wise', 'Risers + caps keep a liquid seal: no weeping, works at very low gas rates; costly and higher ΔP. Turndown up to 10:1.', 'Low-rate or variable-load columns'],
    packed: ['Packed tower', 'Liquid flows as films over packing, gas continuous; differential contact', 'Low pressure drop, good for corrosive/foaming systems and small diameters (< 0.6 m). Needs good liquid distribution.', 'Absorption, vacuum distillation'],
    spray: ['Spray tower', 'Liquid dispersed as drops in gas', 'Very low ΔP, simple, tolerant of solids; but poor efficiency (1–2 stages) due to back-mixing of gas.', 'Gas cooling, very soluble gases (NH₃, HCl)'],
    venturi: ['Venturi scrubber', 'Liquid atomised by high-velocity gas', 'Gas accelerates to 60–120 m/s in the throat and shatters liquid into fine drops: excellent for particulate + soluble gas removal. High ΔP (2–15 kPa).', 'Flue gas, dust and acid-mist cleaning'],
    wetted: ['Wetted-wall column', 'Liquid film on wall, gas core', 'Known, constant interfacial area → used in labs to measure mass-transfer coefficients k_G, k_L.', 'Research, HCl absorbers'],
    agitated: ['Agitated (sparged) vessel', 'Gas dispersed by impeller; single ideal stage approached', 'Turbine shears sparged gas into fine bubbles; well-mixed liquid → behaves as one stage. Used when liquid residence time is long.', 'Fermentation, hydrogenation, aeration']
  };

  /* ---------- tray hydraulics model (sieve tray, Coulson & Richardson / Fair) ---------- */
  function hydraulics(s) {
    const F = s.L / s.V * Math.sqrt(s.rv / s.rl), csb = C.csbFlood(F, s.TS) * Math.pow(s.sig / 20, .2), uf = csb * Math.sqrt((s.rl - s.rv) / s.rv), un = uf * s.ff / 100;
    const An = s.V / s.rv / un, At = An / (1 - s.ad / 100), D = Math.sqrt(4 * At / Math.PI), R = D / 2, Ad = At * s.ad / 100, Aa = At - 2 * Ad, Ah = Aa * s.ah / 100;
    const th = C.bisect(t => (t - Math.sin(t)) / (2 * Math.PI) - s.ad / 100, 1e-6, Math.PI), lw = 2 * R * Math.sin(th / 2), xc = R * Math.cos(th / 2);
    const ld = s.load / 100, Vq = s.V * ld / s.rv, Lm = s.L * ld, u = Vq / An, fl = u / uf;
    const how = 750 * Math.pow(Lm / (s.rl * lw), 2 / 3), hL = s.hw + how, uh = Vq / Ah, hd = 51 * Math.pow(uh / .75, 2) * s.rv / s.rl, hr = 12500 / s.rl, ht = hd + hr + hL;
    const Am = lw * Math.max(.005, (s.hw - 10) / 1000), hdc = 166 * Math.pow(Lm / (s.rl * Am), 2), hb = hL + ht + hdc;
    const K2 = 30.2 + .01 * hL, uhmin = (K2 - .9 * (25.4 - s.dh)) / Math.sqrt(s.rv);
    const Kc = (Vq / Aa) * Math.sqrt(s.rv / (s.rl - s.rv)), phi = Math.exp(-12.55 * Math.pow(Kc, .91)), hf = hL / phi;
    const psi = clamp(.0007 * Math.exp(5.5 * fl) * Math.pow(.1 / Math.max(F, .01), .6), 0, .6);
    const weep = uh < uhmin, jet = fl >= 1, dcf = hb / .5 > s.TS + s.hw;
    const reg = jet ? ['Jet flooding — liquid carried to the tray above', 'bad'] : dcf ? ['Downcomer flooding — back-up exceeds tray spacing', 'bad'] : weep ? ['Weeping — liquid drains through the holes', 'warn'] : psi > .1 ? ['Excessive entrainment (ψ > 0.1)', 'warn'] : ['Normal operation', 'ok'];
    return { F, csb, uf, un, An, At, D, Ad, Aa, Ah, lw, xc, th, u, fl, how, hL, uh, hd, hr, ht, hdc, hb, uhmin, phi, hf, psi, weep, jet, dcf, reg, dcw: (R - xc) / D };
  }
  function planSVG(el, H) {
    const D = H.D, sc = Math.min(170 / D, 95), R = D / 2 * sc, cx = 56 + R, ph0 = 1.75 * sc, yb = 30 + Math.max(2 * R, ph0), cy = yb - R, yc = R * Math.sin(H.th / 2), xc = H.xc * sc, ph = 1.75 * sc, px = cx + R + 140;
    const seg = sg => sg > 0 ? `M${cx + xc},${cy - yc} A${R},${R} 0 0 1 ${cx + xc},${cy + yc} Z` : `M${cx - xc},${cy + yc} A${R},${R} 0 0 1 ${cx - xc},${cy - yc} Z`;
    svg(el, `<circle class="s" cx="${cx}" cy="${cy}" r="${R}"/><path class="lq" d="${seg(1)}"/><path class="lq2" d="${seg(-1)}"/><line class="s" x1="${cx + xc}" y1="${cy - yc}" x2="${cx + xc}" y2="${cy + yc}"/><line class="s" x1="${cx - xc}" y1="${cy - yc}" x2="${cx - xc}" y2="${cy + yc}"/>`
      + Array.from({ length: 60 }, (_, i) => { const a = i * 2.39996, r = Math.sqrt((i + .5) / 60) * Math.min(xc, R * .92) * .92, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .95; return Math.abs(x - cx) < xc - 4 ? `<circle class="pk" cx="${x}" cy="${y}" r="1.6"/>` : ''; }).join('')
      + `<line class="t" x1="${cx - R}" y1="${cy + R + 14}" x2="${cx + R}" y2="${cy + R + 14}"/>` + T(cx, cy + R + 28, 'D = ' + f(H.D, 2) + ' m', 'middle') + T(cx, cy - R - 8, 'active area', 'middle', 'k')
      + `<path class="t" d="M${cx + xc + (R - xc) / 2},${cy} L${cx + R + 14},${cy}"/><path class="t" d="M${cx - xc - (R - xc) / 2},${cy + R * .5} L${cx - xc - (R - xc) / 2},${cy + R + 6}"/>` + T(cx + R + 18, cy + 4, 'outlet downcomer', 'start', 'k') + T(cx - R - 4, cy + R + 4, 'inlet', 'end', 'k')
      + `<circle class="s" cx="${px}" cy="${cy + R - ph + ph * .07}" r="${ph * .07}"/><path class="s" d="M${px},${cy + R - ph * .86} V${cy + R - ph * .45} M${px - ph * .14},${cy + R - ph * .7} H${px + ph * .14} M${px},${cy + R - ph * .45} L${px - ph * .1},${cy + R} M${px},${cy + R - ph * .45} L${px + ph * .1},${cy + R}"/>`
      + T(px, cy + R + 28, 'person 1.75 m', 'middle', 'k') + T(px + 40, 40, 'Top view, to scale', 'start') + T(px + 40, 58, 'weir length ' + f(H.lw, 2) + ' m', 'start', 'k') + T(px + 40, 76, 'hole area ' + f(H.Ah, 3) + ' m²', 'start', 'k'), `0 0 ${Math.max(420, px + 200)} ${yb + 40}`, 300);
  }

  T201.equipment = [
    /* ---------------------------------------------------------------- 1.1 */
    {
      id: 'gallery', title: 'Equipment explorer (3-D)', tags: 'tray tower bubble cap sieve valve packed spray venturi wetted wall agitated vessel 3d stage',
      blurb: 'Walk around eight real contactors and watch gas and liquid flow through them.',
      lead: 'All gas–liquid equipment does one job: create a large interface between the phases and renew it fast. They differ in <i>which phase is dispersed</i> and whether contact is <i>stage-wise</i> or <i>continuous</i>.',
      render(el, UI) {
        const S = UI.sim(el, {
          title: 'Equipment', controls: [
            { k: 'kind', t: 'select', label: 'Contactor', v: 'sieve', opts: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v[0]])) },
            { k: 'G', label: 'Gas / vapour rate', min: .2, max: 2, step: .05, v: 1, unit: '×' }, { k: 'L', label: 'Liquid rate', min: .2, max: 2, step: .05, v: 1, unit: '×' },
            { k: 'cut', t: 'check', label: 'Transparent shell (cut-away)', v: true },
            { t: 'html', html: '<span style="color:#e0703f">●</span> gas / vapour &nbsp; <span style="color:#2f7fd8">●</span> liquid' }],
          views: [{ k: 'v', t: '3d', h: 500, cam: [8, 6.5, 11], target: [0, 2.8, 0] }, { k: 'i', t: 'html' }],
          update(s, V) {
            const K = KINDS[s.kind]; cards(V.i, [['Contact mode', K[1]], ['How it works', K[2]], ['Typical use', K[3]]]);
            const key = s.kind + s.cut + (['venturi', 'agitated', 'spray', 'wetted'].includes(s.kind) ? '' : s.G + s.L);
            if (S._k !== key && V.v.ok) { S._k = key; const v = V.v; v.clear(); ({ sieve: x => B.tray(x, s, 'sieve'), valve: x => B.tray(x, s, 'valve'), bubble: x => B.tray(x, s, 'bubble'), packed: B.packed, spray: B.spray, wetted: B.wetted, venturi: B.venturi, agitated: B.agitated })[s.kind](v, s); }
          }
        });
        UI.sec(el, 'Ideal stage and stage efficiency');
        UI.para(el, `<p>An <b>ideal (equilibrium) stage</b> is one where the leaving gas and liquid are in equilibrium: $y_n = y^*(x_n)$. Real trays don’t have time to reach equilibrium, so we use efficiencies (topic 1.4). Tray towers give <b>stage-wise</b> contact (count stages); packed, spray and wetted-wall columns give <b>continuous (differential)</b> contact (use HTU × NTU or HETP).</p>`);
        el.append(UI.table(['Feature', 'Tray tower', 'Packed tower'], [['Pressure drop / stage', '0.5–1 kPa', '0.1–0.3 kPa (much lower)'], ['Diameter range', '> 0.6 m', 'any; best < 1 m (random)'], ['Liquid hold-up', 'High', 'Low'], ['Foaming / corrosive', 'Poor', 'Good (ceramic/plastic)'], ['Solids / fouling', 'Good (manholes)', 'Poor (plugs)'], ['Side streams, cooling', 'Easy', 'Difficult'], ['Low liquid rate', 'OK', 'Poor wetting']]));
      },
      fx: [['↑ Gas rate', 'more froth & interfacial area → higher efficiency until entrainment, then flooding'], ['↓ Gas rate (sieve)', 'liquid weeps through holes → efficiency drops'], ['↑ Liquid rate', 'higher froth, more downcomer back-up → downcomer flooding'], ['Disperse the phase with the higher resistance', 'e.g. disperse gas (bubbles) when liquid-film resistance controls']],
      quiz: [
        { q: 'Which device has gas as the continuous phase and liquid dispersed?', o: ['Sieve tray', 'Agitated sparged vessel', 'Spray tower', 'Bubble-cap tray'], a: 2, ex: 'In spray towers and venturi scrubbers liquid is broken into drops; on trays and in sparged vessels gas is dispersed as bubbles.' },
        { q: 'A wetted-wall column is mostly used to…', o: ['handle high liquid rates', 'measure mass-transfer coefficients with known area', 'remove dust', 'reduce pressure drop'], a: 1, ex: 'Its interfacial area = πDZ is known exactly, so k can be calculated from measured absorption rates.' }],
      refs: ["<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations).", "<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill.", "<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 14.", "<i>Kister, H.Z.</i> (1992) <i>Distillation Design</i>, McGraw-Hill."]
    },

    /* ---------------------------------------------------------------- 1.2 */
    {
      id: 'tray-types', title: 'Tray types: sieve, valve & bubble-cap', tags: 'tray types sieve valve bubble cap riser weeping entrainment turndown downcomer weir mechanism 3d',
      blurb: 'Zoom into one tray and see how vapour gets through each device — and when it fails.',
      lead: 'A tray is a flat deck that holds a layer of liquid while vapour bubbles up through it. The three classic decks differ only in <b>how the vapour passes through the deck</b>, and that decides how well the tray copes with low and high vapour rates.',
      render(el, UI) {
        const st = { type: 'sieve', G: 1, L: 1, hl: .12, hf: .4, lift: .05, weep: 0, ent: 0, ej: .2, dc: .5, Gv: .7 };
        const S = UI.sim(el, {
          title: 'One tray, close up', controls: [
            { k: 'type', t: 'seg', label: 'Tray type', v: 'sieve', opts: { sieve: 'Sieve', valve: 'Valve', bubble: 'Bubble cap' } },
            { k: 'G', label: 'Vapour rate (× design)', min: .1, max: 1.4, step: .01, v: 1, unit: '×' },
            { k: 'L', label: 'Liquid rate (× design)', min: .3, max: 2, step: .05, v: 1, unit: '×' },
            { t: 'html', html: '<span style="color:#e0703f">●</span> vapour &nbsp; <span style="color:#2f7fd8">●</span> liquid. Slide the vapour rate down to see <b>weeping</b>, up to see <b>entrainment</b> and <b>flooding</b>.' }],
          views: [{ k: 'v', t: '3d', h: 470, cam: [3.4, 2.4, 5.2], target: [0, .2, 0] }, { k: 'w', t: 'html' }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            const Lm = LIM[s.type], G = s.G; Object.assign(st, { G, L: s.L });
            st.hl = .08 + .04 * s.L; st.lift = s.type === 'valve' ? clamp((G - .12) / .6, 0, 1) * .11 : 0;
            st.weep = s.type === 'bubble' ? 0 : G < Lm.w ? Math.min(.7, (Lm.w - G) / Lm.w * (s.type === 'valve' ? .6 : 1.2)) : 0;
            st.hf = st.hl * (1.3 + 2.4 * G); if (G > Lm.f) st.hf = Math.min(1.75, st.hf + (G - Lm.f) * 9);
            const e0 = Lm.e * .85; st.ent = G > e0 ? clamp((G - e0) / (Lm.f - e0), 0, 1) : 0; st.ej = .15 + st.ent * (1.75 - st.hf); st.Gv = clamp(.15 + .65 * G, .1, 1); st.dc = clamp(.25 + .25 * s.L + .2 * G * G + (G > Lm.f ? 1 : 0), .2, 1.3);
            if (S._t !== s.type && V.v.ok) { S._t = st.type = s.type; V.v.clear(); trayClose(V.v, st); V.v.hi(S.hi); }
            const reg = G >= Lm.f ? ['Flooding', 'bad'] : G >= Lm.e ? ['Heavy entrainment', 'warn'] : G < Lm.w ? [s.type === 'valve' ? 'Weeping (valves closing)' : 'Weeping', 'warn'] : ['Stable operation', 'ok'];
            UI.wbar(V.w, [['weeping', .1, Math.max(.1, Lm.w), 'warn'], ['stable operating range', Math.max(.1, Lm.w), Lm.e, 'ok'], ['entrainment', Lm.e, Lm.f, 'c4'], ['flood', Lm.f, 1.4, 'bad']], G, [.1, 1.4]);
            V.ro.set([['Regime', reg[0], reg[1]], ['Turndown ratio', Lm.td], ['Tray ΔP (at design)', '≈ ' + Lm.dp + ' mm liquid'], ['ΔP now (∝ G²)', '≈ ' + f(Lm.dp * (.35 + .65 * G * G), 0) + ' mm'], ['Relative cost', Lm.cost], ['Efficiency', G < Lm.w ? 'falling (bypass)' : G > Lm.e ? 'falling (back-mixing)' : 'high, near design']]);
          }
        });
        UI.walk(el, [
          { t: 'Liquid arrives from the tray above', d: 'Liquid flows down the <b>inlet downcomer</b> and enters under the apron. The downcomer liquid acts as a seal, so vapour cannot short-cut up the downcomer.', hi: ['in'] },
          { t: 'Vapour passes up through the deck', d: '<b>Sieve:</b> straight through round holes. <b>Valve:</b> through a hole, then sideways under a lifting disc. <b>Bubble cap:</b> up a riser, down inside the cap, out through slots below the liquid surface.', hi: ['dev', 'vin'] },
          { t: 'The froth is where mass transfer happens', d: 'Bubbles break up the liquid into a froth with a huge, constantly renewed interface. Here the vapour gives up heavy component and picks up light component (distillation) or gives solute to the liquid (absorption).', hi: ['froth'] },
          { t: 'The outlet weir sets the liquid depth', d: 'Liquid flows across the tray (cross-flow) and spills over the <b>outlet weir</b>. Weir height (typically 40–90 mm) fixes the liquid hold-up and contact time.', hi: ['weir'] },
          { t: 'Downcomer: vapour separates, liquid goes down', d: 'In the <b>outlet downcomer</b> the froth settles, trapped vapour escapes upward, and clear liquid flows to the tray below. The stage is complete.', hi: ['dc', 'vout'] },
          { t: 'Operating limits', d: 'Too little vapour → liquid <b>weeps</b> through the openings (sieve worst, bubble cap never). Too much vapour → drops are <b>entrained</b> to the tray above, then the tray <b>floods</b>. Try the vapour slider.', hi: ['dev', 'froth'] }
        ], (i, st0) => { S.hi = st0.hi; const v = S.V.v; v && v.hi && v.hi(st0.hi); });
        UI.sec(el, 'Comparing tray types');
        el.append(UI.table(['', 'Sieve', 'Valve', 'Bubble cap', 'Dual-flow (no downcomer)'], [
          ['Vapour passage', 'Holes 3–12 mm, 5–15 % of active area', 'Hole + lifting disc (moving) or fixed valve', 'Riser + cap with slots', 'Large holes; liquid and vapour use the same holes'],
          ['Turndown', '≈ 2 : 1', '4–5 : 1', '8–10 : 1', '≈ 1.5 : 1'], ['Weeping', 'Yes at low vapour', 'Little (discs close)', 'None (liquid seal)', 'Designed to weep'],
          ['Capacity', 'High', 'High', 'Lower', 'Very high'], ['Pressure drop', 'Low', 'Moderate', 'High', 'Low'], ['Efficiency', 'High at design', 'High', 'Moderate', 'Lower'], ['Fouling', 'Fair', 'Valves may stick', 'Poor (hard to clean)', 'Good'],
          ['Cost (relative)', '1', '1.2–1.5', '2–3', '< 1'], ['Use', 'Steady loads, fouling-free', 'Default for new columns', 'Very low liquid/vapour rates, need of hold-up', 'Fouling or high-capacity service']]));
        UI.note(el, 'Tray design vocabulary: <b>active (bubbling) area</b>, <b>downcomer</b> (segmental, 10–15 % of area), <b>outlet weir</b>, <b>clearance under the downcomer</b> (weir height − ≈10 mm, so the downcomer stays sealed), <b>calming zones</b> near the weirs, <b>tray spacing</b> 0.3–0.9 m (next topic).');
      },
      fx: [['↓ Vapour rate (sieve)', 'liquid drains through holes — weeping; efficiency falls'], ['↓ Vapour rate (valve)', 'discs drop and close the holes — weeping delayed'], ['↑ Vapour rate', 'froth rises, spray reaches the tray above — entrainment, then flooding'], ['↑ Weir height', 'more liquid hold-up → better contact, higher ΔP'], ['Bubble-cap riser', 'liquid can never drain through → no weeping at any rate']],
      quiz: [
        { q: 'Why does a bubble-cap tray have higher turndown than a sieve tray?', o: ['Larger holes', 'Risers keep a liquid seal so it cannot weep', 'Lower pressure drop', 'No downcomers'], a: 1, ex: 'The riser projects above the liquid, so liquid cannot drain through the vapour passages at low vapour rates.' },
        { q: 'What happens to a valve tray’s discs as the vapour rate falls?', o: ['They lift higher', 'They settle and partially close the holes', 'They rotate', 'Nothing'], a: 1, ex: 'The disc weight closes the opening at low flow, keeping vapour velocity through the remaining opening high and reducing weeping.' },
        { q: 'Which tray is the usual default for a new distillation column?', o: ['Bubble cap', 'Valve', 'Dual-flow', 'Spray'], a: 1 }],
      refs: ["<i>Kister, H.Z.</i> (1992) <i>Distillation Design</i>, McGraw-Hill.", "<i>Lockett, M.J.</i> (1986) <i>Distillation Tray Fundamentals</i>, Cambridge University Press.", "<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 14.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations)."]
    },

    /* ---------------------------------------------------------------- 1.3 */
    {
      id: 'tray-design', title: 'Tray hydraulics: spacing, flooding & tower diameter', tags: 'fair flooding csb flow parameter diameter tray spacing downcomer backup weeping entrainment jet flood weir crest hydraulics',
      blurb: 'See three trays at true spacing, push them to flooding, and size the tower diameter.',
      lead: 'Tower diameter is set by the vapour velocity that would carry liquid to the tray above (<b>flooding</b>). Larger <b>tray spacing</b> allows faster vapour, so a smaller diameter — but a taller tower. Designers operate at 70–85 % of flood and check weeping and downcomer back-up.',
      render(el, UI) {
        const st = { TS: 610, hw: 50, dcw: .15, fl: .8, hfU: .3, dcU: .5, hlU: .1, ent: 0, ejU: .2, weep: 0 };
        let pc, planEl, curHi = null;
        const S = UI.sim(el, {
          title: 'Column & operating point', controls: [
            { k: 'TS', t: 'seg', label: 'Tray spacing (mm)', v: 610, opts: { 300: '300', 450: '450', 610: '610', 760: '760', 900: '900' } },
            { k: 'load', label: 'Actual load (% of design)', min: 20, max: 140, step: 1, v: 100, unit: '%' },
            { k: 'hw', label: 'Weir height $h_w$', min: 25, max: 90, step: 1, v: 50, unit: 'mm' },
            { t: 'sep', label: 'Design basis' },
            { k: 'V', label: 'Vapour flow $V$', min: .2, max: 30, step: .1, v: 5, unit: 'kg/s' }, { k: 'L', label: 'Liquid flow $L$', min: .1, max: 60, step: .1, v: 4, unit: 'kg/s' },
            { k: 'rv', label: 'Vapour density $\\rho_V$', min: .3, max: 60, step: .1, v: 2.9, unit: 'kg/m³' }, { k: 'rl', label: 'Liquid density $\\rho_L$', min: 500, max: 1200, step: 5, v: 800, unit: 'kg/m³' },
            { k: 'sig', label: 'Surface tension $\\sigma$', min: 5, max: 75, step: .5, v: 20, unit: 'mN/m' },
            { k: 'ff', label: 'Design % of flooding', min: 50, max: 95, step: 1, v: 80, unit: '%' }, { k: 'ad', label: 'Downcomer area $A_d/A_T$', min: 6, max: 25, step: 1, v: 12, unit: '%' },
            { k: 'ah', label: 'Hole area $A_h/A_a$', min: 5, max: 15, step: .5, v: 10, unit: '%' }, { k: 'dh', label: 'Hole diameter', min: 3, max: 12, step: .5, v: 5, unit: 'mm' }],
          views: [{ k: 'v', t: '3d', h: 470, cam: [3.6, 2.6, 5.6], target: [0, 1.4, 0] }, { k: 'w', t: 'html' }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            const H = hydraulics(s), k = 2.4;
            Object.assign(st, { fl: H.fl, hfU: Math.min(H.hf, s.TS) / 1000 * k, hlU: H.hL / 1000 * k * .6, dcU: H.hb / .5 / 1000 * k, ent: clamp((H.fl - .6) / .45, 0, 1) * (H.jet ? 1 : .7), weep: H.weep ? clamp((H.uhmin - H.uh) / H.uhmin * 2, .1, .7) : 0 });
            st.ejU = H.jet ? Math.max(.1, s.TS / 1000 * k - st.hfU) : (s.TS / 1000 * k - st.hfU) * clamp((H.fl - .6) / .4, .05, .9);
            const key = s.TS + '|' + s.hw + '|' + Math.round(H.dcw * 100);
            if (S._k !== key && V.v.ok) { S._k = key; Object.assign(st, { TS: s.TS, hw: s.hw, dcw: H.dcw }); V.v.clear(); trayStack(V.v, st); V.v.hi(curHi); if (S._ts !== s.TS) { S._ts = s.TS; const c = s.TS / 1000 * 2.4; V.v.look([3 + 2 * c, 1.6 + 1.5 * c, 5 + 3.4 * c], [0, .85 * c, 0]); } }
            const fw = H.uhmin / H.uh * s.load, fj = s.load / H.fl, fd = s.load * Math.sqrt((s.TS + s.hw) / (H.hb / .5));
            UI.wbar(V.w, [['weep', 20, clamp(fw, 20, 140), 'warn'], ['stable', clamp(fw, 20, 140), clamp(Math.min(fj * .85, fd), 20, 140), 'ok'], ['entrain', clamp(Math.min(fj * .85, fd), 20, 140), clamp(Math.min(fj, fd), 20, 140), 'c4'], ['flood', clamp(Math.min(fj, fd), 20, 140), 140, 'bad']], s.load, [20, 140]);
            V.ro.set([['Regime', H.reg[0], H.reg[1]], ['<b>Column diameter</b>', f(H.D, 3) + ' m', 'ok'], ['% of flooding now', f(100 * H.fl, 1) + ' %', H.fl > 1 ? 'bad' : H.fl > .85 ? 'warn' : 'ok'], ['Flooding velocity $u_{fl}$', f(H.uf, 3) + ' m/s'], ['Hole velocity / weep point', f(H.uh, 2) + ' / ' + f(H.uhmin, 2) + ' m/s', H.weep ? 'warn' : 'ok'],
              ['Froth height $h_f$', f(H.hf, 0) + ' mm'], ['Downcomer back-up (aerated)', f(H.hb / .5, 0) + ' / ' + (s.TS + s.hw) + ' mm', H.dcf ? 'bad' : 'ok'], ['Entrainment ψ', f(H.psi, 3), H.psi > .1 ? 'warn' : 'ok'], ['Tray ΔP $h_t$', f(H.ht, 0) + ' mm liquid']]);
            if (pc) { const p = pc.frame({ x: [.01, 2], y: [.005, .2], logx: 1, logy: 1, xl: 'Flow parameter F_LV', yl: 'C_SB,flood (m/s), σ = 20 mN/m', xs: 'F', ys: 'C' });
              [[300, 'c2'], [450, 'c3'], [610, 'c1'], [760, 'c4'], [900, 'c5']].forEach(([ts, c]) => p.fn(q => C.csbFlood(q, ts), .01, 2, { c, w: ts == s.TS ? 2.6 : 1.2, logx: 1, l: ts + ' mm' })); p.pts([[H.F, C.csbFlood(H.F, s.TS)]], { c: 'tx', r: 5 }); p.done(); }
            if (planEl) planSVG(planEl, H);
            if (S.calc) S.calc.innerHTML = `<table class="t"><tr><th>Quantity</th><th class="n">Value</th><th>Formula</th></tr>${[['F_LV', f(H.F, 3), '(L/V)√(ρV/ρL)'], ['C_SB (σ-corrected)', f(H.csb, 4) + ' m/s', 'Fair chart × (σ/20)^0.2'], ['u_fl', f(H.uf, 3) + ' m/s', 'C_SB √((ρL−ρV)/ρV)'], ['Net area A_n', f(H.An, 3) + ' m²', 'Q_V / (f·u_fl)'], ['Total area A_T', f(H.At, 3) + ' m²', 'A_n / (1 − A_d/A_T)'], ['Active area A_a', f(H.Aa, 3) + ' m²', 'A_T − 2A_d'], ['Weir length l_w', f(H.lw, 3) + ' m', 'chord of the downcomer segment'], ['Weir crest h_ow', f(H.how, 1) + ' mm', '750 [L_w/(ρL l_w)]^(2/3)'], ['Dry-plate ΔP h_d', f(H.hd, 1) + ' mm', '51 (u_h/C₀)² ρV/ρL, C₀ = 0.75'], ['Residual head h_r', f(H.hr, 1) + ' mm', '12 500/ρL'], ['Downcomer loss h_dc', f(H.hdc, 1) + ' mm', '166 [L_wd/(ρL A_m)]²'], ['Back-up h_b', f(H.hb, 0) + ' mm', 'h_w + h_ow + h_t + h_dc'], ['Weep-point u_h,min', f(H.uhmin, 2) + ' m/s', '[K₂ − 0.90(25.4 − d_h)]/√ρV']].map(r => `<tr><td>${r[0]}</td><td class="n">${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</table>`;
          }
        });
        UI.walk(el, [
          { t: 'Tray spacing', d: 'The vertical gap between trays (0.3–0.9 m; 0.6 m common, ≥ 0.45 m for manhole access). It must hold the froth plus a disengaging space so drops fall back before reaching the tray above.', hi: ['ts'], set: { load: 100 } },
          { t: 'Jet (entrainment) flooding', d: 'As vapour velocity rises the froth expands and throws drops upward. When spray reaches the tray above, liquid is recycled upward, hold-up builds and the column floods. This limit sets the <b>diameter</b>.', hi: ['ent', 'froth'], set: { load: 128 } },
          { t: 'Downcomer back-up flooding', d: 'Liquid in the downcomer must overcome the tray pressure drop plus the head over the weir. If the aerated back-up exceeds tray spacing + weir height, liquid backs onto the tray above.', hi: ['dc'], set: { load: 115 } },
          { t: 'Weeping at low load', d: 'If the hole velocity falls below the weep point, the vapour can no longer hold the liquid up and it drains through the holes, bypassing contact.', hi: ['weep'], set: { load: 35 } },
          { t: 'Sizing the diameter', d: 'Choose a fraction of flooding (≈ 80 %), compute the net area from the vapour volumetric flow, add the downcomer areas and get $D$. The top view (below) shows the result at true scale next to a person.', hi: [], set: { load: 100 } }
        ], (i, x) => { curHi = x.hi.length ? x.hi : null; S.V.v.hi && S.V.v.hi(curHi); if (x.set) for (const k in x.set) S.set(k, x.set[k]); });
        UI.sec(el, 'Tower diameter — true scale');
        planEl = UI.h('div', { class: 'card pad' }); el.append(planEl);
        const m = UI.more(el, 'Design calculation (Fair flooding + sieve-tray hydraulics)');
        S.calc = UI.h('div', { class: 'tw' }); m.append(S.calc);
        UI.note(m, '<b>Procedure (Fair method):</b> 1) $F_{LV}$; 2) $C_{SB}$ for the chosen tray spacing; 3) σ-correction; 4) $u_{flood}$; 5) choose % flood (≈80 %, 75 % if foaming); 6) $A_n = Q_V/u_n$; 7) add downcomer area; 8) $D$. Then check weeping (hole velocity), downcomer back-up, entrainment. Check both top and bottom of the column and use the larger diameter.');
        pc = UI.plotIn(m, 320); S.run();
      },
      eqs: [
        { n: 'Flow parameter', m: 'F_{LV}=\\frac{L}{V}\\sqrt{\\frac{\\rho_V}{\\rho_L}}', w: 'L, V mass flow rates' },
        { n: 'Fair flooding (Lygeros–Magoulas fit)', m: 'C_{SB}=0.0105+8.127\\times10^{-4}\\,TS^{0.755}e^{-1.463F_{LV}^{0.842}}', w: 'TS in mm, C in m/s, σ = 20 mN/m' },
        { n: 'Flooding velocity (Souders–Brown)', m: 'u_{fl}=C_{SB}\\left(\\frac{\\sigma}{20}\\right)^{0.2}\\sqrt{\\frac{\\rho_L-\\rho_V}{\\rho_V}}' },
        { n: 'Diameter', m: 'D=\\sqrt{\\frac{4}{\\pi}\\frac{Q_V}{f\\,u_{fl}\\,(1-A_d/A_T)}}', w: 'f = fraction of flood' },
        { n: 'Downcomer back-up', m: 'h_b=h_w+h_{ow}+h_t+h_{dc}\\;<\\;0.5\\,(TS+h_w)' },
        { n: 'Weep point (Eduljee)', m: 'u_{h,min}=\\frac{K_2-0.90(25.4-d_h)}{\\rho_V^{1/2}}' }],
      fx: [['↑ Tray spacing', '↑ C_SB → ↑ allowed velocity → ↓ diameter, but ↑ height'], ['↑ Vapour load', 'froth and spray rise → entrainment → jet flooding'], ['↑ Liquid load', '↑ weir crest and downcomer back-up → downcomer flooding'], ['↓ Load (turndown)', 'hole velocity falls below weep point → weeping'], ['↑ Vapour density (high pressure)', '↓ u_flood, but mass capacity ρ_V·u rises'], ['Foaming system', 'design at lower % flood and larger downcomers']],
      quiz: [{ q: 'Operating a column at 100 % of flooding velocity would…', o: ['give the best efficiency', 'cause liquid to be carried up and the column to fill with liquid', 'cause weeping', 'reduce pressure drop'], a: 1, ex: 'Entrainment grows sharply near flood; liquid accumulates and ΔP rises steeply.' },
        { q: 'Doubling the vapour volumetric rate at fixed C_SB changes the diameter by a factor of…', o: ['2', '√2', '4', '1/√2'], a: 1, ex: 'Area ∝ Q_V, so D ∝ √Q_V.' },
        { q: 'Downcomer back-up is mainly increased by…', o: ['lower liquid rate', 'higher tray pressure drop and liquid rate', 'larger tray spacing', 'smaller holes only'], a: 1 }],
      refs: ["<i>Fair, J.R.</i> (1961) How to predict sieve tray entrainment and flooding. <i>Petro/Chem Engineer</i> 33(10), 45–52.", "<i>Lygeros, A.I. & Magoulas, K.G.</i> (1986) Column flooding and entrainment. <i>Hydrocarbon Processing</i> 65(12), 43–44. (curve fit to Fair’s C<sub>SB</sub> chart)", "<i>Bennett, D.L., Agrawal, R. & Cook, P.J.</i> (1983) New pressure drop correlation for sieve tray distillation columns. <i>AIChE J.</i> 29, 434–442. (clear-liquid height)", "<i>Kister, H.Z.</i> (1992) <i>Distillation Design</i>, McGraw-Hill.", "<i>Towler, G. & Sinnott, R.</i> (2013) <i>Chemical Engineering Design</i>, 2nd ed., Butterworth-Heinemann, Ch. 17.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations)."]
    },

    /* ---------------------------------------------------------------- 1.4 */
    {
      id: 'tray-eff', title: 'Point, Murphree & overall tray efficiency', tags: 'murphree point efficiency overall oconnell lewis colburn entrainment stage efficiency',
      blurb: 'From a single point on a tray to the whole column — Lewis, Colburn and O’Connell.',
      lead: 'Efficiency links ideal stages (theory) to real trays (hardware). There are three levels: the <b>point efficiency</b> $E_{OG}$ at one spot, the <b>Murphree tray efficiency</b> $E_{MV}$ for a whole tray, and the <b>overall efficiency</b> $E_O = N_{ideal}/N_{real}$ for the column.',
      render(el, UI) {
        const vis = UI.h('div', { class: 'card pad' }); el.append(vis);
        UI.sim(el, {
          title: 'Tray conditions', controls: [
            { k: 'eog', label: 'Point efficiency $E_{OG}$', min: .2, max: 1, step: .01, v: .7 },
            { k: 'lam', label: 'Stripping factor $\\lambda = mV/L$', min: .2, max: 3, step: .05, v: 1.2 },
            { k: 'mix', t: 'seg', label: 'Liquid on the tray', v: 'plug', opts: { mixed: 'Fully mixed', plug: 'Plug flow' } },
            { k: 'psi', label: 'Fractional entrainment $\\psi$', min: 0, max: .4, step: .01, v: .05 },
            { t: 'sep', label: 'Overall (O’Connell)' },
            { k: 'alpha', label: 'Relative volatility $\\alpha$', min: 1.1, max: 10, step: .1, v: 2.5 }, { k: 'mu', label: 'Liquid viscosity $\\mu_L$', min: .05, max: 2, step: .01, v: .3, unit: 'cP' },
            { k: 'Nid', label: 'Ideal stages needed', min: 2, max: 60, step: 1, v: 12 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 340 }, { k: 'q', t: 'plot', row: 'r', h: 340 }],
          update(s, V) {
            const emv = C.lewisEMV(s.eog, s.lam, s.mix), ea = C.colburn(emv, s.psi), eoL = Math.abs(s.lam - 1) < 1e-6 ? ea : Math.log(1 + ea * (s.lam - 1)) / Math.log(s.lam), eoc = C.oconnell(s.alpha, s.mu);
            V.ro.set([['Murphree $E_{MV}$', f(emv, 3), emv > 1 ? 'ok' : ''], ['With entrainment $E_a$', f(ea, 3)], ['Overall (Lewis) $E_O$', f(eoL, 3)], ['Overall (O’Connell)', f(eoc, 3)], ['Real trays (O’Connell)', Math.ceil(s.Nid / eoc) + ''], ['Real trays (Lewis)', Math.ceil(s.Nid / eoL) + '']]);
            // tray picture: liquid composition changing across a plug-flow tray, vapour enrichment at each point
            const y1 = .3, xs = [...Array(9)].map((_, i) => i / 8), yo = xs.map(q => { const xl = s.mix === 'mixed' ? .5 : .75 - .5 * q, ys = Math.min(.95, 1.4 * xl); return y1 + s.eog * (ys - y1); });
            vis.innerHTML = `<svg class="app flow" viewBox="0 0 640 170" style="width:100%;max-height:200px">${DEFS}<rect class="lq" x="70" y="80" width="460" height="40"/><rect class="s" x="70" y="80" width="460" height="40"/>`
              + xs.map((q, i) => { const x = 90 + q * 420, c = Math.round(255 * (yo[i] - .3) / .7); return arw(x, 150, x, 124, 't') + `<circle cx="${x}" cy="62" r="9" style="fill:rgb(${200 + c * .2},${120 - c * .3},${60})"/>` + arw(x, 76, x, 50, 't'); }).join('')
              + T(30, 104, 'L in', 'middle') + T(575, 104, 'L out', 'middle') + T(320, 20, s.mix === 'mixed' ? 'Mixed liquid: every point sees the same x → E_MV = E_OG' : 'Plug-flow liquid: x falls across the tray, vapour leaving is richer near the inlet → E_MV > E_OG', 'middle') + T(320, 166, 'vapour enters uniform (y_{n+1}); dot colour = local vapour leaving', 'middle', 'k') + '</svg>';
            const p = V.p.frame({ x: [0, 3], y: [0, 2], xl: 'λ = mV/L', yl: 'E_MV', xs: 'λ', ys: 'E' });
            [.4, .6, .8, 1].forEach((e, i) => p.fn(l => C.lewisEMV(e, l, 'plug'), .01, 3, { c: ['c2', 'c3', 'c4', 'c5'][i], w: 1.3, l: 'E_OG=' + e + ' plug' }));
            p.fn(l => C.lewisEMV(s.eog, l, s.mix), .01, 3, { c: 'c1', w: 3, l: 'current' }); p.pts([[s.lam, emv]], { c: 'tx', r: 5 }); p.done();
            const a = s.alpha, eq = x => a * x / (1 + (a - 1) * x), op = x => .65 * x + .3, E = ea;
            const q = V.q.frame({ x: [0, 1], y: [0, 1], xl: 'x (liquid)', yl: 'y (vapour)' });
            q.fn(eq, 0, 1, { c: 'c1', l: 'equilibrium y*' }); q.fn(op, 0, 1, { c: 'c2', l: 'operating line' }); q.fn(x => op(x) + E * (eq(x) - op(x)), 0, 1, { c: 'c3', dash: [5, 4], l: 'pseudo-equilibrium (E_MV)' }); q.fn(x => x, 0, 1, { c: 'mu', w: 1 });
            const xn = .4, y1b = op(xn), ys = eq(xn), yn = y1b + E * (ys - y1b);
            q.line([[xn, y1b], [xn, ys]], { c: 'mu', w: 1, dash: [2, 3] }); q.pts([[xn, y1b], [xn, ys], [xn, yn]], { c: 'tx' });
            q.text(xn, y1b, '  yₙ₊₁', { bl: 'top' }); q.text(xn, ys, '  y*ₙ', {}); q.text(xn, yn, '  yₙ (actual)', { bl: 'middle', c: 'c3' }); q.done();
          }
        });
        UI.note(el, 'With plug-flow liquid and large λ, $E_{MV}$ can exceed 1 because liquid composition changes across a long tray. Entrainment always reduces efficiency: liquid carried up remixes with the tray above.');
      },
      eqs: [
        { n: 'Murphree vapour efficiency', m: 'E_{MV}=\\frac{y_n-y_{n+1}}{y_n^*-y_{n+1}}' },
        { n: 'Point efficiency', m: 'E_{OG}=\\frac{y_{local}-y_{in}}{y^*_{local}-y_{in}}=1-e^{-N_{OG}}' },
        { n: 'Lewis (plug-flow liquid, mixed vapour)', m: 'E_{MV}=\\frac{e^{\\lambda E_{OG}}-1}{\\lambda},\\quad \\lambda=\\frac{mV}{L}' },
        { n: 'Colburn entrainment correction', m: 'E_a=\\frac{E_{MV}}{1+E_{MV}\\,\\psi/(1-\\psi)}' },
        { n: 'Overall from Murphree (Lewis)', m: 'E_O=\\frac{\\ln[1+E_{MV}(\\lambda-1)]}{\\ln\\lambda}' },
        { n: 'O’Connell correlation', m: 'E_O=0.492\\,(\\alpha\\,\\mu_L)^{-0.245}', w: 'μ_L in cP at average column conditions' }],
      fx: [['↑ Liquid viscosity', '↓ diffusivity → ↓ efficiency (O’Connell)'], ['↑ Relative volatility', 'steeper equilibrium → ↓ overall efficiency'], ['Long liquid path (plug flow)', 'E_MV > E_OG — large-diameter trays gain efficiency'], ['↑ Entrainment ψ', '↓ apparent efficiency E_a'], ['Weeping', 'liquid bypasses contact → ↓ efficiency']],
      quiz: [{ q: 'A column needs 15 ideal stages and E_O = 0.6. Real trays required?', o: ['9', '15', '25', '24'], a: 2, ex: 'N_real = 15/0.6 = 25.' },
        { q: 'In the Murphree definition, the denominator y*ₙ − yₙ₊₁ represents…', o: ['actual enrichment', 'maximum possible enrichment if the vapour reached equilibrium with liquid leaving the tray', 'entrainment', 'pressure drop'], a: 1 }],
      refs: ["<i>Murphree, E.V.</i> (1925) Rectifying column calculations. <i>Ind. Eng. Chem.</i> 17, 747–750.", "<i>Lewis, W.K.</i> (1936) Rectification of binary mixtures: plate efficiency of bubble-cap columns. <i>Ind. Eng. Chem.</i> 28, 399–402.", "<i>Colburn, A.P.</i> (1936) Effect of entrainment on plate efficiency in distillation. <i>Ind. Eng. Chem.</i> 28, 526–530.", "<i>O’Connell, H.E.</i> (1946) Plate efficiency of fractionating columns and absorbers. <i>Trans. AIChE</i> 42, 741–755.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 6.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations)."]
    },

    /* ---------------------------------------------------------------- 1.5 */
    {
      id: 'agitated', title: 'Agitated (sparged) vessels', tags: 'agitated vessel stirred tank impeller rushton pitched blade propeller sparger baffles flooding dispersion kla power number',
      blurb: 'Choose an impeller, sparge gas, and watch the tank go from flooded to completely dispersed.',
      lead: 'In an agitated vessel the gas enters through a <b>sparger</b> below an <b>impeller</b>, which shears it into fine bubbles and spreads them through the liquid. The liquid is well mixed, so the vessel behaves like <b>one ideal stage</b>. It is used when the liquid needs long residence time — fermentation, hydrogenation, oxidation, aeration.',
      render(el, UI) {
        const st = { imp: 'rushton', DT: .35, N: 1, reg: 'CD', baff: true, gas: .7 };
        const S = UI.sim(el, {
          title: 'Stirred tank', controls: [
            { k: 'imp', t: 'seg', label: 'Impeller', v: 'rushton', opts: { rushton: 'Rushton', pbt: 'Pitched blade', prop: 'Propeller' } },
            { k: 'baff', t: 'check', label: 'Baffles fitted', v: true },
            { k: 'Nr', label: 'Impeller speed N', min: 30, max: 600, step: 5, v: 180, unit: 'rpm' },
            { k: 'vvm', label: 'Gas rate', min: 0, max: 2, step: .05, v: .5, unit: 'vvm' },
            { t: 'sep', label: 'Size' },
            { k: 'T', label: 'Tank diameter T (H = T)', min: .3, max: 5, step: .05, v: 1.5, unit: 'm' }, { k: 'DT', label: 'Impeller D/T', min: .25, max: .5, step: .01, v: .33 }],
          views: [{ k: 'v', t: '3d', h: 470, cam: [2.8, 2.6, 4.2], target: [0, 1, 0] }, { k: 'w', t: 'html' }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            const Tm = s.T, D = s.DT * Tm, N = s.Nr / 60, Vl = Math.PI / 4 * Tm * Tm * Tm, Qg = s.vvm * Vl / 60, vs = Qg / (Math.PI / 4 * Tm * Tm), rho = 998, Np = { rushton: 5, pbt: 1.27, prop: .35 }[s.imp];
            const P0 = Np * rho * N ** 3 * D ** 5, Fl = Qg / (N * D ** 3), Fr = N * N * D / 9.81, FlF = 30 * Fr * Math.pow(s.DT, 3.5), FlCD = .2 * Math.sqrt(Fr) * Math.sqrt(s.DT);
            const PgP = s.imp === 'rushton' ? (Fl < .035 ? 1 - 12.6 * Fl : .62 - 1.85 * Fl) : 1 - 4 * Fl; const Pg = P0 * clamp(PgP, .3, 1);
            const reg = s.vvm === 0 ? 'NG' : Fl > FlF ? 'F' : Fl > FlCD ? 'L' : 'CD', kla = .026 * Math.pow(Pg / Vl, .4) * Math.sqrt(vs), eps = s.vvm ? clamp(.13 * Math.pow(Pg / Vl, .33) * Math.pow(vs, .67) * 2, 0, .35) : 0, tm = 5.9 * Math.pow(Tm, 2 / 3) * Math.pow(P0 / (rho * Vl), -1 / 3) * Math.pow(s.DT, -1 / 3);
            Object.assign(st, { N: clamp(s.Nr / 180, .15, 3), reg, baff: s.baff, gas: clamp(s.vvm / 1.2, 0, 1) });
            const key = s.imp + s.baff + Math.round(s.DT * 20); if (S._k !== key && V.v.ok) { S._k = key; Object.assign(st, { imp: s.imp, DT: s.DT }); V.v.clear(); stirred(V.v, st); }
            const rt = { NG: ['No gas — single-phase mixing', ''], F: ['FLOODED — gas rises past the impeller', 'bad'], L: ['Loaded — gas dispersed above the impeller only', 'warn'], CD: ['Completely dispersed', 'ok'] }[reg];
            const Nf = Math.pow(Qg * 9.81 / (30 * Math.pow(D, 4) * Math.pow(s.DT, 3.5)), 1 / 3) * 60, Ncd = Math.sqrt(Qg / (.2 * Math.pow(D, 3.5) * Math.sqrt(s.DT / 9.81))) * 60;
            if (s.vvm) UI.wbar(V.w, [['flooded', 0, clamp(Nf, 0, 600), 'bad'], ['loaded', clamp(Nf, 0, 600), clamp(Ncd, 0, 600), 'warn'], ['completely dispersed', clamp(Ncd, 0, 600), 600, 'ok']], s.Nr, [0, 600]); else V.w.innerHTML = '';
            V.ro.set([['Gas dispersion', rt[0], rt[1]], ['Speed for complete dispersion', f(Ncd, 0) + ' rpm'], ['Ungassed power $P_0$', f(P0 / 1000, 3) + ' kW'], ['Gassed power $P_g$', f(Pg / 1000, 3) + ' kW'], ['Power per volume', f(Pg / Vl, 0) + ' W/m³'], ['$k_La$ (van ’t Riet)', f(kla * 3600, 0) + ' h⁻¹'], ['Gas hold-up', f(100 * eps, 1) + ' %'], ['Tip speed πND', f(Math.PI * N * D, 2) + ' m/s'], ['Mixing time (≈)', f(tm, 1) + ' s'], ['Flow number Fl', f(Fl, 3)]]);
          }
        });
        const W = UI.walk(el, [
          { t: 'Impeller', d: '<b>Rushton turbine</b> (6 flat blades on a disc) pushes liquid <i>radially</i> and is best at breaking gas into bubbles (power number ≈ 5). <b>Pitched-blade</b> turbines and <b>propellers</b> pump <i>axially</i> — good for blending and suspending solids, with much less power.', hi: ['imp'] },
          { t: 'Baffles', d: 'Four vertical baffles (width T/10) stop the liquid from swirling as a solid body. Untick “Baffles” — a <b>vortex</b> forms and there is almost no top-to-bottom mixing.', hi: ['baff'] },
          { t: 'Sparger', d: 'Gas enters through a ring sparger just below the impeller so that every bubble passes through the high-shear zone at the blade tips.', hi: ['sp'] },
          { t: 'Flooded → loaded → completely dispersed', d: 'At low speed (or high gas rate) the impeller is <b>flooded</b>: gas rises straight up the shaft. Faster, it is <b>loaded</b> (gas spread to the wall above the impeller). Faster still, bubbles are carried <b>below</b> the impeller too — <b>completely dispersed</b>. Move the speed slider.', hi: ['bub', 'imp'] },
          { t: 'Why it is one stage', d: 'Because the liquid is well mixed, all bubbles see the same liquid composition; the vessel is a single (nearly ideal) stage. Mass transfer is set by $k_La$, which rises with power per volume and gas velocity.', hi: [] }
        ], (i, x) => S.V.v.hi && S.V.v.hi(x.hi.length ? x.hi : null));
        const m = UI.more(el, 'Design relations used');
        UI.eqs(m, [{ n: 'Power (turbulent)', m: 'P_0=N_p\\rho N^3D^5' }, { n: 'Flow & Froude numbers', m: 'Fl=\\frac{Q_g}{ND^3},\\quad Fr=\\frac{N^2D}{g}' }, { n: 'Flooding (Rushton)', m: 'Fl_F=30\\,Fr\\,(D/T)^{3.5}' }, { n: 'Complete dispersion', m: 'Fl_{CD}=0.2\\,Fr^{0.5}(D/T)^{0.5}' }, { n: 'Gassed power (Cui)', m: '\\frac{P_g}{P_0}=1-12.6Fl\\ (Fl<0.035);\\ 0.62-1.85Fl' }, { n: 'k_La, coalescing (van ’t Riet)', m: 'k_La=0.026\\left(\\frac{P_g}{V}\\right)^{0.4}v_s^{0.5}\\ \\mathrm{s^{-1}}' }]);
        UI.note(m, 'Standard geometry: H = T, D = T/3, impeller clearance C = T/3, 4 baffles of width T/10. Correlations are for water-like (coalescing) liquids; values are indicative.');
      },
      fx: [['↑ Speed N', 'P ∝ N³; finer bubbles; flooded → loaded → completely dispersed'], ['↑ Gas rate', '↓ gassed power (cavities behind blades); risk of flooding'], ['No baffles', 'vortex, solid-body swirl, poor mixing, gas drawn in from surface'], ['↑ D/T', 'more pumping, lower speed needed for dispersion'], ['↑ P/V or v_s', '↑ k_La']],
      quiz: [{ q: 'Why are baffles fitted in agitated vessels?', o: ['To heat the liquid', 'To stop swirling/vortexing and promote top-to-bottom mixing', 'To support the shaft', 'To reduce power'], a: 1 },
        { q: 'An impeller is “flooded” when…', o: ['the tank overflows', 'gas rises past the impeller without being dispersed', 'liquid enters the sparger', 'the motor stops'], a: 1 },
        { q: 'Doubling impeller speed multiplies ungassed power by…', o: ['2', '4', '8', '32'], a: 2 }],
      refs: ["<i>Paul, E.L., Atiemo-Obeng, V.A. & Kresta, S.M.</i> (eds.) (2004) <i>Handbook of Industrial Mixing</i>, Wiley-Interscience, Ch. 11 (gas–liquid mixing).", "<i>Rushton, J.H., Costich, E.W. & Everett, H.J.</i> (1950) Power characteristics of mixing impellers. <i>Chem. Eng. Prog.</i> 46, 395–404 and 467–476.", "<i>Nienow, A.W., Warmoeskerken, M.M.C.G., Smith, J.M. & Konno, M.</i> (1985) On the flooding/loading transition and the complete dispersal condition in aerated vessels agitated by a Rushton turbine. <i>Proc. 5th Eur. Conf. Mixing</i>, Würzburg, 143–154.", "<i>Cui, Y.Q., van der Lans, R.G.J.M. & Luyben, K.Ch.A.M.</i> (1996) Local power uptake in gas–liquid systems with single and multiple Rushton turbines. <i>Chem. Eng. Sci.</i> 51, 2631–2636.", "<i>van ’t Riet, K.</i> (1979) Review of measuring methods and results in nonviscous gas–liquid mass transfer in stirred vessels. <i>Ind. Eng. Chem. Process Des. Dev.</i> 18, 357–364.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations)."]
    },

    /* ---------------------------------------------------------------- 1.6 */
    {
      id: 'packed', title: 'Packed towers & packing materials', tags: 'packing raschig pall berl saddle intalox structured eckert gpdc flooding pressure drop hetp distributor loading channelling',
      blurb: 'Watch liquid trickle over packing, push the gas to loading and flooding, then size the tower.',
      lead: 'A packed tower is filled with pieces of <b>packing</b> that give a large wetted surface per volume ($a$, m²/m³) while leaving voids ($\\varepsilon$) for gas. Liquid spreads as thin films over the packing; gas flows up through the voids. Contact is <b>continuous</b>, not stage-wise.',
      render(el, UI) {
        const st = { fl: .6, L: 1, hold: .2, flood: 0, poor: false };
        const S0 = UI.sim(el, {
          title: 'How it works', controls: [
            { k: 'fl', label: 'Gas rate (% of flooding)', min: 10, max: 115, step: 1, v: 60, unit: '%' },
            { k: 'L', label: 'Liquid rate', min: .3, max: 2, step: .05, v: 1, unit: '×' },
            { k: 'poor', t: 'check', label: 'Poor liquid distribution (wall flow, channelling)', v: false }],
          views: [{ k: 'v', t: '3d', h: 480, cam: [6.6, 4.4, 8.6], target: [0, 2.6, 0] }, { k: 'w', t: 'html' }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            const q = s.fl / 100; Object.assign(st, { fl: q, L: s.L, poor: s.poor, hold: clamp(.12 + .1 * s.L + (q > .65 ? (q - .65) * 1.6 : 0), 0, 1), flood: q > 1 ? Math.min(.9, (q - 1) * 6) : 0 });
            if (!S0._b && V.v.ok) { S0._b = 1; packedLive(V.v, st); }
            UI.wbar(V.w, [['pre-loading', 10, 65, 'ok'], ['loading', 65, 100, 'warn'], ['flooding', 100, 115, 'bad']], s.fl, [10, 115]);
            V.ro.set([['Regime', q > 1 ? 'FLOODING' : q > .65 ? 'Loading — hold-up rising' : 'Pre-loading (normal)', q > 1 ? 'bad' : q > .65 ? 'warn' : 'ok'], ['ΔP (relative)', f(Math.pow(q, 1.9) * (q > .65 ? 1 + 6 * (q - .65) ** 2 : 1) * s.L ** .3 * 100, 0) + ' % of design'], ['Liquid hold-up', f(100 * st.hold * .15, 1) + ' % of bed volume'], ['Effective area', s.poor ? 'low — liquid runs down the wall' : 'good — packing fully wetted', s.poor ? 'warn' : 'ok']]);
          }
        });
        UI.walk(el, [
          { t: 'Liquid distributor', d: 'Liquid must be spread evenly over the top of the bed (≥ 40–100 drip points/m²). A poor distributor leaves dry packing and is the commonest cause of bad packed-column performance.', hi: ['dist', 'lin'] },
          { t: 'Packing & liquid films', d: 'Liquid trickles down as thin films over the packing surface — this film surface is the gas–liquid interface. More area per volume ($a$) means more mass transfer per metre of height.', hi: ['pack'] },
          { t: 'Gas flows up through the voids', d: 'Gas enters below the support plate and rises through the voids (ε 0.7–0.98), counter-current to the liquid. Voidage sets capacity and pressure drop.', hi: ['gin', 'gout'] },
          { t: 'Support plate', d: 'An open grid (free area > packing voidage) holds the bed without restricting flow — otherwise the column floods at the support first.', hi: ['sup'] },
          { t: 'Loading and flooding', d: 'Above ≈ 65 % of flood the gas starts to hold liquid up (<b>loading</b>); ΔP rises steeply. At <b>flooding</b> liquid can no longer flow down, a pool forms on top and the column must be turned down. Slide the gas rate above 100 %.', hi: ['flood'] },
          { t: 'Channelling and wall flow', d: 'Liquid tends to drift to the wall. Tick “poor distribution”: the core runs dry. Fixes: good distributor, redistributors every 3–6 m (or 5–10 D), and $D/d_p > 10$–15.', hi: ['pack', 'dist'] }
        ], (i, x) => S0.V.v.hi && S0.V.v.hi(x.hi));
        const P = {
          r25: ['Raschig ring, ceramic 25 mm', 190, .73, 155, .025], r50: ['Raschig ring, ceramic 50 mm', 92, .74, 65, .05], b25: ['Berl saddle, ceramic 25 mm', 250, .68, 110, .025],
          i25: ['Intalox saddle, ceramic 25 mm', 256, .78, 92, .025], pm25: ['Pall ring, metal 25 mm', 205, .94, 56, .025], pp25: ['Pall ring, plastic 25 mm', 206, .90, 52, .025],
          pm50: ['Pall ring, metal 50 mm', 112, .96, 27, .05], imtp: ['IMTP metal 25 mm', 224, .97, 41, .025], mp250: ['Structured, Mellapak 250Y', 250, .98, 20, .016]
        };
        UI.sec(el, 'Packing types and tower sizing');
        UI.sim(el, {
          title: 'Packed absorber', controls: [
            { k: 'pk', t: 'select', label: 'Packing', v: 'pm25', opts: Object.fromEntries(Object.entries(P).map(([k, v]) => [k, v[0]])) },
            { k: 'Gm', label: 'Gas flow', min: .1, max: 20, step: .05, v: 2, unit: 'kg/s' }, { k: 'Lm', label: 'Liquid flow', min: .1, max: 40, step: .05, v: 4, unit: 'kg/s' },
            { k: 'rg', label: 'Gas density $\\rho_G$', min: .5, max: 20, step: .05, v: 1.2, unit: 'kg/m³' }, { k: 'rl', label: 'Liquid density $\\rho_L$', min: 600, max: 1300, step: 5, v: 998, unit: 'kg/m³' },
            { k: 'mu', label: 'Liquid viscosity', min: .2, max: 10, step: .05, v: 1, unit: 'cP' }, { k: 'ff', label: 'Design % of flooding', min: 40, max: 90, step: 1, v: 70, unit: '%' }],
          views: [{ k: 'v', t: '3d', h: 340, cam: [2.2, 2, 2.6], target: [0, .5, 0] }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 320 }],
          update(s, V, S) {
            const pk = P[s.pk], FpSI = pk[3] * 3.281, psi = 998 / s.rl, X = s.Lm / s.Gm * Math.sqrt(s.rg / s.rl), Yf = C.eckertFloodY(Math.min(Math.max(X, .005), 8));
            const Gf = Math.sqrt(Yf * s.rg * s.rl * 9.81 / (FpSI * psi * Math.pow(s.mu, .2))), G = Gf * s.ff / 100, A = s.Gm / G, D = Math.sqrt(4 * A / Math.PI);
            const dPf = .115 * Math.pow(pk[3], .7) * 817, hetp = pk[0].includes('Structured') ? .3 : 18 * pk[4];
            V.ro.set([['Flow parameter X', f(X, 3)], ['G at flooding', f(Gf, 3) + ' kg/m²s'], ['Design G', f(G, 3) + ' kg/m²s'], ['<b>Diameter</b>', f(D, 3) + ' m', 'ok'], ['ΔP at flood (Kister–Gill)', f(dPf, 0) + ' Pa/m'], ['a / ε / F_p', `${pk[1]} / ${pk[2]} / ${pk[3]} ft⁻¹`], ['HETP (rule of thumb)', f(hetp, 2) + ' m'], ['D / d_p', f(D / pk[4], 0), D / pk[4] < 10 ? 'bad' : '']]);
            const p = V.p.frame({ x: [.005, 5], y: [.002, .5], logx: 1, logy: 1, xl: 'X = (L/G)√(ρG/ρL)', yl: 'Y = G²Fpψμ^0.2/(ρGρLg)' });
            p.fn(C.eckertFloodY, .005, 5, { c: 'bad', w: 2.5, logx: 1, l: 'flooding line (Eckert)' });
            [.7, .5, .3].forEach((q, i) => p.fn(x => C.eckertFloodY(x) * q * q, .005, 5, { c: 'mu', w: 1, dash: [3, 4], logx: 1, l: i ? null : '70/50/30 % of flood velocity' }));
            p.pts([[X, Yf * Math.pow(s.ff / 100, 2)]], { c: 'c1', r: 6, l: 'design point' }); p.done();
            if (S._pk !== s.pk && V.v.ok) {
              S._pk = s.pk; const v = V.v; v.clear(); v.cyl(.6, 1.2, SHELL, [0, .6, 0], { op: .18, ds: 1, open: 1 });
              const rnd = C.rng(11), stc = s.pk === 'mp250', ring = s.pk[0] === 'r' || s.pk[0] === 'p' || s.pk === 'imtp', col = s.pk.startsWith('pp') ? 0x3f7fbf : s.pk.startsWith('pm') || s.pk === 'imtp' ? 0x9aa3ab : 0xc9b79c, sz = pk[4] * 2.4;
              if (stc) for (let k = 0; k < 14; k++) for (let j = 0; j < 2; j++) { const g = new THREE.PlaneGeometry(1.1, .5, 10, 1), pos = g.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, .04 * Math.sin(pos.getX(i) * 40)); v.add(g, v.mat(0x9aa3ab, { ds: 1, m: .7 }), [0, .3 + j * .55, -.5 + k * .075], [0, j ? Math.PI / 2 : 0, 0]).rotation.z = (j ? -1 : 1) * Math.PI / 4; }
              else for (let i = 0; i < 260; i++) {
                const a = rnd() * 6.28, rr = Math.sqrt(rnd()) * .52, pos = [Math.cos(a) * rr, .05 + rnd() * 1.1, Math.sin(a) * rr], rot = [rnd() * 3, rnd() * 3, rnd() * 3];
                if (ring) v.cyl(sz / 2, sz, col, pos, { open: 1, ds: 1, rot, seg: 14 }); else v.add(new THREE.TorusGeometry(sz / 2, sz / 6, 6, 12, Math.PI), v.mat(col, { ds: 1 }), pos, rot);
              }
              v.tag(pk[0], [0, 1.25, 0]);
            }
          }
        });
        el.append(UI.table(['Packing', 'a (m²/m³)', 'ε', 'F_p (ft⁻¹)', 'Notes'], [['Raschig ring (1st gen.)', 190, .73, 155, 'Cheap, high ΔP, channelling'], ['Berl / Intalox saddle (2nd gen.)', '250 / 256', '0.68 / 0.78', '110 / 92', 'Better liquid spread, nest less'], ['Pall ring (2nd gen.)', 205, .94, 56, 'Windows in wall → ~2× capacity of Raschig'], ['IMTP / Nutter (3rd gen.)', 224, .97, 41, 'Open, low ΔP, high efficiency'], ['Structured (Mellapak)', 250, .98, '~20', 'Lowest ΔP/stage, vacuum distillation']], [1, 2, 3]));
        UI.note(el, 'Material choice: <b>ceramic</b> for corrosive acids (not HF/strong alkali), <b>metal</b> for strength and high temperature, <b>plastic</b> (PP, PVDF) for low-temperature corrosive service. Keep $D/d_p > 10$–15 to avoid wall channelling.');
      },
      eqs: [
        { n: 'Eckert / Sherwood GPDC abscissa', m: 'X=\\frac{L}{G}\\sqrt{\\frac{\\rho_G}{\\rho_L}}' },
        { n: 'GPDC ordinate', m: 'Y=\\frac{G^2F_p\\,\\psi\\,\\mu_L^{0.2}}{\\rho_G\\rho_L g},\\ \\psi=\\rho_w/\\rho_L', w: 'G kg/m²s, F_p m⁻¹, μ_L cP' },
        { n: 'Flooding line fit', m: '\\log Y_{fl}=-1.6678-1.085\\log X-0.29655(\\log X)^2' },
        { n: 'ΔP at flood (Kister–Gill)', m: '\\Delta P_{fl}=0.115\\,F_p^{0.7}\\ \\text{in H}_2\\text{O/ft}', w: 'F_p in ft⁻¹' },
        { n: 'Packed height', m: 'Z = N_{OG}\\,H_{OG} = N_{ideal}\\times HETP' }],
      fx: [['↓ Packing factor F_p', '↑ flooding velocity → ↓ diameter'], ['↑ Packing size', '↓ F_p and ΔP but ↓ area a → ↑ HETP'], ['↑ Liquid rate', '↑ hold-up, ↓ allowable gas rate'], ['Gas rate above loading point', 'hold-up rises, ΔP climbs steeply until flooding'], ['Poor distribution', 'wall flow, dry core → much lower efficiency']],
      quiz: [{ q: 'Why do Pall rings have higher capacity than Raschig rings of the same size?', o: ['Higher density', 'Windows in the wall raise voidage and open the inside surface', 'Smaller surface area', 'They are always metal'], a: 1 },
        { q: 'Which packing is preferred for vacuum distillation?', o: ['Raschig rings', 'Ceramic saddles', 'Structured packing', 'Coke'], a: 2, ex: 'Lowest pressure drop per theoretical stage.' },
        { q: 'Why are liquid redistributors installed?', o: ['To add more liquid', 'To collect wall flow and re-spread it over the bed', 'To support the packing', 'To cool the gas'], a: 1 }],
      refs: ["<i>Eckert, J.S.</i> (1970) Selecting the proper distillation column packing. <i>Chem. Eng. Prog.</i> 66(3), 39–44.", "<i>Kister, H.Z. & Gill, D.R.</i> (1991) Predict flood point and pressure drop for modern random packings. <i>Chem. Eng. Prog.</i> 87(2), 32–42.", "<i>Strigle, R.F.</i> (1994) <i>Packed Tower Design and Applications</i>, 2nd ed., Gulf Publishing.", "<i>Billet, R.</i> (1995) <i>Packed Towers in Processing and Environmental Technology</i>, VCH.", "<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 14.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations)."]
    },

    /* ---------------------------------------------------------------- 1.7 */
    {
      id: 'contactors', title: 'Liquid-dispersed equipment: venturi, spray & wetted-wall', tags: 'venturi scrubber wet scrubber spray tower mist eliminator calvert johnstone nukiyama wetted wall falling film liquid dispersed dust',
      blurb: 'Watch dust get captured in a venturi throat, drops fall in a spray tower and films run down a wetted wall.',
      lead: 'When the gas is the continuous phase, the liquid must be broken into drops (spray tower, venturi scrubber) or spread as a thin film (wetted wall). These <b>wet scrubbers</b> remove soluble gases and also dust and mist. Drop size and film thickness set the interfacial area.',
      render(el, UI) {
        const tb = UI.tabs(el, ['Venturi scrubber', 'Spray tower', 'Wetted-wall column']);
        // --- venturi
        const sv = { vt: 90, eta: .9, dd: 60 };
        const SV = UI.sim(tb.panes[0], {
          title: 'Venturi', controls: [
            { k: 'vt', label: 'Throat gas velocity', min: 30, max: 150, step: 1, v: 90, unit: 'm/s' }, { k: 'LG', label: 'Liquid-to-gas ratio', min: .3, max: 3, step: .05, v: 1, unit: 'L/m³' },
            { k: 'dp', label: 'Dust particle size', min: .1, max: 10, step: .05, v: 1, unit: 'µm', log: 1 }, { k: 'rp', label: 'Particle density', min: 500, max: 5000, step: 50, v: 2000, unit: 'kg/m³' }, { k: 'K', label: 'Johnstone constant K', min: .1, max: .25, step: .005, v: .15 },
            { t: 'html', html: '<span style="color:#5a4632">●</span> dust &nbsp; <span style="color:#2f7fd8">●</span> water drops &nbsp; <span style="color:#e0703f">●</span> gas' }],
          views: [{ k: 'v', t: '3d', h: 460, cam: [-.6, 3.4, 12.5], target: [-.7, 1.3, 0] }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            const QLQG = s.LG / 1000, dd = (585 / s.vt * Math.sqrt(72) + 597 * Math.pow(.01 / Math.sqrt(72), .45) * Math.pow(1000 * QLQG, 1.5)) * 1e-6, dP = 998 * s.vt * s.vt * QLQG, mu = 1.8e-5, Rg = s.LG / .1337;
            const eff = dpum => { const d = dpum * 1e-6, l = .0665e-6, Cc = 1 + 2 * l / d * (1.257 + .4 * Math.exp(-1.1 * d / (2 * l))), psi = Cc * s.rp * s.vt * d * d / (18 * mu * dd); return 1 - Math.exp(-s.K * Rg * Math.sqrt(psi)); };
            Object.assign(sv, { vt: s.vt, eta: eff(s.dp), dd: dd * 1e6 }); if (!SV._b && V.v.ok) { SV._b = 1; venturiLive(V.v, sv); }
            V.ro.set([[`Captured (${f(s.dp, 2)} µm dust)`, f(eff(s.dp) * 100, 1) + ' %', 'ok'], ['Escaping', f(100 - eff(s.dp) * 100, 1) + ' %'], ['Mean drop size (Nukiyama–Tanasawa)', f(dd * 1e6, 0) + ' µm'], ['Pressure drop (Calvert)', f(dP / 1000, 2) + ' kPa (' + f(dP / 9.81, 0) + ' mm H₂O)'], ['Cut size (50 %)', f(C.bisect(d => eff(d) - .5, .01, 50), 2) + ' µm']]);
            if (SV.pc) { const p = SV.pc.frame({ x: [.1, 10], y: [0, 100], logx: 1, xl: 'Particle diameter (µm)', yl: 'Collection efficiency (%)', xs: 'd', ys: 'η' }); p.fn(d => eff(d) * 100, .1, 10, { logx: 1, l: 'Johnstone' }); p.vl(s.dp); p.pts([[s.dp, eff(s.dp) * 100]], { c: 'tx' }); p.done(); }
          }
        });
        UI.walk(tb.panes[0], [
          { t: 'Converging section', d: 'Dirty gas speeds up as the duct narrows (continuity: $u_1A_1 = u_2A_2$).', hi: ['in', 'conv'] },
          { t: 'Throat: atomisation', d: 'Water injected at the throat meets gas at 60–120 m/s. The huge relative velocity shears the water into fine drops (tens of µm).', hi: ['throat', 'inj'] },
          { t: 'Capture by impaction', d: 'Dust particles keep their high speed while the new drops are still slow, so particles slam into drops and are captured. Larger, denser particles and higher velocity → higher efficiency. Soluble gases dissolve into the drops at the same time.', hi: ['throat', 'div'] },
          { t: 'Diverging section', d: 'The gas slows down again and part of the pressure energy is recovered; drops grow by collision.', hi: ['div'] },
          { t: 'Cyclonic separator', d: 'Gas enters tangentially and spins. Heavy drops (carrying dust) are flung to the wall and drain as <b>slurry</b>; clean gas leaves at the top.', hi: ['sep', 'out', 'slurry'] }
        ], (i, x) => SV.V.v.hi && SV.V.v.hi(x.hi), 6000);
        const mv = UI.more(tb.panes[0], 'Grade-efficiency curve & equations'); SV.pc = UI.plotIn(mv, 300); SV.run();
        UI.eqs(mv, [{ n: 'Nukiyama–Tanasawa drop size', m: 'd_0=\\frac{585}{v}\\sqrt{\\frac{\\sigma}{\\rho_L}}+597\\left(\\frac{\\mu_L}{\\sqrt{\\sigma\\rho_L}}\\right)^{0.45}\\left(1000\\frac{Q_L}{Q_G}\\right)^{1.5}', w: 'd₀ µm, v m/s, σ dyn/cm, ρ g/cm³, μ poise' }, { n: 'Venturi ΔP (Calvert)', m: '\\Delta P=\\rho_L v_t^2\\,\\frac{Q_L}{Q_G}' }, { n: 'Johnstone efficiency', m: '\\eta=1-\\exp\\!\\left(-K R\\sqrt{\\psi}\\right),\\ \\psi=\\frac{C\\rho_p v_t d_p^2}{18\\mu_G d_0}' }]);
        // --- spray tower
        const ss = { G: 1, L: 1, dd: 600 };
        const SS = UI.sim(tb.panes[1], {
          title: 'Spray tower', controls: [{ k: 'dd', label: 'Drop size', min: 100, max: 2000, step: 10, v: 600, unit: 'µm' }, { k: 'G', label: 'Gas velocity', min: .5, max: 3, step: .05, v: 1.5, unit: 'm/s' }, { k: 'LG', label: 'L/G ratio', min: .2, max: 5, step: .1, v: 1.5, unit: 'L/m³' }],
          views: [{ k: 'v', t: '3d', h: 460, cam: [7.5, 5.5, 10.5], target: [0, 3, 0] }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            const d = s.dd * 1e-6, rl = 998, rg = 1.2, mu = 1.8e-5, ut = C.bisect(u => { const Re = rg * u * d / mu, Cd = 24 / Re * (1 + .15 * Math.pow(Re, .687)) + .42 / (1 + 42500 / Math.pow(Re, 1.16)); return u - Math.sqrt(4 * d * (rl - rg) * 9.81 / (3 * Cd * rg)); }, 1e-4, 20);
            const net = ut - s.G, a = 6 * (s.LG / 1000) * s.G / (d * Math.max(net, .05));
            Object.assign(ss, { G: s.G / 1.5, L: s.LG / 1.5, dd: s.dd }); if (!SS._b && V.v.ok) { SS._b = 1; sprayLive(V.v, ss); }
            V.ro.set([['Drop terminal velocity', f(ut, 2) + ' m/s'], ['Drop velocity relative to wall', net > 0 ? f(net, 2) + ' m/s (falls)' : 'carried up — entrained!', net > 0 ? 'ok' : 'bad'], ['Interfacial area a', net > 0 ? f(a, 1) + ' m²/m³' : '—'], ['Typical efficiency', '1–2 stages (gas back-mixing)'], ['ΔP', 'very low (< 0.5 kPa)']]);
          }
        });
        UI.note(tb.panes[1], '<b>Spray tower</b>: liquid is sprayed down through rising gas. Smaller drops give more area ($a = 6 \\phi/d$) but fall slower and are more easily carried out — hence the <b>mist eliminator</b> at the top. Simple, low ΔP and tolerant of solids, but gas back-mixing limits it to 1–2 stages. Used for gas cooling/humidification and very soluble gases (NH₃, HCl, SO₂ with lime slurry).');
        // --- wetted wall
        const sw = { G: 1, L: 1, dmm: .3 };
        const SW = UI.sim(tb.panes[2], {
          title: 'Falling film', controls: [
            { k: 'G', label: 'Liquid loading Γ (per wetted perimeter)', min: .005, max: .6, step: .005, v: .05, unit: 'kg/m·s' }, { k: 'mu', label: 'Viscosity', min: .3, max: 20, step: .05, v: 1, unit: 'cP' }, { k: 'rho', label: 'Density', min: 700, max: 1300, step: 5, v: 998, unit: 'kg/m³' },
            { k: 'D', label: 'Tube diameter', min: .01, max: .1, step: .001, v: .025, unit: 'm' }, { k: 'Z', label: 'Wetted length', min: .3, max: 3, step: .05, v: 1, unit: 'm' }],
          views: [{ k: 'v', t: '3d', h: 440, cam: [4.5, 5, 8.5], target: [0, 3, 0] }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            const mu = s.mu / 1000, d = Math.cbrt(3 * mu * s.G / (s.rho * s.rho * 9.81)), ua = s.G / (s.rho * d), Re = 4 * s.G / mu;
            Object.assign(sw, { L: clamp(s.G / .05, .3, 3), dmm: d * 1e3 * 2 }); if (!SW._b && V.v.ok) { SW._b = 1; wettedLive(V.v, sw); }
            V.ro.set([['Film thickness δ', f(d * 1e3, 4) + ' mm'], ['Mean velocity', f(ua, 3) + ' m/s'], ['Surface velocity (1.5ū)', f(1.5 * ua, 3) + ' m/s'], ['Film Re = 4Γ/μ', f(Re, 0), Re < 20 ? 'ok' : Re < 1500 ? 'warn' : 'bad'], ['Regime', Re < 20 ? 'laminar, smooth' : Re < 1500 ? 'laminar-wavy' : 'turbulent'], ['Interfacial area πDZ', f(Math.PI * (s.D - 2 * d) * s.Z * 1e4, 1) + ' cm²'], ['Contact time Z/u_s', f(s.Z / (1.5 * ua), 2) + ' s']]);
          }
        });
        UI.eqs(tb.panes[2], [{ n: 'Falling film (Nusselt)', m: '\\delta=\\left(\\frac{3\\mu\\Gamma}{\\rho^2 g}\\right)^{1/3},\\quad Re_f=\\frac{4\\Gamma}{\\mu}' }]);
        UI.sec(el, 'Types of wet scrubber');
        el.append(UI.table(['Scrubber', 'How liquid contacts gas', 'ΔP (kPa)', 'Removes particles down to', 'Notes'], [['Spray tower', 'Drops fall through rising gas', '0.1–0.5', '≈ 10 µm', 'Simple, cheap; low efficiency for fine dust'], ['Cyclonic spray', 'Spray into a swirling gas', '0.5–2', '≈ 2–5 µm', 'Centrifugal force aids capture'], ['Packed-bed scrubber', 'Films on packing', '0.2–1', 'gases (not dust)', 'Best for soluble gases; plugs with solids'], ['Impingement-plate (tray)', 'Gas jets through perforated plates under liquid', '1–3', '≈ 1 µm', 'Combined gas + dust'], ['Venturi', 'Throat atomisation by fast gas', '2–15', '≈ 0.3–0.5 µm', 'Highest efficiency, highest energy']]));
      },
      fx: [['↑ Throat velocity', 'finer drops + stronger impaction → ↑ efficiency, but ΔP ∝ v²'], ['↑ L/G', '↑ efficiency and ΔP; drops get larger'], ['↓ Spray drop size', '↑ area, but drops may be carried out → need mist eliminator'], ['↑ Liquid loading Γ', 'film thickens as Γ^(1/3), becomes wavy/turbulent'], ['↑ Particle size', 'much easier capture (inertia ∝ d²)']],
      quiz: [{ q: 'Doubling throat velocity at fixed L/G multiplies venturi ΔP by…', o: ['2', '4', '√2', '8'], a: 1 }, { q: 'Fine dust is captured in a venturi mainly by…', o: ['dissolution', 'inertial impaction on slower drops', 'gravity settling', 'evaporation'], a: 1 }, { q: 'Film thickness is proportional to Γ raised to…', o: ['1', '1/2', '1/3', '2'], a: 2 }],
      refs: ["<i>Johnstone, H.F., Feild, R.B. & Tassler, M.C.</i> (1954) Gas absorption and aerosol collection in a venturi atomizer. <i>Ind. Eng. Chem.</i> 46, 1601–1608.", "<i>Calvert, S.</i> (1970) Venturi and other atomizing scrubbers efficiency and pressure drop. <i>AIChE J.</i> 16, 392–396.", "<i>Nukiyama, S. & Tanasawa, Y.</i> (1938) Experiments on the atomization of liquids in an air stream. <i>Trans. JSME</i> 4, 86–93.", "<i>Nusselt, W.</i> (1916) Die Oberflächenkondensation des Wasserdampfes. <i>Z. VDI</i> 60, 541–546 and 569–575. (falling-film thickness)", "<i>Clift, R., Grace, J.R. & Weber, M.E.</i> (1978) <i>Bubbles, Drops, and Particles</i>, Academic Press. (drop drag and terminal velocity)", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations)."]
    },

    /* ---------------------------------------------------------------- 1.8 */
    {
      id: 'mb-equipment', title: 'Material balances for gas–liquid contactors', tags: 'material balance mass balance tray stage murphree column overall operating line scrubber dust blowdown makeup',
      blurb: 'Balance one tray, a whole counter-current column and a scrubber loop — numbers update on the flow diagram.',
      lead: 'Every contactor obeys <b>input = output + accumulation</b> (steady state: accumulation = 0) for the total flow and for each component. Draw a boundary, list every stream crossing it, and write one equation per component.',
      render(el, UI) {
        const tb = UI.tabs(el, ['One tray (stage)', 'Counter-current column', 'Scrubber loop']);
        // --- tray
        const d1 = UI.h('div', { class: 'card pad' });
        UI.sim(tb.panes[0], {
          title: 'Tray n', controls: [
            { k: 'V', label: 'Gas / vapour flow V', min: 10, max: 500, step: 1, v: 100, unit: 'kmol/h' }, { k: 'L', label: 'Liquid flow L', min: 10, max: 500, step: 1, v: 150, unit: 'kmol/h' },
            { k: 'y1', label: 'Gas in, $y_{n+1}$', min: .001, max: .3, step: .001, v: .08 }, { k: 'x0', label: 'Liquid in, $x_{n-1}$', min: 0, max: .2, step: .001, v: .01 },
            { k: 'm', label: 'Equilibrium slope m (y* = m x)', min: .2, max: 3, step: .05, v: 1.2 }, { k: 'E', label: 'Murphree efficiency $E_{MV}$', min: .1, max: 1, step: .01, v: .7 }],
          views: [{ k: 'd', t: 'html' }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            if (!d1.parentNode) V.d.append(d1);
            const A = s.V / s.L, yn = (s.y1 * (1 - s.E + s.E * s.m * A) + s.E * s.m * s.x0) / (1 + s.E * s.m * A), xn = s.x0 + A * (s.y1 - yn), N = s.V * (s.y1 - yn), ys = s.m * xn;
            const inn = s.V * s.y1 + s.L * s.x0, out = s.V * yn + s.L * xn;
            svg(d1, `<rect class="lq" x="205" y="120" width="230" height="60"/><rect class="s" x="205" y="120" width="230" height="60"/>` + T(320, 146, 'Tray n', 'middle') + T(320, 166, (N >= 0 ? 'gas → liquid: ' : 'liquid → gas: ') + f(Math.abs(N), 3) + ' kmol/h', 'middle', 'v')
              + arw(320, 285, 320, 186) + T(330, 262, `V = ${f(s.V, 0)}, y = ${f(s.y1, 4)}`) + T(330, 278, `solute in ${f(s.V * s.y1, 3)}`, 'start', 'k')
              + arw(320, 114, 320, 20) + T(330, 40, `V = ${f(s.V, 0)}, y = ${f(yn, 4)}`) + T(330, 56, `solute out ${f(s.V * yn, 3)}`, 'start', 'k')
              + arw(60, 84, 201, 130) + T(40, 50, `L = ${f(s.L, 0)}, x = ${f(s.x0, 4)}`) + T(40, 66, `solute in ${f(s.L * s.x0, 3)}`, 'start', 'k')
              + arw(439, 170, 590, 250) + T(470, 280, `L = ${f(s.L, 0)}, x = ${f(xn, 4)}`) + T(470, 296, `solute out ${f(s.L * xn, 3)}`, 'start', 'k')
              + T(20, 150, 'IN  = ' + f(inn, 4), 'start', 'v') + T(20, 170, 'OUT = ' + f(out, 4), 'start', 'v') + T(20, 190, 'kmol/h solute', 'start', 'k'), '0 0 640 305');
            V.ro.set([['Gas leaving $y_n$', f(yn, 5)], ['Liquid leaving $x_n$', f(xn, 5)], ['$y_n^* = m x_n$', f(ys, 5)], ['Solute transferred', f(N, 4) + ' kmol/h'], ['Balance closure (in − out)', f(inn - out, 6), 'ok'], ['Ideal stage would give $y_n$', f((s.m * A * s.y1 + s.m * s.x0) / (1 + s.m * A), 5)]]);
          }
        });
        UI.note(tb.panes[0], 'Equations solved: solute balance $V y_{n+1} + L x_{n-1} = V y_n + L x_n$ (constant molar flows), Murphree $y_n = y_{n+1} + E_{MV}(m x_n - y_{n+1})$. Two equations, two unknowns ($y_n$, $x_n$). With $E_{MV} = 1$ the tray is an ideal stage.');
        // --- column
        const d2 = UI.h('div', { class: 'card pad' });
        UI.sim(tb.panes[1], {
          title: 'Absorber', controls: [
            { k: 'G', label: 'Gas (solute-free) $G_s$', min: 10, max: 500, step: 1, v: 100, unit: 'kmol/h' }, { k: 'Ls', label: 'Solvent (solute-free) $L_s$', min: 10, max: 1000, step: 1, v: 180, unit: 'kmol/h' },
            { k: 'Y1', label: 'Gas in $Y_1$ (mol solute / mol carrier)', min: .005, max: .3, step: .001, v: .06 }, { k: 'rec', label: 'Solute recovery', min: 50, max: 99.9, step: .1, v: 95, unit: '%' },
            { k: 'X2', label: 'Solvent in $X_2$', min: 0, max: .02, step: .0005, v: 0 }, { k: 'm', label: 'Equilibrium slope m (Y* = mX)', min: .2, max: 3, step: .05, v: 1.1 }],
          views: [{ k: 'd', t: 'html' }, { k: 'ro', t: 'ro' }],
          update(s, V) {
            if (!d2.parentNode) V.d.append(d2);
            const Y2 = s.Y1 * (1 - s.rec / 100), X1 = s.X2 + s.G / s.Ls * (s.Y1 - Y2), A = s.Ls / (s.m * s.G), Xmax = s.Y1 / s.m, Lmin = s.G * (s.Y1 - Y2) / (Xmax - s.X2);
            const ok = X1 < Xmax, rr = (Y2 - s.m * s.X2) / (s.Y1 - s.m * s.X2), N = ok ? (Math.abs(A - 1) < 1e-6 ? (s.Y1 - Y2) / (Y2 - s.m * s.X2) : Math.log((1 - 1 / A) / rr + 1 / A) / Math.log(A)) : NaN;
            svg(d2, `<rect class="s" x="270" y="30" width="100" height="240" rx="10"/>` + Array.from({ length: 7 }, (_, i) => `<line class="t" x1="275" x2="365" y1="${60 + i * 30}" y2="${60 + i * 30}"/>`).join('') + T(320, 155, 'absorber', 'middle', 'k')
              + arw(110, 255, 266, 255) + T(20, 240, `Gas in: G_s = ${f(s.G, 0)}, Y₁ = ${f(s.Y1, 4)}`) + T(20, 274, `solute ${f(s.G * s.Y1, 3)} kmol/h`, 'start', 'k')
              + arw(374, 45, 530, 45) + T(390, 30, `Gas out: Y₂ = ${f(Y2, 5)}`) + T(390, 66, `solute ${f(s.G * Y2, 3)} kmol/h`, 'start', 'k')
              + arw(110, 45, 266, 45) + T(20, 30, `Solvent in: L_s = ${f(s.Ls, 0)}, X₂ = ${f(s.X2, 4)}`) + T(20, 66, `solute ${f(s.Ls * s.X2, 3)} kmol/h`, 'start', 'k')
              + arw(374, 255, 530, 255) + T(390, 240, `Liquid out: X₁ = ${f(X1, 5)}`, 'start', ok ? '' : 'v') + T(390, 274, `solute ${f(s.Ls * X1, 3)} kmol/h`, 'start', 'k'), '0 0 640 290');
            V.ro.set([['Overall balance', 'G_s(Y₁−Y₂) = L_s(X₁−X₂)'], ['Solute absorbed', f(s.G * (s.Y1 - Y2), 3) + ' kmol/h'], ['Liquid out $X_1$', f(X1, 5), ok ? 'ok' : 'bad'], ['Max possible $X_1^* = Y_1/m$', f(Xmax, 5)], ['Minimum solvent $L_{s,min}$', f(Lmin, 1) + ' kmol/h'], ['$L_s/L_{s,min}$', f(s.Ls / Lmin, 2), s.Ls / Lmin < 1 ? 'bad' : 'ok'], ['Absorption factor A = L/mG', f(A, 3)], ['Ideal stages (Kremser)', ok && isFinite(N) ? f(N, 2) : 'impossible — add solvent', ok ? '' : 'bad']]);
          }
        });
        UI.note(tb.panes[1], 'Use <b>solute-free</b> flows ($G_s$, $L_s$) and mole <b>ratios</b> ($Y = y/(1-y)$): carrier gas and solvent do not transfer, so $G_s$ and $L_s$ are constant through the tower and the balance line (operating line) is straight. Below $L_{s,min}$ the liquid would have to leave richer than equilibrium allows.');
        // --- scrubber loop
        scrubberSim(tb.panes[2], UI);
      },
      fx: [['↑ Liquid rate L (absorber)', '↓ X₁ (more dilute liquid), fewer stages, more solvent to regenerate'], ['L → L_min', 'pinch: infinite stages'], ['↓ Murphree efficiency', 'less solute transferred on each tray'], ['↑ Allowed slurry solids', '↓ blowdown and make-up water'], ['↑ Evaporation', '↑ make-up water even with no blowdown change']],
      quiz: [{ q: 'An absorber treats G_s = 100 kmol/h with Y₁ = 0.05 and 90 % recovery, L_s = 150 kmol/h, X₂ = 0. X₁ = ?', o: ['0.030', '0.045', '0.0333', '0.050'], a: 0, ex: 'Y₂ = 0.005; X₁ = (100/150)(0.05 − 0.005) = 0.030.' },
        { q: 'Why are solute-free flows used in absorber balances?', o: ['They are larger', 'Carrier and solvent are not transferred, so they stay constant along the column', 'Required by Henry’s law', 'To include temperature'], a: 1 },
        { q: 'In a scrubber loop, blowdown is needed to…', o: ['cool the gas', 'remove captured solids and keep slurry concentration below a limit', 'raise pH', 'increase ΔP'], a: 1 }],
      refs: ["<i>Felder, R.M. & Rousseau, R.W.</i> (2005) <i>Elementary Principles of Chemical Processes</i>, 3rd ed., Wiley. (balances on recycle and purge systems)", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 6 (equipment for gas–liquid operations).", "<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill.", "<i>Murphree, E.V.</i> (1925) Rectifying column calculations. <i>Ind. Eng. Chem.</i> 17, 747–750."]
    }
  ];

  // scrubber loop balance (venturi + separator + recirculation pump, blowdown & make-up)
  function scrubberSim(el, UI) {
    const d = UI.h('div', { class: 'card pad' });
    UI.sim(el, {
      title: 'Venturi scrubber loop', controls: [
        { k: 'Q', label: 'Gas flow', min: 1, max: 100, step: .5, v: 20, unit: 'm³/s' }, { k: 'cin', label: 'Dust loading in', min: .1, max: 20, step: .1, v: 5, unit: 'g/m³' },
        { k: 'eta', label: 'Collection efficiency', min: 50, max: 99.9, step: .1, v: 98, unit: '%' }, { k: 'LG', label: 'Recirculation L/G', min: .3, max: 3, step: .05, v: 1, unit: 'L/m³' },
        { k: 'sol', label: 'Max solids in slurry', min: 1, max: 20, step: .5, v: 5, unit: 'wt %' }, { k: 'ev', label: 'Water evaporated into gas', min: 0, max: 30, step: .5, v: 10, unit: 'g/m³' }],
      views: [{ k: 'd', t: 'html' }, { k: 'ro', t: 'ro' }],
      update(s, V) {
        if (!d.parentNode) V.d.append(d);
        const din = s.Q * s.cin * 3.6, cap = din * s.eta / 100, dout = din - cap, bd = cap / (s.sol / 100), bdw = bd - cap, evp = s.Q * s.ev * 3.6, mk = bdw + evp, rc = s.Q * s.LG * 3600;
        svg(d, `<path class="s" d="M150,95 H215 L255,118 H295 L345,95 H385"/><path class="s" d="M150,145 H215 L255,126 H295 L345,145 H385"/><rect class="lq2" x="388" y="190" width="74" height="20"/><rect class="s" x="385" y="40" width="80" height="170" rx="6"/><path class="s" d="M385,210 L425,245 L465,210"/>`
          + `<circle class="s" cx="300" cy="262" r="14"/>` + T(300, 266, 'P', 'middle') + `<path class="s" d="M425,245 V262 H314 M286,262 H245 V112 H262"/>` + T(170, 282, `recirculation ${f(rc / 1000, 1)} t/h`, 'middle', 'k')
          + arw(40, 120, 146, 120) + T(20, 100, 'Dirty gas') + T(20, 140, `dust ${f(din, 1)} kg/h`, 'start', 'v')
          + arw(425, 36, 425, 6) + T(675, 16, `Clean gas: dust ${f(dout, 2)} kg/h (${f(s.cin * (1 - s.eta / 100) * 1000, 0)} mg/m³)`, 'end', 'v') + T(675, 32, `+ water vapour ${f(evp, 0)} kg/h`, 'end', 'k')
          + arw(560, 150, 470, 150) + T(500, 140, 'Make-up water', 'start') + T(500, 172, `${f(mk, 0)} kg/h`, 'start', 'v')
          + arw(465, 230, 590, 282) + T(675, 302, `Blowdown ${f(bd, 0)} kg/h (${f(s.sol, 1)} % solids)`, 'end', 'v') + T(255, 98, 'throat', 'middle', 'k') + T(425, 130, 'separator', 'middle', 'k'), '0 0 680 310');
        V.ro.set([['Dust in', f(din, 1) + ' kg/h'], ['Dust captured', f(cap, 1) + ' kg/h'], ['Dust out (emission)', f(dout, 2) + ' kg/h', 'warn'], ['Blowdown slurry', f(bd, 0) + ' kg/h'], ['Water in blowdown', f(bdw, 0) + ' kg/h'], ['Evaporated', f(evp, 0) + ' kg/h'], ['Make-up water', f(mk, 0) + ' kg/h', 'ok'], ['Check: water in − out', f(mk - bdw - evp, 6), 'ok']]);
      }
    });
    UI.note(el, 'Two balances: <b>dust</b> — in = captured + emitted, and the captured dust leaves only in the blowdown, whose solids content is capped ($B = \\text{captured}/w_{max}$). <b>Water</b> — make-up = blowdown water + water evaporated into the gas. The recirculation flow cancels out of both balances (it stays inside the boundary).');
  }
})();
