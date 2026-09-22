---
name: send-it
description: >
  Execute a spec-it plan by dispatching worktree-isolated implementer
  subagents in parallel, then merging each row's commit serially via
  cherry-pick, with one bounded retry on stale-base conflicts. Reads the
  plan file `/spec-it` writes (typically `docs/tmp/*.md`). Use when the
  user runs /send-it, $send-it, or Use send-it:; also /built-it,
  $built-it, or Use built-it:; asks to orchestrate or implement a
  spec-it plan; or to execute the file created by spec-it or ship-it.
  Discussing or editing this skill is not a request to implement.
---

# Send-it

You are the **orchestrator**. Work through every dispatchable row in the spec-it plan named by the invocation. The execution model:

1. Dispatch up to `concurrency_cap` (default 5) implementer subagents **in parallel**. Each runs in its own isolated git worktree and produces exactly one commit on that worktree's branch.
2. After the batch returns, **merge serially** by cherry-picking each commit onto the orchestrator's branch in tracking-table order.
3. **Self-heal** stale-base cherry-pick conflicts by re-dispatching the row in a fresh worktree forked from current HEAD. One retry per row.

You never implement a code row yourself. Instruction meta-doc rows (every declared path is under `.agents/` or `.claude/`, or is `AGENTS.md` / `CLAUDE.md`) take the §2.3b direct-apply path.

This repository has no `/ship-it` skill. The plan producer is `/spec-it`. If the user says the seed was created by `/ship-it`, treat the given path as a spec-it plan.

The checkpoint depends on whether the seed is **durable** (tracked by git) or **ephemeral** (`docs/tmp/`, gitignored):

- **Durable** — checkpoint is a `Refs: send-it row <id> of <doc-basename>` trailer on each feature commit (`<id>` is the tracking `#` cell, e.g. `R2`). Resume greps `git log`. Cherry-pick preserves the trailer.
- **Ephemeral** — checkpoint is the `Commit` cell in the doc's `## Tracking` table, written after each successful cherry-pick. No trailer. Resume re-reads the cells.

Do not implement merely because this file was discussed or edited.

## Harness operations

Follow `AGENTS.md`. Map these operations to the current harness; if a required capability is missing, STOP and say what is blocked.

| Operation | Do this |
|---|---|
| Dispatch a code row | Spawn a **general-purpose** child with **worktree isolation**. One spawn per row. Grok: `spawn_subagent` with `isolation: "worktree"`. Claude: Agent/Task with `isolation: "worktree"`. Codex: explicitly spawn an isolated-worktree child (do not wait for auto-delegation). |
| Wait | Collect every child in the batch before merging. Grok may `get_command_or_subagent_output`. Never `sleep` / `until` / `pgrep` poll loops. |
| Ask the user | Harness question tool if available (recommended option first); otherwise ask in chat and wait. Nested (no question tool): halt with a `DECISION NEEDED` block. Elapsed time is not an answer. |
| Merge | `git cherry-pick <verified-sha>` only. Do not `grok worktree apply`, fast-forward, merge, rebase, or squash. |
| Remove an isolation worktree | Only the path the spawn tool returned. Grok: `grok worktree rm --force <path>`. Otherwise: `git worktree remove --force <path>` then `git branch -D <that-branch>`. Never `fnba-cli wt-remove` (that CLI owns human `fnba-drafter-worktrees/` checkouts). Never enumerate `git worktree list` to pick cleanup targets. |

If worktree isolation cannot be created for a code row, STOP. Do not implement that row on the orchestrator branch.

---

## Phase 0 — Read and classify

