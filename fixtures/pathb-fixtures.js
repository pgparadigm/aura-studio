/* Aura Studio — deterministic fixtures for Path B (Rebuild with Aura).
 *
 * Every fixture is synthesised here from a seeded PRNG. Math.random() is banned, for the same reason
 * it is banned in qa-audio.js: a score that moves on its own is not a measurement.
 *
 * These are musical signals with KNOWN ground truth — tempo, key, chord roots, drum placement and
 * low-end behaviour — so the reconstruction can be scored against what was actually written rather
 * than against a listener's impression.
 *
 * Exposed as window.__auraPathBFixtures.
 */
(function () {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const SR = 44100;
  const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---- voices -------------------------------------------------------------------------------
  function kick(out, at, n, gain) {
    for (let i = 0; i < SR * 0.26 && at + i < n; i++) {
      const t = i / SR, f = 55 * Math.exp(-t * 18) + 42;
      out[at + i] += gain * Math.exp(-t / 0.09) * Math.sin(2 * Math.PI * f * t);
    }
  }
  function snare(out, at, n, gain, rnd) {
    for (let i = 0; i < SR * 0.18 && at + i < n; i++) {
      const t = i / SR, x = rnd() * 2 - 1;
      out[at + i] += gain * Math.exp(-t / 0.055) * (0.7 * x + 0.5 * Math.sin(2 * Math.PI * 190 * t));
    }
  }
  function hat(out, at, n, gain, rnd) {
    for (let i = 0; i < SR * 0.05 && at + i < n; i++) {
      const t = i / SR, x = rnd() * 2 - 1;
      out[at + i] += gain * Math.exp(-t / 0.014) * x;
    }
  }
  // A bass note with a chosen shape. `glide` slides from the previous note's pitch.
  function bassNote(out, at, n, midi, secs, gain, opts) {
    opts = opts || {};
    const len = Math.min(Math.round(SR * secs), n - at);
    const f0 = opts.glideFrom ? midiHz(opts.glideFrom) : midiHz(midi);
    const f1 = midiHz(midi);
    const dec = opts.sustain ? secs : Math.min(secs, opts.decay || 0.35);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const t = i / SR, k = Math.min(1, t / 0.06);
      const f = f0 + (f1 - f0) * k;                 // short portamento when asked for
      ph += 2 * Math.PI * f / SR;
      const env = Math.min(1, t / 0.006) * Math.exp(-t / dec);
      out[at + i] += gain * env * Math.sin(ph);
    }
  }
  function chordPad(outL, outR, at, n, notes, secs, gain) {
    const len = Math.min(Math.round(SR * secs), n - at);
    for (let i = 0; i < len; i++) {
      const t = i / SR, e = Math.min(1, t / 0.02) * Math.exp(-t / (secs * 0.75));
      let s = 0;
      notes.forEach((m, k) => { s += gain * e * Math.sin(2 * Math.PI * midiHz(m) * t + k); });
      outL[at + i] += s; outR[at + i] += s * 0.86;
    }
  }

  function toWav(L, R, name) {
    const n = L.length;
    let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    const g = 0.89 / (pk || 1);
    const bytes = 44 + n * 4, ab = new ArrayBuffer(bytes), v = new DataView(ab);
    const tag = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    tag(0, 'RIFF'); v.setUint32(4, bytes - 8, true); tag(8, 'WAVE');
    tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
    v.setUint32(24, SR, true); v.setUint32(28, SR * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
    tag(36, 'data'); v.setUint32(40, n * 4, true);
    for (let i = 0; i < n; i++) {
      v.setInt16(44 + i * 4, Math.max(-32767, Math.min(32767, L[i] * g * 32767)), true);
      v.setInt16(46 + i * 4, Math.max(-32767, Math.min(32767, R[i] * g * 32767)), true);
    }
    return new File([ab], name, { type: 'audio/wav' });
  }

  // ---- the builder --------------------------------------------------------------------------
  // spec: { id, bpm, bars, key, mode, chords:[midi root per bar], triads:[[..]], drums:'full'|'kickHeavy'|'none',
  //         bass:'sustained'|'syncopated'|'glide'|'walking'|'none'|'halftime'|'dembow'|'sparse',
  //         energy:[per-bar 0..1] }
  function build(spec) {
    const bpm = spec.bpm, spb = 60 / bpm, bars = spec.bars;
    const n = Math.round(SR * bars * 4 * spb);
    const L = new Float32Array(n), R = new Float32Array(n);
    const rnd = mulberry32(0xA17A ^ (spec.id.length * 2654435761));
    const stepAt = (bar, s) => Math.round((bar * 4 + s * 0.25) * spb * SR);
    const truth = { bass: [], drums: { kick: [], snare: [], hat: [] } };

    for (let b = 0; b < bars; b++) {
      const e = spec.energy ? spec.energy[b % spec.energy.length] : 1;
      const root = spec.chords[b % spec.chords.length];

      // drums
      if (spec.drums === 'full' || spec.drums === 'kickHeavy') {
        const kicks = spec.drums === 'kickHeavy' ? [0, 4, 8, 12] : [0, 8];
        kicks.forEach(s => { const a = stepAt(b, s); kick(L, a, n, 0.85 * e); kick(R, a, n, 0.85 * e);
          truth.drums.kick.push(b * 16 + s); });
        [4, 12].forEach(s => { const a = stepAt(b, s); snare(L, a, n, 0.5 * e, rnd); snare(R, a, n, 0.5 * e, rnd);
          truth.drums.snare.push(b * 16 + s); });
        [0, 2, 4, 6, 8, 10, 12, 14].forEach(s => { const a = stepAt(b, s);
          hat(L, a, n, 0.16 * e, rnd); hat(R, a, n, 0.18 * e, rnd); truth.drums.hat.push(b * 16 + s); });
      }

      // harmony
      if (spec.triads) chordPad(L, R, stepAt(b, 0), n, spec.triads[b % spec.triads.length], 4 * spb, 0.13 * e);

      // low end — the thing under test
      const bassMidi = root - 24;
      const put = (s, secs, opts) => {
        const a = stepAt(b, s);
        bassNote(L, a, n, (opts && opts.midi) || bassMidi, secs, 0.34 * e, opts);
        bassNote(R, a, n, (opts && opts.midi) || bassMidi, secs, 0.34 * e, opts);
        truth.bass.push({ step: b * 16 + s, midi: (opts && opts.midi) || bassMidi });
      };
      switch (spec.bass) {
        case 'sustained': put(0, 4 * spb, { sustain: true }); break;
        case 'syncopated': [0, 3, 6, 10, 14].forEach(s => put(s, spb * 0.4, { decay: 0.18 })); break;
        case 'glide': put(0, 2 * spb, { sustain: true });
          put(8, 2 * spb, { sustain: true, glideFrom: bassMidi - 5 }); break;
        case 'walking': [0, 4, 8, 12].forEach((s, i) => put(s, spb * 0.9, { decay: 0.3, midi: bassMidi + [0, 3, 5, 7][i] })); break;
        case 'halftime': put(0, 2 * spb, { sustain: true }); break;
        case 'dembow': [0, 6, 10, 14].forEach(s => put(s, spb * 0.35, { decay: 0.16 })); break;
        case 'sparse': if (b % 2 === 0) put(0, 2 * spb, { decay: 0.9 }); break;
        case 'none': break;
        default: put(0, 4 * spb, { sustain: true });
      }
    }
    return { file: toWav(L, R, spec.id + '.wav'), truth, spec };
  }

  // ---- the ten low-end fixtures the brief asks for -------------------------------------------
  const Am = [57, 53, 48, 55];                          // A F C G roots
  const AmTriads = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];

  const SPECS = [
    { id: 'bass-sustained', bpm: 100, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'sustained', desc: 'Sustained root under each chord.' },
    { id: 'bass-syncopated', bpm: 96, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'syncopated', desc: 'Off-beat root pattern, short notes.' },
    { id: 'bass-808-glide', bpm: 140, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'glide', desc: '808-style long notes with a slide into the second half.' },
    { id: 'bass-walking', bpm: 110, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'walking', desc: 'Root movement on every beat.' },
    { id: 'bass-none', bpm: 100, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'none', desc: 'No bass at all — Aura must not invent confident low end.' },
    { id: 'bass-kick-heavy', bpm: 128, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'kickHeavy', bass: 'none', desc: 'Four-on-the-floor kick and NO bass — the kick must not be read as bass.' },
    { id: 'bass-dense-harmony', bpm: 92, bars: 4, key: 9, mode: 'minor', chords: Am,
      triads: AmTriads.map(t => t.concat([t[0] + 12, t[1] + 12])), drums: 'full', bass: 'sustained',
      desc: 'Bass under a thick five-note chord bed.' },
    { id: 'bass-halftime', bpm: 140, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'halftime', desc: 'Half-time feel, one long note per bar.' },
    { id: 'bass-dembow', bpm: 94, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'dembow', desc: 'Dembow-placed low end.' },
    { id: 'bass-sparse-rnb', bpm: 78, bars: 4, key: 9, mode: 'minor', chords: Am, triads: AmTriads,
      drums: 'full', bass: 'sparse', energy: [0.5, 0.5, 1, 1],
      desc: 'Sparse R&B: bass only every other bar, quiet first half.' },
  ];

  // A plain musical demo used by the Path B lifecycle test: 100 BPM, A minor, Am-F-C-G.
  const DEMO = { id: 'pathb-demo', bpm: 100, bars: 4, key: 9, mode: 'minor', chords: Am,
    triads: AmTriads, drums: 'full', bass: 'sustained', desc: 'Path B lifecycle demo.' };

  window.__auraPathBFixtures = Object.freeze({
    build, SPECS, DEMO,
    demo: () => build(DEMO),
    all: () => SPECS.map(build),
    byId: id => { const s = SPECS.find(x => x.id === id); return s ? build(s) : null; },
  });
})();
