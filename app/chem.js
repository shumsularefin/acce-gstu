/* ChemE Studio — shared physical-chemistry engine (pure functions, no DOM).
   Units are stated on every function. Sources: Poling/Prausnitz "Properties of Gases & Liquids" (Antoine, Fuller,
   Wilke-Chang), Treybal "Mass-Transfer Operations" (ternary data), Sander 2015 (Henry constants), Kister/Fair (flooding). */
(function (root) {
  const R = 8.314; // J/mol/K
  const C = {};

  /* ---------- numerics ---------- */
  C.bisect = (f, a, b, tol = 1e-10, it = 200) => {
    let fa = f(a), fb = f(b);
    if (fa * fb > 0) return NaN;
    for (let i = 0; i < it; i++) {
      const m = (a + b) / 2, fm = f(m);
      if (Math.abs(fm) < tol || (b - a) / 2 < tol) return m;
      if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
    }
    return (a + b) / 2;
  };
  C.linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * i / (n - 1));
  C.interp = (x, xs, ys) => { // linear, xs ascending
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
    return ys[ys.length - 1];
  };
  C.trapz = (xs, ys) => { let s = 0; for (let i = 1; i < xs.length; i++) s += (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]) / 2; return s; };
  C.erf = x => { // Abramowitz-Stegun 7.1.26, |err|<1.5e-7
    const s = Math.sign(x); x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  };
  C.linfit = (x, y) => { // least squares y = a + b x
    const n = x.length; let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; syy += y[i] * y[i]; }
    const b = (n * sxy - sx * sy) / (n * sxx - sx * sx), a = (sy - b * sx) / n;
    const r2 = Math.pow(n * sxy - sx * sy, 2) / ((n * sxx - sx * sx) * (n * syy - sy * sy));
    return { a, b, r2 };
  };
  // seeded RNG for reproducible "realistic" instrument noise
  C.rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); }; };
  C.gauss = rnd => { const u = Math.max(rnd(), 1e-12), v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  /* ---------- pure components: Antoine log10 P[mmHg] = A − B/(T[°C]+C) ---------- */
  C.comp = {
    benzene: { name: 'Benzene', M: 78.11, A: 6.90565, B: 1211.033, C: 220.79, Tb: 80.1, lam: 30.72e3, rho: 876, cp: 136 },
    toluene: { name: 'Toluene', M: 92.14, A: 6.95464, B: 1344.8, C: 219.482, Tb: 110.6, lam: 33.18e3, rho: 867, cp: 157 },
    methanol: { name: 'Methanol', M: 32.04, A: 8.08097, B: 1582.271, C: 239.726, Tb: 64.7, lam: 35.27e3, rho: 792, cp: 81 },
    ethanol: { name: 'Ethanol', M: 46.07, A: 8.20417, B: 1642.89, C: 230.3, Tb: 78.3, lam: 38.56e3, rho: 789, cp: 112 },
    water: { name: 'Water', M: 18.015, A: 8.07131, B: 1730.63, C: 233.426, Tb: 100.0, lam: 40.66e3, rho: 998, cp: 75.4 },
    hexane: { name: 'n-Hexane', M: 86.18, A: 6.87601, B: 1171.17, C: 224.41, Tb: 68.7, lam: 28.85e3, rho: 655, cp: 195 },
    heptane: { name: 'n-Heptane', M: 100.2, A: 6.89385, B: 1264.37, C: 216.636, Tb: 98.4, lam: 31.77e3, rho: 684, cp: 224 },
    acetone: { name: 'Acetone', M: 58.08, A: 7.11714, B: 1210.595, C: 229.664, Tb: 56.1, lam: 29.1e3, rho: 784, cp: 125 }
  };
  C.psat = (k, T) => { const c = C.comp[k]; return 133.322 * Math.pow(10, c.A - c.B / (T + c.C)); }; // Pa, T °C
  C.tsat = (k, P) => { const c = C.comp[k]; return c.B / (c.A - Math.log10(P / 133.322)) - c.C; }; // °C

  /* ---------- binary VLE (modified Raoult, Van Laar activity) ----------
     Van Laar: lnγ1 = A12 (A21x2/(A12x1+A21x2))², lnγ2 = A21 (A12x1/(A12x1+A21x2))² */
  C.systems = {
    'benzene-toluene': { a: 'benzene', b: 'toluene', A12: 0, A21: 0, note: 'Nearly ideal (Raoult’s law)' },
    'hexane-heptane': { a: 'hexane', b: 'heptane', A12: 0, A21: 0, note: 'Ideal paraffin mixture' },
    'methanol-water': { a: 'methanol', b: 'water', A12: 0.8041, A21: 0.5619, note: 'Positive deviation, no azeotrope' },
    'ethanol-water': { a: 'ethanol', b: 'water', A12: 1.6798, A21: 0.9227, note: 'Minimum-boiling azeotrope (expt. 89.4 mol%, model ≈91%)' },
    'acetone-water': { a: 'acetone', b: 'water', A12: 2.0500, A21: 1.5000, note: 'Strong positive deviation, pinch near top' }
  };
  C.gamma = (sys, x) => {
    const s = C.systems[sys], x2 = 1 - x;
    if (!s.A12) return [1, 1];
    const d = s.A12 * x + s.A21 * x2;
    if (d <= 0) return [Math.exp(s.A12), Math.exp(s.A21)];
    return [Math.exp(s.A12 * Math.pow(s.A21 * x2 / d, 2)), Math.exp(s.A21 * Math.pow(s.A12 * x / d, 2))];
  };
  // bubble point: given x (light), P [Pa] -> {T °C, y}
  C.bubble = (sys, x, P) => {
    const s = C.systems[sys], [g1, g2] = C.gamma(sys, x);
    const f = T => g1 * x * C.psat(s.a, T) + g2 * (1 - x) * C.psat(s.b, T) - P;
    const T = C.bisect(f, -50, 300, 1e-6);
    return { T, y: g1 * x * C.psat(s.a, T) / P };
  };
  // dew point: given y, P -> {T, x}
  C.dew = (sys, y, P) => {
    const xs = C.bisect(x => C.bubble(sys, x, P).y - y, 0, 1, 1e-9);
    if (isNaN(xs)) return { T: NaN, x: NaN };
    return { T: C.bubble(sys, xs, P).T, x: xs };
  };
  // cached equilibrium table for fast y*(x) and x*(y) lookup
  const vleCache = {};
  C.vle = (sys, P) => {
    const key = sys + '@' + P.toFixed(0);
    if (vleCache[key]) return vleCache[key];
    const n = 401, xs = [], ys = [], Ts = [];
    for (let i = 0; i < n; i++) { const x = i / (n - 1), b = C.bubble(sys, x, P); xs.push(x); ys.push(b.y); Ts.push(b.T); }
    // azeotrope detection (y-x changes sign)
    let az = null;
    for (let i = 4; i < n - 5; i++) { const d0 = ys[i] - xs[i], d1 = ys[i + 1] - xs[i + 1]; if (d0 * d1 < 0 && Math.abs(d0) > 1e-6) { az = xs[i] + (xs[i + 1] - xs[i]) * d0 / (d0 - d1); break; } }
    const t = {
      xs, ys, Ts, az,
      y: x => C.interp(Math.min(Math.max(x, 0), 1), xs, ys),
      T: x => C.interp(Math.min(Math.max(x, 0), 1), xs, Ts),
      x: y => { // inverse on monotone region
        const lim = az ? xs.findIndex(v => v >= az) : n - 1;
        const X = xs.slice(0, lim + 1), Y = ys.slice(0, lim + 1);
        return C.interp(y, Y, X);
      },
      alpha: x => { const yy = t.y(x); return (yy / x) / ((1 - yy) / (1 - x)); }
    };
    return (vleCache[key] = t);
  };

  /* ---------- McCabe-Thiele (CMO) ----------
     opts: {sys,P,xF,xD,xB,q,R,E (Murphree vapour, 0-1), feedStage (null = optimal), maxN} */
  C.mccabe = o => {
    const v = C.vle(o.sys, o.P), E = o.E ?? 1;
    // q-line / rectifying intersection
    const R = o.R, xD = o.xD, xB = o.xB, xF = o.xF, q = o.q;
    let xi, yi;
    if (Math.abs(q - 1) < 1e-9) { xi = xF; yi = R / (R + 1) * xF + xD / (R + 1); }
    else { xi = (xF / (q - 1) + xD / (R + 1)) / (q / (q - 1) - R / (R + 1)); yi = R / (R + 1) * xi + xD / (R + 1); }
    const rect = x => R / (R + 1) * x + xD / (R + 1);
    const sS = (yi - xB) / (xi - xB);
    const strip = x => xB + sS * (x - xB);
    const steps = []; let x = xD, y = xD, n = 0, feed = null, ok = true;
    const maxN = o.maxN || 80;
    while (x > xB && n < maxN) {
      n++;
      let useStrip = o.feedStage ? n >= o.feedStage : x < xi; // decided at start of stage (liquid leaving above)
      if (useStrip && feed === null) feed = n;
      const yEq = v.y; // stage: vapour y leaves, liquid x in equilibrium (with Murphree)
      // find x leaving stage n such that y = yop_below + E (y*(x) - yop_below) ; solve by bisection on x
      const op = useStrip ? strip : rect;
      const f = xx => op(xx) + E * (yEq(xx) - op(xx)) - y;
      let xn = C.bisect(f, 0, Math.min(1, y + 1e-12), 1e-10);
      if (isNaN(xn) || xn >= x - 1e-9) { ok = false; break; } // pinch
      steps.push({ n, y, x: xn, section: useStrip ? 'S' : 'R' });
      x = xn; y = op(x);
    }
    if (x > xB) ok = false;
    // fractional last stage
    let Nfrac = n;
    if (ok && steps.length) { const last = steps[steps.length - 1], prevx = steps.length > 1 ? steps[steps.length - 2].x : xD; Nfrac = n - 1 + (prevx - xB) / (prevx - last.x); }
    return { steps, N: n, Nfrac, feed: feed ?? n, ok, xi, yi, rect, strip, sS };
  };
  // minimum reflux (handles tangent pinch) for given q
  C.rmin = (sys, P, xF, xD, q) => {
    const v = C.vle(sys, P);
    // pinch at q-line ∩ equilibrium
    let xp;
    if (Math.abs(q - 1) < 1e-9) xp = xF;
    else xp = C.bisect(x => v.y(x) - (q / (q - 1) * x - xF / (q - 1)), 1e-6, 1 - 1e-6);
    if (isNaN(xp)) xp = xF;
    const yp = v.y(xp);
    let slope = (xD - yp) / (xD - xp); // L/V
    // tangent check: line from (xD,xD) must not cut equilibrium curve
    for (let i = 1; i < 400; i++) { const x = xp + (xD - xp) * i / 400; const s = (xD - v.y(x)) / (xD - x); if (s > slope) slope = s; }
    return { Rmin: slope / (1 - slope), xp, yp };
  };
  C.fenske = (xD, xB, alpha) => Math.log((xD / (1 - xD)) * ((1 - xB) / xB)) / Math.log(alpha);
  C.gilliland = (R, Rmin, Nmin) => { // Eduljee (1975) fit: Y = 0.75(1 − X^0.5668)
    const X = (R - Rmin) / (R + 1), Y = 0.75 * (1 - Math.pow(X, 0.5668));
    return (Nmin + Y) / (1 - Y);
  };
  C.colburn = (Emv, psi) => Emv / (1 + Emv * psi / (1 - psi)); // entrainment-corrected Murphree
  C.oconnell = (alpha, muL) => 0.492 * Math.pow(alpha * muL, -0.245); // overall tray eff., μ in cP
  C.lewisEMV = (Eog, lam, mode) => mode === 'mixed' ? Eog : (Math.exp(lam * Eog) - 1) / lam; // λ = mV/L

  /* ---------- flash / Rayleigh ---------- */
  C.flash = (sys, P, z, f) => { // f = V/F ; returns {x,y,T}
    const v = C.vle(sys, P);
    const x = C.bisect(xx => (1 - f) * xx + f * v.y(xx) - z, 0, z, 1e-10);
    return { x, y: v.y(x), T: v.T(x) };
  };
  C.rayleigh = (sys, P, x0, xW, n = 200) => { // ln(F/W) = ∫ dx/(y−x) from xW to x0
    const v = C.vle(sys, P), xs = C.linspace(xW, x0, n), g = xs.map(x => 1 / (v.y(x) - x));
    return { lnFW: C.trapz(xs, g), xs, g };
  };

  /* ---------- gas solubility (Henry, Sander 2015: Hcp mol/(m³·Pa) at 298.15 K, d ln H/d(1/T) K) ---------- */
  C.gases = {
    O2: { name: 'O₂', H: 1.3e-5, d: 1500, M: 32 },
    N2: { name: 'N₂', H: 6.4e-6, d: 1300, M: 28.01 },
    CH4: { name: 'CH₄', H: 1.4e-5, d: 1600, M: 16.04 },
    CO2: { name: 'CO₂', H: 3.3e-4, d: 2400, M: 44.01 },
    H2S: { name: 'H₂S', H: 1.0e-3, d: 2100, M: 34.08 },
    SO2: { name: 'SO₂', H: 1.2e-2, d: 3100, M: 64.07 },
    NH3: { name: 'NH₃', H: 5.9e-1, d: 4200, M: 17.03 }
  };
  C.henryCp = (g, TK) => C.gases[g].H * Math.exp(C.gases[g].d * (1 / TK - 1 / 298.15)); // mol/(m³ Pa)
  C.henryPx = (g, TK) => 55500 / C.henryCp(g, TK); // Pa per unit mole fraction:  p = H_px · x (dilute)

  /* ---------- diffusivities ---------- */
  // Fuller (Poling eq.11-4.4): D[cm²/s] = 0.00143 T^1.75 / (P[bar] M_AB^0.5 (Σv_A^(1/3)+Σv_B^(1/3))²), M_AB = 2/(1/MA+1/MB)
  C.diffGas = {
    air: { name: 'Air', M: 28.97, v: 19.7 }, N2: { name: 'N₂', M: 28.01, v: 18.5 }, O2: { name: 'O₂', M: 32, v: 16.3 },
    H2: { name: 'H₂', M: 2.016, v: 6.12 }, He: { name: 'He', M: 4.003, v: 2.67 }, CO2: { name: 'CO₂', M: 44.01, v: 26.9 },
    H2O: { name: 'H₂O', M: 18.015, v: 13.1 }, NH3: { name: 'NH₃', M: 17.03, v: 20.7 }, CH4: { name: 'CH₄', M: 16.04, v: 25.14 },
    methanol: { name: 'Methanol', M: 32.04, v: 31.25 }, ethanol: { name: 'Ethanol', M: 46.07, v: 51.77 },
    acetone: { name: 'Acetone', M: 58.08, v: 67.6 }, benzene: { name: 'Benzene', M: 78.11, v: 90.96 }, toluene: { name: 'Toluene', M: 92.14, v: 111.48 }
  };
  C.fuller = (a, b, TK, Pbar) => {
    const A = C.diffGas[a], B = C.diffGas[b], Mab = 2 / (1 / A.M + 1 / B.M);
    return 0.00143 * Math.pow(TK, 1.75) / (Pbar * Math.sqrt(Mab) * Math.pow(Math.cbrt(A.v) + Math.cbrt(B.v), 2)); // cm²/s
  };
  // Wilke-Chang: D[cm²/s] = 7.4e-8 (φ M_B)^0.5 T / (μ_B[cP] V_A^0.6), V_A molar vol at nbp cm³/mol
  C.solutes = {
    O2: { name: 'O₂', V: 25.6 }, CO2: { name: 'CO₂', V: 34.0 }, NH3: { name: 'NH₃', V: 25.8 }, methanol: { name: 'Methanol', V: 42.5 },
    ethanol: { name: 'Ethanol', V: 59.2 }, acetic: { name: 'Acetic acid', V: 64.1 }, benzene: { name: 'Benzene', V: 96.0 }, glucose: { name: 'Glucose', V: 166 }
  };
  C.solvents = { water: { name: 'Water', M: 18.015, phi: 2.6 }, methanol: { name: 'Methanol', M: 32.04, phi: 1.9 }, ethanol: { name: 'Ethanol', M: 46.07, phi: 1.5 }, benzene: { name: 'Benzene', M: 78.11, phi: 1.0 } };
  C.muWater = TK => 0.02939 * Math.exp(507.88 / (TK - 149.3)); // cP (Vogel fit, 0–100 °C)
  C.solventMu = (s, TK) => s === 'water' ? C.muWater(TK) : ({ methanol: [0.00823, 1250], ethanol: [0.00502, 1600], benzene: [0.00914, 1250] })[s].reduce((A, B) => A * Math.exp(B / TK)); // cP, Andrade fits to 25 °C data
  C.wilkeChang = (a, s, TK) => 7.4e-8 * Math.sqrt(C.solvents[s].phi * C.solvents[s].M) * TK / (C.solventMu(s, TK) * Math.pow(C.solutes[a].V, 0.6));
  C.knudsen = (dpore_m, TK, M) => (dpore_m / 3) * Math.sqrt(8 * R * TK / (Math.PI * M / 1000)); // m²/s
  C.meanFreePath = (TK, Pa, dmol_m = 3.7e-10) => 1.380649e-23 * TK / (Math.SQRT2 * Math.PI * dmol_m * dmol_m * Pa); // m

  /* ---------- Liquid-liquid: Water(A) – Acetic acid(C) – Isopropyl ether(B), 20 °C (Treybal Table, wt %) ----------
     each row: raffinate (water-rich) [C,A,B] and extract (ether-rich) [C,A,B] joined by a tie line */
  C.lle = {
    name: 'Water – Acetic acid – Isopropyl ether, 20 °C',
    A: 'Water', B: 'Isopropyl ether', Cc: 'Acetic acid',
    R: [[0.69, 98.1, 1.2], [1.41, 97.1, 1.5], [2.89, 95.5, 1.6], [6.42, 91.7, 1.9], [13.30, 84.4, 2.3], [25.50, 71.1, 3.4], [36.70, 58.9, 4.4], [44.30, 45.1, 10.6], [46.40, 37.1, 16.5]],
    E: [[0.18, 0.5, 99.3], [0.37, 0.7, 98.9], [0.79, 0.8, 98.4], [1.93, 1.0, 97.1], [4.82, 1.9, 93.3], [11.40, 3.9, 84.7], [21.60, 6.9, 71.5], [31.10, 10.8, 58.1], [36.20, 15.1, 48.7]],
    plait: [42.0, 27.0, 31.0] // estimated by extrapolating tie-line midpoints (approximate)
  };
  // phase points as fractions {c,a,b}; tie-line parameter t ∈ [0, n-1] (n-1 → plait)
  const pt = r => ({ c: r[0] / 100, a: r[1] / 100, b: r[2] / 100 });
  C.lleRow = (t) => {
    const L = C.lle, n = L.R.length;
    const Rp = L.R.map(pt).concat([pt(L.plait)]), Ep = L.E.map(pt).concat([pt(L.plait)]);
    t = Math.max(0, Math.min(n, t)); const i = Math.min(Math.floor(t), n - 1), f = t - i;
    const lerp = (P, Q) => ({ c: P.c + (Q.c - P.c) * f, a: P.a + (Q.a - P.a) * f, b: P.b + (Q.b - P.b) * f });
    return { R: lerp(Rp[i], Rp[i + 1]), E: lerp(Ep[i], Ep[i + 1]) };
  };
  // mixing point M {c,b} -> equilibrium phases + masses. Returns null if single phase.
  C.lleSplit = (M, mass) => {
    const n = C.lle.R.length;
    const side = t => { const { R: r, E: e } = C.lleRow(t); return (e.b - r.b) * (M.c - r.c) - (e.c - r.c) * (M.b - r.b); };
    // inside two-phase region test: M must lie between raffinate and extract branches
    const t = C.bisect(side, 0, n - 1e-6, 1e-9);
    if (isNaN(t)) return null;
    const { R: r, E: e } = C.lleRow(t);
    const fr = (M.b - r.b) / (e.b - r.b); // lever rule: E/M
    if (fr < -1e-6 || fr > 1 + 1e-6) return null;
    return { t, R: r, E: e, Emass: mass * fr, Rmass: mass * (1 - fr), K: e.c / r.c, beta: (e.c / e.a) / (r.c / r.a) };
  };
  // binodal polygon (raffinate branch → plait → extract branch reversed), as {c,b}
  C.binodal = () => {
    const L = C.lle; return L.R.map(pt).concat([pt(L.plait)], L.E.map(pt).reverse());
  };

  /* ---------- adsorption ---------- */
  C.langmuir = (c, qm, K) => qm * K * c / (1 + K * c);
  C.freundlich = (c, K, n) => K * Math.pow(c, 1 / n);
  C.bet = (x, vm, c) => vm * c * x / ((1 - x) * (1 - x + c * x)); // x = P/P0
  C.thomas = (t, kTh, q0, m, Q, C0) => 1 / (1 + Math.exp(kTh * q0 * m / Q - kTh * C0 * t));

  /* ---------- flooding (Fair, Lygeros-Magoulas fit) ---------- */
  C.csbFlood = (FLV, TSmm) => 0.0105 + 8.127e-4 * Math.pow(TSmm, 0.755) * Math.exp(-1.463 * Math.pow(FLV, 0.842)); // m/s
  // Eckert GPDC flooding line: log10 Y = −1.6678 − 1.085 log10 X − 0.29655 (log10 X)²
  C.eckertFloodY = X => Math.pow(10, -1.6678 - 1.085 * Math.log10(X) - 0.29655 * Math.pow(Math.log10(X), 2));

  C.R = R;
  root.Chem = C;
  if (typeof module !== 'undefined') module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
