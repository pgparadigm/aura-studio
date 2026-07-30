# Regression log

## v13.2.0 — import & rebuild (2026-07-30)

Ran on the working tree at the release candidate, in the Browser pane against a local
`python3 -m http.server`. Every number below came from a suite that drives the **shipped** runtime.

### fixtures/import-qa.html — 19 generated fixtures, seeded PRNG, no commercial audio

| gate | threshold | measured | verdict |
|---|---|---|---|
| onset timing F at ±35 ms | ≥ 0.85 | **0.9091** (P 0.8352, R 0.9973) | met |
| lane recall over separable lanes | ≥ 0.75 | **0.8649** (160/185 steps) | met |
| confident mislabel rate on ambiguous voices | ≤ 0.10 | **0.0000** (0 of 44) | met |
| soft vs loud invariance | identical | **identical** | met |
| every fixture passing | all | 15/19 | **not met** |

Exact lanes on `elec-pop`, `acoustic-kit`, `rimshot`, `shaker-16ths`, `sparse-rnb`, `dyn-soft`,
`dyn-loud`. `dyn-soft` and `dyn-loud` carry the same pattern at 0.28 and 0.97 peak and produce a
bit-identical grid.

Four fixtures fail on a stated limitation, not on a surprise:

- `k808-driven` — lane recall 0.615. A saturated 808 pushes so much harmonic energy into 180–450 Hz
  that the sub/body ratio collapses to ~1.15; the sub-tail test recovers the kick but not every step.
- `mixed-harmony` — timing F 0.744, lane recall 0.667. Drums under a sustained pad and a walking bass.
  Harmony note starts are excused from the precision count (detecting a bass note is not an error, it
  is simply not a drum); what remains is genuine over-detection on dense material.
- `sections` — timing F 0.700, same cause across a 58-second four-part arrangement.
- `harmony-only` — key read as B♭ minor where the fixture is E♭ minor: the dominant, a real confusion.
  It correctly writes **no** percussion, which is that fixture's actual gate.

Tempo lands on a simple metrical relative of the truth on four fixtures (140 → 93.8, 146 → 98.5,
100 → 67.3 — every one of them exactly two thirds). Autocorrelation genuinely cannot separate these
when a pattern fills every sixteenth. They are scored as passes **only because** the true reading is
offered as a one-tap alternate; the ratio is always reported rather than hidden.

Slowest analysis: 651 ms for a 58-second file. Nothing in the suite touches the network.

### fixtures/apply-safety.html — 21/21 against the real runtime

Replace leaves no prior lane, step or accent and is idempotent; one undo restores the previous
pattern exactly. Fill Empty clears nothing. One Apply is one undo checkpoint for all of *Apply these
drums*, *Apply these parts* and *Apply the key and chords*. Discard leaves the stored project
byte-identical and creates no checkpoint. Preview edits — lane reassignment, chord change, boundary
drag — produce zero state change. `serialize()` still returns exactly 25 keys with no analysis field,
and storage holds no media bytes. `#bpm` and `#swing` are still `<input>`s with numeric values,
`#navExport` exists, and every id the scheduler reads inside its loop is present.

Undo depth is measured by watching writes to the save key, because `hist` is unreachable — app.js is
one IIFE with no globals. The 4-second autosave timer cannot be suppressed and rewrites a
byte-identical string, proven by observing a write on a completely idle page; the verified claim is
therefore **zero state change and zero history growth**, not "zero writes".

### Schema

`python3 fixtures/validate.py` 12/12. `python3 fixtures/validate.py RT-schema-final.aura` PASS.
`SCHEMA_VERSION` 2 and the 25 `serialize()` keys are unchanged, so every existing `.aura` still opens.

### Not run — no hardware or environment for it

Safari, iOS Safari, Android Chrome, physical touch, screen readers, and a real user's own recording
of a commercial track. Desktop was checked at 1280×860 and the phone layout at 678×814 in the
Browser pane; that is an emulated viewport, not a device.


# Aura Studio — Pre-Redesign Audit (Phase 1)

> Scope: the **working tree v10** at `/Users/Pouya/Documents/Claude/Projects/aura-studio/index.html` (1073 lines — inline `<style>` 8–166, DOM 168–349, one IIFE 351–1070), cross-checked against the **deployed v9** at `/Users/Pouya/Documents/Claude/Projects/aura-studio/backups/index.v9-live.html` (891 lines). Every line number below refers to the v10 working tree. This document is the regression contract for every later phase of the redesign.
>
> **Start from the working tree, not the live site.** The entire mixer (state, UI, channel strips, delay line, FX panel, `mx`/`fx` save fields, vocal routing) exists only in v10 and has never shipped. A redesign that begins from the deployed v9 silently drops all of it.

---

## 1. What the app is

Aura Studio is a **single-file, offline-capable browser DAW** for making reggaetón/Latin/soul backing tracks to sing over. One HTML file, no build step, no dependencies, no network calls, no image assets (the logo is a CSS conic-gradient). Everything — synthesis, sequencing, mixing, recording, WAV encoding, persistence — happens in one IIFE with no globals; nothing in the app is reachable from the DevTools console. The musical surface is a 16-step drum + chord-degree grid across 6 sections, a 3-octave piano roll for melody, a 32-bar song arranger, a 7-channel mixer with global FX, and a vocal recorder that mixes the take into the exported WAV.

Its defining design bet is **musical guardrails over musical freedom**: chords are stored as *scale degrees*, never absolute pitches, so changing key or mode re-harmonizes everything instantly and nothing can sound wrong; the piano roll snaps to the current scale by default; 12 one-tap "vibes" set key, mode, progression, beat, tempo, swing, reverb and all three voice selections at once. Playback is fully deterministic — `drumVel` uses a seeded integer wobble, never `Math.random` — so the offline export is bit-reproducible and matches what the user heard. Persistence is invisible: a 4-second autosave interval plus ~30 explicit save calls write one JSON blob to `localStorage['aura-studio-v6']`, and the same payload base64-encoded into a `#p=` URL fragment is the entire sharing mechanism.

---

## 2. Feature inventory

### 2.1 Transport & timing

| Control | id / selector | Range · default | Handler | Persisted | Notes |
|---|---|---|---|---|---|
| Tempo | `#bpm` + `#bpmVal` | 60–160 · **92** | L1039 — updates readout **only** | `bpm` (Tier B) | No tempo variable. `secondsPerStep()` (L598) and `exportWav` (L622) read `+bpmEl.value` live |
| Swing | `#swing` | 0–60 · **14** | **No listener at all** | `sw` (Tier B) | Read live at L602 (live) and L630 (export): odd steps only, `+= sps*(swing/100)*0.9` |
| Master vol | `#master` | 0–100 · **80** | L1040 → `liveMaster.gain.value` | `mv` (Tier B) | Also baked into export via `buildBusses(off, +masterEl.value/100)` |
| Play / Stop | `#play` | — | L1056 `playing?stop():start(false)` | no | Label `▶ Play` ⇄ `■ Stop`, class `.on`, `min-width:96px` |
| Space | `window` keydown L1064 | — | Toggles play; guards only `INPUT`/`SELECT` | no | The **only** keyboard shortcut in the app |
| Count-in | `#countin` | checkbox · **checked** | No listener | `ci` (Tier B) | 4 clicks at `sps*4`; shifts `musicZeroTime` by 4 beats |
| Mode segment | `#modeSeg` | Loop / Song · Loop | L1055 | **not persisted** | `if(playing){step=0;slotIndex=0}` — repositions without stopping |
| Scheduler | — | `LOOKAHEAD=.1`, `INTERVAL=25 ms` | L596–602 | — | `setTimeout` lookahead loop; playhead painted by wall-clock `setTimeout` aligned to audio time |

Timing constants: `secondsPerStep = (60/bpm)/4`. At 92 BPM = **0.16304348 s**/step, bar = **2.6086957 s**. Swing at 14/92 BPM = **0.0205435 s** offset on odd steps. `start()` pre-roll = **+0.12 s**.

### 2.2 Sequencer (grid)

| Element | Detail |
|---|---|
| Rows | 6 drums (`kick, snare, clap, hat, openhat, shaker`) + `tr.divider` ("Chords (sing over these)") + 7 chord degrees (`deg0`…`deg6`) |
| Columns | **21 per row**: label + volume + 16 steps + 3 `td.beatgap` (before steps 4, 8, 12) |
| Cell | `.cell` 34×34, `border-spacing:6px`, un-reset UA `td{padding:1px}` → step pitch **42px** in-beat, **56px** across a beat boundary |
| Table width | natural **1016px**, min **998px**; `.grid-wrap{overflow-x:auto}` is the only mobile containment |
| Left-click cell | Toggle step; turning a drum OFF clears its accent; turning ON auditions (drums `playDrum`, chords `playChord` + `playBass` at dur 0.7) — autosaves |
| Right-click cell | **Drums only** — force step on, toggle accent, audition at vel 1.15 / 0.9 — autosaves |
| Row-label click | Mute. Key = drum id, or the single shared key `'chords'` for all 7 chord rows — autosaves |
| Track vol sliders | `.track-vol` ×6, 0–100, defaults kick 95 / snare 70 / clap 50 / hat 40 / openhat 35 / shaker 42; writes `BUS_VOL[id]` + `liveBus[id].gain` |
| Sections | `#patBar` 6 buttons; `.on` = current, `.has` = has content (purple inset underline) |
| Beat presets | `#preset`, 14 options incl. `keep` sentinel; wipes all 6 drum **and** 6 accent rows of the current pattern, then self-resets to `keep` |
| Clear section | `#clear` — wipes 13 step arrays + melody + 6 accent arrays of current section. No confirm, no undo |
| Copy → next | `#copy` — copies steps (`.slice()`), melody (`.map(n=>({...n}))`), accents to `(cur+1)%6` and navigates there. Overwrites silently; wraps 6→1 |
| Auto-fill | `#autofill` checkbox, **checked**, `change`→autosave |

**BEATS presets, exact step arrays (0-indexed):**

| Preset | kick | snare | clap | hat | openhat | shaker |
|---|---|---|---|---|---|---|
| dembow | 0,4,8,12 | 3,6,11,14 | — | 0,2,4,6,8,10,12,14 | — | 2,6,10,14 |
| reggaeton | 0,4,8,12 | 3,6,11,14 | — | — | 7,15 | 0,2,4,6,8,10,12,14 |
| reggaetonpop | 0,4,8,12 | 3,6,11,14 | 3,11 | all 16 | — | 2,6,10,14 |
| pop | 0,8 | 4,12 | — | 0,2,4,6,8,10,12,14 | — | — |
| lofi | 0,10 | 4,12 | 4,12 | 2,6,10,14 | — | 0,4,8,12 |
| rnb | 0,7,10 | 4,12 | — | 0,3,4,7,8,11,12,15 | — | — |
| trap | 0,7,10 | 4,12 | — | all 16 | — | — |
| boombap | 0,6,10 | 4,12 | — | 0,2,4,6,8,10,12,14 | — | — |
| sparse808 | 0,8 | — | 4,12 | — | 7,15 | — |
| heartbeat | 0,4,8,12 | — | — | — | — | 2,6,10,14 |
| gospelpulse | 0 | — | 8 | — | — | — |
| fill | 0 | 6,8,10,11,12,13,14,15 | 15 | — | — | 0,2,4,6,8,10,12,14 |
| empty | — | — | — | — | — | — |

The dembow snare `[3,6,11,14]` is the 3-3-2 tresillo — the genre signature.

### 2.3 Harmony & scale

