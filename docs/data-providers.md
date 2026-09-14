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
