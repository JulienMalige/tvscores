# Where each event airs: broadcast data sources, checked 2026-10-02

Goal: show the channel or streaming service carrying each event, US first,
country selectable later, several broadcasters per event allowed.
Hard rule 4 still applies: **names only, never a link**. Any provider field
that carries a URL (channel website, deep link, logo URL) is dropped by the
proxy. Showing a channel logo would be a trademark question like the crests
(rule 5), so the MVP shows text only.

## 1. Data sources with per-event broadcast data

| Source | What it gives | US quality (seen 2026-10-02) | Price / tier | Terms | Effort |
|---|---|---|---|---|---|
| **TheSportsDB v2** `GET /api/v2/json/filter/tv/day/{date}`, `/filter/tv/country/{country}`, `/lookup/event_tv/{idEvent}` (header `X-API-KEY`) | one row per event × channel: `idEvent`, `strChannel`, `idChannel`, `strCountry`, `strLogo`, time | mixed, see test below | v2 = premium; we already pay the Patreon key, so $0 extra | crowd-sourced, same terms as the rest of our TSDB use | small: one call per day, joins on `idEvent` we already store for NFL/NBA/soccer |
| TheSportsDB v1 `eventstv.php?d=&a=`, `lookuptv.php?id=` | same data, older shape | `eventstv.php?d=2026-10-04&a=United States` returned an empty body; v2 is the one to use | premium limit 1,500 rows / 100 | same | – |
| API-Sports (football, NFL, NBA) | **no broadcast field**: none in our cached fixture/game responses, nothing in the docs | – | – | – | – |
| livetennisapi.com | **no broadcast field** | – | – | – | – |
| Orange Cat Blacktop, Jolpica | no broadcast field | – | – | – | – |
| Sportmonks Football v3 `GET /v3/football/tv-stations/fixtures/{id}` (+ `include=countries`) | TV stations per fixture with their countries | not checked; their docs only cite European leagues, US accuracy must be tested on the free plan or trial | Starter €29 (5 leagues), Growth €99 (30 leagues); our 11 football comps need Growth, or Starter + €4/league | commercial use on paid plans | medium: a second football provider, fixture-id matching. Football only |
| SportsDataIO NFL/NBA `Schedules` | a `Channel` field per game (CBS, FOX, NBC, ESPN, Prime Video…) | clean for national US networks | Discovery Lab $99/mo is personal/hobby use with delayed data; production is sales-quoted (~$500+/mo) | commercial only on enterprise | medium; NFL/NBA only; schedule objects also carry odds we must not show |
| Sportradar NFL/NBA schedule `broadcasts[]` | `network`, `channel`, `locale` (National/Home/Away), `type` (TV/Internet) | broadcast-grade, includes local RSNs | enterprise, sales | yes | out of budget |
| Gracenote (TMS) `sports/{id}/events/airings?lineupId=` | real TV-guide airings for one cable lineup, ≤14 days ahead, 24 h windows | the reference for linear TV; streaming-only exclusives weaker | unlisted, ~$500–1,000+/mo | contract | high (lineup per region) |
| TVmaze | TV series guide, not live sports | – | – | – | not usable |
| League sites (nfl.com, nba.com, ESPN API, fotmob/livesoccertv TV guides) | the data exists | – | – | **undocumented or scraping: excluded** (rule 3) | – |

### TheSportsDB test, 3 calls on 2026-10-02 (key not printed)

- `filter/tv/day/2026-10-04`: 296 rows worldwide, 37 for `strCountry = "United States"`.
- `filter/tv/country/United States`: 158 upcoming US rows, 2026-10-02 → 2027-11-14.

What the US rows look like:

| Competition | Seen | Verdict |
|---|---|---|
| NFL week 5 | every game listed, but CBS games appear as **"Paramount+ US"** (no "CBS" row), FOX only on one game, SNF as **local affiliates** ("WBAL TV", "WVTM 13", "NBC (WCAU Philadelphia only)"), MNF correct (ESPN, ESPN2, ESPN Deportes), TNF correct (Prime Video), plus 13 "NFL Sunday Ticket" rows | usable after normalising names; misses some FOX games |
| UCL matchday (13–14 Oct) | 12 matches → "Paramount+ US" | right |
| Nations League / friendlies | FS1, FS2, Fox Soccer Plus; USA v Mexico → TNT, Telemundo, Universo | right |
| F1 (Malaysia, Oct 3–4) | "Apple TV+" for FP3, qualifying, race | right, per session |
| NBA (preseason) | only regional networks (Spectrum SportsNet, NBC Sports Philadelphia, YES) | regular season starts ~20 Oct: **re-check national games then** |
| EPL, La Liga, Ligue 1, Serie A, Bundesliga | none this weekend (international break), Bundesliga 9 Oct → Universo only | unproven: re-check on a club weekend |
| MotoGP, tennis, Brasileirão, Libertadores | no US rows at all | not covered |

