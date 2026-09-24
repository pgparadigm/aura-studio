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
