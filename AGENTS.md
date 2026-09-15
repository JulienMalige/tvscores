# Agent brief — tvscores

You are working on a tvOS app plus a small caching proxy. Read this file before
touching anything. The [README](README.md) is the tour for a human arriving at
the repository; this file is how the work is actually done. Keep it that way:
if a thing is a command, a rule or a convention it belongs here and nowhere
else.

## Layout

```
app/          tvOS app (SwiftUI). Xcode project generated from app/project.yml with XcodeGen.
proxy/        caching proxy that runs on Julien's VPS. Owns every provider key.
docs/         decisions, provider terms, release notes. One markdown file per topic.
scripts/      repository tooling: the audit, the brand assets, the App Store Connect client.
design/       source artwork the build scripts read. Not bundled in the app.
CHANGELOG.md  what each TestFlight build changed, for whoever installs it.
.claude/      the source-hygiene skill. Personal settings there are gitignored.
```

## Hard rules

1. **The sports API key never enters `app/`.** The app talks only to the proxy. If you need data in the app, add an endpoint to the proxy.
2. **Native SwiftUI for tvOS only.** No React Native, Flutter, or web views.
3. **Licensed data only.** Do not add code that scrapes a website or calls an undocumented endpoint. If a provider is proposed, record its terms in `docs/data-providers.md` first.
4. **No odds, betting, or streaming links** anywhere in the app.
5. **Crests come from the proxy** (`team.logo`, API-Sports media CDN), decided by Julien on 2026-09-14 knowing the trademark risk; the monogram stays as the fallback. Never bundle logo files in the app.
6. **Do not commit** `.xcodeproj` contents, `DerivedData`, `xcuserdata`, `.env`, or any secret. The `.gitignore` covers these; keep it that way.
7. **Every change a tester could notice goes in `CHANGELOG.md`** under
   `## Unreleased`, in the same commit. It is written for whoever installs the
   app, not for whoever wrote it, and the release job sends it to TestFlight as
   the build's "What to Test" note. Tooling and internal refactors do not
   belong there.
8. **Apple credentials stay out of the repo.** Enrollment is done and the App Store Connect API key is in
   `~/.config/tvscores/asc.env` plus GitHub secrets. Never commit a `.p8`, and never print a key. Releases go
   through the `TestFlight` workflow; see `docs/release.md`.

## Building and checking

Every check the repository runs, in the order you need them:

```sh
node scripts/audit.mjs   # must be clean before a push
cd proxy && npm test     # 54 tests
```

The `source-hygiene` skill wraps the audit and adds the judgement a script
cannot make. Run it when asked about the state of the source.

## Building the app

Always from `app/`:

```bash
xcodegen generate
xcodebuild -project TVScores.xcodeproj -scheme TVScores \
  -destination 'platform=tvOS Simulator,name=Apple TV' build
```

To see it, boot a simulator and take a screenshot rather than describing the UI:

```bash
xcrun simctl boot "Apple TV" 2>/dev/null; open -a Simulator
xcrun simctl install booted <path to .app from DerivedData>
SIMCTL_CHILD_TZ=America/Sao_Paulo xcrun simctl launch booted com.julienmalige.tvscores -TVScoresDemo -TVScoresTab today   # bundled sample (captured with tz=America/Sao_Paulo); drop -TVScoresDemo for the live proxy
xcrun simctl io booted screenshot /tmp/tvscores.png
```

Send the screenshot to Julien after every visible change. Judge on the image, not on the code.
Julien watches from Brazil (America/Sao_Paulo): capture `Resources/sample-scoreboard.json` with `?tz=America/Sao_Paulo` and run the demo simulator in that zone so dates and buckets agree.

## Conventions

- Swift, SwiftUI, Swift Concurrency (`async/await`). No Combine unless a framework forces it.
- Minimum tvOS 18.0 (`app/project.yml`). Raise it only for a feature worth losing a TV over.
- **Four languages from day one: French, English, Portuguese, Spanish.** Development language is English. Every user-facing string goes through a String Catalog (`Localizable.xcstrings`) with all four translations filled in before a feature is called done; no hard-coded strings in views. Store listing (name, subtitle, keywords, screenshots) is localised for the same four. Default store locales: fr-FR, en-US, pt-BR, es-ES; add pt-PT and es-MX as copies later if wanted.
- Dates, times and team names are locale-aware: kickoff times in the viewer's time zone, day names via `Date.FormatStyle`, never hand-formatted.
- Product name **TV Scores**, bundle id `com.julienmalige.tvscores`, Xcode scheme and target `TVScores`.
- One feature per commit, with a message that says what changed for the user.
- Every decision that is not derivable from the code goes into `docs/` as a dated note.
- **Review the diff before pushing**, and fix what the review finds. Run
  `node scripts/audit.mjs`, which has to be clean.
