#!/usr/bin/env python3
"""Check committed package-install policy for npm and Bundler."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

MIN_RELEASE_AGE_DAYS = 7
MIN_NPM = (11, 10, 0)
MIN_BUNDLER = (4, 0, 13)

REQUIRED_NPMRC = {
    "min-release-age": str(MIN_RELEASE_AGE_DAYS),
    "ignore-scripts": "true",
    "allow-git": "none",
    "save-exact": "true",
    "package-lock": "true",
    "audit": "true",
    "engine-strict": "true",
}

SOURCE_COOLDOWN_RE = re.compile(
    r"""source\s+(['"])https://rubygems\.org\1\s*,\s*cooldown:\s*7\b"""
)


def parse_npmrc(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values


def parse_version(text: str) -> tuple[int, ...] | None:
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", text)
    if not match:
        match = re.search(r"(\d+)\.(\d+)", text)
        if not match:
            return None
        return tuple(int(part) for part in match.groups()) + (0,)
    return tuple(int(part) for part in match.groups())


def format_version(version: tuple[int, ...]) -> str:
    return ".".join(str(part) for part in version)


def npmrc_errors(path: Path, label: str) -> list[str]:
    if not path.is_file():
        return [f"Missing {label}; copy the root .npmrc supply-chain keys."]
    values = parse_npmrc(path)
    errors = []
    for key, expected in REQUIRED_NPMRC.items():
        actual = values.get(key)
        if actual != expected:
            errors.append(f"{label} must set {key}={expected} (found {actual!r}).")
    return errors


def gemfile_has_rubygems_cooldown(text: str) -> bool:
    return SOURCE_COOLDOWN_RE.search(text) is not None


def package_engines_npm(path: Path) -> tuple[int, ...] | None:
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    engines = data.get("engines") if isinstance(data, dict) else None
    if not isinstance(engines, dict):
        return None
    spec = engines.get("npm")
    if not isinstance(spec, str):
        return None
    return parse_version(spec)


def detect_npm_version() -> tuple[int, ...] | None:
    try:
        result = subprocess.run(
            ["npm", "--version"],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    return parse_version(result.stdout)


def detect_bundler_version() -> tuple[int, ...] | None:
    try:
        result = subprocess.run(
            ["bundle", "-v"],
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    return parse_version(result.stdout or result.stderr)


def detect_npm_flat_config(root: Path) -> dict | None:
    try:
        result = subprocess.run(
            ["npm", "config", "list", "--json"],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def parse_npm_before(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def before_meets_min_age(
    before: datetime,
    *,
    now: datetime,
    min_days: int = MIN_RELEASE_AGE_DAYS,
) -> bool:
    if before.tzinfo is None:
        before = before.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    # npm materializes min-release-age as `before` (an absolute timestamp).
    # Allow two hours of slack for clock skew between write and check.
    return now - before >= timedelta(days=min_days) - timedelta(hours=2)


def live_npm_errors(
    root: Path,
    *,
    now: datetime | None = None,
    config: dict | None | str = "detect",
) -> list[str]:
    errors: list[str] = []
    if config == "detect":
        config = detect_npm_flat_config(root)
    if not config:
        return [f"npm config list --json failed in {root}; cannot verify live install policy."]
    if config.get("ignore-scripts") is not True:
        errors.append(
            f"npm ignore-scripts must be true in {root} (found {config.get('ignore-scripts')!r})."
        )
    if config.get("allow-git") != "none":
        errors.append(f"npm allow-git must be none in {root} (found {config.get('allow-git')!r}).")
    before_raw = config.get("before")
    before = parse_npm_before(before_raw) if isinstance(before_raw, str) else None
    if before is None or not before_meets_min_age(before, now=now or datetime.now(timezone.utc)):
        errors.append(
            f"npm min-release-age must resolve to a `before` date at least "
            f"{MIN_RELEASE_AGE_DAYS} days ago in {root} (found {before_raw!r})."
        )
    return errors


def check(
    root: Path,
    *,
    npm_version: tuple[int, ...] | None | str = "detect",
    bundler_version: tuple[int, ...] | None | str = "detect",
) -> list[str]:
    errors: list[str] = []
    errors.extend(npmrc_errors(root / ".npmrc", ".npmrc"))

    verify_live_npm = npm_version == "detect"
    if npm_version == "detect":
        npm_version = detect_npm_version()
    if npm_version is None:
        errors.append(
            f"npm >= {format_version(MIN_NPM)} is required for min-release-age; npm was not found."
        )
    elif npm_version < MIN_NPM:
        errors.append(
            f"npm >= {format_version(MIN_NPM)} is required for min-release-age "
            f"(found {format_version(npm_version)})."
        )
    elif verify_live_npm:
        errors.extend(live_npm_errors(root))

    frontend = root / "frontend"
    if frontend.is_dir():
        errors.extend(npmrc_errors(frontend / ".npmrc", "frontend/.npmrc"))
        package_json = frontend / "package.json"
        if package_json.is_file():
            engines_npm = package_engines_npm(package_json)
            if engines_npm is None or engines_npm < MIN_NPM:
                errors.append(
                    "frontend/package.json must set engines.npm to "
                    f">={format_version(MIN_NPM)} so older npm CLIs refuse to install."
                )
            if not (frontend / "package-lock.json").is_file():
                errors.append("frontend/package-lock.json must exist and be committed.")

    gemfiles = [path for path in (root / "Gemfile", root / "backend" / "Gemfile") if path.is_file()]
    if gemfiles:
        if bundler_version == "detect":
            bundler_version = detect_bundler_version()
        if bundler_version is None:
            errors.append(
                f"Bundler >= {format_version(MIN_BUNDLER)} is required for gem cooldown; "
                "bundle was not found."
            )
        elif bundler_version < MIN_BUNDLER:
            errors.append(
                f"Bundler >= {format_version(MIN_BUNDLER)} is required for gem cooldown "
                f"(found {format_version(bundler_version)}). Install it with "
                "`gem install bundler -v 4.0.20` before resolving gems."
            )
        for gemfile in gemfiles:
            label = gemfile.relative_to(root).as_posix()
            if not gemfile_has_rubygems_cooldown(gemfile.read_text()):
                errors.append(
                    f'{label} must declare source "https://rubygems.org", cooldown: 7'
                )
            lock = gemfile.with_name("Gemfile.lock")
            if not lock.is_file():
                errors.append(f"{lock.relative_to(root).as_posix()} must exist and be committed.")
    return errors


if __name__ == "__main__":
    failures = check(Path(__file__).resolve().parents[1])
    if failures:
        print("Supply-chain install checks failed:\n" + "\n".join(f"- {error}" for error in failures))
        sys.exit(1)
    print(
        "Supply-chain install policy OK: npm min-release-age "
        f"{MIN_RELEASE_AGE_DAYS}d and Bundler cooldown when a Gemfile exists."
    )
