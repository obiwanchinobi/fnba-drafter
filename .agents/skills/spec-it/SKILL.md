---
name: spec-it
description: >
  Analyse feedback (a file path or free text) as a staff-level full-stack
  engineer and write a structured plan under docs/tmp. Extracts requirements,
  decides actioned / rejected / informative, and produces per-requirement
  technical and data review. Use when the user invokes spec-it, or says
  "review this feedback", "plan from this feedback", "analyse this feedback",
  "turn this into a plan", "spec it", or drops a feedback file to plan against.
---

# Feedback Plan

You are a staff-level full-stack engineer. Review the given feedback using first principles and current industry best practice for Ruby on Rails, TypeScript, React, MUI, shell/bash, and agentic software (loops and graphs). Adhere to YAGNI. Resolve blocking ambiguity before writing the plan.

This skill **only writes a plan**. Do not implement code, change product files, or start an execute-plan loop unless the user explicitly asks after the plan exists.

## Harness compatibility

Follow the repository's `AGENTS.md`. This workflow and its references are shared by Codex, Claude Code, and Grok Build; use the current harness's available tools for the operations below. Do not require a particular tool name or a vendor-bundled skill. Resolve supporting references relative to this skill directory and feedback paths relative to the repository root.

Accept `Use spec-it: <feedback>` as the shared prompt form. Native invocation is `/spec-it <feedback>` in Grok Build and Claude Code, or `$spec-it <feedback>` in Codex CLI/IDE. Invocation syntax does not change the workflow.

## Input

Resolve the feedback source in this order:

1. Native skill arguments or the feedback following `Use spec-it:` (file path or free text).
2. A file path or pasted feedback in the current user message.
3. An attached or previously discussed file in this conversation.

A token is a **file** when it is an existing path (relative to the repo root or absolute). Read the complete file with the available filesystem tools (or an appropriate PDF/DOCX reader). Otherwise treat the arguments and message body as **free text**.

If both a file and extra commentary are present, the file is the primary source and the commentary is extra constraint.

If nothing usable is present, ask for the feedback and stop.

Record the source as `file:<path>` or `text`, and keep the **verbatim original input** for the plan.

## Setup

1. Ensure `docs/tmp/` exists (`mkdir -p docs/tmp`).
2. Ensure repo-root `.gitignore` contains a `docs/tmp/` entry. Create `.gitignore` or append the entry if missing. Do not rewrite unrelated ignore rules.
3. Choose an output path: `docs/tmp/<YYYYMMDD_HHMMSS>_<slug>.md`
   - Prefix is local time, e.g. `20260908_143022_`.
   - `<slug>`: 3–6 lowercase hyphenated words from the feedback. No spaces.
   - If that path exists, bump the timestamp and retry.
4. Fill plan-header provenance for **this run** (the process writing the file, not a parent agent or a config default):
   - **Harness**: `Grok Build`, `Claude Code`, or `Codex`. Use `unknown` if this session is none of those.
   - **Model**: `<id> (<effort>)`, for example `grok-4.6 (xhigh)`. Prefer the harness model id over a display name. Always append the live reasoning/effort setting in parentheses; use `none` when this model has no effort control, or `unknown` when the setting cannot be determined.
   Resolve id and effort from this conversation first (system/developer identity or session status the harness attached to this turn). If that is ambiguous and the harness already pointed at this session (for example a session-id environment variable), read that session's metadata. Do not treat user/project default model or effort settings as the session values. If the id is unknown, write `unknown (<effort>)`. Do not invent an id or effort.
5. Do not commit the plan.

## Workflow

### 1. Load and decompose

Read the full input. Split it into discrete requirements. A requirement is one ask, constraint, bug, opportunity, or piece of information. Do not merge unrelated asks. Do not invent requirements.

Label them `R1`, `R2`, …

### 2. Ground in the worktree

For each requirement, inspect only the code, config, and data needed to judge it. Prefer existing patterns in this repo over greenfield design.

### 3. Remove ambiguity