- **Look at the CI screenshots before building for TestFlight.** The workflow
  renders the app against live data; judge the build on those images, not on
  the diff. Releases then go out through the `TestFlight` workflow.

## Proxy

Built 2026-09-13 in `proxy/` (Node 22, no dependencies, see `proxy/README.md`).
Runs on Julien's VPS as a systemd user service, public at
`https://srv1822832.tailf78112.ts.net/tvscores/v1/scoreboard?tz=<IANA tz>`.
The app reads `/v1/scoreboard` and `/v1/standings/{sport}/{league}`, and loads
images from `/v1/img/...` and `/v1/assets/...` which the scoreboard hands it.
Rules: polling on a schedule, never per request; per-sport daily budget with a
reserve; last good cache served with `stale` flags when upstream fails; the
`/v1/health` endpoint exposes quota use per sport.

### When the proxy fetches

This is the mechanic to preserve; `proxy/src/scheduler.js` owns it and
`proxy/test/scheduler.test.js` pins it down.

| What | When | Cost per round |
|---|---|---|
| Schedules (`daily`) | once per UTC day after `dailyRefreshHourUtc`, or after `idleRefreshMinutes` — but never while a game could be in progress | football 9 calls (a day each), NFL/NBA 3 |
| Scores (`live`) | only inside a live window, then every `liveIntervalSeconds` (30 min) | 1 call per sport |
| Standings | every 6 hours | 1 per league |
| Portraits | once per athlete, kept a month | background, 25/min |
| Crests, badges | mirrored once, served with a month-long header | none after the first |

A **live window** opens 10 minutes before a stored kickoff and closes
`liveWindowHours` (4 h) after it — twice that for a game already reported
live, because five-setters and overtime run long. Outside a window the
scheduler wakes every 5 minutes and makes **no request at all**.

Invariants worth keeping:

- **Nothing polls on a blind timer.** If you add a fetch, hang it off the
  window or the daily pass, not a `setInterval`.
- **A live game must be able to stop being live.** A provider's live feed
  lists only games in progress, so a finished match disappears from it; the
  scheduler refetches that match's own UTC date through `provider.byDate` to
  learn the final score. A provider with a `live()` needs a `byDate()`.
- **Failures back off**: each consecutive one doubles the wait to a one-hour
  ceiling, cleared by a single good answer.
- **Answers carry an `ETag`** and honour `If-None-Match` with a bodyless 304.
  The board is ~48 KB and the television asks every minute during a game.
- **Swapping a provider changes event ids**, so bump `SCHEMA_VERSION` in
  `proxy/src/cache.js`: it empties the events and the daily stamps, and the
  next tick refills. Without it the same match shows twice, once per id.

## Design

Follow `docs/design-reference.md` (Apple Sports layout adapted to tvOS) for every screen. Judge each build on the screenshot against that note.

The code behind it is named in `docs/design-system.md`: four levels — screen,
section, row, element — each with its folder under `app/Sources/Views` and its
name ending. Every measurement lives in `Views/Metrics.swift`; a view that
writes its own number is a bug, and rows all use `rowSurface(focused:)`.

## Open decisions (ask Julien, do not guess)

- **Paid data tiers before any public release.** The motorsport source is free
  for non-commercial use only, the photo source runs on a public test key, and
  the badges under `proxy/assets` are other people's trademarks in a public
  repository. This is the real gate on shipping to the store.
- **A seven-day Upcoming for football** needs a source with date ranges; the
  free plan serves yesterday to tomorrow only. See `docs/data-providers.md`.
- **Where the proxy lives** once people other than Julien install the app. Its
  address is baked into every build, and the current tunnel is not meant for
  an audience.
- Leagues in the MVP: Premier League, Champions League, NFL, NBA, F1, MotoGP,
  ATP/WTA. Rugby is available on the same plan if Julien wants it.

## Working with Julien

- **There is no Mac.** This session runs on a Linux VPS. The app is built,
  screenshotted and signed on GitHub Actions macOS runners; that is the only
  place Xcode exists. Never suggest opening something locally in Xcode.
- Julien is usually on an iPad. Keep replies short and send images for anything
  visual: he judges the work on the picture, not on the description.
- If a step needs `sudo`, an Apple ID login, or an App Store purchase, stop and ask.
- Run the `source-hygiene` skill when asked to check the state of the source.
