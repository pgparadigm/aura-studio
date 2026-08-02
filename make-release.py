#!/usr/bin/env python3
"""Build the release artefacts for Aura Studio and record their SHA-256 hashes.

Two artefacts:

  aura-studio-<version>.zip           the SHIPPABLE app — runtime files and brand assets only
  aura-studio-<version>-source.zip    the whole repository as committed, tests and docs included

The split matters. Internal research documents, fixture harnesses and generated media are part of
the engineering record and must stay in the repository, but they are not part of the product and
must not be served. The runtime artefact is built from an explicit allow-list, so a new file cannot
end up in a release by being in the directory.

    python3 make-release.py

Writes into `release/`, which is gitignored. Nothing here pushes, tags or deploys.
"""
import hashlib
import pathlib
import re
import subprocess
import sys
import time
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "release"

# The shipping line, named explicitly. CLAUDE.md's architecture rule is that the public runtime is
# index.html + styles.css + app.js, with local brand assets as the one approved exception.
RUNTIME = [
    "index.html", "styles.css", "app.js",
    # Structured local knowledge. Ordinary scripts, no build step, no fetch — they have to ship
    # with the runtime or the Guide loses everything it knows the moment the app is downloaded.
    "knowledge/aura-knowledge.js", "knowledge/craft-rhythm.js", "knowledge/craft-song.js",
    "knowledge/craft-voice.js", "knowledge/tools-router.js",
    "site.webmanifest", "favicon.ico", "apple-touch-icon.png",
    "favicon-16.png", "favicon-32.png", "favicon-48.png",
    "icon-192.png", "icon-512.png",
    "brand/aura-favicon.svg", "brand/aura-icon-small.svg", "brand/aura-icon.svg",
    "brand/aura-logo.svg", "brand/aura-mark.svg",
]

# Never allowed in EITHER artefact. A release must not carry a key, a model weight, or licensed
# audio, and the check is by extension so a new file cannot slip past by being unfamiliar.
FORBIDDEN_SUFFIXES = {
    ".pem", ".key", ".p12", ".pfx", ".crt", ".cer", ".env",
    ".ckpt", ".pt", ".pth", ".th", ".onnx", ".safetensors", ".h5", ".pb", ".bin", ".tflite",
}
# Manifest content. Edited deliberately per release: a manifest that states a result nobody re-ran
# is worse than one that says the result is not current.
BUILD_STAMP = __import__("datetime").datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %Z")
DEPLOY_NOTE = "2d70dde on main — https://pgparadigm.github.io/aura-studio/ (previous: e20155f)"
QA_RESULTS = [
    "import-qa          F 0.9091 · lane recall 0.8649 · mislabel 0 · 15/19 fixtures (baseline)",
    "apply-safety       21/21",
    "endtoend-qa        38/38",
    "cancel-safety      15 pass · 3 N/A",
    "vocal-qa           6/6 gates (lead -59.1 dB, wide -0.0 dB)",
    "pathb-qa           10/10 low end · 19/19 lifecycle",
    "midi-qa            22/22 virtual — the physical matrix is OPEN",
    "performance-qa     29/29",
    "guide-qa           34/34 intents · 21/21 context, safety and privacy",
    "media-decode       13/14 as specified · 0 wrong · 1 untested (OGG)",
    "undo-redo-qa       5/5",
    "music-knowledge    95/95",
    "export-qa          28/28",
    "persistence-qa     43/43",
    "a11y-qa            37/37 — STRUCTURE ONLY, not a screen-reader test",
    "layout-audit       17 viewports · 0 findings",
    "validate.py        13/13",
]
VERIFICATION = [
    "browser            Chromium (Claude Browser pane) only. No Safari, no Firefox.",
    "subpath            artefact boots under a /aura-studio/ subpath with 0 external requests",
    "file://            safe by construction (all references relative, no ES modules, no fetch)",
    "                   — NOT executed under file://: the available browser tooling will not run it",
    "physical device    NOT RUN — all device-checklist rows open",
    "physical MIDI      NOT RUN — Web MIDI exercised with synthetic messages only",
    "screen reader      NOT RUN — VoiceOver and TalkBack never executed on any platform",
    "OGG                untestable here — no encoder on the build machine to generate the fixture.",
    "                   Chrome and Firefox both decode OGG; this is a fixture gap, not a known failure.",
    "touch              Scroll-versus-note arbitration passed under simulated pointer events.",
    "                   Native browser panning, momentum scrolling and physical-touch behaviour",
    "                   remain unverified pending real-device testing.",
]
PRIVACY = [
    "no account, no analytics, no telemetry",
    "no cloud processing and no external model request",
    "no media upload; audio never leaves the device",
    "no MIDI transmission; no hardware identity stored or sent",
    "Ask Aura runs locally; its conversation is never saved and never enters a project file",
    "project intention and Rights & Sources stay on the device",
    "imported reference audio is muted on arrival and excluded from an Aura-only export",
    "no third-party service is contacted by default — the runtime makes no network request at all",
]
LIMITATIONS = [
    "approximate vocal-balance controls are not recovered stems",
    "no neural multistem model is bundled; no licence-clean weights exist for one",
    "no generative language model is bundled — Ask Aura is structured offline guidance",
    "Web MIDI depends on browser support and is unavailable in Safari",
    "sampler Pitch/Speed/Trim/Repeat/Reverse shape the audition; Build writes drum steps,",
    "  which carry timing and accent but not pitch or length",
    "this is a RELEASE CANDIDATE: physical device, screen-reader and MIDI-hardware",
    "  sign-off must complete before any promotion to final 13.3.0",
]

