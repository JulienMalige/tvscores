#!/usr/bin/env python3
"""Download league badges into proxy/assets/leagues/.

Two shapes per competition, because they are read in two places:

  <id>.png        trimmed to its own proportions, for a heading where a
                  wordmark deserves its width
  disc/<id>.png   the same mark centred on a round, dark icon, for the
                  sidebar — where tvOS lays icons out itself and a wide
                  wordmark would tower over a crest beside it

Re-run when a league is added. Sources listed in docs/data-providers.md."""
import io, os, sys, urllib.request

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from discs import disc, trim

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
# The sidebar sits on glass over whatever is behind it, so the icon carries its
# own ground rather than borrowing one: near-black, like a tvOS app icon.
DISC_GROUND = (0x1c, 0x1c, 0x1e)

for name, url in BADGES.items():
    data = urllib.request.urlopen(url, timeout=20).read()
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    box = alpha.getbbox()
    im = im.crop(box) if box else im
    im = im.resize((max(1, round(im.width * HEIGHT / im.height)), HEIGHT), Image.LANCZOS)
    im.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    os.makedirs(os.path.join(OUT, "disc"), exist_ok=True)
    # `True` keeps the mark's own colours: a competition's mark is the brand,
    # and unlike a constructor lockup there is no sponsor to strip out of it.
    disc(trim(im), DISC_GROUND, True).save(os.path.join(OUT, "disc", f"{name}.png"), optimize=True)
    print(f"{name}: {im.width}x{im.height} + disc")
