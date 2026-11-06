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
// A visible beat-grid cell: the Beat grid editor tab in Studio (on a phone of 480 px or less, inside the Mix tab, S16),
// the Beat view on the classic phone.
async function gridCell() {
  const pm = document.querySelector('#phoneTabs [data-p="mix"]'); if (shown(pm)) { pm.click(); await settle(300); }
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
  const pm = document.querySelector('#phoneTabs [data-p="mix"]'); if (shown(pm)) { pm.click(); await settle(300); }   // S16: the phone's editors are in the Mix tab
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
  // The Sounds region is its rail where Sounds is one (1120-1399 px and folded, S8).
  const regions = ['#xport', '#browser', '#sndRail', 'main.work', '#inspect'].map(s => document.querySelector(s)).filter(shown).map(e => { const c = getComputedStyle(e);
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
  lyricSec: 'which section the words go to: with no words anywhere a switch looks like nothing (n6LyricSection holds it)',
  saSnap: 'how far the next dragged take moves (snapUnit reads dash.snap; n9Snap holds it)' };
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
  // The singer's way there: where Sounds is a rail (1120-1399 px, S8) its icon opens the panel; the column scrolls as one, so
  // "Start with a vibe" (below the presets) is scrolled to.
  if ($('railSounds') && onScreenEl($('railSounds')) && !onScreenEl($('sndSearch'))) { $('railSounds').click(); await settle(600); }
  const b = $('pathVibe'); if (!b || !b.getBoundingClientRect().width) return { pass: false, why: 'no Start with a vibe on screen' };
  b.scrollIntoView({ block: 'center' }); await settle(300); if (!onScreenEl(b)) return { pass: false, why: 'Start with a vibe could not be scrolled to' };
  b.click(); await settle(700); const a = document.activeElement, g = $('vgrid'), r = a ? a.getBoundingClientRect() : null;
  const onScreen = !!r && r.width > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
  const h = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
  // and the way back: the column's close brings Sounds back (the search box on screen again); so does Escape
  const sndHidden = !onScreenEl($('sndSearch')), x = $('vibesClose'), xOn = onScreenEl(x); if (xOn) { x.click(); await settle(400); }
  const backByX = onScreenEl($('sndSearch')); b.scrollIntoView({ block: 'center' }); await settle(300); b.click(); await settle(500); key('Escape', { target: document.activeElement }); await settle(400); const backByEsc = onScreenEl($('sndSearch'));
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
  return { pass: $('projName').textContent.replace(/[•\s]+$/, '').trim() === 'Mine' && $('swing').value === '20', store: st, goto: '?link=1#p=' + link }; }
// (The addresses are relative to the page: a root-relative '/rc/' left the site on the live build, where /rc/ is under
// /aura-studio/, and opened GitHub's 404 page instead of the link. Found by the first live run, 13.9.0-rc.5.)
// On arrival (before Aura saves the link's song here, which it does within seconds, unasked: found here, not changed by
// S7) the stored name must still be this project's; after that save it is the link's. Either way it names the stored song.
export async function n7NameLinkOpened() { const early = n7Store(), earlyOk = (early.storedSwing === 20) === (early.name === 'Mine');
  await settle(1200); const shown = $('projName').textContent.replace(/[•\s]+$/, '').trim();
  await settle(5000); const st = n7Store(), lateOk = (st.storedSwing === 20) === (st.name === 'Mine');
  sessionStorage.setItem('n7nl2', JSON.stringify(Object.assign({ shownOnLink: shown, swingOnLink: $('swing').value, early, earlyOk, lateOk }, st)));
  return { pass: location.hash.startsWith('#p=') && shown === 'Untitled' && $('swing').value === '30' && earlyOk && lateOk, shown, early, store: st, goto: './' }; }
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
// Search finds presets by name or tags (and still filters the vibe tiles); nothing found says so. The clear-filters icon
// is disabled while nothing is filtered, and one press clears the search and the feeling and brings the picture's three back.
export async function n8Search() { await settle(1200);
  const q = $('sndSearch'), clr = $('sndClear'); if (!clr) return { pass: false, why: 'no clear-filters button in the Sounds header' };
  const shown = () => [...document.querySelectorAll('#featPresets .feat-card')].filter(c => !c.hidden && onScreenEl(c.querySelector('.feat-apply'))).map(c => c.dataset.preset);
  const tiles = () => [...document.querySelectorAll('#vgrid .vtile')].filter(t => t.style.display !== 'none').length;
  const type = async v => { q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); await settle(250); };
  const off0 = clr.disabled, t0 = tiles();
  await type('pulse'); const pulse = shown(), on1 = !clr.disabled, tPulse = tiles();
  await type('bell'); const bell = shown();
  await type('zzz'); const none = shown(), say = ($('featNone') && onScreenEl($('featNone'))) ? $('featNone').textContent : '';
  await type(''); document.querySelector('.feel-filters .feel[data-feel="radiant"]').click(); await settle(250); const on2 = !clr.disabled;
  clr.click(); await settle(300);
  const after = { search: q.value, pressed: [...document.querySelectorAll('.feel-filters .feel')].filter(c => c.getAttribute('aria-pressed') === 'true').length, shown: shown().join(), off: clr.disabled };
  const ok = off0 && pulse.join() === 'deep-pulse' && on1 && bell.join() === 'soft-bells' && none.length === 0 && /zzz/.test(say) && on2
    && t0 > 0 && tPulse >= 1 && tPulse < t0 && after.search === '' && after.pressed === 0 && after.shown === 'warm-keys,deep-pulse,air-texture' && after.off;
  return { pass: ok, disabledAtLoad: off0, pulse, bell, none, saysNone: say, vibeTiles: [t0, tPulse], enabledWhileFiltered: [on1, on2], afterClear: after }; }
// The Project intention card shows the intention and what Aura keeps (from Preserve: the voice always, the melody while
// its lock is on); the pencil edits it, Enter keeps it in the project, Undo takes it back.
export async function n8Intention() { await settle(1000);
  const card = $('intentCard'), text = $('intentText'), keep = $('intentKeep'), pen = $('intentEdit'), lock = $('drLockMelody');
  if (!card || !text || !keep || !pen) return { pass: false, why: 'no intention card with its text, Keep line and pencil' };
  const shownCard = onScreenEl(pen) && onScreenEl(text), k0 = keep.textContent.trim();
  lock.click(); await settle(250); const k1 = keep.textContent.trim(); lock.click(); await settle(250); const k2 = keep.textContent.trim();
  const t0 = text.textContent.trim(); pen.click(); await settle(250); const ed = document.activeElement, editing = !!ed && ed.id === 'dashIntent' && onScreenEl(ed);
  if (!editing) return { pass: false, why: 'the pencil did not open the intention for editing', active: ed && (ed.id || ed.tagName), keep: [k0, k1, k2] };
  ed.value = 'Late-night confession, one big release'; ed.dispatchEvent(new Event('input', { bubbles: true })); key('Enter', { target: ed }); await settle(600);
  const t1 = text.textContent.trim(), saved = S().snapshot().includes('Late-night confession, one big release'), closed = !onScreenEl($('dashIntent'));
  $('undoX').click(); await settle(500); const t2 = text.textContent.trim();
  return { pass: shownCard && k0 === 'Keep: vocal + main melody' && k1 === 'Keep: vocal' && k2 === k0 && t1 === 'Late-night confession, one big release' && saved && closed && t2 === t0,
    keep: [k0, k1, k2], before: t0, after: t1, savedInProject: saved, editorClosed: closed, afterUndo: t2 }; }
// From 1120 to 1399 px the Sounds column is an icon rail (at most 64 px), so the arrangement starts near the left edge
// (it started past 230 px). Its Sounds icon opens the whole panel over the arrangement with the search focused and the
// cards on screen; Escape closes it. Its Import and Record do what the panel's buttons do.
export async function n8IconRail() { await settle(1000);
  const rail = $('sndRail'); if (!rail) return { pass: false, why: 'no Sounds rail' };
  // The rail's three icons (its unfold chevron shows only from 1400 px, where there is a column to unfold to).
  const btns = ['railSounds', 'railImport', 'railRecord'].map(id => { const b = $(id); return { id, label: (b && b.getAttribute('aria-label')) || '', on: onScreenEl(b) }; });
  const railW = Math.round(rail.getBoundingClientRect().width), closedAtLoad = !onScreenEl($('sndSearch')), arrLeft = Math.round($('studioArr').getBoundingClientRect().left);
  // Painted in the panels' layer: the page's background field (fixed, z-index 0) paints over anything unpositioned, and hid
  // the rail's panel and its Sounds icon while every box and hit-test said they were there. Same layer as the work area.
  const layer = e => { const c = getComputedStyle(e); return c.position === 'static' ? 'unpositioned' : c.zIndex; }, wk = document.querySelector('main.work');
  const sameLayer = layer(rail) !== 'unpositioned' && layer(rail) === layer(wk);
  $('railSounds').click(); await settle(600);
  const cards = [...document.querySelectorAll('#featPresets .feat-card')].filter(c => !c.hidden);
  const opened = onScreenEl($('sndSearch')) && cards.length === 3 && cards.every(c => onScreenEl(c.querySelector('.feat-apply'))), focused = document.activeElement === $('sndSearch');
  key('Escape', { target: document.activeElement || document.body }); await settle(600); const closed = !onScreenEl($('sndSearch'));
  const pick = { el: null }, IC = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { pick.el = this; return; } return IC.call(this); };
  try { $('railImport').click(); await settle(300); } finally { HTMLInputElement.prototype.click = IC; }
  $('railRecord').click(); await settle(700); const lyr = document.querySelector('#studioETabs .etab[data-ed="lyrics"]'), lyricsOpen = !!lyr && lyr.getAttribute('aria-selected') === 'true';
  if ($('recX') && $('recX').classList.contains('on')) { $('recX').click(); await settle(300); }
  const ok = railW <= 64 && sameLayer && btns.length >= 3 && btns.every(b => b.label && b.on) && closedAtLoad && arrLeft < 120 && opened && focused && closed && !!pick.el && lyricsOpen;
  return { pass: ok, W: innerWidth, railW, railLayer: layer(rail), workLayer: layer(wk), buttons: btns, closedAtLoad, arrangementLeft: arrLeft, opened, searchFocused: focused, escapeClosed: closed, importPicker: !!pick.el, recordOpensLyrics: lyricsOpen }; }
// From 1400 px the Sounds header's chevron folds the column to the rail (the arrangement takes the room) and the rail's
// own chevron unfolds it; the choice is kept across a reload.
export async function n8CollapseSet() { await settle(1000);
  const chev = $('sndCollapse'); if (!chev || !onScreenEl(chev)) return { pass: false, why: 'no chevron in the Sounds header' };
  const w0 = Math.round($('browser').getBoundingClientRect().width), a0 = Math.round($('studioArr').getBoundingClientRect().width);
  chev.click(); await settle(500);
  const rail = $('sndRail'), railW = rail ? Math.round(rail.getBoundingClientRect().width) : 0, a1 = Math.round($('studioArr').getBoundingClientRect().width), searchGone = !onScreenEl($('sndSearch'));
  const exp = $('railExpand'), expOn = onScreenEl(exp);
  sessionStorage.setItem('n8fold', JSON.stringify({ w0, a0, railW, a1 }));
  return { pass: w0 > 180 && railW > 0 && railW <= 64 && a1 >= a0 + 100 && searchGone && expOn && chev.getAttribute('aria-expanded') === 'false', columnBefore: w0, arrangementBefore: a0, railW, arrangementAfter: a1, searchGone, unfoldShown: expOn }; }
export async function n8CollapseKept() { await settle(1200);
  const rail = $('sndRail'), railW = rail ? Math.round(rail.getBoundingClientRect().width) : 0, kept = railW > 0 && railW <= 64 && !onScreenEl($('sndSearch'));
  const exp = $('railExpand'); if (exp) { exp.click(); await settle(500); }
  const after = { search: onScreenEl($('sndSearch')), columnW: Math.round($('browser').getBoundingClientRect().width), railW: rail ? Math.round(rail.getBoundingClientRect().width) : 0 };
  const back = after.search && after.columnW > 180 && after.railW === 0;
  return { pass: kept && back, keptAfterReload: kept, unfolded: back, after, before: JSON.parse(sessionStorage.getItem('n8fold') || 'null') }; }
// "Local project" sits at the foot of the Sounds column, on screen without scrolling (it sat under Import and Record,
// mid-column, with the older ways in below it).
export async function n8Foot() { await settle(1000);
  const lp = $('localPill'), br = $('browser'); if (!lp) return { pass: false, why: 'no Local project line' };
  const b = br.getBoundingClientRect(), r = lp.getBoundingClientRect(), gap = Math.round(b.bottom - r.bottom);
  return { pass: onScreenEl(lp) && /Local project/.test(lp.textContent) && gap >= 0 && gap <= 16 && r.top > $('dashRecord').getBoundingClientRect().bottom,
    shown: onScreenEl(lp), text: lp.textContent.trim(), gapToColumnFoot: gap }; }
// The Sounds block's parts (search, feelings, heading, cards, intention, buttons) stack without overlapping, at least 6 px
// apart. (Studio's display:block outranked its flex and the first card rode over "Featured presets".)
export async function n8Spacing() { await settle(1000);
  const parts = [...$('soundsChrome').children].filter(e => !e.hidden && !e.classList.contains('visually-hidden') && e.getBoundingClientRect().height > 2).map(e => ({ id: e.id || e.className, r: e.getBoundingClientRect() }));
  const gaps = parts.slice(1).map((p, i) => ({ between: parts[i].id + ' / ' + p.id, gap: Math.round(p.r.top - parts[i].r.bottom) }));
  return { pass: parts.length >= 6 && gaps.every(g => g.gap >= 6), parts: parts.length, gaps }; }

// ---- S9: the arrangement's ruler and view (13.9.0-rc.7), as in docs/mockups/studio-dashboard-target.png ----
// Every track row is 36 px (it was 44), so more of the song's tracks fit.
export async function n9RowHeight() { await settle(900);
  const rows = [...document.querySelectorAll('#saLanes .sa-lane')].map(r => Math.round(r.getBoundingClientRect().height * 10) / 10);
  return { pass: rows.length >= 6 && rows.every(h => Math.abs(h - 36) <= 1), rows }; }
// A bar ruler above the sections: its numbers start at 1, sit over the lanes' bar lines (±1 px), are at least 24 px
// apart, and there is a tick for every bar of the song.
const n9Used = () => Math.max(8, (JSON.parse(S().snapshot()).song || []).reduce((m, v, i) => (v != null ? i + 1 : m), 0));
// Read on the song as it loads (8 bars) and again at 32 bars, where at 1440 the numbers must thin out to stay apart.
function n9ReadRuler() { const ru = $('saRuler');
  const used = n9Used(), body = document.querySelector('#saLanes .sa-lane-body').getBoundingClientRect(), barX = b => body.left + (b - 1) / used * body.width;
  const labels = [...ru.querySelectorAll('.sa-rbar')].map(e => ({ n: +e.textContent, x: e.getBoundingClientRect().left }));
  const placed = labels.every(l => Math.abs(l.x - barX(l.n)) <= 1), apart = labels.slice(1).every((l, i) => l.x - labels[i].x >= 24);
  const ticks = ru.querySelectorAll('.sa-rtick').length, above = ru.getBoundingClientRect().bottom <= $('saSecs').getBoundingClientRect().top + 1;
  return { ok: labels.length >= 2 && labels[0].n === 1 && placed && apart && ticks === used && above && onScreenEl(ru),
    bars: used, every: labels.length > 1 ? labels[1].n - labels[0].n : null, labels: labels.map(l => l.n + '@' + Math.round(l.x)).slice(0, 10), lanesStartAt: Math.round(body.left), placed, apart, ticks, above }; }
export async function n9Ruler() { await settle(900);
  if (!$('saRuler')) return { pass: false, why: 'no ruler' };
  const short = n9ReadRuler(); S().songResizeBlock(0, 32); await settle(600); const long = n9ReadRuler();
  return { pass: short.ok && long.ok && short.bars === 8 && long.bars === 32, short, long }; }
