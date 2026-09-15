#!/usr/bin/env python3
"""Generate the tvOS brand assets from the scoreboard artwork.

`design/icon-scoreboard.png` is a dot-matrix scoreboard reading 2-1 on black.
This cuts it into the layers tvOS wants: the board itself on the back, the
red bloom in the middle, the lit dots on the front. Focusing the icon on the
Apple TV then floats the dots above their own glow, which is the whole point
of the layered format.

Apple's rules this follows: one centred subject, a safe margin of 10-15% per
layer because the layers shift, and a fully opaque bottom layer.

    python3 scripts/make-brand-assets.py
"""
from __future__ import annotations

import json
import pathlib
import shutil

from PIL import Image, ImageChops, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "design" / "icon-scoreboard.png"
CATALOG = ROOT / "app" / "Resources" / "Assets.xcassets"
BRAND = CATALOG / "App Icon & Top Shelf Image.brandassets"

MARK_WIDTH = 0.74     # of the canvas; leaves the safe margin the layers need
BLOOM = (255, 40, 30)
BLOOM_STRENGTH = 0.45  # enough for the dots to float above when focused
TOP_LIGHT = (30, 27, 30)  # the board catches a little light from above


def mark() -> Image.Image:
    """The lit dots, cropped out of the artwork and carrying their own alpha."""
    art = Image.open(SOURCE).convert("RGB")
    r, g, b = art.split()
    # Opacity from the brightest channel, not from luminance: a red dot on
    # black is barely luminous and would come back a quarter dimmer.
    lit = ImageChops.lighter(ImageChops.lighter(r, g), b)
    box = lit.point(lambda v: 255 if v > 18 else 0).getbbox()
    out = art.crop(box).convert("RGBA")
    out.putalpha(lit.crop(box))
    return out


def ground(size: tuple[int, int]) -> Image.Image:
    """The unlit board, lit from above and falling away to black at the foot,
    the way Apple's own dark icons are lit. Opaque, as the bottom layer must
    be, and never bright enough to lift the dots off it."""
    w, h = size
    strip = Image.new("RGB", (1, 64))
    px = strip.load()
    for y in range(64):
        t = (1 - y / 63) ** 1.7
        px[0, y] = tuple(round(c * t) for c in TOP_LIGHT)
    return strip.resize((w, h), Image.LANCZOS).convert("RGBA")


def placed(size: tuple[int, int], art: Image.Image) -> Image.Image:
    """The mark centred on a transparent canvas at the icon's own scale."""
    w, h = size
    target_w = round(w * MARK_WIDTH)
    target_h = round(target_w * art.height / art.width)
    if target_h > h * 0.66:  # top shelf is far wider than it is tall
        target_h = round(h * 0.66)
        target_w = round(target_h * art.width / art.height)
    scaled = art.resize((target_w, target_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    canvas.alpha_composite(scaled, ((w - target_w) // 2, (h - target_h) // 2))
    return canvas


def back_layer(size):
    return ground(size)


def middle_layer(size):
    """The bloom the dots throw onto the board."""
    art = placed(size, mark())
    glow = Image.new("RGBA", size, BLOOM + (0,))
    # Faint on purpose: the dots already carry their own halo, and this layer
    # exists so there is something for them to float above when focused.
    blurred = art.getchannel("A").filter(ImageFilter.GaussianBlur(max(3, min(size) * 0.055)))
    glow.putalpha(blurred.point(lambda v: int(v * BLOOM_STRENGTH)))
    return glow


def front_layer(size):
    return placed(size, mark())


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
