# Dashboard sub-project B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clip drag or resize never corrupts the arrangement and is one undo step; sections, energy, lanes and the playhead share one time axis; empty Atmosphere and Voice lanes draw nothing; selection follows the edit and lanes are reachable by keyboard.

**Architecture:** All changes in `rc/app.js`, `rc/index.html`, `rc/styles.css`. A drag becomes a transaction on the existing checkpoint counter (`applyDepth`), so history and autosave are written once when the gesture ends. One `dashBars()` supplies the bar count to every row; the energy strip and sections are offset by the lane-header gutter so all timelines share one column; the playhead moves out of the energy strip into the arrangement (the scroll container) and is sized from the rows it must cross.

**Tech Stack:** Vanilla JS in one IIFE, CSS; built-in browser for scripted checks.

**Spec:** `docs/superpowers/specs/2026-09-24-dashboard-b-design.md`

## Global Constraints

- Sole writer. Before starting and before the push, `git ls-remote origin refs/heads/main` must print `8b220320099a75afd89a177982a76636b9b25449`; otherwise stop and tell Philip.
- Ship gate: fresh loads (storage cleared on a separate same-origin page, Welcome confirmed showing) at 375×812, 1024×768, 1280×800, 1440×900, and one live shrink 1440 → 375 with a screenshot before measuring. Page wider than the viewport or the Welcome ✕ off screen blocks the ship.
- A's table must still pass: `layout`, `a1`, `a2*`, `a3*`, `claimsA/B/C` (with C7, C13, C17 now passing).
- C13 must fail on a mutant: a copy that moves from the drag's origin must fail the B1 checks.
- Network law: `fetch(` count 1, inside `loadSampleUrl`.
- Version: every `13.8.0-rc.3` → `13.8.0-rc.4` (1 in `app.js`, 13 in `index.html`).
- Out of scope: C, D, E; promoting `/rc/` to root; merging `v13.7-recording-confidence`; ElevenLabs.
- New user-facing copy: no em dashes.
- Spec refinement, stated: the drag listens on `window` for `pointerup`/`pointercancel` and ends on `blur` and `visibilitychange`, instead of capturing the pointer on the clip, because the clip element is re-rendered at every step and capture on a removed element is lost immediately.

## Files

- Modify `rc/app.js` — `dashBars`, drag transaction and `dashClipPointer`, `renderDashLanes` (empty lanes, name button), `renderDashSections` (placed by bar), `updateDashPlayhead`, `paintDashEnergy`/`dashEnergyPointer` bar count, redraw on import/clear/take.
- Modify `rc/index.html` — move `#saPlayhead` out of `#saEnergy` into `#studioArr`.
- Modify `rc/styles.css` — shared gutter, sections by position, playhead sizing, lane-name button.
- Create `qa/dashboard-b.qa.js` — test-only B checks.

---

### Task 1: B checks and RED

**Files:** Create `qa/dashboard-b.qa.js`

- [ ] **Step 1:** write the module (code below).
- [ ] **Step 2:** RED on the current build at 1440×900 (fresh): expect `b1Drag` FAIL (bars change, 2+ undo entries), `b1Cancel` FAIL, `b1Resize` FAIL (one entry per step), `b2Grid` FAIL (misaligned rows, playhead short), `b3Lanes` FAIL (phantom clips), `b4Select` FAIL (lane name is not a button). `b1NoOp` and `b1Blocked` may already pass: record them as baselines, not as RED.
- [ ] **Step 3:** commit `qa: dashboard B checks; RED on 8b22032`.

```js
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
```

---

### Task 2: B1 drag integrity

**Files:** Modify `rc/app.js` (`dashClipPointer`, add `dashBars`, `dashTxBegin/dashTxEnd` before it).

- [ ] **Step 1: code.** Replace the whole `function dashClipPointer(...){...}` with:

