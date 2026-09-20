# Design reference: Apple Sports (iPhone), 2026-09-13

Julien shared two screenshots of Apple Sports on iPhone as the reference for
TV Scores. The screenshots stay on his device; this note records what to copy.

## Structure

- Top-level tabs by time: **Yesterday · Today · Upcoming**. Today is default.
- Content grouped by league, each group headed by the league name (selectable,
  leads to the league screen).
- The order of leagues follows the user's own list (Apple: "My Teams" then
  the leagues they follow). For us: favourites first, then a fixed order.

## Game row (team sports)

```
[logo]  [score]        [status]          [score]  [logo]
 Home                  sub-status                  Away
```

- Score is the biggest element in the row. Winner (or leader) bright, the
  other side dimmed once the game is final.
- Centre status, one of: live clock ("3rd 2:37", "45+2'"), "Final",
  kickoff time in the viewer's time zone ("14:00"). Upcoming games show
  records ("0-1") where a score would be.
- Sub-status under the clock in a dimmer type: drive info for NFL, could be
  scorer or half for football. Optional in the MVP.
- Small marker beside the score of the side in possession while live.

## Non-team sports

- Formula 1: event name, "Race · Final" status, then the top three drivers
  with position, nationality, total time / gap. Reuse the same group header.
- Tennis: shipped, from livetennisapi (TheSportsDB has no structured sets).

## tvOS adaptation

- The day tabs are a row of pills of ours, chosen on click, drawn as the
  Apple TV app draws its season switch; the league headers and game rows
  are focusable so the user can drill into a game with the remote.
- Rows are wider and stacked: the crest with the name captioned under it,
  the score beside it (score ≈ 54 pt, names ≈ 27 pt). About five rows fit
  a 1080p frame.
- Dark green tinted background is Apple's; we use our own dark neutral and
  the league's accent colour on the header only.
- Logos: Apple licenses crests. Julien decided on 2026-09-14 to show the
  crests the proxy mirrors (`team.logo`), accepting the trademark risk noted
  in `docs/data-providers.md`; the coloured monogram remains the fallback
  while an image loads or is missing. F1 drivers get a nationality flag.

## Leagues seen on Julien's home screen

UEFA Champions League, Formula 1, NBA, NFL, Men's Tennis. MVP subset to be
confirmed by Julien; provider coverage drives the choice.

## Design system

- Apple **Human Interface Guidelines**, tvOS section:
  https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos
- **Liquid Glass** (WWDC 2025, tvOS 26+): the current look. Standard SwiftUI
  controls adopt it automatically when built with Xcode 26; custom containers
  use `.glassEffect()`. Apple Sports on iOS 26 is a reference implementation.
  https://developer.apple.com/documentation/technologyoverviews/liquid-glass
- Fonts: San Francisco via `Font.system`. Icons: SF Symbols only.
- tvOS rules to respect: focus engine (focused item scales, others dim),
  safe zone ≈ 60 pt top/bottom and 80 pt sides on 1920×1080, large type,
  Top Shelf image and layered app icon before any store submission.
