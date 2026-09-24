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
  const bpm = $('bpm'); bpm.value = String(+bpm.value + 2); bpm.dispatchEvent(new Event('change', { bubbles: true })); await settle(300);
  const saved = JSON.parse(S().autosaveRaw());
  const pb = $('play'); if (pb && pb.classList.contains('on')) pb.click();   // Stop
  await settle(300);
  const after = JSON.parse(S().snapshot());
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // serialize() hides preview values by design, so "clean after Stop" alone cannot tell whether Stop
  // really ended the preview; the button state and the live chords channel can.
  const ended = $('drPreview').getAttribute('aria-pressed') !== 'true';
  return { pass: same(saved.mx, pre.mx) && saved.rv === pre.rv && same(after.mx, pre.mx) && after.rv === pre.rv && ended,
    savedMxClean: same(saved.mx, pre.mx), savedRvClean: saved.rv === pre.rv, afterStopClean: same(after.mx, pre.mx) && after.rv === pre.rv, previewEndedByStop: ended };
}