1. Resolve the seed path from native arguments, the token after `Use send-it:` or `Use built-it:`, a file path in the current message, or a spec-it plan path already stated in this conversation. A token is a file when it exists (repo-relative or absolute). Read the complete file. If it is missing, check `docs/tmp/done/<basename>`: if present, the run already completed — report that path and stop. Otherwise stop and ask for the spec-it plan path. Do not guess the latest `docs/tmp/` file.
2. Confirm `git status` is clean. If not, stop — uncommitted work would entangle with orchestrator commits.
3. Record `git stash list` output (Phase 2 pre-flight tripwire) and `git rev-parse HEAD` (Phase 3 range).
4. Classify `seed_doc_kind`: any `/docs/tmp/` segment in the resolved path → `ephemeral`; else `durable`.
5. Detect shape:
   - **Tracking table** present (a column named `Commit`) → skip to Phase 2.
   - **spec-it plan** — H1 starts with `# Feedback plan:` and a `## Requirements index` exists → Phase 1.
   - Else ask which rows to ship before proceeding.
6. Read YAML frontmatter if present: `concurrency` (int, default 5, clamp `[1, 10]`); `serial: true` forces `concurrency_cap = 1`. Record `concurrency_cap`.

---

## Phase 1 — Bootstrap (no tracking table)

1. **Enumerate dispatchable rows** from the Requirements index. Only `Decision: actioned` becomes a row. `rejected` is excluded. `informative` is excluded from the table but copied into every worker prompt as still in force. Merge obvious duplicates; do not drop actioned rows.

   `#` is the spec-it id (`R2`, …). `Item` is the index restatement. `File(s)` is the index proposed-files cell; if that cell is `—`, read the requirement's Proposed tech-plan for paths. An actioned row with no files after that → ask before dispatch. `DoD` is the tech-plan's test/verification command if named; otherwise derive from §DoD discovery. Empty `Commit`.

2. **Dependencies and overlap.** If a tech-plan names another actioned id, copy that into `Depends on`. If two actioned rows share a proposed file or a parent directory, the later index row `Depends on` the earlier. Omit the column when every row is independent.

3. **Priority.** Dependencies first, shared/canonical work before fan-out, whole-feature verification last. Instruction meta-doc rows sort after code rows that they document.

4. **Announce and proceed.** One paragraph: items, order, merges, overlap-derived dependencies. Do not pause for confirmation. Invocation authorizes implementing actioned rows once the contract is unambiguous. Ask only when a blocking choice would change files or behavior.

5. **Write the seed into the doc** (do not commit it):

   a. Prepend frontmatter if missing, or add the keys if absent:

      ```yaml
      ---
      concurrency: 5
      serial: false
      ---
      ```

   b. Append, without rewriting existing spec-it sections:

      ```markdown
      ## Tracking

      | # | Item | File(s) | DoD | Commit | Evidence |
      |---|------|---------|-----|--------|----------|
      | R2 | … | `path` | `python3 scripts/check_shared_skills.py` | | |

      ## Execution protocol

      `send-it` dispatches up to `concurrency_cap` worktree-isolated implementers per batch, then cherry-picks in table order. One auto-heal retry per stale-base conflict. Ephemeral checkpoint = Commit cell (no trailer). Durable checkpoint = `Refs: send-it row <id> of <doc-basename>` trailer. Meta-doc rows apply on the orchestrator branch. Phase 3 writes `Evidence` after UAT. Images stay under gitignored `docs/tmp/uat/`. Do not commit this file or the images.
      ```

      Include `Depends on` and/or `Parallel-safe` columns when step 2 produced any. `Parallel-safe` is `false` only when the row must run alone even with no file overlap; default `true` if the column is absent.

      `Evidence` stays empty at bootstrap. Phase 3 fills it. On resume, if `## Tracking` has no `Evidence` column, add that column before Browser UAT without changing other cells.

---

## Phase 2 — Main loop

Stop when every tracking row is done: durable → matching trailer on HEAD ancestry; ephemeral → every `Commit` cell is a short SHA, `noop-via-<id>`, or `noop`.

Each iteration is a **batch**: pick up to `concurrency_cap` eligible rows, dispatch in parallel, merge serially.

### 2.1 Pre-flight (every batch)

