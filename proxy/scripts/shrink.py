#!/usr/bin/env python3
"""Shrinks one crest or portrait: bytes in on stdin, a WebP out on stdout.

The mirror (src/shrink.js) runs this for every picture it keeps. A crest
arrives as 512 px of PNG and is drawn at 64-180 points, so it is brought down
to 256 px (twice the largest it is drawn at, for a 4K screen) and re-encoded
as lossy WebP with its transparency, which tvOS decodes natively. Exits 3,
writing nothing, when the picture is already small: it is kept as it came.
"""
import io
import sys

from PIL import Image

MAX_SIDE = 256
KEEP_BELOW = 12 * 1024  # bytes; a picture this small is not worth re-encoding

data = sys.stdin.buffer.read()
image = Image.open(io.BytesIO(data))
if max(image.size) <= MAX_SIDE and len(data) < KEEP_BELOW:
    sys.exit(3)
image = image.convert("RGBA")
image.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
out = io.BytesIO()
image.save(out, "WEBP", quality=85, method=4)
sys.stdout.buffer.write(out.getvalue())