If unresolved ambiguity would change proposed files, scope, or whether to action/reject, ask before writing the plan. Use an available question tool when supported in the current mode (recommended option first for discrete choices), otherwise ask directly in chat. Wait for answers to blocking questions; elapsed time is not an answer. Ask all blocking questions in as few rounds as possible. Do not guess product intent.

Do not ask what the codebase already answers.

### 4. Data review

For every requirement that could be affected by persisted data, inspect the **local worktree DB** (read-only):

- Discover: `config/database.yml`, `.env*` / `DATABASE_URL`, `db/schema.rb` or `db/structure.sql`.
- Query with the project’s usual client (`rails runner`, `psql`, `sqlite3`, etc.).
- Check existence, volume, nulls, enums, and whether a migration or backfill is implied.

If there is no local DB or the requirement is not data-shaped, say so in that requirement’s Data review. If access is unavailable, record the missing evidence and its impact instead of inventing results. Never write to the DB or expose credentials in the plan or tool output.

### 5. Decide

For each requirement set **Decision** to exactly one of:

| Decision | Meaning |
|---|---|
| `actioned` | Agent coding work in this repo. |
| `rejected` | Out of scope, duplicate, unsafe, or YAGNI. Do not implement. |
| `informative` | No implementation coding. May be a human action, a constraint to remember, or context only. |

Default to `rejected` or `informative` when YAGNI says the code is unnecessary. `actioned` requires a concrete user-facing or operational outcome that existing code does not already cover.

### 6. Write the plan

Write the file with the template below. Then stop and tell the user the path plus a short summary of counts (`actioned` / `rejected` / `informative`).

## Plan template

````markdown
# Feedback plan: <short title>

- Date: <YYYY-MM-DD>
- Source: <file:path | text>
- Harness: <Grok Build | Claude Code | Codex | unknown>
- Model: <model id | unknown> (<effort | none | unknown>)
- Stack lens: Rails, TypeScript, React, MUI, bash, agentic loops/graphs
- Status: plan only — not implemented

## Original input

```
<verbatim original input>
```

## Requirements index

| ID | Requirement | Proposed files | Decision | Why |
|----|-------------|----------------|----------|-----|
| R1 | <one-line restatement> | `path/a`, `path/b` or — | actioned \| rejected \| informative | <one line> |

## R1: <title>

### Problem / opportunity

<what is wrong or what becomes possible, in user terms>

### Root cause

<root cause, or "none — net-new" / "not established">

### Technical review

<what the current code/config does; relevant files; constraints; YAGNI call>

### Data review

<what the local DB shows, or why DB evidence is N/A>

### Proposed solution

<what to do, or why not. For informative: the human action or the constraint to keep>

### Proposed tech-plan

<for actioned: ordered steps, files to add/change, tests, migrations, out of scope>
<for rejected: none>
<for informative: human steps if any; no agent coding>
````

Repeat the `## R<n>:` block for every requirement in index order.

## Solution bar

- Smallest change that satisfies the requirement. No speculative frameworks, extra indirection, or future-proofing.
- Rails: conventional MVC/jobs/migrations; no new abstraction without a second call site.
- React + TypeScript + MUI: existing design-system components and app patterns; no new UI kit.
- Bash: POSIX-safe, quoted, no unused flags.
- Agentic work: name the loop or graph, the halt condition, and which existing skills/tools it uses. If an AI/LLM feature is `actioned`, read [AI feature planning](references/ai-feature-planning.md). This shared reference replaces the former dependency on Grok's bundled `build-with-ai` skill.
- Tech-plan steps must be implementable by an agent without re-discovering intent.

## Output rules

- The plan file is the deliverable. Do not implement.
- Header `Harness` and `Model` are required. `Model` includes the parenthetical effort. Do not omit them or leave the placeholders.
- Do not skip the original-input section or the index table.
- Every index row has a matching `## R<n>:` section, and vice versa.
- Proposed files in the index are real paths (existing or intended). Use `—` when none.
- No emojis.
