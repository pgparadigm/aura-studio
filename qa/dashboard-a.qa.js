// Aura dashboard sub-project A checks. TEST-ONLY: the verifier imports this into a page served from
// the worktree. The app never loads it. Every check returns {pass, ...evidence}.
const $ = id => document.getElementById(id);
const S = () => window.__auraSuite;
export const settle = async (ms = 250) => {
  await new Promise(r => setTimeout(r, ms));
  document.getAnimations().forEach(a => { try { a.finish(); } catch (e) {} });   // a hidden pane freezes transitions
  await new Promise(r => setTimeout(r, 0));   // not requestAnimationFrame: a hidden page may never fire it
};
const box = el => { const r = el.getBoundingClientRect();
  return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
const shown = el => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; };
export async function skipWelcome() { const w = $('welcome'); if (w && getComputedStyle(w).display !== 'none') { $('wSkip').click(); await settle(500); } }
const setRange = (id, v) => { const el = $(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const esc = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

// Ship gate. Call on a FRESH load (storage cleared), before anything else.
export async function layout() {
  const wc = box($('wClose'));
  const out = { innerW: innerWidth, docW: document.documentElement.scrollWidth, wClose: [wc.l, wc.r], wCloseOnScreen: wc.w > 0 && wc.l >= 0 && wc.r <= innerWidth,
    ver: (document.body.innerHTML.match(/13\.8\.0-rc\.\d+/) || [])[0] };
  await skipWelcome();
  out.afterSkipDocW = document.documentElement.scrollWidth;
  out.pass = out.docW <= out.innerW && out.afterSkipDocW <= innerWidth && out.wCloseOnScreen;
  return out;
}

// A1: Sounds shows at 768-1119, Shape at 768-1399; each opens its panel on screen, its close shows,
// the close and Escape both close it, no sideways scroll.
export async function a1() {
  await skipWelcome();
  const W = innerWidth, sb = $('saSounds'), sh = $('saShape');
  const want = { sounds: W >= 768 && W < 1120, shape: W >= 768 && W < 1400 };
  const out = { W, soundsShown: shown(sb), shapeShown: shown(sh) };
  let ok = out.soundsShown === want.sounds && out.shapeShown === want.shape;
  for (const [name, btn, panel, close] of [['sounds', sb, $('browser'), $('vibesClose')], ['shape', sh, $('inspect'), $('inspectClose')]]) {
    if (!want[name]) continue;
    if (panel.classList.contains('open')) { close.click(); await settle(); }
    const r = { btnH: box(btn).h };
    btn.click(); await settle();
    Object.assign(r, { open: panel.classList.contains('open'), onScreen: shown(panel), expanded: btn.getAttribute('aria-expanded'), closeShown: shown(close), closeH: shown(close) ? box(close).h : 0, docW: document.documentElement.scrollWidth });
    close.click(); await settle(); r.closedByX = !panel.classList.contains('open'); r.expandedAfter = btn.getAttribute('aria-expanded');
    btn.click(); await settle(); esc(); await settle(); r.closedByEsc = !panel.classList.contains('open');
    out[name] = r;
    ok = ok && r.btnH >= 44 && r.open && r.onScreen && r.expanded === 'true' && r.closeShown && r.closeH >= 44 && r.docW <= innerWidth && r.closedByX && r.expandedAfter === 'false' && r.closedByEsc;
  }
  out.pass = ok; return out;
}

// For the REAL click: opens the panel and returns its close button's centre in CSS px plus the
// viewport width, so the verifier can convert to the screenshot's coordinate frame.
export async function closeTarget(name) {
  await skipWelcome();
  const btn = name === 'sounds' ? $('saSounds') : $('saShape'), panel = name === 'sounds' ? $('browser') : $('inspect');
  const close = name === 'sounds' ? $('vibesClose') : $('inspectClose');
  if (!panel.classList.contains('open')) { btn.click(); await settle(); }
  const b = box(close);
  return { open: panel.classList.contains('open'), cx: (b.l + b.r) / 2, cy: (b.t + b.b) / 2, innerW: innerWidth, innerH: innerHeight, hit: (document.elementFromPoint((b.l + b.r) / 2, (b.t + b.b) / 2) || {}).id };
}
export function isOpen(name) { return (name === 'sounds' ? $('browser') : $('inspect')).classList.contains('open'); }

// A2: draw a stroke on the energy lane with real pointer events; the curve must be saved.
export async function a2Draw(pts = [[0.1, 0.2], [0.3, 0.8], [0.55, 0.3]]) {
  await skipWelcome();
  const c = $('saEnergyCanvas'), r = c.getBoundingClientRect();
  const ev = (type, x, y) => new PointerEvent(type, { bubbles: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height, pointerId: 1, isPrimary: true });
  c.dispatchEvent(ev('pointerdown', ...pts[0]));
  for (const p of pts.slice(1)) window.dispatchEvent(ev('pointermove', ...p));
  window.dispatchEvent(ev('pointerup', ...pts[pts.length - 1]));
  await settle(700);                                   // autosaveSoon waits 350 ms
  const st = S().energyState();
  let saved = null; try { saved = JSON.parse(S().autosaveRaw()).en || null; } catch (e) {}
  sessionStorage.setItem('qa-a2', JSON.stringify(st.t));
  return { pass: !!(st.touched && saved && JSON.stringify(saved.t) === JSON.stringify(st.t)), touched: st.touched, t: st.t, savedT: saved && saved.t };
}
// After a reload (or opening a share link): the curve equals what a2Draw stored.
export async function a2Expect(expectT) {
  const want = expectT || JSON.parse(sessionStorage.getItem('qa-a2') || 'null');
  const st = S().energyState();
  return { pass: !!want && st.touched && JSON.stringify(st.t) === JSON.stringify(want), got: st.t, want };
}
// .aura round trip through the shipped build and open paths.
export async function a2File() {
  const before = S().energyState();
  const file = S().buildFile('QA energy', true);
  const inFile = !!(file.project && file.project.energy && Array.isArray(file.project.energy.t));
  await a2Draw([[0.2, 0.9], [0.8, 0.9]]);              // change the curve so the file must bring it back
  const changed = JSON.stringify(S().energyState().t) !== JSON.stringify(before.t);
  const r = S().openFile(JSON.parse(JSON.stringify(file)), 'QA energy.aura');
  const after = S().energyState();
  return { pass: inFile && changed && r.ok && JSON.stringify(after.t) === JSON.stringify(before.t) && JSON.stringify(after.p) === JSON.stringify(before.p),
    inFile, changed, opened: r, schema: file.schemaVersion };
}
// A project that never touched energy writes no `en`, and requiredSchema is unchanged by energy.
export async function a2NoTouch() {
  await skipWelcome();
  const keys = S().serializedKeys(), schema = S().requiredSchema(), st = S().energyState();
  return { pass: !keys.includes('en') && st.touched === false, keys: keys.includes('en'), schema, touched: st.touched };
}

// A3: Apply, then One-step undo, restores the exact prior project.
export async function a3ApplyUndo() {
  await skipWelcome();
  setRange('drInt', 90); setRange('drWarm', 85); setRange('drMove', 70); setRange('drSpace', 80); await settle(600);
  const before = S().snapshot();
  $('drApply').click(); await settle(400);
  const afterApply = S().snapshot(), undoEnabled = !$('drUndo').disabled;
  $('drUndo').click(); await settle(400);
  const afterUndo = S().snapshot();
  return { pass: afterApply !== before && undoEnabled && afterUndo === before, applyChanged: afterApply !== before, undoEnabled, restoredExactly: afterUndo === before };
}
// After Apply and one other edit, One-step undo steps aside.
export async function a3OtherEdit() {
  await skipWelcome();
  setRange('drSpace', 30); await settle(600);
  $('drApply').click(); await settle(400);
  const bpm = $('bpm'); bpm.value = String(+bpm.value + 3); bpm.dispatchEvent(new Event('change', { bubbles: true })); await settle(300);
  const disabled = $('drUndo').disabled, before = S().snapshot();
  $('drUndo').click(); await settle(300);
  return { pass: disabled && S().snapshot() === before, disabled, unchanged: S().snapshot() === before, title: $('drUndo').title };
}
// A drawn stroke is one normal Undo.
export async function a3DrawUndo() {
  await skipWelcome();
  await settle(400);
  const before = S().snapshot(), depth0 = S().undoDepth();
  await a2Draw([[0.15, 0.1], [0.45, 0.95]]);
  const afterDraw = S().snapshot();
  $('undoX').click(); await settle(400);
  return { pass: afterDraw !== before && S().snapshot() === before, drew: afterDraw !== before, reverted: S().snapshot() === before, depth0, depthAfterDraw: S().undoDepth() };
}
// Preview never reaches the saved project, even when something else autosaves mid-preview.
export async function a3PreviewNoLeak() {
  await skipWelcome();
  setRange('drSpace', 95); setRange('drMove', 90); await settle(600);
  const pre = JSON.parse(S().snapshot());
  $('drPreview').click(); await settle(300);
  const started = $('drPreview').getAttribute('aria-pressed') === 'true';   // a clean result means nothing if no preview ran
  const bpm = $('bpm'); bpm.value = String(+bpm.value + 2); bpm.dispatchEvent(new Event('change', { bubbles: true })); await settle(300);
  const saved = JSON.parse(S().autosaveRaw());
  const pb = $('play'); if (pb && pb.classList.contains('on')) pb.click();   // Stop
  await settle(300);
  const after = JSON.parse(S().snapshot());
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // serialize() hides preview values by design, so "clean after Stop" alone cannot tell whether Stop
  // really ended the preview; the button state and the live chords channel can.
  const ended = $('drPreview').getAttribute('aria-pressed') !== 'true';
  return { pass: started && same(saved.mx, pre.mx) && saved.rv === pre.rv && same(after.mx, pre.mx) && after.rv === pre.rv && ended,
    previewStarted: started, savedMxClean: same(saved.mx, pre.mx), savedRvClean: saved.rv === pre.rv, afterStopClean: same(after.mx, pre.mx) && after.rv === pre.rv, previewEndedByStop: ended };
}

// ---------------------------------------------------------------------------------------------
// A4: one row per claim in docs/DASHBOARD-IMPLEMENTATION-NOTES.md. Run each part on a FRESH load
// at 1440x900 (every column showing). Each row carries the measurement that decided it.
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const mx = () => JSON.parse(S().snapshot()).mx;             // GROUPS order: kick snare hats bass chords melody vocals sample
const G = { kick: 0, snare: 1, hats: 2, bass: 3, chords: 4, melody: 5, vocals: 6, sample: 7 };
const R = { vol: 0, pan: 1, mute: 2, solo: 3, lo: 4, mid: 5, hi: 6, rev: 7, dly: 8 };
const lane = id => document.querySelector(`.sa-lane[data-lane="${id}"]`);
const selStrips = () => [...document.querySelectorAll('#mixer .strip[data-dash-sel]')].map(s => txt(s.querySelector('h4,.sname,.strip-name,b') || s).slice(0, 12));
const pe = (type, x, y, id = 3) => new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: id, isPrimary: true });