| Item | Detail |
|---|---|
| `SCALES` | 5 modes × 3 index-aligned arrays `{steps, quals, romans}` (L358–365) |
| major | steps `[0,2,4,5,7,9,11]` · quals `maj,min,min,maj,maj,min,dim` · `I ii iii IV V vi vii°` |
| minor | `[0,2,3,5,7,8,10]` · `min,dim,maj,min,min,maj,maj` · `i ii° III iv v VI VII` |
| dorian | `[0,2,3,5,7,9,10]` · `min,min,maj,maj,min,dim,maj` · `i ii III IV v vi° VII` |
| phrygian | `[0,1,3,5,7,8,10]` · `min,maj,maj,min,dim,maj,min` · `i ♭II ♭III iv v° ♭VI ♭vii` |
| harmonicMinor | `[0,2,3,5,7,8,11]` · `min,dim,maj,min,maj,maj,dim` · `i ii° III iv V VI vii°` — **hand-authored, not textbook**: III voiced maj (gospel practice), V maj so the soul 7th makes a true V7 |
| `chordRootMidi(deg)` | `60 + keyRoot + steps[deg]` — always root position, one fixed octave, no inversions |
| `chordName(deg)` | `NOTE_NAMES[(keyRoot+steps[deg])%12]` + `m`/`°`/`+`/`''`. **Sharps only** — no flat spellings anywhere |
| Triads | maj `[0,4,7]` · min `[0,3,7]` · aug `[0,4,8]` · **fallback dim `[0,3,6]`** |
| Diatonic 7th | Fires **only** when `chordStyle==='soul'`. `off = ((st[(deg+6)%7]-st[deg])%12+12)%12; if(off<9) off+=12` |
| 7th interval table | major `11,10,10,11,10,10,10` · minor `10,10,11,10,10,11,10` · dorian `10,10,11,10,10,10,11` · phrygian `10,11,10,10,10,11,10` · harmonicMinor `11,10,11,10,10,11,**9**` |
| Key root | `#keyRoot`, populated at runtime from `NOTE_NAMES`, values `'0'`…`'11'`, default `'0'`. Change → `relabelChords()` + `transposeMelody(delta)` |
| Key mode | `#keyMode`, 5 options whose `value` strings **are** the SCALES keys. Change → `relabelChords()` + `resnapMelodies()` |
| Chord sound | `#chordStyle`: `pad` (default) / `piano` / `soul` / `pluck`. Change auditions degree 0 for 0.9 s |
| Bass style | `#bassStyle`: `sub` (default) / `808`. Change auditions root for 0.5 s |
| Chord vol / Bass vol | `#chordVol` 0–100 ·55, `#bassVol` 0–100 ·62 |
| Reverb (global wet) | `#reverb` 0–100 ·30 → `reverbWet = v/100*0.7` (span 0–0.7) |

**PROGS (degree arrays, placed at steps 0/4/8/12):** `pop [0,4,5,3]` · `ballad [0,5,3,4]` · `emotional [5,3,0,4]` · `simple [0,3,4,3]` · `doowop [0,5,1,4]` · `soulful [0,6,3,4]` · `phrygian [0,5,1,0]` · `lockdown [0,3,0,3]` · `ultralight [0,2,5,4]` · `soulflip [0,6,5,6]`.

**The `#prog` dropdown exposes only 6 entries** (`keep`, pop, ballad, emotional, simple, doowop, clearchords). `soulful`, `phrygian`, `lockdown`, `ultralight`, `soulflip` are reachable **only via vibes**. Dropdown labels are written in major-mode romans ("Emotional · vi–IV–I–V") but 9 of 12 vibes are minor, where the same degrees read VI–iv–i–v — the labels are decorative text, not derived.

### 2.4 Piano roll

| Item | Detail |
|---|---|
| Range | `PR_LO=48` (C3) … `PR_HI=83` (B5) — **36 rows, 3 octaves** |
| Geometry | `PR_CW=34` px/step, `PR_RH=13` px/semitone; grid **544×468px**; `.prwrap` 590px; keys gutter 46px sticky |
| Initial scroll | `scrollTop = (83−72)*13−60 = **83px**` |
| Note object | `{p:midi, s:step, l:lengthSteps, v:velocity}`, per section |
| Draw | mousedown on empty → new note `{p:snapScale(...), s, l:min(prLastLen,16−s), v:0.85}` + preview, enters resize drag |
| Move / resize | window mousemove; resize zone = right **8px** of the note; `moved` threshold 4px |
| Click-to-delete | mouseup with `mode==='move' && !moved && !added` → splice |
| `prLastLen` | sticky, initial 2, set on mouseup; **not persisted** |
| Right-click note | velocity cycle `n.v<0.75?0.85 : n.v<1?1.1 : 0.6` → visual tiers `v1` (.55) / `v2` (.8) / `v3` (1 + glow) |
| Stay in key | `#scaleLock`, **checked**, no listener, **not persisted**; gates `snapScale` on draw/drag only |
| `nearestInScale` | searches d=1..6, **downward first** at each distance, clamped to `[PR_LO,PR_HI]` |
| Melody sound | `#melSound`: `lead` (default) / `pluck` / `keys` / `pad` / `bell` / `b808`; change previews A4 |
| Melody vol | `#melVol` 0–100 ·55 → `BUS_VOL.melody` + `liveBus.melody.gain` |
| Melody mute | `#melMute` → `mutes.melody`, `.prmute.on` pink |
| Clear melody | `#melClear` → `P().melody=[]` |
| Row shading | `.prow.root` (tonic, gold 10%) and `.prow.inscale` (purple 7%) are mutually exclusive; key labels use **absolute** pitch (C rows get `.oct` + octave number) |

Pixel↔music formulas: `left = s*34+1` · `top = (83−p)*13+1` · `width = l*34−3` · `s = clamp(floor(x/34),0,15)` · `p = snapScale(clamp(83−floor(y/13),48,83))`.

### 2.5 Song arrangement

| Item | Detail |
|---|---|
| `song[]` | 32 slots, each `null` or pattern index 0–5 |
| Slot click | cycles `null→0→1→2→3→4→5→null`; displays 1-based |
| Slot size | 40×46px; 6 section colours as `inset 0 -4px 0`: `.p1 #7c5cff .p2 #38e1ff .p3 #3ee6a0 .p4 #ff5c8a .p5 #ffb14e .p6 #ffce54` |
| `seedSong()` | fills bars 1–8 with pattern 0, **cold start only** |
| `songUsedLen()` | last non-null index + 1; interior nulls are real silent bars; trailing gaps ignored |
| Loop wrap | `slotIndex=(slotIndex+1)%(songUsedLen()||SONG_SLOTS)` — the `||` prevents modulo-by-zero |
| Auto-fill | `fillForBar(list,i,wrap)`: false if unchecked or `list[i]==null`; else `list[wrap?(i+1)%len:i+1] !== cur` |
| Fill build | `inBuild = fill && s>=13 && !mutes.snare`. Suppresses snare/hat/openhat/shaker on steps 13–15; plays rising snare `[0.78,0.95,1.12][s-13]` + one open hat at 0.5 on step 15. Kick and clap still play |
| Live vs export | live `wrap=true` (fill fires at the loop point); export `wrap=false` (the **last bar always fills**) |

### 2.6 Mixer — **v10 only, never shipped**

`GROUPS` (ordered, L388–396): `kick` [kick] · `snare` [snare,clap] "+ Clap" · `hats` [hat,openhat,shaker] "+ Perc" · `bass` [bass] · `chords` [chords] · `melody` [melody] · `vocals` [] (fed directly by the take).

| Per-strip control | Range · default | Applied as |
|---|---|---|
| Fader | 0–140 · **100** | `groupGain(id)` = 0 if muted, 0 if any solo and not soloed, else `vol/100*PAN_COMP` (`PAN_COMP=Math.SQRT2`) |
| Pan | −100…100 · **0** | `pan.pan.value = pan/100`; readout `C` / `L##` / `R##` |
| EQ Lo/Mid/Hi | −12…+12 dB · **0** | lowshelf 200 Hz · peaking 1200 Hz Q0.9 · highshelf 4000 Hz |
| Reverb send | 0–100 · **0** | `groupRev(id) = REV_BASE[id]*reverbWet + (rev/100)*0.6` |
| Delay send | 0–100 · **0** | `dly/100*0.6` |
| M / S | 0\|1 | `.mb.on` pink / `.sb.on` amber; `refreshStripDim` → `.silenced` opacity .45 |

`REV_BASE = {kick:0, snare:0.14, hats:0.06, bass:0, chords:0.32, melody:0.22, vocals:0.12}`.

**Every default is an exact audio no-op** — vol 100 × √2 exactly cancels the StereoPanner's 0.7071 equal-power centre, so inserting the mixer left pre-v10 tracks bit-identical.

Global FX row (v10 only):

| Control | Range · default | Mapping | Label at default |
|---|---|---|---|
| `#fxRevSize` | 0–100 · **50** | `irRT60()=0.6+size/100*2.4` (0.6–3.0 s); `irSeconds()=max(1.2, irRT60()*(2.2/1.8))` | `1.8 s` |
| `#fxDlyTime` | 60–700 ms · **280** | `dly.delayTime = ms/1000` | `280 ms` |
| `#fxDlyFb` | 0–70 · **32** | `dlyFb.gain = v/100` | `32%` |
| `#fxComp` | 0–100 · **40** | `compThreshold()=-6-(c/100)*22.5`; `compRatio()=1.2+(c/100)*3.25` | `2.5:1` |

`comp 40` reproduces v9's hardcoded −15 dB / 2.5:1 exactly; `revSize 50` reproduces v9's 2.2 s / 1.8 s IR exactly. `#fxRevSize` splits across two events: `input` updates labels only, `change` rebuilds the convolver IR (avoids allocating ~776 KB per drag frame).

`#mixReset` restores all 7 groups to `mixDefault()` + fx to 280/32/50/40, rebuilds glue and IR, `applyAllGroupsLive(); syncMixerUI(); autosave();` + toast "Mixer reset to flat". No confirmation.

### 2.7 Vocals

| Item | Detail |
|---|---|
| Mic constraints | `{echoCancellation:false, noiseSuppression:false, autoGainControl:false, channelCount:1}` — no `video` key |
| MIME order | `audio/webm;codecs=opus` → `audio/webm` → `audio/mp4` → `audio/ogg` → `''` |
| Record | `#recBtn` `.rec`, `min-width:120px`, `● Record` ⇄ `■ Stop`, `.rec.on` red + `pulse 1s infinite` |
| Sync model | `startRecording` order: `start(true)` → `recStartTime=now()` → `mediaRecorder.start()`. `vocalHeadSec = max(0, musicZeroTime − recStartTime)` |
| Head values | count-in ON @92 BPM ≈ **2.7287 s**; count-in OFF ≈ **0.12 s** |
| `vocalChain` | highpass 80 Hz Q0.7 → comp thr −18, knee 12, ratio 3, attack .006, release .12 → dest |
| Destination | **v10: `bus.vocalIn` = `grp.vocals.g`** (v9: master `sum`) — the take now gets fader/mute/solo/EQ/pan/reverb send |
| `LAT()` | `(outputLatency||0) + (baseLatency||0) + INPUT_LAT_EST(0.02)` — Chrome ≈ 0.046 s, Safari ≈ 0.02–0.03 |
| Head formula | `vocalHeadSec + LAT() + (+syncEl.value/1000)` — duplicated verbatim at L635 (export) and L708 (live) |
| Placement | `head>=0` → `vs.start(base, head)` (trims front, voice **earlier**); else `vs.start(base−head, 0)` |
| Sync | `#sync` −200…200 ms · **0**, readout only, read live at play/export |
| Vocal vol | `#vocalVol` 0–**150** · 100 → `takeGain` (live only while a take sounds) |
| Monitor | `#monitor` **unchecked** → `micSource → monitorGain(0.9\|0) → ac.destination`, bypasses the whole bus graph |
| Meter | `analyser.fftSize=1024`, `pct=min(100, rms*220)`; `>88` `#ff5c8a`, `>8` `var(--green)`, else `#3a4270`. Green at rms>0.03636, red at rms>0.4 |
| `releaseMic()` | stops tracks and nulls `micStream/micSource/micAnalyser/monitorGain` after every take |
| Take status | `<span class="badge">Take N.Ns</span> ✓ mixed into export` (the only `innerHTML` status) |
| Clear take | nulls `vocalBuffer`, disables both buttons, status `No take yet`. No confirm, no undo |
| Play take | `#playTake` **doubles as Stop** whenever the transport is running |

