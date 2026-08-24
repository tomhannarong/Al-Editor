#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-infra/docker-compose.yml}"
WAIT_SECONDS="${WAIT_SECONDS:-90}"
POLL_SECONDS="${POLL_SECONDS:-2}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "ERROR: required command not found: $1" >&2
    exit 127
  }
}

require docker

docker info >/dev/null 2>&1 || {
  echo "ERROR: Docker daemon is not reachable" >&2
  exit 1
}

docker compose -f "$COMPOSE_FILE" config -q

docker compose -f "$COMPOSE_FILE" up -d postgres qdrant

wait_for_healthy() {
  local service="$1"
  local started_at now container_id status
  started_at="$(date +%s)"

  while true; do
    container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$service")"
    if [[ -z "$container_id" ]]; then
      echo "ERROR: service $service has no running container" >&2
      return 1
    fi

    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container_id")"
    case "$status" in
      healthy)
        echo "PASS: $service is healthy"
        return 0
        ;;
      unhealthy)
        echo "ERROR: $service became unhealthy" >&2
        docker compose -f "$COMPOSE_FILE" logs --no-color "$service" >&2 || true
        return 1
        ;;
      no-healthcheck)
        echo "ERROR: $service has no container healthcheck" >&2
        return 1
        ;;
    esac

    now="$(date +%s)"
    if (( now - started_at >= WAIT_SECONDS )); then
      echo "ERROR: timed out waiting for $service health after ${WAIT_SECONDS}s (last status: $status)" >&2
      docker compose -f "$COMPOSE_FILE" logs --no-color "$service" >&2 || true
      return 1
    fi

    sleep "$POLL_SECONDS"
  done
}

wait_for_healthy postgres
wait_for_healthy qdrant

POSTGRES_USER_VALUE="${POSTGRES_USER:-ai_editor}"
POSTGRES_DB_VALUE="${POSTGRES_DB:-ai_editor}"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_isready -U "$POSTGRES_USER_VALUE" -d "$POSTGRES_DB_VALUE" >/dev/null

echo "PASS: PostgreSQL readiness command succeeded"
echo "PASS: local PostgreSQL + Qdrant runtime gate succeeded"