export async function claimsA() {
  await skipWelcome();
  const rows = [], row = (id, claim, pass, ev) => rows.push({ id, claim, pass: !!pass, ev });
  const tabs = [...document.querySelectorAll('#studioETabs .etab')].map(txt);
  row('C1', 'Studio: Sounds, Arrangement (sections, energy, lanes), 5 editor tabs, Shape rail',
    shown($('browser')) && shown($('studioArr')) && shown($('saSecs')) && shown($('saEnergyCanvas')) && shown($('saLanes')) && shown($('inspect')) && shown($('dashRail'))
      && ['Mixer', 'Piano roll', 'Lyrics', 'Vocal coach', 'Perform'].every(t => tabs.some(x => x.toLowerCase() === t.toLowerCase())),
    { tabs, lanes: [...document.querySelectorAll('.sa-lane')].map(l => l.dataset.lane) });
  document.querySelector('#modeSwitch button[data-m="guided"]').click(); await settle(500);
  const g = { arr: getComputedStyle($('studioArr')).display, rail: shown($('rail')), wbody: getComputedStyle(document.querySelector('.wbody')).display };
  document.querySelector('#modeSwitch button[data-m="studio"]').click(); await settle(500);
  row('C2', 'Guided keeps the step rail and rooms; dashboard hidden', g.arr === 'none' && g.rail && g.wbody !== 'none', g);
  const meta = txt($('dashMeta')), segMode = () => (document.querySelector('#modeSeg button.on') || {}).dataset?.mode;
  const m0 = segMode(); $('dashLoop').click(); await settle(); const m1 = segMode(), p1 = $('dashLoop').getAttribute('aria-pressed');
  $('dashLoop').click(); await settle(); const m2 = segMode();
  row('C3', 'Header: "Saved on this device", Key/Meter/Pos, Loop on = pattern, off = song',
    /saved on this device/i.test(document.body.innerText) && /Key/.test(meta) && /Meter/.test(meta) && /Pos/.test(meta) && m1 === 'pattern' && m2 === 'song',
    { meta, headerModeBeforeOnOff: [m0, m1, m2], loopPressedWhenOn: p1 });
  row('C4', 'Version bumped (notes say 13.8.0-rc.1)', /13\.8\.0-rc\.\d/.test(document.body.innerHTML), { ver: (document.body.innerHTML.match(/13\.8\.0-rc\.\d/) || [])[0] });
  lane('bass').querySelector('.sa-lane-hd').click(); await settle();
  const s1 = { laneOn: (document.querySelector('.sa-lane.on') || {}).dataset?.lane, strips: selStrips(), track: txt($('drTrackName')) };
  const clip = lane('drums') && lane('drums').querySelector('.sa-clip');
  if (clip) { const r = clip.getBoundingClientRect(); clip.dispatchEvent(pe('pointerdown', r.left + r.width / 2, r.top + r.height / 2)); window.dispatchEvent(pe('pointerup', r.left + r.width / 2, r.top + r.height / 2)); await settle(); }
  const s2 = { clipOn: !!document.querySelector('.sa-clip.on'), laneOn: (document.querySelector('.sa-lane.on') || {}).dataset?.lane, strips: selStrips(), track: txt($('drTrackName')) };
  row('C5', 'Lane or clip selection highlights lane, mixer strips, rail track',
    s1.laneOn === 'bass' && s1.strips.length >= 1 && /bass/i.test(s1.track) && s2.clipOn && s2.laneOn === 'drums' && s2.strips.length >= 3, { lane: s1, clip: s2 });
  // Start from a different chord sound, or "the preset set soul" proves nothing: a new project is already soul.
  const csSel = $('chordStyle'); csSel.value = 'pad'; csSel.dispatchEvent(new Event('change', { bubbles: true })); await settle(300);
  lane('bass').querySelector('.sa-lane-hd').click(); await settle();
  const csBefore = JSON.parse(S().snapshot()).cs, laneBefore = (document.querySelector('.sa-lane.on') || {}).dataset?.lane;
  const wk = document.querySelector('.feat-card[data-preset="warm-keys"]');
  if (wk) { (wk.querySelector('.feat-main,.fc-main,b,h4') || wk).click(); await settle(400); }
  const cs = JSON.parse(S().snapshot()).cs;
  row('C6', 'Warm keys preset: Keys lane, Soft Rhodes (soul), Chords strip', !!wk && csBefore === 'pad' && laneBefore === 'bass' && (document.querySelector('.sa-lane.on') || {}).dataset?.lane === 'keys' && cs === 'soul' && selStrips().some(t => /chord/i.test(t)),
    { found: !!wk, before: { chordStyle: csBefore, lane: laneBefore }, laneOn: (document.querySelector('.sa-lane.on') || {}).dataset?.lane, chordStyle: cs, strips: selStrips(), track: txt($('drTrackName')) });
  return rows;
}