All three must hold on the orchestrator branch:

1. Clean `git status`.
2. `git stash list` equals the Phase 0 baseline. Drift → STOP.
3. `HEAD` is either the starting commit or a feature commit from this run.
   - Durable: `git show -s --format=%B HEAD` contains `Refs: send-it row <id> of <doc-basename>`. Missing on a post-start HEAD → STOP.
   - Ephemeral: HEAD must **not** carry a `Refs: send-it row` trailer. The short SHA of HEAD must appear in some row's `Commit` cell; unclaimed SHA → STOP (merge landed, cell write did not).

Then `batch_base_sha = git rev-parse HEAD`.

### 2.2 Pick the next batch

Re-read the doc. Done rows: durable → grep trailers; ephemeral → non-empty `Commit` cell.

```
git log HEAD --format='COMMIT %h%n%B' | \
  awk '/^COMMIT / { sha=$2; next } { print sha, $0 }' | \
  grep -E '^[a-f0-9]+ Refs: send-it row ' | \
  grep -F -- 'of <doc-basename>'
```

Pick up to `concurrency_cap` not-done rows in table order.

**Depends on.** A row is eligible only when every named id is done. Skip it this batch; do not drop it. Ambiguous informal dependency → dispatch that row alone after every row above it is done.

**Parallel-safe: false.** Walk in order. If the next row is unsafe and the batch is non-empty, flush; if the batch is empty, dispatch it alone. Never skip an unsafe row to fill the cap.

**Meta-doc routing.** A path is meta-doc when it is under `.agents/` or `.claude/`, or its basename is `AGENTS.md` or `CLAUDE.md`. If **every** declared path is meta-doc → §2.3b, never a worktree. Mixed meta-doc + code paths → STOP and ask the user to split the row.

If `concurrency_cap == 1`, every batch is one row.

### 2.3 Dispatch (parallel)

One parent message containing one spawn per batch row.

- Type: `general-purpose`. Isolation: `worktree` (required).
- Description: `[implementer] row <N>: <short item>`.
- Prompt must be self-contained and include:

  - Absolute seed path, basename, row id, item, `seed_doc_kind`, `batch_base_sha`.
  - "You are in an isolated git worktree. Commit on this worktree's branch. Do not push, switch branches, merge, rebase, amend, or touch anything outside this worktree. Return: short SHA, branch name, worktree path, one-line summary."
  - Read the tracking row, the matching `## R<n>:` section, `AGENTS.md`, and this skill. For product, scoring, ranking, or draft-strategy rows, read `docs/context/product-vision.md` first.
  - Informative constraints from the plan, listed as still in force.
  - **Ambiguity:** no question tool. If implementation cannot proceed from the plan and codebase, make no commit; return a self-contained `DECISION NEEDED` block (file:line facts, options, consequences, recommendation). Never refer to "the file above".
  - **Scope:** declared `File(s)` plus co-located test companions of those production files (see §Scope). Touching any other file → no commit, `DECISION NEEDED`.
  - **Tests-as-oracle:** for new behavior, bug fixes, CLI/API contracts, or scoring math, a spec-derived failing test (or failing reproduction) must be observed before the production edit. Docs, comments, ignore rules, and skill prose: test-first N/A. Do not invent `rspec` / `vitest` / `npm` until those tools exist in the worktree. A red from missing imports or an empty suite is not a valid red. Do not weaken tests, add skips, or shrink coverage to go green.
  - **DoD:** the row's DoD cell must exit 0 inside the worktree. Also run §DoD discovery shell commands that apply to the touched files. Do not run browser UAT, do not write `docs/tmp/uat/`, and do not edit the seed. The orchestrator captures evidence in Phase 3 against this checkout's `bin/dev`.
  - Conventional commit; one item; no `--no-verify`; no co-author/trailer attribution lines.
  - Trailer: durable → body ends with a blank line then exactly `Refs: send-it row <id> of <doc-basename>` (`<id>` = tracking `#` cell). Ephemeral → no `Refs: send-it row` line.
  - The **Commit-message hygiene** and **Git safety** blocks below, verbatim.

