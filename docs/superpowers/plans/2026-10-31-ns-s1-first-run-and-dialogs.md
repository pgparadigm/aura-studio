# S1 — first run and dialogs (13.8.0-rc.17) — task plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.
> One test at a time: write it, run it on the current build in both engines, see it fail for the stated reason,
> then write only the code that makes it pass.

**Goal:** a first visit opens no dialog: the demo project loads in Studio and a dismissible four-step tour starts;
returning visitors open their last project; the Welcome moves to the menus; the Welcome and the Create sheet close
with Esc from anywhere, a backdrop click and an X, hold Tab inside, and give focus back.

**Architecture:** `rc/app.js` boot decides first visit (`aura-seen` absent) before anything else reads it; the
Welcome stops opening itself and gets `openWelcome()`; the tour is a non-blocking coach mark (`#auraTour` card +
`#auraTourRing`), anchored per width to what is on screen. The test runner treats every existing job as a returning
visitor so their starting project is unchanged.

**Spec:** `docs/superpowers/plans/2026-10-25-aura-north-star.md` (S1) and
`docs/superpowers/specs/2026-10-25-north-star-design.md` (decision 6).

## Global constraints

- `rc/` and `qa/` only; root files untouched. Export graph, saved state and the default export unchanged against
  f304607 (the release gate). Tests at 1440×900, 1280×800, 390×844 in Chromium and WebKit.
- New copy in plain words, no em-dashes.

## What was measured before writing this (rc.16, headless WebKit, 2026-10-31)

- In Studio, neither `#pathCreate` nor `#createOpen` is visible at 390, 1280 or 1440; the Create sheet is reached
  through the Welcome's "create" door and the Guide's "Answer four questions instead".