Conclusion: TheSportsDB is good enough for the per-game sports (NFL, soccer
internationals, UCL) once names are normalised, and costs nothing more. It is
not complete enough to be the only source.

## 2. US rights, 2026-27 season

| Competition | US broadcaster(s) | Varies per event? | Source |
|---|---|---|---|
| NFL | CBS (+Paramount+), FOX, NBC (+Peacock), ESPN/ABC, Prime Video (TNF), Netflix (3+ games from 2026), NFL Network, Peacock exclusives; Sunday afternoon CBS/FOX games are regional | **per game** | [Yahoo](https://sports.yahoo.com/nfl/article/how-to-watch-every-football-game-of-the-2026-27-nfl-season-015500642.html), [CBS Sports schedule](https://www.cbssports.com/nfl/news/2026-nfl-schedule-dates-times-tv-streaming-matchups-for-all-272-games/) |
| NBA | national: ESPN/ABC, NBC/Peacock/NBCSN, Prime Video (~240 games); all others local RSN / team stream / League Pass | **per game** (day-of-week pattern is a hint, not a rule) | [NBA.com how to watch 2026-27](https://www.nba.com/news/how-to-watch-games-2026-27-season), [NBA on X](https://x.com/NBA/status/2087978707390750858) |
| Premier League | NBC, USA Network, Peacock (~175 Peacock-exclusive) | per game, within one family | [NBC Sports](https://www.nbcsports.com/soccer/news/premier-league-schedule-for-2026-27-season-released) |
| La Liga | ESPN+ (all 380), ESPN/ESPN2/ABC (~20), ESPN Deportes | static "ESPN+" is right for every match | [ESPN Press Room](https://espnpressroom.com/press-release/espn-presents-the-2026-27-laliga-season-beginning-aug-15/) |
| Ligue 1 | beIN SPORTS (exclusive, 2024-25 → 2028-29) | static | [Sportcal](https://www.sportcal.com/media/bein-rides-to-ligue-1-rescue-again-with-late-deal-across-27-markets/) |
| Serie A | Paramount+ (CBS, one-year extension to 2026-27; re-tender after) | static | [Yahoo](https://sports.yahoo.com/articles/cbs-serie-extend-media-rights-193018684.html) |
| Bundesliga | **changed**: USA Network (≥30) + Fandango (rest, free) in English; Telemundo/Universo/Peacock in Spanish. No longer ESPN+ | static "Fandango · USA Network" | [Awful Announcing](https://awfulannouncing.com/versant/usa-network-fandango-bundesliga-rights-us.html), [USA Network](https://www.usanetwork.com/usa-insider/how-to-watch-bundesliga-on-usa-network-streaming-on-fandango) |
| Brasileirão | Globo Internacional / Premiere (PPV); Fanatiz (Spanish); Creator Sports Network one match a week | static, low confidence | [Awful Announcing](https://awfulannouncing.com/soccer/creator-sports-network-broadcast-rights-brazil-serie-a-north-america.html) |
| Champions League | Paramount+ (all), some CBS / CBS Sports Network; deal runs to 2029-30 (a "moves to Disney+" story online is not confirmed) | static "Paramount+" | [Paramount+](https://www.paramountplus.com/sneak-peak/uefa-champions-league-schedule/), [CBS Sports](https://www.cbssports.com/soccer/news/uefa-and-cbs-sportsparamount-reach-six-year-deal-to-air-champions-league-europa-and-conference-league/) |
| Europa League | Paramount+; Spanish TelevisaUnivision/ViX, DAZN | static | [Live Soccer TV](https://www.livesoccertv.com/competitions/international/uefa-europa-league/watch/usa/) |
| Libertadores | beIN SPORTS (to 2026), Fanatiz; TelevisaUnivision from 2027 | static, change Jan 2027 | [Sportcal](https://www.sportcal.com/media/bein-retains-copa-libertadores-rights-in-us-and-canada-until-2026/) |
| Nations League | FOX family (FS1, FS2, Fox Soccer Plus, FOX); Univision/TUDN/ViX Spanish | per game within FOX | [FOX Sports](https://www.foxsports.com/stories/presspass/europes-top-national-teams-biggest-stars-compete-fox-sports-presents-uefa-nations-league-2026-27) |
| International friendlies | depends on the home federation (USMNT: TNT/HBO Max, Telemundo) | **per game** | TheSportsDB rows above |
| F1 | Apple TV (every session, F1 TV Premium included) from 2026 | static | [Apple Newsroom](https://www.apple.com/newsroom/2026/04/formula-1-returns-to-the-us-this-weekend-streaming-live-on-apple-tv/) |
| MotoGP | FS1 (most races), FS2 (practice, sprints), FOX (US GP only) | static "FOX Sports" (FS1/FS2) | [Awful Announcing](https://awfulannouncing.com/fox/motogp-media-rights-deal-2026.html), [Yahoo](https://sports.yahoo.com/articles/watch-motogp-usa-live-streams-100001152.html) |
| ATP/WTA 500 and 1000 | Tennis Channel | static per tournament | [Tennis Now](https://tennisnow.com/atp-and-tennis-channel-strike-multi-year-rights-deal-for-masters-1000-events/) |
| Australian Open, Wimbledon, US Open | ESPN, ESPN2, ESPN app (US Open on ABC too; ESPN to 2037) | static per tournament | [ESPN AO](https://www.espn.com/tennis/story/_/id/47538835/how-watch-2026-australian-open-espn-schedule), [Deadline](https://deadline.com/2024/08/espn-extends-us-open-tennis-rights-through-2037-1236071802) |
| Roland-Garros | TNT, truTV, HBO Max (WBD, 10 years from 2025) | static | [Tennis.com](https://www.tennis.com/news/articles/where-to-watch-roland-garros-2026-tennis-channel-tnt-hbo-max-trutv) |

Single-broadcaster (a static table is exact): La Liga, Ligue 1, Serie A,
Bundesliga, Brasileirão, UCL, UEL, Libertadores, F1, MotoGP, tennis (per
tournament). One family, per-game channel (static gives the family name, data
gives the exact channel): EPL, Nations League. Truly per game (needs data):
NFL, NBA, friendlies.

## 3. Recommendation for the MVP (US only)

**A hand-kept rights table plus TheSportsDB's daily TV feed on top. No new
provider, $0 extra.**

1. A broadcasts file in the proxy (not made yet), kept like `tennis-calendar.json`: per country, per
   competition, an ordered list of names, with `from`/`until` dates so a
   rights change (Libertadores 2027, Serie A 2027-28) is one line. Tennis
   keys by tournament.
2. Once a day, per date in the window (yesterday, today, tomorrow): one
   `filter/tv/day/{date}` call, cached with the schedule. Keep rows for the
   wanted country, join on `idEvent` (NFL, NBA, TSDB soccer). API-Sports UCL
   fixtures join on teams + kickoff, or keep the static "Paramount+".
3. Normalise with an alias map: `Paramount+ US` → CBS · Paramount+ for NFL,
   `FOX US` → FOX, `Fox Sports 1 HD US` → FS1, local affiliates → their
   network, drop `NFL Sunday Ticket`, drop `strLogo` and any URL.
4. Precedence per event: TSDB rows when present, else the static table, else
   nothing (no row is better than a guess). Mark the source, so `tsdb` vs
   `table` can be audited.
5. Shape: `event.broadcasts = ["CBS", "Paramount+"]`, ordered national TV
   first, then streaming. The app shows the first two names and "+N". The
   proxy takes `?country=US`, so another country later is a new key in the
   table plus the same TSDB rows filtered on another `strCountry`. Nothing
   changes in the app.

Accuracy: exact for the static competitions (most of the list). For NFL,
good once normalised (some FOX games will fall back to nothing). For NBA,
unknown until the regular season starts (~20 Oct): re-check then. If NBA or
NFL stay weak, Sportmonks (football, €29–99) or SportsDataIO (NFL/NBA,
sales-quoted) are the paid upgrades. Both still need the alias map, and
neither replaces the static table for F1, MotoGP or tennis.

## Brazil and France in the same feed (checked 2026-10-02, 2 calls)

`filter/tv/country/{Brazil|France}`, every upcoming row:

| Country | Rows | What is there | Missing |
|---|---|---|---|
| Brazil | 23 | Brasileirão on SporTV (São Paulo v Santos) and ESPN Brasil (Série B); internationals on ESPN Brasil, SporTV, Fox Sports BR; Champions League on HBO Max BR (every match of matchday 3); NFL on DAZN Brasil (one game) | Premiere / Globo for most Brasileirão games, Libertadores, NBA, F1, tennis |
| France | 79 | Ligue 1 on Ligue 1+ and beIN; La Liga, Serie A on DAZN; Bundesliga on beIN; NFL and NBA on beIN (most games); France's internationals on TF1 | Champions League (Canal+), Premier League (Canal+), F1 (Canal+), tennis, Brasileirão |

France is the best covered of the three countries checked; Brazil is thin
outside the Champions League. The same rights-table fallback would fill
the single-broadcaster competitions per country.
