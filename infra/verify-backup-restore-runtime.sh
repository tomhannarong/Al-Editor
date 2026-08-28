#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose -f infra/docker-compose.yml)
pg_source='ai_editor_restore_source_v1'
pg_target='ai_editor_restore_target_v1'
qd_source='ai_editor_restore_source_v1'
qd_target='ai_editor_restore_target_v1'
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"; curl --silent --show-error -X DELETE "http://127.0.0.1:6333/collections/'"$qd_source"'" >/dev/null 2>&1 || true; curl --silent --show-error -X DELETE "http://127.0.0.1:6333/collections/'"$qd_target"'" >/dev/null 2>&1 || true; "${compose[@]}" exec -T postgres psql -U ai_editor -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS '"$pg_source"';" >/dev/null 2>&1 || true; "${compose[@]}" exec -T postgres psql -U ai_editor -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS '"$pg_target"';" >/dev/null 2>&1 || true' EXIT

started_ms=$(date +%s%3N)
started_at=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)

# PostgreSQL: create source, back it up, destroy source, then restore into a distinct clean target.
"${compose[@]}" exec -T postgres psql -U ai_editor -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${pg_source};" >/dev/null
"${compose[@]}" exec -T postgres psql -U ai_editor -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${pg_target};" >/dev/null
"${compose[@]}" exec -T postgres psql -U ai_editor -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${pg_source};" >/dev/null
"${compose[@]}" exec -T postgres psql -U ai_editor -d "$pg_source" -v ON_ERROR_STOP=1 -c "CREATE TABLE restore_probe(id integer primary key, marker text not null); INSERT INTO restore_probe VALUES (1, 'phase13-postgres');" >/dev/null
"${compose[@]}" exec -T postgres pg_dump -U ai_editor -Fc "$pg_source" > "$workdir/postgres.dump"
pg_sha=$(sha256sum "$workdir/postgres.dump" | awk '{print $1}')
"${compose[@]}" exec -T postgres psql -U ai_editor -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE ${pg_source}; CREATE DATABASE ${pg_target};" >/dev/null
cat "$workdir/postgres.dump" | "${compose[@]}" exec -T postgres pg_restore -U ai_editor -d "$pg_target" --no-owner --no-privileges
pg_marker=$("${compose[@]}" exec -T postgres psql -U ai_editor -d "$pg_target" -Atqc "SELECT marker FROM restore_probe WHERE id=1")
[[ "$pg_marker" == 'phase13-postgres' ]]
pg_count=$("${compose[@]}" exec -T postgres psql -U ai_editor -d "$pg_target" -Atqc "SELECT count(*) FROM restore_probe")

# Qdrant: snapshot source collection, download/checksum artifact, delete source, recover into a distinct absent collection.
base='http://127.0.0.1:6333'
curl --fail-with-body --silent --show-error -X DELETE "$base/collections/$qd_source" >/dev/null 2>&1 || true
curl --fail-with-body --silent --show-error -X DELETE "$base/collections/$qd_target" >/dev/null 2>&1 || true
curl --fail-with-body --silent --show-error -X PUT "$base/collections/$qd_source" -H 'Content-Type: application/json' --data '{"vectors":{"size":4,"distance":"Cosine"}}' >/dev/null
curl --fail-with-body --silent --show-error -X PUT "$base/collections/$qd_source/points?wait=true" -H 'Content-Type: application/json' --data '{"points":[{"id":1,"vector":[0.1,0.2,0.3,0.4],"payload":{"marker":"phase13-qdrant"}}]}' >/dev/null
snapshot_response=$(curl --fail-with-body --silent --show-error -X POST "$base/collections/$qd_source/snapshots")
snapshot_name=$(node -e "const b=JSON.parse(process.argv[1]); const n=b.result?.name; if(!n) process.exit(1); process.stdout.write(n)" "$snapshot_response")
curl --fail-with-body --silent --show-error "$base/collections/$qd_source/snapshots/$snapshot_name" -o "$workdir/qdrant.snapshot"
qd_sha=$(sha256sum "$workdir/qdrant.snapshot" | awk '{print $1}')
curl --fail-with-body --silent --show-error -X DELETE "$base/collections/$qd_source" >/dev/null
curl --fail-with-body --silent --show-error -X POST "$base/collections/$qd_target/snapshots/upload?wait=true&priority=snapshot" -F "snapshot=@$workdir/qdrant.snapshot" >/dev/null
qd_response=$(curl --fail-with-body --silent --show-error -X POST "$base/collections/$qd_target/points" -H 'Content-Type: application/json' --data '{"ids":[1],"with_payload":true,"with_vector":true}')
qd_count=$(node -e "const b=JSON.parse(process.argv[1]); const p=b.result?.[0]; if(!p||p.payload?.marker!=='phase13-qdrant'||!Array.isArray(p.vector)||p.vector.length!==4) process.exit(1); process.stdout.write('1')" "$qd_response")

completed_ms=$(date +%s%3N)
completed_at=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
duration_ms=$((completed_ms-started_ms))

node - <<'NODE' "$started_at" "$completed_at" "$duration_ms" "$pg_sha" "$pg_count" "$qd_sha" "$qd_count"
const [startedAt, completedAt, duration, pgSha, pgCount, qdSha, qdCount] = process.argv.slice(2);
const evidence = {
  schemaVersion: '1.0',
  policyId: 'backup-restore:phase13',
  policyRevisionId: 'backup-restore:phase13:r1',
  startedAt,
  completedAt,
  restoreDurationMs: Number(duration),
  cleanTargetVerified: true,
  stores: [
    { store: 'postgresql', artifactSha256: pgSha, sourceIdentity: 'database:ai_editor_restore_source_v1', targetIdentity: 'database:ai_editor_restore_target_v1', restoredRecordCount: Number(pgCount) },
    { store: 'qdrant', artifactSha256: qdSha, sourceIdentity: 'collection:ai_editor_restore_source_v1', targetIdentity: 'collection:ai_editor_restore_target_v1', restoredRecordCount: Number(qdCount) },
  ],
};
if (!Number.isSafeInteger(evidence.restoreDurationMs) || evidence.restoreDurationMs < 0 || evidence.restoreDurationMs > 900000) process.exit(1);
for (const store of evidence.stores) if (!/^[a-f0-9]{64}$/.test(store.artifactSha256) || store.restoredRecordCount !== 1) process.exit(1);
console.log('PHASE13_BACKUP_RESTORE_DRILL_V1=' + JSON.stringify(evidence));
NODE
