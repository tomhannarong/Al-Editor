BEGIN;

CREATE TABLE human_review_decisions (
  decision_id text PRIMARY KEY,
  schema_version text NOT NULL,
  review_session_id text NOT NULL,
  ai_decision_id text NOT NULL,
  reviewed_revision_id text NOT NULL,
  item_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('accept','replace','trim','lock')),
  resulting_revision_id text,
  reviewed_by text NOT NULL,
  reviewed_at text NOT NULL,
  CONSTRAINT human_review_decisions_result_semantics CHECK (
    (action = 'accept' AND resulting_revision_id IS NULL)
    OR
    (action IN ('replace','trim','lock') AND resulting_revision_id IS NOT NULL AND resulting_revision_id <> reviewed_revision_id)
  )
);

CREATE INDEX human_review_decisions_session_idx
  ON human_review_decisions(review_session_id, reviewed_at, decision_id);
CREATE INDEX human_review_decisions_ai_decision_idx
  ON human_review_decisions(ai_decision_id, decision_id);
CREATE INDEX human_review_decisions_reviewed_revision_idx
  ON human_review_decisions(reviewed_revision_id, item_id, decision_id);

COMMIT;
