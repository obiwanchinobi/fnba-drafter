# FNBA draft-night analysis and app requirements

Created: 2026-09-12 13:17:55 AEST (Australia/Sydney).

Status: design basis from the discussion. This document records user requirements, historical findings and proposed implementation choices. The proposed weights have not been backtested, and an ESPN live basketball draft connection has not been implemented or verified in this repository.

The canonical product source of truth remains [product-vision.md](product-vision.md). Historical evidence is in [historical-winners.md](historical-winners.md) and its [machine-readable companion](historical-winners.json).

## 1. The draft-night problem

The app should help the owner draft a winning team in ESPN league `43046`, using its actual 19-category rotisserie scoring.

The user learns the snake draft order approximately one hour before the draft. Preparation must therefore work without knowing the user's draft position. Once the order is available, the app can calculate the user's turns and the number of intervening selections.

Other managers may use generic rankings, different category weights or personal preferences. The app must identify players who remain available below FNBA's valuation and make them easy to assess when the user is on the clock. Opponent selections must not be assumed to follow FNBA's rankings.

The requested interaction is:

> After noticing that someone has drafted, click Refresh draft in FNBA. Import the latest selections and update available players, team projections and recommendations before the user's next pick.

This manual refresh workflow is the primary design requirement. A full draft simulator is an optional enhancement.

## 2. Historical findings and their limits

The historical files contain six seasons, 2021–2026, covering 45 team-season observations. ESPN season IDs refer to the year the NBA season ends. Category values in the rotisserie tables are standings points, so higher is better even for TO and PF.

The following positions are category finishes, not raw statistical totals or rotisserie point values.

| Season | Champion | Teams | DREB finish | AST finish | PTS finish | Categories finishing top three |
|---|---|---:|---:|---:|---:|---:|
| 2021 | Team Chino | 7 | 2nd | 2nd | 1st | 14 |
| 2022 | Team Chino | 7 | 1st | 1st | 1st | 10 |
| 2023 | Trust in Pizza | 8 | 2nd | 2nd | 1st | 10 |
| 2024 | The People's Champ | 7 | 1st | 3rd | 1st | 13 |
| 2025 | Team Chino | 8 | 1st | 3rd | 5th | 10 |
| 2026 | Adam's All Stars | 8 | 1st | 1st | 1st | 11 |

The recurring findings are:

- Every champion finished top two in DREB and top three in AST.
- Five of six champions finished top three in each of STL, BLK, DD and TD.
- Five champions led both FGM and PTS. Scoring strength commonly accompanied broader production.
- No champion finished top three in FT%, STR or TO. Four finished last in TO, meaning they committed the most turnovers.
- Every champion finished top three in at least ten categories. Four champions also had four or five categories in the bottom two.
- Team Chino's 2025 title provides an alternative winning profile: first in FG%, 3P%, OREB, DREB and A/TO despite fifth in PTS, sixth in PPM and seventh in BLK.
- Only one champion led TD. In 2026, 52 TD earned the category leader only one more rotisserie point than the runner-up's 24 TD.

These observations support broad category coverage with room for selective weaknesses. They do not establish that any category must be won or deliberately punted.

The data describes outcomes, not the draft choices that caused them. It does not contain draft-day projections, original rosters, games used, injury histories or transaction histories. Repeated owners and related categories also mean these observations are not independent experiments. Differences in team count, season length and roster settings must be considered when comparing raw totals across years.

The product's existing injury and sparse-stat constraints remain applicable. The historical standings alone cannot quantify projection reliability or prove that a particular draft strategy caused a title.

## 3. Initial player valuation

### 3.1 Proposed fixed-weight preset

The user requested an explicit weight for every scored category. The following was the final manual preset proposed in the discussion.

This is an assistant-recommended starting configuration, not a statistically fitted optimum or an industry-standard 19-category weighting scheme. It should remain configurable and be compared against an equal-weight baseline when suitable projection and backtesting data is available.

