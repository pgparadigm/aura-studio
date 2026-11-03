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
  const pm = [$('projX'), $('projMenuBtn')].find(shown);   // Project, or the name's ⌄ in the S7 bar (from 1120 px)
  if (pm) { via = pm.id; pm.click(); await settle(200);
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
  const owner = [$('projX'), $('projMenuBtn'), $('mMore')].find(shown); if (!owner) return { pass: false, why: 'no visible Project or More button' };
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
// The header's key on screen: the S7 bar's key button from 1120 px (13.9.0-rc.5), the dashboard's Key chip below that.
const headerKey = () => { const e = [$('keyBtn'), $('dashKey')].find(x => x && shown(x)); return e ? e.textContent.trim() : null; };
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

// ---- S4 (13.8.0-rc.20): accessibility ----
// The accessible name a screen reader gets, the way browsers compute it for these elements (aria-labelledby,
// aria-label, an associated <label>, the element's own text, then title).
const accName = e => { const lb = e.getAttribute('aria-labelledby');
  if (lb) { const t = lb.split(/\s+/).map(id => (document.getElementById(id) || {}).textContent || '').join(' ').trim(); if (t) return t; }
  const al = (e.getAttribute('aria-label') || '').trim(); if (al) return al;
  if (e.labels && e.labels.length) { const t = [...e.labels].map(l => l.textContent).join(' ').trim(); if (t) return t; }
  if (!/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); if (t) return t; }
  return (e.getAttribute('title') || e.getAttribute('placeholder') || '').trim(); };
// Every visible control has a name with a letter or a digit. With the right panel open where it is a drawer.
export async function n4ControlsNamed() { await settle(700);
  const sh = $('saShape'); if (shown(sh) && sh.getAttribute('aria-expanded') !== 'true') { sh.click(); await settle(500); }
  const all = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=tab],[role=button],[role=slider]')]
    .filter(shown).filter(e => !e.closest('[aria-hidden="true"]'));
  const bad = all.filter(e => !/[A-Za-z0-9]/.test(accName(e))).map(e => idOf(e) + (e.type ? '[' + e.type + ']' : ''));
  return { pass: all.length > 0 && bad.length === 0, examined: all.length, unnamed: bad.length, list: bad.slice(0, 14) }; }
// Keyboard focus is always drawn: every on-screen element the real Tab key lands on shows a focus outline (at least
// 2 px, not transparent) or a box-shadow. Judges the record the runner's focusWalk step left. Limit: an element that
// always carries a box-shadow passes whether or not focus changes it.
const ringOK = x => { const m = x.outline.match(/^(\S+) ([\d.]+)px (.*)$/);
  const ol = m && m[1] !== 'none' && parseFloat(m[2]) >= 2 && !/rgba\([^)]*,\s*0\)$/.test(m[3]); return !!ol || (!!x.shadow && x.shadow !== 'none'); };
export async function n4FocusRings() { const w = window.__focusWalk || [], seen = w.filter(Boolean);
  const bad = [...new Set(seen.filter(x => x.onScreen && !ringOK(x)).map(x => x.id))];
  return { pass: seen.length >= 10 && bad.length === 0, tabs: w.length, focused: seen.length, distinct: new Set(seen.map(x => x.k)).size,
    bad: bad.slice(0, 16), notFocusVisible: [...new Set(seen.filter(x => !x.fv).map(x => x.id))].slice(0, 8) }; }
// Text contrast. Solid backgrounds: the text against the composited background behind it. Gradients: against EVERY
// colour stop of the nearest gradient (composited over the solid colour behind it), worst stop counts — conservative:
// it can over-report text that never sits on its worst stop, never under-report. Images (url()) are counted, not judged.
const rgbOf = s => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const over = (a, b) => [a[0] * a[3] + b[0] * (1 - a[3]), a[1] * a[3] + b[1] * (1 - a[3]), a[2] * a[3] + b[2] * (1 - a[3]), 1];
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
function solidBehind(el) { const layers = []; for (let p = el; p; p = p.parentElement) { const b = rgbOf(getComputedStyle(p).backgroundColor); if (b && b[3] > 0) { layers.push(b); if (b[3] >= 1) break; } }
  let bg = rgbOf(getComputedStyle(document.body).backgroundColor) || [0, 0, 0, 1]; bg = [bg[0], bg[1], bg[2], 1]; for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg); return bg; }
