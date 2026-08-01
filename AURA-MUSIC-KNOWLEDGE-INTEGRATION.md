# Music-knowledge integration — capability ledger

Source: `Music - Knowledge.md`, 1,269 lines, two books, Parts 1–34 plus an Appendix.
Book II research verified **2026-07-31** and treated as dated throughout.

This is the disposition record. Every major capability, principle, warning and workflow in the
attachment has a row. Nothing is silently ignored — where something is not implemented, the reason
is stated and is one of: a browser cannot do it, a licence forbids it, or doing it would make Aura
dishonest.

**"Apply everything" is not "copy every platform feature."** Several rows below are deliberate
exclusions, and those are as much a part of integrating the document as the features are.

---

## Dispositions used

| Code | Meaning |
|---|---|
| **N** | Native Aura feature |
| **N+G** | Native feature plus an Aura Guide workflow |
| **G** | Aura Guide knowledge only |
| **PA** | Project-analysis intelligence (Aura reads the actual project) |
| **R** | Rights and provenance intelligence |
| **L** | Optional local-engine capability |
| **X** | External-tool routing guidance |
| **D** | Internal design principle |
| **DEF-B** | Deferred — browser limitation |
| **DEF-L** | Deferred — licensing or rights |
| **EXC** | Excluded — would be deceptive or contrary to Aura's identity |

---

# BOOK I — THE CRAFT LAYER

## Part 1 — Core reggaetón DNA

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Kick on the floor is non-negotiable | **N** | Dembow control builds four-on-the-floor and holds it | `app.js` groove builder | done |
| Snare gives the swing | **N** | Swing + Dembow move the snare onto the 3-3-2 | `app.js` | done |
| Sub-bass as pulse, not melody | **N** | Low end follows detected/most-recent harmony as a pulse | `app.js` `lowEndPlan` | done |
| Movement between bass and snare | **N** | Bass Breath opens the step before the backbeat | `app.js` | done |
| Vintage/analog flavour in the top | **N** | *Vintage* control; original Aura synthesis, descriptive names only | `app.js` sound families | done |
| Named commercial plugins as the route | **EXC** | Aura ships its own synthesis. Naming third-party plugins as the answer would send users out of the product to buy things | — | excluded |
| Minimalism over stacking | **N+G** | Mix Check + Emotion Map detect over-density; Guide entry `minimalism-first` | `knowledge/craft-rhythm.js` | done |
| Danceability as the test | **D** | Design principle behind the groove defaults | `DESIGN.md` | done |

## Part 2 — Tempo ranges

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| 80–88 slow/sensual, 92 flexible, 95–100 upbeat | **N+G** | Creative Director offers slow/mid/upbeat and suggests 92 when the user has no preference — editable | `app.js`, `knowledge/craft-rhythm.js` | done |
| Let the melody argue for the tempo | **G** | Guide entry `tempo-ranges` | `knowledge/craft-rhythm.js` | done |

## Part 3 — Dembow and kick-on-the-floor

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| The kick/snare/sub triangle | **N** | The three parts the Groove Builder always writes | `app.js` | done |
| Cut the bass before the snare | **N** | Bass Breath; measured by fixture | `fixtures/music-knowledge-qa.html` | done |

## Part 4 — The tresillo (3-3-2)

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Accents on steps 1, 4, 7 | **N** | Dembow places accents there; fixture asserts the positions | `app.js`, QA | done |
| Vary the kick/snare combination over those accents | **N** | Dembow at higher values moves more of the pattern onto them | `app.js` | done |

## Part 5 — Melody approach

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Find the sound first | **N+G** | *Find a sound* explores twelve families by feel before writing. Reachable from the Sound tab in Studio mode, and from More -> Sound, Create something and Ask Aura in Guided | `app.js` | done |
| Named preset library as the route | **EXC** | Aura has original families with descriptive names; imitating proprietary presets or panels is out | — | excluded |
| Record loose, quantise after | **G** | Guide entry; Aura quantises reconstructions and reports the movement | `knowledge/craft-song.js` | done |
| Duplicate the sound for a stripped verse | **N** | Same family, different section role, through Song Architect | `app.js` | done |
| Phone-recorded acoustic + noise reduction + width | **N** | Sampler accepts a user recording; warmth/width/filter transforms | `app.js` sampler | done |
| Pitch up/down for section variation | **N** | Sampler pitch, plus reuse of one source across sections | `app.js` | done |

