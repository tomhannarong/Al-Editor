import { describe, expect, it } from 'vitest';

import type { HumanReviewDecisionV1 } from '../../contracts/src/human-review-decision.contract.js';
import type { PostgresQueryClient, PostgresQueryResult } from '../../media-catalog/src/postgres.js';
import { HumanReviewDecisionPersistenceInvariantError } from './index.js';
import { PostgresHumanReviewDecisionStore } from './postgres.js';

const reviewDecision: HumanReviewDecisionV1 = {
  schemaVersion: '1.0',
  decisionId: 'review-decision:pg:001',
  reviewSessionId: 'review-session:pg:001',
  aiDecisionId: 'ai-decision:pg:001',
  reviewedRevisionId: 'timeline-revision:pg:001',
  itemId: 'clip:pg:001',
  action: 'trim',
  resultingRevisionId: 'timeline-revision:pg:002',
  reviewedBy: 'reviewer:pg:001',
  reviewedAt: '2026-08-27T02:15:00.000Z',
};

class ScriptedClient implements PostgresQueryClient {
  readonly calls: Array<{ text: string; values?: readonly unknown[] }> = [];
  constructor(private readonly handler: (text: string, values?: readonly unknown[]) => PostgresQueryResult) {}
  async query<Row = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PostgresQueryResult<Row>> {
    this.calls.push(values === undefined ? { text } : { text, values });
    const result = this.handler(text, values);
    return { rows: result.rows as Row[], rowCount: result.rowCount };
  }
}

function decisionRow(candidate = reviewDecision) {
  return {
    decision_id: candidate.decisionId,
    schema_version: candidate.schemaVersion,
    review_session_id: candidate.reviewSessionId,
    ai_decision_id: candidate.aiDecisionId,
    reviewed_revision_id: candidate.reviewedRevisionId,
    item_id: candidate.itemId,
    action: candidate.action,
    resulting_revision_id: candidate.resultingRevisionId ?? null,
    reviewed_by: candidate.reviewedBy,
    reviewed_at: candidate.reviewedAt,
  };
}

describe('PostgresHumanReviewDecisionStore', () => {
  it('validates before opening a transaction', async () => {
    const client = new ScriptedClient(() => ({ rows: [], rowCount: 0 }));
    const store = new PostgresHumanReviewDecisionStore(client);
    const invalid: HumanReviewDecisionV1 = { ...reviewDecision, action: 'accept' };
    await expect(store.registerDecision(invalid)).rejects.toBeInstanceOf(HumanReviewDecisionPersistenceInvariantError);
    expect(client.calls).toEqual([]);
  });

  it('inserts immutable review evidence transactionally', async () => {
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING decision_id')) return { rows: [{ decision_id: reviewDecision.decisionId }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresHumanReviewDecisionStore(client);
    await expect(store.registerDecision(reviewDecision)).resolves.toEqual({ decision: reviewDecision, created: true });
    expect(client.calls[0]?.text).toBe('BEGIN');
    const insert = client.calls.find((call) => call.text.includes('INSERT INTO human_review_decisions'));
    expect(insert?.values).toEqual([
      reviewDecision.decisionId,
      reviewDecision.schemaVersion,
      reviewDecision.reviewSessionId,
      reviewDecision.aiDecisionId,
      reviewDecision.reviewedRevisionId,
      reviewDecision.itemId,
      reviewDecision.action,
      reviewDecision.resultingRevisionId,
      reviewDecision.reviewedBy,
      reviewDecision.reviewedAt,
    ]);
    expect(client.calls.at(-1)?.text).toBe('COMMIT');
  });

  it('returns idempotent existing evidence and rolls back immutable conflicts', async () => {
    let row = decisionRow();
    const client = new ScriptedClient((text) => {
      if (text.includes('RETURNING decision_id')) return { rows: [], rowCount: 0 };
      if (text.includes('FROM human_review_decisions')) return { rows: [row], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresHumanReviewDecisionStore(client);
    await expect(store.registerDecision(reviewDecision)).resolves.toEqual({ decision: reviewDecision, created: false });
    expect(client.calls.at(-1)?.text).toBe('COMMIT');

    row = { ...row, action: 'replace' };
    await expect(store.registerDecision(reviewDecision)).rejects.toThrow('conflicts with existing immutable decision');
    expect(client.calls.at(-1)?.text).toBe('ROLLBACK');
  });

  it('reads accept evidence without inventing a resulting revision', async () => {
    const accepted: HumanReviewDecisionV1 = {
      ...reviewDecision,
      decisionId: 'review-decision:pg:accept',
      action: 'accept',
    };
    delete accepted.resultingRevisionId;
    const client = new ScriptedClient((text) => {
      if (text.includes('FROM human_review_decisions')) return { rows: [decisionRow(accepted)], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const store = new PostgresHumanReviewDecisionStore(client);
    await expect(store.getDecision(accepted.decisionId)).resolves.toEqual(accepted);
  });
});
