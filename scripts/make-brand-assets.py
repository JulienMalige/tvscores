#!/usr/bin/env python3
"""Generate the tvOS brand assets: a tennis court seen from above, white
lines on blue (Julien's pick, 2026-10-01, from three colourways).

The court is drawn as geometry, so it needs no artwork and stays sharp at
every size. tvOS wants it in layers: the blue ground on the back, the
court's surface in the middle, the white lines on the front. Focusing the
icon on the Apple TV then floats the lines above the court.

Apple's rules this follows: one centred subject, a safe margin of 10-15% per
layer because the layers shift, and a fully opaque bottom layer.

    python3 scripts/make-brand-assets.py
"""
from __future__ import annotations

import json
import pathlib
import shutil

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG = ROOT / "app" / "Resources" / "Assets.xcassets"
BRAND = CATALOG / "App Icon & Top Shelf Image.brandassets"

# Lit from the top left and falling to a deeper blue at the bottom right,
# as in the chosen render.
BLUE_LIGHT = (24, 136, 236)
BLUE_DEEP = (8, 60, 158)
COURT_WIDTH = 0.64     # of the canvas; leaves the safe margin the layers need
COURT_ASPECT = 1.56    # width over height, from the chosen render
LINE = 0.024           # line weight, of the court's width
CORNER = 0.09          # the outline's corner, of the court's width
# Where the lines run, in fractions of the court: the two long lines, the
# two short ones between them, the line joining those, and the net.
SIDES = (0.2, 0.8)
SERVICE = (0.14, 0.86)
SUPERSAMPLE = 4


def court_box(size):
    w, h = size
    cw = w * COURT_WIDTH
    ch = cw / COURT_ASPECT
    if ch > h * 0.66:  # top shelf is far wider than it is tall
        ch = h * 0.66
        cw = ch * COURT_ASPECT
    x, y = (w - cw) / 2, (h - ch) / 2
    return x, y, cw, ch


def drawn(size, paint):
    """Drawn large and brought down, for smooth edges."""
    big = (size[0] * SUPERSAMPLE, size[1] * SUPERSAMPLE)
    img = Image.new("RGBA", big, (0, 0, 0, 0))
    paint(ImageDraw.Draw(img), court_box(big))
    return img.resize(size, Image.LANCZOS)


def back_layer(size):
    """The blue ground, opaque, as the bottom layer must be."""
    w, h = size
    grad = Image.new("RGB", (64, 64))
    px = grad.load()
    for y in range(64):
        for x in range(64):
            t = min(1, max(0, (x + y * 1.4) / (63 * 2.4)))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(BLUE_LIGHT, BLUE_DEEP))
    return grad.resize((w, h), Image.BICUBIC).convert("RGBA")


def middle_layer(size):
    """The court's surface: a shade lighter than the ground, its two ends
    lighter again, as the render shades them."""
    def paint(d, box):
        x, y, cw, ch = box
        d.rounded_rectangle((x, y, x + cw, y + ch), radius=cw * CORNER - cw * LINE / 2, fill=(255, 255, 255, 22))
        for a, b in ((0, SERVICE[0]), (SERVICE[1], 1)):
            d.rectangle((x + cw * a, y + ch * SIDES[0], x + cw * b, y + ch * SIDES[1]), fill=(255, 255, 255, 18))
    return drawn(size, paint)


def front_layer(size):
    """The white lines."""
    def paint(d, box):
        x, y, cw, ch = box
        t = cw * LINE
        white = (255, 255, 255, 255)
        half = t / 2
        d.rounded_rectangle((x - half, y - half, x + cw + half, y + ch + half),
                            radius=cw * CORNER + half, outline=white, width=round(t))
        for f in SIDES:
            d.rectangle((x, y + ch * f - half, x + cw, y + ch * f + half), fill=white)
        for f in SERVICE:
            d.rectangle((x + cw * f - half, y + ch * SIDES[0], x + cw * f + half, y + ch * SIDES[1]), fill=white)
        d.rectangle((x + cw * SERVICE[0], y + ch / 2 - half, x + cw * SERVICE[1], y + ch / 2 + half), fill=white)
        d.rectangle((x + cw / 2 - half, y, x + cw / 2 + half, y + ch), fill=white)
    return drawn(size, paint)


def write_png(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)


def contents(payload):
    payload.setdefault("info", {"author": "xcode", "version": 1})
    return json.dumps(payload, indent=2) + "\n"


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents(payload))


def imagestack(path, size_1x, scales):
    # Xcode lists the layers front to back; the front one moves most in parallax.
    layers = [("Front", front_layer), ("Middle", middle_layer), ("Back", back_layer)]
    write_json(path / "Contents.json", {"layers": [{"filename": f"{n}.imagestacklayer"} for n, _ in layers]})
    for name, render in layers:
        layer = path / f"{name}.imagestacklayer"
        write_json(layer / "Contents.json", {})
        images = []
        for scale in scales:
            size = (size_1x[0] * scale, size_1x[1] * scale)
            filename = f"{name}{'' if scale == 1 else f'@{scale}x'}.png"
            write_png(render(size), layer / "Content.imageset" / filename)
            images.append({"filename": filename, "idiom": "tv", "scale": f"{scale}x"})
        write_json(layer / "Content.imageset" / "Contents.json", {"images": images})


def imageset(path, size_1x, scales, render):
    images = []
    for scale in scales:
        size = (size_1x[0] * scale, size_1x[1] * scale)
        filename = f"{path.stem.replace(' ', '')}{'' if scale == 1 else f'@{scale}x'}.png"
        write_png(render(size), path / filename)
        images.append({"filename": filename, "idiom": "tv", "scale": f"{scale}x"})
    write_json(path / "Contents.json", {"images": images})


def top_shelf(size):
    img = back_layer(size)
    img.alpha_composite(middle_layer(size))
    img.alpha_composite(front_layer(size))
    return img.convert("RGB")


def main():
    # Start clean: a change of sizes or scales would otherwise leave orphan
    # PNGs behind, which actool reports as unassigned children.
    if BRAND.exists():
        shutil.rmtree(BRAND)
    write_json(CATALOG / "Contents.json", {})
    write_json(BRAND / "Contents.json", {
        "assets": [
            {"filename": "App Icon - App Store.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "1280x768"},
            {"filename": "App Icon.imagestack", "idiom": "tv", "role": "primary-app-icon", "size": "400x240"},
            {"filename": "Top Shelf Image Wide.imageset", "idiom": "tv", "role": "top-shelf-image-wide", "size": "2320x720"},
            {"filename": "Top Shelf Image.imageset", "idiom": "tv", "role": "top-shelf-image", "size": "1920x720"},
        ],
    })
    imagestack(BRAND / "App Icon - App Store.imagestack", (1280, 768), [1])
    imagestack(BRAND / "App Icon.imagestack", (400, 240), [1, 2])
    imageset(BRAND / "Top Shelf Image.imageset", (1920, 720), [1, 2], top_shelf)
    imageset(BRAND / "Top Shelf Image Wide.imageset", (2320, 720), [1, 2], top_shelf)
    print("wrote", BRAND)


if __name__ == "__main__":
    main()