### 2.8 Export

| Item | Detail |
|---|---|
| Trigger | `#export`; label `⬇ Export WAV` / `⬇ Export WAV + vocals` (via `updateExportLabel`) |
| Re-entry guard | `.disabled` class only (`opacity:.4; pointer-events:none`) — no boolean flag |
| Lifecycle | `Rendering…` → `✓ Saved` / `Export failed` → 1500 ms → label restored |
| Song vs pattern | `isSong = song.some(s=>s!=null)` — **ignores the Loop/Song toggle entirely** |
| Length | `fxTail = 0.9 + irSeconds() + (fx.dlyTime/1000)*4` (**v10**; v9 used flat 0.9). Defaults: 0.9+2.2+1.12 = **4.22 s** |
| `dur` | `max(totalSteps*sps, vocalTail) + fxTail`; `vocalTail = max(0, buffer.duration − vocalHeadSec)` |
| Context | `OfflineAudioContext(2, ceil(dur*44100), 44100)`; rebuilds the **whole** bus graph via `buildBusses` |
| Swing | identical formula to live (`s%2===1` → `+= sps*(swing/100)*0.9`) |
| Peak safety | scan all channels; `if(peak>0.985) scale by 0.985/peak` — **downward only** |
| `encodeWav` | 44-byte RIFF, PCM tag 1, 16-bit, blockAlign 4, byteRate 176400; `v<0 ? v*0x8000 : v*0x7FFF` |
| Filenames | `aura-studio-song-with-vocals.wav` / `aura-studio-backing.wav`. No timestamp, no de-dup |
| Cleanup | `setTimeout(()=>URL.revokeObjectURL(url), 4000)`; anchor appended to body before `.click()` |
| Not exported | The metronome count-in (`playClick` connects straight to `ctx.destination`) |

Default-project export: 8 seeded bars = 128 steps × 0.163043 = 20.87 s + 4.22 = **≈25.09 s** (1,106,450 frames).

### 2.9 Persistence & sharing

| Item | Detail |
|---|---|
| Key | `localStorage['aura-studio-v6']` — **never bumped since v6**; v9 and v10 share the slot |
| Payload | one JSON blob, `v:10`, written by `serialize()` (L976–986) |
| Cadence | `setInterval(autosave, 4000)` + `beforeunload` + ~29 explicit call sites |
| Failure | `try{...}catch(e){}` — silent, no user signal |
| Share encode | `btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))))` → `origin+pathname+'#p='+data`, plus `history.replaceState` |
| Share decode | `location.hash.indexOf('p=')` (indexOf, not startsWith) → `JSON.parse(decodeURIComponent(escape(atob(...))))` |
| Precedence | **hash always wins over localStorage, on every load** |
| Sizes | typical ≈1616 B → 2156 b64 chars; empty melodies ≈1028→1372; worst case ≈2462→3284 |
| Fallback | neither source → `seedSong(); applyVibe('moody')` |

### 2.10 Vibes — all 12, exact payloads

| id | Button label | key | mode | prog | beat | bpm | swing | reverb | cs | bs | ms |
|---|---|---|---|---|---|---|---|---|---|---|---|
| moody | Reggaetón · Moody | 9 | minor | emotional | reggaeton | 90 | 16 | 34 | pad | sub | lead |
| classic | Reggaetón · Classic | 0 | minor | simple | dembow | 94 | 14 | 24 | pad | sub | lead |
| latinpop | Latin Pop · Upbeat | 0 | major | pop | reggaetonpop | 96 | 12 | 28 | pluck | sub | pluck |
| rnbchill | R&B · Chill | 2 | minor | ballad | lofi | 84 | 22 | 40 | piano | sub | keys |
| kanyesoul | Kanye · Soul | 0 | dorian | soulful | boombap | 86 | 20 | 26 | soul | 808 | keys |
| kanye808 | Kanye · 808s | 9 | minor | emotional | sparse808 | 78 | 8 | 38 | pad | 808 | pad |
| chipmunk | Soul · Chipmunk | 3 | minor | soulflip | boombap | 88 | 16 | 20 | soul | sub | keys |
| heartbreak | 808 · Heartbreak | 1 | minor | lockdown | heartbeat | 120 | 0 | 12 | piano | 808 | pad |
| gospel | Gospel · Sunday | 0 | harmonicMinor | ultralight | gospelpulse | 74 | 33 | 55 | soul | sub | keys |
| urbano | Urbano · Polished | 5 | minor | simple | reggaetonpop | 95 | 10 | 20 | pluck | sub | pluck |
| atmos | Atmosphérico | 8 | minor | emotional | reggaeton | 88 | 18 | 48 | pad | sub | pad |
| tehran | Tehrán · Noir | 4 | phrygian | phrygian | boombap | 92 | 14 | 32 | pluck | 808 | pluck |

**Button DOM order ≠ VIBES declaration order.** The table above is DOM order (L185–196); the object declares the last six as tehran, urbano, atmos, chipmunk, heartbreak, gospel. `VIBES[k].label` is **dead** — button text is hardcoded separately.

`applyVibe(k)` order of operations (load-bearing): (1) guard · (2) capture `oldKey` · (3) set keyRoot **and** keyMode · (4) `relabelChords()` (which tail-calls `refreshRollScale()`) · (5) `transposeMelody(delta)` · (6) `resnapMelodies()` · (7) melodySound · (8) `bpmEl.value` **and** `bpmVal.textContent` manually, `swingEl.value` · (9) reverb + `reverbWet` + **the stale `reverbReturn` write** · (10) chordStyle, bassStyle · (11) `applyBeat` then `applyProg` · (12) `.on` toggle · (13) `autosave()`. One tap = 3 autosaves.

Scope asymmetry: `applyBeat`/`applyProg` write **only the current section**; `transposeMelody`/`resnapMelodies` rewrite the melody of **all 6 sections**.

Coverage gaps: melody sounds `bell` and `b808` are used by **no** vibe. `gospel` is the only harmonicMinor user, `kanyesoul` the only dorian, `tehran` the only phrygian, `latinpop` the only major.

---

## 3. Audio architecture

### 3.1 Master chain (built output-first, L506–513)

```
instr (unity GainNode)
  → presence   BiquadFilter 'peaking'   f=3000 Hz, gain=-2.5 dB, Q=1.2
  → sum        GainNode  gain = masterVol (= +masterEl.value/100, default 0.80)   ← returned as `master`
  → hp         BiquadFilter 'highpass'  f=30 Hz, Q=0.7
  → glue       DynamicsCompressor  threshold=compThreshold() (-15 dflt), knee=25,
                                   ratio=compRatio() (2.5 dflt), attack=.03, release=.25
  → makeup     GainNode  gain = 1.1
  → air        BiquadFilter 'highshelf' f=10000 Hz, gain=+1.5 dB
  → limiter    DynamicsCompressor  threshold=-1, knee=0, ratio=20, attack=.002, release=.08
  → ctx.destination
```

The **Vocals strip** and both FX returns bypass `presence` by connecting to `sum` directly.

### 3.2 Reverb chain (L514–519)

```
preDelay  DelayNode(max 1), delayTime = 0.03 s     ← exposed as bus.reverb; everything sends here
  → conv      ConvolverNode, buffer = makeIR(ctx, irSeconds(), irRT60()), normalize = true
  → revHP     BiquadFilter 'highpass' f=250 Hz
  → revLP     BiquadFilter 'lowpass'  f=6000 Hz
  → reverbReturn  GainNode  gain = 1   ← v10 unity by design (v9: = reverbWet)
  → sum
```

`makeIR(ctx, seconds=2.2, rt60=1.8)`: `len = floor(rate*seconds)`, stereo, decay `k = rate*rt60/6.908` (6.908 ≈ ln 1000 = −60 dB), each channel independently `(random()*2−1)*exp(−i/k)` — de-correlated L/R is the stereo spread. ~776 KB at 44.1 kHz / 2.2 s. Rebuilt only on `fxRevSize` **change** and mixer reset.

### 3.3 Delay chain (v10 only, L521–525)

```
dlyIn (unity, NOT exposed)
  → dly    DelayNode(max 2), delayTime = fx.dlyTime/1000 (0.28)
  → dlyLP  BiquadFilter 'lowpass' f=3200 Hz
        ├→ dlyFb  GainNode gain = fx.dlyFb/100 (0.32) → dly     (feedback loop)
        └→ sum                                                   (wet return, post-filter, pre-feedback)
```

Silent until some strip's `ds` send is raised. Feedback is capped only by the slider max of 70 → gain 0.70.

### 3.4 Channel strips ×7 (v10 only, L527–541) — exact node order

```
g   GainNode  gain = groupGain(G.id)
 → lo   'lowshelf'  f=200,  gain = m.lo
 → md   'peaking'   f=1200, Q=0.9, gain = m.mid
 → hi   'highshelf' f=4000, gain = m.hi
 → pan  StereoPannerNode  pan = m.pan/100
 → (G.id==='vocals' ? sum : instr)

post-pan sends:
 pan → rs GainNode gain = groupRev(G.id)      → preDelay
 pan → ds GainNode gain = m.dly/100*0.6       → dlyIn
```

`bassDuck` (GainNode, gain 1) → **`grp.bass.g`** in v10 (v9: → `instr`), i.e. the duck sits *before* the Bass strip.

Instrument bus fan-out: one GainNode per `BUS_VOL` key at its literal value, connected to `busTarget(id)` — `bassDuck` for bass, else the owning group's `g`, else `instr`. Nine buses: kick, snare, clap, hat, openhat, shaker, chords, bass, melody.

`buildBusses` returns `{master:sum, bus, glue, conv}`; `bus` also carries `bassDuck`, `grp`, `vocalIn = grp.vocals.g`, `dly`, `dlyFb`, `reverb = preDelay`, `reverbReturn`, and **`chordSend = melodySend = drumSend = null`** (L548). v9 instead had real pre-fader sends: chordSend 0.32, melodySend 0.22, drumSend 0.14 → preDelay.

### 3.5 Voices — every parameter

**Helpers.** `getNoise(ctx)`: one cached mono white-noise buffer, `floor(sampleRate*0.4)` samples, reused by every noise drum. `env(g,t,a,d,peak)`: `cancel → setValueAtTime(0.0001,t) → expRamp(peak, t+a) → expRamp(0.0001, t+a+d)`. `susEnv(g,t,dur,peak)`: `rel=min(.2, dur*0.45)`, `hold=max(.02, dur−rel)`, attack fixed **0.03 s**, hold, exp release. The **0.0001 floor is load-bearing** — exponential ramps cannot reach 0.

