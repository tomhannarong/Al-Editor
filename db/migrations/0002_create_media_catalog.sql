BEGIN;

CREATE TABLE media_assets (
  asset_id text PRIMARY KEY,
  schema_version text NOT NULL,
  digest_algorithm text NOT NULL CHECK (digest_algorithm = 'sha256'),
  digest_hex text NOT NULL CHECK (digest_hex ~ '^[a-f0-9]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  first_ingested_at timestamptz NOT NULL,
  CONSTRAINT media_assets_content_address CHECK (asset_id = 'sha256:' || digest_hex),
  CONSTRAINT media_assets_digest_unique UNIQUE (digest_algorithm, digest_hex)
);

CREATE TABLE media_storage_locations (
  location_id text PRIMARY KEY,
  asset_id text NOT NULL REFERENCES media_assets(asset_id) ON DELETE RESTRICT,
  uri text NOT NULL,
  state text NOT NULL CHECK (state IN ('available', 'missing', 'quarantined')),
  observed_at timestamptz NOT NULL
);
CREATE INDEX media_storage_locations_asset_idx ON media_storage_locations(asset_id);

CREATE TABLE media_streams (
  stream_id text PRIMARY KEY,
  asset_id text NOT NULL REFERENCES media_assets(asset_id) ON DELETE CASCADE,
  stream_index integer NOT NULL CHECK (stream_index >= 0),
  kind text NOT NULL CHECK (kind IN ('video', 'audio', 'subtitle', 'data', 'attachment', 'unknown')),
  codec_name text,
  time_base_numerator bigint NOT NULL CHECK (time_base_numerator > 0),
  time_base_denominator bigint NOT NULL CHECK (time_base_denominator > 0),
  start_pts bigint,
  duration_pts bigint CHECK (duration_pts IS NULL OR duration_pts >= 0),
  width integer CHECK (width IS NULL OR width > 0),
  height integer CHECK (height IS NULL OR height > 0),
  sample_rate integer CHECK (sample_rate IS NULL OR sample_rate > 0),
  channels integer CHECK (channels IS NULL OR channels > 0),
  CONSTRAINT media_streams_asset_index_unique UNIQUE (asset_id, stream_index),
  CONSTRAINT media_streams_asset_stream_id_unique UNIQUE (asset_id, stream_id)
);
CREATE INDEX media_streams_asset_idx ON media_streams(asset_id, stream_index);

COMMIT;
