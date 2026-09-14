# TV Scores proxy

The middleman between the Apple TV app and the data providers. It polls on a
schedule, caches on disk, and serves one JSON shape. The app never talks to a
provider and never holds a key.

Node 22, no dependencies. `npm test` runs the unit tests (`node --test`).

## Endpoints

| Path | Purpose |
|---|---|
| `GET /v1/scoreboard?tz=Europe/Paris` | `days.yesterday / today / upcoming`, each a list of `{sport, league, events[]}` groups, bucketed in the viewer's time zone. Live games always sit in `today`. `stale` flags per sport. |
| `GET /v1/fixtures?date=YYYY-MM-DD&tz=` | flat list of events on one local date |
| `GET /v1/standings` | every table we hold, keyed `sport:league` |
| `GET /v1/standings/{sport}/{league}` | one league's tables (drivers, constructors, rankings) |
| `GET /v1/img/{sha1}` | a mirrored crest or portrait; redirects to the original if the mirror is cold |
| `GET /v1/assets/leagues/{id}.png` | competition badge we ship |
| `GET /v1/assets/teams/{sport}/{slug}.png` | constructor or team badge we ship |
| `GET /v1/health` | uptime, cached event count, image-mirror totals, and per-sport quota: `used / limit / remaining`, last success, last error |

Responses carry `Cache-Control: public, max-age=30`. The server also accepts the
`/tvscores` prefix so it can sit behind `tailscale funnel --set-path /tvscores`.

Event shape: see `src/model.js`. Team events have `home/away {name, nick, short}`,
`score {home, away}`, `status {state, clock, detail}` with `state` one of
`scheduled | live | final | other`. Races (`kind: "race"`) carry the whole
classification in `results`: position (absent for a retirement), driver, team,
`grid`, `points`, `laps`, `fastestLap` on the one who set it, and `gap`, which
reads `DNF`, `DNS` or `DSQ` for a car that did not make the flag.

`days.upcoming` stops `schedule.upcomingDays` local days out, seven by default.

## Two kinds of files, and which is which

`proxy/assets/` holds artwork **we ship**: competition badges and constructor
badges, built by `scripts/build-badges.py` and `scripts/build-team-badges.py`
and committed. They change about once a season, the app cannot work without
them, and both scripts use an explicit name mapping because searching
"Mercedes" by name returns an Argentinian football club.

`~/.local/state/tvscores/` holds **cache**, never committed and safe to delete:
`store.json` for events, standings and resolved portrait URLs, and `images/`
for the mirror below. Losing it costs one refetch, nothing else.

## The image mirror

Crests and portraits live on other people's CDNs and almost never change, so
the proxy keeps its own copy (`src/images.js`) and the television fetches every
picture from one host with a month-long cache header. A URL is registered the
instant it appears in a response and the bytes are pulled in the background,
six at a time; a request for something not yet mirrored is fetched on the spot,
and if that fails it is redirected to the original rather than left blank. A
URL that fails five times is dropped from the queue. Portraits are taken in
TheSportsDB's `/preview` size, a fifth of the bytes and still larger than any
avatar the app draws. Anything unasked-for for 60 days is pruned.

## Providers and quota

| Sport | Source | Calls per day |
|---|---|---|
| football (Premier League, Champions League) | API-Sports v3, free plan | 3 daily (yesterday, today, tomorrow) + live polling, for **all** leagues at once |
| nfl | API-Sports american-football, free | same |
| nba | API-Sports v2 nba, free | same |
| f1, motogp | Orange Cat Blacktop (free key, 7,500/month), Jolpica fallback for F1 without a key | 1 calendar call + 1 per newly finished race, every 30 min; F1 flags from 1 Jolpica call/day |
| tennis (ATP, WTA singles) | livetennisapi.com free key, 100/day | 1 upcoming call daily + live polling inside match windows |

API-Sports free plan facts learned 2026-09-13: 100 calls/day per sport, only the
dates **yesterday..tomorrow**, no `season` or `next` parameters for the current
season. Two consequences worth remembering:

- Adding another football league is free, because fixtures are fetched per date
  and filtered by league id locally. Adding another *sport* is not.
- "Upcoming" holds tomorrow only for anything from API-Sports. The motorsport
  calendar is complete because Orange Cat Blacktop gives the whole season. A
  real seven-day Upcoming for football needs a source with date ranges:
  football-data.org's free tier, or a paid API-Sports or TheSportsDB plan.

Live polling (`?live=all`, 1 call) runs only while a tracked game is inside its
window (10 min before kickoff to 4 h after). The interval is at least 150 s and
is stretched so the remaining calls of the day are never exhausted, keeping a
reserve of 8. `src/quota.js` holds that logic and its tests.

## Running

```bash
# key: env TVSCORES_APISPORTS_KEY or file ~/.config/tvscores/api-sports.key
npm start                      # http://127.0.0.1:8787
./deploy/install.sh            # systemd --user service + Tailscale Funnel mount
journalctl --user -u tvscores-proxy -f
```

Public URL while on the VPS Funnel: `https://srv1822832.tailf78112.ts.net/tvscores/v1/scoreboard`.

Cache lives in `~/.local/state/tvscores/` and survives restarts; on an upstream
failure the last good data is served and `stale` turns true after 6 h without a
successful fetch. Bumping `SCHEMA_VERSION` in `src/cache.js` clears resolved
portraits and standings stamps, which costs several minutes of refetching, so
do it only when the stored shape actually changed.

## Rights

Everything under `assets/` is someone else's trademark, redistributed from a
public repository. That is a deliberate, recorded risk for the MVP (see
`docs/data-providers.md`); before the store release the badges either come from
a paid tier that licenses them or the app falls back to the monograms it
already draws.
