// North-star stage checks (docs/superpowers/plans/2026-10-25-aura-north-star.md). TEST-ONLY; the app never loads this
// file. Driven by qa/run.cjs in Chromium and WebKit, each job on a fresh context; every check returns {pass, ...evidence}.
// Jobs are returning visitors (seen, Studio) unless the job says `firstRun: true` (see runJob in qa/run.cjs).
import { settle } from './dashboard-a.qa.js';
const $ = id => document.getElementById(id);
const S = () => window.__auraSuite;
const shown = el => { if (!el) return false; const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; };
// A keydown that bubbles from `target` (default: the focused element), the way a key pressed there arrives.
const key = (k, o = {}) => (o.target || document.activeElement || document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, shiftKey: !!o.shiftKey }));
const welcomeOpen = () => $('welcome').classList.contains('on');
const createOpen = () => $('createSheet').classList.contains('on');
// The same selector the app's trapTab uses, so "first" and "last" mean what the trap means.
const focusables = box => [...box.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null);
const idOf = e => e ? (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '')) : null;
// The Welcome as a person reaches it: already open (rc.16 opened it by itself on a first load) or from the menu's action.
async function ensureWelcome() { if (welcomeOpen()) return 'already open';
  if (S().openWelcome) { S().openWelcome(); await settle(250); return welcomeOpen() ? 'opened' : 'openWelcome() did not open it'; }
  return 'no way to open it on this build'; }

// ---- S0/S1 infrastructure: a default job is a returning visitor ----
export async function n0DefaultIsReturning() { await settle(300);
  const seen = localStorage.getItem('aura-seen'), mode = document.body.classList.contains('guided') ? 'guided' : 'studio';
  return { pass: seen === '1' && mode === 'studio' && !welcomeOpen(), seen, mode, welcome: welcomeOpen() }; }

// ---- S1: first run and dialogs (13.8.0-rc.17) ----
// The top-bar controls whose centre is covered by something else (a dialog, a backdrop, the tour card).
const coveredTopBar = () => [...document.querySelectorAll('#xport button, #xport input, #xport select')].filter(shown).filter(b => {
  const r = b.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(h && (h === b || b.contains(h))); }).map(idOf);
const TOUR = ['sounds', 'arrangement', 'mixer', 'guidance'];

// A first visit opens no dialog and leaves the page usable.
export async function n1FirstRunNoDialog() { await settle(700);
  const open = [...document.querySelectorAll('.welcome.on, .modal:not([hidden]), .msheet:not([hidden])')].map(idOf), app = $('app');
  return { pass: open.length === 0 && !app.inert && !app.hasAttribute('aria-hidden'), open, inert: !!app.inert }; }

// A first visit with nothing to restore opens on the demo project, in Studio.
export async function n1FirstRunDemo() { await settle(700);
  const name = ($('projName') || {}).textContent, guided = document.body.classList.contains('guided');
  const song = (JSON.parse(S().snapshot()).song || []).slice(0, 8).join(',');
  return { pass: name === 'Aura Demo' && song === '0,1,1,2,2,1,2,2' && !guided, name, song, mode: guided ? 'guided' : 'studio' }; }

// The tour's four steps, in order, each pointing at something on screen, never off screen or over the top bar.
export async function n1TourSteps() { await settle(900);
  const t = $('auraTour'); if (!shown(t)) return { pass: false, why: 'no tour on a first visit' };
  const head = $('xport').getBoundingClientRect(), seen = [];
  for (let i = 0; i < TOUR.length; i++) { await settle(200);
    const anchor = t.dataset.anchor ? document.querySelector(t.dataset.anchor) : null, ring = $('auraTourRing');
    const a = anchor && anchor.getBoundingClientRect(), r = ring && shown(ring) ? ring.getBoundingClientRect() : null;
    const ringOn = !!(a && r && shown(anchor) && Math.abs(a.left - r.left) <= 8 && Math.abs(a.top - r.top) <= 8 && Math.abs(a.right - r.right) <= 8 && Math.abs(a.bottom - r.bottom) <= 8);
    const c = t.getBoundingClientRect();
    seen.push({ step: t.dataset.step, anchor: t.dataset.anchor, ringOn, onScreen: c.left >= 0 && c.top >= 0 && c.right <= innerWidth + 1 && c.bottom <= innerHeight + 1,
      overTopBar: c.top < head.bottom, count: ($('auraTourCount') || {}).textContent });
    const next = $('auraTourNext'); if (i < TOUR.length - 1) next.click(); else seen.push({ lastButton: next.textContent.trim() }); }
  const steps = seen.filter(s => s.step).map(s => s.step).join(',');
  const pass = steps === TOUR.join(',') && seen.filter(s => s.step).every(s => s.ringOn && s.onScreen && !s.overTopBar) && /^done$/i.test(seen[seen.length - 1].lastButton || '');
  return { pass, steps, seen }; }

