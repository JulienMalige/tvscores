#!/usr/bin/env python3
"""Download constructor and team badges into proxy/assets/teams/<sport>/.

The mapping is written out by hand: our standings call a team "Mercedes" and
TheSportsDB calls it "Mercedes-AMG PETRONAS Formula One Team", and guessing
between the two is how you end up showing the wrong badge. A team with no
entry here simply keeps its monogram.

    python3 scripts/build-team-badges.py
"""
import io
import json
import math
import os
import re
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw

KEY = os.environ.get("TVSCORES_TSDB_KEY", "3")
DISC = 160  # px across; the app draws it at 56 pt
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "teams")

# Team colours as the results feed reports them, so the disc matches the row.
COLOURS = {
    "f1": {
        "Mercedes": (0x27, 0xf4, 0xd2), "Ferrari": (0xe8, 0x00, 0x2d), "McLaren": (0xff, 0x80, 0x00),
        "Red Bull Racing": (0x36, 0x71, 0xc6), "Racing Bulls": (0x66, 0x92, 0xff), "Alpine": (0x00, 0xa1, 0xe8),
        "Haas F1 Team": (0xde, 0xe1, 0xe2), "Audi": (0xff, 0x2d, 0x00), "Williams": (0x18, 0x68, 0xdb),
        "Aston Martin": (0x22, 0x99, 0x71), "Cadillac": (0xaa, 0xaa, 0xad),
    },
    "motogp": {
        "Aprilia Racing": (0x5f, 0x25, 0x9f), "Ducati Lenovo Team": (0xad, 0x00, 0x00),
        "SuperFile Trackhouse MotoGP Team": (0x26, 0x26, 0x26), "Red Bull KTM Factory Racing": (0xff, 0x7e, 0x27),
        "Pertamina Enduro VR46 Racing Team": (0x26, 0x26, 0x26), "BK8 Gresini Racing MotoGP": (0x9b, 0xae, 0xe4),
        "Honda HRC Castrol": (0xe5, 0x00, 0x00), "Red Bull KTM Tech3": (0x26, 0x26, 0x26),
        "LCR Honda": (0xfa, 0xfa, 0xfa), "Prima Pramac Yamaha MotoGP": (0x26, 0x26, 0x26),
        # The results feed reports no colour for Yamaha; their own blue it is.
        "Monster Energy Yamaha MotoGP Team": (0x0d, 0x1f, 0x6b),
    },
}

# our standings name -> (TheSportsDB team name, crop box, keep colours?, source)
#
# The badges are sponsor lockups, so the marque has to be cut out of them. The
# box is a fraction of the trimmed badge (left, top, right, bottom); None means
# the whole badge already is the marque. The third field forces the mark to
# keep its own colours; left out, a mark that would melt into its disc is
# redrawn as a silhouette. A team with no usable mark in its lockup is left out
# and keeps its initials.
TEAMS = {
    "f1": {
        "Mercedes": ("Mercedes-AMG PETRONAS Formula One Team", (0.24, 0.00, 0.76, 0.64), "white"),
        "Ferrari": ("Scuderia Ferrari HP", None),
        "McLaren": ("McLaren Formula 1 Team", None),
        "Red Bull Racing": ("Oracle Red Bull Racing", (0.55, 0.30, 0.99, 0.77), True),
        "Racing Bulls": ("Visa Cash App Racing Bulls Formula One Team", (0.16, 0.20, 0.88, 0.78)),
        "Haas F1 Team": ("MoneyGram Haas F1 Team", None),
        "Audi": ("Audi Revolut F1 Team", (0.16, 0.00, 0.86, 0.42)),
        "Aston Martin": ("Aston Martin Aramco Formula One Team", (0.04, 0.00, 0.96, 0.36)),
        "Cadillac": ("Cadillac Formula 1 Team", (0.14, 0.00, 0.86, 0.54), True),
        # Alpine and Williams: their lockups carry only a sponsor mark.
    },
    # MotoGP teams are sponsor lockups too, but most carry the marque that
    # actually identifies them, and `strLogo` is often the marque on its own
    # where `strBadge` is the collage — or the other way round, which is why
    # each entry names its source. Red Bull's two teams are the awkward pair:
    # their logo *is* Red Bull, which identifies a drink and both of them, so
    # KTM and TECH3 are cut out instead, one from the badge and one from the
    # logo, so the factory team and the satellite team do not come out alike.
    "motogp": {
        "Aprilia Racing": ("Aprilia Racing", None, None, "logo"),
        "Ducati Lenovo Team": ("Ducati Lenovo Team", None, None, "logo"),
        "SuperFile Trackhouse MotoGP Team": ("Trackhouse Racing", (0.28, 0.00, 0.72, 0.62), None, "badge"),
        "Red Bull KTM Factory Racing": ("Red Bull KTM Factory Racing", (0.02, 0.54, 0.98, 0.80), True, "badge"),
        "Pertamina Enduro VR46 Racing Team": ("Pertamina Enduro VR46 Racing Team", None, True, "logo"),
        "BK8 Gresini Racing MotoGP": ("BK8 Gresini Racing", None, None, "logo"),
        "Honda HRC Castrol": ("Honda HRC Castrol", None, None, "badge"),
        "Red Bull KTM Tech3": ("Red Bull KTM Tech3", (0.50, 0.00, 1.00, 1.00), True, "logo"),
        "LCR Honda": ("LCR Honda Idemitsu Castrol", None, None, "logo"),
        "Monster Energy Yamaha MotoGP Team": ("Monster Energy Yamaha MotoGP", (0.04, 0.70, 0.96, 0.97), True, "badge"),
        "Prima Pramac Yamaha MotoGP": ("Prima Pramac Racing", (0.04, 0.52, 0.96, 0.92), True, "badge"),
    },
}


