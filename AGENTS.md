# FNBA

Product source of truth: [`docs/product-vision.md`](docs/product-vision.md). Read it before product, scoring, ranking, or draft-strategy work. Do not store product vision in Grok memory; this repo is the durable copy.

## North star

Draft a winning team on draft night for a once-a-year 19-category rotisserie fantasy basketball league. Draft night is the season.

## Hard constraints

- Optimize for **this league's scored categories**, not generic points or 9-cat rankings.
- Do not build strategies that only work if a top-3 pick stays healthy.
- Do not rank or draft as if PTS/PPM are the product. Points-only indexing has already failed a season.
- Do not treat triple-doubles (or double-doubles) as the spine of player value. TD actuals have already missed projections badly.
- Inverse cats in this league: TO, PF (lower is better). Total REB is not scored; OREB and DREB are.

## Agent conventions

- Skills live in `.grok/skills/`. `/feedback-plan` writes gitignored plans to `docs/tmp/`.
- Keep product facts in `docs/`; keep agent rules in this file. Link instead of copying long docs here.
