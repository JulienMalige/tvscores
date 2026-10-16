# The App Store release

What stands between TestFlight and the public store, and what Julien decided.

## Decisions

- **Free, no ads, no in-app purchase** (Julien, 2026-10-16: "I'm not going to
  sell the app. I'm just going to put it on the App Store. For free."). No
  paid-apps agreement, banking or tax forms; under the EU Digital Services Act
  he can declare himself a non-trader, so no address or phone on the listing.
- **Takedown risk accepted for crests, league logos and player photos**
  (Julien, 2026-10-16: "I'm okay to accept some takedown risk. Because it's a
  small app."), extending the 2026-09-14 decision on crests (hard rule 4) to
  the public release. If a rights holder objects, that league or that athlete
  falls back to the monogram; the app keeps the fallback for exactly that.
  Free does not change Apple's review: guideline 5.2.1 still asks about rights,
  so a rejection on logos remains possible, separately from a takedown.

## Still to do

Free, can be done now:

- Make the GitHub repository private, or take the badges out of
  `proxy/assets`: other people's trademarks in a public repository is the
  most visible exposure, and costs nothing to remove.
- Hide Settings > About > Open apps (test) from release builds: a reviewer
  reads it as a debug page.
- Turn the diagnostic trace (`POST /v1/diag`) off in release builds, or
  declare it in App Privacy as diagnostics. Off is simpler.
- A privacy policy page and a support page, each at a public URL.
- The App Privacy form, the age rating and the content rights questionnaires.
- The store listing in fr-FR, en-US, pt-BR, es-ES: name, subtitle,
  description, keywords, screenshots (the CI screenshots at 1920x1080).

Julien's decisions:

- **Proxy hosting.** A domain of his own and a host meant for the public, in
  place of the Tailscale tunnel; its address is baked into every build. The
  cost does not grow with users: the proxy polls on its own schedule.
- **Sources whose terms forbid public use whatever the price:** the MotoGP
  feed's free tier is "prototyping only", and tennis and the TV guides have
  unstated terms (`docs/data-providers.md`). The player photos come through
  the paid TheSportsDB key; their pictures' own rights are crowd-uploaded and
  fall under the takedown risk above. Each needs its paid plan, a replacement, or to be
  left out of the public build.

A first step that needs none of the above: external TestFlight (a public link,
up to 10,000 testers), behind Apple's lighter beta review.
