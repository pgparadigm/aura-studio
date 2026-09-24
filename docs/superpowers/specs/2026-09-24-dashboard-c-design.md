# Studio dashboard, sub-project C: energy that changes the music

Date: 2026-09-24 · Build base: `main` d5aa983 (13.8.0-rc.4, A and B proved live) · Owner: the "Aura
Studio" Claude session, sole writer · Status: **spec only, awaiting Philip's build word**

## The problem, measured

Apply today changes only mixer values, and every one of them is **song-wide**: reverb, the chords
channel's EQ and sends, hat and snare volume, and the chord sound. So "Apply to the Chorus" changes the
whole song, and **Intensity partly works by turning hats and snare up**, which the concept rules out
("higher energy cannot simply mean higher volume"). Meanwhile the Measured line on the energy lane is
computed only from the section's hits (`sectionMetrics`: drum hits, bass, melody and chord steps), so
Apply cannot move it at all. Target and Measured never meet.

## Goal

Pressing Apply on a section changes **that section's music** so its Measured energy moves to the
Target you set, by changing hits, accents and layers, never by making anything louder. Preview first,
one undo step, and a plain report of what changed.

## Decisions for Philip (recommendation first; the design below assumes it)

1. **May Apply remove hits you placed by hand?**
   - **Recommended: yes, in a fixed order, never the backbone.** Aura does not record which hits you
     placed and which it generated, so "only remove what Aura added" cannot be honoured without a new
     per-hit record. Instead: the downbeat kick (step 1) and the snare backbeats (steps 5 and 13) are
     never removed; everything else goes in a fixed order (shaker, open hat, off-beat hats, clap, extra
     snares, extra kicks). Preview shows it before anything is written, and one Undo restores it.
   - Alternative: Apply may only ADD hits; lowering energy only removes hits Apply added earlier. Needs
     a per-hit origin flag saved with the project (a schema change) and cannot thin a busy beat you made.
2. **What happens to the song-wide tone moves (Warmth, reverb, delay)?**
   - **Recommended: split them out and label them.** Apply changes only the selected section's music.
     Warmth, and the reverb and delay parts of Space and Movement, become a separate "Whole song" group
     with its own Apply, saying plainly that it changes every section. Per-section tone needs automation,
     which is D.
   - Alternative: keep them inside the section Apply and label the button "Apply (tone changes the whole
     song)".

## Design

### C1. What each control does to the section's music

| Control | Changes (this section only) | Never |
|---|---|---|
| **Intensity** (sets the Target) | Adds or removes drum hits and bass notes until Measured meets Target; above 60 accents the downbeat and backbeats, below 30 clears accents; below 25 drops whole top layers (shaker, open hat), above 75 brings them in | changes any channel volume |
| **Movement** | Decides *where* added hits go: high Movement prefers off-beat hats and shaker (syncopation), low Movement prefers on-beat eighths | moves bar lines or tempo |
| **Space** | Opens gaps: removes chord hits after the first of each chord change and shortens off-beat bass notes, most at high Space | removes the first chord hit of a bar or the backbone |
| **Warmth** | Nothing per section (see decision 2) | |

- **Melody is never changed by Apply**, locked or not; the Melody lock keeps its meaning for the mix
  (song-wide group). **Voice is never changed** except its reverb send, and only in the song-wide group
  with the Voice lock off.
- Hits to add come from Aura's own groove engine for the section's role (`grooveBeat` and
  `grooveLowEnd`, the same seeded code the Groove and Architect tools use), filtered to hits the section
  does not already have and ordered by musical priority: floor kick, backbeat snare, on-beat hats,
  off-beat hats (Movement), shaker (Movement), open hat on the last eighth, dembow snare ghosts, then
  bass notes.
- Hits to remove follow the fixed order in decision 1, most decorative first.
- **Deterministic.** The same section, the same starting pattern and the same slider values always
  produce the same result (the seed is derived from the section index and the three values).

