BEGIN;

CREATE TABLE editorial_segment_revisions (
  revision_id text PRIMARY KEY,
  schema_version text NOT NULL,
  segment_set_id text NOT NULL,
  transcript_id text NOT NULL,
  transcript_revision_id text NOT NULL,
  created_at text NOT NULL,
  CONSTRAINT editorial_segment_revisions_identity_unique UNIQUE (segment_set_id, revision_id),
  CONSTRAINT editorial_segment_revisions_transcript_target_unique UNIQUE (revision_id, transcript_revision_id),
  CONSTRAINT editorial_segment_revisions_transcript_fk FOREIGN KEY (
    transcript_id,
    transcript_revision_id
  ) REFERENCES transcript_revisions(
    transcript_id,
    revision_id
  ) ON DELETE RESTRICT
);

CREATE TABLE editorial_segments (
  revision_id text NOT NULL,
  transcript_revision_id text NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  segment_id text NOT NULL,
  start_word_id text NOT NULL,
  end_word_id text NOT NULL,
  PRIMARY KEY (revision_id, segment_id),
  CONSTRAINT editorial_segments_revision_ordinal_unique UNIQUE (revision_id, ordinal),
  CONSTRAINT editorial_segments_revision_fk FOREIGN KEY (
    revision_id,
    transcript_revision_id
  ) REFERENCES editorial_segment_revisions(
    revision_id,
    transcript_revision_id
  ) ON DELETE CASCADE,
  CONSTRAINT editorial_segments_start_word_fk FOREIGN KEY (
    transcript_revision_id,
    start_word_id
  ) REFERENCES transcript_words(
    revision_id,
    word_id
  ) ON DELETE RESTRICT,
  CONSTRAINT editorial_segments_end_word_fk FOREIGN KEY (
    transcript_revision_id,
    end_word_id
  ) REFERENCES transcript_words(
    revision_id,
    word_id
  ) ON DELETE RESTRICT
);

CREATE INDEX editorial_segment_revisions_set_idx
  ON editorial_segment_revisions(segment_set_id, revision_id);
CREATE INDEX editorial_segments_revision_order_idx
  ON editorial_segments(revision_id, ordinal);

COMMIT;
