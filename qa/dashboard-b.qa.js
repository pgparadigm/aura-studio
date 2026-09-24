// Aura dashboard sub-project B checks. TEST-ONLY; the app never loads this file.
import { settle, skipWelcome } from './dashboard-a.qa.js';
const $ = id => document.getElementById(id);
const S = () => window.__auraSuite;
const song = () => JSON.parse(S().snapshot()).song;
const runs = s => { const o = []; s.forEach((v, i) => { if (v == null) return; const l = o[o.length - 1];
  if (l && l.pat === v && l.end === i) l.end = i + 1; else o.push({ pat: v, start: i, end: i + 1 }); }); return o; };
const filled = s => s.filter(v => v != null).length;
const lane = id => document.querySelector(`.sa-lane[data-lane="${id}"]`);
const pe = (type, x, y) => new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 7, isPrimary: true });
const bars = () => Math.max(8, song().reduce((m, v, i) => v != null ? i + 1 : m, 0));
// The keys clip of the run starting at `start`, and its geometry.
function clipAt(start) { const c = [...(lane('keys') || document).querySelectorAll('.sa-clip')].find(e => +e.dataset.start === start);
  if (!c) return null; const r = c.getBoundingClientRect(), br = c.parentElement.getBoundingClientRect();
  return { el: c, x: r.left + Math.min(20, r.width / 3), y: r.top + r.height / 2, perBar: br.width / bars(), rz: c.querySelector('.rsz') }; }