export async function n4Contrast() { await settle(700);
  const sh = $('saShape'); if (shown(sh) && sh.getAttribute('aria-expanded') !== 'true') { sh.click(); await settle(500); }
  const els = [...document.querySelectorAll('body *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && /\S/.test(n.textContent)) && shown(e) && !e.closest('[aria-hidden="true"]'));
  const fails = []; let gradients = 0, images = 0;
  // Disabled controls are exempt (WCAG 1.4.3: text in an inactive user-interface component), e.g. Undo with nothing to undo.
  els.forEach(e => { const ctl = e.closest('button,input,select,textarea'); if (ctl && (ctl.disabled || ctl.getAttribute('aria-disabled') === 'true')) return;
    const cs = getComputedStyle(e); let fg = rgbOf(cs.color); if (!fg) return; let op = 1; for (let p = e; p && p !== document.body; p = p.parentElement) op *= +getComputedStyle(p).opacity;
    if (op < 0.05) return;
    let gEl = null; for (let p = e; p && p !== document.body; p = p.parentElement) { const c = getComputedStyle(p); if (c.backgroundImage && c.backgroundImage !== 'none') { gEl = p; break; } const b = rgbOf(c.backgroundColor); if (b && b[3] >= 1) break; }
    const px = parseFloat(cs.fontSize), need = (px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700)) ? 3 : 4.5; let worst, why;
    if (gEl) { const bi = getComputedStyle(gEl).backgroundImage; if (/url\(/.test(bi) && !/gradient/.test(bi)) { images++; return; }
      gradients++; const under = solidBehind(gEl.parentElement || document.body), stops = [...bi.matchAll(/rgba?\([^)]+\)/g)].map(m => rgbOf(m[0])).filter(Boolean);
      if (!stops.length) return; const f = over([fg[0], fg[1], fg[2], fg[3] * op], under);
      worst = Math.min(...stops.map(s => ratio(over([fg[0], fg[1], fg[2], fg[3] * op], over(s, under)), over(s, under)))); why = 'gradient'; void f; }
    else { const bg = solidBehind(e); worst = ratio(over([fg[0], fg[1], fg[2], fg[3] * op], bg), bg); why = 'solid'; }
    if (worst < need) fails.push({ el: idOf(e), text: [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim().slice(0, 24), ratio: +worst.toFixed(2), need, on: why, px }); });
  fails.sort((a, b) => a.ratio - b.ratio);
  return { pass: els.length > 0 && fails.length === 0, examined: els.length, overGradients: gradients, overImagesUnjudged: images, failing: fails.length, worst: fails.slice(0, 14) }; }

// ---- S5 (13.9.0-rc.1): tokens, type, one name per track ----
const SYS_FONT = /^(ui-sans-serif|system-ui|-apple-system|BlinkMacSystemFont|ui-monospace|SF Mono|SFMono-Regular|Menlo|monospace|sans-serif)$/i;
const firstFamily = s => s.split(',')[0].trim().replace(/^["']|["']$/g, '');
// The spec's palette and frames: page #120d1a → #1a1324, panels #1e1729 with a 1 px #2e2440 border and 10 px radius.
export async function n5Palette() { await settle(700);
  const body = getComputedStyle(document.body).backgroundImage;
  const pageOk = /rgb\(18, 13, 26\)/.test(body) && /rgb\(26, 19, 36\)/.test(body);
  const regions = ['#xport', '#browser', 'main.work', '#inspect'].map(s => document.querySelector(s)).filter(shown).map(e => { const c = getComputedStyle(e);
    return { el: idOf(e), bg: c.backgroundColor, border: c.borderTopWidth + ' ' + c.borderTopColor, radius: c.borderTopLeftRadius,
      ok: c.backgroundColor === 'rgb(30, 23, 41)' && c.borderTopWidth === '1px' && c.borderTopColor === 'rgb(46, 36, 64)' && c.borderTopLeftRadius === '10px' }; });
  return { pass: pageOk && regions.length >= 3 && regions.every(r => r.ok), pageBackground: body.slice(0, 120), regions }; }
// Type: system fonts only, nothing under 11 px, no capitals except the wordmark and the section line (the mockup's own).
export async function n5Type() { await settle(700);
  const sh = $('saShape'); if (shown(sh) && sh.getAttribute('aria-expanded') !== 'true') { sh.click(); await settle(500); }
  const texts = [...document.querySelectorAll('body *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && /\S/.test(n.textContent)) && shown(e));
  const small = [], nonSystem = [], caps = [];
  texts.forEach(e => { const c = getComputedStyle(e), px = parseFloat(c.fontSize), t = e.textContent.trim().slice(0, 16);
    if (px < 10.95) small.push(idOf(e) + ' ' + px + 'px "' + t + '"');
    if (!SYS_FONT.test(firstFamily(c.fontFamily))) nonSystem.push(idOf(e) + ' ' + firstFamily(c.fontFamily));
    if (c.textTransform === 'uppercase' && !e.closest('.wordmark,#drSecMeta')) caps.push(idOf(e) + ' "' + t + '"'); });
  const tokens = { ui: firstFamily(getComputedStyle(document.documentElement).getPropertyValue('--font-ui')), display: firstFamily(getComputedStyle(document.documentElement).getPropertyValue('--font-display')) };
  return { pass: texts.length > 0 && !small.length && !nonSystem.length && !caps.length && SYS_FONT.test(tokens.ui) && SYS_FONT.test(tokens.display),
    examined: texts.length, tokens, small: small.slice(0, 8), smallCount: small.length, nonSystem: nonSystem.slice(0, 6), nonSystemCount: nonSystem.length, caps: caps.slice(0, 8), capsCount: caps.length }; }
// No web font: no @font-face in any stylesheet the page loaded (the network rule: no request but the singer's link).
export async function n5NoWebfont() { await settle(400); let faces = 0, sheets = 0;
  for (const s of document.styleSheets) { sheets++; let rules; try { rules = s.cssRules; } catch (e) { return { pass: false, why: 'a stylesheet could not be read: ' + (s.href || 'inline') }; }
    for (const r of rules) if (r.constructor && r.constructor.name === 'CSSFontFaceRule') faces++; }
  return { pass: sheets > 0 && faces === 0, sheets, fontFaces: faces }; }
// One name per track: each lane's name is the name on its mixer strip.
const LANE_STRIP = { drums: '__drums', bass: 'bass', keys: 'chords', atmosphere: 'sample', melody: 'melody', voice: 'vocals', double: 'double', harmony: 'harmony' };
export async function n5OneNamePerTrack() { await settle(700);
  const t = document.querySelector('#studioETabs .etab[data-ed="mix"]'); if (shown(t)) { t.click(); await settle(400); }
  const rows = Object.entries(LANE_STRIP).map(([lane, g]) => { const l = document.querySelector('.sa-lane[data-lane="' + lane + '"] .nm'), s = document.querySelector('#mixer .strip[data-g="' + g + '"] .nm');
    const ln = l ? l.textContent.trim() : null, sn = s ? (s.firstChild ? s.firstChild.textContent : s.textContent).trim() : null; return { lane, ln, strip: g, sn, same: !!ln && ln === sn }; });
  return { pass: rows.every(r => r.same || r.sn === null), rows, mismatched: rows.filter(r => !r.same && r.sn !== null).map(r => r.ln + ' ≠ ' + r.sn) }; }

// ---- S6: the right panel (13.9.0-rc.2) ----
// The panel as a person reaches it: a column from 1400 px, a drawer opened by its rail button below.
async function openPanel() { const p = $('inspect');
  if (innerWidth < 1400 && p && !p.classList.contains('open') && $('tgInspect')) { $('tgInspect').click(); await settle(450); }
  return innerWidth >= 1400 ? 'column' : p && p.classList.contains('open') ? 'drawer, open' : 'drawer, closed'; }
const secStarts = () => [...document.querySelectorAll('#saSecs .sa-sec[data-start]')].map(b => +b.dataset.start);
// The section the card names, as the bar it starts on (0-based), read from "NAME · BARS a – b".
const cardStart = () => { const x = (($('drSecMeta') || {}).textContent || '').match(/BARS\s+(\d+)\s*[–-]/); return x ? +x[1] - 1 : null; };
// On the demo song (sections 0,1,1,2,2,1,2,2: five runs), since a new project has one section and nothing to step to.
export async function n6PrevNext() { await settle(500); const m = await import('./dashboard-b.qa.js'); await m.loadDemoArrangement(); await settle(600);
  const how = await openPanel();
  const starts = secStarts(), prev = $('drPrev'), next = $('drNext');
  if (!prev || !next) return { pass: false, why: 'no #drPrev / #drNext', how, starts, card: cardStart() };
  if (starts.length < 2) return { pass: false, notRun: true, why: 'fewer than two sections, so stepping cannot be told', starts };
  document.querySelector('#saSecs .sa-sec[data-start="' + starts[0] + '"]').click(); await settle(200);
  const d0 = S().undoDepth(), fwd = [{ at: cardStart(), prevOff: prev.disabled, nextOff: next.disabled }];
  for (let i = 1; i < starts.length; i++) { next.click(); await settle(150); fwd.push({ at: cardStart(), prevOff: prev.disabled, nextOff: next.disabled }); }
  const back = []; for (let i = starts.length - 2; i >= 0; i--) { prev.click(); await settle(150); back.push(cardStart()); }
  const fwdOk = fwd.every((w, i) => w.at === starts[i]), backOk = back.every((b, k) => b === starts[starts.length - 2 - k]);
  const ends = fwd[0].prevOff && !fwd[0].nextOff && fwd[fwd.length - 1].nextOff && !fwd[fwd.length - 1].prevOff && prev.disabled && !next.disabled;
  // End one section on from the start, so the selection differs from where the history last stood, then wait past
  // the 4-second autosave: a selection the snapshot carries (cp) would be recorded there as an undo step.
  next.click(); await settle(4500); const steps = S().undoDepth() - d0;
  return { pass: fwdOk && backOk && ends && steps === 0, how, starts, fwd, back, ends, undoSteps: steps }; }
// A pick made straight after an edit, before that edit's autosave lands, must not swallow it: the edit keeps its own
// undo step and Cmd+Z takes it back. (Guards the fix above: re-baselining the whole history entry would lose it.)
export async function n6PickKeepsEdit() { await settle(500); const m = await import('./dashboard-b.qa.js'); await m.loadDemoArrangement(); await settle(600);
  await openPanel(); const vol = document.querySelector('.track-vol'), next = $('drNext');
  if (!vol || !next) return { pass: false, why: 'no drum volume slider or no #drNext' };
  document.querySelector('#saSecs .sa-sec[data-start]').click(); await settle(4500);
  const dv = () => JSON.stringify(JSON.parse(S().snapshot()).dv), d0 = S().undoDepth(), dv0 = dv(), v0 = +vol.value;
  vol.value = String(v0 > 50 ? v0 - 30 : v0 + 30); vol.dispatchEvent(new Event('input', { bubbles: true }));
  next.click(); await settle(4500); const steps = S().undoDepth() - d0, dv1 = dv();
  await press('z'); const dv2 = dv();
  return { pass: steps === 1 && dv1 !== dv0 && dv2 === dv0, steps, dv0, dv1, afterUndo: dv2 }; }
// The section card holds, in this order: the meta row with prev/next; Intensity, Warmth, Movement, Space (0-100, each
// value shown); the Preserve chips Voice and Melody. Room, Echo and "Apply to whole song" are not in the panel (S6).
const SEC_CARD = ['drSecMeta', 'drPrev', 'drNext', 'drInt', 'drWarm', 'drMove', 'drSpace', 'drLockVoice', 'drLockMelody'];
export async function n6SectionCard() { await settle(700); const how = await openPanel();
  const card = $('drSecCard'), rail = $('dashRail');
  if (!card) return { pass: false, why: 'no #drSecCard', how };
  const missing = SEC_CARD.filter(id => !$(id) || !card.contains($(id)));
  const order = SEC_CARD.every((id, i) => i === 0 || (!!$(SEC_CARD[i - 1]) && !!$(id) && !!($(SEC_CARD[i - 1]).compareDocumentPosition($(id)) & Node.DOCUMENT_POSITION_FOLLOWING)));
  const sliders = ['drInt', 'drWarm', 'drMove', 'drSpace'].map(id => { const el = $(id), out = el && el.closest('label') ? el.closest('label').querySelector('output') : null;
    return { id, min: el && el.min, max: el && el.max, value: el && el.value, shown: out ? out.textContent.trim() : null,
      ok: !!el && el.min === '0' && el.max === '100' && !!out && parseInt(out.textContent, 10) === +el.value }; });
  // Melody is a lock (pressed or not); Voice is a fixed badge since 2026-11-03 (n6VoiceBadge holds what it says).
  const chips = ['drLockMelody'].map(id => ({ id, pressed: $(id) ? $(id).getAttribute('aria-pressed') : null }));
  const gone = { room: !rail.contains($('drRoom')), echo: !rail.contains($('drEcho')), songApply: !/apply to whole song/i.test(rail.textContent) };
  return { pass: !missing.length && order && sliders.every(s => s.ok) && chips.every(c => c.pressed === 'true' || c.pressed === 'false') && gone.room && gone.echo && gone.songApply,
    how, missing, order, sliders, chips, gone }; }
// Room and Echo left the panel, but a file that carries them (en.s) opens and saves them unchanged (S6).
export async function n6SongToneKept() { await settle(600);
  // A file names the compact `en` as `energy` (toReadable); the fields inside it keep their compact names.
  const f = S().buildFile('QA S6 tone', true); f.project.energy = { t: [50, 50, 50, 50, 50, 50, 50, 50], p: {}, s: [60, 80, 70] };
  const r = S().openFile(JSON.parse(JSON.stringify(f)), 'QA S6 tone.aura'); await settle(300);
  const en = JSON.parse(S().snapshot()).en;
  return { pass: !!(r && r.ok) && !!en && JSON.stringify(en.s) === '[60,80,70]', opened: r, s: en ? en.s : null }; }

// ---- S6 task 3: Warmth per section (Philip, 2026-11-02: the chords channel's EQ at each section's start) ----
// Every setValueAtTime on a shelf filter's gain during an offline render, with the filter's own number in that render.
// A Map holds each gain param so WebKit keeps its wrapper and `this` stays the same object (e2GraphSeesThroughGC).
async function shelfCalls(render) {
  const OAC = window.OfflineAudioContext, P = AudioParam.prototype, sv = P.setValueAtTime, BP = BaseAudioContext.prototype, cb = BP.createBiquadFilter, owner = new Map(), calls = [];
  BP.createBiquadFilter = function (...a) { const f = cb.apply(this, a); if (this instanceof OAC) owner.set(f.gain, { f, id: owner.size }); return f; };
  P.setValueAtTime = function (v, t) { const o = owner.get(this);
    if (o && /shelf/.test(o.f.type)) calls.push({ id: o.id, type: o.f.type, hz: o.f.frequency.value, v: Math.round(v * 1000) / 1000, t: Math.round(t * 1000) / 1000 }); return sv.call(this, v, t); };
  try { await render(); } finally { P.setValueAtTime = sv; BP.createBiquadFilter = cb; }
  return calls; }
const slide = (id, v) => { const el = $(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
const pickSec = async start => { document.querySelector('#saSecs .sa-sec[data-start="' + start + '"]').click(); await settle(200); };
async function demoInPanel() { await settle(500); const m = await import('./dashboard-b.qa.js'); await m.loadDemoArrangement(); await settle(600); await openPanel(); }
// One section's Warmth moves the chords shelves at that section's bars only (0.16 dB a point on the treble, 0.1 on the
// low end, from the mixer's setting); nothing is scheduled before; one undo step; Cmd+Z takes it back.
export async function n6WarmthPerSection() { await demoInPanel();
  const calm = await shelfCalls(() => S().renderExport());
  await pickSec(3); const w0 = +$('drWarm').value, d0 = S().undoDepth(), up = Math.min(100, w0 + 40), dw = up - w0;
  slide('drWarm', up); await settle(4500); const steps = S().undoDepth() - d0;
  await pickSec(1); const other = +$('drWarm').value; await pickSec(3); const kept = +$('drWarm').value;
  const warm = await shelfCalls(() => S().renderExport()), used = (JSON.parse(S().snapshot()).song || []).filter(v => v != null);
  const lane = type => warm.filter(c => c.type === type).sort((a, b) => a.t - b.t);
  const fits = (calls, slope) => { const base = calls.length ? calls[0].v : null;
    return calls.length === used.length && new Set(calls.map(c => c.id)).size === 1
      && calls.every((c, i) => Math.abs(c.v - (used[i] === 2 ? Math.max(-12, Math.min(12, base + dw * slope)) : base)) < 0.011); };
  const hi = lane('highshelf'), lo = lane('lowshelf');
  await press('z'); await settle(300); await pickSec(3); const undone = +$('drWarm').value;
  return { pass: calm.length === 0 && steps === 1 && other === w0 && kept === up && fits(hi, 0.16) && fits(lo, 0.1) && undone === w0,
    calmCalls: calm.length, w0, set: up, steps, other, kept, undone, bars: used.join(','), hi: hi.map(c => c.v).join(','), lo: lo.map(c => c.v).join(',') }; }
// A file written with per-section Warmth carries it (energy.w), asks for schema 5, and reopens with it.
export async function n6WarmthSaved() { await demoInPanel();
  await pickSec(3); const w0 = +$('drWarm').value, up = Math.min(100, w0 + 30); slide('drWarm', up); await settle(4500);
  const f = S().buildFile('QA S6 warm', true), w = f.project.energy ? f.project.energy.w : undefined;
  const r = S().openFile(JSON.parse(JSON.stringify(f)), 'QA S6 warm.aura'); await settle(400);
  await pickSec(3); const back = +$('drWarm').value; await pickSec(1); const other = +$('drWarm').value;
  return { pass: f.schemaVersion === 5 && !!w && !!(r && r.ok) && back === up && other === w0, schema: f.schemaVersion, w, opened: r, back, other, w0, up }; }
// A file from before S6 (Warmth song-wide in energy.s) opens with that Warmth in every section, saves no energy.w and
// schedules nothing: it sounds as it did (D2: old files copy their song Warmth into every section).
export async function n6OldFileWarmth() { await demoInPanel();
  const f = S().buildFile('QA S6 old warmth', true); f.project.energy = { t: [50, 50, 50, 50, 50, 50, 50, 50], p: {}, s: [72, 40, 30] };
  const r = S().openFile(JSON.parse(JSON.stringify(f)), 'QA S6 old warmth.aura'); await settle(400);
  const seen = []; for (const st of secStarts()) { await pickSec(st); seen.push(+$('drWarm').value); }
  const en = JSON.parse(S().snapshot()).en, calls = await shelfCalls(() => S().renderExport());
  return { pass: !!(r && r.ok) && seen.length > 1 && seen.every(v => v === 72) && !!en && en.w === undefined && calls.length === 0, opened: r, seen, w: en ? en.w : 'no en', calls: calls.length }; }

// ---- S6 task 4: the selected-track card leads with the track's sound ----
// Name, then a sound menu (Warm keys: the chord sounds; Melody: the melody sounds), then High EQ, Reverb send and Delay
// send in dB. Picking a sound changes the saved sound in one undo step and the name line follows it. A track with no
// sound to pick (Voice) shows no menu. The chord sound left Warmth for this menu (Philip, 2026-11-02).
const TRACK_CARD = ['drTrackName', 'drPreset', 'drCut', 'drRev', 'drDly'];
const menuShown = el => !!el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && getComputedStyle(el.parentElement).display !== 'none';
export async function n6TrackCard() { await settle(700); const how = await openPanel();
  const pickLane = async id => { const h = document.querySelector('.sa-lane[data-lane="' + id + '"] .sa-lane-hd'); if (h) h.click(); await settle(250); return !!h; };
  if (!(await pickLane('keys'))) return { pass: false, why: 'no Warm keys lane', how };
  const card = $('drTrackBlock'), sel = $('drPreset');
  if (!sel || !card || !card.contains(sel)) return { pass: false, why: 'no #drPreset in the track card', how };
  const order = TRACK_CARD.every((id, i) => i === 0 || (!!$(TRACK_CARD[i - 1]) && !!$(id) && !!($(TRACK_CARD[i - 1]).compareDocumentPosition($(id)) & Node.DOCUMENT_POSITION_FOLLOWING)));
  const keysNames = [...sel.options].map(o => o.textContent.trim()), units = ['drCutOut', 'drRevOut', 'drDlyOut'].map(id => /dB$/.test((($(id) || {}).textContent || '').trim()));
  const cs = () => JSON.parse(S().snapshot()).cs, cs0 = cs(), to = [...sel.options].find(o => o.value !== cs0), d0 = S().undoDepth();
  sel.value = to.value; sel.dispatchEvent(new Event('change', { bubbles: true })); await settle(500);
  const cs1 = cs(), steps = S().undoDepth() - d0, nameLine = $('drTrackName').textContent.trim(), follows = nameLine.indexOf(to.textContent.trim()) === 0;
  await pickLane('melody'); const melNames = menuShown(sel) ? [...sel.options].map(o => o.value) : null;
  await pickLane('voice'); const voiceMenu = menuShown(sel);
  const wantKeys = ['Soft Rhodes', 'E-Piano', 'Pad', 'Nylon'].every(n => keysNames.includes(n));
  return { pass: order && wantKeys && units.every(Boolean) && cs1 === to.value && steps === 1 && follows && !!melNames && melNames.length >= 2 && !voiceMenu,
    how, order, keysNames, units, chordSound: [cs0, cs1], steps, nameLine, melody: melNames, voiceMenu }; }

// ---- S6 task 5: Aura guidance's Apply reaches the whole song; Preview commits nothing ----
// "Apply to every section" (it replaces the song block's "Apply to whole song"): every section the singer has shaped
// takes its own Shape values at once, in one undo step, exactly as applying them one by one would; a section never
// shaped is left as it is; One-step undo puts the whole song back.
export async function n6ApplyWholeSong() { await demoInPanel();
  const pats = () => JSON.parse(S().snapshot()).pat, same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  await pickSec(1); slide('drInt', 95); await settle(300); await pickSec(3); slide('drInt', 10); await settle(4500);
  const b = $('drApplyAll'); if (!b) return { pass: false, why: 'no #drApplyAll in the guidance card' };
  const card = $('drGuideBlock'), inCard = !!card && card.contains(b);
  const p0 = pats(), d0 = S().undoDepth(); b.click(); await settle(600); const p1 = pats(), steps = S().undoDepth() - d0;
  const changed = [0, 1, 2].map(i => !same(p0[i], p1[i]));
  $('drUndo').click(); await settle(600); const p2 = pats();
  await pickSec(1); $('drApply').click(); await settle(500); await pickSec(3); $('drApply').click(); await settle(500); const p3 = pats();
  return { pass: inCard && steps === 1 && !changed[0] && changed[1] && changed[2] && same(p2, p0) && same(p3, p1),
    inCard, steps, changed, undoneToStart: same(p2, p0), sameAsOneByOne: same(p3, p1) }; }
// Preview plays the change and commits nothing: the saved state and undo depth are the same during and after it.
export async function n6PreviewNoCommit() { await demoInPanel(); await pickSec(3); slide('drInt', 95); await settle(4500);
  const s0 = S().snapshot(), d0 = S().undoDepth();
  $('drPreview').click(); await settle(1200); const during = S().snapshot();
  $('drPreview').click(); await settle(4800); const s1 = S().snapshot(), d1 = S().undoDepth();
  if ($('play') && $('play').classList.contains('on')) $('play').click(); await settle(200);
  return { pass: during === s0 && s1 === s0 && d1 === d0, savedDuring: during === s0, savedAfter: s1 === s0, undoSteps: d1 - d0 }; }

// ---- S6 task 6: Ask Aura sits in the Aura guidance card from 1400 px (the panel is a column there) ----
// Below 1400 it floats as before (n3AskClearBelow1400 holds it there). At every width it still opens Ask Aura.
export async function n6AskInCard() { await settle(700); const how = await openPanel();
  const b = $('askOpen'), card = $('drGuideBlock'); if (!b || !card) return { pass: false, why: 'no #askOpen or no guidance card', how };
  const wide = innerWidth >= 1400, inCard = card.contains(b); if (wide) b.scrollIntoView({ block: 'nearest' }); await settle(150);
  const r = b.getBoundingClientRect(), c = card.getBoundingClientRect();
  const within = r.width > 0 && r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1;
  const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), hits = !!h && (h === b || b.contains(h));
  b.click(); await settle(350); const opened = b.getAttribute('aria-expanded') === 'true' && !$('guideSheet').hidden;
  key('Escape', { target: $('guideSheet') }); await settle(300);
  return { pass: opened && (wide ? inCard && within && hits : !inCard), how, wide, inCard, within, hits, opened,
    ask: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], card: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)] }; }

// ---- S6 task 7: the whole panel fits ----
// Every card of the panel lies inside the viewport, nothing in it scrolls, and the centre of every control it shows hits
// that control (at 1920x1113 Ask Aura used to cover One-step undo and the Architect row). Measured on a fresh project.
export async function n6Fits() { await settle(900); const how = await openPanel();
  const rail = $('dashRail'); if (!rail || rail.hidden) return { pass: false, why: 'no panel showing', how };
  const cards = [...rail.children].filter(e => getComputedStyle(e).display !== 'none'), vw = innerWidth, vh = innerHeight;
  const off = cards.map(e => { const r = e.getBoundingClientRect(); return { card: e.id || e.className.split(' ').slice(-1)[0], top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; })
    .filter(c => c.top < 0 || c.bottom > vh || c.left < 0 || c.right > vw);
  const scrolls = []; for (let e = rail; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowY;
    if (/(auto|scroll)/.test(o) && e.scrollHeight > e.clientHeight + 1) scrolls.push({ el: e.id || e.className.split(' ')[0], scrollHeight: e.scrollHeight, clientHeight: e.clientHeight }); }
  const ctrls = [...rail.querySelectorAll('button, input, select')].filter(c => !c.closest('[hidden]') && getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0);
  const covered = ctrls.filter(c => { const r = c.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !(h && (h === c || c.contains(h))); })
    .map(c => ({ id: c.id || c.textContent.trim().slice(0, 20), by: (() => { const r = c.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return h ? (h.id || h.className || h.tagName) : 'off screen'; })() }));
  return { pass: !off.length && !scrolls.length && !covered.length, how, vh, cards: cards.length, controls: ctrls.length, off, scrolls, covered }; }
// Song settings fold away in Studio (so the panel fits) and nothing is lost: the button opens them where the panel
// can reach them, the key and the chord sound among them, and closes them again.
export async function n6SettingsOpen() { await settle(700); const how = await openPanel();
  const b = $('drSettings'); if (!b) return { pass: false, why: 'no #drSettings', how };
  const reach = id => { const e = $(id); if (!e) return false; e.scrollIntoView({ block: 'nearest' }); const r = e.getBoundingClientRect(), h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return getComputedStyle(e).display !== 'none' && r.width > 0 && !!h && (h === e || e.contains(h)); };
  const closed = { key: reach('keyRoot'), sound: reach('chordStyle') };
  b.click(); await settle(300); const open = { expanded: b.getAttribute('aria-expanded'), key: reach('keyRoot'), sound: reach('chordStyle'), mood: reach('prog') };
  b.click(); await settle(300); const again = { expanded: b.getAttribute('aria-expanded'), key: reach('keyRoot') };
  return { pass: !closed.key && !closed.sound && open.expanded === 'true' && open.key && open.sound && open.mood && again.expanded === 'false' && !again.key, how, closed, open, again }; }

// ---- Open items (Philip, 2026-11-03): Preserve does something real ----
// The Melody chip guards every Aura change that reaches the melody: Architect's "Leave more room for vocals" and the
// Transitions that rewrite its tone, reverb or notes. Locked (the default) each leaves the melody's channel and notes as
// they were and still does the rest of its work; unlocked each changes the melody as before.
const MEL_ROW = 5, CHORD_ROW = 4;   // mixer rows in GROUPS order (dashboard-a: chords 4, melody 5)
const MEL_ACTS = [['arch', 'roomForVocals'], ['trans', 'filterclose'], ['trans', 'filteropen'], ['trans', 'reverbtail'], ['trans', 'reverselift'], ['trans', 'octaverise']];
export async function n6MelodyLock() { await demoInPanel();
  const snap = () => JSON.parse(S().snapshot()), lock = $('drLockMelody'), melOf = s => JSON.stringify([s.mx[MEL_ROW], s.mel]);
  if (!lock || lock.getAttribute('aria-pressed') !== 'true') return { pass: false, why: 'no Melody chip, or not locked by default' };
  const s = snap(); let bar = -1;   // a bar whose section before it has melody notes, so octave rise has notes to move
  for (let b = 1; b < s.song.length; b++) if (s.song[b - 1] != null && ((s.mel || [])[s.song[b - 1]] || []).length) { bar = b; break; }
  if (bar < 0) return { pass: false, notRun: true, why: 'no section with melody notes before a bar, so octave rise cannot be told' };
  const run = async () => { const out = {};
    for (const [k, n] of MEL_ACTS) { const s0 = snap(); if (k === 'arch') S().runArchitect(n); else S().applyTransition(n, bar); await settle(250);
      const s1 = snap(); out[n] = { melody: melOf(s0) !== melOf(s1), chords: JSON.stringify(s0.mx[CHORD_ROW]) !== JSON.stringify(s1.mx[CHORD_ROW]) };
      if (JSON.stringify(s0) !== JSON.stringify(s1)) await press('z'); }
    return out; };
  const locked = await run(); lock.click(); await settle(200); const openState = lock.getAttribute('aria-pressed');
  const open = await run(); lock.click(); await settle(200);
  const kept = Object.values(locked).every(r => !r.melody), changed = Object.values(open).every(r => r.melody);
  const restStill = locked.roomForVocals.chords && locked.filterclose.chords && locked.filteropen.chords && locked.reverbtail.chords;
  return { pass: kept && changed && restStill && openState === 'false', bar, locked, open, openState }; }
// Voice is a fixed badge, not a toggle: no Aura change reaches the voice, so a switch for it would do nothing.
export async function n6VoiceBadge() { await settle(700); const how = await openPanel();
  const v = $('drLockVoice'); if (!v) return { pass: false, why: 'no Voice badge', how };
  const control = v.tagName === 'BUTTON' || v.tagName === 'INPUT' || v.hasAttribute('aria-pressed') || v.tabIndex >= 0;
  const said = ((v.getAttribute('aria-label') || '') + ' ' + (v.getAttribute('title') || '')).toLowerCase();
  return { pass: !control && /never changes your voice/.test(said) && !!v.closest('.dr-preserve') && /voice/i.test(v.textContent), how, tag: v.tagName, control, said }; }

// ---- Open items (Philip, 2026-11-03): the project-file schema the code names exists, and the files this build writes
// match it. Every docs/ path rc/app.js names must be there; a fresh project, one with a section's own Warmth (schema 5)
// and one with a vocal take (schema 4 or more) must validate; and four broken files must be refused, or the schema
// would pass anything.
const fromRoot = p => new URL('../' + p, import.meta.url).href;
export async function n6SchemaValid() { await settle(600);
  const app = await (await fetch(fromRoot('rc/app.js'), { cache: 'no-store' })).text();
  const named = [...new Set(app.match(/docs\/[A-Za-z_.-]+\.(?:md|json)/g) || [])], found = {};
  for (const p of named) found[p] = (await fetch(fromRoot(p), { cache: 'no-store' })).status;
  const sres = await fetch(fromRoot('docs/aura-project.schema.json'), { cache: 'no-store' });
  if (sres.status !== 200) return { pass: false, why: 'docs/aura-project.schema.json not there (' + sres.status + ')', named, found };
  const schema = await sres.json(); await import('./schema-validate.js');
  const check = f => window.AuraSchema.validate(schema, JSON.parse(JSON.stringify(f))), files = {};
  files.fresh = S().buildFile('QA schema fresh', true);
  await demoInPanel(); await pickSec(3); slide('drWarm', 85); await settle(500); files.warmth = S().buildFile('QA schema warmth', true);
  const ac = new OfflineAudioContext(1, 22050, 22050), buf = ac.createBuffer(1, 22050, 22050), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = 0.2 * Math.sin(2 * Math.PI * 220 * i / 22050);
  S().takeInstall(buf, 0); await settle(400); files.take = S().buildFile('QA schema take', true);
  const errors = Object.fromEntries(Object.entries(files).map(([k, f]) => [k, check(f)]));
  const BAD = { tooNew: f => { f.schemaVersion = 6; }, audioInside: f => { f.mediaPersistence.importedAudioEmbedded = true; },
    warmthOut: f => { f.project.energy.w['2'] = 150; }, fiveSections: f => { f.project.patterns.pop(); } };
  const refused = Object.fromEntries(Object.entries(BAD).map(([k, fn]) => { const f = JSON.parse(JSON.stringify(files.warmth)); fn(f); return [k, check(f).length > 0]; }));
  const versions = { fresh: files.fresh.schemaVersion, warmth: files.warmth.schemaVersion, take: files.take.schemaVersion };
  const takes = files.take.media && files.take.media.vocalTakes ? files.take.media.vocalTakes.length : 0;
  return { pass: named.length >= 2 && named.every(p => found[p] === 200) && Object.values(errors).every(e => !e.length) && Object.values(refused).every(Boolean)
      && versions.warmth === 5 && versions.take >= 4 && takes > 0,
    named, found, versions, takes, errors: Object.fromEntries(Object.entries(errors).map(([k, e]) => [k, e.slice(0, 6)])), refused }; }

// ---- Open items (Philip, 2026-11-03): the phone's core path works without the right panel ----
// A WAV made in the page: mono 44.1 kHz, kicks at 100 BPM under an A minor triad, so tempo and key have something to find.
function qaSongWav(sec = 8) { const sr = 44100, n = sr * sec, pcm = new Int16Array(n), beat = 60 / 100;
  for (let i = 0; i < n; i++) { const t = i / sr, b = t % beat, kick = b < 0.12 ? Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-b * 40)) * b) * Math.exp(-b * 25) : 0;
    const pad = 0.12 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 261.63 * t) + Math.sin(2 * Math.PI * 329.63 * t)); pcm[i] = Math.max(-1, Math.min(1, 0.6 * kick + pad)) * 32767; }
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  new Int16Array(buf, 44).set(pcm); return new File([buf], 'qa-song.wav', { type: 'audio/wav' }); }
// Pressed as a person would: only controls on screen (scrolled into view, centre hit), each step's result read from the app.
const onScreen = e => { if (!e) return false; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  if (cs.display === 'none' || cs.visibility === 'hidden' || !r.width || !r.height || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
  const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === e || e.contains(h)); };
