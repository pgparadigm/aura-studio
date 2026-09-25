// Aura dashboard sub-project E checks (the mixer). TEST-ONLY; the app never loads this file.
// Driven by qa/run.cjs in Chromium and WebKit, each job on a FRESH load. Every check returns
// {pass, ...evidence}; the evidence is what decided it.
import { settle, skipWelcome } from './dashboard-a.qa.js';
const $ = id => document.getElementById(id);
const S = () => window.__auraSuite;
const M = () => window.__auraMix || {};
const snap = () => JSON.parse(S().snapshot());
const G = { kick: 0, snare: 1, hats: 2, bass: 3, chords: 4, melody: 5, vocals: 6, sample: 7 };
const R = { vol: 0, pan: 1, mute: 2, solo: 3, lo: 4, mid: 5, hi: 6, rev: 7, dly: 8 };
const MINUS = '−';
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
const near = (a, b, tol) => Math.abs(a - b) <= tol;
// The visible control for group g and key k (a strip control, or the detail row's for the selected channel).
// In the compact mixer a channel's pan, EQ and sends live in the detail row, so when that control is not
// on screen the channel is selected first (what clicking its strip does) and the visible one is used.
export function ctl(g, k) {
  const vis = () => [...document.querySelectorAll(`.ctl[data-g="${g}"][data-k="${k}"]`)].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  let c = vis();
  if (!c && M().selectChannel && g[0] !== '_') { M().selectChannel(g); c = vis(); }
  return c || document.querySelector(`.ctl[data-g="${g}"][data-k="${k}"]`);
}
const valText = c => (c && c.__ctl && c.__ctl.valEl) ? txt(c.__ctl.valEl) : '';
const setCtl = async (c, v) => { c.__ctl.set(v, true); await settle(120); };
const pe = (type, x, y, o = {}) => new PointerEvent(type, Object.assign({ bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 21, isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }, o));
const center = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
async function openMixer() { await skipWelcome(); await settle(300); const t = document.querySelector('#studioETabs .etab[data-ed="mix"]'); if (t && !t.classList.contains('on')) { t.click(); await settle(300); } }
const fmt = db => M().fmtDb ? M().fmtDb(db) : null;

// ---------------------------------------------------------------------------------------------
// E1: levels read in dB, from the value the audio actually uses.
export async function e1DbLabels() {
  await openMixer();
  const c = ctl('vocals', 'vol'); if (!c || !c.__ctl) return { pass: false, why: 'no dB fader control for Vocals' };
  const want = [[0, `${MINUS}∞ dB`], [50, `${MINUS}6.0 dB`], [100, '0.0 dB'], [140, '+2.9 dB'], [M().VOL_MAX, '+6.0 dB']];
  const got = [];
  for (const [v, w] of want) { await setCtl(c, v); got.push({ vol: v, label: valText(c), aria: c.getAttribute('aria-valuetext'), want: w }); }
  const volOk = got.every(g => g.label === g.want && g.aria === g.want);
  // EQ and sends: the label must equal the gain the live graph is actually using.
  M().ensureAudio();
  const lo = ctl('chords', 'lo'), rev = ctl('chords', 'rev'), dly = ctl('chords', 'dly');
  if (!lo || !rev || !dly) return { pass: false, why: 'no EQ/send controls', got };
  await setCtl(lo, 3.5); await setCtl(rev, 50); await setCtl(dly, 25); await settle(250);
  const n = M().node('chords');
  const eq = { label: valText(lo), want: '+3.5 dB', node: n.lo };
  const rs = { label: valText(rev), want: fmt(20 * Math.log10(n.rs)), node: n.rs };
  const ds = { label: valText(dly), want: fmt(20 * Math.log10(n.ds)), node: n.ds };
  await setCtl(dly, 0); const ds0 = { label: valText(dly), want: `${MINUS}∞ dB` };
  const sendsOk = eq.label === eq.want && near(n.lo, 3.5, 1e-6) && rs.label === rs.want && ds.label === ds.want && ds0.label === ds0.want;
  return { pass: volOk && sendsOk, volume: got, eq, reverbSend: rs, delaySend: ds, delayAtZero: ds0 };
}

