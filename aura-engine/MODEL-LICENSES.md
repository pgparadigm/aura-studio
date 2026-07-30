# Aura engine — model licence record

**Audited 2026-07-30.** Traced to primary sources on that date: repository `LICENSE` files, model cards,
maintainer statements, dataset terms, patent records.

**Aura ships no model weights.** This file exists so that a singer who wants Tier 2 can choose a model
with the evidence in front of them, and so a future session does not repeat the search.

---

## The rule this file applies

**Code licence ≠ weight licence ≠ training-data rights.** Three separate questions needing three
separate sources. A permissive `LICENSE` in a repository root says nothing about a `.th` or `.ckpt`
file, and a Hugging Face licence badge is a string a human typed into a YAML block — not a signed grant,
not an identification of the grantor, and no representation about training data.

Every candidate is traced against four questions:

1. Who holds the **code** licence?
2. Who **published the weights**, and did they grant anything?
3. What was it **trained on**, and do those terms carry forward?
4. Is there an explicit **redistribution** grant *and* an explicit **commercial** grant?

---

## Verdicts

| Model | Code | Weight grant | Training data | Verdict |
|---|---|---|---|---|
| **Demucs** — htdemucs, htdemucs_ft, htdemucs_6s, hdemucs_mmi | MIT (Meta) | **Explicitly excluded by the author** | MUSDB18 + 800 undisclosed songs | **Rejected** |
| **Demucs** — mdx, mdx_extra, *_q | MIT | same exclusion | MUSDB18-HQ; `mdx_extra` includes the **test set** | **Rejected** |
| **Spleeter** (Deezer) | MIT | **Explicit — JOSS paper states pre-trained models are MIT** | Deezer internal ("Bean"), not releasable | **Accepted (available), not adopted** |
| **Open-Unmix** `umxl` | MIT | **CC BY-NC-SA 4.0**, stated | — | **Rejected** — non-commercial |
| **Open-Unmix** `umx` / `umxhq` | MIT | none separate | MUSDB18(-HQ) only | **Rejected** |
| **UVR zoo** — Kim Vocal 2, MDX-Net, MDXC, VR arch | MIT (**GUI only**) | **none** | undisclosed | **Rejected** |
| **MSST zoo** — viperx, unwa, Gabox, aufr33, anvuew | MIT (harness only) | **none for any checkpoint** | undisclosed | **Rejected** |
| **Mel-Band RoFormer** (KimberleyJensen) | **no licence file** | HF badge `mit` only | undisclosed | **Requires legal review** |
| **BS-RoFormer** | MIT (reimplementation) | **no official weights** | — | **Prototype only** |
| **SCNet** | MIT | not stated | MUSDB | **Rejected** |
| **Bandit-v2** | Apache-2.0 | Zenodo | cinematic corpus | **Requires legal review** — cleanest rights stack found, wrong task |
| **Karaoke / lead-vs-backing models** (aufr33, becruily, Gabox, anvuew, UVR karaoke, MedleyVox and derivatives) | mixed | **none clean** | MoisesDB (CC BY-NC-SA) or undisclosed | **Rejected** — see below |

### The decisive quote

> "The model weights are not covered by the MIT license, and are provided only for scientific purposes."
> — Alexandre Défossez (`adefossez`), `facebookresearch/demucs` issue #327, **2022-05-23**

That is the person who trained Demucs, disclaiming MIT for the weights. No later statement reverses it;
the repository is archived read-only. Demucs is the default in most open stem-splitters, and this is the
single most common way a product ships something it has no right to ship.

### Lead versus backing vocals

**No licence-clean model exists for this task.** Every candidate fails on weights, training data, or
both. The only public dataset with lead/backing labels is **MoisesDB, CC BY-NC-SA 4.0** — non-commercial
*and* ShareAlike — so the gap cannot be closed by training either. This is why Aura's shipped answer is
DSP, labelled *Approximate*.

### Why Spleeter is available but not adopted

Deezer's JOSS paper states the pre-trained models are MIT, which is an explicit grant from the entity
that trained them — the only one found in this audit. Aura does not adopt it because it does not solve
the lead/backing problem, its quality is well behind 2026, and its corpus cannot be released, leaving
the derivative-work question open. Recorded here so the finding is not lost.

### The unsettled question under all of it

Whether a trained model is a derivative work of its training corpus is **unresolved in every major
jurisdiction as of 2026-07-30**. MUSDB18-HQ is the field's universal benchmark and nearly everything
touched it. Aura's position is to not depend on the answer.

---

## Patents — one hard exclusion

Licence is not the only exposure.

| Technique | Patent | Status 2026-07-30 | Aura |
|---|---|---|---|
| Mid/side, sum-and-difference | none | prior art to 1930s stereo | **used** |
| Inter-channel coherence masking | none found | textbook signal processing | **used** (Tier 1) |
| ADRess — azimuth resynthesis | US8027478B2, TU Dublin | lapsed, expires 2027-03-30 | **not used** |
| **REPET / REPET-SIM / FT2D** | **US9093056B2, Northwestern** | **ACTIVE until 2033-09-25** | **excluded — do not implement** |

**Do not implement REPET.** Its reference implementation is in `nussl/nussl`, which is MIT-licensed, so
it looks free from the `LICENSE` file. **MIT grants copyright, not patents.** The Northwestern patent
runs another seven years. This line exists so nobody adds repeated-pattern modelling later believing it
is free.

---

## If you are supplying your own model

Aura's engine will drive a model you place yourself. Before you do, satisfy yourself on all four
questions above for that specific weight file — not for the repository it came from.

You are responsible for having the right to use it. Aura does not download it, does not bundle it, does
not check it, and cannot grant you anything with respect to it.
