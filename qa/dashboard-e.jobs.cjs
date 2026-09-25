// Runner jobs for sub-project E (qa/dashboard-e.qa.js). Loaded by qa/run.cjs when present.
// `base: true` runs the check on the f304607 build too (served from --base-root) and passes only when
// both runs pass AND their `key` is identical: the way "unchanged" is proven rather than assumed.
module.exports = (job, V) => {
  const e = (id, o) => job('e', id, o);
  // Phase 1: levels in dB and the control
  e('e1DbLabels', { audio: true });
  e('e1Law');
  e('e1TypeIn');
  e('e1Reset');
  e('e1Fine');
  e('e1Wheel');
  e('e1Saved', { base: true });
  e('e1Undo', { audio: true });
};