### C2. Meeting the Target

- **The Target is the section's Intensity value** (0–100, read as 0–1). Both the Intensity slider and a
  stroke on the energy curve write it, as they do today; if a stroke leaves different heights on the
  bars of one section, the section's Intensity is the last value written, and the rail shows that
  number so there is one Target per section, not several.
- Apply works on a copy of the section: it adds or removes one candidate at a time, re-measuring with
  `sectionMetrics`, until Measured is within **0.03** of Target or the candidates run out. The copy is
  written in one checkpoint: **one undo step**, as today.
- **It reports what happened**, in the rail and a toast: "Chorus: target 80, measured 45 → 78. Added 9
  hats, 3 shaker, 1 clap; 2 accents." If it cannot reach the Target it says so ("reached 64 of 80: the
  section is full"), rather than claiming success.
- A section is one pattern, so **every place that section plays changes together** (the demo's two
  Verses, for example). The report names how many bars that is. Giving one occurrence its own energy
  means duplicating the section first, which is out of scope.

### C3. Target and Measured, kept apart

- The energy lane keeps both lines: Target (what you drew or set) and Measured (computed from the
  notes). Apply never writes Measured; it changes the music and the line follows.
- The rail shows both numbers for the selected section: "Target 80 · Measured 45". While previewing:
  "Preview: 78 (now 45)".

### C4. Preview that plays the new music without writing it

- Preview builds the same copy Apply would write and plays it in place of the section, without writing
  it: it remembers the section's drums, accents and bass and swaps the copy in for playback only.
- **No leak, as in A.** While previewing, `serialize()` reports the remembered section, so an autosave
  mid-preview saves the original. The swap is undone on Stop, Preview again, Apply (which then writes
  for real), another section, leaving Studio, or any whole-project load.

### C5. Honesty with B

- If Space removes every chord hit in a section, the Keys lane shows no clip for it (B3's rule: empty
  shows nothing). If Intensity drops a whole layer, the lanes follow the notes. No change to drag,
  grid or the playhead.

## Out of scope for C

Per-bar variation inside a section, per-section tone (automation), duplicating a section, clip loops
and audio editing (D), drum group and dB meters (E), changing melody or voice content.

## Verification

Test-only `qa/dashboard-c.qa.js`, RED on d5aa983 first, then GREEN, then live.

- **Meets the Target:** on a sparse section, Intensity 85 then Apply raises Measured to within 0.03 of
  0.85 or reports the ceiling; on a dense section, Intensity 15 lowers it the same way. Before and after
  numbers recorded.
- **Not louder:** every channel's volume in the saved project is identical before and after a section
  Apply.
- **Only this section:** every other section's pattern, and the whole melody, are byte-identical after
  Apply; Voice untouched.
- **Backbone kept:** the downbeat kick and any backbeat snare present before are present after, at every
  Intensity from 0 to 100 in steps of 10.
- **Deterministic:** two Applies from the same starting pattern with the same values give identical
  patterns.
- **One undo:** Apply then Undo restores `serialize()` exactly.
- **Preview no-leak:** preview confirmed playing, an autosave mid-preview saves the original section,
  Stop restores it.
- **Report is true:** the counts in the report equal the diff between the before and after patterns.
- **Mutant:** an Apply that changes only mixer values (today's) must fail "meets the Target".
- **Regression:** A's and B's tables (claims 18/18, B1 to B4) pass; ship gate at 375, 1024, 1280,
  1440 fresh plus a live shrink; network law (`fetch(` count 1).

**What these checks do not establish:** whether the result sounds better (measured, not heard);
Safari; a real finger on the sliders.

## Release

13.8.0-rc.4 → 13.8.0-rc.5. Commits on `wt/rc-fixes`; pushed to `main` only on Philip's build word, with
`main` still d5aa983 immediately before the push; proved live by hash, the gate, and the C checks.