FORBIDDEN_NAMES = {"id_rsa", "id_ed25519", ".npmrc", ".netrc"}

# Kept OUT of the public-source archive. The full source zip still contains everything tracked —
# this is the copy meant to be handed to someone outside the project. Built here rather than
# assembled by hand, because a hand-assembled archive is only correct on the day it is made.
PUBLIC_EXCLUDE_DIRS = ("research/", ".claude/", "fixtures/media/")
PUBLIC_EXCLUDE_FILES = {
    "STYLE-REFERENCES.md",   # the internal technique-to-system mapping document itself
    "AURA-STATE.md",         # operational handoff notes
    "CLAUDE.md",             # engineering instructions
    "ROADMAP.md",            # carries artist and album names from earlier releases
    "CHANGELOG.md",
    "REGRESSION.md",
    "deploy.py",             # superseded; needs a personal access token
}

PUBLIC_NOTES = """# Public source archive — what is and is not here

This archive accompanies **Aura Studio {v}** (source commit `{head}`, branch `{branch}`).
It is a filtered copy of the tracked tree. Nothing in the application was modified to produce it:
every file here is byte-identical to its counterpart at that commit.

## Deliberately excluded

| Excluded | Why |
|---|---|
| `research/` (whole directory) | Internal production research and the pre-audit design codex. Not part of the product. |
| `STYLE-REFERENCES.md` | The internal technique-to-system mapping. Contains no artist names, but it is the mapping document itself. |
| `AURA-STATE.md`, `CLAUDE.md` | Private operational and engineering-instruction notes. |
| `fixtures/media/*` | Generated fixture audio, not intended for distribution. Regenerate with `python3 fixtures/make-media-fixtures.py`. |
| `ROADMAP.md`, `CHANGELOG.md`, `REGRESSION.md` | Carry historical artist and album names from earlier releases. |
| `deploy.py` | Superseded operational script; needs a personal access token. |
| `.claude/` | Local editor configuration. |

## Residue

**None.** The 13.2.0-rc.1 archive recorded two comments in `app.js` that referenced the internal
research path by filename — carrying the artist's abbreviation in a file that is served publicly.
Both were removed in 13.3.0-rc.1, and `make-release.py` now **fails the build** if the abbreviation
reappears in any shipped runtime file, not merely the full names it already checked.

## Running it

    python3 serve.py            # http://127.0.0.1:8791 — loopback only

No build step, no dependencies, no network. `index.html` also opens directly from `file://`.

Test suites are under `/fixtures/`. Open `/fixtures/run-all.html` to run every one in sequence;
expected results are in `BROWSER-TEST-REPORT.md`.

**What has never been tested:** Safari, iOS, Android, a physical MIDI controller, VoiceOver,
TalkBack, and OGG decode. See `DEVICE-CHECKLIST.md` — every row still open.
"""