const byText = (sel, re) => [...document.querySelectorAll(sel)].find(b => re.test(b.textContent.trim()) && onScreen(b));
export async function n6PhoneCorePath() { await settle(900);
  const errs = [], onErr = e => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e)); addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
  const steps = {}, done = r => { removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr); return r; };
  // 1. import: More, Start something new..., then the Welcome's "Use a song I have" (the Sounds column's Import a song
  //    is in a drawer the phone never shows); the picker it opens gets the song
  const pickInput = { el: null }, IC = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { pickInput.el = this; return; } return IC.call(this); };
  try { if (!onScreen($('mMore'))) return done({ pass: false, why: 'More is not on screen', steps }); $('mMore').click(); await settle(400);
    const fresh = byText('button', /^Start something new/); steps.startNew = !!fresh; if (!fresh) return done({ pass: false, why: 'no Start something new in More', steps });
    fresh.click(); await settle(600); const useSong = byText('#welcome button', /^Use a song I have/); steps.importOnScreen = !!useSong;
    if (!useSong) return done({ pass: false, why: 'no "Use a song I have" on screen after Start something new', steps });
    useSong.click(); await settle(400); } finally { HTMLInputElement.prototype.click = IC; }
  steps.pickerOpened = !!pickInput.el && /audio/.test(pickInput.el.accept); if (!steps.pickerOpened) return done({ pass: false, why: '"Use a song I have" opened no audio picker', steps });
  const dt = new DataTransfer(); dt.items.add(qaSongWav(8)); pickInput.el.files = dt.files; pickInput.el.dispatchEvent(new Event('change', { bubbles: true }));
  for (let k = 0; k < 60 && ($('rebuild').hidden || !$('rebuildRows').children.length); k++) await settle(500);
  steps.rebuildShown = !$('rebuild').hidden && $('rebuildRows').children.length > 0; if (!steps.rebuildShown) return done({ pass: false, why: 'the rebuild card never appeared', steps });
  // 2. rebuild: take the detected tempo, then Apply the key and chords: one undo step that changes the song
  const tempo = byText('#rebuild button', /^Use detected tempo/); steps.tempo = !!tempo; if (tempo) { tempo.click(); await settle(600); }
  const apply = byText('#rebuildRows button', /^Apply the key and chords/); steps.applyOnScreen = !!apply; if (!apply) return done({ pass: false, why: 'Apply the key and chords not on screen', steps });
  const s0 = JSON.parse(S().snapshot()), d0 = S().undoDepth(); apply.click(); await settle(800); const s1 = JSON.parse(S().snapshot());
  steps.applySteps = S().undoDepth() - d0; steps.songChanged = JSON.stringify([s0.k, s0.m, s0.pat]) !== JSON.stringify([s1.k, s1.m, s1.pat]);
  // 3. play, then stop
  if (window.__auraCloseSheet) window.__auraCloseSheet(); key('Escape'); await settle(300);
  steps.playOnScreen = onScreen($('play')); $('play').click(); await settle(1500); steps.playing = $('play').classList.contains('on') || $('play').getAttribute('aria-pressed') === 'true';
  $('play').click(); await settle(600); steps.stopped = !($('play').classList.contains('on') || $('play').getAttribute('aria-pressed') === 'true');
  // 4. export: the bottom bar's Export makes a WAV (caught where the app hands it to the browser to save)
  const blobs = [], CU = URL.createObjectURL; URL.createObjectURL = function (b) { if (b instanceof Blob) blobs.push(b); return CU.call(URL, b); };
  try { steps.exportOnScreen = onScreen($('navExport')); $('navExport').click();
    for (let k = 0; k < 120 && !blobs.some(b => /wav/.test(b.type) || b.size > 1000); k++) await settle(500); } finally { URL.createObjectURL = CU; }
  const wav = blobs.find(b => b.size > 1000); let riff = null; if (wav) { const h = new Uint8Array(await wav.slice(0, 12).arrayBuffer()); riff = String.fromCharCode(...h.slice(0, 4)) + '/' + String.fromCharCode(...h.slice(8, 12)); }
  steps.exportBytes = wav ? wav.size : 0; steps.riff = riff; steps.pageErrors = errs.slice(0, 5);
  return done({ pass: steps.applySteps === 1 && steps.songChanged && steps.playOnScreen && steps.playing && steps.stopped && steps.exportOnScreen && riff === 'RIFF/WAVE' && !errs.length, steps }); }

