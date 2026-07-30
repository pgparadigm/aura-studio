/* Aura Studio — the import/rebuild QA fixture set.
   Library only. Loaded by fixtures/import-qa.html together with fixtures/qa-audio.js.

   WHY THESE FIXTURES
   The v13.2 foundation was measured against ONE synthetic file (96 BPM, A minor, kick 0+8,
   snare 4+12, closed hat on even steps) and scored 4/8 recall with the snare landing on the
   right steps in the wrong lane. Tuning further against that single signal would have improved
   the score without improving the product. So this set deliberately spreads the classifier
   across material that fails in DIFFERENT ways:

     - lanes that are genuinely separable (dry electronic kit)     -> must be got right
     - lanes that are genuinely ambiguous (rimshot, conga, shaker) -> must FALL BACK, not guess
     - kicks whose harmonics reach the mid band (driven 808)       -> must not read as a snare
     - percussion under sustained harmonic material                -> must not fire on the pad
     - the same pattern soft and loud                              -> must score the same
     - subdivisions finer than Aura's 16-step bar (trap rolls)     -> must report low confidence
     - a tempo that is honestly two answers (half/double time)     -> either is acceptable
     - no percussion at all                                        -> must invent nothing

   Patterns are taken from Aura's own BEATS table (app.js:881-899) wherever one applies, so the
   ground truth is expressed in the same vocabulary the app writes back into the grid.

   Every fixture is generated. No commercial recording is used or approximated. */
