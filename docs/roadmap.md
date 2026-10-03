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
- Today the country is fixed to France in the proxy (`broadcastCountry`).
- The proxy would serve each country's channels side by side, for example
  `broadcasts: { FR: [...], US: [...] }`. The app shows the ones chosen,
  labelled by country when there is more than one.
- Each new country needs:
  - TheSportsDB's TV rows for it;
  - its own rights table, like `broadcasts-fr.json`;
  - a TV guide if one exists. XML TV Fr covers France only.
- What we found for each country is in `docs/broadcast-sources.md`.

## 3. Open the channel's app (later, complex)

Noted 2026-10-03.

- Selecting a channel would open the app that streams it, for example
  Canal+ → the CANAL+ app on tvOS.
- This needs a table from channel to app (bundle id or URL scheme) for each
  country, and each app may not accept being opened from outside.
- **Conflicts with hard rule 4** ("no streaming links anywhere in the
  app"). Julien would have to lift or reword that rule first; until then,
  channels stay names only.
