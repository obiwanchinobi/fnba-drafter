# Design pattern guardrails for agentic development with Codex harnesses

Discussion proposal for the development team. Created 13 September 2026; filename timestamp uses Australia/Sydney time.

This document proposes how a new application could maintain consistent backend architecture and frontend UX across dozens of patterns. The examples are illustrative, not adopted rules for the FNBA repository.

Updated 13 September 2026 to address harness engineering explicitly, including execution, verification, repair, and maintenance. “Current practice” here means published evidence available by that date.

## Evidence and scope

The proposal aligns with published harness-engineering practice. Its particular directory layout and workflow are recommendations for the team to evaluate, not a universally optimal industry standard.

The most directly relevant evidence is OpenAI's [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/), published **11 February 2026**. Its team uses a short `AGENTS.md` as a map into indexed repository documentation. It enforces architectural constraints through custom linters and structural tests, gives agents actionable remediation messages, exposes the running application and observability tools, and checks for documentation and code drift. This directly supports the original proposal's context and enforcement layers. The article reports an internal product team's experience and explicitly leaves long-term architectural coherence as an open question.

Anthropic's [Harness design for long-running application development](https://www.anthropic.com/engineering/harness-design-long-running-apps), published **24 March 2026**, reports experiments separating implementation from evaluation and defining concrete criteria for design quality. It also shows that orchestration choices depend on model capability and have cost tradeoffs. Its [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents), published **26 November 2025**, describes incremental implementation, persistent progress artifacts, and end-to-end testing across sessions.

These sources support the overall approach; they do not establish that every project needs multiple agents, exactly two pattern indexes, or one file per pattern. The harness responsibilities and adoption process below are a synthesis for this team's use case.

## The problem

Codex can infer conventions from existing code, but inference alone leaves room for inconsistency. Preferences such as avoiding a service-object layer or placing table filters consistently should be explicit, persistent, and supported by reusable code.

With dozens of backend and frontend patterns, putting every detail in one instruction file becomes difficult to maintain. The proposed approach is to use a short `AGENTS.md` as a routing guide into focused documentation, with shared implementations and automated checks where practical.

That documentation supplies context. A complete guardrail setup also needs to execute checks, inspect the application, feed failures back into implementation, and preserve evidence of what was verified.

## Harness responsibilities

For this proposal, the harness is the runtime and supporting tools that manage the agent's context, actions, state, and feedback. Repository documentation configures part of that environment. Instructions to run a check are distinct from a configured hook or CI job that actually runs it.

| Responsibility | Proposed implementation |
|---|---|
| Supply context | Route each task to applicable patterns, exceptions, and canonical examples |
| Guide implementation | Make shared components, templates, and focused skills available |
| Enforce constraints | Run architecture checks, linting, and behavioral tests with actionable failures |
| Inspect results | Provide a reproducible app environment, browser access, screenshots, logs, and test output |
| Evaluate and repair | Compare results with explicit acceptance criteria and feed failures into another implementation attempt |
| Preserve progress | Record decisions, remaining work, and verification status for tasks spanning sessions |
| Maintain the harness | Track recurring violations and improve the relevant rule, component, tool, or check |

Use existing Codex capabilities and repository tooling where they fit. Add custom orchestration only when observed failures justify it.

## Proposed layers

| Layer | Purpose |
|---|---|
| Root `AGENTS.md` | Mandatory conventions, document routing, and precedence rules |
| Backend and frontend indexes | Map the type of change to applicable pattern documents |
| Pattern documents | Explain applicability, rules, examples, exceptions, and verification |
| Shared code | Implement common decisions in components, domain objects, and other reusable structures |
| Automated checks and review | Detect violations and assess rules that require judgment |
| Optional skills | Package detailed, repeatable implementation workflows |
| Execution and verification tooling | Launch the app, run checks, and expose observable results |
| Task state and feedback | Preserve progress, record failures, and support repair attempts |

