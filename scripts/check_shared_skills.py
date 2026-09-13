#!/usr/bin/env python3
"""Check the project's shared skill layout without invoking a harness."""

import sys
from pathlib import Path


def check(root):
    errors = []
    canonical = root / ".agents/skills"
    skills = sorted(canonical.iterdir()) if canonical.is_dir() else []
    if not skills:
        errors.append("No canonical skills found under .agents/skills/.")
    for skill in skills:
        if skill.is_symlink() or not (skill / "SKILL.md").is_file():
            errors.append(f"{skill.relative_to(root)} must be a real skill directory with SKILL.md.")
            continue
        for path in skill.rglob("*"):
            if path.is_symlink():
                errors.append(f"{path.relative_to(root)} must be maintained inside the canonical skill, not linked elsewhere.")
        link = root / ".claude/skills" / skill.name
        try:
            valid = (
                link.is_symlink()
                and not link.readlink().is_absolute()
                and link.resolve(strict=True) == skill.resolve(strict=True)
            )
        except (OSError, RuntimeError):
            valid = False
        if not valid:
            errors.append(f"{link.relative_to(root)} must be a relative symlink to ../../.agents/skills/{skill.name}.")

    # Check supported alternative roots, including legacy command definitions.
    for vendor in (".claude", ".grok", ".codex", ".agents"):
        for folder in ("skills", "commands"):
            location = root / vendor / folder
            if location == canonical or not location.is_dir():
                continue
            for entry in location.iterdir():
                if vendor == ".claude" and folder == "skills" and entry.name in {s.name for s in skills}:
                    continue  # Validated against its canonical directory above.
                errors.append(f"Unexpected {entry.relative_to(root)}; keep shared definitions only in .agents/skills/.")

    claude = root / "CLAUDE.md"
    if not claude.is_file() or claude.read_text().strip() != "@AGENTS.md":
        errors.append("CLAUDE.md must contain only @AGENTS.md; edit shared rules in AGENTS.md.")
    if not (root / "AGENTS.md").is_file():
        errors.append("Missing canonical project instructions: AGENTS.md.")
    return errors


if __name__ == "__main__":
    failures = check(Path(__file__).resolve().parents[1])
    if failures:
        print("Shared skill checks failed:\n" + "\n".join(f"- {error}" for error in failures))
        sys.exit(1)
    print("Shared skill layout OK: canonical sources, discovery links, and shared instructions.")
