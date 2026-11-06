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
  n('n6SchemaValid');
  // The phone's core path without the right panel (Philip, 2026-11-03): import, rebuild Apply, play, export at 390.
  n('n6PhoneCorePath@390', { vp: [390, 844], audio: true, steps: [{ fn: 'n6PhoneCorePath' }] });
  // An export never cuts audio (Philip, 2026-11-03): a take past the last bar, an imported song longer than the arrangement.
  ['n6ExportTakeWhole', 'n6ExportImportWhole'].forEach(f => n(f, { audio: true }));
  // No control does nothing (Philip, 2026-11-03): every visible Studio control pressed once, at 1440.
  n('n6NoDeadControls', { audio: true });
  n('n6ClearMelodyEmpty');
  n('n6LyricSection');
  n('n6PerformSaysWhy');
  // The core path at the desk (Philip, 2026-11-03): your song in, matched, included, a voice on it, one file out.
  n('n6DeskCorePath', { audio: true });
  // Your song, as it is (Philip, 2026-11-03).
  n('n6ImportAsItIs', { audio: true });
  n('n6RemixKeepsBass');
  // S7 (13.9.0-rc.5): the top bar, where it is one row (1120 px and wider).
  const BAR = [W1920, ['1512', [1512, 982]], W3[0], W3[1]];
  BAR.forEach(([w, vp]) => n('n7Row@' + w, { vp, steps: [{ fn: 'n7Row' }] }));
  ['n7Stop', 'n7Tempo', 'n7Key', 'n7MeterPosition', 'n7Loop'].forEach(f => n(f, { audio: true }));
  n('n7Export', { audio: true });
  n('n7PerformSectionLoop');
  n('n6MelodyIdeasApply', { audio: true });
  n('n6NoDuplicateFunctions');
  // S8 (13.9.0-rc.6): the Sounds panel.
  n('n8PreviewPlays', { audio: true });
  n('n8CardApplies');
  [W1920, ['1512', [1512, 982]], W3[0]].forEach(([w, vp]) => n('n8Cards@' + w, { vp, steps: [{ fn: 'n8Cards' }] }));
  [W1920, ['1512', [1512, 982]], W3[0]].forEach(([w, vp]) => n('n8Chips@' + w, { vp, steps: [{ fn: 'n8Chips' }] }));
  n('n8Search');
  n('n8Intention');
  for (const w of [1280, 1200, 1399]) n('n8IconRail@' + w, { vp: [w, 800], steps: [{ fn: 'n8IconRail' }] });
  n('n8CollapseSet+reload+n8CollapseKept', { steps: [{ fn: 'n8CollapseSet', setup: true }, { reload: true }, { fn: 'n8CollapseKept' }] });
  [W1920, W3[0]].forEach(([w, vp]) => n('n8Foot@' + w, { vp, steps: [{ fn: 'n8Foot' }] }));
  [W1920, W3[0]].forEach(([w, vp]) => n('n8Spacing@' + w, { vp, steps: [{ fn: 'n8Spacing' }] }));
  // S9 (13.9.0-rc.7): the arrangement's ruler and view.
  [W1920, W3[0]].forEach(([w, vp]) => n('n9RowHeight@' + w, { vp, steps: [{ fn: 'n9RowHeight' }] }));
  [W1920, W3[0]].forEach(([w, vp]) => n('n9Ruler@' + w, { vp, steps: [{ fn: 'n9Ruler' }] }));
  n('n9ZoomFit');
  n('n9PlayheadFollows', { audio: true });
  n('n9SnapSet+reload+n9SnapKept', { steps: [{ fn: 'n9SnapSet', setup: true }, { reload: true }, { fn: 'n9SnapKept' }] });
  // S10 (13.9.0-rc.8): lanes and clips.
  n('n10LaneHead');
  n('n10VoiceGroupSet+reload+n10VoiceGroupKept', { steps: [{ fn: 'n10VoiceGroupSet', setup: true }, { reload: true }, { fn: 'n10VoiceGroupKept' }] });
  n('n10NotePreview');
  n('n10Waveform');
  n('n10SelectedGlow');
  n('n10CtrlDragCopy');
  // S11 (13.9.0-rc.9): energy and sections.
  [W1920, W3[0]].forEach(([w, vp]) => n('n11Scale@' + w, { vp, steps: [{ fn: 'n11Scale' }] }));
  n('n11DragPoint');
  n('n11SectionDrag');
  n('n11SectionResize');
  n('n11SectionLook');
  n('n12Tabs');
  n('n12StripParts');
  [W1920, W3[0]].forEach(([w, vp]) => n('n12EqualWidth@' + w, { vp, steps: [{ fn: 'n12EqualWidth' }] }));
  n('n12SelectedStrip');
  n('n12StereoMeters');
  n('n13IdleNoPaint');
  n('n13PlayingPaints');
  n('n13OneLoop');
  [W3[0], W3[1]].forEach(([w, vp]) => n('n14GuidedSameScreen@' + w, { vp, steps: [{ fn: 'n14GuidedSameScreen' }] }));
  n('n14GuidedInactive');
  n('n14ToggleSet+reload+n14ToggleKept', { steps: [{ fn: 'n14ToggleSet', setup: true }, { reload: true }, { fn: 'n14ToggleKept' }] });
  // S16 (13.9.0-rc.14): 480 px and narrower is the phone dashboard in both modes; the classic Guided screen remains from 481
  // to 767 px, so this check now runs at 600.
  n('n14PhoneSet+reload+n14PhoneSeen@600', { vp: [600, 900], steps: [{ fn: 'n14PhoneSet', setup: true }, { reload: true }, { fn: 'n14PhoneSeen' }] });
  W3.forEach(([w, vp]) => n('n15OneFirstAction@' + w, { vp, firstRun: true, steps: [{ fn: 'n15OneFirstAction' }] }));
  n('n15QuietUntilPlaying', { firstRun: true });
  n('n15Tooltips');
  n('n15DropPreset');
  n('n15SliderOneStep');
  n('n15ApplyInExport');
  const PH = [['390', [390, 844]], ['360', [360, 780]]];
  PH.forEach(([w, vp]) => n('n16Tabs@' + w, { vp, steps: [{ fn: 'n16Tabs' }] }));
  n('n16StickyTracks@390', { vp: [390, 844], steps: [{ fn: 'n16StickyTracks' }] });
  n('n16TransportFixed@390', { vp: [390, 844], steps: [{ fn: 'n16TransportFixed' }] });
  PH.forEach(([w, vp]) => n('n16NoOverflow@' + w, { vp, steps: [{ fn: 'n16NoOverflow' }] }));
  n('n7NameLinkSetup+link+n7NameLinkOpened+back+n7NameLinkLeft', { steps: [{ fn: 'n7NameLinkSetup', setup: true }, { goto: true }, { fn: 'n7NameLinkOpened', setup: true }, { goto: true }, { fn: 'n7NameLinkLeft' }] });
  n('n7NameSet+reload+n7NameKept', { steps: [{ fn: 'n7NameSet', setup: true }, { reload: true }, { fn: 'n7NameKept' }] });
  [W3[0], W3[1]].forEach(([w, vp]) => n('n6YourSongTab@' + w, { vp, steps: [{ fn: 'n6YourSongTab' }] }));
  [W3[0], W3[1]].forEach(([w, vp]) => n('n6StartWithVibe@' + w, { vp, steps: [{ fn: 'n6StartWithVibe' }] }));
  PANEL.forEach(([w, vp]) => n('n6VoiceBadge@' + w, { vp, steps: [{ fn: 'n6VoiceBadge' }] }));
  // rc.15 core path (docs/superpowers/plans/2026-11-05-core-path-rc15.md), one check at a time
  n('cp1MyBeatIsTheSong');
  [['1440', V.w1440], ['390', [390, 844]]].forEach(([w, vp]) => n('cp2MyBeatWays@' + w, { vp, steps: [{ fn: 'cp2MyBeatWays' }] }));
  n('cp3MyBeatTempo');
  n('cp4WholeBeat');
  n('cp5StartPoint', { audio: true });
  n('cp6PlayHearsTakes', { audio: true });
  n('cp7HearWhileRecording', { audio: true });
  n('cp8PunchIn', { audio: true });
  [['1440', V.w1440], ['390', [390, 844]]].forEach(([w, vp]) => n('cp9ImportTake@' + w, { vp, steps: [{ fn: 'cp9ImportTake' }] }));
  [['1440', V.w1440], ['390', [390, 844]]].forEach(([w, vp]) => n('cp10BeatBackSetup+reload+cp10BeatBack@' + w, { vp, steps: [{ fn: 'cp10BeatBackSetup', setup: true }, { reload: true }, { fn: 'cp10BeatBack' }] }));
  n('cp11LoudBeatNoClip');
  n('cp12UndoAfterOtherTake');
  n('cp13PunchNoClick');
  [['1440', V.w1440], ['390', [390, 844]]].forEach(([w, vp]) => n('cpWalk@' + w, { vp, audio: true, steps: [{ fn: 'cpWalk' }] }));
  // rc.16 — the core loop, polished
  [['1440', V.w1440], ['1024', V.w1024], ['768', [768, 1024]], ['390', [390, 844]]].forEach(([w, vp]) => n('cl1ReleaseId@' + w, { vp, steps: [{ fn: 'cl1ReleaseId' }] }));
  n('cl2TempoTypedSetup+reload+cl2TempoTypedCheck', { steps: [{ fn: 'cl2TempoTypedSetup', setup: true }, { reload: true }, { fn: 'cl2TempoTypedCheck' }] });
  n('cl3TempoFromName');
  n('cl4TempoSuggest');
  [['1440', V.w1440], ['1280', V.w1280], ['390', [390, 844]]].forEach(([w, vp]) => n('cl5AskWraps@' + w, { vp, steps: [{ fn: 'cl5AskWraps' }] }));
  [['1440', V.w1440], ['1280', V.w1280]].forEach(([w, vp]) => n('cl6SongTools@' + w, { vp, steps: [{ fn: 'cl6SongTools' }] }));
  [['1440', V.w1440], ['1024', V.w1024], ['390', [390, 844]]].forEach(([w, vp]) => n('cl7ClipLabels@' + w, { vp, steps: [{ fn: 'cl7ClipLabels' }] }));
  n('cl8BassEditor');
  n('cl8bRollFollowsPick');
  n('cl8cClipBarEditsBass');
  n('cl9WavFormats');
  n('cl9Aac');
  n('cl9Mp3');
  n('cl9FormatLimits');
  n('cl9Mp3Responsive');
  [['390', [390, 844]], ['360', [360, 740]]].forEach(([w, vp]) => n('cl10PhoneNoOverlay@' + w, { vp, steps: [{ fn: 'cl10PhoneNoOverlay' }] }));
  n('cl11PhoneMix@390', { vp: [390, 844], steps: [{ fn: 'cl11PhoneMix' }] });
  [['390', [390, 844]], ['360', [360, 740]]].forEach(([w, vp]) => n('cl12PhoneSteps@' + w, { vp, steps: [{ fn: 'cl12PhoneSteps' }] }));
  n('cl13MicRaw');
  n('cl13MicRawApplied', { audio: true, mic: true });
  [['1440', V.w1440], ['390', [390, 844]]].forEach(([w, vp]) => n('clWalk@' + w, { vp, steps: [{ fn: 'clWalk' }] }));
};
