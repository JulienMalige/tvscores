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
import urllib.parse
import urllib.request

from PIL import Image

KEY = os.environ.get("TVSCORES_TSDB_KEY", "3")
HEIGHT = 160
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "teams")

# our standings name -> TheSportsDB team name (exact)
TEAMS = {
    "f1": {
        "Mercedes": "Mercedes-AMG PETRONAS Formula One Team",
        "Ferrari": "Scuderia Ferrari HP",
        "McLaren": "McLaren Formula 1 Team",
        "Red Bull Racing": "Oracle Red Bull Racing",
        "Racing Bulls": "Visa Cash App Racing Bulls Formula One Team",
        "Alpine": "BWT Alpine Formula One Team",
        "Haas F1 Team": "MoneyGram Haas F1 Team",
        "Audi": "Audi Revolut F1 Team",
        "Williams": "Williams Racing",
        "Aston Martin": "Aston Martin Aramco Formula One Team",
        "Cadillac": "Cadillac Formula 1 Team",
    },
    "motogp": {
        "Aprilia Racing": "Aprilia Racing",
        "Ducati Lenovo Team": "Ducati Lenovo Team",
        "Red Bull KTM Factory Racing": "Red Bull KTM Factory Racing",
        "Pertamina Enduro VR46 Racing Team": "Pertamina Enduro VR46 Racing Team",
        "BK8 Gresini Racing MotoGP": "BK8 Gresini Racing",
        "Honda HRC Castrol": "Honda HRC Castrol",
        "Red Bull KTM Tech3": "Red Bull KTM Tech3",
        "LCR Honda": "LCR Honda Idemitsu Castrol",
        "Monster Energy Yamaha MotoGP Team": "Monster Energy Yamaha MotoGP",
        "Prima Pramac Yamaha MotoGP": "Prima Pramac Racing",
        "SuperFile Trackhouse MotoGP Team": "Trackhouse Racing",
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
    return {(t.get("strTeam") or "").strip(): t.get("strBadge") for t in teams}


def badge_url(name, league, listing):
    if name.strip() in listing:
        return listing[name.strip()]
    url = f"https://www.thesportsdb.com/api/v1/json/{KEY}/searchteams.php?t={urllib.parse.quote(name)}"
    with urllib.request.urlopen(url, timeout=25) as r:
        teams = json.load(r).get("teams") or []
    for t in teams:
        if (t.get("strTeam") or "").strip() == name.strip() and (t.get("strLeague") or "") == league:
            return t.get("strBadge")
    return None


for sport, mapping in TEAMS.items():
    folder = os.path.join(OUT, sport)
    os.makedirs(folder, exist_ok=True)
    listing = league_teams(LEAGUE[sport])
    for ours, theirs in mapping.items():
        url = badge_url(theirs, LEAGUE[sport], listing)
        if not url:
            print(f"{sport}/{slug(ours)}: no badge for {theirs!r}")
            continue
        with urllib.request.urlopen(url, timeout=25) as r:
            im = Image.open(io.BytesIO(r.read())).convert("RGBA")
        alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
        box = alpha.getbbox()
        im = im.crop(box) if box else im
        im = im.resize((max(1, round(im.width * HEIGHT / im.height)), HEIGHT), Image.LANCZOS)
        im.save(os.path.join(folder, f"{slug(ours)}.png"), optimize=True)
        print(f"{sport}/{slug(ours)}: {im.width}x{im.height}")
