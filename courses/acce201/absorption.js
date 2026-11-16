/* ACCE 201 · Unit 2 — Gas absorption */
window.T201 = window.T201 || {};
(function () {
  const C = Chem, GAS = Object.fromEntries(Object.entries(C.gases).map(([k, g]) => [k, g.name]));

  // mole-ratio equilibrium for y = m x
  const Yeq = (X, m) => m * X / (1 + X - m * X), Xeq = (Y, m) => Y / (m - Y * (1 - m));
  const f = (v, d = 3) => UI.fmt(v, d), clamp = (v, a, b) => Math.min(b, Math.max(a, v)), hsh = (i, k = 7919) => ((i * k) % 997) / 997;
  const SHELL = 0xa9c4dd, METAL = 0x9aa3ab, DARK = 0x5d666e;
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const C_LEAN = [.55, .78, 1], C_RICH = [.5, .16, .62], C_GRICH = [.93, .38, .1], C_GCLEAN = [.82, .84, .8], C_STEAM = [.97, .97, .97];
  // point along a 3-D polyline, equal-length parametrisation
  const pathAt = (P, u) => { let L = 0; const s = []; for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); s.push(l); L += l; } let d = u * L; for (let i = 0; i < s.length; i++) { if (d <= s[i]) { const k = d / s[i]; return [0, 1, 2].map(j => P[i][j] + (P[i + 1][j] - P[i][j]) * k); } d -= s[i]; } return P[P.length - 1].slice(); };
  // particle stream with per-particle colour: pos(u,i)->[x,y,z], col(u,i)->[r,g,b]
  function cstream(v, n, size, pos, col, speed) {
    const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3), u = Float32Array.from({ length: n }, () => Math.random());
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity: .95, depthWrite: false })); pts.frustumCulled = false; v.root.add(pts);  // positions move every frame: bounds from frame 1 would cull wrongly
    const s = { speed };
    v.tick((t, dt) => { for (let i = 0; i < n; i++) { u[i] = (u[i] + dt * s.speed * (.7 + .6 * hsh(i, 7919))) % 1; p.set(pos(u[i], i), i * 3); c.set(col(u[i], i), i * 3); } g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true; });
    return s;
  }

  /* ---- 2.1 closed flask: gas molecules dissolve and escape until the Henry's-law partition is reached ----
     Equal gas and liquid volumes, so at equilibrium N_L/N_G = H_cc = c_L/c_G (dimensionless Henry constant). */
  function flask(v, st) {
    const R = 1.15, yi = 1.4, top = 2.9, NMAX = 400;
    v.cyl(R + .03, top + .1, SHELL, [0, (top + .1) / 2, 0], { op: .16, ds: 1, open: 1 }); v.cyl(R + .06, .08, METAL, [0, top + .12, 0]); v.cyl(R + .03, .05, METAL, [0, -.02, 0]);
    const surf = v.cyl(R, .015, 0x2f7fd8, [0, yi, 0], { op: .45, ds: 1 }); v.cyl(R - .01, yi, 0x2f7fd8, [0, yi / 2, 0], { op: .16, ds: 1 }); void surf;
    const pos = new Float32Array(NMAX * 3), col = new Float32Array(NMAX * 3), vel = new Float32Array(NMAX * 3), ph = new Int8Array(NMAX); // 0 gas, 1 liquid, 2 dissolving, 3 escaping
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .1, vertexColors: true, transparent: true, depthWrite: false })); v.root.add(pts);
    const rnd = () => Math.random(), place = (i, liq) => { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R - .08); pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 2] = Math.sin(a) * r; pos[i * 3 + 1] = liq ? .06 + rnd() * (yi - .12) : yi + .06 + rnd() * (top - yi - .12); const sp = liq ? .25 : 1.6, b = rnd() * 6.283, e = rnd() * 2 - 1; vel[i * 3] = sp * Math.cos(b) * Math.sqrt(1 - e * e); vel[i * 3 + 1] = sp * e; vel[i * 3 + 2] = sp * Math.sin(b) * Math.sqrt(1 - e * e); };
    st.reset = () => { for (let i = 0; i < NMAX; i++) { ph[i] = 0; place(i, 0); } st.t0 = st.t; st.hist = []; };
    st.t = 0; st.reset();
    v.tick((t, dt) => {
      st.t += dt; const n = st.n, fr = st.feq, kr = .55; let nl = 0;
      for (let i = 0; i < NMAX; i++) {
        const j = i * 3;
        if (i >= n) { ph[i] = -1; pos[j + 1] = -999; continue; } if (ph[i] < 0) { ph[i] = 0; place(i, 0); }
        if (ph[i] === 0 && rnd() < kr * fr * dt) { ph[i] = 2; vel[j + 1] = -2.2; }
        else if (ph[i] === 1 && rnd() < kr * (1 - fr) * dt) { ph[i] = 3; vel[j + 1] = 1.2; }
        const liq = ph[i] === 1 || ph[i] === 3;
        if (liq && ph[i] === 1) { vel[j] += (rnd() - .5) * 1.2 * dt * 10; vel[j + 2] += (rnd() - .5) * 1.2 * dt * 10; vel[j + 1] += (rnd() - .5) * 1.2 * dt * 10; const s = Math.hypot(vel[j], vel[j + 1], vel[j + 2]) || 1; vel[j] *= .25 / s; vel[j + 1] *= .25 / s; vel[j + 2] *= .25 / s; }
        pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
        const r = Math.hypot(pos[j], pos[j + 2]); if (r > R - .06) { const nx = pos[j] / r, nz = pos[j + 2] / r, d = vel[j] * nx + vel[j + 2] * nz; if (d > 0) { vel[j] -= 2 * d * nx; vel[j + 2] -= 2 * d * nz; } pos[j] = nx * (R - .061); pos[j + 2] = nz * (R - .061); }
        if (ph[i] === 2 && pos[j + 1] < yi - .05) { ph[i] = 1; vel[j + 1] = -.2; }
        if (ph[i] === 3 && pos[j + 1] > yi + .05) { ph[i] = 0; vel[j + 1] = 1.4; }
        if (ph[i] === 0) { if (pos[j + 1] > top - .05) vel[j + 1] = -Math.abs(vel[j + 1]); if (pos[j + 1] < yi + .05) vel[j + 1] = Math.abs(vel[j + 1]); }
        if (ph[i] === 1) { if (pos[j + 1] > yi - .05) vel[j + 1] = -Math.abs(vel[j + 1]); if (pos[j + 1] < .05) vel[j + 1] = Math.abs(vel[j + 1]); }
        if (ph[i] === 1 || ph[i] === 2) nl++;
        col.set(liq || ph[i] === 2 ? [.75, .22, .08] : [.98, .55, .25], j);
      }
      g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = true; st.nl = nl;
      if (!st.hist.length || st.t - st.hist[st.hist.length - 1][0] > .25) { st.hist.push([st.t - st.t0, nl]); if (st.hist.length > 240) st.hist.shift(); st.onHist && st.onHist(); }
    });
    v.tag('Headspace gas (molecules fly fast)', [-R, 2.4, 0], 'gas'); v.tag('Gas–liquid interface', [R, yi, 0], 'if'); v.tag('Dissolved molecules (move slowly)', [-R, .6, 0], 'liq'); v.tag('Water', [R, .5, 0], 'w');
  }

  /* ---- 2.2 absorber + stripper plant (dilute, constant flows, Kremser on each column) ---- */
  const phi = (A, N) => Math.abs(A - 1) < 1e-9 ? 1 / (N + 1) : (A - 1) / (Math.pow(A, N + 1) - 1); // fraction of approach NOT achieved
  function plantSolve(s) {
    const ma = C.psat('benzene', s.Ta) / (s.Pa * 1e5), ms = C.psat('benzene', s.Ts) / 101325, A = s.L / (ma * s.G), S = ms * s.V / s.L;
    const pA = phi(A, s.NA), pS = phi(S, s.NS), k = (s.G / s.L) * (1 - pA);
    const xl = pS * k * s.yin / ((1 - pS) + pS * k * ma), xr = xl / pS, yout = ma * xl + pA * (s.yin - ma * xl), ys = s.L * (xr - xl) / s.V;
    return { ma, ms, A, S, pA, pS, xl, xr, yout, ys, rec: 1 - yout / s.yin, abs: s.G * (s.yin - yout), str: s.V * ys, recMax: Math.min(1, A) };
  }
  function plant(v, st) {
    const xa = -3.4, xs = 3.4, Ra = .75, Rs = .6, H = 6;
    for (const [x, R, lab] of [[xa, Ra, 'Absorber'], [xs, Rs, 'Stripper']]) {
      v.cyl(R, H + .8, SHELL, [x, H / 2, 0], { op: .13, ds: 1, open: 1 }); v.cyl(R, .06, METAL, [x, H + .4, 0]); v.cyl(R, .06, METAL, [x, -.4, 0]);
      v.cyl(R * .97, .03, METAL, [x, .35, 0], { op: .6 }); v.box(R * 1.6, .05, .06, METAL, [x, H - .05, 0]);
      const r = C.rng(x > 0 ? 7 : 3); for (let i = 0; i < 90; i++) { const a = r() * 6.28, rr = Math.sqrt(r()) * R * .85; v.cyl(.055, .1, 0xa88a62, [x + Math.cos(a) * rr, .45 + r() * (H - .6), Math.sin(a) * rr], { open: 1, ds: 1, rot: [r() * 3, r() * 3, 0], seg: 8, op: .7 }); }
      void lab;
    }
    const P = {
      gin: [[-6.8, .6, 0], [xa - Ra, .6, 0]], gout: [[xa, H + .4, 0], [xa, H + 1.4, 0]],
      rich: [[xa, -.4, -.35], [xa, -1.2, -.35], [-.9, -1.2, -.35], [.9, -1.2, -.35], [1.9, -1.2, -.35], [1.9, H + .2, -.35], [xs, H + .2, -.35], [xs, H - .1, 0]],
      lean: [[xs, -.4, .35], [xs, -1.2, .35], [.9, -1.2, .35], [-.9, -1.2, .35], [-1.9, -1.2, .35], [-1.9, H + .2, .35], [xa, H + .2, .35], [xa, H - .1, 0]],
      steam: [[6.6, .6, 0], [xs + Rs, .6, 0]], vap: [[xs, H + .4, 0], [xs, H + 1.1, 0], [5.6, H + 1.1, 0], [5.6, H - .6, 0]]
    };
    Object.values(P).forEach(q => v.pipe(q, .07, METAL, { op: .35 }));
    v.cyl(.5, 2, METAL, [0, -1.2, 0], { rot: [0, 0, Math.PI / 2], op: .3, ds: 1 });        // rich/lean exchanger
    v.cyl(.32, 1.4, 0x6fa8dc, [-1.9, 3, .35], { op: .45 });                                // lean cooler
    v.cyl(.28, .5, DARK, [-2.4, -1.2, -.35], { rot: [Math.PI / 2, 0, 0] });                // pump
    v.cyl(.32, 1.2, 0x6fa8dc, [5.6, H + 1.1, 0], { rot: [0, 0, Math.PI / 2], op: .45 });   // condenser
    v.box(1.1, .7, .7, SHELL, [5.6, H - .95, 0], { op: .3 }); v.box(1.05, .25, .65, 0x2f7fd8, [5.6, H - 1.17, 0], { op: .4 }); v.box(1.05, .18, .65, 0xd9a441, [5.6, H - .96, 0], { op: .6 }); // decanter
    const ly = h => Math.pow(st.yout / st.yin, h), lx = h => st.xl + (st.xr - st.xl) * (1 - Math.pow(1 - Math.min(1, h), 1.6)); // shapes of profiles (top h=1)
    const Lc = x => mix(C_LEAN, C_RICH, clamp(x / Math.max(st.xr, 1e-9), 0, 1)), Gc = y => mix(C_GCLEAN, C_GRICH, clamp(y / st.yin, 0, 1));
    const gas = cstream(v, 260, .1, (u, i) => { const a = i * 2.4, r = Ra * .8 * Math.sqrt(hsh(i, 29)); if (u < .15) return pathAt(P.gin, u / .15).map((q, j) => j === 2 ? q + (hsh(i, 5) - .5) * .2 : q); if (u < .88) { const h = (u - .15) / .73; return [xa + Math.cos(a + h * 3) * r, .6 + h * (H - .2), Math.sin(a + h * 3) * r]; } return pathAt(P.gout, (u - .88) / .12); },
      (u) => u < .15 ? C_GRICH : u < .88 ? Gc(st.yin * ly((u - .15) / .73)) : Gc(st.yout), .12);
    const liqA = cstream(v, 220, .09, (u, i) => { const a = i * 2.4, r = Ra * .85 * Math.sqrt(hsh(i, 31)); return [xa + Math.cos(a) * r, H - .1 - u * (H - .5), Math.sin(a) * r]; }, u => Lc(lx(u)), .08);
    const rich = cstream(v, 150, .09, (u) => pathAt(P.rich, u), () => C_RICH, .06);
    const lean = cstream(v, 150, .09, (u) => pathAt(P.lean, u), () => Lc(st.xl), .06);
    const liqS = cstream(v, 200, .09, (u, i) => { const a = i * 2.4, r = Rs * .85 * Math.sqrt(hsh(i, 31)); return [xs + Math.cos(a) * r, H - .1 - u * (H - .5), Math.sin(a) * r]; }, u => Lc(st.xr - (st.xr - st.xl) * (1 - Math.pow(1 - u, 1.6))), .08);
    const vapS = cstream(v, 200, .1, (u, i) => { if (u < .12) return pathAt(P.steam, u / .12); if (u < .8) { const h = (u - .12) / .68, a = i * 2.4 + h * 3, r = Rs * .8 * Math.sqrt(hsh(i, 17)); return [xs + Math.cos(a) * r, .6 + h * (H - .2), Math.sin(a) * r]; } return pathAt(P.vap, (u - .8) / .2); },
      (u) => u < .12 ? C_STEAM : mix(C_STEAM, C_GRICH, clamp(u < .8 ? (u - .12) / .68 : 1, 0, 1) * clamp(st.ys / (st.ys + .05), .25, 1)), .1);
    v.tick(() => { gas.speed = .06 + .05 * st.Gr; liqA.speed = liqS.speed = .05 + .05 * st.Lr; rich.speed = lean.speed = .04 + .04 * st.Lr; vapS.speed = .06 + .06 * st.Vr; });
    v.tag('Feed gas with benzene vapour', [-6.6, .6, 0], 'gin'); v.tag('Clean gas out', [xa, H + 1.4, 0], 'gout'); v.tag('ABSORBER (cool, ~1 bar)', [xa, 3.4, 0], 'abs'); v.tag('Lean-oil cooler', [-1.9, 3, .35], 'cool');
    v.tag('Rich-oil pump', [-2.4, -1.2, -.35], 'pump'); v.tag('Rich/lean heat exchanger', [0, -1.2, 0], 'hx'); v.tag('STRIPPER (hot, steam)', [xs, 3.4, 0], 'str'); v.tag('Live steam in', [6.4, .6, 0], 'steam');
    v.tag('Condenser', [5.6, H + 1.1, 0], 'cond'); v.tag('Decanter: benzene floats on water', [5.6, H - .95, 0], 'dec');
  }
  function plantSVG(el, s, R) {
    const T = (x, y, t, a = 'start', c = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${t}</text>`, ar = (x1, y1, x2, y2) => `<line class="s" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ar)"/>`;
    const z = Math.abs(R.abs - R.str) < 1e-9 ? '0' : f(R.abs - R.str, 7);
    UI.svg(el, `<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="a"/></marker></defs>`
      + `<rect class="s" x="200" y="50" width="80" height="160" rx="10"/><rect class="s" x="470" y="50" width="80" height="160" rx="10"/>` + T(240, 134, 'Absorber', 'middle', 'k') + T(510, 134, 'Stripper', 'middle', 'k')
      + ar(70, 190, 196, 190) + T(74, 178, `Feed gas G = ${f(s.G, 0)}`) + T(74, 208, `y = ${f(s.yin, 4)}`, 'start', 'v')
      + ar(240, 46, 240, 6) + T(250, 16, `Clean gas y = ${f(R.yout, 5)}`, 'start', 'v') + T(250, 32, `${f(s.G * R.yout, 4)} kmol/h benzene lost`, 'start', 'mu')
      + `<path class="s" d="M240,210 V240 H370 V70 H466" marker-end="url(#ar)"/>` + T(378, 150, 'rich oil', 'start', 'k') + T(378, 167, `x = ${f(R.xr, 5)}`, 'start', 'v')
      + `<path class="s" d="M510,210 V270 H40 V70 H196" marker-end="url(#ar)"/>` + T(275, 288, `lean oil L = ${f(s.L, 1)},  x = ${f(R.xl, 6)}`, 'middle', 'v')
      + ar(690, 190, 554, 190) + T(690, 178, `Steam V = ${f(s.V, 1)}`, 'end') + ar(510, 46, 510, 6) + T(520, 16, `Vapour y = ${f(R.ys, 4)}`, 'start', 'v') + T(520, 32, `${f(R.str, 3)} kmol/h benzene`, 'start', 'mu')
      + T(350, 312, `Absorbed G(y_in − y_out) = ${f(R.abs, 4)} kmol/h  ·  Stripped V·y = ${f(R.str, 4)} kmol/h  ·  difference ${z}`, 'middle', 'k'), '0 0 700 322', 340).firstChild.classList.add('flow');
  }


  const rgb = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  // stage-by-stage column: left half coloured by gas composition, right half by liquid composition (stage 1 = top)
  function stageSVG(el, steps, Ymax, Xmax, gTop, gBot, lTop, lBot) {
    const n = steps.length, hs = Math.min(30, 330 / n), y0 = 46, x0 = 270, w = 100, ev = Math.ceil(15 / hs), H = n * hs;
    const T = (x, y, t, a = 'start', c = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}" dominant-baseline="middle">${t}</text>`;
    let g = `<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="a"/></marker></defs>`;
    steps.forEach(([, Y, X], i) => {
      const y = y0 + i * hs; g += `<rect x="${x0}" y="${y}" width="${w / 2}" height="${hs}" fill="${rgb(mix(C_GCLEAN, C_GRICH, clamp(Y / Ymax, 0, 1)))}"/><rect x="${x0 + w / 2}" y="${y}" width="${w / 2}" height="${hs}" fill="${rgb(mix(C_LEAN, C_RICH, clamp(X / Xmax, 0, 1)))}"/><line class="s" x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}" style="stroke-width:.8"/>`;
      if (i % ev === 0 || i === n - 1) g += T(x0 - 10, y + hs / 2, `Y = ${Y.toFixed(5)}`, 'end', 'mu') + T(x0 + w + 10, y + hs / 2, `X = ${X.toFixed(5)}`, 'start', 'mu') + T(x0 + w / 2, y + hs / 2, String(i + 1), 'middle', 'k');
    });
    g += `<rect class="s" x="${x0}" y="${y0}" width="${w}" height="${H}"/>` + `<line class="s" x1="${x0 + 25}" y1="${y0}" x2="${x0 + 25}" y2="12" marker-end="url(#ar)"/>` + T(x0 + 18, 14, gTop, 'end')
      + `<line class="s" x1="${x0 + 75}" y1="12" x2="${x0 + 75}" y2="${y0 - 2}" marker-end="url(#ar)"/>` + T(x0 + 82, 14, lTop)
      + `<line class="s" x1="${x0 + 25}" y1="${y0 + H + 34}" x2="${x0 + 25}" y2="${y0 + H + 2}" marker-end="url(#ar)"/>` + T(x0 + 18, y0 + H + 30, gBot, 'end')
      + `<line class="s" x1="${x0 + 75}" y1="${y0 + H}" x2="${x0 + 75}" y2="${y0 + H + 32}" marker-end="url(#ar)"/>` + T(x0 + 82, y0 + H + 30, lBot)
      + T(x0 + w / 2, y0 + H + 52, 'gas half (left) · liquid half (right) — darker = more solute', 'middle', 'mu');
    UI.svg(el, g, `0 0 640 ${y0 + H + 64}`, 460).firstChild.classList.add('flow');
  }

  T201.fx3 = { cstream, pathAt, mix, hsh, clamp };
  T201.absorption = [
    {
      id: 'solubility', title: 'Equilibrium solubility of gases', tags: 'henry law solubility temperature pressure ideal non-ideal raoult solution',
      blurb: 'Henry’s law, temperature effects, ideal vs non-ideal liquid solutions.',
      lead: 'How much gas a liquid can hold at equilibrium sets the <b>driving force</b> for absorption. For dilute gases in water, partial pressure is proportional to mole fraction (Henry’s law). For vapours that form ideal liquid solutions, Raoult’s law applies.',
      render(el, UI) {
        const st = { n: 200, feq: .5, nl: 0, hist: [] };
        const S0 = UI.sim(el, {
          title: 'Gas meets water in a closed flask', controls: [
            { k: 'g', t: 'select', label: 'Gas', v: 'CO2', opts: GAS }, { k: 'T', label: 'Temperature', min: 0, max: 80, step: 1, v: 25, unit: '°C' },
            { k: 'n', label: 'Amount of gas put in', min: 60, max: 400, step: 10, v: 200, unit: 'molecules', hint: 'Twice the gas → twice the partial pressure → twice as much dissolves (Henry’s law).' }],
          views: [{ k: 'v', t: '3d', h: 430, cam: [0, 2.3, 6.4], target: [0, 1.4, 0] }, { k: 'p', t: 'plot', h: 210 }, { k: 'ro', t: 'ro' }],
          update(s, V, S) {
            const TK = s.T + 273.15, Hcp = C.henryCp(s.g, TK), Hcc = Hcp * 8.314 * TK, fq = Hcc / (1 + Hcc), g = C.gases[s.g];
            st.n = s.n; st.feq = fq;
            if (!S._b && V.v.ok) { S._b = 1; flask(V.v, st); st.onHist = () => S.run(); }
            const nl = st.nl || 0, tm = Math.max(20, st.hist.length ? st.hist[st.hist.length - 1][0] : 0);
            const q = V.p.frame({ x: [Math.max(0, tm - 60), tm], y: [0, s.n], xl: 'time (animation seconds)', yl: 'molecules dissolved', xs: 't', ys: 'N_L' });
            q.hl(s.n * fq, { c: 'c1', w: 1.6, dash: [], l: 'equilibrium (Henry’s law)' }); q.line(st.hist.filter(p => p[0] >= tm - 60), { c: 'c2', w: 2, l: 'in the liquid now' }); q.done();
            V.ro.set([['Henry constant $H$ (p = Hx)', f(C.henryPx(s.g, TK) / 1e5, 4) + ' bar'], ['Dimensionless $H_{cc} = c_L/c_G$', f(Hcc, 3)], ['Dissolved at equilibrium (theory)', f(100 * fq, 1) + ' %', 'ok'], ['Dissolved now (animation)', f(100 * nl / s.n, 1) + ' %'], ['Solubility at $p_A$ = 1 atm', f(Hcp * 101325 * g.M / 1000, 3) + ' g/L'], ['Behaviour', Hcc > 30 ? 'very soluble: gas-film controlled' : Hcc < .1 ? 'sparingly soluble: liquid-film controlled' : 'moderately soluble']]);
          }
        });
        S0.ctl.append(h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: () => st.reset && st.reset() }, '⟲ Empty the water and start again'));
        UI.note(el, 'Gas and liquid have equal volumes, so at equilibrium <b>N<sub>L</sub>/N<sub>G</sub> = H<sub>cc</sub></b>. Each gas molecule that hits the surface dissolves with probability ∝ H<sub>cc</sub>/(1+H<sub>cc</sub>); each dissolved one escapes with probability ∝ 1/(1+H<sub>cc</sub>). Time is sped up enormously: real dissolution is limited by slow diffusion in the liquid (Chapter 4).');
        UI.walk(el, [
          { t: 'Gas side', d: 'Gas molecules fly fast (hundreds of m/s) and strike the water surface constantly.', hi: ['gas'] },
          { t: 'At the interface', d: 'Some molecules that hit the surface are captured and <b>dissolve</b>. Dissolved molecules that reach the surface can <b>escape</b> back. Soluble gases (NH₃, SO₂) are captured often; O₂ and N₂ rarely.', hi: ['if'] },
          { t: 'In the liquid', d: 'Dissolved molecules diffuse about 10⁴ times more slowly (D ≈ 10⁻⁹ m²/s in water vs 10⁻⁵ m²/s in gas). This is why the liquid side often limits absorption of sparingly soluble gases.', hi: ['liq', 'w'] },
          { t: 'Dynamic equilibrium', d: 'The count in the liquid stops changing even though molecules keep crossing: the dissolving rate equals the escaping rate. That end state is the <b>solubility</b>, the limit no absorber can beat.', hi: ['if'] },
          { t: 'Henry’s law and temperature', d: 'Double the amount of gas: twice as many dissolve, so <b>x ∝ p</b>. Heat the water: molecules escape more easily and solubility falls. That is why we <b>absorb cold and strip hot</b>.', hi: [] }
        ], (i, x) => S0.V.v.hi && S0.V.v.hi(x.hi.length ? x.hi : null));
        const tb = UI.tabs(UI.more(el, 'Design data: Henry’s law and ideal / non-ideal solutions'), ['Gas solubility (Henry’s law)', 'Ideal vs non-ideal liquid solutions']);
        UI.sim(tb.panes[0], {
          title: 'Gas in water', controls: [
            { k: 'g', t: 'select', label: 'Gas', v: 'CO2', opts: GAS }, { k: 'T', label: 'Temperature', min: 0, max: 80, step: 1, v: 25, unit: '°C' }, { k: 'P', label: 'Total pressure', min: .2, max: 20, step: .1, v: 1, unit: 'atm' },
            { k: 'y', label: 'Gas mole fraction $y$', min: .001, max: 1, step: .001, v: .1 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 330 }, { k: 'q', t: 'plot', row: 'r', h: 330 }],
          update(s, V) {
            const TK = s.T + 273.15, H = C.henryPx(s.g, TK), P = s.P * 101325, p = s.y * P, x = p / H, m = H / P, gL = x * 55.5 * C.gases[s.g].M; // g gas per L water (dilute)
            V.ro.set([['Henry constant $H$ (p = Hx)', UI.fmt(H / 1e5, 4) + ' bar'], ['Partial pressure $p_A$', UI.fmt(p / 1000, 3) + ' kPa'], ['Equilibrium $x^*$', UI.fmt(x, 4)], ['Solubility', UI.fmt(gL, 4) + ' g/L'], ['Slope $m = H/P$ (y = mx)', UI.fmt(m, 4)], ['Behaviour', m > 100 ? 'sparingly soluble — liquid film controls' : m < 1 ? 'very soluble — gas film controls' : 'moderately soluble']]);
            const xmax = Math.max(x * 1.6, 1e-9), q = V.p.frame({ x: [0, xmax], y: [0, p / 1000 * 1.6], xl: 'x (mole fraction in liquid)', yl: 'p_A (kPa)', xs: 'x', ys: 'p' });
            [[s.T - 15, 'c2'], [s.T, 'c1'], [s.T + 15, 'c5']].forEach(([t, c]) => q.fn(xx => xx * C.henryPx(s.g, t + 273.15) / 1000, 0, xmax, { c, l: `${t} °C`, w: t === s.T ? 2.6 : 1.4 }));
            q.pts([[x, p / 1000]], { c: 'tx', r: 5 }); q.done();
            const r = V.q.frame({ x: [0, 80], y: [1e-3, 1e3], logy: 1, xl: 'Temperature (°C)', yl: 'Solubility at p_A = 1 atm (g/L)', xs: 'T', ys: 'g/L' });
            Object.keys(C.gases).forEach((k, i) => r.fn(t => Math.min(101325 / C.henryPx(k, t + 273.15), .2) * 55.5 * C.gases[k].M, 0, 80, { c: ['c2', 'c3', 'c4', 'c1', 'c5', 'tx', 'bad'][i], w: k === s.g ? 3 : 1.3, l: C.gases[k].name }));
            r.vl(s.T); r.done();
          }
        });
        UI.note(tb.panes[0], 'NH₃ and SO₂ are not truly Henry’s-law gases at high concentration (they react/ionise). The curves are the infinite-dilution limit, accurate below a few mol %. The Henry constants are Sander (2015) values with van ’t Hoff temperature dependence.');
        UI.sim(tb.panes[1], {
          title: 'Benzene vapour into a non-volatile oil', controls: [
            { k: 'T', label: 'Temperature', min: 10, max: 70, step: 1, v: 26.7, unit: '°C' }, { k: 'P', label: 'Total pressure', min: .5, max: 5, step: .05, v: 1, unit: 'atm' },
            { k: 'A', label: 'Non-ideality (Margules $A$)', min: -1.5, max: 2, step: .05, v: .8, hint: 'ln γ = A(1−x)². A = 0 → ideal (Raoult). A > 0 → positive deviation, less soluble.' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 340 }],
          update(s, V) {
            const ps = C.psat('benzene', s.T), P = s.P * 101325, gam = x => Math.exp(s.A * (1 - x) * (1 - x));
            V.ro.set([['Vapour pressure $P^{sat}$', UI.fmt(ps / 1000, 3) + ' kPa'], ['Ideal slope $m = P^{sat}/P$', UI.fmt(ps / P, 4)], ['γ at infinite dilution', UI.fmt(Math.exp(s.A), 3)], ['Effective Henry $H = \\gamma^\\infty P^{sat}$', UI.fmt(Math.exp(s.A) * ps / 1000, 3) + ' kPa']]);
            const p = V.p.frame({ x: [0, 1], y: [0, 1], xl: 'x benzene in oil', yl: 'y benzene in gas', xs: 'x', ys: 'y' });
            p.fn(x => Math.min(1, x * ps / P), 0, 1, { c: 'c2', l: 'Ideal solution (Raoult): y = xP^sat/P' });
            p.fn(x => Math.min(1, gam(x) * x * ps / P), 0, 1, { c: 'c1', l: 'Non-ideal: y = γxP^sat/P' });
            p.fn(x => Math.min(1, Math.exp(s.A) * x * ps / P), 0, .3, { c: 'c3', dash: [4, 4], l: 'Henry’s-law tangent at x→0' }); p.done();
          }
        });
        UI.note(tb.panes[1], '<b>Ideal liquid solution</b>: components similar in size and forces; partial pressure follows Raoult’s law, solubility doesn’t depend on the solvent and you can predict it from vapour pressure alone. <b>Non-ideal</b>: use activity coefficients or experimental (Henry) data. A gas above its critical temperature cannot form an ideal solution — Henry’s law is then used.');
      },
      eqs: [
        { n: 'Henry’s law', m: 'p_A = H\\,x_A \\quad\\Rightarrow\\quad y_A = m\\,x_A,\\ m = H/P' },
        { n: 'Raoult’s law (ideal solution)', m: 'p_A = x_A P_A^{sat},\\quad y_A = x_A P_A^{sat}/P' },
        { n: 'Non-ideal solution', m: 'p_A = \\gamma_A x_A P_A^{sat}' },
        { n: 'Temperature dependence (van ’t Hoff)', m: 'H^{cp}(T) = H^{cp}_{298}\\exp\\!\\left[C\\left(\\frac1T-\\frac1{298.15}\\right)\\right]' }],
      fx: [['↑ Temperature', 'H rises → solubility falls → poorer absorption (absorb cold, strip hot)'], ['↑ Total pressure', 'm = H/P falls → equilibrium line flatter → fewer stages / less liquid'], ['↑ Partial pressure', 'solubility ∝ p_A (dilute)'], ['Positive deviation (γ > 1)', 'less soluble than ideal prediction']],
      quiz: [{ q: 'To strip CO₂ out of water you should…', o: ['cool and pressurise', 'heat and reduce pressure', 'cool and reduce pressure', 'heat and pressurise'], a: 1, ex: 'Higher T raises H; lower P raises m = H/P — both push gas out.' },
        { q: 'For an ideal solution at 1 atm, the equilibrium slope m equals…', o: ['P^sat / P', 'P / P^sat', 'H·P', 'γ'], a: 0 },
        { q: 'In the flask, gas and liquid volumes are equal and H_cc = 1. At equilibrium the fraction of molecules dissolved is…', o: ['0 %', '50 %', '100 %', 'depends on how long you wait'], a: 1, ex: 'N_L/N_G = H_cc = 1, so half are in the liquid. Equilibrium does not depend on time once reached.' }],
      refs: [
        '<i>Sander, R.</i> (2015) Compilation of Henry’s law constants (version 4.0) for water as solvent. <i>Atmos. Chem. Phys.</i> 15, 4399–4981. (H values and van ’t Hoff temperature coefficients)',
        '<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 8 (gas solubility, ideal and non-ideal solutions).',
        '<i>Poling, B.E., Prausnitz, J.M. & O’Connell, J.P.</i> (2001) <i>The Properties of Gases and Liquids</i>, 5th ed., McGraw-Hill. (Antoine constants, activity coefficients)',
        '<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 2 & 6.',
        '<i>Bird, R.B., Stewart, W.E. & Lightfoot, E.N.</i> (2002) <i>Transport Phenomena</i>, 2nd ed., Wiley. (gas and liquid diffusivities)']
    },

    {
      id: 'abs-plant', title: 'Absorber–stripper plant & its material balance', tags: 'absorber stripper plant solvent recovery benzene wash oil steam stripping kremser material balance solvent choice lean rich',
      blurb: 'A full recovery plant in 3-D: absorb cold, strip hot, recycle the solvent.',
      lead: 'An absorber alone only moves the solute into a liquid. To get the solute back and reuse the solvent, the rich liquid goes to a <b>stripper</b>, where heat and steam drive the solute out again. The lean solvent returns to the absorber: a closed loop. Here benzene vapour is recovered from a gas with a non-volatile wash oil.',
      render(el, UI) {
        const st = { yin: .02, yout: .001, xl: .002, xr: .1, ys: .2, Gr: 1, Lr: 1, Vr: 1 };
        const S = UI.sim(el, {
          title: 'Benzene recovery plant', controls: [
            { k: 'G', label: 'Feed gas $G$', min: 40, max: 250, step: 5, v: 100, unit: 'kmol/h' }, { k: 'yin', label: 'Benzene in feed gas $y_{in}$', min: .005, max: .05, step: .001, v: .02 },
            { t: 'sep', label: 'Absorber' },
            { k: 'L', label: 'Wash-oil circulation $L$', min: 5, max: 40, step: .5, v: 15, unit: 'kmol/h' }, { k: 'Ta', label: 'Absorber temperature', min: 15, max: 45, step: 1, v: 27, unit: '°C' },
            { k: 'Pa', label: 'Absorber pressure', min: 1, max: 3, step: .01, v: 1.07, unit: 'bar' }, { k: 'NA', label: 'Absorber ideal stages', min: 2, max: 15, step: 1, v: 8 },
            { t: 'sep', label: 'Stripper (1 atm)' },
            { k: 'V', label: 'Stripping steam $V$', min: 2, max: 20, step: .5, v: 8, unit: 'kmol/h' }, { k: 'Ts', label: 'Stripper temperature', min: 100, max: 140, step: 1, v: 122, unit: '°C' }, { k: 'NS', label: 'Stripper ideal stages', min: 2, max: 12, step: 1, v: 6 }],
          views: [{ k: 'v', t: '3d', h: 520, cam: [0, 4.2, 15.5], target: [0, 2.9, 0] }, { k: 'd', t: 'html' }, { k: 'ro', t: 'ro' }],
          update(s, V, S) {
            const R = plantSolve(s);
            Object.assign(st, { yin: s.yin, yout: R.yout, xl: R.xl, xr: R.xr, ys: R.ys, Gr: s.G / 100, Lr: s.L / 15, Vr: s.V / 8 });
            if (V.v.ok) { if (!S._b) { S._b = 1; plant(V.v, st); } const w = V.v.el.clientWidth || 700, k = clamp(760 / w, 1, 2.6); if (S._w !== k) { S._w = k; V.v.look([0, 3.6 + k, 14.5 * k], [0, 2.9, 0]); } }
            V.d.innerHTML = ''; plantSVG(V.d, s, R);
            V.ro.set([['Absorber slope $m_A = P^{sat}/P$', f(R.ma, 4)], ['Absorption factor $A = L/(m_A G)$', f(R.A, 3), R.A < 1 ? 'warn' : ''], ['Stripper slope $m_S$', f(R.ms, 3)], ['Stripping factor $S = m_S V/L$', f(R.S, 3), R.S < 1 ? 'warn' : ''],
              ['Lean oil $x_{lean}$', f(R.xl, 5)], ['Rich oil $x_{rich}$', f(R.xr, 4)], ['Clean gas $y_{out}$', f(R.yout, 5)], ['<b>Benzene recovery</b>', f(100 * R.rec, 2) + ' %', R.rec > .9 ? 'ok' : 'warn'],
              ['Benzene recovered', f(R.str, 3) + ' kmol/h = ' + f(R.str * 78.11, 1) + ' kg/h', 'ok'], ['Limit with ∞ absorber stages, clean oil', f(100 * R.recMax, 1) + ' %'],
              ['Balance check: absorbed − stripped', (Math.abs(R.abs - R.str) < 1e-9 ? '0 (closes)' : f(R.abs - R.str, 7) + ' kmol/h'), Math.abs(R.abs - R.str) < 1e-6 ? 'ok' : 'bad'], ['Diagnosis', R.A < 1 ? 'A < 1: oil cannot carry the benzene, raise L or cool' : R.S < 1 ? 'S < 1: oil leaves the stripper dirty, raise steam or T' : R.ma * R.xl > .3 * R.yout ? 'lean oil not clean enough: it limits y_out' : 'well balanced', R.A < 1 || R.S < 1 ? 'warn' : 'ok']]);
          }
        });
        UI.walk(el, [
          { t: 'Feed gas in at the bottom', d: 'Gas carrying 2 mol % benzene vapour enters the bottom of the <b>absorber</b>, a packed column, and flows up. Orange = rich in benzene; the colour fades as benzene is absorbed.', hi: ['gin', 'abs'] },
          { t: 'Cool wash oil in at the top', d: 'Lean oil, cooled to about 27 °C, trickles down over the packing. Cold + modest pressure keep $m = P^{sat}/P$ small, so the oil holds a lot of benzene. Gas and oil flow <b>counter-current</b>.', hi: ['abs', 'cool'] },
          { t: 'Rich oil: pump and heat recovery', d: 'Purple rich oil leaves the bottom. A pump sends it through the <b>rich/lean exchanger</b>, where hot lean oil from the stripper pre-heats it. This saves most of the heating duty.', hi: ['pump', 'hx'] },
          { t: 'Stripper: hot and steam', d: 'At 122 °C the vapour pressure of benzene is about 23 times higher than at 27 °C, so $m_S \\approx 3$. Live steam rising through the column lowers the benzene partial pressure and carries it out.', hi: ['str', 'steam'] },
          { t: 'Condense and decant', d: 'The steam–benzene vapour is condensed. Benzene and water do not mix, so they separate in a <b>decanter</b>: benzene floats (ρ ≈ 0.88 g/cm³) and is drawn off as product.', hi: ['cond', 'dec'] },
          { t: 'Close the loop', d: 'Hot lean oil gives up heat in the exchanger, is cooled again and returns to the absorber top. At steady state <b>benzene absorbed = benzene stripped</b>; the oil only circulates.', hi: ['hx', 'cool'] }
        ], (i, x) => S.V.v.hi && S.V.v.hi(x.hi.length ? x.hi : null), 6000);
        UI.note(el, '<b>Model.</b> Dilute streams, constant flows L, G, V and straight equilibrium lines (Raoult’s law for benzene in a non-volatile oil: m = P<sup>sat</sup>/P), so each column follows the <b>Kremser</b> equation. The two columns are coupled through the lean and rich oil. Solving both together gives the steady state. Antoine constants: Poling et al. (2001). The base case follows the classic coal-gas benzene recovery problem in Treybal, Ch. 8. Above ~10 mol % in the oil use mole ratios (next topic).');
        const m = UI.more(el, 'Material balances and Kremser solution');
        UI.eqs(m, [{ n: 'Absorber (Kremser, fraction not absorbed)', m: '\\frac{y_{out}-m_Ax_{lean}}{y_{in}-m_Ax_{lean}}=\\varphi_A=\\frac{A-1}{A^{N_A+1}-1}' },
          { n: 'Stripper with clean steam', m: '\\frac{x_{lean}}{x_{rich}}=\\varphi_S=\\frac{S-1}{S^{N_S+1}-1}' },
          { n: 'Absorber benzene balance', m: 'G(y_{in}-y_{out})=L(x_{rich}-x_{lean})' },
          { n: 'Stripper benzene balance', m: 'L(x_{rich}-x_{lean})=V\\,y_{S,out}' },
          { n: 'Overall plant balance', m: 'G(y_{in}-y_{out}) = V\\,y_{S,out}\\quad(\\text{benzene in} = \\text{benzene out})' }]);
        const c = UI.more(el, 'Choosing a solvent');
        c.append(UI.table(['Property', 'Why it matters', 'Typical choice'], [
          ['High solubility (small m)', 'less solvent to circulate, smaller pumps and stripper', 'water for NH₃, HCl, SO₂'],
          ['Low volatility', 'little solvent lost with the clean gas', 'wash oil / gas oil for benzene, toluene'],
          ['Easy to regenerate', 'solute must come out again in the stripper', 'physical solvents: heat or pressure drop'],
          ['Chemical reaction (if needed)', 'very high capacity at low partial pressure', 'amines (MEA, MDEA) for CO₂, H₂S'],
          ['Low viscosity', 'faster mass transfer, less pressure drop and flooding', '—'],
          ['Safe, stable, cheap', 'non-toxic, non-flammable, non-corrosive, does not foam', '—']]));
        UI.note(c, 'Physical solvents (water, oils, Selexol) obey Henry/Raoult behaviour. Chemical solvents (amines, caustic) react with the solute: capacity is high even at very low partial pressure, but regeneration needs more heat.');
      },
      eqs: [
        { n: 'Absorption factor', m: 'A = \\frac{L}{mG}' },
        { n: 'Stripping factor', m: 'S = \\frac{mV}{L} = \\frac{1}{A}' },
        { n: 'Kremser fraction not absorbed', m: '\\varphi_A=\\frac{A-1}{A^{N+1}-1}' },
        { n: 'Plant balance', m: 'G(y_{in}-y_{out}) = L(x_{rich}-x_{lean}) = V\\,y_{S}' }],
      fx: [['↑ Oil rate L', 'A ↑ (better absorption) but S ↓ (harder stripping) and more pumping and heating'], ['↑ Absorber T', 'P^sat ↑ → m ↑ → A ↓ → benzene slips through'], ['↑ Absorber P', 'm ↓ → A ↑ → higher recovery'], ['↑ Steam or stripper T', 'S ↑ → cleaner lean oil → lower y_out'], ['Lean oil not clean', 'y_out can never fall below m·x_lean']],
      quiz: [{ q: 'The wash oil is recycled. At steady state the benzene leaving in the stripper vapour equals…', o: ['zero', 'the benzene absorbed from the gas', 'the benzene in the rich oil', 'the benzene in the lean oil'], a: 1, ex: 'The oil only circulates; everything absorbed must be stripped out (plant balance).' },
        { q: 'Why is the absorber run cold and the stripper hot?', o: ['to save energy', 'cold → small m → high solubility; hot → large m → easy release', 'to prevent flooding', 'because steam is hot'], a: 1 },
        { q: 'If A = 0.8, the best possible recovery with clean oil and many stages is about…', o: ['100 %', '80 %', '20 %', '8 %'], a: 1, ex: 'With A < 1 the fraction absorbed approaches A as N → ∞.' }],
      refs: ['<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 8.', '<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 6.', '<i>Wankat, P.C.</i> (2012) <i>Separation Process Engineering</i>, 3rd ed., Prentice Hall, Ch. 12.',
        '<i>Kremser, A.</i> (1930) Theoretical analysis of absorption process. <i>National Petroleum News</i> 22(21), 42–49.',
        '<i>Kohl, A.L. & Nielsen, R.B.</i> (1997) <i>Gas Purification</i>, 5th ed., Gulf Publishing. (solvent selection, physical vs chemical solvents)',
        '<i>Poling, B.E., Prausnitz, J.M. & O’Connell, J.P.</i> (2001) <i>The Properties of Gases and Liquids</i>, 5th ed., McGraw-Hill. (benzene Antoine constants)']
    },

    {
      id: 'absorber', title: 'Material balances, minimum L/G & multistage absorbers', tags: 'absorber stripper operating line minimum liquid gas ratio kremser countercurrent stages mole ratio',
      blurb: 'Design a counter-current absorber or stripper stage by stage.',
      lead: 'In a counter-current column the gas enters at the bottom and leaves at the top; liquid does the opposite. A solute balance over any section gives the <b>operating line</b>. Equilibrium limits how close it can approach — that sets the <b>minimum liquid rate</b>.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Column specification', controls: [
            { k: 'mode', t: 'seg', label: 'Operation', v: 'abs', opts: { abs: 'Absorber', str: 'Stripper' } },
            { k: 'src', t: 'select', label: 'Equilibrium from', v: 'm', opts: Object.assign({ m: 'Slope m (enter below)' }, GAS) },
            { k: 'm', label: 'Equilibrium slope $m$ (y = mx)', min: .1, max: 5, step: .01, v: 1.2 }, { k: 'T', label: 'Temperature (gas data)', min: 0, max: 80, step: 1, v: 20, unit: '°C' }, { k: 'P', label: 'Pressure (gas data)', min: 1, max: 50, step: .5, v: 10, unit: 'atm' },
            { t: 'sep', label: 'Streams' },
            { k: 'G', label: 'Gas feed (absorber) · liquid feed (stripper)', min: 10, max: 500, step: 1, v: 100, unit: 'kmol/h' }, { k: 'yin', label: 'Solute in entering gas $y$', min: 0, max: .3, step: .001, v: .05 },
            { k: 'xin', label: 'Solute in entering liquid $x$', min: 0, max: .2, step: .001, v: 0 }, { k: 'rec', label: 'Recovery / removal', min: 50, max: 99.9, step: .1, v: 95, unit: '%' },
            { k: 'f', label: 'Actual / minimum ratio', min: 1.02, max: 3, step: .01, v: 1.5 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'col', t: 'html' }, { k: 'p', t: 'plot', h: 420 }, { k: 'tb', t: 'html' }],
          update(s, V) {
            const m = s.src === 'm' ? s.m : C.henryPx(s.src, s.T + 273.15) / (s.P * 101325), abs = s.mode === 'abs';
            const Ye = X => Yeq(X, m), Xe = Y => Xeq(Y, m), feas = [];
            let ro = [['Equilibrium slope m', UI.fmt(m, 4)]], steps = [], lines = {};
            const p = (Xmax, Ymax) => V.p.frame({ x: [0, Xmax], y: [0, Ymax], xl: 'X = x/(1−x)  mol solute / mol solvent', yl: 'Y = y/(1−y)  mol solute / mol carrier gas', xs: 'X', ys: 'Y' });
            if (abs) {
              const Gs = s.G * (1 - s.yin), Yin = s.yin / (1 - s.yin), Yout = Yin * (1 - s.rec / 100), Xin = s.xin / (1 - s.xin);
              if (Ye(Xin) >= Yout) { V.ro.set([['Infeasible', 'entering liquid is not lean enough: Y*(X_in) ≥ Y_out', 'bad']]); V.p.frame({ x: [0, 1], y: [0, 1] }).done(); V.tb.innerHTML = V.col.innerHTML = ''; return; }
              const ok = S => { const Xo = Xin + (Yin - Yout) / S; for (let i = 1; i <= 200; i++) { const X = Xin + (Xo - Xin) * i / 200; if (Yout + S * (X - Xin) < Ye(X) - 1e-12) return false; } return true; };
              let lo = 1e-6, hi = 1e4; for (let i = 0; i < 80; i++) { const md = Math.sqrt(lo * hi); ok(md) ? hi = md : lo = md; }
              const Smin = hi, S = Smin * s.f, Xout = Xin + (Yin - Yout) / S, XoutMin = Xin + (Yin - Yout) / Smin;
              let Y = Yout, X = Xin, n = 0;
              while (n < 60) { const Xn = Xe(Y); n++; steps.push([X, Y, Xn]); if (Xn >= Xout || !isFinite(Xn)) { const fr = (Xout - X) / (Xn - X); steps.frac = n - 1 + Math.min(1, Math.max(0, fr)); break; } X = Xn; Y = Yout + S * (X - Xin); }
              const A = S / m, NK = Math.abs(A - 1) < 1e-6 ? (s.yin - m * s.xin) / (s.yin * (1 - s.rec / 100) - m * s.xin) - 1 : Math.log((s.yin - m * s.xin) / (s.yin * (1 - s.rec / 100) - m * s.xin) * (1 - 1 / A) + 1 / A) / Math.log(A);
              ro = ro.concat([['Carrier gas $G_s$', UI.fmt(Gs, 2) + ' kmol/h'], ['$(L_s/G_s)_{min}$', UI.fmt(Smin, 4)], ['$L_{s,min}$', UI.fmt(Smin * Gs, 2) + ' kmol/h'], ['Solvent $L_s$', UI.fmt(S * Gs, 2) + ' kmol/h', 'ok'], ['$X_{out}$ (rich liquid)', UI.fmt(Xout, 5)], ['Solute absorbed', UI.fmt(Gs * (Yin - Yout), 3) + ' kmol/h'], ['Absorption factor A = L/mG', UI.fmt(A, 3)], ['<b>Ideal stages</b> (graphical)', UI.fmt(steps.frac ?? n, 2), 'ok'], ['Kremser (dilute)', UI.fmt(NK, 2)]]);
              const Xm = Math.max(XoutMin, Xout) * 1.15, Ym = Yin * 1.15, q = p(Xm, Ym);
              q.fn(Ye, 0, Xm, { c: 'c1', l: 'Equilibrium Y*(X)' }); q.line([[Xin, Yout], [XoutMin, Yin]], { c: 'mu', dash: [5, 4], w: 1.4, l: 'Minimum-liquid line' }); q.line([[Xin, Yout], [Xout, Yin]], { c: 'c2', l: 'Operating line' });
              const st = []; steps.forEach(([x0, y0, x1]) => { st.push([x0, y0], [x1, y0], [x1, Yout + S * (x1 - Xin)]); }); q.line(st, { c: 'c3', w: 1.5, l: 'Stages' });
              steps.forEach(([x0, y0, x1], i) => q.text(x1, y0, String(i + 1), { dx: 3, size: 11, c: 'c3' }));
              q.text(Xin, Yout, ' top', { bl: 'top', c: 'mu' }); q.text(Xout, Yin, 'bottom ', { al: 'right', c: 'mu' }); q.done();
              V.col.innerHTML = ''; stageSVG(V.col, steps, Yin, Xout, `gas out Y = ${f(Yout, 4)}`, `gas in Y = ${f(Yin, 4)}`, `solvent in X = ${f(Xin, 4)}`, `liquid out X = ${f(Xout, 4)}`);
            } else {
              const Ls = s.G, Xin = s.xin / (1 - s.xin) || .05, Xout = Xin * (1 - s.rec / 100), Yin = s.yin / (1 - s.yin);
              if (Ye(Xout) <= Yin) { V.ro.set([['Infeasible', 'stripping gas not clean enough: Y_in ≥ Y*(X_out)', 'bad']]); V.p.frame({ x: [0, 1], y: [0, 1] }).done(); V.tb.innerHTML = V.col.innerHTML = ''; return; }
              const ok = Yt => { for (let i = 0; i <= 200; i++) { const X = Xout + (Xin - Xout) * i / 200; if (Yin + (Yt - Yin) * (X - Xout) / (Xin - Xout) > Ye(X) + 1e-12) return false; } return true; };
              const Ytmax = C.bisect(Yt => ok(Yt) ? -1 : 1, Yin + 1e-12, Ye(Xin)) || Ye(Xin), Yt = Yin + (Ytmax - Yin) / s.f;
              const GsMin = Ls * (Xin - Xout) / (Ytmax - Yin), Gs = GsMin * s.f, op = X => Yin + (Yt - Yin) * (X - Xout) / (Xin - Xout);
              let X = Xin, Y = Yt, n = 0;
              while (n < 60) { const Xn = Xe(Y); n++; steps.push([X, Y, Xn]); if (Xn <= Xout) { steps.frac = n - 1 + (X - Xout) / (X - Xn); break; } X = Xn; Y = op(X); }
              const Sf = m * Gs / Ls, ys = s.yin / m, NK = Math.log((s.xin - ys) / (s.xin * (1 - s.rec / 100) - ys) * (1 - 1 / Sf) + 1 / Sf) / Math.log(Sf);
              ro = ro.concat([['Solute-free liquid $L_s$', UI.fmt(Ls, 2) + ' kmol/h'], ['$G_{s,min}$', UI.fmt(GsMin, 3) + ' kmol/h'], ['Stripping gas $G_s$', UI.fmt(Gs, 3) + ' kmol/h', 'ok'], ['$Y_{out}$ gas', UI.fmt(Yt, 5)], ['Stripping factor S = mG/L', UI.fmt(Sf, 3)], ['<b>Ideal stages</b> (graphical)', UI.fmt(steps.frac ?? n, 2), 'ok'], ['Kremser (dilute)', UI.fmt(NK, 2)]]);
              const Xm = Xin * 1.1, Ym = Math.max(Ye(Xin), Ytmax) * 1.1, q = p(Xm, Ym);
              q.fn(Ye, 0, Xm, { c: 'c1', l: 'Equilibrium Y*(X)' }); q.line([[Xout, Yin], [Xin, Ytmax]], { c: 'mu', dash: [5, 4], w: 1.4, l: 'Minimum-gas line' }); q.line([[Xout, Yin], [Xin, Yt]], { c: 'c2', l: 'Operating line' });
              const st = []; steps.forEach(([x0, y0, x1]) => st.push([x0, y0], [x1, y0], [x1, op(x1)])); q.line(st, { c: 'c3', w: 1.5, l: 'Stages' }); q.done();
              V.col.innerHTML = ''; stageSVG(V.col, steps, Yt, Xin, `stripping gas out Y = ${f(Yt, 4)}`, `stripping gas in Y = ${f(Yin, 4)}`, `liquid in X = ${f(Xin, 4)}`, `stripped liquid X = ${f(Xout, 4)}`);
            }
            V.ro.set(ro);
            V.tb.innerHTML = ''; V.tb.append(UI.table(['Stage', 'Y leaving (gas)', 'X leaving (liquid)'], steps.map(([x0, y0, x1], i) => [i + 1, y0.toFixed(5), x1.toFixed(5)]), [1, 2]));
          }
        });
        UI.note(el, 'Why mole <b>ratios</b>? The carrier gas $G_s$ and solvent $L_s$ don’t transfer, so they are constant through the column and the operating line is exactly straight in X–Y coordinates. In mole fractions it curves unless the mixture is dilute (then Kremser applies).');
        UI.note(el, 'Watch the <b>tangent pinch</b>: with a curved equilibrium line the minimum-liquid line may touch the curve in the middle of the column instead of at the bottom. The simulator finds the true minimum numerically, so it handles both cases.', 'blue');
      },
      eqs: [
        { n: 'Overall solute balance (absorber)', m: 'G_s(Y_{in}-Y_{out}) = L_s(X_{out}-X_{in})' },
        { n: 'Operating line', m: 'Y = \\frac{L_s}{G_s}X + \\left(Y_{out}-\\frac{L_s}{G_s}X_{in}\\right)' },
        { n: 'Minimum liquid (no tangent pinch)', m: '\\left(\\frac{L_s}{G_s}\\right)_{min} = \\frac{Y_{in}-Y_{out}}{X^*_{out}-X_{in}}' },
        { n: 'Kremser equation (absorber)', m: 'N = \\frac{\\ln\\left[\\frac{y_{in}-mx_{in}}{y_{out}-mx_{in}}\\left(1-\\frac1A\\right)+\\frac1A\\right]}{\\ln A},\\ A=\\frac{L}{mG}' },
        { n: 'Rule of thumb', m: 'L = (1.2\\text{ to }2.0)\\,L_{min},\\quad A \\approx 1.4' }],
      fx: [['↑ L/G', 'operating line moves away from equilibrium → fewer stages, more dilute product liquid'], ['L → L_min', 'stages → ∞ (pinch)'], ['↑ Recovery', 'Y_out ↓ → many more stages near the top'], ['↑ Pressure / ↓ T', 'm ↓ → equilibrium line lower → easier absorption'], ['Dirty entering solvent (↑ x_in)', 'limits achievable Y_out (Y_out > mX_in)']],
      quiz: [{ q: 'If A = L/(mG) < 1 in an absorber, then…', o: ['any recovery is possible with enough stages', 'recovery is limited even with infinite stages', 'no stages are needed', 'the column floods'], a: 1, ex: 'The liquid cannot carry all the solute: maximum fractional absorption → A.' },
        { q: 'For an absorber, the operating line lies…', o: ['below the equilibrium curve', 'above the equilibrium curve', 'on the diagonal', 'on the equilibrium curve'], a: 1, ex: 'Gas is richer than equilibrium with the liquid, so solute transfers to the liquid.' }],
      refs: ['<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 8.', '<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill.', '<i>Wankat, P.C.</i> (2012) <i>Separation Process Engineering</i>, 3rd ed., Prentice Hall, Ch. 12.', '<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 6.',
        '<i>Kremser, A.</i> (1930) Theoretical analysis of absorption process. <i>National Petroleum News</i> 22(21), 42–49.',
        '<i>Souders, M. & Brown, G.G.</i> (1932) Fundamental design of absorbing and stripping columns for complex vapors. <i>Ind. Eng. Chem.</i> 24, 519–522. (absorption-factor method)']
    }
  ];
})();
