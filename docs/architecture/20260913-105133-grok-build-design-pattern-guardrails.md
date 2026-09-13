# Encoding backend and frontend design patterns for Grok Build

Created: 2026-09-13 10:51:33 AEST (Australia/Sydney).

Revised: 2026-09-13. Added a confidence split (open standard vs research vs Grok-specific vs engineering judgment), citations, and amendments that follow from them. The main change: treat a lean `AGENTS.md` as **commands plus non-standard constraints**, not as a handbook and not as an index-only file.

Status: discussion note. This records how Grok Build (and 2026 coding agents generally) can be made to follow project-specific backend and frontend design patterns, and whether that approach scales to dozens of patterns on each side. Nothing in this file is a product decision for FNBA scoring or ranking.

Audience: engineering discussion. The canonical product source of truth remains [product-vision.md](../context/product-vision.md). Agent operating rules stay in [`AGENTS.md`](../../AGENTS.md); this document is the longer rationale those rules would point at.

**Certainty in one line:** the *stack* (lean always-on file + on-demand skills + golden code + mechanical checks) is current practice as of September 2026. Exact line counts, “router skills”, and “20–40 skills in the catalog” are design recommendations on top of that, not a named standard.

## 1. The problem

Grok Build does not “know” a team’s design patterns from the model. Like every other 2026 coding agent, it defaults to **training-data common practice**.

Examples of that default:

- Rails: service objects (`app/services`, `*Service`, `ApplicationService`).
- Frontend tables: a generic filter bar, often in a layout the team does not want.

If the team wants the opposite — for example “never use service objects, always use POROs”, or “table filters always render in this slot” — that has to be **encoded in the repository** so every session loads or looks it up before the agent writes code.

Those examples are **team constraints**, often the opposite of common Rails or generic UI advice. The *method* of encoding them is the subject of this note. The *content* (PORO vs service object) is not “industry backend best practice.”

The gap is the same one `AGENTS.md` was invented to close: Monday’s conversation is gone on Friday, and a different tool or a new session will invent a new colour scheme, a new navigation, or a new service layer.

## 2. What is actually standard as of September 2026

This is not a single settled cookbook. Four kinds of claim are mixed in most 2026 write-ups. They are separated here.

### 2.1 Open standards (high confidence)

