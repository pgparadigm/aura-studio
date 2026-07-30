/* Aura Studio — deterministic test-audio synthesis for the import/rebuild QA suite.
   Library only: no entry point, no network, no dependency. Loaded by fixtures/import-qa.html.

   Everything here is ORIGINAL generated audio. No commercial recording is used, copied or
   approximated from a reference file — each voice is written from its synthesis parameters.

   Determinism is the whole point: a fixture must score identically on every run, on every
   machine, so a change in the score means a change in the ENGINE and nothing else. Therefore
   Math.random() is banned in this file. Every noise sample comes from mulberry32 seeded from
   (fixture seed, voice name, hit index), so a hit sounds the same no matter what order the
   fixture renders its hits in, and adding a hit never re-rolls the others.

   Audio is written straight into a mono Float32Array at 44100 Hz — the rate a real import
   arrives at — and the harness wraps it in an AudioBuffer. Aura's own analysis decimates to
   22050 (IMP_RATE) internally, so feeding it 44100 exercises the real monoDown() path. */
(function (root) {
  'use strict';

  const SR = 44100;

  // ---------- deterministic randomness ----------
  // mulberry32: 32-bit state, uniform in [0,1), fast, and identical in every JS engine.
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // A stable 32-bit hash of a string, so a voice name can seed its own stream.
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  // One stream per (seed, voice, index). Bipolar noise in [-1,1].
  function noiseStream(seed, voice, idx) {
    const r = mulberry32((seed ^ hashStr(voice) ^ Math.imul(idx + 1, 2654435761)) >>> 0);
    return () => r() * 2 - 1;
  }

  // ---------- filters ----------
  // RBJ biquad cookbook. Transposed direct form 1; state is per-instance and short-lived,
  // because every voice filters its own scratch buffer and then throws the state away.
  function biquad(type, sr, f0, Q, gainDb) {
    const w0 = 2 * Math.PI * Math.min(f0, sr * 0.49) / sr;
    const c = Math.cos(w0), s = Math.sin(w0), alpha = s / (2 * Q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') {
      b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    } else if (type === 'highpass') {
      b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    } else if (type === 'bandpass') {           // constant peak gain
      b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * c; a2 = 1 - alpha;
    } else if (type === 'peaking') {
      const A = Math.pow(10, (gainDb || 0) / 40);
      b0 = 1 + alpha * A; b1 = -2 * c; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * c; a2 = 1 - alpha / A;
    } else { throw new Error('unknown filter ' + type); }
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return function (x) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    };
  }
  function filterInPlace(buf, n, f) { for (let i = 0; i < n; i++) buf[i] = f(buf[i]); }

  // ---------- envelopes ----------
  // Percussive: linear attack then exponential decay to -60 dB at `decay` seconds.
  function ampAt(t, attack, decay) {
    if (t < 0) return 0;
    if (t < attack) return attack > 0 ? t / attack : 1;
    return Math.exp(-6.9078 * (t - attack) / Math.max(1e-5, decay));
  }

  // A scratch buffer big enough for any single hit, reused to keep allocation out of the loop.
  const SCRATCH = new Float32Array(SR * 3);

  function mixIn(out, startSample, n, gain) {
    const end = Math.min(out.length, startSample + n);
    for (let i = Math.max(0, startSample); i < end; i++) out[i] += SCRATCH[i - startSample] * gain;
  }
  function clearScratch(n) { for (let i = 0; i < n; i++) SCRATCH[i] = 0; }

  // ---------- voices ----------
  // Every voice writes `len` seconds into SCRATCH then mixes at `t`. `o` carries the fixture
  // seed and the hit index so the noise is reproducible.

  // Electronic kick: sine with an exponential pitch glide plus an optional bright click.
  // `drive` > 0 saturates it, which is what makes an 808 leak harmonics into the mid band —
  // the case the classifier keeps mistaking for a snare.
  function kick(out, t, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.95;
    const f0 = o.f0 || 155, f1 = o.f1 || 45, pd = o.pitchDecay || 0.11;
    const decay = o.decay || 0.34, attack = 0.004, drive = o.drive || 0;
    const len = Math.ceil(SR * (decay + attack + 0.05));
    clearScratch(len);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const f = f1 + (f0 - f1) * Math.exp(-tt / pd);
      ph += 2 * Math.PI * f / SR;
      let v = Math.sin(ph) * ampAt(tt, attack, decay);
      if (drive > 0) v = Math.tanh(v * (1 + drive * 7)) / Math.tanh(1 + drive * 7);
      SCRATCH[i] = v;
    }
    if (o.click !== 0) {
      const nz = noiseStream(o.seed || 1, 'kickclick', o.idx || 0);
      const hp = biquad('highpass', SR, 2600, 0.7);
      const cl = Math.ceil(SR * 0.05);
      for (let i = 0; i < cl; i++) SCRATCH[i] += hp(nz()) * ampAt(i / SR, 0.001, 0.028) * (o.click || 0.5);
    }
    mixIn(out, Math.round(t * SR), len, level);
  }

  // Electronic snare: high-passed noise crack over a short 185 Hz tonal body — the shape the
  // v13.2 foundation was measured against, kept so the old result stays comparable.
  function snare(out, t, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.8;
    const decay = o.decay || 0.17, body = o.body != null ? o.body : 0.45, bodyHz = o.bodyHz || 185;
    const len = Math.ceil(SR * (decay + 0.12));
    clearScratch(len);
    const nz = noiseStream(o.seed || 1, 'snare', o.idx || 0);
    const hp = biquad('highpass', SR, o.noiseHz || 1700, 0.7);
    for (let i = 0; i < len; i++) SCRATCH[i] = hp(nz()) * ampAt(i / SR, 0.004, decay) * 0.95;
    let ph = 0;
    for (let i = 0; i < len; i++) {
      ph += 2 * Math.PI * bodyHz / SR;
      // triangle from the sine's odd harmonics is overkill here; a sine reads as the same band
      SCRATCH[i] += Math.sin(ph) * ampAt(i / SR, 0.005, decay * 0.65) * body;
    }
    mixIn(out, Math.round(t * SR), len, level);
  }

  // Acoustic-style snare: two tuned shell modes, a wider noise band for the wires, and a
  // slower, rougher decay. Much more 180-400 Hz body than the electronic one.
  function snareAcoustic(out, t, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.8;
    const decay = o.decay || 0.24;
    const len = Math.ceil(SR * (decay + 0.16));
    clearScratch(len);
    const nz = noiseStream(o.seed || 1, 'snareAc', o.idx || 0);
    const bp = biquad('bandpass', SR, 3200, 0.6);
    for (let i = 0; i < len; i++) SCRATCH[i] = bp(nz()) * ampAt(i / SR, 0.003, decay) * 0.85;
    [[188, 0.5, 1.0], [332, 0.3, 0.7]].forEach(([hz, amp, dm], k) => {
      let ph = 0;
      for (let i = 0; i < len; i++) {
        ph += 2 * Math.PI * hz / SR;
        SCRATCH[i] += Math.sin(ph) * ampAt(i / SR, 0.004, decay * dm) * amp;
      }
    });
    mixIn(out, Math.round(t * SR), len, level);
  }

  // Clap: several short band-limited noise bursts a few milliseconds apart, then a diffuse
  // tail. The multi-burst attack and the missing 180-220 Hz shell body are what distinguish it
  // from a snare, so both are modelled explicitly rather than approximated.
  function clap(out, t, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.6;
    const bursts = o.bursts || 3, spread = o.spread || 0.012, decay = o.decay || 0.14;
    const len = Math.ceil(SR * (spread * bursts + decay + 0.1));
    clearScratch(len);
    const nz = noiseStream(o.seed || 1, 'clap', o.idx || 0);
    const bp = biquad('bandpass', SR, o.centre || 1250, o.Q || 1.2);
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      let a = 0;
      for (let b = 0; b < bursts; b++) a += ampAt(tt - b * spread, 0.001, 0.02) * (1 - b * 0.12);
      a += ampAt(tt - (bursts - 1) * spread, 0.004, decay) * 0.55;   // the room tail
      SCRATCH[i] = bp(nz()) * Math.min(1.4, a);
    }
    mixIn(out, Math.round(t * SR), len, level);
  }

  // Rimshot: woody, very short, strong 420/780 Hz tone with a tight noise tick and almost no
  // sustain. Sits between a snare and a percussion hit, which is exactly why it is a fixture.
  function rimshot(out, t, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.6;
    const decay = o.decay || 0.075;
    const len = Math.ceil(SR * (decay + 0.06));
    clearScratch(len);
    const nz = noiseStream(o.seed || 1, 'rim', o.idx || 0);
    const bp = biquad('bandpass', SR, 2400, 1.1);
    for (let i = 0; i < len; i++) SCRATCH[i] = bp(nz()) * ampAt(i / SR, 0.0008, decay * 0.5) * 0.5;
    [[420, 0.75], [780, 0.4]].forEach(([hz, amp]) => {
      let ph = 0;
      for (let i = 0; i < len; i++) { ph += 2 * Math.PI * hz / SR; SCRATCH[i] += Math.sin(ph) * ampAt(i / SR, 0.001, decay) * amp; }
    });
    mixIn(out, Math.round(t * SR), len, level);
  }

  function hat(out, t, o) {          // closed hi-hat
    o = o || {};
    const level = o.level != null ? o.level : 0.45, decay = o.decay || 0.045;
    const len = Math.ceil(SR * (decay + 0.04));
    clearScratch(len);
    const nz = noiseStream(o.seed || 1, 'hat', o.idx || 0);
    const hp = biquad('highpass', SR, o.hp || 7500, 0.7);
    for (let i = 0; i < len; i++) SCRATCH[i] = hp(nz()) * ampAt(i / SR, 0.002, decay);
    mixIn(out, Math.round(t * SR), len, level);
  }
  function openhat(out, t, o) {      // open hi-hat: same band, five times the tail
    o = o || {};
    const level = o.level != null ? o.level : 0.4, decay = o.decay || 0.28;
    const len = Math.ceil(SR * (decay + 0.1));
    clearScratch(len);
    const nz = noiseStream(o.seed || 1, 'openhat', o.idx || 0);
    const hp = biquad('highpass', SR, o.hp || 6800, 0.7);
    for (let i = 0; i < len; i++) SCRATCH[i] = hp(nz()) * ampAt(i / SR, 0.003, decay);
    mixIn(out, Math.round(t * SR), len, level);
  }
  // Shaker: band-limited, but with a SOFT attack — that slow onset is the honest reason a
  // shaker is hard to place, and the reason it belongs in the broad Percussion lane.
  function shaker(out, t, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.5, decay = o.decay || 0.055;
    const len = Math.ceil(SR * (decay + 0.05));
    clearScratch(len);
    const nz = noiseStream(o.seed || 1, 'shaker', o.idx || 0);
    const bp = biquad('bandpass', SR, o.centre || 6500, 0.8);
    for (let i = 0; i < len; i++) SCRATCH[i] = bp(nz()) * ampAt(i / SR, 0.006, decay);
    mixIn(out, Math.round(t * SR), len, level);
  }
  // Conga / hand drum: pitched membrane with a fast drop plus a slap transient. Mid-heavy,
  // so a body-percentile classifier reads it as a snare unless it is handled deliberately.
  function conga(out, t, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.6;
    const f0 = o.f0 || 300, decay = o.decay || 0.19;
    const len = Math.ceil(SR * (decay + 0.1));
    clearScratch(len);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR, f = f0 * (0.86 + 0.14 * Math.exp(-tt / 0.02));
      ph += 2 * Math.PI * f / SR;
      SCRATCH[i] = Math.sin(ph) * ampAt(tt, 0.003, decay) * 0.9;
    }
    const nz = noiseStream(o.seed || 1, 'conga', o.idx || 0);
    const bp = biquad('bandpass', SR, 1800, 0.9);
    for (let i = 0; i < Math.min(len, Math.ceil(SR * 0.03)); i++) SCRATCH[i] += bp(nz()) * ampAt(i / SR, 0.001, 0.012) * 0.35;
    mixIn(out, Math.round(t * SR), len, level);
  }

  // ---------- sustained harmonic material ----------
  // A pad and a bass line, so percussion can be tested where it really lives: underneath other
  // instruments. Detuned partials with a slow attack, deliberately NOT percussive, so a correct
  // onset detector should not fire on them.
  const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
  function pad(out, t, dur, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.16;
    const notes = o.notes || [60, 63, 67];
    const len = Math.ceil(SR * dur);
    clearScratch(len);
    const atk = o.attack || 0.25, rel = o.release || 0.4;
    notes.forEach((m, ni) => {
      [1, 2, 3].forEach((h, hi) => {
        const f = midiToHz(m) * h * (1 + (ni - 1) * 0.0012);      // gentle detune, no beating artefacts
        const amp = 1 / (h * h) * (hi === 0 ? 1 : 0.6);
        let ph = 0;
        for (let i = 0; i < len; i++) {
          const tt = i / SR;
          const env = Math.min(1, tt / atk) * Math.min(1, Math.max(0, (dur - tt) / rel));
          ph += 2 * Math.PI * f / SR;
          SCRATCH[i] += Math.sin(ph) * env * amp;
        }
      });
    });
    const lp = biquad('lowpass', SR, 2600, 0.7);
    filterInPlace(SCRATCH, len, lp);
    mixIn(out, Math.round(t * SR), len, level / notes.length);
  }
  function bassNote(out, t, dur, o) {
    o = o || {};
    const level = o.level != null ? o.level : 0.5;
    const f = midiToHz(o.midi != null ? o.midi : 36);
    const len = Math.ceil(SR * (dur + 0.08));
    clearScratch(len);
    let ph = 0;
    for (let i = 0; i < len; i++) {
      const tt = i / SR;
      const env = Math.min(1, tt / 0.008) * Math.exp(-2.2 * Math.max(0, tt - dur * 0.5) / Math.max(0.05, dur));
      ph += 2 * Math.PI * f / SR;
      SCRATCH[i] = (Math.sin(ph) + 0.22 * Math.sin(ph * 2)) * env;
    }
    mixIn(out, Math.round(t * SR), len, level);
  }

  const VOICES = { kick, snare, snareAcoustic, clap, hat, openhat, shaker, conga, rimshot };

  // ---------- renderer ----------
  // A fixture describes itself as bars of 16 steps with named voices on steps. The renderer
  // returns both the audio and the GROUND TRUTH it just created, so no truth is hand-written
  // twice and the two can never drift apart.
  //
  //   spec = {
  //     id, seed, bpm, bars, swing,            // swing: 0..1, delays odd 16ths
  //     lanes: { kick:[0,8], snare:[4,12] },   // step indices within the bar
  //     voice: { kick:'kick', snare:'clap' },  // which synth plays a lane (default: same name)
  //     params:{ kick:{drive:0.8} },           // per-voice overrides
  //     levels:{ hat:0.3 },                    // per-lane level scale
  //     dynamics: step => 1,                   // optional per-step level multiplier
  //     harmony: { notes:[[57,60,64]], bassMidi:45, level:0.16 },
  //     sections: [{bars:4, lanes:{...}}]      // optional: overrides `lanes` per section
  //   }
  function render(spec) {
    const bpm = spec.bpm, bars = spec.bars || 4, swing = spec.swing || 0;
    const spb = 60 / bpm, sixteenth = spb / 4;
    const lead = spec.lead != null ? spec.lead : 0.25;         // silence before bar 1
    const tail = spec.tail != null ? spec.tail : 0.6;
    const dur = lead + bars * 4 * spb + tail;
    const out = new Float32Array(Math.ceil(SR * dur));
    const truth = [];
    const seed = spec.seed || 1;
    let hitIdx = 0;

    // Sections let one fixture change its pattern partway through, which is how the section
    // detector gets something real to find.
    const plan = [];
    if (spec.sections && spec.sections.length) {
      let b = 0;
      spec.sections.forEach((s, si) => {
        for (let i = 0; i < s.bars && b < bars; i++, b++) plan.push({ bar: b, lanes: s.lanes || spec.lanes || {}, section: si, label: s.label });
      });
      while (plan.length < bars) plan.push({ bar: plan.length, lanes: spec.lanes || {}, section: spec.sections.length - 1 });
    } else {
      for (let b = 0; b < bars; b++) plan.push({ bar: b, lanes: spec.lanes || {}, section: 0 });
    }

    plan.forEach(p => {
      Object.keys(p.lanes).forEach(lane => {
        const steps = p.lanes[lane] || [];
        const voiceName = (spec.voice && spec.voice[lane]) || lane;
        const fn = VOICES[voiceName];
        if (!fn) throw new Error('no voice ' + voiceName + ' for lane ' + lane);
        steps.forEach(step => {
          // Swing delays the odd 16ths, exactly as Aura's own scheduler does (app.js:343).
          const sw = (step % 2 === 1) ? swing * sixteenth * 0.9 : 0;
          const t = lead + p.bar * 4 * spb + step * sixteenth + sw;
          const dyn = spec.dynamics ? spec.dynamics(step, p.bar) : 1;
          const base = (spec.levels && spec.levels[lane] != null) ? spec.levels[lane] : undefined;
          const o = Object.assign({ seed, idx: hitIdx++ }, (spec.params && spec.params[voiceName]) || {});
          if (base != null) o.level = base * dyn; else if (dyn !== 1) o.level = (o.level != null ? o.level : defaultLevel(voiceName)) * dyn;
          fn(out, t, o);
          truth.push({ t: +t.toFixed(6), lane, voice: voiceName, bar: p.bar, step, section: p.section });
        });
      });
    });

    // Harmony last, so its level is set against a finished drum bed. Its note starts are recorded as
    // `ignore` times: a pad swell or a bass note IS a real onset, so an onset detector that finds one
    // has not made a mistake — it has found something that simply is not a drum. Scoring them as
    // false positives would measure the fixture's design rather than the engine.
    const ignore = [];
    if (spec.harmony) {
      const H = spec.harmony, chords = H.notes || [[57, 60, 64]];
      const barsPerChord = H.barsPerChord || 1;
      for (let b = 0; b < bars; b++) {
        const ch = chords[Math.floor(b / barsPerChord) % chords.length];
        const t0 = lead + b * 4 * spb;
        pad(out, t0, 4 * spb, { notes: ch, level: H.level != null ? H.level : 0.16 });
        ignore.push(+t0.toFixed(6));
        if (H.bassMidi != null) {
          for (let q = 0; q < 4; q++) {
            const bt = t0 + q * spb;
            bassNote(out, bt, spb * 0.9, { midi: H.bassMidi + (ch[0] - chords[0][0]), level: H.bassLevel != null ? H.bassLevel : 0.42 });
            ignore.push(+bt.toFixed(6));
          }
        }
      }
    }

    // Peak-normalise DOWN only, to a realistic mastered ceiling. Never up: a deliberately
    // quiet fixture must stay quiet, because "soft dynamics" is one of the cases under test.
    let peak = 0;
    for (let i = 0; i < out.length; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
    const ceil = spec.peak != null ? spec.peak : 0.89;
    if (peak > ceil) { const g = ceil / peak; for (let i = 0; i < out.length; i++) out[i] *= g; }

    truth.sort((a, b) => a.t - b.t || a.lane.localeCompare(b.lane));
    return {
      id: spec.id, sampleRate: SR, data: out, duration: out.length / SR,
      truth: {
        bpm, bars, swing, lead, sixteenth,
        events: truth,
        onsets: dedupeTimes(truth.map(e => e.t), 0.006),
        ignore: dedupeTimes(ignore, 0.006),
        sections: sectionTruth(plan, lead, spb),
        key: spec.harmony && spec.harmony.key != null ? spec.harmony.key : null,
        mode: spec.harmony && spec.harmony.mode ? spec.harmony.mode : null,
        altBpm: spec.altBpm != null ? spec.altBpm : null,
      },
    };
  }
  function defaultLevel(v) {
    return ({ kick: 0.95, snare: 0.8, snareAcoustic: 0.8, clap: 0.6, hat: 0.45, openhat: 0.4, shaker: 0.5, conga: 0.6, rimshot: 0.6 })[v] || 0.6;
  }
  // Two voices on the same step are ONE audible onset; the detector cannot be asked to find
  // two. Collapse them for the timing score while keeping both in `events` for the lane score.
  function dedupeTimes(ts, tol) {
    const s = ts.slice().sort((a, b) => a - b), out = [];
    s.forEach(t => { if (!out.length || t - out[out.length - 1] > tol) out.push(t); });
    return out;
  }
  function sectionTruth(plan, lead, spb) {
    const segs = [];
    plan.forEach(p => {
      const last = segs[segs.length - 1];
      if (last && last.section === p.section) { last.bars++; last.barEnd = p.bar + 1; }
      else segs.push({ section: p.section, label: p.label || null, barStart: p.bar, barEnd: p.bar + 1, bars: 1 });
    });
    segs.forEach(s => { s.startSec = +(lead + s.barStart * 4 * spb).toFixed(6); s.endSec = +(lead + s.barEnd * 4 * spb).toFixed(6); });
    return segs;
  }

  // Wrap a rendered fixture in a real AudioBuffer, which is what a decoded import is.
  function toAudioBuffer(ctx, rendered) {
    const buf = ctx.createBuffer(1, rendered.data.length, rendered.sampleRate);
    buf.getChannelData(0).set(rendered.data);
    return buf;
  }

  root.AuraQAAudio = {
    SR, mulberry32, hashStr, biquad, midiToHz,
    voices: VOICES, pad, bassNote,
    render, toAudioBuffer, dedupeTimes,
  };
})(typeof window !== 'undefined' ? window : this);
