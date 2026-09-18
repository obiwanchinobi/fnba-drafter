# Shared Postgres helpers for human fnba-cli worktrees. Sourced, not executed.
# Contract: isolate development/test DBs as fnba_dev_<slug> / fnba_test_<slug>,
# cloned from fnba_drafter_development. Never drop fnba_drafter_*.

FNBA_SOURCE_DEV_DB="fnba_drafter_development"
FNBA_SHARED_TEST_DB="fnba_drafter_test"

# Prefer clients already on PATH (CLI tests inject fakes). Otherwise prepend
# Homebrew postgresql@16 the same way bin/setup does.
if ! command -v createdb >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
    PATH="/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/local/opt/postgresql@16/bin:/usr/local/bin:${PATH}"
    export PATH
fi

# Non-alphanumeric → _. Truncate so fnba_test_<slug>_11 still fits in 63 chars.
fnba_db_slug() {
    printf '%s' "$1" | sed 's/[^A-Za-z0-9]/_/g' | cut -c1-50
}

fnba_pg_db_exists() {
    psql -lqt 2>/dev/null | awk '{print $1}' | grep -qx "$1"
}

fnba_db_name_safe() {
    case "$1" in
        ""|fnba_drafter_*) return 1 ;;
    esac
    printf '%s' "$1" | grep -Eq '^fnba_(dev|test)_[A-Za-z0-9_]+$'
}

fnba_clone_pg_db() {
    local src="$1" target="$2"
    local dump_rc restore_rc
    if createdb -T "$src" "$target" 2>/dev/null; then
        echo "Cloned ${src} → ${target} via TEMPLATE"
        return 0
    fi
    echo "TEMPLATE clone failed for ${target} (likely active connections on ${src}); falling back to pg_dump..."
    createdb "$target" || return 1
    pg_dump "$src" | psql -q -d "$target" >/dev/null
    dump_rc=${PIPESTATUS[0]} restore_rc=${PIPESTATUS[1]}
    if [ "$dump_rc" -ne 0 ] || [ "$restore_rc" -ne 0 ]; then
        echo "pg_dump fallback failed (pg_dump=${dump_rc}, psql=${restore_rc})" >&2
        return 1
    fi
    echo "Cloned ${src} → ${target} via pg_dump"
}

fnba_createdb_empty() {
    local name="$1"
    createdb "$name" || return 1
    echo "Created empty test DB ${name} (Rails will populate on first test run)"
}

fnba_read_env_var() {
    local file="$1" key="$2"
    grep -E "^${key}=" "$file" 2>/dev/null | tail -n1 | cut -d= -f2-
}

fnba_write_db_env() {
    local worktree="$1" dev="$2" test_db="$3"
    local backend="${worktree}/backend"
    mkdir -p "$backend"
    {
        echo ""
        echo "# Per-worktree databases (managed by fnba-cli wt)"
        echo "FNBA_DB_NAME=${dev}"
        echo "FNBA_TEST_DB_NAME=${test_db}"
    } >> "${backend}/.env.local"
    echo "Appended FNBA_DB_NAME and FNBA_TEST_DB_NAME to ${backend}/.env.local"
    {
        echo "# Per-worktree test database (managed by fnba-cli wt)"
        echo "FNBA_TEST_DB_NAME=${test_db}"
    } >> "${backend}/.env.test.local"
    echo "Appended FNBA_TEST_DB_NAME to ${backend}/.env.test.local"
}

fnba_setup_worktree_dbs() {
    local worktree="$1" branch="$2"
    local slug source_dev_db target_dev_db target_test_db

    if [ ! -f "${worktree}/backend/config/database.yml" ]; then
        echo "Skipping per-worktree DB setup: ${worktree}/backend/config/database.yml is missing"
        return 0
    fi
    if ! command -v psql >/dev/null 2>&1 || ! command -v createdb >/dev/null 2>&1; then
        echo "Skipping per-worktree DB setup: psql/createdb not found (install PostgreSQL 16)"
        return 0
    fi

    source_dev_db="$FNBA_SOURCE_DEV_DB"
    if ! fnba_pg_db_exists "$source_dev_db"; then
        echo "Skipping per-worktree DB setup: source DB ${source_dev_db} does not exist"
        return 0
    fi

    slug=$(fnba_db_slug "$branch")
    target_dev_db="fnba_dev_${slug}"
    target_test_db="fnba_test_${slug}"

    if fnba_pg_db_exists "$target_dev_db"; then
        echo "Error: dev DB '${target_dev_db}' already exists. Drop it first: dropdb ${target_dev_db}" >&2
        echo "Or run fnba-cli wt-refresh-db from the worktree after recording FNBA_DB_NAME=${target_dev_db} in backend/.env.local." >&2
        return 1
    fi

    fnba_clone_pg_db "$source_dev_db" "$target_dev_db" || return 1

    if fnba_pg_db_exists "$target_test_db"; then
        echo "Test DB '${target_test_db}' already exists; reusing"
    else
        fnba_createdb_empty "$target_test_db" || return 1
    fi

    fnba_write_db_env "$worktree" "$target_dev_db" "$target_test_db"
    echo "Isolated DBs: ${target_dev_db} (dev), ${target_test_db} (test)"
}

fnba_terminate_connections() {
    local db="$1"
    fnba_db_name_safe "$db" || return 1
    psql -d postgres -v ON_ERROR_STOP=1 -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db}' AND pid <> pg_backend_pid();" \
        >/dev/null 2>&1 || true
}

