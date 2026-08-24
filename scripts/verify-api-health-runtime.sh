#!/usr/bin/env bash
set -euo pipefail

API_HOST_VALUE="${API_HOST:-127.0.0.1}"
API_PORT_VALUE="${API_PORT:-3210}"
WAIT_SECONDS="${WAIT_SECONDS:-20}"
POLL_SECONDS="${POLL_SECONDS:-1}"
LOG_FILE="${API_HEALTH_LOG_FILE:-${RUNNER_TEMP:-/tmp}/ai-editor-health-api.log}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1" >&2
    exit 1
  }
}

require node
require curl

API_HOST="$API_HOST_VALUE" API_PORT="$API_PORT_VALUE" node apps/api/health-server.mjs >"$LOG_FILE" 2>&1 &
api_pid=$!
cleanup() {
  kill "$api_pid" >/dev/null 2>&1 || true
  wait "$api_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_endpoint() {
  local path="$1"
  local started_at now
  started_at="$(date +%s)"
  while true; do
    if curl --fail --silent --show-error --max-time 2 "http://${API_HOST_VALUE}:${API_PORT_VALUE}${path}" >/dev/null 2>&1; then
      return 0
    fi
    if ! kill -0 "$api_pid" >/dev/null 2>&1; then
      echo "ERROR: health API exited before ${path} became ready" >&2
      cat "$LOG_FILE" >&2 || true
      return 1
    fi
    now="$(date +%s)"
    if (( now - started_at >= WAIT_SECONDS )); then
      echo "ERROR: timed out waiting for ${path}" >&2
      cat "$LOG_FILE" >&2 || true
      return 1
    fi
    sleep "$POLL_SECONDS"
  done
}

wait_for_endpoint '/health/live'
live_body="$(curl --fail --silent --show-error "http://${API_HOST_VALUE}:${API_PORT_VALUE}/health/live")"
[[ "$live_body" == '{"status":"ok"}' ]] || {
  echo "ERROR: unexpected liveness body: $live_body" >&2
  exit 1
}

echo 'PASS: API /health/live returned 200 status=ok'

wait_for_endpoint '/health/ready'
ready_body="$(curl --fail --silent --show-error "http://${API_HOST_VALUE}:${API_PORT_VALUE}/health/ready")"
[[ "$ready_body" == '{"status":"ready","postgres":"ok","qdrant":"ok"}' ]] || {
  echo "ERROR: unexpected readiness body: $ready_body" >&2
  exit 1
}

echo 'PASS: API /health/ready confirmed PostgreSQL + Qdrant dependencies'
