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
- Tennis: not in the MVP unless a provider is picked (API-Sports has none).

## tvOS adaptation

- Tabs become a top segmented control driven by the focus engine; the
  league headers and game rows are focusable so the user can drill into a
  game with the remote.
- Rows are wider: keep the same five-column shape, scale type up
  (score ≈ 64 pt, names ≈ 29 pt), keep at least six rows visible on a 1080p
  frame.
- Dark green tinted background is Apple's; we use our own dark neutral and
  the league's accent colour on the header only.
- Logos: Apple licenses crests. We show a coloured monogram in the team's
  colours until a licensing decision says otherwise (see AGENTS.md rule 5).

## Leagues seen on Julien's home screen

UEFA Champions League, Formula 1, NBA, NFL, Men's Tennis. MVP subset to be
confirmed by Julien; provider coverage drives the choice.
