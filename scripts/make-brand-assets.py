#!/usr/bin/env python3
"""Generate the tvOS brand assets (layered app icon + top shelf images).

The mark is drawn as geometry only: a scoreboard readout "2 - 0" in
seven-segment style, so it needs no font and stays crisp at every size.
Layers are split for the tvOS parallax effect: gradient on the back, glow
on the middle, digits on the front.

    python3 scripts/make-brand-assets.py
"""
from __future__ import annotations

import json
import math
import pathlib
import shutil

from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
CATALOG = ROOT / "app" / "Resources" / "Assets.xcassets"
BRAND = CATALOG / "App Icon & Top Shelf Image.brandassets"

SS = 3  # supersampling factor

DEEP = (5, 10, 20)
BLUE = (16, 52, 92)
GLOW = (32, 160, 190)
GREEN = (48, 209, 88)
WHITE = (255, 255, 255)

SEGMENTS = {
    "0": "abcdef",
    "1": "bc",
    "2": "abged",
    "3": "abgcd",
    "4": "fgbc",
    "5": "afgcd",
    "6": "afgedc",
    "7": "abc",
    "8": "abcdefg",
    "9": "abcfgd",
}


def gradient(size, top, bottom, angle=65.0):
    """Linear gradient across `angle` degrees, drawn small then resized."""
    w, h = size
    small = Image.new("RGB", (64, 64))
    px = small.load()
    rad = math.radians(angle)
    dx, dy = math.cos(rad), math.sin(rad)
    for y in range(64):
        for x in range(64):
            t = ((x / 63) * dx + (y / 63) * dy + 1) / 2
            t = min(1.0, max(0.0, t))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
    return small.resize((w, h), Image.LANCZOS)


def radial(size, colour, centre, radius, strength=1.0):
    """Soft radial glow on a transparent layer."""
    w, h = size
    small = Image.new("L", (96, 96), 0)
    px = small.load()
    cx, cy = centre[0] * 96, centre[1] * 96
    r = radius * 96
    for y in range(96):
        for x in range(96):
            d = math.hypot(x - cx, y - cy) / r
            if d < 1:
                px[x, y] = round(255 * strength * (1 - d) ** 2)
    mask = small.resize((w, h), Image.LANCZOS)
    layer = Image.new("RGBA", (w, h), colour + (0,))
    layer.putalpha(mask)
    return layer


def segment_boxes(x, y, w, h, t):
    """Seven-segment geometry: (key, box) pairs for a digit cell."""
    g = t * 0.42  # gap between segments
    mid = y + h / 2
    return {
        "a": (x + t / 2 + g, y, x + w - t / 2 - g, y + t),
        "g": (x + t / 2 + g, mid - t / 2, x + w - t / 2 - g, mid + t / 2),
        "d": (x + t / 2 + g, y + h - t, x + w - t / 2 - g, y + h),
        "f": (x, y + t / 2 + g, x + t, mid - t / 2 - g),
        "b": (x + w - t, y + t / 2 + g, x + w, mid - t / 2 - g),
        "e": (x, mid + t / 2 + g, x + t, y + h - t / 2 - g),
        "c": (x + w - t, mid + t / 2 + g, x + w, y + h - t / 2 - g),
    }


def draw_digit(draw, char, x, y, w, h, t, colour, dim=None):
    boxes = segment_boxes(x, y, w, h, t)
    lit = SEGMENTS[char]
    for key, box in boxes.items():
        on = key in lit
        if not on and dim is None:
            continue
        draw.rounded_rectangle(box, radius=t * 0.34, fill=colour if on else dim)


def mark(size, scale=1.0, offset=(0.0, 0.0), digits="20", ghost=False):
    """The scoreboard mark on a transparent canvas."""
    w, h = size
    img = Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    unit = min(w, h) * SS * scale
    dh = unit * 0.56
    dw = dh * 0.62
    t = dh * 0.155
    dash_w = dw * 0.52
    gap = dw * 0.42
    total = dw * 2 + gap * 2 + dash_w
    x0 = (w * SS - total) / 2 + offset[0] * w * SS
    y0 = (h * SS - dh) / 2 + offset[1] * h * SS

    dim = (255, 255, 255, 20) if ghost else None
    draw_digit(draw, digits[0], x0, y0, dw, dh, t, WHITE + (255,), dim)
    draw_digit(draw, digits[1], x0 + dw + gap * 2 + dash_w, y0, dw, dh, t, WHITE + (255,), dim)

    cx = x0 + dw + gap + dash_w / 2
    cy = y0 + dh / 2
    draw.rounded_rectangle(
        (cx - dash_w / 2, cy - t / 2, cx + dash_w / 2, cy + t / 2),
        radius=t * 0.5,
        fill=GREEN + (255,),
    )
    return img.resize((w, h), Image.LANCZOS)


def back_layer(size):
    img = gradient(size, BLUE, DEEP).convert("RGBA")
    img.alpha_composite(radial(size, (26, 92, 150), (0.22, 0.18), 0.85, 0.75))
    img.alpha_composite(radial(size, (8, 40, 60), (0.85, 0.95), 0.7, 0.6))
    return img


def middle_layer(size):
    w, h = size
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(radial(size, GLOW, (0.5, 0.52), 0.62, 0.42))
    halo = mark(size, scale=1.06, ghost=False)
    halo = halo.filter(ImageFilter.GaussianBlur(max(2, min(w, h) * 0.035)))
    halo.putalpha(halo.getchannel("A").point(lambda v: int(v * 0.55)))
    img.alpha_composite(halo)
    return img


def front_layer(size):
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(mark(size, ghost=True))
    return img


def write_png(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def contents(payload):
    payload.setdefault("info", {"author": "xcode", "version": 1})
    return json.dumps(payload, indent=2) + "\n"


def imagestack(path, size_1x, scales):
    """Layered icon: Back / Middle / Front, each with its own image set."""
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
    img.alpha_composite(radial(size, GLOW, (0.5, 0.55), 0.5, 0.35))
    img.alpha_composite(mark(size, scale=0.78, ghost=True))
    return img.convert("RGB")


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents(payload))


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
