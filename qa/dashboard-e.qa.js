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

// ---------------------------------------------------------------------------------------------
// E2: meters, checked against signals whose level is known.
const SR = 44100;
function sineBuf(dbfs, hz, sec, sr = SR, ph = 0) { const b = new AudioBuffer({ length: Math.round(sr * sec), numberOfChannels: 1, sampleRate: sr }), d = b.getChannelData(0), a = Math.pow(10, dbfs / 20);
  for (let i = 0; i < d.length; i++) d[i] = a * Math.sin(2 * Math.PI * hz * i / sr + ph); return b; }
function squareBuf(amp, hz, sec, sr = SR) { const b = new AudioBuffer({ length: Math.round(sr * sec), numberOfChannels: 1, sampleRate: sr }), d = b.getChannelData(0), per = sr / hz;
  for (let i = 0; i < d.length; i++) d[i] = ((i % per) < per / 2) ? amp : -amp; return b; }
async function playFor(ms) { $('play').click(); await settle(ms); }
async function stopPlay() { if ($('play').classList.contains('on')) $('play').click(); await settle(200); }
async function withSample(buf) { await openMixer(); if (!M().meterCollect) return 'no live meter';
  const ok = await M().meterReady(); if (!ok) return 'the meter worklet did not start'; S().refInstall(buf, 0); await settle(250); return null; }

export async function e2Sine() {
  const why = await withSample(sineBuf(-6.0206, 1000, 3)); if (why) return { pass: false, why };
  await playFor(500); const c = await M().meterCollect(1200); await stopPlay();
  const s = c.sample; if (!s) return { pass: false, why: 'no reading for the Sample channel', c };
  const r = { pkDb: s.pkDb.map(v => +v.toFixed(2)), rmsDb: s.rmsDb.map(v => +v.toFixed(2)), messages: s.n };
  return { pass: s.pkDb.every(v => near(v, -6.02, 0.2)) && s.rmsDb.every(v => near(v, -9.03, 0.2)), ...r, want: { pk: -6.02, rms: -9.03 } };
}
// The meter reads each side, not the mono sum: hard left reads 3 dB above centre on the left, silence on the right.
export async function e2HardLeft() {
  const why = await withSample(sineBuf(-6.0206, 1000, 3)); if (why) return { pass: false, why };
  const pan = ctl('sample', 'pan'); pan.__ctl.set(-100, true); await settle(200);
  await playFor(500); const c = await M().meterCollect(1200); await stopPlay();
  const s = c.sample;
  return { pass: near(s.pkDb[0], -3.01, 0.2) && s.pkDb[1] < -80, pkDb: s.pkDb.map(v => +v.toFixed(2)), monoSumWouldRead: -9.03 };
}
// A 0 dBFS square lights the clip light; it stays lit after the signal stops, until it is clicked.
export async function e2Square() {
  const why = await withSample(squareBuf(1.0, 200, 3)); if (why) return { pass: false, why };
  const light = () => document.querySelector('.strip[data-g="sample"] .mtr2 .clip');
  const before = !!(light() && light().classList.contains('on'));
  await playFor(500); const c = await M().meterCollect(600); await settle(200);
  const whilePlaying = light().classList.contains('on'); await stopPlay(); await settle(2500);
  const afterStop = light().classList.contains('on'), rawAfter = (await M().meterCollect(400)).sample.pkDb;
  light().click(); await settle(200); const afterClick = light().classList.contains('on');
  return { pass: !before && c.sample.clip.some(Boolean) && whilePlaying && afterStop && rawAfter.every(v => v < -80) && !afterClick,
    before, flagged: c.sample.clip, whilePlaying, stillLitAfterStop: afterStop, signalAfterStop: rawAfter, clearedByClick: !afterClick, peakDb: c.sample.pkDb.map(v => +v.toFixed(3)) };
}
// After Stop the meters read -inf and the bars fall to the floor.
export async function e2Silence() {
  await openMixer(); if (!M().meterCollect) return { pass: false, why: 'no live meter' }; await M().meterReady();
  await playFor(1500); await stopPlay(); await settle(4000);
  const c = await M().meterCollect(500), ids = Object.keys(G).concat(['__master']);
  const raw = Object.fromEntries(ids.map(id => [id, c[id] ? c[id].pkDb : null]));
  const shown = ids.map(id => M().meterShown(id)).filter(Boolean);
  // Silence is below -140 dBFS (under the 24-bit floor): WebKit's limiter and reverb decay into denormals
  // (seen: -786 dBFS on the Master), which are silence, not an exact zero.
  return { pass: ids.every(id => raw[id] && raw[id].every(v => v < -140)) && shown.length === ids.length && shown.every(v => v.pos.every(p => p === 0)),
    raw: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v && v.map(String)])), shown };
}
// The bars are drawn on the dBFS scale: a -30 dBFS sine sits half way (the old RMS x 260 bar: 6 %).
export async function e2Scale() {
  const why = await withSample(sineBuf(-30, 1000, 3)); if (why) return { pass: false, why };
  await playFor(1500); const v = M().meterShown('sample'); await stopPlay();
  return { pass: !!v && v.pos.every(p => near(p, 0.5, 0.02)) && v.rmsPos.every(p => near(p, 0.45, 0.02)), shown: v, want: { peakPos: 0.5, rmsPos: 0.45 } };
}

// WAV files built to a definition, then DECODED by the browser: the same path a singer's file takes.
function wavBytes(chs, sr) { const n = chs[0].length, nc = chs.length, b = new ArrayBuffer(44 + n * nc * 2), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * nc * 2, true);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const x = Math.max(-1, Math.min(1, chs[c][i])); v.setInt16(o, Math.round(x < 0 ? x * 32768 : x * 32767), true); o += 2; }
  return b; }
function seq(parts, sr, hz = 1000) { const n = parts.reduce((a, p) => a + Math.round(p[1] * sr), 0), x = new Float32Array(n); let o = 0;
  for (const [db, sec] of parts) { const a = Math.pow(10, db / 20), m = Math.round(sec * sr); for (let i = 0; i < m; i++, o++) x[o] = a * Math.sin(2 * Math.PI * hz * o / sr); } return x; }