```js
  // The bar count every arrangement row uses, so sections, energy, lanes and the playhead agree.
  function dashBars(){ return Math.max(8, songUsedLen()||8); }
  // One drag or resize is ONE transaction. oneCheckpoint's autosave (storage and history) is held from
  // pointer-down until the gesture ends, then written once; a drag that ends where it began writes
  // nothing, because pushHistory skips a snapshot equal to the last. The old handler wrote one entry
  // per step.
  let dashTx=null;
  function dashTxBegin(end){ dashTxEnd(); dashTx={end}; applyDepth++; }
  function dashTxEnd(){ const t=dashTx; if(!t) return; dashTx=null;
    try{ t.end&&t.end(); } finally { applyDepth--; if(!applyDepth) autosave(); } }
  function dashClipPointer(ev, lane, start, bars, pat){
    ev.preventDefault(); ev.stopPropagation();
    if(lane.id==='atmosphere'||lane.id==='voice'){ selectDashTrack(lane.id, {lane:lane.id, start, bars, pat}); return; }
    selectDashTrack(lane.id, {lane:lane.id, start, bars, pat});
    const isResize = ev.target && ev.target.classList && ev.target.classList.contains('rsz');
    const body=ev.currentTarget.parentElement, rect=body.getBoundingClientRect();
    const perBar=rect.width/dashBars(), x0=ev.clientX, start0=start, bars0=bars;
    // Where the run IS now. Every step moves it from here; the origin only measures the gesture.
    // (Moving from the origin on every step is what duplicated and dropped bars.)
    let cur=start0, curBars=bars0;
    const el=ev.currentTarget; el.classList.add('dragging');
    const mv=e2=>{
      const dx=e2.clientX-x0;
      if(!isResize){
        const ns=Math.max(0, Math.min(SONG_SLOTS-bars0, Math.round(start0+dx/perBar)));
        if(ns!==cur && songMoveTo(cur, ns, bars0, pat)){ cur=ns;
          renderStudioArrangement(); selectDashTrack(lane.id,{lane:lane.id,start:cur,bars:bars0,pat}); }
      } else {
        const nb=Math.max(1, Math.round(bars0+dx/perBar));
        if(nb!==curBars && songResize(start0, nb)){ curBars=nb;
          renderStudioArrangement(); selectDashTrack(lane.id,{lane:lane.id,start:start0,bars:nb,pat}); }
      }
    };
    const stop=()=>dashTxEnd();
    const offVis=()=>{ if(document.visibilityState==='hidden') dashTxEnd(); };
    dashTxBegin(()=>{
      el.classList.remove('dragging');
      window.removeEventListener('pointermove',mv); window.removeEventListener('pointerup',stop);
      window.removeEventListener('pointercancel',stop); window.removeEventListener('blur',stop);
      document.removeEventListener('visibilitychange',offVis);
      // The moved run stays selected, with the rail naming its new bars.
      selectDashTrack(lane.id,{lane:lane.id,start:cur,bars:curBars,pat});
    });
    window.addEventListener('pointermove',mv); window.addEventListener('pointerup',stop);
    window.addEventListener('pointercancel',stop); window.addEventListener('blur',stop);
    document.addEventListener('visibilitychange',offVis);
  }
```

- [ ] **Step 2: GREEN** `b1Drag`, `b1NoOp`, `b1Cancel`, `b1Resize` at 1440 fresh; `loadDemoArrangement` then `b1Blocked` on another fresh load.
- [ ] **Step 3: mutant.** Copy `app.js` aside, change `songMoveTo(cur, ns, bars0, pat)` to `songMoveTo(start0, ns, bars0, pat)`, refresh the cache, run `b1Drag` and A's `claimsC` C13: both must FAIL. Restore, verify the hash.
- [ ] **Step 4:** commit.

---

### Task 3: B2 one grid, one playhead

**Files:** `rc/index.html` (move `#saPlayhead`), `rc/styles.css`, `rc/app.js` (`renderDashSections`, `updateDashPlayhead`, the `used` lines in `renderDashLanes`, `paintDashEnergy`, `dashEnergyPointer`).

- [ ] **Step 1: markup.** Remove `<div class="sa-playhead" id="saPlayhead" aria-hidden="true"></div>` from `#saEnergy` and insert it as the last child of `#studioArr` (after `#saLanes`).
- [ ] **Step 2: CSS.** Append:

```css
/* B2. One time axis. A lane's timeline starts after the lanes' 8 px padding, its 1 px border and the
   128 px header; sections and the energy strip start at exactly that x and end 9 px from the right,
   so bar b sits at the same x in every row. */
#studioArr{--sa-gutter:128px}
.sa-secs{display:block;position:relative;padding:0;margin:8px 9px 0 calc(9px + var(--sa-gutter));min-height:36px}
.sa-secs .sa-sec{position:absolute;top:0;bottom:0;padding:8px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sa-energy{margin:4px 8px 4px calc(8px + var(--sa-gutter))}
/* The playhead crosses every row: it lives in the arrangement (the scroll container) and is sized in JS. */
#studioArr > .sa-playhead{bottom:auto}
.sa-lane-hd button.nm{background:none;border:0;padding:0;margin:0;text-align:left;color:inherit;cursor:pointer;
  font:600 11px/1.1 var(--font-display);letter-spacing:.08em;text-transform:uppercase;min-height:32px}
.sa-lane-hd button.nm:focus-visible{outline:2px solid var(--violet-300,#c9b6ff);outline-offset:2px;border-radius:4px}
```

- [ ] **Step 3: sections placed by bar.** Replace `renderDashSections` body so each block is absolutely placed at `left = start/used`, `width = bars/used`, with `data-start`; gaps simply stay empty.