// The tour's X ends it for good; the next load (a returning visit) shows no tour, no Welcome, the same project.
export async function n1TourDismiss() { await settle(900);
  const t = $('auraTour'); if (!shown(t)) return { pass: false, why: 'no tour on a first visit' };
  $('auraTourClose').click(); await settle(200);
  return { pass: !shown(t) && localStorage.getItem('aura-tour-done') === '1', stored: localStorage.getItem('aura-tour-done') }; }
// The project, not its name: rc.16 never autosaves the project name (every reloaded project shows "Untitled"), a gap
// logged for S7 (the editable project name), not changed here.
export async function n1TourGone() { await settle(900);
  const t = $('auraTour'), song = (JSON.parse(S().snapshot()).song || []).slice(0, 8).join(',');
  return { pass: !shown(t) && !welcomeOpen() && song === '0,1,1,2,2,1,2,2', tour: shown(t), welcome: welcomeOpen(), song }; }

// Esc anywhere on the page ends the tour.
export async function n1TourEsc() { await settle(900);
  const t = $('auraTour'); if (!shown(t)) return { pass: false, why: 'no tour on a first visit' };
  key('Escape', { target: document.body }); await settle(200);
  return { pass: !shown(t) && localStorage.getItem('aura-tour-done') === '1', tour: shown(t) }; }

// "Fresh load + Esc leaves every toolbar button clickable" — and while the tour is up, too.
export async function n1ToolbarClickable() { await settle(900);
  const examined = [...document.querySelectorAll('#xport button, #xport input, #xport select')].filter(shown).length;
  const during = coveredTopBar(); key('Escape', { target: document.body }); await settle(300); const after = coveredTopBar();
  return { pass: examined > 0 && during.length === 0 && after.length === 0 && !$('app').inert, examined, during, after }; }

// A returning visitor opens the last project: set the tempo, reload, it is back (and nothing opens over it).
export async function n1Mark() { await settle(500); const b = $('bpm'); if (!b) return { pass: false, why: 'no #bpm' };
  b.value = String(+b.value === 101 ? 99 : 101); b.dispatchEvent(new Event('input', { bubbles: true })); b.dispatchEvent(new Event('change', { bubbles: true }));
  await settle(400); sessionStorage.setItem('n1-bpm', b.value); return { pass: true, bpm: b.value }; }
export async function n1SameProject() { await settle(900);
  const want = sessionStorage.getItem('n1-bpm'), got = ($('bpm') || {}).value;
  return { pass: !!want && got === want && !welcomeOpen() && !shown($('auraTour')), want, got, welcome: welcomeOpen() }; }

// "Start something new…" in the Project menu (the ⋯ sheet on a phone) opens the Welcome, focus inside it.
export async function n1MenuOpensWelcome() { await settle(500);
  let via;
  if (shown($('projX'))) { via = 'projX'; $('projX').click(); await settle(200);
    const it = [...document.querySelectorAll('#projmenu .projmi')].find(b => /start something new/i.test(b.textContent));
    if (!it) return { pass: false, why: 'no "Start something new" in the Project menu' }; it.click(); }
  else if (shown($('mMore'))) { via = 'mMore'; $('mMore').click(); await settle(300);
    const it = [...document.querySelectorAll('#msheetBody .msrow')].find(b => /start something new/i.test(b.textContent));
    if (!it) return { pass: false, why: 'no "Start something new" in the More sheet' }; it.click(); }
  else return { pass: false, why: 'neither the Project nor the More button is visible' };
  await settle(300);
  return { pass: welcomeOpen() && $('welcome').contains(document.activeElement), via, focus: idOf(document.activeElement) }; }