## Part 6 — Bass approach

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Sine sub as the default | **N** | Aura's own bass voice | `app.js` | done |
| Find the note high, then drop it | **G** | Guide entry `find-note-high-then-drop` | `knowledge/craft-rhythm.js` | done |
| 3-of-4 grid with the fourth open | **N** | Bass Breath, measured | `app.js`, QA | done |

## Part 7 — Drums in detail

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Kick brightness, punch, "explosion" | **N** | *Heat* shapes attack and brightness on Aura's own kit | `app.js` | done |
| Layered snare (bright top + body) | **N** | Aura's snare voice with a body layer | `app.js` | done |
| Closed vs open hats; velocity variation | **N** | *Heat* varies velocity; open-hat movement in the pattern | `app.js` | done |
| Shakers over closed hats | **N** | Shaker lane with variation | `app.js` | done |
| Commercial/iconic drum packs | **DEF-L** | Aura ships no third-party samples. The genre signal is reproduced with original synthesis | — | deferred (licensing) |
| Chop a bounced section for custom fills | **N** | Sampler slicing + Transition Designer drum fills | `app.js` | done |

## Part 8 — Effects and FX toolbox

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Reverb with the lows cut, wetter verse / drier hook | **N** | *Space* control; reverb send is high-passed | `app.js` | done |
| Filter sweeps as transitions | **N** | Transition Designer: filter close, filter open | `app.js` | done |
| Saturation / clip / punch | **N** | *Punch* and *Weight* | `app.js` | done |
| Chorus for mono → stereo width | **N** | *Width* | `app.js` | done |
| Named commercial plugins | **EXC** | Aura-native controls in plain language; imitating commercial plugins is explicitly out | — | excluded |
| Mix as you create | **N+G** | Mix Check is available throughout, not at the end | `app.js` | done |

## Part 9 — Song structure and arrangement

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| The default form | **N** | Song Architect's starting arrangement, fully editable | `app.js` | done |
| Hook first, verse by subtraction | **N** | Architect builds full, derives sparse | `app.js` | done |
| Each section runs twice | **N** | Section lengths let the groove land | `app.js` | done |
| Transitions: drops, tails, sweeps, fills, breathers | **N** | Transition Designer, all thirteen types create real events | `app.js` | done |
| Outro returns to the opening, evolved | **N** | *Resolve the outro* | `app.js` | done |

## Part 10 — Vocal chops and ambience

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Chopped vocal as atmosphere, level well down | **N** | Sampler slices from the user's own recording | `app.js` | done |
| Commercial vocal-bank libraries | **DEF-L** | Aura ships none; a user may sample their own voice | — | deferred (licensing) |
| Extracting an acapella from a reference | **X** | Aura cannot separate; the Guide routes it and says so | `knowledge/tools-router.js` | done |

## Part 11 — Reference artists and producers

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| "I want it to feel like X" as direction | **D** | Aura uses emotional and structural language instead of names | `DESIGN.md` | done |
| Named artists and producers | **EXC** in product, retained in research | No artist name appears in any shipped runtime file; `make-release.py` fails the build if one does | `make-release.py` | enforced |

## Part 12 — Tool and plugin catalog

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| DAW/synth/effect/sample-library catalog | **X** | Tool Router covers the categories, not a shopping list; no affiliate links | `knowledge/tools-router.js` | done |

## Part 13 — Workflow principles

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Find the sound, then write | **N+G** | See Part 5 | — | done |
| Record loose, quantise selectively | **G** | Tight low, loose high | `knowledge/craft-song.js` | done |
| Mix as you go | **N+G** | Mix Check | — | done |
| Build twice, vary once | **N+G** | Architect section lengths; Guide entry | — | done |
| Same sound, different role | **N+G** | Sampler reuse across sections | — | done |
| Cut, don't add, for impact | **N+G** | Transition Designer + Emotion Map | — | done |
| Iconic samples over new ones | **DEF-L** | Cannot ship them; the *principle* (treat the sound well, originality is in arrangement) is Guide knowledge | — | partial by necessity |
| Collaborate at the topline stage | **D** | Lyric Studio is built for writing to a finished bed | — | done |

