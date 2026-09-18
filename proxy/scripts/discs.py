"""Composing a mark into an icon.

Shared by the two badge builders — `build-team-badges.py` puts a constructor
or team on a coloured disc, `build-badges.py` trims a competition's mark to a
bare square — because both need the same trimming, colour and silhouette
arithmetic, and the two were about to have two copies of it.
"""
import math

from PIL import Image, ImageDraw

DISC = 160  # px across


def trim(im):
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    box = alpha.getbbox()
    return im.crop(box) if box else im


def mean_colour(im):
    px = im.load()
    r = g = b = n = 0
    for y in range(0, im.height, max(1, im.height // 60)):
        for x in range(0, im.width, max(1, im.width // 60)):
            c = px[x, y]
            if c[3] < 128:
                continue
            r += c[0]; g += c[1]; b += c[2]; n += 1
    return (r // n, g // n, b // n) if n else (255, 255, 255)


def luma(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def silhouette(im, colour):
    flat = Image.new("RGBA", im.size, colour + (0,))
    flat.putalpha(im.getchannel("A"))
    return flat


def disc(mark, colour, style=None, size=DISC):
    """Apple's shape: the marque centred on a disc of the team's own colour."""
    ss = 4
    out = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    ImageDraw.Draw(out).ellipse([0, 0, size * ss - 1, size * ss - 1], fill=colour + (255,))
    mark = mark.copy()
    # Fit the mark's diagonal to the circle, not its width to a square: a wide
    # mark then uses the width it deserves and nothing crosses the edge.
    d = size * ss
    scale = (0.86 * d) / math.hypot(mark.width, mark.height)
    mark = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.LANCZOS)
    # A mark that melts into its own disc is redrawn as a plain silhouette, the
    # way Apple paints the McLaren speedmark white on orange.
    if style == "white":
        mark = silhouette(mark, (255, 255, 255))
    elif style is not True and abs(luma(mean_colour(mark)) - luma(colour)) < 70:
        mark = silhouette(mark, (255, 255, 255) if luma(colour) < 150 else (18, 18, 20))
    out.alpha_composite(mark, ((size * ss - mark.width) // 2, (size * ss - mark.height) // 2))
    return out.resize((size, size), Image.LANCZOS)


def drop_background(im, tol=26):
    """Clear the near-white ground a badge is printed on, from the edges in.

    Flood-filled from the corners rather than keyed across the whole image, so
    white *inside* a mark survives: the Serie A tile is a white square behind a
    blue A, and the A keeps its own highlights.
    """
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    near = lambda c: c[3] > 0 and min(c[0], c[1], c[2]) >= 255 - tol
    seen = set()
    stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if not near(px[x, y]):
            continue
        px[x, y] = (255, 255, 255, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def icon(mark, size=DISC):
    """The mark alone, centred on a transparent square.

    Square because the sidebar lays icons out itself and a wide wordmark would
    otherwise tower over a crest; transparent because the ground belongs to
    whatever the icon is drawn on.
    """
    ss = 4
    out = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    d = size * ss
    scale = (0.92 * d) / math.hypot(mark.width, mark.height)
    mark = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.LANCZOS)
    out.alpha_composite(mark, ((d - mark.width) // 2, (d - mark.height) // 2))
    return out.resize((size, size), Image.LANCZOS)
