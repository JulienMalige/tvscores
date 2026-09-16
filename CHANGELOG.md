# Changelog

What changed, written for whoever installs it rather than for whoever wrote it.
Headings carry the version the store will show and, while we are in beta, the
build inside it. The release job sends the top section to TestFlight as that
build's "What to Test" note, and the same words become the store's release
notes when a version ships.

## Unreleased

- The race result page now lights up the driver you are on, like every
  other list in the app.
- League tables are back, and real: the Premier League, La Liga, Serie A,
  Bundesliga, Ligue 1 and the Brasileirão each show their table on the
  league page, updated within ten minutes of a final whistle.
- Scores update every minute while a game is on, instead of every half hour.
- NFL and NBA now come from the same source as football, which is why they
  keep pace with it and show a full week ahead too.
- A match that has finished now shows its final score, instead of staying
  stuck on the last minute it was seen playing.
- The app re-downloads the scoreboard only when it has actually changed,
  which is gentler on a slow line.
- Seven more competitions: La Liga, Serie A, Bundesliga, Ligue 1, Copa
  Libertadores and the Brasileirão join the Premier League and the Champions
  League, each with its own badge and league page.
- Upcoming really does look seven days ahead for football now, instead of
  stopping at tomorrow.
- Tennis shows the events worth watching: the four majors, every 1000-level
  tournament — Monte Carlo, Madrid, Rome, Shanghai, Beijing and the rest —
  and the season finals. Challengers, ITF weeks and qualifying draws no
  longer fill the list. Between those events, tennis rests.
- Scores now refresh every 30 minutes rather than every couple of minutes.
  This is a "what is on today" app, not a live-timing one, and the slower
  pace leaves room to follow more competitions.
- League tables have room to breathe: the constructor and team badges no
  longer crowd the edges of their line, and every list in the app now spaces
  its rows the same way.

## 1.0 build 11 — 15 September 2026

- The icon sits on flat black now, the way the artwork was drawn, instead of
  the vignette I had put behind it. The board is a dark charcoal lit from
  above rather than a black hole, and the dots carry a touch more halo than
  the last build gave them.

## 1.0 build 9 — 15 September 2026

- New app icon: a dot-matrix scoreboard reading 2-1. On the Apple TV home
  screen the lit dots float above their own glow when you focus it.
- The source is checked once a day for dead code, duplication, naming drift,
  stale documentation, test coverage and stray credentials. Nothing visible in
  the app.

## 1.0 build 8 — 14 September 2026

- Constructor standings show each marque on a disc in its own team colour,
  cut out of the sponsor lockups the data source actually ships. Alpine and
  Williams keep their initials, because their lockups carry no marque at all,
  and so do the MotoGP teams.

## 1.0 build 7 — 14 September 2026

- The title and day tabs scroll away with the list instead of holding a quarter
  of the screen for ever.
- Rows on the race result page highlight when you move focus to them. They made
  the sound before but nothing lit up.

## 1.0 build 6 — 14 September 2026

- Premier League.
- A race row opens its full result: every driver with the grid slot they
  started from, points, gap, who retired, and the fastest lap.
- Upcoming stops seven days out rather than listing the rest of the season.
- A game decided in overtime reads "Final/OT" on one line.
- Crests and portraits come from one place now and are kept, so they stop
  flickering back to initials when you scroll.

## 1.0 build 5 — 14 September 2026

- More room between rows, and the header no longer has the list scrolling
  across it.
- Logos load before you reach them instead of after.
- The highlight starts on the day you are looking at.

## 1.0 build 4 — 14 September 2026

- Fixed the crash on launch. Build 3 died the moment any row carried a status
  detail, which is every real scoreboard.
- Tennis set scores read correctly. They showed a stray "undefined" before.
- A match nobody saw played no longer claims it finished nil-nil.

## 1.0 build 3 — 14 September 2026

First build. Scoreboard for yesterday, today and upcoming across Champions
League, NFL, NBA, Formula 1, MotoGP and tennis, with league pages and
standings, in English, French, Portuguese and Spanish.
