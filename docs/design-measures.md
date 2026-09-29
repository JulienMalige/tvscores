# Design measures: Apple Sports (iPhone) → TV Scores (tvOS)

Measured 2026-09-29 from pixels. Scripts and annotated evidence crops (`ev_apple_*.png`, `ev_ci_*.png`):
`/tmp/claude-1000/-home-julien/d97521fb-4107-4e8a-931d-de02e0e3921b/scratchpad/measure/` (`m.py` helpers, `apple.py`, `ci.py`, `geom.py`, outputs `*_out.txt`, `*.json`).

## 1. Method and scale factor

1. Apple: 1320×2868 px screenshots (iPhone @3x, 440 pt wide). Every element is a bounding box of the pixels that differ from a background sampled around it (threshold 25/255, or a per-row median on the game page's gradient). Panel edges, radii and separators come from luminance profiles. A radius is the circle-equivalent value, taken from the 45° point of the traced border (r = d/0.293).
2. Type size comes from cap height (first flat capital, e.g. H E F T B P N) / 0.707. Round letters and figures use /0.72–0.74. **Calibrated on our own CI render**: callout 31 → cap 22.0 pt (0.710), body 29 → 21.0, bold 46 → 32.5 (0.707), condensed-bold figures 150 → 107.5 (0.717). The same method reads our known panel radius back as 36 (code 36).
3. Ours: CI build-37 screenshots (3840×2160, @2x → pt = px/2) plus the current code. **The CI shots predate commits 14e0dd9/1b0c6a5**: CI37 still has a crest of 64, a list score of 64 and a league mark of 34. The "ours now" column gives HEAD code first and then "ci37:" for what was measured.
4. Measured, not assumed: on tvOS, SwiftUI `.title3` renders at **48** (cap 34) and `.title2` at **57** (cap 40.5). `.headline` renders at 38 and `.callout` at 31. The list in the brief ("title3 38") is shifted by one step.
5. **Scale factor k = 2.0.** Across the 10 Apple text styles, tvOS size ÷ iOS size runs from 1.71 (body 29/17) to 2.71 (title1 76/28), with a median of 2.08. Matching angles (1 iPhone pt ≈ 0.166 mm at 35 cm, 1 TV pt at 3 m on a 55–65″ set) gives 1.9–2.25. Body (1.7) is the low outlier. **Base unit** = Apple's row text (team name in a table, player name, panel title): cap 32–33 px, **15 pt**. On the TV that is 30 pt (between body 29 and callout 31). Proposed TV = Apple pt × 2, snapped to a tvOS style when one is within about 10%.

Legend: px = Apple's measured height (cap, figure or box), pt = derived font size or box size, ×base = pt/15. n/m = not measured.

## 2. Tables

### Home list (d8f5f28b Yesterday NFL, ad93dffd Upcoming)

| element | Apple px | Apple pt | ×base | proposed TV pt | ours now | change |
|---|---|---|---|---|---|---|
| Screen edge → panel | 30 | 10 | 0.67 | 80 (tvOS safe area; ×2 = 20 would fall in overscan) | 160 (measured panel x) | −80 |
| Panel width / screen | 1260/1320 | 95 % | – | 1760 (92 %) | 1600 (83 %) | +160 |
| Panel corner radius | ~72 | 24 | 1.6 | 48 | 36 (cardRadius; measured 36) | +12 |
| Separator inset from panel edge | 30 | 10 | 0.67 | 20 | 50 (measured) | −30 |
| Panel top → day-switch separator | 161 | 54 | 3.6 | 107 | 87.5 (measured) | +20 |
| Day-switch label ("Yesterday", Y) | 33 | 15.6 | 1.04 | 31 callout | body medium 29 (cap 21) | +2 (≈ok) |
| League heading mark (height) | 64 | 21.3 | 1.42 | 43 | 50 (leagueMarkSmall); ci37: 34 | −7 |
| League heading name ("NFL", N) | 26 | 12.3 | 0.82 | 25 caption1 semibold | callout semibold 31 (cap 22) | −6 |
| Team crest (round crest box) | 102 | 34 | 2.27 | 68 | 80 frame − 2×6 pad = 68; ci37: 52 | 0 ✓ |
| Crest → name gap | 20 | 6.7 | 0.44 | 13 | 6 + 6 pad = 12 | ✓ |
| Team name ("Bengals", B) | 26 | 12.3 | 0.82 | 25 caption1 | callout 31 (cap 22) | −6 |
| Score (figure height 87) | 87 | 40 | 2.7 | 80 | 98 (matchScoreType); ci37: 64 | −18 |
| Status "Final" (F) | 33 | 15.6 | 1.04 | 31 callout semibold | title3 semibold **48** (cap 34) | **−17** |
| Kick-off time "20:00" (figures) | 34 | 15.7 | 1.05 | 31 callout semibold | title3 semibold **48** (figures 35.5) | **−17** |
| Day heading "Sat, 3 Oct" | 27 | 12.7 | 0.85 | 25 caption1 semibold | callout semibold 31 ("Thu, Sep 17" cap 22) | −6 |
| Record "11-7-9" (figures) | 29 | 13.4 | 0.9 | 27 → 25 caption1 | callout medium 31 | −6 |
| Crest centre from panel edge | 123 | 41 | 2.7 | 82 | 160 (measured) | −78 |
| Game row pitch (separator to separator) | 272 | 90.7 | 6.0 | 181 | ci37: 143.5; HEAD n/m | +38 vs ci37 |
| Game row + league heading | 365 | 121.7 | 8.1 | 243 | n/m | – |

### Competition page (2485c6cf NBA, a4165fe3 NFL: the rows are the same as Home)

| element | Apple px | Apple pt | ×base | proposed TV pt | ours now | change |
|---|---|---|---|---|---|---|
| Empty-day title (figure "2") | 44 | 20.7 | 1.38 | 41 → 38 headline semibold | title3 semibold 48 (cap 34.5) | −10 |
| Empty-day subtitle (C, round) | 34 | 15.3 | 1.02 | 31 callout | callout 31 (cap 23) | 0 ✓ |
| Gap between panels | 38 | 12.7 | 0.85 | 25 | 24 (measured) | ✓ |
| Panel radius | ~72 | 24 | 1.6 | 48 | 36 | +12 |

### Table panel (2485c6cf "Eastern Conference"; ours: league-football-yesterday-en)

| element | Apple px | Apple pt | ×base | proposed TV pt | ours now | change |
|---|---|---|---|---|---|---|
| Panel title (E) | 32 | 15.1 | 1.0 | 31 callout semibold | headline 38 ("Standings" S 28) | −7 |
| Panel top → title cap top | 64 | 21 | 1.4 | 43 | 53 (measured) | −10 |
| Column header ("Team" T / "W") | 28.5 | 13.4 | 0.9 | 27 → 25 caption1 | callout semibold 31 (cap 22) | −6 |
| Rank ("1") | 32 | 15.1 | 1.0 | 30 regular | 30 bold (cap 21.5) | weight only |
| Row crest | 56 | 18.7 | 1.24 | 38 | **64** (Metrics.mark) | **−26** |
| Crest → name gap | 36 | 12 | 0.8 | 24 | 23 | ✓ |
| Row name ("Hawks", H) | 32 | 15.1 | 1.0 | 30 → 31 callout regular | title3 semibold **48** (cap 34) | **−17** |
| Row numbers ("0") | 34 | 15.7 | 1.05 | 31 callout | 28 regular, last column 34 bold | +3 / −3 |
| Number column pitch (W → L) | 123 | 41 | 2.7 | 82 | 116 (tableCell 96 + spacing) | −34 |
| Row pitch | 120 | 40 | 2.67 | 80 | 110 (measured) | −30 |
| Panel edge → rank | 50 | 16.7 | 1.1 | 33 | 97.5 (measured) | −64 |
| Last column → panel edge | 69 | 23 | 1.53 | 46 | 52 | ✓ |

### Tournament card + rankings (fa5ec42e ATP; ours: league-tennis-upcoming-en, code for the card)

| element | Apple px | Apple pt | ×base | proposed TV pt | ours now | change |
|---|---|---|---|---|---|---|
| Tournament mark | 98 | 32.7 | 2.2 | 65 | 66 (markHero×0.6, code; no CI shot) | ✓ |
| Tournament name (S, round) | 44 | 19.8 | 1.32 | 40 → 38 headline | headline 38 (code) | ✓ |
| Place "Shanghai, China" (S) | 27 | 12.2 | 0.81 | 25 caption1 | callout 31 (code) | −6 |
| Dates "7–18 Oct" (7) | 25 | 11.8 | 0.79 | 25 caption1, tertiary | n/m (not found in code) | – |
| Rankings title (A) | 32 | 15.1 | 1.0 | 31 callout semibold | headline 38 ("Standings") | −7 |
| Column header "Player" / "Total" | 28 | 13.2 | 0.88 | 25 caption1 | absent | add |
| Rank | 32 | 15.1 | 1.0 | 30 | 30 bold (cap 21.5) | ✓ |
| Portrait (circle; 84×79 with flag) | 72 | 24 | 1.6 | 48 | **64** (measured 68.5 with flag) | **−16** |
| Player name ("J. Sinner", J) | 33 | 15.6 | 1.04 | 31 callout | title3 semibold **48** (cap 34.5) + second line (country), callout | **−17** |
| Points ("11.500") | 34 | 15.7 | 1.05 | 31 callout | 34 bold | −3 |
| Row pitch | 120 | 40 | 2.67 | 80 | **142.5** (measured) | **−62** |

### Game page (687e2e1f NFL final; ours: live-game-final-nfl-en)

| element | Apple px | Apple pt | ×base | proposed TV pt | ours now | change |
|---|---|---|---|---|---|---|
| Sheet side margin | 60 | 20 | 1.33 | 40 | 48 (gameMargin; measured 48) | ✓ |
| Sheet corner radius | ~102 | 34 | 2.27 | 68 | 56 (code; trace ≈43 on gradient, unreliable) | +12 |
| League label "NFL" (N) | 25 | 11.8 | 0.79 | 25 caption1 | callout semibold 31 (cap 22) | −6 |
| Score (figure height 179) | 179 | 83 | 5.5 | 166 | 150 (figures 107.5) | +16 |
| Status "Final" (F) | 31 | 14.6 | 0.97 | 29 body semibold | title2 semibold **57** (cap 40.5) | **−28** |
| Crest | 100 | 33.3 | 2.2 | 67 | **110** markHero (Bills 98×66) | **−43** |
| Team name (B) | 30 | 14.1 | 0.94 | 29 body semibold | title3 semibold **48** (cap 34) | **−19** |
| Record "2-1" | 26 | 12.0 | 0.8 | 25 caption1 | callout medium 31 (cap 23) | −6 |
| Period header "1" | 25 | 11.8 | 0.79 | 25 caption1 | callout semibold 31 (cap 22) | −6 |
| Period team "PIT" | 26 | 12.3 | 0.82 | 25 caption1 semibold | callout bold 31 (cap 22) | −6 |
| Period figures "14" | 26 | 12.3 | 0.82 | 25 | callout medium 31 (figures 23) | −6 |
| Period row pitch | 87 | 29 | 1.93 | 58 | 73.5 (measured) | −15 |
| Sheet edge → period table | 60 | 20 | 1.33 | 40 | 100 (gameInset; measured) | −60 |
| Page tabs "Stats / Play-By-Play / Standings" (S) | 32 | 14.4 | 0.96 | 29 body semibold | absent | – |
| Sheet edge → stats card | 28 | 9.3 | 0.62 | 19 | 100 (card x 148 − sheet 48) | −81 |
| Card corner radius | ~48 | 16 | 1.07 | 32 | 36 (measured 37.5) | −4 |
| Card inner inset (to the stat figures) | 34 | 11.3 | 0.75 | 23 | n/m | – |
| Card title "Team Stats" (T) | 30 | 14.1 | 0.94 | 29 body semibold | headline 38 ("Standings" S 28) | −9 |
| Stat value (condensed figures, h 44) | 44 | 20.4 | 1.36 | 41 | 50 (statValue) | −9 |
| Stat label "Plays" (P) | 29 | 13.7 | 0.91 | 27 → 29 subheadline | callout 31 | −2 |
| Stat bar thickness | 17 | 5.7 | 0.38 | 11 | 10 | ✓ |
| Stat row pitch | 121 | 40.3 | 2.69 | 81 | n/m (no stats in the CI37 shots) | – |

## 3. Biggest mismatches, most visible first

1. **Status and times in list rows are three style steps too big.** "Final", "20:00" and "Live" are callout-sized at Apple (≈1.0× base). Ours are title3 48 (1.6× base), louder than the team names and close to the score. Proposed: callout semibold 31.
2. **Table and ranking rows are too tall and their names too big.** Apple uses a row name at base size (30 on TV), a crest of 38, and a 40-pt pitch (80 on TV). Ours use a title3 48 name, a mark of 64 and a pitch of 110 (table) or 142.5 (rankings, with a second country line Apple does not have). Apple fits about 2× as many rows per screen.
3. **Game header too big except for the score.** Final: 57 → 29. Crest: 110 → 67. Names: 48 → 29. Apple's score is bigger than ours (83 pt at Apple → 166 vs our 150), so the score should dominate much more than it does now.
4. **Horizontal waste.** The panel starts at 160 (Apple: the safe-area edge, 80). The crest centre sits 160 in from the panel edge (Apple 82). Table ranks sit 97.5 in (Apple 33). On the game page, the table and card sit 100 in from the sheet (Apple 40 and 19).
5. **Secondary labels are one step too big everywhere.** League heading name, team name under the crest, record, day heading, column headers, place, period table: Apple 12–13 pt → caption1 25 on the TV; ours are callout 31.
6. **Panel radius** 36 → 48, and **list row pitch**: ci37's 143.5 is well short of the proposed 181, but HEAD (larger crest, score and row padding) is unmeasured, so rebuild the CI screenshots before tuning it.
7. **Card and panel titles** ("Standings", "Team Stats") are headline 38 → callout/body semibold 29–31.