async function decodeWav(bytes, sr) { return new OfflineAudioContext(2, 1, sr).decodeAudioData(bytes); }
const EBU = [ // EBU Tech 3341 minimal cases: stereo 1 kHz sine, the level per channel, the expected integrated loudness
  ['3341 case 1', [[-23, 20]], -23], ['3341 case 2', [[-33, 20]], -33], ['3341 case 3', [[-36, 10], [-23, 60], [-36, 10]], -23],
  ['3341 case 4', [[-72, 10], [-36, 10], [-23, 60], [-36, 10], [-72, 10]], -23], ['3341 case 5', [[-26, 20], [-20, 20.1], [-26, 20]], -23]];
export async function e2Ebu() {
  await openMixer(); if (!M().dsp || !M().meterProbe) return { pass: false, why: 'no metering DSP exposed' };
  const sr = 48000, off = [];
  for (const [name, parts, want] of EBU) { const x = seq(parts, sr), buf = await decodeWav(wavBytes([x, x], sr), sr);
    const L = M().dsp.makeLoudness(sr, false); L.push(buf.getChannelData(0), buf.getChannelData(1)); const i = L.integrated();
    off.push({ name, want, I: +i.toFixed(3), ok: near(i, want, 0.1) }); }
  { const parts = []; for (let k = 0; k < 5; k++) parts.push([-20, 1.34], [-30, 1.66]); const x = seq(parts, sr), buf = await decodeWav(wavBytes([x, x], sr), sr);
    const L = M().dsp.makeLoudness(sr, false); L.push(buf.getChannelData(0), buf.getChannelData(1)); const S3 = [];
    for (let j = 30; j <= L.subs.length; j += 30) { let s = 0; for (let k = j - 30; k < j; k++) s += L.subs[k]; S3.push(-0.691 + 10 * Math.log10(s / 30)); }
    off.push({ name: '3341 short-term (1.34 s at -20 / 1.66 s at -30)', want: -23, S: S3.map(v => +v.toFixed(3)), ok: S3.length > 0 && S3.every(v => near(v, -23, 0.1)) }); }
  // Live: cases 1 and 2 as files, decoded at the live rate, played in real time through the meter worklet.
  const live = await Promise.all([EBU[0], EBU[1]].map(async ([name, parts, want]) => { const x = seq(parts, 48000);
    const buf = await decodeWav(wavBytes([x, x], 48000), M().liveRate()); const r = await M().meterProbe(buf);
    return { name, want, I: r.i == null ? null : +r.i.toFixed(3), S: r.s == null ? null : +r.s.toFixed(3), ok: r.i != null && near(r.i, want, 0.5) }; }));
  return { pass: off.every(o => o.ok) && live.every(o => o.ok), offline: off, live };
}
// True peak: a sine at fs/4 with a 45 degree phase has every SAMPLE at -3.01 dBFS and its real peak at 0.
export async function e2TruePeak() {
  await openMixer(); if (!M().dsp || !M().meterProbe) return { pass: false, why: 'no metering DSP exposed' };
  const sr = 48000, n = sr * 2, x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = 0.99997 * Math.sin(2 * Math.PI * 12000 * i / sr + Math.PI / 4);
  const buf = await decodeWav(wavBytes([x, x], sr), sr);
  const L = M().dsp.makeLoudness(sr, true); L.push(buf.getChannelData(0), buf.getChannelData(1)); const r = L.read();
  const off = { tp: +r.tp.toFixed(3), sp: +r.sp.toFixed(3), ok: r.tp <= 0.2 && r.tp >= -0.4 && near(r.sp, -3.01, 0.05) };
  // Live: the same known signal generated AT the live rate. (Decoding the 48 kHz file at 44.1 kHz resamples
  // it, and the resampler overshoots: its samples reached +0.007 dBFS, so 0 dBTP is no longer the truth.)
  const lr0 = M().liveRate(), lb = new AudioBuffer({ length: lr0 * 2, numberOfChannels: 2, sampleRate: lr0 });
  for (let c = 0; c < 2; c++) { const d = lb.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = 0.99997 * Math.sin(2 * Math.PI * (lr0 / 4) * i / lr0 + Math.PI / 4); }
  const lr = await M().meterProbe(lb);
  const live = { rate: lr0, tp: lr.tp == null ? null : +lr.tp.toFixed(3), samplePeakDb: +lr.pkDb.toFixed(3), ok: lr.tp != null && lr.tp <= 0.2 && lr.tp >= -0.4 && near(lr.pkDb, -3.01, 0.05) };
  return { pass: off.ok && live.ok, offline: off, live, rule: 'within +0.2 / -0.4 dB of the real peak (BS.1770-4)' };
}
// The Master meter reads what the export writes: one play through the demo from the top, and its
// integrated loudness equals the exported file's within 0.5 LU.
export async function e2MasterMatchesExport() {
  const b = await import('./dashboard-b.qa.js'); const demo = await b.loadDemoArrangement();
  await openMixer(); if (!M().meterCollect) return { pass: false, why: 'no live meter' }; await M().meterReady();
  const sn = snap(), bars = sn.song.reduce((m, v, i) => v != null ? i + 1 : m, 0), dur = bars * 4 * 60 / sn.bpm;
  $('play').click(); await settle(dur * 1000 + 300); const live = M().loudness(); await stopPlay();
  const buf = await S().renderExport(), L = M().dsp.makeLoudness(buf.sampleRate, true); L.push(buf.getChannelData(0), buf.getChannelData(1)); const file = L.read();
  return { pass: demo && live.i != null && near(live.i, file.i, 0.5), liveI: live.i && +live.i.toFixed(2), fileI: +file.i.toFixed(2), liveTP: live.tp && +live.tp.toFixed(2), fileTP: +file.tp.toFixed(2), seconds: +dur.toFixed(1) };
}
// "Limiting -x dB" shows when the limiter is working and not when it is not.
export async function e2Limiting() {
  await openMixer(); if (!M().meterCollect) return { pass: false, why: 'no live meter' }; await M().meterReady();
  const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await openMixer();
  Object.keys(G).forEach(id => { const c = document.querySelector(`.strip[data-g="${id}"] .ctl[data-k="vol"]`); if (c) c.__ctl.set(M().VOL_MAX, true); });
  ctl('__master', 'vol').__ctl.set(M().VOL_MAX, true); await settle(200);
  await playFor(2500); const hot = M().limiting();
  ctl('__master', 'vol').__ctl.set(M().dbToVol(-40), true); await settle(2500); const quiet = M().limiting(); await stopPlay();
  const x = parseFloat((hot.text.match(/([\d.]+)\s*dB/) || [])[1]);
  return { pass: hot.shown && x >= 0.5 && !quiet.shown, hot, quiet };
}
// ---------------------------------------------------------------------------------------------
// E2: the export is unchanged at default settings.
// Neither engine renders the same project to the same bytes twice, even on f304607 (measured: Chromium
// differs by up to 6e-6 at defaults and 1.6e-5 with the reverb off; WebKit up to 7e-5, and not at all
// once the reverb is off, so its convolver is its only variation). A hash of the OUTPUT therefore cannot
// prove "unchanged" at defaults. What can: (1) the export's GRAPH, every node, connection, parameter
// value and automation event, buffer content and scheduled start/stop, identical on both builds; and
// (2) where the engine does repeat itself (WebKit, song Reverb at 0), the rendered bytes identical.
function fnv(arr) { const u = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength); let h = 2166136261;
  for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); }
