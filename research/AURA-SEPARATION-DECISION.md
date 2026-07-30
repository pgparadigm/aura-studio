# Aura Studio — source separation: the decision

**Audited 2026-07-30.** Every licence claim below was traced to a primary source on that date — repository
`LICENSE` files, model cards, maintainer statements, dataset terms and patent records. Where a source
could not be found, that is recorded as the finding rather than filled in.

The question was never "what sounds best". It was: **what can Aura ship to a singer, running entirely on
their own machine, without shipping something we have no right to ship.**

---

## 1. The decision

**Two tiers. Aura ships no model weights at all.**

### Tier 1 — Vocal balance, in the browser, always available

Pure DSP on the stereo field, implemented in `app.js`. No model, no download, no install, no engine.
It ships enabled and it is the only separation the product depends on.

A finished record almost always puts the lead vocal dead centre and spreads backing vocals, adlibs and
responses wider. Aura measures, per frequency bin, how much the two channels agree —

    agreement = 2·|L·conj(R)| / (|L|² + |R|²)

— which is 1 when a bin is identical in both channels and 0 when they are unrelated, then uses a soft
mask over that. Four choices reach the singer: *Everything*, *Music only*, *Music and adlibs*,
*Lead voice only*.

**Why this and not something better:** because there is nothing better that Aura is allowed to ship.
See §2.

**What it honestly does and does not do** is stated in the interface, not buried here:

- It removes what is **centred**, which is usually the lead voice — and also the kick and the bass,
  which are centred too. The result is thinner in the middle. Aura says so.
- It keeps what is **wide**, which is usually the adlibs and harmonies. That is the entire reason
  *remove the lead, keep the adlibs* is possible at all without a model.
- A lead vocal that is not mathematically centred — a stereo widener, a chorus, a doubled lead panned
  a few degrees, a stereo reverb tail — **survives**. The most audible failure is a ghostly
  reverb-only lead sitting under the adlibs.
- On a **mono** recording it can do nothing at all. Aura measures inter-channel correlation up front
  and **refuses with an explanation** rather than returning silence or an unchanged file.

It is labelled **Approximate** in the interface, every time, and confidence is reported as the measured
stereo width of that specific recording — so a narrow master reads low, which is the truth.

### Tier 2 — Optional local engine, weights supplied by the user

`aura-engine/` is a loopback-only companion the singer may install. Aura ships the adapter and the job
lifecycle. **It ships no weights and downloads none.** If the singer has a model they have the right to
use, the engine can drive it; if they have not, Tier 1 still works and the browser app is unaffected.

This is the "**User-supplied only**" category. It is not a blocker — it is the only arrangement that is
both honest and useful, given §2.

---

## 2. Why Aura ships no weights

### 2.1 Demucs — the field's default — is not licensed for this

Demucs is the model almost every open stem-splitter uses. Its **code** is MIT. Its **weights are not**,
in the words of the person who trained them.

> "The model weights are not covered by the MIT license, and are provided only for scientific purposes."
> — Alexandre Défossez (`adefossez`), `facebookresearch/demucs` issue #327, 2022-05-23

There is no later statement reversing it, and the repository is now archived read-only. The weights are
additionally trained on MUSDB18 (non-commercial research terms) plus 800 songs of undisclosed internal
provenance. **Rejected.** A permissive `LICENSE` file in the repository root does not grant the weights,
and this is the single most common way a product ships something it may not.

### 2.2 The rest

| Candidate | Code | Weights | Verdict |
|---|---|---|---|
| Demucs (htdemucs, htdemucs_ft, mdx, mdx_extra) | MIT | Author excludes them from MIT; MUSDB18 + undisclosed data | **Rejected** |
| Spleeter (Deezer) | MIT | JOSS paper states pre-trained models are MIT — the only explicit grant found | **Accepted for bundling, not adopted** — see below |
| Open-Unmix `umxl` | MIT | CC BY-NC-SA 4.0, explicit | **Rejected** — non-commercial |
| Open-Unmix `umx` / `umxhq` | MIT | No separate grant; MUSDB18-only training | **Rejected** |
| UVR model zoo (Kim Vocal 2, MDX-Net, VR arch) | MIT (GUI code only) | No grant, undisclosed training data | **Rejected** |
| MSST zoo (viperx, unwa, Gabox, aufr33, anvuew) | MIT (harness only) | No grant for any checkpoint | **Rejected** |
| Mel-Band RoFormer (KimberleyJensen) | none in repo | Hugging Face `mit` badge only | **Requires legal review** |
| BS-RoFormer | MIT (reimplementation) | No official weights | **Prototype only** |
| Bandit-v2 | Apache-2.0 | Zenodo weights — cleanest rights stack found | **Requires legal review** — and it is the wrong task |

**Spleeter is the one candidate Aura could legitimately bundle** — Deezer's JOSS paper states the
pre-trained models are MIT, which is an explicit grant from the entity that trained them. Aura does not
adopt it because it does not solve the problem Aura actually has (§3), its quality is well behind the
2026 state of the art, and its training corpus cannot be released, leaving the derivative-work question
open. Recorded as **Accepted (available) but not adopted**, so a future session does not have to redo
the search.

