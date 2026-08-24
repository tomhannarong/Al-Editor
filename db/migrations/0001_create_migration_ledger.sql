-- AI Editor migration ledger.
-- This migration is append-only after publication. Never edit an applied file.
CREATE TABLE IF NOT EXISTS ai_editor_schema_migrations (
  version bigint PRIMARY KEY,
  name text NOT NULL UNIQUE,
  checksum_sha256 char(64) NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by text NOT NULL,
  execution_ms bigint NOT NULL CHECK (execution_ms >= 0),
  CONSTRAINT ai_editor_schema_migrations_checksum_hex
    CHECK (checksum_sha256 ~ '^[0-9a-f]{64}$')
);
