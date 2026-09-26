// Aura dashboard sub-project D checks (clip editing). TEST-ONLY; the app never loads this file.
// Every check expects a FRESH load (storage cleared on a separate page first) at 1440 x 900.
import { settle, skipWelcome } from './dashboard-a.qa.js';
const $ = id => document.getElementById(id);
const S = () => window.__auraSuite;
const snap = () => JSON.parse(S().snapshot());
const runs = s => { const o = []; s.forEach((v, i) => { if (v == null) return; const l = o[o.length - 1];
  if (l && l[0] === v && l[2] === i) l[2] = i + 1; else o.push([v, i, i + 1]); }); return o; };
const lane = id => document.querySelector(`.sa-lane[data-lane="${id}"]`);
const clipAt = (id, start) => [...(lane(id) || document).querySelectorAll('.sa-clip')].find(c => +c.dataset.start === start) || null;
const act = name => ($('saClipBar') || document.createElement('div')).querySelector(`[data-act="${name}"]`);
const why = () => (($('saClipWhy') || {}).textContent || '').replace(/\s+/g, ' ').trim();
const pe = (type, x, y, extra = {}) => new PointerEvent(type, Object.assign({ bubbles: true, clientX: x, clientY: y, pointerId: 11, isPrimary: true }, extra));
// A press without movement at `frac` of the clip's width (selects it and marks the bar under the pointer).
async function press(el, frac = 0.5, extra = {}) {
  const r = el.getBoundingClientRect(), x = r.left + r.width * frac, y = r.top + r.height / 2;
  el.dispatchEvent(pe('pointerdown', x, y, extra)); window.dispatchEvent(pe('pointerup', x, y)); await settle(250);
}
// Open a project built from the current one, first reset to a known base (the Intro in pattern 1 for
// 8 bars, patterns 2–6 empty, no Target), then patched (readable .aura names). The reset keeps one
// check from inheriting another's sections when several run on the same page.
async function openWith(patch) {
  await skipWelcome(); await settle(300);
  const f = S().buildFile('QA D', true), P = f.project;
  const z = P.patterns[0].map(() => 0), za = P.accents[0].map(() => 0);
  for (let k = 1; k < P.patterns.length; k++) { P.patterns[k] = z.slice(); P.accents[k] = za.slice(); P.melodies[k] = []; P.lowEnd[k] = []; }
  P.arrangement = arrangement([[0, 8]]); delete P.energy;
  patch(P);
  const r = S().openFile(JSON.parse(JSON.stringify(f)), 'QA D.aura'); await settle(400);
  return !!(r && r.ok);
}
const fill = (n, v) => Array.from({ length: n }, () => v);
const arrangement = parts => { const a = []; parts.forEach(([p, n]) => { for (let k = 0; k < n; k++) a.push(p); }); while (a.length < 32) a.push(null); return a; };

// D1: splitting never overwrites a section that holds music.
export async function d1SplitNeverErases() {
  const mel = [[60, 0, 4, 90], [64, 4, 4, 90]];
  const opened = await openWith(P => { P.melodies[1] = mel.map(n => n.slice()); });
  const s0 = snap(), c = clipAt('drums', 0);
  if (c) await press(c, 0.75, { altKey: true });
  const s1 = snap(), after = runs(s1.song), second = after.find(r => r[1] > 0);
  const intact = JSON.stringify(s1.mel[1]) === JSON.stringify(mel);
  const notIntoMusic = !second || second[0] !== 1;
  // Part two: every other slot holds music, so there is nothing to split into.
  const opened2 = await openWith(P => { for (let k = 1; k < 6; k++) P.melodies[k] = [[60 + k, 0, 2, 90]]; });
  const t0 = snap(), c2 = clipAt('drums', 0); if (c2) await press(c2, 0.5, { altKey: true });
  const t1 = snap();
  const refused = JSON.stringify(t1.song) === JSON.stringify(t0.song) && JSON.stringify(t1.mel) === JSON.stringify(t0.mel);
  const said = (($('toast') || {}).textContent || '') + ' ' + why(), reasoned = /hold music/i.test(said);
  return { pass: opened && opened2 && !!c && intact && notIntoMusic && refused && reasoned, runsAfter: after, melody2: s1.mel[1], intoPattern: second && second[0] + 1, refusedWhenFull: refused, reason: said.trim() };
}

