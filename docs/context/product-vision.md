# FNBA product vision

Source of truth for what this product is for. Agents must treat this file as canonical for product, scoring, ranking, and draft-strategy work. Do not put this in Grok memory; keep it versioned in the repo.

## What FNBA is

FNBA is a fantasy basketball app. Its **primary objective** is to draft a winning team on draft night for the owner's fantasy basketball competition.

That competition happens **once a year**. Draft night is the highest-leverage moment of the season: it is when the roster that has to win the league is assembled.

## Success

A successful season is a roster that competes to win **this** league's rotisserie board, not a roster that looks good in points-only rankings or in a generic 9-cat build.

## Scoring

League scoring type: **Rotisserie**.

19 categories are selected. Source screenshot: [`docs/context/league-scoring-categories.png`](league-scoring-categories.png).

Categories marked `*` are inverse in typical rotisserie (lower is better).

| Abbr | Category | In scoring |
|------|----------|------------|
| FGM | Field Goals Made | yes |
| FG% | Field Goal Percentage | yes |
| FTM | Free Throws Made | yes |
| FT% | Free Throw Percentage | yes |
| 3PM | Three Pointers Made | yes |
| 3P% | Three Point Percentage | yes |
| OREB | Offensive Rebounds | yes |
| DREB | Defensive Rebounds | yes |
| AST | Assists | yes |
| A/TO | Assists To Turnover Ratio | yes |
| STL | Steals | yes |
| STR | Steals To Turnover Ratio | yes |
| BLK | Blocks | yes |
| TO | Turnovers* | yes |
| PF | Personal Fouls* | yes |
| DD | Double Doubles | yes |
| TD | Triple Doubles | yes |
| PTS | Points | yes |
| PPM | Points Per Minute | yes |

Not in scoring (do not optimize for these unless they are an input to a scored category): GP, GS, MIN, FGA, FGMI, AFG%, FTA, FTMI, 3PA, 3PMI, REB (total — OREB and DREB are scored separately), EJ, FF, TF, DQ, QD, TW.

## Lessons from prior drafts

These are product constraints, not anecdotes. Final rotisserie standings for this league (2021–2026): [`historical-winners.md`](historical-winners.md).

1. **Injury concentration.** Historically, a ruined season is usually a top-3 draft pick injured for most of the year. Do not build a plan that only works if the first three picks stay healthy. Surface injury risk and avoid concentrating the season on one or two stars.

2. **Points-only index fails this league.** A prior season heavily indexed on points and lost because supporting categories were empty. PTS and PPM are two of nineteen cats. Rankings, projections, and draft boards must be **category-balanced** across the scored set, not points-led.

3. **Triple-doubles are high variance.** A prior season heavily indexed on TD producers; actual TDs came in far below projections. TD is a scored category, but it must not dominate player value. Treat TD (and similarly sparse counting stats like DD) as upside, not as the spine of the build.

## Product implications

- The core job to be done is **draft-night decision support**, not year-round engagement for its own sake.
- Default views, models, and recommendations should answer: "Does this pick help me win this 19-cat rotisserie board?"
- Prefer balanced category coverage and durability over peak counting-stat upside.
- When a feature, ranking, or model weights PTS/TD/DD without the rest of the scored set, it is wrong for this product.
