#!/usr/bin/env python3
"""Tests for bin/fnba-cli, bin/git-wt, and bin/git-wt-remove."""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CLI = REPO_ROOT / "bin" / "fnba-cli"


def run(args, cwd, env=None, input_text=None):
    merged = os.environ.copy()
    if env:
        merged.update(env)
    merged.setdefault("GIT_CONFIG_NOSYSTEM", "1")
    merged.setdefault("GIT_TERMINAL_PROMPT", "0")
    result = subprocess.run(
        args,
        cwd=cwd,
        env=merged,
        input="" if input_text is None else input_text,
        text=True,
        capture_output=True,
        check=False,
    )
    return result


def git(cwd, *args):
    result = run(["git", *args], cwd)
    if result.returncode != 0:
        raise AssertionError(
            f"git {' '.join(args)} failed ({result.returncode})\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result


class FnbaCliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="fnba-cli-"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.repo = self.tmp / "fnba-drafter"
        self.repo.mkdir()
        git(self.repo, "init", "-b", "main")
        git(self.repo, "config", "user.email", "test@fnba.test")
        git(self.repo, "config", "user.name", "FNBA Test")
        git(self.repo, "config", "commit.gpgsign", "false")
        (self.repo / "README.md").write_text("fnba\n")
        git(self.repo, "add", "README.md")
        git(self.repo, "commit", "-m", "init")

    def cli(self, *args, cwd=None, input_text=None):
        return run([str(CLI), *args], cwd or self.repo, input_text=input_text)

    def worktree_paths(self):
        result = git(self.repo, "worktree", "list", "--porcelain")
        paths = []
        for line in result.stdout.splitlines():
            if line.startswith("worktree "):
                paths.append(str(Path(line[len("worktree ") :]).resolve()))
        return paths

    def branches(self):
        result = git(self.repo, "for-each-ref", "--format=%(refname:short)", "refs/heads")
        return [line for line in result.stdout.splitlines() if line]

    def test_help_and_shell_init(self):
        help_result = self.cli("help")
        self.assertEqual(help_result.returncode, 0, help_result.stderr)
        self.assertIn("fnba-cli wt", help_result.stdout)
        self.assertIn("(no args)", help_result.stdout)
        init = self.cli("shell-init")
        self.assertEqual(init.returncode, 0, init.stderr)
        self.assertIn("alias fnba-cli=", init.stdout)
        self.assertIn(str(CLI), init.stdout)

    def test_root_menu_quit(self):
        result = self.cli(input_text="q\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Create a worktree", result.stdout)
        self.assertIn("Remove a worktree", result.stdout)
        self.assertIn("Exiting", result.stdout)

    def test_root_menu_eof_quits(self):
        result = self.cli()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Create a worktree", result.stdout)
        self.assertIn("Exiting", result.stdout)

    def test_root_menu_help(self):
        result = self.cli(input_text="h\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("fnba-cli wt", result.stdout)

    def test_root_menu_invalid_then_quit(self):
        result = self.cli(input_text="nope\nq\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Invalid selection: nope", result.stdout)
        self.assertIn("Exiting", result.stdout)

    def test_root_menu_create(self):
        result = self.cli(input_text="1\nft/from-menu\n")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        expected = (self.tmp / "fnba-drafter-worktrees" / "ft-from-menu").resolve()
        self.assertTrue(expected.is_dir(), result.stdout)
        self.assertIn(str(expected), self.worktree_paths())
        self.assertIn("ft/from-menu", self.branches())

    def test_root_menu_remove(self):
        created = self.cli("wt", "ft/board")
        self.assertEqual(created.returncode, 0, created.stderr)
        expected = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        removed = self.cli(input_text="2\n1\ny\n")
        self.assertEqual(removed.returncode, 0, removed.stdout + removed.stderr)
        self.assertFalse(expected.exists())
        self.assertNotIn("ft/board", self.branches())

    def test_unknown_command(self):
        result = self.cli("not-a-command")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Unknown command", result.stderr)

    def test_refuses_other_repo_name(self):
        other = self.tmp / "other-repo"
        other.mkdir()
        git(other, "init", "-b", "main")
        git(other, "config", "user.email", "test@fnba.test")
        git(other, "config", "user.name", "FNBA Test")
        git(other, "config", "commit.gpgsign", "false")
        (other / "README.md").write_text("other\n")
        git(other, "add", "README.md")
        git(other, "commit", "-m", "init")
        result = run([str(CLI), "wt", "ft/x"], other)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("only works in the fnba-drafter repository", result.stderr)

    def test_fast_path_requires_main(self):
        git(self.repo, "checkout", "-b", "side")
        result = self.cli("wt", "ft/board")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Must be on 'main'", result.stderr)

    def test_creates_worktree_from_main(self):
        result = self.cli("wt", "ft/board")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        expected = (self.tmp / "fnba-drafter-worktrees" / "ft-board").resolve()
        self.assertTrue(expected.is_dir(), result.stdout)
        self.assertIn(str(expected), self.worktree_paths())
        self.assertIn("ft/board", self.branches())
        self.assertEqual(
            git(expected, "branch", "--show-current").stdout.strip(), "ft/board"
        )

    def test_slash_branch_becomes_hyphen_directory(self):
        result = self.cli("wt", "feat/projections/v2")
        self.assertEqual(result.returncode, 0, result.stderr)
        expected = self.tmp / "fnba-drafter-worktrees" / "feat-projections-v2"
        self.assertTrue(expected.is_dir())

    def test_refuses_existing_local_branch(self):
        git(self.repo, "branch", "ft/stale")
        result = self.cli("wt", "ft/stale")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("already exists", result.stderr)
        self.assertFalse((self.tmp / "fnba-drafter-worktrees" / "ft-stale").exists())

    def test_refuses_duplicate_worktree(self):
        first = self.cli("wt", "ft/board")
        self.assertEqual(first.returncode, 0, first.stderr)
        second = self.cli("wt", "ft/board")
        self.assertNotEqual(second.returncode, 0)
        self.assertIn("already has a worktree", second.stderr)

    def test_remove_worktree_and_branch(self):
        created = self.cli("wt", "ft/board")
        self.assertEqual(created.returncode, 0, created.stderr)
        expected = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        removed = self.cli("wt-remove", "ft/board", "-y")
        self.assertEqual(removed.returncode, 0, removed.stdout + removed.stderr)
        self.assertFalse(expected.exists())
        self.assertNotIn("ft/board", self.branches())
        self.assertEqual(self.worktree_paths(), [str(self.repo.resolve())])

    def test_remove_refuses_primary(self):
        result = self.cli("wt-remove", "main", "-y")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("primary worktree", result.stderr)

    def test_remove_refuses_when_cwd_is_the_worktree(self):
        created = self.cli("wt", "ft/board")
        self.assertEqual(created.returncode, 0, created.stderr)
        expected = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        result = self.cli("wt-remove", "ft/board", "-y", cwd=expected)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("inside the worktree being removed", result.stderr)
        self.assertTrue(expected.is_dir())

    def test_remove_dirty_requires_force(self):
        created = self.cli("wt", "ft/board")
        self.assertEqual(created.returncode, 0, created.stderr)
        expected = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        (expected / "dirty.txt").write_text("nope\n")
        blocked = self.cli("wt-remove", "ft/board", "-y")
        self.assertNotEqual(blocked.returncode, 0)
        self.assertIn("--force", blocked.stderr)
        self.assertTrue(expected.is_dir())
        forced = self.cli("wt-remove", "ft/board", "-y", "--force")
        self.assertEqual(forced.returncode, 0, forced.stdout + forced.stderr)
        self.assertFalse(expected.exists())

    def test_remove_missing_branch(self):
        result = self.cli("wt-remove", "does-not-exist", "-y")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no worktree found", result.stderr)

    def test_interactive_remove_aborts_without_removable(self):
        result = self.cli("wt-remove")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("No removable worktrees found", result.stdout)

    def test_direct_scripts_and_aliases(self):
        via_alias = self.cli("git-wt", "ft/one")
        self.assertEqual(via_alias.returncode, 0, via_alias.stderr)
        via_remove_alias = self.cli("remove", "ft/one", "-y")
        self.assertEqual(via_remove_alias.returncode, 0, via_remove_alias.stderr)
        direct = run([str(REPO_ROOT / "bin" / "git-wt"), "ft/two"], self.repo)
        self.assertEqual(direct.returncode, 0, direct.stderr)
        direct_rm = run(
            [str(REPO_ROOT / "bin" / "git-wt-remove"), "ft/two", "-y"], self.repo
        )
        self.assertEqual(direct_rm.returncode, 0, direct_rm.stderr)

    def test_tracks_origin_branch_when_present(self):
        git(self.repo, "checkout", "-b", "ft/remote")
        git(self.repo, "commit", "--allow-empty", "-m", "on remote branch")
        git(self.repo, "checkout", "main")
        origin = self.tmp / "origin.git"
        git(self.repo, "clone", "--bare", str(self.repo), str(origin))
        git(self.repo, "remote", "add", "origin", str(origin))
        git(self.repo, "fetch", "origin")
        git(self.repo, "branch", "-D", "ft/remote")
        result = self.cli("wt", "ft/remote")
        self.assertEqual(result.returncode, 0, result.stderr)
        expected = self.tmp / "fnba-drafter-worktrees" / "ft-remote"
        log = git(expected, "log", "-1", "--pretty=%s").stdout.strip()
        self.assertEqual(log, "on remote branch")


if __name__ == "__main__":
    unittest.main()
