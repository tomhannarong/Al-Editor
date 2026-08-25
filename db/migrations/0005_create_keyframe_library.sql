BEGIN;

CREATE TABLE keyframe_derivative_revisions (
  revision_id text PRIMARY KEY,
  schema_version text NOT NULL,
  derivative_id text NOT NULL,
  scene_set_id text NOT NULL,
  scene_set_revision_id text NOT NULL,
  scene_id text NOT NULL,
  source_asset_id text NOT NULL,
  source_stream_id text NOT NULL,
  source_stream_index integer NOT NULL CHECK (source_stream_index >= 0),
  source_time_base_numerator bigint NOT NULL CHECK (source_time_base_numerator > 0),
  source_time_base_denominator bigint NOT NULL CHECK (source_time_base_denominator > 0),
  derivative_profile_version text NOT NULL,
  toolchain_name text NOT NULL,
  toolchain_version text NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT keyframe_derivative_revisions_scene_source_fk
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
    ON DELETE RESTRICT,
  CONSTRAINT keyframe_derivative_revisions_scene_interval_fk
    FOREIGN KEY (scene_set_revision_id, scene_id)
    REFERENCES scene_set_intervals(revision_id, scene_id)
    ON DELETE RESTRICT
);

CREATE TABLE keyframe_derivative_frames (
  revision_id text NOT NULL REFERENCES keyframe_derivative_revisions(revision_id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  frame_id text NOT NULL,
  source_pts bigint NOT NULL,
  artifact_uri text NOT NULL,
  PRIMARY KEY (revision_id, frame_id),
  CONSTRAINT keyframe_derivative_frames_revision_ordinal_unique UNIQUE (revision_id, ordinal),
  CONSTRAINT keyframe_derivative_frames_revision_pts_unique UNIQUE (revision_id, source_pts)
);

CREATE INDEX keyframe_derivative_revisions_derivative_idx
  ON keyframe_derivative_revisions(derivative_id, revision_id);
CREATE INDEX keyframe_derivative_revisions_scene_idx
  ON keyframe_derivative_revisions(scene_set_id, scene_set_revision_id, scene_id);

COMMIT;
