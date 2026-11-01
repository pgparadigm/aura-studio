// Runner jobs for the north-star stages (qa/dashboard-n.qa.js). Loaded by qa/run.cjs when present.
// `firstRun: true` starts with empty storage (a first visit); every other job is a returning visitor.
module.exports = (job, V) => {
  const n = (id, o) => job('n', id, o);
  // The three widths every new check runs at (docs/superpowers/plans/2026-10-25-aura-north-star.md, global constraints).
  const W3 = [['1440', V.w1440], ['1280', V.w1280], ['390', [390, 844]]];
  const each = (fn, o) => W3.forEach(([w, vp]) => n(fn + '@' + w, Object.assign({ vp, steps: [{ fn }] }, o || {})));
  // S1 infrastructure
  n('n0DefaultIsReturning');
  // found while building S1: the arrangement drawn at load and after a vibe equals a forced redraw (desktop: the phone has no arrangement)
  for (const [w, vp] of W3.slice(0, 2)) { n('n1ArrangementAtLoad@' + w, { vp, steps: [{ fn: 'n1ArrangementAtLoad' }] }); n('n1ArrangementAfterVibe@' + w, { vp, steps: [{ fn: 'n1ArrangementAfterVibe' }] }); }
};
