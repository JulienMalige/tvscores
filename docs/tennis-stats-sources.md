# Tennis match statistics: sources (checked 2026-10-03)

Need: per-match stats for ATP/WTA tour-level matches (Slams, Masters/WTA 1000,
WTA 500, Finals): aces, double faults, 1st serve in %, 1st/2nd serve points
won %, break points converted (4/11), service/return/total points won %.
Constraint: AGENTS.md rule 3 (documented, licensed APIs only; no scraping, no
private endpoints, no wrappers of them) and rule 4 (no odds).

## Answer

**No free source is both legitimate and usable in the app.** Every free
option is either evaluation-only, non-commercial, gone, or of unknown
provenance. The cheapest clean paid option is **balldontlie GOAT, $39.99/mo
per tour** ($79.98 for ATP + WTA); the tier we already use, livetennisapi
ULTRA, costs $99.99/mo.

## Sources

| Source | Stats | ATP / WTA | Latency | Free access | Terms / provenance | Verdict |
|---|---|---|---|---|---|---|
| **Sportradar Tennis v3** (official ATP data via TDI; WTA via Stats Perform is separate) | full: aces, DF, 1st/2nd serve, BP, points won ([tiers](https://developer.sportradar.com/tennis/docs/ig-data-coverage-tiers)) | Slams tier 1, ATP 250–1000 tier 2, WTA 1000/500 tier 3 | live | 30-day trial, 1,000 calls total, 1 QPS | trial = "non-commercial use … internal testing and evaluation purposes only" ([terms](https://developer.sportradar.com/sportradar-updates/page/master-terms-and-conditions-for-non-betting-services)); production by sales quote | best data, not free for an app |
| **balldontlie ATP / WTA** | `match_stats`: aces, double_faults, first_serve_pct, first/second_serve_points_won_pct, break_points_converted_pct / saved_pct, return %, total service/return/total points won % (percentages; no BP won/total counts) ([atp docs](https://atp.balldontlie.io/), [wta docs](https://wta.balldontlie.io/)) | both, separate subscriptions | `is_live` filter exists; stats latency not stated | none: GOAT tier only, 48-h trial at 5 req/min (card required) | documented commercial API, paid tiers allow app use; data origin not stated | **cheapest clean paid: $39.99/mo per tour** |
| **livetennisapi.com** (current provider) | `/matches/{id}/statistics`: aces, DF, serve split, BP saved/converted ([site](https://livetennisapi.com/)) | both | live | no: HTTP 403 `upgrade_required` on free (see data-providers.md) | "arbitrated multi-source feed", no licence statement | $99.99/mo ULTRA; no code change of provider |
| **api-tennis.com** | `statistics` array inline in `get_fixtures` / `get_livescore` with `stat_won`/`stat_total` (so "4/11" possible) ([docs](https://api-tennis.com/documentation)) | ATP, WTA, ITF, Challenger | live | 14-day trial only; from $40/mo ([pricing](https://api-tennis.com/)) | no source or licence statement; odds in the same payloads (must be dropped) | paid, provenance unknown |
| **Cito API / tennisapi.dev** | serves, aces, BP, 1st serve % ([site](https://tennisapi.dev/)) | both | free tier 60 s delayed, last 30 days, 500 calls/month | yes | "not affiliated with, endorsed by, or licensed by any league", data "from publicly accessible sources and public feeds"; **free plan is personal/non-commercial** ([terms](https://citoapi.com/terms/)) | rejected: unlicensed aggregation, non-commercial free tier |
| **Matchstat "Tennis API – ATP WTA ITF"** (RapidAPI) | stats, point-by-point, odds ([docs](https://tennisapidoc.matchstat.com/getting-started)) | both | live | 50 req/day free | no provenance or display terms published; betting-focused (odds, value bets) | rejected: unknown provenance, betting product |
| **Goalserve tennis** | live game stats, point-by-point ([prices](https://www.goalserve.com/en/sport-data-feeds/tennis-api/prices)) | both | 5 s | 30-day trial | commercial licence; $150/mo | paid only |
| **SportDevs** | statistics endpoint listed, 300 req/day free | ? | ? | yes | domain did not resolve on 2026-10-03; no provenance statement found | not verifiable today |
| **Jeff Sackmann tennis_atp / tennis_wta** | aces, DF, svpt, 1stIn, 1stWon, 2ndWon, bpSaved/bpFaced | both | batch, roughly every ~100 matches | — | **repos deleted (404 since ≈ Sept 2026, [issue](https://github.com/MLT-OSS/FirstData/issues/238))**; only a June 2026 [archive mirror](https://github.com/Aneeshers/tennis-sackmann-archive); CC BY-NC-SA (non-commercial) | gone, and never timely |
| **TennisMyLife TML-Database** | Sackmann columns | ATP only | daily on [stats.tennismylife.org](https://stats.tennismylife.org/tennis-match-database); GitHub copy frozen Jan 2026 | — | built from the ATP website; "redistribution, commercial use … without permission … may violate" ATP terms ([repo](https://github.com/Tennismylife/TML-Database)) | rejected: derived from ATP site, no WTA |
| **Match Charting Project** | shot-level, volunteer-charted | both, a small sample | weeks to never | — | CC BY-NC-SA | not a feed |
| **ATP (TDI) / WTA (Stats Perform) official** | full | each its own | live | no public developer API | B2B only via Sportradar (ATP) and Stats Perform (WTA) | not reachable for us |
| Sportmonks | — | — | — | — | no tennis (football, cricket, F1) | n/a |
| TheSportsDB, API-Sports | — | — | — | — | no tennis stats / no tennis | n/a |
| Apify "tennis scrapers", RapidAPI Sofascore/Flashscore wrappers, ESPN/ATP/WTA site JSON | full | both | live | yes | scrapers or undocumented endpoints | **forbidden by rule 3** |
| BetsAPI | event stats exist | both | live | no | betting data reseller, not first-party | forbidden in spirit (rule 4), provenance unclear |

## Recommendation

1. No free, legitimate, timely source exists. Keep the statistics section
   hidden for tennis until Julien chooses to pay.
2. If he pays, the cheapest documented option is **balldontlie GOAT**
   ($39.99/mo ATP, +$39.99 WTA). It has every requested field as a
   percentage. Break points arrive as `break_points_converted_pct`, so the
   "4/11" form needs counts that it does not return: show a percentage, or
   confirm the counts during the 48-h trial.
3. **livetennisapi ULTRA** ($99.99/mo) covers both tours with one key and no
   new provider. It costs more than balldontlie for both tours.
4. Sportradar is the only feed with a clear official-data chain (ATP via
   TDI). Its free trial forbids app use, so it fits only at a negotiated price.