export async function claimsB() {
  await skipWelcome();
  const rows = [], row = (id, claim, pass, ev) => rows.push({ id, claim, pass: !!pass, ev });
  // C7 playhead
  const ph = $('saPlayhead'), l0 = ph.style.left; $('play').click(); await settle(2500); const l1 = ph.style.left; await settle(1500); const l2 = ph.style.left;
  if ($('play').classList.contains('on')) $('play').click(); await settle();
  const phB = ph.getBoundingClientRect(), laB = $('saLanes').getBoundingClientRect(), enB = $('saEnergy').getBoundingClientRect();
  const covers = phB.top <= enB.top + 2 && phB.bottom >= laB.bottom - 2;
  row('C7', 'Shared playhead moves across energy AND lanes', (l1 !== l0 || l2 !== l1) && covers,
    { left: [l0, l1, l2], moves: l1 !== l0 || l2 !== l1, playheadY: [Math.round(phB.top), Math.round(phB.bottom)], energyY: [Math.round(enB.top), Math.round(enB.bottom)], lanesY: [Math.round(laB.top), Math.round(laB.bottom)], coversLanes: covers,
      gridX: { energy: [Math.round(enB.left), Math.round(enB.right)], lanes: [Math.round(laB.left), Math.round(laB.right)] } });
  // C8 draw vs measured
  const t0 = JSON.stringify(S().energyState().t); await a2Draw([[0.05, 0.3], [0.25, 0.7]]); const t1 = JSON.stringify(S().energyState().t);
  const leg = txt(document.querySelector('.sa-leg'));
  row('C8', 'Drawable Target curve vs Measured', t0 !== t1 && /Target/.test(leg) && /Measured/.test(leg), { changed: t0 !== t1, legend: leg });
  // C9 sliders write the section's values; Intensity paints the section's bars
  setRange('drInt', 77); await settle(500);
  const st = S().energyState(), pats = Object.keys(st.p).filter(k => st.p[k].intensity === 77), bars77 = st.t.map((v, i) => v === 77 ? i : -1).filter(i => i >= 0);
  row('C9', 'Shape sliders write per-section values; Intensity paints the section bars', pats.length === 1 && bars77.length >= 1, { section: pats, bars: bars77 });
  // C10 locks (default: both locked)
  const before = mx(); $('drApply').click(); await settle(400); const locked = mx();
  $('drLockMelody').click(); $('drLockVoice').click(); await settle();
  setRange('drSpace', 90); setRange('drInt', 95); await settle(500);
  const b2 = mx(); $('drApply').click(); await settle(400); const unlocked = mx();
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  row('C10', 'Preserve Voice/Melody locks keep those channels on Apply; unlocked they change',
    same(before[G.melody], locked[G.melody]) && same(before[G.vocals], locked[G.vocals]) && !same(b2[G.melody], unlocked[G.melody]) && !same(b2[G.vocals], unlocked[G.vocals]),
    { lockedMelody: [before[G.melody], locked[G.melody]], unlockedMelody: [b2[G.melody], unlocked[G.melody]], lockedVocals: [before[G.vocals], locked[G.vocals]], unlockedVocals: [b2[G.vocals], unlocked[G.vocals]] });
  // C12 mappings (same Apply as above, unlocked)
  // Two Applies at opposite settings, so every mapping has room to move between them.
  setRange('drInt', 95); setRange('drWarm', 10); setRange('drMove', 90); setRange('drSpace', 90); await settle(500);
  $('drApply').click(); await settle(400); const P = JSON.parse(S().snapshot());
  setRange('drInt', 20); setRange('drWarm', 90); setRange('drMove', 10); setRange('drSpace', 15); await settle(500);
  $('drApply').click(); await settle(400); const A = JSON.parse(S().snapshot());
  const ch = (g, f) => [P.mx[G[g]][R[f]], A.mx[G[g]][R[f]]];
  const ev = { reverb: [P.rv, A.rv], chordsLo: ch('chords', 'lo'), chordsHi: ch('chords', 'hi'), chordsDly: ch('chords', 'dly'), hatsDly: ch('hats', 'dly'), hatsVol: ch('hats', 'vol'), snareVol: ch('snare', 'vol'), style: [P.cs, A.cs] };
  const moved = k => ev[k][0] !== ev[k][1];
  row('C12', 'Apply maps Space to reverb, Warmth to chords EQ and style, Movement to delays, Intensity to snare/hat levels',
    moved('reverb') && (moved('chordsLo') || moved('chordsHi')) && moved('style') && (moved('chordsDly') || moved('hatsDly')) && (moved('hatsVol') || moved('snareVol')), ev);
  return rows;
}

