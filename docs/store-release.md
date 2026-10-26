# The App Store release

What stands between TestFlight and the public store, and what Julien decided.

## Decisions

- **Free, no ads, no in-app purchase** (Julien, 2026-10-16: "I'm not going to
  sell the app. I'm just going to put it on the App Store. For free."). No
  paid-apps agreement, banking or tax forms; under the EU Digital Services Act
  he can declare himself a non-trader, so no address or phone on the listing.
- **Takedown risk accepted for crests, league logos and player photos**
  (Julien, 2026-10-16: "I'm okay to accept some takedown risk. Because it's a
  small app."), extending the 2026-09-14 decision on crests (hard rule 5) to
  the public release. If a rights holder objects, that league or that athlete
  falls back to the monogram; the app keeps the fallback for exactly that.
  Free does not change Apple's review: guideline 5.2.1 still asks about rights,
  so a rejection on logos remains possible, separately from a takedown.
- **The proxy's address is Julien's own domain** (2026-10-25):
  `https://tvscores.julienmalige.com`, the bundle id read backwards, bought on
  Cloudflare Registrar (`julienmalige.com`, $10.46 a year, auto-renew on, WHOIS
  private). It reaches the VPS through a Cloudflare Tunnel: no port opened, and
  the name points at Cloudflare, not at the machine. The address is what every
  build carries, so the host behind it can change later without a new build.
  Image links follow the proxy's `TVSCORES_PUBLIC_BASE`, on the server. The
  Tailscale Funnel address that builds up to 44 carry was turned off on
  2026-10-26, once build 45 worked on the television.
  Known limit: Spanish ISPs block Cloudflare's shared addresses during LaLiga
  matches, under a court order in force for 2026-27 (Euronews, 2026-09-18). On
  the es-ES store the app may go blank on matchdays; the remedy, if it matters,
  is a fallback host or an address that is not shared.

- **The store build** (2026-10-26): the build submitted to Apple is made with
  the TestFlight workflow's `store: true` (`docs/release.md`). It has no
  "Open apps (test)" row in Settings, which a reviewer reads as a debug page,
  and never posts the diagnostic trace, so App Privacy has no diagnostics to
  declare. Every other build keeps both. A run-time check could not do this:
  App Review runs a build in StoreKit's sandbox, as TestFlight does, so it
  would have shown the reviewer the tester's page.

## Still to do

Free, can be done now:

- A privacy policy page and a support page, each at a public URL.
- The App Privacy form, the age rating and the content rights questionnaires.
- The store listing in fr-FR, en-US, pt-BR, es-ES: name, subtitle,
  description, keywords, screenshots (the CI screenshots, 3840x2160). The demo
  samples' pictures have been dead links since about 2026-10-03 (keys from
  before the mirror's `VERSION` 2, 404 on both hosts): rekey or recapture them
  before taking store screenshots in demo mode.

Julien's decisions:

- **Other people's trademarks in a public repository** (the badges in
  `proxy/assets/leagues` and `teams`; the flags are MIT) are the most visible
  exposure, and no fix is free. A private repository bills the CI: both
  workflows run on macOS runners, free only for a public repository; private,
  macOS minutes count ten times against the plan's included minutes, and the
  last 30 days used about 1,775 of them over 126 runs. Deleting the files stops
  the proxy (it reads `proxy/assets/teams` at startup) and leaves them in git history.
- **Sources whose terms forbid public use whatever the price:** Orange Cat
  Blacktop's free tier, "prototyping and non-commercial projects", carries both
  F1 and MotoGP; Jolpica, the F1 driver flags and keyless fallback, is CC
  BY-NC-SA (`docs/motorsport-sources.md`); tennis and the TV guides have
  unstated terms (`docs/data-providers.md`). The player photos come through
  the paid TheSportsDB key; their pictures' own rights are crowd-uploaded and
  fall under the takedown risk above. Each needs its paid plan, a replacement,
  or to be left out, on the proxy, since one proxy serves every build.

External TestFlight (a public link, up to 10,000 testers, behind Apple's
lighter beta review) skips the store paperwork, not the licensing: the private
beta decision (AGENTS.md) wants the sources above settled before anyone but
Julien installs the app.
