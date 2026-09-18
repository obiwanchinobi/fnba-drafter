#!/usr/bin/env python3
"""Tests for scripts/check_supply_chain.py."""

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from datetime import datetime, timedelta, timezone

from check_supply_chain import (
    before_meets_min_age,
    check,
    gemfile_has_rubygems_cooldown,
    live_npm_errors,
    parse_npm_before,
    parse_npmrc,
)

REPO_ROOT = Path(__file__).resolve().parents[1]

VALID_NPMRC = """# test
min-release-age=7
ignore-scripts=true
allow-git=none
save-exact=true
package-lock=true
audit=true
engine-strict=true
"""

VALID_GEMFILE = """source "https://rubygems.org", cooldown: 7

gem "rails", "8.1.3"
"""


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


class SupplyChainCheckTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="fnba-supply-chain-"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def check(self, **kwargs):
        defaults = {"npm_version": (11, 13, 0), "bundler_version": (4, 0, 20)}
        defaults.update(kwargs)
        return check(self.tmp, **defaults)

    def test_npm_before_date_is_seven_days(self):
        now = datetime(2026, 9, 18, 8, 21, tzinfo=timezone.utc)
        before = parse_npm_before("2026-09-11T08:21:56.386Z")
        self.assertIsNotNone(before)
        self.assertTrue(before_meets_min_age(before, now=now))
        too_new = now - timedelta(days=1)
        self.assertFalse(before_meets_min_age(too_new, now=now))

    def test_live_npm_errors_from_flat_config(self):
        now = datetime(2026, 9, 18, 8, 21, tzinfo=timezone.utc)
        ok = {
            "ignore-scripts": True,
            "allow-git": "none",
            "before": "2026-09-11T08:21:56.386Z",
        }
        self.assertEqual(live_npm_errors(self.tmp, now=now, config=ok), [])
        bad = dict(ok)
        bad["before"] = "2026-09-17T08:21:56.386Z"
        errors = live_npm_errors(self.tmp, now=now, config=bad)
        self.assertTrue(any("before" in error for error in errors))

    def test_parse_npmrc_ignores_comments(self):
        path = self.tmp / ".npmrc"
        write(path, VALID_NPMRC)
        values = parse_npmrc(path)
        self.assertEqual(values["min-release-age"], "7")
        self.assertEqual(values["allow-git"], "none")

    def test_gemfile_cooldown_pattern(self):
        self.assertTrue(gemfile_has_rubygems_cooldown(VALID_GEMFILE))
        self.assertTrue(
            gemfile_has_rubygems_cooldown("source 'https://rubygems.org', cooldown: 7\n")
        )
        self.assertFalse(
            gemfile_has_rubygems_cooldown('source "https://rubygems.org"\n')
        )

    def test_missing_root_npmrc(self):
        errors = self.check()
        self.assertTrue(any("Missing .npmrc" in error for error in errors))

    def test_incomplete_npmrc(self):
        write(self.tmp / ".npmrc", "min-release-age=1\n")
        errors = self.check()
        self.assertTrue(any("min-release-age=7" in error for error in errors))
        self.assertTrue(any("ignore-scripts=true" in error for error in errors))

    def test_root_npmrc_ok_without_apps(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        self.assertEqual(self.check(), [])

    def test_old_npm_is_rejected(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        errors = self.check(npm_version=(11, 9, 0))
        self.assertTrue(any("npm >= 11.10.0" in error for error in errors))

    def test_missing_npm_binary(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        errors = self.check(npm_version=None)
        self.assertTrue(any("npm was not found" in error for error in errors))

    def test_frontend_requires_npmrc_and_lockfile(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        write(self.tmp / "frontend" / "package.json", json.dumps({"name": "web"}))
        errors = self.check()
        self.assertTrue(any("frontend/.npmrc" in error for error in errors))
        self.assertTrue(any("engines.npm" in error for error in errors))
        self.assertTrue(any("package-lock.json" in error for error in errors))

    def test_frontend_ok(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        write(self.tmp / "frontend" / ".npmrc", VALID_NPMRC)
        write(
            self.tmp / "frontend" / "package.json",
            json.dumps({"name": "web", "engines": {"npm": ">=11.10.0"}}),
        )
        write(self.tmp / "frontend" / "package-lock.json", "{}\n")
        self.assertEqual(self.check(), [])

    def test_backend_requires_cooldown_and_lockfile(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        write(self.tmp / "backend" / "Gemfile", 'source "https://rubygems.org"\n')
        errors = self.check()
        self.assertTrue(any("cooldown: 7" in error for error in errors))
        self.assertTrue(any("Gemfile.lock" in error for error in errors))

    def test_old_bundler_rejected_when_gemfile_exists(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        write(self.tmp / "backend" / "Gemfile", VALID_GEMFILE)
        write(self.tmp / "backend" / "Gemfile.lock", "GEM\n")
        errors = self.check(bundler_version=(2, 4, 15))
        self.assertTrue(any("Bundler >= 4.0.13" in error for error in errors))

    def test_backend_ok(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        write(self.tmp / "backend" / "Gemfile", VALID_GEMFILE)
        write(self.tmp / "backend" / "Gemfile.lock", "GEM\n")
        self.assertEqual(self.check(), [])

    def test_old_bundler_ok_without_gemfile(self):
        write(self.tmp / ".npmrc", VALID_NPMRC)
        self.assertEqual(self.check(bundler_version=(2, 4, 15)), [])

    def test_this_repository_passes(self):
        errors = check(REPO_ROOT, npm_version=(11, 13, 0), bundler_version=(2, 4, 15))
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