// Zoom: the slider at 4× makes the lane bodies 4× as wide as at Fit (±2 %); the arrangement scrolls sideways; the track
// names stay where they are as it scrolls; the ruler, sections, energy and lanes stay aligned (±1 px at bar 5). Fit
// returns to the whole song with no sideways scroll; + widens and − narrows.
export async function n9ZoomFit() { await settle(900);
  const z = $('saZoom'), fit = $('saFit'), zin = $('saZoomIn'), zout = $('saZoomOut'), arr = $('studioArr');
  if (!z || !fit || !zin || !zout) return { pass: false, why: 'no zoom slider, − and +, or Fit' };
  const shown = [z, fit, zin, zout].every(onScreenEl), title = /Arrangement/.test(($('saBar') || arr).textContent);
  const body = () => document.querySelector('#saLanes .sa-lane-body').getBoundingClientRect(), used = n9Used();
  const setZ = async v => { z.value = String(v); z.dispatchEvent(new Event('input', { bubbles: true })); await settle(350); };
  const b0 = body().width, hd0 = document.querySelector('#saLanes .sa-lane-hd').getBoundingClientRect().left;
  await setZ(4); const b4 = body().width, scrolls = arr.scrollWidth > arr.clientWidth + 1;
  arr.scrollLeft = 300; await settle(250); const hd1 = document.querySelector('#saLanes .sa-lane-hd').getBoundingClientRect().left, scrolled = arr.scrollLeft;
  const bb = body(), at5 = bb.left + 4 / used * bb.width, lab5 = [...$('saRuler').querySelectorAll('.sa-rbar')].find(e => e.textContent === '5');
  const secs = $('saSecs').getBoundingClientRect(), en = $('saEnergyCanvas').getBoundingClientRect();
  const align = { ruler: lab5 ? Math.round(lab5.getBoundingClientRect().left - at5) : null, sectionsLeft: Math.round(secs.left - bb.left), sectionsWidth: Math.round(secs.width - bb.width),
    energyAt5: Math.round(en.left + 4 / used * en.width - at5) };
  fit.click(); await settle(400); const bf = body().width, fitted = arr.scrollWidth <= arr.clientWidth + 1 && arr.scrollLeft === 0;
  zin.click(); await settle(350); const bIn = body().width; zout.click(); await settle(350); const bOut = body().width;
  const ok = shown && title && Math.abs(b4 / b0 - 4) <= 0.08 && scrolls && scrolled > 0 && Math.abs(hd1 - hd0) <= 1 && align.ruler !== null && Math.abs(align.ruler) <= 1
    && Math.abs(align.sectionsLeft) <= 1 && Math.abs(align.sectionsWidth) <= 2 && Math.abs(align.energyAt5) <= 1 && Math.abs(bf - b0) <= 1 && fitted && bIn > b0 * 1.2 && Math.abs(bOut - b0) <= 1;
  return { pass: ok, controlsShown: shown, title, fitWidth: Math.round(b0), at4x: Math.round(b4), ratio: +(b4 / b0).toFixed(3), scrolls, namesMoved: Math.round(hd1 - hd0), align, afterFit: Math.round(bf), fitted, plus: Math.round(bIn), thenMinus: Math.round(bOut) }; }
// Zoomed in (4×) while playing, the view scrolls so the playhead stays on screen (at 160 BPM, 4 s in, it is about 2.6
// bars along: ~900 px into a 2800 px song shown ~700 px at a time).
export async function n9PlayheadFollows() { await settle(900);
  const bpm = $('bpm'); bpm.value = '160'; bpm.dispatchEvent(new Event('input', { bubbles: true })); bpm.dispatchEvent(new Event('change', { bubbles: true }));
  const z = $('saZoom'); if (!z) return { pass: false, why: 'no zoom' }; z.value = '4'; z.dispatchEvent(new Event('input', { bubbles: true })); await settle(400);
  const arr = $('studioArr'); arr.scrollLeft = 0; $('play').click(); await settle(4000);
  const a = arr.getBoundingClientRect(), p = $('saPlayhead').getBoundingClientRect(), x = p.left + p.width / 2;
  const inView = x >= a.left + 128 && x <= a.right, scrolled = arr.scrollLeft; $('play').click(); await settle(300);
  return { pass: inView && scrolled > 0, playheadX: Math.round(x), view: [Math.round(a.left), Math.round(a.right)], scrolledBy: Math.round(scrolled) }; }
// Snap (Bar, Beat, Step, Off) decides how far a take moves when dragged: 1.3 bars of drag moves it 1 bar (Bar), 1.25
// (Beat: 5.2 beats → 5), 1.3125 (Step: 20.8 steps → 21) or 1.3 (Off), keeping its own timing against the beat; each move
// is one step of the take's history. The choice is kept across a reload.
const n9pe = (type, x, y) => new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 19, isPrimary: true });
export async function n9SnapSet() { await settle(900);
  const sel = $('saSnap'); if (!sel || !onScreenEl(sel)) return { pass: false, why: 'no Snap menu on screen' };
  const sr = 44100, buf = new AudioBuffer({ length: sr * 2, numberOfChannels: 1, sampleRate: sr }), ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = 0.2 * Math.sin(2 * Math.PI * 220 * i / sr);
  S().takeInstall(buf, 0); await settle(400);
  const bpm = +$('bpm').value, secBar = 240 / bpm, used = n9Used(), moved = {};
  for (const [opt, want] of [['bar', 1], ['beat', 1.25], ['step', 1.3125], ['off', 1.3]]) {
    sel.value = opt; sel.dispatchEvent(new Event('change', { bubbles: true })); await settle(200);
    const clip = document.querySelector('#saLanes .sa-lane[data-lane="voice"] .sa-clip') || document.querySelector('#saLanes .sa-clip.audio'); if (!clip) return { pass: false, why: 'no take on the Voice lane' };
    const r = clip.getBoundingClientRect(), body = clip.parentElement.getBoundingClientRect(), per = body.width / used, x = r.left + Math.min(20, r.width / 2), y = r.top + r.height / 2;
    const at0 = S().takeClips()[0].at, d0 = S().takeHistoryDepth().past;
    clip.dispatchEvent(n9pe('pointerdown', x, y)); window.dispatchEvent(n9pe('pointermove', x + per * 1.3, y)); await settle(120);
    window.dispatchEvent(n9pe('pointerup', x + per * 1.3, y)); await settle(350);
    const bars = (S().takeClips()[0].at - at0) / secBar; moved[opt] = { bars: +bars.toFixed(4), want, steps: S().takeHistoryDepth().past - d0 };
    S().takeUndoStep(); await settle(300); }
  sel.value = 'beat'; sel.dispatchEvent(new Event('change', { bubbles: true })); await settle(200);
  const ok = Object.values(moved).every(m => Math.abs(m.bars - m.want) <= (m.want === 1.3 ? 0.02 : 0.002) && m.steps === 1);
  return { pass: ok, moved }; }
export async function n9SnapKept() { await settle(1000); const sel = $('saSnap'); return { pass: !!sel && sel.value === 'beat', value: sel && sel.value }; }

// ---- S10: the arrangement's lanes and clips (13.9.0-rc.8), as in docs/mockups/studio-dashboard-target.png ----
// Each lane's colour, as the app has always drawn its clips (copied here by hand, not read from the app).
const N10_COLOR = { drums: 'rgb(240, 160, 75)', bass: 'rgb(45, 180, 160)', keys: 'rgb(165, 76, 255)', atmosphere: 'rgb(107, 140, 255)', melody: 'rgb(232, 200, 74)',
  voice: 'rgb(255, 107, 154)', double: 'rgb(245, 141, 184)', harmony: 'rgb(217, 107, 160)', texture: 'rgb(184, 160, 232)' };
const n10Unfold = async () => { const t = $('saVoiceFold'); if (t && t.getAttribute('aria-expanded') === 'false') { t.click(); await settle(300); } };
// Every head: the lane's colour edge, an icon in that colour, the name, M and S. The vocal lanes have a record-arm that
// arms that track; Melody a lock that is Preserve's Melody; Lead the voice badge (Aura never changes the voice).
export async function n10LaneHead() { await settle(900); await n10Unfold();
  const rows = [...document.querySelectorAll('#saLanes .sa-lane[data-lane]')], out = {};
  for (const r of rows) { r.scrollIntoView({ block: 'nearest' }); await settle(60);   // the lower rows sit below the fold; a singer scrolls to them
    const id = r.dataset.lane, hd = r.querySelector('.sa-lane-hd'), ico = hd && hd.querySelector('svg.lane-ico'), c = N10_COLOR[id];
    out[id] = { edge: hd && getComputedStyle(hd).borderLeftColor === c && parseFloat(getComputedStyle(hd).borderLeftWidth) >= 3, icon: !!ico && getComputedStyle(ico).color === c && onScreenEl(ico),
      name: !!hd && !!hd.querySelector('.nm') && onScreenEl(hd.querySelector('.nm')) && hd.querySelector('.nm').scrollWidth <= hd.querySelector('.nm').clientWidth + 0.5 /* whole, not "L…" */, ms: !!hd && [...hd.querySelectorAll('.ms button')].map(b => b.textContent.trim()).join() === 'M,S',
      arm: !!hd && !!hd.querySelector('button.arm') }; }
  const voxIds = ['voice', 'double', 'harmony'], armRight = Object.keys(out).every(id => out[id].arm === voxIds.includes(id));
  // arming Double arms Double (Record records there), and Lead takes it back
  const armOf = id => document.querySelector(`#saLanes .sa-lane[data-lane="${id}"] button.arm`);
  if (!armOf('double') || !armOf('voice')) return { pass: false, why: 'no record-arm on the vocal lanes', lanes: out };
  armOf('double').click(); await settle(300); const dblArmed = armOf('double').getAttribute('aria-pressed') === 'true' && armOf('voice').getAttribute('aria-pressed') === 'false' && /Double/.test($('recX').getAttribute('aria-label') || '');
  armOf('voice').click(); await settle(300); const leadBack = armOf('voice').getAttribute('aria-pressed') === 'true';
  // Melody's lock is Preserve's
  const mlk = () => document.querySelector('#saLanes .sa-lane[data-lane="melody"] .sa-lane-hd button.lk'), ml = mlk(), p0 = $('drLockMelody').getAttribute('aria-pressed');
  if (ml) { ml.click(); await settle(250); }   // the lanes redraw, so the lock is looked up again
  const p1 = $('drLockMelody').getAttribute('aria-pressed'), mlPressed = mlk() && mlk().getAttribute('aria-pressed'); if (mlk()) { mlk().click(); await settle(250); }
  const badge = document.querySelector('#saLanes .sa-lane[data-lane="voice"] .sa-lane-hd .lk.fixed');
  const ok = rows.length === 9 && Object.values(out).every(o => o.edge && o.icon && o.name && o.ms) && armRight && dblArmed && leadBack && !!ml && p1 !== p0 && mlPressed === p1 && !!badge && badge.tagName !== 'BUTTON';
  return { pass: ok, lanes: out, armOnVocalsOnly: armRight, armsDouble: dblArmed, leadBack, melodyLockIsPreserve: !!ml && p1 !== p0 && mlPressed === p1, voiceBadge: !!badge }; }
// The Voice group: Lead, Double and Harmony as three rows at load (Philip's three lanes, rc.12); its fold makes them one
// Voice row (the picture) that shows every track's takes, whose M mutes all three; unfolding brings the three back; the
// fold is kept across a reload.
const n10Rows = () => [...document.querySelectorAll('#saLanes .sa-lane[data-lane]')].map(r => r.dataset.lane);
export async function n10VoiceGroupSet() { await settle(900);
  const t = $('saVoiceFold'); if (!t || !onScreenEl(t)) { const lr = document.querySelector('#saLanes .sa-lane[data-lane="voice"]'); if (lr) lr.scrollIntoView({ block: 'nearest' }); await settle(100); }
  const fold = $('saVoiceFold'); if (!fold) return { pass: false, why: 'no fold on the Voice group' };
  const sr = 44100, mk = f => { const b = new AudioBuffer({ length: sr * 2, numberOfChannels: 1, sampleRate: sr }), c = b.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = 0.2 * Math.sin(2 * Math.PI * f * i / sr); return b; };
  S().voxSelect('vocals'); S().takeInstall(mk(220), 0); S().voxSelect('double'); S().takeInstall(mk(330), 1); S().voxSelect('vocals'); await settle(400);
  const rows0 = n10Rows(), three = ['voice', 'double', 'harmony'].every(id => rows0.includes(id)) && fold.getAttribute('aria-expanded') === 'true';
  fold.click(); await settle(400);
  const rows1 = n10Rows(), g = document.querySelector('#saLanes .sa-lane[data-lane="voicegroup"]'), clips = g ? g.querySelectorAll('.sa-clip').length : 0;
  const one = !!g && !['voice', 'double', 'harmony'].some(id => rows1.includes(id)) && /Voice/.test(g.querySelector('.nm').textContent);
  const gm = g && g.querySelector('.ms button'); if (gm) { gm.click(); await settle(300); }
  const allMuted = ['vocals', 'double', 'harmony'].every(id => window.__auraMix.mixOf(id).mute);
  const gm2 = document.querySelector('#saLanes .sa-lane[data-lane="voicegroup"] .ms button'); if (gm2) { gm2.click(); await settle(300); }
  const unmuted = ['vocals', 'double', 'harmony'].every(id => !window.__auraMix.mixOf(id).mute);
  $('saVoiceFold').click(); await settle(400); const back = ['voice', 'double', 'harmony'].every(id => n10Rows().includes(id));
  $('saVoiceFold').click(); await settle(300);   // folded, for the reload
  return { pass: three && one && clips === 2 && allMuted && unmuted && back, threeAtLoad: three, folded: one, clipsInFold: clips, mutesAllThree: allMuted, unmutesAll: unmuted, unfolds: back }; }
export async function n10VoiceGroupKept() { await settle(1000); const g = document.querySelector('#saLanes .sa-lane[data-lane="voicegroup"]');
  return { pass: !!g && !n10Rows().includes('double') && $('saVoiceFold').getAttribute('aria-expanded') === 'false', foldedAfterReload: !!g, rows: n10Rows() }; }
// Each MIDI clip shows its notes: as many marks as its section plays over the bars the clip covers (counted here from
// the saved pattern masks and note lists, not from the drawing), the first at its own step. Drums: every drum hit; keys:
// every chord step; texture: the open hats; melody: its notes; bass: its written notes, or the chord root on each chord step.
const n10Bits = m => { let c = 0; for (let i = 0; i < 16; i++) if (m & (1 << i)) c++; return c; };
const n10First = ms => { let f = 99; ms.forEach(m => { for (let i = 0; i < 16; i++) if (m & (1 << i)) { f = Math.min(f, i); break; } }); return f; };
export async function n10NotePreview() { await demoInPanel(); await settle(400);
  const o = JSON.parse(S().snapshot()), out = [];
  const want = (lane, p) => { const m = o.pat[p]; if (lane === 'drums') return { n: m.slice(0, 6).reduce((a, x) => a + n10Bits(x), 0), first: n10First(m.slice(0, 6)) };
    if (lane === 'keys') return { n: m.slice(6, 13).reduce((a, x) => a + n10Bits(x), 0), first: n10First(m.slice(6, 13)) };
    if (lane === 'texture') return { n: n10Bits(m[4]), first: n10First([m[4]]) };
    if (lane === 'melody') return { n: o.mel[p].length, first: Math.min(99, ...o.mel[p].map(x => x[1])) };
    if (lane === 'bass') { if (o.lo[p].length) return { n: o.lo[p].length, first: Math.min(...o.lo[p].map(x => x[1])) }; const any = m.slice(6, 13).reduce((a, x) => a | x, 0); return { n: n10Bits(any), first: n10First([any]) }; } };
  for (const c of document.querySelectorAll('#saLanes .sa-clip.midi')) { const lane = c.dataset.lane, p = +c.dataset.pat, bars = +c.dataset.bars, w = want(lane, p); if (!w) continue;
    const marks = [...c.querySelectorAll('.nt')], r = c.getBoundingClientRect(), xs = marks.map(e => e.getBoundingClientRect().left), inside = xs.every(x => x >= r.left - 0.5 && x <= r.right + 0.5);
    const firstX = xs.length ? Math.min(...xs) : null, wantX = w.n ? r.left + w.first / (16 * bars) * r.width : null;
    out.push({ lane, pat: p, bars, marks: marks.length, want: w.n * bars, inside, firstOff: firstX == null || wantX == null ? null : Math.round(firstX - wantX) }); }
  const ok = out.length >= 8 && out.every(x => x.marks === x.want && x.inside && (x.want === 0 || Math.abs(x.firstOff) <= 2)) && out.some(x => x.lane === 'melody' && x.want > 0) && out.some(x => x.lane === 'drums' && x.want > 0);
  return { pass: ok, clips: out.length, wrong: out.filter(x => !(x.marks === x.want && x.inside && (x.want === 0 || Math.abs(x.firstOff) <= 2))).slice(0, 8), sample: out.slice(0, 4) }; }
