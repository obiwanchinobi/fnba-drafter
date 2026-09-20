# ESPN projection backtest

Yearly evaluation of draft-night projections against the season's final actuals. The comparison covers ESPN's projected counting stats plus FNBA's estimates for the five scored cats ESPN does not project (OREB, DREB, PF, DD, TD). Read-only: the task never writes `player_projections` or `player_season_stats`.

ESPN's public projection set is the default 8-cat / points-league board. OREB, DREB, PF, DD and TD are optional league cats and are present in actuals blocks (`00<season>`) but not in projection blocks (`10<season>`). This backtest treats that omission as permanent and scores our estimates together with ESPN's inputs.

## Modes

### Stored (`stored`)

The yearly loop, available from the 2026-27 season onward. Reads `PlayerProjection` rows for `source: espn` and the requested season — the snapshot written on draft night, including `estimated_stat_keys`. Actuals come from `player_season_stats` for that same season once the following year's import has persisted them; if that table has no rows, the task fetches the season's actuals block from `EspnProjectionsClient.new(season:)`.

A refresh after opening night overwrites the draft-night row. When any stored row has `imported_at` after 15 October of the season's start year (ESPN season `N` starts in calendar year `N - 1`), the report warns and counts the affected rows.

### Reconstructed (`espn`)

For seasons before FNBA stored draft-night rows (the first such season is 2025-26). Fetches:

1. Season `N` endpoint: projection block `10<N>` and actuals block `00<N>` (the comparison target).
2. Season `N - 1` endpoint: actuals block `00<N-1>` (estimator priors).

Each season's actuals live on that season's endpoint; asking the following season for a two-year-old actuals block returns nothing.

Estimates are produced by the same `EspnStatEstimates` formulas used at import (OREB/DREB share split of projected REB with `K_REB = 25`, PF as a shrunk rate times projected minutes, DD/TD as a games-weighted blend of a calibrated probability model and the player's own prior-season rate). Rows are filled in memory and discarded; nothing is persisted.

ESPN may revise the `10<N>` block after preseason. Reconstructed error is therefore indicative, not a true draft-night score.

## Metrics

Players with fewer than 20 actual games are dropped. Per stat (OREB, DREB, PF, DD, TD, PTS, AST, STL, BLK, TO, FGM, FGA, FTM, FTA, TPM, TPA, MIN, GP):

| Field | Meaning |
|-------|---------|
| `n` | Players with both a projection and an actual for that stat |
| `total_mae` / `total_bias` | Mean absolute error and mean (projection − actual) on season totals |
| `rate_mae` / `rate_bias` | Same on per-game rates (`total / gp`), so games-played error is isolated |

Bias is signed: positive means the projection overshot. PF and TO are inverse cats (lower is better), so positive bias is harmful there.

OREB also reports `share_mae`: mean absolute error of `OREB / REB`. Players with zero actual REB are ignored so the ratio is defined. The five estimated cats are split by whether the player had a prior-season actuals row (`had_prior_season` vs `no_prior_season`).

## How to run

From `backend/`:

```sh
bin/rails "espn:backtest[2026]"
bin/rails "espn:backtest[2026,espn]"
bin/rails "espn:backtest[2027,stored]"
```

`season` defaults to `Espn::SEASON`. `mode` defaults to `stored`. If `stored` is requested (or defaulted) and no ESPN projection rows exist for that season, the task prints a note and falls back to reconstructed mode. Chrome ESPN cookies must be readable for any ESPN fetch; client errors print one line and exit non-zero.

Each September, run the task for the season that just finished and append a Results section below. Do not automate the doc write.

## Results

### 2025-26 reconstructed (run 2026-09-19)

Reconstructed from ESPN's 2025-26 projection block plus 2024-25 actuals, compared with 2025-26 actuals. 336 players with 20 or more games. Fitted DD/TD spreads on that payload: `k_dd = 1.30`, `k_td = 1.60`. Rebound-share and foul-rate shrinkage: `K_REB = 25`, `K_MIN = 150`.

The 2025-26 projection block ESPN served on 2026-09-19 may already have been revised from its preseason version, so live error may be slightly higher than a true draft-night snapshot.

#### Pool error

| Estimate | Mean absolute error per player-season | Note |
|---|---|---|
| OREB, blended share `K = 25` | 27 rebounds | Falls to 10 when the actual REB total is substituted, so the split adds little error; the rest is ESPN's REB (mostly GP) over-projection, which every ESPN cat inherits |
| OREB share itself | 0.042 | Raw ratio 0.044, position prior alone 0.066 |
| DD per game, blend | 0.047 (about 3.7 a season) | Model alone 0.052 with +0.023 bias; about 0.09 per game for the 11 players at 0.5 DD per game or more |
| TD per game, blend | 0.006 (about 0.4 a season) | Misses are breakouts ESPN did not project (Jalen Johnson 13 actual against 2 estimated) |

#### Named-player comparison

Estimates computed from the 2026-09-19 payload (`K_REB = 25`, `k_dd = 1.30`, `k_td = 1.60`):

| Player | OREB | DREB | DD | TD |
|---|---:|---:|---:|---:|
| Nikola Jokic | 213 | 701 | ~62 | ~34.5 |
| Victor Wembanyama | 149 | 668 | ~45 | 1 |
| Shai Gilgeous-Alexander | 50 | 322 | ~11 | ~0.5 |

Model-alone vs 2025-26 actuals (the blend exists because the model by itself overshoots DD for high-usage scorers and undershoots TD for true triple-double players):

| Player | Stat | Model | Actual | Blend intent |
|---|---|---:|---:|---|
| Nikola Jokic | TD | 27.7 | 34 | Independence of REB and AST undershoots playmaking bigs |
| Shai Gilgeous-Alexander | DD | 16.5 | 8 | Once PTS is near-certain, 5–6 AST overshoots DD |
| Donovan Mitchell | DD | 10.9 | 5 | Same high-usage scorer pattern |
| Jalen Johnson | TD | 2 (blended estimate) | 13 | Breakout ESPN did not project |

Position OREB-share priors on that payload: C 0.338, PF 0.274, SF 0.236, SG 0.236, PG 0.195. ESPN's first eligible slot is not always the natural position (Scottie Barnes lists SG); with `K_REB = 25` that only moves tiny samples.
