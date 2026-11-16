/* ACCE 201 · Unit 4 — Diffusion */
window.T201 = window.T201 || {};
(function () {
  const C = Chem, GP = Object.fromEntries(Object.entries(C.diffGas).map(([k, g]) => [k, g.name]));
  const A3 = 0xe8833a, B3 = 0x3b82d6, GL = 0xcfd8e3, MET = 0x9aa5b1, WALL = 0xf59e0b, GAS = 0x16a34a, fm = (x, n) => UI.fmt(x, n);
  const ptsGeo = (v, n, size) => { const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), c = new Float32Array(n * 3); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false })); v.root.add(m); return { g, p, c, m }; };
  const setC = (c, i, x) => { c[i * 3] = (x >> 16 & 255) / 255; c[i * 3 + 1] = (x >> 8 & 255) / 255; c[i * 3 + 2] = (x & 255) / 255; };
  const ring = (v, r, x, pos) => { const q = []; for (let k = 0; k <= 48; k++) { const a = k / 48 * 6.2832; q.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0)); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(q), new THREE.LineBasicMaterial({ color: x, transparent: true, opacity: .6 })); l.position.set(...pos); v.root.add(l); return l; };

  // pore: molecules fly ballistically; free path ~ Exp(λ), wall hits re-emit by Knudsen's cosine law
  function pore(v, st, out) {
    const n = 60, R = 1, Lx = 4, P = ptsGeo(v, n, .16), M = [], rnd = () => { const u = 2 * Math.random() - 1, a = 6.2832 * Math.random(), q = Math.sqrt(1 - u * u); return [u, q * Math.cos(a), q * Math.sin(a)]; };
    v.cyl(R, 2 * Lx, GL, [0, 0, 0], { rot: [0, 0, Math.PI / 2], open: 1, op: .18, ds: 1 });
    for (let i = 0; i < n; i++) { const r = R * .95 * Math.sqrt(Math.random()), a = 6.2832 * Math.random(); M.push({ x: [(2 * Math.random() - 1) * Lx, r * Math.cos(a), r * Math.sin(a)], d: rnd(), f: 0, fl: 0, k: 0 }); }
    let nw = 0, ng = 0, acc = 0, kn0 = -1;
    v.tag('Pore wall', [-Lx * .3, R, 0], 'pw'); v.tag('Orange flash: molecule hits the wall', [-Lx * .6, -R, 0], 'kw'); v.tag('Green flash: molecule hits another gas molecule', [Lx * .6, -R, 0], 'kg');
    v.tick((t, dt) => {
      dt = Math.min(dt, .05); const lam = Math.min(80, Math.max(.03, 2 * R * st.kn)), sp = Math.min(6, Math.max(1, .8 * st.TM));
      if (st.kn !== kn0) { kn0 = st.kn; nw = ng = 0; }
      M.forEach((m, i) => {
        if (m.f <= 0) m.f = -lam * Math.log(1 - Math.random());
        const step = sp * dt; for (let j = 0; j < 3; j++) m.x[j] += m.d[j] * step; m.f -= step;
        if (m.f <= 0) { m.d = rnd(); m.fl = .3; m.k = GAS; ng++; }
        const r = Math.hypot(m.x[1], m.x[2]);
        if (r > R) {
          const ny = -m.x[1] / r, nz = -m.x[2] / r, ct = Math.sqrt(Math.random()), sn = Math.sqrt(1 - ct * ct), a = 6.2832 * Math.random();
          m.x[1] = -ny * R * .999; m.x[2] = -nz * R * .999; m.d = [sn * Math.cos(a), ct * ny + sn * Math.sin(a) * nz, ct * nz - sn * Math.sin(a) * ny]; m.fl = .3; m.k = WALL; nw++;
        }
        if (m.x[0] > Lx) m.x[0] -= 2 * Lx; if (m.x[0] < -Lx) m.x[0] += 2 * Lx;
        m.fl -= dt; setC(P.c, i, m.fl > 0 ? m.k : B3); P.p.set(m.x, i * 3);
      });
      P.g.attributes.position.needsUpdate = P.g.attributes.color.needsUpdate = true;
      if ((acc += dt) > .5 && nw + ng > 20) { acc = 0; const w = 100 * nw / (nw + ng); out.innerHTML = `<p class="hint" style="margin:4px 0">Collisions counted in the animation: <b>${fm(w, 2)} %</b> with the wall, <b>${fm(100 - w, 2)} %</b> with other molecules. Bosanquet: the wall supplies <b>${fm(100 * st.ws, 2)} %</b> of the resistance (D/D<sub>K</sub>).</p>`; }
    });
  }

  // Stefan tube: liquid at the bottom, vapour diffuses up through stagnant air, sweep air across the top
  function stefan(v, st) {
    const { cstream, hsh } = T201.fx3, Rt = .3, Ht = 4, nv = 170, na = 60;
    v.cyl(Rt, Ht, GL, [0, Ht / 2, 0], { open: 1, op: .18, ds: 1 }); v.cyl(Rt, .04, MET, [0, 0, 0]);
    const lq = v.cyl(Rt - .02, 1, 0x60a5fa, [0, .5, 0], { op: .55 });
    v.pipe([[-2.4, Ht + .25, 0], [2.6, Ht + .25, 0]], .24, GL, { op: .16 });
    const V = ptsGeo(v, nv, .09), A = ptsGeo(v, na, .09), U = Float32Array.from({ length: nv }, () => Math.random()), UA = Float32Array.from({ length: na }, () => Math.random());
    for (let i = 0; i < nv; i++) setC(V.c, i, A3); for (let i = 0; i < na; i++) setC(A.c, i, B3);
    const sw = cstream(v, 90, .09, (u, i) => [-2.3 + 4.8 * u, Ht + .25 + .16 * (hsh(i, 3) - .5), .32 * (hsh(i, 5) - .5)], (u, i) => u > .5 && i % 4 === 0 ? [.91, .51, .23] : [.23, .48, .84], .12);
    const tl = v.tag('Liquid A evaporates at the surface', [0, .2, Rt], 'liq'), tv = v.tag('Vapour A diffuses up (orange)', [Rt, 2.6, 0], 'vap');
    v.tag('Air (blue) is stagnant: insoluble in the liquid', [-Rt, 3.2, 0], 'air'); v.tag('Sweep air keeps y_A ≈ 0 at the top', [-1.8, Ht + .25, 0], 'sw'); const tz = v.tag('Level falls: gas path z grows', [-Rt, 1, 0], 'lvl');
    v.tick((t, dt) => {
      dt = Math.min(dt, .05); const hl = Math.max(.001, st.hl), g = hl, y1 = Math.min(.95, st.y1), gu = u => (1 - Math.pow(1 - y1, 1 - u)) / y1;
      lq.scale.y = hl; lq.position.y = hl / 2; lq.visible = st.hl > .002; tl.p.y = hl * .6; tz.p.y = hl + .1;
      for (let i = 0; i < nv; i++) {
        U[i] += dt * .1 / Math.max(.06, gu(U[i])); if (U[i] >= 1) U[i] -= 1;
        const a = i * 2.4 + t * (1 + hsh(i, 7)), r = (Rt - .05) * Math.sqrt(hsh(i, 9));
        V.p[i * 3] = r * Math.cos(a); V.p[i * 3 + 1] = g + U[i] * (Ht - g) + .04 * Math.sin(t * 9 + i); V.p[i * 3 + 2] = r * Math.sin(a);
      }
      for (let i = 0; i < na; i++) { const a = i * 2.4 + t * (.6 + hsh(i, 2)), r = (Rt - .05) * Math.sqrt(hsh(i, 4)); A.p[i * 3] = r * Math.cos(a); A.p[i * 3 + 1] = g + UA[i] * (Ht - g) + .06 * Math.sin(t * 7 + i * 3); A.p[i * 3 + 2] = r * Math.sin(a); }
      V.g.attributes.position.needsUpdate = A.g.attributes.position.needsUpdate = true; sw.speed = .1;
    });
  }

  T201.diffusion = [
    {
      id: 'fick', title: 'Molecular vs eddy diffusion & Fick’s law', tags: 'molecular diffusion eddy turbulent fick law random walk concentration gradient flux',
      blurb: 'Watch molecules random-walk, then switch on turbulence.',
      lead: '<b>Molecular diffusion</b> is the net movement caused by random thermal motion of molecules — slow, but always present. <b>Eddy (turbulent) diffusion</b> is mixing by swirling bulk fluid — often 100–10 000× faster. Fick’s law says the flux is proportional to the concentration gradient.',
      render(el, UI) {
        let st = null, run = false, t = 0, G = null;
        const N = 1200, X = new Float32Array(N), Y = new Float32Array(N), Z = Float32Array.from({ length: N }, () => Math.random()), TR = [];
        const reset = () => { for (let i = 0; i < N; i++) { X[i] = i < N / 2 ? Math.random() * .5 : .5 + Math.random() * .5; Y[i] = Math.random(); } X[0] = .25; Y[0] = .5; TR.length = 0; t = 0; run = false; };
        reset();
        const W3 = 5, H3 = 2.4, D3 = 1.4, P3 = (x, y, z) => [(x - .5) * W3, (y - .5) * H3, (z - .5) * D3];
        const build = v => {
          v.box(W3 + .08, H3 + .08, D3 + .08, GL, [0, 0, 0], { op: .08, ds: 1 });
          const wall = v.box(.04, H3, D3, MET, [0, 0, 0], { op: .75 }), P = ptsGeo(v, N, .07), tp = new Float32Array(3000 * 3), tg = new THREE.BufferGeometry();
          for (let i = 0; i < N; i++) setC(P.c, i, i < N / 2 ? A3 : B3);
          tg.setAttribute('position', new THREE.BufferAttribute(tp, 3)); tg.setDrawRange(0, 0); v.root.add(new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0x111827 })));
          const dot = v.sph(.08, 0x111827, P3(.25, .5, .5)), cells = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]].map(([x, y]) => { const r = ring(v, 1, 0x8b5cf6, P3(x, y, .5)); r.scale.set(.2 * W3, .2 * H3, 1); r.visible = false; return r; });
          v.tag('Gas A (orange) starts on the left', P3(.12, 1, 1), 'a'); v.tag('Gas B (blue) starts on the right', P3(.88, 1, 1), 'b'); v.tag('Partition, removed when you press play', P3(.5, 0, 1), 'wall'); v.tag('Eddy cells: bulk swirl', P3(.75, .25, 1), 'ed');
          return { wall, P, tp, tg, dot, cells, tr: v.tag('Tracer molecule and its zig-zag path', P3(.25, .5, .5), 'tr') };
        };
        const S = UI.sim(el, {
          title: 'Diffusion cell', controls: [
            { k: 'D', label: 'Molecular diffusivity (relative)', min: .2, max: 5, step: .1, v: 1 },
            { k: 'eddy', t: 'check', label: 'Turn on eddies (stirring / turbulence)', v: false }, { k: 'U', label: 'Eddy intensity', min: 0, max: 5, step: .1, v: 2 },
            { k: 'sp', label: 'Simulation speed', min: .2, max: 4, step: .1, v: 1 },
            { t: 'html', html: 'Press <b>Remove partition</b>. Left half starts as pure A (orange), right half pure B (blue).' }],
          views: [{ k: 'v', t: '3d', h: 400, cam: [0, 1, 5.8], target: [0, 0, 0] }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 280 }],
          update(s, V) { st = s; if (V.v.ok) { if (!G) G = build(V.v); const w = V.v.el.clientWidth || 700, k = Math.min(2.4, Math.max(1, 700 / w)); if (G.k !== k) { G.k = k; V.v.look([0, k, 5.8 * k], [0, 0, 0]); } } }
        });
        S.ctl.append(UI.h('div', { style: 'display:flex;gap:8px;margin-top:6px' }, UI.h('button', { class: 'btn pri', onclick: () => run = !run }, '▶ Remove partition / pause'), UI.h('button', { class: 'btn', onclick: reset }, '↺ Reset')));
        let raf, last = performance.now(), frame = 0;
        const D0 = 4e-3; // box-units² per sim-second at D = 1
        const loop = now => {
          raf = requestAnimationFrame(loop); const s = st; if (!s) return; const dt = Math.min(.05, (now - last) / 1000) * s.sp; last = now;
          if (run) {
            const D = D0 * s.D, sd = Math.sqrt(2 * D * dt), U = s.eddy ? s.U * .1 : 0;
            for (let i = 0; i < N; i++) {
              let x = X[i], y = Y[i];
              if (U) { const u = U * Math.sin(2 * Math.PI * x) * Math.cos(2 * Math.PI * y), v = -U * Math.cos(2 * Math.PI * x) * Math.sin(2 * Math.PI * y); x += u * dt; y += v * dt; }
              x += sd * C.gauss(Math.random); y += sd * C.gauss(Math.random);
              if (x < 0) x = -x; if (x > 1) x = 2 - x; if (y < 0) y = -y; if (y > 1) y = 2 - y; X[i] = x; Y[i] = y;
            }
            t += dt;
          }
          if (G) {
            G.wall.visible = !run && t === 0;
            for (let i = 0; i < N; i++) { const b = i * 3; G.P.p[b] = (X[i] - .5) * W3; G.P.p[b + 1] = (Y[i] - .5) * H3; G.P.p[b + 2] = (Z[i] - .5) * D3; }
            G.P.g.attributes.position.needsUpdate = true;
            const q = P3(X[0], Y[0], .5); G.dot.position.set(...q); G.tr.p.set(...q);
            if (run && TR.length < 3000) { G.tp.set(q, TR.length * 3); TR.push(1); G.tg.attributes.position.needsUpdate = true; }
            G.tg.setDrawRange(0, TR.length); G.cells.forEach(r => r.visible = !!(s.eddy && s.U > 0));
          }
          if (frame++ % 6) return;
          const nb = 20, hA = new Array(nb).fill(0), hT = new Array(nb).fill(0);
          for (let i = 0; i < N; i++) { const b = Math.min(nb - 1, Math.floor(X[i] * nb)); hT[b]++; if (i < N / 2) hA[b]++; }
          const prof = hA.map((a, i) => [(i + .5) / nb, hT[i] ? a / hT[i] : 0]);
          const Dm = D0 * s.D, Fo = Dm * t;
          // exact interdiffusion in a closed box (method of images, finite length L = 1)
          const exact = x => { let c = 0; for (let n = -6; n <= 6; n++) c += .5 * (C.erf((.5 - x + 2 * n) / (2 * Math.sqrt(Dm * t + 1e-12))) - C.erf((-.5 - x + 2 * n) / (2 * Math.sqrt(Dm * t + 1e-12)))) ; return Math.min(1, Math.max(0, c)); };
          const mix = 1 - prof.reduce((a, [, c]) => a + Math.abs(c - .5), 0) / nb / .5, grad = (prof[nb / 2][1] - prof[nb / 2 - 1][1]) * nb;
          S.V.ro.set([['Fourier no. Fo = Dt/L²', UI.fmt(Fo, 4)], ['Degree of mixing', UI.fmt(mix * 100, 1) + ' %'], ['Gradient at centre dc/dx', UI.fmt(grad, 3)], ['Fick flux ∝ −D dc/dx', UI.fmt(-s.D * grad, 3)], ['Real time if gas, L = 10 cm', UI.fmt(Fo * .01 / 2e-5, 0) + ' s'], ['Real time if liquid, L = 1 cm', UI.fmt(Fo * 1e-4 / 1e-9 / 3600, 1) + ' h']]);
          const p = S.V.p.frame({ x: [0, 1], y: [0, 1], xl: 'Position x / L', yl: 'Fraction of A  (c_A/c₀)', xs: 'x', ys: 'c' });
          p.fn(exact, 0, 1, { c: 'c2', w: 2, l: 'Fick’s law (molecular only, exact)' }); p.line(prof, { c: 'c1', w: 2.4, l: 'Particles (simulation)' }); p.pts(prof, { c: 'c1', r: 2.5 }); p.done();
        };
        raf = requestAnimationFrame(loop); App.onLeave(() => cancelAnimationFrame(raf));
        UI.walk(el, [
          { t: '1 · Molecules never stop', d: 'At 25 °C and 1 atm a nitrogen molecule flies at about 475 m/s but hits a neighbour every ~70 nm (about 7×10⁹ collisions per second). Each hit sends it off in a random direction, so the black tracer follows a zig-zag <b>random walk</b>.', hi: ['tr'], go: 0 },
          { t: '2 · Remove the partition', d: 'No force pushes A to the right. There are simply more A molecules on the left to wander right than on the right to wander back. That imbalance is a <b>net flux down the concentration gradient</b>: Fick’s law, J<sub>A</sub> = −D<sub>AB</sub> dc<sub>A</sub>/dz.', hi: ['a', 'b', 'wall'], go: 1 },
          { t: '3 · Spreading slows with distance', d: 'A random walk covers a distance of only about √(2Dt). Twice the distance needs four times the time. The particle profile below follows the erf solution of Fick’s second law.', hi: ['tr'], go: 1 },
          { t: '4 · Switch on eddies', d: 'Stirring or turbulence carries whole parcels of fluid around (purple cells). Mixing now depends on the flow: the eddy diffusivity E<sub>D</sub> is often 100–10 000 × D<sub>AB</sub>, and the particles leave the Fick curve.', hi: ['ed'], go: 2 }
        ], (i, x) => { if (!x.go) reset(); else run = true; S.set('eddy', x.go === 2); S.V.v.hi && S.V.v.hi(x.hi); });
        UI.note(el, 'With eddies off, the particle profile follows Fick’s-law prediction (erf curve) — Fick’s law <i>is</i> the average of countless random walks. Switch eddies on: mixing becomes far faster than molecular diffusion predicts. That extra transport is modelled with an eddy diffusivity $E_D$, a property of the <i>flow</i>, not of the molecules.');
      },
      eqs: [
        { n: 'Fick’s first law', m: 'J_A = -D_{AB}\\frac{dc_A}{dz}' },
        { n: 'Molecular + eddy diffusion', m: 'J_A = -(D_{AB}+E_D)\\frac{dc_A}{dz}' },
        { n: 'Fick’s second law (unsteady)', m: '\\frac{\\partial c_A}{\\partial t} = D_{AB}\\frac{\\partial^2 c_A}{\\partial z^2}' },
        { n: 'Random-walk (Einstein) relation', m: '\\langle x^2\\rangle = 2Dt \\Rightarrow t \\sim L^2/D' }],
      fx: [['↑ Distance L', 'diffusion time grows as L² — doubling L takes 4× longer'], ['↑ Temperature', 'molecules move faster → ↑ D'], ['Turbulence', 'E_D ≫ D_AB; mixing set by the flow, not the molecules'], ['Gas → liquid', 'D falls ~10⁴× (10⁻⁵ → 10⁻⁹ m²/s)']],
      quiz: [{ q: 'Fick’s law is analogous to…', o: ['Newton’s 2nd law', 'Fourier’s law of heat conduction', 'Bernoulli’s equation', 'Henry’s law'], a: 1 }, { q: 'If diffusing 1 cm takes 1 h, diffusing 3 cm takes about…', o: ['3 h', '9 h', '1.7 h', '27 h'], a: 1, ex: 't ∝ L²' }],
      refs: ["<i>Fick, A.</i> (1855) Ueber Diffusion. <i>Ann. Phys.</i> 94, 59–86.", "<i>Einstein, A.</i> (1905) Über die von der molekularkinetischen Theorie der Wärme geforderte Bewegung von in ruhenden Flüssigkeiten suspendierten Teilchen. <i>Ann. Phys.</i> 17, 549–560.", "<i>Crank, J.</i> (1975) <i>The Mathematics of Diffusion</i>, 2nd ed., Oxford University Press.", "<i>Bird, R.B., Stewart, W.E. & Lightfoot, E.N.</i> (2002) <i>Transport Phenomena</i>, 2nd ed., Wiley, Ch. 17–18.", "<i>Cussler, E.L.</i> (2009) <i>Diffusion: Mass Transfer in Fluid Systems</i>, 3rd ed., Cambridge University Press.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 2 (molecular diffusion in fluids)."]
    },

    {
      id: 'diffusivity', title: 'Diffusivity in gases & liquids', tags: 'diffusivity fuller wilke chang gas liquid temperature pressure viscosity self-diffusion',
      blurb: 'Fuller (gases) and Wilke–Chang (liquids) correlations — T, P, μ effects.',
      lead: 'Diffusivity depends on molecular size, mass, temperature, and (for gases) pressure or (for liquids) viscosity. Use correlations when data are missing.',
      render(el, UI) {
        const tb = UI.tabs(el, ['Gases — Fuller', 'Liquids — Wilke–Chang']);
        UI.sim(tb.panes[0], {
          title: 'Binary gas pair', controls: [{ k: 'a', t: 'select', label: 'Gas A', v: 'H2O', opts: GP }, { k: 'b', t: 'select', label: 'Gas B', v: 'air', opts: GP }, { k: 'T', label: 'Temperature', min: 200, max: 1000, step: 1, v: 298, unit: 'K' }, { k: 'P', label: 'Pressure', min: .1, max: 20, step: .05, v: 1, unit: 'atm' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 320 }],
          update(s, V) {
            const D = C.fuller(s.a, s.b, s.T, s.P * 1.01325);
            V.ro.set([['$D_{AB}$', UI.fmt(D, 4) + ' cm²/s', 'ok'], ['', UI.fmt(D * 1e-4, 3) + ' m²/s'], ['At 2× T', '×' + UI.fmt(Math.pow(2, 1.75), 3)], ['At 2× P', '× 0.5'], ['Schmidt no. (air-like, ν = 0.155 cm²/s at 1 atm, 298 K)', UI.fmt(.155 * Math.pow(s.T / 298, 1.7) / s.P / D, 2)]]);
            const p = V.p.frame({ x: [200, 1000], y: [0, C.fuller(s.a, s.b, 1000, s.P * 1.01325) * 1.1], xl: 'T (K)', yl: 'D_AB (cm²/s)', xs: 'T', ys: 'D' });
            [[s.P / 2, 'c2'], [s.P, 'c1'], [s.P * 2, 'c3']].forEach(([P, c]) => p.fn(T => C.fuller(s.a, s.b, T, P * 1.01325), 200, 1000, { c, l: `P = ${UI.fmt(P, 2)} atm`, w: P === s.P ? 2.6 : 1.3 }));
            p.pts([[s.T, D]], { c: 'tx', r: 5 }); p.done();
          }
        });
        UI.sim(tb.panes[1], {
          title: 'Dilute solute in solvent', controls: [{ k: 'a', t: 'select', label: 'Solute A', v: 'O2', opts: Object.fromEntries(Object.entries(C.solutes).map(([k, v]) => [k, v.name])) }, { k: 'b', t: 'select', label: 'Solvent B', v: 'water', opts: Object.fromEntries(Object.entries(C.solvents).map(([k, v]) => [k, v.name])) }, { k: 'T', label: 'Temperature', min: 278, max: 360, step: 1, v: 298, unit: 'K' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 320 }],
          update(s, V) {
            const D = C.wilkeChang(s.a, s.b, s.T), mu = C.solventMu(s.b, s.T);
            V.ro.set([['$D_{AB}^\\circ$', UI.fmt(D, 4) + ' cm²/s', 'ok'], ['', UI.fmt(D * 1e-4, 3) + ' m²/s'], ['Solvent viscosity', UI.fmt(mu, 3) + ' cP'], ['Association factor φ', C.solvents[s.b].phi + ''], ['Solute molar volume $V_A$', C.solutes[s.a].V + ' cm³/mol'], ['$D\\mu/T$ (≈ constant)', UI.fmt(D * mu / s.T, 3)]]);
            const p = V.p.frame({ x: [278, 360], y: [0, C.wilkeChang(s.a, s.b, 360) * 1.1], xl: 'T (K)', yl: 'D_AB (cm²/s)', xs: 'T', ys: 'D' });
            p.fn(T => C.wilkeChang(s.a, s.b, T), 278, 360, { l: 'Wilke–Chang' }); p.fn(T => D * (T / s.T) * (mu / C.solventMu(s.b, T)), 278, 360, { c: 'c2', dash: [5, 4], l: 'Stokes–Einstein scaling Dμ/T = const' }); p.pts([[s.T, D]], { c: 'tx', r: 5 }); p.done();
          }
        });
        UI.note(el, '<b>Self-diffusion</b> is diffusion of a species in itself (measured with isotopic tracers, e.g. D₂O in H₂O: 2.3×10⁻⁵ cm²/s). It is the limit of interdiffusion when A and B are identical molecules. Correlation accuracy: Fuller ±5 %, Wilke–Chang ±10–20 %.');
      },
      eqs: [
        { n: 'Fuller–Schettler–Giddings', m: 'D_{AB} = \\frac{0.00143\\,T^{1.75}}{P\\,M_{AB}^{1/2}\\left[(\\Sigma_v)_A^{1/3}+(\\Sigma_v)_B^{1/3}\\right]^2}', w: 'D cm²/s, T K, P bar, M_AB = 2/(1/M_A + 1/M_B)' },
        { n: 'Wilke–Chang', m: 'D^\\circ_{AB} = \\frac{7.4\\times10^{-8}(\\phi M_B)^{1/2}\\,T}{\\mu_B\\,V_A^{0.6}}', w: 'μ cP, V_A cm³/mol at normal boiling point' },
        { n: 'Stokes–Einstein', m: 'D_{AB} = \\frac{k_BT}{6\\pi\\mu_B r_A}' }],
      fx: [['↑ T (gas)', 'D ∝ T^1.75'], ['↑ P (gas)', 'D ∝ 1/P (more collisions)'], ['↑ T (liquid)', 'D ↑ strongly because μ falls'], ['Bigger molecule', 'D ↓ (V_A^0.6 or Σv)'], ['Lighter molecule (H₂, He)', 'D ↑ markedly']],
      quiz: [{ q: 'Raising the pressure of a gas mixture from 1 to 5 atm changes D_AB by…', o: ['×5', '×1/5', 'no change', '×√5'], a: 1 }, { q: 'Typical diffusivity of a small solute in water at 25 °C is about…', o: ['10⁻⁵ m²/s', '10⁻⁹ m²/s', '10⁻¹² m²/s', '10⁻³ m²/s'], a: 1 }],
      refs: ["<i>Fuller, E.N., Schettler, P.D. & Giddings, J.C.</i> (1966) A new method for prediction of binary gas-phase diffusion coefficients. <i>Ind. Eng. Chem.</i> 58(5), 18–27.", "<i>Wilke, C.R. & Chang, P.</i> (1955) Correlation of diffusion coefficients in dilute solutions. <i>AIChE J.</i> 1(2), 264–270.", "<i>Poling, B.E., Prausnitz, J.M. & O’Connell, J.P.</i> (2001) <i>The Properties of Gases and Liquids</i>, 5th ed., McGraw-Hill, Ch. 11.", "<i>Cussler, E.L.</i> (2009) <i>Diffusion: Mass Transfer in Fluid Systems</i>, 3rd ed., Cambridge University Press.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 2 (molecular diffusion in fluids)."]
    },

    {
      id: 'ss-diffusion', title: 'Steady diffusion: stagnant film, counter-diffusion, multicomponent', tags: 'stagnant film equimolar counter diffusion log mean bulk flow stefan multicomponent wilke maxwell',
      blurb: 'A through stagnant B vs equimolar counter-diffusion; effective diffusivity in mixtures.',
      lead: 'When only A moves (e.g. evaporation into air), diffusion creates a <b>bulk flow</b> toward the interface that adds to the flux. In <b>equimolar counter-diffusion</b> (e.g. distillation with CMO) A and B move in opposite directions and there is no net bulk flow.',
      render(el, UI) {
        UI.sim(el, {
          title: 'Diffusion path', controls: [{ k: 'a', t: 'select', label: 'Diffusing A', v: 'acetone', opts: GP }, { k: 'b', t: 'select', label: 'Through B', v: 'air', opts: GP }, { k: 'T', label: 'Temperature', min: 250, max: 500, step: 1, v: 298, unit: 'K' }, { k: 'P', label: 'Total pressure', min: .2, max: 5, step: .05, v: 1, unit: 'atm' },
            { k: 'z', label: 'Path length z', min: .1, max: 30, step: .1, v: 5, unit: 'cm' }, { k: 'y1', label: 'y_A at z = 0 (source)', min: .01, max: .95, step: .01, v: .3 }, { k: 'y2', label: 'y_A at z (sink)', min: 0, max: .9, step: .01, v: 0 }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 320 }],
          update(s, V) {
            const y2 = Math.min(s.y2, s.y1 - .001), D = C.fuller(s.a, s.b, s.T, s.P * 1.01325) * 1e-4, P = s.P * 101325, ct = P / (8.314 * s.T), z = s.z / 100;
            const Ns = D * ct / z * Math.log((1 - y2) / (1 - s.y1)), Ne = D * ct / z * (s.y1 - y2), yBM = ((1 - y2) - (1 - s.y1)) / Math.log((1 - y2) / (1 - s.y1));
            V.ro.set([['$D_{AB}$', UI.fmt(D * 1e4, 4) + ' cm²/s'], ['$c = P/RT$', UI.fmt(ct, 3) + ' mol/m³'], ['$N_A$ stagnant B', UI.fmt(Ns * 3600 * 1000, 4) + ' mmol/m²·h', 'ok'], ['$N_A$ equimolar', UI.fmt(Ne * 3600 * 1000, 4) + ' mmol/m²·h'], ['Bulk-flow factor $1/y_{B,lm}$', UI.fmt(1 / yBM, 4)], ['Ratio stagnant/equimolar', UI.fmt(Ns / Ne, 4)]]);
            const p = V.p.frame({ x: [0, s.z], y: [0, 1], xl: 'z (cm)', yl: 'mole fraction y_A', xs: 'z', ys: 'y' });
            p.fn(zz => 1 - (1 - s.y1) * Math.pow((1 - y2) / (1 - s.y1), zz / s.z), 0, s.z, { l: 'A through stagnant B (exponential in y_B)' }); p.fn(zz => s.y1 + (y2 - s.y1) * zz / s.z, 0, s.z, { c: 'c2', dash: [5, 4], l: 'Equimolar counter-diffusion (linear)' });
            p.fn(zz => (1 - s.y1) * Math.pow((1 - y2) / (1 - s.y1), zz / s.z), 0, s.z, { c: 'c3', w: 1.4, l: 'y_B (stagnant case)' }); p.done();
          }
        });
        UI.sec(el, 'Multicomponent diffusion — A through a stagnant mixture', 'Wilke’s approximation: an effective diffusivity weighted by the other components.');
        UI.sim(el, {
          title: 'A diffusing through B + C', controls: [{ k: 'a', t: 'select', label: 'A', v: 'NH3', opts: GP }, { k: 'b', t: 'select', label: 'B', v: 'H2', opts: GP }, { k: 'c', t: 'select', label: 'C', v: 'N2', opts: GP }, { k: 'fb', label: 'B share of non-diffusing gas', min: 0, max: 1, step: .01, v: .5 }, { k: 'T', label: 'T', min: 250, max: 600, step: 1, v: 298, unit: 'K' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 260 }],
          update(s, V) {
            const Db = C.fuller(s.a, s.b, s.T, 1.01325), Dc = C.fuller(s.a, s.c, s.T, 1.01325), Dm = 1 / (s.fb / Db + (1 - s.fb) / Dc);
            V.ro.set([['$D_{AB}$', UI.fmt(Db, 4) + ' cm²/s'], ['$D_{AC}$', UI.fmt(Dc, 4) + ' cm²/s'], ['$D_{A,mix}$', UI.fmt(Dm, 4) + ' cm²/s', 'ok']]);
            const p = V.p.frame({ x: [0, 1], y: [0, Math.max(Db, Dc) * 1.1], xl: "B fraction of stagnant gas  y'_B", yl: 'D_A,mix (cm²/s)' }); p.fn(f => 1 / (f / Db + (1 - f) / Dc), 0, 1); p.pts([[s.fb, Dm]], { c: 'tx', r: 5 }); p.done();
          }
        });
      },
      eqs: [
        { n: 'General flux', m: 'N_A = -cD_{AB}\\frac{dy_A}{dz} + y_A(N_A+N_B)' },
        { n: 'A through stagnant B', m: 'N_A = \\frac{D_{AB}P}{RTz}\\ln\\frac{P-p_{A2}}{P-p_{A1}} = \\frac{D_{AB}P}{RTz\\,p_{B,lm}}(p_{A1}-p_{A2})' },
        { n: 'Equimolar counter-diffusion', m: 'N_A = -N_B = \\frac{D_{AB}}{RTz}(p_{A1}-p_{A2})' },
        { n: 'Wilke effective diffusivity', m: 'D_{A,m} = \\frac{1-y_A}{\\sum_{j\\neq A} y_j/D_{Aj}} = \\left(\\sum \\frac{y\'_j}{D_{Aj}}\\right)^{-1}' }],
      fx: [['↑ y_A at source', 'stagnant-film flux grows faster than linear (bulk flow)'], ['Dilute A (y_A → 0)', 'both cases give the same flux'], ['↑ Path length', 'flux ∝ 1/z'], ['Light component in mixture (H₂)', 'raises D_A,mix']],
      quiz: [{ q: 'Water evaporating from a pan into still air is an example of…', o: ['equimolar counter-diffusion', 'diffusion through a stagnant gas', 'Knudsen diffusion', 'eddy diffusion'], a: 1 }, { q: 'In equimolar counter-diffusion the concentration profile is…', o: ['linear', 'exponential', 'parabolic', 'logarithmic'], a: 0 }],
      refs: ["<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 2 (molecular diffusion in fluids).", "<i>Bird, R.B., Stewart, W.E. & Lightfoot, E.N.</i> (2002) <i>Transport Phenomena</i>, 2nd ed., Wiley, Ch. 17–18.", "<i>Wilke, C.R.</i> (1950) Diffusional properties of multicomponent gases. <i>Chem. Eng. Prog.</i> 46, 95–104.", "<i>Taylor, R. & Krishna, R.</i> (1993) <i>Multicomponent Mass Transfer</i>, Wiley.", "<i>Fuller, E.N., Schettler, P.D. & Giddings, J.C.</i> (1966) A new method for prediction of binary gas-phase diffusion coefficients. <i>Ind. Eng. Chem.</i> 58(5), 18–27."]
    },

    {
      id: 'stefan-tube', title: 'Stefan tube: evaporation, diffusion & the material balance', tags: 'stefan tube arnold cell evaporation stagnant film diffusivity measurement pseudo steady material balance level drop sweep',
      blurb: 'A liquid evaporates up a narrow tube: watch the level fall and close the balance.',
      lead: 'A <b>Stefan tube</b> is a narrow vertical tube with a volatile liquid at the bottom and a gentle stream of air across the top. Vapour diffuses up through stagnant air. The level falls slowly and measurably, so it is the classic way to <b>measure a gas diffusivity</b>, and a clean material balance on diffusion.',
      render(el, UI) {
        const LQ = { H2O: 'water', methanol: 'methanol', ethanol: 'ethanol', acetone: 'acetone', benzene: 'benzene', toluene: 'toluene' }, st = { hl: 2, y1: .3 };
        const S = UI.sim(el, {
          title: 'Stefan tube: 1 cm bore, liquid initially 4 cm deep', controls: [
            { k: 'a', t: 'select', label: 'Liquid A', v: 'acetone', opts: Object.fromEntries(Object.keys(LQ).map(k => [k, C.comp[LQ[k]].name])) },
            { k: 'T', label: 'Temperature', min: 5, max: 45, step: 1, v: 25, unit: '°C' },
            { k: 'P', label: 'Total pressure', min: .5, max: 2, step: .01, v: 1, unit: 'atm' },
            { k: 'z0', label: 'Initial gas path $z_0$ (surface → top)', min: 1, max: 15, step: .1, v: 3, unit: 'cm' },
            { k: 't', label: 'Elapsed time', min: .1, max: 1000, v: 24, log: 1, unit: 'h' },
            { k: 'Q', label: 'Sweep air flow', min: 5, max: 1000, v: 100, log: 1, unit: 'mL/min' }],
          views: [{ k: 'v', t: '3d', h: 440, cam: [2.4, 2.6, 6.6], target: [.3, 2.1, 0] }, { k: 'd', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 300 }],
          update(s, V, S) {
            if (V.v.ok) { if (!S._b) { S._b = 1; stefan(V.v, st); } const w = V.v.el.clientWidth || 700, k = Math.min(2.2, Math.max(1, 640 / w)); if (S._w !== k) { S._w = k; V.v.look([2.4 * k, 2.6, 6.6 * k], [.3, 2.1, 0]); } }
            const TK = s.T + 273.15, Pa = s.P * 101325, c = Pa / (8.314 * TK), lk = LQ[s.a], cp = C.comp[lk], Mk = cp.M / 1000, rho = cp.rho, pv = C.psat(lk, s.T), y1 = pv / Pa;
            V.d.innerHTML = '';
            if (y1 >= .95) { st.y1 = .95; V.ro.set([['Vapour pressure $p^*_A$', fm(pv / 1000, 3) + ' kPa'], ['Result', 'p* ≥ P: the liquid boils. This is no longer a diffusion problem.', 'bad']]); return; }
            const D = C.fuller(s.a, 'air', TK, s.P * 1.01325) * 1e-4, lnB = Math.log(1 / (1 - y1)), K = c * D * lnB, h0 = .04, z0 = s.z0 / 100, Lt = z0 + h0, Ar = Math.PI * .005 * .005;
            const zt = tt => Math.sqrt(z0 * z0 + 2 * Mk * K * tt / rho), tDry = rho * (Lt * Lt - z0 * z0) / (2 * Mk * K), ts = Math.min(s.t * 3600, tDry), z = zt(ts), NA = K / z;
            const nLiq = rho * Ar * (z - z0) / Mk; let nDif = 0; for (let i = 0, m = 400; i < m; i++) { const a = ts * i / m, b = ts * (i + 1) / m; nDif += .5 * (K / zt(a) + K / zt(b)) * Ar * (b - a); }
            const nsw = s.Q * 1e-6 / 60 * c, W = NA * Ar, yo = W / (nsw + W), chk = c * y1 * Mk / rho;
            Object.assign(st, { hl: 4 * (Lt - z) / Lt, y1 });
            V.ro.set([['Vapour pressure $p^*_A$ (Antoine)', fm(pv / 1000, 3) + ' kPa'], ['$y_{A1} = p^*_A/P$ just above the liquid', fm(y1, 3)], ['$D_{A,air}$ (Fuller)', fm(D * 1e4, 3) + ' cm²/s'], ['$c = P/RT$', fm(c, 3) + ' mol/m³'], ['Bulk-flow factor $\\ln[1/(1-y_{A1})]/y_{A1}$', fm(lnB / y1, 3)],
              ['Gas path now $z$', fm(z * 100, 3) + ' cm'], ['<b>Flux $N_A$ now</b>', fm(NA * 3600, 3) + ' mol/(m²·h)', 'ok'], ['Level falls at', fm(NA * Mk / rho * 3.6e6, 3) + ' mm/h'],
              ['Pseudo-steady check $c\\,y_{A1}M_A/\\rho_L$', fm(chk, 4) + (chk < .01 ? ' (≪ 1 ✓)' : ' (not small)'), chk < .01 ? '' : 'warn'], ...(s.t * 3600 > tDry ? [['Tube ran dry after', fm(tDry / 3600, 3) + ' h', 'warn']] : [])]);
            const T = (x, y, t, a = 'start', k = '') => `<text x="${x}" y="${y}" text-anchor="${a}" class="${k}">${t}</text>`, ar = (x1, y1, x2, y2) => `<line class="s" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#ar)"/>`, mm = x => fm(x * 1000, 2);
            const dif = Math.abs(nLiq - nDif) / nLiq * 100, hy = 64 + 120 * (z / Lt);
            UI.svg(V.d, `<defs><marker id="ar" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L8,4 L0,8 z" class="a"/></marker></defs>`
              + `<rect class="s" x="270" y="64" width="50" height="120" rx="4"/><rect x="272" y="${hy}" width="46" height="${184 - hy}" fill="#60a5fa" opacity=".45"/>` + ar(40, 50, 266, 50) + ar(324, 50, 600, 50)
              + T(40, 36, `Sweep air in: ${fm(nsw * 3600, 3)} mol/h, y = 0`) + T(330, 36, `Sweep out: y_A = ${fm(yo, 4)}`, 'start', 'v') + T(330, 72, yo < .05 * y1 ? `≪ y_A1 = ${fm(y1, 3)}, so y_A2 ≈ 0 holds` : `not ≪ y_A1: raise the sweep flow`, 'start', yo < .05 * y1 ? 'mu' : 'k')
              + ar(295, hy - 6, 295, 70) + T(330, 120, `Diffused up now: N_A·A = ${fm(W * 3.6e6, 3)} mmol/h`, 'start', 'v') + T(262, hy + 4, 'liquid surface', 'end', 'mu') + T(262, hy + 20, `level down ${fm((z - z0) * 100, 3)} cm`, 'end', 'v')
              + T(310, 228, `Over ${fm(ts / 3600, 3)} h:  lost from liquid ρ_L·A·Δz/M = ${mm(nLiq)} mmol  ·  ∫N_A·A dt = ${mm(nDif)} mmol`, 'middle', 'k') + T(310, 246, `difference ${dif < 1e-3 ? '< 0.001' : fm(dif, 2)} %: the balance closes`, 'middle', 'v'), '0 0 620 254', 280).firstChild.classList.add('flow');
            const tm = Math.max(s.t * 1.6, 1), xm = Math.min(tm, tDry / 3600), p = V.p.frame({ x: [0, xm], y: [z0 * 100, Lt * 100], xl: 'Time (h)', yl: 'Gas path z (cm)', xs: 't h', ys: 'z cm' });
            p.fn(h => zt(h * 3600) * 100, 0, xm, { c: 'c1', w: 2.4, l: 'Pseudo-steady: z² − z₀² ∝ t' }); p.fn(h => (z0 + K / z0 * Mk / rho * h * 3600) * 100, 0, Math.min(xm, (Lt - z0) / (K / z0 * Mk / rho) / 3600),{ c: 'c2', dash: [5, 4], l: 'If the first flux never fell' });
            p.pts([[ts / 3600, z * 100]], { c: 'tx', r: 5 }); p.done();
          }
        });
        UI.walk(el, [
          { t: '1 · Liquid at the bottom', d: 'Just above the surface the gas is saturated: y<sub>A1</sub> = p*<sub>A</sub>/P, with the vapour pressure from the Antoine equation. Warmer liquid means a much higher y<sub>A1</sub>.', hi: ['liq'] },
          { t: '2 · Vapour diffuses up', d: 'The vapour fraction falls from y<sub>A1</sub> at the surface to almost zero at the top. Fewer molecules carry the same flux higher up, so they move faster there and the orange dots thin out.', hi: ['vap'] },
          { t: '3 · The air does not move', d: 'Air hardly dissolves in the liquid, so its net flux is zero. Air diffuses down the tube, but the upward bulk flow cancels it exactly. This is <b>diffusion of A through stagnant B</b>: N<sub>A</sub> = (cD/z)·ln[(1 − y<sub>A2</sub>)/(1 − y<sub>A1</sub>)].', hi: ['air'] },
          { t: '4 · Sweep gas at the top', d: 'A slow air stream carries the vapour away, so y<sub>A2</sub> ≈ 0. The balance panel checks this: the outlet mole fraction must be much smaller than y<sub>A1</sub>.', hi: ['sw'] },
          { t: '5 · The level falls (pseudo-steady)', d: 'Liquid balance: (ρ<sub>L</sub>/M)·dz/dt = N<sub>A</sub>. The level moves so slowly that the gas profile is always at steady state. Integrating gives z² − z<sub>0</sub>² ∝ t, and the slope of z² against t gives D. This is how many gas diffusivities were measured.', hi: ['lvl'] }
        ], (i, x) => S.V.v.hi && S.V.v.hi(x.hi));
        UI.note(el, 'Material balance on A over the elapsed time: moles lost from the liquid (level drop) = moles diffused through the gas (numerical integral of N<sub>A</sub>·A) = moles carried off by the sweep air. The first two are computed independently and agree, which confirms the pseudo-steady solution.');
      },
      eqs: [
        { n: 'Flux through stagnant air', m: 'N_A = \\frac{cD_{AB}}{z}\\ln\\frac{1-y_{A2}}{1-y_{A1}}' },
        { n: 'Liquid balance (pseudo-steady)', m: '\\frac{\\rho_L}{M_A}\\frac{dz}{dt} = N_A' },
        { n: 'Integrated: level vs time', m: 't = \\frac{\\rho_L\\,(z^2-z_0^2)}{2M_A\\,cD_{AB}\\ln[(1-y_{A2})/(1-y_{A1})]}' },
        { n: 'Sweep-gas balance', m: '\\dot n_{sw}\\,\\frac{y_{out}}{1-y_{out}} = N_A A' }],
      fx: [['↑ Temperature', 'p* rises steeply → y_A1 and N_A rise; D also rises (∝ T^1.75)'], ['Level falls', 'z grows → N_A ∝ 1/z falls → z grows as √t'], ['↑ Total pressure', 'D ∝ 1/P and y_A1 falls → slower evaporation'], ['Too little sweep air', 'y_A2 builds up → less flux than predicted']],
      quiz: [{ q: 'In a Stefan tube the air column is stagnant because…', o: ['air is heavier than the vapour', 'air does not dissolve in the liquid, so its net flux is zero', 'the tube is sealed at the top', 'air diffuses faster than the vapour'], a: 1 },
        { q: 'If the gas path z doubles, the evaporation flux…', o: ['doubles', 'halves', 'stays the same', 'falls 4×'], a: 1 }],
      refs: ['<i>Stefan, J.</i> (1873) Versuche über die Verdampfung. <i>Sitzungsber. Akad. Wiss. Wien, Math.-Naturwiss. Kl.</i> 68, 385–423.',
        '<i>Bird, R.B., Stewart, W.E. & Lightfoot, E.N.</i> (2002) <i>Transport Phenomena</i>, 2nd ed., Wiley, Ch. 18 (diffusion through a stagnant gas film).',
        '<i>Geankoplis, C.J.</i> (2003) <i>Transport Processes and Separation Process Principles</i>, 4th ed., Prentice Hall, Ch. 6.',
        '<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 2.',
        '<i>Fuller, E.N., Schettler, P.D. & Giddings, J.C.</i> (1966) A new method for prediction of binary gas-phase diffusion coefficients. <i>Ind. Eng. Chem.</i> 58(5), 18–27.',
        '<i>Dean, J.A.</i> (1999) <i>Lange’s Handbook of Chemistry</i>, 15th ed., McGraw-Hill. (Antoine constants and liquid densities)']
    },

    {
      id: 'pores', title: 'Knudsen, surface & self-diffusion in pores', tags: 'knudsen pore mean free path bosanquet effective diffusivity tortuosity porosity surface diffusion catalyst',
      blurb: 'When pores get smaller than the mean free path, molecules hit walls instead of each other.',
      lead: 'Inside catalysts and adsorbents, gas moves through pores. If the pore diameter $d$ is much smaller than the <b>mean free path</b> λ, molecules collide with walls more than with each other: this is <b>Knudsen diffusion</b>, independent of pressure and of the other gas.',
      render(el, UI) {
        const st = { kn: 1, TM: 3 }, S = UI.sim(el, {
          title: 'Pore conditions', controls: [{ k: 'a', t: 'select', label: 'Diffusing gas', v: 'CO2', opts: GP }, { k: 'b', t: 'select', label: 'Other gas', v: 'N2', opts: GP }, { k: 'd', label: 'Pore diameter', min: 1, max: 1e5, v: 20, log: 1, unit: 'nm' }, { k: 'T', label: 'Temperature', min: 250, max: 900, step: 1, v: 600, unit: 'K' }, { k: 'P', label: 'Pressure', min: .01, max: 50, v: 1, log: 1, unit: 'atm' },
            { k: 'eps', label: 'Porosity ε', min: .1, max: .8, step: .01, v: .4 }, { k: 'tau', label: 'Tortuosity τ', min: 1, max: 8, step: .1, v: 4 }],
          views: [{ k: 'v', t: '3d', h: 340, cam: [0, 1.6, 7.6], target: [0, 0, 0] }, { k: 'cnt', t: 'html' }, { k: 'ro', t: 'ro' }, { k: 'p', t: 'plot', h: 340 }],
          update(s, V, S) {
            const M = C.diffGas[s.a].M, Dab = C.fuller(s.a, s.b, s.T, s.P * 1.01325) * 1e-4, DK = d => C.knudsen(d * 1e-9, s.T, M), lam = C.meanFreePath(s.T, s.P * 101325), Kn = lam / (s.d * 1e-9);
            const Dp = d => 1 / (1 / Dab + 1 / DK(d)), De = Dp(s.d) * s.eps / s.tau;
            st.kn = Kn; st.TM = Math.sqrt(s.T / M); st.ws = Dp(s.d) / DK(s.d); if (!S._b && V.v.ok) { S._b = 1; pore(V.v, st, V.cnt); }
            V.ro.set([['Mean free path λ', UI.fmt(lam * 1e9, 4) + ' nm'], ['Knudsen no. λ/d', UI.fmt(Kn, 3), Kn > 10 ? 'warn' : ''], ['Regime', Kn > 10 ? 'Knudsen' : Kn < .1 ? 'Molecular' : 'Transition'], ['$D_{AB}$', UI.fmt(Dab, 3) + ' m²/s'], ['$D_K$', UI.fmt(DK(s.d), 3) + ' m²/s'], ['Pore $D$ (Bosanquet)', UI.fmt(Dp(s.d), 3) + ' m²/s'], ['<b>Effective $D_e = \\varepsilon D/\\tau$</b>', UI.fmt(De, 3) + ' m²/s', 'ok']]);
            const p = V.p.frame({ x: [1, 1e5], y: [1e-9, 1e-3], logx: 1, logy: 1, xl: 'Pore diameter (nm)', yl: 'Diffusivity (m²/s)', xs: 'd nm', ys: 'D' });
            p.fn(DK, 1, 1e5, { c: 'c2', logx: 1, l: 'Knudsen D_K ∝ d√(T/M)' }); p.fn(() => Dab, 1, 1e5, { c: 'c3', logx: 1, l: 'Molecular D_AB ∝ 1/P' }); p.fn(Dp, 1, 1e5, { c: 'c1', w: 3, logx: 1, l: 'Combined (Bosanquet)' });
            p.vl(lam * 1e9, { l: 'd = λ' }); p.pts([[s.d, Dp(s.d)]], { c: 'tx', r: 5 }); p.done();
          }
        });
        UI.walk(el, [
          { t: '1 · Wide pore: molecular diffusion', d: 'In a 10 µm pore the mean free path (about 0.1 µm in a gas at 1 atm) is far smaller than the pore. Molecules mostly hit <b>each other</b> (green flashes), so D = D<sub>AB</sub>, which falls as 1/P.', hi: ['kg'], d0: 1e4 },
          { t: '2 · Transition: pore ≈ mean free path', d: 'Wall hits and molecule hits are comparable. The two resistances act in series and add: 1/D = 1/D<sub>AB</sub> + 1/D<sub>K</sub> (Bosanquet).', hi: ['kg', 'kw'], d0: 150 },
          { t: '3 · Narrow pore: Knudsen diffusion', d: 'In a 5 nm pore almost every hit is on the <b>wall</b> (orange flashes). Each wall hit sends the molecule off in a random direction (cosine law), so D<sub>K</sub> = (d/3)·v̄ depends on pore size and molecular speed, not on pressure or on the other gas.', hi: ['kw', 'pw'], d0: 5 }
        ], (i, x) => { S.set('d', x.d0); S.V.v.hi && S.V.v.hi(x.hi); });
        UI.para(el, '<h3>Surface diffusion</h3><p>Adsorbed molecules can hop along the pore wall from site to site. It adds a parallel path to gas-phase diffusion, important for strongly adsorbed species at low temperature (e.g. hydrocarbons on activated carbon). It is activated: $D_s = D_{s0}e^{-E_s/RT}$, with $E_s$ usually below the heat of adsorption.</p><h3>Self-diffusion</h3><p>Movement of molecules of a species within the same species — measured with labelled isotopes. In solids it controls sintering and creep; in liquids it equals the interdiffusion limit of identical molecules.</p>');
      },
      eqs: [
        { n: 'Knudsen diffusivity', m: 'D_K = \\frac{d}{3}\\sqrt{\\frac{8RT}{\\pi M}} = 4850\\,d\\sqrt{T/M}\\ \\text{(cm²/s, d in cm)}' },
        { n: 'Mean free path', m: '\\lambda = \\frac{k_BT}{\\sqrt2\\,\\pi\\sigma^2 P}' },
        { n: 'Bosanquet (transition)', m: '\\frac{1}{D_A} = \\frac{1}{D_{AB}}+\\frac{1}{D_K}' },
        { n: 'Effective diffusivity', m: 'D_e = \\frac{\\varepsilon\\,D_A}{\\tau}' }],
      fx: [['↓ Pore size', 'D_K ∝ d — smaller pores, slower diffusion'], ['↓ Pressure', 'λ grows → Knudsen regime takes over'], ['↑ Temperature', 'D_K ∝ √T (weaker than molecular T^1.75)'], ['Heavier molecule', 'D_K ∝ 1/√M — the basis of isotope (UF₆) separation']],
      quiz: [{ q: 'In the Knudsen regime, doubling total pressure changes D_K by…', o: ['×2', '×1/2', 'no change', '×4'], a: 2 }],
      refs: ["<i>Knudsen, M.</i> (1909) Die Gesetze der Molekularströmung und der inneren Reibungsströmung der Gase durch Röhren. <i>Ann. Phys.</i> 28, 75–130.", "<i>Pollard, W.G. & Present, R.D.</i> (1948) On gaseous self-diffusion in long capillary tubes. <i>Phys. Rev.</i> 73, 762–774. (Bosanquet interpolation)", "<i>Wheeler, A.</i> (1951) Reaction rates and selectivity in catalyst pores. <i>Adv. Catal.</i> 3, 249–327.", "<i>Satterfield, C.N.</i> (1970) <i>Mass Transfer in Heterogeneous Catalysis</i>, MIT Press.", "<i>Cussler, E.L.</i> (2009) <i>Diffusion: Mass Transfer in Fluid Systems</i>, 3rd ed., Cambridge University Press.", "<i>Fuller, E.N., Schettler, P.D. & Giddings, J.C.</i> (1966) A new method for prediction of binary gas-phase diffusion coefficients. <i>Ind. Eng. Chem.</i> 58(5), 18–27."]
    },

    {
      id: 'solids', title: 'Diffusion in solids (unsteady)', tags: 'solid diffusion carburizing erf arrhenius activation semi-infinite slab drying self diffusion',
      blurb: 'Carburising steel, drying slabs — Fick’s 2nd law with erf and series solutions.',
      lead: 'Atoms diffuse through solids by jumping between vacancies or interstitial sites. Diffusivity follows Arrhenius: very temperature sensitive. Because D is tiny, most solid problems are <b>unsteady</b> (the profile keeps changing).',
      render(el, UI) {
        const DB = { cg: ['C in γ-Fe (austenite)', 2.3e-5, 148], ca: ['C in α-Fe (ferrite)', 1.1e-6, 87.4], zncu: ['Zn in Cu', 2.4e-5, 189], cual: ['Cu in Al', 6.5e-5, 136], fea: ['Fe in α-Fe (self)', 2.8e-4, 251], cucu: ['Cu in Cu (self)', 7.8e-5, 211], alal: ['Al in Al (self)', 2.3e-4, 144] };
        UI.sim(el, {
          title: 'Semi-infinite solid', controls: [{ k: 'sys', t: 'select', label: 'Diffusion couple (Callister data)', v: 'cg', opts: Object.fromEntries(Object.entries(DB).map(([k, v]) => [k, v[0]])) }, { k: 'T', label: 'Temperature', min: 300, max: 1300, step: 1, v: 950, unit: '°C' }, { k: 't', label: 'Time', min: .1, max: 50, step: .1, v: 10, unit: 'h' },
            { k: 'cs', label: 'Surface concentration $c_s$', min: .2, max: 1.4, step: .01, v: 1.2, unit: 'wt%' }, { k: 'c0', label: 'Initial concentration $c_0$', min: 0, max: .8, step: .01, v: .2, unit: 'wt%' }, { k: 'cx', label: 'Target concentration', min: .05, max: 1.3, step: .01, v: .8, unit: 'wt%' }],
          views: [{ k: 'ro', t: 'ro' }, { k: 'r', t: 'row' }, { k: 'p', t: 'plot', row: 'r', h: 320 }, { k: 'q', t: 'plot', row: 'r', h: 320 }],
          update(s, V) {
            const [, D0, Q] = DB[s.sys], D = T => D0 * Math.exp(-Q * 1000 / (8.314 * (T + 273.15))), Dt = D(s.T), tt = s.t * 3600;
            const prof = x => s.cs - (s.cs - s.c0) * C.erf(x / (2 * Math.sqrt(Dt * tt))), frac = (s.cx - s.cs) / (s.c0 - s.cs);
            const xd = frac > 0 && frac < 1 ? C.bisect(x => C.erf(x / (2 * Math.sqrt(Dt * tt))) - frac, 0, 1) : NaN, Lmax = Math.max(4 * Math.sqrt(Dt * tt), 1e-6);
            V.ro.set([['D at T', UI.fmt(Dt, 3) + ' m²/s'], ['Diffusion length √(Dt)', UI.fmt(Math.sqrt(Dt * tt) * 1000, 4) + ' mm'], ['<b>Depth to target</b>', isNaN(xd) ? '—' : UI.fmt(xd * 1000, 4) + ' mm', 'ok'], ['D doubles every', UI.fmt(Math.LN2 * 8.314 * Math.pow(s.T + 273.15, 2) / (Q * 1000), 1) + ' K'], ['Time for 2× depth', UI.fmt(s.t * 4, 1) + ' h']]);
            const p = V.p.frame({ x: [0, Lmax * 1000], y: [0, Math.max(s.cs, s.c0) * 1.1], xl: 'Depth below surface (mm)', yl: 'Concentration (wt%)', xs: 'x mm', ys: 'c' });
            [.25, .5, 1].forEach((f, i) => p.fn(x => s.cs - (s.cs - s.c0) * C.erf(x / 1000 / (2 * Math.sqrt(Dt * tt * f))), 0, Lmax * 1000, { c: ['c2', 'c3', 'c1'][i], w: f === 1 ? 2.6 : 1.3, l: `t = ${UI.fmt(s.t * f, 2)} h` }));
            p.hl(s.cx, { l: 'target' }); if (!isNaN(xd)) p.pts([[xd * 1000, s.cx]], { c: 'tx', r: 5 }); p.done();
            const q = V.q.frame({ x: [300, 1300], y: [1e-22, 1e-8], logy: 1, xl: 'T (°C)', yl: 'D (m²/s)', xs: 'T', ys: 'D' });
            Object.keys(DB).forEach((k, i) => q.fn(D => DB[k][1] * Math.exp(-DB[k][2] * 1000 / (8.314 * (D + 273.15))), 300, 1300, { c: ['c1', 'c2', 'c3', 'c4', 'c5', 'tx', 'mu'][i], w: k === s.sys ? 3 : 1.2, l: DB[k][0] }));
            q.vl(s.T); q.done();
          }
        });
        UI.note(el, 'Interstitial diffusion (C in Fe) is far faster than substitutional or self-diffusion (Fe in Fe) because small atoms don’t need a vacancy to move. That is why steel can be case-hardened by carbon without changing its iron framework.');
      },
      eqs: [
        { n: 'Semi-infinite solid, constant surface conc.', m: '\\frac{c_s - c(x,t)}{c_s - c_0} = \\operatorname{erf}\\left(\\frac{x}{2\\sqrt{Dt}}\\right)' },
        { n: 'Arrhenius', m: 'D = D_0\\exp\\left(-\\frac{Q}{RT}\\right)' },
        { n: 'Slab (thickness 2l), uptake', m: '\\frac{M_t}{M_\\infty} = 1-\\sum_{n=0}^{\\infty}\\frac{8}{(2n+1)^2\\pi^2}e^{-D(2n+1)^2\\pi^2t/4l^2}' },
        { n: 'Steady flux through a membrane', m: 'N_A = \\frac{D_{AB}(c_{A1}-c_{A2})}{z} = \\frac{D_{AB}S(p_{A1}-p_{A2})}{z}', w: 'S = solubility; DS = permeability' }],
      fx: [['↑ Temperature', 'D rises exponentially → much faster case hardening'], ['↑ Time', 'depth grows as √t (4× time → 2× depth)'], ['Interstitial vs substitutional', 'interstitial is orders of magnitude faster']],
      quiz: [{ q: 'To double the carburised depth at the same temperature, time must be…', o: ['doubled', 'quadrupled', 'halved', 'unchanged'], a: 1 }],
      refs: ["<i>Callister, W.D. & Rethwisch, D.G.</i> (2018) <i>Materials Science and Engineering: An Introduction</i>, 10th ed., Wiley, Ch. 5 (diffusion data D₀, Q<sub>d</sub>).", "<i>Shewmon, P.G.</i> (1989) <i>Diffusion in Solids</i>, 2nd ed., TMS.", "<i>Crank, J.</i> (1975) <i>The Mathematics of Diffusion</i>, 2nd ed., Oxford University Press.", "<i>Treybal, R.E.</i> (1980) <i>Mass-Transfer Operations</i>, 3rd ed., McGraw-Hill, Ch. 4 (diffusion in solids)."]
    }
  ];
})();
