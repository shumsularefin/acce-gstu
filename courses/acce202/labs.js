/* ACCE 202 · Mass Transfer Lab — virtual experiments.
   Each lab follows the renderLab() format in app/core.js: theory → apparatus & procedure → bench → calculations → viva → report.
   Bench readings come from the same verified models as ACCE 201 (app/chem.js); "instrument error" adds seeded Gaussian scatter. */
(function () {
  const C = Chem, ATM = 101325, Rg = 8.314462618, f = (v, d = 4) => UI.fmt(v, d);
  const nm = k => C.comp[k].name;
  const SYS = keys => Object.fromEntries(keys.map(k => [k, nm(C.systems[k].a) + ' – ' + nm(C.systems[k].b)]));
  const mv = k => C.comp[k].M / C.comp[k].rho * 1000;                                   // pure molar volume, cm³/mol
  const vmix = (sys, x) => x * mv(C.systems[sys].a) + (1 - x) * mv(C.systems[sys].b);   // ideal mixing, cm³/mol
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const res = (el, items) => { const d = h('div', { class: 'ro', style: 'margin:10px 0' }); for (const [l, v] of items) d.append(h('div', null, h('span', { html: UI.tex(l) }), h('b', null, v))); el.append(d); };
  const tbl = (el, head, rows) => el.append(UI.table(head, rows, head.map((_, i) => i)));
  const sample = (el, html) => UI.note(el, '<b>Sample calculation (reading 1)</b><br>' + html);
  const ideal = (sys, x, P) => { const S = C.systems[sys], T = C.bisect(T => x * C.psat(S.a, T) + (1 - x) * C.psat(S.b, T) - P, -50, 300, 1e-6); return { T, y: x * C.psat(S.a, T) / P }; };

  /* ---------- tiny SVG kit for apparatus drawings ---------- */
  const T = (x, y, s, a = 'start', c = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${c}">${s}</text>`;
  const DEFS = '<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="a"/></marker></defs>';
  const arw = (x1, y1, x2, y2, cls = 's') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ar)"/>`;
  const flask = (cx, cy, r, lv, cls = 'lq', neck = 34) => {
    const yl = cy + r - 2 * r * lv, w = Math.sqrt(Math.max(0, r * r - (yl - cy) ** 2)), yt = cy - Math.sqrt(r * r - 81);
    return `<path class="${cls}" d="M${cx - w},${yl} A${r},${r} 0 ${yl < cy ? 1 : 0} 0 ${cx + w},${yl} Z"/><path class="s" d="M${cx - 9},${yt} A${r},${r} 0 1 0 ${cx + 9},${yt} M${cx - 9},${yt} V${yt - neck} M${cx + 9},${yt} V${yt - neck}"/>`;
  };
  const mantle = (cx, cy, r) => `<path class="ht" style="fill-opacity:.28" d="M${cx - r - 8},${cy + 6} A${r + 8},${r + 8} 0 0 0 ${cx + r + 8},${cy + 6} Z"/>`;
  const therm = (x, y1, y2) => `<line class="s" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><circle class="ht" cx="${x}" cy="${y2}" r="3.5"/>`;
  const cond = (x1, y1, x2, y2) => {
    const L = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / L * 9, ny = (x2 - x1) / L * 9, P = a => [x1 + (x2 - x1) * a, y1 + (y2 - y1) * a], [a1, b1] = P(.1), [a2, b2] = P(.9);
    return `<line class="s" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><path class="cw" d="M${a1 + nx},${b1 + ny}L${a2 + nx},${b2 + ny}L${a2 - nx},${b2 - ny}L${a1 - nx},${b1 - ny}Z"/>`
      + arw(a2 + nx, b2 + ny + 22, a2 + nx, b2 + ny + 2, 'cw') + arw(a1 - nx, b1 - ny, a1 - nx, b1 - ny - 20, 'cw');
  };
  const burette = (x, y, hgt, lv) => `<rect class="lq" x="${x - 6}" y="${y + hgt * (1 - lv)}" width="12" height="${hgt * lv}"/><rect class="s" x="${x - 6}" y="${y}" width="12" height="${hgt}"/><path class="s" d="M${x - 6},${y + hgt} L${x - 2},${y + hgt + 10} V${y + hgt + 24} M${x + 6},${y + hgt} L${x + 2},${y + hgt + 10} V${y + hgt + 24} M${x - 12},${y + hgt + 14} H${x + 12}"/>`
    + Array.from({ length: 9 }, (_, i) => `<line class="t" x1="${x - 6}" x2="${x}" y1="${y + 10 + i * (hgt - 20) / 8}" y2="${y + 10 + i * (hgt - 20) / 8}"/>`).join('');
  const conical = (cx, by, w, hgt, lv, cls = 'lq') => { const nw = 9, top = by - hgt, yl = by - hgt * .7 * lv, k = (by - yl) / (hgt * .78), wl = w - (w - nw) * k; return `<path class="${cls}" d="M${cx - w},${by} L${cx - wl},${yl} H${cx + wl} L${cx + w},${by} Z"/><path class="s" d="M${cx - nw},${top} V${by - hgt * .78} L${cx - w},${by} H${cx + w} L${cx + nw},${by - hgt * .78} V${top}"/>`; };

  /* ======================= 1 · Simple (differential) distillation ======================= */
  const rayC = {};
  function rayTab(sys, P, x0) {
    const key = sys + '|' + P.toFixed(0) + '|' + x0.toFixed(4); if (rayC[key]) return rayC[key];
    if (Object.keys(rayC).length > 300) for (const k in rayC) delete rayC[k];
    const v = C.vle(sys, P), n = 1200, xm = 2e-4, xs = [], I = [], g = x => 1 / (v.y(x) - x); let acc = 0;
    for (let i = 0; i <= n; i++) { const x = x0 - (x0 - xm) * Math.pow(i / n, 1.6); if (i) acc += (xs[i - 1] - x) * (g(xs[i - 1]) + g(x)) / 2; xs.push(x); I.push(acc); }
    const xa = xs.slice().reverse(), Ia = I.slice().reverse();
    return (rayC[key] = { g, xAt: L => C.interp(L, I, xs), IAt: x => x >= x0 ? 0 : C.interp(x, xa, Ia) });
  }
  function rayRun(sys, P, V0, x0, VD) {
    const t = rayTab(sys, P, x0), F = V0 / vmix(sys, x0);
    const st = W => { const xW = t.xAt(Math.log(F / W)), D = F - W, xD = (F * x0 - W * xW) / D; return { W, xW, D, xD, VD: D * vmix(sys, xD) }; };
    const W = C.bisect(W => st(W).VD - VD, F * .02, F * (1 - 1e-7), 1e-10);
    return isNaN(W) ? null : { F, ...st(W) };
  }
  /* 3-D bench for lab 1: round-bottom still on a heating mantle, still head with thermometer at the side-arm,
     counter-current Liebig condenser, graduated receiver. State st is read live by the tick:
     warm-up to the feed bubble point, then distillate collected at a steady rate; still composition from the Rayleigh solution. */
  const LT = [1, .78, .1], HV = [.55, .25, .85], GLS = 0xcfd8e3, MET = 0x9aa3ad, mixc = k => new THREE.Color(...[0, 1, 2].map(j => HV[j] + (LT[j] - HV[j]) * clamp(k, 0, 1)));
  const setTag = (t, x) => { if (!t) return; t.off = !x; if (t.el.textContent !== x) { t.el.textContent = x; t.el.title = x; t.w0 = 0; } };   // empty text hides the tag and its leader
  function still3d(v, st) {
    const { cstream, pathAt, hsh } = T201.fx3, Rf = .8, cy = 1.25, ri = Rf - .05, OFF = [0, -50, 0];
    v.box(9.5, .16, 3, 0x9b7653, [1.6, -.08, 0]);
    const man = v.cyl(.62, .75, 0x3b3b3b, [0, .38, 0], { r2: 1.02 });
    v.sph(Rf, GLS, [0, cy, 0], { op: .16, ds: 1 }); v.cyl(.17, .75, GLS, [0, cy + Rf + .3, 0], { op: .2, ds: 1, open: 1 });
    const lm = v.mat(0xffffff, { op: .78 }), cap = v.add(new THREE.SphereGeometry(ri, 28, 14, 0, 6.2832, 2, 1), lm, [0, cy, 0]), disc = v.add(new THREE.CircleGeometry(1, 28), lm, [0, cy, 0], [-Math.PI / 2, 0, 0]);
    let hL = -1, yS = cy;
    const level = vol => { const fr = clamp(vol / 1000, .005, .95), hh = C.bisect(x => x * x * (3 * ri - x) / (4 * ri ** 3) - fr, 1e-4, 2 * ri - 1e-4); if (Math.abs(hh - hL) > .003) { hL = hh; const a = Math.acos((ri - hh) / ri), rs = Math.sqrt(Math.max(1e-6, ri * ri - (ri - hh) ** 2)); cap.geometry.dispose(); cap.geometry = new THREE.SphereGeometry(ri, 28, 14, 0, 6.2832, Math.PI - a, a); disc.scale.set(rs, rs, 1); disc.position.y = yS = cy - ri + hh; } };
    v.pipe([[0, cy + Rf + .6, 0], [0, 3.45, 0]], .15, GLS, { op: .2 }); v.pipe([[0, 3.1, 0], [.85, 2.98, 0]], .09, GLS, { op: .22 });
    v.cyl(.035, 1.2, 0xeeeeee, [0, 3.65, 0], { op: .55 }); v.sph(.06, 0xc0392b, [0, 3.07, 0]); const hg = v.cyl(.016, 1, 0xc0392b, [0, 3.3, 0]);
    const A = [.85, 2.98, 0], Bp = [3.55, 1.75, 0], at = k => [0, 1, 2].map(j => A[j] + (Bp[j] - A[j]) * k), wi = at(.86), wo = at(.16);
    v.pipe([A, Bp], .07, GLS, { op: .3 }); v.pipe([at(.12), at(.9)], .2, 0x7fb2e5, { op: .22 });
    v.pipe([[wi[0], wi[1] - .15, 0], [wi[0] + .1, .6, .5], [wi[0] + .3, .1, .9]], .05, 0x2f7fd8); v.pipe([[wo[0], wo[1] + .15, 0], [wo[0] - .1, 3.5, .4], [wo[0] - .5, 3.7, .9]], .05, 0x2f7fd8);
    v.pipe([Bp, [3.9, 1.6, 0], [3.9, 1.45, 0]], .06, GLS, { op: .3 }); v.cyl(.32, 1.6, GLS, [3.9, .82, 0], { op: .16, ds: 1, open: 1 }); v.cyl(.45, .05, GLS, [3.9, .03, 0], { op: .4 });
    for (let k = 1; k < 10; k++) v.box(.12, .008, .01, 0x666666, [3.9 - .26, .05 + 1.5 * k / 10, .3]);
    const rl = v.cyl(.29, 1, 0xffffff, [3.9, .55, 0], { op: .8 });
    const pick = (i, f) => hsh(i, 3) < f ? LT : HV;
    cstream(v, 70, .07, (u, i) => st.on && st.warm >= 1 ? [(hsh(i, 5) - .5) * .9, cy - ri + .06 + u * (yS - cy + ri - .06), (hsh(i, 7) - .5) * .9] : OFF, () => [1, 1, 1], .7);
    cstream(v, 150, .085, (u, i) => { if (!(st.on && st.warm >= 1)) return OFF; const yr = .05 + 1.5 * clamp(st.p / 1000, 0, 1); const q = pathAt([[0, yS, 0], [0, 3.1, 0], A, Bp, [3.9, 1.6, 0], [3.9, yr, 0]], u); return [q[0], q[1], q[2] + (hsh(i, 9) - .5) * .06]; }, (u, i) => pick(i, st.y), .22);
    const tg = { therm: v.tag('', [0, 4.25, 0], 'therm'), still: v.tag('', [-Rf, cy, 0], 'still'), mantle: v.tag('Heating mantle (variac)', [-.9, .35, 0], 'mantle'), cond: v.tag('Liebig condenser', at(.5), 'cond'),
      win: v.tag('Cooling water in (low end)', [wi[0] + .3, .1, .9], 'win'), wout: v.tag('Cooling water out', [wo[0] - .5, 3.7, .9], 'wout'), recv: v.tag('', [4.22, .9, 0], 'recv') };
    let acc = 0, lastP = -1, lastW = 0;
    v.tick((t, dt) => {
      const ww = v.el.clientWidth; if (ww && ww !== lastW) { lastW = ww; const k = clamp(640 / ww, 1, 2.3); v.look([1.8, 2.6 + .4 * (k - 1), 8.6 * k], [1.8, 1.7, 0]); }
      if (st.on) { if (st.warm < 1) st.warm = Math.min(1, st.warm + dt / 3); else { st.p = Math.min(st.VD, st.p + dt * st.VD / 18); if (st.p >= st.VD) { st.on = false; st.done = true; st.dirty = 1; } } }
      if (Math.abs(st.p - lastP) > .4 || st.dirty) { st.dirty = 0; lastP = st.p; st.r = st.p > .3 ? rayRun(st.sys, st.P, st.V0, st.x0, st.p) : null; }
      const xW = st.r ? st.r.xW : st.x0, Tst = st.vle.T(xW); st.y = st.vle.y(xW); st.T = st.warm < 1 ? 25 + (st.Tb - 25) * st.warm : Tst;
      level(st.V0 - st.p); lm.color.copy(mixc(xW)); const fr = clamp(st.p / 1000, 0, 1); rl.visible = st.p > .5; rl.scale.y = Math.max(1e-3, 1.5 * fr); rl.position.y = .05 + .75 * fr; rl.material.color.copy(mixc(st.r ? st.r.xD : st.y));
      man.material.emissive.setRGB(st.on ? .5 : 0, st.on ? .1 : 0, 0); const hgL = .02 + .9 * clamp((st.T - 20) / 100, 0, 1); hg.scale.y = hgL; hg.position.y = 3.1 + hgL / 2;
      acc += dt; if (acc > .2) { acc = 0; setTag(tg.therm, `Thermometer ${UI.fmt(st.T, 1)} °C`); setTag(tg.still, `Still: ${UI.fmt(st.V0 - st.p, 0)} mL, x_W = ${UI.fmt(xW, 3)}`); setTag(tg.recv, `Receiver: ${UI.fmt(st.p, 0)} mL, x_D = ${st.r ? UI.fmt(st.r.xD, 3) : '—'}`); st.live && st.live(); }
    });
  }
  const L1 = {
    refs: ["<i>Rayleigh, Lord</i> (1902) On the distillation of binary mixtures. <i>Phil. Mag.</i> (6) 4, 521–537.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 9.", "<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill, Ch. 21.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 13 (batch distillation).", "<i>Gmehling, J. & Onken, U.</i> (1977–) <i>Vapor–Liquid Equilibrium Data Collection</i>, DECHEMA Chemistry Data Series.", "<i>Smith, J.M., Van Ness, H.C. & Abbott, M.M.</i> (2005) <i>Introduction to Chemical Engineering Thermodynamics</i>, 7th ed., McGraw-Hill, Ch. 10–12."],
    id: 'simple-distillation', title: 'Simple (differential) distillation — Rayleigh equation', tags: 'batch distillation rayleigh differential simple',
    blurb: 'Batch-distil a binary charge and verify the Rayleigh equation by graphical integration.',
    aim: 'To carry out simple batch (differential) distillation of a binary mixture and to verify the <b>Rayleigh equation</b> by comparing the experimental $\\ln(F/W)$ with the graphical integral $\\int_{x_W}^{x_F} dx/(y^*-x)$.',
    objectives: ['Measure the distillate and residue amounts and compositions after distilling different fractions of the charge.', 'Evaluate $\\int dx/(y^*-x)$ graphically from equilibrium data.', 'Check the overall and component material balances.', 'Discuss why one equilibrium stage gives only limited separation.'],
    theory: `<p>In <b>simple (differential) distillation</b> a liquid charge is boiled in a still and the vapour is removed and condensed as fast as it forms, with no reflux. At every instant the vapour leaving is in equilibrium with the liquid remaining in the still ($y = y^*(x)$), so the still contents become steadily poorer in the more volatile component and the still temperature rises.</p>
<p>An unsteady balance on the light component over an instant in which $dW$ moles are vaporised gives $d(Wx) = y\\,dW$, i.e. $W\\,dx + x\\,dW = y\\,dW$. Separating the variables and integrating from the initial charge $F$ (composition $x_F$) to the final residue $W$ ($x_W$) gives the <b>Rayleigh equation</b>. The right-hand side has no analytical form for real VLE, so it is evaluated <b>graphically</b>: plot $1/(y^*-x)$ against $x$ and measure the area between $x_W$ and $x_F$. For constant relative volatility an analytical form exists (below).</p>
<p>The composite (average) distillate follows from the overall balance $D = F - W$ and the component balance $Fx_F = Dx_D + Wx_W$. Amounts are found here from measured volumes using ideal mixing of the pure-component molar volumes, $\\bar v = x v_1 + (1-x) v_2$.</p>`,
    eqs: [
      { n: 'Rayleigh equation', m: '\\ln\\frac{F}{W}=\\int_{x_W}^{x_F}\\frac{dx}{y^*-x}' },
      { n: 'Constant α form', m: '\\ln\\frac{F}{W}=\\frac{1}{\\alpha-1}\\left[\\ln\\frac{x_F}{x_W}+\\alpha\\ln\\frac{1-x_W}{1-x_F}\\right]' },
      { n: 'Balances', m: 'F=D+W,\\qquad Fx_F=Dx_D+Wx_W' },
      { n: 'Moles from volume', m: 'n=\\frac{V}{x v_1+(1-x)v_2},\\quad v_i=\\frac{M_i}{\\rho_i}' }
    ],
    apparatus(el, UI) {
      UI.svg(el, DEFS + mantle(140, 235, 58) + flask(140, 235, 58, .5) + therm(140, 70, 150) + `<path class="s" d="M131,${235 - 56 - 34} V140 Q131,130 140,130 H149 L205,152"/>`
        + cond(205, 152, 430, 250) + `<path class="s" d="M430,250 L452,270"/>` + flask(470, 300, 30, .3, 'lq2', 14)
        + T(140, 318, 'Heating mantle (variac)', 'middle', 'mu') + T(205, 245, 'Still: charge V₀, x_F', 'start') + T(150, 74, 'Thermometer at side-arm', 'start')
        + T(320, 165, 'Liebig condenser', 'middle') + T(462, 214, 'water out', 'middle', 'mu') + T(232, 128, 'water in', 'middle', 'mu') + T(510, 300, 'Receiver: distillate D, x_D', 'start'), '0 0 680 340');
    },
    apparatusList: ['Round-bottom flask (500–1000 mL) with heating mantle and variac', 'Still head with thermometer (0–110 °C, 0.1 °C)', 'Liebig condenser with cooling water, adapter and graduated receiver', 'Measuring cylinders, specific-gravity bottle or refractometer with a calibration chart', 'Boiling chips, ice bath for samples'],
    procedure: ['Prepare a calibration chart (refractive index or density vs mole fraction) for the binary from standards of known composition.', 'Charge a measured volume $V_0$ of feed of known composition $x_F$ into the flask; add boiling chips.', 'Start cooling water, then switch on the mantle. Note the temperature at which the first drop of distillate falls (≈ bubble point of the feed).', 'Collect a measured volume of distillate $V_D$ at a slow, steady rate (≈ 2–3 mL/min) so the vapour leaving stays close to equilibrium with the still liquid.', 'Stop heating, cool the residue, measure its volume $V_W$ and the final still temperature.', 'Measure the compositions $x_D$ (well-mixed distillate) and $x_W$ (residue) from the calibration chart.', 'Repeat with fresh charges for different distillate volumes (e.g. 10 %, 20 %, …, 60 % of $V_0$).'],
    precautions: ['Never heat the flask dry; leave at least 30 % of the charge.', 'Keep the distillation rate low — fast boiling causes entrainment and super-heating, so $y \\ne y^*$.', 'Cool samples to the calibration temperature before measuring RI or density.', 'Alcohols and acetone are flammable: no naked flames, keep the condenser running.'],
    bench: {
      controls: [
        { k: 'sys', t: 'select', label: 'Binary mixture (light – heavy)', v: 'methanol-water', opts: SYS(['methanol-water', 'ethanol-water', 'acetone-water', 'benzene-toluene']) },
        { k: 'P', label: 'Atmospheric pressure', min: .8, max: 1.1, step: .005, v: 1, unit: 'atm' },
        { k: 'V0', label: 'Charge volume V₀', min: 100, max: 1000, step: 10, v: 500, unit: 'mL' },
        { k: 'x0', label: 'Feed mole fraction x_F (light)', min: .05, max: .8, step: .01, v: .3 },
        { k: 'VD', label: 'Distillate volume to collect V_D', min: 10, max: 800, step: 5, v: 150, unit: 'mL' }
      ],
      cols: [{ k: 'V0', l: 'V<sub>0</sub> (mL)', d: 0 }, { k: 'x0', l: 'x<sub>F</sub>', d: 3 }, { k: 'VD', l: 'V<sub>D</sub> (mL)', d: 1 }, { k: 'VW', l: 'V<sub>W</sub> (mL)', d: 1 }, { k: 'T', l: 'Final still T (°C)', d: 2 }, { k: 'xD', l: 'x<sub>D</sub> (avg)', d: 4 }, { k: 'xW', l: 'x<sub>W</sub>', d: 4 }],
      run(s, nz) {
        const VD = Math.min(s.VD, s.V0 * .85), r = rayRun(s.sys, s.P * ATM, s.V0, s.x0, VD);
        if (VD < s.VD) UI.toast('Limited to 85 % of the charge — never distil to dryness');
        if (!r) return null;
        return { sys: s.sys, P: s.P, V0: s.V0, x0: s.x0, VD: VD + nz.n(1), VW: r.W * vmix(s.sys, r.xW) + nz.n(1), T: C.bubble(s.sys, r.xW, s.P * ATM).T + nz.n(.3), xD: clamp(r.xD + nz.n(.004), 1e-4, .9999), xW: clamp(r.xW + nz.n(.004), 1e-4, .9999) };
      },
      preset: s => [.1, .2, .3, .4, .5, .6].map(q => ({ VD: Math.round(s.V0 * q) })),
      views: [{ k: 'v', t: '3d', h: 470, cam: [1.8, 2.6, 8.6], target: [1.8, 1.7, 0] }, { k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 300 }],
      walk: [
        { t: '1 · Charge the still, start the cooling water', d: 'A measured volume V₀ of feed (x_F) goes into the round-bottom flask with boiling chips. Cooling water enters the <b>low end</b> of the condenser and leaves at the top, so the jacket stays full and flows counter-current to the vapour.', hi: ['still', 'win', 'wout'], do: S => Object.assign(S._st || (S._st = {}), { on: false, p: 0, warm: 0, done: false, dirty: 1 }) },
        { t: '2 · Heat: the first drop falls at the bubble point', d: 'The mantle warms the charge. Nothing distils until the liquid reaches its <b>bubble point</b>; the thermometer bulb sits level with the side-arm, so it reads the temperature of the vapour leaving.', hi: ['therm', 'mantle'], do: S => { (S._st || (S._st = {})).on = true; } },
        { t: '3 · Collect slowly: vapour in equilibrium with the still', d: 'At 2–3 mL/min the vapour leaving is in equilibrium with the liquid left in the flask, y = y*(x_W). It is richer in the light component (gold) than the liquid, so the still becomes poorer (more purple) and its temperature rises.', hi: ['cond', 'recv', 'therm'], do: S => { (S._st || (S._st = {})).on = true; } },
        { t: '4 · Stop at V_D, measure everything', d: 'Stop heating when V_D is collected. Measure the distillate and residue volumes and their compositions (refractometer or density bottle), and note the final still temperature.', hi: ['still', 'recv'], do: S => { const st = S._st || (S._st = {}); Object.assign(st, { p: st.VD, warm: 1, on: false, done: true, dirty: 1 }); } },
        { t: '5 · Check the balance and the Rayleigh equation', d: 'The panel under the view checks volume, moles and light component: charge = residue + distillate. The shaded area under 1/(y* − x) equals ln(F/W). Press <b>● Record reading</b> to log this run.', hi: [] }
      ],
      view(s, V, rows, S) {
        const P = s.P * ATM, VD = Math.min(s.VD, s.V0 * .85), r = rayRun(s.sys, P, s.V0, s.x0, VD), t = rayTab(s.sys, P, s.x0), T0 = C.bubble(s.sys, s.x0, P).T;
        const st = S._st || (S._st = {}), key = [s.sys, s.P, s.V0, s.x0].join('|');
        if (st.key !== key) Object.assign(st, { key, on: false, p: 0, warm: 0, done: false, r: null, dirty: 1, sys: s.sys, P, V0: s.V0, x0: s.x0, vle: C.vle(s.sys, P), Tb: T0, y: 0, T: 25 });
        st.VD = VD; if (st.p > VD) { st.p = VD; st.dirty = 1; }
        if (V.v.ok && !S._b) { S._b = 1; still3d(V.v, st); }
        if (!S._lv) {
          S._lv = 1; const go = h('button', { class: 'btn pri sm', onclick: () => { if (st.done) Object.assign(st, { p: 0, warm: 0, done: false, dirty: 1 }); st.on = !st.on; } }), info = h('div', { class: 'hint', style: 'margin:6px 0' }), tb = h('div');
          V.live.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' }, go, h('button', { class: 'btn sm', onclick: () => Object.assign(st, { p: st.VD, warm: 1, on: false, done: true, dirty: 1 }) }, '⏭ Finish run'), h('button', { class: 'btn sm', onclick: () => Object.assign(st, { p: 0, warm: 0, on: false, done: false, dirty: 1 }) }, '↺ Fresh charge')), info, tb);
          st.live = () => {
            go.textContent = st.on ? '❚❚ Pause heating' : st.done ? '▶ Heat a fresh charge' : '▶ Heat';
            const F = st.V0 / vmix(st.sys, st.x0), q = st.r, W = q ? q.W : F, xW = q ? q.xW : st.x0, Dm = q ? q.D : 0, xD = q ? q.xD : 0, VW = W * vmix(st.sys, xW), r3 = x => UI.fmt(x, 3), z = x => Math.abs(x) < 1e-6 ? '0' : UI.fmt(x, 3);
            info.innerHTML = st.warm < 1 && st.on ? `Warming the charge… ${UI.fmt(st.T, 1)} °C (first drop at ${UI.fmt(st.Tb, 1)} °C)` : `Distilled <b>${UI.fmt(st.p, 1)}</b> of ${UI.fmt(st.VD, 0)} mL · at 2.5 mL/min this is ${UI.fmt(st.p / 2.5, 0)} min of bench time · still ${UI.fmt(st.T, 1)} °C · vapour now y* = ${UI.fmt(st.y, 3)}${st.done ? ' · <b>run complete: press ● Record reading</b>' : ''}`;
            tb.innerHTML = ''; tb.append(UI.table(['Live balance', 'Charge (in)', 'Residue + distillate (out)', 'In − Out'], [
              ['Volume (mL, ideal mixing)', r3(st.V0), `${r3(VW)} + ${r3(q ? q.VD : 0)}`, z(st.V0 - VW - (q ? q.VD : 0))],
              ['Moles (mol)', r3(F), `${r3(W)} + ${r3(Dm)}`, z(F - W - Dm)],
              ['Light component (mol)', r3(F * st.x0), `${r3(W * xW)} + ${r3(Dm * xD)}`, z(F * st.x0 - W * xW - Dm * xD)],
              ['Rayleigh: ln(F/W) vs ∫dx/(y*−x)', r3(Math.log(F / W)), r3(rayTab(st.sys, st.P, st.x0).IAt(xW)), z(Math.log(F / W) - rayTab(st.sys, st.P, st.x0).IAt(xW))]], [3]));
          };
        }
        st.live && st.live();
        if (!r) return;
        V.ro.set([['Charge F', f(r.F, 3) + ' mol'], ['Feed bubble point (first drop)', f(T0, 2) + ' °C'], ['Theory: residue $x_W$', f(r.xW, 4)], ['Theory: distillate $x_D$', f(r.xD, 4)], ['Theory: final still T', f(C.bubble(s.sys, r.xW, P).T, 2) + ' °C'], ['$\\ln(F/W)$', f(Math.log(r.F / r.W), 4)]]);
        const lo = Math.max(2e-4, r.xW - .03), hi = Math.min(.999, s.x0 + .05), gm = t.g(lo) * 1.1, p = V.p.frame({ x: [lo, hi], y: [0, gm], xl: 'Liquid mole fraction x', yl: '1 / (y* − x)', xs: 'x', ys: '1/(y*−x)' });
        const area = [[r.xW, 0]]; for (let i = 0; i <= 60; i++) { const x = r.xW + (s.x0 - r.xW) * i / 60; area.push([x, t.g(x)]); } area.push([s.x0, 0]);
        p.line(area, { c: 'c2', fill: 1, fa: .18 }).fn(t.g, lo, hi, { c: 'c1', w: 2, l: '1/(y*−x) from VLE' }).vl(r.xW, { c: 'c2' }).vl(s.x0, { c: 'c2' }).text(r.xW, gm * .95, ' x_W', { c: 'c2' }).text(s.x0, gm * .95, ' x_F', { c: 'c2' }).done();
      }
    },
    calc(rows, s, el, UI) {
      const R = rows.map(r => { const P = r.P * ATM, F = r.V0 / vmix(r.sys, r.x0), W = r.VW / vmix(r.sys, r.xW), D = r.VD / vmix(r.sys, r.xD), lhs = Math.log(F / W), rhs = rayTab(r.sys, P, r.x0).IAt(r.xW); return { ...r, F, W, D, lhs, rhs, dev: 100 * (lhs - rhs) / rhs, bal: 100 * (D * r.xD + W * r.xW - F * r.x0) / (F * r.x0), rec: 100 * D * r.xD / (F * r.x0) }; });
      const a = R[0], S0 = C.systems[a.sys];
      UI.sec(el, 'Calculations');
      sample(el, `Molar volumes: $v_1$ = ${f(mv(S0.a), 2)}, $v_2$ = ${f(mv(S0.b), 2)} cm³/mol.<br>
        $F = ${f(a.V0, 1)}/(${f(a.x0, 3)}\\times${f(mv(S0.a), 2)}+${f(1 - a.x0, 3)}\\times${f(mv(S0.b), 2)}) = ${f(a.F, 4)}$ mol; $W = ${f(a.VW, 1)}/\\bar v(x_W) = ${f(a.W, 4)}$ mol; $D = ${f(a.D, 4)}$ mol.<br>
        Experimental: $\\ln(F/W) = \\ln(${f(a.F, 4)}/${f(a.W, 4)}) = ${f(a.lhs, 4)}$.&nbsp; Graphical: $\\int_{${f(a.xW, 4)}}^{${f(a.x0, 3)}} dx/(y^*-x) = ${f(a.rhs, 4)}$ (trapezoidal rule on VLE data).<br>
        Deviation = ${f(a.dev, 2)} %. Light-component balance closure = ${f(a.bal, 2)} %.`);
      tbl(el, ['#', 'F (mol)', 'W (mol)', 'D (mol)', 'ln(F/W) expt.', '∫dx/(y*−x)', 'Deviation %', 'Balance closure %', 'Light recovered in D %'], R.map((r, i) => [i + 1, f(r.F, 4), f(r.W, 4), f(r.D, 4), f(r.lhs, 4), f(r.rhs, 4), f(r.dev, 2), f(r.bal, 2), f(r.rec, 1)]));
      UI.sec(el, 'Graphs');
      const t = rayTab(a.sys, a.P * ATM, a.x0), xmin = Math.max(2e-4, Math.min(...R.map(r => r.xW)) - .02), gm = t.g(xmin) * 1.1;
      const p1 = UI.plotIn(el).frame({ x: [xmin, Math.min(.999, a.x0 + .05)], y: [0, gm], xl: 'x (liquid mole fraction)', yl: '1/(y* − x)', xs: 'x', ys: '1/(y*−x)' });
      const ar = [[Math.min(...R.map(r => r.xW)), 0]]; for (let i = 0; i <= 80; i++) { const x = ar[0][0] + (a.x0 - ar[0][0]) * i / 80; ar.push([x, t.g(x)]); } ar.push([a.x0, 0]);
      p1.line(ar, { c: 'c2', fill: 1, fa: .14 }).fn(t.g, xmin, Math.min(.999, a.x0 + .05), { c: 'c1', l: 'Graphical integration curve' }); R.forEach(r => p1.vl(r.xW, { c: 'c2' })); p1.vl(a.x0, { c: 'tx' }).done();
      const mx = Math.max(...R.map(r => Math.max(r.lhs, r.rhs))) * 1.15;
      UI.plotIn(el, 300).frame({ x: [0, mx], y: [0, mx], xl: 'ln(F/W) — graphical integral', yl: 'ln(F/W) — experimental', xs: 'RHS', ys: 'LHS' }).line([[0, 0], [mx, mx]], { c: 'mu', dash: [5, 4], w: 1, l: 'perfect agreement' }).pts(R.map(r => [r.rhs, r.lhs]), { c: 'c1', r: 4.5, l: 'readings' }).done();
      const th = []; for (let q = .02; q <= .85; q += .015) { const z = rayRun(a.sys, a.P * ATM, a.V0, a.x0, q * a.V0); if (z) th.push([q, z.xD, z.xW]); }
      UI.plotIn(el, 300).frame({ x: [0, .9], y: [0, 1], xl: 'Fraction of charge distilled V_D / V₀', yl: 'Mole fraction (light)', xs: 'V_D/V₀', ys: 'x' }).line(th.map(q => [q[0], q[1]]), { c: 'c1', l: 'x_D theory' }).line(th.map(q => [q[0], q[2]]), { c: 'c2', l: 'x_W theory' })
        .pts(R.filter(r => r.sys === a.sys && r.x0 === a.x0).map(r => [r.VD / r.V0, r.xD]), { c: 'c1', l: 'x_D measured' }).pts(R.filter(r => r.sys === a.sys && r.x0 === a.x0).map(r => [r.VD / r.V0, r.xW]), { c: 'c2', l: 'x_W measured' }).done();
      UI.sec(el, 'Result');
      const md = R.reduce((q, r) => q + Math.abs(r.dev), 0) / R.length;
      res(el, [['Mean |deviation| between LHS and RHS', f(md, 2) + ' %'], ['Mean balance closure', f(R.reduce((q, r) => q + r.bal, 0) / R.length, 2) + ' %'], ['Rayleigh equation', md < 5 ? 'verified (≤ 5 %)' : 'deviations > 5 % — see discussion']]);
    },
    discussion: ['Deviation of $\\ln(F/W)$ from the integral arises from (i) composition-measurement error — the integrand is steep at low $x$ so small errors in $x_W$ matter most; (ii) vapour not in equilibrium at high boil-up rates; (iii) partial condensation (reflux) on the still head walls, which makes the still behave like more than one stage.', 'One equilibrium stage cannot give high purity: $x_D$ falls as more is distilled because the still liquid is being depleted.', 'Compare your result with the constant-α form using α at the mean composition.'],
    viva: [
      { q: 'What is the difference between flash (equilibrium) and differential distillation?', a: 'In flash distillation the vapour stays in contact with the liquid and the two leave in equilibrium at the end; in differential distillation each increment of vapour is removed as soon as it forms, so the distillate is a mixture of vapours of steadily falling composition. For the same fraction vaporised, differential distillation gives a slightly better separation.' },
      { q: 'Write and derive the Rayleigh equation.', a: 'Light-component balance: $d(Wx) = y\\,dW$ ⇒ $W dx = (y - x)dW$ ⇒ $\\int_W^F dW/W = \\int_{x_W}^{x_F} dx/(y^*-x)$, so $\\ln(F/W) = \\int_{x_W}^{x_F} dx/(y^*-x)$.' },
      { q: 'Why is the integral evaluated graphically?', a: 'Because $y^*(x)$ for real mixtures (e.g. methanol–water) comes from experimental VLE data or an activity-coefficient model and has no simple closed form.' },
      { q: 'Why does the still temperature rise during the run?', a: 'The liquid left in the still becomes richer in the less-volatile component, so its bubble point rises.' },
      { q: 'Why should the distillation rate be kept low?', a: 'So that the vapour leaving is in equilibrium with the bulk liquid (no superheating, no entrainment of droplets, no refluxing on the walls).' },
      { q: 'What are the limitations of simple distillation?', a: 'Only one theoretical stage; it is useful only when α is large or a rough cut is enough (e.g. solvent recovery). Higher purity needs reflux (rectification).' },
      { q: 'What is steam distillation and when is it used?', a: 'Distillation in the presence of live steam with an immiscible organic; each liquid exerts its own vapour pressure, so the mixture boils below 100 °C at 1 atm — used for heat-sensitive, high-boiling materials (essential oils).' }
    ]
  };

  // round-bottom flask on a heating mantle (bottom of mantle at y = 0 when cy = 1.56 Rf); level(mL) sets the liquid
  function rbFlask(v, cx, cy, Rf, cap) {
    const ri = Rf - .05, o = { yS: cy }, man = v.cyl(.775 * Rf, .94 * Rf, 0x3b3b3b, [cx, cy - 1.09 * Rf, 0], { r2: 1.275 * Rf });
    v.sph(Rf, GLS, [cx, cy, 0], { op: .16, ds: 1 }); v.cyl(.21 * Rf, .9 * Rf, GLS, [cx, cy + 1.35 * Rf, 0], { op: .2, ds: 1, open: 1 });
    const lm = v.mat(0xffffff, { op: .78 }), cp = v.add(new THREE.SphereGeometry(ri, 28, 14, 0, 6.2832, 2, 1), lm, [cx, cy, 0]), disc = v.add(new THREE.CircleGeometry(1, 28), lm, [cx, cy, 0], [-Math.PI / 2, 0, 0]);
    let hL = -1; Object.assign(o, { man, lm, level: vol => { const fr = clamp(vol / cap, .005, .95), hh = C.bisect(x => x * x * (3 * ri - x) / (4 * ri ** 3) - fr, 1e-4, 2 * ri - 1e-4); if (Math.abs(hh - hL) > .003) { hL = hh; const a = Math.acos((ri - hh) / ri), rs = Math.sqrt(Math.max(1e-6, ri * ri - (ri - hh) ** 2)); cp.geometry.dispose(); cp.geometry = new THREE.SphereGeometry(ri, 28, 14, 0, 6.2832, Math.PI - a, a); disc.scale.set(rs, rs, 1); disc.position.y = o.yS = cy - ri + hh; } } });
    return o;
  }

  /* 3-D bench for lab 2: still + packed glass column (bed height ∝ Z, packing type shown) + total condenser, sampling cocks,
     U-tube manometer across the bed. At total reflux the vapour and liquid passing any height have the same composition (y = x);
     colour along the bed follows the stage-to-stage solution x_{n+1} = y*(x_n) from the still to the top. Flooding holds liquid on top of the bed. */
  const PKV = { r6: [0xd8e4ea, 'ring', .045], r13: [0xc4895a, 'ring', .07], b13: [0xeee3cc, 'saddle', .06], p16: [0xa9b1b8, 'ring', .075] };
  function packed3d(v, st) {
    const { cstream } = T201.fx3, hsh = (i, k) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); }, Rf = .65, cy = 1.02, fl = rbFlask(v, 0, cy, Rf, 600), y0 = cy + 1.8 * Rf, rc = .3, Hb = 1.6 * st.Z, yb = y0 + .3, yt = yb + Hb, ytop = yt + .45, yc = ytop + .55, OFF = [0, -50, 0];
    v.box(6, .16, 2.6, 0x9b7653, [.6, -.08, 0]);
    v.cyl(rc + .03, ytop - y0, GLS, [0, (ytop + y0) / 2, 0], { op: .15, ds: 1, open: 1 }); v.cyl(rc, .03, MET, [0, yb, 0]); v.cyl(rc, .03, MET, [0, yt + .14, 0], { op: .5 });
    const [pc, kind, sz] = PKV[st.pk], nP = Math.min(1100, Math.round(Hb * 170 * (.05 / sz) ** 1.5)), geo = kind === 'saddle' ? new THREE.TorusGeometry(sz * .8, sz * .28, 6, 10, Math.PI) : new THREE.CylinderGeometry(sz * .5, sz * .5, sz, 10, 1, true);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: pc, roughness: .6, metalness: st.pk === "p16" ? .6 : .1, side: THREE.DoubleSide, transparent: true, opacity: .6, depthWrite: false }), nP), M4 = new THREE.Matrix4(), E = new THREE.Euler(), Qn = new THREE.Quaternion(), V3 = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < nP; i++) { const r = (rc - sz * .6) * Math.sqrt(hsh(i, 13)), a = 6.2832 * hsh(i, 29); E.set(6.28 * hsh(i, 41), 6.28 * hsh(i, 43), 6.28 * hsh(i, 47)); M4.compose(V3.set(r * Math.cos(a), yb + .04 + (Hb - .08) * (i + .5) / nP, r * Math.sin(a)), Qn.setFromEuler(E), S1); im.setMatrixAt(i, M4); }
    v.root.add(im);
    // condenser, water hoses, top thermometer + sample cock, still thermometer + sample cock
    v.cyl(.2, .95, 0x7fb2e5, [0, yc, 0], { op: .3 }); v.cyl(.07, 1.15, GLS, [0, yc, 0], { op: .3 }); v.pipe([[.2, yc - .35, 0], [.7, yc - .5, .3], [.9, .1, .9]], .04, 0x2f7fd8); v.pipe([[.2, yc + .35, 0], [.6, yc + .6, .3], [.9, yc + .9, .8]], .04, 0x2f7fd8);
    v.pipe([[-rc, yt + .3, 0], [-.75, yt + .7, 0]], .05, GLS, { op: .3 }); v.sph(.045, 0xc0392b, [-.15, yt + .25, 0]); v.pipe([[-.15, yt + .25, 0], [-.75, yt + .72, 0], [-1, yt + .95, 0]], .015, 0xeeeeee);
    v.pipe([[rc, yt + .3, 0], [.62, yt + .26, 0]], .03, GLS, { op: .4 }); v.sph(.05, 0xc0392b, [.65, yt + .26, 0]);
    v.pipe([[-.25, cy + .45, 0], [-.6, cy + 1.05, 0]], .05, GLS, { op: .3 }); v.sph(.045, 0xc0392b, [-.2, cy - .1, 0]); v.pipe([[-.2, cy - .1, 0], [-.6, cy + 1.08, 0], [-.75, cy + 1.4, 0]], .015, 0xeeeeee);
    v.pipe([[-Rf + .05, cy - .25, 0], [-Rf - .3, cy - .3, 0]], .03, GLS, { op: .4 }); v.sph(.05, 0xc0392b, [-Rf - .33, cy - .3, 0]);
    // U-tube manometer across the bed: left limb to the bottom (higher pressure), right limb to the top
    const xl = 1.35, xr = 1.65, ym = 1.35;
    v.cyl(.05, 2.2, GLS, [xl, 1.3, 0], { op: .25, ds: 1, open: 1 }); v.cyl(.05, 2.2, GLS, [xr, 1.3, 0], { op: .25, ds: 1, open: 1 }); v.pipe([[xl, .2, 0], [xl, .12, 0], [xr, .12, 0], [xr, .2, 0]], .05, GLS, { op: .25 });
    v.pipe([[rc, yb - .15, 0], [.9, yb - .15, 0], [xl, 2.6, 0], [xl, 2.4, 0]], .02, MET, { op: .6 }); v.pipe([[rc, yt + .2, 0], [1.2, yt + .2, 0], [xr, 2.6, 0], [xr, 2.4, 0]], .02, MET, { op: .6 });
    const wl = v.cyl(.04, 1, 0x2f7fd8, [xl, .7, 0], { op: .8 }), wr = v.cyl(.04, 1, 0x2f7fd8, [xr, .7, 0], { op: .8 }); v.box(.04, 2.2, .01, 0xffffff, [(xl + xr) / 2, 1.3, -.06], { op: .5 });
    v.box(.7, .4, .5, 0x4a5560, [-1.5, .2, .6]);
    const pool = v.cyl(rc - .01, 1, 0x2f7fd8, [0, yt, 0], { op: .55 });
    const cAt = y => { const k = clamp((y - yb) / Hb, 0, 1) * 64; return st.cx[Math.round(k)]; }, pick = (i, f) => hsh(i, 3) < f ? LT : HV, run = () => st.on || st.front > 0;
    cstream(v, 70, .07, (u, i) => st.on ? [(hsh(i, 5) - .5) * .8, cy - Rf + .1 + u * (fl.yS - cy + Rf - .1), (hsh(i, 7) - .5) * .8] : OFF, () => [1, 1, 1], .7);
    const vap = cstream(v, 280, .11, (u, i) => { const y = fl.yS + u * (yc - .3 - fl.yS); if (!run() || y > fl.yS + st.front * (yc - .3 - fl.yS)) return OFF; const r = (rc - .06) * Math.sqrt(hsh(i, 17)), a = 6.28 * hsh(i, 19) + .4 * Math.sin(u * 12 + i); return [r * Math.cos(a), y, r * Math.sin(a)]; }, (u, i) => pick(i, cAt(fl.yS + u * (yc - .3 - fl.yS))), .25);
    const liq = cstream(v, 240, .11, (u, i) => { if (!run() || st.front < 1) return OFF; let y = yc - .3 - u * (yc - .3 - fl.yS); if (st.phi > 1 && y < yt - .05) y = yt - .05 - .3 * hsh(i, 23) * Math.abs(Math.sin(u * 9 + i)); const r = .06 + .17 * hsh(i, 37), a = 6.28 * hsh(i, 31) + 2.5 * Math.sin(u * 20 + i); return [r * Math.cos(a), y, r * Math.sin(a)]; }, (u, i) => pick(i, cAt(yc - .3 - u * (yc - .3 - fl.yS))), .12);
    const tg = { heat: v.tag('', [-1.5, .4, .6], 'heat'), still: v.tag('', [-Rf - .33, cy - .3, 0], 'still'), bed: v.tag('', [-rc, yb + Hb / 2, 0], 'bed'), top: v.tag('', [-1, yt + .95, 0], 'top'), cond: v.tag('Total condenser: all condensate returns', [.2, yc + .3, 0], 'cond'), mano: v.tag('', [xr + .05, 1.9, 0], 'mano'), samp: v.tag('Top sample cock → x_D', [.65, yt + .26, 0], 'samp') };
    let acc = 0, lastW = 0;
    v.tick((t, dt) => {
      const ww = v.el.clientWidth; if (ww && ww !== lastW) { lastW = ww; const k = clamp(640 / ww, 1, 2.3); v.look([2.2, yc * .62 + .4 * (k - 1), 10 * k * (.75 + .2 * st.Z)], [.4, yc * .55, 0]); }
      if (st.on && st.front < 1) st.front = Math.min(1, st.front + dt / 4);
      fl.level(450); fl.lm.color.copy(mixc(st.xB)); fl.man.material.emissive.setRGB(st.on ? .5 : 0, st.on ? .1 : 0, 0);
      const sp = clamp(st.phi, .05, 1.2); vap.speed = .12 + .3 * sp; liq.speed = st.phi > .8 ? .06 + .06 * (1.2 - sp) : .06 + .1 * sp;
      const h = st.on && st.front >= 1 ? clamp(st.dP / 200, 0, 1.9) : 0; wl.scale.y = .9 - h / 2; wl.position.y = .15 + wl.scale.y / 2; wr.scale.y = .9 + h / 2; wr.position.y = .15 + wr.scale.y / 2;
      const ph = st.on && st.phi > 1 ? clamp(.12 + .5 * (st.phi - 1), .12, .45) * (1 + .15 * Math.sin(t * 7)) : 0; pool.visible = ph > 0; pool.scale.y = Math.max(.01, ph); pool.position.y = yt + .14 + ph / 2;
      acc += dt; if (acc > .2) { acc = 0; const on = st.on && st.front >= 1;
        setTag(tg.heat, `Heater ${UI.fmt(st.Q, 0)} W · ${UI.fmt(100 * st.phi, 0)} % of flood${st.phi > 1 ? ' · FLOODING' : st.phi > .8 ? ' · loading' : ''}`); setTag(tg.still, `Still ${UI.fmt(st.Tb, 1)} °C · x_B = ${UI.fmt(st.xB, 3)}`);
        setTag(tg.bed, `Packed bed Z = ${UI.fmt(st.Z, 2)} m · HETP ${UI.fmt(100 * st.HETP, 1)} cm`); setTag(tg.top, on ? `Top ${UI.fmt(st.Tt, 1)} °C · x_D = ${UI.fmt(st.xD, 4)}` : 'Top thermometer (cold: no vapour yet)');
        setTag(tg.mano, `Manometer ΔP = ${on ? UI.fmt(st.dP, 1) : '0'} mm H₂O`); st.live && st.live(); }
    });
  }

  /* ======================= 2 · Packed column at total reflux ======================= */
  const PACK = { r6: { n: 'Glass Raschig rings 6 mm', Fp: 1600, H0: .10 }, r13: { n: 'Ceramic Raschig rings 13 mm', Fp: 580, H0: .24 }, b13: { n: 'Ceramic Berl saddles 13 mm', Fp: 240, H0: .20 }, p16: { n: 'Metal Pall rings 16 mm', Fp: 70, H0: .30 } };
  function column(s) {
    const P = s.P * ATM, Sy = C.systems[s.sys], v = C.vle(s.sys, P), pk = PACK[s.pk], A = Math.PI * Math.pow(s.D / 1000, 2) / 4;
    // vapour/liquid properties at the column top (approximate with still composition for hydraulics)
    const x = s.xB, M = x * C.comp[Sy.a].M + (1 - x) * C.comp[Sy.b].M, lam = x * C.comp[Sy.a].lam + (1 - x) * C.comp[Sy.b].lam, Tb = C.bubble(s.sys, x, P).T;
    const rG = P * M / 1000 / (Rg * (Tb + 273.15)), rL = 1 / (x * C.comp[Sy.a].M / C.comp[Sy.a].rho + (1 - x) * C.comp[Sy.b].M / C.comp[Sy.b].rho) * M, mu = .3, psi = 998 / rL;
    const Yf = C.eckertFloodY(Math.sqrt(rG / rL)), Gf = Math.sqrt(Yf * rG * rL * 9.81 / (pk.Fp * 3.281 * psi * Math.pow(mu, .2)));
    const Vm = s.Q * .92 / lam, G = Vm * M / 1000 / A, phi = G / Gf, Qf = Gf * A / (M / 1000) * lam / .92;  // 8 % heat loss
    let HETP = pk.H0 * (.85 + .06 / Math.max(phi, .05) + .4 * phi * phi + (phi > .8 ? 12 * (phi - .8) ** 2 : 0)); if (phi > 1) HETP *= 1 + 4 * (phi - 1);
    const dPf = (pk.Fp > 60 ? 2.0 : .115 * Math.pow(pk.Fp, .7)) * 249.09 / .3048, dPZ = dPf * phi * phi * (1 + 2 * Math.pow(Math.min(phi, 1.2), 4)) / 3; // Pa/m
    const N = s.Z / HETP + 1;   // packing stages + still
    let xc = x, k = 0; for (; k < Math.floor(N); k++) xc = v.y(xc); const xD = xc + (N - Math.floor(N)) * (v.y(xc) - xc);
    return { P, v, A, rG, rL, Gf, G, phi, Qf, HETP, dPZ, N, xD: Math.min(xD, .99995), Tt: C.bubble(s.sys, Math.min(xD, .99995), P).T, Tb, Vm };
  }
  const L2 = {
    refs: ["<i>Fenske, M.R.</i> (1932) Fractionation of straight-run Pennsylvania gasoline. <i>Ind. Eng. Chem.</i> 24, 482–485.", "<i>Eckert, J.S.</i> (1970) Selecting the proper distillation column packing. <i>Chem. Eng. Prog.</i> 66(3), 39–44.", "<i>Strigle, R.F.</i> (1994) <i>Packed Tower Design and Applications</i>, 2nd ed., Gulf Publishing.", "<i>Kister, H.Z.</i> (1992) <i>Distillation Design</i>, McGraw-Hill.", "<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 14.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 9."],
    id: 'packed-total-reflux', title: 'Packed distillation column at total reflux — HETP', tags: 'packed column total reflux fenske hetp flooding pressure drop',
    blurb: 'Operate a packed column at total reflux, get N_min by Fenske and McCabe–Thiele, and HETP vs boil-up.',
    aim: 'To operate a packed distillation column at <b>total reflux</b>, determine the number of theoretical stages by the <b>Fenske equation</b> and by McCabe–Thiele, and find the <b>HETP</b> of the packing and its variation with boil-up rate (including loading and flooding).',
    objectives: ['Reach steady state at total reflux and sample top and bottom compositions.', 'Calculate $N_{min}$ (Fenske) with a geometric-mean relative volatility.', 'Calculate HETP = Z / (stages in the packing).', 'Observe pressure drop and HETP as the heater power approaches flooding.'],
    theory: `<p>At <b>total reflux</b> all condensed vapour is returned to the column and no product is withdrawn, so $L = V$ in every section and the operating line coincides with the diagonal $y_{n+1} = x_n$. This needs the <b>minimum number of theoretical stages</b> for the separation achieved, $N_{min}$, which (for constant α) is given by the <b>Fenske equation</b>. The still (reboiler) acts as one equilibrium stage, so the stages provided by the packing are $N_{min} - 1$.</p>
<p>In a packed column contact is continuous. Its performance is expressed as the <b>height equivalent to a theoretical plate</b>, HETP = $Z/N_{packing}$. HETP depends on packing size (≈ 15–20 × nominal size for random rings in small columns), liquid distribution, physical properties and vapour load. At low boil-up the packing is poorly wetted (HETP high); in the mid range HETP is nearly constant; above the <b>loading point</b> liquid hold-up rises sharply and near <b>flooding</b> liquid is carried upward, the pressure drop rises steeply and HETP increases dramatically.</p>
<p>Flooding is predicted from the generalised pressure-drop correlation (Eckert): $X = (L/G)\\sqrt{\\rho_G/\\rho_L}$ (= $\\sqrt{\\rho_G/\\rho_L}$ at total reflux) fixes $Y_{flood}$, giving the flooding mass flux $G_f$. Boil-up is $V = \\eta Q/\\lambda$.</p>`,
    eqs: [
      { n: 'Fenske (total reflux)', m: 'N_{min}=\\frac{\\ln\\left[\\dfrac{x_D}{1-x_D}\\dfrac{1-x_B}{x_B}\\right]}{\\ln\\alpha_{avg}},\\quad \\alpha_{avg}=\\sqrt{\\alpha_D\\,\\alpha_B}' },
      { n: 'HETP', m: '\\mathrm{HETP}=\\frac{Z}{N_{min}-1}' },
      { n: 'Relative volatility', m: '\\alpha=\\frac{y^*/x}{(1-y^*)/(1-x)}' },
      { n: 'Boil-up & mass flux', m: 'V=\\frac{\\eta Q}{\\lambda},\\qquad G=\\frac{V M}{A}' },
      { n: 'Flooding (GPDC)', m: 'G_f=\\sqrt{\\frac{Y_f\\,\\rho_G\\rho_L g}{F_p\\,\\psi\\,\\mu_L^{0.2}}}' }
    ],
    apparatus(el, UI) {
      let pk = ''; for (let y = 78; y < 286; y += 9) for (let x = 190 + ((y / 9) % 2) * 4; x < 212; x += 8) pk += `<circle class="pk" cx="${x}" cy="${y}" r="3.2"/>`;
      UI.svg(el, DEFS + mantle(200, 345, 46) + flask(200, 345, 46, .55) + `<rect class="s" x="185" y="62" width="30" height="236"/>` + pk
        + `<rect class="cw" x="190" y="12" width="20" height="46" rx="4"/>` + arw(240, 22, 211, 22, 'cw') + arw(211, 48, 240, 48, 'cw') + therm(200, 20, 66) + therm(178, 300, 322)
        + `<path class="s" d="M215,70 H262 V100"/><circle class="a" cx="262" cy="104" r="3"/>` + `<path class="s" d="M152,320 H120 V336"/><circle class="a" cx="120" cy="340" r="3"/>`
        + `<path class="s" d="M215,90 H330 V250 M215,280 H360 V250"/><path class="s" d="M330,250 Q345,275 360,250"/><rect class="lq" x="326" y="215" width="8" height="40"/><rect class="lq" x="356" y="236" width="8" height="19"/>`
        + `<rect class="s" x="40" y="380" width="90" height="26" rx="4"/>` + T(85, 397, 'Variac + wattmeter', 'middle')
        + T(225, 160, 'Packed bed, height Z', 'start') + T(246, 18, 'cooling water', 'start', 'mu') + T(270, 104, 'top sample → x_D', 'start') + T(60, 352, 'still sample → x_B', 'start')
        + T(372, 236, 'U-tube manometer ΔP', 'start') + T(130, 18, 'T_top', 'end') + T(160, 325, 'T_still', 'end') + T(200, 405, 'Reboiler / still (1 stage)', 'middle', 'mu')
        + T(450, 120, 'Total reflux:', 'start') + T(450, 138, 'all condensate returns,', 'start', 'mu') + T(450, 156, 'L = V, operating line y = x', 'start', 'mu'), '0 0 640 420', 440);
    },
    apparatusList: ['Glass packed column (ID 25–80 mm) with packing, insulated', 'Still flask with heating mantle, variac and wattmeter', 'Total condenser with reflux return, top and bottom sampling cocks', 'Thermometers at top and still; U-tube water manometer across the bed', 'Refractometer / GC with calibration chart'],
    procedure: ['Charge the still with the binary mixture (e.g. benzene–toluene, ~20 mol % light). Start condenser water.', 'Switch on the heater at a low setting; when vapour reaches the condenser, the column is operating at total reflux (no product drawn).', 'Wait 30–45 min until top and still temperatures are steady (steady state).', 'Record heater power Q, manometer ΔP, top and still temperatures.', 'Withdraw small top and bottom samples simultaneously (discard the first few drops), cool and analyse to obtain $x_D$ and $x_B$.', 'Increase the heater power in steps and repeat 3–5 until flooding is observed (liquid slugs held up, ΔP surges). Reduce power immediately at flooding.'],
    precautions: ['Samples must be small so that the steady state is not disturbed.', 'Allow enough time to reach steady state after every power change.', 'Do not keep the column flooded; reduce power at once.', 'Insulate the column to minimise heat loss and internal reflux.'],
    bench: {
      controls: [
        { k: 'sys', t: 'select', label: 'Binary mixture', v: 'benzene-toluene', opts: SYS(['benzene-toluene', 'hexane-heptane', 'methanol-water']) },
        { k: 'P', label: 'Pressure', min: .8, max: 1.1, step: .005, v: 1, unit: 'atm' },
        { k: 'pk', t: 'select', label: 'Packing', v: 'r6', opts: Object.fromEntries(Object.entries(PACK).map(([k, v]) => [k, v.n])) },
        { k: 'Z', label: 'Packed height Z', min: .3, max: 2, step: .05, v: 1, unit: 'm' },
        { k: 'D', label: 'Column inside diameter', min: 25, max: 80, step: 1, v: 50, unit: 'mm' },
        { k: 'xB', label: 'Still composition x_B (light)', min: .03, max: .7, step: .005, v: .2 },
        { k: 'Q', label: 'Heater power Q', min: 30, max: 4000, step: 10, v: 300, unit: 'W', log: 1 }
      ],
      cols: [{ k: 'Q', l: 'Q (W)', d: 0 }, { k: 'dP', l: 'ΔP (mm H₂O)', d: 1 }, { k: 'Tt', l: 'T<sub>top</sub> (°C)', d: 2 }, { k: 'Tb', l: 'T<sub>still</sub> (°C)', d: 2 }, { k: 'xD', l: 'x<sub>D</sub>', d: 4 }, { k: 'xB', l: 'x<sub>B</sub>', d: 4 }, { k: 'obs', l: 'Observation' }],
      run(s, nz) {
        const c = column(s), fl = c.phi > 1 ? 'FLOODING — liquid held up' : c.phi > .8 ? 'loading (above ~80 % flood)' : 'steady';
        return { sys: s.sys, P: s.P, pk: s.pk, Z: s.Z, D: s.D, Q: s.Q, dP: c.dPZ * s.Z / 9.80665 * (1 + nz.n(.02)) + nz.n(.5), Tt: c.Tt + nz.n(.2), Tb: c.Tb + nz.n(.2), xD: clamp(c.xD + nz.n(.003), .001, .9995), xB: clamp(s.xB + nz.n(.003), .001, .999), obs: fl };
      },
      preset: s => { const q = column(s).Qf; return [.15, .3, .45, .6, .75, .9, 1.05].map(r => ({ Q: Math.round(r * q / 10) * 10 })); },
      views: [{ k: 'v', t: '3d', h: 520, cam: [2.2, 3.2, 10], target: [.4, 2.8, 0] }, { k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 300 }],
      walk: [
        { t: '1 · Charge the still, start the condenser water', d: 'The still holds the binary mixture (about 20 mol % light). Cooling water runs through the total condenser on top. Nothing is drawn off during the run: this is <b>total reflux</b>.', hi: ['still', 'cond'], do: S => Object.assign(S._st || (S._st = {}), { on: false, front: 0 }) },
        { t: '2 · Heat: vapour climbs the packing', d: 'Boil-up V = ηQ/λ rises through the packed bed. The top thermometer stays cold until the vapour front reaches it; then condensate starts returning down over the packing.', hi: ['heat', 'bed'], do: S => { (S._st || (S._st = {})).on = true; } },
        { t: '3 · Total reflux: every drop comes back', d: 'All condensate returns, so L = V everywhere and the operating line is y = x: vapour and liquid passing any height have the <b>same composition</b>. Moving up, each height equivalent to a theoretical plate (HETP) enriches the stream by one equilibrium step, so the colour shifts from purple (heavy) to gold (light).', hi: ['cond', 'bed'], do: S => { (S._st || (S._st = {})).on = true; } },
        { t: '4 · Steady state, then sample top and still', d: 'Wait 30–45 min until both thermometers are steady, then take small samples at the same time from the top cock (x_D) and the still (x_B). Fenske gives N<sub>min</sub>; the still is one stage, so HETP = Z/(N<sub>min</sub> − 1).', hi: ['top', 'samp', 'still'] },
        { t: '5 · Raise the power: loading and flooding', d: 'Above about 80 % of flood the liquid hold-up and ΔP climb steeply (loading). Past the flood point liquid piles up on top of the bed, the manometer surges and separation collapses. Cut the power at once.', hi: ['mano', 'heat', 'bed'], do: S => { const st = S._st || (S._st = {}); st.on = true; if (st.Qf) S.set('Q', Math.round(st.Qf * 1.08 / 10) * 10); } }
      ],
      view(s, V, rows, S) {
        const c = column(s), st = S._st || (S._st = {}), N = c.N, cx = [];
        for (let j = 0; j <= 64; j++) { const sg = 1 + j / 64 * (N - 1); let z = s.xB; for (let k = 0; k < Math.floor(sg); k++) z = c.v.y(z); cx.push(Math.min(.9999, z + (sg - Math.floor(sg)) * (c.v.y(z) - z))); }
        const Sy = C.systems[s.sys], lamB = s.xB * C.comp[Sy.a].lam + (1 - s.xB) * C.comp[Sy.b].lam, lamD = c.xD * C.comp[Sy.a].lam + (1 - c.xD) * C.comp[Sy.b].lam;
        Object.assign(st, { cx, xB: s.xB, xD: c.xD, phi: c.phi, dP: c.dPZ * s.Z / 9.80665, Qf: c.Qf, Q: s.Q, Tt: c.Tt, Tb: c.Tb, N, HETP: c.HETP, Z: s.Z, pk: s.pk, Vm: c.Vm, lamB, lamD });
        if (st.on === undefined) Object.assign(st, { on: false, front: 0 });
        if (V.v.ok) { const key = s.Z + '|' + s.pk; if (S._k !== key) { S._k = key; V.v.clear(); packed3d(V.v, st); } }
        if (!S._lv) {
          S._lv = 1; const go = h('button', { class: 'btn pri sm', onclick: () => { st.on = !st.on; st.live(); } }), info = h('div', { class: 'hint', style: 'margin:6px 0' }), tb = h('div');
          V.live.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' }, go, h('button', { class: 'btn sm', onclick: () => { Object.assign(st, { on: false, front: 0 }); st.live(); } }, '↺ Cool down')), info, tb);
          st.live = () => {
            const ss = st.on && st.front >= 1, Vm = st.Vm * 1000, r3 = x => UI.fmt(x, 3), Wb = st.Vm * st.lamB, loss = st.Q - Wb;
            go.textContent = st.on ? '❚❚ Switch heater off' : '▶ Switch heater on';
            info.innerHTML = !st.on ? 'Heater off. Switch on (or use the walkthrough) to start the column.' : !ss ? 'Vapour front climbing the packing…' : `Steady state at total reflux · ${UI.fmt(100 * st.phi, 1)} % of flood${st.phi > 1 ? ' · <b>FLOODING: reduce power</b>' : st.phi > .8 ? ' · loading' : ''} · condenser duty Q_C = V·λ_D = ${UI.fmt(st.Vm * st.lamD, 1)} W`;
            tb.innerHTML = ''; tb.append(UI.table(['Live balance (steady, total reflux)', 'In', 'Out', 'In − Out'], [
              ['Column, moles (mmol/s)', `vapour up V = ${r3(ss ? Vm : 0)}`, `reflux down L = ${r3(ss ? Vm : 0)}`, '0'],
              ['Light component at the top (mmol/s)', `V·y = ${r3(ss ? Vm * st.xD : 0)}`, `L·x_D + D·x_D = ${r3(ss ? Vm * st.xD : 0)} + 0`, '0'],
              ['Still energy (W)', `heater Q = ${r3(st.on ? st.Q : 0)}`, `V·λ_B + loss (8 %) = ${r3(st.on ? Wb : 0)} + ${r3(st.on ? loss : 0)}`, '0']], [3]),
              h('p', { class: 'hint' }, 'No product is withdrawn (D = 0), so every balance closes with the reflux equal to the boil-up. Heat loss is taken as 8 % of the heater power (insulated glass column).'));
          };
        }
        st.live();
        V.ro.set([['Boil-up rate V', f(c.Vm * 1000, 3) + ' mmol/s'], ['Vapour mass flux G', f(c.G, 3) + ' kg/m²s'], ['Flooding flux $G_f$ (Eckert)', f(c.Gf, 3) + ' kg/m²s'], ['% of flood', f(100 * c.phi, 1) + ' %', c.phi > 1 ? 'bad' : c.phi > .8 ? 'warn' : 'ok'], ['Power at flooding', f(c.Qf, 0) + ' W'], ['Theory: HETP', f(c.HETP * 100, 2) + ' cm'], ['Theory: theoretical stages (incl. still)', f(c.N, 2)], ['Theory: $x_D$', f(c.xD, 4)]]);
        const p = V.p.frame({ x: [0, 1], y: [0, 1], xl: 'x', yl: 'y', xs: 'x', ys: 'y' }).fn(c.v.y, 0, 1, { c: 'c1', l: 'equilibrium' }).line([[0, 0], [1, 1]], { c: 'mu', w: 1, l: 'operating line (total reflux)' });
        let x = c.xD; const sg = []; for (let i = 0; i < 60 && x > s.xB; i++) { const xn = c.v.x(x); sg.push([x, x], [xn, x], [xn, xn]); x = xn; }
        p.line(sg, { c: 'c2', w: 1.4, l: 'stages' }).vl(s.xB, { c: 'c3' }).vl(c.xD, { c: 'c3' }).done();
      }
    },
    calc(rows, s, el, UI) {
      const R = rows.map(r => { const P = r.P * ATM, v = C.vle(r.sys, P), aD = v.alpha(Math.min(r.xD, .999)), aB = v.alpha(Math.max(r.xB, .001)), a = Math.sqrt(aD * aB), Nm = C.fenske(r.xD, r.xB, a);
        let x = r.xD, n = 0; while (x > r.xB && n < 200) { const xn = v.x(x); n += xn <= r.xB ? (x - r.xB) / (x - xn) : 1; x = xn; }
        return { ...r, aD, aB, a, Nm, Ng: n, H: r.Z / (Nm - 1), Hg: r.Z / (n - 1), c: column({ ...r }) }; });
      const a = R[0];
      UI.sec(el, 'Calculations');
      sample(el, `$\\alpha_D$ = α at $x_D$ = ${f(a.aD, 4)}, $\\alpha_B$ = α at $x_B$ = ${f(a.aB, 4)} ⇒ $\\alpha_{avg} = \\sqrt{${f(a.aD, 3)}\\times${f(a.aB, 3)}} = ${f(a.a, 4)}$.<br>
        $N_{min} = \\ln\\left[\\frac{${f(a.xD, 4)}}{${f(1 - a.xD, 4)}}\\cdot\\frac{${f(1 - a.xB, 4)}}{${f(a.xB, 4)}}\\right]/\\ln ${f(a.a, 4)} = ${f(a.Nm, 3)}$ (including the still).<br>
        Packing stages $= N_{min}-1 = ${f(a.Nm - 1, 3)}$ ⇒ HETP $= ${f(a.Z, 2)}/${f(a.Nm - 1, 3)} = ${f(a.H, 4)}$ m. Graphical McCabe–Thiele at total reflux: ${f(a.Ng, 2)} stages ⇒ HETP = ${f(a.Hg, 4)} m.<br>
        Vapour flux: $V = 0.92\\,Q/\\lambda$, $G = VM/A$ = ${f(a.c.G, 3)} kg/m²s ( ${f(100 * a.c.phi, 1)} % of flood ).`);
      tbl(el, ['#', 'Q (W)', 'G (kg/m²s)', '% flood', 'ΔP/Z (Pa/m)', 'α_avg', 'N_min Fenske', 'N graphical', 'HETP Fenske (cm)', 'HETP graphical (cm)'], R.map((r, i) => [i + 1, f(r.Q, 0), f(r.c.G, 3), f(100 * r.c.phi, 1), f(r.dP * 9.80665 / r.Z, 1), f(r.a, 4), f(r.Nm, 3), f(r.Ng, 2), f(100 * r.H, 2), f(100 * r.Hg, 2)]));
      UI.sec(el, 'Graphs');
      const v = C.vle(a.sys, a.P * ATM), p = UI.plotIn(el).frame({ x: [0, 1], y: [0, 1], xl: 'x (light)', yl: 'y (light)', xs: 'x', ys: 'y' }).fn(v.y, 0, 1, { c: 'c1', l: 'equilibrium' }).line([[0, 0], [1, 1]], { c: 'mu', w: 1, l: 'y = x' });
      let x = a.xD; const st = []; for (let i = 0; i < 80 && x > a.xB; i++) { const xn = v.x(x); st.push([x, x], [xn, x], [xn, xn]); x = xn; } p.line(st, { c: 'c2', w: 1.4, l: 'reading 1: stages at total reflux' }).done();
      const G = R.map(r => r.c.G), gx = [Math.min(...G) * .7, Math.max(...G) * 1.3];
      UI.plotIn(el, 300).frame({ x: gx, y: [0, Math.max(...R.map(r => r.H * 100)) * 1.2], xl: 'Vapour mass flux G (kg/m²s)', yl: 'HETP (cm)', xs: 'G', ys: 'HETP' }).pts(R.map(r => [r.c.G, r.H * 100]), { c: 'c1', r: 4.5, l: 'HETP (Fenske)' }).line(R.slice().sort((p, q) => p.c.G - q.c.G).map(r => [r.c.G, r.H * 100]), { c: 'c1', w: 1 }).vl(a.c.Gf, { c: 'bad', l: 'flooding (Eckert)' }).done();
      UI.plotIn(el, 300).frame({ x: gx, y: [Math.max(1, Math.min(...R.map(r => r.dP * 9.80665 / r.Z)) * .5), Math.max(...R.map(r => r.dP * 9.80665 / r.Z)) * 2], logx: 1, logy: 1, xl: 'G (kg/m²s)', yl: 'ΔP/Z (Pa/m)', xs: 'G', ys: 'ΔP/Z' }).pts(R.map(r => [r.c.G, r.dP * 9.80665 / r.Z]), { c: 'c2', r: 4.5, l: 'measured ΔP/Z' }).vl(a.c.Gf, { c: 'bad', l: 'flooding' }).done();
      UI.sec(el, 'Result');
      const ok = R.filter(r => r.c.phi < .8 && r.c.phi > .25), Hm = (ok.length ? ok : R).reduce((q, r) => q + r.H, 0) / (ok.length ? ok : R).length;
      res(el, [['Packing', PACK[a.pk].n], ['Mean HETP in the stable range (25–80 % flood)', f(Hm * 100, 2) + ' cm'], ['HETP / nominal size', f(Hm * 1000 / parseFloat(PACK[a.pk].n.match(/(\d+) mm/)[1]), 1) + ' ×'], ['Flooding power (predicted)', f(a.c.Qf, 0) + ' W']]);
    },
    discussion: ['HETP is nearly constant over the mid range of vapour load and rises at low loads (poor wetting) and near flooding (entrainment, back-mixing).', 'The log-log ΔP vs G plot shows a slope ≈ 2 below loading and a sharp upturn at the loading/flooding region.', 'Fenske assumes constant α; for non-ideal systems (methanol–water) the graphical stage count is more reliable.', 'Errors: column not at steady state, sample withdrawal disturbs the column, heat loss causes internal reflux, analysis errors near $x \\to 1$ dominate $\\ln[x_D/(1-x_D)]$.'],
    viva: [
      { q: 'Why is total reflux used for testing packing efficiency?', a: 'It is easy to reach a steady state without feed and product flows, the operating line is the diagonal (no need for flow measurements), and the minimum stage count is directly related to the composition change.' },
      { q: 'Define HETP and HTU. How are they related?', a: 'HETP = height giving the same separation as one theoretical stage. HTU = height of a transfer unit = Z/NTU. For straight equilibrium and operating lines HETP = HTU·ln λ/(λ − 1) with λ = mV/L; at total reflux with λ ≈ 1, HETP ≈ HTU.' },
      { q: 'Why is the still counted as one stage?', a: 'The vapour leaving the reboiler is in equilibrium with the liquid in it, so it performs one theoretical separation stage.' },
      { q: 'What are loading and flooding points?', a: 'Loading: vapour flow starts to hinder liquid downflow, so hold-up and the slope of ΔP vs G increase. Flooding: liquid can no longer flow down, it accumulates on top of the packing, ΔP rises vertically and separation collapses.' },
      { q: 'Why use a geometric mean of α?', a: 'α varies from top to bottom; the geometric mean is consistent with the logarithmic form of the Fenske equation.' },
      { q: 'How would you reduce HETP?', a: 'Smaller or structured packing, better liquid distribution and redistribution, operating at 60–80 % of flood, using a larger column-to-packing diameter ratio (> 8–10) to limit wall flow.' }
    ]
  };

  /* Othmer still model. Boiler hold-up 150 mL (well mixed), receiver 15 mL (well mixed CSTR) fed with condensate of the
     vapour in equilibrium with the boiler, y*(x_b); overflow returns to the boiler. Receiver starts full of charge liquid.
     Charge composition z_c is chosen so that at steady state the boiler is at the set x. τ = V_R/F_c = 9 min.
     Light component:  n_R dy_R/dt = F_c (y*(x_b) − y_R),  N z_c = n_B x_b + n_R y_R. */
  function othmer(s) {
    const P = s.P * ATM, b = C.bubble(s.sys, s.x, P), nB = 150 / vmix(s.sys, s.x), nR = 15 / vmix(s.sys, b.y), N = nB + nR, zc = (nB * s.x + nR * b.y) / N, tau = 9;
    return { P, b, nB, nR, N, zc, tau, Fc: nR / tau, xb: yR => (N * zc - nR * yR) / nB, ys: x => C.bubble(s.sys, clamp(x, 1e-6, 1 - 1e-6), P).y };
  }
  const othStep = (m, yR, dt) => { const n = Math.ceil(dt / .1 - 1e-9); for (let k = 0; k < n; k++) yR += dt / n / m.tau * (m.ys(m.xb(yR)) - yR); return yR; };

  // 3-D bench for lab 3: boiler on a mantle, thermometer in the vapour–liquid space, lagged vapour line, condenser, receiver with sampling cock, overflow back to the boiler
  function othmer3d(v, st) {
    const { cstream, pathAt } = T201.fx3, hsh = (i, k) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); };
    const Rf = .65, cy = 1.02, fl = rbFlask(v, 0, cy, Rf, 300), OFF = [0, -50, 0], xr = 1.6;
    v.box(4.4, .16, 2.4, 0x9b7653, [.5, -.08, 0]);
    const VP = [[0, cy + 1.2, 0], [0, 3, 0], [.3, 3.25, 0], [1.3, 3.25, 0], [xr, 3, 0], [xr, 2.95, 0]], RP = [[xr - .13, 1.78, 0], [1.05, 1.62, 0], [.62, 1.3, 0], [.4, 1.22, 0]];
    v.pipe(VP, .07, GLS, { op: .3 }); v.pipe(VP.slice(1, 5), .12, 0xb9a27a, { op: .35 });
    v.cyl(.17, 1, 0x7fb2e5, [xr, 2.45, 0], { op: .3 }); v.cyl(.05, 1.2, GLS, [xr, 2.4, 0], { op: .3 });
    v.pipe([[xr + .17, 2.05, 0], [xr + .5, 1.6, .3], [xr + .6, .1, .7]], .04, 0x2f7fd8); v.pipe([[xr + .17, 2.85, 0], [xr + .55, 3, .3], [xr + .6, 3.3, .7]], .04, 0x2f7fd8);
    v.cyl(.13, .55, GLS, [xr, 1.55, 0], { op: .2, ds: 1 }); const rl = v.cyl(.115, .5, 0xffffff, [xr, 1.53, 0], { op: .8 });
    v.pipe([[xr, 1.27, 0], [xr, 1.05, 0]], .03, GLS, { op: .4 }); v.sph(.05, 0xc0392b, [xr, 1.02, 0]); v.cyl(.02, 1.4, MET, [xr + .3, .7, -.2]); v.box(.25, .03, .05, MET, [xr + .17, 1.3, -.2]);
    v.pipe(RP, .04, GLS, { op: .35 });
    v.pipe([[-.25, cy + .45, 0], [-.6, cy + 1.05, 0]], .05, GLS, { op: .3 }); v.sph(.045, 0xc0392b, [-.18, cy + .05, 0]); v.pipe([[-.18, cy + .05, 0], [-.6, cy + 1.08, 0], [-.75, cy + 1.45, 0]], .015, 0xeeeeee);
    v.pipe([[-Rf + .05, cy - .25, 0], [-Rf - .3, cy - .3, 0]], .03, GLS, { op: .4 }); v.sph(.05, 0xc0392b, [-Rf - .33, cy - .3, 0]);
    const pick = (i, f) => hsh(i, 3) < f ? LT : HV, flow = () => st.on && st.warm >= 1;
    cstream(v, 60, .07, (u, i) => st.on ? [(hsh(i, 5) - .5) * .8, cy - Rf + .1 + u * (fl.yS - cy + Rf - .1), (hsh(i, 7) - .5) * .8] : OFF, () => [1, 1, 1], .7);
    cstream(v, 160, .08, (u, i) => { if (!st.on || u > st.warm) return OFF; const q = pathAt(VP, u); return [q[0] + (hsh(i, 11) - .5) * .08, q[1] + (hsh(i, 13) - .5) * .08, q[2] + (hsh(i, 17) - .5) * .08]; }, (u, i) => pick(i, st.yv), .35);
    cstream(v, 50, .07, (u, i) => flow() ? [xr + (hsh(i, 19) - .5) * .05, 2.95 - u * 1.15, (hsh(i, 23) - .5) * .05] : OFF, (u, i) => pick(i, st.yv), .5);
    cstream(v, 70, .07, (u, i) => { if (!flow()) return OFF; const q = pathAt(RP, u); return [q[0], q[1] + .02, q[2] + (hsh(i, 29) - .5) * .03]; }, (u, i) => pick(i, st.yR), .3);
    const tg = { therm: v.tag('', [-.75, cy + 1.45, 0], 'therm'), boil: v.tag('', [-.3, cy - .2, 0], 'boil'), lsamp: v.tag('Liquid sample cock → x', [-Rf - .33, cy - .3, 0], 'lsamp'), line: v.tag('Lagged vapour line (no partial condensation)', [.8, 3.3, 0], 'line'),
      cond: v.tag('Condenser: all vapour condensed', [xr + .17, 2.6, 0], 'cond'), recv: v.tag('', [xr + .13, 1.55, 0], 'recv'), samp: v.tag('Condensate sample cock → y', [xr, 1.02, 0], 'samp'), ret: v.tag('Overflow returns to boiler', [1.05, 1.62, 0], 'ret') };
    let acc = 0, lastW = 0;
    v.tick((t, dt) => {
      const ww = v.el.clientWidth; if (ww && ww !== lastW) { lastW = ww; const k = clamp(640 / ww, 1, 2.3); v.look([1.2, 2.3 + .4 * (k - 1), 6.3 * k], [.6, 1.7, 0]); }
      if (st.on) { if (st.warm < 1) st.warm = Math.min(1, st.warm + dt / 2.5); else { const dm = dt * st.rate; st.yR = othStep(st.m, st.yR, dm); st.t += dm; } }
      fl.level(150); fl.lm.color.copy(mixc(st.m.xb(st.yR))); fl.man.material.emissive.setRGB(st.on ? .5 : 0, st.on ? .1 : 0, 0); rl.material.color.copy(mixc(st.yR));
      acc += dt; if (acc > .2) { acc = 0; st.calc(); setTag(tg.therm, `T = ${UI.fmt(st.T, 2)} °C · t = ${UI.fmt(st.t, 1)} min`); setTag(tg.boil, `Boiler x = ${UI.fmt(st.xb, 4)}`); setTag(tg.recv, `Receiver y_R = ${UI.fmt(st.yR, 4)} · y*(x_b) = ${UI.fmt(st.yv, 4)}`); st.live && st.live(); }
    });
  }

  /* ======================= 3 · VLE determination (Othmer still) ======================= */
  const L3 = {
    refs: ["<i>Othmer, D.F.</i> (1928) Composition of vapors from boiling binary solutions: improved equilibrium still. <i>Ind. Eng. Chem.</i> 20, 743–746.", "<i>van Laar, J.J.</i> (1910) Über Dampfspannungen von binären Gemischen. <i>Z. Phys. Chem.</i> 72, 723–751.", "<i>Redlich, O. & Kister, A.T.</i> (1948) Algebraic representation of thermodynamic properties and the classification of solutions. <i>Ind. Eng. Chem.</i> 40, 345–348. (area consistency test)", "<i>Gmehling, J. & Onken, U.</i> (1977–) <i>Vapor–Liquid Equilibrium Data Collection</i>, DECHEMA Chemistry Data Series.", "<i>Smith, J.M., Van Ness, H.C. & Abbott, M.M.</i> (2005) <i>Introduction to Chemical Engineering Thermodynamics</i>, 7th ed., McGraw-Hill, Ch. 10–12."],
    id: 'vle-still', title: 'Vapour–liquid equilibrium — Othmer recirculation still', tags: 'vle equilibrium still othmer activity coefficient van laar consistency raoult',
    blurb: 'Measure T–x–y data, compute γ and α, test Raoult’s law and thermodynamic consistency.',
    aim: 'To determine isobaric <b>vapour–liquid equilibrium</b> (T–x–y) data for a binary system using a recirculation (Othmer) still, and from it to obtain relative volatility, activity coefficients, Van Laar constants and a thermodynamic-consistency check.',
    objectives: ['Measure equilibrium temperature and liquid and condensed-vapour compositions over the composition range.', 'Plot the T–x–y and x–y diagrams and compare with Raoult’s law.', 'Calculate $\\gamma_1$, $\\gamma_2$ and α; fit Van Laar constants.', 'Apply the Redlich–Kister area test.'],
    theory: `<p>In an <b>Othmer still</b> the boiling liquid produces vapour which is totally condensed into a small receiver; the condensate overflows back into the boiler. After 30–60 min of recirculation, the condensate (composition $y$) is the vapour in equilibrium with the boiling liquid ($x$) at the measured temperature $T$ and pressure $P$.</p>
<p>At low pressure the vapour is ideal and the equilibrium relation is the <b>modified Raoult law</b> $y_iP = \\gamma_i x_i P_i^{sat}(T)$, with $P^{sat}$ from the Antoine equation. For an ideal solution $\\gamma_i = 1$ (Raoult’s law). Systems like methanol–water have $\\gamma > 1$ (<b>positive deviation</b>); strong positive deviation produces a minimum-boiling <b>azeotrope</b> (ethanol–water). The excess Gibbs energy $g^E/RT = x_1\\ln\\gamma_1 + x_2\\ln\\gamma_2$ is correlated by models such as <b>Van Laar</b>, whose linearised form allows the two constants to be read from a straight line.</p>
<p>Data quality is checked with the Gibbs–Duhem equation. Its integral form gives the <b>Redlich–Kister area test</b>: the area under $\\ln(\\gamma_1/\\gamma_2)$ vs $x_1$ must be ≈ 0 (positive and negative areas equal). The Herington criterion uses $D = 100|A^+-A^-|/(A^++|A^-|)$; $D \\lesssim 10$ is considered consistent for isobaric data.</p>`,
    eqs: [
      { n: 'Modified Raoult law', m: 'y_iP=\\gamma_i x_i P_i^{sat}(T)\\;\\Rightarrow\\;\\gamma_i=\\frac{y_iP}{x_iP_i^{sat}}' },
      { n: 'Antoine', m: '\\log_{10}P^{sat}[\\mathrm{mmHg}]=A-\\frac{B}{T[^\\circ C]+C}' },
      { n: 'Relative volatility', m: '\\alpha_{12}=\\frac{y_1/x_1}{y_2/x_2}' },
      { n: 'Van Laar (linearised)', m: '\\frac{x_1x_2}{g^E/RT}=\\frac{1}{A_{12}}+\\left(\\frac{1}{A_{21}}-\\frac{1}{A_{12}}\\right)x_1' },
      { n: 'Redlich–Kister area test', m: '\\int_0^1\\ln\\frac{\\gamma_1}{\\gamma_2}\\,dx_1\\approx 0' }
    ],
    apparatus(el, UI) {
      UI.svg(el, DEFS + mantle(160, 250, 56) + flask(160, 250, 56, .5) + therm(150, 100, 205) + `<path class="s" d="M169,${250 - 56 - 30} V120 Q169,70 220,70 H360 V90"/>` + cond(360, 90, 360, 200)
        + `<rect class="lq2" x="350" y="232" width="20" height="30"/><rect class="s" x="350" y="210" width="20" height="56" rx="3"/><path class="s" d="M360,200 V212 M360,266 V286 M352,286 H368 M370,226 H420 Q440,226 440,250 V300 Q440,316 420,316 H230 Q210,316 205,296"/>`
        + arw(300, 316, 250, 316) + T(160, 330, 'Boiler: boiling liquid, sample x', 'middle') + T(380, 270, 'Condensate receiver', 'start') + T(380, 286, 'sample y (vapour)', 'start', 'mu')
        + T(330, 340, 'condensate overflow returns to boiler', 'middle', 'mu') + T(250, 64, 'vapour', 'middle', 'mu') + T(140, 104, 'T_eq', 'end') + T(500, 120, 'Recirculate 30–60 min', 'start') + T(500, 138, 'until T is constant', 'start', 'mu'), '0 0 680 350');
    },
    apparatusList: ['Othmer (or Gillespie) recirculation still with heating mantle', 'Thermometer 0.1 °C in the vapour–liquid space', 'Condenser, condensate receiver with sampling cock, liquid sampling port', 'Barometer', 'Refractometer / GC with calibration chart'],
    procedure: ['Charge the still with a mixture of approximately known composition; start condenser water and heating.', 'Let the condensate recirculate until the temperature is constant for ≥ 10 min (equilibrium).', 'Record the equilibrium temperature and barometric pressure.', 'Withdraw small samples of liquid (boiler) and condensate (receiver) simultaneously; cool and analyse to get $x$ and $y$.', 'Add more of one component (or remove some liquid) to change the composition and repeat to cover $x$ = 0.02–0.98.', 'Include both ends of the range so the area test can be applied.'],
    precautions: ['Ensure true equilibrium: constant T and enough recirculation time.', 'Avoid partial condensation before the receiver (insulate the vapour line), otherwise y is biased.', 'Keep samples sealed and cool to prevent evaporation of the light component.'],
    bench: {
      controls: [
        { k: 'sys', t: 'select', label: 'Binary system', v: 'methanol-water', opts: SYS(Object.keys(C.systems)) },
        { k: 'P', label: 'Barometric pressure', min: .8, max: 1.1, step: .005, v: 1, unit: 'atm' },
        { k: 'x', label: 'Boiler liquid composition x (light)', min: .01, max: .99, step: .005, v: .3 },
        { k: 'tm', label: 'Recirculation time before sampling', min: 2, max: 90, step: 1, v: 45, unit: 'min' }
      ],
      cols: [{ k: 'T', l: 'T<sub>eq</sub> (°C)', d: 2 }, { k: 'x', l: 'x (liquid)', d: 4 }, { k: 'y', l: 'y (condensate)', d: 4 }, { k: 'tm', l: 'time (min)', d: 0 }],
      run(s, nz) {
        const m = othmer(s), yR = othStep(m, m.zc, s.tm), xb = m.xb(yR), T = C.bubble(s.sys, xb, m.P).T;
        if (s.tm < 25) UI.toast('Short recirculation: the receiver has not reached the equilibrium vapour composition');
        return { sys: s.sys, P: s.P, tm: s.tm, T: T + nz.n(.15), x: clamp(xb + nz.n(.003), 1e-4, .9999), y: clamp(yR + nz.n(.003), 1e-4, .9999) };
      },
      preset: () => [.02, .05, .1, .2, .3, .4, .5, .6, .7, .8, .9, .95, .98].map(x => ({ x, tm: 45 })),
      views: [{ k: 'v', t: '3d', h: 470, cam: [1.2, 2.3, 6.3], target: [.6, 1.7, 0] }, { k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 300 }],
      walk: [
        { t: '1 · Charge the still, start the condenser water', d: 'The boiler and the small receiver are filled with the same mixture. Cooling water runs through the condenser. Nothing leaves the apparatus: the condensate overflows back to the boiler.', hi: ['boil', 'recv', 'cond'], do: S => { const st = S._st || (S._st = {}); st.reset && st.reset(); } },
        { t: '2 · Heat: vapour leaves the boiling liquid', d: 'The vapour formed is richer in the light component (gold) than the liquid. It travels through a <b>lagged</b> line: if it partly condensed there, the heavy component would drop out first and the measured y would be wrong.', hi: ['therm', 'line'], do: S => { const st = S._st || (S._st = {}); st.on = true; } },
        { t: '3 · Condense, collect, overflow: recirculation', d: 'All vapour is condensed into the receiver; the overflow returns to the boiler. The receiver is a well-mixed tank, so its composition y<sub>R</sub> approaches y* exponentially with time constant τ = V<sub>R</sub>/F<sub>c</sub> ≈ 9 min. Light component moves into the receiver, so the boiler x falls slightly and T rises.', hi: ['cond', 'recv', 'ret'], do: S => { const st = S._st || (S._st = {}); st.on = true; } },
        { t: '4 · Equilibrium: T constant', d: 'After about 5τ (45 min) y<sub>R</sub> is within 1 % of y* and the thermometer is steady. Only then are the liquid in the boiler and the condensate in the receiver an equilibrium pair (x, y) at T.', hi: ['therm', 'recv'], do: S => { const st = S._st || (S._st = {}); st.on = true; st.warm = 1; if (st.m && st.t < 45) { st.yR = othStep(st.m, st.yR, 45 - st.t); st.t = 45; } } },
        { t: '5 · Sample x and y together', d: 'Draw a small liquid sample from the boiler cock (x) and a condensate sample from the receiver cock (y) at the same time; cool, seal and analyse. Then change the charge composition and repeat across x = 0.02–0.98.', hi: ['samp', 'lsamp'], set: { tm: 45 } }
      ],
      view(s, V, rows, S) {
        const P = s.P * ATM, b = C.bubble(s.sys, s.x, P), [g1, g2] = C.gamma(s.sys, s.x), v = C.vle(s.sys, P), id = ideal(s.sys, s.x, P);
        const st = S._st || (S._st = {}), key = s.sys + '|' + s.P + '|' + s.x;
        if (st.key !== key) {
          const m = othmer(s); Object.assign(st, { key, m, sys: s.sys, rate: 3 });
          st.reset = () => Object.assign(st, { on: false, warm: 0, t: 0, yR: m.zc });
          st.calc = () => { const xb = st.m.xb(st.yR), bb = C.bubble(st.sys, xb, st.m.P); Object.assign(st, { xb, yv: bb.y, Tb: bb.T, T: 25 + (bb.T - 25) * st.warm }); };
          st.reset(); st.calc(); S._k = null;
        }
        if (V.v.ok && S._k !== st.key) { S._k = st.key; V.v.clear(); othmer3d(V.v, st); }
        if (!S._lv) {
          S._lv = 1; const go = h('button', { class: 'btn pri sm', onclick: () => { st.on = !st.on; st.live(); } }), info = h('div', { class: 'hint', style: 'margin:6px 0' }), tb = h('div');
          V.live.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' }, go,
            h('button', { class: 'btn sm', onclick: () => { if (!st.on) return; st.warm = 1; st.yR = othStep(st.m, st.yR, 15); st.t += 15; st.calc(); st.live(); } }, '⏭ +15 min'),
            h('button', { class: 'btn sm', onclick: () => S.set('tm', clamp(Math.round(st.t), 2, 90)) }, '⏱ Sampling time = clock'),
            h('button', { class: 'btn sm', onclick: () => { st.reset(); st.calc(); st.live(); } }, '↺ Fresh charge')), info, tb);
          st.live = () => {
            const m = st.m, fl = st.on && st.warm >= 1, Fc = m.Fc * 1000, r3 = x => UI.fmt(x, 3), r4 = x => UI.fmt(x, 4), acc = fl ? Fc * (st.yv - st.yR) : 0, appr = (st.yR - m.zc) / (m.b.y - m.zc);
            go.textContent = st.on ? '❚❚ Switch heater off' : '▶ Heat & recirculate';
            info.innerHTML = !st.on ? 'Heater off. Switch on (or use the walkthrough) to start recirculating.' : !fl ? 'Warming up: vapour not yet at the condenser…' : `Recirculating · t = ${UI.fmt(st.t, 1)} min · y<sub>R</sub> has covered ${UI.fmt(100 * appr, 1)} % of the way to y* = ${r4(m.b.y)} · boil-up = condensate = overflow F<sub>c</sub> = ${UI.fmt(Fc, 1)} mmol/min (${UI.fmt(m.Fc * vmix(st.sys, st.yv), 2)} mL/min)`;
            tb.innerHTML = ''; tb.append(UI.table(['Live balance (light component)', 'In', 'Out', 'Accumulation', 'In − Out − Acc'], [
              ['Receiver (mmol/min)', `F_c·y*(x_b) = ${r3(fl ? Fc * st.yv : 0)}`, `F_c·y_R = ${r3(fl ? Fc * st.yR : 0)}`, `n_R·dy_R/dt = ${r3(acc)}`, '0'],
              ['Whole still, inventory (mmol)', `charge N·z_c = ${r3(1000 * m.N * m.zc)}`, `boiler n_B·x_b + receiver n_R·y_R = ${r3(1000 * m.nB * st.xb)} + ${r3(1000 * m.nR * st.yR)}`, '—', UI.fmt(Math.abs(1000 * (m.N * m.zc - m.nB * st.xb - m.nR * st.yR)) < 1e-9 ? 0 : 1000 * (m.N * m.zc - m.nB * st.xb - m.nR * st.yR), 3)]], [4]),
              h('p', { class: 'hint' }, 'Boiler 150 mL and receiver 15 mL, both well mixed; condensate rate F_c = n_R/τ with τ = 9 min. As the receiver fills with light-rich condensate, the boiler loses light component, so x_b drifts down to the set x and T rises to its bubble point. At equilibrium the accumulation term → 0 and y_R = y*.'));
          };
        }
        st.calc(); st.live();
        V.ro.set([['Equilibrium T (model)', f(b.T, 2) + ' °C'], ['y* (model)', f(b.y, 4)], ['y if ideal (Raoult)', f(id.y, 4)], ['$\\gamma_1$ / $\\gamma_2$ (model)', f(g1, 3) + ' / ' + f(g2, 3)], ['α', f(v.alpha(s.x), 3)], ['Azeotrope', v.az ? 'x = ' + f(v.az, 3) : 'none']]);
        const R = rows.filter(r => r.sys === s.sys), Tmin = Math.min(...v.Ts) - 3, Tmax = Math.max(...v.Ts) + 3;
        V.p.frame({ x: [0, 1], y: [Tmin, Tmax], xl: 'x, y (light)', yl: 'T (°C)', xs: 'x', ys: 'T' }).line(v.xs.map((x, i) => [x, v.Ts[i]]), { c: 'c2', l: 'bubble' }).line(v.ys.map((y, i) => [y, v.Ts[i]]), { c: 'c1', l: 'dew' })
          .pts(R.map(r => [r.x, r.T]), { c: 'c2', hollow: 1, r: 4 }).pts(R.map(r => [r.y, r.T]), { c: 'c1', hollow: 1, r: 4 }).vl(s.x).done();
      }
    },
    calc(rows, s, el, UI) {
      const sys = rows[0].sys, S0 = C.systems[sys], R = rows.filter(r => r.sys === sys).map(r => { const P = r.P * ATM, p1 = C.psat(S0.a, r.T), p2 = C.psat(S0.b, r.T), g1 = r.y * P / (r.x * p1), g2 = (1 - r.y) * P / ((1 - r.x) * p2), gE = r.x * Math.log(g1) + (1 - r.x) * Math.log(g2); return { ...r, p1, p2, g1, g2, a: (r.y / r.x) / ((1 - r.y) / (1 - r.x)), gE, lr: Math.log(g1 / g2), yid: ideal(sys, r.x, P).y }; }).sort((p, q) => p.x - q.x);
      if (R.length < rows.length) UI.note(el, `Only readings for ${nm(S0.a)} – ${nm(S0.b)} (the first system recorded) are used.`, 'warn');
      const a = R[0], P = a.P * ATM;
      UI.sec(el, 'Calculations');
      sample(el, `At $T$ = ${f(a.T, 2)} °C (Antoine): $P_1^{sat}$ = ${f(a.p1 / 1000, 3)} kPa, $P_2^{sat}$ = ${f(a.p2 / 1000, 3)} kPa; $P$ = ${f(P / 1000, 3)} kPa.<br>
        $\\gamma_1 = \\frac{${f(a.y, 4)}\\times${f(P / 1000, 3)}}{${f(a.x, 4)}\\times${f(a.p1 / 1000, 3)}} = ${f(a.g1, 4)}$, $\\gamma_2 = \\frac{${f(1 - a.y, 4)}\\times${f(P / 1000, 3)}}{${f(1 - a.x, 4)}\\times${f(a.p2 / 1000, 3)}} = ${f(a.g2, 4)}$.<br>
        $\\alpha = \\frac{${f(a.y, 4)}/${f(a.x, 4)}}{${f(1 - a.y, 4)}/${f(1 - a.x, 4)}} = ${f(a.a, 4)}$; Raoult’s law would give $y$ = ${f(a.yid, 4)}.`);
      tbl(el, ['#', 'T (°C)', 'x', 'y', 'P₁ˢᵃᵗ (kPa)', 'P₂ˢᵃᵗ (kPa)', 'γ₁', 'γ₂', 'α', 'gᴱ/RT', 'ln(γ₁/γ₂)', 'y Raoult'], R.map((r, i) => [i + 1, f(r.T, 2), f(r.x, 4), f(r.y, 4), f(r.p1 / 1000, 3), f(r.p2 / 1000, 3), f(r.g1, 4), f(r.g2, 4), f(r.a, 3), f(r.gE, 4), f(r.lr, 4), f(r.yid, 4)]));
      UI.sec(el, 'Graphs');
      const v = C.vle(sys, P), xs = C.linspace(0, 1, 101), idl = xs.map(x => ideal(sys, x, P));
      UI.plotIn(el).frame({ x: [0, 1], y: [Math.min(...v.Ts) - 3, Math.max(...v.Ts) + 3], xl: 'x, y (light)', yl: 'T (°C)', xs: 'x', ys: 'T' }).line(v.xs.map((x, i) => [x, v.Ts[i]]), { c: 'c2', l: 'bubble (model)' }).line(v.ys.map((y, i) => [y, v.Ts[i]]), { c: 'c1', l: 'dew (model)' })
        .line(idl.map((q, i) => [xs[i], q.T]), { c: 'mu', dash: [4, 4], w: 1, l: 'Raoult (ideal)' }).line(idl.map(q => [q.y, q.T]), { c: 'mu', dash: [4, 4], w: 1 }).pts(R.map(r => [r.x, r.T]), { c: 'c2', r: 4, l: 'x data' }).pts(R.map(r => [r.y, r.T]), { c: 'c1', r: 4, l: 'y data' }).done();
      UI.plotIn(el, 320).frame({ x: [0, 1], y: [0, 1], xl: 'x', yl: 'y', xs: 'x', ys: 'y' }).line([[0, 0], [1, 1]], { c: 'mu', w: 1 }).fn(v.y, 0, 1, { c: 'c1', l: 'model' }).line(idl.map((q, i) => [xs[i], q.y]), { c: 'mu', dash: [4, 4], w: 1, l: 'Raoult' }).pts(R.map(r => [r.x, r.y]), { c: 'c2', r: 4, l: 'data' }).done();
      const lgs = R.flatMap(r => [Math.log(r.g1), Math.log(r.g2), r.lr]).filter(isFinite), lo = Math.min(0, ...lgs) - .1, hi = Math.max(.1, ...lgs) + .1;
      UI.plotIn(el, 320).frame({ x: [0, 1], y: [lo, hi], xl: 'x₁', yl: 'ln γ', xs: 'x₁', ys: 'ln γ' }).hl(0).fn(x => Math.log(C.gamma(sys, x)[0]), 0, 1, { c: 'c1', w: 1, dash: [4, 3] }).fn(x => Math.log(C.gamma(sys, x)[1]), 0, 1, { c: 'c2', w: 1, dash: [4, 3] })
        .pts(R.map(r => [r.x, Math.log(r.g1)]), { c: 'c1', l: 'ln γ₁' }).pts(R.map(r => [r.x, Math.log(r.g2)]), { c: 'c2', l: 'ln γ₂' }).pts(R.map(r => [r.x, r.lr]), { c: 'c4', l: 'ln(γ₁/γ₂) — area test' }).done();
      // area test (extend linearly to x = 0 and 1)
      const X = [0, ...R.map(r => r.x), 1], Y = [R[0].lr, ...R.map(r => r.lr), R[R.length - 1].lr]; let Ap = 0, An = 0; for (let i = 1; i < X.length; i++) { const ar = (X[i] - X[i - 1]) * (Y[i] + Y[i - 1]) / 2; ar > 0 ? Ap += ar : An += ar; }
      const D = 100 * Math.abs(Ap + An) / (Ap + Math.abs(An) || 1);
      const ni = R.filter(r => r.x > .05 && r.x < .95 && Math.abs(r.gE) > .02), out = [['Mean α', f(R.reduce((q, r) => q + r.a, 0) / R.length, 3)], ['Area test: $A^+$ / $A^-$', f(Ap, 4) + ' / ' + f(An, 4)], ['Herington D', f(D, 1) + (D < 10 ? ' — consistent' : ' — check data')]];
      if (ni.length >= 3) { const fit = C.linfit(ni.map(r => r.x), ni.map(r => r.x * (1 - r.x) / r.gE)), A12 = 1 / fit.a, A21 = 1 / (fit.b + fit.a); out.push(['Van Laar $A_{12}$ (fit) / model', f(A12, 3) + ' / ' + f(S0.A12, 3)], ['Van Laar $A_{21}$ (fit) / model', f(A21, 3) + ' / ' + f(S0.A21, 3)], ['Fit R²', f(fit.r2, 4)]); }
      else out.push(['Van Laar fit', 'not applicable — solution is (nearly) ideal, γ ≈ 1']);
      UI.sec(el, 'Result'); res(el, out);
    },
    discussion: ['Compare the data with Raoult’s law: γ > 1 means positive deviation (unlike molecules attract less than like molecules).', 'Activity coefficients at the dilute ends are most sensitive to analysis error (division by small x).', 'A failed area test usually indicates non-equilibrium sampling, partial condensation in the vapour line or temperature error.', 'Relative volatility is not constant for non-ideal systems — this is why rigorous plate-to-plate methods are needed.'],
    viva: [
      { q: 'What is the purpose of recirculation in the Othmer still?', a: 'To reach a true steady state in which the condensate composition equals the equilibrium vapour composition of the boiling liquid.' },
      { q: 'State Raoult’s and Henry’s laws. When does each apply?', a: 'Raoult: $p_i = x_iP_i^{sat}$, valid for ideal solutions and for the solvent as $x\\to 1$. Henry: $p_i = H x_i$, valid for a dilute solute as $x\\to 0$.' },
      { q: 'What is an azeotrope? Give an example.', a: 'A mixture whose vapour and liquid have the same composition, so it boils at constant temperature and cannot be separated by ordinary distillation; e.g. ethanol–water, 89.4 mol % ethanol, 78.2 °C at 1 atm (minimum-boiling).' },
      { q: 'What is the Gibbs–Duhem equation used for here?', a: '$x_1 d\\ln\\gamma_1 + x_2 d\\ln\\gamma_2 = 0$ at constant T, P. It links γ₁ and γ₂ and gives consistency tests such as the Redlich–Kister area test.' },
      { q: 'How does pressure affect α?', a: 'For most systems α decreases as pressure (and therefore temperature) increases, so separation becomes harder; azeotrope compositions also shift with pressure (basis of pressure-swing distillation).' },
      { q: 'Why is the vapour assumed ideal?', a: 'At about 1 atm and modest temperatures the fugacity coefficients are close to 1 and the Poynting factor is negligible.' }
    ]
  };

  /* ======================= 4 · Ternary binodal by cloud-point titration ======================= */
  const BIN = () => [{ c: 0, b: .012 }].concat(C.binodal().map(q => ({ c: q.c, b: q.b })), [{ c: 0, b: .993 }]);
  function cloud(mode, w) { // returns titrant mass fraction λ = m_T/(m_0+m_T) at turbidity, or null
    const M0 = mode === 'R' ? { c: w, b: 0 } : { c: w, b: 1 - w }, Tv = mode === 'R' ? { c: 0, b: 1 } : { c: 0, b: 0 }, poly = BIN(); let best = null;
    for (let i = 0; i < poly.length - 1; i++) {
      const P1 = poly[i], P2 = poly[i + 1], dx = Tv.c - M0.c, dy = Tv.b - M0.b, ex = P2.c - P1.c, ey = P2.b - P1.b, den = -dx * ey + ex * dy; if (Math.abs(den) < 1e-12) continue;
      const rx = P1.c - M0.c, ry = P1.b - M0.b, l = (-rx * ey + ex * ry) / den, u = (dx * ry - dy * rx) / den;
      if (l > 1e-7 && l < 1 && u >= -1e-9 && u <= 1 + 1e-9 && (best === null || l < best)) best = l;
    }
    return best;
  }
  const comp4 = r => { const t = r.m0 + r.mT; return r.mode === 'R' ? { a: r.m0 * (1 - r.w / 100) / t, c: r.m0 * r.w / 100 / t, b: r.mT / t } : { b: r.m0 * (1 - r.w / 100) / t, c: r.m0 * r.w / 100 / t, a: r.mT / t }; };
  /* 3-D bench for lab 4: burette (titrant) over a stoppered conical flask on a magnetic stirrer. Each drop moves the overall
     composition along the straight line base → titrant vertex; past the binodal a second liquid phase appears as fine droplets (turbidity). */
  const RHO4 = { w: .998, c: 1.049, e: .724 };   // g/mL at 20 °C: water, acetic acid, isopropyl ether (CRC Handbook)
  function titr3d(v, st) {
    const { cstream } = T201.fx3, hsh = (i, k) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); }, OFF = [0, -50, 0];
    const yb = .32, Rb = .55, Rn = .15, Hc = .95, yt = 4.3, ybu = 1.75, rbu = .07;
    v.box(4, .16, 2.4, 0x9b7653, [0, -.08, 0]); v.box(1.4, .3, 1.1, 0x56606b, [0, .15, 0]); v.cyl(.08, .06, 0xdddddd, [.5, .2, .56], { rot: [Math.PI / 2, 0, 0] });
    v.cyl(Rb, Hc * .8, GLS, [0, yb + Hc * .4, 0], { r2: Rn + .02, op: .24, ds: 1, open: 1 }); v.cyl(Rn + .02, .35, GLS, [0, yb + Hc * .8 + .17, 0], { op: .18, ds: 1, open: 1 });
    const bar = v.box(.32, .05, .07, 0xffffff, [0, yb + .04, 0]);
    // liquid: frustum of the cone, rebuilt when the level changes
    const lm = v.mat(0xcfe6f2, { op: .35 }), liq = v.add(new THREE.CylinderGeometry(Rb, Rb, .01, 32), lm, [0, yb, 0]); let hL = -1;
    const rAt = y => Rb - (Rb - Rn) * clamp(y / (Hc * .8), 0, 1), vol = y => Math.PI * y / 3 * (Rb * Rb + Rb * rAt(y) + rAt(y) ** 2), VF = vol(Hc * .8);
    const level = mL => { const hh = C.bisect(y => vol(y) / VF - clamp(mL / 110, .01, .99), 1e-4, Hc * .8, 1e-6); if (Math.abs(hh - hL) > .004) { hL = hh; liq.geometry.dispose(); liq.geometry = new THREE.CylinderGeometry(rAt(hh), Rb - .005, hh, 32); liq.position.y = yb + hh / 2; } return hh; };
    // stand, clamp, burette, stopcock
    v.box(1, .05, .7, 0x444444, [-1.1, .03, 0]); v.cyl(.03, 4.5, MET, [-1.1, 2.3, 0]); v.box(1.05, .06, .06, MET, [-.55, 3.4, 0]);
    v.cyl(rbu, yt - ybu, GLS, [0, (yt + ybu) / 2, 0], { op: .2, ds: 1, open: 1 }); const bl = v.cyl(rbu - .012, 1, 0xd9ecf5, [0, 3, 0], { op: .6 });
    for (let k = 0; k <= 10; k++) v.box(.05, .006, .01, 0x333333, [.07, yt - .15 - k * (yt - ybu - .3) / 10, .045]);
    v.cyl(.02, .25, GLS, [0, ybu - .15, 0], { op: .4 }); v.cyl(.035, .1, GLS, [0, ybu - .3, 0], { op: .4 }); const sc = v.box(.2, .04, .04, 0xc0392b, [0, ybu - .3, .05]); v.cyl(.012, .25, GLS, [0, ybu - .47, 0], { op: .5 });
    const tip = ybu - .6;
    const drops = cstream(v, 24, .07, (u, i) => { if (!st.flow || (st.flow === 'drop' && i > 1)) return OFF; return [(hsh(i, 3) - .5) * .02, tip - u * (tip - st.ys), 0]; }, () => st.mode === 'R' ? [.85, .95, 1] : [.6, .8, 1], 1.4);
    const dl = cstream(v, 160, .05, (u, i) => { if (i >= 160 * st.turb) return OFF; const a = 6.28 * (u + hsh(i, 5)), r = (Rb - .08) * Math.sqrt(hsh(i, 7)) * (1 - .5 * hsh(i, 11) * st.hh / Hc), y = yb + .04 + (st.hh - .06) * hsh(i, 13); return [r * Math.cos(a), y, r * Math.sin(a)]; }, () => [1, 1, 1], .25);
    const tg = { bur: v.tag('', [rbu, 3.6, 0], 'bur'), cock: v.tag('Stopcock: stream / drop-wise', [.1, ybu - .3, .05], 'cock'), flask: v.tag('', [Rb - .1, yb + .25, 0], 'flask'), stir: v.tag('Magnetic stirrer (constant swirling)', [.5, .2, .56], 'stir') };
    let acc = 0, lastW = 0;
    v.tick((t, dt) => {
      const ww = v.el.clientWidth; if (ww && ww !== lastW) { lastW = ww; const k = clamp(640 / ww, 1, 2.3); v.look([1.6, 2.6 + .4 * (k - 1), 7.4 * k], [0, 2.1, 0]); }
      bar.rotation.y += dt * 12; sc.rotation.z = st.flow === 'fast' ? Math.PI / 2 : st.flow === 'drop' ? Math.PI / 5 : 0;
      if (st.flow) { st.VT += dt * (st.flow === 'fast' ? 1 : .05); if (st.Vf() > 104) { st.flow = 0; UI.toast('Flask full — use a smaller base mass'); } }
      st.upd(); st.hh = level(st.Vf()); st.ys = yb + st.hh; lm.color.setRGB(...[0, 1, 2].map(j => [.81, .9, .95][j] + ([.97, .97, .97][j] - [.81, .9, .95][j]) * st.turb)); lm.opacity = .35 + .55 * st.turb;
      const fr = 1 - (st.VT % 50) / 50; bl.scale.y = Math.max(.002, (yt - ybu - .2) * fr); bl.position.y = ybu + .05 + bl.scale.y / 2;
      acc += dt; if (acc > .2) { acc = 0; setTag(tg.bur, `Burette: ${UI.fmt(st.VT % 50, 2)} mL run out${st.VT >= 50 ? ' (refilled ×' + Math.floor(st.VT / 50) + ')' : ''}`); setTag(tg.flask, st.turb > 0 ? `CLOUDY: second liquid phase · ${UI.fmt(st.m0 + st.mT, 2)} g` : `Clear, one phase · ${UI.fmt(st.m0 + st.mT, 2)} g`); st.live && st.live(); }
    });
  }
  function draw4(s, p, rows, cur) {
    const l = cloud(s.mode, s.w / 100); T201.triangle(p, UI, false);
    const M0 = s.mode === 'R' ? { c: s.w / 100, b: 0 } : { c: s.w / 100, b: 1 - s.w / 100 }, Tv = s.mode === 'R' ? { c: 0, b: 1 } : { c: 0, b: 0 }, P = T201.triP;
    p.line([P(M0), P(Tv)], { c: 'c3', w: 1, dash: [4, 4], l: 'titration path' }); if (l !== null) p.pts([P({ c: M0.c + l * (Tv.c - M0.c), b: M0.b + l * (Tv.b - M0.b) })], { c: 'c3', r: 6, l: 'cloud point (theory)' });
    if (cur) p.pts([P(cur)], { c: 'c5', r: 5, l: 'flask now' });
    p.pts(rows.map(r => P(comp4(r))), { c: 'c2', r: 4, l: 'your readings' }).done();
  }
  const L4 = {
    refs: ["<i>Othmer, D.F., White, R.E. & Trueger, E.</i> (1941) Liquid–liquid extraction data. <i>Ind. Eng. Chem.</i> 33, 1240–1248.", "<i>Treybal, R.E.</i> (1963) <i>Liquid Extraction</i>, 2nd ed., McGraw-Hill.", "<i>Sørensen, J.M. & Arlt, W.</i> (1979–80) <i>Liquid–Liquid Equilibrium Data Collection</i>, DECHEMA Chemistry Data Series V.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 10."],
    id: 'binodal', title: 'Ternary solubility (binodal) curve by cloud-point titration', tags: 'ternary binodal cloud point titration solubility plait liquid extraction',
    blurb: 'Titrate water + acetic acid with isopropyl ether (and the reverse) to the cloud point; plot the binodal curve.',
    aim: 'To determine the <b>solubility (binodal) curve</b> of the ternary system water (A) – acetic acid (C) – isopropyl ether (B) at room temperature by the <b>cloud-point titration</b> method and to plot it on a triangular diagram.',
    objectives: ['Locate points on the water-rich (raffinate) branch by titrating water + acid with ether.', 'Locate points on the ether-rich (extract) branch by titrating ether + acid with water.', 'Plot the binodal curve and estimate the plait point.'],
    theory: `<p>Water and isopropyl ether are almost immiscible; acetic acid is completely miscible with both. In an equilateral <b>triangular diagram</b> each vertex is a pure component and every interior point a ternary mixture. Mixtures under the <b>binodal (solubility) curve</b> separate into two liquid layers whose compositions lie on the curve at the ends of a <b>tie line</b>; mixtures outside it are a single homogeneous phase. The two branches meet at the <b>plait point</b>, where the two layers become identical.</p>
<p><b>Cloud-point method.</b> A homogeneous binary mixture (water + acid) is titrated with the third component (ether). Each addition moves the overall composition along a straight line towards the ether vertex. The first permanent turbidity (cloudiness) appears exactly when this line crosses the binodal curve. From the masses of the three components at that point one point on the curve is obtained. Repeating with different acid contents, and titrating ether + acid with water, traces both branches.</p>`,
    eqs: [
      { n: 'Composition at the cloud point', m: 'w_i=\\frac{m_i}{m_A+m_B+m_C}' },
      { n: 'Mass from burette', m: 'm_T=\\rho_T\\,V_T' },
      { n: 'Triangle coordinates', m: 'X=w_B+\\tfrac12 w_C,\\qquad Y=\\tfrac{\\sqrt3}{2}w_C' }
    ],
    apparatus(el, UI) {
      UI.svg(el, DEFS + burette(320, 20, 170, .7) + conical(320, 300, 50, 90, .45) + `<rect class="s" x="250" y="300" width="140" height="18" rx="4"/><rect class="ht" x="300" y="290" width="40" height="5" rx="2"/>`
        + T(340, 60, 'Burette: titrant', 'start') + T(340, 76, '(ether for water-rich side,', 'start', 'mu') + T(340, 92, ' water for ether-rich side)', 'start', 'mu')
        + T(380, 260, 'Base mixture (weighed)', 'start') + T(380, 276, 'first permanent turbidity = cloud point', 'start', 'mu') + T(320, 334, 'Magnetic stirrer', 'middle', 'mu')
        + T(60, 140, 'Clear → cloudy', 'start') + `<circle class="lq" cx="80" cy="180" r="18"/><circle class="s" cx="80" cy="180" r="18"/><circle class="pk" cx="140" cy="180" r="18"/><circle class="s" cx="140" cy="180" r="18"/>` + arw(100, 180, 120, 180) + T(80, 215, 'one phase', 'middle', 'mu') + T(140, 215, 'two phases', 'middle', 'mu'), '0 0 640 340');
    },
    apparatusList: ['Burettes (50 mL) for ether and water', 'Stoppered conical flasks (100 mL), magnetic stirrer', 'Analytical balance (±0.01 g)', 'Acetic acid (glacial), distilled water, isopropyl ether', 'Thermometer (data are temperature-dependent)'],
    procedure: ['Weigh into a stoppered flask a mixture of water and acetic acid of known composition (e.g. 20 g with 0–60 wt % acid).', 'Titrate slowly with isopropyl ether from the burette with constant swirling until the first permanent turbidity appears. Record the mass (or volume × density) of ether added.', 'Repeat for different acid contents to cover the water-rich branch.', 'Weigh ether + acetic acid mixtures and titrate with water to the cloud point for the ether-rich branch.', 'Calculate the wt % of each component at every cloud point and plot on triangular graph paper; join the points smoothly. The plait point is where the two branches meet (where turbidity becomes hard to detect).'],
    precautions: ['Add titrant drop-wise near the end point and swirl; turbidity must persist for ~1 min.', 'Keep flasks stoppered: ether is very volatile and flammable.', 'Work at a constant, recorded temperature.'],
    bench: {
      controls: [
        { k: 'mode', t: 'seg', label: 'Titration', v: 'R', opts: { R: 'Water + acid ← ether', E: 'Ether + acid ← water' } },
        { k: 'm0', label: 'Mass of base mixture m₀', min: 5, max: 50, step: .5, v: 20, unit: 'g' },
        { k: 'w', label: 'Acetic acid in base mixture', min: 0, max: 70, step: 1, v: 20, unit: 'wt %' }
      ],
      cols: [{ k: 'mode', l: 'Branch' }, { k: 'm0', l: 'm<sub>0</sub> (g)', d: 2 }, { k: 'w', l: 'acid in base (wt %)', d: 1 }, { k: 'mT', l: 'titrant to cloud point (g)', d: 2 }],
      run(s, nz) {
        const l = cloud(s.mode, s.w / 100);
        if (l === null) { UI.toast('No turbidity — the mixture stays one phase (above the plait region)'); return null; }
        const mT = s.m0 * l / (1 - l);
        return { mode: s.mode, m0: s.m0, w: s.w, mT: Math.max(.01, mT + nz.n(.03 + .01 * mT)) };
      },
      preset: s => [0, 10, 20, 30, 40, 50, 60].map(w => ({ mode: 'R', w })).concat([0, 10, 20, 30, 40, 50].map(w => ({ mode: 'E', w }))),
      views: [{ k: 'v', t: '3d', h: 470, cam: [1.6, 2.6, 7.4], target: [0, 2.1, 0] }, { k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 360 }],
      walk: [
        { t: '1 · Weigh the base mixture, start stirring', d: 'A known mass m₀ of water + acetic acid (or ether + acid for the other branch) is weighed into a stoppered conical flask. The mixture is one clear phase: on the triangle it sits on the A–C edge (or the B–C edge).', hi: ['flask', 'stir'], do: S => { const st = S._st || (S._st = {}); st.reset && st.reset(); } },
        { t: '2 · Fill the burette with the titrant', d: 'Isopropyl ether (ρ = 0.724 g/mL) for the water-rich branch, water (ρ = 0.998 g/mL) for the ether-rich branch. Mass added = ρ × volume read from the burette.', hi: ['bur'] },
        { t: '3 · Titrate: the mixture walks along a straight line', d: 'Every millilitre added moves the overall composition along the line from the base point towards the titrant vertex (mixing rule, λ = m<sub>T</sub>/(m₀ + m<sub>T</sub>)). While the point is outside the binodal curve the flask stays clear.', hi: ['bur', 'cock', 'flask'], do: S => { const st = S._st || (S._st = {}); if (st.reset) { st.flow = 0; if (isFinite(st.mTc)) st.VT = .8 * st.mTc / st.rT; } } },
        { t: '4 · Drop-wise to the first permanent turbidity', d: 'Near the end point add one drop at a time and swirl. When the line crosses the binodal the mixture is saturated: a second liquid phase forms as tiny droplets that scatter light, so the flask turns milky and stays so. That is the cloud point.', hi: ['flask', 'cock'], do: S => { const st = S._st || (S._st = {}); if (st.reset) { st.flow = 0; if (isFinite(st.mTc)) st.VT = 1.004 * st.mTc / st.rT; } } },
        { t: '5 · Record, then repeat', d: 'Mass fractions of water, acid and ether at the cloud point give one point on the binodal curve. Repeat with other acid contents and with the reverse titration to trace both branches up to the plait point.', hi: ['bur', 'flask'] }
      ],
      view(s, V, rows, S) {
        const l = cloud(s.mode, s.w / 100), mT = l === null ? NaN : s.m0 * l / (1 - l), st = S._st || (S._st = {}), key = s.mode + '|' + s.m0 + '|' + s.w;
        if (st.key !== key) {
          const rT = s.mode === 'R' ? RHO4.e : RHO4.w, mc = s.m0 * s.w / 100, mo = s.m0 - mc;   // mo = water (R) or ether (E) in the base
          Object.assign(st, { key, mode: s.mode, m0: s.m0, w: s.w, rT, mTc: l === null ? Infinity : mT, mc, mo, sv: s });
          st.Vf = () => mc / RHO4.c + (s.mode === 'R' ? mo / RHO4.w + st.mT / RHO4.e : mo / RHO4.e + st.mT / RHO4.w);
          st.upd = () => { st.mT = st.VT * rT; st.turb = st.mT > st.mTc ? clamp((st.mT - st.mTc) / (.015 * (s.m0 + st.mTc)) + .08, 0, 1) : 0; };
          st.reset = () => Object.assign(st, { flow: 0, VT: 0, mT: 0, turb: 0, cloudAt: null });
          st.reset(); st.upd(); S._k = null;
        }
        if (V.v.ok && S._k !== st.key) { S._k = st.key; V.v.clear(); titr3d(V.v, st); }
        if (!S._lv) {
          S._lv = 1; const info = h('div', { class: 'hint', style: 'margin:6px 0' }), tb = h('div'), bt = (t, fn, c = 'btn sm') => h('button', { class: c, onclick: () => { fn(); st.live(); } }, t);
          V.live.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' }, bt('▶ Stream (1 mL/s)', () => st.flow = 'fast', 'btn pri sm'), bt('💧 Drop-wise', () => st.flow = 'drop'), bt('■ Close stopcock', () => st.flow = 0), bt('↺ Fresh flask', () => st.reset())), info, tb);
          let lastD = -1;
          st.live = () => {
            const cur = st.mode === 'R' ? { a: st.mo / (st.m0 + st.mT), c: st.mc / (st.m0 + st.mT), b: st.mT / (st.m0 + st.mT) } : { b: st.mo / (st.m0 + st.mT), c: st.mc / (st.m0 + st.mT), a: st.mT / (st.m0 + st.mT) }, r3 = x => UI.fmt(x, 3), lam = st.mT / (st.m0 + st.mT), nmT = st.mode === 'R' ? 'ether' : 'water';
            if (st.turb > 0 && st.cloudAt === null) st.cloudAt = st.mT; if (st.turb === 0) st.cloudAt = null;
            const ov = st.turb > 0 ? st.mT - st.mTc : 0;
            info.innerHTML = `Titrant ${nmT}: ${UI.fmt(st.VT, 2)} mL × ${st.rT} g/mL = <b>${UI.fmt(st.mT, 3)} g</b> · λ = ${UI.fmt(lam, 4)} · flask: water ${UI.fmt(100 * cur.a, 2)} %, acid ${UI.fmt(100 * cur.c, 2)} %, ether ${UI.fmt(100 * cur.b, 2)} % · ` + (st.turb > 0 ? `<b>cloud point passed</b> (overshoot ${UI.fmt(ov / st.rT, 2)} mL — close the stopcock and record)` : isFinite(st.mTc) ? 'clear: one phase' : 'clear: this base mixture never turns cloudy (its titration line misses the two-phase region)');
            tb.innerHTML = ''; tb.append(UI.table(['Live mass balance (flask now)', 'In', 'Out (flask contents)', 'In − Out'], [
              ['Total mass (g)', `base m₀ + titrant ρ·V = ${r3(st.m0)} + ${r3(st.mT)}`, `water + acid + ether = ${r3((st.m0 + st.mT) * cur.a)} + ${r3(st.mc)} + ${r3((st.m0 + st.mT) * cur.b)}`, '0'],
              ['Acetic acid (g)', `base m₀·w = ${r3(st.mc)}`, `flask: x_C·(m₀ + m_T) = ${r3(cur.c * (st.m0 + st.mT))}`, '0'],
              ['Mass fractions', '1', `w_A + w_B + w_C = ${UI.fmt(cur.a + cur.b + cur.c, 4)}`, '0']], [3]));
            const d = Math.round(st.mT * 20); if (d !== lastD && V.p) { lastD = d; draw4(st.sv, V.p, S._rows || [], st.mT > 0 ? cur : null); }
          };
        }
        S._rows = rows; st.sv = s;
        st.live(); draw4(s, V.p, rows, st.mT > 0 ? (st.mode === 'R' ? { c: st.mc / (st.m0 + st.mT), b: st.mT / (st.m0 + st.mT) } : { c: st.mc / (st.m0 + st.mT), b: st.mo / (st.m0 + st.mT) }) : null);
        V.ro.set([['Titrant needed (theory)', l === null ? 'no cloud point' : f(mT, 2) + ' g'], ['Titrant volume (ρ = ' + (s.mode === 'R' ? '0.724' : '0.998') + ' g/mL)', l === null ? '—' : f(mT / (s.mode === 'R' ? .724 : .998), 2) + ' mL']]);
      }
    },
    calc(rows, s, el, UI) {
      const R = rows.map(r => ({ ...r, ...comp4(r) }));
      UI.sec(el, 'Calculations');
      const a = R[0];
      sample(el, `Base: ${f(a.m0, 2)} g with ${f(a.w, 1)} wt % acid; titrant to cloud point ${f(a.mT, 2)} g; total ${f(a.m0 + a.mT, 2)} g.<br>
        Water = ${f(a.a * 100, 2)} %, acetic acid = ${f(a.c * 100, 2)} %, isopropyl ether = ${f(a.b * 100, 2)} %.`);
      tbl(el, ['#', 'Branch', 'm₀ (g)', 'titrant (g)', 'Water A (wt %)', 'Acid C (wt %)', 'Ether B (wt %)'], R.map((r, i) => [i + 1, r.mode === 'R' ? 'water-rich' : 'ether-rich', f(r.m0, 2), f(r.mT, 2), f(100 * r.a, 2), f(100 * r.c, 2), f(100 * r.b, 2)]));
      UI.sec(el, 'Binodal curve on the triangular diagram');
      const p = UI.plotIn(el, 440); T201.triangle(p, UI, true);
      p.pts(R.filter(r => r.mode === 'R').map(r => T201.triP(r)), { c: 'c2', r: 5, l: 'water-rich branch (yours)' }).pts(R.filter(r => r.mode === 'E').map(r => T201.triP(r)), { c: 'c3', r: 5, l: 'ether-rich branch (yours)' }).done();
      const top = R.reduce((q, r) => r.c > q ? r.c : q, 0);
      UI.sec(el, 'Result'); res(el, [['Points obtained', R.length + ''], ['Highest acid content with two phases', f(100 * top, 1) + ' wt %'], ['Plait point (literature, 20 °C, approx.)', 'C ≈ 42 %, A ≈ 27 %, B ≈ 31 %']]);
    },
    discussion: ['The water-rich branch lies very close to the A–C edge because ether is only ~1–2 % soluble in water; the ether-rich branch is close to the B–C edge.', 'Near the plait point the two phases have similar densities and refractive indices, so the cloud point becomes indistinct — the largest scatter is found there.', 'The curve is temperature-dependent; mutual solubility usually increases with temperature, shrinking the two-phase region.', 'Tie lines cannot be obtained from cloud points alone — they require analysis of both equilibrium layers (see the extraction experiment).'],
    viva: [
      { q: 'What does the binodal curve represent?', a: 'The boundary between the one-phase and two-phase regions: the locus of the compositions of saturated (equilibrium) liquid layers.' },
      { q: 'What is a plait point?', a: 'The point on the binodal curve where the raffinate and extract branches meet and the tie line shrinks to zero length; both phases have identical composition.' },
      { q: 'Why does turbidity appear at the cloud point?', a: 'The mixture becomes saturated and a second liquid phase forms as fine droplets that scatter light.' },
      { q: 'Why does the titration path follow a straight line?', a: 'Adding a pure component changes the mixture along the line joining the initial mixture point and that component’s vertex (lever rule / mixing rule).' },
      { q: 'What is a type I ternary system?', a: 'A system with one pair partially miscible (A–B) and two pairs completely miscible (A–C, B–C), such as water – acetic acid – isopropyl ether.' }
    ]
  };

  /* ======================= 5 · Single & multistage (cross-current) extraction ======================= */
  const MA = 60.05;
  /* Cross-current stage solution (Treybal 20 °C tie lines via C.lleSplit): stage j gets raffinate R_{j-1} + fresh solvent S. */
  function xstages(s) {
    const out = []; let R = { c: s.xF / 100, b: 0, a: 1 - s.xF / 100 }, mR = s.F;
    for (let i = 0; i < s.n; i++) { const mM = mR + s.S, M = { c: R.c * mR / mM, b: (R.b * mR + s.S) / mM }, sp = C.lleSplit(M, mM); if (!sp) break; out.push({ Rin: R, mRin: mR, M, mM, ...sp }); R = sp.R; mR = sp.Rmass; }
    return out;
  }
  const vliq = (m, q) => m * (q.a / RHO4.w + q.c / RHO4.c + q.b / RHO4.e);   // mL, ideal mixing

  /* 3-D bench for lab 5: one globe separating funnel per stage on a stand, beaker below each.
     Per stage: (raffinate in) → add ether → shake (emulsion, acid crosses the interface) → settle (extract on top, raffinate below) → drain raffinate. */
  const SEG5 = [1.5, 1.5, 2.5, 2.5, 1.5];          // s: feed in, add solvent, shake, settle, drain
  function sep3d(v, st) {
    const { cstream, pathAt } = T201.fx3, hsh = (i, k) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); }, OFF = [0, -50, 0];
    const X = st.X, n = X.length, r = .5, k = 1.25, yc = 2.25, tip = yc - r * k - .62, cap = st.cap, AQ = new THREE.Color(.62, .82, .95), ET = new THREE.Color(.98, .93, .62), EM = new THREE.Color(.93, .9, .82);
    const xs = j => (j - (n - 1) / 2) * 1.7;
    v.box(1.7 * n + .8, .16, 2, 0x9b7653, [0, -.08, 0]);
    const F = X.map((q, j) => {
      const x = xs(j), g = new THREE.Group(); g.position.set(x, yc, 0); v.root.add(g);
      v.sph(r, GLS, [0, 0, 0], { op: .17, ds: 1, seg: 28, parent: g }).scale.y = k; v.cyl(.07, .35, GLS, [0, r * k + .15, 0], { op: .25, ds: 1, open: 1, parent: g }); v.cyl(.08, .1, 0x2e6fb0, [0, r * k + .36, 0], { parent: g });
      v.cyl(.025, .62, GLS, [0, -r * k - .31, 0], { op: .4, parent: g }); const cock = v.box(.18, .035, .035, 0xc0392b, [0, -r * k - .22, .04], { parent: g });
      v.cyl(.025, 3.4, MET, [x - .75, 1.7, -.35]); v.box(.75, .03, .03, MET, [x - .38, yc - r * k + .1, -.35]); v.tor(.3, .02, MET, [x, yc - r * k + .1, 0]);
      v.cyl(.3, .7, GLS, [x, .35, 0], { op: .18, ds: 1, open: 1 }); const bk = v.cyl(.285, 1, 0xffffff, [x, .02, 0], { op: .6 });
      const lay = [AQ, ET].map(c => { const m = v.mat(c.getHex(), { op: .55 }); return { m, band: v.add(new THREE.SphereGeometry(r - .02, 28, 10), m, [0, 0, 0], null, g), d1: v.add(new THREE.CircleGeometry(1, 28), m, [0, 0, 0], [-Math.PI / 2, 0, 0], g), d2: v.add(new THREE.CircleGeometry(1, 28), m, [0, 0, 0], [-Math.PI / 2, 0, 0], g), key: '' }; });
      lay.forEach(L => L.band.scale.y = k);
      return { x, g, cock, bk, lay, tag: v.tag('', [x + r, yc + .2, 0], 'f' + j), btag: v.tag('', [x + .3, .5, 0], 'b' + j) };
    });
    const ri = r - .02, yOf = fr => { const h = C.bisect(z => z * z * (3 * ri - z) / (4 * ri ** 3) - fr, 0, 2 * ri, 1e-7); return h; };   // height (unscaled) of a cap holding fraction fr
    const setBand = (L, f1, f2) => { const key = f1.toFixed(3) + f2.toFixed(3); if (L.key === key) return; L.key = key; const vis = f2 - f1 > .002; [L.band, L.d1, L.d2].forEach(o => o.visible = vis); if (!vis) return;
      const h1 = f1 > 0 ? yOf(f1) : 0, h2 = yOf(Math.min(.97, f2)), t0 = Math.acos(clamp((h2 - ri) / ri, -1, 1)), t1 = Math.acos(clamp((h1 - ri) / ri, -1, 1)); L.band.geometry.dispose(); L.band.geometry = new THREE.SphereGeometry(ri, 28, 10, 0, 6.2832, t0, Math.max(.01, t1 - t0));
      const rr = h => Math.sqrt(Math.max(1e-6, ri * ri - (h - ri) ** 2)); L.d1.position.y = (h1 - ri) * k; L.d1.scale.set(rr(h1), rr(h1), 1); L.d2.position.y = (h2 - ri) * k; L.d2.scale.set(rr(h2), rr(h2), 1); };
    const lev = (vol) => clamp(vol / cap, 0, .97);
    // state of every funnel at time T
    const T1 = SEG5.reduce((a, b) => a + b, 0), state = T => {
      const out = X.map(() => ({ aq: 0, et: 0, mix: 0, ang: 0, bk: 0, pour: 0, flow: 0, phase: '' })), sI = Math.min(n - 1, Math.floor(T / T1)), tau = T - sI * T1;
      for (let j = 0; j < n; j++) { const q = X[j], o = out[j], vR0 = vliq(q.mRin, q.Rin), vS = st.vS, vR = vliq(q.Rmass, q.R), vE = vliq(q.Emass, q.E);
        if (j < sI || (j === sI && T >= n * T1)) Object.assign(o, { aq: 0, et: vE, bk: j === n - 1 ? vR : 0, phase: 'done' });
        else if (j === sI) { let t = tau; const seg = SEG5.map(d => { const u = clamp(t / d, 0, 1); t -= d; return u; });
          if (seg[4] > 0) Object.assign(o, { aq: vR * (1 - seg[4]), et: vE, bk: vR * seg[4], flow: seg[4] < 1 ? 1 : 0, phase: 'drain' });
          else if (seg[2] >= 1) Object.assign(o, { aq: vR, et: vE, mix: 1 - seg[3], phase: 'settle', p: seg[3] });
          else if (seg[2] > 0) Object.assign(o, { aq: vR0 + (vR - vR0) * seg[2], et: vS + (vE - vS) * seg[2], mix: Math.min(1, seg[2] * 4), ang: .45 * Math.sin(seg[2] * 40) * Math.min(1, (1 - seg[2]) * 8), phase: 'shake', p: seg[2] });
          else Object.assign(o, { aq: vR0 * (j === 0 ? 1 : seg[0]), et: vS * seg[1], pour: seg[1] > 0 && seg[1] < 1 ? 1 : 0, phase: seg[1] > 0 ? 'add' : 'feed' }); o.feedIn = j > 0 && seg[0] < 1 ? 1 : 0; }
        o.tr = j === sI && j > 0 && T - sI * T1 < SEG5[0]; }
      if (sI > 0) { const pv = out[sI - 1], u = clamp((T - sI * T1) / SEG5[0], 0, 1); pv.bk = vliq(X[sI - 1].Rmass, X[sI - 1].R) * (1 - u); }
      return out;
    };
    st.state = state; st.Tend = n * T1;
    // acid packets: 260 particles = feed acid; particle i ends in extract of the first stage j with hsh(i, 50 + j) < q_j
    const NP = 260, qj = X.map(q => q.Emass * q.E.c / (q.mRin * q.Rin.c)), home = i => { for (let j = 0; j < n; j++) if (hsh(i, 50 + j) < qj[j]) return j; return n; };
    const H = Array.from({ length: NP }, (_, i) => home(i));
    const inBand = (i, f1, f2, j, ang) => { const h = yOf(f1 > 0 ? f1 : 0) + (yOf(Math.max(f1 + .001, f2)) - yOf(f1 > 0 ? f1 : 0)) * hsh(i, 7), rr = Math.sqrt(Math.max(0, ri * ri - (h - ri) ** 2)) * .9 * Math.sqrt(hsh(i, 9)), a = 6.28 * hsh(i, 11) + st.t * .3, lx = rr * Math.cos(a), ly = (h - ri) * k, c = Math.cos(ang), s2 = Math.sin(ang); return [F[j].x + lx * c - ly * s2, yc + lx * s2 + ly * c, rr * Math.sin(a)]; };
    const bkH = vol => Math.min(.66, vol / 300 * .62), bkPos = (i, j) => { const rr = .25 * Math.sqrt(hsh(i, 21)), a = 6.28 * hsh(i, 23); return [F[j].x + rr * Math.cos(a), .04 + Math.max(.02, bkH(st.S[j].bk) - .04) * hsh(i, 25), rr * Math.sin(a)]; };
    cstream(v, NP, .07, (u, i) => { const S2 = st.S; if (!S2) return OFF;
      for (let j = 0; j < n; j++) { const o = S2[j], fa = lev(o.aq), ft = lev(o.aq + o.et), vR0 = vliq(X[j].mRin, X[j].Rin);
        if (o.phase === '') return j ? bkPos(i, j - 1) : OFF;
        if (j > 0 && o.phase === 'feed' && hsh(i, 19) >= o.aq / vR0) return bkPos(i, j - 1);
        if (o.mix > .5) return inBand(i, 0, ft, j, o.ang);
        if (H[i] === j) return o.phase === 'feed' || o.phase === 'add' ? inBand(i, 0, fa, j, o.ang) : inBand(i, fa, ft, j, o.ang);
        if (o.phase === 'done') continue;
        if (o.phase === 'drain' && hsh(i, 17) < o.bk / (o.aq + o.bk)) return bkPos(i, j);
        return inBand(i, 0, fa, j, o.ang); }
      return bkPos(i, n - 1); }, () => [.95, .45, .08], .3);
    cstream(v, 40, .07, (u, i) => { const S2 = st.S; if (!S2) return OFF; const j = S2.findIndex(o => o.pour); if (j < 0) return OFF; return [F[j].x + (hsh(i, 3) - .5) * .03, yc + r * k + 1.1 - u * (1.1 + r * k * (1 - 2 * lev(S2[j].aq + S2[j].et))), 0]; }, () => [.98, .93, .62], 1.2);
    cstream(v, 30, .06, (u, i) => { const S2 = st.S; if (!S2) return OFF; const j = S2.findIndex(o => o.flow); if (j < 0) return OFF; return [F[j].x, tip - u * (tip - .05 - bkH(S2[j].bk)), 0]; }, () => [.62, .82, .95], 1.5);
    cstream(v, 40, .07, (u, i) => { const S2 = st.S; if (!S2) return OFF; const j = S2.findIndex(o => o.tr); if (j < 1) return OFF; return pathAt([[F[j - 1].x, .75, 0], [(F[j - 1].x + F[j].x) / 2, yc + r * k + 1, .3], [F[j].x, yc + r * k + .5, 0]], u); }, () => [.62, .82, .95], .8);
    let acc = 0, lastW = 0;
    v.tick((t, dt) => {
      const ww = v.el.clientWidth; if (ww && ww !== lastW) { lastW = ww; const kk = clamp(640 / ww, 1, 2.4) * (n > 2 ? 1 + .22 * (n - 2) : 1); v.look([.6, 2.4 + .3 * (kk - 1), 6.4 * kk], [0, 1.8, 0]); }
      if (st.run && st.t < st.Tend) st.t = Math.min(st.Tend, st.t + dt); st.t = clamp(st.t, 0, st.Tend);
      const S2 = st.S = state(st.t);
      S2.forEach((o, j) => { const f = F[j], fa = lev(o.aq), ft = lev(o.aq + o.et); f.g.rotation.z = o.ang; f.cock.rotation.y = o.flow ? Math.PI / 2 : 0;
        if (o.mix > .5) { f.lay[0].m.color.copy(EM); setBand(f.lay[0], 0, ft); setBand(f.lay[1], 0, 0); } else { f.lay[0].m.color.copy(AQ); setBand(f.lay[0], 0, fa); setBand(f.lay[1], fa, ft); }
        f.lay[1].m.opacity = .55; f.bk.scale.y = Math.max(.001, bkH(o.bk)); f.bk.position.y = .02 + f.bk.scale.y / 2; f.bk.visible = o.bk > .5; });
      acc += dt; if (acc > .2) { acc = 0; S2.forEach((o, j) => { const q = X[j], dn = o.phase === 'done' || o.phase === 'drain' || o.phase === 'settle' && o.p > .5;
        setTag(F[j].tag, o.phase === '' ? `Stage ${j + 1}: waiting` : o.phase === 'shake' ? `Stage ${j + 1}: shaking — acid crossing` : dn ? `Stage ${j + 1}: E ${UI.fmt(q.Emass, 1)} g, y = ${UI.fmt(100 * q.E.c, 2)} % · R ${UI.fmt(q.Rmass, 1)} g, x = ${UI.fmt(100 * q.R.c, 2)} %` : `Stage ${j + 1}: ${o.phase === 'add' ? 'adding ' + UI.fmt(st.sv.S, 0) + ' g ether' : j ? 'raffinate in' : 'feed charged'}`);
        setTag(F[j].btag, o.bk > .5 ? `Raffinate R${j + 1} → ${j < n - 1 ? 'stage ' + (j + 2) : 'product'}` : ''); }); st.live && st.live(); }
    });
  }
  const L5 = {
    refs: ["<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 10.", "<i>Treybal, R.E.</i> (1963) <i>Liquid Extraction</i>, 2nd ed., McGraw-Hill.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 8.", "<i>Hand, D.B.</i> (1930) Dineric distribution. <i>J. Phys. Chem.</i> 34, 1961–2000.", "<i>Mendham, J., Denney, R.C., Barnes, J.D. & Thomas, M.J.K.</i> (2000) <i>Vogel’s Textbook of Quantitative Chemical Analysis</i>, 6th ed., Prentice Hall. (titration practice)"],
    id: 'extraction', title: 'Liquid–liquid extraction — single stage and cross-current', tags: 'extraction distribution coefficient cross current separating funnel titration percent extraction selectivity',
    blurb: 'Extract acetic acid from water with isopropyl ether in separating funnels; titrate both layers with NaOH.',
    aim: 'To extract acetic acid from an aqueous solution with isopropyl ether in <b>one stage</b> and in <b>multiple cross-current stages</b>, to determine the <b>distribution coefficient</b> and the <b>% extraction</b>, and to compare with equilibrium (tie-line) predictions.',
    objectives: ['Determine the acid content of raffinate and extract layers by titration with standard NaOH.', 'Calculate the distribution coefficient $K = y/x$ and the % extraction.', 'Show that dividing the same solvent into several cross-current stages extracts more solute.'],
    theory: `<p>In <b>liquid–liquid extraction</b> a solute (C, acetic acid) is transferred from a feed solvent (A, water) into an immiscible or partly miscible extraction solvent (B, isopropyl ether). After mixing and settling, the two layers are in equilibrium: the <b>extract</b> (ether-rich, top) and <b>raffinate</b> (water-rich, bottom). The equilibrium is described by the <b>distribution coefficient</b> $K = y_C/x_C$ (wt fractions of C in extract and raffinate) and the <b>selectivity</b> β, which must exceed 1 for a useful separation.</p>
<p>In a single stage, the feed F and solvent S mix to M (lever rule) and split along the tie line through M. In <b>cross-current</b> extraction the raffinate from each stage is contacted with fresh solvent; for the same total solvent, several small portions extract more than one large portion (the classic result for constant K and immiscible solvents: $x_N/x_F = 1/(1+KS'/A)^N$).</p>
<p>The acid in each layer is found by titrating a weighed aliquot with standard NaOH (phenolphthalein): $w_C = V_{NaOH}N\\,M_C/(1000\\,m_{aliquot})$.</p>`,
    eqs: [
      { n: 'Acid by titration', m: 'w_C=\\frac{V_{NaOH}\\,N\\,M_C}{1000\\,m_{al}}' },
      { n: 'Distribution coefficient', m: 'K=\\frac{y_C}{x_C}' },
      { n: 'Selectivity', m: '\\beta=\\frac{y_C/y_A}{x_C/x_A}' },
      { n: '% extraction', m: '\\%E=100\\left(1-\\frac{R_N x_N}{F x_F}\\right)' },
      { n: 'Cross-current, immiscible', m: '\\frac{x_N}{x_F}=\\frac{1}{(1+K S/A)^N}\\;\\text{(solute-free basis)}' }
    ],
    apparatus(el, UI) {
      const fun = (x, y, i) => { const d = `M${x - 8},${y} L${x - 8},${y + 12} C${x - 44},${y + 30} ${x - 44},${y + 92} ${x - 6},${y + 122} L${x - 3},${y + 142} L${x + 3},${y + 142} L${x + 6},${y + 122} C${x + 44},${y + 92} ${x + 44},${y + 30} ${x + 8},${y + 12} L${x + 8},${y} Z`;
        return `<clipPath id="sf${i}"><path d="${d}"/></clipPath><rect class="lq2" x="${x - 45}" y="${y + 38}" width="90" height="34" clip-path="url(#sf${i})"/><rect class="lq" x="${x - 45}" y="${y + 72}" width="90" height="72" clip-path="url(#sf${i})"/><path class="s" d="${d}"/><path class="s" d="M${x - 10},${y + 132} H${x + 10}"/>` + T(x, y + 166, 'Stage ' + (i + 1), 'middle'); };
      UI.svg(el, DEFS + [0, 1, 2].map(i => fun(130 + i * 190, 60, i)).join('') + [0, 1].map(i => arw(140 + i * 190, 215, 270 + i * 190, 120, 't')).join('') + [0, 1, 2].map(i => arw(130 + i * 190, 18, 130 + i * 190, 52)).join('')
        + [0, 1, 2].map(i => T(140 + i * 190, 14, 'fresh solvent S', 'start', 'mu')).join('') + T(60, 110, 'Extract E', 'end') + T(60, 160, 'Raffinate R', 'end') + T(225, 250, 'raffinate → next stage', 'middle', 'mu') + T(20, 60, 'Feed F →', 'start'), '0 0 640 260');
    },
    apparatusList: ['Separating funnels (250 mL) with stands', 'Feed: acetic acid in water; solvent: isopropyl ether', 'Standard NaOH (0.1–1 N), phenolphthalein, burette, pipettes', 'Balance, mechanical shaker (optional)'],
    procedure: ['Prepare the feed (water + acetic acid) and determine its acid content by titration.', 'Single stage: put F g of feed and S g of ether in a separating funnel; shake for 10–15 min, venting frequently.', 'Allow the layers to settle completely (15–20 min). Drain the lower (raffinate) layer, weigh both layers.', 'Titrate weighed aliquots of each layer with standard NaOH using phenolphthalein.', 'Cross-current: contact the raffinate from stage 1 with fresh solvent in stage 2, and so on. Weigh and titrate both layers at every stage.', 'Compare one stage using total solvent $S_{tot}$ with N stages using $S_{tot}/N$ each.'],
    precautions: ['Vent the funnel often while shaking (ether vapour pressure is high).', 'Let the phases separate completely; do not let the interface pass into the other layer.', 'Weigh aliquots quickly — ether evaporates.'],
    bench: {
      controls: [
        { k: 'F', label: 'Feed mass F', min: 20, max: 200, step: 1, v: 100, unit: 'g' },
        { k: 'xF', label: 'Acetic acid in feed', min: 2, max: 40, step: .5, v: 20, unit: 'wt %' },
        { k: 'S', label: 'Solvent (ether) per stage', min: 10, max: 300, step: 1, v: 100, unit: 'g' },
        { k: 'n', t: 'seg', label: 'Number of cross-current stages', v: 1, opts: { 1: '1', 2: '2', 3: '3', 4: '4' } },
        { k: 'N', label: 'NaOH normality', min: .1, max: 1, step: .05, v: .5, unit: 'N' },
        { k: 'al', label: 'Aliquot mass titrated', min: 1, max: 10, step: .5, v: 5, unit: 'g' }
      ],
      cols: [{ k: 'run', l: 'Run', d: 0 }, { k: 'st', l: 'Stage', d: 0 }, { k: 'S', l: 'S (g)', d: 1 }, { k: 'mR', l: 'm<sub>R</sub> (g)', d: 2 }, { k: 'mE', l: 'm<sub>E</sub> (g)', d: 2 }, { k: 'VR', l: 'V<sub>NaOH</sub>, R (mL)', d: 2 }, { k: 'VE', l: 'V<sub>NaOH</sub>, E (mL)', d: 2 }],
      run(s, nz, rows) {
        const run = (rows.length ? rows[rows.length - 1].run : 0) + 1, out = []; let R = { c: s.xF / 100, b: 0 }, mR = s.F;
        for (let i = 1; i <= s.n; i++) {
          const M = { c: R.c * mR / (mR + s.S), b: (R.b * mR + s.S) / (mR + s.S) }, sp = C.lleSplit(M, mR + s.S);
          if (!sp) { UI.toast('Stage ' + i + ': mixture is a single phase — no extraction possible'); break; }
          out.push({ run, st: i, F: s.F, xF: s.xF, S: s.S, N: s.N, al: s.al, mR: sp.Rmass + nz.n(.2), mE: sp.Emass + nz.n(.2), VR: Math.max(0, s.al * sp.R.c / MA / s.N * 1000 + nz.n(.05)), VE: Math.max(0, s.al * sp.E.c / MA / s.N * 1000 + nz.n(.05)), th: sp });
          R = sp.R; mR = sp.Rmass;
        }
        return out;
      },
      preset: s => [{ n: 1, S: 120 }, { n: 3, S: 40 }],
      views: [{ k: 'v', t: '3d', h: 480, cam: [.6, 2.4, 6.4], target: [0, 1.8, 0] }, { k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 360 }],
      walk: [
        { t: '1 · Charge feed and solvent', d: 'The feed (water + acetic acid) goes into the separating funnel, then the ether. Ether (ρ ≈ 0.72 g/mL) floats on the aqueous feed (ρ ≈ 1.0 g/mL): two clear layers, with all the acid (orange) still in the water.', hi: ['f0'], do: S => { const st = S._st || (S._st = {}); if (st.X) { st.run = false; st.t = 2.95; } } },
        { t: '2 · Shake and vent', d: 'Shaking breaks the layers into fine droplets: a huge interfacial area, so acid molecules cross into the ether quickly. Vent often: ether has a high vapour pressure.', hi: ['f0'], do: S => { const st = S._st || (S._st = {}); if (st.X) { st.run = true; st.t = 3; } } },
        { t: '3 · Settle: extract on top, raffinate below', d: 'The droplets coalesce and the layers separate. At equilibrium the acid is shared according to the tie line: K = y/x ≈ 0.3–0.5 here, so the ether takes only part of it. The raffinate keeps the rest.', hi: ['f0'], do: S => { const st = S._st || (S._st = {}); if (st.X) { st.run = false; st.t = 7.95; } } },
        { t: '4 · Drain the raffinate; next stage gets fresh solvent', d: 'The lower layer (raffinate) is run off through the stopcock. In cross-current extraction it is contacted again with fresh ether in the next funnel, so each stage strips a further fraction of the acid that is left. (Set the number of stages to 2–4 to watch this.)', hi: ['b0', 'f1', 'f2', 'f3'], do: S => { const st = S._st || (S._st = {}); if (st.X) { st.run = true; st.t = Math.min(st.t, 8); } } },
        { t: '5 · Weigh and titrate both layers', d: 'Weigh each layer, then titrate a weighed aliquot with standard NaOH (phenolphthalein): w<sub>C</sub> = V·N·60.05/(1000·m<sub>al</sub>). Acid balance check: F·x<sub>F</sub> = Σ E·y + R<sub>N</sub>·x<sub>N</sub>.', hi: ['f0', 'b0'], do: S => { const st = S._st || (S._st = {}); if (st.X) { st.run = false; st.t = st.Tend; } } }
      ],
      view(s, V, rows, S) {
        const st = S._st || (S._st = {}), key = [s.F, s.xF, s.S, s.n].join('|');
        if (st.key !== key) { const X = xstages(s), vT = X.length ? Math.max(...X.map(q => vliq(q.mRin, q.Rin) + vliq(s.S, { a: 0, b: 1, c: 0 }))) : 0; Object.assign(st, { key, X, sv: s, vS: s.S / RHO4.e, cap: vT > 450 ? 1000 : vT > 220 ? 500 : 250, run: false, t: 0, S: null }); S._k = null; }
        st.sv = s;
        if (V.v.ok && S._k !== st.key) { S._k = st.key; V.v.clear(); if (st.X.length) sep3d(V.v, st); }
        if (!S._lv) {
          S._lv = 1; const info = h('div', { class: 'hint', style: 'margin:6px 0' }), tb = h('div'), go = h('button', { class: 'btn pri sm', onclick: () => { if (st.t >= st.Tend) st.t = 0; st.run = !st.run; st.live(); } });
          V.live.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' }, go, h('button', { class: 'btn sm', onclick: () => { st.t = st.Tend; st.run = false; st.live(); } }, '⏭ Finish all stages'), h('button', { class: 'btn sm', onclick: () => { st.t = 0; st.run = false; st.live(); } }, '↺ Reset')), info, tb);
          st.live = () => {
            const X = st.X, s2 = st.sv, r3 = x => UI.fmt(x, 3), z = x => Math.abs(x) < 1e-6 ? 0 : x;   // < 1 µg: tie-line bisection tolerance
            go.textContent = st.run ? '❚❚ Pause' : st.t >= st.Tend && X.length ? '▶ Run again' : '▶ Run extraction';
            if (!X.length) { info.innerHTML = 'Feed + solvent form a single phase (beyond the plait point): no extraction possible.'; tb.innerHTML = ''; return; }
            const L = X[X.length - 1], a0 = s2.F * s2.xF / 100, aE = X.reduce((q, r) => q + r.Emass * r.E.c, 0);
            info.innerHTML = `${X.length} stage(s) × ${UI.fmt(s2.S, 0)} g ether (${UI.fmt(st.vS, 1)} mL each) · ${st.cap} mL separating funnels · tie lines: Treybal, 20 °C · overall ${UI.fmt(100 * aE / a0, 1)} % of the acid extracted`;
            const rws = [];
            X.forEach((q, j) => { rws.push([`Stage ${j + 1}: total mass (g)`, `R${j ? j : '_F'} + S = ${r3(q.mRin)} + ${r3(s2.S)}`, `R${j + 1} + E${j + 1} = ${r3(q.Rmass)} + ${r3(q.Emass)}`, UI.fmt(z(q.mRin + s2.S - q.Rmass - q.Emass), 4)]);
              rws.push([`Stage ${j + 1}: acetic acid (g)`, `${r3(q.mRin * q.Rin.c)}`, `R·x + E·y = ${r3(q.Rmass * q.R.c)} + ${r3(q.Emass * q.E.c)}`, UI.fmt(z(q.mRin * q.Rin.c - q.Rmass * q.R.c - q.Emass * q.E.c), 4)]); });
            rws.push(['Overall acid (g)', `F·x_F = ${r3(a0)}`, `ΣE·y + R_N·x_N = ${r3(aE)} + ${r3(L.Rmass * L.R.c)}`, UI.fmt(z(a0 - aE - L.Rmass * L.R.c), 4)]);
            tb.innerHTML = ''; tb.append(UI.table(['Live balance (equilibrium stages)', 'In', 'Out', 'In − Out'], rws, [3]), h('p', { class: 'hint' }, 'Each stage: the mixing point M lies on the tie line through R and E (lever rule), so mass and acid both close. Orange dots are acid; each dot is the same mass of acid, so their share in each layer is the fraction extracted.'));
          };
        }
        st.live();
        const p = V.p; T201.triangle(p, UI, false); const P = T201.triP; let R = { c: s.xF / 100, b: 0 }, mR = s.F, acid0 = s.F * s.xF / 100, last = null, first = null;
        p.pts([P(R)], { c: 'tx', r: 5, l: 'Feed F' });
        for (let i = 1; i <= s.n; i++) { const M = { c: R.c * mR / (mR + s.S), b: (R.b * mR + s.S) / (mR + s.S) }, sp = C.lleSplit(M, mR + s.S); if (!sp) break; if (!first) first = sp;
          p.line([P(R), P({ c: 0, b: 1 })], { c: 'mu', w: 1, dash: [3, 3] }).line([P(sp.R), P(sp.E)], { c: 'c2', w: 1.6 }).pts([P(M)], { c: 'c3', r: 4 }).pts([P(sp.R)], { c: 'c1', r: 4 }).pts([P(sp.E)], { c: 'c4', r: 4 }); R = sp.R; mR = sp.Rmass; last = sp; }
        p.line([[0, 0], [0, 0]], { c: 'c2', l: 'tie line through M' }).done();
        V.ro.set(last ? [['Theory: K (stage 1)', f(first.K, 3)], ['Theory: β (stage 1)', f(first.beta, 2)], ['Final raffinate acid', f(100 * last.R.c, 2) + ' wt %'], ['Theory: % extraction', f(100 * (1 - mR * last.R.c / acid0), 1) + ' %'], ['Total solvent', f(s.S * s.n, 0) + ' g']] : [['Status', 'single phase — no split']]);
      }
    },
    calc(rows, s, el, UI) {
      const R = rows.map(r => { const xR = r.VR * r.N * MA / (1000 * r.al), yE = r.VE * r.N * MA / (1000 * r.al); return { ...r, xR, yE, K: yE / xR, aR: r.mR * xR, aE: r.mE * yE }; });
      const runs = [...new Set(R.map(r => r.run))].map(id => { const g = R.filter(r => r.run === id), L = g[g.length - 1], a0 = g[0].F * g[0].xF / 100; return { id, n: g.length, S: g[0].S * g.length, E: 100 * (1 - L.aR / a0), Eth: 100 * (1 - L.th.Rmass * L.th.R.c / a0), bal: 100 * (g.reduce((q, r) => q + r.aE, 0) + L.aR - a0) / a0 }; });
      const a = R[0];
      UI.sec(el, 'Calculations');
      sample(el, `Raffinate: $x_C = \\frac{${f(a.VR, 2)}\\times${f(a.N, 2)}\\times60.05}{1000\\times${f(a.al, 2)}} = ${f(a.xR, 4)}$ (${f(100 * a.xR, 2)} wt %). Extract: $y_C$ = ${f(a.yE, 4)}.<br>
        $K = ${f(a.yE, 4)}/${f(a.xR, 4)} = ${f(a.K, 3)}$ (tie-line value ${f(a.th.K, 3)}). Acid in raffinate = ${f(a.mR, 2)}×${f(a.xR, 4)} = ${f(a.aR, 3)} g; in extract = ${f(a.aE, 3)} g.`);
      tbl(el, ['Run', 'Stage', 'x_C raffinate', 'y_C extract', 'K = y/x', 'K tie line', 'acid in R (g)', 'acid in E (g)'], R.map(r => [r.run, r.st, f(r.xR, 4), f(r.yE, 4), f(r.K, 3), f(r.th.K, 3), f(r.aR, 3), f(r.aE, 3)]));
      UI.sec(el, 'Summary per run');
      tbl(el, ['Run', 'Stages', 'Total solvent (g)', '% extraction (expt.)', '% extraction (theory)', 'Acid balance closure %'], runs.map(q => [q.id, q.n, f(q.S, 0), f(q.E, 1), f(q.Eth, 1), f(q.bal, 2)]));
      UI.sec(el, 'Graphs');
      const xm = Math.max(.05, ...R.map(r => r.xR)) * 1.2, L = C.lle;
      UI.plotIn(el, 320).frame({ x: [0, xm], y: [0, Math.max(.05, ...R.map(r => r.yE)) * 1.3], xl: 'x_C, acid in raffinate (wt fr.)', yl: 'y_C, acid in extract (wt fr.)', xs: 'x', ys: 'y' })
        .line(L.R.map((r, i) => [r[0] / 100, L.E[i][0] / 100]), { c: 'c1', l: 'distribution curve (tie lines, 20 °C)' }).pts(R.map(r => [r.xR, r.yE]), { c: 'c2', r: 4.5, l: 'your data' }).done();
      const p = UI.plotIn(el, 420); T201.triangle(p, UI, false); R.forEach(r => p.line([T201.triP({ c: r.xR, b: r.th.R.b }), T201.triP({ c: r.yE, b: r.th.E.b })], { c: 'c2', w: 1.4 })); p.line([[0, 0], [0, 0]], { c: 'c2', l: 'measured tie lines' }).done();
      UI.sec(el, 'Result'); res(el, [['Mean K (expt.)', f(R.reduce((q, r) => q + r.K, 0) / R.length, 3)], ...runs.map(q => [`Run ${q.id}: ${q.n} stage(s), ${f(q.S, 0)} g solvent`, f(q.E, 1) + ' % extracted'])]);
    },
    discussion: ['For acetic acid/water/isopropyl ether K < 1 (≈ 0.2–0.4 at low acid), so large solvent ratios or many stages are needed.', 'With the same total solvent, more cross-current stages extract more acid, but the gain per stage diminishes and solvent use is still high — counter-current operation is more efficient.', 'K increases with acid concentration (tie lines tilt) in this system.', 'Errors: incomplete settling, mutual solubility changes layer masses, ether evaporation, titration end-point.'],
    viva: [
      { q: 'What properties should a good extraction solvent have?', a: 'High selectivity and distribution coefficient, low mutual solubility with the feed solvent, density difference for settling, adequate interfacial tension, easy recovery (different boiling point), low toxicity, cost, flammability and corrosion.' },
      { q: 'Define distribution coefficient and selectivity.', a: '$K = y_C/x_C$ (solute fraction in extract over raffinate); $\\beta = (y_C/y_A)/(x_C/x_A)$ — the solvent’s preference for solute over the feed solvent.' },
      { q: 'Why is several smaller portions of solvent better than one large portion?', a: 'Each fresh portion contacts a raffinate that is no longer in equilibrium with fresh solvent, maintaining a driving force; for constant K the remaining fraction is $1/(1+KS/NA)^N$, which decreases with N.' },
      { q: 'When is extraction preferred over distillation?', a: 'For heat-sensitive materials, very low relative volatility or azeotropes, dilute high-boiling solutes in water, or when the solute is non-volatile.' },
      { q: 'What is the role of phenolphthalein?', a: 'Indicator for the weak acid – strong base titration; end-point in the pH 8.3–10 range (colourless → pink).' },
      { q: 'What is the lever rule?', a: 'For a mixture M split into E and R on a tie line, $E/R = \\overline{MR}/\\overline{ME}$; masses are inversely proportional to the distances to M.' }
    ]
  };

  /* ======================= 6 · Adsorption isotherm (acetic acid / activated carbon) ======================= */
  const sips = (c, T) => { const Tk = T + 273.15, qm = 3.2 * (1 - .004 * (T - 25)), K = 6 * Math.exp(1800 * (1 / Tk - 1 / 298.15)), u = Math.pow(K * Math.max(c, 0), .75); return qm * u / (1 + u); }; // mmol/g, c mol/L
  function batchAds(C0, Vml, m, T, tmin) { // LDF kinetics, returns Ce (mol/L), q (mmol/g)
    const k = .07 * Math.exp(-2000 * (1 / (T + 273.15) - 1 / 298.15)); let q = 0; const dt = .25, cOf = q => C0 - m * q / Vml, dq = q => k * (sips(cOf(q), T) - q);
    for (let t = 0; t < tmin; t += dt) { const k1 = dq(q), k2 = dq(q + dt / 2 * k1), k3 = dq(q + dt / 2 * k2), k4 = dq(q + dt * k3); q += dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4); }
    return { Ce: cOf(q), q };
  }
  /* 6 · 3-D bench: stoppered flask on an orbital shaker → filter funnel → NaOH titration of the filtrate.
     Orange dots = acetic acid molecules (fixed count), black grains = charcoal. The share of dots stuck to grains is
     the adsorbed fraction m·q/(C₀V) from the same LDF + Sips model the readings use. */
  function ads3d(v, st) {
    const { cstream } = T201.fx3, hsh = (i, k) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); }, OFF = [0, -50, 0];
    const x0 = -1.9, Rb = .55, Rn = .14, H = .9, yb = .51, xf = .35, yf = 2.15, xt = 2.3, ybt = .34;
    const coneLiq = (cx, y0, R1, R2, Hc, c, op, parent) => {
      const m = v.mat(c, { op }), me = v.add(new THREE.CylinderGeometry(R1, R1, .01, 32), m, [cx, y0, 0], null, parent); let hL = -1;
      const rAt = y => R1 - (R1 - R2) * clamp(y / Hc, 0, 1), vol = y => Math.PI * y / 3 * (R1 * R1 + R1 * rAt(y) + rAt(y) ** 2), VF = vol(Hc);
      return { m, rAt, set(fr) { me.visible = fr > .003; if (!me.visible) return 0; const hh = C.bisect(y => vol(y) / VF - clamp(fr, .004, .98), 1e-4, Hc, 1e-6);
        if (Math.abs(hh - hL) > .004) { hL = hh; me.geometry.dispose(); me.geometry = new THREE.CylinderGeometry(rAt(hh) - .012, R1 - .012, hh, 32); me.position.y = y0 + hh / 2; } return hh; } };
    };
    v.box(6.6, .16, 2.4, 0x9b7653, [.3, -.08, 0]);
    // orbital shaker with thermostat display; the platform group carries the flask
    v.box(1.8, .42, 1.4, 0x56606b, [x0, .21, 0]); v.box(.55, .16, .02, 0x1d2b36, [x0 + .45, .23, .71]); v.cyl(.06, .04, 0xdddddd, [x0 - .5, .23, .72], { rot: [Math.PI / 2, 0, 0] });
    const g = new THREE.Group(); g.position.set(x0, .45, 0); v.root.add(g);
    v.box(1.6, .05, 1.2, 0x8a939c, [0, 0, 0], { parent: g }); [-1, 1].forEach(s => v.cyl(.025, .5, MET, [s * .62, .28, 0], { parent: g })); v.box(1.3, .03, .03, MET, [0, .5, 0], { parent: g });
    v.cyl(Rb, H, GLS, [0, .06 + H / 2, 0], { r2: Rn, op: .22, ds: 1, open: 1, parent: g }); v.cyl(Rn, .3, GLS, [0, .06 + H + .15, 0], { op: .2, ds: 1, open: 1, parent: g });
    const stop = v.cyl(Rn + .01, .14, 0x8b5a2b, [0, .06 + H + .32, 0], { r2: Rn + .04, parent: g });
    const fl = coneLiq(0, .06, Rb, Rn, H, 0xd7ecf6, .38, g);
    // filter funnel with paper on a stand, receiver flask
    v.cyl(.035, 3, MET, [xf - .75, 1.5, -.35]); v.box(.8, .03, .03, MET, [xf - .38, yf - .25, -.35]); v.tor(.24, .02, MET, [xf, yf - .25, 0]);
    v.cyl(.05, .55, GLS, [xf, yf, 0], { r2: .46, op: .25, ds: 1, open: 1 }); v.cyl(.03, .45, GLS, [xf, yf - .5, 0], { op: .35 });
    v.cyl(.04, .5, 0xffffff, [xf, yf + .02, 0], { r2: .4, op: .55, ds: 1, open: 1 });
    const cake = v.cyl(.05, .2, 0x1b1b1b, [xf, yf - .14, 0], { r2: .19 });
    v.cyl(.42, .75, GLS, [xf, .375, 0], { r2: .12, op: .2, ds: 1, open: 1 }); v.cyl(.12, .25, GLS, [xf, .875, 0], { op: .2, ds: 1, open: 1 });
    const rl = coneLiq(xf, 0, .42, .12, .75, 0xd7ecf6, .4);
    // burette on a stand over a conical flask on a white tile
    const yt = 4.1, ybu = 1.75, rbu = .07;
    v.box(1, .05, .7, 0x444444, [xt + .9, .03, 0]); v.cyl(.03, 4.4, MET, [xt + .9, 2.2, 0]); v.box(.95, .06, .06, MET, [xt + .45, 3.3, 0]); v.box(1, .03, .8, 0xf4f4f4, [xt, .015, 0]);
    v.cyl(rbu, yt - ybu, GLS, [xt, (yt + ybu) / 2, 0], { op: .2, ds: 1, open: 1 }); const bl = v.cyl(rbu - .012, 1, 0xeef4f8, [xt, 3, 0], { op: .6 });
    for (let k = 0; k <= 10; k++) v.box(.05, .006, .01, 0x333333, [xt + .07, yt - .15 - k * (yt - ybu - .3) / 10, .045]);
    v.cyl(.02, .25, GLS, [xt, ybu - .15, 0], { op: .4 }); const sc = v.box(.2, .04, .04, 0xc0392b, [xt, ybu - .3, .05]); v.cyl(.012, .25, GLS, [xt, ybu - .47, 0], { op: .5 });
    v.cyl(.45, .75, GLS, [xt, ybt + .375, 0], { r2: .13, op: .22, ds: 1, open: 1 }); v.cyl(.13, .2, GLS, [xt, ybt + .85, 0], { op: .2, ds: 1, open: 1 });
    const tl = coneLiq(xt, ybt, .45, .13, .75, 0xf3f3f3, .4), PK = new THREE.Color(1, .55, .78), CL = new THREE.Color(.95, .95, .95);
    // particles: charcoal grains and acid molecules
    const NG = Math.round(clamp(10 * st.m, 6, 40)), NA = 140, gp = (j, t) => {   // grain j position (world)
      if (hsh(j, 21) < st.fp) { const a = 6.28 * hsh(j, 22), r = .03 + .14 * hsh(j, 23); return [xf + r * Math.cos(a), yf - .2 + r * .9 + .04 * hsh(j, 24), r * Math.sin(a)]; }
      const a = 6.28 * hsh(j, 1) + st.ph * (.5 + .5 * hsh(j, 2)), y = .03 + (st.on ? .1 + .55 * hsh(j, 4) : .02 * hsh(j, 4)) * st.hh, r = (fl.rAt(y) - .08) * Math.sqrt(hsh(j, 3));
      return [g.position.x + r * Math.cos(a), g.position.y + .06 + y, g.position.z + r * Math.sin(a)];
    };
    cstream(v, NG, .13, (u, j) => gp(j), () => [.08, .08, .08], .1);
    cstream(v, NA, .07, (u, i) => {
      if (i < NA * st.fa) { const p = gp(i % NG), a = 6.28 * hsh(i, 31), b = 3.14 * hsh(i, 32), d = .055; return [p[0] + d * Math.cos(a) * Math.sin(b), p[1] + d * Math.cos(b), p[2] + d * Math.sin(a) * Math.sin(b)]; }
      if (hsh(i, 9) < st.fp) { const y = (st.rh - .04) * hsh(i, 13) + .02, a = 6.28 * (u + hsh(i, 5)), r = (rl.rAt(y) - .06) * Math.sqrt(hsh(i, 7)); return st.rh > .03 ? [xf + r * Math.cos(a), y, r * Math.sin(a)] : OFF; }
      const y = .03 + (st.hh - .06) * hsh(i, 13), a = 6.28 * (u + hsh(i, 5)) + st.ph * .3, r = (fl.rAt(y) - .06) * Math.sqrt(hsh(i, 7));
      return st.hh > .05 ? [g.position.x + r * Math.cos(a), g.position.y + .06 + y, g.position.z + r * Math.sin(a)] : OFF;
    }, () => [1, .5, .08], .05);
    const yM = yb + H + .3, pour = (u, i) => [x0 + (xf - x0) * u + (hsh(i, 3) - .5) * .03, yM + (yf + .3 - yM) * u + .6 * Math.sin(Math.PI * u), 0];
    cstream(v, 40, .06, (u, i) => st.ph2 === 'pour' ? pour(u, i) : OFF, () => [.8, .9, .97], 1.2);
    cstream(v, 10, .06, (u, i) => st.fp > 0 && st.fp < 1 && i < 3 ? [xf, yf - .72 - u * (yf - .72 - st.rh), 0] : OFF, () => [.8, .9, .97], 1.3);
    const tip = ybu - .6; cstream(v, 20, .07, (u, i) => !st.flow || (st.flow === 'drop' && i > 1) ? OFF : [xt + (hsh(i, 3) - .5) * .02, tip - u * (tip - ybt - st.th), 0], () => [.9, .95, 1], 1.4);
    const tg = { shk: v.tag('', [x0 + .45, .3, .72], 'shk'), flask: v.tag('', [x0, 2.0, 0], 'flask'), fun: v.tag('', [xf + .45, yf + .2, 0], 'fun'), rec: v.tag('', [xf - .3, .45, 0], 'rec'), bur: v.tag('', [xt + rbu, 3.7, 0], 'bur'), tf: v.tag('', [xt + .35, .03, .4], 'tf') };
    let acc = 0, lastW = 0, wt = 0;
    v.tick((t, dt) => {
      const ww = v.el.clientWidth; if (ww && ww !== lastW) { lastW = ww; const k = clamp(640 / ww, 1, 2.3); v.look([.4, 2.6 + .4 * (k - 1), 7.3 * k], [.4, 1.95, 0]); }
      if (st.on) { wt += dt * 9; st.ph += dt * 1.6; st.t = Math.min(180, st.t + dt * 2); if (st.t >= 180) st.on = false; }
      g.position.x = x0 + (st.on ? .05 * Math.cos(wt) : 0); g.position.z = st.on ? .05 * Math.sin(wt) : 0;
      if (st.ph2 === 'pour') { st.fp = Math.min(1, st.fp + dt / 6); if (st.fp >= 1) st.ph2 = 'done'; }
      stop.visible = st.fp === 0; cake.visible = st.fp > .05; cake.scale.set(1, clamp(st.fp, .05, 1), 1);
      st.hh = fl.set(st.V / 300 * (1 - st.fp)); st.rh = rl.set(st.V / 300 * st.fp * .92);
      if (st.flow) { st.VT += dt * (st.flow === 'fast' ? 1 : .1); if (st.flow === 'fast' && st.VT > st.Veq - 1) st.flow = 'drop'; if (st.VT >= st.Veq + .05) { st.VT = st.Veq + .05; st.flow = 0; } if (st.VT > 50) { st.flow = 0; UI.toast('Burette empty — use a smaller aliquot or stronger NaOH'); } }
      st.th = tl.set(st.ph2 === 'titr' ? (st.Va + st.VT) / 120 : 0); tl.m.color.copy(st.VT >= st.Veq && st.ph2 === 'titr' ? PK : CL); tl.m.opacity = st.VT >= st.Veq && st.ph2 === 'titr' ? .75 : .4;
      sc.rotation.z = st.flow === 'fast' ? Math.PI / 2 : st.flow === 'drop' ? Math.PI / 5 : 0;
      const fr = 1 - (st.VT % 50) / 50; bl.scale.y = Math.max(.002, (yt - ybu - .2) * fr); bl.position.y = ybu + .05 + bl.scale.y / 2;
      acc += dt; if (acc > .2) { acc = 0; st.calc();
        setTag(tg.shk, `Shaker ${UI.fmt(st.T, 1)} °C · ${st.on ? '150 rpm' : 'stopped'} · t = ${UI.fmt(st.t, 1)} min`);
        setTag(tg.flask, st.fp < 1 ? `C = ${UI.fmt(st.Ce, 4)} mol/L · q = ${UI.fmt(st.q, 3)} mmol/g · ${UI.fmt(100 * st.fa, 1)} % adsorbed` : '');
        setTag(tg.fun, st.fp > 0 ? `Filter: charcoal (with its adsorbed acid) retained` : '');
        setTag(tg.rec, st.fp > 0 ? `Filtrate C_e = ${UI.fmt(st.Ce, 4)} mol/L` : '');
        setTag(tg.bur, `NaOH ${UI.fmt(st.Nb, 3)} N · ${UI.fmt(st.VT, 2)} mL run out`);
        setTag(tg.tf, st.ph2 === 'titr' ? (st.VT >= st.Veq ? `End point: pale pink persists (${UI.fmt(st.VT, 2)} mL)` : `${UI.fmt(st.Va, 0)} mL filtrate + phenolphthalein: colourless`) : '');
        st.live && st.live(); }
    });
  }
  const L6 = {
    refs: ["<i>Freundlich, H.</i> (1906) Über die Adsorption in Lösungen. <i>Z. Phys. Chem.</i> 57, 385–470.", "<i>Langmuir, I.</i> (1918) The adsorption of gases on plane surfaces of glass, mica and platinum. <i>J. Am. Chem. Soc.</i> 40, 1361–1403.", "<i>Garland, C.W., Nibler, J.W. & Shoemaker, D.P.</i> (2009) <i>Experiments in Physical Chemistry</i>, 8th ed., McGraw-Hill. (adsorption from solution)", "<i>Do, D.D.</i> (1998) <i>Adsorption Analysis: Equilibria and Kinetics</i>, Imperial College Press.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 11.", "<i>Mendham, J., Denney, R.C., Barnes, J.D. & Thomas, M.J.K.</i> (2000) <i>Vogel’s Textbook of Quantitative Chemical Analysis</i>, 6th ed., Prentice Hall. (titration practice)"],
    id: 'adsorption-isotherm', title: 'Adsorption isotherm — acetic acid on activated charcoal', tags: 'adsorption isotherm freundlich langmuir activated carbon charcoal acetic acid titration equilibrium',
    blurb: 'Batch adsorption at several concentrations; Freundlich and Langmuir fits from NaOH titrations.',
    aim: 'To study the adsorption of acetic acid from aqueous solution on <b>activated charcoal</b> at constant temperature, and to test the <b>Freundlich</b> and <b>Langmuir</b> isotherms.',
    objectives: ['Determine equilibrium uptake $q_e = x/m$ at different initial concentrations by titration.', 'Fit linearised Freundlich and Langmuir equations and find their constants.', 'Decide which isotherm represents the data better (R²).', 'Optionally, study the effect of temperature and contact time.'],
    theory: `<p><b>Adsorption</b> is the accumulation of solute molecules on a solid surface. Activated charcoal (surface area 500–1500 m²/g) adsorbs organic acids mainly by physical adsorption. When a mass $m$ of adsorbent is shaken with volume $V$ of solution of initial concentration $C_0$, solute transfers to the solid until equilibrium is reached at concentration $C_e$. A solute balance gives the amount adsorbed per gram, $q_e$. The relation $q_e(C_e)$ at constant temperature is the <b>adsorption isotherm</b>.</p>
<p>The <b>Freundlich</b> isotherm is empirical and describes heterogeneous surfaces: a straight line of $\\log q_e$ vs $\\log C_e$ with slope $1/n$ ($n > 1$ = favourable). The <b>Langmuir</b> isotherm assumes monolayer coverage on identical sites with no interaction; its linear form $C_e/q_e$ vs $C_e$ gives the monolayer capacity $q_m$ and the affinity constant $K_L$. The separation factor $R_L = 1/(1+K_LC_0)$ between 0 and 1 indicates favourable adsorption. Physical adsorption is exothermic, so uptake decreases with temperature.</p>`,
    eqs: [
      { n: 'Concentration by titration', m: 'C=\\frac{N_{NaOH}V_{NaOH}}{V_{aliquot}}' },
      { n: 'Uptake', m: 'q_e=\\frac{x}{m}=\\frac{(C_0-C_e)V}{m}' },
      { n: 'Freundlich', m: 'q_e=K_FC_e^{1/n}\\;\\Rightarrow\\;\\log q_e=\\log K_F+\\tfrac1n\\log C_e' },
      { n: 'Langmuir', m: 'q_e=\\frac{q_mK_LC_e}{1+K_LC_e}\\;\\Rightarrow\\;\\frac{C_e}{q_e}=\\frac{1}{q_mK_L}+\\frac{C_e}{q_m}' },
      { n: 'Separation factor', m: 'R_L=\\frac{1}{1+K_LC_0}' }
    ],
    apparatus(el, UI) {
      UI.svg(el, DEFS + `<rect class="s" x="30" y="230" width="330" height="26" rx="5"/>` + [0, 1, 2, 3, 4].map(i => conical(70 + i * 62, 228, 24, 70, .5) + `<rect class="pk" x="${58 + i * 62}" y="${216}" width="24" height="10"/>`).join('') + T(195, 278, 'Orbital shaker / thermostat (T, t)', 'middle', 'mu')
        + T(195, 140, 'flasks: V mL acid of C₀ + m g charcoal', 'middle') + `<path class="s" d="M420,120 H480 L458,160 V190 H442 V160 Z"/>` + arw(450, 196, 450, 220) + conical(450, 300, 26, 70, .4) + T(490, 140, 'filter', 'start', 'mu')
        + burette(560, 40, 150, .6) + conical(560, 320, 26, 60, .4, 'lq2') + T(580, 90, 'NaOH', 'start') + T(560, 336, 'titrate filtrate', 'middle', 'mu'), '0 0 640 345');
    },
    apparatusList: ['Stoppered conical flasks (250 mL), orbital shaker / thermostat bath', 'Activated charcoal (dried), acetic acid solutions 0.05–0.6 N', 'Standard NaOH (≈ 0.1 N), phenolphthalein, burette, pipettes', 'Filter funnels and paper, analytical balance'],
    procedure: ['Prepare acetic acid solutions of different concentrations (e.g. 0.05–0.6 N) and titrate a 10 mL aliquot of each with NaOH to get $C_0$.', 'Weigh equal masses of charcoal (e.g. 2 g) into stoppered flasks; add V = 100 mL of each solution.', 'Shake at constant temperature for at least 45–60 min to reach equilibrium.', 'Filter (discard the first few mL of filtrate — the paper adsorbs some acid).', 'Titrate a 10 mL aliquot of each filtrate with NaOH to obtain $C_e$.', 'Calculate $q_e$, plot the isotherm and the linearised forms.'],
    precautions: ['Use dry charcoal of uniform particle size, weighed accurately.', 'Allow sufficient contact time — check by repeating one flask at a longer time.', 'Keep temperature constant: adsorption is exothermic.'],
    bench: {
      controls: [
        { k: 'C0', label: 'Initial acid concentration C₀', min: .02, max: 1, step: .01, v: .2, unit: 'N' },
        { k: 'V', label: 'Solution volume V', min: 25, max: 250, step: 5, v: 100, unit: 'mL' },
        { k: 'm', label: 'Charcoal mass m', min: .2, max: 5, step: .05, v: 2, unit: 'g' },
        { k: 'T', label: 'Temperature', min: 15, max: 50, step: .5, v: 30, unit: '°C' },
        { k: 't', label: 'Shaking time', min: 2, max: 180, step: 1, v: 60, unit: 'min' },
        { k: 'Nb', label: 'NaOH normality', min: .05, max: .5, step: .01, v: .1, unit: 'N' },
        { k: 'Va', label: 'Aliquot titrated', min: 5, max: 25, step: 1, v: 10, unit: 'mL' }
      ],
      cols: [{ k: 'C0', l: 'C<sub>0</sub> nominal (N)', d: 3 }, { k: 'm', l: 'm (g)', d: 3 }, { k: 'V', l: 'V (mL)', d: 0 }, { k: 'T', l: 'T (°C)', d: 1 }, { k: 't', l: 't (min)', d: 0 }, { k: 'V1', l: 'titre before (mL)', d: 2 }, { k: 'V2', l: 'titre after (mL)', d: 2 }],
      run(s, nz) {
        const b = batchAds(s.C0, s.V, s.m, s.T, s.t), V1 = s.C0 * s.Va / s.Nb, V2 = b.Ce * s.Va / s.Nb;
        if (V1 > 50) UI.toast('Titre exceeds a 50 mL burette — use a smaller aliquot or stronger NaOH');
        return { C0: s.C0, m: s.m, V: s.V, T: s.T, t: s.t, Nb: s.Nb, Va: s.Va, V1: V1 + nz.n(.05), V2: Math.max(0, V2 + nz.n(.05)) };
      },
      preset: () => [.05, .1, .15, .2, .3, .4, .5, .6].map(C0 => ({ C0 })),
      views: [{ k: 'v', t: '3d', h: 480, cam: [.4, 2.6, 7.3], target: [.4, 1.95, 0] }, { k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 300 }],
      walk: [
        { t: '1 · Standardise the stock acid (C₀)', d: 'Before any charcoal is added, a V<sub>a</sub> aliquot of the stock acid is titrated with standard NaOH (phenolphthalein, colourless → pale pink). C₀ = N·V₁/V<sub>a</sub>. Every orange dot in the flask is one share of this acid.', hi: ['bur'], do: S => { const st = S._st || (S._st = {}); st.reset && st.reset(); } },
        { t: '2 · Weigh charcoal, add V mL of acid, stopper', d: 'A weighed mass m of dry activated charcoal (black grains) goes into a stoppered conical flask with V mL of acid. The stopper stops evaporation of acetic acid. The flask sits on an orbital shaker held at constant temperature.', hi: ['flask', 'shk'], do: S => { const st = S._st || (S._st = {}); st.reset && st.reset(); } },
        { t: '3 · Shake: acid moves onto the charcoal', d: 'Shaking keeps the grains suspended and thins the liquid film around them. Acid molecules diffuse through the film and into the pores, where they are held by weak van der Waals forces (physisorption, exothermic). Watch orange dots attach to the grains while C in the solution falls.', hi: ['flask', 'shk'], do: S => { const st = S._st || (S._st = {}); if (st.reset) { st.reset(); st.t = 8; st.on = true; } } },
        { t: '4 · Approach to equilibrium', d: 'Uptake follows the linear-driving-force law dq/dt = k(q* − q), k ≈ 0.07 min⁻¹ at 25 °C, so about 95 % of q<sub>e</sub> is reached after ≈ 3/k ≈ 45 min. Adsorption and desorption then balance: q stops rising and C stops falling. That is why the procedure asks for 45–60 min.', hi: ['flask'], do: S => { const st = S._st || (S._st = {}); if (st.reset) { st.reset(); st.t = 60; st.on = true; } } },
        { t: '5 · Filter, discard the first few mL', d: 'The suspension is poured through filter paper. The charcoal and the acid it holds stay on the paper; the clear filtrate keeps the equilibrium concentration C<sub>e</sub>. The first few mL are thrown away because the paper itself adsorbs a little acid.', hi: ['fun', 'rec'], do: S => { const st = S._st || (S._st = {}); if (st.reset) { st.reset(); st.t = 60; st.calc(); st.ph2 = 'pour'; } } },
        { t: '6 · Titrate the filtrate → C<sub>e</sub> and q<sub>e</sub>', d: 'A V<sub>a</sub> aliquot of filtrate is titrated to the first permanent pink: C<sub>e</sub> = N·V₂/V<sub>a</sub>. The acid balance gives q<sub>e</sub> = (C₀ − C<sub>e</sub>)V/m. Record, then repeat with other C₀ (or Load typical set) to build the isotherm.', hi: ['bur', 'tf'], do: S => { const st = S._st || (S._st = {}); if (st.reset) { st.reset(); st.t = 60; st.calc(); Object.assign(st, { fp: 1, ph2: 'titr', VT: Math.max(0, st.Veq - 1.5), flow: 'drop' }); } } }
      ],
      view(s, V, rows, S) {
        const b = batchAds(s.C0, s.V, s.m, s.T, s.t), be = batchAds(s.C0, s.V, s.m, s.T, 600), st = S._st || (S._st = {}), key = [s.C0, s.V, s.m, s.T, s.Nb, s.Va].join('|');
        if (st.key !== key) {
          Object.assign(st, { key, C0: s.C0, V: s.V, m: s.m, T: s.T, Nb: s.Nb, Va: s.Va, qe: be.q });
          st.calc = () => { const r = batchAds(st.C0, st.V, st.m, st.T, st.t); st.q = r.q; st.Ce = r.Ce; st.fa = st.m * r.q / (st.C0 * st.V); st.Veq = r.Ce * st.Va / st.Nb; };
          st.reset = () => { Object.assign(st, { t: 0, on: false, ph: 0, ph2: 'shake', fp: 0, VT: 0, flow: 0, hh: 0, rh: 0, th: 0 }); st.calc(); };
          st.reset(); S._k = null;
        }
        if (V.v.ok && S._k !== st.key) { S._k = st.key; V.v.clear(); ads3d(V.v, st); }
        if (!S._lv) {
          S._lv = 1; const info = h('div', { class: 'hint', style: 'margin:6px 0' }), tb = h('div'), bt = (t, fn, c = 'btn sm') => h('button', { class: c, onclick: () => { fn(); st.calc(); st.live(); } }, t);
          V.live.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' },
            bt('▶ Shake / ⏸ pause', () => { if (st.ph2 === 'shake') st.on = !st.on; }, 'btn pri sm'), bt('⏭ +15 min', () => { if (st.ph2 === 'shake') st.t = Math.min(180, st.t + 15); }),
            h('button', { class: 'btn sm', onclick: () => S.set('t', clamp(Math.round(st.t), 2, 180)) }, '⏱ Shaking time = clock'),
            bt('⏹ Stop & filter', () => { if (st.ph2 === 'shake') Object.assign(st, { on: false, ph2: 'pour' }); }),
            bt('💧 Titrate filtrate', () => { if (st.ph2 === 'done' || st.ph2 === 'titr') Object.assign(st, { ph2: 'titr', flow: st.VT < st.Veq ? 'fast' : 0 }); else UI.toast('Filter the flask first'); }),
            bt('↺ Fresh flask', () => st.reset())), info, tb);
          let lastT = -1;
          st.live = () => {
            const r4 = x => UI.fmt(x, 4), nIn = st.C0 * st.V, nL = st.Ce * st.V, nS = st.m * st.q, z = x => Math.abs(x) < 1e-9 ? '0' : UI.fmt(x, 6), nA = st.Ce * st.Va, nB = st.Nb * st.VT;
            info.innerHTML = `Shaking clock <b>t = ${UI.fmt(st.t, 1)} min</b> (${st.on ? 'shaking, 2 min per second' : st.ph2 === 'shake' ? 'paused' : 'stopped'}) · C(t) = ${r4(st.Ce)} mol/L · q(t) = ${r4(st.q)} mmol/g · <b>${UI.fmt(100 * st.fa, 1)} %</b> of the acid is on the charcoal · approach to equilibrium ${UI.fmt(100 * st.q / st.qe, 1)} %` + (st.ph2 === 'titr' ? ` · titre ${UI.fmt(st.VT, 2)} mL${st.VT >= st.Veq ? ' — <b>end point</b>' : ''}` : '');
            const R = [['Acetic acid (mmol)', `C₀·V = ${r4(st.C0)} × ${UI.fmt(st.V, 0)} = ${r4(nIn)}`, `solution C·V + charcoal m·q = ${r4(nL)} + ${r4(nS)}`, z(nIn - nL - nS)]];
            if (st.ph2 === 'titr') R.push(['Titration of aliquot (mmol)', `acid C_e·V_a = ${r4(nA)}`, `NaOH N·V = ${UI.fmt(st.Nb, 3)} × ${UI.fmt(st.VT, 2)} = ${r4(nB)}`, st.VT >= st.Veq ? '0 (end point)' : `${r4(nA - nB)} acid left`]);
            tb.innerHTML = ''; tb.append(UI.table(['Live balance', 'In', 'Out', 'In − Out'], R, [3]));
            const tt = Math.round(st.t / 2); if (tt !== lastT && V.p && st.sv) { lastT = tt; st.plot(); }
          };
        }
        st.sv = s;
        st.plot = () => { const s = st.sv, tr = []; for (let t = 0; t <= 120; t += 4) tr.push([t, batchAds(s.C0, s.V, s.m, s.T, t).q]);
          const p = V.p.frame({ x: [0, 120], y: [0, st.qe * 1.15], xl: 'Shaking time (min)', yl: 'q (mmol/g)', xs: 't', ys: 'q' }).line(tr, { c: 'c1', l: 'uptake vs time (LDF kinetics)' }).hl(st.qe, { c: 'c3', l: 'equilibrium' }).vl(Math.min(s.t, 120), { c: 'c2', l: 'recorded t' });
          if (st.t > 0) p.pts([[Math.min(st.t, 120), st.q]], { c: 'c5', r: 5, l: 'flask now' }); p.done(); };
        st.live(); st.plot();
        V.ro.set([['Theory: $C_e$ after shaking', f(b.Ce, 4) + ' mol/L'], ['Theory: $q$ after shaking', f(b.q, 4) + ' mmol/g'], ['Equilibrium $q_e$ (t → ∞)', f(be.q, 4) + ' mmol/g'], ['Approach to equilibrium', f(100 * b.q / be.q, 1) + ' %', b.q / be.q > .97 ? 'ok' : 'warn'], ['Titre before / after', f(s.C0 * s.Va / s.Nb, 2) + ' / ' + f(b.Ce * s.Va / s.Nb, 2) + ' mL']]);
      }
    },
    calc(rows, s, el, UI) {
      const R = rows.map(r => { const C0 = r.Nb * r.V1 / r.Va, Ce = r.Nb * r.V2 / r.Va, x = (C0 - Ce) * r.V; return { ...r, C0m: C0, Ce, x, q: x / r.m, qg: x * MA / 1000 / r.m }; }).filter(r => r.q > 0 && r.Ce > 0);
      if (!R.length) return UI.note(el, 'No usable readings (uptake must be positive).', 'warn');
      const a = R[0];
      UI.sec(el, 'Calculations');
      sample(el, `$C_0 = ${f(a.Nb, 3)}\\times${f(a.V1, 2)}/${f(a.Va, 1)} = ${f(a.C0m, 4)}$ N; $C_e = ${f(a.Nb, 3)}\\times${f(a.V2, 2)}/${f(a.Va, 1)} = ${f(a.Ce, 4)}$ N.<br>
        $x = (C_0-C_e)V = (${f(a.C0m, 4)}-${f(a.Ce, 4)})\\times${f(a.V, 0)} = ${f(a.x, 4)}$ mmol; $q_e = x/m = ${f(a.x, 4)}/${f(a.m, 3)} = ${f(a.q, 4)}$ mmol/g (${f(a.qg * 1000, 2)} mg/g).<br>
        $\\log C_e$ = ${f(Math.log10(a.Ce), 4)}, $\\log q_e$ = ${f(Math.log10(a.q), 4)}, $C_e/q_e$ = ${f(a.Ce / a.q, 4)} g/L.`);
      tbl(el, ['#', 'T (°C)', 'C₀ (N)', 'Cₑ (N)', 'x (mmol)', 'qₑ (mmol/g)', 'log Cₑ', 'log qₑ', 'Cₑ/qₑ (g/L)'], R.map((r, i) => [i + 1, f(r.T, 1), f(r.C0m, 4), f(r.Ce, 4), f(r.x, 4), f(r.q, 4), f(Math.log10(r.Ce), 4), f(Math.log10(r.q), 4), f(r.Ce / r.q, 4)]));
      if (R.some(r => r.t < 40)) UI.note(el, 'Some flasks were shaken < 40 min — they may not have reached equilibrium, which biases the isotherm low.', 'warn');
      const Ts = [...new Set(R.map(r => r.T))], cols = ['c1', 'c2', 'c3', 'c4', 'c5'], out = [], fits = [];
      for (const T of Ts) { const g = R.filter(r => r.T === T); if (g.length < 3) continue;
        const Fr = C.linfit(g.map(r => Math.log10(r.Ce)), g.map(r => Math.log10(r.q))), La = C.linfit(g.map(r => r.Ce), g.map(r => r.Ce / r.q)), qm = 1 / La.b, KL = La.b / La.a;
        fits.push({ T, g, KF: Math.pow(10, Fr.a), n: 1 / Fr.b, rF: Fr.r2, qm, KL, rL: La.r2, Fr, La }); }
      UI.sec(el, 'Graphs');
      const cmax = Math.max(...R.map(r => r.Ce)) * 1.1, qmax = Math.max(...R.map(r => r.q)) * 1.25;
      const p = UI.plotIn(el).frame({ x: [0, cmax], y: [0, qmax], xl: 'Cₑ (mol/L)', yl: 'qₑ (mmol/g)', xs: 'Cₑ', ys: 'qₑ' });
      Ts.forEach((T, i) => p.pts(R.filter(r => r.T === T).map(r => [r.Ce, r.q]), { c: cols[i % 5], r: 4.5, l: `data ${T} °C` }));
      fits.forEach((F, i) => { const c = cols[Ts.indexOf(F.T) % 5]; p.fn(x => C.freundlich(x, F.KF, F.n), cmax / 200, cmax, { c, w: 1.4, l: i ? null : 'Freundlich fit' }); p.fn(x => C.langmuir(x, F.qm, F.KL), 0, cmax, { c, w: 1.4, dash: [5, 4], l: i ? null : 'Langmuir fit' }); }); p.done();
      if (fits.length) {
        const row = h('div', { class: 'grid g2' }); el.append(row);
        const lx = R.map(r => Math.log10(r.Ce)), ly = R.map(r => Math.log10(r.q)), p2 = UI.plotIn(row, 280).frame({ x: [Math.min(...lx) - .1, Math.max(...lx) + .1], y: [Math.min(...ly) - .1, Math.max(...ly) + .1], xl: 'log Cₑ', yl: 'log qₑ', xs: 'log C', ys: 'log q' });
        fits.forEach(F => { const c = cols[Ts.indexOf(F.T) % 5]; p2.pts(F.g.map(r => [Math.log10(r.Ce), Math.log10(r.q)]), { c }).fn(x => F.Fr.a + F.Fr.b * x, Math.min(...lx) - .1, Math.max(...lx) + .1, { c, w: 1.2, l: `Freundlich ${F.T} °C` }); }); p2.done();
        const p3 = UI.plotIn(row, 280).frame({ x: [0, cmax], y: [0, Math.max(...R.map(r => r.Ce / r.q)) * 1.2], xl: 'Cₑ (mol/L)', yl: 'Cₑ/qₑ (g/L)', xs: 'C', ys: 'C/q' });
        fits.forEach(F => { const c = cols[Ts.indexOf(F.T) % 5]; p3.pts(F.g.map(r => [r.Ce, r.Ce / r.q]), { c }).fn(x => F.La.a + F.La.b * x, 0, cmax, { c, w: 1.2, l: `Langmuir ${F.T} °C` }); }); p3.done();
        UI.sec(el, 'Result');
        tbl(el, ['T (°C)', 'K_F (mmol/g·(L/mol)^1/n)', 'n', 'R² Freundlich', 'q_m (mmol/g)', 'K_L (L/mol)', 'R² Langmuir', 'R_L range', 'Better fit'], fits.map(F => [f(F.T, 1), f(F.KF, 4), f(F.n, 3), f(F.rF, 4), f(F.qm, 4), f(F.KL, 3), f(F.rL, 4), f(1 / (1 + F.KL * Math.max(...F.g.map(r => r.C0m))), 3) + '–' + f(1 / (1 + F.KL * Math.min(...F.g.map(r => r.C0m))), 3), F.rF > F.rL ? 'Freundlich' : 'Langmuir']));
      } else UI.note(el, 'Record at least 3 concentrations at the same temperature to fit the isotherms.');
    },
    discussion: ['n > 1 and 0 < R_L < 1 indicate favourable adsorption.', 'Charcoal surfaces are heterogeneous, so the Freundlich equation often fits better at low concentration while the Langmuir form captures saturation at high concentration.', 'Uptake decreases with temperature (exothermic physisorption) — compare runs at two temperatures if recorded.', 'Errors: insufficient equilibration, adsorption on filter paper, evaporation of acid, titration end-point, moisture in charcoal.'],
    viva: [
      { q: 'Distinguish physical adsorption from chemisorption.', a: 'Physisorption: van der Waals forces, low heat (< 40 kJ/mol), reversible, multilayer, fast, decreases with T. Chemisorption: chemical bonds, high heat (40–400 kJ/mol), often irreversible, monolayer, may need activation energy.' },
      { q: 'What are the assumptions of the Langmuir isotherm?', a: 'Monolayer coverage, all sites energetically equivalent, one molecule per site, no interaction between adsorbed molecules, dynamic equilibrium between adsorption and desorption.' },
      { q: 'What does 1/n in the Freundlich equation indicate?', a: 'Surface heterogeneity / adsorption intensity: 0 < 1/n < 1 favourable; 1/n = 1 linear; 1/n > 1 unfavourable.' },
      { q: 'Why is charcoal "activated"?', a: 'Controlled oxidation (steam/CO₂) or chemical activation develops a highly porous structure with very large internal surface area (500–1500 m²/g).' },
      { q: 'Why discard the first few mL of filtrate?', a: 'The filter paper adsorbs a little acid; the first filtrate would show a falsely low concentration.' },
      { q: 'What is an isotherm and why must temperature be constant?', a: 'The equilibrium relation between solid loading and fluid concentration at fixed temperature; since adsorption equilibrium is temperature-dependent (exothermic), varying T would mix different isotherms.' }
    ]
  };

  /* ======================= 7 · Gas diffusivity by Stefan tube ======================= */
  const LIQ = { acetone: 'Acetone', methanol: 'Methanol', ethanol: 'Ethanol', benzene: 'Benzene', toluene: 'Toluene' };
  const stefK = (liq, T, Pa) => { const TK = T + 273.15, D = C.fuller(liq, 'air', TK, Pa / 1e5) * 1e-4, pA = Math.min(C.psat(liq, T), .95 * Pa), c = C.comp[liq]; return { D, pA, K: c.M / 1000 * D * Pa * Math.log(Pa / (Pa - pA)) / (c.rho * Rg * TK) }; };
  /* 7 · 3-D bench: Stefan tube in a glass thermostat bath, air sweep over the mouth, travelling microscope.
     Gold dots = vapour A, pale-blue dots = air B. Their visible densities follow the stagnant-film profile
     1 − y_A(h) = (1 − y_A1)^(1 − h/z) (Bird et al. §18.2), so A thins out upward and B thins out downward. */
  function ste3d(v, st) {
    const { cstream } = T201.fx3, hsh = (i, k) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); }, OFF = [0, -50, 0];
    const SC = .039, y0 = .4, yT = y0 + 72 * SC, rt = .085, xr = -2.3, xm = 1.55;
    const yM = () => yT - Math.min(st.z(), 70) * SC;
    v.box(5.6, .16, 2.2, 0x9b7653, [0, -.08, 0]);
    // bath: glass tank, water, heater coil, thermometer
    v.box(1.6, 3, 1, GLS, [0, 1.55, 0], { op: .12, ds: 1 }); v.box(1.56, 2.75, .96, 0x4f9fd6, [0, 1.43, 0], { op: .13, ds: 1 });
    v.tor(.35, .025, 0xb5651d, [0, .25, 0], { rot: [Math.PI / 2, 0, 0] }); v.cyl(.025, 2.6, GLS, [-.55, 1.6, .25], { op: .5 }); v.sph(.045, 0xc0392b, [-.55, .3, .25]); const merc = v.cyl(.012, 1, 0xc0392b, [-.55, 1, .25]);
    // Stefan tube, liquid column, T-piece with the air line and rotameter
    v.cyl(rt, yT - y0 + .05, GLS, [0, (yT + y0) / 2, 0], { op: .25, ds: 1, open: 1 }); v.sph(rt, GLS, [0, y0, 0], { op: .25 });
    const lq = v.cyl(rt - .012, 1, 0xe3a21a, [0, 1, 0], { op: .9 }), men = v.cyl(rt - .012, .02, 0xb8860b, [0, 1, 0]);
    const ya = yT + .14; v.cyl(.09, 2.9, GLS, [0, ya, 0], { op: .22, ds: 1, open: 1, rot: [0, 0, Math.PI / 2] }); v.cyl(.09, .12, GLS, [0, yT + .03, 0], { op: .22, ds: 1, open: 1 });
    v.pipe([[-1.45, ya, 0], [xr, ya, 0], [xr, 2.7, 0]], .04, 0x7f8c8d); v.cyl(.07, 1.4, GLS, [xr, 1.95, 0], { r2: .09, op: .3, ds: 1, open: 1 }); v.cyl(.05, .06, 0xc0392b, [xr, 1.6, 0]);
    v.pipe([[xr, 1.25, 0], [xr, .3, 0], [xr + .3, .3, 0]], .04, 0x7f8c8d); v.box(.5, .3, .4, 0x56606b, [xr + .55, .15, 0]);
    // travelling microscope on a vertical vernier rail; the scope tracks the meniscus
    v.box(.5, .06, .5, 0x333333, [xm + .25, .03, 0]); v.cyl(.04, 3.6, MET, [xm + .3, 1.85, 0]); for (let k = 0; k <= 24; k++) v.box(.06, .006, .01, 0x222222, [xm + .36, .4 + k * 3 * SC, .04]);
    const scope = new THREE.Group(); v.root.add(scope); v.cyl(.07, .55, 0x2c3e50, [-.05, 0, 0], { rot: [0, 0, Math.PI / 2], parent: scope }); v.cyl(.04, .2, 0x111111, [.3, 0, 0], { rot: [0, 0, Math.PI / 2], parent: scope }); v.box(.12, .14, .14, MET, [.3, 0, 0], { parent: scope });
    // particles
    const yA = s => 1 - Math.pow(1 - st.yA1, 1 - s);   // stagnant-film profile, s = h/z
    cstream(v, 110, .055, (u, i) => {
      const yM0 = yM(), s = (u + hsh(i, 1)) % 1; if (hsh(i, 7) * st.yA1 > yA(s)) return OFF;
      const a = 6.28 * hsh(i, 2) + st.ph * (1 + hsh(i, 3)), r = (rt - .03) * Math.sqrt(hsh(i, 4)); return [r * Math.cos(a), yM0 + .02 + s * (yT - yM0 - .02), r * Math.sin(a)];
    }, () => LT, .25);
    cstream(v, 50, .055, (u, i) => {
      const yM0 = yM(), s = hsh(i, 11); if (hsh(i, 13) > 1 - yA(s)) return OFF;
      const a = 6.28 * hsh(i, 12) + st.ph * .7 * Math.sin(i), r = (rt - .03) * Math.sqrt(hsh(i, 14)), j = .02 * Math.sin(st.ph * 3 + i);
      return [r * Math.cos(a), yM0 + .03 + s * (yT - yM0 - .05) + j, r * Math.sin(a)];
    }, () => [.75, .88, 1], .1);
    cstream(v, 70, .05, (u, i) => [-1.45 + 2.9 * u, ya + (hsh(i, 21) - .5) * .12, (hsh(i, 22) - .5) * .12], () => [.75, .88, 1], .25);
    cstream(v, 24, .055, (u, i) => hsh(i, 23) < st.fr ? [.05 + 1.4 * u, ya + (hsh(i, 24) - .5) * .12, (hsh(i, 25) - .5) * .12] : OFF, () => LT, .25);
    const tg = { air: v.tag('Air sweep: p_A2 ≈ 0 at the mouth', [.9, ya + .12, 0], 'air'), gas: v.tag('', [rt, 2.9, 0], 'gas'), liq: v.tag('', [rt, 1, 0], 'liq'), bath: v.tag('', [-.55, 2.2, .25], 'bath'), micro: v.tag('', [xm + .4, 1, 0], 'micro'), rot: v.tag('Rotameter: gentle, steady air flow', [xr, 2.5, 0], 'rot') };
    let acc = 0, lastW = 0;
    v.tick((t, dt) => {
      const ww = v.el.clientWidth; if (ww && ww !== lastW) { lastW = ww; const k = clamp(640 / ww, 1, 2.3); v.look([.4, 2.6 + .4 * (k - 1), 7.2 * k], [-.2, 2.0, 0]); }
      st.ph += dt; if (st.on) { const dh = Math.min(dt * .1, 72 - st.t); st.adv(dh); if (st.t >= 72 || st.z() >= 70) st.on = false; }
      const m = yM(); lq.scale.y = m - y0; lq.position.y = (m + y0) / 2; men.position.y = m; scope.position.set(xm, m, 0);
      merc.scale.y = .8 + 1.6 * (st.T - 10) / 50; merc.position.y = .3 + merc.scale.y / 2;
      acc += dt; if (acc > .2) { acc = 0;
        setTag(tg.gas, `Stagnant air column z = ${UI.fmt(st.z(), 2)} mm (vapour diffuses up)`); tg.gas.p && tg.gas.p.set(rt, (m + yT) / 2, 0);
        setTag(tg.liq, `Liquid surface: p_A1 = Pˢᵃᵗ = ${UI.fmt(st.pA / 1000, 2)} kPa`); tg.liq.p && tg.liq.p.set(rt, m, 0);
        setTag(tg.bath, `Bath ${UI.fmt(st.T, 1)} °C`); setTag(tg.micro, `Microscope: z = ${UI.fmt(st.z(), 2)} mm · t = ${UI.fmt(st.t, 2)} h`); tg.micro.p && tg.micro.p.set(xm + .4, m, 0);
        st.live && st.live(); }
    });
  }
  const L7 = {
    refs: ["<i>Winkelmann, A.</i> (1884) Ueber die Diffusion von Gasen und Dämpfen. <i>Ann. Phys. Chem.</i> 22, 1–31 and 152–161.", "<i>Lee, C.Y. & Wilke, C.R.</i> (1954) Measurements of vapor diffusion coefficient. <i>Ind. Eng. Chem.</i> 46, 2381–2387.", "<i>Fuller, E.N., Schettler, P.D. & Giddings, J.C.</i> (1966) A new method for prediction of binary gas-phase diffusion coefficients. <i>Ind. Eng. Chem.</i> 58(5), 18–27.", "<i>Bird, R.B., Stewart, W.E. & Lightfoot, E.N.</i> (2002) <i>Transport Phenomena</i>, 2nd ed., Wiley, §18.2.", "<i>Cussler, E.L.</i> (2009) <i>Diffusion: Mass Transfer in Fluid Systems</i>, 3rd ed., Cambridge University Press.", "<i>Lugg, G.A.</i> (1968) Diffusion coefficients of some organic and other vapors in air. <i>Anal. Chem.</i> 40, 1072–1077.", "<i>Poling, B.E., Prausnitz, J.M. & O’Connell, J.P.</i> (2001) <i>The Properties of Gases and Liquids</i>, 5th ed., McGraw-Hill, Ch. 11."],
    id: 'stefan-tube', title: 'Diffusivity of a vapour in air — Stefan tube (Winkelmann)', tags: 'diffusion diffusivity stefan tube winkelmann stagnant gas fuller',
    blurb: 'Measure the falling liquid level in a Stefan tube and find D_AB through stagnant air.',
    aim: 'To determine the <b>diffusion coefficient</b> of an organic vapour (e.g. acetone) in air by <b>Winkelmann’s (Stefan tube)</b> method — diffusion of A through stagnant B — and to compare it with the Fuller correlation.',
    objectives: ['Record the liquid level in the tube vs time at constant temperature.', 'Plot $t/(z-z_0)$ against $(z-z_0)$ and get $D_{AB}$ from the slope.', 'Compare with the Fuller–Schettler–Giddings correlation.'],
    theory: `<p>A volatile liquid A is held in a narrow vertical tube in a thermostat bath. A gentle stream of air over the open end keeps the partial pressure of A at the top ≈ 0, while at the liquid surface it equals the vapour pressure. Vapour diffuses up through a <b>stagnant air</b> column of length $z$ (air is insoluble in A and does not move), so the flux is that for <b>diffusion of A through non-diffusing B</b>.</p>
<p>As liquid evaporates, $z$ increases slowly (pseudo-steady state). Equating the molar flux to the rate of fall of the liquid level and integrating from $z_0$ at $t = 0$ gives a relation that is linear when $t/(z-z_0)$ is plotted against $(z-z_0)$. The slope $s$ gives $D_{AB}$. The level is read with a travelling microscope (cathetometer).</p>`,
    eqs: [
      { n: 'Flux through stagnant B', m: 'N_A=\\frac{D_{AB}P}{RTz}\\ln\\frac{P-p_{A2}}{P-p_{A1}}=\\frac{D_{AB}P}{RTz}\\frac{p_{A1}-p_{A2}}{p_{BM}}' },
      { n: 'Level balance', m: 'N_A=\\frac{\\rho_L}{M_A}\\frac{dz}{dt}' },
      { n: 'Integrated (Winkelmann)', m: '\\frac{t}{z-z_0}=\\frac{\\rho_LRT}{2M_AD_{AB}P\\ln\\frac{P}{P-p_{A1}}}(z-z_0)+\\frac{\\rho_LRT\\,z_0}{M_AD_{AB}P\\ln\\frac{P}{P-p_{A1}}}' },
      { n: 'Diffusivity from slope s', m: 'D_{AB}=\\frac{\\rho_LRT}{2\\,s\\,M_AP\\ln\\frac{P}{P-p_{A1}}}' },
      { n: 'Fuller correlation', m: 'D_{AB}=\\frac{0.00143\\,T^{1.75}}{P\\,M_{AB}^{1/2}\\left[\\Sigma_v^{1/3}{}_A+\\Sigma_v^{1/3}{}_B\\right]^2}\\;\\mathrm{cm^2/s}' }
    ],
    apparatus(el, UI) {
      UI.svg(el, DEFS + `<rect class="lq" style="fill-opacity:.1" x="140" y="70" width="200" height="240" rx="6"/><rect class="s" x="140" y="70" width="200" height="240" rx="6"/>` + `<path class="s" d="M232,40 V280 Q240,292 248,280 V40"/><rect class="lq2" x="233" y="222" width="14" height="60"/>`
        + `<path class="s" d="M150,40 H330 M150,28 H330"/>` + arw(160, 34, 210, 34, 'cw') + arw(270, 34, 320, 34, 'cw') + `<line class="t" x1="260" y1="40" x2="290" y2="40"/><line class="t" x1="260" y1="222" x2="290" y2="222"/>` + arw(282, 130, 282, 46, 't') + arw(282, 130, 282, 218, 't')
        + T(296, 135, 'z (gas path)', 'start') + T(330, 22, 'air stream (p_A ≈ 0)', 'end', 'mu') + T(256, 260, 'liquid A (p_A1 = Pˢᵃᵗ)', 'start') + T(150, 300, 'thermostat bath T', 'start', 'mu')
        + `<rect class="s" x="420" y="150" width="80" height="22" rx="4"/><circle class="s" cx="420" cy="161" r="11"/>` + T(460, 196, 'travelling microscope', 'middle', 'mu') + `<line class="t" x1="409" y1="161" x2="250" y2="222"/>`, '0 0 640 330');
    },
    apparatusList: ['Stefan (Winkelmann) tube, ~3 mm bore, with T-piece for air flow', 'Thermostatic water bath (±0.1 °C)', 'Air pump / blower with rotameter', 'Travelling microscope (vernier, 0.01 mm)', 'Volatile liquid (acetone), syringe with fine needle'],
    procedure: ['Fill the capillary with acetone to ~2 cm from the top using a fine syringe; avoid wetting the walls.', 'Fix the tube in the bath at the set temperature and connect the air line; set a gentle, steady air flow over the top.', 'After temperature equilibrium (~10 min) note the initial level $z_0$ and set t = 0.', 'Read the level every 30 min (or hourly) for several hours.', 'Plot $t/(z-z_0)$ vs $(z-z_0)$; from the slope calculate $D_{AB}$.'],
    precautions: ['Air velocity must be low — turbulence entering the tube shortens the effective diffusion path.', 'Keep the bath temperature constant; $P^{sat}$ is strongly temperature-dependent.', 'Focus the microscope on the bottom of the meniscus each time.'],
    bench: {
      controls: [
        { k: 'liq', t: 'select', label: 'Volatile liquid A', v: 'acetone', opts: LIQ },
        { k: 'T', label: 'Bath temperature', min: 15, max: 55, step: .5, v: 40, unit: '°C' },
        { k: 'P', label: 'Pressure', min: .8, max: 1.1, step: .005, v: 1, unit: 'atm' },
        { k: 'z0', label: 'Initial gas path z₀', min: 5, max: 60, step: .5, v: 20, unit: 'mm' },
        { k: 't', label: 'Elapsed time t', min: 0, max: 72, step: .25, v: 1, unit: 'h' }
      ],
      cols: [{ k: 't', l: 't (h)', d: 2 }, { k: 'z', l: 'z (mm)', d: 2 }, { k: 'T', l: 'T (°C)', d: 1 }],
      run(s, nz) {
        const Pa = s.P * ATM; if (C.psat(s.liq, s.T) > .9 * Pa) { UI.toast('Bath is at/above the boiling point — liquid would boil'); return null; }
        const k = stefK(s.liq, s.T, Pa), z = Math.sqrt(Math.pow(s.z0 / 1000, 2) + 2 * k.K * s.t * 3600) * 1000;
        return { liq: s.liq, T: s.T, P: s.P, z0: s.z0, t: s.t, z: z + nz.n(.05) };
      },
      preset: s => { const k = stefK(s.liq, s.T, s.P * ATM), z0 = s.z0 / 1000, tE = (Math.pow(z0 + .012, 2) - z0 * z0) / (2 * k.K) / 3600; return Array.from({ length: 9 }, (_, i) => ({ t: +(tE * i / 8).toFixed(2) })); },
      views: [{ k: 'v', t: '3d', h: 500, cam: [.4, 2.6, 7.2], target: [-.2, 2.0, 0] }, { k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 300 }],
      walk: [
        { t: '1 · Fill the capillary, mount it in the bath', d: 'A fine syringe fills the narrow tube (≈ 3 mm bore, drawn wider here) with the volatile liquid up to about z₀ below the mouth, without wetting the walls above. The tube stands in a glass thermostat bath so the liquid stays at the set temperature.', hi: ['liq', 'bath'], do: S => { const st = S._st || (S._st = {}); st.reset && st.reset(); } },
        { t: '2 · Liquid surface: the vapour is saturated', d: 'Right at the liquid surface the gas is in equilibrium with the liquid, so the partial pressure of A equals its vapour pressure: p<sub>A1</sub> = Pˢᵃᵗ(T). This is why the bath temperature must be held to ±0.1 °C — Pˢᵃᵗ changes by about 4 % per °C.', hi: ['liq', 'bath'] },
        { t: '3 · Air sweep keeps the mouth at p_A ≈ 0', d: 'A gentle, steady air stream (set on the rotameter) flows across the open end and carries the vapour away, so p<sub>A2</sub> ≈ 0 at the top. Too strong a flow sends eddies into the tube and shortens the real diffusion path.', hi: ['air', 'rot'], do: S => { const st = S._st || (S._st = {}); if (st.reset) st.on = true; } },
        { t: '4 · Diffusion of A through stagnant air', d: 'Gold vapour molecules are dense near the liquid and thin out towards the mouth. Air (pale blue) does not dissolve in the liquid, so its net flux is zero: it diffuses down its own gradient, but the upward bulk flow created by the evaporating vapour cancels that exactly. The live balance shows both terms at mid-column.', hi: ['gas'], do: S => { const st = S._st || (S._st = {}); if (st.reset) st.on = true; } },
        { t: '5 · Read the falling level with the microscope', d: 'As liquid evaporates, z grows slowly (pseudo-steady state), as z² = z₀² + 2Kt. The travelling microscope is focused on the bottom of the meniscus every 30–60 min for several hours. A plot of t/(z − z₀) against (z − z₀) is a straight line whose slope gives D<sub>AB</sub>.', hi: ['micro'], do: S => { const st = S._st || (S._st = {}); if (st.reset) { st.reset(); st.adv(st.tE / 2); st.on = true; } } }
      ],
      view(s, V, rows, S) {
        const Pa = s.P * ATM, k = stefK(s.liq, s.T, Pa), z = Math.sqrt(Math.pow(s.z0 / 1000, 2) + 2 * k.K * s.t * 3600) * 1000, z0 = s.z0 / 1000, tE = Math.max(s.t, (Math.pow(z0 + .012, 2) - z0 * z0) / (2 * k.K) / 3600);
        const st = S._st || (S._st = {}), key = [s.liq, s.T, s.P, s.z0].join('|');
        if (st.key !== key) {
          const TK = s.T + 273.15, c = C.comp[s.liq], ln = Math.log(Pa / (Pa - k.pA)), AT = Math.PI * 1.5e-3 ** 2;
          Object.assign(st, { key, T: s.T, pA: k.pA, yA1: k.pA / Pa, K: k.K, tE: (Math.pow(z0 + .012, 2) - z0 * z0) / (2 * k.K) / 3600, cL: c.rho / (c.M / 1000), AT, boil: k.pA > .9 * Pa });
          st.z = () => Math.sqrt(z0 * z0 + 2 * k.K * st.t * 3600) * 1000;
          st.NA = zmm => k.D * Pa / (Rg * TK * zmm / 1000) * ln;   // mol/m²s through stagnant air
          st.adv = dh => { const n = Math.max(1, Math.ceil(dh / .005)), hs = dh / n; for (let i = 0; i < n; i++) { st.t += hs / 2; st.nEv += st.NA(st.z()) * hs * 3600; st.t += hs / 2; } st.fr = st.NA(st.z()) / st.NA(s.z0); };
          st.reset = () => Object.assign(st, { t: 0, nEv: 0, on: false, ph: st.ph || 0, fr: 1 });
          st.reset(); S._k = null;
        }
        if (V.v.ok && S._k !== st.key) { S._k = st.key; V.v.clear(); ste3d(V.v, st); }
        if (!S._lv) {
          S._lv = 1; const info = h('div', { class: 'hint', style: 'margin:6px 0' }), tb = h('div'), bt = (t, fn, c = 'btn sm') => h('button', { class: c, onclick: () => { fn(); st.live(); } }, t);
          V.live.append(h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' },
            bt('▶ Run clock / ⏸ pause', () => { if (st.boil) return UI.toast('Bath is at/above the boiling point — liquid would boil'); st.on = !st.on; }, 'btn pri sm'), bt('⏭ +1 h', () => { if (!st.boil && st.t < 72) st.adv(Math.min(1, 72 - st.t)); }),
            h('button', { class: 'btn sm', onclick: () => S.set('t', clamp(Math.round(st.t * 4) / 4, 0, 72)) }, '⏱ Elapsed time = clock'), bt('↺ Refill tube', () => st.reset())), info, tb);
          let lastT = -1;
          st.live = () => {
            const zz = st.z(), NA = st.NA(zz), u = x => UI.fmt(x, 4), lost = st.cL * st.AT * (zz - st.z0m()) / 1000 * 1e6, out = st.nEv * st.AT * 1e6, yAm = 1 - Math.pow(1 - st.yA1, .5), NAu = NA * 1e3;
            info.innerHTML = `Clock <b>t = ${UI.fmt(st.t, 2)} h</b> (${st.on ? 'running, 0.1 h per second' : 'paused'}) · level z = <b>${UI.fmt(zz, 3)} mm</b> (fall ${UI.fmt(zz - st.z0m(), 3)} mm) · flux N<sub>A</sub> = ${UI.fmt(NAu, 3)} mmol/m²s · y<sub>A1</sub> = p<sub>A1</sub>/P = ${UI.fmt(st.yA1, 4)}`;
            const d = lost - out, z9 = Math.abs(d) < 1e-6 * Math.max(lost, 1e-12) ? '0' : UI.fmt(d, 6), m2 = yAm => (1 - yAm) * NAu, m3 = yAm => NAu - yAm * NAu;
            tb.innerHTML = ''; tb.append(UI.table(['Live balance (3 mm bore tube)', 'In', 'Out', 'In − Out'], [
              ['Species A (µmol)', `liquid lost ρ/M·A·(z − z₀) = ${u(lost)}`, `vapour swept off ∫N_A·A dt = ${u(out)}`, z9],
              ['Air B at mid-column (mmol/m²s)', `bulk flow up y_B·N_A = ${UI.fmt(m2(yAm), 3)}`, `diffusion down J_A = N_A − y_A·N_A = ${UI.fmt(m3(yAm), 3)}`, Math.abs(m2(yAm) - m3(yAm)) < 1e-12 ? '0 (B stagnant)' : UI.fmt(m2(yAm) - m3(yAm), 6)]], [3]));
            const tt = Math.round(st.t * 4); if (tt !== lastT && st.plot) { lastT = tt; st.plot(); }
          };
        }
        st.z0m = () => s.z0;
        st.plot = () => { const tm = Math.max(tE, st.t) * 1.05, zf = t => Math.sqrt(z0 * z0 + 2 * k.K * t * 3600) * 1000;
          const p = V.p.frame({ x: [0, tm], y: [s.z0 - 1, zf(tm) + 1], xl: 't (h)', yl: 'z (mm)', xs: 't', ys: 'z' }).fn(zf, 0, tm, { c: 'c1', l: 'z(t), pseudo-steady state' }).vl(s.t, { c: 'c2' });
          if (st.t > 0) p.pts([[st.t, st.z()]], { c: 'c5', r: 5, l: 'tube now' }); p.done(); };
        st.live(); st.plot();
        V.ro.set([['Vapour pressure $p_{A1}$', f(k.pA / 1000, 3) + ' kPa'], ['$D_{AB}$ (Fuller)', f(k.D * 1e4, 4) + ' cm²/s'], ['Level at recorded t', f(z, 2) + ' mm'], ['Initial flux $N_A$', f(k.D * Pa / (Rg * (s.T + 273.15) * z0) * Math.log(Pa / (Pa - k.pA)), 3) + ' mol/m²s'], ['Time for 12 mm fall', f(tE, 2) + ' h']]);
      }
    },
    calc(rows, s, el, UI) {
      const r0 = rows[0], R = rows.filter(r => r.liq === r0.liq && r.T === r0.T), b = R.reduce((p, q) => q.t < p.t ? q : p, R[0]);
      const pts = R.filter(r => r !== b && r.z - b.z > .3).map(r => ({ ...r, dz: (r.z - b.z) / 1000, ts: (r.t - b.t) * 3600 })).map(r => ({ ...r, y: r.ts / r.dz }));
      if (pts.length < 2) return UI.note(el, 'Record the initial level (t = 0) and at least two later readings with a measurable level change (use “Run standard procedure”).', 'warn');
      const TK = r0.T + 273.15, Pa = r0.P * ATM, c = C.comp[r0.liq], pA = C.psat(r0.liq, r0.T), ln = Math.log(Pa / (Pa - pA)), fit = C.linfit(pts.map(p => p.dz), pts.map(p => p.y));
      const D = c.rho * Rg * TK / (2 * fit.b * c.M / 1000 * Pa * ln), Df = C.fuller(r0.liq, 'air', TK, Pa / 1e5) * 1e-4;
      UI.sec(el, 'Calculations');
      const a = pts[0];
      sample(el, `Reference reading: t = ${f(b.t, 2)} h, $z_0$ = ${f(b.z, 2)} mm. Reading: t = ${f(a.t, 2)} h, z = ${f(a.z, 2)} mm ⇒ $z-z_0$ = ${f(a.dz * 1000, 3)} mm, $t/(z-z_0)$ = ${f(a.y, 4)} s/m.<br>
        $p_{A1} = P^{sat}(${f(r0.T, 1)}\\,°C)$ = ${f(pA / 1000, 3)} kPa; $\\ln\\frac{P}{P-p_{A1}} = ${f(ln, 4)}$; $\\rho_L$ = ${c.rho} kg/m³, $M_A$ = ${c.M} g/mol.<br>
        Slope $s$ = ${f(fit.b, 4)} s/m²  ⇒  $D_{AB} = \\frac{${c.rho}\\times8.314\\times${f(TK, 2)}}{2\\times${f(fit.b, 4)}\\times${f(c.M / 1000, 5)}\\times${f(Pa, 0)}\\times${f(ln, 4)}} = ${f(D, 4)}$ m²/s.`);
      tbl(el, ['#', 't (h)', 'z (mm)', 'z − z₀ (mm)', 't (s)', 't/(z − z₀) (s/m)'], pts.map((p, i) => [i + 1, f(p.t, 2), f(p.z, 2), f(p.dz * 1000, 3), f(p.ts, 0), f(p.y, 4)]));
      UI.sec(el, 'Graph');
      const xm = Math.max(...pts.map(p => p.dz)) * 1.1;
      UI.plotIn(el, 320).frame({ x: [0, xm * 1000], y: [0, (fit.a + fit.b * xm) * 1.1], xl: 'z − z₀ (mm)', yl: 't/(z − z₀) (s/m)', xs: 'Δz', ys: 't/Δz' }).pts(pts.map(p => [p.dz * 1000, p.y]), { c: 'c2', r: 4.5, l: 'readings' }).fn(x => fit.a + fit.b * x / 1000, 0, xm * 1000, { c: 'c1', l: `fit, R² = ${fit.r2.toFixed(4)}` }).done();
      UI.sec(el, 'Result');
      res(el, [['$D_{AB}$ experimental', f(D * 1e4, 4) + ' cm²/s'], ['$D_{AB}$ Fuller correlation', f(Df * 1e4, 4) + ' cm²/s'], ['Deviation', (Math.abs(D - Df) < 1e-9 * Df ? '0.00' : f(100 * (D - Df) / Df, 2)) + ' %'], ['$z_0$ from intercept (check)', f(fit.a / (2 * fit.b) * 1000, 2) + ' mm vs ' + f(b.z, 2) + ' mm read']]);
    },
    discussion: ['The intercept should equal $z_0/K$, i.e. $z_0$ = intercept/(2·slope): agreement checks the data.', 'D ∝ T^1.75/P (Fuller). The Fuller correlation reproduces measured gas-pair diffusivities with an average error of about 5 % (Poling, Prausnitz & O’Connell); compare your value with measured data at 25 °C tabulated by Lugg (1968).', 'Errors: air turbulence at the mouth (reduces effective z), temperature fluctuations (vapour pressure), level reading error, end effects and wall wetting.', 'Assumptions: pseudo-steady state, isothermal, ideal gas, $p_{A2} = 0$, air insoluble in the liquid.'],
    viva: [
      { q: 'Why is this called diffusion through a stagnant (non-diffusing) gas?', a: 'Air is insoluble in the liquid, so at steady state its net flux is zero; a bulk-flow term then adds to the diffusion of A (Stefan flow), giving the log-mean factor $P/p_{BM}$.' },
      { q: 'What is the pseudo-steady-state assumption?', a: 'The level changes so slowly compared with the time to establish the concentration profile that the flux at each instant is the steady-state flux for the current z.' },
      { q: 'Why is a stream of air passed over the top?', a: 'To sweep away vapour so that $p_{A2} \\approx 0$, a known boundary condition.' },
      { q: 'How does diffusivity vary with T and P for gases?', a: '$D_{AB} \\propto T^{1.75}/P$ (Fuller), or $T^{3/2}/(P\\,\\sigma^2\\Omega_D)$ from kinetic theory.' },
      { q: 'What is $p_{BM}$?', a: 'The log-mean partial pressure of B: $(p_{B2}-p_{B1})/\\ln(p_{B2}/p_{B1})$.' }
    ]
  };

  App.course({
    id: 'acce202', code: 'ACCE 202', title: 'Mass Transfer Lab', credits: '1.5 credits', lab: true,
    sub: 'Virtual laboratory — distillation, extraction, adsorption equilibria (and diffusion)',
    intro: '<p class="hint">Each experiment has six tabs: theory, apparatus & procedure, a live bench where you set conditions and record readings (optionally with realistic instrument error), automatic step-by-step calculations with graphs, viva-voce questions, and a printable report. Practical exam weighting: theory, experimental work, results & discussion, conclusion, viva.</p>',
    units: [
      { title: 'Distillation', lead: 'Batch (Rayleigh) distillation, packed-column HETP at total reflux, and VLE measurement.', topics: [L1, L2, L3] },
      { title: 'Liquid extraction', lead: 'Ternary solubility curve and single / cross-current extraction.', topics: [L4, L5] },
      { title: 'Adsorption equilibria', lead: 'Isotherms of acetic acid on activated carbon.', topics: [L6] },
      { title: 'Diffusion (supplementary)', lead: 'Gas diffusivity by the Stefan tube method.', topics: [L7] }
    ],
    refs: ['Treybal, R. E. — Mass-Transfer Operations, 3rd ed.', 'McCabe, Smith & Harriott — Unit Operations of Chemical Engineering, 7th ed.', 'Geankoplis, C. J. — Transport Processes and Separation Process Principles, 4th ed.', 'Wankat, P. C. — Separation Process Engineering', 'Smith, Van Ness & Abbott — Introduction to Chemical Engineering Thermodynamics (VLE consistency)']
  });
})();