**Collecting.** Top-level: wait until every row returned, then §2.4. Nested (child completion goes to the caller, not you): after the spawn calls, end the turn with only:

```
BATCH DISPATCHED
rows: <ids>
batch_base_sha: <sha>
resume_at: §2.4
```

Resume at `resume_at` when results arrive; re-emit the block for still-missing rows.

#### Commit-message hygiene (transcribe into every dispatch prompt)

Messages must make sense from `git log` alone, without the tracking doc.

Forbidden in the subject: requirement-id suffixes like `(R2)`, `(row 3)`.

Forbidden in the body: seed-doc filename or path; other spec-it / tmp paths; row numbers; requirement ids (`R2`) except inside a durable `Refs:` trailer.

Required in the body when a body is warranted: cite code (path:line, helpers, the invariant). If the why cannot be stated without naming the tracking doc, omit the body.

The durable `Refs:` trailer is the only allowed doc reference.

#### Git safety (transcribe into every dispatch prompt)

Forbidden: `git stash` (any); `git checkout --` / `git restore <file>` (working tree); `git reset`; `git clean -f`; `git commit --amend` / `--no-verify`; `git push`; `git rebase` / `merge` / `cherry-pick`; switching branches.

Allowed: read-only git; `git add <specific files>`; `git commit -m …`; `git restore --staged <file>` for the worker's own mistaken stage.

If a forbidden command seems necessary, abort with a summary instead.

### 2.3b Direct-apply (meta-doc rows)

Apply on the orchestrator branch, one conventional commit per row (`docs(skills):` / `docs(agents):`). Hygiene and trailer rules unchanged.

1. Probe with one edit first. If it lands, finish the row and commit.
2. If the probe is denied, revert the row to byte-identical pre-row state. Once per run, ask "Authorize direct apply of rows \<list\>?" (Authorize all recommended). On yes, retry. Do not switch tools after a denial.
3. Denied again, or declined/timed out: mark the row held, leave `Commit` empty, continue other rows, report in Phase 3. Timeout is not consent.

### 2.4 Collect and merge (serial, table order)

**Row-work failure.** No SHA (red tests, DoD missed, `DECISION NEEDED`) → STOP. Report the row, the summary, and remaining un-merged worktrees in this batch (do not auto-clean those). Do not cherry-pick this row or later rows in the batch. Earlier successful cherry-picks stay.

**Worktree-skip with valid state.** Isolation was requested but no child worktree exists, and the reported SHA is already on the orchestrator branch inside `batch_base_sha..HEAD`. All three must hold: reported path is the orchestrator tree or missing; `git rev-parse <sha>^{commit}` works; `git rev-list batch_base_sha..HEAD` contains the SHA. Then set `worktree_skipped`, treat the orchestrator tree as the worktree, use `<sha>^..<sha>` for count/diff, skip cherry-pick and cleanup, still do step 8. Integrity failures still STOP. Residual non-companion scope delta still goes through step 3's prompt; Reject must `git reset --hard <sha>^` first.

