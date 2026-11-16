/* ACCE 201 · Unit 6 — Distillation */
window.T201 = window.T201 || {};
(function () {
  const C = Chem, ATM = 101325, SYS = Object.fromEntries(Object.entries(C.systems).map(([k, v]) => [k, C.comp[v.a].name + ' – ' + C.comp[v.b].name]));
  const light = s => C.comp[C.systems[s].a].name;
  const sysCtl = (v = 'benzene-toluene') => ({ k: 'sys', t: 'select', label: 'Binary system (light – heavy)', v, opts: SYS });

  const MET = 0x9aa3ab, CPV = { benzene: 82.4, toluene: 103.7, methanol: 44.1, ethanol: 65.6, water: 33.6, hexane: 143.1, heptane: 166.0, acetone: 74.5 }; // ideal-gas cp, J/(mol·K) at 298 K (NIST)
  const LT = [1, .78, .1], HV = [.55, .25, .85]; // molecules: gold = light component, purple = heavy
  const tcol = f => new THREE.Color().setHSL(.62 - .62 * Math.min(1, Math.max(0, f)), .75, .5); // cool blue → hot red
  const setTag = (t, x) => { if (t && t.el.textContent !== x) { t.el.textContent = x; t.el.title = x; t.w0 = 0; } };

  /* full column: feed thermal state from T_F, McCabe–Thiele stages, then overall mass & energy balance.
     Enthalpy reference: pure liquids at 25 °C; h_L = c_pL(x)(T − 25); heat of mixing neglected; λ at normal boiling point. */
  function colCalc(s) {
    const P = s.P * ATM, sy = C.systems[s.sys], A = C.comp[sy.a], Bc = C.comp[sy.b], v = C.vle(s.sys, P);
    const xB = Math.min(s.xB, s.xF - .01), Tbub = v.T(s.xF), Tdew = C.dew(s.sys, s.xF, P).T;
    const lam = x => x * A.lam + (1 - x) * Bc.lam, cpL = x => x * A.cp + (1 - x) * Bc.cp, cpV = s.xF * CPV[sy.a] + (1 - s.xF) * CPV[sy.b];
    let q; if (s.TF <= Tbub) q = 1 + cpL(s.xF) * (Tbub - s.TF) / lam(s.xF); else if (s.TF >= Tdew) q = -cpV * (s.TF - Tdew) / lam(s.xF); else { const xL = C.bisect(x => v.T(x) - s.TF, 0, v.az || 1), yv = v.y(xL); q = 1 - (s.xF - xL) / (yv - xL); }
    const az = v.az && s.xD > v.az, d = az ? null : design({ ...s, xB, q: Math.min(1.55, Math.max(-.45, q)), E: 1, psi: 0 }), m = d && d.m;
    const D = s.F * (s.xF - xB) / (s.xD - xB), B = s.F - D, R = d ? d.R : NaN, L = R * D, V = L + D, Lb = L + q * s.F, Vb = V - (1 - q) * s.F;
    const TD = v.T(s.xD), TB = v.T(xB), hL = (x, T) => cpL(x) * (T - 25), hF = hL(s.xF, Tbub) + (1 - q) * lam(s.xF), hD = hL(s.xD, TD), hB = hL(xB, TB);
    const Qc = V * lam(s.xD) / 3600, Qr = Qc + (D * hD + B * hB - s.F * hF) / 3600, Qcmo = Vb * lam(xB) / 3600;
    return { P, v, d, m, az, q, xB, D, B, R, L, V, Lb, Vb, TD, TB, Tbub, Tdew, hF, hD, hB, Qc, Qr, Qcmo };
  }

  // 3-D tray column. st: { n trays, feed, steps[{x,y}] (stage n+1 = reboiler), xF, xD } — read live by the particles
  function col3d(v, st) {
    const { cstream, pathAt, hsh } = T201.fx3, n = st.n, R = .8, y0 = .9, yt = 7.9, top = 7.4, bot = 1.7, sp = (top - bot) / Math.max(n - 1, 1);
    const yk = k => n > 1 ? top - (k - 1) * sp : (top + bot) / 2, sd = k => k % 2 ? -1 : 1, fT = Math.min(st.feed, n), yf = yk(fT);
    v.cyl(R + .04, yt - y0, 0xa9c4dd, [0, (yt + y0) / 2, 0], { op: .13, ds: 1, open: 1 }); v.cyl(R + .05, .06, MET, [0, yt, 0]); v.cyl(R + .05, .06, MET, [0, y0, 0]);
    v.cyl(R - .01, .3, 0x2f7fd8, [0, y0 + .18, 0], { op: .35 });
    const tl = [], dh = Math.min(sp * .75, 1.1);
    for (let k = 1; k <= n; k++) {
      const y = yk(k), a = sd(k);
      v.cyl(R, .025, MET, [0, y, 0], { op: .6 }); tl.push(v.cyl(R - .02, Math.min(.1, sp * .4), 0xffffff, [0, y + .05, 0], { op: .6 }));
      v.box(.025, dh, 1.15, MET, [a * .56, y + .12 - dh / 2, 0], { op: .45, ds: 1 });
    }
    const stg = y => Math.min(n + 1, Math.max(1, Math.ceil((top - y) / sp) + 1)), pick = (i, f) => hsh(i, 3) < f ? LT : HV;
    // vapour rises through every tray; its composition is that of the vapour leaving the tray below
    cstream(v, n > 30 ? 520 : 380, .09, (u, i) => { const y = y0 + .45 + u * (yt - y0 - .55); return [(hsh(i, 5) - .5) * .95 + .05 * Math.sin(u * 40 + i), y, (hsh(i, 7) - .5) * .95]; }, (u, i) => pick(i, st.steps[stg(y0 + .45 + u * (yt - y0 - .55)) - 1].y), .09);
    // liquid crosses each tray, then falls down its downcomer to the tray below
    cstream(v, 300, .085, (u, i) => { const s2 = u * n, k = Math.min(n, Math.floor(s2) + 1), f = s2 - k + 1, a = sd(k), z = (hsh(i, 11) - .5) * .9, y = yk(k) + .08;
      if (f < .65) return [a * (-.6 + 1.2 * f / .65), y, z]; const g = (f - .65) / .35, yn = k < n ? yk(k + 1) + .08 : y0 + .3; return [a * .68, y + (yn - y) * g, z * .5]; }, (u, i) => pick(i, st.steps[Math.min(n, Math.floor(u * n) + 1) - 1].x), .05);
    // overhead: condenser, reflux drum, reflux and distillate
    const PV = [[0, yt, 0], [0, yt + .6, 0], [1.6, yt + .6, 0]], PC = [[2.9, yt + .6, 0], [3.25, yt + .6, 0], [3.25, yt - .2, 0]], PR = [[2.75, yt - .5, 0], [1.3, yt - .5, 0], [1.3, top + .2, 0], [R - .05, top + .2, 0]], PD = [[3.75, yt - .5, 0], [4.7, yt - .5, 0]];
    v.cyl(.36, 1.3, 0x7fb2e5, [2.25, yt + .6, 0], { rot: [0, 0, Math.PI / 2] }); v.cyl(.3, 1, MET, [3.25, yt - .5, 0], { rot: [0, 0, Math.PI / 2] });
    v.pipe([[1.9, yt + 1.35, 0], [1.9, yt + .9, 0]], .05, 0x2f7fd8); v.pipe([[2.6, yt + .3, 0], [2.6, yt - .05, 0]], .05, 0x2f7fd8);
    // bottom: liquid to kettle reboiler, vapour back, bottoms out, steam coil
    const PB = [[0, y0, 0], [0, .35, 0], [1.3, .35, 0]], PVR = [[2, .82, 0], [2, 1.3, 0], [R - .05, 1.3, 0]], PBo = [[2.75, .2, 0], [3.8, .2, 0]], PF = [[-2.9, yf + .3, 0], [-R + .05, yf + .3, 0]];
    v.cyl(.45, 1.4, 0xb06a4a, [2, .38, 0], { rot: [0, 0, Math.PI / 2] }); v.pipe([[1.7, -.35, 0], [1.7, .2, 0], [2.4, .2, 0], [2.4, -.35, 0]], .04, 0xd04030);
    [PV, PC, PR, PD, PB, PVR, PBo, PF].forEach(P => v.pipe(P, .06, MET, { op: .35 }));
    const top1 = () => st.steps[0].y, xn = () => st.steps[n - 1].x, rb = () => st.steps[n];
    [[PV, top1, 40, .35], [PC, () => st.xD, 25, .35], [PR, () => st.xD, 40, .3], [PD, () => st.xD, 25, .3], [PF, () => st.xF, 35, .3], [PB, xn, 30, .3], [PVR, () => rb().y, 30, .4], [PBo, () => rb().x, 25, .3]]
      .forEach(([P, c, k, sp2]) => cstream(v, k, .1, u => pathAt(P, u), (u, i) => pick(i, c()), sp2));
    const tg = { cond: v.tag('', [2.25, yt + 1.05, 0], 'cond'), refl: v.tag('', [1.3, top + .9, 0], 'refl'), dist: v.tag('', PD[1], 'dist'), feed: v.tag('', PF[0], 'feed'),
      ttop: v.tag('', [-R, top, 0], 'ttop'), tfeed: v.tag('', [R, yf, 0], 'tfeed'), tbot: v.tag('', [-R, bot, 0], 'tbot'), reb: v.tag('', [2, -.15, 0], 'reb'), btm: v.tag('', PBo[1], 'btm') };
    return { tl, tg };
  }
  // (re)build when the tray count or feed tray changes; colour trays by temperature; refresh labels
  function show3d(w, S, st) {
    if (!w.ok) return; const key = st.n + '|' + st.feed;
    if (S._k !== key) { S._k = key; w.clear(); S._c = st.n > 0 ? col3d(w, st) : null; S._w = 0; if (S._hi) w.hi(S._hi); }
    const c = S._c; if (!c) return; const T = st.T, lo = Math.min(...T), hi = Math.max(...T);
    c.tl.forEach((m, k) => m.material.color.copy(tcol((T[k] - lo) / (hi - lo || 1))));
    for (const k in st.lab) setTag(c.tg[k], st.lab[k]);
    const ww = w.el.clientWidth || 700, kk = Math.min(2.4, Math.max(1, 640 / ww)); if (S._w !== kk) { S._w = kk; w.look([1 + 2 * kk, 5.4, 15 * kk], [.9, 4.4, 0]); }
  }

  // shared McCabe-Thiele solve used by several topics
  function design(s) {
    const P = s.P * ATM, r = C.rmin(s.sys, P, s.xF, s.xD, s.q), R = r.Rmin * s.RR, E = C.colburn(s.E ?? 1, s.psi ?? 0);
    const m = C.mccabe({ sys: s.sys, P, xF: s.xF, xD: s.xD, xB: s.xB, q: s.q, R, E, feedStage: s.fs || null, maxN: 120 });
    const tot = C.mccabe({ sys: s.sys, P, xF: s.xF, xD: s.xD, xB: s.xB, q: s.q, R: 1e7, E: 1, maxN: 200 });
    const v = C.vle(s.sys, P), aTop = v.alpha(Math.min(s.xD, .999)), aBot = v.alpha(Math.max(s.xB, .001)), aAvg = Math.sqrt(aTop * aBot);
    return { P, r, R, E, m, Nmin: tot.ok ? tot.Nfrac : NaN, aAvg, NminF: C.fenske(s.xD, s.xB, aAvg), v };
  }

  T201.distillation = [
    {
      id: 'column', title: 'Inside a distillation column: trays, reboiler, condenser & balances', tags: 'distillation column 3d tray temperature profile reboiler condenser reflux drum feed rectifying stripping heat balance material balance energy balance duty q',
      blurb: 'Watch vapour and liquid swap molecules on every tray; live mass and energy balance.',
      lead: 'A distillation column is a stack of trays. Vapour from the <b>reboiler</b> bubbles up through the liquid on each tray, and liquid <b>reflux</b> from the <b>condenser</b> flows down. On every tray the two phases swap molecules: the light component moves into the vapour and the heavy component into the liquid. Gold molecules are the light component and purple the heavy one; tray colour shows temperature.',
      render(el, UI) {
        const S = UI.sim(el, {
          title: 'Column', controls: [sysCtl(), { k: 'P', label: 'Column pressure', min: .3, max: 3, step: .01, v: 1, unit: 'atm' }, { k: 'F', label: 'Feed F', min: 10, max: 500, step: 1, v: 100, unit: 'kmol/h' }, { k: 'xF', label: 'Feed x_F (light)', min: .1, max: .9, step: .01, v: .45 },
            { k: 'TF', label: 'Feed temperature T_F', min: 20, max: 150, step: 1, v: 85, unit: '°C' }, { k: 'xD', label: 'Distillate x_D', min: .6, max: .995, step: .001, v: .95 }, { k: 'xB', label: 'Bottoms x_B', min: .005, max: .3, step: .001, v: .05 }, { k: 'RR', label: 'Reflux ratio R / R<sub>min</sub>', min: 1.1, max: 4, step: .01, v: 1.5 }],
          views: [{ k: 'v', t: '3d', h: 560, cam: [3, 5.4, 15], target: [.9, 4.4, 0] }, { k: 'bal', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 320 }, { k: 'q', t: 'plot', row: 'r', h: 320 }],
          update(s, V, S) {
            const c = colCalc(s), m = c.m, st = S.st || (S.st = {}), f1 = x => UI.fmt(x, 1), kw = x => UI.fmt(x, 1) + ' kW';
            if (c.az || !m || !m.ok) { V.ro.set([['Infeasible', c.az ? `x_D is above the azeotrope (${UI.fmt(c.v.az, 3)}): no column can reach it` : 'pinch: raise R / R_min', 'bad']]); V.bal.innerHTML = ''; return; }
            const N = m.N, n = N - 1, T = m.steps.map(k => c.v.T(k.x));
            Object.assign(st, { n, feed: m.feed, steps: m.steps, xF: s.xF, xD: s.xD, T, lab: {
              cond: `Condenser: Q_C = ${kw(c.Qc)}`, refl: `Reflux L = ${f1(c.L)} kmol/h`, dist: `Distillate D = ${f1(c.D)}, x_D = ${s.xD}`, feed: `Feed F = ${f1(s.F)} → tray ${Math.min(m.feed, n)}, q = ${UI.fmt(c.q, 2)}`,
              ttop: `Top tray ${f1(T[0])} °C`, tfeed: `Feed tray ${f1(T[Math.min(m.feed, n) - 1])} °C`, tbot: `Bottom tray ${f1(T[n - 1])} °C`, reb: `Reboiler ${f1(T[N - 1])} °C: Q_R = ${kw(c.Qr)}`, btm: `Bottoms B = ${f1(c.B)}, x_B = ${UI.fmt(c.xB, 3)}` } });
            show3d(V.v, S, st);
            const lF = s.F * s.xF, lD = c.D * s.xD, lB = c.B * c.xB, eIn = s.F * c.hF / 3600 + c.Qr, eOut = c.D * c.hD / 3600 + c.B * c.hB / 3600 + c.Qc, r3 = x => UI.fmt(x, 3), z0 = x => Math.abs(x) < 1e-9 ? '0' : UI.fmt(x, 3);
            V.bal.innerHTML = ''; V.bal.append(UI.h('h3', null, 'Live balance around the whole column'), UI.table(['Balance', 'In', 'Out', 'In − Out'], [
              ['Total moles (kmol/h)', `F = ${r3(s.F)}`, `D + B = ${r3(c.D)} + ${r3(c.B)}`, z0(s.F - c.D - c.B)],
              [`${light(s.sys)} (kmol/h)`, `F·x_F = ${r3(lF)}`, `D·x_D + B·x_B = ${r3(lD)} + ${r3(lB)}`, z0(lF - lD - lB)],
              ['Energy (kW)', `F·h_F + Q_R = ${r3(s.F * c.hF / 3600)} + ${r3(c.Qr)}`, `D·h_D + B·h_B + Q_C = ${r3(c.D * c.hD / 3600)} + ${r3(c.B * c.hB / 3600)} + ${r3(c.Qc)}`, z0(eIn - eOut)]], [3]),
              UI.h('p', { class: 'hint' }, `Q_R comes from the energy balance. Cross-check with constant molal overflow, Q_R ≈ V̄·λ_B = ${kw(c.Qcmo)} (${UI.fmt(100 * (c.Qcmo - c.Qr) / c.Qr, 2)} % from the full balance). The gap is the CMO error from unequal latent heats and sensible heat.`));
            V.ro.set([['Feed q (from T_F)', UI.fmt(c.q, 4), c.q > 1 ? 'warn' : ''], ['Feed bubble / dew point', f1(c.Tbub) + ' / ' + f1(c.Tdew) + ' °C'], ['R_min → R', UI.fmt(c.d.r.Rmin, 3) + ' → ' + UI.fmt(c.R, 3), 'ok'], ['Ideal stages (incl. reboiler)', N + '', 'ok'], ['Trays · feed tray', n + ' · ' + Math.min(m.feed, n)],
              ['V / V̄ (vapour, kmol/h)', f1(c.V) + ' / ' + f1(c.Vb)], ['L / L̄ (liquid, kmol/h)', f1(c.L) + ' / ' + f1(c.Lb)], ['Recovery of light in D', UI.fmt(100 * lD / lF, 2) + ' %'], ['Q_C · Q_R', kw(c.Qc) + ' · ' + kw(c.Qr)]]);
            const st1 = m.steps.map((k, i) => i + 1), p = V.p.frame({ x: [1, N], y: [Math.min(...T) - 2, Math.max(...T) + 2], xl: 'Stage (1 = top tray, last = reboiler)', yl: 'Temperature (°C)', xs: 'stage', ys: 'T' });
            p.line(st1.map((k, i) => [k, T[i]]), { c: 'c1', l: 'Tray temperature (bubble point of tray liquid)' }); p.pts(st1.map((k, i) => [k, T[i]]), { c: 'c1', r: 3 }); p.vl(m.feed, { c: 'c5', l: 'feed' }); p.done();
            const q = V.q.frame({ x: [1, N], y: [0, 1], xl: 'Stage', yl: `Mole fraction ${light(s.sys)}`, xs: 'stage', ys: 'x,y' });
            q.line(st1.map((k, i) => [k, m.steps[i].y]), { c: 'c3', l: 'vapour y' }); q.line(st1.map((k, i) => [k, m.steps[i].x]), { c: 'c2', l: 'liquid x' }); q.vl(m.feed, { c: 'c5' }); q.done();
          }
        });
        UI.walk(el, [
          { t: '1 · The reboiler boils the bottom liquid', d: 'Liquid reaching the bottom is mostly the heavy component (purple). Steam in the reboiler boils part of it, and that vapour rises up the column. The reboiler duty Q_R is the heat that drives the whole separation.', hi: ['reb', 'btm'], set: { RR: 1.5 } },
          { t: '2 · Vapour bubbles through every tray', d: 'On each tray hot vapour bubbles through slightly cooler liquid. Heavy molecules condense into the liquid, and the heat they release boils light molecules out of it. Watch purple molecules turn gold as the vapour climbs. A tray that reaches equilibrium is one <b>ideal stage</b>.', hi: ['ttop', 'tbot'] },
          { t: '3 · Condense and send part back (reflux)', d: 'The top vapour is condensed. Part of it returns as <b>reflux</b> L = R·D and washes heavy component back down; the rest leaves as <b>distillate</b> D. Total condenser: Q_C = V·λ.', hi: ['cond', 'refl', 'dist'] },
          { t: '4 · The feed enters in the middle', d: 'The feed enters the tray whose liquid is closest to it in composition (the optimum feed tray). Above it the <b>rectifying</b> section enriches the vapour; below it the <b>stripping</b> section removes the light component from the liquid.', hi: ['feed', 'tfeed'] },
          { t: '5 · Temperature falls up the column', d: 'Every tray liquid sits at its bubble point. The bottom is nearly pure heavy component, so it is hottest; the top is nearly pure light component, so it is coolest. Tray colour and the plot below show this profile.', hi: ['ttop', 'tfeed', 'tbot'] },
          { t: '6 · Turn up the reflux', d: 'At R = 3 R<sub>min</sub> fewer trays are needed, but V = (R + 1)D grows, so both Q_C and Q_R rise. The balance table shows the energy cost; moles in still equal moles out.', hi: ['cond', 'reb'], set: { RR: 3 } }
        ], (i, x) => { S._hi = x.hi; if (x.set) Object.entries(x.set).forEach(([k, v]) => S.set(k, v)); S.V.v.hi && S.V.v.hi(x.hi); });
        UI.note(el, 'Model: ideal stages stepped by McCabe–Thiele with constant molal overflow; tray temperatures are bubble points from Antoine + activity coefficients. Energy: enthalpies relative to pure liquids at 25 °C, h<sub>L</sub> = c<sub>p,L</sub>(T − 25); feed enthalpy h<sub>F</sub> = h<sub>bub</sub> + (1 − q)λ; heat of mixing neglected; λ at the normal boiling point; saturated-liquid products and reflux.');
      },
      eqs: [
        { n: 'Overall & component balance', m: 'F = D + B,\\qquad Fx_F = Dx_D + Bx_B' },
        { n: 'Internal flows (CMO)', m: 'L = RD,\\ V = (R+1)D,\\ \\bar L = L + qF,\\ \\bar V = V-(1-q)F' },
        { n: 'Condenser duty (total condenser)', m: 'Q_C = V\\lambda_D' },
        { n: 'Overall energy balance', m: 'Fh_F + Q_R = Dh_D + Bh_B + Q_C' },
        { n: 'Feed thermal condition', m: 'q = \\frac{H_V-h_F}{H_V-h_L} = 1+\\frac{c_{p,L}(T_b-T_F)}{\\lambda}\\ (\\text{subcooled})' }],
      fx: [['↑ Reflux R', 'fewer trays; Q_C and Q_R rise with (R + 1)'], ['Colder feed (q > 1)', 'Q_R rises, Q_C unchanged'], ['Vapour feed (q < 1)', 'Q_R falls, more vapour in the rectifier'], ['↑ Pressure', 'all tray temperatures rise; α usually falls → more trays']],
      quiz: [{ q: 'F = 100, x_F = 0.4, x_D = 0.95, x_B = 0.05. D is…', o: ['40.0', '38.9', '35.0', '50.0'], a: 1, ex: 'D = F(x_F − x_B)/(x_D − x_B) = 100(0.35)/(0.90) = 38.9 kmol/h.' }, { q: 'The hottest point in a distillation column is…', o: ['the condenser', 'the feed tray', 'the reboiler', 'the reflux drum'], a: 2 }, { q: 'On a tray, light component moves into the vapour because…', o: ['vapour is lighter', 'the liquid and vapour approach equilibrium and the light component is more volatile', 'the tray is heated', 'of gravity'], a: 1 }],
      refs: ["<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill, Ch. 21.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 7.", "<i>Kister, H.Z.</i> (1992) <i>Distillation Design</i>, McGraw-Hill.", "<i>NIST Chemistry WebBook</i>, SRD 69 (Linstrom & Mallard, eds.): heats of vaporisation, liquid and ideal-gas heat capacities.", "<i>Felder, R.M. & Rousseau, R.W.</i> (2005) <i>Elementary Principles of Chemical Processes</i>, 3rd ed., Wiley, Ch. 4 & 8.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 9 (distillation)."]
    },

    {
      id: 'vle', title: 'Boiling-point & equilibrium diagrams', tags: 'vle txy xy boiling point dew point bubble point relative volatility azeotrope raoult antoine',
      blurb: 'T–x–y and x–y diagrams from Antoine + activity models, at any pressure.',
      lead: 'Distillation works because the vapour over a boiling liquid is richer in the more volatile component. The <b>boiling-point diagram</b> (T–x–y) and the <b>equilibrium diagram</b> (x–y) show how much richer, at a given pressure.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Mixture', controls: [sysCtl(), { k: 'P', label: 'Pressure', min: .1, max: 5, step: .01, v: 1, unit: 'atm' }, { t: 'sep', label: 'Probe a mixture' }, { k: 'z', label: 'Overall mole fraction of light comp. z', min: .001, max: .999, step: .001, v: .4 }, { k: 'T', label: 'Temperature', min: 0, max: 200, step: .1, v: 95, unit: '°C' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 380 }, { k: 'q', t: 'plot', row: 'r', h: 380 }],
          update(s, V) {
            const P = s.P * ATM, v = C.vle(s.sys, P), b = C.bubble(s.sys, s.z, P), d = C.dew(s.sys, s.z, P), [g1, g2] = C.gamma(s.sys, s.z);
            let phase = 'liquid', xL = NaN, yV = NaN, fV = 0;
            if (s.T >= d.T) { phase = 'superheated vapour'; fV = 1; } else if (s.T > b.T) { phase = 'two-phase'; xL = C.bisect(x => v.T(x) - s.T, 0, v.az || 1); yV = v.y(xL); fV = (s.z - xL) / (yV - xL); }
            V.ro.set([['Bubble point', UI.fmt(b.T, 2) + ' °C'], ['Dew point', UI.fmt(d.T, 2) + ' °C'], ['y* in equilibrium with z', UI.fmt(b.y, 4)], ['Relative volatility α', UI.fmt(v.alpha(s.z), 3)], ['γ₁ / γ₂', UI.fmt(g1, 3) + ' / ' + UI.fmt(g2, 3)], ['Azeotrope', v.az ? 'x = ' + UI.fmt(v.az, 3) + ' at ' + UI.fmt(v.T(v.az), 2) + ' °C' : 'none', v.az ? 'warn' : ''], ['State at T', phase, phase === 'two-phase' ? 'ok' : ''], ['Vapour fraction (lever rule)', UI.fmt(fV, 3)]]);
            const Tlo = Math.min(...v.Ts), Thi = Math.max(...v.Ts), pad = (Thi - Tlo) * .12 + 1;
            const p = V.p.frame({ x: [0, 1], y: [Tlo - pad, Thi + pad], xl: `x, y — mole fraction ${light(s.sys)}`, yl: 'Temperature (°C)', xs: 'x,y', ys: 'T' });
            p.line(v.xs.map((x, i) => [x, v.Ts[i]]), { c: 'c2', l: 'Bubble-point (saturated liquid)' }); p.line(v.ys.map((y, i) => [y, v.Ts[i]]), { c: 'c1', l: 'Dew-point (saturated vapour)' });
            p.vl(s.z); p.hl(s.T); if (phase === 'two-phase') { p.line([[xL, s.T], [yV, s.T]], { c: 'tx', w: 2.5 }); p.pts([[xL, s.T], [yV, s.T]], { c: 'tx' }); }
            p.pts([[s.z, s.T]], { c: 'c3', r: 6 }); p.text(.02, Tlo - pad * .3, 'LIQUID', { c: 'mu', size: 11 }); p.text(.98, Thi + pad * .7, 'VAPOUR', { c: 'mu', size: 11, al: 'right', bl: 'top' }); p.done();
            const q = V.q.frame({ x: [0, 1], y: [0, 1], xl: 'x (liquid)', yl: 'y (vapour)', xs: 'x', ys: 'y' });
            q.line(v.xs.map((x, i) => [x, v.ys[i]]), { l: 'Equilibrium curve' }); q.fn(x => x, 0, 1, { c: 'mu', w: 1, l: 'y = x' });
            const a = v.alpha(.5); q.fn(x => a * x / (1 + (a - 1) * x), 0, 1, { c: 'c2', dash: [4, 4], w: 1.2, l: `constant α = ${UI.fmt(a, 2)}` }); q.pts([[s.z, b.y]], { c: 'tx', r: 5 }); q.done();
          }
        });
        UI.note(el, 'Try <b>ethanol–water</b>: the curves touch at the azeotrope — liquid and vapour have the same composition, so ordinary distillation cannot pass ≈ 89 mol % ethanol. Lower the pressure and watch the azeotrope shift (the azeotrope disappears below about 0.1 atm, ≈ 70 mmHg).');
      },
      eqs: [
        { n: 'Antoine equation', m: '\\log_{10}P^{sat}[\\text{mmHg}] = A - \\frac{B}{T[^\\circ C]+C}' },
        { n: 'Modified Raoult’s law', m: 'y_iP = \\gamma_i x_i P_i^{sat}' },
        { n: 'Bubble point', m: '\\sum_i \\gamma_i x_i P_i^{sat}(T) = P' },
        { n: 'Relative volatility', m: '\\alpha_{12} = \\frac{y_1/x_1}{y_2/x_2} = \\frac{\\gamma_1P_1^{sat}}{\\gamma_2P_2^{sat}}' },
        { n: 'Constant-α equilibrium', m: 'y = \\frac{\\alpha x}{1+(\\alpha-1)x}' }],
      fx: [['↑ Pressure', 'all boiling points rise; α usually falls → harder separation'], ['α → 1', 'curves pinch together → many stages'], ['Positive deviation (γ > 1)', 'can create minimum-boiling azeotrope'], ['↑ Temperature at fixed z (two-phase region)', 'more vapour; both phases get richer in heavy component']],
      quiz: [{ q: 'Between the bubble and dew curves the mixture is…', o: ['subcooled liquid', 'two phases in equilibrium', 'superheated vapour', 'supercritical'], a: 1 }, { q: 'At an azeotrope α equals…', o: ['0', '1', '∞', 'the ratio of vapour pressures'], a: 1 }],
      refs: ["<i>Smith, J.M., Van Ness, H.C. & Abbott, M.M.</i> (2005) <i>Introduction to Chemical Engineering Thermodynamics</i>, 7th ed., McGraw-Hill, Ch. 10–12.", "<i>Poling, B.E., Prausnitz, J.M. & O’Connell, J.P.</i> (2001) <i>The Properties of Gases and Liquids</i>, 5th ed., McGraw-Hill. (Antoine constants)", "<i>Gmehling, J. & Onken, U.</i> (1977–) <i>Vapor–Liquid Equilibrium Data Collection</i>, DECHEMA Chemistry Data Series. (Van Laar parameters)", "<i>Horsley, L.H.</i> (1973) <i>Azeotropic Data III</i>, Adv. Chem. Ser. 116, ACS.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 9 (distillation)."]
    },

    {
      id: 'methods', title: 'Methods of distillation: flash, differential, steam', tags: 'flash equilibrium distillation differential simple rayleigh batch steam distillation azeotropic extractive vacuum',
      blurb: 'Single-stage processes and the Rayleigh equation.',
      lead: 'Before columns: the simplest distillations are a single equilibrium stage (<b>flash</b>), a slowly boiled-off batch (<b>differential / simple</b>), and boiling with live steam for immiscible, heat-sensitive organics (<b>steam distillation</b>).',
      render(el, UI) {
        const tb = UI.tabs(el, ['Flash (equilibrium)', 'Differential (Rayleigh)', 'Steam distillation', 'Other methods']);
        UI.sim(tb.panes[0], {
          title: 'Flash drum', controls: [sysCtl(), { k: 'P', label: 'Drum pressure', min: .2, max: 3, step: .01, v: 1, unit: 'atm' }, { k: 'z', label: 'Feed z', min: .02, max: .98, step: .01, v: .5 }, { k: 'f', label: 'Fraction vaporised f = V/F', min: .01, max: .99, step: .01, v: .5 }, { k: 'F', label: 'Feed', min: 1, max: 500, step: 1, v: 100, unit: 'kmol/h' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 380 }],
          update(s, V) {
            const P = s.P * ATM, r = C.flash(s.sys, P, s.z, s.f), v = C.vle(s.sys, P);
            V.ro.set([['Drum temperature', UI.fmt(r.T, 2) + ' °C', 'ok'], ['Liquid x', UI.fmt(r.x, 4)], ['Vapour y', UI.fmt(r.y, 4)], ['Vapour flow V', UI.fmt(s.f * s.F, 2) + ' kmol/h'], ['Liquid flow L', UI.fmt((1 - s.f) * s.F, 2) + ' kmol/h'], ['Light comp. recovered in vapour', UI.fmt(s.f * r.y / s.z * 100, 2) + ' %'], ['q-line slope −(1−f)/f', UI.fmt(-(1 - s.f) / s.f, 3)]]);
            const p = V.p.frame({ x: [0, 1], y: [0, 1], xl: 'x', yl: 'y', xs: 'x', ys: 'y' }); p.line(v.xs.map((x, i) => [x, v.ys[i]]), { l: 'Equilibrium' }); p.fn(x => x, 0, 1, { c: 'mu', w: 1 });
            p.fn(x => s.z - (1 - s.f) / s.f * (x - s.z), 0, 1, { c: 'c2', l: 'Flash operating line' }); p.pts([[s.z, s.z]], { c: 'c3', r: 5 }); p.pts([[r.x, r.y]], { c: 'tx', r: 6 }); p.text(r.x, r.y, '  (x, y)', {}); p.done();
          }
        });
        UI.sim(tb.panes[1], {
          title: 'Batch still (single stage)', controls: [sysCtl(), { k: 'P', label: 'Pressure', min: .2, max: 3, step: .01, v: 1, unit: 'atm' }, { k: 'x0', label: 'Initial charge x_F', min: .05, max: .95, step: .01, v: .5 }, { k: 'dist', label: 'Fraction distilled off (D/F)', min: .02, max: .95, step: .01, v: .4 }, { k: 'F', label: 'Charge F', min: 1, max: 100, step: 1, v: 10, unit: 'kmol' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 330 }, { k: 'q', t: 'plot', row: 'r', h: 330 }],
          update(s, V) {
            const P = s.P * ATM, target = Math.log(1 / (1 - s.dist)), xW = C.bisect(xw => C.rayleigh(s.sys, P, s.x0, xw, 120).lnFW - target, 1e-6, s.x0 - 1e-6), W = s.F * (1 - s.dist), xDav = (s.F * s.x0 - W * xW) / (s.F - W), ra = C.rayleigh(s.sys, P, s.x0, xW, 150), v = C.vle(s.sys, P);
            V.ro.set([['Residue W', UI.fmt(W, 3) + ' kmol'], ['Residue x_W', UI.fmt(xW, 4), 'ok'], ['Average distillate x_D,avg', UI.fmt(xDav, 4), 'ok'], ['ln(F/W) = ∫dx/(y−x)', UI.fmt(target, 4)], ['Still temp: start → end', UI.fmt(v.T(s.x0), 1) + ' → ' + UI.fmt(v.T(xW), 1) + ' °C'], ['Compare: flash at same f', 'x = ' + UI.fmt(C.flash(s.sys, P, s.x0, s.dist).x, 4)]]);
            const p = V.p.frame({ x: [0, 1], y: [0, Math.min(Math.max(...ra.g) * 1.15, 60)], xl: 'x in still', yl: '1 / (y* − x)', xs: 'x', ys: 'f' });
            p.fn(x => 1 / (v.y(x) - x), .005, .995, { c: 'mu', w: 1.2 }); p.line([[xW, 0]].concat(ra.xs.map((x, i) => [x, ra.g[i]]), [[s.x0, 0]]), { fill: 1, fa: .2, c: 'c1' }); p.line(ra.xs.map((x, i) => [x, ra.g[i]]), { l: 'area = ln(F/W)' }); p.done();
            const q = V.q.frame({ x: [0, s.dist], y: [0, 1], xl: 'Fraction distilled', yl: 'mole fraction', xs: 'D/F', ys: 'x' });
            const pts = C.linspace(.001, s.dist, 40).map(d => { const t = Math.log(1 / (1 - d)), xw = C.bisect(xx => C.rayleigh(s.sys, P, s.x0, xx, 60).lnFW - t, 1e-6, s.x0 - 1e-6); return [d, xw, v.y(xw), (s.x0 - (1 - d) * xw) / d]; });
            q.line(pts.map(a => [a[0], a[1]]), { c: 'c2', l: 'still liquid x_W' }); q.line(pts.map(a => [a[0], a[2]]), { c: 'c1', l: 'instant distillate y*' }); q.line(pts.map(a => [a[0], a[3]]), { c: 'c3', dash: [5, 4], l: 'collected distillate (average)' }); q.done();
          }
        });
        const SC = { benzene: 'Benzene', toluene: 'Toluene', hexane: 'n-Hexane', heptane: 'n-Heptane' };
        UI.sim(tb.panes[2], {
          title: 'Immiscible organic + water', controls: [{ k: 'o', t: 'select', label: 'Organic (immiscible with water)', v: 'toluene', opts: SC }, { k: 'P', label: 'Total pressure', min: .1, max: 2, step: .01, v: 1, unit: 'atm' }, { k: 'E', label: 'Vaporisation efficiency', min: .5, max: 1, step: .01, v: .9 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 340 }],
          update(s, V) {
            const P = s.P * ATM, T = C.bisect(T => C.psat(s.o, T) + C.psat('water', T) - P, -20, 200), po = C.psat(s.o, T), pw = C.psat('water', T), mr = pw * 18.015 / (po * C.comp[s.o].M) / s.E;
            V.ro.set([['Boiling temperature', UI.fmt(T, 2) + ' °C', 'ok'], ['Organic alone boils at', UI.fmt(C.tsat(s.o, P), 2) + ' °C'], ['Water alone boils at', UI.fmt(C.tsat('water', P), 2) + ' °C'], ['p organic / p water', UI.fmt(po / 1000, 2) + ' / ' + UI.fmt(pw / 1000, 2) + ' kPa'], ['Steam required', UI.fmt(mr, 3) + ' kg / kg organic']]);
            const p = V.p.frame({ x: [20, 120], y: [0, P * 1.6 / 1000], xl: 'T (°C)', yl: 'Pressure (kPa)', xs: 'T', ys: 'p' });
            p.fn(t => C.psat('water', t) / 1000, 20, 120, { c: 'c2', l: 'water' }); p.fn(t => C.psat(s.o, t) / 1000, 20, 120, { c: 'c5', l: SC[s.o] }); p.fn(t => (C.psat('water', t) + C.psat(s.o, t)) / 1000, 20, 120, { c: 'c1', w: 2.6, l: 'sum (immiscible liquids)' }); p.hl(P / 1000, { l: 'total P' }); p.pts([[T, P / 1000]], { c: 'tx', r: 6 }); p.done();
          }
        });
        UI.para(tb.panes[3], '<ul style="margin-top:14px"><li><b>Vacuum distillation</b> — lowers boiling points for heat-sensitive or very high-boiling materials (lube oils, vitamins); often raises α.</li><li><b>Azeotropic distillation</b> — an entrainer forms a new, heterogeneous azeotrope that can be decanted (benzene or cyclohexane to dehydrate ethanol).</li><li><b>Extractive distillation</b> — a high-boiling solvent added near the top changes activity coefficients and raises α (ethylene glycol for ethanol–water, NMP for butadiene).</li><li><b>Pressure-swing distillation</b> — two columns at different pressures exploit azeotrope shift with pressure.</li><li><b>Molecular (short-path) distillation</b> — very high vacuum, path shorter than the mean free path (fish oils, vitamins).</li><li><b>Fractional (continuous rectification)</b> — repeated stages with reflux; the next topics.</li></ul>');
      },
      eqs: [
        { n: 'Flash operating line', m: 'y = -\\frac{1-f}{f}x + \\frac{z}{f}' },
        { n: 'Rayleigh equation', m: '\\ln\\frac{F}{W} = \\int_{x_W}^{x_F}\\frac{dx}{y^*-x}' },
        { n: 'Rayleigh, constant α', m: '\\ln\\frac{F}{W} = \\frac{1}{\\alpha-1}\\left[\\ln\\frac{x_F}{x_W}+\\alpha\\ln\\frac{1-x_W}{1-x_F}\\right]' },
        { n: 'Steam distillation', m: 'P = p_o^{sat}(T)+p_w^{sat}(T),\\quad \\frac{m_w}{m_o} = \\frac{p_w M_w}{p_o M_o\\,E}' }],
      fx: [['↑ Fraction vaporised (flash)', 'more vapour, but both x and y fall'], ['Differential vs flash at same split', 'differential gives a richer distillate (many infinitesimal flashes)'], ['↓ Pressure (steam distillation)', 'lower T and less steam per kg organic'], ['Higher-boiling organic', 'more steam needed per kg (smaller p_o)']],
      quiz: [{ q: 'In steam distillation the mixture boils below 100 °C at 1 atm because…', o: ['water forms an ideal solution', 'the immiscible liquids each exert their full vapour pressure', 'steam is superheated', 'the organic decomposes'], a: 1 }],
      refs: ["<i>Rayleigh, Lord</i> (1902) On the distillation of binary mixtures. <i>Phil. Mag.</i> (6) 4, 521–537.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 7.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 9 (distillation).", "<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill, Ch. 21.", "<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 13."]
    },

    {
      id: 'mccabe', title: 'Number of plates (McCabe–Thiele), feed plate & column', tags: 'mccabe thiele plates stages q line feed plate location reflux fenske gilliland underwood rectifying stripping murphree 3d column',
      blurb: 'Step off stages, move the feed, change reflux — and see the column in 3-D.',
      lead: 'With constant molal overflow (CMO), the rectifying and stripping operating lines are straight. Stepping between them and the equilibrium curve counts the ideal stages. The <b>feed stage</b> is optimal where the step crosses the intersection of the two lines.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Column specification', controls: [sysCtl(), { k: 'P', label: 'Pressure', min: .2, max: 3, step: .01, v: 1, unit: 'atm' }, { k: 'xF', label: 'Feed $x_F$', min: .05, max: .9, step: .01, v: .45 }, { k: 'xD', label: 'Distillate $x_D$', min: .5, max: .995, step: .001, v: .95 }, { k: 'xB', label: 'Bottoms $x_B$', min: .005, max: .4, step: .001, v: .05 },
            { k: 'q', label: 'Feed condition q', min: -.5, max: 1.6, step: .01, v: 1, hint: 'q = 1 saturated liquid · 0 saturated vapour · >1 subcooled · <0 superheated' }, { k: 'RR', label: 'Reflux ratio R / R<sub>min</sub>', min: 1.02, max: 5, step: .01, v: 1.5 },
            { k: 'E', label: 'Murphree efficiency $E_{MV}$', min: .3, max: 1, step: .01, v: 1 }, { k: 'psi', label: 'Entrainment ψ', min: 0, max: .3, step: .01, v: 0 }, { k: 'fs', label: 'Force feed stage (0 = optimal)', min: 0, max: 40, step: 1, v: 0 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 460 }, { k: 'v', t: '3d', h: 520, cam: [3, 5.4, 15], target: [.9, 4.4, 0] }, { k: 'tb', t: 'html' }],
          update(s, V, S) {
            const xD = s.xD, xB = Math.min(s.xB, s.xF - .01), d = design({ ...s, xB }), { m, v } = d;
            if (v.az && xD > v.az) { V.ro.set([['Infeasible', `x_D exceeds the azeotrope (${UI.fmt(v.az, 3)})`, 'bad']]); V.p.frame({ x: [0, 1], y: [0, 1] }).done(); return; }
            const Ng = C.gilliland(d.R, d.r.Rmin, d.Nmin);
            V.ro.set([['R<sub>min</sub>', UI.fmt(d.r.Rmin, 4)], ['R (actual)', UI.fmt(d.R, 4), 'ok'], ['Pinch at (x, y)', `${UI.fmt(d.r.xp, 3)}, ${UI.fmt(d.r.yp, 3)}`], ['N<sub>min</sub> total reflux (stepping)', UI.fmt(d.Nmin, 2)], ['N<sub>min</sub> Fenske (α = ' + UI.fmt(d.aAvg, 3) + ')', UI.fmt(d.NminF, 2)], ['<b>Stages (graphical)</b>', m.ok ? m.N + ' (' + UI.fmt(m.Nfrac, 2) + ')' : '∞ / pinch', m.ok ? 'ok' : 'bad'], ['Feed stage (from top)', m.ok ? m.feed + '' : '—'], ['Gilliland estimate', UI.fmt(Ng, 2)], ['Trays in column (excl. reboiler)', m.ok ? (m.N - 1) + '' : '—'], ['Effective E (Colburn)', UI.fmt(d.E, 3)]]);
            const p = V.p.frame({ x: [0, 1], y: [0, 1], xl: `x — ${light(s.sys)} in liquid`, yl: 'y — in vapour', xs: 'x', ys: 'y', legB: 1 });
            p.line(v.xs.map((x, i) => [x, v.ys[i]]), { l: 'Equilibrium' }); if (d.E < 1) p.fn(x => { const yo = x < m.xi ? m.strip(x) : m.rect(x); return yo + d.E * (v.y(x) - yo); }, xB, xD, { c: 'c1', dash: [4, 4], w: 1.3, l: 'Pseudo-equilibrium (E_MV)' });
            p.fn(x => x, 0, 1, { c: 'mu', w: 1 }); p.line([[m.xi, m.yi], [xD, xD]], { c: 'c2', l: 'Rectifying line' }); p.line([[xB, xB], [m.xi, m.yi]], { c: 'c4', l: 'Stripping line' }); p.line([[s.xF, s.xF], [m.xi, m.yi]], { c: 'c5', l: 'q-line' });
            const st = [[xD, xD]]; m.steps.forEach(k => { st.push([k.x, k.y], [k.x, k.section === 'S' ? m.strip(k.x) : m.rect(k.x)]); }); p.line(st, { c: 'c3', w: 1.6, l: 'Stages' });
            m.steps.forEach(k => p.text(k.x, k.y, String(k.n), { dx: -12, dy: -2, size: 10, c: k.n === m.feed ? 'c5' : 'c3', b: k.n === m.feed }));
            p.pts([[xD, xD], [xB, xB], [s.xF, s.xF]], { c: 'tx', r: 4 }); p.text(xD, xD, 'x_D ', { al: 'right', bl: 'top', dy: 4 }); p.text(xB, xB, ' x_B', { bl: 'top', dy: 4 }); p.text(s.xF, s.xF, ' x_F', { bl: 'top', dy: 4 }); p.done();
            // stage table
            V.tb.innerHTML = ''; V.tb.append(UI.h('h3', null, 'Stage-by-stage profile'), UI.table(['Stage', 'Section', 'x (liquid)', 'y (vapour)', 'T (°C)'], m.steps.map(k => [k.n + (k.n === m.feed ? ' ← feed' : k.n === m.N ? ' (reboiler)' : ''), k.section === 'R' ? 'rectifying' : 'stripping', k.x.toFixed(4), k.y.toFixed(4), v.T(k.x).toFixed(2)]), [2, 3, 4]));
            // 3-D column (shared builder)
            if (!m.ok) return; const so = S.st || (S.st = {}), T = m.steps.map(k => v.T(k.x)), n = m.N - 1, f1 = x => UI.fmt(x, 1);
            Object.assign(so, { n, feed: m.feed, steps: m.steps, xF: s.xF, xD, T, lab: { cond: 'Condenser', refl: `Reflux R = ${UI.fmt(d.R, 2)}`, dist: `Distillate x_D = ${xD}`, feed: `Feed → tray ${Math.min(m.feed, n)}`, ttop: `Top tray ${f1(T[0])} °C`, tfeed: `Feed tray ${f1(T[Math.min(m.feed, n) - 1])} °C`, tbot: `Bottom tray ${f1(T[n - 1])} °C`, reb: `Reboiler (stage ${m.N}) ${f1(T[m.N - 1])} °C`, btm: `Bottoms x_B = ${UI.fmt(m.steps[m.N - 1].x, 3)}` } });
            show3d(V.v, S, so);
          }
        });
        UI.note(el, '<b>Experiments:</b> (1) Set R/R<sub>min</sub> → 1.02: stages pile up at the pinch. (2) Force the feed stage too early or too late: more stages are needed — the optimal feed stage is the one that steps across the operating-line intersection. (3) Lower E<sub>MV</sub>: the pseudo-equilibrium curve moves toward the operating lines and real trays increase. (4) Change q: the q-line rotates and R<sub>min</sub> changes.');
      },
      eqs: [
        { n: 'Rectifying line', m: 'y_{n+1} = \\frac{R}{R+1}x_n + \\frac{x_D}{R+1}' },
        { n: 'Stripping line', m: 'y_{m+1} = \\frac{\\bar L}{\\bar V}x_m - \\frac{B\\,x_B}{\\bar V}' },
        { n: 'q-line', m: 'y = \\frac{q}{q-1}x - \\frac{x_F}{q-1},\\quad q = \\frac{H_V-H_F}{H_V-H_L}' },
        { n: 'Fenske (total reflux)', m: 'N_{min} = \\frac{\\ln\\left[\\frac{x_D}{1-x_D}\\frac{1-x_B}{x_B}\\right]}{\\ln\\alpha_{avg}}', w: 'includes the reboiler; α_avg = √(α_top α_bottom)' },
        { n: 'Minimum reflux (pinch at q-line)', m: '\\frac{R_{min}}{R_{min}+1} = \\frac{x_D-y\'}{x_D-x\'}' },
        { n: 'Gilliland (Eduljee fit)', m: '\\frac{N-N_{min}}{N+1} = 0.75\\left[1-\\left(\\frac{R-R_{min}}{R+1}\\right)^{0.5668}\\right]' }],
      fx: [['↑ Reflux ratio', 'fewer stages, more condenser & reboiler duty'], ['R → R_min', 'stages → ∞ (pinch)'], ['Feed off the optimal stage', 'extra stages needed'], ['↓ Murphree efficiency', 'more real trays'], ['↑ Purity (x_D → 1, x_B → 0)', 'many extra stages near the ends'], ['Cold feed (q > 1)', 'more vapour in stripping section, lower R_min']],
      quiz: [{ q: 'At total reflux the operating lines coincide with…', o: ['the q-line', 'the 45° diagonal', 'the equilibrium curve', 'the x-axis'], a: 1 }, { q: 'For a saturated-vapour feed the q-line is…', o: ['vertical', 'horizontal', 'slope 1', 'slope −1'], a: 1, ex: 'q = 0 ⇒ y = x_F.' }, { q: 'A partial reboiler is counted as…', o: ['zero stages', 'one equilibrium stage', 'half a stage', 'part of the condenser'], a: 1 }],
      refs: ["<i>McCabe, W.L. & Thiele, E.W.</i> (1925) Graphical design of fractionating columns. <i>Ind. Eng. Chem.</i> 17, 605–611.", "<i>Fenske, M.R.</i> (1932) Fractionation of straight-run Pennsylvania gasoline. <i>Ind. Eng. Chem.</i> 24, 482–485.", "<i>Gilliland, E.R.</i> (1940) Multicomponent rectification: estimation of the number of theoretical plates as a function of the reflux ratio. <i>Ind. Eng. Chem.</i> 32, 1220–1223.", "<i>Eduljee, H.E.</i> (1975) Equations replace Gilliland plot. <i>Hydrocarbon Processing</i> 54(9), 120–122.", "<i>Murphree, E.V.</i> (1925) Rectifying column calculations. <i>Ind. Eng. Chem.</i> 17, 747–750.", "<i>Colburn, A.P.</i> (1936) Effect of entrainment on plate efficiency in distillation. <i>Ind. Eng. Chem.</i> 28, 526–530.", "<i>Seader, J.D., Henley, E.J. & Roper, D.K.</i> (2011) <i>Separation Process Principles</i>, 3rd ed., Wiley, Ch. 7.", "<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill, Ch. 21."]
    },

    {
      id: 'reflux', title: 'Reflux ratio: total, minimum & optimum', tags: 'reflux ratio optimum economic minimum total cost',
      blurb: 'Why real columns run at 1.1–1.5 × R_min.',
      lead: 'Between the two limits — <b>total reflux</b> (minimum stages, no product) and <b>minimum reflux</b> (infinite stages) — lies an <b>optimum</b> where total annual cost (column + exchangers + energy) is lowest.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Economics', controls: [sysCtl(), { k: 'xF', label: 'x_F', min: .1, max: .9, step: .01, v: .45 }, { k: 'xD', label: 'x_D', min: .6, max: .995, step: .001, v: .95 }, { k: 'xB', label: 'x_B', min: .005, max: .3, step: .001, v: .05 }, { k: 'q', label: 'q', min: 0, max: 1.3, step: .01, v: 1 },
            { k: 'ce', label: 'Energy price (relative)', min: .1, max: 5, step: .05, v: 1 }, { k: 'cc', label: 'Capital charge (relative)', min: .1, max: 5, step: .05, v: 1 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 340 }, { k: 'q', t: 'plot', row: 'r', h: 340 }],
          update(s, V) {
            const base = { ...s, P: 1 }, r = C.rmin(s.sys, ATM, s.xF, s.xD, s.q).Rmin, d0 = design({ ...base, RR: 2 });
            const rr = C.linspace(1.03, 4, 60), pts = rr.map(f => { const m = C.mccabe({ sys: s.sys, P: ATM, xF: s.xF, xD: s.xD, xB: s.xB, q: s.q, R: r * f, maxN: 200 }); return [f, m.ok ? m.Nfrac : NaN]; });
            const cost = pts.map(([f, N]) => { const Vr = r * f + 1; const cap = s.cc * (.35 * (N + 4) * Math.sqrt(Vr) + 1.2 * Math.pow(Vr, .65)); const en = s.ce * Vr; return [f, cap, en, cap + en]; });
            const best = cost.filter(c => isFinite(c[3])).reduce((a, b) => b[3] < a[3] ? b : a);
            V.ro.set([['R_min', UI.fmt(r, 4)], ['N_min (total reflux)', UI.fmt(d0.Nmin, 2)], ['<b>Optimum R / R_min</b>', UI.fmt(best[0], 3), 'ok'], ['Optimum R', UI.fmt(best[0] * r, 3)], ['Stages at optimum', UI.fmt(pts[cost.indexOf(best)][1], 2)]]);
            const p = V.p.frame({ x: [1, 4], y: [0, Math.min(Math.max(...pts.map(a => a[1]).filter(isFinite)) * 1.05, 120)], xl: 'R / R_min', yl: 'Ideal stages N', xs: 'R/Rmin', ys: 'N' });
            p.line(pts, { l: 'McCabe–Thiele' }); p.fn(f => C.gilliland(f * r, r, d0.Nmin), 1.03, 4, { c: 'c2', dash: [5, 4], l: 'Gilliland' }); p.hl(d0.Nmin, { l: 'N_min' }); p.done();
            const mx = Math.max(...cost.map(c => c[3]).filter(isFinite));
            const q = V.q.frame({ x: [1, 4], y: [0, Math.min(mx, best[3] * 3)], xl: 'R / R_min', yl: 'Annual cost (relative)', xs: 'R/Rmin', ys: 'cost' });
            q.line(cost.map(c => [c[0], c[1]]), { c: 'c2', l: 'Capital (column + exchangers)' }); q.line(cost.map(c => [c[0], c[2]]), { c: 'c5', l: 'Energy (steam + cooling water)' }); q.line(cost.map(c => [c[0], c[3]]), { c: 'c1', w: 3, l: 'Total' }); q.vl(best[0]); q.done();
          }
        });
        UI.note(el, 'The cost model is illustrative (column cost ∝ stages × √vapour flow; exchanger cost ∝ V^0.65; energy ∝ V) but reproduces the classic result: optimum R ≈ 1.1–1.5 R<sub>min</sub>, shifting lower when energy is expensive.');
      },
      eqs: [{ n: 'Limits', m: 'R = \\infty \\Rightarrow N = N_{min};\\qquad R = R_{min} \\Rightarrow N = \\infty' }, { n: 'Typical optimum', m: 'R_{opt} \\approx (1.1\\text{–}1.5)\\,R_{min}' }],
      fx: [['Expensive energy', 'optimum moves closer to R_min (more stages, less boil-up)'], ['Expensive capital', 'optimum moves to higher R']],
      quiz: [{ q: 'Total reflux is used in practice…', o: ['for normal production', 'during start-up and for measuring column efficiency', 'never', 'only in packed columns'], a: 1 }],
      refs: ["<i>Peters, M.S., Timmerhaus, K.D. & West, R.E.</i> (2003) <i>Plant Design and Economics for Chemical Engineers</i>, 5th ed., McGraw-Hill, Ch. 9 (optimum reflux ratio).", "<i>Towler, G. & Sinnott, R.</i> (2013) <i>Chemical Engineering Design</i>, 2nd ed., Butterworth-Heinemann, Ch. 17.", "<i>Kister, H.Z.</i> (1992) <i>Distillation Design</i>, McGraw-Hill.", "<i>McCabe, W.L., Smith, J.C. & Harriott, P.</i> (2005) <i>Unit Operations of Chemical Engineering</i>, 7th ed., McGraw-Hill, Ch. 21."]
    },

    {
      id: 'ctypes', title: 'Types of fractionating columns & entrainment', tags: 'fractionating column types tray packed bubble cap sieve valve batch vacuum entrainment colburn weeping flooding operating window',
      blurb: 'Tray vs packed vs batch, the operating window, and what entrainment does.',
      lead: 'A fractionating column is chosen for its capacity, efficiency, pressure drop and flexibility. Every tray column works only inside an <b>operating window</b>: too little vapour → weeping; too much → entrainment and flooding.',
      render(el, UI) {
        el.append(UI.table(['Type', 'Key feature', 'Pressure drop', 'Turndown', 'Best for'], [['Sieve tray', 'perforated plate', 'low–medium', '2:1', 'clean services, cost'], ['Valve tray', 'liftable valves', 'medium', '4–5:1', 'most refinery columns'], ['Bubble-cap tray', 'riser + cap, liquid seal', 'high', '10:1', 'very low liquid/vapour rates'], ['Random-packed', 'rings/saddles', 'low', 'good', 'small diameter, corrosive, foaming'], ['Structured-packed', 'corrugated sheets', 'very low', 'good', 'vacuum, high efficiency'], ['Batch column', 'still + column, reflux varied with time', '—', '—', 'small multi-product plants, pharma'], ['Vacuum column', 'large diameter, packing', 'very low allowed', '—', 'heat-sensitive, heavy oils']]));
        UI.sec(el, 'Entrainment: effect on stages');
        UI.sim(el, {
          title: 'Entrainment', controls: [sysCtl(), { k: 'E', label: 'Dry Murphree E_MV', min: .3, max: 1, step: .01, v: .75 }, { k: 'psi', label: 'Fractional entrainment ψ', min: 0, max: .4, step: .005, v: .1 }, { k: 'RR', label: 'R / R_min', min: 1.1, max: 3, step: .05, v: 1.5 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 320 }, { k: 'q', t: 'plot', row: 'r', h: 320 }],
          update(s, V) {
            const base = { sys: s.sys, P: 1, xF: .45, xD: .93, xB: .06, q: 1, RR: s.RR, E: s.E }, d0 = design({ ...base, psi: 0 }), d1 = design({ ...base, psi: s.psi });
            V.ro.set([['E_a (Colburn)', UI.fmt(d1.E, 3)], ['Real stages, ψ = 0', d0.m.ok ? d0.m.N + '' : '∞'], ['Real stages with entrainment', d1.m.ok ? d1.m.N + '' : '∞', 'warn'], ['Extra trays', d0.m.ok && d1.m.ok ? (d1.m.N - d0.m.N) + '' : '—']]);
            const p = V.p.frame({ x: [0, .4], y: [0, 1], xl: 'Fractional entrainment ψ', yl: 'Apparent efficiency E_a' }); [.5, .7, .9].forEach((e, i) => p.fn(ps => C.colburn(e, ps), 0, .4, { c: ['c2', 'c3', 'c4'][i], w: 1.2, l: 'E_MV = ' + e })); p.fn(ps => C.colburn(s.E, ps), 0, .4, { w: 2.6, l: 'current' }); p.vl(s.psi); p.done();
            const q = V.q.frame({ x: [0, 1.15], y: [0, 1.1], xl: 'Vapour load (fraction of flooding)', yl: 'Tray efficiency (schematic)' });
            q.fn(u => u < .25 ? Math.max(0, (u - .05) / .2) * .7 : u < .85 ? .7 + .08 * Math.sin((u - .25) / .6 * Math.PI) : .7 * Math.max(0, 1 - Math.pow((u - .85) / .3, 2)), 0, 1.15, { l: 'efficiency' }); q.vl(.25, { c: 'c2', l: 'weep point' }); q.vl(.85, { c: 'bad', l: 'excess entrainment' }); q.vl(1, { c: 'bad', dash: [], w: 1.5, l: 'flood' }); q.text(.55, .9, 'stable operating window', { al: 'center', c: 'ok' }); q.done();
          }
        });
      },
      eqs: [{ n: 'Colburn', m: 'E_a = \\frac{E_{MV}}{1+E_{MV}\\left(\\frac{\\psi}{1-\\psi}\\right)}' }, { n: 'Fractional entrainment', m: '\\psi = \\frac{e}{L+e}', w: 'e = entrained liquid, mol/time' }],
      fx: [['↑ Vapour velocity', '↑ entrainment ψ → ↓ E_a'], ['↑ Tray spacing', '↓ entrainment at the same velocity'], ['ψ > 0.1', 'noticeable efficiency loss; designers keep ψ < 0.1']],
      quiz: [{ q: 'Entrainment lowers efficiency because…', o: ['liquid weeps', 'liquid of lower purity is carried up and mixes with better liquid above', 'vapour bypasses the tray', 'pressure rises'], a: 1 }],
      refs: ["<i>Kister, H.Z.</i> (1992) <i>Distillation Design</i>, McGraw-Hill.", "<i>Lockett, M.J.</i> (1986) <i>Distillation Tray Fundamentals</i>, Cambridge University Press.", "<i>Colburn, A.P.</i> (1936) Effect of entrainment on plate efficiency in distillation. <i>Ind. Eng. Chem.</i> 28, 526–530.", "<i>Fair, J.R.</i> (1961) How to predict sieve tray entrainment and flooding. <i>Petro/Chem Engineer</i> 33(10), 45–52.", "<i>Green, D.W. & Southard, M.Z.</i> (eds.) (2019) <i>Perry’s Chemical Engineers’ Handbook</i>, 9th ed., McGraw-Hill, Sec. 13.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 9 (distillation)."]
    }
  ];
})();