// E1: the fader law. 0 dB sits at 78 % of travel, +6 at the top, -inf at the bottom, and the two
// directions agree everywhere in between.
export async function e1Law() {
  const m = M(); if (!m.faderPos) return { pass: false, why: 'no fader law exposed' };
  const pts = [-70, -55, -40, -30, -20, -10, -3, 0, 2.9, 6];
  const trip = pts.map(db => ({ db, pos: +m.faderPos(db).toFixed(4), back: +m.faderDb(m.faderPos(db)).toFixed(4) }));
  const ok = trip.every(t => near(t.back, t.db, 1e-6)) && near(m.faderPos(0), 0.78, 1e-9) && near(m.faderPos(6), 1, 1e-9)
    && m.faderPos(-Infinity) === 0 && m.faderDb(0) === -Infinity && near(m.volToDb(50), -6.0206, 1e-3) && near(m.dbToVol(-6), 50.1187, 1e-3)
    && trip.every((t, i) => i === 0 || t.pos > trip[i - 1].pos);
  return { pass: ok, trip, zeroAt: m.faderPos(0) };
}

// E1: click the value, type an exact number.
export async function e1TypeIn() {
  await openMixer();
  const c = ctl('vocals', 'vol'); if (!c || !c.__ctl) return { pass: false, why: 'no control' };
  const type = async (s, key = 'Enter') => { c.__ctl.valEl.click(); await settle(80);
    const inp = c.parentElement.querySelector('input.ctl-edit') || document.querySelector('input.ctl-edit'); if (!inp) return null;
    inp.value = s; inp.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); await settle(150); return snap().mx[G.vocals][R.vol]; };
  const r = {};
  r.minus35 = await type('-3.5'); r.label35 = valText(c);
  r.inf = await type(`${MINUS}∞`); r.labelInf = valText(c);
  r.over = await type('+9 dB'); r.labelOver = valText(c);
  r.zero = await type('0'); r.labelZero = valText(c);
  r.junk = await type('loud'); r.escape = await type('-20', 'Escape');
  const pass = r.minus35 === 66.83 && r.label35 === `${MINUS}3.5 dB` && r.inf === 0 && r.labelInf === `${MINUS}∞ dB`
    && r.over === M().VOL_MAX && r.labelOver === '+6.0 dB' && r.zero === 100 && r.labelZero === '0.0 dB' && r.junk === 100 && r.escape === 100;
  return { pass, ...r };
}

// E1: double-click resets to the default; the reset is one undo entry.
export async function e1Reset() {
  await openMixer();
  const c = ctl('bass', 'vol'); if (!c || !c.__ctl) return { pass: false, why: 'no control' };
  await setCtl(c, 40); const d0 = S().undoDepth();
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); await settle(200);
  const v = snap().mx[G.bass][R.vol];
  return { pass: v === 100 && valText(c) === '0.0 dB' && S().undoDepth() - d0 === 1, vol: v, label: valText(c), undoEntries: S().undoDepth() - d0 };
}