- A first-time visitor lands in **Guided** today (`aura-mode` unset); the Welcome's demo door switches to Studio.
- Tour anchors that exist per width (demo loaded, Studio): 1440 — `#browser`, `#studioArr`, `#studioEdHost #mixer`,
  the Aura guidance block in the rail (below the rail's fold until scrolled); 1280 — `#browser` (a column),
  `#studioArr`, `#mixer`, `#saShape`; 390 — the bottom bar (`#tgBrowser` "Vibes", `.wtab[data-v="play"]` "Song",
  `#mMore` (Balance is a row in its sheet), `#askOpen` "Ask"); no arrangement or mixer on the phone's first screen.
- The gate jobs `layout@*` and `shrink1440to375` read `#wClose` on a fresh load because the Welcome used to open.
- Overlay stacking: Ask Aura 60–61, Welcome 80, menus 83, dialogs 90–92. The tour sits at 70–71.

### Task 1: the runner treats jobs as returning visitors (no app change)

**Files:** `qa/run.cjs`, `qa/dashboard-a.qa.js` (`layout`), new `qa/dashboard-n.qa.js`, new `qa/dashboard-n.jobs.cjs`.

- [ ] In `runJob`, after `newContext`: unless `j.firstRun`, an init script sets `aura-seen=1` and, if unset,
  `aura-mode=studio` — the state a Skip on the Welcome left, which every existing job reached by `skipWelcome()`.
- [ ] Gate jobs `layout@*` and `shrink1440to375` get `firstRun: true`; `layout()` and the `shrinkTo` step open the
  Welcome through `__auraSuite.openWelcome()` when it is not already open (a no-op on rc.16, where it opens itself).
- [ ] Load `qa/dashboard-n.jobs.cjs` the way `dashboard-e.jobs.cjs` is loaded. First check:

```js
export async function n0DefaultIsReturning() { await settle(300);
  const seen = localStorage.getItem('aura-seen'), mode = document.body.classList.contains('guided') ? 'guided' : 'studio';
  return { pass: seen === '1' && mode === 'studio' && !welcomeOpen(), seen, mode, welcome: welcomeOpen() }; }
```

- [ ] **Prove it changes nothing:** the full regression on rc.16 with this runner: Chromium 177/177 and WebKit
  176/177 + `e12RealRecord` NOT RUN, as on 2026-10-20, plus `n0DefaultIsReturning` passing. Any other change in a
  result is a finding to explain before going on.
- [ ] Commit.

### Found by Task 1's proof (2026-10-31): a real rc.16 bug, fixed first

Task 1's regression did NOT come back unchanged: in both engines `claimsC` (3/6), `b1Drag`, `b1NoOp`, `b1Cancel`,
`b1Resize` and `b4Select` failed from a returning-visitor start. Probe (both engines): the project was byte-identical
to fresh load + Skip, but **a page that loaded straight into Studio drew no clips in any lane** (drums, bass, keys,
texture all 0; 1 each after a forced redraw), and **picking a vibe in Studio left the lanes showing the old vibe**
(Texture 0 drawn, 1 after a redraw). A saved project reopened in Studio drew correctly. **Cause:** `applyVibe`
changes the beat, chords and sounds without redrawing the Studio arrangement; the fresh groove is a vibe applied
after the first draw. **Fix:** `applyVibe` redraws the arrangement (Studio only). **Checks:** `n1ArrangementAtLoad`,
`n1ArrangementAfterVibe` (from the demo arrangement, and requiring the drawing to change) at 1440 and 1280: red on
rc.16 in both engines, green after; a mutant without the redraw fails 8/8. Harness: the microphone browser gets a
warm-up and a started audio clock (its first job once saw a clock stuck at 0 in a full run; alone it passed twice);
the `n` suite joins the default run.

### Task 2…: the S1 checks, one at a time (each: write, red on rc.16 for the stated reason, code, green)

Shared helpers at the top of `qa/dashboard-n.qa.js`: `settle` from `dashboard-a`, `shown(el)` (rendered and on
screen), `key(k, {target, shiftKey})` (a keydown that bubbles), `welcomeOpen()`, `createOpen()`, `focusables(box)`
(the same selector as the app's `trapTab`), `idOf(el)`, and `ensureWelcome()` (already open, or `openWelcome()`).

| # | Check (job) | Asserts | Red on rc.16 because | Code that makes it pass |
|---|---|---|---|---|
| 2 | `n1FirstRunNoDialog` (firstRun) | no `.welcome.on`, `.modal`, `.msheet` open; `#app` not inert, no `aria-hidden` | the Welcome opens itself | boot: no auto-open in `wireWelcome` |
| 3 | `n1FirstRunDemo` (firstRun) | project "Aura Demo", song `0,1,1,2,2,1,2,2`, Studio | an untitled Guided project | boot: `firstVisit` (no `aura-seen`) and nothing restored → `setMode(false); loadDemo()`; `aura-seen` stored at once |
| 4 | `n1TourSteps` (firstRun) | `#auraTour` shown; 4 steps in order sounds, arrangement, mixer, guidance; each ring within 8 px of a visible anchor; card on screen and below the top bar; last button "Done" | no tour | `TOUR`, `showTourStep`, `placeTour`, `startTour`; `id="drGuideBlock"` on the rail's Aura guidance block |
| 5 | `n1TourDismiss` → reload → `n1TourGone` (firstRun) | X closes it, `aura-tour-done=1`; after reload no tour, no Welcome, still "Aura Demo" | no tour | `endTour`; the next load is a returning visit |
| 6 | `n1TourEsc` (firstRun) | Esc on the page closes it and stores done | no tour | Esc listener (ignored while a modal is open) |
| 7 | `n1ToolbarClickable` (firstRun) | every visible top-bar control hit-tests to itself while the tour is up, and after Esc | the Welcome covers the toolbar | the tour has no backdrop and never covers the top bar |
| 8 | `n1ReturningOpensLast`: `n1Mark` → reload → `n1SameProject` | the tempo set before the reload is back; no Welcome, no tour | **passes today (guard)** | — |
| 9 | `n1MenuOpensWelcome` | "Start something new…" in the Project menu (or the ⋯ sheet on a phone) opens the Welcome with focus inside | no such item | menu item + sheet row calling `openWelcome()` |
| 10 | `n1WelcomeEscAnywhere` (firstRun) | with focus on the page, Esc closes the Welcome and `#app` is usable | Esc only listened on the dialog | document-level Esc |
| 11 | `n1WelcomeBackdrop` (firstRun) | a click on the card's title keeps it open; a click on the backdrop closes it | backdrop ignored | `e.target === w` closes |
| 12 | `n1CreateHasX` | a visible button named "Close…" in the Create sheet closes it | no X | `#crClose` |
| 13 | `n1CreateTabHeld` | Tab on the last control lands on the first; Shift+Tab on the first lands on the last | no trap | `trapTab` on the sheet |
| 14 | `n1CreateEscAnywhere` | with focus on the page, Esc closes it | Esc only listened on the sheet | document-level Esc |
| 15 | `n1CreateFocusBack` | focus on the Project (or ⋯) button, open, Esc: focus is back on that button | focus falls to `<body>` | `openCreate(opener)` remembers; `closeCreate` clears inert, then `refocus` |

Every check runs as `<id>@1440`, `@1280`, `@390` (390×844).

### Code (the shapes; exact edits made with targeted replacements)

```js
// boot, after setMode(...):
let firstVisit=false; try{ firstVisit=localStorage.getItem('aura-seen')===null; }catch(e){}
const restored=loadFromHashOrStorage(); if(!restored){ seedSong(); applyVibe('moody'); }
voxBoot(bootSource, bootLink, bootPrev);
if(firstVisit){ if(!restored){ setMode(false); loadDemo(); } try{ localStorage.setItem('aura-seen','1'); }catch(e){} }
// … end of boot, after histBaseline:
if(firstVisit) setTimeout(startTour, 300);

function openWelcome(){ const w=document.getElementById('welcome'); if(!w||w.classList.contains('on')) return;
  renderWelcomeRecents(); wPrevFocus=document.activeElement; w.classList.add('on'); setWelcomeInert(true);
  const first=w.querySelector('.wopt'); if(first) first.focus(); }
function closeWelcome(){ /* … */ setWelcomeInert(false); refocus(wPrevFocus); wPrevFocus=null; /* … */ }

let crPrevFocus=null;
function openCreate(opener){ /* … */ crPrevFocus=(opener&&opener.nodeType===1)?opener:document.activeElement; /* … */ }
function closeCreate(){ const w=…; if(!w||!w.classList.contains('on')) return; w.classList.remove('on');
  setWelcomeInert(!!document.querySelector('.welcome.on')); const back=crPrevFocus; crPrevFocus=null; refocus(back); }
```

The tour: `TOUR` = four `{key, title, text, at:[selectors]}`; `tourAnchor` takes the first candidate that is
rendered, scrolls it into view and is on screen; `placeTour` tries below, above, right, left of it (never over the top
bar, never off screen), else bottom centre; the ring is the anchor's box grown by 4 px. No backdrop; Esc (when no
modal is open), the X and Done end it and store `aura-tour-done`.

### Last tasks

- [ ] Mutants (each must turn at least one S1 check red): the Welcome opens itself again; `firstVisit` ignored;
  the Create sheet's trap removed; `closeCreate` without `refocus`; the tour covering the top bar.
- [ ] Full regression from a snapshot, zero failures; the release gate; before/after screenshots to `qa/screens/`;
  `docs/CHANGELOG.md`; commit. **Push only after Philip's typed go.**

**Not proven by these checks:** that a beginner understands the tour; real Safari's focus behaviour (it only tabs to
buttons with "Press Tab to highlight each item" on); the tour's look against the mockup (S5 onward restyle it).