## Part 14 — Beginner workflow

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| The 14-step minimal viable track | **N** | *Create something* → *Finish the record* covers the same path with Aura's own steps | `app.js` | done |

## Part 15 — Lyric and vocal approach

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Song-direction read → draft → coaching note | **N** | Lyric Studio + Vocal Coach, over the user's own text | `app.js` | done |
| Bilingual / Spanglish defaults | **N+G** | English, Spanish and mixed lines counted; the convention is Guide knowledge, not enforcement | `knowledge/craft-voice.js` | done |
| Syllables to melody, stress to strong beats | **PA** | Syllable count is measured against the notes actually in the section. **Stress-to-strong-beat is NOT implemented** — no beat-strength mapping exists | `app.js` | partial |
| Open vowels hold, clusters do not, plosives punch | **PA** | Flagged on real text | `app.js` | done |
| In-the-booth coaching cues | **N** | Vocal Coach, one cue at a time, from project state | `app.js` | done |
| Refinement and translation principles | **G** | Guide knowledge. Aura does not rewrite or translate | `knowledge/craft-voice.js` | done |
| Generative lyric writing | **EXC** | Aura has no language model and will not imply one | — | excluded |

## Part 16 — The science of music

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Predictable pulse and reward | **PA** | Emotion Map measures energy, density, contrast and reward gaps | `app.js` | done |
| Leave space so a thread can be followed | **PA** | Mix Check density and vocal-space warnings | `app.js` | done |
| Delivery over craft | **D+G** | Vocal Coach never overrides a take | — | done |
| Engineering the chills moment | **N** | *Create a final lift* makes the last chorus peak, and the octave-rise transition exists. **"Hold back the first chorus" is NOT implemented** — the Architect writes one chorus pattern reused at every chorus position, so first-vs-final differentiation is not expressible | `app.js` | partial |
| Neurological claims (brain layers, dopamine, mirror neurons) | **G, reframed** | Presented as musical and perceptual guidance. Aura makes no neurological or medical claim | `knowledge/craft-song.js` | done |

## Part 17 — Vocabulary and verbatim principles

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Genre vocabulary (dembow, tresillo, topline, breather…) | **G** | Used in Aura's own copy where it teaches; explained on first use | `knowledge/*` | done |
| Verbatim principles | **D** | Several are now design rules, quoted in `DESIGN.md` as principles rather than quotations | `DESIGN.md` | done |

## Part 18 — Default operating order (craft)

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Lane → BPM → mood → build order | **N** | This *is* the Creative Director's question order | `app.js` | done |
| Track session memory across sessions | **N** | Project intention, inspectable and editable, persisted in `.aura` | `app.js` | done |

---

# BOOK II — THE TOOLS LAYER

> Everything in this book is dated research. Aura shows `Researched 2026-07-31` on anything drawn
> from it and advises re-verification before money or rights depend on it.

## Part 19 — The AI music stack map

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Five layers; classify before naming tools | **X** | Tool Router's first question | `knowledge/tools-router.js` | done |
| Decision table | **X** | Reproduced as routing logic, not as a product table | `knowledge/tools-router.js` | done |
| Lalals.com ≠ LALAL.AI | **X** | Explicit entry; the two are never conflated | `knowledge/tools-router.js` | done |

## Parts 20–23 — Platform deep dives (Lalals, Suno, Udio, the rest)

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Per-platform feature inventories | **X, generalised** | Aura routes by capability and trap, not by maintaining a feature table that rots within weeks | `knowledge/tools-router.js` | done |
| Pricing tables | **EXC from product** | Prices move monthly. Quoting them inside an offline app that ships as a download would make Aura confidently wrong. Kept in this ledger only | — | excluded by design |
| The commercial-rights trap (soundalikes non-commercial on every tier) | **R** | Prominent Tool Router entry; surfaced unprompted whenever soundalikes come up | `knowledge/tools-router.js` | done |
| Platform risk / downloads deleted overnight | **R** | Tool Router entry; also the argument for Aura's complete export | `knowledge/tools-router.js` | done |
| Determinism gap (no seeds anywhere) | **N** | Answered natively: Idea Codes | `app.js` | done |
| Open-weight self-hosting | **DEF-L** | Aura ships no model weights. Licence status of the candidates is unresolved | `aura-engine/MODEL-LICENSES.md` | deferred |

