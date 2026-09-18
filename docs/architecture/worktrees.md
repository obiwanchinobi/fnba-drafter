# Parallel worktrees

FNBA uses git worktrees so two sessions never share one `HEAD` and index. The committed CLI is `bin/fnba-cli`; it dispatches to `bin/git-wt`, `bin/git-wt-refresh-db`, and `bin/git-wt-remove`. Those scripts are specific to this repository. Do not point the POHQ `git-wt` alias at this clone.

## Install the alias

The alias is defined by the repo. Add this to `~/.zshrc` (or `~/.bashrc`) once, pointing at **this** clone's primary checkout:

```bash
eval "$(/path/to/fnba-drafter/bin/fnba-cli shell-init)"
```

That prints and applies:

```bash
alias fnba-cli='/path/to/fnba-drafter/bin/fnba-cli'
```

Keep the POHQ `git-wt` / `git-wt-remove` aliases unchanged. `fnba-cli` is a different command. The primary checkout directory must be named `fnba-drafter` (the CLI keys off that, not the remote URL).

## Commands

```bash
fnba-cli                             # interactive menu: create, refresh DB, or remove
fnba-cli wt ft/board                 # from main: new branch + worktree + isolated DBs
fnba-cli wt ft/board --no-db         # skip DB clone; shares main's databases
fnba-cli wt                          # interactive create
fnba-cli wt-refresh-db               # from a linked worktree: bootstrap or re-clone
fnba-cli wt-remove ft/board          # confirm, then remove worktree + drop DBs + delete branch
fnba-cli wt-remove ft/board -y       # skip confirm
fnba-cli wt-remove ft/board --force  # dirty worktree
fnba-cli wt-remove                   # picker; c) cleanup by age
fnba-cli help
```

`fnba-cli git-wt`, `fnba-cli git-wt-refresh-db` / `fnba-cli refresh-db`, and `fnba-cli git-wt-remove` / `fnba-cli remove` are aliases for the same commands. `bin/git-wt`, `bin/git-wt-refresh-db`, and `bin/git-wt-remove` also run directly.

Fast path (`wt <branch>`) must run from the primary checkout on `main`. It refuses a stale local branch of the same name. If `origin/<branch>` exists, the worktree tracks that ref; otherwise the branch starts at `main`.

## Layout

Worktrees land next to the primary clone, not inside it:

```text
sandbox/
  fnba-drafter/                 # primary checkout (main)
  fnba-drafter-worktrees/
    ft-board/                   # branch ft/board
    feat-projections/           # branch feat/projections
```

Slashes in the branch name become hyphens in the directory name. Removal refuses the primary checkout and refuses to run from inside the worktree being deleted. `--force` fallback `rm -rf` only applies under `fnba-drafter-worktrees/`.

## Isolated Postgres databases

`fnba-cli wt` clones `fnba_drafter_development` into `fnba_dev_<slug>` and creates an empty `fnba_test_<slug>`. It then writes `FNBA_DB_NAME` / `FNBA_TEST_DB_NAME` to `backend/.env.local` and `FNBA_TEST_DB_NAME` to `backend/.env.test.local` (dotenv skips `.env.local` when `RAILS_ENV=test`). `backend/config/database.yml` reads those env vars and falls back to `fnba_drafter_development` / `fnba_drafter_test` on main.

`--no-db` skips clone and env writes. The worktree then shares main's databases until you run `fnba-cli wt-refresh-db` from inside it.

`wt-refresh-db` **bootstraps** when `FNBA_DB_NAME` is unset (same as create) and **refreshes** when it is set (drop + re-clone the dev DB from main; the test DB is kept). After either mode, `./bin/rails db:migrate` runs if the worktree already has a bundle; otherwise `bin/setup` will `db:prepare` later.

`fnba-cli wt-remove` drops the recorded isolated DBs (and that test DB's `_*` parallel workers). It never drops `fnba_drafter_development`, `fnba_drafter_test`, or `fnba_drafter_test_*`.

The new checkout still needs `bin/setup` before `bin/dev` or tests. Isolation is extra **databases**, not extra git worktrees named "dev" and "test".

## What this does not copy from POHQ

The scripts do **not** allocate ports, write Caddy sites, or copy `node_modules` / gems. One `bin/dev` at a time on 3000/5173. Do not reuse `pohq/bin/git-wt*` in this clone.

cmux opens the new worktree when it is installed and stdout is a TTY.

## Tests

```sh
python3 scripts/test_fnba_cli.py
```