// B1: one continuous drag +2, +5, +12, then back left past the origin. Every step keeps bars and runs;
// the whole gesture is ONE undo entry; one Undo restores the pre-drag project exactly.
export async function b1Drag() {
  await skipWelcome(); await settle(300);
  const s0 = song(), f0 = filled(s0), n0 = runs(s0).length, snap0 = S().snapshot(), d0 = S().undoDepth();
  const c = clipAt(runs(s0)[0].start); if (!c) return { pass: false, why: 'no keys clip' };
  const steps = [];
  c.el.dispatchEvent(pe('pointerdown', c.x, c.y));
  for (const k of [2, 5, 12, -3]) { window.dispatchEvent(pe('pointermove', c.x + k * c.perBar, c.y)); await settle(60);
    const s = song(); steps.push({ k, filled: filled(s), runs: runs(s).length, at: runs(s).map(r => [r.start, r.end]) }); }
  window.dispatchEvent(pe('pointerup', c.x - 3 * c.perBar, c.y)); await settle(300);
  const d1 = S().undoDepth(), movedEntry = d1 - d0;
  $('undoX').click(); await settle(400);
  const restored = S().snapshot() === snap0;
  const stepsOk = steps.every(t => t.filled === f0 && t.runs === n0);
  return { pass: stepsOk && movedEntry === 1 && restored, f0, n0, steps, undoEntries: movedEntry, restoredByOneUndo: restored };
}
// Aura's own demo arrangement (Intro, Verse x2, Chorus x2, Verse, Chorus x2: every bar 1-8 filled),
// loaded through the Welcome's "Hear a finished example", so a run has neighbours. Call on a FRESH load.
export async function loadDemoArrangement() {
  const d = document.querySelector('.wlink[data-w="demo"]'); if (!d) return false;
  d.click(); await settle(600); await skipWelcome(); await settle(300); return runs(song()).length >= 3;
}
// A drag released where it began writes no undo entry.
export async function b1NoOp() {
  await skipWelcome(); await settle(300);
  const s0 = song(), d0 = S().undoDepth(), c = clipAt(runs(s0)[0].start);
  c.el.dispatchEvent(pe('pointerdown', c.x, c.y)); window.dispatchEvent(pe('pointermove', c.x + 3 * c.perBar, c.y)); await settle(60);
  window.dispatchEvent(pe('pointermove', c.x, c.y)); await settle(60); window.dispatchEvent(pe('pointerup', c.x, c.y)); await settle(300);
  const sameSong = JSON.stringify(song()) === JSON.stringify(s0);
  return { pass: sameSong && S().undoDepth() === d0, undoAdded: S().undoDepth() - d0, sameSong };
}
// A drag onto an occupied run holds the clip: nothing moves, nothing is lost, no undo entry.
// Run on a fresh load after loadDemoArrangement().
export async function b1Blocked() {
  const s0 = song(), d0 = S().undoDepth(), r = runs(s0), c = clipAt(r[1].start);
  if (!c) return { pass: false, why: 'no keys clip on the second run', runs: r };
  c.el.dispatchEvent(pe('pointerdown', c.x, c.y));
  for (const k of [1, 2, -1]) { window.dispatchEvent(pe('pointermove', c.x + k * c.perBar, c.y)); await settle(60); }
  window.dispatchEvent(pe('pointerup', c.x - c.perBar, c.y)); await settle(300);
  const sameSong = JSON.stringify(song()) === JSON.stringify(s0);
  return { pass: sameSong && S().undoDepth() === d0 && filled(song()) === filled(s0), sameSong, undoAdded: S().undoDepth() - d0, runs: runs(song()).map(x => [x.pat, x.start, x.end]) };
}
// A gesture ended by pointercancel still writes its one entry, and the next edit autosaves normally.
export async function b1Cancel() {
  await skipWelcome(); await settle(300);
  const s0 = song(), d0 = S().undoDepth(), c = clipAt(runs(s0)[0].start);
  c.el.dispatchEvent(pe('pointerdown', c.x, c.y)); window.dispatchEvent(pe('pointermove', c.x + 4 * c.perBar, c.y)); await settle(60);
  window.dispatchEvent(pe('pointercancel', c.x + 4 * c.perBar, c.y)); await settle(300);
  const afterCancel = S().undoDepth() - d0;
  const bpm = $('bpm'); bpm.value = String(+bpm.value + 1); bpm.dispatchEvent(new Event('change', { bubbles: true })); await settle(300);
  const afterEdit = S().undoDepth() - d0, saved = JSON.parse(S().autosaveRaw()).bpm === +bpm.value;
  return { pass: afterCancel === 1 && afterEdit === 2 && saved, afterCancel, afterEdit, autosavedAfter: saved };
}
// Trailing-edge resize: one undo entry for the gesture; only that run's length changes.
export async function b1Resize() {
  await skipWelcome(); await settle(300);
  const s0 = song(), r0 = runs(s0)[0], d0 = S().undoDepth(), c = clipAt(r0.start); if (!c || !c.rz) return { pass: false, why: 'no handle' };
  const b = c.rz.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
  c.rz.dispatchEvent(pe('pointerdown', x, y));
  for (const k of [1, 2, 3]) { window.dispatchEvent(pe('pointermove', x + k * c.perBar, y)); await settle(60); }
  window.dispatchEvent(pe('pointerup', x + 3 * c.perBar, y)); await settle(300);
  const r1 = runs(song())[0];
  return { pass: S().undoDepth() - d0 === 1 && r1.start === r0.start && (r1.end - r1.start) === (r0.end - r0.start) + 3,
    undoEntries: S().undoDepth() - d0, before: r0, after: r1 };
}