1. **SHA.** `git -C <worktree-path> rev-parse HEAD` equals the reported SHA (or, if skipped, the SHA is reachable as above). Else STOP.
2. **Count.** `git -C <worktree-path> rev-list --count <batch_base_sha>..HEAD` equals `1`. `> 1` → STOP (cherry-pick would drop non-tip commits).
3. **Scope.** `git -C <worktree-path> diff --name-only <batch_base_sha>..HEAD` versus declared `File(s)`. A declared path matches that file or files under it. Co-located test companions of declared production files are in-scope (see §Scope). If a non-companion delta remains, ask: Accept and cherry-pick (recommended) / Reject and re-dispatch (counts as the one retry) / Inspect (STOP, leave worktree). Nested: `DECISION NEEDED` with the same options.
4. **Message.** Durable: exact trailer line present, else STOP. Ephemeral: any `Refs: send-it row` line → STOP. Hygiene violation → auto-heal in the worktree: strip `(R\d+)` subject suffixes and body lines that name the doc basename, `row N`, or requirement ids outside a `Refs:` trailer; `git commit --amend -m`; re-check count == 1. Still dirty after strip → STOP. Trailer-state errors are never stripped.
5. **Cherry-pick** (skip if `worktree_skipped`): `git cherry-pick <verified-sha>` (no `-x`).
6. **Conflict → auto-heal.** `git cherry-pick --abort`. Cleanup that worktree (operations table). If this row already retried once → STOP (semantic conflict): report files and remaining batch worktrees. Else `retry_base_sha = git rev-parse HEAD`, dispatch one fresh worktree from current HEAD, re-verify using `retry_base_sha` in place of `batch_base_sha`, cherry-pick. Second conflict → STOP. If the retry reports no diff: write `noop-via-<id>` (or `noop`), cleanup, continue — no empty commit.
7. **Post-merge.** Durable: nothing (trailer is the checkpoint). Ephemeral: write the short SHA into that row's `Commit` cell. Do not commit the doc.
8. **Cleanup** the merged (or retry) worktree unless `worktree_skipped`. Failures are logged; continue.
9. Re-check stash baseline. Drift → STOP.

Then next batch at §2.1.

### 2.5 Non-negotiables

- Code rows: worktree isolation. Meta-doc rows: §2.3b. Orchestrator stays on its branch.
- Cherry-pick is the only merge primitive.
- Cleanup only spawn-returned paths.
- One auto-heal retry per row. Cleanup failure is non-fatal.
- No squash, rebase, amend, push, or PR from this skill.
- No branch switching.

---

## Phase 3 — Completion

1. **Durable only:** fill each `Commit` cell from the trailer grep. Ephemeral cells are already filled.
2. **Feature DoD.** If the plan names whole-feature verification commands, run those. Else from `git diff --name-only <starting-head>..HEAD` run the shell rows of §DoD discovery on the union. The UI row is not a shell command. Record skipped checks (tool missing) as blocked, not passed.
3. **Browser UAT** (below). This is the UI check. Do not fold it back into step 2.
4. **Report:** rows shipped and commit range; auto-healed; no-ops; `worktree_skipped`; meta-doc applied vs held; archive path or "left in place — git-tracked"; informative/rejected rows not dispatched; any open holds; each tracking id and its `Evidence` cell. Do not claim the user accepted the work. A blocked UAT is a blocked run, not a pass with a footnote.
5. Set the spec-it header `Status` to `send-it complete` only when the Browser UAT halt condition passed. Otherwise `send-it blocked`. Do not rewrite Original input, decisions, or proposed solutions.
6. **Archive ephemeral only**, last, and only after `send-it complete`: `mkdir -p docs/tmp/done && mv <path> docs/tmp/done/<basename>`. If the destination exists, do not clobber — report and leave the source. Move only the markdown. Do not move or delete `docs/tmp/uat/`. Durable docs stay put. A blocked UAT does not archive.
7. Do not push, open a PR, squash, or rebase.

### Browser UAT

If `## Tracking` has no `Evidence` column, add it before this step without changing other cells.

Halt this step only when every `Evidence` cell is `n/a`, or a comma-separated list of existing non-empty repo-relative paths that includes both `<id>.png` and `<id>.gif`, and no cell contains `fail:`. A `fail:` cell, a missing browser tool, a missing `ffmpeg`, or a dev server owned by another checkout stops the run. Set `send-it blocked`. Do not archive. Leave the images in place.

Skip a row whose `Evidence` already lists a non-empty `<id>.png` and `<id>.gif` and does not contain `fail:`. Re-run rows whose cell is empty or contains `fail:`, and overwrite that requirement's files in the same directory.

