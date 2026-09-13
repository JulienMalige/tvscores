# tvscores

A small, fast Apple TV app that answers one question: **what games are on today and this week, and what is the score?**

Think Apple Sports or Flashscore, reduced to the essentials and designed for the couch: big type, remote-friendly navigation, no clutter.

## MVP scope

- One or two leagues (decided in `AGENTS.md`), expandable later.
- Screens: **Today**, **This week**, and a **Match** detail (score, status, kickoff time, minute).
- Favourite teams filter, stored on-device.
- Team names and colours; no crests or league marks in the MVP (trademark safety).
- No odds, no betting links, no streaming links.

## Architecture

```
Apple TV (SwiftUI, tvOS)  ──HTTPS──▶  proxy on the VPS  ──scheduled──▶  licensed sports API
        reads cached JSON              caches + hides key           paid per request
```

- **`app/`** — the tvOS app. Native SwiftUI, no cross-platform layer. Project generated from `project.yml` with XcodeGen so the Xcode project is reproducible from text.
- **`proxy/`** — a tiny service on the VPS that polls the sports API on a schedule, caches results, and serves plain JSON to the app. The API key lives here only. Cost is fixed regardless of user count.

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

## Status

Day 0. Repo contains only this README and the agent brief.
