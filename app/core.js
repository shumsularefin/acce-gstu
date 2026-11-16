/* ChemE Studio — core: registry, router, UI kit, plotting, 3D kit, lab engine. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, p, ...kids) => {
    const e = document.createElement(tag);
    if (p) for (const k in p) {
      const v = p[k]; if (v == null || v === false) continue;
      if (k === 'html') e.innerHTML = v; else if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  };
  const store = { get(k, d) { try { const v = localStorage.getItem('cs.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('cs.' + k, JSON.stringify(v)); } catch { } } };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim() || n;
  const fmt = (v, d = 3) => {
    if (v == null || !isFinite(v)) return '—';
    const a = Math.abs(v); if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(d - 1).replace('e', '×10^').replace(/\^\+?(-?\d+)/, (m, e) => sup(e));
    return (+v.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d });
  };
  const sup = s => String(s).replace(/./g, c => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] || (c === '-' ? '⁻' : c));
  const math = el => { if (window.renderMathInElement) try { renderMathInElement(el, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false }], throwOnError: false }); } catch { } };
  const texC = {}; const tex = s => String(s).replace(/\$([^$]+)\$/g, (m, t) => texC[t] || (window.katex ? (texC[t] = katex.renderToString(t, { throwOnError: false })) : m));
  const toast = m => { let t = $('.toast'); if (!t) document.body.append(t = h('div', { class: 'toast' })); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 1800); };

  /* ================= Plot (canvas 2-D charts) ================= */
  class Plot {
    constructor(el) {
      this.c = el; this.g = el.getContext('2d'); this.m = { l: 58, r: 16, t: 14, b: 44 };
      const tip = h('div', { class: 'card', style: 'position:absolute;pointer-events:none;padding:4px 8px;font:12px var(--mono);display:none;z-index:5;white-space:nowrap' });
      el.parentNode.style.position = 'relative'; el.parentNode.append(tip); this.tip = tip;
      el.addEventListener('mousemove', e => this._hover(e)); el.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
    }
    size() {
      const r = this.c.getBoundingClientRect(), d = devicePixelRatio || 1;
      if (this.c.width !== Math.round(r.width * d) || this.c.height !== Math.round(r.height * d)) { this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d); }
      this.W = r.width; this.H = r.height; this.g.setTransform(d, 0, 0, d, 0, 0);
    }
    frame(o) {
      this.o = o; this.size(); const g = this.g, m = this.m; g.clearRect(0, 0, this.W, this.H);
      if (o.y2) m.r = 56; else m.r = 16;
      this.pw = this.W - m.l - m.r; this.ph = this.H - m.t - m.b;
      const tk = (lo, hi, log) => log ? logTicks(lo, hi) : niceTicks(lo, hi, Math.max(3, Math.round((hi === o.x[1] ? this.pw : this.ph) / 70)));
      g.font = '11px ' + css('mono'); g.lineWidth = 1;
      if (o.bare) { const sx = this.pw / (o.x[1] - o.x[0]), sy = this.ph / (o.y[1] - o.y[0]), k = Math.min(sx, sy); this.pw = k * (o.x[1] - o.x[0]); this.ph = k * (o.y[1] - o.y[0]); m.l = (this.W - this.pw) / 2; g.save(); g.beginPath(); g.rect(0, 0, this.W, this.H); g.clip(); this.leg = []; return this; }
      const xt = log10t(o.x, o.logx, this.pw / 80), yt = log10t(o.y, o.logy, this.ph / 50);
      g.strokeStyle = css('grid'); g.fillStyle = css('mu'); g.textAlign = 'center'; g.textBaseline = 'top';
      for (const t of xt) { const X = this.X(t); g.beginPath(); g.moveTo(X, m.t); g.lineTo(X, m.t + this.ph); g.stroke(); g.fillText(tl(t, o.logx), X, m.t + this.ph + 5); }
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const t of yt) { const Y = this.Y(t); g.beginPath(); g.moveTo(m.l, Y); g.lineTo(m.l + this.pw, Y); g.stroke(); g.fillText(tl(t, o.logy), m.l - 6, Y); }
      if (o.y2) { g.textAlign = 'left'; for (const t of niceTicks(o.y2[0], o.y2[1], 6)) { const Y = m.t + this.ph * (1 - (t - o.y2[0]) / (o.y2[1] - o.y2[0])); g.fillText(tl(t), m.l + this.pw + 6, Y); } }
      g.strokeStyle = css('bd2'); g.strokeRect(m.l + .5, m.t + .5, this.pw, this.ph);
      g.fillStyle = css('tx'); g.font = '12px ' + css('sans'); g.textAlign = 'center'; g.textBaseline = 'bottom';
      if (o.xl) g.fillText(o.xl, m.l + this.pw / 2, this.H - 4);
      if (o.yl) { g.save(); g.translate(13, m.t + this.ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'middle'; g.fillText(o.yl, 0, 0); g.restore(); }
      if (o.y2l) { g.save(); g.translate(this.W - 10, m.t + this.ph / 2); g.rotate(Math.PI / 2); g.textBaseline = 'middle'; g.fillText(o.y2l, 0, 0); g.restore(); }
      g.save(); g.beginPath(); g.rect(m.l, m.t, this.pw, this.ph); g.clip(); this._clip = true;
      this.leg = []; this.occ = []; return this;
    }
    X(x) { const o = this.o; return this.m.l + this.pw * (o.logx ? (Math.log10(x) - Math.log10(o.x[0])) / (Math.log10(o.x[1]) - Math.log10(o.x[0])) : (x - o.x[0]) / (o.x[1] - o.x[0])); }
    Y(y, ax2) { const o = this.o, r = ax2 ? o.y2 : o.y; return this.m.t + this.ph * (1 - (o.logy && !ax2 ? (Math.log10(y) - Math.log10(r[0])) / (Math.log10(r[1]) - Math.log10(r[0])) : (y - r[0]) / (r[1] - r[0]))); }
    inv(px, py) { const o = this.o, fx = (px - this.m.l) / this.pw, fy = 1 - (py - this.m.t) / this.ph; const L = (r, f, lg) => lg ? Math.pow(10, Math.log10(r[0]) + f * (Math.log10(r[1]) - Math.log10(r[0]))) : r[0] + f * (r[1] - r[0]); return [L(o.x, fx, o.logx), L(o.y, fy, o.logy)]; }
    sty(s = {}) { const g = this.g; g.strokeStyle = g.fillStyle = css(s.c || 'c1'); g.lineWidth = s.w || 2; g.setLineDash(s.dash || []); g.globalAlpha = s.a ?? 1; }
    line(pts, s = {}) {
      const g = this.g; this.sty(s); g.beginPath(); let st = false;
      for (const [x, y] of pts) { if (!isFinite(x) || !isFinite(y)) { st = false; continue; } const X = this.X(x), Y = this.Y(y, s.ax2); st ? g.lineTo(X, Y) : g.moveTo(X, Y); st = true; this.occ && this.occ.push(X, Y); }
      if (s.fill) { g.globalAlpha = s.fa ?? .12; g.closePath(); g.fill(); g.globalAlpha = s.a ?? 1; } else g.stroke();
      g.setLineDash([]); g.globalAlpha = 1; if (s.l) this.leg.push([s.l, s.c || 'c1', s.dash, 'l']); return this;
    }
    fn(f, a, b, s = {}, n = 240) { const pts = []; for (let i = 0; i <= n; i++) { const x = s.logx ? Math.pow(10, Math.log10(a) + (Math.log10(b) - Math.log10(a)) * i / n) : a + (b - a) * i / n; pts.push([x, f(x)]); } return this.line(pts, s); }
    pts(pts, s = {}) { const g = this.g; this.sty(s); for (const [x, y] of pts) { if (!isFinite(y)) continue; g.beginPath(); this.occ && this.occ.push(this.X(x), this.Y(y, s.ax2)); g.arc(this.X(x), this.Y(y, s.ax2), s.r || 3.5, 0, 7); s.hollow ? g.stroke() : g.fill(); } if (s.l) this.leg.push([s.l, s.c || 'c1', null, 'p']); return this; }
    text(x, y, t, s = {}) { const g = this.g; g.fillStyle = css(s.c || 'tx'); g.font = (s.b ? '600 ' : '') + (s.size || 12) + 'px ' + css('sans'); g.textAlign = s.al || 'left'; g.textBaseline = s.bl || 'bottom'; const X = this.X(x) + (s.dx || 0), Y = this.Y(y) + (s.dy || 0); g.save(); g.strokeStyle = css('card'); g.lineWidth = 3.5; g.lineJoin = 'round'; g.globalAlpha = .9; g.strokeText(t, X, Y); g.restore(); g.fillText(t, X, Y); return this; }
    vl(x, s = {}) { return this.line([[x, this.o.y[0]], [x, this.o.y[1]]], { w: 1, dash: [4, 4], c: 'mu', ...s }); }
    hl(y, s = {}) { return this.line([[this.o.x[0], y], [this.o.x[1], y]], { w: 1, dash: [4, 4], c: 'mu', ...s }); }
    done(hover) {
      const g = this.g; g.restore(); this.hov = hover;
      if (this.leg.length) {
        g.font = '12px ' + css('sans'); let w = 0; for (const l of this.leg) w = Math.max(w, g.measureText(l[0]).width);
        const bw = w + 42, bh = this.leg.length * 18 + 6, L = this.m.l + 10, Rr = this.m.l + this.pw - w - 42, T = this.m.t + 8, Bt = this.m.t + this.ph - this.leg.length * 18 - 10;
        let cand = [[Rr, T], [L, T], [Rr, Bt], [L, Bt]]; if (this.o.legL != null || this.o.legB != null) cand = [[this.o.legL ? L : Rr, this.o.legB ? Bt : T]];
        const hits = ([x, y]) => { let n = 0; const o = this.occ || []; for (let i = 0; i < o.length; i += 2) if (o[i] > x - 8 && o[i] < x + bw && o[i + 1] > y - 6 && o[i + 1] < y + bh) n++; return n; };
        const [lx, ly] = cand.reduce((b, c) => hits(c) < hits(b) - 2 ? c : b);
        g.fillStyle = css('card'); g.globalAlpha = .9; g.fillRect(lx - 6, ly - 4, w + 42, this.leg.length * 18 + 6); g.globalAlpha = 1;
        this.leg.forEach((l, i) => {
          const y = ly + 8 + i * 18; this.sty({ c: l[1], dash: l[2] });
          if (l[3] === 'p') { g.beginPath(); g.arc(lx + 12, y, 3.5, 0, 7); g.fill(); } else { g.beginPath(); g.moveTo(lx, y); g.lineTo(lx + 24, y); g.stroke(); }
          g.setLineDash([]); g.fillStyle = css('tx'); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(l[0], lx + 30, y);
        });
      }
    }
    _hover(e) {
      if (!this.o) return; const r = this.c.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (px < this.m.l || px > this.m.l + this.pw || py < this.m.t || py > this.m.t + this.ph) { this.tip.style.display = 'none'; return; }
      const [x, y] = this.inv(px, py); const t = this.hov ? this.hov(x, y) : `${this.o.xs || 'x'} = ${fmt(x)}  ${this.o.ys || 'y'} = ${fmt(y)}`;
      if (!t) { this.tip.style.display = 'none'; return; }
      this.tip.innerHTML = t; this.tip.style.display = 'block';
      const left = Math.min(px + 14, r.width - this.tip.offsetWidth - 4); this.tip.style.left = left + 'px'; this.tip.style.top = Math.max(py - 30, 0) + this.c.offsetTop + 'px';
    }
  }
  function niceTicks(lo, hi, n = 6) { const sp = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(sp))), f = sp / p, st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = []; for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v); return out; }
  function logTicks(lo, hi) { const o = []; for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) { const v = Math.pow(10, e); if (v >= lo * .999 && v <= hi * 1.001) o.push(v); } return o; }
  function log10t(r, lg, n) { return lg ? logTicks(r[0], r[1]) : niceTicks(r[0], r[1], Math.max(3, Math.round(n))); }
  function tl(t, lg) { if (lg) { const e = Math.round(Math.log10(t)); return e >= -2 && e <= 3 ? String(+t.toPrecision(3)) : '10' + sup(e); } const a = Math.abs(t); return a !== 0 && (a < 1e-3 || a >= 1e5) ? t.toExponential(0) : String(+t.toPrecision(6)); }

  /* ================= 3-D kit (three.js r128) ================= */
  class View3D {
    constructor(el, o = {}) {
      this.el = el; this.ok = !!window.THREE;
      if (!this.ok) { el.append(h('div', { class: 'hint', style: 'padding:30px;text-align:center' }, '3-D view needs an internet connection the first time (three.js CDN).')); return; }
      const T = THREE; this.scene = new T.Scene(); this.cam = new T.PerspectiveCamera(o.fov || 40, 1, 0.05, 500);
      this.cam.position.set(...(o.cam || [6, 5, 8]));
      this.r = new T.WebGLRenderer({ antialias: true, alpha: true }); this.r.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.r.outputEncoding = T.sRGBEncoding; el.append(this.r.domElement);
      this.ctl = T.OrbitControls ? new T.OrbitControls(this.cam, this.r.domElement) : null;
      if (this.ctl) { this.ctl.target.set(...(o.target || [0, 1, 0])); this.ctl.enableDamping = true; this.ctl.update(); }
      this.scene.add(new T.HemisphereLight(0xffffff, 0x998877, .85)); const d = new T.DirectionalLight(0xffffff, .75); d.position.set(5, 10, 7); this.scene.add(d);
      this.root = new T.Group(); this.scene.add(this.root); this.fns = []; this.tags = [];
      el.append(h('div', { class: 'help' }, 'drag to orbit · scroll to zoom · right-drag to pan'), h('button', { class: 'btn sm lbt', title: 'Show / hide labels', onclick: () => el.classList.toggle('notags') }, 'Labels'));
      this.vis = true; this.io = new IntersectionObserver(es => this.vis = es[0].isIntersecting); this.io.observe(el);
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(el); this.resize();
      let last = performance.now();
      const loop = t => { if (this.dead) return; this.raf = requestAnimationFrame(loop); if (!this.vis) return; const dt = Math.min(.05, (t - last) / 1000); last = t; this.fns.forEach(f => f(t / 1000, dt)); this.ctl && this.ctl.update(); this.r.render(this.scene, this.cam); this._tags(); };
      this.raf = requestAnimationFrame(loop); App.onLeave(() => this.dispose());
    }
    resize() { const w = this.el.clientWidth, hh = this.el.clientHeight; if (!w) return; this.r.setSize(w, hh); this.cam.aspect = w / hh; this.cam.updateProjectionMatrix(); }
    clear() { if (!this.ok) return; this.root.traverse(o => { o.geometry && o.geometry.dispose(); }); this.scene.remove(this.root); this.root = new THREE.Group(); this.scene.add(this.root); this.fns = []; this.tags.forEach(t => t.el.remove()); this.tags = []; if (this.svg) this.svg.innerHTML = ''; }
    look(cam, target) { this.cam.position.set(...cam); if (this.ctl) { this.ctl.target.set(...target); this.ctl.update(); } }
    tick(f) { this.fns.push(f); }
    // callout labels: placed in the left/right margins with leader lines, de-collided vertically
    tag(text, pos, id) { const e = h('div', { class: 'tag', title: text }, text); this.el.append(e); const t = { el: e, p: new THREE.Vector3(...pos), id: id || text }; this.tags.push(t); return t; }
    hi(ids) { for (const t of this.tags) { const on = ids && ids.includes(t.id); t.el.classList.toggle('hi', !!on); t.el.classList.toggle('dim', !!ids && !on); t.w0 = 0; } }
    _tags() {
      const w = this.el.clientWidth, hh = this.el.clientHeight; if (!this.tags.length) { if (this.svg) this.svg.innerHTML = ''; return; }
      if (!this.svg) { this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); this.svg.setAttribute('class', 'tagl'); this.el.append(this.svg); }
      const side = [[], []];
      for (const t of this.tags) { const v = t.p.clone().project(this.cam); t.vis = !t.off && v.z < 1 && Math.abs(v.x) < 1.3 && Math.abs(v.y) < 1.3 && !(w < 560 && t.el.classList.contains('dim')); t.ax = (v.x + 1) / 2 * w; t.ay = (1 - v.y) / 2 * hh; const mw = Math.floor(w / 2 - 12); if (!t.w0) { t.el.style.maxWidth = ''; t.w0 = t.el.offsetWidth; } t.w = Math.min(t.w0, mw); t.el.style.maxWidth = mw + 'px'; if (t.vis) side[t.ax < w / 2 ? 0 : 1].push(t); else t.el.style.display = 'none'; }
      let d = '', c = '';
      side.forEach((L, si) => {
        L.sort((a, b) => a.ay - b.ay); let y = si ? 34 : 4;
        for (const t of L) { t.ly = Math.max(t.ay, y + 13); y = t.ly + 13; }
        let lim = hh - 22; for (let i = L.length - 1; i >= 0; i--) { if (L[i].ly > lim) L[i].ly = lim; lim = L[i].ly - 26; }
        for (const t of L) {
          if (t.ly < 2) { t.el.style.display = 'none'; continue; }
          const lx = si ? w - 8 - t.w : 8, ex = si ? lx : lx + t.w;
          t.el.style.display = ''; t.el.style.left = lx + 'px'; t.el.style.top = t.ly + 'px';
          if (si ? t.ax < lx - 6 : t.ax > ex + 6) d += `M${ex},${t.ly}L${(ex + t.ax) / 2},${t.ly}L${t.ax},${t.ay}`;
          else { const bx = Math.min(lx + t.w - 4, Math.max(lx + 4, t.ax)), by = t.ly + (t.ay > t.ly ? 10 : -10); if (Math.abs(t.ay - t.ly) > 10) d += `M${bx},${by}L${t.ax},${t.ay}`; } c += `<circle cx="${t.ax}" cy="${t.ay}" r="2.6"/>`;
        }
      });
      this.svg.innerHTML = `<path d="${d}"/>${c}`;
    }
    dispose() { this.dead = true; cancelAnimationFrame(this.raf); this.ro && this.ro.disconnect(); this.io && this.io.disconnect(); this.r && this.r.dispose(); }
    // geometry helpers
    mat(c, o = {}) { return new THREE.MeshStandardMaterial({ color: c, metalness: o.m ?? .25, roughness: o.r ?? .55, transparent: o.op != null, opacity: o.op ?? 1, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.op == null || o.op > .6, emissive: o.e || 0 }); }
    add(geo, mat, pos = [0, 0, 0], rot, parent) { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); if (rot) m.rotation.set(...rot); (parent || this.root).add(m); return m; }
    cyl(r, hgt, c, pos, o = {}) { return this.add(new THREE.CylinderGeometry(o.r2 ?? r, r, hgt, o.seg || 40, 1, !!o.open), this.mat(c, o), pos, o.rot, o.parent); }
    box(w, hgt, d, c, pos, o = {}) { return this.add(new THREE.BoxGeometry(w, hgt, d), this.mat(c, o), pos, o.rot, o.parent); }
    sph(r, c, pos, o = {}) { return this.add(new THREE.SphereGeometry(r, o.seg || 14, o.seg || 10), this.mat(c, o), pos, null, o.parent); }
    tor(R, r, c, pos, o = {}) { return this.add(new THREE.TorusGeometry(R, r, 10, 40), this.mat(c, o), pos, o.rot || [Math.PI / 2, 0, 0], o.parent); }
    pipe(pts, r, c, o = {}) { const cv = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.05); return this.add(new THREE.TubeGeometry(cv, 40, r, 10), this.mat(c, o), [0, 0, 0], null, o.parent); }
    // particle stream: n particles moving along f(u, i) -> [x,y,z]  (u ∈ [0,1))
    stream(n, size, c, f, speed = .3, o = {}) {
      const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), u = Float32Array.from({ length: n }, () => Math.random());
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: c, size, transparent: true, opacity: o.op ?? .9, depthWrite: false })); this.root.add(pts);
      const s = { speed, pts };
      this.tick((t, dt) => { for (let i = 0; i < n; i++) { u[i] = (u[i] + dt * s.speed * (0.7 + 0.6 * ((i * 7919) % 97) / 97)) % 1; const q = f(u[i], i); p[i * 3] = q[0]; p[i * 3 + 1] = q[1]; p[i * 3 + 2] = q[2]; } g.attributes.position.needsUpdate = true; });
      return s;
    }
  }

  /* ================= UI kit ================= */
  const UI = {
    h, fmt, sup, math, tex, toast, css, store, Plot, View3D,
    sec(el, title, lead) { el.append(h('h2', null, title)); if (lead) el.append(h('p', { class: 'hint', style: 'font-size:13.5px' }, lead)); },
    note(el, html, cls = '') { const n = h('div', { class: 'note ' + cls, html }); el.append(n); math(n); return n; },
    para(el, html) { const d = h('div', { html }); el.append(d); math(d); return d; },
    table(head, rows, numCols = []) {
      return h('div', { class: 'tw' }, h('table', { class: 't' }, h('thead', null, h('tr', null, head.map((c, i) => h('th', { class: numCols.includes(i) ? 'n' : '' , html: c })))),
        h('tbody', null, rows.map(r => h('tr', null, r.map((c, i) => h('td', { class: numCols.includes(i) ? 'n' : '', html: typeof c === 'number' ? fmt(c, 4) : String(c) })))))));
    },
    tabs(el, names, onSel, init = 0) {
      const bar = h('div', { class: 'tabs' }), body = h('div'); const panes = names.map(() => h('div', { 'data-pane': 1, style: 'display:none' }));
      const sel = i => { [...bar.children].forEach((b, j) => b.classList.toggle('on', i === j)); panes.forEach((p, j) => p.style.display = i === j ? '' : 'none'); onSel && onSel(i, panes[i]); };
      names.forEach((n, i) => bar.append(h('button', { onclick: () => sel(i) }, n))); body.append(...panes); el.append(bar, body); sel(init); return { panes, sel };
    },
    /* interactive simulator: controls on the left, live views on the right */
    sim(el, o) {
      const s = {}, ctl = h('div', { class: 'ctl' }), out = h('div', { class: 'out' }), box = h('div', { class: 'card sim' }, ctl, out);
      el.append(box); if (o.title) ctl.append(h('div', { class: 'ttl' }, o.title));
      const V = {}; let pend = false;
      const run = () => { if (pend) return; pend = true; const go = () => { if (!pend) return; pend = false; try { o.update(s, V, S); } catch (e) { console.error(e); } }; requestAnimationFrame(go); setTimeout(go, 80); };
      const S = { s, V, run, el: box, ctl, out, set: (k, v) => { s[k] = v; if (S.inputs[k]) S.inputs[k](v); run(); }, inputs: {} };
      for (const c of o.controls) ctl.append(UI.control(c, s, run, S));
      if (o.reset !== false) ctl.append(h('div', { style: 'display:flex;gap:6px;margin-top:6px' }, h('button', { class: 'btn sm', onclick: () => { for (const c of o.controls) if (c.k) S.set(c.k, c.v); } }, '↺ Reset')));
      for (const v of o.views || [{ k: 'p', t: 'plot' }]) {
        if (v.t === 'plot') { const cv = h('canvas', { class: 'plot', style: v.h ? `height:${v.h}px` : '' }), wr = h('div', { style: 'position:relative' }, cv); (v.row ? V[v.row] : out).append(wr); V[v.k] = new Plot(cv); }
        else if (v.t === '3d') { const d = h('div', { class: 'v3', style: v.h ? `height:${v.h}px` : '' }); out.append(d); V[v.k] = new View3D(d, v); }
        else if (v.t === 'ro') { const d = h('div', { class: 'ro' }); out.append(d); V[v.k] = { el: d, set: items => { d.innerHTML = ''; for (const [l, val, cls] of items) d.append(h('div', null, h('span', { html: tex(l) }), h('b', { class: cls || '' }, val))); } }; }
        else if (v.t === 'row') { const d = h('div', { class: 'grid g2' }); out.append(d); V[v.k] = d; }
        else { const d = h('div'); out.append(d); V[v.k] = d; }
      }
      new ResizeObserver(run).observe(out); run(); return S;
    },
    control(c, s, run, S) {
      if (c.t === 'sep') return h('div', { class: 'ttl', style: 'margin-top:14px;padding-top:10px;border-top:1px solid var(--bd)' }, c.label);
      if (c.t === 'html') { const d = h('div', { class: 'hint', style: 'margin:0 0 12px', html: c.html }); math(d); return d; }
      s[c.k] = c.v; const f = h('div', { class: 'f' });
      if (c.t === 'select') {
        const sel = h('select', { onchange: () => { s[c.k] = sel.value; run(); } }); for (const k in c.opts) sel.append(h('option', { value: k }, c.opts[k]));
        sel.value = c.v; S.inputs[c.k] = v => sel.value = v; f.append(h('label', null, h('span', { html: c.label })), sel);
      } else if (c.t === 'seg') {
        const sg = h('div', { class: 'seg' }); const upd = v => [...sg.children].forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
        for (const k in c.opts) sg.append(h('button', { 'data-v': k, onclick: () => { s[c.k] = isNaN(+k) ? k : +k; upd(k); run(); } }, c.opts[k]));
        upd(c.v); S.inputs[c.k] = upd; if (c.label) f.append(h('label', null, h('span', { html: c.label }))); f.append(sg);
      } else if (c.t === 'check') {
        const i = h('input', { type: 'checkbox', onchange: () => { s[c.k] = i.checked; run(); } }); i.checked = !!c.v; S.inputs[c.k] = v => i.checked = v;
        f.append(h('label', { class: 'chk' }, i, h('span', { html: c.label })));
      } else {
        const lg = c.log, toR = v => lg ? Math.log10(v) : v, frR = v => lg ? Math.pow(10, v) : v;
        const r = h('input', { type: 'range', min: toR(c.min), max: toR(c.max), step: lg ? (toR(c.max) - toR(c.min)) / 400 : c.step || (c.max - c.min) / 200 });
        const num = h('input', { class: 'v', value: '' });
        const show = v => { num.value = (c.fmt ? c.fmt(v) : +(+v).toPrecision(4)) + (c.unit ? ' ' + c.unit : ''); };
        r.value = toR(c.v); show(c.v);
        r.oninput = () => { let v = frR(+r.value); if (!lg && c.step) v = Math.round(v / c.step) * c.step; s[c.k] = +v.toPrecision(10); show(s[c.k]); run(); };
        num.onchange = () => { const v = parseFloat(num.value); if (isFinite(v)) { s[c.k] = Math.min(c.max, Math.max(c.min, v)); r.value = toR(s[c.k]); } show(s[c.k]); run(); };
        num.onfocus = () => { num.value = s[c.k]; num.select(); };
        S.inputs[c.k] = v => { r.value = toR(v); show(v); };
        f.append(h('label', null, h('span', { html: c.label }), num), r);
      }
      if (c.hint) f.append(h('div', { class: 'hint', html: c.hint }));
      if (c.label) setTimeout(() => math(f));
      return f;
    },
    eqs(el, list) { const g = h('div', { class: 'eqs' }); for (const e of list) g.append(h('div', { class: 'eq' }, h('div', { class: 'n' }, e.n), h('div', { class: 'm' }, '$$' + e.m + '$$'), e.w ? h('div', { class: 'w', html: e.w }) : null)); el.append(g); math(g); },
    fx(el, list) { const g = h('div', { class: 'fx' }); for (const [a, b] of list) g.append(h('div', { html: `<b>${a}</b> → ${b}` })); el.append(g); math(g); },
    quiz(el, qs) {
      const w = h('div', { class: 'quiz' });
      qs.forEach((q, qi) => {
        const box = h('div', { class: 'q' }, h('div', { html: `<b>Q${qi + 1}.</b> ${q.q}` }));
        q.o.forEach((o, i) => box.append(h('button', { class: 'o', html: o, onclick: e => { if (box.classList.contains('done')) return; box.classList.add('done'); e.currentTarget.classList.add(i === q.a ? 'ok' : 'no'); box.querySelectorAll('.o')[q.a].classList.add('ok'); } })));
        box.append(h('div', { class: 'ex', html: q.ex || '' })); w.append(box);
      });
      el.append(w); math(w);
    },
    // step-by-step mechanism walkthrough. steps: [{t: title, d: html}]; onStep(i, step)
    walk(el, steps, onStep, ms = 5200) {
      let i = 0, tm = null; const n = h('div', { class: 'n' }), tx = h('div', { class: 'tx' }), dots = h('div', { class: 'dots' }, steps.map(() => h('i')));
      const play = h('button', { class: 'btn sm', title: 'Auto-play' }, '\u25B6');
      const go = k => { i = (k + steps.length) % steps.length; n.textContent = i + 1; tx.innerHTML = `<b>${steps[i].t}</b>${steps[i].d}`; tx.append(dots); [...dots.children].forEach((d, j) => d.classList.toggle('on', j === i)); math(tx); onStep && onStep(i, steps[i]); };
      const stop = () => { clearInterval(tm); tm = null; play.textContent = '\u25B6'; };
      play.onclick = () => { if (tm) return stop(); play.textContent = '\u275A\u275A'; tm = setInterval(() => go(i + 1), ms); };
      const w = h('div', { class: 'walk' }, n, tx, h('div', { class: 'bt' }, h('button', { class: 'btn sm', onclick: () => { stop(); go(i - 1); } }, '\u2039'), play, h('button', { class: 'btn sm', onclick: () => { stop(); go(i + 1); } }, '\u203A')));
      el.append(w); App.onLeave(stop); go(0); return { go, get i() { return i; } };
    },
    more(el, title, open = false) { const b = h('div'), d = h('details', { class: 'more' }, h('summary', null, title), b); if (open) d.open = true; el.append(d); return b; },
    // operating-window bar: zones [[label, from, to, colorVar]], marker value, range [a,b]
    wbar(el, zones, val, [a, b]) { el.innerHTML = ''; const bar = h('div', { class: 'wbar' }); for (const [l, z0, z1, c] of zones) bar.append(h('span', { style: `width:${100 * (z1 - z0) / (b - a)}%;background:var(--${c})` }, l)); bar.append(h('i', { style: `left:calc(${Math.min(99.5, Math.max(0, 100 * (val - a) / (b - a)))}% - 1px)` })); el.append(bar); return bar; },
    plotIn(el, hgt = 340) { const cv = h('canvas', { class: 'plot', style: `height:${hgt}px` }), w = h('div', { style: 'position:relative;margin:8px 0' }, cv); el.append(w); return new Plot(cv); },
    svg(el, inner, vb = '0 0 640 360', mh = 380) { const mid = 'mk' + (UI._mk = (UI._mk || 0) + 1); inner = inner.split('id="ar"').join(`id="${mid}"`).split('url(#ar)').join(`url(#${mid})`); const d = h('div', { class: 'card pad', style: 'margin:10px 0', html: `<svg class="app" viewBox="${vb}" style="width:100%;max-height:${mh}px">${inner}</svg>` }); el.append(d); return d; },
    csv(name, head, rows) { const t = [head.join(','), ...rows.map(r => r.join(','))].join('\n'); const a = h('a', { href: URL.createObjectURL(new Blob([t], { type: 'text/csv' })), download: name + '.csv' }); a.click(); }
  };

  /* ================= Lab engine =================
     def: {id,title,aim,objectives[],theory(html),eqs[],apparatus(el,UI)|apparatusList[],procedure[],precautions[],
           bench:{controls[], cols:[{k,l,d}], run(s,rng,rows)->row|row[], preset(s)->[s1,s2..]?, view(el,s,V)?},
           calc(rows,s,el,UI)->{results:[[label,val]]}, discussion[], viva:[{q,a}]} */
  function renderLab(el, L) {
    el.append(h('h1', null, L.title), h('p', { class: 'lead', html: L.aim }));
    const tb = UI.tabs(el, ['1 · Theory', '2 · Apparatus & procedure', '3 · Experiment bench', '4 · Calculations & results', '5 · Viva voce', '6 · Report'], (i, p) => { if (i === 3) calc(); if (i === 5) report(p); });
    const [pT, pA, pB, pC, pV, pR] = tb.panes;
    // theory
    if (L.objectives) { UI.sec(pT, 'Objectives'); pT.append(h('ul', null, L.objectives.map(o => h('li', { html: o })))); }
    UI.sec(pT, 'Theory'); UI.para(pT, L.theory); if (L.eqs) { UI.sec(pT, 'Working equations'); UI.eqs(pT, L.eqs); }
    if (L.refs) { UI.sec(pT, 'Sources', 'Theory, data and correlations used in this lab.'); pT.append(h('ol', { class: 'refs' }, L.refs.map(r => h('li', { html: r })))); }
    // apparatus
    UI.sec(pA, 'Apparatus'); if (L.apparatus) L.apparatus(pA, UI);
    if (L.apparatusList) pA.append(h('ul', null, L.apparatusList.map(o => h('li', { html: o }))));
    UI.sec(pA, 'Procedure'); pA.append(h('ol', { class: 'steps' }, L.procedure.map(o => h('li', { html: o })))); math(pA);
    if (L.precautions) { UI.sec(pA, 'Precautions'); pA.append(h('ul', null, L.precautions.map(o => h('li', { html: o })))); }
    // bench
    const B = L.bench; let rows = [];
    UI.note(pB, 'Set the conditions exactly as you would on the real bench, then press <b>Record reading</b>. Every reading is computed from first-principles models. Turn on <b>instrument error</b> to get realistic scatter (like a real lab) — each student gets reproducible readings from their seed.', 'blue');
    const ctrls = B.controls.concat([{ t: 'sep', label: 'Measurement' }, { k: '_noise', t: 'check', label: 'Instrument error (realistic readings)', v: false }, { k: '_seed', label: 'Student seed / roll no.', min: 1, max: 999, step: 1, v: 7 }]);
    const tw = h('div');
    const S = UI.sim(pB, {
      title: 'Bench settings', controls: ctrls, views: B.views || [{ k: 'live', t: 'html' }, { k: 'ro', t: 'ro' }], reset: false,
      update: (s, V, S2) => { B.view && B.view(s, V, rows, S2); }
    });
    if (B.walk) UI.walk(pB, B.walk, (i, x) => { if (x.set) Object.entries(x.set).forEach(([k, v]) => S.set(k, v)); x.do && x.do(S); const v3 = Object.values(S.V || {}).find(o => o && o.hi); v3 && v3.hi(x.hi); });
    const rng = () => C.rng(S.s._seed * 9973 + rows.length * 31 + 1);
    const add = s => { const r = B.run({ ...s }, (() => { const g = rng(); return { n: (sd) => s._noise ? C.gauss(g) * sd : 0 }; })(), rows); (Array.isArray(r) ? r : [r]).forEach(x => x && rows.push(x)); draw(); S.run(); };
    const bar = h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin:8px 0' },
      h('button', { class: 'btn pri', onclick: () => add(S.s) }, '● Record reading'),
      B.preset ? h('button', { class: 'btn', onclick: () => { B.preset(S.s).forEach(p => add({ ...S.s, ...p })); toast('Standard run recorded'); } }, '▶ Run standard procedure') : null,
      h('button', { class: 'btn', onclick: () => { rows.pop(); draw(); S.run(); } }, '↶ Undo last'),
      h('button', { class: 'btn', onclick: () => { rows = []; draw(); S.run(); } }, 'Clear table'),
      h('button', { class: 'btn', onclick: () => UI.csv(L.id + '-observations', B.cols.map(c => c.l.replace(/<[^>]+>/g, '')), rows.map(r => B.cols.map(c => r[c.k]))) }, '⤓ CSV'));
    pB.append(h('h3', null, 'Observation table'), bar, tw);
    const draw = () => { tw.innerHTML = ''; tw.append(rows.length ? UI.table(['#'].concat(B.cols.map(c => c.l)), rows.map((r, i) => [i + 1].concat(B.cols.map(c => typeof r[c.k] === 'number' ? (+r[c.k].toFixed(c.d ?? 3)).toString() : r[c.k])) ), B.cols.map((_, i) => i + 1)) : h('p', { class: 'hint' }, 'No readings yet.')); math(tw); };
    draw();
    // calc
    const calc = () => { pC.innerHTML = ''; if (!rows.length) { pC.append(h('p', { class: 'hint', style: 'margin-top:16px' }, 'Record readings in the Experiment bench first.')); return; } L.calc(rows, S.s, pC, UI); math(pC); };
    // viva
    UI.sec(pV, 'Viva-voce questions', 'Try answering aloud first, then reveal the model answer.');
    for (const q of L.viva) { const a = h('div', { class: 'hint', style: 'display:none;margin-top:6px;font-size:13.5px;color:var(--tx)', html: q.a }); pV.append(h('div', { class: 'card pad', style: 'margin:0 0 8px;cursor:pointer', onclick: () => a.style.display = a.style.display ? '' : 'none' }, h('div', { html: '<b>Q.</b> ' + q.q }), a)); }
    math(pV);
    if (L.discussion) { UI.sec(pV, 'Points for results & discussion'); pV.append(h('ul', null, L.discussion.map(d => h('li', { html: d })))); math(pV); }
    const report = p => {
      p.innerHTML = ''; calc();
      p.append(h('div', { class: 'noprint', style: 'margin:16px 0;display:flex;gap:8px;align-items:center' }, h('button', { class: 'btn pri', onclick: () => { document.body.classList.add('printall'); calc(); setTimeout(() => { print(); document.body.classList.remove('printall'); }, 400); } }, '⎙ Print / save as PDF'), h('span', { class: 'hint' }, 'Prints theory, procedure, observation table, calculations, graphs and viva — a complete lab report.')));
      const n = h('div', { class: 'card pad' }); n.append(h('b', null, 'Report fields'), h('div', { class: 'grid g3', style: 'margin-top:8px' }, ...['Name', 'Roll no.', 'Date'].map(l => h('label', { class: 'hint' }, l, h('input', { style: 'width:100%;padding:6px;border:1px solid var(--bd);border-radius:6px;background:var(--bg)' }))))); p.append(n);
      const tx = h('textarea', { style: 'width:100%;min-height:120px;margin-top:10px;padding:10px;border:1px solid var(--bd);border-radius:8px;background:var(--card);font:inherit', placeholder: 'Write your conclusion here (it will be printed).' }); p.append(h('h3', null, 'Conclusion'), tx);
    };
  }
  const C = window.Chem;

  /* ================= App: registry + router ================= */
  const App = window.App = {
    courses: [], leave: [],
    onLeave(f) { this.leave.push(f); },
    course(def) { this.courses.push(def); def.topics = def.units.flatMap((u, ui) => u.topics.map((t, ti) => Object.assign(t, { unit: u, num: def.lab ? `${ti + 1}` : `${ui + 1}.${ti + 1}` }))); },
    go(hash) { location.hash = hash; },
    start() {
      document.documentElement.dataset.theme = store.get('theme', '') || ''; if (!document.documentElement.dataset.theme) delete document.documentElement.dataset.theme;
      const side = $('#side');
      const csel = $('#course'); csel.innerHTML = ''; this.courses.forEach(c => csel.append(h('option', { value: c.id }, `${c.code} · ${c.title}`)));
      csel.onchange = () => this.go('#/' + csel.value);
      $('#find').oninput = () => this.nav(); $('#menu').onclick = () => document.body.classList.toggle('nav');
      $('#theme').onclick = () => { const r = document.documentElement, dk = matchMedia('(prefers-color-scheme: dark)').matches, cur = r.dataset.theme || (dk ? 'dark' : 'light'), nx = cur === 'dark' ? 'light' : 'dark'; r.dataset.theme = nx; store.set('theme', nx); this.route(); };
      addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); $('#find').focus(); } });
      addEventListener('hashchange', () => this.route()); this.route();
    },
    cur() { const [, cid, tid] = (location.hash || '#/').split('/'); return { c: this.courses.find(c => c.id === cid), tid }; },
    nav() {
      const { c, tid } = this.cur(), nav = $('#nav'), q = $('#find').value.toLowerCase().trim(); nav.innerHTML = '';
      const list = q ? this.courses : [c || this.courses[0]];
      for (const co of list) {
        if (!q) nav.append(h('a', { href: `#/${co.id}`, class: !tid && c === co ? 'on' : '' }, '◇ Overview'));
        for (const u of co.units) {
          const ts = u.topics.filter(t => !q || (t.title + ' ' + (t.tags || '') + ' ' + u.title).toLowerCase().includes(q)); if (!ts.length) continue;
          nav.append(h('div', { class: 'u' }, (q ? co.code + ' · ' : '') + u.title));
          for (const t of ts) nav.append(h('a', { href: `#/${co.id}/${t.id}`, class: t.id === tid && c === co ? 'on' : '' }, h('small', null, t.num), t.title));
        }
        if (!q && !co.lab) { nav.append(h('div', { class: 'u' }, 'Revision')); nav.append(h('a', { href: `#/${co.id}/_formulas`, class: tid === '_formulas' ? 'on' : '' }, '∑ Formula sheet'), h('a', { href: `#/${co.id}/_quiz`, class: tid === '_quiz' ? 'on' : '' }, '✓ Self-test (all topics)')); }
      }
      const on = nav.querySelector('.on'); on && on.scrollIntoView({ block: 'nearest' });
    },
    route() {
      this.leave.forEach(f => { try { f(); } catch { } }); this.leave = []; document.body.classList.remove('nav');
      const { c, tid } = this.cur(), view = $('#view'); view.innerHTML = ''; view.scrollTop = 0;
      const w = h('div', { class: 'wrap' }); view.append(w);
      if (c) $('#course').value = c.id; this.nav();
      const t = c && c.topics.find(t => t.id === tid);
      $('#crumb').innerHTML = !c ? '<b>Home</b>' : `${c.code} <span style="opacity:.5">/</span> ` + (t ? `${t.unit.title} <span style="opacity:.5">/</span> <b>${t.title}</b>` : `<b>${tid === '_formulas' ? 'Formula sheet' : tid === '_quiz' ? 'Self-test' : 'Overview'}</b>`);
      document.title = (t ? t.title + ' · ' : '') + 'ChemE Studio';
      if (!c) return this.home(w);
      if (tid === '_formulas') return this.formulas(w, c);
      if (tid === '_quiz') return this.allquiz(w, c);
      if (!t) return this.overview(w, c);
      this.topic(w, c, t);
    },
    topic(w, c, t) {
      if (c.lab) { renderLab(w, t); }
      else {
        w.append(h('h1', null, t.title)); if (t.lead) w.append(h('p', { class: 'lead', html: t.lead }));
        try { t.render(w, UI); } catch (e) { console.error(e); w.append(h('pre', { class: 'calc' }, String(e.stack || e))); }
        if (t.fx) { UI.sec(w, 'Cause → effect', 'How changing one variable moves the system. Verify each one with the simulator above.'); UI.fx(w, t.fx); }
        if (t.eqs) { UI.sec(w, 'Key equations'); UI.eqs(w, t.eqs); }
        if (t.quiz) { UI.sec(w, 'Check yourself'); UI.quiz(w, t.quiz); }
        if (t.refs) { UI.sec(w, 'Sources', 'Correlations and data on this page come from these references.'); w.append(h('ol', { class: 'refs' }, t.refs.map(r => h('li', { html: r })))); }
      }
      math(w);
      const i = c.topics.indexOf(t), pv = c.topics[i - 1], nx = c.topics[i + 1];
      w.append(h('div', { class: 'noprint', style: 'display:flex;flex-wrap:wrap;justify-content:space-between;margin-top:40px;gap:10px' },
        pv ? h('a', { class: 'btn', href: `#/${c.id}/${pv.id}` }, '← ' + pv.title) : h('span'), nx ? h('a', { class: 'btn', href: `#/${c.id}/${nx.id}` }, nx.title + ' →') : h('span')));
    },
    home(w) {
      w.classList.add('home');
      w.append(h('div', { class: 'hero' }, h('h1', null, 'ChemE Studio'), h('p', { class: 'lead' }, 'Interactive study guide and virtual laboratory for chemical engineering. Move the sliders, watch the physics respond, and build intuition you will remember.')));
      const g = h('div', { class: 'grid g2' });
      for (const c of this.courses) g.append(h('div', { class: 'card cc', onclick: () => this.go('#/' + c.id) }, h('div', { class: 'code' }, c.code + (c.credits ? ' · ' + c.credits : '')), h('h3', null, c.title), h('p', { class: 'hint', style: 'margin:0 0 8px' }, c.sub), h('div', null, c.units.map(u => h('span', { class: 'pill' }, u.title))), h('div', { class: 'hint', style: 'margin-top:8px' }, `${c.topics.length} ${c.lab ? 'virtual experiments' : 'interactive topics'}`)));
      w.append(g);
      UI.sec(w, 'How to use');
      w.append(h('div', { class: 'grid g3' }, ...[['1 · Learn', 'Each topic opens with the idea in plain words, then a live simulator. Every number on screen is calculated from the real engineering equations.'], ['2 · Explore', 'Change one variable at a time. Read the “Cause → effect” cards and check them yourself. Hover on any chart to read values.'], ['3 · Prove it', 'Answer the check questions, use the formula sheet, then run the virtual lab and print a full lab report.']].map(([a, b]) => h('div', { class: 'card pad' }, h('b', null, a), h('p', { class: 'hint', style: 'margin:6px 0 0' }, b)))));
      w.append(h('p', { class: 'hint', style: 'margin-top:16px' }, h('span', { class: 'kbd' }, 'Ctrl K'), ' search topics  ·  ◐ toggles light / dark'));
    },
    overview(w, c) {
      w.append(h('div', { class: 'code', style: 'font:600 12px var(--mono);color:var(--ac)' }, c.code + (c.credits ? ' · ' + c.credits : '')), h('h1', null, c.title), h('p', { class: 'lead', html: c.sub }));
      if (c.intro) UI.para(w, c.intro);
      for (const u of c.units) {
        UI.sec(w, u.title, u.lead);
        const g = h('div', { class: 'grid g3' });
        for (const t of u.topics) g.append(h('a', { class: 'card cc', href: `#/${c.id}/${t.id}`, style: 'text-decoration:none;color:inherit;padding:14px' }, h('div', { class: 'code' }, t.num), h('div', { style: 'font-weight:550;margin:2px 0 4px' }, t.title), h('div', { class: 'hint', html: t.blurb || '' })));
        w.append(g);
      }
      if (c.refs) { UI.sec(w, 'References'); w.append(h('ul', null, c.refs.map(r => h('li', { html: r })))); }
    },
    formulas(w, c) {
      w.append(h('h1', null, 'Formula sheet'), h('p', { class: 'lead' }, `Every key equation in ${c.code}, grouped by unit. Print it for revision.`), h('button', { class: 'btn noprint', onclick: () => print() }, '⎙ Print'));
      for (const u of c.units) { const all = u.topics.filter(t => t.eqs); if (!all.length) continue; UI.sec(w, u.title); for (const t of all) { w.append(h('h3', null, t.title)); UI.eqs(w, t.eqs); } }
    },
    allquiz(w, c) {
      const qs = c.topics.flatMap(t => (t.quiz || []).map(q => ({ ...q, q: `<span class="pill">${t.num}</span> ${q.q}` })));
      w.append(h('h1', null, 'Self-test'), h('p', { class: 'lead' }, `${qs.length} questions across all topics. Click an option to see the explanation.`)); UI.quiz(w, qs);
    }
  };
  window.UI = UI; window.h = h;
})();