A row is browser-observable when either:

- a declared path matches `frontend/src/**/*.{tsx,jsx,css,scss}` and is not `*.test.*` or `*.spec.*`, or
- that requirement's Proposed solution or DoD tells the agent to open the app.

Otherwise write `n/a`. That includes `noop` and `noop-via-<id>` commits, backend-only rows, and skill-prose rows. If those two tests disagree, STOP with `DECISION NEEDED`. Do not screenshot the homepage as a stand-in.

**Server gate**, before any capture. The page is `http://localhost:5173` (the URL `bin/dev` prints). Vite proxies `/api` to `127.0.0.1:3000`.

- Confirm both listeners' cwds are inside the orchestrator worktree (`lsof -nP -iTCP:5173 -sTCP:LISTEN` and the same for 3000, then `lsof -a -p <pid> -d cwd`).
- If both ports are free, start `bin/dev` from the orchestrator root, wait until both accept, and kill only that process group when UAT ends.
- If either port is held by another checkout, STOP. Do not capture that app. Do not pick another port (`docs/architecture/worktrees.md`: one `bin/dev` on 3000/5173).
- If a port is already this worktree's `bin/dev`, reuse it. Do not start a second one. Do not kill a server this run did not start.

**Tools.** Use the harness browser that can open the page, click, type, resize, and save a PNG to an absolute path. On Grok that is chrome-devtools `take_screenshot` with `format: png` and `filePath`. If the tool returns only its own path, copy the file into place. If no harness tool can drive the page and write a PNG, STOP blocked. Do not substitute curl or a unit test. GIF is not a browser feature: `command -v ffmpeg` must succeed. If it does not, STOP blocked. Do not add a package.

**Per browser-observable row**, in table order:

1. Read `## <id>:` Proposed solution for the route and the interaction. Find other routes by reading the frontend router for pages that import a declared UI file.
2. Desktop viewport 1280×800. Perform the interaction (click, type, navigate). A single untouched render is not a pass. Then open each other route far enough to see the shared control.
3. Save the settled desktop shot to `docs/tmp/uat/<seed-basename-without-.md>/<id>.png`. The file must be non-empty.
4. During that interaction, save at least two ordered frames under `docs/tmp/uat/<dir>/frames-<id>/`: `frame-01.png` before the action, one frame after each meaningful step, and a last frame of the settled state. Encode, then delete the frames directory only after the GIF exists and is non-empty:

   ```sh
   ffmpeg -y -framerate 2 -i "docs/tmp/uat/<dir>/frames-<id>/frame-%02d.png" -loop 0 "docs/tmp/uat/<dir>/<id>.gif"
   ```

5. Layout or styling (a declared `.css` or `.scss` file, or the Proposed solution says layout, spacing, or responsive): repeat steps 2–4 at 375×812 as `<id>-narrow.png` and `<id>-narrow.gif`.
6. On success, set `Evidence` to the repo-relative paths in backticks, comma-space separated. A bare file name collides across plans. Example: `` `docs/tmp/uat/20260922_141910_custom-z-score-weight-collections/R4.png`, `docs/tmp/uat/20260922_141910_custom-z-score-weight-collections/R4.gif` ``
7. On a behavior miss, still save the PNG and GIF of what happened (of the broken route when that is the failure), set `Evidence` to those paths plus ` fail: <one line>`, and stop the UAT loop. Do not implement a fix.

Write `n/a` for every other row in the same pass so a finished table has no empty `Evidence` cell. Do not `git add` the images. Do not commit the seed. Do not rewrite requirement sections.

---

## DoD discovery

Discover from the **current worktree**. Do not invent runners.