// Esc closes the Welcome wherever focus is (a click on the page behind leaves focus outside the dialog).
export async function n1WelcomeEscAnywhere() { await settle(700);
  const how = await ensureWelcome(); if (!welcomeOpen()) return { pass: false, why: how };
  if (document.activeElement) document.activeElement.blur(); await settle(50);
  const focusWas = idOf(document.activeElement); key('Escape', { target: document.body }); await settle(300);
  return { pass: !welcomeOpen() && !$('app').inert, how, focusWas, open: welcomeOpen() }; }

// A click on the backdrop closes the Welcome; a click inside its card does not.
export async function n1WelcomeBackdrop() { await settle(700);
  const how = await ensureWelcome(); if (!welcomeOpen()) return { pass: false, why: how };
  $('wTitle').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); await settle(150); const keptOpen = welcomeOpen();
  $('welcome').dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); await settle(300);
  return { pass: keptOpen && !welcomeOpen() && !$('app').inert, how, keptOpenOnCardClick: keptOpen, open: welcomeOpen() }; }

// The Create sheet has an X that closes it.
export async function n1CreateHasX() { await settle(500);
  S().openCreate(); await settle(250); if (!createOpen()) return { pass: false, why: 'the Create sheet did not open' };
  const x = [...$('createSheet').querySelectorAll('button')].find(b => shown(b) && /close/i.test(b.getAttribute('aria-label') || ''));
  if (!x) return { pass: false, why: 'no visible close (X) button in the Create sheet' };
  x.click(); await settle(250); return { pass: !createOpen(), x: idOf(x) }; }

// Tab is held inside the Create sheet: Tab on the last control goes to the first, Shift+Tab on the first to the last.
export async function n1CreateTabHeld() { await settle(500);
  S().openCreate(); await settle(250); if (!createOpen()) return { pass: false, why: 'the Create sheet did not open' };
  const f = focusables($('createSheet')); if (f.length < 2) return { pass: false, why: 'fewer than two focusable controls', n: f.length };
  const first = f[0], last = f[f.length - 1];
  last.focus(); key('Tab', { target: last }); const fwd = document.activeElement === first;
  first.focus(); key('Tab', { target: first, shiftKey: true }); const back = document.activeElement === last;
  return { pass: fwd && back, fwd, back, first: idOf(first), last: idOf(last), n: f.length }; }

// Esc closes the Create sheet wherever focus is.
export async function n1CreateEscAnywhere() { await settle(500);
  S().openCreate(); await settle(250); if (!createOpen()) return { pass: false, why: 'the Create sheet did not open' };
  if (document.activeElement) document.activeElement.blur(); key('Escape', { target: document.body }); await settle(300);
  return { pass: !createOpen() && !$('app').inert, open: createOpen(), inert: !!$('app').inert }; }

// Closing the Create sheet gives focus back to the control that opened it.
export async function n1CreateFocusBack() { await settle(500);
  const owner = [$('projX'), $('mMore')].find(shown); if (!owner) return { pass: false, why: 'no visible Project or More button' };
  owner.focus(); if (document.activeElement !== owner) return { pass: false, why: 'could not focus ' + idOf(owner) };
  S().openCreate(); await settle(250); if (!createOpen()) return { pass: false, why: 'the Create sheet did not open' };
  key('Escape', { target: document.activeElement || document.body }); await settle(300);
  return { pass: !createOpen() && document.activeElement === owner, back: idOf(document.activeElement), owner: idOf(owner) }; }

// ---- found while building S1 (2026-10-31): loading straight into Studio, and picking a vibe there, left the
// arrangement stale — applyVibe changed the patterns without redrawing it. What is drawn must equal what a forced
// redraw (Guided, then Studio) draws. Desktop only: the phone has no arrangement on screen.
const laneSig = () => [...document.querySelectorAll('.sa-lane')].map(l => l.dataset.lane + ':' + l.querySelectorAll('.sa-clip').length).join(' ');
async function forcedRedrawSig() { document.querySelector('#modeSwitch button[data-m="guided"]').click(); await settle(300);
  document.querySelector('#modeSwitch button[data-m="studio"]').click(); await settle(500); return laneSig(); }
