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

# Most league lockups are a mark with the competition's name set under it. At
# the size a sidebar draws an icon that name is an illegible smudge, so the
# disc keeps the mark alone. Fractions of the trimmed badge (left, top, right,
# bottom), read off the artwork one at a time; a competition whose badge is
# already only a mark — the Premier League lion, the F1 wordmark — is absent.
DISC_CROP = {
    "brasileirao": (0.00, 0.00, 1.00, 0.80),   # shield, without BRASILEIRÃO
    "bundesliga": (0.00, 0.00, 1.00, 0.78),    # the striker, without the name
    "laliga": (0.00, 0.00, 1.00, 0.68),        # the stripes, without LALIGA
    "libertadores": (0.00, 0.00, 1.00, 0.72),  # the trophy alone
    "ligue1": (0.00, 0.00, 1.00, 0.70),        # the numeral, without LIGUE 1
    "seriea": (0.15, 0.04, 0.85, 0.76),        # the A on its tile
    "ucl": (0.15, 0.00, 0.85, 0.47),           # the starball
}

for name, url in BADGES.items():
    data = urllib.request.urlopen(url, timeout=20).read()
    im = Image.open(io.BytesIO(data)).convert("RGBA")
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    box = alpha.getbbox()
    im = im.crop(box) if box else im
    im = im.resize((max(1, round(im.width * HEIGHT / im.height)), HEIGHT), Image.LANCZOS)
    im.save(os.path.join(OUT, f"{name}.png"), optimize=True)
    os.makedirs(os.path.join(OUT, "disc"), exist_ok=True)
    mark = trim(im)
    if name in DISC_CROP:
        box = DISC_CROP[name]
        w, h = mark.size
        mark = trim(mark.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h))))
    # `True` keeps the mark's own colours: a competition's mark is the brand,
    # and unlike a constructor lockup there is no sponsor to strip out of it.
    disc(mark, DISC_GROUND, True).save(os.path.join(OUT, "disc", f"{name}.png"), optimize=True)
    print(f"{name}: {im.width}x{im.height} + disc")