| Category | Weight | Treatment or rationale |
|---|---:|---|
| FGM | 1.00 | Full counting-category weight |
| FG% | 1.00 | Weight contribution by attempts |
| FTM | 1.00 | Full counting-category weight |
| FT% | 1.00 | Weight contribution by attempts |
| 3PM | 1.00 | Full counting-category weight |
| 3P% | 1.00 | Weight contribution by attempts |
| OREB | 1.00 | Score separately from DREB |
| DREB | 1.10 | Modest preference reflecting the historical winning profiles |
| AST | 1.10 | Modest preference reflecting the historical winning profiles |
| A/TO | 1.00 | Evaluate contribution to the team ratio |
| STL | 1.00 | Full counting-category weight |
| STR | 1.00 | Evaluate contribution to the team ratio |
| BLK | 1.00 | Full counting-category weight |
| TO | 0.75 | Inverse category; deliberately soften its penalty |
| PF | 0.75 | Inverse category; deliberately soften its penalty |
| DD | 0.75 | Reduce dependence on double-double projections |
| TD | 0.25 | Strongly reduce dependence on triple-double projections |
| PTS | 1.00 | Retain its actual place among the 19 categories |
| PPM | 1.00 | Evaluate contribution to the team ratio, weighted by minutes |

The TO and PF discounts are deliberate strategy preferences. These categories still award full rotisserie points in the actual league. The DD and TD discounts are provisional safeguards; their precise values are not estimates of forecast accuracy.

An equal-weight comparison preset uses `1.00` for all 19 categories with the same transformations and inverse-category handling. Basketball Monster documents z-score valuation and notes that discretionary category weights are typically unnecessary; that supports keeping the distinction between the established method and FNBA's proposed preferences explicit. [Basketball Monster methodology](https://basketballmonster.com/help.aspx)

### 3.2 Score calculation and normalization

For positive counting categories:

```text
z[player, category] = (projected_usable_total - pool_mean) / pool_standard_deviation
```

For TO and PF:

```text
z[player, category] = (pool_mean - projected_usable_total) / pool_standard_deviation
```

The composite is:

```text
draft_score[player] = sum(weight[category] * z[player, category])
```

Weights remain positive after reversing TO and PF. Reversing both the z-score and the weight would incorrectly reward high turnovers or fouls.

Implementation requirements:

- Define the normalization pool from players expected to be rostered under the league's actual roster size and eligibility rules. Do not automatically use every NBA player or a generic 12-team pool.
- Record the normalization pool, projection version and weight preset used for a ranking.
- Keep the normalization baseline fixed during ordinary draft refreshes. Remove drafted players from availability without redefining the mean and standard deviation after every selection.
- Use projected usable season production, accounting for expected games and lineup opportunities. Do not multiply a completed composite z-score by games played.
- Model realistic replacement contributions for missed opportunities where league rules permit them. Do not assume every missed game can be replaced or count replacement production twice.
- Expose availability uncertainty separately from the production estimate; avoid duplicating the same expected missed-game penalty in multiple layers.
- Flag missing projections. Missing values must not silently become zero-production forecasts or inflated bargains.
- Handle zero-variance categories without division by zero, using a neutral standardized contribution and an explicit data-quality flag.
- Preserve a breakdown of every category's contribution to the composite so unusually large DD or TD contributions can be inspected.

Basketball Monster recommends total value with estimated replacement games. DraftKick also documents comparing category z-score values against replacement options. The specific replacement model must be adapted to this league's lineup, acquisition and game-limit rules. [Basketball Monster](https://basketballmonster.com/help.aspx), [DraftKick valuation](https://draftkick.com/guide/valuation/)

### 3.3 Percentages and ratios

Do not standardize a player's raw percentage or ratio as though every player contributes equal volume.

| Category | Numerator | Denominator |
|---|---|---|
| FG% | FGM | FGA |
| FT% | FTM | FTA |
| 3P% | 3PM | 3PA |
| A/TO | AST | TO |
| STR | STL | TO |
| PPM | PTS | MIN |

For an initial static ranking, a volume-aware contribution can be represented as:

```text
reference_ratio = sum(pool_numerators) / sum(pool_denominators)
player_impact = player_numerator - reference_ratio * player_denominator
ratio_z = (player_impact - mean_pool_impact) / standard_deviation_pool_impact
```

Use projected usable totals consistently. For shooting percentages this is equivalent to `(player_percentage - reference_percentage) * attempts` when attempts are positive.

