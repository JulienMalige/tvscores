# Motorsport data sources for a public release (checked 2026-10-03)

Question: what replaces or upgrades the Orange Cat Blacktop (OCB) free tier for
F1 and MotoGP before the App Store release, keeping today's granularity:
weekend schedule per session, qualifying times (Q1/Q2/Q3), sprint and race
classification with gaps, points, grid, laps, fastest lap, driver codes, team
colours, driver/rider and constructor/team standings. AGENTS.md rule 3 applies:
documented, licensed APIs only.

## Orange Cat Blacktop today

Source: <https://ocblacktop.com/api> (pricing table and FAQ), <https://ocblacktop.com/terms>,
<https://ocblacktop.com/api/moto-gp>.

| Plan | Price | Requests | Rate | Notes |
|---|---|---|---|---|
| Free (ours) | $0 | 7,500/month | 60/min | "For prototyping and non-commercial projects", server-side only, REST only |
| Hobby | $9/month | 750,000/month | 300/min | all endpoints, lap charts, F1 telemetry, live race-weekend data (F1, NASCAR, IndyCar, WRC), 3 WebSocket connections |
| Pro | $14/month | 3,000,000/month | 600/min | same, 25 live connections, priority support |
| Commercial | $99/month | no monthly cap | 2,000/min | "For companies building paid products on the data", bulk exports |
| Enterprise | custom | custom | custom | broadcasters, betting |

- FAQ, verbatim: "all paid plans include commercial usage rights to the API,
  its infrastructure, and our normalized data model. They do not grant rights in
  the underlying championship data … publicly displaying or redistributing the
  data, especially live timing, may need clearance from the relevant rights
  holder." So Hobby ($9) already lifts the non-commercial restriction; the $99
  tier is positioned for paid products.