## Part 24 — The voice layer

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Three legal classes of voice | **R** | Licensed / your own / unlicensed soundalike, explained plainly | `knowledge/tools-router.js` | done |
| Voice conversion and cloning | **EXC** | Aura has neither and will not add artist soundalikes | — | excluded |
| Singing-voice synthesis from MIDI+lyrics | **DEF-B/DEF-L** | No licence-clean model to ship; Aura's answer is *your* voice | — | deferred |

## Part 25 — Stems and audio surgery

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Separation as state of the art | **X** | Routed out, with a preference for local tools; Aura reconstructs rather than separates and says so | `knowledge/tools-router.js` | done |
| Shipping a separation model | **DEF-L** | Blocked: weights excluded from their own permissive licence, dataset non-commercial, active patent | `aura-engine/MODEL-LICENSES.md` | deferred |

## Part 26 — AI mix / master / assist

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Mastering services and plugins | **X** | Routed; Aura exports full quality so mastering elsewhere loses nothing | `knowledge/tools-router.js` | done |
| Mix assistants | **N** | Mix Check in Aura's own language, acting on Aura's own controls | `app.js` | done |
| Composition assistants | **N** | Chords, melody ideas and Song Architect are native | `app.js` | done |

## Parts 27–28 — FL Studio, what it has and lacks

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Full DAW system reference | **X** | Aura is not a DAW and does not compete as one; the Router explains the boundary | `knowledge/tools-router.js` | done |
| Gap list (comping, MPE, ARA2, tempo detection) | **G** | Do not claim a tool has a feature it lacks — a Router principle | `knowledge/tools-router.js` | done |
| Interface imitation | **EXC** | Explicitly excluded | — | excluded |

## Part 29 — Cross-platform capability matrix

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| The matrix itself | **EXC from product**, kept here | It is a snapshot with a half-life of weeks. Shipping it would age badly inside a downloaded app | — | excluded by design |

## Part 30 — What nobody has yet (the gap map)

This part is the most directly actionable in the whole document, because Aura owns its synthesis and
runs locally — several of these gaps are gaps Aura can simply not have.

| Gap | Disposition | Aura's answer | Status |
|---|---|---|---|
| 1. Determinism (seeds, reproducible re-renders) | **N** | **Idea Codes** | done |
| 2. The full export bundle | **N** | **Export the complete project** | done |
| 3. True DAW integration | **DEF-B** | Aura is the room, not a plugin. Out of scope for a browser app | deferred |
| 4. Voice-clone portability | **EXC** | Aura has no cloning | excluded |
| 5. Cross-platform provenance standard | **R, partial** | Aura ships a provenance manifest for its own projects. It cannot create an industry standard | done (locally) |
| 6. Indemnification | **EXC** | Aura is software, not an insurer, and says so | excluded |
| 7. Mastering-grade unmixing | **DEF-L** | See Part 25 | deferred |
| 8. Real-time studio-grade voice conversion | **EXC** | Not Aura's identity | excluded |
| 9. AI arrangement intelligence | **N** | **Song Architect** + **Emotion Map** — proposing structure for a half-finished project is exactly this gap | done |
| 10. Rights-clean artist-voice marketplace | **EXC** | Not Aura's business | excluded |
| 11. Session-memory co-producer | **N** | **Project intention** | done |
| 12. Honest failure economics | **D** | Aura has no credits and charges nothing per idea | inherent |