| Voice | Layers / params |
|---|---|
| `playKick(ctx,bus,t,vel)` | **No `send` param.** Body: sine 155 Hz → exp 45 Hz over .11; `env(.004,.34, 1*vel)`; stop t+.4. Click: noise → highpass 2600 → `env(.001,.028,.5*vel)`; stop t+.05 |
| `playSnare(...,send,vel)` | Noise → highpass 1700 → `env(.004,.17,.95*vel)` → bus **and** send. Body: triangle 185 Hz → `env(.005,.11,.45*vel)` → bus only. stop t+.2 / t+.15 |
| `playHat(...,send,vel)` | Noise → highpass 7500 → `env(.002,.045,.5*vel)` → bus. **`send` accepted but never used** |
| `playOpenHat(...,send,vel)` | Noise → highpass 6800 → `env(.003,.28,.42*vel)` → bus + send. stop t+.34 |
| `playShaker(...,send,vel)` | Noise → bandpass 6500 Q0.8 → `env(.006,.055,.5*vel)` → bus + send. stop t+.09 |
| `playClap(...,send,vel)` | **3 bursts** at `i*.012` (0/12/24 ms), each noise → bandpass 1200 Q1.2 → `env(.001,.12,.5*vel)`. 9 nodes per hit |
| `playDrum` dispatcher | Chained ternary kick→snare→hat→openhat→shaker→**else clap**. `'clap'` is never tested by name |

**Chords** — shared head: output `g`, lowpass `f` Q=0.4; `g→dry`, `g→send` if truthy.

| Style | Filter | Envelope | Oscillators |
|---|---|---|---|
| piano | 3400 Hz | 0.0001→0.22 over .006 → 0.0001 at t+len (`len=min(dur,1.5)`) | triangle @fr (stop len+.05); sine @fr*2 through gain 0.28 (stop len*0.6+.05) |
| soul | 2600 Hz | 3-stage: →0.18 over .012 → 0.06 at len*0.5 → 0.0001 at len (`len=min(dur,2.0)`) | triangle @fr; "tine" sine @fr*4 through 0.16, fixed 220 ms |
| pluck | 2500 Hz | `g.gain=1` static; per-note gain 0.0001→0.3 over .004 → 0.0001 at on+.42 | per index i: `on = t+i*0.05` (50 ms arpeggio); triangle @fr + sawtooth @fr through 0.12; stop on+.46 |
| pad (default) | 2600 → exp 1400 over `min(dur,0.7)` | `susEnv(g,t,dur,0.17)` | triangle @fr; triangle @fr detune +8 through 0.55; sine @fr*2 through 0.14; all stop t+dur+.25 |

**Bass** `playBass(ctx,bus,freq,t,dur,style)` — **never has a send.** `f` lowpass: Q `808?1.1:0.7`, freq `808?260:430`. `susEnv(g,t,dur, 808?0.72:0.6)`. Main osc: sine (808) / sawtooth (sub); 808 starts at `freq*2` and exp-ramps to `freq` over .06 s. Sub osc both styles: sine @`freq/2` through gain 0.8. Both stop `t+dur+.15`. Call site: `midiToFreq(chordRootMidi(deg)-24)`, dur `808?dur:min(dur, sps*3)`.

**Melody** `playMelody(ctx,bus,send,midi,t,dur,vel=0.85,sound)` — lowpass `lp` Q=0.5; `mk(type,mult,gain)` osc @`fr*mult`, stop `t+dur+.3`.

| Sound | lp | Envelope | Oscillators |
|---|---|---|---|
| pluck | 2500 | →.32*vel over .004, len=min(dur,.5) | triangle×1 + sawtooth×.12 |
| keys | 3000 | →.26*vel over .006, len=min(dur,1.2) | triangle×1 + sine@2×.25 |
| pad | 1900→1100 over min(dur,.6) | `susEnv(.2*vel)` | triangle×1 + triangle×.5 detune +9 |
| bell | 6000 | →.24*vel over .003, len=min(dur+.3,.9) | sine×1 + sine@3×.2 |
| b808 | 300 | `susEnv(.6*vel)` | sine@2×1 with exp ramp to `fr` over .05 + sine@1×.7 |
| lead (default) | 2200 | `susEnv(.2*vel)` | sawtooth×.7 detune −5 + sawtooth×.7 detune +6 |

**Metronome** `playClick(ctx,accent,t)`: square, `accent?1500:1000` Hz, 0.0001→`accent?.5:.3` over .002 → 0.0001 at t+.06, **connected straight to `ctx.destination`** — unaffected by master, limiter, mutes or the mixer, and never rendered into an export.

### 3.6 `scheduleStepAudio` — execution order (L565–579)

1. `inBuild = fill && s>=13 && !mutes.snare`
2. Drums loop: skip snare/hat/openhat/shaker while `inBuild`; else `playDrum(bus[id], id, t, DRUM_SEND(id)?bus.drumSend:null, drumVel(pat,id,s))`
3. Build: rising snare `[0.78,0.95,1.12][s-13]`; open hat 0.5 on s=15 if `!mutes.openhat`
4. **Sidechain duck**: `if(kick[s] && !mutes.kick && groupGain('kick')>0 && bus.bassDuck)` → `gain.setValueAtTime(0.55,t); setTargetAtTime(1, t+0.03, 0.08)` (~63% back at 110 ms, ~95% at 270 ms). The `groupGain('kick')>0` term is **v10-only**
5. Chords: `dur = chordDurSteps(pat,s)*sps*0.98`; each active degree → `playChord(..., chordMidiNotes(deg, chordStyle==='soul').map(midiToFreq), t, dur, chordStyle)`
6. Bass: `if(BUS_VOL.bass>0 && !mutes.bass)` → root of **`degs[0]`** only, −24 semitones
7. Melody: linear scan of `patterns[pat].melody` every step, `dur = max(1,n.l)*sps*0.98`

`chordDurSteps(pat,s)` walks forward **with wraparound** `(s+k)%16` for k=1..16 — a chord on step 12 with the next on step 0 lasts 4 steps, and a lone chord sustains the full bar.

### 3.7 `drumVel` — deterministic groove

```
v = 0.82
s%4===0 → +0.16   else s%2===0 → +0.06
hat|openhat|shaker and (kick[s] || snare[s]) → +0.12
v += (((s*53 + id.charCodeAt(0)*7) % 11) - 5) / 120      // exactly ±0.041667, 1/120 steps
accents[pat][id][s] → +0.28
return clamp(v, 0.4, 1.18)
```

No `Math.random` anywhere — this is why two exports of the same pattern are byte-identical and why export matches live.

### 3.8 Offline export graph

`exportWav` builds a **second, independent** graph from the same `buildBusses`, then re-applies `bus.chords.gain` and `bus.bass.gain` from the sliders — but **not** `reverbReturn` (unlike `ensureCtx`). This single divergence is the live-vs-export reverb mismatch (§7.1). Vocals go through `vocalChain(off, bus.vocalIn)`; v9's explicit 0.12 `vsend` into `bus.reverb` is gone, replaced by `REV_BASE.vocals = 0.12` in the strip.

### 3.9 Live-control → AudioParam bindings (the complete list)

`#master`→`liveMaster.gain` · `#chordVol`→`liveBus.chords.gain` · `#bassVol`→`liveBus.bass.gain` · `#reverb`→`reverbWet` + `applyAllGroupsLive()` · `.track-vol`→`BUS_VOL[id]` + `liveBus[id].gain` · `#melVol`→`BUS_VOL.melody` + `liveBus.melody.gain` · `#vocalVol`→`takeGain.gain` (only while playing) · `#monitor`→`monitorGain.gain` (0.9/0) · `#fxDlyTime`→`dly.delayTime.setTargetAtTime(v, now(), .05)` · `#fxDlyFb`→`dlyFb.gain` · `#fxComp`→`liveGlue.threshold/.ratio` · `#fxRevSize` **change**→`liveConv.buffer = makeIR(...)` · `#mixReset` → all of the above · `applyGroupLive(id)` → `g.gain`, `pan.pan`, `rs.gain`, `ds.gain` all via `setTargetAtTime(..., 0.008)`; `lo/md/hi.gain` set **instantly, no ramp**.

Every one guards on `liveBus`/`liveMaster`/`liveGlue`/`liveConv` being non-null — the AudioContext does not exist until the first `ensureCtx()`.

---

## 4. State model

### 4.1 The two stores

**Roughly half the app's state lives only in the DOM.** `bpm`, `swing`, `master`, `chordVol`, `bassVol`, `reverb`, `countin`, `autofill`, `melVol`, `scaleLock`, `vocalVol`, `sync`, `monitor` have **no JS mirror**. `serialize()` reads `+bpmEl.value` directly; the scheduler reads `+swingEl.value` on every tick. Element handles are cached once at IIFE top level via `getElementById` (L718–727) with **no null checks** — renaming or removing any of these ids throws at load and blanks the entire app.

### 4.2 Module-level variables

| Variable | L | Default | Notes |
|---|---|---|---|
| `STEPS, N_PATTERNS, SONG_SLOTS` | 353 | 16, 6, 32 | v6/v7 used 4/16 |
| `NOTE_NAMES` | 356 | 12 sharps | |
| `keyRoot` | 366 | 0 | 0–11 |
| `keyMode` | 366 | `'major'` | SCALES key; **no validation on load** |
| `reverbWet` | 366 | 0.18 | Derived, always `slider/100*0.7`; the 0.18 never matches the slider's 30 (=0.21) |
| `chordStyle` | 366 | `'pad'` | |
| `bassStyle` | 366 | `'sub'` | |
| `melodySound` | 412 | `'lead'` | |
| `PR_LO/HI/CW/RH` | 411 | 48/83/34/13 | Also load-time clamps |
| `drums[]` | 375–382 | 6 entries with `vol` | Display defaults for `.track-vol` |
| `BUS_VOL` | 384 | kick.95 snare.7 clap.5 hat.4 openhat.35 shaker.42 chords.5 bass.6 melody.55 | Mutated in place by 3 handlers |
| `DRUM_SEND` | 413 | snare\|clap\|shaker | Still called at L570/754/756 but `bus.drumSend` is null in v10 |
| `GROUPS` | 388–396 | 7, **ordered** | `mx` is positional against this |
| `mix{}` | 398 | `mixDefault()` ×7 | |
| `fx{}` | 399 | `{dlyTime:280, dlyFb:32, revSize:50, comp:40}` | |
| `PAN_COMP` | 404 | `Math.SQRT2` | |
| `REV_BASE` | 408 | see §2.6 | |
| `patterns[]` | 417 | 6 × `emptyPattern()` | `const` — mutated in place |
| `currentPattern` | 418 | 0 | |
| `song[]` | 419 | 32 × null | |
| `mode` | 420 | `'pattern'` | **Not persisted** |
| `accents[]` | 423 | 6 × 6 × 16 false | Drums only |
| `mutes{}` | 424 | `{}` — lazily keyed | Keys: 6 drum ids, `'chords'`, `'melody'`, and `'bass'` (**read at L577, never written by any UI**) |
| Scheduler | 596 | `playing,timer,nextTime,step,slotIndex,musicZeroTime` | Not persisted |
| Vocals | 609, 658–659 | `takeSource, takeGain, vocalBuffer, micStream, micSource, micAnalyser, monitorGain, mediaRecorder, recChunks, recording, recStartTime, vocalHeadSec, meterRAF` | None persisted |
| `prLastLen` | 779 | 2 | Not persisted |

