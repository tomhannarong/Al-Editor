import assert from 'node:assert/strict';
import pg from 'pg';

import { PostgresHumanReviewDecisionStore } from '../packages/human-review-library/src/postgres.ts';
import type { HumanReviewDecisionV1 } from '../packages/contracts/src/human-review-decision.contract.ts';

const { Client } = pg;
const client = new Client({
  host: process.env.POSTGRES_HOST ?? '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT ?? '5432'),
  database: process.env.POSTGRES_DB ?? 'ai_editor',
  user: process.env.POSTGRES_USER ?? 'ai_editor',
  password: process.env.POSTGRES_PASSWORD ?? 'ai_editor_local_only',
});

try {
  await client.connect();
  const schema = await client.query<{ decisions: string | null }>(
    `SELECT to_regclass('public.human_review_decisions')::text AS decisions`,
  );
  assert.equal(schema.rows[0]?.decisions, 'human_review_decisions');

  const decision: HumanReviewDecisionV1 = {
    schemaVersion: '1.0',
    decisionId: 'runtime-review-decision:001',
    reviewSessionId: 'runtime-review-session:001',
    aiDecisionId: 'runtime-ai-decision:001',
    reviewedRevisionId: 'runtime-timeline-revision:001',
    itemId: 'runtime-clip:001',
    action: 'trim',
    resultingRevisionId: 'runtime-timeline-revision:002',
    reviewedBy: 'runtime-reviewer:001',
    reviewedAt: '2026-08-27T02:20:00.000Z',
  };

  const store = new PostgresHumanReviewDecisionStore(client);
  const first = await store.registerDecision(decision);
  assert.equal(first.created, true);
  assert.deepEqual(first.decision, decision);

  const second = await store.registerDecision(decision);
  assert.equal(second.created, false);
  assert.deepEqual(second.decision, decision);
  assert.deepEqual(await store.getDecision(decision.decisionId), decision);

  await assert.rejects(
    store.registerDecision({ ...decision, action: 'replace' }),
    /conflicts with existing immutable decision/,
  );
  assert.deepEqual(await store.getDecision(decision.decisionId), decision);

  const accepted: HumanReviewDecisionV1 = {
    ...decision,
    decisionId: 'runtime-review-decision:002',
    aiDecisionId: 'runtime-ai-decision:002',
    action: 'accept',
    reviewedAt: '2026-08-27T02:21:00.000Z',
  };
  delete accepted.resultingRevisionId;
  const acceptedResult = await store.registerDecision(accepted);
  assert.equal(acceptedResult.created, true);
  assert.deepEqual(await store.getDecision(accepted.decisionId), accepted);

  await assert.rejects(
    client.query(
      `INSERT INTO human_review_decisions (
         decision_id, schema_version, review_session_id, ai_decision_id,
         reviewed_revision_id, item_id, action, resulting_revision_id,
         reviewed_by, reviewed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        'runtime-review-decision:invalid',
        '1.0',
        'runtime-review-session:invalid',
        'runtime-ai-decision:invalid',
        'runtime-timeline-revision:010',
        'runtime-clip:invalid',
        'accept',
        'runtime-timeline-revision:011',
        'runtime-reviewer:001',
        '2026-08-27T02:22:00.000Z',
      ],
    ),
    /check constraint|violates/i,
  );

  const rows = await client.query<{
    decision_id: string;
    review_session_id: string;
    ai_decision_id: string;
    reviewed_revision_id: string;
    item_id: string;
    action: string;
    resulting_revision_id: string | null;
    reviewed_by: string;
    reviewed_at: string;
  }>(
    `SELECT decision_id, review_session_id, ai_decision_id,
            reviewed_revision_id, item_id, action, resulting_revision_id,
            reviewed_by, reviewed_at
       FROM human_review_decisions
      WHERE review_session_id = $1
      ORDER BY decision_id`,
    [decision.reviewSessionId],
  );
  assert.deepEqual(rows.rows, [
    {
      decision_id: decision.decisionId,
      review_session_id: decision.reviewSessionId,
      ai_decision_id: decision.aiDecisionId,
      reviewed_revision_id: decision.reviewedRevisionId,
      item_id: decision.itemId,
      action: decision.action,
      resulting_revision_id: decision.resultingRevisionId ?? null,
      reviewed_by: decision.reviewedBy,
      reviewed_at: decision.reviewedAt,
    },
    {
      decision_id: accepted.decisionId,
      review_session_id: accepted.reviewSessionId,
      ai_decision_id: accepted.aiDecisionId,
      reviewed_revision_id: accepted.reviewedRevisionId,
      item_id: accepted.itemId,
      action: accepted.action,
      resulting_revision_id: null,
      reviewed_by: accepted.reviewedBy,
      reviewed_at: accepted.reviewedAt,
    },
  ]);

  const columns = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='human_review_decisions'`,
  );
  assert(!columns.rows.some((row) => /pts|frame|second|millisecond/i.test(row.column_name)));

  process.stdout.write('PostgreSQL human-review runtime proof passed: immutable idempotent review decisions, fail-closed conflict/result semantics and durable readback hold without duplicating canonical timing/source state.\n');
} finally {
  await client.end().catch(() => undefined);
}
