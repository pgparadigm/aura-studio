# Dashboard sub-project C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply changes the selected section's music (hits, accents, layers, bass, chord gaps) until its Measured energy meets its Target, never louder, never melody or voice; whole-song tone (Warmth, Room, Echo) becomes its own labelled group.

**Architecture:** `energyTransform(i, params)` works on a copy of one pattern using Aura's seeded groove engine for candidates and a fixed removal order, measuring with `patternMetrics` (the same formula as the Measured line). Apply writes the copy in one checkpoint; Preview swaps it in for playback and `serialize()` reports the original while it plays. Whole-song moves live in `applyWholeSong()` with their own sliders saved in `energyDoc.song`.

**Tech Stack:** Vanilla JS (one IIFE), CSS, built-in browser checks.

**Spec:** `docs/superpowers/specs/2026-09-24-dashboard-c-design.md` (decisions 1 and 2 as recommended, approved by Philip).

## Global Constraints

- Sole writer; `main` must be `d5aa983` at the start and immediately before the push.
- Ship gate: fresh loads at 375, 1024, 1280, 1440 plus a live shrink 1440 → 375 (screenshot before measuring). Wider than the viewport, or the Welcome ✕ off screen, blocks the ship.
- A's and B's tables must still pass. A mixer-only Apply (today's) must FAIL the Target check on a mutant.
- Apply never changes a channel volume, never changes melody notes, never changes voice content; the backbone (kick step 0, snare steps 4 and 12 when present) is never removed.
- Network law: `fetch(` count 1, in `loadSampleUrl`. Version 13.8.0-rc.4 → 13.8.0-rc.5 (1 in app.js, 13 in index.html).
- Out of scope: D, E, promoting `/rc/`, merging `v13.7-recording-confidence`, per-section tone, per-bar variation.

## Spec amendment, stated (found while planning; verified in the RED run before use)

The Measured value (`sectionMetrics().energy`) is a raw hit fraction: a full six-lane bar with chords, bass and melody is needed to approach 1, and Aura's own fullest chorus groove measures around 0.35–0.4. Reading Intensity 80 as raw 0.8 would make most Targets unreachable. So **Intensity is read on the section's own range**: 0 is the section with every removable hit removed (backbone, chords, melody, bass left), 100 is the section with every candidate the groove engine offers added. `targetRaw = floor + intensity/100 × (ceiling − floor)`. The energy lane keeps one raw axis for both lines (the Target bars store `targetRaw`, so the lines meet after Apply), and the rail shows both numbers on the 0–100 Intensity scale. Drawing on the curve sets the section's Intensity through the inverse mapping.

---

### Task 1: C checks and RED

**Files:** Create `qa/dashboard-c.qa.js`.

- [ ] Write the module below. RED on d5aa983 at 1440 fresh: expect `c1Target` FAIL (no report hook; Measured unchanged by Apply), `c1NotLouder` FAIL (hats and snare volume rise), `c1OnlySection` FAIL or PASS (records the baseline), `c2WholeSong` FAIL (no whole-song group). Record the raw energies of a fresh Intro and of the demo's sections, and the ceiling, to confirm the amendment.
- [ ] Commit `qa: dashboard C checks; RED on d5aa983`.

```js
// Aura dashboard sub-project C checks. TEST-ONLY; the app never loads this file.
import { settle, skipWelcome } from './dashboard-a.qa.js';
const $ = id => document.getElementById(id);
const S = () => window.__auraSuite;
const snap = () => JSON.parse(S().snapshot());
const setRange = (id, v) => { const el = $(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const G = { kick: 0, snare: 1, hats: 2, bass: 3, chords: 4, melody: 5, vocals: 6, sample: 7 };
const sel = () => { const b = $('saSecs').querySelector('.sa-sec'); if (b) b.click(); };
const vols = s => s.mx.map(r => r[0]).concat([s.mv]);
const run0 = () => { const s = snap().song; const i = s.findIndex(v => v != null); return s[i]; };

// Apply at Intensity v on the first section; returns the report and the measured energy.
async function applyAt(v) { sel(); await settle(200); setRange('drInt', v); await settle(400); $('drApply').click(); await settle(400);
  return { rep: S().lastEnergyReport ? S().lastEnergyReport() : null, measured: S().measured ? S().measured(run0()) : null }; }

export async function c1Target() {
  await skipWelcome(); await settle(300);
  const i = run0(), m0 = S().measured ? S().measured(i) : null;
  const up = await applyAt(85);
  const upOk = !!(up.rep && up.rep.after > up.rep.before && (up.rep.reached ? Math.abs(up.rep.after - up.rep.targetRaw) <= 0.03 : true) && Math.abs(up.measured - up.rep.after) < 1e-6);
  const down = await applyAt(15);
  const downOk = !!(down.rep && down.rep.after < down.rep.before && (down.rep.reached ? Math.abs(down.rep.after - down.rep.targetRaw) <= 0.03 : true) && Math.abs(down.measured - down.rep.after) < 1e-6);
  return { pass: upOk && downOk && up.rep.reached && down.rep.reached, m0, up, down };
}
export async function c1NotLouder() {
  await skipWelcome(); await settle(300);
  const before = vols(snap()); await applyAt(90); const mid = vols(snap()); await applyAt(10); const after = vols(snap());
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  return { pass: same(before, mid) && same(before, after), before, mid, after };
}
export async function c1OnlySection() {
  await skipWelcome(); await settle(300);
  const i = run0(), a = snap(); await applyAt(90); const b = snap();
  const others = a.pat.every((p, k) => k === i || JSON.stringify(p) === JSON.stringify(b.pat[k]));
  const othersAcc = a.acc.every((p, k) => k === i || JSON.stringify(p) === JSON.stringify(b.acc[k]));
  const othersLo = a.lo.every((p, k) => k === i || JSON.stringify(p) === JSON.stringify(b.lo[k]));
  const melody = JSON.stringify(a.mel) === JSON.stringify(b.mel), voice = JSON.stringify(a.mx[G.vocals]) === JSON.stringify(b.mx[G.vocals]);
  const changed = JSON.stringify(a.pat[i]) !== JSON.stringify(b.pat[i]);
  return { pass: others && othersAcc && othersLo && melody && voice && changed, others, othersAcc, othersLo, melody, voice, changed };
}
export async function c1Backbone() {
  await skipWelcome(); await settle(300);
  const i = run0(), s0 = snap(), m0 = s0.pat[i], has = (mask, st) => !!(mask & (1 << st));
  const kick0 = has(m0[0], 0), sn4 = has(m0[1], 4), sn12 = has(m0[1], 12); const bad = [];
  for (let v = 0; v <= 100; v += 10) { await applyAt(v); const m = snap().pat[i];
    if (kick0 && !has(m[0], 0)) bad.push([v, 'kick 1']); if (sn4 && !has(m[1], 4)) bad.push([v, 'snare 5']); if (sn12 && !has(m[1], 12)) bad.push([v, 'snare 13']);
    $('undoX').click(); await settle(300); }
  return { pass: bad.length === 0 && S().snapshot() === JSON.stringify(s0), before: { kick0, sn4, sn12 }, broken: bad, restored: S().snapshot() === JSON.stringify(s0) };
}
export async function c1DeterministicUndo() {
  await skipWelcome(); await settle(300);
  const i = run0(), s0 = S().snapshot(); await applyAt(70); const p1 = JSON.stringify(snap().pat[i]);
  $('undoX').click(); await settle(300); const back = S().snapshot() === s0;
  await applyAt(70); const p2 = JSON.stringify(snap().pat[i]); $('undoX').click(); await settle(300);
  return { pass: p1 === p2 && back, same: p1 === p2, oneUndoRestores: back };
}
export async function c1PreviewNoLeak() {
  await skipWelcome(); await settle(300);
  const i = run0(), orig = JSON.stringify(snap().pat[i]), mBefore = S().measured(i);
  sel(); setRange('drInt', 95); await settle(400);
  $('drPreview').click(); await settle(300);
  const started = $('drPreview').getAttribute('aria-pressed') === 'true', livePlaysNew = S().measured(i) !== mBefore;
  const bpm = $('bpm'); bpm.value = String(+bpm.value + 2); bpm.dispatchEvent(new Event('change', { bubbles: true })); await settle(300);
  const saved = JSON.parse(S().autosaveRaw()), savedClean = JSON.stringify(saved.pat[i]) === orig;
  if ($('play').classList.contains('on')) $('play').click(); await settle(300);
  const restored = JSON.stringify(snap().pat[i]) === orig && S().measured(i) === mBefore;
  return { pass: started && livePlaysNew && savedClean && restored, started, livePlaysNew, savedClean, restored };
}
export async function c1ReportTrue() {
  await skipWelcome(); await settle(300);
  const i = run0(), a = snap().pat[i]; const { rep } = await applyAt(90); const b = snap().pat[i];
  const ids = ['kick', 'snare', 'clap', 'hat', 'openhat', 'shaker'], pop = x => { let n = 0; while (x) { n += x & 1; x >>>= 1; } return n; };
  const diff = {}; ids.forEach((id, k) => { const add = pop(b[k] & ~a[k]), rem = pop(a[k] & ~b[k]); if (add) diff['+' + id] = add; if (rem) diff['-' + id] = rem; });
  const claimed = {}; Object.keys(rep.added || {}).forEach(k => { if (ids.includes(k)) claimed['+' + k] = rep.added[k]; }); Object.keys(rep.removed || {}).forEach(k => { if (ids.includes(k)) claimed['-' + k] = rep.removed[k]; });
  return { pass: JSON.stringify(Object.entries(diff).sort()) === JSON.stringify(Object.entries(claimed).sort()), diff, claimed, text: $('drMeter') && $('drMeter').textContent };
}
export async function c2WholeSong() {
  await skipWelcome(); await settle(300);
  const label = ($('drSongBlock') || {}).textContent || '';
  const a = snap(); setRange('drWarm', 90); setRange('drRoom', 80); setRange('drEcho', 70); await settle(400);
  const lockedV = a.mx[G.vocals], lockedM = a.mx[G.melody];
  $('drSongApply').click(); await settle(400); const b = snap();
  const toneMoved = b.rv !== a.rv && b.mx[G.chords][6] !== a.mx[G.chords][6] && b.mx[G.chords][8] !== a.mx[G.chords][8];
  const locksHeld = JSON.stringify(b.mx[G.vocals]) === JSON.stringify(lockedV) && JSON.stringify(b.mx[G.melody]) === JSON.stringify(lockedM);
  const notLouder = JSON.stringify(vols(a)) === JSON.stringify(vols(b)), patsSame = JSON.stringify(a.pat) === JSON.stringify(b.pat);
  $('drLockVoice').click(); $('drLockMelody').click(); setRange('drRoom', 20); await settle(300); $('drSongApply').click(); await settle(400); const c = snap();
  const unlockedMove = c.mx[G.vocals][7] !== b.mx[G.vocals][7] && c.mx[G.melody][7] !== b.mx[G.melody][7];
  return { pass: /every section/i.test(label) && toneMoved && locksHeld && notLouder && patsSame && unlockedMove, label: label.replace(/\s+/g, ' ').slice(0, 80), toneMoved, locksHeld, notLouder, patsSame, unlockedMove };
}
```

---

### Task 2: the transform (C1, C2) and Apply

**Files:** `rc/app.js`.

- [ ] Split `sectionMetrics` so one formula measures any pattern:

```js
  function sectionMetrics(i){ const p = patterns[i]; if (!p) return null; return patternMetrics(p, i); }
  // The measurement itself, on any pattern-shaped object, so Apply can measure a working copy with
  // exactly the formula the Measured line uses.
  function patternMetrics(p, i){
```
(replacing the first two lines of `sectionMetrics`; the body is unchanged.)

- [ ] Add, before `function applyEnergyToSection`, the transform (full code in the commit; its contract):
  - `energyCandidates(i, W, seed, inten, move)` → ordered add list `[{id, st}]` then bass notes `[{bass:note}]`, taken from `grooveBeat({role:'chorus', seed, heat:100, lift:90})` and `grooveLowEnd({role:'chorus', seed, root:keyRoot})`, minus hits `W` already has; order: floor kicks, backbeat snares, on-beat hats and then off-beat hats and shaker (swapped when Movement ≥ 50), open hat on step 14, clap, dembow snare ghosts, bass notes (only when the section already has written bass). Shaker and open hat are skipped when Intensity ≤ 75.
  - `energyRemovals(W, seed)` → ordered `[{id, st}]` and `[{bassIdx}]`: shaker, open hat, off-beat hats, clap, non-backbeat snares, on-beat hats, off-beat bass notes (keeping at least one), non-floor kicks, floor kicks 4/8/12; never kick 0, snare 4, snare 12; seeded order within a lane.
  - `energyTransform(i, prm)` → `{W, A, report}`: copy the pattern; Space gaps (remove chord hits that repeat the previous chord, never on step 0, fraction `max(0,(space−20)/80)`, seeded; shorten off-beat bass notes by up to 60%); layers (Intensity < 25 clears shaker and open hat); compute `floor` (all removals applied to a scratch copy) and `ceiling` (all candidates added to a scratch copy); `targetRaw = floor + inten/100 × (ceiling − floor)`; add or remove one candidate at a time, re-measuring, until within 0.03; accents (Intensity > 60 accents kick 0 and snares 4/12 where present; < 30 clears the section's accents); report `{name, bars, intensity, targetRaw, floor, ceiling, before, after, reached, added:{lane:n}, removed:{lane:n}, accentsAdded, accentsCleared}`. Deterministic seed `((i+1)*7919 + inten*131 + move*17 + space*3)>>>0`.
  - `energyWrite(i, r)` writes `W`'s drum and chord lanes, `A` and bass into `patterns[i]` / `accents[i]`.
- [ ] Replace `applyEnergyToSection` with the section-only version: Preview builds the transform and swaps it in (Task 4); Apply ends any preview, runs `energyTransform`, writes it inside `oneCheckpoint`, sets `dashApplyMark` only if history moved, re-renders, and shows the report in `#drMeter` and a toast. No mixer writes, no Target rewrite.
- [ ] Hooks on `__auraSuite`: `lastEnergyReport()`, `measured(i)` (sectionMetrics energy), `energyRange(i)` ({floor, ceiling} for the section's current params).
- [ ] GREEN: `c1Target`, `c1NotLouder`, `c1OnlySection`, `c1Backbone`, `c1DeterministicUndo`, `c1ReportTrue`.
- [ ] Mutant: temporarily restore d5aa983's `applyEnergyToSection` (mixer-only) into a copy; `c1Target` must FAIL; restore and verify the hash.
- [ ] Commit.

### Task 3: Target on the section's range; rail meter

- [ ] Intensity slider input writes the section's bars as `targetRaw` (not `value/100`); a stroke on the curve sets Intensity through the inverse mapping, clamped 0–100.
- [ ] `#drMeter` under the Shape sliders: "Target 80 · Measured 45" (both on the 0–100 scale for that section); while previewing "Preview: 78 (now 45)"; after Apply the report text.
- [ ] Update A's `claimsB` C9 to compare the section's Target bars with the mapped value (they are no longer `intensity`). Commit.

### Task 4: Preview swaps the section without writing it (C4)

- [ ] `energyDoc.preview = {pat:i, saved:{lanes, acc, bass}}`; `dashStartPreview(i, r)` swaps `r.W`/`r.A`/bass in and re-renders; `dashEndPreview()` restores and re-renders (same exits as A). Remove the mixer preview.
- [ ] `serialize()`: while previewing, `pat`, `acc` and `lo` for index `i` come from `energyDoc.preview.saved`; drop A's chords `mx` guard (Preview no longer touches the mixer).
- [ ] GREEN `c1PreviewNoLeak`; A's `a3PreviewNoLeak` still passes. Commit.

### Task 5: Whole-song group (decision 2)

- [ ] Markup: move Warmth and the Voice/Melody locks out of "Shape the energy" into a new `#drSongBlock` "Whole song · changes every section" with Warmth (`drWarm`), Room (`drRoom`), Echo (`drEcho`) and `#drSongApply` "Apply to whole song".
- [ ] `energyDoc.song = {warmth:50, room:40, echo:30}`, saved as `en.s` (read back in `applyState`), marking `energyDoc.touched` when changed.
- [ ] `applyWholeSong()`: one checkpoint; Room → Reverb slider scale, chords reverb send, vocals and melody reverb sends only when their locks are off; Echo → chords and hats delay sends; Warmth → chords EQ and the soul/pad lean; no volume changes; One-step undo covers it.
- [ ] Re-point A's `claimsB` C10 (locks) and C12 (mappings) to the whole-song Apply; C12 no longer expects Intensity to change levels (superseded by "never louder").
- [ ] GREEN `c2WholeSong`, A's claims 18/18. Update `docs/DASHBOARD-IMPLEMENTATION-NOTES.md` Phase 2 lines to the new behaviour. Commit.

### Task 6: Release gate, push, prove live

- [ ] Version rc.4 → rc.5; network law; full regression locally (A: layout, a1, a2*, a3*, claims; B: b1*, b2*, b3, b4; C: all); gate at four widths plus live shrink; remove the preview entry; commit; `main` must be `d5aa983`; push; poll live hashes; repeat the gate, C checks, A claims and B checks on live; post the C proof table.
