#!/usr/bin/env bash
# .runner/setup.sh — provision a self-hosted GitHub Actions runner for THIS
# repository on THIS host.
#
# Idempotent. Safe to re-run.
#
# Migrating to a new machine? On the new host:
#     gh auth login                    # one-time
#     git clone https://github.com/{REPO_OWNER}/{REPO_NAME}
#     cd {REPO_NAME}
#     ./.runner/setup.sh
#
# Sub-commands:
#     ./.runner/setup.sh                # default: install + register + start
#     ./.runner/setup.sh install        # extract runner binaries
#     ./.runner/setup.sh register       # mint token + config.sh against the repo
#     ./.runner/setup.sh start          # spawn runner processes via nohup
#     ./.runner/setup.sh stop           # stop runner processes
#     ./.runner/setup.sh status         # show GitHub-side + local state
#     ./.runner/setup.sh uninstall      # stop + unregister with GitHub (binaries left)
#     ./.runner/setup.sh logs [N]       # tail the most recent runner log
#
# Knobs (env vars):
#     GH_RUNNER_VERSION   (default: pinned below)
#     GH_RUNNER_BASE      (default: ~/.gh-runners)
#     GH_RUNNER_HOSTNAME  (default: $(hostname -s); used for runner names)

set -euo pipefail

# ============================================================================
# REPO-SPECIFIC CONFIGURATION  — edit when copying to a new repo
# ============================================================================

REPO_OWNER="darinh"
REPO_NAME="neon-dungeon"

# How many concurrent runner instances to register on this host. Set >1 only
# when the repo's CI has parallel jobs that can profitably run side-by-side
# on a single machine (e.g. matrix-style CI). For most repos, 1 is correct.
RUNNER_COUNT=1

# Extra labels appended to the defaults `self-hosted,linux,x64`.
EXTRA_LABELS=""

# Tools the workflows assume are pre-installed AT JOB RUNTIME on the host.
# (POSIX basics — bash, git, curl, tar, jq — and the GitHub CLI (gh) are
# required unconditionally by the setup script and need not be listed here.
# `actions/setup-node`, `actions/setup-dotnet`, etc. install on demand and
# do NOT need to be listed.)
RUNTIME_TOOLS=(gh)

# Tools that some workflows benefit from but aren't strictly required.
# Setup will warn if any are missing but will not abort.
RECOMMENDED_TOOLS=()

# ============================================================================
# SHARED LOGIC — keep identical across all .runner/setup.sh files.
# When fixing a bug in this section, propagate the fix to every repo.
# ============================================================================

GH_RUNNER_VERSION="${GH_RUNNER_VERSION:-v2.334.0}"
GH_RUNNER_BASE="${GH_RUNNER_BASE:-$HOME/.gh-runners}"
GH_RUNNER_HOSTNAME="${GH_RUNNER_HOSTNAME:-$(hostname -s)}"

RUNNER_BIN_CACHE="$GH_RUNNER_BASE/_bin"
RUNNER_LOGS="$GH_RUNNER_BASE/_logs"
RUNNER_BASE="$GH_RUNNER_BASE/$REPO_NAME"

c_reset=$'\033[0m'
c_cyan=$'\033[36m'
c_green=$'\033[32m'
c_yellow=$'\033[33m'
c_red=$'\033[31m'

log()  { printf '%s→ %s%s\n' "$c_cyan"   "$*" "$c_reset" >&2; }
ok()   { printf '%s✓ %s%s\n' "$c_green"  "$*" "$c_reset" >&2; }
warn() { printf '%s⚠ %s%s\n' "$c_yellow" "$*" "$c_reset" >&2; }
err()  { printf '%s✗ %s%s\n' "$c_red"    "$*" "$c_reset" >&2; }
die()  { err "$*"; exit 1; }