export async function n1ArrangementAtLoad() { await settle(700);
  const atLoad = laneSig(), clips = document.querySelectorAll('.sa-clip').length, redrawn = await forcedRedrawSig();
  return { pass: clips > 0 && atLoad === redrawn, clipsAtLoad: clips, atLoad, redrawn }; }
// From the demo arrangement (drawn by its own path), where 'atmos' adds open hats: Texture must gain its clip on screen.
// `before !== after` keeps this from passing when the vibe happens to change nothing that is drawn.
export async function n1ArrangementAfterVibe() { await settle(700);
  const m = await import('./dashboard-b.qa.js'); await m.loadDemoArrangement(); await settle(400);
  const before = laneSig(); S().applyVibe('atmos'); await settle(400); const after = laneSig(), redrawn = await forcedRedrawSig();
  return { pass: after === redrawn && before !== after, before, after, redrawn }; }

// ---- S2: undo (13.8.0-rc.18) ----
const undoState = () => ({ depth: S().undoDepth(), undoOff: !!($('undoX') || {}).disabled, redoOff: !!($('redoX') || {}).disabled });
// A visible beat-grid cell: the Beat grid editor tab in Studio, the Beat view on a phone.
async function gridCell() {
  const et = document.querySelector('#studioETabs .etab[data-ed="grid"]'); if (shown(et)) { et.click(); await settle(300); }
  else { const wt = document.querySelector('.wtab[data-v="rack"]'); if (wt && shown(wt)) { wt.click(); await settle(300); } }
  const c = [...document.querySelectorAll('#grid .cell')].find(shown); return c || null; }
const press = async (k, shift) => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, ctrlKey: true, shiftKey: !!shift, bubbles: true, cancelable: true })); await settle(250); };
export async function n2UndoZeroFresh() { await settle(700); const s = undoState(); return Object.assign({ pass: s.depth === 0 }, s); }
export async function n2UndoZeroFirstRun() { await settle(900); const s = undoState(); return Object.assign({ pass: s.depth === 0 }, s); }
export async function n2DemoSaved() { await settle(500); const m = await import('./dashboard-b.qa.js'); await m.loadDemoArrangement(); await settle(600); return { pass: true }; }
export async function n2UndoZeroRestored() { await settle(900);
  const s = undoState(), song = (JSON.parse(S().snapshot()).song || []).slice(0, 8).join(',');
  return Object.assign({ pass: s.depth === 0 && song === '0,1,1,2,2,1,2,2', song }, s); }
export async function n2OneToggleOneStep() { await settle(600);
  const c = await gridCell(); if (!c) return { pass: false, why: 'no visible beat-grid cell' };
  const on0 = c.classList.contains('on'), d0 = S().undoDepth(); c.click(); await settle(250);
  const d1 = S().undoDepth(), on1 = c.classList.contains('on');
  await press('z'); const back = c.isConnected ? c.classList.contains('on') : null, d2 = S().undoDepth();
  const c2 = [...document.querySelectorAll('#grid .cell')].find(shown); // the grid may re-render: read the same position
  await press('z', true); const d3 = S().undoDepth();
  return { pass: d1 === d0 + 1 && on1 !== on0 && d2 === d0 && d3 === d0 + 1, d0, d1, d2, d3, on0, on1 }; }
export async function n2RedoY() { await settle(600);
  const c = await gridCell(); if (!c) return { pass: false, why: 'no visible beat-grid cell' };
  const d0 = S().undoDepth(), snap0 = S().snapshot(); c.click(); await settle(250); const snap1 = S().snapshot();
  await press('z'); const undone = S().snapshot() === snap0; await press('y'); const redone = S().snapshot() === snap1;
  return { pass: undone && redone && S().undoDepth() === d0 + 1, undone, redone, depth: S().undoDepth(), d0 }; }
export async function n2ButtonsDisabledWhenEmpty() { await settle(700);
  const atLoad = undoState(); const c = await gridCell(); if (!c) return { pass: false, why: 'no visible beat-grid cell', atLoad };
  c.click(); await settle(250); const afterEdit = undoState(); await press('z'); const afterUndo = undoState();
  const pass = atLoad.depth === 0 && atLoad.undoOff && atLoad.redoOff && !afterEdit.undoOff && afterEdit.redoOff && afterUndo.undoOff && !afterUndo.redoOff;
  return { pass, atLoad, afterEdit, afterUndo }; }

