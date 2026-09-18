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

Constructor badges are composed, not copied: the source ships sponsor lockups,
so the script crops the marque out of each with a hand-written box, drops it on
a disc of that team's own colour, and paints it as a silhouette when it would
otherwise melt into its disc. Re-run it after a livery season and look at the
result; a lockup that changed shape puts the crop in the wrong place. A team
with no marque in its lockup is left out on purpose and keeps the monogram the
app already draws.

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

| Sport | Provider & plan | Cap | Schedule batch | Live poll | Source's own freshness | Worst-case day | Licensed for release? |
|---|---|---|---|---|---|---|---|
| football (8 competitions) | TheSportsDB, Single Developer ($9/mo) | 100/min | 9 calls, once per UTC day after 04:00 (or 3 h stale) | 30 s inside a window, 1 call | 60 s (measured) | ~1,500 incl. tables | yes, confirm wording |
| nfl | TheSportsDB, same key | shared | 9 calls, same | 30 s, 1 call | 60 s (assumed, as football) | ~800 | yes |
| nba | TheSportsDB, same key | shared | 9 calls, same | 30 s, 1 call | 60 s (assumed, as football) | ~800 | yes |
| tennis (ATP/WTA, majors and 1000s) | livetennisapi, free | **100/day** | 1 call daily + catalogue once a month | 30 min, 1 call | seconds | ~55 | free tier only |
| f1, motogp | Orange Cat Blacktop, free | 7,500/month | calendar every 6 h; 30 min within 6 h of a session | — (results, not live timing) | post-session | ~10 each | **no — non-commercial** |
| portraits | TheSportsDB, same key | 25/min, soft 1,000/day | once per athlete, kept a month | — | static | ~120 on a new sport | yes |
| crests, badges | mirrored on this proxy | none after first fetch | on first sight | — | static | ~0 | trademark risk accepted |

TheSportsDB is capped per **minute** (100 on the paid tier), not per day, which
is what lets the team sports poll half a minute apart. Their pricing page calls
it a "2 min livescore"; watching one match for four minutes on 2026-09-15 showed
the `updated` stamp moving every 60 s (23:06:31, 23:07:31, 23:08:30, 23:09:31,
23:10:31). Polling at 30 s — half that period — sees every change within 30 s
of it whichever way the feed's minute falls against ours; polling at 60 s could
sit just ahead of every update, and anything faster than 30 s only spends the
cap. Two consequences worth remembering:

- Adding another competition is free: fixtures are fetched per date and
  filtered by league id locally, and the livescore call covers every league of
  a sport at once. Adding another *sport* costs one call per day of the window.
- The motorsport calendar comes whole from Orange Cat Blacktop, whose free tier
  is 7,500 a **month**, so F1 and MotoGP are polled every six hours except
  within six hours of a session.

League tables come from `lookuptable.php`, one call per competition, every six
hours and again within ten minutes of a final whistle in that competition — a
table nobody sees move is what makes an app feel dead. Only providers whose
table is made of results opt in to that second trigger: tennis rankings move
weekly whatever happens on court, and chasing them would spend a 100-a-day
budget on an unchanged number. A cup with no table, or a season that has not
begun, answers with an empty body; that is an answer, not an error, and it is
retried in 30 minutes rather than buying six hours of silence.

Live polling runs only while a tracked game is inside its window (10 min before
kickoff, to 4 h after — 8 h for one already reported live). The interval is the
per-sport floor in `schedule.liveIntervalSeconds`, stretched so the remaining
calls of the day are never exhausted, keeping a reserve of 8. `src/quota.js`
holds that logic and its tests.

## Running

```bash
# keys: files under ~/.config/tvscores/ (thesportsdb.key, ocblacktop.key, livetennisapi.key)
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
