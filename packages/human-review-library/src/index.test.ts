import { describe, expect, it } from 'vitest';

import {
  HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
  type HumanReviewDecisionV1,
} from '../../contracts/src/human-review-decision.contract.js';
import {
  HumanReviewDecisionPersistenceInvariantError,
  InMemoryHumanReviewDecisionStore,
  sameImmutableHumanReviewDecision,
} from './index.js';

function decision(overrides: Partial<HumanReviewDecisionV1> = {}): HumanReviewDecisionV1 {
  return {
    schemaVersion: HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: 'review-decision:001',
    reviewSessionId: 'review-session:001',
    aiDecisionId: 'ai-decision:001',
    reviewedRevisionId: 'timeline-revision:001',
    itemId: 'clip:001',
    action: 'trim',
    resultingRevisionId: 'timeline-revision:002',
    reviewedBy: 'reviewer:001',
    reviewedAt: '2026-08-27T02:00:00.000Z',
    ...overrides,
  };
}

describe('immutable human-review decision persistence', () => {
  it('registers once and treats exact semantic re-registration as idempotent', () => {
    const store = new InMemoryHumanReviewDecisionStore();
    const first = store.registerDecision(decision());
    const second = store.registerDecision(decision());

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.decision).toEqual(first.decision);
    expect(store.getDecision(first.decision.decisionId)).toEqual(first.decision);
  });

  it('rejects decisionId reuse when review lineage changes', () => {
    const store = new InMemoryHumanReviewDecisionStore();
    store.registerDecision(decision());

    expect(() => store.registerDecision(decision({ reviewSessionId: 'review-session:other' })))
      .toThrow('conflicts with existing immutable decision');
    expect(() => store.registerDecision(decision({ aiDecisionId: 'ai-decision:other' })))
      .toThrow('conflicts with existing immutable decision');
    expect(() => store.registerDecision(decision({ reviewedRevisionId: 'timeline-revision:other' })))
      .toThrow('conflicts with existing immutable decision');
    expect(() => store.registerDecision(decision({ itemId: 'clip:other' })))
      .toThrow('conflicts with existing immutable decision');
  });

  it('rejects decisionId reuse when action, result, reviewer or timestamp evidence changes', () => {
    const store = new InMemoryHumanReviewDecisionStore();
    store.registerDecision(decision());

    expect(() => store.registerDecision(decision({ action: 'replace' })))
      .toThrow('conflicts with existing immutable decision');
    expect(() => store.registerDecision(decision({ resultingRevisionId: 'timeline-revision:003' })))
      .toThrow('conflicts with existing immutable decision');
    expect(() => store.registerDecision(decision({ reviewedBy: 'reviewer:other' })))
      .toThrow('conflicts with existing immutable decision');
    expect(() => store.registerDecision(decision({ reviewedAt: '2026-08-27T02:01:00.000Z' })))
      .toThrow('conflicts with existing immutable decision');
  });

  it('allows additive decisions without mutating prior review evidence', () => {
    const store = new InMemoryHumanReviewDecisionStore();
    const original = store.registerDecision(decision()).decision;
    const accepted = decision({
      decisionId: 'review-decision:002',
      reviewSessionId: 'review-session:002',
      reviewedRevisionId: 'timeline-revision:002',
      action: 'accept',
      reviewedAt: '2026-08-27T02:05:00.000Z',
    });
    delete accepted.resultingRevisionId;
    const next = store.registerDecision(accepted).decision;

    expect(next.decisionId).not.toBe(original.decisionId);
    expect(store.getDecision(original.decisionId)).toEqual(original);
    expect(store.getDecision(next.decisionId)).toEqual(next);
  });

  it('returns defensive copies so callers cannot mutate immutable evidence', () => {
    const store = new InMemoryHumanReviewDecisionStore();
    const created = store.registerDecision(decision()).decision;
    created.reviewedBy = 'mutated';

    expect(store.getDecision('review-decision:001')?.reviewedBy).toBe('reviewer:001');
  });

  it('validates before persistence side effects', () => {
    const store = new InMemoryHumanReviewDecisionStore();
    expect(() => store.registerDecision(decision({
      action: 'accept',
      resultingRevisionId: 'timeline-revision:002',
    }))).toThrow(HumanReviewDecisionPersistenceInvariantError);
    expect(store.getDecision('review-decision:001')).toBeUndefined();
  });
});

describe('sameImmutableHumanReviewDecision', () => {
  it('compares all immutable review-decision evidence', () => {
    expect(sameImmutableHumanReviewDecision(decision(), decision())).toBe(true);
    expect(sameImmutableHumanReviewDecision(
      decision(),
      decision({ decisionId: 'review-decision:other' }),
    )).toBe(false);
  });
});