# Sets FNBA_RESOLVED_DEV_DB / FNBA_RESOLVED_TEST_DB from env files, or from
# slug names only when those DBs exist on a Rails worktree.
fnba_resolve_worktree_dbs() {
    local worktree="$1" branch="$2"
    local env_local env_file env_test_local slug cand_dev cand_test family
    FNBA_RESOLVED_DEV_DB=""
    FNBA_RESOLVED_TEST_DB=""

    env_local="${worktree}/backend/.env.local"
    env_file="${worktree}/backend/.env"
    env_test_local="${worktree}/backend/.env.test.local"

    FNBA_RESOLVED_DEV_DB=$(fnba_read_env_var "$env_local" FNBA_DB_NAME)
    [ -z "$FNBA_RESOLVED_DEV_DB" ] && FNBA_RESOLVED_DEV_DB=$(fnba_read_env_var "$env_file" FNBA_DB_NAME)

    FNBA_RESOLVED_TEST_DB=$(fnba_read_env_var "$env_local" FNBA_TEST_DB_NAME)
    [ -z "$FNBA_RESOLVED_TEST_DB" ] && FNBA_RESOLVED_TEST_DB=$(fnba_read_env_var "$env_test_local" FNBA_TEST_DB_NAME)
    [ -z "$FNBA_RESOLVED_TEST_DB" ] && FNBA_RESOLVED_TEST_DB=$(fnba_read_env_var "$env_file" FNBA_TEST_DB_NAME)

    if [ -n "$FNBA_RESOLVED_DEV_DB" ] || [ -n "$FNBA_RESOLVED_TEST_DB" ]; then
        return 0
    fi

    if [ ! -f "${worktree}/backend/config/database.yml" ]; then
        return 0
    fi
    if ! command -v psql >/dev/null 2>&1; then
        return 0
    fi

    slug=$(fnba_db_slug "$branch")
    cand_dev="fnba_dev_${slug}"
    cand_test="fnba_test_${slug}"
    if fnba_pg_db_exists "$cand_dev"; then
        FNBA_RESOLVED_DEV_DB="$cand_dev"
    fi
    if fnba_pg_db_exists "$cand_test"; then
        FNBA_RESOLVED_TEST_DB="$cand_test"
    else
        family=$(fnba_test_db_workers "$cand_test")
        if [ -n "$family" ]; then
            FNBA_RESOLVED_TEST_DB="$cand_test"
        fi
    fi
}

fnba_test_db_workers() {
    local base="$1"
    [ -z "$base" ] && return 0
    fnba_db_name_safe "$base" || return 0
    psql -d postgres -Atc \
        "SELECT datname FROM pg_database WHERE datname LIKE '${base}\\_%' ORDER BY datname" 2>/dev/null
}

fnba_drop_one_db() {
    local db="$1"
    [ -z "$db" ] && return 0
    if ! fnba_db_name_safe "$db"; then
        echo "Skipping ${db} (not an isolated worktree DB)"
        return 0
    fi
    if ! command -v dropdb >/dev/null 2>&1; then
        echo "dropdb not found; retry: dropdb ${db}"
        return 0
    fi
    if ! fnba_pg_db_exists "$db"; then
        return 0
    fi
    fnba_terminate_connections "$db"
    if dropdb "$db"; then
        echo "Dropped ${db}"
    else
        echo "Failed to drop ${db}. Stop sessions on ${db} and retry: dropdb ${db}" >&2
    fi
}

fnba_drop_worktree_dbs() {
    local dev="$1" test_db="$2"
    local extra db
    fnba_drop_one_db "$dev"
    fnba_drop_one_db "$test_db"
    [ -z "$test_db" ] && return 0
    fnba_db_name_safe "$test_db" || return 0
    if ! command -v psql >/dev/null 2>&1; then
        return 0
    fi
    extra=$(fnba_test_db_workers "$test_db") || true
    while IFS= read -r db; do
        [ -z "$db" ] && continue
        fnba_drop_one_db "$db"
    done <<EOF
${extra}
EOF
    return 0
}

fnba_heal_test_env_file() {
    local env_test_local="$1" expected_test_db="$2"
    local current=""
    [ -f "$env_test_local" ] && current=$(fnba_read_env_var "$env_test_local" FNBA_TEST_DB_NAME)

    if [ "$current" = "$expected_test_db" ]; then
        echo ".env.test.local already names ${expected_test_db}"
    else
        if [ -n "$current" ]; then
            echo ".env.test.local names '${current}' but expected '${expected_test_db}' — rewriting to match"
            grep -vE '^(FNBA_TEST_DB_NAME=|# Per-worktree test database)' "$env_test_local" > "${env_test_local}.tmp" || true
            mv "${env_test_local}.tmp" "$env_test_local" || return 1
            if fnba_pg_db_exists "$current"; then
                echo "Note: DB '${current}' still exists and is now orphaned. Drop it once nothing needs it: dropdb ${current}"
            fi
        else
            echo ".env.test.local missing FNBA_TEST_DB_NAME — without it rails test falls back to ${FNBA_SHARED_TEST_DB}"
        fi
        {
            echo "# Per-worktree test database (managed by fnba-cli wt-refresh-db)"
            echo "FNBA_TEST_DB_NAME=${expected_test_db}"
        } >> "$env_test_local"
        echo "Wrote FNBA_TEST_DB_NAME=${expected_test_db} to ${env_test_local}"
    fi

    if ! fnba_pg_db_exists "$expected_test_db"; then
        fnba_createdb_empty "$expected_test_db" || return 1
    fi
}

fnba_bundle_ready() {
    local worktree="$1"
    [ -f "${worktree}/backend/Gemfile.lock" ] || return 1
    (cd "${worktree}/backend" && bundle check >/dev/null 2>&1)
}
