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
  // S1 (13.8.0-rc.17), one check at a time
  each('n1MenuOpensWelcome');
  each('n1FirstRunNoDialog', { firstRun: true });
  each('n1FirstRunDemo', { firstRun: true });
  each('n1TourSteps', { firstRun: true });
  W3.forEach(([w, vp]) => n('n1TourDismiss+reload+n1TourGone@' + w, { vp, firstRun: true, steps: [{ fn: 'n1TourDismiss' }, { reload: true }, { fn: 'n1TourGone' }] }));
  each('n1TourEsc', { firstRun: true });
  each('n1ToolbarClickable', { firstRun: true });
  W3.forEach(([w, vp]) => n('n1Mark+reload+n1SameProject@' + w, { vp, steps: [{ fn: 'n1Mark', setup: true }, { reload: true }, { fn: 'n1SameProject' }] }));
  each('n1WelcomeEscAnywhere', { firstRun: true });
  each('n1WelcomeBackdrop', { firstRun: true });
  each('n1CreateHasX');
  each('n1CreateTabHeld');
  each('n1CreateEscAnywhere');
  each('n1CreateFocusBack');
  // S2 (13.8.0-rc.18)
  each('n2UndoZeroFresh');
  each('n2UndoZeroFirstRun', { firstRun: true });
  W3.forEach(([w, vp]) => n('n2DemoSaved+reload+n2UndoZeroRestored@' + w, { vp, steps: [{ fn: 'n2DemoSaved', setup: true }, { reload: true }, { fn: 'n2UndoZeroRestored' }] }));
  each('n2OneToggleOneStep');
  each('n2RedoY');
  each('n2ButtonsDisabledWhenEmpty');
};