async function sha16(str) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16); }
async function exportGraph() {
  const log = [], ids = new WeakMap(); let next = 0;
  const OAC = window.OfflineAudioContext, isOff = c => c instanceof OAC;
  const nm = o => { if (!ids.has(o)) ids.set(o, o.constructor.name + '#' + (next++)); return ids.get(o); };
  const bufHash = b => { if (!b) return 'null'; let t = 'buf' + b.numberOfChannels + 'x' + b.length + '@' + b.sampleRate; for (let c = 0; c < b.numberOfChannels; c++) t += ':' + fnv(b.getChannelData(c)); return t; };
  const val = v => v instanceof AudioBuffer ? bufHash(v) : v instanceof AudioNode ? nm(v) : ids.has(v) ? ids.get(v)
    : (v && typeof v === 'object' && v.length !== undefined) ? 'arr' + v.length + ':' + fnv(v instanceof Float32Array ? v : new Float32Array(v)) : typeof v === 'number' ? (Object.is(v, -0) ? '0' : String(v)) : String(v);
  const restore = [];
  const method = (proto, name, fmt) => { const d = Object.getOwnPropertyDescriptor(proto, name); if (!d || typeof d.value !== 'function') return;
    proto[name] = function (...a) { const r = d.value.apply(this, a); const line = fmt(this, a, r); if (line) log.push(line); return r; }; restore.push(() => Object.defineProperty(proto, name, d)); };
  const setter = (proto, name, own) => { const d = Object.getOwnPropertyDescriptor(proto, name); if (!d || !d.set) return;
    Object.defineProperty(proto, name, Object.assign({}, d, { set(v) { if (own(this)) log.push(nm(this) + '.' + name + '=' + val(v)); d.set.call(this, v); } }));
    restore.push(() => Object.defineProperty(proto, name, d)); };
  window.OfflineAudioContext = function (...a) { log.push('OfflineAudioContext ' + a.map(val).join(',')); return new OAC(...a); };
  window.OfflineAudioContext.prototype = OAC.prototype; restore.push(() => { window.OfflineAudioContext = OAC; });
  const CP = BaseAudioContext.prototype;
  Object.getOwnPropertyNames(CP).filter(k => /^create/.test(k)).forEach(k => method(CP, k, (ctx, a, node) => {
    if (!isOff(ctx) || !node) return null;
    if (node instanceof AudioNode) for (const p in node) { try { if (node[p] instanceof AudioParam) ids.set(node[p], nm(node) + '.' + p); } catch (e) {} }
    return k + ' ' + (node instanceof AudioNode ? nm(node) : node instanceof AudioBuffer ? nm(node) + ' ' + node.numberOfChannels + 'x' + node.length : '') + ' (' + a.map(val).join(',') + ')'; }));
  const offNode = n => n instanceof AudioNode && isOff(n.context);
  ['connect', 'disconnect'].forEach(k => method(AudioNode.prototype, k, (t, a) => offNode(t) ? k + ' ' + nm(t) + ' ' + a.map(val).join(',') : null));
  ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']
    .forEach(k => method(AudioParam.prototype, k, (t, a) => ids.has(t) ? ids.get(t) + '.' + k + '(' + a.map(val).join(',') + ')' : null));
  { const d = Object.getOwnPropertyDescriptor(AudioParam.prototype, 'value');
    Object.defineProperty(AudioParam.prototype, 'value', Object.assign({}, d, { set(v) { if (ids.has(this)) log.push(ids.get(this) + '=' + val(v)); d.set.call(this, v); } }));
    restore.push(() => Object.defineProperty(AudioParam.prototype, 'value', d)); }
  ['start', 'stop'].forEach(k => method(AudioScheduledSourceNode.prototype, k, (t, a) => offNode(t) ? nm(t) + '.' + k + '(' + a.map(val).join(',') + ')' : null));
  method(OscillatorNode.prototype, 'setPeriodicWave', (t, a) => offNode(t) ? nm(t) + '.setPeriodicWave' : null);
  [[AudioBufferSourceNode, ['buffer', 'loop', 'loopStart', 'loopEnd']], [ConvolverNode, ['buffer', 'normalize']], [BiquadFilterNode, ['type']], [OscillatorNode, ['type']],
   [WaveShaperNode, ['curve', 'oversample']], [AnalyserNode, ['fftSize', 'smoothingTimeConstant']], [AudioNode, ['channelCount', 'channelCountMode', 'channelInterpretation']]]
    .forEach(([C, ks]) => ks.forEach(k => setter(C.prototype, k, offNode)));
  let rendered = null;
  try { rendered = await S().renderExport(); } finally { restore.reverse().forEach(f => f()); }
  return { lines: log.length, key: await sha16(log.join('\n')), sampleRate: rendered.sampleRate, length: rendered.length };
}
async function threeProjects(each) {
  await skipWelcome(); await settle(300); const out = {};
  // The export places a take by LAT(), which reads the live context's reported output latency: 0 in the
  // instant after the context starts, then its real value (measured: Chromium 16 ms, WebKit 5.2 ms). A render
  // in that first instant schedules the voice differently from one a moment later (it failed sameTwice once,
  // on the live site, in WebKit). Start the context and let it settle first, on both builds.
  if (window.__auraVocal && window.__auraVocal.audioContext) { window.__auraVocal.audioContext(); await settle(900); }
  out.fresh = await each('fresh');
  const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await settle(300);
  out.demo = await each('demo');
  const tk = new AudioBuffer({ length: SR * 4, numberOfChannels: 1, sampleRate: SR }), td = tk.getChannelData(0);
  for (let i = 0; i < td.length; i++) td[i] = 0.25 * Math.sin(2 * Math.PI * 220 * i / SR) * (0.6 + 0.4 * Math.sin(i / SR * 3));
  S().takeInstall(tk, 0); S().refInstall(sineBuf(-18, 330, 3), 0); await settle(300);
  out.withVoiceAndReference = await each('voice');
  return out;
}
// (1) The export's graph, identical on f304607 and this build (the runner compares `key`).
export async function e2ExportGraph() {
  const r = await threeProjects(async () => { const a = await exportGraph(), b = await exportGraph(); return { a, sameTwice: a.key === b.key }; });
  const all = Object.values(r);
  return { pass: all.every(x => x.sameTwice && x.a.lines > 100), key: all.map(x => x.a.key).join('.'), projects: r };
}
// (2) The rendered audio against the engine's own variation. Measured on f304607 against ITSELF: two
// exports of one project never match bit for bit in either engine (Chromium within one page; WebKit across
// documents), so no build can meet "byte-identical by hash" at defaults, the original included. What this
// proves instead: E's export differs from f304607's by no more than f304607's differs from f304607's,
// as floats and as the 16-bit samples the WAV actually contains (encodeWav's own conversion).
export async function e2ExportJitter() {
  const probe = await fetch('/rc-base/index.html', { method: 'HEAD' }).catch(() => null);
  if (!probe || !probe.ok) return { pass: false, why: 'the older build is not served at /rc-base/ (run with --base-root)' };
  const renderIn = async (src, project) => {
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:0;top:0;width:1440px;height:900px;opacity:0;pointer-events:none;border:0';
    const loaded = new Promise(r => f.onload = r); f.src = src; document.body.appendChild(f); await loaded; await new Promise(r => setTimeout(r, 900));
    const w = f.contentWindow, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
    const skip = async () => { const we = d.getElementById('welcome'); if (we && w.getComputedStyle(we).display !== 'none') { d.getElementById('wSkip').click(); await wait(500); } };
    await skip();
    if (project === 'demo') { const dl = d.querySelector('.wlink[data-w="demo"]'); if (dl) { dl.click(); await wait(700); } await skip(); }
    const buf = await w.__auraSuite.renderExport();
    const chans = []; for (let c = 0; c < buf.numberOfChannels; c++) chans.push(Float32Array.from(buf.getChannelData(c)));
    f.remove(); return chans; };
  const q = v => { v = Math.max(-1, Math.min(1, v)); return Math.trunc(v < 0 ? v * 0x8000 : v * 0x7FFF); };
  const cmp = (a, b) => { let max = 0, pcm = 0, n = 0, ss = 0;
    for (let c = 0; c < a.length; c++) { const x = a[c], y = b[c]; if (!y || x.length !== y.length) return { lengthDiffers: true };
      for (let i = 0; i < x.length; i++) { const dd = Math.abs(x[i] - y[i]); ss += dd * dd; if (dd > max) max = dd; if (dd && q(x[i]) !== q(y[i])) pcm++; n++; } }
    return { maxDiff: +max.toExponential(2), rmsDiff: +Math.sqrt(ss / n).toExponential(2), wavSamplesDiffer: pcm, of: n }; };
  const out = {};
  // f304607 three times, E twice. The engine's own variation is itself variable and heavy-tailed (WebKit's
  // largest single-sample difference between two f304607 renders of the demo: 5.6e-5 in one run, 2.5e-4 in
  // another), so the rule leans on the RMS of the difference: a real change (even 0.1 dB of level) moves the
  // whole waveform and lands orders of magnitude above it. E within 3x (RMS) and 10x (largest sample).
  for (const project of ['fresh', 'demo']) {
    const B = [await renderIn('/rc-base/', project), await renderIn('/rc/', project), await renderIn('/rc-base/', project),
               await renderIn('/rc/', project), await renderIn('/rc-base/', project)];
    const base = [B[0], B[2], B[4]], mine = [B[1], B[3]];
    const bb = [cmp(base[0], base[1]), cmp(base[0], base[2]), cmp(base[1], base[2])];
    const be = []; mine.forEach(m => base.forEach(b => be.push(cmp(b, m))));
    const mx = (arr, k) => Math.max(...arr.map(x => x[k]));
    const bbMax = mx(bb, 'maxDiff'), beMax = mx(be, 'maxDiff'), bbRms = mx(bb, 'rmsDiff'), beRms = mx(be, 'rmsDiff');
    const bbPcm = mx(bb, 'wavSamplesDiffer'), bePcm = mx(be, 'wavSamplesDiffer');
    out[project] = { f304607VsItself: { rmsDiff: bbRms, maxDiff: +bbMax.toExponential(2), wavSamplesDiffer: bbPcm },
      eVsF304607: { rmsDiff: beRms, maxDiff: +beMax.toExponential(2), wavSamplesDiffer: bePcm }, of: bb[0].of,
      ok: ![...bb, ...be].some(x => x.lengthDiffers) && beRms <= Math.max(bbRms, 1e-10) * 3 && beMax <= Math.max(bbMax, 1e-9) * 10 };
  }
  return { pass: Object.values(out).every(o => o.ok), projects: out, rule: 'E against every f304607 render: RMS difference within 3x, largest sample within 10x, the widest f304607-against-f304607' };
}

