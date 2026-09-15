# Release and TestFlight

No Mac is involved. A GitHub Actions macOS runner archives the app and hands
it to App Store Connect.

Signing is **manual**. Xcode's cloud signing (`-allowProvisioningUpdates`) was
tried first and Apple refused it with "Cloud signing permission error": that
path needs an API key with the Admin role, and ours is App Manager. The same
App Manager key can create the signing assets through the API directly, so the
distribution certificate and the App Store profile were minted once and stored
as repository secrets.

## Apple side (already done)

| Item | Value |
| --- | --- |
| Team ID | `BNZ6TK345E` |
| Bundle ID | `com.julienmalige.tvscores` |
| App ID (App Store Connect) | `6811973076`, SKU `tvscores` |
| API key | `72PN8L6U72`, role App Manager |
| Issuer ID | `69a6de7c-7178-47e3-e053-5b8c7c11a4d1` |
| Internal TestFlight group | `Internal`, account holder added as tester |
| Distribution certificate | `TLAS59R725`, expires 2027-09-14 |
| Provisioning profile | `TV Scores tvOS App Store`, expires 2027-09-14 |

The `.p8` private key lives only in `~/.config/tvscores/` on the VPS (mode 600)
and in GitHub Actions secrets. It is never committed; `.gitignore` blocks
`*.p8`.

## GitHub secrets

`ASC_KEY_P8`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_TEAM_ID` authenticate the
upload. `DIST_P12_BASE64`, `DIST_P12_PASSWORD`, `DIST_PROFILE_BASE64` carry the
signing assets; the workflow imports them into a throwaway keychain that it
deletes afterwards. Copies live on the VPS in `~/.config/tvscores/` as
`dist.p12`, `dist.p12.password`, `dist.key` and `dist.mobileprovision`.

## Renewing the certificate or the profile

Both expire on 2027-09-14. To mint new ones, without a Mac:

```sh
openssl req -new -newkey rsa:2048 -nodes -keyout dist.key -out dist.csr \
  -subj "/CN=TV Scores Distribution/C=BR"
node scripts/asc.mjs get /v1/certificates      # see what exists first
```

Then POST the CSR to `/v1/certificates` with `certificateType: DISTRIBUTION`,
POST a `/v1/profiles` of type `TVOS_APP_STORE` bound to the bundle id and that
certificate, convert the returned certificate to a `.p12` with the private key,
and replace the three `DIST_*` secrets. A team may hold only a few distribution
certificates at once, so revoke the old one when it is no longer referenced.

## Shipping a build

Run the **TestFlight** workflow from the Actions tab, or:

```sh
gh workflow run testflight.yml --repo JulienMalige/tvscores
```

The job finishes by waiting for Apple to process the build, giving it the top
section of `CHANGELOG.md` as its "What to Test" note, and adding it to the
`Internal` group. So the only thing to do by hand before a release is write
that changelog entry.

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
