# Shared project skills

Adopted 13 September 2026 for Codex, Claude Code, and Grok Build. This is the project's implementation of the Agent Skills format, not a guarantee of identical model behavior. Agent rules are maintained in [AGENTS.md](../../AGENTS.md); this document explains the setup and its verification.

## One source of truth

```text
AGENTS.md                           Shared project instructions
CLAUDE.md                           Imports @AGENTS.md
.agents/skills/spec-it/
  SKILL.md                          Canonical workflow
  references/ai-feature-planning.md  Shared conditional guidance
.claude/skills/spec-it               Symlink to ../../.agents/skills/spec-it
scripts/check_shared_skills.py       Checks repository layout for drift
```

Codex discovers `.agents/skills/`. Claude Code discovers `.claude/skills/` and supports symlinked skill directories. The installed Grok Build guide documents repository `.agents/skills/` discovery; Grok also supports Claude skill locations. Verify the installed loader after upgrades rather than adding another maintained copy.

`CLAUDE.md` imports `AGENTS.md` because Claude does not automatically load that filename. Codex and Grok read `AGENTS.md` directly. Keep the import entry point free of duplicated workflow rules.

The symlink is relative and tracked in Git, so it resolves inside a new clone or worktree. Use a checkout that preserves symlinks. A text file containing the target path is not a functioning symlink; the checker rejects it. If a platform cannot preserve links, fix checkout support before using this setup instead of maintaining a separate skill copy.

## Invocation

| Interface | Invocation |
|---|---|
| Shared prompt convention | `Use spec-it: <file path or feedback>` |
| Grok Build | `/spec-it <file path or feedback>` |
| Claude Code | `/spec-it <file path or feedback>` |
| Codex CLI/IDE | `$spec-it <file path or feedback>` or select it through `/skills` |

The shared wording tells the agent to load the named skill; it is not a universal slash-command registration. Use the client's skill selector for explicit UI selection where available. A shared file does not register `/spec-it` in Codex. Merely discussing or editing the skill is not a request to execute its feedback-planning workflow.

## Authoring and updates

1. Read and edit `.agents/skills/<name>/SKILL.md` and its supporting files, regardless of which harness you use. Keep the directory name and frontmatter `name` identical, and provide a precise `description`.
2. For a new shared skill, create `.claude/skills/<name>` as a relative symlink to `../../.agents/skills/<name>`. Do not copy the skill into another loader directory or install a competing personal/plugin version under the same name.
3. Keep workflow decisions, output templates, and acceptance criteria in the canonical skill. Reference supporting files relative to its directory. Keep feedback paths rooted in the repository. Use portable frontmatter; do not rely on vendor-specific fields or substitutions for essential behavior.
4. Describe required operations and map them to available tools. If a required capability is unavailable, state what is blocked; do not silently omit a required step. Keep essential dependency guidance in shared references, or explicitly provide and verify the dependency in every harness.
5. Update this documentation when discovery, invocation, or dependencies change. Run the repository checker and the affected behavioral cases below. Review and commit the canonical changes and any discovery links together.

Both harnesses editing the same checkout change the same files. Separate branches/worktrees still require Git merging, and an already-loaded conversation can retain older instructions. Use fresh sessions for verification after changing a skill. Check personal/plugin overrides if a loader reports another source path.

`spec-it` keeps its plan template (including harness and live model-with-effort provenance), requirement decisions, read-only data review, and plan-only boundary. Its former Grok `build-with-ai` dependency is now an explicit [shared planning reference](../../.agents/skills/spec-it/references/ai-feature-planning.md), retaining the original SpaceXAI default unless the user or repository specifies otherwise. No private skill cache is required.

## Verification

Run from any directory:

```sh
python3 /path/to/fnba-drafter/scripts/check_shared_skills.py
```

The checker verifies canonical skill directories, Claude discovery links, the `CLAUDE.md` import, and absence of alternative repository skill definitions. It does not invoke models, inspect personal configuration, validate all skill semantics, or prove behavioral parity. It is a required local check; this repository does not currently configure CI to run it automatically.

After migration or a loader upgrade, inspect `grok inspect` and the Claude/Codex skill selectors in fresh sessions. Confirm `spec-it` resolves to the canonical directory (possibly through the Claude symlink) and that shared project instructions loaded. If it does not appear, check project trust, disabled skills, name overrides, and symlink handling; do not fix discovery by copying the skill.

For substantive workflow updates, run these cases in disposable worktrees on the same Git revision with each available harness. Compare evidence and acceptance criteria, not identical wording. Record harness/model versions, failures, and unavailable checks in the change report.

| Case | Acceptance criteria |
|---|---|
| Pasted feedback with multiple asks | Original input retained; separate requirements; each index row matches a detailed section; valid decisions and accurate counts |
| Existing feedback file plus commentary | Complete file used as primary source; commentary retained as constraint; proposed paths grounded in the worktree |
| Ambiguous scope | Blocking question asked before a plan is finalized; no invented user decision |
| Persisted-data requirement | Read-only local evidence, or explicit missing evidence and its impact; no DB mutation or exposed credentials |
| AI feature requirement | Shared AI planning reference used; provider assumption and current-doc evidence stated; no bundled-skill dependency |
| Every completed plan | Timestamped file under ignored `docs/tmp/`; header records harness and the live session model with effort; no implementation or plan commit; source/template/index preserved |

Use those same cases to investigate differences between harnesses. Sharing source prevents divergent maintained copies; model quality, tools, permissions, context, and instruction precedence still affect outcomes.

## Sources and scope

- [Agent Skills specification](https://agentskills.io/specification): shared file format, metadata, scripts, and references.
- [Codex skills](https://developers.openai.com/codex/skills/): `.agents/skills/`, symlink discovery, and explicit invocation.
- [Claude Code skills](https://code.claude.com/docs/en/skills): `.claude/skills/`, symlink support, and harness extensions.
- [Claude project instructions](https://code.claude.com/docs/en/memory#agentsmd): importing `AGENTS.md` from `CLAUDE.md`.
- [Grok Build skills](https://docs.x.ai/build/features/skills-plugins-marketplaces): skills and Claude compatibility. The installed `~/.grok/docs/user-guide/08-skills.md` additionally documents repository `.agents/skills/` discovery; verify that capability against the installed version.

The canonical directory plus discovery symlinks and shared verification is this project's chosen design. The open format does not standardize identical command syntax, tool behavior, plugin packaging, or effectiveness.