## Part 31 — Rights, licensing and monetisation

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| The three questions before releasing | **R** | Rights & Sources **reports**; it does not gate. *Finish the record* marks Export blocked while an unknown source is included, but the export button still works | `app.js` | partial |
| Human authorship is what is protectable | **R** | Explained; the provenance manifest is the documentation | `knowledge/tools-router.js` | done |
| Publicity rights / soundalike exposure | **R** | Surfaced unprompted | `knowledge/tools-router.js` | done |
| Distributor and DSP policy divergence | **R** | Guide entry with a "check the week you release" instruction | `knowledge/tools-router.js` | done |
| Cross-border tax and visa specifics | **EXC** | Personal financial and immigration circumstances of one named individual. Not product knowledge, and Aura is not qualified. Left in the research | — | excluded |
| Legal advice of any kind | **EXC** | Aura states it does not give legal advice and never asserts ownership | — | excluded |

## Part 32 — Workflow blueprints

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Reference-study loop | **N+G** | This is Aura's import path: study and rebuild the feel, never the recording | `app.js` | done |
| Topline factory (generate, then re-sing it yourself) | **G** | The "re-sing it yourself" principle is Aura's model, but **no router entry exists** for this workflow | — | not built |
| Private cover / pitch demo | **G** | **No router entry exists.** The soundalike and platform-risk entries carry the adjacent caveats | — | not built |
| Full-ownership release pipeline | **N** | Closest to what Aura *is* | — | done |
| Idea-storm sprint | **G** | **No router entry exists.** "Decisions, not audio" is the principle behind the import paths, but the sprint workflow is not routed | — | not built |
| Anti-patterns | **R** | The soundalike, naming and platform-risk entries carry three of them. **The rest are not routed** | `knowledge/tools-router.js` | partial |

## Part 33 — Vocabulary (tools)

| Concept | Disposition | Status |
|---|---|---|
| Terminology (inpainting, V2V, SVS, RVC, SDR, ARA2, MPE, metatags, seed, watermark, walled garden) | **G** — explained on demand, never assumed | done |

## Part 34 — Default operating order (tools)

| Concept | Disposition | Aura interpretation | Files | Status |
|---|---|---|---|---|
| Classify → route → rights gate → platform-risk gate | **X** | The Tool Router's actual order of operations | `knowledge/tools-router.js` | done |
| Prefer determinism up the stack | **D** | Aura's design bias, stated in the Router | — | done |
| Freshness rule (re-verify past ~60 days) | **R** | Every volatile entry carries its date and says so | `knowledge/aura-knowledge.js` | done |
| Bias to finishing | **N** | **Finish the record** | `app.js` | done |

## Appendix — Verification and sources

| Concept | Disposition | Status |
|---|---|---|
| Source list and verification date | **R** | `2026-07-31` retained on every volatile entry | done |
| Items marked ⚠️ as conflicting/unverifiable | **R** | Not asserted as fact anywhere in the product | done |

---

## Summary of exclusions, and why

These are the rows where the honest answer was "no". They are decisions, not omissions.

1. **Prices, plan tables and the capability matrix** — a downloadable offline app cannot hold
   monthly-drifting commercial facts without eventually lying to someone. Kept in this ledger.
2. **Named artists, producers and preset names in the product** — retained in internal research and
   source attribution only. `make-release.py` fails the build if one reaches a shipped runtime file.
3. **Commercial sample packs and vocal banks** — cannot be licensed for redistribution.
4. **Voice cloning, voice conversion, artist soundalikes** — excluded on identity and on rights.
5. **Generative lyric writing** — Aura has no language model. Implying one would be the exact
   dishonesty Aura's Guide is built to avoid.
6. **Stem separation** — no licence-clean model exists to ship.
7. **Legal advice, ownership assurances, indemnification** — Aura is not qualified and says so.
8. **One individual's cross-border tax and visa position** — not product knowledge.
9. **Neurological and medical claims** — reframed as musical and perceptual guidance.
10. **Imitations of commercial plugin or DAW interfaces** — Aura has its own language.

## Deferred, with the reason

| Item | Reason |
|---|---|
| Fader automation rendered into the export | The offline graph reads each fader once per render; automating gains is a real change to the export path. Recorded in `AURA-STATE.md` rather than attempted blind |
| Stem separation, singing-voice synthesis, model weights of any kind | Licensing — see `aura-engine/MODEL-LICENSES.md` |
| First-party DAW plugin | A browser app cannot be a VST |
| Industry-wide provenance standard | Aura ships a local manifest; the rest is not one product's to solve |
