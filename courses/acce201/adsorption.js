/* ACCE 201 · Unit 5 — Adsorption */
window.T201 = window.T201 || {};
(function () {
  const C = Chem;
  const ba = (ta, xi) => ta <= 0 ? 0 : (1 - Math.exp(-ta)) / (1 + Math.exp(xi - ta) - Math.exp(-ta));
  const GL = 0xcfd8e3, MET = 0x9aa5b1, fm = (x, n) => UI.fmt(x, n), sg = x => 1 / (1 + Math.exp(-x)), sp = x => x > 30 ? x : Math.log1p(Math.exp(x));
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const FRESH = [.08, .72, .65], SAT = [.92, .35, .05], CLEAN = [.72, .88, 1];
  const svgT = (x, y, t, a = 'start', k = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${k}">${t}</text>`, svgA = (x1, y1, x2, y2) => `<line class="s" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ar)"/>`;
  const DEFS = `<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="a"/></marker></defs>`;

  /* Langmuir surface: 10×10 identical sites, molecules bounce in a closed box, stick only on an empty site,
     leave with first-order rate k_d = A·exp(−Q/RT). Wall flux per site = N_g v/(4 H N_s), so θ = K'N_g/(1+K'N_g), K' = v/(4 H N_s k_d). */
  function surface(v, st, out) {
    const ns = 10, NS = ns * ns, W = 5, cs = W / ns, H = 3, NMAX = 320, vel = 3, r = .11;
    v.box(W + .2, .16, W + .2, 0x6b7280, [0, -.08, 0]); v.box(W, H, W, GL, [0, H / 2, 0], { op: .06, ds: 1 });
    const sg3 = new THREE.BufferGeometry(), sp3 = []; for (let k = 0; k < NS; k++) sp3.push(-W / 2 + cs * (k % ns + .5), .01, -W / 2 + cs * (Math.floor(k / ns) + .5));
    sg3.setAttribute('position', new THREE.Float32BufferAttribute(sp3, 3)); v.root.add(new THREE.Points(sg3, new THREE.PointsMaterial({ size: .09, color: 0x374151 })));
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), NMAX), Mx = new THREE.Matrix4(), cG = new THREE.Color(0x3b82d6), cA = new THREE.Color(0xe8833a);
    for (let i = 0; i < NMAX; i++) im.setColorAt(i, cG); v.root.add(im);
    const dir = up => { const u = up ? Math.sqrt(Math.random()) : 2 * Math.random() - 1, a = 6.2832 * Math.random(), q = Math.sqrt(1 - u * u); return [q * Math.cos(a), up ? u : u, q * Math.sin(a)]; };
    let M = [], occ = new Int16Array(NS), N0 = -1, th = 0, ng = 0, acc = 0, age = 0;
    const reset = () => { occ.fill(-1); M = []; for (let i = 0; i < st.N; i++) { M.push({ x: [(Math.random() - .5) * W * .95, .3 + Math.random() * (H - .5), (Math.random() - .5) * W * .95], d: dir(0), s: -1 }); im.setColorAt(i, cG); } im.count = st.N; im.instanceColor.needsUpdate = true; N0 = st.N; age = 0; th = 0; ng = st.N; };
    v.tag('Gas molecules (blue) fly and bounce', [W / 2, H * .8, 0], 'gas'); v.tag('Adsorbed molecules (orange) sit on sites', [-W / 2, .1, W / 2], 'ads'); v.tag('Adsorbent surface: grid of identical sites', [W / 2, 0, -W / 2], 'site');
    v.tick((t, dt) => {
      if (st.N !== N0 || st.rs) { st.rs = 0; reset(); }
      dt = Math.min(dt, .05); const kd = 6800 * Math.exp(-st.Q * 1000 / (8.314 * st.T)), pd = 1 - Math.exp(-kd * dt); let nAds = 0;
      M.forEach((m, i) => {
        if (m.s >= 0) { nAds++; if (Math.random() < pd) { occ[m.s] = -1; m.s = -1; m.d = dir(1); m.x[1] = r + .02; im.setColorAt(i, cG); im.instanceColor.needsUpdate = true; } }
        else {
          for (let j = 0; j < 3; j++) m.x[j] += m.d[j] * vel * dt;
          for (const j of [0, 2]) { if (m.x[j] > W / 2 - r) { m.x[j] = W / 2 - r; m.d[j] *= -1; } if (m.x[j] < -W / 2 + r) { m.x[j] = -W / 2 + r; m.d[j] *= -1; } }
          if (m.x[1] > H - r) { m.x[1] = H - r; m.d[1] *= -1; }
          if (m.x[1] < r) { const k = Math.min(ns - 1, Math.floor((m.x[0] + W / 2) / cs)) + ns * Math.min(ns - 1, Math.floor((m.x[2] + W / 2) / cs));
            if (occ[k] < 0) { occ[k] = i; m.s = k; m.x = [sp3[k * 3], r, sp3[k * 3 + 2]]; im.setColorAt(i, cA); im.instanceColor.needsUpdate = true; nAds++; } else { m.x[1] = r; m.d[1] *= -1; } }
        }
        Mx.makeTranslation(m.x[0], m.x[1], m.x[2]); im.setMatrixAt(i, Mx);
      });
      im.instanceMatrix.needsUpdate = true;
      const w = Math.min(1, dt / 4); age += dt; th += (nAds / NS - th) * w; ng += (M.length - nAds - ng) * w;
      if ((acc += dt) > .5) { acc = 0; const K = vel / (4 * H * NS * kd), tl = K * ng / (1 + K * ng);
        out.innerHTML = `<p class="hint" style="margin:4px 0">Molecules: <b>${M.length - nAds}</b> in the gas + <b>${nAds}</b> on the surface = <b>${M.length}</b> (conserved). Coverage θ (time-averaged): <b>${fm(th, 3)}</b> · Langmuir prediction K′N<sub>gas</sub>/(1 + K′N<sub>gas</sub>): <b>${fm(tl, 3)}</b>${age < 12 ? ' (still settling…)' : ''}.</p>`; }
    });
  }

  /* fixed bed: Bohart–Adams/Thomas solid profile q/q0 = (e^τ−1)/(e^τ+e^ξ−1), τ = k C0 t, ξ = k q0 m (z/L)/Q */
  function bed(v, st) {
    const { cstream, hsh } = T201.fx3, R = .75, H = 3.6, y0 = .4, n = 560;
    v.cyl(R + .05, H + .4, GL, [0, y0 + H / 2, 0], { op: .14, ds: 1, open: 1 }); v.cyl(R + .05, .05, MET, [0, y0 - .03, 0]); v.cyl(R + .05, .05, MET, [0, y0 + H + .2, 0], { op: .5 });
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(.11, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff }), n), Mx = new THREE.Matrix4(), col = new THREE.Color(), XI = new Float32Array(n);
    for (let i = 0; i < n; i++) { const rr = (R - .1) * Math.sqrt(hsh(i, 13)), a = 6.2832 * hsh(i, 29), y = y0 + .1 + (H - .2) * (i + .5) / n; Mx.makeTranslation(rr * Math.cos(a), y, rr * Math.sin(a)); im.setMatrixAt(i, Mx); XI[i] = (y0 + H - y) / H; im.setColorAt(i, col.setRGB(...FRESH)); }
    v.root.add(im);
    const PF = [[-2.4, y0 + H + .7, 0], [0, y0 + H + .7, 0], [0, y0 + H + .25, 0]], PO = [[0, y0 - .05, 0], [0, -.25, 0], [2.4, -.25, 0]];
    v.pipe(PF, .08, MET, { op: .35 }); v.pipe(PO, .08, MET, { op: .35 });
    const { pathAt } = T201.fx3, cl = st => sg(st.bt - st.a);
    cstream(v, 70, .1, u => pathAt(PF, u), () => SAT, .25);
    cstream(v, 220, .08, (u, i) => { const rr = (R - .08) * Math.sqrt(hsh(i, 17)), a = 6.2832 * hsh(i, 31); return [rr * Math.cos(a), y0 + H + .15 - u * (H + .1), rr * Math.sin(a)]; }, u => lerp3(CLEAN, SAT, ba(st.bt, st.a * Math.min(1, Math.max(0, u)))), .06);
    cstream(v, 70, .1, u => pathAt(PO, u), () => lerp3(CLEAN, SAT, cl(st)), .25);
    v.tag('Feed: solute at C₀ (orange)', PF[0], 'feed'); v.tag('Saturated adsorbent: q = q₀', [-R, y0 + H - .25, 0], 'sat'); v.tag('Fresh adsorbent', [-R, y0 + .25, 0], 'fresh');
    const tz = v.tag('Mass-transfer zone (moves down)', [R, y0 + H / 2, 0], 'mtz'); v.tag('Effluent: C/C₀ rises at breakthrough', PO[2], 'out');
    v.tick(() => { for (let i = 0; i < n; i++) im.setColorAt(i, col.setRGB(...lerp3(FRESH, SAT, ba(st.bt, st.a * XI[i])))); im.instanceColor.needsUpdate = true; tz.p.y = y0 + H - H * Math.min(1, Math.max(0, st.bt / st.a)); });
  }
  const ISO = { // IUPAC types: shape function of x = P/P0 and description
    I: [x => 1 - Math.exp(-25 * x), 'Type I — micropores (N₂ at 77 K on zeolites or activated carbon). The plateau is micropore filling; Langmuir-like.'],
    II: [x => C.bet(Math.min(x, .97), .3, 80), 'Type II — non-porous / macroporous (N₂ at 77 K on non-porous silica or carbon black). Monolayer then unrestricted multilayer (BET). Knee = monolayer complete.'],
    III: [x => .4 * x * x / Math.pow(1.02 - x, 1.2), 'Type III — weak adsorbent–adsorbate interaction (e.g. water on graphite). Convex, no knee.'],
    IV: [x => Math.min(C.bet(x, .3, 80), .3 * (1.5 + 1.5 / (1 + Math.exp(-(x - .55) * 25)))), 'Type IV — mesopores (silica gel, alumina). Capillary condensation gives a step and hysteresis.'],
    V: [x => 2.5 / (1 + Math.exp(-(x - .5) * 14)) - .002, 'Type V — weak interaction + pores (water on hydrophobic activated carbon). S-shaped with pore filling.'],
    VI: [x => .3 * Math.floor(x * 5) + .3 / (1 + Math.exp(-((x * 5) % 1 - .5) * 30)), 'Type VI — stepwise multilayer on uniform non-porous surface (Kr on graphite).']
  };

  T201.adsorption = [
    {
      id: 'ads-basics', title: 'How adsorption works; types & adsorbents', tags: 'physisorption chemisorption adsorbent activated carbon silica gel alumina zeolite molecular sieve selection iupac isotherm types',
      blurb: 'Physical vs chemical adsorption, common adsorbents, their properties and uses.',
      lead: '<b>Adsorption</b> is the accumulation of molecules (the <i>adsorbate</i>) on a solid surface (the <i>adsorbent</i>). Because it is a surface process, good adsorbents are extremely porous: one gram of activated carbon can have 500–2000 m² of surface, several tennis courts.',
      render(el, UI) {
        const st = { N: 120, T: 300, Q: 25 };
        const S = UI.sim(el, {
          title: 'Molecules on a surface (Langmuir picture)', controls: [
            { k: 'N', label: 'Molecules in the box (≈ gas pressure)', min: 20, max: 300, step: 1, v: 120 },
            { k: 'T', label: 'Temperature', min: 250, max: 450, step: 1, v: 300, unit: 'K' },
            { k: 'Q', label: 'Heat of adsorption $-\\Delta H$', min: 10, max: 40, step: .5, v: 25, unit: 'kJ/mol', hint: 'Time is slowed: real molecules hop on and off about 10¹³ times faster.' }],
          views: [{ k: 'v', t: '3d', h: 420, cam: [0, 4.4, 7.6], target: [0, 1.1, 0] }, { k: 'o', t: 'html' }],
          update(s, V, S) { Object.assign(st, s); if (V.v.ok) { if (!S._b) { S._b = 1; surface(V.v, st, V.o); } const w = V.v.el.clientWidth || 700, k = Math.min(2.2, Math.max(1, 640 / w)); if (S._w !== k) { S._w = k; V.v.look([0, 4.4 * k, 7.6 * k], [0, 1.1, 0]); } } }
        });
        UI.walk(el, [
          { t: '1 · Molecules strike the surface', d: 'Gas molecules fly about and hit the solid all the time. The number of hits per second on each site is proportional to the gas pressure.', hi: ['gas'], set: { T: 300, Q: 25 } },
          { t: '2 · They stick on empty sites', d: 'A molecule that lands on an empty site is held by van der Waals forces (<b>physisorption</b>) or by a chemical bond (<b>chemisorption</b>). In the Langmuir picture each site holds one molecule and sites do not affect each other.', hi: ['ads', 'site'] },
          { t: '3 · They leave again', d: 'Thermal vibration shakes adsorbed molecules loose. The leaving rate per molecule is k<sub>d</sub> ∝ exp(−Q/RT): a strong bond (large Q) or a cold surface keeps them on. Try −ΔH = 40 kJ/mol: almost nothing leaves, like chemisorption.', hi: ['ads'], set: { Q: 25 } },
          { t: '4 · Dynamic equilibrium = the isotherm', d: 'Coverage stops changing when sticking rate = leaving rate: k<sub>a</sub>p(1 − θ) = k<sub>d</sub>θ, so θ = Kp/(1 + Kp). The counter under the view compares the simulated θ with this Langmuir prediction.', hi: ['gas', 'ads'] },
          { t: '5 · Heat it: regeneration', d: 'Raising the temperature makes k<sub>d</sub> grow much faster than the sticking rate, so coverage falls. This is how a loaded bed is regenerated by temperature swing (TSA); lowering the pressure does the same in PSA.', hi: ['gas'], set: { T: 420 } }
        ], (i, x) => { if (x.set) Object.entries(x.set).forEach(([k, v]) => S.set(k, v)); S.V.v.hi && S.V.v.hi(x.hi); });
        UI.sec(el, 'Physical vs chemical adsorption');
        el.append(UI.table(['', 'Physical (physisorption)', 'Chemical (chemisorption)'], [['Forces', 'van der Waals', 'chemical bond (electron transfer)'], ['Heat of adsorption', 'close to the heat of condensation, at most 2–3 × (typically < 50 kJ/mol)', '≈ 40–400 kJ/mol (like a reaction)'], ['Specificity', 'non-specific', 'highly specific'], ['Layers', 'multilayer possible', 'monolayer only'], ['Temperature', 'favoured at low T', 'often needs activation, higher T'], ['Reversibility', 'reversible (easy regeneration)', 'often irreversible'], ['Rate', 'fast', 'can be slow (activated)'], ['Uses', 'separation, drying, purification', 'heterogeneous catalysis']]));
        UI.sec(el, 'Adsorbents and their applications');
        el.append(UI.table(['Adsorbent', 'Surface area (m²/g)', 'Pore size', 'Surface', 'Typical applications'], [['Activated carbon', '500–2000', 'micro + meso', 'hydrophobic', 'solvent recovery, water treatment, decolourising sugar, gas masks'], ['Silica gel', '300–800', 'meso 2–10 nm', 'hydrophilic', 'drying gases, desiccant packs, chromatography'], ['Activated alumina', '200–400', 'meso', 'hydrophilic, polar', 'drying air & liquids, fluoride removal, Claus catalyst'], ['Zeolites / molecular sieves', '500–800', 'uniform 0.3–1 nm', 'polar, ionic', 'O₂/N₂ PSA (5A, 13X), drying ethanol (3A), n-paraffin separation'], ['Carbon molecular sieve', '400–600', 'uniform ~0.4 nm', 'non-polar', 'N₂ generators (kinetic O₂/N₂ separation)'], ['Polymeric resins', '100–700', 'macro/meso', 'tunable', 'antibiotics, phenol removal'], ['Clays (fuller’s earth)', '50–250', 'variable', 'polar', 'oil bleaching, decolourising']]));
        UI.sec(el, 'Characteristics that matter — and how to choose');
        UI.para(el, '<ul><li><b>Capacity</b> (from the isotherm at your conditions) and <b>working capacity</b> between adsorption and regeneration conditions.</li><li><b>Selectivity</b>: equilibrium (different affinities) or kinetic (different diffusion rates — carbon molecular sieves).</li><li><b>Surface area & pore size distribution</b>: pore must admit the molecule; micropores give capacity, meso/macropores give access.</li><li><b>Kinetics</b>: small particles and large pores → fast uptake but higher bed ΔP.</li><li><b>Regenerability</b>, mechanical strength (attrition in moving/fluidised beds), thermal & chemical stability, cost.</li><li><b>Polarity</b>: hydrophilic (silica, alumina, zeolites) for water; hydrophobic (carbon) for organics in humid streams.</li></ul>');
        UI.sec(el, 'IUPAC isotherm shapes', 'Measured with N₂ at 77 K (Ar at 87 K) against relative pressure. The shape reveals the pore structure.');
        UI.sim(el, {
          title: 'Isotherm type', controls: [{ k: 't', t: 'seg', label: 'IUPAC type', v: 'I', opts: { I: 'I', II: 'II', III: 'III', IV: 'IV', V: 'V', VI: 'VI' } }],
          views: [{ k: 'd', t: 'html' }, { k: 'p', t: 'plot', h: 300 }],
          update(s, V) { V.d.innerHTML = ''; V.d.append(UI.h('p', { style: 'margin:0' }, ISO[s.t][1])); const f = ISO[s.t][0], ys = C.linspace(.001, .97, 200).map(f), ym = Math.max(...ys);
            const p = V.p.frame({ x: [0, 1], y: [0, ym * 1.1], xl: 'Relative pressure P/P₀', yl: 'Amount adsorbed (relative)' }); p.fn(f, .001, .97, { l: 'adsorption' });
            if (s.t === 'IV' || s.t === 'V') p.fn(x => f(Math.min(.97, x + .08 * (x > .4 && x < .85 ? 1 : 0) * Math.sin((x - .4) / .45 * Math.PI))), .001, .97, { c: 'c2', dash: [5, 4], l: 'desorption (hysteresis)' }); p.done(); }
        });
      },
      quiz: [{ q: 'Which adsorbent would you choose to dry ethanol vapour (remove water, keep ethanol)?', o: ['Activated carbon', '3A molecular sieve', 'Polymeric resin', '13X zeolite'], a: 1, ex: '3 Å pores admit water (2.8 Å) but exclude ethanol (4.4 Å).' }, { q: 'Chemisorption differs from physisorption because it…', o: ['forms multilayers', 'has small heat of adsorption', 'is specific and limited to a monolayer', 'is always reversible'], a: 2 }],
      refs: ["<i>Langmuir, I.</i> (1918) The adsorption of gases on plane surfaces of glass, mica and platinum. <i>J. Am. Chem. Soc.</i> 40, 1361–1403.", "<i>Thommes, M. et al.</i> (2015) Physisorption of gases, with special reference to the evaluation of surface area and pore size distribution (IUPAC Technical Report). <i>Pure Appl. Chem.</i> 87, 1051–1069.", "<i>Sing, K.S.W. et al.</i> (1985) Reporting physisorption data for gas/solid systems (IUPAC Recommendations 1984). <i>Pure Appl. Chem.</i> 57, 603–619.", "<i>Yang, R.T.</i> (2003) <i>Adsorbents: Fundamentals and Applications</i>, Wiley.", "<i>Ruthven, D.M.</i> (1984) <i>Principles of Adsorption and Adsorption Processes</i>, Wiley.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 11 (adsorption)."]
    },

    {
      id: 'isotherms', title: 'Adsorption equilibria, isotherms & heat of adsorption', tags: 'isotherm langmuir freundlich bet temperature isosteric heat of adsorption clausius clapeyron',
      blurb: 'Langmuir, Freundlich, BET — and extracting ΔH from isosteres.',
      lead: 'An <b>isotherm</b> is the equilibrium relation between the loading $q$ on the solid and the concentration (or pressure) in the fluid at constant temperature. Since adsorption is exothermic, raising T lowers $q$; the size of that shift gives the <b>heat of adsorption</b>.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Isotherm model', controls: [
            { k: 'mod', t: 'seg', label: 'Model', v: 'L', opts: { L: 'Langmuir', F: 'Freundlich', B: 'BET' } },
            { k: 'qm', label: 'Monolayer capacity $q_m$', min: .5, max: 10, step: .1, v: 4, unit: 'mol/kg' }, { k: 'K0', label: 'Pre-factor $K_0$', min: 1e-6, max: 1e-2, v: 2e-5, log: 1, unit: '1/kPa' },
            { k: 'Q', label: 'Heat of adsorption $-\\Delta H$', min: 5, max: 60, step: .5, v: 25, unit: 'kJ/mol' }, { k: 'n', label: 'Freundlich $n$', min: 1, max: 6, step: .1, v: 2.5 },
            { k: 'cb', label: 'BET constant $c$', min: 2, max: 500, v: 100, log: 1 }, { k: 'T', label: 'Temperature', min: 250, max: 450, step: 1, v: 300, unit: 'K' }, { k: 'pmax', label: 'Pressure range', min: 10, max: 1000, step: 10, v: 200, unit: 'kPa' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 330 }, { k: 'q', t: 'plot', row: 'r', h: 330 }],
          update(s, V) {
            const K = T => s.K0 * Math.exp(s.Q * 1000 / (8.314 * T));
            const iso = (p, T) => s.mod === 'L' ? C.langmuir(p, s.qm, K(T)) : s.mod === 'F' ? s.qm * Math.pow(K(T) * p, 1 / s.n) : C.bet(Math.min(p / s.pmax, .9), s.qm, s.cb);
            if (s.mod === 'B') { const p = V.p.frame({ x: [0, .9], y: [0, C.bet(.9, s.qm, s.cb)], xl: 'Relative pressure x = P/P₀', yl: 'Amount adsorbed v (same units as v_m)', xs: 'x', ys: 'v' });
              [[s.cb / 10, 'c2'], [s.cb, 'c1'], [s.cb * 10, 'c5']].forEach(([c, col]) => p.fn(x => C.bet(x, s.qm, c), .001, .9, { c: col, w: c === s.cb ? 2.6 : 1.4, l: 'c = ' + UI.fmt(c, 3) })); p.hl(s.qm, { l: 'v_m (monolayer)' }); p.done(); }
            else { const p = V.p.frame({ x: [0, s.pmax], y: [0, s.qm * 1.1], xl: 'Pressure p (kPa)', yl: 'Loading q (mol/kg)', xs: 'p', ys: 'q' });
            [[s.T - 30, 'c2'], [s.T, 'c1'], [s.T + 30, 'c5']].forEach(([T, c]) => p.fn(x => iso(x, T), .001, s.pmax, { c, w: T === s.T ? 2.6 : 1.4, l: T + ' K' }));
            if (s.mod === 'L') p.hl(s.qm, { l: 'q_m (monolayer)' }); p.done(); }
            // isosteres: p needed for fixed q at different T (Langmuir/Freundlich analytic)
            const pq = (q, T) => s.mod === 'L' ? q / (K(T) * (s.qm - q)) : Math.pow(q / s.qm, s.n) / K(T);
            const Ts = C.linspace(s.T - 40, s.T + 40, 30), fr = [.2, .4, .6];
            const all = fr.flatMap(f => Ts.map(T => Math.log(pq(f * s.qm, T))));
            const q = V.q.frame({ x: [1000 / (s.T + 40), 1000 / (s.T - 40)], y: [Math.min(...all), Math.max(...all)], xl: '1000 / T (K⁻¹)', yl: 'ln p at constant q (isostere)', xs: '1000/T', ys: 'ln p' });
            let fit; fr.forEach((f, i) => { const xs = Ts.map(T => 1000 / T), ys = Ts.map(T => Math.log(pq(f * s.qm, T))); q.line(xs.map((x, j) => [x, ys[j]]), { c: ['c2', 'c3', 'c4'][i], l: `q = ${f} q_m` }); if (i === 1) fit = C.linfit(xs, ys); }); q.done();
            const Qst = -fit.b * 8.314; // kJ/mol since x = 1000/T
            V.ro.set([['K at T', s.mod === 'B' ? 'BET c = ' + UI.fmt(s.cb, 3) : UI.fmt(K(s.T), 4) + ' kPa⁻¹'], ['q at p = range/2', UI.fmt(iso(s.pmax / 2, s.T), 4) + ' mol/kg'], ['Fractional coverage θ', UI.fmt(iso(s.pmax / 2, s.T) / s.qm, 3)], ['Isosteric heat from slope', s.mod === 'B' ? '—' : UI.fmt(Qst, 3) + ' kJ/mol', 'ok'], ['Classification', s.Q > 40 ? 'chemisorption-like' : 'physisorption']]);
          }
        });
        UI.note(el, '<b>Check it:</b> the isosteric heat computed from the slope of ln p vs 1/T equals the −ΔH you entered for Langmuir (constant heat, ideal surface). For this Freundlich form, constant q means constant K·p, so the slope again gives −ΔH. Real adsorbents have heterogeneous sites, so measured $Q_{st}$ usually falls as loading rises.');
      },
      eqs: [
        { n: 'Langmuir', m: 'q = \\frac{q_m K p}{1+Kp},\\quad \\frac{p}{q} = \\frac{1}{q_mK}+\\frac{p}{q_m}', w: 'monolayer, identical independent sites' },
        { n: 'Freundlich (empirical)', m: 'q = K_F\\,c^{1/n},\\quad \\ln q = \\ln K_F + \\tfrac1n\\ln c', w: 'n > 1 favourable' },
        { n: 'BET (multilayer)', m: '\\frac{x}{v(1-x)} = \\frac{1}{v_mc}+\\frac{c-1}{v_mc}x,\\ x = P/P_0' },
        { n: 'Temperature dependence', m: 'K = K_0\\exp\\left(\\frac{-\\Delta H_{ads}}{RT}\\right)' },
        { n: 'Isosteric heat (Clausius–Clapeyron)', m: 'Q_{st} = -\\Delta H = R\\left[\\frac{\\partial \\ln p}{\\partial(1/T)}\\right]_q' }],
      fx: [['↑ Temperature', 'loading falls (exothermic) — basis of TSA regeneration'], ['↑ Pressure / concentration', 'loading rises, saturating at q_m (Langmuir)'], ['↑ Heat of adsorption', 'steeper (more favourable) isotherm, harder to regenerate'], ['↑ Freundlich n', 'flatter, more favourable at low c']],
      quiz: [{ q: 'On a plot of p/q vs p, a Langmuir isotherm gives a straight line with slope…', o: ['K', '1/q_m', 'q_m K', '1/(q_m K)'], a: 1 }, { q: 'Adsorption is spontaneous and ΔS < 0, so ΔH must be…', o: ['positive', 'negative (exothermic)', 'zero', 'undefined'], a: 1, ex: 'ΔG = ΔH − TΔS < 0 with ΔS < 0 requires ΔH < 0.' }],
      refs: ["<i>Langmuir, I.</i> (1918) The adsorption of gases on plane surfaces of glass, mica and platinum. <i>J. Am. Chem. Soc.</i> 40, 1361–1403.", "<i>Freundlich, H.</i> (1906) Über die Adsorption in Lösungen. <i>Z. Phys. Chem.</i> 57, 385–470.", "<i>Brunauer, S., Emmett, P.H. & Teller, E.</i> (1938) Adsorption of gases in multimolecular layers. <i>J. Am. Chem. Soc.</i> 60, 309–319.", "<i>Do, D.D.</i> (1998) <i>Adsorption Analysis: Equilibria and Kinetics</i>, Imperial College Press.", "<i>Ruthven, D.M.</i> (1984) <i>Principles of Adsorption and Adsorption Processes</i>, Wiley.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 11 (adsorption)."]
    },

    {
      id: 'bet', title: 'Specific surface area of an adsorbent (BET)', tags: 'bet surface area nitrogen monolayer specific surface',
      blurb: 'Fit your own N₂ data and get m²/g.',
      lead: 'The standard method: measure N₂ adsorbed at 77 K versus $P/P_0$, fit the linear BET form in $0.05 < P/P_0 < 0.30$, get the monolayer volume $v_m$, multiply by the area of one N₂ molecule (0.162 nm²).',
      render(el, UI) {
        const ta = UI.h('textarea', { style: 'width:100%;height:190px;font:12.5px var(--mono);padding:8px;border:1px solid var(--bd);border-radius:8px;background:var(--card)' });
        const r = C.rng(5); ta.value = 'P/P0, V (cm3 STP/g)\n' + [.05, .08, .11, .14, .17, .20, .23, .26, .30, .40, .50].map(x => `${x.toFixed(2)}, ${(C.bet(x, 120, 95) * (1 + .01 * C.gauss(r))).toFixed(2)}`).join('\n');
        const S = UI.sim(el, {
          title: 'Your data', controls: [{ k: 'lo', label: 'Fit range from P/P₀', min: .01, max: .2, step: .01, v: .05 }, { k: 'hi', label: 'to P/P₀', min: .15, max: .45, step: .01, v: .30 }, { k: 'sig', label: 'Cross-section σ (N₂)', min: .1, max: .3, step: .001, v: .162, unit: 'nm²' }, { t: 'html', html: 'Edit or paste your own data below (CSV).' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 300 }, { k: 'q', t: 'plot', row: 'r', h: 300 }],
          update(s, V) {
            const d = ta.value.split('\n').map(l => l.split(/[,;\t ]+/).map(Number)).filter(a => a.length >= 2 && isFinite(a[0]) && isFinite(a[1]) && a[0] > 0 && a[0] < 1);
            const f = d.filter(([x]) => x >= s.lo && x <= s.hi); if (f.length < 2) { V.ro.set([['Need ≥ 2 points in range', '—', 'bad']]); return; }
            const X = f.map(a => a[0]), Y = f.map(([x, v]) => x / (v * (1 - x))), fit = C.linfit(X, Y), vm = 1 / (fit.a + fit.b), c = fit.b / fit.a + 1, SA = vm / 22414 * 6.022e23 * s.sig * 1e-18;
            V.ro.set([['Slope', UI.fmt(fit.b, 5)], ['Intercept', UI.fmt(fit.a, 6)], ['R²', UI.fmt(fit.r2, 5), fit.r2 > .999 ? 'ok' : 'warn'], ['Monolayer $v_m$', UI.fmt(vm, 4) + ' cm³ STP/g'], ['BET constant c', UI.fmt(c, 4), c > 0 ? '' : 'bad'], ['<b>Surface area</b>', UI.fmt(SA, 4) + ' m²/g', 'ok']]);
            const p = V.p.frame({ x: [0, Math.max(...d.map(a => a[0])) * 1.05], y: [0, Math.max(...d.map(a => a[1])) * 1.1], xl: 'P/P₀', yl: 'V (cm³ STP/g)' }); p.pts(d.map(a => [a[0], a[1]]), { l: 'data' }); p.fn(x => C.bet(x, vm, c), .005, Math.max(...d.map(a => a[0])), { c: 'c2', l: 'BET fit' }); p.hl(vm, { l: 'v_m' }); p.done();
            const q = V.q.frame({ x: [0, s.hi * 1.15], y: [0, Math.max(...Y) * 1.15], xl: 'P/P₀', yl: 'x / [V(1−x)]' }); q.pts(f.map((a, i) => [a[0], Y[i]]), { l: 'linearised data' }); q.fn(x => fit.a + fit.b * x, 0, s.hi * 1.15, { c: 'c2', l: 'least squares' }); q.done();
          }
        });
        S.ctl.append(ta); ta.oninput = S.run;
      },
      eqs: [{ n: 'Linear BET', m: '\\frac{x}{v(1-x)} = \\frac{1}{v_mc}+\\frac{c-1}{v_mc}x' }, { n: 'From slope s and intercept i', m: 'v_m = \\frac{1}{s+i},\\qquad c = \\frac{s}{i}+1' }, { n: 'Specific surface area', m: 'S = \\frac{v_m}{22414}N_A\\,\\sigma_{N_2},\\quad \\sigma_{N_2}=0.162\\ \\text{nm}^2', w: '≈ 4.35 m²/g per cm³ STP/g of v_m' }],
      quiz: [{ q: 'A sample has v_m = 100 cm³(STP)/g of N₂. Its surface area is about…', o: ['43.5 m²/g', '435 m²/g', '4350 m²/g', '100 m²/g'], a: 1 }],
      refs: ["<i>Brunauer, S., Emmett, P.H. & Teller, E.</i> (1938) Adsorption of gases in multimolecular layers. <i>J. Am. Chem. Soc.</i> 60, 309–319.", "<i>Thommes, M. et al.</i> (2015) Physisorption of gases, with special reference to the evaluation of surface area and pore size distribution (IUPAC Technical Report). <i>Pure Appl. Chem.</i> 87, 1051–1069.", "ISO 9277:2010 <i>Determination of the specific surface area of solids by gas adsorption — BET method</i>.", "<i>Gregg, S.J. & Sing, K.S.W.</i> (1982) <i>Adsorption, Surface Area and Porosity</i>, 2nd ed., Academic Press."]
    },

    {
      id: 'batch-ads', title: 'Batch adsorption in a stirred vessel', tags: 'batch adsorption stirred tank mass balance operating line kinetics ldf contact filtration',
      blurb: 'Mass balance meets isotherm — how much adsorbent do I need?',
      lead: 'A known mass of adsorbent $m$ is stirred into volume $V$ of solution. Solute leaves the liquid and appears on the solid: the <b>operating line</b> $q = (c_0-c)V/m$. Equilibrium is where this line crosses the isotherm.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Vessel', controls: [{ k: 'V', label: 'Liquid volume V', min: .1, max: 10, step: .1, v: 1, unit: 'm³' }, { k: 'c0', label: 'Initial concentration c₀', min: 10, max: 2000, step: 5, v: 500, unit: 'mg/L' }, { k: 'm', label: 'Adsorbent mass m', min: .1, max: 20, step: .05, v: 2, unit: 'kg' },
            { k: 'iso', t: 'seg', label: 'Isotherm', v: 'L', opts: { L: 'Langmuir', F: 'Freundlich' } }, { k: 'qm', label: '$q_m$ or $K_F$', min: 20, max: 500, step: 5, v: 250, unit: 'mg/g' }, { k: 'K', label: 'Langmuir K', min: .001, max: .2, v: .02, log: 1, unit: 'L/mg' }, { k: 'n', label: 'Freundlich n', min: 1, max: 6, step: .1, v: 3 },
            { k: 'k', label: 'Uptake rate constant (LDF)', min: .005, max: .5, v: .05, log: 1, unit: '1/min' }, { k: 'tgt', label: 'Target final concentration', min: 1, max: 500, step: 1, v: 50, unit: 'mg/L' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 330 }, { k: 'q', t: 'plot', row: 'r', h: 330 }],
          update(s, V) {
            const iso = c => s.iso === 'L' ? C.langmuir(c, s.qm, s.K) : s.qm * Math.pow(c / 100, 1 / s.n) / 1, ratio = s.V * 1000 / (s.m * 1000); // L per g
            const ce = C.bisect(c => (s.c0 - c) * ratio - iso(c), 1e-9, s.c0), qe = iso(ce), need = (s.c0 - s.tgt) * s.V * 1000 / iso(s.tgt) / 1000;
            // LDF kinetics: dq/dt = k (q*(c) − q), c = c0 − q/ratio  (RK4)
            const pts = [[0, s.c0]]; let q = 0; const dt = .5 / s.k / 20, tmax = 6 / s.k;
            const f = q => s.k * (iso(Math.max(s.c0 - q / ratio, 0)) - q);
            for (let t = 0; t < tmax; t += dt) { const a = f(q), b = f(q + a * dt / 2), cc = f(q + b * dt / 2), d = f(q + cc * dt); q += dt * (a + 2 * b + 2 * cc + d) / 6; pts.push([t + dt, s.c0 - q / ratio]); }
            const t90 = (pts.find(([, c]) => s.c0 - c >= .9 * (s.c0 - ce)) || [NaN])[0];
            V.ro.set([['Equilibrium c', UI.fmt(ce, 4) + ' mg/L', 'ok'], ['Equilibrium q', UI.fmt(qe, 4) + ' mg/g'], ['% removal', UI.fmt((1 - ce / s.c0) * 100, 2) + ' %'], ['Operating-line slope −V/m', UI.fmt(-ratio, 4) + ' L/g'], ['Adsorbent for target', need > 0 ? UI.fmt(need, 4) + ' kg' : '—'], ['Time to 90 % of equilibrium', UI.fmt(t90, 3) + ' min']]);
            const p = V.p.frame({ x: [0, s.c0 * 1.05], y: [0, Math.max(iso(s.c0), s.c0 * ratio) * 1.05], xl: 'c (mg/L)', yl: 'q (mg/g)', xs: 'c', ys: 'q' });
            p.fn(iso, 0, s.c0 * 1.05, { l: 'Isotherm q*(c)' }); p.line([[s.c0, 0], [0, s.c0 * ratio]], { c: 'c2', l: 'Operating line q = (c₀−c)V/m' }); p.pts([[ce, qe]], { c: 'tx', r: 6 }); p.text(ce, qe, '  equilibrium', { c: 'mu' }); p.done();
            const r = V.q.frame({ x: [0, tmax], y: [0, s.c0], xl: 't (min)', yl: 'c in liquid (mg/L)', xs: 't', ys: 'c' }); r.line(pts, { l: 'c(t) — LDF model' }); r.hl(ce, { l: 'equilibrium' }); r.done();
          }
        });
        UI.note(el, 'Freundlich here uses $q = K_F (c/100)^{1/n}$ so $K_F$ is the loading at 100 mg/L. Doubling adsorbent mass does <i>not</i> halve the final concentration — the isotherm shape decides. For difficult separations, split the adsorbent into two cross-current or counter-current contacts.');
      },
      eqs: [{ n: 'Solute balance', m: 'V(c_0-c) = m(q-q_0)\\ \\Rightarrow\\ q = \\frac{V}{m}(c_0-c)' }, { n: 'Linear driving force kinetics', m: '\\frac{dq}{dt} = k_{LDF}\\,(q^*(c)-q)' }, { n: 'Adsorbent required', m: 'm = \\frac{V(c_0-c_f)}{q^*(c_f)}' }],
      fx: [['↑ Adsorbent mass', 'operating line flatter → lower final c, but diminishing returns'], ['↑ c₀', 'more solute removed per g (higher q), lower % removal'], ['↑ Rate constant (smaller particles, stirring)', 'faster approach; same equilibrium']],
      quiz: [{ q: 'In batch adsorption the final state lies where…', o: ['the operating line crosses the isotherm', 'q = q_m', 'c = 0', 'the isotherm is steepest'], a: 0 }],
      refs: ["<i>Glueckauf, E. & Coates, J.I.</i> (1947) Theory of chromatography. Part IV. <i>J. Chem. Soc.</i> 1315–1321. (linear driving force)", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 15.", "<i>Ruthven, D.M.</i> (1984) <i>Principles of Adsorption and Adsorption Processes</i>, Wiley.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 11 (adsorption)."]
    },

    {
      id: 'fixed-bed', title: 'Fixed-bed adsorption & breakthrough', tags: 'fixed bed breakthrough curve mass transfer zone thomas exhaustion LUB column',
      blurb: 'Watch the mass-transfer zone travel down the bed.',
      lead: 'Fluid flows through a packed column of adsorbent. The bed saturates from the inlet; between saturated and fresh adsorbent is the <b>mass-transfer zone (MTZ)</b>. When the MTZ reaches the outlet, solute appears: <b>breakthrough</b>.',
      render(el, UI) {
        const st = { a: 16, bt: 8 };
        const S = UI.sim(el, {
          title: 'Column (liquid down-flow)', controls: [{ k: 'Q', label: 'Flow rate Q', min: .05, max: 2, step: .01, v: .5, unit: 'L/min' }, { k: 'C0', label: 'Feed concentration C₀', min: 10, max: 500, step: 1, v: 100, unit: 'mg/L' }, { k: 'm', label: 'Adsorbent mass', min: 50, max: 2000, step: 10, v: 500, unit: 'g' }, { k: 'q0', label: 'Capacity q₀', min: 10, max: 300, step: 1, v: 80, unit: 'mg/g' },
            { k: 'kTh', label: 'Thomas rate constant k_Th', min: 1e-5, max: 1e-2, v: 2e-4, log: 1, unit: 'L/mg·min' }, { k: 'L', label: 'Bed length', min: 10, max: 200, step: 1, v: 50, unit: 'cm' }, { k: 'tf', label: 'Time (scrub the run)', min: 0, max: 1, step: .001, v: .45 }],
          views: [{ k: 'v', t: '3d', h: 440, cam: [3, 3, 6.4], target: [0, 2, 0] }, { k: 'bal', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 330 }],
          update(s, V, S) {
            const tst = s.q0 * s.m / (s.Q * s.C0), BT = t => C.thomas(t, s.kTh, s.q0, s.m, s.Q, s.C0);
            const tb = C.bisect(t => BT(t) - .05, 0, tst * 5), te = C.bisect(t => BT(t) - .95, 0, tst * 10), tmax = te * 1.3, t = s.tf * tmax;
            const mtz = s.L * (te - tb) / (te - .5 * (te - tb)), lub = s.L * (1 - tb / tst);
            V.ro.set([['Stoichiometric time t*', UI.fmt(tst, 4) + ' min'], ['Breakthrough t_b (5 %)', UI.fmt(tb, 4) + ' min', 'ok'], ['Exhaustion t_e (95 %)', UI.fmt(te, 4) + ' min'], ['MTZ length', UI.fmt(mtz, 3) + ' cm'], ['Unused bed (LUB)', UI.fmt(lub, 3) + ' cm'], ['Bed utilisation at t_b', UI.fmt(tb / tst * 100, 2) + ' %'], ['Now t', UI.fmt(t, 4) + ' min'], ['Outlet C/C₀ now', UI.fmt(BT(t), 4)]]);
            const p = V.p.frame({ x: [0, tmax], y: [0, 1.05], xl: 't (min)', yl: 'C / C₀ at outlet', xs: 't', ys: 'C/C₀' });
            p.fn(BT, 0, tmax, { l: 'Breakthrough curve (Thomas)' }); p.vl(tb, { c: 'c3', l: 't_b' }); p.vl(te, { c: 'c5', l: 't_e' }); p.vl(tst, { c: 'mu', l: 't* (ideal, sharp front)' }); p.pts([[t, BT(t)]], { c: 'tx', r: 6 }); p.done();
            const A = s.kTh * s.q0 * s.m / s.Q, Bt = s.kTh * s.C0 * t, kq = s.Q / s.kTh, fed = s.Q * s.C0 * t, lnS = Bt > A ? Bt + Math.log1p(Math.exp(A - Bt) - Math.exp(-Bt)) : A + Math.log1p(Math.exp(Bt - A) - Math.exp(-A)), outm = kq * (lnS - A), on = s.q0 * s.m * C.linspace(0, 1, 401).reduce((a, x, j) => a + (j % 400 ? (j % 2 ? 4 : 2) : 1) * ba(Bt, A * x), 0) / 1200, cap = s.q0 * s.m, gr = x => fm(x / 1000, 3);
            Object.assign(st, { a: A, bt: Bt, fb: +(tb / tmax).toFixed(3), fe: +(te / tmax).toFixed(3) });
            if (V.v.ok) { if (!S._b) { S._b = 1; bed(V.v, st); } const w = V.v.el.clientWidth || 700, k = Math.min(2.2, Math.max(1, 640 / w)); if (S._w !== k) { S._w = k; V.v.look([3 * k, 3, 6.4 * k], [0, 2, 0]); } }
            V.bal.innerHTML = ''; const gy = 40 + 130 * Math.min(1, Math.max(0, Bt / A));
            UI.svg(V.bal, DEFS + `<rect x="282" y="40" width="56" height="${gy - 40}" fill="#ea580c" opacity=".45"/><rect x="282" y="${gy}" width="56" height="${170 - gy}" fill="#14b8a6" opacity=".35"/><rect class="s" x="280" y="38" width="60" height="134" rx="4"/>`
              + svgA(310, 4, 310, 34) + svgT(322, 20, `Fed  Q·C₀·t = ${gr(fed)} g`) + svgT(350, 98, `Held on adsorbent = ${gr(on)} g`, 'start', 'v') + svgT(350, 116, `${fm(100 * on / cap, 1)} % of capacity q₀·m = ${gr(cap)} g`, 'start', 'mu')
              + svgA(310, 174, 310, 206) + svgT(322, 198, `Left in effluent  ∫Q·C dt = ${gr(outm)} g`) + svgT(270, 60, 'saturated', 'end', 'mu') + svgT(270, 165, 'fresh', 'end', 'mu')
              + svgT(310, 234, `Fed − held − effluent = ${gr(fed - on - outm)} g  (${fed > 0 ? fm(100 * Math.abs(fed - on - outm) / fed, 3) : '0'} % of fed)`, 'middle', 'k'), '0 0 620 244', 260).firstChild.classList.add('flow');
          }
        });
        UI.walk(el, [
          { t: '1 · Fresh bed', d: 'Feed enters at the top. The first few centimetres of adsorbent catch almost all the solute, so the effluent is clean (C ≈ 0).', hi: ['feed', 'fresh'], f: .05 },
          { t: '2 · A saturated zone grows', d: 'The top of the bed reaches equilibrium with the feed (q = q₀) and can take no more. Feed now passes through it unchanged to the layers below.', hi: ['sat'], f: .3 },
          { t: '3 · The mass-transfer zone travels', d: 'Adsorption actually happens only in the S-shaped <b>mass-transfer zone</b>. Its width is set by how fast solute reaches the sites (k<sub>Th</sub>, particle size) and by the flow rate. A sharp zone uses the bed well.', hi: ['mtz'], f: .5 },
          { t: '4 · Breakthrough', d: 'When the front reaches the outlet, C/C₀ starts to rise. At the <b>breakthrough</b> point (here 5 %) the bed is taken off line and a fresh bed is switched in.', hi: ['out'], f: 'fb' },
          { t: '5 · Exhaustion and the balance', d: 'At exhaustion (95 %) nearly the whole bed is saturated. At every moment: solute fed = solute held on the adsorbent + solute that left in the effluent (panel under the view).', hi: ['sat', 'out'], f: 'fe' }
        ], (i, x) => { S.set('tf', typeof x.f === 'string' ? st[x.f] : x.f); S.V.v.hi && S.V.v.hi(x.hi); });
        UI.note(el, 'The colours follow the Bohart–Adams/Thomas solid profile q/q₀ = (e<sup>τ</sup> − 1)/(e<sup>τ</sup> + e<sup>ξ</sup> − 1), with τ = k<sub>Th</sub>C₀t and ξ = k<sub>Th</sub>q₀m(z/L)/Q. The adsorbent is fresh at t = 0 and saturated as t → ∞. “Held” is this profile integrated numerically over the bed (Simpson’s rule); “effluent” is the outlet curve integrated in time. They are computed independently, so a residual near 0 is a genuine check. For k<sub>Th</sub>q₀m/Q ≫ 1 the outlet curve reduces to the logistic Thomas form plotted below. MTZ length uses Michaels’ method with f = 0.5 (symmetric front).');
        UI.para(el, '<h3>Moving bed, fluidised bed and continuous adsorption</h3><ul><li><b>Fixed bed</b> (semi-continuous): two or more beds swap between adsorbing and regenerating. Simple, but only part of the bed works at any time.</li><li><b>Moving bed</b> (true counter-current, e.g. hypersorption): solid flows down, fluid up — truly continuous, stage-wise like absorption. Attrition is the problem. <b>Simulated moving bed</b> (SMB) moves the inlet/outlet ports instead of the solid (sugar, p-xylene).</li><li><b>Fluidised bed</b>: gas fluidises fine adsorbent; excellent heat removal, uniform T, easy solids transfer; but back-mixed (≈ one stage per bed), so several beds are staged.</li></ul>');
      },
      eqs: [{ n: 'Thomas model', m: '\\frac{C}{C_0} = \\frac{1}{1+\\exp\\left(\\frac{k_{Th}q_0 m}{Q} - k_{Th}C_0 t\\right)}' }, { n: 'Stoichiometric time', m: 't^* = \\frac{q_0\\,m}{Q\\,C_0}' }, { n: 'Mass-transfer-zone length (Michaels)', m: 'L_{MTZ} = L\\,\\frac{t_e-t_b}{t_e-(1-f)(t_e-t_b)},\\ f\\approx0.5' }, { n: 'Bed solute balance', m: 'Q C_0 t = \\int_0^m q\\,dm + \\int_0^t Q\\,C\\,dt' }, { n: 'Length of unused bed', m: 'LUB = L\\left(1-\\frac{t_b}{t^*}\\right)' }],
      fx: [['↑ Flow rate', 'earlier breakthrough, wider MTZ'], ['↑ Rate constant (smaller particles)', 'sharper front, better bed utilisation'], ['↑ Bed mass', 't_b grows, MTZ the same → higher utilisation'], ['↑ Feed concentration', 'faster saturation']],
      quiz: [{ q: 'A very sharp breakthrough curve means…', o: ['slow mass transfer', 'fast mass transfer, short MTZ', 'channelling', 'unfavourable isotherm'], a: 1 }],
      refs: ["<i>Thomas, H.C.</i> (1944) Heterogeneous ion exchange in a flowing system. <i>J. Am. Chem. Soc.</i> 66, 1664–1666.", "<i>Bohart, G.S. & Adams, E.Q.</i> (1920) Some aspects of the behavior of charcoal with respect to chlorine. <i>J. Am. Chem. Soc.</i> 42, 523–544.", "<i>Michaels, A.S.</i> (1952) Simplified method of interpreting kinetic data in fixed-bed ion exchange. <i>Ind. Eng. Chem.</i> 44, 1922–1930.", "<i>Collins, J.J.</i> (1967) The LUB/equilibrium section concept for fixed-bed adsorption. <i>Chem. Eng. Prog. Symp. Ser.</i> 63(74), 31–35.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 15.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 11 (adsorption)."]
    },

    {
      id: 'psa', title: 'Pressure swing adsorption & continuous counter-current adsorption', tags: 'psa pressure swing skarstrom cycle working capacity tsa regeneration types of operation continuous moving bed counter current stages',
      blurb: 'Skarstrom 2-bed PSA cycle and counter-current stage design.',
      lead: 'Regeneration is half of every adsorption process. <b>PSA</b> adsorbs at high pressure and desorbs at low pressure (fast cycles, minutes). <b>TSA</b> heats the bed instead (slow, hours, larger working capacity for strongly adsorbed species).',
      render(el, UI) {
        const cv = UI.h('canvas', { style: 'width:100%;height:260px;display:block' });
        let T0 = performance.now(), st = null;
        const S = UI.sim(el, {
          title: 'Skarstrom cycle (O₂ from air on zeolite)', controls: [{ k: 'Ph', label: 'Adsorption pressure', min: 1.5, max: 10, step: .1, v: 4, unit: 'bar' }, { k: 'Pl', label: 'Purge / blowdown pressure', min: .2, max: 1.5, step: .05, v: 1, unit: 'bar' }, { k: 'tc', label: 'Cycle time (animation)', min: 4, max: 30, step: 1, v: 12, unit: 's' }, { k: 'K', label: 'N₂ Langmuir K', min: .05, max: 2, step: .01, v: .3, unit: '1/bar' }, { k: 'qm', label: 'N₂ capacity q_m', min: .5, max: 4, step: .1, v: 2, unit: 'mol/kg' }],
          views: [{ k: 'a', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 260 }],
          update(s, V) {
            st = s; if (!cv.parentNode) V.a.append(cv);
            const q = p => C.langmuir(.79 * p, s.qm, s.K), wc = q(s.Ph) - q(s.Pl);
            V.ro.set([['N₂ loading at P_high', UI.fmt(q(s.Ph), 3) + ' mol/kg'], ['N₂ loading at P_low', UI.fmt(q(s.Pl), 3) + ' mol/kg'], ['<b>Working capacity</b>', UI.fmt(wc, 3) + ' mol/kg', 'ok'], ['Pressure ratio', UI.fmt(s.Ph / s.Pl, 3)], ['Bed needed per mol/s N₂ (cycle)', UI.fmt(s.tc / 2 / wc, 2) + ' kg·s/mol']]);
            const p = V.p.frame({ x: [0, 10], y: [0, s.qm], xl: 'Total pressure (bar)', yl: 'N₂ loading (mol/kg)', xs: 'P', ys: 'q' }); p.fn(q, 0, 10, { l: 'N₂ isotherm (y = 0.79)' }); p.line([[s.Pl, q(s.Pl)], [s.Ph, q(s.Pl)], [s.Ph, q(s.Ph)]], { c: 'c2', dash: [4, 3], l: 'working capacity Δq' }); p.pts([[s.Pl, q(s.Pl)], [s.Ph, q(s.Ph)]], { c: 'tx' }); p.done();
          }
        });
        const steps = ['Pressurisation', 'Adsorption (product O₂)', 'Blowdown', 'Purge with product'];
        const g = cv.getContext('2d'); let raf;
        const draw = () => {
          raf = requestAnimationFrame(draw); if (!st) return; const W = cv.clientWidth, H = cv.clientHeight, d = devicePixelRatio; if (cv.width !== W * d) { cv.width = W * d; cv.height = H * d; } g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
          const ph = ((performance.now() - T0) / 1000 / st.tc) % 1, col = (x, phase, label) => {
            const st4 = phase < .1 ? 0 : phase < .5 ? 1 : phase < .6 ? 2 : 3, f = st4 === 0 ? 0 : st4 === 1 ? (phase - .1) / .4 : st4 === 2 ? 1 : 1 - (phase - .6) / .4;
            const bw = Math.min(90, W * .16), bh = H - 70, y0 = 30, front = .15 + .75 * f;
            g.strokeStyle = UI.css('bd2'); g.lineWidth = 2; g.strokeRect(x - bw / 2, y0, bw, bh);
            g.fillStyle = UI.css('c1'); g.globalAlpha = .55; g.fillRect(x - bw / 2 + 2, y0 + bh * (1 - front), bw - 4, bh * front - 2); g.globalAlpha = .25; g.fillStyle = UI.css('c2'); g.fillRect(x - bw / 2 + 2, y0 + 2, bw - 4, bh * (1 - front)); g.globalAlpha = 1;
            g.fillStyle = UI.css('tx'); g.font = '600 12px ' + UI.css('sans'); g.textAlign = 'center'; g.fillText(label, x, 20); g.font = '12px ' + UI.css('sans'); g.fillText(steps[st4], x, H - 22);
            const P = st4 === 0 ? st.Pl + (st.Ph - st.Pl) * (phase / .1) : st4 === 1 ? st.Ph : st4 === 2 ? st.Ph - (st.Ph - st.Pl) * ((phase - .5) / .1) : st.Pl; g.fillStyle = UI.css('mu'); g.fillText(UI.fmt(P, 2) + ' bar', x, H - 6);
            const arrow = st4 === 1 ? '↑ air in (bottom), O₂ out (top)' : st4 === 3 ? '↓ O₂ purge in, N₂ out (bottom)' : st4 === 2 ? '↓ vent N₂' : '↑ feed'; g.fillText(arrow, x, y0 + bh / 2);
          };
          col(W * .3, ph, 'Bed 1'); col(W * .7, (ph + .5) % 1, 'Bed 2');
          g.fillStyle = UI.css('mu'); g.textAlign = 'left'; g.font = '11px ' + UI.css('sans'); g.fillText('orange = N₂-saturated zone   blue = clean adsorbent', 8, H - 40);
        };
        raf = requestAnimationFrame(draw); App.onLeave(() => cancelAnimationFrame(raf));

        UI.sec(el, 'Continuous counter-current adsorption (moving bed)', 'Exactly like an absorber: an operating line, an equilibrium curve and stages.');
        UI.sim(el, {
          title: 'Counter-current contactor', controls: [{ k: 'cin', label: 'Fluid inlet c_in', min: 10, max: 1000, step: 5, v: 400, unit: 'mg/L' }, { k: 'rem', label: 'Removal', min: 50, max: 99.5, step: .5, v: 95, unit: '%' }, { k: 'qm', label: 'Langmuir q_m', min: 20, max: 400, step: 5, v: 150, unit: 'mg/g' }, { k: 'K', label: 'Langmuir K', min: .002, max: .2, v: .02, log: 1, unit: 'L/mg' }, { k: 'f', label: 'Solid rate / minimum', min: 1.05, max: 3, step: .01, v: 1.4 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 330 }],
          update(s, V) {
            const iso = c => C.langmuir(c, s.qm, s.K), cinv = q => q / (s.K * (s.qm - q)), cout = s.cin * (1 - s.rem / 100);
            const rmin = iso(s.cin) / (s.cin - cout), r = rmin / s.f; // S/F min = (cin - cout)/q*(cin)  → slope F/S = q*(cin)/(cin-cout)
            const qout = r * (s.cin - cout), op = c => r * (c - cout), st = []; let c = cout, n = 0;
            while (n < 50) { const q = iso(c); n++; st.push([c, q]); const cn = cout + q / r; if (cn >= s.cin) { st.frac = n - 1 + (s.cin - c) / (cn - c); break; } c = cn; }
            V.ro.set([['Min solid/fluid S/F', UI.fmt(1 / rmin, 5) + ' g/L'], ['Actual S/F', UI.fmt(1 / r, 5) + ' g/L', 'ok'], ['Loading of exit solid', UI.fmt(qout, 4) + ' mg/g'], ['<b>Ideal stages</b>', UI.fmt(st.frac ?? n, 2), 'ok']]);
            const p = V.p.frame({ x: [0, s.cin * 1.05], y: [0, iso(s.cin) * 1.1], xl: 'c fluid (mg/L)', yl: 'q solid (mg/g)', xs: 'c', ys: 'q' });
            p.fn(iso, 0, s.cin * 1.05, { l: 'Isotherm' }); p.line([[cout, 0], [s.cin, qout]], { c: 'c2', l: 'Operating line' }); p.line([[cout, 0], [s.cin, iso(s.cin)]], { c: 'mu', dash: [4, 4], w: 1, l: 'Minimum solid' });
            const zz = []; st.forEach(([c0, q]) => zz.push([c0, op(c0)], [c0, q], [cout + q / r, q])); p.line(zz, { c: 'c3', w: 1.4, l: 'Stages' }); p.done();
          }
        });
        UI.sec(el, 'Types of operation — summary');
        el.append(UI.table(['Mode', 'Contact', 'Regeneration', 'Example'], [['Batch (stirred / contact filtration)', 'single stage', 'discard or reactivate', 'decolourising oils, water polishing'], ['Fixed bed, TSA', 'semi-continuous', 'hot gas/steam, hours', 'solvent recovery on carbon, gas drying'], ['Fixed bed, PSA/VSA', 'semi-continuous', 'pressure drop, minutes', 'H₂ purification, O₂/N₂ generators'], ['Moving / simulated moving bed', 'continuous counter-current', 'separate desorber section', 'p-xylene (Parex), fructose/glucose'], ['Fluidised bed', 'continuous, staged', 'separate regenerator', 'solvent recovery from large air flows']]));
      },
      eqs: [{ n: 'PSA working capacity', m: '\\Delta q = q^*(P_H, y_F) - q^*(P_L, y_P)' }, { n: 'Counter-current operating line', m: 'F(c_{in}-c_{out}) = S(q_{out}-q_{in})' }, { n: 'Minimum solid rate (favourable isotherm)', m: '\\left(\\frac{S}{F}\\right)_{min} = \\frac{c_{in}-c_{out}}{q^*(c_{in})}' }],
      fx: [['↑ Pressure ratio P_H/P_L', '↑ working capacity, ↑ compression cost'], ['Very steep isotherm (large K)', 'great capacity but hard to desorb by pressure → use TSA'], ['↑ Solid rate (moving bed)', 'fewer stages, lower loading of exit solid']],
      quiz: [{ q: 'Why is a Langmuir isotherm with very high K bad for PSA?', o: ['Capacity is low', 'Loading hardly drops at low pressure, so working capacity is small', 'It causes flooding', 'It is unfavourable'], a: 1 }],
      refs: ["<i>Skarstrom, C.W.</i> (1960) Method and apparatus for fractionating gaseous mixtures by adsorption. US Patent 2,944,627.", "<i>Ruthven, D.M., Farooq, S. & Knaebel, K.S.</i> (1994) <i>Pressure Swing Adsorption</i>, VCH.", "<i>Yang, R.T.</i> (1987) <i>Gas Separation by Adsorption Processes</i>, Butterworths.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 15.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 11 (adsorption)."]
    }
  ];
})();