- Terms: data is "compiled from publicly available sources"; OCB is "not
  affiliated with, endorsed by, or licensed by any racing series"; no bulk
  resale. Same caveat class as API-Sports ("rights are the user's
  responsibility"), which we already accept.
- MotoGP live: "No" on every plan; post-session results only (same as today).

## Alternatives

TheSportsDB checked with our $9 key on 2026-10-03 (F1 league 4370, MotoGP 4407).
API-Formula-1 checked with our free API-Sports key on 2024 data (2026 is
paywalled on the free plan).

| Source | F1 | MotoGP | Granularity vs OCB | Live | Price | Commercial licence | Switch effort |
|---|---|---|---|---|---|---|---|
| **OCB Hobby** | yes | yes | identical (it is what we use) | F1 yes, MotoGP no | **$9/mo** | yes, all paid plans (no rights in championship data) | none: swap key |
| TheSportsDB (our $9 key) | 2026 calendar, each session a separate event (FP1–3, Sprint Qualifying, Sprint, Qualifying, race) | 2026 calendar, FP1/Practice/FP2/Q1/Q2/Sprint Race/GP as separate events | `eventresults.php?id=` (v1; `lookupeventresults.php` is 404) or v2 `lookup/event_results/{id}`: position, player, team id, nationality, `strDetail` = time/gap/"+1 lap"/"DNF". F1 has points; quali is one best time (no Q1/Q2/Q3 split); F1 race lists incomplete (Baku 16 rows, Monza 19 of 22). MotoGP: no points, Q1/Q2 results empty. No grid, laps, fastest lap, driver codes, team colours. `lookuptable.php` for 4370/4407 = "Invalid ID passed" (no standings). | no (livescores only for team sports) | paid already ($9 Single Developer; $20 Small Business) | paid subscribers may publish apps (terms: <https://www.thesportsdb.com/docs_terms_of_use.php>), crowd-sourced data | large, and loses fields |
| Jolpica (Ergast successor) | results, quali Q1/Q2/Q3, sprint, grid, laps, fastest lap, standings, driver codes | no | F1 matches OCB except team colours | no | free (4 req/s, 500/h) | **non-commercial only**: TERMS.md says data is CC BY-NC-SA 4.0, commercial use by request to admin@jolpi.ca (<https://github.com/jolpica/jolpica-f1/blob/main/TERMS.md>) | we already have the adapter |
| OpenF1 | live timing, laps, positions, starting grid, standings (2023+) | no | rich, but results must be assembled from timing data | €9.90/mo sponsor tier | CC BY-NC-SA 4.0, "contact us" for commercial (<https://openf1.org/>) | medium |
| API-Sports API-Formula-1 | sessions as races typed "1st/2nd/3rd Qualifying", "Sprint", "Race"; `rankings/races`: abbr, number, team, position, time/gap, laps, grid, pits; `rankings/startinggrid`; fastest lap on the race; driver and team rankings with points | no | F1 matches OCB minus team colours and per-race points (computable) | yes | $19/mo (Pro, 7,500/day); free plan only 2022–2024 | allowed, rights on data are ours (same as our other API-Sports leagues) | medium (new adapter, same account) |
| balldontlie F1 (<https://f1.balldontlie.io/>) | events, sessions, results, standings on ALL-STAR; Q1/Q2/Q3 only on GOAT | no | results list position, laps, pits, retired; no time/gap documented on ALL-STAR; team hex colours, driver codes | status live, details ~10 min after session | $9.99 (ALL-STAR) / $39.99 (GOAT) | clearest terms: display, cache, distribute allowed (<https://www.balldontlie.io/terms>) | medium |
| Sportmonks F1 (<https://www.sportmonks.com/formula-one-api/>) | every session, position, gap, interval, lap time, grid | no | F1 near OCB | yes | €69/mo yearly, €79 monthly | B2B commercial | medium |
| Goalserve motorsport (<https://www.goalserve.com/en/sport-data-feeds/f1-api/prices>) | yes | yes (+Moto2/3) | fixtures, lap by lap, rankings | yes | $150/mo, $1,000/yr | commercial B2B | large (XML/JSON feed) |
| Sportradar Racing (<https://developer.sportradar.com/racing/reference/motogp-overview>) | yes | yes: stages for practice, qualifying, qualifying parts, sprint, race | full | F1 yes, MotoGP post-race | enterprise quote | yes, the only one with official-grade licensing | large, out of budget |
| SportsDataIO F1 (<https://sportsdata.io/developers/api-documentation/f1>) | yes | no | standings, race stats | yes | sales quote, trial is UCL only | yes | large |
| Zyla Labs "MotoGP Data API", Apify MotoGP scrapers | – | riders only / scraped motogp.com pulselive | – | – | $25+/mo | Apify scrapes the undocumented pulselive API; Zyla states no source licence | **excluded** (rule 3) |

No affordable source has MotoGP live timing, and no affordable licensed MotoGP
source other than OCB matches its granularity (Q1/Q2, sprint, points,
standings). TheSportsDB is the only cheap fallback and is much thinner.

## Recommendation

**Keep OCB for both series and move to Hobby at $9/month before release**
(750k requests, commercial rights per its FAQ). It is the cheapest legitimate
setup with today's granularity; nothing in the proxy changes but the key.
Ask OCB by email to confirm in writing that Hobby covers a free App Store app
(or whether a paid app needs Commercial at $99), and file the reply and the
pricing page here with the other receipts.

Two follow-ups this check surfaced:

1. **Jolpica is non-commercial** (CC BY-NC-SA 4.0). `docs/data-providers.md`
   line 12 ("no commercial restriction stated") is outdated. The proxy uses it
   for F1 driver nationalities (flags) and as the keyless F1 fallback. Before
   release, take flags from TheSportsDB `eventresults` (`strCountry` per
   driver, on the key we pay for) or drop them, and keep Jolpica dev-only.
2. If OCB disappears: F1 via API-Sports API-Formula-1 ($19/mo, same account)
   and MotoGP via TheSportsDB (already paid; race and sprint classification
   only, no qualifying, points or standings).
