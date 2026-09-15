#!/usr/bin/env python3
"""Download league badges, trim transparent borders, write proxy/assets/leagues/<id>.png.
Re-run when a league is added. Sources listed in docs/data-providers.md."""
import io, os, sys, urllib.request
from PIL import Image

BADGES = {
    "ucl": "https://r2.thesportsdb.com/images/media/league/badge/facv1u1742998896.png",
    "epl": "https://r2.thesportsdb.com/images/media/league/badge/gasy9d1737743125.png",
    "nfl": "https://r2.thesportsdb.com/images/media/league/badge/g85fqz1662057187.png",
    "nba": "https://r2.thesportsdb.com/images/media/league/badge/frdjqy1536585083.png",
    "f1": "https://r2.thesportsdb.com/images/media/league/badge/g8cofl1513623681.png",
    "motogp": "https://r2.thesportsdb.com/images/media/league/badge/gg3c201768486075.png",
    "atp": "https://r2.thesportsdb.com/images/media/league/badge/q7aej51769857150.png",
    "wta": "https://r2.thesportsdb.com/images/media/league/badge/bddhun1768230678.png",
    "laliga": "https://r2.thesportsdb.com/images/media/league/badge/ja4it51687628717.png",
    "seriea": "https://r2.thesportsdb.com/images/media/league/badge/67q3q21679951383.png",
    "bundesliga": "https://r2.thesportsdb.com/images/media/league/badge/teqh1b1679952008.png",
    "ligue1": "https://r2.thesportsdb.com/images/media/league/badge/9f7z9d1742983155.png",
    "libertadores": "https://r2.thesportsdb.com/images/media/league/badge/9shr931685425181.png",
    "brasileirao": "https://r2.thesportsdb.com/images/media/league/badge/lywv7t1766787179.png",
}
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "leagues")
HEIGHT = 160  # px; the app scales down, Retina-safe

for name, url in BADGES.items():
    data = urllib.request.urlopen(url, timeout=20).read()
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    box = alpha.getbbox()
    im = im.crop(box) if box else im
    im = im.resize((max(1, round(im.width * HEIGHT / im.height)), HEIGHT), Image.LANCZOS)
    im.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    print(f"{name}: {im.width}x{im.height}")
