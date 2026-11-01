#!/usr/bin/env python3
"""Bump the /rc/ build's version string: rc/index.html carries it 13 times (cache-busting ?v= on every script and
stylesheet) and rc/app.js once, in the APP_VERSION assignment (only that line is counted and changed: comments in
app.js may name the release being built). Refuses unless both counts are exactly right and NEW is not already in those
places, so a wrong OLD can never half-apply.

usage: qa/release/bump.py OLD NEW [--check]     (--check reports the counts and writes nothing)
"""
import os, sys

EXPECT = {'rc/index.html': 13, 'rc/app.js': 1}

def main(argv):
    args = [a for a in argv if not a.startswith('--')]
    check = '--check' in argv
    if len(args) != 2:
        print(__doc__.strip()); return 2
    old, new = args
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    texts, ok = {}, True
    pat = {'rc/index.html': lambda v: v, 'rc/app.js': lambda v: "APP_VERSION='" + v + "'"}
    for f, n in EXPECT.items():
        p = os.path.join(root, f)
        if not os.path.isfile(p):
            print(f'MISSING {f}'); ok = False; continue
        s = open(p, encoding='utf-8').read(); texts[f] = s
        c, already = s.count(pat[f](old)), s.count(pat[f](new))
        print(f'{f}: {pat[f](old)} x{c} (want {n}), {pat[f](new)} x{already} (want 0)')
        if c != n or already: ok = False
    if not ok:
        print('REFUSED: counts are not exactly right; nothing written'); return 1
    if check:
        print('check only: nothing written'); return 0
    for f, s in texts.items():
        open(os.path.join(root, f), 'w', encoding='utf-8').write(s.replace(pat[f](old), pat[f](new)))
    print(f'bumped {old} -> {new} in {len(texts)} files'); return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