// E1: drag is relative (no jump on press), and Shift makes it ten times finer.
export async function e1Fine() {
  await openMixer();
  const c = ctl('melody', 'vol'); if (!c || !c.__ctl) return { pass: false, why: 'no control' };
  // 15 % of the track's own length, so the coarse drag cannot hit the top on a short fader.
  const len = (c.querySelector('.ctl-track') || c).getBoundingClientRect().height, dist = -Math.round(len * 0.15);
  const drag = async (dy, shift) => { dy = dist; await setCtl(c, 100); const th = c.querySelector('.ctl-thumb') || c; const [x, y] = center(th);
    th.dispatchEvent(pe('pointerdown', x, y, { shiftKey: shift })); await settle(20);
    const pressed = M().mixOf('melody').vol;
    window.dispatchEvent(pe('pointermove', x, y + dy, { shiftKey: shift })); window.dispatchEvent(pe('pointerup', x, y + dy, { shiftKey: shift })); await settle(150);
    return { pressed, after: M().mixOf('melody').vol }; };
  const coarse = await drag(-20, false), fine = await drag(-20, true);
  const pc = M().faderPos(M().volToDb(coarse.after)) - 0.78, pf = M().faderPos(M().volToDb(fine.after)) - 0.78;
  return { pass: coarse.pressed === 100 && fine.pressed === 100 && pc > 0 && pf > 0 && near(pc / pf, 10, 0.6), coarse, fine, posMovedCoarse: +pc.toFixed(4), posMovedFine: +pf.toFixed(4) };
}

// E1: the mouse wheel moves 0.5 dB a notch (0.1 dB with Shift); a burst of notches is one undo entry.
export async function e1Wheel() {
  await openMixer();
  const c = ctl('chords', 'vol'); if (!c || !c.__ctl) return { pass: false, why: 'no control' };
  await setCtl(c, 100); await settle(600); const d0 = S().undoDepth();
  const wheel = (dy, shift) => c.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, shiftKey: shift, bubbles: true, cancelable: true }));
  wheel(-100); wheel(-100); wheel(-100); await settle(60);
  const three = M().volToDb(M().mixOf('chords').vol);
  wheel(100, true); await settle(900);
  const fineStep = M().volToDb(M().mixOf('chords').vol);
  const entries = S().undoDepth() - d0;
  return { pass: near(three, 1.5, 0.02) && near(fineStep, 1.4, 0.02) && entries === 1, afterThreeNotchesDb: +three.toFixed(3), afterFineNotchDownDb: +fineStep.toFixed(3), undoEntries: entries };
}

