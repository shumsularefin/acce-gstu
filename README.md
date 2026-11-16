# ChemE Studio

Interactive study guide and virtual lab. No install and no build step.

## Open
- Double-click `index.html`. You need internet access the first time, because three.js and KaTeX load from a CDN.
- Or serve the folder: `python -m http.server 8765` and then open http://localhost:8765

## Structure
- `app/chem.js` – the physical-property and model engine (VLE, McCabe–Thiele, Henry, Fuller, LLE, isotherms…)
- `app/core.js` – the UI kit (`UI.sim`, `Plot`, `View3D`, quizzes, the `renderLab` virtual-lab engine) and the router
- `courses/<id>/*.js` – the course content. One file per unit plus a `course.js` manifest.

## Add a new course
1. Create `courses/<newid>/` with one file per unit. Each file exports an array of topics: `{ id, title, tags, lead, render(el, UI), fx, eqs, quiz }`.
2. Add a manifest: `App.course({ id, code, title, credits, sub, intro, units: [{ title, lead, topics }], refs })`.
   For a lab course, add `lab: true`. Each topic then follows the lab format described at the top of `renderLab` in `app/core.js` (see `courses/acce202/labs.js`).
3. Add the `<script>` tags to `index.html` after `app/core.js`.