### 2.3 The question underneath all of them

Whether a trained model is a derivative work of its training corpus is **unsettled in every major
jurisdiction as of 2026-07-30**. MUSDB18-HQ is the field's universal benchmark and nearly every model
touched it. Aura's position is to not depend on the answer.

---

## 3. Lead versus backing vocals — the honest ceiling

**There is no licence-clean model that separates a lead vocal from backing vocals and adlibs. Not one.**

Every candidate that does this task — the karaoke Roformers, the UVR karaoke models, MedleyVox and its
derivatives — fails on weights, training data, or both. The only public dataset with lead/backing labels
is **MoisesDB, CC BY-NC-SA 4.0**: non-commercial *and* ShareAlike. There is no permissively licensed
lead/backing corpus in existence, so Aura cannot train its way out either.

**Therefore Tier 1 is not a stopgap. It is the ceiling of what can be shipped**, and the interface says
"Approximate" because that is the accurate word, not because of caution.

### What Aura must never say

Not "perfectly clean", not "studio-original stem", not "exact adlib isolation", not "flawless removal",
not "recovered master vocal", and never the word **stem** for a Tier 1 result. What Aura says instead:

> Aura tells the voice from the music by where it sits in the stereo picture. A lead voice is usually
> dead centre and adlibs are usually spread wider.
>
> This is not a separated stem. Aura is reshaping your recording, and centred instruments — the kick and
> the bass especially — go quieter along with the voice.

---

## 4. Patents — one hard exclusion

Licence is not the only exposure. Two of the six candidate DSP techniques are patented.

| Technique | Patent | Status 2026-07-30 | Aura |
|---|---|---|---|
| Mid/side, sum-and-difference | none | prior art to 1930s stereo | **used** |
| Inter-channel coherence masking | none found | textbook signal processing | **used** — this is what Tier 1 implements |
| ADRess (azimuth resynthesis) | US8027478B2, TU Dublin | lapsed, expires 2027-03-30 | **not used** |
| **REPET / REPET-SIM / FT2D** | **US9093056B2, Northwestern** | **ACTIVE until 2033-09-25** | **excluded — do not implement** |

**REPET is the trap.** Its reference implementation lives in `nussl/nussl`, which is MIT-licensed, so a
developer greps for "REPET", finds MIT code, and ships an infringement that is invisible from the
`LICENSE` file. **MIT grants copyright, not patents.** Aura does not implement repeated-pattern
modelling, and this line exists so nobody adds it later thinking it is free.

Aura's Tier 1 computes a normalised inter-channel coherence per bin and applies a soft mask. It does not
sweep gain-scaling factors and does not build a frequency-azimuth plane, so it is not practising
ADRess's claims either.

---

## 5. The separation table

| | technically possible | legally distributable | commercially usable | ordinary hardware | in a browser | via local companion | only in the cloud |
|---|---|---|---|---|---|---|---|
| **Aura Tier 1 — coherence mask** | yes, limited | **yes** | **yes** | yes | **yes** | n/a | no |
| Demucs htdemucs | yes, good | **no** | **no** | yes, slow on CPU | no | yes | — |
| Spleeter | yes, dated | **yes** | **yes** | yes | no | yes | — |
| Open-Unmix umxl | yes | **no** | **no** | yes | no | yes | — |
| UVR / MSST karaoke models | yes, best available | **no** | **no** | GPU realistically | no | yes | — |
| MedleyVox (lead/backing) | yes, research-grade | **no** | **no** | GPU | no | yes | — |
| Commercial APIs | yes, best | n/a | yes | n/a | n/a | no | yes — **and they require uploading the singer's audio, which is the one thing Aura will not do** |

---

## 6. What Aura ships, precisely

- **Code:** the Tier 1 coherence-mask separator in `app.js`; the `aura-engine/` companion and its
  adapter interface.
- **Weights:** **none.** Aura downloads none, bundles none, and no code path fetches one.
- **The user supplies:** if they want Tier 2, a model they have the right to use, placed where the
  engine can find it. `aura-engine/MODEL-LICENSES.md` records what has been audited so they can choose
  with the evidence in front of them.
- **With nothing installed:** everything works. Tier 1, the whole reconstruction path, the sampler,
  recording, export. The engine is never a precondition for anything.

---

## 7. Blockers

**None that stop this release.**

The only genuine finding is that **no licence-clean lead/backing model exists**, which does not block
shipping — it fixes the ceiling and it fixes the wording. Tier 1 delivers *remove the lead, keep the
adlibs* at the strongest technically honest level, labelled Approximate, with the confidence tied to a
measurement of the recording rather than to a constant.

A future session should re-audit if any of these change: a permissively licensed lead/backing corpus
appears; Meta or a successor restates the Demucs weight licence; a model publisher issues an explicit
redistribution *and* commercial grant with disclosed training data.