// E1: every mixer move undoes and redoes, and so does the SOUND: after Undo the live audio node is
// back where the value is, not only the number on screen.
export async function e1Undo() {
  await openMixer(); M().ensureAudio(); await settle(400);
  const undo = async () => { $('undoX').click(); await settle(400); }, redo = async () => { $('redoX').click(); await settle(400); };
  const node = (id, k) => { const n = M().node(id); return n ? n[k] : NaN; };
  const cases = [
    ['Vocals level', 'vocals', 'vol', 50, () => node('vocals', 'gain'), v => v / 100 * Math.SQRT2],
    ['Chords pan', 'chords', 'pan', -60, () => node('chords', 'pan'), v => v / 100],
    ['Bass low EQ', 'bass', 'lo', 4.5, () => node('bass', 'lo'), v => v],
    ['Melody reverb send', 'melody', 'rev', 40, () => node('melody', 'rs'), v => M().sendGainFor('melody', 'rev', v)],
    ['Snare delay send', 'snare', 'dly', 30, () => node('snare', 'ds'), v => M().sendGainFor('snare', 'dly', v)],
    ['Master level', '__master', 'vol', 120, () => M().masterGain(), v => v / 100],
  ];
  const out = [];
  for (const [name, g, k, v1, live, want] of cases) {
    const c = ctl(g, k); if (!c || !c.__ctl) { out.push({ name, pass: false, why: 'no control' }); continue; }
    const v0 = c.__ctl.get(), d0 = S().undoDepth();
    await setCtl(c, v1); await settle(300);
    const r = { name, v0, v1, entries: S().undoDepth() - d0, liveAfterMove: +live().toFixed(4) };
    await undo(); r.afterUndo = c.__ctl.get(); r.liveAfterUndo = +live().toFixed(4);
    await redo(); r.afterRedo = c.__ctl.get(); r.liveAfterRedo = +live().toFixed(4);
    r.pass = r.entries === 1 && near(r.liveAfterMove, want(v1), 1e-3) && r.afterUndo === v0 && near(r.liveAfterUndo, want(v0), 1e-3)
      && r.afterRedo === v1 && near(r.liveAfterRedo, want(v1), 1e-3);
    out.push(r);
  }
  // Mute, then an exclusive solo: each one entry; undo brings every channel's live gain back.
  const gains = () => Object.keys(G).map(id => +node(id, 'gain').toFixed(4));
  const g0 = gains(), mb = document.querySelector('.strip[data-g="kick"] .mb'), sb = document.querySelector('.strip[data-g="bass"] .sb');
  const d1 = S().undoDepth(); mb.click(); await settle(300); const gMute = gains(), eMute = S().undoDepth() - d1;
  sb.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: true })); await settle(300); const gSolo = gains(), soloed = Object.keys(G).filter(id => M().mixOf(id).solo);
  await undo(); const gUndoSolo = gains(); await undo(); const gUndoMute = gains(); await redo(); await redo(); const gRedo = gains();
  const ms = { muteEntries: eMute, kickMutedLive: gMute[0] === 0, soloed, onlyBassAudible: gSolo.every((v, i) => i === G.bass ? v > 0 : v === 0),
    undoSoloRestores: JSON.stringify(gUndoSolo) === JSON.stringify(gMute), undoMuteRestores: JSON.stringify(gUndoMute) === JSON.stringify(g0),
    redoBoth: JSON.stringify(gRedo) === JSON.stringify(gSolo) };
  ms.pass = eMute === 1 && ms.kickMutedLive && soloed.join() === 'bass' && ms.onlyBassAudible && ms.undoSoloRestores && ms.undoMuteRestores && ms.redoBoth;
  out.push(Object.assign({ name: 'Mute, exclusive solo' }, ms));
  // Mix effects: Echo time and Repeats are live nodes too.
  const fxSet = (id, v) => { const e = $(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
  const f0 = M().fxLive(); fxSet('fxDlyTime', 520); fxSet('fxDlyFb', 60); await settle(900);
  const f1 = M().fxLive(); await undo(); const fU = M().fxLive(); await redo(); const fR = M().fxLive();
  const fxr = { before: f0, moved: f1, afterUndo: fU, afterRedo: fR };
  fxr.pass = near(f1.delayTime, 0.52, 1e-3) && near(f1.feedback, 0.6, 1e-3) && near(fU.delayTime, f0.delayTime, 1e-3) && near(fU.feedback, f0.feedback, 1e-3)
    && near(fR.delayTime, 0.52, 1e-3) && near(fR.feedback, 0.6, 1e-3);
  out.push(Object.assign({ name: 'Echo time and Repeats' }, fxr));
  return { pass: out.every(r => r.pass), cases: out };
}

// E1: a project saved before E opens exactly as it did (integer levels stay integers; the snapshot is
// byte-identical on the old build and this one; the key is compared across builds by the runner).
export async function e1Saved() {
  await skipWelcome(); await settle(300);
  const f = S().buildFile('QA E saved', true), P = f.project;
  const mx = [[100, 0, 0, 0, 0, 0, 0, 0, 0], [140, -30, 0, 0, 3, -2, 1, 20, 0], [67, 60, 0, 0, 0, 0, 0, 0, 15], [120, 0, 0, 0, 5, 0, 0, 0, 0],
              [90, -80, 1, 0, 0, 4, -6, 55, 30], [100, 80, 0, 1, 0, 0, 0, 40, 0], [0, 0, 0, 0, 0, 0, 12, 0, 0], [100, 0, 1, 0, 0, 0, 0, 0, 0]];
  if (Array.isArray(P.mixer)) P.mixer = mx; else if (P.channels) P.channels = mx; else if (P.mx) P.mx = mx;
  const r = S().openFile(JSON.parse(JSON.stringify(f)), 'QA E saved.aura'); await settle(300);
  const s = S().snapshot(), got = JSON.parse(s).mx;
  const buf = new TextEncoder().encode(s), h = await crypto.subtle.digest('SHA-256', buf);
  const key = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  return { pass: !!(r && r.ok) && JSON.stringify(got) === JSON.stringify(mx), opened: r, mx: got, key, fileKeys: Object.keys(P).slice(0, 40) };
}

// ---------------------------------------------------------------------------------------------
// E3: the Drums group is a linked control over Kick, Snare and Hats (no new bus).
const DR = ['kick', 'snare', 'hats'];
const volCtlOf = id => document.querySelector(`.strip[data-g="${id}"] .ctl[data-k="vol"]`);
export async function e3Group() {
  await openMixer();
  const g = ctl('__drums', 'vol'), gs = document.querySelector('.strip.grp[data-g="__drums"]');
  if (!g || !g.__ctl || !gs) return { pass: false, why: 'no Drums group strip' };
  const shownG = gs.getBoundingClientRect().width > 0;
  const hiddenMembers = DR.every(id => volCtlOf(id).getBoundingClientRect().width === 0);
  [['kick', 100], ['snare', 50], ['hats', 25]].forEach(([id, v]) => volCtlOf(id).__ctl.set(v, true)); await settle(200);
  const vols = () => DR.map(id => M().mixOf(id).vol), dbs = () => vols().map(v => M().volToDb(v));
  const d0 = S().undoDepth();
  g.__ctl.set(M().dbToVol(-6), true); await settle(200);
  const minus6 = dbs(), want6 = [0, -6.0206, -12.0412].map(x => x - 6), entries = S().undoDepth() - d0;
  const ok6 = minus6.every((d, i) => near(d, want6[i], 0.05)) && entries === 1 && valText(g) === `${MINUS}6.0 dB`;
  g.__ctl.set(M().VOL_MAX, true); await settle(150); const top = vols();
  g.__ctl.set(400, true); await settle(150); const pushed = vols();
  const okTop = top[0] === M().VOL_MAX && near(top[1] / top[0], 0.5, 0.002) && near(top[2] / top[0], 0.25, 0.002) && JSON.stringify(pushed) === JSON.stringify(top);
  g.__ctl.set(0, true); await settle(150); const silent = vols();
  g.__ctl.set(100, true); await settle(150); const back = vols();
  const okBottom = silent.every(v => v === 0) && JSON.stringify(back) === JSON.stringify([100, 50, 25]);
  const mb = gs.querySelector('.mb'); mb.click(); await settle(150); const muted = DR.map(id => M().mixOf(id).mute);
  mb.click(); await settle(150); const unmuted = DR.map(id => M().mixOf(id).mute);
  const x = gs.querySelector('.grp-x'); x.click(); await settle(200);
  const shownAfter = DR.every(id => volCtlOf(id).getBoundingClientRect().width > 0);
  x.click(); await settle(200);
  const mxLen = snap().mx.length;
  return { pass: shownG && hiddenMembers && ok6 && okTop && okBottom && muted.every(Boolean) && unmuted.every(v => !v) && shownAfter && mxLen === 8,
    shownG, hiddenMembers, minus6: minus6.map(d => +d.toFixed(3)), undoEntries: entries, groupLabel: valText(g), top, pushedPastTop: pushed, silent, back, muted, unmuted, expandShowsThree: shownAfter, mxLen };
}

// E3: selecting the Drums lane selects the group; a strip selects its lane; the detail row follows.
export async function e3Select() {
  await openMixer();
  const laneHd = id => document.querySelector(`.sa-lane[data-lane="${id}"] .sa-lane-hd`);
  const onLane = () => (document.querySelector('.sa-lane.on') || {}).dataset?.lane;
  const gs = document.querySelector('.strip.grp[data-g="__drums"]'); if (!gs) return { pass: false, why: 'no group strip' };
  laneHd('drums').click(); await settle(200);
  const a = { lane: onLane(), groupSel: gs.getAttribute('data-dash-sel') === '1', groupOutline: getComputedStyle(gs).outlineStyle, detail: M().detailChannel(), detailName: txt($('mixDetailName')) };
  document.querySelector('.strip[data-g="bass"]').click(); await settle(200);
  const b = { lane: onLane(), detail: M().detailChannel(), groupSel: gs.getAttribute('data-dash-sel') === '1' };
  gs.click(); await settle(200); const c = { lane: onLane(), detail: M().detailChannel() };
  gs.querySelector('.grp-x').click(); await settle(200);
  document.querySelector('.strip[data-g="snare"]').click(); await settle(200);
  const d = { lane: onLane(), detail: M().detailChannel(), detailName: txt($('mixDetailName')) };
  gs.querySelector('.grp-x').click(); await settle(150);
  return { pass: a.lane === 'drums' && a.groupSel && a.groupOutline !== 'none' && a.detail === 'kick' && b.lane === 'bass' && b.detail === 'bass' && !b.groupSel
    && c.lane === 'drums' && d.lane === 'drums' && d.detail === 'snare' && /Snare/.test(d.detailName), drumsLane: a, bassStrip: b, groupStrip: c, snareStrip: d };
}

// E2 (basics): solo, and exclusive solo on Alt/Cmd-click. Each click one undo entry; the live gains agree.
export async function e2Solo() {
  await openMixer(); M().ensureAudio(); await settle(300);
  const sb = id => document.querySelector(`.strip[data-g="${id}"] .sb`);
  const soloed = () => Object.keys(G).filter(id => M().mixOf(id).solo).join(',');
  const audible = () => Object.keys(G).filter(id => (M().node(id) || {}).gain > 0).join(',');
  const click = async (el, alt) => { const d = S().undoDepth(); el.dispatchEvent(new MouseEvent('click', { bubbles: true, altKey: !!alt })); await settle(250); return S().undoDepth() - d; };
  const steps = [];
  steps.push({ act: 'S bass', entries: await click(sb('bass')), soloed: soloed(), audible: audible() });
  steps.push({ act: 'S vocals', entries: await click(sb('vocals')), soloed: soloed(), audible: audible() });
  steps.push({ act: 'Alt-S chords', entries: await click(sb('chords'), true), soloed: soloed(), audible: audible() });
  steps.push({ act: 'Alt-S chords again', entries: await click(sb('chords'), true), soloed: soloed(), audible: audible() });
  steps.push({ act: 'Alt-S Drums group', entries: await click(document.querySelector('.strip.grp .sb'), true), soloed: soloed(), audible: audible() });
  const want = ['bass', 'bass,vocals', 'chords', '', 'kick,snare,hats'];
  const pass = steps.every((s, i) => s.entries === 1 && s.soloed === want[i] && (want[i] === '' ? s.audible.split(',').length >= 7 : s.audible === want[i]));
  return { pass, steps };
}

// E4: the detail row is the selected channel's pan, EQ and sends; its edits are the channel's.
export async function e4Detail() {
  await openMixer(); M().ensureAudio(); await settle(300);
  const row = $('mixDetail'); if (!row || !row.getBoundingClientRect().height) return { pass: false, why: 'no detail row' };
  M().selectChannel('chords'); await settle(200);
  const lo = row.querySelector('.ctl[data-k="lo"]'), rev = row.querySelector('.ctl[data-k="rev"]');
  const r1 = { rowFor: row.dataset.g, loFor: lo && lo.dataset.g };
  lo.__ctl.set(-4.5, true); rev.__ctl.set(30, true); await settle(300);
  r1.mixLo = M().mixOf('chords').lo; r1.nodeLo = M().node('chords').lo; r1.mixRev = M().mixOf('chords').rev;
  r1.stripLo = valText(document.querySelector('.strip[data-g="chords"] .ctl[data-k="lo"]'));
  M().selectChannel('melody'); await settle(200);
  const r2 = { rowFor: row.dataset.g, loLabel: valText(lo), loFor: lo.dataset.g };
  const pass = r1.rowFor === 'chords' && r1.loFor === 'chords' && r1.mixLo === -4.5 && near(r1.nodeLo, -4.5, 1e-6) && r1.mixRev === 30 && r1.stripLo === `${MINUS}4.5 dB`
    && r2.rowFor === 'melody' && r2.loFor === 'melody' && r2.loLabel === '0.0 dB';
  return { pass, chords: r1, melody: r2 };
}

// E4: every channel and the Master fit with no scrolling, collapsed and expanded, and each control is
// the thing under its own centre (elementFromPoint). The arrangement gets the height back.
const ARR_BEFORE = { 1024: 60, 1280: 184, 1440: 246 };
export async function e4Fits() {
  await openMixer(); await settle(300);
  const host = $('studioEdHost'), strips = $('strips'), mx = $('mixer');
  const hitOk = el => { if (!el) return false; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return false;
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === el || el.contains(h)); };
  const check = () => {
    const vis = [...mx.querySelectorAll('.strip')].filter(s => s.getBoundingClientRect().width > 0);
    const bad = [];
    vis.forEach(s => { const id = s.dataset.g;
      const parts = { thumb: s.querySelector('.fz .ctl .ctl-thumb'), value: s.querySelector(':scope > .ctl-val'), M: s.querySelector('.btns .mb'), S: s.querySelector('.btns .sb') };
      Object.entries(parts).forEach(([k, el]) => { if (id === '__master' && k === 'S') return; if (!hitOk(el)) bad.push(id + ':' + k); }); });
    [...$('mixDetail').querySelectorAll('.ctl .ctl-thumb, .ctl-val')].forEach(el => { if (!hitOk(el)) bad.push('detail:' + (el.dataset.k || el.parentElement.parentElement.dataset.k || 'thumb')); });
    return { strips: vis.map(s => s.dataset.g), bad, hostScroll: [host.scrollHeight, host.clientHeight], stripsScroll: [strips.scrollWidth, strips.clientWidth],
      noScroll: host.scrollHeight <= host.clientHeight + 1 && strips.scrollWidth <= strips.clientWidth + 1 };
  };
  const collapsed = check();
  document.querySelector('.strip.grp .grp-x').click(); await settle(250);
  const expanded = check();
  document.querySelector('.strip.grp .grp-x').click(); await settle(200);
  const arr = $('studioArr').getBoundingClientRect().height, before = ARR_BEFORE[innerWidth];
  const pass = collapsed.bad.length === 0 && expanded.bad.length === 0 && collapsed.noScroll && expanded.noScroll
    && collapsed.strips.includes('__master') && expanded.strips.length === collapsed.strips.length + 3 && (!before || arr > before);
  return { pass, W: innerWidth, collapsed, expanded, arrangementHeight: Math.round(arr), arrangementBefore: before };
}

// E4: the Master's M mutes the speakers only: not the project, not an undo entry.
export async function e4Listen() {
  await openMixer(); M().ensureAudio(); await settle(300);
  const lm = document.querySelector('.strip.master .btns .mb'); if (!lm) return { pass: false, why: 'no Master M' };
  const s0 = S().snapshot(), d0 = S().undoDepth();
  lm.click(); await settle(250); const on = { muted: M().listenMuted(), monitor: M().monitorGain(), pressed: lm.getAttribute('aria-pressed') };
  lm.click(); await settle(250); const off = { muted: M().listenMuted(), monitor: M().monitorGain() };
  return { pass: on.muted && near(on.monitor, 0, 1e-3) && on.pressed === 'true' && !off.muted && near(off.monitor, 1, 1e-3) && S().snapshot() === s0 && S().undoDepth() === d0,
    on, off, projectUnchanged: S().snapshot() === s0, undoEntries: S().undoDepth() - d0 };
}
