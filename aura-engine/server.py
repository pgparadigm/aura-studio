#!/usr/bin/env python3
"""Aura engine — optional local companion for heavy audio work.

Aura Studio works completely without this. The browser does its own analysis, its own reconstruction,
and its own vocal balance. This companion exists only for work a browser tab cannot reasonably do, and
the app must never require it, wait on it, or degrade when it is absent.

WHAT IT IS
    A loopback-only HTTP service. No account, no cloud, no telemetry, no network egress of any kind.
    Audio the singer hands it is written to a per-job directory that is erased the moment the job ends,
    is cancelled, times out, or the process stops.

WHAT IT DOES NOT SHIP
    Model weights. Not one. See MODEL-LICENSES.md: the field's default model has weights its own author
    excluded from its MIT licence, and no licence-clean model exists for separating a lead vocal from
    backing vocals at all. A singer who has a model they have the right to use can point the engine at
    it; otherwise the engine reports `backends: []` and the browser quietly stays on its own path.

    python3 aura-engine/server.py            # 127.0.0.1:8788
    python3 aura-engine/server.py --port 9001 --root /tmp/aura-jobs

SECURITY SHAPE
    * binds 127.0.0.1 only — never 0.0.0.0, so no other device on the network can reach it
    * Origin and Host are both validated; a browser page from anywhere else is refused
    * no arbitrary file read: a job only ever touches its own directory, and stem names are matched
      against a fixed set rather than joined into a path
    * every job directory is erased on finish, cancel, timeout, or shutdown, including on SIGINT
    * uploads are capped, and the whole job root lives under the system temp directory by default
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import re
import shutil
import signal
import socketserver
import sys
import tempfile
import threading
import time
import uuid

VERSION = "0.1.0"
NAME = "aura-engine"

# A job is abandoned if nothing touches it for this long. The browser polls while it cares; silence
# means the tab was closed and the audio must not be left on disk.
JOB_TTL_SECONDS = 15 * 60
SWEEP_SECONDS = 30
MAX_UPLOAD_BYTES = 512 * 1024 * 1024

# Stem names are a closed set. They are used to build filenames, so they must never come from the
# request as free text.
STEM_NAMES = ("instrumental", "lead", "backing", "drums", "bass", "other", "full")
JOB_ID_RE = re.compile(r"^[0-9a-f]{32}$")

ALLOWED_ORIGIN_RE = re.compile(r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$")


class Job:
    def __init__(self, root: str):
        self.id = uuid.uuid4().hex
        self.dir = os.path.join(root, self.id)
        os.makedirs(self.dir, mode=0o700, exist_ok=True)
        self.state = "queued"          # queued | running | done | cancelled | failed
        self.progress = 0.0
        self.message = "waiting to start"
        self.error = None
        self.stems = {}                # name -> filename inside self.dir
        self.touched = time.time()
        self.cancel = threading.Event()

    def touch(self):
        self.touched = time.time()

    def public(self):
        return {
            "id": self.id,
            "state": self.state,
            "progress": round(self.progress, 3),
            "message": self.message,
            "error": self.error,
            "stems": sorted(self.stems.keys()),
        }

    def erase(self):
        """Remove every byte of this job. Called on finish, cancel, timeout and shutdown."""
        self.cancel.set()
        shutil.rmtree(self.dir, ignore_errors=True)


class Registry:
    """Backends are discovered, never bundled.

    A backend is a module in aura-engine/backends/ exposing:
        NAME, DESCRIPTION, LICENCE_NOTE
        available() -> bool          # are its dependencies AND its weights actually present?
        separate(job, in_path, want) # writes stem wav files into job.dir, honouring job.cancel
    """

    def __init__(self):
        self.backends = {}
        self._load()

    def _load(self):
        here = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backends")
        if not os.path.isdir(here):
            return
        sys.path.insert(0, os.path.dirname(here))
        for fn in sorted(os.listdir(here)):
            if not fn.endswith(".py") or fn.startswith("_"):
                continue
            mod_name = "backends." + fn[:-3]
            try:
                mod = __import__(mod_name, fromlist=["*"])
            except Exception as e:                      # a broken backend must not stop the engine
                sys.stderr.write("aura-engine: backend %s failed to load: %s\n" % (fn, e))
                continue
            if not hasattr(mod, "separate") or not hasattr(mod, "available"):
                continue
            try:
                ok = bool(mod.available())
            except Exception:
                ok = False
            self.backends[getattr(mod, "NAME", fn[:-3])] = {"module": mod, "available": ok}

    def public(self):
        return [
            {
                "name": n,
                "available": b["available"],
                "description": getattr(b["module"], "DESCRIPTION", ""),
                "licenceNote": getattr(b["module"], "LICENCE_NOTE", ""),
            }
            for n, b in sorted(self.backends.items())
        ]

    def pick(self, name=None):
        if name:
            b = self.backends.get(name)
            return b if (b and b["available"]) else None
        for _, b in sorted(self.backends.items()):
            if b["available"]:
                return b
        return None


class Engine:
    def __init__(self, root: str):
        self.root = root
        os.makedirs(self.root, mode=0o700, exist_ok=True)
        self.jobs = {}
        self.lock = threading.Lock()
        self.registry = Registry()
        self._stop = threading.Event()
        t = threading.Thread(target=self._sweeper, daemon=True)
        t.start()

    def _sweeper(self):
        """Erase abandoned jobs. A closed browser tab must not leave a singer's music on disk."""
        while not self._stop.wait(SWEEP_SECONDS):
            now = time.time()
            with self.lock:
                stale = [j for j in self.jobs.values()
                         if now - j.touched > JOB_TTL_SECONDS]
                for j in stale:
                    j.state = "cancelled" if j.state in ("queued", "running") else j.state
                    j.message = "expired and erased"
                    j.erase()
                    self.jobs.pop(j.id, None)

    def create(self, data: bytes, want, backend_name=None):
        b = self.registry.pick(backend_name)
        job = Job(self.root)
        with self.lock:
            self.jobs[job.id] = job
        in_path = os.path.join(job.dir, "input")
        with open(in_path, "wb") as f:
            f.write(data)
        if not b:
            job.state = "failed"
            job.error = "no-backend"
            job.message = ("No separation backend is installed. Aura's own vocal balance still works "
                           "in the browser — this engine is optional.")
            return job
        t = threading.Thread(target=self._run, args=(job, b, in_path, want), daemon=True)
        t.start()
        return job

    def _run(self, job, b, in_path, want):
        job.state = "running"
        job.message = "working"
        try:
            b["module"].separate(job, in_path, want)
            if job.cancel.is_set():
                job.state = "cancelled"
                job.message = "cancelled"
                job.erase()
                return
            job.state = "done"
            job.progress = 1.0
            job.message = "ready"
        except Exception as e:
            job.state = "failed"
            job.error = "backend-error"
            job.message = str(e)[:300]
        finally:
            try:
                os.remove(in_path)          # the source recording goes as soon as it is not needed
            except OSError:
                pass

    def get(self, jid):
        with self.lock:
            j = self.jobs.get(jid)
        if j:
            j.touch()
        return j

    def drop(self, jid):
        with self.lock:
            j = self.jobs.pop(jid, None)
        if j:
            j.state = "cancelled" if j.state in ("queued", "running") else j.state
            j.erase()
        return j is not None

    def shutdown(self):
        self._stop.set()
        with self.lock:
            for j in list(self.jobs.values()):
                j.erase()
            self.jobs.clear()
        shutil.rmtree(self.root, ignore_errors=True)


