#!/usr/bin/env bash
#
# Heritago update worker.
#
# Installs a release tag into an existing installation: fetch the tag, check it out,
# rebuild frontend and backend, then restart the web service.
#
# If a step after the checkout fails, the previously installed revision is restored
# (checkout + rebuild + restart), so a failed update never leaves a half-built,
# unbuildable installation behind. The result is reported as status=rolled_back.
#
# It runs from its own systemd unit ("heritago-update.service", see docs/install.md)
# on purpose: the build must not live inside the web process, because that process is
# killed by the restart this script triggers at the end.
#
# Progress is published as a key=value file ($STATE_DIR/update-state.txt) which the API
# reads for /api/system/update/status; command output goes to $STATE_DIR/update.log.
#
# Usage: update.sh          (reads the target tag from $STATE_DIR/update-request.txt)

set -u

APP_ROOT="${HERITAGO_APP_ROOT:-/opt/heritago}"
STATE_DIR="${HERITAGO_STATE_DIR:-/var/lib/heritago}"
SERVICE_NAME="${HERITAGO_SERVICE_NAME:-heritago}"
WEB_USER="${HERITAGO_WEB_USER:-www-data}"

STATE_FILE="$STATE_DIR/update-state.txt"
LOG_FILE="$STATE_DIR/update.log"
REQUEST_FILE="$STATE_DIR/update-request.txt"

