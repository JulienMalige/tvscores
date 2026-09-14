# Release and TestFlight

No Mac is involved. A GitHub Actions macOS runner archives the app and hands
it to App Store Connect; signing certificates and profiles are created in the
cloud by `xcodebuild -allowProvisioningUpdates` using an App Store Connect API
key.

## Apple side (already done)

| Item | Value |
| --- | --- |
| Team ID | `BNZ6TK345E` |
| Bundle ID | `com.julienmalige.tvscores` |
| App ID (App Store Connect) | `6811973076`, SKU `tvscores` |
| API key | `72PN8L6U72`, role App Manager |
| Issuer ID | `69a6de7c-7178-47e3-e053-5b8c7c11a4d1` |
| Internal TestFlight group | `Internal`, account holder added as tester |

The `.p8` private key lives only in `~/.config/tvscores/` on the VPS (mode 600)
and in GitHub Actions secrets. It is never committed; `.gitignore` blocks
`*.p8`.

## GitHub secrets

`ASC_KEY_P8`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_TEAM_ID`.

## Shipping a build

Run the **TestFlight** workflow from the Actions tab, or:

```sh
gh workflow run testflight.yml --repo JulienMalige/tvscores
```

The build number is the workflow run number, so every run is unique. The
marketing version comes from `MARKETING_VERSION` in `app/project.yml`; bump it
there for a new version. Processing in App Store Connect takes a few minutes,
after which the build appears in TestFlight for the `Internal` group and can be
installed on the Apple TV from the TestFlight app.

## Talking to App Store Connect from the shell

`scripts/asc.mjs` signs the ES256 JWT itself and has no dependencies. It reads
`~/.config/tvscores/asc.env`, or `ASC_KEY_P8` from the environment in CI.

```sh
node scripts/asc.mjs whoami            # team id, bundle ids, apps
node scripts/asc.mjs get /v1/apps/6811973076/builds
```

## Brand assets

`scripts/make-brand-assets.py` regenerates `app/Resources/Assets.xcassets`:
the layered tvOS app icon (400x240 and 1280x768) and the top shelf images
(1920x720 and 2320x720). The mark is drawn as geometry, so it needs no font
and no licensed artwork. Layers are split back, middle, front for the tvOS
parallax effect.
