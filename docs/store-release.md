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
  the TestFlight workflow's `store: true` (`docs/release.md`). It has no Debug
  section in Settings (Open apps), which a reviewer could take for an
  unfinished app, and never posts the diagnostic trace, so App Privacy has no
  diagnostics to declare. Every other build keeps both. A run-time check could
  not do this: App Review runs a build in StoreKit's sandbox, as TestFlight
  does, so it would have shown the reviewer the tester's page. Tools for
  testers go in that Debug section (Julien, 2026-10-27, keeping Open apps on
  TestFlight: "Like a debug. We can add a debug section with this kind of
  thing").

- **The website** (2026-10-27, Julien: "we need to build a website"): the
  pages Apple asks for live at the proxy's own address, served by the proxy
  from `site/` (`proxy/src/site.js`): a home page, the privacy policy and the
  support page, in the four store languages. The addresses to give App Store
  Connect, per locale: `https://tvscores.julienmalige.com/<lang>/privacy` and
  `/<lang>/support`, with `en` for en-US, `fr` for fr-FR, `pt` for pt-BR and
  `es` for es-ES (the bare `/privacy` and `/support` pick the browser's
  language). The contact is `support@julienmalige.com`, forwarded to Julien's
  Gmail by Cloudflare Email Routing, so his own address stays off the page
  (on since 2026-10-27; a test was logged "Forwarded").
  The policy says the store build collects nothing: the proxy logs no
  visitor, the tunnel's log names Cloudflare's edge rather than the viewer,
  and the trace is a tester's only. App Privacy is answered to match it.

- **Sold everywhere but China mainland** (Julien, 2026-10-27), which wants a
  government ICP filing number: 174 of Apple's 175 territories, and any it
  adds later (`availableInNewTerritories`).

## Still to do

Free, can be done now:

- The EU's trader status (Digital Services Act), Julien's to declare on the
  website: Business → Compliance → Digital Services Act. Until then the 27 EU
  countries, France, Spain and Portugal among them, read
  `TRADER_STATUS_NOT_PROVIDED` and the app cannot be sold there.
- The content rights question (whether the app has the rights to the
  third-party content it shows) waits on the sources below.

Done, all on 2026-10-27: the store page, its words in fr-FR, en-US, pt-BR and
es-ES, the category, the copyright and the free price (`docs/store-listing.md`,
sent by its push), and a first set of screenshots from live data
(`store-shots.yml`), to be replaced by a busier day's, a Sunday afternoon. Live
data sidesteps the demo samples' dead pictures (keys from before the mirror's
`VERSION` 2, 404 on both hosts, since about 2026-10-03); those still want
rekeying for the CI's own demo screenshots. App Privacy says "Data Not
Collected", as the policy does (Julien, on the website: the API has no way to
it). The age rating is 4+, and Brazil's own L, from every answer None or No:
no ads, gambling, web view, user content or chat. App Review's contact is
Julien, `support@julienmalige.com` and his mobile, with no sign-in to give;
Apple refuses a contact without a phone, written with `+` and the country code.

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
