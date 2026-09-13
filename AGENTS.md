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
5. **Team names and colours, not crests**, until a decision in `docs/` says otherwise.
6. **Do not commit** `.xcodeproj` contents, `DerivedData`, `xcuserdata`, `.env`, or any secret. The `.gitignore` covers these; keep it that way.
7. **Do not run anything that needs an Apple Developer account** (archive, upload, TestFlight) unless Julien has said the enrollment is done.

## Building the app

Always from `app/`:

```bash
xcodegen generate
xcodebuild -project tvscores.xcodeproj -scheme tvscores \
  -destination 'platform=tvOS Simulator,name=Apple TV' build
```

To see it, boot a simulator and take a screenshot rather than describing the UI:

```bash
xcrun simctl boot "Apple TV" 2>/dev/null; open -a Simulator
xcrun simctl install booted <path to .app from DerivedData>
xcrun simctl launch booted com.julienmalige.tvscores
xcrun simctl io booted screenshot /tmp/tvscores.png
```

Send the screenshot to Julien after every visible change. Judge on the image, not on the code.

## Conventions

- Swift, SwiftUI, Swift Concurrency (`async/await`). No Combine unless a framework forces it.
- Minimum tvOS: the current major version minus one.
- Bundle id `com.julienmalige.tvscores`.
- One feature per commit, with a message that says what changed for the user.
- Every decision that is not derivable from the code goes into `docs/` as a dated note.

## Proxy

Language and framework are not decided. Requirements it must meet:

- Poll the sports API on a schedule (not on request), respecting the free tier limits.
- Serve `GET /v1/fixtures?date=YYYY-MM-DD` and `GET /v1/fixtures?week=YYYY-Www` as JSON with cache headers.
- Store the key in an environment variable read at startup.
- Fail closed: if the upstream is down, serve the last good cache with a `stale: true` flag.

## Open decisions (ask Julien, do not guess)

- Which leagues are in the MVP.
- Which data provider (candidates so far: football-data.org, API-Sports).
- Proxy language.
- Whether the repo stays private.

## Working with Julien

- Julien is usually on an iPad, driving this Mac session through Remote Control. Keep replies short and send images for anything visual.
- Never say "open it on your laptop"; you are on the laptop.
- If a step needs `sudo`, an Apple ID login, or an App Store purchase, stop and ask.
