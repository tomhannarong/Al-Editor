BEGIN;

ALTER TABLE media_streams
  ADD CONSTRAINT media_streams_asset_stream_index_unique
  UNIQUE (asset_id, stream_id, stream_index);

CREATE TABLE scene_set_revisions (
  revision_id text PRIMARY KEY,
  schema_version text NOT NULL,
  scene_set_id text NOT NULL,
  source_asset_id text NOT NULL,
  source_stream_id text NOT NULL,
  source_stream_index integer NOT NULL CHECK (source_stream_index >= 0),
  source_time_base_numerator bigint NOT NULL CHECK (source_time_base_numerator > 0),
  source_time_base_denominator bigint NOT NULL CHECK (source_time_base_denominator > 0),
  detector_version text NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT scene_set_revisions_source_stream_fk
    FOREIGN KEY (source_asset_id, source_stream_id, source_stream_index)
    REFERENCES media_streams(asset_id, stream_id, stream_index)
    ON DELETE RESTRICT
);
CREATE INDEX scene_set_revisions_scene_set_idx ON scene_set_revisions(scene_set_id, revision_id);
CREATE INDEX scene_set_revisions_source_idx ON scene_set_revisions(source_asset_id, source_stream_id, source_stream_index);

CREATE TABLE scene_set_intervals (
  revision_id text NOT NULL REFERENCES scene_set_revisions(revision_id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  scene_id text NOT NULL,
  source_start_pts bigint NOT NULL,
  source_end_pts bigint NOT NULL,
  PRIMARY KEY (revision_id, scene_id),
  CONSTRAINT scene_set_intervals_revision_ordinal_unique UNIQUE (revision_id, ordinal),
  CONSTRAINT scene_set_intervals_positive_span CHECK (source_end_pts > source_start_pts)
);

COMMIT;
