# The design system, 2026-09-15

Named after Julien asked for it: "can we name the different view / level of
view we have on the app? it will be easier to maintain, be consistent on design
etc." Before this, five kinds of row each invented their own height, and the
standings rows came out short enough that the constructor badges crowded the
edges of their card.

## The five levels

Every view file lives in the folder of its level and ends with the level's name,
so a file says what it is before you open it.

| Level | Folder | What it owns | Members |
|---|---|---|---|
| **Screen** | `app/Sources/Views/Screens` | the scroll view, the page margins, the navigation | `HomeScreen`, `LeagueScreen`, `RaceScreen` |
| **Section** | `app/Sources/Views/Sections` | a heading and the list under it | `LeagueSection`, `StandingsSection`, `PodiumSection`, `ResultSection`, `SessionSection`, `OffseasonSection` |
| **Row** | `app/Sources/Views/Rows` | one focusable line, on the shared row surface | `MatchRow`, `RaceRow`, `StandingsRow`, `ResultRow`, `SessionRow` |
| **Element** | `app/Sources/Views/Elements` | the atoms a row is made of | `TeamMark`, `PersonMark`, `LeagueMark`, `FlagMark`, `StatusLabel`, `EmptyDay`, `CachedImage`, `Segments` |
| **Chrome** | `app/Sources/Views/Chrome` | navigation that outlives any one screen | `Sidebar`, `SidebarRow`, `DayTabs`, `ClockLabel`, `LaunchLoader` |

Sections stack inside a screen; they never nest. A row never reaches outside
itself for a measurement, and a screen never draws a row's insides. Chrome is
the exception to "everything lives on a screen": the sidebar wraps every
screen, and tvOS draws it — which is why nothing in `Chrome/` is worth a
snapshot test, and why its rows are given square icons rather than sizes.
`Segments` — the day switch (`DayTabs`) and the table switch under a
competition — is UIKit's `UISegmentedControl`, wrapped, with its track
cleared at creation. SwiftUI's picker draws a track nothing reaches; pills
of our own (tried 2026-09-19) came out larger and lost the system's focus
feel. A segment is chosen as focus reaches it, as in the Apple TV app.

A **mark** is the identity image of something: a crest (`TeamMark`), a portrait
(`PersonMark`), a competition (`LeagueMark`). All three are the same size in a
row, which is what makes the lists line up.

## The numbers

They all live in `app/Sources/Views/Metrics.swift`. Nothing else in the app
writes a measurement of its own.

| Name | Value | What it is |
|---|---|---|
| `screenMargin` | 80 | the app's left and right edge |
| `screenTop` / `screenBottom` | 60 / 80 | page top and bottom |
| `sectionGap` | 48 | between two sections |
| `headingGap` | 18 | heading to its list |
| `rowInsetV` / `rowInsetH` | 18 / 28 | inside a row's card |
| `rowGap` | 10 | between two rows |
| `rowRadius` | 20 | a row's corner |
| `mark` | 64 | crest, badge or portrait in a row |
| `markHero` | 110 | the same on a podium, where it is the subject |
| `leagueMark` | 52 | competition mark height; width up to 2.5× for wordmarks |

`rowSurface(focused:)` applies the inset, the corner and the focus highlight, so
what every row shares is the rhythm rather than one fixed number: a row is as
tall as the tallest thing in it plus `2 × rowInsetV`. Where that is the mark —
a standings line, say — the row measures 100 points. A race result row is taller
because on tvOS the driver's name and team stacked together are taller than a
64-point portrait, and a match row is taller because of the score. Measured on
the CI render, standings rows now repeat every 110 points (100 + `rowGap`); they
used to be 76 with a 2-point gap, which is what crowded the badges.

## The tests mirror the levels

`app/Tests/Unit` holds Swift Testing suites named for a level — `Model`,
`Elements`, `Chrome` — and judges the code without a screen: the bundled
sample decodes, every status has its four translations, the image cache
retries and forgets, the menu's league list survives a refresh.
`app/Tests/Flows` holds one XCUITest per screen, one for the sidebar, and
`NavigationFlow` for what joins them — where focus lands, the menu opening,
a press taking you somewhere and back — each driving the app in demo mode
with `XCUIRemote`, the only cursor a television has. Rows and sections are
covered through the screen that shows them; they do not exist on their own.
Both run in CI before the screenshots, on the same simulator.

One thing the simulator cannot judge: whether the system sidebar stays open.
Driven by `XCUIRemote` it shuts within a second of opening — for a bare
three-tab `TabView` as much as for ours (settled 2026-09-17, eight CI runs
bisecting every piece of the app). Every flow that opens the menu is a probe
behind `TVSCORES_MENU_PROBE=1`, and the television is the judge: with the
day switch on the page, a menu that shuts drops focus onto a segment, which
selects it, so not even "open and pick" can be asserted there.

## Working on a screen

- Adding a measurement means adding it here and in `Metrics`, not in the view.
- A new list row goes in `Views/Rows`, uses `rowSurface`, and is named `…Row`.
- Layout is judged on a screenshot against `design-reference.md`; this note is
  about how the code is arranged, not about what it should look like.