# Step keys, in execution order. The German display labels live in the backend
# (system.routes.ts) - never duplicate user-facing texts in shell code.
STEPS=(fetch checkout install-frontend build-frontend install-backend prisma-generate build-backend restart rollback)
TOTAL=${#STEPS[@]}

TAG=""
FROM=""
ROLLBACK_REF=""
STEP=""
STARTED_AT="$(date -Is)"
FINISHED_AT=""

log() {
    printf '[%s] %s\n' "$(date -Is)" "$*" >> "$LOG_FILE"
}

# Publishes the worker state atomically (a reader must never see a partial file).
write_state() {
    local status="$1"
    local step="${2:-}"
    local error="${3:-}"
    local index=0
    local i

    for i in "${!STEPS[@]}"; do
        if [ "${STEPS[$i]}" = "$step" ]; then
            index=$((i + 1))
        fi
    done

    {
        printf 'status=%s\n' "$status"
        printf 'step=%s\n' "$step"
        printf 'index=%s\n' "$index"
        printf 'total=%s\n' "$TOTAL"
        printf 'target=%s\n' "$TAG"
        printf 'from=%s\n' "$FROM"
        printf 'started=%s\n' "$STARTED_AT"
        printf 'finished=%s\n' "$FINISHED_AT"
        printf 'pid=%s\n' "$$"
        printf 'error=%s\n' "$(printf '%s' "$error" | tr '\n' ' ')"
    } > "$STATE_FILE.tmp"
    mv -f "$STATE_FILE.tmp" "$STATE_FILE"

    chown "$WEB_USER:$WEB_USER" "$STATE_FILE" 2>/dev/null || true
    chmod 0644 "$STATE_FILE" 2>/dev/null || true
}

fail() {
    local reason="$1"
    log "FAILED: $reason"

    # Once the working copy was touched (from the checkout step on) the previous
    # revision is restored instead of leaving a broken installation behind.
    if [ -n "$ROLLBACK_REF" ]; then
        attempt_rollback "$reason"
        return
    fi

    FINISHED_AT="$(date -Is)"
    write_state failed "$STEP" "$reason"
    rm -f "$REQUEST_FILE"
    exit 1
}

# Restores the revision that was installed before this run: check it out again,
# rebuild frontend and backend and restart the service on it. Reports
# status=rolled_back on success and status=failed when even the rollback breaks.
attempt_rollback() {
    local reason="$1"
    local ok=1

    STEP="rollback"
    write_state running "$STEP"
    log "--- rollback to ${FROM:-$ROLLBACK_REF}"

    git -C "$APP_ROOT" checkout "$ROLLBACK_REF" >> "$LOG_FILE" 2>&1 || ok=0

    if [ "$ok" = "1" ]; then
        bash -c "cd '$APP_ROOT' && env -u NODE_ENV npm install --no-audit --no-fund" >> "$LOG_FILE" 2>&1 || ok=0
        bash -c "cd '$APP_ROOT' && npm run build" >> "$LOG_FILE" 2>&1 || ok=0
        bash -c "cd '$APP_ROOT/server' && npm install --no-audit --no-fund" >> "$LOG_FILE" 2>&1 || ok=0
        bash -c "cd '$APP_ROOT/server' && npx prisma generate" >> "$LOG_FILE" 2>&1 || ok=0
        bash -c "cd '$APP_ROOT/server' && npm run build" >> "$LOG_FILE" 2>&1 || ok=0
    fi

    if [ "$ok" = "1" ]; then
        chown -R "$WEB_USER:$WEB_USER" "$APP_ROOT/dist" "$APP_ROOT/server/dist" >> "$LOG_FILE" 2>&1 || true
        systemctl restart "$SERVICE_NAME" >> "$LOG_FILE" 2>&1 || ok=0
    fi

    FINISHED_AT="$(date -Is)"
    rm -f "$REQUEST_FILE"

    if [ "$ok" = "1" ]; then
        log "=== rollback finished - ${FROM:-$ROLLBACK_REF} is active again ==="
        write_state rolled_back "$STEP" "Update auf $TAG ist fehlgeschlagen ($reason). Die vorherige Version ${FROM:-$ROLLBACK_REF} wurde wiederhergestellt und läuft wieder."
    else
        log "=== rollback FAILED - manual intervention required ==="
        write_state failed "$STEP" "Update auf $TAG ist fehlgeschlagen und die automatische Wiederherstellung ebenfalls. Bitte das Update-Log auf dem Server prüfen."
    fi

    exit 1
}

# Runs one build step and records its progress before it starts.
run_step() {
    STEP="$1"
    shift

    write_state running "$STEP"
    log "--- step: $STEP"

    if ! "$@" >> "$LOG_FILE" 2>&1; then
        fail "Schritt '$STEP' ist fehlgeschlagen. Details stehen im Update-Log."
    fi
}

mkdir -p "$STATE_DIR" || exit 1
touch "$LOG_FILE"
chown "$WEB_USER:$WEB_USER" "$LOG_FILE" 2>/dev/null || true
chmod 0644 "$LOG_FILE" 2>/dev/null || true

if [ ! -f "$REQUEST_FILE" ]; then
    log "No update request found - nothing to do."
    exit 1
fi

# Only a plain semantic version is accepted. Validated again here (defense in depth):
# the tag ends up in a git command line.
TAG="$(sed -n 's/^tag=//p' "$REQUEST_FILE" | head -n1 | tr -d '\r')"
if ! printf '%s' "$TAG" | grep -Eq '^v?[0-9]+\.[0-9]+\.[0-9]+$'; then
    FINISHED_AT="$(date -Is)"
    log "Invalid tag received: '$TAG'"
    write_state failed "" "Ungültige Ziel-Version. Erwartet wird ein Tag wie \"v1.2.3\"."
    rm -f "$REQUEST_FILE"
    exit 1
fi

log "=== update to $TAG requested ==="
STEP="fetch"
write_state running "$STEP"

[ -d "$APP_ROOT/.git" ] || fail "Installationsverzeichnis '$APP_ROOT' ist kein Git-Repository."

FROM="$(git -C "$APP_ROOT" describe --tags --abbrev=0 2>/dev/null | tr -cd 'A-Za-z0-9._-')"
log "installed version before update: ${FROM:-unknown}"

run_step fetch git -C "$APP_ROOT" fetch --tags --prune

# npm rewrites package-lock.json on every install; restoring it keeps the checkout
# from being blocked by that generated churn.
git -C "$APP_ROOT" checkout -- package-lock.json >> "$LOG_FILE" 2>&1 || true

LOCAL_CHANGES="$(git -C "$APP_ROOT" status --porcelain --untracked-files=no \
    | grep -v ' package-lock\.json$' || true)"
if [ -n "$LOCAL_CHANGES" ]; then
    log "Local modifications block the checkout:"
    printf '%s\n' "$LOCAL_CHANGES" >> "$LOG_FILE"
    fail "Das Installationsverzeichnis enthält lokale Änderungen. Bitte diese zuerst zurücksetzen."
fi

# Remember what is installed right now: this is the revision the rollback returns to
# if any of the following steps fails.
ROLLBACK_REF="${FROM:-$(git -C "$APP_ROOT" rev-parse HEAD 2>/dev/null)}"

run_step checkout git -C "$APP_ROOT" checkout "tags/$TAG"

# The Angular CLI is a dev dependency, so the frontend build must not run with
# NODE_ENV=production.
run_step install-frontend bash -c "cd '$APP_ROOT' && env -u NODE_ENV npm install --no-audit --no-fund"
run_step build-frontend bash -c "cd '$APP_ROOT' && npm run build"

run_step install-backend bash -c "cd '$APP_ROOT/server' && npm install --no-audit --no-fund"
run_step prisma-generate bash -c "cd '$APP_ROOT/server' && npx prisma generate"
run_step build-backend bash -c "cd '$APP_ROOT/server' && npm run build"

STEP="restart"
write_state running "$STEP"
log "--- step: restart"

# The build ran as root; hand the artifacts back to the user the service runs as.
chown -R "$WEB_USER:$WEB_USER" "$APP_ROOT/dist" "$APP_ROOT/server/dist" >> "$LOG_FILE" 2>&1 || true

rm -f "$REQUEST_FILE"

if ! systemctl restart "$SERVICE_NAME" >> "$LOG_FILE" 2>&1; then
    fail "Der Dienst '$SERVICE_NAME' konnte nicht neu gestartet werden."
fi

FINISHED_AT="$(date -Is)"
write_state success "$STEP"
log "=== update to $TAG finished successfully ==="
