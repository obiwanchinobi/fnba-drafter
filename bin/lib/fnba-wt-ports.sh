# Shared port-block helpers for human fnba-cli worktrees. Sourced, not executed.
# Contract: one registry line "<base>\t<slug>" in
# ${FNBA_CONFIG_DIR:-${HOME}/.config/fnba}/worktree-ports.
# Slug is fnba_db_slug of the branch (caller passes it). Rails is base,
# Vite is base+1. Scan starts at 4100, step 10, max 64000.
# backend/.env.local: FNBA_PORT_BASE, PORT, FRONTEND_PORT.
# frontend/.env.local: VITE_PORT, VITE_API_URL=http://127.0.0.1:<base>.
# The primary checkout keeps 3000/5173 and gets no port block.
# fnba_allocate_port_block prints only the base on stdout.

FNBA_CONFIG_DIR="${FNBA_CONFIG_DIR:-${HOME}/.config/fnba}"
FNBA_PORT_REGISTRY="${FNBA_CONFIG_DIR}/worktree-ports"
FNBA_PORT_BASE_START=4100
FNBA_PORT_BASE_STEP=10
FNBA_PORT_BASE_MAX=64000

fnba_port_listening() {
    lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

fnba_registered_port_base() {
    local slug="$1"
    [ -f "$FNBA_PORT_REGISTRY" ] || return 0
    awk -F '\t' -v slug="$slug" '$2 == slug { print $1; exit }' "$FNBA_PORT_REGISTRY"
}

fnba_port_base_registered() {
    local base="$1"
    [ -f "$FNBA_PORT_REGISTRY" ] || return 1
    awk -F '\t' -v base="$base" '
        $1 == base { found = 1; exit }
        END { exit (found ? 0 : 1) }
    ' "$FNBA_PORT_REGISTRY"
}

# Stdout is only the base so command substitution stays clean. Messages go to stderr.
fnba_allocate_port_block() {
    local slug="$1"
    local base registered

    mkdir -p "$FNBA_CONFIG_DIR"
    touch "$FNBA_PORT_REGISTRY"

    registered=$(fnba_registered_port_base "$slug")
    if [ -n "$registered" ]; then
        printf '%s\n' "$registered"
        return 0
    fi

    base="$FNBA_PORT_BASE_START"
    while [ "$base" -le "$FNBA_PORT_BASE_MAX" ]; do
        if fnba_port_base_registered "$base" \
            || fnba_port_listening "$base" \
            || fnba_port_listening "$((base + 1))"; then
            base=$((base + FNBA_PORT_BASE_STEP))
            continue
        fi
        printf '%s\t%s\n' "$base" "$slug" >> "$FNBA_PORT_REGISTRY"
        printf '%s\n' "$base"
        return 0
    done

    printf 'No free port block from %s to %s (step %s)\n' \
        "$FNBA_PORT_BASE_START" "$FNBA_PORT_BASE_MAX" "$FNBA_PORT_BASE_STEP" >&2
    return 1
}

fnba_release_port_block() {
    local slug="$1"
    local base="${2:-}"
    local tmp
    [ -f "$FNBA_PORT_REGISTRY" ] || return 0
    tmp="${FNBA_PORT_REGISTRY}.tmp"
    # print $0 keeps the tab; a bare print would rejoin fields with spaces.
    awk -F '\t' -v slug="$slug" -v base="$base" '
        $2 == slug { next }
        base != "" && $1 == base { next }
        { print $0 }
    ' "$FNBA_PORT_REGISTRY" > "$tmp"
    mv "$tmp" "$FNBA_PORT_REGISTRY"
}

fnba_write_port_block() {
    local worktree="$1"
    local base="$2"
    local backend="${worktree}/backend"
    local frontend="${worktree}/frontend"
    local vite_port=$((base + 1))

    mkdir -p "$backend" "$frontend"

    if grep -qE '^FNBA_PORT_BASE=' "${backend}/.env.local" 2>/dev/null; then
        return 0
    fi

    {
        echo ""
        echo "# Per-worktree port block (managed by fnba-cli wt)"
        echo "FNBA_PORT_BASE=${base}"
        echo "PORT=${base}"
        echo "FRONTEND_PORT=${vite_port}"
    } >> "${backend}/.env.local"
    {
        echo ""
        echo "# Per-worktree port block (managed by fnba-cli wt)"
        echo "VITE_PORT=${vite_port}"
        echo "VITE_API_URL=http://127.0.0.1:${base}"
    } >> "${frontend}/.env.local"
    echo "Appended port block Rails :${base} Vite :${vite_port}"
}
