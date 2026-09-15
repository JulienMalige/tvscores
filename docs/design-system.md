# The design system, 2026-09-15

Named after Julien asked for it: "can we name the different view / level of
view we have on the app? it will be easier to maintain, be consistent on design
etc." Before this, five kinds of row each invented their own height, and the
standings rows came out short enough that the constructor badges crowded the
edges of their card.

## The four levels

Every view file lives in the folder of its level and ends with the level's name,
so a file says what it is before you open it.

| Level | Folder | What it owns | Members |
|---|---|---|---|
| **Screen** | `app/Sources/Views/Screens` | the scroll view, the page margins, the navigation | `HomeScreen`, `LeagueScreen`, `RaceScreen` |
| **Section** | `app/Sources/Views/Sections` | a heading and the list under it | `LeagueSection`, `StandingsSection`, `PodiumSection`, `ResultSection` |
| **Row** | `app/Sources/Views/Rows` | one focusable line, on the shared row surface | `MatchRow`, `RaceRow`, `StandingsRow`, `ResultRow` |
| **Element** | `app/Sources/Views/Elements` | the atoms a row is made of | `TeamMark`, `PersonMark`, `LeagueMark`, `StatusLabel`, `DayTabs`, `EmptyDay` |

Sections stack inside a screen; they never nest. A row never reaches outside
itself for a measurement, and a screen never draws a row's insides.

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

A row is therefore `mark + 2 × rowInsetV` = **100 points tall**, everywhere in
the app, and `rowSurface(focused:)` applies the inset, the corner and the focus
highlight so a row cannot drift from that.

## Working on a screen

- Adding a measurement means adding it here and in `Metrics`, not in the view.
- A new list row goes in `Views/Rows`, uses `rowSurface`, and is named `…Row`.
- Layout is judged on a screenshot against `design-reference.md`; this note is
  about how the code is arranged, not about what it should look like.
