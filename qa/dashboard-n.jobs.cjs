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
  // rc.19: the Studio header's Key (desktop: the phone's top bar has no key readout)
  const W2 = W3.slice(0, 2);
  W2.forEach(([w, vp]) => {
    n('n3KeyFirstVisit@' + w, { vp, firstRun: true, steps: [{ fn: 'n3KeyFirstVisit' }] });
    n('n3KeyFresh@' + w, { vp, steps: [{ fn: 'n3KeyFresh' }] });
    n('n3KeyRestored(saved demo, reload)@' + w, { vp, steps: [{ fn: 'n2DemoSaved', setup: true }, { reload: true }, { fn: 'n3KeyRestored' }] });
    n('n3KeyAfterVibe@' + w, { vp, steps: [{ fn: 'n3KeyAfterVibe' }] });
    n('n3KeyAfterSelect@' + w, { vp, steps: [{ fn: 'n3KeyAfterSelect' }] }); });
  n('n3KeyOnePlace');
  // S3 (13.8.0-rc.19). 1920x1113 is where Philip saw the roll's empty space and Ask Aura's overlap (2026-10-31).
  const W1920 = ['1920', [1920, 1113]];
  [W1920, ...W3].forEach(([w, vp]) => n('n3RollFills@' + w, { vp, steps: [{ fn: 'n3RollFills' }] }));
  [W1920, ...W3, ['1024', V.w1024], ['768', [768, 1024]]].forEach(([w, vp]) => n('n3NoOverflow@' + w, { vp, steps: [{ fn: 'n3NoOverflow' }] }));
  [['1280', V.w1280], ['1024', V.w1024], ['768', [768, 1024]], ['390', [390, 844]]].forEach(([w, vp]) => n('n3AskClearBelow1400@' + w, { vp, steps: [{ fn: 'n3AskClearBelow1400' }] }));
  // S4 (13.8.0-rc.20)
  [W1920, ...W3].forEach(([w, vp]) => n('n4ControlsNamed@' + w, { vp, steps: [{ fn: 'n4ControlsNamed' }] }));
  W3.forEach(([w, vp]) => n('n4FocusRings@' + w, { vp, steps: [{ focusWalk: 220 }, { fn: 'n4FocusRings' }] }));
  [W1920, ...W3].forEach(([w, vp]) => n('n4Contrast@' + w, { vp, steps: [{ fn: 'n4Contrast' }] }));
  // S5 (13.9.0-rc.1)
  W3.slice(0, 2).forEach(([w, vp]) => n('n5Palette@' + w, { vp, steps: [{ fn: 'n5Palette' }] }));
  [W1920, ...W3].forEach(([w, vp]) => n('n5Type@' + w, { vp, steps: [{ fn: 'n5Type' }] }));
  n('n5NoWebfont');
  W3.slice(0, 2).forEach(([w, vp]) => n('n5OneNamePerTrack@' + w, { vp, steps: [{ fn: 'n5OneNamePerTrack' }] }));
  // S6 (13.9.0-rc.2): the right panel, a column from 1400 px and a drawer below it (opened by its rail button). Not at 390:
  // the phone shows no right panel (#dashRail is hidden there) until S16's Sounds / Arrange / Mix / Aura tabs, so a check
  // there would only click controls nobody can see.
  const PANEL = [W1920, ['1512', [1512, 982]], W3[0], W3[1]];
  PANEL.forEach(([w, vp]) => n('n6PrevNext@' + w, { vp, steps: [{ fn: 'n6PrevNext' }] }));
  [W3[0], W3[1]].forEach(([w, vp]) => n('n6PickKeepsEdit@' + w, { vp, steps: [{ fn: 'n6PickKeepsEdit' }] }));
  PANEL.forEach(([w, vp]) => n('n6SectionCard@' + w, { vp, steps: [{ fn: 'n6SectionCard' }] }));
  n('n6SongToneKept');
  // Task 3: Warmth per section. Audio and files do not depend on the width, so one width.
  ['n6WarmthPerSection', 'n6WarmthSaved', 'n6OldFileWarmth'].forEach(f => n(f));
  PANEL.forEach(([w, vp]) => n('n6TrackCard@' + w, { vp, steps: [{ fn: 'n6TrackCard' }] }));
  // Task 5: what Apply and Preview do does not depend on the width.
  ['n6ApplyWholeSong', 'n6PreviewNoCommit'].forEach(f => n(f));
  PANEL.forEach(([w, vp]) => n('n6AskInCard@' + w, { vp, steps: [{ fn: 'n6AskInCard' }] }));
  // Task 7: the column widths Philip named for the panel (2026-10-31): 1440x900, 1512x982, 1920x1113.
  [W1920, ['1512', [1512, 982]], W3[0]].forEach(([w, vp]) => n('n6Fits@' + w, { vp, steps: [{ fn: 'n6Fits' }] }));
  PANEL.forEach(([w, vp]) => n('n6SettingsOpen@' + w, { vp, steps: [{ fn: 'n6SettingsOpen' }] }));
  // Open items (Philip, 2026-11-03): Preserve does something real. What the lock does is not about the width.
  n('n6MelodyLock');
  PANEL.forEach(([w, vp]) => n('n6VoiceBadge@' + w, { vp, steps: [{ fn: 'n6VoiceBadge' }] }));
};