// D1: a split lands at the pressed bar and the new half is an exact copy; one Undo restores.
export async function d1SplitExact() {
  const opened = await openWith(P => {
    P.patterns[1] = P.patterns[0].slice(); P.accents[1] = P.accents[0].slice();
    P.lowEnd[1] = [[36, 0, 2, 90, 1], [38, 8, 2, 80, 0]]; P.melodies[1] = [[67, 2, 2, 85]];
    P.arrangement = arrangement([[0, 4], [1, 4]]);
  });
  const c = clipAt('drums', 4); if (c) await press(c, 0.3);
  const pre = S().snapshot(), b = act('split'); if (b && !b.disabled) b.click(); await settle(300);
  const s = snap(), r = runs(s.song), k = r.length > 2 ? r[2][0] : -1;
  const exact = k >= 0 && ['lo', 'pat', 'acc', 'mel'].every(f => JSON.stringify(s[f][k]) === JSON.stringify(s[f][1]));
  const atPressed = JSON.stringify(r.slice(1)) === JSON.stringify([[1, 4, 5], [k, 5, 8]]);
  $('undoX').click(); await settle(300);
  const restored = S().snapshot() === pre;
  return { pass: opened && !!c && exact && atPressed && restored, runs: r, newPattern: k + 1, exact, atPressedBar: atPressed, oneUndoRestores: restored, bassCopy: k >= 0 && s.lo[k] };
}

// D1: Repeat never pushes a section past bar 32; with room it works and one Undo restores.
export async function d1RepeatNoLoss() {
  const opened = await openWith(P => { P.arrangement = arrangement([[0, 8], [1, 8], [2, 8], [3, 8]]); });
  const s0 = snap().song, ret = S().songDupBlock(0), s1 = snap().song;
  const kept = JSON.stringify(s0) === JSON.stringify(s1);
  const c = clipAt('drums', 0); if (c) await press(c, 0.5);
  const b = act('repeat'), disabled = !!(b && b.disabled), reason = why();
  const opened2 = await openWith(() => {});
  const c2 = clipAt('drums', 0); if (c2) await press(c2, 0.5);
  const pre = S().snapshot(), b2 = act('repeat'); if (b2 && !b2.disabled) b2.click(); await settle(300);
  const grew = JSON.stringify(runs(snap().song)) === JSON.stringify([[0, 0, 16]]);
  $('undoX').click(); await settle(300);
  const restored = S().snapshot() === pre;
  return { pass: opened && opened2 && ret === false && kept && disabled && /fall off/i.test(reason) && grew && restored,
    functionRefused: ret === false, songKept: kept, buttonDisabled: disabled, reason, repeatWithRoom: grew, oneUndoRestores: restored };
}

// D1: Make this one its own, then Remove (closes the gap); one Undo each.
export async function d1OwnRemove() {
  const opened = await openWith(P => { P.patterns[1] = P.patterns[0].slice(); P.arrangement = arrangement([[0, 4], [1, 4], [0, 4]]); });
  const c0 = clipAt('drums', 0); if (c0) await press(c0, 0.5);
  const label = (($('saClipName') || {}).textContent || '').replace(/\s+/g, ' ');
  const c8 = clipAt('drums', 8); if (c8) await press(c8, 0.5);
  const pre = S().snapshot(), bo = act('own'); if (bo && !bo.disabled) bo.click(); await settle(300);
  const s = snap(), r = runs(s.song), k = r.length > 2 ? r[2][0] : -1;
  const own = k > 1 && JSON.stringify(s.pat[k]) === JSON.stringify(s.pat[0]) && / 2$/.test(s.sn[k] || '');
  $('undoX').click(); await settle(300); const ownUndo = S().snapshot() === pre;
  const c4 = clipAt('drums', 4); if (c4) await press(c4, 0.5);
  const pre2 = S().snapshot(), br = act('remove'); if (br && !br.disabled) br.click(); await settle(300);
  const closed = JSON.stringify(runs(snap().song)) === JSON.stringify([[0, 0, 8]]);
  $('undoX').click(); await settle(300); const rmUndo = S().snapshot() === pre2;
  return { pass: opened && /also plays at 9.12/.test(label) && own && ownUndo && closed && rmUndo, label, runsAfterOwn: r, ownIsCopy: own, ownUndo, removeClosesGap: closed, removeUndo: rmUndo };
}