For evaluating roster fit, recompute the actual team ratio from combined numerator and denominator totals with the candidate included. For replacement comparisons, subtract the reference player's totals before adding the candidate's. Do not average player percentages or ratios. A player with no attempts contributes no shooting impact; undefined ratios must not become infinite scores.

Although FGA, FTA, 3PA and MIN are not independently scored, they are necessary inputs to scored ratios. Total REB is not an extra category. FGM and PTS, and TO with A/TO and STR, remain separately credited because the league scores each of them.

Team-level ratio changes are also the correct inputs for a standings-gain model. [Ratio valuation methodology](https://www.smartfantasybaseball.com/2018/02/more-than-you-wanted-to-know-about-ratio-stats-and-standings-gain-points/)

## 4. Draft-night workflow and decision support

### Before draft day

- Load league rules, team identities, player IDs, eligibility and projections.
- Prepare the overall ranking, per-category breakdown, availability estimates and value tiers.
- Allow the user to inspect and adjust the proposed weights.
- Keep platform ranks or ADP separately from FNBA's valuation where that market data is available.
- Confirm that the selected ESPN season is the intended upcoming draft season. For example, NBA 2026–27 corresponds to ESPN season ID `2027`.

### When draft order is announced

- Import or allow entry of the confirmed order and identify the user's team.
- Calculate upcoming selections and the number of intervening picks.
- Use explicit pick slots when available, including any keeper or commissioner adjustments. Do not infer the entire order from an assumed team count if the source provides an authoritative order.

### During the draft

- The user watches ESPN and clicks Refresh draft in FNBA when selections have occurred.
- FNBA imports all selections available from the source, updates ownership, and refreshes the available-player board.
- Show the remaining players' stable overall scores alongside their contribution to the user's roster and position requirements.
- Highlight players falling below FNBA's valuation. Describe them as potential bargains according to the model; a rank difference alone does not prove that another manager made an error.
- Distinguish the confirmed roster's projected production from estimates that fill remaining roster slots. Do not present partial rosters as completed-team standings.
- Do not automatically change the user's fixed weight preset when another manager makes a selection. Roster-specific recommendations are a separate calculation.

For early selections, emphasize broad production and avoid concentrating the season on one or two players' health. As the roster develops, use the historical DREB/AST strengths and broad category coverage as checkpoints rather than rigid draft constraints. Among comparable players, assess fit, replacement options and the cost of waiting until the next turn.

The formula for a separate roster-fit score remains a design decision. The initial app can show candidate category impacts and needs without claiming that an unvalidated combined score is optimal.

## 5. Manual refresh requirements

| ID | Requirement |
|---|---|
| R1 | Provide one clearly visible Refresh draft action that requests the latest draft state and updates the board. |
| R2 | Import multiple selections made since the last refresh; the user must not need to refresh after every individual pick. |
| R3 | Match selections using stable ESPN player, team and pick identifiers wherever available. Flag unresolved identities instead of silently dropping selections. |
| R4 | Reconcile the full authoritative draft state, including corrected or reversed picks. Repeated refreshes must not duplicate selections. |
| R5 | Update availability, ownership, confirmed rosters and draft progress together from the same validated snapshot. |
| R6 | Recalculate all 19 team categories and candidate roster contributions from the refreshed state, including aggregate percentages and ratios. |
| R7 | Show the user's next confirmed turn and the number of intervening selections when the order is known. |
| R8 | Display the last successful check time, last confirmed pick and number of newly imported selections. A successful request alone must not be treated as proof that the source contains the latest visible ESPN pick. |
| R9 | Preserve the last valid board on authentication failure, network failure or malformed data. Make the stale state visible. |
| R10 | Prevent an older response from overwriting a newer snapshot if refresh requests overlap. |
| R11 | Provide a manual way to record and undo a drafted-player assignment when live synchronization is unavailable. Track manual changes and surface conflicts with later source data for reconciliation. |
| R12 | Reuse loaded player forecasts during draft refresh. Refreshing forecasts is a separate operation with its own timestamp and version. |
| R13 | Interpret unfilled future pick slots as future slots, not selected players. Validate source placeholders before assigning ownership. |
| R14 | Keep user weights, player notes, shortlist and last valid draft state recoverable across an app reload. |

Example status display:

> Synced through pick 27 · 3 new selections · 4 picks until your turn · Checked 8:42:16 pm

If the source cannot confirm a visible selection, the app should make that uncertainty actionable through a retry or manual assignment. The refresh operation updates FNBA; it should not require reloading the ESPN draft room after each pick.

The primary screen should make these elements easy to scan:

- Available players ordered by FNBA value, with category contributions and potential bargains visible.
- The user's roster, open positions and projected category coverage.
- Draft progress, the user's upcoming picks and synchronization status.
- A short recent-selection list so the user can check that the imported state matches ESPN.

Manual refresh is already an established product interaction: FantasyPros documents a Refresh button for forcing updates to its synced draft assistant. This is evidence for the workflow, not proof that FNBA's integration already works. [FantasyPros refresh workflow](https://support.fantasypros.com/hc/en-us/articles/115001356148-What-is-the-difference-between-the-Manual-Draft-Assistant-and-Draft-Assistant-w-Sync)

## 6. ESPN integration: evidence and verification

The live connection is the main unresolved technical dependency. Historical league reads and completed draft results do not establish that selections can be read during an active basketball draft.

Evidence examined during the discussion:

- The community `espn-api` project has an `mDraftDetail` request and basketball pick objects containing player and team information. Its base draft parser returns early when `draftDetail.drafted` is false. Simply calling the library's ordinary draft-fetch method is therefore not enough evidence of live support. [Request implementation](https://github.com/cwendt94/espn-api/blob/master/espn_api/requests/espn_requests.py), [base draft parser](https://github.com/cwendt94/espn-api/blob/master/espn_api/base_league.py)
- Public implementations make differing claims about reading active drafts directly. Football examples must not be treated as verified basketball behavior.
- FantasyPros documents that ESPN draft synchronization requires its browser extension and an open draft room. This establishes a practical integration precedent, but does not verify FNBA's implementation. [ESPN synchronization documentation](https://support.fantasypros.com/hc/en-us/articles/115001362368-How-do-I-sync-my-ESPN-draft-with-the-Draft-Assistant)

Proposed approach:

1. Keep the draft source behind an adapter so valuation and interface code do not depend on one transport.
2. Verify the data exposed during an active ESPN basketball draft. Prefer a direct read if it is demonstrated to provide timely and complete selections for this workflow.
3. Plan for a browser extension or browser-connected reader using the user's open ESPN draft room if a direct read is insufficient.
4. Make the same Refresh draft action consume a validated snapshot from either connection.
5. Retain manual pick assignment and reconciliation as the fallback.

The snapshot should identify the league and season, draft status, ordered pick slots, selected player IDs, owning team IDs, draft order where available, fetch time and source. Reconcile rosters from the selected picks rather than assuming that an ordinary roster endpoint updates immediately during the draft. Include keeper assignments when applicable.

No live basketball latency, completeness or authentication lifecycle has been measured yet. Validate the connection in an ESPN basketball mock draft before relying on it for the real league. A test must demonstrate that picks arrive while the draft is still in progress, not only after completion. Any differences between mock and league draft behavior require explicit follow-up verification.

## 7. Optional advanced valuation

### 7.1 Standings gain points

An alternative to discretionary fixed multipliers is to estimate how much statistical production historically gains one rotisserie point. Use all teams' results, not only champions.

For counting categories, let `d[c]` be the estimated statistical production per standings point and `sigma[c]` the player-pool standard deviation in the same production units. Then:

```text
effective_weight[c] = sigma[c] / d[c]
approximate_standings_value[player] = sum(effective_weight[c] * signed_z[player, c])
```

This replaces the discretionary fixed-weight scheme. Do not automatically stack both weighting schemes or multiply z-scores by `1 / d[c]` without accounting for their existing standardization.

For ratios, calculate the candidate's actual change to a projected completed team's ratio and divide that change by the historical step in the same ratio units. A numerator-impact z-score and a raw percentage standings step are not directly interchangeable.

Illustrative calculations from the discussion fitted raw team statistics against category rotisserie points separately for each season, took the absolute slope for inverse categories, and then took the median of the six annual slopes:

| Category | Approximate production per standings point |
|---|---:|
| DREB | 198 |
| AST | 232 |
| STL | 31 |
| BLK | 45 |
| PTS | 621 |

These are descriptive, rounded starting estimates. They have not been adjusted for all changes in league size, season length or roster usage, and are not production calibration values. Current player projections are needed to calculate numerical effective z-score weights.

Standings-gain valuation and estimating category slopes from historical standings are documented methods. [SGP slope methodology](https://www.smartfantasybaseball.com/2015/02/excel-tool-sgp-slope-calculator/)

### 7.2 Expected-standings draft simulation

A more advanced model can compare candidate picks by projecting completed rosters, simulating plausible seasons, awarding actual rotisserie points and estimating the gain over a realistic alternative.

Requirements for such an extension:

- Begin with actual selections and estimate realistic completions for every unfinished roster, respecting remaining availability and positional constraints.
- Allow opponents to follow platform rankings, observed preferences and other plausible policies. Do not assume they optimize using FNBA's weights.
- Model availability and production uncertainty while preserving related statistics within a simulated outcome. Derived ratios must use the simulated underlying totals.
- Award every category its actual equal scoring value, reverse TO and PF, and split ties. Team category scores must stay within the league's permitted range.
- Value DD and TD through plausible outcomes and achievable rank changes so excess production beyond a secure lead does not produce unlimited value.
- Re-run candidate comparisons when the confirmed draft state changes.
- Compare taking a player now against the alternatives likely to remain at the next turn. Treat survival probabilities as uncertain estimates.
- Keep expected total standings points distinct from championship probability. Optimizing one is not guaranteed to optimize the other.
- Examine downside scenarios in which any one of the user's first three selections misses substantial time.

In this model, effective category priorities depend on attainable gains. Extra production in a secure lead has little marginal value; a small improvement in a tightly grouped category may gain several points. A weak category deserves attention when it can realistically be improved with the players still available.

Research on rotisserie optimization motivates accounting for draft context, but does not validate this proposed implementation or the manual weight preset. [Optimizing for Rotisserie Fantasy Basketball](https://arxiv.org/abs/2501.00933)

## 8. Delivery priorities and acceptance criteria

Recommended delivery order:

1. Correct 19-category projections, configurable weighted z-scores and transparent contribution breakdowns.
2. Live available-player board with manual draft-state entry and undo.
3. ESPN manual-refresh integration using the same draft-state reconciliation.
4. Team category coverage, roster-fit comparisons and potential-bargain indicators.
5. Optional standings-gain calibration, next-turn availability estimates and simulation.

ESPN integration feasibility should be investigated early enough to inform the architecture; a full simulator must not block the core draft workflow.

The manual-refresh feature is ready for draft-night use when a basketball draft trial demonstrates:

- The draft order can be entered or imported shortly before the start without rebuilding player projections.
- Several intervening selections, including the user's own selections, are imported together and assigned correctly.
- Repeated refreshes are idempotent, corrections are reconciled and obsolete responses cannot overwrite newer state.
- Availability, ownership, roster projections and pick progress agree with the same imported snapshot.
- Team percentages and ratios are computed from totals, with TO and PF valued in the correct direction.
- The board retains the configured weights and fixed normalization baseline across ordinary refreshes.
- Missing players or projections are visible rather than silently omitted from ownership or treated as bargains.
- Source lag, failures and manual overrides have understandable recovery paths.
- Refresh and recalculation timings are measured under draft-like conditions and fit the league's pick clock. The acceptable latency budget remains to be set once that clock is known.

These are acceptance requirements, not claims that tests or live verification have already passed.

## 9. Inputs and decisions still needed

- Upcoming-season team count, roster size, active slots, bench and injured-reserve rules, and ESPN eligibility.
- Games-played caps, lineup frequency and acquisition restrictions needed to model usable production and replacement opportunities.
- Keeper or draft-order exceptions, pick clock and the user's team identifier.
- Projection provider and complete support for all 19 categories and required denominators, including DD and TD forecasts.
- The projection uncertainty and replacement models, without relying on historical final standings as a substitute for projection-error data.
- Validation and user configuration of the proposed fixed-weight preset, with an equal-weight comparison available.
- The verified live basketball data source, browser setup, authentication lifecycle and refresh latency.
- How roster fit and next-turn alternatives are presented alongside the stable player ranking.

The design should preserve a clear distinction between confirmed draft facts, projected player performance, estimated completed rosters and recommendations derived from those estimates.
