import { describe, expect, it } from 'vitest';

import {
  HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
  type HumanReviewAction,
  type HumanReviewDecisionV1,
} from '../../contracts/src/human-review-decision.contract.js';
import {
  HUMAN_ACCEPTANCE_MEASUREMENT_SCHEMA_VERSION,
  HumanAcceptanceMeasurementInvariantError,
  measureHumanAcceptanceRate,
  type HumanAcceptanceMeasurementV1,
} from './har-measurement.js';

function reviewedDecision(
  index: number,
  action: HumanReviewAction,
): HumanReviewDecisionV1 {
  const base: HumanReviewDecisionV1 = {
    schemaVersion: HUMAN_REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: `review-decision:${index}`,
    reviewSessionId: 'review-session:phase7-baseline-v1',
    aiDecisionId: `ai-decision:${index}`,
    reviewedRevisionId: `timeline-revision:${index}`,
    itemId: `clip:${index}`,
    action,
    reviewedBy: 'reviewer:fixture',
    reviewedAt: `2026-08-27T03:1${index}:00.000Z`,
  };
  if (action !== 'accept') {
    base.resultingRevisionId = `timeline-revision:${index}:reviewed`;
  }
  return base;
}

function measurement(
  overrides: Partial<HumanAcceptanceMeasurementV1> = {},
): HumanAcceptanceMeasurementV1 {
  return {
    schemaVersion: HUMAN_ACCEPTANCE_MEASUREMENT_SCHEMA_VERSION,
    measurementId: 'human-acceptance-rate:phase7-baseline',
    revisionId: 'human-acceptance-rate:phase7-baseline:v1',
    eligibleAiDecisionIds: [
      'ai-decision:1',
      'ai-decision:2',
      'ai-decision:3',
      'ai-decision:4',
      'ai-decision:5',
      'ai-decision:6',
    ],
    publishedAiDecisionIds: [
      'ai-decision:1',
      'ai-decision:2',
      'ai-decision:3',
      'ai-decision:5',
      'ai-decision:6',
    ],
    reviewedDecisions: [
      reviewedDecision(1, 'accept'),
      reviewedDecision(2, 'lock'),
      reviewedDecision(3, 'trim'),
      reviewedDecision(4, 'replace'),
    ],
    measuredAt: '2026-08-27T03:30:00.000Z',
    ...overrides,
  };
}

describe('Phase-7 Human Acceptance Rate measurement', () => {
  it('uses reviewed decisions only for HAR and reports coverage/publish-without-edit separately', () => {
    const result = measureHumanAcceptanceRate(measurement());

    expect(result.reviewedDecisionCount).toBe(4);
    expect(result.acceptedDecisionCount).toBe(2);
    expect(result.editedDecisionCount).toBe(2);
    expect(result.humanAcceptanceRate).toBe(0.5);
    expect(result.eligibleAiDecisionCount).toBe(6);
    expect(result.reviewCoverage).toBeCloseTo(4 / 6);
    expect(result.publishedAiDecisionCount).toBe(5);
    expect(result.publishedWithoutHumanEditCount).toBe(4);
    expect(result.publishWithoutEditRate).toBe(0.8);
    expect(result.actionCounts).toEqual({ accept: 1, replace: 1, trim: 1, lock: 1 });
    expect(result.reviewedAiDecisionIds).toEqual([
      'ai-decision:1',
      'ai-decision:2',
      'ai-decision:3',
      'ai-decision:4',
    ]);
  });

  it('does not treat unreviewed eligible AI decisions as HAR rejects', () => {
    const result = measureHumanAcceptanceRate(measurement({
      reviewedDecisions: [reviewedDecision(1, 'accept')],
    }));

    expect(result.humanAcceptanceRate).toBe(1);
    expect(result.reviewCoverage).toBeCloseTo(1 / 6);
  });

  it('counts lock as retained AI media while replace/trim are reviewed edits', () => {
    const result = measureHumanAcceptanceRate(measurement({
      eligibleAiDecisionIds: ['ai-decision:1', 'ai-decision:2', 'ai-decision:3'],
      publishedAiDecisionIds: ['ai-decision:1', 'ai-decision:2', 'ai-decision:3'],
      reviewedDecisions: [
        reviewedDecision(1, 'lock'),
        reviewedDecision(2, 'replace'),
        reviewedDecision(3, 'trim'),
      ],
    }));

    expect(result.acceptedDecisionCount).toBe(1);
    expect(result.editedDecisionCount).toBe(2);
    expect(result.humanAcceptanceRate).toBeCloseTo(1 / 3);
    expect(result.publishWithoutEditRate).toBeCloseTo(1 / 3);
  });

  it('fails closed on duplicate reviews of one AI decision', () => {
    const duplicate = reviewedDecision(1, 'trim');
    duplicate.decisionId = 'review-decision:duplicate';

    expect(() => measureHumanAcceptanceRate(measurement({
      reviewedDecisions: [reviewedDecision(1, 'accept'), duplicate],
    }))).toThrow('has more than one review decision');
  });

  it('fails closed when reviewed or published evidence escapes the eligible population', () => {
    expect(() => measureHumanAcceptanceRate(measurement({
      reviewedDecisions: [reviewedDecision(9, 'accept')],
    }))).toThrow('is not in the eligible population');

    expect(() => measureHumanAcceptanceRate(measurement({
      publishedAiDecisionIds: ['ai-decision:9'],
    }))).toThrow('is not in the eligible population');
  });

  it('requires at least one reviewed decision and valid durable review evidence', () => {
    expect(() => measureHumanAcceptanceRate(measurement({ reviewedDecisions: [] })))
      .toThrow(HumanAcceptanceMeasurementInvariantError);

    const invalid = reviewedDecision(1, 'accept');
    invalid.resultingRevisionId = 'timeline-revision:invalid';
    expect(() => measureHumanAcceptanceRate(measurement({ reviewedDecisions: [invalid] })))
      .toThrow('invalid reviewed decision');
  });
});
