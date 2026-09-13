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
- Tennis: deferred. TheSportsDB at $9/mo is the fallback if it must ship.
- Football alternative: football-data.org if API-Football's terms worry a
  reviewer; it also covers the Champions League.