require_tools() {
    local missing=()
    local t
    for t in "$@"; do
        command -v "$t" >/dev/null 2>&1 || missing+=("$t")
    done
    if [[ ${#missing[@]} -gt 0 ]]; then
        die "Missing required tools: ${missing[*]}. Install them and re-run."
    fi
}

check_recommended() {
    local t
    for t in "$@"; do
        if ! command -v "$t" >/dev/null 2>&1; then
            warn "Recommended tool not found on PATH: $t (some workflows may need it)"
        fi
    done
}

check_gh_auth() {
    require_tools gh jq
    if ! gh auth status -h github.com >/dev/null 2>&1; then
        die "Not authenticated to github.com. Run: gh auth login"
    fi
    local user
    user=$(gh api user --jq .login)
    if [[ "$user" != "$REPO_OWNER" ]]; then
        warn "Authenticated as '$user' but REPO_OWNER is '$REPO_OWNER'. Verify this is intentional."
    fi
    ok "gh authenticated as $user"
}

ensure_runner_binary() {
    mkdir -p "$RUNNER_BIN_CACHE"
    local tarball="actions-runner-linux-x64-${GH_RUNNER_VERSION#v}.tar.gz"
    local path="$RUNNER_BIN_CACHE/$tarball"

    # Fetch the expected SHA256 from the GitHub release notes. The runner team
    # embeds it via marker comments: <!-- BEGIN SHA linux-x64 -->HEX<!-- END ...
    local expected_sha=""
    if command -v jq >/dev/null 2>&1; then
        expected_sha=$(curl -fsSL "https://api.github.com/repos/actions/runner/releases/tags/${GH_RUNNER_VERSION}" 2>/dev/null \
            | jq -r '.body // empty' \
            | grep -oE '<!-- BEGIN SHA linux-x64 -->[a-f0-9]{64}' \
            | grep -oE '[a-f0-9]{64}' \
            | head -1 || true)
    fi

    verify_or_die() {
        local actual
        actual=$(sha256sum "$1" | awk '{print $1}')
        if [[ "$actual" != "$expected_sha" ]]; then
            rm -f "$1"
            die "SHA256 mismatch for $tarball: expected=$expected_sha actual=$actual (file deleted)"
        fi
    }

    if [[ -f "$path" && -s "$path" ]]; then
        if [[ -n "$expected_sha" ]]; then
            verify_or_die "$path"
            ok "Runner tarball cached + SHA256 verified: $tarball"
        else
            warn "Runner tarball cached but SHA could not be fetched from GitHub — using as-is: $tarball"
        fi
        printf '%s' "$path"
        return
    fi

    log "Downloading runner $GH_RUNNER_VERSION..."
    curl -fsSL -o "$path" \
        "https://github.com/actions/runner/releases/download/${GH_RUNNER_VERSION}/${tarball}" \
        || die "Download failed"

    if [[ -n "$expected_sha" ]]; then
        verify_or_die "$path"
        ok "Downloaded + SHA256 verified: $tarball"
    else
        warn "Downloaded but could not verify SHA (GitHub API unreachable?): $tarball"
    fi
    printf '%s' "$path"
}

extract_runner() {
    local slot=$1
    local tarball=$2
    if [[ -x "$slot/config.sh" ]]; then
        ok "Runner already extracted: $(basename "$slot")"
    else
        log "Extracting runner into $(basename "$slot")..."
        mkdir -p "$slot"
        tar -xzf "$tarball" -C "$slot"
        ok "Extracted into $(basename "$slot")"
    fi
    write_runner_env "$slot"
}

# Write a sensible .env file for the runner. The runner sources this file
# before each job step. We set vars that nudge actions which expect root-mode
# hosted-runner behaviour to use user-writable paths instead.
write_runner_env() {
    local slot=$1
    local envfile="$slot/.env"
    cat >"$envfile" <<EOF
# Written by .runner/setup.sh — overrides for self-hosted user-mode runners.
# Edit if you need different paths; this file is preserved across re-installs
# unless you delete it explicitly.

# actions/setup-dotnet defaults to /usr/share/dotnet (root-only). Redirect
# to a user-writable location so the action can install without sudo.
DOTNET_INSTALL_DIR=$HOME/.dotnet/runner

# actions/setup-node uses RUNNER_TOOL_CACHE; default ~/.cache works fine but
# pin it for clarity and to stop it spilling into $HOME/agent in odd cases.
RUNNER_TOOL_CACHE=$HOME/.cache/runner-tools
EOF
    mkdir -p "$HOME/.dotnet/runner" "$HOME/.cache/runner-tools"
    ok "Wrote $envfile (DOTNET_INSTALL_DIR + RUNNER_TOOL_CACHE)"
}

is_registered() { [[ -f "$1/.runner" ]]; }

register_runner() {
    local slot=$1 name=$2 labels=$3
    if is_registered "$slot"; then
        ok "Already registered: $name"
        return 0
    fi
    log "Minting registration token for $REPO_OWNER/$REPO_NAME..."
    local token
    token=$(gh api -X POST \
        "/repos/$REPO_OWNER/$REPO_NAME/actions/runners/registration-token" \
        --jq .token)
    [[ -n "$token" ]] || die "Failed to mint registration token"
    log "Registering runner '$name' (labels: $labels)..."
    (
        cd "$slot"
        ./config.sh \
            --url "https://github.com/$REPO_OWNER/$REPO_NAME" \
            --token "$token" \
            --name "$name" \
            --labels "$labels" \
            --work _work \
            --unattended \
            --replace
    )
    ok "Registered $name"
}

unregister_runner() {
    local slot=$1
    if ! is_registered "$slot"; then
        ok "Not registered: $(basename "$slot")"
        return 0
    fi
    log "Unregistering $(basename "$slot")..."
    local token
    token=$(gh api -X POST \
        "/repos/$REPO_OWNER/$REPO_NAME/actions/runners/remove-token" \
        --jq .token)
    # config.sh remove doesn't accept --unattended; let any actual error
    # surface so we don't claim success when the runner is still registered.
    if (cd "$slot" && ./config.sh remove --token "$token"); then
        ok "Unregistered $(basename "$slot")"
    else
        warn "config.sh remove returned non-zero for $(basename "$slot")."
        warn "Verify with: gh api /repos/$REPO_OWNER/$REPO_NAME/actions/runners"
        return 1
    fi
}

pid_file() { printf '%s/.run.pid' "$1"; }
log_file() { printf '%s/%s.log' "$RUNNER_LOGS" "$(basename "$1")"; }

is_running() {
    local slot=$1
    local pidf
    pidf=$(pid_file "$slot")
    [[ -f "$pidf" ]] || return 1
    local pid
    pid=$(<"$pidf")
    [[ -n "$pid" ]] || return 1
    kill -0 "$pid" 2>/dev/null || return 1
    # Validate the PID actually belongs to OUR runner. PIDs get recycled, so a
    # stale .run.pid pointing at an unrelated process must NOT be treated as a
    # live runner — otherwise `stop` would kill the wrong thing.
    local cwd
    cwd=$(readlink "/proc/$pid/cwd" 2>/dev/null) || return 1
    [[ "$cwd" == "$slot" || "$cwd" == "$slot/_work"* ]]
}

start_runner() {
    local slot=$1 name
    name=$(basename "$slot")
    if is_running "$slot"; then
        ok "Already running: $name (pid $(<"$(pid_file "$slot")"))"
        return 0
    fi
    if ! is_registered "$slot"; then
        die "$name is not registered. Run: $0 register"
    fi
    mkdir -p "$RUNNER_LOGS"
    log "Starting $name..."
    (
        cd "$slot"
        nohup ./run.sh >>"$(log_file "$slot")" 2>&1 &
        echo $! >"$(pid_file "$slot")"
    )
    sleep 2
    if is_running "$slot"; then
        ok "Started $name (pid $(<"$(pid_file "$slot")"), log $(log_file "$slot"))"
    else
        err "Runner $name failed to start. Check log: $(log_file "$slot")"
        return 1
    fi
}

stop_runner() {
    local slot=$1 name
    name=$(basename "$slot")
    if ! is_running "$slot"; then
        ok "Not running: $name"
        return 0
    fi
    local pid
    pid=$(<"$(pid_file "$slot")")
    log "Stopping $name (pid $pid)..."
    kill "$pid" 2>/dev/null || true
    local i=0
    while kill -0 "$pid" 2>/dev/null && (( i < 10 )); do
        sleep 1
        ((i++))
    done
    if kill -0 "$pid" 2>/dev/null; then
        warn "Process did not stop in 10s, sending SIGKILL"
        kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$(pid_file "$slot")"
    ok "Stopped $name"
}

slot_name() {
    local base="$GH_RUNNER_HOSTNAME"
    # Append a stable per-host ID so two machines with the same hostname don't
    # collide and silently overwrite each other's GitHub-side registration via
    # config.sh's --replace flag. Set GH_RUNNER_HOSTNAME_LITERAL=1 to opt out
    # (pretty names, but you must manage migrations manually).
    if [[ "${GH_RUNNER_HOSTNAME_LITERAL:-0}" != "1" ]]; then
        base="$base-$(host_id)"
    fi
    if (( RUNNER_COUNT == 1 )); then
        printf '%s' "$base"
    else
        printf '%s-%d' "$base" "$1"
    fi
}

host_id() {
    local raw=""
    if [[ -r /etc/machine-id ]]; then
        raw=$(cat /etc/machine-id)
    elif [[ -r /var/lib/dbus/machine-id ]]; then
        raw=$(cat /var/lib/dbus/machine-id)
    else
        # Last resort: hash hostname so we at least produce a stable suffix.
        raw=$(hostname -f 2>/dev/null || hostname)
    fi
    printf '%s' "$raw" | sha256sum | cut -c1-6
}

slot_path() { printf '%s/%s' "$RUNNER_BASE" "$(slot_name "$1")"; }

# --- main commands ----------------------------------------------------------

cmd_install() {
    require_tools bash git curl tar jq "${RUNTIME_TOOLS[@]}"
    [[ ${#RECOMMENDED_TOOLS[@]} -gt 0 ]] && check_recommended "${RECOMMENDED_TOOLS[@]}"
    local tarball
    tarball=$(ensure_runner_binary)
    local i
    for ((i = 1; i <= RUNNER_COUNT; i++)); do
        extract_runner "$(slot_path "$i")" "$tarball"
    done
    ok "Install complete ($RUNNER_COUNT slot(s))"
}

cmd_register() {
    check_gh_auth
    local labels="self-hosted,linux,x64${EXTRA_LABELS:+,$EXTRA_LABELS}"
    local i
    for ((i = 1; i <= RUNNER_COUNT; i++)); do
        register_runner "$(slot_path "$i")" "$(slot_name "$i")" "$labels"
    done
    ok "Registration complete"
}

cmd_start() {
    local i
    for ((i = 1; i <= RUNNER_COUNT; i++)); do
        start_runner "$(slot_path "$i")"
    done
}

cmd_stop() {
    local i
    for ((i = 1; i <= RUNNER_COUNT; i++)); do
        stop_runner "$(slot_path "$i")"
    done
}

cmd_uninstall() {
    check_gh_auth
    cmd_stop
    local i
    for ((i = 1; i <= RUNNER_COUNT; i++)); do
        unregister_runner "$(slot_path "$i")"
    done
    ok "Uninstall complete (binaries left at $RUNNER_BASE — rm -rf to fully purge)"
}

cmd_status() {
    log "Repo:     $REPO_OWNER/$REPO_NAME"
    log "Version:  $GH_RUNNER_VERSION"
    log "Base:     $GH_RUNNER_BASE"
    log "Hostname: $GH_RUNNER_HOSTNAME (RUNNER_COUNT=$RUNNER_COUNT)"
    echo ""
    log "GitHub-side runner registry:"
    if command -v gh >/dev/null 2>&1 && gh auth status -h github.com >/dev/null 2>&1; then
        gh api "/repos/$REPO_OWNER/$REPO_NAME/actions/runners" --jq \
            '.runners[] | "  - \(.name)  status=\(.status)  busy=\(.busy)  labels=\([.labels[].name] | join(","))"' \
            2>/dev/null || warn "  (failed to query GitHub registry)"
    else
        warn "  (gh not authenticated; skipping)"
    fi
    echo ""
    log "Local slots:"
    if [[ ! -d "$RUNNER_BASE" ]]; then
        echo "  (none — run: $0 install register start)"
        return
    fi
    local slot
    for slot in "$RUNNER_BASE"/*; do
        [[ -d "$slot" ]] || continue
        local name registered=no running=no pid=""
        name=$(basename "$slot")
        is_registered "$slot" && registered=yes
        if is_running "$slot"; then
            running=yes
            pid=$(<"$(pid_file "$slot")")
        fi
        printf '  - %-30s registered=%s  running=%s%s\n' \
            "$name" "$registered" "$running" \
            "${pid:+ (pid $pid)}"
    done
}

cmd_logs() {
    local n="${1:-50}"
    if [[ ! -d "$RUNNER_LOGS" ]]; then
        warn "No logs directory yet: $RUNNER_LOGS"
        return 0
    fi
    # nullglob so an empty match expands to nothing instead of the literal
    # pattern, and we don't run `ls *.log` (which would fail under set -e).
    shopt -s nullglob
    local logs=("$RUNNER_LOGS"/*.log)
    shopt -u nullglob
    if (( ${#logs[@]} == 0 )); then
        warn "No logs yet in $RUNNER_LOGS"
        return 0
    fi
    # Sort by mtime descending, take newest.
    local newest
    newest=$(stat --printf='%Y\t%n\n' "${logs[@]}" | sort -rn | head -1 | cut -f2)
    log "Tailing last $n lines of $newest"
    tail -n "$n" "$newest"
}

# --- dispatch ---------------------------------------------------------------

case "${1:-all}" in
    all)        cmd_install && cmd_register && cmd_start ;;
    install)    cmd_install ;;
    register)   cmd_register ;;
    start)      cmd_start ;;
    stop)       cmd_stop ;;
    status)     cmd_status ;;
    uninstall)  cmd_uninstall ;;
    logs)       cmd_logs "${2:-50}" ;;
    -h|--help|help)
        sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//; s/^set -euo.*//'
        ;;
    *)
        err "Unknown command: $1"
        echo "Run '$0 --help' for usage." >&2
        exit 2
        ;;
esac
