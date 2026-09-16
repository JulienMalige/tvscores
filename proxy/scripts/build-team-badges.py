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
import os
import re
import sys
import urllib.parse
import urllib.request

from PIL import Image

from discs import DISC, disc, trim

KEY = os.environ.get("TVSCORES_TSDB_KEY", "3")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
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
