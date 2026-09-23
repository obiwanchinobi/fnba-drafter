#!/usr/bin/env python3
"""Tests for bin/fnba-cli, bin/git-wt, and bin/git-wt-remove."""

import json
import os
import shutil
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
CLI = REPO_ROOT / "bin" / "fnba-cli"

FAKE_PG_SCRIPT = r"""#!/usr/bin/env python3
import json
import os
import re
import sys
from pathlib import Path

state_path = Path(os.environ["FNBA_FAKE_PG_STATE"])
log_path = Path(os.environ["FNBA_FAKE_PG_LOG"])
cmd = Path(sys.argv[0]).name
args = sys.argv[1:]
log_path.parent.mkdir(parents=True, exist_ok=True)
with log_path.open("a", encoding="utf-8") as handle:
    handle.write(cmd + (" " + " ".join(args) if args else "") + "\n")


def load_state():
    if state_path.exists():
        return json.loads(state_path.read_text(encoding="utf-8"))
    return {"dbs": ["fnba_drafter_development"]}


def save_state(state):
    state_path.write_text(json.dumps(state), encoding="utf-8")


state = load_state()
dbs = set(state.get("dbs", []))

if cmd == "createdb":
    if args[:1] == ["-T"]:
        src, target = args[1], args[2]
        if src not in dbs:
            sys.exit(1)
        dbs.add(target)
        save_state({"dbs": sorted(dbs)})
        sys.exit(0)
    target = args[-1]
    dbs.add(target)
    save_state({"dbs": sorted(dbs)})
    sys.exit(0)

if cmd == "dropdb":
    dbs.discard(args[-1])
    save_state({"dbs": sorted(dbs)})
    sys.exit(0)

if cmd == "pg_dump":
    src = args[-1]
    if src not in dbs:
        sys.exit(1)
    print("-- fake dump")
    sys.exit(0)

if cmd == "psql":
    if "-lqt" in args or "-l" in args:
        for db in sorted(dbs):
            print(f" {db} | owner | UTF8")
        sys.exit(0)
    query = ""
    if "-Atc" in args:
        query = args[args.index("-Atc") + 1]
    elif "-c" in args:
        query = args[args.index("-c") + 1]
        sys.exit(0)
    if "LIKE" in query.upper():
        match = re.search(r"LIKE '([^']+)'", query)
        pat = match.group(1) if match else ""
        prefix = pat.replace("\\_", "_")
        if prefix.endswith("%"):
            prefix = prefix[:-1]
        for db in sorted(dbs):
            if db.startswith(prefix):
                print(db)
        sys.exit(0)
    sys.exit(0)

sys.exit(0)
"""


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


