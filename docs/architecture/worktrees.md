# Parallel worktrees

FNBA uses git worktrees so two sessions never share one `HEAD` and index. The committed CLI is `bin/fnba-cli`; it dispatches to `bin/git-wt` and `bin/git-wt-remove`. Those scripts are specific to this repository. Do not point the POHQ `git-wt` alias at this clone.

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
fnba-cli wt ft/board                 # from main: new branch + worktree
fnba-cli wt                          # interactive
fnba-cli wt-remove ft/board          # confirm, then remove worktree + delete branch
fnba-cli wt-remove ft/board -y       # skip confirm
fnba-cli wt-remove ft/board --force  # dirty worktree
fnba-cli wt-remove                   # picker; c) cleanup by age
fnba-cli help
```

`fnba-cli git-wt` and `fnba-cli git-wt-remove` / `fnba-cli remove` are aliases for the same two commands. `bin/git-wt` and `bin/git-wt-remove` also run directly.

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

## What this does not copy from POHQ

This repo has no Rails/Vite/Postgres stack. The scripts do **not** allocate ports, write Caddy sites, clone databases, or copy `node_modules`. When an app stack exists, extend these scripts in this repo rather than reusing `pohq/bin/git-wt*`.

cmux opens the new worktree when it is installed and stdout is a TTY.

## Tests

```sh
python3 scripts/test_fnba_cli.py
```
