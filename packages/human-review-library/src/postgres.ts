import {
  validateHumanReviewDecision,
  type HumanReviewDecisionV1,
} from '../../contracts/src/human-review-decision.contract.js';
import type { PostgresQueryClient } from '../../media-catalog/src/postgres.js';
import {
  HumanReviewDecisionPersistenceInvariantError,
  sameImmutableHumanReviewDecision,
  type RegisterHumanReviewDecisionResult,
} from './index.js';

type DecisionRow = {
  decision_id: string;
  schema_version: HumanReviewDecisionV1['schemaVersion'];
  review_session_id: string;
  ai_decision_id: string;
  reviewed_revision_id: string;
  item_id: string;
  action: HumanReviewDecisionV1['action'];
  resulting_revision_id: string | null;
  reviewed_by: string;
  reviewed_at: string;
};

/**
 * Durable PostgreSQL boundary for immutable human-review decisions.
 *
 * The table stores review/evaluation evidence and immutable revision IDs only.
 * Canonical project frames, source PTS and source mapping remain owned by the
 * referenced timeline revisions and are deliberately not duplicated here.
 */
export class PostgresHumanReviewDecisionStore {
  constructor(private readonly client: PostgresQueryClient) {}

  async registerDecision(candidate: HumanReviewDecisionV1): Promise<RegisterHumanReviewDecisionResult> {
    assertValidDecision(candidate);
    const normalized = cloneDecision(candidate);

    await this.client.query('BEGIN');
    try {
      const inserted = await this.client.query<{ decision_id: string }>(
        `INSERT INTO human_review_decisions (
           decision_id, schema_version, review_session_id, ai_decision_id,
           reviewed_revision_id, item_id, action, resulting_revision_id,
           reviewed_by, reviewed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (decision_id) DO NOTHING
         RETURNING decision_id`,
        [
          normalized.decisionId,
          normalized.schemaVersion,
          normalized.reviewSessionId,
          normalized.aiDecisionId,
          normalized.reviewedRevisionId,
          normalized.itemId,
          normalized.action,
          normalized.resultingRevisionId ?? null,
          normalized.reviewedBy,
          normalized.reviewedAt,
        ],
      );

      if (inserted.rows[0]) {
        await this.client.query('COMMIT');
        return { decision: cloneDecision(normalized), created: true };
      }

      const existing = await this.getDecisionInternal(normalized.decisionId);
      if (!existing) {
        throw new HumanReviewDecisionPersistenceInvariantError(
          'human review decision conflict disappeared before readback',
        );
      }
      if (!sameImmutableHumanReviewDecision(existing, normalized)) {
        throw new HumanReviewDecisionPersistenceInvariantError(
          `human review decisionId ${normalized.decisionId} conflicts with existing immutable decision`,
        );
      }

      await this.client.query('COMMIT');
      return { decision: cloneDecision(existing), created: false };
    } catch (error) {
      await this.client.query('ROLLBACK').catch(() => undefined);
      throw error;
    }
  }

  async getDecision(decisionId: string): Promise<HumanReviewDecisionV1 | undefined> {
    return this.getDecisionInternal(decisionId);
  }

  private async getDecisionInternal(decisionId: string): Promise<HumanReviewDecisionV1 | undefined> {
    const result = await this.client.query<DecisionRow>(
      `SELECT decision_id, schema_version, review_session_id, ai_decision_id,
              reviewed_revision_id, item_id, action, resulting_revision_id,
              reviewed_by, reviewed_at
         FROM human_review_decisions
        WHERE decision_id = $1`,
      [decisionId],
    );
    const row = result.rows[0];
    if (!row) return undefined;

    const decision: HumanReviewDecisionV1 = {
      schemaVersion: row.schema_version,
      decisionId: row.decision_id,
      reviewSessionId: row.review_session_id,
      aiDecisionId: row.ai_decision_id,
      reviewedRevisionId: row.reviewed_revision_id,
      itemId: row.item_id,
      action: row.action,
      ...(row.resulting_revision_id === null ? {} : { resultingRevisionId: row.resulting_revision_id }),
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
    };
    assertValidDecision(decision);
    return cloneDecision(decision);
  }
}

function assertValidDecision(candidate: HumanReviewDecisionV1): void {
  const validation = validateHumanReviewDecision(candidate);
  if (!validation.valid) {
    throw new HumanReviewDecisionPersistenceInvariantError(validation.errors.join('; '));
  }
}

function cloneDecision(decision: HumanReviewDecisionV1): HumanReviewDecisionV1 {
  return { ...decision };
}
