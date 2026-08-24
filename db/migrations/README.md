# AI Editor database migrations

Migration files are immutable, append-only release artifacts. Use `NNNN_snake_case.sql`, starting at `0001` with no gaps. Never edit or renumber a migration after it has been applied anywhere durable.

`npm run migration:verify` discovers migrations in deterministic numeric order, hashes the exact file bytes with SHA-256 and rejects malformed filenames, empty files, sequence gaps and duplicate versions. `--applied-history <json>` additionally rejects unknown database versions plus name/checksum drift.

The first migration creates `ai_editor_schema_migrations`, which records version, stable name, checksum, actor, timestamp and execution duration. A future PostgreSQL runner must acquire an advisory lock, validate the complete applied history before executing anything, execute each pending migration transactionally where PostgreSQL permits it, and insert the ledger row in the same transaction. Runtime execution remains blocked until P0-03 PostgreSQL boot/readiness proof exists.