class FnbaCliHarness(unittest.TestCase):
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
        # Real backend/.gitignore and frontend/.gitignore hide the port env
        # files. Without that, git worktree remove treats them as untracked.
        backend_ignore = self.repo / "backend" / ".gitignore"
        frontend_ignore = self.repo / "frontend" / ".gitignore"
        backend_ignore.parent.mkdir(parents=True, exist_ok=True)
        frontend_ignore.parent.mkdir(parents=True, exist_ok=True)
        backend_ignore.write_text("/.env*\n")
        frontend_ignore.write_text("*.local\n")
        git(self.repo, "add", "README.md", "backend/.gitignore", "frontend/.gitignore")
        git(self.repo, "commit", "-m", "init")

    def cli(self, *args, cwd=None, input_text=None, env=None):
        merged = {"FNBA_CONFIG_DIR": str(self.tmp / "config")}
        if env:
            merged.update(env)
        return run(
            [str(CLI), *args], cwd or self.repo, env=merged, input_text=input_text
        )

    def install_fake_pg(self):
        fake_bin = self.tmp / "fake-pg-bin"
        fake_bin.mkdir()
        script = fake_bin / "_fake_pg.py"
        script.write_text(FAKE_PG_SCRIPT)
        script.chmod(script.stat().st_mode | stat.S_IEXEC)
        for name in ("psql", "createdb", "dropdb", "pg_dump"):
            dest = fake_bin / name
            dest.symlink_to(script)
        state = self.tmp / "fake-pg-state.json"
        log = self.tmp / "fake-pg.log"
        state.write_text(json.dumps({"dbs": ["fnba_drafter_development"]}))
        log.write_text("")
        return {
            "PATH": f"{fake_bin}{os.pathsep}{os.environ.get('PATH', '')}",
            "FNBA_FAKE_PG_STATE": str(state),
            "FNBA_FAKE_PG_LOG": str(log),
            "FNBA_CONFIG_DIR": str(self.tmp / "config"),
        }

    def fake_pg_log(self, env):
        return Path(env["FNBA_FAKE_PG_LOG"]).read_text(encoding="utf-8")

    def port_registry_rows(self):
        path = self.tmp / "config" / "worktree-ports"
        if not path.exists():
            return []
        rows = []
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            base_text, slug = line.split("\t")
            rows.append((int(base_text), slug))
        return rows

    def add_stub_database_yml(self):
        yml = self.repo / "backend" / "config" / "database.yml"
        yml.parent.mkdir(parents=True, exist_ok=True)
        yml.write_text("test: true\n")
        gitignore = self.repo / "backend" / ".gitignore"
        gitignore.write_text("/.env*\n")
        git(self.repo, "add", "backend/config/database.yml", "backend/.gitignore")
        git(self.repo, "commit", "-m", "stub database.yml")

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