### 4.3 `serialize()` — the exact v10 payload

| Field | Source | Type / range | Since | Restored at | Guard |
|---|---|---|---|---|---|
| `v` | literal | `10` | v7 | — | **Written but NEVER READ** |
| `k` | `keyRoot` | int 0–11 | v7 | L989 | `!=null`, **no range check** |
| `m` | `keyMode` | string | v7 | L990 | truthy, **no whitelist** |
| `bpm` | `+bpmEl.value` | 60–160 | v7 | L991 | truthy (`bpm:0` ignored) |
| `sw` | `+swingEl.value` | 0–60 | v7 | L992 | `!=null` |
| `rv` | `+reverbEl.value` | 0–100 raw slider | v7 | L993 | `!=null`; slider browser-clamped, `reverbWet` computed **unclamped** |
| `cs` | `chordStyle` | string | v7 | L994 | truthy, no whitelist |
| `bs` | `bassStyle` | string | v7 | L995 | truthy, no whitelist |
| `cv` | `+chordVolEl.value` | 0–100 | v7 | L996 | `!=null` |
| `bv` | `+bassVolEl.value` | 0–100 | v7 | L997 | `!=null` |
| `mv` | `+masterEl.value` | 0–100 | v7 | L998 | `!=null` |
| `ci` | `countInEl.checked?1:0` | 0\|1 | v7 | L999 | `!=null` |
| `af` | `autoFillEl.checked?1:0` | 0\|1 | **v8** | L1000 | `!=null` |
| `ms` | `melodySound` | string | **v9** | L1002 | truthy |
| `mlv` | `+melVolEl.value` | 0–100 | **v9** | L1003 | `!=null`; slider clamped, `BUS_VOL.melody` not |
| `mx` | `GROUPS.map(→[vol,pan,mute,solo,lo,mid,hi,rev,dly])` | **7×9 ints, POSITIONAL** | **v10** | L1006–1009 | clamps vol 0–140, pan ±100, EQ ±12, rev/dly 0–100 |
| `fx` | `[dlyTime,dlyFb,revSize,comp]` | **4 ints, POSITIONAL** | **v10** | L1010 | clamps 60–700 / 0–70 / 0–100 / 0–100; **missing element → low bound, not default** |
| `mel` | `patterns.map(p→p.melody.map(n→[p,s,l,round(v*100)]))` | 6 × variable 4-tuples | **v9** | L1004–1005 | `p`→[48,83], `s`→[0,15], `l`→[1,16−s], `v`→[0.3,1.3]; **stored 0 velocity becomes 85** |
| `pat` | `patterns.map(p→ALL_IDS.map(maskOf))` | 6 × 13 **16-bit masks** | v7 | L1011 | always replaces all 13; missing → mask 0 = all off |
| `acc` | `accents.map(a→drums.map(maskOf))` | 6 × 6 masks | v7 | L1012 | same |
| `song` | `song.slice()` | 32 × `int\|null` | v7 | L1013 | pads/truncates, **NO value validation** |
| `mute` | `{...mutes}` | raw object | v7 | L1014 | delete-all + `Object.assign`, **unfiltered keys** |
| `dv` | `drums.map(d→round(BUS_VOL[d.id]*100))` | 6 ints, **POSITIONAL** | v7 | L1001 | **no clamp** — `dv:[500]` → bus gain 5.0 |
| `cp` | `currentPattern` | 0–5 | v7 | L1016 | **upper bound only, no lower bound** |

`ALL_IDS` (L973) = `[kick, snare, clap, hat, openhat, shaker, deg0…deg6]`. `maskOf` = `m |= 1<<i` over 16 steps, LSB = step 0. `applyState` epilogue: `relabelChords(); renderGrid(); refreshPatBtns(); syncMixerUI(); applyAllGroupsLive();` — the last two are **v10-only**.

### 4.4 Deliberately NOT persisted

`mode` (always boots to Loop) · transport position (`step`, `slotIndex`, `playing`) · the recorded take (`vocalBuffer`, `vocalHeadSec`) · `#vocalVol`, `#sync`, `#monitor`, `#scaleLock` · mixer panel open/closed · `prLastLen` · `prScroll.scrollTop` · **the active vibe's `.on` highlight** (there is no `vibe` field to restore from, so after any reload no vibe appears selected).

### 4.5 Autosave tiers

- **Tier A** — handler calls `autosave()` immediately (~29 sites): grid cell, accent, row mute, track vol, song slot, roll mouseup, note velocity, melody sound/vol/mute/clear, transpose (only if delta≠0), resnap (only if a note moved), every mixer control, all 4 fx sliders, mixer reset, applyBeat, applyProg, applyVibe, Clear section, Copy→next, chord style, bass style, autofill.
- **Tier B** — serialized but relies on the 4 s sweep: `#bpm`, `#swing` (no listener at all), `#master`, `#reverb`, `#chordVol`, `#bassVol`, `#countin`, section button / `cp`.
- **Tier C** — not serialized at all: see §4.4.

**Removing or debouncing `setInterval(autosave, 4000)` (L1069) stops seven controls from saving**, intermittently — the failure depends on whether the user waits 4 s before closing.

### 4.6 Compatibility rules

There is **no version-dispatch code**; `o.v` is written and never read. Compatibility works purely because (a) `SAVE_KEY` never changed, (b) fields were only ever *added*, and (c) every read is behind an `if`.

- **v7** (18 fields, 4 patterns / 16 slots) → **v8** adds `af`, raises to 6/32 → **v9** adds `mel`, `ms`, `mlv` → **v10** adds `mx`, `fx`.
- **Old into new is lossless**: every v10 addition is a no-op at its default, so a v7 track loads and sounds exactly as it did. Short `song`/`pat` arrays pad with null / leave patterns empty.
- **New into old is lossy and silent**: a v10 link opened on the deployed v9 loads notes, key, tempo and melodies but drops `mx`/`fx`. Because both write the **same** localStorage key, a user who visits v9 after using v10 has their mixer state stripped on v9's next autosave.
- `applyState` is a **MERGE, not a replace** — there is no `resetState()`. A second call in one session would leak the previous project's values through any missing field.

---

## 5. Load-bearing logic that must not change

### 5.1 Musical invariants

1. **Chords are scale degrees, never pitches.** The grid re-labels on key change; the pattern data is untouched. `'deg'+d` couples `applyProg`, `clearChords`, row rendering, `ALL_IDS` serialization and the save format.
2. **`chordMidiNotes`' three-line 7th logic.** Do not collapse it to `root+10` or a quality lookup — the 9/10/11 spread per degree per scale is what makes harmonicMinor V a dominant (`chordMidiNotes(4,true) === [67,71,74,77]` = G7) and harmonicMinor i a minMaj7. The `if(off<9)` guard never fires today; it protects any future scale from a semitone cluster.
3. **harmonicMinor's `quals` are hand-authored** (III = maj not aug). Never derive quals from steps.
4. **The 7th is gated only on the literal string `'soul'`.** Renaming that option value silently drops every 7th.
5. **`nearestInScale` searches downward first** at each distance d=1..6. Flipping the two `if`s changes where every snapped note lands.
6. **`transposeMelody` folds by whole octaves**, preserving pitch class — which is exactly why a key change needs no resnap and a mode change does.
7. **`applyVibe` steps 5 then 6** (transpose, *then* resnap) must stay in that order and both must run.
8. **`chordDurSteps` wraps around the bar.** A non-wrapping scan cuts the last chord of every bar short.
9. **`drumVel`'s wobble is seeded by `id.charCodeAt(0)`.** Renaming a drum id (`hat`→`hihat`) changes the groove of every existing saved pattern. Two ids sharing a first letter get identical wobble.
10. **Swing applies to odd steps only, as `sps*(swing/100)*0.9`**, and shifts the playback time but **not** `nextTime` — so the grid never drifts. Max swing = 54% of a step.
11. **`loop()` re-reads `bpmEl.value` and `swingEl.value` every iteration.** Caching `sps` breaks live tempo dragging.
12. **The bass has no pattern row.** It is triggered exclusively by chord onsets, follows `degs[0]` (lowest degree index), and plays `chordRootMidi(deg)−24`.
13. **`!mutes.snare` disables the entire auto-fill build** (not just the snare) — deliberate, so a muted snare leaves the pattern untouched rather than leaving a hole.
14. **Auto-fill `wrap` asymmetry**: live `true`, export `false` — the last exported bar always fills.
15. **`songUsedLen()||SONG_SLOTS`** is the only thing preventing a modulo-by-zero on an empty song.
16. **`PAN_COMP = √2`** exactly cancels the StereoPanner's 0.7071 equal-power centre. Drop it and every track quietens by 3 dB.
17. **`env`'s 0.0001 floor.** Substituting `linearRampToValueAtTime` or 0 throws or changes the attack shape of every voice.
18. **`playDrum`'s final ternary falls through to clap.** A new drum id without a branch silently becomes a clap.
19. **`applyGroupLive`'s 0.008 s `setTargetAtTime`** is what stops fader/mute clicks.

### 5.2 Pixel-math invariants