export async function claimsC() {
  await skipWelcome();
  const rows = [], row = (id, claim, pass, ev) => rows.push({ id, claim, pass: !!pass, ev });
  const song = () => JSON.parse(S().snapshot()).song;
  const keys = lane('keys'), clip = keys && keys.querySelector('.sa-clip'), body = clip && clip.parentElement;
  const used = Math.max(8, song().reduce((m, v, i) => v != null ? i + 1 : m, 0));
  const s0 = song(), d0 = S().undoDepth();
  // C13 move: one step of +2 bars, then the same drag continued to +12 bars
  let s1 = null, s2 = null;
  if (clip) {
    const r = clip.getBoundingClientRect(), br = body.getBoundingClientRect(), perBar = br.width / used, y = r.top + r.height / 2, x = r.left + Math.min(20, r.width / 3);
    clip.dispatchEvent(pe('pointerdown', x, y)); window.dispatchEvent(pe('pointermove', x + 2 * perBar, y)); await settle(); s1 = song();
    window.dispatchEvent(pe('pointermove', x + 12 * perBar, y)); await settle(); s2 = song();
    window.dispatchEvent(pe('pointerup', x + 12 * perBar, y)); await settle();
  }
  const runs = s => { const o = []; s.forEach((v, i) => { if (v == null) return; const l = o[o.length - 1]; if (l && l.pat === v && l.end === i) l.end = i + 1; else o.push({ pat: v, start: i, end: i + 1 }); }); return o; };
  const filled = s => s.filter(v => v != null).length;
  row('C13', 'Drag a clip to an empty destination (one continuous drag)', !!clip && filled(s2) === filled(s0) && runs(s2).length === runs(s0).length,
    { before: runs(s0), afterStep1: s1 && runs(s1), afterStep2: s2 && runs(s2), barsBefore: filled(s0), barsAfter: s2 && filled(s2), undoEntriesForOneDrag: S().undoDepth() - d0 });
  // Undo exactly what the drag added. (This used to press Undo twice, because the broken drag wrote
  // one entry per step; once a drag is correctly ONE entry, the second press reverted the project's
  // setup and emptied the keys lane before C14 and C15 ran.)
  for (let i = S().undoDepth() - d0; i > 0; i--) $('undoX').click();
  await settle(400);
  // C14 resize by the trailing edge
  const c2 = lane('keys') && lane('keys').querySelector('.sa-clip'), rz = c2 && c2.querySelector('.rsz');
  const r0 = runs(song());
  if (rz) { const r = rz.getBoundingClientRect(), br = c2.parentElement.getBoundingClientRect(), perBar = br.width / used, y = r.top + r.height / 2, x = r.left + r.width / 2;
    rz.dispatchEvent(pe('pointerdown', x, y)); window.dispatchEvent(pe('pointermove', x + 2 * perBar, y)); window.dispatchEvent(pe('pointerup', x + 2 * perBar, y)); await settle(); }
  const r1 = runs(song());
  row('C14', 'Trailing-edge resize changes the run length', !!rz && JSON.stringify(r0) !== JSON.stringify(r1), { before: r0, after: r1 });
  // C15 double-click opens the piano roll, arrangement stays
  const c3 = lane('keys') && lane('keys').querySelector('.sa-clip');
  if (c3) { c3.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await settle(400); }
  const onTab = (document.querySelector('#studioETabs .etab.on') || {}).dataset?.ed;
  row('C15', 'Double-click a clip opens Piano roll; arrangement stays', onTab === 'piano' && shown($('studioArr')), { tab: onTab, arrangementShown: shown($('studioArr')) });
  // C16 lane mute and solo
  const hd = lane('bass').querySelector('.sa-lane-hd'), [mB, sB] = [...hd.querySelectorAll('.ms button')];
  mB.click(); await settle(); const mute1 = mx()[G.bass][R.mute]; mB.click(); await settle(); const mute0 = mx()[G.bass][R.mute];
  sB.click(); await settle(); const solo1 = mx()[G.bass][R.solo]; sB.click(); await settle(); const solo0 = mx()[G.bass][R.solo];
  row('C16', 'Lane M/S drive mixer mute and solo', mute1 === 1 && mute0 === 0 && solo1 === 1 && solo0 === 0, { mute: [mute1, mute0], solo: [solo1, solo0] });
  // C18 feel filters and search (before C17 changes the Sounds panel)
  const vis = () => [...document.querySelectorAll('#featPresets .feat-card')].filter(c => getComputedStyle(c).display !== 'none').map(c => c.dataset.preset);
  const v0 = vis(); const rad = document.querySelector('.feel[data-feel="radiant"]'); rad.click(); await settle(); const v1 = vis();
  const q = $('sndSearch'); q.value = 'bass'; q.dispatchEvent(new Event('input', { bubbles: true })); await settle(); const v2 = vis(); q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true }));
  document.querySelector('.feel[data-feel="grounded"]').click(); await settle();
  row('C18', 'Feel filters and sound search narrow the featured presets', JSON.stringify(v0) !== JSON.stringify(v1) && JSON.stringify(v2) !== JSON.stringify(v0), { all: v0, radiant: v1, search_bass: v2 });
  // C17 atmosphere lane shows the import
  const before17 = lane('atmosphere') ? lane('atmosphere').querySelectorAll('.sa-clip').length : -1;
  $('importDemo').click();
  for (let i = 0; i < 40 && !S().hasSample(); i++) await settle(500);
  await settle(1500);
  const after17 = lane('atmosphere') ? lane('atmosphere').querySelectorAll('.sa-clip').length : -1;
  row('C17', 'Atmosphere lane shows content once an import exists', before17 === 0 && after17 >= 1, { clipsBefore: before17, clipsAfter: after17, imported: S().hasSample() });
  return rows;
}