// ---------------------------------------------------------------------------------------------
// E6: Check my mix listens to the song. Scenarios are built so a fader-reading check gets them wrong.
// A voice-like take: a sung 220 Hz line with harmonics, vibrato and syllables, `db` dBFS at its peaks.
function voiceBuf(db, sec = 16) { const n = SR * sec, b = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: SR }), d = b.getChannelData(0), a = Math.pow(10, db / 20) / 1.6;
  for (let i = 0; i < n; i++) { const t = i / SR, f = 220 * (1 + 0.01 * Math.sin(2 * Math.PI * 5.5 * t)), ph = 2 * Math.PI * f * t;
    const syl = 0.55 + 0.45 * Math.sin(2 * Math.PI * 2.2 * t) ** 2;
    d[i] = a * syl * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph) + 0.15 * Math.sin(5 * ph)); }
  return b; }
async function demoWith(voiceDb) { const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await openMixer();
  if (voiceDb != null) { S().takeInstall(voiceBuf(voiceDb), 0); await settle(300); } }
const ids = r => (r && r.findings || []).map(f => f.id);
export async function e6Measured() {
  if (!M().mixCheck) return { pass: false, why: 'no measured Check my mix' };
  // (a) a quietly recorded voice, Vocals fader at its default: the settings cannot see it, the audio can
  await demoWith(-32); const a = await M().mixCheck(), oldA = S().mixCheck().map(w => w.id);
  // (b) three channels pushed to +6 dB that play nothing: the settings rule cries clipping, the audio is silent.
  // The demo with its chords and melody emptied (pattern lanes 6-12 are the chord degrees; no reference is
  // loaded, so Sample is silent too), opened, THEN Chords, Melody and Sample pushed to +6 dB.
  const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await openMixer();
  const g2 = S().buildFile('QA E2', true), P2 = g2.project;
  P2.patterns = P2.patterns.map(row => row.map((v, i) => i >= 6 ? 0 : v)); P2.melodies = P2.melodies.map(() => []);
  const opened = S().openFile(JSON.parse(JSON.stringify(g2)), 'QA E2.aura'); await settle(300);
  const quietFaders = await M().mixCheck(), oldQuiet = S().mixCheck().map(w => w.id);
  ['chords', 'melody', 'sample'].forEach(id => { const c = document.querySelector(`.strip[data-g="${id}"] .ctl[data-k="vol"]`); c.__ctl.set(M().VOL_MAX, true); });
  await settle(200);
  const bb = await M().mixCheck(), oldB = S().mixCheck().map(w => w.id);
  const same = JSON.stringify(ids(bb)) === JSON.stringify(ids(quietFaders));
  return { pass: ids(a).includes('voice-buried') && !oldA.some(x => /voice|vocal/.test(x)) && same && !oldQuiet.includes('clip-risk') && oldB.includes('clip-risk'),
    quietVoice: { measured: ids(a), settingsRule: oldA, voiceVsMusic: a && a.findings.find(x => x.id === 'voice-buried') },
    silentChannelsPushedToPlus6: { measuredBefore: ids(quietFaders), measuredAfter: ids(bb), unchanged: same, settingsRuleBefore: oldQuiet, settingsRuleAfter: oldB }, openedOk: !!(opened && opened.ok) };
}
// Show points at the exact controls, and they are on screen.
export async function e6Show() {
  if (!M().mixCheck) return { pass: false, why: 'no measured Check my mix' };
  await demoWith(null);
  const set = (id, k, v) => { const c = k === 'vol' ? document.querySelector(`.strip[data-g="${id}"] .ctl[data-k="vol"]`) : ctl(id, k); c.__ctl.set(v, true); };
  set('bass', 'vol', M().VOL_MAX); set('bass', 'lo', 12); set('kick', 'vol', M().dbToVol(-14)); await settle(200);
  const n0 = M().mixChecks(); $('mixCheckBtn').click(); const r = await M().mixCheckDone(n0);
  const f = (r.findings || []).find(x => x.id === 'kick-under-bass'); if (!f) return { pass: false, why: 'no kick-under-bass finding', found: ids(r) };
  const btn = document.querySelector(`#mixFindings li[data-id="kick-under-bass"] .mfshow`); if (!btn) return { pass: false, why: 'no Show button' };
  btn.click(); await settle(400);
  const hl = [...document.querySelectorAll('.ctl.hl')].map(c => c.dataset.g + ':' + c.dataset.k).sort();
  const onScreen = [...document.querySelectorAll('.ctl.hl')].every(c => { const r2 = c.getBoundingClientRect(); const h = document.elementFromPoint(r2.left + r2.width / 2, r2.top + r2.height / 2); return !!h && c.contains(h); });
  const rows = [...document.querySelectorAll('#mixFindings li:not(.fixed)')], everyHasShow = rows.length > 0 && rows.every(li => !!li.querySelector('.mfshow'));
  return { pass: JSON.stringify(hl) === JSON.stringify(['bass:lo', 'bass:vol', 'kick:vol']) && onScreen && M().detailChannel() === 'bass' && everyHasShow, highlighted: hl, onScreen, everyFindingHasShow: everyHasShow, findings: rows.length, text: f.text, fix: f.fix };
}
// The demo at its defaults with a well-recorded voice: nothing about balance, low end, width or reverb.
export async function e6Demo() {
  if (!M().mixCheck) return { pass: false, why: 'no measured Check my mix' };
  await demoWith(-12); const r = await M().mixCheck();
  const bad = ids(r).filter(x => /^(voice-|kick-under-bass|over-|wide|wash)/.test(x));
  return { pass: bad.length === 0, findings: ids(r), unexpected: bad, file: r.file, analysisMs: r.ms };
}
// A singer who has never used a DAW finds and fixes "vocal too quiet". Scripted at a human pace: every
// click waits the time a person needs to read and aim first; the analysis times are real.
export async function e6Novice() {
  if (!M().mixCheck) return { pass: false, why: 'no measured Check my mix' };
  await demoWith(-23); await settle(300);
  const t0 = performance.now(), steps = [], mark = s => steps.push([s, Math.round(performance.now() - t0)]);
  const human = ms => settle(ms);
  await human(1200); const n0 = M().mixFirstChecks(); $('mixCheckBtn').click(); mark('pressed Check my mix');
  await M().mixFirstDone(n0); mark('findings shown');
  const li = document.querySelector('#mixFindings li[data-id="voice-buried"]'); if (!li) return { pass: false, why: 'no voice finding', steps };
  const say = li.textContent.replace(/\s+/g, ' ').trim();
  await human(1800); li.querySelector('.mfshow').click(); mark('pressed Show');
  const fader = document.querySelector('.ctl.hl[data-k="vol"][data-g="vocals"]'); if (!fader) return { pass: false, why: 'the Vocals fader is not highlighted', steps };
  const want = +(say.match(/by about ([\d.]+) dB/) || [])[1] || 8;
  await human(1000);
  // drag it up the way a hand does: press the thumb, move up by the distance the suggested dB needs, let go
  const track = fader.querySelector('.ctl-track').getBoundingClientRect(), th = fader.querySelector('.ctl-thumb').getBoundingClientRect();
  const x = th.left + th.width / 2, y = th.top + th.height / 2;
  const from = M().faderPos(M().volToDb(M().mixOf('vocals').vol)), to = M().faderPos(Math.min(6, M().volToDb(M().mixOf('vocals').vol) + want));
  const dy = (to - from) * (track.height - 10);
  fader.querySelector('.ctl-thumb').dispatchEvent(pe('pointerdown', x, y)); await settle(120);
  for (let k = 1; k <= 6; k++) { window.dispatchEvent(pe('pointermove', x, y - dy * k / 6)); await settle(50); }
  const n1 = M().mixFirstChecks(); window.dispatchEvent(pe('pointerup', x, y - dy)); mark('released the fader');
  const fixed = await M().mixFirstDone(n1); mark('re-checked');
  // The singer's part ends when the fader is released at the suggested level; Aura then listens again
  // and marks the finding fixed. Both are timed; the first must be under 10 s, the second must arrive.
  const singer = steps.find(s => s[0] === 'released the fader')[1], total = Math.round(performance.now() - t0);
  const done = !ids(fixed).includes('voice-buried'), fixedRow = !!document.querySelector('#mixFindings li[data-id="voice-buried"].fixed');
  return { pass: done && fixedRow && singer < 10000, singerMs: singer, confirmedFixedAtMs: total, steps, finding: say, vocalsNowDb: +M().volToDb(M().mixOf('vocals').vol).toFixed(1), markedFixed: fixedRow,
    humanDelaysMs: 1200 + 1800 + 1000 + 420, analysisMs: [fixed && fixed.ms] };
}
// Guided mode's Mix Check card runs the same measured check, with Show opening the mixer there.
export async function e6Guided() {
  if (!M().mixCheck) return { pass: false, why: 'no measured Check my mix' };
  await demoWith(-32);
  document.querySelector('#modeSwitch button[data-m="guided"]').click(); await settle(500);
  const go = document.querySelector('[data-view="mix"], .wtab[data-v="mix"]'); if (go) { go.click(); await settle(300); }
  const n0 = M().mixChecks(); $('mixRun').click(); const r = await M().mixCheckDone(n0); await settle(200);
  const li = document.querySelector('#mixOut li[data-id="voice-buried"]');
  if (li) { li.querySelector('.mfshow').click(); await settle(500); }
  const hl = document.querySelector('.ctl.hl[data-g="vocals"][data-k="vol"]'), hr = hl && hl.getBoundingClientRect();
  const hit = hr && document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2);
  document.querySelector('#modeSwitch button[data-m="studio"]').click(); await settle(300);
  return { pass: !!li && ids(r).includes('voice-buried') && !!hl && !!hit && hl.contains(hit), inGuidedList: !!li, highlighted: !!hl, onScreen: !!hit && !!hl && hl.contains(hit) };
}
// The windowed analysis measures what one full render measures (same findings, same numbers within a
// hair), on two different mixes. Otherwise the speed would be bought with accuracy.
export async function e6Windows() {
  if (!M().mixCheck) return { pass: false, why: 'no measured Check my mix' };
  const out = [];
  for (const vdb of [-12, -30]) {
    await demoWith(vdb);
    const n0 = M().mixChecks(); M().mixCheck({ windows: 1 }); const one = await M().mixCheckDone(n0);
    const n1 = M().mixChecks(); M().mixCheck(); const many = await M().mixCheckDone(n1);
    const d = k => +(Math.abs(many.raw[k] - one.raw[k])).toFixed(3);
    const r = { voiceDb: vdb, windows: many.windows, idsOne: ids(one), idsMany: ids(many),
      lufs: [+one.file.i.toFixed(2), +many.file.i.toFixed(2)], tp: [+one.file.tp.toFixed(2), +many.file.tp.toFixed(2)],
      diffs: { vocal: d('vocal'), backing: d('backing'), dry: d('dry'), reverb: d('reverb'), kickLow: d('kickLow'), bassLow: d('bassLow') },
      frames: [one.raw.frames, many.raw.frames], ms: [one.ms, many.ms] };
    r.ok = many.windows > 1 && JSON.stringify(r.idsOne) === JSON.stringify(r.idsMany) && Math.abs(one.file.i - many.file.i) <= 0.1 && Math.abs(one.file.tp - many.file.tp) <= 0.2
      && Object.values(r.diffs).every(x => x <= 0.3) && Math.abs(one.raw.frames - many.raw.frames) <= 4;
    out.push(r);
  }
  return { pass: out.every(r => r.ok), mixes: out };
}

