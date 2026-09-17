# Sports data providers, compared 2026-09-13

Target leagues (from Julien's Apple Sports): Champions League, Formula 1, NBA, NFL, men's tennis.
Prices are as published on the dates checked; re-check before subscribing.

| Provider | Covers (of our five) | Free tier | First paid tier | Commercial use | Notes |
|---|---|---|---|---|---|
| API-Sports (api-football.com, api-nba, api-nfl, api-formula-1) | CL, NBA, NFL, F1 | 100 req/day **per sport API**, 10/min, all endpoints, live scores | $19/mo per sport (7,500/day); $29 = 75k; $39 = 150k | Allowed; ToS says rights on competition data are the user's responsibility | One account and key, subscription per sport. No tennis. |
| football-data.org | CL (+ 11 other football comps) | 10 calls/min, delayed scores and schedules, "free forever" | paid tiers up to €199/mo; +€29 deep-data add-on | Only on paid plans | Football only. Cleanest terms for a reviewer. |
| TheSportsDB | all five incl. tennis | demo key, ~30/min, 10 results per call, no live | $9/mo Patreon: production key, V2 API, 2-min livescores | Requires the $9 plan | Crowd-sourced data, quality varies; cheapest single key for everything. |
| balldontlie | NBA, NFL (separate subs) | 5 req/min, scores and standings, **no live** | $9.99/mo per sport (60/min, live); $159.99 all sports | Yes on paid | US leagues focus. |
| Jolpica F1 (Ergast successor) | F1 results, standings, schedule | free, no key, volunteer-run | donation | Terms of use on GitHub, no commercial restriction stated | Results after the race, not live timing. Fine for "Race · Final". |
| OpenF1 | F1 live timing | free, 3 req/s | contact for licence | **Non-commercial only** | Not usable in a store app without a licence. |
| SportMonks | CL (football) | 2 leagues, 14-day trial of paid | €29/mo | Yes | Football only, no advantage over the two above for us. |
| SportsDataIO / Sportradar | all five | trial with scrambled data | ~$99–149/mo per sport, sales for production | Yes | Enterprise tier, out of budget. |

## "One key for everything" options (checked 2026-09-13)

| Provider | Everything? | Live speed | Price |
|---|---|---|---|
| TheSportsDB | all five sports, but livescores only for soccer, NFL, NBA, MLB, NHL (no F1 or tennis live) | 2-min refresh | $9/mo (100 req/min) or $20/mo (120 req/min) |
| balldontlie All-Access | 20+ leagues incl. Champions League, Ligue 1, F1, ATP/WTA | real-time via webhooks (push, no polling) | $299.99/mo; single sport $9.99 (60/min) or $39.99 (600/min) |
| Goalserve Full Package | 20+ sports incl. tennis and F1 | live feeds; websocket add-on $200/mo | $800/mo, ~$425/mo on a 12-month deal |
| Sportradar / SportsDataIO | everything, broadcast grade | push feeds | sales-quoted, well above $100/mo per sport |

Takeaway: "everything and fast" starts at about $300/mo (balldontlie
All-Access). Cheap "everything" is TheSportsDB at 2-minute latency with no
live F1 or tennis. API-Sports per sport stays the best price/speed mix for
our leagues: its live endpoints refresh about every 15 s and the proxy can
poll every 30–60 s on a $19 plan.

## MotoGP (asked 2026-09-13)

API-Sports has no MotoGP. Options:

| Source | Free | Live | Commercial | Verdict |
|---|---|---|---|---|
| Orange Cat Blacktop MotoGP API (ocblacktop.com) | 7,500 req/month, prototyping only | no, post-session results | paid plan only; no rights to the championship data itself | fine for results and calendar, paid plan before release |
| TheSportsDB | demo key | no | $9 plan | motorsport events with results, same caveats as elsewhere |
| Sportradar MotoGP | trial key | schedules + post-race results | enterprise pricing | out of budget |
| motogp.com hidden API (api.motogp.pulselive.com) | open, no key | session results | none, undocumented | excluded, same reasoning as Sofascore scrapers |

Nothing affordable gives live MotoGP timing. Treat MotoGP like F1: calendar,
session results and standings, with the "Race · Final" row shape.

**Decision 2026-09-14: Orange Cat Blacktop for both F1 and MotoGP** (Julien
registered a free key; stored at `~/.config/tvscores/ocblacktop.key`).
Compared on the 2026 Spanish GP: identical podium and times to Jolpica, plus
driver codes, team colours, per-session schedule (practice, qualifying,
sprint, race) and cleaner names ("Bahrain Grand Prix" where Jolpica had a
placeholder). Endpoints: `GET /v1/{formula1|moto-gp}/events?limit=100`
(`season` param is ignored, filter by `dateStart` year) and
`GET /v1/{sport}/events/{eventId}/sessions/{sessionId}/results`. No driver
nationality, so F1 flags come from one Jolpica driver-list call per day; MotoGP
has no flags. Jolpica stays as the keyless fallback. Free tier is
non-commercial: a paid OCB plan is due before the store release.

**Tennis, decided 2026-09-14:** livetennisapi.com free key (Julien's, stored at
`~/.config/tvscores/livetennisapi.key`). Base `https://api.livetennisapi.com/api/public/v1`,
`Authorization: Bearer`, `GET /matches?status=live|upcoming&limit=200`. ATP and
WTA singles only; a match gone from the live feed is marked final (no
`completed` listing on the free tier). Quota 100/day, 30/min, tracked like
API-Sports.

## Tennis (checked 2026-09-14)

Correction 2026-09-14 (second look): there ARE cheap sources for live tennis.

| Source | Free | Live | Schedule / results | Licensing statement |
|---|---|---|---|---|
| livetennisapi.com | 100 req/day, 30/min, no card | yes, `GET /matches?status=live` + `/matches/{id}/score` | history and other statuses on Basic $9.99/mo (1k/day) | "arbitrated multi-source feed", nothing explicit |
| live-tennis-api.com | 100 credits at signup | yes, set-by-set | yes | none stated; $0.001 per call after the free credits |
| balldontlie ATP / WTA | players, tournaments, rankings only | ALL-STAR $9.99/mo per tour, 60/min | yes | clearest of the three |
| api-tennis.com | none, 14-day trial | yes | yes | from $40/mo |
| TheSportsDB | demo key | no | thin: no upcoming ATP matches, last result 23 Aug | $9–20/mo |

Cheapest path to a live tennis row: livetennisapi.com free tier polled only
while matches are live (100/day fits ~3 h of 2-min polling). Upcoming matches
need a paid tier or balldontlie. Licensing of the two cheap feeds is unstated,
so treat them like API-Sports: usable, rights on the data are ours to carry.

## Rugby (checked 2026-09-14)

API-Sports **Rugby** is on Julien's free plan (`v1.rugby.api-sports.io/games?date=`),
same ±1 day window and 100 calls/day. Leagues: Top 14, Premiership, URC,
Six Nations, Rugby Championship, World Cup. Adapter = copy of the NFL one.

## Competition logos (2026-09-14)

Julien asked for official league marks in the section headers. Sources:
API-Sports league images exist for UCL/NBA but its NFL one is a placeholder
and its UCL is navy (invisible on the TV background). **TheSportsDB league
badges** (`lookupleague.php` → `strBadge`) cover all seven with light-on-dark
variants. `proxy/scripts/build-badges.py` downloads them once, trims the
transparent padding and writes `proxy/assets/leagues/<id>.png`, which the
proxy serves at `/v1/assets/leagues/<id>.png` (so nothing is hotlinked and
the app gets a stable URL). Trademark caveat as for crests: the marks belong
to the leagues.

## Player and driver photos (checked 2026-09-14)

| Source | Coverage | Shape | Terms |
|---|---|---|---|
| TheSportsDB `searchplayers.php?p=<name>` | tennis, F1, MotoGP, and team sports; hits for Sinner, Sabalenka, Cobolli, Antonelli, Márquez | `strCutout` = transparent PNG, head-and-shoulders, ideal for the round avatar; `strThumb` = action photo | crowd-uploaded photographs, rights unstated; $9–20 tier for production; lookup by name, so cache the URL per player |
| API-Sports F1 `/drivers?search=` (free plan allows it) | F1 drivers only | 150×150 PNG headshot | same responsibility clause as the rest of API-Sports |
| Live Tennis API, Orange Cat | no images | – | – |
| Wikimedia Commons via the Wikipedia API (`pageimages`) | most well-known athletes | photo with a CC licence | attribution required in the app |

Recommendation if Julien wants faces: TheSportsDB cutouts, resolved once per
player by the proxy and cached with the standings/podium rows (name → URL),
monogram fallback. Photos carry photographer copyright and personality
rights, a step riskier than logos; Apple licenses theirs.

## RapidAPI

RapidAPI is a marketplace, not a data source. Two kinds of listings:

- **Official mirrors** (API-Sports lists API-Football, API-Basketball,
  API-American-Football there). Same data and same free tier, but paid plans
  bill overage instead of hard-capping, and every call goes through RapidAPI's
  proxy, which adds a hop. Subscribing direct at api-sports.io is cheaper to
  reason about and has no overage.
- **Unofficial wrappers** such as "AllSportsApi2" (all sports, tennis, F1,
  cheap): the listing itself says the data comes from Sofascore's public
  endpoints, and Sofascore states it cannot offer an API because of its own
  provider agreements. That is scraped data with no licence, exactly what App
  Store guideline 5.2.2 rejects, and it can break the day Sofascore changes
  a URL. Do not use these in TV Scores.

Rule: use RapidAPI only if a provider exists nowhere else, and only official
listings.

## Licensing reality

None of the affordable providers grants rights to league marks or crests, and
API-Sports states in its terms that rights to competition data are the user's
responsibility. Scores and fixtures are facts; the App Store reviewer wants to
see that the app pulls from a service whose terms allow it, which a paid plan
(or football-data.org's free tier for non-commercial use) satisfies. Keep the
subscription receipt and terms page in this folder before submission.

## Decision (proposed, awaiting Julien)

- Backbone: **API-Sports**, one account. Start every sport on its free tier
  with the proxy polling only inside game windows (every 2–3 min while a game
  is live, hourly otherwise), which fits 100 calls/day per sport. Upgrade a
  sport to the $19 plan only when live refresh needs to be faster.
- F1 results: Jolpica as the free source; API-Formula-1 if we want live.
- Post-MVP (agreed direction 2026-09-13): add **TheSportsDB Small Business ($20/mo,
  commercial tier)** as the long-tail source for tennis, MotoGP and any league
  API-Sports lacks; accept its 2-min refresh and no live motorsport/tennis.
  It stays a secondary adapter, never the live source for the core leagues.
- Football alternative: football-data.org if API-Football's terms worry a
  reviewer; it also covers the Champions League.

## Changes on 2026-09-14

**Premier League added** (API-Sports league 39). It costs nothing extra: the
football provider already fetches every fixture for a date in one call and
filters by league id, so a second competition is a config line and a badge.
That is also why adding more football leagues later is close to free, while
adding a new *sport* is not.

**Upcoming is a seven-day window.** It used to show everything after today,
which turned the tab into a season fixture list. The horizon is counted in the
viewer's own local days (`schedule.upcomingDays`). Consequence worth knowing:
Formula 1 and MotoGP race roughly every two weeks, so Upcoming often holds one
race or none, and the older "next ten rounds per series" cap rarely bites.

**Images are mirrored locally** (`proxy/src/images.js`, served at `/v1/img/<sha1>`).
Crests and portraits live on two other CDNs and almost never change, so the
television now fetches them from this proxy once, with a month-long cache
header, instead of opening connections to three hosts. A URL is registered the
moment it appears in a response and the bytes are fetched in the background; if
the mirror is cold and the fetch fails, the request is redirected to the
original, so a picture is never lost. Portraits are taken in TheSportsDB's
`/preview` size, 200 px and about a fifth of the bytes, which is larger than
any avatar the app draws.

**Races carry their whole classification**, not just the podium, with grid
slot, points, laps and the fastest lap, plus the drivers who did not finish
(no position, outcome shown as DNF/DNS/DSQ). The scoreboard row still shows
three; the race page shows the rest. Portrait lookups stay podium-first so the
scoreboard fills before the detail pages do.

## Tennis is filtered by category (2026-09-15)

Julien: "on tennis, can we filter only slam and master 1000?" The feed can,
and it says so itself: `/tournaments` carries a `category` from the enum
`grand_slam, masters_1000, tour_finals, atp_500, atp_250, wta_1000, wta_500,
wta_250, wta_125, challenger, itf, juniors, null`, and `tournament_id` on a
match joins to it. `config.tennis.categories` keeps the first, the second, the
third and `wta_1000`; qualifying draws are dropped unless
`includeQualifying` is set.

Two things the provider's own documentation makes clear and the code respects:
`category` is filled "only where our catalogues agree unambiguously on an
exact-name join — null otherwise, never derived from the name", so an
unlabelled tournament is dropped rather than guessed at. `ATP Acapulco`, a
500, is one of the unlabelled ones, which is the shape of what we lose. The
catalogue has no category filter, so both tours are paged once and cached for
a month in the sport's meta: a handful of calls against 100 a day.

Their catalogue leaves 513 of 847 ATP/WTA tournaments unlabelled and gets two
wrong, so `config.tennis.alsoBig` pins the missing 1000s by `tournament_id`:
Monte Carlo, Madrid, Rome, Shanghai and Montreal on the ATP side; Madrid,
Rome, Beijing, Doha and Montreal on the WTA side. Madrid and Rome come back as
`itf` because each city also hosts an ITF week of the same name — pinning by id
rather than name is the point. Every tournament has two ids, one per event
type, and both are listed; all twenty were checked against the live catalogue
on 2026-09-15. ATP Doha and ATP Beijing are 500s and deliberately left out.

Consequence to expect: outside the majors and the 1000s, tennis disappears
from the scoreboard for weeks at a time. That is the filter working.

The free tier's 100 calls a day is now the binding constraint on tennis, not
the data. Their BASIC tier is $9.99/mo for 1,000/day.

## Football moved to TheSportsDB (2026-09-15)

Julien subscribed to the $9 Single Developer tier, and football moved onto it
whole: `proxy/src/providers/sportsdb.js` fetches one `eventsday` call per date
for `schedule.footballWindow` (yesterday plus seven days) and filters to the
eight competitions in `config.leagues.football`, with the V2 `livescore/soccer`
endpoint for matches in play. Eight leagues, nine calls a cycle.

Why the swap: API-Sports' free plan answers only yesterday-to-tomorrow, so the
seven-day Upcoming was impossible at any league count, and unlocking it cost
$19 per sport per month. TheSportsDB's paid key returns up to 1,500 events for
a date, which makes a competition a config line and a badge rather than a
subscription. The API-Sports football adapter was deleted rather than left
dormant; `git revert` brings it back if the test month disappoints. NFL and NBA
stay on API-Sports, whose free tier covers their whole schedules.

League ids came from the live catalogue, not from the website: 4328 Premier
League, 4335 La Liga, 4332 Serie A, 4331 Bundesliga, 4334 Ligue 1, 4480
Champions League, 4501 Copa Libertadores, 4351 Brasileirão. `strTimestamp` is
UTC without a zone marker and has to be tagged before parsing, or every kickoff
shifts by the server's own offset.

The store's `SCHEMA_VERSION` went to 5 for this, which empties the events and
the daily stamps on first load. Events keyed by the old provider's ids would
otherwise sit beside the new ones and show the same match twice.

## Polling manners (2026-09-15)

Checked our scheduler against the published advice for livescore backends.
The shape matches: fetch upstream once centrally rather than per client,
separate the static images from the moving scores, and poll hard only while
a game is actually on. The one deliberate difference is the interval — the
advice says 30 seconds, we say 30 minutes, because this app answers "what is
on today", not "what is the score this second".

Two gaps that advice named and we had, now closed:

- **Conditional GET.** The scoreboard is ~48 KB and a television asks every
  60 seconds while a game is on. Responses now carry an `ETag` of the body's
  own hash and answer `If-None-Match` with a bodyless 304. The app needed no
  change: URLSession revalidates on its own once `max-age` lapses and hands
  the cached body back, so a 304 never reaches our code.
- **Backoff.** A failing upstream was retried at full rate for ever. Each
  consecutive failure now doubles the wait, capped at an hour, and one good
  answer clears it.

Not done, deliberately: conditional GET *upstream*. TheSportsDB does send
`last-modified`, but a 304 still counts as a request against the quota, and
requests are what we are capped on — it would save bytes we are not short of.

## Two matches that never got a score (2026-09-16)

Botafogo v Grêmio and LDU Quito v Palmeiras were played and finished on the
evening of the 16th. Six hours later both were still `NS` with no score, and
both **TheSportsDB and API-Sports said exactly the same thing** — checked
every ten minutes for an hour and a half, and again in each league's own
results listing. Flashscore had 3-2 and 3-2 on penalties within minutes.

What it is not: a broken subscription, or our pipeline. The Corinthians match
the same night updated every minute and finished correctly, and every other
Brasileirão and Libertadores fixture around those two carries its score. Two
fixtures were simply stuck at both providers at once, which suggests they
share an upstream for CONMEBOL and the Brasileirão.

What the app does about it: a fixture still "not started" three hours after
kickoff is no longer shown with its kickoff time, which reads as a game yet
to come. It says "No update". The scheduler also refetches the date of any
kickoff more than fifteen minutes past with nothing to show, so a score that
does arrive late is picked up rather than waiting for the daily pass.

Worth re-checking whether those two ever filled in. If late results are
common the "No update" state will be seen often, and a second source for
South America becomes worth its price; if this was a one-off, it is not.