| Touched paths | Command |
|---|---|
| `.agents/`, `.claude/`, `AGENTS.md`, `CLAUDE.md`, `scripts/check_shared_skills.py` | `python3 scripts/check_shared_skills.py` |
| `backend/**/*.rb`, `backend/.rubocop.yml`, `backend/lib/rubocop/` | `(cd backend && bin/rubocop)` |
| `bin/`, `scripts/test_fnba_cli.py` | `python3 scripts/test_fnba_cli.py` |
| Named test/DoD command in the row | that command, from the worktree |
| `frontend/src/**/*.{tsx,jsx,css,scss}` excluding `*.test.*` / `*.spec.*` | No shell command. Phase 3 Browser UAT is the check. Implementers do not run it. |
| None of the above | inspection of declared files; say so |

A missing required runner blocks the row; it does not pass with a footnote. Feature DoD runs shell commands from this table only. The UI row is Phase 3 Browser UAT.

## Scope

Declared production file `dir/X.py` also in-scope: `dir/test_X.py`, `dir/X_test.py`, `tests/test_X.py`. `dir/X.ts(x)` → `dir/X.test.ts(x)`, `dir/X.spec.ts(x)`. Future `app/X.rb` → `spec/X_spec.rb`. Shared contracts (`*.types.ts`, global fixtures) are **not** companions.

---

## Failure handling

| Class | Response |
|---|---|
| First cherry-pick conflict | Auto-heal: abort, cleanup, re-dispatch from current HEAD, one retry |
| Retry still conflicts | STOP. Semantic conflict |
| Retry produced no diff | `noop-via-<id>` / `noop`; no commit |
| No SHA / tests stayed red / `DECISION NEEDED` | STOP. Report; leave remaining batch worktrees |
| Count `> 1` | STOP. Do not auto-heal |
| Worktree-skip, integrity green | Auto-heal: skip cherry-pick and cleanup; still checkpoint |
| Commit landed neither in the child worktree nor on this branch as the single skip SHA | STOP. Corruption |
| Wrong trailer state | STOP |
| Hygiene tokens in message | Auto-heal strip + amend in the worktree; STOP if still dirty |
| Non-companion scope delta | Ask Accept / Reject+retry / Inspect |
| Meta-doc denied after authorization | Revert row; hold; report |
| Mixed meta-doc + code row | STOP at routing; ask to split |
| Cleanup failed | Log; continue |
| Stash drifted | STOP |
| Crash mid-batch | Resume by re-invoking; do not prune stranded worktrees |
| Ephemeral crash between cherry-pick and cell write | Pre-flight unclaimed SHA → STOP |
| Dev server owned by another checkout | STOP. `send-it blocked`. Do not capture. Keep images. Do not archive |
| No browser tool that can drive the page and write a PNG | STOP. `send-it blocked`. Keep images. Do not archive |
| `ffmpeg` missing | STOP. `send-it blocked`. Keep images. Do not archive |
| UAT behavior miss | STOP. `send-it blocked`. Keep the failure PNG and GIF. Do not archive |

Auto-heal is only: stale-base conflict, hygiene strip, worktree-skip with valid state. Everything else STOPs. Report accurately; repair is a user decision.

---

## Resume

Fresh session, same branch: `/send-it <same path>` (or `/built-it`). Phase 0 re-classifies; existing tracking skips bootstrap. Durable: trailers decide done rows; starting HEAD is the parent of the first trailer. Ephemeral: empty `Commit` cells are remaining; starting HEAD is the parent of the latest recorded SHA.

Commits filled, `Evidence` missing or containing `fail:`: do not re-dispatch those rows. Re-enter Phase 3 Browser UAT and overwrite that requirement's PNG and GIF under `docs/tmp/uat/<seed-basename>/`.

Stranded isolation worktrees are not auto-removed. Remove only a path you have inspected, with the harness remove command in the operations table.

Ephemeral path missing: completed runs live at `docs/tmp/done/<basename>`. Durable missing: restore from git then resume.

---

## Kickoff

Read the seed path, run Phase 0, proceed. Ambiguous shape → ask (or `DECISION NEEDED` if nested). Nested child spawns end the turn with `BATCH DISPATCHED`.
