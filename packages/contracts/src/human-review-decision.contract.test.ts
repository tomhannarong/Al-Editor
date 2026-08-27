import { describe, expect, it } from 'vitest';

import {
  HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
  validateHumanReviewDecision,
  type HumanReviewDecisionV1,
} from './human-review-decision.contract.js';

function validDecision(action: HumanReviewDecisionV1['action'] = 'accept'): HumanReviewDecisionV1 {
  const base = {
    schemaVersion: HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: `review-decision:${action}:001`,
    reviewSessionId: 'review-session:001',
    aiDecisionId: 'ai-decision:scene-001',
    reviewedRevisionId: 'timeline-revision:r1',
    itemId: 'clip:001',
    action,
    reviewedBy: 'human:editor-001',
    reviewedAt: '2026-08-27T08:00:00.000+07:00',
  } satisfies Omit<HumanReviewDecisionV1, 'resultingRevisionId'>;

  return action === 'accept'
    ? base
    : { ...base, resultingRevisionId: `timeline-revision:r2-${action}` };
}

describe('human-review decision contract', () => {
  it('records acceptance against the reviewed immutable revision without inventing a child revision', () => {
    expect(validateHumanReviewDecision(validDecision('accept'))).toEqual({ valid: true, errors: [] });
  });

  it.each(['replace', 'trim', 'lock'] as const)(
    'requires %s evidence to point at a distinct child revision',
    (action) => {
      const decision = validDecision(action);
      expect(validateHumanReviewDecision(decision)).toEqual({ valid: true, errors: [] });

      decision.resultingRevisionId = decision.reviewedRevisionId;
      const result = validateHumanReviewDecision(decision);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('resultingRevisionId must differ from reviewedRevisionId');
    },
  );

  it('requires stable AI-decision, review-session, item and reviewer lineage', () => {
    const decision = validDecision();
    decision.aiDecisionId = ' ';
    decision.reviewSessionId = '';
    decision.itemId = ' ';
    decision.reviewedBy = '';

    const result = validateHumanReviewDecision(decision);
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'reviewSessionId is required',
      'aiDecisionId is required',
      'itemId is required',
      'reviewedBy is required',
    ]));
  });

  it('rejects child revision evidence on accept and missing child revision evidence on edits', () => {
    const accept = { ...validDecision('accept'), resultingRevisionId: 'timeline-revision:r2' };
    expect(validateHumanReviewDecision(accept).errors).toContain(
      'accept must not create a resulting revision',
    );

    const trim = validDecision('trim');
    delete trim.resultingRevisionId;
    expect(validateHumanReviewDecision(trim).errors).toContain('trim requires resultingRevisionId');
  });

  it('rejects unsupported actions and malformed review timestamps', () => {
    const decision = {
      ...validDecision(),
      action: 'delete',
      reviewedAt: 'not-a-timestamp',
    } as unknown as HumanReviewDecisionV1;

    const result = validateHumanReviewDecision(decision);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('unsupported human-review action');
    expect(result.errors).toContain('reviewedAt must be an ISO-compatible timestamp');
  });

  it('does not duplicate canonical timing or source mapping into review evidence', () => {
    const decision = validDecision('trim');
    expect('sourceStartPts' in decision).toBe(false);
    expect('sourceEndPts' in decision).toBe(false);
    expect('sourceTimeBase' in decision).toBe(false);
    expect('startFrame' in decision).toBe(false);
    expect('endFrame' in decision).toBe(false);
  });
});