// ---- rc.19 (Philip, 2026-10-31): the Studio header's Key says the project's key, at load and after every change ----
// Expected text built the way the header builds it: NOTE_NAMES[root] + ' major' / ' minor' / ' ' + mode.
const NN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const keyNow = () => { const s = JSON.parse(S().snapshot()); return NN[s.k] + ' ' + s.m; };
const headerKey = () => { const e = $('dashKey'); return e && shown(e) ? e.textContent.trim() : null; };
const keyCheck = (extra) => { const want = keyNow(), got = headerKey(); return Object.assign({ pass: got === want, want, got }, extra || {}); };
export async function n3KeyFirstVisit() { await settle(900); return keyCheck(); }
export async function n3KeyFresh() { await settle(700); return keyCheck(); }
export async function n3KeyRestored() { await settle(900); return keyCheck(); }
export async function n3KeyAfterVibe() { await settle(700); S().applyVibe('chipmunk'); await settle(400); return keyCheck({ vibe: 'chipmunk' }); }
export async function n3KeyAfterSelect() { await settle(700);
  const r = $('keyRoot'), m = $('keyMode'); if (!r || !m) return { pass: false, why: 'no key selects' };
  r.value = String((+r.value + 5) % 12); r.dispatchEvent(new Event('change', { bubbles: true })); await settle(200);
  const afterRoot = keyCheck(); m.value = m.value === 'minor' ? 'major' : 'minor'; m.dispatchEvent(new Event('change', { bubbles: true })); await settle(200);
  const afterMode = keyCheck(); return { pass: afterRoot.pass && afterMode.pass, afterRoot, afterMode }; }
// The guard Philip asked for: every key change goes through ONE place. Reads the app.js this page loaded and fails if
// anything outside setKey() assigns keyRoot or keyMode (the `let` declaration excepted), or if setKey is missing.
export async function n3KeyOnePlace() { await settle(300);
  const src = await (await fetch(document.querySelector('script[src*="app.js"]').src)).text();
  const lines = src.split('\n'), start = lines.findIndex(l => /^\s*function setKey\(root, mode\)\{/.test(l));
  if (start < 0) return { pass: false, why: 'no setKey(root, mode) in app.js' };
  let end = start; while (end < lines.length && !/paintDashMeta\(\); \}\s*$/.test(lines[end])) end++;
  const outside = []; lines.forEach((l, i) => { if (i >= start && i <= end) return; if (/^\s*let keyRoot=0, keyMode=/.test(l)) return;
    if (/\bkey(Root|Mode)\s*=(?!=)/.test(l)) outside.push((i + 1) + ': ' + l.trim().slice(0, 90)); });
  return { pass: outside.length === 0, setKeyLines: [start + 1, end + 1], outside: outside.slice(0, 12), outsideCount: outside.length }; }

// ---- S3 (13.8.0-rc.19): the piano roll fills its panel at every width; overflow and Ask Aura guards ----
async function openRoll() {
  const et = document.querySelector('#studioETabs .etab[data-ed="piano"]'); if (shown(et)) { et.click(); await settle(600); return 'Studio piano roll tab'; }
  const wt = document.querySelector('.wtab[data-v="piano"]'); if (wt && shown(wt)) { wt.click(); await settle(600); return 'Melody tab'; }
  return null; }