// Audio clips show their own sound. A take quiet for its first second (0.05) and loud for its second (0.5) draws low then
// high; an import loud then quiet draws high then low (the loud half's bars at least three times the quiet half's).
const n10Halves = cv => { const g = cv.getContext('2d'), w = cv.width, h = cv.height, d = g.getImageData(0, 0, w, h).data, col = x => { let n = 0; for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] > 40) n++; return n; };
  const avg = (a, b) => { let s = 0, k = 0; for (let x = Math.floor(a * w); x < Math.floor(b * w); x++) { s += col(x); k++; } return k ? s / k : 0; }; return [avg(0.05, 0.45), avg(0.55, 0.95)]; };
const n10Buf = (first, second, sec = 2) => { const sr = 44100, b = new AudioBuffer({ length: sr * sec, numberOfChannels: 1, sampleRate: sr }), c = b.getChannelData(0);
  for (let i = 0; i < c.length; i++) c[i] = (i < c.length / 2 ? first : second) * Math.sin(2 * Math.PI * 220 * i / sr); return b; };
export async function n10Waveform() { await settle(900); await n10Unfold();
  S().voxSelect('vocals'); S().takeInstall(n10Buf(0.05, 0.5), 0); await settle(300);
  S().refInstall(n10Buf(0.5, 0.05, 6), 0); await settle(800);
  const tc = document.querySelector('#saLanes .sa-lane[data-lane="voice"] .sa-clip canvas.sa-wave'), ac = document.querySelector('#saLanes .sa-lane[data-lane="atmosphere"] .sa-clip canvas.sa-wave');
  if (!tc || !ac) return { pass: false, why: 'no waveform on the take or the import', take: !!tc, imp: !!ac };
  const [t1, t2] = n10Halves(tc), [a1, a2] = n10Halves(ac);
  return { pass: t2 >= 3 * Math.max(1, t1) && a1 >= 3 * Math.max(1, a2), take: { quietHalf: +t1.toFixed(1), loudHalf: +t2.toFixed(1) }, imp: { loudHalf: +a1.toFixed(1), quietHalf: +a2.toFixed(1) } }; }
// The selected clip is lit: a glow (a shadow with blur) in its lane's colour; no other clip glows.
const n10Blur = e => { const m = [...getComputedStyle(e).boxShadow.matchAll(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px/g)]; return Math.max(0, ...m.map(x => +x[3])); };
export async function n10SelectedGlow() { await demoInPanel(); await settle(300);
  const c = document.querySelectorAll('#saLanes .sa-lane[data-lane="keys"] .sa-clip.midi')[1]; if (!c) return { pass: false, why: 'no second Keys clip on the demo song' };
  const r = c.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, P = (t) => new PointerEvent(t, { bubbles: true, clientX: x, clientY: y, pointerId: 21, isPrimary: true });
  c.dispatchEvent(P('pointerdown')); window.dispatchEvent(P('pointerup')); await settle(400);
  const on = document.querySelector('#saLanes .sa-clip.on'), others = [...document.querySelectorAll('#saLanes .sa-clip')].filter(e => e !== on);
  const glow = on ? n10Blur(on) : 0, otherGlow = Math.max(0, ...others.map(n10Blur));
  return { pass: !!on && on.dataset.lane === 'keys' && glow >= 8 && otherGlow === 0, selected: on && (on.dataset.lane + '@' + on.dataset.start), glowPx: glow, othersMaxGlowPx: otherGlow }; }
// Ctrl-drag (⌘ on a Mac) copies a clip's run to the bar it is dropped on (empty bars, as a move needs); the original stays;
// one undo step, and Undo takes only the copy away.
export async function n10CtrlDragCopy() { await settle(900);
  S().songResizeBlock(0, 2); await settle(400);
  const slots = () => S().songSlots().slice(0, 8).map(v => (v == null ? '-' : v)).join(''), s0 = slots();
  const c = document.querySelector('#saLanes .sa-lane[data-lane="keys"] .sa-clip.midi'); if (!c) return { pass: false, why: 'no Keys clip' };
  const body = c.parentElement.getBoundingClientRect(), per = body.width / n9Used(), r = c.getBoundingClientRect(), x = r.left + 10, y = r.top + r.height / 2;
  const P = (t, xx) => new PointerEvent(t, { bubbles: true, clientX: xx, clientY: y, pointerId: 23, isPrimary: true, ctrlKey: true });
  const d0 = S().undoDepth(); c.dispatchEvent(P('pointerdown', x)); window.dispatchEvent(P('pointermove', x + per * 4)); await settle(150); window.dispatchEvent(P('pointerup', x + per * 4)); await settle(500);
  const s1 = slots(), steps = S().undoDepth() - d0; $('undoX').click(); await settle(500); const s2 = slots();
  return { pass: s0.slice(0, 2) !== '--' && s0.slice(2, 8) === '------' && s1.slice(0, 2) === s0.slice(0, 2) && s1.slice(4, 6) === s0.slice(0, 2) && s1.slice(2, 4) === '--' && steps === 1 && s2 === s0,
    before: s0, afterCopy: s1, undoSteps: steps, afterUndo: s2 }; }

// ---- S11: energy and sections (13.9.0-rc.9), as in docs/mockups/studio-dashboard-target.png ----
// The energy lane: 100, 50 and 0 beside the plot at its top (8 px in), middle and floor (8 px up, the canvas's own
// drawing rule); the lane's name and legend in the track-name column, not over the plot; the Target filled beneath.
export async function n11Scale() { await settle(900);
  const cv = $('saEnergyCanvas'), cr = cv.getBoundingClientRect(), sc = [...document.querySelectorAll('#saEnergy .sa-escale span')];
  const lab = document.querySelector('#saEnergy .sa-energy-lab'), lr = lab && lab.getBoundingClientRect();
  const at = t => { const s = sc.find(e => e.textContent.trim() === t); if (!s) return null; const r = s.getBoundingClientRect(); return { y: (r.top + r.bottom) / 2, right: r.right }; };
  const s100 = at('100'), s50 = at('50'), s0 = at('0');
  const scaleOk = !!(s100 && s50 && s0) && Math.abs(s100.y - (cr.top + 8)) <= 3 && Math.abs(s50.y - (cr.top + cr.height / 2)) <= 3 && Math.abs(s0.y - (cr.bottom - 8)) <= 3 && [s100, s50, s0].every(s => s.right <= cr.left + 1);
  const labOk = !!lr && lr.right <= cr.left + 1 && /Energy/.test(lab.textContent) && /Target/.test(lab.textContent) && /Measured/.test(lab.textContent);
  // the fill: at the middle column, tinted pixels below the target line, none above it
  // the middle of a bar, clear of the bar grid lines
  const used = n9Used(), g = cv.getContext('2d'), W = cv.width, H = cv.height, x = Math.floor((Math.floor(used / 2) + 0.5) / used * W), d = g.getImageData(x, 0, 1, H).data, a = y => d[y * 4 + 3];
  let line = -1, best = 0; for (let y = 0; y < H; y++) { const v = d[y * 4] + d[y * 4 + 2] - d[y * 4 + 1]; if (a(y) > 200 && v > best) { best = v; line = y; } }
  const k = H / cr.height; let below = 0, nb = 0, above = 0, na = 0;
  for (let y = 0; y < H; y++) { if (y > line + 6 * k && y < H - 9 * k) { nb++; if (a(y) > 12) below++; } if (y < line - 6 * k && y > 9 * k) { na++; if (a(y) > 12) above++; } }
  const filled = line > 0 && nb > 2 && below / nb > 0.8 && (na === 0 || above / na < 0.2);
  return { pass: scaleOk && labOk && filled, scale: { s100: s100 && Math.round(s100.y - cr.top), s50: s50 && Math.round(s50.y - cr.top), s0: s0 && Math.round(cr.bottom - s0.y), plotH: Math.round(cr.height) },
    labelInColumn: labOk, fill: { lineAt: line, belowTinted: nb ? +(below / nb).toFixed(2) : null, aboveTinted: na ? +(above / na).toFixed(2) : null } }; }
// One point per section on the Target curve, at its run's centre and its Target (±3 px; y by the canvas's rule). Dragging
// the last section's point up raises that section's Intensity (the Shape panel's slider shows it) and its Target; one undo
// step; Undo restores the Intensity.
export async function n11DragPoint() { await demoInPanel(); await settle(400);
  const cv = $('saEnergyCanvas'), cr = cv.getBoundingClientRect(), runs = S().songBlockList(), used = n9Used(), pts = [...document.querySelectorAll('#saEnergy .sa-epoint')];
  if (pts.length !== runs.length) return { pass: false, why: 'points ' + pts.length + ' for ' + runs.length + ' sections' };
  const t0 = S().energyState().t, yOf = v => cr.top + cr.height - 8 - v / 100 * (cr.height - 16);
  const placed = runs.map((r, i) => { const b = pts[i].getBoundingClientRect(); return { dx: Math.round((b.left + b.right) / 2 - (cr.left + (r.start + r.bars / 2) / used * cr.width)), dy: Math.round((b.top + b.bottom) / 2 - yOf(t0[r.start])) }; });
  const last = runs[runs.length - 1], pt = pts[pts.length - 1], b = pt.getBoundingClientRect(), x = (b.left + b.right) / 2, y = (b.top + b.bottom) / 2;
  const i0 = S().energyRange(last.pat).intensity, d0 = S().undoDepth(), P = (t, yy) => new PointerEvent(t, { bubbles: true, clientX: x, clientY: yy, pointerId: 31, isPrimary: true });
  pt.dispatchEvent(P('pointerdown', y)); window.dispatchEvent(P('pointermove', y - 10)); window.dispatchEvent(P('pointermove', y - 20)); await settle(100); window.dispatchEvent(P('pointerup', y - 20)); await settle(500);
  const i1 = S().energyRange(last.pat).intensity, t1 = S().energyState().t, steps = S().undoDepth() - d0, slider = +$('drInt').value;
  $('undoX').click(); await settle(500); const i2 = S().energyRange(last.pat).intensity;
  const ok = placed.every(p => Math.abs(p.dx) <= 3 && Math.abs(p.dy) <= 3) && i1 > i0 && t1[last.start] > t0[last.start] && steps === 1 && Math.abs(slider - i1) <= 1 && Math.abs(i2 - i0) <= 0.5;
  return { pass: ok, placed, intensity: [i0, i1, i2], targetAtSection: [t0[last.start], t1[last.start]], undoSteps: steps, sliderShows: slider }; }
// A section block dragged along the song moves its bars there (onto empty bars, as a clip's move does); one undo step.
// A plain click still selects it. The click a browser sends when the press and the release land on the block does not undo
// the move's selection (it would point the Shape panel at the emptied bar 1): the selected section's energy point stays lit.
// (That last part was added after the build: a guard, proven by the mutant that drops it, not a red-green step.)
export async function n11SectionDrag() { await settle(900);
  S().songResizeBlock(0, 2); await settle(400);
  const slots = () => S().songSlots().slice(0, 8).map(v => (v == null ? '-' : v)).join(''), s0 = slots();
  const sec = document.querySelector('#saSecs .sa-sec[data-start="0"]'); if (!sec) return { pass: false, why: 'no section block at bar 1' };
  const per = $('saSecs').getBoundingClientRect().width / n9Used(), r = sec.getBoundingClientRect(), x = r.left + 12, y = r.top + r.height / 2;
  const P = (t, xx) => new PointerEvent(t, { bubbles: true, clientX: xx, clientY: y, pointerId: 33, isPrimary: true });
  const d0 = S().undoDepth(); sec.dispatchEvent(P('pointerdown', x)); window.dispatchEvent(P('pointermove', x + per * 1.5)); window.dispatchEvent(P('pointermove', x + per * 3)); await settle(150);
  window.dispatchEvent(P('pointerup', x + per * 3)); sec.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x + per * 3, clientY: y }));
  await settle(500); const s1 = slots(), steps = S().undoDepth() - d0, followed = !!document.querySelector('#saEPoints .sa-epoint.on');
  $('undoX').click(); await settle(500); const s2 = slots();
  // a click without a drag selects the block (as before)
  const sec2 = document.querySelector('#saSecs .sa-sec[data-start="0"]'); sec2.click(); await settle(300); const selected = document.querySelector('#saSecs .sa-sec.on') === document.querySelector('#saSecs .sa-sec[data-start="0"]');
  return { pass: s0.slice(0, 2) !== '--' && s1.slice(0, 3) === '---' && s1.slice(3, 5) === s0.slice(0, 2) && steps === 1 && s2 === s0 && selected && followed, before: s0, afterDrag: s1, undoSteps: steps, afterUndo: s2, clickSelects: selected, selectionFollows: followed }; }
// A section block's right edge lengthens it (and shortens it back); one undo step a gesture. (Written after the build: a
// guard, proven by the mutant that turns resizing off, not a red-green step.)
export async function n11SectionResize() { await settle(900);
  S().songResizeBlock(0, 2); await settle(400);
  const slots = () => S().songSlots().slice(0, 8).map(v => (v == null ? '-' : v)).join(''), s0 = slots();
  const sec = document.querySelector('#saSecs .sa-sec[data-start="0"]'), rz = sec && sec.querySelector('.rsz'); if (!rz) return { pass: false, why: 'no resize edge on the block' };
  const per = $('saSecs').getBoundingClientRect().width / n9Used(), r = rz.getBoundingClientRect(), x = (r.left + r.right) / 2, y = (r.top + r.bottom) / 2;
  const P = (t, xx) => new PointerEvent(t, { bubbles: true, clientX: xx, clientY: y, pointerId: 35, isPrimary: true });
  const d0 = S().undoDepth(); rz.dispatchEvent(P('pointerdown', x)); window.dispatchEvent(P('pointermove', x + per)); window.dispatchEvent(P('pointermove', x + per * 2)); await settle(150);
  window.dispatchEvent(P('pointerup', x + per * 2)); await settle(500); const s1 = slots(), steps = S().undoDepth() - d0;
  $('undoX').click(); await settle(500); const s2 = slots();
  return { pass: s1.slice(0, 4) === s0.slice(0, 2).repeat(2) && s1.slice(4) === '----' && steps === 1 && s2 === s0, before: s0, afterResize: s1, undoSteps: steps, afterUndo: s2 }; }
// Each section block wears its slot's colour (the six below, copied here by hand) on its border; the active block is lit (a
// glow), the others not.
const N11_SEC = ['rgb(107, 122, 170)', 'rgb(52, 160, 154)', 'rgb(205, 164, 72)', 'rgb(210, 92, 158)', 'rgb(124, 106, 224)', 'rgb(88, 156, 214)'];
export async function n11SectionLook() { await demoInPanel(); await settle(400);
  const blocks = [...document.querySelectorAll('#saSecs .sa-sec[data-start]')], runs = S().songBlockList();
  const look = blocks.map(b => { const run = runs.find(r => r.start === +b.dataset.start); return { start: +b.dataset.start, pat: run && run.pat, border: getComputedStyle(b).borderTopColor, glow: n10Blur(b), on: b.classList.contains('on') }; });
  const coloured = look.every(l => l.pat != null && l.border === N11_SEC[l.pat]), lit = look.filter(l => l.on);
  return { pass: blocks.length === runs.length && coloured && lit.length >= 1 && lit.every(l => l.glow >= 8) && look.filter(l => !l.on).every(l => l.glow === 0), look }; }