20. **`PR_CW=34` / `PR_RH=13` are duplicated in six CSS declarations with no shared source of truth**: `.prgrid{width:544px}`, `.prgrid{background-size:136px 100%, 34px 100%}`, `.prow{height:13px}`, `.prkey{height:13px}`, `.pnote{height:11px}`, and the inline `#prGrid` height `468px` (set at L785). Any `transform:scale()`, `zoom`, or fluid width on `.prgrid` changes `getBoundingClientRect()` while the JS keeps dividing by the literal 34/13 — clicks land on the wrong step and pitch.
21. **`.prgrid` must have `position:relative`, no padding and no border.** All hit-testing measures from its border-box edge.
22. **`.prwrap{width:max-content}` + `.prkeys{flex:none}`** are the only things stopping flexbox from shrinking the 544px grid out of sync with the JS.
23. **`.pnote::after{width:7px}` must stay ≤ the literal `8` in the resize hit test** (L808).
24. **z-index triplet `.prph 1 / .pnote 2 / .prkeys 3`** plus `.prph{pointer-events:none}`. Swap 2 and 3 → notes cover the key labels; swap 1 and 2 → the playhead paints over notes; drop `pointer-events:none` → the playhead swallows clicks.
25. **`*{box-sizing:border-box}`** — every fixed pixel size assumes it.
26. **Sequencer step pitch is emergent from four things together**: `.cell{34px}` + `border-spacing:6px` + the **un-reset UA `td{padding:1px}`** + `.beatgap{8px}` → 42px in-beat, 56px across a beat boundary. Replacing the `<table>` loses the auto-sized label column, the compress-gaps-first behaviour, and the `colSpan` divider.
27. **The empty volume `<td>` on chord rows** (L745–747) exists solely for column alignment.
28. **`.grid-wrap{overflow-x:auto}` and `.prscroll{overflow:auto; max-height:340px}`** are the *entire* mobile story. At 375px the body does not scroll horizontally (docScrollWidth 375 === clientWidth) even though the table is 1016px.
29. **`.fader input[type=range]` (L155) beats `.strip input[type=range]` (L151) only by source order** — identical specificity. Alphabetising or reordering the mixer rules turns the vertical faders back into 88px horizontal sliders.
30. **`.disabled{pointer-events:none}`** is the only re-entrancy guard on `exportWav`.
31. **`.mixer{display:none}` / `.mixer.open{display:block}`**; all 7 strips exist in the DOM at all times because `applyState` calls `syncMixerUI()` on hidden nodes.
32. **`.cue` base `display:none` paired with JS writing `style.display='flex'/'none'`** (L729–730) — a class-based toggle requires changing both.
33. **`.toast`'s `translate(-50%, …)` must survive into `.show`**, and `pointer-events:none` must stay or it blocks clicks at opacity 0.
34. **`.play{min-width:96px}` / `.rec{min-width:120px}` / `.bpm{min-width:40px; tabular-nums}`** absorb label-length changes; without them the transport reflows on every play/stop/record and on every BPM drag.
35. **The `&nbsp;` fallback in `.strip .nm span`** (L860) keeps all 7 strips the same height.
36. **`--green` has ZERO CSS references** — it is read only as the string `'var(--green)'` inside `startMeter()` (L713). A token-pruning pass that greps the stylesheet will delete it and silently break the mic meter.
37. **`renderSlot()` overwrites `className` wholesale** — any new class on `.slot` is destroyed on the first click. It works today only because `clearPlayhead()` runs first.
38. **`.v` inside `.slot` has no CSS rule but is load-bearing** — `renderSlot()` does `querySelector('.v')`.
39. **Row-label mute affordance is set imperatively** (`label.style.cursor='pointer'` + `title`, L740). Rebuilding `.rowlabel` in CSS loses the only affordance for the feature.
40. **`ensureCtx()` must be the first act of every sound-making handler** — it is what satisfies the browser autoplay gesture requirement.
41. **The `!=null` vs truthy split in `applyState` is deliberate.** `sw, rv, cv, bv, mv, ci, af, mlv, k, cp` use `!=null` so a legitimate 0 survives; `m, bpm, cs, bs, ms` use truthy. Normalising to one style breaks either "swing 0 / count-in off / key of C" round-trips or starts accepting empty strings as mode names.
42. **`escape`/`unescape` in the share codec.** Replacing them with TextEncoder/TextDecoder is safe only if the byte sequence is byte-identical, or every link ever shared breaks.
43. **`GROUPS` order and `drums[]` order are positional in the save format** (`mx`, `dv`). Reordering silently reassigns every saved channel's settings to the wrong channel.
44. **`STEPS` is a 16-bit assumption** in `maskOf` — raising it past 31 corrupts saves (JS bitwise is 32-bit signed).
45. **The sync formula `vocalHeadSec + LAT() + sync/1000` is duplicated at L635 and L708** and must stay in lockstep — live audition is how the user tunes the value export then uses. Positive Sync moves the voice **earlier**.
46. **`startRecording`'s three-line order** — `start(true)` → `recStartTime=now()` → `mediaRecorder.start()` — is the entire sync model. Reordering or awaiting between them shifts every take.
47. **`echoCancellation:false`** is load-bearing; turning it on lets the browser's AEC duck the vocal against the backing track.

---

## 6. Regression checklist

Every item is a concrete pass/fail browser check. This is the contract for every future phase.

### A. Transport & timing

1. **Bar length.** Defaults (92 BPM, swing 14): time 10 full bars. Expect **26.09 s** (one bar = 2.6087 s).
2. **Live tempo.** Drag BPM 92→160 while playing; the loop must speed up within ~100 ms without stopping. The `#bpmVal` span must track live.
3. **Tempo persistence.** Set 140, wait >5 s, reload — slider still 140 (proves the 4 s sweep covers Tier B).
4. **Swing extremes.** Swing 0 → hats perfectly even. Swing 60 → only ODD sixteenths shift late by 0.54 of a step (0.088 s @92); steps 1/5/9/13 stay exactly on grid; bar length unchanged at both extremes.
5. **Scheduler idempotence.** Click Play, then click Record — the pattern must never double up or play at 2× density.
6. **Count-in.** Record with count-in @92: exactly 4 clicks, first higher (1500 vs 1000 Hz) and louder, spaced **0.652 s**, music on the 5th beat. Unchecked → music ~120 ms after the click, no ticks.
7. **Metronome bypasses the mix.** With Master Vol at 0, the count-in clicks must still be audible.
8. **Play/Stop UI.** Label `▶ Play` ⇄ `■ Stop`, class `.on` (pink), grid playhead outline and `#prPH` both stop. Button width must not change.
9. **Space shortcut.** Click empty page → Space toggles playback and the page does not scroll. Focus `#bpm` → Space does nothing. Focus `#keyMode` → Space must not toggle playback.
10. **Mode segment.** Switching Loop↔Song while playing repositions to step 0 / slot 0 **without** stopping audio.

### B. Sequencer & grid

11. **Column count.** `[...document.querySelectorAll('#grid tr')].map(tr=>tr.children.length)` === `[21,21,21,21,21,21,21,2,21,21,21,21,21,21,21]`.
12. **Step pitch.** At viewport ≥1100px, `c[1]-c[0] === 42` and `c[4]-c[3] === 56` for the cell lefts of a drum row.
13. **Cell size / table width.** `.cell` computes exactly 34×34; `#grid` natural width **1016px**.
14. **Chord-row alignment.** `document.querySelectorAll('#grid tr')[9].children[1].children.length === 0` and its width equals the drum rows' volume column; first chord pad is vertically aligned with the first kick pad.
15. **Cell audition.** Turning a drum step ON auditions it; turning a chord step ON auditions chord **and** bass together (dur 0.7 s).
16. **Accent.** Right-click an OFF kick cell → turns on AND gets a 5px white dot at `top:4px;right:4px`, audible at vel 1.15. Right-click again → dot gone, step stays on. Left-click off then on → dot must not return.
17. **Accent playback.** An accented step is ~0.28 louder, clamped at 1.18.
18. **Row mute.** Click "Snare" → label strikes through, lit cells drop to `opacity:0.28` + `grayscale(0.7)`, no snare on Play. Click any chord row label → **all seven** chord rows strike through together.
19. **Groove determinism.** Fill a hat row all 16 steps: downbeats (1,5,9,13) noticeably louder; hats coinciding with kick/snare louder again. Export the same pattern twice → the two WAVs are **byte-identical**.
20. **Beat preset.** Choose Trap → all 16 hats lit, kick 1/8/11, snare 5/13, **all accents cleared**, select snaps back to `— beat presets —`. Chords and melody unchanged.
21. **Preset ↔ progression independence.** Applying a progression must not touch drums; applying a beat must not touch chords; neither clears the melody.
22. **Sections.** Distinct pattern in section 1, click 2 → grid, accents and piano roll all blank together; back to 1 → all return. `.has` underline appears on sections with content.
23. **Copy → next.** Section 1 full → Copy jumps to section 2, an exact duplicate including accents and melody notes.
24. **Clear section.** Wipes drums + chords + accents + melody of the current section only; other sections, song slots, mixer, key, tempo untouched.
25. **Sequencer playhead.** During Play, exactly **13** `td.playhead` cells exist at any instant (6 drums + 7 chords), each a 2px amber **outline** that does not shift the cell (step pitch during playback still 42px).

### C. Harmony & musical logic

26. **Cold-start vibe.** Clear localStorage and hash → boots to Reggaetón · Moody: A minor, tempo 90, swing 16, reverb 34, Pad / Sub / Lead, bars 1–8 = section 1, Moody button gold.
27. **A-minor chord labels.** Top→bottom: `Am/i`, `B°/ii°`, `C/III`, `Dm/iv`, `Em/v`, `F/VI`, `G/VII`.
28. **Cold-start chord placement.** Exactly 4 lit chord cells: VI@1, iv@5, i@9, v@13.
29. **Cold-start drums.** kick 1/5/9/13, snare 4/7/12/15, open hat 8/16, shaker 1/3/5/7/9/11/13/15; hat and clap empty.
30. **Gospel vibe.** C / Harmonic Minor; labels `Cm/i, D°/ii°, D#/III, Fm/iv, G/V, G#/VI, B°/vii°`; chords on rows i/III/VI/V at columns 1/5/9/13; Soul / Sub / Keys; 74 BPM, swing 33, reverb 55; drums = kick@1 + clap@9 only.
31. **7th fires only in Soul.** Gospel + Soul, click the V cell → four-note G7; `chordMidiNotes(4,true)` === `[67,71,74,77]`. Switch to Pad → three notes `[67,71,74]`.
32. **Harmonic-minor tonic colour.** Gospel + Soul, click i → minor-**major** 7th `[60,63,67,71]`, not m7.
33. **Vibe-only progressions survive.** Kanye·Soul → Cm A# F Gm; Tehrán·Noir → Em C F Em; Soul·Chipmunk → D#m C# B C#; 808·Heartbreak → C#m F#m C#m F#m. Zero chords on any of these means PROGS was pruned.
34. **Dropdown labels disagree by design.** In a minor key, "Emotional · vi–IV–I–V" places VI–iv–i–v.
35. **Snap direction.** C major, Stay-in-key on, click the C#4 row → note lands on **C4** (down), never D4. Uncheck → note stays on C#4.
36. **Key transposition.** Note on A4 (69) in C major, change key to D → moves to B4 (71).
37. **Octave fold.** Note on B5 (83) in C major, change key to B → folds down to A#5 (82), not clipped or lost.
38. **Mode resnap.** C major, note on E4 (64), switch to Phrygian → moves to D#4 (63). Repeat with Stay-in-key **unchecked** — it must still move.
39. **Resnap covers all sections.** A note in section 1 and one in section 2 both re-snap on a mode change and both transpose on a key change.
40. **Roll shading follows the key.** Key → F: the gold `root` rows move to every F; the C-row octave labels stay on C (two distinct highlights).
41. **Chord sustain.** One onset at column 1 → rings the whole bar. Add one at column 9 → each rings half a bar. Chords at 1 and 13 only → the step-13 chord lasts exactly 4 steps (wraps).
42. **Bass follows lowest degree.** Light both i and V on column 1 → bass plays the **i** root.
43. **Chord styles.** Cycle Pad / E-Piano / Soul / Nylon Pluck — each previews immediately; Pluck arpeggiates with 50 ms between notes; Soul adds a 4th note.
44. **Bass styles.** 808 has an audible one-octave drop over 60 ms and sustains the full chord; Sub is capped at 3 steps.
45. **Melody voices.** Cycle all six — each previews A4 on selection and is clearly distinguishable.
46. **Vibe row integrity.** Exactly 12 buttons, in DOM order Moody, Classic, Latin Pop, R&B Chill, Kanye Soul, Kanye 808s, **Chipmunk, Heartbreak, Gospel**, Urbano, Atmos, Tehrán. Clicking each must never leave a `<select>` blank.
47. **Mode dropdown.** Exactly 5 options; each repaints the 7 labels with that mode's romans and does not throw.
48. **Vibe scope.** With section 2 selected, click a vibe → section 1's drums and chords are **unchanged**, but section 1's melody has been transposed/resnapped.

### D. Piano roll