def slug(name):
    """Must match slug() in proxy/src/model.js."""
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


# Searching "Mercedes" by name returns an Argentinian football club, so the
# league listing is the source of truth and any name-search fallback has to
# come back from the right league.
LEAGUE = {"f1": "Formula 1", "motogp": "MotoGP"}


def league_teams(league):
    url = f"https://www.thesportsdb.com/api/v1/json/{KEY}/search_all_teams.php?l={urllib.parse.quote(league)}"
    with urllib.request.urlopen(url, timeout=25) as r:
        teams = json.load(r).get("teams") or []
    return {(t.get("strTeam") or "").strip(): t for t in teams}


def art_url(name, league, listing, source="badge"):
    """`strBadge` is the team lockup; `strLogo` is often the marque alone."""
    field = "strLogo" if source == "logo" else "strBadge"
    team = listing.get(name.strip())
    if not team:
        url = f"https://www.thesportsdb.com/api/v1/json/{KEY}/searchteams.php?t={urllib.parse.quote(name)}"
        with urllib.request.urlopen(url, timeout=25) as r:
            teams = json.load(r).get("teams") or []
        team = next((t for t in teams if (t.get("strTeam") or "").strip() == name.strip() and (t.get("strLeague") or "") == league), None)
    return (team or {}).get(field) or (team or {}).get("strBadge")


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


for sport, mapping in TEAMS.items():
    folder = os.path.join(OUT, sport)
    os.makedirs(folder, exist_ok=True)
    if not mapping:
        continue
    listing = league_teams(LEAGUE[sport])
    colours = COLOURS.get(sport, {})
    for ours, entry in mapping.items():
        theirs, box = entry[0], entry[1]
        style = entry[2] if len(entry) > 2 else None  # True = keep colours, "white" = force white
        source = entry[3] if len(entry) > 3 else "badge"
        url = art_url(theirs, LEAGUE[sport], listing, source)
        if not url:
            print(f"{sport}/{slug(ours)}: no badge for {theirs!r}")
            continue
        with urllib.request.urlopen(url, timeout=25) as r:
            im = trim(Image.open(io.BytesIO(r.read())).convert("RGBA"))
        if box:
            w, h = im.size
            im = trim(im.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h))))
        colour = colours.get(ours)
        if not colour:
            print(f"{sport}/{slug(ours)}: no colour, skipped")
            continue
        disc(im, colour, style).save(os.path.join(folder, f"{slug(ours)}.png"), optimize=True)
        print(f"{sport}/{slug(ours)}: {DISC}x{DISC}")