// ---- Core path (Philip, 2026-11-03): an export never cuts audio ----
// Read from the very buffer the export writes (S().renderExport()). RMS over a stretch of seconds, all channels.
const rmsAt = (b, t0, t1) => { let s = 0, n = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c), i1 = Math.min(d.length, Math.floor(t1 * b.sampleRate));
  for (let i = Math.max(0, Math.floor(t0 * b.sampleRate)); i < i1; i++) { s += d[i] * d[i]; n++; } } return n ? Math.sqrt(s / n) : 0; };
// A vocal take that runs past the song's last bar is in the file to its end, and the file then dies away instead of
// stopping mid-sound.
export async function n6ExportTakeWhole() { await settle(700);
  const sr = 44100, sec = 30, ac = new OfflineAudioContext(1, sr * sec, sr), tb = ac.createBuffer(1, sr * sec, sr), td = tb.getChannelData(0);
  for (let i = 0; i < td.length; i++) td[i] = 0.25 * Math.sin(2 * Math.PI * 330 * i / sr);
  S().takeInstall(tb, 0); await settle(500);
  const b = await S().renderExport(), dur = b.length / b.sampleRate, end = rmsAt(b, sec - 1, sec - 0.2), tail = rmsAt(b, dur - 0.02, dur);
  return { pass: dur >= sec && end > 0.02 && tail < end / 20, seconds: +dur.toFixed(2), takeSeconds: sec, rmsLastSecondOfTake: +end.toFixed(4), rmsLast20ms: +tail.toFixed(5) }; }
// An imported song kept as the track ("Include it in my track") comes out whole, though it is longer than the
// arrangement: import length in, same length out at the detected tempo.
export async function n6ExportImportWhole() { await settle(700);
  const fi = [...document.querySelectorAll('input[type=file]')].find(f => /audio/.test(f.accept)); if (!fi) return { pass: false, why: 'no audio file input' };
  const dt = new DataTransfer(), sec = 30; dt.items.add(qaSongWav(sec)); fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true }));
  for (let k = 0; k < 60 && ($('rebuild').hidden || !$('rebuildRows').children.length); k++) await settle(500);
  const tempo = [...document.querySelectorAll('#rebuild button')].find(b => /^Use detected tempo/.test(b.textContent.trim())); if (tempo) { tempo.click(); await settle(500); }
  const inc = $('refInclude'); if (!inc) return { pass: false, why: 'no Include it in my track' };
  if (inc.getAttribute('aria-pressed') !== 'true') { inc.click(); await settle(500); }
  const b = await S().renderExport(), dur = b.length / b.sampleRate, last = rmsAt(b, sec - 1.5, sec - 0.5);
  return { pass: inc.getAttribute('aria-pressed') === 'true' && dur >= sec - 0.05 && last > 0.02, included: inc.getAttribute('aria-pressed'), seconds: +dur.toFixed(2), songSeconds: sec, rmsNearSongEnd: +last.toFixed(4) }; }

// ---- Core path (Philip, 2026-11-03): no control does nothing ----
// Every control a person can see in Studio on the demo song (the default view, then each editor tab) is pressed once:
// buttons and tabs clicked, menus moved to another choice, sliders moved, boxes ticked. Each must do something a person
// could notice within 400 ms: a real change to the page (an attribute or text whose VALUE changed, or nodes added or
// removed), a redrawn canvas, another control's value changing, the saved state changing, a sound starting, a file
// picker opening, a file being made, a question asked (confirm; answered No so nothing is lost), a fresh toast message,
// a scroll, or focus moving to something else. Before each press the page must go quiet; anything that changes while
// nothing is pressed (meters, readouts, a play button settling) is treated as noise from then on.
// Not pressed, each with its own check: Record, the exports, Play, Guided/Studio, the project menu's New and Open.
// BEHAVIOUR_ONLY: controls whose whole job is to change what happens NEXT, so a press shows nothing by design; each is
// named with the code that reads it.
const SWEEP_SKIP = /^(recX|export|exportX|navExport|exportAll|drFinish|play)$/;
const SWEEP_SKIP_TEXT = /^(Guided|Studio|New Project|Open Project|Start something new|Recent Projects|Save As)/;
const BEHAVIOUR_ONLY = { scaleLock: 'Stay in key: snaps the notes drawn next (snapScale reads scaleLockEl.checked live)',
  lyricSec: 'which section the words go to: with no words anywhere a switch looks like nothing (n6LyricSection holds it)' };