class FnbaCliTest(FnbaCliHarness):
    def test_help_and_shell_init(self):
        help_result = self.cli("help")
        self.assertEqual(help_result.returncode, 0, help_result.stderr)
        self.assertIn("fnba-cli wt", help_result.stdout)
        self.assertIn("(no args)", help_result.stdout)
        self.assertIn("wt-refresh-db", help_result.stdout)
        init = self.cli("shell-init")
        self.assertEqual(init.returncode, 0, init.stderr)
        self.assertIn("alias fnba-cli=", init.stdout)
        self.assertIn(str(CLI), init.stdout)

    def test_root_menu_quit(self):
        result = self.cli(input_text="q\n")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Create a worktree", result.stdout)
        self.assertIn("Refresh this worktree's DB", result.stdout)
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
        removed = self.cli(input_text="3\n1\ny\n")
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
        result = run(
            [str(CLI), "wt", "ft/x"],
            other,
            env={"FNBA_CONFIG_DIR": str(self.tmp / "config")},
        )
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
        config_env = {"FNBA_CONFIG_DIR": str(self.tmp / "config")}
        direct = run(
            [str(REPO_ROOT / "bin" / "git-wt"), "ft/two"], self.repo, env=config_env
        )
        self.assertEqual(direct.returncode, 0, direct.stderr)
        direct_rm = run(
            [str(REPO_ROOT / "bin" / "git-wt-remove"), "ft/two", "-y"],
            self.repo,
            env=config_env,
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

    def test_create_allocates_port_block(self):
        result = self.cli("wt", "ft/board")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        rows = self.port_registry_rows()
        self.assertEqual(len(rows), 1, rows)
        base, slug = rows[0]
        self.assertGreaterEqual(base, 4100)
        self.assertEqual(base % 10, 0)
        self.assertEqual(slug, "ft_board")
        worktree = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        backend = (worktree / "backend" / ".env.local").read_text(encoding="utf-8")
        frontend = (worktree / "frontend" / ".env.local").read_text(encoding="utf-8")
        self.assertRegex(backend, rf"(?m)^FNBA_PORT_BASE={base}$")
        self.assertRegex(backend, rf"(?m)^PORT={base}$")
        self.assertRegex(backend, rf"(?m)^FRONTEND_PORT={base + 1}$")
        self.assertIn("# Per-worktree port block (managed by fnba-cli wt)", backend)
        self.assertRegex(frontend, rf"(?m)^VITE_PORT={base + 1}$")
        self.assertRegex(frontend, rf"(?m)^VITE_API_URL=http://127\.0\.0\.1:{base}$")
        self.assertIn("# Per-worktree port block (managed by fnba-cli wt)", frontend)
        self.assertIn(f"Ports: Rails :{base} · Vite :{base + 1}", result.stdout)

    def test_second_worktree_gets_next_block(self):
        first = self.cli("wt", "ft/board")
        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        second = self.cli("wt", "ft/other")
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        rows = self.port_registry_rows()
        self.assertEqual(len(rows), 2, rows)
        bases = []
        slugs = set()
        for base, slug in rows:
            self.assertGreaterEqual(base, 4100)
            self.assertEqual(base % 10, 0)
            bases.append(base)
            slugs.add(slug)
        self.assertEqual(slugs, {"ft_board", "ft_other"})
        self.assertEqual(len(set(bases)), 2)
        self.assertEqual(abs(bases[0] - bases[1]), 10)

    def test_remove_releases_port_block(self):
        created = self.cli("wt", "ft/board")
        self.assertEqual(created.returncode, 0, created.stdout + created.stderr)
        self.assertEqual([slug for _, slug in self.port_registry_rows()], ["ft_board"])
        removed = self.cli("wt-remove", "ft/board", "-y")
        self.assertEqual(removed.returncode, 0, removed.stdout + removed.stderr)
        self.assertNotIn("ft_board", [slug for _, slug in self.port_registry_rows()])
        self.assertIn("Rails :", removed.stdout)
        self.assertIn("Released port block :", removed.stdout)

    def test_create_is_idempotent_for_registered_slug(self):
        config = self.tmp / "config"
        config.mkdir(parents=True)
        (config / "worktree-ports").write_text("4120\tft_board\n", encoding="utf-8")
        result = self.cli("wt", "ft/board")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.port_registry_rows(), [(4120, "ft_board")])
        worktree = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        backend = (worktree / "backend" / ".env.local").read_text(encoding="utf-8")
        frontend = (worktree / "frontend" / ".env.local").read_text(encoding="utf-8")
        self.assertRegex(backend, r"(?m)^FNBA_PORT_BASE=4120$")
        self.assertRegex(backend, r"(?m)^PORT=4120$")
        self.assertRegex(backend, r"(?m)^FRONTEND_PORT=4121$")
        self.assertRegex(frontend, r"(?m)^VITE_PORT=4121$")
        self.assertRegex(frontend, r"(?m)^VITE_API_URL=http://127\.0\.0\.1:4120$")