// B2: bar b is at the same x on the section row, the energy canvas, every lane body and the playhead.
export async function b2Grid() {
  await skipWelcome(); await settle(300);
  const n = bars(), xs = b => {
    const at = el => { const r = el.getBoundingClientRect(); return r.left + (b / n) * r.width; };
    const lanesX = [...document.querySelectorAll('#saLanes .sa-lane-body')].map(at);
    return { secs: at($('saSecs')), energy: at($('saEnergyCanvas')), laneMin: Math.min(...lanesX), laneMax: Math.max(...lanesX) }; };
  const rows = [0, 4, n - 1].map(b => ({ bar: b + 1, ...xs(b) }));
  const aligned = rows.every(r => Math.abs(r.secs - r.laneMin) <= 1 && Math.abs(r.energy - r.laneMin) <= 1 && r.laneMax - r.laneMin <= 1);
  const ph = $('saPlayhead').getBoundingClientRect(), secsTop = $('saSecs').getBoundingClientRect().top;
  const lastLane = [...document.querySelectorAll('#saLanes .sa-lane')].pop().getBoundingClientRect();
  const spans = ph.top <= secsTop + 1 && ph.bottom >= lastLane.bottom - 1;
  // playhead x at bar 1 while stopped
  const phX = ph.left + ph.width / 2, bar1 = rows[0].laneMin;
  return { pass: aligned && spans && Math.abs(phX - bar1) <= 1.5, rows, playheadSpan: [Math.round(ph.top), Math.round(ph.bottom)], sectionsTop: Math.round(secsTop), lastLaneBottom: Math.round(lastLane.bottom), playheadX: Math.round(phX), bar1X: Math.round(bar1) };
}
// Loop on a later section: the playhead moves inside that section's bars. Run on a fresh load after
// loadDemoArrangement(), so there is a later section to loop.
export async function b2Loop() {
  const r = runs(song()); if (r.length < 2) return { pass: false, why: 'needs two or more sections', runs: r };
  const target = r[r.length - 1];
  const secBtn = [...$('saSecs').querySelectorAll('.sa-sec')].find(b => +b.dataset.start === target.start); if (secBtn) secBtn.click(); await settle();
  if ($('dashLoop').getAttribute('aria-pressed') !== 'true') $('dashLoop').click(); await settle();
  $('play').click(); await settle(1500);
  const lb = document.querySelector('#saLanes .sa-lane-body').getBoundingClientRect(), n = bars();
  const ph = $('saPlayhead').getBoundingClientRect(), x = ph.left + ph.width / 2;
  const lo = lb.left + (target.start / n) * lb.width - 1, hi = lb.left + (target.end / n) * lb.width + 1;
  if ($('play').classList.contains('on')) $('play').click(); $('dashLoop').click(); await settle();
  return { pass: x >= lo && x <= hi, playheadX: Math.round(x), sectionX: [Math.round(lo), Math.round(hi)], section: target };
}

// B3: empty Atmosphere and Voice show nothing; an import appears and clears without a reload.
export async function b3Lanes() {
  await skipWelcome(); await settle(300);
  const count = id => lane(id) ? lane(id).querySelectorAll('.sa-clip').length : -1;
  const empty = { atmosphere: count('atmosphere'), voice: count('voice') };
  $('importDemo').click();
  for (let i = 0; i < 40 && !S().hasSample(); i++) await settle(500);
  await settle(800);
  const withImport = count('atmosphere');
  $('smpClear').click(); await settle(500);
  const cleared = count('atmosphere');
  return { pass: empty.atmosphere === 0 && empty.voice === 0 && withImport === 1 && cleared === 0, empty, withImport, cleared };
}

// B4: after a drag the moved clip is selected and the rail names its bars; a lane name is a button
// that Tab reaches and Enter selects.
export async function b4Select() {
  await skipWelcome(); await settle(300);
  const r0 = runs(song())[0], c = clipAt(r0.start);
  c.el.dispatchEvent(pe('pointerdown', c.x, c.y)); window.dispatchEvent(pe('pointermove', c.x + 4 * c.perBar, c.y)); await settle(60);
  window.dispatchEvent(pe('pointerup', c.x + 4 * c.perBar, c.y)); await settle(300);
  const on = document.querySelector('.sa-clip.on'), meta = ($('drSecMeta') || {}).textContent || '';
  const moved = on && +on.dataset.start === r0.start + 4 && meta.includes('BARS ' + (r0.start + 5));
  const nm = lane('bass').querySelector('.sa-lane-hd .nm');
  // A native button is in the tab order (tabIndex 0) and Enter or Space fires its click; a scripted
  // keydown cannot press it, so the click stands in for the key press here.
  const isButton = nm && nm.tagName === 'BUTTON' && nm.tabIndex === 0;
  if (isButton) { nm.focus(); nm.click(); await settle(); }
  const focused = document.activeElement === nm, sel = (document.querySelector('.sa-lane.on') || {}).dataset?.lane;
  $('undoX').click(); await settle(300);
  return { pass: !!moved && isButton && focused && sel === 'bass', movedSelected: !!moved, rail: meta, laneNameIsTabbableButton: isButton, focused, selected: sel };
}