export async function n6NoDeadControls() { await demoInPanel();
  const OPTS = { subtree: true, childList: true, attributes: true, characterData: true, attributeOldValue: true, characterDataOldValue: true };
  // A text put back the same (a label repainted on a timer with what it already said) is not a change.
  const sameText = m => [...m.removedNodes, ...m.addedNodes].every(n => n.nodeType === 3) && [...m.removedNodes].map(n => n.data).join('') === [...m.addedNodes].map(n => n.data).join('');
  const real = m => m.type === 'attributes' ? m.oldValue !== m.target.getAttribute(m.attributeName) : m.type === 'characterData' ? m.oldValue !== m.target.data : !sameText(m);
  const inToast = n => !!$('toast') && ($('toast') === n || $('toast').contains(n));
  const noisy = new Set(); { const mo = new MutationObserver(ms => ms.forEach(m => { if (real(m)) noisy.add(m.target); })); mo.observe(document.body, OPTS); await settle(1500); mo.disconnect(); }
  let sounds = 0, pickers = 0, files = 0, asked = 0;
  const SP = AudioScheduledSourceNode.prototype, st = SP.start, IC = HTMLInputElement.prototype.click, CU = URL.createObjectURL, AC = HTMLAnchorElement.prototype.click, CF = window.confirm;
  SP.start = function (...a) { sounds++; return st.apply(this, a); };
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { pickers++; return; } return IC.call(this); };
  URL.createObjectURL = function (b) { files++; return CU.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { if (this.download) { files++; return; } return AC.call(this); };
  window.confirm = () => { asked++; return false; };
  const isVis = e => { if (!e || !e.isConnected || e.disabled || e.closest('[hidden]')) return false; const cs = getComputedStyle(e), r = e.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const name = e => (e.id ? '#' + e.id + ' ' : '') + '"' + (e.getAttribute('aria-label') || e.title || e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
  const values = skip => [...document.querySelectorAll('input, select, textarea')].filter(x => x !== skip && x.type !== 'file').map(x => x.type === 'checkbox' || x.type === 'radio' ? x.checked : x.value).join('\u0001');
  const noisyCanvas = new Set(), canvases = () => [...document.querySelectorAll('canvas')].filter(c => isVis(c) && !noisyCanvas.has(c) && c.width * c.height <= 4e6);
  const pix = cs => cs.map(c => { try { return c.toDataURL(); } catch (e) { return ''; } });
  const CTRL = 'button, select, input[type=range], input[type=checkbox], input[type=radio], [role=tab]';
  const seen = new Set(), dead = [], skipped = [], behaviour = [], pressed = [], why = {};
  const putBack = async changed => { if (changed) await press('z'); key('Escape'); if (window.__auraCloseSheet) window.__auraCloseSheet();
    ['welcome', 'createSheet'].forEach(id => { const d = $(id); if (d && d.classList.contains('on')) { const x = d.querySelector('#wClose, #crClose'); if (x) x.click(); } });
    if ($('guideSheet') && !$('guideSheet').hidden && $('askOpen')) $('askOpen').click(); if ($('play').classList.contains('on')) $('play').click();
    if ($('browser') && $('browser').classList.contains('vibes-full') && $('vibesClose')) $('vibesClose').click(); await settle(150); };
  const quiet = async () => { for (let q = 0; q < 8; q++) { let busy = false, cs = canvases(), c0 = pix(cs);
      const qmo = new MutationObserver(ms => ms.forEach(m => { if (real(m) && !noisy.has(m.target) && !inToast(m.target)) { busy = true; noisy.add(m.target); } })); qmo.observe(document.body, OPTS);
      await settle(250); qmo.disconnect(); pix(cs).forEach((d, k) => { if (d !== c0[k]) { busy = true; noisyCanvas.add(cs[k]); } }); if (!busy) return; } };
  const sweep = async () => { for (const e of [...document.querySelectorAll(CTRL)].filter(isVis)) {
      if (seen.has(e)) continue; seen.add(e); if (!isVis(e)) continue;
      if (SWEEP_SKIP.test(e.id || '') || SWEEP_SKIP_TEXT.test((e.textContent || '').trim())) { skipped.push(name(e)); continue; }
      if (BEHAVIOUR_ONLY[e.id]) { behaviour.push(name(e) + ': ' + BEHAVIOUR_ONLY[e.id]); continue; }
      e.scrollIntoView({ block: 'nearest' }); await settle(150); await quiet();
      // clear the toast, so a press that repeats the message still on screen is seen to answer
      { const T = $('toast'); if (T) { T.textContent = ''; T.classList.remove('show'); } }
      const s0 = S().snapshot(), c0 = sounds + pickers + files + asked, v0 = values(e), cs = canvases(), p0 = pix(cs), f0 = document.activeElement, hits = [];
      let toasted = false, scrolled = false; const onScroll = () => { scrolled = true; }; document.addEventListener('scroll', onScroll, true);
      const mo = new MutationObserver(ms => ms.forEach(m => { if (!real(m)) return; if (inToast(m.target)) { if (m.type !== 'attributes') toasted = true; } else if (!noisy.has(m.target)) hits.push(m.target); })); mo.observe(document.body, OPTS);
      if (e.tagName === 'SELECT') { if (e.options.length < 2) { mo.disconnect(); document.removeEventListener('scroll', onScroll, true); continue; } e.selectedIndex = (e.selectedIndex + 1) % e.options.length; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (e.type === 'range') { const lo = +e.min || 0, hi = +(e.max || 100), v = +e.value; e.value = String(Math.abs(v - lo) > Math.abs(hi - v) ? lo + (hi - lo) * 0.25 : lo + (hi - lo) * 0.75); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
      else e.click();
      await settle(400); mo.disconnect(); document.removeEventListener('scroll', onScroll, true);
      const changed = S().snapshot() !== s0, other = values(e) !== v0, drawn = pix(cs).some((d, k) => d !== p0[k]);
      const focusMoved = document.activeElement !== f0 && document.activeElement !== e && document.activeElement !== document.body, ev = sounds + pickers + files + asked > c0;
      pressed.push(name(e)); const sig = [hits.length ? 'dom:' + ((hits[0].id || hits[0].className || hits[0].nodeName) + '').slice(0, 24) : '', drawn ? 'canvas' : '', other ? 'values' : '',
        changed ? 'state' : '', ev ? 'sound/picker/file/asked' : '', toasted ? 'toast' : '', scrolled ? 'scroll' : '', focusMoved ? 'focus' : ''].filter(Boolean).join(' ');
      why[name(e)] = sig; if (!sig) dead.push(name(e));
      await putBack(changed); } };
  try { await sweep();
    for (const t of [...document.querySelectorAll('#studioETabs .etab')]) { if (!isVis(t)) continue; t.click(); await settle(500); await sweep(); }
  } finally { SP.start = st; HTMLInputElement.prototype.click = IC; URL.createObjectURL = CU; HTMLAnchorElement.prototype.click = AC; window.confirm = CF; }
  return { pass: dead.length === 0 && pressed.length > 40, pressed: pressed.length, dead, behaviourOnly: behaviour, notPressed: skipped, why }; }
// "Start with a vibe" (the Sounds column) brings the vibe tiles to the singer: the selected vibe is focused AND on screen.
// It used to scroll the column 352 px and focus a tile still below the fold, so nothing visible happened (found by the sweep).
export async function n6StartWithVibe() { await demoInPanel();
  const b = $('pathVibe'); if (!b || !b.getBoundingClientRect().width) return { pass: false, why: 'no Start with a vibe on screen' };
  b.click(); await settle(700); const a = document.activeElement, g = $('vgrid'), r = a ? a.getBoundingClientRect() : null;
  const onScreen = !!r && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  const h = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  // and the way back: the column's close brings Sounds back (the search box on screen again); so does Escape
  const sndHidden = !onScreenEl($('sndSearch')), x = $('vibesClose'), xOn = onScreenEl(x); if (xOn) { x.click(); await settle(400); }
  const backByX = onScreenEl($('sndSearch')); b.click(); await settle(500); key('Escape', { target: document.activeElement }); await settle(400); const backByEsc = onScreenEl($('sndSearch'));
  return { pass: !!a && g.contains(a) && onScreen && !!h && (h === a || a.contains(h)) && sndHidden && xOn && backByX && backByEsc,
    focused: a ? (a.textContent || '').trim().slice(0, 30) : null, inGrid: !!a && g.contains(a), onScreen, top: r ? Math.round(r.top) : null, vh: innerHeight, sndHidden, closeOnScreen: xOn, backByX, backByEsc }; }
const onScreenEl = e => { if (!e || e.closest('[hidden]')) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = e.getBoundingClientRect();
  if (!r.width || !r.height || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) return false; const q = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!q && (q === e || e.contains(q)); };
// "Clear melody" on a section with no melody says so (found by the sweep: it returned silently). The singer's way there:
// clear a section's melody (answering Yes), then press Clear melody again.
export async function n6ClearMelodyEmpty() { await demoInPanel(); await pickSec(1);
  const t = [...document.querySelectorAll('#studioETabs .etab')].find(x => /piano/i.test(x.textContent)); if (t) { t.click(); await settle(400); }
  const b = $('melClear'); if (!b) return { pass: false, why: 'no Clear melody' };
  const CF = window.confirm; let asked = 0; window.confirm = () => { asked++; return true; };
  try { b.click(); await settle(300); } finally { window.confirm = CF; }
  const s = JSON.parse(S().snapshot()), cleared = !((s.mel || [])[s.cp] || []).length; if (!cleared) return { pass: false, why: 'the first Clear melody did not clear the section', asked };
  const before = $('toast').textContent; let asked2 = 0; window.confirm = () => { asked2++; return false; };
  try { b.click(); await settle(300); } finally { window.confirm = CF; }
  const said = $('toast').textContent, shown = $('toast').classList.contains('show');
  return { pass: cleared && asked === 1 && asked2 === 0 && shown && said !== before && /no melody|nothing to clear/i.test(said), cleared, askedFirst: asked, askedAgain: asked2, said, shown }; }

// ---- Core path at the desk (Philip, 2026-11-03): your song in, Aura matched to it, your voice on it, one file out ----
// Pressed as a person would at 1440, only controls on screen: Import audio (the Sounds column), the picker gets a 30 s
// song made in the page, Use detected tempo, Apply the key and chords, Include it in my track, then a vocal take (put
// in through the app's own take path; a real microphone is the singer's test, and e12RealRecord covers recording with
// Chromium's test microphone), then the top bar's ⋯, Export WAV. The WAV must hold the whole song and the voice, and end cleanly.
export async function n6DeskCorePath() { await settle(900); const steps = {};
  const errs = [], onErr = e => errs.push(String(e.message || (e.reason && e.reason.message) || e.reason || e)); addEventListener('error', onErr); addEventListener('unhandledrejection', onErr);
  const done = r => { removeEventListener('error', onErr); removeEventListener('unhandledrejection', onErr); return r; };
  const pick = { el: null }, IC = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { pick.el = this; return; } return IC.call(this); };
  try { steps.importOnScreen = onScreen($('dashImport')); if (!steps.importOnScreen) return done({ pass: false, why: 'Import audio not on screen', steps }); $('dashImport').click(); await settle(300); }
  finally { HTMLInputElement.prototype.click = IC; }
  if (!pick.el) return done({ pass: false, why: 'Import audio opened no picker', steps });
  const sec = 30, dt = new DataTransfer(); dt.items.add(qaSongWav(sec)); pick.el.files = dt.files; pick.el.dispatchEvent(new Event('change', { bubbles: true }));
  for (let k = 0; k < 60 && ($('rebuild').hidden || !$('rebuildRows').children.length); k++) await settle(500);
  steps.rebuildShown = !$('rebuild').hidden && $('rebuildRows').children.length > 0; if (!steps.rebuildShown) return done({ pass: false, why: 'no rebuild card', steps });
  const tempo = byText('#rebuild button', /^Use detected tempo/); steps.tempo = !!tempo; if (tempo) { tempo.click(); await settle(500); }
  const apply = byText('#rebuildRows button', /^Apply the key and chords/); steps.applyOnScreen = !!apply; if (!apply) return done({ pass: false, why: 'Apply the key and chords not on screen', steps });
  const d0 = S().undoDepth(); apply.click(); await settle(700); steps.applySteps = S().undoDepth() - d0;
  steps.includeOnScreen = onScreen($('refInclude')); if (!steps.includeOnScreen) return done({ pass: false, why: 'Include it in my track not on screen', steps });
  $('refInclude').click(); await settle(500); steps.included = $('refInclude').getAttribute('aria-pressed') === 'true';
  const sr = 44100, vs = 8, ac = new OfflineAudioContext(1, sr * vs, sr), vb = ac.createBuffer(1, sr * vs, sr), vd = vb.getChannelData(0);
  for (let i = 0; i < vd.length; i++) vd[i] = 0.3 * Math.sin(2 * Math.PI * 523.25 * i / sr) * Math.min(1, i / 2000, (vd.length - i) / 2000);
  S().takeInstall(vb, 0); await settle(500); steps.take = S().takeClips().length > 0;
  const blobs = [], CU = URL.createObjectURL, AC = HTMLAnchorElement.prototype.click; let fileName = null;
  URL.createObjectURL = function (b) { if (b instanceof Blob) blobs.push(b); return CU.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { if (this.download) { fileName = this.download; return; } return AC.call(this); };
  // the top bar's primary Export at the desk (S7, 13.9.0-rc.5; before it, ⋯ then Export WAV)
  try { const ex = $('exportX'); steps.exportOnScreen = onScreen(ex); if (!steps.exportOnScreen) return done({ pass: false, why: 'the top bar Export is not on screen', steps }); ex.click();
    for (let k = 0; k < 120 && !blobs.some(b => b.size > 1000); k++) await settle(500); } finally { URL.createObjectURL = CU; HTMLAnchorElement.prototype.click = AC; }
  const wav = blobs.find(b => b.size > 1000); if (!wav) return done({ pass: false, why: 'Export made no file', steps });
  const buf = await new OfflineAudioContext(2, 44100, 44100).decodeAudioData(await wav.arrayBuffer()), dur = buf.duration;
  steps.file = fileName; steps.seconds = +dur.toFixed(2); steps.rmsSongEnd = +rmsAt(buf, sec - 1.5, sec - 0.5).toFixed(4); steps.rmsVoice = +rmsAt(buf, 2, 6).toFixed(4); steps.rmsLast20ms = +rmsAt(buf, dur - 0.02, dur).toFixed(5); steps.pageErrors = errs.slice(0, 5);
  return done({ pass: steps.applySteps === 1 && steps.included && steps.take && dur >= sec - 0.05 && steps.rmsSongEnd > 0.02 && steps.rmsVoice > 0.05 && /vocals/.test(fileName || '') && !errs.length, steps }); }
// The lyrics section menu decides where the words go. With no words anywhere a switch looks like nothing, so the sweep
// lists it as behaviour-only; this holds the behaviour: words typed for one section stay with it, the menu brings
// each section's own words back, and the saved state carries both.
export async function n6LyricSection() { await demoInPanel();
  const t = [...document.querySelectorAll('#studioETabs .etab')].find(x => /lyric/i.test(x.textContent)); if (t) { t.click(); await settle(400); }
  const sel = $('lyricSec'), box = $('lyricText'); if (!sel || !box) return { pass: false, why: 'no lyrics section menu or text box' };
  const to = async v => { sel.value = String(v); sel.dispatchEvent(new Event('change', { bubbles: true })); await settle(200); };
  const type = async w => { box.value = w; box.dispatchEvent(new Event('input', { bubbles: true })); await settle(600); };
  await to(1); await type('QA words for two'); await to(2); const emptyThere = box.value; await type('QA words for three'); await to(1); const backOne = box.value;
  const ly = JSON.parse(S().snapshot()).ly || {}, t1 = (ly.t || {})['1'], t2 = (ly.t || {})['2'];
  return { pass: emptyThere === '' && backOne === 'QA words for two' && t1 === 'QA words for two' && t2 === 'QA words for three', emptyThere, backOne, saved: { 1: t1, 2: t2 } }; }
// The Your song tab (core path, 2026-11-03): hidden with no song imported; after an import it is selected and holds the
// song's card and the reconstruction; after the Mixer it brings both back.
export async function n6YourSongTab() { await settle(900); const tab = $('etabRef'); if (!tab) return { pass: false, why: 'no Your song tab' };
  const before = onScreenEl(tab);
  const pk = { el: null }, IC = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { pk.el = this; return; } return IC.call(this); };
  try { $('dashImport').click(); await settle(300); } finally { HTMLInputElement.prototype.click = IC; }
  const dt = new DataTransfer(); dt.items.add(qaSongWav(10)); pk.el.files = dt.files; pk.el.dispatchEvent(new Event('change', { bubbles: true }));
  for (let k = 0; k < 60 && ($('rebuild').hidden || !$('rebuildRows').children.length); k++) await settle(500);
  const host = $('studioEdHost'), held = () => host.contains($('rebuild')) && host.contains($('refCard'));
  const after = { shown: onScreenEl(tab), selected: tab.getAttribute('aria-selected') === 'true', held: held() };
  document.querySelector('#studioETabs .etab[data-ed="mix"]').click(); await settle(400); const gone = !held();
  tab.click(); await settle(400); const back = held() && tab.getAttribute('aria-selected') === 'true';
  return { pass: !before && after.shown && after.selected && after.held && gone && back, hiddenBefore: !before, after, leftForMixer: gone, back }; }
// Perform's "Next version" with one version, and its Pads with no sound made, say why and where to go, instead of a
// press that does nothing (found by the sweep, 2026-11-03).
export async function n6PerformSaysWhy() { await demoInPanel();
  const t = [...document.querySelectorAll('#studioETabs .etab')].find(x => /perform/i.test(x.textContent)); if (t) { t.click(); await settle(400); }
  const said = async sel => { const b = document.querySelector(sel); if (!b) return 'no control'; const before = $('toast').textContent; $('toast').textContent = ''; b.click(); await settle(300);
    return $('toast').classList.contains('show') && $('toast').textContent ? $('toast').textContent : '(nothing)'; };
  const versions = JSON.parse(S().snapshot()).var, pads = document.querySelectorAll('.sndpad').length;
  const nv = await said('.perfbtn[data-act="nextVersion"]'), p1 = await said('.perfbtn[data-act="slice1"]');
  return { pass: /version/i.test(nv) && /Add as variation/.test(nv) && /Make a sound/.test(p1), versionsBefore: versions && versions.items ? versions.items.length : 0, padsMade: pads, nextVersionSaid: nv, pad1Said: p1 }; }

// ---- Your song, as it is (Philip, 2026-11-03: "Fix all three, then ship") ----
// A mastered-like STEREO test song (different left and right, peaks at -1 dBFS) comes in through Import audio and the
// singer presses only "Include it in my track". Then: the project takes the song's own tempo (no tape-speed change), and
// with Aura's own channels at zero the export is the song as it was, each side: correlation above 0.999, level within
// 0.1 dB, and it cancels against the original by 40 dB or more. Aura's master processing, the channel's high-pass,
// EQ, pan and sends no longer touch it.
function masteredStereo(sec = 12) { const sr = 44100, n = sr * sec, L = new Float32Array(n), R = new Float32Array(n), beat = 0.6; let s1 = 7, s2 = 11;
  const r1 = () => { s1 = (s1 * 16807) % 2147483647; return s1 / 2147483647 * 2 - 1; }, r2 = () => { s2 = (s2 * 48271) % 2147483647; return s2 / 2147483647 * 2 - 1; };
  let a0 = 0, a1 = 0, c0 = 0, c1 = 0;
  for (let i = 0; i < n; i++) { const t = i / sr, bt = t % beat, kick = bt < 0.15 ? Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-bt * 30)) * bt) * Math.exp(-bt * 18) : 0;
    const w1 = r1(), w2 = r2(); a0 = 0.99 * a0 + 0.1 * w1; a1 = 0.6 * a1 + w1; c0 = 0.99 * c0 + 0.1 * w2; c1 = 0.6 * c1 + w2; const bass = 0.25 * Math.sin(2 * Math.PI * 55 * t);
    L[i] = 0.3 * (a0 + 0.2 * a1) + bass + 0.5 * kick + 0.05 * Math.sin(2 * Math.PI * 9000 * t); R[i] = 0.3 * (c0 + 0.2 * c1) + bass + 0.5 * kick + 0.05 * Math.sin(2 * Math.PI * 6000 * t); }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); for (let i = 0; i < n; i++) { L[i] *= 0.89 / pk; R[i] *= 0.89 / pk; }
  const buf = new ArrayBuffer(44 + n * 4), v = new DataView(buf), w = (o, s) => [...s].forEach((c, k) => v.setUint8(o + k, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  const pcm = new Int16Array(buf, 44); for (let i = 0; i < n; i++) { pcm[2 * i] = Math.round(L[i] * 32767); pcm[2 * i + 1] = Math.round(R[i] * 32767); }
  const back = c => Float32Array.from({ length: n }, (_, i) => pcm[2 * i + c] / 32767);
  return { file: new File([buf], 'qa-master-stereo.wav', { type: 'audio/wav' }), L: back(0), R: back(1) }; }
const corrOf = (x, y) => { let n = 0, a = 0, b = 0; for (let i = 0; i < x.length; i++) { n += x[i] * y[i]; a += x[i] * x[i]; b += y[i] * y[i]; } return n / Math.sqrt(a * b); };
export async function n6ImportAsItIs() { await settle(900); const { file, L, R } = masteredStereo(12);
  const pk = { el: null }, IC = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { pk.el = this; return; } return IC.call(this); };
  try { $('dashImport').click(); await settle(300); } finally { HTMLInputElement.prototype.click = IC; }
  const dt = new DataTransfer(); dt.items.add(file); pk.el.files = dt.files; pk.el.dispatchEvent(new Event('change', { bubbles: true }));
  for (let k = 0; k < 60 && ($('rebuild').hidden || !$('rebuildRows').children.length); k++) await settle(500);
  const detected = +(($('smpBpm') || {}).value || 0), bpm0 = +$('bpm').value;
  $('refInclude').click(); await settle(500); const bpm1 = +$('bpm').value;
  ['kick', 'snare', 'hats', 'bass', 'chords', 'melody', 'vocals'].forEach(id => { const c = document.querySelector('.strip[data-g="' + id + '"] .ctl[data-k="vol"]'); if (c && c.__ctl) c.__ctl.set(0, true); }); await settle(400);
  const out = await S().renderExport(), oL = out.getChannelData(0), oR = out.numberOfChannels > 1 ? out.getChannelData(1) : oL;
  let lag = 0, bv = -Infinity; for (let d = 0; d <= 6000; d++) { let s = 0; for (let i = 0; i < 44100; i += 3) s += L[i] * (oL[i + d] || 0); if (s > bv) { bv = s; lag = d; } }
  const n = Math.min(L.length, oL.length - lag) - 100, side = (x, o) => { const a = x.subarray(0, n), b = o.subarray(lag, lag + n);
    let sab = 0, saa = 0; for (let i = 0; i < n; i++) { sab += a[i] * b[i]; saa += a[i] * a[i]; } let r = 0, bb = 0; for (let i = 0; i < n; i++) { const e = b[i] - a[i]; r += e * e; bb += b[i] * b[i]; }
    return { corr: +corrOf(a, b).toFixed(5), levelDb: +(10 * Math.log10(bb / saa)).toFixed(2), nullDb: +(10 * Math.log10(r / saa)).toFixed(1) }; };
  const l = side(L, oL), r = side(R, oR), good = s => s.corr > 0.999 && Math.abs(s.levelDb) < 0.1 && s.nullDb <= -40;
  // the tempo control holds whole BPM, so the project takes the nearest one (the song itself plays at its own speed)
  const want = Math.max(60, Math.min(160, Math.round(detected)));
  // and the song's card says what happens: it keeps its own speed in your track too (it said it followed the tempo)
  const hint = (([...document.querySelectorAll('#refCard .refhint')].find(x => /speed/i.test(x.textContent)) || {}).textContent || '').trim(), hintTrue = /in your track too/i.test(hint) && !/Inside your track it follows your project tempo/i.test(hint);
  return { pass: !!detected && bpm1 === want && good(l) && good(r) && hintTrue, cardSays: hint, detected, tempoWanted: want, tempoBefore: bpm0, tempoAfterInclude: bpm1, lagSamples: lag, left: l, right: r }; }
