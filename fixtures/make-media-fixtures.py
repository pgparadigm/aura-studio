#!/usr/bin/env python3
"""Generate the media-decode fixture set.

Every byte here is synthesised. No commercial music, no downloaded media, no third-party sample
content of any kind — the signal is a deterministic tone written by this file, and the container
formats are produced by macOS's own `afconvert`, which ships with the OS.

Run from anywhere:

    python3 fixtures/make-media-fixtures.py

Formats this script CANNOT produce (no encoder available without adding a dependency, which the
project forbids) are generated inside the browser by `fixtures/media-decode.html` using
MediaRecorder, so they match the browser actually under test:

    OGG, WebM with audio, WebM with no audio, MP4 with no audio

The matrix records which fixtures came from which source.
"""
import math
import pathlib
import struct
import subprocess
import sys
import wave

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "media"
RATE = 44100
SECONDS = 2.0
FRAMES = int(RATE * SECONDS)


def tone_frames():
    """A deterministic two-tone signal: 220 Hz left, 330 Hz right, with a short fade.

    Deterministic on purpose — a decode matrix is only a regression test if the same input gives
    the same duration and the same peak every time. No PRNG, no Math.random equivalent.
    """
    out = bytearray()
    for i in range(FRAMES):
        t = i / RATE
        env = min(1.0, t / 0.01, (SECONDS - t) / 0.01)
        l = int(22000 * env * math.sin(2 * math.pi * 220.0 * t))
        r = int(22000 * env * math.sin(2 * math.pi * 330.0 * t))
        out += struct.pack("<hh", l, r)
    return bytes(out)


def write_wav(path, data):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(data)


def afconvert(src, dst, fmt, data_fmt, extra=None):
    cmd = ["afconvert", "-f", fmt, "-d", data_fmt, str(src), str(dst)]
    if extra:
        cmd[1:1] = extra
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0 or not dst.exists():
        return False, (p.stderr or p.stdout).strip().splitlines()[-1:] or ["failed"]
    return True, []


