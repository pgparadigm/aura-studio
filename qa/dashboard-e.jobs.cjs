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
  // The jitter rule itself, against recorded measurements (no browser audio involved)
  e('e2JitterRule');
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
  // Two named-not-fixed items, fixed on Philip's word: the undefined --electric-violet, the header Vol readout
  e('e8Violet');
  e('e8HeaderVol@375', { vp: V.phone, steps: [{ fn: 'e8HeaderVol', args: ['header'] }] });
  e('e8HeaderVol@1024', { vp: V.w1024, steps: [{ fn: 'e8HeaderVol', args: ['more'] }] });
  e('e8HeaderVol@1280', { vp: V.w1280, steps: [{ fn: 'e8HeaderVol', args: ['more'] }] });
  e('e8HeaderVol@1440', { vp: V.w1440, steps: [{ fn: 'e8HeaderVol', args: ['more'] }] });
  e('e8HeaderVol@1920', { vp: [1920, 1080], steps: [{ fn: 'e8HeaderVol', args: ['header'] }] });
  // The header at 1024: reachable, and nothing else moves (against 16f0cbb, the build just before the fix)
  for (const [n, vp] of [['1024', V.w1024], ['1280', V.w1280], ['1440', V.w1440], ['1920', [1920, 1080]]]) e('e9HeaderReach@' + n, { vp, steps: [{ fn: 'e9HeaderReach' }] });
  // Nothing else moves against the published rc.10 (9a9f19d); see e9HeaderSame for what each width holds.
  for (const [n, vp] of [['375', V.phone], ['768', [768, 800]], ['900', [900, 800]], ['1024', V.w1024], ['1280', V.w1280], ['1440', V.w1440], ['1920', [1920, 1080]]]) e('e9HeaderSame@' + n, { vp, base: '9a9f19d', steps: [{ fn: 'e9HeaderSame' }] });
  // rc.10: room to spare from 768 up to 1280
  for (const w of [768, 800, 900, 1000, 1024, 1100, 1180, 1279]) e('e10HeaderRoom@' + w, { vp: [w, 800], steps: [{ fn: 'e10HeaderRoom' }] });
  for (const w of [1180, 1279]) e('e10HeaderRenamed@' + w, { vp: [w, 800], steps: [{ fn: 'e10HeaderRenamed' }] });
  { const steps = [{ fn: 'e10SweepStart' }]; for (let w = 1279; w >= 768; w -= 4) steps.push({ resize: [w, 800] }, { fn: 'e10SweepPoint' });
    steps.push({ resize: [768, 800] }, { fn: 'e10SweepPoint' }, { fn: 'e10SweepEnd' }); e('e10HeaderSweep', { vp: [1279, 800], steps }); }
  // rc.11: the play mode's two controls agree, and one shows at a time
  e('e11LoopSync');
  // rc.12: the singer's vocals, kept
  e('e12Tracks', { audio: true });
  for (const [n, vp] of [['1024', V.w1024], ['1280', V.w1280], ['1440', V.w1440]]) e('e12MixerFits@' + n, { vp, steps: [{ fn: 'e12MixerFits' }] });
  e('e12Persist', { audio: true, steps: [{ fn: 'e12PersistSetup', setup: true }, { reload: true }, { fn: 'e12PersistCheck' }] });
  e('e12AuraFile', { audio: true });
  e('e12StorageNotice', { audio: true });
  e('e12Recents', { audio: true });
  e('e12RecentsResave', { audio: true });
  e('e12RecentsRemove', { audio: true });
  e('e12RecentsLabel', { audio: true });
  e('e12FiledClockBack', { audio: true });
  e('e12FileDamagedClips', { audio: true });
  e('e12SavedAtStop', { audio: true });
  e('e12SaveFailNotice', { audio: true });
  e('e12StopThenSwitch', { audio: true });
  e('e12NoStaleClaims');
  e('e12ShareOwn', { audio: true, steps: [{ fn: 'e12ShareOwnSetup', setup: true }, { reload: true }, { fn: 'e12ShareOwnCheck' }] });
  e('e12ShareForeign', { audio: true, steps: [{ fn: 'e12ForeignSetup', setup: true }, { goto: true }, { fn: 'e12ForeignOpened', setup: true },
    { reload: true }, { fn: 'e12ForeignReloadedEmpty', setup: true }, { reload: true }, { fn: 'e12ForeignReloadedTake' }] });
  e('e12Stems', { audio: true });
  e('e12VoiceAllTracks', { audio: true });
  for (const [n, vp] of [['1024', V.w1024], ['1440', V.w1440]]) {
    e('e12Lanes@' + n, { vp, audio: true, steps: [{ fn: 'e12Lanes' }] });
    e('e12LaneClipEdit@' + n, { vp, audio: true, steps: [{ fn: 'e12LaneClipEdit' }] });
  }
  e('e12RealRecord', { audio: true, mic: true });
  e('e12NoticeWhere@studio1440', { vp: V.w1440, audio: true, steps: [{ fn: 'e12NoticeWhere', args: ['studio', 'panel'] }] });
  e('e12NoticeWhere@studio1280', { vp: V.w1280, audio: true, steps: [{ fn: 'e12NoticeWhere', args: ['studio', 'panel'] }] });
  e('e12NoticeWhere@studio1024', { vp: V.w1024, audio: true, steps: [{ fn: 'e12NoticeWhere', args: ['studio', 'drawer'] }] });
  e('e12NoticeWhere@studio768', { vp: [768, 1024], audio: true, steps: [{ fn: 'e12NoticeWhere', args: ['studio', 'drawer'] }] });
  e('e12NoticeWhere@studio375', { vp: V.phone, audio: true, steps: [{ fn: 'e12NoticeWhere', args: ['studio', 'room'] }] });
  e('e12NoticeWhere@guided1280', { vp: V.w1280, audio: true, steps: [{ fn: 'e12NoticeWhere', args: ['guided', 'room'] }] });
  e('e12NoticeWhere@guided375', { vp: V.phone, audio: true, steps: [{ fn: 'e12NoticeWhere', args: ['guided', 'room'] }] });
  for (const w of [768, 900, 1024, 1280, 1440, 1920]) e('e11OneModeControl@' + w, { vp: [w, 800], steps: [{ fn: 'e11OneModeControl' }] });
};
