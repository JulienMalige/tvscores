# Agent brief — tvscores

You are working on a tvOS app plus a small caching proxy. Read this file before touching anything. The README describes the product; this file describes how to work on it.

## Layout

```
app/          tvOS app (SwiftUI). Xcode project generated from app/project.yml with XcodeGen.
proxy/        caching proxy that runs on Julien's VPS. Owns the sports API key.
docs/         decisions, data licence, App Store notes. One markdown file per topic.
```

None of these directories exist yet. Create them as the work needs them, not up front.

## Hard rules

1. **The sports API key never enters `app/`.** The app talks only to the proxy. If you need data in the app, add an endpoint to the proxy.
2. **Native SwiftUI for tvOS only.** No React Native, Flutter, or web views.
3. **Licensed data only.** Do not add code that scrapes a website or calls an undocumented endpoint. If a provider is proposed, record its terms in `docs/data-licence.md` first.
4. **No odds, betting, or streaming links** anywhere in the app.
5. **Crests come from the proxy** (`team.logo`, API-Sports media CDN), decided by Julien on 2026-09-14 knowing the trademark risk; the monogram stays as the fallback. Never bundle logo files in the app.
6. **Do not commit** `.xcodeproj` contents, `DerivedData`, `xcuserdata`, `.env`, or any secret. The `.gitignore` covers these; keep it that way.
7. **Apple credentials stay out of the repo.** Enrollment is done and the App Store Connect API key is in
   `~/.config/tvscores/asc.env` plus GitHub secrets. Never commit a `.p8`, and never print a key. Releases go
   through the `TestFlight` workflow; see `docs/release.md`.

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
- Minimum tvOS: the current major version minus one.
- **Four languages from day one: French, English, Portuguese, Spanish.** Development language is English. Every user-facing string goes through a String Catalog (`Localizable.xcstrings`) with all four translations filled in before a feature is called done; no hard-coded strings in views. Store listing (name, subtitle, keywords, screenshots) is localised for the same four. Default store locales: fr-FR, en-US, pt-BR, es-ES; add pt-PT and es-MX as copies later if wanted.
- Dates, times and team names are locale-aware: kickoff times in the viewer's time zone, day names via `Date.FormatStyle`, never hand-formatted.
- Product name **TV Scores**, bundle id `com.julienmalige.tvscores`, Xcode scheme and target `TVScores`.
- One feature per commit, with a message that says what changed for the user.
- Every decision that is not derivable from the code goes into `docs/` as a dated note.

## Proxy

Built 2026-09-13 in `proxy/` (Node 22, no dependencies, see `proxy/README.md`).
Runs on Julien's VPS as a systemd user service, public at
`https://srv1822832.tailf78112.ts.net/tvscores/v1/scoreboard?tz=<IANA tz>`.
The app reads only `/v1/scoreboard` (and `/v1/health` for a debug screen).
Rules: polling on a schedule, never per request; per-sport daily budget with a
reserve; last good cache served with `stale` flags when upstream fails; the
`/v1/health` endpoint exposes quota use per sport.

## Design

Follow `docs/design-reference.md` (Apple Sports layout adapted to tvOS) for every screen. Judge each build on the screenshot against that note.

## Open decisions (ask Julien, do not guess)

- Which leagues are in the MVP: currently Champions League, F1, MotoGP, ATP/WTA, NBA, NFL. Rugby is available on the API-Sports plan if Julien wants it.
- Data provider: decided, API-Sports free plans + Jolpica for F1 (see `docs/data-providers.md`).
- Proxy language: decided, Node 22 plain JS.
- Whether the repo stays private.

## Working with Julien

- Julien is usually on an iPad, driving this Mac session through Remote Control. Keep replies short and send images for anything visual.
- Never say "open it on your laptop"; you are on the laptop.
- If a step needs `sudo`, an Apple ID login, or an App Store purchase, stop and ask.