ENGINE: Engine | None = None


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = "%s/%s" % (NAME, VERSION)
    protocol_version = "HTTP/1.1"

    # ---------- helpers ----------
    def _origin_ok(self):
        origin = self.headers.get("Origin")
        if origin is None:
            return True                                  # curl and same-origin navigations
        return bool(ALLOWED_ORIGIN_RE.match(origin.strip()))

    def _host_ok(self):
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ("127.0.0.1", "localhost")

    def _send(self, code, payload=None, ctype="application/json", raw=None):
        body = raw if raw is not None else json.dumps(payload or {}).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        origin = self.headers.get("Origin")
        if origin and ALLOWED_ORIGIN_RE.match(origin.strip()):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _guard(self):
        if not self._host_ok():
            self._send(403, {"error": "host-not-loopback"})
            return False
        if not self._origin_ok():
            self._send(403, {"error": "origin-not-allowed"})
            return False
        return True

    def log_message(self, fmt, *args):                   # one line, no payloads, no filenames
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

    # ---------- routes ----------
    def do_OPTIONS(self):
        if not self._guard():
            return
        self.send_response(204)
        origin = self.headers.get("Origin")
        if origin and ALLOWED_ORIGIN_RE.match(origin.strip()):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type,X-Aura-Want,X-Aura-Backend")
            self.send_header("Vary", "Origin")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not self._guard():
            return
        path = self.path.split("?")[0]
        if path in ("/health", "/"):
            return self._send(200, {
                "name": NAME, "version": VERSION, "ready": True,
                "shipsWeights": False,
                "backends": ENGINE.registry.public(),
                "note": "Aura works without this engine. It is optional and ships no model weights.",
            })
        m = re.match(r"^/jobs/([0-9a-f]{32})$", path)
        if m:
            j = ENGINE.get(m.group(1))
            return self._send(200, j.public()) if j else self._send(404, {"error": "no-such-job"})
        m = re.match(r"^/jobs/([0-9a-f]{32})/stems/([a-z]+)$", path)
        if m:
            jid, stem = m.group(1), m.group(2)
            j = ENGINE.get(jid)
            if not j:
                return self._send(404, {"error": "no-such-job"})
            # Closed set, then a lookup — never a path join from request text.
            if stem not in STEM_NAMES or stem not in j.stems:
                return self._send(404, {"error": "no-such-stem"})
            p = os.path.join(j.dir, j.stems[stem])
            if not os.path.isfile(p):
                return self._send(410, {"error": "erased"})
            with open(p, "rb") as f:
                return self._send(200, raw=f.read(), ctype="audio/wav")
        return self._send(404, {"error": "no-such-route"})

    def do_POST(self):
        if not self._guard():
            return
        path = self.path.split("?")[0]
        if path == "/jobs":
            try:
                n = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                return self._send(400, {"error": "bad-length"})
            if n <= 0:
                return self._send(400, {"error": "empty-body"})
            if n > MAX_UPLOAD_BYTES:
                return self._send(413, {"error": "too-large",
                                        "limit": MAX_UPLOAD_BYTES})
            data = self.rfile.read(n)
            want = [w for w in (self.headers.get("X-Aura-Want") or "instrumental").split(",")
                    if w.strip() in STEM_NAMES]
            backend = self.headers.get("X-Aura-Backend") or None
            job = ENGINE.create(data, want or ["instrumental"], backend)
            return self._send(202, job.public())
        m = re.match(r"^/jobs/([0-9a-f]{32})/cancel$", path)
        if m:
            j = ENGINE.get(m.group(1))
            if not j:
                return self._send(404, {"error": "no-such-job"})
            j.cancel.set()
            j.state = "cancelled"
            j.message = "cancelled"
            j.erase()
            return self._send(200, j.public())
        return self._send(404, {"error": "no-such-route"})

    def do_DELETE(self):
        if not self._guard():
            return
        m = re.match(r"^/jobs/([0-9a-f]{32})$", self.path.split("?")[0])
        if not m:
            return self._send(404, {"error": "no-such-route"})
        return self._send(200, {"erased": ENGINE.drop(m.group(1))})


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    global ENGINE
    ap = argparse.ArgumentParser(description="Aura engine — optional local companion")
    ap.add_argument("--port", type=int, default=8788)
    ap.add_argument("--root", default=os.path.join(tempfile.gettempdir(), "aura-engine-jobs"))
    args = ap.parse_args()

    ENGINE = Engine(args.root)

    def bye(*_):
        sys.stderr.write("\naura-engine: erasing jobs and stopping\n")
        ENGINE.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, bye)
    signal.signal(signal.SIGTERM, bye)

    avail = [b["name"] for b in ENGINE.registry.public() if b["available"]]
    sys.stderr.write(
        "aura-engine %s on http://127.0.0.1:%d\n"
        "  jobs: %s (erased on finish, cancel, timeout and shutdown)\n"
        "  backends available: %s\n"
        "  ships model weights: no\n"
        % (VERSION, args.port, args.root, ", ".join(avail) if avail else "none — Aura uses its own browser path")
    )
    try:
        with Server(("127.0.0.1", args.port), Handler) as httpd:
            httpd.serve_forever()
    finally:
        ENGINE.shutdown()


if __name__ == "__main__":
    main()
