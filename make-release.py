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
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent
OUT = ROOT / "release"

# The shipping line, named explicitly. CLAUDE.md's architecture rule is that the public runtime is
# index.html + styles.css + app.js, with local brand assets as the one approved exception.
RUNTIME = [
    "index.html", "styles.css", "app.js",
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
TalkBack, and OGG decode. See `DEVICE-CHECKLIST.md` — 69 rows, none of them run.
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
    names = re.compile(r"kanye|yeezy|yeezus|donda|ultralight|watch the throne|college dropout|"
                       r"808s ?& ?heartbreak|life of pablo|jesus is king|(?-i:\bYE[-_](?=[A-Z]))",
                       re.I)
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

    with zipfile.ZipFile(app_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in RUNTIME:
            z.write(ROOT / f, f"aura-studio-{v}/{f}")
    with zipfile.ZipFile(src_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in files:
            z.write(ROOT / f, f"aura-studio-{v}-source/{f}")

    head = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "HEAD"],
                          capture_output=True, text=True, check=True).stdout.strip()
    branch = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--abbrev-ref", "HEAD"],
                            capture_output=True, text=True, check=True).stdout.strip()

    pub_zip = OUT / f"aura-studio-{v}-public-source.zip"
    pub = public_files(files)
    with zipfile.ZipFile(pub_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for f in pub:
            z.write(ROOT / f, f"aura-studio-{v}-public-source/{f}")
        z.writestr(f"aura-studio-{v}-public-source/PUBLIC-SOURCE-NOTES.md",
                   PUBLIC_NOTES.format(v=v, head=head[:7], branch=branch))
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
        "NOT DEPLOYED. NOT TAGGED. NOT PUSHED.",
        "Physical-device sign-off is open — see DEVICE-CHECKLIST.md (69 rows, none run).",
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

    man = OUT / f"aura-studio-{v}-manifest.txt"
    man.write_text("\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"\nwrote {man}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