// S12: the dock's tabs in one row, in order, and at the row's right end Mix check and Sources on the same line (buttons
// beside the tab list, not tabs in it). Mix check runs Check my mix with the mixer showing (its findings panel opens and
// the Mixer tab is selected); Sources opens the Rights & Sources card in the dock.
export async function n12Tabs() { await settle(900);
  const vis = e => !!e && e.getBoundingClientRect().width > 0, mid = e => { const r = e.getBoundingClientRect(); return (r.top + r.bottom) / 2; };
  const tabs = [...document.querySelectorAll('#studioETabs .etab')].filter(vis), names = tabs.map(b => b.textContent.trim());
  const btn = t => [...document.querySelectorAll('button')].filter(vis).find(b => b.textContent.trim() === t && !b.closest('[role=tablist]') && !b.closest('#studioEdHost'));
  const mc = btn('Mix check'), so = btn('Sources'), host = $('studioEdHost').getBoundingClientRect(), last = tabs[tabs.length - 1];
  const placed = !!(mc && so && last) && [mc, so].every(b => Math.abs(mid(b) - mid(last)) <= 4 && b.getBoundingClientRect().left > last.getBoundingClientRect().right)
    && mc.getBoundingClientRect().right <= so.getBoundingClientRect().left && host.right - so.getBoundingClientRect().right <= 16;
  const named = JSON.stringify(names) === JSON.stringify(['Mixer', 'Beat grid', 'Piano roll', 'Lyrics', 'Vocal coach', 'Perform']);
  if (!mc || !so) return { pass: false, names, mixCheck: !!mc, sources: !!so };
  tabs.find(b => b.textContent.trim() === 'Piano roll').click(); await settle(300);
  mc.click(); await settle(400); const mf = $('mixFindings'), ran = !!mf && !mf.hidden && vis(mf), mixerTab = tabs[0].getAttribute('aria-selected') === 'true';
  so.click(); await settle(400); const rc = $('rightsCard'), opened = !!rc && vis(rc) && !!rc.closest('#studioEdHost') && vis($('rightsRun'));
  tabs[0].click(); await settle(300);
  return { pass: named && placed && ran && mixerTab && opened, names, placed, mixCheckRan: ran, mixerTab, sourcesOpened: opened }; }
// S12: every visible channel strip in the dock's mixer shows, top to bottom: its track's icon (in the lane's colour) and
// its whole name, its dB readout above the meter, the meter and the fader, a pan knob with L and R, then M and S. The knob
// is that channel's Pan: arrow keys turn it (its mark turns), the Pan control below shows the same value, double-click
// centres it; the Drums knob moves Kick, Snare and Hats together.
const N12_COL = { __drums: 'rgb(240, 160, 75)', bass: 'rgb(45, 180, 160)', chords: 'rgb(165, 76, 255)', sample: 'rgb(107, 140, 255)', melody: 'rgb(232, 200, 74)', vocals: 'rgb(255, 107, 154)' };
const N12_NAME = { __drums: 'Drums', bass: 'Bass', chords: 'Warm keys', sample: 'Atmosphere', melody: 'Melody', vocals: 'Lead' };
const n12Strips = () => [...document.querySelectorAll('#studioEdHost #mixer .strip')].filter(s => s.getBoundingClientRect().width > 0);
export async function n12StripParts() { await settle(900);
  const strips = n12Strips().filter(s => !s.classList.contains('master')), R = e => e ? e.getBoundingClientRect() : null;
  const parts = strips.map(s => { const g = s.dataset.g, ico = s.querySelector('svg.lane-ico'), nm = s.querySelector('.nm'), val = s.querySelector('.ctl-val[data-k="vol"]'),
      mtr = s.querySelector('.mtr2'), fader = s.querySelector('.ctl.vf[data-k="vol"]'), knob = s.querySelector('.ctl.knob'), lr = s.querySelector('.knob-lr'), mb = s.querySelector('.mb'), sb = s.querySelector('.sb');
    const vis = [ico, nm, val, mtr, fader, knob, lr, mb, sb].every(e => e && R(e).width > 0 && R(e).height > 0);
    if (!vis) return { g, missing: ['icon', 'name', 'dB', 'meter', 'fader', 'knob', 'L/R', 'M', 'S'].filter((_, i) => { const e = [ico, nm, val, mtr, fader, knob, lr, mb, sb][i]; return !(e && R(e).width > 0); }) };
    const L = [...lr.children].find(e => e.textContent.trim() === 'L'), Rt = [...lr.children].find(e => e.textContent.trim() === 'R'), kc = (R(knob).left + R(knob).right) / 2;
    const named = [...nm.childNodes].filter(t => t.nodeType === 3).map(t => t.textContent).join('').trim() === N12_NAME[g] && nm.scrollWidth <= nm.clientWidth + 1;
    const order = R(ico).bottom <= R(val).top + 2 && R(val).bottom <= R(mtr).top + 4 && R(knob).top >= R(fader).bottom - 2 && R(mb).top >= R(knob).bottom - 2;
    return { g, colour: getComputedStyle(ico).color === N12_COL[g], named, order, lr: !!(L && Rt) && R(L).right <= kc && R(Rt).left >= kc };
  });
  const look = parts.length >= 6 && parts.every(p => !p.missing && p.colour && p.named && p.order && p.lr);
  if (!look) return { pass: false, parts };
  const bass = strips.find(s => s.dataset.g === 'bass'), knob = bass.querySelector('.ctl.knob'), mark = () => getComputedStyle(knob.querySelector('.ctl-thumb')).transform;
  const m0 = mark(); knob.focus(); for (let i = 0; i < 4; i++) key('ArrowRight', { target: knob }); await settle(150);
  const pan = MX().mixOf('bass').pan, live = MX().node('bass') && MX().node('bass').pan, turned = mark() !== m0;
  bass.click(); await settle(300); const dp = $('mixDetail').querySelector('.ctl[data-k="pan"]'), same = !!dp && dp.getAttribute('aria-valuetext') === knob.getAttribute('aria-valuetext');
  knob.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await settle(150); const centred = MX().mixOf('bass').pan === 0;
  const dk = strips.find(s => s.dataset.g === '__drums').querySelector('.ctl.knob'), d0 = ['kick', 'snare', 'hats'].map(id => MX().mixOf(id).pan);
  dk.focus(); key('ArrowLeft', { target: dk }); key('ArrowLeft', { target: dk }); await settle(150); const d1 = ['kick', 'snare', 'hats'].map(id => MX().mixOf(id).pan);
  const drumsTogether = d1.every((v, i) => v === Math.max(-100, d0[i] - 10));
  return { pass: pan === 20 && turned && same && centred && drumsTogether, parts: parts.length, bassPan: pan, livePan: live, turned, detailShowsSame: same, centred, drums: [d0, d1] }; }
// S12: every visible strip in the dock's mixer, the Master's too, is the same width (±1 px), no name is cut, and the
// strips fit the dock with no sideways scroll. (Written after the layout it checks: n12StripParts' whole names needed it
// first. A guard, proven by the mutant that gives the Master its old width, not a red-green step.)
export async function n12EqualWidth() { await settle(900);
  const strips = n12Strips(), w = strips.map(s => Math.round(s.getBoundingClientRect().width * 10) / 10), row = $('strips');
  const cut = strips.filter(s => { const nm = s.querySelector('.nm'); return nm && nm.scrollWidth > nm.clientWidth + 1; }).map(s => s.dataset.g);
  const equal = w.length >= 7 && Math.max(...w) - Math.min(...w) <= 1, fits = row.scrollWidth <= row.clientWidth + 1;
  return { pass: equal && !cut.length && fits && strips.some(s => s.classList.contains('master')), widths: w, cut, rowScroll: [row.scrollWidth, row.clientWidth] }; }
// S12: picking a lane lights its mixer strip (a violet border and a glow) and no other strip, the Master included;
// clicking a strip picks its lane.
const n12Violet = c => { const m = c.match(/\d+(\.\d+)?/g); if (!m) return false; const [r, g, b, a = 1] = m.map(Number); return a > 0.5 && b > 200 && b - g > 90 && r > g; };
const n12Lit = () => n12Strips().filter(s => n12Violet(getComputedStyle(s).borderTopColor) && n10Blur(s) >= 8).map(s => s.dataset.g);
export async function n12SelectedStrip() { await settle(900);
  const pickLane = async id => { const h = document.querySelector('.sa-lane[data-lane="' + id + '"] .sa-lane-hd .nm'); if (h) h.click(); await settle(300); };
  await pickLane('bass'); const a = n12Lit();
  await pickLane('voice'); const b = n12Lit();
  await pickLane('drums'); const c = n12Lit();
  const mel = n12Strips().find(s => s.dataset.g === 'melody'); mel.click(); await settle(300);
  const lane = (document.querySelector('.sa-lane.on') || {}).dataset, d = n12Lit();
  const ok = JSON.stringify(a) === '["bass"]' && JSON.stringify(b) === '["vocals"]' && JSON.stringify(c) === '["__drums"]' && lane && lane.lane === 'melody' && JSON.stringify(d) === '["melody"]';
  return { pass: ok, litAfterBass: a, litAfterLead: b, litAfterDrums: c, laneAfterStripClick: lane && lane.lane, litAfterStripClick: d }; }
// S12: each strip's meter is two LED columns side by side (L, R), segmented, green at the floor and amber near the top.
// With Bass turned hard left on its knob and the song playing, Bass's L column rises and its R column stays down, as the
// strip shows it. (The two sides, their colours and their behaviour were already there, so that part is a guard; the LED
// segments are new. The meters are live only: e2ExportGraph holds the export's graph.)
export async function n12StereoMeters() { await demoInPanel(); await settle(300);
  const rgb = t => t.match(/\d+(\.\d+)?/g).map(Number);
  const look = n12Strips().map(s => { const bars = [...s.querySelectorAll('.mtr2 .bars .bar')], r = bars.map(b => b.getBoundingClientRect());
    const mask = bars.map(b => { const c = getComputedStyle(b); return (c.maskImage && c.maskImage !== 'none' ? c.maskImage : c.webkitMaskImage) || ''; });
    const cols = ((bars[0] && getComputedStyle(bars[0].querySelector('.rms')).backgroundImage) || '').match(/rgba?\([^)]*\)/g) || [], g0 = cols[0] && rgb(cols[0]);
    const amber = cols.slice(1).some(c => { const [R, G, B] = rgb(c); return R > 200 && G > 140 && G < R && B < 120; });
    return { g: s.dataset.g, two: bars.length === 2 && r.every(x => x.width >= 4) && r[1].left >= r[0].right, segmented: mask.length === 2 && mask.every(m => /repeating-linear-gradient/.test(m)), green: !!g0 && g0[1] > g0[0] && g0[1] > g0[2], amber }; });
  const lookOk = look.length >= 7 && look.every(l => l.two && l.segmented && l.green && l.amber);
  const bass = n12Strips().find(s => s.dataset.g === 'bass'), knob = bass.querySelector('.ctl.knob'); knob.focus(); key('End', { target: knob }); await settle(100);
  const hardLeft = MX().mixOf('bass').pan === -100; await MX().meterReady();
  const shown = i => { const p = bass.querySelectorAll('.mtr2 .bar .pk')[i], m = /inset\(([\d.]+)%/.exec(p.style.clipPath || ''); return m ? 1 - +m[1] / 100 : 0; };
  $('play').click(); await settle(500); let L = 0, R = 0; for (let k = 0; k < 12; k++) { await settle(100); L = Math.max(L, shown(0)); R = Math.max(R, shown(1)); }
  if ($('play').classList.contains('on')) $('play').click(); await settle(200);
  return { pass: lookOk && hardLeft && L > 0.3 && R < 0.05, look: look.filter(l => !(l.two && l.segmented && l.green && l.amber)).slice(0, 3), strips: look.length, hardLeft, bassShown: { L: +L.toFixed(2), R: +R.toFixed(2) } }; }
// S13: the meters' paint writes over a window: every assignment to a meter element's clip-path (each paint assigns every
// meter's, changed or not; an unchanged assignment makes no DOM mutation, so a MutationObserver cannot see the loop).
// Returns null when the property cannot be instrumented, which fails the check instead of reading as zero.
const n13Writes = async ms => { let proto = Object.getPrototypeOf(document.body.style), d = null;
  while (proto && !(d = Object.getOwnPropertyDescriptor(proto, 'clipPath'))) proto = Object.getPrototypeOf(proto);
  if (!d || !d.set) { await settle(ms); return null; } const mine = new Set([...document.querySelectorAll('.mtr2 .bar i')].map(e => e.style)); let n = 0;
  Object.defineProperty(proto, 'clipPath', { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { if (mine.has(this)) n++; d.set.call(this, v); } });
  try { await settle(ms); } finally { Object.defineProperty(proto, 'clipPath', d); } return n; };
const n13Empty = () => [...document.querySelectorAll('#mixer .mtr2 .bar .pk')].filter(p => p.getBoundingClientRect().width > 0)
  .every(p => { const m = /inset\(([\d.]+)%/.exec(p.style.clipPath || ''); return !m || +m[1] >= 99.5; });
// With the mixer showing and nothing playing, no meter element's style changes for a second. After a play and Stop the
// meters fall to empty (not frozen part-way) and then go quiet the same way.
// Measured two ways: the meters' own paint counter (both engines), and the clip-path writes where the engine lets them be
// counted (WebKit; null in Chromium, where it is not needed for the verdict but is reported).
const n13Paints = async ms => { const has = !!MX().meterPaints, p0 = has ? MX().meterPaints() : 0; const w = await n13Writes(ms); return { paints: has ? MX().meterPaints() - p0 : null, writes: w }; };
export async function n13IdleNoPaint() { await settle(1500); await MX().meterReady();
  const idle = await n13Paints(1000);
  $('play').click(); await settle(1200); const playing = await n13Paints(300); $('play').click();
  await settle(5500); const rested = n13Empty(), after = await n13Paints(1000);
  const quiet = m => !!m && m.paints === 0 && (m.writes === null || m.writes === 0);
  return { pass: quiet(idle) && !!playing && playing.paints > 0 && rested && quiet(after), idle, whilePlaying300ms: playing, emptyAfterStop: rested, afterStop: after }; }
// While the song plays the meters paint at least 20 times a second and show the sound (they wake from sleep on the
// first meter data above the floor). (Written after the wake it checks, which n13IdleNoPaint needed first: a guard,
// proven by the mutant that removes the wake.)
export async function n13PlayingPaints() { await settle(1500); await MX().meterReady();
  $('play').click(); await settle(600); const m = await n13Paints(1000), lit = !n13Empty(); if ($('play').classList.contains('on')) $('play').click(); await settle(200);
  return { pass: !!m && m.paints >= 20 && lit, whilePlaying1s: m, metersShowSound: lit }; }
// Hiding and showing the page five times adds no painting loop: while playing, the paint rate after the cycles is within
// 30 % (+5) of the rate before (each cycle used to start another 10 Hz timer, never cleared). Measured by the paint
// counter, and by the clip-path writes where the engine lets them be counted. (Written after the fix: a guard, red on the
// rc.10 tree in WebKit by the writes, and proven by a mutant.)
export async function n13OneLoop() { await settle(1500); await MX().meterReady();
  const flip = h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' }); document.dispatchEvent(new Event('visibilitychange')); };
  $('play').click(); await settle(600); const before = await n13Paints(1000);
  for (let i = 0; i < 5; i++) { flip(true); await settle(60); flip(false); await settle(60); }
  delete document.hidden; delete document.visibilityState; await settle(300); const after = await n13Paints(1000);
  if ($('play').classList.contains('on')) $('play').click(); await settle(200);
  const near = (a, b) => a != null && b != null && b <= a * 1.3 + 5;
  const ok = !!before && !!after && (before.paints == null || near(before.paints, after.paints)) && (before.writes == null || near(before.writes, after.writes)) && (before.paints != null || before.writes != null);
  return { pass: ok, before, after }; }
// S14 (D3): Guided is the Studio screen with the dock collapsed. The regions both modes share sit in the same place (±2
// px); no step rail or classic room shows; the dock's editor is hidden (its tab row stays, as the collapsed dock) and the
// arrangement reaches farther down than in Studio.
const n14Mode = async m => { const b = [...document.querySelectorAll('button[data-m="' + m + '"]')].find(x => x.getBoundingClientRect().width > 0); if (b) b.click(); await settle(700); return !!b; };
const n14Box = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? [r.left, r.top, r.width, r.height].map(Math.round) : null; };
const N14_SHARED = ['#xport', '#saSecs', '#saEnergy', '#dashRail'];
export async function n14GuidedSameScreen() { await settle(900);
  const sounds = () => n14Box('#sndRail') || n14Box('#browser'), arr = () => n14Box('#studioArr');
  const studio = Object.fromEntries(N14_SHARED.map(s => [s, n14Box(s)])); studio.sounds = sounds(); const aS = arr();
  if (!(await n14Mode('guided'))) return { pass: false, why: 'no visible Guided switch' };
  const guided = Object.fromEntries(N14_SHARED.map(s => [s, n14Box(s)])); guided.sounds = sounds(); const aG = arr();
  const moved = Object.keys(studio).filter(k => (!studio[k]) !== (!guided[k]) || (studio[k] && studio[k].some((v, i) => Math.abs(v - guided[k][i]) > 2)));
  const rail = n14Box('#rail'), room = [...document.querySelectorAll('.wview.on')].some(v => v.getBoundingClientRect().height > 0);
  const dockTabs = n14Box('#studioETabs'), editor = n14Box('#studioEdHost'), taller = !!(aS && aG) && aG[1] + aG[3] > aS[1] + aS[3] + 40;
  await n14Mode('studio');
  return { pass: !moved.length && !rail && !room && !!dockTabs && !editor && taller, moved, studio, guided, stepRail: rail, classicRoom: room, dockTabs, dockEditor: editor, arrangement: { studio: aS, guided: aG } }; }