// D4: the drawn Target moves with the bars on Repeat, Remove and B's drag.
export async function d4TargetFollows() {
  const base = P => { P.patterns[1] = P.patterns[0].slice(); P.patterns[2] = P.patterns[0].slice();
    P.arrangement = arrangement([[0, 4], [1, 4], [2, 4]]);
    P.energy = { t: fill(4, 20).concat(fill(4, 50), fill(4, 80), fill(20, 35)), p: {} }; };
  const T = () => S().energyState().t.slice(0, 16);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const o1 = await openWith(base); S().songDupBlock(4); await settle(300);
  const rep = T(), repOk = same(rep.slice(0, 16), fill(4, 20).concat(fill(8, 50), fill(4, 80)));
  const o2 = await openWith(base); const rm = S().songRemoveBlk ? S().songRemoveBlk(0) : null; await settle(300);
  const rmT = T(), rmOk = rm === true && same(rmT.slice(0, 8), fill(4, 50).concat(fill(4, 80)));
  const o3 = await openWith(base); let dragOk = false, dragT = null;
  const c = clipAt('keys', 8);
  if (c) { const r = c.getBoundingClientRect(), body = c.parentElement.getBoundingClientRect(), per = body.width / 12, x = r.left + 10, y = r.top + r.height / 2;
    c.dispatchEvent(pe('pointerdown', x, y)); window.dispatchEvent(pe('pointermove', x + 4 * per, y)); await settle(200);
    window.dispatchEvent(pe('pointerup', x + 4 * per, y)); await settle(300);
    dragT = T(); dragOk = same(runs(snap().song), [[0, 0, 4], [1, 4, 8], [2, 12, 16]]) && same(dragT.slice(12, 16), fill(4, 80)); }
  return { pass: o1 && o2 && o3 && repOk && rmOk && dragOk, repeat: { ok: repOk, t: rep }, remove: { ok: rmOk, returned: rm, t: rmT }, drag: { ok: dragOk, t: dragT } };
}

// D2: double-click opens the editor that holds the lane's notes.
export async function d2Editors() {
  const opened = await openWith(P => { P.melodies[0] = [[72, 0, 4, 90]]; });
  const tab = () => (document.querySelector('#studioETabs .etab.on') || {}).dataset?.ed;
  const focusRow = () => (document.querySelector('#studioEdHost #grid tr.dash-focus') || {}).dataset?.row || null;
  const note = () => ((document.querySelector('#studioEdHost .ed-note') || {}).textContent || '').replace(/\s+/g, ' ');
  const dbl = async id => { const c = clipAt(id, 0); if (!c) return false; c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await settle(300); return true; };
  const out = {};
  for (const [id, ed, row] of [['drums', 'grid', 'kick'], ['keys', 'grid', 'deg0'], ['texture', 'grid', 'openhat'], ['melody', 'piano', null]]) {
    const had = await dbl(id);
    out[id] = { had, tab: tab(), row: focusRow(), note: note().slice(0, 60), ok: had && tab() === ed && (row ? focusRow() === row : true) && /Intro.*bars 1.8/i.test(note()) };
  }
  const before = tab(); const hadBass = await dbl('bass'); const msg = (($('toast') || {}).textContent || '');
  out.bass = { had: hadBass, tab: tab(), msg, ok: hadBass && tab() === before && /no bass note editor/i.test(msg) };
  return { pass: opened && Object.values(out).every(v => v.ok), ...out };
}