Codex reads project `AGENTS.md` instructions as part of instruction discovery. Global preferences can also live in `~/.codex/AGENTS.md`, but team and application decisions should be versioned with the repository. See the [official AGENTS.md documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Suggested documentation structure

```text
AGENTS.md
docs/
  backend/
    index.md
    domain-modeling.md
    database-queries.md
    authorization.md
    background-jobs.md
    external-integrations.md
  frontend/
    index.md
    page-layouts.md
    tables-and-filters.md
    forms-and-validation.md
    loading-empty-error-states.md
    navigation.md
```

These are proposed paths for a new application, not existing files in this repository.

The root instructions could contain:

```md
Before implementing a change:
- Read docs/backend/index.md for backend work.
- Read docs/frontend/index.md for frontend work.
- Read every pattern document whose applicability matches the change.
- Follow the canonical implementation linked from each pattern.
- When existing code conflicts with documented rules, follow the rules.
- When changing a shared pattern, update its implementation and documentation.

Before reporting completion:
- Run the applicable verification commands documented by the patterns.
- Inspect affected UI behavior in the running application.
- Repair detected violations and rerun affected checks.
- Report verification evidence and any unresolved failures.
```

This conditional reading procedure must be prescribed. Arbitrary documentation files are not automatically loaded simply because they exist.

The example above guides behavior; it does not configure automatic enforcement. Checks that must run independently of agent instruction-following need an actual execution mechanism, such as CI or an appropriately configured supported hook.

## Routing to the applicable patterns

Each index should be a compact map with concrete triggers:

| When changing… | Read… |
|---|---|
| Lists, search, filters, sorting, or pagination | `frontend/tables-and-filters.md` |
| User input or submission behavior | `frontend/forms-and-validation.md` |
| Network-backed screens | `frontend/loading-empty-error-states.md` |
| Page composition and action placement | `frontend/page-layouts.md` |
| Queries, joins, or record loading | `backend/database-queries.md` |
| Access to user-owned resources | `backend/authorization.md` |
| Domain behavior and responsibility boundaries | `backend/domain-modeling.md` |

A single task can match several entries. Adding a searchable customer directory might require table, page-layout, query, and authorization patterns. Routing should account for these cross-cutting concerns.

## A consistent format for every pattern

Each pattern should specify:

- **Applies when:** concrete triggers for reading and applying it.
- **Strength:** mandatory rule, default with exceptions, or suggestion.
- **Rule:** the required structure or behavior.
- **Rationale:** why the team chose it, especially where tradeoffs matter.
- **Canonical example:** a maintained implementation, component, or reference screen.
- **Exceptions:** where the rule does not apply and what to do instead.
- **Verification:** how to check compliance.
- **Maintenance:** who owns the pattern and when its example and verification were last checked.

Distinguishing mandatory rules from defaults and suggestions helps avoid treating dozens of preferences as equally absolute. Conflicting rules need explicit precedence or clarified scope.

## Backend example: domain objects in Rails

“Never use service objects; always use POROs” is ambiguous because a service object can itself be a plain Ruby object.

A more useful convention defines the intended structure:

```md
- Do not introduce a service-object layer or app/services.
- Represent extracted domain behavior with plain Ruby objects
  that have domain-specific names and methods.
- Follow the canonical examples in docs/backend/domain-modeling.md.
```

The detailed pattern should establish where classes live, how they are named, which responsibilities they own, and what acceptable implementations look like. The team should agree on these details before treating the rule as enforceable.

A structural check can reject a forbidden directory or dependency. It cannot establish good domain modeling merely from a class name. Keep semantic review criteria alongside the mechanically enforceable constraints.

## Frontend example: filterable tables

“Place filters above the table” is a starting point. A complete convention also defines ordering, spacing, active-filter display, clearing behavior, and mobile layout.

For example, once a shared component exists:

```md
- All filterable tables must use the shared TableToolbar component.
- Place the toolbar directly above the table, below the page heading.
- Put search and filters on the left; table actions on the right.
- Follow the mobile layout in docs/frontend/tables-and-filters.md.
```

Implementing these decisions in a reusable component reduces the number of layout decisions that must be made independently for each screen. Reference screens or component examples help make the expected result concrete.

The corresponding harness workflow would be:

1. Load the table, page-layout, and other applicable conventions.
2. Reuse the shared toolbar and implement filter behavior.
3. Run component and behavioral checks relevant to the change.
4. Launch the application with predictable sample data.
5. Inspect the toolbar and filter interactions at the documented desktop and mobile sizes.
6. Compare the result with the reference and acceptance criteria; repair deviations.
7. Record the checks performed and any unresolved issues.

Separate verifiable requirements, such as placement and clearing behavior, from design judgments. Give a reviewer concrete criteria for both. An agent evaluator may help with the latter, but it remains fallible.

## Make guardrails executable where practical

Instructions guide the agent; they do not guarantee compliance. Move repeated decisions into shared code and use checks suited to the rule.

| Guardrail | Practical implementation or verification |
|---|---|
| Filter placement and spacing | Shared table component and rendered UI review |
| Colors, typography, and spacing | Design tokens and shared components |
| Forbidden dependencies or directories | Lint or architecture checks |
| Authorization behavior | Shared authorization mechanism and behavioral tests |
| Domain boundaries and naming | Documentation, canonical examples, and code review |
| Responsive layouts and visual states | Component examples and targeted visual verification |

Automated checks should verify meaningful constraints or behavior. Architectural judgment and UX quality will still need review.

Make failures useful to the agent: identify the violated rule, affected location, and expected correction or canonical example. Reuse the same checks locally and in CI where practical so the agent can repair issues before submitting a change.

Define completion criteria and a bounded repair policy. A run with unresolved failures should preserve its evidence and remaining work for review rather than claim success. For longer work, record enough state for the next session to continue without reconstructing decisions from conversation history.

## Where skills fit

Skills are useful when a convention becomes a repeatable workflow. An “add a filterable table” skill could describe how to use the shared toolbar, connect filter state, handle loading and empty states, and verify the result.

Codex can activate skills explicitly or match them to a task using their descriptions. Keep mandatory conventions in `AGENTS.md` and the referenced pattern documents; use skills for longer procedures. See the [official skills documentation](https://developers.openai.com/codex/skills).

## Evaluate the guardrails themselves

More documentation does not automatically improve results. [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988v2), revised **23 June 2026**, found that context files did not generally improve task success and increased inference cost by over 20% on average in its evaluated settings. It also found that agents followed instructions and that context files were useful for specifying nonstandard coding practices. This is relevant to team-specific guardrails, but does not prove this proposal's effectiveness on our codebase.

Before expanding the setup across dozens of patterns, try representative tasks with and without the proposed additions, holding the model, task, and environment constant where possible. Include tasks with cross-cutting rules and repeat runs enough to avoid judging the setup from one result.

Track:

- Whether the agent finds all applicable rules.
- Whether the delivered change satisfies those rules and the task requirements.
- How many review corrections and repair attempts are needed.
- Whether checks miss real violations or flag acceptable implementations.
- Execution time and token or monetary cost.

Use the results to improve routing, checks, and examples. Prune redundant instructions and avoid adding generic advice that the agent can already infer from code. Recurring corrections should lead to the smallest effective improvement, which may be shared code or a check rather than another paragraph.

## Suggested adoption process

1. Agree on the most important architecture and UX conventions.
2. Create a short root instruction file and two pattern indexes.
3. Establish one representative backend feature and one representative table screen as canonical examples.
4. Add focused pattern documents as conventions become concrete.
5. Extract shared implementations and add checks where they provide useful enforcement.
6. Provide a reproducible app environment and access to browser, logs, and test results.
7. Define acceptance criteria, verification evidence, and a bounded repair workflow.
8. Evaluate representative tasks before expanding the pattern catalog or orchestration.
9. Turn recurring review corrections into documentation updates, shared code, or automated checks; remove ineffective instructions.
10. Update rules and canonical examples together, and periodically check links, ownership, and consistency with the code.

## Questions for the team

- Which conventions are mandatory, and which allow exceptions?
- Which existing implementations should be canonical examples?
- Which patterns should be implemented as shared components or libraries?
- Which violations can be caught reliably in CI?
- Who owns pattern changes and keeps examples current?
- How should the team handle legacy code that conflicts with a documented convention?
- Which checks must be independently enforced, and which require judgment?
- What evidence should a completed agent task include?
- Which representative tasks will establish whether the harness improves adherence?
- When should a repair loop stop and return unresolved work for review?