// In Guided, Sounds (its search filters), the sections (a click selects), Energy (a point's arrow key raises its
// section) and the guidance card work; the lanes, the collapsed dock and the selected-track card are inert (no click, no
// Tab stop) and dimmed. Back in Studio nothing is inert or dimmed. (Written after the code: the inert regions were built
// with check 1. A guard, proven by mutants.)
const N14_OFF = ['saLanes', 'studioETabs', 'drTrackBlock'];
const n14Off = id => { const e = $(id); return !!e && !!e.closest('[inert]') && +getComputedStyle(e).opacity <= 0.5; };
export async function n14GuidedInactive() { await demoInPanel(); await settle(300);
  if (!(await n14Mode('guided'))) return { pass: false, why: 'no visible Guided switch' };
  const q = $('sndSearch'), cards = () => [...document.querySelectorAll('#featPresets .feat-card')].filter(c => !c.hidden).length, c0 = cards();
  q.value = 'pulse'; q.dispatchEvent(new Event('input', { bubbles: true })); await settle(250); const searched = cards() < c0 && !q.closest('[inert]');
  q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); await settle(200);
  const secs = [...document.querySelectorAll('#saSecs .sa-sec[data-start]')], last = secs[secs.length - 1]; last.click(); await settle(300);
  const selected = !!document.querySelector('#saSecs .sa-sec.on[data-start="' + last.dataset.start + '"]');
  const runs = S().songBlockList(), run = runs.find(r => r.start === +last.dataset.start), i0 = S().energyRange(run.pat).intensity;
  const pt = [...document.querySelectorAll('#saEPoints .sa-epoint')].find(b => b.classList.contains('on')) || document.querySelectorAll('#saEPoints .sa-epoint')[runs.indexOf(run)];
  pt.focus(); key('ArrowUp', { target: pt }); await settle(300); const raised = S().energyRange(run.pat).intensity > i0;
  const guide = $('drGuideBlock'), guideLive = !!guide && !guide.closest('[inert]') && +getComputedStyle(guide).opacity > 0.9;
  const off = Object.fromEntries(N14_OFF.map(id => [id, n14Off(id)]));
  // a user's click lands where hit-testing puts it (inert content is skipped), so click whatever is at the head's point
  const laneClick = (() => { const hs = [...document.querySelectorAll('.sa-lane .sa-lane-hd .nm')], cur = (document.querySelector('.sa-lane.on') || {}).dataset, b = cur && cur.lane;
    const h = hs.find(x => x.closest('.sa-lane').dataset.lane !== b); if (!h) return null; const r = h.getBoundingClientRect(), t = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    if (t) t.click(); const after = (document.querySelector('.sa-lane.on') || {}).dataset; return (after && after.lane) === b; })();
  await n14Mode('studio'); const back = N14_OFF.filter(id => { const e = $(id); return !e || e.closest('[inert]') || +getComputedStyle(e).opacity < 0.99; });
  const ok = searched && selected && raised && guideLive && Object.values(off).every(Boolean) && laneClick === true && !back.length;
  return { pass: ok, searched, sectionSelected: selected, energyRaised: raised, guidanceLive: guideLive, inactiveInGuided: off, laneClickIgnored: laneClick, stillOffInStudio: back }; }
// Guided and Studio switch back and forth without changing the project or the selected section; the mode is kept
// across a reload; on a phone Guided is still the phone screen (the step rail; S16 changes phones). (Guards: the switch
// was built with check 1; proven by mutants.)
export async function n14ToggleSet() { await demoInPanel(); await settle(300);
  const secs = [...document.querySelectorAll('#saSecs .sa-sec[data-start]')]; secs[1].click(); await settle(300);
  const sel = () => (document.querySelector('#saSecs .sa-sec.on') || {}).dataset, snap0 = S().snapshot(), s0 = sel() && sel().start;
  await n14Mode('guided'); const g1 = sel() && sel().start; await n14Mode('studio'); await n14Mode('guided');
  const same = S().snapshot() === snap0, kept = g1 === s0 && (sel() && sel().start) === s0, gm = document.body.classList.contains('gmode');
  return { pass: same && kept && gm, projectUnchanged: same, selectionKept: kept, selected: [s0, g1], gmode: gm }; }
export async function n14ToggleKept() { await settle(900);
  const gm = document.body.classList.contains('gmode'), on = (document.querySelector('button[data-m="guided"].on') || null) !== null;
  await n14Mode('studio'); const back = !document.body.classList.contains('gmode');
  return { pass: gm && on && back, guidedAfterReload: gm, switchShowsGuided: on, studioAgain: back }; }
export async function n14PhoneSet() { await settle(600); localStorage.setItem('aura-mode', 'guided'); return { pass: true }; }
export async function n14PhoneSeen() { await settle(900); const cl = document.body.classList, rail = $('rail'), r = rail && rail.getBoundingClientRect();
  return { pass: cl.contains('guided') && !cl.contains('gmode') && !!r && r.height > 0, guided: cl.contains('guided'), gmode: cl.contains('gmode'), stepRail: r && Math.round(r.height) }; }
// S15: a primary call to action is a visible button filled with the accent violet that is not a selected or pressed
// state (a tab, a segment, a toggle) and not an energy point.
const n15Primary = () => [...document.querySelectorAll('button, [role="button"]')].filter(b => { const r = b.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false;
  if (b.closest('[inert]') || b.matches('.sa-epoint, [aria-pressed="true"], [aria-selected="true"], [role="tab"], .on')) return false; const cs = getComputedStyle(b);
  if (cs.visibility === 'hidden' || +cs.opacity < 0.5) return false;
  return ((cs.backgroundImage + ' ' + cs.backgroundColor).match(/rgba?\([^)]*\)/g) || []).some(c => { const [R, G, B, A = 1] = c.match(/[\d.]+/g).map(Number); return A > 0.6 && B > 200 && R > 90 && G < 110; }); });
const n15OnScreen = b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; };
// A first visit, the tour closed: exactly one primary call to action on screen, ▶ Play, visible without scrolling. After
// the first Play the screen is as before: Export is primary again.
export async function n15OneFirstAction() { await settle(1500); const x = $('auraTourClose'); if (x && x.getBoundingClientRect().width) { x.click(); await settle(400); }
  const p = n15Primary(), name = b => (b.id || b.className.split(' ')[0]) + ':' + b.textContent.trim().slice(0, 16);
  const one = p.length === 1 && p[0] === $('play') && n15OnScreen(p[0]);
  $('play').click(); await settle(1200); $('play').click(); await settle(500);
  // after: the screen as it always was (Export primary on a desktop; on the classic phone, Play backing; on the phone
  // dashboard, S16, Play stays the one primary and the beginner's look is gone)
  const after = n15Primary(), exportBack = innerWidth >= 768 ? (after.includes($('exportX')) || after.includes($('export')))
    : document.body.classList.contains('phonedash') ? !document.body.classList.contains('beginner') : after.includes($('readyPlay'));
  return { pass: one && exportBack, primaryBefore: p.map(name), playOnScreen: n15OnScreen($('play')), primaryAfterFirstPlay: after.map(name) }; }
// A first visit before Play: every meter empty, no meter paints for a second, and the Master's readouts (S, I, TP and
// the File line) show no numbers. Play starts them.
export async function n15QuietUntilPlaying() { await settle(2500); const x = $('auraTourClose'); if (x && x.getBoundingClientRect().width) { x.click(); await settle(300); }
  const nums = () => ['mLufsS', 'mLufsI', 'mTp', 'mFile'].map(id => [id, ($(id) || {}).textContent || '']).filter(([, t]) => /\d/.test(t));
  const p0 = MX().meterPaints ? MX().meterPaints() : null; await settle(1000); const paints = p0 == null ? null : MX().meterPaints() - p0;
  const empty0 = n13Empty(), before = nums(), quiet = empty0 && paints === 0 && before.length === 0;
  $('play').click(); await settle(2500); const live = nums().map(([id]) => id); $('play').click(); await settle(300);
  return { pass: quiet && live.includes('mLufsI'), metersEmptyBeforePlay: empty0, paintsIdle: paints, numbersBeforePlay: before, numbersWhilePlaying: live }; }
// Every visible control in Studio at 1440 (the demo, the mixer showing) has a tooltip in plain words: a title (or a
// described-by text) of at least three words. A control named with jargon (LUFS, dBTP, EQ, Pan, Mute, Solo, Reverb or
// Delay sends, Snap, BPM, Swing, Intensity, Warmth, Movement, Space, Preserve, Loop) explains it: at least six words.
const N15_JARGON = /\b(LUFS|dBTP|EQ|Pan|Mute|Solo|Reverb|Delay|Snap|BPM|Swing|Intensity|Warmth|Movement|Space|Preserve|Loop)\b/i;
export async function n15Tooltips() { await demoInPanel(); await settle(300);
  const ctl = [...document.querySelectorAll('button, input:not([type="hidden"]), select, [role="slider"], [role="tab"], a[href]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[inert]') && getComputedStyle(e).visibility !== 'hidden'; });
  const tip = e => (e.getAttribute('title') || (e.getAttribute('aria-describedby') || '').split(/\s+/).map(id => ($(id) || {}).textContent || '').join(' ')).trim();
  const nameOf = e => (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || e.id || '').trim().replace(/\s+/g, ' ');
  const words = t => (t.match(/[A-Za-zÀ-ɏ'’-]+/g) || []).length;
  const bad = ctl.map(e => { const t = tip(e), n = nameOf(e), jar = N15_JARGON.test(n) || /^[MS]$/.test((e.textContent || '').trim()); return { id: idOf(e), name: n.slice(0, 30), tip: t.slice(0, 40), need: jar ? 6 : 3, ok: words(t) >= (jar ? 6 : 3) }; }).filter(x => !x.ok);
  return { pass: ctl.length > 50 && !bad.length, controls: ctl.length, without: bad.length, first: bad.slice(0, 25) }; }
// A featured card is draggable. Dropped on another instrument's lane it changes nothing and says where that sound goes;
// dropped on its own track's lane it gives that track the sound as one undo step, and Undo puts the old sound back.
const n15Drag = (card, lane) => { const dt = new DataTransfer(), D = (t, el) => el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
  D('dragstart', card); D('dragenter', lane); const over = !D('dragover', lane); D('drop', lane); D('dragend', card); return over; };
export async function n15DropPreset() { await settle(900);
  const card = featCard('deep-pulse'); if (!card) return { pass: false, why: 'no Deep pulse card' };
  const lane = id => document.querySelector('.sa-lane[data-lane="' + id + '"]'), bs = $('bassStyle'), before = bs.value;
  if (before === '808') return { pass: false, why: 'the bass is already 808, so a drop would prove nothing' };
  const draggable = card.getAttribute('draggable') === 'true';
  const d0 = S().undoDepth(); n15Drag(card, lane('melody')); await settle(400);
  const wrongKept = bs.value === before && S().undoDepth() === d0, said = /bass/i.test(($('toast') || {}).textContent || '');
  const accepted = n15Drag(card, lane('bass')); await settle(400); const applied = bs.value, steps = S().undoDepth() - d0;
  $('undoX').click(); await settle(500); const undone = bs.value;
  return { pass: draggable && wrongKept && said && accepted && applied === '808' && steps === 1 && undone === before,
    draggable, wrongLaneChangesNothing: wrongKept, saidWhereItGoes: said, bassLaneAccepts: accepted, applied, undoSteps: steps, afterUndo: undone }; }
// Each of the section's energy sliders (Intensity, Warmth, Movement, Space), dragged as a hand drags a slider (a stream of
// input events, then one change), is ONE undo step, and Undo puts the value back.
export async function n15SliderOneStep() { await demoInPanel(); await settle(300);
  const out = {};
  for (const id of ['drInt', 'drWarm', 'drMove', 'drSpace']) { const el = $(id); if (!el) { out[id] = 'missing'; continue; }
    const v0 = +el.value, d0 = S().undoDepth(), dir = v0 > 50 ? -1 : 1;
    for (let k = 1; k <= 6; k++) { el.value = String(v0 + dir * k * 5); el.dispatchEvent(new Event('input', { bubbles: true })); await settle(30); }
    el.dispatchEvent(new Event('change', { bubbles: true })); await settle(700);
    const steps = S().undoDepth() - d0; $('undoX').click(); await settle(500); out[id] = { from: v0, steps, afterUndo: +$(id).value }; }
  const ok = Object.values(out).every(o => o && o.steps === 1 && Math.abs(o.afterUndo - o.from) <= 1);
  return { pass: ok, sliders: out }; }
// An Apply is heard in the export: with the last section's Intensity set far from where it is, Apply (one undo step)
// changes the rendered file, and Undo puts the file back exactly. A fingerprint of every 7th sample, weighted by position.
// The export repeats to within about 1e-6 of this fingerprint, so a change counts above 1e-4 (a hundred times that). (A
// guard: Apply already reached the export; this holds it.)
const n15Fp = b => { let s = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i += 7) s += d[i] * d[i] * (1 + (i % 13)); } return s; };
export async function n15ApplyInExport() { await demoInPanel(); await settle(300);
  const secs = [...document.querySelectorAll('#saSecs .sa-sec[data-start]')]; secs[secs.length - 1].click(); await settle(300);
  const el = $('drInt'), v0 = +el.value; el.value = String(v0 > 50 ? 5 : 100); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); await settle(700);
  const ap = $('drApply'); if (!ap || ap.disabled) return { pass: false, why: 'Apply is not available', disabled: ap && ap.disabled };
  // The engine's own repeat noise, measured here: the same song rendered three times (WebKit's renders differ by about 3e-6;
  // a fixed 1e-6 bound failed rc.13's first gate while Undo was exact). Undo's restore is proven by the saved state being
  // identical; the file after Undo must be within ten times that noise, and Apply's change over fifty times it.
  const rel = (x, y) => Math.abs(x - y) / Math.max(1e-9, Math.abs(x)), snap0 = S().snapshot();
  const a = n15Fp(await S().renderExport()), noise = Math.max(rel(a, n15Fp(await S().renderExport())), rel(a, n15Fp(await S().renderExport()))), d0 = S().undoDepth();
  ap.click(); await settle(900); const steps = S().undoDepth() - d0, b = n15Fp(await S().renderExport());
  $('undoX').click(); await settle(700); const stateBack = S().snapshot() === snap0, c = n15Fp(await S().renderExport());
  return { pass: steps === 1 && rel(a, b) > Math.max(1e-4, 50 * noise) && stateBack && rel(a, c) <= Math.max(1e-6, 10 * noise),
    undoSteps: steps, changedByApply: +rel(a, b).toFixed(5), repeatNoise: noise, stateBackAfterUndo: stateBack, offAfterUndo: rel(a, c) }; }
// S16: on a phone (≤ 480 px) four tabs, Sounds, Arrange, Mix and Aura; each shows its own region and no other, filling
// the screen's width (±24 px); no classic room shows.
const N16_TABS = { Sounds: '#browser', Arrange: '#studioArr', Mix: '#studioEdHost', Aura: '#inspect' };
const n16Shown = sel => { const e = document.querySelector(sel), r = e && e.getBoundingClientRect(); return !!r && r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
export async function n16Tabs() { await settle(900);
  const bar = $('phoneTabs'), tabs = bar ? [...bar.querySelectorAll('[role="tab"]')] : [], names = tabs.map(t => t.textContent.trim());
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(N16_TABS))) return { pass: false, names, classicBar: n16Shown('.wtabs') };
  const res = {};
  for (const t of tabs) { t.click(); await settle(350); const name = t.textContent.trim(), own = document.querySelector(N16_TABS[name]), r = own && own.getBoundingClientRect();
    res[name] = { shown: Object.keys(N16_TABS).filter(k => n16Shown(N16_TABS[k])), selected: t.getAttribute('aria-selected') === 'true', width: r && Math.round(r.width),
      classicRoom: [...document.querySelectorAll('.wview.on')].some(v => v.getBoundingClientRect().height > 0) }; }
  const ok = Object.entries(res).every(([k, v]) => v.selected && JSON.stringify(v.shown) === JSON.stringify([k]) && v.width >= innerWidth - 24 && !v.classicRoom);
  return { pass: ok, tabs: res }; }