// The song room's Remix plan keeps the song's bass unless the singer ticks the cut (it was ticked by default, so
// "Apply selected moves" cut everything under 140 Hz). Applying the plan as it opens leaves the song's high-pass alone.
export async function n6RemixKeepsBass() { await settle(900);
  const fi = [...document.querySelectorAll('input[type=file]')].find(f => /audio/.test(f.accept)); const dt = new DataTransfer(); dt.items.add(qaSongWav(10)); fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true }));
  for (let k = 0; k < 60 && !document.querySelector('#smpPlan input[data-m="lowcut"]'); k++) await settle(500);
  const cut = document.querySelector('#smpPlan input[data-m="lowcut"]'); if (!cut) return { pass: false, why: 'no Remix plan with a low cut' };
  const ticked = cut.checked, hp0 = +($('smpHP') || {}).value; const apply = $('smpApply'); if (apply) { apply.click(); await settle(500); }
  const hp1 = +($('smpHP') || {}).value;
  return { pass: !ticked && hp1 === hp0, lowCutTickedByDefault: ticked, highPassBefore: hp0, highPassAfterApply: hp1 }; }

// ---- S7: the top bar (13.9.0-rc.5), as in docs/mockups/studio-dashboard-target.png ----
const TOP = ['emblem', 'projName', 'saveScope', 'undoX', 'redoX', 'stopX', 'play', 'recX', 'tempoBtn', 'keyBtn', 'meterX', 'readout', 'loopX', 'modeSwitch', 'exportX'];
const isOn = b => !!b && (b.getAttribute('aria-pressed') === 'true' || b.classList.contains('on'));
// One row, at most 56 px, every group on screen in the picture's order, Export the filled primary button.
export async function n7Row() { await settle(800);
  const bar = $('xport'), r = bar.getBoundingClientRect(), els = TOP.map(id => [id, $(id)]);
  const missing = els.filter(([, e]) => !onScreenEl(e)).map(([id]) => id);
  const xs = els.filter(([, e]) => e).map(([id, e]) => [id, e.getBoundingClientRect()]);
  const ordered = xs.every((x, i) => i === 0 || x[1].left >= xs[i - 1][1].left - 1);
  const oneRow = xs.every(([, q]) => q.top >= r.top - 1 && q.bottom <= r.bottom + 1) && r.height <= 56.5;
  const bg = $('exportX') ? getComputedStyle($('exportX')).backgroundColor : '', primary = !!bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg);
  return { pass: !missing.length && ordered && oneRow && primary, missing, ordered, oneRow, height: Math.round(r.height), order: xs.map(([id]) => id), exportBg: bg }; }
