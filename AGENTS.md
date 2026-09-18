# FNBA

Product source of truth: [`docs/context/product-vision.md`](docs/context/product-vision.md). Read it before product, scoring, ranking, or draft-strategy work. Do not store product vision in Grok memory; this repo is the durable copy. Docs layout: [`docs/README.md`](docs/README.md).

## North star

Draft a winning team on draft night for a once-a-year 19-category rotisserie fantasy basketball league. Draft night is the season.

## Hard constraints

- Optimize for **this league's scored categories**, not generic points or 9-cat rankings.
- Do not build strategies that only work if a top-3 pick stays healthy.
- Do not rank or draft as if PTS/PPM are the product. Points-only indexing has already failed a season.
- Do not treat triple-doubles (or double-doubles) as the spine of player value. TD actuals have already missed projections badly.
- Inverse cats in this league: TO, PF (lower is better). Total REB is not scored; OREB and DREB are.

## Agent conventions

- Shared skills live only in `.agents/skills/<name>/`; edit that canonical directory from every harness. `.claude/skills/<name>` entries are relative symlinks, never independent copies. Do not create parallel definitions in `.grok/skills/` or `.codex/skills/`.
- Before creating, editing, or moving a skill, read [`docs/architecture/shared-skills.md`](docs/architecture/shared-skills.md). Run `python3 scripts/check_shared_skills.py` before committing skill or harness-instruction changes.
- `Use spec-it: <feedback>` selects the shared `spec-it` workflow. Native invocation is `/spec-it` in Grok/Claude and `$spec-it` in Codex CLI/IDE. Read its `SKILL.md` before executing; it writes gitignored plans to `docs/tmp/` and stops without implementation.
- `Use send-it: <plan path>` selects the shared `send-it` workflow. Native invocation is `/send-it` in Grok/Claude and `$send-it` in Codex CLI/IDE. Read its `SKILL.md` before executing; it implements actioned rows from a spec-it plan via worktree-isolated subagents and serial cherry-pick. There is no `/ship-it` skill; the plan producer is `/spec-it`. Treat `/built-it` as `/send-it`.
- Keep `CLAUDE.md` as an import of this file so Claude receives the same project rules. Keep shared workflow requirements out of personal memory and vendor-specific instruction copies.
- Keep product facts in `docs/context/`; keep architecture notes in `docs/architecture/`; keep agent rules in this file. Link instead of copying long docs here.
- Parallel feature work uses git worktrees via `fnba-cli wt` / `fnba-cli wt-remove` (`bin/fnba-cli`). One git-mutating session per worktree. See [`docs/architecture/worktrees.md`](docs/architecture/worktrees.md).
