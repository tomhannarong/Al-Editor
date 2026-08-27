import {
  validateHumanReviewDecision,
  type HumanReviewAction,
  type HumanReviewDecisionV1,
} from '../../contracts/src/human-review-decision.contract.js';

export const HUMAN_ACCEPTANCE_MEASUREMENT_SCHEMA_VERSION = '1.0' as const;

export interface HumanAcceptanceMeasurementV1 {
  schemaVersion: typeof HUMAN_ACCEPTANCE_MEASUREMENT_SCHEMA_VERSION;
  measurementId: string;
  revisionId: string;
  eligibleAiDecisionIds: string[];
  publishedAiDecisionIds: string[];
  reviewedDecisions: HumanReviewDecisionV1[];
  measuredAt: string;
}

export interface HumanAcceptanceActionCounts {
  accept: number;
  replace: number;
  trim: number;
  lock: number;
}

export interface HumanAcceptanceMeasurementResultV1 {
  measurementId: string;
  revisionId: string;
  eligibleAiDecisionCount: number;
  reviewedDecisionCount: number;
  acceptedDecisionCount: number;
  editedDecisionCount: number;
  humanAcceptanceRate: number;
  reviewCoverage: number;
  publishedAiDecisionCount: number;
  publishedWithoutHumanEditCount: number;
  publishWithoutEditRate: number;
  actionCounts: HumanAcceptanceActionCounts;
  reviewedDecisionIds: string[];
  reviewedAiDecisionIds: string[];
}

export class HumanAcceptanceMeasurementInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumanAcceptanceMeasurementInvariantError';
  }
}

/**
 * Deterministic Phase-7 Human Acceptance Rate evaluator.
 *
 * HAR denominator is reviewed AI decisions only. `accept` and `lock` retain the
 * AI media decision without a replace/trim edit, while replace/trim are reviewed
 * edits. Review coverage is measured independently over the eligible AI-decision
 * population. Publish-without-edit is also independent: an eligible published
 * decision counts when it has no human media edit (unreviewed, accept, or lock).
 *
 * This evaluator consumes durable human-review evidence but does not duplicate
 * canonical project-frame/native-PTS timing or source lineage from timeline
 * revisions.
 */
export function measureHumanAcceptanceRate(
  measurement: HumanAcceptanceMeasurementV1,
): HumanAcceptanceMeasurementResultV1 {
  validateMeasurementHeader(measurement);

  const eligible = uniqueRequiredIds(measurement.eligibleAiDecisionIds, 'eligibleAiDecisionIds');
  if (eligible.size === 0) {
    throw new HumanAcceptanceMeasurementInvariantError(
      'eligibleAiDecisionIds requires at least one AI decision',
    );
  }

  const published = uniqueRequiredIds(measurement.publishedAiDecisionIds, 'publishedAiDecisionIds');
  for (const aiDecisionId of published) {
    if (!eligible.has(aiDecisionId)) {
      throw new HumanAcceptanceMeasurementInvariantError(
        `published AI decision ${aiDecisionId} is not in the eligible population`,
      );
    }
  }

  const seenDecisionIds = new Set<string>();
  const reviewedByAiDecision = new Map<string, HumanReviewDecisionV1>();
  const actionCounts: HumanAcceptanceActionCounts = {
    accept: 0,
    replace: 0,
    trim: 0,
    lock: 0,
  };

  for (const decision of measurement.reviewedDecisions) {
    const validation = validateHumanReviewDecision(decision);
    if (!validation.valid) {
      throw new HumanAcceptanceMeasurementInvariantError(
        `invalid reviewed decision ${decision.decisionId}: ${validation.errors.join('; ')}`,
      );
    }
    if (seenDecisionIds.has(decision.decisionId)) {
      throw new HumanAcceptanceMeasurementInvariantError(
        `duplicate reviewed decisionId ${decision.decisionId}`,
      );
    }
    seenDecisionIds.add(decision.decisionId);

    if (!eligible.has(decision.aiDecisionId)) {
      throw new HumanAcceptanceMeasurementInvariantError(
        `reviewed AI decision ${decision.aiDecisionId} is not in the eligible population`,
      );
    }
    if (reviewedByAiDecision.has(decision.aiDecisionId)) {
      throw new HumanAcceptanceMeasurementInvariantError(
        `AI decision ${decision.aiDecisionId} has more than one review decision in the measurement revision`,
      );
    }
    reviewedByAiDecision.set(decision.aiDecisionId, { ...decision });
    actionCounts[decision.action] += 1;
  }

  if (reviewedByAiDecision.size === 0) {
    throw new HumanAcceptanceMeasurementInvariantError(
      'HAR requires at least one reviewed AI decision',
    );
  }

  const acceptedDecisionCount = actionCounts.accept + actionCounts.lock;
  const editedDecisionCount = actionCounts.replace + actionCounts.trim;
  const publishedWithoutHumanEditCount = [...published].filter((aiDecisionId) => {
    const review = reviewedByAiDecision.get(aiDecisionId);
    return review === undefined || retainsAiMediaDecision(review.action);
  }).length;

  return {
    measurementId: measurement.measurementId,
    revisionId: measurement.revisionId,
    eligibleAiDecisionCount: eligible.size,
    reviewedDecisionCount: reviewedByAiDecision.size,
    acceptedDecisionCount,
    editedDecisionCount,
    humanAcceptanceRate: acceptedDecisionCount / reviewedByAiDecision.size,
    reviewCoverage: reviewedByAiDecision.size / eligible.size,
    publishedAiDecisionCount: published.size,
    publishedWithoutHumanEditCount,
    publishWithoutEditRate: published.size === 0 ? 0 : publishedWithoutHumanEditCount / published.size,
    actionCounts,
    reviewedDecisionIds: [...seenDecisionIds].sort(),
    reviewedAiDecisionIds: [...reviewedByAiDecision.keys()].sort(),
  };
}

function retainsAiMediaDecision(action: HumanReviewAction): boolean {
  return action === 'accept' || action === 'lock';
}

function validateMeasurementHeader(measurement: HumanAcceptanceMeasurementV1): void {
  if (measurement.schemaVersion !== HUMAN_ACCEPTANCE_MEASUREMENT_SCHEMA_VERSION) {
    throw new HumanAcceptanceMeasurementInvariantError(
      'unsupported human-acceptance measurement schemaVersion',
    );
  }
  if (!measurement.measurementId.trim()) {
    throw new HumanAcceptanceMeasurementInvariantError('measurementId is required');
  }
  if (!measurement.revisionId.trim()) {
    throw new HumanAcceptanceMeasurementInvariantError('revisionId is required');
  }
  if (Number.isNaN(Date.parse(measurement.measuredAt))) {
    throw new HumanAcceptanceMeasurementInvariantError(
      'measuredAt must be an ISO-compatible timestamp',
    );
  }
}

function uniqueRequiredIds(values: readonly string[], label: string): Set<string> {
  const result = new Set<string>();
  for (const value of values) {
    if (!value.trim()) {
      throw new HumanAcceptanceMeasurementInvariantError(`${label} contains an empty ID`);
    }
    if (result.has(value)) {
      throw new HumanAcceptanceMeasurementInvariantError(`${label} contains duplicate ID ${value}`);
    }
    result.add(value);
  }
  return result;
}