// On the phone's Arrange panel the arrangement scrolls sideways (the song is wider than the screen) and the track names
// stay in place while the clips move under them.
export async function n16StickyTracks() { await demoInPanel(); await settle(300);
  const tab = document.querySelector('#phoneTabs [data-p="arrange"]'); if (!tab) return { pass: false, why: 'no Arrange tab' }; tab.click(); await settle(400);
  const arr = $('studioArr'), name = document.querySelector('.sa-lane .sa-lane-hd .nm'), clip = document.querySelector('.sa-lane .sa-clip');
  if (!name || !clip) return { pass: false, why: 'no lane name or clip on the phone', name: !!name, clip: !!clip };
  const wide = arr.scrollWidth > arr.clientWidth + 20, n0 = name.getBoundingClientRect().left, c0 = clip.getBoundingClientRect().left;
  arr.scrollLeft = 160; arr.dispatchEvent(new Event('scroll')); await settle(250);
  const n1 = name.getBoundingClientRect().left, c1 = clip.getBoundingClientRect().left;
  return { pass: wide && Math.abs(n1 - n0) <= 1 && c0 - c1 >= 100, scrollsSideways: wide, scroll: [arr.scrollWidth, arr.clientWidth], nameMoved: Math.round(n1 - n0), clipMoved: Math.round(c0 - c1) }; }
// Play, Record and Export sit in a bar at the bottom of the phone's screen (their bottoms within the last 120 px, fixed),
// on every panel, and stay put while a panel scrolls; Play still plays.
export async function n16TransportFixed() { await settle(900);
  const ids = ['play', 'recX', 'navExport'], at = () => ids.map(id => { const e = $(id), r = e && e.getBoundingClientRect(); return r && r.width > 0 ? Math.round(r.bottom) : null; });
  const res = {};
  for (const p of ['sounds', 'arrange', 'mix', 'aura']) { const t = document.querySelector('#phoneTabs [data-p="' + p + '"]'); if (!t) return { pass: false, why: 'no ' + p + ' tab' };
    t.click(); await settle(300); const b0 = at(); const sc = [$('browser'), $('studioArr'), $('studioEdHost'), $('inspect')].find(e => e && e.getBoundingClientRect().height > 0 && e.scrollHeight > e.clientHeight);
    if (sc) { sc.scrollTop = 200; await settle(150); } res[p] = { before: b0, afterScroll: at(), scrolled: !!sc }; }
  const fixedOk = Object.values(res).every(v => v.before.every(b => b != null && b >= innerHeight - 120 && b <= innerHeight) && JSON.stringify(v.before) === JSON.stringify(v.afterScroll));
  $('play').click(); await settle(1200); const playing = $('play').classList.contains('on'); $('play').click(); await settle(300);
  return { pass: fixedOk && playing, panels: res, viewport: innerHeight, playPlays: playing }; }
// No phone panel makes the page wider than the screen (the arrangement scrolls inside itself).
export async function n16NoOverflow() { await demoInPanel(); await settle(300);
  const res = {};
  for (const p of ['sounds', 'arrange', 'mix', 'aura']) { const t = document.querySelector('#phoneTabs [data-p="' + p + '"]'); if (!t) return { pass: false, why: 'no ' + p + ' tab' };
    t.click(); await settle(300); const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || r.right <= innerWidth + 1) return false;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const ox = getComputedStyle(a).overflowX; if (ox !== 'visible') return false; } return true; }).slice(0, 4).map(idOf);
    res[p] = { pageWidth: document.documentElement.scrollWidth, wide }; }
  return { pass: Object.values(res).every(v => v.pageWidth <= innerWidth && !v.wide.length), viewport: innerWidth, panels: res }; }


// ---- rc.15 core path (docs/superpowers/plans/2026-11-05-core-path-rc15.md): Philip's own beat is the song ----
// A 16-bit stereo WAV made here, so every check owns its audio: `fill(t)` gives the sample at t seconds.
const cpWav = (secs, fill, sr = 44100) => { const n = Math.round(secs * sr), v = new DataView(new ArrayBuffer(44 + n * 4)), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, sr, true);
  v.setUint32(28, sr * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, fill(i / sr))) * 32767 | 0; v.setInt16(44 + i * 4, s, true); v.setInt16(46 + i * 4, s, true); } return v.buffer; };
// A 140 BPM beat (a 55 Hz kick each beat, a 41 Hz line under it, a noise hat each eighth) with a silent stretch
// [gap0, gap1): anything Aura adds of its own would sound there, and its edges show the beat's own speed.
let cpSeed = 9; const cpNoise = () => (cpSeed = (cpSeed * 16807) % 2147483647) / 2147483647 * 2 - 1;
const cpBeat = (secs = 20, gap = [8, 12]) => cpWav(secs, t => { if (t >= gap[0] && t < gap[1]) return 0; const b = 60 / 140, tb = t % b, t8 = t % (b / 2);
  return 0.45 * Math.sin(2 * Math.PI * 55 * tb) * Math.exp(-tb * 18) + 0.15 * Math.sin(2 * Math.PI * 41 * t) + 0.12 * cpNoise() * Math.exp(-t8 * 60); });
const cpFile = (bytes, name) => new File([bytes], name, { type: 'audio/wav' });
// A file handed to a file input the way the browser hands a picked one: its files set, then `change`.
const cpGive = (input, file) => { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); };
const cpWait = async (ok, ms = 8000) => { const t0 = performance.now(); while (performance.now() - t0 < ms) { if (ok()) return true; await settle(100); } return !!ok(); };
// Level of a rendered buffer over [a, b) seconds, in dBFS (both channels).
const cpDb = (buf, a, b) => { let s = 0, n = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c);
  for (let i = Math.floor(a * buf.sampleRate); i < Math.min(d.length, Math.floor(b * buf.sampleRate)); i++) { s += d[i] * d[i]; n++; } } return n && s > 0 ? +(10 * Math.log10(s / n)).toFixed(1) : -200; };
// The first time at or after `from` seconds where the buffer passes `lvl`: where sound starts again.
const cpOnset = (buf, from, lvl = 0.01) => { const d = buf.getChannelData(0); for (let i = Math.floor(from * buf.sampleRate); i < d.length; i++) if (Math.abs(d[i]) > lvl) return +(i / buf.sampleRate).toFixed(3); return -1; };
const cpAuraClips = () => ['drums', 'bass', 'keys', 'melody'].map(id => document.querySelectorAll(`.sa-lane[data-lane="${id}"] .sa-clip`).length).reduce((a, c) => a + c, 0);
// Sing over my beat, given a file: the dedicated input every way in uses.
async function cpSingOver(file) { const fi = $('beatFile'); if (!fi) return { ok: false, why: 'no #beatFile: no way to sing over my own beat' };
  cpGive(fi, file); const ok = await cpWait(() => S().hasSample() && !S().sampleMuted() && !!(JSON.parse(S().snapshot()).beat), 10000); await settle(400); return { ok }; }

// 1. Sing over my beat: the file is the backing, in the track, at its own speed; Aura's parts are empty; the export is the
// beat's length and silent where the beat is silent (Aura's own parts would sound there).
export async function cp1MyBeatIsTheSong() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(20, [8, 12]), 'my-beat.wav')); if (!go.ok) return { pass: false, ...go };
  const buf = await S().renderExport(), secs = +buf.duration.toFixed(3), body = cpDb(buf, 1, 7.5), gap = cpDb(buf, 8.4, 11.8), back = cpOnset(buf, 11.5), aura = cpAuraClips();
  const pass = Math.abs(secs - 20) <= 0.05 && body > -30 && gap < -70 && Math.abs(back - 12) <= 0.01 && aura === 0;
  return { pass, secs, bodyDb: body, gapDb: gap, beatBackAt: back, auraClips: aura, muted: S().sampleMuted() };
}
// Counts the beat picker opening (the browser's file dialog cannot open in a check) while `run` does what a person does.
async function cpSpyPick(run) { const fi = $('beatFile'); if (!fi) return { picks: -1, why: 'no #beatFile' }; let n = 0; fi.click = () => { n++; };
  try { await run(); await settle(350); } finally { delete fi.click; } return { picks: n }; }
const cpRefInput = () => [...document.querySelectorAll('input[type=file]')].find(i => i.accept === 'audio/*,video/*' && !i.id);
// 2. Every way in leads to it: the Welcome's chip, the project menu (⋯ on a phone), and the import card, where a song
// already imported becomes the beat without picking it again.
export async function cp2MyBeatWays() {
  const phone = innerWidth < 481, out = {};
  await ensureWelcome(); const chip = document.querySelector('#welcome .wchip[data-w="mybeat"]');
  out.welcome = chip ? Object.assign({ label: chip.textContent.trim(), shown: shown(chip) }, await cpSpyPick(async () => chip.click()), { closed: !welcomeOpen() }) : null;
  await settle(200);
  if (phone) { const m = $('mMore'); if (m) { m.click(); await settle(400); }
    const row = [...document.querySelectorAll('.msrow')].find(b => /sing over my beat/i.test(b.textContent));
    out.menu = row ? Object.assign({ label: row.textContent.trim(), shown: shown(row) }, await cpSpyPick(async () => row.click())) : null; }
  else { const pb = $('projMenuBtn') || $('projX'); if (pb) { pb.click(); await settle(300); }
    const it = [...document.querySelectorAll('#projmenu .projmi')].find(b => /sing over my beat/i.test(b.textContent));
    out.menu = it ? Object.assign({ label: it.textContent.trim(), shown: shown(it) }, await cpSpyPick(async () => it.click())) : null; }
  await settle(200);
  // the card: a song imported the ordinary way (a reference), then made the beat from there
  const ri = cpRefInput(); if (!ri) return { pass: false, why: 'no reference input', ...out };
  cpGive(ri, cpFile(cpBeat(12, [5, 7]), 'ref-beat.wav')); await cpWait(() => S().hasSample(), 10000); await settle(600);
  const card = $('refMyBeat'); if (card) card.scrollIntoView({ block: 'center' }); await settle(150);
  out.card = card ? Object.assign({ label: card.textContent.trim(), shown: shown(card) }, await cpSpyPick(async () => card.click())) : null;
  if (card) await cpWait(() => !!JSON.parse(S().snapshot()).beat, 10000);
  const b = JSON.parse(S().snapshot()).beat || null; out.after = { beat: b && b.name, muted: S().sampleMuted(), auraClips: cpAuraClips() };
  const ok = x => !!x && x.shown && /sing over my beat|my beat/i.test(x.label);
  const pass = ok(out.welcome) && out.welcome.picks === 1 && out.welcome.closed && ok(out.menu) && out.menu.picks === 1
    && ok(out.card) && out.card.picks === 0 && out.after.beat === 'ref-beat.wav' && out.after.muted === false && out.after.auraClips === 0;
  return { pass, W: innerWidth, ...out };
}
// 3. Tempo, for the grid only (the beat plays as it is): Aura offers what it heard and its double (or half), and takes
// the number the singer types from FL Studio. Each is one undo step, and none changes how the beat sounds.
export async function cp3MyBeatTempo() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(20, [8, 12]), 'my-beat.wav')); if (!go.ok) return { pass: false, ...go };
  const row = $('beatTempo'); if (row) row.scrollIntoView({ block: 'center' }); await settle(150);
  const btns = row ? [...row.querySelectorAll('button[data-bt]')] : [], nums = btns.map(b => +b.dataset.bt), bpm = () => +$('bpm').value, start = bpm();
  if (!row || !shown(row) || btns.length !== 2) return { pass: false, why: 'no tempo choice for the beat', shown: !!row && shown(row), nums };
  const other = btns.find(b => +b.dataset.bt !== start); other.click(); await settle(300); const picked = bpm(), d0 = S().undoDepth();
  const inp = $('beatTempoIn'); inp.value = '140'; inp.dispatchEvent(new Event('change', { bubbles: true })); await settle(300); const typed = bpm(), d1 = S().undoDepth();
  $('undoX').click(); await settle(400); const undone = bpm();
  const buf = await S().renderExport(), back = cpOnset(buf, 11.5);
  const pass = nums.includes(start) && (Math.abs(nums[0] * 2 - nums[1]) <= 1 || Math.abs(nums[1] * 2 - nums[0]) <= 1) && picked === +other.dataset.bt && typed === 140 && d1 === d0 + 1 && undone === picked && Math.abs(back - 12) <= 0.01;
  return { pass, start, nums, picked, typed, undone, undoSteps: d1 - d0, beatBackAt: back };
}
const cpTone = (secs, hz = 1234, amp = 0.3) => cpWav(secs, t => amp * Math.sin(2 * Math.PI * hz * t));
const cpSetTempo = async v => { const i = $('beatTempoIn'); if (!i) return false; i.value = String(v); i.dispatchEvent(new Event('change', { bubbles: true })); await settle(300); return +$('bpm').value === v; };
// Where a lane's first clip sits, as a share of the lane (0-100).
const cpClipPct = id => { const l = document.querySelector(`.sa-lane[data-lane="${id}"] .sa-lane-body`), c = l && l.querySelector('.sa-clip'); if (!c) return null;
  const lr = l.getBoundingClientRect(), cr = c.getBoundingClientRect(); return { left: +((cr.left - lr.left) / lr.width * 100).toFixed(1), width: +(cr.width / lr.width * 100).toFixed(1) }; };
// 4. The whole beat is on screen: the ruler reaches its last bar (past 8 and past 32 when it is that long), and a take
// and the beat are drawn at their true lengths on it.
export async function cp4WholeBeat() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(60, [20, 22]), 'long-beat.wav')); if (!go.ok) return { pass: false, ...go };
  const tempoSet = await cpSetTempo(140), barSec = 240 / 140, want = Math.ceil(60 / barSec - 1e-6);   // 35 bars: past 32 too
  S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(50)], { type: 'audio/wav' }), 0); await settle(600);
  const ticks = document.querySelectorAll('#saRuler .sa-rtick').length, span = ticks * barSec, take = cpClipPct('voice'), beatClip = cpClipPct('atmosphere');
  const wantTake = 50 / span * 100, wantBeat = 60 / span * 100;
  const pass = tempoSet && ticks === want && !!take && Math.abs(take.left) <= 0.5 && Math.abs(take.width - wantTake) <= 1 && !!beatClip && Math.abs(beatClip.width - wantBeat) <= 1;
  return { pass, tempoSet, ticks, wantBars: want, take, wantTakeWidth: +wantTake.toFixed(1), beatClip, wantBeatWidth: +wantBeat.toFixed(1) };
}
const cpBar = () => parseInt((($('readout') || {}).textContent || '0'), 10);
// A click on the ruler at the middle of bar `n` (1-based), the way a person clicks it.
const cpRulerClick = n => { const t = innerWidth < 481 && document.querySelector('#phoneTabs [data-p="arrange"]'); if (t && t.getAttribute('aria-selected') !== 'true') t.click();   // on a phone the ruler is on the Arrange tab
  const r = $('saRuler'); if (!r) return false; const k = r.querySelectorAll('.sa-rtick').length, b = r.getBoundingClientRect();
  r.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: b.left + b.width * ((n - 0.5) / k), clientY: b.top + b.height / 2 })); return true; };