// ---------------------------------------------------------------------------------------------
// E5: every control shows its real value and its unit. Each readout is checked against the LIVE AUDIO
// NODE it drives (not against the app's own formatter), so a readout cannot say one thing while the
// sound does another.
const dbTxt = db => { if (!(db > -Infinity) || db < -100) return `${MINUS}∞ dB`; const r = +db.toFixed(1); return r === 0 ? '0.0 dB' : (r > 0 ? '+' : MINUS) + Math.abs(r).toFixed(1) + ' dB'; };
const g2db = g => g > 0 ? 20 * Math.log10(g) : -Infinity;
const panTxt = v => { v = Math.round(v); return v === 0 ? 'C' : (v < 0 ? 'L ' + (-v) + '%' : 'R ' + v + '%'); };
export async function e5Units() {
  await openMixer(); M().ensureAudio(); await settle(300);
  const setv = (g, k, v) => { const c = k === 'vol' ? document.querySelector(`.strip[data-g="${g}"] .ctl[data-k="vol"]`) : ctl(g, k); c.__ctl.set(v, true); };
  setv('vocals', 'vol', M().dbToVol(-3.5)); setv('chords', 'pan', -40); setv('bass', 'lo', 2.5); setv('melody', 'rev', 30); setv('snare', 'dly', 20);
  ctl('__master', 'vol').__ctl.set(M().dbToVol(-2), true);
  $('mixFxBtn').click(); await settle(200);
  M().selectChannel('chords'); await settle(400);
  const bad = [], seen = [];
  const expect = c => { const g = c.dataset.g, k = c.dataset.k;
    if (g === '__master') return dbTxt(g2db(M().masterGain()));
    if (g === '__drums') return dbTxt(g2db(Math.max(...['kick', 'snare', 'hats'].map(id => M().node(id).gain)) / Math.SQRT2));
    const n = M().node(g);
    return { vol: () => dbTxt(g2db(n.gain / Math.SQRT2)), pan: () => panTxt(n.pan * 100), lo: () => dbTxt(n.lo), mid: () => dbTxt(n.mid), hi: () => dbTxt(n.hi),
      rev: () => dbTxt(g2db(n.rs)), dly: () => dbTxt(g2db(n.ds)) }[k](); };
  [...document.querySelectorAll('#mixer .ctl')].filter(c => c.getBoundingClientRect().width > 0).forEach(c => {
    const got = valText(c), want = expect(c); seen.push(c.dataset.g + ':' + c.dataset.k); if (got !== want) bad.push({ ctl: c.dataset.g + ':' + c.dataset.k, got, want }); });
  // the mix effects: each readout against its node
  const fx = M().fxLive(), fxv = id => txt($(id));
  const fxWant = { fxDlyTimeV: Math.round(fx.delayTime * 1000) + ' ms', fxDlyFbV: Math.round(fx.feedback * 100) + '%', fxCompV: (+fx.ratio).toFixed(1) + ':1',
    fxRevSizeV: (0.6 + (+$('fxRevSize').value) / 100 * 2.4).toFixed(1) + ' s' };
  Object.entries(fxWant).forEach(([id, w]) => { seen.push(id); if (fxv(id) !== w) bad.push({ ctl: id, got: fxv(id), want: w }); });
  // the rail: the selected track's High EQ and sends against the channel's nodes; the rest carry their unit
  const rc = M().detailChannel(), rn = M().node(rc);
  const rail = { drCutOut: dbTxt(rn.hi), drRevOut: dbTxt(g2db(rn.rs)), drDlyOut: dbTxt(g2db(rn.ds)) };
  Object.entries(rail).forEach(([id, w]) => { seen.push(id); if (txt($(id)) !== w) bad.push({ ctl: id, got: txt($(id)), want: w }); });
  ['drInt', 'drMove', 'drSpace', 'drWarm', 'drRoom', 'drEcho'].forEach(id => { seen.push(id); const w = $(id).value + ' %', got = txt($(id + 'Out'));
    if (got !== w) bad.push({ ctl: id, got, want: w }); });
  const cutLabel = txt($('drCut').closest('label')), cutHonest = /High EQ/.test(cutLabel) && !/cutoff|Hz/i.test(cutLabel);
  return { pass: bad.length === 0 && cutHonest && seen.length > 20, checked: seen.length, mismatched: bad, railChannel: rc, highEqLabel: cutLabel };
}
// Guided's Quick balance and the reference card's level read the same channels, in dB.
export async function e5Balance() {
  await skipWelcome(); await settle(300);
  S().refInstall(sineBuf(-18, 330, 2), 0); await settle(200);
  const c = document.querySelector('.strip[data-g="sample"] .ctl[data-k="vol"]'); c.__ctl.set(M().dbToVol(-4.5), true); await settle(200);
  const ref = txt($('refLevelV'));
  document.querySelector('#modeSwitch button[data-m="guided"]').click(); await settle(500);
  const rows = [...document.querySelectorAll('.balrow')].filter(r => !r.hidden).map(r => txt(r.querySelector('.val')));
  document.querySelector('#modeSwitch button[data-m="studio"]').click(); await settle(300);
  // one drag of the reference level is one undo entry (it used to be one per pixel)
  const lv = $('refLevel'), d0 = S().undoDepth();
  for (const v of [90, 80, 70]) { lv.value = String(v); lv.dispatchEvent(new Event('input', { bubbles: true })); }
  lv.dispatchEvent(new Event('change', { bubbles: true })); await settle(300);
  const entries = S().undoDepth() - d0;
  return { pass: ref === `${MINUS}4.5 dB` && rows.length > 0 && rows.every(t => /dB$/.test(t)) && entries === 1, referenceLevel: ref, quickBalance: rows, undoEntriesForOneDrag: entries };
}

