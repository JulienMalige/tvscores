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
| `GET /v1/health` | uptime, cached event count, and per-sport quota: `used / limit / remaining`, last success, last error |

Responses carry `Cache-Control: public, max-age=30`. The server also accepts the
`/tvscores` prefix so it can sit behind `tailscale funnel --set-path /tvscores`.

Event shape: see `src/model.js`. Team events have `home/away {name, nick, short}`,
`score {home, away}`, `status {state, clock, detail}` with `state` one of
`scheduled | live | final | other`. Races (`kind: "race"`) carry `results[0..2]`.

## Providers and quota

| Sport | Source | Calls per day |
|---|---|---|
| football (Champions League) | API-Sports v3, free plan | 3 daily (yesterday, today, tomorrow) + live polling |
| nfl | API-Sports american-football, free | same |
| nba | API-Sports v2 nba, free | same |
| f1, motogp | Orange Cat Blacktop (free key, 7,500/month), Jolpica fallback for F1 without a key | 1 calendar call + 1 per newly finished race, every 30 min; F1 flags from 1 Jolpica call/day |
| tennis (ATP, WTA singles) | livetennisapi.com free key, 100/day | 1 upcoming call daily + live polling inside match windows |

API-Sports free plan facts learned 2026-09-13: 100 calls/day per sport, only the
dates **yesterday..tomorrow**, no `season` or `next` parameters for the current
season. So "upcoming" on the free plan means tomorrow, except for the F1
calendar which is complete.

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

Cache lives in `~/.local/state/tvscores/store.json` and survives restarts; on
an upstream failure the last good data is served and `stale` turns true after
6 h without a successful fetch.