```js
  function renderDashSections(){
    const host=document.getElementById('saSecs'); if(!host) return;
    host.innerHTML='';
    const runs=songRuns().filter(r=>r.pat!=null), used=dashBars();
    if(!runs.length){
      const b=document.createElement('button'); b.type='button'; b.className='sa-sec';
      b.style.left='0'; b.style.width='100%'; b.textContent='No sections yet'; host.appendChild(b); return;
    }
    // Placed by bar, like the clips below them, so an empty bar stays an empty gap in time.
    runs.forEach(r=>{
      const b=document.createElement('button'); b.type='button'; b.className='sa-sec';
      b.style.left=(r.start/used*100)+'%'; b.style.width=(r.bars/used*100)+'%';
      b.dataset.start=String(r.start);
      b.textContent=secNames[r.pat]||('S'+(r.pat+1));
      b.title=(secNames[r.pat]||('Section '+(r.pat+1)))+' · bars '+(r.start+1)+'–'+(r.start+r.bars);
      if(r.start===songSel || r.pat===currentPattern) b.classList.add('on');
      b.addEventListener('click',()=>{
        currentPattern=r.pat; songSel=r.start; renderGrid(); refreshPatBtns();
        renderSongTimeline(); renderStudioArrangement(); paintDashRail();
      });
      host.appendChild(b);
    });
  }
```

- [ ] **Step 4: one bar count.** In `renderDashLanes`, `paintDashEnergy` and `dashEnergyPointer`, replace `Math.max(8, songUsedLen()||8)` with `dashBars()`.
- [ ] **Step 5: playhead.** Replace `updateDashPlayhead` with:

```js
  function updateDashPlayhead(){
    const ph=document.getElementById('saPlayhead'), arr=document.getElementById('studioArr'); if(!ph||!arr) return;
    const secs=document.getElementById('saSecs'), lanes=document.getElementById('saLanes');
    const body=lanes&&lanes.querySelector('.sa-lane-body'), last=lanes&&lanes.lastElementChild;
    if(!secs||!body||!last) return;
    // Loop plays the selected section, so the line sweeps that section instead of sitting at bar 1.
    const run=mode==='song'?null:dashSelectedRun();
    const bar=mode==='song'?slotIndex:(run?run.start:0);
    const frac=Math.max(0,Math.min(1,(bar+step/STEPS)/dashBars()));
    // In the arrangement's own coordinates (it is the scroll container), so the line scrolls with it.
    const ar=arr.getBoundingClientRect(), bl=body.getBoundingClientRect();
    const top=secs.getBoundingClientRect().top-ar.top+arr.scrollTop;
    const bottom=last.getBoundingClientRect().bottom-ar.top+arr.scrollTop;
    ph.style.left=(bl.left-ar.left+arr.scrollLeft+frac*bl.width)+'px';
    ph.style.top=top+'px'; ph.style.height=Math.max(0,bottom-top)+'px';
  }
```
and add `window.addEventListener('resize',()=>{ try{ updateDashPlayhead(); }catch(e){ console.warn('Aura: playhead resize failed', e); } });` next to the phone-boundary listener.

- [ ] **Step 6: GREEN** `b2Grid` at 1024, 1280, 1440; `loadDemoArrangement` then `b2Grid` and `b2Loop` at 1440; A's `claimsB` C7 passes.
- [ ] **Step 7:** commit.

---

### Task 4: B3 empty lanes; B4 lane name button

**Files:** `rc/app.js`

- [ ] **Step 1:** in `renderDashLanes` replace `if(!show && lane.id!=='atmosphere' && lane.id!=='voice') return;` with `if(!show) return;   // an empty audio lane shows nothing, not a placeholder clip`.
- [ ] **Step 2:** lane name as a button: replace `const nm=document.createElement('span'); nm.className='nm'; nm.textContent=lane.name;` with `const nm=document.createElement('button'); nm.type='button'; nm.className='nm'; nm.textContent=lane.name; nm.setAttribute('aria-label','Select the '+lane.name+' lane');`.
- [ ] **Step 3: redraws.** After `smp.buf=buf; smp.name=file.name; smp.offset=0; smp.end=null; smp.rate=1; smp.on=true;` add `try{ renderStudioArrangement(); }catch(e){ console.warn('Aura: lanes redraw failed', e); }`; after `syncBalance(); showAudioTab(false); });` in the `#smpClear` handler insert the same call before `});`; in `onRecStop` after `updateExportLabel(); syncTakeUI();` add the same; in `clearTake` after `syncTakeUI();` add the same.
- [ ] **Step 4: GREEN** `b3Lanes`, `b4Select`; A's `claimsC` C17 passes.
- [ ] **Step 5:** commit.

---

### Task 5: Release gate, push, prove live

- [ ] Version rc.3 → rc.4 (counts 1 and 13, re-counted right before writing).
- [ ] Full regression locally: A's `layout` at the four widths, `a1` at 1024/1280, `a2NoTouch`, `a2Draw` + reload + `a2Expect`, `a2File`, `a3ApplyUndo`, `a3OtherEdit`, `a3DrawUndo`, `a3PreviewNoLeak`, `claimsA/B/C` (18/18), and all B checks; live shrink with a screenshot.
- [ ] Network law count; remove the preview entry (hash-guarded); commit; `git ls-remote` must be `8b22032`; push; poll live hashes; repeat the gate, the B checks and A's claims on live; post the B proof table.