// The peak-hold line holds a peak about 1.5 s while the bar itself falls, then falls too. The tone plays 3 s,
// so the hold has settled on the steady level (a hold keeps the MAXIMUM for 1.5 s from when it happened).
export async function e2Hold() {
  const why = await withSample(sineBuf(-6.0206, 1000, 4)); if (why) return { pass: false, why };
  await playFor(3000); const during = Math.max(...M().meterShown('sample').holdDb); await stopPlay();
  const t0 = performance.now(); await settle(500); const a = M().meterShown('sample'), ta = Math.round(performance.now() - t0);
  await settle(2600); const b = M().meterShown('sample'), tb = Math.round(performance.now() - t0);
  const holdA = Math.max(...a.holdDb), holdB = Math.max(...b.holdDb), posA = Math.max(...a.pos);
  const barFellA = posA < (0.9 - 0.1);          // the peak bar fell below -12 dBFS within half a second
  return { pass: near(during, -6.02, 0.3) && near(holdA, -6.02, 0.3) && barFellA && holdB < -20, holdWhilePlaying: +during.toFixed(2),
    afterStopMs: [ta, tb], holdAfterStop: [+holdA.toFixed(2), +holdB.toFixed(2)], peakBarPosAfterHalfSecond: posA };
}
// The Master shows S, I and TP with their units while playing; TP turns amber over -1; the target marker sits at -14 LUFS.
export async function e2MasterDisplay() {
  const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await openMixer(); await M().meterReady();
  await playFor(4200);
  // what the screen shows is the as-exported reading (the export's safety gain applied), so compare with that
  const S1 = txt($('mLufsS')).replace('\u2248', ''), I1 = txt($('mLufsI')).replace('\u2248', ''), TP = txt($('mTp')).replace('\u2248', ''), loud = M().loudnessShown ? M().loudnessShown() : M().loudness(), over = $('mTp').classList.contains('over');
  const unitRow = id => txt($(id).closest('.lrow'));
  await stopPlay();
  const num = t => parseFloat(t.replace(MINUS, '-')), em = document.querySelector('.loud .lbar em'), bar = em && em.parentElement.getBoundingClientRect(), er = em && em.getBoundingClientRect();
  const markerAt = bar ? -30 + ((er.left + er.width / 2 - bar.left) / bar.width) * 24 : null;
  const ok = near(num(S1), loud.s, 0.15) && near(num(I1), loud.i, 0.15) && near(num(TP), loud.tp, 0.15) && /LUFS/.test(unitRow('mLufsS')) && /LUFS/.test(unitRow('mLufsI'))
    && /dBTP/.test(unitRow('mTp')) && over === (loud.tp > -1) && markerAt != null && near(markerAt, -14, 0.5) && /14 LUFS/.test(txt(document.querySelector('.loud .tgt')));
  return { pass: ok, shown: { S: S1, I: I1, TP }, meter: { s: loud.s && +loud.s.toFixed(2), i: loud.i && +loud.i.toFixed(2), tp: loud.tp && +loud.tp.toFixed(2) }, tpAmber: over, targetMarkerLufs: markerAt && +markerAt.toFixed(2) };
}
// The findings panel belongs to the Studio mixer: another editor tab takes it (and its highlights) away.
export async function e6PanelFollows() {
  if (!M().mixCheck) return { pass: false, why: 'no measured Check my mix' };
  await demoWith(-32);
  const n0 = M().mixChecks(); $('mixCheckBtn').click(); await M().mixCheckDone(n0);
  const p = $('mixFindings'), shownBefore = !!p && !p.hidden;
  const btn = document.querySelector('#mixFindings li .mfshow'); if (btn) btn.click(); await settle(300);
  const hlBefore = document.querySelectorAll('.ctl.hl').length;
  document.querySelector('#studioETabs .etab[data-ed="grid"]').click(); await settle(400);
  const hiddenAfter = p.hidden, hlAfter = document.querySelectorAll('.hl').length;
  return { pass: shownBefore && hlBefore > 0 && hiddenAfter && hlAfter === 0, shownBefore, highlightsBefore: hlBefore, hiddenAfterTabSwitch: hiddenAfter, highlightsAfter: hlAfter };
}