**`AGENTS.md` is the cross-tool convention.** OpenAI published it in August 2025 and donated it to the Linux Foundation’s Agentic AI Foundation on 9 December 2025. Official site: [agents.md](https://agents.md). It is ordinary Markdown with **no required schema**. Official guidance is to cover what helps an agent work: project overview, build and test commands, code style, testing instructions, security. Nested `AGENTS.md` files in a monorepo are an official recommendation (OpenAI’s own repo is cited there as having 88 of them). Closest file to the edited path wins; explicit user prompts override everything.

Claude Code still prefers `CLAUDE.md`. Grok Build reads `AGENTS.md`, `Agents.md`, `CLAUDE.md`, and related names. Cursor still has glob-scoped `.cursor/rules/*.mdc` in addition to `AGENTS.md`.

**Agent Skills (`SKILL.md`) is the on-demand convention.** Spec: [agentskills.io/specification](https://agentskills.io/specification). Anthropic originated it; it is now an open format. A skill is a folder with `SKILL.md` (YAML frontmatter + Markdown body) and optional `scripts/`, `references/`, `assets/`. Required frontmatter: `name`, `description` (the description must say **what** and **when**). Progressive disclosure is in the spec:

1. `name` + `description` at startup (~100 tokens per skill).
2. Full `SKILL.md` body on activation (keep under 500 lines; &lt;5000 tokens recommended).
3. `references/` and other files only when the agent reads them.

Grok Build implements this. That is why pattern writeups belong in skill `references/` (or `docs/` the skill points at), not in `.grok/rules/`.

The spec and Grok’s own skill guide both say **one skill per workflow**, with depth in `references/`. They do not name “router skills.”

### 2.2 Research (high confidence, narrower than the blogs)

ETH Zurich + LogicStar, [arXiv:2602.11988](https://arxiv.org/abs/2602.11988) (12 Feb 2026, revised 23 Jun 2026), *Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?*

Findings that matter here:

- Context files **do not generally raise task success**.
- They **raise inference cost by over 20% on average**.
- This held across several LLMs and coding agents, for both LLM-generated and developer-committed files.
- Agents **do follow** the instructions (obedience is real; stale or wrong rules are expensive).
- **Repository overviews**, though popular and recommended by some vendors, **were not helpful**.
- LLM-generated context files can **reduce** success; human-written files were only a small, often non-significant lift.
- Authors’ conclusion: context files are useful for **specifying non-standard coding practices**; anything aimed at “improving performance” should be **evaluated before deployment**. Include only extra instructions beyond what is already in the codebase.

**Amendment this forces:** do not treat a large `AGENTS.md` as free context. Do not auto-generate it. Do not paste a folder-tree overview “because agents.md says overview.” Put **non-standard** constraints and **exact commands** there. Do not restate what a search of the repo already shows.

### 2.3 Practitioner consensus, not in the spec

- Keep always-on files short. “About 100–150 lines” appears in 2026 practitioner guides (and Grok’s project-rules doc: concise, specific, don’t duplicate the README). It is **not** in the AGENTS.md spec. Official [agents.md](https://agents.md) is looser and still shows commands and conventions **in the file**.
- Two camps exist: “`AGENTS.md` as table of contents only” vs “put commands, style, and tests in `AGENTS.md`.” ETH supports *short and non-redundant*, not index-only.
- Concrete examples beat paragraphs. Agents copy nearby code, including anti-patterns.
- Prose is a hint. CI / linters / tests are the contract.
- Shared team conventions belong in git. Personal agent memory is a different surface.

### 2.4 Engineering judgment (this note, not a standard)

- “Router skills” (one skill per area, decision table, `references/` per pattern) as the way to hold dozens of patterns.
- Numeric skill-catalog ceilings (~20–40 comfortable, merge past ~50). Those follow from description-token cost and collision risk, not a measured threshold.
- Encoding UX in a component API (`DataTable` only accepts filters in `toolbar`) as the highest-leverage guardrail. That is ordinary software practice applied to agents, not an agent-industry standard.
- A `frontend-page` checklist skill so “add a players page” loads filters, empty states, and URL params together.

### 2.5 Grok Build loaders (tool-specific, from Grok docs)

These are not universal agent laws. They are why some portable advice is sharper in this tool.

- `AGENTS.md` / `Agents.md` and every `*.md` in `.grok/rules/` are loaded **in full, every session**, with **no truncation**.
- Nested `AGENTS.md` files accumulate from repo root down to the working directory; deeper files win on conflict. When the agent later reads or edits another tree, it can pick up that tree’s instruction files.
- Skills inject **name + description** at startup; the body is on demand. `description` / `when-to-use` drive auto-invocation.
- Grok rules directories are **not** Cursor glob rules. There is no “only when editing `*.tsx`”. Putting forty pattern files in `.grok/rules/` puts forty documents in every prompt.
- Grok memory (`/remember`) is personal, experimental, and not a reviewable team contract. Fine for personal preferences. Wrong as the home for architecture the next clone must see.
- `grok inspect` shows what actually loaded.

### 2.6 Layered stack (synthesis of the above)

| Layer | Loads when | Question it answers | Confidence |
|---|---|---|---|
| `AGENTS.md` | Every session | Commands, non-standard constraints, pointers | Open standard |
| Agent Skills (`SKILL.md`) | When the task matches | How we do this kind of work | Open standard |
| Docs / ADRs | When told to read them | Why, and the long form | Ordinary docs practice |
| Golden code in the repo | When the agent explores nearby files | What to copy | Strong empirical / ETH implication |
| Linters, architecture tests, hooks, CI | After edits / on stop / at merge | What must never slip | Ordinary engineering |

Grok Build already implements this stack: root and nested `AGENTS.md`, `.grok/rules/*.md`, `.grok/skills/`, hooks, plugins, `grok inspect`.

## 3. Proposed stack for this repo (or a new Grok Build app)

Put each fact in one place, and load it only as widely as it needs to apply.

| Layer | Grok Build home | What belongs there |
|---|---|---|
| Always-on project rules | Root `AGENTS.md`, nested `AGENTS.md`, at most a few `.grok/rules/*.md` | Exact commands, 5–10 **non-standard** hard constraints, short pointers. No repo overview essay. |
| Task skills | `.grok/skills/<name>/SKILL.md` | Step-by-step “how we do this kind of change”; depth in `references/` |
| Source of truth | `docs/` (link, don’t copy into `AGENTS.md`) | Architecture, UX layout, ADRs, pattern catalog |
| Golden examples | Real production files, not a toy demo | One canonical PORO, one canonical table-with-filters page, etc. |
| Mechanical checks | RuboCop / ESLint / arch tests / `.grok/hooks/` / CI | Rules that must never be “almost followed” |

Do **not** put shared architecture in Grok memory (`/remember`). Commit it. Personal preferences can live in memory if the team wants that; they will not travel with a new clone.

The bundled `frontend-design` skill is for distinctive aesthetics on a new UI. It will **not** keep product-specific filter bars in a required slot. Product UX needs its own skill or pattern docs.

### 3.1 Always-on: a short `AGENTS.md`

**Amended relative to the first draft:** this file is not “index only” and not a handbook.

- **In the file (official + ETH):** exact build/test/lint commands; hard constraints that **fight training data** (no `*Service`; tables only through the UI kit).
- **Not in the file (ETH):** repository overviews, duplicated README, architecture essays, anything a repo search already shows.
- **Pointers are fine** when they name a file to read before a class of edit. That is cheaper than inlining the target doc.
- Write it **by hand**. Do not LLM-generate a “complete” `AGENTS.md`.
- Write rules as **imperative + anti-pattern**. “Prefer POROs” loses to training data. “Never create `app/services/*`; put this in `app/domain/<verb>.rb`” holds.
- Keep it short enough that every line would still be worth paying for on a one-line typo fix. Practitioner ballpark is ~50–150 lines; that is a budget, not a spec.

Illustrative root file (shape, not a commitment to this stack):

```markdown
# AGENTS.md

Rails 8 API + React. Domain logic is POROs. The UI kit owns layout.

## Hard constraints
- Never add `app/services/` or `*Service` objects. Domain logic lives in POROs under `app/domain/`.
- Inverse of common Rails advice is intentional. Do not “improve” this toward service objects.
- Table filters use `DataTable` from `packages/ui`. Do not invent a new filter bar.

## Commands
- Backend: `bin/rails test`
- Frontend: `pnpm test` and `pnpm lint`

## Before you edit
| Area | Read first |
|------|------------|
| Rails domain | `docs/architecture/domain-poros.md` |
| Tables / filters | `docs/ux/data-tables.md` |
| Visual language | `docs/design.md` |
```

Scope by directory so backend work does not pay for frontend rules (official nested-`AGENTS.md` advice, and Grok loads root-to-CWD):

```
app/AGENTS.md                 # PORO placement, no services
packages/web/AGENTS.md        # DataTable, filter slot, tokens
```

Keep nested files as short as the root: local hard constraints and commands, not a second copy of the pattern catalog.

Verify loaded files with `grok inspect`. After the first real tasks, check whether the file is earning its token cost (ETH: evaluate before adding more).

### 3.2 On demand: skills for the procedure

A skill is the right home for “when adding filters, put them here.” That matches the Agent Skills spec: procedures load when the task matches.

Keep `SKILL.md` short; put long reference material in `references/` and tell the agent to read it only when needed (spec: main file under 500 lines; references on demand).

The `description` is the whole discovery mechanism. Name trigger phrases **and** “do not use for” cases (spec: description says what and when, max 1024 characters).

**Backend example** (`.grok/skills/rails-domain-poro/SKILL.md`):

```markdown
---
name: rails-domain-poro
description: >
  Add or change Rails domain logic as a PORO under app/domain/.
  Use when creating models, use-cases, commands, form objects, or
  anything that looks like a service object. Do not use for
  controllers, jobs, or migrations.
---

# Rails domain POROs

1. Read `docs/architecture/domain-poros.md` and `app/domain/place_order.rb`.
2. Put new work in `app/domain/<verb>_<noun>.rb` as a PORO with a single public call method.
3. Controllers/jobs call the PORO. They do not grow business logic.
4. Do not create `app/services/`, `*Service`, or `ApplicationService`.
5. Copy the structure of `app/domain/place_order.rb` (initialize + `call`, keyword args, no inheritance).
```

**Frontend example** (`.grok/skills/table-filters/SKILL.md`):

```markdown
---
name: table-filters
description: >
  Add or change filters on a data table. Use when the user asks for
  table filters, search, faceted filters, or a filter bar on a list
  page. Do not use for chart controls or page-level search.
---

# Table filters

Canonical example: `packages/web/src/pages/players/index.tsx`.

- Filters render in `DataTable`’s `toolbar` slot, **above the header, left-aligned**, never in a right drawer or below the table.
- Use `FilterBar` + `FilterChip` from `packages/ui`. No one-off filter forms.
- Filter state is URL search params (`useTableFilters`), not local React state.
- Mobile: same toolbar collapses to a single “Filters” button; do not hide filters in the page header.
```

These two examples are **per-workflow skills**, which the spec prefers. If the catalog grows to dozens of near-siblings, collapse them into area skills with `references/` (section 4). That collapse is a design recommendation, not a spec requirement.

### 3.3 Golden code

Agents copy the nearest example more reliably than they follow prose. ETH also implies: do not restate in `AGENTS.md` what the tree already shows — so the tree has to show the right thing.

Seed **one golden path per pattern** and delete competing examples:

- One real PORO (`app/domain/place_order.rb` + its test).
- One real table page that already has filters in the required slot.
- A `DataTable` whose API only accepts filters in that slot, so inventing a new layout is extra work.

If the repo has both a PORO and a leftover service object, the agent will produce both.

Greenfield is the most dangerous moment: there is no local pattern to copy, so training data wins. Scaffold the golden PORO and the golden table **before** asking the agent to build features.

Encoding layout in the component API is ordinary software practice. It is the most reliable UX guardrail because the agent has to fight the type/import surface to do the wrong thing. It is not a substitute for a written constraint on day one of an empty repo.

### 3.4 Mechanical enforcement

Markdown is not a compiler. Encode structural invariants so a violation fails without an LLM. This is ordinary engineering, and it is what makes non-standard rules survive when the model is under pressure.

**Backend**

- RuboCop cop or packwerk boundary: fail on `app/services/`, `class .*Service`, `ApplicationService`.
- Cheap architecture test: every public method called from controllers lives under `app/domain/`.

**Frontend**

- ESLint restriction: table pages must use `FilterBar`, not raw filter rows.
- Storybook story for the canonical toolbar.
- Playwright or component test: filter node is a previous sibling of the table header.

**Grok hooks** (`.grok/hooks/`) as the in-session backstop:

- `PostToolUse` on file edits: if the diff adds `*Service`, tell the model to use a PORO under `app/domain/`.
- `Stop`: run `bin/lint-architecture` and block the turn until it passes.

Hooks fail open on crash, so keep the script simple and emit an explicit deny/block. CI still has to catch what the session misses.

If the same Rails/UX rules are later shared across apps, package skills + hooks as a Grok plugin rather than copying markdown.

## 4. Does this scale to dozens of backend and dozens of frontend patterns?

**Not as dozens of always-on rules.** Grok will load them all. ETH says that cost is real and success does not automatically follow.

**As a lookup catalog plus components and linters: yes, with a ceiling.** The Agent Skills spec is built for this (descriptions always on, bodies and `references/` on demand). Whether the agent *picks* the right skill on an implicit prompt is not guaranteed by the spec.

### 4.1 What breaks first

| Approach | Scales? | Why | Kind of claim |
|---|---|---|---|
| 40+ pattern files in `.grok/rules/` or a huge `AGENTS.md` | No | Grok loads them all, every session. ETH: cost up, success not improved. Overviews don’t help. | Grok loaders + ETH |
| One auto-invoked skill per pattern (80 peers) | Poorly | Spec is one skill per workflow. “Add a players page” will not load eight skills. Descriptions collide or miss. | Spec + judgment |
| Area skills + `references/` + pattern index | Yes, as a design | Startup cost is descriptions only; bodies load on demand. Matches progressive disclosure. | Spec applied |
| UI kit / types that make the wrong layout extra work | Best ROI | Twenty components can encode eighty UX decisions. | Ordinary engineering |
| 80 custom cops | No | Maintenance exceeds benefit unless generated from a schema. | Ordinary engineering |

Three ceilings around 40–80 patterns (judgment, not measured):

1. **Invocation miss.** Feature-shaped work implies many patterns. The model will not self-select eight skills unless a parent checklist says so.
2. **Description collision.** `table-filters`, `list-toolbar`, `search-bar`, `faceted-search` all fire on the same prompt — or none do.
3. **Stale catalog.** ETH: agents follow instructions. A wrong rule is worse than no rule.

### 4.2 The shape that scales

**Compress first. Then put non-standard constraints always-on. Then catalog the rest. Then enforce a short list mechanically.**

1. **Fold patterns into artifacts the agent cannot dodge.** If `DataTable` only accepts filters in `toolbar`, you do not need a “filters go here” essay on every screen. If `app/domain/` is the only place controllers may call, you do not need a novella on POROs.

2. **Keep always-on short and non-redundant — not “index only”, not an encyclopedia.** Root `AGENTS.md`: exact commands, 5–10 hard non-standard constraints, a short “read this first” table. Nested `app/AGENTS.md` and `packages/web/AGENTS.md` hold local hard constraints and commands, not the pattern catalog.

3. **Prefer a few area skills with `references/` over one skill per pattern once siblings pile up.** “One skill per workflow” is right for deploy vs rollback, and for a first `table-filters` skill. It is the wrong cardinality for 40 table/form/empty-state variants. Collapsing to ~6–12 area skills is **this note’s design**, applying the spec’s `references/` tier.

   Example layout:

   ```
   .grok/skills/rails-domain/          # POROs, form objects, queries, jobs
     SKILL.md                          # decision table + “read one reference”
     references/poro.md
     references/query-object.md
     references/background-job.md

   .grok/skills/web-tables/
     SKILL.md
     references/filters.md
     references/pagination.md
     references/empty-states.md

   .grok/skills/web-forms/
   .grok/skills/web-navigation/
   .grok/skills/frontend-page/         # checklist that fans out (design)
   ```

   `frontend-page` is a proposed unlock, not a standard. Its body is a checklist: open the frontend pattern index, read every matching file and golden example, then implement. That is how “add a players page” picks up filters, empty states, and URL params without hoping eight skills self-select.

   **Rule of thumb, not a measured limit:** ~20–40 skills in the catalog is comfortable (descriptions only). Past ~50, merge siblings into area skills. Unlimited `references/*.md` is fine; they cost nothing until read. Write descriptions as a **partition**: what to use it for **and** what not to.

4. **Make the catalog grepable, with one golden file each.**

   ```
   docs/patterns/
     backend/README.md      # table: pattern → file → golden path → lint
     backend/poro.md
     frontend/README.md
     frontend/table-filters.md
   ```

   Each pattern file is one screen: rule, anti-pattern, path of the canonical example, how to verify.

   Avoid duplicating those files into both `docs/patterns/` and skill `references/` unless one side is a stub that points at the other. One home per fact.

5. **Enforce only the cheap invariants.**

   | Enforce in CI / a Stop hook | Leave as skill + golden example |
   |---|---|
   | No `*Service`, no `app/services/` | PORO method naming |
   | Imports must come from `packages/ui` for tables/forms | Filter bar left vs right |
   | No new `Drawer` for table filters | Chip vs dropdown for a given facet |
   | Packwerk / import-linter boundaries | Copy tone on empty states |

   One `Stop` hook that runs `bin/lint-architecture` stays one hook as the catalog grows. Eighty `PostToolUse` scripts will not.

### 4.3 Target inventory for ~80 patterns

Counts below are a **starting budget for discussion**, not a spec.

| Surface | Count | Role |
|---|---|---|
| Root `AGENTS.md` | 1, short | Commands + hard no’s + pointers |
| Nested `AGENTS.md` | 2–4 (app, web, ui) | Local hard constraints and commands |
| `.grok/rules/` | 0–3 | Truly global, tiny (Grok loads all of them always) |
| Area / workflow skills | start small; collapse toward ~8–12 if the catalog grows | Procedures + decision tables |
| Pattern docs / skill `references/` | 40–80 | The actual guardrails |
| Golden examples | 1 per pattern | What the agent copies |
| Components in the UI kit | as few as possible | UX patterns made structural |
| Custom cops / arch tests | ~10–20 | Invariants that must never slip |

The unit of scale is the **area skill + `references/` + golden file**, not the individual always-on guardrail.

### 4.4 What will still not scale

- One markdown file per pattern in `.grok/rules/` (Grok loads all of them).
- One auto-invoked skill per pattern, all peers (invocation miss).
- UX rules the component API does not force. “Filters always in this slot” is cheap if `DataTable` has only that slot; expensive if every page is free-form.
- An unevaluated catalog. ETH: evaluate before deploying more context. Keep a 10-prompt litmus list (“add CreateInvoice”, “add status filters to players”) and rerun it when adding a pattern. If Invoice lands in a service object, fix the index, the golden file, or the cop — not by adding an 81st essay.

## 5. Practical bootstrap

1. Hand-write a short root `AGENTS.md`: hard non-standard no’s, exact test/lint commands, a small “read this first” table. No generated overview.
2. Add nested `AGENTS.md` under backend and frontend only when those trees have different hard constraints.
3. Add skills as **workflows** first (`rails-domain-poro`, `table-filters`). Collapse into area skills with `references/` when siblings appear.
4. Check in one golden PORO and one golden table page **before** generating features.
5. Encode the same structural rules in RuboCop/ESLint/tests. This is the enforcement layer.
6. Optionally add a `Stop` hook that runs those checks.
7. Run `grok inspect`, then the litmus prompts. If the agent creates `InvoiceService` or a right-hand filter drawer, the description, golden file, or linter is wrong — fix that, don’t add another paragraph.
8. Do not grow `AGENTS.md` because a task failed once. Per ETH, extra always-on text has a measured cost and no guaranteed success gain.

## 6. Questions for the team

These are open, not decided:

1. **Which patterns are hard constraints vs catalog entries?** ETH-shaped test: would we still pay to inject this on a one-line typo fix? Candidates for always-on: no service objects; tables only through the UI kit. Everything else should be a skill or a doc the skill points at.
2. **When do we collapse per-workflow skills into area skills?** Suggested: when two skills’ descriptions overlap, or when a feature prompt should apply several patterns at once.
3. **Who owns the pattern catalog?** Backend vs frontend ownership of `docs/patterns/` and `.grok/skills/`. One home per fact.
4. **What is the first UI kit surface that should absorb layout rules?** Likely `DataTable` / `FilterBar` if list pages are the bulk of the product.
5. **Which invariants are worth a cop in v1?** Suggested: ban `app/services` and `*Service`; restrict table/filter imports to `packages/ui`.
6. **Litmus prompts.** Agree a short list and treat a miss as a catalog bug, not an agent personality issue. Use it as the ETH-style evaluation before adding more context.
7. **Do we share this pack across repos later?** If yes, design as a Grok plugin from the start (skills + hooks), with this repo’s `AGENTS.md` remaining the project-specific index.

## 7. What not to rely on

- A 2,000-line `AGENTS.md` or a large `.grok/rules/` dump. Grok loads it all; ETH says that is costly and not generally helpful.
- An LLM-generated `AGENTS.md`.
- A repository-overview section “for orientation.” ETH found overviews unhelpful.
- Grok memory / `/remember` as the system of record for team architecture.
- The bundled `frontend-design` skill for product UX consistency.
- Hoping the first generated file is right in an empty tree.
- Treating “router skills” or “under 150 lines” as if they were in the AGENTS.md or Agent Skills specs. They are this note’s recommendations.

## 8. Short version

Grok follows what is always in context, what it is told to load for this task, what the nearest code already does, and what CI will reject. For patterns that fight training data (no service objects, a very specific filter placement), you want all four.

As of September 2026 that maps to: a **hand-written, short `AGENTS.md`** with commands and non-standard constraints ([agents.md](https://agents.md), [arXiv:2602.11988](https://arxiv.org/abs/2602.11988)); **Agent Skills** with progressive disclosure ([agentskills.io/specification](https://agentskills.io/specification)); **golden files** so the repo already looks like the rule; **linters/tests/hooks** for invariants.

Dozens of patterns scale if they live in an **indexed catalog** the agent is required to consult, **compressed into components/types** where possible, and **checked by a small CI set**. They do not scale as always-on Grok rules, and they only barely scale as 80 equally-weighted skills.

## 9. Sources

| Source | What it supports |
|---|---|
| [agents.md](https://agents.md); Linux Foundation AAIF announcement, 9 Dec 2025 | `AGENTS.md` as vendor-neutral convention; nested files; no required schema; commands/style/tests in the file are legitimate |
| [agentskills.io/specification](https://agentskills.io/specification) | Skill folder layout; `name`/`description`; progressive disclosure; `references/` on demand; keep `SKILL.md` under 500 lines |
| [arXiv:2602.11988](https://arxiv.org/abs/2602.11988) (Gloaguen et al., ETH Zurich / LogicStar, Feb–Jun 2026) | Always-on context files raise cost ~20%+, do not generally raise success; overviews unhelpful; agents follow instructions; use files for non-standard practices; evaluate before adding more |
| Grok Build user guide: project rules, skills, hooks, memory (`~/.grok/docs/user-guide/`) | How *this* tool loads `AGENTS.md`, `.grok/rules/`, skills, hooks; no glob scoping; no truncation of rule files |
| This note | Area/router skills, numeric catalog budgets, UI-kit-as-guardrail, `frontend-page` checklist, PORO/filter examples as team constraints |