(function (root) {
  'use strict';

  // Aura's own patterns, copied verbatim from app.js:881-899 so fixture truth and app output
  // speak the same language. If BEATS ever changes, these become stale on purpose — a fixture
  // must not silently follow a musical-data edit.
  const B = {
    pop:      { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    dembow:   { kick: [0, 4, 8, 12], snare: [3, 6, 11, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14], shaker: [2, 6, 10, 14] },
    boombap:  { kick: [0, 6, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
    trap:     { kick: [0, 7, 10], snare: [4, 12], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    silk:     { kick: [0, 10], snare: [4, 12], hat: [2, 6, 10, 14], shaker: [0, 4, 8, 12] },
    halftime: { kick: [0, 6, 10], snare: [8], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    sparse808:{ kick: [0, 8], clap: [4, 12], openhat: [7, 15] },
  };
  const clone = o => JSON.parse(JSON.stringify(o));

  // `expect` declares what a HONEST engine must produce, per lane:
  //   'exact'    — this lane must be found on these steps (it is separable from a mix)
  //   'family'   — must land in the snare/clap family, either lane is correct
  //   'fallback' — must NOT be given a confident specific lane; Percussion or Uncertain
  //                Percussion is the right answer, and a confident wrong lane is the failure
  //   'ignore'   — not scored for lane (still scored for timing)
  const F = [
    // ---------- 1-5: the dry electronic kit, lane by lane ----------
    {
      id: 'elec-pop', seed: 101, bpm: 96, bars: 8,
      desc: 'Dry electronic kit, Aura BEATS.pop. Kick 0+8, snare 4+12, closed hat on the even 16ths.',
      lanes: clone(B.pop),
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      note: 'The v13.2 baseline signal, extended to 8 bars. Everything here is separable, so this is the fixture that must not regress.',
    },
    {
      id: 'elec-clap', seed: 102, bpm: 100, bars: 8,
      desc: 'Same kit but the backbeat is a CLAP: three band-limited bursts ~12 ms apart, no 185 Hz shell body.',
      lanes: clone(B.pop), voice: { snare: 'clap' },
      expect: { kick: 'exact', snare: 'family', hat: 'exact' },
      note: 'Snare and clap share a lane group in Aura (GROUPS snare +Clap), so either is correct — but it must not become a hat or a kick.',
    },
    {
      id: 'elec-openhat', seed: 103, bpm: 104, bars: 8,
      desc: 'Closed hats on the even 16ths with an OPEN hat on step 14 — same noise band, six times the tail.',
      lanes: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12], openhat: [14] },
      expect: { kick: 'exact', snare: 'exact', hat: 'exact', openhat: 'exact' },
      note: 'Closed vs open is a decay measurement, not a spectral one. The only honest separator is the top-band tail length.',
    },
    {
      id: 'acoustic-kit', seed: 104, bpm: 92, bars: 8,
      desc: 'Acoustic-style kit: two tuned shell modes (188/332 Hz) on the snare, wider noise band, slower decay.',
      lanes: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
      voice: { snare: 'snareAcoustic' },
      params: { kick: { f0: 120, f1: 52, decay: 0.42, pitchDecay: 0.16, click: 0.22 } },
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      note: 'An acoustic snare has far more 180-450 Hz body than an electronic one. A body-percentile gate reads it fine; an absolute one must too.',
    },
    {
      id: 'k808-driven', seed: 105, bpm: 140, bars: 8,
      desc: 'Saturated 808 kick — tanh drive pushes harmonics into the 450-2000 Hz mid band. Sparse trap placement.',
      lanes: { kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
      params: { kick: { drive: 0.9, f0: 90, f1: 42, decay: 0.5, pitchDecay: 0.05, click: 0 } },
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      note: 'THE case a mid-energy classifier gets wrong: a driven 808 has real mid content but is still a kick. Sub dominance has to outrank mid.',
    },

    // ---------- 6-8: honestly ambiguous voices — fallback is the correct answer ----------
    {
      id: 'rimshot', seed: 106, bpm: 88, bars: 8,
      desc: 'Rimshot on the backbeat: woody 420/780 Hz tone, ~75 ms, almost no sustain, tight noise tick.',
      lanes: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
      voice: { snare: 'rimshot' },
      expect: { kick: 'exact', snare: 'fallback', hat: 'exact' },
      note: 'A rimshot is not a snare and not a hat. Placing it in Percussion / Uncertain Percussion is the right answer; a confident "Snare" is a mislabel.',
    },
    {
      id: 'shaker-16ths', seed: 107, bpm: 96, bars: 8,
      desc: 'Shaker on all sixteen 16ths — band-limited like a hat but with a 6 ms soft attack instead of a 2 ms one.',
      lanes: { kick: [0, 8], snare: [4, 12], shaker: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      expect: { kick: 'exact', snare: 'exact', shaker: 'fallback' },
      note: 'Spectrally a shaker IS a hat. Only the soft onset separates them, and in a mix that cue is weak — so Percussion, flagged for review.',
    },
    {
      id: 'conga-perc', seed: 108, bpm: 100, bars: 8,
      desc: 'Hand percussion: pitched 300 Hz membrane with a fast drop and a slap transient, plus a clap backbeat.',
      lanes: { kick: [0, 8], clap: [4, 12], shaker: [2, 6, 10, 14] },
      voice: { shaker: 'conga' },
      expect: { kick: 'exact', clap: 'family', shaker: 'fallback' },
      note: 'A conga is mid/body-heavy and reads as a snare to a percentile gate. Its strong tonal peak ABOVE 240 Hz is what says "not a snare".',
    },

    // ---------- 9-12: real grooves ----------
    {
      id: 'dembow', seed: 109, bpm: 94, bars: 8,
      desc: 'Aura BEATS.dembow — kick on every quarter, snare 3/6/11/14, hats on the evens, shaker on 2/6/10/14.',
      lanes: clone(B.dembow),
      expect: { kick: 'exact', snare: 'exact', hat: 'exact', shaker: 'fallback' },
      note: 'Dense and overlapping: shaker sits on top of hat and snare. Coincident lanes are the hardest honest case in this set.',
    },
    {
      id: 'boombap-swing', seed: 110, bpm: 88, bars: 8, swing: 0.34,
      desc: 'Aura BEATS.boombap with 34% swing, so every odd 16th is pushed late by ~30 ms.',
      lanes: clone(B.boombap),
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      note: 'Swing is the pre-quantise offset the UI promises to report. Timing must still match the true onsets; the grid may legitimately snap them.',
      swungTruth: true,
    },
    {
      id: 'trap-rolls', seed: 111, bpm: 146, bars: 8,
      desc: 'Trap hats: all sixteen 16ths plus 32nd-note rolls (fractional steps) that Aura’s 16-step bar cannot represent.',
      lanes: {
        kick: [0, 7, 10], snare: [4, 12],
        hat: [0, 1, 2, 3, 4, 5, 6, 6.5, 7, 8, 9, 10, 11, 12, 13, 13.5, 14, 14.5, 15, 15.5],
      },
      expect: { kick: 'exact', snare: 'exact', hat: 'subset' },
      note: 'The rolls are unrepresentable on a 16-step grid. The correct behaviour is a hat lane that is right about the integer steps and honest (lower confidence) about the rest — not a lane stuffed with invented hits.',
    },
    {
      id: 'sparse-rnb', seed: 112, bpm: 72, bars: 8,
      desc: 'Sparse R&B: Aura BEATS.silk at a slow tempo and a low level, hats quiet under the kit.',
      lanes: clone(B.silk),
      levels: { hat: 0.2, shaker: 0.26, kick: 0.85, snare: 0.6 },
      expect: { kick: 'exact', snare: 'exact', hat: 'fallback', shaker: 'fallback' },
      note: 'Few, quiet events. With little to rank, a percentile classifier has almost no distribution to work with — the fixture that most exposes that design.',
    },

    // ---------- 13-15: percussion in context, and level invariance ----------
    {
      id: 'mixed-harmony', seed: 113, bpm: 96, bars: 8,
      desc: 'BEATS.pop under a sustained Am/F pad and a walking sub bass at realistic mix level. A minor.',
      lanes: clone(B.pop),
      harmony: { notes: [[57, 60, 64], [53, 57, 60], [57, 60, 64], [55, 59, 62]], barsPerChord: 1, bassMidi: 45, level: 0.2, bassLevel: 0.46, key: 9, mode: 'minor' },
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      expectKey: { key: 9, mode: 'minor' },
      note: 'The pad has a 250 ms attack and the bass restarts every beat. A flux detector must fire on the drums and not on the harmony.',
    },
    {
      id: 'dyn-soft', seed: 114, bpm: 96, bars: 8,
      desc: 'BEATS.pop rendered quietly (0.3x) and peak-limited to 0.28 — a badly levelled phone recording.',
      lanes: clone(B.pop), peak: 0.28,
      levels: { kick: 0.3, snare: 0.24, hat: 0.14 },
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      pairWith: 'dyn-loud',
      note: 'Paired with dyn-loud. Both carry the same pattern, so the two must produce the SAME lanes — any level dependence is a bug, not a tuning choice.',
    },
    {
      id: 'dyn-loud', seed: 114, bpm: 96, bars: 8,
      desc: 'The identical pattern rendered hot and limited to 0.97.',
      lanes: clone(B.pop), peak: 0.97,
      levels: { kick: 1.0, snare: 0.85, hat: 0.5 },
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      pairWith: 'dyn-soft',
      note: 'See dyn-soft.',
    },

    // ---------- 16-18: tempo, structure, and the empty case ----------
    {
      id: 'halftime-ambig', seed: 115, bpm: 140, bars: 8,
      desc: 'BEATS.halftime at 140: snare on step 8 alone, hats on all sixteen. Reads honestly as 140 or as 70.',
      lanes: clone(B.halftime),
      expect: { kick: 'exact', snare: 'exact', hat: 'exact' },
      note: 'Tempo has more than one defensible answer, so it is scored by the general metrical-relative rule: any simple relative is accepted PROVIDED the true reading is offered as an alternate the singer can take in one tap. What is not acceptable is picking a relative and hiding it.',
    },
    {
      id: 'sections', seed: 116, bpm: 100, bars: 24,
      desc: 'Four-part structure: 4 bars sparse intro, 8 bars verse, 8 bars loud chorus, 4 bars thinned outro.',
      sections: [
        { bars: 4, label: 'Intro', lanes: { kick: [0, 8] } },
        { bars: 8, label: 'Verse', lanes: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] } },
        { bars: 8, label: 'Chorus', lanes: { kick: [0, 4, 8, 12], snare: [4, 12], clap: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], openhat: [15] } },
        { bars: 4, label: 'Outro', lanes: { kick: [0, 8], hat: [0, 8] } },
      ],
      harmony: { notes: [[57, 60, 64], [53, 57, 60]], barsPerChord: 2, bassMidi: 45, level: 0.18, bassLevel: 0.4, key: 9, mode: 'minor' },
      expect: { kick: 'ignore', snare: 'ignore', hat: 'ignore', clap: 'ignore', openhat: 'ignore' },
      expectSections: { count: { min: 3, max: 6 }, boundaryToleranceBars: 1 },
      note: 'Scored on structure, not lanes: four real boundaries at bars 4, 12 and 20, with the chorus as the loudest repeated material.',
    },
    {
      id: 'harmony-only', seed: 117, bpm: 84, bars: 8,
      desc: 'No percussion at all: Eb minor pad and bass only.',
      lanes: {},
      harmony: { notes: [[63, 66, 70], [58, 61, 65], [63, 66, 70], [61, 65, 68]], barsPerChord: 1, bassMidi: 39, level: 0.34, bassLevel: 0.5, key: 3, mode: 'minor' },
      expect: {},
      expectKey: { key: 3, mode: 'minor' },
      expectNoPercussion: true, skipTiming: true,
      note: 'The engine must invent NOTHING. Any filled drum lane here is a false positive, and the row must say no percussion could be separated.',
    },
    {
      id: 'perc-stack', seed: 118, bpm: 102, bars: 8,
      desc: 'Mixed percussion with no drum kit: conga, shaker and a rimshot over a pad — all three honestly ambiguous.',
      lanes: { shaker: [0, 4, 8, 12], hat: [2, 6, 10, 14], snare: [7, 15] },
      voice: { shaker: 'conga', hat: 'shaker', snare: 'rimshot' },
      harmony: { notes: [[60, 63, 67]], bassMidi: 48, level: 0.18, bassLevel: 0.3, key: 0, mode: 'minor' },
      expect: { shaker: 'fallback', hat: 'fallback', snare: 'fallback' },
      note: 'Nothing here is a kit drum. A confident kick/snare/hat anywhere in this fixture is the exact failure this release is meant to remove.',
    },
  ];

  // ---------- scoring ----------
  // Timing tolerance: spectralFrames() hops 256 samples at 22050 Hz (app.js:1175), so a reported
  // onset is quantised to 11.61 ms. Three frames (35 ms) allows for the frame grid plus the
  // detector's own group delay, and is stricter than the 50 ms MIREX onset convention.
  const FRAME_MS = 1000 * 256 / 22050;            // 11.6099...
  const TOL_MS = 35;
  const TOL_LOOSE_MS = 50;

  // Which Aura drum ids count as the same answer for a 'family' expectation.
  const FAMILY = { snare: ['snare', 'clap'], clap: ['snare', 'clap'] };
  // Which Aura drum ids represent the broad fallback categories.
  const FALLBACK_LANES = ['shaker'];              // Percussion / Uncertain Percussion live here
  const SPECIFIC_LANES = ['kick', 'snare', 'clap', 'hat', 'openhat'];

  // Suite thresholds. Chosen to be a real bar over the measured v13.2 baseline (4/8 recall,
  // snare 0/2, 4 false positives) without being flattering: a mislabel is weighted hardest
  // because a confident wrong lane is the failure a singer cannot detect for themselves.
  const THRESHOLDS = {
    timingF: 0.80,          // per fixture, onset detection F-measure at 35 ms
    laneRecall: 0.70,       // per fixture, over lanes expected 'exact'
    misLabelRate: 0.15,     // per fixture, share of detected steps given a confidently WRONG lane
    suiteTimingF: 0.85,
    suiteLaneRecall: 0.75,
    suiteMisLabelRate: 0.10,
    invariance: 1.0,        // dyn-soft and dyn-loud must agree on every lane/step
  };

  root.AuraQAFixtures = {
    fixtures: F, BEATS: B,
    FRAME_MS, TOL_MS, TOL_LOOSE_MS,
    FAMILY, FALLBACK_LANES, SPECIFIC_LANES, THRESHOLDS,
  };
})(typeof window !== 'undefined' ? window : this);