// ■ stops playback and puts the position back at the start.
export async function n7Stop() { await settle(800); const st = $('stopX'); if (!st) return { pass: false, why: 'no Stop' };
  $('play').click(); await settle(1500); const was = isOn($('play')); st.click(); await settle(500);
  return { pass: was && !isOn($('play')) && /^1[.·\s]+1$/.test($('readout').textContent.trim()), playedFirst: was, playingAfter: isOn($('play')), position: $('readout').textContent.trim() }; }
// "N BPM ⌄": shows the tempo; its popover changes it in one undo step; the metronome lives there.
export async function n7Tempo() { await settle(800); const b = $('tempoBtn'); if (!b) return { pass: false, why: 'no tempo button' };
  const says = () => b.textContent.replace(/\s+/g, ' ').trim(), s0 = says(); b.click(); await settle(300);
  const bpm = $('bpm'), shown = onScreenEl(bpm), met = !!$('metX') && onScreenEl($('metX')), d0 = S().undoDepth(), to = +bpm.value === 120 ? 121 : 120;
  bpm.value = String(to); bpm.dispatchEvent(new Event('input', { bubbles: true })); bpm.dispatchEvent(new Event('change', { bubbles: true })); await settle(400);
  return { pass: new RegExp('^' + s0.match(/\d+/)[0] + ' BPM').test(s0) && shown && met && says().startsWith(to + ' BPM') && S().undoDepth() - d0 === 1, before: s0, after: says(), sliderShown: shown, metronomeThere: met }; }
// "Key ⌄": shows root and mode; its popover changes them in one undo step, and the button and Song settings follow.
// (The popover has its own two menus; the real #keyRoot and #keyMode stay in Song settings, so they must agree.)
export async function n7Key() { await settle(800); const b = $('keyBtn'); if (!b) return { pass: false, why: 'no key button' };
  const s0 = b.textContent.replace(/\s+/g, ' ').trim(); b.click(); await settle(300); const kr = $('keyPopRoot'), km = $('keyPopMode');
  const shown = onScreenEl(kr) && onScreenEl(km), d0 = S().undoDepth(), to = String((+$('keyRoot').value + 2) % 12);
  if (!kr) return { pass: false, why: 'no key menu in the popover', before: s0 };
  kr.value = to; kr.dispatchEvent(new Event('change', { bubbles: true })); await settle(500); const s1 = b.textContent.replace(/\s+/g, ' ').trim();
  return { pass: /^[A-G][#b]? (major|minor|dorian|phrygian|harmonic minor)/i.test(s0) && shown && s1 !== s0 && $('keyRoot').value === to && S().undoDepth() - d0 === 1,
    before: s0, after: s1, shown, songSettingsRoot: $('keyRoot').value, want: to, undoSteps: S().undoDepth() - d0 }; }
// 4/4, and bar.beat while playing.
export async function n7MeterPosition() { await settle(800); const m = $('meterX'); $('play').click(); await settle(1800); const pos = $('readout').textContent.trim(); $('play').click(); await settle(300);
  return { pass: !!m && m.textContent.trim() === '4/4' && /^\d+\.\d$/.test(pos), meter: m && m.textContent.trim(), position: pos }; }
// One Loop toggle: on plays the section, off the song.
export async function n7Loop() { await settle(800); const l = $('loopX'); if (!l) return { pass: false, why: 'no Loop toggle' };
  const mode = () => (document.querySelector('#modeSeg button.on') || {}).dataset?.mode; const a0 = isOn(l), m0 = mode();
  l.click(); await settle(300); const a1 = isOn(l), m1 = mode(); l.click(); await settle(300); const a2 = isOn(l), m2 = mode();
  const ok = [[a0, m0], [a1, m1], [a2, m2]].every(([a, m]) => (a ? m === 'pattern' : m === 'song')) && a0 !== a1 && a1 !== a2;
  return { pass: ok, states: [[a0, m0], [a1, m1], [a2, m2]] }; }
// Export, the primary button, makes the WAV in one click.
export async function n7Export() { await settle(800); const x = $('exportX'); if (!x) return { pass: false, why: 'no Export button' };
  const blobs = [], CU = URL.createObjectURL, AC = HTMLAnchorElement.prototype.click; let name = null;
  URL.createObjectURL = function (b) { if (b instanceof Blob) blobs.push(b); return CU.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { if (this.download) { name = this.download; return; } return AC.call(this); };
  try { x.click(); for (let k = 0; k < 120 && !blobs.some(b => b.size > 1000); k++) await settle(500); } finally { URL.createObjectURL = CU; HTMLAnchorElement.prototype.click = AC; }
  const wav = blobs.find(b => b.size > 1000); let riff = null; if (wav) { const h = new Uint8Array(await wav.slice(0, 12).arrayBuffer()); riff = String.fromCharCode(...h.slice(0, 4)) + '/' + String.fromCharCode(...h.slice(8, 12)); }
  return { pass: riff === 'RIFF/WAVE' && /\.wav$/.test(name || ''), file: name, bytes: wav ? wav.size : 0, riff }; }
// The project name: click to rename, Enter keeps it, a reload shows it; ⌄ opens the Project menu.
export async function n7NameSet() { await settle(800); const n = $('projName'); if (!n) return { pass: false, why: 'no name' };
  n.click(); await settle(200); const ed = document.activeElement, editable = !!ed && (ed.tagName === 'INPUT' || ed.isContentEditable);
  if (!editable) return { pass: false, why: 'clicking the name does not open it for renaming', active: ed && (ed.id || ed.tagName) };
  if (ed.tagName === 'INPUT') ed.value = 'QA Evening'; else ed.textContent = 'QA Evening'; ed.dispatchEvent(new Event('input', { bubbles: true }));
  key('Enter', { target: ed }); await settle(400); const shown = $('projName').textContent.replace(/[•\s]+$/, '').trim();
  const chev = $('projMenuBtn'); if (chev) { chev.click(); await settle(300); }
  const items = [...document.querySelectorAll('#projmenu .projmi')].filter(b => onScreenEl(b)).map(b => b.textContent.trim());
  const want = ['New', 'Open', 'Save', 'Save As', 'Recent', 'Help', 'Export MIDI'], has = want.filter(w => items.some(i => i.startsWith(w)));
  key('Escape'); await settle(200);
  return { pass: shown === 'QA Evening' && has.length === want.length, shown, menu: items, missingFromMenu: want.filter(w => !has.includes(w)) }; }
export async function n7NameKept() { await settle(1200); const t = ($('projName') || {}).textContent || ''; return { pass: t.replace(/[•\s]+$/, '').trim() === 'QA Evening', shown: t }; }
// With Loop on, Perform's Section ▶ and ◀ Section move the loop to the next or previous section; at the last one they say
// so. They used to move only the Song position, which Loop never plays: a press that did nothing, found by the sweep once
// the S7 bar's Loop was among the controls it presses. With Loop off they move the Song position, as before.
export async function n7PerformSectionLoop() { await demoInPanel();
  const t = [...document.querySelectorAll('#studioETabs .etab')].find(x => /perform/i.test(x.textContent)); if (t) { t.click(); await settle(400); }
  const loop = $('loopX'), nx = () => document.querySelector('.perfbtn[data-act="nextSection"]'), pv = () => document.querySelector('.perfbtn[data-act="prevSection"]');
  if (!loop || !nx() || !pv()) return { pass: false, why: 'no Loop toggle or no Perform section buttons' };
  if (loop.getAttribute('aria-pressed') !== 'true') { loop.click(); await settle(200); }
  const starts = secStarts(), sec = s => document.querySelector(`#saSecs .sa-sec[data-start="${s}"]`);
  if (starts.length < 3) return { pass: false, why: 'the demo song should have several sections', starts };
  sec(starts[0]).click(); await settle(300); const at0 = cardStart();
  nx().click(); await settle(300); const at1 = cardStart();
  pv().click(); await settle(300); const at2 = cardStart();
  sec(starts[starts.length - 1]).click(); await settle(300);
  $('toast').textContent = ''; $('toast').classList.remove('show'); nx().click(); await settle(300);
  const said = $('toast').classList.contains('show') ? $('toast').textContent : '', atLast = cardStart();
  loop.click(); await settle(200); const r0 = $('readout').textContent; nx().click(); await settle(200); const r1 = $('readout').textContent;
  return { pass: at0 === starts[0] && at1 === starts[1] && at2 === starts[0] && atLast === starts[starts.length - 1] && /last section/i.test(said) && r1 !== r0,
    starts, cardAt: [at0, at1, at2, atLast], atLastSaid: said, songPositionWithLoopOff: [r0, r1] }; }
// The name always belongs to the song stored here: a share link (a different song) opened and left must not leave this
// project's name on the link's song, or the link's "Untitled" on this project.
async function n7Rename(to) { const n = $('projName'); n.click(); await settle(200); const ed = document.activeElement;
  if (!ed || !ed.isContentEditable) return false; ed.textContent = to; key('Enter', { target: ed }); await settle(500); return true; }
const n7Swing = v => { const c = $('swing'); c.value = String(v); c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); };
const n7Store = () => { let sw = null; try { const o = JSON.parse(localStorage.getItem('aura-studio-v6') || 'null'); sw = o && (o.swing ?? o.sw ?? null); } catch (e) {}
  return { name: localStorage.getItem('aura-studio-name'), storedSwing: sw }; };
export async function n7NameLinkSetup() { await settle(800); if (!(await n7Rename('Mine'))) return { pass: false, why: 'the name did not open for renaming' };
  n7Swing(30); await settle(400); const link = S().shareData(); n7Swing(20); await settle(5000);
  const st = n7Store(); sessionStorage.setItem('n7nl1', JSON.stringify(st));
  return { pass: $('projName').textContent.replace(/[•\s]+$/, '').trim() === 'Mine' && $('swing').value === '20', store: st, goto: '/rc/?link=1#p=' + link }; }
// On arrival (before Aura saves the link's song here, which it does within seconds, unasked: found here, not changed by
// S7) the stored name must still be this project's; after that save it is the link's. Either way it names the stored song.
export async function n7NameLinkOpened() { const early = n7Store(), earlyOk = (early.storedSwing === 20) === (early.name === 'Mine');
  await settle(1200); const shown = $('projName').textContent.replace(/[•\s]+$/, '').trim();
  await settle(5000); const st = n7Store(), lateOk = (st.storedSwing === 20) === (st.name === 'Mine');
  sessionStorage.setItem('n7nl2', JSON.stringify(Object.assign({ shownOnLink: shown, swingOnLink: $('swing').value, early, earlyOk, lateOk }, st)));
  return { pass: location.hash.startsWith('#p=') && shown === 'Untitled' && $('swing').value === '30' && earlyOk && lateOk, shown, early, store: st, goto: '/rc/' }; }
export async function n7NameLinkLeft() { await settle(1200); const shown = $('projName').textContent.replace(/[•\s]+$/, '').trim(), sw = $('swing').value;
  const want = sw === '20' ? 'Mine' : 'Untitled';
  const onLink = JSON.parse(sessionStorage.getItem('n7nl2') || 'null');
  return { pass: !location.hash && shown === want && !!onLink && onLink.earlyOk && onLink.lateOk, shown, swingHere: sw, want, afterRename: JSON.parse(sessionStorage.getItem('n7nl1') || 'null'), onTheLink: JSON.parse(sessionStorage.getItem('n7nl2') || 'null'), store: n7Store() }; }
// Rebuild with Aura's melody ideas, found in an imported song with a clear line: ▶ Audition plays them and Apply melody
// ideas puts them in the section, as one undo step. On 13.9.0-rc.3 and rc.4 both said "Every note is dropped" and did
// nothing: Preserve's melodyKept() (yes or no) shared its name with the ideas' melodyKept() (the notes) and replaced it.
function qaMelodyWav(sec = 12) { const sr = 44100, n = sr * sec, pcm = new Int16Array(n), beat = 60 / 100, line = [523.25, 587.33, 659.25, 783.99];
  for (let i = 0; i < n; i++) { const t = i / sr, b = t % beat, k = Math.floor(t / 0.5) % line.length, u = t % 0.5, env = Math.min(1, u / 0.02, (0.5 - u) / 0.02);
    const kick = b < 0.12 ? Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-b * 40)) * b) * Math.exp(-b * 25) : 0;
    pcm[i] = Math.max(-1, Math.min(1, 0.35 * kick + 0.45 * env * Math.sin(2 * Math.PI * line[k] * t))) * 32767; }
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, j) => v.setUint8(o + j, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, pcm[i], true);
  return new File([buf], 'qa-melody-song.wav', { type: 'audio/wav' }); }
