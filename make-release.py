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
    names = re.compile(r"kanye|yeezy|yeezus|donda|ultralight|watch the throne|college dropout|"
                       r"808s ?& ?heartbreak|life of pablo|jesus is king", re.I)
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
        "",
        "NOT DEPLOYED. NOT TAGGED. NOT PUSHED.",
        "Physical-device sign-off is open — see DEVICE-CHECKLIST.md (49 rows, none run).",
        "",
        "artefacts",
        "---------",
    ]
    for z in (app_zip, src_zip):
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
