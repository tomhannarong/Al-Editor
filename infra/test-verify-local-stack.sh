#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/tmp/ai-editor-local-stack-verifier-test}"
rm -rf "$ROOT"
mkdir -p "$ROOT/bin" "$ROOT/work"

cat > "$ROOT/bin/docker" <<'DOCKER'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  info) exit 0 ;;
  compose)
    shift
    while [[ "${1:-}" == "-f" ]]; do shift 2; done
    case "${1:-}" in
      config) exit 0 ;;
      up) exit 0 ;;
      ps)
        if [[ "${2:-}" == "-q" ]]; then
          case "${3:-}" in postgres) echo fake-postgres ;; qdrant) echo fake-qdrant ;; *) exit 1 ;; esac
        fi
        ;;
      exec) exit 0 ;;
      logs) exit 0 ;;
      *) echo "unexpected docker compose command: $*" >&2; exit 2 ;;
    esac
    ;;
  inspect) echo healthy ;;
  *) echo "unexpected docker command: $*" >&2; exit 2 ;;
esac
DOCKER
chmod +x "$ROOT/bin/docker"

cat > "$ROOT/bin/curl" <<'CURL'
#!/usr/bin/env bash
set -euo pipefail
exit 0
CURL
chmod +x "$ROOT/bin/curl"

cat > "$ROOT/work/docker-compose.yml" <<'YAML'
services: {}
YAML

PATH="$ROOT/bin:$PATH" COMPOSE_FILE="$ROOT/work/docker-compose.yml" WAIT_SECONDS=2 POLL_SECONDS=1 \
  bash infra/verify-local-stack.sh >"$ROOT/output.log"

grep -q 'PASS: postgres is healthy' "$ROOT/output.log"
grep -q 'PASS: qdrant HTTP health endpoint succeeded' "$ROOT/output.log"
grep -q 'PASS: PostgreSQL readiness command succeeded' "$ROOT/output.log"
grep -q 'PASS: local PostgreSQL + Qdrant runtime gate succeeded' "$ROOT/output.log"

echo 'PASS: verify-local-stack.sh control-flow self-test succeeded'
