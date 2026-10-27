#!/usr/bin/env python3
"""The website's screenshots (site/img/shot-*), from a CI run's `screenshots`
artifact: its pictures of the app on live data, in English.

Each is written at two widths as WebP, for the page to pick from; the home
screen also as a JPEG, the picture a link to the site shows in a message.

    gh run download <run id> --repo JulienMalige/tvscores -n screenshots -D <dir>
    python3 scripts/site-shots.py <dir>
"""
from __future__ import annotations

import pathlib
import sys

from PIL import Image

OUT = pathlib.Path(__file__).resolve().parent.parent / "site" / "img"
# The site's name for each picture, and the CI's.
SHOTS = {
    "today": "live-today-en.png",
    "watch": "live-game-scheduled-nfl-tv-en.png",
    "race": "live-race-f1-next-en.png",
    "game": "live-game-final-football-en.png",
}
WIDTHS = (800, 1600)


def main(source: pathlib.Path):
    OUT.mkdir(parents=True, exist_ok=True)
    for name, file in SHOTS.items():
        shot = Image.open(source / file).convert("RGB")
        for width in WIDTHS:
            small = shot.resize((width, round(shot.height * width / shot.width)), Image.LANCZOS)
            small.save(OUT / f"shot-{name}-{width}.webp", "WEBP", quality=82, method=6)
        if name == "today":
            shot.resize((1200, 675), Image.LANCZOS).save(OUT / "shot-today.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    print("wrote", OUT)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(pathlib.Path(sys.argv[1]))