// Desktop: the roll's scroller spans the panel's content box (no empty space either side) and the grid reaches the
// scroller's inner right edge. Phone: the grid may scroll sideways inside its scroller; the page never does.
export async function n3RollFills() { await settle(600);
  const how = await openRoll(); if (!how) return { pass: false, why: 'no way to open the piano roll' };
  const sc = $('prScroll'), grid = $('prGrid'), panel = sc && sc.closest('.proll');
  if (!shown(sc) || !panel) return { pass: false, why: 'the piano roll is not on screen', how };
  const pr = panel.getBoundingClientRect(), cs = getComputedStyle(panel);
  const inL = pr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft), inR = pr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
  const sr = sc.getBoundingClientRect(), gr = grid.getBoundingClientRect(), scInnerR = sr.left + sc.clientLeft + sc.clientWidth;
  if (innerWidth < 768) { const docW = document.documentElement.scrollWidth;
    return { pass: docW <= innerWidth && sr.right <= innerWidth + 1 && sr.left >= -1, how, docW, innerWidth, scroller: Math.round(sr.width), grid: Math.round(gr.width) }; }
  const leftGap = +(sr.left - inL).toFixed(1), rightGap = +(inR - sr.right).toFixed(1), gridShort = +(scInnerR - gr.right).toFixed(1);
  const sideScroll = sc.scrollWidth - sc.clientWidth;   // a fitted roll must not scroll sideways at all
  return { pass: Math.abs(leftGap) <= 2 && Math.abs(rightGap) <= 2 && Math.abs(gridShort) <= 2 && sideScroll <= 0, how, leftGap, rightGap, gridShort, sideScroll,
    panelInner: Math.round(inR - inL), scroller: Math.round(sr.width), grid: Math.round(gr.width) }; }

// Guard: no sideways page scroll and nothing past the right edge (outside a scroller) in any view, editor tab or
// drawer, in Studio and in Guided.
const overflowNow = () => { const W = innerWidth, de = document.documentElement;
  const off = [...document.querySelectorAll('body *')].filter(shown).filter(e => { const r = e.getBoundingClientRect(); if (r.right <= W + 1) return false;
    for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(c.overflowX)) return false; } return true; });
  return { sideways: de.scrollWidth > W, offenders: off.slice(0, 4).map(idOf) }; };
export async function n3NoOverflow() { await settle(600); const bad = []; let examined = 0;
  for (const mode of ['studio', 'guided']) {
    const t = document.querySelector('#modeSwitch button[data-m="' + mode + '"]'); if (t && shown(t)) { t.click(); await settle(400); }
    const look = (label) => { examined++; const o = overflowNow(); if (o.sideways || o.offenders.length) bad.push(Object.assign({ mode, at: label }, o)); };
    look('default');
    for (const v of [...document.querySelectorAll('.wtab[data-v]')].filter(shown).map(t => t.dataset.v)) { document.querySelector('.wtab[data-v="' + v + '"]').click(); await settle(300); look('view ' + v); }
    for (const v of [...document.querySelectorAll('#studioETabs .etab')].filter(shown).map(t => t.dataset.ed)) { document.querySelector('#studioETabs .etab[data-ed="' + v + '"]').click(); await settle(300); look('editor ' + v); }
    for (const d of ['saSounds', 'saShape'].filter(id => shown($(id)))) { $(d).click(); await settle(400); look('drawer ' + d); key('Escape', { target: document.body }); await settle(200);
      if ($(d).getAttribute('aria-expanded') === 'true') { $(d).click(); await settle(200); } }
  }
  return { pass: examined > 0 && bad.length === 0, examined, bad: bad.slice(0, 6) }; }

// Guard (below 1400; at 1400 and up it covers the right panel until S6 moves it): Ask Aura covers no other control.
export async function n3AskClearBelow1400() { await settle(600); const a = $('askOpen'); if (!shown(a)) return { pass: true, note: 'Ask Aura not shown here' };
  const A = a.getBoundingClientRect(), hits = [];
  for (const mode of ['studio', 'guided']) { const t = document.querySelector('#modeSwitch button[data-m="' + mode + '"]'); if (t && shown(t)) { t.click(); await settle(400); }
    const B = $('askOpen').getBoundingClientRect();
    [...document.querySelectorAll('button,input,select,textarea,a[href],[role=tab]')].filter(shown).filter(e => e !== $('askOpen') && !$('askOpen').contains(e)).forEach(e => {
      const r = e.getBoundingClientRect(), ix = Math.min(r.right, B.right) - Math.max(r.left, B.left), iy = Math.min(r.bottom, B.bottom) - Math.max(r.top, B.top);
      if (ix > 1 && iy > 1) hits.push(mode + ' ' + idOf(e)); }); }
  return { pass: hits.length === 0, hits: hits.slice(0, 8) }; }