class FnbaCliWorktreeDbTest(FnbaCliHarness):
    def setUp(self):
        super().setUp()
        self.add_stub_database_yml()
        self.pg = self.install_fake_pg()

    def env_text(self, worktree, name):
        return (worktree / "backend" / name).read_text(encoding="utf-8")

    def test_no_db_skips_createdb(self):
        result = self.cli("wt", "ft/board", "--no-db", env=self.pg)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        expected = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        self.assertTrue(expected.is_dir(), result.stdout)
        log = self.fake_pg_log(self.pg)
        self.assertNotIn("createdb", log)
        env_local = expected / "backend" / ".env.local"
        text = env_local.read_text(encoding="utf-8") if env_local.exists() else ""
        self.assertNotIn("FNBA_DB_NAME", text)
        self.assertFalse((expected / "backend" / ".env.test.local").exists())

    def test_create_writes_isolated_db_env_files(self):
        result = self.cli("wt", "ft/board", env=self.pg)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        worktree = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        local = self.env_text(worktree, ".env.local")
        test_local = self.env_text(worktree, ".env.test.local")
        self.assertIn("FNBA_DB_NAME=fnba_dev_ft_board", local)
        self.assertIn("FNBA_TEST_DB_NAME=fnba_test_ft_board", local)
        self.assertIn("FNBA_TEST_DB_NAME=fnba_test_ft_board", test_local)
        self.assertNotIn("FNBA_DB_NAME=", test_local)
        log = self.fake_pg_log(self.pg)
        self.assertIn("createdb", log)
        self.assertIn("fnba_dev_ft_board", result.stdout)
        self.assertIn("fnba_test_ft_board", result.stdout)

    def test_no_db_still_allocates_ports(self):
        result = self.cli("wt", "ft/board", "--no-db", env=self.pg)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        worktree = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        backend = (worktree / "backend" / ".env.local").read_text(encoding="utf-8")
        frontend = (worktree / "frontend" / ".env.local").read_text(encoding="utf-8")
        self.assertNotIn("FNBA_DB_NAME", backend)
        self.assertRegex(backend, r"(?m)^FNBA_PORT_BASE=\d+$")
        self.assertRegex(backend, r"(?m)^PORT=\d+$")
        self.assertRegex(backend, r"(?m)^FRONTEND_PORT=\d+$")
        self.assertRegex(frontend, r"(?m)^VITE_PORT=\d+$")
        self.assertRegex(frontend, r"(?m)^VITE_API_URL=http://127\.0\.0\.1:\d+$")
        rows = self.port_registry_rows()
        self.assertEqual(len(rows), 1, rows)
        base, slug = rows[0]
        self.assertGreaterEqual(base, 4100)
        self.assertEqual(base % 10, 0)
        self.assertEqual(slug, "ft_board")
        self.assertRegex(backend, rf"(?m)^PORT={base}$")
        self.assertRegex(backend, rf"(?m)^FRONTEND_PORT={base + 1}$")
        self.assertNotIn("createdb", self.fake_pg_log(self.pg))
        self.assertFalse((worktree / "backend" / ".env.test.local").exists())

    def test_remove_drops_isolated_databases(self):
        created = self.cli("wt", "ft/board", env=self.pg)
        self.assertEqual(created.returncode, 0, created.stdout + created.stderr)
        removed = self.cli("wt-remove", "ft/board", "-y", env=self.pg)
        self.assertEqual(removed.returncode, 0, removed.stdout + removed.stderr)
        log = self.fake_pg_log(self.pg)
        self.assertRegex(log, r"(?m)^dropdb fnba_dev_ft_board$")
        self.assertRegex(log, r"(?m)^dropdb fnba_test_ft_board$")
        self.assertIn("fnba_dev_ft_board", removed.stdout)
        self.assertIn("fnba_test_ft_board", removed.stdout)

    def test_refresh_bootstrap_writes_env_on_linked_worktree(self):
        created = self.cli("wt", "ft/board", "--no-db", env=self.pg)
        self.assertEqual(created.returncode, 0, created.stdout + created.stderr)
        worktree = self.tmp / "fnba-drafter-worktrees" / "ft-board"
        refreshed = self.cli("wt-refresh-db", cwd=worktree, env=self.pg)
        self.assertEqual(refreshed.returncode, 0, refreshed.stdout + refreshed.stderr)
        local = self.env_text(worktree, ".env.local")
        test_local = self.env_text(worktree, ".env.test.local")
        self.assertIn("FNBA_DB_NAME=fnba_dev_ft_board", local)
        self.assertIn("FNBA_TEST_DB_NAME=fnba_test_ft_board", local)
        self.assertIn("FNBA_TEST_DB_NAME=fnba_test_ft_board", test_local)
        log = self.fake_pg_log(self.pg)
        self.assertIn("createdb", log)

    def test_refresh_db_aliases_and_help(self):
        help_result = self.cli("help")
        self.assertIn("refresh", help_result.stdout.lower())
        for command in ("wt-refresh-db", "git-wt-refresh-db", "refresh-db"):
            result = self.cli(command, "-h")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertRegex(result.stdout.lower(), r"refresh|bootstrap")


if __name__ == "__main__":
    unittest.main()