def main():
    OUT.mkdir(exist_ok=True)
    made, skipped = [], []

    pcm = tone_frames()
    wav = OUT / "tone.wav"
    write_wav(wav, pcm)
    made.append(("tone.wav", "WAV 16-bit PCM 44.1k stereo", wav.stat().st_size))

    # Containers macOS can encode natively. CoreAudio is decode-only for MP3 and AC-3, so those two
    # are built by hand below rather than dropped from the matrix.
    for name, fmt, dfmt, label in [
        ("tone.m4a", "m4af", "aac ", "M4A / AAC"),
        ("tone.mp4", "mp4f", "aac ", "MP4 with an audio track"),
    ]:
        dst = OUT / name
        if dst.exists():
            dst.unlink()
        ok, err = afconvert(wav, dst, fmt, dfmt)
        if ok:
            made.append((name, label, dst.stat().st_size))
        else:
            skipped.append((name, label, "; ".join(err)))

    # ---- MP3, built frame by frame ----------------------------------------------------------
    # CoreAudio decodes MP3 but will not encode it, and the project forbids adding an encoder
    # dependency. A conformant MPEG-1 Layer III frame whose side info and main data are zero
    # decodes to silence, so a stream of them is a real MP3: the browser runs its real MP3 path and
    # reports a real duration. Silence is the right signal here — this matrix tests the CONTAINER
    # and CODEC path; signal accuracy is what fixtures/import-qa.html measures.
    #
    #   byte0 1111 1111  syncword
    #   byte1 1111 1011  sync + MPEG-1 (11) + Layer III (01) + no CRC (1)
    #   byte2 1001 0000  128 kbps (1001) + 44.1 kHz (00) + no padding (0) + private (0)
    #   byte3 0000 0100  stereo (00) + no mode ext (00) + not copyright (0) + original (1) + no emph
    header = bytes([0xFF, 0xFB, 0x90, 0x04])
    frame_len = (144 * 128000) // 44100                     # 417 bytes at 128 kbps / 44.1 kHz
    frame = header + bytes(frame_len - len(header))
    n_frames = int(SECONDS * 44100 / 1152) + 1              # 1152 samples per Layer III frame
    (OUT / "tone.mp3").write_bytes(frame * n_frames)
    made.append(("tone.mp3", f"MPEG-1 Layer III, {n_frames} silent frames", (OUT / "tone.mp3").stat().st_size))

    # ---- a container that parses, holding a codec nothing implements -------------------------
    # Format tag 0x0161 is WMAudio v2. The RIFF/WAVE container is valid and every parser will read
    # the header cleanly, then find a codec it does not have. That separates "unsupported codec"
    # from "corrupt file", which the app must report differently.
    wma = bytearray()
    payload = bytes(range(256)) * 4
    wma += b"RIFF" + struct.pack("<I", 36 + len(payload)) + b"WAVE"
    wma += b"fmt " + struct.pack("<IHHIIHH", 16, 0x0161, 2, RATE, 16000, 4, 16)
    wma += b"data" + struct.pack("<I", len(payload)) + payload
    (OUT / "unsupported-codec.wav").write_bytes(bytes(wma))
    made.append(("unsupported-codec.wav", "valid RIFF/WAVE declaring WMAudio v2 (0x0161)",
                 (OUT / "unsupported-codec.wav").stat().st_size))

    # Deliberate failure cases, written byte by byte so they are exactly what they claim to be.
    (OUT / "empty.wav").write_bytes(b"")
    made.append(("empty.wav", "zero bytes", 0))

    # A real RIFF/WAVE header that promises 2 seconds of audio, followed by 400 bytes of payload.
    # This is a half-written download. It is NOT a decode error: decodeAudioData is tolerant and
    # returns the 2 milliseconds it found, reporting success. The app has to catch that itself, so
    # this fixture's contract is "rejected as too short", not "failed to decode".
    hdr = bytearray()
    hdr += b"RIFF" + struct.pack("<I", 36 + FRAMES * 4) + b"WAVE"
    hdr += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 2, RATE, RATE * 4, 4, 16)
    hdr += b"data" + struct.pack("<I", FRAMES * 4)
    (OUT / "truncated.wav").write_bytes(bytes(hdr) + (bytes(range(256)) * 2)[:400])
    made.append(("truncated.wav", "valid RIFF header, 400 bytes of payload (decodes to ~2 ms)",
                 (OUT / "truncated.wav").stat().st_size))

    # A WAV that genuinely cannot be decoded: a well-formed RIFF/WAVE with a valid PCM fmt chunk
    # and NO data chunk at all. Every parser reads the header, finds the codec it knows, and then
    # has nothing to decode. This is the case that must be reported as damaged rather than as an
    # unknown format — the format is perfectly clear.
    nod = bytearray()
    nod += b"RIFF" + struct.pack("<I", 4 + 24) + b"WAVE"
    nod += b"fmt " + struct.pack("<IHHIIHH", 16, 1, 2, RATE, RATE * 4, 4, 16)
    (OUT / "no-data-chunk.wav").write_bytes(bytes(nod))
    made.append(("no-data-chunk.wav", "valid RIFF/WAVE PCM header with no data chunk",
                 (OUT / "no-data-chunk.wav").stat().st_size))

    # A file whose extension and MIME say audio but whose bytes are text. The picker accepts it;
    # the decoder must reject it cleanly rather than throwing something uncaught.
    (OUT / "not-audio.wav").write_bytes(b"this is not audio, it is a text file with a .wav name\n" * 8)
    made.append(("not-audio.wav", "text bytes behind an audio extension", (OUT / "not-audio.wav").stat().st_size))

    print(f"wrote {len(made)} fixtures to {OUT}")
    for n, label, size in made:
        print(f"  {n:26} {size:>9,} B  {label}")
    if skipped:
        print("\nnot generated here (no encoder available):")
        for n, label, why in skipped:
            print(f"  {n:26} {label} — {why}")
    print("\nOGG, WebM (with and without audio) and MP4-without-audio are generated in the browser")
    print("by fixtures/media-decode.html via MediaRecorder.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
