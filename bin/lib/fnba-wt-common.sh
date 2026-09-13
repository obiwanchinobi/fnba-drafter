# Shared helpers for bin/git-wt and bin/git-wt-remove. Sourced, not executed.
# Contract: worktrees live at ../fnba-drafter-worktrees/<slug> next to the
# primary checkout. This repo has no per-worktree DB, ports, or Caddy.

REPO_NAME="fnba-drafter"
DEFAULT_BRANCH="main"
WORKTREE_PARENT_NAME="fnba-drafter-worktrees"

if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    MAGENTA='\033[0;35m'
    DIM='\033[2m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' MAGENTA='' DIM='' NC=''
fi

fnba_die() {
    echo -e "${RED}Error: $1${NC}" >&2
    exit 1
}

fnba_require_git() {
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        fnba_die "Not in a git repository"
    fi
}

fnba_primary_worktree() {
    git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }'
}

fnba_require_repo() {
    local primary
    primary=$(fnba_primary_worktree)
    [ -n "$primary" ] || fnba_die "Could not resolve the primary worktree"
    if [ "$(basename "$primary")" != "$REPO_NAME" ]; then
        echo -e "${RED}Error: This CLI only works in the ${REPO_NAME} repository${NC}" >&2
        echo -e "${YELLOW}Primary worktree: ${primary}${NC}" >&2
        exit 1
    fi
}

fnba_worktrees_root() {
    echo "$(dirname "$(fnba_primary_worktree)")/${WORKTREE_PARENT_NAME}"
}

fnba_worktree_path() {
    local branch="$1"
    local slug
    slug=$(echo "$branch" | sed 's/\//-/g')
    echo "$(fnba_worktrees_root)/${slug}"
}

fnba_is_worktree_path_used() {
    git worktree list --porcelain | grep -qxF "worktree $1"
}

fnba_worktree_for_branch() {
    local branch="$1"
    git worktree list --porcelain | awk -v b="refs/heads/${branch}" '
        /^worktree / { wt = substr($0, 10) }
        /^branch / && $2 == b { print wt; exit }
    '
}

fnba_path_under_worktrees_root() {
    local path="$1"
    local root
    root=$(fnba_worktrees_root)
    case "$path" in
        "$root"/*) return 0 ;;
        *) return 1 ;;
    esac
}

# Prints a diagnostic for a stale local branch ref. Caller owns stdout/stderr.
fnba_emit_local_branch_diagnostic() {
    local branch="$1"
    git fetch origin "$DEFAULT_BRANCH" --quiet 2>/dev/null || true

    local local_ref ahead behind existing_wt
    local_ref=$(git rev-parse --short "refs/heads/$branch" 2>/dev/null || echo "?")
    if git show-ref --verify --quiet "refs/remotes/origin/${DEFAULT_BRANCH}"; then
        ahead=$(git rev-list --count "origin/${DEFAULT_BRANCH}..refs/heads/$branch" 2>/dev/null || echo "?")
        behind=$(git rev-list --count "refs/heads/$branch..origin/${DEFAULT_BRANCH}" 2>/dev/null || echo "?")
    else
        ahead="?"
        behind="?"
    fi
    existing_wt=$(fnba_worktree_for_branch "$branch")

    echo -e "${RED}Error: local branch '${branch}' already exists at ${local_ref} (${ahead} ahead, ${behind} behind origin/${DEFAULT_BRANCH})${NC}"
    [ -n "$existing_wt" ] && echo -e "${YELLOW}It is checked out in worktree: ${existing_wt}${NC}"
    echo ""
    echo "Resolve manually before re-running fnba-cli wt:"
    if [ -n "$existing_wt" ]; then
        echo "  1. Remove the worktree: fnba-cli wt-remove ${branch}"
        echo "  2. Inspect the branch:  git log --oneline origin/${DEFAULT_BRANCH}..refs/heads/${branch}"
        echo "  3. Delete (if no work to preserve): git branch -D ${branch}"
    else
        echo "  1. Inspect the branch:  git log --oneline origin/${DEFAULT_BRANCH}..refs/heads/${branch}"
        echo "  2. Delete (if no work to preserve): git branch -D ${branch}"
    fi
    echo "     OR push and merge first if there are commits ahead."
}

fnba_classify_wt() {
    local path="$1" state="$2" main="$3" current="$4"
    if [ "$state" = "detached" ] || [ "$state" = "bare" ]; then
        echo "$state"
    elif [ "$path" = "$main" ]; then
        echo "primary"
    elif [ "$path" = "$current" ]; then
        echo "current"
    else
        echo "removable"
    fi
}