// The Master reads what the exported FILE measures. Play the demo from the top to its end, Stop; once the
// export's own measurement is in, the displayed integrated loudness equals an independent measurement of the
// rendered file within half the display step (0.05 LU), with no "≈", and the File line is the file.
export async function e2MasterAsExported() {
  const b = await import('./dashboard-b.qa.js'); await b.loadDemoArrangement(); await openMixer();
  if (!M().loudnessShown || !M().exportMeasured) return { pass: false, why: 'no as-exported Master readout' }; await M().meterReady();
  const sn = snap(), bars = sn.song.reduce((m, v, i) => v != null ? i + 1 : m, 0), dur = bars * 4 * 60 / sn.bpm;
  $('play').click(); await settle(dur * 1000 + 300);
  const beforeStop = { text: txt($('mLufsI')), shown: M().loudnessShown() };
  await stopPlay();
  let ex = null; for (let k = 0; k < 300 && !(ex = M().exportMeasured()); k++) await settle(100);
  await settle(250);
  const shown = M().loudnessShown(), raw = M().loudness(), iText = txt($('mLufsI')), fileText = txt($('mFile'));
  const buf = await S().renderExport(), L = M().dsp.makeLoudness(buf.sampleRate, true); L.push(buf.getChannelData(0), buf.getChannelData(1)); const file = L.read();
  const f1 = v => (v < 0 ? MINUS : '') + Math.abs(v).toFixed(1), num = s => parseFloat(s.replace('≈', '').replace(MINUS, '-'));
  const gap = Math.abs(shown.i - file.i), rawGap = raw.i - file.i;
  const fileLineOk = !!ex && Math.abs(ex.i - file.i) <= 0.02 && Math.abs(ex.tp - file.tp) <= 0.02 && fileText.includes(f1(file.i) + ' LUFS') && fileText.includes(f1(file.tp) + ' dBTP');
  return { pass: !!ex && !shown.approx && !/≈/.test(iText) && gap <= 0.05 && Math.abs(num(iText) - file.i) <= 0.05 && fileLineOk,
    whatTheMasterShows: iText, theFileMeasures: +file.i.toFixed(3), shownMinusFile: +(shown.i - file.i).toFixed(3),
    withoutTheCorrection: +rawGap.toFixed(3), exportSafetyGainDb: +(20 * Math.log10(shown.g)).toFixed(3),
    fileLine: fileText, fileTP: +file.tp.toFixed(3), beforeStop: { text: beforeStop.text, approx: beforeStop.shown.approx } };
}
// Does the engine render one project to the same bytes twice? The default project, three exports in a row in
// one page, each hashed as the 16-bit WAV data encodeWav writes. PASSES while they differ, which is what the
// record says; if an engine ever repeats itself, this fails and the export proof should become a hash again.
export async function e2EngineRepeats() {
  await skipWelcome(); await settle(300);
  const pcm = buf => { const n = buf.length, nc = buf.numberOfChannels, a = new Int16Array(n * nc), ch = [...Array(nc)].map((_, c) => buf.getChannelData(c)); let o = 0;
    for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const v = Math.max(-1, Math.min(1, ch[c][i])); a[o++] = Math.trunc(v < 0 ? v * 0x8000 : v * 0x7FFF); } return a; };
  const hash = async a => { const h = await crypto.subtle.digest('SHA-256', a.buffer); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16); };
  const w = []; for (let k = 0; k < 3; k++) w.push(pcm(await S().renderExport()));
  const hs = await Promise.all(w.map(hash)); const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; };
  const identical = hs.every(h => h === hs[0]);
  return { pass: !identical, identical, wavDataHashes: hs, samplesDiffer: [diff(w[0], w[1]), diff(w[1], w[2]), diff(w[0], w[2])], of: w[0].length,
    rule: 'passes while the engine does NOT repeat its bytes (the record says it does not)' };
}
