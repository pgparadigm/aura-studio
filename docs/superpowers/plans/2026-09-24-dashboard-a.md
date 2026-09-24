# Dashboard sub-project A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reapplied Studio dashboard sound: panels reachable at mid widths, the energy intent saved everywhere a project goes, one honest undo, a preview that cannot leak, and a pass/fail table for every claim in the dashboard notes.

**Architecture:** All changes live in `rc/app.js`, `rc/index.html`, `rc/styles.css` (static app, no build step). The energy intent moves into an early-declared `energyDoc` that `serialize()`/`applyState()` read and the dashboard's `dash` object reaches through getters. Undo reuses the app's single history (`hist`, `pushHistory`, `undo`). Verification is an ES module `qa/dashboard-a.qa.js`, imported into a page served from the worktree on 127.0.0.1:8796, run RED on the unchanged build first, then GREEN.

**Tech Stack:** Vanilla JS in one IIFE (`rc/app.js`), CSS, Web Audio; the Claude app's built-in browser for scripted checks.

**Spec:** `docs/superpowers/specs/2026-09-24-dashboard-a-design.md`

## Global Constraints

- Only writer on `pgparadigm/aura-studio`. Before every push: `git ls-remote origin refs/heads/main` must equal the commit this branch was last synced to. If not, stop and tell Philip; never stack on a moving head.
- Ship gate for every build: fresh load (storage cleared) at 375×812, 1024×768, 1280×800, 1440×900, plus one live shrink 1440 → 375. If `document.documentElement.scrollWidth > innerWidth` at any of them, or the Welcome ✕ is not fully on screen, the commit does not ship.
- The panel close buttons must be proven with a real pointer click (the browser tool's `computer` click by screenshot-frame coordinate), not only a scripted `.click()`.
- Network law: `rc/app.js` keeps exactly one `fetch(`, inside `loadSampleUrl`.
- Phones (≤767 px) keep the classic shell. Guided mode unchanged.
- Out of scope: promoting `/rc/` to root, merging `v13.7-recording-confidence`, the walkthrough, ElevenLabs, the nested-scroll rebuild, comping and punch-in.
- `APP_VERSION` and every `?v=` cache-bust string: `13.8.0-rc.2` → `13.8.0-rc.3`.
- New user-facing copy uses no em dashes.

## Files

- Modify `rc/app.js` — energy store, serialize/applyState/READ_MAP/requiredSchema, share encoder, test hooks, panel buttons, Escape, one undo, preview.
- Modify `rc/index.html` — `#saBar` with `#saSounds`/`#saShape`; version strings.
- Modify `rc/styles.css` — `#saBar` visibility by width, Sounds ✕ at 768–1119 px.
- Create `qa/dashboard-a.qa.js` — test-only checks (never loaded by the app).

## Running a check

Serve the worktree (temporary `aura-rc-fixes-verify` entry in `Projects/.claude/launch.json`, hash-guarded add and remove), open `http://localhost:8796/rc/`, set the viewport, clear storage and reload for a fresh load, then:

```js
const qa = await import('/qa/dashboard-a.qa.js?' + Date.now());
await qa.a1();          // or any other exported check
```

A check returns `{pass, ...evidence}`. A RED run is the same call on the build before the task's change.

---

### Task 1: QA module and the RED baseline

**Files:**
- Create: `qa/dashboard-a.qa.js`

**Interfaces:**
- Produces: `layout()`, `a1()`, `a2Draw(pts)`, `a2Expect()`, `a2File()`, `a2NoTouch()`, `a3ApplyUndo()`, `a3OtherEdit()`, `a3DrawUndo()`, `a3PreviewNoLeak()`, `closeTarget(name)` — each async, returning `{pass, ...}`. They rely on hooks added in Task 3: `__auraSuite.energyState()`, `__auraSuite.shareData()`.

- [ ] **Step 1: Write the module**

```js
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
```

- [ ] **Step 2: RED run on the unchanged build**

Start the preview, set 1280×800, clear storage, reload, import the module and run each check.
Expected on the current build: `a1` FAIL (no `#saSounds`/`#saShape`); `a2Draw` throws or FAILs (no `energyState` hook, no `en`); `a2NoTouch` throws (no hook); `a3ApplyUndo` FAIL or passes only partly (`restoredExactly:false`: the partial restore misses the chord style); `a3OtherEdit` FAIL (`disabled:false`); `a3DrawUndo` FAIL (the canvas stroke is not saved as a history entry: `drew:false`); `a3PreviewNoLeak` FAIL (`savedMxClean:false`). Record each result verbatim.

- [ ] **Step 3: Commit**

```bash
git add qa/dashboard-a.qa.js
git commit -m "qa: dashboard sub-project A checks (test-only module)"
```

---

### Task 2: A1, Sounds and Shape buttons at mid widths

**Files:**
- Modify: `rc/index.html` (inside `#studioArr`, before `#saSecs`)
- Modify: `rc/styles.css` (append after the 67822a6 `768-1399` block)
- Modify: `rc/app.js` (`wireStudioDashboard`, the Escape handler near `closeVibes`)

**Interfaces:**
- Produces: `paintPanelBtns()`; elements `#saBar`, `#saSounds` (`aria-controls="browser"`), `#saShape` (`aria-controls="inspect"`).

- [ ] **Step 1: RED** — run `qa.a1()` at 1024×768 and 1280×800 on the current build. Expected FAIL (`soundsShown:false`, `shapeShown:false`).

- [ ] **Step 2: Markup** — in `rc/index.html`, replace
```html
      <section class="studio-arr" id="studioArr" aria-label="Arrangement" hidden>
        <div class="sa-secs" id="saSecs" role="list" aria-label="Song sections"></div>
```
with
```html
      <section class="studio-arr" id="studioArr" aria-label="Arrangement" hidden>
        <!-- Below 1400 px there is no room for both side panels beside the arrangement, so they slide
             over it. These are their ways in; CSS shows each one only where its panel has no column. -->
        <div class="sa-bar" id="saBar">
          <button type="button" class="ghost sa-panelbtn" id="saSounds" aria-controls="browser" aria-expanded="false">Sounds</button>
          <button type="button" class="ghost sa-panelbtn" id="saShape" aria-controls="inspect" aria-expanded="false">Shape</button>
        </div>
        <div class="sa-secs" id="saSecs" role="list" aria-label="Song sections"></div>
```

- [ ] **Step 3: CSS** — append to `rc/styles.css`:
```css
/* A1. Panel buttons at mid widths. Sounds has no column below 1120 px, Shape none below 1400 px;
   from 1400 px both are columns and the bar hides. Phones never show it (the arrangement is hidden). */
.sa-bar{display:none}
@media (min-width:768px) and (max-width:1399px){
  body.shell:not(.guided) .sa-bar{display:flex;justify-content:flex-end;gap:var(--space-2);flex:0 0 auto;padding:0 0 var(--space-2)}
  body.shell:not(.guided) .sa-panelbtn{min-height:44px;padding:0 var(--space-4)}
  body.shell:not(.guided) .sa-panelbtn[aria-expanded="true"]{border-color:var(--violet-400,#9474B4);color:var(--silver-100)}
}
@media (min-width:1120px){ body.shell:not(.guided) #saSounds{display:none} }
/* Sounds slides over at 768-1119 px, so it carries its own exit there, like Shape does below 1400. */
@media (min-width:768px) and (max-width:1119px){
  body.shell:not(.guided) .browser .rclose{display:inline-flex;align-items:center;justify-content:center;
    margin-left:auto;min-width:44px;min-height:44px;padding:0;font-size:13px;line-height:1}
}
```

- [ ] **Step 4: JS wiring** — in `rc/app.js`, directly before `function wireStudioDashboard(){` add:
```js
  // The Sounds and Shape buttons report their panel's real state, whichever path opened or closed
  // it (the button, a lane click, the ✕, Escape), so they watch the panels rather than trust clicks.
  function paintPanelBtns(){
    const b=document.getElementById('browser'), i=document.getElementById('inspect');
    const s=document.getElementById('saSounds'), h=document.getElementById('saShape');
    if(s&&b) s.setAttribute('aria-expanded',String(b.classList.contains('open')));
    if(h&&i) h.setAttribute('aria-expanded',String(i.classList.contains('open')));
  }
  let panelObs=null;
```
and inside `wireStudioDashboard()`, right after `if(!arr) return;` add:
```js
    const sBtn=document.getElementById('saSounds');
    if(sBtn&&!sBtn.dataset.wired){ sBtn.dataset.wired='1';
      sBtn.addEventListener('click',()=>{ const b=document.getElementById('browser'); if(!b) return;
        if(b.classList.contains('open')) closeVibes(); else openVibes(); }); }
    const shBtn=document.getElementById('saShape');
    if(shBtn&&!shBtn.dataset.wired){ shBtn.dataset.wired='1';
      shBtn.addEventListener('click',()=>{ const i=document.getElementById('inspect'); if(!i) return;
        inspectPinned=true; setInspect(!i.classList.contains('open')); }); }
    if(!panelObs&&window.MutationObserver){ panelObs=new MutationObserver(paintPanelBtns);
      ['browser','inspect'].forEach(id=>{ const el=document.getElementById(id); if(el) panelObs.observe(el,{attributes:true,attributeFilter:['class']}); }); }
    paintPanelBtns();
```

- [ ] **Step 5: Escape closes the Sounds overlay in Studio too** — in `rc/app.js` replace
```js
    if(!guided) return;
    const b=document.getElementById('browser');
    if(b&&b.classList.contains('open')){ closeVibes(); const rc=document.getElementById('readyChange'); if(rc) rc.focus(); }
```
with
```js
    const b=document.getElementById('browser');
    if(!b||!b.classList.contains('open')) return;
    // Guided always floats it; Studio floats it below 1120 px (and on phones). A panel in its own
    // column is not an overlay, so Escape leaves it alone.
    const pos=getComputedStyle(b).position, overlay=pos==='absolute'||pos==='fixed';
    if(!guided&&!overlay) return;
    closeVibes();
    const back=document.getElementById(guided?'readyChange':'saSounds'); if(back&&back.getClientRects().length) back.focus();
```

- [ ] **Step 6: GREEN** — `qa.a1()` at 1024×768 and 1280×800 must PASS; at 1440×900 must PASS with both buttons hidden; at 375×812 `qa.layout()` PASS.

- [ ] **Step 7: Real click** — at 1024×768 and 1280×800 for `shape`, and at 1024×768 for `sounds`: `const t=await qa.closeTarget(name)`; take a screenshot; convert `x = t.cx * frameW / t.innerW`, `y = t.cy * frameH / t.innerH` using the frame size the screenshot reports; `computer left_click` at `(x,y)`; then `qa.isOpen(name)` must be `false`. If the scaled frame will not map, use the viewport preset `desktop` (the pane's own size, no scaling) at whatever width it has and state the width used.

- [ ] **Step 8: Commit**
```bash
git add rc/index.html rc/styles.css rc/app.js
git commit -m "rc: Sounds and Shape buttons below 1400 px; Escape closes the Sounds overlay in Studio"
```

---

### Task 3: A2, the energy intent saved with the project, .aura and share links

**Files:**
- Modify: `rc/app.js` (after `const song=`; `serialize`; `READ_MAP`; `requiredSchema`; `applyState`; `shareLink`; `__auraSuite`; `dash`; `dashEnergyPointer`; Shape slider wiring)

**Interfaces:**
- Produces: `energyDoc {target:number[]|null, params:{[pat]:{intensity,warmth,movement,space}}, touched:boolean, preview:object|null}`; `energyOut()`; `shareData()`; hooks `__auraSuite.energyState()` → `{touched, t:int[]|null, p:object}` and `__auraSuite.shareData()` → string.

- [ ] **Step 1: Early store** — after `const song=new Array(SONG_SLOTS).fill(null);` add:
```js
  // The singer's energy intent: the drawn Target curve (one value per song slot, 0-1) and each
  // section's Intensity/Warmth/Movement/Space. It lives here, beside `song`, because serialize() and
  // applyState() read it and both are defined long before the dashboard that edits it. `touched`
  // stays false until the singer draws, moves a Shape control or applies, so a project that never
  // used energy saves no `en` at all. `preview` is set only while an energy preview is playing.
  const energyDoc={target:null, params:{}, touched:false, preview:null};
  function energyOut(){
    const pct=v=>Math.max(0,Math.min(100,Math.round(+v||0)));
    const t=(energyDoc.target||[]).slice(0,SONG_SLOTS).map(v=>pct((+v||0)*100));
    const p={}; Object.keys(energyDoc.params).forEach(k=>{ const q=energyDoc.params[k];
      if(q) p[k]=[pct(q.intensity),pct(q.warmth),pct(q.movement),pct(q.space)]; });
    return {t,p};
  }
```

- [ ] **Step 2: `dash` reaches the store** — in `const dash = {`, replace
```js
    energyTarget: null,  // Float32-like array length SONG_SLOTS, 0..1
    energyParams: {},    // per section index {intensity,warmth,movement,space}
```
with
```js
    // Both live in energyDoc (declared beside `song`) so they are saved; these keep every
    // dashboard reader and writer unchanged.
    get energyTarget(){ return energyDoc.target; }, set energyTarget(v){ energyDoc.target=v; },
    get energyParams(){ return energyDoc.params; }, set energyParams(v){ energyDoc.params=v; },
```

- [ ] **Step 3: serialize** — replace
```js
      pi:Object.assign({},intention),
```
with
```js
      pi:Object.assign({},intention),
      // `en` is the singer's energy intent from the dashboard. Additive and optional: written only
      // once they have drawn, shaped or applied energy, so an untouched project carries no `en`.
      ...(energyDoc.touched ? { en: energyOut() } : {}),
```

- [ ] **Step 4: READ_MAP and requiredSchema** — replace `gv:'groove', ly:'lyrics', pi:'intention' };` with
```js
    gv:'groove', ly:'lyrics', pi:'intention',
    // Same rule again: without a readable name the drawn energy curve would be written to the file
    // and dropped on reopen.
    en:'energy' };
```
and in `requiredSchema(st)` replace
```js
    return (hasLow||hasVar||hasPerf||hasGroove||hasLyrics||hasIntent) ? 3 : 2;
```
with
```js
    // A drawn energy curve is content a schema-2 reader would drop, so it asks for 3 as well.
    const hasEnergy = !!(st.en && Array.isArray(st.en.t));
    return (hasLow||hasVar||hasPerf||hasGroove||hasLyrics||hasIntent||hasEnergy) ? 3 : 2;
```

- [ ] **Step 5: applyState** — replace
```js
    if(o.mute){ Object.keys(mutes).forEach(k=>delete mutes[k]); Object.assign(mutes,o.mute); }
```
with
```js
    if(o.mute){ Object.keys(mutes).forEach(k=>delete mutes[k]); Object.assign(mutes,o.mute); }
    // `en`. Every caller passes a WHOLE project (autosave, undo, a file, a share link, a recent), so
    // no `en` means untouched: drop any intent and let the curve re-seed from what Aura measures.
    energyDoc.preview=null;
    if(o.en && typeof o.en==='object' && Array.isArray(o.en.t)){
      energyDoc.target=Array.from({length:SONG_SLOTS},(_,i)=> i<o.en.t.length ? Math.max(0,Math.min(1,(+o.en.t[i]||0)/100)) : 0.35);
      energyDoc.params={};
      if(o.en.p && typeof o.en.p==='object') Object.keys(o.en.p).forEach(k=>{ const a=o.en.p[k], pi=+k;
        if(Array.isArray(a) && pi>=0 && pi<N_PATTERNS)
          energyDoc.params[pi]={intensity:+a[0]||0, warmth:+a[1]||0, movement:+a[2]||0, space:+a[3]||0}; });
      energyDoc.touched=true;
    } else { energyDoc.target=null; energyDoc.params={}; energyDoc.touched=false; }
```

- [ ] **Step 6: one share encoder** — replace
```js
  function shareLink(){
    const data=btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))));
```
with
```js
  // The share payload in one place: shareLink() puts it in the address bar, and a test hook reads it,
  // so a test exercises the encoder that ships rather than a copy of it.
  function shareData(){ return btoa(unescape(encodeURIComponent(JSON.stringify(serialize())))); }
  function shareLink(){
    const data=shareData();
```
and in the `__auraSuite` object (the `snapshot()` line followed by `serializedKeys()`; a second `snapshot()` hook exists elsewhere), after `serializedKeys(){ return Object.keys(serialize()); },` add
```js
    shareData(){ return shareData(); },
    energyState(){ return { touched:energyDoc.touched, t:energyDoc.target?energyDoc.target.map(v=>Math.round(v*100)):null,
                            p:JSON.parse(JSON.stringify(energyDoc.params)) }; },
```

- [ ] **Step 7: mark it touched where the singer edits it** — in `dashEnergyPointer`, replace
```js
      dash.energyTarget[bar]=val;
```
with
```js
      dash.energyTarget[bar]=val; energyDoc.touched=true;
```
and delete the line `    if(!dash.energyUndo) dash.energyUndo=dash.energyTarget.slice();`. In the Shape slider wiring, replace
```js
        const p=dashParamsFor(pat); p[key]=+el.value;
```
with
```js
        const p=dashParamsFor(pat); p[key]=+el.value; energyDoc.touched=true;
```
and replace the end of that slider block
```js
          paintDashEnergy();
        }
      });
    });
    // Track param sliders → mix
```
with
```js
          paintDashEnergy();
        }
      });
      el.addEventListener('change',autosave);   // one save and one Undo per slider gesture
    });
    // Track param sliders → mix
```

- [ ] **Step 8: GREEN** — at 1280×800, fresh: `qa.a2NoTouch()` PASS. `qa.a2Draw()` PASS. Reload without clearing storage: `qa.a2Expect()` PASS. `qa.a2File()` PASS. Share: `const u=location.origin+location.pathname+'#p='+__auraSuite.shareData()` and `const want=__auraSuite.energyState().t`; clear localStorage, navigate to `u`, then `qa.a2Expect(want)` PASS. After drawing, `__auraSuite.requiredSchema()` is 3.

- [ ] **Step 9: Commit**
```bash
git add rc/app.js
git commit -m "rc: save the energy curve and section values with the project, .aura files and share links"
```

---

### Task 4: A3, one undo (and the reverb scale)

**Files:**
- Modify: `rc/app.js` (`dash`, `applyEnergyToSection`, `undoEnergy`, `paintDashRail`, after `pushHistory`)

**Interfaces:**
- Consumes: `energyDoc` (Task 3), `hist`, `undo()`, `pushHistory()`.
- Produces: `dashApplyMark`, `dashUndoReady()`, `paintDashUndo()`, `dashSelectedRun()`.

- [ ] **Step 1: RED** — current build: `qa.a3ApplyUndo()`, `qa.a3OtherEdit()`, `qa.a3DrawUndo()`; record results (expected FAIL as listed in Task 1).

- [ ] **Step 2: remove the second undo system** — delete `    energyUndo: null,` from `dash`. Replace the whole `function undoEnergy(){ ... }` with:
```js
  // One-step undo IS the app's Undo, offered only while the newest history entry is the Apply it
  // names. After any other edit it steps aside and Cmd+Z walks the one history there is. The old
  // version kept its own partial snapshot (five channels, reverb, curve), missed the chord style
  // and the voice reverb, and after a drawn stroke held a bare array and reverted nothing.
  let dashApplyMark=null;
  function dashUndoReady(){ return dashApplyMark!==null && hist.last===dashApplyMark; }
  function paintDashUndo(){ const b=document.getElementById('drUndo'); if(!b) return;
    const ok=dashUndoReady(); b.disabled=!ok; b.title=ok?'Undo the last Apply':'Use Undo (Cmd+Z) now'; }
  function undoEnergy(){ if(!dashUndoReady()){ paintDashUndo(); return; } dashApplyMark=null; undo(); paintDashUndo(); }
  function dashSelectedRun(){ const runs=songRuns().filter(r=>r.pat!=null);
    return runs.find(r=>r.start===songSel)||runs.find(r=>r.pat===currentPattern)||runs[0]||null; }
```

- [ ] **Step 3: Apply writes one checkpoint, on the same reverb scale as the slider** — in `applyEnergyToSection`, replace
```js
    const runs=songRuns().filter(r=>r.pat!=null);
    const hit=runs.find(r=>r.start===songSel)||runs.find(r=>r.pat===currentPattern)||runs[0];
```
with `    const hit=dashSelectedRun();`; delete the `// Snapshot for one-step undo` block through `dash.energyUndo = snap;`; inside `oneCheckpoint(()=>{` replace
```js
        reverbWet = 0.08 + space*0.45;
        if(typeof reverbEl!=='undefined' && reverbEl){ reverbEl.value=String(Math.round(reverbWet*100)); }
```
with
```js
        // Same scale as the Reverb slider (wet = value/100 x 0.7), so what is saved is what played.
        const rvPct=Math.max(0,Math.min(100,Math.round((0.08+space*0.45)/0.7*100)));
        reverbEl.value=String(rvPct); reverbWet=rvPct/100*0.7; energyDoc.touched=true;
```
and replace
```js
      syncMixerUI(); renderStudioArrangement();
      toast(previewOnly?'Previewing energy shape':'Energy shape applied — one-step undo available');
```
with
```js
      dashApplyMark=hist.last;   // oneCheckpoint's autosave just pushed this Apply as the newest entry
      applyAllGroupsLive(); syncMixerUI(); renderStudioArrangement(); paintDashUndo();
      toast('Energy shape applied. One-step undo puts it back.');
```

- [ ] **Step 4: keep the button honest** — at the end of `paintDashRail()` add `    paintDashUndo();` (it runs on every restore and arrangement render). For edits that do not re-render, wrap history in the dashboard section, right after the `setMode = function(g){ _setMode(g); applyStudioShell(g); };` line:
```js
  const _pushHistory = pushHistory;
  pushHistory = function(){ _pushHistory(); try{ paintDashUndo(); }catch(e){} };
```

- [ ] **Step 5: GREEN** — `qa.a3ApplyUndo()`, `qa.a3OtherEdit()`, `qa.a3DrawUndo()` PASS at 1280×800 fresh. Also: after Apply, `+__auraSuite.snapshot()` parsed `.rv` equals `Math.round(document.getElementById('reverb').value)` and reload keeps it.

- [ ] **Step 6: Commit**
```bash
git add rc/app.js
git commit -m "rc: one undo for the dashboard; Apply saves reverb on the slider's scale"
```

---

### Task 5: A3, a preview that cannot leak

**Files:**
- Modify: `rc/app.js` (`serialize` `mx`, `applyEnergyToSection` preview branch, `stop` wrapper, `renderStudioArrangement`, `applyStudioShell` guided path, `#drPreview` label)

**Interfaces:**
- Consumes: `energyDoc.preview` (Task 3), `dashSelectedRun()` (Task 4).
- Produces: `dashStartPreview(pat, space, move)`, `dashEndPreview()` → boolean, `paintDashPreviewBtn()`.

- [ ] **Step 1: RED** — current build: `qa.a3PreviewNoLeak()` FAIL (`savedMxClean:false`).

- [ ] **Step 2: serialize reports the remembered chords while previewing** — replace
```js
      mx:GROUPS.map(G=>{ const m=mix[G.id]; return [m.vol,m.pan,m.mute,m.solo,m.lo,m.mid,m.hi,m.rev,m.dly]; }),
```
with
```js
      // While an energy preview plays, the chords channel holds preview values; the project still
      // holds the ones remembered when it started, so an autosave mid-preview cannot keep them.
      mx:GROUPS.map(G=>{ const m=(G.id==='chords'&&energyDoc.preview)?energyDoc.preview.chords:mix[G.id];
        return [m.vol,m.pan,m.mute,m.solo,m.lo,m.mid,m.hi,m.rev,m.dly]; }),
```

- [ ] **Step 3: start and end** — directly after `dashSelectedRun` add:
```js
  // Preview plays the section's energy shape without writing it: the reverb changes only in the
  // audio graph (the Reverb slider, which is what is saved, is not touched) and the chords channel
  // is remembered and put back on Stop, on Preview again, on Apply, or when another section is picked.
  function dashStartPreview(pat, space, move){
    dashEndPreview();
    energyDoc.preview={pat, wet:reverbWet, chords:Object.assign({},mix.chords)};
    reverbWet=0.08+space*0.45;
    mix.chords.rev=Math.round(space*70); mix.chords.dly=Math.round(move*50);
    applyAllGroupsLive(); paintDashPreviewBtn();
  }
  function dashEndPreview(){
    const p=energyDoc.preview; if(!p) return false;
    energyDoc.preview=null;
    reverbWet=p.wet; Object.assign(mix.chords,p.chords);
    applyAllGroupsLive(); syncMixerUI(); paintDashPreviewBtn(); return true;
  }
  function paintDashPreviewBtn(){ const b=document.getElementById('drPreview'); if(!b) return;
    const on=!!energyDoc.preview; b.textContent=on?'Stop preview':'Preview'; b.setAttribute('aria-pressed',String(on)); }
```

- [ ] **Step 4: the Preview branch** — in `applyEnergyToSection`, replace the whole `} else {` preview branch (from `      // Preview: temporarily apply without checkpoint` through `      if(!playing) try{ start(false); }catch(e){}`) with
```js
    } else {
      if(dashEndPreview()){ toast('Preview stopped'); return; }
      dashStartPreview(hit.pat, space, move);
      toast('Previewing. Apply keeps it; Stop or Preview again puts it back.');
      if(!playing) try{ start(false); }catch(e){}
```
and at the top of the `if(!previewOnly){` branch, before `oneCheckpoint(`, add `      dashEndPreview();`.

- [ ] **Step 5: every way out ends it** — after the `_setMode`/`setMode` wrapper lines add:
```js
  const _stopForPreview = stop;
  stop = function(){ _stopForPreview(); try{ dashEndPreview(); }catch(e){} };
```
In `renderStudioArrangement()`, after `if(guided) return;` add
```js
    if(energyDoc.preview){ const r=dashSelectedRun(); if(!r||r.pat!==energyDoc.preview.pat) dashEndPreview(); }
```
In `applyStudioShell`, at the start of the `} else {` (not-shown) branch add `      dashEndPreview();`. In `applyState`, the line `energyDoc.preview=null;` from Task 3 already drops a preview on any whole-project load.

- [ ] **Step 6: GREEN** — `qa.a3PreviewNoLeak()` PASS at 1280×800 fresh; re-run `qa.a3ApplyUndo()` PASS (preview changes did not break Apply).

- [ ] **Step 7: Commit**
```bash
git add rc/app.js
git commit -m "rc: energy preview never reaches the saved project"
```

---

### Task 6: A4, pass/fail on every claim in the dashboard notes

**Files:** none changed unless a claim fails with a layout, save or undo cause (then fix inside this task with its own RED/GREEN and commit).

- [ ] **Step 1: Drive at 1440×900 and 1280×800 (fresh, built-in browser, local build)** and record one row per claim, with the measurement that decides it:

| # | Claim (notes) | How it is decided |
|---|---|---|
| C1 | Studio shows Sounds, Arrangement (sections, energy, lanes), lower editor tabs, Shape rail | elements visible and on screen; 5 editor tabs by label |
| C2 | Guided keeps rail and rooms; dashboard hidden | switch to Guided: `#studioArr` display none, `#rail` and `.wbody` visible |
| C3 | Header: "Saved on this device", Key/Meter/Pos, Loop (on = pattern, off = song) | text present; Loop toggles `#modeSeg` on-button between pattern and song |
| C4 | Version | `APP_VERSION` string in page |
| C5 | Lane or clip selection highlights lane, mixer strips, rail track | `.sa-lane.on`, `#mixer .strip[data-dash-sel]` count per lane, `#drTrackName` text |
| C6 | Warm keys preset → Keys lane, Soft Rhodes (`soul`), Chords strip | after click: `dash.track` lane on = keys, chord style select value `soul`, chords strip selected |
| C7 | Shared playhead moves across energy and lanes | Play 2 s: `#saPlayhead` `left` changes; Stop |
| C8 | Drawable Target vs Measured | stroke changes `energyState().t`; legend shows both |
| C9 | Shape sliders write per-section values; Intensity paints Target over the section's bars | slider → `energyState().p[pat]`; Target bars in the section equal the value |
| C10 | Preserve Voice/Melody locks | with Melody locked, Apply leaves melody `mx` row unchanged; unlocked, it changes |
| C11 | Preview / Apply / One-step undo | covered by `a3*` checks |
| C12 | Apply mappings: Space → reverb and sends, Warmth → chords EQ and style, Movement → delay and hats, Intensity → snare/hat levels and Target | diff of `serialize()` before/after Apply with known slider values |
| C13 | Clip drag to an empty destination | pointer drag of a clip onto empty bars: `song[]` moved |
| C14 | Trailing-edge resize | drag the clip's right edge: run length changes |
| C15 | Double-click opens Piano roll tab, arrangement stays | `#studioETabs .etab[data-ed=piano]` selected and `#studioArr` still shown |
| C16 | Lane Mute/Solo drive mixer | lane M → `mix[id].mute` 1; S → solo 1 |
| C17 | Atmosphere/Voice lanes show content when an import/take exists | load Aura's demo song: Atmosphere lane has a clip |
| C18 | Feel filters, sound search, featured presets (Sounds panel) | filter chip narrows `#featPresets`; search text filters; each preset card plays or applies |

- [ ] **Step 2:** Post the table in chat with PASS/FAIL and the evidence per row. Failures not caused by layout, save or undo go to B–E, named in the row.

---

### Task 7: Release gate, commit, push, prove live

- [ ] **Step 1: version** — in `rc/app.js` and `rc/index.html` replace every `13.8.0-rc.2` with `13.8.0-rc.3` (Python, asserting the counts 1 in `app.js` and 13 in `index.html`, re-counted with `grep -c` immediately before writing).

- [ ] **Step 2: gate, local** — fresh load at 375×812, 1024×768, 1280×800, 1440×900: `qa.layout()` PASS at each; then load at 1440×900, Skip, set 375×812 without reloading: `document.documentElement.scrollWidth <= innerWidth`, both panels closed. Any FAIL stops the release.

- [ ] **Step 3: network law** — `/usr/bin/grep -o "fetch(" rc/app.js | wc -l` is 1, and it sits in `loadSampleUrl`.

- [ ] **Step 4: remove the preview entry** from `launch.json` (hash-guarded) and stop port 8796.

- [ ] **Step 5: commit** the version bump and any Task 6 fixes; `git status` clean.

- [ ] **Step 6: moving-head check** — `git ls-remote origin refs/heads/main` must print `67822a68c7ed8b1bded6308bc9e24244f9073e39`. Otherwise STOP and tell Philip.

- [ ] **Step 7: push** — `git push origin HEAD:main`; `git ls-remote` shows the new head.

- [ ] **Step 8: live proof** — poll `/rc/app.js`, `styles.css`, `index.html` SHA-256 until they match local; then on live, fresh at 375, 1024, 1280, 1440 `layout()` equivalents, the live shrink, `a1` at 1280, and `a2Draw` + reload + `a2Expect` on live. Post the A proof table in chat.