// 5. Where Play starts: a click on the ruler sets the bar; Play starts the beat (heard, not just drawn) and the readout
// there; ■ goes back to that bar, and ■ again, stopped, goes back to bar 1.
export async function cp5StartPoint() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(40, [20, 22]), 'start-beat.wav')); if (!go.ok) return { pass: false, ...go };
  await cpSetTempo(140); if (!cpRulerClick(11)) return { pass: false, why: 'no ruler' }; await settle(250);
  const set = cpBar(); $('play').click(); await settle(1000); const playing = cpBar(), beatOn = S().liveDb('beat');
  await settle(2600); const beatInGap = S().liveDb('beat');        // bar 11 starts at 17.1 s, so 3.6 s on is 20.7 s: the beat's silence
  $('stopX').click(); await settle(300); const back = cpBar(); $('stopX').click(); await settle(300); const home = cpBar();
  const pass = set === 11 && playing === 11 && beatOn > -45 && beatInGap < -70 && back === 11 && home === 1;
  return { pass, set, playing, beatOn, beatInGap, back, home };
}
// 6. ▶ plays the recorded vocals too (live rc.14 played the backing only: Play never scheduled a take), and from the start
// point a take plays from inside, where that bar falls in it.
export async function cp6PlayHearsTakes() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(40, [30, 32]), 'takes-beat.wav')); if (!go.ok) return { pass: false, ...go };
  await cpSetTempo(140); S().voxSelect('vocals');
  // the take sings 0-5.5 s and 8.5-12 s, and is silent between: bar 5 (6.9 s) falls in the silence, so from there the take
  // must play from inside (silent), not from its own start (singing)
  await S().recordFromBlob(new Blob([cpWav(12, t => (t < 5.5 || t >= 8.5) ? 0.3 * Math.sin(2 * Math.PI * 1234 * t) : 0)], { type: 'audio/wav' }), 0); await settle(500);
  $('play').click(); await settle(900); const top = { sources: S().takeLive().sources, vocals: S().liveDb('vocals') }; $('stopX').click(); await settle(300);
  cpRulerClick(5); await settle(250); $('play').click(); await settle(900);           // bar 5 is 6.9 s: inside the take's silence
  const inside = { sources: S().takeLive().sources, vocals: S().liveDb('vocals') }; $('stopX').click(); await settle(300);
  cpRulerClick(9); await settle(250); $('play').click(); await settle(900);           // bar 9 is 13.7 s: after it ends
  const after = { sources: S().takeLive().sources, vocals: S().liveDb('vocals') }; $('stopX').click(); await settle(300);
  const pass = top.sources >= 1 && top.vocals > -45 && inside.sources >= 1 && inside.vocals < -70 && after.sources === 0 && after.vocals < -70;
  return { pass, top, inside, after };
}
// A microphone for the record path in both engines: getUserMedia answers with a tone from the page's own audio context, so
// ●, MediaRecorder, Stop, the decode and the lane all run as they do for a singer. Returns a function that puts it back.
const cpFakeMic = (hz = 600) => { const md = navigator.mediaDevices, orig = md.getUserMedia;
  md.getUserMedia = async () => { const ac = window.__auraVocal.audioContext(), o = ac.createOscillator(), g = ac.createGain(), d = ac.createMediaStreamDestination();
    o.frequency.value = hz; g.gain.value = 0.3; o.connect(g); g.connect(d); o.start(); return d.stream; };
  return () => { md.getUserMedia = orig; }; };
const cpRec = async secs => { const c = $('countin'); if (c && c.checked) c.click(); const r = $('recX'); r.click(); await cpWait(() => r.classList.contains('on'), 5000); await settle(secs * 1000); };
const cpRecStop = async id => { const before = S().voxBuffer(id); $('recX').click(); await cpWait(() => S().voxBuffer(id) && S().voxBuffer(id) !== before, 10000); await settle(500); };
// 7. While recording, the other vocal tracks play (a double is sung against the Lead); the armed track's own earlier audio
// does not (it is being recorded over).
export async function cp7HearWhileRecording() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(40, [30, 32]), 'hear-beat.wav')); if (!go.ok) return { pass: false, ...go };
  await cpSetTempo(140);
  S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(20, 1234)], { type: 'audio/wav' }), 0);
  S().voxSelect('double'); await S().recordFromBlob(new Blob([cpTone(20, 330)], { type: 'audio/wav' }), 0); await settle(400);
  const back = cpFakeMic(600); let during;
  try { await cpRec(1.2); during = { tracks: S().takeLive().tracks.slice(), lead: S().liveDb('vocals'), double: S().liveDb('double') }; await cpRecStop('double'); } finally { back(); }
  const pass = during.tracks.join() === 'vocals' && during.lead > -45 && during.double < -70;
  return { pass, during };
}
// What a vocal track plays at timeline second t, read from its clips and buffer (what the export and Play schedule from):
// the strength of `hzs` over 0.2 s there, or null where no clip covers t.
const cpTrackAt = (id, t, hzs = [600, 1234]) => { const was = S().voxBuffer ? null : null; S().voxSelect(id); const buf = S().voxBuffer(id), clips = S().takeClips();
  const c = clips.find(k => t >= k.at && t < k.at + (k.to - k.from) / (k.rate || 1)); if (!buf || !c) return null; const sr = buf.sampleRate, d = buf.getChannelData(0);
  const p0 = Math.floor((c.from + (t - c.at) * (c.rate || 1)) * sr), n = Math.floor(0.2 * sr), out = {};
  hzs.forEach(hz => { const k = 2 * Math.cos(2 * Math.PI * hz / sr); let a = 0, b = 0; for (let i = p0; i < Math.min(d.length, p0 + n); i++) { const x = d[i] + k * a - b; b = a; a = x; } out[hz] = +(Math.sqrt(Math.max(0, a * a + b * b - k * a * b)) / (n / 2)).toFixed(3); });
  return out; };
// 8. Punch-in: recording again on a track from the start point replaces only the stretch it covers; the track's audio
// before and after it stays. One ↶ puts the track back as it was.
export async function cp8PunchIn() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(40, [30, 32]), 'punch-beat.wav')); if (!go.ok) return { pass: false, ...go };
  await cpSetTempo(140); S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(20, 1234)], { type: 'audio/wav' }), 0); await settle(300);
  cpRulerClick(5); await settle(250);                                       // bar 5 is 6.86 s
  const back = cpFakeMic(600); try { await cpRec(3); await cpRecStop('vocals'); } finally { back(); }
  const at = t => cpTrackAt('vocals', t), after = { s3: at(3), s8: at(8), s14: at(14), clips: S().takeClips().length };
  $('undoX').click(); await settle(400);
  const undone = { s8: at(8), clips: S().takeClips().length };
  const has = (r, hz) => !!r && r[hz] > 0.1, not = (r, hz) => !!r && r[hz] < 0.02;
  const pass = has(after.s3, 1234) && not(after.s3, 600) && has(after.s8, 600) && not(after.s8, 1234) && has(after.s14, 1234) && not(after.s14, 600)
    && after.clips === 3 && has(undone.s8, 1234) && not(undone.s8, 600) && undone.clips === 1;
  return { pass, after, undone };
}
// 9. A vocal file (a take sung elsewhere) goes onto the armed track at the start point, by the punch-in rule, from the
// project menu (⋯ on a phone).
export async function cp9ImportTake() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(40, [30, 32]), 'take-beat.wav')); if (!go.ok) return { pass: false, ...go };
  await cpSetTempo(140); cpRulerClick(5); await settle(250); S().voxSelect('double'); await settle(200);
  const phone = innerWidth < 481; let item = null;
  if (phone) { const m = $('mMore'); if (m) { m.click(); await settle(400); } item = [...document.querySelectorAll('.msrow')].find(b => /import a vocal/i.test(b.textContent)); }
  else { const pb = $('projMenuBtn') || $('projX'); if (pb) { pb.click(); await settle(300); } item = [...document.querySelectorAll('#projmenu .projmi')].find(b => /import a vocal/i.test(b.textContent)); }
  const fi = $('takeFile'); if (!item || !fi) return { pass: false, why: 'no way to import a vocal file', item: !!item, input: !!fi };
  let picks = 0; fi.click = () => { picks++; }; item.click(); await settle(300); delete fi.click;
  cpGive(fi, cpFile(cpTone(4, 600), 'my-vocal.wav')); await cpWait(() => !!S().voxBuffer('double'), 8000); await settle(500);
  S().voxSelect('double'); const c = S().takeClips()[0] || null, from = 4 * 240 / 140;
  const pass = picks === 1 && !!c && Math.abs(c.at - from) <= 0.05 && !!cpTrackAt('double', from + 1) && cpTrackAt('double', from + 1)[600] > 0.1 && cpTrackAt('double', from - 1) === null && !S().voxBuffer('vocals');
  return { pass, W: innerWidth, picks, clip: c && { at: +c.at.toFixed(3), len: +(c.to - c.from).toFixed(2) }, want: +from.toFixed(3), lead: !!S().voxBuffer('vocals') };
}
// 10. The beat is never stored (imported audio never is), so after a reload a my-beat project names the file it was built
// on, on its beat lane, and takes it back into the same project: the takes and the song stay, nothing becomes a new project.
export async function cp10BeatBackSetup() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(20, [8, 12]), 'reload-beat.wav')); if (!go.ok) return { pass: false, ...go };
  await cpSetTempo(140); S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(6, 1234)], { type: 'audio/wav' }), 0); await S().voxSaved(); await settle(300);
  sessionStorage.setItem('cp10', JSON.stringify({ snap: S().snapshot() })); return { pass: true };
}
export async function cp10BeatBack() {
  await settle(800); await S().voxReady(); await settle(300); if (innerWidth < 481) { const t = document.querySelector('#phoneTabs [data-p="arrange"]'); if (t) t.click(); await settle(300); }
  const was = JSON.parse(sessionStorage.getItem('cp10') || '{}'), st = JSON.parse(S().snapshot()), b = $('beatBack');
  const before = { beat: st.beat && st.beat.name, sample: S().hasSample(), take: !!S().voxBuffer('vocals'), prompt: b ? { shown: shown(b), text: b.textContent.trim() } : null, lane: ((document.querySelector('.sa-lane[data-lane="atmosphere"] .nm') || {}).textContent || '') };
  if (!b) return { pass: false, why: 'no #beatBack', before };
  const fi = $('beatFile'); let picks = 0; fi.click = () => { picks++; }; b.click(); await settle(300); delete fi.click;
  cpGive(fi, cpFile(cpBeat(20, [8, 12]), 'reload-beat.wav')); await cpWait(() => S().hasSample() && !S().sampleMuted(), 10000); await settle(500);
  const buf = await S().renderExport(), after = { sample: S().hasSample(), muted: S().sampleMuted(), take: !!S().voxBuffer('vocals'), sameSong: S().snapshot() === was.snap, secs: +buf.duration.toFixed(2), gapDb: cpDb(buf, 8.4, 11.8), bodyDb: cpDb(buf, 1, 5), promptGone: !$('beatBack') || !shown($('beatBack')) };
  const pass = before.beat === 'reload-beat.wav' && !before.sample && before.take && before.prompt.shown && /reload-beat\.wav/.test(before.prompt.text) && picks === 1
    && after.sample && !after.muted && after.take && after.sameSong && Math.abs(after.secs - 20) <= 0.05 && after.gapDb < -70 && after.bodyDb > -30 && after.promptGone;
  return { pass, W: innerWidth, before, picks, after };
}
// 11. A beat mastered loud (FL Studio exports peak near -0.3 dBFS) with a vocal sung over it: the export does not clip. Where
// there is no vocal the beat is exactly as it was (no limiter touches it there).
export async function cp11LoudBeatNoClip() {
  await settle(300); let sd = 3; const nz = () => (sd = (sd * 16807) % 2147483647) / 2147483647 * 2 - 1;
  const loud = cpWav(16, t => { const b = 60 / 140, tb = t % b; const x = 0.9 * Math.sin(2 * Math.PI * 50 * tb) * Math.exp(-tb * 6) + 0.35 * Math.sin(2 * Math.PI * 44 * t) + 0.25 * nz(); return Math.max(-0.966, Math.min(0.966, x)); });
  const go = await cpSingOver(cpFile(loud, 'loud-beat.wav')); if (!go.ok) return { pass: false, ...go };
  S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(6, 440, 0.5)], { type: 'audio/wav' }), 0); await settle(400);
  const buf = await S().renderExport(); let peak = 0, over = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (a > 1) over++; } }
  // the beat alone (10-15 s, after the vocal): compare with the file itself, sample for sample
  const src = new DataView(loud), sr = buf.sampleRate, d0 = buf.getChannelData(0); let worst = 0;
  for (let i = Math.floor(10 * sr); i < Math.floor(15 * sr); i++) worst = Math.max(worst, Math.abs(d0[i] - src.getInt16(44 + i * 4, true) / 32767));
  const pass = over === 0 && peak <= 1 && worst < 0.002;
  return { pass, peak: +peak.toFixed(4), samplesOverFullScale: over, beatAloneDiff: +worst.toFixed(5) };
}
// 12. ↶ reaches a punch-in only while it is the last thing done: once another track gets its first take (sung or a
// file), ↶ leaves the punched track as it is (it undid the Lead's punch-in while the singer was on the Double).
// rc.16 (Philip, 2026-11-06, a first take is its own undo step): ↶ now removes the Double's first take, the last thing
// done, and the Lead keeps its punch-in; ↷ brings the Double back. In rc.15 a first take was not a step and ↶ went to
// the project (which is how a typed tempo came undone).
export async function cp12UndoAfterOtherTake() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(40, [30, 32]), 'undo-beat.wav')); if (!go.ok) return { pass: false, ...go };
  await cpSetTempo(140); S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(20, 1234)], { type: 'audio/wav' }), 0); await settle(300);
  await S().recordFromBlob(new Blob([cpTone(3, 600)], { type: 'audio/wav' }), -6); await settle(300);            // a punch-in from 6 s
  const punched = { clips: cpTrackClips('vocals'), s7: cpTrackAt('vocals', 7) };
  S().voxSelect('double'); await S().recordFromBlob(new Blob([cpTone(4, 900)], { type: 'audio/wav' }), 0); await settle(300);   // the Double's first take
  $('undoX').click(); await settle(400);
  const after = { clips: cpTrackClips('vocals'), s7: cpTrackAt('vocals', 7), double: !!S().voxBuffer('double') && cpTrackClips('double') === 1 };
  $('redoX').click(); await settle(400);
  const redone = { clips: cpTrackClips('vocals'), double: !!S().voxBuffer('double') && cpTrackClips('double') === 1 };
  const pass = punched.clips === 3 && !!punched.s7 && punched.s7[600] > 0.1 && after.clips === 3 && !!after.s7 && after.s7[600] > 0.1 && !after.double
    && redone.clips === 3 && redone.double;
  return { pass, punched, after, redone };
}
const cpTrackClips = id => { S().voxSelect(id); return S().takeClips().length; };
// 13. A punch-in joins the take it replaces without a click: across each punch point the old take fades out as the new
// one fades in (Pro Tools crossfades punch points too), so a voice sounding through the join is not cut mid-wave. Both
// joins are made to land mid-wave; the largest sample-to-sample step at each is compared with the steady voice's own.
export async function cp13PunchNoClick() {
  await settle(300); const go = await cpSingOver(cpFile(cpBeat(30, [2, 16]), 'join-beat.wav')); if (!go.ok) return { pass: false, ...go };
  S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(20, 1234)], { type: 'audio/wav' }), 0); await settle(300);
  await S().recordFromBlob(new Blob([cpTone(3.013, 600)], { type: 'audio/wav' }), -6.1); await settle(300);   // 6.1 to 9.113 s
  const buf = await S().renderExport(), sr = buf.sampleRate, d = buf.getChannelData(0);
  const step = (a, b) => { let m = 0; for (let i = Math.max(1, Math.floor(a * sr)); i < Math.floor(b * sr); i++) m = Math.max(m, Math.abs(d[i] - d[i - 1])); return m; };
  const steady = Math.max(step(4, 5.5), step(7, 8.5));   // the old take's own steps, and the punch's
  const atIn = step(6.1 - 0.08, 6.1 + 0.03), atOut = step(9.113 - 0.08, 9.113 + 0.03);   // the export places takes up to ~30 ms early (LAT, Sync)
  const r = x => +(x / steady).toFixed(2), joins = { in: r(atIn), out: r(atOut) };
  // ...and the level does not jump across a join (both takes at full level at once): the loudest 2 ms there against the
  // steady voice's loudest 2 ms.
  const lvl = (a, b) => { let m = 0; for (let t = a; t < b; t += 0.002) { let s = 0, n = 0; for (let i = Math.floor(t * sr); i < Math.floor((t + 0.002) * sr); i++) { s += d[i] * d[i]; n++; } m = Math.max(m, Math.sqrt(s / n)); } return m; };
  const lv = Math.max(lvl(4, 5.5), lvl(7, 8.5)), level = { in: +(lvl(6.1 - 0.08, 6.1 + 0.03) / lv).toFixed(2), out: +(lvl(9.113 - 0.08, 9.113 + 0.03) / lv).toFixed(2) };
  return { pass: steady > 0.01 && joins.in < 1.6 && joins.out < 1.6 && level.in < 1.2 && level.out < 1.2 && cpTrackClips('vocals') === 3, joins, level, steady: +steady.toFixed(4) };
}
// The whole loop as Philip does it, on one screen size, measured on the file: Sing over my beat from the menu, the beat's tempo
// typed, a Lead take from bar 1, a punch-in at bar 9, ↶ and ↷ on it, a Double from bar 1 sung against the Lead, a vocal file
// onto Harmony at bar 5, ▶, Export. Every console error and warning in the page is counted from the first step.
export async function cpWalk() {
  const errs = [], ce = console.error, cw = console.warn; console.error = (...a) => { errs.push('error: ' + a.map(String).join(' ').slice(0, 160)); ce.apply(console, a); };
  console.warn = (...a) => { errs.push('warn: ' + a.map(String).join(' ').slice(0, 160)); cw.apply(console, a); }; const onErr = e => errs.push('uncaught: ' + String(e.message || e.reason || e).slice(0, 160));
  window.addEventListener('error', onErr); window.addEventListener('unhandledrejection', onErr);
  try {
    await settle(300); const phone = innerWidth < 481, at = {};
    if (phone) { $('mMore').click(); await settle(400); } else { ($('projMenuBtn') || $('projX')).click(); await settle(300); }
    const item = [...document.querySelectorAll(phone ? '.msrow' : '#projmenu .projmi')].find(b => /sing over my beat/i.test(b.textContent));
    if (!item) return { pass: false, why: 'no Sing over my beat in the menu' };
    const fi = $('beatFile'); let picks = 0; fi.click = () => { picks++; }; item.click(); await settle(300); delete fi.click;
    cpGive(fi, cpFile(cpBeat(40, [30, 32]), 'walk-beat.wav')); await cpWait(() => S().hasSample() && !S().sampleMuted() && !!JSON.parse(S().snapshot()).beat, 10000); await settle(400);
    at.tempo = await cpSetTempo(140);
    const mic = async (hz, secs, track, bar) => { S().voxSelect(track); cpRulerClick(bar); await settle(250); const back = cpFakeMic(hz); let heard;
      try { await cpRec(secs); heard = S().takeLive().tracks.slice(); await cpRecStop(track); } finally { back(); } return heard; };
    await mic(600, 3, 'vocals', 1); at.punchHeard = await mic(700, 2.5, 'vocals', 9);
    // ↶ and ↷ on the punch-in while it is the last thing done (a first take on another track hands ↶ back: cp12)
    // ↷ is judged on the track itself (its clips exactly as before ↶) and on the file (back to within 1% of what ↶ moved).
    // Not on the file alone to 1e-6: WebKit renders the very same project two ways (a take that plays to its buffer's end
    // stops one render quantum apart, 4e-4 on this fingerprint), which failed this once in the full run of 2026-11-05.
    const lat = () => { const c = window.__auraVocal && window.__auraVocal.audioContext && window.__auraVocal.audioContext(); return c ? +(((c.outputLatency || 0) + (c.baseLatency || 0)) * 1000).toFixed(2) : null; };
    const clipsNow = () => { S().voxSelect('vocals'); return JSON.stringify(S().takeClips()); };
    const T = () => ($('toast') || {}).textContent, c1 = clipsNow(), l1 = lat(), e1 = n15Fp(await S().renderExport()); $('undoX').click(); const tu = T(); await settle(400);
    const redoOn = !$('redoX').disabled, c0 = clipsNow(), l0 = lat(), e0 = n15Fp(await S().renderExport()); $('redoX').click(); const tr = T(); await settle(400);
    const c2 = clipsNow(), l2 = lat(), e2 = n15Fp(await S().renderExport());
    at.undoRedo = { undoChanged: c0 !== c1 && Math.abs(e0 - e1) / e1 > 1e-4, redoBack: c2 === c1 && Math.abs(e2 - e1) <= 0.01 * Math.abs(e1 - e0),
      fp: [e1, e0, e2].map(x => +x.toFixed(6)), latMs: [l1, l0, l2], toasts: [tu, tr], redoOn };
    at.doubleHeard = await mic(900, 2, 'double', 1);
    S().voxSelect('harmony'); cpRulerClick(5); await settle(250); const pm = phone ? $('mMore') : ($('projMenuBtn') || $('projX')); pm.click(); await settle(350);
    const imp = [...document.querySelectorAll(phone ? '.msrow' : '#projmenu .projmi')].find(b => /import a vocal/i.test(b.textContent)); const tf = $('takeFile');
    if (imp) { tf.click = () => {}; imp.click(); await settle(250); delete tf.click; } cpGive(tf, cpFile(cpTone(3, 1500), 'harmony.wav')); await cpWait(() => !!S().voxBuffer('harmony'), 8000); await settle(400);
    cpRulerClick(1); await settle(200); $('stopX').click(); await settle(200); $('play').click(); await settle(900); at.playing = S().takeLive().tracks.slice().sort().join(); $('stopX').click(); await settle(300);
    const ex = [...document.querySelectorAll('button')].find(b => /^Export( WAV)?$/.test(b.textContent.trim()) && shown(b)); if (ex) { ex.click(); await settle(1500); }
    const buf = await S().renderExport(), g = (t, hz) => { const sr = buf.sampleRate, d = buf.getChannelData(0), p0 = Math.floor(t * sr), n = Math.floor(0.3 * sr), k = 2 * Math.cos(2 * Math.PI * hz / sr); let a = 0, b2 = 0;
      for (let i = p0; i < p0 + n; i++) { const x = d[i] + k * a - b2; b2 = a; a = x; } return +(Math.sqrt(Math.max(0, a * a + b2 * b2 - k * a * b2)) / (n / 2)).toFixed(4); };
    const barS = 240 / 140, file = { secs: +buf.duration.toFixed(2), lead1: g(1.2, 600), double1: g(1.2, 900), punch: g(8 * barS + 1, 700), leadGoneAtPunch: g(8 * barS + 1, 600), harmony: g(4 * barS + 1, 1500), gapDb: cpDb(buf, 30.3, 31.7), endDb: cpDb(buf, 36, 39) };
    const pass = picks === 1 && at.tempo && at.punchHeard.join() === '' && at.doubleHeard.join() === 'vocals' && at.playing === 'double,harmony,vocals' && at.undoRedo.undoChanged && at.undoRedo.redoBack
      && Math.abs(file.secs - 40) <= 0.05 && file.lead1 > 0.02 && file.double1 > 0.02 && file.punch > 0.02 && file.leadGoneAtPunch < 0.005 && file.harmony > 0.02 && file.gapDb < -70 && file.endDb > -40 && errs.length === 0;
    return { pass, W: innerWidth, picks, at, file, errors: errs.slice(0, 8) };
  } finally { console.error = ce; console.warn = cw; window.removeEventListener('error', onErr); window.removeEventListener('unhandledrejection', onErr); }
}

