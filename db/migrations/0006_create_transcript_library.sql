BEGIN;

ALTER TABLE media_streams
  ADD CONSTRAINT media_streams_transcript_source_unique
  UNIQUE (
    asset_id,
    stream_id,
    stream_index,
    time_base_numerator,
    time_base_denominator,
    kind
  );

CREATE TABLE transcript_revisions (
  revision_id text PRIMARY KEY,
  schema_version text NOT NULL,
  transcript_id text NOT NULL,
  revision_kind text NOT NULL CHECK (revision_kind IN ('asr', 'correction')),
  parent_revision_id text,
  source_asset_id text NOT NULL,
  source_stream_id text NOT NULL,
  source_stream_index integer NOT NULL CHECK (source_stream_index >= 0),
  source_time_base_numerator bigint NOT NULL CHECK (source_time_base_numerator > 0),
  source_time_base_denominator bigint NOT NULL CHECK (source_time_base_denominator > 0),
  source_stream_kind text NOT NULL CHECK (source_stream_kind = 'audio'),
  asr_model_version text NOT NULL,
  language text NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT transcript_revisions_parent_shape CHECK (
    (revision_kind = 'asr' AND parent_revision_id IS NULL)
    OR (revision_kind = 'correction' AND parent_revision_id IS NOT NULL AND parent_revision_id <> revision_id)
  ),
  CONSTRAINT transcript_revisions_identity_unique UNIQUE (transcript_id, revision_id),
  CONSTRAINT transcript_revisions_parent_source_target_unique UNIQUE (
    transcript_id,
    revision_id,
    source_asset_id,
    source_stream_id,
    source_stream_index,
    source_time_base_numerator,
    source_time_base_denominator,
    source_stream_kind
  ),
  CONSTRAINT transcript_revisions_source_fk FOREIGN KEY (
    source_asset_id,
    source_stream_id,
    source_stream_index,
    source_time_base_numerator,
    source_time_base_denominator,
    source_stream_kind
  ) REFERENCES media_streams(
    asset_id,
    stream_id,
    stream_index,
    time_base_numerator,
    time_base_denominator,
    kind
  ) ON DELETE RESTRICT,
  CONSTRAINT transcript_revisions_parent_source_fk FOREIGN KEY (
    transcript_id,
    parent_revision_id,
    source_asset_id,
    source_stream_id,
    source_stream_index,
    source_time_base_numerator,
    source_time_base_denominator,
    source_stream_kind
  ) REFERENCES transcript_revisions(
    transcript_id,
    revision_id,
    source_asset_id,
    source_stream_id,
    source_stream_index,
    source_time_base_numerator,
    source_time_base_denominator,
    source_stream_kind
  ) ON DELETE RESTRICT
);

CREATE TABLE transcript_words (
  revision_id text NOT NULL REFERENCES transcript_revisions(revision_id) ON DELETE CASCADE,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  word_id text NOT NULL,
  text text NOT NULL,
  source_start_pts bigint NOT NULL,
  source_end_pts bigint NOT NULL,
  confidence double precision,
  PRIMARY KEY (revision_id, word_id),
  CONSTRAINT transcript_words_revision_ordinal_unique UNIQUE (revision_id, ordinal),
  CONSTRAINT transcript_words_interval CHECK (source_end_pts > source_start_pts),
  CONSTRAINT transcript_words_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX transcript_revisions_transcript_idx ON transcript_revisions(transcript_id, revision_id);
CREATE INDEX transcript_words_revision_order_idx ON transcript_words(revision_id, ordinal);

COMMIT;
