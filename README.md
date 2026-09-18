# TV Scores

A small, fast Apple TV app that answers one question: **what games are on, and
what is the score?**

Think Apple Sports reduced to the essentials and designed for the couch: big
type, remote-friendly navigation, no clutter.

> Working on this repository? Read [AGENTS.md](AGENTS.md). It has the commands,
> the rules and the conventions. This file is the tour.

## What it does

**Yesterday, Today, Upcoming**, grouped by competition, in French, English,
Portuguese and Spanish. Opening a competition gives its own page and its
standings; opening a race gives the full classification.

Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Brasileirão, Champions
League, Europa League, Copa Libertadores, NFL, NBA, Formula 1, MotoGP and the
ATP and WTA tours — the days under the title, every competition in the menu.
No odds, no betting, no streaming links.

## How it works

```
Apple TV (SwiftUI, tvOS)  ──HTTPS──▶  proxy on the VPS  ──scheduled──▶  sports APIs
        reads cached JSON              caches, holds every key        paid per request
```

The app never holds a credential and never calls a provider. The proxy polls on
a schedule, so the cost is the same whether one person watches or a thousand.
It also mirrors crests and portraits locally, so the television talks to one
host. See [proxy/README.md](proxy/README.md) for its endpoints and budget.

There is no Mac in this picture. The app is built, screenshotted and signed on
GitHub Actions macOS runners, which is the only place Xcode exists.

## Store identity

- Product name **TV Scores**, bundle id `com.julienmalige.tvscores`. Checked
  2026-09-13: no App Store app uses the exact name, though "Scores TV" and
  "ScoreTV" exist, so the subtitle has to differentiate.
- Launch languages French, English, Portuguese, Spanish, app and listing both.
- Subtitles: "Matchs du jour et résultats", "Today's games, live", "Jogos de
  hoje, ao vivo", "Partidos de hoy, en directo".

## Status

On TestFlight, installable on a real Apple TV. What each build changed is in
[CHANGELOG.md](CHANGELOG.md).

Before it can go to the store: paid tiers for the motorsport and photo sources,
a football source with real date ranges, and a home for the proxy that is meant
to carry an audience. Those are tracked as open decisions in
[AGENTS.md](AGENTS.md).

## Where things are

| | |
|---|---|
| [AGENTS.md](AGENTS.md) | how to work here: commands, hard rules, conventions, open decisions |
| [CHANGELOG.md](CHANGELOG.md) | what each build changed, written for whoever installs it |
| [proxy/README.md](proxy/README.md) | the proxy's endpoints, providers, quotas and caches |
| [docs/data-providers.md](docs/data-providers.md) | who the data comes from and on what terms |
| [docs/design-reference.md](docs/design-reference.md) | the layout every screen is judged against |
| [docs/design-system.md](docs/design-system.md) | what the pieces of the interface are called |
| [docs/release.md](docs/release.md) | signing and the road to TestFlight |