// ======================================================================================================================
// rc.16 — the core loop, polished (Philip, 2026-11-06: "fix these before that publish, and treat them as blockers").
// Plan: docs/superpowers/plans/2026-11-06-core-loop-rc16.md
// ======================================================================================================================
const clOnScreen = el => { if (!el) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0) || r.right > innerWidth + 0.5 || r.left < -0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) return false;
  const h = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return !!h && (h === el || el.contains(h)); };
// 1. The header carries the release id, so a look at the screen (or a live check) can match the build: "rc.16" for
// 13.9.0-rc.16, the same number the page loaded its scripts with, visible at every width.
export async function cl1ReleaseId() {
  await settle(400);
  const s = [...document.scripts].map(x => x.src).find(u => /\/app\.js\?v=/.test(u)) || '', v = (s.match(/\?v=([^&]+)/) || [])[1] || '';
  const want = (v.match(/rc\.\d+/) || [])[0] || null, el = document.querySelector('.xport .relid');
  const text = el ? el.textContent.trim() : null, clipped = el ? el.scrollWidth > el.clientWidth + 1 : null;
  return { pass: !!want && text === want && clOnScreen(el) && !clipped && document.documentElement.scrollWidth <= innerWidth, W: innerWidth, want, text, onScreen: clOnScreen(el), clipped };
}
// 2. The tempo you type is the tempo it reads: 140 typed over a beat Aura reads otherwise is the row's selected value;
// ↶ pressed after a first take clears that take (its own undo step) and leaves 140 (it used to undo the tempo); ↷
// brings the take back; a reload keeps 140.
const clTempoActive = () => { const row = $('beatTempo'); if (!row || row.hidden) return null;
  return [...row.querySelectorAll('.on,[aria-pressed="true"]')].map(e => (e.value || e.textContent || '').replace(/\s+/g, ' ').trim()); };
export async function cl2TempoTypedSetup() {
  // a beat Aura reads at 130, with 140 typed over it (since rc.16 Aura reads cpBeat's 140 pattern right, so it would not do)
  await settle(300); const go = await cpSingOver(cpFile(clTrap(130), 'my-beat.wav')); if (!go.ok) return { pass: false, ...go };
  const detected = JSON.parse(S().snapshot()).bpm, typed = await cpSetTempo(140); await settle(300);
  const active = clTempoActive();
  S().voxSelect('vocals'); await S().recordFromBlob(new Blob([cpTone(3, 600)], { type: 'audio/wav' }), 0); await settle(400);
  const taken = !!S().voxBuffer('vocals') && S().takeClips().length === 1;
  $('undoX').click(); await settle(400); S().voxSelect('vocals');
  const undone = { bpm: JSON.parse(S().snapshot()).bpm, take: !!S().voxBuffer('vocals') && S().takeClips().length > 0 };
  $('redoX').click(); await settle(400); S().voxSelect('vocals');
  const redone = { bpm: JSON.parse(S().snapshot()).bpm, take: !!S().voxBuffer('vocals') && S().takeClips().length === 1 };
  // ...and ↶ walks back in the order things were done: a clip edit after the take first, then the take, never the tempo
  const bpm = () => JSON.parse(S().snapshot()).bpm;
  S().voxSelect('vocals'); const split = !!S().takeSplit(1.5); await settle(200); const edited = S().takeClips().length;
  $('undoX').click(); await settle(400); S().voxSelect('vocals'); const editUndone = { clips: S().takeClips().length, take: !!S().voxBuffer('vocals'), bpm: bpm() };
  $('undoX').click(); await settle(400); S().voxSelect('vocals'); const takeUndone = { take: !!S().voxBuffer('vocals') && S().takeClips().length > 0, bpm: bpm() };
  await S().voxSaved();
  const pass = detected !== 140 && typed && !!active && active.length === 1 && /\b140\b/.test(active[0]) && taken && undone.bpm === 140 && !undone.take && redone.bpm === 140 && redone.take
    && split && edited === 2 && editUndone.clips === 1 && editUndone.take && editUndone.bpm === 140 && !takeUndone.take && takeUndone.bpm === 140;
  return { pass, detected, typed, active, taken, undone, redone, edited, editUndone, takeUndone };
}
export async function cl2TempoTypedCheck() { await settle(400); await S().voxReady(); return { pass: JSON.parse(S().snapshot()).bpm === 140, bpm: JSON.parse(S().snapshot()).bpm }; }
// 3. A tempo in the beat's file name is the tempo (FL exports are often named with it): "dark trap 150bpm.wav" comes in
// at 150 though what Aura hears in it is 140 (the name wins); a number that is not marked as a tempo ("vocal take 120") is not taken for one.
export async function cl3TempoFromName() {
  await settle(300); const out = {};
  for (const [name, want] of [['dark trap 150bpm.wav', 150], ['vocal take 120.wav', null]]) {
    const go = await cpSingOver(cpFile(cpBeat(20, [8, 12]), name)); if (!go.ok) return { pass: false, name, ...go };
    out[name] = { bpm: JSON.parse(S().snapshot()).bpm, active: clTempoActive() }; await settle(200); }
  const a = out['dark trap 150bpm.wav'], b = out['vocal take 120.wav'];
  return { pass: a.bpm === 150 && !!a.active && a.active.length === 1 && /\b150\b/.test(a.active[0]) && b.bpm !== 120 && b.bpm >= 60, ...out };
}
// 4. With no tempo in the name, a trap beat comes in at its own tempo, not half of it or a few BPM off (FL's 140 came in
// as 134, a 140 pattern as 71): generated beats at 130, 140 and 150 (an 808 every two beats, a half-time clap, 16th hats
// with a roll) come in within half a BPM.
const clTrap = (bpm, secs = 24) => { const b = 60 / bpm; let sd = 5; const nz = () => (sd = (sd * 16807) % 2147483647) / 2147483647 * 2 - 1;
  return cpWav(secs, t => { const beat = Math.floor(t / b), tb = t - beat * b, inBar = beat % 4, s16 = b / 4, t16 = t % s16, i16 = Math.floor(t / s16) % 16;
    const nb = t % (2 * b), s808 = 0.45 * Math.sin(2 * Math.PI * 46 * nb) * Math.exp(-nb * 1.4);
    const kick = (inBar === 0 || (inBar === 2 && beat % 8 === 6)) ? 0.5 * Math.sin(2 * Math.PI * 55 * tb * (1 + 2 * Math.exp(-tb * 30))) * Math.exp(-tb * 12) : 0;
    const clap = inBar === 2 ? 0.32 * nz() * Math.exp(-tb * 26) : 0;
    const roll = (beat % 8 === 7 && i16 >= 12), th = roll ? t % (s16 / 2) : t16, hat = (roll ? 0.09 : (i16 % 2 ? 0.07 : 0.11)) * nz() * Math.exp(-th * 95);
    return Math.max(-0.98, Math.min(0.98, s808 + kick + clap + hat)); }); };
export async function cl4TempoSuggest() {
  await settle(300); const out = {};
  for (const want of [130, 140, 150]) { const go = await cpSingOver(cpFile(clTrap(want), 'trap-' + 'abc'[[130, 140, 150].indexOf(want)] + '.wav')); if (!go.ok) return { pass: false, want, ...go };
    out[want] = JSON.parse(S().snapshot()).bpm; await settle(200); }
  return { pass: Object.entries(out).every(([w, got]) => Math.abs(got - +w) <= 0.5), got: out };
}
// 5. Aura's guidance reads to its last word: the line under "Aura guidance" (and the note beside it) wraps instead of
// stopping at two lines ("… Open the keys. Your voic…"), in the column, the drawer and the phone's Aura tab.
export async function cl5AskWraps() {
  await settle(300); const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await settle(600);
  if (innerWidth < 481) { const t = document.querySelector('#phoneTabs [data-p="aura"]'); if (t) { t.click(); await settle(450); } } else await openPanel();
  // the longest note Aura writes there (84 characters) takes three lines in the 1440 column: it must not stop at two
  const pres = document.querySelector('#drGuideBlock .presencetxt'); if (pres && shown(pres)) pres.textContent = 'Add as a new version may be safer than Replace — you already have drums written.';
  const texts = [$('drGuide'), ...document.querySelectorAll('#drGuideBlock .presencetxt')].filter(e => e && shown(e));
  const rows = texts.map(e => ({ id: e.id || e.className, text: e.textContent.trim().slice(0, 90), whole: e.scrollHeight <= e.clientHeight + 1, clamp: getComputedStyle(e).webkitLineClamp || 'none' }));
  const long = ($('drGuide') || {}).textContent || '';
  return { pass: rows.length > 0 && rows.every(r => r.whole) && long.length > 60, W: innerWidth, rows };
}
// 6. Song tools breathe and One-step undo reads when it is off: Architect, Transitions and Finish have 8 px between them
// and room around each label (Transitions touched its edges), and the disabled One-step undo has 4.5:1 contrast with
// the panel behind it (it was a 40% ghost).
const clRgb = s => (s.match(/[\d.]+/g) || []).map(Number);
const clLum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const clContrast = el => { let bg = null, op = 1; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); op *= +cs.opacity; const c = clRgb(cs.backgroundColor); if (!bg && c.length >= 3 && (c[3] === undefined || c[3] > 0.95)) bg = c.slice(0, 3); }
  bg = bg || [7, 7, 11]; const fg = clRgb(getComputedStyle(el).color), a = (fg[3] === undefined ? 1 : fg[3]) * op, eff = [0, 1, 2].map(i => bg[i] + (fg[i] - bg[i]) * a);
  const L1 = clLum(eff), L2 = clLum(bg); return +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2); };
const clTextW = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().width; };
export async function cl6SongTools() {
  await settle(300); const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await settle(500); await openPanel();
  const bs = ['drArchitect', 'drTransitions', 'drFinish'].map($), R = bs.map(e => e.getBoundingClientRect());
  const gaps = [R[1].left - R[0].right, R[2].left - R[1].right].map(x => +x.toFixed(1)), room = bs.map(e => +((e.clientWidth - clTextW(e)) / 2).toFixed(1));
  const undo = $('drUndo'), off = !!undo && undo.disabled, contrast = undo ? clContrast(undo) : 0;
  return { pass: gaps.every(g => g >= 8) && room.every(r => r >= 6) && bs.every(e => e.scrollWidth <= e.clientWidth) && off && contrast >= 4.5, W: innerWidth, gaps, room, undoDisabled: off, undoContrast: contrast };
}