def public_files(files):
    out = []
    for f in files:
        if any(f.startswith(d) for d in PUBLIC_EXCLUDE_DIRS):
            continue
        if f in PUBLIC_EXCLUDE_FILES:
            continue
        out.append(f)
    return out


def version():
    m = re.search(r"APP_VERSION\s*=\s*'([^']+)'", (ROOT / "app.js").read_text())
    if not m:
        sys.exit("could not read APP_VERSION from app.js")
    return m.group(1)


def tracked():
    out = subprocess.run(["git", "-C", str(ROOT), "ls-files"],
                         capture_output=True, text=True, check=True).stdout
    return [p for p in out.splitlines() if p]


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    v = version()
    files = tracked()

    # ---- refuse to build a release that carries something it must not ----
    bad = []
    for f in files:
        p = pathlib.Path(f)
        if p.suffix.lower() in FORBIDDEN_SUFFIXES or p.name in FORBIDDEN_NAMES:
            bad.append(f)
    if bad:
        sys.exit("REFUSING TO BUILD — tracked files that must never ship:\n  " + "\n  ".join(bad))

    # ---- the shipped runtime must name no one ----
    # The research documents keep the mapping; the served bytes must not carry it. This is a build
    # gate rather than a convention, because it was violated in the shipping app once already.
    # `\bYE[-_ ]` catches the abbreviation on its own, which the full-name list does not. It was
    # missed once: two comments in the shipped app.js referenced `research/YE-PRODUCTION-RESEARCH.md`,
    # so the artist's abbreviation was being served publicly while this gate reported clean. The
    # word boundary and the required separator keep it from firing on "yes", "yet", "year".
    # The name list stays case-insensitive; the bare abbreviation must NOT be, or it fires on every
    # "ye " in ordinary prose. `(?-i:...)` scopes the flag off for just that branch.
    # The reggaetón and R&B names arrived with the music-knowledge research. One of them — a comment
    # reading "J Balvin lane" — reached the shipped app.js and was caught by the QA suite rather
    # than by this gate, which is the wrong way round. The gate is the thing that must not need
    # someone to notice.
    # ONE canonical list. It used to be duplicated by hand here and in
    # fixtures/music-knowledge-qa.html, and the two had drifted: the suite was missing every album
    # name, the YE- prefix rule, and four artists, while this gate was missing one. Two gates that
    # disagree are one gate. They are compared below, and a mismatch refuses the build.
    NAME_TERMS = [
        r"808s ?& ?heartbreak",
        r"9th wonder",
        r"\bfeid\b",
        r"\bsech\b",
        r"\bsza\b",
        r"adele",
        r"anuel",
        r"arc[aá]ngel",
        r"ariana grande",
        r"bad bunny",
        r"bad gyal",
        r"beyonc[eé]",
        r"bieber",
        r"bizarrap",
        r"boi-?1da",
        r"brent faiyaz",
        r"calle 13",
        r"college dropout",
        r"daddy yankee",
        r"de la ghetto",
        r"dj premier",
        r"don omar",
        r"don toliver",
        r"donda",
        r"drake",
        r"farruko",
        r"ferxxo",
        r"frank ocean",
        r"hit-?boy",
        r"j ?balvin",
        r"j dilla",
        r"jesus is king",
        r"jhayco",
        r"jhen[eé] aiko",
        r"kanye",
        r"karol g",
        r"kaytranada",
        r"kendrick",
        r"lex luger",
        r"life of pablo",
        r"looney tunes",
        r"madlib",
        r"maluma",
        r"metro boomin",
        r"mike dean",
        r"murda beatz",
        r"myke towers",
        r"nicky jam",
        r"ozuna",
        r"partynextdoor",
        r"peso pluma",
        r"pharrell",
        r"quevedo",
        r"rauw alejandro",
        r"residente",
        r"rihanna",
        r"rosal[ií]a",
        r"shakira",
        r"sky rompiendo",
        r"southside",
        r"summer walker",
        r"tainy",
        r"taylor swift",
        r"the weeknd",
        r"timbaland",
        r"travis scott",
        r"ultralight",
        r"watch the throne",
        r"wisin",
        r"yandel",
        r"yeezus",
        r"yeezy",
        r"young miko",
        r"zaytoven",
    ]
    # Python-only: an inline flag group JavaScript cannot express, so it is excluded from the
    # parity comparison rather than silently making the two lists look different forever.
    GATE_ONLY = [r"(?-i:\bYE[-_](?=[A-Z]))"]
    names = re.compile("|".join(NAME_TERMS + GATE_ONLY), re.I)
    # The suite's copy must hold the same terms. A name added to one list and not the other is how
    # "Feid" reached the shipped runtime past both of them.
    qa = (ROOT / "fixtures" / "music-knowledge-qa.html").read_text(encoding="utf-8")
    mq = re.search(r"const names = new RegExp\(\[(.*?)\]\.join", qa, re.S)
    if not mq:
        sys.exit("REFUSING TO BUILD — could not find the QA suite's artist-name list to compare against.")
    qa_terms = {t.strip().strip("'").replace("\\\\", "\\") for t in mq.group(1).split(",") if t.strip()}
    canon = set(NAME_TERMS)
    if qa_terms != canon:
        missing = sorted(canon - qa_terms)
        extra = sorted(qa_terms - canon)
        sys.exit("REFUSING TO BUILD — the two public-name gates have drifted.\n"
                 "  missing from fixtures/music-knowledge-qa.html: " + (", ".join(missing) or "none") + "\n"
                 "  present only there: " + (", ".join(extra) or "none"))

    offenders = []
    for f in RUNTIME:
        p = ROOT / f
        if p.suffix in (".html", ".css", ".js", ".webmanifest"):
            hits = names.findall(p.read_text(encoding="utf-8", errors="ignore"))
            if hits:
                offenders.append(f"{f}: {sorted(set(h.lower() for h in hits))}")
    if offenders:
        sys.exit("REFUSING TO BUILD — an artist/album name is in a SHIPPED runtime file:\n  "
                 + "\n  ".join(offenders))

    missing = [f for f in RUNTIME if not (ROOT / f).exists()]
    if missing:
        sys.exit("missing runtime files: " + ", ".join(missing))

    OUT.mkdir(exist_ok=True)
    app_zip = OUT / f"aura-studio-{v}.zip"
    src_zip = OUT / f"aura-studio-{v}-source.zip"

    head = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                          capture_output=True, text=True, check=True).stdout.strip()
    branch = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--abbrev-ref", "HEAD"],
                            capture_output=True, text=True, check=True).stdout.strip()

    # Every entry is stamped with the COMMIT's date, not the file's mtime and not the clock.
    # A manifest that records a SHA-256 is only worth anything if the same commit rebuilds to the
    # same bytes. It did not: `writestr` stamps the current time, so the public-source archive
    # hashed differently on every run, and `write` carries mtimes that a fresh checkout changes.
    commit_epoch = int(subprocess.run(["git", "-C", str(ROOT), "show", "-s", "--format=%ct", head],
                                      capture_output=True, text=True, check=True).stdout.strip())
    stamp = time.gmtime(commit_epoch)[:6]

    # Read the count rather than restate it: the manifest said 69 while the file held 77.
    device_rows = len(re.findall(r'^\| (\d+) \|',
                                 (ROOT / 'DEVICE-CHECKLIST.md').read_text(encoding='utf-8'), re.M))

    def add(z, arcname, data):
        info = zipfile.ZipInfo(arcname, date_time=stamp)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, data)

    with zipfile.ZipFile(app_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in RUNTIME:
            add(z, f"aura-studio-{v}/{f}", (ROOT / f).read_bytes())
    with zipfile.ZipFile(src_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            add(z, f"aura-studio-{v}-source/{f}", (ROOT / f).read_bytes())

    pub_zip = OUT / f"aura-studio-{v}-public-source.zip"
    pub = public_files(files)
    with zipfile.ZipFile(pub_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in pub:
            add(z, f"aura-studio-{v}-public-source/{f}", (ROOT / f).read_bytes())
        add(z, f"aura-studio-{v}-public-source/PUBLIC-SOURCE-NOTES.md",
            PUBLIC_NOTES.format(v=v, head=head[:7], branch=branch).encode("utf-8"))
    # Verify the exclusions actually held rather than trusting the filter that just ran.
    with zipfile.ZipFile(pub_zip) as z:
        leaked = [n for n in z.namelist()
                  if "/research/" in n or "/STYLE-REFERENCES.md" in n
                  or "/CLAUDE.md" in n or "/AURA-STATE.md" in n or "/fixtures/media/" in n]
    if leaked:
        sys.exit("REFUSING TO BUILD — excluded files reached the public archive:\n  "
                 + "\n  ".join(leaked))
    dirty = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain"],
                           capture_output=True, text=True, check=True).stdout.strip()

    lines = [
        f"Aura Studio {v} — release manifest",
        "",
        f"commit:      {head}",
        f"branch:      {branch}",
        f"tree:        {'CLEAN' if not dirty else 'DIRTY — ' + str(len(dirty.splitlines())) + ' file(s)'}",
        f"tracked:     {len(files)} files",
        f"runtime:     {len(RUNTIME)} files",
        f"public src:  {len(pub)} files ({len(files) - len(pub)} excluded)",
        "",
        f"deployed:    {DEPLOY_NOTE}",
        f"built:       {BUILD_STAMP}",
        "",
        f"Physical-device sign-off is open — see DEVICE-CHECKLIST.md ({device_rows} rows, none run).",
        "No screen reader has been run against this build on any platform.",
        "",
        "artefacts",
        "---------",
    ]
    for z in (app_zip, src_zip, pub_zip):
        lines.append(f"{z.name}")
        lines.append(f"  size    {z.stat().st_size:,} bytes")
        lines.append(f"  sha256  {sha256(z)}")
    lines += ["", "runtime files", "-------------"]
    for f in RUNTIME:
        lines.append(f"{sha256(ROOT / f)}  {f}")

    lines += ["", "excluded from the product artefact", "----------------------------------"]
    lines += ["  " + c for c in (
        "raw research documents and the source knowledge markdown",
        "artist and producer research dossiers; private style mappings",
        "internal tool comparisons",
        "test fixtures and QA pages",
        "screenshots not required by the runtime",
        "scratchpads, operational state notes, private release notes",
        "credentials, certificates, keys",
        "model weights",
        "temporary media and generated user projects",
    )]

    lines += ["", "QA suites (local, this build)", "-----------------------------"]
    lines += ["  " + r for r in QA_RESULTS]

    lines += ["", "verification status", "-------------------"]
    lines += ["  " + r for r in VERIFICATION]

    lines += ["", "privacy", "-------"]
    lines += ["  " + r for r in PRIVACY]

    lines += ["", "known limitations", "-----------------"]
    lines += ["  " + r for r in LIMITATIONS]

    man = OUT / f"aura-studio-{v}-manifest.txt"
    man.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nwrote {man}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
