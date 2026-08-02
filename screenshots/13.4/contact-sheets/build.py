#!/usr/bin/env python3
"""Build the contact sheets for the 13.4 screenshot evidence.

There is no ImageMagick and no PIL on this machine, so the sheets are HTML that references the
PNGs, and the PNG version of each sheet is produced by photographing that HTML with the same
headless Chrome that took the shots. That is a feature rather than a workaround: the HTML sheet
stays readable in a browser, links straight to the full-size frame, and carries the reached/missing
verdict as text instead of leaving a viewer to guess why a tile looks wrong.

Reads   screenshots/13.4/{before,after/*}/NN-state.png
        the verdict TSV written by capture.sh
Writes  screenshots/13.4/contact-sheets/<target>.html
"""

import os
import sys
import html

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)                       # screenshots/13.4

TARGETS = [
    ("before",    "Public 13.3 — 1440x900",        "../before"),
    ("desktop",   "13.4 — 1440x900",               "../after/desktop"),
    ("phone-390", "13.4 — 390x844 (iPhone 12-15)", "../after/phone-390"),
    ("phone-320", "13.4 — 320x568 (smallest)",     "../after/phone-320"),
]

# States that genuinely have no 13.3 counterpart, each with the source evidence for saying so.
# This table exists because the first version of this script inferred "did not exist in 13.3" from
# a MISSING verdict, which is wrong twice over: `welcome` and `beat-playing` came back MISSING on a
# 13.3 build that plainly has both — transient capture failures — and captioning them as absences
# would have put a false claim under a real screenshot. A harness verdict says whether the CAPTURE
# reached the state. Only the 13.3 source says whether the state was ever there.
STATES = ["welcome", "vibes", "beat-ready", "beat-playing", "song-empty", "song-timeline",
          "melody", "vocals-empty", "vocals-armed", "vocals-take", "lyrics", "coach",
          "balance", "sound", "find-a-sound", "perform", "finish", "guide-quick",
          "guide-full", "export"]

NOT_IN_13_3 = {
    "song-timeline": "no #songTimeline in 13.3 app.js or index.html",
    "song-empty":    "the empty state belongs to #songTimeline, which 13.3 does not have",
    "guide-quick":   "13.3 has .guidesheet but zero occurrences of the quick layer",
    "vocals-take":   "13.3 has no body.has-take — a take existed, but no state was signalled",
}

CSS = """
:root{color-scheme:dark}
body{margin:0;padding:28px;background:#0B0710;color:#C9C0D1;
     font:13px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1{margin:0 0 4px;font-size:19px;color:#F0EAF6;letter-spacing:.01em}
p.sub{margin:0 0 20px;color:#9B90A8;max-width:96ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:18px}
figure{margin:0;background:rgba(255,255,255,.03);border:1px solid rgba(201,192,209,.14);
       border-radius:10px;overflow:hidden}
figure img{display:block;width:100%;height:auto;background:#0B0710}
figcaption{padding:8px 10px;font-size:12px;display:flex;gap:8px;align-items:baseline}
.n{color:#6E6579;font-variant-numeric:tabular-nums}
.name{color:#F0EAF6;font-weight:600}
.v{margin-left:auto;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
.ok{color:#7BD88F}.missing{color:#D4B26C}.gone{color:#6E6579}
.absent{padding:38px 12px;text-align:center;color:#6E6579;font-size:12px;
        border-bottom:1px solid rgba(201,192,209,.14)}
"""


def load_verdicts(tsv):
    out = {}
    if not os.path.exists(tsv):
        return out
    with open(tsv) as fh:
        for i, line in enumerate(fh):
            if i == 0:
                continue
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                out[(parts[0], parts[1])] = parts[2]
    return out


def build(target, title, reldir, verdicts):
    absdir = os.path.normpath(os.path.join(HERE, reldir))
    have = {}
    if os.path.isdir(absdir):
        for f in os.listdir(absdir):
            if f.endswith(".png"):
                have[f[:-4].partition("-")[2]] = f
    # Enumerate the canonical twenty rather than the directory. Listing files makes a sheet that
    # silently shrinks: 13.3's vocals-take frame came back as Chrome's broken-page placeholder, and
    # deleting it would have left a nineteen-tile sheet that looked complete. A row with no frame
    # and a reason is evidence; a row that quietly is not there is not.
    tiles = []
    for i, state in enumerate(STATES, 1):
        f = have.get(state)
        num = "%02d" % i
        verdict = verdicts.get((target, state), "?")
        if verdict == "OK":
            cls, label = "ok", "reached"
        elif target == "before" and state in NOT_IN_13_3:
            cls, label = "gone", "not in 13.3"
        else:
            # Deliberately NOT "did not exist": all this says is that the harness failed to reach
            # it. Claiming absence needs the source evidence in NOT_IN_13_3.
            cls, label = "missing", "not captured"
        if f:
            frame = ('<a href="{d}/{f}"><img src="{d}/{f}" alt="{s}" loading="lazy"></a>'
                     .format(d=reldir, f=f, s=html.escape(state)))
        else:
            why = NOT_IN_13_3.get(state, "no frame was produced")
            frame = '<div class="absent">no frame &mdash; {w}</div>'.format(w=html.escape(why))
        tiles.append(
            '<figure>{fr}<figcaption><span class="n">{n}</span><span class="name">{s}</span>'
            '<span class="v {c}">{l}</span></figcaption></figure>'.format(
                fr=frame, n=html.escape(num), s=html.escape(state),
                c=cls, l=html.escape(label)))
    body = (
        '<h1>{t}</h1>\n<p class="sub">Twenty named states, captured from the shipped runtime by '
        'headless Chrome at exactly this viewport. The verdict on each tile is the capture '
        'harness\'s own report of whether it reached the state it names &mdash; it is not a '
        'judgement about the design. Click a frame for full size.</p>\n'
        '<div class="grid">\n{g}\n</div>'
    ).format(t=html.escape(title), g="\n".join(tiles))
    page = ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\" />\n"
            "<title>Aura Studio 13.4 contact sheet &mdash; {t}</title>\n<style>{c}</style>\n"
            "</head>\n<body>\n{b}\n</body>\n</html>\n").format(
                t=html.escape(title), c=CSS, b=body)
    out = os.path.join(HERE, target + ".html")
    with open(out, "w") as fh:
        fh.write(page)
    return out, len(tiles)


def main():
    tsv = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "verdicts.tsv")
    verdicts = load_verdicts(tsv)
    if not verdicts:
        sys.stderr.write("warning: no verdicts read from %s — every tile will show '?'\n" % tsv)
    for target, title, reldir in TARGETS:
        path, n = build(target, title, reldir, verdicts)
        print("%-10s %2d frames -> %s" % (target, n, os.path.basename(path)))


if __name__ == "__main__":
    main()