49. **Note math.** Synthesise a mousedown at `x = 4*34+10`, `y = (83−72)*13+5`. The created `.pnote` must have `left:'137px'`, `top:'144px'`, `width:'65px'`, `title:'C5'`.
50. **Dimensions.** `.prow` 13px, `.prkey` 13px, `.pnote` 11px, `#prGrid` computed width `544px`, inline height `468px`, `.prwrap` `590px`.
51. **No offset.** `#prGrid` computes `padding:0px`, `border-width:0px`, `position:relative`.
52. **Edge accuracy.** Clicking the far left of column 1 and far right of column 16 snaps to steps 1 and 16; the note's left edge sits on the grey gridline; top/bottom rows align with the key labels.
53. **Resize handle.** Hovering the right 7px shows `ew-resize` (not `grab`); dragging right ~68px adds exactly 2 steps.
54. **Click-to-delete.** Click a note once without moving → deleted. Draw a new note → defaults to the last sized length (`prLastLen`).
55. **Initial scroll.** After reload `#prScroll.scrollTop === 83`, `clientHeight ≈ 338`, `scrollHeight === 468`.
56. **Sticky gutter.** `prScroll.scrollLeft = 999` → the key column stays pinned and fully hides notes behind it; `position === 'sticky'`, z-index 3.
57. **Layer order.** `['.prph','.pnote','#prKeys','#cue','#toast'].map(zIndex)` === `['1','2','3','50','60']`; `#prPH` `pointer-events === 'none'`; clicking where the amber bar sits during playback still creates a note.
58. **Velocity cycle.** Right-click a note three times → opacity dim (.55) → medium (.8) → bright + glow (1), with matching loudness on playback.
59. **Melody mute / clear.** `#melMute` lights pink and silences melody only; `#melClear` empties the current section's melody only.

### E. Song arrangement & auto-fill

60. **Slot cycling.** Click bar 1 seven times → 1,2,3,4,5,6, empty, with six distinct 4px inset colours `#7c5cff, #38e1ff, #3ee6a0, #ff5c8a, #ffb14e, #ffce54`. `.slot` computes 40×46; 32 exist.
61. **Song playback.** Song mode → the amber `.playing` outline walks the slots and stops advancing past the last non-empty bar.
62. **Slot className preservation.** While playing in Song mode, click a slot — the `.playing` outline must reappear on the next bar.
63. **Arrangement length.** Bars 1–8 filled, 9–32 empty → playback loops back to bar 1 after bar 8; export ≈8 bars + FX tail, not 32. Clear **all** slots and press Play → must not hang or throw.
64. **Auto-fill build.** Song mode, bars 1–4 = section 1, bars 5–8 = section 2 → bars 4 and 8 play a rising 3-hit snare on steps 14/15/16 (velocities 0.78/0.95/1.12) with hats/shaker/open-hat suppressed there, plus one open hat on step 16 at 0.5. Kick and clap still play.
65. **Mute-snare cancels the build.** Mute Snare → the build vanishes **entirely** and bars 4/8 play their normal pattern (not a hole). Uncheck Auto-fill → no builds anywhere.

### F. Mixer & FX (v10)

66. **Panel toggle.** `#mixer` computes `display:none` on load, `block` after clicking 🎚 Mixer. Exactly **7** `.strip`, each 104px wide, ≈389px tall, one row at viewport ≥900px.
67. **Mixer is a no-op at defaults.** All strips 100% / pan C / EQ 0-0-0 / Rev 0 / Dly 0 → opening the mixer changes nothing audibly. A/B a default export against the v9 backup: identical.
68. **Vertical faders.** `.fader input` computes `width:22px`, `height:92px`, `writing-mode:vertical-lr`; dragging moves vertically.
69. **EQ knobs.** All three `.strip .eq input` compute `width:26px` and fit in the 88px row without wrapping.
70. **Solo/mute exclusivity.** S on Chords → every other group **including Vocals** silences, the others dim to `opacity:0.45`; S again restores. M on Hats mutes hat, open hat **and** shaker together.
71. **Sidechain gating.** Load Reggaetón · Classic and listen to the bass pump on every kick (to 0.55, recovering with τ=0.08 s starting 30 ms after). Mute the Kick strip → pumping stops entirely. Un-mute, then solo Bass only → pumping stops again.
72. **EQ bands.** Bass Low +12 → lowshelf boost at 200 Hz; Melody High +12 → highshelf at 4 kHz; Snare Mid −12 → 1.2 kHz Q0.9 notch. All instant, no click.
73. **Delay send.** Melody Dly 100 → audible repeats at 280 ms, low-passed at 3.2 kHz, 32% feedback. Feedback 0 → exactly one repeat; 70 → many repeats that still decay (never self-oscillate). Delay time 60 and 700 → repeat spacing tracks live.
74. **Reverb size labels.** 0 → `0.6 s`, 50 → `1.8 s`, 100 → `3.0 s`. The tail length changes only on slider **release** (IR rebuilt on `change`), and releasing produces no click or dropout.
75. **Compression labels.** 0 → `1.2:1`, 40 → `2.5:1`, 100 → `4.5:1`. At 100 a dense pattern audibly pumps; at 0 the mix is louder and more dynamic.
76. **Mixer reset.** Change several strips → Reset returns everything to 100/C/flat/0 sends, FX readouts to `1.8 s / 280 ms / 32% / 2.5:1`, toast "Mixer reset to flat", **no click** in the audio. Reload → the reset persisted.
77. **No-click guarantee.** While playing, slam the Kick fader 140→0→140 and hammer M/S — no clicks or pops (0.008 s time constant).
78. **Mixer persistence.** Bass pan L40, Chords fader 60 → reload → the strips **display** L40 and 60% (proves `syncMixerUI` still runs from `applyState`).

### G. Vocals

79. **Mic constraints.** Wrap `getUserMedia` and press Record. The logged constraint must be exactly `{"audio":{"echoCancellation":false,"noiseSuppression":false,"autoGainControl":false,"channelCount":1}}` — no `video` key.
80. **Mic denial.** Block the mic → `#recStatus` reads `🎤 Mic blocked — allow microphone access and try again`, Record stays `● Record` with no `.on`, no transport starts.
81. **Record idempotence.** Press Record, then press again during the count-in → it stops rather than starting a second recorder; exactly one take results.
82. **Count-in head.** Count-in ON @92 → head ≈ **2.73 s**; the first syllable lands on bar 1 beat 1. Count-in OFF → head ≈ **0.12 s**, still aligned.
83. **Cue overlay.** Recording count-in shows a full-viewport dark scrim with a single 120px amber digit 4→3→2→1, then disappears. `#cue` computes `position:fixed`, `inset:0px`. Pressing Stop mid-count-in hides it immediately.
84. **Mic release.** After decode, the browser tab recording indicator disappears within ~1 s. Toggling "Hear my voice" between takes has no audible effect until the next Record.
85. **Monitoring.** Checked + recording → voice audible **dry** (no comp, no reverb); moving Master Vol does not change monitor level; unchecking silences instantly.
86. **Meter thresholds.** Idle `rgb(58,66,112)`; normal speech `rgb(62,230,160)`; shouting `rgb(255,92,138)` past 88% width. On stop, width returns to exactly `0%`.
87. **Take badge.** A ~5 s take → `#recStatus` shows a gold pill `Take 5.0s` (one decimal) + `✓ mixed into export`; `#playTake` and `#clearTake` become enabled.
88. **Play-take-as-stop.** While a take plays, clicking `▶ Play take + music` stops the transport rather than layering a second copy.
89. **Live vocal volume.** During take playback drag Vocal vol 100→0 → the voice fades while the backing stays put. Dragging with nothing playing → no error, no effect.
90. **Sync live.** Sync −200 → readout `-200 ms`; the voice starts 200 ms **later** against the same backing (exercises the `head<0` branch).
91. **Clear take.** Pressing it mid-playback stops the vocal immediately, disables both buttons, sets `#recStatus` to exactly `No take yet`, and the next export is `aura-studio-backing.wav`.
92. **v10 vocal strip routing.** M the Vocals strip → export has **no vocal at all**. Un-mute, Vocals Rev send 100 → export is audibly reverberant. At all defaults the vocal level matches v9 (PAN_COMP × equal-power pan = unity).
93. **Vocals strip persistence.** Vocals fader 60 → reload → still 60%, while Sync / Vocal vol / Monitor have reset to 0 ms / 100 / unchecked and the take is gone.

### H. Export

94. **Button lifecycle.** `Rendering…` at opacity .4 → `✓ Saved` → after ~1.5 s the correct idle label. Clicking during `Rendering…` does nothing; exactly one file downloads.
95. **Label toggle.** No take → `⬇ Export WAV`; after a take → `⬇ Export WAV + vocals`; after Clear take → back.
96. **Filenames.** No take → `aura-studio-backing.wav`; with take → `aura-studio-song-with-vocals.wav`.
97. **WAV format.** Decode the file: `sampleRate 44100`, `numberOfChannels 2`. First 44 bytes: `RIFF`, `WAVE`, `fmt ` (trailing space), fmt size 16, tag 1, bits 16, blockAlign 4, byteRate 176400.
98. **Default-project duration.** 8 seeded bars, 92 BPM, revSize 50, delay 280 → **≈25.09 s** (20.87 + 4.22), not ~21.8 s.
99. **Pattern-mode duration.** No song slots, 92 BPM, default FX → **6.83 s** (2.6087 + 0.9 + 2.2 + 1.12). Raise revSize to 100 and delay to 700 → **≈9.97 s**, with the reverb tail not chopped.
100. **Long take.** A 40 s take over an 8-bar song → duration = (take − head) + fxTail, and the vocal end is not truncated.
101. **Sync in export.** Export at Sync 0 and at +200 ms → the vocal sits exactly 200 ms **earlier** in the second file while the backing is bit-identical in position.
102. **Peak safety.** Master 100, all faders 140, Compression 0, Vocal vol 150 → no sample exceeds **0.985** (≤32275 int16), no wrap-around or crackle.
103. **Export ignores mode (shipped behaviour).** Loop mode with any song slot filled → the WAV contains the **song**. Clear every slot → only then does it render one bar of the current pattern.
104. **Export last-bar fill.** With Auto-fill on, the final exported bar contains the snare build (export passes `wrap=false`).
105. **Count-in not exported.** A take recorded with count-in on → the WAV starts on the downbeat with no 1500/1000 Hz blips anywhere.

### I. Persistence & sharing

106. **Storage key and version.** `JSON.parse(localStorage.getItem('aura-studio-v6')).v === 10`, and the key is literally `aura-studio-v6` (**not** bumped).
107. **Full round-trip.** BPM 137, Swing 41, Master 63, Chords 22, Bass 88, Reverb 71, Count-in off, Auto-fill off, F#/Phrygian, Soul, 808, Bell, Melody vol 33 → wait 5 s → reload → all 13 identical.
108. **Autosave cadence.** Change only BPM; reload after <1 s (reverts) and after >5 s (persists). Repeat with <1 s and closing the tab (`beforeunload`).
109. **Pattern/accent bitmask round-trip.** Section 3: kick on 1/5/9/13, accented snare on 7 → reload → identical, and the accented snare still plays louder.
110. **Melody round-trip.** Three notes in section 2 including one at B5 and one starting on step 16 → reload → same pitch, step, length, velocity shade; the step-16 note still has length 1.
111. **Melody clamp hardening.** Inject `s.mel[0]=[[200,99,99,0],['x'],null]` → section 1 shows exactly ONE note at B5 / step 16 / length 1 / normal velocity (0→85). No console error.
112. **Mixer round-trip.** Chords 130, Hats pan L60, Bass low +8, Melody rev 45, Snare soloed → reload → all five restored, S lit, the four non-soloed strips `.silenced`.
113. **FX round-trip.** revSize 100 (`3.0 s`), delay 700, feedback 70, comp 100 (`4.5:1`) → reload → sliders **and** both derived labels match.
114. **Mute round-trip, all three key conventions.** Mute Hi-hat (drum id), a chord row (shared `'chords'`), and Melody (button) → reload → all three styled muted, and Play produces no hats, chords or melody but still kick and bass.
115. **Song round-trip.** 12-bar arrangement mixing sections 1/2/3 with a deliberate null gap at bar 5 → reload → identical, bars 13–32 empty, playback stops at bar 12.
116. **Share link in a clean profile.** Copy link → open in incognito → beats, melodies, key, tempo, mixer and fx all match. Fragment starts `#p=`, body ≈1400–3300 chars.
117. **Hash-wins precedence (documented gotcha).** Copy link, then edit BPM and add notes, wait 5 s, reload without clearing the address bar → the **shared** snapshot returns and the newer edits are discarded. Changing this is a deliberate behaviour change.
118. **Bad share link falls through.** Navigate with `#p=notvalidbase64` → app still starts (`console.warn 'bad share link'`), falling back to localStorage or the moody vibe. A blank page is a regression.
119. **v9 back-compat.** Set `s.v=9; delete s.mx; delete s.fx` → reload → all notes/key/tempo/melodies intact, every strip flat, fx 280/32/1.8 s/2.5:1. No console error.
120. **v7 back-compat.** Also `delete s.mel, s.ms, s.mlv, s.af; s.song=s.song.slice(0,16); s.pat=s.pat.slice(0,4)` → drums/chords/key/tempo load, all 6 melodies empty, Auto-fill **checked**, bars 17–32 empty, sections 5–6 empty. No console error.
121. **Unpersisted-by-design controls stay unpersisted.** Uncheck Stay-in-key, Vocal vol 140, Sync −150, check Monitor, switch to Song mode, open the Mixer → reload → **all six** return to defaults (checked / 100 / 0 ms / unchecked / Loop / mixer closed). If any now persists, the payload shape changed and the version must be bumped.
122. **Storage failure is silent but non-fatal.** Block localStorage (or Safari private) → editing, playing and exporting all still work, with no uncaught console error.

