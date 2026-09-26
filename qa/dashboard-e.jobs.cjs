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
  // Phase 3: meters and the Master's loudness
  e('e2Sine', { audio: true });
  e('e2HardLeft', { audio: true });
  e('e2Square', { audio: true });
  e('e2Silence', { audio: true });
  e('e2Scale', { audio: true });
  e('e2Ebu', { audio: true });
  e('e2TruePeak', { audio: true });
  e('e2MasterMatchesExport', { audio: true });
  e('e2Limiting', { audio: true });
  e('e2Hold', { audio: true });
  e('e2MasterDisplay', { audio: true });
  e('e2MasterAsExported', { audio: true });
  e('e2EngineRepeats');
  e('e2ExportGraph', { base: true });
  // The rendered audio against the engine's own run-to-run variation (needs --base-root).
  e('e2ExportJitter');
  // Phase 4: Check my mix on the measured audio
  e('e6Measured');
  e('e6Show');
  e('e6Demo');
  e('e6Novice');
  e('e6Guided');
  e('e6Windows');
  e('e6PanelFollows');
  // Phase 5: every control's real value and unit
  e('e5Units', { audio: true });
  e('e5Balance');
  // The export's take placement against the live context's settled output latency
  e('e7ExportLatency', { audio: true });
  e('e7ExportLatencyHeld', { audio: true });
};
