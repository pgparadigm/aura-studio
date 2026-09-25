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
  // Phase 2: compact mixer, Drums group, detail row, solo, listening mute
  e('e3Group');
  e('e3Select');
  e('e2Solo', { audio: true });
  e('e4Detail', { audio: true });
  e('e4Listen', { audio: true });
  e('e4Fits@1024', { vp: V.w1024, steps: [{ fn: 'e4Fits' }] });
  e('e4Fits@1280', { vp: V.w1280, steps: [{ fn: 'e4Fits' }] });
  e('e4Fits@1440', { vp: V.w1440, steps: [{ fn: 'e4Fits' }] });
};
