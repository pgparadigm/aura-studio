#!/usr/bin/env python3
"""Aura Studio — repository-local static server for testing.

Serves THIS repository, resolved from this file's own location, so it works no matter what the
caller's working directory happens to be. That is the whole point: the previous session had to put a
session-specific mirror path into a config file *outside* the repository because a plain
`python3 -m http.server` inherits the caller's CWD. Nothing outside this repository should ever have
to be edited to run Aura's tests.

    python3 serve.py            # http://127.0.0.1:8791
    python3 serve.py 8080

Then open:
    /index.html                     the app
    /fixtures/import-qa.html        reconstruction engine suite
    /fixtures/apply-safety.html     apply / undo / discard suite
    /fixtures/layout-audit.html     responsive layout audit

Loopback only, no directory listing above the repository, no caching, no logging of anything but the
request line. It serves static files and nothing else — there is no upload path and no execution.
"""
import http.server
import os
import socketserver
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        # Tests reload constantly; a cached app.js silently measures the previous build.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
    socketserver.TCPServer.allow_reuse_address = True
    # 127.0.0.1, never 0.0.0.0: this must not be reachable from another device on the network.
    with socketserver.TCPServer(("127.0.0.1", port), Handler) as httpd:
        sys.stderr.write("Aura Studio at http://127.0.0.1:%d  (serving %s)\n" % (port, ROOT))
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
