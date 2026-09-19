# Changelog

What changed, written for whoever installs it rather than for whoever wrote it.
Headings carry the version the store will show and, while we are in beta, the
build inside it. The release job sends the top section to TestFlight as that
build's "What to Test" note, and the same words become the store's release
notes when a version ships.

## Unreleased

- The top of the menu is laid out as in the Apple TV app: a round picture,
  the name, the time in the lighter style. The name is the television's own
  ("Julien's Apple TV" gives "Julien") and the picture a placeholder: the
  Apple TV profile that build 19 promised is Apple's own, and no app can
  read it. The page keeps the date. Section headings sit on the icon column.

- The day switch and the table switches are the system control of build
  18 again — small and steady — with its dark track gone: bare words, the
  chosen one light, the one the remote is on white, as in the Apple TV app.

- A race weekend is on every day it has a session: Saturday shows the
  qualifying and the sprint with their times, Sunday the race — instead of
  "No games on this day" until race day.

## 1.0 build 19 — 19 September 2026
- Crests and portraits no longer go missing for a minute after the menu
  redraws: a picture whose loading was interrupted is asked for again, not
  written off.

- Flags are flat and fill their circle — on a race, and on a driver's or
  player's portrait — the way Apple Sports draws them, instead of the emoji.

- The Apple TV profile in use and the time sit at the top of the menu, as
  they do in the Apple TV app.

- The menu is grouped — Football, Motorsport, US sports, Tennis — with a
  heading over each group, the way the Apple TV app lists its channels, and
  its icons are smaller, about half the row, so the names have room.

- The day switch and the table switches change only when you click, not as
  the remote passes over them, and look like the Apple TV app's season
  switch: bare words, a light pill on the one being shown, white on the one
  the remote is on.

## 1.0 build 18 — 19 September 2026
- League tables read as columns — played, won, drawn, lost, goal difference,
  points — with a line under the Champions League places and a dashed one
  above relegation, and what the places mean written under the table. The
  cups' league phase the same, cut at eight and twenty-four.

- NFL and NBA conferences are read division by division — East, North,
  South, West — each ranked on its own, with wins, losses, ties and the
  percentage.

- A race carries its country's flag as a round mark, in the row and on its
  page, and an upcoming race's page lists the weekend: qualifying, the
  sprint, the race, each with its day and time.

- A competition between seasons says so, and when it is back: "NBA returns
  in October for the 2026–2027 season."

- Opening a competition from the front page now takes you to its place in
  the menu — the same page the menu opens, on the day you were reading —
  instead of a copy on top of Home with the menu still saying Home.

- The day switch no longer sits on a dark track; just the three words, with
  the chosen day in grey and the one the remote is on in white. The switch
  between a competition's tables — Drivers and Constructors, Riders and
  Teams, AFC and NFC — is now the same control.

- Competition icons that had not arrived when the menu was first drawn — a
  ball where Brasileirão or La Liga should be — now fill in as soon as they
  do, instead of staying that way until the next launch. The same for club
  crests in the tables and rows: a picture the television's wifi dropped on
  waking is asked for again while the row is on screen.

- League tables for the NFL (by conference, with each team's division), the
  Champions League and the Europa League (the league phase, all 36 teams).
  The NBA's East and West follow once its season starts. The feed publishes
  no table for these, so the proxy builds them from the results.

## 1.0 build 17 — 18 September 2026
- Yesterday, Today and Upcoming are now the system's own day switch — the
  joined segments tvOS uses — under the title on the left. A day is chosen as
  the remote reaches it, no click; the one you are on is white, the one
  being shown stays grey once you move down into the list.

- A competition's heading on the front page can be reached with the remote
  from the row beneath it; it was being stepped over.

## 1.0 build 16 — 17 September 2026
- The day being shown is filled in, so it no longer looks as though you are
  on Yesterday while today's matches are on screen. The bright pill is where
  the remote is pointing; the filled one is the day you are reading.

- The Europa League, with its own page and its own place in the menu.

- Picking a day keeps the highlight on the day you picked, instead of
  dropping it back onto Yesterday.

## 1.0 build 15 — 17 September 2026
- The menu no longer rebuilds itself under you while you are reading it,
  which was making it hard to open and keep open.

- The competition marks in the sidebar stand on their own — no disc behind
  them, and Serie A without the white box its badge is printed on.

- The time sits beside the date at the top of every page, and keeps itself
  up to date.

## 1.0 build 14 — 17 September 2026

- A crest that fails to arrive is asked for again rather than replaced by
  initials for the rest of the session. One dropped request on a busy wifi
  used to cost that badge until the app was reopened.

## 1.0 build 13 — 17 September 2026

- Scores arrive sooner: the proxy asks its source twice a minute now, and the
  app asks the proxy twice a minute while a game is on.
- A game that kicked off but whose scoreline never arrives is no longer shown
  as though it were still to come. It says "No update" instead — some matches
  are simply never updated by the data provider, and the kickoff time was the
  one thing we knew to be wrong.

- The sidebar stays open when you open it. It was being shut by the page
  behind it taking the focus back.
- Constructor and team standings name the drivers under each marque, the way
  the championship is actually read: "K. Antonelli, G. Russell" under
  Mercedes, "M. Marquez, F. Bagnaia" under Ducati.
- Every competition in the sidebar wears the same round badge, carrying its
  mark alone — the Ligue 1 numeral, the Serie A tile, the Champions League
  starball — rather than a lockup whose printed name is a smudge at that
  size. The Bundesliga wordmark no longer towers over the Premier League
  crest, and the row names fit on one line.
- Pictures no longer flash a monogram on their way in. Nothing is drawn
  until the app has its competition marks, behind a brief loader.

## 1.0 build 12 — 16 September 2026

- A sidebar lists every competition, so each one has a page of its own that
  you can always reach — Formula 1 and MotoGP included, whose championship
  tables used to disappear from the app between races. Competitions with
  nothing on this week say so.
- The race result page now lights up the driver you are on, like every
  other list in the app.
- Crests, badges and riders' faces stay on screen once they have loaded.
  They no longer blink back to initials when a list refreshes, when you
  scroll back up, or when you switch between the drivers and teams tabs.
- MotoGP team standings show each team's marque — Aprilia, Ducati, KTM,
  Yamaha, Honda and the rest — the way the Formula 1 constructors do,
  instead of three initials on a coloured disc.
- League tables are back, and real: the Premier League, La Liga, Serie A,
  Bundesliga, Ligue 1 and the Brasileirão each show their table on the
  league page, updated within ten minutes of a final whistle.
- Scores update about once a minute while a game is on, and the app sits
  quiet when nothing is being played.
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