export async function n6MelodyIdeasApply() { await settle(900); const steps = {};
  const pick = { el: null }, IC = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { pick.el = this; return; } return IC.call(this); };
  try { $('dashImport').click(); await settle(300); } finally { HTMLInputElement.prototype.click = IC; }
  if (!pick.el) return { pass: false, why: 'Import audio opened no picker' };
  const dt = new DataTransfer(); dt.items.add(qaMelodyWav(12)); pick.el.files = dt.files; pick.el.dispatchEvent(new Event('change', { bubbles: true }));
  for (let k = 0; k < 60 && ($('rebuild').hidden || !$('rebuildRows').children.length); k++) await settle(500);
  const find = document.querySelector('#rebuild .rbfind'); steps.findShown = !!find; if (!find) return { pass: false, why: 'no Find melody ideas', steps };
  find.click(); let app = null; for (let k = 0; k < 20 && !(app = byText('#rebuild button', /^Apply melody ideas/)); k++) await settle(300);
  steps.ideasFound = !!app; if (!app) return { pass: false, why: 'no melody ideas were found in a song with a clear line', steps, said: ($('rebuild').textContent.match(/No clear melodic line[^.]*\./) || [''])[0] };
  const say = async b => { $('toast').textContent = ''; b.click(); await settle(400); return $('toast').textContent; };
  steps.auditionSaid = await say(byText('#rebuild button', /Audition/));
  const snap = () => JSON.parse(S().snapshot()), cp = snap().cp || 0, before = (snap().mel[cp] || []).length, d0 = S().undoDepth();
  steps.applySaid = await say(app); const after = (snap().mel[snap().cp || 0] || []).length; steps.undoSteps = S().undoDepth() - d0;
  return { pass: /Auditioning melody ideas/.test(steps.auditionSaid) && after > 0 && JSON.stringify(snap().mel[cp]) !== '[]' && steps.undoSteps === 1 && !/dropped/.test(steps.applySaid),
    notesBefore: before, notesAfter: after, steps }; }
// No two functions share a name at the same level of app.js: the later one silently replaces the earlier everywhere (it
// is how Preserve's melodyKept() broke the melody ideas). Reads the served file; a file it cannot read fails.
export async function n6NoDuplicateFunctions() {
  const r = await fetch('app.js', { cache: 'no-store' }), t = r.ok ? await r.text() : '', seen = new Map(), dup = [];
  t.split('\n').forEach((l, i) => { const m = /^( *)(?:async )?function ([A-Za-z_$][\w$]*)\s*\(/.exec(l); if (!m) return;
    const k = m[1].length + ':' + m[2]; if (seen.has(k)) dup.push(m[2] + ' at lines ' + seen.get(k) + ' and ' + (i + 1)); else seen.set(k, i + 1); });
  return { pass: r.ok && t.length > 100000 && seen.size > 500 && dup.length === 0, status: r.status, bytes: t.length, declarationsRead: seen.size + dup.length, duplicates: dup }; }

// ---- S8: the Sounds panel (13.9.0-rc.6), as in docs/mockups/studio-dashboard-target.png ----
const MX = () => window.__auraMix || {};
const featCard = id => document.querySelector(`#featPresets .feat-card[data-preset="${id}"]`);
// ▶ on a preset card lets you hear that sound and changes nothing: the saved state, the undo depth, the chord and bass
// sounds stay as they were, and the song does not start. (On 13.9.0-rc.5 ▶ applied the preset and played the song.)
export async function n8PreviewPlays() { await settle(800);
  const card = featCard('warm-keys'), aud = card && card.querySelector('.aud'); if (!aud) return { pass: false, why: 'no ▶ on the Warm keys card' };
  if (!(await MX().meterReady())) return { pass: false, why: 'the meter did not start' };
  const s0 = S().snapshot(), d0 = S().undoDepth(), quiet = (await MX().meterCollect(300)).__master;
  if (!quiet || !quiet.pkDb) return { pass: false, why: 'no Master reading before the press (a silent Master still reads -inf)' };
  aud.click(); const c = await MX().meterCollect(900), m = c.__master; await settle(300);
  const peak = m ? Math.max(...m.pkDb) : -Infinity, quietPeak = quiet ? Math.max(...quiet.pkDb) : -Infinity;
  const same = S().snapshot() === s0, steps = S().undoDepth() - d0, songOn = $('play').classList.contains('on');
  return { pass: peak > -40 && quietPeak < -80 && same && steps === 0 && !songOn,
    masterPeakDb: String(+peak.toFixed(1)), beforeDb: String(quietPeak), projectUnchanged: same, undoSteps: steps, songStarted: songOn }; }
// A press on the card itself (not its ▶) applies its sound, in one undo step that Undo takes back.
export async function n8CardApplies() { await settle(800);
  const card = featCard('deep-pulse'); if (!card) return { pass: false, why: 'no Deep pulse card' };
  const bs = $('bassStyle'), before = bs.value; if (before === '808') return { pass: false, why: 'the bass is already 808, so the press would prove nothing' };
  const d0 = S().undoDepth(); (card.querySelector('.feat-apply') || card).click(); await settle(400);
  const applied = bs.value, steps = S().undoDepth() - d0; $('undoX').click(); await settle(500); const undone = bs.value;
  return { pass: applied === '808' && steps === 1 && undone === before, before, applied, undoSteps: steps, afterUndo: undone }; }
// Three featured cards, each with a thumbnail drawn on the device (not blank, unlike the others), its name and tags whole,
// its own ▶ (not inside another button), and a waveform drawn from its own sound: not flat, unlike the others, and
// shaped by it: Warm keys' two chords show as two bursts, Deep pulse's four bass hits as four, Air texture's held pad as one.
const n8Cols = cv => { const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, cols = [];
  for (let x = 0; x < w; x++) { let n = 0; for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 40) n++; cols.push(n / h); } return cols; };
// Bars are drawn on every other column, so the envelope is the max over ±6 columns before counting runs above 20 % of it.
const n8Bursts = cols => { const env = cols.map((_, i) => Math.max(...cols.slice(Math.max(0, i - 6), i + 7))), mx = Math.max(...env);
  let k = 0, on = false; for (const c of env) { const hi = c > mx * 0.2; if (hi && !on) k++; on = hi; } return k; };
const n8Thumb = cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let r = 0, g = 0, b = 0, n = 0, lit = 0, v = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] > 0) lit++; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  r /= n; g /= n; b /= n; for (let i = 0; i < d.length; i += 4) v += Math.abs(d[i] - r) + Math.abs(d[i + 1] - g) + Math.abs(d[i + 2] - b); return { lit: lit / n, rgb: [r, g, b].map(Math.round), spread: v / n }; };
export async function n8Cards() { await settle(1800);
  // The featured three are the cards on screen; every preset behind a feeling must be drawn as well (n8Chips shows them).
  const all = [...document.querySelectorAll('#featPresets .feat-card')], cards = all.filter(c => !c.hidden), out = {};
  const drawn = all.map(c => { const th = c.querySelector('canvas.feat-thumb'), wv = c.querySelector('canvas.feat-wave'), cols = wv && wv.width ? n8Cols(wv) : null, t = th && th.width ? n8Thumb(th) : null;
    return { id: c.dataset.preset, ok: !!t && t.lit > 0.95 && t.spread > 12 && !!cols && Math.max(...cols) - Math.min(...cols) >= 0.2, rgb: t && t.rgb.join(), wave: cols && cols.join() }; });
  const allDrawn = drawn.length >= 9 && drawn.every(d => d.ok) && new Set(drawn.map(d => d.rgb)).size === drawn.length && new Set(drawn.map(d => d.wave)).size === drawn.length;
  for (const c of cards) { const id = c.dataset.preset, th = c.querySelector('canvas.feat-thumb'), wv = c.querySelector('canvas.feat-wave'), aud = c.querySelector('.aud');
    const nm = c.querySelector('.feat-name'), tg = c.querySelector('.feat-tags'), cut = e => !e || e.scrollWidth > e.clientWidth + 0.5 || e.scrollHeight > e.clientHeight + 0.5;
    const cols = wv && wv.width ? n8Cols(wv) : null;
    out[id] = { thumb: th && th.width ? n8Thumb(th) : null, waveShown: onScreenEl(wv), thumbShown: onScreenEl(th), name: nm && nm.textContent, tags: tg && tg.textContent,
      nameCut: cut(nm), tagsCut: cut(tg), audOwn: !!aud && !aud.parentElement.closest('button'), audShown: onScreenEl(aud),
      waveFlat: !cols || Math.max(...cols) - Math.min(...cols) < 0.2, bursts: cols ? n8Bursts(cols) : 0, cols: cols ? cols.filter((_, i) => i % 6 === 0).map(x => +x.toFixed(2)) : null }; }
  const ids = Object.keys(out), v = Object.values(out), differ = (f) => new Set(v.map(f)).size === v.length;
  const ok = ids.join() === 'warm-keys,deep-pulse,air-texture' && v.every(x => x.thumb && x.thumb.lit > 0.95 && x.thumb.spread > 12 && x.thumbShown && x.waveShown && x.name && x.tags && !x.nameCut && !x.tagsCut && x.audOwn && x.audShown && !x.waveFlat)
    && differ(x => x.thumb && x.thumb.rgb.join()) && differ(x => x.cols && x.cols.join()) && out['warm-keys'].bursts === 2 && out['deep-pulse'].bursts === 4 && out['air-texture'].bursts === 1;
  return { pass: ok && allDrawn, W: innerWidth, cards: out, presetsDrawn: drawn.map(d => d.id + (d.ok ? '' : ' (not drawn)')), allDrawn }; }
// Grounded, Radiant and Dreamlike sit on one row, whole, each in its own colour. With none pressed the featured cards are
// the picture's three; a feeling shows three presets of that feeling; pressing it again brings the three back.
export async function n8Chips() { await settle(1200);
  const chips = [...document.querySelectorAll('.feel-filters .feel')], shownIds = () => [...document.querySelectorAll('#featPresets .feat-card')].filter(c => onScreenEl(c.querySelector('.feat-apply'))).map(c => c.dataset.preset);
  const feelOf = id => (document.querySelector(`#featPresets .feat-card[data-preset="${id}"]`) || {}).dataset?.feel;
  const tops = chips.map(c => Math.round(c.getBoundingClientRect().top)), whole = chips.every(c => onScreenEl(c) && c.scrollWidth <= c.clientWidth + 0.5);
  const borders = chips.map(c => getComputedStyle(c).borderTopColor), pressed = () => chips.filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.dataset.feel);
  const byFeel = f => chips.find(c => c.dataset.feel === f), DEF = 'warm-keys,deep-pulse,air-texture';
  const d0 = shownIds().join(), p0 = pressed().join();
  byFeel('radiant').click(); await settle(300); const r = shownIds(), pr = pressed().join();
  byFeel('radiant').click(); await settle(300); const back = shownIds().join(), pb = pressed().join();
  byFeel('dreamlike').click(); await settle(300); const dr = shownIds();
  const ok = chips.length === 3 && new Set(tops).size === 1 && whole && new Set(borders).size === 3 && d0 === DEF && p0 === ''
    && r.length === 3 && r.every(id => feelOf(id) === 'radiant') && pr === 'radiant' && back === DEF && pb === ''
    && dr.length === 3 && dr.every(id => feelOf(id) === 'dreamlike');
  return { pass: ok, W: innerWidth, rowTops: tops, whole, borders, atLoad: d0, pressedAtLoad: p0, radiant: r, backToDefault: back, dreamlike: dr }; }