### J. Layout, CSS & tokens

123. **Design tokens present.** `['--bg','--panel','--panel2','--ink','--muted','--line','--accent','--accent2','--cyan','--green','--amber','--gold','--step'].filter(t=>!getComputedStyle(document.documentElement).getPropertyValue(t).trim())` returns an **empty array**.
124. **No page-level horizontal scroll.** At 375×812, `documentElement.scrollWidth === clientWidth === 375`; `.grid-wrap` scrolls internally (≈1030 > ≈337) and `#prScroll` scrolls internally (590 > ≈303 horizontally, 468 > ≈338 vertically).
125. **Scroll containment.** `.grid-wrap` computes `overflow-x:auto`; `#prScroll` computes `overflow:auto` with `max-height:340px`.
126. **Toast.** `toast('test')` → appears horizontally centred 28px from the bottom, slides up 20px, above all content, auto-hides after **2600 ms**; clicking through it still hits the element underneath.
127. **No unintended stacking context.** Walk the ancestors of `#toast` and `#cue` to `<html>` — none may have a computed `transform`, `filter`, `perspective`, `backdrop-filter`, `will-change` or `contain` other than `none`.
128. **Meter colours.** `.meter` background is `rgb(58,66,112)` at rest — if it renders transparent or black, `--green` was dropped from `:root`.
129. **Label-width stability.** The Play button's right edge does not move on ▶/■ swap; same for ● Record → ■ Stop; the transport does not reflow during a BPM drag.

### K. Known-defect watch items (decide deliberately; do not "fix" silently)

130. **Reverb live-vs-export mismatch.** Reverb 100 → play and note wetness → export and play the file. Today the export is dramatically wetter. After the redesign the two **must** match; verify by measuring decay-tail energy in both.
131. **Vibe reverb desync.** Press Play, click any Vibe → does the reverb jump or drop without the slider changing? Does moving the slider afterwards restore it? After the redesign, clicking a Vibe must land on exactly the same reverb level as setting the slider to that vibe's value manually.
132. **Drum volume slider desync.** Kick slider → 20, reload. Today the audio stays quiet while the slider reads **95**. Verify which behaviour you shipped.
133. **Hostile song value.** Inject `s.song[0]=9` → Song mode → Play. Today a TypeError kills the scheduler mid-bar with the audio graph still running. After hardening, bar 1 should be treated as empty and playback should continue.
134. **Negative currentPattern.** Inject `s.cp=-1` → today `applyState` throws and the app boots into a half-loaded hybrid. After hardening it should load on section 1 with the saved data intact.
135. **Bass gate semantics.** Drag Bass volume to 0 and confirm whether the bass stops being **scheduled** or merely goes to zero gain — the audits disagree (see §7.6). Record the answer.
136. **`#mixBtn` state.** Adding `.on` to `#mixBtn` currently produces zero computed-style change. Confirm whether the redesign gives the Mixer button an open-state affordance.
137. **`.fxbox .val` sizing.** `#fxRevSizeV` currently computes 14px / `--ink` / `font-variant-numeric:normal` (vs `.strip .val` at 9px / `--muted` / tabular-nums). Decide whether to unify.
138. **Vibe highlight after reload.** `document.querySelectorAll('.vibe.on').length === 0` after a warm start today. Restoring it requires a **new** serialized field.
139. **Piano-roll playhead parking.** `clearPlayhead()` does not reset `#prPH`, so after Stop the amber bar stays frozen at the last step (`left:-10px` only before first play).

---

## 7. Known gaps and risks going into the redesign

### 7.1 The v10 `reverbReturn` regression (must be decided, not inherited)

v10 redesigned reverb so the wet amount lives in each strip's send (`groupRev = REV_BASE[id]*reverbWet + user*0.6`) and `reverbReturn.gain = 1` (L519, with an explicit comment saying so). **Two v9 call sites were not updated:**

- `ensureCtx` L590: `liveBus.reverbReturn.gain.value = reverbWet;`
- `applyVibe` L963: `if(liveBus) liveBus.reverbReturn.gain.value = reverbWet;` — and it does **not** call `applyAllGroupsLive()`.

Consequences: (1) live reverb is `reverbWet²` — at the default slider 30 / moody 34 that is roughly **0.24× of intended, ~12 dB quieter** than v9 and than the exported WAV, because `exportWav` never touches `reverbReturn` and renders with the correct unity return. (2) Nothing ever restores the return to 1 for the life of the AudioContext; the `#reverb` handler only calls `applyAllGroupsLive()`, which updates sends and leaves the return frozen. (3) Clicking a Vibe changes `reverbWet` and the return but leaves every strip's `rs` send on the previous value until some other mixer interaction fires `applyGroupLive`.

**Decide explicitly:** either delete both stale writes (live then matches export and matches the v10 design comment — but every existing saved track plays drier than before), or keep them and accept quieter live reverb. Do not carry them forward unexamined, and do not "accidentally fix" them.

### 7.2 Dead / vestigial send plumbing

`bus.chordSend`, `bus.melodySend` and `bus.drumSend` are hard-set to `null` (L548), yet every call site still passes them (L570, 576, 578, 754, 756, 803, 1050) and `DRUM_SEND()` is still evaluated. The `if(send)` guards inside the voices make them no-ops. **Any redesign that reinstates non-null sends will DOUBLE the reverb**, because the channel strips already send post-fader.

### 7.3 Five unreachable progressions

`soulful`, `phrygian`, `lockdown`, `ultralight`, `soulflip` exist only as vibe payloads with no dropdown entry — a user cannot re-select them after editing. Regenerating the dropdown from `PROGS` would newly expose all five (probably fine); **pruning `PROGS` to match the dropdown would destroy the kanyesoul, tehran, heartbreak, gospel and chipmunk vibes** (`applyProg` falls through to `||[]` and places no chords, silently).

### 7.4 No version dispatch, no migration scaffolding

`o.v` is written and never read. Compatibility survives only because fields were only ever added and every read is behind an `if`. The format has **exactly one degree of freedom left**: adding new optional keys. Renaming, reordering or repurposing any existing field — especially `GROUPS` order (`mx`), `drums[]` order (`dv`), or `ALL_IDS` order (`pat`) — silently corrupts every save and every share link ever issued. If the redesign changes the group list, the version **must** finally be read and branched on.

### 7.5 `applyState` has no transaction boundary

Both call sites swallow throws (`console.warn` for the hash, completely silent for localStorage). A throw partway through — unknown `keyMode` at L1017, `pat:[null]` at L1011, negative `cp` at L1016 — leaves state partially applied; the localStorage path then does not `return true`, so `seedSong(); applyVibe('moody')` runs **on top of** the half-applied state, producing a hybrid that the next autosave (≤4 s later) writes back over the user's good save. Adding fields widens this window. The fix is validate-then-commit, but note it changes observable behaviour for corrupt saves already in the wild.

### 7.6 Contradiction to resolve before writing any code

The audio-engine audit asserts that dragging Bass volume to 0 **stops the bass being scheduled** via the `BUS_VOL.bass>0` gate at L577. The state-model and ui-interactions audits both assert the opposite: the `#bassVol` handler (L1042) writes only `liveBus.bass.gain.value`, never `BUS_VOL.bass`, so `BUS_VOL.bass` is permanently `0.6` and the guard is always true. Two of three audits agree that the guard is dead. **Verify empirically (check 135) before designing around either behaviour** — and note the corollary risk: a redesign that *starts* writing `BUS_VOL.bass` from a mixer fader would suddenly make the dead guard live and kill the bass with no visible cause.

### 7.7 Persistence gaps that look like bugs

Four controls reset on every reload: `#scaleLock` (Stay in key), `#vocalVol`, `#sync` (the per-device latency compensation the user painstakingly dialled in), `#monitor`. `mode` always returns to Loop. The active vibe's `.on` highlight is never restored. Each is tempting to "fix", but each requires a **new** serialized field and therefore a format decision — and check 121 asserts they currently *don't* persist, so fixing them is a contract change, not a bug fix.

### 7.8 Zero responsive infrastructure

There are **no `@media` queries**, no container queries, no `clamp()`, no viewport units, no `min()/max()` anywhere. Responsiveness is `flex-wrap:wrap` on 12 containers plus two internal scroll containers. A redesign introducing breakpoints starts from zero — but must not lose `.grid-wrap{overflow-x:auto}` or `.prscroll{overflow:auto}`, which are the entire mobile story. Non-responsive today: `.strip` fixed 104px (7 strips need 776px, so the mixer wraps to 2–3 rows on a phone), `.meterwrap` fixed 200px, the roll's 340px max-height regardless of screen height, `.cue` at `font-size:120px`. There is also **no sticky track-name column** in the sequencer — scrolling the 1016px grid horizontally on mobile hides which row is which. Closing that gap is desirable but notoriously buggy inside a `border-collapse:separate` table and would require replacing the table.

### 7.9 Accessibility and input-modality gaps

Right-click is the **only** way to set a drum accent or cycle note velocity — there is no touch or mobile path to either. The row-label mute affordance is a JS-set cursor + `title` with no visual indicator. The tips list (L338–344) is the app's **only** in-product documentation of right-click accenting, click-to-mute, and what Sync does; if the redesign changes those interactions the copy must change with them, and if it drops the copy the ±200 ms Sync slider becomes unexplainable. There is no `prefers-reduced-motion` handling for the `pulse` recording animation. No undo anywhere — Clear section, Clear melody, Copy→next, Clear take and Reset mixer are all one click and irreversible.

### 7.10 v10 has never been exercised by real users

The mixer CSS block (L141–165) and everything it styles has never shipped. Its measurements are **design intent, not proven behaviour** — including the four cosmetic defects (`.track-vol{width:64px}` losing on specificity and rendering at 96px; `#mixBtn.on` having no rule; `.fxbox .val` being unstyled; the `tr.divider` `colSpan` being 21 in a 21-column table where 20 is correct). Record these as pre-existing so a redesign is not later blamed for them — and so that a cleanup pass that removes the dead `.on` toggle does not remove the hook a future style would need.
