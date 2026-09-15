# TV Scores

A small, fast Apple TV app that answers one question: **what games are on today and this week, and what is the score?**

Think Apple Sports or Flashscore, reduced to the essentials and designed for the couch: big type, remote-friendly navigation, no clutter.

## MVP scope

- One or two leagues (decided in `AGENTS.md`), expandable later.
- Screens: **Yesterday / Today / Upcoming** grouped by league, and a **Match** detail (score, status, kickoff time, minute). Layout follows Apple Sports, see `docs/design-reference.md`.
- Favourite teams filter, stored on-device.
- Team crests from the data provider, monogram fallback (decision 2026-09-14; trademark risk noted in `docs/`).
- No odds, no betting links, no streaming links.

## Architecture

```
Apple TV (SwiftUI, tvOS)  ──HTTPS──▶  proxy on the VPS  ──scheduled──▶  licensed sports API
        reads cached JSON              caches + hides key           paid per request
```

- **`app/`** — the tvOS app. Native SwiftUI, no cross-platform layer. Project generated from `project.yml` with XcodeGen so the Xcode project is reproducible from text.
- **`proxy/`** — a tiny Node service on the VPS that polls the sports APIs on a schedule, caches results, and serves plain JSON to the app. The API key lives here only. Cost is fixed regardless of user count. See `proxy/README.md`.

## Development setup

tvOS only builds with Xcode, so app work happens on the MacBook. Everything else (proxy, docs, planning) can happen anywhere.

On the Mac:

```bash
git clone git@github.com:JulienMalige/tvscores.git
cd tvscores
claude            # accept workspace trust once
claude remote-control   # then drive it from the Claude app on the iPad
```

Prerequisites on the Mac: current Xcode from the App Store, `brew install xcodegen`, Claude Code signed in with a claude.ai account.

## Running on a real Apple TV

| Goal | Needs |
|---|---|
| tvOS simulator | nothing beyond Xcode |
| Your own Apple TV, from Xcode over Wi-Fi | free Apple ID, Mac and TV on the same network, 7-day expiry |
| TestFlight, or any install away from the Mac | paid Apple Developer Program |
| App Store | paid program, privacy policy URL, data licence you can show a reviewer |

## App Store guardrails

- Use only a data provider whose terms allow display in a consumer app. Keep the licence text in `docs/`.
- No scraping of ESPN, Flashscore or similar.
- Enough native tvOS structure (focus engine, top shelf, sections) to clear the "minimum functionality" bar.

## Name and store listing

- Product name: **TV Scores** (checked 2026-09-13: no App Store app uses the exact name; "Scores TV", "ScoreTV" and "Scores and Odds TV" exist, so the subtitle must differentiate).
- Bundle id: `com.julienmalige.tvscores`.
- Launch languages: **French, English, Portuguese, Spanish**. App UI and store listing in all four from the first release.
- Subtitle carries the rest, per storefront:
  - fr: "Matchs du jour et résultats"
  - en: "Today's games, live"
  - pt: "Jogos de hoje, ao vivo"
  - es: "Partidos de hoy, en directo"
- Keywords field (100 chars, per language) holds the rest: football, ligue 1, résultats, match, ce soir, live, calendrier, fixtures, tv.

## Status

- `app/`: Yesterday / Today / Upcoming scoreboard reading the proxy (or a bundled sample with `-TVScoresDemo`), Apple Sports row layout, en/fr/pt/es. Built and screenshotted on every push by the GitHub Actions workflow (`.github/workflows/tvos.yml`).
- `proxy/`: live on the VPS with Champions League, NFL, NBA (API-Sports free plans), Formula 1 and MotoGP (Orange Cat Blacktop, results and calendar), ATP/WTA tennis (livetennisapi.com); quota-aware polling, disk cache, public HTTPS via Tailscale Funnel.
- Next: match detail screen, favourites, Top Shelf and app icon, then the Apple Developer enrollment for a TestFlight build on the real Apple TV.

## Keeping the source honest

```sh
node scripts/audit.mjs
```

Static checks over the whole repository: exports and modules nothing imports,
Swift types declared and never used, blocks of eight identical lines, naming
that has drifted, files grown past 260 lines, leftover markers and
commented-out code, documents naming files that no longer exist, routes served
but undocumented or documented but gone, line coverage under 70 percent, and
any credential that wandered out of `proxy/src/config.js`.

It runs on every push and once a day. A scheduled failure leaves a single
GitHub issue and closes it when the audit is clean again. Everything it reports
is a fact rather than a matter of taste, so a finding is worth acting on.
