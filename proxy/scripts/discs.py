"""Composing a mark into a disc: the Apple Sports shape.

Shared by the two badge builders — `build-badges.py` for competitions and
`build-team-badges.py` for constructors and teams — because both need the same
answer to "make this lockup into one round icon", and the two were about to
have two copies of it.
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
