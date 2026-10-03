# Roadmap

What Julien has asked for in releases to come, in the order he gave it.
Each item moves to CHANGELOG.md when it ships and leaves this list.

## 1. Choose sports and competitions (Settings)

Noted 2026-10-03.

- A switch per sport and per competition in Settings, turning it on or off.
- Hidden ones disappear from Home and from the menu.
- Ordering them comes later, not in the first version.
- Settings is per Apple TV, kept on the device. The proxy still serves
  everything, and the app filters.

## 2. TV channels by country, several at once (Settings)

Noted 2026-10-03.

- In Settings, choose one or more countries whose channels are shown, for
  example France, the US and Brazil.
- The proxy serves France, the US and Brazil side by side since
  2026-10-03 (`broadcastCountries`, `broadcastsBy` on each event); the app
  still shows France's list (`broadcasts`) until the Settings choice exists.
- The app would show the countries chosen from `broadcastsBy: { FR: [...],
  US: [...] }`, labelled by country when there is more than one.
- Each new country needs:
  - TheSportsDB's TV rows for it;
  - its own rights table, like `broadcasts-fr.json`;
  - a TV guide if one exists (XML TV Fr for France, epgshare01 for the US
    and Brazil).
- What we found for each country is in `docs/broadcast-sources.md`.

## 3. Open the channel's app (later, complex)

Noted 2026-10-03.

- Selecting a channel would open the app that streams it, for example
  Canal+ → the CANAL+ app on tvOS.
- This needs a table from channel to app (bundle id or URL scheme) for each
  country, and each app may not accept being opened from outside.
- Allowed by hard rule 4 as reworded 2026-10-03: official broadcasters'
  apps only, never an unofficial stream. Until this is built, channels
  stay names.
- Design (Julien, 2026-10-03, from the Apple TV app's "How to Watch"): on a
  game's page, a "How to Watch" block, one card per service: the app's
  icon on the left, "Open in CANAL+" and "CANAL+ app" in grey on the
  right, an arrow at the end. Selecting it opens the app; if it is not
  installed, its App Store page.
- What it takes:
  - a table, by country, from channel name to app: "Canal+", "Canal+
    Foot", "Canal+ Sport 360" → CANAL+; "beIN Sports 1–3", "beIN Sports
    Max 4–10" → beIN SPORTS CONNECT; "DAZN 1" → DAZN; "Ligue 1+" → Ligue 1+;
    "ESPN" → ESPN; "Peacock" → Peacock; "Disney+" → Disney+; "Globo",
    "SporTV" → Globoplay; and so on. Several channels share one app, so a
    game on "Canal+ · Canal+ Foot" shows one card;
  - per app, its App Store id and, when it has one, the URL scheme that
    opens it (checked on a real Apple TV; many tvOS apps register none,
    and then only the App Store page can open);
  - the icon and name from Apple's documented iTunes Lookup API
    (`itunes.apple.com/lookup?id=…&country=…&entity=tvSoftware`), fetched
    by the proxy once a week, so no app logo is bundled (rule 5's spirit);
  - opening the app at the game itself is out of reach: no service
    publishes per-game deep links we could use.


## 4. My Teams (favourites)

Noted 2026-10-03.

- A "My Teams" entry in the menu, near Home, as in Apple Sports' sidebar.
- The viewer picks the teams and players they follow, in any sport or
  competition we carry.
- My Teams shows only their games, laid out like Home: Yesterday, Today and
  Upcoming, with the same rows and game pages.
- Choosing the teams needs a picker: browse by competition, then tick
  teams. Searching by name could come later.
- Kept on the Apple TV, like the Settings choices. The proxy already
  serves every game; it may need a list of each competition's teams for
  the picker.
