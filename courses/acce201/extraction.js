/* ACCE 201 · Unit 3 — Liquid extraction (data: water–acetic acid–isopropyl ether, 20 °C, Treybal) */
window.T201 = window.T201 || {};
(function () {
  const C = Chem, L = C.lle, s3 = Math.sqrt(3) / 2;
  const P = q => [q.b + q.c / 2, q.c * s3];                       // composition {a,b,c} → triangle xy
  const tieRows = () => L.R.map((r, i) => [{ c: r[0] / 100, a: r[1] / 100, b: r[2] / 100 }, { c: L.E[i][0] / 100, a: L.E[i][1] / 100, b: L.E[i][2] / 100 }]);

  function triangle(p, UI, tl = true) {
    p.frame({ x: [-.06, 1.45], y: [-.08, s3 + .05], bare: 1 }); // extra room on the right keeps the legend clear of the apex
    p.line([[0, 0], [1, 0], [.5, s3], [0, 0]], { c: 'tx', w: 1.6 });
    for (let k = 1; k < 10; k++) { const f = k / 10; // grid lines of constant C, B, A
      p.line([P({ c: f, b: 0 }), P({ c: f, b: 1 - f })], { c: 'grid', w: 1 }); p.line([P({ b: f, c: 0 }), P({ b: f, c: 1 - f })], { c: 'grid', w: 1 }); p.line([P({ b: 0, c: f }), P({ b: 1 - f, c: 0 })], { c: 'grid', w: 1 });
      p.text(...P({ c: f, b: 1 - f }), (k * 10) + '', { dx: 4, bl: 'middle', size: 10, c: 'mu' }); }
    p.text(0, 0, 'A  ' + L.A, { al: 'left', bl: 'top', dy: 6, b: 1 }); p.text(1, 0, L.B + '  B', { al: 'right', bl: 'top', dy: 6, b: 1 }); p.text(.5, s3, 'C  ' + L.Cc, { al: 'center', dy: -4, b: 1 });
    const bin = C.binodal().map(P); p.line(bin, { c: 'c1', fill: 1, fa: .07 }); p.line(bin, { c: 'c1', w: 2.2, l: 'Binodal (solubility) curve' });
    if (tl) tieRows().forEach(([r, e]) => p.line([P(r), P(e)], { c: 'c2', w: 1, dash: [3, 3] })); if (tl) p.line([[0, 0], [0, 0]], { c: 'c2', dash: [3, 3], w: 1, l: 'Tie lines (experimental)' });
    const pl = P({ c: L.plait[0] / 100, b: L.plait[2] / 100 }); p.pts([pl], { c: 'c4', r: 5, l: 'Plait point (approx.)' });
  }
  T201.triangle = triangle; T201.triP = P;
  const hov = (x, y) => { const c = y / s3, b = x - c / 2, a = 1 - b - c; if (a < -1e-3 || b < -1e-3 || c < -1e-3) return ''; return `A ${(a * 100).toFixed(1)}%  B ${(b * 100).toFixed(1)}%  C ${(c * 100).toFixed(1)}%`; };


  /* ---------- shared 3-D builders ---------- */
  const RHO = { a: 998, b: 724, c: 1049 }, rhoMix = q => 1 / (q.a / RHO.a + q.b / RHO.b + q.c / RHO.c); // kg/m³, 20 °C, ideal volume additivity
  const AQ = [.42, .68, .93], OR = [.95, .78, .45], AQD = [.13, .42, .85], ORD = [.88, .55, .12], RED = [.86, .1, .1], SHELL = 0xa9c4dd, METAL = 0x9aa3ab, DARK = 0x5d666e;
  const cl = (v, a, b) => Math.min(b, Math.max(a, v)), lerp = (a, b, k) => a + (b - a) * k, mixc = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k), f = (v, d = 3) => UI.fmt(v, d);
  const pct = q => `C ${(100 * q.c).toFixed(1)} · A ${(100 * q.a).toFixed(1)} · B ${(100 * q.b).toFixed(1)} wt %`;
  function stage(F, xF, S) { const Mm = F + S, M = { c: xF * F / Mm, a: (1 - xF) * F / Mm, b: S / Mm }; return { Mm, M, sp: C.lleSplit(M, Mm) }; }
  const tint = (m, c) => { m.material.color.setRGB(...c); m.material.depthWrite = false; return m; };

  /* 3.1 separatory funnel: pour feed → add solvent → shake → settle → two layers */
  function funnel(v, st) {
    const g = new THREE.Group(); v.root.add(g);
    const R = .8, y0 = .8, Hc = 2.6, top = y0 + Hc;
    v.cyl(R + .03, Hc, SHELL, [0, y0 + Hc / 2, 0], { op: .15, ds: 1, open: 1, parent: g });
    v.cyl(.07, y0 - .1, SHELL, [0, .1 + (y0 - .1) / 2, 0], { r2: R + .03, op: .15, ds: 1, open: 1, parent: g });
    v.cyl(.045, .7, SHELL, [0, -.25, 0], { op: .35, parent: g }); v.box(.45, .09, .09, DARK, [0, .02, 0], { parent: g });
    v.cyl(.22, .25, SHELL, [0, top + .12, 0], { op: .2, ds: 1, open: 1, parent: g }); v.cyl(.2, .2, DARK, [0, top + .34, 0], { parent: g });
    const lo = tint(v.cyl(R - .02, 1, 0xffffff, [0, 0, 0], { op: .45, ds: 1, parent: g }), AQ), hi = tint(v.cyl(R - .02, 1, 0xffffff, [0, 0, 0], { op: .45, ds: 1, parent: g }), OR);
    const cone = tint(v.cyl(.06, y0 - .12, 0xffffff, [0, .11 + (y0 - .12) / 2, 0], { r2: R - .03, op: .45, ds: 1, parent: g }), AQ), pour = tint(v.cyl(.05, 1, 0xffffff, [0, 0, 0], { op: .7 }), AQ);
    const ND = 220, NA = 70, N = ND + NA, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), spd = Float32Array.from({ length: N }, () => .5 + Math.random());
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: .085, vertexColors: true, transparent: true, depthWrite: false })));
    for (let i = 0; i < N; i++) col.set(i < ND ? ORD : RED, i * 3);
    const put = (i, a, b) => { const an = Math.random() * 6.283, r = Math.sqrt(Math.random()) * (R - .12); pos[i * 3] = Math.cos(an) * r; pos[i * 3 + 1] = a + Math.random() * Math.max(.01, b - a); pos[i * 3 + 2] = Math.sin(an) * r; };
    const walk = (i, a, b, step) => { const j = i * 3; pos[j] += (Math.random() - .5) * step; pos[j + 2] += (Math.random() - .5) * step; const r = Math.hypot(pos[j], pos[j + 2]), m = R - .12; if (r > m) { pos[j] *= m / r; pos[j + 2] *= m / r; }
      const y = pos[j + 1]; if (y < a - .02) pos[j + 1] = Math.min(a, y + 1.2 * step * 8); else if (y > b + .02) pos[j + 1] = Math.max(b, y - 1.2 * step * 8); else pos[j + 1] = cl(y + (Math.random() - .5) * step, a, b); };
    const lay = (m, b, hgt) => { m.visible = hgt > .005; m.scale.y = Math.max(hgt, .001); m.position.y = b + hgt / 2; };
    const tL = v.tag('Lower layer: water-rich (raffinate)', [-R, 1, 0], 'low'), tU = v.tag('Upper layer: ether-rich (extract)', [R, 2, 0], 'up');
    v.tag('Stopcock: drains the lower layer', [0, .02, 0], 'cock'); v.tag('Red dots: acetic acid molecules', [-R, 3.1, 0], 'acid');
    st.t = 0; let last = -1;
    v.tick((t, dt) => {
      const T = (st.t += dt), ph = T < 2.5 ? 0 : T < 5 ? 1 : T < 10 ? 2 : T < 16 ? 3 : 4, fF = cl(T / 2.5, 0, 1), fS = cl((T - 2.5) / 2.5, 0, 1), se = cl((T - 10) / 5, 0, 1);
      const cloudy = mixc(AQ, OR, .45);
      let low, up;
      if (ph <= 1) { low = st.hF * fF; up = st.hS * fS; tint(lo, AQ); }
      else if (ph === 2) { low = st.hTot; up = 0; tint(lo, cloudy); }
      else { const k = ph === 4 ? 1 : se; low = lerp(st.hTot, st.hR, k); up = st.hTot - low; tint(lo, st.single ? mixc(cloudy, mixc(AQ, OR, .3), k) : mixc(cloudy, AQ, k)); }
      lay(lo, y0, low); lay(hi, y0 + low, up); cone.visible = T > .3;
      const lvl = y0 + (ph === 0 ? low : low + up); pour.visible = ph <= 1 && (ph === 0 ? fF : fS) < 1; if (pour.visible) { tint(pour, ph === 0 ? AQ : OR); pour.scale.y = top + .6 - lvl; pour.position.y = (top + .6 + lvl) / 2; }
      g.rotation.z = ph === 2 ? .45 * Math.sin((T - 5) * 6) * cl(T - 5, 0, 1) * cl(10 - T, 0, 1) : 0;
      if (ph !== last) { if (ph === 2) for (let i = 0; i < ND; i++) put(i, y0, y0 + st.hTot); if (ph === 0) for (let i = ND; i < N; i++) put(i, y0, y0 + .02); last = ph; }
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        if (i < ND) { // solvent droplets
          if (ph < 2) { pos[j + 1] = -999; continue; }
          if (ph === 2) { if (Math.random() < .12) put(i, y0 + .03, y0 + st.hTot - .03); else walk(i, y0, y0 + st.hTot, .05); continue; }
          if (pos[j + 1] < -99) continue;
          if (st.single) { if ((i % 97) / 97 < se * 1.05) pos[j + 1] = -999; continue; }
          pos[j + 1] += spd[i] * .55 * dt; if (pos[j + 1] > y0 + low) pos[j + 1] = -999; continue;
        }
        const k = i - ND; // acid molecules
        if (ph === 0 && k >= NA * fF) { pos[j + 1] = -999; continue; }
        if (pos[j + 1] < -99) put(i, y0 + .03, y0 + Math.max(.06, low - .03));
        if (ph <= 1) walk(i, y0 + .03, y0 + Math.max(.06, low - .03), .03);
        else if (ph === 2) walk(i, y0 + .03, y0 + st.hTot - .03, .06);
        else if (k < st.nE) walk(i, y0 + low + .04, y0 + low + Math.max(.08, up - .04), .03);
        else walk(i, y0 + .03, y0 + Math.max(.06, low - .03), .03);
      }
      geo.attributes.position.needsUpdate = true;
      tL.p.y = y0 + low / 2; tU.p.y = y0 + low + Math.max(up, .2) / 2;
    });
  }

  /* 3.2 continuous mixer–settler (one ideal stage) */
  function mixset(v, st) {
    const { cstream, pathAt, hsh } = T201.fx3, xm = -3.6, Rm = .85, Hm = 1.9, xs0 = -1.8, xs1 = 3.6, Hs = 1.5, D = 1.5, yI = .7, yW = 1.25, Ls = xs1 - xs0, xc = (xs0 + xs1) / 2;
    v.cyl(Rm, Hm, SHELL, [xm, Hm / 2, 0], { op: .14, ds: 1, open: 1 }); v.cyl(Rm, .05, METAL, [xm, 0, 0]);
    tint(v.cyl(Rm - .03, 1.55, 0xffffff, [xm, .79, 0], { op: .18, ds: 1 }), mixc(AQ, OR, .45));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + .4; v.box(.16, Hm - .15, .04, METAL, [xm + Math.cos(a) * (Rm - .1), Hm / 2, Math.sin(a) * (Rm - .1)], { rot: [0, -a, 0], op: .6 }); }
    v.cyl(.03, Hm + .3, DARK, [xm, Hm / 2 + .55, 0]); v.box(.45, .4, .45, DARK, [xm, Hm + .85, 0]);
    const imp = new THREE.Group(); imp.position.set(xm, .55, 0); v.root.add(imp); v.cyl(.2, .03, METAL, [0, 0, 0], { parent: imp });
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; v.box(.14, .15, .02, METAL, [Math.cos(a) * .27, 0, Math.sin(a) * .27], { rot: [0, -a, 0], parent: imp }); }
    v.box(Ls, Hs, D, SHELL, [xc, Hs / 2, 0], { op: .12, ds: 1 });
    tint(v.box(Ls - .3, yI, D - .06, 0xffffff, [xc - .15, yI / 2, 0], { op: .3, ds: 1 }), AQ); tint(v.box(Ls - .3, yW - yI, D - .06, 0xffffff, [xc - .15, (yI + yW) / 2, 0], { op: .3, ds: 1 }), OR);
    tint(v.box(1.9, .34, D - .08, 0xffffff, [xs0 + 1, yI, 0], { op: .35, ds: 1 }), mixc(AQ, OR, .45));
    v.box(.04, yW, D - .05, METAL, [xs1 - .3, yW / 2, 0], { op: .6 });
    // weir box: holds only overflowed extract; extract leaves high on the end wall
    const yE = .95, yJ = yI + .73 * (yW - yI); // jackleg crest from hydrostatics: ρ_R·h = ρ_R·y_I + ρ_E·(y_W − y_I), ρ_E/ρ_R ≈ 0.73
    tint(v.box(.24, yE + .1, D - .08, 0xffffff, [xs1 - .15, (yE + .1) / 2, 0], { op: .3, ds: 1 }), OR);
    const P = {
      feed: [[-7, .3, 0], [xm - Rm, .3, 0]], solv: [[xm - .35, .25, 2.4], [xm - .35, .25, Rm - .1]],
      over: [[xm + Rm, 1.55, 0], [-2.2, 1.55, 0], [-2.2, yI, 0], [xs0 + .02, yI, 0]],
      ext: [[xs1, yE, .4], [6.6, yE, .4]], raf: [[xs1 - .7, 0, -.3], [xs1 - .7, -.45, -.3], [5.6, -.45, -.3], [5.6, yJ, -.3], [6.6, yJ, -.3]]
    };
    Object.values(P).forEach(q => v.pipe(q, .07, METAL, { op: .35 }));
    const L = (pp, c, n, sp) => cstream(v, n, .1, u => pathAt(pp, u), () => c, sp);
    const EX = [[xs1 - .5, yW - .06, .4], [xs1 - .3, yW + .06, .4], [xs1 - .15, yE + .05, .4], ...P.ext];
    const sF = L(P.feed, AQD, 60, .3), sS = L(P.solv, ORD, 50, .3), sO = cstream(v, 70, .1, u => pathAt(P.over, u), (u, i) => i % 2 ? AQD : ORD, .25), sE = L(EX, ORD, 60, .25), sR = L(P.raf, AQD, 80, .2);
    const sw = cstream(v, 260, .09, (u, i) => { const a = u * 12.566 + i, r = .12 + .62 * hsh(i, 13); return [xm + Math.cos(a) * r, .12 + 1.5 * hsh(i, 7) + .06 * Math.sin(u * 30 + i), Math.sin(a) * r]; }, (u, i) => i % 2 ? AQD : ORD, .2);
    const st3 = cstream(v, 300, .09, (u, i) => { const x = xs0 + .1 + u * (Ls - .55), k = cl(u / .4, 0, 1), y0 = .15 + 1 * hsh(i, 3), yt = i % 2 ? .06 + (yI - .12) * hsh(i, 5) : yI + .06 + (yW - yI - .12) * hsh(i, 5); return [x, lerp(y0, yt, k * k * (3 - 2 * k)), (hsh(i, 11) - .5) * (D - .25)]; }, (u, i) => i % 2 ? AQD : ORD, .06);
    v.tick((t, dt) => { imp.rotation.y += dt * st.N / 60 * 6.283 * .25; sw.speed = .05 + st.N / 1500; const q = st.Q || 1; sF.speed = .15 * st.Fr; sS.speed = .15 * st.Sr; sO.speed = sE.speed = sR.speed = .12 * q; st3.speed = .04 * q; });
    v.tag('Feed: water + acetic acid', [-6.8, .3, 0], 'feed'); v.tag('Solvent: isopropyl ether', [xm - .35, .25, 2.3], 'solv'); v.tag('MIXER: turbine makes droplets', [xm - Rm, 1.4, 0], 'mix'); v.tag('Baffles stop swirling', [xm + Rm * .7, 1.7, Rm * .7], 'baff');
    v.tag('Dispersion band: drops coalesce', [xs0 + 1, yI + .17, D / 2], 'band'); v.tag('Light extract layer (ether-rich)', [xc + 1, (yI + yW) / 2, -D / 2], 'ext'); v.tag('Heavy raffinate layer (water-rich)', [xc + 1, yI / 2, D / 2], 'raf');
    v.tag('Weir: extract overflows', [xs1 - .3, yW, 0], 'weir'); v.tag('Jackleg sets the interface height', [5.6, .3, -.3], 'jack'); v.tag('Extract out (top)', [6.5, yE, .4], 'eo'); v.tag('Raffinate out', [6.5, yJ, -.3], 'ro'); v.tag('SETTLER', [xc, Hs, 0], 'set');
  }
  function msSVG(el, F, xF, S, R) {
    const T = (x, y, t, a = 'start', c = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${t}</text>`, ar = (x1, y1, x2, y2) => `<line class="s" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ar)"/>`;
    const sp = R.sp, ac = sp ? sp.Rmass * sp.R.c + sp.Emass * sp.E.c : F * xF;
    UI.svg(el, `<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="a"/></marker></defs>`
      + `<rect class="s" x="170" y="80" width="80" height="100" rx="8"/>` + T(210, 134, 'Mixer', 'middle', 'k') + `<rect class="s" x="330" y="80" width="210" height="100" rx="6"/><line class="t" x1="330" y1="130" x2="540" y2="130"/>` + T(435, 112, 'Settler', 'middle', 'k')
      + ar(20, 150, 166, 150) + T(24, 140, `Feed F = ${f(F, 0)} kg/h`) + T(24, 170, `C ${(100 * xF).toFixed(1)} · A ${(100 - 100 * xF).toFixed(1)} wt %`, 'start', 'mu')
      + ar(210, 22, 210, 76) + T(220, 34, `Solvent S = ${f(S, 0)} kg/h (pure ether)`)
      + ar(250, 130, 326, 130) + T(288, 122, `M = ${f(F + S, 0)}`, 'middle', 'mu')
      + (sp ? ar(540, 105, 690, 105) + T(548, 96, `Extract E = ${f(sp.Emass, 1)} kg/h`, 'start', 'v') + T(548, 122, pct(sp.E), 'start', 'mu')
        + ar(540, 158, 690, 158) + T(548, 149, `Raffinate R = ${f(sp.Rmass, 1)} kg/h`, 'start', 'v') + T(548, 176, pct(sp.R), 'start', 'mu')
        : T(548, 130, 'one liquid phase: no separation', 'start', 'mu'))
      + T(380, 210, `Total: F + S = ${f(F + S, 1)}  =  E + R = ${f(sp ? sp.Emass + sp.Rmass : F + S, 1)} kg/h`, 'middle', 'k')
      + T(380, 230, `Acid: in F·x_F = ${f(F * xF, 2)}  =  out E·y_E + R·x_R = ${f(ac, 2)} kg/h`, 'middle', 'k')
      + T(380, 252, 'C = acetic acid · A = water · B = isopropyl ether', 'middle', 'mu'), '0 0 760 262', 300).firstChild.classList.add('flow');
  }

  T201.extraction = [
    {
      id: 'ext-basics', title: 'Fields of usefulness, solvent choice & key terms', tags: 'extraction usefulness choice of solvent distribution coefficient selectivity relative volatility',
      blurb: 'When to extract instead of distil, what makes a good solvent, K and β.',
      lead: 'Liquid extraction separates components by their <b>different solubilities</b> in an added solvent, not by volatility. The feed (A + solute C) is contacted with solvent B; the solute partitions between the <b>extract</b> (B-rich) and the <b>raffinate</b> (A-rich) layers.',
      render(el, UI) {
        const st = { hF: .4, hS: .5, hTot: .9, hR: .4, hE: .5, nE: 20, single: false };
        const S0 = UI.sim(el, {
          title: 'One batch extraction in a separatory funnel', controls: [
            { k: 'xF', label: 'Acetic acid in the feed $x_F$', min: .05, max: .4, step: .01, v: .3, hint: '100 g of aqueous feed (water + acetic acid).' },
            { k: 'r', label: 'Solvent / feed ratio $S/F$', min: .02, max: 3, step: .01, v: 1.2, hint: 'Pure isopropyl ether. Very little or very much solvent gives one phase: try 0.03 and 3.' }],
          views: [{ k: 'v', t: '3d', h: 460, cam: [0, 2.2, 7], target: [0, 1.5, 0] }, { k: 'ro', t: 'ro' }],
          update(s, V, S) {
            const F = 100, Sg = s.r * F, { M, sp } = stage(F, s.xF, Sg), Kv = 2.4 / 540, mL = q => 1000 / rhoMix(q);
            const vF = F * mL({ a: 1 - s.xF, b: 0, c: s.xF }), vS = Sg * 1000 / RHO.b, vR = sp ? sp.Rmass * mL(sp.R) : 0, vE = sp ? sp.Emass * mL(sp.E) : 0;
            Object.assign(st, { hF: vF * Kv, hS: vS * Kv, hTot: (vF + vS) * Kv, single: !sp, hR: sp ? vR * Kv : (vF + vS) * Kv, hE: sp ? vE * Kv : 0, nE: sp ? Math.round(70 * sp.Emass * sp.E.c / (F * s.xF)) : 0 });
            const key = s.xF + '|' + s.r; if (S._k !== key) { S._k = key; st.t = 0; }
            if (!S._b && V.v.ok) { S._b = 1; funnel(V.v, st); }
            const base = [['Feed', `100 g = ${f(vF, 0)} mL`], ['Solvent (ether, ρ = 0.724 g/cm³)', `${f(Sg, 1)} g = ${f(vS, 0)} mL`], ['Mixture M', pct(M)]];
            if (!sp) { V.ro.set(base.concat([['Result', M.b < .5 ? 'ONE phase: all the ether dissolves in the water (below minimum solvent)' : 'ONE phase: all the water dissolves in the ether (above maximum solvent)', 'bad']])); return; }
            V.ro.set(base.concat([['Lower layer = raffinate', `${f(sp.Rmass, 1)} g, ${f(vR, 0)} mL, ρ ≈ ${f(rhoMix(sp.R) / 1000, 3)}`], ['Raffinate composition', pct(sp.R)], ['Upper layer = extract', `${f(sp.Emass, 1)} g, ${f(vE, 0)} mL, ρ ≈ ${f(rhoMix(sp.E) / 1000, 3)}`], ['Extract composition', pct(sp.E)],
              ['Distribution coeff. $K = y_C/x_C$', f(sp.K, 3)], ['Selectivity β', f(sp.beta, 2)], ['<b>Acid extracted</b>', f(100 * sp.Emass * sp.E.c / (F * s.xF), 1) + ' %', 'ok']]));
          }
        });
        S0.ctl.append(h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: () => { st.t = 0; } }, '⟲ Run the extraction again'));
        UI.walk(el, [
          { t: '1 · Pour in the feed', d: 'The feed is water containing acetic acid (red dots). We want the acid out of the water without boiling the water off.', hi: ['low', 'acid'], at: 0 },
          { t: '2 · Add the solvent', d: 'Isopropyl ether hardly dissolves in water and is lighter (0.72 vs 1.0 g/cm³), so it floats as a <b>separate layer</b>. All the acid is still in the water: the only contact is the small flat interface, so transfer is very slow.', hi: ['up'], at: 2.5 },
          { t: '3 · Shake', d: 'Shaking breaks the ether into many small droplets. The <b>interfacial area</b> grows enormously and acid molecules cross into the ether within minutes. (In the lab, vent the funnel: ether has a high vapour pressure.)', hi: ['acid'], at: 5 },
          { t: '4 · Settle', d: 'Left alone, the light droplets rise and <b>coalesce</b>; the interface reappears. The density difference drives this, and a moderate interfacial tension stops a stable emulsion forming.', hi: ['up', 'low'], at: 10 },
          { t: '5 · Two layers in equilibrium', d: 'The upper <b>extract</b> and lower <b>raffinate</b> are in equilibrium: their compositions are the two ends of one <b>tie line</b>. Each is saturated with the other liquid. Drain the lower layer through the stopcock; add fresh ether to extract more.', hi: ['cock'], at: 16 }
        ], (i, x) => { st.t = x.at; S0.V.v.hi && S0.V.v.hi(x.hi); });
        UI.note(el, 'Layer masses and compositions come from the lever rule on the measured tie lines (water – acetic acid – isopropyl ether, 20 °C; Treybal). Here acetic acid prefers the water (K < 1 by mass), so a single contact recovers only part of it: this is why industry uses several stages.');
        UI.sec(el, 'Fields of usefulness — extract when distillation is poor');
        el.append(UI.h('div', { class: 'grid g2' }, ...[['Close-boiling or azeotropic mixtures', 'α ≈ 1 makes distillation need huge reflux; a solvent can create a large selectivity (e.g. aromatics from paraffins with sulfolane).'], ['Heat-sensitive materials', 'Antibiotics, vitamins, flavours: extraction runs at room temperature.'], ['Dilute high-boiling solute in water', 'Acetic acid from water: distillation would boil off all the water (λ = 2257 kJ/kg). Extract, then distil the small solvent stream.'], ['Metals & non-volatiles', 'Uranium, copper (hydrometallurgy) cannot be distilled at all.']].map(([a, b]) => UI.h('div', { class: 'card pad' }, UI.h('b', null, a), UI.h('p', { class: 'hint', style: 'margin:4px 0 0' }, b)))));
        const dm = UI.more(el, 'Design data: distribution coefficient and selectivity from tie lines');
        UI.sec(dm, 'Distribution coefficient and selectivity from real tie-line data', L.name + '. Hover the chart to read values.');
        UI.sim(dm, {
          title: 'Read the tie lines', controls: [{ k: 't', label: 'Tie line position (dilute → concentrated)', min: 0, max: 8, step: .01, v: 3 }, { k: 'show', t: 'seg', label: 'Plot', v: 'dist', opts: { dist: 'Distribution curve', sel: 'Selectivity β' } }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 360 }],
          update(s, V) {
            const { R, E } = C.lleRow(s.t), K = E.c / R.c, beta = (E.c / E.a) / (R.c / R.a);
            V.ro.set([['Raffinate $x_C$ (wt frac.)', UI.fmt(R.c, 4)], ['Extract $y_C$ (wt frac.)', UI.fmt(E.c, 4)], ['Distribution coeff. $K = y_C/x_C$', UI.fmt(K, 3)], ['Selectivity $\\beta$', UI.fmt(beta, 2), beta > 1 ? 'ok' : 'bad'], ['Water in extract', UI.fmt(E.a * 100, 2) + ' %'], ['Ether in raffinate', UI.fmt(R.b * 100, 2) + ' %']]);
            const rows = Array.from({ length: 81 }, (_, i) => C.lleRow(i / 10));
            if (s.show === 'dist') {
              const p = V.p.frame({ x: [0, .5], y: [0, .5], xl: 'x_C — acid in raffinate (wt frac.)', yl: 'y_C — acid in extract (wt frac.)', xs: 'x', ys: 'y' });
              p.line(rows.map(r => [r.R.c, r.E.c]), { l: 'Equilibrium distribution curve' }); p.fn(x => x, 0, .5, { c: 'mu', w: 1, l: 'y = x (K = 1)' });
              p.pts(tieRows().map(([r, e]) => [r.c, e.c]), { c: 'c2', l: 'Treybal data' }); p.pts([[R.c, E.c]], { c: 'tx', r: 6 }); p.done();
            } else {
              const p = V.p.frame({ x: [0, .5], y: [0, 40], xl: 'x_C — acid in raffinate (wt frac.)', yl: 'β = (y_C/y_A)/(x_C/x_A)', xs: 'x', ys: 'β' });
              p.line(rows.slice(0, 78).map(r => [r.R.c, (r.E.c / r.E.a) / (r.R.c / r.R.a)]), { l: 'Selectivity' }); p.hl(1, { l: 'β = 1 — no separation' }); p.pts([[R.c, beta]], { c: 'tx', r: 6 }); p.done();
            }
          }
        });
        UI.note(dm, 'β is the extraction analogue of <b>relative volatility</b> α in distillation: β = 1 means the solvent takes solute and water in the same ratio — no separation, exactly like α = 1 (an azeotrope). At the plait point both phases become identical, so β → 1.');
        UI.sec(el, 'Choice of solvent');
        el.append(UI.table(['Property', 'What you want', 'Why'], [['Selectivity β', '≫ 1', 'fewer stages, purer extract'], ['Distribution coefficient K', 'high', 'less solvent needed (S_min ∝ 1/K)'], ['Insolubility in feed solvent', 'low mutual solubility', 'large two-phase region, easy recovery'], ['Recoverability', 'large α vs solute, no azeotrope', 'solvent is distilled and recycled'], ['Density difference', '> 0.1 g/cm³', 'fast settling in decanters'], ['Interfacial tension', 'moderate', 'too low → emulsions; too high → poor dispersion'], ['Chemical reactivity', 'inert, stable', 'no losses, no side products'], ['Viscosity, vapour pressure, freezing point', 'low', 'easy handling and pumping'], ['Safety & cost', 'non-toxic, non-flammable, cheap', 'plant safety and economics']]));
      },
      eqs: [
        { n: 'Distribution coefficient', m: 'K = \\frac{y_C}{x_C}', w: 'y in extract, x in raffinate (mass or mole fraction)' },
        { n: 'Selectivity (separation factor)', m: '\\beta = \\frac{y_C/y_A}{x_C/x_A} = K_C/K_A' },
        { n: 'Relative volatility analogy', m: '\\alpha_{AB} = \\frac{y_A/x_A}{y_B/x_B}' },
        { n: 'Percentage extraction', m: '\\%\\,E = \\frac{E\\,y_C}{F\\,x_{C,F}}\\times100' }],
      fx: [['↑ K', 'less solvent needed for the same recovery'], ['↑ β', 'purer extract, fewer stages'], ['Approaching plait point', 'phases become alike, β → 1, separation impossible'], ['↑ Temperature (usually)', 'mutual solubility ↑, two-phase region shrinks']],
      quiz: [{ q: 'Acetic acid is recovered from dilute aqueous solution by extraction rather than distillation mainly because…', o: ['acetic acid is heat-sensitive', 'water is more volatile and would all have to be evaporated', 'they form an azeotrope', 'acetic acid is a solid'], a: 1 }, { q: 'A selectivity β = 1 means…', o: ['perfect separation', 'no separation is possible', 'K = 1', 'single phase'], a: 1 },
        { q: 'Why is the funnel shaken?', o: ['to heat the liquids', 'to create a large interfacial area so equilibrium is reached quickly', 'to change the equilibrium', 'to dissolve the solvent completely'], a: 1, ex: 'Shaking does not change where equilibrium lies, only how fast it is reached.' }],
      refs: ['<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 10 (liquid extraction; water – acetic acid – isopropyl ether tie-line data).', '<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 8 (liquid–liquid extraction with ternary systems).', '<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 15 (liquid–liquid extraction and other liquid–liquid operations and equipment).', '<i>Lo, T.C., Baird, M.H.I. & Hanson, C.</i> (eds.) (1983) <i>Handbook of Solvent Extraction</i>, Wiley.', '<i>Wankat, P.C.</i> (2012) <i>Separation Process Engineering</i>, 3rd ed., Prentice Hall.']
    },

    {
      id: 'mixer-settler', title: 'Mixer–settler: one continuous stage & its material balance', tags: 'mixer settler continuous stage extraction material balance lever rule dispersion band coalescence weir jackleg impeller',
      blurb: 'The industrial version of the funnel: mix, settle, balance.',
      lead: 'A <b>mixer–settler</b> does continuously what the funnel does in batch: a stirred tank disperses one liquid in the other, then a long settler lets the drops coalesce into two layers. One well-designed unit behaves almost as one <b>ideal stage</b>. Several are linked into cross-current or counter-current cascades.',
      render(el, UI) {
        const st = { N: 200, Fr: 1, Sr: 1, Q: 1 };
        const S = UI.sim(el, {
          title: 'Mixer–settler (one ideal stage)', controls: [
            { k: 'F', label: 'Feed rate $F$', min: 200, max: 5000, step: 50, v: 1000, unit: 'kg/h' }, { k: 'xF', label: 'Acetic acid in feed $x_F$', min: .05, max: .4, step: .01, v: .3 },
            { k: 'S', label: 'Solvent rate $S$ (pure ether)', min: 50, max: 6000, step: 25, v: 1200, unit: 'kg/h' },
            { t: 'sep', label: 'Mixer' }, { k: 'N', label: 'Impeller speed', min: 50, max: 400, step: 10, v: 200, unit: 'rpm', hint: 'Visual only here: faster stirring gives smaller drops and faster transfer, but drops that are too small settle slowly.' },
            { k: 'tau', label: 'Mixer residence time τ', min: .5, max: 5, step: .1, v: 2, unit: 'min' }],
          views: [{ k: 'v', t: '3d', h: 480, cam: [0, 3.6, 12], target: [0, .7, 0] }, { k: 'd', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 430 }],
          update(s, V, S) {
            const R = stage(s.F, s.xF, s.S), sp = R.sp, Qf = s.F / rhoMix({ a: 1 - s.xF, b: 0, c: s.xF }), Qs = s.S / RHO.b, Q = Qf + Qs, Vm = Q * s.tau / 60, Dm = Math.cbrt(4 * Vm / Math.PI);
            Object.assign(st, { N: s.N, Fr: s.F / 1000, Sr: s.S / 1200, Q: Q / 2.66 });
            if (V.v.ok) { if (!S._b) { S._b = 1; mixset(V.v, st); } const w = V.v.el.clientWidth || 700, k = cl(760 / w, 1, 2.6); if (S._w !== k) { S._w = k; V.v.look([0, 3 + .6 * k, 11.5 * k], [0, .7, 0]); } }
            V.d.innerHTML = ''; msSVG(V.d, s.F, s.xF, s.S, R);
            const ro = [['Mixing point $x_M$', pct(R.M)], ['Volumetric flow (feed + solvent)', f(Q, 3) + ' m³/h'], ['Mixer volume $V = Q\tau$', f(Vm, 3) + ' m³'], ['Mixer diameter (H = T)', f(Dm, 2) + ' m']];
            if (!sp) ro.push(['Result', 'one liquid phase: change S/F', 'bad']);
            else ro.push(['Extract $E$', f(sp.Emass, 1) + ' kg/h'], ['Raffinate $R$', f(sp.Rmass, 1) + ' kg/h'], ['Lever rule $E/M$', f(sp.Emass / R.Mm, 3)], ['$K = y_C/x_C$', f(sp.K, 3)], ['<b>Acid recovered</b>', f(100 * sp.Emass * sp.E.c / (s.F * s.xF), 1) + ' %', 'ok'],
              ['Water balance in = out', f(s.F * (1 - s.xF), 1) + ' = ' + f(sp.Emass * sp.E.a + sp.Rmass * sp.R.a, 1) + ' kg/h'], ['Ether balance in = out', f(s.S, 1) + ' = ' + f(sp.Emass * sp.E.b + sp.Rmass * sp.R.b, 1) + ' kg/h']);
            V.ro.set(ro);
            const p = V.p; triangle(p, UI, false);
            const Fp = { c: s.xF, a: 1 - s.xF, b: 0 }; p.line([P(Fp), [1, 0]], { c: 'mu', w: 1 }); p.pts([P(Fp)], { c: 'tx', r: 5 }); p.text(...P(Fp), ' F', { b: 1, bl: 'middle' }); p.text(1, 0, 'S ', { al: 'right', b: 1, dy: -8 });
            p.pts([P(R.M)], { c: 'c3', r: 5 }); p.text(...P(R.M), ' M', { c: 'c3', bl: 'top', b: 1 });
            if (sp) { p.line([P(sp.R), P(sp.E)], { c: 'c1', w: 2, l: 'Tie line through M' }); p.pts([P(sp.R)], { c: 'c2', r: 5 }); p.pts([P(sp.E)], { c: 'c5', r: 5 }); p.text(...P(sp.R), 'R ', { al: 'right', bl: 'middle', c: 'c2', b: 1 }); p.text(...P(sp.E), ' E', { dx: 20, bl: 'middle', c: 'c5', b: 1 }); }
            p.done(hov);
          }
        });
        UI.walk(el, [
          { t: 'Feed and solvent enter the mixer', d: 'Aqueous feed and ether are pumped into the bottom of a baffled tank. On the triangle, their mixture is the point <b>M</b> on the straight line F–S.', hi: ['feed', 'solv'] },
          { t: 'The turbine disperses', d: 'The impeller breaks one liquid into drops of a fraction of a millimetre. A residence time of a few minutes is usually enough to come close to equilibrium. Baffles stop the liquid swirling as a whole.', hi: ['mix', 'baff'] },
          { t: 'Dispersion flows to the settler', d: 'The mixture overflows into a long, shallow tank at the interface level. Velocities are low so the drops can separate.', hi: ['set'] },
          { t: 'Drops coalesce', d: 'Ether drops rise, water drops sink, and they merge in the <b>dispersion band</b>. The band must end well before the outlets, which sets the settler area.', hi: ['band'] },
          { t: 'Two outlets', d: 'Light <b>extract</b> overflows a weir. Heavy <b>raffinate</b> leaves from the bottom through a <b>jackleg</b> whose height fixes the interface level (a liquid U-tube balance).', hi: ['weir', 'jack', 'eo', 'ro'] },
          { t: 'Material balance', d: 'At steady state F + S = E + R, and each component balances too. The lever rule on the tie line through M gives E and R.', hi: ['ext', 'raf'] }
        ], (i, x) => S.V.v.hi && S.V.v.hi(x.hi), 6000);
        UI.note(el, '<b>Model.</b> One ideal stage: the outlet layers lie on the measured tie line through M (Treybal data, 20 °C), masses from the lever rule. Mixer volume is simply Q·τ. Settler sizing needs drop-settling and coalescence tests and is not modelled.');
      },
      eqs: [
        { n: 'Total balance', m: 'F + S = M = E + R' },
        { n: 'Component balance (i = A, B, C)', m: 'F x_{i,F} + S y_{i,S} = E y_i + R x_i' },
        { n: 'Lever rule', m: '\\frac{E}{M} = \\frac{x_{B,M}-x_{B,R}}{y_{B,E}-x_{B,R}}' },
        { n: 'Mixer volume', m: 'V = (Q_F + Q_S)\\,\\tau' }],
      fx: [['↑ S', 'M moves toward the solvent corner → more acid extracted, more dilute extract'], ['↑ x_F', 'tie lines get shorter (toward the plait point) → poorer separation'], ['↑ Impeller speed', 'smaller drops → faster transfer but slower settling (emulsion risk)'], ['↑ Residence time', 'closer to equilibrium, larger mixer']],
      quiz: [{ q: 'In the settler the extract leaves over a weir because it is…', o: ['heavier', 'lighter', 'more viscous', 'hotter'], a: 1 },
        { q: 'What sets the interface height in a settler?', o: ['the weir alone', 'the height of the raffinate jackleg (hydrostatic balance)', 'the impeller speed', 'the feed composition'], a: 1 },
        { q: 'F = 100 kg/h and S = 120 kg/h. At steady state E + R equals…', o: ['100 kg/h', '120 kg/h', '220 kg/h', 'it depends on K'], a: 2 }],
      refs: ['<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 10 (liquid extraction; water – acetic acid – isopropyl ether tie-line data).', '<i>Godfrey, J.C. & Slater, M.J.</i> (eds.) (1994) <i>Liquid–Liquid Extraction Equipment</i>, Wiley.', '<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 15 (liquid–liquid extraction and other liquid–liquid operations and equipment).', '<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 8 (liquid–liquid extraction with ternary systems).', '<i>Paul, E.L., Atiemo-Obeng, V.A. & Kresta, S.M.</i> (eds.) (2004) <i>Handbook of Industrial Mixing</i>, Wiley-Interscience. (liquid–liquid dispersion)']
    },

    {
      id: 'ternary', title: 'Ternary diagram: binodal, tie lines, plait point & single-stage extraction', tags: 'ternary triangular diagram binodal tie line plait point lever rule mixing point single stage cross current percentage extraction',
      blurb: 'Mix feed and solvent on a real triangular diagram, apply the lever rule.',
      lead: 'Every point inside the triangle is a three-component mixture. Mixtures under the <b>binodal curve</b> split into two liquid layers whose compositions lie at the ends of a <b>tie line</b>. The <b>lever rule</b> gives the amount of each layer.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Single / cross-current stages', controls: [
            { k: 'F', label: 'Feed mass $F$', min: 10, max: 1000, step: 1, v: 100, unit: 'kg' }, { k: 'xF', label: 'Acid in feed $x_F$', min: .02, max: .45, step: .005, v: .30 },
            { k: 'S', label: 'Total solvent (pure ether) $S$', min: 5, max: 1500, step: 1, v: 120, unit: 'kg' }, { k: 'n', t: 'seg', label: 'Cross-current stages (S split equally)', v: 1, opts: { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' } },
            { k: 'tl', t: 'check', label: 'Show experimental tie lines', v: true }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 480 }, { k: 'tb', t: 'html' }],
          update(s, V) {
            const p = V.p; triangle(p, UI, s.tl);
            let R = { c: s.xF, a: 1 - s.xF, b: 0 }, Rm = s.F, Sst = s.S / s.n, Etot = 0, Ec = 0, rows = [], single = false;
            p.pts([P(R)], { c: 'tx', r: 5 }); p.text(...P(R), ' F', { b: 1, bl: 'middle' }); p.pts([[1, 0]], { c: 'tx', r: 5 }); p.text(1, 0, 'S ', { al: 'right', b: 1, dy: -8 });
            for (let k = 0; k < s.n; k++) {
              const Mm = Rm + Sst, M = { c: R.c * Rm / Mm, a: R.a * Rm / Mm, b: (R.b * Rm + Sst) / Mm }, sp = C.lleSplit(M, Mm);
              // stage points crowd together: label only the first and last stage, first above and last below (the table lists all)
              const lab = s.n === 1 || k === 0 || k === s.n - 1, ddy = s.n === 1 ? 0 : k === 0 ? -8 : 8;
              p.line([P(R), [1, 0]], { c: 'mu', w: 1 }); p.pts([P(M)], { c: 'c3', r: 4.5 }); if (lab) p.text(...P(M), ' M' + (s.n > 1 ? k + 1 : ''), { c: 'c3', bl: k === 0 && s.n > 1 ? 'bottom' : 'top', size: 11 });
              if (!sp) { single = true; rows.push([k + 1, Mm, '—', '—', 'single phase']); break; }
              p.line([P(sp.R), P(sp.E)], { c: 'c1', w: 2 }); p.pts([P(sp.R)], { c: 'c2', r: 5 }); p.pts([P(sp.E)], { c: 'c5', r: 5 });
              if (lab) { p.text(...P(sp.R), 'R' + (s.n > 1 ? k + 1 : '') + ' ', { al: 'right', bl: 'middle', dy: ddy, c: 'c2', b: 1 }); p.text(...P(sp.E), ' E' + (s.n > 1 ? k + 1 : ''), { dx: 20, dy: ddy, bl: 'middle', c: 'c5', b: 1 }); }
              rows.push([k + 1, sp.Rmass.toFixed(2), (sp.R.c * 100).toFixed(2), sp.Emass.toFixed(2), (sp.E.c * 100).toFixed(2), sp.K.toFixed(3), sp.beta.toFixed(2)]);
              Etot += sp.Emass; Ec += sp.Emass * sp.E.c; R = sp.R; Rm = sp.Rmass;
            }
            p.done(hov);
            // single-stage solvent limits
            const lim = (lo, hi, want) => C.bisect(S => { const Mm = s.F + S, M = { c: s.xF * s.F / Mm, a: (1 - s.xF) * s.F / Mm, b: S / Mm }; return (C.lleSplit(M, Mm) ? 1 : -1) * want; }, lo, hi, 1e-4);
            const Smin = lim(1e-4, s.F * .5, 1) , Smax = lim(s.F * .5, s.F * 1e3, -1);
            const rec = Ec / (s.F * s.xF) * 100;
            V.ro.set([['Total extract', UI.fmt(Etot, 2) + ' kg'], ['Final raffinate', UI.fmt(Rm, 2) + ' kg'], ['Acid left in raffinate', UI.fmt(R.c * 100, 2) + ' wt %'], ['<b>% extraction</b>', single ? 'single phase' : UI.fmt(rec, 2) + ' %', single ? 'bad' : 'ok'], ['Min. solvent (1 stage)', isNaN(Smin) ? '—' : UI.fmt(Smin, 2) + ' kg'], ['Max. solvent (1 stage)', isNaN(Smax) ? '—' : UI.fmt(Smax, 1) + ' kg'], ['Solvent / feed', UI.fmt(s.S / s.F, 3)]]);
            V.tb.innerHTML = ''; V.tb.append(UI.table(['Stage', 'Raffinate (kg)', 'x_C (%)', 'Extract (kg)', 'y_C (%)', 'K', 'β'], rows, [1, 2, 3, 4, 5, 6]));
          }
        });
        UI.note(el, '<b>Try this:</b> keep total solvent fixed and change 1 → 5 cross-current stages. The same solvent split into fresh portions extracts more acid — the same reason you rinse a beaker several times with small volumes instead of once with a large volume.');
        UI.para(el, '<h3>Reading the diagram</h3><ul><li><b>Binodal curve</b>: boundary between one-phase (outside) and two-phase (inside) mixtures. Left branch = raffinate (water-rich) layer, right branch = extract (ether-rich) layer.</li><li><b>Tie line</b>: joins the two phases in equilibrium. Tie lines slope upward to the right here, so K < 1 by mass (acetic acid prefers water) — a lot of ether is needed.</li><li><b>Plait point</b>: the tie lines shrink to zero length; both phases become identical.</li><li><b>Mixing point M</b> lies on the straight line F–S. Its position follows the <b>lever rule</b>: $F/S = \\overline{MS}/\\overline{FM}$, and after settling $E/R = \\overline{RM}/\\overline{ME}$.</li><li><b>Minimum solvent</b>: M just reaches the binodal near F (one drop of a second phase). <b>Maximum solvent</b>: M reaches the binodal near S — everything dissolves.</li></ul>');
      },
      eqs: [
        { n: 'Total & solute balance (single stage)', m: 'F + S = M = R + E,\\qquad F x_F + S y_S = M x_M = R x_R + E y_E' },
        { n: 'Mixing point', m: 'x_M = \\frac{F x_F + S y_S}{F+S}' },
        { n: 'Lever rule', m: '\\frac{E}{M} = \\frac{x_M - x_R}{y_E - x_R} = \\frac{\\overline{RM}}{\\overline{RE}}' },
        { n: 'Cross-current stage n', m: 'R_{n-1} + S_n = R_n + E_n' }],
      fx: [['↑ Solvent S', 'M moves toward B → more extract, lower acid in raffinate (until single phase)'], ['↑ Feed concentration', 'tie lines get shorter, nearer plait point → poorer separation'], ['Split solvent into stages', 'higher % extraction with the same total solvent'], ['Steeper tie lines (K > 1)', 'less solvent needed']],
      quiz: [{ q: 'Point M lies inside the binodal curve. After settling you get…', o: ['one liquid phase', 'two layers whose compositions are the tie-line ends through M', 'pure solvent', 'a solid'], a: 1 }, { q: 'At the plait point the tie line length is…', o: ['maximum', 'zero', 'equal to the base of the triangle', 'undefined'], a: 1 }],
      refs: ['<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 10 (liquid extraction; water – acetic acid – isopropyl ether tie-line data).', '<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 8 (liquid–liquid extraction with ternary systems).', '<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill.', '<i>Wankat, P.C.</i> (2012) <i>Separation Process Engineering</i>, 3rd ed., Prentice Hall.']
    }
  ];
})();
