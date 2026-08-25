BEGIN;

ALTER TABLE scene_set_revisions
  ADD CONSTRAINT scene_set_revisions_proxy_source_unique
  UNIQUE (
    scene_set_id,
    revision_id,
    source_asset_id,
    source_stream_id,
    source_stream_index,
    source_time_base_numerator,
    source_time_base_denominator
  );

CREATE TABLE proxy_derivative_revisions (
  revision_id text PRIMARY KEY,
  schema_version text NOT NULL,
  derivative_id text NOT NULL,
  scene_set_id text NOT NULL,
  scene_set_revision_id text NOT NULL,
  source_asset_id text NOT NULL,
  source_stream_id text NOT NULL,
  source_stream_index integer NOT NULL CHECK (source_stream_index >= 0),
  source_time_base_numerator bigint NOT NULL CHECK (source_time_base_numerator > 0),
  source_time_base_denominator bigint NOT NULL CHECK (source_time_base_denominator > 0),
  derivative_profile_version text NOT NULL,
  toolchain_name text NOT NULL,
  toolchain_version text NOT NULL,
  artifact_uri text NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT proxy_derivative_revisions_scene_source_fk
    FOREIGN KEY (
      scene_set_id,
      scene_set_revision_id,
      source_asset_id,
      source_stream_id,
      source_stream_index,
      source_time_base_numerator,
      source_time_base_denominator
    )
    REFERENCES scene_set_revisions(
      scene_set_id,
      revision_id,
      source_asset_id,
      source_stream_id,
      source_stream_index,
      source_time_base_numerator,
      source_time_base_denominator
    )
    ON DELETE RESTRICT
);

CREATE INDEX proxy_derivative_revisions_derivative_idx
  ON proxy_derivative_revisions(derivative_id, revision_id);
CREATE INDEX proxy_derivative_revisions_scene_source_idx
  ON proxy_derivative_revisions(scene_set_id, scene_set_revision_id);

COMMIT;
