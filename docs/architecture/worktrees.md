# Parallel worktrees

FNBA uses git worktrees so two sessions never share one `HEAD` and index. The committed CLI is `bin/fnba-cli`; it dispatches to `bin/git-wt`, `bin/git-wt-refresh-db`, `bin/git-wt-remove`, and `bin/dev-proxy`. Those scripts are specific to this repository. Do not point the POHQ `git-wt` alias at this clone.

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
fnba-cli                             # interactive menu: create, refresh DB, remove, or dev proxy
fnba-cli wt ft/board                 # from main: new branch + worktree + isolated DBs
fnba-cli wt ft/board --no-db         # skip DB clone; shares main's databases
fnba-cli wt                          # interactive create
fnba-cli wt-refresh-db               # from a linked worktree: bootstrap or re-clone
fnba-cli wt-remove ft/board          # confirm, then remove worktree + drop DBs + delete branch
fnba-cli wt-remove ft/board -y       # skip confirm
fnba-cli wt-remove ft/board --force  # dirty worktree
fnba-cli wt-remove                   # picker; c) cleanup by age
fnba-cli dev-proxy                   # once per machine: plain HTTP :8080, admin :2029
fnba-cli help
```

`fnba-cli git-wt`, `fnba-cli git-wt-refresh-db` / `fnba-cli refresh-db`, and `fnba-cli git-wt-remove` / `fnba-cli remove` are aliases for the same commands. `bin/git-wt`, `bin/git-wt-refresh-db`, `bin/git-wt-remove`, and `bin/dev-proxy` also run directly.

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

The port registry and Caddy config sit outside the repo. `FNBA_CONFIG_DIR` overrides this root (default `~/.config/fnba/`):

```text
~/.config/fnba/
  worktree-ports                # <base><TAB><slug>, one linked worktree per line
  Caddyfile                     # plain HTTP proxy; admin localhost:2029
  caddy/                        # one <host-slug>.caddy site per linked worktree
```

Slashes in the branch name become hyphens in the directory name. Removal refuses the primary checkout and refuses to run from inside the worktree being deleted. `--force` fallback `rm -rf` only applies under `fnba-drafter-worktrees/`.

## Isolated Postgres databases

`fnba-cli wt` clones `fnba_drafter_development` into `fnba_dev_<slug>` and creates an empty `fnba_test_<slug>`. It then writes `FNBA_DB_NAME` / `FNBA_TEST_DB_NAME` to `backend/.env.local` and `FNBA_TEST_DB_NAME` to `backend/.env.test.local` (dotenv skips `.env.local` when `RAILS_ENV=test`). `backend/config/database.yml` reads those env vars and falls back to `fnba_drafter_development` / `fnba_drafter_test` on main.

`--no-db` skips the database clone and the `FNBA_DB_NAME` / `FNBA_TEST_DB_NAME` writes. The port block and Caddy site are still written. The worktree then shares main's databases until you run `fnba-cli wt-refresh-db` from inside it.

`wt-refresh-db` **bootstraps** when `FNBA_DB_NAME` is unset (same as create) and **refreshes** when it is set (drop + re-clone the dev DB from main; the test DB is kept). After either mode, `./bin/rails db:migrate` runs if the worktree already has a bundle; otherwise `bin/setup` will `db:prepare` later.

`fnba-cli wt-remove` drops the recorded isolated DBs (and that test DB's `_*` parallel workers). It never drops `fnba_drafter_development`, `fnba_drafter_test`, or `fnba_drafter_test_*`.

The new checkout still needs `bin/setup` before `bin/dev` or tests. Isolation is extra **databases**, not extra git worktrees named "dev" and "test".

## Ports and hostnames

`fnba-cli wt` allocates a Rails/Vite port block for every linked worktree, including with `--no-db`, and records it in `~/.config/fnba/worktree-ports` (`$FNBA_CONFIG_DIR/worktree-ports` when that variable is set). Each line is `<base><TAB><slug>` (`slug` is `fnba_db_slug` of the branch). Bases start at 4100 and step by 10. Rails listens on `base`; Vite listens on `base+1`. There is no Redis port.

`fnba_write_port_block` appends this block once, guarded by an existing `FNBA_PORT_BASE=` line:

| File | Key | Value |
|---|---|---|
| `backend/.env.local` | `FNBA_PORT_BASE` | `<base>` |
| `backend/.env.local` | `PORT` | `<base>` |
| `backend/.env.local` | `FRONTEND_PORT` | `<base+1>` |
| `backend/.env.local` | `FNBA_HOST_SLUG` | `<hs>` (registry slug with `_` turned into `-`, lower-cased) |
| `backend/.env.local` | `FRONTEND_ORIGIN` | `http://<hs>.fnba.localhost:8080` |
| `frontend/.env.local` | `VITE_PORT` | `<base+1>` |
| `frontend/.env.local` | `VITE_API_URL` | `http://127.0.0.1:<base>` |

The primary checkout keeps Rails on 3000 and Vite on 5173. It gets no `.env.local` port block and no Caddy site. `bin/dev` falls back to that primary-checkout pair, 3000 and 5173, when `PORT` and `FRONTEND_PORT` are unset. If allocation fails, the worktree still exists and uses the same primary-checkout fallback, 3000 and 5173.

`bin/dev-proxy` (also `fnba-cli dev-proxy`) runs once per machine. It is plain HTTP on `:8080` with the Caddy admin API on `localhost:2029`, because pohq's Caddy already owns `:443`, `:80`, and admin `:2019`. A linked worktree is browsed at `http://<slug>.fnba.localhost:8080`, where `<slug>` is `FNBA_HOST_SLUG`, reverse-proxied to Vite on `base+1`. There is no `api.` host and no site for the primary checkout. `bin/dev` prints that URL when `FNBA_HOST_SLUG` is set; until the proxy is running, use the direct Vite URL it also prints.

`fnba-cli wt-remove` releases the registry block and deletes the Caddy site. It does not stop a running stack. If Rails or Vite is still listening, it prints a warning and the `lsof` command and continues.

Do not reuse `pohq/bin/git-wt*` in this clone. The scripts do not copy `node_modules` / gems. They also do not copy Redis, TLS, an OAuth relay, or stack stopping on remove.

cmux opens the new worktree when it is installed and stdout is a TTY.

## Tests

```sh
python3 scripts/test_fnba_cli.py
```
