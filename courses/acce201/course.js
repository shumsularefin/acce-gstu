/* ACCE 201 course manifest — units map 1:1 to the official curriculum. */
App.course({
  id: 'acce201', code: 'ACCE 201', title: 'Mass Transfer', credits: '3 credits',
  sub: 'Equipment for gas–liquid operations · Gas absorption · Liquid extraction · Diffusion · Adsorption · Distillation',
  intro: '<p class="hint">Assessment: 60 % exam · 20 % midterm · 10 % assignment & presentation · 10 % attendance. Each unit below follows the syllabus order. Every simulator uses the same equations you will write in the exam, with real property data.</p>',
  units: [
    { title: 'Gas–liquid equipment', lead: 'Stage efficiency, agitated vessels, tray towers, tray spacing & diameter, bubble caps, efficiencies, liquid-dispersed equipment, packed towers.', topics: T201.equipment || [] },
    { title: 'Gas absorption', lead: 'Solubility, ideal & non-ideal solutions, material balances, minimum L/G, counter-current multistage operation.', topics: T201.absorption || [] },
    { title: 'Liquid extraction', lead: 'Fields of usefulness, solvent choice, ternary diagrams, tie lines, plait point, single-stage extraction.', topics: T201.extraction || [] },
    { title: 'Diffusion', lead: 'Molecular & eddy diffusion, Fick’s law, multicomponent, liquids, Knudsen, surface, self- and solid diffusion.', topics: T201.diffusion || [] },
    { title: 'Adsorption', lead: 'Adsorbents, isotherms, heat of adsorption, surface area, batch, fixed/moving/fluidised beds, PSA.', topics: T201.adsorption || [] },
    { title: 'Distillation', lead: 'Boiling-point & equilibrium diagrams, methods, column types, heat & material balances, plate calculation, feed location, reflux, entrainment.', topics: T201.distillation || [] }
  ],
  refs: ['P. C. Wankat — <i>Separation Process Engineering</i>', 'B. K. Dutta — <i>Principles of Mass Transfer and Separation Processes</i>', 'K. M. Meera Sheriffa Begum & N. Anantharaman — <i>Mass Transfer: Theory and Practice</i>', 'W. McCabe, J. Smith, P. Harriott — <i>Unit Operations of Chemical Engineering</i>', 'R. E. Treybal — <i>Mass-Transfer Operations</i> (ternary & solubility data)', 'B. E. Poling, J. M. Prausnitz, J. P. O’Connell — <i>The Properties of Gases and Liquids</i> (Antoine, Fuller, Wilke–Chang)']
});
