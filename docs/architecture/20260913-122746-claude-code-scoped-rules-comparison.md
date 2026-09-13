# Claude Code path-scoped rules compared with the Grok and Codex guardrail proposals

Created: 13 September 2026, 12:27:46 AEST (Australia/Sydney).

Status: discussion note. This records findings and recommendations; it does not adopt new repository rules or implement configuration changes. Backend and frontend examples are illustrative.

Documents reviewed:

- [Encoding backend and frontend design patterns for Grok Build](20260913-105133-grok-build-design-pattern-guardrails.md)
- [Design pattern guardrails for agentic development with Codex harnesses](20260913-105157-codex-design-pattern-guardrails.md)

## Finding

Claude Code's path-scoped rules support just-in-time context loading. The user's expectation that scoped rules can be context efficient is correct. Neither proposal establishes that skills or document indexes are inherently more efficient than scoped rules.

The proposals' broader recommendations remain useful: keep guidance concise, maintain canonical examples, put repeatable decisions into shared code, and enforce suitable constraints with checks. Their context-routing recommendations need to account for each tool's actual loader.

## What Claude Code documents

Rules under `.claude/rules/` with `paths` frontmatter load when Claude reads a matching file. Rules without that field load unconditionally. Splitting instructions into separate files therefore does not itself make them conditional. [Claude Code rules documentation](https://code.claude.com/docs/en/memory#path-specific-rules)

For example, a rule could use:

```markdown
---
paths:
  - "packages/web/src/pages/**/*.tsx"
---

For filterable tables, use the shared table toolbar.
Read docs/frontend/tables-and-filters.md before changing filter behavior.
```

These are illustrative paths, not a claim that the component or document exists in this repository.

The documentation identifies matching file reads as the trigger, rather than every tool operation. It also distinguishes task-driven skills from file-driven rules. [Claude Code memory documentation](https://code.claude.com/docs/en/memory#organize-rules-with-clauderules)

Just-in-time loading does not imply automatic unloading. Once a scoped rule loads, its content becomes conversation history. Switching to another area does not remove those earlier instructions merely because the next file has a different path. Prompt caching can reduce repeated processing costs while retaining the context. [Claude Code prompt caching](https://code.claude.com/docs/en/prompt-caching#editing-claudemd-mid-session)

These findings are based on official documentation reviewed during the discussion, not an instrumented test of the locally installed Claude Code version.

## Comparison with the proposals

| Approach | Selection mechanism | Implication |
|---|---|---|
| Grok proposal | Small always-on instructions, then skills and references | Its warning against dozens of rule files depends on the Grok loader behavior described in that note. It should not be generalized to Claude's scoped rules. |
| Codex proposal | Instructions require the agent to consult indexes and select applicable documents | Flexible for semantic concerns, but dependent on the agent following the routing procedure. |
| Claude Code scoped rules | Runtime path matching loads the corresponding instructions | A strong fit where applicability follows repository structure; removes a document-selection decision from the agent. |

The Grok proposal reports that `.grok/rules/*.md` files load in full every session. This comparison relies on that document's account of Grok behavior; it does not independently verify the Grok loader.

Codex's official documentation describes startup discovery of an `AGENTS.md` instruction chain from the project root to the current working directory. That documented mechanism differs from Claude's read-triggered glob rules. A shared Markdown convention does not guarantee identical discovery or loading across tools. [Codex instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md)

Consequently, the Grok proposal's recommendation to place filter-placement guidance in a skill is one option, not a requirement for Claude Code. A concise scoped rule can carry that convention, while a skill describes the larger implementation workflow.

## Context efficiency and its limits

The relevant quantity is how much applicable guidance enters a session, and when. File count alone is a poor measure.

For illustration, if a catalog contains forty rules but a task encounters paths matching only three, conditional loading can avoid loading the other thirty-seven rule bodies. This is an example of the mechanism, not a measured token-saving result. If all forty rules share a broad scope such as `src/**/*.tsx`, one matching read can eliminate that selectivity.

Three practical limitations follow:

1. **Overlapping scopes load unnecessary guidance.** Use scopes that correspond to meaningful boundaries. If table pages cannot be distinguished by path, a table-specific workflow or document-selection step may be more selective than a rule covering every React component.
2. **Some decisions happen before a matching read.** Keep constraints governing architecture and file placement visible early enough to guide those decisions. A rule scoped only to `app/domain/**` may arrive too late to steer the initial decision about where domain behavior belongs. Do not assume a read-triggered rule is a universal pre-write gate.
3. **Some obligations depend on behavior, not location.** Authorization, loading states, and cross-cutting feature requirements may not map cleanly to filenames. A workflow checklist or semantic index can help identify them.

These limitations are engineering implications of the documented mechanism, not claims that every task will encounter them. Broad exploration can also accumulate more rules in conversation history, reducing the initial benefit of selective loading.

Loading reliability and compliance are separate questions. A runtime can load the intended guidance correctly while the model still misapplies or overlooks it. Markdown guidance therefore remains complementary to shared implementations and mechanical checks.

## Recommended allocation for Claude Code

Give path-scoped rules a first-class role in the proposed stack:

| Guidance | Recommended home |
|---|---|
| Project-wide constraints and decisions needed before choosing files | Short root instructions |
| Concise conventions applicable to identifiable paths | Path-scoped rules |
| Feature workflows spanning several concerns | Skills or focused checklists |
| Long explanations, exceptions, and canonical examples | Referenced documents |
| Requirements that must reliably hold | Components, types, linting, tests, and CI |

For example:

- **Scoped rule:** table pages use the shared toolbar, with a pointer to the detailed convention.
- **Skill:** build a filterable table, connect URL state, handle empty states, and verify mobile behavior.
- **Pattern document:** explain layout choices, exceptions, and maintained examples.
- **Shared component and checks:** implement the toolbar structure and verify relevant behavior.

For dozens of patterns, start with concise scoped rules wherever paths accurately express applicability. Add workflows for concerns that paths cannot capture. There is no demonstrated need to convert every convention into a skill or to route every task through two fixed indexes.

For this repository, preserve the existing shared-instruction arrangement: `CLAUDE.md` imports `AGENTS.md`, shared workflow requirements stay in canonical shared sources, and skills live in `.agents/skills/`. Any future Claude-specific routing should point to those sources rather than establish competing definitions. This note does not propose changing those conventions.

## What the research does and does not establish

The research cited by both proposals found that repository context files did not generally improve task success and increased inference cost by over 20% on average in its evaluated settings. It also found that agents followed instructions and that context files were useful for specifying nonstandard practices. [Evaluating AGENTS.md](https://arxiv.org/abs/2602.11988)

Those findings support pruning redundant context and evaluating additions. They do not establish that Claude's path-scoped rules are less efficient than skill-based routing, nor justify applying the reported cost increase to a scoped-rule catalog without measurement.

A useful evaluation would compare equivalent guidance delivered through scoped rules and through indexes or skills, holding the task, model, environment, and rule content as constant as practical. Include tasks confined to one area, tasks spanning frontend and backend, and tasks that create new structures. Measure applicable-rule discovery, adherence, unnecessary context, repair attempts, runtime, and token or monetary cost across repeated runs.

## Amendments suggested for the original recommendations

- Qualify the warning about dozens of rule files by loader behavior. Always-on Grok rules and Claude path-scoped rules have different context costs.
- Add file-triggered rules alongside task-triggered skills and agent-selected documents as a distinct routing option.
- Distinguish conditional loading from automatic context removal.
- Prefer path routing for conventions with clear file applicability, and semantic routing for obligations that cross or precede those boundaries.
- Retain both proposals' emphasis on canonical examples, shared code, executable checks, and evaluating the guardrails themselves.