// D3: the Voice lane shows the take's clips, edits go through the take's own functions and history,
// and nothing about the project changes.
export async function d3Voice() {
  await skipWelcome(); await settle(300);
  const sr = 44100, buf = new AudioBuffer({ length: sr * 4, numberOfChannels: 1, sampleRate: sr }), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = 0.2 * Math.sin(2 * Math.PI * 220 * i / sr);
  const proj0 = S().snapshot();
  S().takeInstall(buf, 0); S().takeSplit(2); await settle(300);
  const bpm = +$('bpm').value, secBar = 240 / bpm, used = Math.max(8, snap().song.reduce((m, v, i) => v != null ? i + 1 : m, 0));
  const vc = () => [...(lane('voice') || document).querySelectorAll('.sa-clip')];
  const tc = S().takeClips(), drawn = vc();
  const placed = drawn.length === tc.length && tc.every(c => { const el = drawn.find(e => +e.dataset.takeId === c.id); if (!el) return false;
    const want = Math.max(0, c.at) / secBar / used * 100; return Math.abs(parseFloat(el.style.left) - want) < 0.5; });
  const depth = () => S().takeHistoryDepth().past;
  let d0 = depth(), c0 = drawn.find(e => +e.dataset.takeId === tc[0].id);
  if (c0) await press(c0, 0.5);
  // rc.12 keeps take edits (on this device and in the .aura file), so the bar says they are kept, and no longer "not saved"
  const barText = why() + ' ' + (($('saClipName') || {}).textContent || ''), kept = /kept with the take/i.test(barText) && !/not saved/i.test(barText);
  const fi = act('fadein'); if (fi) fi.click(); await settle(200);
  const fadeOk = S().takeClips()[0].fadeIn === 0.12 && depth() === d0 + 1;
  // Body drag of one bar.
  d0 = depth(); const at0 = S().takeClips()[0].at; c0 = vc().find(e => +e.dataset.takeId === tc[0].id);
  let moveOk = false;
  if (c0) { const r = c0.getBoundingClientRect(), body = c0.parentElement.getBoundingClientRect(), per = body.width / used, x = r.left + r.width / 2, y = r.top + r.height / 2;
    c0.dispatchEvent(pe('pointerdown', x, y)); window.dispatchEvent(pe('pointermove', x + per, y)); await settle(150);
    window.dispatchEvent(pe('pointerup', x + per, y)); await settle(300);
    const moved = S().takeClips().find(c => c.id === tc[0].id).at - at0; moveOk = Math.abs(moved - secBar) < secBar * 0.03 && depth() === d0 + 1; }
  c0 = vc().find(e => +e.dataset.takeId === tc[0].id); if (c0) await press(c0, 0.5);
  const n0 = S().takeClips().length; const vs = act('vsplit'); if (vs) vs.click(); await settle(200);
  const splitOk = S().takeClips().length === n0 + 1;
  const vu = act('vundo'); if (vu) vu.click(); await settle(200);
  const undoOk = S().takeClips().length === n0;
  const projSame = S().snapshot() === proj0;
  return { pass: placed && kept && fadeOk && moveOk && splitOk && undoOk && projSame, placed, kept, fadeIn: fadeOk, moveOneBarOneEntry: moveOk, split: splitOk, undoClipEdit: undoOk, projectUnchanged: projSame };
}

// D3: the Atmosphere lane is drawn where the reference plays; the part and whole-file controls work.
// The reference is a synthetic 3 s buffer through refInstall (the fixture shim that stands in for an import).
export async function d3Atmosphere() {
  await skipWelcome(); await settle(300);
  const sr = 44100, buf = new AudioBuffer({ length: sr * 3, numberOfChannels: 1, sampleRate: sr }), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = 0.1 * Math.sin(2 * Math.PI * 110 * i / sr);
  S().refInstall(buf, 0); await settle(300);
  const el = () => (lane('atmosphere') || document).querySelector('.sa-clip');
  const bpm = +$('bpm').value, used = Math.max(8, snap().song.reduce((m, v, i) => v != null ? i + 1 : m, 0)), spb = 240 / bpm;
  const once = S().refRunsOnce(), a = el();
  const modeOk = !!a && a.dataset.mode === (once ? 'once' : 'loop');
  const wantW = once ? Math.max(1.5, Math.min(used, 3 / S().samplePlaybackRate() / spb) / used * 100) : 100;
  const widthOk = !!a && Math.abs(parseFloat(a.style.width) - wantW) < 0.5;
  S().refRegionSet(0.5, 1.5); await settle(300);
  const loopSec = 1.0 / S().samplePlaybackRate(), usedSec = used * spb;
  const a2 = el(), seams = a2 ? a2.querySelectorAll('.seam').length : -1, wantSeams = Math.ceil(usedSec / loopSec - 1e-9) - 1;
  const loopOk = !!a2 && a2.dataset.mode === 'loop' && seams === wantSeams;
  if (a2) await press(a2, 0.5);
  const bp = act('part'); if (bp) bp.click(); await settle(300);
  const sect = document.querySelector('#studioEdHost #refSect'), partOk = !!sect && !sect.hidden;
  const bw = act('whole'); if (bw) bw.click(); await settle(300);
  const wholeOk = S().refRegionRead().whole === true;
  return { pass: modeOk && widthOk && loopOk && partOk && wholeOk, runsOnce: once, mode: a && a.dataset.mode, width: a && a.style.width, wantWidth: wantW.toFixed(2) + '%', modeOk, widthOk, seams, wantSeams, loopOk, partOpensEditor: partOk, wholeFile: wholeOk };
}

// D0: the guidance line reads the section's own range.
export async function d0Guidance() {
  await skipWelcome(); await settle(300);
  const setRange = (id, v) => { const e = $(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  const sec = document.querySelector('#saSecs .sa-sec'); if (sec) sec.click(); await settle(200);
  setRange('drInt', 90); await settle(300); $('drApply').click(); await settle(400); const hi = $('drGuide').textContent;
  setRange('drInt', 5); await settle(300); $('drApply').click(); await settle(400); const lo = $('drGuide').textContent;
  return { pass: !/more lift/i.test(hi) && /more lift/i.test(lo), at90: hi, at5: lo };
}
