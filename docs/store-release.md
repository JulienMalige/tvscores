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
- **The proxy's address is Julien's own domain** (2026-10-25):
  `https://tvscores.julienmalige.com`, the bundle id read backwards, bought on
  Cloudflare Registrar (`julienmalige.com`, $10.46 a year, auto-renew on, WHOIS
  private). It reaches the VPS through a Cloudflare Tunnel: no port opened, and
  the name points at Cloudflare, not at the machine. The address is what every build carries, so the
  host behind it can change later without a new build. Image links follow the
  proxy's `TVSCORES_PUBLIC_BASE`, on the server. The Tailscale Funnel address
  stays up while builds up to 44 are installed.

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

Julien's decision:

- **Sources whose terms forbid public use whatever the price:** the MotoGP
  feed's free tier is "prototyping only", and tennis and the TV guides have
  unstated terms (`docs/data-providers.md`). The player photos come through
  the paid TheSportsDB key; their pictures' own rights are crowd-uploaded and
  fall under the takedown risk above. Each needs its paid plan, a replacement, or to be
  left out of the public build.

A first step that needs none of the above: external TestFlight (a public link,
up to 10,000 testers), behind Apple's lighter beta review.
